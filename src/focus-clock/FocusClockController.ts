import { App, Notice, setIcon } from "obsidian";
import type { EventBus } from "../core/event-bus";
import { Events } from "../core/event-bus";
import type { SettingsManager } from "../core/settings-manager";
import type {
  ActiveFocusSession,
  FocusSegment,
  FocusSessionRecord,
} from "../services/ActivityLogService";
import type { ActivityLogService } from "../services/ActivityLogService";
import type { PluginSettings } from "../types/settings.types";

interface BreakState {
  status: "running" | "paused";
  plannedSeconds: number;
  elapsedSeconds: number;
  activeStartedAt?: number;
}

export class FocusClockController {
  private panelEl: HTMLElement | null = null;
  private ticker: number | null = null;
  private settingsUnsub: (() => void) | null = null;
  private outsidePointerHandler: ((event: PointerEvent) => void) | null = null;
  private session: ActiveFocusSession | null = null;
  private breakState: BreakState | null = null;
  private selectedMinutes = 25;
  private temporarilyEnabledFocusMode = false;
  private completionFlashTimer: number | null = null;

  constructor(
    private app: App,
    private statusEl: HTMLElement,
    private settingsManager: SettingsManager,
    private events: EventBus,
    private activityLog: ActivityLogService,
  ) {}

  load(): void {
    this.statusEl.addClass("zendian-focus-clock-status");
    this.selectedMinutes = this.settingsManager.getSettings().editorEnhance.focusClockDefaultMinutes;
    this.session = this.activityLog.getActiveFocusSession();

    if (this.session) {
      if (this.getFocusRemainingSeconds() <= 0) this.completeFocusSession("completed", true);
      else {
        this.applyTemporaryFocusMode(true);
        document.body.addClass("zendian-focus-clock-active");
        if (this.session.status === "running") this.startTicker();
      }
    }

    this.settingsUnsub = this.events.on(
      Events.SETTINGS_CHANGED,
      (changedKeys: string[], settings: PluginSettings) => {
        if (!changedKeys.includes("editorEnhance")) return;
        this.selectedMinutes = settings.editorEnhance.focusClockDefaultMinutes;
        if (this.session) this.applyTemporaryFocusMode(true);
        this.renderStatus();
      },
    );
    this.renderStatus();
  }

  unload(): void {
    this.closePanel();
    this.stopTicker();
    if (this.completionFlashTimer !== null) window.clearTimeout(this.completionFlashTimer);
    this.settingsUnsub?.();
    this.settingsUnsub = null;
    this.applyTemporaryFocusMode(false);
    document.body.removeClass("zendian-focus-clock-active");
    this.statusEl.empty();
  }

  openPanel(): void {
    if (!this.settingsManager.getSettings().editorEnhance.focusClockEnabled && !this.session && !this.breakState) {
      new Notice("请先在 ZENdian 设置中启用专注时钟");
      return;
    }
    if (this.panelEl) {
      this.closePanel();
      return;
    }
    this.panelEl = this.app.workspace.containerEl.createDiv({
      cls: "zendian-focus-clock-panel",
      attr: { role: "dialog", "aria-label": "专注时钟" },
    });
    if (this.session) this.renderFocusDetail();
    else if (this.breakState) this.renderBreakDetail();
    else this.renderSetup();
    this.positionPanel();

    window.setTimeout(() => {
      this.outsidePointerHandler = (event: PointerEvent) => {
        const target = event.target as Node | null;
        if (target && !this.panelEl?.contains(target) && !this.statusEl.contains(target)) this.closePanel();
      };
      document.addEventListener("pointerdown", this.outsidePointerHandler, true);
    });
  }

  togglePause(): void {
    if (this.session) {
      if (this.session.status === "running") this.pauseFocus();
      else this.resumeFocus();
      return;
    }
    if (this.breakState) {
      if (this.breakState.status === "running") {
        this.breakState.elapsedSeconds += (Date.now() - (this.breakState.activeStartedAt ?? Date.now())) / 1000;
        this.breakState.status = "paused";
        delete this.breakState.activeStartedAt;
        this.stopTicker();
      } else {
        this.breakState.status = "running";
        this.breakState.activeStartedAt = Date.now();
        this.startTicker();
      }
      this.renderStatus();
      if (this.panelEl) this.renderBreakDetail();
    }
  }

