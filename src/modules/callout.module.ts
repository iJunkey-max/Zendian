/**
 * 标注模块
 * 风格选择、边框、内边距、圆角
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { ClassTracker, setCSSVar, removeCSSVar } from "../utils/dom";

const STYLE_CLASSES = [
  "callout-style-customize",
  "callout-style-1",
  "callout-style-2",
  "callout-style-3",
  "callout-style-4",
];

const CSS_VARS = [
  "--callout-border-opacity",
];

export class CalloutModule implements IFeatureModule {
  readonly id = "callout";
  readonly name = "标注";

  private classes = new ClassTracker(document.body);

  async load(ctx: ModuleContext): Promise<void> {
    this.apply(ctx.getSettings().callout);
  }

  unload(): void {
    this.classes.cleanup();
    for (const v of CSS_VARS) removeCSSVar(document.body, v);
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("callout")) {
      this.apply(settings.callout);
    }
  }

  private apply(s: PluginSettings["callout"]): void {
    for (const cls of STYLE_CLASSES) this.classes.remove(cls);
    this.classes.add(`callout-style-${s.style}`);
    setCSSVar(document.body, "--callout-border-opacity", String(s.borderOpacity));
  }
}
