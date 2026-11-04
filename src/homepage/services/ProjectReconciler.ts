import type { App } from "obsidian";
import { getPluginDataPath } from "../../utils/plugin-paths";
import { ProjectRegistry } from "./ProjectRegistry";
import { ProjectFileInventory } from "./ProjectFileInventory";

export interface ProjectLocation {
  projectId: string;
  path: string;
  name: string;
  lastSeen: number;
  missing: boolean;
  conflict?: string;
}

type ProjectMoveRollback = () => Promise<void>;
type ProjectUnavailableCallback = (projectPath: string) => void;

/** Persisted identity index. Missing entries are retained; ambiguous identities never move history. */
export class ProjectReconciler {
  private locations: Record<string, ProjectLocation> = {};
  private loaded = false;
  private running: Promise<void> | null = null;
  private pending = false;
  private firstScan = true;
  private pendingDeepScan = false;
  constructor(
    private app: App,
    private onMoved: (oldPath: string, newPath: string) => Promise<ProjectMoveRollback | void>,
    private isActive: () => boolean = () => true,
    private onUnavailable: ProjectUnavailableCallback = () => undefined,
  ) {}

  getLocations(): ProjectLocation[] { return Object.values(this.locations).map(entry => ({ ...entry })); }

  /**
   * Reconcile the vault against the persisted location/file indexes.
   *
   * Normal background passes reuse size/mtime metadata for small files to
   * avoid hashing the whole vault every 30 seconds.  A user-requested scan
   * can opt into a content pass so an external synchronizer that preserved
   * metadata cannot hide a same-size/same-mtime edit.
   */
  reconcile(deepScan = false): Promise<void> {
    this.pending = true;
    this.pendingDeepScan = this.pendingDeepScan || deepScan;
    if (this.running) return this.running;
    this.running = (async () => {
      while (this.pending && this.isActive()) {
        this.pending = false;
        const scanContent = this.firstScan || this.pendingDeepScan;
        this.pendingDeepScan = false;
        await this.run(scanContent);
        this.firstScan = false;
      }
    })().finally(() => { this.running = null; });
    return this.running;
  }

