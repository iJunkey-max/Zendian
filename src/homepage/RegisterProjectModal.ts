import { App, Notice, SuggestModal, TFolder } from "obsidian";
import { ProjectRegistry } from "./services/ProjectRegistry";
import { createDefaultConsoleData } from "./services/project-factory";
import { PROJECT_HOME_FILENAME } from "./services/ProjectHomeFileResolver";

export class RegisterProjectModal extends SuggestModal<TFolder> {
  private submitting = false;
  constructor(app: App, private onChanged: () => Promise<void>) {
    super(app);
    this.modalEl.addClass("zendian-shared-modal");
    this.setPlaceholder("选择现有文件夹作为项目，原有内容会保留");
  }
  getSuggestions(query: string): TFolder[] {
    return this.app.vault.getAllLoadedFiles().filter((file): file is TFolder => file instanceof TFolder && file.path !== "/" && file.path.toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0, 100);
  }
  renderSuggestion(folder: TFolder, el: HTMLElement): void { el.setText(folder.path); }
  onChooseSuggestion(folder: TFolder): void { void this.register(folder); }
  private async register(folder: TFolder): Promise<void> {
    if (this.submitting) return;
    this.submitting = true;
    try {
      const result = await new ProjectRegistry(this.app).discover();
      const overlaps = (path: string) => !path || path === "/" || path === folder.path || folder.path.startsWith(path + "/") || path.startsWith(folder.path + "/");
      const conflict = result.projects.some(project => overlaps(project.folderPath));
      if (conflict) throw new Error("此目录已属于项目，或包含项目；请先处理现有项目关系");
      if (result.errors.some(path => overlaps(path.split("/").slice(0, -1).join("/").replace(/\/00 控制台$/, "")))) throw new Error("此目录涉及无法读取的项目主页，请先检查原文件，未创建新主页");
      if (this.app.vault.getAbstractFileByPath(folder.path) !== folder) throw new Error("文件夹已移动或变化，请重新选择");
      const path = `${folder.path}/${PROJECT_HOME_FILENAME}`;
      if (this.app.vault.getAbstractFileByPath(path)) throw new Error("目标项目主页已存在，未覆盖");
      await this.app.vault.create(path, JSON.stringify(createDefaultConsoleData(folder.name, "lucide-folder", "未分类"), null, 2));
      new Notice("已登记项目，原有文件和目录结构已保留");
      try { await this.onChanged(); }
      catch (error) { console.error("[RegisterProject] 已登记，重新核对失败", error); new Notice("项目已登记，但重新核对失败，请使用项目检查重新扫描"); }
    } catch (error) { new Notice(String(error)); }
    finally { this.submitting = false; }
  }
}
