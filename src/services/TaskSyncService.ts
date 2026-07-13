/**
 * TaskSyncService — 任务同步服务
 *
 * 功能：
 * - 从 Timeline.md 解析任务（支持 @due、@priority 标记）
 * - 修改 Timeline.md 文件（勾选/取消勾选任务）
 * - 提供统一的任务数据接口
 *
 * 数据来源：新项目根目录 Timeline.md；兼容旧项目 00 控制台/Timeline.md
 */

import { App, TFile, TFolder } from "obsidian";
import { findProjectTimelineFile } from "../homepage/services/ProjectHomeFileResolver";

/** 任务优先级 */
export type TaskPriority = "low" | "medium" | "high" | "urgent";

/** 任务数据结构 */
export interface Task {
  text: string;                  // 任务文本（去除标记后）
  completed: boolean;
  created?: string;              // YYYY-MM-DD
  due?: string;                  // YYYY-MM-DD
  dueTime?: string;              // HH:mm
  priority?: TaskPriority;
  tags?: string[];
  line: number;                  // 所在行号（0-based）
  raw: string;                   // 原始行内容
  projectPath: string;           // 所属项目路径
}

/** 任务统计 */
export interface TaskStats {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  todayDue: number;
}

const TASK_REGEX = /^- \[([ xX])\] (.+)$/;

export class TaskSyncService {
  constructor(private app: App) {}

  /**
   * 获取项目的所有任务
   * @param projectPath 项目根目录路径
   * @returns 任务列表
   */
  async getTasks(projectPath: string): Promise<Task[]> {
    const timelineFile = this.findTimelineFile(projectPath);
    if (!timelineFile) return [];

    try {
      const content = await this.app.vault.read(timelineFile);
      return this.parseTimeline(content, projectPath);
    } catch (e) {
      console.error(`[TaskSync] 读取 Timeline 失败: ${timelineFile.path}`, e);
      return [];
    }
  }

  /**
   * 获取项目的任务统计
   */
  async getTaskStats(projectPath: string): Promise<TaskStats> {
    const tasks = await this.getTasks(projectPath);
    const today = this.getToday();

    let completed = 0;
    let overdue = 0;
    let todayDue = 0;

    for (const task of tasks) {
      if (task.completed) {
        completed++;
      } else {
        if (task.due) {
          if (task.due < today) overdue++;
          if (task.due === today) todayDue++;
        }
      }
    }

    return {
      total: tasks.length,
      completed,
      pending: tasks.length - completed,
      overdue,
      todayDue,
    };
  }

  /**
   * 切换任务完成状态
   * @param projectPath 项目路径
   * @param lineNumber 任务所在行号（0-based）
   * @returns 是否成功
   */
  async toggleTask(projectPath: string, lineNumber: number, expectedRaw?: string): Promise<boolean> {
    const timelineFile = this.findTimelineFile(projectPath);
    if (!timelineFile) return false;

    try {
      const content = await this.app.vault.read(timelineFile);
      const lines = content.split("\n");

      if (lineNumber < 0 || lineNumber >= lines.length) {
        return false;
      }

      const line = lines[lineNumber];
      if (expectedRaw !== undefined && line !== expectedRaw) {
        return false;
      }
      const match = line.match(TASK_REGEX);

      if (!match) return false;

      // 切换状态
      const isCompleted = match[1].toLowerCase() === "x";
      const newStatus = isCompleted ? " " : "x";
      lines[lineNumber] = line.replace(/^- \[[ xX]\]/, `- [${newStatus}]`);

      await this.app.vault.modify(timelineFile, lines.join("\n"));
      return true;
    } catch (e) {
      console.error(`[TaskSync] 切换任务失败: ${projectPath}:${lineNumber}`, e);
      return false;
    }
  }

  /**
   * 添加新任务
   * @param projectPath 项目路径
   * @param text 任务文本
   * @param options 可选参数（截止日期、优先级等）
   * @returns 是否成功
   */
  async addTask(
    projectPath: string,
    text: string,
    options?: {
      due?: string;
      dueTime?: string;
      priority?: TaskPriority;
      created?: string;
      tags?: string[];
    }
  ): Promise<boolean> {
    const timelineFile = this.findTimelineFile(projectPath);
    if (!timelineFile) return false;

    try {
      const content = await this.app.vault.read(timelineFile);
      const lines = content.split("\n");

      // 构造任务行
      let taskLine = `- [ ] ${text}`;

      if (options?.created) {
        taskLine += ` @created(${options.created})`;
      }

      if (options?.due) {
        taskLine += ` @due(${options.due})`;
      }

      if (options?.dueTime) {
        taskLine += ` @time(${options.dueTime})`;
      }

      if (options?.priority) {
        taskLine += ` @priority(${options.priority})`;
      }
      if (options?.tags?.length) {
        taskLine += ` @tags(${options.tags.join(",")})`;
      }

      // 找到合适的插入位置（在第一个任务块的末尾）
      let insertIndex = lines.length;
      let inTaskBlock = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.match(TASK_REGEX)) {
          inTaskBlock = true;
        } else if (inTaskBlock && line === "") {
          insertIndex = i;
          break;
        }
      }

      lines.splice(insertIndex, 0, taskLine);

