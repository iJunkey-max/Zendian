/**
 * UI 细节模块
 * 设置图标、动效移除、动效速度
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { ClassTracker, setCSSVar, removeCSSVar } from "../utils/dom";

export class UIDetailModule implements IFeatureModule {
  readonly id = "ui-detail";
  readonly name = "UI 细节";

  private classes = new ClassTracker(document.body);

  async load(ctx: ModuleContext): Promise<void> {
    this.apply(ctx.getSettings().uiDetail);
  }

  unload(): void {
    this.classes.cleanup();
    removeCSSVar(document.body, "--anim-speed");
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("uiDetail")) {
      this.apply(settings.uiDetail);
    }
  }

  private apply(s: PluginSettings["uiDetail"]): void {
    this.classes.toggle("setting-item-title-icon-remove", s.settingItemTitleIconRemove);
    this.classes.toggle("extra-anim-remove", s.extraAnimRemove);
    setCSSVar(document.body, "--anim-speed", String(s.animSpeed));
  }
}
