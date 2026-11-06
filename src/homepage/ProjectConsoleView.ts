import { changeProjectStage } from "./services/project-stage";
import { projectFileStem } from "../utils/project-path";
import type { ActivityLogService } from "../services/ActivityLogService";
import { TaskEditModal } from "./TaskEditModal";
import { ProjectDetailsModal } from "./ProjectDetailsModal";
/**
 * ProjectConsoleView — 项目控制台视图（仪表盘风格）
 */

import { FileView, ItemView, type WorkspaceLeaf, type App, TFile, TFolder, Menu, Modal, Setting, Notice, MarkdownRenderer } from "obsidian";
import type {
  ProjectConsoleData,
  ProjectConsoleTask,
  ProjectRecentFile,
} from "./types";
import { getProjectTypeColor } from "./project-categories";
import {
  calculateProjectProgress,
  PROJECT_STATUS_OPTIONS,
  PROJECT_PROGRESS_STEPS,
  getProjectStatusOption,
  normalizeProjectStatus,
  normalizeStatusBeforePause,
  type ProjectStatus,
} from "./project-status";
import { getServiceManager } from "./services";
import type { ServiceManager, ProjectStatistics, ProjectHealth, ProjectCheckpoint } from "./services";
import { LineChart } from "./components/charts";
import { mountActivityHeatmap } from "./components/ActivityHeatmap";
import type { Task } from "../services/TaskSyncService";
import { TaskSyncService } from "../services/TaskSyncService";
import type { DataChangeCallback, TaskStatistics, TimelineEvent } from "./services/types";
import { renderTaskPriorityLabel } from "./components/TaskPriorityLabel";
import { createTaskSchedulePicker } from "./components/TaskSchedulePicker";
import type { SettingsManager } from "../core/settings-manager";
import type { EventBus } from "../core/event-bus";
import { Events } from "../core/event-bus";
import { DeliverableReleasePendingRecordError, DeliverableReleaseService } from "./services/DeliverableReleaseService";
import { ProjectRegistry } from "./services/ProjectRegistry";
import {
  getProjectSystemDirectory,
  LEGACY_PROJECT_CONSOLE_FOLDER,
} from "./services/ProjectHomeFileResolver";
import { formatDate } from "../utils/date";
import { openPopoutForm } from "../ui/popout-form";
import { resolveIconSvg } from "../utils/icon-renderer";
import { confirmAction } from "../ui/confirm-modal";

export const VIEW_TYPE_PROJECT_CONSOLE = "zendian-project-console";
export const VIEW_TYPE_PROJECT_TASK_CREATE = "zendian-project-task-create";

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

function rebasePath(path: string, oldBase: string, newBase: string): string {
  if (path === oldBase) return newBase;
  return path.startsWith(`${oldBase}/`) ? `${newBase}${path.slice(oldBase.length)}` : path;
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
    this.modalEl.addClass("zendian-shared-modal");
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
    this.modalEl.addClass("zendian-shared-modal");
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
  private destroySchedulePicker: (() => void) | null = null;
  private cb: (t: ProjectConsoleTask) => Promise<void>;

  constructor(app: App, cb: (t: ProjectConsoleTask) => Promise<void>) { super(app); this.cb = cb; }

  onOpen() {
    this.modalEl.addClass("zendian-shared-modal");
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
      b.setButtonText("添加").setCta().onClick(async () => {
        const v = this.text.trim();
        if (!v) return;
        if (this.dueTime && !this.due) {
          new Notice("填写时间前请先选择截止日期");
          return;
        }
        b.setDisabled(true);
        try {
        await this.cb({
          text: v,
          completed: false,
          created: formatDate(new Date()),
          due: this.due.trim() || undefined,
          dueTime: this.dueTime.trim() || undefined,
          priority: this.priority,
          tags: this.tags.length > 0 ? this.tags : undefined,
        });
        this.close();
        } catch (error) {
          new Notice(String(error));
          b.setDisabled(false);
        }
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

export class ProjectTaskCreatePopoutView extends ItemView {
  private projectPath = "";
  private projectId: string | null = null;
  private saving = false;
  private text = "";
  private due = "";
  private dueTime = "";
  private priority: TaskPriority = "P2";
  private tags: string[] = [];
  private destroySchedulePicker: (() => void) | null = null;

  constructor(leaf: WorkspaceLeaf, private taskSyncService: TaskSyncService) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_PROJECT_TASK_CREATE;
  }

  getDisplayText(): string {
    return "添加任务";
  }

  getIcon(): string {
    return "square-check-big";
  }

  getState(): Record<string, unknown> {
    return { projectPath: this.projectPath, projectId: this.projectId,
      text: this.text, due: this.due, dueTime: this.dueTime,
      priority: this.priority, tags: [...this.tags] };
  }

  async setState(state: Record<string, unknown>, result: any): Promise<void> {
    if (this.saving) return;
    this.projectPath = typeof state.projectPath === "string" ? state.projectPath : "";
    this.projectId = typeof state.projectId === "string" && state.projectId ? state.projectId : null;
    this.text = typeof state.text === "string" ? state.text : "";
    this.due = typeof state.due === "string" ? state.due : "";
    this.dueTime = typeof state.dueTime === "string" ? state.dueTime : "";
    this.priority = ["P0", "P1", "P2", "P3"].includes(String(state.priority)) ? state.priority as TaskPriority : "P2";
    this.tags = Array.isArray(state.tags) ? state.tags.filter((tag): tag is string => typeof tag === "string") : [];
    await super.setState(state, result);
    await this.onOpen();
  }

  async onOpen(): Promise<void> {
    this.destroySchedulePicker?.();
    this.destroySchedulePicker = null;
    const c = this.containerEl.children[1] as HTMLElement;
    const persistDraft = () => this.app.workspace.requestSaveLayout();
    c.empty();
    c.addClass("zendian-popout-form");
    c.createEl("h2", { text: "添加任务" });

    if (!this.projectPath) {
      c.createDiv({ cls: "zc-empty-sub", text: "缺少项目路径，无法添加任务" });
      return;
    }

    const taskContentSetting = new Setting(c).setName("任务内容");
    taskContentSetting.settingEl.addClass("zc-task-content-setting");
    taskContentSetting.addTextArea((t) => {
      t.setPlaceholder("输入任务内容，支持 Markdown 和换行").setValue(this.text).onChange((v) => { this.text = v; persistDraft(); });
      t.inputEl.addClass("zc-long-textarea");
    });

    const scheduleSetting = new Setting(c).setName("截止时间");
    scheduleSetting.settingEl.addClass("zendian-task-schedule-setting");
    scheduleSetting.controlEl.addClass("zendian-task-schedule-controls");
    this.destroySchedulePicker = createTaskSchedulePicker(scheduleSetting.controlEl, { date: this.due, time: this.dueTime }, (value) => {
      this.due = value.date;
      this.dueTime = value.time;
      persistDraft();
    });

    const prioritySetting = new Setting(c).setName("优先级");
    const prioritySelect = prioritySetting.controlEl.createEl("select");
    const priorities: TaskPriority[] = ["P0", "P1", "P2", "P3"];
    for (const p of priorities) {
      const option = prioritySelect.createEl("option", { value: p, text: `${TASK_PRIORITY_LABELS[p]} (${p})` });
      if (p === this.priority) option.selected = true;
    }
    prioritySelect.addEventListener("change", () => {
      this.priority = prioritySelect.value as TaskPriority;
      persistDraft();
    });

    const tagSetting = new Setting(c).setName("标签");
    const tagContainer = tagSetting.controlEl.createDiv({ cls: "zc-tag-container" });
    const tagInput = tagContainer.createEl("input", {
      cls: "zc-tag-input",
      attr: { type: "text", placeholder: "输入标签后回车" },
    });
    const tagList = tagContainer.createDiv({ cls: "zc-tag-list" });
    this.renderTags(tagList);
    tagInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && tagInput.value.trim()) {
        const tag = tagInput.value.trim();
        if (!this.tags.includes(tag)) {
          this.tags.push(tag);
          persistDraft();
          this.renderTags(tagList);
        }
        tagInput.value = "";
        e.preventDefault();
      }
    });

    const actions = c.createDiv("zendian-popout-form-actions");
    const cancel = actions.createEl("button", { text: "取消", attr: { type: "button" } });
    cancel.addEventListener("click", () => this.closeLeaf());
    const submit = actions.createEl("button", { cls: "mod-cta", text: "添加", attr: { type: "button" } });
    submit.addEventListener("click", async () => {
      if (this.saving) return;
      const v = this.text.trim();
      if (!v) {
        new Notice("请填写任务内容");
        return;
      }
      if (this.dueTime && !this.due) {
        new Notice("填写时间前请先选择截止日期");
        return;
      }
      this.saving = true;
      submit.disabled = true;
      try {
      const success = await this.taskSyncService.addTask(this.projectPath, v, {
        expectedProjectId: this.projectId,
        created: formatDate(new Date()),
        due: this.due.trim() || undefined,
        dueTime: this.dueTime.trim() || undefined,
        priority: this.toStoragePriority(this.priority),
        tags: this.tags.length > 0 ? this.tags : undefined,
      });
      if (!success) {
        new Notice("添加任务失败，项目可能已移动或身份发生变化；输入仍保留，请重新打开原项目核对");
        return;
      }
      new Notice("任务已添加");
      this.text = ""; this.tags = []; this.due = ""; this.dueTime = "";
      persistDraft();
      this.closeLeaf();
      } catch (error) {
        new Notice(`任务未保存：${String(error)}`);
      } finally {
        this.saving = false;
        submit.disabled = false;
      }
    });

    setTimeout(() => {
      const input = c.querySelector("textarea") as HTMLTextAreaElement | null;
      input?.focus();
    }, 50);
  }

  async onClose(): Promise<void> {
    this.destroySchedulePicker?.();
    this.destroySchedulePicker = null;
    const c = this.containerEl.children[1] as HTMLElement | undefined;
    c?.empty();
  }

  private renderTags(container: HTMLElement): void {
    container.empty();
    for (const tag of this.tags) {
      const tagEl = container.createDiv({ cls: "zc-tag" });
      tagEl.createSpan({ text: tag });
      const removeBtn = tagEl.createSpan({ cls: "zc-tag-remove", text: "×" });
      removeBtn.addEventListener("click", () => {
        this.tags = this.tags.filter((t) => t !== tag);
        this.app.workspace.requestSaveLayout();
        this.renderTags(container);
      });
    }
  }

  private toStoragePriority(priority: TaskPriority | undefined): Task["priority"] {
    const map = { P0: "urgent", P1: "high", P2: "medium", P3: "low" } as const;
    return priority ? map[priority] : undefined;
  }

  private closeLeaf(): void {
    void this.leaf.detach();
  }
}

class CreateCheckpointModal extends Modal {
  private name = "";

  constructor(app: App, private onCreate: (name: string) => Promise<void>) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("zendian-shared-modal");
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
        try {
          await this.onCreate(this.name);
          this.close();
        } catch (error) {
          new Notice(`检查点未创建：${String(error)}`);
          button.setDisabled(false);
        }
      }));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

