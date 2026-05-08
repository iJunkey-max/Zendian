/**
 * 图标系统模块
 * 数据驱动的动态文件树图标：内置 Lucide + 支持第三方图标库
 */

import { getIcon } from "obsidian";
import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";

const STYLE_ID = "zendian-icon-system";
const EXPLORER = '.workspace-leaf-content[data-type="file-explorer"]';
const PLUGIN_DIR = ".obsidian/plugins/zendian";

export class IconSystemModule implements IFeatureModule {
  readonly id = "icon-system";
  readonly name = "图标系统";

  private styleEl: HTMLStyleElement | null = null;
  private observer: MutationObserver | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private enabled = false;
  private customEnabled = false;
  private compiledRules: { regex: RegExp; iconId: string; color?: string }[] = [];
  private customIcons: Record<string, string> = {};
  private installedLibraries: string[] = [];
  private ctx!: ModuleContext;

  /** SVG 缓存：iconId → SVG 元素，避免重复解析 */
  private svgCache = new Map<string, SVGElement>();

  async load(ctx: ModuleContext): Promise<void> {
    this.ctx = ctx;
    this.syncSettings(ctx.getSettings().iconSystem);
    this.apply();
  }

  unload(): void {
    this.removeStyle();
    this.disconnectObserver();
    this.stopPolling();
    this.removeAllIcons();
    this.svgCache.clear();
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("iconSystem")) {
      this.syncSettings(settings.iconSystem);
      this.apply();
    }
  }

  // ─── 内部：设置同步 ───

  private syncSettings(s: PluginSettings["iconSystem"]): void {
    this.enabled = s.enabled;
    this.customEnabled = s.customEnabled;
    this.customIcons = { ...s.customIcons };
    this.installedLibraries = [...s.installedLibraries];
    this.compiledRules = s.defaultRules.map((r) => ({
      regex: new RegExp(r.regex, "i"),
      iconId: r.iconId,
      color: r.color,
    }));
  }

  // ─── 内部：生命周期 ───

  private apply(): void {
    if (this.enabled) {
      this.injectStyle();
      this.connectObserver();
    } else {
      this.removeStyle();
      this.disconnectObserver();
      this.stopPolling();
      this.removeAllIcons();
    }
  }

  private injectStyle(): void {
    this.removeStyle();
    const css = [
      `${EXPLORER} .nav-file-title-content,`,
      `${EXPLORER} .nav-folder-title-content {`,
      "  display: inline-flex;",
      "  align-items: center;",
      "  gap: 4px;",
      "}",
      ".zendian-icon {",
      "  display: inline-flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  width: 16px;",
      "  height: 16px;",
      "  flex-shrink: 0;",
      "  color: var(--text-muted);",
      "}",
      ".zendian-icon svg {",
      "  width: 16px;",
      "  height: 16px;",
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

  // ─── 内部：DOM 轮询与 Observer ───

  private connectObserver(): void {
    this.disconnectObserver();
    this.stopPolling();

    const explorer = document.querySelector(EXPLORER);
    if (explorer) {
      this.mountObserver(explorer);
      this.scanAndApply();
      return;
    }

    let attempts = 0;
    this.pollTimer = setInterval(() => {
      attempts++;
      const el = document.querySelector(EXPLORER);
      if (el) {
        this.stopPolling();
        this.mountObserver(el);
        this.scanAndApply();
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
        if (this.enabled) this.scanAndApply();
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

  // ─── 内部：图标扫描与应用 ───

  private scanAndApply(): void {
    const titles = document.querySelectorAll(
      `${EXPLORER} .nav-file-title, ${EXPLORER} .nav-folder-title`
    );
    for (const title of titles) {
      this.applyIcon(title as HTMLElement);
    }
  }

  private applyIcon(titleEl: HTMLElement): void {
    // 已注入则跳过
    if (titleEl.querySelector(".zendian-icon")) return;

    const path = titleEl.getAttribute("data-path");
    if (!path) return;

    const iconId = this.matchIcon(path);
    if (!iconId) return;

    // 异步渲染，插入到 title-content 之前
    this.renderIcon(iconId).then((svg) => {
      if (!svg) return;
      // 再次检查，防止并发重复插入
      if (titleEl.querySelector(".zendian-icon")) return;

      const contentEl = titleEl.querySelector(
        ".nav-file-title-content, .nav-folder-title-content"
      );
      if (!contentEl) return;

      const wrapper = document.createElement("div");
      wrapper.classList.add("zendian-icon");
      wrapper.appendChild(svg);
      titleEl.insertBefore(wrapper, contentEl);
    });
  }

  private removeAllIcons(): void {
    const icons = document.querySelectorAll(".zendian-icon");
    for (const icon of icons) {
      icon.remove();
    }
  }

  // ─── 内部：图标匹配 ───

  /**
   * 按优先级匹配：customIcons（精确路径）> defaultRules（正则）
   * 返回 iconId 或 null
   */
  private matchIcon(path: string): string | null {
    // 1. 精确路径匹配（customIcons）
    if (this.customEnabled && path in this.customIcons) {
      return this.customIcons[path];
    }

    // 2. 正则匹配（defaultRules）
    for (const rule of this.compiledRules) {
      if (rule.regex.test(path)) {
        return rule.iconId;
      }
    }

    return null;
  }

  // ─── 内部：图标渲染 ───

  /**
   * 将 iconId 解析为 SVG 元素
   * - lucide-* → Obsidian 原生 getIcon()
   * - <library>/<icon> → 从插件目录读取 SVG 文件
   */
  private async renderIcon(iconId: string): Promise<SVGElement | null> {
    const cached = this.svgCache.get(iconId);
    if (cached) return cached.cloneNode(true) as SVGElement;

    let svg: SVGElement | null = null;

    if (iconId.startsWith("lucide-")) {
      svg = this.renderLucideIcon(iconId);
    } else {
      svg = await this.renderLibraryIcon(iconId);
    }

    if (svg) {
      this.svgCache.set(iconId, svg.cloneNode(true) as SVGElement);
    }
    return svg;
  }

  /** 调用 Obsidian 原生 Lucide 图标 */
  private renderLucideIcon(iconId: string): SVGElement | null {
    const name = iconId.replace("lucide-", "");
    return getIcon(name);
  }

  /** 从插件目录读取第三方库 SVG 文件 */
  private async renderLibraryIcon(iconId: string): Promise<SVGElement | null> {
    const parts = iconId.split("/");
    if (parts.length !== 2) return null;

    const [library, icon] = parts;

    // 安全检查：只允许已安装的库
    if (!this.installedLibraries.includes(library)) return null;

    // 安全检查：防止路径穿越
    if (library.includes("..") || icon.includes("..")) return null;

    const filePath = `${PLUGIN_DIR}/icons/${library}/${icon}.svg`;

    try {
      const svgText = await this.ctx.app.vault.adapter.read(filePath);
      return this.parseSvgString(svgText);
    } catch {
      // 文件不存在或读取失败
      return null;
    }
  }

  /** 将 SVG 字符串解析为 SVGElement */
  private parseSvgString(svgText: string): SVGElement | null {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return null;

    // 移除固定宽高，允许 CSS 控制尺寸
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.style.width = "100%";
    svg.style.height = "100%";

    return svg;
  }
}
