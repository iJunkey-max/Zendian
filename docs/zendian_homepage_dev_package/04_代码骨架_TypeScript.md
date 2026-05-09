# 04 代码骨架 TypeScript

下面代码是 MVP 可落地骨架。请放入源码工程，不要直接粘进编译后的 `main.js`。

---

## src/homepage/constants.ts

```ts
export const VIEW_TYPE_ZENDIAN_HOMEPAGE = "zendian-homepage-view";

export const HOMEPAGE_MODULE_ID = "homepage";

export const HOMEPAGE_COMMAND_OPEN = "open-zendian-homepage";
export const HOMEPAGE_COMMAND_REFRESH = "refresh-zendian-homepage";
```

---

## src/homepage/types.ts

```ts
import type { App, TFile } from "obsidian";

export interface HomepageSettings {
  enabled: boolean;
  replaceEmptyTab: boolean;
  openOnStartup: boolean;
  focusSearchOnOpen: boolean;
  showStats: boolean;
  showRecentFiles: boolean;
  recentFileLimit: number;
  showQuickActions: boolean;
  enableCreateFromSearch: boolean;
  defaultCreateFolder: string;
}

export interface HomepageModuleContext {
  app: App;
  getSettings: () => any;
  updateSettings: (patch: Record<string, unknown>) => Promise<void>;
}

export interface HomepageSearchResult {
  file: TFile;
  title: string;
  path: string;
  extension: string;
  score: number;
}

export interface HomepageStats {
  totalFiles: number;
  markdownFiles: number;
  canvasFiles: number;
  todayModified: number;
  totalSizeText: string;
}

export interface HomepageViewState {
  query?: string;
}
```

---

## src/homepage/utils.ts

```ts
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay = 300
): T {
  let timer: number | undefined;

  return function debounced(this: unknown, ...args: Parameters<T>) {
    if (timer) {
      window.clearTimeout(timer);
    }

    timer = window.setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  } as T;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value = value / 1024;
    index++;
  }

  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatRelativeTime(time: number): string {
  const diff = Date.now() - time;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;

  return new Date(time).toLocaleDateString();
}

export function normalizeCreatePath(title: string, folder: string): string {
  const safeTitle = title
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 120);

  const filename = safeTitle || "Untitled";

  if (!folder || !folder.trim()) {
    return `${filename}.md`;
  }

  return `${folder.replace(/\/+$/, "")}/${filename}.md`;
}
```

---

## src/homepage/HomepageSearchService.ts

```ts
import { App, TFile } from "obsidian";
import type { HomepageSearchResult } from "./types";
import { normalizeCreatePath } from "./utils";

export class HomepageSearchService {
  constructor(private app: App) {}

  search(query: string, limit = 20): HomepageSearchResult[] {
    const raw = query.trim().toLowerCase();
    if (!raw) return [];

    const { keyword, ext } = this.parseQuery(raw);
    const files = this.app.vault.getFiles();

    return files
      .filter(file => {
        if (ext && file.extension.toLowerCase() !== ext) return false;

        const path = file.path.toLowerCase();
        const basename = file.basename.toLowerCase();

        return basename.includes(keyword) || path.includes(keyword);
      })
      .map(file => ({
        file,
        title: file.basename,
        path: file.path,
        extension: file.extension,
        score: this.score(file, keyword),
      }))
      .sort((a, b) => b.score - a.score || b.file.stat.mtime - a.file.stat.mtime)
      .slice(0, limit);
  }

  async openFile(file: TFile): Promise<void> {
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
  }

  async createNoteFromQuery(query: string, folder: string): Promise<TFile> {
    const path = normalizeCreatePath(query, folder);
    const existing = this.app.vault.getAbstractFileByPath(path);

    if (existing instanceof TFile) {
      await this.openFile(existing);
      return existing;
    }

    const file = await this.app.vault.create(path, `# ${query.trim() || "Untitled"}\n`);
    await this.openFile(file);
    return file;
  }

  private parseQuery(query: string): { keyword: string; ext?: string } {
    const extMatch = query.match(/\bext:([a-z0-9]+)\b/);
    const ext = extMatch?.[1];
    const keyword = query.replace(/\bext:[a-z0-9]+\b/g, "").trim();

    return {
      keyword: keyword || query,
      ext,
    };
  }

  private score(file: TFile, keyword: string): number {
    const basename = file.basename.toLowerCase();
    const path = file.path.toLowerCase();

    if (basename === keyword) return 100;
    if (basename.startsWith(keyword)) return 80;
    if (basename.includes(keyword)) return 60;
    if (path.includes(keyword)) return 30;

    return 1;
  }
}
```

---

## src/homepage/HomepageRecentService.ts

```ts
import { App, TFile } from "obsidian";

