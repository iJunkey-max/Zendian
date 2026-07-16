/**
 * Services — 数据服务层统一导出
 *
 * 使用示例：
 *
 * ```typescript
 * import { getServiceManager } from "./services";
 *
 * const services = getServiceManager(this.app);
 * await services.initialize();
 *
 * // 获取项目数据
 * const data = await services.projectData.getProjectConsoleData(projectPath);
 *
 * // 获取时间轴
 * const timeline = await services.timeline.getProjectTimeline(projectPath);
 *
 * // 获取统计数据
 * const stats = await services.statistics.getTaskStatistics(projectPath);
 *
 * // 监听文件变更
 * services.fileWatcher.watchProject(projectPath, (event) => {
 *   console.log("数据变更:", event);
 * });
 * ```
 */

// 服务类
export { ProjectDataService } from "./ProjectDataService";
export { TimelineService } from "./TimelineService";
export { StatisticsService } from "./StatisticsService";
export { FileWatcher } from "./FileWatcher";
export { ProjectSnapshotService } from "./ProjectSnapshotService";
export type {
  SnapshotVersion,
  ProjectCheckpoint,
  SnapshotComparison,
  CheckpointRestoreResult,
} from "./ProjectSnapshotService";
export { CacheManager } from "./CacheManager";
export { ServiceManager, getServiceManager, destroyServiceManager } from "./ServiceManager";

// 类型定义
export type {
  CacheEntry,
  CacheOptions,
  ProjectMetadata,
  ProjectStatistics,
  ProjectHealth,
  TimelineEvent,
  TimelineData,
  FileActivity,
  ActivityStats,
  TaskData,
  TaskStatistics,
  DeliverableData,
  DeliverableStatistics,
  ServiceConfig,
  DataChangeEvent,
  DataChangeCallback,
} from "./types";

// 导出服务
export { ExportService } from "./ExportService";
export type { ExportFormat, ExportOptions } from "./ExportService";
