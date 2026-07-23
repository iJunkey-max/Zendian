import type { EventRef, WorkspaceLeaf } from "obsidian";
import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { GraphSettings, PluginSettings } from "../types/settings.types";
import nebulaFilamentUrl from "../../assets/graph/nebula-filament.png";

const GRAPH_TYPES = ["graph", "localgraph"] as const;
const HOME_GRAPH_FILTER = "-file:.home";
const GRAPH_CLASSES = [
  "zendian-graph",
  "is-zendian-graph-motion",
  "is-zendian-graph-starfield",
  "is-zendian-graph-local-boost",
  "is-zendian-graph-compact",
] as const;

const GRAPH_VARIABLES = [
  "--zd-graph-nebula",
  "--zd-graph-drift-a",
  "--zd-graph-drift-b",
  "--zd-graph-nebula-texture",
  "--zd-graph-h",
  "--graph-line",
] as const;

export class GraphModule implements IFeatureModule {
  readonly id = "graph";
  readonly name = "关系图谱美化";

  private ctx?: ModuleContext;
  private layoutRef?: EventRef;
  private containers = new Set<HTMLElement>();
  private filterInputs = new Map<HTMLInputElement, EventListener>();
  private refreshFrame?: number;
  private nativeRefreshPending = false;

  async load(ctx: ModuleContext): Promise<void> {
    this.ctx = ctx;
    this.layoutRef = ctx.app.workspace.on("layout-change", () => {
      this.applyAll();
      this.scheduleNativeRefresh();
    });
    this.applyAll();
    this.scheduleNativeRefresh();
  }

  unload(): void {
    if (this.layoutRef && this.ctx) this.ctx.app.workspace.offref(this.layoutRef);
    if (this.refreshFrame !== undefined) window.cancelAnimationFrame(this.refreshFrame);
    for (const container of this.containers) this.clearContainer(container);
    for (const [input, listener] of this.filterInputs) {
      input.removeEventListener("input", listener);
      this.removeHomeFilter(input);
    }
    this.filterInputs.clear();
    this.containers.clear();
    this.layoutRef = undefined;
    this.ctx = undefined;
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (!changedKeys.includes("graph")) return;
    this.applyAll(settings.graph);
    this.scheduleNativeRefresh();
  }

  onThemeChange(): void {
    this.applyAll();
  }

  private applyAll(settings = this.ctx?.getSettings().graph): void {
    if (!this.ctx || !settings) return;
    const active = new Set<HTMLElement>();
    for (const type of GRAPH_TYPES) {
      for (const leaf of this.ctx.app.workspace.getLeavesOfType(type)) {
        const container = this.getContainer(leaf);
        if (!container) continue;
        active.add(container);
        this.applyContainer(container, type === "localgraph", settings, leaf.view);
      }
    }
    for (const container of this.containers) {
      if (!active.has(container)) {
        this.clearContainer(container);
      }
    }
    for (const [input, listener] of this.filterInputs) {
      if (input.isConnected) continue;
      input.removeEventListener("input", listener);
      this.filterInputs.delete(input);
    }
    this.containers = active;
  }

  private getContainer(leaf: WorkspaceLeaf): HTMLElement | null {
    const view = leaf.view as { containerEl?: HTMLElement } | undefined;
    return view?.containerEl ?? null;
  }

  private applyContainer(container: HTMLElement, local: boolean, settings: GraphSettings, view: unknown): void {
    this.applyHomeFilter(view);
    if (!settings.enabled) {
      this.clearContainer(container);
      return;
    }
    const doc = container.ownerDocument;
    const bodyStyle = doc.defaultView?.getComputedStyle(doc.body);
    const rawHue = Number.parseFloat(bodyStyle?.getPropertyValue("--accent-h") || "350");
    const hue = Number.isFinite(rawHue) ? ((rawHue % 360) + 360) % 360 : 350;
    const dark = doc.body.classList.contains("theme-dark");
    const speed = Math.max(0.5, Math.min(1.5, settings.motionSpeed));

    container.classList.add("zendian-graph");
    container.classList.toggle("is-zendian-graph-motion", settings.motionEnabled);
    container.classList.toggle("is-zendian-graph-starfield", settings.starfieldEnabled);
    container.classList.toggle("is-zendian-graph-local-boost", local && settings.localGraphBoost);
    container.classList.toggle("is-zendian-graph-compact", settings.compactControls);
    container.style.setProperty("--zd-graph-nebula", String(settings.nebulaIntensity));
    container.style.setProperty("--zd-graph-drift-a", `${48 / speed}s`);
    container.style.setProperty("--zd-graph-drift-b", `${72 / speed}s`);
    container.style.setProperty("--zd-graph-nebula-texture", `url("${nebulaFilamentUrl}")`);
    container.style.setProperty("--zd-graph-h", String(hue));
    container.style.setProperty(
      "--graph-line",
      `hsl(${hue} 18% ${dark ? 70 : 52}% / ${local && settings.localGraphBoost ? 0.42 : 0.3})`,
    );
  }

  private clearContainer(container: HTMLElement): void {
    container.classList.remove(...GRAPH_CLASSES);
    for (const variable of GRAPH_VARIABLES) container.style.removeProperty(variable);
  }

  private applyHomeFilter(view: unknown): void {
    const graphView = view as {
      dataEngine?: GraphDataEngine;
      engine?: GraphDataEngine;
    };
    const engine = graphView.dataEngine ?? graphView.engine;
    const search = engine?.filterOptions?.search;
    const input = search?.inputEl;
    if (input) {
      this.ensureHomeFilter(input);
      if (!this.filterInputs.has(input)) {
        const listener: EventListener = () => {
          if (this.hasHomeFilter(input.value)) return;
          window.requestAnimationFrame(() => {
            if (input.isConnected) this.ensureHomeFilter(input);
          });
        };
        input.addEventListener("input", listener);
        this.filterInputs.set(input, listener);
      }
      return;
    }

    if (typeof search?.getValue === "function" && typeof search.setValue === "function") {
      const current = search.getValue();
      if (this.hasHomeFilter(current)) return;
      search.setValue(this.withHomeFilter(current));
      engine?.updateSearch?.();
    }
  }

  private ensureHomeFilter(input: HTMLInputElement): void {
    if (this.hasHomeFilter(input.value)) return;
    input.value = this.withHomeFilter(input.value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  private removeHomeFilter(input: HTMLInputElement): void {
    if (!this.hasHomeFilter(input.value)) return;
    input.value = input.value
      .replace(/(^|\s)-file:\.home(?=\s|$)/gi, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  private hasHomeFilter(query: string): boolean {
    return /(^|\s)-file:\.home(?=\s|$)/i.test(query);
  }

  private withHomeFilter(query: string): string {
    const trimmed = query.trim();
    return trimmed ? `${HOME_GRAPH_FILTER} ${trimmed}` : HOME_GRAPH_FILTER;
  }

  private scheduleNativeRefresh(): void {
    if (!this.ctx || this.nativeRefreshPending) return;
    this.nativeRefreshPending = true;
    this.refreshFrame = window.requestAnimationFrame(() => {
      this.nativeRefreshPending = false;
      this.refreshFrame = undefined;
      this.ctx?.app.workspace.trigger("css-change");
    });
  }
}

interface GraphDataEngine {
  filterOptions?: {
    search?: {
      inputEl?: HTMLInputElement;
      getValue?: () => string;
      setValue?: (value: string) => void;
    };
  };
  updateSearch?: () => void;
}
