import { App, TFile } from "obsidian";
import type { HomepageBookmarkEntry, HomepageDailyNoteSettings, HomepageDailyNoteSummary } from "./types";

type InternalPluginsLike = {
  getPluginById?: (id: string) => unknown;
  [key: string]: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizePath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/+$/, "");
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatDate(date: Date, pattern: string): string {
  const tokens: Array<[string, string]> = [
    ["YYYY", `${date.getFullYear()}`],
    ["MM", `${date.getMonth() + 1}`.padStart(2, "0")],
    ["DD", `${date.getDate()}`.padStart(2, "0")],
    ["HH", `${date.getHours()}`.padStart(2, "0")],
    ["mm", `${date.getMinutes()}`.padStart(2, "0")],
    ["ss", `${date.getSeconds()}`.padStart(2, "0")],
    ["M", `${date.getMonth() + 1}`],
    ["D", `${date.getDate()}`],
  ];

  let result = pattern || "YYYY-MM-DD";
  for (const [token, replacement] of tokens) {
    result = result.replace(new RegExp(token, "g"), replacement);
  }
  return result;
}

function basenameFromPath(path: string): string {
  const normalized = normalizePath(path);
  const name = normalized.split("/").pop() ?? normalized;
  return name.replace(/\.md$/i, "") || "Untitled";
}

export class HomepageBookmarksAdapter {
  constructor(private app: App) {}

  async readBookmarks(): Promise<HomepageBookmarkEntry[]> {
    const fromPlugin = this.readFromCorePlugin();
    if (fromPlugin.length) return fromPlugin;
    return this.readFromBookmarksFile();
  }

  async openBookmark(entry: HomepageBookmarkEntry): Promise<TFile | null> {
    if (entry.url) {
      window.open(entry.url, "_blank", "noopener,noreferrer");
      return null;
    }

    if (!entry.path) return null;
    const target = await this.resolveFileOrFolder(entry.path);
    if (target instanceof TFile) {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(target);
      return target;
    }

    if (target && "path" in target) {
      const firstFile = this.app.vault.getFiles().find((file) => file.path.startsWith(`${target.path}/`));
      if (firstFile) {
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(firstFile);
        return firstFile;
      }
    }

    return null;
  }

  private readFromCorePlugin(): HomepageBookmarkEntry[] {
    const internalPlugins = (this.app as unknown as { internalPlugins?: InternalPluginsLike }).internalPlugins;
    const plugin = internalPlugins?.getPluginById?.("bookmarks") ?? internalPlugins?.bookmarks;
    if (!plugin) return [];

    const candidate = isRecord(plugin) ? (plugin.instance ?? plugin.settings ?? plugin.data ?? plugin) : plugin;
    return this.normalizeBookmarkTree(candidate);
  }

  private async readFromBookmarksFile(): Promise<HomepageBookmarkEntry[]> {
    const path = ".obsidian/bookmarks.json";
    try {
      if (!(await this.app.vault.adapter.exists(path))) return [];
      const raw = await this.app.vault.adapter.read(path);
      return this.normalizeBookmarkTree(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  private normalizeBookmarkTree(raw: unknown, level = 0): HomepageBookmarkEntry[] {
    if (!raw) return [];

    if (Array.isArray(raw)) {
      return raw.flatMap((item) => this.normalizeBookmarkTree(item, level));
    }

    if (!isRecord(raw)) return [];

    const children = this.getChildren(raw);
    const title = this.getTitle(raw);
    const nestedFile = isRecord(raw.file) ? raw.file : undefined;
    const path = getString(raw.path ?? raw.filePath ?? nestedFile?.path);
    const url = getString(raw.url ?? raw.href);
    const type = this.getType(raw, path, url);

    const items: HomepageBookmarkEntry[] = [];
    if (path || url) {
      items.push({
        title: title || (path ? basenameFromPath(path) : url),
        path: path || undefined,
        url: url || undefined,
        type,
        level,
      });
    }

    for (const child of children) {
      items.push(...this.normalizeBookmarkTree(child, level + 1));
    }

    return items;
  }

  private getChildren(raw: Record<string, unknown>): unknown[] {
    const candidates = [raw.items, raw.children, raw.bookmarks, raw.value];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }
    return [];
  }

  private getTitle(raw: Record<string, unknown>): string {
    return getString(raw.title ?? raw.name ?? raw.label ?? raw.text ?? raw.displayText);
  }

  private getType(raw: Record<string, unknown>, path: string, url: string): HomepageBookmarkEntry["type"] {
    const type = getString(raw.type).toLowerCase();
    if (type === "folder") return "folder";
    if (type === "url" || type === "link") return "url";
    if (url) return "url";
    if (path && path.endsWith("/")) return "folder";
    return "file";
  }

  private async resolveFileOrFolder(path: string): Promise<TFile | { path: string } | null> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) return file;

    const normalized = normalizePath(path);
    const folderPath = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (folder && "children" in folder) {
      return { path: folder.path };
    }

    return null;
  }
}

