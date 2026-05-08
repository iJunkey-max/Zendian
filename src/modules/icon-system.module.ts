/**
 * 图标系统模块
 * 数据驱动的动态文件树图标：内置 Lucide + 支持第三方图标库
 */

import { getIcon, requestUrl } from "obsidian";
import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { IconPickerModal } from "../ui/icon-picker-modal";

const STYLE_ID = "zendian-icon-system";
const EXPLORER = '.workspace-leaf-content[data-type="file-explorer"]';
const PLUGIN_DIR = ".obsidian/plugins/zendian";

// ─── 预置图标库注册表 ───

export interface IconLibraryEntry {
  name: string;
  label: string;
  downloadUrl: string;
}

export const BUILTIN_LIBRARIES: IconLibraryEntry[] = [
  {
    name: "boxicons",
    label: "Boxicons",
    downloadUrl: "https://github.com/atisawd/boxicons/archive/refs/heads/master.zip",
  },
  {
    name: "coolicons",
    label: "Coolicons",
    downloadUrl: "https://github.com/krystonschwarze/coolicons/archive/refs/heads/master.zip",
  },
  {
    name: "tabler-icons",
    label: "Tabler Icons",
    downloadUrl: "https://github.com/tabler/tabler-icons/archive/refs/heads/main.zip",
  },
];

export class IconSystemModule implements IFeatureModule {
  readonly id = "icon-system";
  readonly name = "图标系统";

  private styleEl: HTMLStyleElement | null = null;
  private observer: MutationObserver | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private enabled = false;
  private customEnabled = false;
  private tabIconsEnabled = false;
  private compiledRules: { regex: RegExp; iconId: string; color?: string }[] = [];
  private customIcons: Record<string, string> = {};
  private installedLibraries: string[] = [];
  private ctx!: ModuleContext;
  private eventRefs: Array<() => void> = [];

  /** SVG 缓存：iconId → SVG 元素，避免重复解析 */
  private svgCache = new Map<string, SVGElement>();

  async load(ctx: ModuleContext): Promise<void> {
    this.ctx = ctx;
    this.syncSettings(ctx.getSettings().iconSystem);
    this.apply();
    this.registerFileMenu();
    if (this.tabIconsEnabled) {
      this.registerTabIconEvents();
    }
  }

  unload(): void {
    this.removeStyle();
    this.disconnectObserver();
    this.stopPolling();
    this.removeAllIcons();
    this.removeAllTabIcons();
    this.svgCache.clear();
    this.unregisterEvents();
  }

  onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
    if (changedKeys.includes("iconSystem")) {
      this.syncSettings(settings.iconSystem);
      this.apply();
    }
  }

  // ─── 公开 API：库管理 ───

  /** 安装指定预置图标库 */
  async installLibrary(name: string): Promise<void> {
    const entry = BUILTIN_LIBRARIES.find((l) => l.name === name);
    if (!entry) return;
    if (this.installedLibraries.includes(name)) return;

    try {
      const resp = await requestUrl({ url: entry.downloadUrl });
      const arrayBuffer = resp.arrayBuffer;
      await this.extractZipToIcons(name, arrayBuffer);
      this.installedLibraries = [...this.installedLibraries, name];
      await this.ctx.updateSettings({
        iconSystem: { ...this.ctx.getSettings().iconSystem, installedLibraries: this.installedLibraries },
      });
    } catch (err) {
      console.error(`[ZENdian] Failed to install icon library "${name}":`, err);
      throw err;
    }
  }

  /** 卸载指定图标库 */
  async uninstallLibrary(name: string): Promise<void> {
    if (!this.installedLibraries.includes(name)) return;

    try {
      const dirPath = `${PLUGIN_DIR}/icons/${name}`;
      await this.removeDirectory(dirPath);
    } catch {
      // 目录可能不存在，忽略
    }

    // 清除引用该库的 customIcons
    const prefix = `${name}/`;
    const newCustomIcons = { ...this.customIcons };
    for (const [path, iconId] of Object.entries(newCustomIcons)) {
      if (iconId.startsWith(prefix)) delete newCustomIcons[path];
    }

    this.installedLibraries = this.installedLibraries.filter((l) => l !== name);
    this.customIcons = newCustomIcons;

    await this.ctx.updateSettings({
      iconSystem: {
        ...this.ctx.getSettings().iconSystem,
        installedLibraries: this.installedLibraries,
        customIcons: this.customIcons,
      },
    });

    // 清除该库的图标 DOM 并重新渲染
    this.removeIconsByLibrary(name);
    this.svgCache.clear();
    this.scanAndApply();
  }

  /** 检查某库是否已安装 */
  isLibraryInstalled(name: string): boolean {
    return this.installedLibraries.includes(name);
  }

  // ─── 内部：设置同步 ───

  private syncSettings(s: PluginSettings["iconSystem"]): void {
    this.enabled = s.enabled;
    this.customEnabled = s.customEnabled;
    this.tabIconsEnabled = s.tabIconsEnabled;
    this.customIcons = { ...s.customIcons };
    this.installedLibraries = [...s.installedLibraries];
    this.compiledRules = s.defaultRules.map((r) => ({
      regex: new RegExp(r.regex, "i"),
      iconId: r.iconId,
      color: r.color,
    }));
  }

  // ─── 内部：生命周期 ───

  private apply(): void {
    if (this.enabled) {
      this.injectStyle();
      this.connectObserver();
      if (this.tabIconsEnabled) {
        this.applyTabIcons();
      } else {
        this.removeAllTabIcons();
      }
    } else {
      this.removeStyle();
      this.disconnectObserver();
      this.stopPolling();
      this.removeAllIcons();
      this.removeAllTabIcons();
    }
  }

  private injectStyle(): void {
    this.removeStyle();
    const css = [
      `${EXPLORER} .tree-item-icon.collapse-icon,`,
      `${EXPLORER} .nav-folder-collapse-indicator {`,
      "  display: none !important;",
      "}",
      `${EXPLORER} .nav-folder-title,`,
      `${EXPLORER} .nav-file-title {`,
      "  padding-left: 0 !important;",
      "  padding-inline-start: 0 !important;",
      "}",
      `${EXPLORER} .nav-folder-title-content {`,
      "  margin-left: 0 !important;",
      "}",
      `${EXPLORER} .nav-file-title-content,`,
      `${EXPLORER} .nav-folder-title-content {`,
      "  display: inline-flex;",
      "  align-items: center;",
      "  gap: 4px;",
      "}",
      ".zendian-icon {",
      "  display: inline-flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  width: 16px;",
      "  height: 16px;",
      "  flex-shrink: 0;",
      "  margin-right: 6px;",
      "  margin-left: 2px;",
      "}",
      ".zendian-icon svg {",
      "  width: 16px;",
      "  height: 16px;",
      "}",
      ".mod-root .workspace-tab-header .workspace-tab-header-inner-icon > svg:not(.zendian-injected-svg) {",
      "  display: none !important;",
      "}",
      ".mod-root .workspace-tab-header .workspace-tab-header-inner-icon .zendian-tab-icon svg {",
      "  display: block !important;",
      "}",
      ".zendian-tab-icon {",
      "  display: flex;",
      "  align-items: center;",
      "  margin-right: 6px;",
      "}",
    ].join("\n");

    this.styleEl = document.createElement("style");
    this.styleEl.id = STYLE_ID;
    this.styleEl.textContent = css;
    document.head.appendChild(this.styleEl);
  }

  private removeStyle(): void {
    if (this.styleEl) {
      this.styleEl.remove();
      this.styleEl = null;
    }
  }

  // ─── 内部：右键菜单 ───

  private registerFileMenu(): void {
    const ref = this.ctx.app.workspace.on("file-menu", (menu, file) => {
      if (!this.enabled || !this.customEnabled) return;
      if (!("path" in file)) return;

      const filePath = (file as any).path as string;

      menu.addItem((item) => {
        item
          .setTitle("自定义图标")
          .setIcon("image")
          .onClick(() => {
            const libraries = ["Lucide", ...this.installedLibraries];
            new IconPickerModal(this.ctx.app, libraries, async (iconId) => {
              if (iconId === null) {
                delete this.customIcons[filePath];
              } else {
                this.customIcons[filePath] = iconId;
              }
              await this.ctx.updateSettings({
                iconSystem: { ...this.ctx.getSettings().iconSystem, customIcons: this.customIcons },
              });
              this.refreshIcon(filePath);
            }).open();
          });
      });
    });
    this.eventRefs.push(() => this.ctx.app.workspace.offref(ref));
  }

  private unregisterEvents(): void {
    for (const fn of this.eventRefs) fn();
    this.eventRefs = [];
  }

  // ─── 内部：标签页图标 ───

  private registerTabIconEvents(): void {
    const ref1 = this.ctx.app.workspace.on("layout-change", () => this.applyTabIcons());
    this.eventRefs.push(() => this.ctx.app.workspace.offref(ref1));

    const ref2 = this.ctx.app.workspace.on("file-open", () => this.applyTabIcons());
    this.eventRefs.push(() => this.ctx.app.workspace.offref(ref2));
  }

  private async applyTabIcons(): Promise<void> {
    if (!this.tabIconsEnabled) return;

    const leaves = this.ctx.app.workspace.getLeavesOfType("markdown");
    for (const leaf of leaves) {
      const file = (leaf.view as any).file;
      if (!file) continue;

      const inner = (leaf as any).tabHeaderEl?.querySelector(
        ".workspace-tab-header-inner"
      ) as HTMLElement | undefined;
      if (!inner) continue;

      inner.querySelector(".zendian-tab-icon")?.remove();

      const iconId = this.matchIcon(file.path) ?? "lucide-file-text";
      const svg = await this.renderIcon(iconId);
      if (!svg) continue;

      const wrapper = document.createElement("div");
      wrapper.className = "zendian-tab-icon zendian-injected-svg";
      wrapper.appendChild(svg);

      const title = inner.querySelector(".workspace-tab-header-inner-title");
      if (title) {
        inner.insertBefore(wrapper, title);
      } else {
        inner.appendChild(wrapper);
      }
    }
  }

  private removeAllTabIcons(): void {
    const icons = document.querySelectorAll(".zendian-tab-icon");
    for (const icon of icons) {
      icon.remove();
    }
  }

  // ─── 内部：DOM 操作 ───

  /** 刷新指定路径的图标（移除旧的，重新应用） */
  private refreshIcon(path: string): void {
    const titleEl = document.querySelector(
      `${EXPLORER} [data-path="${CSS.escape(path)}"]`
    ) as HTMLElement | null;
    if (!titleEl) return;

    const old = titleEl.querySelector(".zendian-icon");
    if (old) old.remove();

    this.applyIcon(titleEl);
  }

  /** 移除使用指定库图标的 DOM 元素 */
  private removeIconsByLibrary(library: string): void {
    const prefix = `${library}/`;
    const icons = document.querySelectorAll(".zendian-icon");
    for (const icon of icons) {
      const titleEl = icon.closest("[data-path]");
      if (!titleEl) continue;
      const path = titleEl.getAttribute("data-path");
      if (path && this.customIcons[path]?.startsWith(prefix)) {
        icon.remove();
      }
    }
  }

  // ─── 内部：ZIP 解压 ───

  /**
   * 将 zip 中的 SVG 文件解压到 icons/<library>/ 目录
   * 使用浏览器原生 DecompressionStream 不可行（zip 不是 gzip），
   * 这里实现最小化 zip 解压器（仅支持无压缩 STORED 和 Deflate）
   */
  private async extractZipToIcons(libraryName: string, buffer: ArrayBuffer): Promise<void> {
    const data = new Uint8Array(buffer);
    const adapter = this.ctx.app.vault.adapter;

    // 确保目录存在
    const dirPath = `${PLUGIN_DIR}/icons/${libraryName}`;
    try { await adapter.mkdir(dirPath); } catch { /* 可能已存在 */ }

    // 解析 zip 中央目录
    const entries = await this.parseZipEntries(data);

    for (const entry of entries) {
      // 只处理 .svg 文件，跳过目录
      if (!entry.name.endsWith(".svg") || entry.isDirectory) continue;

      // 取最后一级文件名，忽略 zip 内的子目录结构
      const parts = entry.name.split("/");
      const fileName = parts[parts.length - 1];
      if (!fileName) continue;

      const svgData = entry.data;
      const svgText = new TextDecoder().decode(svgData);
      const filePath = `${dirPath}/${fileName}`;

      try {
        await adapter.write(filePath, svgText);
      } catch (err) {
        console.warn(`[ZENdian] Failed to write ${filePath}:`, err);
      }
    }
  }

  /** 最小化 zip 条目解析器（支持 STORED 和 Deflate） */
  private async parseZipEntries(data: Uint8Array): Promise<Array<{ name: string; data: Uint8Array; isDirectory: boolean }>> {
    const entries: Array<{ name: string; data: Uint8Array; isDirectory: boolean }> = [];
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    // 查找中央目录结束记录 (EOCD)
    let eocdOffset = data.length - 22;
    while (eocdOffset >= 0 && view.getUint32(eocdOffset, true) !== 0x06054b50) {
      eocdOffset--;
    }
    if (eocdOffset < 0) return entries;

    const centralDirOffset = view.getUint32(eocdOffset + 16, true);
    const numEntries = view.getUint16(eocdOffset + 10, true);

    let offset = centralDirOffset;
    for (let i = 0; i < numEntries; i++) {
      if (view.getUint32(offset, true) !== 0x02014b50) break;

      const compressionMethod = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const uncompressedSize = view.getUint32(offset + 24, true);
      const nameLen = view.getUint16(offset + 28, true);
      const extraLen = view.getUint16(offset + 30, true);
      const commentLen = view.getUint16(offset + 32, true);
      const localHeaderOffset = view.getUint32(offset + 42, true);

      const nameBytes = data.slice(offset + 46, offset + 46 + nameLen);
      const name = new TextDecoder().decode(nameBytes);
      const isDirectory = name.endsWith("/");

      // 读取本地文件头获取实际数据偏移
      const localNameLen = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataOffset = localHeaderOffset + 30 + localNameLen + localExtraLen;

      let fileData: Uint8Array;
      if (compressionMethod === 0) {
        // STORED（无压缩）
        fileData = data.slice(dataOffset, dataOffset + uncompressedSize);
      } else if (compressionMethod === 8) {
        // Deflate — 使用 DecompressionStream
        const compressed = data.slice(dataOffset, dataOffset + compressedSize);
        try {
          const ds = new DecompressionStream("deflate-raw");
          const writer = ds.writable.getWriter();
          writer.write(compressed);
          writer.close();
          const reader = ds.readable.getReader();
          const chunks: Uint8Array[] = [];
          let totalLen = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            totalLen += value.length;
          }
          fileData = new Uint8Array(totalLen);
          let pos = 0;
          for (const chunk of chunks) {
            fileData.set(chunk, pos);
            pos += chunk.length;
          }
        } catch {
          offset += 46 + nameLen + extraLen + commentLen;
          continue;
        }
      } else {
        offset += 46 + nameLen + extraLen + commentLen;
        continue;
      }

      entries.push({ name, data: fileData, isDirectory });
      offset += 46 + nameLen + extraLen + commentLen;
    }

    return entries;
  }

  /** 递归删除目录 */
  private async removeDirectory(path: string): Promise<void> {
    const adapter = this.ctx.app.vault.adapter as any;
    try {
      const listing = await adapter.list(path);
      for (const file of listing.files) {
        await adapter.remove(file);
      }
      for (const dir of listing.folders) {
        await this.removeDirectory(dir);
      }
      await adapter.rmdir(path, true);
    } catch {
      // 忽略
    }
  }

  // ─── 内部：DOM 轮询与 Observer ───

  private connectObserver(): void {
    this.disconnectObserver();
    this.stopPolling();

    const explorer = document.querySelector(EXPLORER);
    if (explorer) {
      this.mountObserver(explorer);
      this.scanAndApply();
      return;
    }

    let attempts = 0;
    this.pollTimer = setInterval(() => {
      attempts++;
      const el = document.querySelector(EXPLORER);
      if (el) {
        this.stopPolling();
        this.mountObserver(el);
        this.scanAndApply();
      } else if (attempts >= 50) {
        this.stopPolling();
      }
    }, 200);
  }

  private mountObserver(target: Element): void {
    this.disconnectObserver();
    let raf = 0;
    const handler = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (this.enabled) this.scanAndApply();
      });
    };
    this.observer = new MutationObserver(handler);
    this.observer.observe(target, { childList: true, subtree: true });
  }

  private disconnectObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  // ─── 内部：图标扫描与应用 ───

  private scanAndApply(): void {
    const titles = document.querySelectorAll(
      `${EXPLORER} .nav-file-title, ${EXPLORER} .nav-folder-title`
    );
    for (const title of titles) {
      this.applyIcon(title as HTMLElement);
    }
  }

  private applyIcon(titleEl: HTMLElement): void {
    if (titleEl.querySelector(".zendian-icon")) return;

    const path = titleEl.getAttribute("data-path");
    if (!path) return;

    let iconId = this.matchIcon(path);

    // Fallback：文件夹无后缀，正则匹配不到时使用默认文件夹图标
    if (!iconId && titleEl.classList.contains("nav-folder-title")) {
      iconId = "lucide-folder";
    }
    // Fallback：文件匹配不到时使用默认文件图标
    if (!iconId && titleEl.classList.contains("nav-file-title")) {
      iconId = "lucide-file-text";
    }
    if (!iconId) return;

    this.renderIcon(iconId).then((svg) => {
      if (!svg) return;
      if (titleEl.querySelector(".zendian-icon")) return;

      const contentEl = titleEl.querySelector(
        ".nav-file-title-content, .nav-folder-title-content"
      );
      if (!contentEl) return;

      const wrapper = document.createElement("div");
      wrapper.classList.add("zendian-icon");
      wrapper.appendChild(svg);
      titleEl.insertBefore(wrapper, contentEl);
    });
  }

  private removeAllIcons(): void {
    const icons = document.querySelectorAll(".zendian-icon");
    for (const icon of icons) {
      icon.remove();
    }
  }

  // ─── 内部：图标匹配 ───

  private matchIcon(path: string): string | null {
    if (this.customEnabled && path in this.customIcons) {
      return this.customIcons[path];
    }

    for (const rule of this.compiledRules) {
      if (rule.regex.test(path)) {
        return rule.iconId;
      }
    }

    return null;
  }

  // ─── 内部：图标渲染 ───

  private async renderIcon(iconId: string): Promise<SVGElement | null> {
    const cached = this.svgCache.get(iconId);
    if (cached) return cached.cloneNode(true) as SVGElement;

    let svg: SVGElement | null = null;

    if (iconId.startsWith("lucide-")) {
      svg = this.renderLucideIcon(iconId);
    } else {
      svg = await this.renderLibraryIcon(iconId);
    }

    if (svg) {
      this.svgCache.set(iconId, svg.cloneNode(true) as SVGElement);
    }
    return svg;
  }

  private renderLucideIcon(iconId: string): SVGElement | null {
    const name = iconId.replace("lucide-", "");
    return getIcon(name);
  }

  private async renderLibraryIcon(iconId: string): Promise<SVGElement | null> {
    const parts = iconId.split("/");
    if (parts.length !== 2) return null;

    const [library, icon] = parts;

    if (!this.installedLibraries.includes(library)) return null;
    if (library.includes("..") || icon.includes("..")) return null;

    const filePath = `${PLUGIN_DIR}/icons/${library}/${icon}.svg`;

    try {
      const svgText = await this.ctx.app.vault.adapter.read(filePath);
      return this.parseSvgString(svgText);
    } catch {
      return null;
    }
  }

  private parseSvgString(svgText: string): SVGElement | null {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return null;

    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.style.width = "100%";
    svg.style.height = "100%";

    return svg;
  }
}
