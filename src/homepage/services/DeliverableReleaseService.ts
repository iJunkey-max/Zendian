import { App, normalizePath, TFile, TFolder } from "obsidian";
import type { SettingsManager } from "../../core/settings-manager";
import type { ProjectConsoleDeliverable } from "../types";
import { getProjectCategoryFolder } from "../project-categories";
import { createStoreZip } from "../../utils/zip-writer";
import { registerDeliverableFolder, isDeliverablePath } from "./DeliverablePathRegistry";
import { loadProjectHome, mutateProjectHome } from "./ProjectHomeStore";
import { isPortableProjectPath } from "../../utils/project-path";
import { readStoreZip } from "../../utils/zip-reader";

const MANIFEST_NAME = ".zendian-release.json";

export interface DeliverableReleaseInput {
  projectPath: string;
  projectType?: string;
  releaseName: string;
  description: string;
  sourcePaths: string[];
}

export interface ResolvedDeliverableFolder {
  categoryNumber: string;
  folderName: string;
  path: string;
}

/**
 * The archive is durable, but the project-home record was not committed.
 * Keeping this as a typed error lets the UI offer an exact recovery action
 * instead of asking the user to rediscover the generated ZIP manually.
 */
export class DeliverableReleasePendingRecordError extends Error {
  readonly name = "DeliverableReleasePendingRecordError";

  constructor(
    message: string,
    readonly archivePath: string,
  ) {
    super(message);
  }
}

export class DeliverableReleaseService {
  constructor(
    private app: App,
    private settingsManager: SettingsManager,
  ) {}

  resolveFolder(projectPath: string, projectType?: string): ResolvedDeliverableFolder | null {
    const settings = this.settingsManager.getSettings().homepage;
    const normalizedProject = normalizePath(projectPath);
    const parentPath = normalizedProject.includes("/")
      ? normalizedProject.slice(0, normalizedProject.lastIndexOf("/"))
      : "";
    const parentName = parentPath.includes("/") ? parentPath.slice(parentPath.lastIndexOf("/") + 1) : parentPath;
    const category = projectType ? settings.projectCategories.find(item => item.name === projectType) : settings.projectCategories.find((item) =>
      getProjectCategoryFolder(item) === parentName
    );

    const folderName = (category ? settings.projectDeliverableFolders[category.number]?.trim() : "") || "交付物";
    if (!this.isSafeDirectChild(folderName)) return null;
    registerDeliverableFolder(this.app, normalizedProject, folderName);
    return {
      categoryNumber: category?.number || "",
      folderName,
      path: normalizePath(`${normalizedProject}/${folderName}`),
    };
  }

  listSelectableFiles(projectPath: string, projectType?: string): TFile[] {
    const project = this.app.vault.getAbstractFileByPath(normalizePath(projectPath));
    if (!(project instanceof TFolder)) return [];
    const releaseFolder = this.resolveFolder(projectPath, projectType)?.path;
    const files: TFile[] = [];
    const visit = (folder: TFolder): void => {
      for (const child of folder.children) {
        if (isDeliverablePath(this.app, projectPath, child.path)) continue;
        if (releaseFolder && (child.path === releaseFolder || child.path.startsWith(`${releaseFolder}/`))) continue;
        if (child instanceof TFolder) visit(child);
        else if (child instanceof TFile && child.extension.toLowerCase() !== "home") files.push(child);
      }
    };
    visit(project);
    return files.sort((a, b) => a.path.localeCompare(b.path, "zh-CN"));
  }

