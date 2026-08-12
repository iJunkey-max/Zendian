import { App, TFile, TFolder, normalizePath } from "obsidian";
import type { DataChangeEvent } from "./types";
import { isDeliverablePath } from "./DeliverablePathRegistry";
import { getPluginDataPath } from "../../utils/plugin-paths";

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
  editSessionId?: string;
  editSessionStartedAt?: number;
  editSessionEndedAt?: number;
  editSessionChangeCount?: number;
}

export interface ProjectCheckpoint {
  id: string;
  projectPath: string;
  name: string;
  createdAt: number;
  versions: Record<string, string>;
}

export interface CheckpointRestoreResult {
  checkpoint: ProjectCheckpoint;
  safetyCheckpoint: ProjectCheckpoint;
  restored: number;
  removed: number;
  failed: string[];
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

const MAX_FILE_BYTES = 1024 * 1024;
const MAX_AUTO_VERSIONS_PER_FILE = 30;
const TEXT_EXTENSIONS = new Set(["md", "canvas", "json", "home", "txt", "css", "js", "ts", "yaml", "yml"]);

function rebasePath(path: string, oldBase: string, newBase: string): string {
  if (path === oldBase) return newBase;
  return path.startsWith(`${oldBase}/`) ? `${newBase}${path.slice(oldBase.length)}` : path;
}

export class ProjectSnapshotService {
  private index: SnapshotIndex = { version: 1, projects: {} };
  private loadPromise: Promise<void> | null = null;
  private saveQueue: Promise<void> = Promise.resolve();
  private activeEditSessions = new Map<string, { id: string; projectPath: string; filePath: string; startedAt: number }>();
  private readonly historyRoot: string;
  private readonly indexPath: string;
  private readonly blobsPath: string;

  constructor(private app: App) {
    this.historyRoot = getPluginDataPath(app, "project-history");
    this.indexPath = normalizePath(`${this.historyRoot}/index.json`);
    this.blobsPath = normalizePath(`${this.historyRoot}/blobs`);
  }

  async initializeProject(projectPath: string): Promise<void> {
    await this.ensureLoaded();
    const folder = this.app.vault.getAbstractFileByPath(projectPath);
    if (!(folder instanceof TFolder)) return;

    for (const file of this.getSupportedFiles(folder)) {
      await this.captureFile(projectPath, file.path, "baseline", file.stat.mtime);
    }
  }

  async beginEditSession(projectPath: string, filePath: string, timestamp = Date.now()): Promise<string> {
    await this.ensureLoaded();
    const key = `${projectPath}::${filePath}`;
    const existing = this.activeEditSessions.get(key);
    if (existing) return existing.id;
    const session = { id: this.createId("e"), projectPath, filePath, startedAt: timestamp };
    this.activeEditSessions.set(key, session);
    return session.id;
  }

  async completeEditSession(sessionId: string, endedAt = Date.now()): Promise<void> {
    await this.ensureLoaded();
    let count = 0;
    for (const project of Object.values(this.index.projects)) {
      count += project.versions.filter((version) => version.editSessionId === sessionId).length;
    }
    if (count) {
      for (const project of Object.values(this.index.projects)) {
        for (const version of project.versions) {
          if (version.editSessionId !== sessionId) continue;
          version.editSessionEndedAt = endedAt;
          version.editSessionChangeCount = count;
        }
      }
      await this.saveIndex();
    }
    for (const [key, session] of this.activeEditSessions) {
      if (session.id === sessionId) this.activeEditSessions.delete(key);
    }
  }

  async captureEvent(event: DataChangeEvent, editSessionId?: string): Promise<SnapshotVersion | null> {
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
      false,
      editSessionId ? this.getEditSession(editSessionId) : undefined,
    );
  }

