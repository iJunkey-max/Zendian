/**
 * ZENdian Plugin
 *
 * Contains code derived from:
 * - obsidian-border by Akifyss (MIT License)
 * - obsidian-style-settings by mgmeyers (MIT License)
 * - Phycat theme CSS
 *
 * Original authors retain copyright of their contributions.
 */

import { Plugin } from "obsidian";
import { CSSSettingsParser, StyleSettingsManager } from "./css-processor";
import { ZENdianSettingTab } from "./settings-tab";

export default class ZENdianPlugin extends Plugin {
  settingsManager: StyleSettingsManager;

  async onload() {
    const parser = new CSSSettingsParser();
    this.settingsManager = new StyleSettingsManager(this, parser);
    await this.settingsManager.init();

    this.addSettingTab(new ZENdianSettingTab(this.app, this, this.settingsManager));
  }

  onunload() {
    this.settingsManager.cleanup();
  }
}
