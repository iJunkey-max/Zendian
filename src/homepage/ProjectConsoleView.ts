/**
 * ProjectConsoleView — 项目控制台视图（仪表盘风格）
 */

import { FileView, type WorkspaceLeaf, type App, TFile, getIcon, Menu, Modal, Setting, Notice, MarkdownRenderer } from "obsidian";
import type {
  ProjectConsoleData,
  ProjectConsoleTask,
  ProjectConsoleDeliverable,
  ProjectRecentFile,
  ProjectType,
} from "./types";
import { getProjectTypeColor } from "./project-categories";
import {
  PROJECT_STATUS_OPTIONS,
  getProjectStatusOption,
  normalizeProjectStatus,
  normalizeStatusBeforePause,
  type ProjectStatus,
} from "./project-status";
import { getServiceManager } from "./services";
import type { ServiceManager, ProjectStatistics, ProjectHealth, ProjectCheckpoint } from "./services";
import { LineChart, HeatmapChart } from "./components/charts";
import type { Task } from "../services/TaskSyncService";
import { TaskSyncService } from "../services/TaskSyncService";
import type { DataChangeCallback, TimelineEvent } from "./services/types";
import { renderTaskPriorityLabel } from "./components/TaskPriorityLabel";
import { createTaskSchedulePicker } from "./components/TaskSchedulePicker";
import type { SettingsManager } from "../core/settings-manager";
import { DeliverableReleaseService } from "./services/DeliverableReleaseService";
import {
  getProjectSystemDirectory,
  LEGACY_PROJECT_CONSOLE_FOLDER,
} from "./services/ProjectHomeFileResolver";
import { formatDate } from "../utils/date";

export const VIEW_TYPE_PROJECT_CONSOLE = "zendian-project-console";

