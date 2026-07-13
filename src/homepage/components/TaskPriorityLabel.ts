import type { TaskPriority } from "../types";
import { TASK_PRIORITY_LABELS } from "../types";

export type StoredTaskPriority = "urgent" | "high" | "medium" | "low";

const STORED_PRIORITY_MAP: Record<StoredTaskPriority, TaskPriority> = {
  urgent: "P0",
  high: "P1",
  medium: "P2",
  low: "P3",
};

/** 在主页和项目主页中渲染一致的任务优先级标识。 */
export function renderTaskPriorityLabel(
  parent: HTMLElement,
  priority: TaskPriority | StoredTaskPriority,
): HTMLElement {
  const displayPriority = priority.startsWith("P")
    ? priority as TaskPriority
    : STORED_PRIORITY_MAP[priority as StoredTaskPriority];
  const label = TASK_PRIORITY_LABELS[displayPriority];
  const element = parent.createSpan({
    cls: `zd-task-priority zd-task-priority--${displayPriority.toLowerCase()}`,
    attr: { "aria-label": `优先级：${label}` },
  });

  element.createSpan({ cls: "zd-task-priority__swatch", attr: { "aria-hidden": "true" } });
  element.createSpan({ cls: "zd-task-priority__label", text: label });
  return element;
}
