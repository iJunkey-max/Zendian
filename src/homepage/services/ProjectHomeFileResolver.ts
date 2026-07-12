import { App, TFile, TFolder } from "obsidian";

export const PROJECT_CONSOLE_FOLDER = "00 控制台";

function normalizeProjectPath(projectPath: string): string {
  return projectPath.replace(/\\/g, "/").replace(/\/+$/, "");
}

/** Resolve a project's metadata file across current and legacy layouts. */
export function findProjectHomeFile(
  app: App,
  projectPath: string,
  preferredName?: string,
): TFile | null {
  const normalizedPath = normalizeProjectPath(projectPath);
  const projectName = preferredName?.trim() || normalizedPath.split("/").pop() || "";
  const consolePath = `${normalizedPath}/${PROJECT_CONSOLE_FOLDER}`;
  const candidates = [
    projectName ? `${consolePath}/${projectName}.home` : "",
    `${consolePath}/控制台.home`,
  ].filter(Boolean);

  for (const path of candidates) {
    const candidate = app.vault.getAbstractFileByPath(path);
    if (candidate instanceof TFile && candidate.extension === "home") return candidate;
  }

  const consoleFolder = app.vault.getAbstractFileByPath(consolePath);
  if (consoleFolder instanceof TFolder) {
    const fallback = consoleFolder.children
      .filter((child): child is TFile => child instanceof TFile && child.extension === "home")
      .sort((a, b) => a.path.localeCompare(b.path))[0];
    if (fallback) return fallback;
  }

  const legacyCandidates = [
    `${normalizedPath}/.home`,
    projectName ? `${normalizedPath}/${projectName}.home` : "",
  ].filter(Boolean);

  for (const path of legacyCandidates) {
    const candidate = app.vault.getAbstractFileByPath(path);
    if (candidate instanceof TFile && candidate.extension === "home") return candidate;
  }

  return null;
}
