/**
 * 编辑器增强模块
 * 专注模式、焦点指示器、网格背景、打字机滚动
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { Events } from "../core/event-bus";
import { ClassTracker, setCSSVar, removeCSSVar } from "../utils/dom";
import { resolveFocusModeRuntime } from "./editor-enhance/focus-mode-runtime";
import { SourceModeSession } from "./editor-enhance/source-mode-session";
import { createTypewriterExtension } from "./editor-enhance/typewriter.extension";
import { TypewriterRuntimeStore } from "./editor-enhance/typewriter-runtime";

export class EditorEnhanceModule implements IFeatureModule {
  readonly id = "editor-enhance";
  readonly name = "编辑器增强";

  private classes = new ClassTracker(document.body);
  private typewriterRuntime = new TypewriterRuntimeStore();
  private sourceModeSession: SourceModeSession | null = null;
  private typewriterPlugin: ReturnType<typeof createTypewriterExtension> | null = null;
  private clockTemporaryActive = false;
  private temporaryFocusUnsub: (() => void) | null = null;

  async load(ctx: ModuleContext): Promise<void> {
    this.sourceModeSession = new SourceModeSession(ctx.app, () => this.typewriterRuntime.refresh());
    this.sourceModeSession.start();
    this.typewriterPlugin = createTypewriterExtension(this.typewriterRuntime);
    ctx.registerEditorExtension(this.typewriterPlugin);
    this.temporaryFocusUnsub = ctx.events.on(
      Events.FOCUS_MODE_TEMPORARY_CHANGED,
      (active: boolean) => {
        this.clockTemporaryActive = active;
        this.apply(ctx.getSettings().editorEnhance);
      },
    );
    this.apply(ctx.getSettings().editorEnhance);
  }

  unload(): void {
    this.temporaryFocusUnsub?.();
    this.temporaryFocusUnsub = null;
    this.clockTemporaryActive = false;
    this.typewriterRuntime.setActive(false);
    this.sourceModeSession?.destroy();
    this.sourceModeSession = null;
    this.classes.cleanup();
    removeCSSVar(document.body, "--line-normal-opacity");
    removeCSSVar(document.body, "--grid-background-pattern-size");
    this.typewriterPlugin = null;
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("editorEnhance")) this.apply(settings.editorEnhance);
  }

  private apply(s: PluginSettings["editorEnhance"]): void {
    const runtime = resolveFocusModeRuntime(
      s.focusMode,
      this.clockTemporaryActive,
      s.focusModeTypewriter,
    );
    this.classes.toggle("border-focus-mode", runtime.active);
    this.classes.toggle("focus-mode-typewriter", runtime.typewriterActive);
    this.classes.toggle("line-hover-indicator", s.hoverIndicator);
    this.classes.toggle("focus-indicator-list-level", s.hoverIndicatorListLevel);
    this.classes.toggle("focus-indicator-codeblock-line-number", s.hoverIndicatorCodeblockLineNumber);
    this.classes.toggle("editor-grid-background-pattren", s.gridBackground);

    setCSSVar(document.body, "--line-normal-opacity", String(s.focusModeOpacity));
    setCSSVar(document.body, "--grid-background-pattern-size", s.gridBackgroundSize);

    this.typewriterRuntime.setActive(runtime.typewriterActive);
    this.sourceModeSession?.setActive(runtime.typewriterActive);
  }
}
