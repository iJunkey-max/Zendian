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

/** H1 对齐 */
const H1_ALIGN_CLASSES = ["h1-align-center", "h1-align-left"];

/** H2 风格 */
const H2_LIGHT_CLASSES = ["h2-style-twin", "h2-style-capsule"];
const H2_DARK_CLASSES = ["h2-style-dark-twin", "h2-style-dark-capsule"];

export class HeadingsModule implements IFeatureModule {
  readonly id = "headings";
  readonly name = "标题样式";

  private classes = new ClassTracker(document.body);

  async load(ctx: ModuleContext): Promise<void> {
    this.apply(ctx.getSettings().headings);
  }

  unload(): void {
    this.classes.cleanup();
    // 清理所有 CSS 变量
    for (const lv of LEVELS) {
      removeCSSVar(document.body, `--${lv}-font`);
      removeCSSVar(document.body, `--${lv}-weight`);
      removeCSSVar(document.body, `--${lv}-text-transform`);
      removeCSSVar(document.body, `--${lv}-spacing-scale-start`);
      removeCSSVar(document.body, `--${lv}-spacing-scale-end`);
      removeCSSVar(document.body, `--${lv}-size`);
    }
    removeCSSVar(document.body, "--inline-title-font");
    removeCSSVar(document.body, "--inline-title-size");
    removeCSSVar(document.body, "--inline-title-weight");
    removeCSSVar(document.body, "--inline-title-text-transform");
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
    setCSSVar(document.body, "--inline-title-font", s.inlineTitle.font);
    setCSSVar(document.body, "--inline-title-size", s.inlineTitle.size);
    setCSSVar(document.body, "--inline-title-weight", String(s.inlineTitle.weight));
    setCSSVar(document.body, "--inline-title-text-transform", s.inlineTitle.textTransform);

    // H1-H6 通用设置
    for (const lv of LEVELS) {
      const h = s[lv] as any;
      this.classes.toggle(`${lv}-divider-on`, h.divider);
      setCSSVar(document.body, `--${lv}-font`, h.font);
      setCSSVar(document.body, `--${lv}-weight`, String(h.weight));
      setCSSVar(document.body, `--${lv}-text-transform`, h.textTransform);
      setCSSVar(document.body, `--${lv}-spacing-scale-start`, String(h.spacingStart));
      setCSSVar(document.body, `--${lv}-spacing-scale-end`, String(h.spacingEnd));
      setCSSVar(document.body, `--${lv}-size`, String(h.size));

      // color-select: class-select
      for (const cls of COLOR_CLASSES[lv]) this.classes.remove(cls);
      this.classes.add(`${lv}-color-${h.colorScheme === "accent" ? "designated" : "default"}`);
    }

    // H1 特有：alignment
    for (const cls of H1_ALIGN_CLASSES) this.classes.remove(cls);
    this.classes.add(`h1-align-${s.h1.alignment}`);

    // H2 特有：light/dark 风格
    for (const cls of H2_LIGHT_CLASSES) this.classes.remove(cls);
    this.classes.add(`h2-style-${s.h2.lightStyle}`);

    for (const cls of H2_DARK_CLASSES) this.classes.remove(cls);
    this.classes.add(`h2-style-dark-${s.h2.darkStyle}`);
  }
}
