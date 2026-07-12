/**
 * FileWatcher — 文件变更监听服务
 *
 * 功能：
 * - 监听项目文件变更
 * - 自动失效相关缓存
 * - 触发数据更新事件
 * - 防抖处理
 */

import { App, TFile, Events, type EventRef } from "obsidian";
import type { DataChangeEvent, DataChangeCallback } from "./types";

export class FileWatcher extends Events {
  private watchedProjects = new Set<string>();
  private projectCallbacks = new Map<string, Set<DataChangeCallback>>();
  private debounceTimers = new Map<string, number>();
  private vaultEventRefs: EventRef[] = [];
  private debounceDelay: number;

  constructor(
    private app: App,
    debounceDelay = 200
  ) {
    super();
    this.debounceDelay = debounceDelay;
    this.setupVaultListeners();
  }

  // ============================================================
  // 监听管理
  // ============================================================

  /**
   * 开始监听项目
   */
  watchProject(projectPath: string, callback?: DataChangeCallback): void {
    this.watchedProjects.add(projectPath);
    if (callback) {
      const callbacks = this.projectCallbacks.get(projectPath) || new Set<DataChangeCallback>();
      callbacks.add(callback);
      this.projectCallbacks.set(projectPath, callbacks);
    }

    console.log(`[FileWatcher] 开始监听项目: ${projectPath}`);
  }

  /**
   * 停止监听项目
   */
  unwatchProject(projectPath: string, callback?: DataChangeCallback): void {
    if (callback) {
      const callbacks = this.projectCallbacks.get(projectPath);
      callbacks?.delete(callback);
      if (callbacks?.size) return;
    }

    this.projectCallbacks.delete(projectPath);
    this.watchedProjects.delete(projectPath);

    // 清理定时器
    const timer = this.debounceTimers.get(projectPath);
    if (timer) {
      window.clearTimeout(timer);
      this.debounceTimers.delete(projectPath);
    }

    console.log(`[FileWatcher] 停止监听项目: ${projectPath}`);
  }

  /**
   * 停止所有监听
   */
  unwatchAll(): void {
    for (const projectPath of this.watchedProjects) {
      this.unwatchProject(projectPath);
    }
    this.watchedProjects.clear();
  }

  /**
   * 获取正在监听的项目列表
   */
  getWatchedProjects(): string[] {
    return Array.from(this.watchedProjects);
  }

  onChange(callback: DataChangeCallback): EventRef {
    return this.on("change", (...data: unknown[]) => callback(data[0] as DataChangeEvent));
  }

  // ============================================================
  // Vault 事件监听
  // ============================================================

  private setupVaultListeners(): void {
    // 文件创建
    this.vaultEventRefs.push(this.app.vault.on("create", (file) => {
      if (file instanceof TFile) {
        this.handleFileChange(file, "create");
      }
    }));

    // 文件修改
    this.vaultEventRefs.push(this.app.vault.on("modify", (file) => {
      if (file instanceof TFile) {
        this.handleFileChange(file, "update");
      }
    }));

    // 文件删除
    this.vaultEventRefs.push(this.app.vault.on("delete", (file) => {
      if (file instanceof TFile) {
        this.handleFileChange(file, "delete");
      }
    }));

    // 文件重命名
    this.vaultEventRefs.push(this.app.vault.on("rename", (file, oldPath) => {
      if (file instanceof TFile) {
        this.handleFileChange(file, "update");
      }
    }));
  }

  /**
   * 处理文件变更
   */
  private handleFileChange(file: TFile, action: "create" | "update" | "delete"): void {
    // 检查文件是否属于被监听的项目
    const projectPath = this.findProjectPath(file.path);

    if (!projectPath) {
      return;
    }

    // 防抖处理
    this.debounce(projectPath, () => {
      this.emitChangeEvent(file, action, projectPath);
    });
  }

  /**
   * 发送变更事件
   */
  private emitChangeEvent(file: TFile, action: "create" | "update" | "delete", projectPath: string): void {
    const event: DataChangeEvent = {
      type: this.getEventType(file),
      action,
      path: file.path,
      timestamp: Date.now(),
      data: {
        name: file.basename,
        extension: file.extension,
        projectPath,
      },
    };

    this.trigger("change", event);
    for (const callback of this.projectCallbacks.get(projectPath) || []) {
      try {
        callback(event);
      } catch (error) {
        console.error(`[FileWatcher] 项目回调失败: ${projectPath}`, error);
      }
    }

    console.log(`[FileWatcher] 文件变更: ${action} ${file.path}`);
  }

  /**
   * 确定事件类型
   */
  private getEventType(file: TFile): DataChangeEvent["type"] {
    if (file.extension === "home") {
      return "project";
    }
    if (file.name === "Timeline.md") {
      return "timeline";
    }
    if (file.path.includes("/30 交付物/")) {
      return "deliverable";
    }
    if (file.extension === "md") {
      return "file";
    }
    return "file";
  }

  /**
   * 查找文件所属的项目路径
   */
  private findProjectPath(filePath: string): string | null {
    const sortedPaths = Array.from(this.watchedProjects).sort((a, b) => b.length - a.length);
    for (const projectPath of sortedPaths) {
      if (filePath.startsWith(projectPath + "/")) {
        return projectPath;
      }
    }
    return null;
  }

  /**
   * 防抖处理
   */
  private debounce(key: string, callback: () => void): void {
    // 清除之前的定时器
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    // 设置新的定时器
    const timer = window.setTimeout(() => {
      callback();
      this.debounceTimers.delete(key);
    }, this.debounceDelay);

    this.debounceTimers.set(key, timer);
  }

  // ============================================================
  // 清理
  // ============================================================

  /**
   * 销毁监听器
   */
  destroy(): void {
    this.unwatchAll();
    for (const ref of this.vaultEventRefs) this.app.vault.offref(ref);
    this.vaultEventRefs = [];
    console.log("[FileWatcher] 已销毁");
  }
}
