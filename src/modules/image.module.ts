/**
 * 图片模块
 * 控制图片的对齐、暗化和缩放行为
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { ClassTracker } from "../utils/dom";

export class ImageModule implements IFeatureModule {
  readonly id = "image";
  readonly name = "图片";

  private classes = new ClassTracker(document.body);

  async load(ctx: ModuleContext): Promise<void> {
    this.apply(ctx.getSettings().image);
  }

  unload(): void {
    this.classes.cleanup();
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("image")) {
      this.apply(settings.image);
    }
  }

  private apply(settings: PluginSettings["image"]): void {
    this.classes.toggle("img-center-align", settings.centerAlign);
    this.classes.toggle("img-darken", settings.darken);
    this.classes.toggle("zoom-off", settings.zoomOff);
  }
}
