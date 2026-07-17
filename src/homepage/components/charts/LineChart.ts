/**
 * LineChart — 折线图组件
 *
 * 功能：
 * - 折线绘制
 * - 数据点显示
 * - 渐变填充
 * - 工具提示
 * - 动画效果
 */

import type { LineChartData, LineChartOptions } from "./types";
import {
  calculatePoints,
  generateLinePath,
  generateFillPath,
  adjustOpacity,
  formatNumber,
  debounce,
} from "./ChartUtils";

type ResolvedLineChartOptions = Omit<Required<LineChartOptions>, "padding"> & {
  padding: Required<NonNullable<LineChartOptions["padding"]>>;
};

export class LineChart {
  private container: HTMLElement;
  private svg!: SVGElement;
  private data: LineChartData;
  private options: ResolvedLineChartOptions;
  private tooltip!: HTMLElement;
  private points: Array<Array<{ x: number; y: number }>> = [];

  constructor(container: HTMLElement, data: LineChartData, options: LineChartOptions = {}) {
    this.container = container;
    this.data = data;
    this.options = {
      width: options.width ?? 400,
      height: options.height ?? 200,
      padding: {
        top: options.padding?.top ?? 20,
        right: options.padding?.right ?? 20,
        bottom: options.padding?.bottom ?? 40,
        left: options.padding?.left ?? 60,
      },
      showLegend: options.showLegend ?? true,
      showGrid: options.showGrid ?? true,
      showTooltip: options.showTooltip ?? true,
      animate: options.animate ?? true,
      responsive: options.responsive ?? true,
      tension: options.tension ?? 0.4,
      pointRadius: options.pointRadius ?? 4,
      pointHoverRadius: options.pointHoverRadius ?? 6,
      fill: options.fill ?? true,
      stepped: options.stepped ?? false,
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

    // 绘制网格
    if (this.options.showGrid) {
      this.renderGrid();
    }

    // 绘制数据
    this.renderData();

    // 绘制标签
    this.renderLabels();

    // 绘制图例
    if (this.options.showLegend) {
      this.renderLegend();
    }
  }

  private renderGrid(): void {
    const { width, height, padding } = this.options;
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const gridGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    gridGroup.addClass("chart-grid");

    // 水平网格线
    const yValues = this.getYAxisValues();
    for (const value of yValues) {
      const y = padding.top + plotHeight - ((value - this.getMinY()) / (this.getMaxY() - this.getMinY())) * plotHeight;

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(padding.left));
      line.setAttribute("y1", String(y));
      line.setAttribute("x2", String(width - padding.right));
      line.setAttribute("y2", String(y));
      line.setAttribute("stroke", "var(--background-modifier-border)");
      line.setAttribute("stroke-width", "1");
      line.setAttribute("stroke-dasharray", "4 4");
      gridGroup.appendChild(line);

      // Y 轴标签
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", String(padding.left - 10));
      text.setAttribute("y", String(y + 4));
      text.setAttribute("text-anchor", "end");
      text.setAttribute("fill", "var(--text-muted)");
      text.setAttribute("font-size", "11");
      text.textContent = formatNumber(value);
      gridGroup.appendChild(text);
    }

    this.svg.appendChild(gridGroup);
  }

  private renderData(): void {
    const { width, height, padding } = this.options;
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    this.points = [];

    for (const dataset of this.data.datasets) {
      const points = calculatePoints(
        dataset.data,
        width,
        height,
        padding
      );

      this.points.push(points);

      // 绘制填充区域
      if (this.options.fill && dataset.fillColor) {
        const fillPath = generateFillPath(
          points,
          height - padding.bottom,
          this.options.tension
        );

        const fill = document.createElementNS("http://www.w3.org/2000/svg", "path");
        fill.setAttribute("d", fillPath);
        fill.setAttribute("fill", dataset.fillColor);
        fill.setAttribute("opacity", "0.3");
        this.svg.appendChild(fill);
      }

      // 绘制折线
      const linePath = generateLinePath(
        points,
        this.options.tension,
        false
      );

      const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
      line.setAttribute("d", linePath);
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", dataset.color);
      line.setAttribute("stroke-width", "2");
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("stroke-linejoin", "round");
      line.addClass("chart-line");

      if (this.options.animate) {
        line.addClass("chart-line-animated");
      }

      this.svg.appendChild(line);

      // 绘制数据点
      for (let i = 0; i < points.length; i++) {
        const point = points[i];

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", String(point.x));
        circle.setAttribute("cy", String(point.y));
        circle.setAttribute("r", String(this.options.pointRadius));
        circle.setAttribute("fill", "var(--background-primary)");
        circle.setAttribute("stroke", dataset.color);
        circle.setAttribute("stroke-width", "2");
        circle.addClass("chart-point");

        // 存储数据用于工具提示
        circle.dataset.index = String(i);
        circle.dataset.value = String(dataset.data[i]);
        circle.dataset.label = this.data.labels[i] || "";
        circle.dataset.datasetLabel = dataset.label;

        this.svg.appendChild(circle);
      }
    }
  }

