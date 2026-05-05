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

    // Collect IDs that belong to a heading-levels-grid
    const gridChildIds = new Set<string>();
    for (const s of group.settings) {
      if (s.type === "heading-levels-grid" && s.levels) {
        const prefixes = s.levels.split(",").map(l => l.trim().toLowerCase());
        for (const prefix of prefixes) {
          for (const candidate of group.settings) {
            if (candidate.id.startsWith(`${prefix}-`)
                && candidate.id !== `${prefix}-alignment`
                && candidate.id !== `${prefix}-size`) {
              gridChildIds.add(candidate.id);
            }
          }
        }
      }
    }

    for (const setting of group.settings) {
      if (setting.type === "heading") {
        const headingInfo = this.createCollapsibleHeading(containerEl, setting);
        currentSection = headingInfo.content;
        continue;
      }
      if (setting.type === "heading-levels-grid") {
        const headingInfo = this.createCollapsibleHeading(containerEl, setting);
        this.renderHeadingLevelsGrid(headingInfo.content, group, setting);
        currentSection = null;
        continue;
      }
      if (gridChildIds.has(setting.id)) continue;

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

  private renderHeadingLevelsGrid(
    containerEl: HTMLElement,
    group: CSSSettingsGroup,
    gridSetting: CSSSetting
  ) {
    const levels = (gridSetting.levels || "").split(",").map(s => s.trim()).filter(Boolean);
    if (levels.length === 0) return;
    const levelPrefixes = levels.map(l => l.toLowerCase());

    // Infer column definitions from H1 settings
    const columnDefs: Array<{
      suffix: string;
      title: string;
      titleZh: string;
      type: string;
      options?: { label: string; value: string }[];
    }> = [];

    for (const s of group.settings) {
      if (s.id.startsWith("h1-") && s.id !== "h1-alignment" && s.id !== "h1-size") {
        const suffix = s.id.substring(3);
        columnDefs.push({
          suffix,
          title: s.title || "",
          titleZh: s.titleZh || "",
          type: s.type,
          options: s.options,
        });
      }
    }

    const table = containerEl.createEl("table", { cls: "zendian-heading-levels-table" });

    // Header
    const thead = table.createEl("thead");
    const headerRow = thead.createEl("tr");
    headerRow.createEl("th", { cls: "zendian-hl-level-col" });
    for (const col of columnDefs) {
      headerRow.createEl("th", { text: col.titleZh || col.title, cls: "zendian-hl-col" });
    }

    // Rows
    const tbody = table.createEl("tbody");
    for (let i = 0; i < levels.length; i++) {
      const prefix = levelPrefixes[i];
      const row = tbody.createEl("tr");
      row.createEl("td", { text: levels[i], cls: "zendian-hl-level-col zendian-hl-level-label" });

      for (const col of columnDefs) {
        const settingId = `${prefix}-${col.suffix}`;
        const childSetting = group.settings.find(s => s.id === settingId);
        const cell = row.createEl("td", { cls: "zendian-hl-cell" });
        if (childSetting) {
          this.renderGridCell(cell, group, childSetting, col);
        }
      }
    }
  }

  private renderGridCell(
    containerEl: HTMLElement,
    group: CSSSettingsGroup,
    setting: CSSSetting,
    col: { type: string; options?: { label: string; value: string }[] }
  ) {
    const fullKey = `${group.id}@@${setting.id}`;
    const currentValue = this.manager.getSetting(fullKey) ?? setting.default;

    switch (col.type) {
      case "class-toggle": {
        const toggle = containerEl.createEl("input", { type: "checkbox", cls: "zendian-hl-toggle" });
        toggle.checked = !!currentValue;
        toggle.addEventListener("change", async () => {
          await this.manager.updateSetting(group.id, setting.id, toggle.checked);
        });
        break;
      }
      case "variable-text": {
        const input = containerEl.createEl("input", { type: "text", cls: "zendian-hl-input" });
        input.value = String(currentValue || "");
        input.addEventListener("change", async () => {
          await this.manager.updateSetting(group.id, setting.id, input.value);
        });
        break;
      }
      case "variable-number": {
        const input = containerEl.createEl("input", { type: "number", cls: "zendian-hl-input" });
        input.value = String(currentValue || "");
        if (setting.min !== undefined) input.min = String(setting.min);
        if (setting.max !== undefined) input.max = String(setting.max);
        if (setting.step !== undefined) input.step = String(setting.step);
        input.addEventListener("change", async () => {
          const num = Number(input.value);
          if (!isNaN(num)) {
            await this.manager.updateSetting(group.id, setting.id, num);
          }
        });
        break;
      }
      case "class-select": {
        const select = containerEl.createEl("select", { cls: "zendian-hl-select" });
        for (const opt of col.options || []) {
          const option = select.createEl("option", { text: opt.label, value: opt.value });
          if (opt.value === String(currentValue)) option.selected = true;
        }
        select.addEventListener("change", async () => {
          await this.manager.updateSetting(group.id, setting.id, select.value);
        });
        break;
      }
    }
  }

  private renderSetting(
    containerEl: HTMLElement,
    group: CSSSettingsGroup,
    setting: CSSSetting
  ) {
    switch (setting.type) {
      case "heading":
      case "heading-levels-grid":
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
      case "variable-number-slider":
        this.renderNumber(containerEl, group, setting);
        break;
      case "variable-text":
        this.renderText(containerEl, group, setting);
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

}
