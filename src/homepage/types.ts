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

/** 项目看板状态 */
export type ProjectStatus = "planning" | "in-progress" | "testing" | "completed";

/** 项目条目 */
export interface HomepageProject {
  id: string;
  name: string;
  status: ProjectStatus;
  progress: number;
  taskTotal: number;
  taskDone: number;
  description: string;
  updatedAt: number;
  createdAt: number;
}

/** 快捷便签 */
export interface HomepageQuickNote {
  id: string;
  label: string;
  path: string;
  color: string;
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

/** 热力图数据点 */
export interface HeatmapDay {
  date: string;
  count: number;
}

/**
 * 主页持久化数据（homepage-data.json）
 *
 * 存储路径：.obsidian/plugins/zendian/homepage-data.json
 */
export interface HomepageData {
  projects: HomepageProject[];
  quickNotes: HomepageQuickNote[];
  quotes: HomepageQuote[];
}
