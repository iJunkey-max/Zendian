/**
 * ZENdian settings tab — renders @settings groups as a visual settings UI.
 * Adapted from obsidian-style-settings by mgmeyers (MIT License).
 */

import { App, PluginSettingTab, Setting } from "obsidian";
import type ZENdianPlugin from "./main";
import type { StyleSettingsManager, CSSSettingsGroup, CSSSetting } from "./css-processor";

export class ZENdianSettingTab extends PluginSettingTab {
  plugin: ZENdianPlugin;
  manager: StyleSettingsManager;

  constructor(app: App, plugin: ZENdianPlugin, manager: StyleSettingsManager) {
    super(app, plugin);
    this.plugin = plugin;
    this.manager = manager;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "ZENdian Settings" });

    const groups = this.manager.getGroups();
    if (groups.length === 0) {
      containerEl.createEl("p", {
        text: "No settings found. Try restarting Obsidian.",
      });
      return;
    }

    for (const group of groups) {
      this.renderGroup(containerEl, group);
    }
  }

  private renderGroup(containerEl: HTMLElement, group: CSSSettingsGroup) {
    const section = containerEl.createDiv("zendian-settings-group");

    // Group header
    const header = section.createEl("h3", {
      text: group.nameZh || group.name || group.id,
    });
    header.classList.add("zendian-group-header");

    // Collapse toggle
    let collapsed = false;
    header.addEventListener("click", () => {
      collapsed = !collapsed;
      section.classList.toggle("collapsed", collapsed);
    });

    const content = section.createDiv("zendian-group-content");

    for (const setting of group.settings) {
      this.renderSetting(content, group, setting);
    }
  }

  private renderSetting(
    containerEl: HTMLElement,
    group: CSSSettingsGroup,
    setting: CSSSetting
  ) {
    switch (setting.type) {
      case "heading":
        this.renderHeading(containerEl, setting);
        break;
      case "info-text":
        this.renderInfoText(containerEl, setting);
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

  private renderHeading(containerEl: HTMLElement, setting: CSSSetting) {
    const level = setting.level || 3;
    const tag = `h${Math.min(Math.max(level, 3), 6)}` as keyof HTMLElementTagNameMap;
    const el = containerEl.createEl(tag, {
      text: setting.titleZh || setting.title || "",
    });
    el.classList.add("zendian-heading");
    if (setting.collapsed) {
      el.classList.add("zendian-heading-collapsed");
    }
  }

  private renderInfoText(containerEl: HTMLElement, setting: CSSSetting) {
    const text = setting.descriptionZh || setting.description || setting.title || "";
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
    const currentValue = this.manager.getSetting(fullKey) ?? setting.default ?? false;

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
    const currentValue = this.manager.getSetting(fullKey) ?? setting.default ?? "";
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
    const currentValue = this.manager.getSetting(fullKey) ?? setting.default ?? 0;
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
    const currentValue = this.manager.getSetting(fullKey) ?? setting.default ?? "";

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
    const currentValue = this.manager.getSetting(fullKey) ?? setting.default ?? "#000000";

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
    const currentValue = this.manager.getSetting(fullKey) ?? setting.default ?? "#000000";

    new Setting(containerEl)
      .setName(setting.titleZh || setting.title || setting.id)
      .setDesc(setting.descriptionZh || setting.description || "")
      .addColorPicker((picker) =>
        picker.setValue(String(currentValue)).onChange(async (value) => {
          await this.manager.updateSetting(group.id, setting.id, value);
        })
      );
  }
}