export class HomepageRecentService {
  constructor(private app: App) {}

  getRecentFiles(limit = 10): TFile[] {
    return this.app.vault
      .getFiles()
      .filter(file => file.extension !== "tmp")
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .slice(0, Math.max(1, limit));
  }
}
```

---

## src/homepage/HomepageStatsService.ts

```ts
import { App } from "obsidian";
import type { HomepageStats } from "./types";
import { formatBytes } from "./utils";

export class HomepageStatsService {
  constructor(private app: App) {}

  getStats(): HomepageStats {
    const files = this.app.vault.getFiles();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();

    const totalSize = files.reduce((sum, file) => sum + (file.stat.size || 0), 0);

    return {
      totalFiles: files.length,
      markdownFiles: files.filter(file => file.extension === "md").length,
      canvasFiles: files.filter(file => file.extension === "canvas").length,
      todayModified: files.filter(file => file.stat.mtime >= todayStart).length,
      totalSizeText: formatBytes(totalSize),
    };
  }
}
```

---

## src/homepage/HomepageRenderer.ts

```ts
import { setIcon, TFile } from "obsidian";
import type { HomepageModuleContext, HomepageSearchResult, HomepageStats } from "./types";
import { HomepageSearchService } from "./HomepageSearchService";
import { HomepageRecentService } from "./HomepageRecentService";
import { HomepageStatsService } from "./HomepageStatsService";
import { debounce, formatRelativeTime } from "./utils";

export class HomepageRenderer {
  private searchService: HomepageSearchService;
  private recentService: HomepageRecentService;
  private statsService: HomepageStatsService;

  private rootEl: HTMLElement | null = null;
  private resultsEl: HTMLElement | null = null;
  private recentEl: HTMLElement | null = null;
  private statsEl: HTMLElement | null = null;
  private inputEl: HTMLInputElement | null = null;

  constructor(private ctx: HomepageModuleContext) {
    this.searchService = new HomepageSearchService(ctx.app);
    this.recentService = new HomepageRecentService(ctx.app);
    this.statsService = new HomepageStatsService(ctx.app);
  }

  render(container: HTMLElement): void {
    const settings = this.ctx.getSettings().homepage;

    container.empty();
    container.addClass("zendian-homepage-view");

    this.rootEl = container.createDiv("zendian-homepage");

    this.renderHero(this.rootEl);

    if (settings.showQuickActions) {
      this.renderQuickActions(this.rootEl);
    }

    const grid = this.rootEl.createDiv("zendian-homepage-grid");

    if (settings.showStats) {
      this.statsEl = grid.createDiv("zendian-homepage-panel zendian-homepage-stats-panel");
      this.renderStats();
    }

    if (settings.showRecentFiles) {
      this.recentEl = grid.createDiv("zendian-homepage-panel zendian-homepage-recent-panel");
      this.renderRecentFiles();
    }
  }

  refresh(): void {
    this.renderStats();
    this.renderRecentFiles();

    if (this.inputEl?.value) {
      this.renderSearchResults(this.inputEl.value);
    }
  }

  focusSearch(): void {
    window.setTimeout(() => this.inputEl?.focus(), 50);
  }

