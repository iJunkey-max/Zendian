import { App, TFile } from "obsidian";
import type { HomepageTaskItem, HomepageTaskRadarResult, HomepageTaskRadarSettings } from "./types";

function normalizePath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/+$/, "");
}

export class HomepageTaskService {
  constructor(private app: App) {}

  async getTaskRadar(settings: HomepageTaskRadarSettings): Promise<HomepageTaskRadarResult> {
    const files = this.app.vault.getFiles().filter((file) => file.extension === "md");
    const excludedFolders = settings.excludeFolders.map(normalizePath).filter(Boolean);
    const items: HomepageTaskItem[] = [];
    let scannedFiles = 0;
    const matchedFiles = new Set<string>();

    for (const file of files) {
      if (this.isExcluded(file, excludedFolders)) continue;
      scannedFiles += 1;

      let text = "";
      try {
        text = await this.app.vault.cachedRead(file);
      } catch {
        continue;
      }

      const fileItems = this.extractTasks(file, text, settings.includeCompleted);
      if (fileItems.length) {
        matchedFiles.add(file.path);
        items.push(...fileItems);
      }
    }

    items.sort((a, b) => b.mtime - a.mtime || a.filePath.localeCompare(b.filePath) || a.line - b.line);

    return {
      scannedFiles,
      matchedFiles: matchedFiles.size,
      items: items.slice(0, Math.max(1, settings.limit)),
    };
  }

  async openTask(task: HomepageTaskItem): Promise<TFile | null> {
    const file = this.app.vault.getAbstractFileByPath(task.filePath);
    if (file instanceof TFile) {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
      return file;
    }
    return null;
  }

  private extractTasks(file: TFile, text: string, includeCompleted: boolean): HomepageTaskItem[] {
    const lines = text.split(/\r?\n/);
    const tasks: HomepageTaskItem[] = [];
    let fenced = false;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];

      if (/^\s*(```|~~~)/.test(line)) {
        fenced = !fenced;
        continue;
      }
      if (fenced) continue;

      const match = line.match(/^\s*[-*+]\s+\[( |x|X)\]\s+(.*)$/);
      if (!match) continue;

      const completed = match[1].toLowerCase() === "x";
      if (completed && !includeCompleted) continue;

      tasks.push({
        text: match[2].trim(),
        filePath: file.path,
        fileName: file.basename,
        line: index + 1,
        completed,
        mtime: file.stat.mtime || 0,
      });
    }

    return tasks;
  }

  private isExcluded(file: TFile, folders: string[]): boolean {
    if (!folders.length) return false;
    return folders.some((folder) => file.path === folder || file.path.startsWith(`${folder}/`));
  }
}
