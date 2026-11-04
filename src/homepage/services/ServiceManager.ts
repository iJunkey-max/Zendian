/**
 * ServiceManager — 数据服务统一管理器
 *
 * 功能：
 * - 统一管理所有数据服务
 * - 协调服务之间的交互
 * - 提供便捷的 API 接口
 * - 生命周期管理
 */

import { App, Notice, type EventRef } from "obsidian";
import { ProjectDataService } from "./ProjectDataService";
import { TimelineService } from "./TimelineService";
import { StatisticsService } from "./StatisticsService";
import { FileWatcher } from "./FileWatcher";
import { ProjectSnapshotService } from "./ProjectSnapshotService";
import { ProjectRegistry } from "./ProjectRegistry";
import type { DataChangeCallback, DataChangeEvent } from "./types";
import type { TaskSyncService } from "../../services/TaskSyncService";

function rebasePath(path: string, oldBase: string, newBase: string): string {
  if (path === oldBase) return newBase;
  return path.startsWith(`${oldBase}/`) ? `${newBase}${path.slice(oldBase.length)}` : path;
}

export class ServiceManager {
  public projectData: ProjectDataService;
  public timeline: TimelineService;
  public statistics: StatisticsService;
  public fileWatcher: FileWatcher;
  public snapshots: ProjectSnapshotService;

  private initialized = false;
  private destroyed = false;
  private fileWatcherRef: EventRef | null = null;
  private workspaceEventRefs: EventRef[] = [];
  private snapshotCallbacks = new Map<string, DataChangeCallback>();
  private snapshotTrackingPromises = new Map<string, Promise<boolean>>();
  private blockedTrackingPaths = new Set<string>();
  private trackingGenerations = new Map<string, number>();
  private editSessions = new Map<string, { projectPath: string; filePath: string }>();
  private fileOpenTimes = new Map<string, number>();

  constructor(private app: App, private taskSyncService?: TaskSyncService) {
    this.projectData = new ProjectDataService(app, undefined, taskSyncService);
    this.snapshots = new ProjectSnapshotService(app);
    this.timeline = new TimelineService(app, taskSyncService, this.snapshots);
    this.statistics = new StatisticsService(app, taskSyncService, this.snapshots);
    this.fileWatcher = new FileWatcher(app);

    this.setupFileWatcher();
    this.setupWorkspaceListeners();
    void this.restoreSnapshotTracking().catch(error => {
      console.error("[ServiceManager] 历史跟踪初始化失败，原数据保留", error);
      if (!this.destroyed) new Notice("项目历史暂不可用，请检查历史索引和同步状态；其他项目资料未改动");
    });
  }

  /**
   * Entry points such as maintenance/import can create the singleton before
   * the plugin has passed its canonical TaskSyncService.  Upgrade every
   * dependent service in one step; otherwise those pages would retain a
   * permanently stale fallback data source for the lifetime of the plugin.
   */
  setTaskSyncService(taskSyncService: TaskSyncService): void {
    if (this.destroyed || this.taskSyncService === taskSyncService) return;
    this.taskSyncService = taskSyncService;
    this.projectData.setTaskSyncService(taskSyncService);
    this.timeline.setTaskSyncService(taskSyncService);
    this.statistics.setTaskSyncService(taskSyncService);
    this.clearAllCache();
  }

  // ============================================================
  // 初始化
  // ============================================================

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log("[ServiceManager] 初始化数据服务...");