  private renderStatus(): void {
    this.statusEl.empty();
    const enabled = this.settingsManager.getSettings().editorEnhance.focusClockEnabled;
    this.statusEl.toggleClass("is-hidden", !enabled && !this.session && !this.breakState);
    if (!enabled && !this.session && !this.breakState) return;

    if (!this.session && !this.breakState) {
      const button = this.createStatusIconButton(
        this.statusEl,
        "timer",
        "打开专注时钟",
        () => this.openPanel(),
        "zendian-focus-clock-entry",
      );
      button.toggleClass("is-complete", this.completionFlashTimer !== null);
      if (this.completionFlashTimer !== null) {
        button.empty();
        setIcon(button, "check");
      }
      return;
    }

    const isBreak = Boolean(this.breakState);
    const remaining = isBreak ? this.getBreakRemainingSeconds() : this.getFocusRemainingSeconds();
    const main = this.statusEl.createEl("button", {
      cls: "zendian-focus-clock-time",
      attr: { type: "button", title: isBreak ? "查看休息计时" : "查看专注进度", "aria-label": isBreak ? "查看休息计时" : "查看专注进度" },
    });
    setIcon(main, isBreak ? "coffee" : "timer");
    main.createSpan({ cls: "zendian-focus-clock-time-text", text: this.formatClock(remaining) });
    const progress = isBreak
      ? 1 - remaining / Math.max(1, this.breakState!.plannedSeconds)
      : 1 - remaining / Math.max(1, this.session!.plannedSeconds);
    main.style.setProperty("--zd-focus-progress", `${Math.max(0, Math.min(1, progress)) * 360}deg`);
    main.addEventListener("click", () => this.openPanel());

    const paused = isBreak ? this.breakState!.status === "paused" : this.session!.status === "paused";
    this.createStatusIconButton(
      this.statusEl,
      paused ? "play" : "pause",
      paused ? "继续" : "暂停",
      () => this.togglePause(),
    );
    this.createStatusIconButton(
      this.statusEl,
      isBreak ? "skip-forward" : "square",
      isBreak ? "结束休息" : "结束专注",
      () => isBreak ? this.endBreak() : this.openEndConfirmation(),
    );
  }

  private renderSetup(): void {
    if (!this.panelEl) return;
    this.panelEl.empty();
    this.renderPanelHeader("专注时钟");

    const dial = this.panelEl.createDiv("zendian-focus-clock-dial");
    dial.style.setProperty("--zd-focus-progress", "0deg");
    dial.createDiv({ cls: "zendian-focus-clock-dial-time", text: this.formatClock(this.selectedMinutes * 60) });
    dial.createDiv({ cls: "zendian-focus-clock-dial-label", text: "准备专注" });

    const presets = this.panelEl.createDiv({ cls: "zendian-focus-clock-presets", attr: { role: "group", "aria-label": "选择专注时长" } });
    for (const minutes of [25, 50, 90]) {
      const button = presets.createEl("button", { text: `${minutes}`, attr: { type: "button", "aria-label": `${minutes} 分钟` } });
      button.toggleClass("is-selected", minutes === this.selectedMinutes);
      button.addEventListener("click", () => {
        this.selectedMinutes = minutes;
        this.renderSetup();
      });
    }
    const custom = presets.createEl("input", {
      type: "number",
      value: String(this.selectedMinutes),
      attr: { min: "1", max: "180", step: "1", "aria-label": "自定义专注分钟数", title: "自定义分钟数" },
    });
    custom.addEventListener("change", () => {
      this.selectedMinutes = Math.max(1, Math.min(180, Number(custom.value) || 25));
      this.renderSetup();
    });

    const activeFile = this.app.workspace.getActiveFile();
    const targetField = this.panelEl.createDiv("zendian-focus-clock-field");
    targetField.createEl("label", { text: "专注目标" });
    const targetInput = targetField.createEl("input", {
      type: "text",
      value: activeFile?.basename ?? "",
      placeholder: "例如：完成方案初稿",
      attr: { maxlength: "120" },
    });

    const breakMinutes = this.settingsManager.getSettings().editorEnhance.focusClockBreakMinutes;
    const breakRow = this.panelEl.createDiv({ cls: "zendian-focus-clock-break-row" });
    const breakToggle = breakRow.createEl("input", { type: "checkbox" });
    breakToggle.checked = breakMinutes > 0;
    breakRow.createSpan({ text: "完成后休息" });
    const breakInput = breakRow.createEl("input", {
      type: "number",
      value: String(Math.max(1, breakMinutes || 5)),
      attr: { min: "1", max: "30", step: "1", "aria-label": "休息分钟数" },
    });
    breakRow.createSpan({ cls: "zendian-focus-clock-unit", text: "分钟" });
    breakInput.disabled = !breakToggle.checked;
    breakToggle.addEventListener("change", () => { breakInput.disabled = !breakToggle.checked; });

    const startButton = this.panelEl.createEl("button", {
      cls: "zendian-focus-clock-primary",
      attr: { type: "button" },
    });
    setIcon(startButton, "play");
    startButton.createSpan({ text: "开始专注" });
    startButton.addEventListener("click", () => {
      const targetLabel = targetInput.value.trim() || activeFile?.basename || "未命名专注";
      const targetPath = activeFile && targetLabel === activeFile.basename ? activeFile.path : undefined;
      const selectedBreak = breakToggle.checked ? Math.max(1, Math.min(30, Number(breakInput.value) || 5)) : 0;
      this.startFocus(this.selectedMinutes, targetLabel, targetPath, selectedBreak);
    });
  }

