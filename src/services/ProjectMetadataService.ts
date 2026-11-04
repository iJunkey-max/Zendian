import { changeProjectStage } from "../homepage/services/project-stage";
import { createDefaultConsoleData } from "../homepage/services/project-factory";
import { loadProjectHome, mutateProjectHome } from "../homepage/services/ProjectHomeStore";
/**
 * ProjectMetadataService — 项目元数据读写服务
 *
 * 功能：
 * - 读取和更新 .home 文件的完整结构
 * - 管理项目状态、优先级、标签、里程碑
 * - 提供类型安全的 API
 *
 * 数据来源：新项目根目录 `项目主页.home`；兼容并迁移旧项目控制台文件
 */

import { App, TFile, TFolder } from "obsidian";
import { findProjectHomeFile, PROJECT_HOME_FILENAME } from "../homepage/services/ProjectHomeFileResolver";
import {
  normalizeProjectStatus,
  normalizeStatusBeforePause,
  type ProjectStatus,
  type ProjectStatusHistoryEntry,
  type ResumableProjectStatus,
} from "../homepage/project-status";
import type { ProjectConsoleMilestone } from "../homepage/types";

export type { ProjectStatus } from "../homepage/project-status";

/** 项目优先级 */
export type ProjectPriority = "low" | "medium" | "high" | "urgent";

/** 用户可配置的项目类型 */
export type ProjectType = string;

/** 里程碑 */
export interface Milestone {
  id: string;
  title: string;
  deadline: string;              // YYYY-MM-DD
  completed: boolean;
  deliverables: string[];        // 关联的交付物路径（相对于项目根目录）
  createdAt: string;
}

/** 项目元数据 */
export interface ProjectMetadata {
  priority: ProjectPriority;
  deadline?: string;             // YYYY-MM-DD
  tags: string[];
  collaborators: string[];
  dependencies: string[];        // 其他项目的路径
  estimatedHours?: number;
  actualHours?: number;
}

/** 视图配置 */
export interface ViewConfig {
  pinnedFiles: string[];         // 置顶文件路径
  hiddenFolders: string[];       // 隐藏的子文件夹
  customSections: Array<{
    id: string;
    label: string;
    query: string;               // 文件筛选规则
  }>;
}

/** 交付物 */
export interface Deliverable {
  name: string;
  path: string;
  status: "pending" | "in-progress" | "done";
}

/** 完整的 .home 文件结构 */
export interface ProjectHomeData {
  // ── 基础信息 ──
  name: string;
  icon: string;
  description: string;
  type: ProjectType;
  status: ProjectStatus;
  statusBeforePause?: ResumableProjectStatus;
  statusHistory: ProjectStatusHistoryEntry[];
  createdAt: string;             // YYYY-MM-DD
  updatedAt?: string;            // 自动更新

  // ── 项目元数据 ──
  metadata: ProjectMetadata;

  // ── 视图配置 ──
  viewConfig: ViewConfig;

  // ── 里程碑 ──
  milestones: Milestone[];

  // ── 交付物 ──
  deliverables: Deliverable[];

  // ── 统一项目主页数据 ──
  tasks: any[];
  overview?: { markdown: string; migratedAt?: string };
  timeline?: { milestones: any[]; legacyMarkdown?: string; migratedAt?: string };
}

/** 默认元数据 */
const DEFAULT_METADATA: ProjectMetadata = {
  priority: "medium",
  tags: [],
  collaborators: [],
  dependencies: [],
};

/** 默认视图配置 */
const DEFAULT_VIEW_CONFIG: ViewConfig = {
  pinnedFiles: [],
  hiddenFolders: [],
  customSections: [],
};

export class ProjectMetadataService {
  constructor(private app: App) {}

  /**
   * 读取项目完整元数据
   * @param projectPath 项目根目录路径
   * @returns 项目元数据，如果不存在或解析失败返回 null
   */
  async getMetadata(projectPath: string): Promise<ProjectHomeData | null> {
    try {
      // Reuse the guarded project store so metadata reads observe the same
      // identity, structure and legacy migration rules as every other caller.
      // A malformed .home is rejected instead of being silently replaced by
      // default metadata and later overwritten by an edit.
      const record = await loadProjectHome(this.app, projectPath);
      return record ? this.ensureDefaults(record.data as Partial<ProjectHomeData>) : null;
    } catch (e) {
      console.error(`[ProjectMetadata] 解析失败: ${projectPath}`, e);
      return null;
    }
  }

  /**
   * 更新项目状态
   */
  async updateStatus(projectPath: string, status: ProjectStatus): Promise<void> {
    const saved = await mutateProjectHome(this.app, projectPath, data => changeProjectStage(data, status));
    if (!saved) throw new Error("项目阶段更新失败，请刷新重试");
  }

