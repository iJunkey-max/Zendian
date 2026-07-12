/**
 * ChartUtils — 图表工具函数
 *
 * 功能：
 * - SVG 路径生成
 * - 坐标计算
 * - 数据转换
 * - 动画工具
 */

// ============================================================
// SVG 路径生成
// ============================================================

/**
 * 生成折线路径
 */
export function generateLinePath(
  points: Array<{ x: number; y: number }>,
  tension = 0,
  closed = false
): string {
  if (points.length < 2) return "";

  let path = `M ${points[0].x} ${points[0].y}`;

  if (tension === 0) {
    // 直线
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
  } else {
    // 曲线（贝塞尔）
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];

      const cp1x = prev.x + (curr.x - prev.x) * tension;
      const cp1y = prev.y + (curr.y - prev.y) * tension;
      const cp2x = curr.x - (next ? (next.x - prev.x) * tension * 0.5 : 0);
      const cp2y = curr.y - (next ? (next.y - prev.y) * tension * 0.5 : 0);

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
    }
  }

  if (closed) {
    path += " Z";
  }

  return path;
}

/**
 * 生成填充区域路径
 */
export function generateFillPath(
  points: Array<{ x: number; y: number }>,
  baseline: number,
  tension = 0
): string {
  if (points.length < 2) return "";

  const linePath = generateLinePath(points, tension, false);
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];

  return `${linePath} L ${lastPoint.x} ${baseline} L ${firstPoint.x} ${baseline} Z`;
}

/**
 * 生成弧形路径
 */
export function generateArcPath(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  thickness = 0
): string {
  const startRad = (startAngle - 90) * Math.PI / 180;
  const endRad = (endAngle - 90) * Math.PI / 180;

  const x1 = cx + radius * Math.cos(startRad);
  const y1 = cy + radius * Math.sin(startRad);
  const x2 = cx + radius * Math.cos(endRad);
  const y2 = cy + radius * Math.sin(endRad);

  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

  let path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;

  if (thickness > 0) {
    const innerRadius = radius - thickness;
    const x3 = cx + innerRadius * Math.cos(endRad);
    const y3 = cy + innerRadius * Math.sin(endRad);
    const x4 = cx + innerRadius * Math.cos(startRad);
    const y4 = cy + innerRadius * Math.sin(startRad);

    path += ` L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4} Z`;
  }

  return path;
}

// ============================================================
// 坐标计算
// ============================================================

/**
 * 计算数据点坐标
 */
export function calculatePoints(
  data: number[],
  width: number,
  height: number,
  padding: { top: number; right: number; bottom: number; left: number }
): Array<{ x: number; y: number }> {
  if (data.length === 0) return [];

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  return data.map((value, index) => ({
    x: padding.left + (index / (data.length - 1)) * plotWidth,
    y: padding.top + plotHeight - ((value - min) / range) * plotHeight,
  }));
}

/**
 * 计算饼图角度
 */
export function calculatePieAngles(
  data: number[],
  startAngle = 0,
  endAngle = 360
): Array<{ start: number; end: number; value: number }> {
  const total = data.reduce((sum, value) => sum + value, 0);
  if (total === 0) return [];

  const angles: Array<{ start: number; end: number; value: number }> = [];
  let currentAngle = startAngle;

  for (const value of data) {
    const angle = (value / total) * (endAngle - startAngle);
    angles.push({
      start: currentAngle,
      end: currentAngle + angle,
      value,
    });
    currentAngle += angle;
  }

  return angles;
}

// ============================================================
// 数据转换
// ============================================================

/**
 * 格式化数字
 */
export function formatNumber(value: number, decimals = 0): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + "M";
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + "K";
  }
  return value.toFixed(decimals);
}

/**
 * 格式化百分比
 */
export function formatPercentage(value: number, decimals = 1): string {
  return value.toFixed(decimals) + "%";
}

/**
 * 计算百分比
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return (value / total) * 100;
}

/**
 * 生成标签
 */
export function generateLabels(count: number, prefix = ""): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);
}

// ============================================================
// 颜色工具
// ============================================================

/**
 * 生成颜色数组
 */
export function generateColors(count: number, saturation = 70, lightness = 50): string[] {
  const colors: string[] = [];
  const hueStep = 360 / count;

  for (let i = 0; i < count; i++) {
    const hue = i * hueStep;
    colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
  }

  return colors;
}

/**
 * 调整颜色透明度
 */
export function adjustOpacity(color: string, opacity: number): string {
  if (color.startsWith("hsl")) {
    return color.replace(")", `, ${opacity})`).replace("hsl", "hsla");
  }
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return color;
}

/**
 * 生成渐变
 */
export function generateGradient(
  id: string,
  color: string,
  direction: "vertical" | "horizontal" = "vertical"
): string {
  const isVertical = direction === "vertical";
  return `
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="${isVertical ? 0 : 1}" y2="${isVertical ? 1 : 0}">
        <stop offset="0%" stop-color="${adjustOpacity(color, 0.3)}" />
        <stop offset="100%" stop-color="${adjustOpacity(color, 0)}" />
      </linearGradient>
    </defs>
  `;
}

// ============================================================
// 动画工具
// ============================================================

/**
 * 线性插值
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * 缓动函数
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * 缓动函数
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * 生成动画帧
 */
export function* animateFrames(
  duration: number,
  fps = 60
): Generator<number> {
  const totalFrames = Math.ceil(duration / (1000 / fps));
  for (let frame = 0; frame <= totalFrames; frame++) {
    yield frame / totalFrames;
  }
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) {
      window.clearTimeout(timeout);
    }
    timeout = window.setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}
