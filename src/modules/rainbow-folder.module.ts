/**
 * 文件夹层级遮罩模块
 * 基于主题色，按层级递增遮罩深度
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { ClassTracker, setCSSVar, removeCSSVar } from "../utils/dom";

const LEVEL_COUNT = 8;

/** 读取主题色并转为 rgba */
function getAccentRGBA(opacity: number): string {
  const temp = document.createElement("div");
  temp.style.color = "var(--interactive-accent)";
  temp.style.display = "none";
  document.body.appendChild(temp);
  const computed = getComputedStyle(temp).color;
  document.body.removeChild(temp);
  const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${opacity})`;
  }
  return `rgba(100, 100, 200, ${opacity})`;
}

export class RainbowFolderModule implements IFeatureModule {
  readonly id = "rainbow-folder";
  readonly name = "文件夹层级遮罩";

  private classes = new ClassTracker(document.body);

  async load(ctx: ModuleContext): Promise<void> {
    this.apply(ctx.getSettings().rainbowFolder);
  }

  unload(): void {
    this.classes.cleanup();
    for (let i = 1; i <= LEVEL_COUNT; i++) {
      removeCSSVar(document.body, `--rainbow-folder-bg-${i}`);
    }
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("rainbowFolder")) {
      this.apply(settings.rainbowFolder);
    }
  }

  private apply(s: PluginSettings["rainbowFolder"]): void {
    this.classes.toggle("rainbow-folder", s.enabled);

    for (let i = 1; i <= LEVEL_COUNT; i++) {
      const levelOpacity = (i / LEVEL_COUNT) * s.opacity;
      setCSSVar(document.body, `--rainbow-folder-bg-${i}`, getAccentRGBA(levelOpacity));
    }
  }
}
