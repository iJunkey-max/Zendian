/**
 * HeatmapChart — 热力图组件
 *
 * 功能：
 * - 按日期显示活动强度
 * - 颜色渐变
 * - 工具提示
 * - 月份和星期标签
 */

import type { HeatmapData, HeatmapOptions } from "./types";
import { formatNumber, debounce } from "./ChartUtils";

type ResolvedHeatmapOptions = Omit<Required<HeatmapOptions>, "padding"> & {
  padding: Required<NonNullable<HeatmapOptions["padding"]>>;
};

export class HeatmapChart {
  private container: HTMLElement;
  private svg!: SVGElement;
  private data: HeatmapData[];
  private options: ResolvedHeatmapOptions;
  private tooltip!: HTMLElement;

  constructor(container: HTMLElement, data: HeatmapData[], options: HeatmapOptions = {}) {
    this.container = container;
    this.data = data;
    this.options = {
      width: options.width ?? 800,
      height: options.height ?? 150,
      padding: {
        top: options.padding?.top ?? 20,
        right: options.padding?.right ?? 20,
        bottom: options.padding?.bottom ?? 30,
        left: options.padding?.left ?? 40,
      },
      showLegend: options.showLegend ?? true,
      showGrid: options.showGrid ?? false,
      showTooltip: options.showTooltip ?? true,
      animate: options.animate ?? true,
      responsive: options.responsive ?? true,
      cellSize: options.cellSize ?? 12,
      cellGap: options.cellGap ?? 2,
      colorScale: options.colorScale ?? [
        "#ebedf0",
        "#9be9a8",
        "#40c463",
        "#30a14e",
        "#216e39",
      ],
      minValue: options.minValue ?? 0,
      maxValue: options.maxValue ?? Math.max(...data.map((d) => d.value), 1),
      showMonthLabels: options.showMonthLabels ?? true,
      showDayLabels: options.showDayLabels ?? true,
    };

    this.init();
  }

  // ============================================================
  // 初始化
  // ============================================================

  private init(): void {
    this.createSVG();
    this.createTooltip();
    this.render();
    this.setupEventListeners();
  }

  private createSVG(): void {
    this.container.empty();
    this.container.addClass("chart-container");
    this.container.addClass("heatmap-container");

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", String(this.options.width));
    svg.setAttribute("height", String(this.options.height));
    svg.setAttribute("viewBox", `0 0 ${this.options.width} ${this.options.height}`);
    svg.addClass("chart-svg");

    if (this.options.responsive) {
      svg.style.width = "100%";
      svg.style.height = "auto";
    }

    this.container.appendChild(svg);
    this.svg = svg;
  }

  private createTooltip(): void {
    this.tooltip = document.createElement("div");
    this.tooltip.addClass("chart-tooltip");
    this.tooltip.style.display = "none";
    this.container.appendChild(this.tooltip);
  }

  // ============================================================
  // 渲染
  // ============================================================

  private render(): void {
    this.svg.innerHTML = "";

    // 计算布局
    const { cellSize, cellGap, padding } = this.options;
    const totalCellSize = cellSize + cellGap;

    // 按周分组数据
    const weeks = this.groupByWeek();

    // 绘制月份标签
    if (this.options.showMonthLabels) {
      this.renderMonthLabels(weeks, totalCellSize);
    }

    // 绘制星期标签
    if (this.options.showDayLabels) {
      this.renderDayLabels(totalCellSize);
    }

    // 绘制热力图单元格
    this.renderCells(weeks, totalCellSize);

    // 绘制图例
    if (this.options.showLegend) {
      this.renderLegend();
    }
  }

