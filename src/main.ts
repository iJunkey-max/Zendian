/**
 * ZENdian Plugin — 极简入口
 *
 * 只负责：
 * 1. 初始化核心服务（SettingsManager, EventBus, ModuleManager）
 * 2. 注册功能模块
 * 3. 注册设置面板
 */

import { Notice, Plugin, TFile } from "obsidian";
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
import { GraphModule } from "./modules/graph.module";

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
import { destroyServiceManager, getServiceManager } from "./homepage/services";
import { ProjectReconciler } from "./homepage/services/ProjectReconciler";
import { ProjectMaintenanceModal } from "./homepage/ProjectMaintenanceModal";
import { RegisterProjectModal } from "./homepage/RegisterProjectModal";
import { ProjectImportModal } from "./homepage/ProjectImportModal";
import { TaskFileLinkService } from "./homepage/services/TaskFileLinkService";

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
  private lastProjectReconcileNoticeAt = 0;

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
    // Start the shared project services during plugin startup, not only when
    // a project console happens to be opened.  Offline edits made while
    // Obsidian was closed must be reconciled into snapshots even if the first
    // page the user visits is the main homepage or settings.
    await getServiceManager(this.app, this.taskSyncService).initialize();

    const reconciler = new ProjectReconciler(this.app, (oldPath, newPath) => {
      return getServiceManager(this.app, this.taskSyncService).rebaseProjectPath(oldPath, newPath);
    }, () => !this.unloading, (projectPath) => {
      getServiceManager(this.app, this.taskSyncService).untrackProjectSnapshots(projectPath);
    });
    const reconcile = (deepScan = false) => {
      if (this.unloading) return;
      void reconciler.reconcile(deepScan).catch(error => {
        console.error("[ZENdian] 项目位置核对失败", error);
        const now = Date.now();
        // Background scans run on a timer and on every vault mutation. Keep a
        // conflict or external-write warning visible without spamming notices.
        if (now - this.lastProjectReconcileNoticeAt < 15000 || this.unloading) return;
        this.lastProjectReconcileNoticeAt = now;
        new Notice(`项目位置核对已暂停：${String(error)}。原数据未覆盖，请处理同步冲突后手动重新扫描。`, 12000);
      });
    };
    this.addCommand({
      id: "check-project-identities",
      name: "项目检查与关联",
      callback: () => new ProjectMaintenanceModal(this.app, () => reconciler.reconcile(true)).open(),
    });
    this.addCommand({
      id: "register-project-folder",
      name: "将现有文件夹设为项目",
      callback: () => new RegisterProjectModal(this.app, () => reconciler.reconcile(true)).open(),
    });
    this.addCommand({ id: "import-project-package", name: "导入项目迁移包", callback: () => new ProjectImportModal(this.app, () => reconciler.reconcile(true)).open() });
    this.app.workspace.onLayoutReady(() => {
      if (this.unloading) return;
      reconcile();
      this.registerInterval(window.setInterval(() => reconcile(), 30000));
      this.registerEvent(this.app.vault.on("rename", () => reconcile()));
      const taskLinks = new TaskFileLinkService(this.app, () => !this.unloading);
      this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
        if (!this.unloading) void taskLinks.rename(oldPath, file.path).catch(error => console.error("[ZENdian] 任务文件关联更新失败", error));
      }));
      this.registerEvent(this.app.vault.on("create", () => reconcile()));
      this.registerEvent(this.app.vault.on("delete", () => reconcile()));
      // A .home edit can introduce a duplicate identity, invalidate the
      // project schema, or turn a ready project into a conflict without any
      // create/rename/delete event. Reconcile that marker change as well so a
      // stale watcher is stopped immediately.
      this.registerEvent(this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && file.extension === "home") reconcile();
      }));
    });

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
    this.moduleManager.register(new GraphModule());

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
        statisticsService: getServiceManager(this.app, this.taskSyncService).statistics,
        reconcileProjects: () => reconciler.reconcile(true),
      })
    );

    // 注册项目控制台 View（.home 文件）
    this.registerView(
      VIEW_TYPE_PROJECT_CONSOLE,
      (leaf) => new ProjectConsoleView(leaf, this.taskSyncService, this.settingsManager, this.events, this.activityLogService)
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
      destroyServiceManager(this.app),
    ]).catch((error) => console.error("[ZENdian] 卸载前保存失败", error));
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
