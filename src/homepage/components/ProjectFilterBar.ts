/**
 * ProjectFilterBar — 项目筛选器组件
 *
 * 功能：
 * - 按项目生命周期状态筛选
 * - 按用户配置的项目分类动态筛选
 * - 按优先级筛选（全部/高/中/低）
 * - 多种排序方式（活跃度/优先级/时间/名称）
 * - 显示符合条件的项目数
 */

import { PROJECT_STATUS_OPTIONS, type ProjectStatus } from "../project-status";

export interface ProjectFilter {
  status: "all" | ProjectStatus;
  type: string;
  sortBy: "activity" | "time" | "name";
}

export const DEFAULT_FILTER: ProjectFilter = {
  status: "all",
  type: "all",
  sortBy: "activity",
};

/**
 * 渲染筛选器栏
 */
export function renderProjectFilterBar(
  container: HTMLElement,
  currentFilter: ProjectFilter,
  projectTypes: readonly string[],
  onFilterChange: (filter: ProjectFilter) => void
): void {
  container.empty();
  container.addClass("homepage-project-filter-bar");

  // 左侧：筛选器
  const filters = container.createDiv({ cls: "homepage-filter-group" });

  // 状态筛选
  const statusSelect = createSelect(
    filters,
    "状态",
    [
      { value: "all", label: "全部" },
      ...PROJECT_STATUS_OPTIONS.map(({ value, label }) => ({ value, label })),
    ],
    currentFilter.status,
    (value) => {
      onFilterChange({ ...currentFilter, status: value as ProjectFilter["status"] });
    }
  );

  // 类型筛选
  const typeSelect = createSelect(
    filters,
    "类型",
    [
      { value: "all", label: "全部" },
      ...projectTypes.map((type) => ({ value: type, label: type })),
    ],
    currentFilter.type,
    (value) => {
      onFilterChange({ ...currentFilter, type: value as any });
    }
  );

  // 右侧：排序
  const sortGroup = container.createDiv({ cls: "homepage-sort-group" });
  sortGroup.createSpan({ cls: "homepage-filter-label", text: "排序：" });

  const sortSelect = createSelect(
    sortGroup,
    "",
    [
      { value: "activity", label: "最近活跃" },
      { value: "time", label: "创建时间" },
      { value: "name", label: "名称" },
    ],
    currentFilter.sortBy,
    (value) => {
      onFilterChange({ ...currentFilter, sortBy: value as any });
    }
  );
}

/**
 * 创建下拉选择器
 */
function createSelect(
  parent: HTMLElement,
  label: string,
  options: Array<{ value: string; label: string }>,
  currentValue: string,
  onChange: (value: string) => void
): HTMLSelectElement {
  const wrapper = parent.createDiv({ cls: "homepage-filter-item" });

  if (label) {
    wrapper.createSpan({ cls: "homepage-filter-label", text: label + "：" });
  }

  const select = wrapper.createEl("select", { cls: "homepage-filter-select" });

  for (const opt of options) {
    const option = select.createEl("option", {
      value: opt.value,
      text: opt.label,
    });

    if (opt.value === currentValue) {
      option.selected = true;
    }
  }

  select.addEventListener("change", () => {
    onChange(select.value);
  });

  return select;
}
