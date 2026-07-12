/**
 * Shortcuts — 快捷键系统
 *
 * 功能：
 * - 全局快捷键注册
 * - 快捷键冲突检测
 * - 快捷键提示
 * - 快捷键自定义
 */

// ============================================================
// 类型定义
// ============================================================

export type KeyModifier = "ctrl" | "alt" | "shift" | "meta";
export type KeyCode = string; // 例如 "KeyK", "KeyS", "Enter", "Escape"

export interface ShortcutConfig {
  key: string;                    // 例如 "Ctrl+K", "Alt+S"
  description: string;            // 快捷键描述
  category?: string;              // 分类（例如 "全局"、"编辑器"、"项目"）
  handler: (event: KeyboardEvent) => void | Promise<void>;
  preventDefault?: boolean;       // 是否阻止默认行为
  enabled?: boolean;              // 是否启用
}

export interface ShortcutInfo {
  key: string;
  description: string;
  category: string;
  enabled: boolean;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: Partial<ShortcutConfig> = {
  preventDefault: true,
  enabled: true,
  category: "通用",
};

// ============================================================
// 快捷键管理器
// ============================================================

export class ShortcutManager {
  private shortcuts = new Map<string, ShortcutConfig>();
  private keyMap = new Map<string, string>(); // key -> id
  private enabled = true;
  private initialized = false;

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  // ============================================================
  // 初始化
  // ============================================================

  /**
   * 初始化快捷键系统
   */
  initialize(): void {
    if (this.initialized) return;

    // 添加全局事件监听
    document.addEventListener("keydown", this.handleKeyDown);

    this.initialized = true;
    console.log("[ShortcutManager] 快捷键系统已初始化");
  }

  /**
   * 销毁快捷键系统
   */
  destroy(): void {
    if (!this.initialized) return;

    document.removeEventListener("keydown", this.handleKeyDown);
    this.shortcuts.clear();
    this.keyMap.clear();

    this.initialized = false;
    console.log("[ShortcutManager] 快捷键系统已销毁");
  }

  // ============================================================
  // 注册快捷键
  // ============================================================

  /**
   * 注册快捷键
   */
  register(config: ShortcutConfig): string {
    const id = this.generateId();
    const fullConfig = { ...DEFAULT_CONFIG, ...config };

    // 检查冲突
    const existingId = this.keyMap.get(config.key);
    if (existingId) {
      console.warn(`[ShortcutManager] 快捷键冲突: ${config.key} 已被注册`);
      return existingId;
    }

    this.shortcuts.set(id, fullConfig);
    this.keyMap.set(config.key, id);

    console.log(`[ShortcutManager] 注册快捷键: ${config.key} - ${config.description}`);
    return id;
  }

  /**
   * 批量注册快捷键
   */
  registerBatch(configs: ShortcutConfig[]): string[] {
    return configs.map((config) => this.register(config));
  }

  /**
   * 注销快捷键
   */
  unregister(id: string): void {
    const config = this.shortcuts.get(id);
    if (config) {
      this.keyMap.delete(config.key);
      this.shortcuts.delete(id);
      console.log(`[ShortcutManager] 注销快捷键: ${config.key}`);
    }
  }

  /**
   * 注销所有快捷键
   */
  unregisterAll(): void {
    this.shortcuts.clear();
    this.keyMap.clear();
    console.log("[ShortcutManager] 注销所有快捷键");
  }

  // ============================================================
  // 快捷键操作
  // ============================================================

  /**
   * 启用/禁用快捷键系统
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`[ShortcutManager] 快捷键系统${enabled ? "已启用" : "已禁用"}`);
  }

  /**
   * 启用/禁用单个快捷键
   */
  setShortcutEnabled(id: string, enabled: boolean): void {
    const config = this.shortcuts.get(id);
    if (config) {
      config.enabled = enabled;
    }
  }

  /**
   * 更新快捷键
   */
  update(id: string, updates: Partial<ShortcutConfig>): void {
    const config = this.shortcuts.get(id);
    if (config) {
      // 如果更新了键值，需要更新映射
      if (updates.key && updates.key !== config.key) {
        this.keyMap.delete(config.key);
        this.keyMap.set(updates.key, id);
      }

      Object.assign(config, updates);
    }
  }

  // ============================================================
  // 查询
  // ============================================================

  /**
   * 获取所有快捷键
   */
  getAll(): ShortcutInfo[] {
    return Array.from(this.shortcuts.entries()).map(([id, config]) => ({
      key: config.key,
      description: config.description,
      category: config.category || "通用",
      enabled: config.enabled !== false,
    }));
  }

  /**
   * 按分类获取快捷键
   */
  getByCategory(category: string): ShortcutInfo[] {
    return this.getAll().filter((s) => s.category === category);
  }

