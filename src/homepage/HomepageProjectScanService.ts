/**
 * HomepageProjectScanService — 扫描 vault 项目文件夹
 *
 * 从设置读取类型文件夹列表，扫描每个文件夹下的子项目，
 * 从 Overview.md 读取描述，从 Timeline.md 自动计算进度。
 */

import { App, TFile, TFolder } from "obsidian";
import type {
  HomepageProject,
  ProjectType,
  ProjectRecentFile,
  ProjectTask,
} from "./types";

const TASK_REGEX = /^- \[([ x])\] (.+)$/;

/**
 * 从任务行中提取文本和时间标记
 * 格式：- [ ] 任务文本 @created(2026-01-15) @due(2026-02-01)
 */
function parseTaskLine(line: string, lineNum: number): ProjectTask | null {
  const match = line.match(TASK_REGEX);
  if (!match) return null;

  const completed = match[1] === "x";
  let rawText = match[2].trim();

  let created: string | undefined;
  let due: string | undefined;

  const createdMatch = rawText.match(/@created\(([^)]*)\)/);
  if (createdMatch) {
    created = createdMatch[1];
    rawText = rawText.replace(createdMatch[0], "").trim();
  }

  const dueMatch = rawText.match(/@due\(([^)]*)\)/);
  if (dueMatch) {
    due = dueMatch[1];
    rawText = rawText.replace(dueMatch[0], "").trim();
  }

  return { text: rawText, completed, created, due, line: lineNum };
}

/**
 * 从文件夹名提取类型标签
 * "10.学习" → "学习"，"20_竞赛" → "竞赛"，"30.创作" → "创作"
 */
function extractTypeLabel(folderName: string): ProjectType {
  const dotIdx = folderName.indexOf(".");
  if (dotIdx !== -1) return folderName.slice(dotIdx + 1) as ProjectType;
  const underIdx = folderName.indexOf("_");
  if (underIdx !== -1) return folderName.slice(underIdx + 1) as ProjectType;
  return folderName as ProjectType;
}

export class HomepageProjectScanService {
  private cache = new Map<string, HomepageProject>();
  private dirty = true;

  constructor(private app: App) {}

  markDirty(): void {
    this.dirty = true;
  }

  invalidate(folderPath: string): void {
    this.cache.delete(folderPath);
    this.dirty = true;
  }

  /**
   * 获取所有活跃项目（带缓存）
   */
  async getProjects(typeFolders: string, archiveFolder: string): Promise<HomepageProject[]> {
    if (!this.dirty && this.cache.size > 0) {
      return Array.from(this.cache.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    }

    const projects: HomepageProject[] = [];
    const folders = typeFolders.split(",").map((f) => f.trim()).filter(Boolean);

    for (const typeFolderName of folders) {
      const typeLabel = extractTypeLabel(typeFolderName);
      if (!typeLabel) continue;

      const typeFolder = this.app.vault.getAbstractFileByPath(typeFolderName);
      if (!(typeFolder instanceof TFolder)) continue;

      for (const child of typeFolder.children) {
        if (!(child instanceof TFolder)) continue;
        // 跳过归档文件夹（支持 99.归档 和 99_归档）
        if (child.name === archiveFolder || child.name.startsWith("99")) continue;

        const project = await this.scanProject(child, typeLabel);
        if (project) {
          projects.push(project);
          this.cache.set(project.id, project);
        }
      }
    }

    this.dirty = false;
    return projects.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * 扫描单个项目文件夹
   */
  private async scanProject(folder: TFolder, type: ProjectType): Promise<HomepageProject | null> {
    const folderPath = folder.path;
    const name = folder.name;
    const consolePath = `${folderPath}/00 控制台`;

    // 从 00 控制台/Overview.md 读取描述
    const description = await this.readFirstParagraph(consolePath, "Overview.md");

    // 从 00 控制台/Timeline.md 读取任务进度
    const { taskTotal, taskDone, progress, pendingTasks } = await this.parseTimeline(consolePath);

    // 获取最近编辑的文件
    const recentFiles = this.getRecentFiles(folder, 5);

    const updatedAt = recentFiles.length > 0 ? recentFiles[0].mtime : 0;

    return {
      id: folderPath,
      name,
      folderPath,
      type,
      progress,
      taskTotal,
      taskDone,
      description,
      recentFiles,
      pendingTasks,
      updatedAt,
    };
  }

  /**
   * 读取指定文件的第一段非空文本
   */
  private async readFirstParagraph(folderPath: string, fileName: string): Promise<string> {
    const filePath = `${folderPath}/${fileName}`;
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) return "";

    try {
      const content = await this.app.vault.read(file);
      const lines = content.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("---")) {
          return trimmed.length > 120 ? trimmed.slice(0, 120) + "..." : trimmed;
        }
      }
    } catch {
      // 降级为空
    }
    return "";
  }

  /**
   * 解析 Timeline.md，计算任务进度和待办列表
   */
  private async parseTimeline(
    folderPath: string
  ): Promise<{ taskTotal: number; taskDone: number; progress: number; pendingTasks: ProjectTask[] }> {
    const filePath = `${folderPath}/Timeline.md`;
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!(file instanceof TFile)) {
      return { taskTotal: 0, taskDone: 0, progress: 0, pendingTasks: [] };
    }

    try {
      const content = await this.app.vault.read(file);
      const lines = content.split("\n");
      let taskTotal = 0;
      let taskDone = 0;
      const pendingTasks: ProjectTask[] = [];

      for (let i = 0; i < lines.length; i++) {
        const task = parseTaskLine(lines[i], i);
        if (!task) continue;

        taskTotal++;
        if (task.completed) {
          taskDone++;
        } else {
          pendingTasks.push(task);
        }
      }

      const progress = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;
      return { taskTotal, taskDone, progress, pendingTasks };
    } catch {
      return { taskTotal: 0, taskDone: 0, progress: 0, pendingTasks: [] };
    }
  }

  /**
   * 获取项目文件夹内最近编辑的文件（递归）
   */
  private getRecentFiles(folder: TFolder, limit: number): ProjectRecentFile[] {
    const files: ProjectRecentFile[] = [];

    const collectFiles = (f: TFolder) => {
      for (const child of f.children) {
        if (child instanceof TFile) {
          files.push({
            name: child.basename,
            path: child.path,
            mtime: child.stat.mtime,
          });
        } else if (child instanceof TFolder) {
          collectFiles(child);
        }
      }
    };

    collectFiles(folder);
    files.sort((a, b) => b.mtime - a.mtime);
    return files.slice(0, limit);
  }
}
