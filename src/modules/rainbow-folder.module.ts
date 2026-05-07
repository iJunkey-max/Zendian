/**
 * 文件夹层级遮罩模块
 * 基于主题色，按层级递减遮罩浓度
 * JS 设置 alpha 深度变量，CSS 通过 hsla(var(--accent-h/s/l)) 自动响应主题色
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { ClassTracker, setCSSVar, removeCSSVar } from "../utils/dom";

const STYLE_ID = "zendian-rainbow-folder";
const MAX_LEVELS = 10;
const ALPHA_MULTIPLIER = 0.6;
const MIN_ALPHA = 0.015;

const EXPLORER = '.workspace-leaf-content[data-type="file-explorer"]';

export class RainbowFolderModule implements IFeatureModule {
  readonly id = "rainbow-folder";
  readonly name = "文件夹层级遮罩";

  private classes = new ClassTracker(document.body);
  private styleEl: HTMLStyleElement | null = null;
  private enabled = false;
  private opacity = 0.4;
  private observer: MutationObserver | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  async load(ctx: ModuleContext): Promise<void> {
    this.opacity = ctx.getSettings().rainbowFolder.opacity;
    this.apply(ctx.getSettings().rainbowFolder.enabled);
  }

  unload(): void {
    this.classes.cleanup();
    this.removeStyle();
    this.clearFolderVars();
    this.disconnectObserver();
    this.stopPolling();
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("rainbowFolder")) {
      this.opacity = settings.rainbowFolder.opacity;
      this.apply(settings.rainbowFolder.enabled);
    }
  }

  onThemeChange(_isDark: boolean): void {
    // CSS 变量 hsla(var(--accent-h/s/l)) 自动响应主题色变化，无需 JS 干预
  }

  private apply(enabled: boolean): void {
    this.enabled = enabled;
    this.classes.toggle("rainbow-folder", enabled);

    if (enabled) {
      this.injectStyle();
      this.connectObserver();
    } else {
      this.removeStyle();
      this.clearFolderVars();
      this.disconnectObserver();
      this.stopPolling();
    }
  }

  private injectStyle(): void {
    this.removeStyle();

    const scope = `body.rainbow-folder ${EXPLORER}`;
    const css = [
      `${scope} .nav-folder-title {`,
      "  transition: background-color 0.2s ease;",
      "  border-radius: 6px;",
      "  background-color: hsla(var(--accent-h), var(--accent-s), var(--accent-l), var(--rf-alpha)) !important;",
      "}",
      `${scope} .nav-file-title.is-active {`,
      "  background-color: color-mix(in srgb, var(--interactive-accent) 35%, transparent) !important;",
      "  border-left: 3px solid var(--interactive-accent);",
      "  color: var(--text-accent);",
      "  font-weight: 600;",
      "  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);",
      "}",
    ].join("\n");

    this.styleEl = document.createElement("style");
    this.styleEl.id = STYLE_ID;
    this.styleEl.textContent = css;
    document.head.appendChild(this.styleEl);
  }

  private removeStyle(): void {
    if (this.styleEl) {
      this.styleEl.remove();
      this.styleEl = null;
    }
  }

  /** 计算文件夹嵌套深度：向上回溯计数 .nav-folder-children 祖先数量 */
  private getDepth(titleEl: HTMLElement): number {
    let depth = 0;
    let current: HTMLElement | null = titleEl.parentElement;
    while (current) {
      if (current.classList.contains("nav-files-container")) break;
      if (current.classList.contains("nav-folder-children")) depth++;
      current = current.parentElement;
    }
    return depth;
  }

  /** 遍历所有文件夹标题，设置 --rf-alpha CSS 变量 */
  private applyDepths(): void {
    const titles = document.querySelectorAll(`${EXPLORER} .nav-folder-title`);
    for (const title of titles) {
      const depth = this.getDepth(title as HTMLElement);
      const level = Math.min(depth, MAX_LEVELS);
      const alpha = Math.max(MIN_ALPHA, this.opacity * Math.pow(ALPHA_MULTIPLIER, level));
      setCSSVar(title as HTMLElement, "--rf-alpha", String(alpha));
    }
  }

  private clearFolderVars(): void {
    const titles = document.querySelectorAll(`${EXPLORER} .nav-folder-title`);
    for (const title of titles) {
      removeCSSVar(title as HTMLElement, "--rf-alpha");
    }
  }

  /** 轮询等待文件树 DOM 挂载，然后挂载 Observer 并执行首次渲染 */
  private connectObserver(): void {
    this.disconnectObserver();
    this.stopPolling();

    const explorer = document.querySelector(EXPLORER);
    if (explorer) {
      this.mountObserver(explorer);
      this.applyDepths();
      return;
    }

    // DOM 尚未挂载，轮询等待
    let attempts = 0;
    this.pollTimer = setInterval(() => {
      attempts++;
      const el = document.querySelector(EXPLORER);
      if (el) {
        this.stopPolling();
        this.mountObserver(el);
        this.applyDepths();
      } else if (attempts >= 50) {
        this.stopPolling();
      }
    }, 200);
  }

  private mountObserver(target: Element): void {
    this.disconnectObserver();
    let raf = 0;
    const handler = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (this.enabled) this.applyDepths();
      });
    };
    this.observer = new MutationObserver(handler);
    this.observer.observe(target, { childList: true, subtree: true });
  }

  private disconnectObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
