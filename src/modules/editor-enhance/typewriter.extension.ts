import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import {
  StateField,
  type EditorState,
  type Extension,
} from "@codemirror/state";
import {
  calculateAnchor,
  calculateMotionDuration,
  calculateScrollTarget,
  easeOutCubic,
  mergeMotionOffset,
} from "./typewriter.math";
import type {
  TypewriterRuntimeClient,
  TypewriterRuntimeStore,
} from "./typewriter-runtime";

const ELIGIBLE_SELECTOR = "[data-zendian-typewriter-eligible]";
const ACTIVE_ATTRIBUTE = "data-zendian-typewriter-active";
const OFFSET_VAR = "--zendian-typewriter-content-offset";
const TOP_SPACER_VAR = "--zendian-typewriter-top-spacer";
const BOTTOM_SPACER_VAR = "--zendian-typewriter-bottom-spacer";
const POSITION_TOLERANCE = 2;

type SuspensionReason = "none" | "manual-scroll" | "pointer-selection";
type MeasureCause = "activation" | "input" | "navigation" | "geometry" | "composition";

interface MeasureIntent {
  cause: MeasureCause;
  animate: boolean;
}

interface TypewriterMeasurement {
  enabled: boolean;
  desiredScrollTop: number;
  appliedDelta: number;
  topSpacer: number;
  bottomSpacer: number;
  duration: number;
}

interface MotionState {
  frame: number | null;
  startOffset: number;
  currentOffset: number;
  startedAt: number;
  duration: number;
}

class TypewriterSpacerWidget extends WidgetType {
  constructor(private position: "top" | "bottom") {
    super();
  }

  eq(other: TypewriterSpacerWidget): boolean {
    return other.position === this.position;
  }

