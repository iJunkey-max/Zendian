import { ProjectRegistry } from "../homepage/services/ProjectRegistry";
import { App, Notice, setIcon } from "obsidian";
import type { EventBus } from "../core/event-bus";
import { Events } from "../core/event-bus";
import type { SettingsManager } from "../core/settings-manager";
import type {
  ActiveFocusSession,
  FocusSessionRecord,
} from "../services/ActivityLogService";
import type { ActivityLogService } from "../services/ActivityLogService";
import type { PluginSettings } from "../types/settings.types";
import { openPopoutForm } from "../ui/popout-form";
import { resolveFocusProject, type FocusProjectCandidate } from "./focus-project";

interface BreakState {
  status: "running" | "paused";
  plannedSeconds: number;
  elapsedSeconds: number;
  activeStartedAt?: number;
}

export class FocusClockController {
  private panelEl: HTMLElement | null = null;
  private panelCloseAction: (() => void) | null = null;
  private panelOpening = false;
  private isPopoutPanel = false;
  private showingEndConfirmation = false;
  private ticker: number | null = null;
  private animationFrame: number | null = null;
  private dialEl: HTMLElement | null = null;
  private dialTimeEl: HTMLElement | null = null;
  private dialLabelEl: HTMLElement | null = null;
  private controlsEl: HTMLElement | null = null;
  private actionStageEl: HTMLElement | null = null;
  private actionTransitionTimer: number | null = null;
  private panelTransitionTimer: number | null = null;
  private settingsUnsub: (() => void) | null = null;
  private outsidePointerHandler: ((event: PointerEvent) => void) | null = null;
  private session: ActiveFocusSession | null = null;
  private breakState: BreakState | null = null;
  private selectedMinutes = 25;
  private customDurationSelected = false;
  /** undefined = follow active file; null = explicitly unassigned. */
  private projectSelection: string | null | undefined;
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

  openPanel(showEndConfirmation = false): void {
    if (!this.settingsManager.getSettings().editorEnhance.focusClockEnabled && !this.session && !this.breakState) {
      new Notice("请先在 ZENdian 设置中启用专注时钟");
      return;
    }
    if (this.panelEl) {
      if (showEndConfirmation && this.session) {
        this.showingEndConfirmation = true;
        this.renderFocusActions(true);
        return;
      }
      this.closePanel();
      return;
    }
    if (this.panelOpening) return;
    if (this.settingsManager.getSettings().mobile.openPanelsInNewWindow ?? true) {
      void this.openPanelInNewWindow(showEndConfirmation);
      return;
    }
    this.openInlinePanel(showEndConfirmation);
  }

  private openInlinePanel(showEndConfirmation = false): void {
    this.isPopoutPanel = false;
    this.panelEl = this.app.workspace.containerEl.createDiv({
      cls: "zendian-focus-clock-panel",
      attr: { role: "dialog", "aria-label": "专注时钟" },
    });
    this.showingEndConfirmation = showEndConfirmation;
    this.renderCurrentPanel();
    this.positionPanel();

    window.setTimeout(() => {
      this.outsidePointerHandler = (event: PointerEvent) => {
        const target = event.target as Node | null;
        if (target && !this.panelEl?.contains(target) && !this.statusEl.contains(target)) this.closePanel();
      };
      document.addEventListener("pointerdown", this.outsidePointerHandler, true);
    });
  }

  private async openPanelInNewWindow(showEndConfirmation = false): Promise<void> {
    this.panelOpening = true;
    const opened = await openPopoutForm(this.app, {
      title: "专注时钟",
      icon: "timer",
      size: { width: 400, height: 570 },
      position: "bottom-right",
      className: "zendian-focus-clock-popout",
      render: (container, api) => {
        const panel = container.createDiv({
          cls: "zendian-focus-clock-workspace",
          attr: { role: "dialog", "aria-label": "专注时钟" },
        });
        this.panelEl = panel;
        this.panelCloseAction = api.close;
        this.isPopoutPanel = true;
        this.showingEndConfirmation = showEndConfirmation;
        this.renderCurrentPanel();
        return () => {
          if (this.panelEl === panel) {
            this.stopPanelAnimation();
            this.panelEl = null;
            this.panelCloseAction = null;
            this.isPopoutPanel = false;
            this.showingEndConfirmation = false;
          }
        };
      },
    });
    this.panelOpening = false;
    if (!opened && !this.panelEl) this.openInlinePanel(showEndConfirmation);
  }