  private renderLabels(): void {
    const { width, height, padding } = this.options;
    const plotWidth = width - padding.left - padding.right;

    const labelsGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    labelsGroup.addClass("chart-labels");

    // X 轴标签
    const labelCount = Math.min(this.data.labels.length, 10); // 最多显示 10 个标签
    const step = Math.ceil(this.data.labels.length / labelCount);

    for (let i = 0; i < this.data.labels.length; i += step) {
      const x = padding.left + (i / (this.data.labels.length - 1)) * plotWidth;

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", String(x));
      text.setAttribute("y", String(height - padding.bottom + 20));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("fill", "var(--text-muted)");
      text.setAttribute("font-size", "11");
      text.textContent = this.data.labels[i];
      labelsGroup.appendChild(text);
    }

    this.svg.appendChild(labelsGroup);
  }

  private renderLegend(): void {
    const legend = document.createElement("div");
    legend.addClass("chart-legend");

    for (const dataset of this.data.datasets) {
      const item = document.createElement("div");
      item.addClass("chart-legend-item");

      const color = document.createElement("div");
      color.addClass("chart-legend-color");
      color.style.backgroundColor = dataset.color;

      const label = document.createElement("span");
      label.addClass("chart-legend-label");
      label.textContent = dataset.label;

      item.appendChild(color);
      item.appendChild(label);
      legend.appendChild(item);
    }

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
    const rect = this.svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 查找最近的数据点
    let closestPoint: { x: number; y: number; index: number; datasetIndex: number } | null = null;
    let minDistance = Infinity;

    for (let di = 0; di < this.points.length; di++) {
      const points = this.points[di];
      for (let pi = 0; pi < points.length; pi++) {
        const point = points[pi];
        const distance = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2));

        if (distance < minDistance && distance < 30) {
          minDistance = distance;
          closestPoint = { ...point, index: pi, datasetIndex: di };
        }
      }
    }

    if (closestPoint) {
      this.showTooltip(closestPoint);
    } else {
      this.hideTooltip();
    }
  }

  private showTooltip(point: { x: number; y: number; index: number; datasetIndex: number }): void {
    const dataset = this.data.datasets[point.datasetIndex];
    const value = dataset.data[point.index];
    const label = this.data.labels[point.index] || "";

    this.tooltip.replaceChildren();
    const title = document.createElement("div");
    title.className = "chart-tooltip-title";
    title.textContent = label;
    const content = document.createElement("div");
    content.className = "chart-tooltip-content";
    const dot = document.createElement("span");
    dot.className = "chart-tooltip-dot";
    dot.style.backgroundColor = dataset.color;
    const datasetLabel = document.createElement("span");
    datasetLabel.className = "chart-tooltip-label";
    datasetLabel.textContent = `${dataset.label}:`;
    const formattedValue = document.createElement("span");
    formattedValue.className = "chart-tooltip-value";
    formattedValue.textContent = formatNumber(value);
    content.append(dot, datasetLabel, formattedValue);
    this.tooltip.append(title, content);

    this.tooltip.style.display = "block";
    this.tooltip.style.left = `${point.x + 10}px`;
    this.tooltip.style.top = `${point.y - 10}px`;

    // 高亮数据点
    const circles = this.svg.querySelectorAll("circle");
    circles.forEach((circle) => {
      const index = parseInt(circle.dataset.index || "-1");
      const datasetLabel = circle.dataset.datasetLabel;

      if (index === point.index && datasetLabel === dataset.label) {
        circle.setAttribute("r", String(this.options.pointHoverRadius));
        circle.addClass("chart-point-hover");
      } else {
        circle.setAttribute("r", String(this.options.pointRadius));
        circle.removeClass("chart-point-hover");
      }
    });
  }

  private hideTooltip(): void {
    this.tooltip.style.display = "none";

    // 恢复数据点大小
    const circles = this.svg.querySelectorAll("circle");
    circles.forEach((circle) => {
      circle.setAttribute("r", String(this.options.pointRadius));
      circle.removeClass("chart-point-hover");
    });
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  private getMinY(): number {
    const allValues = this.data.datasets.flatMap((d) => d.data);
    return Math.min(...allValues);
  }

  private getMaxY(): number {
    const allValues = this.data.datasets.flatMap((d) => d.data);
    return Math.max(...allValues);
  }

  private getYAxisValues(): number[] {
    const min = this.getMinY();
    const max = this.getMaxY();
    const range = max - min;
    const step = range / 5;

    const values: number[] = [];
    for (let i = 0; i <= 5; i++) {
      values.push(min + step * i);
    }

    return values;
  }

  // ============================================================
  // 公共方法
  // ============================================================

  /**
   * 更新数据
   */
  updateData(data: LineChartData): void {
    this.data = data;
    this.render();
  }

  /**
   * 更新选项
   */
  updateOptions(options: Partial<LineChartOptions>): void {
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
