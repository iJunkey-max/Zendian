/**
 * ZENdian settings tab — sidebar navigation with collapsible sections.
 * Adapted from obsidian-style-settings by mgmeyers (MIT License).
 */

import { App, PluginSettingTab, Setting } from "obsidian";
import type ZENdianPlugin from "./main";
import type { StyleSettingsManager, CSSSettingsGroup, CSSSetting } from "./css-processor";

interface MergedGroup {
  displayName: string;
  groups: CSSSettingsGroup[];
}

export class ZENdianSettingTab extends PluginSettingTab {
  plugin: ZENdianPlugin;
  manager: StyleSettingsManager;
  private activeNavKey: string | null = null;
  private navItems: Map<string, HTMLElement> = new Map();
  private contentSections: Map<string, HTMLElement> = new Map();

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

    // Merge groups with the same display name
    const merged = this.mergeGroups(groups);

    if (!this.activeNavKey || !merged.find((m) => m.displayName === this.activeNavKey)) {
      this.activeNavKey = merged[0].displayName;
    }

    const wrapper = containerEl.createDiv("zendian-settings-wrapper");

    // Left nav
    const nav = wrapper.createDiv("zendian-nav");
    for (const mg of merged) {
      const item = nav.createDiv("zendian-nav-item");
      item.textContent = mg.displayName;
      item.dataset.navKey = mg.displayName;
      if (mg.displayName === this.activeNavKey) {
        item.classList.add("active");
      }
      item.addEventListener("click", () => {
        this.switchNav(mg.displayName);
      });
      this.navItems.set(mg.displayName, item);
    }