  private renderCurrentPanel(): void {
    this.resetPanelElements();
    if (this.session) this.renderFocusDetail();
    else if (this.breakState) this.renderBreakDetail();
    else this.renderSetup();
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
    this.stopPanelAnimation();
    this.resetPanelElements();
    this.panelEl.removeClass("is-focus-session");
    this.panelEl.addClass("is-setup-session");
    this.panelEl.empty();
    this.renderPanelHeader("专注时钟");

    const dial = this.panelEl.createDiv("zendian-focus-clock-dial");
    dial.style.setProperty("--zd-focus-progress", "0deg");
    this.dialEl = dial;
    this.dialTimeEl = dial.createDiv({ cls: "zendian-focus-clock-dial-time", text: this.formatClock(this.selectedMinutes * 60) });
    this.dialLabelEl = dial.createDiv({ cls: "zendian-focus-clock-dial-label", text: "准备专注" });

    const controls = this.panelEl.createDiv("zendian-focus-clock-controls");
    this.controlsEl = controls;
    const presets = controls.createDiv({ cls: "zendian-focus-clock-presets", attr: { role: "group", "aria-label": "选择专注时长" } });
    for (const minutes of [25, 50, 90]) {
      const button = presets.createEl("button", { text: `${minutes}`, attr: { type: "button", "aria-label": `${minutes} 分钟` } });
      button.toggleClass("is-selected", !this.customDurationSelected && minutes === this.selectedMinutes);
      button.addEventListener("click", () => {
        this.selectedMinutes = minutes;
        this.customDurationSelected = false;
        this.renderSetup();
      });
    }
    const customSlot = presets.createDiv("zendian-focus-clock-custom-slot");
    const openCustomInput = (): void => {
      customSlot.empty();
      const custom = customSlot.createEl("input", {
        type: "number",
        value: this.customDurationSelected ? String(this.selectedMinutes) : "",
        placeholder: "输入分钟",
        attr: { min: "1", max: "180", step: "1", "aria-label": "自定义专注分钟数" },
      });
      const applyCustomValue = (): boolean => {
        const value = Number(custom.value);
        if (!Number.isFinite(value) || value < 1) return false;
        this.selectedMinutes = Math.max(1, Math.min(180, Math.round(value)));
        this.customDurationSelected = true;
        custom.value = String(this.selectedMinutes);
        this.dialTimeEl!.textContent = this.formatClock(this.selectedMinutes * 60);
        presets.querySelectorAll("button").forEach((button) => button.removeClass("is-selected"));
        return true;
      };
      custom.addEventListener("input", () => { applyCustomValue(); });
      custom.addEventListener("change", () => { applyCustomValue(); });
      custom.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && applyCustomValue()) custom.blur();
      });
      custom.focus();
      custom.select();
    };
    if (this.customDurationSelected) openCustomInput();
    else {
      const customButton = customSlot.createEl("button", {
        text: "自定义",
        attr: { type: "button", "aria-label": "输入自定义专注时长" },
      });
      customButton.addEventListener("click", openCustomInput);
    }

    const activeFile = this.app.workspace.getActiveFile();
    const projectField = controls.createDiv("zendian-focus-clock-field");
    projectField.createEl("label", { text: "归属项目（可选）" });
    const projectSelect = projectField.createEl("select", {
      attr: { "aria-label": "归属项目（可选）" },
    });
    const loadingOption = projectSelect.createEl("option", { value: "", text: "正在读取项目…" });
    loadingOption.disabled = true;

    const discoverReadyProjects = async (): Promise<FocusProjectCandidate[]> => {
      const result = await new ProjectRegistry(this.app).discover();
      return result.projects.filter((project) => project.state === "ready" && !!project.projectId);
    };

    const populateProjects = async (): Promise<void> => {
      try {
        const projects = await discoverReadyProjects();
        if (!projectSelect.isConnected) return;
        const auto = resolveFocusProject(projects, undefined, activeFile?.path);
        projectSelect.empty();
        projectSelect.createEl("option", { value: "", text: "不归属项目" });
        for (const project of projects.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))) {
          projectSelect.createEl("option", { value: project.projectId!, text: `${project.name} · ${project.folderPath}` });
        }
        projectSelect.value = this.projectSelection ?? auto?.projectId ?? "";
        if (auto && activeFile?.extension === "home" && targetInput.value === activeFile.basename) targetInput.value = auto.name;
      } catch (error) {
        if (!projectSelect.isConnected) return;
        projectSelect.empty();
        projectSelect.createEl("option", { value: "", text: "项目读取失败，可重试" });
        console.error("[FocusClock] 项目列表读取失败", error);
      }
    };
    projectSelect.addEventListener("change", () => {
      this.projectSelection = projectSelect.value || null;
    });
    void populateProjects();

    const targetField = controls.createDiv("zendian-focus-clock-field");
    targetField.createEl("label", { text: "专注目标" });
    const targetInput = targetField.createEl("input", {
      type: "text",
      value: activeFile?.basename ?? "",
      placeholder: "例如：完成方案初稿",
      attr: { maxlength: "120" },
    });

    const resolveProject = async (): Promise<FocusProjectCandidate | undefined> => {
      const projects = await discoverReadyProjects();
      return resolveFocusProject(projects, this.projectSelection, activeFile?.path);
    };

    const breakMinutes = this.settingsManager.getSettings().editorEnhance.focusClockBreakMinutes;
    const breakRow = controls.createDiv({ cls: "zendian-focus-clock-break-row" });
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

    const startButton = controls.createEl("button", {
      cls: "zendian-focus-clock-primary",
      attr: { type: "button" },
    });
    setIcon(startButton, "play");
    startButton.createSpan({ text: "开始专注" });
    startButton.addEventListener("click", async () => {
      startButton.disabled = true;
      try {
        const project = await resolveProject();
        const targetLabel = targetInput.value.trim() || activeFile?.basename || "未命名专注";
        const targetPath = activeFile && targetLabel === activeFile.basename ? activeFile.path : undefined;
        const selectedBreak = breakToggle.checked ? Math.max(1, Math.min(30, Number(breakInput.value) || 5)) : 0;
        this.startFocus(this.selectedMinutes, targetLabel, targetPath, selectedBreak, project?.projectId || undefined, project?.name);
      } catch (error) {
        startButton.disabled = false;
        new Notice(String(error));
      }
    });
  }

  private renderFocusDetail(showConfirmation = this.showingEndConfirmation): void {
    if (!this.panelEl || !this.session) return;
    this.stopPanelAnimation();
    this.resetPanelElements();
    this.panelEl.removeClass("is-setup-session");
    this.panelEl.addClass("is-focus-session");
    this.panelEl.empty();
    this.renderPanelHeader(this.session.status === "paused" ? "专注已暂停" : "正在专注");
    const dial = this.panelEl.createDiv("zendian-focus-clock-dial");
    this.dialEl = dial;
    this.dialTimeEl = dial.createDiv({ cls: "zendian-focus-clock-dial-time" });
    this.dialLabelEl = dial.createDiv({ cls: "zendian-focus-clock-dial-label", text: this.session.status === "paused" ? "稍作停顿" : "保持此刻" });
    const controls = this.panelEl.createDiv("zendian-focus-clock-controls");
    this.controlsEl = controls;
    this.populateFocusControls(controls, showConfirmation);

    this.updatePanelProgress();
    if (this.session.status === "running") this.startPanelAnimation();
  }

  private renderBreakDetail(): void {
    if (!this.panelEl || !this.breakState) return;
    this.stopPanelAnimation();
    this.resetPanelElements();
    this.panelEl.removeClass("is-setup-session");
    this.panelEl.removeClass("is-focus-session");
    this.panelEl.empty();
    this.renderPanelHeader(this.breakState.status === "paused" ? "休息已暂停" : "休息一下");
    const dial = this.panelEl.createDiv("zendian-focus-clock-dial is-break");
    this.dialEl = dial;
    this.dialTimeEl = dial.createDiv({ cls: "zendian-focus-clock-dial-time" });
    dial.createDiv({ cls: "zendian-focus-clock-dial-label", text: "让眼睛离开屏幕" });
    const controls = this.panelEl.createDiv("zendian-focus-clock-controls");
    this.controlsEl = controls;
    const end = controls.createEl("button", { cls: "zendian-focus-clock-secondary", attr: { type: "button" } });
    setIcon(end, "skip-forward");
    end.createSpan({ text: "结束休息" });
    end.addEventListener("click", () => this.endBreak());
    this.updatePanelProgress();
    if (this.breakState.status === "running") this.startPanelAnimation();
  }

  private renderPanelHeader(title: string): void {
    if (!this.panelEl || this.isPopoutPanel) return;
    const header = this.panelEl.createDiv("zendian-focus-clock-header");
    const titleWrap = header.createDiv("zendian-focus-clock-title");
    const icon = titleWrap.createSpan();
    setIcon(icon, "timer");
    titleWrap.createSpan({ text: title });
    const close = header.createEl("button", { attr: { type: "button", title: "关闭", "aria-label": "关闭" } });
    setIcon(close, "x");
    close.addEventListener("click", () => this.closePanel());
  }

  private startFocus(minutes: number, targetLabel: string, targetPath: string | undefined, breakMinutes: number, projectId?: string, projectName?: string): void {
    const now = Date.now();
    this.session = {
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      status: "running",
      startedAt: now,
      plannedSeconds: Math.max(60, Math.round(minutes * 60)),
      targetLabel,
      targetPath,
      projectId,
      projectName,
      segments: [],
      activeSegmentStartedAt: now,
      breakMinutes,
    };
    this.activityLog.setActiveFocusSession(this.session);
    this.applyTemporaryFocusMode(true);
    document.body.addClass("zendian-focus-clock-active");
    this.startTicker();
    this.renderStatus();
    if (this.panelEl) {
      if (this.isPopoutPanel && this.controlsEl && this.dialEl && this.dialTimeEl) this.transitionSetupToFocus();
      else this.renderFocusDetail();
    }
  }

  private pauseFocus(): void {
    if (!this.session || this.session.status !== "running") return;
    this.finalizeActiveSegment(Date.now());
    this.session.status = "paused";
    this.activityLog.setActiveFocusSession(this.session);
    this.stopTicker();
    this.renderStatus();
    if (this.panelEl) this.refreshFocusPanelControls();
  }

  private resumeFocus(): void {
    if (!this.session || this.session.status !== "paused") return;
    this.session.status = "running";
    this.session.activeSegmentStartedAt = Date.now();
    this.activityLog.setActiveFocusSession(this.session);
    this.startTicker();
    this.renderStatus();
    if (this.panelEl) this.refreshFocusPanelControls();
  }

  private completeFocusSession(status: FocusSessionRecord["status"], natural: boolean): void {
    if (!this.session) return;
    const session = this.session;
    const endedAt = Date.now();
    // Build a completion snapshot first. Do not mutate the live session until
    // ActivityLogService accepts the record; a failed validation must leave a
    // retryable session instead of deleting its active segment and freezing it.
    const segments = session.segments.map(segment => ({ ...segment }));
    if (session.status === "running" && session.activeSegmentStartedAt !== undefined) {
      const completedSeconds = segments.reduce((sum, segment) => sum + (segment.end - segment.start) / 1000, 0);
      const remainingBeforeSegment = Math.max(0, session.plannedSeconds - completedSeconds);
      const exactEnd = Math.min(endedAt, session.activeSegmentStartedAt + remainingBeforeSegment * 1000);
      if (exactEnd > session.activeSegmentStartedAt) {
        segments.push({ start: session.activeSegmentStartedAt, end: exactEnd });
      }
    }
    const focusedSeconds = Math.round(segments.reduce((sum, segment) => sum + (segment.end - segment.start) / 1000, 0));
    const record: FocusSessionRecord = {
      id: session.id,
      startedAt: session.startedAt,
      endedAt,
      plannedSeconds: session.plannedSeconds,
      focusedSeconds,
      status,
      targetLabel: session.targetLabel,
      targetPath: session.targetPath,
      projectId: session.projectId,
      projectName: session.projectName,
    };
    if (!this.activityLog.recordFocusSession(record, segments)) {
      // Stop automatic retries when the clock/data is invalid, but retain the
      // session in a safe paused state so the user can inspect the clock and
      // resume or retry after correcting it.
      session.status = "paused";
      delete session.activeSegmentStartedAt;
      this.activityLog.setActiveFocusSession(session);
      this.stopTicker();
      this.renderStatus();
      if (this.panelEl) this.refreshFocusPanelControls();
      new Notice("专注时间段异常，未计入统计；会话已保留，请检查系统时间后重试");
      return;
    }
    session.segments = segments;
    delete session.activeSegmentStartedAt;
    const breakMinutes = natural && status === "completed" ? session.breakMinutes : 0;
    this.session = null;
    this.stopTicker();
    this.applyTemporaryFocusMode(false);
    document.body.removeClass("zendian-focus-clock-active");
    this.showingEndConfirmation = false;

    if (status === "abandoned") new Notice("本次专注已放弃");
    else {
      new Notice(`已记录 ${this.formatDuration(focusedSeconds)}专注时间`);
      this.playChime();
    }
    if (breakMinutes > 0) this.startBreak(breakMinutes);
    else {
      if (status !== "abandoned") this.flashCompletion();
      if (this.panelEl) this.renderSetup();
    }
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
    if (this.panelEl) this.renderBreakDetail();
  }

  private endBreak(completed = false): void {
    this.breakState = null;
    this.stopTicker();
    document.body.removeClass("zendian-focus-clock-active");
    if (completed) {
      new Notice("休息结束，可以开始下一轮专注");
      this.playChime();
      this.flashCompletion();
    }
    this.renderStatus();
    if (this.panelEl) this.renderSetup();
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
    return Math.ceil(this.getFocusRemainingExactSeconds());
  }

  private getFocusRemainingExactSeconds(): number {
    if (!this.session) return 0;
    let elapsed = this.session.segments.reduce((sum, segment) => sum + (segment.end - segment.start) / 1000, 0);
    if (this.session.status === "running" && this.session.activeSegmentStartedAt) {
      elapsed += (Date.now() - this.session.activeSegmentStartedAt) / 1000;
    }
    return Math.max(0, this.session.plannedSeconds - elapsed);
  }

  private getBreakRemainingSeconds(): number {
    return Math.ceil(this.getBreakRemainingExactSeconds());
  }

  private getBreakRemainingExactSeconds(): number {
    if (!this.breakState) return 0;
    let elapsed = this.breakState.elapsedSeconds;
    if (this.breakState.status === "running" && this.breakState.activeStartedAt) {
      elapsed += (Date.now() - this.breakState.activeStartedAt) / 1000;
    }
    return Math.max(0, this.breakState.plannedSeconds - elapsed);
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
    }, 1000);
    this.startPanelAnimation();
  }

  private stopTicker(): void {
    if (this.ticker !== null) {
      window.clearInterval(this.ticker);
      this.ticker = null;
    }
    this.stopPanelAnimation();
  }

  private resetPanelElements(): void {
    this.dialEl = null;
    this.dialTimeEl = null;
    this.dialLabelEl = null;
    this.controlsEl = null;
    this.actionStageEl = null;
    if (this.actionTransitionTimer !== null) {
      window.clearTimeout(this.actionTransitionTimer);
      this.actionTransitionTimer = null;
    }
    if (this.panelTransitionTimer !== null) {
      window.clearTimeout(this.panelTransitionTimer);
      this.panelTransitionTimer = null;
    }
  }

  private populateFocusControls(controls: HTMLElement, confirming = this.showingEndConfirmation): void {
    if (!this.session) return;
    controls.empty();
    controls.createDiv({ cls: "zendian-focus-clock-target", text: this.session.targetLabel });
    this.actionStageEl = controls.createDiv("zendian-focus-clock-action-stage");
    this.renderFocusActions(confirming, false);
  }

  private transitionSetupToFocus(): void {
    if (!this.panelEl || !this.session || !this.controlsEl || !this.dialEl || !this.dialTimeEl || !this.dialLabelEl) {
      this.renderFocusDetail();
      return;
    }
    const panel = this.panelEl;
    const controls = this.controlsEl;
    panel.removeClass("is-setup-session");
    panel.addClass("is-focus-session");
    this.dialLabelEl.textContent = "保持此刻";
    controls.addClass("is-leaving");
    this.updatePanelProgress();
    this.startPanelAnimation();
    if (this.panelTransitionTimer !== null) window.clearTimeout(this.panelTransitionTimer);
    this.panelTransitionTimer = window.setTimeout(() => {
      if (this.panelEl !== panel || this.controlsEl !== controls || !this.session) return;
      this.populateFocusControls(controls, false);
      controls.removeClass("is-leaving");
      controls.addClass("is-entering");
      this.panelTransitionTimer = window.setTimeout(() => {
        controls.removeClass("is-entering");
        this.panelTransitionTimer = null;
      }, 260);
    }, 150);
  }

  private refreshFocusPanelControls(): void {
    if (!this.session) return;
    if (this.dialLabelEl) this.dialLabelEl.textContent = this.session.status === "paused" ? "稍作停顿" : "保持此刻";
    this.updatePanelProgress();
    this.renderFocusActions(this.showingEndConfirmation);
  }

  private renderFocusActions(confirming = this.showingEndConfirmation, animate = true): void {
    if (!this.actionStageEl || !this.session) return;
    const stage = this.actionStageEl;
    this.showingEndConfirmation = confirming;
    const populate = (): void => {
      if (!this.session || this.actionStageEl !== stage) return;
      stage.empty();
      stage.toggleClass("is-confirming", confirming);

      if (confirming) {
        const cancel = stage.createEl("button", { text: "继续", attr: { type: "button" } });
        cancel.addEventListener("click", () => this.renderFocusActions(false));
        const record = stage.createEl("button", { cls: "is-primary", text: "完成并记录", attr: { type: "button" } });
        record.addEventListener("click", () => this.completeFocusSession("ended", false));
        const abandon = stage.createEl("button", { cls: "is-danger", text: "放弃", attr: { type: "button" } });
        abandon.addEventListener("click", () => this.completeFocusSession("abandoned", false));
      } else {
        const extend = stage.createEl("button", { attr: { type: "button", title: "延长 5 分钟", "aria-label": "延长 5 分钟" } });
        setIcon(extend, "plus");
        extend.createSpan({ text: "5 分钟" });
        extend.addEventListener("click", () => {
          if (!this.session) return;
          this.session.plannedSeconds += 300;
          this.activityLog.setActiveFocusSession(this.session);
          this.updatePanelProgress();
          this.renderStatus();
        });
        const toggle = stage.createEl("button", { attr: { type: "button" } });
        setIcon(toggle, this.session.status === "paused" ? "play" : "pause");
        toggle.createSpan({ text: this.session.status === "paused" ? "继续" : "暂停" });
        toggle.addEventListener("click", () => this.togglePause());
        const end = stage.createEl("button", { cls: "is-danger", attr: { type: "button" } });
        setIcon(end, "square");
        end.createSpan({ text: "结束" });
        end.addEventListener("click", () => this.renderFocusActions(true));
      }
    };

    const enter = (): void => {
      stage.removeClass("is-leaving");
      populate();
      stage.removeClass("is-entering");
      void stage.offsetWidth;
      stage.addClass("is-entering");
      this.actionTransitionTimer = window.setTimeout(() => {
        stage.removeClass("is-entering");
        this.actionTransitionTimer = null;
      }, 220);
    };

    if (!animate || stage.childElementCount === 0) {
      populate();
      return;
    }
    if (this.actionTransitionTimer !== null) window.clearTimeout(this.actionTransitionTimer);
    stage.removeClass("is-entering");
    stage.addClass("is-leaving");
    this.actionTransitionTimer = window.setTimeout(enter, 110);
  }

  private updatePanelProgress(): void {
    if (!this.dialEl || !this.dialTimeEl) return;
    const isBreak = Boolean(this.breakState);
    const plannedSeconds = isBreak ? this.breakState?.plannedSeconds : this.session?.plannedSeconds;
    const remaining = isBreak ? this.getBreakRemainingExactSeconds() : this.getFocusRemainingExactSeconds();
    if (!plannedSeconds) return;
    const progress = Math.max(0, Math.min(1, 1 - remaining / plannedSeconds));
    this.dialEl.style.setProperty("--zd-focus-progress", `${progress * 360}deg`);
    this.dialTimeEl.textContent = this.formatClock(remaining);
  }

  private startPanelAnimation(): void {
    if (this.animationFrame !== null || !this.panelEl) return;
    const animate = (): void => {
      this.animationFrame = null;
      if (!this.panelEl) return;
      const running = this.session?.status === "running" || this.breakState?.status === "running";
      if (!running) return;
      this.updatePanelProgress();
      this.animationFrame = this.panelEl.ownerDocument.defaultView?.requestAnimationFrame(animate) ?? null;
    };
    this.animationFrame = this.panelEl.ownerDocument.defaultView?.requestAnimationFrame(animate) ?? null;
  }

  private stopPanelAnimation(): void {
    if (this.animationFrame === null) return;
    const panelWindow = this.panelEl?.ownerDocument.defaultView;
    panelWindow?.cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
  }

  private applyTemporaryFocusMode(active: boolean): void {
    const settings = this.settingsManager.getSettings().editorEnhance;
    const shouldEnableTemporarily =
      active &&
      settings.focusClockAutoEnableFocusMode &&
      !settings.focusMode;
    if (shouldEnableTemporarily === this.temporarilyEnabledFocusMode) return;
    this.temporarilyEnabledFocusMode = shouldEnableTemporarily;
    this.events.emit(Events.FOCUS_MODE_TEMPORARY_CHANGED, shouldEnableTemporarily);
  }

  private openEndConfirmation(): void {
    this.showingEndConfirmation = true;
    this.openPanel(true);
  }

  private closePanel(): void {
    const panel = this.panelEl;
    const closeAction = this.panelCloseAction;
    this.stopPanelAnimation();
    this.panelEl = null;
    this.panelCloseAction = null;
    this.isPopoutPanel = false;
    this.showingEndConfirmation = false;
    this.resetPanelElements();
    panel?.remove();
    if (this.outsidePointerHandler) document.removeEventListener("pointerdown", this.outsidePointerHandler, true);
    this.outsidePointerHandler = null;
    closeAction?.();
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