  private async run(verifyContent: boolean): Promise<void> {
    const path = getPluginDataPath(this.app, "project-locations.json");
    const adapter = this.app.vault.adapter;
    const original = await adapter.exists(path) ? await adapter.read(path) : null;
    if (original === null && this.loaded && Object.keys(this.locations).length) throw new Error("项目位置索引运行期间缺失，未使用旧状态重建；请检查同步状态");
    if (original !== null) {
      // Fail closed on damaged state; never silently overwrite historical associations.
      const stored = JSON.parse(original);
      if (stored.version !== 1 || !stored.locations || typeof stored.locations !== "object" || Array.isArray(stored.locations)) throw new Error("项目位置索引损坏");
      for (const [id, entry] of Object.entries(stored.locations)) {
        const value = entry as ProjectLocation;
        if (["__proto__", "constructor", "prototype"].includes(id) || !value || value.projectId !== id || typeof value.path !== "string" || typeof value.name !== "string" || !Number.isFinite(value.lastSeen) || typeof value.missing !== "boolean") throw new Error("项目位置索引条目损坏");
      }
      this.locations = stored.locations;
    }
    this.loaded = true;
    const assertUnchanged = async () => {
      const latest = await adapter.exists(path) ? await adapter.read(path) : null;
      if (latest !== original) throw new Error("核对期间项目位置索引被外部修改，未覆盖；将在下次重新核对");
    };
    const discovery = await new ProjectRegistry(this.app).discover();
    if (!this.isActive()) return;
    // A project can disappear or become duplicate/nested while the plugin is
    // running. Stop runtime watchers for those boundaries before the next
    // scan; otherwise an old path can continue absorbing unrelated files.
    // A path that is about to be rebased is kept alive so an external folder
    // move remains one transaction rather than a stop/start race.
    const movingFrom = new Set<string>();
    for (const project of discovery.projects) {
      if (!project.projectId || project.state !== "ready") continue;
      const previous = this.locations[project.projectId];
      if (previous && previous.path !== project.folderPath) movingFrom.add(previous.path);
    }
    const unavailable = new Set<string>();
    for (const location of Object.values(this.locations)) {
      if (movingFrom.has(location.path)) continue;
      const current = discovery.projects.find(project => project.projectId === location.projectId && project.folderPath === location.path && project.state === "ready");
      if (!current) unavailable.add(location.path);
    }
    for (const project of discovery.projects) {
      if (project.state !== "ready" && project.state !== "legacy") unavailable.add(project.folderPath);
    }
    for (const projectPath of unavailable) {
      if (this.isActive()) this.onUnavailable(projectPath);
    }
    const previousLocations = structuredClone(this.locations);
    const next = structuredClone(this.locations);
    const rollbacks: ProjectMoveRollback[] = [];
    let committedLocationsText: string | null = null;
    try {
      for (const entry of Object.values(next)) entry.missing = true;
      for (const project of discovery.projects) {
        if (!project.projectId || project.state !== "ready") continue;
        const previous = next[project.projectId];
        if (previous && previous.path !== project.folderPath) {
          // Do not merge a new identity into history currently owned by another project.
          const occupied = discovery.projects.some(other => other.projectId !== project.projectId && other.folderPath === previous.path);
          const historyOwner = Object.values(this.locations).some(other => other.projectId !== project.projectId && other.path === project.folderPath);
          if (occupied || historyOwner) {
            previous.conflict = `发现当前位置 ${project.folderPath}，但旧位置或新位置与其他项目历史冲突，未自动迁移。`;
            continue;
          }
          if (!this.isActive()) {
            if (rollbacks.length) throw new Error("插件已关闭，目录迁移未完成");
            return;
          }
          await assertUnchanged();
          const rollback = await this.onMoved(previous.path, project.folderPath);
          if (rollback) rollbacks.push(rollback);
          if (!this.isActive()) throw new Error("插件已关闭，目录迁移未完成");
        }
        next[project.projectId] = { projectId: project.projectId, path: project.folderPath, name: project.name, lastSeen: Date.now(), missing: false };
      }
      if (!this.isActive()) {
        if (rollbacks.length) throw new Error("插件已关闭，目录迁移未完成");
        return;
      }
      await assertUnchanged();
      if (!this.isActive()) {
        if (rollbacks.length) throw new Error("插件已关闭，目录迁移未完成");
        return;
      }
      committedLocationsText = JSON.stringify({ version: 1, locations: next }, null, 2);
      await this.app.vault.adapter.write(path, committedLocationsText);
      this.locations = next;
      await new ProjectFileInventory(this.app).reconcile(discovery.projects, verifyContent, this.isActive);
    } catch (error) {
      const rollbackErrors: string[] = [];
      for (const rollback of rollbacks.reverse()) {
        try { await rollback(); } catch (rollbackError) { rollbackErrors.push(String(rollbackError)); }
      }
      // The location index is part of the same migration transaction. If a
      // later inventory step fails, restore it only while it still contains
      // the exact text this pass committed; never overwrite an external sync
      // update that arrived during rollback.
      if (committedLocationsText !== null && rollbackErrors.length === 0) {
        try {
          const latest = await adapter.exists(path) ? await adapter.read(path) : null;
          if (latest !== committedLocationsText) throw new Error("位置索引在回滚期间被外部修改，未覆盖");
          if (original === null) await adapter.remove(path);
          else await adapter.write(path, original);
          this.locations = previousLocations;
        } catch (indexRollbackError) {
          rollbackErrors.push(String(indexRollbackError));
        }
      }
      if (rollbackErrors.length) throw new Error(`${String(error)}；目录迁移回滚失败：${rollbackErrors.join("；")}`);
      throw error;
    }
  }
}