  /** 更新项目类型，用于分类文件夹改名后的元数据同步。 */
  async updateType(projectPath: string, type: ProjectType): Promise<void> {
    const saved = await mutateProjectHome(this.app, projectPath, data => {
      data.type = type;
      data.updatedAt = this.getToday();
    });
    if (!saved) throw new Error("项目分类更新失败，请刷新重试");
  }

  /**
   * 更新项目优先级
   */
  async updatePriority(projectPath: string, priority: ProjectPriority): Promise<void> {
    return this.mutateMetadata(projectPath, data => {
      data.metadata.priority = priority;
      data.updatedAt = this.getToday();
    });
  }

  /**
   * 设置项目标签
   */
  async setTags(projectPath: string, tags: string[]): Promise<void> {
    return this.mutateMetadata(projectPath, data => {
      data.metadata.tags = tags;
      data.updatedAt = this.getToday();
    });
  }

  /**
   * 添加标签
   */
  async addTag(projectPath: string, tag: string): Promise<void> {
    return this.mutateMetadata(projectPath, data => {
      if (!data.metadata.tags.includes(tag)) {
        data.metadata.tags.push(tag);
        data.updatedAt = this.getToday();
      }
    });
  }

  /**
   * 移除标签
   */
  async removeTag(projectPath: string, tag: string): Promise<void> {
    return this.mutateMetadata(projectPath, data => {
      data.metadata.tags = data.metadata.tags.filter((t) => t !== tag);
      data.updatedAt = this.getToday();
    });
  }

  /**
   * 添加里程碑
   */
  async addMilestone(
    projectPath: string,
    title: string,
    deadline: string,
    deliverables: string[] = []
  ): Promise<Milestone> {
    return this.mutateMetadata(projectPath, data => {
      const milestone: Milestone = {
        id: this.generateId(),
        title,
        deadline,
        completed: false,
        deliverables,
        createdAt: this.getToday(),
      };
      const timeline = data.timeline || (data.timeline = { milestones: [] });
      timeline.milestones.push(this.toCanonicalMilestone(milestone));
      data.updatedAt = this.getToday();

      return milestone;
    });
  }

  /**
   * 更新里程碑
   */
  async updateMilestone(
    projectPath: string,
    milestoneId: string,
    updates: Partial<Omit<Milestone, "id" | "createdAt">>
  ): Promise<void> {
    return this.mutateMetadata(projectPath, data => {
      const milestone = data.timeline?.milestones.find((m) => m.id === milestoneId);
      if (!milestone) throw new Error("里程碑不存在");
      if (updates.title !== undefined) milestone.name = updates.title;
      if (updates.deadline !== undefined) milestone.date = updates.deadline;
      if (updates.completed !== undefined) {
        milestone.completed = updates.completed;
        milestone.progress = updates.completed ? 100 : Math.min(milestone.progress || 0, 99);
      }
      if (updates.deliverables !== undefined) milestone.deliverables = [...updates.deliverables];
      data.updatedAt = this.getToday();
    });
  }

  /**
   * 删除里程碑
   */
  async deleteMilestone(projectPath: string, milestoneId: string): Promise<void> {
    return this.mutateMetadata(projectPath, data => {
      if (data.timeline) data.timeline.milestones = data.timeline.milestones.filter((m) => m.id !== milestoneId);
      data.updatedAt = this.getToday();
    });
  }

  /**
   * 添加交付物
   */
  async addDeliverable(
    projectPath: string,
    name: string,
    path: string,
    status: "pending" | "in-progress" | "done" = "pending"
  ): Promise<void> {
    return this.mutateMetadata(projectPath, data => {
      data.deliverables.push({ name, path, status });
      data.updatedAt = this.getToday();
    });
  }

  /**
   * 更新交付物状态
   */
  async updateDeliverableStatus(
    projectPath: string,
    deliverablePath: string,
    status: "pending" | "in-progress" | "done"
  ): Promise<void> {
    return this.mutateMetadata(projectPath, data => {
      const deliverable = data.deliverables.find((d) => d.path === deliverablePath);
      if (!deliverable) throw new Error("交付物不存在");

      deliverable.status = status;
      data.updatedAt = this.getToday();
    });
  }

  /**
   * 删除交付物
   */
  async deleteDeliverable(projectPath: string, deliverablePath: string): Promise<void> {
    return this.mutateMetadata(projectPath, data => {
      data.deliverables = data.deliverables.filter((d) => d.path !== deliverablePath);
      data.updatedAt = this.getToday();
    });
  }

  /**
   * 更新项目描述
   */
  async updateDescription(projectPath: string, description: string): Promise<void> {
    return this.mutateMetadata(projectPath, data => {
      data.description = description;
      data.updatedAt = this.getToday();
    });
  }