  private renderHero(parent: HTMLElement): void {
    const hero = parent.createDiv("zendian-homepage-hero");

    const titleWrap = hero.createDiv("zendian-homepage-title-wrap");
    titleWrap.createEl("div", { cls: "zendian-homepage-kicker", text: "ZENdian" });
    titleWrap.createEl("h1", { text: "Homepage", cls: "zendian-homepage-title" });
    titleWrap.createEl("p", {
      text: "搜索、回到最近工作现场，或快速创建新的知识入口。",
      cls: "zendian-homepage-subtitle",
    });

    const searchWrap = hero.createDiv("zendian-homepage-search");
    const icon = searchWrap.createDiv("zendian-homepage-search-icon");
    setIcon(icon, "search");

    this.inputEl = searchWrap.createEl("input", {
      cls: "zendian-homepage-search-input",
      attr: {
        type: "text",
        placeholder: "搜索文件，或输入标题创建笔记；支持 ext:md / ext:canvas",
        spellcheck: "false",
      },
    });

    this.resultsEl = hero.createDiv("zendian-homepage-results");

    const debouncedSearch = debounce((value: string) => {
      this.renderSearchResults(value);
    }, 120);

    this.inputEl.addEventListener("input", () => {
      debouncedSearch(this.inputEl?.value ?? "");
    });

    this.inputEl.addEventListener("keydown", async event => {
      if (event.key !== "Enter") return;

      const query = this.inputEl?.value?.trim() ?? "";
      if (!query) return;

      const settings = this.ctx.getSettings().homepage;
      const results = this.searchService.search(query, 1);

      if (results[0]) {
        await this.searchService.openFile(results[0].file);
        return;
      }

      if (settings.enableCreateFromSearch) {
        await this.searchService.createNoteFromQuery(query, settings.defaultCreateFolder);
      }
    });
  }

  private renderQuickActions(parent: HTMLElement): void {
    const actions = parent.createDiv("zendian-homepage-actions");

    this.createAction(actions, "plus", "新建笔记", async () => {
      const file = await this.ctx.app.vault.create(
        `Untitled ${new Date().toISOString().replace(/[:.]/g, "-")}.md`,
        "# Untitled\n"
      );
      await this.ctx.app.workspace.getLeaf(false).openFile(file);
    });

    this.createAction(actions, "command", "命令面板", () => {
      this.ctx.app.commands.executeCommandById("command-palette:open");
    });

    this.createAction(actions, "git-fork", "图谱", () => {
      this.ctx.app.commands.executeCommandById("graph:open");
    });

    this.createAction(actions, "settings", "设置", () => {
      this.ctx.app.commands.executeCommandById("app:open-settings");
    });
  }

  private createAction(
    parent: HTMLElement,
    iconName: string,
    text: string,
    callback: () => void | Promise<void>
  ): void {
    const button = parent.createEl("button", { cls: "zendian-homepage-action" });
    const icon = button.createSpan("zendian-homepage-action-icon");
    setIcon(icon, iconName);
    button.createSpan({ text, cls: "zendian-homepage-action-text" });
    button.addEventListener("click", () => {
      void callback();
    });
  }

  private renderSearchResults(query: string): void {
    if (!this.resultsEl) return;

    this.resultsEl.empty();

    const trimmed = query.trim();
    if (!trimmed) {
      this.resultsEl.removeClass("is-active");
      return;
    }

    this.resultsEl.addClass("is-active");

    const results = this.searchService.search(trimmed, 12);
    if (!results.length) {
      const empty = this.resultsEl.createDiv("zendian-homepage-result-empty");
      empty.setText(`未找到 “${trimmed}”。按 Enter 创建新笔记。`);
      return;
    }

    for (const result of results) {
      this.renderResultItem(this.resultsEl, result);
    }
  }

  private renderResultItem(parent: HTMLElement, result: HomepageSearchResult): void {
    const item = parent.createDiv("zendian-homepage-result-item");
    const icon = item.createDiv("zendian-homepage-result-icon");
    setIcon(icon, this.getFileIcon(result.file));

    const main = item.createDiv("zendian-homepage-result-main");
    main.createDiv({ text: result.title, cls: "zendian-homepage-result-title" });
    main.createDiv({ text: result.path, cls: "zendian-homepage-result-path" });

    item.addEventListener("click", () => {
      void this.searchService.openFile(result.file);
    });
  }

  private renderStats(): void {
    if (!this.statsEl) return;

    const stats = this.statsService.getStats();
    this.statsEl.empty();

    this.statsEl.createEl("h2", { text: "知识库状态", cls: "zendian-homepage-panel-title" });

    const grid = this.statsEl.createDiv("zendian-homepage-stat-grid");

    this.createStatCard(grid, "文件总数", String(stats.totalFiles), "files");
    this.createStatCard(grid, "Markdown", String(stats.markdownFiles), "file-text");
    this.createStatCard(grid, "Canvas", String(stats.canvasFiles), "layout-dashboard");
    this.createStatCard(grid, "今日修改", String(stats.todayModified), "clock");
    this.createStatCard(grid, "库大小", stats.totalSizeText, "hard-drive");
  }

