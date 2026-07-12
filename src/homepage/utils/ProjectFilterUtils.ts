/**
 * ProjectFilterUtils — 项目筛选和排序工具函数
 */

import type { HomepageProject } from "../types";
import type { ProjectFilter } from "../components/ProjectFilterBar";

/**
 * 根据筛选条件过滤项目列表
 */
export function filterProjects(projects: HomepageProject[], filter: ProjectFilter): HomepageProject[] {
  let filtered = [...projects];

  // 按状态筛选
  if (filter.status !== "all") {
    filtered = filtered.filter((p) => p.status === filter.status);
  }

  // 按类型筛选
  if (filter.type !== "all") {
    filtered = filtered.filter((p) => p.type === filter.type);
  }

  // 按优先级筛选
  if (filter.priority !== "all") {
    filtered = filtered.filter((p) => p.priority === filter.priority);
  }

  return filtered;
}

/**
 * 根据排序方式排序项目列表
 */
export function sortProjects(projects: HomepageProject[], sortBy: ProjectFilter["sortBy"]): HomepageProject[] {
  const sorted = [...projects];

  switch (sortBy) {
    case "activity":
      // 按活跃度排序（最近活跃的排前面）
      return sorted.sort((a, b) => {
        const aActivity = a.lastActiveTime || 0;
        const bActivity = b.lastActiveTime || 0;
        return bActivity - aActivity;
      });

    case "priority":
      // 按优先级排序（高 > 中 > 低）
      const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
      return sorted.sort((a, b) => {
        const aScore = priorityOrder[a.priority || "low"] || 0;
        const bScore = priorityOrder[b.priority || "low"] || 0;
        return bScore - aScore;
      });

    case "time":
      // 按创建时间排序（新到旧）
      return sorted.sort((a, b) => {
        const aTime = a.createdTime || 0;
        const bTime = b.createdTime || 0;
        return bTime - aTime;
      });

    case "name":
      // 按名称排序（A-Z）
      return sorted.sort((a, b) => {
        return a.name.localeCompare(b.name, "zh-CN");
      });

    default:
      return sorted;
  }
}

/**
 * 应用筛选和排序
 */
export function applyFilterAndSort(projects: HomepageProject[], filter: ProjectFilter): HomepageProject[] {
  const filtered = filterProjects(projects, filter);
  const sorted = sortProjects(filtered, filter.sortBy);
  return sorted;
}