  /**
   * 创建新项目的 .home 文件
   */
  async createProject(
    projectPath: string,
    name: string,
    type: ProjectType,
    icon: string = "lucide-folder",
    description: string = ""
  ): Promise<ProjectHomeData> {
    const data: ProjectHomeData = {
      ...createDefaultConsoleData(name, icon, type, description),
      name,
      icon,
      description,
      type,
      status: "planning",
      statusBeforePause: undefined,
      statusHistory: [],
      createdAt: this.getToday(),
      updatedAt: this.getToday(),
      metadata: { ...DEFAULT_METADATA },
      viewConfig: { ...DEFAULT_VIEW_CONFIG },
      milestones: [],
      deliverables: [],
      tasks: [],
    };

    await this.save(projectPath, data);
    return data;
  }

  // ══════════════════════════════════════════════════════════
  // 私有方法
  // ══════════════════════════════════════════════════════════

  private async mutateMetadata<T>(projectPath: string, operation: (data: ProjectHomeData) => T): Promise<T> {
    let result!: T;
    const saved = await mutateProjectHome(this.app, projectPath, latest => {
      const normalized = this.ensureDefaults(latest as unknown as Partial<ProjectHomeData>);
      const editable = JSON.parse(JSON.stringify(normalized)) as ProjectHomeData;
      result = operation(editable);
      // Milestones are now persisted only in the canonical timeline shape.
      // Keep the legacy field as an in-memory API compatibility view, never as a second source of truth.
      delete (editable as Partial<ProjectHomeData> & { milestones?: unknown }).milestones;
      const target = latest as unknown as Record<string, unknown>;
      for (const key of Object.keys(editable) as Array<keyof ProjectHomeData>) {
        if (JSON.stringify(editable[key]) !== JSON.stringify(normalized[key])) target[key] = editable[key];
      }
    });
    if (!saved) throw new Error("项目更新失败，请刷新重试");
    return result;
  }

  /** 查找项目的 .home 文件 */
  private findHomeFile(projectPath: string): TFile | null {
    return findProjectHomeFile(this.app, projectPath);
  }

  /** 保存 .home 文件 */
  private async save(projectPath: string, data: ProjectHomeData): Promise<void> {
    const root = this.app.vault.getAbstractFileByPath(projectPath);
    if (!(root instanceof TFolder)) throw new Error("项目目录不存在");
    const legacy = this.app.vault.getAbstractFileByPath(`${projectPath}/00 控制台`);
    if ([root, legacy].some(folder => folder instanceof TFolder && folder.children.some(file => file instanceof TFile && file.extension === "home"))) throw new Error("项目主页已存在，创建操作未覆盖原内容");
    const homeFile = this.findHomeFile(projectPath);
    if (!homeFile) {
      // 创建新文件
      const filePath = `${projectPath}/${PROJECT_HOME_FILENAME}`;
      await this.app.vault.create(filePath, JSON.stringify(data, null, 2));
    } else {
      throw new Error("项目主页已存在，创建操作未覆盖原内容");
    }
  }

  /** 补齐缺失字段 */
  private ensureDefaults(data: Partial<ProjectHomeData>): ProjectHomeData {
    return {
      ...data,
      name: data.name || "未命名项目",
      icon: data.icon || "lucide-folder",
      description: data.description || "",
      type: data.type || "未分类",
      status: normalizeProjectStatus(data.status),
      statusBeforePause: normalizeStatusBeforePause(data.statusBeforePause),
      statusHistory: Array.isArray(data.statusHistory)
        ? data.statusHistory.map((entry) => ({
            ...entry,
            from: normalizeProjectStatus(entry.from),
            to: normalizeProjectStatus(entry.to),
          }))
        : [],
      createdAt: data.createdAt || this.getToday(),
      updatedAt: data.updatedAt,
      metadata: {
        ...DEFAULT_METADATA,
        ...data.metadata,
      },
      viewConfig: {
        ...DEFAULT_VIEW_CONFIG,
        ...data.viewConfig,
      },
      milestones: this.readMilestones(data),
      deliverables: data.deliverables || [],
      tasks: data.tasks || [],
      overview: data.overview,
      timeline: data.timeline,
    };
  }

  private readMilestones(data: Partial<ProjectHomeData>): Milestone[] {
    if (Array.isArray(data.timeline?.milestones)) {
      return data.timeline.milestones.map((item) => this.toLegacyMilestone(item));
    }
    return Array.isArray(data.milestones) ? data.milestones : [];
  }

  private toCanonicalMilestone(milestone: Milestone): ProjectConsoleMilestone & { deliverables?: string[]; createdAt?: string } {
    return {
      id: milestone.id,
      name: milestone.title,
      date: milestone.deadline,
      progress: milestone.completed ? 100 : 0,
      completed: milestone.completed,
      deliverables: [...milestone.deliverables],
      createdAt: milestone.createdAt,
    };
  }

  private toLegacyMilestone(milestone: ProjectConsoleMilestone & { deliverables?: string[]; createdAt?: string }): Milestone {
    return {
      id: milestone.id,
      title: milestone.name,
      deadline: milestone.date,
      completed: milestone.completed,
      deliverables: Array.isArray(milestone.deliverables) ? [...milestone.deliverables] : [],
      createdAt: milestone.createdAt || this.getToday(),
    };
  }

  private getToday(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
