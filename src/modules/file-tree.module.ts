import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { ClassTracker, removeCSSVar, setCSSVar } from "../utils/dom";

const EXPLORER = '.workspace-leaf-content[data-type="file-explorer"]';
const FOLDER_SELECTOR = `${EXPLORER} .tree-item.nav-folder`;

export class FileTreeModule implements IFeatureModule {
  readonly id = "file-tree";
  readonly name = "File Tree";

  private classes = new ClassTracker(document.body);
  private observer: MutationObserver | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private folderStates = new WeakMap<HTMLElement, boolean>();
  private collapseTimers = new WeakMap<HTMLElement, number>();
  private raf = 0;
  private folderCardsEnabled = false;

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.captureOpenFolderHeight(event.target);
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" && event.key !== " ") return;
    this.captureOpenFolderHeight(event.target);
  };

  async load(ctx: ModuleContext): Promise<void> {
    this.apply(ctx.getSettings());
  }

  unload(): void {
    this.classes.cleanup();
    this.disconnectFolderAnimation();
    this.clearFolderAnimationVars();
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("fileTree") || changedKeys.includes("folderCards")) {
      this.apply(settings);
    }
  }

  private apply(settings: PluginSettings): void {
    const s = settings.fileTree;
    this.folderCardsEnabled = settings.folderCards.enabled;
    this.classes.toggle("CTA-BTN-enable", s.ctaBtnEnable);
    this.classes.toggle("file-names-untrim", s.fileNamesUntrim);
    this.classes.toggle("folder-font-bold", s.folderFontBold);
    this.classes.toggle("zendian-file-tree-anim", !this.folderCardsEnabled);

    if (this.folderCardsEnabled) {
      this.disconnectFolderAnimation();
      this.clearFolderAnimationVars();
    } else {
      this.connectFolderAnimation();
    }
  }

  private captureOpenFolderHeight(start: EventTarget | null): void {
    if (this.folderCardsEnabled) return;
    const target = start instanceof HTMLElement ? start : null;
    const title = target?.closest<HTMLElement>(`${EXPLORER} .nav-folder-title`);
    const folder = title?.closest<HTMLElement>(".tree-item.nav-folder");
    if (!folder || folder.classList.contains("is-collapsed")) return;

    const children = folder.querySelector<HTMLElement>(":scope > .nav-folder-children");
    if (children) setCSSVar(children, "--zd-folder-content-height", `${children.scrollHeight}px`);
  }

  private connectFolderAnimation(): void {
    if (this.folderCardsEnabled) return;
    this.disconnectFolderAnimation();
    document.addEventListener("pointerdown", this.onPointerDown, true);
    document.addEventListener("keydown", this.onKeyDown, true);

    const explorer = document.querySelector(EXPLORER);
    if (explorer) {
      this.mountObserver(explorer);
      this.refreshFolderAnimations();
      return;
    }

    let attempts = 0;
    this.pollTimer = setInterval(() => {
      attempts++;
      const el = document.querySelector(EXPLORER);
      if (el) {
        this.stopPolling();
        this.mountObserver(el);
        this.refreshFolderAnimations();
      } else if (attempts >= 50) {
        this.stopPolling();
      }
    }, 200);
  }

  private mountObserver(target: Element): void {
    this.observer = new MutationObserver(() => {
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame(() => this.refreshFolderAnimations());
    });
    this.observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  private refreshFolderAnimations(): void {
    if (this.folderCardsEnabled) return;
    const folders = document.querySelectorAll<HTMLElement>(FOLDER_SELECTOR);
    for (const folder of folders) {
      const children = folder.querySelector<HTMLElement>(":scope > .nav-folder-children");
      if (!children) continue;

      const isCollapsed = folder.classList.contains("is-collapsed");
      const wasCollapsed = this.folderStates.get(folder);
      if (!isCollapsed) {
        setCSSVar(children, "--zd-folder-content-height", `${children.scrollHeight}px`);
        folder.removeClass("zendian-folder-collapsing");
      } else if (wasCollapsed === false) {
        this.playCollapseAnimation(folder, children);
      }
      this.folderStates.set(folder, isCollapsed);
    }
  }

  private playCollapseAnimation(folder: HTMLElement, children: HTMLElement): void {
    const fallbackHeight = children.scrollHeight || children.getBoundingClientRect().height;
    if (fallbackHeight > 0) setCSSVar(children, "--zd-folder-content-height", `${Math.round(fallbackHeight)}px`);
    folder.addClass("zendian-folder-collapsing");

    const existingTimer = this.collapseTimers.get(folder);
    if (existingTimer) window.clearTimeout(existingTimer);
    const timer = window.setTimeout(() => {
      folder.removeClass("zendian-folder-collapsing");
      this.collapseTimers.delete(folder);
    }, 240);
    this.collapseTimers.set(folder, timer);
  }

  private disconnectFolderAnimation(): void {
    document.removeEventListener("pointerdown", this.onPointerDown, true);
    document.removeEventListener("keydown", this.onKeyDown, true);
    this.observer?.disconnect();
    this.observer = null;
    this.stopPolling();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private stopPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private clearFolderAnimationVars(): void {
    const nodes = document.querySelectorAll<HTMLElement>(`${FOLDER_SELECTOR}, ${EXPLORER} .nav-folder-children`);
    for (const node of nodes) {
      node.removeClass("zendian-folder-collapsing");
      removeCSSVar(node, "--zd-folder-content-height");
    }
  }
}