  private renderFocusDetail(showConfirmation = false): void {
    if (!this.panelEl || !this.session) return;
    this.panelEl.empty();
    this.renderPanelHeader(this.session.status === "paused" ? "专注已暂停" : "正在专注");
    const remaining = this.getFocusRemainingSeconds();
    const progress = 1 - remaining / Math.max(1, this.session.plannedSeconds);
    const dial = this.panelEl.createDiv("zendian-focus-clock-dial");
    dial.style.setProperty("--zd-focus-progress", `${Math.max(0, Math.min(1, progress)) * 360}deg`);
    dial.createDiv({ cls: "zendian-focus-clock-dial-time", text: this.formatClock(remaining) });
    dial.createDiv({ cls: "zendian-focus-clock-dial-label", text: this.session.status === "paused" ? "稍作停顿" : "保持此刻" });
    this.panelEl.createDiv({ cls: "zendian-focus-clock-target", text: this.session.targetLabel });

    if (showConfirmation) {
      const confirmation = this.panelEl.createDiv("zendian-focus-clock-confirm");
      confirmation.createDiv({ cls: "zendian-focus-clock-confirm-title", text: "结束本次专注？" });
      const actions = confirmation.createDiv("zendian-focus-clock-confirm-actions");
      const record = actions.createEl("button", { text: "完成并记录", attr: { type: "button" } });
      record.addClass("is-primary");
      record.addEventListener("click", () => this.completeFocusSession("ended", false));
      const abandon = actions.createEl("button", { text: "放弃本次", attr: { type: "button" } });
      abandon.addEventListener("click", () => this.completeFocusSession("abandoned", false));
      return;
    }

    const actions = this.panelEl.createDiv("zendian-focus-clock-detail-actions");
    const extend = actions.createEl("button", { attr: { type: "button", title: "延长 5 分钟", "aria-label": "延长 5 分钟" } });
    setIcon(extend, "plus");
    extend.createSpan({ text: "5 分钟" });
    extend.addEventListener("click", () => {
      if (!this.session) return;
      this.session.plannedSeconds += 300;
      this.activityLog.setActiveFocusSession(this.session);
      this.renderFocusDetail();
      this.renderStatus();
    });
    const toggle = actions.createEl("button", { attr: { type: "button" } });
    setIcon(toggle, this.session.status === "paused" ? "play" : "pause");
    toggle.createSpan({ text: this.session.status === "paused" ? "继续" : "暂停" });
    toggle.addEventListener("click", () => this.togglePause());
  }

  private renderBreakDetail(): void {
    if (!this.panelEl || !this.breakState) return;
    this.panelEl.empty();
    this.renderPanelHeader(this.breakState.status === "paused" ? "休息已暂停" : "休息一下");
    const remaining = this.getBreakRemainingSeconds();
    const progress = 1 - remaining / Math.max(1, this.breakState.plannedSeconds);
    const dial = this.panelEl.createDiv("zendian-focus-clock-dial is-break");
    dial.style.setProperty("--zd-focus-progress", `${Math.max(0, Math.min(1, progress)) * 360}deg`);
    dial.createDiv({ cls: "zendian-focus-clock-dial-time", text: this.formatClock(remaining) });
    dial.createDiv({ cls: "zendian-focus-clock-dial-label", text: "让眼睛离开屏幕" });
    const end = this.panelEl.createEl("button", { cls: "zendian-focus-clock-secondary", attr: { type: "button" } });
    setIcon(end, "skip-forward");
    end.createSpan({ text: "结束休息" });
    end.addEventListener("click", () => this.endBreak());
  }

