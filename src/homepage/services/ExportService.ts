/**
 * ExportService — 项目报告导出服务
 *
 * 功能：
 * - 导出项目报告（Markdown/PDF）
 * - 导出任务列表（JSON/CSV）
 * - 导出统计数据（JSON/CSV）
 * - 导出时间轴（Markdown）
 */

import { App, Notice } from "obsidian";
import type { ProjectConsoleData } from "../types";
import { getServiceManager } from "./index";
import type { ServiceManager } from "./ServiceManager";
import { isPortableProjectPath } from "../../utils/project-path";

export type ExportFormat = "markdown" | "json" | "csv";

export interface ExportOptions {
  format: ExportFormat;
  includeStats?: boolean;
  includeTimeline?: boolean;
  includeTasks?: boolean;
  includeDeliverables?: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
}

export class ExportService {
  private services: ServiceManager;

  constructor(private app: App, services?: ServiceManager) {
    // Prefer the already-initialized manager from the current project view so
    // report stats/timeline use the same task source, snapshot index and
    // caches as the rest of the UI. The fallback keeps the service usable in
    // standalone callers and tests.
    this.services = services ?? getServiceManager(app);
  }

  // ============================================================
  // 导出项目报告
  // ============================================================

  /**
   * 导出项目报告
   */
  async exportProjectReport(
    projectPath: string,
    options: ExportOptions = { format: "markdown" }
  ): Promise<string> {
    const data = await this.services.projectData.getProjectConsoleData(projectPath);
    if (!data) {
      throw new Error("无法读取项目数据");
    }

    switch (options.format) {
      case "markdown":
        return this.generateMarkdownReport(projectPath, data, options);
      case "json":
        return this.generateJsonReport(projectPath, data, options);
      case "csv":
        return this.generateCsvReport(data, options);
      default:
        throw new Error(`不支持的导出格式: ${options.format}`);
    }
  }

  /**
   * 导出到文件
   */
  async exportToFile(
    projectPath: string,
    outputPath: string,
    options: ExportOptions = { format: "markdown" }
  ): Promise<void> {
    if (!isPortableProjectPath(outputPath) || !outputPath.startsWith(projectPath + "/")) throw new Error("报告输出路径必须位于项目内且名称有效");
    const content = await this.exportProjectReport(projectPath, options);

    // 确保输出目录存在
    const dir = outputPath.substring(0, outputPath.lastIndexOf("/"));
    if (!(await this.app.vault.adapter.exists(dir))) {
      await this.app.vault.adapter.mkdir(dir);
    }

    const dot = outputPath.lastIndexOf(".");
    const stem = dot > outputPath.lastIndexOf("/") ? outputPath.slice(0, dot) : outputPath;
    const extension = outputPath.slice(stem.length);
    let target = outputPath, suffix = 1;
    while (await this.app.vault.adapter.exists(target)) target = `${stem}_${suffix++}${extension}`;
    await this.app.vault.create(target, content);
    new Notice(`报告已导出到: ${target}`);
  }

  // ============================================================
  // Markdown 报告
  // ============================================================

