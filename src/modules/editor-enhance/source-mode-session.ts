import {
  MarkdownView,
  Notice,
  type App,
  type EventRef,
  type WorkspaceLeaf,
} from "obsidian";
import {
  shouldRestoreSourceMode,
  type SourceModeRecord,
} from "./source-mode.math";

const ELIGIBLE_ATTRIBUTE = "data-zendian-typewriter-eligible";

export class SourceModeSession {
  private active = false;
  private eventRefs: EventRef[] = [];
  private records = new Map<WorkspaceLeaf, SourceModeRecord>();
  private pendingSwitches = new Map<WorkspaceLeaf, number>();
  private eligibleLeaf: WorkspaceLeaf | null = null;
  private scheduleFrame: number | null = null;
  private switchToken = 0;
  private generation = 0;

  constructor(
    private app: App,
    private onEligibilityChanged: () => void,
  ) {}

  start(): void {
    if (this.eventRefs.length) return;
    this.eventRefs.push(
      this.app.workspace.on("active-leaf-change", () => this.scheduleReconcile()),
      this.app.workspace.on("file-open", () => this.scheduleReconcile()),
      this.app.workspace.on("layout-change", () => this.scheduleReconcile()),
    );
  }

  setActive(active: boolean): void {
    if (this.active === active) {
      if (active) this.scheduleReconcile();
      return;
    }
    this.active = active;
    this.generation += 1;
    if (active) {
      this.scheduleReconcile();
    } else {
      this.cancelScheduledReconcile();
      this.setEligibleLeaf(null);
      void this.restoreAll();
    }
  }

  destroy(): void {
    this.active = false;
    this.generation += 1;
    this.cancelScheduledReconcile();
    this.setEligibleLeaf(null);
    for (const ref of this.eventRefs) this.app.workspace.offref(ref);
    this.eventRefs = [];
    void this.restoreAll();
  }

  private scheduleReconcile(): void {
    if (!this.active || this.scheduleFrame !== null) return;
    const ownerWindow = this.app.workspace.containerEl.ownerDocument.defaultView;
    this.scheduleFrame = ownerWindow?.requestAnimationFrame(() => {
      this.scheduleFrame = null;
      void this.reconcileActiveLeaf();
    }) ?? null;
    if (!ownerWindow) void this.reconcileActiveLeaf();
  }

  private cancelScheduledReconcile(): void {
    if (this.scheduleFrame === null) return;
    this.app.workspace.containerEl.ownerDocument.defaultView?.cancelAnimationFrame(this.scheduleFrame);
    this.scheduleFrame = null;
  }

  private async reconcileActiveLeaf(): Promise<void> {
    if (!this.active) return;
    const leaf = this.app.workspace.activeLeaf;
    if (!leaf || !(leaf.view instanceof MarkdownView)) {
      this.setEligibleLeaf(null);
      return;
    }

    const state = leaf.getViewState();
    const mode = state.state?.mode;
    if (mode === "preview" || leaf.view.getMode() === "preview") {
      this.setEligibleLeaf(null);
      return;
    }

    const isSource = state.state?.source === true;
    const record = this.records.get(leaf);
    const currentPath = leaf.view.file?.path ?? null;
    if (record && record.filePathAtSwitch !== currentPath) {
      this.records.delete(leaf);
      if (!isSource) {
        await this.switchLeafToSource(leaf);
        return;
      }
    }
    if (isSource) {
      this.setEligibleLeaf(leaf);
      return;
    }

    if (this.pendingSwitches.has(leaf)) {
      this.setEligibleLeaf(null);
      return;
    }

    if (record?.switchedByPlugin) {
      record.manuallyOverridden = true;
      this.setEligibleLeaf(null);
      if (!record.noticeShown) {
        record.noticeShown = true;
        new Notice("打字机滚动已暂停，仅在源码模式中运行");
      }
      return;
    }

    await this.switchLeafToSource(leaf);
  }

  private async switchLeafToSource(leaf: WorkspaceLeaf): Promise<void> {
    const state = leaf.getViewState();
    const token = ++this.switchToken;
    const switchGeneration = this.generation;
    const record: SourceModeRecord = {
      originalWasSource: state.state?.source === true,
      switchedByPlugin: true,
      manuallyOverridden: false,
      filePathAtSwitch: leaf.view instanceof MarkdownView ? leaf.view.file?.path ?? null : null,
      noticeShown: false,
    };
    this.pendingSwitches.set(leaf, token);
    this.records.set(leaf, record);

    try {
      await leaf.setViewState(
        {
          ...state,
          state: {
            ...state.state,
            mode: "source",
            source: true,
          },
        },
        leaf.getEphemeralState(),
      );
      if (switchGeneration !== this.generation) {
        if (this.active) this.records.set(leaf, record);
        else await this.restoreLeaf(leaf, record);
      }
    } finally {
      const ownerWindow = leaf.view.containerEl.ownerDocument.defaultView;
      ownerWindow?.requestAnimationFrame(() => {
        if (this.pendingSwitches.get(leaf) === token) this.pendingSwitches.delete(leaf);
        this.scheduleReconcile();
      });
    }
  }

  private setEligibleLeaf(leaf: WorkspaceLeaf | null): void {
    if (this.eligibleLeaf === leaf) {
      if (leaf) leaf.view.containerEl.setAttribute(ELIGIBLE_ATTRIBUTE, "true");
      this.onEligibilityChanged();
      return;
    }
    this.eligibleLeaf?.view.containerEl.removeAttribute(ELIGIBLE_ATTRIBUTE);
    this.eligibleLeaf = leaf;
    leaf?.view.containerEl.setAttribute(ELIGIBLE_ATTRIBUTE, "true");
    this.onEligibilityChanged();
  }

  private async restoreAll(): Promise<void> {
    const entries = Array.from(this.records.entries());
    this.records.clear();
    this.pendingSwitches.clear();
    for (const [leaf, record] of entries) {
      await this.restoreLeaf(leaf, record);
    }
    this.onEligibilityChanged();
  }

  private async restoreLeaf(leaf: WorkspaceLeaf, record: SourceModeRecord): Promise<void> {
    if (!(leaf.view instanceof MarkdownView)) return;
    const state = leaf.getViewState();
    if (!shouldRestoreSourceMode(record, state.state?.source === true)) return;
    try {
      await leaf.setViewState(
        {
          ...state,
          state: {
            ...state.state,
            mode: "source",
            source: false,
          },
        },
        leaf.getEphemeralState(),
      );
    } catch (error) {
      console.warn("[ZENdian] Failed to restore Markdown source mode", error);
    }
  }
}
