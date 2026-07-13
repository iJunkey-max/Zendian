import { App, TFile, TFolder } from "obsidian";

/** 仅用于读取旧项目；新项目不再创建固定控制台子文件夹。 */
export const LEGACY_PROJECT_CONSOLE_FOLDER = "00 控制台";

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
  const projectName = preferredName?.trim() || normalizedPath.split("/").pop()?.replace(/^\d+_/, "") || "";
  const legacyPath = `${normalizedPath}/${LEGACY_PROJECT_CONSOLE_FOLDER}`;
  const direct = findFile(app, [
    projectName ? `${normalizedPath}/${projectName}.home` : "",
    `${normalizedPath}/控制台.home`,
    projectName ? `${legacyPath}/${projectName}.home` : "",
    `${legacyPath}/控制台.home`,
    `${normalizedPath}/.home`,
  ].filter(Boolean), "home");
  if (direct) return direct;

  for (const folderPath of [normalizedPath, legacyPath]) {
    const folder = app.vault.getAbstractFileByPath(folderPath);
    if (!(folder instanceof TFolder)) continue;
    const fallback = folder.children
      .filter((child): child is TFile => child instanceof TFile && child.extension === "home")
      .sort((a, b) => a.path.localeCompare(b.path))[0];
    if (fallback) return fallback;
  }
  return null;
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
  const timeline = findProjectTimelineFile(app, normalizedPath);
  if (timeline) return timeline.parent?.path || normalizedPath;
  return normalizedPath;
}