    this.initialized = true;
    console.log("[ServiceManager] 数据服务初始化完成");
  }

  // ============================================================
  // 文件监听设置
  // ============================================================

  /**
   * 设置文件变更监听
   */
  private setupFileWatcher(): void {
    this.fileWatcherRef = this.fileWatcher.onChange((event: DataChangeEvent) => {
      this.handleDataChange(event);
    });
  }

  private setupWorkspaceListeners(): void {
    const workspace = this.app.workspace as any;
    if (typeof workspace.on !== "function") return;
    this.workspaceEventRefs.push(workspace.on("zendian:project-changed", (projectPath: string) => {
      this.clearProjectCache(projectPath);
    }));
    this.workspaceEventRefs.push(workspace.on("file-open", (file: any) => {
      if (file?.path) this.fileOpenTimes.set(file.path, Date.now());
    }));
    this.workspaceEventRefs.push(workspace.on("layout-change", () => {
      void this.flushClosedEditSessions().catch(error => console.error("[ServiceManager] 结束编辑会话失败", error));
    }));
  }

  private async restoreSnapshotTracking(): Promise<void> {
    try {
      const discovery = await new ProjectRegistry(this.app).discover();
      // Historical paths are durable recovery data, not proof that the
      // current folder is still a unique, manageable project. Do not start a
      // watcher for a duplicate/nested/stale path during startup: that would
      // let a parent or copied project absorb child-file changes before the
      // identity reconciler has had a chance to report the conflict.
      const readyPaths = new Set(
        discovery.projects
          .filter((project) => project.state === "ready")
          .map((project) => project.folderPath),
      );
      // Track every current ready project, including a project that has never
      // opened its console. That first startup observation becomes its
      // baseline; otherwise a newly created project could accumulate only a
      // file-inventory record until a user happened to open the detail page.
      const projectPaths = Array.from(readyPaths);
      if (this.destroyed) return;
      await Promise.all(projectPaths.map((projectPath) => this.trackProjectSnapshots(projectPath)));
    } catch (error) {
      console.error("[ServiceManager] 恢复项目快照监听失败", error);
      throw error;
    }
  }

  async trackProjectSnapshots(projectPath: string): Promise<void> {
    if (this.destroyed) return;
    const discovery = await new ProjectRegistry(this.app).discover();
    const entry = discovery.projects.find(project => project.folderPath === projectPath);
    if (!entry || !["ready", "legacy"].includes(entry.state)) {
      this.blockedTrackingPaths.add(projectPath);
      return;
    }
    this.blockedTrackingPaths.delete(projectPath);
    const existing = this.snapshotTrackingPromises.get(projectPath);
    if (existing) {
      await existing;
      return;
    }
    const generation = (this.trackingGenerations.get(projectPath) ?? 0) + 1;
    this.trackingGenerations.set(projectPath, generation);

    const tracking = (async (): Promise<boolean> => {
      const callback: DataChangeCallback = async (event) => {
        if (this.destroyed) return;
        const eventProjectPath = typeof event.data?.projectPath === "string"
          ? event.data.projectPath
          : projectPath;
        let sessionId: string | undefined;
        let transientSession = false;
        if (event.action === "update" && event.path) {
          sessionId = await this.snapshots.beginEditSession(
            eventProjectPath,
            event.path,
            this.fileOpenTimes.get(event.path) || event.timestamp,
          );
          if (this.destroyed) return;
          this.editSessions.set(sessionId, { projectPath: eventProjectPath, filePath: event.path });
          transientSession = !this.isFileOpen(event.path);
        }
        await this.snapshots.captureEvent(event, sessionId);
        if (transientSession && sessionId) {
          await this.snapshots.completeEditSession(sessionId, event.timestamp);
          this.editSessions.delete(sessionId);
        }
        this.clearProjectCache(eventProjectPath);
      };
      this.snapshotCallbacks.set(projectPath, callback);
      const initialized = await this.snapshots.initializeProject(projectPath);
      if (!initialized || this.destroyed || this.blockedTrackingPaths.has(projectPath) || this.trackingGenerations.get(projectPath) !== generation) {
        this.snapshotCallbacks.delete(projectPath);
        return false;
      }
      this.fileWatcher.watchProject(projectPath, callback);
      if (this.blockedTrackingPaths.has(projectPath) || this.trackingGenerations.get(projectPath) !== generation) {
        this.fileWatcher.unwatchProject(projectPath, callback);
        this.snapshotCallbacks.delete(projectPath);
        return false;
      }
      return true;
    })();
    this.snapshotTrackingPromises.set(projectPath, tracking);
    try {
      const initialized = await tracking;
      if (!initialized && this.snapshotTrackingPromises.get(projectPath) === tracking) {
        this.snapshotTrackingPromises.delete(projectPath);
      }
    } catch (error) {
      const callback = this.snapshotCallbacks.get(projectPath);
      if (callback) this.fileWatcher.unwatchProject(projectPath, callback);
      this.snapshotCallbacks.delete(projectPath);
      this.snapshotTrackingPromises.delete(projectPath);
      throw error;
    }
  }

  /** Stop every runtime callback for a project that is no longer manageable. */
  untrackProjectSnapshots(projectPath: string): void {
    this.trackingGenerations.set(projectPath, (this.trackingGenerations.get(projectPath) ?? 0) + 1);
    this.blockedTrackingPaths.add(projectPath);
    this.fileWatcher.unwatchProject(projectPath);
    this.snapshotCallbacks.delete(projectPath);
    this.snapshotTrackingPromises.delete(projectPath);
    for (const [sessionId, session] of this.editSessions) {
      if (session.projectPath !== projectPath) continue;
      this.editSessions.delete(sessionId);
      this.fileOpenTimes.delete(session.filePath);
    }
  }

  private isFileOpen(filePath: string): boolean {
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    return leaves.some((leaf) => (leaf.view as any)?.file?.path === filePath);
  }

  private async flushClosedEditSessions(): Promise<void> {
    const sessions = Array.from(this.editSessions.entries());
    for (const [sessionId, session] of sessions) {
      if (this.isFileOpen(session.filePath)) continue;
      try {
        await this.snapshots.completeEditSession(sessionId, Date.now());
        this.editSessions.delete(sessionId);
        this.fileOpenTimes.delete(session.filePath);
        this.clearProjectCache(session.projectPath);
      } catch (error) {
        console.error(`[ServiceManager] 收尾编辑会话失败: ${session.filePath}`, error);
      }
    }
  }

  /**
   * 处理数据变更事件
   */
  private handleDataChange(event: DataChangeEvent): void {
    console.log("[ServiceManager] 数据变更:", event);

    // 根据变更类型，清除相关缓存
    const projectPath = typeof event.data?.projectPath === "string"
      ? event.data.projectPath
      : this.extractProjectPath(event.path);

    if (!projectPath) {
      return;
    }

    switch (event.type) {
      case "project":
        // 项目数据变更，清除所有相关缓存
        this.clearProjectCache(projectPath);
        break;

      case "task":
        // 任务变更，清除任务和统计缓存
        this.clearProjectCache(projectPath);
        break;

      case "deliverable":
        // 交付物变更，清除相关缓存
        this.clearProjectCache(projectPath);
        break;

      case "file":
        // 文件变更，清除时间轴和统计缓存
        this.clearProjectCache(projectPath);
        break;

      case "timeline":
        // 时间轴变更
        this.clearProjectCache(projectPath);
        break;
    }
  }

  /**
   * 从文件路径提取项目路径
   */
  private extractProjectPath(filePath: string): string | null {
    // 假设项目路径格式为: Projects/项目名/.home
    const parts = filePath.split("/");
    const homeIndex = parts.indexOf(".home");

    if (homeIndex > 0) {
      return parts.slice(0, homeIndex).join("/");
    }

    // 如果不是 .home 文件，尝试查找父目录
    if (parts.length >= 2) {
      return parts.slice(0, -1).join("/");
    }

    return null;
  }

  // ============================================================
  // 快捷方法
  // ============================================================

  /**
   * 获取项目完整数据（一次性获取所有数据）
   */
  async getProjectFullData(projectPath: string) {
    const [metadata, stats, health, timeline, taskStats, deliverableStats] = await Promise.all([
      this.projectData.getProjectMetadata(projectPath),
      this.projectData.getProjectStatistics(projectPath),
      this.projectData.getProjectHealth(projectPath),
      this.timeline.getProjectTimeline(projectPath),
      this.statistics.getTaskStatistics(projectPath),
      this.statistics.getDeliverableStatistics(projectPath),
    ]);

    return {
      metadata,
      stats,
      health,
      timeline,
      taskStats,
      deliverableStats,
    };
  }

  /**
   * 获取项目仪表盘数据
   */
  async getProjectDashboardData(projectPath: string) {
    const [stats, health, recentEvents, taskStats] = await Promise.all([
      this.projectData.getProjectStatistics(projectPath),
      this.projectData.getProjectHealth(projectPath),
      this.timeline.getRecentEvents(projectPath, 10),
      this.statistics.getTaskStatistics(projectPath),
    ]);

    return {
      stats,
      health,
      recentEvents,
      taskStats,
    };
  }

  /**
   * 获取项目分析数据
   */
  async getProjectAnalytics(projectPath: string) {
    const [activityTrend, fileTypeDistribution, weeklyReport, monthlyReport] = await Promise.all([
      this.statistics.getActivityTrend(projectPath, 30),
      this.statistics.getFileTypeDistribution(projectPath),
      this.statistics.getWeeklyReport(projectPath),
      this.statistics.getMonthlyReport(projectPath),
    ]);

    return {
      activityTrend,
      fileTypeDistribution,
      weeklyReport,
      monthlyReport,
    };
  }

  // ============================================================
  // 缓存管理
  // ============================================================

  /**
   * 清除项目所有缓存
   */
  clearProjectCache(projectPath: string): void {
    this.projectData.clearProjectCache(projectPath);
    this.timeline.clearCache(projectPath);
    this.statistics.clearProjectCache(projectPath);
    console.log(`[ServiceManager] 已清除项目缓存: ${projectPath}`);
  }

  async rebaseProjectPath(oldProjectPath: string, newProjectPath: string): Promise<() => Promise<void>> {
    if (!oldProjectPath || !newProjectPath || oldProjectPath === newProjectPath) return async () => undefined;

    const previousSnapshotCallbacks = new Map(this.snapshotCallbacks);
    const previousTrackingPromises = new Map(this.snapshotTrackingPromises);
    const previousEditSessions = new Map(Array.from(this.editSessions.entries(), ([key, session]) => [key, { ...session }]));
    const previousOpenTimes = new Map(this.fileOpenTimes);

    // History is the durable source of path ownership. Commit that move first;
    // if it detects an occupied target or an external index change, the
    // in-memory watcher/cache/session state must remain on the old path so a
    // later reconciliation can retry without a half-rebased runtime.
    const rollbackHistory = await this.snapshots.rebaseProjectPath(oldProjectPath, newProjectPath);
    let watcherRebased = false;
    let dataRebased = false;

    const restoreRuntime = (): void => {
      if (watcherRebased) this.fileWatcher.rebaseProjectPath(newProjectPath, oldProjectPath);
      if (dataRebased) this.projectData.rebaseProjectPath(newProjectPath, oldProjectPath);
      this.timeline.clearCache(oldProjectPath);
      this.timeline.clearCache(newProjectPath);
      this.statistics.clearProjectCache(oldProjectPath);
      this.statistics.clearProjectCache(newProjectPath);
      this.snapshotCallbacks = new Map(previousSnapshotCallbacks);
      this.snapshotTrackingPromises = new Map(previousTrackingPromises);
      this.editSessions = new Map(Array.from(previousEditSessions.entries(), ([key, session]) => [key, { ...session }]));
      this.fileOpenTimes = new Map(previousOpenTimes);
    };

    try {
      this.fileWatcher.rebaseProjectPath(oldProjectPath, newProjectPath);
      watcherRebased = true;
      this.projectData.rebaseProjectPath(oldProjectPath, newProjectPath);
      dataRebased = true;
      this.timeline.clearCache(oldProjectPath);
      this.timeline.clearCache(newProjectPath);
      this.statistics.clearProjectCache(oldProjectPath);
      this.statistics.clearProjectCache(newProjectPath);

      const snapshotCallback = this.snapshotCallbacks.get(oldProjectPath);
      const existingNewCallback = this.snapshotCallbacks.get(newProjectPath);
      if (snapshotCallback) {
        if (existingNewCallback && existingNewCallback !== snapshotCallback) {
          this.fileWatcher.unwatchProject(newProjectPath, snapshotCallback);
        } else {
          this.snapshotCallbacks.set(newProjectPath, snapshotCallback);
        }
        this.snapshotCallbacks.delete(oldProjectPath);
      }
      const trackingPromise = this.snapshotTrackingPromises.get(oldProjectPath);
      if (trackingPromise) {
        if (!this.snapshotTrackingPromises.has(newProjectPath)) {
          this.snapshotTrackingPromises.set(newProjectPath, trackingPromise);
        }
        this.snapshotTrackingPromises.delete(oldProjectPath);
      }

      for (const session of this.editSessions.values()) {
        if (session.projectPath !== oldProjectPath) continue;
        session.projectPath = newProjectPath;
        session.filePath = rebasePath(session.filePath, oldProjectPath, newProjectPath);
      }

      const openTimes = Array.from(this.fileOpenTimes.entries());
      for (const [filePath, openedAt] of openTimes) {
        const rebased = rebasePath(filePath, oldProjectPath, newProjectPath);
        if (rebased === filePath) continue;
        this.fileOpenTimes.delete(filePath);
        this.fileOpenTimes.set(rebased, openedAt);
      }
    } catch (error) {
      let rollbackError: unknown = null;
      try { await rollbackHistory(); } catch (caught) { rollbackError = caught; }
      // Runtime bookkeeping must be restored even when durable history rollback
      // itself is blocked by an external write. Otherwise the watcher/cache
      // layer would continue to advertise the new path after a failed move.
      restoreRuntime();
      if (rollbackError) throw new Error(`${String(error)}；运行时回滚失败：${String(rollbackError)}`);
      throw error;
    }

    let rolledBack = false;
    return async () => {
      if (rolledBack) return;
      rolledBack = true;
      await rollbackHistory();
      restoreRuntime();
    };
  }

  async rebaseFilePath(projectPath: string, oldFilePath: string, newFilePath: string): Promise<() => Promise<void>> {
    if (!projectPath || !oldFilePath || !newFilePath || oldFilePath === newFilePath) return async () => undefined;

    // As with project moves, do not mutate runtime bookkeeping until the
    // durable history move has passed all conflict and persistence checks.
    const rollbackHistory = await this.snapshots.rebaseFilePath(projectPath, oldFilePath, newFilePath);

    this.fileWatcher.rebaseFilePath(oldFilePath, newFilePath);
    this.timeline.clearCache(projectPath);
    this.projectData.clearProjectCache(projectPath);
    this.statistics.clearProjectCache(projectPath);

    for (const session of this.editSessions.values()) {
      if (session.projectPath === projectPath && session.filePath === oldFilePath) session.filePath = newFilePath;
    }
    const openedAt = this.fileOpenTimes.get(oldFilePath);
    if (openedAt !== undefined) {
      this.fileOpenTimes.delete(oldFilePath);
      this.fileOpenTimes.set(newFilePath, openedAt);
    }
    let rolledBack = false;
    return async () => {
      if (rolledBack) return;
      rolledBack = true;
      await rollbackHistory();
      this.fileWatcher.rebaseFilePath(newFilePath, oldFilePath);
      this.timeline.clearCache(newFilePath);
      this.projectData.clearProjectCache(projectPath);
      this.statistics.clearProjectCache(projectPath);
      for (const session of this.editSessions.values()) {
        if (session.projectPath === projectPath && session.filePath === newFilePath) session.filePath = oldFilePath;
      }
      const currentOpenedAt = this.fileOpenTimes.get(newFilePath);
      if (currentOpenedAt !== undefined) {
        this.fileOpenTimes.delete(newFilePath);
        this.fileOpenTimes.set(oldFilePath, currentOpenedAt);
      }
    };
  }

  /**
   * 清除所有缓存
   */
  clearAllCache(): void {
    this.projectData.clearAllCache();
    this.timeline.clearAllCache();
    this.statistics.clearAllCache();
    console.log("[ServiceManager] 已清除所有缓存");
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    return {
      projectData: this.projectData.getCacheStats(),
    };
  }

  // ============================================================
  // 销毁
  // ============================================================

  /**
   * 销毁服务管理器
   */
  async destroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const ref of this.workspaceEventRefs) this.app.workspace.offref(ref);
    this.workspaceEventRefs = [];
    if (this.fileWatcherRef) {
      this.fileWatcher.offref(this.fileWatcherRef);
      this.fileWatcherRef = null;
    }
    this.fileWatcher.destroy();
    this.snapshotCallbacks.clear();
    this.snapshotTrackingPromises.clear();
    this.blockedTrackingPaths.clear();
    this.trackingGenerations.clear();

    const sessions = Array.from(this.editSessions.entries());
    this.editSessions.clear();
    for (const [sessionId, session] of sessions) {
      try {
        await this.snapshots.completeEditSession(sessionId, Date.now());
      } catch (error) {
        console.error(`[ServiceManager] 收尾编辑会话失败: ${session.filePath}`, error);
      }
    }
    this.fileOpenTimes.clear();
    this.clearAllCache();
    this.initialized = false;
    console.log("[ServiceManager] 已销毁");
  }
}