  private createStatCard(parent: HTMLElement, label: string, value: string, iconName: string): void {
    const card = parent.createDiv("zendian-homepage-stat-card");
    const icon = card.createDiv("zendian-homepage-stat-icon");
    setIcon(icon, iconName);
    card.createDiv({ text: value, cls: "zendian-homepage-stat-value" });
    card.createDiv({ text: label, cls: "zendian-homepage-stat-label" });
  }

  private renderRecentFiles(): void {
    if (!this.recentEl) return;

    const settings = this.ctx.getSettings().homepage;
    const files = this.recentService.getRecentFiles(settings.recentFileLimit);

    this.recentEl.empty();
    this.recentEl.createEl("h2", { text: "最近修改", cls: "zendian-homepage-panel-title" });

    const list = this.recentEl.createDiv("zendian-homepage-recent-list");

    for (const file of files) {
      this.renderRecentFileItem(list, file);
    }
  }

  private renderRecentFileItem(parent: HTMLElement, file: TFile): void {
    const item = parent.createDiv("zendian-homepage-recent-item");

    const icon = item.createDiv("zendian-homepage-recent-icon");
    setIcon(icon, this.getFileIcon(file));

    const main = item.createDiv("zendian-homepage-recent-main");
    main.createDiv({ text: file.basename, cls: "zendian-homepage-recent-title" });
    main.createDiv({ text: file.path, cls: "zendian-homepage-recent-path" });

    item.createDiv({
      text: formatRelativeTime(file.stat.mtime),
      cls: "zendian-homepage-recent-time",
    });

    item.addEventListener("click", async () => {
      await this.searchService.openFile(file);
    });
  }

  private getFileIcon(file: TFile): string {
    if (file.extension === "md") return "file-text";
    if (file.extension === "canvas") return "layout-dashboard";
    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(file.extension)) return "image";
    if (["pdf"].includes(file.extension)) return "file-text";
    return "file";
  }
}
```

---

## src/homepage/HomepageView.ts

```ts
import { ItemView, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_ZENDIAN_HOMEPAGE } from "./constants";
import type { HomepageModuleContext, HomepageViewState } from "./types";
import { HomepageRenderer } from "./HomepageRenderer";

export class HomepageView extends ItemView {
  private renderer: HomepageRenderer;
  private state: HomepageViewState = {};

  constructor(
    leaf: WorkspaceLeaf,
    private ctx: HomepageModuleContext
  ) {
    super(leaf);
    this.renderer = new HomepageRenderer(ctx);
  }

  getViewType(): string {
    return VIEW_TYPE_ZENDIAN_HOMEPAGE;
  }

  getDisplayText(): string {
    return "ZENdian Homepage";
  }

  getIcon(): string {
    return "home";
  }

  async onOpen(): Promise<void> {
    this.renderer.render(this.contentEl);

    const settings = this.ctx.getSettings().homepage;
    if (settings.focusSearchOnOpen) {
      this.renderer.focusSearch();
    }
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  getState(): HomepageViewState {
    return this.state;
  }

  async setState(state: HomepageViewState): Promise<void> {
    this.state = state ?? {};
  }

  refresh(): void {
    this.renderer.refresh();
  }
}
```

---

## src/homepage/HomepageModule.ts

```ts
import type { EventRef, Plugin, WorkspaceLeaf } from "obsidian";
import { Notice } from "obsidian";
import {
  HOMEPAGE_COMMAND_OPEN,
  HOMEPAGE_COMMAND_REFRESH,
  HOMEPAGE_MODULE_ID,
  VIEW_TYPE_ZENDIAN_HOMEPAGE,
} from "./constants";
import { HomepageView } from "./HomepageView";
import type { HomepageModuleContext } from "./types";
import { debounce } from "./utils";

export class HomepageModule {
  id = HOMEPAGE_MODULE_ID;
  name = "主页控制台";

  private ctx: HomepageModuleContext | null = null;
  private eventRefs: EventRef[] = [];
  private replacing = false;
  private refreshHomepageViewsDebounced = debounce(() => this.refreshHomepageViews(), 500);

  constructor(private plugin: Plugin) {}

