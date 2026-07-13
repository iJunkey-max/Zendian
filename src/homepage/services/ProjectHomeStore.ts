import { App, TFile } from "obsidian";
import type {
  ProjectConsoleData,
  ProjectConsoleMilestone,
  ProjectConsoleTask,
  TaskPriority,
} from "../types";
import {
  findProjectHomeFile,
  findProjectOverviewFile,
  findProjectTimelineFile,
  PROJECT_HOME_FILENAME,
} from "./ProjectHomeFileResolver";

export interface ProjectHomeRecord {
  file: TFile;
  data: ProjectConsoleData;
}

const LEGACY_TASK_REGEX = /^- \[([ xX])\] (.+)$/;
const migrationLocks = new Map<string, Promise<ProjectHomeRecord | null>>();

function taskId(task: ProjectConsoleTask, index: number): string {
  if (task.id) return task.id;
  const source = `${task.text}|${task.created || ""}|${task.due || ""}|${index}`;
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `task-${(hash >>> 0).toString(36)}`;
}

function parsePriority(value?: string): TaskPriority | undefined {
  const map: Record<string, TaskPriority> = {
    urgent: "P0",
    high: "P1",
    medium: "P2",
    low: "P3",
    P0: "P0",
    P1: "P1",
    P2: "P2",
    P3: "P3",
  };
  return value ? map[value] : undefined;
}

export function parseLegacyTimeline(content: string): {
  tasks: ProjectConsoleTask[];
  milestones: ProjectConsoleMilestone[];
} {
  const tasks: ProjectConsoleTask[] = [];
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(LEGACY_TASK_REGEX);
    if (!match) continue;
    if (/\s+`\d{4}-\d{2}-\d{2}`\s+\(\d+%\)\s*$/.test(match[2])) continue;
    let text = match[2].trim();
    const take = (regex: RegExp): string | undefined => {
      const found = text.match(regex);
      if (!found) return undefined;
      text = text.replace(found[0], "").trim();
      return found[1];
    };
    const created = take(/@created\(([^)]+)\)/);
    const due = take(/@due\(([^)]+)\)/);
    const dueTime = take(/@time\(((?:[01]\d|2[0-3]):[0-5]\d)\)/);
    const priority = parsePriority(take(/@priority\(([^)]+)\)/));
    const tagsValue = take(/@tags\(([^)]*)\)/);
    const task: ProjectConsoleTask = {
      text,
      completed: match[1].toLowerCase() === "x",
      created,
      due,
      dueTime,
      priority,
      tags: tagsValue?.split(",").map((tag) => tag.trim()).filter(Boolean),
    };
    task.id = taskId(task, index);
    tasks.push(task);
  }

  const milestones: ProjectConsoleMilestone[] = [];
  const milestoneRegex = /- \[([x ])\] (.+?)\s+`([0-9]{4}-[0-9]{2}-[0-9]{2})`\s+\((\d+)%\)/gi;
  let milestone: RegExpExecArray | null;
  while ((milestone = milestoneRegex.exec(content)) !== null) {
    milestones.push({
      id: `milestone-${milestones.length}-${milestone[3]}`,
      name: milestone[2].trim(),
      date: milestone[3],
      progress: Number(milestone[4]),
      completed: milestone[1].toLowerCase() === "x",
    });
  }
  return { tasks, milestones };
}

function normalizeData(data: ProjectConsoleData): { data: ProjectConsoleData; changed: boolean } {
  let changed = false;
  data.tasks = Array.isArray(data.tasks) ? data.tasks : [];
  data.deliverables = Array.isArray(data.deliverables) ? data.deliverables : [];
  data.tasks = data.tasks.map((task, index) => {
    const id = taskId(task, index);
    const priority = parsePriority(task.priority as string | undefined);
    if (id !== task.id || priority !== task.priority) changed = true;
    return { ...task, id, priority };
  });
  if (!data.overview) {
    data.overview = { markdown: "" };
    changed = true;
  }
  if (!data.timeline) {
    const legacyMilestones = Array.isArray((data as any).milestones)
      ? (data as any).milestones.map((milestone: any, index: number) => ({
          id: milestone.id || `milestone-${index}`,
          name: milestone.name || milestone.title || "未命名里程碑",
          date: milestone.date || milestone.deadline || "",
          progress: Number(milestone.progress ?? (milestone.completed ? 100 : 0)),
          completed: Boolean(milestone.completed ?? milestone.isCompleted),
        }))
      : [];
    data.timeline = { milestones: legacyMilestones };
    changed = true;
  } else if (!Array.isArray(data.timeline.milestones)) {
    data.timeline.milestones = [];
    changed = true;
  }
  return { data, changed };
}

