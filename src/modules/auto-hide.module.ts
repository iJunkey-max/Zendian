/**
 * 自动隐藏模块
 * 控制 Tab 栏、状态栏、功能区等 UI 元素的自动隐藏
 *
 * 实现模式示例 — 所有模块应遵循此结构
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";

/** CSS class 与设置键的映射 */
const CLASS_MAP: Array<[keyof PluginSettings["autoHide"], string]> = [
  ["tab", "tab-autohide"],
  ["statusBar", "status-bar-autohide"],
  ["ribbon", "Ribbon-autohide"],
  ["navHeader", "nav-header-autohide"],
  ["tabBar", "tab-title-bar-autohide"],
  ["vaultProfile", "vault-profile-autohide"],
];

export class AutoHideModule implements IFeatureModule {
  readonly id = "auto-hide";
  readonly name = "自动隐藏";

  private ctx!: ModuleContext;
  private appliedClasses = new Set<string>();

  async load(ctx: ModuleContext): Promise<void> {
    this.ctx = ctx;
    this.applyAll(ctx.getSettings().autoHide);
  }

  unload(): void {
    for (const cls of this.appliedClasses) {
      document.body.classList.remove(cls);
    }
    this.appliedClasses.clear();
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    // 只在相关设置变更时响应
    if (changedKeys.includes("autoHide")) {
      this.applyAll(settings.autoHide);
    }
  }

  private applyAll(settings: PluginSettings["autoHide"]): void {
    for (const [key, cls] of CLASS_MAP) {
      this.setClass(cls, settings[key]);
    }
  }

  private setClass(cls: string, enabled: boolean): void {
    this.appliedClasses.add(cls);
    if (enabled) {
      document.body.classList.add(cls);
    } else {
      document.body.classList.remove(cls);
    }
  }
}
