import type { ProjectConsoleData } from "../types";
import { isPortableProjectPath } from "../../utils/project-path";

const PROJECT_STATUS_VALUES = new Set([
  "initiated", "planning", "implementing", "reviewing", "completed", "paused",
  // Legacy aliases are normalized on read/write but remain valid input.
  "active", "archived",
]);

/** Reject incompatible/corrupt data instead of silently replacing it with defaults. */
export function isProjectData(value: unknown): value is ProjectConsoleData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  const uniqueIds = (items: Array<{ id?: unknown }>, optional = false): boolean => {
    const ids = new Set<string>();
    for (const item of items) {
      if (optional && item.id === undefined) continue;
      if (typeof item.id !== "string" || !item.id.trim() || ids.has(item.id)) return false;
      ids.add(item.id);
    }
    return true;
  };
  if (typeof data.name !== "string" || !Array.isArray(data.tasks)) return false;
  if (data.schemaVersion !== undefined && (!Number.isInteger(data.schemaVersion) || Number(data.schemaVersion) > 2 || Number(data.schemaVersion) < 1)) return false;
  if (data.projectId !== undefined && (typeof data.projectId !== "string" || !data.projectId.trim())) return false;
  if (typeof data.projectId === "string" && ["__proto__", "constructor", "prototype"].includes(data.projectId)) return false;
  if (data.status !== undefined && (typeof data.status !== "string" || !PROJECT_STATUS_VALUES.has(data.status))) return false;
  if (data.description !== undefined && typeof data.description !== "string") return false;
  if (data.createdAt !== undefined && (typeof data.createdAt !== "string" || !Number.isFinite(Date.parse(data.createdAt)))) return false;
  if (data.updatedAt !== undefined && (typeof data.updatedAt !== "string" || !Number.isFinite(Date.parse(data.updatedAt)))) return false;
  if (!data.tasks.every(task => task && typeof task === "object" && typeof task.text === "string" && typeof task.completed === "boolean")) return false;
  if (!uniqueIds(data.tasks, true)) return false;
  if (!data.tasks.every(task => task.linkedFile === undefined || (typeof task.linkedFile === "string" && !/[\\:]/.test(task.linkedFile) && !task.linkedFile.startsWith("/") && task.linkedFile.split("/").every((part: string) => part && part !== "." && part !== "..")))) return false;
  if (data.deliverables !== undefined && !Array.isArray(data.deliverables)) return false;
  if (Array.isArray(data.deliverables)) {
    const paths = new Set<string>();
    const ids = new Set<string>();
    if (!data.deliverables.every(item => {
      if (!item || typeof item !== "object" || typeof item.name !== "string" || typeof item.path !== "string" || !isPortableProjectPath(item.path)) return false;
      if (paths.has(item.path)) return false;
      paths.add(item.path);
      if (item.id !== undefined) {
        if (typeof item.id !== "string" || !item.id.trim() || ids.has(item.id)) return false;
        ids.add(item.id);
      }
      if (item.status !== undefined && !["pending", "in-progress", "done"].includes(item.status)) return false;
      if (item.createdAt !== undefined && (typeof item.createdAt !== "string" || !Number.isFinite(Date.parse(item.createdAt)))) return false;
      if (item.fileCount !== undefined && (!Number.isInteger(item.fileCount) || item.fileCount < 0)) return false;
      if (item.description !== undefined && typeof item.description !== "string") return false;
      return true;
    })) return false;
  }
  const isMilestone = (item: unknown): item is { id: string; name: string; date: string; progress: number; completed: boolean } => {
    if (!item || typeof item !== "object") return false;
    const value = item as Record<string, unknown>;
    return typeof value.id === "string" && !!value.id.trim() && typeof value.name === "string" &&
      typeof value.date === "string" && typeof value.completed === "boolean" &&
      typeof value.progress === "number" && Number.isFinite(value.progress) && value.progress >= 0 && value.progress <= 100;
  };
  if (data.timeline !== undefined) {
    if (!data.timeline || typeof data.timeline !== "object") return false;
    const timeline = data.timeline as { milestones?: unknown };
    if (!Array.isArray(timeline.milestones)) return false;
    const milestoneIds = new Set<string>();
    if (!timeline.milestones.every((item: unknown) => isMilestone(item) && !milestoneIds.has(item.id) && (milestoneIds.add(item.id), true))) return false;
  }
  if (data.milestones !== undefined) {
    if (!Array.isArray(data.milestones)) return false;
    const legacyMilestoneIds = new Set<string>();
    if (!data.milestones.every(item => {
      if (!item || typeof item !== "object") return false;
      const value = item as Record<string, unknown>;
      if (typeof value.id !== "string" || !value.id.trim() || legacyMilestoneIds.has(value.id) || typeof value.title !== "string" || typeof value.deadline !== "string" || typeof value.completed !== "boolean" || !Array.isArray(value.deliverables)) return false;
      legacyMilestoneIds.add(value.id);
      return true;
    })) return false;
  }
  if (data.businessEvents !== undefined && (!Array.isArray(data.businessEvents) || !data.businessEvents.every(event =>
    event && typeof event.id === "string" && typeof event.name === "string" && typeof event.path === "string" &&
    typeof event.timestamp === "string" && Number.isFinite(Date.parse(event.timestamp)) &&
    ["deliverable-added", "deliverable-updated", "deliverable-removed", "project-restored", "status-changed", "task-created", "task-updated", "task-completed", "task-reopened", "task-deleted", "task-restored", "milestone-added", "milestone-updated", "milestone-completed", "milestone-reopened", "milestone-removed"].includes(event.kind) &&
    (!event.kind.startsWith("milestone-") || (typeof event.milestoneId === "string" && typeof event.plannedDate === "string")) &&
    (!event.kind.startsWith("task-") || typeof event.taskId === "string") &&
    (event.kind !== "status-changed" || (typeof event.from === "string" && typeof event.to === "string"))
  ))) return false;
  if (Array.isArray(data.businessEvents) && !uniqueIds(data.businessEvents)) return false;
  if (data.activity !== undefined && (!Array.isArray(data.activity) || !data.activity.every(event =>
    event && typeof event.id === "string" && typeof event.taskId === "string" && typeof event.text === "string" &&
    typeof event.timestamp === "string" && Number.isFinite(Date.parse(event.timestamp)) &&
    ["task-created", "task-updated", "task-completed", "task-reopened", "task-deleted", "task-restored"].includes(event.kind)
  ))) return false;
  if (Array.isArray(data.activity) && !uniqueIds(data.activity)) return false;
  if (data.statusHistory !== undefined && (!Array.isArray(data.statusHistory) || !data.statusHistory.every(entry => entry && typeof entry.from === "string" && PROJECT_STATUS_VALUES.has(entry.from) && typeof entry.to === "string" && PROJECT_STATUS_VALUES.has(entry.to) && typeof entry.changedAt === "string" && Number.isFinite(Date.parse(entry.changedAt))))) return false;
  return true;
}
