/**
 * StatisticsService — 统计数据计算服务
 *
 * 功能：
 * - 项目统计汇总
 * - 任务统计分析
 * - 活动趋势分析
 * - 数据可视化准备
 */

import { App } from "obsidian";
import { ProjectDataService } from "./ProjectDataService";
import { TimelineService } from "./TimelineService";
import type {
  TaskStatistics,
  DeliverableStatistics,
  ActivityStats,
} from "./types";

export class StatisticsService {
  private projectDataService: ProjectDataService;
  private timelineService: TimelineService;

  constructor(app: App) {
    this.projectDataService = new ProjectDataService(app);
    this.timelineService = new TimelineService(app);
  }

  // ============================================================
  // 任务统计
  // ============================================================

  /**
   * 获取任务统计数据
   */
  async getTaskStatistics(projectPath: string): Promise<TaskStatistics> {
    const tasks = await this.projectDataService.getTasks(projectPath);
    const now = new Date();
    const today = this.formatDate(now);
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const completed = tasks.filter(t => t.completed);
    const pending = tasks.filter(t => !t.completed);

    const overdue = pending.filter(t => t.due && t.due < today);
    const dueToday = pending.filter(t => t.due === today);
    const dueThisWeek = pending.filter(t => {
      if (!t.due) return false;
      return t.due >= today && t.due <= this.formatDate(weekLater);
    });

    const byPriority: Record<string, number> = {
      P0: 0,
      P1: 0,
      P2: 0,
      P3: 0,
      none: 0,
    };

    for (const task of tasks) {
      const priority = task.priority || "none";
      byPriority[priority] = (byPriority[priority] || 0) + 1;
    }

    const completionRate = tasks.length > 0
      ? (completed.length / tasks.length) * 100
      : 0;

    return {
      total: tasks.length,
      completed: completed.length,
      pending: pending.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      dueThisWeek: dueThisWeek.length,
      byPriority,
      completionRate,
    };
  }

  // ============================================================
  // 交付物统计
  // ============================================================

  /**
   * 获取交付物统计数据
   */
  async getDeliverableStatistics(projectPath: string): Promise<DeliverableStatistics> {
    const deliverables = await this.projectDataService.getDeliverables(projectPath);

    const completed = deliverables.filter(d => d.status === "done");
    const inProgress = deliverables.filter(d => d.status === "in-progress");
    const pending = deliverables.filter(d => d.status === "pending");

    const completionRate = deliverables.length > 0
      ? (completed.length / deliverables.length) * 100
      : 0;

    return {
      total: deliverables.length,
      completed: completed.length,
      inProgress: inProgress.length,
      pending: pending.length,
      completionRate,
    };
  }

  // ============================================================
  // 活动统计
  // ============================================================

  /**
   * 获取活动统计数据
   */
  async getActivityStatistics(projectPath: string): Promise<ActivityStats> {
    const files = this.projectDataService.getProjectFiles(projectPath);

    const daily = new Map<string, number>();
    const weekly = new Map<string, number>();
    const monthly = new Map<string, number>();
    const byType = new Map<string, number>();

    for (const file of files) {
      // 按日期统计
      const dateStr = this.formatDate(new Date(file.modified));
      daily.set(dateStr, (daily.get(dateStr) || 0) + 1);

      // 按周统计
      const weekStr = this.getWeekKey(new Date(file.modified));
      weekly.set(weekStr, (weekly.get(weekStr) || 0) + 1);

      // 按月统计
      const monthStr = this.getMonthKey(new Date(file.modified));
      monthly.set(monthStr, (monthly.get(monthStr) || 0) + 1);

      // 按文件类型统计
      const ext = file.extension || "unknown";
      byType.set(ext, (byType.get(ext) || 0) + 1);
    }

    return {
      daily,
      weekly,
      monthly,
      byType,
    };
  }

  // ============================================================
  // 趋势分析
  // ============================================================

  /**
   * 获取活动趋势（最近30天）
   */
  async getActivityTrend(projectPath: string, days = 30): Promise<Array<{ date: string; count: number }>> {
    const heatmap = await this.timelineService.getActivityHeatmap(projectPath, days);
    const trend: Array<{ date: string; count: number }> = [];

    // 按日期排序
    const sortedDates = Array.from(heatmap.keys()).sort();

    for (const date of sortedDates.slice(-days)) {
      trend.push({
        date,
        count: heatmap.get(date) || 0,
      });
    }

    return trend;
  }

