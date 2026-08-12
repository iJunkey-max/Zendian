/**
 * ProjectDataService — 项目数据统一管理服务
 *
 * 功能：
 * - 统一的数据读写接口
 * - 智能缓存管理
 * - 数据验证和转换
 * - 批量数据预加载
 */

import { App, TFile, TFolder } from "obsidian";
import { CacheManager } from "./CacheManager";
import { findProjectHomeFile, PROJECT_HOME_FILENAME } from "./ProjectHomeFileResolver";
import { loadProjectHome, mutateProjectHome, saveProjectHome } from "./ProjectHomeStore";
import type {
  ProjectMetadata,
  ProjectStatistics,
  ProjectHealth,
  TaskData,
  DeliverableData,
  FileActivity,
  ServiceConfig,
} from "./types";
import type { ProjectConsoleData, ProjectConsoleTask, ProjectConsoleDeliverable } from "../types";
import type { TaskSyncService } from "../../services/TaskSyncService";
import { normalizeProjectStatus, normalizeStatusBeforePause } from "../project-status";
import {
  isDeliverablePath,
  rebaseDeliverableProjectPath,
  registerDeliverablePaths,
} from "./DeliverablePathRegistry";
import { formatDate } from "../../utils/date";

export class ProjectDataService {
  private cache: CacheManager;
  private config: ServiceConfig;
  private deliverableFolders = new Map<string, Set<string>>();

  constructor(
    private app: App,
    config?: Partial<ServiceConfig>,
    private taskSyncService?: TaskSyncService,
  ) {
    this.config = {
      enableCache: true,
      cacheTTL: 5 * 60 * 1000, // 5 分钟
      enableFileWatcher: true,
      debounceDelay: 200,
      maxCacheSize: 100,
      ...config,
    };

    this.cache = new CacheManager(this.config.maxCacheSize, this.config.cacheTTL);
  }

  // ============================================================
  // 项目元数据
  // ============================================================

  /**
   * 读取项目控制台数据
   */
  async getProjectConsoleData(projectPath: string): Promise<ProjectConsoleData | null> {
    const cacheKey = `console:${projectPath}`;

    // 尝试从缓存获取
    if (this.config.enableCache) {
      const cached = this.cache.get<ProjectConsoleData>(cacheKey);
      if (cached) return cached;
    }

    // 从文件读取
    try {
      const record = await loadProjectHome(this.app, projectPath);
      if (!record) return null;
      const { file, data } = record;

      // 数据验证和规范化
      const normalized = this.normalizeConsoleData(data);
      registerDeliverablePaths(projectPath, normalized.deliverables);
      this.rememberDeliverableFolders(projectPath, normalized.deliverables);

      // 缓存结果
      if (this.config.enableCache) {
        this.cache.set(cacheKey, normalized, { key: String(file.stat.mtime) });
      }

      return normalized;
    } catch (error) {
      console.error(`[ProjectDataService] 读取项目数据失败: ${projectPath}`, error);
      return null;
    }
  }

  /**
   * 保存项目控制台数据
   */
  async saveProjectConsoleData(projectPath: string, data: ProjectConsoleData): Promise<boolean> {
    try {
      const saved = await saveProjectHome(this.app, projectPath, data);
      if (!saved) return false;

      // 使缓存失效
      this.cache.invalidate(`console:${projectPath}`);
      this.cache.invalidatePattern(`stats:${projectPath}*`);
      this.cache.invalidatePattern(`health:${projectPath}*`);

      return true;
    } catch (error) {
      console.error(`[ProjectDataService] 保存项目数据失败: ${projectPath}`, error);
      return false;
    }
  }

  async mutateProjectConsoleData(
    projectPath: string,
    mutator: (data: ProjectConsoleData) => boolean | void | Promise<boolean | void>,
  ): Promise<boolean> {
    const saved = await mutateProjectHome(this.app, projectPath, mutator);
    if (saved) {
      this.cache.invalidate(`console:${projectPath}`);
      this.cache.invalidatePattern(`stats:${projectPath}*`);
      this.cache.invalidatePattern(`health:${projectPath}*`);
    }
    return saved;
  }