function renderRestorePreview(container: HTMLElement, preview: { overwrite: string[]; create: string[]; preserve: string[] }): void {
  for (const [label, paths] of [["将覆盖", preview.overwrite], ["将补回", preview.create], ["保留新增文件", preview.preserve]] as const) {
    const details = container.createEl("details");
    details.createEl("summary", { text: `${label} ${paths.length} 个文件` });
    for (const path of paths) details.createEl("div", { text: path });
  }
}

class ConfirmCheckpointRestoreModal extends Modal {
  constructor(
    app: App,
    private checkpoint: ProjectCheckpoint,
    private onConfirm: () => Promise<void>,
    private preview: { overwrite: string[]; create: string[]; preserve: string[] },
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("zendian-shared-modal");
    const container = this.contentEl;
    container.addClass("zc-checkpoint-confirm");
    renderRestorePreview(container, this.preview);
    container.createEl("h2", { text: "退回检查点" });
    container.createEl("p", {
      text: `项目将恢复到“${this.checkpoint.name}”，共 ${Object.keys(this.checkpoint.versions).length} 个文件版本。`,
    });
    container.createDiv({
      cls: "zc-checkpoint-confirm-note",
      text: "恢复前会自动创建安全检查点；检查点之后新增的文件会保留。恢复范围为已记录的受支持文本文件；项目主页恢复工作内容，但保留已有操作历史。",
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
    this.modalEl.addClass("zendian-shared-modal");
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

class ConfirmTaskDeleteModal extends Modal {
  constructor(
    app: App,
    private taskText: string,
    private onConfirm: () => Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("zendian-shared-modal");
    const container = this.contentEl;
    container.addClass("zc-checkpoint-confirm");
    container.createEl("h2", { text: "删除任务" });
    container.createEl("p", { text: `确定删除“${this.taskText}”吗？` });
    container.createDiv({
      cls: "zc-checkpoint-confirm-note",
      text: "任务会从项目主页移除，但删除记录会保留在项目动态中；完成后仍可在提示中撤销。",
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
    this.modalEl.addClass("zendian-shared-modal");
    const container = this.contentEl;
    container.createEl("h2", { text: "恢复文件版本" });
    container.createEl("p", { text: `将 ${this.filePath} 恢复到所选版本。恢复前会自动保存当前内容；项目主页的已有操作历史会保留。` });
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
    this.modalEl.addClass("zendian-shared-modal");
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
  private accessBlockedReason: string | null = null;
  private projPath = "";
  private layoutObserver: ResizeObserver | null = null;
  private quickTaskDraft = "";
  private tab: "overview" | "tasks" | "deliverables" | "recent" | "timeline" | "analytics" = "overview";
  private services: ServiceManager;
  private timelineTasks: Task[] = [];
  private fileWatcherCallback: DataChangeCallback | null = null;
  /** The path currently registered in FileWatcher; this can lag behind projPath during an async rebase. */
  private watchedProjectPath = "";
  private projectStats: ProjectStatistics | null = null;
  private health: ProjectHealth | null = null;
  private timelineFilter: "all" | "files" | "tasks" | "project" | "checkpoints" = "all";
  private releaseService: DeliverableReleaseService;
  private unsubSettings: (() => void) | null = null;
  private renameListenerRegistered = false;
  private projectPathChangeQueue: Promise<void> = Promise.resolve();
  private fileEpoch = 0;
  private dataLoadGeneration = 0;
  private heatmapCleanup: (() => void) | null = null;

  constructor(
    l: WorkspaceLeaf,
    private taskSyncService: TaskSyncService,
    private settingsManager: SettingsManager,
    private events: EventBus,
    private activityLog?: ActivityLogService,
  ) {
    super(l);
    this.services = getServiceManager(this.app, taskSyncService);
    this.releaseService = new DeliverableReleaseService(this.app, settingsManager);
  }

  private shouldOpenPanelsInNewWindow(): boolean {
    return this.settingsManager.getSettings().mobile.openPanelsInNewWindow ?? true;
  }

  private async openProjectPopout(options: Parameters<typeof openPopoutForm>[1]): Promise<boolean> {
    if (!this.shouldOpenPanelsInNewWindow()) return false;
    return openPopoutForm(this.app, options);
  }

  getViewType() { return VIEW_TYPE_PROJECT_CONSOLE; }
  getDisplayText() { return this.data?.name || "项目控制台"; }
  getIcon() { return "layout-dashboard"; }
  getExtension() { return "home"; }

  async onLoadFile(file: TFile) {
    const epoch = ++this.fileEpoch;
    this.stopProjectWatch();
    this.projPath = this.resolveProjectPath(file);
    this.accessBlockedReason = null;
    try {
      const discovery = await new ProjectRegistry(this.app).discover();
      if (epoch !== this.fileEpoch) return;
      const entry = discovery.projects.find(project => project.homePath === file.path);
      if (!entry || !["ready", "legacy"].includes(entry.state)) {
        this.data = null;
        this.accessBlockedReason = entry?.state === "duplicate"
          ? "项目身份或目录存在重复，已停止读取；请从“项目检查与关联”处理冲突。"
          : entry?.state === "nested"
            ? "项目目录包含另一个项目或位于另一个项目内，已停止读取；请先拆分目录。"
            : entry?.state === "root"
              ? "项目主页位于知识库根目录，已停止读取；请将项目移入独立文件夹后重新扫描。"
            : "项目主页无法通过身份核对，已停止读取；请检查文件内容或从首页执行项目检查。";
        this.render();
        return;
      }
    } catch (error) {
      console.error("[ProjectConsoleView] 项目身份核对失败", error);
      this.data = null;
      this.accessBlockedReason = "项目身份暂时无法核对，已停止写入；请稍后重新打开或执行项目检查。";
      this.render();
      return;
    }
    await this.loadProjectData();
    if (epoch !== this.fileEpoch) return;
    await this.services.trackProjectSnapshots(this.projPath);
    if (epoch !== this.fileEpoch) return;
    this.services.timeline.clearCache(this.projPath);

    // 开始监听文件变更
    this.fileWatcherCallback = async (event) => {
      if (epoch !== this.fileEpoch) return;
      console.log("[ProjectConsoleView] 文件变更，刷新数据", event);
      this.services.clearProjectCache(this.projPath);
      this.services.timeline.clearCache(this.projPath);
      await this.loadProjectData();
      if (epoch === this.fileEpoch) this.render();
    };
    this.services.fileWatcher.watchProject(this.projPath, this.fileWatcherCallback);
    this.watchedProjectPath = this.projPath;

    this.render();
  }

  async onUnloadFile() {
    ++this.fileEpoch;
    ++this.dataLoadGeneration;
    this.quickTaskDraft = "";
    this.disposeHeatmap();
    const c = this.containerEl.children[1];
    if (c) { c.empty(); c.removeClass("zc-root"); }
    this.data = null;
    this.accessBlockedReason = null;
    this.projectStats = null;
    this.health = null;

    // 停止监听。目录移动期间 projPath 会先切到新路径，必须解除实际已注册的旧路径。
    this.stopProjectWatch();
  }

  async onOpen() {
    // onLoadFile 可能先于 onOpen 执行，此时 children[1] 不存在
    // onOpen 时 DOM 一定就绪，补渲染
    if (this.data || this.accessBlockedReason) this.render();
    this.unsubSettings ??= this.events.on(Events.SETTINGS_CHANGED, (changedKeys: string[]) => {
      if (!changedKeys.includes("iconSystem") || !this.data) return;
      const iconEl = this.containerEl.querySelector(".zc-hero-title-icon") as HTMLElement | null;
      if (iconEl) void this.renderIcon(iconEl, this.data.icon);
    });
    if (!this.renameListenerRegistered) {
      this.renameListenerRegistered = true;
      this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
        if (!(file instanceof TFolder) || !this.projPath) return;
        if (oldPath !== this.projPath && !this.projPath.startsWith(`${oldPath}/`)) return;
        const newProjectPath = rebasePath(this.projPath, oldPath, file.path);
        this.queueProjectPathChange(this.projPath, newProjectPath);
      }));
    }
  }

  async onClose() {
    this.stopProjectWatch();
    this.layoutObserver?.disconnect();
    this.layoutObserver = null;
    this.disposeHeatmap();
    this.unsubSettings?.();
    this.unsubSettings = null;
  }

  private stopProjectWatch(): void {
    if (!this.fileWatcherCallback && !this.watchedProjectPath) return;
    this.services.fileWatcher.unwatchProject(this.watchedProjectPath || this.projPath, this.fileWatcherCallback || undefined);
    this.fileWatcherCallback = null;
    this.watchedProjectPath = "";
  }

  private resolveProjectPath(file: TFile | null): string {
    const parent = file?.parent;
    if (!parent) return "";
    if (parent.name === LEGACY_PROJECT_CONSOLE_FOLDER) return parent.parent?.path || parent.path;
    return parent.path;
  }

  private queueProjectPathChange(oldProjectPath: string, newProjectPath: string): void {
    // 立即更新观察位置，才能接住迁移尚未完成时发生的下一次改名。
    this.projPath = newProjectPath;
    ++this.dataLoadGeneration;
    const epoch = this.fileEpoch;
    this.projectPathChangeQueue = this.projectPathChangeQueue
      .then(async () => {
        if (epoch !== this.fileEpoch) return;
        await this.applyProjectPathChange(oldProjectPath, newProjectPath, epoch);
      })
      .catch(error => {
        console.error("[ProjectConsoleView] 目录变化后的刷新失败", error);
        if (epoch === this.fileEpoch) new Notice("项目位置已变化，页面刷新失败，请重新打开项目");
      });
  }

  private async applyProjectPathChange(
    oldProjectPath: string,
    newProjectPath: string,
    epoch: number,
  ): Promise<void> {
    if (!oldProjectPath || !newProjectPath || oldProjectPath === newProjectPath) return;
    try {
      await this.services.rebaseProjectPath(oldProjectPath, newProjectPath);
      if (this.watchedProjectPath === oldProjectPath) this.watchedProjectPath = newProjectPath;
    } catch (error) {
      console.error("[ProjectConsoleView] 项目历史路径迁移失败", error);
      if (epoch === this.fileEpoch) new Notice("项目位置已变化，但部分历史记录迁移失败");
      // Do not continue with icon/path migrations after the durable history
      // transaction failed. The moved file can still be reopened after the
      // conflict is resolved, but this view must not present a half-rebased
      // project as if all associations were current.
      return;
    }
    if (epoch !== this.fileEpoch) return;
    try {
      await this.migrateCustomIconPaths(oldProjectPath, newProjectPath);
    } catch (error) {
      console.error("[ProjectConsoleView] 项目图标路径迁移失败", error);
      if (epoch === this.fileEpoch) new Notice("项目位置已变化，但自定义图标路径迁移失败");
    }
    if (epoch !== this.fileEpoch || this.projPath !== newProjectPath) return;
    await this.loadProjectData();
    if (epoch === this.fileEpoch && this.projPath === newProjectPath) this.render();
  }

  private async migrateCustomIconPaths(oldProjectPath: string, newProjectPath: string): Promise<void> {
    const current = this.settingsManager.getSettings().iconSystem.customIcons;
    let changed = false;
    const migrated: Record<string, string> = {};
    for (const [path, iconId] of Object.entries(current)) {
      const nextPath = rebasePath(path, oldProjectPath, newProjectPath);
      if (nextPath !== path) changed = true;
      migrated[nextPath] = iconId;
    }
    if (changed) await this.settingsManager.update("iconSystem", { customIcons: migrated });
  }

  // ── 数据 ──────────────────────────────────────────

  private async loadProjectData() {
    const file = this.file;
    if (!(file instanceof TFile)) return;
    const projectPath = this.projPath;
    const generation = ++this.dataLoadGeneration;
    const isCurrent = () => generation === this.dataLoadGeneration && this.file === file && this.projPath === projectPath;
    const data = await this.services.projectData.getProjectConsoleData(projectPath);
    if (!isCurrent()) return;
    if (!data) { this.data = null; return; }
    const [tasks, projectStats, health] = await Promise.all([
      this.taskSyncService.getTasks(projectPath),
      this.services.projectData.getProjectStatistics(projectPath),
      this.services.projectData.getProjectHealth(projectPath),
    ]);
    if (!isCurrent()) return;
    data.tasks = tasks.map(task => ({
      id: task.id, linkedFile: task.linkedFile, text: task.text,
      completed: task.completed, created: task.created, due: task.due,
      dueTime: task.dueTime, priority: this.toDisplayPriority(task.priority),
      tags: task.tags, completedAt: task.completedAt,
    }));
    const nameChanged = this.data?.name !== data.name;
    this.data = data;
    this.timelineTasks = tasks;
    this.projectStats = projectStats;
    this.health = health;
    if (nameChanged) this.refreshProjectTabTitle();
  }

  private refreshProjectTabTitle(): void {
    // Verified in the installed Obsidian implementation; absent from public types.
    // Keep the method optional so a host change cannot invalidate a saved edit.
    const leaf = this.leaf as WorkspaceLeaf & { updateHeader?: () => void };
    try {
      if (typeof leaf?.updateHeader === "function") leaf.updateHeader();
    } catch (error) {
      console.warn("[ProjectConsoleView] 标签标题刷新失败", error);
    }
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
    if (!this.data) {
      return { done: 0, total: 0, pct: 0, isPaused: false, status: normalizeProjectStatus(undefined), nodeIndex: 0 };
    }
    const t = this.data.tasks, total = t.length, done = t.filter((x) => x.completed).length;
    const progress = calculateProjectProgress(this.data.status, done, total);
    return { done, total, pct: progress.percent, isPaused: progress.isPaused, status: progress.status, nodeIndex: progress.nodeIndex };
  }

  // ── 渲染 ──────────────────────────────────────────

  private render() {
    this.disposeHeatmap();
    const c = this.containerEl.children[1];
    if (!c) return;
    c.empty();
    c.addClass("zc-root");
    this.layoutObserver?.disconnect();
    const updateLayout = () => c.toggleClass("is-compact", c.clientWidth < 900);
    updateLayout();
    this.layoutObserver = new ResizeObserver(updateLayout);
    this.layoutObserver.observe(c);

    if (!this.data) {
      c.createDiv({ cls: "zc-error", text: this.accessBlockedReason || "无法解析 .home 文件内容，请检查 JSON 格式" });
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
    const color = getProjectTypeColor(
      d.type || "未分类",
      this.settingsManager.getSettings().homepage.projectCategories,
    );
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
    void this.renderIcon(icon, d.icon);
    const titleText = title.createSpan({ cls: "zc-hero-title-text", text: d.name });
    const renameButton = headingRow.createEl("button", {
      cls: "zc-hero-title-edit",
      attr: {
        type: "button",
        title: "修改项目名称",
        "aria-label": `修改项目名称：${d.name}`,
      },
    });
    renameButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;
    renameButton.addEventListener("click", () => this.editProjectName(titleText, renameButton));
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
      void MarkdownRenderer.render(this.app, d.description, rendered, this.projPath, this);
    }
    else {
      const placeholder = descEl.createSpan({
        cls: "zc-hero-desc-placeholder",
        text: "点击添加项目简介...",
        attr: { role: "button", tabindex: "0", "aria-label": "添加项目简介" },
      });
      placeholder.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.editDescription(descEl);
      });
      placeholder.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        this.editDescription(descEl);
      });
    }
    const editBtn = descEl.createEl("button", { cls: "zc-hero-desc-edit", attr: { type: "button", "aria-label": "编辑项目简介" } });
    editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;
    editBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.editDescription(descEl);
    });

    const exportBtn = sec.createEl("button", {
      cls: "zc-hero-export",
      attr: { type: "button", "aria-label": "导出项目数据" },
    });
    exportBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`;
    exportBtn.createSpan({ text: "导出" });
    exportBtn.addEventListener("click", () => this.showExportMenu(exportBtn));
  }

  private editProjectName(titleText: HTMLElement, renameButton: HTMLButtonElement): void {
    if (!this.data || titleText.querySelector("input")) return;
    const previousName = this.data.name;
    const projectPath = this.projPath;
    const projectId = this.data.projectId;
    const epoch = this.fileEpoch;
    const isCurrent = () => epoch === this.fileEpoch && projectPath === this.projPath;
    titleText.empty();
    titleText.addClass("is-editing");
    renameButton.disabled = true;
    const input = titleText.createEl("input", {
      cls: "zc-hero-title-input",
      attr: {
        type: "text",
        value: previousName,
        "aria-label": "项目名称",
      },
    });
    input.value = previousName;
    const syncInputWidth = () => {
      const units = Array.from(input.value || previousName).reduce(
        (total, character) => total + (/[^\x00-\xff]/.test(character) ? 2 : 1),
        0,
      );
      input.style.setProperty("--zc-title-input-units", String(Math.min(40, Math.max(8, units))));
    };
    syncInputWidth();
    input.addEventListener("input", syncInputWidth);
    input.focus();
    input.select();

    let finished = false;
    const cancel = () => {
      if (finished) return;
      finished = true;
      this.render();
    };
    const save = async () => {
      if (finished) return;
      const nextName = input.value.trim();
      if (!nextName) {
        new Notice("请填写项目显示名称");
        input.focus();
        return;
      }
      if (nextName === previousName) {
        cancel();
        return;
      }

      finished = true;
      input.disabled = true;
      let saved: boolean;
      try {
        if (!isCurrent()) throw new Error("项目已切换或移动，请重新打开项目后再修改名称");
        saved = await this.services.projectData.mutateProjectConsoleData(projectPath, latest => {
          if ((latest.projectId ?? null) !== (projectId ?? null) || latest.name !== previousName) return false;
          latest.name = nextName;
          latest.updatedAt = new Date().toISOString();
        });
      } catch (error) {
        finished = false;
        input.disabled = false;
        console.error("[ProjectConsoleView] 项目名称保存失败", error);
        new Notice(`名称未保存：${String(error)}`);
        input.focus();
        return;
      }
      if (!saved) {
        finished = false;
        input.disabled = false;
        new Notice("名称未保存，项目可能已变化；请刷新后重试，输入仍保留");
        input.focus();
        return;
      }
      new Notice(`显示名称已更新为 ${nextName}`);
      if (!isCurrent()) {
        new Notice("名称已保存，但项目位置已变化；请重新打开项目核对");
        return;
      }
      try {
        await this.loadProjectData();
        if (isCurrent()) this.render();
      } catch (error) {
        console.error("[ProjectConsoleView] 名称已保存，刷新失败", error);
        new Notice("显示名称已保存，请重新打开项目刷新页面");
      }
    };

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void save();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
    });
    input.addEventListener("blur", () => void save());
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
    const projectPath = this.projPath;
    const projectId = this.data.projectId ?? null;
    const epoch = this.fileEpoch;
    const isCurrent = () => epoch === this.fileEpoch && projectPath === this.projPath;
    if (!isCurrent()) return;

    let saved: boolean;
    try {
      saved = await this.services.projectData.mutateProjectConsoleData(projectPath, latest => {
        if ((latest.projectId ?? null) !== projectId) return false;
        changeProjectStage(latest, nextStatus, previousStatus);
      });
    } catch (error) {
      console.error("[ProjectConsoleView] 项目状态保存失败", error);
      new Notice(`项目状态保存失败：${String(error)}`);
      return;
    }
    if (!saved) {
      new Notice("项目阶段保存失败或已被其他窗口更改，请刷新后重试");
      try {
        if (isCurrent()) {
          await this.loadProjectData();
          if (isCurrent()) this.render();
        }
      } catch (error) {
        console.error("[ProjectConsoleView] 项目状态冲突后刷新失败", error);
        new Notice("项目状态未确认，页面刷新失败，请重新打开项目");
      }
      return;
    }

    new Notice(`项目状态已改为${getProjectStatusOption(nextStatus).label}`);
    if (!isCurrent()) {
      new Notice("项目状态已保存，但项目位置已变化；请重新打开项目核对");
      return;
    }
    try {
      await this.loadProjectData();
      if (isCurrent()) this.render();
    } catch (error) {
      console.error("[ProjectConsoleView] 项目状态已保存，刷新失败", error);
      new Notice("项目状态已保存，页面刷新失败，请重新打开项目；无需重复点击");
    }
  }

  private showExportMenu(anchor: HTMLElement) {
    const menu = document.createElement("div");
    menu.addClass("zc-export-menu");
    menu.innerHTML = `
      <div class="zc-export-option" data-format="package"><span class="zc-export-icon">📦</span><span class="zc-export-label">项目迁移包（文件与可选历史）</span></div>
      <div class="zc-export-option" data-format="markdown"><span class="zc-export-icon">📄</span><span class="zc-export-label">Markdown 报告</span></div>
      <div class="zc-export-option" data-format="json"><span class="zc-export-icon">📊</span><span class="zc-export-label">JSON 数据</span></div>
      <div class="zc-export-option" data-format="csv"><span class="zc-export-icon">📋</span><span class="zc-export-label">CSV 表格</span></div>
    `;
    const rect = anchor.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.right = `${window.innerWidth - rect.right}px`;
    menu.querySelectorAll(".zc-export-option").forEach((option) => {
      option.addEventListener("click", async () => {
        if (option.getAttribute("data-format") === "package") {
          menu.remove();
          this.openPackageExport();
          return;
        }
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

  private openPackageExport(): void {
    const projectPath = this.projPath;
    const name = projectFileStem(this.data?.name || "项目");
    const epoch = this.fileEpoch;
    const modal = new Modal(this.app);
    modal.modalEl.addClass("zendian-shared-modal");
    modal.contentEl.createEl("h2", { text: "导出项目迁移包" });
    modal.contentEl.createEl("p", { text: "包含项目目录内全部文件与项目身份。项目外链接文件不会打包；可选快照历史。导出到知识库根目录的 ZENdian_项目包 文件夹。" });
    let history = true;
    new Setting(modal.contentEl).setName("包含现有快照历史").addToggle(toggle => toggle.setValue(true).onChange(value => { history = value; }));
    new Setting(modal.contentEl).addButton(button => button.setButtonText("导出").setCta().onClick(async () => {
      button.setDisabled(true);
      try {
        if (epoch !== this.fileEpoch || projectPath !== this.projPath) throw new Error("项目已切换或移动，请重新打开导出表单");
        const { ProjectPackageService } = await import("./services/ProjectPackageService");
        const zip = await new ProjectPackageService(this.app, this.services.snapshots).export(projectPath, history);
        const folder = "ZENdian_项目包";
        if (!this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder);
        const path = `${folder}/${name}_${Date.now()}.zip`;
        await this.app.vault.createBinary(path, zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer);
        new Notice(`项目包已保存：${path}`);
        modal.close();
      } catch (error) { new Notice(String(error)); button.setDisabled(false); }
    }));
    modal.open();
  }

  private async exportProject(format: "markdown" | "json" | "csv") {
    const projectPath = this.projPath;
    const name = projectFileStem(this.data?.name || "项目");
    const systemDirectory = getProjectSystemDirectory(this.app, projectPath);
    try {
      const { ExportService } = await import("./services/ExportService");
        const exportService = new ExportService(this.app, this.services);
      const timestamp = formatDate(new Date());
      const fileName = `${name}_报告_${timestamp}`;
      const extension = format === "markdown" ? "md" : format;
      const outputPath = `${systemDirectory}/${fileName}.${extension}`;
      await exportService.exportToFile(projectPath, outputPath, {
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
    if (!this.data || container.querySelector("textarea")) return;
    const projectPath = this.projPath;
    const projectId = this.data.projectId;
    const previous = this.data.description || "";
    const epoch = this.fileEpoch;
    container.empty();
    container.classList.add("is-editing");
    const input = container.createEl("textarea", {
      cls: "zc-hero-desc-input",
      attr: { placeholder: "输入项目简介，支持 Markdown 和换行", rows: "4", "aria-label": "项目简介，Ctrl+Enter 保存，Escape 取消" },
    });
    const actions = container.createDiv({ cls: "zc-hero-desc-actions" });
    const cancelButton = actions.createEl("button", {
      cls: "zc-hero-desc-cancel",
      text: "取消",
      attr: { type: "button", "aria-label": "取消项目简介编辑" },
    });
    const saveButton = actions.createEl("button", {
      cls: "zc-hero-desc-save",
      text: "保存简介",
      attr: { type: "button", "aria-label": "保存项目简介" },
    });
    input.value = previous;
    input.focus();
    input.select();
    let saving = false, finished = false;
    const isCurrent = () => epoch === this.fileEpoch && projectPath === this.projPath;
    const setSaving = (value: boolean) => {
      input.disabled = value;
      cancelButton.disabled = value;
      saveButton.disabled = value;
      saveButton.textContent = value ? "保存中…" : "保存简介";
    };
    const cancel = () => {
      if (saving || finished) return;
      finished = true;
      this.render();
    };
    const save = async () => {
      if (saving || finished) return;
      if (!isCurrent()) { new Notice("项目已切换或移动，简介未保存"); return; }
      const description = input.value.trim();
      if (description === previous) { finished = true; this.render(); return; }
      saving = true;
      setSaving(true);
      let saved: boolean;
      try {
        saved = await this.services.projectData.mutateProjectConsoleData(projectPath, latest => {
          if (latest.projectId !== projectId || (latest.description || "") !== previous) return false;
          latest.description = description;
          latest.updatedAt = new Date().toISOString();
        });
      } catch (error) {
        saving = false;
        setSaving(false);
        new Notice(`简介保存失败：${String(error)}`);
        input.focus();
        return;
      }
      if (!saved) {
        saving = false;
        setSaving(false);
        new Notice("简介未保存，项目或简介可能已变化；输入仍保留，请核对后重试");
        input.focus();
        return;
      }
      finished = true;
      try {
        if (!isCurrent()) return;
        await this.loadProjectData();
        if (isCurrent()) this.render();
      } catch (error) {
        console.error("[ProjectConsoleView] 简介已保存，刷新失败", error);
        new Notice("简介已保存，页面刷新失败，请重新打开项目");
      }
    };
    input.addEventListener("keydown", event => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        void save();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
    });
    cancelButton.addEventListener("click", cancel);
    saveButton.addEventListener("click", () => void save());
  }

  /** 统计卡片行 */
  private renderStats(p: HTMLElement) {
    if (!this.projectStats || !this.health) return;

    const projectProgress = this.progress();
    const { done, total, pct } = projectProgress;
    const files = this.projectStats.totalFiles;
    const delivers = this.data!.deliverables.length;
    const section = p.createDiv({ cls: "zc-status-panel" });
    section.createDiv({ cls: "zc-aside-title", text: "项目状态" });

    const progress = section.createDiv({ cls: "zc-status-progress" });
    const progressHeader = progress.createDiv({ cls: "zc-status-progress-header" });
    progressHeader.createSpan({ text: "任务完成率" });
    if (!projectProgress.isPaused) {
      progressHeader.createSpan({ cls: "zc-status-progress-value", text: `${pct}%` });
    }
    const progressTrack = progress.createDiv({
      cls: `zc-status-progress-track zd-project-progress-track${projectProgress.isPaused ? " is-paused" : ""}`,
      attr: { "data-status": projectProgress.status },
    });
    for (let index = 0; index < PROJECT_PROGRESS_STEPS.length; index++) {
      const step = PROJECT_PROGRESS_STEPS[index];
      const state = projectProgress.isPaused
        ? "inactive"
        : index < projectProgress.nodeIndex || projectProgress.status === "completed"
          ? "done"
          : index === projectProgress.nodeIndex
            ? "current"
            : "todo";
      progressTrack.createSpan({
        cls: `zd-project-progress-node is-${state}`,
        attr: { title: step.label, "aria-label": step.label },
      });
    }

    const rows: Array<[string, string, string?]> = [
      ["阶段", getProjectStatusOption(this.data!.status).label, "手动维护，与任务完成率独立"],
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
      ["overview", "概览"],
      ["tasks", "任务"],
      ["deliverables", "交付物"],
      ["timeline", "动态"],
      ["analytics", "数据"],
      ["recent", "文件"]
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
        if (this.tab === key) return;
        this.disposeHeatmap();
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
    const aside = layout.createEl("aside", { cls: "zc-workspace-aside" });
    this.renderStats(aside);
    this.renderRecentActivity(aside);
    this.tabBody(body);
  }

  private createPanelShell(
    container: HTMLElement,
    options: { eyebrow: string; title: string; meta?: string; className?: string },
  ): { heading: HTMLElement; meta: HTMLElement | null; body: HTMLElement } {
    const heading = container.createDiv({
      cls: `zc-content-heading${options.className ? ` ${options.className}` : ""}`,
    });
    const headingText = heading.createDiv({ cls: "zc-content-heading-copy" });
    headingText.createDiv({ cls: "zc-content-eyebrow", text: options.eyebrow });
    const titleRow = headingText.createDiv({ cls: "zc-content-title-row" });
    titleRow.createEl("h2", { cls: "zc-content-title", text: options.title });
    const meta = options.meta
      ? titleRow.createSpan({ cls: "zc-content-count", text: options.meta })
      : null;
    const body = container.createDiv({ cls: "zc-scroll" });
    return { heading, meta, body };
  }

  private tabBody(c: HTMLElement) {
    if (this.tab === "overview") this.overview(c);
    else if (this.tab === "tasks") this.tasks(c);
    else if (this.tab === "deliverables") this.deliverables(c);
    else if (this.tab === "timeline") this.timeline(c);
    else if (this.tab === "analytics") this.analytics(c);
    else this.files(c);
  }

  private overview(c: HTMLElement): void {
    const shell = this.createPanelShell(c, { eyebrow: "项目概览", title: "目标与下一步", meta: getProjectStatusOption(this.data!.status).label });
    const edit = shell.heading.createEl("button", { text: "编辑项目属性", attr: { type: "button" } });
    edit.addEventListener("click", () => {
      const projectPath = this.projPath;
      const epoch = this.fileEpoch;
      new ProjectDetailsModal(this.app, projectPath, structuredClone(this.data!), async () => {
        if (epoch !== this.fileEpoch || projectPath !== this.projPath) return;
        this.services.clearProjectCache(projectPath);
        await this.loadProjectData();
        if (epoch === this.fileEpoch && projectPath === this.projPath) this.render();
      }).open();
    });
    const description = shell.body.createDiv({ cls: "zc-inline-markdown markdown-rendered" });
    const text = this.data!.overview?.markdown || this.data!.description;
    if (text) void MarkdownRenderer.renderMarkdown(text, description, this.projPath, this);
    else description.setText("尚未填写项目目标，可点击顶部简介补充。");
    const progress = this.progress();
    shell.body.createEl("p", { text: `任务完成 ${progress.done}/${progress.total} · ${progress.pct}%` });
    const next = this.timelineTasks.filter(task => !task.completed).slice(0, 5);
    if (this.data!.projectId && this.activityLog) {
      const focus = this.activityLog.getProjectFocusSummary(this.data!.projectId);
      shell.body.createEl("p", { text: `近期保留的专注记录：${focus.sessions} 次 · ${Math.round(focus.seconds / 60)} 分钟` });
    }
    shell.body.createEl("h3", { text: "下一步" });
    if (!next.length) shell.body.createEl("p", { text: "暂无待处理任务，进入任务页添加下一步行动。" });
    for (const task of next) shell.body.createEl("p", { text: task.text });
    const button = shell.body.createEl("button", { text: "管理任务", cls: "mod-cta" });
    button.addEventListener("click", () => { this.tab = "tasks"; this.render(); });
  }

  /** 任务列表 */
  private tasks(c: HTMLElement) {
    const d = this.data!;
    const remaining = d.tasks.filter((task) => !task.completed).length;
    const shell = this.createPanelShell(c, {
      eyebrow: "当前焦点",
      title: "任务",
      meta: `${remaining} 项待处理`,
    });
    const add = shell.heading.createEl("button", {
      cls: "zc-add-btn zc-add-btn--inline",
      attr: { type: "button", "aria-label": "添加任务" },
    });
    add.appendChild(svg("plus"));
    add.createSpan({ text: "添加任务" });
    add.addEventListener("click", () => this.openAddTaskModal());

    const quick = shell.body.createEl("form", { cls: "zc-task-quick-create" });
    const input = quick.createEl("input", { attr: { type: "text", placeholder: "输入下一步任务，回车添加", "aria-label": "新任务内容" } });
    input.value = this.quickTaskDraft;
    input.addEventListener("input", () => { this.quickTaskDraft = input.value; });
    const submit = quick.createEl("button", { text: "添加", cls: "mod-cta", attr: { type: "submit" } });
    const projectPath = this.projPath;
    const projectId = this.data?.projectId ?? null;
    const epoch = this.fileEpoch;
    const isCurrent = () => epoch === this.fileEpoch && projectPath === this.projPath;
    let saving = false;
    quick.addEventListener("submit", async event => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text || saving) return;
      saving = true;
      submit.disabled = true;
      input.disabled = true;
      try {
        if (!isCurrent()) throw new Error("项目已切换或移动，请重新打开任务页后再添加");
        if (!await this.taskSyncService.addTask(projectPath, text, { expectedProjectId: projectId })) throw new Error("任务未保存，请重试");
        if (!isCurrent()) {
          new Notice("任务已写入原项目；当前页面已切换，请重新打开原项目核对");
          return;
        }
        this.quickTaskDraft = "";
        await this.loadProjectData();
        if (!isCurrent()) return;
        this.render();
        (this.contentEl.querySelector(".zc-task-quick-create input") as HTMLInputElement | null)?.focus();
      } catch (error) {
        new Notice(String(error));
        input.disabled = false;
        submit.disabled = false;
        saving = false;
        input.focus();
      }
    });

    const list = shell.body.createDiv({ cls: "zc-list" });

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

  private async openAddTaskModal(): Promise<void> {
    const projectPath = this.projPath;
    const projectId = this.data?.projectId ?? null;
    const epoch = this.fileEpoch;
    if (await this.openAddTaskWindow()) return;
    new AddTaskModal(this.app, async (task) => {
      if (epoch !== this.fileEpoch || projectPath !== this.projPath) throw new Error("项目已切换或移动，请关闭表单并重新添加；输入仍保留");
      const success = await this.taskSyncService.addTask(projectPath, task.text, {
        expectedProjectId: projectId,
        created: task.created,
        due: task.due,
        dueTime: task.dueTime,
        priority: this.toStoragePriority(task.priority),
        tags: task.tags,
      });
      if (!success) {
        throw new Error("任务未保存，项目可能已变化；输入仍保留，请检查项目主页");
      }
      new Notice("任务已添加");
      try {
        if (epoch !== this.fileEpoch || projectPath !== this.projPath) return;
        await this.loadProjectData();
        if (epoch === this.fileEpoch && projectPath === this.projPath) this.render();
      } catch (error) {
        console.error("[ProjectConsoleView] 任务已添加，刷新失败", error);
        new Notice("任务已添加，页面刷新失败，请重新打开项目；无需重复添加");
      }
    }).open();
  }

  private async openAddTaskWindow(): Promise<boolean> {
    if (!this.shouldOpenPanelsInNewWindow()) return false;
    let createdLeaf: WorkspaceLeaf | null = null;
    try {
      const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_PROJECT_TASK_CREATE)[0];
      const leaf = existing || (createdLeaf = this.app.workspace.getLeaf("window"));
      await leaf.setViewState({
        type: VIEW_TYPE_PROJECT_TASK_CREATE,
        active: true,
        state: { projectPath: this.projPath, projectId: this.data?.projectId },
      });
      void this.app.workspace.revealLeaf(leaf);
      return true;
    } catch (error) {
      if (createdLeaf) { try { await createdLeaf.detach(); } catch (cleanupError) { console.warn("[ProjectConsoleView] Failed to close popout.", cleanupError); } }
      console.warn("[ProjectConsoleView] Failed to open task create popout, falling back to modal.", error);
      return false;
    }
  }

  private async openSubmitDeliverablePanel(projectType: string): Promise<void> {
    const projectPath = this.projPath;
    const epoch = this.fileEpoch;
    let publishing = false;
    const isCurrent = () => epoch === this.fileEpoch && projectPath === this.projPath;
    const publish = async (name: string, description: string, paths: string[]): Promise<void> => {
      if (!isCurrent()) throw new Error("项目已切换或移动，请关闭此表单并重新发布");
      if (publishing) throw new Error("正在发布，请等待完成");
      publishing = true;
      try {
        const release = await this.releaseService.publish({ projectPath, projectType, releaseName: name, description, sourcePaths: [...paths] });
        new Notice(`已发布交付物：${release.name}`);
        try {
          this.services.clearProjectCache(projectPath);
          if (isCurrent()) {
            await this.loadProjectData();
            if (isCurrent()) this.render();
          }
        } catch (error) {
          console.error("[ProjectConsoleView] 交付物已发布，刷新失败", error);
          new Notice("交付物已发布，页面刷新失败，请重新打开项目；无需重复发布");
        }
      } finally { publishing = false; }
    };
    const opened = await this.openProjectPopout({
      title: "提交交付物",
      icon: "package",
      size: { width: 760, height: 640 },
      render: (container, api) => {
        let releaseName = "";
        let description = "";
        let selectedPaths: string[] = [];
        let selectedEl!: HTMLElement;
        let submitButton!: HTMLButtonElement;

        const updateSubmitState = (): void => {
          if (submitButton) submitButton.disabled = publishing || !releaseName.trim() || selectedPaths.length === 0;
        };
        const renderSelected = (): void => {
          selectedEl.empty();
          if (!selectedPaths.length) {
            selectedEl.createDiv({ cls: "zc-release-no-files", text: "尚未选择文件" });
            return;
          }
          for (const path of selectedPaths) {
            const row = selectedEl.createDiv("zc-release-selected-row");
            row.createSpan({ text: path.slice(path.lastIndexOf("/") + 1) });
            const remove = row.createEl("button", {
              text: "×",
              attr: { type: "button", "aria-label": "移除文件" },
            });
            remove.addEventListener("click", () => {
              selectedPaths = selectedPaths.filter((item) => item !== path);
              renderSelected();
              updateSubmitState();
            });
          }
        };

        container.addClass("zc-release-submit-modal");
        container.createEl("h2", { text: "提交交付物" });
        container.createDiv({
          cls: "zc-release-modal-hint",
          text: "选择的文件会复制到一个不可编辑的 ZIP 发布包，源文件不会受到影响。",
        });
        new Setting(container)
          .setName("发布名称")
          .setDesc("将作为 ZIP 文件名，例如 v1.0-首页重构")
          .addText((text) => text
            .setPlaceholder("v1.0-发布名称")
            .onChange((value) => {
              releaseName = value;
              updateSubmitState();
            }));
        new Setting(container)
          .setName("介绍")
          .setDesc("说明这个阶段完成了什么")
          .addTextArea((text) => text
            .setPlaceholder("发布说明")
            .onChange((value) => { description = value; }));

        const fileSection = container.createDiv("zc-release-files-section");
        const fileHeader = fileSection.createDiv("zc-release-files-header");
        fileHeader.createDiv({ cls: "zc-release-files-title", text: "交付文件" });
        const choose = fileHeader.createEl("button", {
          text: "选择文件",
          attr: { type: "button" },
        });
        choose.addEventListener("click", () => {
          if (!isCurrent()) { new Notice("项目已切换或移动，请重新打开发布表单"); return; }
          const files = this.releaseService.listSelectableFiles(projectPath, projectType);
          void this.openDeliverableFilePickerPanel(files, selectedPaths, (paths) => {
            if (!isCurrent()) return;
            selectedPaths = paths;
            renderSelected();
            updateSubmitState();
          }, projectPath);
        });
        selectedEl = fileSection.createDiv("zc-release-selected-files");
        renderSelected();

        const actions = container.createDiv("zendian-popout-form-actions");
        const cancel = actions.createEl("button", { text: "取消", attr: { type: "button" } });
        cancel.addEventListener("click", () => api.close());
        submitButton = actions.createEl("button", {
          cls: "mod-cta",
          text: "生成 ZIP 并发布",
          attr: { type: "button" },
        });
        submitButton.addEventListener("click", async () => {
          submitButton.disabled = true;
          submitButton.textContent = "正在发布...";
          try {
            await publish(releaseName, description, selectedPaths);
            api.close();
          } catch (error) {
            if (error instanceof DeliverableReleasePendingRecordError) {
              const prefix = `${projectPath}/`;
              const relativePath = error.archivePath.startsWith(prefix)
                ? error.archivePath.slice(prefix.length)
                : "";
              const notice = new Notice(`${error.message}。`, 15000);
              const recover = notice.messageEl.createEl("button", {
                text: "立即补登记",
                attr: { type: "button", "aria-label": "立即补登记已生成的发布包" },
              });
              recover.addEventListener("click", () => {
                notice.hide();
                this.openRecoverDeliverablePanel(relativePath, projectPath, epoch);
              });
            } else {
              new Notice(error instanceof Error ? error.message : "交付物发布失败");
            }
            submitButton.textContent = "生成 ZIP 并发布";
            updateSubmitState();
          }
        });
        updateSubmitState();
      },
    });
    if (!opened) {
      new SubmitDeliverableModal(this.app, projectPath, projectType, this.releaseService, publish).open();
    }
  }

  private async openDeliverableFilePickerPanel(
    files: TFile[],
    initial: string[],
    onConfirm: (paths: string[]) => void,
    projectPath = this.projPath,
  ): Promise<void> {
    const opened = await this.openProjectPopout({
      title: "选择交付文件",
      icon: "files",
      size: { width: 760, height: 620 },
      render: (container, api) => {
        const selected = new Set(initial);
        container.addClass("zc-release-picker-modal");
        container.createEl("h2", { text: "选择交付文件" });
        container.createDiv({ cls: "zc-release-modal-hint", text: "ZIP 内为扁平文件合集；同名文件不能同时提交。" });
        const search = container.createEl("input", {
          cls: "zc-release-search",
          type: "search",
          placeholder: "搜索文件名或路径",
        });
        const list = container.createDiv("zc-release-file-list");
        const count = container.createSpan("zc-release-selected-count");

        const render = (): void => {
          list.empty();
          const query = search.value.trim().toLocaleLowerCase();
          const visible = files.filter((file) => file.path.toLocaleLowerCase().includes(query));
          for (const file of visible) {
            const row = list.createEl("label", { cls: "zc-release-file-option" });
            const checkbox = row.createEl("input", { type: "checkbox" });
            checkbox.checked = selected.has(file.path);
            const copy = row.createDiv("zc-release-file-copy");
            copy.createSpan({ cls: "zc-release-file-name", text: file.name });
            copy.createSpan({
              cls: "zc-release-file-path",
              text: file.path.startsWith(`${projectPath}/`)
                ? file.path.slice(projectPath.length + 1)
                : file.path,
            });
            checkbox.addEventListener("change", () => {
              if (checkbox.checked) selected.add(file.path);
              else selected.delete(file.path);
              count.textContent = `已选择 ${selected.size} 个文件`;
            });
          }
          if (!visible.length) list.createDiv({ cls: "zc-empty-sub", text: "没有匹配的文件" });
          count.textContent = `已选择 ${selected.size} 个文件`;
        };
        search.addEventListener("input", render);
        render();

        const actions = container.createDiv("zendian-popout-form-actions");
        const cancel = actions.createEl("button", { text: "取消", attr: { type: "button" } });
        cancel.addEventListener("click", () => api.close());
        const confirm = actions.createEl("button", { cls: "mod-cta", text: "确认选择", attr: { type: "button" } });
        confirm.addEventListener("click", () => {
          onConfirm([...selected]);
          api.close();
        });
        window.setTimeout(() => search.focus(), 0);
      },
    });
    if (!opened) new DeliverableFilePickerModal(this.app, projectPath, files, initial, onConfirm).open();
  }

  private async openCreateCheckpointPanel(targetContainer: HTMLElement): Promise<void> {
    const projectPath = this.projPath;
    const epoch = this.fileEpoch;
    const create = async (name: string): Promise<void> => {
      if (epoch !== this.fileEpoch || projectPath !== this.projPath) {
        throw new Error("项目已切换或移动，请关闭此表单并重新创建");
      }
      await this.services.snapshots.createCheckpoint(projectPath, name);
      this.services.timeline.clearCache(projectPath);
      new Notice("项目检查点已创建");
      if (epoch !== this.fileEpoch || projectPath !== this.projPath || !targetContainer.isConnected) return;
      try {
        this.render();
      } catch (error) {
        console.error("[ProjectConsoleView] 检查点已创建，刷新失败", error);
        new Notice("检查点已创建，请重新打开动态页刷新");
      }
    };
    let checkpointName = "";
    const opened = await this.openProjectPopout({
      title: "创建项目检查点",
      icon: "flag",
      size: { width: 560, height: 360 },
      render: (container, api) => {
        container.createEl("h2", { text: "创建项目检查点" });
        container.createDiv({ cls: "zc-modal-hint", text: "记录当前项目内所有受支持文本文件的版本。" });
        new Setting(container)
          .setName("检查点名称")
          .addText((text) => text
            .setPlaceholder("例如：首页布局完成")
            .onChange((value) => { checkpointName = value; }));
        const actions = container.createDiv("zendian-popout-form-actions");
        const cancel = actions.createEl("button", { text: "取消", attr: { type: "button" } });
        cancel.addEventListener("click", () => api.close());
        const submit = actions.createEl("button", { cls: "mod-cta", text: "创建检查点", attr: { type: "button" } });
        submit.addEventListener("click", async () => {
          submit.disabled = true;
          try {
            await create(checkpointName);
            api.close();
          } catch (error) {
            new Notice(`检查点未创建：${String(error)}`);
            submit.disabled = false;
          }
        });
      },
    });
    if (!opened) {
      new CreateCheckpointModal(this.app, create).open();
    }
  }

  private async openSnapshotRestoreConfirmPanel(
    filePath: string,
    onConfirm: () => Promise<void>,
  ): Promise<void> {
    const opened = await this.openProjectPopout({
      title: "恢复文件版本",
      icon: "history",
      size: { width: 560, height: 320 },
      render: (container, api) => {
        container.createEl("h2", { text: "恢复文件版本" });
        container.createEl("p", { text: `将 ${filePath} 恢复到所选版本。恢复前会自动保存当前内容；项目主页的已有操作历史会保留。` });
        const actions = container.createDiv("zendian-popout-form-actions");
        const cancel = actions.createEl("button", { text: "取消", attr: { type: "button" } });
        cancel.addEventListener("click", () => api.close());
        const submit = actions.createEl("button", { cls: "mod-warning", text: "确认恢复", attr: { type: "button" } });
        submit.addEventListener("click", async () => {
          submit.disabled = true;
          await onConfirm();
          api.close();
        });
      },
    });
    if (!opened) new ConfirmSnapshotRestoreModal(this.app, filePath, onConfirm).open();
  }

  private async openSnapshotDiffPanel(versionId: string, onRestored: () => Promise<void>): Promise<void> {
    const opened = await this.openProjectPopout({
      title: "版本差异",
      icon: "file-diff",
      size: { width: 860, height: 680 },
      render: async (container, api) => {
        container.addClass("zc-snapshot-modal");
        const loading = container.createDiv({ cls: "zc-loading", text: "读取版本差异..." });
        const comparison = await this.services.snapshots.getComparison(versionId);
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
            const prefix = line.kind === "added" ? "+" : line.kind === "removed" ? "-" : " ";
            diff.createDiv({ cls: `zc-snapshot-diff-line is-${line.kind}`, text: `${prefix} ${line.text}` });
          }
        }

        const actions = container.createDiv("zendian-popout-form-actions");
        const close = actions.createEl("button", { text: "关闭", attr: { type: "button" } });
        close.addEventListener("click", () => api.close());
        const restore = actions.createEl("button", { cls: "mod-warning", text: "恢复此版本", attr: { type: "button" } });
        restore.addEventListener("click", () => {
          void this.openSnapshotRestoreConfirmPanel(comparison.version.filePath, async () => {
            const restored = await this.services.snapshots.restoreVersion(versionId);
            if (!restored) {
              new Notice("版本恢复失败");
              return;
            }
            this.services.clearProjectCache(comparison.version.projectPath);
            await onRestored();
            new Notice("文件已恢复，恢复前版本已安全保存");
            api.close();
          });
        });
      },
    });
    if (!opened) new SnapshotDiffModal(this.app, this.services, versionId, onRestored).open();
  }

  private async openCheckpointRestoreConfirmPanel(
    checkpoint: ProjectCheckpoint,
    onConfirm: () => Promise<void>,
  ): Promise<void> {
    const preview = await this.services.snapshots.previewCheckpoint(checkpoint.id);
    if (!preview) { new Notice("检查点或项目不存在"); return; }
    const opened = await this.openProjectPopout({
      title: "退回检查点",
      icon: "rotate-ccw",
      size: { width: 600, height: 380 },
      render: (container, api) => {
        container.addClass("zc-checkpoint-confirm");
        renderRestorePreview(container, preview);
        container.createEl("h2", { text: "退回检查点" });
        container.createEl("p", {
          text: `项目将恢复到“${checkpoint.name}”，共 ${Object.keys(checkpoint.versions).length} 个文件版本。`,
        });
        container.createDiv({
          cls: "zc-checkpoint-confirm-note",
          text: "恢复前会自动创建安全检查点；检查点之后新增的文件会保留。恢复范围为已记录的受支持文本文件；项目主页恢复工作内容，但保留已有操作历史。",
        });
        const actions = container.createDiv("zendian-popout-form-actions");
        const cancel = actions.createEl("button", { text: "取消", attr: { type: "button" } });
        cancel.addEventListener("click", () => api.close());
        const submit = actions.createEl("button", { cls: "mod-warning", text: "确认恢复", attr: { type: "button" } });
        submit.addEventListener("click", async () => {
          submit.disabled = true;
          await onConfirm();
          api.close();
        });
      },
    });
    if (!opened) new ConfirmCheckpointRestoreModal(this.app, checkpoint, onConfirm, preview).open();
  }

  private async openCheckpointDeleteConfirmPanel(
    checkpoint: ProjectCheckpoint,
    onConfirm: () => Promise<void>,
  ): Promise<void> {
    const opened = await this.openProjectPopout({
      title: "删除检查点",
      icon: "trash",
      size: { width: 560, height: 340 },
      render: (container, api) => {
        container.addClass("zc-checkpoint-confirm");
        container.createEl("h2", { text: "删除检查点" });
        container.createEl("p", { text: `确定删除“${checkpoint.name}”吗？` });
        container.createDiv({
          cls: "zc-checkpoint-confirm-note",
          text: "只删除检查点记录，不会修改当前项目文件。",
        });
        const actions = container.createDiv("zendian-popout-form-actions");
        const cancel = actions.createEl("button", { text: "取消", attr: { type: "button" } });
        cancel.addEventListener("click", () => api.close());
        const submit = actions.createEl("button", { cls: "mod-warning", text: "删除", attr: { type: "button" } });
        submit.addEventListener("click", async () => {
          submit.disabled = true;
          await onConfirm();
          api.close();
        });
      },
    });
    if (!opened) new ConfirmCheckpointDeleteModal(this.app, checkpoint, onConfirm).open();
  }

  private taskRow(p: HTMLElement, t: ProjectConsoleTask, i: number) {
    const projectPath = this.projPath;
    const projectEpoch = this.fileEpoch;
    const isCurrent = () => projectEpoch === this.fileEpoch && projectPath === this.projPath;
    const row = p.createDiv({ cls: `zc-row${t.completed ? " is-done" : ""}` });

    // 复选框
    const ck = row.createEl("button", { cls: "zc-check", attr: { type: "button", "aria-label": t.completed ? "取消完成任务" : "完成任务", "aria-pressed": String(t.completed) } });
    ck.innerHTML = t.completed ? SVG.checkCircle : SVG.circle;
    ck.addEventListener("click", async () => {
      const source = this.timelineTasks[i];
      if (!source) {
        new Notice("任务数据已变化，请刷新后重试");
        return;
      }
      ck.disabled = true;
      try {
        if (!isCurrent()) {
          new Notice("项目已切换或移动，请刷新后重试");
          return;
        }
        const success = await this.taskSyncService.toggleTask(projectPath, source.line, source.raw, source.completed, source.projectId);
        if (!success) {
          new Notice("任务已发生变化，请刷新后重试");
          try { await this.loadProjectData(); this.render(); }
          catch (error) { console.error("[ProjectConsoleView] 任务状态未确认，刷新失败", error); new Notice("任务状态未确认，页面刷新失败，请重新打开项目"); }
          return;
        }
        if (!isCurrent()) return;
        try {
          await this.loadProjectData();
          if (isCurrent()) this.render();
        } catch (error) {
          console.error("[ProjectConsoleView] 任务状态已保存，刷新失败", error);
          new Notice("任务状态已保存，页面刷新失败，请重新打开项目；无需重复点击");
        }
      } catch (error) {
        console.error("[ProjectConsoleView] 任务状态保存失败", error);
        new Notice("任务状态保存失败，请重试");
      } finally {
        if (ck.isConnected) ck.disabled = false;
      }
    });

    // 任务内容区域
    const content = row.createDiv({ cls: "zc-row-content" });

    // 第一行：任务文本 + 优先级标签
    const firstLine = content.createDiv({ cls: "zc-row-first-line" });
    const taskText = firstLine.createDiv({ cls: "zc-row-text zc-row-markdown zc-inline-markdown markdown-preview-view markdown-rendered" });
    void MarkdownRenderer.render(this.app, t.text, taskText, projectPath, this);

    // 优先级标签
    if (t.priority) {
      renderTaskPriorityLabel(firstLine, t.priority);
    }

    // 第二行：标签 + 截止日期
    const secondLine = content.createDiv({ cls: "zc-row-second-line" });
    if (t.linkedFile) {
      const linkedFile = t.linkedFile;
      const available = this.app.vault.getAbstractFileByPath(`${projectPath}/${linkedFile}`) instanceof TFile;
      const link = secondLine.createEl("button", { text: `${available ? "打开" : "关联文件缺失"}：${linkedFile}`, attr: { type: "button", title: available ? "打开关联文件" : "编辑任务可重新关联或解除关联；任务仍可正常修改" } });
      link.addEventListener("click", async () => {
        if (!isCurrent()) { new Notice("项目已切换或移动，请刷新后重试"); return; }
        const path = `${projectPath}/${linkedFile}`;
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) { new Notice("关联文件当前不存在，可能已移动或改名，请编辑任务重新关联"); return; }
        await this.app.workspace.getLeaf(false).openFile(file);
      });
    }

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

    const edit = row.createEl("button", { text: "编辑", attr: { type: "button", "aria-label": "编辑任务" } });
    edit.addEventListener("click", () => {
      const source = this.timelineTasks[i];
      if (!source) return;
      new TaskEditModal(this.app, source, this.taskSyncService, async () => {
        if (!isCurrent()) return;
        await this.loadProjectData();
        if (isCurrent()) this.render();
      }).open();
    });
    // 删除按钮
    const del = row.createEl("button", { cls: "zc-del", attr: { type: "button", "aria-label": "删除任务", title: "删除任务" } });
    del.innerHTML = SVG.trash;
    del.addEventListener("click", async () => {
      const source = this.timelineTasks[i];
      if (!source) {
        new Notice("任务数据已变化，请刷新后重试");
        return;
      }
      new ConfirmTaskDeleteModal(this.app, source.text, async () => {
        if (!isCurrent()) {
          new Notice("项目已切换或移动，请刷新后重试");
          return;
        }
        try {
          const success = await this.taskSyncService.deleteTask(projectPath, source.line, source.raw, source.projectId);
          if (!success) {
            new Notice("删除失败，任务内容可能已发生变化");
            return;
          }
          const undo = new Notice("任务已删除，可撤销", 10000);
          const button = undo.messageEl.createEl("button", { text: "撤销删除" });
          const deletedTask = structuredClone(source);
          button.addEventListener("click", async () => {
            button.disabled = true;
            try {
              if (await this.taskSyncService.restoreTask(deletedTask)) {
                undo.hide();
                try { if (isCurrent()) { await this.loadProjectData(); if (isCurrent()) this.render(); } }
                catch (error) { console.error("[ProjectConsoleView] 任务已恢复，刷新失败", error); new Notice("任务已恢复，页面刷新失败，请重新打开项目"); }
              } else { new Notice("无法恢复，任务可能已存在或项目已移动"); button.disabled = false; }
            } catch (error) { console.error("[ProjectConsoleView] 撤销删除失败", error); new Notice("撤销删除失败，请重试"); button.disabled = false; }
          });
          try { if (isCurrent()) { await this.loadProjectData(); if (isCurrent()) this.render(); } }
          catch (error) { console.error("[ProjectConsoleView] 任务已删除，刷新失败", error); new Notice("任务已删除，页面刷新失败，请重新打开项目；可使用提示中的撤销"); }
        } catch (error) {
          console.error("[ProjectConsoleView] 删除任务失败", error);
          new Notice("删除任务失败，请重试");
        }
      }).open();
    });
  }

  private openRecoverDeliverablePanel(
    initialPath = "",
    boundProjectPath = this.projPath,
    boundEpoch = this.fileEpoch,
  ): void {
    const projectPath = boundProjectPath;
    const projectEpoch = boundEpoch;
    const isCurrent = () => projectEpoch === this.fileEpoch && projectPath === this.projPath;
    const modal = new Modal(this.app);
    modal.modalEl.addClass("zendian-shared-modal");
    modal.contentEl.createEl("h2", { text: "补登记已有发布包" });
    modal.contentEl.createEl("p", { text: "用于 ZIP 已生成但项目记录未保存的情况。仅补写记录，不重新打包；会校验包内清单及当前项目路径。" });
    let path = initialPath;
    new Setting(modal.contentEl)
      .setName("项目内 ZIP 路径")
      .addText(input => input.setPlaceholder("交付物/版本名称.zip").setValue(initialPath).onChange(value => { path = value.trim(); }));
    new Setting(modal.contentEl).addButton(button => button.setButtonText("校验并补登记").setCta().onClick(async () => {
      if (!isCurrent()) {
        modal.close();
        new Notice("项目位置已变化，请重新打开交付物面板后再补登记");
        return;
      }
      button.setDisabled(true);
      try {
        await this.releaseService.recoverArchive(projectPath, path);
        if (!isCurrent()) {
          modal.close();
          new Notice("发布包已校验，但项目位置已变化；请重新打开项目核对记录");
          return;
        }
        modal.close();
        this.services.clearProjectCache(projectPath);
        this.services.timeline.clearCache(projectPath);
        await this.loadProjectData();
        if (isCurrent()) this.render();
        new Notice("发布包已补登记");
      } catch (error) {
        new Notice(String(error));
        button.setDisabled(false);
      }
    }));
    modal.open();
  }

  /** 交付物 */
  private deliverables(c: HTMLElement) {
    const d = this.data!;
    const releaseCount = d.deliverables.filter((item) => item.format === "zip").length;
    const shell = this.createPanelShell(c, {
      eyebrow: "阶段成果",
      title: "交付物",
      meta: d.deliverables.length ? `${releaseCount} 个已发布版本` : "将成果封装为 ZIP",
    });
    const submit = shell.heading.createEl("button", {
      cls: "zc-release-submit zc-panel-action",
      attr: { type: "button" },
    });
    submit.appendChild(svg("plus"));
    submit.createSpan({ text: "提交交付物" });
    const configuredFolder = this.releaseService.resolveFolder(this.projPath, d.type);
    const recover = shell.body.createEl("button", { text: "补登记已有发布包", attr: { type: "button" } });
    recover.addEventListener("click", () => this.openRecoverDeliverablePanel());
    submit.disabled = !configuredFolder;
    submit.title = configuredFolder ? `发布到 ${configuredFolder.folderName}` : "交付物目录名称无效，请在设置中修正";
    submit.addEventListener("click", () => {
      if (!configuredFolder) {
        new Notice("请在设置 → 项目子文件夹中修正交付物目录名称");
        return;
      }
      void this.openSubmitDeliverablePanel(d.type);
    });

    const list = shell.body.createDiv({ cls: "zc-release-list" });
    if (!d.deliverables.length) {
      const e = list.createDiv({ cls: "zc-empty" });
      e.createDiv({ cls: "zc-empty-icon" }).innerHTML = SVG.package;
      e.createDiv({ cls: "zc-empty-title", text: "还没有交付物" });
      e.createDiv({
        cls: "zc-empty-sub",
        text: configuredFolder ? `发布包将保存到 ${configuredFolder.folderName}` : "交付物目录配置无效",
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
      void MarkdownRenderer.render(this.app, item.description, description, this.projPath, this);
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
          const projectPath = this.projPath;
          const projectEpoch = this.fileEpoch;
          const isCurrent = () => projectEpoch === this.fileEpoch && projectPath === this.projPath;
          if (!await confirmAction(this.app, {
            title: "删除交付物",
            message: `删除“${item.name}”？这会删除项目记录和对应 ZIP，但不会删除任何源文件。`,
            confirmText: "删除",
          })) return;
          if (!isCurrent()) {
            new Notice("项目已切换或移动，请刷新后重试");
            return;
          }
          remove.disabled = true;
          try {
            await this.releaseService.deleteArchive(projectPath, d.type, item);
          } catch (error) {
            remove.disabled = false;
            new Notice("删除未完成，项目记录已保留：" + String(error));
            return;
          }
          let recordSaved = false;
          try {
            recordSaved = await this.services.projectData.mutateProjectConsoleData(projectPath, (latest) => {
              const matches = latest.deliverables.filter(candidate => item.id ? candidate.id === item.id
                : candidate.path === item.path && candidate.name === item.name && candidate.createdAt === item.createdAt);
              if (matches.length !== 1 || matches[0].path !== item.path || matches[0].name !== item.name) return false;
              latest.deliverables = latest.deliverables.filter(candidate => candidate !== matches[0]);
            });
          } catch (error) {
            console.error("[ProjectConsoleView] 交付物记录删除失败", error);
          }
          if (!recordSaved) {
            if (isCurrent()) remove.disabled = false;
            new Notice("ZIP 已移入回收站，但记录保存失败；请刷新后核对，必要时从回收站恢复 ZIP");
            return;
          }
          this.services.clearProjectCache(projectPath);
          this.services.timeline.clearCache(projectPath);
          if (!isCurrent()) {
            new Notice("交付物已删除，但项目位置已变化；请重新打开项目核对");
            return;
          }
          try {
            await this.loadProjectData();
            if (isCurrent()) this.render();
          } catch (error) {
            console.error("[ProjectConsoleView] 交付物已删除，刷新失败", error);
            new Notice("交付物已删除，页面刷新失败，请重新打开项目；无需重复点击");
            return;
          }
          new Notice(`已删除交付物：${item.name}`);
        });
      }
    }
  }

  /** 最近文件 */
  private files(c: HTMLElement) {
    const fs = this.recent(Number.MAX_SAFE_INTEGER);
    const shell = this.createPanelShell(c, {
      eyebrow: "工作记录",
      title: "项目文件",
      meta: `${fs.length} 个文件，按修改时间排序`,
    });
    const list = shell.body.createDiv({ cls: "zc-list" });
    if (!fs.length) {
      const e = list.createDiv({ cls: "zc-empty" });
      e.createDiv({ cls: "zc-empty-icon" }).innerHTML = SVG.fileStack;
      e.createDiv({ cls: "zc-empty-title", text: "暂无文件" });
      return;
    }
    const search = shell.body.createEl("input", { attr: { type: "search", placeholder: "搜索文件名或相对路径", "aria-label": "搜索项目文件" } });
    shell.body.prepend(search);
    const renderFiles = () => {
    list.empty();
    const filtered = fs.filter(file => file.path.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()));
    if (!filtered.length) list.createDiv({ text: "没有匹配的文件" });
    for (const f of filtered.slice(0, 200)) {
      const row = list.createDiv({ cls: "zc-row zc-clickable" });
      const ic = row.createDiv({ cls: "zc-row-icon" });
      ic.innerHTML = SVG.fileText;
      const wrap = row.createDiv({ cls: "zc-row-main" });
      wrap.createSpan({ cls: "zc-row-text", text: f.name });
      const folder = f.path.split("/").slice(-2, -1)[0] || "";
      if (folder) wrap.createSpan({ cls: "zc-row-sub", text: f.path.replace(this.projPath + "/", "") });
      row.createSpan({ cls: "zc-row-time", text: relTime(f.mtime) });
      row.addEventListener("click", () => this.openRel(f.path));
    }
    if (filtered.length > 200) list.createDiv({ text: "仅显示前 200 个结果，请输入关键词缩小范围" });
    };
    search.addEventListener("input", renderFiles);
    renderFiles();
  }

  /** 右侧近期活动 */
  private renderRecentActivity(parent: HTMLElement): void {
    const activity = parent.createDiv({ cls: "zc-workspace-index zc-recent-activity" });
    activity.createDiv({ cls: "zc-aside-title", text: "近期活动" });
    const scroll = activity.createDiv({ cls: "zc-recent-activity-scroll" });
    scroll.createDiv({ cls: "zc-summary-empty", text: "正在加载活动…" });
    const projectPath = this.projPath;
    void this.services.timeline.getRecentEvents(projectPath, 5).then(events => {
      // 旧页面的异步结果不能覆盖重新渲染或移动后的项目。
      if (!scroll.isConnected || projectPath !== this.projPath) return;
      scroll.empty();
      if (!events.length) {
        scroll.createDiv({ cls: "zc-summary-empty", text: "项目活动会显示在这里" });
        return;
      }
      for (const event of events) {
        const row = scroll.createEl("button", { cls: "zc-summary-row", attr: { type: "button" } });
        const mark = row.createSpan({ cls: "zc-summary-mark" });
        mark.innerHTML = SVG.fileEdit;
        const copy = row.createDiv({ cls: "zc-summary-copy" });
        copy.createSpan({ cls: "zc-summary-primary", text: event.title });
        copy.createSpan({ cls: "zc-summary-secondary", text: event.approximateTime ? "发现记录 · 查看动态" : "查看动态" });
        row.createSpan({ cls: "zc-summary-time", text: relTime(event.timestamp) });
        row.addEventListener("click", () => { this.tab = "timeline"; this.render(); });
      }
    }).catch(error => {
      console.error("[ProjectConsoleView] 近期活动加载失败", error);
      if (!scroll.isConnected || projectPath !== this.projPath) return;
      scroll.empty();
      scroll.createDiv({ cls: "zc-summary-empty", text: "活动暂时无法读取，请在动态页重试" });
    });
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
    const projectPath = this.projPath;
    const epoch = this.fileEpoch;
    const shell = this.createPanelShell(c, {
      eyebrow: "版本记录",
      title: "项目活动",
      meta: "文件、任务与检查点",
    });
    const checkpointButton = shell.heading.createEl("button", {
      cls: "zc-timeline-checkpoint zc-panel-action",
      text: "创建检查点",
      attr: { type: "button" },
    });
    checkpointButton.prepend(svg("flag"));
    checkpointButton.addEventListener("click", () => {
      void this.openCreateCheckpointPanel(c);
    });

    const container = shell.body.createDiv({ cls: "zc-timeline-container" });

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
      const timelineData = await this.services.timeline.getProjectTimeline(projectPath);
      if (!container.isConnected || projectPath !== this.projPath || epoch !== this.fileEpoch) return;

      // 移除加载提示
      loading.remove();

      const visibleEvents = timelineData.events.filter((event) => this.matchesTimelineFilter(event));
      if (shell.meta) shell.meta.textContent = `${visibleEvents.length} 条记录`;

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
          content.createDiv({ cls: "zc-timeline-title", text: event.title });

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
              void this.openSnapshotDiffPanel(event.snapshotId!, async () => {
                if (projectPath !== this.projPath || epoch !== this.fileEpoch) return;
                this.services.timeline.clearCache(projectPath);
                await this.loadProjectData();
                if (projectPath === this.projPath && epoch === this.fileEpoch) this.render();
              });
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
              void this.openCheckpointRestoreConfirmPanel(checkpoint, async () => {
                if (projectPath !== this.projPath || epoch !== this.fileEpoch) {
                  new Notice("项目已切换或移动，请重新打开动态页后再恢复");
                  return;
                }
                let result: Awaited<ReturnType<typeof this.services.snapshots.restoreCheckpoint>>;
                try {
                  result = await this.services.snapshots.restoreCheckpoint(checkpointId);
                } catch (error) {
                  console.error("[ProjectConsoleView] 检查点恢复写入失败", error);
                  new Notice(`检查点恢复未完成，当前文件已保留：${String(error)}`);
                  return;
                }
                if (!result) {
                  new Notice("检查点恢复失败");
                  return;
                }
                this.services.clearProjectCache(projectPath);
                this.services.timeline.clearCache(projectPath);
                try {
                  await this.loadProjectData();
                  if (projectPath === this.projPath && epoch === this.fileEpoch) this.render();
                } catch (error) {
                  console.error("[ProjectConsoleView] 检查点已恢复，页面刷新失败", error);
                  new Notice("检查点已恢复，但页面刷新失败，请重新打开项目");
                }
                const removedText = result.removed > 0 ? `，移除 ${result.removed} 个新增文件` : "";
                const failedText = result.failed.length > 0 ? `，${result.failed.length} 个文件失败` : "";
                new Notice(`已恢复 ${result.restored} 个文件${removedText}${failedText}`);
              });
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
              void this.openCheckpointDeleteConfirmPanel(checkpoint, async () => {
                if (projectPath !== this.projPath || epoch !== this.fileEpoch) {
                  new Notice("项目已切换或移动，请重新打开动态页后再删除");
                  return;
                }
                let deleted = false;
                try {
                  deleted = await this.services.snapshots.deleteCheckpoint(checkpointId);
                } catch (error) {
                  console.error("[ProjectConsoleView] 检查点删除写入失败", error);
                  new Notice(`检查点删除未完成：${String(error)}`);
                  return;
                }
                if (!deleted) {
                  new Notice("检查点删除失败");
                  return;
                }
                this.services.timeline.clearCache(projectPath);
                if (projectPath === this.projPath && epoch === this.fileEpoch) this.render();
                new Notice("检查点已删除");
              });
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
      if (!container.isConnected || projectPath !== this.projPath || epoch !== this.fileEpoch) return;
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
    return ["deliverable-added", "deliverable-updated", "deliverable-removed", "milestone", "status-changed", "project-restored", "project-moved"].includes(event.type);
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
      "project-restored": SVG.checkCircle,
      "project-moved": SVG.folder,
      "task-created": SVG.plus,
      "task-updated": SVG.fileEdit,
      "task-completed": SVG.check,
      "task-reopened": SVG.circle,
      "task-deleted": SVG.trash,
      "task-restored": SVG.checkCircle,
      "deliverable-added": SVG.package,
      "deliverable-updated": SVG.package,
      "deliverable-removed": SVG.package,
      "milestone": SVG.flag,
      "status-changed": SVG.flag,
      "checkpoint": SVG.flag,
    };
    return icons[type] || SVG.circle;
  }

  /** 数据可视化 */
  private async analytics(c: HTMLElement) {
    const projectPath = this.projPath;
    const epoch = this.fileEpoch;
    const shell = this.createPanelShell(c, {
      eyebrow: "项目脉搏",
      title: "数据",
      meta: "趋势与活跃度",
      className: "zc-analytics-heading",
    });
    shell.body.addClass("zc-analytics-scroll");
    const container = shell.body.createDiv({ cls: "zc-analytics-container" });

    const loading = container.createDiv({ cls: "zc-analytics-state" });
    const loadingIcon = loading.createDiv({ cls: "zc-analytics-state-icon" });
    loadingIcon.innerHTML = SVG.target;
    loading.createDiv({ cls: "zc-analytics-state-title", text: "正在整理项目数据" });
    loading.createDiv({ cls: "zc-analytics-state-copy", text: "任务趋势和年度活跃度即将就绪" });

    try {
      // 并行加载数据
      const [trend, heatmap, stats] = await Promise.all([
        this.services.statistics.getActivityTrend(projectPath, 30),
        this.services.timeline.getActivityHeatmap(projectPath, 365),
        this.services.statistics.getTaskStatistics(projectPath),
      ]);

      if (!container.isConnected || this.tab !== "analytics" || projectPath !== this.projPath || epoch !== this.fileEpoch) return;

      // 移除加载提示
      loading.remove();

      // 概览卡片
      this.renderOverviewCards(container, stats);

      const visuals = container.createDiv({ cls: "zc-analytics-visuals" });
      this.renderTrendChart(visuals, trend);
      this.renderHeatmap(visuals, heatmap);

    } catch (error) {
      if (!container.isConnected || this.tab !== "analytics" || projectPath !== this.projPath || epoch !== this.fileEpoch) return;
      loading.remove();
      const errorEl = container.createDiv({ cls: "zc-analytics-state is-error" });
      const errorIcon = errorEl.createDiv({ cls: "zc-analytics-state-icon" });
      errorIcon.innerHTML = SVG.fileStack;
      errorEl.createDiv({ cls: "zc-analytics-state-title", text: "无法加载项目数据" });
      errorEl.createDiv({ cls: "zc-analytics-state-copy", text: "请确认项目主页可读，然后切换标签重试" });
      console.error("[ProjectConsoleView] 数据加载失败:", error);
    }
  }

  /** 渲染概览卡片 */
  private renderOverviewCards(container: HTMLElement, stats: TaskStatistics) {
    const cards = container.createDiv({ cls: "zc-analytics-cards" });

    const items: Array<{
      label: string;
      value: string;
      icon: keyof typeof SVG;
      warning?: boolean;
    }> = [
      { label: "总任务", value: String(stats.total), icon: "fileStack" },
      { label: "已完成", value: String(stats.completed), icon: "checkCircle" },
      { label: "进行中", value: String(stats.pending), icon: "clock" },
      { label: "完成率", value: `${stats.completionRate.toFixed(1)}%`, icon: "target" },
      { label: "逾期", value: String(stats.overdue), icon: "flag", warning: stats.overdue > 0 },
    ];

    for (const item of items) {
      const card = cards.createDiv({ cls: "zc-analytics-card" });
      if (item.warning) {
        card.addClass("zc-analytics-card-warning");
      }

      const icon = card.createDiv({ cls: "zc-analytics-card-icon" });
      icon.innerHTML = SVG[item.icon];

      const content = card.createDiv({ cls: "zc-analytics-card-content" });
      content.createDiv({ cls: "zc-analytics-card-value", text: item.value });
      content.createDiv({ cls: "zc-analytics-card-label", text: item.label });
    }
  }

  /** 渲染趋势图 */
  private renderTrendChart(container: HTMLElement, trend: Array<{ date: string; count: number }>) {
    const section = container.createDiv({ cls: "zc-analytics-section zc-analytics-trend" });
    const heading = section.createDiv({ cls: "zc-analytics-section-heading" });
    heading.createDiv({ cls: "zc-analytics-section-title", text: "活动趋势" });
    heading.createDiv({ cls: "zc-analytics-section-copy", text: "最近 30 天的项目变更次数" });

    const chartContainer = section.createDiv({ cls: "zc-chart-container" });
    const palette = this.getAnalyticsPalette();

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
        color: palette.accent,
        fillColor: palette.accent,
      }],
    }, {
      width: 640,
      height: 190,
      padding: { top: 12, right: 12, bottom: 30, left: 36 },
      showLegend: false,
      showGrid: true,
      showTooltip: true,
      animate: true,
      pointRadius: 2,
      pointHoverRadius: 4,
    });
  }

  /** 渲染热力图 */
  private renderHeatmap(container: HTMLElement, heatmap: Map<string, number>) {
    const section = container.createDiv({
      cls: "zc-analytics-section zc-analytics-heatmap homepage-rhythm-card",
    });
    const heading = section.createDiv({ cls: "zc-analytics-section-heading" });
    heading.createDiv({ cls: "zc-analytics-section-title", text: "活动热力图" });
    heading.createDiv({ cls: "zc-analytics-section-copy", text: "最近 365 天的持续投入节奏" });
    const data = Array.from(heatmap.entries()).map(([date, value]) => ({
      date,
      value,
    }));
    const activeDays = data.filter((day) => day.value > 0).length;
    const activityTotal = data.reduce((sum, day) => sum + day.value, 0);

    this.disposeHeatmap();
    this.heatmapCleanup = mountActivityHeatmap(section, data, {
      tooltipUnit: "次活动",
      summary: [
        { label: "活跃天数", value: activeDays, unit: "近一年" },
        { label: "活动总量", value: activityTotal, unit: "次" },
      ],
    });
  }

  private getAnalyticsPalette(): { accent: string } {
    const styles = getComputedStyle(document.body);
    const hue = styles.getPropertyValue("--accent-h").trim() || "220";
    const saturation = styles.getPropertyValue("--accent-s").trim() || "70%";
    const lightness = styles.getPropertyValue("--accent-l").trim() || "52%";
    return {
      accent: `hsl(${hue} ${saturation} ${lightness})`,
    };
  }

  private disposeHeatmap(): void {
    this.heatmapCleanup?.();
    this.heatmapCleanup = null;
  }

  private async renderIcon(el: HTMLElement, id: string): Promise<void> {
    const projectPath = this.projPath;
    const projectFile = this.file;
    const epoch = this.fileEpoch;
    const customIcons = this.settingsManager.getSettings().iconSystem.customIcons;
    const customIcon = customIcons[projectPath] || customIcons[projectFile?.path || ""];
    const iconId = customIcon || id;
    let icon = await resolveIconSvg(this.app, iconId || "lucide-folder");
    if (!el.isConnected || epoch !== this.fileEpoch || projectPath !== this.projPath || projectFile !== this.file) return;

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
