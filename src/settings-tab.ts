/**
 * ZENdian settings tab — 5-tab sidebar navigation with collapsible sections.
 * Adapted from obsidian-style-settings by mgmeyers (MIT License).
 */

import { App, PluginSettingTab, Setting } from "obsidian";
import type ZENdianPlugin from "./main";
import type { StyleSettingsManager, CSSSettingsGroup, CSSSetting } from "./css-processor";

// ============================================================
// Menu Configuration — maps setting IDs to new 5-tab structure
// ============================================================

interface SettingRef {
  groupId: string;
  settingId: string;
  /** If true, this setting is conditionally disabled based on another setting */
  dependsOn?: { groupId: string; settingId: string; value?: any };
}

interface MenuSection {
  id: string;
  title: string;
  titleZh: string;
  settings: SettingRef[];
  /** For heading-levels-grid: show H1-H6 tab switcher */
  headingTabs?: boolean;
}

interface MenuTab {
  id: string;
  name: string;
  icon: string;
  sections: MenuSection[];
}

const MENU_CONFIG: MenuTab[] = [
  // ──────────────────────────────────────────────
  // 1. 视图与工作区
  // ──────────────────────────────────────────────
  {
    id: "workspace",
    name: "视图与工作区",
    icon: "🖥️",
    sections: [
      {
        id: "card-layout",
        title: "Card & Layout",
        titleZh: "卡片与布局",
        settings: [
          { groupId: "Components", settingId: "card-layout-open" },
          { groupId: "Components", settingId: "immersive-canvas" },
          { groupId: "Components", settingId: "canvas-card-border-width" },
          { groupId: "Components", settingId: "canvas-card-menu" },
          { groupId: "Components", settingId: "media-embed-card-border-off" },
        ],
      },
      {
        id: "sidebar",
        title: "Sidebar & File Explorer",
        titleZh: "侧边栏与文件列表",
        settings: [
          { groupId: "Components", settingId: "CTA-BTN-enable" },
          { groupId: "Components", settingId: "file-names-untrim" },
          { groupId: "Components", settingId: "folder-font-bold" },
          { groupId: "Components", settingId: "colorful-folder" },
          { groupId: "Components", settingId: "file-icon-remove" },
          { groupId: "Components", settingId: "outline-enhanced" },
        ],
      },
      {
        id: "tabs",
        title: "Tabs",
        titleZh: "标签页",
        settings: [
          { groupId: "Components", settingId: "new-tab-btn-select" },
          { groupId: "Components", settingId: "new-tab-image-select" },
          { groupId: "Components", settingId: "new-tab-image" },
        ],
      },
      {
        id: "ui-details",
        title: "UI Details & Animation",
        titleZh: "界面细节与动效",
        settings: [
          { groupId: "Components", settingId: "scrollbar-hide" },
          { groupId: "Components", settingId: "restored-scrollbars" },
          { groupId: "Components", settingId: "setting-item-title-icon-remove" },
          { groupId: "Components", settingId: "extra-anim-remove" },
          { groupId: "Components", settingId: "anim-speed" },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // 2. 禅意与专注
  // ──────────────────────────────────────────────
  {
    id: "zen",
    name: "禅意与专注",
    icon: "🧘",
    sections: [
      {
        id: "auto-hide",
        title: "Auto Hide",
        titleZh: "自动隐藏",
        settings: [
          { groupId: "Components", settingId: "tab-autohide" },
          { groupId: "Components", settingId: "tab-title-bar-autohide" },
          { groupId: "Components", settingId: "Ribbon-autohide" },
          { groupId: "Components", settingId: "nav-header-autohide" },
          { groupId: "Components", settingId: "status-bar-autohide" },
          { groupId: "Components", settingId: "vault-profile-autohide" },
        ],
      },
      {
        id: "focus-mode",
        title: "Focus Mode",
        titleZh: "专注模式",
        settings: [
          { groupId: "Editor", settingId: "border-focus-mode" },
          {
            groupId: "Editor",
            settingId: "line-normal-opacity",
            dependsOn: { groupId: "Editor", settingId: "border-focus-mode", value: true },
          },
        ],
      },
      {
        id: "hover-indicator",
        title: "Hover Indicator",
        titleZh: "焦点指示",
        settings: [
          { groupId: "Editor", settingId: "line-hover-indicator" },
          { groupId: "Editor", settingId: "focus-indicator-list-level" },
          { groupId: "Editor", settingId: "focus-indicator-codeblock-line-number" },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // 3. 排版与阅读
  // ──────────────────────────────────────────────
  {
    id: "typography",
    name: "排版与阅读",
    icon: "📝",
    sections: [
      {
        id: "page-paragraph",
        title: "Page & Paragraph",
        titleZh: "页面与段落",
        settings: [
          { groupId: "Editor", settingId: "file-line-width" },
          { groupId: "Editor", settingId: "editor-grid-background-pattren" },
          { groupId: "Editor", settingId: "grid-background-pattern-size" },
          { groupId: "Editor", settingId: "text-align-justify" },
          { groupId: "Editor", settingId: "p-spacing" },
          { groupId: "Editor", settingId: "p-spacing-br" },
          { groupId: "Editor", settingId: "letter-spacing" },
          { groupId: "Editor", settingId: "line-height-customize" },
        ],
      },
      {
        id: "heading-system",
        title: "Heading System",
        titleZh: "标题系统",
        headingTabs: true,
        settings: [
          // Inline title settings
          { groupId: "Editor", settingId: "inline-title-divider-remove" },
          { groupId: "Editor", settingId: "inline-title-font" },
          { groupId: "Editor", settingId: "inline-title-size" },
          { groupId: "Editor", settingId: "inline-title-weight" },
          { groupId: "Editor", settingId: "inline-title-text-transform" },
          // Global heading controls
          { groupId: "Editor", settingId: "heading-indicator-off" },
          { groupId: "Editor", settingId: "collapse-icon-restore" },
          // H1-H6 level-specific settings
          { groupId: "Editor", settingId: "h1-alignment" },
          { groupId: "Editor", settingId: "h1-divider-on" },
          { groupId: "Editor", settingId: "h1-font" },
          { groupId: "Editor", settingId: "h1-weight" },
          { groupId: "Editor", settingId: "h1-text-transform" },
          { groupId: "Editor", settingId: "h1-color-select" },
          { groupId: "Editor", settingId: "h2-style-select" },
          { groupId: "Editor", settingId: "h2-style-dark-select" },
          { groupId: "Editor", settingId: "h2-divider-on" },
          { groupId: "Editor", settingId: "h2-font" },
          { groupId: "Editor", settingId: "h2-weight" },
          { groupId: "Editor", settingId: "h2-text-transform" },
          { groupId: "Editor", settingId: "h2-color-select" },
          { groupId: "Editor", settingId: "h2-spacing-scale-start" },
          { groupId: "Editor", settingId: "h2-spacing-scale-end" },
          { groupId: "Editor", settingId: "h3-divider-on" },
          { groupId: "Editor", settingId: "h3-font" },
          { groupId: "Editor", settingId: "h3-weight" },
          { groupId: "Editor", settingId: "h3-text-transform" },
          { groupId: "Editor", settingId: "h3-color-select" },
          { groupId: "Editor", settingId: "h3-spacing-scale-start" },
          { groupId: "Editor", settingId: "h3-spacing-scale-end" },
          { groupId: "Editor", settingId: "h4-divider-on" },
          { groupId: "Editor", settingId: "h4-font" },
          { groupId: "Editor", settingId: "h4-weight" },
          { groupId: "Editor", settingId: "h4-text-transform" },
          { groupId: "Editor", settingId: "h4-color-select" },
          { groupId: "Editor", settingId: "h4-spacing-scale-start" },
          { groupId: "Editor", settingId: "h4-spacing-scale-end" },
          { groupId: "Editor", settingId: "h5-divider-on" },
          { groupId: "Editor", settingId: "h5-font" },
          { groupId: "Editor", settingId: "h5-weight" },
          { groupId: "Editor", settingId: "h5-text-transform" },
          { groupId: "Editor", settingId: "h5-color-select" },
          { groupId: "Editor", settingId: "h5-spacing-scale-start" },
          { groupId: "Editor", settingId: "h5-spacing-scale-end" },
          { groupId: "Editor", settingId: "h6-divider-on" },
          { groupId: "Editor", settingId: "h6-font" },
          { groupId: "Editor", settingId: "h6-weight" },
          { groupId: "Editor", settingId: "h6-text-transform" },
          { groupId: "Editor", settingId: "h6-color-select" },
          { groupId: "Editor", settingId: "h6-spacing-scale-start" },
          { groupId: "Editor", settingId: "h6-spacing-scale-end" },
        ],
      },
      {
        id: "text-details",
        title: "Text Details",
        titleZh: "文本细节",
        settings: [
          { groupId: "Editor", settingId: "inline-code-background-light" },
          { groupId: "Editor", settingId: "inline-code-background-dark" },
          { groupId: "Editor", settingId: "link-decoration" },
          { groupId: "Editor", settingId: "link-decoration-hover" },
          { groupId: "Editor", settingId: "link-decoration-thickness" },
          { groupId: "Editor", settingId: "link-external-decoration" },
          { groupId: "Editor", settingId: "link-external-decoration-hover" },
          { groupId: "Editor", settingId: "link-external-filter" },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // 4. 渲染元素
  // ──────────────────────────────────────────────
  {
    id: "elements",
    name: "渲染元素",
    icon: "🧩",
    sections: [
      {
        id: "code-blockquote",
        title: "Code & Blockquotes",
        titleZh: "代码与引用",
        settings: [
          { groupId: "Editor", settingId: "codeblock-style-select" },
          { groupId: "Editor", settingId: "code-background-light" },
          { groupId: "Editor", settingId: "code-border-light" },
          { groupId: "Editor", settingId: "code-background-dark" },
          { groupId: "Editor", settingId: "code-border-dark" },
          { groupId: "Editor", settingId: "code-line-height" },
          { groupId: "Editor", settingId: "blockquote-background-light" },
          { groupId: "Editor", settingId: "blockquote-background-dark" },
          { groupId: "Editor", settingId: "blockquote-line-height" },
        ],
      },
      {
        id: "list-table",
        title: "Lists & Tables",
        titleZh: "列表与表格",
        settings: [
          { groupId: "Editor", settingId: "list-indent" },
          { groupId: "Editor", settingId: "list-spacing" },
          { groupId: "Editor", settingId: "ul-marker-restore" },
          { groupId: "Editor", settingId: "disable-alternative-checkboxes" },
          { groupId: "Editor", settingId: "checkbox-radius" },
          { groupId: "Plugin", settingId: "colorful-checkbox" },
          { groupId: "Editor", settingId: "table-width-select" },
          { groupId: "Editor", settingId: "table-width" },
          { groupId: "Editor", settingId: "table-header-background-light" },
          { groupId: "Editor", settingId: "table-header-background-dark" },
          { groupId: "Editor", settingId: "table-line-height" },
        ],
      },
      {
        id: "callout-embed",
        title: "Callouts & Embeds",
        titleZh: "标注与内嵌",
        settings: [
          { groupId: "Editor", settingId: "callout-style-select" },
          { groupId: "Editor", settingId: "callout-border-width" },
          { groupId: "Editor", settingId: "callout-border-opacity" },
          { groupId: "Editor", settingId: "callout-padding" },
          { groupId: "Editor", settingId: "callout-title-padding" },
          { groupId: "Editor", settingId: "callout-title-size" },
          { groupId: "Editor", settingId: "callout-content-padding" },
          { groupId: "Editor", settingId: "callout-content-radius" },
          { groupId: "Editor", settingId: "seamless-embeds" },
          { groupId: "Editor", settingId: "embed-padding" },
          { groupId: "Editor", settingId: "embed-border-radius" },
          { groupId: "Editor", settingId: "embed-font-style" },
          { groupId: "Editor", settingId: "embed-max-height" },
        ],
      },
      {
        id: "images",
        title: "Images",
        titleZh: "图像",
        settings: [
          { groupId: "Editor", settingId: "img-center-align" },
          { groupId: "Editor", settingId: "img-darken" },
          { groupId: "Editor", settingId: "zoom-off" },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // 5. 移动端与适配
  // ──────────────────────────────────────────────
  {
    id: "mobile",
    name: "移动端与适配",
    icon: "📱",
    sections: [
      {
        id: "mobile-layout",
        title: "Mobile Layout",
        titleZh: "移动端布局",
        settings: [
          { groupId: "Mobile", settingId: "card-layout-pad-open" },
          { groupId: "Mobile", settingId: "drawer-phone-full-width" },
        ],
      },
      {
        id: "plugin-compat",
        title: "Plugin Compatibility",
        titleZh: "第三方插件适配",
        settings: [
          { groupId: "Plugin", settingId: "DB-table-full-width-off" },
          { groupId: "Plugin", settingId: "DB-table-bg-color" },
          { groupId: "Plugin", settingId: "Projects-bg-color" },
          { groupId: "Plugin", settingId: "Surfing-bookmark-bar-hide" },
        ],
      },
    ],
  },
];

// Heading level prefixes for tab switcher
const HEADING_LEVELS = ["h1", "h2", "h3", "h4", "h5", "h6"];

// ============================================================
// Settings Tab
// ============================================================

export class ZENdianSettingTab extends PluginSettingTab {
  plugin: ZENdianPlugin;
  manager: StyleSettingsManager;
  private activeTabId: string = "workspace";
  private activeHeadingLevel: string = "h1";
  private navItems: Map<string, HTMLElement> = new Map();
  private tabContents: Map<string, HTMLElement> = new Map();

  constructor(app: App, plugin: ZENdianPlugin, manager: StyleSettingsManager) {
    super(app, plugin);
    this.plugin = plugin;
    this.manager = manager;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const groups = this.manager.getGroups();
    if (groups.length === 0) {
      containerEl.createEl("p", {
        text: "No settings found. Try restarting Obsidian.",
      });
      return;
    }

    const wrapper = containerEl.createDiv("zendian-settings-wrapper");

    // Top nav
    const nav = wrapper.createDiv("zendian-nav");
    for (const tab of MENU_CONFIG) {
      const item = nav.createDiv("zendian-nav-item");
      item.textContent = `${tab.icon} ${tab.name}`;
      item.dataset.tabId = tab.id;
      if (tab.id === this.activeTabId) {
        item.classList.add("active");
      }
      item.addEventListener("click", () => this.switchTab(tab.id));
      this.navItems.set(tab.id, item);
    }

    // Content
    const content = wrapper.createDiv("zendian-content");
    for (const tab of MENU_CONFIG) {
      const section = content.createDiv("zendian-tab-section");
      section.dataset.tabId = tab.id;
      if (tab.id !== this.activeTabId) {
        section.style.display = "none";
      }
      this.renderTabContent(section, tab);
      this.tabContents.set(tab.id, section);
    }
  }

  private switchTab(tabId: string) {
    if (tabId === this.activeTabId) return;
    this.activeTabId = tabId;

    for (const [id, item] of this.navItems) {
      item.classList.toggle("active", id === tabId);
    }
    for (const [id, section] of this.tabContents) {
      section.style.display = id === tabId ? "" : "none";
    }
  }

  private renderTabContent(containerEl: HTMLElement, tab: MenuTab) {
    for (const section of tab.sections) {
      const headingSetting: CSSSetting = {
        id: section.id,
        title: section.title,
        titleZh: section.titleZh,
        type: "heading",
        level: 3,
        collapsed: false,
      };
      const { content } = this.createCollapsibleHeading(containerEl, headingSetting);

      if (section.headingTabs) {
        this.renderHeadingTabsSection(content, section);
      } else {
        this.renderSection(content, section);
      }
    }
  }

  private renderSection(containerEl: HTMLElement, section: MenuSection) {
    for (const ref of section.settings) {
      const result = this.manager.findSettingById(ref.settingId, ref.groupId);
      if (!result) continue;

      const { group, setting } = result;
      const target = containerEl;

      // Check if this setting should be conditionally disabled
      const isDisabled = this.isSettingDisabled(ref);

      this.renderSetting(target, group, setting, isDisabled);
    }
  }

  private isSettingDisabled(ref: SettingRef): boolean {
    if (!ref.dependsOn) return false;
    const fullKey = `${ref.dependsOn.groupId}@@${ref.dependsOn.settingId}`;
    const value = this.manager.getSetting(fullKey);
    const expected = ref.dependsOn.value ?? true;
    return value !== expected;
  }

  // ──────────────────────────────────────────────
  // Heading Tabs Section (H1-H6 switcher)
  // ──────────────────────────────────────────────

  private renderHeadingTabsSection(containerEl: HTMLElement, section: MenuSection) {
    // Inline title settings (always visible)
    const inlineTitleSettings = section.settings.filter(
      (ref) => ref.settingId.startsWith("inline-title-") || ref.settingId === "heading-indicator-off" || ref.settingId === "collapse-icon-restore"
    );

    // Global heading controls
    const globalSettings = section.settings.filter(
      (ref) => ref.settingId === "heading-indicator-off" || ref.settingId === "collapse-icon-restore"
    );

    // Render global controls first
    for (const ref of globalSettings) {
      const result = this.manager.findSettingById(ref.settingId, ref.groupId);
      if (result) {
        this.renderSetting(containerEl, result.group, result.setting, false);
      }
    }

    // Inline title section
    const inlineTitleRefs = section.settings.filter((ref) => ref.settingId.startsWith("inline-title-"));
    if (inlineTitleRefs.length > 0) {
      const inlineHeading: CSSSetting = {
        id: "inline-title-heading",
        title: "Inline Title",
        titleZh: "页内标题",
        type: "heading",
        level: 4,
        collapsed: false,
      };
      const { content: inlineContent } = this.createCollapsibleHeading(containerEl, inlineHeading);
      for (const ref of inlineTitleRefs) {
        const result = this.manager.findSettingById(ref.settingId, ref.groupId);
        if (result) {
          this.renderSetting(inlineContent, result.group, result.setting, false);
        }
      }
    }

    // H1-H6 tab switcher
    const tabsContainer = containerEl.createDiv("zendian-heading-tabs");
    const tabButtons = tabsContainer.createDiv("zendian-heading-tab-buttons");
    const tabContent = tabsContainer.createDiv("zendian-heading-tab-content");

    for (const level of HEADING_LEVELS) {
      const btn = tabButtons.createEl("button", {
        text: level.toUpperCase(),
        cls: "zendian-heading-tab-btn",
      });
      if (level === this.activeHeadingLevel) {
        btn.classList.add("active");
      }
      btn.addEventListener("click", () => {
        this.switchHeadingLevel(level, tabButtons, tabContent, section);
      });
    }

    // Render initial level content
    this.renderHeadingLevelContent(tabContent, this.activeHeadingLevel, section);
  }

  private switchHeadingLevel(
    level: string,
    tabButtons: HTMLElement,
    tabContent: HTMLElement,
    section: MenuSection
  ) {
    this.activeHeadingLevel = level;
    // Update button states
    for (const btn of tabButtons.children) {
      btn.classList.toggle("active", btn.textContent?.toLowerCase() === level);
    }
    // Clear and re-render content
    tabContent.empty();
    this.renderHeadingLevelContent(tabContent, level, section);
  }

  private renderHeadingLevelContent(
    containerEl: HTMLElement,
    level: string,
    section: MenuSection
  ) {
    // Find settings for this level
    const levelSettings = section.settings.filter((ref) => {
      const id = ref.settingId;
      // Match level-specific settings (e.g., h1-font, h2-weight, etc.)
      if (id.startsWith(`${level}-`) && id !== `${level}-alignment`) {
        return true;
      }
      // H1 has alignment
      if (level === "h1" && id === "h1-alignment") return true;
      // H2 has style selectors
      if (level === "h2" && (id === "h2-style-select" || id === "h2-style-dark-select")) return true;
      // Levels with spacing
      if (id === `${level}-spacing-scale-start` || id === `${level}-spacing-scale-end`) return true;
      return false;
    });

    // Remove duplicates (spacing might be matched twice)
    const seen = new Set<string>();
    const uniqueSettings = levelSettings.filter((ref) => {
      const key = `${ref.groupId}@@${ref.settingId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    for (const ref of uniqueSettings) {
      const result = this.manager.findSettingById(ref.settingId, ref.groupId);
      if (result) {
        this.renderSetting(containerEl, result.group, result.setting, false);
      }
    }
  }

  // ──────────────────────────────────────────────
  // Collapsible Heading
  // ──────────────────────────────────────────────

  private createCollapsibleHeading(
    containerEl: HTMLElement,
    setting: CSSSetting
  ): { heading: HTMLElement; content: HTMLElement } {
    const wrapper = containerEl.createDiv("zendian-heading-wrapper");

    const level = setting.level || 3;
    const tag = `h${Math.min(Math.max(level, 3), 6)}` as keyof HTMLElementTagNameMap;
    const heading = wrapper.createEl(tag, {
      text: setting.titleZh || setting.title || "",
    });
    heading.classList.add("zendian-heading");

    const content = wrapper.createDiv("zendian-heading-content");

    return { heading, content };
  }

  // ──────────────────────────────────────────────
  // Setting Renderers
  // ──────────────────────────────────────────────

  private renderSetting(
    containerEl: HTMLElement,
    group: CSSSettingsGroup,
    setting: CSSSetting,
    disabled: boolean
  ) {
    switch (setting.type) {
      case "heading":
      case "heading-levels-grid":
        break;
      case "info-text":
        this.renderInfoText(containerEl, group, setting);
        break;
      case "class-toggle":
        this.renderToggle(containerEl, group, setting, disabled);
        break;
      case "class-select":
        this.renderSelect(containerEl, group, setting, disabled);
        break;
      case "variable-number":
      case "variable-number-slider":
        this.renderNumber(containerEl, group, setting, disabled);
        break;
      case "variable-text":
        this.renderText(containerEl, group, setting, disabled);
        break;
    }
  }

  private renderInfoText(
    containerEl: HTMLElement,
    _group: CSSSettingsGroup,
    setting: CSSSetting
  ) {
    const text =
      setting.descriptionZh || setting.description || setting.title || "";
    const el = containerEl.createDiv("zendian-info-text");
    if (setting.markdown) {
      el.innerHTML = text;
    } else {
      el.textContent = text;
    }
  }

  private renderToggle(
    containerEl: HTMLElement,
    group: CSSSettingsGroup,
    setting: CSSSetting,
    disabled: boolean
  ) {
    const fullKey = `${group.id}@@${setting.id}`;
    const currentValue =
      this.manager.getSetting(fullKey) ?? setting.default ?? false;

    const s = new Setting(containerEl)
      .setName(setting.titleZh || setting.title || setting.id)
      .setDesc(setting.descriptionZh || setting.description || "")
      .addToggle((toggle) =>
        toggle.setValue(!!currentValue).onChange(async (value) => {
          await this.manager.updateSetting(group.id, setting.id, value);
          // Re-render to update conditional states
          this.display();
        })
      );

    if (disabled) {
      s.settingEl.classList.add("zendian-disabled");
      s.components.forEach((c) => {
        if (c.toggle) c.toggle.setDisabled(true);
      });
    }
  }

  private renderSelect(
    containerEl: HTMLElement,
    group: CSSSettingsGroup,
    setting: CSSSetting,
    disabled: boolean
  ) {
    const fullKey = `${group.id}@@${setting.id}`;
    const currentValue =
      this.manager.getSetting(fullKey) ?? setting.default ?? "";
    const options = setting.options || [];

    const s = new Setting(containerEl)
      .setName(setting.titleZh || setting.title || setting.id)
      .setDesc(setting.descriptionZh || setting.description || "")
      .addDropdown((dropdown) => {
        for (const opt of options) {
          dropdown.addOption(opt.value, opt.label);
        }
        dropdown.setValue(String(currentValue)).onChange(async (value) => {
          await this.manager.updateSetting(group.id, setting.id, value);
        });
      });

    if (disabled) {
      s.settingEl.classList.add("zendian-disabled");
    }
  }

  private renderNumber(
    containerEl: HTMLElement,
    group: CSSSettingsGroup,
    setting: CSSSetting,
    disabled: boolean
  ) {
    const fullKey = `${group.id}@@${setting.id}`;
    const currentValue =
      this.manager.getSetting(fullKey) ?? setting.default ?? 0;
    const format = setting.format || "";

    const s = new Setting(containerEl)
      .setName(setting.titleZh || setting.title || setting.id)
      .setDesc(
        (setting.descriptionZh || setting.description || "") +
          (format ? ` (${format})` : "")
      );

    if (setting.min !== undefined && setting.max !== undefined) {
      s.addSlider((slider) => {
        slider
          .setLimits(setting.min!, setting.max!, setting.step || 1)
          .setValue(Number(currentValue))
          .setDynamicTooltip()
          .onChange(async (value) => {
            await this.manager.updateSetting(group.id, setting.id, value);
          });
        if (disabled) slider.setDisabled(true);
      });
    }

    s.addText((text) => {
      text
        .setValue(String(currentValue))
        .setPlaceholder(format || "")
        .onChange(async (value) => {
          const num = Number(value);
          if (!isNaN(num)) {
            await this.manager.updateSetting(group.id, setting.id, num);
          }
        });
      if (disabled) text.setDisabled(true);
    });

    if (disabled) {
      s.settingEl.classList.add("zendian-disabled");
    }
  }

  private renderText(
    containerEl: HTMLElement,
    group: CSSSettingsGroup,
    setting: CSSSetting,
    disabled: boolean
  ) {
    const fullKey = `${group.id}@@${setting.id}`;
    const currentValue =
      this.manager.getSetting(fullKey) ?? setting.default ?? "";

    const s = new Setting(containerEl)
      .setName(setting.titleZh || setting.title || setting.id)
      .setDesc(setting.descriptionZh || setting.description || "")
      .addText((text) =>
        text.setValue(String(currentValue)).onChange(async (value) => {
          await this.manager.updateSetting(group.id, setting.id, value);
        })
      );

    if (disabled) {
      s.settingEl.classList.add("zendian-disabled");
    }
  }
}
