/**
 * ServiceManager — 数据服务统一管理器
 *
 * 功能：
 * - 统一管理所有数据服务
 * - 协调服务之间的交互
 * - 提供便捷的 API 接口
 * - 生命周期管理
 */

import { App, type EventRef } from "obsidian";
import { ProjectDataService } from "./ProjectDataService";
import { TimelineService } from "./TimelineService";
import { StatisticsService } from "./StatisticsService";
import { FileWatcher } from "./FileWatcher";
import { ProjectSnapshotService } from "./ProjectSnapshotService";
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
  private fileWatcherRef: EventRef | null = null;
  private workspaceEventRefs: EventRef[] = [];
  private snapshotCallbacks = new Map<string, DataChangeCallback>();
  private snapshotTrackingPromises = new Map<string, Promise<void>>();
  private editSessions = new Map<string, { projectPath: string; filePath: string }>();
  private fileOpenTimes = new Map<string, number>();

  constructor(private app: App, taskSyncService?: TaskSyncService) {
    this.projectData = new ProjectDataService(app, undefined, taskSyncService);
    this.snapshots = new ProjectSnapshotService(app);
    this.timeline = new TimelineService(app, taskSyncService, this.snapshots);
    this.statistics = new StatisticsService(app);
    this.fileWatcher = new FileWatcher(app);

    this.setupFileWatcher();
    this.setupWorkspaceListeners();
    void this.restoreSnapshotTracking();
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
    this.workspaceEventRefs.push(workspace.on("file-open", (file: any) => {
      if (file?.path) this.fileOpenTimes.set(file.path, Date.now());
    }));
    this.workspaceEventRefs.push(workspace.on("layout-change", () => {
      void this.flushClosedEditSessions();
    }));
  }

  private async restoreSnapshotTracking(): Promise<void> {
    try {
      const projectPaths = await this.snapshots.getTrackedProjectPaths();
      await Promise.all(projectPaths.map((projectPath) => this.trackProjectSnapshots(projectPath)));
    } catch (error) {
      console.error("[ServiceManager] 恢复项目快照监听失败", error);
    }
  }

  async trackProjectSnapshots(projectPath: string): Promise<void> {
    if (!projectPath) return;
    const existing = this.snapshotTrackingPromises.get(projectPath);
    if (existing) return existing;

    const tracking = (async () => {
      const callback: DataChangeCallback = async (event) => {
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
      this.fileWatcher.watchProject(projectPath, callback);
      await this.snapshots.initializeProject(projectPath);
    })();
    this.snapshotTrackingPromises.set(projectPath, tracking);
    try {
      await tracking;
    } catch (error) {
      const callback = this.snapshotCallbacks.get(projectPath);
      if (callback) this.fileWatcher.unwatchProject(projectPath, callback);
      this.snapshotCallbacks.delete(projectPath);
      this.snapshotTrackingPromises.delete(projectPath);
      throw error;
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
        this.projectData.clearProjectCache(projectPath);
        break;

      case "deliverable":
        // 交付物变更，清除相关缓存
        this.projectData.clearProjectCache(projectPath);
        break;

      case "file":
        // 文件变更，清除时间轴和统计缓存
        this.timeline.clearCache(projectPath);
        break;

      case "timeline":
        // 时间轴变更
        this.timeline.clearCache(projectPath);
        this.projectData.clearProjectCache(projectPath);
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
    console.log(`[ServiceManager] 已清除项目缓存: ${projectPath}`);
  }

  async rebaseProjectPath(oldProjectPath: string, newProjectPath: string): Promise<void> {
    if (!oldProjectPath || !newProjectPath || oldProjectPath === newProjectPath) return;

    this.fileWatcher.rebaseProjectPath(oldProjectPath, newProjectPath);
    this.projectData.rebaseProjectPath(oldProjectPath, newProjectPath);
    this.timeline.clearCache(oldProjectPath);
    this.timeline.clearCache(newProjectPath);

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

    await this.snapshots.rebaseProjectPath(oldProjectPath, newProjectPath);
  }

  /**
   * 清除所有缓存
   */
  clearAllCache(): void {
    this.projectData.clearAllCache();
    this.timeline.clearAllCache();
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
    for (const ref of this.workspaceEventRefs) this.app.workspace.offref(ref);
    this.workspaceEventRefs = [];
    if (this.fileWatcherRef) {
      this.fileWatcher.offref(this.fileWatcherRef);
      this.fileWatcherRef = null;
    }
    this.fileWatcher.destroy();
    this.snapshotCallbacks.clear();
    this.snapshotTrackingPromises.clear();

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
// 全局单例
// ============================================================

let globalServiceManager: ServiceManager | null = null;

/**
 * 获取全局服务管理器实例
 */
export function getServiceManager(app: App, taskSyncService?: TaskSyncService): ServiceManager {
  if (!globalServiceManager) {
    globalServiceManager = new ServiceManager(app, taskSyncService);
  }
  return globalServiceManager;
}

/**
 * 销毁全局服务管理器
 */
export async function destroyServiceManager(): Promise<void> {
  const manager = globalServiceManager;
  globalServiceManager = null;
  if (manager) await manager.destroy();
}
