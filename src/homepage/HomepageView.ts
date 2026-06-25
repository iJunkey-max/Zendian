/**
 * HomepageView — ZENdian 主页视图
 *
 * 12列网格布局仪表盘，精确还原 demo 结构。
 * 集成各数据服务，渲染完整主页。
 */

import { ItemView, type WorkspaceLeaf, TFile } from "obsidian";
import { HomepageStatsService } from "./HomepageStatsService";
import { HomepageDataService } from "./HomepageDataService";
import { HomepageBookmarksService } from "./HomepageBookmarksService";
import { HomepageTaskService } from "./HomepageTaskService";
import { HomepageWeatherService } from "./HomepageWeatherService";
import { ProjectModal } from "./ProjectModal";
import { QuickNoteModal } from "./QuickNoteModal";
import type { HomepageProject, HomepageQuickNote, RecentNoteItem } from "./types";

export const VIEW_TYPE_HOMEPAGE = "zendian-homepage";

/** 待办 Tab 定义 */
const TODO_TABS = [
  { key: "all", label: "全部" },
  { key: "today", label: "今天" },
  { key: "week", label: "本周" },
  { key: "done", label: "已完成" },
] as const;

type TodoTabKey = (typeof TODO_TABS)[number]["key"];

export class HomepageView extends ItemView {
  private clockTimer: number | null = null;
  private statsService!: HomepageStatsService;
  private dataService!: HomepageDataService;
  private bookmarksService!: HomepageBookmarksService;
  private taskService!: HomepageTaskService;
  private weatherService!: HomepageWeatherService;
  private currentTodoTab: TodoTabKey = "all";

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_HOMEPAGE;
  }

  getDisplayText(): string {
    return "主页";
  }

  getIcon(): string {
    return "layout-dashboard";
  }

  async onOpen(): Promise<void> {
    // 初始化服务
    this.statsService = new HomepageStatsService(this.app);
    this.dataService = new HomepageDataService(this.app);
    this.bookmarksService = new HomepageBookmarksService(this.app);
    this.taskService = new HomepageTaskService(this.app);
    this.weatherService = new HomepageWeatherService();

    await this.dataService.load();

    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("zendian-homepage");

    const wrapper = container.createDiv({ cls: "homepage-wrapper" });
    wrapper.createDiv({ cls: "homepage-bg" });
    const content = wrapper.createDiv({ cls: "homepage-content" });

    // 内容容器（max-w-1240, 居中, padding）
    const main = content.createDiv({ cls: "homepage-container" });

    // ── 顶部 Header ──
    this.renderHeader(main);

    // ── 12列网格主体 ──
    const grid = main.createDiv({ cls: "homepage-grid" });

    // Row 1: 每日回顾(6) + 进行中的项目(6)
    this.renderDailyReview(grid);
    this.renderProjects(grid);

    // Row 2: 待办(4) + 便签(4) + 热力图(4)
    this.renderTodo(grid);
    this.renderStickyNotes(grid);
    this.renderHeatmap(grid);

    // Row 3: 本月数据(8) + 最近笔记(4)
    this.renderMonthlyStats(grid);
    this.renderRecentNotes(grid);

    // ── 启动 ──
    this.startClock();
    this.loadDataAsync();
    this.initAnimations();
  }

  async onClose(): Promise<void> {
    this.stopClock();
  }

  // ══════════════════════════════════════════════════════════
  // 渲染方法
  // ══════════════════════════════════════════════════════════

  // ── Header 区域 ────────────────────────────────────────────

  private renderHeader(parent: HTMLElement): void {
    const header = parent.createDiv({ cls: "homepage-header" });

    // 左侧：问候
    const left = header.createDiv({ cls: "homepage-header-left" });
    const h1 = left.createEl("h1", { cls: "homepage-header-greeting" });
    h1.createSpan({ text: "👋 " });
    h1.createSpan({ cls: "homepage-header-greeting-text", text: "你好，加载中..." });
    left.createEl("p", { cls: "homepage-header-date", text: "加载中..." });
    left.createEl("p", { cls: "homepage-header-quote-text", text: "保持专注，继续构建你的知识体系吧！" });

    // 右侧：搜索框 + 天气
    const right = header.createDiv({ cls: "homepage-header-right" });
    (right as HTMLElement).style.gap = "3rem";

    // 搜索框
    const searchBox = right.createDiv({ cls: "homepage-search-box" });
    (searchBox as HTMLElement).style.marginTop = "1rem";
    const searchIcon = searchBox.createEl("i", { cls: "homepage-search-icon" });
    searchIcon.createEl("span", { text: "🔍" });
    const searchInput = searchBox.createEl("input", {
      cls: "homepage-search-input",
      attr: { type: "text", placeholder: "搜索笔记..." },
    });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const query = searchInput.value.trim();
        if (query) {
          (this.app as any).internalPlugins?.getPluginById?.("global-search")?.instance?.openGlobalSearch(query);
        }
      }
    });
    const kbd = searchBox.createEl("kbd", { cls: "homepage-search-kbd", text: "⌘ K" });

    // 天气卡片
    const weatherCard = right.createDiv({ cls: "homepage-weather-card" });
    const weatherIconWrap = weatherCard.createDiv({ cls: "homepage-weather-icon-wrap" });
    weatherIconWrap.createSpan({ cls: "homepage-weather-icon", text: "☀️" });
    const weatherInfo = weatherCard.createDiv({ cls: "homepage-weather-info" });
    weatherInfo.createDiv({ cls: "homepage-weather-temp", text: "--°C" });
    weatherInfo.createDiv({ cls: "homepage-weather-desc", text: "加载中..." });
    const weatherSep = weatherCard.createDiv({ cls: "homepage-weather-separator" });
    const weatherLoc = weatherCard.createDiv({ cls: "homepage-weather-location" });
    weatherLoc.createSpan({ cls: "homepage-weather-location-text", text: "" });
    weatherLoc.createSpan({ text: " 📍" });
  }

  // ── 每日回顾 (col-span-6) ──────────────────────────────────

  private renderDailyReview(parent: HTMLElement): void {
    const card = parent.createDiv({ cls: "homepage-card homepage-col-6", attr: { "data-section": "daily-review" } });

    // 标题行
    const titleRow = card.createDiv({ cls: "homepage-card-title-row" });
    const titleLeft = titleRow.createDiv({ cls: "homepage-card-title" });
    titleLeft.createSpan({ text: "📅 " });
    titleLeft.createSpan({ text: "每日回顾" });
    titleRow.createEl("a", { cls: "homepage-card-link", text: "查看全部" });

    // 主体：环形进度条 + 检查列表
    const body = card.createDiv({ cls: "homepage-review-body" });

    // 左侧：环形进度条 (w-32 h-32)
    const ringWrapper = body.createDiv({ cls: "homepage-review-ring-wrapper" });
    const svg = ringWrapper.createSvg("svg", {
      cls: "homepage-review-ring",
      attr: { viewBox: "0 0 100 100" },
    });
    // 底圈
    svg.createSvg("circle", {
      cls: "homepage-review-ring-bg",
      attr: { cx: "50", cy: "50", r: "40", fill: "none", stroke: "#f0f2f5", "stroke-width": "8" },
    });
    // 进度圈
    svg.createSvg("circle", {
      cls: "homepage-review-ring-fill",
      attr: {
        cx: "50", cy: "50", r: "40", fill: "none",
        stroke: "#5c5cff", "stroke-width": "8",
        "stroke-linecap": "round",
        "stroke-dasharray": "251.2",
        "stroke-dashoffset": "70.336",
        transform: "rotate(-90 50 50)",
      },
    });
    const ringCenter = ringWrapper.createDiv({ cls: "homepage-review-ring-center" });
    ringCenter.createDiv({ cls: "homepage-review-ring-value", text: "0%" });
    ringCenter.createDiv({ cls: "homepage-review-ring-label", text: "今日回顾进度" });

    // 右侧：检查列表
    const checklist = body.createDiv({ cls: "homepage-review-checklist" });
    const items = [
      { key: "notes", icon: "📝", label: "记录笔记", value: "0 条" },
      { key: "tasks", icon: "✅", label: "完成待办", value: "0 项" },
      { key: "reading", icon: "📖", label: "阅读文章", value: "0 篇" },
      { key: "remaining", icon: "⏳", label: "剩余待办", value: "0 项" },
    ];
    for (const item of items) {
      const row = checklist.createDiv({ cls: "homepage-review-item", attr: { "data-review": item.key } });
      const left = row.createDiv({ cls: "homepage-review-item-left" });
      left.createSpan({ text: `${item.icon} ` });
      left.createSpan({ cls: "homepage-review-item-label", text: item.label });
      row.createSpan({ cls: "homepage-review-item-value", text: item.value, attr: { "data-review-value": item.key } });
      row.createSpan({ cls: "homepage-review-item-check", text: "✅" });
    }

    // 底部引言
    const quoteArea = card.createDiv({ cls: "homepage-review-quote" });
    const q = this.dataService.getTodayQuote();
    quoteArea.createEl("p", { cls: "homepage-review-quote-text", text: `"${q.text}"` });
    quoteArea.createEl("p", { cls: "homepage-review-quote-author", text: `— ${q.author}` });
  }

  // ── 进行中的项目 (col-span-6) ─────────────────────────────

  private renderProjects(parent: HTMLElement): void {
    const card = parent.createDiv({ cls: "homepage-card homepage-col-6", attr: { "data-section": "projects" } });

    // 标题行
    const titleRow = card.createDiv({ cls: "homepage-card-title-row" });
    const titleLeft = titleRow.createDiv({ cls: "homepage-card-title" });
    titleLeft.createSpan({ text: "📁 " });
    titleLeft.createSpan({ text: "进行中的项目" });
    titleRow.createEl("a", { cls: "homepage-card-link", text: "查看全部" });

    // 项目列表
    card.createDiv({ cls: "homepage-project-list" });

    // 底部新建按钮
    const footer = card.createDiv({ cls: "homepage-card-footer" });
    const newBtn = footer.createEl("button", { cls: "homepage-card-btn", text: "+ 新建项目" });
    newBtn.addEventListener("click", () => this.openProjectModal());
  }

  // ── 待办 (col-span-4) ─────────────────────────────────────

  private renderTodo(parent: HTMLElement): void {
    const card = parent.createDiv({ cls: "homepage-card homepage-col-4", attr: { "data-section": "todo" } });

    // 标题行
    const titleRow = card.createDiv({ cls: "homepage-card-title-row" });
    const titleLeft = titleRow.createDiv({ cls: "homepage-card-title" });
    titleLeft.createSpan({ text: "✅ " });
    titleLeft.createSpan({ text: "待办" });
    const addLink = titleRow.createEl("a", { cls: "homepage-card-link", text: "添加待办" });

    // Tabs
    const tabs = card.createDiv({ cls: "homepage-todo-tabs" });
    for (const tab of TODO_TABS) {
      const isActive = tab.key === this.currentTodoTab;
      const tabEl = tabs.createDiv({
        cls: `homepage-todo-tab${isActive ? " homepage-todo-tab--active" : ""}`,
        attr: { "data-tab": tab.key },
      });
      tabEl.createSpan({ text: tab.label });
      tabEl.createSpan({ cls: "homepage-todo-tab-count", text: "0" });
      tabEl.addEventListener("click", () => {
        this.currentTodoTab = tab.key;
        tabs.querySelectorAll(".homepage-todo-tab").forEach((t) => t.removeClass("homepage-todo-tab--active"));
        tabEl.addClass("homepage-todo-tab--active");
        this.loadTodos();
      });
    }

    // 待办列表
    card.createDiv({ cls: "homepage-todo-list" });

    // 底部添加按钮
    const footer = card.createDiv({ cls: "homepage-card-footer" });
    const addBtn = footer.createEl("button", { cls: "homepage-card-btn homepage-card-btn--primary", text: "+ 添加待办" });
  }

  // ── 便签 (col-span-4) ─────────────────────────────────────

  private renderStickyNotes(parent: HTMLElement): void {
    const card = parent.createDiv({ cls: "homepage-card homepage-col-4", attr: { "data-section": "sticky-notes" } });

    // 标题行
    const titleRow = card.createDiv({ cls: "homepage-card-title-row" });
    const titleLeft = titleRow.createDiv({ cls: "homepage-card-title" });
    titleLeft.createSpan({ text: "📝 " });
    titleLeft.createSpan({ text: "便签" });
    const addLink = titleRow.createEl("a", { cls: "homepage-card-link", text: "新建便签" });
    addLink.addEventListener("click", () => this.openQuickNoteModal());

    // 便签容器 — 固定3个便签布局
    const container = card.createDiv({ cls: "homepage-sticky-grid" });

    // 黄色大便签
    const yellow = container.createDiv({
      cls: "homepage-sticky-note homepage-sticky-note--yellow",
      attr: { "data-sticky": "0" },
    });
    yellow.createDiv({ cls: "homepage-sticky-label", attr: { "data-sticky-label": "0" }, text: "下周的分享主题：" });
    const yellowList = yellow.createEl("ul", { cls: "homepage-sticky-list", attr: { "data-sticky-list": "0" } });
    yellowList.createEl("li", { text: "如何构建高效的知识体系" });
    yellowList.createEl("li", { text: "工具：Obsidian + AI" });
    const yellowDate = yellow.createDiv({ cls: "homepage-sticky-date", attr: { "data-sticky-date": "0" } });
    yellowDate.createSpan({ text: "📅 5月28日" });

    // 蓝绿并排
    const bottomRow = container.createDiv({ cls: "homepage-sticky-bottom-row" });

    // 蓝色便签
    const blue = bottomRow.createDiv({
      cls: "homepage-sticky-note homepage-sticky-note--blue",
      attr: { "data-sticky": "1" },
    });
    blue.createDiv({ cls: "homepage-sticky-label", attr: { "data-sticky-label": "1" }, text: "灵感记录" });
    blue.createEl("p", { cls: "homepage-sticky-text", attr: { "data-sticky-text": "1" }, text: "把复杂的事情变得简单。" });
    const blueDate = blue.createEl("p", { cls: "homepage-sticky-date-small", attr: { "data-sticky-date": "1" }, text: "— 2024-05-20" });

    // 绿色便签
    const green = bottomRow.createDiv({
      cls: "homepage-sticky-note homepage-sticky-note--green",
      attr: { "data-sticky": "2" },
    });
    green.createDiv({ cls: "homepage-sticky-label", attr: { "data-sticky-label": "2" }, text: "待办提醒：" });
    const greenList = green.createEl("ul", { cls: "homepage-sticky-list", attr: { "data-sticky-list": "2" } });
    greenList.createEl("li", { text: "续费域名" });
    greenList.createEl("li", { text: "更新简历" });
  }

  // ── 热力图 (col-span-4) ───────────────────────────────────

  private renderHeatmap(parent: HTMLElement): void {
    const card = parent.createDiv({ cls: "homepage-card homepage-col-4", attr: { "data-section": "heatmap" } });

    // 标题行
    const titleRow = card.createDiv({ cls: "homepage-card-title-row" });
    const titleLeft = titleRow.createDiv({ cls: "homepage-card-title" });
    titleLeft.createSpan({ text: "🔥 " });
    titleLeft.createSpan({ text: "热力图" });
    const selectEl = titleRow.createEl("select", { cls: "homepage-heatmap-select" });
    selectEl.createEl("option", { text: "日记", attr: { value: "daily" } });
    selectEl.createEl("option", { text: "笔记", attr: { value: "notes" } });

    // 热力图主体
    const heatmapWrap = card.createDiv({ cls: "homepage-heatmap-wrap" });

    // 月份标签行
    heatmapWrap.createDiv({ cls: "homepage-heatmap-months", attr: { "data-months": "" } });

    const heatmapBody = heatmapWrap.createDiv({ cls: "homepage-heatmap-body" });

    // 星期标签
    const dayLabels = heatmapBody.createDiv({ cls: "homepage-heatmap-days" });
    for (const d of ["一", "三", "五", "日"]) {
      dayLabels.createDiv({ cls: "homepage-heatmap-day-label", text: d });
    }

    // 网格容器 — Grid 布局
    const gridEl = heatmapBody.createDiv({ cls: "homepage-heatmap-grid" });
    for (let i = 0; i < 7 * 35; i++) {
      gridEl.createDiv({ cls: "homepage-heatmap-cell" });
    }

    // 底部图例
    const legend = card.createDiv({ cls: "homepage-heatmap-legend" });
    const legendLeft = legend.createDiv({ cls: "homepage-heatmap-legend-left" });
    legendLeft.createSpan({ cls: "homepage-heatmap-legend-label", text: "少" });
    for (let i = 0; i <= 4; i++) {
      legendLeft.createDiv({ cls: "homepage-heatmap-cell homepage-heatmap-legend-cell", attr: { "data-level": String(i) } });
    }
    legendLeft.createSpan({ cls: "homepage-heatmap-legend-label", text: "多" });
    legend.createDiv({ cls: "homepage-heatmap-legend-total", attr: { "data-heatmap-total": "" }, text: "总计: ..." });
  }

  // ── 本月数据 (col-span-8) ─────────────────────────────────

  private renderMonthlyStats(parent: HTMLElement): void {
    const card = parent.createDiv({ cls: "homepage-card homepage-col-8 homepage-metrics-card", attr: { "data-section": "monthly-stats" } });

    // 上半部分：标题 + 指标网格
    const topArea = card.createDiv({ cls: "homepage-metrics-top" });

    const titleRow = topArea.createDiv({ cls: "homepage-card-title-row" });
    const titleLeft = titleRow.createDiv({ cls: "homepage-card-title" });
    titleLeft.createSpan({ text: "📊 " });
    titleLeft.createSpan({ text: "本月数据" });

    const metricsGrid = topArea.createDiv({ cls: "homepage-metrics-grid" });
    const metrics = [
      { key: "noteCount", label: "笔记数量", value: "0", trend: "+ 23%" },
      { key: "taskCompleted", label: "待办完成", value: "0", trend: "+ 8%" },
      { key: "focusTime", label: "专注时长", value: "0h", trend: "+ 5%" },
      { key: "consecutiveDays", label: "连续记录", value: "0天", trend: "" },
    ];

    // 4种不同的折线路径
    const sparklinePaths = [
      "M0 25 L20 15 L40 20 L60 10 L80 15 L100 5",
      "M0 20 L20 10 L40 25 L60 15 L80 20 L100 8",
      "M0 15 L20 25 L40 10 L60 20 L80 5 L100 18",
      "M0 22 L20 18 L40 12 L60 22 L80 10 L100 15",
    ];
    const sparklineColors = ["#5c5cff", "#10b981", "#f59e0b", "#8b5cf6"];

    for (let mi = 0; mi < metrics.length; mi++) {
      const m = metrics[mi];
      const metricCard = metricsGrid.createDiv({ cls: "homepage-metric-card", attr: { "data-metric": m.key } });
      metricCard.createDiv({ cls: "homepage-metric-label", text: m.label });

      const valueRow = metricCard.createDiv({ cls: "homepage-metric-value-row" });
      valueRow.createSpan({ cls: "homepage-metric-value", text: m.value });
      if (m.trend) {
        valueRow.createSpan({ cls: "homepage-metric-trend", text: m.trend });
      }

      // SVG 迷你折线图
      const sparklineWrap = metricCard.createDiv({ cls: "homepage-metric-sparkline", attr: { "data-sparkline": m.key } });
      const sparkSvg = sparklineWrap.createSvg("svg", {
        cls: "homepage-sparkline-svg",
        attr: { viewBox: "0 0 100 30", preserveAspectRatio: "none" },
      });
      // 渐变定义
      const defs = sparkSvg.createSvg("defs");
      const grad = defs.createSvg("linearGradient", {
        attr: { id: `spark-grad-${mi}`, x1: "0", y1: "0", x2: "0", y2: "1" },
      });
      grad.createSvg("stop", { attr: { offset: "0%", "stop-color": sparklineColors[mi], "stop-opacity": "0.3" } });
      grad.createSvg("stop", { attr: { offset: "100%", "stop-color": sparklineColors[mi], "stop-opacity": "0" } });
      // 折线
      sparkSvg.createSvg("path", {
        attr: { d: sparklinePaths[mi], fill: "none", stroke: sparklineColors[mi], "stroke-width": "2" },
      });
      // 渐变填充区域
      sparkSvg.createSvg("path", {
        attr: { d: `${sparklinePaths[mi]} L100 30 L0 30 Z`, fill: `url(#spark-grad-${mi})`, opacity: "0.2" },
      });
    }

    // 下半部分：引言装饰区
    const quoteBar = card.createDiv({ cls: "homepage-metrics-quote" });
    const quoteContent = quoteBar.createDiv({ cls: "homepage-metrics-quote-content" });
    quoteContent.createEl("p", { cls: "homepage-metrics-quote-text", text: `"知识是连接的，记录是思考的开始。"` });
    quoteContent.createEl("p", { cls: "homepage-metrics-quote-author", text: "— Keep Creating" });

    // 装饰 SVG
    const decor = quoteBar.createDiv({ cls: "homepage-metrics-decor" });
    const decorSvg = decor.createSvg("svg", {
      attr: { viewBox: "0 0 200 100", width: "100%", height: "100%" },
    });
    decorSvg.createSvg("path", { attr: { d: "M50 100 L100 40 L150 100 Z", fill: "#dce0ff" } });
    decorSvg.createSvg("path", { attr: { d: "M100 100 L160 20 L200 100 Z", fill: "#b9c2ff" } });
    decorSvg.createSvg("path", { attr: { d: "M0 100 L60 60 L120 100 Z", fill: "#eeefff" } });
    decor.createDiv({ cls: "homepage-metrics-decor-icon", text: "👨‍🚀" });
  }

  // ── 最近笔记 (col-span-4) ─────────────────────────────────

  private renderRecentNotes(parent: HTMLElement): void {
    const card = parent.createDiv({ cls: "homepage-card homepage-col-4", attr: { "data-section": "recent-notes" } });

    // 标题行
    const titleRow = card.createDiv({ cls: "homepage-card-title-row" });
    const titleLeft = titleRow.createDiv({ cls: "homepage-card-title" });
    titleLeft.createSpan({ text: "📄 " });
    titleLeft.createSpan({ text: "最近笔记" });
    titleRow.createEl("a", { cls: "homepage-card-link", text: "查看全部" });

    // 笔记列表
    card.createDiv({ cls: "homepage-recent-list" });
  }

  // ══════════════════════════════════════════════════════════
  // 异步数据加载
  // ══════════════════════════════════════════════════════════

  private async loadDataAsync(): Promise<void> {
    try {
      await Promise.all([
        this.loadWeather(),
        this.loadHeatmap(),
        this.loadMonthlyStats(),
        this.loadRecentNotes(),
        this.loadProjects(),
        this.loadTodos(),
        this.loadStickyNotes(),
        this.loadDailyReviewStats(),
      ]);
    } catch (e) {
      console.error("[ZENdian Homepage] Data loading error:", e);
    }
  }

  // ── 天气 ──────────────────────────────────────────────────

  private async loadWeather(): Promise<void> {
    try {
      const settings = (this.app as any).plugins?.plugins?.zendian?.settingsManager?.getSettings?.();
      const location = settings?.homepage?.weatherLocation;
      const enabled = settings?.homepage?.weatherEnabled;

      if (!enabled || !location) return;

      const weather = await this.weatherService.getWeather(location);
      if (!weather) return;

      const iconEl = this.containerEl.querySelector(".homepage-weather-icon");
      const tempEl = this.containerEl.querySelector(".homepage-weather-temp");
      const descEl = this.containerEl.querySelector(".homepage-weather-desc");
      const locTextEl = this.containerEl.querySelector(".homepage-weather-location-text");

      if (iconEl) iconEl.textContent = weather.icon;
      if (tempEl) tempEl.textContent = `${weather.temperature}°C`;
      if (descEl) descEl.textContent = weather.description;
      if (locTextEl) locTextEl.textContent = weather.location;
    } catch (e) {
      console.error("[ZENdian] Weather loading error:", e);
    }
  }

  // ── 热力图 ────────────────────────────────────────────────

  private loadHeatmap(): void {
    const data = this.statsService.getHeatmapData(245);
    const cells = this.containerEl.querySelectorAll(".homepage-heatmap-grid .homepage-heatmap-cell");

    const maxCount = Math.max(1, ...data.map((d) => d.count));
    let totalActiveDays = 0;

    data.forEach((day, i) => {
      const cell = cells[i] as HTMLElement | undefined;
      if (!cell) return;

      let level = 0;
      if (day.count > 0) {
        totalActiveDays++;
        const ratio = day.count / maxCount;
        if (ratio > 0.75) level = 4;
        else if (ratio > 0.5) level = 3;
        else if (ratio > 0.25) level = 2;
        else level = 1;
      }

      cell.setAttribute("data-level", String(level));
      cell.title = `${day.date}: ${day.count} 次修改`;
    });

    // 月份标签
    const monthsEl = this.containerEl.querySelector("[data-months]");
    if (monthsEl) {
      monthsEl.empty();
      const monthSet = new Set<string>();
      const monthLabels: string[] = [];
      for (const day of data) {
        const m = day.date.slice(0, 7); // YYYY-MM
        if (!monthSet.has(m)) {
          monthSet.add(m);
          const monthNum = parseInt(m.slice(5, 7), 10);
          monthLabels.push(`${monthNum}月`);
        }
      }
      for (const label of monthLabels) {
        monthsEl.createSpan({ cls: "homepage-heatmap-month-label", text: label });
      }
    }

    // 总天数
    const totalEl = this.containerEl.querySelector("[data-heatmap-total]");
    if (totalEl) totalEl.textContent = `总计: ${totalActiveDays} 天`;
  }

  // ── 月度统计 ──────────────────────────────────────────────

  private loadMonthlyStats(): void {
    const stats = this.statsService.getMonthlyStats();

    const updates: Record<string, string> = {
      noteCount: String(stats.noteCount),
      taskCompleted: String(stats.taskCompleted),
      focusTime: `${Math.round(stats.editCount * 0.5)}h`,
      consecutiveDays: `${stats.consecutiveDays}天`,
    };

    for (const [key, value] of Object.entries(updates)) {
      const el = this.containerEl.querySelector(`[data-metric="${key}"] .homepage-metric-value`);
      if (el) el.textContent = value;
    }
  }

  // ── 最近笔记 ──────────────────────────────────────────────

  private async loadRecentNotes(): Promise<void> {
    const notes = this.statsService.getRecentNotes(5);
    const list = this.containerEl.querySelector('[data-section="recent-notes"] .homepage-recent-list');
    if (!list) return;

    list.empty();

    for (const note of notes) {
      const item = list.createDiv({ cls: "homepage-recent-item" });

      // 左侧：图标 + 标题
      const left = item.createDiv({ cls: "homepage-recent-item-left" });
      const iconWrap = left.createDiv({ cls: "homepage-recent-icon" });
      iconWrap.createSpan({ text: "📄" });
      left.createSpan({ cls: "homepage-recent-title", text: note.title });

      // 右侧：标签 + 时间
      const right = item.createDiv({ cls: "homepage-recent-item-right" });
      if (note.tags.length > 0) {
        right.createSpan({ cls: "homepage-recent-tag", text: note.tags[0] });
      }
      right.createSpan({ cls: "homepage-recent-time", text: this.formatTimestamp(note.mtime) });

      item.addEventListener("click", () => this.openFile(note.path));
    }
  }

  // ── 项目 ──────────────────────────────────────────────────

  private loadProjects(): void {
    const projects = this.dataService.getProjects();
    const list = this.containerEl.querySelector('[data-section="projects"] .homepage-project-list');
    if (!list) return;

    list.empty();

    const activeProjects = projects.filter((p) => p.status !== "completed");
    if (activeProjects.length === 0) {
      list.createDiv({ cls: "homepage-empty-text", text: "暂无进行中的项目" });
      return;
    }

    for (const project of activeProjects) {
      this.renderProjectItem(list, project);
    }
  }

  private renderProjectItem(parent: HTMLElement, project: HomepageProject): void {
    const item = parent.createDiv({ cls: "homepage-project-item" });

    // 图标
    const iconColors: Record<string, string> = {
      "planning": "#3b82f6",
      "in-progress": "#f59e0b",
      "testing": "#8b5cf6",
    };
    const color = iconColors[project.status] || "#10b981";
    item.createDiv({
      cls: "homepage-project-icon",
      attr: { style: `background: ${color}15; color: ${color}` },
      text: project.name.charAt(0).toUpperCase(),
    });

    // 信息
    const info = item.createDiv({ cls: "homepage-project-info" });
    const nameRow = info.createDiv({ cls: "homepage-project-name-row" });
    nameRow.createSpan({ cls: "homepage-project-name", text: project.name });

    const nameRight = nameRow.createDiv({ cls: "homepage-project-name-right" });
    nameRight.createSpan({ cls: "homepage-project-status", text: "进行中" });
    nameRight.createSpan({ cls: "homepage-project-progress-text", text: `${project.progress}%` });

    // 进度条
    const bar = info.createDiv({ cls: "homepage-project-progress-bar" });
    bar.createDiv({
      cls: "homepage-project-progress-fill",
      attr: { style: `width: ${project.progress}%` },
    });

    // 删除按钮
    const deleteBtn = item.createDiv({ cls: "homepage-project-delete", text: "×" });
    deleteBtn.title = "删除项目";
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await this.dataService.deleteProject(project.id);
      this.loadProjects();
    });

    item.addEventListener("click", () => this.openProjectModal(project));
  }

  private openProjectModal(existing?: HomepageProject): void {
    new ProjectModal(this.app, async (data) => {
      if (existing) {
        await this.dataService.updateProject(existing.id, data);
      } else {
        await this.dataService.addProject(data.name, data.status, data.description);
      }
      this.loadProjects();
    }, existing).open();
  }

  // ── 待办 ──────────────────────────────────────────────────

  private async loadTodos(): Promise<void> {
    const list = this.containerEl.querySelector('[data-section="todo"] .homepage-todo-list');
    if (!list) return;

    try {
      const result = await this.taskService.getTaskRadar({
        excludeFolders: [".obsidian", "模板"],
        includeCompleted: true,
        limit: 50,
      });

      let items = result.items;

      // 更新 tab 计数
      this.updateTodoTabCounts(items);

      // 按 Tab 过滤
      if (this.currentTodoTab === "done") {
        items = items.filter((t) => t.completed);
      } else if (this.currentTodoTab !== "all") {
        items = items.filter((t) => !t.completed);
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const weekStart = todayStart - now.getDay() * 86_400_000;

        if (this.currentTodoTab === "today") {
          items = items.filter((t) => t.mtime >= todayStart);
        } else if (this.currentTodoTab === "week") {
          items = items.filter((t) => t.mtime >= weekStart);
        }
      }

      items = items.slice(0, 10);

      list.empty();
      if (items.length === 0) {
        list.createDiv({ cls: "homepage-empty-text", text: "没有待办事项" });
        return;
      }

      for (const task of items) {
        const item = list.createDiv({ cls: "homepage-todo-item" });

        const left = item.createDiv({ cls: "homepage-todo-item-left" });
        const checkbox = left.createDiv({
          cls: `homepage-todo-checkbox${task.completed ? " homepage-todo-checkbox--done" : ""}`,
        });
        if (task.completed) {
          checkbox.createDiv({ cls: "homepage-todo-checkmark", text: "✓" });
        }
        left.createSpan({
          cls: `homepage-todo-text${task.completed ? " homepage-todo-text--done" : ""}`,
          text: task.text,
        });

        // 右侧：标签 + 日期
        const right = item.createDiv({ cls: "homepage-todo-item-right" });
        const tag = this.inferTaskTag(task.filePath, task.text);
        right.createSpan({ cls: `homepage-todo-tag homepage-todo-tag--${tag.type}`, text: tag.label });
        right.createSpan({ cls: "homepage-todo-date", text: this.formatTodoDate(task.mtime) });

        item.addEventListener("click", () => this.openFile(task.filePath));
      }
    } catch {
      list.empty();
      list.createDiv({ cls: "homepage-empty-text", text: "加载失败" });
    }
  }

  private updateTodoTabCounts(items: import("./types").HomepageTaskItem[]): void {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - now.getDay() * 86_400_000;

    const allCount = items.length;
    const todayCount = items.filter((t) => !t.completed && t.mtime >= todayStart).length;
    const weekCount = items.filter((t) => !t.completed && t.mtime >= weekStart).length;
    const doneCount = items.filter((t) => t.completed).length;

    const counts: Record<string, number> = { all: allCount, today: todayCount, week: weekCount, done: doneCount };

    const tabs = this.containerEl.querySelectorAll(".homepage-todo-tab");
    tabs.forEach((tab) => {
      const key = tab.getAttribute("data-tab");
      if (key && key in counts) {
        const countEl = tab.querySelector(".homepage-todo-tab-count");
        if (countEl) countEl.textContent = String(counts[key]);
      }
    });
  }

  // ── 便签 ──────────────────────────────────────────────────

  private loadStickyNotes(): void {
    const notes = this.dataService.getQuickNotes();

    // 将用户数据加载到固定的3个便签中（如果有的话）
    for (let i = 0; i < Math.min(notes.length, 3); i++) {
      const note = notes[i];

      // 更新标签
      const labelEl = this.containerEl.querySelector(`[data-sticky-label="${i}"]`);
      if (labelEl && note.label) labelEl.textContent = note.label;

      // 使整个便签可点击打开文件
      const noteEl = this.containerEl.querySelector(`[data-sticky="${i}"]`) as HTMLElement | null;
      if (noteEl && note.path) {
        noteEl.addEventListener("click", () => this.openFile(note.path));
        noteEl.style.cursor = "pointer";
      }
    }
  }

  private openQuickNoteModal(existing?: HomepageQuickNote): void {
    new QuickNoteModal(this.app, async (data) => {
      await this.dataService.addQuickNote(data.label, data.path, data.color);
      this.loadStickyNotes();
    }, existing).open();
  }

  // ── 每日回顾统计 ──────────────────────────────────────────

  private async loadDailyReviewStats(): Promise<void> {
    const stats = this.statsService.getMonthlyStats();

    // 待办统计
    let taskTotal = 0;
    let taskDone = 0;
    try {
      const result = await this.taskService.getTaskRadar({
        excludeFolders: [".obsidian", "模板"],
        includeCompleted: true,
        limit: 999,
      });
      taskTotal = result.items.length;
      taskDone = result.items.filter((t) => t.completed).length;
    } catch {
      // ignore
    }

    const remaining = taskTotal - taskDone;
    const completionRate = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;

    // 更新检查列表
    const updates: Record<string, string> = {
      notes: `记录了 ${stats.noteCount} 条笔记`,
      tasks: `完成了 ${taskDone} 项待办`,
      reading: `阅读了 ${Math.round(stats.editCount * 0.3)} 篇文章`,
      remaining: `剩余 ${remaining} 项待办`,
    };

    for (const [key, value] of Object.entries(updates)) {
      const el = this.containerEl.querySelector(`[data-review-value="${key}"]`);
      if (el) el.textContent = value;
    }

    // 更新环形进度
    const ringValueEl = this.containerEl.querySelector(".homepage-review-ring-value");
    if (ringValueEl) ringValueEl.textContent = `${completionRate}%`;

    const ringFill = this.containerEl.querySelector(".homepage-review-ring-fill") as SVGCircleElement | null;
    if (ringFill) {
      const circumference = 2 * Math.PI * 40; // r=40
      ringFill.setAttribute("stroke-dasharray", `${circumference * (completionRate / 100)} ${circumference * (1 - completionRate / 100)}`);
      ringFill.setAttribute("stroke-dashoffset", "0");
    }
  }

  // ══════════════════════════════════════════════════════════
  // 动画
  // ══════════════════════════════════════════════════════════

  private initAnimations(): void {
    const sections = this.containerEl.querySelectorAll(".homepage-card");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.addClass("homepage-animate-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    sections.forEach((section, i) => {
      (section as HTMLElement).style.animationDelay = `${i * 0.08}s`;
      observer.observe(section);
    });

    this.animateStatNumbers();
  }

  private animateStatNumbers(): void {
    const statValues = this.containerEl.querySelectorAll(".homepage-metric-value");

    statValues.forEach((el) => {
      const text = el.textContent || "0";
      const match = text.match(/(\d+)/);
      if (!match) return;
      const target = parseInt(match[1], 10);
      if (isNaN(target) || target === 0) return;

      const suffix = text.replace(match[1], "");
      let current = 0;
      const duration = 800;
      const steps = 25;
      const increment = target / steps;
      const stepTime = duration / steps;

      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          current = target;
          clearInterval(timer);
        }
        el.textContent = `${Math.round(current)}${suffix}`;
      }, stepTime);
    });
  }

  // ══════════════════════════════════════════════════════════
  // 工具方法
  // ══════════════════════════════════════════════════════════

  private async openFile(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
    }
  }

  /** 根据文件路径和任务文本推断标签类型 */
  private inferTaskTag(filePath: string, text: string): { label: string; type: string } {
    const pathLower = filePath.toLowerCase();
    const textLower = text.toLowerCase();

    // 工作相关
    if (pathLower.includes("工作") || pathLower.includes("work") || pathLower.includes("项目") ||
        textLower.includes("会议") || textLower.includes("报告") || textLower.includes("需求")) {
      return { label: "工作", type: "work" };
    }
    // 学习相关
    if (pathLower.includes("学习") || pathLower.includes("study") || pathLower.includes("笔记") ||
        pathLower.includes("课程") || textLower.includes("学习") || textLower.includes("阅读")) {
      return { label: "学习", type: "study" };
    }
    // 生活相关
    if (pathLower.includes("生活") || pathLower.includes("life") || pathLower.includes("日常") ||
        textLower.includes("购物") || textLower.includes("健身") || textLower.includes("旅行")) {
      return { label: "生活", type: "life" };
    }
    // 默认
    return { label: "待办", type: "default" };
  }

  /** 格式化待办日期：今天/明天/具体日期 */
  private formatTodoDate(ts: number): string {
    const now = new Date();
    const date = new Date(ts);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const tomorrowStart = todayStart + 86_400_000;
    const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

    if (targetDay === todayStart) return "今天";
    if (targetDay === tomorrowStart) return "明天";

    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${m}-${d}`;
  }

  private formatTimestamp(ts: number): string {
    const now = new Date();
    const diffMs = now.getTime() - ts;
    const diffDays = Math.floor(diffMs / 86_400_000);

    if (diffDays === 0) {
      const d = new Date(ts);
      return `今天 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    if (diffDays === 1) return "昨天";
    if (diffDays < 7) return `${diffDays} 天前`;

    const d = new Date(ts);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  }

  // ── 实时时钟 ──────────────────────────────────────────────

  private startClock(): void {
    this.updateClock();
    this.clockTimer = window.setInterval(() => this.updateClock(), 60_000);
  }

  private stopClock(): void {
    if (this.clockTimer !== null) {
      window.clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
  }

  private updateClock(): void {
    const now = new Date();
    const settings = (this.app as any).plugins?.plugins?.zendian?.settingsManager?.getSettings?.();
    const userName = settings?.homepage?.userName;

    // 问候语
    let greeting = "你好";
    if (userName) greeting += `，${userName}`;
    const greetingTextEl = this.containerEl.querySelector(".homepage-header-greeting-text");
    if (greetingTextEl) greetingTextEl.textContent = greeting;

    // 日期
    const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    const dateStr = `今天是 ${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日，${weekdays[now.getDay()]}`;
    const dateEl = this.containerEl.querySelector(".homepage-header-date");
    if (dateEl) dateEl.textContent = dateStr;
  }
}
