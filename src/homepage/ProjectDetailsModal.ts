import { App, Modal, Notice, Setting } from "obsidian";
import type { ProjectConsoleData } from "./types";
import { mutateProjectHome } from "./services/ProjectHomeStore";

export class ProjectDetailsModal extends Modal {
  constructor(app: App, private path: string, private initial: ProjectConsoleData, private onSaved: () => Promise<void>) { super(app); this.initial = structuredClone(initial); }
  onOpen(): void {
    this.modalEl.addClass("zendian-shared-modal");
    const c = this.contentEl;
    c.createEl("h2", { text: "项目属性" });
    c.createEl("p", { text: `项目位置：${this.path}。修改显示名称或分类不会移动文件夹。` });
    let name = this.initial.name, category = this.initial.type, description = this.initial.description, overview = this.initial.overview?.markdown || "";
    new Setting(c).setName("显示名称").addText(input => input.setValue(name).onChange(value => { name = value; }));
    new Setting(c).setName("分类").setDesc("独立于项目所在目录").addText(input => input.setValue(category).onChange(value => { category = value; }));
    new Setting(c).setName("简短介绍").addTextArea(input => input.setValue(description).onChange(value => { description = value; }));
    new Setting(c).setName("目标与说明").setDesc("支持 Markdown").addTextArea(input => input.setValue(overview).onChange(value => { overview = value; }));
    new Setting(c).addButton(button => button.setButtonText("取消").onClick(() => this.close())).addButton(button => button.setButtonText("保存").setCta().onClick(async () => {
      if (!name.trim()) { new Notice("请填写项目名称"); return; }
      button.setDisabled(true);
      try {
        const saved = await mutateProjectHome(this.app, this.path, data => {
          if (data.projectId !== this.initial.projectId || data.name !== this.initial.name || data.type !== this.initial.type || data.description !== this.initial.description || (data.overview?.markdown || "") !== (this.initial.overview?.markdown || "")) return false;
          data.name = name.trim(); data.type = category.trim() || "未分类";
          data.description = description.trim();
          data.overview = { ...data.overview, markdown: overview };
          data.updatedAt = new Date().toISOString();
        });
        if (!saved) throw new Error("项目已变化或无法保存，请刷新后重试；输入仍保留");
      } catch (error) { new Notice(String(error)); button.setDisabled(false); return; }
      this.close();
      try { await this.onSaved(); }
      catch (error) { console.error("[ProjectDetails] 属性已保存，页面刷新失败", error); new Notice("项目属性已保存，页面刷新失败，请重新打开项目"); }
    }));
  }
  onClose(): void { this.contentEl.empty(); }
}
