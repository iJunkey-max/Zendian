/**
 * 代码块模块
 * 主题选择、背景和边框自定义
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { ClassTracker, setCSSVar, removeCSSVar } from "../utils/dom";

const THEME_CLASSES = [
  "codeblock-style-customize",
  "codeblock-style-dracula",
  "codeblock-style-solarized-light",
  "codeblock-style-solarized-dark",
  "codeblock-style-one-dark",
];

const CSS_VARS = [
  "--code-background-light",
  "--code-background-dark",
  "--code-border-light",
  "--code-border-dark",
];

export class CodeBlockModule implements IFeatureModule {
  readonly id = "code-block";
  readonly name = "代码块";

  private classes = new ClassTracker(document.body);

  async load(ctx: ModuleContext): Promise<void> {
    this.apply(ctx.getSettings().codeBlock);
  }

  unload(): void {
    this.classes.cleanup();
    for (const v of CSS_VARS) removeCSSVar(document.body, v);
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("codeBlock")) {
      this.apply(settings.codeBlock);
    }
  }

  private apply(s: PluginSettings["codeBlock"]): void {
    // class-select: 移除所有候选，添加当前选中
    for (const cls of THEME_CLASSES) this.classes.remove(cls);
    this.classes.add(`codeblock-style-${s.theme}`);

    setCSSVar(document.body, "--code-background-light", s.backgroundLight);
    setCSSVar(document.body, "--code-background-dark", s.backgroundDark);
    setCSSVar(document.body, "--code-border-light", s.borderLight);
    setCSSVar(document.body, "--code-border-dark", s.borderDark);
  }
}
