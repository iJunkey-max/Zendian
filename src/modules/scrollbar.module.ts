import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { ClassTracker } from "../utils/dom";

export class ScrollbarModule implements IFeatureModule {
  readonly id = "scrollbar";
  readonly name = "Scrollbar";

  private classes = new ClassTracker(document.body);
  private enabled = false;
  private overlay: HTMLElement | null = null;
  private thumb: HTMLElement | null = null;
  private activeTarget: HTMLElement | null = null;
  private hideTimer: number | null = null;
  private raf: number | null = null;
  private observer: MutationObserver | null = null;
  private dragging = false;
  private dragTarget: HTMLElement | null = null;
  private dragStartY = 0;
  private dragStartScrollTop = 0;
  private dragTrackHeight = 0;
  private dragThumbHeight = 0;

  private readonly onScroll = (event: Event): void => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target && this.isScrollable(target)) this.showFor(target);
  };

  private readonly onPointerMove = (event: MouseEvent): void => {
    if (this.dragging) return;
    const target = this.findScrollableTarget(event.target);
    if (target) this.showFor(target);
  };

  private readonly onWheel = (event: WheelEvent): void => {
    if (this.dragging) return;
    const target = this.findScrollableTarget(event.target);
    if (target) this.showFor(target);
  };

  private readonly onResize = (): void => {
    if (this.activeTarget) this.showFor(this.activeTarget);
  };

  private readonly onThumbPointerDown = (event: PointerEvent): void => {
    if (!this.activeTarget || !this.overlay || !this.thumb) return;
    event.preventDefault();
    event.stopPropagation();

    const overlayRect = this.overlay.getBoundingClientRect();
    const thumbRect = this.thumb.getBoundingClientRect();
    this.dragging = true;
    this.dragTarget = this.activeTarget;
    this.dragStartY = event.clientY;
    this.dragStartScrollTop = this.activeTarget.scrollTop;
    this.dragTrackHeight = overlayRect.height;
    this.dragThumbHeight = thumbRect.height;
    this.overlay.addClass("is-dragging");
    if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
    this.hideTimer = null;

    document.addEventListener("pointermove", this.onDocumentPointerMove);
    document.addEventListener("pointerup", this.onDocumentPointerUp, { once: true });
    this.thumb.setPointerCapture?.(event.pointerId);
  };

  private readonly onDocumentPointerMove = (event: PointerEvent): void => {
    if (!this.dragging || !this.dragTarget) return;
    event.preventDefault();

    const maxScrollTop = Math.max(0, this.dragTarget.scrollHeight - this.dragTarget.clientHeight);
    const maxThumbTop = Math.max(1, this.dragTrackHeight - this.dragThumbHeight);
    const deltaY = event.clientY - this.dragStartY;
    const nextScrollTop = this.dragStartScrollTop + (deltaY / maxThumbTop) * maxScrollTop;
    this.dragTarget.scrollTop = Math.max(0, Math.min(maxScrollTop, nextScrollTop));
    this.updateOverlay(this.dragTarget);
  };

  private readonly onDocumentPointerUp = (): void => {
    document.removeEventListener("pointermove", this.onDocumentPointerMove);
    document.removeEventListener("pointerup", this.onDocumentPointerUp);
    this.dragging = false;
    this.dragTarget = null;
    this.overlay?.removeClass("is-dragging");
    if (this.activeTarget) this.updateOverlay(this.activeTarget);
  };

  async load(ctx: ModuleContext): Promise<void> {
    this.apply(ctx.getSettings().scrollbar);
  }

  unload(): void {
    this.disableOverlay();
    this.classes.cleanup();
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("scrollbar")) {
      this.apply(settings.scrollbar);
    }
  }

  private apply(settings: PluginSettings["scrollbar"]): void {
    this.classes.toggle("scrollbar-hide", settings.hide);
    this.classes.toggle("restored-scrollbars", settings.restored);
    const shouldUseOverlay = !settings.hide && !settings.restored;
    this.classes.toggle("zendian-overlay-scrollbars", shouldUseOverlay);
    if (shouldUseOverlay) this.enableOverlay();
    else this.disableOverlay();
  }

  private enableOverlay(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.overlay = document.body.createDiv({ cls: "zendian-scrollbar-overlay" });
    this.thumb = this.overlay.createDiv({ cls: "zendian-scrollbar-overlay-thumb" });
    this.thumb.addEventListener("pointerdown", this.onThumbPointerDown);
    document.addEventListener("scroll", this.onScroll, true);
    document.addEventListener("mousemove", this.onPointerMove, { passive: true });
    document.addEventListener("wheel", this.onWheel, { passive: true });
    window.addEventListener("resize", this.onResize);
    this.observer = new MutationObserver(() => {
      if (this.activeTarget && !document.body.contains(this.activeTarget)) this.hideOverlay();
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  private disableOverlay(): void {
    if (!this.enabled) return;
    this.enabled = false;
    document.removeEventListener("scroll", this.onScroll, true);
    document.removeEventListener("mousemove", this.onPointerMove);
    document.removeEventListener("wheel", this.onWheel);
    document.removeEventListener("pointermove", this.onDocumentPointerMove);
    document.removeEventListener("pointerup", this.onDocumentPointerUp);
    window.removeEventListener("resize", this.onResize);
    this.observer?.disconnect();
    this.observer = null;
    if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
    if (this.raf !== null) window.cancelAnimationFrame(this.raf);
    this.hideTimer = null;
    this.raf = null;
    this.activeTarget = null;
    this.dragging = false;
    this.dragTarget = null;
    this.thumb?.removeEventListener("pointerdown", this.onThumbPointerDown);
    this.overlay?.remove();
    this.overlay = null;
    this.thumb = null;
  }

  private findScrollableTarget(start: EventTarget | null): HTMLElement | null {
    let el = start instanceof HTMLElement ? start : null;
    while (el && el !== document.body) {
      if (this.isScrollable(el)) return el;
      el = el.parentElement;
    }
    return null;
  }

  private isScrollable(el: HTMLElement): boolean {
    if (el.classList.contains("zendian-scrollbar-overlay") || el.classList.contains("zendian-scrollbar-overlay-thumb")) {
      return false;
    }
    if (["TEXTAREA", "SELECT", "INPUT"].includes(el.tagName)) return false;
    const style = getComputedStyle(el);
    if (!["auto", "scroll", "overlay"].includes(style.overflowY)) return false;
    return el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 24;
  }

  private showFor(target: HTMLElement): void {
    if (!this.enabled || !this.overlay || !this.thumb) return;
    this.activeTarget = target;
    if (this.raf !== null) window.cancelAnimationFrame(this.raf);
    this.raf = window.requestAnimationFrame(() => {
      this.raf = null;
      this.updateOverlay(target);
    });
  }

  private updateOverlay(target: HTMLElement): void {
    if (!this.overlay || !this.thumb || !this.isScrollable(target)) {
      this.hideOverlay();
      return;
    }
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.top >= window.innerHeight) {
      this.hideOverlay();
      return;
    }

    const top = Math.max(4, rect.top + 4);
    const bottom = Math.min(rect.bottom, window.innerHeight - 4);
    const height = Math.max(24, bottom - top - 4);
    const thumbRatio = target.clientHeight / target.scrollHeight;
    const thumbHeight = Math.max(28, Math.round(height * thumbRatio));
    const maxThumbTop = Math.max(0, height - thumbHeight);
    const scrollRatio = target.scrollTop / Math.max(1, target.scrollHeight - target.clientHeight);
    const thumbTop = Math.round(maxThumbTop * scrollRatio);

    const overlayWidth = 8;
    const inset = 2;
    const overlayLeft = Math.min(rect.right - overlayWidth - inset, window.innerWidth - overlayWidth - inset);
    this.overlay.style.left = `${Math.round(Math.max(rect.left, overlayLeft))}px`;
    this.overlay.style.top = `${Math.round(top)}px`;
    this.overlay.style.height = `${Math.round(height)}px`;
    this.thumb.style.height = `${thumbHeight}px`;
    this.thumb.style.transform = `translateY(${thumbTop}px)`;
    this.overlay.addClass("is-visible");

    if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => this.hideOverlay(), 900);
  }

  private hideOverlay(): void {
    if (this.dragging) return;
    this.overlay?.removeClass("is-visible");
  }
}
