/**
 * 引用块模块
 * 自定义引用块的背景颜色（亮色/暗色模式）
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { setCSSVar, removeCSSVar } from "../utils/dom";

export class BlockquoteModule implements IFeatureModule {
  readonly id = "blockquote";
  readonly name = "引用块";

  async load(ctx: ModuleContext): Promise<void> {
    this.apply(ctx.getSettings().blockquote);
  }

  unload(): void {
    removeCSSVar(document.body, "--blockquote-background-light");
    removeCSSVar(document.body, "--blockquote-background-dark");
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("blockquote")) {
      this.apply(settings.blockquote);
    }
  }

  private apply(settings: PluginSettings["blockquote"]): void {
    setCSSVar(document.body, "--blockquote-background-light", settings.backgroundLight);
    setCSSVar(document.body, "--blockquote-background-dark", settings.backgroundDark);
  }
}
