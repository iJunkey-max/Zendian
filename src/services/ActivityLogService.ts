/**
 * ActivityLogService — 记录和查询用户活动日志
 *
 * 功能：
 * - 记录每日创建笔记、编辑文件、完成任务
 * - 计算每日/每月统计数据
 * - 生成热力图数据
 *
 * 数据存储：.obsidian/plugins/zendian/activity-log.json
 */

import { App, TFile, TFolder } from "obsidian";

/** 活动类型 */
export type ActivityType = "note_created" | "note_edited" | "task_completed" | "file_opened";

/** 单条活动记录 */
export interface ActivityRecord {
  type: ActivityType;
  timestamp: number;
  filePath: string;
  metadata?: Record<string, any>;
}

/** 每日活动汇总 */
export interface DailyActivity {
  date: string;                    // YYYY-MM-DD
  noteCreated: number;
  noteEdited: number;
  taskCompleted: number;
  fileOpened: number;
  focusMinutes: number;            // 专注时长（分钟）
}

/** 月度统计 */
export interface MonthlyStats {
  noteCount: number;               // 笔记数量
  editCount: number;               // 编辑次数
  taskCompleted: number;           // 完成任务数
  activeDays: number;              // 活跃天数
  consecutiveDays: number;         // 连续活跃天数
  focusHours: number;              // 专注时长（小时）
}

/** 今日活跃度 */
export interface TodayActivity {
  created: number;
  edited: number;
  taskCompleted: number;
}

/** 持久化数据结构 */
interface ActivityLogData {
  dailyActivities: Record<string, DailyActivity>;  // key: YYYY-MM-DD
  lastSyncTime: number;
}

export class ActivityLogService {
  private data: ActivityLogData = {
    dailyActivities: {},
    lastSyncTime: 0,
  };

  private dataPath = ".obsidian/plugins/zendian/activity-log.json";
  private saveDebounceTimer: number | null = null;
  private readonly SAVE_DEBOUNCE = 2000;  // 2 秒防抖保存

  constructor(private app: App) {}

  /** 初始化 — 加载历史数据 */
  async load(): Promise<void> {
    try {
      const file = this.app.vault.getAbstractFileByPath(this.dataPath);
      if (file instanceof TFile) {
        const content = await this.app.vault.read(file);
        this.data = JSON.parse(content);
      }
    } catch (e) {
      console.warn("[ActivityLog] 无法加载历史数据，使用空数据:", e);
      this.data = { dailyActivities: {}, lastSyncTime: 0 };
    }
  }

  /** 记录活动 */
  logActivity(type: ActivityType, filePath: string, metadata?: Record<string, any>): void {
    const today = this.getToday();

    // 确保今日记录存在
    if (!this.data.dailyActivities[today]) {
      this.data.dailyActivities[today] = {
        date: today,
        noteCreated: 0,
        noteEdited: 0,
        taskCompleted: 0,
        fileOpened: 0,
        focusMinutes: 0,
      };
    }

    const dailyRecord = this.data.dailyActivities[today];

    // 更新计数
    switch (type) {
      case "note_created":
        dailyRecord.noteCreated++;
        break;
      case "note_edited":
        dailyRecord.noteEdited++;
        break;
      case "task_completed":
        dailyRecord.taskCompleted++;
        break;
      case "file_opened":
        dailyRecord.fileOpened++;
        break;
    }

    // 防抖保存
    this.scheduleSave();
  }

  /** 记录专注时长（分钟） */
  logFocusTime(minutes: number): void {
    const today = this.getToday();
    if (!this.data.dailyActivities[today]) {
      this.data.dailyActivities[today] = {
        date: today,
        noteCreated: 0,
        noteEdited: 0,
        taskCompleted: 0,
        fileOpened: 0,
        focusMinutes: 0,
      };
    }
    this.data.dailyActivities[today].focusMinutes += minutes;
    this.scheduleSave();
  }

  /** 获取指定日期的活动 */
  getActivityByDate(date: string): DailyActivity | null {
    return this.data.dailyActivities[date] || null;
  }

  /** 获取今日活动 */
  getTodayActivity(): TodayActivity {
    const today = this.getToday();
    const record = this.data.dailyActivities[today];

    if (!record) {
      return { created: 0, edited: 0, taskCompleted: 0 };
    }

    return {
      created: record.noteCreated,
      edited: record.noteEdited,
      taskCompleted: record.taskCompleted,
    };
  }

  /** 获取月度统计 */
  getMonthlyStats(): MonthlyStats {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDate = this.formatDate(startOfMonth);

    let noteCount = 0;
    let editCount = 0;
    let taskCompleted = 0;
    let activeDays = 0;
    let focusMinutes = 0;

    // 汇总本月数据
    for (const [date, activity] of Object.entries(this.data.dailyActivities)) {
      if (date >= startDate) {
        noteCount += activity.noteCreated;
        editCount += activity.noteEdited;
        taskCompleted += activity.taskCompleted;
        focusMinutes += activity.focusMinutes;
        if (this.isActiveDay(activity)) {
          activeDays++;
        }
      }
    }

    // 计算连续活跃天数
    const consecutiveDays = this.getConsecutiveDays();

    return {
      noteCount,
      editCount,
      taskCompleted,
      activeDays,
      consecutiveDays,
      focusHours: Math.round(focusMinutes / 60),
    };
  }