  async publish(input: DeliverableReleaseInput): Promise<ProjectConsoleDeliverable> {
    const name = this.validateReleaseName(input.releaseName);
    const folder = this.resolveFolder(input.projectPath, input.projectType);
    if (!folder) throw new Error("交付物文件夹配置含有无效名称，请在设置中修正");
    if (!input.sourcePaths.length) throw new Error("请至少选择一个交付文件");

    const projectPrefix = `${normalizePath(input.projectPath)}/`;
    const selected: TFile[] = [];
    const basenames = new Set<string>();
    for (const sourcePath of input.sourcePaths) {
      const normalized = normalizePath(sourcePath);
      if (!normalized.startsWith(projectPrefix) || normalized.startsWith(`${folder.path}/`) || isDeliverablePath(this.app, input.projectPath, normalized)) {
        throw new Error("只能选择当前项目内、交付物文件夹之外的文件");
      }
      const file = this.app.vault.getAbstractFileByPath(normalized);
      if (!(file instanceof TFile) || file.extension.toLowerCase() === "home") {
        throw new Error(`无法交付该文件：${normalized}`);
      }
      if (file.name.toLocaleLowerCase() === MANIFEST_NAME) throw new Error(`${MANIFEST_NAME} 是系统保留文件名`);
      const key = file.name.normalize("NFC").toLowerCase();
      if (basenames.has(key)) throw new Error(`发现同名文件：${file.name}，请取消其中一个文件后再提交`);
      basenames.add(key);
      selected.push(file);
    }

    const zipPath = normalizePath(`${folder.path}/${name}.zip`);
    let existingData = await loadProjectHome(this.app, input.projectPath);
    if (!existingData) throw new Error("项目主页无法读取或存在冲突，已停止发布");
    if (!existingData.data.projectId) {
      if (!await mutateProjectHome(this.app, input.projectPath, () => undefined)) throw new Error("旧项目身份建立失败，未生成发布包");
      existingData = await loadProjectHome(this.app, input.projectPath);
      if (!existingData?.data.projectId) throw new Error("项目身份无法确认，未生成发布包");
    }
    const projectId = existingData.data.projectId;
    if (existingData?.data.deliverables.some((item) => item.format === "zip" && item.name === name)) {
      throw new Error(`版本“${name}”已经存在，请修改发布名称`);
    }
    if (this.app.vault.getAbstractFileByPath(zipPath)) {
      throw new Error(`版本“${name}”已经存在，请修改发布名称`);
    }

    const createdAt = new Date().toISOString();
    const releaseId = `release-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const observed = selected.map(file => ({ file, path: file.path, name: file.name, size: file.stat.size, mtime: file.stat.mtime }));
    if (observed.reduce((sum, item) => sum + item.size, 0) > 256 * 1024 * 1024) throw new Error("单次交付文件超过 256 MB，请分批发布");
    const entries = [];
    for (const item of observed) {
      const data = new Uint8Array(await this.app.vault.readBinary(item.file));
      if (data.byteLength !== item.size) throw new Error("发布期间源文件发生变化，请重试");
      entries.push({ name: item.name, data, modifiedAt: new Date(item.mtime) });
    }
    if (observed.some(item => item.file.path !== item.path || item.file.stat.size !== item.size || item.file.stat.mtime !== item.mtime || this.app.vault.getAbstractFileByPath(item.path) !== item.file)) throw new Error("发布期间源文件发生变化，请重试");
    const manifest = {
      schemaVersion: 1,
      releaseId,
      projectPath: normalizePath(input.projectPath),
      projectId,
      versionName: name,
      description: input.description.trim(),
      createdAt,
      files: observed.map((item) => ({
        sourcePath: item.path.slice(projectPrefix.length),
        releaseName: item.name,
        size: item.size,
      })),
    };
    entries.push({
      name: MANIFEST_NAME,
      data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
      modifiedAt: new Date(createdAt),
    });

    if (!this.app.vault.getAbstractFileByPath(folder.path)) {
      await this.app.vault.createFolder(folder.path);
    }
    const zip = createStoreZip(entries);
    const buffer = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
    await this.app.vault.createBinary(zipPath, buffer);

    const release: ProjectConsoleDeliverable = {
      id: releaseId,
      name,
      path: zipPath.slice(projectPrefix.length),
      description: input.description.trim() || undefined,
      createdAt,
      format: "zip",
      fileCount: selected.length,
    };
    const committed = await mutateProjectHome(this.app, input.projectPath, data => {
      if (data.projectId !== projectId || data.deliverables.some(item => item.path === release.path || (item.format === "zip" && item.name === name))) return false;
      data.deliverables.push(release);
    });
    if (!committed) {
      throw new DeliverableReleasePendingRecordError(
        `ZIP 已生成在 ${zipPath}，但项目记录未保存；请使用“补登记已有发布包”，不要重复发布`,
        zipPath,
      );
    }
    return release;
  }

  async deleteArchive(projectPath: string, _projectType: string, deliverable: ProjectConsoleDeliverable): Promise<void> {
    if (deliverable.format !== "zip") return;
    if (!isPortableProjectPath(deliverable.path) || deliverable.path.split("/").length !== 2 || !deliverable.path.toLowerCase().endsWith(".zip")) throw new Error("交付物路径无效，已停止删除");
    const projectPrefix = `${normalizePath(projectPath)}/`;
    const archivePath = normalizePath(`${projectPrefix}${deliverable.path}`);
    const file = this.app.vault.getAbstractFileByPath(archivePath);
    if (!file) return;
    if (!(file instanceof TFile)) throw new Error("交付物位置当前不是文件，已停止删除");
    const mtime = file.stat.mtime, size = file.stat.size;
    const entries = readStoreZip(new Uint8Array(await this.app.vault.readBinary(file)));
    const manifestBytes = entries.get(MANIFEST_NAME);
    if (!manifestBytes) throw new Error("ZIP 不包含发布清单，请核对文件后手动处理");
    const manifest = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes));
    if (manifest.schemaVersion !== 1 || manifest.versionName !== deliverable.name || (deliverable.id && manifest.releaseId !== deliverable.id)) throw new Error("ZIP 发布身份与项目记录不一致，未删除");
    if (file.path !== archivePath || file.stat.mtime !== mtime || file.stat.size !== size) throw new Error("校验期间 ZIP 已变化，未删除");
    await this.app.vault.trash(file, false);
  }

  async recoverArchive(projectPath: string, relativePath: string): Promise<ProjectConsoleDeliverable> {
    const project = await loadProjectHome(this.app, projectPath);
    if (!project) throw new Error("项目主页不可读取，无法确认发布包归属");
    if (!isPortableProjectPath(relativePath) || relativePath.split("/").length !== 2 || !relativePath.toLowerCase().endsWith(".zip")) throw new Error("请选择项目内交付目录中的 ZIP");
    const path = `${normalizePath(projectPath)}/${relativePath}`;
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) throw new Error("发布包不存在");
    const size = file.stat.size, mtime = file.stat.mtime;
    const entries = readStoreZip(new Uint8Array(await this.app.vault.readBinary(file)));
    const bytes = entries.get(MANIFEST_NAME);
    if (!bytes) throw new Error("文件不是可识别的发布包");
    const manifest = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (manifest.schemaVersion !== 1 || typeof manifest.releaseId !== "string" || !manifest.releaseId || typeof manifest.versionName !== "string" || !Array.isArray(manifest.files) || !Number.isFinite(Date.parse(manifest.createdAt))) throw new Error("发布清单无效");
    if (manifest.projectId ? manifest.projectId !== project.data.projectId : manifest.projectPath !== normalizePath(projectPath)) throw new Error("发布包记录的项目归属不同，请先核对");
    const declared = new Set<string>();
    for (const item of manifest.files) {
      if (!item || typeof item.releaseName !== "string" || item.releaseName === MANIFEST_NAME || declared.has(item.releaseName) || !entries.has(item.releaseName) || entries.get(item.releaseName)!.byteLength !== item.size) throw new Error("发布清单与包内文件不一致");
      declared.add(item.releaseName);
    }
    if (!declared.size || entries.size !== declared.size + 1) throw new Error("发布清单未完整覆盖包内文件");
    const release: ProjectConsoleDeliverable = { id: manifest.releaseId, name: manifest.versionName, path: relativePath, format: "zip", createdAt: manifest.createdAt, description: typeof manifest.description === "string" ? manifest.description : undefined, fileCount: manifest.files.length };
    const saved = await mutateProjectHome(this.app, projectPath, data => {
      if (data.projectId !== project.data.projectId) return false;
      if (file.path !== path || file.stat.size !== size || file.stat.mtime !== mtime) return false;
      if (data.deliverables.some(item => item.id === release.id || item.path === relativePath || (item.format === "zip" && item.name === release.name))) return false;
      data.deliverables.push(release);
    });
    if (!saved) throw new Error("记录已存在、文件已变化或主页保存失败，未重复登记");
    return release;
  }

  private validateReleaseName(value: string): string {
    const name = value.trim();
    if (!name) throw new Error("请填写发布名称");
    if (!isPortableProjectPath(name) || name.includes("/")) {
      throw new Error("发布名称不能以点开头，也不能包含 \\\\ / : * ? \" < > |");
    }
    return name;
  }

  private isSafeDirectChild(folderName: string | undefined): folderName is string {
    return !!folderName && !folderName.includes("/") && isPortableProjectPath(folderName);
  }
}
