/**
 * 复选框模块
 * 为复选框添加多彩样式
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { ClassTracker } from "../utils/dom";

export class CheckboxModule implements IFeatureModule {
  readonly id = "checkbox";
  readonly name = "复选框";

  private classes = new ClassTracker(document.body);

  async load(ctx: ModuleContext): Promise<void> {
    this.apply(ctx.getSettings().checkbox);
  }

  unload(): void {
    this.classes.cleanup();
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("checkbox")) {
      this.apply(settings.checkbox);
    }
  }

  private apply(settings: PluginSettings["checkbox"]): void {
    this.classes.toggle("colorful-checkbox", settings.colorful);
  }
}
