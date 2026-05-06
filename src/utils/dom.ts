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
