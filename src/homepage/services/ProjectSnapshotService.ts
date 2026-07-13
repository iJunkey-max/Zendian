import { App, TFile, TFolder, normalizePath } from "obsidian";
import type { DataChangeEvent } from "./types";

export type SnapshotAction = "baseline" | "created" | "modified" | "deleted" | "checkpoint" | "safety" | "restored";

export interface SnapshotVersion {
  id: string;
  projectPath: string;
  filePath: string;
  timestamp: number;
  hash: string;
  size: number;
  action: SnapshotAction;
  checkpointId?: string;
}

export interface ProjectCheckpoint {
  id: string;
  projectPath: string;
  name: string;
  createdAt: number;
  versions: Record<string, string>;
}

interface SnapshotProjectIndex {
  path: string;
  versions: SnapshotVersion[];
  checkpoints: ProjectCheckpoint[];
}

interface SnapshotIndex {
  version: 1;
  projects: Record<string, SnapshotProjectIndex>;
}

export interface SnapshotComparison {
  version: SnapshotVersion;
  snapshotContent: string;
  currentContent: string | null;
  added: number;
  removed: number;
  preview: Array<{ kind: "same" | "added" | "removed"; text: string }>;
}

const HISTORY_ROOT = ".obsidian/plugins/zendian/project-history";
const INDEX_PATH = `${HISTORY_ROOT}/index.json`;
const BLOBS_PATH = `${HISTORY_ROOT}/blobs`;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_AUTO_VERSIONS_PER_FILE = 30;
const TEXT_EXTENSIONS = new Set(["md", "canvas", "json", "home", "txt", "css", "js", "ts", "yaml", "yml"]);

export class ProjectSnapshotService {
  private index: SnapshotIndex = { version: 1, projects: {} };
  private loadPromise: Promise<void> | null = null;
  private saveQueue: Promise<void> = Promise.resolve();

  constructor(private app: App) {}

  async initializeProject(projectPath: string): Promise<void> {
    await this.ensureLoaded();
    const folder = this.app.vault.getAbstractFileByPath(projectPath);
    if (!(folder instanceof TFolder)) return;

    for (const file of this.getSupportedFiles(folder)) {
      await this.captureFile(projectPath, file.path, "baseline", file.stat.mtime);
    }
  }

  async captureEvent(event: DataChangeEvent): Promise<SnapshotVersion | null> {
    const projectPath = typeof event.data?.projectPath === "string" ? event.data.projectPath : "";
    if (!projectPath || !event.path.startsWith(`${projectPath}/`)) return null;

    if (event.action === "delete") {
      return this.recordDeletion(projectPath, event.path, event.timestamp);
    }

    return this.captureFile(
      projectPath,
      event.path,
      event.action === "create" ? "created" : "modified",
      event.timestamp,
    );
  }

