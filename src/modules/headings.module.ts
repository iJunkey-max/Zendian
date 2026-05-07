/**
 * 标题样式模块
 * H1-H6 独立设置：分隔线、字体、字重、颜色、间距
 * inlineTitle、collapseIcon、indicator 全局控制
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings, HeadingSettings } from "../types/settings.types";
import { ClassTracker, setCSSVar, removeCSSVar } from "../utils/dom";

type Level = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

const LEVELS: Level[] = ["h1", "h2", "h3", "h4", "h5", "h6"];

/** 每个级别需要管理的 class-select 候选 class */
const COLOR_CLASSES: Record<Level, string[]> = {
  h1: ["h1-color-default", "h1-color-designated"],
  h2: ["h2-color-default", "h2-color-designated"],
  h3: ["h3-color-default", "h3-color-designated"],
  h4: ["h4-color-default", "h4-color-designated"],
  h5: ["h5-color-default", "h5-color-designated"],
  h6: ["h6-color-default", "h6-color-designated"],
};

/** H2 样式 class 候选 */
const H2_STYLE_CLASSES = ["h2-style-twin", "h2-style-capsule", "h2-style-dark-twin", "h2-style-dark-capsule"];

/** 每个级别的对齐 class */
const ALIGN_CLASSES: Record<Level, string[]> = {
  h1: ["h1-align-left", "h1-align-center", "h1-align-right"],
  h2: ["h2-align-left", "h2-align-center", "h2-align-right"],
  h3: ["h3-align-left", "h3-align-center", "h3-align-right"],
  h4: ["h4-align-left", "h4-align-center", "h4-align-right"],
  h5: ["h5-align-left", "h5-align-center", "h5-align-right"],
  h6: ["h6-align-left", "h6-align-center", "h6-align-right"],
};

export class HeadingsModule implements IFeatureModule {
  readonly id = "headings";
  readonly name = "标题样式";

  private classes = new ClassTracker(document.body);

  async load(ctx: ModuleContext): Promise<void> {
    this.apply(ctx.getSettings().headings);
  }

  unload(): void {
    this.classes.cleanup();
    for (const lv of LEVELS) {
      removeCSSVar(document.body, `--${lv}-weight`);
      removeCSSVar(document.body, `--${lv}-text-transform`);
      removeCSSVar(document.body, `--${lv}-spacing-scale-start`);
      removeCSSVar(document.body, `--${lv}-spacing-scale-end`);
      removeCSSVar(document.body, `--${lv}-size`);
    }
    removeCSSVar(document.body, "--inline-title-size");
    removeCSSVar(document.body, "--inline-title-weight");
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("headings")) {
      this.apply(settings.headings);
    }
  }

  private apply(s: HeadingSettings): void {
    // 全局控制
    this.classes.toggle("collapse-icon-restore", s.collapseIconRestore);
    this.classes.toggle("heading-indicator-off", s.indicatorOff);

    // inlineTitle
    this.classes.toggle("inline-title-divider-remove", s.inlineTitle.dividerRemove);
    setCSSVar(document.body, "--inline-title-size", s.inlineTitle.size);
    setCSSVar(document.body, "--inline-title-weight", String(s.inlineTitle.weight));

    // H1-H6 通用设置
    for (const lv of LEVELS) {
      const h = s[lv] as any;
      this.classes.toggle(`${lv}-divider-on`, h.divider);
      setCSSVar(document.body, `--${lv}-weight`, String(h.weight));
      setCSSVar(document.body, `--${lv}-text-transform`, h.textTransform || "");
      setCSSVar(document.body, `--${lv}-spacing-scale-start`, String(h.spacingStart));
      setCSSVar(document.body, `--${lv}-spacing-scale-end`, String(h.spacingEnd));
      setCSSVar(document.body, `--${lv}-size`, String(h.size));

      // alignment: class-select
      for (const cls of ALIGN_CLASSES[lv]) this.classes.remove(cls);
      this.classes.add(`${lv}-align-${h.alignment || "left"}`);

      // color-select: class-select
      for (const cls of COLOR_CLASSES[lv]) this.classes.remove(cls);
      this.classes.add(`${lv}-color-${h.colorScheme === "accent" ? "designated" : "default"}`);
    }

    // H2 style: class-select (统一控制亮色+暗色)
    for (const cls of H2_STYLE_CLASSES) this.classes.remove(cls);
    const h2style = s.h2.style || "twin";
    this.classes.add(h2style === "capsule" ? "h2-style-capsule" : "h2-style-twin");
    this.classes.add(h2style === "capsule" ? "h2-style-dark-capsule" : "h2-style-dark-twin");
  }
}