  private renderPanelHeader(title: string): void {
    if (!this.panelEl) return;
    const header = this.panelEl.createDiv("zendian-focus-clock-header");
    const titleWrap = header.createDiv("zendian-focus-clock-title");
    const icon = titleWrap.createSpan();
    setIcon(icon, "timer");
    titleWrap.createSpan({ text: title });
    const close = header.createEl("button", { attr: { type: "button", title: "关闭", "aria-label": "关闭" } });
    setIcon(close, "x");
    close.addEventListener("click", () => this.closePanel());
  }

  private startFocus(minutes: number, targetLabel: string, targetPath: string | undefined, breakMinutes: number): void {
    const now = Date.now();
    this.session = {
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      status: "running",
      startedAt: now,
      plannedSeconds: Math.max(60, Math.round(minutes * 60)),
      targetLabel,
      targetPath,
      segments: [],
      activeSegmentStartedAt: now,
      breakMinutes,
    };
    this.activityLog.setActiveFocusSession(this.session);
    this.applyTemporaryFocusMode(true);
    document.body.addClass("zendian-focus-clock-active");
    this.closePanel();
    this.startTicker();
    this.renderStatus();
  }

  private pauseFocus(): void {
    if (!this.session || this.session.status !== "running") return;
    this.finalizeActiveSegment(Date.now());
    this.session.status = "paused";
    this.activityLog.setActiveFocusSession(this.session);
    this.stopTicker();
    this.renderStatus();
    if (this.panelEl) this.renderFocusDetail();
  }

  private resumeFocus(): void {
    if (!this.session || this.session.status !== "paused") return;
    this.session.status = "running";
    this.session.activeSegmentStartedAt = Date.now();
    this.activityLog.setActiveFocusSession(this.session);
    this.startTicker();
    this.renderStatus();
    if (this.panelEl) this.renderFocusDetail();
  }

  private completeFocusSession(status: FocusSessionRecord["status"], natural: boolean): void {
    if (!this.session) return;
    const session = this.session;
    if (session.status === "running") this.finalizeActiveSegment(Date.now());
    const focusedSeconds = Math.round(session.segments.reduce((sum, segment) => sum + (segment.end - segment.start) / 1000, 0));
    const record: FocusSessionRecord = {
      id: session.id,
      startedAt: session.startedAt,
      endedAt: Date.now(),
      plannedSeconds: session.plannedSeconds,
      focusedSeconds,
      status,
      targetLabel: session.targetLabel,
      targetPath: session.targetPath,
    };
    this.activityLog.recordFocusSession(record, session.segments);
    const breakMinutes = natural && status === "completed" ? session.breakMinutes : 0;
    this.session = null;
    this.stopTicker();
    this.applyTemporaryFocusMode(false);
    document.body.removeClass("zendian-focus-clock-active");
    this.closePanel();

    if (status === "abandoned") new Notice("本次专注已放弃");
    else {
      new Notice(`已记录 ${this.formatDuration(focusedSeconds)}专注时间`);
      this.playChime();
    }
    if (breakMinutes > 0) this.startBreak(breakMinutes);
    else if (status !== "abandoned") this.flashCompletion();
    this.renderStatus();
  }

  private startBreak(minutes: number): void {
    this.breakState = {
      status: "running",
      plannedSeconds: minutes * 60,
      elapsedSeconds: 0,
      activeStartedAt: Date.now(),
    };
    document.body.addClass("zendian-focus-clock-active");
    this.startTicker();
  }

  private endBreak(completed = false): void {
    this.breakState = null;
    this.stopTicker();
    document.body.removeClass("zendian-focus-clock-active");
    this.closePanel();
    if (completed) {
      new Notice("休息结束，可以开始下一轮专注");
      this.playChime();
      this.flashCompletion();
    }
    this.renderStatus();
  }

  private finalizeActiveSegment(now: number): void {
    if (!this.session?.activeSegmentStartedAt) return;
    const completedSeconds = this.session.segments.reduce((sum, segment) => sum + (segment.end - segment.start) / 1000, 0);
    const remainingBeforeSegment = Math.max(0, this.session.plannedSeconds - completedSeconds);
    const exactEnd = Math.min(now, this.session.activeSegmentStartedAt + remainingBeforeSegment * 1000);
    if (exactEnd > this.session.activeSegmentStartedAt) {
      this.session.segments.push({ start: this.session.activeSegmentStartedAt, end: exactEnd });
    }
    delete this.session.activeSegmentStartedAt;
  }

  private getFocusRemainingSeconds(): number {
    if (!this.session) return 0;
    let elapsed = this.session.segments.reduce((sum, segment) => sum + (segment.end - segment.start) / 1000, 0);
    if (this.session.status === "running" && this.session.activeSegmentStartedAt) {
      elapsed += (Date.now() - this.session.activeSegmentStartedAt) / 1000;
    }
    return Math.max(0, Math.ceil(this.session.plannedSeconds - elapsed));
  }

