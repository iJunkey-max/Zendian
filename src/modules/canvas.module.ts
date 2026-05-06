/**
 * 画布沉浸模块
 * 移除白板的边框和阴影，使其与背景融为一体
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { ClassTracker } from "../utils/dom";

export class CanvasModule implements IFeatureModule {
  readonly id = "canvas";
  readonly name = "画布沉浸";

  private classes = new ClassTracker(document.body);

  async load(ctx: ModuleContext): Promise<void> {
    this.apply(ctx.getSettings().canvas);
  }

  unload(): void {
    this.classes.cleanup();
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("canvas")) {
      this.apply(settings.canvas);
    }
  }

  private apply(settings: PluginSettings["canvas"]): void {
    this.classes.toggle("immersive-canvas", settings.immersive);
  }
}
