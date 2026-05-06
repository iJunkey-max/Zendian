/**
 * 模块管理器
 * 负责功能模块的注册、生命周期调度
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import type { EventBus } from "./event-bus";
import { Events } from "./event-bus";

export class ModuleManager {
  private modules = new Map<string, IFeatureModule>();
  private loaded = new Set<string>();
  private ctx: ModuleContext;

  constructor(private events: EventBus, private getSettings: () => PluginSettings) {
    this.ctx = {
      events,
      getSettings,
      getSetting: <K extends keyof PluginSettings>(key: K) => this.getSettings()[key],
    };

    // 监听设置变更，分发给各模块
    this.events.on(Events.SETTINGS_CHANGED, (changedKeys: string[], settings: PluginSettings) => {
      for (const mod of this.loaded) {
        const instance = this.modules.get(mod);
        instance?.onSettingsChanged?.(changedKeys, settings);
      }
    });

    // 监听主题变更
    this.events.on(Events.THEME_CHANGED, (isDark: boolean) => {
      for (const mod of this.loaded) {
        const instance = this.modules.get(mod);
        instance?.onThemeChange?.(isDark);
      }
    });
  }

  /** 注册模块（插件启动时调用） */
  register(module: IFeatureModule): void {
    if (this.modules.has(module.id)) {
      console.warn(`[ZENdian] Module "${module.id}" already registered, skipping.`);
      return;
    }
    this.modules.set(module.id, module);
  }

  /** 加载单个模块 */
  async loadModule(id: string): Promise<void> {
    const mod = this.modules.get(id);
    if (!mod) {
      console.warn(`[ZENdian] Module "${id}" not found.`);
      return;
    }
    if (this.loaded.has(id)) return;

    try {
      await mod.load(this.ctx);
      this.loaded.add(id);
    } catch (err) {
      console.error(`[ZENdian] Failed to load module "${id}":`, err);
    }
  }

  /** 卸载单个模块 */
  unloadModule(id: string): void {
    const mod = this.modules.get(id);
    if (!mod || !this.loaded.has(id)) return;

    try {
      mod.unload();
    } catch (err) {
      console.error(`[ZENdian] Failed to unload module "${id}":`, err);
    }
    this.loaded.delete(id);
  }

  /** 加载所有已注册模块 */
  async loadAll(): Promise<void> {
    const promises = Array.from(this.modules.keys()).map((id) => this.loadModule(id));
    await Promise.all(promises);
  }

  /** 卸载所有模块 */
  unloadAll(): void {
    for (const id of this.loaded) {
      this.unloadModule(id);
    }
  }

  /** 获取已加载模块列表 */
  getLoadedModules(): string[] {
    return Array.from(this.loaded);
  }

  /** 检查模块是否已加载 */
  isLoaded(id: string): boolean {
    return this.loaded.has(id);
  }

  /** 获取模块实例 */
  getModule(id: string): IFeatureModule | undefined {
    return this.modules.get(id);
  }

  /** 获取所有已注册模块 */
  getAllModules(): IFeatureModule[] {
    return Array.from(this.modules.values());
  }
}