    // Right content
    const content = wrapper.createDiv("zendian-content");
    for (const mg of merged) {
      const section = content.createDiv("zendian-group-section");
      section.dataset.navKey = mg.displayName;
      if (mg.displayName !== this.activeNavKey) {
        section.style.display = "none";
      }
      this.renderMergedGroup(section, mg);
      this.contentSections.set(mg.displayName, section);
    }
  }

  private mergeGroups(groups: CSSSettingsGroup[]): MergedGroup[] {
    const map = new Map<string, CSSSettingsGroup[]>();
    for (const group of groups) {
      const key = group.nameZh || group.name || group.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(group);
    }
    const result: MergedGroup[] = [];
    for (const [displayName, groupList] of map) {
      result.push({ displayName, groups: groupList });
    }
    return result;
  }

  private switchNav(navKey: string) {
    if (navKey === this.activeNavKey) return;
    this.activeNavKey = navKey;

    for (const [key, item] of this.navItems) {
      item.classList.toggle("active", key === navKey);
    }
    for (const [key, section] of this.contentSections) {
      section.style.display = key === navKey ? "" : "none";
    }
  }

  private renderMergedGroup(containerEl: HTMLElement, mg: MergedGroup) {
    if (mg.groups.length === 1) {
      this.renderGroupContent(containerEl, mg.groups[0]);
    } else {
      // Multiple groups merged — show mode headers
      for (const group of mg.groups) {
        const modeHeader = containerEl.createDiv("zendian-mode-header");
        modeHeader.textContent = group.name || group.id;
        this.renderGroupContent(containerEl, group);
      }
    }
  }

  private renderGroupContent(containerEl: HTMLElement, group: CSSSettingsGroup) {
    let currentSection: HTMLElement | null = null;

    for (const setting of group.settings) {
      if (setting.type === "heading") {
        const headingInfo = this.createCollapsibleHeading(containerEl, setting);
        currentSection = headingInfo.content;
        continue;
      }

      const target = currentSection || containerEl;
      this.renderSetting(target, group, setting);
    }
  }

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

    const indicator = heading.createSpan("zendian-collapse-indicator");
    indicator.textContent = "▶";

    const content = wrapper.createDiv("zendian-heading-content");
    const startCollapsed = !!setting.collapsed;
    if (startCollapsed) {
      wrapper.classList.add("collapsed");
    }

    heading.addEventListener("click", () => {
      wrapper.classList.toggle("collapsed");
    });

    return { heading, content };
  }

  private renderSetting(
    containerEl: HTMLElement,
    group: CSSSettingsGroup,
    setting: CSSSetting
  ) {
    switch (setting.type) {
      case "heading":
        break;
      case "info-text":
        this.renderInfoText(containerEl, group, setting);
        break;
      case "class-toggle":
        this.renderToggle(containerEl, group, setting);
        break;
      case "class-select":
        this.renderSelect(containerEl, group, setting);
        break;
      case "variable-number":
        this.renderNumber(containerEl, group, setting);
        break;
      case "variable-text":
        this.renderText(containerEl, group, setting);
        break;
      case "variable-color":
        this.renderColor(containerEl, group, setting);
        break;
      case "variable-themed-color":
        this.renderThemedColor(containerEl, group, setting);
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
    setting: CSSSetting
  ) {
    const fullKey = `${group.id}@@${setting.id}`;
    const currentValue =
      this.manager.getSetting(fullKey) ?? setting.default ?? false;

    new Setting(containerEl)
      .setName(setting.titleZh || setting.title || setting.id)
      .setDesc(setting.descriptionZh || setting.description || "")
      .addToggle((toggle) =>
        toggle.setValue(!!currentValue).onChange(async (value) => {
          await this.manager.updateSetting(group.id, setting.id, value);
        })
      );
  }

  private renderSelect(
    containerEl: HTMLElement,
    group: CSSSettingsGroup,
    setting: CSSSetting
  ) {
    const fullKey = `${group.id}@@${setting.id}`;
    const currentValue =
      this.manager.getSetting(fullKey) ?? setting.default ?? "";
    const options = setting.options || [];

    new Setting(containerEl)
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
  }

  private renderNumber(
    containerEl: HTMLElement,
    group: CSSSettingsGroup,
    setting: CSSSetting
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
    });
  }

  private renderText(
    containerEl: HTMLElement,
    group: CSSSettingsGroup,
    setting: CSSSetting
  ) {
    const fullKey = `${group.id}@@${setting.id}`;
    const currentValue =
      this.manager.getSetting(fullKey) ?? setting.default ?? "";

    new Setting(containerEl)
      .setName(setting.titleZh || setting.title || setting.id)
      .setDesc(setting.descriptionZh || setting.description || "")
      .addText((text) =>
        text.setValue(String(currentValue)).onChange(async (value) => {
          await this.manager.updateSetting(group.id, setting.id, value);
        })
      );
  }

  private renderColor(
    containerEl: HTMLElement,
    group: CSSSettingsGroup,
    setting: CSSSetting
  ) {
    const fullKey = `${group.id}@@${setting.id}`;
    const currentValue =
      this.manager.getSetting(fullKey) ?? setting.default ?? "#000000";

    new Setting(containerEl)
      .setName(setting.titleZh || setting.title || setting.id)
      .setDesc(setting.descriptionZh || setting.description || "")
      .addColorPicker((picker) =>
        picker.setValue(String(currentValue)).onChange(async (value) => {
          await this.manager.updateSetting(group.id, setting.id, value);
        })
      );
  }

  private renderThemedColor(
    containerEl: HTMLElement,
    group: CSSSettingsGroup,
    setting: CSSSetting
  ) {
    const fullKey = `${group.id}@@${setting.id}`;
    const saved = this.manager.getSetting(fullKey);
    const currentValue =
      saved && typeof saved === "object"
        ? saved
        : {
            light: setting.defaultLight || "#000000",
            dark: setting.defaultDark || "#000000",
          };

    new Setting(containerEl)
      .setName(setting.titleZh || setting.title || setting.id)
      .setDesc(setting.descriptionZh || setting.description || "")
      .addColorPicker((picker) =>
        picker
          .setValue(String(currentValue.light))
          .onChange(async (value) => {
            await this.manager.updateSetting(group.id, setting.id, {
              light: value,
              dark: currentValue.dark,
            });
          })
      )
      .addColorPicker((picker) =>
        picker
          .setValue(String(currentValue.dark))
          .onChange(async (value) => {
            await this.manager.updateSetting(group.id, setting.id, {
              light: currentValue.light,
              dark: value,
            });
          })
      );
  }
}