  /** 获取热力图数据（最近 N 天） */
  getHeatmapData(days: number): Array<{ date: string; count: number }> {
    const result: Array<{ date: string; count: number }> = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = this.formatDate(date);

      const activity = this.data.dailyActivities[dateStr];
      const count = activity
        ? activity.noteCreated + activity.noteEdited + activity.taskCompleted
        : 0;

      result.push({ date: dateStr, count });
    }

    return result;
  }

  /** 获取指定日期范围的活动趋势（用于折线图） */
  getTrendData(startDate: string, endDate: string): DailyActivity[] {
    const result: DailyActivity[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = this.formatDate(d);
      const activity = this.data.dailyActivities[dateStr];

      if (activity) {
        result.push(activity);
      } else {
        // 填充空数据
        result.push({
          date: dateStr,
          noteCreated: 0,
          noteEdited: 0,
          taskCompleted: 0,
          fileOpened: 0,
          focusMinutes: 0,
        });
      }
    }

    return result;
  }

  /** 获取上月统计（用于环比计算） */
  getLastMonthStats(): MonthlyStats {
    const now = new Date();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const startDate = this.formatDate(startOfLastMonth);
    const endDate = this.formatDate(endOfLastMonth);

    let noteCount = 0;
    let editCount = 0;
    let taskCompleted = 0;
    let activeDays = 0;
    let focusMinutes = 0;

    for (const [date, activity] of Object.entries(this.data.dailyActivities)) {
      if (date >= startDate && date <= endDate) {
        noteCount += activity.noteCreated;
        editCount += activity.noteEdited;
        taskCompleted += activity.taskCompleted;
        focusMinutes += activity.focusMinutes;
        if (this.isActiveDay(activity)) {
          activeDays++;
        }
      }
    }

    return {
      noteCount,
      editCount,
      taskCompleted,
      activeDays,
      consecutiveDays: 0,  // 上月连续天数不需要
      focusHours: Math.round(focusMinutes / 60),
    };
  }

  /** 清理旧数据（保留最近 365 天） */
  async cleanup(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 365);
    const cutoffStr = this.formatDate(cutoffDate);

    const newActivities: Record<string, DailyActivity> = {};
    for (const [date, activity] of Object.entries(this.data.dailyActivities)) {
      if (date >= cutoffStr) {
        newActivities[date] = activity;
      }
    }

    this.data.dailyActivities = newActivities;
    await this.save();
  }

  // ══════════════════════════════════════════════════════════
  // 私有方法
  // ══════════════════════════════════════════════════════════

  private getToday(): string {
    return this.formatDate(new Date());
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /** 判断是否为活跃日（至少有 1 项活动） */
  private isActiveDay(activity: DailyActivity): boolean {
    return (
      activity.noteCreated > 0 ||
      activity.noteEdited > 0 ||
      activity.taskCompleted > 0
    );
  }

  /** 计算连续活跃天数 */
  private getConsecutiveDays(): number {
    const today = new Date();
    let consecutive = 0;

    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = this.formatDate(date);

      const activity = this.data.dailyActivities[dateStr];
      if (activity && this.isActiveDay(activity)) {
        consecutive++;
      } else {
        break;
      }
    }

    return consecutive;
  }

  /** 防抖保存 */
  private scheduleSave(): void {
    if (this.saveDebounceTimer !== null) {
      window.clearTimeout(this.saveDebounceTimer);
    }
    this.saveDebounceTimer = window.setTimeout(() => {
      this.save();
      this.saveDebounceTimer = null;
    }, this.SAVE_DEBOUNCE);
  }

  /** 保存到磁盘 */
  private async save(): Promise<void> {
    try {
      const content = JSON.stringify(this.data, null, 2);
      const file = this.app.vault.getAbstractFileByPath(this.dataPath);

      if (file instanceof TFile) {
        await this.app.vault.modify(file, content);
      } else {
        // 确保目录存在
        const dirPath = this.dataPath.substring(0, this.dataPath.lastIndexOf("/"));
        const dir = this.app.vault.getAbstractFileByPath(dirPath);
        if (!(dir instanceof TFolder)) {
          await this.app.vault.createFolder(dirPath);
        }
        await this.app.vault.create(this.dataPath, content);
      }

      this.data.lastSyncTime = Date.now();
    } catch (e) {
      console.error("[ActivityLog] 保存失败:", e);
    }
  }

  /** 强制立即保存 */
  async flush(): Promise<void> {
    if (this.saveDebounceTimer !== null) {
      window.clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
    await this.save();
  }
}
