import type { App, TFile } from "obsidian";
import { getPluginDataPath } from "../../utils/plugin-paths";
import type { RegisteredProject } from "./ProjectRegistry";

export interface FileInventoryEntry { size: number; mtime: number; hash?: string }
export interface ConfirmedRename {
  type: "confirmed-rename";
  fromPath: string;
  confirmedAt: number;
}
export interface DiscoveredChange {
  projectId: string;
  path: string;
  kind: "added" | "changed" | "missing";
  discoveredAt: number;
  /** Hash observed in this scan (or the previous scan for a missing file). */
  hash?: string;
  /** Previous hash for a changed file; retained for audit and conflict checks. */
  previousHash?: string;
  possiblePreviousPath?: string;
  resolution?: ConfirmedRename;
}

export interface RenameCandidate {
  projectId: string;
  fromPath: string;
  toPath: string;
  hash?: string;
  discoveredAt: number;
}

export function compareInventories(projectId: string, before: Record<string, FileInventoryEntry>, after: Record<string, FileInventoryEntry>, discoveredAt: number): DiscoveredChange[] {
  const changes: DiscoveredChange[] = [];
  const owns = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);
  for (const [path, entry] of Object.entries(after)) {
    if (!owns(before, path)) changes.push({ projectId, path, kind: "added", discoveredAt, hash: entry.hash });
    else if (entry.hash && before[path].hash ? entry.hash !== before[path].hash : entry.size !== before[path].size || entry.mtime !== before[path].mtime) changes.push({
      projectId,
      path,
      kind: "changed",
      discoveredAt,
      hash: entry.hash,
      previousHash: before[path].hash,
    });
  }
  const missingByHash = new Map<string, string[]>();
  for (const path of Object.keys(before)) if (!owns(after, path)) {
    changes.push({ projectId, path, kind: "missing", discoveredAt, hash: before[path].hash });
    const hash = before[path].hash;
    if (hash) { const paths = missingByHash.get(hash) || []; paths.push(path); missingByHash.set(hash, paths); }
  }
  for (const change of changes.filter(change => change.kind === "added")) {
    const hash = after[change.path].hash;
    if (!hash) continue;
    const candidates = missingByHash.get(hash);
    if (candidates?.length === 1) change.possiblePreviousPath = candidates[0];
  }
  return changes;
}

/** Fingerprints verify content where available; matching paths are only rename candidates. */
export class ProjectFileInventory {
  constructor(private app: App) {}

  /**
   * Return only an exact one-to-one content match. A scan suggestion is never
   * enough to mutate history or task links by itself.
   */
  async getRenameCandidate(projectId: string, fromPath: string, toPath: string): Promise<RenameCandidate | null> {
    const { stored } = await this.readStore();
    return this.findRenameCandidate(stored, projectId, fromPath, toPath);
  }

  /** Mark a candidate as user-confirmed while retaining the discovery audit. */
  async confirmRename(projectId: string, fromPath: string, toPath: string): Promise<boolean> {
    const path = getPluginDataPath(this.app, "project-file-inventory.json");
    const { original, stored } = await this.readStore();
    const candidate = this.findRenameCandidate(stored, projectId, fromPath, toPath);
    if (!candidate) return false;

    const confirmedAt = Date.now();
    const resolution: ConfirmedRename = { type: "confirmed-rename", fromPath, confirmedAt };
    for (const change of stored.changes) {
      if (change.projectId !== projectId || change.resolution) continue;
      if (change.kind === "added" && change.path === toPath && change.possiblePreviousPath === fromPath) change.resolution = resolution;
      if (change.kind === "missing" && change.path === fromPath) change.resolution = resolution;
    }
    const serialized = JSON.stringify(stored);
    const latest = await this.app.vault.adapter.exists(path) ? await this.app.vault.adapter.read(path) : null;
    if (latest !== original) throw new Error("文件核对记录已被外部修改，未确认改名；请重新扫描后重试");
    await this.app.vault.adapter.write(path, serialized);
    return true;
  }

