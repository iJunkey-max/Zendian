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
import { ProjectRegistry } from "./services/ProjectRegistry";
import { loadProjectHome } from "./services/ProjectHomeStore";
import { getProjectCategoryFolder } from "./project-categories";
import { calculateProjectProgress, normalizeProjectStatus } from "./project-status";
import { isDeliverablePath } from "./services/DeliverablePathRegistry";

export class HomepageProjectScanService {
  private cache = new Map<string, HomepageProject>();
  private lastScanTime = 0;
  private lastScanKey = "";
  private scanPromise: Promise<HomepageProject[]> | null = null;
  private dirtyGeneration = 0;
  private readonly CACHE_TTL = 30000; // 30秒缓存有效期

  constructor(private app: App) {}

  markDirty(): void {
    // 重置时间戳，触发下次扫描，但保留缓存数据
    this.lastScanTime = 0;
    this.dirtyGeneration++;
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

    // Homepage sections request the same project list in parallel. Share one
    // scan instead of letting each caller race to rewrite the cache.
    if (this.scanPromise) return this.scanPromise;

    const run = async (): Promise<HomepageProject[]> => {
      // If a vault event arrives while scanning, discard that result and run
      // once more against the newest file tree before exposing it to callers.
      while (true) {
        const generation = this.dirtyGeneration;
        const result = await this.scanOnce(categories, archiveFolder, scanKey, generation);
        if (generation === this.dirtyGeneration) return result;
      }
    };
    const current = run();
    this.scanPromise = current.finally(() => {
      if (this.scanPromise === current) this.scanPromise = null;
    });
    return this.scanPromise;
  }

  private async scanOnce(
    categories: ProjectCategory[],
    archiveFolder: string,
    scanKey: string,
    generation: number,
  ): Promise<HomepageProject[]> {

    const projects: HomepageProject[] = [];
    const scannedPaths = new Set<string>();
    const nextCache = new Map<string, HomepageProject>();

    const discovery = await new ProjectRegistry(this.app).discover();
    for (const entry of discovery.projects) {
      if (entry.state === "duplicate" || entry.state === "nested" || entry.state === "root") continue;
      const folder = this.app.vault.getAbstractFileByPath(entry.folderPath);
      if (!(folder instanceof TFolder)) continue;
      if (folder.path.split("/").includes(archiveFolder)) continue;
      const category = categories.find(category => folder.path.startsWith(getProjectCategoryFolder(category) + "/"));
      const project = await this.scanProject(folder, category?.name || "未分类");
      if (!project) continue;
      scannedPaths.add(folder.path);
      projects.push(project);
      nextCache.set(folder.path, project);
    }

    // Do not let an older scan overwrite a cache that a newer vault event has
    // invalidated. The caller will immediately repeat with the new generation.
    if (generation !== this.dirtyGeneration) return projects.sort((a, b) => b.updatedAt - a.updatedAt);

    this.cache = nextCache;
    for (const cachedPath of this.cache.keys()) {
      if (!scannedPaths.has(cachedPath)) this.cache.delete(cachedPath);
    }
    this.lastScanTime = Date.now();
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
    if (!homeData) return null;
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

    const updatedAt = Math.max(recentFiles[0]?.mtime || 0, homeData?.updatedAt ? new Date(homeData.updatedAt).getTime() || 0 : 0);

    return {
      id: homeData?.projectId || folderPath,
      name,
      icon: homeData?.icon || "lucide-folder",
      folderPath,
      type: homeData?.type || type,
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
          if (child.extension === "home" || isDeliverablePath(this.app, folder.path, child.path)) continue;
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