// ============================================================
// 按 App / Vault 隔离的单例
// ============================================================

/**
 * Obsidian 可以同时打开多个 Vault 窗口。服务持有 vault、workspace、缓存
 * 和文件监听器，不能跨 App 复用；否则第二个 Vault 会读到第一个 Vault 的
 * 项目统计或把文件事件写进错误的历史索引。
 */
const serviceManagers = new WeakMap<object, ServiceManager>();
const liveServiceManagers = new Set<ServiceManager>();

/**
 * 获取全局服务管理器实例
 */
export function getServiceManager(app: App, taskSyncService?: TaskSyncService): ServiceManager {
  const key = app as unknown as object;
  let manager = serviceManagers.get(key);
  if (!manager) {
    manager = new ServiceManager(app, taskSyncService);
    serviceManagers.set(key, manager);
    liveServiceManagers.add(manager);
  } else if (taskSyncService) {
    manager.setTaskSyncService(taskSyncService);
  }
  return manager;
}

/**
 * 销毁指定 App 的服务管理器；无参数时清理历史 API 语义下的全部实例。
 */
export async function destroyServiceManager(app?: App): Promise<void> {
  if (app) {
    const key = app as unknown as object;
    const manager = serviceManagers.get(key);
    serviceManagers.delete(key);
    if (!manager) return;
    liveServiceManagers.delete(manager);
    await manager.destroy();
    return;
  }

  const managers = Array.from(liveServiceManagers);
  liveServiceManagers.clear();
  await Promise.all(managers.map(async (manager) => {
    await manager.destroy();
  }));
}
