/** 项目生命周期状态。状态由用户手动维护，不与任务完成度绑定。 */
export type ProjectStatus = "planning" | "implementing" | "reviewing" | "completed" | "paused";

export type ResumableProjectStatus = Exclude<ProjectStatus, "paused">;

export interface ProjectStatusOption {
  value: ProjectStatus;
  label: string;
  description: string;
  icon: string;
}

export interface ProjectStatusHistoryEntry {
  from: ProjectStatus;
  to: ProjectStatus;
  changedAt: string;
}

export const PROJECT_STATUS_OPTIONS: readonly ProjectStatusOption[] = [
  { value: "planning", label: "规划中", description: "明确目标、范围与任务", icon: "map" },
  { value: "implementing", label: "实施中", description: "项目正在正常推进", icon: "play" },
  { value: "reviewing", label: "复核中", description: "检查结果与交付内容", icon: "scan-search" },
  { value: "completed", label: "已结束", description: "项目已经完成或关闭", icon: "circle-check" },
  { value: "paused", label: "项目暂停", description: "暂时停止当前项目", icon: "pause" },
] as const;

const STATUS_VALUES = new Set<ProjectStatus>(PROJECT_STATUS_OPTIONS.map((option) => option.value));

/** 将旧版状态和异常值规范化为当前状态。 */
export function normalizeProjectStatus(value: unknown): ProjectStatus {
  if (typeof value === "string" && STATUS_VALUES.has(value as ProjectStatus)) {
    return value as ProjectStatus;
  }

  if (value === "active") return "implementing";
  if (value === "archived") return "completed";
  return "planning";
}

export function normalizeStatusBeforePause(value: unknown): ResumableProjectStatus | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const status = normalizeProjectStatus(value);
  return status === "paused" ? undefined : status;
}

export function getProjectStatusOption(value: unknown): ProjectStatusOption {
  const status = normalizeProjectStatus(value);
  return PROJECT_STATUS_OPTIONS.find((option) => option.value === status) ?? PROJECT_STATUS_OPTIONS[0];
}
