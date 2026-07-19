/** 项目生命周期状态。状态由用户手动维护，不与任务完成度绑定。 */
export type ProjectStatus = "initiated" | "planning" | "implementing" | "reviewing" | "completed" | "paused";

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
  { value: "initiated", label: "已立项", description: "项目已经创建并进入管理", icon: "flag" },
  { value: "planning", label: "规划中", description: "明确目标、范围与任务", icon: "map" },
  { value: "implementing", label: "推进中", description: "项目正在正常推进", icon: "play" },
  { value: "reviewing", label: "复核中", description: "检查结果与交付内容", icon: "scan-search" },
  { value: "completed", label: "已完成", description: "项目已经完成", icon: "circle-check" },
  { value: "paused", label: "暂停中", description: "暂时停止当前项目", icon: "pause" },
] as const;

export const PROJECT_PROGRESS_STEPS = PROJECT_STATUS_OPTIONS.filter(
  (option) => option.value !== "paused",
) as readonly ProjectStatusOption[];

export interface ProjectProgressInfo {
  status: ProjectStatus;
  percent: number;
  nodeIndex: number;
  taskRatio: number;
  isPaused: boolean;
}

const STATUS_VALUES = new Set<ProjectStatus>(PROJECT_STATUS_OPTIONS.map((option) => option.value));

/** 将旧版状态和异常值规范化为当前状态。 */
export function normalizeProjectStatus(value: unknown): ProjectStatus {
  if (typeof value === "string" && STATUS_VALUES.has(value as ProjectStatus)) {
    return value as ProjectStatus;
  }

  if (value === "active") return "implementing";
  if (value === "archived") return "completed";
  return "initiated";
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

export function calculateProjectProgress(
  value: unknown,
  taskDone = 0,
  taskTotal = 0,
): ProjectProgressInfo {
  const status = normalizeProjectStatus(value);
  const taskRatio = taskTotal > 0 ? Math.min(1, Math.max(0, taskDone / taskTotal)) : 0;
  if (status === "paused") {
    return { status, percent: 0, nodeIndex: -1, taskRatio, isPaused: true };
  }

  const nodeIndex = Math.max(0, PROJECT_PROGRESS_STEPS.findIndex((option) => option.value === status));
  if (status === "completed") {
    return { status, percent: 100, nodeIndex, taskRatio: 1, isPaused: false };
  }
  if (status === "initiated") {
    return { status, percent: 0, nodeIndex, taskRatio: 0, isPaused: false };
  }

  const percent = Math.min(99, Math.round(nodeIndex * 25 + taskRatio * 25));
  return { status, percent, nodeIndex, taskRatio, isPaused: false };
}
