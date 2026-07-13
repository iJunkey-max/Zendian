/**
 * TaskSyncService — 项目主页结构化待办服务
 *
 * 任务只读写 `项目主页.home` 的 tasks 数组。旧 Timeline.md 会在首次读取时
 * 由 ProjectHomeStore 安全迁入项目主页，之后不再扫描项目 Markdown 文件。
 */

import { App } from "obsidian";
import type { ProjectConsoleTask, TaskPriority as HomeTaskPriority } from "../homepage/types";
import { loadProjectHome, saveProjectHome } from "../homepage/services/ProjectHomeStore";
import type { ActivityLogService } from "./ActivityLogService";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  created?: string;
  due?: string;
  dueTime?: string;
  priority?: TaskPriority;
  tags?: string[];
  completedAt?: string;
  line: number;                  // tasks 数组索引，保留旧调用接口
  raw: string;                   // 稳定任务 ID，用于并发校验
  projectPath: string;
}

export interface TaskStats {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  todayDue: number;
}

const TO_STORAGE_PRIORITY: Record<TaskPriority, HomeTaskPriority> = {
  urgent: "P0",
  high: "P1",
  medium: "P2",
  low: "P3",
};

const FROM_STORAGE_PRIORITY: Record<HomeTaskPriority, TaskPriority> = {
  P0: "urgent",
  P1: "high",
  P2: "medium",
  P3: "low",
};

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export class TaskSyncService {
  constructor(private app: App, private activityLog?: ActivityLogService) {}

  async getTasks(projectPath: string): Promise<Task[]> {
    const record = await loadProjectHome(this.app, projectPath);
    if (!record) return [];
    return record.data.tasks.map((task, index) => this.toTask(task, index, projectPath));
  }

  async getTaskStats(projectPath: string): Promise<TaskStats> {
    const tasks = await this.getTasks(projectPath);
    const today = this.getToday();
    const completed = tasks.filter((task) => task.completed).length;
    return {
      total: tasks.length,
      completed,
      pending: tasks.length - completed,
      overdue: tasks.filter((task) => !task.completed && task.due && task.due < today).length,
      todayDue: tasks.filter((task) => !task.completed && task.due === today).length,
    };
  }

  async toggleTask(projectPath: string, lineNumber: number, expectedRaw?: string): Promise<boolean> {
    const record = await loadProjectHome(this.app, projectPath);
    if (!record) return false;
    const index = this.resolveTaskIndex(record.data.tasks, lineNumber, expectedRaw);
    if (index < 0) return false;
    const task = record.data.tasks[index];
    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : undefined;
    task.updatedAt = new Date().toISOString();
    const saved = await saveProjectHome(this.app, projectPath, record.data);
    if (saved && task.completed) this.activityLog?.logActivity("task_completed", projectPath, { taskId: task.id });
    return saved;
  }

  async addTask(
    projectPath: string,
    text: string,
    options?: {
      due?: string;
      dueTime?: string;
      priority?: TaskPriority;
      created?: string;
      tags?: string[];
    },
  ): Promise<boolean> {
    const cleanText = text.trim();
    if (!cleanText) return false;
    const record = await loadProjectHome(this.app, projectPath);
    if (!record) return false;
    const now = new Date();
    const task: ProjectConsoleTask = {
      id: `task-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      text: cleanText,
      completed: false,
      created: options?.created || now.toISOString().slice(0, 10),
      due: options?.due,
      dueTime: options?.dueTime,
      priority: options?.priority ? TO_STORAGE_PRIORITY[options.priority] : "P2",
      tags: options?.tags?.map((tag) => tag.trim()).filter(Boolean),
      updatedAt: now.toISOString(),
    };
    record.data.tasks.push(task);
    record.data.updatedAt = now.toISOString().slice(0, 10);
    return saveProjectHome(this.app, projectPath, record.data);
  }

  async deleteTask(projectPath: string, lineNumber: number, expectedRaw?: string): Promise<boolean> {
    const record = await loadProjectHome(this.app, projectPath);
    if (!record) return false;
    const index = this.resolveTaskIndex(record.data.tasks, lineNumber, expectedRaw);
    if (index < 0) return false;
    record.data.tasks.splice(index, 1);
    record.data.updatedAt = new Date().toISOString().slice(0, 10);
    return saveProjectHome(this.app, projectPath, record.data);
  }

  async getAllTasks(projectPaths: string[]): Promise<Task[]> {
    return (await Promise.all(projectPaths.map((path) => this.getTasks(path)))).flat();
  }

  filterTodayDue(tasks: Task[]): Task[] {
    const today = this.getToday();
    return tasks.filter((task) => !task.completed && task.due === today);
  }

  filterWeekDue(tasks: Task[]): Task[] {
    const today = new Date();
    const startDate = this.formatDate(today);
    const end = new Date(today);
    end.setDate(today.getDate() + (7 - today.getDay()));
    const endDate = this.formatDate(end);
    return tasks.filter((task) => !task.completed && task.due && task.due >= startDate && task.due <= endDate);
  }

  filterOverdue(tasks: Task[]): Task[] {
    const today = this.getToday();
    return tasks.filter((task) => !task.completed && task.due && task.due < today);
  }

  /** 紧急程度优先；同级按截止时间；同级且无截止时间时按创建时间。 */
  sortTasks(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => {
      const priorityOrder = PRIORITY_ORDER[a.priority || "medium"] - PRIORITY_ORDER[b.priority || "medium"];
      if (priorityOrder !== 0) return priorityOrder;
      if (a.due && b.due) {
        const dueOrder = `${a.due}T${a.dueTime || "23:59"}`.localeCompare(`${b.due}T${b.dueTime || "23:59"}`);
        if (dueOrder !== 0) return dueOrder;
      } else if (a.due || b.due) {
        return a.due ? -1 : 1;
      }
      return (a.created || "").localeCompare(b.created || "") || a.text.localeCompare(b.text);
    });
  }

  sortByPriority(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) =>
      PRIORITY_ORDER[a.priority || "medium"] - PRIORITY_ORDER[b.priority || "medium"],
    );
  }

  sortByDue(tasks: Task[]): Task[] {
    return this.sortTasks(tasks);
  }

  private toTask(task: ProjectConsoleTask, index: number, projectPath: string): Task {
    const id = task.id || `task-${index}`;
    return {
      id,
      text: task.text,
      completed: Boolean(task.completed),
      created: task.created,
      due: task.due,
      dueTime: task.dueTime,
      priority: task.priority ? FROM_STORAGE_PRIORITY[task.priority] : undefined,
      tags: task.tags,
      completedAt: task.completedAt,
      line: index,
      raw: id,
      projectPath,
    };
  }

  private resolveTaskIndex(tasks: ProjectConsoleTask[], fallbackIndex: number, expectedId?: string): number {
    if (expectedId) return tasks.findIndex((task) => task.id === expectedId);
    return fallbackIndex >= 0 && fallbackIndex < tasks.length ? fallbackIndex : -1;
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
