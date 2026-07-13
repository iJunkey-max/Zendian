/**
 * ProjectFilterBar — 项目筛选器组件
 *
 * 功能：
 * - 按状态筛选（全部/进行中/暂停/完成）
 * - 按类型筛选（全部/学习/工作/创作/生活/研究）
 * - 按优先级筛选（全部/高/中/低）
 * - 多种排序方式（活跃度/优先级/时间/名称）
 * - 显示符合条件的项目数
 */

export interface ProjectFilter {
  status: "all" | "active" | "paused" | "completed";
  type: "all" | "学习" | "工作" | "创作" | "生活" | "研究";
  priority: "all" | "high" | "medium" | "low";
  sortBy: "activity" | "priority" | "time" | "name";
}

export const DEFAULT_FILTER: ProjectFilter = {
  status: "all",
  type: "all",
  priority: "all",
  sortBy: "activity",
};

/**
 * 渲染筛选器栏
 */
export function renderProjectFilterBar(
  container: HTMLElement,
  currentFilter: ProjectFilter,
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
      { value: "active", label: "进行中" },
      { value: "paused", label: "暂停" },
      { value: "completed", label: "完成" },
    ],
    currentFilter.status,
    (value) => {
      onFilterChange({ ...currentFilter, status: value as any });
    }
  );

  // 类型筛选
  const typeSelect = createSelect(
    filters,
    "类型",
    [
      { value: "all", label: "全部" },
      { value: "学习", label: "学习" },
      { value: "工作", label: "工作" },
      { value: "创作", label: "创作" },
      { value: "生活", label: "生活" },
      { value: "研究", label: "研究" },
    ],
    currentFilter.type,
    (value) => {
      onFilterChange({ ...currentFilter, type: value as any });
    }
  );

  // 优先级筛选
  const prioritySelect = createSelect(
    filters,
    "优先级",
    [
      { value: "all", label: "全部" },
      { value: "high", label: "高" },
      { value: "medium", label: "中" },
      { value: "low", label: "低" },
    ],
    currentFilter.priority,
    (value) => {
      onFilterChange({ ...currentFilter, priority: value as any });
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
      { value: "priority", label: "优先级" },
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
