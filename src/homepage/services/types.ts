/**
 * 数据服务层类型定义
 */

// ============================================================
// 缓存类型
// ============================================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  key: string;
}

// ============================================================
// 项目数据类型
// ============================================================

export interface ProjectMetadata {
  name: string;
  icon: string;
  type: string;
  description?: string;
  createdAt: string;
  path: string;
  folderPath: string;
}

export interface ProjectStatistics {
  totalFiles: number;
  totalNotes: number;
  totalTasks: number;
  completedTasks: number;
  totalDeliverables: number;
  completedDeliverables: number;
  lastModified: number;
  createdDate: string;
  daysActive: number;
  filesThisWeek: number;
  filesThisMonth: number;
}

export interface ProjectHealth {
  score: number; // 0-100
  taskCompletionRate: number;
  fileActivityRate: number;
  updateFrequency: number;
  lastActivityDays: number;
  status: "excellent" | "good" | "fair" | "poor";
}

// ============================================================
// 时间轴类型
// ============================================================

export interface TimelineEvent {
  type: "file-created" | "file-modified" | "file-deleted" | "file-restored" | "task-created" | "task-completed" | "deliverable-added" | "milestone" | "status-changed" | "checkpoint";
  date: string;
  timestamp: number;
  title: string;
  description?: string;
  filePath?: string;
  snapshotId?: string;
  checkpointId?: string;
  editSessionId?: string;
  editSessionStartedAt?: number;
  editSessionEndedAt?: number;
  editSessionChangeCount?: number;
  approximateTime?: boolean;
  metadata?: Record<string, any>;
}

export interface TimelineData {
  events: TimelineEvent[];
  stats: {
    totalEvents: number;
    eventsThisWeek: number;
    eventsThisMonth: number;
    mostActiveDay: string;
  };
}

// ============================================================
// 文件活动类型
// ============================================================

export interface FileActivity {
  path: string;
  name: string;
  extension: string;
  created: number;
  modified: number;
  size: number;
  folder: string;
}

export interface ActivityStats {
  daily: Map<string, number>; // date -> count
  weekly: Map<string, number>; // week -> count
  monthly: Map<string, number>; // month -> count
  byType: Map<string, number>; // extension -> count
}

// ============================================================
// 任务数据类型
// ============================================================

export interface TaskData {
  id: string;
  text: string;
  completed: boolean;
  created: string;
  due?: string;
  dueTime?: string;
  priority?: "P0" | "P1" | "P2" | "P3";
  tags?: string[];
  subtasks?: TaskData[];
  progress?: number; // 0-100
}

export interface TaskStatistics {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  byPriority: Record<string, number>;
  completionRate: number;
}

// ============================================================
// 交付物类型
// ============================================================

export interface DeliverableData {
  id: string;
  name: string;
  path?: string;
  status?: "pending" | "in-progress" | "done" | "archived";
  format?: "zip";
  fileCount?: number;
  createdAt?: string;
  created: string;
  updated?: string;
  due?: string;
  description?: string;
  progress?: number;
  tags?: string[];
}

export interface DeliverableStatistics {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  completionRate: number;
}

// ============================================================
// 服务配置
// ============================================================

export interface ServiceConfig {
  enableCache: boolean;
  cacheTTL: number;
  enableFileWatcher: boolean;
  debounceDelay: number;
  maxCacheSize: number;
}

// ============================================================
// 数据变更事件
// ============================================================

export interface DataChangeEvent {
  type: "project" | "task" | "deliverable" | "file" | "timeline";
  action: "create" | "update" | "delete";
  path: string;
  timestamp: number;
  data?: any;
}

export type DataChangeCallback = (event: DataChangeEvent) => void | Promise<void>;
