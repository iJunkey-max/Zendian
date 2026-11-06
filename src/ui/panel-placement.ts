import type { App } from "obsidian";

/** Coordinates belong to the window in which the user initiated the action. */
export interface PanelAnchor {
  window: Window;
  x: number;
  y: number;
  screenX: number;
  screenY: number;
}

interface Point { x: number; y: number }
interface Bounds { left: number; top: number; width: number; height: number }

export function intersectPanelBounds(screen: Bounds, host: Bounds): Bounds {
  const left = Math.max(screen.left, host.left);
  const top = Math.max(screen.top, host.top);
  const right = Math.min(screen.left + screen.width, host.left + host.width);
  const bottom = Math.min(screen.top + screen.height, host.top + host.height);
  return right > left && bottom > top ? { left, top, width: right - left, height: bottom - top } : screen;
}

/** Keep the trigger near the upper part of the panel; clamp at the screen edge. */
export function placeNearAnchor(point: Point, size: { width: number; height: number }, bounds: Bounds, margin = 12): Point {
  const maxX = Math.max(bounds.left + margin, bounds.left + bounds.width - size.width - margin);
  const maxY = Math.max(bounds.top + margin, bounds.top + bounds.height - size.height - margin);
  const x = point.x - size.width / 2;
  const y = point.y - Math.min(size.height * 0.2, 100);
  return { x: Math.round(Math.min(maxX, Math.max(bounds.left + margin, x))), y: Math.round(Math.min(maxY, Math.max(bounds.top + margin, y))) };
}

const anchors = new WeakMap<Window, { anchor: PanelAnchor; time: number }>();
const panelAnchors = new WeakMap<HTMLElement, PanelAnchor>();

/** Preserve the original trigger while an asynchronous list is loading. */
export function bindPanelAnchor(panel: HTMLElement, anchor?: PanelAnchor): void {
  if (anchor) panelAnchors.set(panel, anchor);
}

export function capturePanelAnchor(win: Window | null | undefined): PanelAnchor | undefined {
  if (!win || win.closed) return undefined;
  const recent = anchors.get(win);
  return recent && Date.now() - recent.time < 5000 ? recent.anchor : undefined;
}

export function placePanelWindow(win: Window | null, size: { width: number; height: number }, anchor?: PanelAnchor, position?: "bottom-right", sourceWindow?: Window): void {
  if (!win || win.closed) return;
  const screen = (anchor?.window.screen ?? win.screen) as Screen & { availLeft?: number; availTop?: number };
  const screenBounds = { left: screen.availLeft ?? 0, top: screen.availTop ?? 0, width: screen.availWidth, height: screen.availHeight };
  const source = anchor?.window ?? sourceWindow;
  const bounds = source && !source.closed && position !== "bottom-right" && source.outerWidth > 0 && source.outerHeight > 0
    ? intersectPanelBounds(screenBounds, { left: source.screenX, top: source.screenY, width: source.outerWidth, height: source.outerHeight })
    : screenBounds;
  const fitted = { width: Math.min(size.width, Math.max(1, bounds.width - 24)), height: Math.min(size.height, Math.max(1, bounds.height - 24)) };
  win.resizeTo(fitted.width, fitted.height);
  if (position === "bottom-right") {
    win.moveTo(bounds.left + bounds.width - fitted.width - 16, bounds.top + bounds.height - fitted.height - 16);
  } else if (anchor || source) {
    const target = anchor ? { x: anchor.screenX, y: anchor.screenY } : { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 3 };
    const point = placeNearAnchor(target, fitted, bounds);
    win.moveTo(point.x, point.y);
  }
}

function placeOverlay(panel: HTMLElement, anchor: PanelAnchor): void {
  const win = panel.ownerDocument.defaultView;
  if (!win || win !== anchor.window || win.innerWidth <= 480) return;
  const rect = panel.getBoundingClientRect();
  const size = { width: panel.offsetWidth || rect.width, height: panel.offsetHeight || rect.height };
  if (!size.width || !size.height) return;
  const point = placeNearAnchor(anchor, size, { left: 0, top: 0, width: win.innerWidth, height: win.innerHeight });
  panel.style.position = "fixed";
  panel.style.left = `${point.x}px`;
  panel.style.top = `${point.y}px`;
  panel.style.margin = "0";
}

