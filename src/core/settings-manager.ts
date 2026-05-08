/**
 * 设置管理器
 * 负责设置的存储、持久化、变更通知
 *
 * 职责：
 * 1. 从 Obsidian loadData() 加载设置并迁移旧格式
 * 2. 提供类型安全的 get/set API
 * 3. 设置变更时通过 EventBus 通知模块
 * 4. 自动保存到 Obsidian 数据文件
 */

import { Plugin } from "obsidian";
import { EventBus, Events } from "./event-bus";
import { DEFAULT_SETTINGS } from "../types/settings.types";
import type { PluginSettings } from "../types/settings.types";

export class SettingsManager {
  private settings: PluginSettings;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private plugin: Plugin,
    private events: EventBus
  ) {
    this.settings = structuredClone(DEFAULT_SETTINGS);
  }

  /** 初始化：加载并迁移设置 */
  async init(): Promise<void> {
    const saved = await this.plugin.loadData();
    if (saved) {
      this.settings = this.migrate(saved);
    }
  }

  /** 获取完整设置对象（只读引用） */
  getSettings(): PluginSettings {
    return this.settings;
  }

  /** 获取指定路径的设置值 */
  get<K extends keyof PluginSettings>(key: K): PluginSettings[K] {
    return this.settings[key];
  }

  /** 更新设置（支持部分更新） */
  async update<K extends keyof PluginSettings>(
    key: K,
    value: Partial<PluginSettings[K]>
  ): Promise<void> {
    const current = this.settings[key];
    this.settings[key] = { ...current, ...value } as PluginSettings[K];
    await this.save();
    this.events.emit(Events.SETTINGS_CHANGED, [key as string], this.settings);
  }

  /** 批量更新多个模块的设置 */
  async updateMultiple(updates: Partial<PluginSettings>): Promise<void> {
    const changedKeys: string[] = [];
    for (const [key, value] of Object.entries(updates)) {
      const k = key as keyof PluginSettings;
      if (k in this.settings) {
        this.settings[k] = { ...this.settings[k], ...value } as any;
        changedKeys.push(key);
      }
    }
    await this.save();
    this.events.emit(Events.SETTINGS_CHANGED, changedKeys, this.settings);
  }

  /** 延迟保存（防抖，200ms） */
  private async save(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(async () => {
      await this.plugin.saveData(this.settings);
      this.saveTimeout = null;
    }, 200);
  }

  /**
   * 迁移旧格式设置到新格式
   * 旧格式使用 "groupId@@settingId" 作为 key
   * 新格式使用结构化对象
   */
  private migrate(oldData: Record<string, any>): PluginSettings {
    const settings = structuredClone(DEFAULT_SETTINGS);

    // 如果已经是新格式，直接返回
    if (oldData.autoHide && typeof oldData.autoHide === "object") {
      return oldData as PluginSettings;
    }

    // 旧格式迁移映射
    const migrations: Array<[string, (val: any) => void]> = [
      // Auto Hide
      ["Components@@tab-autohide", (v) => (settings.autoHide.tab = !!v)],
      ["Components@@status-bar-autohide", (v) => (settings.autoHide.statusBar = !!v)],
      ["Components@@Ribbon-autohide", (v) => (settings.autoHide.ribbon = !!v)],
      ["Components@@nav-header-autohide", (v) => (settings.autoHide.navHeader = !!v)],
      ["Components@@tab-title-bar-autohide", (v) => (settings.autoHide.tabBar = !!v)],
      ["Components@@vault-profile-autohide", (v) => (settings.autoHide.vaultProfile = !!v)],

      // Card Layout
      ["Components@@card-layout-open", (v) => (settings.cardLayout.enabled = !!v)],
      ["Components@@canvas-card-border-width", (v) => (settings.cardLayout.canvasBorder = v || "2px solid")],
      ["Components@@canvas-card-menu", (v) => (settings.cardLayout.canvasMenu = v || "center")],
      ["Components@@media-embed-card-border-off", (v) => (settings.cardLayout.mediaEmbedBorderOff = !!v)],

      // Editor Enhance
      ["Editor@@border-focus-mode", (v) => (settings.editorEnhance.focusMode = !!v)],
      ["Editor@@line-normal-opacity", (v) => (settings.editorEnhance.focusModeOpacity = v ?? 0.5)],
      ["Editor@@line-hover-indicator", (v) => (settings.editorEnhance.hoverIndicator = !!v)],
      ["Editor@@focus-indicator-list-level", (v) => (settings.editorEnhance.hoverIndicatorListLevel = !!v)],
      ["Editor@@focus-indicator-codeblock-line-number", (v) => (settings.editorEnhance.hoverIndicatorCodeblockLineNumber = !!v)],
      ["Editor@@editor-grid-background-pattren", (v) => (settings.editorEnhance.gridBackground = !!v)],
      ["Editor@@grid-background-pattern-size", (v) => (settings.editorEnhance.gridBackgroundSize = v || "36px")],

      // Typography
      ["Editor@@file-line-width", (v) => (settings.typography.fileLineWidth = v ?? 900)],
      ["Editor@@letter-spacing", (v) => (settings.typography.letterSpacing = v ?? 1)],
      ["Editor@@line-height-customize", (v) => (settings.typography.lineHeight = v ?? 2.2)],
      ["Editor@@code-line-height", (v) => (settings.typography.codeLineHeight = v ?? 1.6)],
      ["Editor@@blockquote-line-height", (v) => (settings.typography.blockquoteLineHeight = v ?? 1.6)],
      ["Editor@@table-line-height", (v) => (settings.typography.tableLineHeight = v ?? 1.8)],
      ["Editor@@p-spacing", (v) => (settings.typography.paragraphSpacing = v || "1em")],
      ["Editor@@p-spacing-br", (v) => (settings.typography.paragraphSpacingBr = !!v)],
      ["Editor@@text-align-justify", (v) => (settings.typography.textAlignJustify = !!v)],

      // Code Block
      ["Editor@@codeblock-style-select", (v) => (settings.codeBlock.theme = v || "customize")],
      ["Editor@@code-background-light", (v) => (settings.codeBlock.backgroundLight = v || "")],
      ["Editor@@code-background-dark", (v) => (settings.codeBlock.backgroundDark = v || "")],
      ["Editor@@code-border-light", (v) => (settings.codeBlock.borderLight = v || "")],
      ["Editor@@code-border-dark", (v) => (settings.codeBlock.borderDark = v || "")],

      // Blockquote
      ["Editor@@blockquote-background-light", (v) => (settings.blockquote.backgroundLight = v || "")],
      ["Editor@@blockquote-background-dark", (v) => (settings.blockquote.backgroundDark = v || "")],

      // Callout
      ["Editor@@callout-style-select", (v) => (settings.callout.style = v || "customize")],
      ["Editor@@callout-border-width", (v) => (settings.callout.borderWidth = v || "0px")],
      ["Editor@@callout-border-opacity", (v) => (settings.callout.borderOpacity = v ?? 0.25)],
      ["Editor@@callout-padding", (v) => (settings.callout.padding = v || "")],
      ["Editor@@callout-title-padding", (v) => (settings.callout.titlePadding = v || "")],
      ["Editor@@callout-title-size", (v) => (settings.callout.titleSize = v || "")],
      ["Editor@@callout-content-padding", (v) => (settings.callout.contentPadding = v || "")],
      ["Editor@@callout-content-radius", (v) => (settings.callout.contentRadius = v || "")],

      // List & Table
      ["Editor@@list-indent", (v) => (settings.listTable.listIndent = v || "2.25em")],
      ["Editor@@list-spacing", (v) => (settings.listTable.listSpacing = v || "0.075em")],
      ["Editor@@ul-marker-restore", (v) => (settings.listTable.ulMarkerRestore = !!v)],
      ["Editor@@disable-alternative-checkboxes", (v) => (settings.listTable.disableAlternativeCheckboxes = !!v)],
      ["Editor@@checkbox-radius", (v) => (settings.listTable.checkboxRadius = v || "6px")],
      ["Editor@@table-width-select", (v) => (settings.listTable.tableWidthMode = v || "default")],
      ["Editor@@table-width", (v) => (settings.listTable.tableWidth = v ?? 88)],
      ["Editor@@table-header-background-light", (v) => (settings.listTable.tableHeaderBgLight = v || "")],
      ["Editor@@table-header-background-dark", (v) => (settings.listTable.tableHeaderBgDark = v || "")],

      // Link
      ["Editor@@link-decoration", (v) => (settings.link.decoration = v || "underline")],
      ["Editor@@link-decoration-hover", (v) => (settings.link.decorationHover = v || "underline")],
      ["Editor@@link-decoration-thickness", (v) => (settings.link.decorationThickness = v || "auto")],
      ["Editor@@link-external-decoration", (v) => (settings.link.externalDecoration = v || "underline")],
      ["Editor@@link-external-decoration-hover", (v) => (settings.link.externalDecorationHover = v || "underline")],
      ["Editor@@link-external-filter", (v) => (settings.link.externalFilter = v || "none")],

      // Image
      ["Editor@@img-center-align", (v) => (settings.image.centerAlign = !!v)],
      ["Editor@@img-darken", (v) => (settings.image.darken = !!v)],
      ["Editor@@zoom-off", (v) => (settings.image.zoomOff = !!v)],

      // Embed
      ["Editor@@seamless-embeds", (v) => (settings.embed.seamless = !!v)],
      ["Editor@@embed-padding", (v) => (settings.embed.padding = v || "")],
      ["Editor@@embed-border-radius", (v) => (settings.embed.borderRadius = v || "")],
      ["Editor@@embed-font-style", (v) => (settings.embed.fontStyle = v || "")],
      ["Editor@@embed-max-height", (v) => (settings.embed.maxHeight = v || "")],

      // Checkbox
      ["Plugin@@colorful-checkbox", (v) => (settings.checkbox.colorful = !!v)],

      // Headings
      ["Editor@@collapse-icon-restore", (v) => (settings.headings.collapseIconRestore = !!v)],
      ["Editor@@heading-indicator-off", (v) => (settings.headings.indicatorOff = !!v)],
      ["Editor@@inline-title-divider-remove", (v) => (settings.headings.inlineTitle.dividerRemove = !!v)],
      ["Editor@@inline-title-font", (v) => (settings.headings.inlineTitle.font = v || "")],
      ["Editor@@inline-title-size", (v) => (settings.headings.inlineTitle.size = v || "1.5em")],
      ["Editor@@inline-title-weight", (v) => (settings.headings.inlineTitle.weight = v ?? 700)],
      ["Editor@@inline-title-text-transform", (v) => (settings.headings.inlineTitle.textTransform = v || "")],

      // H1-H6
      ["Editor@@h1-alignment", (v) => (settings.headings.h1.alignment = v || "center")],
      ["Editor@@h1-divider-on", (v) => (settings.headings.h1.divider = !!v)],
      ["Editor@@h1-font", (v) => (settings.headings.h1.font = v || "")],
      ["Editor@@h1-weight", (v) => (settings.headings.h1.weight = v ?? 700)],
      ["Editor@@h1-text-transform", (v) => (settings.headings.h1.textTransform = v || "")],
      ["Editor@@h1-color-select", (v) => (settings.headings.h1.colorScheme = v || "default")],

      ["Editor@@h2-style-select", (v) => (settings.headings.h2.style = v === "h2-style-capsule" ? "capsule" : "twin")],
      ["Editor@@h2-style-dark-select", () => {}],
      ["Editor@@h2-divider-on", (v) => (settings.headings.h2.divider = !!v)],
      ["Editor@@h2-font", (v) => (settings.headings.h2.font = v || "")],
      ["Editor@@h2-weight", (v) => (settings.headings.h2.weight = v ?? 675)],
      ["Editor@@h2-text-transform", (v) => (settings.headings.h2.textTransform = v || "")],
      ["Editor@@h2-color-select", (v) => (settings.headings.h2.colorScheme = v || "default")],
      ["Editor@@h2-spacing-scale-start", (v) => (settings.headings.h2.spacingStart = v ?? 1.318)],
      ["Editor@@h2-spacing-scale-end", (v) => (settings.headings.h2.spacingEnd = v ?? 1.318)],

      ["Editor@@h3-divider-on", (v) => (settings.headings.h3.divider = !!v)],
      ["Editor@@h3-font", (v) => (settings.headings.h3.font = v || "")],
      ["Editor@@h3-weight", (v) => (settings.headings.h3.weight = v ?? 650)],
      ["Editor@@h3-text-transform", (v) => (settings.headings.h3.textTransform = v || "")],
      ["Editor@@h3-color-select", (v) => (settings.headings.h3.colorScheme = v || "default")],
      ["Editor@@h3-spacing-scale-start", (v) => (settings.headings.h3.spacingStart = v ?? 1.5)],
      ["Editor@@h3-spacing-scale-end", (v) => (settings.headings.h3.spacingEnd = v ?? 1.5)],

      ["Editor@@h4-divider-on", (v) => (settings.headings.h4.divider = !!v)],
      ["Editor@@h4-font", (v) => (settings.headings.h4.font = v || "")],
      ["Editor@@h4-weight", (v) => (settings.headings.h4.weight = v ?? 625)],
      ["Editor@@h4-text-transform", (v) => (settings.headings.h4.textTransform = v || "")],
      ["Editor@@h4-color-select", (v) => (settings.headings.h4.colorScheme = v || "default")],
      ["Editor@@h4-spacing-scale-start", (v) => (settings.headings.h4.spacingStart = v ?? 1.5)],
      ["Editor@@h4-spacing-scale-end", (v) => (settings.headings.h4.spacingEnd = v ?? 1.5)],

      ["Editor@@h5-divider-on", (v) => (settings.headings.h5.divider = !!v)],
      ["Editor@@h5-font", (v) => (settings.headings.h5.font = v || "")],
      ["Editor@@h5-weight", (v) => (settings.headings.h5.weight = v ?? 600)],
      ["Editor@@h5-text-transform", (v) => (settings.headings.h5.textTransform = v || "")],
      ["Editor@@h5-color-select", (v) => (settings.headings.h5.colorScheme = v || "default")],
      ["Editor@@h5-spacing-scale-start", (v) => (settings.headings.h5.spacingStart = v ?? 1.5)],
      ["Editor@@h5-spacing-scale-end", (v) => (settings.headings.h5.spacingEnd = v ?? 1.5)],

      ["Editor@@h6-divider-on", (v) => (settings.headings.h6.divider = !!v)],
      ["Editor@@h6-font", (v) => (settings.headings.h6.font = v || "")],
      ["Editor@@h6-weight", (v) => (settings.headings.h6.weight = v ?? 575)],
      ["Editor@@h6-text-transform", (v) => (settings.headings.h6.textTransform = v || "")],
      ["Editor@@h6-color-select", (v) => (settings.headings.h6.colorScheme = v || "default")],
      ["Editor@@h6-spacing-scale-start", (v) => (settings.headings.h6.spacingStart = v ?? 1.5)],
      ["Editor@@h6-spacing-scale-end", (v) => (settings.headings.h6.spacingEnd = v ?? 1.5)],

      // File Tree
      ["Components@@CTA-BTN-enable", (v) => (settings.fileTree.ctaBtnEnable = !!v)],
      ["Components@@file-names-untrim", (v) => (settings.fileTree.fileNamesUntrim = !!v)],
      ["Components@@folder-font-bold", (v) => (settings.fileTree.folderFontBold = !!v)],

      // New Tab
      ["Components@@new-tab-btn-select", (v) => (settings.newTab.buttonStyle = v || "default")],
      ["Components@@new-tab-image-select", (v) => (settings.newTab.imageStyle = v || "default")],
      ["Components@@new-tab-image", (v) => (settings.newTab.imageUrl = v || 'url(" ")')],

      // Canvas
      ["Components@@immersive-canvas", (v) => (settings.canvas.immersive = !!v)],

      // Scrollbar
      ["Components@@scrollbar-hide", (v) => (settings.scrollbar.hide = !!v)],
      ["Components@@restored-scrollbars", (v) => (settings.scrollbar.restored = !!v)],

      // Outline
      ["Components@@outline-enhanced", (v) => (settings.outline.enhanced = !!v)],

      // UI Detail
      ["Components@@setting-item-title-icon-remove", (v) => (settings.uiDetail.settingItemTitleIconRemove = !!v)],
      ["Components@@extra-anim-remove", (v) => (settings.uiDetail.extraAnimRemove = !!v)],
      ["Components@@anim-speed", (v) => (settings.uiDetail.animSpeed = v ?? 1)],

      // Mobile
      ["Mobile@@card-layout-pad-open", (v) => (settings.mobile.cardLayoutPad = !!v)],
      ["Mobile@@drawer-phone-full-width", (v) => (settings.mobile.drawerPhoneFullWidth = !!v)],

      // Plugin Compat
      ["Plugin@@DB-table-full-width-off", (v) => (settings.pluginCompat.dbTableFullWidthOff = !!v)],
      ["Plugin@@DB-table-bg-color", (v) => (settings.pluginCompat.dbTableBgColor = v || "default")],
      ["Plugin@@Projects-bg-color", (v) => (settings.pluginCompat.projectsBgColor = v || "default")],
      ["Plugin@@Surfing-bookmark-bar-hide", (v) => (settings.pluginCompat.surfingBookmarkBarHide = !!v)],

      // Rainbow Folder
      ["File-tree@@rainbow-folder", (v) => (settings.rainbowFolder.enabled = !!v)],
      ["File-tree@@rainbow-folder-color-1", (v) => (settings.rainbowFolder.colors[0] = v || "var(--color-red)")],
      ["File-tree@@rainbow-folder-color-2", (v) => (settings.rainbowFolder.colors[1] = v || "var(--color-orange)")],
      ["File-tree@@rainbow-folder-color-3", (v) => (settings.rainbowFolder.colors[2] = v || "var(--color-yellow)")],
      ["File-tree@@rainbow-folder-color-4", (v) => (settings.rainbowFolder.colors[3] = v || "var(--color-green)")],
      ["File-tree@@rainbow-folder-color-5", (v) => (settings.rainbowFolder.colors[4] = v || "var(--color-cyan)")],
      ["File-tree@@rainbow-folder-color-6", (v) => (settings.rainbowFolder.colors[5] = v || "var(--color-blue)")],
      ["File-tree@@rainbow-folder-color-7", (v) => (settings.rainbowFolder.colors[6] = v || "var(--color-purple)")],
      ["File-tree@@rainbow-folder-color-8", (v) => (settings.rainbowFolder.colors[7] = v || "var(--color-pink)")],
      ["File-tree@@rainbow-folder-icon-size", (v) => (settings.rainbowFolder.iconSize = v ?? 16)],
      ["File-tree@@rainbow-folder-opacity", (v) => (settings.rainbowFolder.opacity = v ?? 0.12)],
    ];

    for (const [oldKey, setter] of migrations) {
      if (oldKey in oldData) {
        setter(oldData[oldKey]);
      }
    }

    return settings;
  }
}