  /**
   * 获取项目元数据
   */
  async getProjectMetadata(projectPath: string): Promise<ProjectMetadata | null> {
    const data = await this.getProjectConsoleData(projectPath);
    if (!data) return null;

    return {
      name: data.name,
      icon: data.icon,
      type: data.type,
      description: data.description,
      createdAt: data.createdAt,
      path: findProjectHomeFile(this.app, projectPath)?.path || `${projectPath}/${PROJECT_HOME_FILENAME}`,
      folderPath: projectPath,
    };
  }

  // ============================================================
  // 项目统计
  // ============================================================

  /**
   * 获取项目统计数据
   */
  async getProjectStatistics(projectPath: string): Promise<ProjectStatistics> {
    const cacheKey = `stats:${projectPath}`;

    // 尝试从缓存获取
    if (this.config.enableCache) {
      const cached = this.cache.get<ProjectStatistics>(cacheKey);
      if (cached) return cached;
    }

    // 计算统计数据
    const folder = this.app.vault.getAbstractFileByPath(projectPath);
    if (!(folder instanceof TFolder)) {
      return this.getEmptyStatistics();
    }

    const consoleData = await this.getProjectConsoleData(projectPath);
    const timelineTasks = this.taskSyncService
      ? await this.taskSyncService.getTasks(projectPath)
      : null;
    const taskSource = timelineTasks ?? consoleData?.tasks ?? [];
    const files = this.getAllFiles(folder).filter((file) => !this.isDeliverableFile(projectPath, file.path));

    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const oneMonth = 30 * 24 * 60 * 60 * 1000;

    const stats: ProjectStatistics = {
      totalFiles: files.length,
      totalNotes: files.filter(f => f.extension === "md").length,
      totalTasks: taskSource.length,
      completedTasks: taskSource.filter(t => t.completed).length,
      totalDeliverables: consoleData?.deliverables.length || 0,
      completedDeliverables: consoleData?.deliverables.filter(d => d.format === "zip" || d.status === "done").length || 0,
      lastModified: Math.max(...files.map(f => f.stat.mtime), 0),
      createdDate: consoleData?.createdAt || "",
      daysActive: this.calculateDaysActive(consoleData?.createdAt || ""),
      filesThisWeek: files.filter(f => now - f.stat.mtime < oneWeek).length,
      filesThisMonth: files.filter(f => now - f.stat.mtime < oneMonth).length,
    };

    // 缓存结果
    if (this.config.enableCache) {
      this.cache.set(cacheKey, stats);
    }

    return stats;
  }

  /**
   * 获取项目健康度
   */
  async getProjectHealth(projectPath: string): Promise<ProjectHealth> {
    const cacheKey = `health:${projectPath}`;

    if (this.config.enableCache) {
      const cached = this.cache.get<ProjectHealth>(cacheKey);
      if (cached) return cached;
    }

    const stats = await this.getProjectStatistics(projectPath);

    // 计算任务完成率 (40%)
    const taskCompletionRate = stats.totalTasks > 0
      ? (stats.completedTasks / stats.totalTasks) * 100
      : 50;

    // 计算文件活跃度 (30%)
    const fileActivityRate = stats.totalFiles > 0
      ? (stats.filesThisMonth / stats.totalFiles) * 100
      : 0;

    // 计算更新频率 (20%)
    const daysSinceLastUpdate = (Date.now() - stats.lastModified) / (24 * 60 * 60 * 1000);
    const updateFrequency = Math.max(0, 100 - daysSinceLastUpdate * 10);

    // 计算最后活动天数 (10%)
    const lastActivityScore = Math.max(0, 100 - daysSinceLastUpdate * 5);

    // 综合评分
    const score = Math.round(
      taskCompletionRate * 0.4 +
      fileActivityRate * 0.3 +
      updateFrequency * 0.2 +
      lastActivityScore * 0.1
    );

    let status: ProjectHealth["status"];
    if (score >= 80) status = "excellent";
    else if (score >= 60) status = "good";
    else if (score >= 40) status = "fair";
    else status = "poor";

    const health: ProjectHealth = {
      score,
      taskCompletionRate,
      fileActivityRate,
      updateFrequency,
      lastActivityDays: daysSinceLastUpdate,
      status,
    };

    if (this.config.enableCache) {
      this.cache.set(cacheKey, health);
    }

    return health;
  }

