/**
 * 递归文件夹卡片模块。
 * 使用主题强调色与 Obsidian 背景色混合，为文件树建立紧凑的嵌套容器。
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { ClassTracker, setCSSVar, removeCSSVar } from "../utils/dom";

const STYLE_ID = "zendian-folder-cards";
const MAX_LEVELS = 10;
const EXPLORER = '.workspace-leaf-content[data-type="file-explorer"]';
const CARD_SELECTOR = `${EXPLORER} .tree-item.nav-folder`;

export class FolderCardsModule implements IFeatureModule {
  readonly id = "folder-cards";
  readonly name = "文件夹卡片";

  private classes = new ClassTracker(document.body);
  private styleEl: HTMLStyleElement | null = null;
  private enabled = false;
  private opacity = 0.4;
  private style: "card" | "capsule" = "card";
  private observer: MutationObserver | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private initialPass = true;
  private folderStates = new WeakMap<HTMLElement, boolean>();
  private collapseTimers = new WeakMap<HTMLElement, number>();

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.captureOpenFolderHeight(event.target);
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" && event.key !== " ") return;
    this.captureOpenFolderHeight(event.target);
  };

  async load(ctx: ModuleContext): Promise<void> {
    const settings = ctx.getSettings().folderCards;
    this.opacity = settings.opacity;
    this.style = settings.style === "capsule" ? "capsule" : "card";
    this.apply(settings.enabled);
  }

  unload(): void {
    this.classes.cleanup();
    document.body.classList.remove("rainbow-folder");
    this.removeStyle();
    this.clearFolderVars();
    this.disconnectObserver();
    this.stopPolling();
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("folderCards")) {
      this.opacity = settings.folderCards.opacity;
      this.style = settings.folderCards.style === "capsule" ? "capsule" : "card";
      this.apply(settings.folderCards.enabled);
    }
  }

  onThemeChange(): void {
    if (this.enabled) this.applyDepths();
  }

  private apply(enabled: boolean): void {
    this.enabled = enabled;
    this.classes.toggle("folder-cards-enabled", enabled);

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

    if (this.style === "capsule") {
      this.injectCapsuleStyle();
      return;
    }

    const scope = `body.folder-cards-enabled ${EXPLORER}`;
    const css = [
      `${scope} .tree-item.nav-folder {`,
      "  position: relative;",
      "  box-sizing: border-box;",
      "  margin-block: 3px 5px;",
      "  padding: 3px 4px 4px;",
      "  border-radius: 8px;",
      "  background: var(--rf-surface, var(--background-secondary)) !important;",
      "  box-shadow: 0 2px 7px rgba(55, 34, 45, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.24);",
      "  transition: background-color 180ms ease, box-shadow 180ms ease;",
      "}",
      `${scope} .tree-item.nav-folder[data-rf-depth=\"0\"] {`,
      "  margin-block: 5px 7px;",
      "}",
      `${scope} .tree-item.nav-folder.is-collapsed {`,
      "  padding-block: 0 1px;",
      "  margin-block: 7px 9px;",
      "}",
      `${scope} .tree-item.nav-folder > .nav-folder-title {`,
      "  position: relative;",
      "  z-index: 1;",
      "  border-radius: 3px;",
      "  background: transparent !important;",
      "  color: var(--text-normal);",
      "  font-weight: var(--nav-item-weight, 500);",
      "  box-shadow: none !important;",
      "  transition: background-color 120ms ease, box-shadow 120ms ease, transform 120ms cubic-bezier(0.22, 1, 0.36, 1);",
      "}",
      `${scope} .tree-item.nav-folder.is-collapsed > .nav-folder-title {`,
      "  margin-bottom: 0;",
      "}",
      `${scope} .tree-item.nav-folder:not(.is-collapsed) > .nav-folder-title {`,
      "  margin-bottom: 5px;",
      "  font-weight: var(--nav-item-weight-active, 600);",
      "}",
      `${scope} .tree-item.nav-folder:not(.is-collapsed) > .nav-folder-title::after {`,
      "  content: \"\";",
      "  position: absolute;",
      "  inset-inline-start: 30px;",
      "  inset-inline-end: 9px;",
      "  bottom: -3px;",
      "  height: 1px;",
      "  border-radius: 1px;",
      "  background: color-mix(in srgb, var(--interactive-accent) 20%, transparent);",
      "  opacity: 0.65;",
      "  pointer-events: none;",
      "}",
      `${scope} .tree-item.nav-folder > .nav-folder-title:hover {`,
      "  transform: translateX(0);",
      "  background: transparent !important;",
      "  box-shadow: none !important;",
      "}",
      `${scope} .tree-item.nav-folder > .nav-folder-title .zendian-icon {`,
      "  transition: color 120ms ease;",
      "}",
      `${scope} .tree-item.nav-folder > .nav-folder-title:hover .zendian-icon {`,
      "  color: color-mix(in srgb, var(--text-muted) 72%, var(--interactive-accent));",
      "}",
      `${scope} .tree-item.nav-folder > .nav-folder-children {`,
      "  box-sizing: border-box;",
      "  max-height: var(--rf-content-height, 2000px);",
      "  overflow: hidden;",
      "  padding: 1px 3px 2px 8px;",
      "  margin: 0;",
      "  border: 0 !important;",
      "  border-radius: 0;",
      "  background: transparent !important;",
      "  box-shadow: none;",
      "  opacity: 1;",
      "  transform: translateY(0);",
      "  transition: max-height 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 140ms ease, padding 180ms ease, transform 180ms cubic-bezier(0.22, 1, 0.36, 1);",
      "}",
      `${scope} .tree-item.nav-folder.is-collapsed > .nav-folder-children {`,
      "  max-height: 0;",
      "  margin-block: 0;",
      "  padding-block: 0;",
      "  border-width: 0 !important;",
      "  box-shadow: none !important;",
      "  background: transparent !important;",
      "  opacity: 0;",
      "  transform: translateY(-4px);",
      "}",
      `${scope} .tree-item.nav-folder.zendian-folder-collapsing.is-collapsed > .nav-folder-children {`,
      "  display: block !important;",
      "  animation: zendian-rf-folder-collapse 190ms cubic-bezier(0.22, 1, 0.36, 1) both;",
      "}",
      `${scope} .nav-folder-children.rf-empty {`,
      "  max-height: 0 !important;",
      "  margin: 0 !important;",
      "  padding: 0 !important;",
      "  border-width: 0 !important;",
      "  background: transparent !important;",
      "  box-shadow: none !important;",
      "  opacity: 0;",
      "}",
      `body.theme-dark.folder-cards-enabled ${EXPLORER} .tree-item.nav-folder {`,
      "  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.09);",
      "}",
      `${scope} .tree-item.nav-folder > .nav-folder-children > .tree-item.nav-folder {`,
      "  margin-block: 1px;",
      "}",
      `${scope} .tree-item.nav-folder > .nav-folder-children > .tree-item.nav-folder:not(.is-collapsed) {`,
      "  margin-block: 5px 7px;",
      "}",
      `${scope} .tree-item.nav-folder > .nav-folder-children > .tree-item.nav-folder.is-collapsed {`,
      "  margin-block: 7px 9px;",
      "  padding-block: 0 1px;",
      "}",
      `${scope} .tree-item.nav-file:has(> .tree-item-self.nav-file-title.is-active) {`,
      "  position: relative;",
      "  z-index: 1;",
      "  width: 100%;",
      "  box-sizing: border-box;",
      "  isolation: isolate;",
      "}",
      `${scope} .tree-item.nav-file:has(> .tree-item-self.nav-file-title.is-active)::before {`,
      "  content: \"\";",
      "  position: absolute;",
      "  inset: 0;",
      "  z-index: 0;",
      "  border-radius: 4px;",
      "  background: color-mix(in srgb, var(--interactive-accent) 14%, var(--rf-content-surface, var(--rf-surface, var(--background-secondary))));",
      "  box-shadow: inset 2px 0 0 var(--interactive-accent), inset 0 1px rgba(255, 255, 255, 0.08), inset 0 0 0 1px color-mix(in srgb, var(--interactive-accent) 18%, transparent), 0 1px 3px rgba(55, 34, 45, 0.06);",
      "  pointer-events: none;",
      "  transition: background-color 120ms ease, box-shadow 120ms ease;",
      "}",
      `${scope} .tree-item.nav-file:has(> .tree-item-self.nav-file-title.is-active):hover::before {`,
      "  background: color-mix(in srgb, var(--interactive-accent) 18%, var(--rf-content-surface, var(--rf-surface, var(--background-secondary))));",
      "  box-shadow: inset 2px 0 0 var(--interactive-accent), inset 0 1px rgba(255, 255, 255, 0.1), inset 0 0 0 1px color-mix(in srgb, var(--interactive-accent) 24%, transparent), 0 2px 5px rgba(55, 34, 45, 0.08);",
      "}",
      `${scope} :is(.tree-item.nav-file-title, .tree-item-self.nav-file-title).is-active {`,
      "  position: relative;",
      "  z-index: 2;",
      "  box-sizing: border-box;",
      "  background: transparent !important;",
      "  border: 0 !important;",
      "  box-shadow: none !important;",
      "  color: var(--text-normal) !important;",
      "  font-weight: 600;",
      "}",
      `${scope} :is(.tree-item.nav-file-title, .tree-item-self.nav-file-title).is-active:hover {`,
      "  background: transparent !important;",
      "}",
      `body.folder-cards-enabled.rf-initial-pass ${EXPLORER} .tree-item.nav-folder > .nav-folder-children {`,
      "  transition: none !important;",
      "}",
      "@keyframes zendian-rf-folder-collapse {",
      "  from {",
      "    max-height: var(--rf-content-height, 2000px);",
      "    opacity: 1;",
      "    transform: translateY(0);",
      "  }",
      "  to {",
      "    max-height: 0;",
      "    opacity: 0;",
      "    transform: translateY(-4px);",
      "  }",
      "}",
      "@media (prefers-reduced-motion: reduce) {",
      `  ${scope} .tree-item.nav-folder, ${scope} .tree-item.nav-folder > .nav-folder-title, ${scope} .tree-item.nav-folder > .nav-folder-children {`,
      "    transition: none !important;",
      "  }",
      "}",
    ].join("\n");

    this.styleEl = document.createElement("style");
    this.styleEl.id = STYLE_ID;
    this.styleEl.textContent = css;
    document.head.appendChild(this.styleEl);
  }

  private injectCapsuleStyle(): void {
    const scope = `body.folder-cards-enabled ${EXPLORER}`;
    const css = [
      `${scope} .nav-folder-title {`,
      "  transition: background-color 180ms ease, box-shadow 180ms ease;",
      "  border-radius: 6px;",
      "  background-color: hsla(var(--accent-h), var(--accent-s), var(--accent-l), var(--rf-alpha, 0.4)) !important;",
      "}",
      `${scope} .nav-folder-title:hover {`,
      "  filter: brightness(1.04);",
      "}",
      `${scope} :is(.tree-item-self.nav-file-title, .tree-item.nav-file-title).is-active {`,
      "  background-color: color-mix(in srgb, var(--interactive-accent) 35%, transparent) !important;",
      "  border-left: 3px solid var(--interactive-accent) !important;",
      "  color: var(--text-accent) !important;",
      "  font-weight: 600;",
      "  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);",
      "}",
      `${scope} .tree-item.nav-folder > .nav-folder-children {`,
      "  max-height: var(--rf-content-height, 2000px);",
      "  overflow: hidden;",
      "  opacity: 1;",
      "  transform: translateY(0);",
      "  transition: max-height 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 140ms ease, transform 180ms cubic-bezier(0.22, 1, 0.36, 1);",
      "}",
      `${scope} .tree-item.nav-folder.is-collapsed > .nav-folder-children {`,
      "  max-height: 0;",
      "  opacity: 0;",
      "  transform: translateY(-4px);",
      "}",
      `${scope} .tree-item.nav-folder.zendian-folder-collapsing.is-collapsed > .nav-folder-children {`,
      "  display: block !important;",
      "  animation: zendian-rf-folder-collapse 190ms cubic-bezier(0.22, 1, 0.36, 1) both;",
      "}",
      "@keyframes zendian-rf-folder-collapse {",
      "  from { max-height: var(--rf-content-height, 2000px); opacity: 1; transform: translateY(0); }",
      "  to { max-height: 0; opacity: 0; transform: translateY(-4px); }",
      "}",
    ].join("\n");
    this.styleEl = document.createElement("style");
    this.styleEl.id = STYLE_ID;
    this.styleEl.textContent = css;
    document.head.appendChild(this.styleEl);
  }

  private removeStyle(): void {
    this.styleEl?.remove();
    this.styleEl = null;
  }

  private getDepth(folder: HTMLElement): number {
    let depth = 0;
    let current: HTMLElement | null = folder.parentElement;
    while (current) {
      if (current.classList.contains("nav-files-container")) break;
      if (current.classList.contains("nav-folder-children")) depth++;
      current = current.parentElement;
    }
    return Math.min(depth, MAX_LEVELS);
  }

  private captureOpenFolderHeight(start: EventTarget | null): void {
    if (!this.enabled) return;
    const target = start instanceof HTMLElement ? start : null;
    const title = target?.closest<HTMLElement>(`${EXPLORER} .nav-folder-title`);
    const folder = title?.closest<HTMLElement>(".tree-item.nav-folder");
    if (!folder || folder.classList.contains("is-collapsed")) return;

    const children = folder.querySelector<HTMLElement>(":scope > .nav-folder-children");
    if (children) setCSSVar(children, "--rf-content-height", `${children.scrollHeight}px`);
  }

  private applyDepths(): void {
    const folders = document.querySelectorAll<HTMLElement>(CARD_SELECTOR);
    const intensity = Math.min(1.15, 0.55 + (this.opacity / 0.4) * 0.45);
    for (const folder of folders) {
      const depth = this.getDepth(folder);
      const surfaceMix = Math.max(5, Math.round([28, 18, 11, 7][Math.min(depth, 3)] * intensity));
      const headerMix = Math.max(7, Math.round([30, 20, 12, 8][Math.min(depth, 3)] * intensity));
      const borderMix = Math.max(7, Math.round([28, 19, 12, 8][Math.min(depth, 3)] * intensity));
      const childDepth = Math.min(depth + 1, MAX_LEVELS);
      const childSurfaceMix = Math.max(5, Math.round([28, 18, 11, 7][Math.min(childDepth, 3)] * intensity));
      const capsuleAlpha = Math.max(0.015, this.opacity * Math.pow(0.6, depth));
      folder.setAttribute("data-rf-depth", String(depth));
      setCSSVar(folder, "--rf-alpha", String(capsuleAlpha));
      setCSSVar(folder, "--rf-depth", String(depth));
      setCSSVar(folder, "--rf-surface", `color-mix(in srgb, hsl(var(--accent-h), var(--accent-s), var(--accent-l)) ${surfaceMix}%, var(--background-secondary))`);
      setCSSVar(folder, "--rf-header-surface", `color-mix(in srgb, hsl(var(--accent-h), var(--accent-s), var(--accent-l)) ${headerMix}%, var(--background-secondary))`);
      setCSSVar(folder, "--rf-border", `color-mix(in srgb, hsl(var(--accent-h), var(--accent-s), var(--accent-l)) ${borderMix}%, transparent)`);
      setCSSVar(folder, "--rf-content-surface", `color-mix(in srgb, hsl(var(--accent-h), var(--accent-s), var(--accent-l)) ${childSurfaceMix}%, var(--background-secondary))`);
      const title = folder.querySelector<HTMLElement>(":scope > .nav-folder-title");
      if (title) setCSSVar(title, "--rf-alpha", String(capsuleAlpha));
      const children = folder.querySelector<HTMLElement>(":scope > .nav-folder-children");
      if (children) {
        const hasItems = Boolean(children.querySelector(":scope > .tree-item"));
        const isCollapsed = folder.classList.contains("is-collapsed");
        const wasCollapsed = this.folderStates.get(folder);
        if (!isCollapsed) {
          folder.removeClass("zendian-folder-collapsing");
        } else if (wasCollapsed === false && !this.initialPass) {
          this.playCollapseAnimation(folder, children);
        }
        this.folderStates.set(folder, isCollapsed);
        folder.classList.toggle("rf-has-children", hasItems);
        children.classList.toggle("rf-empty", !hasItems);
        if (!isCollapsed) {
          setCSSVar(children, "--rf-content-height", `${children.scrollHeight}px`);
        }
      } else {
        folder.classList.remove("rf-has-children");
      }
    }
    if (this.initialPass) {
      document.body.classList.add("rf-initial-pass");
      requestAnimationFrame(() => {
        document.body.classList.remove("rf-initial-pass");
        this.initialPass = false;
      });
    }
  }

  private clearFolderVars(): void {
    const nodes = document.querySelectorAll<HTMLElement>(`${EXPLORER} .tree-item.nav-folder, ${EXPLORER} .nav-folder-children, ${EXPLORER} .nav-folder-title`);
    for (const node of nodes) {
      node.removeAttribute("data-rf-depth");
      node.classList.remove("rf-empty");
      node.classList.remove("rf-has-children");
      node.classList.remove("zendian-folder-collapsing");
      for (const variable of ["--rf-depth", "--rf-surface", "--rf-header-surface", "--rf-border", "--rf-content-surface", "--rf-content-height", "--rf-alpha"]) {
        removeCSSVar(node, variable);
      }
    }
  }

  private connectObserver(): void {
    this.disconnectObserver();
    this.stopPolling();
    document.addEventListener("pointerdown", this.onPointerDown, true);
    document.addEventListener("keydown", this.onKeyDown, true);
    const explorer = document.querySelector(EXPLORER);
    if (explorer) {
      this.mountObserver(explorer);
      this.applyDepths();
      return;
    }
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
    this.observer = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (this.enabled) this.applyDepths();
      });
    });
    this.observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  private disconnectObserver(): void {
    document.removeEventListener("pointerdown", this.onPointerDown, true);
    document.removeEventListener("keydown", this.onKeyDown, true);
    this.observer?.disconnect();
    this.observer = null;
  }

  private playCollapseAnimation(folder: HTMLElement, children: HTMLElement): void {
    const fallbackHeight = children.scrollHeight || children.getBoundingClientRect().height;
    if (fallbackHeight > 0) setCSSVar(children, "--rf-content-height", `${Math.round(fallbackHeight)}px`);
    folder.addClass("zendian-folder-collapsing");

    const existingTimer = this.collapseTimers.get(folder);
    if (existingTimer) window.clearTimeout(existingTimer);
    const timer = window.setTimeout(() => {
      folder.removeClass("zendian-folder-collapsing");
      this.collapseTimers.delete(folder);
    }, 240);
    this.collapseTimers.set(folder, timer);
  }

  private stopPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }
}
