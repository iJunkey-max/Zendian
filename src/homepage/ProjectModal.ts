/**
 * ProjectModal — 项目添加/编辑模态框
 */

import { App, Modal, Setting } from "obsidian";
import type { HomepageProject, ProjectStatus } from "./types";

type ProjectSaveCallback = (project: Omit<HomepageProject, "id" | "createdAt" | "updatedAt">) => void;

const STATUS_OPTIONS: { label: string; value: ProjectStatus }[] = [
  { label: "规划中", value: "planning" },
  { label: "进行中", value: "in-progress" },
  { label: "测试中", value: "testing" },
  { label: "已完成", value: "completed" },
];

export class ProjectModal extends Modal {
  private name = "";
  private description = "";
  private status: ProjectStatus = "planning";
  private progress = 0;
  private onSave: ProjectSaveCallback;

  constructor(app: App, onSave: ProjectSaveCallback, existing?: HomepageProject) {
    super(app);
    this.onSave = onSave;

    if (existing) {
      this.name = existing.name;
      this.description = existing.description;
      this.status = existing.status;
      this.progress = existing.progress;
    }
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "添加项目" });

    new Setting(contentEl)
      .setName("项目名称")
      .addText((text) =>
        text
          .setPlaceholder("输入项目名称")
          .setValue(this.name)
          .onChange((v) => (this.name = v))
      );

    new Setting(contentEl)
      .setName("描述")
      .addText((text) =>
        text
          .setPlaceholder("项目描述（可选）")
          .setValue(this.description)
          .onChange((v) => (this.description = v))
      );

    new Setting(contentEl)
      .setName("状态")
      .addDropdown((dropdown) => {
        for (const opt of STATUS_OPTIONS) {
          dropdown.addOption(opt.value, opt.label);
        }
        dropdown.setValue(this.status);
        dropdown.onChange((v) => (this.status = v as ProjectStatus));
      });

    new Setting(contentEl)
      .setName("进度")
      .addSlider((slider) =>
        slider
          .setLimits(0, 100, 5)
          .setValue(this.progress)
          .setDynamicTooltip()
          .onChange((v) => (this.progress = v))
      );

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("保存")
        .setCta()
        .onClick(() => {
          if (this.name.trim()) {
            this.onSave({
              name: this.name.trim(),
              description: this.description.trim(),
              status: this.status,
              progress: this.progress,
              taskTotal: 0,
              taskDone: 0,
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
