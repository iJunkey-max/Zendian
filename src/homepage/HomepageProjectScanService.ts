/**
 * HomepageProjectScanService — 扫描 vault 项目文件夹
 *
 * 从设置读取类型文件夹列表，扫描每个文件夹下的项目主页，
 * 项目元数据、进度与待办均以 `项目主页.home` 为唯一事实源。
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
import { loadProjectHome } from "./services/ProjectHomeStore";
import { getProjectCategoryFolder } from "./project-categories";
import { calculateProjectProgress, normalizeProjectStatus } from "./project-status";

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

        // Vault 事件会精确失效发生变化的项目；其余项目直接复用缓存。
        const cached = this.cache.get(child.path);
        if (cached) {
          projects.push(cached);
        } else {
          // 重新扫描（项目发生变化或首次扫描）
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
   * 扫描单个项目文件夹
   *
   * 项目元数据、进度和待办只从项目主页读取。
   */
  private async scanProject(folder: TFolder, type: ProjectType): Promise<HomepageProject | null> {
    const folderPath = folder.path;
    const fallbackName = folder.name.replace(/^\d+_/, "") || folder.name;
    const homeData = await this.readHomeFile(folderPath, fallbackName);
    const name = homeData?.name || fallbackName;
    const tasks = homeData?.tasks || [];
    const taskTotal = tasks.length;
    const taskDone = tasks.filter((task) => task.completed).length;
    const status = normalizeProjectStatus(homeData?.status);
    const progress = calculateProjectProgress(status, taskDone, taskTotal).percent;
    const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
    const pendingTasks: ProjectTask[] = tasks
      .map((task, line) => ({ ...task, line }))
      .filter((task) => !task.completed)
      .sort((a, b) => {
        const priority = priorityOrder[a.priority || "P2"] - priorityOrder[b.priority || "P2"];
        if (priority !== 0) return priority;
        if (a.due && b.due) {
          const due = `${a.due}T${a.dueTime || "23:59"}`.localeCompare(`${b.due}T${b.dueTime || "23:59"}`);
          if (due !== 0) return due;
        } else if (a.due || b.due) {
          return a.due ? -1 : 1;
        }
        return (a.created || "").localeCompare(b.created || "") || a.text.localeCompare(b.text);
      });

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
      description: homeData?.description || "",
      recentFiles,
      pendingTasks,
      updatedAt,
      status,
      priority: homeData?.metadata?.priority === "urgent" ? "high" : homeData?.metadata?.priority,
      lastActiveTime: updatedAt,
      createdTime: homeData?.createdAt ? new Date(homeData.createdAt).getTime() : 0,
    };
  }

  /**
   * 在项目根目录或旧版控制台目录中查找 .home 文件并解析
   */
  private async readHomeFile(projectPath: string, projectName: string): Promise<ProjectConsoleData | null> {
    const record = await loadProjectHome(this.app, projectPath, projectName);
    return record?.data && typeof record.data.name === "string" ? record.data : null;
  }

  /**
   * 获取项目文件夹内最近编辑的文件（递归）
   */
  private getRecentFiles(folder: TFolder, limit: number): ProjectRecentFile[] {
    const files: ProjectRecentFile[] = [];

    const collectFiles = (f: TFolder) => {
      for (const child of f.children) {
        if (child instanceof TFile) {
          if (child.extension === "home") continue;
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
