/**
 * 文件树模块
 * CTA 按钮、文件名修剪、文件夹加粗、图标控制
 */

import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { ClassTracker } from "../utils/dom";

export class FileTreeModule implements IFeatureModule {
  readonly id = "file-tree";
  readonly name = "文件树";

  private classes = new ClassTracker(document.body);

  async load(ctx: ModuleContext): Promise<void> {
    this.apply(ctx.getSettings().fileTree);
  }

  unload(): void {
    this.classes.cleanup();
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("fileTree")) {
      this.apply(settings.fileTree);
    }
  }

  private apply(s: PluginSettings["fileTree"]): void {
    this.classes.toggle("CTA-BTN-enable", s.ctaBtnEnable);
    this.classes.toggle("file-names-untrim", s.fileNamesUntrim);
    this.classes.toggle("folder-font-bold", s.folderFontBold);
  }
}
