/**
 * ProjectConsoleView — 项目控制台视图（仪表盘风格）
 */

import { FileView, type WorkspaceLeaf, type App, TFile, TFolder, getIcon, Modal, Setting } from "obsidian";
import type {
  ProjectConsoleData,
  ProjectConsoleTask,
  ProjectConsoleDeliverable,
  ProjectRecentFile,
  ProjectType,
} from "./types";
import { PROJECT_TYPE_COLORS } from "./types";

export const VIEW_TYPE_PROJECT_CONSOLE = "zendian-project-console";

const SVG = {
  circle: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`,
  checkCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`,
  fileText: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,
  folder: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`,
  calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`,
  trash: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`,
  clock: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  target: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  checkSquare: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>`,
  package: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`,
  fileStack: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7h-3a2 2 0 0 1-2-2V2"/><path d="M21 6v6.5c0 .8-.7 1.5-1.5 1.5h-7c-.8 0-1.5-.7-1.5-1.5v-9c0-.8.7-1.5 1.5-1.5H17Z"/><path d="M7 8v8.8c0 .3.2.6.4.8.2.2.5.4.8.4H15"/><path d="M3 12v8.8c0 .3.2.6.4.8.2.2.5.4.8.4H11"/></svg>`,
  arrowRight: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`,
} as const;

function svg(key: keyof typeof SVG): HTMLSpanElement {
  const s = createSpan({ cls: "zc-icon" });
  s.innerHTML = SVG[key];
  return s;
}

function fmtDate(d: string): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

function relTime(mtime: number): string {
  const d = Date.now() - mtime;
  const m = Math.floor(d / 60_000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  const dy = Math.floor(h / 24);
  if (dy < 7) return `${dy}天前`;
  const dt = new Date(mtime);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

// ── AddTaskModal ──────────────────────────────────────

class AddTaskModal extends Modal {
  private text = "";
  private due = "";
  private cb: (t: ProjectConsoleTask) => void;
  constructor(app: App, cb: (t: ProjectConsoleTask) => void) { super(app); this.cb = cb; }
  onOpen() {
    const c = this.contentEl;
    c.createEl("h2", { text: "添加任务" });
    new Setting(c).setName("任务内容").addText((t) => t.setPlaceholder("输入任务描述").onChange((v) => (this.text = v)));
    new Setting(c).setName("截止日期").addText((t) => t.setPlaceholder("YYYY-MM-DD（可选）").onChange((v) => (this.due = v)));
    new Setting(c).addButton((b) => b.setButtonText("添加").setCta().onClick(() => {
      const v = this.text.trim(); if (!v) return;
      this.cb({ text: v, completed: false, created: new Date().toISOString().slice(0, 10), due: this.due.trim() || undefined });
      this.close();
    }));
    setTimeout(() => { const i = c.querySelector("input[type=text]") as HTMLInputElement; i?.focus(); }, 50);
  }
  onClose() { this.contentEl.empty(); }
}

// ── 主视图 ──────────────────────────────────────────

export class ProjectConsoleView extends FileView {
  private data: ProjectConsoleData | null = null;
  private projPath = "";
  private tab: "tasks" | "deliverables" | "recent" = "tasks";

  constructor(l: WorkspaceLeaf) { super(l); }
  getViewType() { return VIEW_TYPE_PROJECT_CONSOLE; }
  getDisplayText() { return this.data?.name || "项目控制台"; }
  getIcon() { return "layout-dashboard"; }
  getExtension() { return "home"; }

  async onLoadFile(file: TFile) {
    const p = file.path.split("/");
    this.projPath = p.slice(0, -2).join("/");
    await this.load();
    this.render();
  }

  async onUnloadFile() {
    const c = this.containerEl.children[1];
    if (c) { c.empty(); c.removeClass("zc-root"); }
    this.data = null;
  }

  async onOpen() {
    // onLoadFile 可能先于 onOpen 执行，此时 children[1] 不存在
    // onOpen 时 DOM 一定就绪，补渲染
    if (this.data) this.render();
  }

  // ── 数据 ──────────────────────────────────────────

  private async load() {
    const f = this.file;
    if (!(f instanceof TFile)) return;
    try { this.data = JSON.parse(await this.app.vault.read(f)); } catch { this.data = null; }
  }

  private recent(limit: number): ProjectRecentFile[] {
    const folder = this.app.vault.getAbstractFileByPath(this.projPath);
    if (!(folder instanceof TFolder)) return [];

    // 检测 Obsidian 的 "Detect all file extensions" 设置
    const detectAll = (this.app.vault as any).getConfig?.("detectAllFiles") === true;

    const fs: ProjectRecentFile[] = [];
    const walk = (d: TFolder) => {
      for (const c of d.children) {
        if (c instanceof TFile) {
          // 跳过 .home 文件本身
          if (c.extension === "home") continue;
          // 如果未开启 detectAllFiles，只显示 Obsidian 可识别的文件
          if (!detectAll && !this.app.vault.getFileByPath(c.path)) continue;
          fs.push({ name: c.basename, path: c.path, mtime: c.stat.mtime });
        } else if (c instanceof TFolder) {
          walk(c);
        }
      }
    };
    walk(folder);
    return fs.sort((a, b) => b.mtime - a.mtime).slice(0, limit);
  }

  private progress() {
    if (!this.data) return { done: 0, total: 0, pct: 0 };
    const t = this.data.tasks, total = t.length, done = t.filter((x) => x.completed).length;
    return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }

  // ── 渲染 ──────────────────────────────────────────

  private render() {
    const c = this.containerEl.children[1];
    if (!c) return;
    c.empty();
    c.addClass("zc-root");

    if (!this.data) {
      c.createDiv({ cls: "zc-error", text: "无法解析 .home 文件内容，请检查 JSON 格式" });
      return;
    }

    try {
      // 呼吸背景层
      c.createDiv({ cls: "zc-breath-bg" });
      const w = c.createDiv({ cls: "zc-wrapper" });
      this.hero(w);
      this.stats(w);
      this.tabsArea(w);
      this.actions(w);
    } catch (e) {
      console.error("[ZENdian] 控制台渲染失败:", e);
      c.createDiv({ cls: "zc-error", text: `渲染出错: ${e}` });
    }
  }

  /** Hero 区域 */
  private hero(p: HTMLElement) {
    const d = this.data!;
    const color = PROJECT_TYPE_COLORS[d.type as ProjectType] || "#3b82f6";
    const sec = p.createDiv({ cls: "zc-hero" });

    // 图标
    const icon = sec.createDiv({ cls: "zc-hero-icon" });
    this.renderIcon(icon, d.icon);

    // 文字
    const info = sec.createDiv({ cls: "zc-hero-info" });
    info.createEl("h1", { cls: "zc-hero-title", text: d.name });
    const meta = info.createDiv({ cls: "zc-hero-meta" });
    meta.createSpan({ cls: "zc-hero-tag", text: d.type || "未分类", attr: { style: `--tag-color:${color}` } });
    if (d.createdAt) {
      const s = meta.createSpan({ cls: "zc-hero-date" });
      s.appendChild(svg("calendar"));
      s.createSpan({ text: fmtDate(d.createdAt) });
    }
    // 简介（可编辑）
    const descEl = info.createDiv({ cls: "zc-hero-desc" });
    if (d.description) {
      descEl.createSpan({ cls: "zc-hero-desc-text", text: d.description });
    } else {
      descEl.createSpan({ cls: "zc-hero-desc-placeholder", text: "点击添加项目简介..." });
    }
    const editBtn = descEl.createSpan({ cls: "zc-hero-desc-edit" });
    editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;
    descEl.addEventListener("click", () => this.editDescription(descEl));
  }

  /** 编辑简介 */
  private editDescription(container: HTMLElement) {
    const d = this.data!;
    container.empty();
    const input = container.createEl("input", {
      cls: "zc-hero-desc-input",
      attr: { type: "text", placeholder: "输入项目简介...", value: d.description || "" },
    });
    input.focus();
    input.select();

    const save = async () => {
      d.description = input.value.trim();
      await this.save();
      this.render();
    };

    input.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); if (e.key === "Escape") this.render(); });
    input.addEventListener("blur", save);
  }

  /** 统计卡片行 */
  private stats(p: HTMLElement) {
    const { done, total, pct } = this.progress();
    const files = this.recent(999).length;
    const delivers = this.data!.deliverables.length;
    const row = p.createDiv({ cls: "zc-stats" });

    const cards: [string, string, string, keyof typeof SVG][] = [
      [`${pct}%`, "完成度", `已完成 ${done}/${total} 项任务`, "target"],
      [String(total), "任务", `${done} 已完成`, "checkSquare"],
      [String(delivers), "交付物", delivers > 0 ? `${delivers} 项产出` : "暂无", "package"],
      [String(files), "文件", `项目内共 ${files} 个文件`, "fileStack"],
    ];

    for (const [val, label, sub, iconKey] of cards) {
      const card = row.createDiv({ cls: "zc-stat-card" });
      const iconEl = card.createDiv({ cls: "zc-stat-icon" });
      iconEl.appendChild(svg(iconKey));
      const body = card.createDiv({ cls: "zc-stat-body" });
      body.createDiv({ cls: "zc-stat-value", text: val });
      body.createDiv({ cls: "zc-stat-label", text: label });
      card.createDiv({ cls: "zc-stat-sub", text: sub });
    }
  }

  /** Tab 区域 */
  private tabsArea(p: HTMLElement) {
    const section = p.createDiv({ cls: "zc-section" });

    // Tab 栏
    const tabBar = section.createDiv({ cls: "zc-tabs" });
    const defs: [typeof this.tab, string][] = [["tasks", "任务"], ["deliverables", "交付物"], ["recent", "最近文件"]];
    for (const [key, label] of defs) {
      const btn = tabBar.createDiv({ cls: `zc-tab${this.tab === key ? " is-active" : ""}`, text: label });
      btn.addEventListener("click", () => {
        this.tab = key;
        tabBar.querySelectorAll(".zc-tab").forEach((e) => e.removeClass("is-active"));
        btn.addClass("is-active");
        const body = section.querySelector(".zc-section-body");
        if (body) { body.empty(); this.tabBody(body as HTMLElement); }
      });
    }

    const body = section.createDiv({ cls: "zc-section-body" });
    this.tabBody(body);
  }

  private tabBody(c: HTMLElement) {
    if (this.tab === "tasks") this.tasks(c);
    else if (this.tab === "deliverables") this.deliverables(c);
    else this.files(c);
  }

  /** 任务列表 */
  private tasks(c: HTMLElement) {
    const d = this.data!;
    const scroll = c.createDiv({ cls: "zc-scroll" });
    const list = scroll.createDiv({ cls: "zc-list" });

    if (!d.tasks.length) {
      const e = list.createDiv({ cls: "zc-empty" });
      e.createDiv({ cls: "zc-empty-icon" }).innerHTML = SVG.checkSquare;
      e.createDiv({ cls: "zc-empty-title", text: "暂无任务" });
      e.createDiv({ cls: "zc-empty-sub", text: "添加第一个任务开始追踪进度" });
    }

    const pending = d.tasks.map((t, i) => ({ t, i })).filter((x) => !x.t.completed);
    const done = d.tasks.map((t, i) => ({ t, i })).filter((x) => x.t.completed);

    for (const { t, i } of pending) this.taskRow(list, t, i);
    if (done.length && pending.length) list.createDiv({ cls: "zc-divider" });
    for (const { t, i } of done) this.taskRow(list, t, i);

    // 添加按钮固定在底部
    const add = c.createDiv({ cls: "zc-add-btn" });
    add.appendChild(svg("plus"));
    add.createSpan({ text: "添加任务" });
    add.addEventListener("click", () => new AddTaskModal(this.app, async (task) => { d.tasks.push(task); await this.save(); this.render(); }).open());
  }

  private taskRow(p: HTMLElement, t: ProjectConsoleTask, i: number) {
    const row = p.createDiv({ cls: `zc-row${t.completed ? " is-done" : ""}` });
    const ck = row.createDiv({ cls: "zc-check" });
    ck.innerHTML = t.completed ? SVG.checkCircle : SVG.circle;
    ck.addEventListener("click", async () => { this.data!.tasks[i].completed = !t.completed; await this.save(); this.render(); });
    row.createSpan({ cls: "zc-row-text", text: t.text });
    if (t.due) {
      const d = row.createSpan({ cls: "zc-due" });
      d.appendChild(svg("clock"));
      d.createSpan({ text: t.due });
    }
    const del = row.createDiv({ cls: "zc-del" });
    del.innerHTML = SVG.trash;
    del.addEventListener("click", async () => { this.data!.tasks.splice(i, 1); await this.save(); this.render(); });
  }

  /** 交付物 */
  private deliverables(c: HTMLElement) {
    const d = this.data!;
    const scroll = c.createDiv({ cls: "zc-scroll" });
    const list = scroll.createDiv({ cls: "zc-list" });
    if (!d.deliverables.length) {
      const e = list.createDiv({ cls: "zc-empty" });
      e.createDiv({ cls: "zc-empty-icon" }).innerHTML = SVG.package;
      e.createDiv({ cls: "zc-empty-title", text: "暂无交付物" });
      e.createDiv({ cls: "zc-empty-sub", text: "在 .home 文件中添加 deliverables 数组" });
      return;
    }
    const S: Record<string, string> = { pending: "待开始", "in-progress": "进行中", done: "已完成" };
    for (const item of d.deliverables) {
      const row = list.createDiv({ cls: "zc-row zc-clickable" });
      const ic = row.createDiv({ cls: "zc-row-icon" });
      ic.innerHTML = SVG.fileText;
      row.createSpan({ cls: "zc-row-text", text: item.name });
      const st = row.createDiv({ cls: `zc-badge zc-badge-${item.status}` });
      st.createSpan({ cls: "zc-badge-dot" });
      st.createSpan({ text: S[item.status] || item.status });
      row.addEventListener("click", () => this.openRel(item.path));
    }
  }

  /** 最近文件 */
  private files(c: HTMLElement) {
    const fs = this.recent(30);
    const scroll = c.createDiv({ cls: "zc-scroll" });
    const list = scroll.createDiv({ cls: "zc-list" });
    if (!fs.length) {
      const e = list.createDiv({ cls: "zc-empty" });
      e.createDiv({ cls: "zc-empty-icon" }).innerHTML = SVG.fileStack;
      e.createDiv({ cls: "zc-empty-title", text: "暂无文件" });
      return;
    }
    for (const f of fs) {
      const row = list.createDiv({ cls: "zc-row zc-clickable" });
      const ic = row.createDiv({ cls: "zc-row-icon" });
      ic.innerHTML = SVG.fileText;
      const wrap = row.createDiv({ cls: "zc-row-main" });
      wrap.createSpan({ cls: "zc-row-text", text: f.name });
      const folder = f.path.split("/").slice(-2, -1)[0] || "";
      if (folder) wrap.createSpan({ cls: "zc-row-sub", text: folder });
      row.createSpan({ cls: "zc-row-time", text: relTime(f.mtime) });
      row.addEventListener("click", () => this.openRel(f.path));
    }
  }

  /** 底部快捷操作 */
  private actions(p: HTMLElement) {
    const grid = p.createDiv({ cls: "zc-grid" });
    const map: [string, string][] = [["10 笔记流", "笔记流"], ["20 工作区", "工作区"], ["30 交付物", "交付物"], ["90 资源库", "资源库"]];
    for (const [folder, label] of map) {
      const path = `${this.projPath}/${folder}`;
      if (!(this.app.vault.getAbstractFileByPath(path) instanceof TFolder)) continue;
      const card = grid.createDiv({ cls: "zc-grid-card" });
      const ic = card.createDiv({ cls: "zc-grid-icon" });
      ic.innerHTML = SVG.folder;
      card.createDiv({ cls: "zc-grid-label", text: label });
      const arrow = card.createDiv({ cls: "zc-grid-arrow" });
      arrow.innerHTML = SVG.arrowRight;
      card.addEventListener("click", () => this.openFolder(path));
    }
  }

  // ── 工具 ──────────────────────────────────────────

  private async save() {
    if (!this.data) return;
    const f = this.file;
    if (f instanceof TFile) await this.app.vault.modify(f, JSON.stringify(this.data, null, 2));
  }

  private async openRel(rel: string) {
    const full = rel.includes("/") ? rel : `${this.projPath}/${rel}`;
    const f = this.app.vault.getAbstractFileByPath(full);
    if (f instanceof TFile) await this.app.workspace.getLeaf(false).openFile(f);
  }

  private async openFolder(path: string) {
    const folder = this.app.vault.getAbstractFileByPath(path);
    if (!(folder instanceof TFolder)) return;
    const fe = (this.app as any).internalPlugins?.getPluginById?.("file-explorer");
    const first = this.first(folder);
    if (fe?.instance?.revealInFolder && first) fe.instance.revealInFolder(first);
  }

  private first(d: TFolder): TFile | null {
    for (const c of d.children) { if (c instanceof TFile) return c; if (c instanceof TFolder) { const f = this.first(c); if (f) return f; } }
    return null;
  }

  private renderIcon(el: HTMLElement, id: string) {
    if (id?.startsWith("lucide-")) { const s = getIcon(id.slice(7)); if (s) { el.innerHTML = ""; el.appendChild(s); return; } }
    el.innerHTML = SVG.folder;
  }
}

export function createDefaultConsoleData(name: string, icon: string, type: ProjectType, desc = ""): ProjectConsoleData {
  return { name, icon, description: desc, type, createdAt: new Date().toISOString().slice(0, 10), tasks: [], deliverables: [] };
}
