import { App, normalizePath, TFile, TFolder } from "obsidian";
import type { SettingsManager } from "../../core/settings-manager";
import type { ProjectConsoleDeliverable } from "../types";
import { getProjectCategoryFolder } from "../project-categories";
import { createStoreZip } from "../../utils/zip-writer";
import { registerDeliverableFolder } from "./DeliverablePathRegistry";
import { loadProjectHome } from "./ProjectHomeStore";

const MANIFEST_NAME = ".zendian-release.json";
const INVALID_RELEASE_NAME = /[\\/:*?"<>|]/;

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
    const category = settings.projectCategories.find((item) =>
      getProjectCategoryFolder(item) === parentName
    ) ?? settings.projectCategories.find((item) => item.name === projectType);
    if (!category) return null;

    const folderName = settings.projectDeliverableFolders[category.number]?.trim();
    if (!this.isSafeDirectChild(folderName)) return null;
    registerDeliverableFolder(normalizedProject, folderName);
    return {
      categoryNumber: category.number,
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
    if (!folder) throw new Error("当前项目分类尚未配置交付物文件夹，请先在设置中配置");
    if (!input.sourcePaths.length) throw new Error("请至少选择一个交付文件");

    const projectPrefix = `${normalizePath(input.projectPath)}/`;
    const selected: TFile[] = [];
    const basenames = new Set<string>();
    for (const sourcePath of input.sourcePaths) {
      const normalized = normalizePath(sourcePath);
      if (!normalized.startsWith(projectPrefix) || normalized.startsWith(`${folder.path}/`)) {
        throw new Error("只能选择当前项目内、交付物文件夹之外的文件");
      }
      const file = this.app.vault.getAbstractFileByPath(normalized);
      if (!(file instanceof TFile) || file.extension.toLowerCase() === "home") {
        throw new Error(`无法交付该文件：${normalized}`);
      }
      if (file.name.toLocaleLowerCase() === MANIFEST_NAME) throw new Error(`${MANIFEST_NAME} 是系统保留文件名`);
      if (basenames.has(file.name)) throw new Error(`发现同名文件：${file.name}，请取消其中一个文件后再提交`);
      basenames.add(file.name);
      selected.push(file);
    }

    const zipPath = normalizePath(`${folder.path}/${name}.zip`);
    const existingData = await loadProjectHome(this.app, input.projectPath);
    if (existingData?.data.deliverables.some((item) => item.format === "zip" && item.name === name)) {
      throw new Error(`版本“${name}”已经存在，请修改发布名称`);
    }
    if (this.app.vault.getAbstractFileByPath(zipPath)) {
      throw new Error(`版本“${name}”已经存在，请修改发布名称`);
    }

    const createdAt = new Date().toISOString();
    const releaseId = `release-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const entries = await Promise.all(selected.map(async (file) => ({
      name: file.name,
      data: new Uint8Array(await this.app.vault.readBinary(file)),
      modifiedAt: new Date(file.stat.mtime),
    })));
    const manifest = {
      schemaVersion: 1,
      releaseId,
      projectPath: normalizePath(input.projectPath),
      versionName: name,
      description: input.description.trim(),
      createdAt,
      files: selected.map((file) => ({
        sourcePath: file.path.slice(projectPrefix.length),
        releaseName: file.name,
        size: file.stat.size,
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

    return {
      id: releaseId,
      name,
      path: zipPath.slice(projectPrefix.length),
      description: input.description.trim() || undefined,
      createdAt,
      format: "zip",
      fileCount: selected.length,
    };
  }

  async deleteArchive(projectPath: string, projectType: string, deliverable: ProjectConsoleDeliverable): Promise<void> {
    if (deliverable.format !== "zip") return;
    const projectPrefix = `${normalizePath(projectPath)}/`;
    const archivePath = normalizePath(`${projectPrefix}${deliverable.path}`);
    const folder = this.resolveFolder(projectPath, projectType);
    if (!folder || !archivePath.startsWith(`${folder.path}/`)) {
      throw new Error("交付物路径无效，已停止删除");
    }
    const file = this.app.vault.getAbstractFileByPath(archivePath);
    if (file instanceof TFile) await this.app.vault.trash(file, false);
  }

  private validateReleaseName(value: string): string {
    const name = value.trim();
    if (!name) throw new Error("请填写发布名称");
    if (name === "." || name === ".." || name.startsWith(".") || INVALID_RELEASE_NAME.test(name)) {
      throw new Error("发布名称不能以点开头，也不能包含 \\\\ / : * ? \" < > |");
    }
    return name;
  }

  private isSafeDirectChild(folderName: string | undefined): folderName is string {
    if (!folderName || folderName === "." || folderName === "..") return false;
    if (folderName.includes("/") || folderName.includes("\\") || INVALID_RELEASE_NAME.test(folderName)) return false;
    return folderName.toLowerCase() !== ".obsidian";
  }
}
