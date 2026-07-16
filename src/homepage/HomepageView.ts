/**
 * HomepageView — ZENdian 主页视图
 *
 * 12列网格布局仪表盘，精确还原 demo 结构。
 * 集成各数据服务，渲染完整主页。
 */

import { ItemView, type WorkspaceLeaf, type App, TFile, TFolder, getIcon, Modal, Setting, Notice, MarkdownRenderer } from "obsidian";
import { HomepageStatsService } from "./HomepageStatsService";
import { HomepageDataService } from "./HomepageDataService";
import { HomepageBookmarksService } from "./HomepageBookmarksService";
import { HomepageWeatherService } from "./HomepageWeatherService";
import { HomepageProjectScanService } from "./HomepageProjectScanService";
import { ActivityLogService } from "../services/ActivityLogService";
import { QuickNoteModal } from "./QuickNoteModal";
import { createDefaultConsoleData } from "./ProjectConsoleView";
import { IconPickerModal } from "../ui/icon-picker-modal";
import type { HomepageProject, HomepageQuickNote, RecentNoteItem } from "./types";
import type { ProjectCategory } from "../types/settings.types";
import { getProjectCategoryFolder, getProjectTypeColor } from "./project-categories";
import { getProjectStatusOption, type ProjectStatus } from "./project-status";
import { Events } from "../core/event-bus";
import type { EventBus } from "../core/event-bus";
import type { SettingsManager } from "../core/settings-manager";
import { renderProjectFilterBar, DEFAULT_FILTER, type ProjectFilter } from "./components/ProjectFilterBar";
import { applyFilterAndSort } from "./utils/ProjectFilterUtils";
import { ProjectTimelineService, type ProjectStats } from "./services/ProjectTimelineService";
import type { Task } from "../services/TaskSyncService";
import type { TaskSyncService } from "../services/TaskSyncService";
import type { TaskPriority as StorageTaskPriority } from "../services/TaskSyncService";
import { renderTaskPriorityLabel } from "./components/TaskPriorityLabel";
import { createTaskSchedulePicker } from "./components/TaskSchedulePicker";
import { getProjectSubfolderName } from "./project-subfolders";
import {
  findProjectHomeFile,
  PROJECT_HOME_FILENAME,
} from "./services/ProjectHomeFileResolver";

export const VIEW_TYPE_HOMEPAGE = "zendian-homepage";

export interface HomepageDependencies {
  settingsManager: SettingsManager;
  events: EventBus;
  activityLogService: ActivityLogService;
  taskSyncService: TaskSyncService;
}

