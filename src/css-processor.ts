/**
 * CSS @settings parser and DOM applier.
 * Adapted from obsidian-style-settings by mgmeyers (MIT License).
 */

import { Plugin } from "obsidian";

export interface CSSSetting {
  id: string;
  title?: string;
  titleZh?: string;
  description?: string;
  descriptionZh?: string;
  type: string;
  default?: any;
  options?: { label: string; value: string }[];
  format?: string;
  opacity?: boolean;
  min?: number;
  max?: number;
  step?: number;
  level?: number;
  collapsed?: boolean;
  allowEmpty?: boolean;
  markdown?: boolean;
  colors?: { light: string; dark: string };
}

export interface CSSSettingsGroup {
  id: string;
  name: string;
  nameZh?: string;
  settings: CSSSetting[];
}

const SETTINGS_REGEX = /\/\*[\s!]*@settings\s*\n([\s\S]*?)\*\//g;

function getIndent(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function parseKeyValue(line: string): [string, string] | null {
  const match = line.match(/^(\w[\w.]*)\s*:\s*(.*)/);
  if (!match) return null;
  let value = match[2].trim();
  // Remove surrounding quotes
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return [match[1], value];
}

function parseYAML(content: string): CSSSettingsGroup | null {
  const lines = content.split("\n");
  let name = "";
  let nameZh = "";
  let id = "";
  const settings: CSSSetting[] = [];
  let currentSetting: Partial<CSSSetting> | null = null;
  let currentOptions: { label: string; value: string }[] | null = null;
  let currentColors: { light: string; dark: string } | null = null;
  let inOptions = false;
  let inColors = false;
  let lastOption: Partial<{ label: string; value: string }> | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "    "); // normalize tabs
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const indent = getIndent(line);
    const kv = parseKeyValue(trimmed);

    // Detect new setting entry
    if (trimmed.startsWith("-") && (trimmed.length === 1 || trimmed.startsWith("- ") || trimmed === "-")) {
      // Save previous setting
      if (currentSetting && currentSetting.id && currentSetting.type) {
        if (currentOptions && currentOptions.length > 0) {
          currentSetting.options = currentOptions;
        }
        if (currentColors) {
          currentSetting.colors = currentColors;
        }
        settings.push(currentSetting as CSSSetting);
      }
      currentSetting = {};
      currentOptions = null;
      currentColors = null;
      lastOption = null;
      inOptions = false;
      inColors = false;

      // Check if "- id: xxx" on the same line
      const inlineId = trimmed.match(/^-\s+id:\s*(.+)/);
      if (inlineId) {
        currentSetting.id = inlineId[1].trim();
      }
      continue;
    }

    if (!kv) continue;
    const [key, value] = kv;

    // Top-level keys (before any setting)
    if (!currentSetting && indent < 8) {
      if (key === "name" && !key.includes(".")) name = value;
      else if (key === "name.zh" || key === "name.ZH") nameZh = value;
      else if (key === "id") id = value;
      continue;
    }

    if (!currentSetting) continue;

    // Inside options array
    if (inOptions && indent >= 10) {
      if (key === "label") {
        if (lastOption && lastOption.value) {
          currentOptions!.push({ label: value, value: lastOption.value });
          lastOption = null;
        } else {
          lastOption = { label: value };
        }
      } else if (key === "value") {
        if (lastOption && lastOption.label) {
          currentOptions!.push({ label: lastOption.label, value });
          lastOption = null;
        } else {
          lastOption = { value };
        }
      }
      continue;
    }

    // Inside colors object
    if (inColors && indent >= 10) {
      if (key === "light" && currentColors) currentColors.light = value;
      else if (key === "dark" && currentColors) currentColors.dark = value;
      continue;
    }

    // Setting-level keys
    if (indent < 10) {
      inOptions = false;
      inColors = false;
    }

    switch (key) {
      case "id":
        currentSetting.id = value;
        break;
      case "title":
        currentSetting.title = value;
        break;
      case "title.zh":
      case "title.ZH":
        currentSetting.titleZh = value;
        break;
      case "description":
        currentSetting.description = value;
        break;
      case "description.zh":
      case "description.ZH":
        currentSetting.descriptionZh = value;
        break;
      case "type":
        currentSetting.type = value;
        break;
      case "default":
        currentSetting.default = parseDefault(value);
        break;
      case "format":
        currentSetting.format = value;
        break;
      case "opacity":
        currentSetting.opacity = value === "true";
        break;
      case "min":
        currentSetting.min = Number(value);
        break;
      case "max":
        currentSetting.max = Number(value);
        break;
      case "step":
        currentSetting.step = Number(value);
        break;
      case "level":
        currentSetting.level = Number(value);
        break;
      case "collapsed":
        currentSetting.collapsed = value === "true" || value === "ture";
        break;
      case "allowEmpty":
        currentSetting.allowEmpty = value === "true";
        break;
      case "markdown":
        currentSetting.markdown = value === "true";
        break;
      case "options":
        inOptions = true;
        currentOptions = currentOptions || [];
        lastOption = null;
        break;
      case "light":
        inColors = true;
        currentColors = currentColors || { light: value, dark: "" };
        break;
      case "dark":
        if (currentColors) currentColors.dark = value;
        break;
    }
  }

  // Save last setting
  if (currentSetting && currentSetting.id && currentSetting.type) {
    if (currentOptions && currentOptions.length > 0) {
      currentSetting.options = currentOptions;
    }
    if (currentColors) {
      currentSetting.colors = currentColors;
    }
    settings.push(currentSetting as CSSSetting);
  }

  if (!id) return null;
  return { id, name, nameZh, settings };
}

