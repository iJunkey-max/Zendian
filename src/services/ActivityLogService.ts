/**
 * ActivityLogService — 记录和查询用户活动日志
 *
 * 功能：
 * - 记录每日创建笔记、编辑文件、完成任务
 * - 计算每日/每月统计数据
 * - 生成热力图数据
 *
 * 数据存储：<Vault.configDir>/plugins/zendian/activity-log.json
 */

import { App, Notice } from "obsidian";
import type { EventBus } from "../core/event-bus";
import { Events } from "../core/event-bus";
import { getPluginDataPath, getPluginDataRoot } from "../utils/plugin-paths";

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
  focusSeconds?: number;           // 专注时长（秒，精确统计；旧数据按分钟迁移）
}

export interface FocusSegment {
  start: number;
  end: number;
}

export interface ActiveFocusSession {
  id: string;
  status: "running" | "paused";
  startedAt: number;
  plannedSeconds: number;
  targetLabel: string;
  targetPath?: string;
  projectId?: string;
  projectName?: string;
  segments: FocusSegment[];
  activeSegmentStartedAt?: number;
  breakMinutes: number;
}

export interface FocusSessionRecord {
  id: string;
  startedAt: number;
  endedAt: number;
  plannedSeconds: number;
  focusedSeconds: number;
  status: "completed" | "ended" | "abandoned";
  targetLabel: string;
  targetPath?: string;
  projectId?: string;
  projectName?: string;
}

/** 月度统计 */
export interface MonthlyStats {
  noteCount: number;               // 笔记数量
  editCount: number;               // 编辑次数
  taskCompleted: number;           // 完成任务数
  activeDays: number;              // 活跃天数
  consecutiveDays: number;         // 连续活跃天数
  focusHours: number;              // 专注时长（小时）
  focusMinutes: number;            // 专注时长（分钟，保留精度）
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
  activeFocusSession?: ActiveFocusSession;
  focusSessions?: FocusSessionRecord[];
}

function validFocusSegments(segments: FocusSegment[]): boolean {
  return Array.isArray(segments) && segments.every((segment, index) => segment &&
    Number.isFinite(segment.start) && segment.start >= 0 && Number.isFinite(segment.end) &&
    Number.isFinite(new Date(segment.end).getTime()) && segment.end >= segment.start &&
    segment.end - segment.start <= 86400000 && (!index || segment.start >= segments[index - 1].end));
}

export class ActivityLogService {
  private data: ActivityLogData = {
    dailyActivities: {},
    lastSyncTime: 0,
  };

  private readonly dataPath: string;
  private readonly dataRoot: string;
  private saveDebounceTimer: number | null = null;
  private statsNotifyTimer: number | null = null;
  private saveQueue: Promise<void> = Promise.resolve();
  private persistedText: string | null = null;
  private storageError: Error | null = null;
  private readonly SAVE_DEBOUNCE = 2000;  // 2 秒防抖保存

  constructor(private app: App, private events?: EventBus) {
    this.dataRoot = getPluginDataRoot(app);
    this.dataPath = getPluginDataPath(app, "activity-log.json");
  }

