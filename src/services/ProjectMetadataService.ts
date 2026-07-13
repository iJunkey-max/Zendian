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

import { App, TFile } from "obsidian";
import { findProjectHomeFile, PROJECT_HOME_FILENAME } from "../homepage/services/ProjectHomeFileResolver";
import {
  normalizeProjectStatus,
  normalizeStatusBeforePause,
  type ProjectStatus,
  type ProjectStatusHistoryEntry,
  type ResumableProjectStatus,
} from "../homepage/project-status";

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
    const homeFile = this.findHomeFile(projectPath);
    if (!homeFile) return null;

    try {
      const content = await this.app.vault.read(homeFile);
      const data = JSON.parse(content) as Partial<ProjectHomeData>;

      // 补齐缺失字段
      return this.ensureDefaults(data);
    } catch (e) {
      console.error(`[ProjectMetadata] 解析失败: ${homeFile.path}`, e);
      return null;
    }
  }

  /**
   * 更新项目状态
   */
  async updateStatus(projectPath: string, status: ProjectStatus): Promise<void> {
    const data = await this.getMetadata(projectPath);
    if (!data) throw new Error("项目元数据不存在");

    const previousStatus = normalizeProjectStatus(data.status);
    if (previousStatus === status) return;

    if (status === "paused" && previousStatus !== "paused") {
      data.statusBeforePause = previousStatus;
    } else if (status !== "paused") {
      data.statusBeforePause = undefined;
    }

    data.status = status;
    data.updatedAt = this.getToday();
    data.statusHistory.push({
      from: previousStatus,
      to: status,
      changedAt: new Date().toISOString(),
    });

    await this.save(projectPath, data);
  }

  /** 更新项目类型，用于分类文件夹改名后的元数据同步。 */
  async updateType(projectPath: string, type: ProjectType): Promise<void> {
    const data = await this.getMetadata(projectPath);
    if (!data) throw new Error("项目元数据不存在");

    data.type = type;
    data.updatedAt = this.getToday();

    await this.save(projectPath, data);
  }

  /**
   * 更新项目优先级
   */
  async updatePriority(projectPath: string, priority: ProjectPriority): Promise<void> {
    const data = await this.getMetadata(projectPath);
    if (!data) throw new Error("项目元数据不存在");

    data.metadata.priority = priority;
    data.updatedAt = this.getToday();

    await this.save(projectPath, data);
  }

  /**
   * 设置项目标签
   */
  async setTags(projectPath: string, tags: string[]): Promise<void> {
    const data = await this.getMetadata(projectPath);
    if (!data) throw new Error("项目元数据不存在");

    data.metadata.tags = tags;
    data.updatedAt = this.getToday();

    await this.save(projectPath, data);
  }

  /**
   * 添加标签
   */
  async addTag(projectPath: string, tag: string): Promise<void> {
    const data = await this.getMetadata(projectPath);
    if (!data) throw new Error("项目元数据不存在");

    if (!data.metadata.tags.includes(tag)) {
      data.metadata.tags.push(tag);
      data.updatedAt = this.getToday();
      await this.save(projectPath, data);
    }
  }

  /**
   * 移除标签
   */
  async removeTag(projectPath: string, tag: string): Promise<void> {
    const data = await this.getMetadata(projectPath);
    if (!data) throw new Error("项目元数据不存在");

    data.metadata.tags = data.metadata.tags.filter((t) => t !== tag);
    data.updatedAt = this.getToday();

    await this.save(projectPath, data);
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
    const data = await this.getMetadata(projectPath);
    if (!data) throw new Error("项目元数据不存在");

    const milestone: Milestone = {
      id: this.generateId(),
      title,
      deadline,
      completed: false,
      deliverables,
      createdAt: this.getToday(),
    };

    data.milestones.push(milestone);
    data.updatedAt = this.getToday();

    await this.save(projectPath, data);
    return milestone;
  }

  /**
   * 更新里程碑
   */
  async updateMilestone(
    projectPath: string,
    milestoneId: string,
    updates: Partial<Omit<Milestone, "id" | "createdAt">>
  ): Promise<void> {
    const data = await this.getMetadata(projectPath);
    if (!data) throw new Error("项目元数据不存在");

    const milestone = data.milestones.find((m) => m.id === milestoneId);
    if (!milestone) throw new Error("里程碑不存在");

    Object.assign(milestone, updates);
    data.updatedAt = this.getToday();

    await this.save(projectPath, data);
  }

  /**
   * 删除里程碑
   */
  async deleteMilestone(projectPath: string, milestoneId: string): Promise<void> {
    const data = await this.getMetadata(projectPath);
    if (!data) throw new Error("项目元数据不存在");

    data.milestones = data.milestones.filter((m) => m.id !== milestoneId);
    data.updatedAt = this.getToday();

    await this.save(projectPath, data);
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
    const data = await this.getMetadata(projectPath);
    if (!data) throw new Error("项目元数据不存在");

    data.deliverables.push({ name, path, status });
    data.updatedAt = this.getToday();

    await this.save(projectPath, data);
  }

  /**
   * 更新交付物状态
   */
  async updateDeliverableStatus(
    projectPath: string,
    deliverablePath: string,
    status: "pending" | "in-progress" | "done"
  ): Promise<void> {
    const data = await this.getMetadata(projectPath);
    if (!data) throw new Error("项目元数据不存在");

    const deliverable = data.deliverables.find((d) => d.path === deliverablePath);
    if (!deliverable) throw new Error("交付物不存在");

    deliverable.status = status;
    data.updatedAt = this.getToday();

    await this.save(projectPath, data);
  }

  /**
   * 删除交付物
   */
  async deleteDeliverable(projectPath: string, deliverablePath: string): Promise<void> {
    const data = await this.getMetadata(projectPath);
    if (!data) throw new Error("项目元数据不存在");

    data.deliverables = data.deliverables.filter((d) => d.path !== deliverablePath);
    data.updatedAt = this.getToday();

    await this.save(projectPath, data);
  }

  /**
   * 更新项目描述
   */
  async updateDescription(projectPath: string, description: string): Promise<void> {
    const data = await this.getMetadata(projectPath);
    if (!data) throw new Error("项目元数据不存在");

    data.description = description;
    data.updatedAt = this.getToday();

    await this.save(projectPath, data);
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
      name,
      icon,
      description,
      type,
      status: "planning",
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

  /** 查找项目的 .home 文件 */
  private findHomeFile(projectPath: string): TFile | null {
    return findProjectHomeFile(this.app, projectPath);
  }

  /** 保存 .home 文件 */
  private async save(projectPath: string, data: ProjectHomeData): Promise<void> {
    const homeFile = this.findHomeFile(projectPath);
    if (!homeFile) {
      // 创建新文件
      const filePath = `${projectPath}/${PROJECT_HOME_FILENAME}`;
      await this.app.vault.create(filePath, JSON.stringify(data, null, 2));
    } else {
      // 更新现有文件
      await this.app.vault.modify(homeFile, JSON.stringify(data, null, 2));
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
      milestones: data.milestones || [],
      deliverables: data.deliverables || [],
      tasks: data.tasks || [],
      overview: data.overview,
      timeline: data.timeline,
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
