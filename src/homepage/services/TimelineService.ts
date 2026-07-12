/**
 * TimelineService — 时间轴数据服务
 *
 * 功能：
 * - 提取项目时间轴事件
 * - 文件创建/修改历史
 * - 任务完成历史
 * - 里程碑事件
 * - 活动趋势分析
 */

import { App, TFile, TFolder } from "obsidian";
import { CacheManager } from "./CacheManager";
import { findProjectHomeFile } from "./ProjectHomeFileResolver";
import type { TimelineEvent, TimelineData, FileActivity } from "./types";
import type { ProjectConsoleData } from "../types";
import type { TaskSyncService } from "../../services/TaskSyncService";

export class TimelineService {
  private cache: CacheManager;

  constructor(private app: App, private taskSyncService?: TaskSyncService) {
    this.cache = new CacheManager(50, 10 * 60 * 1000); // 10分钟缓存
  }

  // ============================================================
  // 时间轴数据提取
  // ============================================================

  /**
   * 获取项目完整时间轴
   */
  async getProjectTimeline(projectPath: string): Promise<TimelineData> {
    const cacheKey = `timeline:${projectPath}`;

    // 尝试从缓存获取
    const cached = this.cache.get<TimelineData>(cacheKey);
    if (cached) return cached;

    // 收集所有事件
    const events: TimelineEvent[] = [];

    // 1. 文件事件
    const fileEvents = await this.extractFileEvents(projectPath);
    events.push(...fileEvents);

    // 2. 任务事件
    const taskEvents = await this.extractTaskEvents(projectPath);
    events.push(...taskEvents);

    // 3. 交付物事件
    const deliverableEvents = await this.extractDeliverableEvents(projectPath);
    events.push(...deliverableEvents);

    // 按时间排序（最新的在前）
    events.sort((a, b) => b.timestamp - a.timestamp);

    // 计算统计数据
    const stats = this.calculateTimelineStats(events);

    const timelineData: TimelineData = {
      events,
      stats,
    };

    // 缓存结果
    this.cache.set(cacheKey, timelineData);

    return timelineData;
  }

  /**
   * 获取最近的时间轴事件
   */
  async getRecentEvents(projectPath: string, limit = 20): Promise<TimelineEvent[]> {
    const timeline = await this.getProjectTimeline(projectPath);
    return timeline.events.slice(0, limit);
  }

  /**
   * 获取指定日期范围的事件
   */
  async getEventsByDateRange(
    projectPath: string,
    startDate: Date,
    endDate: Date
  ): Promise<TimelineEvent[]> {
    const timeline = await this.getProjectTimeline(projectPath);
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();

    return timeline.events.filter(
      event => event.timestamp >= startTime && event.timestamp <= endTime
    );
  }

  /**
   * 获取按日期分组的事件
   */
  async getEventsByDate(projectPath: string): Promise<Map<string, TimelineEvent[]>> {
    const timeline = await this.getProjectTimeline(projectPath);
    const grouped = new Map<string, TimelineEvent[]>();

    for (const event of timeline.events) {
      const date = event.date;
      if (!grouped.has(date)) {
        grouped.set(date, []);
      }
      grouped.get(date)!.push(event);
    }

    return grouped;
  }

  // ============================================================
  // 事件提取器
  // ============================================================

  /**
   * 提取文件创建和修改事件
   */
  private async extractFileEvents(projectPath: string): Promise<TimelineEvent[]> {
    const folder = this.app.vault.getAbstractFileByPath(projectPath);
    if (!(folder instanceof TFolder)) return [];

    const events: TimelineEvent[] = [];
    const files = this.getAllFiles(folder);

    for (const file of files) {
      // 跳过 .home 文件
      if (file.extension === "home") continue;

      // 文件创建事件
      events.push({
        type: "file-created",
        date: this.formatDate(file.stat.ctime),
        timestamp: file.stat.ctime,
        title: `创建文件：${file.basename}`,
        description: this.getFileDescription(file),
        filePath: file.path,
        metadata: {
          extension: file.extension,
          size: file.stat.size,
        },
      });

      // 文件修改事件（如果修改时间与创建时间不同）
      if (file.stat.mtime > file.stat.ctime + 60000) { // 相差超过1分钟
        events.push({
          type: "file-modified",
          date: this.formatDate(file.stat.mtime),
          timestamp: file.stat.mtime,
          title: `更新文件：${file.basename}`,
          description: this.getFileDescription(file),
          filePath: file.path,
          metadata: {
            extension: file.extension,
            size: file.stat.size,
          },
        });
      }
    }

    return events;
  }

