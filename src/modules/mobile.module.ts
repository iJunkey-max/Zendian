/**
 * 移动端模块
 * 平板卡片布局、手机端侧边栏全屏
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { ClassTracker } from "../utils/dom";

export class MobileModule implements IFeatureModule {
  readonly id = "mobile";
  readonly name = "移动端";

  private classes = new ClassTracker(document.body);

  async load(ctx: ModuleContext): Promise<void> {
    this.apply(ctx.getSettings().mobile);
  }

  unload(): void {
    this.classes.cleanup();
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("mobile")) {
      this.apply(settings.mobile);
    }
  }

  private apply(s: PluginSettings["mobile"]): void {
    this.classes.toggle("card-layout-pad-open", s.cardLayoutPad);
    this.classes.toggle("drawer-phone-full-width", s.drawerPhoneFullWidth);
  }
}
