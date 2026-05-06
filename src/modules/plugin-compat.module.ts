/**
 * 第三方插件兼容模块
 * DB Folder、Projects、Surfing 等插件的样式适配
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { ClassTracker } from "../utils/dom";

const DB_BG_CLASSES = [
  "DB-table-bg-color-default",
  "DB-table-bg-color-adapt",
  "DB-table-bg-color-unify",
];

const PROJECTS_BG_CLASSES = [
  "Projects-bg-color-default",
  "Projects-bg-color-adapt",
  "Projects-bg-color-unify",
];

export class PluginCompatModule implements IFeatureModule {
  readonly id = "plugin-compat";
  readonly name = "第三方插件兼容";

  private classes = new ClassTracker(document.body);

  async load(ctx: ModuleContext): Promise<void> {
    this.apply(ctx.getSettings().pluginCompat);
  }

  unload(): void {
    this.classes.cleanup();
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("pluginCompat")) {
      this.apply(settings.pluginCompat);
    }
  }

  private apply(s: PluginSettings["pluginCompat"]): void {
    this.classes.toggle("DB-table-full-width-off", s.dbTableFullWidthOff);
    this.classes.toggle("Surfing-bookmark-bar-hide", s.surfingBookmarkBarHide);

    // DB-table-bg-color: class-select
    for (const cls of DB_BG_CLASSES) this.classes.remove(cls);
    this.classes.add(`DB-table-bg-color-${s.dbTableBgColor}`);

    // Projects-bg-color: class-select
    for (const cls of PROJECTS_BG_CLASSES) this.classes.remove(cls);
    this.classes.add(`Projects-bg-color-${s.projectsBgColor}`);
  }
}