  /**
   * 检查快捷键是否已注册
   */
  isRegistered(key: string): boolean {
    return this.keyMap.has(key);
  }

  /**
   * 获取快捷键描述
   */
  getDescription(key: string): string | null {
    const id = this.keyMap.get(key);
    if (id) {
      const config = this.shortcuts.get(id);
      return config?.description || null;
    }
    return null;
  }

  // ============================================================
  // 事件处理
  // ============================================================

  private handleKeyDown(event: KeyboardEvent): void {
    // 如果快捷键系统被禁用，直接返回
    if (!this.enabled) return;

    // 忽略在输入框中的快捷键
    const target = event.target as HTMLElement;
    if (this.isInputElement(target)) return;

    // 构建键值字符串
    const key = this.buildKeyString(event);

    // 查找对应的快捷键
    const id = this.keyMap.get(key);
    if (!id) return;

    const config = this.shortcuts.get(id);
    if (!config || config.enabled === false) return;

    // 执行处理函数
    try {
      if (config.preventDefault !== false) {
        event.preventDefault();
        event.stopPropagation();
      }

      config.handler(event);
    } catch (error) {
      console.error(`[ShortcutManager] 快捷键处理失败: ${key}`, error);
    }
  }

  private isInputElement(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase();
    if (tagName === "input" || tagName === "textarea" || tagName === "select") {
      return true;
    }
    if (element.isContentEditable) {
      return true;
    }
    return false;
  }

  private buildKeyString(event: KeyboardEvent): string {
    const parts: string[] = [];

    if (event.ctrlKey || event.metaKey) parts.push("Ctrl");
    if (event.altKey) parts.push("Alt");
    if (event.shiftKey) parts.push("Shift");

    // 获取键值
    let key = event.key;
    if (key === " ") key = "Space";
    else if (key === "Escape") key = "Esc";

    parts.push(key);

    return parts.join("+");
  }

  // ============================================================
  // 工具函数
  // ============================================================

  private generateId(): string {
    return `shortcut-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================
// 全局实例
// ============================================================

let globalShortcutManager: ShortcutManager | null = null;

/**
 * 获取全局快捷键管理器
 */
export function getShortcutManager(): ShortcutManager {
  if (!globalShortcutManager) {
    globalShortcutManager = new ShortcutManager();
  }
  return globalShortcutManager;
}

/**
 * 销毁全局快捷键管理器
 */
export function destroyShortcutManager(): void {
  if (globalShortcutManager) {
    globalShortcutManager.destroy();
    globalShortcutManager = null;
  }
}

// ============================================================
// 预设快捷键
// ============================================================

/**
 * 注册预设快捷键
 */
export function registerDefaultShortcuts(handlers: {
  onSearch?: () => void;
  onNewTask?: () => void;
  onExport?: () => void;
  onToggleSidebar?: () => void;
  onOpenSettings?: () => void;
}): void {
  const manager = getShortcutManager();

  const shortcuts: ShortcutConfig[] = [];

  if (handlers.onSearch) {
    shortcuts.push({
      key: "Ctrl+K",
      description: "快速搜索",
      category: "全局",
      handler: handlers.onSearch,
    });
  }

  if (handlers.onNewTask) {
    shortcuts.push({
      key: "Ctrl+N",
      description: "新建任务",
      category: "项目",
      handler: handlers.onNewTask,
    });
  }

  if (handlers.onExport) {
    shortcuts.push({
      key: "Ctrl+E",
      description: "导出报告",
      category: "项目",
      handler: handlers.onExport,
    });
  }

  if (handlers.onToggleSidebar) {
    shortcuts.push({
      key: "Ctrl+\\",
      description: "切换侧边栏",
      category: "全局",
      handler: handlers.onToggleSidebar,
    });
  }

  if (handlers.onOpenSettings) {
    shortcuts.push({
      key: "Ctrl+,",
      description: "打开设置",
      category: "全局",
      handler: handlers.onOpenSettings,
    });
  }

  manager.registerBatch(shortcuts);
}

// ============================================================
// 快捷键提示
// ============================================================

/**
 * 生成快捷键提示文本
 */
export function formatShortcutKey(key: string): string {
  return key
    .replace("Ctrl", "⌘")
    .replace("Alt", "⌥")
    .replace("Shift", "⇧")
    .replace("+", " ");
}

/**
 * 创建快捷键提示元素
 */
export function createShortcutHint(key: string): HTMLElement {
  const hint = document.createElement("span");
  hint.addClass("shortcut-hint");
  hint.textContent = formatShortcutKey(key);
  hint.title = key;
  return hint;
}
