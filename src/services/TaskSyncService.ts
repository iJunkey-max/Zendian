/**
 * TaskSyncService — 项目主页结构化待办服务
 *
 * 任务只读写 `项目主页.home` 的 tasks 数组。旧 Timeline.md 会在首次读取时
 * 由 ProjectHomeStore 安全迁入项目主页，之后不再扫描项目 Markdown 文件。
 */

import { App, TFile } from "obsidian";
import type { ProjectConsoleTask, TaskPriority as HomeTaskPriority } from "../homepage/types";
import { loadProjectHome, mutateProjectHome } from "../homepage/services/ProjectHomeStore";
import { ProjectRegistry } from "../homepage/services/ProjectRegistry";
import type { ActivityLogService } from "./ActivityLogService";

export function isTaskScheduleValid(due?: string, time?: string): boolean {
  if (time && (!due || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))) return false;
  if (!due) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return false;
  const date = new Date(`${due}T12:00:00`);
  return Number.isFinite(date.getTime()) && date.getFullYear() === Number(due.slice(0, 4)) && date.getMonth() + 1 === Number(due.slice(5, 7)) && date.getDate() === Number(due.slice(8, 10));
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * “本周”采用今天至本周日（含首尾）的产品语义；周日的结束日仍是当天，
 * 不会因为 getDay() 为 0 而错误地延伸到下一周。
 */
