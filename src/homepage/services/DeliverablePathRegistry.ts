import { normalizePath } from "obsidian";

const foldersByProject = new Map<string, Set<string>>();

export function registerDeliverableFolder(projectPath: string, folderName: string): void {
  const project = normalizePath(projectPath);
  const folder = folderName.trim();
  if (!folder || folder.includes("/") || folder.includes("\\")) return;
  const folders = foldersByProject.get(project) ?? new Set<string>();
  folders.add(folder);
  foldersByProject.set(project, folders);
}

export function registerDeliverablePaths(
  projectPath: string,
  deliverables: Array<{ path: string; format?: string }>,
): void {
  for (const deliverable of deliverables) {
    if (deliverable.format !== "zip") continue;
    const folderName = deliverable.path.split("/")[0];
    if (folderName) registerDeliverableFolder(projectPath, folderName);
  }
}

export function isDeliverablePath(projectPath: string, filePath: string): boolean {
  const project = normalizePath(projectPath);
  const path = normalizePath(filePath);
  const relative = path.startsWith(`${project}/`) ? path.slice(project.length + 1) : path;
  const folderName = relative.split("/")[0];
  return foldersByProject.get(project)?.has(folderName) ?? false;
}