      await this.app.vault.modify(timelineFile, lines.join("\n"));
      return true;
    } catch (e) {
      console.error(`[TaskSync] 添加任务失败: ${projectPath}`, e);
      return false;
    }
  }

  /**
   * 删除任务
   * @param projectPath 项目路径
   * @param lineNumber 任务所在行号（0-based）
   * @returns 是否成功
   */
  async deleteTask(projectPath: string, lineNumber: number, expectedRaw?: string): Promise<boolean> {
    const timelineFile = this.findTimelineFile(projectPath);
    if (!timelineFile) return false;

    try {
      const content = await this.app.vault.read(timelineFile);
      const lines = content.split("\n");

      if (lineNumber < 0 || lineNumber >= lines.length) {
        return false;
      }
      if (expectedRaw !== undefined && lines[lineNumber] !== expectedRaw) {
        return false;
      }

      lines.splice(lineNumber, 1);

      await this.app.vault.modify(timelineFile, lines.join("\n"));
      return true;
    } catch (e) {
      console.error(`[TaskSync] 删除任务失败: ${projectPath}:${lineNumber}`, e);
      return false;
    }
  }

  /**
   * 解析 Timeline.md 文件内容
   */
  parseTimeline(content: string, projectPath: string): Task[] {
    const tasks: Task[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(TASK_REGEX);

      if (!match) continue;

      const completed = match[1].toLowerCase() === "x";
      let text = match[2].trim();

      // 解析标记
      let created: string | undefined;
      let due: string | undefined;
      let dueTime: string | undefined;
      let priority: TaskPriority | undefined;
      let tags: string[] | undefined;

      // 提取 @created(date)
      const createdMatch = text.match(/@created\(([^)]+)\)/);
      if (createdMatch) {
        created = createdMatch[1];
        text = text.replace(createdMatch[0], "").trim();
      }

      // 提取 @due(date)
      const dueMatch = text.match(/@due\(([^)]+)\)/);
      if (dueMatch) {
        due = dueMatch[1];
        text = text.replace(dueMatch[0], "").trim();
      }

      // 提取 @time(HH:mm)
      const dueTimeMatch = text.match(/@time\(((?:[01]\d|2[0-3]):[0-5]\d)\)/);
      if (dueTimeMatch) {
        dueTime = dueTimeMatch[1];
        text = text.replace(dueTimeMatch[0], "").trim();
      }

      // 提取 @priority(level)
      const priorityMatch = text.match(/@priority\((low|medium|high|urgent)\)/);
      if (priorityMatch) {
        priority = priorityMatch[1] as TaskPriority;
        text = text.replace(priorityMatch[0], "").trim();
      }

      const tagsMatch = text.match(/@tags\(([^)]*)\)/);
      if (tagsMatch) {
        tags = tagsMatch[1].split(",").map((tag) => tag.trim()).filter(Boolean);
        text = text.replace(tagsMatch[0], "").trim();
      }

      tasks.push({
        text,
        completed,
        created,
        due,
        dueTime,
        priority,
        tags,
        line: i,
        raw: line,
        projectPath,
      });
    }

    return tasks;
  }

  /**
   * 获取所有项目的任务（用于主页待办汇总）
   * @param projectPaths 项目路径列表
   * @returns 所有任务列表
   */
  async getAllTasks(projectPaths: string[]): Promise<Task[]> {
    const taskGroups = await Promise.all(projectPaths.map((projectPath) => this.getTasks(projectPath)));
    return taskGroups.flat();
  }

  /**
   * 过滤今天截止的任务
   */
  filterTodayDue(tasks: Task[]): Task[] {
    const today = this.getToday();
    return tasks.filter((t) => !t.completed && t.due === today);
  }

  /**
   * 过滤本周截止的任务
   */
  filterWeekDue(tasks: Task[]): Task[] {
    const today = new Date();
    const todayDate = this.formatDate(today);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
    const endDate = this.formatDate(endOfWeek);

    return tasks.filter((t) => !t.completed && t.due && t.due >= todayDate && t.due <= endDate);
  }

  /**
   * 过滤逾期任务
   */
  filterOverdue(tasks: Task[]): Task[] {
    const today = this.getToday();
    return tasks.filter((t) => !t.completed && t.due && t.due < today);
  }

  /**
   * 按优先级排序
   */
  sortByPriority(tasks: Task[]): Task[] {
    const priorityOrder: Record<TaskPriority, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return tasks.sort((a, b) => {
      const aPriority = a.priority || "medium";
      const bPriority = b.priority || "medium";
      return priorityOrder[aPriority] - priorityOrder[bPriority];
    });
  }

  /**
   * 按截止日期排序
   */
  sortByDue(tasks: Task[]): Task[] {
    return tasks.sort((a, b) => {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      const dateOrder = a.due.localeCompare(b.due);
      if (dateOrder !== 0) return dateOrder;
      return (a.dueTime || "23:59").localeCompare(b.dueTime || "23:59");
    });
  }

  // ══════════════════════════════════════════════════════════
  // 私有方法
  // ══════════════════════════════════════════════════════════

  /** 查找项目的 Timeline.md 文件 */
  private findTimelineFile(projectPath: string): TFile | null {
    return findProjectTimelineFile(this.app, projectPath);
  }

  private getToday(): string {
    return this.formatDate(new Date());
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}
