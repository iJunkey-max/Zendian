/**
 * 图标选择器弹窗
 * 继承 Modal，手动构建搜索栏 + CSS Grid 图标网格
 */

import { App, Modal, getIcon } from "obsidian";

const STYLE_ID = "zendian-icon-picker-style";

/** Obsidian 内置 Lucide 图标子集（常用文件/文件夹相关） */
const LUCIDE_ICON_IDS = [
  "file", "file-text", "file-code", "file-plus", "file-minus", "file-search",
  "file-check", "file-x", "file-clock", "file-heart", "file-key", "file-lock",
  "file-output", "file-input", "file-spreadsheet", "file-badge", "file-axis-3d",
  "file-box", "file-chart", "file-cog", "file-diff", "file-digit", "file-down",
  "file-edit", "file-warning",
  "folder", "folder-open", "folder-plus", "folder-minus", "folder-check",
  "folder-clock", "folder-closed", "folder-cog", "folder-heart", "folder-key",
  "folder-lock", "folder-search", "folder-tree", "folder-up",
  "image", "film", "music", "headphones", "video", "camera",
  "pen-tool", "palette", "brush", "eraser",
  "globe", "link", "mail", "message-square",
  "table", "layout-dashboard", "presentation",
  "archive", "package", "database", "server", "hard-drive", "disc",
  "braces", "brackets", "code", "terminal", "bug",
  "calendar", "clock", "bookmark", "tag", "hash",
  "settings", "sliders", "toggle-left", "power",
  "heart", "star", "flag", "zap", "sun", "moon",
  "lock", "shield", "key", "eye", "eye-off",
  "check", "x", "plus", "minus", "arrow-right", "arrow-left",
  "chevron-right", "chevron-left", "chevron-down", "chevron-up",
  "search", "filter", "sort-asc", "refresh-cw",
  "copy", "scissors", "clipboard", "trash", "save",
  "upload", "download", "share", "external-link",
  "home", "map", "compass", "navigation",
  "users", "user", "user-plus", "user-minus",
  "bell", "inbox", "send",
  "git-branch", "git-commit", "git-merge", "git-pull-request",
  "microscope", "beaker", "test-tubes",
];

export class IconPickerModal extends Modal {
  private libraries: string[];
  private currentLibrary: string;
  private allIcons: Map<string, string[]> = new Map();
  private onChooseCallback: (iconId: string | null) => void;
  private librarySelect: HTMLSelectElement | null = null;
  private inputEl: HTMLInputElement | null = null;
  private gridEl: HTMLDivElement | null = null;
  private svgCache = new Map<string, SVGElement>();

  constructor(app: App, libraries: string[], onChoose: (iconId: string | null) => void) {
    super(app);
    this.libraries = libraries;
    this.currentLibrary = "Lucide";
    this.onChooseCallback = onChoose;
    this.injectStyles();
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    // 顶部搜索栏：库切换下拉 + 搜索输入框
    const nav = contentEl.createDiv({ cls: "zendian-icon-picker-nav" });

    const select = nav.createEl("select", { cls: "zendian-icon-picker-select" });
    select.createEl("option", { value: "Lucide", text: "Lucide" });
    for (const lib of this.libraries) {
      if (lib === "Lucide") continue;
      select.createEl("option", { value: lib, text: lib });
    }
    select.value = this.currentLibrary;
    this.librarySelect = select;

    const input = nav.createEl("input", {
      cls: "zendian-icon-picker-input",
      type: "text",
      attr: { placeholder: "搜索图标..." },
    });
    this.inputEl = input;

    const resetBtn = nav.createEl("button", {
      text: "恢复默认",
      cls: "zendian-icon-picker-reset-btn",
    });
    resetBtn.addEventListener("click", () => {
      this.onChooseCallback(null);
      this.close();
    });

    // 网格容器
    const grid = contentEl.createDiv({ cls: "zendian-icon-picker-grid" });
    this.gridEl = grid;

    // 事件绑定
    select.addEventListener("change", () => {
      this.currentLibrary = select.value;
      this.loadLibraryIcons(select.value).then(() => this.renderGrid());
    });

    input.addEventListener("input", () => {
      this.renderGrid();
    });

    // 初始加载
    this.loadLibraryIcons("Lucide").then(() => this.renderGrid());

    // 自动聚焦搜索框
    setTimeout(() => input.focus(), 50);
  }

  onClose(): void {
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
  }

  /** 加载指定库的图标列表到缓存 */
  private async loadLibraryIcons(library: string): Promise<void> {
    if (this.allIcons.has(library)) return;

    if (library === "Lucide") {
      this.allIcons.set("Lucide", [...LUCIDE_ICON_IDS]);
      return;
    }

    try {
      const dirPath = `.obsidian/plugins/zendian/icons/${library}`;
      const listing = await (this.app as any).vault.adapter.list(dirPath);
      const names = (listing.files as string[])
        .filter((f: string) => f.endsWith(".svg"))
        .map((f: string) => {
          const parts = f.split("/");
          return parts[parts.length - 1].replace(".svg", "");
        });
      this.allIcons.set(library, names);
    } catch {
      this.allIcons.set(library, []);
    }
  }

