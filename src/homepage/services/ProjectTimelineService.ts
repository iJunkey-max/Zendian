import { App, TFolder, TFile } from "obsidian";
import { loadProjectHome } from "./ProjectHomeStore";
import { getProjectStatusOption, normalizeProjectStatus } from "../project-status";

/**
 * 项目时间轴事件类型
 */
export type TimelineEventType =
  | "project_created"    // 项目创建
  | "file_created"       // 文件创建
  | "file_modified"      // 文件重大修改
  | "task_completed"     // 任务完成
  | "milestone"          // 里程碑
  | "note_added"         // 笔记添加
  | "status_changed";    // 项目状态变更

/**
 * 时间轴事件
 */
export interface TimelineEvent {
  type: TimelineEventType;
  timestamp: number;
  title: string;
  description?: string;
  filePath?: string;
  icon: string;
  color: string;
}

/**
 * 项目里程碑
 */
export interface ProjectMilestone {
  name: string;
  date: string;
  progress: number;
  isCompleted: boolean;
}

/**
 * 项目统计数据
 */
export interface ProjectStats {
  totalFiles: number;
  totalNotes: number;
  totalTasks: number;
  completedTasks: number;
  totalWords: number;
  activeDays: number;
  lastActiveDate: string;
}

/**
 * 项目时间轴服务
 * 负责提取项目的历史事件、里程碑、统计数据
 */
export class ProjectTimelineService {
  constructor(private app: App) {}

