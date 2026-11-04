import { App, TFile, TFolder, normalizePath } from "obsidian";
import type { DataChangeEvent } from "./types";
import { isDeliverablePath } from "./DeliverablePathRegistry";
import { getPluginDataPath } from "../../utils/plugin-paths";
import { restoreProjectContent } from "./project-restore";
import type { ProjectBusinessEvent } from "./project-events";
import { loadProjectHome } from "./ProjectHomeStore";

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
  /**
   * The version was discovered during a later startup/deep scan rather than
   * captured from an Obsidian vault event. Its timestamp is therefore a best
   * available file mtime or scan time, not an exact user action time.
   */
  approximateTime?: boolean;
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
  businessEvents?: ProjectBusinessEvent[];
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
  private index: SnapshotIndex = { version: 1, projects: Object.create(null) };
  private loadPromise: Promise<void> | null = null;
  private saveQueue: Promise<void> = Promise.resolve();
  private persistedText: string | null = null;
  private persistenceError: Error | null = null;
  private activeEditSessions = new Map<string, { id: string; projectPath: string; filePath: string; startedAt: number }>();
  private readonly historyRoot: string;
  private readonly indexPath: string;
  private readonly blobsPath: string;

  constructor(private app: App) {
    this.historyRoot = getPluginDataPath(app, "project-history");
    this.indexPath = normalizePath(`${this.historyRoot}/index.json`);
    this.blobsPath = normalizePath(`${this.historyRoot}/blobs`);
  }

  async initializeProject(projectPath: string): Promise<boolean> {
    await this.ensureLoaded();
    // The registry may have observed a valid project just before an external
    // move/delete or a conflicting second .home file appeared. Do not start a
    // watcher or absorb folder contents unless the metadata can still be read
    // unambiguously at the moment snapshots are initialized.
    const home = await loadProjectHome(this.app, projectPath);
    if (!home) return false;
    const folder = this.app.vault.getAbstractFileByPath(projectPath);
    if (!(folder instanceof TFolder)) return false;

    const files = this.getSupportedFiles(folder);
    const currentPaths = new Set(files.map((file) => file.path));
    const project = this.getProject(projectPath);
    const hadHistory = project.versions.length > 0;

    // A project may be edited while Obsidian is closed. Treat the first
    // observation as a baseline, but subsequent observations as created or
    // modified versions so those offline changes appear in the timeline.
    for (const file of files) {
      const latest = this.getLatestVersion(projectPath, file.path);
      const action: SnapshotAction = !latest
        ? (hadHistory ? "created" : "baseline")
        : latest.action === "deleted" ? "created" : "modified";
      const timestamp = Number.isFinite(file.stat.mtime) && file.stat.mtime > 0 ? file.stat.mtime : Date.now();
      await this.captureFile(projectPath, file.path, action, timestamp, false, undefined, hadHistory);
    }

    // A deletion made while the vault was closed has no vault event to feed
    // recordDeletion. Reconcile the last known live paths against the current
    // folder and record a single approximate deletion at startup instead of
    // silently losing the version from the project timeline.
    const knownPaths = new Set(
      project.versions
        .filter((version) => version.action !== "deleted")
        .map((version) => version.filePath),
    );
    for (const filePath of knownPaths) {
      if (!filePath.startsWith(`${projectPath}/`) || currentPaths.has(filePath)) continue;
      await this.recordDeletion(projectPath, filePath, Date.now(), true);
    }
    return true;
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
    approximateTime = false,
  ): Promise<SnapshotVersion | null> {
    await this.ensureLoaded();
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile) || !this.isSupported(file) || file.stat.size > MAX_FILE_BYTES) return null;
    if (!file.path.startsWith(`${projectPath}/`)) return null;

    const observedPath = file.path, observedSize = file.stat.size, observedMtime = file.stat.mtime;
    const content = await this.app.vault.read(file);
    const hash = await this.hash(content);
    if (file.path !== observedPath || file.stat.size !== observedSize || file.stat.mtime !== observedMtime || this.app.vault.getAbstractFileByPath(observedPath) !== file) throw new Error("快照读取期间文件发生变化，未记录不确定版本，请重试");
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
      approximateTime: approximateTime || undefined,
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

  async createCheckpoint(projectPath: string, name: string, options: { safety?: boolean } = {}): Promise<ProjectCheckpoint> {
    if (!(this.app.vault.getAbstractFileByPath(projectPath) instanceof TFolder)) throw new Error("项目目录不存在，无法创建检查点");
    if (!await this.initializeProject(projectPath)) throw new Error("项目主页不存在或存在冲突，无法创建检查点");
    const project = this.getProject(projectPath);
    const checkpointId = this.createId("c");
    const versions: Record<string, string> = {};

    const folder = this.app.vault.getAbstractFileByPath(projectPath);
    if (!(folder instanceof TFolder)) throw new Error("项目目录已变化，无法创建检查点");
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
    if (!options.safety) this.recordCheckpointEvent(projectPath, "checkpoint-created", checkpoint, `包含 ${Object.keys(versions).length} 个文件版本`);
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

  async getBusinessEvents(projectPath: string): Promise<ProjectBusinessEvent[]> {
    await this.ensureLoaded();
    return structuredClone(this.getProject(projectPath).businessEvents || []);
  }

  private recordCheckpointEvent(projectPath: string, kind: "checkpoint-created" | "checkpoint-removed" | "checkpoint-restored", checkpoint: ProjectCheckpoint, description: string): void {
    const project = this.getProject(projectPath);
    project.businessEvents = [...(project.businessEvents || []), { id: globalThis.crypto.randomUUID(), kind,
      name: checkpoint.name, path: "", checkpointId: checkpoint.id, timestamp: new Date().toISOString(), description }];
  }

  async getCheckpoint(checkpointId: string): Promise<ProjectCheckpoint | null> {
    await this.ensureLoaded();
    return this.findCheckpoint(checkpointId)?.checkpoint ?? null;
  }

  async previewCheckpoint(checkpointId: string): Promise<{ overwrite: string[]; create: string[]; preserve: string[] } | null> {
    await this.ensureLoaded();
    const match = this.findCheckpoint(checkpointId);
    if (!match) return null;
    const checkpoint = match.checkpoint;
    const folder = this.app.vault.getAbstractFileByPath(checkpoint.projectPath);
    if (!(folder instanceof TFolder)) return null;
    const paths = Object.keys(checkpoint.versions);
    // Reject malformed or stale paths before any restore write.
    if (paths.some(path => !path.startsWith(checkpoint.projectPath + "/") || path.split("/").some(part => part === ".." || part === "."))) throw new Error("检查点包含无效路径，已停止恢复");
    return {
      overwrite: paths.filter(path => this.app.vault.getAbstractFileByPath(path) instanceof TFile),
      create: paths.filter(path => !this.app.vault.getAbstractFileByPath(path)),
      preserve: this.getSupportedFiles(folder).filter(file => !paths.includes(file.path)).map(file => file.path),
    };
  }

  async exportProjectHistory(projectPath: string): Promise<{ project: SnapshotProjectIndex; blobs: Map<string, string> } | null> {
    await this.ensureLoaded();
    await this.saveQueue;
    if (this.persistenceError) throw this.persistenceError;
    const baseline = this.persistedText;
    const source = this.index.projects[projectPath];
    if (!source) return null;
    const project = structuredClone(source);
    this.validateIndex({ version: 1, projects: { [projectPath]: project } });
    const blobs = new Map<string, string>();
    for (const version of project.versions) {
      if (!blobs.has(version.hash)) blobs.set(version.hash, await this.readBlob(version.hash));
    }
    const adapter = this.app.vault.adapter;
    const latest = await adapter.exists(this.indexPath) ? await adapter.read(this.indexPath) : null;
    if (latest !== baseline || this.persistedText !== baseline) throw new Error("导出期间历史索引发生变化，请重试");
    return { project, blobs };
  }

  async importProjectHistory(source: unknown, oldPath: string, newPath: string, blobs: Map<string, string>): Promise<() => Promise<void>> {
    await this.ensureLoaded();
    if (this.index.projects[newPath]) throw new Error("目标已有历史，未覆盖");
    const imported = await this.prepareProjectHistoryImport(source, oldPath, newPath, blobs);
    const previous = structuredClone(this.index);
    try {
      for (const [hash, content] of blobs) await this.writeBlob(hash, content);
      this.index.projects[newPath] = imported;
      await this.saveIndex();
    } catch (error) {
      this.index = previous;
      throw error;
    }
    const committedText = this.persistedText;
    const committedProject = structuredClone(this.index.projects[newPath]);
    let rolledBack = false;
    return async () => {
      if (rolledBack) return;
      await this.ensureLoaded();
      const current = this.index.projects[newPath];
      if (this.persistedText !== committedText || JSON.stringify(current) !== JSON.stringify(committedProject)) {
        throw new Error("导入历史已被其他操作修改，无法自动回滚");
      }
      const currentIndex = this.index;
      const currentPersisted = this.persistedText;
      delete this.index.projects[newPath];
      try {
        await this.saveIndex();
        rolledBack = true;
      } catch (error) {
        this.index = currentIndex;
        this.persistedText = currentPersisted;
        throw error;
      }
    };
  }

  async validateProjectHistoryImport(source: unknown, oldPath: string, newPath: string, blobs: Map<string, string>): Promise<void> {
    await this.ensureLoaded();
    if (this.index.projects[newPath]) throw new Error("目标已有历史，未覆盖");
    await this.prepareProjectHistoryImport(source, oldPath, newPath, blobs);
  }

  private async prepareProjectHistoryImport(source: unknown, oldPath: string, newPath: string, blobs: Map<string, string>): Promise<SnapshotProjectIndex> {
    const project = source as SnapshotProjectIndex;
    if (!project || !Array.isArray(project.versions) || !Array.isArray(project.checkpoints)) throw new Error("历史格式无效");
    const safePath = (path: string) => typeof path === "string" && path.startsWith(oldPath + "/") && !path.split("/").some(part => part === "." || part === "..");
    const ids = new Map<string, string>();
    for (const version of project.versions) {
      const content = blobs.get(version.hash);
      if (!safePath(version.filePath) || content === undefined || await this.hash(content, version.hash) !== version.hash) throw new Error("历史路径或内容指纹校验失败");
      if (ids.has(version.id)) throw new Error("历史版本身份重复");
      ids.set(version.id, this.createId("v"));
    }
    const checkpointIds = new Map(project.checkpoints.map(checkpoint => [checkpoint.id, this.createId("c")]));
    if (checkpointIds.size !== project.checkpoints.length) throw new Error("检查点身份重复");
    const versions = project.versions.map(version => ({ ...version, id: ids.get(version.id)!, checkpointId: version.checkpointId ? checkpointIds.get(version.checkpointId) : undefined, projectPath: newPath, filePath: rebasePath(version.filePath, oldPath, newPath) }));
    const checkpoints = project.checkpoints.map(checkpoint => ({ ...checkpoint, id: checkpointIds.get(checkpoint.id)!, projectPath: newPath, versions: Object.fromEntries(Object.entries(checkpoint.versions).map(([path, id]) => {
      if (!safePath(path) || !ids.has(id)) throw new Error("检查点引用无效");
      return [rebasePath(path, oldPath, newPath), ids.get(id)!];
    })) }));
    for (const [hash, content] of blobs) {
      if (!/^(?:[a-f0-9]+|fnv-[a-f0-9]+)$/i.test(hash) || await this.hash(content, hash) !== hash) throw new Error("历史内容指纹无效");
    }
    // Creation/removal events may legitimately refer to a checkpoint that was
    // already deleted before export; preserve those historical pairs under a
    // remapped ID. A restore event, however, must point at an imported
    // checkpoint that can actually be opened/restored.
    for (const event of project.businessEvents || []) {
      if (!event.checkpointId || checkpointIds.has(event.checkpointId)) continue;
      if (event.kind === "checkpoint-created" || event.kind === "checkpoint-removed") {
        checkpointIds.set(event.checkpointId, this.createId("c"));
      } else {
        throw new Error("历史业务事件引用了不存在的检查点");
      }
    }
    const businessEvents = (project.businessEvents || []).map(event => ({ ...event, id: globalThis.crypto.randomUUID(), checkpointId: event.checkpointId ? checkpointIds.get(event.checkpointId) : undefined }));
    const imported = { path: newPath, versions, checkpoints, businessEvents };
    this.validateIndex({ version: 1, projects: { [newPath]: imported } });
    return imported;
  }

  async restoreCheckpoint(checkpointId: string, options: { removeNewFiles?: boolean } = {}): Promise<CheckpointRestoreResult | null> {
    if (!await this.previewCheckpoint(checkpointId)) return null;
    await this.ensureLoaded();
    const match = this.findCheckpoint(checkpointId);
    if (!match) return null;

    const { checkpoint } = match;
    const folder = this.app.vault.getAbstractFileByPath(checkpoint.projectPath);
    if (!(folder instanceof TFolder)) return null;

    // Validate every reference and blob before changing any project file.
    for (const [filePath, versionId] of Object.entries(checkpoint.versions)) {
      const version = this.findVersion(versionId);
      if (!version || version.filePath !== filePath || version.projectPath !== checkpoint.projectPath) throw new Error("检查点版本引用不一致，已停止恢复");
      const content = await this.readBlob(version.hash);
      if (await this.hash(content, version.hash) !== version.hash) throw new Error("检查点历史内容校验失败，已停止恢复");
    }

    const safetyCheckpoint = await this.createCheckpoint(
      checkpoint.projectPath,
      `恢复前备份 · ${checkpoint.name}`,
      { safety: true },
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
    if (options.removeNewFiles && failed.length === 0 && currentFolder instanceof TFolder) {
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

    this.recordCheckpointEvent(checkpoint.projectPath, "checkpoint-restored", checkpoint, `恢复 ${restored} 个文件，移除 ${removed} 个新增文件，失败 ${failed.length} 个；${options.removeNewFiles ? "请求移除新增文件" : "保留新增文件"}`);
    await this.saveIndex();
    return { checkpoint, safetyCheckpoint, restored, removed, failed };
  }

  async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    await this.ensureLoaded();
    const match = this.findCheckpoint(checkpointId);
    if (!match) return false;
    match.project.checkpoints = match.project.checkpoints
      .filter((checkpoint) => checkpoint.id !== checkpointId);
    this.recordCheckpointEvent(match.checkpoint.projectPath, "checkpoint-removed", match.checkpoint, "移除检查点记录；不删除项目工作文件");
    await this.saveIndex();
    return true;
  }

  async getTrackedProjectPaths(): Promise<string[]> {
    await this.ensureLoaded();
    return Object.keys(this.index.projects);
  }

  async rebaseProjectPath(oldProjectPath: string, newProjectPath: string): Promise<() => Promise<void>> {
    await this.ensureLoaded();
    const oldPath = normalizePath(oldProjectPath);
    const newPath = normalizePath(newProjectPath);
    if (!oldPath || !newPath || oldPath === newPath) return async () => undefined;

    const source = this.index.projects[oldPath];
    const previousIndex = structuredClone(this.index);
    const previousSessions = new Map(Array.from(this.activeEditSessions.entries(), ([key, session]) => [key, { ...session }]));
    if (this.index.projects[newPath]) throw new Error("目标路径已有历史，已停止迁移以避免不同项目历史混合");
    // A project may be moved before its first file snapshot exists. Still
    // create a small durable history record so the timeline can explain the
    // offline move on the next startup without inventing an exact timestamp.
    const target: SnapshotProjectIndex = { path: newPath, versions: [], checkpoints: [] };
    if (source) {
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
    }
    target.businessEvents = [
      ...(source?.businessEvents || []),
      {
        id: globalThis.crypto.randomUUID(),
        kind: "project-moved",
        name: "项目目录移动",
        path: "",
        from: oldPath,
        to: newPath,
        timestamp: new Date().toISOString(),
        approximateTime: true,
        description: "由项目位置核对发现；实际移动时间未知。",
      },
    ];
    this.index.projects[newPath] = target;
    if (source) delete this.index.projects[oldPath];

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

    try {
      await this.saveIndex();
    } catch (error) {
      this.index = previousIndex;
      this.activeEditSessions = previousSessions;
      throw error;
    }

    const committedText = this.persistedText;
    const committedIndex = structuredClone(this.index);
    const committedSessions = new Map(Array.from(this.activeEditSessions.entries(), ([key, session]) => [key, { ...session }]));
    let rolledBack = false;
    return async () => {
      if (rolledBack) return;
      rolledBack = true;
      const currentSessions = new Map(Array.from(this.activeEditSessions.entries(), ([key, session]) => [key, { ...session }]));
      if (this.persistedText !== committedText || JSON.stringify(this.index) !== JSON.stringify(committedIndex) || JSON.stringify([...currentSessions]) !== JSON.stringify([...committedSessions])) {
        throw new Error("项目历史已被其他操作修改，无法自动回滚目录迁移；请重新扫描后核对");
      }
      const currentIndex = this.index;
      const currentPersisted = this.persistedText;
      const currentActive = this.activeEditSessions;
      this.index = previousIndex;
      this.activeEditSessions = previousSessions;
      try {
        await this.saveIndex();
      } catch (error) {
        this.index = currentIndex;
        this.persistedText = currentPersisted;
        this.activeEditSessions = currentActive;
        throw error;
      }
    };
  }

  /** Move one tracked file's history after the user confirms an offline rename. */
  async rebaseFilePath(projectPath: string, oldFilePath: string, newFilePath: string): Promise<() => Promise<void>> {
    await this.ensureLoaded();
    const project = this.index.projects[normalizePath(projectPath)];
    const oldPath = normalizePath(oldFilePath);
    const newPath = normalizePath(newFilePath);
    const base = normalizePath(projectPath);
    if (!project || !oldPath || !newPath || oldPath === newPath) return async () => undefined;
    if (!oldPath.startsWith(`${base}/`) || !newPath.startsWith(`${base}/`)) throw new Error("改名文件必须位于当前项目目录内");

    const sourceVersions = project.versions.filter(version => version.filePath === oldPath);
    const targetVersions = project.versions.filter(version => version.filePath === newPath);
    if (!sourceVersions.length) return async () => undefined;
    const previousIndex = structuredClone(this.index);
    const previousSessions = new Map(Array.from(this.activeEditSessions.entries(), ([key, session]) => [key, { ...session }]));

    // Obsidian may observe the renamed file during startup before the user
    // confirms the rename. In that case the watcher creates a duplicate
    // `created` version at the new path. Merge only exact content duplicates;
    // any unrelated target history remains an explicit conflict.
    const sourceByHash = new Map<string, SnapshotVersion>();
    for (const version of sourceVersions) {
      const previous = sourceByHash.get(version.hash);
      if (!previous || version.timestamp >= previous.timestamp) sourceByHash.set(version.hash, version);
    }
    const duplicateTargetIds = new Set<string>();
    const targetToSource = new Map<string, SnapshotVersion>();
    for (const target of targetVersions) {
      const source = sourceByHash.get(target.hash);
      if (!source) throw new Error("新文件名已有不一致历史，未自动合并；请先在历史页处理冲突");
      duplicateTargetIds.add(target.id);
      targetToSource.set(target.id, source);
    }

    // Checkpoint references are the only durable references to a version id.
    // Remap duplicate target references to their canonical source version and
    // reject a checkpoint that tries to combine two different contents.
    for (const checkpoint of project.checkpoints) {
      const targetId = checkpoint.versions[newPath];
      const oldId = checkpoint.versions[oldPath];
      if (targetId) {
        const target = targetVersions.find(version => version.id === targetId);
        const source = target ? targetToSource.get(target.id) : undefined;
        if (!source) throw new Error("检查点已包含不一致的新文件名，未自动合并历史");
        if (oldId) {
          const old = sourceVersions.find(version => version.id === oldId);
          if (!old || old.hash !== source.hash) throw new Error("检查点同时包含不一致的旧、新文件历史，未自动合并");
        }
        checkpoint.versions[newPath] = source.id;
      }
    }

    if (duplicateTargetIds.size) project.versions = project.versions.filter(version => !duplicateTargetIds.has(version.id));

    for (const version of sourceVersions) version.filePath = newPath;
    for (const checkpoint of project.checkpoints) {
      if (!Object.prototype.hasOwnProperty.call(checkpoint.versions, oldPath)) continue;
      checkpoint.versions[newPath] = checkpoint.versions[oldPath];
      delete checkpoint.versions[oldPath];
    }
    const sessions = Array.from(this.activeEditSessions.values());
    this.activeEditSessions.clear();
    for (const session of sessions) {
      const rebased = session.projectPath === base && session.filePath === oldPath
        ? { ...session, filePath: newPath }
        : session;
      this.activeEditSessions.set(`${rebased.projectPath}::${rebased.filePath}`, rebased);
    }
    try {
      await this.saveIndex();
    } catch (error) {
      this.index = previousIndex;
      this.activeEditSessions = previousSessions;
      throw error;
    }

    const committedText = this.persistedText;
    const committedProject = structuredClone(this.index.projects[base]);
    const committedSessions = new Map(Array.from(this.activeEditSessions.entries(), ([key, session]) => [key, { ...session }]));
    let rolledBack = false;
    return async () => {
      if (rolledBack) return;
      rolledBack = true;
      const currentProject = this.index.projects[base];
      const currentSessions = new Map(Array.from(this.activeEditSessions.entries(), ([key, session]) => [key, { ...session }]));
      if (this.persistedText !== committedText || JSON.stringify(currentProject) !== JSON.stringify(committedProject) || JSON.stringify([...currentSessions]) !== JSON.stringify([...committedSessions])) {
        throw new Error("文件历史已被其他操作修改，无法自动回滚；请重新扫描后核对");
      }
      const currentIndex = this.index;
      const currentPersisted = this.persistedText;
      const currentActive = this.activeEditSessions;
      this.index = previousIndex;
      this.activeEditSessions = previousSessions;
      try {
        await this.saveIndex();
      } catch (error) {
        this.index = currentIndex;
        this.persistedText = currentPersisted;
        this.activeEditSessions = currentActive;
        throw error;
      }
    };
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
    if (!version.filePath.startsWith(version.projectPath + "/") || version.filePath.split("/").some(part => part === "." || part === "..")) throw new Error("版本路径无效，已停止恢复");

    const current = this.app.vault.getAbstractFileByPath(version.filePath);
    const before = current instanceof TFile ? await this.app.vault.read(current) : null;
    if (current instanceof TFile) {
      const backup = await this.captureFile(version.projectPath, version.filePath, "safety", Date.now(), true);
      if (!backup) throw new Error("当前文件无法完整备份，已停止恢复");
    }

    const content = await this.readBlob(version.hash);
    if (await this.hash(content, version.hash) !== version.hash) throw new Error("历史内容校验失败，已停止恢复");
    const existing = this.app.vault.getAbstractFileByPath(version.filePath);
    if (existing !== current) throw new Error("恢复期间文件位置已变化，请刷新后重试");
    const isHome = version.filePath.endsWith(".home");
    if (isHome && !(existing instanceof TFile)) throw new Error("项目主页缺失，请先恢复项目身份再恢复检查点");
    if (existing instanceof TFile) {
      const availablePaths = isHome ? this.getCurrentRelativePaths(version.projectPath) : undefined;
      await this.app.vault.process(existing, latest => {
        if (latest !== before || existing.path !== version.filePath) throw new Error("恢复期间文件已被修改，未覆盖新内容，请刷新后重试");
        return isHome ? restoreProjectContent(content, latest, { availablePaths }) : content;
      });
    } else {
      await this.ensureVaultParent(version.filePath);
      await this.app.vault.create(version.filePath, content);
    }

    await this.captureFile(version.projectPath, version.filePath, "restored", Date.now(), true);
    return true;
  }

  private async recordDeletion(projectPath: string, filePath: string, timestamp: number, approximateTime = false): Promise<SnapshotVersion | null> {
    await this.ensureLoaded();
    const latest = this.getLatestVersion(projectPath, filePath);
    if (!latest || latest.action === "deleted") return latest ?? null;
    const version: SnapshotVersion = {
      ...latest,
      id: this.createId("v"),
      timestamp,
      action: "deleted",
      approximateTime: approximateTime || undefined,
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
        if (isDeliverablePath(this.app, folder.path, child.path)) continue;
        if (child instanceof TFile && this.isSupported(child) && child.stat.size <= MAX_FILE_BYTES) files.push(child);
        else if (child instanceof TFolder) walk(child);
      }
    };
    walk(folder);
    return files;
  }

  private getCurrentRelativePaths(projectPath: string): Set<string> {
    const folder = this.app.vault.getAbstractFileByPath(projectPath);
    const paths = new Set<string>();
    if (!(folder instanceof TFolder)) return paths;
    const walk = (current: TFolder) => {
      for (const child of current.children) {
        if (child instanceof TFile) paths.add(child.path.slice(`${projectPath}/`.length));
        else if (child instanceof TFolder) walk(child);
      }
    };
    walk(folder);
    return paths;
  }

  private isSupported(file: TFile): boolean {
    return TEXT_EXTENSIONS.has(file.extension.toLowerCase());
  }

  private async ensureLoaded(): Promise<void> {
    if (this.persistenceError) throw this.persistenceError;
    if (!this.loadPromise) this.loadPromise = this.load();
    await this.loadPromise;
    if (this.persistenceError) throw this.persistenceError;
  }

  private async load(): Promise<void> {
    await this.ensureDirectory(this.historyRoot);
    await this.ensureDirectory(this.blobsPath);
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(this.indexPath))) return;
    try {
      const text = await adapter.read(this.indexPath);
      const parsed = JSON.parse(text) as SnapshotIndex;
      this.validateIndex(parsed);
      parsed.projects = Object.assign(Object.create(null), parsed.projects);
      this.index = parsed;
      this.persistedText = text;
    } catch (error) {
      console.error("[ProjectSnapshotService] 历史索引无法读取，停止历史操作并保留原索引", error);
      try {
        const backupPath = normalizePath(`${this.historyRoot}/index.corrupt-${Date.now()}.json`);
        await adapter.copy(this.indexPath, backupPath);
        console.warn(`[ProjectSnapshotService] 已备份损坏索引到 ${backupPath}`);
      } catch (backupError) {
        console.error("[ProjectSnapshotService] 备份损坏索引失败", backupError);
      }
      throw new Error("历史索引损坏或版本不兼容，已停止历史写入；请修复索引后重新加载插件");
    }
  }

  private validateIndex(index: SnapshotIndex): void {
    const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
    const safePath = (value: unknown): value is string => typeof value === "string" && !!value && !/[\\:\x00-\x1f]/.test(value) && value.split("/").every(part => !!part && part !== "." && part !== "..");
    if (!record(index) || index.version !== 1 || !record(index.projects)) throw new Error("历史索引格式无效");
    const allIds = new Set<string>();
    for (const [path, project] of Object.entries(index.projects)) {
      if (!safePath(path) || !record(project) || project.path !== path || !Array.isArray(project.versions) || !Array.isArray(project.checkpoints)) throw new Error("历史项目结构无效");
      const versions = new Map<string, SnapshotVersion>();
      const isValidBusinessEvent = (event: unknown): boolean => {
        if (!record(event) || typeof event.id !== "string" || !event.id || typeof event.name !== "string" || event.path !== "" || typeof event.timestamp !== "string" || !Number.isFinite(Date.parse(event.timestamp))) return false;
        if (["checkpoint-created", "checkpoint-removed", "checkpoint-restored"].includes(String(event.kind))) return typeof event.checkpointId === "string" && !!event.checkpointId;
        return event.kind === "project-moved" && safePath(event.from) && safePath(event.to) && event.approximateTime === true;
      };
      if (project.businessEvents !== undefined && (!Array.isArray(project.businessEvents) || !project.businessEvents.every(isValidBusinessEvent))) throw new Error("检查点业务历史无效");
      for (const version of project.versions) {
        if (!record(version) || typeof version.id !== "string" || !version.id || allIds.has(version.id) || version.projectPath !== path || !safePath(version.filePath) || !version.filePath.startsWith(path + "/") || typeof version.hash !== "string" || !/^(?:[a-f0-9]+|fnv-[a-f0-9]+)$/i.test(version.hash) || !Number.isFinite(version.timestamp) || !Number.isFinite(version.size) || version.size < 0 || !["baseline", "created", "modified", "deleted", "checkpoint", "safety", "restored"].includes(version.action) || (version.approximateTime !== undefined && typeof version.approximateTime !== "boolean")) throw new Error("历史版本结构无效");
        allIds.add(version.id);
        versions.set(version.id, version);
      }
      for (const checkpoint of project.checkpoints) {
        if (!record(checkpoint) || typeof checkpoint.id !== "string" || !checkpoint.id || allIds.has(checkpoint.id) || checkpoint.projectPath !== path || typeof checkpoint.name !== "string" || !Number.isFinite(checkpoint.createdAt) || !record(checkpoint.versions)) throw new Error("检查点结构无效");
        allIds.add(checkpoint.id);
        for (const [file, id] of Object.entries(checkpoint.versions)) {
          if (typeof id !== "string" || versions.get(id)?.filePath !== file) throw new Error("检查点引用不存在或路径不一致");
        }
      }
      const checkpointIds = new Set(project.checkpoints.map(checkpoint => checkpoint.id));
      if (project.businessEvents?.some(event => event.kind === "checkpoint-restored" && (!event.checkpointId || !checkpointIds.has(event.checkpointId)))) {
        throw new Error("恢复事件引用不存在的检查点");
      }
    }
  }

  private async saveIndex(): Promise<void> {
    const data = JSON.stringify(this.index, null, 2);
    const write = this.saveQueue
      .catch(() => undefined)
      .then(async () => {
        if (this.persistenceError) throw this.persistenceError;
        try {
          const adapter = this.app.vault.adapter;
          const latest = await adapter.exists(this.indexPath) ? await adapter.read(this.indexPath) : null;
          if (latest !== this.persistedText) throw new Error("历史索引已被外部修改，未覆盖；请等待同步完成后重新加载插件");
          await adapter.write(this.indexPath, data);
          this.persistedText = data;
        } catch (error) {
          this.persistenceError = new Error(`${error instanceof Error ? error.message : String(error)}；历史操作已停止，请检查存储和同步状态后重新加载插件`);
          throw this.persistenceError;
        }
      });
    this.saveQueue = write.catch(() => undefined);
    await write;
  }

  private async writeBlob(hash: string, content: string): Promise<void> {
    if (!/^(?:[a-f0-9]+|fnv-[a-f0-9]+)$/i.test(hash)) throw new Error("历史内容指纹无效");
    const path = normalizePath(`${this.blobsPath}/${hash}.txt`);
    if (await this.app.vault.adapter.exists(path)) {
      if (await this.app.vault.adapter.read(path) !== content) throw new Error("已有历史内容与指纹对应内容不同，未覆盖；请检查历史备份");
    } else await this.app.vault.adapter.write(path, content);
  }

  private async readBlob(hash: string): Promise<string> {
    if (!/^(?:[a-f0-9]+|fnv-[a-f0-9]+)$/i.test(hash)) throw new Error("历史内容指纹无效");
    const content = await this.app.vault.adapter.read(normalizePath(`${this.blobsPath}/${hash}.txt`));
    if (await this.hash(content, hash) !== hash) throw new Error("历史内容校验失败，原数据已保留");
    return content;
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

  private async hash(content: string, expectedHash?: string): Promise<string> {
    if (!expectedHash?.startsWith("fnv-") && globalThis.crypto?.subtle) {
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
