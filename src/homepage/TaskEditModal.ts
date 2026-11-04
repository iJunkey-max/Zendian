import { App, Modal, Notice, Setting } from "obsidian";
import type { Task, TaskPriority, TaskSyncService } from "../services/TaskSyncService";
import { isTaskScheduleValid } from "../services/TaskSyncService";

export class TaskEditModal extends Modal {
  constructor(app: App, private task: Task, private service: TaskSyncService, private onSaved: () => Promise<void>) { super(app); this.task = structuredClone(task); }
  onOpen(): void {
    this.modalEl.addClass("zendian-shared-modal");
    const c = this.contentEl;
    c.createEl("h2", { text: "编辑任务" });
    let text = this.task.text, due = this.task.due || "", time = this.task.dueTime || "", priority = this.task.priority || "medium", tags = (this.task.tags || []).join(", ");
    let linkedFile = this.task.linkedFile || "";
    new Setting(c).setName("关联文件").setDesc("项目内相对路径，例如 笔记/方案.md；留空解除关联").addText(input => input.setValue(linkedFile).onChange(value => { linkedFile = value; }));
    new Setting(c).setName("任务内容").addTextArea(input => input.setValue(text).onChange(value => { text = value; }));
    new Setting(c).setName("截止日期").addText(input => { input.inputEl.type = "date"; input.setValue(due).onChange(value => { due = value; }); });
    new Setting(c).setName("截止时间").addText(input => { input.inputEl.type = "time"; input.setValue(time).onChange(value => { time = value; }); });
    new Setting(c).setName("优先级").addDropdown(input => input.addOptions({ urgent: "紧急", high: "重要", medium: "普通", low: "较低" }).setValue(priority).onChange(value => { priority = value as TaskPriority; }));
    new Setting(c).setName("标签").setDesc("使用逗号分隔").addText(input => input.setValue(tags).onChange(value => { tags = value; }));
    new Setting(c).addButton(button => button.setButtonText("取消").onClick(() => this.close())).addButton(button => button.setButtonText("保存").setCta().onClick(async () => {
      if (!text.trim()) { new Notice("请填写任务内容"); return; }
      if (!isTaskScheduleValid(due, time)) { new Notice("请检查截止日期和时间；时间必须配合有效日期"); return; }
      button.setDisabled(true);
      try {
        if (!await this.service.updateTask(this.task.projectPath, this.task.id, { text, linkedFile, due, dueTime: time, priority, tags: tags.split(/[,，]/) }, this.task)) throw new Error("未保存：任务可能已变化，或关联文件路径无效，请核对后重试");
      } catch (error) { new Notice(String(error)); button.setDisabled(false); return; }
      this.close();
      try { await this.onSaved(); }
      catch (error) { console.error("[TaskEdit] 任务已保存，页面刷新失败", error); new Notice("任务已保存，页面刷新失败，请重新打开项目"); }
    }));
  }
  onClose(): void { this.contentEl.empty(); }
}
