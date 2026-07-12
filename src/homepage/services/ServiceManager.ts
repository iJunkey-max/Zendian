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
import type { DataChangeEvent } from "./types";
import type { TaskSyncService } from "../../services/TaskSyncService";

export class ServiceManager {
  public projectData: ProjectDataService;
  public timeline: TimelineService;
  public statistics: StatisticsService;
  public fileWatcher: FileWatcher;

  private initialized = false;
  private fileWatcherRef: EventRef | null = null;

  constructor(private app: App, taskSyncService?: TaskSyncService) {
    this.projectData = new ProjectDataService(app, undefined, taskSyncService);
    this.timeline = new TimelineService(app, taskSyncService);
    this.statistics = new StatisticsService(app);
    this.fileWatcher = new FileWatcher(app);

    this.setupFileWatcher();
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

    // 预加载常用数据（可选）
    // await this.preloadCommonData();

    this.initialized = true;
    console.log("[ServiceManager] 数据服务初始化完成");
  }

  /**
   * 预加载常用数据
   */
  private async preloadCommonData(): Promise<void> {
    // 可以在这里预加载一些常用的项目数据
    // 例如：最近访问的项目、收藏的项目等
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
  destroy(): void {
    if (this.fileWatcherRef) {
      this.fileWatcher.offref(this.fileWatcherRef);
      this.fileWatcherRef = null;
    }
    this.fileWatcher.destroy();
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
export function destroyServiceManager(): void {
  if (globalServiceManager) {
    globalServiceManager.destroy();
    globalServiceManager = null;
  }
}