  private groupByWeek(): HeatmapData[][] {
    // 按日期排序
    const sorted = [...this.data].sort((a, b) => a.date.localeCompare(b.date));

    // 按周分组
    const weeks: HeatmapData[][] = [];
    let currentWeek: HeatmapData[] = [];

    for (const day of sorted) {
      const date = new Date(day.date);
      const dayOfWeek = date.getDay(); // 0 = 周日

      // 如果是新的一周（周日），开始新的分组
      if (dayOfWeek === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      currentWeek.push(day);
    }

    // 添加最后一周
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  }

  private renderMonthLabels(weeks: HeatmapData[][], totalCellSize: number): void {
    const { padding } = this.options;
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.addClass("heatmap-months");

    let lastMonth = -1;

    for (let i = 0; i < weeks.length; i++) {
      const week = weeks[i];
      if (week.length === 0) continue;

      const date = new Date(week[0].date);
      const month = date.getMonth();

      // 如果是新的月份，显示标签
      if (month !== lastMonth) {
        const x = padding.left + i * totalCellSize;
        const y = padding.top - 5;

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", String(x));
        text.setAttribute("y", String(y));
        text.setAttribute("fill", "var(--text-muted)");
        text.setAttribute("font-size", "10");
        text.textContent = this.getMonthName(month);

        group.appendChild(text);
        lastMonth = month;
      }
    }

    this.svg.appendChild(group);
  }

  private renderDayLabels(totalCellSize: number): void {
    const { padding } = this.options;
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.addClass("heatmap-days");

    const days = ["日", "一", "二", "三", "四", "五", "六"];

    // 只显示奇数天（周一、周三、周五）
    for (let i = 0; i < days.length; i += 2) {
      const x = padding.left - 5;
      const y = padding.top + i * totalCellSize + this.options.cellSize / 2 + 3;

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", String(x));
      text.setAttribute("y", String(y));
      text.setAttribute("text-anchor", "end");
      text.setAttribute("fill", "var(--text-muted)");
      text.setAttribute("font-size", "10");
      text.textContent = days[i];

      group.appendChild(text);
    }

    this.svg.appendChild(group);
  }

  private renderCells(weeks: HeatmapData[][], totalCellSize: number): void {
    const { padding, cellSize, colorScale, minValue, maxValue } = this.options;
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.addClass("heatmap-cells");

    for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
      const week = weeks[weekIndex];

      for (const day of week) {
        const date = new Date(day.date);
        const dayOfWeek = date.getDay();

        const x = padding.left + weekIndex * totalCellSize;
        const y = padding.top + dayOfWeek * totalCellSize;

        // 计算颜色
        const normalizedValue = (day.value - minValue) / (maxValue - minValue);
        const colorIndex = Math.min(
          Math.floor(normalizedValue * (colorScale.length - 1)),
          colorScale.length - 1
        );
        const color = colorScale[colorIndex];

        // 创建单元格
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", String(x));
        rect.setAttribute("y", String(y));
        rect.setAttribute("width", String(cellSize));
        rect.setAttribute("height", String(cellSize));
        rect.setAttribute("rx", "2");
        rect.setAttribute("fill", color);
        rect.addClass("heatmap-cell");

        // 存储数据用于工具提示
        rect.dataset.date = day.date;
        rect.dataset.value = String(day.value);

        // 动画
        if (this.options.animate) {
          rect.style.opacity = "0";
          rect.style.animation = `heatmap-fade-in 0.3s ease ${weekIndex * 0.02}s forwards`;
        }

        group.appendChild(rect);
      }
    }

    this.svg.appendChild(group);
  }

  private renderLegend(): void {
    const { colorScale } = this.options;
    const legend = document.createElement("div");
    legend.addClass("chart-legend");
    legend.addClass("heatmap-legend");

    // 少
    const lessLabel = document.createElement("span");
    lessLabel.addClass("heatmap-legend-label");
    lessLabel.textContent = "少";
    legend.appendChild(lessLabel);

    // 颜色方块
    for (const color of colorScale) {
      const cell = document.createElement("div");
      cell.addClass("heatmap-legend-cell");
      cell.style.backgroundColor = color;
      legend.appendChild(cell);
    }

    // 多
    const moreLabel = document.createElement("span");
    moreLabel.addClass("heatmap-legend-label");
    moreLabel.textContent = "多";
    legend.appendChild(moreLabel);

    this.container.appendChild(legend);
  }

  // ============================================================
  // 交互
  // ============================================================

  private setupEventListeners(): void {
    if (!this.options.showTooltip) return;

    const handleMouseMove = debounce((e: MouseEvent) => {
      this.handleMouseMove(e);
    }, 10);

    this.svg.addEventListener("mousemove", handleMouseMove);
    this.svg.addEventListener("mouseleave", () => {
      this.hideTooltip();
    });
  }

  private handleMouseMove(e: MouseEvent): void {
    const target = e.target as SVGElement;

    if (target.hasClass("heatmap-cell")) {
      const date = target.dataset.date || "";
      const value = parseInt(target.dataset.value || "0");

      this.showTooltip(e, date, value);
      target.addClass("heatmap-cell-hover");
    } else {
      this.hideTooltip();
    }
  }

  private showTooltip(e: MouseEvent, date: string, value: number): void {
    const dateObj = new Date(date);
    const formattedDate = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;

    this.tooltip.innerHTML = `
      <div class="chart-tooltip-title">${formattedDate}</div>
      <div class="chart-tooltip-content">
        <span class="chart-tooltip-value">${value} 次活动</span>
      </div>
    `;

    this.tooltip.style.display = "block";
    this.tooltip.style.left = `${e.clientX + 10}px`;
    this.tooltip.style.top = `${e.clientY - 10}px`;
  }

  private hideTooltip(): void {
    this.tooltip.style.display = "none";

    // 移除所有单元格的高亮
    const cells = this.svg.querySelectorAll(".heatmap-cell");
    cells.forEach((cell) => {
      cell.removeClass("heatmap-cell-hover");
    });
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  private getMonthName(month: number): string {
    const months = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
    return months[month];
  }

  // ============================================================
  // 公共方法
  // ============================================================

  /**
   * 更新数据
   */
  updateData(data: HeatmapData[]): void {
    this.data = data;
    this.options.maxValue = Math.max(...data.map((d) => d.value), 1);
    this.render();
  }

  /**
   * 更新选项
   */
  updateOptions(options: Partial<HeatmapOptions>): void {
    Object.assign(this.options, options);
    this.render();
  }

  /**
   * 销毁图表
   */
  destroy(): void {
    this.container.empty();
  }
}
