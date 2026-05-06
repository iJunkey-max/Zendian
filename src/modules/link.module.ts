/**
 * 链接模块
 * 装饰样式、悬停效果、外部链接滤镜
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { setCSSVar, removeCSSVar } from "../utils/dom";

const CSS_VARS = [
  "--link-decoration",
  "--link-decoration-hover",
  "--link-decoration-thickness",
  "--link-external-decoration",
  "--link-external-decoration-hover",
  "--link-external-filter",
];

export class LinkModule implements IFeatureModule {
  readonly id = "link";
  readonly name = "链接";

  async load(ctx: ModuleContext): Promise<void> {
    this.apply(ctx.getSettings().link);
  }

  unload(): void {
    for (const v of CSS_VARS) removeCSSVar(document.body, v);
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("link")) {
      this.apply(settings.link);
    }
  }

  private apply(s: PluginSettings["link"]): void {
    setCSSVar(document.body, "--link-decoration", s.decoration);
    setCSSVar(document.body, "--link-decoration-hover", s.decorationHover);
    setCSSVar(document.body, "--link-decoration-thickness", s.decorationThickness);
    setCSSVar(document.body, "--link-external-decoration", s.externalDecoration);
    setCSSVar(document.body, "--link-external-decoration-hover", s.externalDecorationHover);
    setCSSVar(document.body, "--link-external-filter", s.externalFilter);
  }
}
