import { normalizePath } from "obsidian";
import type { App } from "obsidian";
import { isPortableProjectPath } from "../../utils/project-path";

const foldersByVault = new WeakMap<object, Map<string, Set<string>>>();
const defaultVaultScope = {};

function getFolders(app?: App): Map<string, Set<string>> {
  const scope = (app as unknown as object | undefined) ?? defaultVaultScope;
  let folders = foldersByVault.get(scope);
  if (!folders) {
    folders = new Map<string, Set<string>>();
    foldersByVault.set(scope, folders);
  }
  return folders;
}

export function registerDeliverableFolder(app: App | undefined, projectPath: string, folderName: string): void {
  const project = normalizePath(projectPath);
  const folder = folderName.trim();
  if (!folder || folder.includes("/") || folder.includes("\\")) return;
  const registry = getFolders(app);
  const folders = registry.get(project) ?? new Set<string>();
  folders.add(folder);
  registry.set(project, folders);
}

export function registerDeliverablePaths(
  app: App | undefined,
  projectPath: string,
  deliverables: Array<{ path: string; format?: string }>,
): void {
  for (const deliverable of deliverables) {
    if (deliverable.format !== "zip") continue;
    if (!isPortableProjectPath(deliverable.path) || deliverable.path.split("/").length < 2) continue;
    const folderName = deliverable.path.split("/")[0];
    if (folderName) registerDeliverableFolder(app, projectPath, folderName);
  }
}

export function rebaseDeliverableProjectPath(app: App | undefined, oldProjectPath: string, newProjectPath: string): void {
  const oldProject = normalizePath(oldProjectPath);
  const newProject = normalizePath(newProjectPath);
  if (!oldProject || !newProject || oldProject === newProject) return;
  const registry = getFolders(app);
  const folders = registry.get(oldProject);
  if (!folders) return;
  registry.set(newProject, new Set(folders));
  registry.delete(oldProject);
}

export function isDeliverablePath(app: App | undefined, projectPath: string, filePath: string): boolean {
  const project = normalizePath(projectPath);
  const path = normalizePath(filePath);
  const relative = path.startsWith(`${project}/`) ? path.slice(project.length + 1) : path;
  const folderName = relative.split("/")[0];
  return getFolders(app).get(project)?.has(folderName) ?? false;
}