  /** 初始化 — 加载历史数据 */
  async load(): Promise<void> {
    try {
      const adapter = this.app.vault.adapter;
      if (await adapter.exists(this.dataPath)) {
        const content = await adapter.read(this.dataPath);
        const parsed = JSON.parse(content);
        const object = (value: unknown) => !!value && typeof value === "object" && !Array.isArray(value);
        if (!object(parsed) || (parsed.dailyActivities !== undefined && (!object(parsed.dailyActivities) || !Object.values(parsed.dailyActivities).every(object))) || (parsed.focusSessions !== undefined && (!Array.isArray(parsed.focusSessions) || !parsed.focusSessions.every(object)))) throw new Error("活动日志结构无效");
        const active = parsed.activeFocusSession;
        if (active && (!object(active) || !["running", "paused"].includes(active.status) || typeof active.id !== "string" || !Number.isFinite(active.startedAt) || !Number.isFinite(active.plannedSeconds) || active.plannedSeconds <= 0 || active.plannedSeconds > 86400 || !validFocusSegments(active.segments) || (active.activeSegmentStartedAt !== undefined && (!Number.isFinite(active.activeSegmentStartedAt) || active.activeSegmentStartedAt < 0)))) throw new Error("未结束专注会话格式无效");
        this.data = parsed;
        this.persistedText = content;
        this.data.dailyActivities ??= {};
        this.data.focusSessions ??= [];
        for (const activity of Object.values(this.data.dailyActivities)) {
          activity.noteCreated = Number(activity.noteCreated) || 0;
          activity.noteEdited = Number(activity.noteEdited) || 0;
          activity.taskCompleted = Number(activity.taskCompleted) || 0;
          activity.fileOpened = Number(activity.fileOpened) || 0;
          activity.focusMinutes = Number(activity.focusMinutes) || 0;
          activity.focusSeconds ??= Math.round(activity.focusMinutes * 60);
        }
      }
    } catch (e) {
      this.storageError = new Error(`活动日志无法读取：${String(e)}`);
      console.warn("[ActivityLog] 无法加载历史数据，停止日志写入:", e);
      new Notice("活动与专注日志无法读取，原文件保留，已停止写入；请检查备份后重新加载。本次新记录仅保留在内存中。", 12000);
      try {
        const adapter = this.app.vault.adapter;
        if (await adapter.exists(this.dataPath)) {
          const backupPath = getPluginDataPath(this.app, `activity-log.corrupt-${Date.now()}.json`);
          await adapter.copy(this.dataPath, backupPath);
          console.warn(`[ActivityLog] 已备份不可读日志到 ${backupPath}`);
        }
      } catch (backupError) {
        console.error("[ActivityLog] 备份不可读日志失败:", backupError);
      }
      this.data = { dailyActivities: {}, lastSyncTime: 0 };
    }
  }

  /** 记录活动 */
  logActivity(type: ActivityType, _filePath: string, _metadata?: Record<string, any>): void {
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
    const wasActiveDay = this.isActiveDay(dailyRecord);

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
    if (!wasActiveDay || type === "note_created" || type === "task_completed") this.scheduleStatsNotification();
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
    this.data.dailyActivities[today].focusSeconds =
      (this.data.dailyActivities[today].focusSeconds ?? 0) + Math.round(minutes * 60);
    this.scheduleSave();
    this.scheduleStatsNotification();
  }

  getActiveFocusSession(): ActiveFocusSession | null {
    return this.data.activeFocusSession ? structuredClone(this.data.activeFocusSession) : null;
  }

  setActiveFocusSession(session: ActiveFocusSession | null): void {
    if (session) this.data.activeFocusSession = structuredClone(session);
    else delete this.data.activeFocusSession;
    this.scheduleSave();
  }

  recordFocusSession(record: FocusSessionRecord, segments: FocusSegment[]): boolean {
    if (!record.id || !["completed", "ended", "abandoned"].includes(record.status) ||
      !Number.isFinite(record.startedAt) || record.startedAt < 0 || !Number.isFinite(record.endedAt) || record.endedAt < record.startedAt ||
      !Number.isFinite(record.plannedSeconds) || record.plannedSeconds <= 0 || record.plannedSeconds > 86400 ||
      !Number.isFinite(record.focusedSeconds) || record.focusedSeconds < 0 || record.focusedSeconds > record.plannedSeconds + 1 ||
      !validFocusSegments(segments) || segments.some(segment => segment.start < record.startedAt || segment.end > record.endedAt) ||
      record.focusedSeconds !== Math.round(segments.reduce((sum, segment) => sum + (segment.end - segment.start) / 1000, 0))) return false;
    this.data.focusSessions ??= [];
    if (this.data.focusSessions.some(existing => existing.id === record.id)) return true;
    this.data.focusSessions.push({ ...record });
    if (this.data.focusSessions.length > 1000) {
      this.data.focusSessions.splice(0, this.data.focusSessions.length - 1000);
    }

    if (record.status !== "abandoned") {
      const rounding = { milliseconds: 0, seconds: 0 };
      for (const segment of segments) this.addFocusSegment(segment, rounding);
    }
    delete this.data.activeFocusSession;
    this.scheduleSave();
    this.scheduleStatsNotification();
    return true;
  }

