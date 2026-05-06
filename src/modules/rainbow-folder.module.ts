/**
 * 彩虹文件夹模块
 * 8 色循环 + 图标大小 + 背景透明度
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { ClassTracker, setCSSVar, removeCSSVar } from "../utils/dom";

const COLOR_COUNT = 8;

export class RainbowFolderModule implements IFeatureModule {
  readonly id = "rainbow-folder";
  readonly name = "彩虹文件夹";

  private classes = new ClassTracker(document.body);

  async load(ctx: ModuleContext): Promise<void> {
    this.apply(ctx.getSettings().rainbowFolder);
  }

  unload(): void {
    this.classes.cleanup();
    for (let i = 1; i <= COLOR_COUNT; i++) {
      removeCSSVar(document.body, `--rainbow-folder-color-${i}`);
    }
    removeCSSVar(document.body, "--rainbow-folder-icon-size");
    removeCSSVar(document.body, "--rainbow-folder-opacity");
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("rainbowFolder")) {
      this.apply(settings.rainbowFolder);
    }
  }

  private apply(s: PluginSettings["rainbowFolder"]): void {
    this.classes.toggle("rainbow-folder", s.enabled);

    for (let i = 0; i < COLOR_COUNT; i++) {
      setCSSVar(document.body, `--rainbow-folder-color-${i + 1}`, s.colors[i]);
    }

    setCSSVar(document.body, "--rainbow-folder-icon-size", `${s.iconSize}px`);
    setCSSVar(document.body, "--rainbow-folder-opacity", String(s.opacity));
  }
}