/** SVG 图标工具 — 16x16 Lucide 风格 */
const SVG_ICON = {
  wave: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>`,
  search: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  sun: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
  mapPin: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
  calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>`,
  checkCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`,
  circle: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`,
  fileText: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,
  checkSquare: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>`,
  bookOpen: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
  clock: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  folder: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`,
  squareCheck: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>`,
  stickyNote: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M14 3v4a2 2 0 0 0 2 2h4"/></svg>`,
  flame: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
  barChart: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg>`,
  rocket: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>`,
  pencil: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,
  tag: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>`,
  star: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`,
  list: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>`,
} as const;

function svgIcon(key: keyof typeof SVG_ICON, cls?: string): HTMLSpanElement {
  const span = createSpan({ cls: `homepage-icon${cls ? ` ${cls}` : ""}` });
  span.innerHTML = SVG_ICON[key];
  return span;
}

/** 待办 Tab 定义 */
const TODO_TABS = [
  { key: "all", label: "全部" },
  { key: "today", label: "今天" },
  { key: "week", label: "本周" },
  { key: "done", label: "已完成" },
] as const;

type TodoTabKey = (typeof TODO_TABS)[number]["key"];

function createCardIconButton(
  parent: HTMLElement,
  icon: "plus" | "list",
  label: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = parent.createEl("button", {
    cls: `homepage-card-icon-btn${icon === "plus" ? " is-primary" : ""}`,
    attr: { type: "button", title: label, "aria-label": label },
  });
  button.innerHTML = SVG_ICON[icon];
  button.addEventListener("click", onClick);
  return button;
}

// ── 新建项目 Modal ─────────────────────────────────────────

class ProjectCreateModal extends Modal {
  private selectedIcon = "lucide-folder";
  private iconDisplay!: HTMLElement;
  private scanService: HomepageProjectScanService;
  private onCreated: () => void;

  constructor(
    app: App,
    scanService: HomepageProjectScanService,
    onCreated: () => void,
    private settingsManager: SettingsManager,
  ) {
    super(app);
    this.scanService = scanService;
    this.onCreated = onCreated;
  }

  onOpen(): void {
    const { contentEl } = this;
    const settings = this.settingsManager.getSettings();
    const categories = settings.homepage.projectCategories;
    const customIcons: Record<string, string> = settings?.iconSystem?.customIcons || {};

    const typeOptions = categories.map((category) => ({
      folder: getProjectCategoryFolder(category),
      label: category.name,
    }));

    contentEl.createEl("h2", { text: "新建项目" });

    // 项目编号 + 名称
    const nameSetting = new Setting(contentEl)
      .setName("项目名称")
      .setDesc("文件夹按“编号_项目名称”命名");
    nameSetting.settingEl.addClass("homepage-project-name-setting");
    nameSetting.controlEl.addClass("homepage-project-name-control");
    nameSetting.addText((text) => {
      this.numberInput = text.inputEl;
      text.inputEl.addClass("homepage-project-number-input");
      text.inputEl.inputMode = "numeric";
      text.setPlaceholder("编号").onChange((value) => (this.numberValue = value));
    });
    nameSetting.addText((text) => {
      this.nameInput = text.inputEl;
      text.inputEl.addClass("homepage-project-name-input");
      text.setPlaceholder("输入项目名称").onChange((value) => (this.nameValue = value));
    });

    // 项目简介
    const descriptionSetting = new Setting(contentEl).setName("项目简介");
    descriptionSetting.settingEl.addClass("homepage-project-description-setting");
    descriptionSetting.addTextArea((text) => {
      text.setPlaceholder("输入项目简介，支持 Markdown 和换行").onChange((v) => (this.descValue = v));
      text.inputEl.addClass("homepage-project-description-input");
    });

    // 项目类型
    const typeSetting = new Setting(contentEl).setName("项目类型");
    const select = typeSetting.controlEl.createEl("select");
    for (const opt of typeOptions) {
      select.createEl("option", { value: opt.folder, text: opt.label });
    }
    this.typeSelect = select;

    // 项目图标
    const iconSetting = new Setting(contentEl).setName("项目图标");
    this.iconDisplay = iconSetting.controlEl.createDiv({ cls: "homepage-project-modal-icon-current" });
    this.refreshIconDisplay();
    const changeBtn = iconSetting.controlEl.createEl("button", { text: "更换" });
    changeBtn.addEventListener("click", () => {
      const installedLibs = settings?.iconSystem?.installedLibraries || [];
      const picker = new IconPickerModal(this.app, installedLibs, (iconId) => {
        // 不依赖 picker 内部 close，直接在这里处理
        if (iconId) {
          this.selectedIcon = iconId;
          // 用 innerHTML 直接替换，避免 DOM 归属问题
          const name = iconId.startsWith("lucide-") ? iconId.slice(7) : iconId;
          const svg = getIcon(name);
          if (svg) {
            this.iconDisplay.innerHTML = svg.outerHTML;
          }
        }
      });
      picker.open();
    });

    // 创建按钮
    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("创建")
        .setCta()
        .onClick(async () => {
          await this.createProject(customIcons);
        })
    );

    // 自动聚焦
    setTimeout(() => {
      const input = contentEl.querySelector("input[type=text]") as HTMLInputElement;
      if (input) input.focus();
    }, 50);
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private nameValue = "";
  private numberValue = "";
  private descValue = "";
  private numberInput!: HTMLInputElement;
  private nameInput!: HTMLInputElement;
  private typeSelect!: HTMLSelectElement;

  private refreshIconDisplay(): void {
    const iconName = this.selectedIcon.startsWith("lucide-") ? this.selectedIcon.slice(7) : this.selectedIcon;
    const svg = getIcon(iconName);
    if (svg) {
      this.iconDisplay.innerHTML = svg.outerHTML;
    } else {
      this.iconDisplay.innerHTML = SVG_ICON.folder;
    }
  }

  private async createProject(customIcons: Record<string, string>): Promise<void> {
    const number = this.numberValue.trim();
    const name = this.nameValue.trim();
    if (!/^\d+$/.test(number)) {
      new Notice("项目编号只能包含数字");
      this.numberInput.focus();
      return;
    }
    if (!name || /[\\/:*?"<>|]/.test(name) || name === "." || name === "..") {
      new Notice("请输入有效的项目名称，不能包含 \\ / : * ? \" < > |");
      this.nameInput.focus();
      return;
    }

    const typeFolder = this.typeSelect.value;
    const category = this.settingsManager.getSettings().homepage.projectCategories
      .find((item) => getProjectCategoryFolder(item) === typeFolder);
    if (!category) {
      new Notice("请先在设置中添加项目分类");
      return;
    }
    const folderName = `${number}_${name}`;
    const projectPath = `${typeFolder}/${folderName}`;

    if (this.app.vault.getAbstractFileByPath(projectPath)) {
      new Notice(`项目文件夹 ${folderName} 已存在`);
      return;
    }

    const categoryFolder = this.app.vault.getAbstractFileByPath(typeFolder);
    if (
      categoryFolder instanceof TFolder
      && categoryFolder.children.some((child) => child instanceof TFolder && child.name.startsWith(`${number}_`))
    ) {
      new Notice(`项目编号 ${number} 在“${category.name}”分类中已存在`);
      this.numberInput.focus();
      return;
    }

    // 创建项目根目录
    await this.app.vault.createFolder(projectPath);

    const projectSubfolders = this.settingsManager.getSettings().homepage.projectSubfolders[category.number] ?? [];
    const updatedIcons = { ...customIcons };
    for (const template of projectSubfolders) {
      const subfolderPath = `${projectPath}/${getProjectSubfolderName(template)}`;
      await this.app.vault.createFolder(subfolderPath);
      if (template.icon) updatedIcons[subfolderPath] = template.icon;
    }

    // 项目概览、时间轴与待办统一保存在项目主页文件。
    const consoleData = createDefaultConsoleData(name, this.selectedIcon, category.name, this.descValue.trim());
    await this.app.vault.create(
      `${projectPath}/${PROJECT_HOME_FILENAME}`,
      JSON.stringify(consoleData, null, 2)
    );

    if (this.selectedIcon !== "lucide-folder") updatedIcons[projectPath] = this.selectedIcon;
    if (Object.keys(updatedIcons).length !== Object.keys(customIcons).length || this.selectedIcon !== "lucide-folder") {
      await this.settingsManager.update("iconSystem", { customIcons: updatedIcons });
    }

    this.close();
    this.scanService.markDirty();
    this.onCreated();
  }

}

class HomepageTaskCreateModal extends Modal {
  private projectPath = "";
  private text = "";
  private due = "";
  private dueTime = "";
  private priority: StorageTaskPriority = "medium";
  private destroySchedulePicker: (() => void) | null = null;

  constructor(
    app: App,
    private projects: HomepageProject[],
    private onSubmit: (projectPath: string, text: string, due: string, dueTime: string, priority: StorageTaskPriority) => Promise<void>,
  ) {
    super(app);
    this.projectPath = projects[0]?.folderPath || "";
  }

  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.createEl("h2", { text: "添加待办" });

    new Setting(this.contentEl).setName("项目").addDropdown((dropdown) => {
      for (const project of this.projects) dropdown.addOption(project.folderPath, project.name);
      dropdown.setValue(this.projectPath).onChange((value) => { this.projectPath = value; });
    });
    const taskContentSetting = new Setting(this.contentEl).setName("任务内容");
    taskContentSetting.settingEl.addClass("homepage-task-content-setting");
    taskContentSetting.addTextArea((input) => {
      input.setPlaceholder("输入任务内容，支持 Markdown 和换行").onChange((value) => { this.text = value; });
      input.inputEl.addClass("homepage-task-content-input");
    });
    const scheduleSetting = new Setting(this.contentEl).setName("截止时间");
    scheduleSetting.settingEl.addClass("zendian-task-schedule-setting");
    scheduleSetting.controlEl.addClass("zendian-task-schedule-controls");
    this.destroySchedulePicker = createTaskSchedulePicker(scheduleSetting.controlEl, { date: this.due, time: this.dueTime }, (value) => {
      this.due = value.date;
      this.dueTime = value.time;
    });
    new Setting(this.contentEl).setName("优先级").addDropdown((dropdown) => {
      dropdown
        .addOption("urgent", "紧急（P0）")
        .addOption("high", "重要（P1）")
        .addOption("medium", "普通（P2）")
        .addOption("low", "低优（P3）")
        .setValue(this.priority)
        .onChange((value) => { this.priority = value as StorageTaskPriority; });
    });
    new Setting(this.contentEl).addButton((button) => {
      button.setButtonText("添加").setCta().onClick(async () => {
        if (!this.projectPath || !this.text) {
          new Notice("请选择项目并填写任务内容");
          return;
        }
        if (this.dueTime && !this.due) {
          new Notice("填写时间前请先选择截止日期");
          return;
        }
        await this.onSubmit(this.projectPath, this.text, this.due, this.dueTime, this.priority);
        this.close();
      });
    });
  }

  onClose(): void {
    this.destroySchedulePicker?.();
    this.destroySchedulePicker = null;
    this.contentEl.empty();
  }
}

export class HomepageView extends ItemView {
  private clockTimer: number | null = null;
  private resizeFrame: number | null = null;
  private statsService!: HomepageStatsService;
  private dataService!: HomepageDataService;
  private bookmarksService!: HomepageBookmarksService;
  private timelineService!: ProjectTimelineService;
  private weatherService!: HomepageWeatherService;
  private projectScanService!: HomepageProjectScanService;
  private activityLogService!: ActivityLogService;
  private currentTodoTab: TodoTabKey = "all";
  private currentStickyIndex = 0;
  private currentProjectFilter: ProjectFilter = DEFAULT_FILTER;
  private allProjects: HomepageProject[] = [];
  private unsubSettings: (() => void) | null = null;
  private unsubActivityStats: (() => void) | null = null;

  constructor(leaf: WorkspaceLeaf, private dependencies: HomepageDependencies) {
    super(leaf);
    this.activityLogService = dependencies.activityLogService;
  }

  getViewType(): string {
    return VIEW_TYPE_HOMEPAGE;
  }

  getDisplayText(): string {
    return "主页";
  }

  getIcon(): string {
    return "layout-dashboard";
  }

  async onOpen(): Promise<void> {
    // 初始化服务
    this.statsService = new HomepageStatsService(this.app);
    this.dataService = new HomepageDataService(this.app);
    this.bookmarksService = new HomepageBookmarksService(this.app);
    this.weatherService = new HomepageWeatherService();
    this.projectScanService = new HomepageProjectScanService(this.app);
    this.timelineService = new ProjectTimelineService(this.app);

    await this.dataService.load();

    // 监听 vault 文件变化，增量更新项目扫描
    this.registerEvent(this.app.vault.on("create", () => this.onProjectVaultChange()));
    this.registerEvent(this.app.vault.on("modify", () => this.onProjectVaultChange()));
    this.registerEvent(this.app.vault.on("delete", () => this.onProjectVaultChange()));
    this.registerEvent(this.app.vault.on("rename", () => this.onProjectVaultChange()));
    this.registerDomEvent(window, "resize", () => {
      if (this.resizeFrame !== null) window.cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = window.requestAnimationFrame(() => {
        this.resizeFrame = null;
        this.loadHeatmap();
      });
    });

    this.renderDashboard();

    // 监听设置变更，自动刷新天气
    this.unsubSettings = this.dependencies.events.on(Events.SETTINGS_CHANGED, (changedKeys: string[]) => {
      if (changedKeys.includes("homepage")) this.renderDashboard();
    });
    this.unsubActivityStats = this.dependencies.events.on(Events.ACTIVITY_STATS_CHANGED, () => void this.loadMonthlyStats());
  }

  private renderDashboard(): void {
    this.stopClock();
    const settings = this.dependencies.settingsManager.getSettings().homepage;
    const container = this.containerEl.children[1] as HTMLElement | undefined;
    if (!container) return;

    container.empty();
    container.addClass("zendian-homepage");
    const wrapper = container.createDiv({ cls: "homepage-wrapper" });
    wrapper.createDiv({ cls: "homepage-bg" });
    const content = wrapper.createDiv({ cls: "homepage-content" });
    const main = content.createDiv({ cls: "homepage-container" });

    this.renderHeader(main);
    if (!settings.weatherEnabled) {
      main.querySelector(".homepage-weather-card")?.remove();
    }

    const insightLayout = settings.heatmapEnabled && settings.monthlyStatsEnabled ? "paired" : "single";
    const grid = main.createDiv({ cls: "homepage-grid", attr: { "data-insight-layout": insightLayout } });
    this.renderDailyReview(grid);
    if (settings.projectBoardEnabled) this.renderProjects(grid);
    this.renderTodo(grid);
    this.renderStickyNotes(grid);
    if (settings.bookmarksEnabled) this.renderBookmarks(grid);
    this.renderRecentNotes(grid);
    if (settings.heatmapEnabled) this.renderHeatmap(grid);
    if (settings.monthlyStatsEnabled) this.renderMonthlyStats(grid);

    this.startClock();
    void this.loadDataAsync();
    this.initAnimations();
  }

  async onClose(): Promise<void> {
    this.stopClock();
    if (this.resizeFrame !== null) {
      window.cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = null;
    }
    if (this.unsubSettings) {
      this.unsubSettings();
      this.unsubSettings = null;
    }
    if (this.unsubActivityStats) {
      this.unsubActivityStats();
      this.unsubActivityStats = null;
    }
  }

  // ══════════════════════════════════════════════════════════
  // 渲染方法
  // ══════════════════════════════════════════════════════════

  // ── Header 区域 ────────────────────────────────────────────

  private renderHeader(parent: HTMLElement): void {
    const header = parent.createDiv({ cls: "homepage-header" });

    // 左侧：问候
    const left = header.createDiv({ cls: "homepage-header-left" });
    const h1 = left.createEl("h1", { cls: "homepage-header-greeting" });
    h1.appendChild(svgIcon("wave", "homepage-header-icon"));
    h1.createSpan({ cls: "homepage-header-greeting-text", text: "你好，加载中..." });
    left.createEl("p", { cls: "homepage-header-date", text: "加载中..." });

    // 右侧：搜索框 + 天气
    const right = header.createDiv({ cls: "homepage-header-right" });

    // 搜索框
    const searchBox = right.createDiv({ cls: "homepage-search-box" });
    const searchIcon = searchBox.createEl("span", { cls: "homepage-search-icon" });
    searchIcon.innerHTML = SVG_ICON.search;
    const searchInput = searchBox.createEl("input", {
      cls: "homepage-search-input",
      attr: { type: "text", placeholder: "搜索笔记..." },
    });
    const searchPanel = searchBox.createDiv({ cls: "homepage-search-panel" });

    let searchDebounce: ReturnType<typeof setTimeout> | null = null;

    searchInput.addEventListener("input", () => {
      if (searchDebounce) clearTimeout(searchDebounce);
      const query = searchInput.value.trim();
      if (!query) {
        searchPanel.removeClass("is-visible");
        searchPanel.empty();
        return;
      }
      searchDebounce = setTimeout(() => this.renderSearchResults(searchPanel, query), 200);
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        searchInput.value = "";
        searchPanel.removeClass("is-visible");
        searchPanel.empty();
      } else if (e.key === "Enter") {
        const query = searchInput.value.trim();
        if (query) {
          (this.app as any).internalPlugins?.getPluginById?.("global-search")?.instance?.openGlobalSearch(query);
        }
      }
    });

    // 点击外部关闭搜索面板
    this.registerDomEvent(document, "click", (e) => {
      if (!searchBox.contains(e.target as Node)) {
        searchPanel.removeClass("is-visible");
      }
    });
    // 天气卡片
    const weatherCard = right.createDiv({ cls: "homepage-weather-card" });
    const weatherIconWrap = weatherCard.createDiv({ cls: "homepage-weather-icon-wrap" });
    weatherIconWrap.innerHTML = SVG_ICON.sun;
    const weatherInfo = weatherCard.createDiv({ cls: "homepage-weather-info" });
    weatherInfo.createDiv({ cls: "homepage-weather-temp", text: "--°C" });
    weatherInfo.createDiv({ cls: "homepage-weather-desc", text: "加载中..." });
    const weatherSep = weatherCard.createDiv({ cls: "homepage-weather-separator" });
    const weatherLoc = weatherCard.createDiv({ cls: "homepage-weather-location" });
    weatherLoc.createSpan({ cls: "homepage-weather-location-text", text: "" });
    const locIcon = weatherLoc.createSpan({ cls: "homepage-icon" });
    locIcon.innerHTML = SVG_ICON.mapPin;
  }

  // ── 每日回顾 (col-span-6) ──────────────────────────────────

  private renderDailyReview(parent: HTMLElement): void {
    const card = parent.createDiv({ cls: "homepage-card homepage-col-7", attr: { "data-section": "daily-review" } });

    // 标题行
    const titleRow = card.createDiv({ cls: "homepage-card-title-row" });
    const titleLeft = titleRow.createDiv({ cls: "homepage-card-title" });
    titleLeft.appendChild(svgIcon("calendar"));
    titleLeft.createSpan({ text: "每日回顾" });

    // 主体：环形进度条 + 检查列表
    const body = card.createDiv({ cls: "homepage-review-body" });

    // 左侧：环形进度条 — 今日元气值
    const ringWrapper = body.createDiv({ cls: "homepage-review-ring-wrapper" });
    const svg = ringWrapper.createSvg("svg", {
      cls: "homepage-review-ring",
      attr: { viewBox: "0 0 100 100" },
    });
    // 底圈
    svg.createSvg("circle", {
      cls: "homepage-review-ring-bg",
      attr: { cx: "50", cy: "50", r: "45", fill: "none", stroke: "#f0f2f5", "stroke-width": "6" },
    });
    // 进度圈
    svg.createSvg("circle", {
      cls: "homepage-review-ring-fill",
      attr: {
        cx: "50", cy: "50", r: "45", fill: "none",
        stroke: "#5c5cff", "stroke-width": "6",
        "stroke-linecap": "round",
        "stroke-dasharray": "282.6",
        "stroke-dashoffset": "282.6",
        transform: "rotate(-90 50 50)",
      },
    });
    const ringCenter = ringWrapper.createDiv({ cls: "homepage-review-ring-center" });
    ringCenter.createDiv({ cls: "homepage-review-ring-value", text: "0" });
    ringCenter.createDiv({ cls: "homepage-review-ring-label", text: "今日元气值" });

    // 右侧：检查列表
    const checklist = body.createDiv({ cls: "homepage-review-checklist" });
    const items = [
      { key: "notes", icon: "fileText" as const, label: "记录笔记", value: "0 条" },
      { key: "tasks", icon: "checkSquare" as const, label: "完成待办", value: "0 项" },
      { key: "reading", icon: "bookOpen" as const, label: "阅读文章", value: "0 篇" },
      { key: "remaining", icon: "clock" as const, label: "剩余待办", value: "0 项" },
    ];
    for (const item of items) {
      const row = checklist.createDiv({ cls: "homepage-review-item", attr: { "data-review": item.key } });
      const left = row.createDiv({ cls: "homepage-review-item-left" });
      left.appendChild(svgIcon(item.icon));
      left.createSpan({ cls: "homepage-review-item-label", text: item.label });
      const right = row.createDiv({ cls: "homepage-review-item-right" });
      right.createSpan({ cls: "homepage-review-item-value", text: item.value, attr: { "data-review-value": item.key } });
      const statusIcon = right.createSpan({ cls: "homepage-review-item-status homepage-icon" });
      statusIcon.innerHTML = SVG_ICON.circle;
    }

  }

  // ── 进行中的项目 (col-span-5) ─────────────────────────────

  private renderProjects(parent: HTMLElement): void {
    const card = parent.createDiv({ cls: "homepage-card homepage-col-5", attr: { "data-section": "projects" } });

    // 标题行
    const titleRow = card.createDiv({ cls: "homepage-card-title-row" });
    const titleLeft = titleRow.createDiv({ cls: "homepage-card-title" });
    titleLeft.appendChild(svgIcon("folder"));
    titleLeft.createSpan({ text: "进行中的项目" });
    const titleRight = titleRow.createDiv({ cls: "homepage-card-title-actions" });
    createCardIconButton(titleRight, "plus", "新建项目", () => this.openProjectCreateModal());
    createCardIconButton(titleRight, "list", "查看全部项目", () => this.showAllProjects());

    // 项目列表
    card.createDiv({ cls: "homepage-project-list" });
  }

  // ── 待办 (col-span-4) ─────────────────────────────────────

  private renderTodo(parent: HTMLElement): void {
    const card = parent.createDiv({ cls: "homepage-card homepage-col-4", attr: { "data-section": "todo" } });

    // 标题行
    const titleRow = card.createDiv({ cls: "homepage-card-title-row" });
    const titleLeft = titleRow.createDiv({ cls: "homepage-card-title" });
    titleLeft.appendChild(svgIcon("checkSquare"));
    titleLeft.createSpan({ text: "待办" });
    const titleRight = titleRow.createDiv({ cls: "homepage-card-title-actions" });
    createCardIconButton(titleRight, "plus", "新建待办", () => this.openTaskCreateModal());
    createCardIconButton(titleRight, "list", "查看全部待办", () => this.showAllTodos());

    // Tabs
    const tabs = card.createDiv({ cls: "homepage-todo-tabs" });
    for (const tab of TODO_TABS) {
      const isActive = tab.key === this.currentTodoTab;
      const tabEl = tabs.createDiv({
        cls: `homepage-todo-tab${isActive ? " homepage-todo-tab--active" : ""}`,
        attr: { "data-tab": tab.key },
      });
      tabEl.createSpan({ text: tab.label });
      tabEl.createSpan({ cls: "homepage-todo-tab-count", text: "0" });
      tabEl.addEventListener("click", () => {
        this.currentTodoTab = tab.key;
        tabs.querySelectorAll(".homepage-todo-tab").forEach((t) => t.removeClass("homepage-todo-tab--active"));
        tabEl.addClass("homepage-todo-tab--active");
        this.loadTodos();
      });
    }

    // 待办列表
    card.createDiv({ cls: "homepage-todo-list" });
  }

  // ── 灵感速记 (col-span-4) ─────────────────────────────────

  private renderStickyNotes(parent: HTMLElement): void {
    const card = parent.createDiv({ cls: "homepage-card homepage-col-4", attr: { "data-section": "sticky-notes" } });

    // 标题行
    const titleRow = card.createDiv({ cls: "homepage-card-title-row" });
    const titleLeft = titleRow.createDiv({ cls: "homepage-card-title" });
    titleLeft.appendChild(svgIcon("stickyNote"));
    titleLeft.createSpan({ text: "灵感速记" });
    const titleRight = titleRow.createDiv({ cls: "homepage-card-title-actions" });
    createCardIconButton(titleRight, "plus", "新建灵感速记", () => this.openQuickNoteModal());
    createCardIconButton(titleRight, "list", "查看全部灵感速记", () => this.showAllStickyNotes());

    const carousel = card.createDiv({ cls: "homepage-sticky-carousel" });
    carousel.createDiv({ cls: "homepage-sticky-grid homepage-sticky-stage" });
    const navigation = carousel.createDiv({ cls: "homepage-sticky-navigation" });
    const previousButton = navigation.createEl("button", {
      cls: "homepage-sticky-nav-button",
      text: "<",
      attr: { type: "button", "aria-label": "上一条灵感速记", "data-sticky-previous": "" },
    });
    previousButton.addEventListener("click", () => this.cycleStickyNote(-1));
    navigation.createSpan({ cls: "homepage-sticky-counter", attr: { "data-sticky-counter": "" }, text: "0 / 0" });
    const nextButton = navigation.createEl("button", {
      cls: "homepage-sticky-nav-button",
      text: ">",
      attr: { type: "button", "aria-label": "下一条灵感速记", "data-sticky-next": "" },
    });
    nextButton.addEventListener("click", () => this.cycleStickyNote(1));
  }

  private renderBookmarks(parent: HTMLElement): void {
    const card = parent.createDiv({ cls: "homepage-card homepage-col-4", attr: { "data-section": "bookmarks" } });
    const titleRow = card.createDiv({ cls: "homepage-card-title-row" });
    const titleLeft = titleRow.createDiv({ cls: "homepage-card-title" });
    titleLeft.appendChild(svgIcon("star"));
    titleLeft.createSpan({ text: "书签" });
    card.createDiv({ cls: "homepage-recent-list homepage-bookmark-list" });
  }

  private async loadBookmarks(): Promise<void> {
    const list = this.containerEl.querySelector('[data-section="bookmarks"] .homepage-bookmark-list');
    if (!(list instanceof HTMLElement)) return;

    const bookmarks = await this.bookmarksService.getBookmarks(6);
    list.empty();
    if (!bookmarks.length) {
      list.createDiv({ cls: "homepage-empty-text", text: "暂无书签" });
      return;
    }

    for (const bookmark of bookmarks) {
      const item = list.createDiv({ cls: "homepage-recent-item" });
      const left = item.createDiv({ cls: "homepage-recent-item-left" });
      const icon = left.createDiv({ cls: "homepage-recent-icon" });
      icon.innerHTML = bookmark.type === "folder" ? SVG_ICON.folder : SVG_ICON.star;
      left.createSpan({ cls: "homepage-recent-title", text: bookmark.title });
      item.addEventListener("click", () => { void this.bookmarksService.openBookmark(bookmark); });
    }
  }

  // ── 创作节律 (col-span-8) ─────────────────────────────────

  private renderHeatmap(parent: HTMLElement): void {
    const card = parent.createDiv({ cls: "homepage-card homepage-rhythm-card", attr: { "data-section": "heatmap" } });

    // 标题行
    const titleRow = card.createDiv({ cls: "homepage-card-title-row" });
    const titleLeft = titleRow.createDiv({ cls: "homepage-card-title" });
    titleLeft.appendChild(svgIcon("flame"));
    titleLeft.createSpan({ text: "创作节律" });

    // 热力图主体
    const heatmapWrap = card.createDiv({ cls: "homepage-heatmap-wrap" });

    // 月份标签行
    heatmapWrap.createDiv({ cls: "homepage-heatmap-months", attr: { "data-months": "" } });

    const heatmapBody = heatmapWrap.createDiv({ cls: "homepage-heatmap-body" });

    // 星期标签
    const dayLabels = heatmapBody.createDiv({ cls: "homepage-heatmap-days" });
    for (const d of ["一", "二", "三", "四", "五", "六", "日"]) {
      dayLabels.createDiv({ cls: "homepage-heatmap-day-label", text: d });
    }

    // 可见周数在数据加载时按容器宽度动态计算。
    heatmapBody.createDiv({ cls: "homepage-heatmap-grid" });

    const rhythmSummary = card.createDiv({ cls: "homepage-rhythm-summary" });
    const activeDays = rhythmSummary.createDiv({ cls: "homepage-rhythm-stat" });
    activeDays.createDiv({ cls: "homepage-rhythm-stat-label", text: "今年活跃天数" });
    activeDays.createDiv({ cls: "homepage-rhythm-stat-value", attr: { "data-active-days": "" }, text: "—" });
    activeDays.createDiv({ cls: "homepage-rhythm-stat-unit", text: "天" });
    const monthlyTrend = rhythmSummary.createDiv({ cls: "homepage-rhythm-stat homepage-rhythm-stat-trend" });
    monthlyTrend.createDiv({ cls: "homepage-rhythm-stat-label", text: "本月趋势" });
    monthlyTrend.createDiv({ cls: "homepage-rhythm-stat-value", attr: { "data-monthly-trend": "" }, text: "—" });
    monthlyTrend.createDiv({ cls: "homepage-rhythm-stat-unit", text: "较上月" });

    // 图例（放在 wrap 内，紧跟 heatmap-body）
    const legend = heatmapWrap.createDiv({ cls: "homepage-heatmap-legend" });
    legend.createSpan({ cls: "homepage-heatmap-legend-label", text: "少" });
    for (let i = 0; i <= 4; i++) {
      legend.createDiv({ cls: "homepage-heatmap-cell homepage-heatmap-legend-cell", attr: { "data-level": String(i) } });
    }
    legend.createSpan({ cls: "homepage-heatmap-legend-label", text: "多" });
    legend.createDiv({ cls: "homepage-heatmap-legend-total", attr: { "data-heatmap-total": "" }, text: "" });
  }

  // ── 本月洞察 (col-span-5) ─────────────────────────────────

  private renderMonthlyStats(parent: HTMLElement): void {
    const card = parent.createDiv({ cls: "homepage-card homepage-metrics-card", attr: { "data-section": "monthly-stats" } });

    const titleRow = card.createDiv({ cls: "homepage-card-title-row" });
    const titleLeft = titleRow.createDiv({ cls: "homepage-card-title" });
    titleLeft.appendChild(svgIcon("barChart"));
    titleLeft.createSpan({ text: "本月洞察" });

    const metricsGrid = card.createDiv({ cls: "homepage-metrics-grid" });
    const metrics = [
      { key: "taskCompleted", label: "完成任务", value: "0", trend: "", icon: "checkSquare", tone: "green" },
      { key: "focusTime", label: "专注时长", value: "0", trend: "", icon: "clock", tone: "blue" },
      { key: "activeProjects", label: "活跃项目", value: "0", trend: "", icon: "folder", tone: "purple" },
      { key: "noteGrowth", label: "笔记增长", value: "0", trend: "", icon: "fileText", tone: "red" },
    ];

    for (const m of metrics) {
      const metricCard = metricsGrid.createDiv({ cls: `homepage-metric-card homepage-metric-card--${m.tone}`, attr: { "data-metric": m.key } });
      metricCard.createDiv({ cls: "homepage-metric-label", text: m.label });

      const iconWrap = metricCard.createDiv({ cls: "homepage-metric-icon" });
      iconWrap.innerHTML = SVG_ICON[m.icon as keyof typeof SVG_ICON];

      const valueRow = metricCard.createDiv({ cls: "homepage-metric-value-row" });
      valueRow.createSpan({ cls: "homepage-metric-value", text: m.value });
      valueRow.createSpan({ cls: "homepage-metric-trend", text: m.trend });
    }
  }

  // ── 最近笔记 (col-span-4) ─────────────────────────────────

  private renderRecentNotes(parent: HTMLElement): void {
    const card = parent.createDiv({ cls: "homepage-card homepage-col-4", attr: { "data-section": "recent-notes" } });

    // 标题行
    const titleRow = card.createDiv({ cls: "homepage-card-title-row" });
    const titleLeft = titleRow.createDiv({ cls: "homepage-card-title" });
    titleLeft.appendChild(svgIcon("fileText"));
    titleLeft.createSpan({ text: "最近笔记" });

    // 笔记列表
    card.createDiv({ cls: "homepage-recent-list" });
  }

  // ══════════════════════════════════════════════════════════
  // 搜索结果
  // ══════════════════════════════════════════════════════════

  private renderSearchResults(panel: HTMLElement, query: string): void {
    panel.empty();
    const lowerQuery = query.toLowerCase();
    const files = this.app.vault
      .getMarkdownFiles()
      .filter((f) => {
        const name = f.basename.toLowerCase();
        const path = f.path.toLowerCase();
        return name.includes(lowerQuery) || path.includes(lowerQuery);
      })
      .slice(0, 8);

    panel.addClass("is-visible");

    if (files.length === 0) {
      panel.createDiv({ cls: "homepage-search-empty", text: "未找到匹配笔记" });
      return;
    }

    for (const file of files) {
      const item = panel.createDiv({ cls: "homepage-search-result-item" });
      const iconSpan = item.createSpan({ cls: "result-icon" });
      iconSpan.innerHTML = SVG_ICON.fileText;
      const info = item.createDiv({ cls: "result-info" });
      info.createSpan({ cls: "result-title", text: file.basename });
      info.createSpan({ cls: "result-path", text: file.path });
      item.addEventListener("click", () => {
        this.app.workspace.openLinkText(file.path, "");
        panel.removeClass("is-visible");
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // 异步数据加载
  // ══════════════════════════════════════════════════════════

  private async loadDataAsync(): Promise<void> {
    try {
      const settings = this.dependencies.settingsManager.getSettings().homepage;
      const loaders: Array<Promise<unknown> | void> = [
        this.loadTodos(),
        this.loadStickyNotes(),
        this.loadDailyReviewStats(),
        this.loadRecentNotes(),
      ];
      if (settings.weatherEnabled) loaders.push(this.loadWeather());
      if (settings.heatmapEnabled) loaders.push(this.loadHeatmap());
      if (settings.monthlyStatsEnabled) loaders.push(this.loadMonthlyStats());
      if (settings.projectBoardEnabled) loaders.push(this.loadProjects());
      if (settings.bookmarksEnabled) loaders.push(this.loadBookmarks());
      await Promise.all(loaders);
    } catch (e) {
      console.error("[ZENdian Homepage] Data loading error:", e);
    }
  }

  // ── 天气 ──────────────────────────────────────────────────

  private async loadWeather(): Promise<void> {
    try {
      const settings = this.dependencies.settingsManager.getSettings();
      const location = settings?.homepage?.weatherLocation;
      const enabled = settings?.homepage?.weatherEnabled;

      if (!enabled || !location) return;

      const weather = await this.weatherService.getWeather(location);
      if (!weather) return;

      const iconWrap = this.containerEl.querySelector(".homepage-weather-icon-wrap") as HTMLElement | null;
      const tempEl = this.containerEl.querySelector(".homepage-weather-temp");
      const descEl = this.containerEl.querySelector(".homepage-weather-desc");
      const locTextEl = this.containerEl.querySelector(".homepage-weather-location-text");

      if (iconWrap) {
        iconWrap.innerHTML = weather.iconSvg;
        const isDark = document.body.classList.contains("theme-dark");
        iconWrap.style.background = isDark ? weather.iconBgDark : weather.iconBgLight;
        iconWrap.style.color = isDark ? weather.iconColorDark : weather.iconColorLight;
      }
      if (tempEl) tempEl.textContent = `${weather.temperature}°C`;
      if (descEl) descEl.textContent = weather.description;
      if (locTextEl) locTextEl.textContent = weather.location;
    } catch (e) {
      console.error("[ZENdian] Weather loading error:", e);
    }
  }

  // ── 热力图 ────────────────────────────────────────────────

  private loadHeatmap(): void {
    const data = this.statsService.getHeatmapData(364);
    const card = this.containerEl.querySelector('[data-section="heatmap"]') as HTMLElement | null;
    const bodyEl = card?.querySelector(".homepage-heatmap-body") as HTMLElement | null;
    const dayLabelsEl = card?.querySelector(".homepage-heatmap-days") as HTMLElement | null;
    const gridEl = card?.querySelector(".homepage-heatmap-grid") as HTMLElement | null;
    const monthsEl = card?.querySelector("[data-months]") as HTMLElement | null;
    if (!card || !bodyEl || !gridEl || !monthsEl) return;

    const cardStyles = window.getComputedStyle(card);
    const cellSize = Number.parseFloat(cardStyles.getPropertyValue("--rhythm-cell-size")) || 14;
    const cellGap = Number.parseFloat(cardStyles.getPropertyValue("--rhythm-cell-gap")) || 3;
    const labelsWidth = dayLabelsEl?.offsetWidth || 16;
    const availableWidth = Math.max(0, bodyEl.clientWidth - labelsWidth - 8);
    const visibleWeeks = Math.max(8, Math.min(52, Math.floor((availableWidth + cellGap) / (cellSize + cellGap))));
    const visibleData = data.slice(-visibleWeeks * 7);
    card.style.setProperty("--rhythm-weeks", String(visibleWeeks));

    const maxCount = Math.max(1, ...data.map((d) => d.count));
    const now = new Date();
    const currentYear = String(now.getFullYear());
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const yearActiveDays = data.filter((day) => day.count > 0 && day.date.startsWith(currentYear)).length;

    gridEl.empty();
    visibleData.forEach((day) => {
      let level = 0;
      if (day.count > 0) {
        const ratio = day.count / maxCount;
        if (ratio > 0.75) level = 4;
        else if (ratio > 0.5) level = 3;
        else if (ratio > 0.25) level = 2;
        else level = 1;
      }

      const cell = gridEl.createDiv({
        cls: "homepage-heatmap-cell",
        attr: { "data-level": String(level), title: `${day.date}: ${day.count} 次修改` },
      });
      if (day.date > todayKey) cell.addClass("is-future");
    });

    monthsEl.empty();
    let previousMonth = -1;
    visibleData.forEach((day, index) => {
      const month = Number(day.date.split("-")[1]);
      if (month === previousMonth) return;
      previousMonth = month;
      const label = monthsEl.createSpan({ cls: "homepage-heatmap-month-label", text: `${month}月` });
      label.style.gridColumn = String(Math.floor(index / 7) + 1);
    });

    // 总天数
    const totalEl = this.containerEl.querySelector("[data-heatmap-total]");
    if (totalEl) totalEl.textContent = "";
    const activeDaysEl = this.containerEl.querySelector("[data-active-days]");
    if (activeDaysEl) activeDaysEl.textContent = String(yearActiveDays);
    const monthlyTrendEl = this.containerEl.querySelector("[data-monthly-trend]");
    if (monthlyTrendEl) monthlyTrendEl.textContent = "计算中";
  }

  // ── 月度统计 ──────────────────────────────────────────────

  private async loadMonthlyStats(): Promise<void> {
    const stats = this.statsService.getMonthlyStats();
    const activityStats = this.activityLogService.getMonthlyStats();
    const lastMonthStats = this.activityLogService.getLastMonthStats();
    const lastMonthNoteCount = this.statsService.getLastMonthNoteCount();
    const lastMonthActiveDays = this.statsService.getLastMonthActiveDays();
    const taskCompletions = await this.getMonthlyTaskCompletionCounts();

    const projectPaths = await this.getProjectPaths(this.dependencies.settingsManager.getSettings().homepage.projectCategories);
    const updates: Record<string, string> = {
      taskCompleted: String(taskCompletions.current),
      focusTime: this.formatFocusMinutes(activityStats.focusMinutes),
      activeProjects: String(projectPaths.length),
      noteGrowth: String(stats.noteCount),
    };

    for (const [key, value] of Object.entries(updates)) {
      const el = this.containerEl.querySelector(`[data-metric="${key}"] .homepage-metric-value`);
      if (el) el.textContent = value;
    }

    const trends: Record<string, string> = {
      taskCompleted: this.formatMetricTrend(taskCompletions.current, taskCompletions.previous),
      focusTime: this.formatMetricTrend(activityStats.focusMinutes, lastMonthStats.focusMinutes),
      activeProjects: "— 持平",
      noteGrowth: this.formatMetricTrend(stats.noteCount, lastMonthNoteCount),
    };
    for (const [key, trend] of Object.entries(trends)) {
      const element = this.containerEl.querySelector(`[data-metric="${key}"] .homepage-metric-trend`);
      if (element) element.textContent = trend;
    }
    const monthlyTrendEl = this.containerEl.querySelector("[data-monthly-trend]");
    if (monthlyTrendEl) {
      monthlyTrendEl.textContent = this.formatMetricTrend(stats.activeDays, lastMonthActiveDays).replace(" 较上月", "");
    }
  }

  private async getMonthlyTaskCompletionCounts(): Promise<{ current: number; previous: number }> {
    const settings = this.dependencies.settingsManager.getSettings();
    const projectPaths = await this.getProjectPaths(settings.homepage.projectCategories);
    const tasks = await this.dependencies.taskSyncService.getAllTasks(projectPaths);
    const now = new Date();
    const currentStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const nextStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    let current = 0;
    let previous = 0;
    for (const task of tasks) {
      if (!task.completedAt) continue;
      const completedAt = new Date(task.completedAt).getTime();
      if (!Number.isFinite(completedAt)) continue;
      if (completedAt >= currentStart && completedAt < nextStart) current++;
      else if (completedAt >= previousStart && completedAt < currentStart) previous++;
    }
    return { current, previous };
  }

  private formatMetricTrend(current: number, previous: number): string {
    if (previous <= 0) return current > 0 ? "▲ 本月新增" : "— 暂无变化";
    const percent = Math.round((current - previous) / previous * 100);
    if (percent === 0) return "— 持平";
    return `${percent > 0 ? "▲" : "▼"} ${Math.abs(percent)}% 较上月`;
  }

  private formatFocusMinutes(minutes: number): string {
    const rounded = Math.round(minutes);
    if (rounded < 60) return `${rounded} 分`;
    return `${(rounded / 60).toFixed(1)} 小时`;
  }

  // ── 最近笔记 ──────────────────────────────────────────────

  private async loadRecentNotes(): Promise<void> {
    const count = this.dependencies.settingsManager.getSettings().homepage.recentNoteCount;
    const notes = this.statsService.getRecentNotes(count);
    const list = this.containerEl.querySelector('[data-section="recent-notes"] .homepage-recent-list');
    if (!list) return;

    list.empty();

    for (const note of notes) {
      const item = list.createDiv({ cls: "homepage-recent-item" });

      // 左侧：图标 + 标题
      const left = item.createDiv({ cls: "homepage-recent-item-left" });
      const iconWrap = left.createDiv({ cls: "homepage-recent-icon" });
      iconWrap.innerHTML = SVG_ICON.fileText;
      left.createSpan({ cls: "homepage-recent-title", text: note.title });

      // 右侧：标签 + 时间
      const right = item.createDiv({ cls: "homepage-recent-item-right" });
      if (note.tags.length > 0) {
        right.createSpan({ cls: "homepage-recent-tag", text: note.tags[0] });
      }
      right.createSpan({ cls: "homepage-recent-time", text: this.formatTimestamp(note.mtime) });

      item.addEventListener("click", () => this.openFile(note.path));
    }
  }

  // ── 项目 ──────────────────────────────────────────────────

  private async loadProjects(): Promise<void> {
    const section = this.containerEl.querySelector('[data-section="projects"]');
    if (!section) return;

    const settings = this.dependencies.settingsManager.getSettings();
    const categories = settings.homepage.projectCategories;
    const archiveFolder = settings.homepage.projectArchiveFolder || "99_归档";

    // 加载所有项目
    this.allProjects = await this.projectScanService.getProjects(categories, archiveFolder);

    // 渲染筛选器（首次加载时）
    let filterContainer = section.querySelector('.homepage-project-filter-bar') as HTMLElement;
    if (!filterContainer) {
      const header = section.querySelector('.homepage-section-header');
      if (header) {
        filterContainer = document.createElement('div');
        filterContainer.className = 'homepage-project-filter-bar';
        header.after(filterContainer);
      }
    }

    if (filterContainer) {
      const projectTypes = categories.map((category) => category.name);
      if (this.currentProjectFilter.type !== "all" && !projectTypes.includes(this.currentProjectFilter.type)) {
        this.currentProjectFilter = { ...this.currentProjectFilter, type: "all" };
      }
      renderProjectFilterBar(filterContainer, this.currentProjectFilter, projectTypes, (newFilter) => {
        this.currentProjectFilter = newFilter;
        this.renderFilteredProjects();
      });
    }

    // 渲染项目列表
    this.renderFilteredProjects();
  }

  private renderFilteredProjects(): void {
    const list = this.containerEl.querySelector('[data-section="projects"] .homepage-project-list');
    if (!list) return;

    list.empty();

    // 应用筛选和排序
    const filtered = applyFilterAndSort(this.allProjects, this.currentProjectFilter);

    if (filtered.length === 0) {
      list.createDiv({ cls: "homepage-empty-text", text: "暂无符合条件的项目" });
      return;
    }

    for (const project of filtered) {
      this.renderProjectItem(list as HTMLElement, project);
    }
  }

  private renderProjectItem(parent: HTMLElement, project: HomepageProject): void {
    const tagColor = getProjectTypeColor(project.type);

    const item = parent.createDiv({ cls: "homepage-project-item", attr: { "data-project-id": project.id } });
    const main = item.createDiv({ cls: "homepage-project-main" });

    // 图标（使用主题色）
    const iconEl = main.createDiv({ cls: "homepage-project-icon" });
    this.renderProjectIcon(iconEl, project.folderPath);

    // 信息
    const info = main.createDiv({ cls: "homepage-project-info" });
    const nameRow = info.createDiv({ cls: "homepage-project-name-row" });
    nameRow.createSpan({ cls: "homepage-project-name", text: project.name });
    nameRow.createSpan({
      cls: "homepage-project-type-tag",
      text: project.type,
      attr: { style: `background: ${tagColor}18; color: ${tagColor}` },
    });
    this.renderProjectStatusTag(nameRow, project.status);

    // 进度条（使用主题色）
    const progressRow = info.createDiv({ cls: "homepage-project-progress-row" });
    const bar = progressRow.createDiv({ cls: "homepage-project-progress-bar" });
    bar.createDiv({ cls: "homepage-project-progress-fill", attr: { style: `width: ${project.progress}%` } });
    progressRow.createSpan({ cls: "homepage-project-progress-text", text: `${project.progress}%` });

    // 点击 → 弹出详情面板
    main.addEventListener("click", () => this.openProjectDetailPanel(project));
  }

  // ── 图标集成 ──────────────────────────────────────────────

  /**
   * 渲染项目图标：优先使用图标系统赋予的自定义图标，否则用默认 folder 图标
   */
  private renderProjectIcon(el: HTMLElement, folderPath: string): void {
    const settings = this.dependencies.settingsManager.getSettings();
    const customIcons: Record<string, string> = settings?.iconSystem?.customIcons || {};
    const iconId = customIcons[folderPath];

    if (iconId && iconId.startsWith("lucide-")) {
      const name = iconId.replace("lucide-", "");
      const svg = getIcon(name);
      if (svg) {
        el.innerHTML = "";
        el.appendChild(svg);
        return;
      }
    }

    // 降级：默认 folder 图标
    el.innerHTML = SVG_ICON.folder;
  }

  /**
   * 获取项目图标 SVG 元素（供弹窗使用）
   */
  private getProjectIconSvg(folderPath: string): SVGElement | null {
    const settings = this.dependencies.settingsManager.getSettings();
    const customIcons: Record<string, string> = settings?.iconSystem?.customIcons || {};
    const iconId = customIcons[folderPath];
    if (iconId && iconId.startsWith("lucide-")) {
      return getIcon(iconId.replace("lucide-", ""));
    }
    return null;
  }

  // ── 项目详情面板 ──────────────────────────────────────────

  private async openProjectDetailPanel(project: HomepageProject): Promise<void> {
    const tagColor = getProjectTypeColor(project.type);

    // 异步加载统计数据
    const statsPromise = this.timelineService.getProjectStats(project.folderPath);

    const overlay = this.app.workspace.containerEl.createDiv({ cls: "hp-detail-overlay" });
    const panel = overlay.createDiv({ cls: "hp-detail-panel hp-detail-panel-enhanced" });

    // 头部
    const header = panel.createDiv({ cls: "hp-detail-header" });
    const iconWrap = header.createDiv({ cls: "hp-detail-icon" });
    this.renderProjectIcon(iconWrap, project.folderPath);
    const headerInfo = header.createDiv({ cls: "hp-detail-header-info" });
    headerInfo.createEl("h2", { text: project.name, cls: "hp-detail-title" });
    const metaRow = headerInfo.createDiv({ cls: "hp-detail-meta" });
    metaRow.createSpan({ cls: "hp-detail-type-tag", text: project.type, attr: { style: `background: ${tagColor}18; color: ${tagColor}` } });
    this.renderProjectStatusTag(metaRow, project.status);
    metaRow.createSpan({ cls: "hp-detail-meta-text", text: `${project.taskDone}/${project.taskTotal} 任务完成` });

    // 关闭按钮
    const closeBtn = header.createDiv({ cls: "hp-detail-close", text: "×" });
    closeBtn.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

    // 内容区域（可滚动）
    const body = panel.createDiv({ cls: "hp-detail-body" });

    // 进度条
    const progressSection = body.createDiv({ cls: "hp-detail-progress" });
    const barBg = progressSection.createDiv({ cls: "hp-detail-progress-bar" });
    barBg.createDiv({ cls: "hp-detail-progress-fill", attr: { style: `width: ${project.progress}%` } });
    progressSection.createSpan({ cls: "hp-detail-progress-text", text: `${project.progress}%` });

    // 描述
    if (project.description) {
      body.createDiv({ cls: "hp-detail-desc", text: project.description });
    }

    // 统计卡片（异步加载）
    const statsContainer = body.createDiv({ cls: "hp-detail-stats" });
    statsContainer.createDiv({ cls: "hp-detail-stats-loading", text: "加载统计数据..." });

    statsPromise.then((stats) => {
      statsContainer.empty();
      this.renderProjectStats(statsContainer, stats);
    });

    // 待完成任务
    if (project.pendingTasks.length > 0) {
      const section = body.createDiv({ cls: "hp-detail-section" });
      section.createDiv({ cls: "hp-detail-section-title", text: "待完成任务" });
      for (const task of project.pendingTasks.slice(0, 5)) {
        const row = section.createDiv({ cls: "hp-detail-task-row" });
        const ri = row.createSpan({ cls: "homepage-icon" }); ri.innerHTML = SVG_ICON.circle;
        row.createSpan({ cls: "hp-detail-task-text", text: task.text });
        if (task.due) {
          row.createSpan({
            cls: "hp-detail-task-due",
            text: task.dueTime ? `${task.due} ${task.dueTime}` : task.due,
          });
        }
        row.addEventListener("click", () => {
          overlay.remove();
          const home = findProjectHomeFile(this.app, project.folderPath);
          if (home) void this.app.workspace.getLeaf(false).openFile(home);
        });
      }
    }

    // 最近编辑
    if (project.recentFiles.length > 0) {
      const section = body.createDiv({ cls: "hp-detail-section" });
      section.createDiv({ cls: "hp-detail-section-title", text: "最近编辑" });
      for (const file of project.recentFiles.slice(0, 5)) {
        const row = section.createDiv({ cls: "hp-detail-file-row" });
        const fi = row.createSpan({ cls: "homepage-icon" }); fi.innerHTML = SVG_ICON.fileText;
        row.createSpan({ cls: "hp-detail-file-name", text: file.name });
        row.createSpan({ cls: "hp-detail-file-time", text: this.formatRelativeTime(file.mtime) });
        row.addEventListener("click", () => { overlay.remove(); this.openFile(file.path); });
      }
    }

    // 底部操作
    const actions = panel.createDiv({ cls: "hp-detail-actions" });
    const openBtn = actions.createEl("a", { cls: "hp-detail-open-btn", text: "打开项目" });
    openBtn.addEventListener("click", () => { overlay.remove(); this.openProjectInNewTab(project.folderPath); });

    // 如果没有 .home 文件，显示「创建控制台」按钮
    if (!this.hasHomeFile(project.folderPath)) {
      const createBtn = actions.createEl("a", { cls: "hp-detail-open-btn hp-detail-create-home", text: "创建控制台" });
      createBtn.addEventListener("click", async () => {
        await this.createHomeFile(project);
        overlay.remove();
      });
    }

    setTimeout(() => closeBtn.focus(), 50);
  }

  /**
   * 渲染项目统计卡片
   */
  private renderProjectStats(container: HTMLElement, stats: ProjectStats): void {
    const grid = container.createDiv({ cls: "hp-detail-stats-grid" });

    const items = [
      { label: "文件", value: stats.totalFiles.toString(), icon: "fileText" },
      { label: "笔记", value: stats.totalNotes.toString(), icon: "bookOpen" },
      { label: "任务", value: `${stats.completedTasks}/${stats.totalTasks}`, icon: "checkSquare" },
      { label: "字数", value: this.formatNumber(stats.totalWords), icon: "pencil" },
      { label: "活跃天数", value: stats.activeDays.toString(), icon: "calendar" },
      { label: "最后活跃", value: stats.lastActiveDate, icon: "clock" },
    ];

    for (const item of items) {
      const card = grid.createDiv({ cls: "hp-detail-stat-card" });
      const iconEl = card.createDiv({ cls: "hp-detail-stat-icon" });
      iconEl.innerHTML = SVG_ICON[item.icon as keyof typeof SVG_ICON];
      const info = card.createDiv({ cls: "hp-detail-stat-info" });
      info.createDiv({ cls: "hp-detail-stat-value", text: item.value });
      info.createDiv({ cls: "hp-detail-stat-label", text: item.label });
    }
  }

  private formatNumber(num: number): string {
    if (num >= 10000) return `${(num / 10000).toFixed(1)}万`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  }

  // ── 查看全部面板 ──────────────────────────────────────────

  private async showAllProjects(): Promise<void> {
    const settings = this.dependencies.settingsManager.getSettings();
    const categories = settings.homepage.projectCategories;
    const archiveFolder = settings?.homepage?.projectArchiveFolder || "99_归档";
    const projects = await this.projectScanService.getProjects(categories, archiveFolder);

    const overlay = this.app.workspace.containerEl.createDiv({ cls: "hp-detail-overlay" });
    const panel = overlay.createDiv({ cls: "hp-all-panel" });

    // 头部
    const header = panel.createDiv({ cls: "hp-detail-header" });
    header.createEl("h2", { text: "全部项目", cls: "hp-detail-title" });
    const closeBtn = header.createDiv({ cls: "hp-detail-close", text: "×" });
    closeBtn.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

    // 按类型分组
    const grouped = new Map<string, HomepageProject[]>();
    for (const p of projects) {
      if (!grouped.has(p.type)) grouped.set(p.type, []);
      grouped.get(p.type)!.push(p);
    }

    const body = panel.createDiv({ cls: "hp-all-body" });
    for (const [type, items] of grouped) {
      const tagColor = getProjectTypeColor(type);
      const group = body.createDiv({ cls: "hp-all-group" });
      const groupHead = group.createDiv({ cls: "hp-all-group-head" });
      groupHead.createSpan({ cls: "hp-all-group-dot", attr: { style: `background: ${tagColor}` } });
      groupHead.createSpan({ text: `${type}（${items.length}）` });

      for (const p of items) {
        const row = group.createDiv({ cls: "hp-all-row" });
        const iconEl = row.createDiv({ cls: "homepage-project-icon" });
        this.renderProjectIcon(iconEl, p.folderPath);
        row.createSpan({ cls: "hp-all-row-name", text: p.name });
        this.renderProjectStatusTag(row, p.status);
        row.createSpan({ cls: "hp-all-row-progress", text: `${p.progress}%` });
        row.addEventListener("click", () => { overlay.remove(); this.openProjectDetailPanel(p); });
      }
    }

    if (projects.length === 0) {
      body.createDiv({ cls: "homepage-empty-text", text: "暂无项目" });
    }
  }

  // ── 新建项目弹窗 ──────────────────────────────────────────

  private openProjectCreateModal(): void {
    new ProjectCreateModal(
      this.app,
      this.projectScanService,
      () => this.loadProjects(),
      this.dependencies.settingsManager,
    ).open();
  }

  // ── 工具方法 ──────────────────────────────────────────────

  private async openProjectInNewTab(folderPath: string): Promise<void> {
    const homeFile = findProjectHomeFile(this.app, folderPath);
    if (homeFile) {
      const leaf = this.app.workspace.getLeaf("tab");
      await leaf.openFile(homeFile);
      return;
    }

    new Notice("该项目还没有项目主页");
  }

  private renderProjectStatusTag(container: HTMLElement, projectStatus: ProjectStatus): HTMLElement {
    const status = getProjectStatusOption(projectStatus);
    const tag = container.createSpan({
      cls: "zd-project-status-tag",
      attr: {
        "data-status": status.value,
        title: status.description,
        "aria-label": `项目状态：${status.label}`,
      },
    });
    tag.createSpan({ cls: "zd-project-status-dot", attr: { "aria-hidden": "true" } });
    tag.createSpan({ cls: "zd-project-status-label", text: status.label });
    return tag;
  }

  /** 检查项目是否有 .home 文件 */
  private hasHomeFile(folderPath: string): boolean {
    return Boolean(findProjectHomeFile(this.app, folderPath));
  }

  /** 为项目创建 .home 文件 */
  private async createHomeFile(project: HomepageProject): Promise<void> {
    const data = createDefaultConsoleData(project.name, "lucide-folder", project.type, project.description);
    const filePath = `${project.folderPath}/${PROJECT_HOME_FILENAME}`;
    await this.app.vault.create(filePath, JSON.stringify(data, null, 2));
    this.projectScanService.markDirty();
    this.loadProjects();
  }

  private formatRelativeTime(mtime: number): string {
    const now = Date.now();
    const diffMs = now - mtime;
    const diffMin = Math.floor(diffMs / 60_000);
    const diffHour = Math.floor(diffMs / 3_600_000);
    const diffDay = Math.floor(diffMs / 86_400_000);

    if (diffMin < 1) return "刚刚";
    if (diffMin < 60) return `${diffMin} 分钟前`;
    if (diffHour < 24) return `${diffHour} 小时前`;
    if (diffDay < 7) return `${diffDay} 天前`;

    const d = new Date(mtime);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  private onProjectVaultChange(): void {
    this.projectScanService.markDirty();
    this.loadProjects();
  }

  // ── 待办 ──────────────────────────────────────────────────

  private async getCurrentTodoTasks(): Promise<Task[]> {
    const settings = this.dependencies.settingsManager.getSettings();
    const projectPaths = await this.getProjectPaths(settings.homepage.projectCategories);
    let tasks = await this.dependencies.taskSyncService.getAllTasks(projectPaths);

    this.updateTodoTabCountsNew(tasks);

    if (this.currentTodoTab === "done") {
      tasks = tasks.filter((task) => task.completed);
    } else if (this.currentTodoTab === "today") {
      tasks = this.dependencies.taskSyncService.filterTodayDue(tasks);
    } else if (this.currentTodoTab === "week") {
      tasks = this.dependencies.taskSyncService.filterWeekDue(tasks);
    } else {
      tasks = tasks.filter((task) => !task.completed);
    }

    return this.dependencies.taskSyncService.sortByDue(tasks);
  }

  private async loadTodos(): Promise<void> {
    const list = this.containerEl.querySelector('[data-section="todo"] .homepage-todo-list');
    if (!list) return;

    try {
      const allTasks = await this.getCurrentTodoTasks();

      list.empty();
      if (allTasks.length === 0) {
        list.createDiv({ cls: "homepage-empty-text", text: "没有待办事项" });
        return;
      }

      // 渲染当前筛选条件下的全部任务，列表区域负责滚动
      for (const task of allTasks) {
        this.renderTodoItem(list as HTMLElement, task);
      }
    } catch (e) {
      console.error("[Homepage] 加载待办失败:", e);
      list.empty();
      list.createDiv({ cls: "homepage-empty-text", text: "加载失败" });
    }
  }

  private async showAllTodos(): Promise<void> {
    const overlay = this.app.workspace.containerEl.createDiv({ cls: "hp-detail-overlay zendian-homepage" });
    const panel = overlay.createDiv({ cls: "hp-all-panel hp-all-todo-panel" });

    const header = panel.createDiv({ cls: "hp-detail-header" });
    const icon = header.createDiv({ cls: "hp-detail-icon" });
    icon.innerHTML = SVG_ICON.checkSquare;
    const info = header.createDiv({ cls: "hp-detail-header-info" });
    info.createEl("h2", { cls: "hp-detail-title", text: "全部待办" });
    const activeTab = TODO_TABS.find((tab) => tab.key === this.currentTodoTab);
    const meta = info.createDiv({ cls: "hp-detail-meta-text", text: `当前筛选：${activeTab?.label || "全部"}` });
    const closeButton = header.createEl("button", {
      cls: "hp-detail-close",
      text: "×",
      attr: { type: "button", title: "关闭", "aria-label": "关闭全部待办" },
    });
    closeButton.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });

    const body = panel.createDiv({ cls: "hp-all-body hp-all-todo-body homepage-todo-list" });
    const renderTasks = async () => {
      body.empty();
      body.createDiv({ cls: "homepage-empty-text", text: "加载中..." });
      try {
        const tasks = await this.getCurrentTodoTasks();
        if (!overlay.isConnected) return;
        body.empty();
        meta.textContent = `当前筛选：${activeTab?.label || "全部"} · ${tasks.length} 条`;
        if (tasks.length === 0) {
          body.createDiv({ cls: "homepage-empty-text", text: "没有待办事项" });
          return;
        }
        for (const task of tasks) {
          this.renderTodoItem(body, task, renderTasks);
        }
      } catch (error) {
        console.error("[Homepage] 加载全部待办失败:", error);
        body.empty();
        body.createDiv({ cls: "homepage-empty-text", text: "加载失败" });
      }
    };

    await renderTasks();
    setTimeout(() => closeButton.focus(), 50);
  }

  private openTaskCreateModal(): void {
    if (!this.allProjects.length) {
      new Notice("暂无可添加任务的项目");
      return;
    }

    new HomepageTaskCreateModal(this.app, this.allProjects, async (projectPath, text, due, dueTime, priority) => {
      const success = await this.dependencies.taskSyncService.addTask(projectPath, text, {
        created: new Date().toISOString().slice(0, 10),
        due: due || undefined,
        dueTime: dueTime || undefined,
        priority,
      });
      if (!success) {
        new Notice("添加失败，请检查项目主页文件");
        return;
      }
      new Notice("待办已添加");
      await Promise.all([this.loadTodos(), this.loadDailyReviewStats(), this.loadProjects()]);
    }).open();
  }

  /**
   * 渲染单个待办项（新版 - 支持原地勾选）
   */
  private renderTodoItem(parent: HTMLElement, task: Task, onChanged?: () => void): void {
    const item = parent.createDiv({ cls: "homepage-todo-item" });

    // 设置 data 属性用于标识
    item.setAttribute("data-task-project", task.projectPath);
    item.setAttribute("data-task-line", String(task.line));

    const left = item.createDiv({ cls: "homepage-todo-item-left" });

    // 复选框（可点击）
    const checkbox = left.createDiv({
      cls: `homepage-todo-checkbox${task.completed ? " homepage-todo-checkbox--done" : ""}`,
    });
    if (task.completed) {
      checkbox.createDiv({ cls: "homepage-todo-checkmark", text: "✓" });
    }

    // 绑定点击事件 → 原地勾选
    checkbox.addEventListener("click", async (e) => {
      e.stopPropagation();
      await this.toggleTask(task, checkbox, onChanged);
    });

    // 任务文本（点击打开项目主页）
    const textSpan = left.createDiv({
      cls: `homepage-todo-text${task.completed ? " homepage-todo-text--done" : ""}`,
    });
    textSpan.addClass("markdown-preview-view", "markdown-rendered", "zc-inline-markdown");
    void MarkdownRenderer.renderMarkdown(task.text, textSpan, task.projectPath, null as any);
    textSpan.style.cursor = "pointer";
    textSpan.addEventListener("click", (e) => {
      e.stopPropagation();
      const home = findProjectHomeFile(this.app, task.projectPath);
      if (home) void this.app.workspace.getLeaf(false).openFile(home);
    });

    // 右侧：优先级 + 截止日期
    const right = item.createDiv({ cls: "homepage-todo-item-right" });

    // 优先级标签
    if (task.priority) {
      renderTaskPriorityLabel(right, task.priority);
    }

    // 截止日期
    if (task.due) {
      const dueLabel = task.dueTime
        ? `${this.formatDueDate(task.due)} ${task.dueTime}`
        : this.formatDueDate(task.due);
      const dateSpan = right.createSpan({ cls: "homepage-todo-date", text: dueLabel });

      // 逾期标红
      const today = new Date().toISOString().slice(0, 10);
      if (task.due < today) {
        dateSpan.style.color = "var(--text-error)";
        dateSpan.style.fontWeight = "600";
      }
    }
  }

  /**
   * 切换任务完成状态（原地勾选）
   */
  private async toggleTask(task: Task, checkboxEl: HTMLElement, onChanged?: () => void): Promise<void> {
    // 1. 乐观更新 UI（立即反馈）
    const wasCompleted = task.completed;
    checkboxEl.classList.toggle("homepage-todo-checkbox--done");

    if (!wasCompleted) {
      // 添加 ✓ 符号
      checkboxEl.createDiv({ cls: "homepage-todo-checkmark", text: "✓" });
    } else {
      // 移除 ✓ 符号
      const checkmark = checkboxEl.querySelector(".homepage-todo-checkmark");
      if (checkmark) checkmark.remove();
    }

    // 更新任务文本样式
    const item = checkboxEl.closest(".homepage-todo-item");
    if (item) {
      const textEl = item.querySelector(".homepage-todo-text");
      if (textEl) {
        if (!wasCompleted) {
          textEl.addClass("homepage-todo-text--done");
        } else {
          textEl.removeClass("homepage-todo-text--done");
        }
      }
    }

    // 2. 更新项目主页中的结构化任务
    try {
      const success = await this.dependencies.taskSyncService.toggleTask(task.projectPath, task.line, task.raw);

      if (!success) {
        throw new Error("任务切换失败");
      }

      // 3. 记录活动日志
      // 3. 延迟重新加载列表（更新计数和排序）
      setTimeout(() => {
        this.loadTodos();
        onChanged?.();
      }, 300);

    } catch (e) {
      console.error("[Homepage] 切换任务失败:", e);

      // 回滚 UI
      checkboxEl.classList.toggle("homepage-todo-checkbox--done");

      if (wasCompleted) {
        checkboxEl.createDiv({ cls: "homepage-todo-checkmark", text: "✓" });
      } else {
        const checkmark = checkboxEl.querySelector(".homepage-todo-checkmark");
        if (checkmark) checkmark.remove();
      }

      if (item) {
        const textEl = item.querySelector(".homepage-todo-text");
        if (textEl) {
          if (wasCompleted) {
            textEl.addClass("homepage-todo-text--done");
          } else {
            textEl.removeClass("homepage-todo-text--done");
          }
        }
      }

      // 显示错误提示
      new Notice("任务状态更新失败");
    }
  }

  /**
   * 获取项目路径列表
   */
  private async getProjectPaths(categories: ProjectCategory[]): Promise<string[]> {
    const paths: string[] = [];

    for (const category of categories) {
      const typeFolder = getProjectCategoryFolder(category);
      const folder = this.app.vault.getAbstractFileByPath(typeFolder);
      if (folder instanceof TFolder) {
        for (const child of folder.children) {
          if (child instanceof TFolder) {
            // 跳过归档文件夹
            if (child.name.startsWith("99")) continue;
            paths.push(child.path);
          }
        }
      }
    }

    return paths;
  }

  /**
   * 更新待办 Tab 计数（新版 - 使用 Task 类型）
   */
  private updateTodoTabCountsNew(tasks: Task[]): void {
    const allCount = tasks.filter((t) => !t.completed).length;
    const todayCount = this.dependencies.taskSyncService.filterTodayDue(tasks).length;
    const weekCount = this.dependencies.taskSyncService.filterWeekDue(tasks).length;
    const doneCount = tasks.filter((t) => t.completed).length;

    const counts: Record<string, number> = {
      all: allCount,
      today: todayCount,
      week: weekCount,
      done: doneCount,
    };

    const tabs = this.containerEl.querySelectorAll(".homepage-todo-tab");
    tabs.forEach((tab) => {
      const key = tab.getAttribute("data-tab");
      if (key && key in counts) {
        const countEl = tab.querySelector(".homepage-todo-tab-count");
        if (countEl) countEl.textContent = String(counts[key]);
      }
    });
  }

  /**
   * 格式化截止日期
   */
  private formatDueDate(due: string): string {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    if (due === today) return "今天";
    if (due === tomorrow) return "明天";
    if (due < today) return `逾期 ${due.slice(5)}`;

    return due.slice(5); // MM-DD
  }

  // ── 便签 ──────────────────────────────────────────────────

  private getInspirationNotesFolder(): string {
    return this.dependencies.settingsManager.getSettings().homepage.inspirationNotesFolder.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  }

  private getStickyNotes(): HomepageQuickNote[] {
    const folder = this.getInspirationNotesFolder();
    if (!folder) return this.dataService.getQuickNotes();
    const prefix = `${folder}/`;
    return this.app.vault.getMarkdownFiles()
      .filter((file) => file.path.startsWith(prefix))
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .map((file) => ({ id: file.path, label: file.basename, path: file.path, color: "default" }));
  }

  private async hydrateStickyNote(note: HomepageQuickNote): Promise<void> {
    if (note.content !== undefined) return;
    const file = this.app.vault.getAbstractFileByPath(note.path);
    if (file instanceof TFile) note.content = await this.app.vault.cachedRead(file);
  }

  private async loadStickyNotes(): Promise<void> {
    const notes = this.getStickyNotes();
    const container = this.containerEl.querySelector('[data-section="sticky-notes"] .homepage-sticky-grid');
    if (!container) return;

    container.empty();
    const previousButton = this.containerEl.querySelector('[data-section="sticky-notes"] [data-sticky-previous]') as HTMLButtonElement | null;
    const nextButton = this.containerEl.querySelector('[data-section="sticky-notes"] [data-sticky-next]') as HTMLButtonElement | null;
    const counter = this.containerEl.querySelector('[data-section="sticky-notes"] [data-sticky-counter]');

    if (notes.length === 0) {
      const empty = container.createDiv({ cls: "homepage-sticky-empty" });
      empty.createDiv({ cls: "homepage-empty-text", text: "暂无灵感速记" });
      empty.createDiv({ cls: "homepage-empty-hint", text: "点击右上角「+」记录第一条灵感" });
      if (counter) counter.textContent = "0 / 0";
      if (previousButton) previousButton.disabled = true;
      if (nextButton) nextButton.disabled = true;
      return;
    }

    this.currentStickyIndex = Math.min(Math.max(this.currentStickyIndex, 0), notes.length - 1);
    await this.hydrateStickyNote(notes[this.currentStickyIndex]);
    this.renderStickyNote(container as HTMLElement, notes[this.currentStickyIndex]);
    if (counter) counter.textContent = `${this.currentStickyIndex + 1} / ${notes.length}`;
    const navigationDisabled = notes.length <= 1;
    if (previousButton) previousButton.disabled = navigationDisabled;
    if (nextButton) nextButton.disabled = navigationDisabled;
  }

  private cycleStickyNote(direction: -1 | 1): void {
    const notes = this.getStickyNotes();
    if (notes.length <= 1) return;
    this.currentStickyIndex = (this.currentStickyIndex + direction + notes.length) % notes.length;
    void this.loadStickyNotes();
  }

  private renderStickyNote(
    parent: HTMLElement,
    note: HomepageQuickNote,
    onChanged?: () => void,
  ): void {
    const noteEl = parent.createDiv({
      cls: "homepage-sticky-note homepage-sticky-note--plain",
    });

    noteEl.createDiv({ cls: "homepage-sticky-label", text: note.label || "无标题" });
    const noteText = noteEl.createDiv({
      cls: `homepage-sticky-text zc-inline-markdown markdown-preview-view markdown-rendered${note.content ? "" : " is-placeholder"}`,
    });
    if (note.content) {
      void MarkdownRenderer.renderMarkdown(note.content, noteText, note.path || "", null as any);
    } else {
      noteText.textContent = "双击添加速记内容…";
    }

    let clickTimer: number | null = null;
    noteEl.addEventListener("dblclick", (event) => {
      if ((event.target as HTMLElement).closest(".homepage-sticky-delete")) return;
      if (clickTimer !== null) window.clearTimeout(clickTimer);
      if (note.path) void this.openFile(note.path);
    });

    noteEl.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest(".homepage-sticky-delete")) return;
      if (clickTimer !== null) window.clearTimeout(clickTimer);
      clickTimer = window.setTimeout(() => {
        clickTimer = null;
        this.beginStickyInlineEdit(note, noteEl, onChanged);
      }, 220);
    });

    const deleteButton = noteEl.createEl("button", {
      cls: "homepage-sticky-delete",
      text: "×",
      attr: { type: "button", title: "删除便签", "aria-label": `删除便签 ${note.label || "无标题"}` },
    });
    deleteButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      const folder = this.getInspirationNotesFolder();
      if (folder) {
        const file = this.app.vault.getAbstractFileByPath(note.path);
        if (file instanceof TFile) await this.app.vault.delete(file);
      } else {
        await this.dataService.deleteQuickNote(note.id);
      }
      void this.loadStickyNotes();
      onChanged?.();
    });
  }

  private beginStickyInlineEdit(note: HomepageQuickNote, noteEl: HTMLElement, onChanged?: () => void): void {
    if (noteEl.querySelector(".homepage-sticky-editor")) return;
    const textEl = noteEl.querySelector(".homepage-sticky-text") as HTMLElement | null;
    if (!textEl) return;
    const editor = document.createElement("textarea");
    editor.className = "homepage-sticky-editor";
    editor.value = note.content || "";
    editor.placeholder = "记录此刻的想法…";
    textEl.replaceWith(editor);
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);

    let finished = false;
    const finish = async (save: boolean): Promise<void> => {
      if (finished) return;
      finished = true;
      if (save && editor.value !== (note.content || "")) {
        note.content = editor.value;
        const file = this.app.vault.getAbstractFileByPath(note.path);
        if (file instanceof TFile) await this.app.vault.modify(file, editor.value);
        else await this.app.vault.create(note.path, editor.value);
        onChanged?.();
      }
      const replacement = noteEl.createDiv({
        cls: `homepage-sticky-text zc-inline-markdown markdown-preview-view markdown-rendered${note.content ? "" : " is-placeholder"}`,
      });
      if (note.content) {
        void MarkdownRenderer.renderMarkdown(note.content, replacement, note.path || "", null as any);
      } else {
        replacement.textContent = "双击添加速记内容…";
      }
      editor.replaceWith(replacement);
    };
    editor.addEventListener("blur", () => { void finish(true); });
    editor.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); void finish(false); }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void finish(true); }
    });
  }

  private showAllStickyNotes(): void {
    const overlay = this.app.workspace.containerEl.createDiv({ cls: "hp-detail-overlay zendian-homepage" });
    const panel = overlay.createDiv({ cls: "hp-all-panel hp-all-sticky-panel" });
    const header = panel.createDiv({ cls: "hp-detail-header" });
    const icon = header.createDiv({ cls: "hp-detail-icon" });
    icon.innerHTML = SVG_ICON.stickyNote;
    const info = header.createDiv({ cls: "hp-detail-header-info" });
    info.createEl("h2", { cls: "hp-detail-title", text: "全部灵感速记" });
    const meta = info.createDiv({ cls: "hp-detail-meta-text" });
    const closeButton = header.createEl("button", {
      cls: "hp-detail-close",
      text: "×",
      attr: { type: "button", title: "关闭", "aria-label": "关闭全部便签" },
    });
    closeButton.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });

    const body = panel.createDiv({ cls: "hp-all-body hp-all-sticky-body homepage-sticky-grid" });
    const renderNotes = async () => {
      const notes = this.getStickyNotes();
      body.empty();
      meta.textContent = `${notes.length} 条速记`;
      if (notes.length === 0) {
        body.createDiv({ cls: "homepage-empty-text", text: "暂无灵感速记" });
        return;
      }
      for (const note of notes) {
        await this.hydrateStickyNote(note);
        this.renderStickyNote(body, note, () => { void renderNotes(); });
      }
    };

    void renderNotes();
    setTimeout(() => closeButton.focus(), 50);
  }

  private openQuickNoteModal(existing?: HomepageQuickNote): void {
    new QuickNoteModal(this.app, async (data) => {
      const existingFile = this.app.vault.getAbstractFileByPath(data.path);
      if (existingFile instanceof TFolder) {
        throw new Error("目标位置存在同名文件夹");
      }
      let content = data.content || "";
      if (existingFile instanceof TFile) {
        content = await this.app.vault.read(existingFile);
      } else {
        await this.app.vault.create(data.path, content);
      }
      const fixedFolder = this.getInspirationNotesFolder();
      if (existing && !fixedFolder) {
        await this.dataService.updateQuickNote(existing.id, { ...data, content });
      } else if (!existing && !fixedFolder) {
        await this.dataService.addQuickNote(data.label, data.path, data.color, content);
        this.currentStickyIndex = Math.max(0, this.dataService.getQuickNotes().length - 1);
      }
      if (fixedFolder) this.currentStickyIndex = 0;
      void this.loadStickyNotes();
    }, existing, this.getInspirationNotesFolder()).open();
  }

  // ── 每日回顾统计 ──────────────────────────────────────────

  private async loadDailyReviewStats(): Promise<void> {
    // 获取今日真实活动数据
    const todayActivity = this.activityLogService.getTodayActivity();
    const monthlyStats = this.activityLogService.getMonthlyStats();

    // 待办统计
    let taskTotal = 0;
    let taskDone = 0;
    try {
      const settings = this.dependencies.settingsManager.getSettings();
      const projectPaths = await this.getProjectPaths(settings.homepage.projectCategories);
      const tasks = await this.dependencies.taskSyncService.getAllTasks(projectPaths);
      taskTotal = tasks.length;
      taskDone = tasks.filter((task) => task.completed).length;
    } catch {
      // 如果获取失败，使用活动日志中的任务完成数
      taskDone = todayActivity.taskCompleted;
    }

    const remaining = Math.max(0, taskTotal - taskDone);

    // 更新检查列表数值
    const updates: Record<string, string> = {
      notes: `记录了 ${todayActivity.created} 条笔记`,
      tasks: `完成了 ${taskDone} 项待办`,
      reading: `编辑了 ${todayActivity.edited} 个文件`,
      remaining: remaining > 0 ? `剩余 ${remaining} 项待办` : `太棒了，待办全部完成！`,
    };

    for (const [key, value] of Object.entries(updates)) {
      const el = this.containerEl.querySelector(`[data-review-value="${key}"]`);
      if (el) el.textContent = value;
    }

    // 根据数据更新状态图标
    const statusMap: Record<string, boolean> = {
      notes: todayActivity.created > 0,
      tasks: taskDone > 0,
      reading: todayActivity.edited > 0,
      remaining: remaining === 0,
    };

    for (const [key, hasData] of Object.entries(statusMap)) {
      const row = this.containerEl.querySelector(`[data-review="${key}"]`);
      if (!row) continue;
      const statusEl = row.querySelector(".homepage-review-item-status") as HTMLElement | null;
      if (!statusEl) continue;
      if (hasData) {
        statusEl.innerHTML = SVG_ICON.checkCircle;
        statusEl.addClass("is-done");
        statusEl.removeClass("is-empty");
      } else {
        statusEl.innerHTML = SVG_ICON.circle;
        statusEl.addClass("is-empty");
        statusEl.removeClass("is-done");
      }
    }

    // ── 今日元气值 ──
    // 基于当日真实活动综合打分 (0-100)
    let energyScore = 0;
    energyScore += Math.min(todayActivity.created * 20, 40);        // 创建笔记：每条 20 分，上限 40
    energyScore += Math.min(taskDone * 10, 30);                     // 完成待办：每项 10 分，上限 30
    energyScore += Math.min(todayActivity.edited * 2, 20);          // 编辑文件：每次 2 分，上限 20
    energyScore += Math.min(monthlyStats.consecutiveDays * 2, 10);  // 连续活跃：每天 2 分，上限 10
    energyScore = Math.min(energyScore, 100);

    // 更新环形进度
    const ringValueEl = this.containerEl.querySelector(".homepage-review-ring-value");
    if (ringValueEl) ringValueEl.textContent = `${energyScore}`;

    const ringFill = this.containerEl.querySelector(".homepage-review-ring-fill") as SVGCircleElement | null;
    if (ringFill) {
      const circumference = 2 * Math.PI * 45; // r=45
      ringFill.setAttribute("stroke-dasharray", `${circumference}`);
      ringFill.setAttribute("stroke-dashoffset", `${circumference * (1 - energyScore / 100)}`);
    }
  }

  // ══════════════════════════════════════════════════════════
  // 动画
  // ══════════════════════════════════════════════════════════

  private initAnimations(): void {
    const sections = this.containerEl.querySelectorAll(".homepage-card");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.addClass("homepage-animate-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    sections.forEach((section, i) => {
      (section as HTMLElement).style.animationDelay = `${i * 0.08}s`;
      observer.observe(section);
    });

    this.animateStatNumbers();
  }

  private animateStatNumbers(): void {
    const statValues = this.containerEl.querySelectorAll(".homepage-metric-value");

    statValues.forEach((el) => {
      const text = el.textContent || "0";
      const match = text.match(/(\d+)/);
      if (!match) return;
      const target = parseInt(match[1], 10);
      if (isNaN(target) || target === 0) return;

      const suffix = text.replace(match[1], "");
      let current = 0;
      const duration = 800;
      const steps = 25;
      const increment = target / steps;
      const stepTime = duration / steps;

      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          current = target;
          clearInterval(timer);
        }
        el.textContent = `${Math.round(current)}${suffix}`;
      }, stepTime);
    });
  }

  // ══════════════════════════════════════════════════════════
  // 工具方法
  // ══════════════════════════════════════════════════════════

  private async openFile(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
    }
  }

  /** 根据文件路径和任务文本推断标签类型 */
  private inferTaskTag(filePath: string, text: string): { label: string; type: string } {
    const pathLower = filePath.toLowerCase();
    const textLower = text.toLowerCase();

    // 工作相关
    if (pathLower.includes("工作") || pathLower.includes("work") || pathLower.includes("项目") ||
        textLower.includes("会议") || textLower.includes("报告") || textLower.includes("需求")) {
      return { label: "工作", type: "work" };
    }
    // 学习相关
    if (pathLower.includes("学习") || pathLower.includes("study") || pathLower.includes("笔记") ||
        pathLower.includes("课程") || textLower.includes("学习") || textLower.includes("阅读")) {
      return { label: "学习", type: "study" };
    }
    // 生活相关
    if (pathLower.includes("生活") || pathLower.includes("life") || pathLower.includes("日常") ||
        textLower.includes("购物") || textLower.includes("健身") || textLower.includes("旅行")) {
      return { label: "生活", type: "life" };
    }
    // 默认
    return { label: "待办", type: "default" };
  }

  /** 格式化待办日期：今天/明天/具体日期 */
  private formatTodoDate(ts: number): string {
    const now = new Date();
    const date = new Date(ts);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const tomorrowStart = todayStart + 86_400_000;
    const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

    if (targetDay === todayStart) return "今天";
    if (targetDay === tomorrowStart) return "明天";

    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${m}-${d}`;
  }

  private formatTimestamp(ts: number): string {
    const now = new Date();
    const diffMs = now.getTime() - ts;
    const diffDays = Math.floor(diffMs / 86_400_000);

    if (diffDays === 0) {
      const d = new Date(ts);
      return `今天 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    if (diffDays === 1) return "昨天";
    if (diffDays < 7) return `${diffDays} 天前`;

    const d = new Date(ts);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  }

  // ── 实时时钟 ──────────────────────────────────────────────

  private startClock(): void {
    this.updateClock();
    this.clockTimer = window.setInterval(() => this.updateClock(), 60_000);
  }

  private stopClock(): void {
    if (this.clockTimer !== null) {
      window.clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
  }

  private updateClock(): void {
    const now = new Date();
    const settings = this.dependencies.settingsManager.getSettings();
    const userName = settings?.homepage?.userName;

    // 问候语
    let greeting = "你好";
    if (userName) greeting += `，${userName}`;
    const greetingTextEl = this.containerEl.querySelector(".homepage-header-greeting-text");
    if (greetingTextEl) greetingTextEl.textContent = greeting;

    // 日期
    const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    const dateStr = `今天是 ${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日，${weekdays[now.getDay()]}`;
    const dateEl = this.containerEl.querySelector(".homepage-header-date");
    if (dateEl) dateEl.textContent = dateStr;
  }
}
