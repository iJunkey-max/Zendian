/**
 * 滚动条模块
 * 控制滚动条的显示与样式
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { ClassTracker } from "../utils/dom";

export class ScrollbarModule implements IFeatureModule {
  readonly id = "scrollbar";
  readonly name = "滚动条";

  private classes = new ClassTracker(document.body);

  async load(ctx: ModuleContext): Promise<void> {
    this.apply(ctx.getSettings().scrollbar);
  }

  unload(): void {
    this.classes.cleanup();
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("scrollbar")) {
      this.apply(settings.scrollbar);
    }
  }

  private apply(settings: PluginSettings["scrollbar"]): void {
    this.classes.toggle("scrollbar-hide", settings.hide);
    this.classes.toggle("restored-scrollbars", settings.restored);
  }
}