  // ============================================================
  // 任务管理
  // ============================================================

  /**
   * 获取任务列表
   */
  async getTasks(projectPath: string): Promise<TaskData[]> {
    const data = await this.getProjectConsoleData(projectPath);
    if (!data) return [];

    return data.tasks.map((task, index) => this.normalizeTask(task, index));
  }

  /**
   * 添加任务
   */
  async addTask(projectPath: string, task: Partial<TaskData>): Promise<boolean> {
    const newTask: ProjectConsoleTask = {
      id: `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      text: task.text || "",
      completed: false,
      created: formatDate(new Date()),
      due: task.due,
      dueTime: task.dueTime,
      priority: task.priority,
      tags: task.tags,
      updatedAt: new Date().toISOString(),
    };

    return this.mutateProjectConsoleData(projectPath, (data) => {
      data.tasks.push(newTask);
    });
  }

  /**
   * 更新任务
   */
  async updateTask(projectPath: string, taskIndex: number, updates: Partial<TaskData>): Promise<boolean> {
    return this.mutateProjectConsoleData(projectPath, (data) => {
      const task = data.tasks[taskIndex];
      if (!task) return false;
      if (updates.text !== undefined) task.text = updates.text;
      if (updates.completed !== undefined) {
        task.completed = updates.completed;
        task.completedAt = updates.completed ? new Date().toISOString() : undefined;
      }
      if (updates.due !== undefined) task.due = updates.due;
      if (updates.dueTime !== undefined) task.dueTime = updates.dueTime;
      if (updates.priority !== undefined) task.priority = updates.priority;
      if (updates.tags !== undefined) task.tags = updates.tags;
      task.updatedAt = new Date().toISOString();
    });
  }

  /**
   * 删除任务
   */
  async deleteTask(projectPath: string, taskIndex: number): Promise<boolean> {
    return this.mutateProjectConsoleData(projectPath, (data) => {
      if (!data.tasks[taskIndex]) return false;
      data.tasks.splice(taskIndex, 1);
    });
  }

  // ============================================================
  // 交付物管理
  // ============================================================

  /**
   * 获取交付物列表
   */
  async getDeliverables(projectPath: string): Promise<DeliverableData[]> {
    const data = await this.getProjectConsoleData(projectPath);
    if (!data) return [];

    return data.deliverables.map((d, index) => this.normalizeDeliverable(d, index));
  }

  // ============================================================
  // 文件活动
  // ============================================================

  /**
   * 获取项目内所有文件
   */
  getProjectFiles(projectPath: string): FileActivity[] {
    const folder = this.app.vault.getAbstractFileByPath(projectPath);
    if (!(folder instanceof TFolder)) return [];

    const files = this.getAllFiles(folder).filter((file) => !this.isDeliverableFile(projectPath, file.path));

    return files
      .filter(f => f.extension !== "home") // 排除 .home 文件
      .map(f => ({
        path: f.path,
        name: f.basename,
        extension: f.extension,
        created: f.stat.ctime,
        modified: f.stat.mtime,
        size: f.stat.size,
        folder: f.parent?.path || "",
      }))
      .sort((a, b) => b.modified - a.modified);
  }

  /**
   * 获取最近修改的文件
   */
  getRecentFiles(projectPath: string, limit = 10): FileActivity[] {
    return this.getProjectFiles(projectPath).slice(0, limit);
  }

  // ============================================================
  // 批量操作
  // ============================================================

  /**
   * 预加载项目数据（批量）
   */
  async preloadProjects(projectPaths: string[]): Promise<void> {
    const promises = projectPaths.map(path =>
      this.getProjectConsoleData(path).catch(() => null)
    );
    await Promise.all(promises);
  }

  /**
   * 清除项目缓存
   */
  clearProjectCache(projectPath: string): void {
    this.cache.invalidatePattern(`*:${projectPath}*`);
  }

  rebaseProjectPath(oldProjectPath: string, newProjectPath: string): void {
    if (!oldProjectPath || !newProjectPath || oldProjectPath === newProjectPath) return;
    const deliverableFolders = this.deliverableFolders.get(oldProjectPath);
    if (deliverableFolders) {
      this.deliverableFolders.set(newProjectPath, new Set(deliverableFolders));
      this.deliverableFolders.delete(oldProjectPath);
    }
    rebaseDeliverableProjectPath(oldProjectPath, newProjectPath);
    this.clearProjectCache(oldProjectPath);
    this.clearProjectCache(newProjectPath);
  }

  /**
   * 清除所有缓存
   */
  clearAllCache(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  private normalizeConsoleData(data: ProjectConsoleData): ProjectConsoleData {
    return {
      ...data,
      name: data.name || "未命名项目",
      icon: data.icon || "folder",
      type: data.type || "未分类",
      description: data.description || "",
      createdAt: data.createdAt || formatDate(new Date()),
      status: normalizeProjectStatus(data.status),
      statusBeforePause: normalizeStatusBeforePause(data.statusBeforePause),
      statusHistory: Array.isArray(data.statusHistory)
        ? data.statusHistory.map((entry) => ({
            ...entry,
            from: normalizeProjectStatus(entry.from),
            to: normalizeProjectStatus(entry.to),
          }))
        : [],
      tasks: data.tasks || [],
      deliverables: data.deliverables || [],
      overview: data.overview || { markdown: "" },
      timeline: data.timeline || { milestones: [] },
    };
  }

  private normalizeTask(task: ProjectConsoleTask, index: number): TaskData {
    return {
      id: task.id || `task-${index}`,
      text: task.text,
      completed: task.completed,
      created: task.created || "",
      due: task.due,
      dueTime: task.dueTime,
      priority: task.priority,
      tags: task.tags || [],
    };
  }

  private normalizeDeliverable(d: ProjectConsoleDeliverable, index: number): DeliverableData {
    return {
      id: d.id || `deliverable-${index}`,
      name: d.name,
      path: d.path,
      status: d.status,
      format: d.format,
      fileCount: d.fileCount,
      createdAt: d.createdAt,
      created: d.createdAt || "",
      description: d.description || "",
    };
  }

  private getAllFiles(folder: TFolder): TFile[] {
    const files: TFile[] = [];
    const walk = (f: TFolder) => {
      for (const child of f.children) {
        if (child instanceof TFile) {
          files.push(child);
        } else if (child instanceof TFolder) {
          walk(child);
        }
      }
    };
    walk(folder);
    return files;
  }

  private rememberDeliverableFolders(projectPath: string, deliverables: ProjectConsoleDeliverable[]): void {
    const folders = new Set<string>();
    for (const deliverable of deliverables) {
      if (deliverable.format !== "zip") continue;
      const firstSegment = deliverable.path.split("/")[0]?.trim();
      if (firstSegment) folders.add(firstSegment);
    }
    this.deliverableFolders.set(projectPath, folders);
  }

  private isDeliverableFile(projectPath: string, filePath: string): boolean {
    if (isDeliverablePath(projectPath, filePath)) return true;
    const relativePath = filePath.startsWith(`${projectPath}/`) ? filePath.slice(projectPath.length + 1) : filePath;
    const firstSegment = relativePath.split("/")[0];
    return this.deliverableFolders.get(projectPath)?.has(firstSegment) ?? false;
  }

  private calculateDaysActive(createdAt: string): number {
    if (!createdAt) return 0;
    const created = new Date(createdAt).getTime();
    const now = Date.now();
    return Math.floor((now - created) / (24 * 60 * 60 * 1000));
  }

  private getEmptyStatistics(): ProjectStatistics {
    return {
      totalFiles: 0,
      totalNotes: 0,
      totalTasks: 0,
      completedTasks: 0,
      totalDeliverables: 0,
      completedDeliverables: 0,
      lastModified: 0,
      createdDate: "",
      daysActive: 0,
      filesThisWeek: 0,
      filesThisMonth: 0,
    };
  }
}