export class HomepageDailyNoteAdapter {
  constructor(private app: App) {}

  async resolveToday(settings: HomepageDailyNoteSettings): Promise<HomepageDailyNoteSummary> {
    const defaults = this.readCoreDailyNoteDefaults();
    const folder = normalizePath(settings.folder || defaults.folder || "");
    const dateFormat = settings.dateFormat || defaults.dateFormat || "YYYY-MM-DD";
    const templatePath = settings.templatePath || defaults.templatePath || "";
    const title = formatDate(new Date(), dateFormat);
    const path = folder ? `${folder}/${title}.md` : `${title}.md`;
    const exists = await this.fileExists(path);

    return {
      enabled: settings.enabled,
      title,
      path,
      exists,
      dateLabel: title,
      folder,
      templatePath,
      source: defaults.source,
    };
  }

  async openToday(settings: HomepageDailyNoteSettings): Promise<TFile> {
    const note = await this.resolveToday(settings);
    const existing = this.app.vault.getAbstractFileByPath(note.path);
    if (existing instanceof TFile) {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(existing);
      return existing;
    }

    await this.ensureFolderExists(note.path);
    const created = await this.app.vault.create(note.path, `# ${note.title}\n`);
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(created);
    return created;
  }

  private readCoreDailyNoteDefaults(): Pick<HomepageDailyNoteSummary, "folder" | "templatePath" | "source"> & { dateFormat?: string } {
    const internalPlugins = (this.app as unknown as { internalPlugins?: InternalPluginsLike }).internalPlugins;
    const plugin = internalPlugins?.getPluginById?.("daily-notes") ?? internalPlugins?.["daily-notes"];
    if (!plugin || !isRecord(plugin)) {
      return { folder: "", templatePath: "", source: "settings" };
    }

    const candidate = plugin.instance ?? plugin.settings ?? plugin.options ?? plugin;
    if (!isRecord(candidate)) {
      return { folder: "", templatePath: "", source: "settings" };
    }

    return {
      folder: getString(candidate.folder ?? candidate.targetFolder ?? candidate.defaultFolder),
      templatePath: getString(candidate.templatePath ?? candidate.template ?? candidate.templateFilePath),
      dateFormat: getString(candidate.dateFormat ?? candidate.format ?? candidate.dateTemplate),
      source: "core-plugin",
    };
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      return await this.app.vault.adapter.exists(path);
    } catch {
      return false;
    }
  }

  private async ensureFolderExists(filePath: string): Promise<void> {
    const parts = filePath.split("/");
    if (parts.length <= 1) return;

    const folderParts = parts.slice(0, -1);
    let current = "";
    for (const part of folderParts) {
      current = current ? `${current}/${part}` : part;
      if (!(await this.fileExists(current))) {
        await this.app.vault.createFolder(current);
      }
    }
  }
}
