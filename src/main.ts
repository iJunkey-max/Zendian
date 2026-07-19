/**
 * ZENdian Plugin — 极简入口
 *
 * 只负责：
 * 1. 初始化核心服务（SettingsManager, EventBus, ModuleManager）
 * 2. 注册功能模块
 * 3. 注册设置面板
 */

import { Plugin, TFile } from "obsidian";
import { EventBus, Events } from "./core/event-bus";
import { SettingsManager } from "./core/settings-manager";
import { ModuleManager } from "./core/module-manager";

// 新数据服务
import { ActivityLogService } from "./services/ActivityLogService";
import { ProjectMetadataService } from "./services/ProjectMetadataService";
import { TaskSyncService } from "./services/TaskSyncService";
import { FocusClockController } from "./focus-clock/FocusClockController";

// 功能模块导入
import { AutoHideModule } from "./modules/auto-hide.module";
import { CardLayoutModule } from "./modules/card-layout.module";
import { CanvasModule } from "./modules/canvas.module";
import { ScrollbarModule } from "./modules/scrollbar.module";
import { OutlineModule } from "./modules/outline.module";
import { CheckboxModule } from "./modules/checkbox.module";
import { ImageModule } from "./modules/image.module";
import { BlockquoteModule } from "./modules/blockquote.module";
import { EditorEnhanceModule } from "./modules/editor-enhance.module";
import { TypographyModule } from "./modules/typography.module";
import { CodeBlockModule } from "./modules/code-block.module";
import { CalloutModule } from "./modules/callout.module";
import { ListTableModule } from "./modules/list-table.module";
import { LinkModule } from "./modules/link.module";
import { EmbedModule } from "./modules/embed.module";
import { MobileModule } from "./modules/mobile.module";
import { UIDetailModule } from "./modules/ui-detail.module";
import { FileTreeModule } from "./modules/file-tree.module";
import { HeadingsModule } from "./modules/headings.module";
import { FolderCardsModule } from "./modules/rainbow-folder.module";
import { NewTabModule } from "./modules/new-tab.module";
import { IconSystemModule } from "./modules/icon-system.module";
import { BannerModule } from "./modules/banner.module";

// Homepage
import {
  HomepageTaskCreatePopoutView,
  HomepageView,
  ProjectCreatePopoutView,
  VIEW_TYPE_HOMEPAGE,
  VIEW_TYPE_HOMEPAGE_TASK_CREATE,
  VIEW_TYPE_PROJECT_CREATE,
} from "./homepage/HomepageView";
import {
  ProjectConsoleView,
  ProjectTaskCreatePopoutView,
  VIEW_TYPE_PROJECT_CONSOLE,
  VIEW_TYPE_PROJECT_TASK_CREATE,
} from "./homepage/ProjectConsoleView";
import { destroyServiceManager } from "./homepage/services";

// UI
import { ZENdianSettingTab } from "./ui/settings-tab";
import { PopoutFormView, VIEW_TYPE_ZENDIAN_FORM_POPOUT } from "./ui/popout-form";

export default class ZENdianPlugin extends Plugin {
  private events!: EventBus;
  private settingsManager!: SettingsManager;
  private moduleManager!: ModuleManager;

  // 新数据服务
  public activityLogService!: ActivityLogService;
  public projectMetadataService!: ProjectMetadataService;
  public taskSyncService!: TaskSyncService;
  private focusClock?: FocusClockController;
  private unloading = false;

