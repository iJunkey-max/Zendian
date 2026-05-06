/**
 * 嵌入文档模块
 * 无缝嵌入、内边距、圆角、字体、最大高度
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { ClassTracker, setCSSVar, removeCSSVar } from "../utils/dom";

const CSS_VARS = [
  "--embed-padding",
  "--embed-border-radius",
  "--embed-font-style",
  "--embed-max-height",
];

export class EmbedModule implements IFeatureModule {
  readonly id = "embed";
  readonly name = "嵌入文档";

  private classes = new ClassTracker(document.body);

  async load(ctx: ModuleContext): Promise<void> {
    this.apply(ctx.getSettings().embed);
  }

  unload(): void {
    this.classes.cleanup();
    for (const v of CSS_VARS) removeCSSVar(document.body, v);
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("embed")) {
      this.apply(settings.embed);
    }
  }

  private apply(s: PluginSettings["embed"]): void {
    this.classes.toggle("seamless-embeds", s.seamless);
    setCSSVar(document.body, "--embed-padding", s.padding);
    setCSSVar(document.body, "--embed-border-radius", s.borderRadius);
    setCSSVar(document.body, "--embed-font-style", s.fontStyle);
    setCSSVar(document.body, "--embed-max-height", s.maxHeight);
  }
}
