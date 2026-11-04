import { isProjectData } from "./project-validation";

export interface RestoreReferenceOptions {
  /** Relative paths currently present in the project, including deliverables. */
  availablePaths?: ReadonlySet<string>;
}

/** Restoring content must never change the identity of the destination project. */
export function restoreProjectContent(snapshot: string, current: string, options: RestoreReferenceOptions = {}): string {
  const restored = JSON.parse(snapshot), destination = JSON.parse(current);
  if (!isProjectData(restored) || !isProjectData(destination) || !destination.projectId) throw new Error("项目主页身份不可确认，请先修复项目关联");
  restored.projectId = destination.projectId;
  restored.schemaVersion = destination.schemaVersion || 2;

  // A checkpoint restores the project workspace, not the physical identity of
  // files that were later renamed or moved. If the historical task link no
  // longer exists but the current task still points at a valid file, retain
  // that current relative path instead of restoring a broken attachment.
  const available = options.availablePaths;
  if (available) {
    const currentTasks = new Map((destination.tasks || []).filter(task => typeof task.id === "string").map(task => [task.id!, task]));
    for (const task of restored.tasks || []) {
      if (!task.id || !task.linkedFile || available.has(task.linkedFile)) continue;
      const currentTask = currentTasks.get(task.id);
      if (currentTask?.linkedFile && available.has(currentTask.linkedFile)) task.linkedFile = currentTask.linkedFile;
    }
  }

  // Deliverable records describe already-published artifacts and are not
  // checkpoint workspace files. Keep the current record set so restoring an
  // older .home cannot resurrect deleted records or point at an old archive.
  if (Array.isArray(destination.deliverables)) restored.deliverables = structuredClone(destination.deliverables);

  // Restore working state without rolling back the record of what actually happened.
  const merge = <T>(older: T[] | undefined, newer: T[] | undefined, key: (entry: T) => string): T[] =>
    [...new Map([...(older || []), ...(newer || [])].map(entry => [key(entry), entry])).values()];
  restored.activity = merge(restored.activity, destination.activity, entry => entry.id);
  restored.businessEvents = merge(restored.businessEvents, destination.businessEvents, entry => entry.id);
  restored.statusHistory = merge(restored.statusHistory, destination.statusHistory, entry => JSON.stringify([entry.changedAt, entry.from, entry.to]));
  const now = new Date();
  restored.businessEvents.push({ id: globalThis.crypto.randomUUID(), kind: "project-restored", name: restored.name,
    path: "", timestamp: now.toISOString() });
  restored.updatedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return JSON.stringify(restored, null, 2);
}
