/**
 * 排版模块
 * 行高、字间距、段落间距、对齐方式
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { ClassTracker, setCSSVar, removeCSSVar } from "../utils/dom";

const CSS_VARS = [
  "--file-line-width",
  "--letter-spacing",
  "--line-height-customize",
  "--code-line-height",
  "--blockquote-line-height",
  "--table-line-height",
  "--p-spacing",
];

export class TypographyModule implements IFeatureModule {
  readonly id = "typography";
  readonly name = "排版";

  private classes = new ClassTracker(document.body);

  async load(ctx: ModuleContext): Promise<void> {
    this.apply(ctx.getSettings().typography);
  }

  unload(): void {
    this.classes.cleanup();
    for (const v of CSS_VARS) removeCSSVar(document.body, v);
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("typography")) {
      this.apply(settings.typography);
    }
  }

  private apply(s: PluginSettings["typography"]): void {
    setCSSVar(document.body, "--file-line-width", `${s.fileLineWidth}px`);
    setCSSVar(document.body, "--letter-spacing", `${s.letterSpacing}px`);
    setCSSVar(document.body, "--line-height-customize", String(s.lineHeight));
    setCSSVar(document.body, "--code-line-height", String(s.codeLineHeight));
    setCSSVar(document.body, "--blockquote-line-height", String(s.blockquoteLineHeight));
    setCSSVar(document.body, "--table-line-height", String(s.tableLineHeight));
    setCSSVar(document.body, "--p-spacing", s.paragraphSpacing);

    this.classes.toggle("p-spacing-br", s.paragraphSpacingBr);
    this.classes.toggle("text-align-justify", s.textAlignJustify);
  }
}