  async onload() {
    this.unloading = false;
    // 1. 初始化核心服务
    this.events = new EventBus();
    this.settingsManager = new SettingsManager(this, this.events);
    await this.settingsManager.init();

    this.moduleManager = new ModuleManager(
      this.events,
      () => this.settingsManager.getSettings(),
      this.registerEditorExtension.bind(this),
      this.app,
      this.settingsManager
    );

    // 1.1 初始化数据服务
    this.activityLogService = new ActivityLogService(this.app, this.events);
    this.projectMetadataService = new ProjectMetadataService(this.app);
    this.taskSyncService = new TaskSyncService(this.app, this.activityLogService);
    await this.activityLogService.load();

    const focusClockStatus = this.addStatusBarItem();
    this.focusClock = new FocusClockController(
      this.app,
      focusClockStatus,
      this.settingsManager,
      this.events,
      this.activityLogService,
    );
    this.app.workspace.onLayoutReady(() => {
      if (!this.unloading) this.focusClock?.load();
    });

    // 2. 注册功能模块
    this.moduleManager.register(new AutoHideModule());
    this.moduleManager.register(new CardLayoutModule());
    this.moduleManager.register(new CanvasModule());
    this.moduleManager.register(new ScrollbarModule());
    this.moduleManager.register(new OutlineModule());
    this.moduleManager.register(new CheckboxModule());
    this.moduleManager.register(new ImageModule());
    this.moduleManager.register(new BlockquoteModule());
    this.moduleManager.register(new EditorEnhanceModule());
    this.moduleManager.register(new TypographyModule());
    this.moduleManager.register(new CodeBlockModule());
    this.moduleManager.register(new CalloutModule());
    this.moduleManager.register(new ListTableModule());
    this.moduleManager.register(new LinkModule());
    this.moduleManager.register(new EmbedModule());
    this.moduleManager.register(new MobileModule());
    this.moduleManager.register(new UIDetailModule());
    this.moduleManager.register(new FileTreeModule());
    this.moduleManager.register(new HeadingsModule());
    this.moduleManager.register(new FolderCardsModule());
    this.moduleManager.register(new NewTabModule());
    this.moduleManager.register(new IconSystemModule());
    this.moduleManager.register(new BannerModule());

    // 3. 加载所有模块
    await this.moduleManager.loadAll();

    // 4. 注册主页 View
    this.registerView(
      VIEW_TYPE_HOMEPAGE,
      (leaf) => new HomepageView(leaf, {
        settingsManager: this.settingsManager,
        events: this.events,
        activityLogService: this.activityLogService,
        taskSyncService: this.taskSyncService,
      })
    );

    // 注册项目控制台 View（.home 文件）
    this.registerView(
      VIEW_TYPE_PROJECT_CONSOLE,
      (leaf) => new ProjectConsoleView(leaf, this.taskSyncService, this.settingsManager)
    );
    this.registerExtensions(["home"], VIEW_TYPE_PROJECT_CONSOLE);

    this.registerView(
      VIEW_TYPE_PROJECT_CREATE,
      (leaf) => new ProjectCreatePopoutView(leaf, this.settingsManager)
    );

    this.registerView(
      VIEW_TYPE_HOMEPAGE_TASK_CREATE,
      (leaf) => new HomepageTaskCreatePopoutView(leaf, this.settingsManager, this.taskSyncService)
    );

    this.registerView(
      VIEW_TYPE_PROJECT_TASK_CREATE,
      (leaf) => new ProjectTaskCreatePopoutView(leaf, this.taskSyncService)
    );

    this.registerView(
      VIEW_TYPE_ZENDIAN_FORM_POPOUT,
      (leaf) => new PopoutFormView(leaf)
    );

    // 监听空标签页，替换为主页
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        const settings = this.settingsManager.getSettings();
        if (!settings.homepage.enabled) return;

        const emptyLeaves = this.app.workspace.getLeavesOfType("empty");
        for (const leaf of emptyLeaves) {
          leaf.setViewState({ type: VIEW_TYPE_HOMEPAGE, active: true });
        }
      })
    );

    // 侧边栏图标：打开主页
    this.addRibbonIcon("layout-dashboard", "打开主页", () => {
      this.activateHomepage();
    });

    // 命令面板：打开主页
    this.addCommand({
      id: "open-homepage",
      name: "打开主页",
      callback: () => this.activateHomepage(),
    });

    this.addCommand({
      id: "open-focus-clock",
      name: "打开专注时钟",
      callback: () => this.focusClock?.openPanel(),
    });

    this.addCommand({
      id: "toggle-focus-clock-pause",
      name: "暂停或继续专注时钟",
      callback: () => this.focusClock?.togglePause(),
    });

    // 5. 监听主题变更
    this.registerEvent(
      this.app.workspace.on("css-change", () => {
        const isDark = document.body.classList.contains("theme-dark");
        this.events.emit(Events.THEME_CHANGED, isDark);
      })
    );

    // 6. Vault 初始化期间会为已有文件触发 create；布局就绪后再开始记录。
    this.app.workspace.onLayoutReady(() => {
      if (this.unloading) return;
      this.registerEvent(
        this.app.vault.on("create", (file) => {
          if (file instanceof TFile && file.extension === "md") {
            this.activityLogService.logActivity("note_created", file.path);
          }
        })
      );
      this.registerEvent(
        this.app.vault.on("modify", (file) => {
          if (file instanceof TFile && file.extension === "md") {
            this.activityLogService.logActivity("note_edited", file.path);
          }
        })
      );
    });

    // 7. 注册设置面板
    this.addSettingTab(
      new ZENdianSettingTab(this.app, this, this.settingsManager, this.moduleManager)
    );
  }

  onunload() {
    this.unloading = true;
    this.focusClock?.unload();
    // 在卸载清理期间立即启动所有待处理写入。
    void Promise.all([
      this.settingsManager?.flush(),
      this.activityLogService?.flush(),
    ]).catch((error) => console.error("[ZENdian] 卸载前保存失败", error));
    destroyServiceManager();
    this.moduleManager?.unloadAll();
    this.events?.clear();
  }

  /**
   * 激活主页视图
   * 如果已打开则聚焦，否则在主区域新建一个 tab
   */
  private activateHomepage(): void {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_HOMEPAGE);
    if (existing.length > 0) {
      workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = workspace.getLeaf(true);
    leaf.setViewState({ type: VIEW_TYPE_HOMEPAGE, active: true });
    workspace.revealLeaf(leaf);
  }
}
