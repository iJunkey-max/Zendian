import type { ProjectCategory } from "../types/settings.types";

const PROJECT_TYPE_PALETTE = [
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#10b981",
  "#06b6d4",
  "#ef4444",
  "#ec4899",
  "#6366f1",
];

export function getProjectCategoryFolder(category: ProjectCategory): string {
  return `${category.number}_${category.name}`;
}

/** 为任意用户分类生成稳定颜色，不依赖写死的分类名称。 */
export function getProjectTypeColor(type: string, categories: ProjectCategory[] = []): string {
  const configuredIndex = categories.findIndex((category) => category.name === type);
  if (configuredIndex >= 0) return PROJECT_TYPE_PALETTE[configuredIndex % PROJECT_TYPE_PALETTE.length];

  let hash = 0;
  for (const char of type) hash = ((hash * 31) + char.codePointAt(0)!) >>> 0;
  return PROJECT_TYPE_PALETTE[hash % PROJECT_TYPE_PALETTE.length];
}
