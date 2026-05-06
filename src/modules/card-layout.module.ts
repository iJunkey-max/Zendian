/**
 * 卡片布局模块
 * 将笔记内容区域显示为圆角卡片样式
 *
 * 迁移自旧版 css-processor.ts 的 cardLayout 相关设置
 * 遵循三大规范：DOM 闭环清理、事件规范化、样式隔离
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { ClassTracker, setCSSVar, removeCSSVar } from "../utils/dom";

/** canvas-card-menu 的可选 class 值 */
const MENU_CLASSES = ["canvas-card-menu-center", "canvas-card-menu-left", "canvas-card-menu-right"];

export class CardLayoutModule implements IFeatureModule {
  readonly id = "card-layout";
  readonly name = "卡片布局";

  private ctx!: ModuleContext;
  private classes: ClassTracker;

  constructor() {
    this.classes = new ClassTracker(document.body);
  }

  async load(ctx: ModuleContext): Promise<void> {
    this.ctx = ctx;
    this.applyAll(ctx.getSettings().cardLayout);
  }

  unload(): void {
    // 1. 清理所有跟踪的 class
    this.classes.cleanup();

    // 2. 清理 CSS 自定义属性
    removeCSSVar(document.body, "--canvas-card-border-width");
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("cardLayout")) {
      this.applyAll(settings.cardLayout);
    }
  }

  private applyAll(settings: PluginSettings["cardLayout"]): void {
    // 1. card-layout-open: class-toggle with classAliases
    //    启用时同时添加 light/dark 两个 class，CSS 根据当前主题自动选择
    this.classes.toggle("card-layout-open-light", settings.enabled);
    this.classes.toggle("card-layout-open-dark", settings.enabled);

    // 2. canvas-card-border-width: variable-text
    //    设置 CSS 变量 --canvas-card-border-width
    setCSSVar(document.body, "--canvas-card-border-width", settings.canvasBorder);

    // 3. canvas-card-menu: class-select
    //    移除所有候选 class，添加当前选中的
    for (const cls of MENU_CLASSES) {
      this.classes.remove(cls);
    }
    const menuClass = `canvas-card-menu-${settings.canvasMenu}`;
    if (MENU_CLASSES.includes(menuClass)) {
      this.classes.add(menuClass);
    }

    // 4. media-embed-card-border-off: class-toggle
    this.classes.toggle("media-embed-card-border-off", settings.mediaEmbedBorderOff);
  }
}