  /** 根据搜索词过滤并渲染网格 */
  private renderGrid(): void {
    if (!this.gridEl) return;

    const query = this.inputEl?.value?.trim().toLowerCase() ?? "";
    const icons = this.allIcons.get(this.currentLibrary) ?? [];
    const filtered = query
      ? icons.filter((name) => name.toLowerCase().includes(query))
      : icons;

    this.gridEl.empty();

    for (const iconName of filtered) {
      const item = this.gridEl.createDiv({ cls: "zendian-icon-picker-item" });

      if (this.currentLibrary === "Lucide") {
        const svg = getIcon(iconName);
        if (svg) {
          svg.classList.add("zendian-icon-picker-svg");
          item.appendChild(svg);
        }
      } else {
        // 第三方库：先显示文字占位，异步加载 SVG
        const wrapper = item.createDiv({
          cls: "zendian-icon-picker-svg",
          text: iconName.substring(0, 2).toUpperCase(),
        });
        wrapper.style.cssText = "display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:var(--text-muted)";

        this.loadLibrarySvg(this.currentLibrary, iconName).then((svg) => {
          if (svg) {
            wrapper.textContent = "";
            wrapper.style.cssText = "";
            svg.classList.add("zendian-icon-picker-svg");
            wrapper.appendChild(svg);
          }
        });
      }

      const label = item.createSpan({
        cls: "zendian-icon-picker-label",
        text: iconName,
      });

      item.addEventListener("click", () => {
        const iconId = this.currentLibrary === "Lucide"
          ? `lucide-${iconName}`
          : `${this.currentLibrary}/${iconName}`;
        this.onChooseCallback(iconId);
        this.close();
      });
    }

    if (filtered.length === 0) {
      this.gridEl.createDiv({
        cls: "zendian-icon-picker-empty",
        text: "未找到匹配的图标",
      });
    }
  }

  /** 异步加载第三方库 SVG（带缓存） */
  private async loadLibrarySvg(library: string, icon: string): Promise<SVGElement | null> {
    const key = `${library}/${icon}`;
    if (this.svgCache.has(key)) return this.svgCache.get(key)!.cloneNode(true) as SVGElement;

    try {
      const path = `.obsidian/plugins/zendian/icons/${library}/${icon}.svg`;
      const text = await (this.app as any).vault.adapter.read(path);
      const doc = new DOMParser().parseFromString(text, "image/svg+xml");
      const svg = doc.querySelector("svg");
      if (svg) {
        svg.removeAttribute("width");
        svg.removeAttribute("height");
        this.svgCache.set(key, svg.cloneNode(true) as SVGElement);
        return svg;
      }
    } catch {
      // ignore
    }
    return null;
  }

  /** 注入弹窗样式 */
  private injectStyles(): void {
    if (document.getElementById(STYLE_ID)) return;

    const css = [
      ".zendian-icon-picker-nav {",
      "  display: flex;",
      "  align-items: center;",
      "  gap: 10px;",
      "  padding: 8px 12px;",
      "  border-bottom: 1px solid var(--background-modifier-border);",
      "}",
      ".zendian-icon-picker-select {",
      "  width: 120px;",
      "  flex-shrink: 0;",
      "  padding: 6px 10px;",
      "  border-radius: 6px;",
      "  border: 1px solid var(--background-modifier-border);",
      "  background: var(--background-primary);",
      "  color: var(--text-normal);",
      "  font-size: 13px;",
      "  cursor: pointer;",
      "}",
      ".zendian-icon-picker-input {",
      "  flex: 1;",
      "  min-width: 0;",
      "  padding: 6px 10px;",
      "  border-radius: 6px;",
      "  border: 1px solid var(--background-modifier-border);",
      "  background: var(--background-primary);",
      "  color: var(--text-normal);",
      "  font-size: 13px;",
      "  outline: none;",
      "}",
      ".zendian-icon-picker-input:focus {",
      "  border-color: var(--interactive-accent);",
      "}",
      ".zendian-icon-picker-grid {",
      "  display: grid;",
      "  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));",
      "  gap: 8px;",
      "  padding: 12px;",
      "  max-height: 50vh;",
      "  overflow-y: auto;",
      "}",
      ".zendian-icon-picker-item {",
      "  display: flex;",
      "  flex-direction: column;",
      "  align-items: center;",
      "  justify-content: center;",
      "  gap: 4px;",
      "  padding: 8px 4px;",
      "  border-radius: 6px;",
      "  cursor: pointer;",
      "  min-height: 64px;",
      "  text-align: center;",
      "  transition: background 0.15s ease;",
      "}",
      ".zendian-icon-picker-item:hover {",
      "  background: var(--background-modifier-hover);",
      "}",
      ".zendian-icon-picker-svg {",
      "  width: 20px;",
      "  height: 20px;",
      "  color: var(--text-normal);",
      "  flex-shrink: 0;",
      "}",
      ".zendian-icon-picker-label {",
      "  font-size: 10px;",
      "  color: var(--text-muted);",
      "  overflow: hidden;",
      "  text-overflow: ellipsis;",
      "  white-space: nowrap;",
      "  max-width: 100%;",
      "}",
      ".zendian-icon-picker-empty {",
      "  grid-column: 1 / -1;",
      "  text-align: center;",
      "  padding: 24px;",
      "  color: var(--text-muted);",
      "  font-size: 13px;",
      "}",
      ".zendian-icon-picker-reset-btn {",
      "  flex-shrink: 0;",
      "  padding: 6px 12px;",
      "  border-radius: 6px;",
      "  border: 1px solid var(--background-modifier-border);",
      "  background: var(--background-secondary);",
      "  color: var(--text-muted);",
      "  font-size: 12px;",
      "  cursor: pointer;",
      "  white-space: nowrap;",
      "}",
      ".zendian-icon-picker-reset-btn:hover {",
      "  color: var(--text-normal);",
      "  background: var(--background-modifier-hover);",
      "}",
    ].join("\n");

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }
}
