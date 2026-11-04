import type { ProjectConsoleData, ProjectConsoleDeliverable } from "../types";
import { normalizeProjectStatus } from "../project-status";

export type TaskEventKind = "task-created" | "task-updated" | "task-completed" | "task-reopened" | "task-deleted" | "task-restored";
export type MilestoneEventKind = "milestone-added" | "milestone-updated" | "milestone-completed" | "milestone-reopened" | "milestone-removed";

export interface ProjectBusinessEvent {
  id: string;
  kind: "deliverable-added" | "deliverable-updated" | "deliverable-removed" | "project-restored" | "project-moved" | "status-changed" | "checkpoint-created" | "checkpoint-removed" | "checkpoint-restored" | TaskEventKind | MilestoneEventKind;
  timestamp: string;
  name: string;
  path: string;
  status?: string;
  approximateTime?: boolean;
  taskId?: string;
  from?: string;
  to?: string;
  milestoneId?: string;
  plannedDate?: string;
  checkpointId?: string;
  description?: string;
}

/** Canonical stream; legacy fields remain readable by older callers. No write occurs on discovery. */
export function recordProjectChanges(before: ProjectConsoleData, after: ProjectConsoleData): void {
  recordDeliveryChanges(before, after);
  const events = after.businessEvents!;
  const ids = new Set(events.map(event => event.id));
  for (const event of after.activity || []) {
    const id = `task:${event.id}`;
    if (ids.has(id)) continue;
    events.push({ id, kind: event.kind, taskId: event.taskId, name: event.text, path: "", timestamp: event.timestamp });
    ids.add(id);
  }
  for (const entry of after.statusHistory || []) {
    if (!Number.isFinite(Date.parse(entry.changedAt))) continue;
    const from = normalizeProjectStatus(entry.from), to = normalizeProjectStatus(entry.to);
    const id = `stage:${JSON.stringify([entry.changedAt, from, to])}`;
    if (ids.has(id)) continue;
    events.push({ id, kind: "status-changed", name: "项目阶段变更", path: "", timestamp: entry.changedAt, from, to });
    ids.add(id);
  }
  const collect = (data: ProjectConsoleData) => {
    // Timeline milestones are canonical. The stable metadata:* event key is
    // retained for compatibility with existing history and report consumers.
    const milestones = data.timeline?.milestones?.length
      ? data.timeline.milestones.map(item => ({ id: item.id, title: item.name, plannedDate: item.date, completed: item.completed, detail: JSON.stringify(item) }))
      : (data.milestones || []).map(item => ({ id: item.id, title: item.title, plannedDate: item.deadline, completed: item.completed, detail: JSON.stringify(item) }));
    return new Map(milestones.map(item => [`metadata:${item.id}`, item] as const));
  };
  const previous = collect(before), current = collect(after);
  const appendMilestone = (kind: MilestoneEventKind, id: string, item: { title: string; plannedDate: string }, baseline = false) => {
    events.push({ id: globalThis.crypto.randomUUID(), kind, name: item.title, path: "", milestoneId: id,
      plannedDate: item.plannedDate, timestamp: new Date().toISOString(), approximateTime: baseline || undefined });
  };
  if (!before.businessEvents?.some(event => event.kind.startsWith("milestone-"))) {
    for (const [id, item] of previous) appendMilestone("milestone-added", id, item, true);
  }
  for (const [id, item] of current) {
    const old = previous.get(id);
    if (!old) appendMilestone("milestone-added", id, item);
    else if (JSON.stringify(old) !== JSON.stringify(item)) appendMilestone(old.completed !== item.completed
      ? item.completed ? "milestone-completed" : "milestone-reopened" : "milestone-updated", id, item);
  }
  for (const [id, item] of previous) if (!current.has(id)) appendMilestone("milestone-removed", id, item);
}

const identity = (item: ProjectConsoleDeliverable) => item.id || item.path;

/** Record delivery transitions in the same write as the project change. */
export function recordDeliveryChanges(before: ProjectConsoleData, after: ProjectConsoleData): void {
  const events = [...new Map([...(after.businessEvents || []), ...(before.businessEvents || [])].map(event => [event.id, event])).values()];
  const now = new Date().toISOString();
  const append = (kind: ProjectBusinessEvent["kind"], item: ProjectConsoleDeliverable, baseline = false) => {
    const knownTime = item.createdAt && Number.isFinite(Date.parse(item.createdAt)) ? item.createdAt : undefined;
    events.push({ id: globalThis.crypto.randomUUID(), kind, name: item.name, path: item.path, status: item.status,
      timestamp: baseline ? knownTime || now : now, approximateTime: baseline || undefined });
  };
  if (!before.businessEvents) for (const item of before.deliverables || []) append("deliverable-added", item, true);
  const previous = new Map((before.deliverables || []).map(item => [identity(item), item]));
  const current = new Map((after.deliverables || []).map(item => [identity(item), item]));
  for (const [id, item] of current) {
    const old = previous.get(id);
    if (!old) append("deliverable-added", item);
    else if (JSON.stringify(old) !== JSON.stringify(item)) append("deliverable-updated", item);
  }
  for (const [id, item] of previous) if (!current.has(id)) append("deliverable-removed", item);
  after.businessEvents = events;
}
