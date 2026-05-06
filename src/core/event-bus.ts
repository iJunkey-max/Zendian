/**
 * 轻量级事件总线
 * 用于模块间解耦通信
 */

type EventHandler = (...args: any[]) => void;

export class EventBus {
  private listeners = new Map<string, Set<EventHandler>>();

  on(event: string, handler: EventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    // 返回取消订阅函数
    return () => this.off(event, handler);
  }

  off(event: string, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((handler) => {
      try {
        handler(...args);
      } catch (err) {
        console.error(`[ZENdian] Event handler error for "${event}":`, err);
      }
    });
  }

  clear(): void {
    this.listeners.clear();
  }
}

/** 预定义事件名 */
export const Events = {
  SETTINGS_CHANGED: "settings:changed",
  THEME_CHANGED: "theme:changed",
} as const;
