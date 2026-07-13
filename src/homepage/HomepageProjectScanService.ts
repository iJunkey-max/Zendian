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
  ProjectConsoleData,
} from "./types";
import type { ProjectCategory } from "../types/settings.types";
import {
  findProjectHomeFile,
  findProjectTimelineFile,
  getProjectSystemDirectory,
} from "./services/ProjectHomeFileResolver";
import { getProjectCategoryFolder } from "./project-categories";

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
  let dueTime: string | undefined;

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

  const dueTimeMatch = rawText.match(/@time\(((?:[01]\d|2[0-3]):[0-5]\d)\)/);
  if (dueTimeMatch) {
    dueTime = dueTimeMatch[1];
    rawText = rawText.replace(dueTimeMatch[0], "").trim();
  }

  return { text: rawText, completed, created, due, dueTime, line: lineNum };
}

export class HomepageProjectScanService {
  private cache = new Map<string, HomepageProject>();
  private lastScanTime = 0;
  private lastScanKey = "";
  private readonly CACHE_TTL = 30000; // 30秒缓存有效期

  constructor(private app: App) {}

  markDirty(): void {
    // 重置时间戳，触发下次扫描，但保留缓存数据
    this.lastScanTime = 0;
  }

  invalidate(folderPath: string): void {
    // 只删除指定项目的缓存，不触发全量重扫
    this.cache.delete(folderPath);
  }

  /**
   * 获取所有活跃项目（带智能缓存）
   */
  async getProjects(categories: ProjectCategory[], archiveFolder: string): Promise<HomepageProject[]> {
    const now = Date.now();
    const scanKey = JSON.stringify([categories, archiveFolder]);

    // 如果缓存未过期，直接返回
    if (this.cache.size > 0 && scanKey === this.lastScanKey && (now - this.lastScanTime) < this.CACHE_TTL) {
      return Array.from(this.cache.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    }

    const projects: HomepageProject[] = [];
    const scannedPaths = new Set<string>();

    for (const category of categories) {
      const typeFolderName = getProjectCategoryFolder(category);
      const typeLabel: ProjectType = category.name;

      const typeFolder = this.app.vault.getAbstractFileByPath(typeFolderName);
      if (!(typeFolder instanceof TFolder)) continue;

      for (const child of typeFolder.children) {
        if (!(child instanceof TFolder)) continue;
        // 跳过当前分类下的归档文件夹
        if (child.name === archiveFolder || child.name.startsWith("99")) continue;
        scannedPaths.add(child.path);

        // 增量更新：检查缓存是否有效
        const cached = this.cache.get(child.path);
        const folderMtime = this.getFolderMtime(child);

        if (cached && cached.updatedAt >= folderMtime) {
          // 使用缓存（文件夹没有更新）
          projects.push(cached);
        } else {
          // 重新扫描（文件夹有更新或首次扫描）
          const project = await this.scanProject(child, typeLabel);
          if (project) {
            projects.push(project);
            this.cache.set(project.id, project);
          }
        }
      }
    }

    for (const cachedPath of this.cache.keys()) {
      if (!scannedPaths.has(cachedPath)) this.cache.delete(cachedPath);
    }
    this.lastScanTime = now;
    this.lastScanKey = scanKey;
    return projects.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * 获取文件夹的最新修改时间
   */
  private getFolderMtime(folder: TFolder): number {
    let maxMtime = 0;
    for (const child of folder.children) {
      if (child instanceof TFile) {
        maxMtime = Math.max(maxMtime, child.stat.mtime);
      } else if (child instanceof TFolder) {
        // 只检查直接子文件夹的第一层文件
        for (const subChild of child.children) {
          if (subChild instanceof TFile) {
            maxMtime = Math.max(maxMtime, subChild.stat.mtime);
          }
        }
      }
    }
    return maxMtime;
  }

  /**
   * 扫描单个项目文件夹
   *
   * 优先从 .home 文件读取数据，降级到 Overview.md + Timeline.md
   */
  private async scanProject(folder: TFolder, type: ProjectType): Promise<HomepageProject | null> {
    const folderPath = folder.path;
    const fallbackName = folder.name.replace(/^\d+_/, "") || folder.name;
    const systemPath = getProjectSystemDirectory(this.app, folderPath);

    // 优先从 .home 文件读取
    const homeData = await this.readHomeFile(folderPath, fallbackName);
    const name = homeData?.name || fallbackName;
    const timelineFile = findProjectTimelineFile(this.app, folderPath);
    const timelineData = await this.parseTimeline(systemPath);

    let description: string;
    let taskTotal: number;
    let taskDone: number;
    let progress: number;
    let pendingTasks: ProjectTask[];

    if (homeData) {
      // .home 提供元数据；Timeline.md 是任务事实源。
      description = homeData.description || "";
      if (timelineFile instanceof TFile) {
        taskTotal = timelineData.taskTotal;
        taskDone = timelineData.taskDone;
        progress = timelineData.progress;
        pendingTasks = timelineData.pendingTasks;
      } else {
        taskTotal = homeData.tasks.length;
        taskDone = homeData.tasks.filter((t) => t.completed).length;
        progress = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;
        pendingTasks = homeData.tasks
          .filter((t) => !t.completed)
          .map((t, i) => ({ text: t.text, completed: false, created: t.created, due: t.due, dueTime: t.dueTime, line: i }));
      }
    } else {
      // 降级：从 Overview.md + Timeline.md 读取
      description = await this.readFirstParagraph(systemPath, "Overview.md");
      taskTotal = timelineData.taskTotal;
      taskDone = timelineData.taskDone;
      progress = timelineData.progress;
      pendingTasks = timelineData.pendingTasks;
    }

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
      status: homeData?.status === "archived" ? "completed" : homeData?.status,
      priority: homeData?.metadata?.priority === "urgent" ? "high" : homeData?.metadata?.priority,
      lastActiveTime: updatedAt,
      createdTime: homeData?.createdAt ? new Date(homeData.createdAt).getTime() : 0,
    };
  }

  /**
   * 在项目根目录或旧版控制台目录中查找 .home 文件并解析
   */
  private async readHomeFile(projectPath: string, projectName: string): Promise<ProjectConsoleData | null> {
    const file = findProjectHomeFile(this.app, projectPath, projectName);
    if (!file) return null;

    try {
      const content = await this.app.vault.read(file);
      const data = JSON.parse(content) as ProjectConsoleData;
      return data && typeof data.name === "string" ? data : null;
    } catch (error) {
      console.warn(`[ZENdian] 解析 ${file.path} 失败:`, error);
      return null;
    }
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