function taskSignature(task: ProjectConsoleTask): string {
  return [task.text.trim(), task.created || "", task.due || "", task.dueTime || ""].join("|");
}

async function loadProjectHomeInternal(
  app: App,
  projectPath: string,
  preferredName?: string,
): Promise<ProjectHomeRecord | null> {
  let file = findProjectHomeFile(app, projectPath, preferredName);
  if (!file) {
    const overview = findProjectOverviewFile(app, projectPath);
    const timeline = findProjectTimelineFile(app, projectPath);
    if (!overview && !timeline) return null;
    const name = preferredName?.trim() || projectPath.split("/").pop()?.replace(/^\d+_/, "") || "未命名项目";
    const initial: ProjectConsoleData = {
      name,
      icon: "lucide-folder",
      description: "",
      type: "未分类",
      status: "planning",
      statusHistory: [],
      createdAt: new Date().toISOString().slice(0, 10),
      tasks: [],
      deliverables: [],
      overview: { markdown: "" },
      timeline: { milestones: [] },
    };
    file = await app.vault.create(
      `${projectPath.replace(/\/+$/, "")}/${PROJECT_HOME_FILENAME}`,
      JSON.stringify(initial, null, 2),
    );
  }

  try {
    const parsed = JSON.parse(await app.vault.read(file)) as ProjectConsoleData;
    const normalized = normalizeData(parsed);
    const data = normalized.data;
    let changed = normalized.changed;
    const overviewFile = findProjectOverviewFile(app, projectPath);
    const timelineFile = findProjectTimelineFile(app, projectPath);

    if (overviewFile) {
      const overviewMarkdown = await app.vault.read(overviewFile);
      data.overview = {
        markdown: overviewMarkdown,
        migratedAt: new Date().toISOString(),
      };
      if (!data.description) {
        data.description = overviewMarkdown
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find((line) => line && !line.startsWith("#") && !line.startsWith("> 创建于"))
          ?.slice(0, 240) || "";
      }
      changed = true;
    }

    if (timelineFile) {
      const markdown = await app.vault.read(timelineFile);
      const legacy = parseLegacyTimeline(markdown);
      const existing = new Set(data.tasks.map(taskSignature));
      for (const task of legacy.tasks) {
        if (!existing.has(taskSignature(task))) data.tasks.push(task);
      }
      const milestoneMap = new Map(
        [...(data.timeline?.milestones || []), ...legacy.milestones]
          .map((milestone) => [`${milestone.name}|${milestone.date}`, milestone] as const),
      );
      data.timeline = {
        milestones: Array.from(milestoneMap.values()),
        legacyMarkdown: markdown,
        migratedAt: new Date().toISOString(),
      };
      changed = true;
    }

    if (changed) await app.vault.modify(file, JSON.stringify(data, null, 2));

    // 先把原文和结构化数据安全写入 .home，再移除旧文档。
    if (overviewFile) await app.vault.delete(overviewFile);
    if (timelineFile) await app.vault.delete(timelineFile);

    const canonicalPath = `${projectPath.replace(/\/+$/, "")}/${PROJECT_HOME_FILENAME}`;
    const canonical = app.vault.getAbstractFileByPath(canonicalPath);
    if (file.path !== canonicalPath && !canonical) {
      await app.vault.rename(file, canonicalPath);
      const renamed = app.vault.getAbstractFileByPath(canonicalPath);
      if (renamed instanceof TFile) file = renamed;
    }
    return { file, data };
  } catch (error) {
    console.error(`[ProjectHomeStore] 读取或迁移项目主页失败: ${projectPath}`, error);
    return null;
  }
}

export async function loadProjectHome(
  app: App,
  projectPath: string,
  preferredName?: string,
): Promise<ProjectHomeRecord | null> {
  const key = projectPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const running = migrationLocks.get(key);
  if (running) return running;
  const task = loadProjectHomeInternal(app, key, preferredName).finally(() => migrationLocks.delete(key));
  migrationLocks.set(key, task);
  return task;
}

export async function saveProjectHome(app: App, projectPath: string, data: ProjectConsoleData): Promise<boolean> {
  const file = findProjectHomeFile(app, projectPath, data.name);
  if (!file) return false;
  try {
    const normalized = normalizeData(data).data;
    await app.vault.modify(file, JSON.stringify(normalized, null, 2));
    return true;
  } catch (error) {
    console.error(`[ProjectHomeStore] 保存项目主页失败: ${projectPath}`, error);
    return false;
  }
}
