/**
 * 新标签页模块
 * 按钮样式、图像样式、自定义图像 URL
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { ClassTracker, setCSSVar, removeCSSVar } from "../utils/dom";

const BTN_CLASSES = ["new-tab-text-btn-restore", "new-tab-btn-default"];
const IMG_CLASSES = ["new-tab-image-none", "new-tab-image-default", "new-tab-image-old", "new-tab-image-customize"];

export class NewTabModule implements IFeatureModule {
  readonly id = "new-tab";
  readonly name = "新标签页";

  private classes = new ClassTracker(document.body);

  async load(ctx: ModuleContext): Promise<void> {
    this.apply(ctx.getSettings().newTab);
  }

  unload(): void {
    this.classes.cleanup();
    removeCSSVar(document.body, "--new-tab-image");
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("newTab")) {
      this.apply(settings.newTab);
    }
  }

  private apply(s: PluginSettings["newTab"]): void {
    // buttonStyle: class-select
    for (const cls of BTN_CLASSES) this.classes.remove(cls);
    this.classes.add(`new-tab-${s.buttonStyle === "text-btn-restore" ? "text-btn-restore" : "btn-default"}`);

    // imageStyle: class-select
    for (const cls of IMG_CLASSES) this.classes.remove(cls);
    this.classes.add(`new-tab-image-${s.imageStyle}`);

    // imageUrl: variable-text (only applied when imageStyle is "customize")
    if (s.imageStyle === "customize") {
      setCSSVar(document.body, "--new-tab-image", s.imageUrl);
    } else {
      removeCSSVar(document.body, "--new-tab-image");
    }
  }
}