  /**
   * 获取任务完成趋势
   */
  async getTaskCompletionTrend(projectPath: string): Promise<Array<{ date: string; completed: number; total: number }>> {
    const timeline = await this.timelineService.getProjectTimeline(projectPath);
    const trend: Array<{ date: string; completed: number; total: number }> = [];

    // 按日期分组任务事件
    const byDate = new Map<string, { completed: number; created: number }>();

    for (const event of timeline.events) {
      if (event.type === "task-created" || event.type === "task-completed") {
        if (!byDate.has(event.date)) {
          byDate.set(event.date, { completed: 0, created: 0 });
        }
        const stats = byDate.get(event.date)!;
        if (event.type === "task-completed") {
          stats.completed++;
        } else {
          stats.created++;
        }
      }
    }

    // 按日期排序
    const sortedDates = Array.from(byDate.keys()).sort();
    let totalTasks = 0;
    let completedTasks = 0;

    for (const date of sortedDates) {
      const stats = byDate.get(date)!;
      totalTasks += stats.created;
      completedTasks += stats.completed;

      trend.push({
        date,
        completed: completedTasks,
        total: totalTasks,
      });
    }

    return trend;
  }

  /**
   * 获取文件类型分布（用于饼图）
   */
  async getFileTypeDistribution(projectPath: string): Promise<Array<{ type: string; count: number; percentage: number }>> {
    const files = this.projectDataService.getProjectFiles(projectPath);
    const typeCount = new Map<string, number>();

    for (const file of files) {
      const ext = file.extension || "unknown";
      typeCount.set(ext, (typeCount.get(ext) || 0) + 1);
    }

    const total = files.length;
    const distribution: Array<{ type: string; count: number; percentage: number }> = [];

    for (const [type, count] of typeCount.entries()) {
      distribution.push({
        type,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      });
    }

    // 按数量降序排序
    distribution.sort((a, b) => b.count - a.count);

    return distribution;
  }

  // ============================================================
  // 周/月报告
  // ============================================================

  /**
   * 生成周报数据
   */
  async getWeeklyReport(projectPath: string): Promise<{
    weekStart: string;
    weekEnd: string;
    filesCreated: number;
    filesModified: number;
    tasksCompleted: number;
    tasksCreated: number;
    topFileTypes: Array<{ type: string; count: number }>;
  }> {
    const now = new Date();
    const weekStart = this.getWeekStart(now);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const events = await this.timelineService.getEventsByDateRange(projectPath, weekStart, weekEnd);

    let filesCreated = 0;
    let filesModified = 0;
    let tasksCompleted = 0;
    let tasksCreated = 0;
    const fileTypes = new Map<string, number>();

    for (const event of events) {
      switch (event.type) {
        case "file-created":
          filesCreated++;
          if (event.metadata?.extension) {
            const ext = event.metadata.extension as string;
            fileTypes.set(ext, (fileTypes.get(ext) || 0) + 1);
          }
          break;
        case "file-modified":
          filesModified++;
          break;
        case "task-completed":
          tasksCompleted++;
          break;
        case "task-created":
          tasksCreated++;
          break;
      }
    }

    const topFileTypes = Array.from(fileTypes.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      weekStart: this.formatDate(weekStart),
      weekEnd: this.formatDate(weekEnd),
      filesCreated,
      filesModified,
      tasksCompleted,
      tasksCreated,
      topFileTypes,
    };
  }

  /**
   * 生成月报数据
   */
  async getMonthlyReport(projectPath: string): Promise<{
    month: string;
    filesCreated: number;
    filesModified: number;
    tasksCompleted: number;
    tasksCreated: number;
    totalActivity: number;
    averageDailyActivity: number;
  }> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const events = await this.timelineService.getEventsByDateRange(projectPath, monthStart, monthEnd);

    let filesCreated = 0;
    let filesModified = 0;
    let tasksCompleted = 0;
    let tasksCreated = 0;

    for (const event of events) {
      switch (event.type) {
        case "file-created":
          filesCreated++;
          break;
        case "file-modified":
          filesModified++;
          break;
        case "task-completed":
          tasksCompleted++;
          break;
        case "task-created":
          tasksCreated++;
          break;
      }
    }

    const daysInMonth = monthEnd.getDate();
    const totalActivity = events.length;
    const averageDailyActivity = totalActivity / daysInMonth;

    return {
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      filesCreated,
      filesModified,
      tasksCompleted,
      tasksCreated,
      totalActivity,
      averageDailyActivity,
    };
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  private formatDate(date: Date | number): string {
    const d = typeof date === "number" ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private getWeekKey(date: Date): string {
    const weekStart = this.getWeekStart(date);
    return this.formatDate(weekStart);
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 周一作为起始
    return new Date(d.setDate(diff));
  }

  private getMonthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
}