function parseDefault(value: string): any {
  if (value === "true") return true;
  if (value === "false") return false;
  const num = Number(value);
  if (!isNaN(num) && value !== "") return num;
  return value;
}

export class CSSSettingsParser {
  parseCSS(cssText: string): CSSSettingsGroup[] {
    const groups: CSSSettingsGroup[] = [];
    let match: RegExpExecArray | null;

    SETTINGS_REGEX.lastIndex = 0;
    while ((match = SETTINGS_REGEX.exec(cssText)) !== null) {
      const group = parseYAML(match[1]);
      if (group) {
        groups.push(group);
      }
    }
    return groups;
  }
}

export class StyleSettingsManager {
  private plugin: Plugin;
  private parser: CSSSettingsParser;
  private settings: Map<string, any> = new Map();
  private groups: CSSSettingsGroup[] = [];

  constructor(plugin: Plugin, parser: CSSSettingsParser) {
    this.plugin = plugin;
    this.parser = parser;
  }

  async init() {
    const savedData = (await this.plugin.loadData()) || {};
    for (const [key, value] of Object.entries(savedData)) {
      this.settings.set(key, value);
    }
    await this.parsePluginCSS();
    this.applyAllSettings();
  }

  cleanup() {
    // No dynamic styles to clean up
  }

  getGroups(): CSSSettingsGroup[] {
    return this.groups;
  }

  getSetting(fullKey: string): any {
    return this.settings.get(fullKey);
  }

  async updateSetting(groupId: string, settingId: string, value: any) {
    const fullKey = `${groupId}@@${settingId}`;
    this.settings.set(fullKey, value);
    await this.saveData();
    this.applySetting(groupId, settingId, value);
  }

  private async parsePluginCSS() {
    try {
      const adapter = (this.plugin.app as any).vault?.adapter;
      if (adapter) {
        const pluginDir = (this.plugin as any).manifest?.dir || "";
        const cssPath = `${pluginDir}/styles.css`;
        const cssText = await adapter.read(cssPath);
        this.groups = this.parser.parseCSS(cssText);
      }
    } catch {
      try {
        const pluginDir = (this.plugin as any).manifest?.dir || "";
        const resp = await fetch(`${pluginDir}/styles.css`);
        const cssText = await resp.text();
        this.groups = this.parser.parseCSS(cssText);
      } catch {
        console.warn("ZENdian: Could not parse CSS @settings blocks");
      }
    }
  }

  private applyAllSettings() {
    for (const group of this.groups) {
      for (const setting of group.settings) {
        const fullKey = `${group.id}@@${setting.id}`;
        if (this.settings.has(fullKey)) {
          this.applySetting(group.id, setting.id, this.settings.get(fullKey));
        } else if (setting.default !== undefined) {
          this.applySetting(group.id, setting.id, setting.default);
        }
      }
    }
  }

  private applySetting(_groupId: string, settingId: string, value: any) {
    const setting = this.findSetting(settingId);
    if (!setting) return;

    switch (setting.type) {
      case "class-toggle":
        if (value) {
          document.body.classList.add(settingId);
        } else {
          document.body.classList.remove(settingId);
        }
        break;

      case "class-select":
        if (value && typeof value === "string") {
          // Remove sibling class-select values from the same group
          const group = this.groups.find((g) =>
            g.settings.some((s) => s.id === settingId)
          );
          if (group) {
            for (const s of group.settings) {
              if (s.type === "class-select" && s.id !== settingId && s.options) {
                for (const opt of s.options) {
                  if (opt.value !== value) {
                    document.body.classList.remove(opt.value);
                  }
                }
              }
            }
          }
          document.body.classList.add(value);
        }
        break;

      case "variable-number":
      case "variable-text":
        document.documentElement.style.setProperty(
          `--${settingId}`,
          String(value)
        );
        break;

      case "variable-color":
        document.documentElement.style.setProperty(
          `--${settingId}`,
          String(value)
        );
        break;

      case "variable-themed-color":
        // For themed colors, the setting stores { light, dark }
        // or a single value applied to both
        if (typeof value === "object" && value !== null) {
          if (value.light) {
            document.documentElement.style.setProperty(
              `--${settingId}-light`,
              value.light
            );
          }
          if (value.dark) {
            document.documentElement.style.setProperty(
              `--${settingId}-dark`,
              value.dark
            );
          }
        } else {
          document.documentElement.style.setProperty(
            `--${settingId}`,
            String(value)
          );
        }
        break;
    }
  }

  private findSetting(settingId: string): CSSSetting | undefined {
    for (const group of this.groups) {
      const found = group.settings.find((s) => s.id === settingId);
      if (found) return found;
    }
    return undefined;
  }

  private async saveData() {
    const data: Record<string, any> = {};
    for (const [key, value] of this.settings) {
      data[key] = value;
    }
    await this.plugin.saveData(data);
  }
}
