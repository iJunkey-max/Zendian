import { App, TFolder } from "obsidian";
import { ProjectRegistry } from "./ProjectRegistry";
import { createDefaultConsoleData } from "./project-factory";
import { PROJECT_HOME_FILENAME } from "./ProjectHomeFileResolver";
import { isPortableProjectPath } from "../../utils/project-path";
import { getPluginDataPath } from "../../utils/plugin-paths";

export interface ProjectCreationOptions {
  name: string;
  number?: string;
  parentPath: string;
  category: string;
  description: string;
  icon: string;
  subfolders: Array<{ name: string; icon?: string }>;
}

function validSegment(value: string): boolean {
  return !value.includes("/") && isPortableProjectPath(value);
}

/** Both creation surfaces use the same validation and marker-last commit. */
export class ProjectCreationService {
  constructor(private app: App) {}

  async create(options: ProjectCreationOptions): Promise<{ path: string; icons: Record<string, string> }> {
    const name = options.name.trim(), number = options.number?.trim() || "";
    if (!validSegment(name)) throw new Error("请输入有效的项目名称");
    if (number && !/^\d+$/.test(number)) throw new Error("项目编号只能包含数字，也可以留空");
    const parent = options.parentPath.trim() === "/" ? "" : options.parentPath.trim();
    if (parent && parent.split("/").some(part => !validSegment(part))) throw new Error("存放目录无效，请使用知识库内的相对路径");
    const path = [parent, number ? `${number}_${name}` : name].filter(Boolean).join("/");
    if (this.app.vault.getAbstractFileByPath(path)) throw new Error(`目标目录已存在：${path}；可使用“登记现有文件夹”`);
    const registry = await new ProjectRegistry(this.app).discover();
    const overlaps = (folder: string) => !folder || folder === "/" || path === folder || path.startsWith(folder + "/") || folder.startsWith(path + "/");
    if (registry.projects.some(project => overlaps(project.folderPath))) throw new Error("项目不能创建在另一项目内部或包含已有项目");
    if (registry.errors.some(home => overlaps(home.split("/").slice(0, -1).join("/").replace(/\/00 控制台$/, "")))) throw new Error("存放位置涉及无法读取的项目主页，请先检查该项目");
    const templates = options.subfolders.map(template => ({ ...template, name: template.name.trim() }));
    const names = new Set<string>();
    for (const template of templates) {
      const key = template.name.normalize("NFC").toLowerCase();
      if (!validSegment(template.name) || key === PROJECT_HOME_FILENAME.toLowerCase() || names.has(key)) throw new Error("项目子目录模板含有无效或重复名称");
      names.add(key);
    }
    // Validate all existing ancestors before creating anything.
    const segments = path.split("/");
    for (let i = 1; i < segments.length; i++) {
      const ancestor = this.app.vault.getAbstractFileByPath(segments.slice(0, i).join("/"));
      if (ancestor && !(ancestor instanceof TFolder)) throw new Error("存放路径中存在同名文件");
    }
    let published = false;
    const icons: Record<string, string> = {};
    const stageRoot = getPluginDataPath(this.app, "project-staging");
    const stagePath = `${stageRoot}/${globalThis.crypto.randomUUID()}`;
    const ensureFolder = async (folderPath: string): Promise<void> => {
      const parts = folderPath.split("/").filter(Boolean);
      let current = "";
      for (const part of parts) {
        current = current ? `${current}/${part}` : part;
        const existing = this.app.vault.getAbstractFileByPath(current);
        if (existing) {
          if (!(existing instanceof TFolder)) throw new Error(`暂存路径中存在同名文件：${current}`);
          continue;
        }
        await this.app.vault.createFolder(current);
      }
    };
    const removeStage = async (): Promise<void> => {
      const stage = this.app.vault.getAbstractFileByPath(stagePath);
      if (stage) await this.app.vault.delete(stage, true);
    };
    try {
      // Keep the visible project absent until every child folder and the home
      // marker are ready. The selected parent is user-owned and is never
      // removed during cleanup.
      await ensureFolder(stageRoot);
      await this.app.vault.createFolder(stagePath);
      for (const template of templates) {
        const directory = `${stagePath}/${template.name}`;
        await this.app.vault.createFolder(directory);
        if (template.icon) icons[`${path}/${template.name}`] = template.icon;
      }
      await this.app.vault.create(`${stagePath}/${PROJECT_HOME_FILENAME}`, JSON.stringify(createDefaultConsoleData(name, options.icon, options.category || "未分类", options.description.trim()), null, 2));
      const stage = this.app.vault.getAbstractFileByPath(stagePath);
      if (!stage) throw new Error("项目暂存目录未创建");
      for (let i = 1; i < segments.length; i++) {
        const directory = segments.slice(0, i).join("/");
        const existing = this.app.vault.getAbstractFileByPath(directory);
        if (existing && !(existing instanceof TFolder)) throw new Error("存放路径中存在同名文件");
        if (!existing) await this.app.vault.createFolder(directory);
      }
      await this.app.vault.rename(stage, path);
      published = true;
      if (options.icon !== "lucide-folder") icons[path] = options.icon;
      return { path, icons };
    } catch (error) {
      if (!published) {
        try {
          if (this.app.vault.getAbstractFileByPath(path)) throw new Error(`目标目录 ${path} 已出现但未确认完成，未自动删除`);
          await removeStage();
        } catch (cleanupError) {
          throw new Error(`${String(error)}；项目未发布，暂存内容保留在 ${stagePath}，清理失败：${String(cleanupError)}`);
        }
        throw new Error(`${String(error)}；项目未发布，已清理暂存目录`);
      }
      throw new Error(`${String(error)}；项目目录已发布到 ${path}，请重新打开项目检查状态`);
    }
  }
}
