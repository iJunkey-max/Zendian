import { normalizeProjectStatus, type ProjectStatus, type ProjectStatusHistoryEntry, type ResumableProjectStatus } from "../project-status";

/** Apply one explicit transition to the latest data, preserving all other fields. */
export function changeProjectStage(data: {
  status?: string;
  statusBeforePause?: string;
  statusHistory?: ProjectStatusHistoryEntry[];
  updatedAt?: string;
}, next: ProjectStatus, expected?: ProjectStatus): void {
  const previous = normalizeProjectStatus(data.status);
  if (previous === next) return;
  if (expected !== undefined && previous !== expected) throw new Error("项目阶段已在其他位置更改，请刷新后重试");
  data.statusBeforePause = next === "paused" ? previous as ResumableProjectStatus : undefined;
  data.status = next;
  const now = new Date();
  data.updatedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  data.statusHistory = [...(data.statusHistory || []), { from: previous, to: next, changedAt: now.toISOString() }];
}
