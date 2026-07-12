/**
 * Charts — 图表组件库
 *
 * 功能：
 * - 折线图
 * - 热力图
 * - 饼图（待实现）
 * - 柱状图（待实现）
 * - 仪表盘（待实现）
 */

// 类型定义
export type {
  ChartData,
  ChartDataset,
  ChartOptions,
  LineChartData,
  LineChartOptions,
  HeatmapData,
  HeatmapOptions,
  PieChartData,
  PieChartOptions,
  BarChartData,
  BarChartOptions,
  GaugeData,
  GaugeOptions,
  ChartTooltip,
  ChartLegend,
  ChartType,
} from "./types";

// 图表组件
export { LineChart } from "./LineChart";
export { HeatmapChart } from "./HeatmapChart";

// 工具函数
export {
  generateLinePath,
  generateFillPath,
  generateArcPath,
  calculatePoints,
  calculatePieAngles,
  formatNumber,
  formatPercentage,
  calculatePercentage,
  generateLabels,
  generateColors,
  adjustOpacity,
  generateGradient,
  lerp,
  easeOutCubic,
  easeInOutCubic,
  animateFrames,
  debounce,
  throttle,
} from "./ChartUtils";

// 使用示例：
/*
import { LineChart, HeatmapChart } from "./components/charts";

// 创建折线图
const lineChart = new LineChart(container, {
  labels: ["1月", "2月", "3月", "4月", "5月", "6月"],
  datasets: [{
    label: "任务完成",
    data: [10, 15, 8, 12, 20, 18],
    color: "#3b82f6",
    fillColor: "#3b82f6",
  }],
}, {
  width: 600,
  height: 300,
  showGrid: true,
  showTooltip: true,
});

// 创建热力图
const heatmapChart = new HeatmapChart(container, [
  { date: "2024-01-01", value: 3 },
  { date: "2024-01-02", value: 5 },
  // ...
], {
  width: 800,
  height: 150,
  colorScale: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
});
*/
