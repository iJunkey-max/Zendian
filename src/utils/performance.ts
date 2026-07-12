/**
 * Performance — 性能优化工具
 *
 * 功能：
 * - 性能监控
 * - 防抖和节流
 * - 懒加载
 * - 内存管理
 * - 渲染优化
 */

// ============================================================
// 类型定义
// ============================================================

export interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  domNodes: number;
  eventListeners: number;
}

export interface DebounceOptions {
  leading?: boolean;   // 是否在开始时执行
  trailing?: boolean;  // 是否在结束时执行
  maxWait?: number;    // 最大等待时间
}

export interface ThrottleOptions {
  leading?: boolean;   // 是否在开始时执行
  trailing?: boolean;  // 是否在结束时执行
}

// ============================================================
// 防抖函数
// ============================================================

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: DebounceOptions = {}
): (...args: Parameters<T>) => void {
  let timeout: number | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastCallTime: number | null = null;
  let lastInvokeTime = 0;

  const { leading = false, trailing = true, maxWait } = options;

  function invokeFunc(time: number) {
    const args = lastArgs!;
    lastArgs = null;
    lastInvokeTime = time;
    return func(...args);
  }

  function startTimer(pendingFunc: () => void, wait: number) {
    timeout = window.setTimeout(pendingFunc, wait);
  }

  function remainingWait(time: number) {
    const timeSinceLastCall = time - (lastCallTime || 0);
    const timeSinceLastInvoke = time - lastInvokeTime;
    const timeWaiting = wait - timeSinceLastCall;

    return maxWait !== undefined
      ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
      : timeWaiting;
  }

  function shouldInvoke(time: number) {
    const timeSinceLastCall = time - (lastCallTime || 0);
    const timeSinceLastInvoke = time - lastInvokeTime;

    return (
      lastCallTime === null ||
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0 ||
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    );
  }

  function timerExpired() {
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    restartTimer();
  }

  function trailingEdge(time: number) {
    timeout = null;

    if (trailing && lastArgs) {
      return invokeFunc(time);
    }

    lastArgs = null;
    return undefined;
  }

  function leadingEdge(time: number) {
    lastInvokeTime = time;
    startTimer(timerExpired, wait);
    return leading ? invokeFunc(time) : undefined;
  }

  function cancel() {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
    lastInvokeTime = 0;
    lastArgs = null;
    lastCallTime = null;
  }

  function flush() {
    return timeout === null ? undefined : trailingEdge(Date.now());
  }

  function pending() {
    return timeout !== null;
  }

  function restartTimer() {
    const time = Date.now();
    const waitTime = remainingWait(time);

    if (waitTime > 0) {
      startTimer(timerExpired, waitTime);
    } else {
      startTimer(timerExpired, wait);
    }
  }

  function debounced(this: any, ...args: Parameters<T>) {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastCallTime = time;

    if (isInvoking) {
      if (timeout === null) {
        return leadingEdge(lastCallTime);
      }
      if (maxWait !== undefined) {
        startTimer(timerExpired, wait);
        return leading ? invokeFunc(lastCallTime) : undefined;
      }
    }

    if (timeout === null) {
      startTimer(timerExpired, wait);
    }

    return undefined;
  }

  debounced.cancel = cancel;
  debounced.flush = flush;
  debounced.pending = pending;

  return debounced;
}

// ============================================================
// 节流函数
// ============================================================

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: ThrottleOptions = {}
): (...args: Parameters<T>) => void {
  return debounce(func, wait, {
    leading: options.leading !== false,
    trailing: options.trailing !== false,
    maxWait: wait,
  });
}

// ============================================================
// 懒加载
// ============================================================

/**
 * 创建懒加载函数
 */
export function lazy<T>(factory: () => T): () => T {
  let value: T | undefined;
  let initialized = false;

  return () => {
    if (!initialized) {
      value = factory();
      initialized = true;
    }
    return value!;
  };
}

/**
 * 创建异步懒加载函数
 */
export function lazyAsync<T>(factory: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null;

  return () => {
    if (!promise) {
      promise = factory();
    }
    return promise;
  };
}

// ============================================================
// 内存管理
// ============================================================

/**
 * 创建弱引用缓存
 */