  private getBreakRemainingSeconds(): number {
    if (!this.breakState) return 0;
    let elapsed = this.breakState.elapsedSeconds;
    if (this.breakState.status === "running" && this.breakState.activeStartedAt) {
      elapsed += (Date.now() - this.breakState.activeStartedAt) / 1000;
    }
    return Math.max(0, Math.ceil(this.breakState.plannedSeconds - elapsed));
  }

  private startTicker(): void {
    if (this.ticker !== null) return;
    this.ticker = window.setInterval(() => {
      if (this.session && this.getFocusRemainingSeconds() <= 0) {
        this.completeFocusSession("completed", true);
        return;
      }
      if (this.breakState && this.getBreakRemainingSeconds() <= 0) {
        this.endBreak(true);
        return;
      }
      this.renderStatus();
      if (this.panelEl) {
        if (this.session) this.renderFocusDetail();
        else if (this.breakState) this.renderBreakDetail();
      }
    }, 1000);
  }

  private stopTicker(): void {
    if (this.ticker === null) return;
    window.clearInterval(this.ticker);
    this.ticker = null;
  }

  private applyTemporaryFocusMode(active: boolean): void {
    const settings = this.settingsManager.getSettings().editorEnhance;
    if (active) {
      const shouldEnableTemporarily = settings.focusClockAutoEnableFocusMode && !settings.focusMode;
      if (shouldEnableTemporarily) {
        this.temporarilyEnabledFocusMode = true;
        document.body.addClass("border-focus-mode");
        document.body.toggleClass("focus-mode-typewriter", settings.focusModeTypewriter);
      } else if (this.temporarilyEnabledFocusMode) {
        if (!settings.focusMode) {
          document.body.removeClass("border-focus-mode");
          document.body.removeClass("focus-mode-typewriter");
        }
        this.temporarilyEnabledFocusMode = false;
      }
      return;
    }
    if (this.temporarilyEnabledFocusMode) {
      if (!settings.focusMode) {
        document.body.removeClass("border-focus-mode");
        document.body.removeClass("focus-mode-typewriter");
      }
      this.temporarilyEnabledFocusMode = false;
    }
  }

  private openEndConfirmation(): void {
    if (!this.panelEl) this.openPanel();
    this.renderFocusDetail(true);
  }

  private closePanel(): void {
    this.panelEl?.remove();
    this.panelEl = null;
    if (this.outsidePointerHandler) document.removeEventListener("pointerdown", this.outsidePointerHandler, true);
    this.outsidePointerHandler = null;
  }

  private positionPanel(): void {
    if (!this.panelEl) return;
    const rect = this.statusEl.getBoundingClientRect();
    this.panelEl.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`;
    this.panelEl.style.bottom = `${Math.max(34, window.innerHeight - rect.top + 8)}px`;
  }

  private createStatusIconButton(
    parent: HTMLElement,
    icon: string,
    label: string,
    onClick: () => void,
    cls = "",
  ): HTMLButtonElement {
    const button = parent.createEl("button", {
      cls,
      attr: { type: "button", title: label, "aria-label": label },
    });
    setIcon(button, icon);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      onClick();
    });
    return button;
  }

  private flashCompletion(): void {
    if (this.completionFlashTimer !== null) window.clearTimeout(this.completionFlashTimer);
    this.completionFlashTimer = window.setTimeout(() => {
      this.completionFlashTimer = null;
      this.renderStatus();
    }, 3000);
  }

  private playChime(): void {
    if (!this.settingsManager.getSettings().editorEnhance.focusClockSound) return;
    try {
      const context = new AudioContext();
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.7);
      gain.connect(context.destination);
      for (const [frequency, delay] of [[660, 0], [880, 0.16]] as const) {
        const oscillator = context.createOscillator();
        oscillator.frequency.value = frequency;
        oscillator.type = "sine";
        oscillator.connect(gain);
        oscillator.start(context.currentTime + delay);
        oscillator.stop(context.currentTime + delay + 0.45);
      }
      window.setTimeout(() => void context.close(), 1000);
    } catch {
      // 音频上下文可能被系统策略禁用，Notice 仍会提示完成。
    }
  }

  private formatClock(totalSeconds: number): string {
    const seconds = Math.max(0, Math.ceil(totalSeconds));
    const minutes = Math.floor(seconds / 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  private formatDuration(seconds: number): string {
    const minutes = Math.max(1, Math.round(seconds / 60));
    if (minutes < 60) return `${minutes} 分钟`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
  }
}
