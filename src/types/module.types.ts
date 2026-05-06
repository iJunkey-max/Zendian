/**
 * Feature Module 接口定义
 * 所有功能模块必须实现此接口
 */

import type { PluginSettings } from "./settings.types";
import type { EventBus } from "../core/event-bus";

/**
 * 模块生命周期上下文
 * 由 ModuleManager 在 load() 时注入
 */
export interface ModuleContext {
  /** 事件总线，用于模块间通信 */
  events: EventBus;
  /** 获取当前完整设置 */
  getSettings: () => PluginSettings;
  /** 获取指定设置值的快捷方法 */
  getSetting: <K extends keyof PluginSettings>(key: K) => PluginSettings[K];
}

/**
 * 功能模块标准接口
 */
export interface IFeatureModule {
  /** 模块唯一标识，如 "auto-hide", "card-layout" */
  readonly id: string;

  /** 模块显示名称 */
  readonly name: string;

  /**
   * 模块初始化
   * - 注册事件监听
   * - 应用当前设置到 DOM
   * - 注册 CSS class / 变量
   */
  load(ctx: ModuleContext): Promise<void>;

  /**
   * 模块卸载
   * - 移除所有事件监听
   * - 清除 DOM 修改
   * - 清理定时器
   */
  unload(): void;

  /**
   * 设置变更通知
   * @param changedKeys - 发生变更的设置键名列表
   * @param settings - 完整设置对象
   */
  onSettingsChanged?(changedKeys: string[], settings: PluginSettings): void;

  /**
   * 主题切换通知（可选）
   */
  onThemeChange?(isDark: boolean): void;
}

/**
 * 模块注册信息
 */
export interface ModuleRegistration {
  module: IFeatureModule;
  enabled: boolean;
}