export function createWeakCache<K extends object, V>() {
  const cache = new WeakMap<K, V>();

  return {
    get(key: K): V | undefined {
      return cache.get(key);
    },
    set(key: K, value: V): void {
      cache.set(key, value);
    },
    has(key: K): boolean {
      return cache.has(key);
    },
    delete(key: K): void {
      cache.delete(key);
    },
  };
}

/**
 * 创建 LRU 缓存
 */
export function createLRUCache<K, V>(maxSize: number) {
  const cache = new Map<K, V>();

  return {
    get(key: K): V | undefined {
      const value = cache.get(key);
      if (value !== undefined) {
        // 移动到最新位置
        cache.delete(key);
        cache.set(key, value);
      }
      return value;
    },
    set(key: K, value: V): void {
      if (cache.size >= maxSize) {
        // 删除最旧的项
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) {
          cache.delete(firstKey);
        }
      }
      cache.set(key, value);
    },
    has(key: K): boolean {
      return cache.has(key);
    },
    delete(key: K): void {
      cache.delete(key);
    },
    clear(): void {
      cache.clear();
    },
    size(): number {
      return cache.size;
    },
  };
}

// ============================================================
// 渲染优化
// ============================================================

/**
 * 请求动画帧
 */
export function raf(callback: () => void): number {
  return requestAnimationFrame(callback);
}

/**
 * 批量更新 DOM
 */
export function batchDOMUpdate(updates: (() => void)[]): void {
  raf(() => {
    for (const update of updates) {
      update();
    }
  });
}

/**
 * 虚拟滚动计算
 */
export function calculateVirtualScroll(
  scrollTop: number,
  containerHeight: number,
  itemHeight: number,
  totalItems: number,
  overscan = 5
): { startIndex: number; endIndex: number; offsetY: number } {
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleItems = Math.ceil(containerHeight / itemHeight);
  const endIndex = Math.min(totalItems - 1, startIndex + visibleItems + overscan * 2);
  const offsetY = startIndex * itemHeight;

  return { startIndex, endIndex, offsetY };
}

// ============================================================
// 性能监控
// ============================================================

/**
 * 测量函数执行时间
 */
export async function measureTime<T>(
  name: string,
  fn: () => T | Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);

  return { result, duration };
}

/**
 * 获取性能指标
 */
export function getPerformanceMetrics(): PerformanceMetrics {
  const renderTime = performance.now();
  const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0;
  const domNodes = document.getElementsByTagName("*").length;

  return {
    renderTime,
    memoryUsage,
    domNodes,
    eventListeners: 0, // 无法直接获取
  };
}

/**
 * 监控长任务
 */
export function observeLongTasks(callback: (duration: number) => void): () => void {
  if (typeof PerformanceObserver === "undefined") {
    return () => {};
  }

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === "longtask") {
        callback(entry.duration);
      }
    }
  });

  try {
    observer.observe({ entryTypes: ["longtask"] });
  } catch {
    // 不支持 longtask 观察
  }

  return () => observer.disconnect();
}

/**
 * 监控布局偏移
 */
export function observeLayoutShift(callback: (value: number) => void): () => void {
  if (typeof PerformanceObserver === "undefined") {
    return () => {};
  }

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === "layout-shift" && !(entry as any).hadRecentInput) {
        callback((entry as any).value);
      }
    }
  });

  try {
    observer.observe({ entryTypes: ["layout-shift"] });
  } catch {
    // 不支持 layout-shift 观察
  }

  return () => observer.disconnect();
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 空闲时执行
 */
export function requestIdleCallback(
  callback: () => void,
  options?: { timeout?: number }
): number {
  if (typeof window.requestIdleCallback !== "undefined") {
    return window.requestIdleCallback(callback, options);
  }

  // 降级方案
  return window.setTimeout(callback, 1);
}

/**
 * 取消空闲执行
 */
export function cancelIdleCallback(id: number): void {
  if (typeof window.cancelIdleCallback !== "undefined") {
    window.cancelIdleCallback(id);
  } else {
    window.clearTimeout(id);
  }
}

/**
 * 避免布局抖动
 */
export function avoidLayoutThrashing(read: () => void, write: () => void): void {
  // 批量读取
  read();

  // 批量写入
  raf(write);
}