  /** Summary of retained records only; legacy records without identity are not guessed by path. */
  getProjectFocusSummary(projectId: string): { sessions: number; seconds: number } {
    const records = (this.data.focusSessions || []).filter(record => record.projectId === projectId && ["completed", "ended"].includes(record.status) && Number.isFinite(record.focusedSeconds) && record.focusedSeconds >= 0);
    return { sessions: records.length, seconds: records.reduce((sum, record) => sum + Math.max(0, Number(record.focusedSeconds) || 0), 0) };
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
    let focusSeconds = 0;

    // 汇总本月数据
    for (const [date, activity] of Object.entries(this.data.dailyActivities)) {
      if (date >= startDate) {
        noteCount += activity.noteCreated;
        editCount += activity.noteEdited;
        taskCompleted += activity.taskCompleted;
        focusSeconds += activity.focusSeconds ?? Math.round(activity.focusMinutes * 60);
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
      focusHours: Math.round(focusSeconds / 3600),
      focusMinutes: focusSeconds / 60,
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
    let focusSeconds = 0;

    for (const [date, activity] of Object.entries(this.data.dailyActivities)) {
      if (date >= startDate && date <= endDate) {
        noteCount += activity.noteCreated;
        editCount += activity.noteEdited;
        taskCompleted += activity.taskCompleted;
        focusSeconds += activity.focusSeconds ?? Math.round(activity.focusMinutes * 60);
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
      focusHours: Math.round(focusSeconds / 3600),
      focusMinutes: focusSeconds / 60,
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
      activity.taskCompleted > 0 ||
      (activity.focusSeconds ?? activity.focusMinutes * 60) > 0
    );
  }

  private addFocusSegment(segment: FocusSegment, rounding = { milliseconds: 0, seconds: 0 }): void {
    if (!validFocusSegments([segment])) return;
    let cursor = segment.start;
    const end = Math.max(segment.start, segment.end);
    while (cursor < end) {
      const dayStart = new Date(cursor);
      dayStart.setHours(0, 0, 0, 0);
      const nextDay = new Date(dayStart);
      nextDay.setDate(nextDay.getDate() + 1);
      const sliceEnd = Math.min(end, nextDay.getTime());
      rounding.milliseconds += sliceEnd - cursor;
      const roundedTotal = Math.round(rounding.milliseconds / 1000);
      const seconds = roundedTotal - rounding.seconds;
      rounding.seconds = roundedTotal;
      const date = this.formatDate(new Date(cursor));
      const activity = this.ensureDailyActivity(date);
      activity.focusSeconds = (activity.focusSeconds ?? Math.round(activity.focusMinutes * 60)) + seconds;
      activity.focusMinutes = activity.focusSeconds / 60;
      cursor = sliceEnd;
    }
  }

  private ensureDailyActivity(date: string): DailyActivity {
    this.data.dailyActivities[date] ??= {
      date,
      noteCreated: 0,
      noteEdited: 0,
      taskCompleted: 0,
      fileOpened: 0,
      focusMinutes: 0,
      focusSeconds: 0,
    };
    return this.data.dailyActivities[date];
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
      void this.save();
      this.saveDebounceTimer = null;
    }, this.SAVE_DEBOUNCE);
  }

  private scheduleStatsNotification(): void {
    if (!this.events) return;
    if (this.statsNotifyTimer !== null) window.clearTimeout(this.statsNotifyTimer);
    this.statsNotifyTimer = window.setTimeout(() => {
      this.statsNotifyTimer = null;
      this.events?.emit(Events.ACTIVITY_STATS_CHANGED);
    }, 100);
  }

  /** 保存到磁盘 */
  private async save(): Promise<void> {
    if (this.storageError) return;
    this.data.lastSyncTime = Date.now();
    const content = JSON.stringify(this.data, null, 2);
    const write = this.saveQueue
      .catch(() => undefined)
      .then(async () => {
        if (this.storageError) return;
        const adapter = this.app.vault.adapter;
        const latest = await adapter.exists(this.dataPath) ? await adapter.read(this.dataPath) : null;
        if (latest !== this.persistedText) throw new Error("活动日志被外部修改，未覆盖");
        if (!(await adapter.exists(this.dataRoot))) await adapter.mkdir(this.dataRoot);
        await adapter.write(this.dataPath, content);
        this.persistedText = content;
      });
    this.saveQueue = write.catch(() => undefined);
    try {
      await write;
    } catch (e) {
      if (!this.storageError) {
        this.storageError = new Error(String(e));
        new Notice("活动与专注日志保存失败或检测到外部修改，已停止后续写入；请检查存储与同步后重新加载。本次新记录仅保留在内存中。", 12000);
      }
      console.error("[ActivityLog] 保存失败:", e);
    }
  }

  /** 强制立即保存 */
  async flush(): Promise<void> {
    if (this.saveDebounceTimer !== null) {
      window.clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
    if (this.statsNotifyTimer !== null) {
      window.clearTimeout(this.statsNotifyTimer);
      this.statsNotifyTimer = null;
    }
    await this.save();
  }
}
