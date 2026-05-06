/**
 * 大纲增强模块
 * 启用增强的大纲样式
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { ClassTracker } from "../utils/dom";

export class OutlineModule implements IFeatureModule {
  readonly id = "outline";
  readonly name = "大纲增强";

  private classes = new ClassTracker(document.body);

  async load(ctx: ModuleContext): Promise<void> {
    this.apply(ctx.getSettings().outline);
  }

  unload(): void {
    this.classes.cleanup();
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("outline")) {
      this.apply(settings.outline);
    }
  }

  private apply(settings: PluginSettings["outline"]): void {
    this.classes.toggle("outline-enhanced", settings.enhanced);
  }
}
