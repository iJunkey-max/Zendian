/**
 * QuickNoteModal — 便签添加/编辑模态框
 */

import { App, Modal, Setting } from "obsidian";
import type { HomepageQuickNote } from "./types";

type QuickNoteSaveCallback = (note: Omit<HomepageQuickNote, "id">) => void;

const COLOR_PRESETS = [
  { label: "蓝色", value: "#3b82f6" },
  { label: "绿色", value: "#10b981" },
  { label: "橙色", value: "#f59e0b" },
  { label: "紫色", value: "#8b5cf6" },
  { label: "红色", value: "#ef4444" },
  { label: "青色", value: "#06b6d4" },
];

export class QuickNoteModal extends Modal {
  private label = "";
  private path = "";
  private color = "#3b82f6";
  private onSave: QuickNoteSaveCallback;

  constructor(app: App, onSave: QuickNoteSaveCallback, existing?: HomepageQuickNote) {
    super(app);
    this.onSave = onSave;

    if (existing) {
      this.label = existing.label;
      this.path = existing.path;
      this.color = existing.color;
    }
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "添加便签" });

    new Setting(contentEl)
      .setName("名称")
      .addText((text) =>
        text
          .setPlaceholder("便签名称")
          .setValue(this.label)
          .onChange((v) => (this.label = v))
      );

    new Setting(contentEl)
      .setName("笔记路径")
      .addText((text) =>
        text
          .setPlaceholder("例如：随想/今日想法.md")
          .setValue(this.path)
          .onChange((v) => (this.path = v))
      );

    new Setting(contentEl)
      .setName("颜色")
      .addDropdown((dropdown) => {
        for (const opt of COLOR_PRESETS) {
          dropdown.addOption(opt.value, opt.label);
        }
        dropdown.setValue(this.color);
        dropdown.onChange((v) => (this.color = v));
      });

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("保存")
        .setCta()
        .onClick(() => {
          if (this.label.trim() && this.path.trim()) {
            this.onSave({
              label: this.label.trim(),
              path: this.path.trim(),
              color: this.color,
            });
            this.close();
          }
        })
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
