import { App, TFile, TFolder } from "obsidian";

/** 仅用于读取旧项目；新项目不再创建固定控制台子文件夹。 */
export const LEGACY_PROJECT_CONSOLE_FOLDER = "00 控制台";
export const PROJECT_HOME_FILENAME = "项目主页.home";

function normalizeProjectPath(projectPath: string): string {
  return projectPath.replace(/\\/g, "/").replace(/\/+$/, "");
}

function findFile(app: App, candidates: string[], extension?: string): TFile | null {
  for (const path of candidates) {
    const candidate = app.vault.getAbstractFileByPath(path);
    if (candidate instanceof TFile && (!extension || candidate.extension === extension)) return candidate;
  }
  return null;
}

/** Resolve a project's metadata file across the root layout and the legacy console-folder layout. */
export function findProjectHomeFile(app: App, projectPath: string, preferredName?: string): TFile | null {
  const normalizedPath = normalizeProjectPath(projectPath);
  void preferredName;
  const matches: TFile[] = [];
  for (const path of [normalizedPath, normalizedPath + "/" + LEGACY_PROJECT_CONSOLE_FOLDER]) {
    const folder = app.vault.getAbstractFileByPath(path);
    if (!(folder instanceof TFolder)) continue;
    matches.push(...folder.children.filter((child): child is TFile => child instanceof TFile && child.extension === "home"));
  }
  // Multiple metadata files are a conflict, never choose one by name or alphabetical order.
  return matches.length === 1 ? matches[0] : null;
}

export function findProjectTimelineFile(app: App, projectPath: string): TFile | null {
  const normalizedPath = normalizeProjectPath(projectPath);
  return findFile(app, [
    `${normalizedPath}/Timeline.md`,
    `${normalizedPath}/${LEGACY_PROJECT_CONSOLE_FOLDER}/Timeline.md`,
  ]);
}

export function findProjectOverviewFile(app: App, projectPath: string): TFile | null {
  const normalizedPath = normalizeProjectPath(projectPath);
  return findFile(app, [
    `${normalizedPath}/Overview.md`,
    `${normalizedPath}/${LEGACY_PROJECT_CONSOLE_FOLDER}/Overview.md`,
  ]);
}

/** Existing system directory when available; otherwise the project root for all new files. */
export function getProjectSystemDirectory(app: App, projectPath: string): string {
  const normalizedPath = normalizeProjectPath(projectPath);
  const homeFile = findProjectHomeFile(app, normalizedPath);
  if (homeFile) return homeFile.parent?.path || normalizedPath;
  return normalizedPath;
}
