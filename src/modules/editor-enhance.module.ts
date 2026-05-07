/**
 * 编辑器增强模块
 * 专注模式、焦点指示器、网格背景、打字机滚动
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { ClassTracker, setCSSVar, removeCSSVar } from "../utils/dom";
// @ts-ignore — Obsidian 运行时提供
import { ViewPlugin, type EditorView, type ViewUpdate } from "@codemirror/view";

// ── 打字机滚动 ViewPlugin ──

function createTypewriterPlugin(): ViewPlugin<null> {
  return ViewPlugin.fromClass(
    class {
      constructor(_view: EditorView) {}

      update(update: ViewUpdate) {
        if (!update.selectionSet && !update.docChanged) return;
        if (!document.body.classList.contains("border-focus-mode")) return;

        (update.view as any).requestMeasure({
          read: (view: EditorView) => {
            const pos = (view as any).state.selection.main.head;
            const coords = (view as any).coordsAtPos(pos);
            if (!coords) return null;
            return {
              cursorY: (coords.top + coords.bottom) / 2,
              scrollDOM: (view as any).scrollDOM,
            };
          },
          write: (data: any) => {
            if (!data) return;
            const { cursorY, scrollDOM } = data;
            const rect = scrollDOM.getBoundingClientRect();
            const cursorRelative = cursorY - rect.top;
            const targetY = scrollDOM.clientHeight * 0.75;
            const diff = cursorRelative - targetY;
            if (Math.abs(diff) > 2) {
              scrollDOM.scrollBy({ top: diff, behavior: "smooth" });
            }
          },
        });
      }
    }
  );
}

// ── Module ──

export class EditorEnhanceModule implements IFeatureModule {
  readonly id = "editor-enhance";
  readonly name = "编辑器增强";

  private classes = new ClassTracker(document.body);
  private ctx: ModuleContext | null = null;
  private typewriterPlugin: ViewPlugin<null> | null = null;

  async load(ctx: ModuleContext): Promise<void> {
    this.ctx = ctx;
    this.apply(ctx.getSettings().editorEnhance);
    this.registerTypewriterExtension(ctx.getSettings().editorEnhance);
  }

  unload(): void {
    this.classes.cleanup();
    removeCSSVar(document.body, "--line-normal-opacity");
    removeCSSVar(document.body, "--grid-background-pattern-size");
    this.typewriterPlugin = null;
    this.ctx = null;
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("editorEnhance")) {
      this.apply(settings.editorEnhance);
      this.registerTypewriterExtension(settings.editorEnhance);
    }
  }

  private apply(s: PluginSettings["editorEnhance"]): void {
    this.classes.toggle("border-focus-mode", s.focusMode);
    this.classes.toggle("line-hover-indicator", s.hoverIndicator);
    this.classes.toggle("focus-indicator-list-level", s.hoverIndicatorListLevel);
    this.classes.toggle("focus-indicator-codeblock-line-number", s.hoverIndicatorCodeblockLineNumber);
    this.classes.toggle("editor-grid-background-pattren", s.gridBackground);

    setCSSVar(document.body, "--line-normal-opacity", String(s.focusModeOpacity));
    setCSSVar(document.body, "--grid-background-pattern-size", s.gridBackgroundSize);
  }

  private registerTypewriterExtension(s: PluginSettings["editorEnhance"]): void {
    if (!this.ctx) return;
    if (s.focusMode && s.focusModeTypewriter) {
      if (!this.typewriterPlugin) {
        this.typewriterPlugin = createTypewriterPlugin();
        this.ctx.registerEditorExtension(this.typewriterPlugin);
      }
    }
    // Obsidian 不支持注销扩展，ViewPlugin 内部通过 classList 检查自行控制启停
  }
}
