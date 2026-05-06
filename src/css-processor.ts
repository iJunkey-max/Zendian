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
  levels?: string;
  classAliases?: string;
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
  let inOptions = false;
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
        settings.push(currentSetting as CSSSetting);
      }
      currentSetting = {};
      currentOptions = null;
      lastOption = null;
      inOptions = false;

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

    // Setting-level keys
    if (indent < 10) {
      inOptions = false;
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
      case "levels":
        currentSetting.levels = value;
        break;
      case "classAliases":
        currentSetting.classAliases = value;
        break;
      case "options":
        inOptions = true;
        currentOptions = currentOptions || [];
        lastOption = null;
        break;
    }
  }

  // Save last setting
  if (currentSetting && currentSetting.id && currentSetting.type) {
    if (currentOptions && currentOptions.length > 0) {
      currentSetting.options = currentOptions;
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
  private themeObserver: MutationObserver | null = null;
  private appliedProperties: Set<string> = new Set();
  private appliedClasses: Set<string> = new Set();

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
    this.observeThemeChange();
    // 延迟同步强调色，确保 Obsidian 主题 CSS 已加载
    this.syncAccentColorWithRetry();

    // DEBUG: 检查文件资源管理器 DOM 结构
    const explorer = document.querySelector('.workspace-leaf-content[data-type="file-explorer"]');
    if (explorer) {
      const folderTitles = explorer.querySelectorAll('.nav-folder-title');
      console.log("[ZENdian] folder titles found:", folderTitles.length);
      if (folderTitles.length > 0) {
        const first = folderTitles[0];
        console.log("[ZENdian] first title tag:", first.tagName, "classes:", first.className);
        console.log("[ZENdian] first title parent:", first.parentElement?.tagName, first.parentElement?.className);
        console.log("[ZENdian] first title grandparent:", first.parentElement?.parentElement?.tagName, first.parentElement?.parentElement?.className);
        // 尝试直接设置背景
        (first as HTMLElement).style.background = "lime";
        console.log("[ZENdian] forced lime on first .nav-folder-title");
      }
    } else {
      console.log("[ZENdian] NO file explorer found");
    }
  }

  cleanup() {
    // 清除所有应用到 body 的 CSS 属性和类名，防止重复加载时叠加
    for (const prop of this.appliedProperties) {
      document.body.style.removeProperty(prop);
    }
    for (const cls of this.appliedClasses) {
      document.body.classList.remove(cls);
    }
    this.appliedProperties.clear();
    this.appliedClasses.clear();

    if (this.themeObserver) {
      this.themeObserver.disconnect();
      this.themeObserver = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.mediaQuery) {
      this.mediaQuery.removeEventListener("change", this.onThemeChange);
      this.mediaQuery = null;
    }
  }

  private accentSynced = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  syncAccentColor() {
    try {
      const el = document.createElement("span");
      el.style.color = "var(--interactive-accent)";
      el.style.position = "absolute";
      el.style.visibility = "hidden";
      document.body.appendChild(el);
      const computed = getComputedStyle(el).color;
      document.body.removeChild(el);

      const rgbMatch = computed.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (!rgbMatch) return false;

      const r = parseInt(rgbMatch[1]) / 255;
      const g = parseInt(rgbMatch[2]) / 255;
      const b = parseInt(rgbMatch[3]) / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 2;

      const accentProps = ["--accent-h", "--accent-s", "--accent-l"];
      accentProps.forEach(p => this.appliedProperties.add(p));

      if (max === min) {
        document.body.style.setProperty("--accent-h", "0");
        document.body.style.setProperty("--accent-s", "0%");
        document.body.style.setProperty("--accent-l", `${Math.round(l * 100)}%`);
        this.accentSynced = true;
        return true;
      }

      const d = max - min;
      const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      let h = 0;
      if (max === r) {
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      } else if (max === g) {
        h = ((b - r) / d + 2) / 6;
      } else {
        h = ((r - g) / d + 4) / 6;
      }

      document.body.style.setProperty("--accent-h", String(Math.round(h * 360)));
      document.body.style.setProperty("--accent-s", `${Math.round(s * 100)}%`);
      document.body.style.setProperty("--accent-l", `${Math.round(l * 100)}%`);
      this.accentSynced = true;
      return true;
    } catch {
      return false;
    }
  }

  private syncAccentColorWithRetry(maxRetries = 10, delay = 500) {
    if (this.syncAccentColor()) return;

    let retries = 0;
    const trySync = () => {
      retries++;
      if (this.syncAccentColor() || retries >= maxRetries) {
        this.retryTimer = null;
        return;
      }
      this.retryTimer = setTimeout(trySync, delay);
    };
    this.retryTimer = setTimeout(trySync, delay);
  }

  private mediaQuery: MediaQueryList | null = null;
  private onThemeChange = () => {
    this.syncAccentColor();
  };

  private observeThemeChange() {
    // 监听 body class 变化（主题切换、自定义主题色等）
    this.themeObserver = new MutationObserver(() => {
      this.syncAccentColor();
    });
    this.themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // 监听系统深色/浅色模式切换
    this.mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    this.mediaQuery.addEventListener("change", this.onThemeChange);
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

  private applySetting(groupId: string, settingId: string, value: any) {
    const setting = this.findSetting(settingId, groupId);
    if (!setting) return;

    switch (setting.type) {
      case "class-toggle": {
        const classes = [settingId];
        if (setting.classAliases) {
          classes.push(...setting.classAliases.split(",").map(s => s.trim()));
        }
        for (const cls of classes) {
          this.appliedClasses.add(cls);
          if (value) {
            document.body.classList.add(cls);
          } else {
            document.body.classList.remove(cls);
          }
        }
        break;
      }

      case "class-select":
        if (value && typeof value === "string") {
          // Remove sibling class-select values from the same group
          const group = this.groups.find((g) => g.id === groupId);
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
          this.appliedClasses.add(value);
          document.body.classList.add(value);
        }
        break;

      case "variable-number": {
        const prop = `--${settingId}`;
        const numVal = setting.format ? `${value}${setting.format}` : String(value);
        this.appliedProperties.add(prop);
        document.body.style.setProperty(prop, numVal);
        break;
      }

      case "variable-text": {
        const prop = `--${settingId}`;
        this.appliedProperties.add(prop);
        document.body.style.setProperty(prop, String(value));
        break;
      }

    }
  }

  private findSetting(settingId: string, groupId?: string): CSSSetting | undefined {
    if (groupId) {
      const group = this.groups.find((g) => g.id === groupId);
      if (group) {
        const found = group.settings.find((s) => s.id === settingId);
        if (found) return found;
      }
    }
    for (const group of this.groups) {
      const found = group.settings.find((s) => s.id === settingId);
      if (found) return found;
    }
    return undefined;
  }

  findSettingById(settingId: string, groupId?: string): { group: CSSSettingsGroup; setting: CSSSetting } | null {
    if (groupId) {
      const group = this.groups.find((g) => g.id === groupId);
      if (group) {
        const setting = group.settings.find((s) => s.id === settingId);
        if (setting) return { group, setting };
      }
    }
    for (const group of this.groups) {
      const setting = group.settings.find((s) => s.id === settingId);
      if (setting) return { group, setting };
    }
    return null;
  }

  private async saveData() {
    const data: Record<string, any> = {};
    for (const [key, value] of this.settings) {
      data[key] = value;
    }
    await this.plugin.saveData(data);
  }
}
