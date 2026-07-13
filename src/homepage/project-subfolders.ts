import type { ProjectSubfolderTemplate } from "../types/settings.types";

export function getProjectSubfolderName(template: Pick<ProjectSubfolderTemplate, "number" | "name">): string {
  return `${template.number}_${template.name}`;
}

export function validateProjectSubfolderTemplate(
  number: string,
  name: string,
  templates: Array<Pick<ProjectSubfolderTemplate, "number" | "name">>,
  ignoreIndex = -1,
): { message: string; field: "number" | "name" } | null {
  if (!/^\d+$/.test(number)) return { message: "文件夹编号只能包含数字", field: "number" };
  if (!name || /[\\/:*?"<>|]/.test(name) || name === "." || name === "..") {
    return { message: "请输入有效的文件夹名称，不能包含 \\ / : * ? \" < > |", field: "name" };
  }
  if (templates.some((item, index) => index !== ignoreIndex && item.number === number)) {
    return { message: `文件夹编号 ${number} 已存在`, field: "number" };
  }
  if (templates.some((item, index) => index !== ignoreIndex && item.name === name)) {
    return { message: `文件夹名称“${name}”已存在`, field: "name" };
  }
  return null;
}
