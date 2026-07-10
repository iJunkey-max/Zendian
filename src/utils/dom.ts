/**
 * DOM 操作工具函数
 * 提取各模块中重复的 DOM 操作模式
 */

/** 根据布尔值增删 CSS class */
export function setClass(el: HTMLElement, className: string, condition: boolean): void {
  if (condition) {
    el.classList.add(className);
  } else {
    el.classList.remove(className);
  }
}

/** 设置 CSS 自定义属性（自动补 -- 前缀） */
export function setCSSVar(el: HTMLElement, property: string, value: string): void {
  const prop = property.startsWith("--") ? property : `--${property}`;
  el.style.setProperty(prop, value);
}

/** 移除 CSS 自定义属性 */
export function removeCSSVar(el: HTMLElement, property: string): void {
  const prop = property.startsWith("--") ? property : `--${property}`;
  el.style.removeProperty(prop);
}

/**
 * 跟踪已应用的 CSS class，提供统一的清理方法
 * 消除各模块中重复的 appliedClasses Set 模式
 */
export class ClassTracker {
  private classes = new Set<string>();

  constructor(private el: HTMLElement = document.body) {}

  /** 添加 class 并跟踪 */
  add(className: string): void {
    this.classes.add(className);
    this.el.classList.add(className);
  }

  /** 移除 class 并取消跟踪 */
  remove(className: string): void {
    this.classes.delete(className);
    this.el.classList.remove(className);
  }

  /** 根据条件增删 class */
  toggle(className: string, condition: boolean): void {
    this.classes.add(className);
    setClass(this.el, className, condition);
  }

  /** 移除所有已跟踪的 class */
  cleanup(): void {
    for (const cls of this.classes) {
      this.el.classList.remove(cls);
    }
    this.classes.clear();
  }
}

/**
 * DOM 轮询工具
 * 提取各模块中重复的轮询逻辑（icon-system、rainbow-folder 等）
 *
 * 使用场景：等待 Obsidian 动态 DOM 元素就绪
 */
export class DOMPoller {
  private timer: ReturnType<typeof setInterval> | null = null;

  /**
   * 轮询查询元素，找到后执行回调
   * @param selector CSS 选择器
   * @param callback 找到元素后的回调
   * @param options 配置选项
   */
  poll(
    selector: string,
    callback: (element: Element) => void,
    options: {
      interval?: number;     // 轮询间隔（毫秒），默认 200
      maxAttempts?: number;  // 最大尝试次数，默认 50
      onTimeout?: () => void; // 超时回调
    } = {}
  ): void {
    const { interval = 200, maxAttempts = 50, onTimeout } = options;
    let attempts = 0;

    this.stop(); // 清理旧的轮询

    this.timer = setInterval(() => {
      attempts++;
      const el = document.querySelector(selector);

      if (el) {
        this.stop();
        callback(el);
      } else if (attempts >= maxAttempts) {
        this.stop();
        onTimeout?.();
      }
    }, interval);
  }

  /**
   * 停止轮询
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * 检查是否正在轮询
   */
  isPolling(): boolean {
    return this.timer !== null;
  }
}

/**
 * 便捷函数：等待元素出现
 * @param selector CSS 选择器
 * @param options 配置选项
 * @returns Promise<Element>，超时则 reject
 */
export function waitForElement(
  selector: string,
  options: {
    interval?: number;
    maxAttempts?: number;
    timeout?: number; // 总超时时间（毫秒），优先于 maxAttempts
  } = {}
): Promise<Element> {
  return new Promise((resolve, reject) => {
    const { interval = 200, timeout } = options;
    const maxAttempts = timeout ? Math.ceil(timeout / interval) : (options.maxAttempts || 50);

    const poller = new DOMPoller();
    poller.poll(
      selector,
      (el) => resolve(el),
      {
        interval,
        maxAttempts,
        onTimeout: () => reject(new Error(`Element not found: ${selector}`)),
      }
    );
  });
}

