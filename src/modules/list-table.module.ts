/**
 * 列表与表格模块
 * 缩进、间距、表格宽度、表头背景
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { ClassTracker, setCSSVar, removeCSSVar } from "../utils/dom";

const TABLE_WIDTH_CLASSES = [
  "table-width-default",
  "table-width-obsidian-default",
  "table-width-customized",
];

const CSS_VARS = [
  "--list-indent",
  "--list-spacing",
  "--table-width",
  "--table-header-background-light",
  "--table-header-background-dark",
];

export class ListTableModule implements IFeatureModule {
  readonly id = "list-table";
  readonly name = "列表与表格";

  private classes = new ClassTracker(document.body);

  async load(ctx: ModuleContext): Promise<void> {
    this.apply(ctx.getSettings().listTable);
  }

  unload(): void {
    this.classes.cleanup();
    for (const v of CSS_VARS) removeCSSVar(document.body, v);
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("listTable")) {
      this.apply(settings.listTable);
    }
  }

  private apply(s: PluginSettings["listTable"]): void {
    setCSSVar(document.body, "--list-indent", s.listIndent);
    setCSSVar(document.body, "--list-spacing", s.listSpacing);
    setCSSVar(document.body, "--table-header-background-light", s.tableHeaderBgLight);
    setCSSVar(document.body, "--table-header-background-dark", s.tableHeaderBgDark);

    this.classes.toggle("ul-marker-restore", s.ulMarkerRestore);
    this.classes.toggle("disable-alternative-checkboxes", s.disableAlternativeCheckboxes);

    // table-width-select: class-select
    for (const cls of TABLE_WIDTH_CLASSES) this.classes.remove(cls);
    this.classes.add(`table-width-${s.tableWidthMode}`);

    // table-width: variable-number-slider with format cqw
    setCSSVar(document.body, "--table-width", `${s.tableWidth}cqw`);
  }
}
