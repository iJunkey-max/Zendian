/**
 * Homepage 类型定义
 *
 * 包含已有 Service 依赖的类型 + 主页新增业务类型
 */

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

/** 每日笔记设置 */
export interface HomepageDailyNoteSettings {
  enabled: boolean;
  folder: string;
  dateFormat: string;
  templatePath: string;
}

/** 每日笔记解析结果 */
export interface HomepageDailyNoteSummary {
  enabled: boolean;
  title: string;
  path: string;
  exists: boolean;
  dateLabel: string;
  folder: string;
  templatePath: string;
  source: string;
}

/** 任务项 */
export interface HomepageTaskItem {
  text: string;
  filePath: string;
  fileName: string;
  line: number;
  completed: boolean;
  mtime: number;
}

/** 任务扫描设置 */
export interface HomepageTaskRadarSettings {
  excludeFolders: string[];
  includeCompleted: boolean;
  limit: number;
}

/** 任务扫描结果 */
export interface HomepageTaskRadarResult {
  scannedFiles: number;
  matchedFiles: number;
  items: HomepageTaskItem[];
}

// ============================================================
// 主页新增业务类型
// ============================================================

/** 项目类型标签（对应 vault 一级文件夹） */
export type ProjectType = "学习" | "工作" | "创作" | "生活" | "研究";

/** 项目类型配色 */
export const PROJECT_TYPE_COLORS: Record<ProjectType, string> = {
  "学习": "#3b82f6",
  "工作": "#f59e0b",
  "创作": "#8b5cf6",
  "生活": "#10b981",
  "研究": "#06b6d4",
};

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
  line: number;
}

/** 扫描得到的项目条目 */
export interface HomepageProject {
  id: string;
  name: string;
  folderPath: string;
  type: ProjectType;
  progress: number;
  taskTotal: number;
  taskDone: number;
  description: string;
  recentFiles: ProjectRecentFile[];
  pendingTasks: ProjectTask[];
  updatedAt: number;
  status?: "active" | "paused" | "completed";
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

/** 每日笔记分类配置 */
export interface DailyNoteCategory {
  id: string;
  label: string;
  icon: string;
  folder: string;
  color: string;
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
  name: string;
  icon: string;
  description: string;
  type: ProjectType;
  createdAt: string;          // YYYY-MM-DD
  updatedAt?: string;
  status?: "active" | "paused" | "completed" | "archived";
  metadata?: {
    priority?: "urgent" | "high" | "medium" | "low";
    tags?: string[];
    collaborators?: string[];
    dependencies?: string[];
    deadline?: string;
  };
  tasks: ProjectConsoleTask[];
  deliverables: ProjectConsoleDeliverable[];
}

/** 任务优先级 */
export type TaskPriority = "P0" | "P1" | "P2" | "P3";

/** 任务优先级配色 */
export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  "P0": "#ef4444",  // 紧急 - 红色
  "P1": "#f59e0b",  // 重要 - 橙色
  "P2": "#3b82f6",  // 普通 - 蓝色
  "P3": "#6b7280",  // 低优 - 灰色
};

/** 任务优先级标签 */
export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  "P0": "紧急",
  "P1": "重要",
  "P2": "普通",
  "P3": "低优",
};

/** 控制台任务 */
export interface ProjectConsoleTask {
  text: string;
  completed: boolean;
  created?: string;           // YYYY-MM-DD
  due?: string;               // YYYY-MM-DD
  priority?: TaskPriority;    // 优先级
  tags?: string[];            // 标签
  subtasks?: ProjectConsoleSubtask[]; // 子任务
  progress?: number;          // 进度 0-100（用于多步骤任务）
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
  status: "pending" | "in-progress" | "done";
}

/**
 * 主页持久化数据（homepage-data.json）
 *
 * 存储路径：.obsidian/plugins/zendian/homepage-data.json
 * 注：项目数据来自 vault 文件夹扫描，不在此存储
 */
export interface HomepageData {
  quickNotes: HomepageQuickNote[];
  quotes: HomepageQuote[];
}
