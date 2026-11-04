/**
 * Homepage 类型定义
 *
 * 包含已有 Service 依赖的类型 + 主页新增业务类型
 */

import type {
  ProjectStatus,
  ProjectStatusHistoryEntry,
  ResumableProjectStatus,
} from "./project-status";

// ============================================================
// 已有 Service 依赖的类型（从各文件用法推断）
// ============================================================

/** 书签条目 */
export interface HomepageBookmarkEntry {
  title: string;
  path?: string;
  url?: string;
  type: "file" | "folder" | "url";
  level: number;
}

// ============================================================
// 主页新增业务类型
// ============================================================

/** 用户可在设置中自由定义的项目类型标签。 */
export type ProjectType = string;

/** 项目内最近文件 */
export interface ProjectRecentFile {
  name: string;
  path: string;
  mtime: number;
}

/** 项目待办任务 */
export interface ProjectTask {
  text: string;
  completed: boolean;
  created?: string;
  due?: string;
  dueTime?: string;
  priority?: TaskPriority;
  line: number;
}

/** 扫描得到的项目条目 */
export interface HomepageProject {
  id: string;
  name: string;
  icon: string;
  folderPath: string;
  type: ProjectType;
  progress: number;
  taskTotal: number;
  taskDone: number;
  description: string;
  recentFiles: ProjectRecentFile[];
  pendingTasks: ProjectTask[];
  updatedAt: number;
  status: ProjectStatus;
  priority?: "high" | "medium" | "low";
  lastActiveTime?: number;
  createdTime?: number;
}

/** 快捷便签 */
export interface HomepageQuickNote {
  id: string;
  label: string;
  path: string;
  color: string;
  content?: string;
}

/** 每日格言 */
export interface HomepageQuote {
  text: string;
  author: string;
}

/** 天气数据 */
export interface HomepageWeatherData {
  temperature: number;
  weatherCode: number;
  description: string;
  icon: string;
  iconSvg: string;
  iconBgLight: string;
  iconBgDark: string;
  iconColorLight: string;
  iconColorDark: string;
  location: string;
  updatedAt: number;
}

/** 最近笔记摘要 */
export interface RecentNoteItem {
  title: string;
  path: string;
  mtime: number;
  tags: string[];
  preview: string;
}

/** 月度统计 */
export interface MonthlyStats {
  noteCount: number;
  editCount: number;
  taskCompleted: number;
  newTags: number;
  activeDays: number;
  consecutiveDays: number;
}

/** 今日活跃度 */
export interface TodayActivity {
  created: number;
  edited: number;
}

/** 热力图数据点 */
export interface HeatmapDay {
  date: string;
  count: number;
}

// ============================================================
// 项目控制台（.home 文件）类型
// ============================================================

/** .home 文件数据结构 */
export interface ProjectConsoleData {
  businessEvents?: import("./services/project-events").ProjectBusinessEvent[];
  activity?: Array<{ id: string; kind: "task-created" | "task-updated" | "task-completed" | "task-reopened" | "task-deleted" | "task-restored"; taskId: string; text: string; timestamp: string }>;
  schemaVersion?: number;
  projectId?: string;
  name: string;
  icon: string;
  description: string;
  type: ProjectType;
  createdAt: string;          // YYYY-MM-DD
  updatedAt?: string;
  status?: ProjectStatus | "active" | "archived";
  statusBeforePause?: ResumableProjectStatus | "active" | "archived";
  statusHistory?: ProjectStatusHistoryEntry[];
  metadata?: {
    priority?: "urgent" | "high" | "medium" | "low";
    tags?: string[];
    collaborators?: string[];
    dependencies?: string[];
    deadline?: string;
  };
  tasks: ProjectConsoleTask[];
  milestones?: Array<{ id: string; title: string; deadline: string; completed: boolean; deliverables: string[]; createdAt: string }>;
  deliverables: ProjectConsoleDeliverable[];
  overview?: {
    markdown: string;
    migratedAt?: string;
  };
  timeline?: {
    milestones: ProjectConsoleMilestone[];
    legacyMarkdown?: string;
    migratedAt?: string;
  };
}

/** 任务优先级 */
export type TaskPriority = "P0" | "P1" | "P2" | "P3";

/** 任务优先级标签 */
export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  "P0": "紧急",
  "P1": "重要",
  "P2": "普通",
  "P3": "低优",
};

/** 控制台任务 */
export interface ProjectConsoleTask {
  linkedFile?: string;
  id?: string;
  text: string;
  completed: boolean;
  created?: string;           // YYYY-MM-DD
  due?: string;               // YYYY-MM-DD
  dueTime?: string;           // HH:mm
  priority?: TaskPriority;    // 优先级
  tags?: string[];            // 标签
  subtasks?: ProjectConsoleSubtask[]; // 子任务
  progress?: number;          // 进度 0-100（用于多步骤任务）
  completedAt?: string;       // ISO 时间
  updatedAt?: string;         // ISO 时间
}

export interface ProjectConsoleMilestone {
  id: string;
  name: string;
  date: string;
  progress: number;
  completed: boolean;
}

/** 子任务 */
export interface ProjectConsoleSubtask {
  text: string;
  completed: boolean;
}

/** 控制台交付物 */
export interface ProjectConsoleDeliverable {
  name: string;
  path: string;               // 相对于项目根目录
  id?: string;
  format?: "zip";
  description?: string;
  createdAt?: string;
  fileCount?: number;
  status?: "pending" | "in-progress" | "done";
}

/**
 * 主页持久化数据（homepage-data.json）
 *
 * 存储路径：<Vault.configDir>/plugins/zendian/homepage-data.json
 * 注：项目数据来自 vault 文件夹扫描，不在此存储
 */
export interface HomepageData {
  quickNotes: HomepageQuickNote[];
  quotes: HomepageQuote[];
}
