import { App, Modal, Notice, Setting } from "obsidian";
import { ProjectPackageService } from "./services/ProjectPackageService";
import { getServiceManager } from "./services/ServiceManager";

export class ProjectImportModal extends Modal {
  private selectionVersion = 0;
  constructor(app: App, private onImported: () => Promise<void>) { super(app); }
  onOpen(): void {
    this.modalEl.addClass("zendian-shared-modal");
    const c = this.contentEl;
    c.createEl("h2", { text: "导入项目迁移包" });
    c.createEl("p", { text: "选择 ZENdian 导出的 ZIP。只导入到新目录；同一知识库已有原项目时，请选择独立副本。" });
    const input = c.createEl("input", { attr: { type: "file", accept: ".zip", "aria-label": "项目迁移包" } });
    const preview = c.createDiv();
    let bytes: Uint8Array | null = null, destination = "", independent = true;
    const serviceManager = getServiceManager(this.app);
    const service = new ProjectPackageService(this.app, serviceManager.snapshots);
    input.addEventListener("change", async () => {
      const selection = ++this.selectionVersion;
      bytes = null; independent = true; preview.empty();
      try {
        const file = input.files?.[0]; if (!file) return;
        if (file.size > 512 * 1024 * 1024) throw new Error("项目包超过大小限制");
        const candidate = new Uint8Array(await file.arrayBuffer());
        if (selection !== this.selectionVersion) return;
        const data = service.inspect(candidate);
        bytes = candidate;
        preview.createEl("p", { text: `${data.name} · ${data.entries.size} 个包条目 · ${data.historyIncluded ? "包含历史" : "不含历史"}` });
        destination = `${data.name.replace(/[\\/:*?"<>|]/g, "_")}_导入`;
        new Setting(preview).setName("新目录路径").addText(text => text.setValue(destination).onChange(value => { destination = value; }));
        new Setting(preview).setName("作为独立副本").setDesc("生成新项目 ID；关闭时保留原身份并检查冲突").addToggle(toggle => toggle.setValue(true).onChange(value => { independent = value; }));
        new Setting(preview).addButton(button => button.setButtonText("确认导入到新目录").setCta().onClick(async () => {
          if (!bytes) return;
          const importedPath = destination.trim();
          button.setDisabled(true);
          input.disabled = true;
          try {
            await service.import(bytes, importedPath, independent, serviceManager.snapshots);
          } catch (error) { new Notice(String(error)); button.setDisabled(false); input.disabled = false; return; }
          new Notice(`项目已导入：${importedPath}`); this.close();
          try { await this.onImported(); }
          catch (error) { console.error("[ProjectImport] 导入已完成，索引刷新失败", error); new Notice("项目已导入，但索引刷新失败，请使用项目检查重新扫描"); }
        }));
      } catch (error) { if (selection === this.selectionVersion) new Notice(String(error)); }
    });
  }
  onClose(): void { this.selectionVersion++; this.contentEl.empty(); }
}
