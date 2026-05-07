/**
 * ZENdian Plugin — 极简入口
 *
 * 只负责：
 * 1. 初始化核心服务（SettingsManager, EventBus, ModuleManager）
 * 2. 注册功能模块
 * 3. 注册设置面板
 */

import { Plugin } from "obsidian";
import { EventBus, Events } from "./core/event-bus";
import { SettingsManager } from "./core/settings-manager";
import { ModuleManager } from "./core/module-manager";

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
import { PluginCompatModule } from "./modules/plugin-compat.module";
import { UIDetailModule } from "./modules/ui-detail.module";
import { FileTreeModule } from "./modules/file-tree.module";
import { HeadingsModule } from "./modules/headings.module";
import { RainbowFolderModule } from "./modules/rainbow-folder.module";
import { NewTabModule } from "./modules/new-tab.module";

// UI
import { ZENdianSettingTab } from "./ui/settings-tab";

export default class ZENdianPlugin extends Plugin {
  private events!: EventBus;
  private settingsManager!: SettingsManager;
  private moduleManager!: ModuleManager;

  async onload() {
    // 1. 初始化核心服务
    this.events = new EventBus();
    this.settingsManager = new SettingsManager(this, this.events);
    await this.settingsManager.init();

    this.moduleManager = new ModuleManager(
      this.events,
      () => this.settingsManager.getSettings(),
      this.registerEditorExtension.bind(this)
    );

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
    this.moduleManager.register(new PluginCompatModule());
    this.moduleManager.register(new UIDetailModule());
    this.moduleManager.register(new FileTreeModule());
    this.moduleManager.register(new HeadingsModule());
    this.moduleManager.register(new RainbowFolderModule());
    this.moduleManager.register(new NewTabModule());

    // 3. 加载所有模块
    await this.moduleManager.loadAll();

    // 4. 监听主题变更
    this.registerEvent(
      this.app.workspace.on("css-change", () => {
        const isDark = document.body.classList.contains("theme-dark");
        this.events.emit(Events.THEME_CHANGED, isDark);
      })
    );

    // 5. 注册设置面板
    this.addSettingTab(
      new ZENdianSettingTab(this.app, this, this.settingsManager, this.moduleManager)
    );
  }

  onunload() {
    this.moduleManager?.unloadAll();
    this.events?.clear();
  }
}