  async reconcile(projects: RegisteredProject[], verifyContent = false, isActive: () => boolean = () => true): Promise<void> {
    const path = getPluginDataPath(this.app, "project-file-inventory.json");
    const { original, stored } = await this.readStore();
    const files = this.app.vault.getFiles();
    const ready = projects.filter(project => project.projectId && project.state === "ready");
    const byFolder = new Map(ready.map(project => [project.folderPath, project]));
    const grouped = new Map<RegisteredProject, TFile[]>();
    for (const file of files) {
      if (!isActive()) return;
      if (file.extension === "home") continue;
      const parts = file.path.split("/");
      for (let length = parts.length - 1; length > 0; length--) {
        const project = byFolder.get(parts.slice(0, length).join("/"));
        if (project) { const group = grouped.get(project) || []; group.push(file); grouped.set(project, group); }
      }
    }
    for (const project of projects) {
      if (!isActive()) return;
      if (!project.projectId || project.state !== "ready") continue;
      const prefix = project.folderPath + "/";
      const current: Record<string, FileInventoryEntry> = Object.create(null);
      const previous = stored.projects[project.projectId] as Record<string, FileInventoryEntry> | undefined;
      for (const file of grouped.get(project) || []) {
        if (!isActive()) return;
        if (!file.path.startsWith(prefix) || file.extension === "home") continue;
        const relative = file.path.slice(prefix.length);
        const observedPath = file.path, observedSize = file.stat.size, observedMtime = file.stat.mtime;
        const old = previous && Object.prototype.hasOwnProperty.call(previous, relative) ? previous[relative] : undefined;
        let hash = !verifyContent && old?.size === file.stat.size && old?.mtime === file.stat.mtime ? old.hash : undefined;
        // Bound individual reads. Large attachments retain explicitly weaker metadata detection.
        if (!hash && file.stat.size <= 8 * 1024 * 1024) {
          const bytes = await this.app.vault.readBinary(file);
          const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
          hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
        }
        if (file.path !== observedPath || file.stat.size !== observedSize || file.stat.mtime !== observedMtime) throw new Error("文件核对期间发生变化，将在下次重新核对");
        current[relative] = { size: file.stat.size, mtime: file.stat.mtime, hash };
      }
      if (previous) stored.changes.push(...compareInventories(project.projectId, previous, current, Date.now()));
      stored.projects[project.projectId] = current;
    }
    stored.changes = stored.changes.slice(-2000);
    const serialized = JSON.stringify(stored);
    if (isActive() && serialized !== original) {
      const latest = await this.app.vault.adapter.exists(path) ? await this.app.vault.adapter.read(path) : null;
      if (latest !== original) throw new Error("文件核对索引被外部修改，未覆盖；将在下次重新核对");
      if (isActive()) await this.app.vault.adapter.write(path, serialized);
    }
  }

  private async readStore(): Promise<{ original: string | null; stored: { version: 1; projects: Record<string, Record<string, FileInventoryEntry>>; changes: DiscoveredChange[] } }> {
    const path = getPluginDataPath(this.app, "project-file-inventory.json");
    const original = await this.app.vault.adapter.exists(path) ? await this.app.vault.adapter.read(path) : null;
    const stored = original === null ? { version: 1 as const, projects: {}, changes: [] } : JSON.parse(original);
    const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
    const safeRelativePath = (value: unknown): value is string => typeof value === "string" && !!value && !value.startsWith("/") && !/[\\:\x00-\x1f]/.test(value) && value.split("/").every(part => !!part && part !== "." && part !== "..");
    if (stored.version !== 1 || !stored.projects || !Array.isArray(stored.changes)) throw new Error("文件核对索引损坏，已保留原数据");
    if (!record(stored.projects)) throw new Error("文件核对项目索引损坏，已保留原数据");
    for (const [projectId, entries] of Object.entries(stored.projects)) {
      if (["__proto__", "constructor", "prototype"].includes(projectId) || !projectId.trim() || !record(entries) || Object.entries(entries).some(([relativePath, value]) => !safeRelativePath(relativePath) || !record(value) || typeof value.size !== "number" || !Number.isFinite(value.size) || value.size < 0 || typeof value.mtime !== "number" || !Number.isFinite(value.mtime) || (value.hash !== undefined && (typeof value.hash !== "string" || !/^[a-f0-9]{64}$/i.test(value.hash))))) throw new Error("文件核对条目损坏，已保留原数据");
    }
    if (stored.changes.some((change: DiscoveredChange) => !change || typeof change.projectId !== "string" || !change.projectId.trim() || !safeRelativePath(change.path) || !["added", "changed", "missing"].includes(change.kind) || !Number.isFinite(change.discoveredAt) || (change.hash !== undefined && (typeof change.hash !== "string" || !/^[a-f0-9]{64}$/i.test(change.hash))) || (change.previousHash !== undefined && (typeof change.previousHash !== "string" || !/^[a-f0-9]{64}$/i.test(change.previousHash))) || (change.possiblePreviousPath !== undefined && !safeRelativePath(change.possiblePreviousPath)) || (change.resolution !== undefined && (!change.resolution || change.resolution.type !== "confirmed-rename" || !safeRelativePath(change.resolution.fromPath) || !Number.isFinite(change.resolution.confirmedAt))))) throw new Error("文件核对变化记录损坏，已保留原数据");
    return { original, stored };
  }

  private findRenameCandidate(
    stored: { projects: Record<string, Record<string, FileInventoryEntry>>; changes: DiscoveredChange[] },
    projectId: string,
    fromPath: string,
    toPath: string,
  ): RenameCandidate | null {
    const added = stored.changes.find(change => change.projectId === projectId && change.kind === "added" && change.path === toPath && change.possiblePreviousPath === fromPath && !change.resolution);
    const missing = added && stored.changes.find(change => change.projectId === projectId && change.kind === "missing" && change.path === fromPath && !change.resolution && change.discoveredAt === added.discoveredAt);
    if (!added || !missing) return null;
    const current = stored.projects[projectId]?.[toPath];
    // A candidate is valid only while the newly observed file still has the
    // exact fingerprint that paired it with the missing old path. Requiring
    // both hashes and one scan timestamp prevents stale or cross-scan pairs
    // from migrating history after the file was edited or recreated.
    if (!current || !added.hash || !missing.hash || added.hash.toLowerCase() !== missing.hash.toLowerCase() || current.hash?.toLowerCase() !== added.hash.toLowerCase()) return null;
    return { projectId, fromPath, toPath, hash: current?.hash, discoveredAt: added.discoveredAt };
  }
}