/** Track interactions in every Obsidian window; position only ZENdian overlays. */
export function installPanelPlacementTracking(app: App): () => void {
  const cleanups = new Map<Window, () => void>();
  const attach = (win: Window): void => {
    if (cleanups.has(win)) return;
    const doc = win.document;
    const record = (x: number, y: number, screenX: number, screenY: number): void => {
      anchors.set(win, { anchor: { window: win, x, y, screenX, screenY }, time: Date.now() });
    };
    const isPluginInteraction = (target: EventTarget | null): boolean => {
      const element = target as Element | null;
      return !!element?.closest?.(".zendian-homepage, .zc-root, .zendian-popout-form, .zendian-settings-wrapper, .hp-detail-overlay, .modal.zendian-shared-modal");
    };
    const pointer = (event: PointerEvent): void => {
      if (!event.isPrimary) return;
      if (isPluginInteraction(event.target)) record(event.clientX, event.clientY, event.screenX, event.screenY);
      else anchors.delete(win);
    };
    const key = (event: KeyboardEvent): void => {
      if ((event.key !== "Enter" && event.key !== " ") || !isPluginInteraction(event.target)) return;
      const element = event.target as HTMLElement | null;
      if (!element?.getBoundingClientRect) return;
      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      record(x, y, win.screenX + x, win.screenY + y);
    };
    doc.addEventListener("pointerdown", pointer, true);
    doc.addEventListener("keydown", key, true);
    const positioned = new WeakSet<Element>();
    let frame = 0;
    const check = (): void => {
      frame = 0;
      const anchor = capturePanelAnchor(win);
      doc.querySelectorAll<HTMLElement>(".hp-detail-overlay > .hp-detail-panel, .hp-detail-overlay > .hp-all-panel, .modal.zendian-shared-modal").forEach(panel => {
        if (!positioned.has(panel) && panel.isConnected && panel.getBoundingClientRect().width) {
          positioned.add(panel);
          if (panel.matches(".modal.zendian-shared-modal")) {
            const title = panel.querySelector("h2")?.textContent?.trim() ?? "";
            const profiles: Record<string, string> = {
              "新建项目": "project", "项目属性": "project", "导入项目迁移包": "project",
              "添加待办": "task", "添加任务": "task", "编辑任务": "task",
              "新建灵感速记": "note", "编辑灵感速记": "note",
              "提交交付物": "delivery", "选择交付文件": "picker", "版本差异": "history",
              "创建项目检查点": "checkpoint",
            };
            if (profiles[title]) panel.dataset.zdPanelSize = profiles[title];
          }
          const panelAnchor = panelAnchors.get(panel) ?? anchor;
          if (panelAnchor) placeOverlay(panel, panelAnchor);
        }
      });
    };
    const observer = new MutationObserver(mutations => {
      const relevant = mutations.some(mutation => {
        if (mutation.type === "attributes") return (mutation.target as Element).matches?.(".modal.zendian-shared-modal");
        return Array.from(mutation.addedNodes).some(node => node.nodeType === 1 &&
          ((node as Element).matches(".modal, .hp-detail-overlay, .hp-detail-panel, .hp-all-panel") ||
           (node as Element).querySelector(".modal, .hp-detail-overlay, .hp-detail-panel, .hp-all-panel")));
      });
      if (relevant && !frame) frame = win.requestAnimationFrame(check);
    });
    observer.observe(doc.documentElement || doc, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    cleanups.set(win, () => { doc.removeEventListener("pointerdown", pointer, true); doc.removeEventListener("keydown", key, true); observer.disconnect(); if (frame) win.cancelAnimationFrame(frame); });
  };
  const main = app.workspace.containerEl.ownerDocument.defaultView;
  if (main) attach(main);
  app.workspace.iterateAllLeaves(leaf => { const win = leaf.view.containerEl.ownerDocument.defaultView; if (win) attach(win); });
  const opened = app.workspace.on("window-open", (_workspaceWindow, win) => attach(win));
  const closed = app.workspace.on("window-close", (_workspaceWindow, win) => { cleanups.get(win)?.(); cleanups.delete(win); });
  return () => { app.workspace.offref(opened); app.workspace.offref(closed); cleanups.forEach(cleanup => cleanup()); cleanups.clear(); };
}
