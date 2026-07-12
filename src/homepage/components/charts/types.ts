/**
 * 图表组件类型定义
 */

// ============================================================
// 基础类型
// ============================================================

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
}

export interface ChartOptions {
  width?: number;
  height?: number;
  padding?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  animate?: boolean;
  responsive?: boolean;
}

// ============================================================
// 折线图类型
// ============================================================

export interface LineChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    color: string;
    fillColor?: string;
  }>;
}

export interface LineChartOptions extends ChartOptions {
  tension?: number;  // 曲线张力 0-1
  pointRadius?: number;
  pointHoverRadius?: number;
  fill?: boolean;
  stepped?: boolean;
}

// ============================================================
// 热力图类型
// ============================================================

export interface HeatmapData {
  date: string;
  value: number;
}

export interface HeatmapOptions extends ChartOptions {
  cellSize?: number;
  cellGap?: number;
  colorScale?: string[];
  minValue?: number;
  maxValue?: number;
  showMonthLabels?: boolean;
  showDayLabels?: boolean;
}

// ============================================================
// 饼图类型
// ============================================================

export interface PieChartData {
  labels: string[];
  data: number[];
  colors?: string[];
}

export interface PieChartOptions extends ChartOptions {
  innerRadius?: number;  // 0-1, 0 = 饼图, >0 = 环形图
  padAngle?: number;
  cornerRadius?: number;
  showLabels?: boolean;
  showPercentage?: boolean;
  labelOffset?: number;
}

// ============================================================
// 柱状图类型
// ============================================================

export interface BarChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    color: string;
  }>;
}

export interface BarChartOptions extends ChartOptions {
  barWidth?: number;
  barGap?: number;
  borderRadius?: number;
  horizontal?: boolean;
  stacked?: boolean;
}

// ============================================================
// 仪表盘类型
// ============================================================

export interface GaugeData {
  value: number;
  min: number;
  max: number;
  label: string;
  color: string;
}

export interface GaugeOptions extends ChartOptions {
  startAngle?: number;
  endAngle?: number;
  thickness?: number;
  showValue?: boolean;
  showLabel?: boolean;
}

// ============================================================
// 工具类型
// ============================================================

export interface ChartTooltip {
  x: number;
  y: number;
  content: string;
  visible: boolean;
}

export interface ChartLegend {
  label: string;
  color: string;
  value?: string;
}

export type ChartType = "line" | "bar" | "pie" | "heatmap" | "gauge";