  async load(ctx: HomepageModuleContext): Promise<void> {
    this.ctx = ctx;

    this.plugin.registerView(
      VIEW_TYPE_ZENDIAN_HOMEPAGE,
      leaf => new HomepageView(leaf, ctx)
    );

    this.plugin.addCommand({
      id: HOMEPAGE_COMMAND_OPEN,
      name: "打开 ZENdian 主页",
      callback: () => {
        void this.openHomepage();
      },
    });

    this.plugin.addCommand({
      id: HOMEPAGE_COMMAND_REFRESH,
      name: "刷新 ZENdian 主页",
      callback: () => {
        this.refreshHomepageViews();
        new Notice("ZENdian Homepage 已刷新");
      },
    });

    this.eventRefs.push(
      ctx.app.workspace.on("active-leaf-change", leaf => {
        void this.handleActiveLeafChange(leaf);
      })
    );

    this.eventRefs.push(
      ctx.app.vault.on("create", () => this.refreshHomepageViewsDebounced()),
      ctx.app.vault.on("modify", () => this.refreshHomepageViewsDebounced()),
      ctx.app.vault.on("delete", () => this.refreshHomepageViewsDebounced()),
      ctx.app.vault.on("rename", () => this.refreshHomepageViewsDebounced())
    );

    const settings = ctx.getSettings().homepage;
    if (settings?.enabled && settings?.openOnStartup) {
      this.plugin.app.workspace.onLayoutReady(() => {
        void this.openHomepage();
      });
    }
  }

  unload(): void {
    if (!this.ctx) return;

    for (const ref of this.eventRefs) {
      this.ctx.app.workspace.offref(ref);
    }

    this.eventRefs = [];
    this.plugin.app.workspace.detachLeavesOfType(VIEW_TYPE_ZENDIAN_HOMEPAGE);
    this.ctx = null;
  }

  onSettingsChanged(changedKeys: string[]): void {
    if (changedKeys.includes("homepage")) {
      this.refreshHomepageViews();
    }
  }

  private async openHomepage(): Promise<void> {
    if (!this.ctx) return;

    const settings = this.ctx.getSettings().homepage;
    if (!settings?.enabled) {
      new Notice("ZENdian Homepage 未启用");
      return;
    }

    const existingLeaves = this.ctx.app.workspace.getLeavesOfType(VIEW_TYPE_ZENDIAN_HOMEPAGE);
    if (existingLeaves.length > 0) {
      this.ctx.app.workspace.revealLeaf(existingLeaves[0]);
      return;
    }

    const leaf = this.ctx.app.workspace.getLeaf(true);
    await leaf.setViewState({
      type: VIEW_TYPE_ZENDIAN_HOMEPAGE,
      active: true,
    });

    this.ctx.app.workspace.revealLeaf(leaf);
  }

  private async handleActiveLeafChange(leaf: WorkspaceLeaf | null): Promise<void> {
    if (!this.ctx || !leaf || this.replacing) return;

    const settings = this.ctx.getSettings().homepage;
    if (!settings?.enabled || !settings?.replaceEmptyTab) return;

    const state = leaf.getViewState();
    if (state.type !== "empty") return;

    try {
      this.replacing = true;

      await leaf.setViewState({
        type: VIEW_TYPE_ZENDIAN_HOMEPAGE,
        active: true,
      });
    } finally {
      window.setTimeout(() => {
        this.replacing = false;
      }, 50);
    }
  }

  private refreshHomepageViews(): void {
    if (!this.ctx) return;

    const leaves = this.ctx.app.workspace.getLeavesOfType(VIEW_TYPE_ZENDIAN_HOMEPAGE);

    for (const leaf of leaves) {
      const view = leaf.view;
      if (view instanceof HomepageView) {
        view.refresh();
      }
    }
  }
}
```

---

## settings/defaults.ts 或 DEFAULT_SETTINGS 增量

```ts
homepage: {
  enabled: true,
  replaceEmptyTab: false,
  openOnStartup: false,
  focusSearchOnOpen: true,
  showStats: true,
  showRecentFiles: true,
  recentFileLimit: 10,
  showQuickActions: true,
  enableCreateFromSearch: true,
  defaultCreateFolder: "",
}
```

---

## main.ts 接入示例

```ts
import { HomepageModule } from "./homepage/HomepageModule";

// 在已有 module 注册列表中追加：
this.moduleManager.register(new HomepageModule(this));
```

如果你的 ModuleManager 不允许 module 构造时拿 plugin，则修改 ModuleContext，加入：

```ts
plugin: Plugin;
```

然后 HomepageModule 使用 `ctx.plugin.registerView()` 等方法。