  /**
   * 提取任务相关事件
   */
  private async extractTaskEvents(projectPath: string): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];
    const file = this.app.vault.getAbstractFileByPath(`${projectPath}/00 控制台/Timeline.md`);
    if (!(file instanceof TFile) || !this.taskSyncService) return events;

    try {
      const tasks = await this.taskSyncService.getTasks(projectPath);
      for (const task of tasks) {
        // 任务创建事件
        if (task.created) {
          const createdDate = new Date(task.created);
          events.push({
            type: "task-created",
            date: this.formatDate(createdDate.getTime()),
            timestamp: createdDate.getTime(),
            title: `创建任务：${task.text}`,
            description: task.due ? `截止日期：${task.due}` : undefined,
            metadata: {
              taskText: task.text,
              due: task.due,
            },
          });
        }

        // 任务完成事件（估算）
        if (task.completed && task.created) {
          // 由于没有完成时间，我们假设在创建后的某个时间完成
          // 这里使用文件的最后修改时间作为参考
          events.push({
            type: "task-completed",
            date: this.formatDate(file.stat.mtime),
            timestamp: file.stat.mtime,
            title: `完成任务：${task.text}`,
            description: "任务已标记为完成",
            metadata: {
              taskText: task.text,
            },
          });
        }
      }
    } catch (error) {
      console.error("[TimelineService] 提取任务事件失败:", error);
    }

    return events;
  }

  /**
   * 提取交付物事件
   */
  private async extractDeliverableEvents(projectPath: string): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];
    const file = findProjectHomeFile(this.app, projectPath);
    if (!file) return events;

    try {
      const content = await this.app.vault.read(file);
      const data = JSON.parse(content) as ProjectConsoleData;

      for (const deliverable of data.deliverables) {
        // 交付物添加事件
        events.push({
          type: "deliverable-added",
          date: this.formatDate(file.stat.ctime),
          timestamp: file.stat.ctime,
          title: `添加交付物：${deliverable.name}`,
          description: `状态：${this.getStatusText(deliverable.status)}`,
          filePath: deliverable.path,
          metadata: {
            name: deliverable.name,
            status: deliverable.status,
            path: deliverable.path,
          },
        });
      }
    } catch (error) {
      console.error("[TimelineService] 提取交付物事件失败:", error);
    }

    return events;
  }

  // ============================================================
  // 活动分析
  // ============================================================

  /**
   * 计算时间轴统计数据
   */
  private calculateTimelineStats(events: TimelineEvent[]) {
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const oneMonth = 30 * 24 * 60 * 60 * 1000;

    const eventsThisWeek = events.filter(e => now - e.timestamp < oneWeek).length;
    const eventsThisMonth = events.filter(e => now - e.timestamp < oneMonth).length;

    // 找到最活跃的日期
    const dateCount = new Map<string, number>();
    for (const event of events) {
      const count = dateCount.get(event.date) || 0;
      dateCount.set(event.date, count + 1);
    }

    let mostActiveDay = "";
    let maxCount = 0;
    for (const [date, count] of dateCount.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostActiveDay = date;
      }
    }

    return {
      totalEvents: events.length,
      eventsThisWeek,
      eventsThisMonth,
      mostActiveDay,
    };
  }

  /**
   * 获取活动热力图数据
   */
  async getActivityHeatmap(projectPath: string, days = 365): Promise<Map<string, number>> {
    const timeline = await this.getProjectTimeline(projectPath);
    const heatmap = new Map<string, number>();

    // 初始化最近N天的日期
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = this.formatDate(date.getTime());
      heatmap.set(dateStr, 0);
    }

    // 统计每天的事件数
    for (const event of timeline.events) {
      const count = heatmap.get(event.date) || 0;
      heatmap.set(event.date, count + 1);
    }

    return heatmap;
  }

  /**
   * 获取周活动统计
   */
  async getWeeklyActivity(projectPath: string): Promise<Map<string, number>> {
    const timeline = await this.getProjectTimeline(projectPath);
    const weekly = new Map<string, number>();

    for (const event of timeline.events) {
      const date = new Date(event.timestamp);
      const weekStart = this.getWeekStart(date);
      const weekKey = this.formatDate(weekStart.getTime());

      const count = weekly.get(weekKey) || 0;
      weekly.set(weekKey, count + 1);
    }

    return weekly;
  }

  /**
   * 获取文件类型活动统计
   */
  async getActivityByFileType(projectPath: string): Promise<Map<string, number>> {
    const timeline = await this.getProjectTimeline(projectPath);
    const byType = new Map<string, number>();

    for (const event of timeline.events) {
      if (event.type === "file-created" || event.type === "file-modified") {
        const ext = event.metadata?.extension || "unknown";
        const count = byType.get(ext) || 0;
        byType.set(ext, count + 1);
      }
    }

    return byType;
  }

  // ============================================================
  // 缓存管理
  // ============================================================

  /**
   * 清除时间轴缓存
   */
  clearCache(projectPath: string): void {
    this.cache.invalidate(`timeline:${projectPath}`);
  }

  /**
   * 清除所有缓存
   */
  clearAllCache(): void {
    this.cache.clear();
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  private getAllFiles(folder: TFolder): TFile[] {
    const files: TFile[] = [];
    const walk = (f: TFolder) => {
      for (const child of f.children) {
        if (child instanceof TFile) {
          files.push(child);
        } else if (child instanceof TFolder) {
          walk(child);
        }
      }
    };
    walk(folder);
    return files;
  }

  private formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 周一作为起始
    return new Date(d.setDate(diff));
  }

  private getFileDescription(file: TFile): string {
    const folder = file.parent?.name || "";
    const size = this.formatFileSize(file.stat.size);
    return folder ? `${folder} · ${size}` : size;
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private getStatusText(status: string): string {
    const map: Record<string, string> = {
      "pending": "待开始",
      "in-progress": "进行中",
      "done": "已完成",
      "archived": "已归档",
    };
    return map[status] || status;
  }
}
