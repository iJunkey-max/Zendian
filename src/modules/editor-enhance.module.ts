/**
 * 编辑器增强模块
 * 专注模式、焦点指示器、网格背景
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { ClassTracker, setCSSVar, removeCSSVar } from "../utils/dom";

export class EditorEnhanceModule implements IFeatureModule {
  readonly id = "editor-enhance";
  readonly name = "编辑器增强";

  private classes = new ClassTracker(document.body);

  async load(ctx: ModuleContext): Promise<void> {
    this.apply(ctx.getSettings().editorEnhance);
  }

  unload(): void {
    this.classes.cleanup();
    removeCSSVar(document.body, "--line-normal-opacity");
    removeCSSVar(document.body, "--grid-background-pattern-size");
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("editorEnhance")) {
      this.apply(settings.editorEnhance);
    }
  }

  private apply(s: PluginSettings["editorEnhance"]): void {
    this.classes.toggle("border-focus-mode", s.focusMode);
    this.classes.toggle("line-hover-indicator", s.hoverIndicator);
    this.classes.toggle("focus-indicator-list-level", s.hoverIndicatorListLevel);
    this.classes.toggle("focus-indicator-codeblock-line-number", s.hoverIndicatorCodeblockLineNumber);
    this.classes.toggle("editor-grid-background-pattren", s.gridBackground);

    setCSSVar(document.body, "--line-normal-opacity", String(s.focusModeOpacity));
    setCSSVar(document.body, "--grid-background-pattern-size", s.gridBackgroundSize);
  }
}