  async captureFile(
    projectPath: string,
    filePath: string,
    action: SnapshotAction = "modified",
    timestamp = Date.now(),
    force = false,
    editSession?: { id: string; startedAt: number },
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
      editSessionId: editSession?.id,
      editSessionStartedAt: editSession?.startedAt,
    };
    project.versions.push(version);
    this.pruneFileVersions(project, filePath);
    await this.saveIndex();
    return version;
  }

  private getEditSession(sessionId: string): { id: string; startedAt: number } | undefined {
    for (const session of this.activeEditSessions.values()) {
      if (session.id === sessionId) return { id: session.id, startedAt: session.startedAt };
    }
    return undefined;
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

  async getCheckpoint(checkpointId: string): Promise<ProjectCheckpoint | null> {
    await this.ensureLoaded();
    return this.findCheckpoint(checkpointId)?.checkpoint ?? null;
  }

  async restoreCheckpoint(checkpointId: string): Promise<CheckpointRestoreResult | null> {
    await this.ensureLoaded();
    const match = this.findCheckpoint(checkpointId);
    if (!match) return null;

    const { checkpoint } = match;
    const folder = this.app.vault.getAbstractFileByPath(checkpoint.projectPath);
    if (!(folder instanceof TFolder)) return null;

    const safetyCheckpoint = await this.createCheckpoint(
      checkpoint.projectPath,
      `恢复前备份 · ${checkpoint.name}`,
    );
    const targetPaths = new Set(Object.keys(checkpoint.versions));
    const failed: string[] = [];
    let restored = 0;
    let removed = 0;

    for (const [filePath, versionId] of Object.entries(checkpoint.versions)) {
      try {
        if (await this.restoreVersion(versionId)) restored++;
        else failed.push(filePath);
      } catch (error) {
        console.error(`[ProjectSnapshotService] 恢复检查点文件失败: ${filePath}`, error);
        failed.push(filePath);
      }
    }

    const currentFolder = this.app.vault.getAbstractFileByPath(checkpoint.projectPath);
    if (currentFolder instanceof TFolder) {
      const extraFiles = this.getSupportedFiles(currentFolder)
        .filter((file) => !targetPaths.has(file.path));
      for (const file of extraFiles) {
        try {
          await this.captureFile(checkpoint.projectPath, file.path, "safety", Date.now(), true);
          await this.app.vault.trash(file, false);
          removed++;
        } catch (error) {
          console.error(`[ProjectSnapshotService] 移除检查点后新增文件失败: ${file.path}`, error);
          failed.push(file.path);
        }
      }
    }

    return { checkpoint, safetyCheckpoint, restored, removed, failed };
  }

  async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    await this.ensureLoaded();
    const match = this.findCheckpoint(checkpointId);
    if (!match) return false;
    match.project.checkpoints = match.project.checkpoints
      .filter((checkpoint) => checkpoint.id !== checkpointId);
    await this.saveIndex();
    return true;
  }

  async getTrackedProjectPaths(): Promise<string[]> {
    await this.ensureLoaded();
    return Object.keys(this.index.projects);
  }

  async rebaseProjectPath(oldProjectPath: string, newProjectPath: string): Promise<void> {
    await this.ensureLoaded();
    const oldPath = normalizePath(oldProjectPath);
    const newPath = normalizePath(newProjectPath);
    if (!oldPath || !newPath || oldPath === newPath) return;

    const source = this.index.projects[oldPath];
    if (source) {
      const target = this.index.projects[newPath] ?? { path: newPath, versions: [], checkpoints: [] };
      target.path = newPath;
      target.versions = [...target.versions, ...source.versions].map((version) => ({
        ...version,
        projectPath: newPath,
        filePath: rebasePath(version.filePath, oldPath, newPath),
      }));
      target.checkpoints = [...target.checkpoints, ...source.checkpoints].map((checkpoint) => ({
        ...checkpoint,
        projectPath: newPath,
        versions: Object.fromEntries(
          Object.entries(checkpoint.versions).map(([filePath, versionId]) => [
            rebasePath(filePath, oldPath, newPath),
            versionId,
          ]),
        ),
      }));
      this.index.projects[newPath] = target;
      delete this.index.projects[oldPath];
    }

    const sessions = Array.from(this.activeEditSessions.values());
    this.activeEditSessions.clear();
    for (const session of sessions) {
      const rebased = session.projectPath === oldPath
        ? {
            ...session,
            projectPath: newPath,
            filePath: rebasePath(session.filePath, oldPath, newPath),
          }
        : session;
      this.activeEditSessions.set(`${rebased.projectPath}::${rebased.filePath}`, rebased);
    }

    if (source) await this.saveIndex();
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

  private findCheckpoint(checkpointId: string): {
    project: SnapshotProjectIndex;
    checkpoint: ProjectCheckpoint;
  } | undefined {
    for (const project of Object.values(this.index.projects)) {
      const checkpoint = project.checkpoints.find((item) => item.id === checkpointId);
      if (checkpoint) return { project, checkpoint };
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
        if (isDeliverablePath(folder.path, child.path)) continue;
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
    await this.ensureDirectory(this.historyRoot);
    await this.ensureDirectory(this.blobsPath);
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(this.indexPath))) return;
    try {
      const parsed = JSON.parse(await adapter.read(this.indexPath)) as SnapshotIndex;
      if (parsed?.version === 1 && parsed.projects) this.index = parsed;
    } catch (error) {
      console.warn("[ProjectSnapshotService] 快照索引损坏，使用空索引", error);
      try {
        const backupPath = normalizePath(`${this.historyRoot}/index.corrupt-${Date.now()}.json`);
        await adapter.copy(this.indexPath, backupPath);
        console.warn(`[ProjectSnapshotService] 已备份损坏索引到 ${backupPath}`);
      } catch (backupError) {
        console.error("[ProjectSnapshotService] 备份损坏索引失败", backupError);
      }
    }
  }

  private async saveIndex(): Promise<void> {
    const data = JSON.stringify(this.index, null, 2);
    const write = this.saveQueue
      .catch(() => undefined)
      .then(() => this.app.vault.adapter.write(this.indexPath, data));
    this.saveQueue = write.catch(() => undefined);
    await write;
  }

  private async writeBlob(hash: string, content: string): Promise<void> {
    const path = normalizePath(`${this.blobsPath}/${hash}.txt`);
    if (!(await this.app.vault.adapter.exists(path))) await this.app.vault.adapter.write(path, content);
  }

  private async readBlob(hash: string): Promise<string> {
    return this.app.vault.adapter.read(normalizePath(`${this.blobsPath}/${hash}.txt`));
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