  /**
   * 获取项目时间轴（最近 20 条事件）
   */
  async getProjectTimeline(projectPath: string): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];
    const folder = this.app.vault.getAbstractFileByPath(projectPath);
    if (!(folder instanceof TFolder)) return events;

    // 1. 项目创建事件（使用文件夹最早的文件时间）
    const oldestFile = this.getOldestFile(folder);
    if (oldestFile) {
      events.push({
        type: "project_created",
        timestamp: oldestFile.stat.ctime,
        title: "项目创建",
        description: "项目开始启动",
        icon: "rocket",
        color: "#10b981",
      });
    }

    // 2. 收集文件创建和修改事件
    const allFiles = this.getAllMarkdownFiles(folder);
    for (const file of allFiles) {
      // 文件创建
      if (this.isSignificantFile(file)) {
        events.push({
          type: "file_created",
          timestamp: file.stat.ctime,
          title: `创建 ${file.basename}`,
          filePath: file.path,
          icon: "file-plus",
          color: "#3b82f6",
        });
      }

      // 重大修改（文件大小显著增长，或最近 7 天内修改过）
      const daysSinceModified = (Date.now() - file.stat.mtime) / (1000 * 60 * 60 * 24);
      if (daysSinceModified <= 7 && file.stat.mtime !== file.stat.ctime) {
        events.push({
          type: "file_modified",
          timestamp: file.stat.mtime,
          title: `更新 ${file.basename}`,
          filePath: file.path,
          icon: "edit",
          color: "#f59e0b",
        });
      }
    }

    // 3. 从项目主页读取里程碑、任务完成记录与状态历史
    const homeRecord = await loadProjectHome(this.app, projectPath);
    if (homeRecord) {
      const { data, file } = homeRecord;
      for (const ms of data.timeline?.milestones || []) {
        events.push({
          type: "milestone",
          timestamp: this.parseDateToTimestamp(ms.date),
          title: ms.name,
          description: `进度 ${ms.progress}%`,
          icon: "flag",
          color: ms.completed ? "#10b981" : "#8b5cf6",
        });
      }

      for (const task of data.tasks.filter((item) => item.completed)) {
        const timestamp = task.completedAt
          ? new Date(task.completedAt).getTime()
          : new Date(task.updatedAt || task.due || task.created || data.createdAt).getTime();
        if (!Number.isFinite(timestamp)) continue;
        events.push({
          type: "task_completed",
          timestamp,
          title: task.text,
          filePath: file.path,
          icon: "check-circle",
          color: "#10b981",
        });
      }

      for (const entry of data.statusHistory || []) {
        const timestamp = new Date(entry.changedAt).getTime();
        if (!Number.isFinite(timestamp)) continue;
        const from = getProjectStatusOption(normalizeProjectStatus(entry.from));
        const to = getProjectStatusOption(normalizeProjectStatus(entry.to));
        events.push({
          type: "status_changed",
          timestamp,
          title: `项目状态调整为${to.label}`,
          description: `从${from.label}调整为${to.label}`,
          icon: "refresh-cw",
          color: "#7186d9",
        });
      }
    }

    // 排序并返回最近 20 条
    return events.sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);
  }

  /**
   * 获取项目里程碑
   */
  async getProjectMilestones(projectPath: string): Promise<ProjectMilestone[]> {
    const record = await loadProjectHome(this.app, projectPath);
    return (record?.data.timeline?.milestones || []).map((milestone) => ({
      name: milestone.name,
      date: milestone.date,
      progress: milestone.progress,
      isCompleted: milestone.completed,
    }));
  }

  /**
   * 获取项目统计数据
   */
  async getProjectStats(projectPath: string): Promise<ProjectStats> {
    const folder = this.app.vault.getAbstractFileByPath(projectPath);
    if (!(folder instanceof TFolder)) {
      return {
        totalFiles: 0,
        totalNotes: 0,
        totalTasks: 0,
        completedTasks: 0,
        totalWords: 0,
        activeDays: 0,
        lastActiveDate: "-",
      };
    }

    const allFiles = this.getAllMarkdownFiles(folder);
    const homeRecord = await loadProjectHome(this.app, projectPath);
    let totalWords = 0;
    let totalTasks = 0;
    let completedTasks = 0;
    const activeDates = new Set<string>();

    for (const file of allFiles) {
      const content = await this.app.vault.read(file);
      totalWords += this.countWords(content);

      // 记录活跃日期
      const dateStr = new Date(file.stat.mtime).toISOString().split("T")[0];
      activeDates.add(dateStr);
    }

    const lastActiveFile = allFiles.sort((a, b) => b.stat.mtime - a.stat.mtime)[0];

    totalTasks = homeRecord?.data.tasks.length || 0;
    completedTasks = homeRecord?.data.tasks.filter((task) => task.completed).length || 0;

    return {
      totalFiles: allFiles.length,
      totalNotes: allFiles.length,
      totalTasks,
      completedTasks,
      totalWords,
      activeDays: activeDates.size,
      lastActiveDate: lastActiveFile ? this.formatDate(lastActiveFile.stat.mtime) : "-",
    };
  }

  // ────────────────────────────────────────────────────────────
  // 私有工具方法
  // ────────────────────────────────────────────────────────────

  private getOldestFile(folder: TFolder): TFile | null {
    const files = this.getAllMarkdownFiles(folder);
    if (files.length === 0) return null;
    return files.sort((a, b) => a.stat.ctime - b.stat.ctime)[0];
  }

  private getAllMarkdownFiles(folder: TFolder): TFile[] {
    const files: TFile[] = [];
    const traverse = (f: TFolder) => {
      for (const child of f.children) {
        if (child instanceof TFile && child.extension === "md") {
          files.push(child);
        } else if (child instanceof TFolder) {
          traverse(child);
        }
      }
    };
    traverse(folder);
    return files;
  }

  private isSignificantFile(file: TFile): boolean {
    // 排除非业务索引文件
    const ignored = ["README.md", "Index.md"];
    return !ignored.includes(file.basename);
  }

  private parseDateToTimestamp(dateStr: string): number {
    const date = new Date(dateStr + "T12:00:00");
    return date.getTime();
  }

  private countWords(text: string): number {
    // 简单的中英文字数统计
    const chinese = text.match(/[一-龥]/g) || [];
    const english = text.match(/[a-zA-Z]+/g) || [];
    return chinese.length + english.length;
  }

  private formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}
