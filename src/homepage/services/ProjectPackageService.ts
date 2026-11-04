import { type App, TFolder } from "obsidian";
import { isPortableProjectPath } from "../../utils/project-path";
import { createStoreZip, type StoreZipEntry } from "../../utils/zip-writer";
import { loadProjectHome } from "./ProjectHomeStore";
import { getPluginDataPath } from "../../utils/plugin-paths";
import { readStoreZip } from "../../utils/zip-reader";
import { isProjectData } from "./project-validation";
import { ProjectRegistry } from "./ProjectRegistry";
import { ProjectSnapshotService } from "./ProjectSnapshotService";

/** Portable archive with explicit scope; original folder hierarchy is preserved. */
export class ProjectPackageService {
  constructor(private app: App, private sharedSnapshots?: ProjectSnapshotService) {}
  async import(bytes: Uint8Array, destination: string, independent: boolean, snapshots: ProjectSnapshotService): Promise<void> {
    const inspected = this.inspect(bytes);
    if (!isPortableProjectPath(destination)) throw new Error("目标目录无效");
    if (this.app.vault.getAbstractFileByPath(destination)) throw new Error("目标目录已存在，未覆盖");
    const projects = await new ProjectRegistry(this.app).discover();
    const overlaps = (folder: string) => !folder || folder === "/" || destination === folder || destination.startsWith(folder + "/") || folder.startsWith(destination + "/");
    if (projects.projects.some(project => overlaps(project.folderPath)) || projects.errors.some(home => overlaps(home.split("/").slice(0, -1).join("/").replace(/\/00 控制台$/, "")))) throw new Error("导入位置涉及现有项目，请选择独立目录");
    const parentParts = destination.split("/");
    for (let i = 1; i < parentParts.length; i++) {
      const parent = this.app.vault.getAbstractFileByPath(parentParts.slice(0, i).join("/"));
      if (parent && !(parent instanceof TFolder)) throw new Error("目标路径中存在同名文件");
    }
    if (!independent && projects.projects.some(project => project.projectId === inspected.projectId)) throw new Error("项目身份已存在，请选择独立副本");
    const createdId = independent ? globalThis.crypto.randomUUID() : inspected.projectId;
    let historySource: unknown;
    const historyBlobs = new Map<string, string>();
    if (inspected.historyIncluded) {
      const decoder = new TextDecoder("utf-8", { fatal: true });
      historySource = JSON.parse(decoder.decode(inspected.entries.get("history/project.json")));
      for (const [path, data] of inspected.entries) if (path.startsWith("history/blobs/")) historyBlobs.set(path.slice(14, -4), decoder.decode(data));
      // Reject broken history before creating any destination folders or files.
      await snapshots.validateProjectHistoryImport(historySource, inspected.originalPath, destination, historyBlobs);
    }
    let homeTarget = "", homeContent = "";
    const stageRoot = getPluginDataPath(this.app, "import-staging");
    const stagePath = `${stageRoot}/${globalThis.crypto.randomUUID()}`;
    let published = false;
    let rollbackHistory: (() => Promise<void>) | undefined;
    const ensureFolder = async (path: string): Promise<void> => {
      const parts = path.split("/").filter(Boolean);
      let current = "";
      for (const part of parts) {
        current = current ? `${current}/${part}` : part;
        const existing = this.app.vault.getAbstractFileByPath(current);
        if (existing) {
          if (!(existing instanceof TFolder)) throw new Error(`目标路径中存在同名文件：${current}`);
          continue;
        }
        await this.app.vault.createFolder(current);
      }
    };
    const removeFolder = async (path: string): Promise<void> => {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!file) return;
      await this.app.vault.delete(file, true);
    };
    try {
      // Import into the plugin-owned staging folder first. The destination is not
      // published until every project file has been written and the stage folder
      // can be moved as one unit.
      await ensureFolder(stageRoot);
      await this.app.vault.createFolder(stagePath);
      for (const [path, data] of inspected.entries) {
        if (!path.startsWith("project/")) continue;
        const relative = path.slice(8), target = stagePath + "/" + relative;
        const parts = relative.split("/").slice(0, -1);
        let folder = stagePath;
        for (const part of parts) { folder += "/" + part; if (!this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder); }
        if (relative.endsWith(".home")) {
          const home = JSON.parse(new TextDecoder().decode(data)); home.projectId = createdId;
          homeTarget = destination + "/" + relative; homeContent = JSON.stringify(home, null, 2);
        } else await this.app.vault.createBinary(target, data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
      }
      if (!homeTarget) throw new Error("项目包缺少项目主页");
      const stageFolder = this.app.vault.getAbstractFileByPath(stagePath);
      if (!stageFolder) throw new Error("导入暂存目录未创建");
      for (let i = 1; i < parentParts.length; i++) {
        const parent = parentParts.slice(0, i).join("/");
        const existing = this.app.vault.getAbstractFileByPath(parent);
        if (existing && !(existing instanceof TFolder)) throw new Error("目标路径中存在同名文件");
        if (!existing) await this.app.vault.createFolder(parent);
      }
      await this.app.vault.rename(stageFolder, destination);
      published = true;
      if (inspected.historyIncluded) {
        rollbackHistory = await snapshots.importProjectHistory(historySource, inspected.originalPath, destination, historyBlobs);
      }
      // Publish the project marker only after its content and history are available.
      await this.app.vault.create(homeTarget, homeContent);
    } catch (error) {
      let cleanupError: unknown;
      try {
        if (rollbackHistory) await rollbackHistory();
        if (published) await removeFolder(destination);
        else if (this.app.vault.getAbstractFileByPath(destination)) throw new Error(`目标目录 ${destination} 已出现但未确认完成，未自动删除`);
        else await removeFolder(stagePath);
      } catch (cleanup) {
        cleanupError = cleanup;
      }
      if (cleanupError) throw new Error(`项目导入未完成，清理失败；${published ? `已发布目录保留在 ${destination}` : `暂存内容保留在 ${stagePath}`}，请先备份后处理：${String(error)}；清理错误：${String(cleanupError)}`);
      throw new Error(`项目导入未完成，目标未发布，已清理暂存内容：${String(error)}`);
    }
  }
  inspect(bytes: Uint8Array): { entries: Map<string, Uint8Array>; projectId: string; name: string; originalPath: string; historyIncluded: boolean } {
    const entries = readStoreZip(bytes);
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const manifestBytes = entries.get("manifest.json");
    if (!manifestBytes) throw new Error("缺少项目包清单");
    const manifest = JSON.parse(decoder.decode(manifestBytes));
    if (manifest.format !== "zendian-project" || manifest.version !== 1 || typeof manifest.projectId !== "string" || !isPortableProjectPath(manifest.originalPath) || typeof manifest.historyIncluded !== "boolean") throw new Error("项目包清单版本或身份无效");
    const projectPaths = [...entries.keys()].filter(path => path.startsWith("project/")).map(path => path.slice(8));
    if (manifest.files !== projectPaths.length || projectPaths.some(path => !isPortableProjectPath(path))) throw new Error("项目包文件清单或路径无效");
    const fileKeys = new Set(projectPaths.map(path => path.normalize("NFC").toLowerCase()));
    if (projectPaths.some(path => path.split("/").slice(0, -1).some((_, index, parts) => fileKeys.has(parts.slice(0, index + 1).join("/").normalize("NFC").toLowerCase())))) throw new Error("项目包存在文件与目录冲突");
    const homes = [...entries.keys()].filter(path => path.startsWith("project/") && path.endsWith(".home"));
    if (homes.length !== 1) throw new Error("项目包必须包含唯一项目主页");
    const homeParts = homes[0].slice(8).split("/");
    if (homeParts.length !== 1 && !(homeParts.length === 2 && homeParts[0] === "00 控制台")) throw new Error("项目主页必须位于项目根目录或旧控制台目录");
    const data = JSON.parse(decoder.decode(entries.get(homes[0])));
    if (!isProjectData(data) || data.projectId !== manifest.projectId) throw new Error("项目身份与清单不一致");
    if ([...entries.keys()].some(path => path !== "manifest.json" && !path.startsWith("project/") && !path.startsWith("history/"))) throw new Error("项目包包含未知内容");
    const historyPaths = [...entries.keys()].filter(path => path.startsWith("history/"));
    if (manifest.historyIncluded !== entries.has("history/project.json") || (!manifest.historyIncluded && historyPaths.length) || historyPaths.some(path => path !== "history/project.json" && !/^history\/blobs\/(?:[a-f0-9]+|fnv-[a-f0-9]+)\.txt$/i.test(path))) throw new Error("项目包历史范围与清单不一致");
    return { entries, projectId: data.projectId!, name: data.name, originalPath: manifest.originalPath, historyIncluded: Boolean(manifest.historyIncluded) };
  }
  async export(projectPath: string, includeHistory: boolean): Promise<Uint8Array> {
    const record = await loadProjectHome(this.app, projectPath);
    if (!record?.data.projectId) throw new Error("请先为项目建立身份");
    const prefix = projectPath + "/";
    const files = this.app.vault.getFiles().filter(file => file.path.startsWith(prefix));
    if (!isPortableProjectPath(projectPath) || files.some(file => !isPortableProjectPath(file.path.slice(prefix.length)))) throw new Error("项目含有无法跨平台导入的路径，请调整名称后导出");
    const initialFiles = files.map(file => ({ file, path: file.path, mtime: file.stat.mtime, size: file.stat.size }));
    if (files.reduce((sum, file) => sum + file.stat.size, 0) > 256 * 1024 * 1024) throw new Error("项目超过 256 MB，请使用文件系统复制并单独备份历史");
    const entries: StoreZipEntry[] = [];
    const encoder = new TextEncoder();
    for (const file of files) {
      const mtime = file.stat.mtime, size = file.stat.size, path = file.path;
      const bytes = new Uint8Array(await this.app.vault.readBinary(file));
      if (file.path !== path || file.stat.mtime !== mtime || file.stat.size !== size) throw new Error("导出期间文件发生变化，请重试");
      entries.push({ name: "project/" + path.slice(prefix.length), data: bytes, modifiedAt: new Date(mtime) });
    }
    let historyIncluded = false;
    if (includeHistory) {
      const indexPath = getPluginDataPath(this.app, "project-history/index.json");
      if (await this.app.vault.adapter.exists(indexPath)) {
        const historyService = this.sharedSnapshots ?? new ProjectSnapshotService(this.app);
        const history = await historyService.exportProjectHistory(projectPath);
        if (history) {
          entries.push({ name: "history/project.json", data: encoder.encode(JSON.stringify(history.project)) });
          for (const [hash, content] of history.blobs) entries.push({ name: `history/blobs/${hash}.txt`, data: encoder.encode(content) });
          historyIncluded = true;
        }
      }
    }
    entries.push({ name: "manifest.json", data: encoder.encode(JSON.stringify({ format: "zendian-project", version: 1, projectId: record.data.projectId, originalPath: projectPath, exportedAt: new Date().toISOString(), historyIncluded, files: files.length })) });
    const finalPaths = new Set(this.app.vault.getFiles().filter(file => file.path.startsWith(prefix)).map(file => file.path));
    if (finalPaths.size !== initialFiles.length || initialFiles.some(({ file, path, mtime, size }) => !finalPaths.has(path) || file.path !== path || file.stat.mtime !== mtime || file.stat.size !== size)) throw new Error("导出期间项目文件发生变化，请重试");
    const archive = createStoreZip(entries, { allowPaths: true });
    if (archive.byteLength > 512 * 1024 * 1024) throw new Error("包含历史后的项目包超过 512 MB，请减少历史范围后导出");
    this.inspect(archive);
    return archive;
  }
}