export function getWeekDueRange(referenceDate = new Date()): { startDate: string; endDate: string } {
  const end = new Date(referenceDate);
  end.setDate(end.getDate() + ((7 - end.getDay()) % 7));
  return { startDate: formatLocalDate(referenceDate), endDate: formatLocalDate(end) };
}

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  projectId?: string | null;
  linkedFile?: string;
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
    return record.data.tasks.map((task, index) => this.toTask(task, index, projectPath, record.data.projectId ?? null));
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

  async toggleTask(projectPath: string, lineNumber: number, expectedRaw?: string, expectedCompleted?: boolean, expectedProjectId?: string | null): Promise<boolean> {
    let completedTaskId: string | null = null;
    const saved = await mutateProjectHome(this.app, projectPath, (data) => {
      if (expectedProjectId !== undefined && (data.projectId ?? null) !== expectedProjectId) return false;
      const index = this.resolveTaskIndex(data.tasks, lineNumber, expectedRaw);
      if (index < 0) return false;
      const task = data.tasks[index];
      if (expectedCompleted !== undefined && task.completed !== expectedCompleted) return false;
      task.completed = !task.completed;
      task.completedAt = task.completed ? new Date().toISOString() : undefined;
      task.updatedAt = new Date().toISOString();
      (data.activity ??= []).push({ id: globalThis.crypto.randomUUID(), kind: task.completed ? "task-completed" : "task-reopened", taskId: task.id!, text: task.text, timestamp: task.updatedAt });
      if (task.completed) completedTaskId = task.id ?? expectedRaw ?? null;
    });
    if (saved && completedTaskId) {
      this.activityLog?.logActivity("task_completed", projectPath, { taskId: completedTaskId });
    }
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
      expectedProjectId?: string | null;
    },
  ): Promise<boolean> {
    const cleanText = text.trim();
    if (!cleanText || !isTaskScheduleValid(options?.due, options?.dueTime)) return false;
    const now = new Date();
    const task: ProjectConsoleTask = {
      id: `task-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      text: cleanText,
      completed: false,
      created: options?.created || this.formatDate(now),
      due: options?.due,
      dueTime: options?.dueTime,
      priority: options?.priority ? TO_STORAGE_PRIORITY[options.priority] : "P2",
      tags: options?.tags?.map((tag) => tag.trim()).filter(Boolean),
      updatedAt: now.toISOString(),
    };
    return mutateProjectHome(this.app, projectPath, (data) => {
      if (options?.expectedProjectId !== undefined && (data.projectId ?? null) !== options.expectedProjectId) return false;
      data.tasks.push(task);
      (data.activity ??= []).push({ id: globalThis.crypto.randomUUID(), kind: "task-created", taskId: task.id!, text: task.text, timestamp: now.toISOString() });
      data.updatedAt = this.formatDate(now);
    });
  }

  async deleteTask(projectPath: string, lineNumber: number, expectedRaw?: string, expectedProjectId?: string | null): Promise<boolean> {
    return mutateProjectHome(this.app, projectPath, (data) => {
      if (expectedProjectId !== undefined && (data.projectId ?? null) !== expectedProjectId) return false;
      const index = this.resolveTaskIndex(data.tasks, lineNumber, expectedRaw);
      if (index < 0) return false;
      const [task] = data.tasks.splice(index, 1);
      (data.activity ??= []).push({ id: globalThis.crypto.randomUUID(), kind: "task-deleted", taskId: task.id!, text: task.text, timestamp: new Date().toISOString() });
      data.updatedAt = this.getToday();
    });
  }

  async updateTask(projectPath: string, id: string, updates: { text: string; due?: string; dueTime?: string; priority?: TaskPriority; tags?: string[]; linkedFile?: string }, expected?: Task): Promise<boolean> {
    if (!updates.text.trim() || !isTaskScheduleValid(updates.due, updates.dueTime)) return false;
    const linked = updates.linkedFile?.trim();
    if (linked && (linked.startsWith("/") || /[\\:]/.test(linked) || linked.split("/").some(part => !part || part === ".." || part === "."))) return false;
    return mutateProjectHome(this.app, projectPath, data => {
      if (expected?.projectId !== undefined && (data.projectId ?? null) !== expected.projectId) return false;
      const task = data.tasks.find(task => task.id === id);
      if (!task) return false;
      // A missing existing attachment must not prevent editing the task itself.
      if (linked && linked !== task.linkedFile && !(this.app.vault.getAbstractFileByPath(projectPath + "/" + linked) instanceof TFile)) return false;
      if (expected) {
        const current = this.toTask(task, 0, projectPath);
        const editable = (value: Task) => JSON.stringify([value.text, value.due || "", value.dueTime || "", value.priority || "medium", value.linkedFile || "", value.tags || []]);
        if (editable(current) !== editable(expected)) return false;
      }
      task.text = updates.text.trim();
      task.linkedFile = linked || undefined;
      task.due = updates.due || undefined;
      task.dueTime = updates.dueTime || undefined;
      task.priority = updates.priority ? TO_STORAGE_PRIORITY[updates.priority] : "P2";
      task.tags = [...new Set(updates.tags?.map(tag => tag.trim()).filter(Boolean) || [])];
      task.updatedAt = new Date().toISOString();
      (data.activity ??= []).push({ id: globalThis.crypto.randomUUID(), kind: "task-updated", taskId: task.id!, text: task.text, timestamp: task.updatedAt });
      data.updatedAt = this.getToday();
    });
  }

  async restoreTask(task: Task): Promise<boolean> {
    const projectPath = await this.resolveCurrentProjectPath(task);
    if (!projectPath) return false;
    return mutateProjectHome(this.app, projectPath, data => {
      if (task.projectId !== undefined && (data.projectId ?? null) !== task.projectId) return false;
      if (data.tasks.some(existing => existing.id === task.id)) return false;
      const restored = { id: task.id, text: task.text, linkedFile: task.linkedFile, completed: task.completed, completedAt: task.completedAt, created: task.created, due: task.due, dueTime: task.dueTime, priority: task.priority ? TO_STORAGE_PRIORITY[task.priority] : "P2", tags: task.tags, updatedAt: new Date().toISOString() };
      // Keep the user's original task order when the snapshot still carries a
      // usable index; an externally changed list may have shrunk, so clamp
      // rather than refusing a safe restore.
      const restoreIndex = Math.min(Math.max(Number.isInteger(task.line) ? task.line : data.tasks.length, 0), data.tasks.length);
      data.tasks.splice(restoreIndex, 0, restored);
      (data.activity ??= []).push({ id: globalThis.crypto.randomUUID(), kind: "task-restored", taskId: task.id, text: task.text, timestamp: new Date().toISOString() });
    });
  }

  async getAllTasks(projectPaths: string[]): Promise<Task[]> {
    return (await Promise.all(projectPaths.map((path) => this.getTasks(path)))).flat();
  }

  filterTodayDue(tasks: Task[]): Task[] {
    const today = this.getToday();
    return tasks.filter((task) => !task.completed && task.due === today);
  }

  filterWeekDue(tasks: Task[]): Task[] {
    const { startDate, endDate } = getWeekDueRange(new Date());
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

  private toTask(task: ProjectConsoleTask, index: number, projectPath: string, projectId?: string | null): Task {
    const id = task.id || `task-${index}`;
    return {
      id,
      text: task.text,
      linkedFile: task.linkedFile,
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
      projectId,
    };
  }

  private resolveTaskIndex(tasks: ProjectConsoleTask[], fallbackIndex: number, expectedId?: string): number {
    if (expectedId) return tasks.findIndex((task) => task.id === expectedId);
    return fallbackIndex >= 0 && fallbackIndex < tasks.length ? fallbackIndex : -1;
  }

  /**
   * Undo may be clicked after the project was moved while Obsidian was closed.
   * Resolve by stable identity before writing; never fall back to an occupied
   * stale path when the identity is present but ambiguous or missing.
   */
  private async resolveCurrentProjectPath(task: Task): Promise<string | null> {
    if (typeof task.projectId !== "string" || !task.projectId.trim()) return task.projectPath;
    if (typeof this.app.vault.getFiles !== "function") return task.projectPath;
    try {
      const result = await new ProjectRegistry(this.app).discover();
      const matches = result.projects.filter((project) => project.projectId === task.projectId && project.state === "ready");
      return matches.length === 1 ? matches[0].folderPath : null;
    } catch (error) {
      console.error("[TaskSyncService] 无法按身份定位撤销目标", error);
      return null;
    }
  }

  private getToday(): string {
    return this.formatDate(new Date());
  }

  private formatDate(date: Date): string {
    return formatLocalDate(date);
  }
}