  async captureFile(
    projectPath: string,
    filePath: string,
    action: SnapshotAction = "modified",
    timestamp = Date.now(),
    force = false,
  ): Promise<SnapshotVersion | null> {
    await this.ensureLoaded();
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile) || !this.isSupported(file) || file.stat.size > MAX_FILE_BYTES) return null;
    if (!file.path.startsWith(`${projectPath}/`)) return null;

    const content = await this.app.vault.read(file);
    const hash = await this.hash(content);
    const project = this.getProject(projectPath);
    const latest = this.getLatestVersion(projectPath, filePath);
    if (!force && latest?.hash === hash && latest.action !== "deleted") return latest;

    await this.writeBlob(hash, content);
    const version: SnapshotVersion = {
      id: this.createId("v"),
      projectPath,
      filePath,
      timestamp,
      hash,
      size: content.length,
      action,
    };
    project.versions.push(version);
    this.pruneFileVersions(project, filePath);
    await this.saveIndex();
    return version;
  }

  async createCheckpoint(projectPath: string, name: string): Promise<ProjectCheckpoint> {
    await this.initializeProject(projectPath);
    const project = this.getProject(projectPath);
    const checkpointId = this.createId("c");
    const versions: Record<string, string> = {};

    const folder = this.app.vault.getAbstractFileByPath(projectPath);
    if (folder instanceof TFolder) {
      for (const file of this.getSupportedFiles(folder)) {
        const latest = this.getLatestVersion(projectPath, file.path);
        if (latest && latest.action !== "deleted") versions[file.path] = latest.id;
      }
    }

    const checkpoint: ProjectCheckpoint = {
      id: checkpointId,
      projectPath,
      name: name.trim() || `项目检查点 ${new Date().toLocaleString()}`,
      createdAt: Date.now(),
      versions,
    };
    project.checkpoints.push(checkpoint);
    await this.saveIndex();
    return checkpoint;
  }

  async getVersions(projectPath: string): Promise<SnapshotVersion[]> {
    await this.ensureLoaded();
    return [...this.getProject(projectPath).versions].sort((a, b) => b.timestamp - a.timestamp);
  }

  async getCheckpoints(projectPath: string): Promise<ProjectCheckpoint[]> {
    await this.ensureLoaded();
    return [...this.getProject(projectPath).checkpoints].sort((a, b) => b.createdAt - a.createdAt);
  }

  async getTrackedProjectPaths(): Promise<string[]> {
    await this.ensureLoaded();
    return Object.keys(this.index.projects);
  }

  async getComparison(versionId: string): Promise<SnapshotComparison | null> {
    await this.ensureLoaded();
    const version = this.findVersion(versionId);
    if (!version) return null;
    const snapshotContent = await this.readBlob(version.hash);
    const currentFile = this.app.vault.getAbstractFileByPath(version.filePath);
    const currentContent = currentFile instanceof TFile ? await this.app.vault.read(currentFile) : null;
    const diff = this.createSimpleDiff(snapshotContent, currentContent ?? "");
    return { version, snapshotContent, currentContent, ...diff };
  }

  async restoreVersion(versionId: string): Promise<boolean> {
    await this.ensureLoaded();
    const version = this.findVersion(versionId);
    if (!version) return false;

    const current = this.app.vault.getAbstractFileByPath(version.filePath);
    if (current instanceof TFile) {
      await this.captureFile(version.projectPath, version.filePath, "safety", Date.now(), true);
    }

    const content = await this.readBlob(version.hash);
    const existing = this.app.vault.getAbstractFileByPath(version.filePath);
    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, content);
    } else {
      await this.ensureVaultParent(version.filePath);
      await this.app.vault.create(version.filePath, content);
    }

    await this.captureFile(version.projectPath, version.filePath, "restored", Date.now(), true);
    return true;
  }

  private async recordDeletion(projectPath: string, filePath: string, timestamp: number): Promise<SnapshotVersion | null> {
    await this.ensureLoaded();
    const latest = this.getLatestVersion(projectPath, filePath);
    if (!latest || latest.action === "deleted") return latest ?? null;
    const version: SnapshotVersion = {
      ...latest,
      id: this.createId("v"),
      timestamp,
      action: "deleted",
    };
    this.getProject(projectPath).versions.push(version);
    await this.saveIndex();
    return version;
  }

  private getProject(projectPath: string): SnapshotProjectIndex {
    if (!this.index.projects[projectPath]) {
      this.index.projects[projectPath] = { path: projectPath, versions: [], checkpoints: [] };
    }
    return this.index.projects[projectPath];
  }

  private getLatestVersion(projectPath: string, filePath: string): SnapshotVersion | undefined {
    return this.getProject(projectPath).versions
      .filter((version) => version.filePath === filePath)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
  }

  private findVersion(versionId: string): SnapshotVersion | undefined {
    for (const project of Object.values(this.index.projects)) {
      const version = project.versions.find((item) => item.id === versionId);
      if (version) return version;
    }
    return undefined;
  }

  private pruneFileVersions(project: SnapshotProjectIndex, filePath: string): void {
    const protectedIds = new Set(project.checkpoints.flatMap((checkpoint) => Object.values(checkpoint.versions)));
    const auto = project.versions
      .filter((version) => version.filePath === filePath && !protectedIds.has(version.id) && !["safety", "restored"].includes(version.action))
      .sort((a, b) => b.timestamp - a.timestamp);
    const removeIds = new Set(auto.slice(MAX_AUTO_VERSIONS_PER_FILE).map((version) => version.id));
    if (removeIds.size) project.versions = project.versions.filter((version) => !removeIds.has(version.id));
  }

  private getSupportedFiles(folder: TFolder): TFile[] {
    const files: TFile[] = [];
    const walk = (current: TFolder) => {
      for (const child of current.children) {
        if (child instanceof TFile && this.isSupported(child) && child.stat.size <= MAX_FILE_BYTES) files.push(child);
        else if (child instanceof TFolder) walk(child);
      }
    };
    walk(folder);
    return files;
  }

  private isSupported(file: TFile): boolean {
    return TEXT_EXTENSIONS.has(file.extension.toLowerCase());
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.loadPromise) this.loadPromise = this.load();
    await this.loadPromise;
  }

  private async load(): Promise<void> {
    await this.ensureDirectory(HISTORY_ROOT);
    await this.ensureDirectory(BLOBS_PATH);
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(normalizePath(INDEX_PATH)))) return;
    try {
      const parsed = JSON.parse(await adapter.read(normalizePath(INDEX_PATH))) as SnapshotIndex;
      if (parsed?.version === 1 && parsed.projects) this.index = parsed;
    } catch (error) {
      console.warn("[ProjectSnapshotService] 快照索引损坏，使用空索引", error);
    }
  }

  private async saveIndex(): Promise<void> {
    const data = JSON.stringify(this.index, null, 2);
    this.saveQueue = this.saveQueue.then(() => this.app.vault.adapter.write(normalizePath(INDEX_PATH), data));
    await this.saveQueue;
  }

  private async writeBlob(hash: string, content: string): Promise<void> {
    const path = normalizePath(`${BLOBS_PATH}/${hash}.txt`);
    if (!(await this.app.vault.adapter.exists(path))) await this.app.vault.adapter.write(path, content);
  }

  private async readBlob(hash: string): Promise<string> {
    return this.app.vault.adapter.read(normalizePath(`${BLOBS_PATH}/${hash}.txt`));
  }

  private async ensureDirectory(path: string): Promise<void> {
    const normalized = normalizePath(path);
    if (!(await this.app.vault.adapter.exists(normalized))) await this.app.vault.adapter.mkdir(normalized);
  }

  private async ensureVaultParent(filePath: string): Promise<void> {
    const parts = filePath.split("/").slice(0, -1);
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current);
    }
  }

  private async hash(content: string): Promise<string> {
    if (globalThis.crypto?.subtle) {
      const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
      return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }
    let hash = 2166136261;
    for (let i = 0; i < content.length; i++) hash = Math.imul(hash ^ content.charCodeAt(i), 16777619);
    return `fnv-${(hash >>> 0).toString(16)}`;
  }

  private createId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private createSimpleDiff(before: string, after: string): Pick<SnapshotComparison, "added" | "removed" | "preview"> {
    const oldLines = before.split("\n");
    const newLines = after.split("\n");
    let start = 0;
    while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) start++;
    let oldEnd = oldLines.length - 1;
    let newEnd = newLines.length - 1;
    while (oldEnd >= start && newEnd >= start && oldLines[oldEnd] === newLines[newEnd]) { oldEnd--; newEnd--; }
    const removedLines = oldLines.slice(start, oldEnd + 1);
    const addedLines = newLines.slice(start, newEnd + 1);
    const preview: SnapshotComparison["preview"] = [];
    for (const line of oldLines.slice(Math.max(0, start - 3), start)) preview.push({ kind: "same", text: line });
    for (const line of removedLines.slice(0, 120)) preview.push({ kind: "removed", text: line });
    for (const line of addedLines.slice(0, 120)) preview.push({ kind: "added", text: line });
    for (const line of newLines.slice(newEnd + 1, newEnd + 4)) preview.push({ kind: "same", text: line });
    return { added: addedLines.length, removed: removedLines.length, preview };
  }
}
