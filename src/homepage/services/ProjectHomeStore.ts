import { isProjectData } from "./project-validation";
import { recordProjectChanges } from "./project-events";
import { registerDeliverablePaths } from "./DeliverablePathRegistry";
import { App, type TFile } from "obsidian";
import { getPluginDataPath } from "../../utils/plugin-paths";
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
} from "./ProjectHomeFileResolver";

export interface ProjectHomeRecord {
  file: TFile;
  data: ProjectConsoleData;
}

const LEGACY_TASK_REGEX = /^- \[([ xX])\] (.+)$/;
const migrationLocks = new Map<string, Promise<ProjectHomeRecord | null>>();
const projectWriteQueues = new Map<string, Promise<void>>();
const appScopeIds = new WeakMap<object, number>();
let nextAppScopeId = 1;

function appScopeKey(app: App, projectPath: string): string {
  let scopeId = appScopeIds.get(app as unknown as object);
  if (!scopeId) {
    scopeId = nextAppScopeId++;
    appScopeIds.set(app as unknown as object, scopeId);
  }
  const normalized = projectPath.replace(/\\/g, "/").replace(/\/+$/, "");
  return `${scopeId}::${normalized}`;
}

function prepareWrite(data: ProjectConsoleData): ProjectConsoleData {
  const normalized = normalizeData(data).data;
  normalized.projectId ||= globalThis.crypto.randomUUID();
  normalized.schemaVersion = 2;
  // The first explicit write materializes legacy tasks; later reads must not resurrect removed tasks.
  if (normalized.timeline) normalized.timeline.migratedAt ||= new Date().toISOString();
  return normalized;
}

function enqueueProjectWrite<T>(app: App, projectPath: string, operation: () => Promise<T>): Promise<T> {
  const key = appScopeKey(app, projectPath);
  const previous = projectWriteQueues.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  const settled = current.then(() => undefined, () => undefined);
  projectWriteQueues.set(key, settled);
  void settled.finally(() => {
    if (projectWriteQueues.get(key) === settled) projectWriteQueues.delete(key);
  });
  return current;
}

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
  const legacyMilestones = Array.isArray((data as any).milestones)
      ? (data as any).milestones.map((milestone: any, index: number) => ({
          id: milestone.id || `milestone-${index}`,
          name: milestone.name || milestone.title || "未命名里程碑",
          date: milestone.date || milestone.deadline || "",
          progress: Number(milestone.progress ?? (milestone.completed ? 100 : 0)),
          completed: Boolean(milestone.completed ?? milestone.isCompleted),
        }))
      : [];
  if (!data.timeline) {
    data.timeline = { milestones: legacyMilestones };
    changed = true;
  } else if (!Array.isArray(data.timeline.milestones)) {
    data.timeline.milestones = legacyMilestones;
    changed = true;
  } else if (data.timeline.milestones.length === 0 && legacyMilestones.length) {
    data.timeline.milestones = legacyMilestones;
    changed = true;
  }
  // The old `milestones` array and the canonical `timeline.milestones` array
  // describe the same records. Keeping both after migration makes the unified
  // event collector emit duplicate baseline/update events. Once the canonical
  // timeline exists, remove the legacy mirror; the original file is still
  // backed up on the first explicit write.
  if (Object.prototype.hasOwnProperty.call(data, "milestones")) {
    delete (data as any).milestones;
    changed = true;
  }
  return { data, changed };
}

function taskSignature(task: ProjectConsoleTask): string {
  return [task.text.trim(), task.created || "", task.due || "", task.dueTime || ""].join("|");
}

export async function loadProjectHome(
  app: App,
  projectPath: string,
  preferredName?: string,
): Promise<ProjectHomeRecord | null> {
  const normalized = projectPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const key = appScopeKey(app, normalized);
  const running = migrationLocks.get(key);
  if (running) return running;
  const task = readProjectHome(app, normalized, preferredName).finally(() => migrationLocks.delete(key));
  migrationLocks.set(key, task);
  return task;
}

/** Reading a project is deliberately free of filesystem mutations. */
async function readProjectHome(app: App, path: string, name?: string): Promise<ProjectHomeRecord | null> {
  const file = findProjectHomeFile(app, path, name);
  if (!file) return null;
  try {
    const parsed = JSON.parse(await app.vault.read(file)) as ProjectConsoleData;
    if (!isProjectData(parsed)) return null;
    const data = normalizeData(parsed).data;
    registerDeliverablePaths(app, path, data.deliverables);
    if (!data.overview?.migratedAt && !data.overview?.markdown) {
      const overview = findProjectOverviewFile(app, path);
      if (overview) data.overview = { markdown: await app.vault.read(overview) };
    }
    // Legacy content remains available without moving or deleting the source notes.
    if (!data.timeline?.migratedAt) {
      const timeline = findProjectTimelineFile(app, path);
      if (timeline) {
        const legacy = parseLegacyTimeline(await app.vault.read(timeline));
        const signatures = new Set(data.tasks.map(taskSignature));
        for (const task of legacy.tasks) {
          if (!signatures.has(taskSignature(task))) {
            data.tasks.push(task);
            signatures.add(taskSignature(task));
          }
        }
        data.timeline = { ...data.timeline, milestones: data.timeline?.milestones?.length ? data.timeline.milestones : legacy.milestones };
      }
    }
    return { file, data };
  } catch (error) {
    console.error(`[ProjectHomeStore] 无法读取项目，已保留原文件: ${path}`, error);
    return null;
  }
}

/**
 * 在按项目串行化的临界区中重新读取最新数据并修改，避免多个 UI 操作整文件互相覆盖。
 * mutator 返回 false 时不写入。
 */
export async function mutateProjectHome(
  app: App,
  projectPath: string,
  mutator: (data: ProjectConsoleData) => boolean | void | Promise<boolean | void>,
): Promise<boolean> {
  return enqueueProjectWrite(app, projectPath, async () => {
    const record = await loadProjectHome(app, projectPath);
    if (!record) return false;
    try {
      const before = await app.vault.read(record.file);
      // Re-read instead of trusting a possibly shared read promise or a UI cache.
      const latest = JSON.parse(before) as ProjectConsoleData;
      if (!isProjectData(latest)) return false;
      const current = normalizeData(latest).data;
      if (!current.timeline?.migratedAt) {
        current.tasks = record.data.tasks;
        current.timeline = record.data.timeline;
      }
      if (!current.overview?.markdown && record.data.overview?.markdown) current.overview = record.data.overview;
      const previous = structuredClone(current);
      const shouldSave = await mutator(current);
      if (shouldSave === false) return false;
      recordProjectChanges(previous, current);
      if (latest.schemaVersion !== 2 || !latest.projectId) {
        const backupPath = getPluginDataPath(app, `project-backup-${globalThis.crypto.randomUUID()}.json`);
        await app.vault.adapter.write(backupPath, before);
      }
      const normalized = prepareWrite(current);
      if (!isProjectData(normalized)) throw new Error("修改后的项目数据格式无效，原主页未覆盖");
      await app.vault.process(record.file, content => {
        if (content !== before) throw new Error("项目已被外部修改，请刷新后重试；原文件未覆盖");
        return JSON.stringify(normalized, null, 2);
      });
      try {
        (app.workspace as any)?.trigger?.("zendian:project-changed", projectPath);
      } catch (error) {
        // A view notification failure must not report a committed write as failed.
        console.error("[ProjectHomeStore] 已保存，但界面通知失败", error);
      }
      return true;
    } catch (error) {
      console.error(`[ProjectHomeStore] 更新项目主页失败: ${projectPath}`, error);
      return false;
    }
  });
}