  private async generateMarkdownReport(
    projectPath: string,
    data: ProjectConsoleData,
    options: ExportOptions
  ): Promise<string> {
    const lines: string[] = [];


    // 标题
    lines.push(`# ${data.name} - 项目报告`);
    lines.push("");
    lines.push(`**导出时间：** ${new Date().toLocaleString("zh-CN")}`);
    lines.push("");

    // 基本信息
    lines.push("## 基本信息");
    lines.push("");
    lines.push(`- **项目名称：** ${data.name}`);
    lines.push(`- **项目类型：** ${data.type}`);
    lines.push(`- **创建时间：** ${data.createdAt || "未知"}`);
    if (data.description) {
      lines.push(`- **项目描述：** ${data.description}`);
    }
    lines.push("");

    // 统计信息
    if (options.includeStats !== false) {
      const stats = await this.services.projectData.getProjectStatistics(projectPath);
      const health = await this.services.projectData.getProjectHealth(projectPath);

      lines.push("## 统计信息");
      lines.push("");
      lines.push(`- **健康度评分：** ${health.score}/100 (${this.getHealthStatusLabel(health.status)})`);
      lines.push(`- **总任务数：** ${stats.totalTasks}`);
      lines.push(`- **已完成任务：** ${stats.completedTasks}`);
      lines.push(`- **任务完成率：** ${stats.totalTasks > 0 ? ((stats.completedTasks / stats.totalTasks) * 100).toFixed(1) : 0}%`);
      lines.push(`- **总文件数：** ${stats.totalFiles}`);
      lines.push(`- **笔记数量：** ${stats.totalNotes}`);
      lines.push(`- **活跃天数：** ${stats.daysActive} 天`);
      lines.push("");
    }

    // 任务列表
    if (options.includeTasks !== false && data.tasks.length > 0) {
      lines.push("## 任务列表");
      lines.push("");

      // 按优先级分组
      const pending = data.tasks.filter((t) => !t.completed);
      const done = data.tasks.filter((t) => t.completed);

      if (pending.length > 0) {
        lines.push("### 进行中");
        lines.push("");
        for (const task of pending) {
          const priority = task.priority ? ` [${task.priority}]` : "";
          const due = task.due ? ` (截止: ${task.due})` : "";
          const tags = task.tags && task.tags.length > 0 ? ` #${task.tags.join(" #")}` : "";
          lines.push(`- [ ] ${task.text}${priority}${due}${tags}`);
        }
        lines.push("");
      }

      if (done.length > 0) {
        lines.push("### 已完成");
        lines.push("");
        for (const task of done) {
          lines.push(`- [x] ${task.text}`);
        }
        lines.push("");
      }
    }

    // 交付物
    if (options.includeDeliverables !== false && data.deliverables.length > 0) {
      lines.push("## 交付物");
      lines.push("");

      const statusLabels: Record<string, string> = {
        "pending": "待开始",
        "in-progress": "进行中",
        "done": "已完成",
      };

      for (const item of data.deliverables) {
        const status = item.format === "zip"
          ? `已发布 · ${item.fileCount ?? 0} 个文件`
          : statusLabels[item.status || "pending"];
        lines.push(`- **${item.name}** - ${status}`);
        if (item.description) lines.push(`  - ${item.description}`);
        if (item.path) {
          lines.push(`  - 路径: ${item.path}`);
        }
      }
      lines.push("");
    }

    // 时间轴
    if (options.includeTimeline !== false) {
      const timeline = await this.services.timeline.getProjectTimeline(projectPath);

      if (timeline.events.length > 0) {
        lines.push("## 项目时间轴");
        lines.push("");

        const recentEvents = timeline.events.slice(0, 20);
        for (const event of recentEvents) {
          const icon = this.getTimelineIcon(event.type);
          lines.push(`- ${icon} **${event.date}** - ${event.title}`);
          if (event.description) {
            lines.push(`  - ${event.description}`);
          }
        }
        lines.push("");
      }
    }

    // 页脚
    lines.push("---");
    lines.push("");
    lines.push("*此报告由 ZENdian 插件自动生成*");

    return lines.join("\n");
  }

  // ============================================================
  // JSON 报告
  // ============================================================

  private async generateJsonReport(
    projectPath: string,
    data: ProjectConsoleData,
    options: ExportOptions
  ): Promise<string> {
    const report: any = {
      name: data.name,
      type: data.type,
      description: data.description,
      createdAt: data.createdAt,
      exportedAt: new Date().toISOString(),
    };

    if (options.includeStats !== false) {
      const stats = await this.services.projectData.getProjectStatistics(projectPath);
      const health = await this.services.projectData.getProjectHealth(projectPath);
      report.stats = stats;
      report.health = health;
    }

    if (options.includeTasks !== false) {
      report.tasks = data.tasks;
    }

    if (options.includeDeliverables !== false) {
      report.deliverables = data.deliverables;
    }

    if (options.includeTimeline !== false) {
      const timeline = await this.services.timeline.getProjectTimeline(projectPath);
      report.timeline = timeline;
    }

    return JSON.stringify(report, null, 2);
  }

  // ============================================================
  // CSV 报告
  // ============================================================

  private async generateCsvReport(
    data: ProjectConsoleData,
    options: ExportOptions
  ): Promise<string> {
    const lines: string[] = [];
    const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;

    // 任务列表
    if (options.includeTasks !== false && data.tasks.length > 0) {
      lines.push("任务列表");
      lines.push("状态,优先级,任务内容,截止日期,标签");

      for (const task of data.tasks) {
        const status = task.completed ? "已完成" : "进行中";
        const priority = task.priority || "";
        const text = task.text;
        const due = task.due || "";
        const tags = task.tags ? task.tags.join(";") : "";
        lines.push([status, priority, text, due, tags].map(cell).join(","));
      }

      lines.push("");
    }

    // 交付物
    if (options.includeDeliverables !== false && data.deliverables.length > 0) {
      lines.push("交付物");
      lines.push("名称,状态,路径");

      const statusLabels: Record<string, string> = {
        "pending": "待开始",
        "in-progress": "进行中",
        "done": "已完成",
      };

      for (const item of data.deliverables) {
        const status = item.format === "zip"
          ? `已发布（${item.fileCount ?? 0} 个文件）`
          : statusLabels[item.status || "pending"];
        const name = item.name;
        const path = item.path || "";
        lines.push([name, status || "待开始", path].map(cell).join(","));
      }

      lines.push("");
    }

    return lines.join("\n");
  }

  // ============================================================
  // 工具函数
  // ============================================================

  private getHealthStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      "excellent": "优秀",
      "good": "良好",
      "fair": "一般",
      "poor": "需改进",
    };
    return labels[status] || status;
  }

  private getTimelineIcon(type: string): string {
    const icons: Record<string, string> = {
      "file-created": "📄",
      "file-modified": "✏️",
      "task-created": "➕",
      "task-updated": "✏️",
      "task-completed": "✅",
      "task-restored": "↩️",
      "deliverable-added": "📦",
      "milestone": "🏁",
    };
    return icons[type] || "📌";
  }
}