const SVG = {
  circle: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`,
  checkCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`,
  fileText: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,
  folder: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`,
  calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`,
  trash: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`,
  clock: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  target: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  checkSquare: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>`,
  package: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`,
  fileStack: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7h-3a2 2 0 0 1-2-2V2"/><path d="M21 6v6.5c0 .8-.7 1.5-1.5 1.5h-7c-.8 0-1.5-.7-1.5-1.5v-9c0-.8.7-1.5 1.5-1.5H17Z"/><path d="M7 8v8.8c0 .3.2.6.4.8.2.2.5.4.8.4H15"/><path d="M3 12v8.8c0 .3.2.6.4.8.2.2.5.4.8.4H11"/></svg>`,
  filePlus: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M12 18v-6"/><path d="M9 15h6"/></svg>`,
  fileEdit: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 12h4"/><path d="M10 16h4"/></svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
  flag: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>`,
} as const;

function svg(key: keyof typeof SVG): HTMLSpanElement {
  const s = createSpan({ cls: "zc-icon" });
  s.innerHTML = SVG[key];
  return s;
}

function fmtDate(d: string): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

function relTime(mtime: number): string {
  const d = Date.now() - mtime;
  const m = Math.floor(d / 60_000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  const dy = Math.floor(h / 24);
  if (dy < 7) return `${dy}天前`;
  const dt = new Date(mtime);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

class DeliverableFilePickerModal extends Modal {
  private selected: Set<string>;

  constructor(
    app: App,
    private projectPath: string,
    private files: TFile[],
    initial: string[],
    private onConfirm: (paths: string[]) => void,
  ) {
    super(app);
    this.selected = new Set(initial);
  }

  onOpen(): void {
    this.modalEl.addClass("zc-release-picker-modal");
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "选择交付文件" });
    contentEl.createDiv({ cls: "zc-release-modal-hint", text: "ZIP 内为扁平文件合集；同名文件不能同时提交。" });
    const search = contentEl.createEl("input", {
      cls: "zc-release-search",
      type: "search",
      placeholder: "搜索文件名或路径",
    });
    const list = contentEl.createDiv("zc-release-file-list");
    const count = contentEl.createSpan("zc-release-selected-count");

    const render = (): void => {
      list.empty();
      const query = search.value.trim().toLocaleLowerCase();
      const visible = this.files.filter((file) => file.path.toLocaleLowerCase().includes(query));
      for (const file of visible) {
        const row = list.createEl("label", { cls: "zc-release-file-option" });
        const checkbox = row.createEl("input", { type: "checkbox" });
        checkbox.checked = this.selected.has(file.path);
        const copy = row.createDiv("zc-release-file-copy");
        copy.createSpan({ cls: "zc-release-file-name", text: file.name });
        copy.createSpan({
          cls: "zc-release-file-path",
          text: file.path.startsWith(`${this.projectPath}/`)
            ? file.path.slice(this.projectPath.length + 1)
            : file.path,
        });
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) this.selected.add(file.path);
          else this.selected.delete(file.path);
          count.textContent = `已选择 ${this.selected.size} 个文件`;
        });
      }
      if (!visible.length) list.createDiv({ cls: "zc-empty-sub", text: "没有匹配的文件" });
      count.textContent = `已选择 ${this.selected.size} 个文件`;
    };
    search.addEventListener("input", render);
    render();

    const actions = contentEl.createDiv("zc-release-modal-actions");
    const cancel = actions.createEl("button", { text: "取消", attr: { type: "button" } });
    cancel.addEventListener("click", () => this.close());
    const confirm = actions.createEl("button", {
      cls: "mod-cta",
      text: "确认选择",
      attr: { type: "button" },
    });
    confirm.addEventListener("click", () => {
      this.onConfirm([...this.selected]);
      this.close();
    });
    window.setTimeout(() => search.focus(), 0);
  }
}

class SubmitDeliverableModal extends Modal {
  private releaseName = "";
  private description = "";
  private selectedPaths: string[] = [];
  private selectedEl!: HTMLElement;
  private submitButton!: HTMLButtonElement;

  constructor(
    app: App,
    private projectPath: string,
    private projectType: string,
    private releaseService: DeliverableReleaseService,
    private onSubmit: (name: string, description: string, paths: string[]) => Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("zc-release-submit-modal");
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "提交交付物" });
    contentEl.createDiv({
      cls: "zc-release-modal-hint",
      text: "选择的文件会复制到一个不可编辑的 ZIP 发布包，源文件不会受到影响。",
    });
    new Setting(contentEl)
      .setName("发布名称")
      .setDesc("将作为 ZIP 文件名，例如 v1.0-主页重构")
      .addText((text) => text
        .setPlaceholder("v1.0-发布名称")
        .onChange((value) => {
          this.releaseName = value;
          this.updateSubmitState();
        }));
    new Setting(contentEl)
      .setName("介绍")
      .setDesc("说明这个阶段完成了什么")
      .addTextArea((text) => text
        .setPlaceholder("发布说明")
        .onChange((value) => { this.description = value; }));

    const fileSection = contentEl.createDiv("zc-release-files-section");
    const fileHeader = fileSection.createDiv("zc-release-files-header");
    fileHeader.createDiv({ cls: "zc-release-files-title", text: "交付文件" });
    const choose = fileHeader.createEl("button", {
      text: "选择文件",
      attr: { type: "button" },
    });
    choose.addEventListener("click", () => {
      const files = this.releaseService.listSelectableFiles(this.projectPath, this.projectType);
      new DeliverableFilePickerModal(this.app, this.projectPath, files, this.selectedPaths, (paths) => {
        this.selectedPaths = paths;
        this.renderSelected();
        this.updateSubmitState();
      }).open();
    });
    this.selectedEl = fileSection.createDiv("zc-release-selected-files");
    this.renderSelected();

    const actions = contentEl.createDiv("zc-release-modal-actions");
    const cancel = actions.createEl("button", { text: "取消", attr: { type: "button" } });
    cancel.addEventListener("click", () => this.close());
    this.submitButton = actions.createEl("button", {
      cls: "mod-cta",
      text: "生成 ZIP 并发布",
      attr: { type: "button" },
    });
    this.submitButton.addEventListener("click", async () => {
      this.submitButton.disabled = true;
      this.submitButton.textContent = "正在发布…";
      try {
        await this.onSubmit(this.releaseName, this.description, this.selectedPaths);
        this.close();
      } catch (error) {
        new Notice(error instanceof Error ? error.message : "交付物发布失败");
        this.submitButton.textContent = "生成 ZIP 并发布";
        this.updateSubmitState();
      }
    });
    this.updateSubmitState();
  }

  private renderSelected(): void {
    this.selectedEl.empty();
    if (!this.selectedPaths.length) {
      this.selectedEl.createDiv({ cls: "zc-release-no-files", text: "尚未选择文件" });
      return;
    }
    for (const path of this.selectedPaths) {
      const row = this.selectedEl.createDiv("zc-release-selected-row");
      row.createSpan({ text: path.slice(path.lastIndexOf("/") + 1) });
      const remove = row.createEl("button", {
        text: "×",
        attr: { type: "button", "aria-label": "移除文件" },
      });
      remove.addEventListener("click", () => {
        this.selectedPaths = this.selectedPaths.filter((item) => item !== path);
        this.renderSelected();
        this.updateSubmitState();
      });
    }
  }

  private updateSubmitState(): void {
    if (this.submitButton) this.submitButton.disabled = !this.releaseName.trim() || this.selectedPaths.length === 0;
  }
}

// ── AddTaskModal ──────────────────────────────────────

import type { TaskPriority } from "./types";
import { TASK_PRIORITY_LABELS } from "./types";

class AddTaskModal extends Modal {
  private text = "";
  private due = "";
  private dueTime = "";
  private priority: TaskPriority = "P2";
  private tags: string[] = [];
  private tagInput = "";
  private destroySchedulePicker: (() => void) | null = null;
  private cb: (t: ProjectConsoleTask) => void;

  constructor(app: App, cb: (t: ProjectConsoleTask) => void) { super(app); this.cb = cb; }

  onOpen() {
    const c = this.contentEl;
    c.createEl("h2", { text: "添加任务" });

    // 任务内容
    const taskContentSetting = new Setting(c).setName("任务内容");
    taskContentSetting.settingEl.addClass("zc-task-content-setting");
    taskContentSetting.addTextArea((t) => {
      t.setPlaceholder("输入任务内容，支持 Markdown 和换行").onChange((v) => (this.text = v));
      t.inputEl.addClass("zc-long-textarea");
    });

    // 截止日期
    const scheduleSetting = new Setting(c).setName("截止时间");
    scheduleSetting.settingEl.addClass("zendian-task-schedule-setting");
    scheduleSetting.controlEl.addClass("zendian-task-schedule-controls");
    this.destroySchedulePicker = createTaskSchedulePicker(scheduleSetting.controlEl, { date: this.due, time: this.dueTime }, (value) => {
      this.due = value.date;
      this.dueTime = value.time;
    });

    // 优先级
    const prioritySetting = new Setting(c).setName("优先级");
    const prioritySelect = prioritySetting.controlEl.createEl("select");
    const priorities: TaskPriority[] = ["P0", "P1", "P2", "P3"];
    for (const p of priorities) {
      const option = prioritySelect.createEl("option", { value: p, text: `${TASK_PRIORITY_LABELS[p]} (${p})` });
      if (p === this.priority) option.selected = true;
    }
    prioritySelect.addEventListener("change", () => {
      this.priority = prioritySelect.value as TaskPriority;
    });

    // 标签
    const tagSetting = new Setting(c).setName("标签");
    const tagContainer = tagSetting.controlEl.createDiv({ cls: "zc-tag-container" });
    const tagInput = tagContainer.createEl("input", {
      cls: "zc-tag-input",
      attr: { type: "text", placeholder: "输入标签后回车" },
    });
    const tagList = tagContainer.createDiv({ cls: "zc-tag-list" });

    tagInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && tagInput.value.trim()) {
        const tag = tagInput.value.trim();
        if (!this.tags.includes(tag)) {
          this.tags.push(tag);
          this.renderTags(tagList);
        }
        tagInput.value = "";
        e.preventDefault();
      }
    });

    // 添加按钮
    new Setting(c).addButton((b) =>
      b.setButtonText("添加").setCta().onClick(() => {
        const v = this.text.trim();
        if (!v) return;
        if (this.dueTime && !this.due) {
          new Notice("填写时间前请先选择截止日期");
          return;
        }
        this.cb({
          text: v,
          completed: false,
          created: formatDate(new Date()),
          due: this.due.trim() || undefined,
          dueTime: this.dueTime.trim() || undefined,
          priority: this.priority,
          tags: this.tags.length > 0 ? this.tags : undefined,
        });
        this.close();
      })
    );

    setTimeout(() => {
      const i = c.querySelector("textarea") as HTMLTextAreaElement;
      i?.focus();
    }, 50);
  }

  private renderTags(container: HTMLElement) {
    container.empty();
    for (const tag of this.tags) {
      const tagEl = container.createDiv({ cls: "zc-tag" });
      tagEl.createSpan({ text: tag });
      const removeBtn = tagEl.createSpan({ cls: "zc-tag-remove", text: "×" });
      removeBtn.addEventListener("click", () => {
        this.tags = this.tags.filter((t) => t !== tag);
        this.renderTags(container);
      });
    }
  }

  onClose() {
    this.destroySchedulePicker?.();
    this.destroySchedulePicker = null;
    this.contentEl.empty();
  }
}

class CreateCheckpointModal extends Modal {
  private name = "";

  constructor(app: App, private onCreate: (name: string) => Promise<void>) {
    super(app);
  }

  onOpen(): void {
    const container = this.contentEl;
    container.createEl("h2", { text: "创建项目检查点" });
    container.createDiv({ cls: "zc-modal-hint", text: "记录当前项目内所有受支持文本文件的版本。" });
    new Setting(container)
      .setName("检查点名称")
      .addText((text) => text
        .setPlaceholder("例如：主页布局完成")
        .onChange((value) => { this.name = value; }));
    new Setting(container).addButton((button) => button
      .setButtonText("创建检查点")
      .setCta()
      .onClick(async () => {
        button.setDisabled(true);
        await this.onCreate(this.name);
        this.close();
      }));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class ConfirmCheckpointRestoreModal extends Modal {
  constructor(
    app: App,
    private checkpoint: ProjectCheckpoint,
    private onConfirm: () => Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    const container = this.contentEl;
    container.addClass("zc-checkpoint-confirm");
    container.createEl("h2", { text: "退回检查点" });
    container.createEl("p", {
      text: `项目将恢复到“${this.checkpoint.name}”，共 ${Object.keys(this.checkpoint.versions).length} 个文件版本。`,
    });
    container.createDiv({
      cls: "zc-checkpoint-confirm-note",
      text: "恢复前会自动创建安全检查点；检查点之后新增的受支持文本文件将从当前项目中移除。",
    });
    const actions = new Setting(container);
    actions.settingEl.addClass("zc-checkpoint-confirm-actions");
    actions.addButton((button) => button
      .setButtonText("取消")
      .onClick(() => this.close()));
    actions.addButton((button) => button
      .setButtonText("确认恢复")
      .setWarning()
      .onClick(async () => {
        button.setDisabled(true);
        await this.onConfirm();
        this.close();
      }));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class ConfirmCheckpointDeleteModal extends Modal {
  constructor(
    app: App,
    private checkpoint: ProjectCheckpoint,
    private onConfirm: () => Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    const container = this.contentEl;
    container.addClass("zc-checkpoint-confirm");
    container.createEl("h2", { text: "删除检查点" });
    container.createEl("p", { text: `确定删除“${this.checkpoint.name}”吗？` });
    container.createDiv({
      cls: "zc-checkpoint-confirm-note",
      text: "只删除检查点记录，不会修改当前项目文件。",
    });
    const actions = new Setting(container);
    actions.settingEl.addClass("zc-checkpoint-confirm-actions");
    actions.addButton((button) => button
      .setButtonText("取消")
      .onClick(() => this.close()));
    actions.addButton((button) => button
      .setButtonText("删除")
      .setWarning()
      .onClick(async () => {
        button.setDisabled(true);
        await this.onConfirm();
        this.close();
      }));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class ConfirmSnapshotRestoreModal extends Modal {
  constructor(
    app: App,
    private filePath: string,
    private onConfirm: () => Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    const container = this.contentEl;
    container.createEl("h2", { text: "恢复文件版本" });
    container.createEl("p", { text: `将 ${this.filePath} 恢复到所选版本。恢复前会自动保存当前内容。` });
    const actions = new Setting(container);
    actions.addButton((button) => button.setButtonText("取消").onClick(() => this.close()));
    actions.addButton((button) => button
      .setButtonText("确认恢复")
      .setWarning()
      .onClick(async () => {
        button.setDisabled(true);
        await this.onConfirm();
        this.close();
      }));
  }
}

class SnapshotDiffModal extends Modal {
  constructor(
    app: App,
    private services: ServiceManager,
    private versionId: string,
    private onRestored: () => Promise<void>,
  ) {
    super(app);
  }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.addClass("zc-snapshot-modal");
    const loading = container.createDiv({ cls: "zc-loading", text: "读取版本差异..." });
    const comparison = await this.services.snapshots.getComparison(this.versionId);
    loading.remove();
    if (!comparison) {
      container.createDiv({ cls: "zc-error", text: "无法读取该快照" });
      return;
    }

    container.createEl("h2", { text: comparison.version.filePath.split("/").pop() || comparison.version.filePath });
    container.createDiv({
      cls: "zc-snapshot-meta",
      text: `${new Date(comparison.version.timestamp).toLocaleString()} · +${comparison.added} / -${comparison.removed}`,
    });
    const diff = container.createDiv({ cls: "zc-snapshot-diff" });
    if (!comparison.preview.length) {
      diff.createDiv({ cls: "zc-snapshot-no-change", text: "该版本与当前内容一致" });
    } else {
      for (const line of comparison.preview) {
        const prefix = line.kind === "added" ? "+" : line.kind === "removed" ? "−" : " ";
        diff.createDiv({ cls: `zc-snapshot-diff-line is-${line.kind}`, text: `${prefix} ${line.text}` });
      }
    }

    const actions = new Setting(container);
    actions.settingEl.addClass("zc-snapshot-actions");
    actions.addButton((button) => button.setButtonText("关闭").onClick(() => this.close()));
    actions.addButton((button) => button
      .setButtonText("恢复此版本")
      .setWarning()
      .onClick(() => {
        new ConfirmSnapshotRestoreModal(this.app, comparison.version.filePath, async () => {
          const restored = await this.services.snapshots.restoreVersion(this.versionId);
          if (!restored) {
            new Notice("版本恢复失败");
            return;
          }
          this.services.clearProjectCache(comparison.version.projectPath);
          await this.onRestored();
          new Notice("文件已恢复，恢复前版本已安全保存");
          this.close();
        }).open();
      }));
  }
}

// ── 主视图 ──────────────────────────────────────────

export class ProjectConsoleView extends FileView {
  private data: ProjectConsoleData | null = null;
  private projPath = "";
  private tab: "tasks" | "deliverables" | "recent" | "timeline" | "analytics" = "tasks";
  private services: ServiceManager;
  private timelineTasks: Task[] = [];
  private fileWatcherCallback: DataChangeCallback | null = null;
  private projectStats: ProjectStatistics | null = null;
  private health: ProjectHealth | null = null;
  private timelineFilter: "all" | "files" | "tasks" | "project" | "checkpoints" = "all";
  private releaseService: DeliverableReleaseService;

  constructor(
    l: WorkspaceLeaf,
    private taskSyncService: TaskSyncService,
    private settingsManager: SettingsManager,
  ) {
    super(l);
    this.services = getServiceManager(this.app, taskSyncService);
    this.releaseService = new DeliverableReleaseService(this.app, settingsManager);
  }

  getViewType() { return VIEW_TYPE_PROJECT_CONSOLE; }
  getDisplayText() { return this.data?.name || "项目控制台"; }
  getIcon() { return "layout-dashboard"; }
  getExtension() { return "home"; }

  async onLoadFile(file: TFile) {
    const parent = file.parent;
    if (!parent) this.projPath = "";
    else if (parent.name === LEGACY_PROJECT_CONSOLE_FOLDER) this.projPath = parent.parent?.path || parent.path;
    else this.projPath = parent.path;
    await this.loadProjectData();
    await this.services.trackProjectSnapshots(this.projPath);
    this.services.timeline.clearCache(this.projPath);

    // 开始监听文件变更
    this.fileWatcherCallback = async (event) => {
      console.log("[ProjectConsoleView] 文件变更，刷新数据", event);
      this.services.timeline.clearCache(this.projPath);
      await this.loadProjectData();
      this.render();
    };
    this.services.fileWatcher.watchProject(this.projPath, this.fileWatcherCallback);

    this.render();
  }

  async onUnloadFile() {
    const c = this.containerEl.children[1];
    if (c) { c.empty(); c.removeClass("zc-root"); }
    this.data = null;
    this.projectStats = null;
    this.health = null;

    // 停止监听
    this.services.fileWatcher.unwatchProject(this.projPath, this.fileWatcherCallback || undefined);
    this.fileWatcherCallback = null;
  }

  async onOpen() {
    // onLoadFile 可能先于 onOpen 执行，此时 children[1] 不存在
    // onOpen 时 DOM 一定就绪，补渲染
    if (this.data) this.render();
  }

  // ── 数据 ──────────────────────────────────────────

  private async loadProjectData() {
    const f = this.file;
    if (!(f instanceof TFile)) return;

    // 使用数据服务加载数据
    this.data = await this.services.projectData.getProjectConsoleData(this.projPath);
    if (!this.data) return;

    this.timelineTasks = await this.taskSyncService.getTasks(this.projPath);
    this.data.tasks = this.timelineTasks.map((task) => ({
      id: task.id,
      text: task.text,
      completed: task.completed,
      created: task.created,
      due: task.due,
      dueTime: task.dueTime,
      priority: this.toDisplayPriority(task.priority),
      tags: task.tags,
      completedAt: task.completedAt,
    }));

    // 并行加载统计和健康度数据
    [this.projectStats, this.health] = await Promise.all([
      this.services.projectData.getProjectStatistics(this.projPath),
      this.services.projectData.getProjectHealth(this.projPath),
    ]);
  }

  private recent(limit: number): ProjectRecentFile[] {
    // 使用数据服务获取最近文件
    const files = this.services.projectData.getRecentFiles(this.projPath, limit);
    return files.map(f => ({
      name: f.name,
      path: f.path,
      mtime: f.modified,
    }));
  }

  private progress() {
    if (!this.data) return { done: 0, total: 0, pct: 0 };
    const t = this.data.tasks, total = t.length, done = t.filter((x) => x.completed).length;
    return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }

  // ── 渲染 ──────────────────────────────────────────

  private render() {
    const c = this.containerEl.children[1];
    if (!c) return;
    c.empty();
    c.addClass("zc-root");

    if (!this.data) {
      c.createDiv({ cls: "zc-error", text: "无法解析 .home 文件内容，请检查 JSON 格式" });
      return;
    }

    try {
      const w = c.createDiv({ cls: "zc-wrapper" });
      this.hero(w);
      this.tabsArea(w);
    } catch (e) {
      console.error("[ZENdian] 控制台渲染失败:", e);
      c.createDiv({ cls: "zc-error", text: `渲染出错: ${e}` });
    }
  }

  /** 项目信息区 */
  private hero(p: HTMLElement) {
    const d = this.data!;
    const color = getProjectTypeColor(d.type || "未分类");
    const breadcrumb = p.createEl("nav", {
      cls: "zc-breadcrumb",
      attr: { "aria-label": "项目路径" },
    });
    breadcrumb.createSpan({ text: "项目" });
    breadcrumb.createSpan({ cls: "zc-breadcrumb-separator", text: "/" });
    breadcrumb.createSpan({ text: d.type || "未分类" });
    breadcrumb.createSpan({ cls: "zc-breadcrumb-separator", text: "/" });
    breadcrumb.createSpan({ cls: "is-current", text: d.name });

    const sec = p.createDiv({ cls: "zc-hero" });
    const info = sec.createDiv({ cls: "zc-hero-info" });
    const headingRow = info.createDiv({ cls: "zc-hero-heading-row" });
    const title = headingRow.createEl("h1", { cls: "zc-hero-title" });
    const icon = title.createSpan({
      cls: "zc-hero-icon zc-hero-title-icon",
      attr: { "aria-hidden": "true" },
    });
    this.renderIcon(icon, d.icon);
    title.createSpan({ cls: "zc-hero-title-text", text: d.name });
    const meta = headingRow.createDiv({ cls: "zc-hero-meta" });
    meta.createSpan({ cls: "zc-hero-tag", text: d.type || "未分类", attr: { style: `--tag-color:${color}` } });
    this.renderProjectStatusButton(meta);
    if (d.createdAt) {
      const date = meta.createSpan({ cls: "zc-hero-date" });
      date.appendChild(svg("calendar"));
      date.createSpan({ text: fmtDate(d.createdAt) });
    }

    const descEl = info.createDiv({ cls: "zc-hero-desc" });
    if (d.description) {
      const rendered = descEl.createDiv({ cls: "zc-hero-desc-text zc-row-markdown zc-inline-markdown markdown-preview-view markdown-rendered" });
      void MarkdownRenderer.renderMarkdown(d.description, rendered, this.projPath, null as any);
    }
    else descEl.createSpan({ cls: "zc-hero-desc-placeholder", text: "点击添加项目简介..." });
    const editBtn = descEl.createSpan({ cls: "zc-hero-desc-edit" });
    editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;
    descEl.addEventListener("click", () => this.editDescription(descEl));

    const exportBtn = sec.createEl("button", {
      cls: "zc-hero-export",
      attr: { type: "button", "aria-label": "导出项目数据" },
    });
    exportBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`;
    exportBtn.createSpan({ text: "导出" });
    exportBtn.addEventListener("click", () => this.showExportMenu(exportBtn));
  }

  private renderProjectStatusButton(container: HTMLElement): void {
    const status = getProjectStatusOption(this.data?.status);
    const button = container.createEl("button", {
      cls: "zd-project-status-tag is-interactive",
      attr: {
        type: "button",
        "data-status": status.value,
        "aria-haspopup": "menu",
        "aria-label": `项目状态：${status.label}，点击更改`,
      },
    });
    button.createSpan({ cls: "zd-project-status-dot", attr: { "aria-hidden": "true" } });
    button.createSpan({ cls: "zd-project-status-label", text: status.label });
    button.createSpan({ cls: "zd-project-status-chevron", text: "⌄", attr: { "aria-hidden": "true" } });
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      this.showProjectStatusMenu(button);
    });
  }

  private showProjectStatusMenu(anchor: HTMLElement): void {
    const currentStatus = normalizeProjectStatus(this.data?.status);
    const statusBeforePause = normalizeStatusBeforePause(this.data?.statusBeforePause);
    const menu = new Menu().setParentElement(anchor);

    if (currentStatus === "paused" && statusBeforePause) {
      const resumeOption = getProjectStatusOption(statusBeforePause);
      menu.addItem((item) => item
        .setTitle(`恢复为${resumeOption.label}`)
        .setIcon("rotate-ccw")
        .onClick(() => void this.updateProjectStatus(statusBeforePause)));
      menu.addSeparator();
    }

    for (const option of PROJECT_STATUS_OPTIONS) {
      menu.addItem((item) => item
        .setTitle(option.label)
        .setIcon(option.icon)
        .setChecked(option.value === currentStatus)
        .onClick(() => void this.updateProjectStatus(option.value)));
    }

    const rect = anchor.getBoundingClientRect();
    menu.showAtPosition({ x: rect.left, y: rect.bottom + 4 });
  }

  private async updateProjectStatus(nextStatus: ProjectStatus): Promise<void> {
    if (!this.data) return;
    const previousStatus = normalizeProjectStatus(this.data.status);
    if (previousStatus === nextStatus) return;

    const previousBeforePause = this.data.statusBeforePause;
    const previousHistory = [...(this.data.statusHistory || [])];
    const previousUpdatedAt = this.data.updatedAt;

    if (nextStatus === "paused" && previousStatus !== "paused") {
      this.data.statusBeforePause = previousStatus;
    } else if (nextStatus !== "paused") {
      this.data.statusBeforePause = undefined;
    }

    this.data.status = nextStatus;
    this.data.updatedAt = formatDate(new Date());
    this.data.statusHistory = [
      ...previousHistory,
      { from: previousStatus, to: nextStatus, changedAt: new Date().toISOString() },
    ];

    const saved = await this.services.projectData.mutateProjectConsoleData(this.projPath, (latest) => {
      const latestStatus = normalizeProjectStatus(latest.status);
      if (nextStatus === "paused" && latestStatus !== "paused") {
        latest.statusBeforePause = latestStatus;
      } else if (nextStatus !== "paused") {
        latest.statusBeforePause = undefined;
      }
      latest.status = nextStatus;
      latest.updatedAt = formatDate(new Date());
      latest.statusHistory = [
        ...(latest.statusHistory || []),
        { from: latestStatus, to: nextStatus, changedAt: new Date().toISOString() },
      ];
    });
    if (!saved) {
      this.data.status = previousStatus;
      this.data.statusBeforePause = previousBeforePause;
      this.data.statusHistory = previousHistory;
      this.data.updatedAt = previousUpdatedAt;
      new Notice("项目状态保存失败，请检查 .home 文件");
      this.render();
      return;
    }

    new Notice(`项目状态已改为${getProjectStatusOption(nextStatus).label}`);
    await this.loadProjectData();
    this.render();
  }

  private showExportMenu(anchor: HTMLElement) {
    const menu = document.createElement("div");
    menu.addClass("zc-export-menu");
    menu.innerHTML = `
      <div class="zc-export-option" data-format="markdown"><span class="zc-export-icon">📄</span><span class="zc-export-label">Markdown 报告</span></div>
      <div class="zc-export-option" data-format="json"><span class="zc-export-icon">📊</span><span class="zc-export-label">JSON 数据</span></div>
      <div class="zc-export-option" data-format="csv"><span class="zc-export-icon">📋</span><span class="zc-export-label">CSV 表格</span></div>
    `;
    const rect = anchor.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.right = `${window.innerWidth - rect.right}px`;
    menu.querySelectorAll(".zc-export-option").forEach((option) => {
      option.addEventListener("click", async () => {
        const format = option.getAttribute("data-format") as "markdown" | "json" | "csv";
        await this.exportProject(format);
        menu.remove();
      });
    });
    const closeMenu = (event: MouseEvent) => {
      if (!menu.contains(event.target as Node)) {
        menu.remove();
        document.removeEventListener("click", closeMenu);
      }
    };
    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener("click", closeMenu), 10);
  }

  private async exportProject(format: "markdown" | "json" | "csv") {
    try {
      const { ExportService } = await import("./services/ExportService");
      const exportService = new ExportService(this.app);
      const timestamp = formatDate(new Date());
      const fileName = `${this.data!.name}_报告_${timestamp}`;
      const extension = format === "markdown" ? "md" : format;
      const outputPath = `${getProjectSystemDirectory(this.app, this.projPath)}/${fileName}.${extension}`;
      await exportService.exportToFile(this.projPath, outputPath, {
        format,
        includeStats: true,
        includeTimeline: true,
        includeTasks: true,
        includeDeliverables: true,
      });
    } catch (error) {
      console.error("[ProjectConsoleView] 导出失败:", error);
      new Notice("导出失败，请查看控制台日志");
    }
  }

  private editDescription(container: HTMLElement) {
    const d = this.data!;
    container.empty();
    const input = container.createEl("textarea", {
      cls: "zc-hero-desc-input",
      attr: { placeholder: "输入项目简介，支持 Markdown 和换行", rows: "4" },
    });
    input.value = d.description || "";
    input.focus();
    input.select();
    const save = async () => {
      const description = input.value.trim();
      d.description = description;
      await this.services.projectData.mutateProjectConsoleData(this.projPath, (latest) => {
        latest.description = description;
        latest.updatedAt = formatDate(new Date());
      });
      await this.loadProjectData();
      this.render();
    };
    input.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        void save();
      }
      if (event.key === "Escape") this.render();
    });
    input.addEventListener("blur", () => void save());
  }

  /** 统计卡片行 */
  private renderStats(p: HTMLElement) {
    if (!this.projectStats || !this.health) return;

    const { done, total, pct } = this.progress();
    const files = this.projectStats.totalFiles;
    const delivers = this.data!.deliverables.length;
    const statusText = {
      excellent: "优秀",
      good: "良好",
      fair: "一般",
      poor: "需改进",
    };

    const section = p.createDiv({ cls: "zc-status-panel" });
    section.createDiv({ cls: "zc-aside-title", text: "项目状态" });

    const progress = section.createDiv({ cls: "zc-status-progress" });
    const progressHeader = progress.createDiv({ cls: "zc-status-progress-header" });
    progressHeader.createSpan({ text: "完成度" });
    progressHeader.createSpan({ cls: "zc-status-progress-value", text: `${pct}%` });
    const progressTrack = progress.createDiv({ cls: "zc-status-progress-track" });
    progressTrack.createDiv({ cls: "zc-status-progress-fill", attr: { style: `width:${pct}%` } });

    const rows: Array<[string, string, string?]> = [
      ["健康度", `${this.health.score} · ${statusText[this.health.status]}`],
      ["任务", `${done} / ${total}`, `${Math.max(0, total - done)} 项待推进`],
      ["交付物", String(delivers), delivers > 0 ? "项目产出" : "暂无产出"],
      ["文件", String(files), "项目内文件"],
    ];

    for (const [label, value, hint] of rows) {
      const row = section.createDiv({ cls: "zc-status-row" });
      row.createSpan({ cls: "zc-status-label", text: label });
      const valueWrap = row.createDiv({ cls: "zc-status-value-wrap" });
      valueWrap.createSpan({ cls: "zc-status-value", text: value });
      if (hint) valueWrap.createSpan({ cls: "zc-status-hint", text: hint });
    }

  }

  /** Tab 区域 */
  private tabsArea(p: HTMLElement) {
    const section = p.createDiv({ cls: "zc-section" });

    // Tab 栏
    const tabBar = section.createDiv({ cls: "zc-tabs", attr: { role: "tablist", "aria-label": "项目视图" } });
    const defs: [typeof this.tab, string][] = [
      ["tasks", "任务"],
      ["deliverables", "交付物"],
      ["timeline", "时间轴"],
      ["analytics", "数据"],
      ["recent", "最近文件"]
    ];
    for (const [key, label] of defs) {
      const btn = tabBar.createEl("button", {
        cls: `zc-tab${this.tab === key ? " is-active" : ""}`,
        text: label,
        attr: {
          type: "button",
          role: "tab",
          "aria-selected": String(this.tab === key),
        },
      });
      btn.addEventListener("click", () => {
        this.tab = key;
        tabBar.querySelectorAll<HTMLElement>(".zc-tab").forEach((e) => {
          e.removeClass("is-active");
          e.setAttribute("aria-selected", "false");
        });
        btn.addClass("is-active");
        btn.setAttribute("aria-selected", "true");
        const body = section.querySelector(".zc-section-body");
        if (body) { body.empty(); this.tabBody(body as HTMLElement); }
      });
    }

    const layout = section.createDiv({ cls: "zc-workspace-layout" });
    const primary = layout.createDiv({ cls: "zc-workspace-primary" });
    const body = primary.createDiv({ cls: "zc-section-body" });
    this.tabBody(body);

    const aside = layout.createEl("aside", { cls: "zc-workspace-aside" });
    this.renderStats(aside);
    this.renderRecentActivity(aside);
  }

  private tabBody(c: HTMLElement) {
    if (this.tab === "tasks") this.tasks(c);
    else if (this.tab === "deliverables") this.deliverables(c);
    else if (this.tab === "timeline") this.timeline(c);
    else if (this.tab === "analytics") this.analytics(c);
    else this.files(c);
  }

  /** 任务列表 */
  private tasks(c: HTMLElement) {
    const d = this.data!;
    const heading = c.createDiv({ cls: "zc-content-heading" });
    const headingText = heading.createDiv({ cls: "zc-content-heading-copy" });
    headingText.createDiv({ cls: "zc-content-eyebrow", text: "当前焦点" });
    const titleRow = headingText.createDiv({ cls: "zc-content-title-row" });
    titleRow.createEl("h2", { cls: "zc-content-title", text: "任务" });
    const remaining = d.tasks.filter((task) => !task.completed).length;
    titleRow.createSpan({ cls: "zc-content-count", text: `${remaining} 项待处理` });
    const add = heading.createEl("button", {
      cls: "zc-add-btn zc-add-btn--inline",
      attr: { type: "button", "aria-label": "添加任务" },
    });
    add.appendChild(svg("plus"));
    add.createSpan({ text: "添加任务" });
    add.addEventListener("click", () => this.openAddTaskModal());

    const scroll = c.createDiv({ cls: "zc-scroll" });
    const list = scroll.createDiv({ cls: "zc-list" });

    if (!d.tasks.length) {
      const e = list.createDiv({ cls: "zc-empty" });
      e.createDiv({ cls: "zc-empty-icon" }).innerHTML = SVG.checkSquare;
      e.createDiv({ cls: "zc-empty-title", text: "暂无任务" });
      e.createDiv({ cls: "zc-empty-sub", text: "添加第一个任务开始追踪进度" });
      return;
    }

    // 排序函数：紧急程度 > 截止时间 > 创建时间
    const priorityOrder: Record<string, number> = { "P0": 0, "P1": 1, "P2": 2, "P3": 3, "": 4 };
    const sortFn = (a: { t: ProjectConsoleTask; i: number }, b: { t: ProjectConsoleTask; i: number }) => {
      const pa = priorityOrder[a.t.priority || "P2"];
      const pb = priorityOrder[b.t.priority || "P2"];
      if (pa !== pb) return pa - pb;
      if (a.t.due && b.t.due) {
        const dueOrder = `${a.t.due}T${a.t.dueTime || "23:59"}`.localeCompare(`${b.t.due}T${b.t.dueTime || "23:59"}`);
        if (dueOrder !== 0) return dueOrder;
      } else if (a.t.due || b.t.due) {
        return a.t.due ? -1 : 1;
      }
      return (a.t.created || "").localeCompare(b.t.created || "") || a.t.text.localeCompare(b.t.text);
    };

    const pending = d.tasks.map((t, i) => ({ t, i })).filter((x) => !x.t.completed).sort(sortFn);
    const done = d.tasks.map((t, i) => ({ t, i })).filter((x) => x.t.completed);

    for (const { t, i } of pending) this.taskRow(list, t, i);
    if (done.length && pending.length) list.createDiv({ cls: "zc-divider" });
    for (const { t, i } of done) this.taskRow(list, t, i);

  }

  private openAddTaskModal(): void {
    new AddTaskModal(this.app, async (task) => {
      const success = await this.taskSyncService.addTask(this.projPath, task.text, {
        created: task.created,
        due: task.due,
        dueTime: task.dueTime,
        priority: this.toStoragePriority(task.priority),
        tags: task.tags,
      });
      if (!success) {
        new Notice("添加任务失败，请检查项目主页文件");
        return;
      }
      await this.loadProjectData();
      this.render();
    }).open();
  }

  private taskRow(p: HTMLElement, t: ProjectConsoleTask, i: number) {
    const row = p.createDiv({ cls: `zc-row${t.completed ? " is-done" : ""}` });

    // 复选框
    const ck = row.createDiv({ cls: "zc-check" });
    ck.innerHTML = t.completed ? SVG.checkCircle : SVG.circle;
    ck.addEventListener("click", async () => {
      const source = this.timelineTasks[i];
      if (!source) {
        new Notice("任务数据已变化，请刷新后重试");
        return;
      }
      const success = await this.taskSyncService.toggleTask(this.projPath, source.line, source.raw);
      if (!success) {
        new Notice("任务已发生变化，请刷新后重试");
        await this.loadProjectData();
        this.render();
        return;
      }
      await this.loadProjectData();
      this.render();
    });

    // 任务内容区域
    const content = row.createDiv({ cls: "zc-row-content" });

    // 第一行：任务文本 + 优先级标签
    const firstLine = content.createDiv({ cls: "zc-row-first-line" });
    const taskText = firstLine.createDiv({ cls: "zc-row-text zc-row-markdown zc-inline-markdown markdown-preview-view markdown-rendered" });
    void MarkdownRenderer.renderMarkdown(t.text, taskText, this.projPath, null as any);

    // 优先级标签
    if (t.priority) {
      renderTaskPriorityLabel(firstLine, t.priority);
    }

    // 第二行：标签 + 截止日期
    const secondLine = content.createDiv({ cls: "zc-row-second-line" });

    // 标签
    if (t.tags && t.tags.length > 0) {
      const tagsContainer = secondLine.createDiv({ cls: "zc-tags" });
      for (const tag of t.tags) {
        tagsContainer.createSpan({ cls: "zc-tag", text: tag });
      }
    }

    // 截止日期
    if (t.due) {
      const dueEl = secondLine.createSpan({ cls: "zc-due" });
      dueEl.appendChild(svg("clock"));
      dueEl.createSpan({ text: t.dueTime ? `${t.due} ${t.dueTime}` : t.due });

      // 检查是否逾期
      const today = formatDate(new Date());
      if (t.due < today && !t.completed) {
        dueEl.addClass("zc-due-overdue");
      }
    }

    // 删除按钮
    const del = row.createDiv({ cls: "zc-del" });
    del.innerHTML = SVG.trash;
    del.addEventListener("click", async () => {
      const source = this.timelineTasks[i];
      if (!source) {
        new Notice("任务数据已变化，请刷新后重试");
        return;
      }
      const success = await this.taskSyncService.deleteTask(this.projPath, source.line, source.raw);
      if (!success) {
        new Notice("删除失败，任务内容可能已发生变化");
        return;
      }
      await this.loadProjectData();
      this.render();
    });
  }

  /** 交付物 */
  private deliverables(c: HTMLElement) {
    const d = this.data!;
    const scroll = c.createDiv({ cls: "zc-scroll" });
    const header = scroll.createDiv("zc-release-header");
    const headerCopy = header.createDiv("zc-release-header-copy");
    headerCopy.createDiv({ cls: "zc-release-title", text: "交付物" });
    headerCopy.createDiv({
      cls: "zc-release-subtitle",
      text: d.deliverables.length
        ? `已发布 ${d.deliverables.filter((item) => item.format === "zip").length} 个版本`
        : "将阶段成果封装为不可编辑的 ZIP",
    });
    const submit = header.createEl("button", {
      cls: "zc-release-submit",
      attr: { type: "button" },
    });
    submit.appendChild(svg("plus"));
    submit.createSpan({ text: "提交交付物" });
    const configuredFolder = this.releaseService.resolveFolder(this.projPath, d.type);
    submit.disabled = !configuredFolder;
    submit.title = configuredFolder ? `发布到 ${configuredFolder.folderName}` : "请先配置当前项目分类的交付物文件夹";
    submit.addEventListener("click", () => {
      if (!configuredFolder) {
        new Notice("请先在设置 → 项目子文件夹中配置交付物文件夹");
        return;
      }
      new SubmitDeliverableModal(this.app, this.projPath, d.type, this.releaseService, async (name, description, paths) => {
        const release = await this.releaseService.publish({
          projectPath: this.projPath,
          projectType: d.type,
          releaseName: name,
          description,
          sourcePaths: paths,
        });
        if (!(await this.services.projectData.mutateProjectConsoleData(this.projPath, (latest) => {
          latest.deliverables = [...latest.deliverables, release];
        }))) {
          throw new Error("发布包已生成，但项目记录未写入；请勿重复使用同一发布名称");
        }
        this.services.clearProjectCache(this.projPath);
        this.services.timeline.clearCache(this.projPath);
        await this.loadProjectData();
        this.render();
        new Notice(`已发布交付物：${release.name}`);
      }).open();
    });

    const list = scroll.createDiv({ cls: "zc-release-list" });
    if (!d.deliverables.length) {
      const e = list.createDiv({ cls: "zc-empty" });
      e.createDiv({ cls: "zc-empty-icon" }).innerHTML = SVG.package;
      e.createDiv({ cls: "zc-empty-title", text: "还没有交付物" });
      e.createDiv({
        cls: "zc-empty-sub",
        text: configuredFolder ? `发布包将保存到 ${configuredFolder.folderName}` : "请先配置交付物文件夹",
      });
      return;
    }
    for (const item of d.deliverables) {
      const isRelease = item.format === "zip";
      const row = list.createDiv({ cls: `zc-release-row${isRelease ? "" : " is-legacy"}` });
      const ic = row.createDiv({ cls: "zc-release-icon" });
      ic.innerHTML = SVG.package;
      const main = row.createDiv("zc-release-main");
      const nameRow = main.createDiv("zc-release-name-row");
      nameRow.createSpan({ cls: "zc-release-name", text: item.name });
      if (!isRelease) nameRow.createSpan({ cls: "zc-release-legacy", text: "旧版交付物" });
    if (item.description) {
      const description = main.createDiv({ cls: "zc-release-description zc-row-markdown zc-inline-markdown markdown-preview-view markdown-rendered" });
      void MarkdownRenderer.renderMarkdown(item.description, description, this.projPath, null as any);
    }
      const meta = main.createDiv("zc-release-meta");
      if (isRelease) {
        meta.createSpan({ text: `${item.fileCount ?? 0} 个文件` });
        if (item.createdAt) meta.createSpan({ text: fmtDate(item.createdAt) });
      } else if (item.status) {
        meta.createSpan({ text: item.status });
      }
      meta.createSpan({ cls: "zc-release-path", text: item.path });

      const actions = row.createDiv("zc-release-actions");
      const open = actions.createEl("button", {
        attr: { type: "button", "aria-label": isRelease ? "打开 ZIP 文件" : "打开交付物" },
      });
      open.appendChild(svg("folder"));
      open.addEventListener("click", () => this.openRel(item.path));
      if (isRelease) {
        const remove = actions.createEl("button", {
          cls: "is-danger",
          attr: { type: "button", "aria-label": "删除交付物" },
        });
        remove.appendChild(svg("trash"));
        remove.addEventListener("click", async () => {
          if (!window.confirm(`删除“${item.name}”？\n这会删除项目记录和对应 ZIP，但不会删除任何源文件。`)) return;
          if (!(await this.services.projectData.mutateProjectConsoleData(this.projPath, (latest) => {
            latest.deliverables = latest.deliverables.filter((candidate) =>
              candidate.id ? candidate.id !== item.id : candidate !== item
            );
          }))) {
            new Notice("交付物记录删除失败");
            return;
          }
          try {
            await this.releaseService.deleteArchive(this.projPath, d.type, item);
          } catch (error) {
            new Notice(error instanceof Error ? `记录已删除，但 ZIP 删除失败：${error.message}` : "记录已删除，但 ZIP 删除失败");
          }
          this.services.clearProjectCache(this.projPath);
          this.services.timeline.clearCache(this.projPath);
          await this.loadProjectData();
          this.render();
          new Notice(`已删除交付物：${item.name}`);
        });
      }
    }
  }

  /** 最近文件 */
  private files(c: HTMLElement) {
    const fs = this.recent(30);
    const scroll = c.createDiv({ cls: "zc-scroll" });
    const list = scroll.createDiv({ cls: "zc-list" });
    if (!fs.length) {
      const e = list.createDiv({ cls: "zc-empty" });
      e.createDiv({ cls: "zc-empty-icon" }).innerHTML = SVG.fileStack;
      e.createDiv({ cls: "zc-empty-title", text: "暂无文件" });
      return;
    }
    for (const f of fs) {
      const row = list.createDiv({ cls: "zc-row zc-clickable" });
      const ic = row.createDiv({ cls: "zc-row-icon" });
      ic.innerHTML = SVG.fileText;
      const wrap = row.createDiv({ cls: "zc-row-main" });
      wrap.createSpan({ cls: "zc-row-text", text: f.name });
      const folder = f.path.split("/").slice(-2, -1)[0] || "";
      if (folder) wrap.createSpan({ cls: "zc-row-sub", text: folder });
      row.createSpan({ cls: "zc-row-time", text: relTime(f.mtime) });
      row.addEventListener("click", () => this.openRel(f.path));
    }
  }

  /** 右侧近期活动 */
  private renderRecentActivity(parent: HTMLElement): void {
    const activity = parent.createDiv({ cls: "zc-workspace-index zc-recent-activity" });
    activity.createDiv({ cls: "zc-aside-title", text: "近期活动" });
    const scroll = activity.createDiv({ cls: "zc-recent-activity-scroll" });
    const recentFiles = this.recent(5);
    if (recentFiles.length === 0) {
      scroll.createDiv({ cls: "zc-summary-empty", text: "项目活动会显示在这里" });
    } else {
      for (const file of recentFiles) {
        const row = scroll.createDiv({ cls: "zc-summary-row zc-clickable" });
        const mark = row.createSpan({ cls: "zc-summary-mark" });
        mark.innerHTML = SVG.fileEdit;
        const copy = row.createDiv({ cls: "zc-summary-copy" });
        copy.createSpan({ cls: "zc-summary-primary", text: file.name });
        copy.createSpan({ cls: "zc-summary-secondary", text: "最近编辑" });
        row.createSpan({ cls: "zc-summary-time", text: relTime(file.mtime) });
        row.addEventListener("click", () => this.openRel(file.path));
      }
    }
  }

  // ── 工具 ──────────────────────────────────────────

  private toDisplayPriority(priority: Task["priority"]): import("./types").TaskPriority | undefined {
    const map = { urgent: "P0", high: "P1", medium: "P2", low: "P3" } as const;
    return priority ? map[priority] : undefined;
  }

  private toStoragePriority(priority: import("./types").TaskPriority | undefined): Task["priority"] {
    const map = { P0: "urgent", P1: "high", P2: "medium", P3: "low" } as const;
    return priority ? map[priority] : undefined;
  }

  private async openRel(rel: string) {
    const direct = this.app.vault.getAbstractFileByPath(rel);
    const f = direct instanceof TFile
      ? direct
      : this.app.vault.getAbstractFileByPath(`${this.projPath}/${rel}`);
    if (f instanceof TFile) await this.app.workspace.getLeaf(false).openFile(f);
  }

  /** 时间轴列表 */
  private async timeline(c: HTMLElement) {
    const scroll = c.createDiv({ cls: "zc-scroll" });
    const container = scroll.createDiv({ cls: "zc-timeline-container" });

    const toolbar = container.createDiv({ cls: "zc-timeline-toolbar" });
    const toolbarCopy = toolbar.createDiv({ cls: "zc-timeline-toolbar-copy" });
    toolbarCopy.createDiv({ cls: "zc-timeline-heading", text: "项目活动" });
    toolbarCopy.createDiv({ cls: "zc-timeline-kicker", text: "轻量快照 · 自动记录文本文件版本" });
    const checkpointButton = toolbar.createEl("button", {
      cls: "zc-timeline-checkpoint",
      text: "创建检查点",
      attr: { type: "button" },
    });
    checkpointButton.prepend(svg("flag"));
    checkpointButton.addEventListener("click", () => {
      new CreateCheckpointModal(this.app, async (name) => {
        await this.services.snapshots.createCheckpoint(this.projPath, name);
        this.services.timeline.clearCache(this.projPath);
        new Notice("项目检查点已创建");
        c.empty();
        await this.timeline(c);
      }).open();
    });

    const filters = [
      { id: "all", label: "全部" },
      { id: "files", label: "文件版本" },
      { id: "tasks", label: "任务" },
      { id: "project", label: "项目事件" },
      { id: "checkpoints", label: "检查点" },
    ] as const;
    const filterBar = container.createDiv({ cls: "zc-timeline-filters" });
    for (const filter of filters) {
      const button = filterBar.createEl("button", {
        cls: `zc-timeline-filter${this.timelineFilter === filter.id ? " is-active" : ""}`,
        text: filter.label,
        attr: { type: "button", "aria-pressed": String(this.timelineFilter === filter.id) },
      });
      button.addEventListener("click", () => {
        if (this.timelineFilter === filter.id) return;
        this.timelineFilter = filter.id;
        c.empty();
        void this.timeline(c);
      });
    }

    // 显示加载状态
    const loading = container.createDiv({ cls: "zc-loading", text: "加载时间轴..." });

    try {
      // 异步加载时间轴数据
      const timelineData = await this.services.timeline.getProjectTimeline(this.projPath);

      // 移除加载提示
      loading.remove();

      const visibleEvents = timelineData.events.filter((event) => this.matchesTimelineFilter(event));

      if (!visibleEvents.length) {
        const e = container.createDiv({ cls: "zc-empty" });
        e.createDiv({ cls: "zc-empty-icon" }).innerHTML = SVG.clock;
        e.createDiv({ cls: "zc-empty-title", text: "当前分类暂无活动" });
        e.createDiv({ cls: "zc-empty-sub", text: "编辑项目文件或创建检查点后，记录会显示在这里" });
        return;
      }

      // 按日期分组
      const byDate = new Map<string, TimelineEvent[]>();
      for (const event of visibleEvents) {
        if (!byDate.has(event.date)) {
          byDate.set(event.date, []);
        }
        byDate.get(event.date)!.push(event);
      }

      // 渲染时间轴
      const sortedDates = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a));

      for (const date of sortedDates.slice(0, 30)) { // 只显示最近30天
        const events = byDate.get(date)!;

        // 日期分隔
        const dateHeader = container.createDiv({ cls: "zc-timeline-date" });
        dateHeader.createDiv({ cls: "zc-timeline-date-text", text: this.formatTimelineDate(date) });

        // 事件列表
        const eventList = container.createDiv({ cls: "zc-timeline-events" });

        for (const event of events) {
          const eventEl = eventList.createDiv({ cls: "zc-timeline-event" });
          eventEl.dataset.eventType = event.type;
          if (event.snapshotId) eventEl.dataset.hasSnapshot = "true";
          if (event.checkpointId) eventEl.dataset.hasCheckpoint = "true";
          eventEl.title = new Date(event.timestamp).toLocaleString();

          const time = eventEl.createDiv({
            cls: `zc-timeline-time${event.approximateTime ? " is-approximate" : ""}`,
            text: `${event.approximateTime ? "约 " : ""}${this.formatTimelineClock(event.timestamp)}`,
          });
          time.setAttribute("aria-label", eventEl.title);

          // 连续轨道与事件节点
          const rail = eventEl.createDiv({ cls: "zc-timeline-rail" });
          const iconEl = rail.createDiv({ cls: "zc-timeline-icon" });
          iconEl.innerHTML = this.getTimelineIcon(event.type);

          // 事件内容
          const content = eventEl.createDiv({ cls: "zc-timeline-content" });
          const title = content.createDiv({ cls: "zc-timeline-title", text: event.title });

          if (event.description) {
            content.createDiv({ cls: "zc-timeline-desc", text: event.description });
          }

          const actions = eventEl.createDiv({ cls: "zc-timeline-actions" });
          if (event.filePath) {
            const openButton = actions.createEl("button", {
              cls: "zc-timeline-action",
              text: "打开",
              attr: { type: "button" },
            });
            openButton.addEventListener("click", async () => {
              const file = this.app.vault.getAbstractFileByPath(event.filePath!);
              if (file instanceof TFile) {
                await this.app.workspace.getLeaf(false).openFile(file);
              } else {
                new Notice("文件当前不存在，可从历史版本恢复");
              }
            });
          }
          if (event.snapshotId) {
            const versionButton = actions.createEl("button", {
              cls: "zc-timeline-action is-version",
              attr: { type: "button", "aria-label": "查看文件版本详情" },
            });
            versionButton.appendChild(svg("fileStack"));
            versionButton.createSpan({ text: "版本" });
            versionButton.addEventListener("click", () => {
              new SnapshotDiffModal(this.app, this.services, event.snapshotId!, async () => {
                this.services.timeline.clearCache(this.projPath);
                await this.loadProjectData();
                this.render();
              }).open();
            });
          }
          if (event.checkpointId) {
            const checkpointId = event.checkpointId;
            const restoreButton = actions.createEl("button", {
              cls: "zc-timeline-action is-checkpoint-restore",
              attr: { type: "button", "aria-label": "退回到此检查点" },
            });
            restoreButton.appendChild(svg("checkCircle"));
            restoreButton.createSpan({ text: "恢复" });
            restoreButton.addEventListener("click", async () => {
              const checkpoint = await this.services.snapshots.getCheckpoint(checkpointId);
              if (!checkpoint) {
                new Notice("检查点不存在或已被删除");
                return;
              }
              new ConfirmCheckpointRestoreModal(this.app, checkpoint, async () => {
                const result = await this.services.snapshots.restoreCheckpoint(checkpointId);
                if (!result) {
                  new Notice("检查点恢复失败");
                  return;
                }
                this.services.clearProjectCache(this.projPath);
                this.services.timeline.clearCache(this.projPath);
                await this.loadProjectData();
                this.render();
                const removedText = result.removed > 0 ? `，移除 ${result.removed} 个新增文件` : "";
                const failedText = result.failed.length > 0 ? `，${result.failed.length} 个文件失败` : "";
                new Notice(`已恢复 ${result.restored} 个文件${removedText}${failedText}`);
              }).open();
            });

            const deleteButton = actions.createEl("button", {
              cls: "zc-timeline-action is-checkpoint-delete",
              attr: { type: "button", "aria-label": "删除此检查点" },
            });
            deleteButton.appendChild(svg("trash"));
            deleteButton.createSpan({ text: "删除" });
            deleteButton.addEventListener("click", async () => {
              const checkpoint = await this.services.snapshots.getCheckpoint(checkpointId);
              if (!checkpoint) {
                new Notice("检查点不存在或已被删除");
                return;
              }
              new ConfirmCheckpointDeleteModal(this.app, checkpoint, async () => {
                if (!(await this.services.snapshots.deleteCheckpoint(checkpointId))) {
                  new Notice("检查点删除失败");
                  return;
                }
                this.services.timeline.clearCache(this.projPath);
                this.render();
                new Notice("检查点已删除");
              }).open();
            });
          }
          if (!actions.childElementCount) actions.remove();
        }
      }

      // 统计信息
      const statsEl = container.createDiv({ cls: "zc-timeline-stats" });
      const now = Date.now();
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
      const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
      statsEl.createDiv({ text: `当前显示 ${visibleEvents.length} 个事件` });
      statsEl.createDiv({ text: `近 7 天 ${visibleEvents.filter((event) => event.timestamp >= weekAgo).length} 个` });
      statsEl.createDiv({ text: `近 30 天 ${visibleEvents.filter((event) => event.timestamp >= monthAgo).length} 个` });

    } catch (error) {
      loading.remove();
      const errorEl = container.createDiv({ cls: "zc-error" });
      errorEl.createDiv({ text: "加载时间轴失败" });
      console.error("[ProjectConsoleView] 时间轴加载失败:", error);
    }
  }

  private matchesTimelineFilter(event: TimelineEvent): boolean {
    if (this.timelineFilter === "all") return true;
    if (this.timelineFilter === "files") return event.type.startsWith("file-");
    if (this.timelineFilter === "tasks") return event.type.startsWith("task-");
    if (this.timelineFilter === "checkpoints") return event.type === "checkpoint";
    return ["deliverable-added", "milestone", "status-changed"].includes(event.type);
  }

  private formatTimelineClock(timestamp: number): string {
    const date = new Date(timestamp);
    return [date.getHours(), date.getMinutes()]
      .map((part) => String(part).padStart(2, "0"))
      .join(":");
  }

  /** 格式化时间轴日期 */
  private formatTimelineDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateOnly = (d: Date) => formatDate(d);

    if (dateOnly(date) === dateOnly(today)) {
      return "今天";
    } else if (dateOnly(date) === dateOnly(yesterday)) {
      return "昨天";
    } else {
      return dateStr;
    }
  }

  /** 获取时间轴图标 */
  private getTimelineIcon(type: string): string {
    const icons: Record<string, string> = {
      "file-created": SVG.filePlus,
      "file-modified": SVG.fileEdit,
      "file-deleted": SVG.trash,
      "file-restored": SVG.checkCircle,
      "task-created": SVG.plus,
      "task-completed": SVG.check,
      "deliverable-added": SVG.package,
      "milestone": SVG.flag,
      "status-changed": SVG.flag,
      "checkpoint": SVG.flag,
    };
    return icons[type] || SVG.circle;
  }

  /** 数据可视化 */
  private async analytics(c: HTMLElement) {
    const scroll = c.createDiv({ cls: "zc-scroll" });
    const container = scroll.createDiv({ cls: "zc-analytics-container" });

    // 显示加载状态
    const loading = container.createDiv({ cls: "zc-loading", text: "加载数据..." });

    try {
      // 并行加载数据
      const [trend, heatmap, stats] = await Promise.all([
        this.services.statistics.getActivityTrend(this.projPath, 30),
        this.services.timeline.getActivityHeatmap(this.projPath, 365),
        this.services.statistics.getTaskStatistics(this.projPath),
      ]);

      // 移除加载提示
      loading.remove();

      // 概览卡片
      this.renderOverviewCards(container, stats);

      // 任务完成趋势图
      this.renderTrendChart(container, trend);

      // 活动热力图
      this.renderHeatmap(container, heatmap);

    } catch (error) {
      loading.remove();
      const errorEl = container.createDiv({ cls: "zc-error" });
      errorEl.createDiv({ text: "加载数据失败" });
      console.error("[ProjectConsoleView] 数据加载失败:", error);
    }
  }

  /** 渲染概览卡片 */
  private renderOverviewCards(container: HTMLElement, stats: any) {
    const cards = container.createDiv({ cls: "zc-analytics-cards" });

    const items = [
      { label: "总任务", value: String(stats.total), icon: "📋" },
      { label: "已完成", value: String(stats.completed), icon: "✅" },
      { label: "进行中", value: String(stats.pending), icon: "⏳" },
      { label: "完成率", value: `${stats.completionRate.toFixed(1)}%`, icon: "📊" },
      { label: "逾期", value: String(stats.overdue), icon: "⚠️", warning: stats.overdue > 0 },
    ];

    for (const item of items) {
      const card = cards.createDiv({ cls: "zc-analytics-card" });
      if (item.warning) {
        card.addClass("zc-analytics-card-warning");
      }

      const icon = card.createDiv({ cls: "zc-analytics-card-icon" });
      icon.textContent = item.icon;

      const content = card.createDiv({ cls: "zc-analytics-card-content" });
      content.createDiv({ cls: "zc-analytics-card-value", text: item.value });
      content.createDiv({ cls: "zc-analytics-card-label", text: item.label });
    }
  }

  /** 渲染趋势图 */
  private renderTrendChart(container: HTMLElement, trend: Array<{ date: string; count: number }>) {
    const section = container.createDiv({ cls: "zc-analytics-section" });
    section.createDiv({ cls: "zc-analytics-section-title", text: "活动趋势（最近30天）" });

    const chartContainer = section.createDiv({ cls: "zc-chart-container" });

    // 准备数据
    const labels = trend.map((d) => {
      const date = new Date(d.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });
    const data = trend.map((d) => d.count);

    // 创建折线图
    new LineChart(chartContainer, {
      labels,
      datasets: [{
        label: "活动次数",
        data,
        color: "#3b82f6",
        fillColor: "#3b82f6",
      }],
    }, {
      width: 800,
      height: 250,
      showGrid: true,
      showTooltip: true,
      animate: true,
    });
  }

  /** 渲染热力图 */
  private renderHeatmap(container: HTMLElement, heatmap: Map<string, number>) {
    const section = container.createDiv({ cls: "zc-analytics-section" });
    section.createDiv({ cls: "zc-analytics-section-title", text: "活动热力图（最近365天）" });

    const chartContainer = section.createDiv({ cls: "zc-chart-container" });

    // 准备数据
    const data = Array.from(heatmap.entries()).map(([date, value]) => ({
      date,
      value,
    }));

    // 创建热力图
    new HeatmapChart(chartContainer, data, {
      width: 800,
      height: 150,
      colorScale: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
      showMonthLabels: true,
      showDayLabels: true,
      showTooltip: true,
    });
  }

  private renderIcon(el: HTMLElement, id: string) {
    const customIcons = this.settingsManager.getSettings().iconSystem.customIcons;
    const customIcon = customIcons[this.projPath] || customIcons[this.file?.path || ""];
    const iconId = customIcon || id;
    let icon: SVGElement | null = null;

    if (iconId?.startsWith("lucide-")) {
      icon = getIcon(iconId.slice(7));
    }

    el.empty();
    if (icon) {
      el.appendChild(icon);
    } else {
      el.innerHTML = SVG.folder;
      icon = el.querySelector("svg");
    }

    if (icon) {
      icon.classList.add("zc-project-title-svg");
      icon.setAttribute("aria-hidden", "true");
      icon.removeAttribute("width");
      icon.removeAttribute("height");

      // Border/Phycat 对内联 SVG 有全局规则；将项目图标转为元素级蒙版变量，
      // 由 CSS 负责着色，避免图标被主题级 SVG 样式隐藏。
      const iconData = encodeURIComponent(icon.outerHTML);
      el.style.setProperty(
        "--zc-project-icon-mask",
        `url("data:image/svg+xml,${iconData}")`,
      );
    }

    el.dataset.iconId = iconId || "lucide-folder";
  }

}

export function createDefaultConsoleData(name: string, icon: string, type: ProjectType, desc = ""): ProjectConsoleData {
  return {
    name,
    icon,
    description: desc,
    type,
    status: "planning",
    statusHistory: [],
    createdAt: formatDate(new Date()),
    tasks: [],
    deliverables: [],
    overview: { markdown: desc },
    timeline: { milestones: [] },
  };
}