  toDOM(view: EditorView): HTMLElement {
    const element = view.dom.ownerDocument.createElement("div");
    element.className = `zendian-typewriter-spacer zendian-typewriter-spacer--${this.position}`;
    element.setAttribute("aria-hidden", "true");
    return element;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

function createSpacers(state: EditorState): DecorationSet {
  return Decoration.set(
    [
      Decoration.widget({
        widget: new TypewriterSpacerWidget("top"),
        block: true,
        side: -1,
      }).range(0),
      Decoration.widget({
        widget: new TypewriterSpacerWidget("bottom"),
        block: true,
        side: 1,
      }).range(state.doc.length),
    ],
    true,
  );
}

/**
 * Block widgets affect CodeMirror's vertical layout. They must be supplied
 * through a direct `EditorView.decorations` facet, not through a ViewPlugin's
 * indirect `decorations` getter. Otherwise CodeMirror rejects the entire view
 * during Markdown file opening.
 */
const typewriterSpacerField = StateField.define<DecorationSet>({
  create: (state) => createSpacers(state),
  update: (spacers, transaction) =>
    transaction.docChanged ? createSpacers(transaction.state) : spacers.map(transaction.changes),
  provide: (field) => EditorView.decorations.from(field),
});

function transactionMatches(update: ViewUpdate, event: string): boolean {
  return update.transactions.some((transaction) => transaction.isUserEvent(event));
}

class TypewriterViewController implements TypewriterRuntimeClient {
  private unregisterRuntime: (() => void) | null;
  private enabled = false;
  private suspension: SuspensionReason = "none";
  private expectedProgrammaticScrollTop: number | null = null;
  private pendingIntent: MeasureIntent | null = null;
  private pointerSettleFrame: number | null = null;
  private topSpacer = 0;
  private bottomSpacer = 0;
  private motion: MotionState = {
    frame: null,
    startOffset: 0,
    currentOffset: 0,
    startedAt: 0,
    duration: 0,
  };

  private readonly onWheel = (): void => {
    this.expectedProgrammaticScrollTop = null;
    this.suspendForManualScroll();
  };
  private readonly onTouchStart = (): void => {
    this.expectedProgrammaticScrollTop = null;
    this.suspendForManualScroll();
  };
  private readonly onScroll = (): void => {
    if (
      this.expectedProgrammaticScrollTop !== null &&
      Math.abs(this.view.scrollDOM.scrollTop - this.expectedProgrammaticScrollTop) <= 1
    ) {
      this.expectedProgrammaticScrollTop = null;
      return;
    }
    this.expectedProgrammaticScrollTop = null;
    if (!this.enabled || this.suspension === "manual-scroll") return;
    if (this.view.hasFocus && this.suspension === "none") {
      this.scheduleMeasure({ cause: "geometry", animate: false });
    }
  };
  private readonly onPointerDown = (event: PointerEvent): void => {
    if (!this.enabled) return;
    if (!event.target || !this.view.contentDOM.contains(event.target as Node)) {
      this.suspension = "manual-scroll";
      this.pendingIntent = null;
      this.clearMotion();
      return;
    }
    this.suspension = "pointer-selection";
    this.clearMotion();
    this.view.dom.ownerDocument.addEventListener("pointerup", this.onPointerUp, { once: true });
  };
  private readonly onPointerUp = (): void => {
    if (this.suspension !== "pointer-selection") return;
    const ownerWindow = this.view.dom.ownerDocument.defaultView;
    if (!ownerWindow) return;
    if (this.pointerSettleFrame !== null) ownerWindow.cancelAnimationFrame(this.pointerSettleFrame);
    this.pointerSettleFrame = ownerWindow.requestAnimationFrame(() => {
      this.pointerSettleFrame = null;
      if (!this.enabled || !this.view.hasFocus) return;
      const selection = this.view.state.selection;
      if (!selection.main.empty || selection.ranges.length !== 1) {
        this.suspension = "manual-scroll";
        return;
      }
      this.suspension = "none";
      this.scheduleMeasure({ cause: "navigation", animate: false });
    });
  };
  private readonly onCompositionEnd = (): void => {
    if (!this.enabled) return;
    this.suspension = "none";
    this.scheduleMeasure({ cause: "composition", animate: true });
  };
  private readonly onFocusIn = (): void => this.onTypewriterRuntimeChanged();
  private readonly onFocusOut = (): void => {
    this.pendingIntent = null;
    this.clearMotion();
  };

  private isPureSourceEditor(): boolean {
    const sourceView = this.view.dom.closest(".markdown-source-view.mod-cm6");
    return Boolean(
      this.view.dom.closest(ELIGIBLE_SELECTOR) ||
      (sourceView && !sourceView.classList.contains("is-live-preview")),
    );
  }

  private isRuntimeRequested(): boolean {
    const ownerBody = this.view.dom.ownerDocument.body;
    return this.runtime.isActive() || ownerBody.classList.contains("focus-mode-typewriter");
  }

  constructor(
    private view: EditorView,
    private runtime: TypewriterRuntimeStore,
  ) {
    this.unregisterRuntime = runtime.register(this);
    view.scrollDOM.addEventListener("wheel", this.onWheel, { passive: true });
    view.scrollDOM.addEventListener("touchstart", this.onTouchStart, { passive: true });
    view.scrollDOM.addEventListener("scroll", this.onScroll, { passive: true });
    view.scrollDOM.addEventListener("pointerdown", this.onPointerDown, true);
    view.contentDOM.addEventListener("compositionend", this.onCompositionEnd);
    view.dom.addEventListener("focusin", this.onFocusIn);
    view.dom.addEventListener("focusout", this.onFocusOut);
    this.onTypewriterRuntimeChanged();
  }

  update(update: ViewUpdate): void {
    if (update.focusChanged) this.onTypewriterRuntimeChanged();
    if (!this.enabled) return;

    const userEdited =
      update.docChanged &&
      (
        update.view.hasFocus ||
        transactionMatches(update, "input") ||
        transactionMatches(update, "delete") ||
        transactionMatches(update, "undo") ||
        transactionMatches(update, "redo")
      );
    const pointerSelection = transactionMatches(update, "select.pointer");

    if (pointerSelection) {
      if (this.suspension !== "pointer-selection") this.suspension = "manual-scroll";
      this.clearMotion();
      return;
    }

    if (userEdited) {
      this.suspension = "none";
      this.scheduleMeasure({
        cause: update.view.composing ? "composition" : "input",
        animate: !update.view.composing,
      });
      return;
    }

    if (update.selectionSet && this.suspension === "none") {
      this.scheduleMeasure({ cause: "navigation", animate: true });
      return;
    }

    if (update.geometryChanged && this.suspension === "none") {
      this.scheduleMeasure({ cause: "geometry", animate: false });
    }
  }

  onTypewriterRuntimeChanged(): void {
    const shouldEnable =
      this.isRuntimeRequested() &&
      this.isPureSourceEditor();
    if (this.enabled === shouldEnable) {
      if (shouldEnable) {
        if (this.view.hasFocus) {
          this.scheduleMeasure({ cause: "activation", animate: false });
        } else {
          this.pendingIntent = null;
          this.clearMotion();
        }
      }
      return;
    }
    this.enabled = shouldEnable;
    if (shouldEnable) {
      this.view.dom.setAttribute(ACTIVE_ATTRIBUTE, "true");
      this.suspension = "none";
      this.scheduleMeasure({ cause: "activation", animate: false });
    } else {
      this.view.dom.removeAttribute(ACTIVE_ATTRIBUTE);
      this.pendingIntent = null;
      this.suspension = "none";
      this.clearMotion();
      this.resetSpacers();
    }
  }

  destroy(): void {
    this.unregisterRuntime?.();
    this.unregisterRuntime = null;
    this.view.scrollDOM.removeEventListener("wheel", this.onWheel);
    this.view.scrollDOM.removeEventListener("touchstart", this.onTouchStart);
    this.view.scrollDOM.removeEventListener("scroll", this.onScroll);
    this.view.scrollDOM.removeEventListener("pointerdown", this.onPointerDown, true);
    this.view.contentDOM.removeEventListener("compositionend", this.onCompositionEnd);
    this.view.dom.removeEventListener("focusin", this.onFocusIn);
    this.view.dom.removeEventListener("focusout", this.onFocusOut);
    this.view.dom.ownerDocument.removeEventListener("pointerup", this.onPointerUp);
    if (this.pointerSettleFrame !== null) {
      this.view.dom.ownerDocument.defaultView?.cancelAnimationFrame(this.pointerSettleFrame);
      this.pointerSettleFrame = null;
    }
    this.view.dom.removeAttribute(ACTIVE_ATTRIBUTE);
    this.clearMotion();
    this.resetSpacers();
  }

  private suspendForManualScroll(): void {
    if (!this.enabled) return;
    this.suspension = "manual-scroll";
    this.pendingIntent = null;
    this.clearMotion();
  }

  private scheduleMeasure(intent: MeasureIntent): void {
    if (!this.enabled || !this.view.hasFocus || this.suspension !== "none") return;
    if (this.pendingIntent) {
      this.pendingIntent = {
        cause: intent.cause,
        animate: this.pendingIntent.animate || intent.animate,
      };
    } else {
      this.pendingIntent = intent;
    }

    this.view.requestMeasure<TypewriterMeasurement>({
      key: this,
      read: (view) => this.readMeasurement(view),
      write: (measurement) => this.writeMeasurement(measurement),
    });
  }

  private readMeasurement(view: EditorView): TypewriterMeasurement {
    const intent = this.pendingIntent;
    this.pendingIntent = null;
    if (!intent || !this.enabled || !view.hasFocus || this.suspension !== "none") {
      return this.disabledMeasurement();
    }

    const selection = view.state.selection;
    const main = selection.main;
    const scrollDOM = view.scrollDOM;
    const scrollRect = scrollDOM.getBoundingClientRect();
    const anchor = calculateAnchor(scrollDOM.clientHeight);
    const assoc = main.assoc < 0 ? -1 : 1;
    const primaryCoords = view.coordsAtPos(main.head, assoc);
    const secondaryCoords = primaryCoords ?? view.coordsAtPos(main.head, assoc === 1 ? -1 : 1);
    const block = secondaryCoords ? null : view.lineBlockAt(main.head);
    const caretTop = secondaryCoords?.top ?? view.documentTop + (block?.top ?? 0);
    const caretBottom = secondaryCoords?.bottom ?? caretTop + (block?.height ?? view.defaultLineHeight);
    if (!Number.isFinite(caretTop) || !Number.isFinite(caretBottom)) {
      return this.disabledMeasurement();
    }

    const caretHeight = Math.max(1, caretBottom - caretTop);
    const topSpacer = Math.max(0, anchor.anchorLocalY - caretHeight / 2);
    const bottomSpacer = Math.max(
      0,
      scrollDOM.clientHeight - anchor.anchorLocalY - caretHeight / 2,
    );
    const caretCenter = (caretTop + caretBottom) / 2;
    const anchorScreenY = scrollRect.top + anchor.anchorLocalY;
    const delta = caretCenter - anchorScreenY;
    const target =
      Math.abs(delta) <= POSITION_TOLERANCE
        ? { desiredScrollTop: scrollDOM.scrollTop, appliedDelta: 0 }
        : calculateScrollTarget(
            scrollDOM.scrollTop,
            delta,
            scrollDOM.scrollHeight,
            scrollDOM.clientHeight,
          );
    const reducedMotion =
      view.dom.ownerDocument.defaultView?.matchMedia("(prefers-reduced-motion: reduce)").matches ??
      false;
    const canAnimate =
      intent.animate &&
      main.empty &&
      selection.ranges.length === 1 &&
      !view.composing;
    const duration = canAnimate
      ? calculateMotionDuration(
          target.appliedDelta,
          view.defaultLineHeight,
          anchor.smallViewport,
          reducedMotion,
        )
      : 0;

    return {
      enabled: true,
      desiredScrollTop: target.desiredScrollTop,
      appliedDelta: target.appliedDelta,
      topSpacer,
      bottomSpacer,
      duration,
    };
  }

  private writeMeasurement(measurement: TypewriterMeasurement): void {
    if (!measurement.enabled || !this.enabled || !this.view.hasFocus) return;
    const spacerChanged =
      Math.abs(measurement.topSpacer - this.topSpacer) > 0.5 ||
      Math.abs(measurement.bottomSpacer - this.bottomSpacer) > 0.5;
    if (spacerChanged) {
      this.topSpacer = measurement.topSpacer;
      this.bottomSpacer = measurement.bottomSpacer;
      this.view.dom.style.setProperty(TOP_SPACER_VAR, `${this.topSpacer}px`);
      this.view.dom.style.setProperty(BOTTOM_SPACER_VAR, `${this.bottomSpacer}px`);
    }

    if (Math.abs(measurement.appliedDelta) > 0.5) {
      this.expectedProgrammaticScrollTop = measurement.desiredScrollTop;
      this.view.scrollDOM.scrollTop = measurement.desiredScrollTop;
      if (measurement.duration > 0) {
        this.startMotion(measurement.appliedDelta, measurement.duration);
      } else {
        this.clearMotion();
      }
    }

    if (spacerChanged) {
      const ownerWindow = this.view.dom.ownerDocument.defaultView;
      ownerWindow?.requestAnimationFrame(() => {
        if (this.enabled) this.scheduleMeasure({ cause: "geometry", animate: false });
      });
    }
  }

  private startMotion(appliedDelta: number, duration: number): void {
    const ownerWindow = this.view.dom.ownerDocument.defaultView;
    if (!ownerWindow) {
      this.clearMotion();
      return;
    }
    const now = ownerWindow.performance.now();
    const currentOffset = this.getCurrentMotionOffset(now);
    if (this.motion.frame !== null) ownerWindow.cancelAnimationFrame(this.motion.frame);
    const startOffset = mergeMotionOffset(currentOffset, appliedDelta);
    this.motion = {
      frame: null,
      startOffset,
      currentOffset: startOffset,
      startedAt: now,
      duration,
    };
    this.setOffset(startOffset);

    const animate = (time: number): void => {
      const progress = Math.min(1, (time - this.motion.startedAt) / this.motion.duration);
      const offset = this.motion.startOffset * (1 - easeOutCubic(progress));
      this.motion.currentOffset = offset;
      this.setOffset(offset);
      if (progress >= 1 || !this.enabled) {
        this.motion.frame = null;
        this.setOffset(0);
        return;
      }
      this.motion.frame = ownerWindow.requestAnimationFrame(animate);
    };
    this.motion.frame = ownerWindow.requestAnimationFrame(animate);
  }

  private getCurrentMotionOffset(now: number): number {
    if (this.motion.frame === null || this.motion.duration <= 0) return 0;
    const progress = Math.min(1, (now - this.motion.startedAt) / this.motion.duration);
    return this.motion.startOffset * (1 - easeOutCubic(progress));
  }

  private clearMotion(): void {
    const ownerWindow = this.view.dom.ownerDocument.defaultView;
    if (this.motion.frame !== null) ownerWindow?.cancelAnimationFrame(this.motion.frame);
    this.motion = {
      frame: null,
      startOffset: 0,
      currentOffset: 0,
      startedAt: 0,
      duration: 0,
    };
    this.setOffset(0);
  }

  private setOffset(offset: number): void {
    const normalized = Math.abs(offset) < 0.05 ? 0 : offset;
    this.view.dom.style.setProperty(OFFSET_VAR, `${normalized}px`);
  }

  private resetSpacers(): void {
    this.topSpacer = 0;
    this.bottomSpacer = 0;
    this.view.dom.style.setProperty(TOP_SPACER_VAR, "0px");
    this.view.dom.style.setProperty(BOTTOM_SPACER_VAR, "0px");
    this.expectedProgrammaticScrollTop = null;
    this.view.requestMeasure();
  }

  private disabledMeasurement(): TypewriterMeasurement {
    return {
      enabled: false,
      desiredScrollTop: this.view.scrollDOM.scrollTop,
      appliedDelta: 0,
      topSpacer: this.topSpacer,
      bottomSpacer: this.bottomSpacer,
      duration: 0,
    };
  }
}

export function createTypewriterExtension(runtime: TypewriterRuntimeStore): Extension {
  return [
    typewriterSpacerField,
    ViewPlugin.fromClass(
      class extends TypewriterViewController {
        constructor(view: EditorView) {
          super(view, runtime);
        }
      },
    ),
  ];
}
