/**
 * CacheManager — 智能缓存管理器
 *
 * 功能：
 * - 内存缓存（带 TTL）
 * - LRU 淘汰策略
 * - 版本控制（文件 mtime）
 * - 缓存统计
 */

import type { CacheEntry, CacheOptions } from "./types";

export class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private accessOrder = new Map<string, number>(); // key -> last access timestamp
  private maxSize: number;
  private defaultTTL: number;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    sets: 0,
  };

  constructor(maxSize = 100, defaultTTL = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  /**
   * 获取缓存数据
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // 检查是否过期
    const now = Date.now();
    if (now - entry.timestamp > this.defaultTTL) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.stats.misses++;
      return null;
    }

    // 更新访问时间
    this.accessOrder.set(key, now);
    this.stats.hits++;
    return entry.data as T;
  }

  /**
   * 设置缓存数据
   */
  set<T>(key: string, data: T, options?: Partial<CacheOptions>): void {
    const now = Date.now();

    // 如果缓存已满，执行 LRU 淘汰
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      version: options?.key || String(now),
    };

    this.cache.set(key, entry);
    this.accessOrder.set(key, now);
    this.stats.sets++;
  }

  /**
   * 检查缓存是否有效
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.timestamp > this.defaultTTL) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 使缓存失效
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    this.accessOrder.delete(key);
  }

  /**
   * 使匹配的缓存失效（支持通配符）
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern.replace(/\*/g, ".*"));
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.invalidate(key);
    }
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
  }

  /**
   * LRU 淘汰策略
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, time] of this.accessOrder.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessOrder.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
      : 0;

    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: hitRate.toFixed(2) + "%",
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      sets: 0,
    };
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 预热缓存（批量设置）
   */
  warmup<T>(entries: Array<{ key: string; data: T }>): void {
    for (const entry of entries) {
      this.set(entry.key, entry.data);
    }
  }
}
