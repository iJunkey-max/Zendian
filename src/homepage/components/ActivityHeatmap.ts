export interface ActivityHeatmapDay {
  date: string;
  value: number;
}

export interface ActivityHeatmapSummary {
  label: string;
  value: string | number;
  unit?: string;
}

export interface ActivityHeatmapOptions {
  minWeeks?: number;
  maxWeeks?: number;
  tooltipUnit?: string;
  summary?: ActivityHeatmapSummary[];
}

/**
 * Mounts the compact activity rhythm used by both the homepage and project analytics.
 * The returned disposer must be called before the host is emptied.
 */
export function mountActivityHeatmap(
  host: HTMLElement,
  input: ActivityHeatmapDay[],
  options: ActivityHeatmapOptions = {},
): () => void {
  const days = [...input].sort((left, right) => left.date.localeCompare(right.date));
  const minWeeks = options.minWeeks ?? 8;
  const maxWeeks = options.maxWeeks ?? 52;
  const tooltipUnit = options.tooltipUnit ?? "次活动";

  const wrap = host.createDiv({ cls: "homepage-heatmap-wrap zd-activity-heatmap-wrap" });
  const monthsEl = wrap.createDiv({ cls: "homepage-heatmap-months", attr: { "data-months": "" } });
  const bodyEl = wrap.createDiv({ cls: "homepage-heatmap-body" });
  const dayLabelsEl = bodyEl.createDiv({ cls: "homepage-heatmap-days" });
  for (const label of ["一", "二", "三", "四", "五", "六", "日"]) {
    dayLabelsEl.createDiv({ cls: "homepage-heatmap-day-label", text: label });
  }
  const gridEl = bodyEl.createDiv({ cls: "homepage-heatmap-grid" });

  const legend = wrap.createDiv({ cls: "homepage-heatmap-legend" });
  legend.createSpan({ cls: "homepage-heatmap-legend-label", text: "少" });
  for (let level = 0; level <= 4; level++) {
    legend.createDiv({
      cls: "homepage-heatmap-cell homepage-heatmap-legend-cell",
      attr: { "data-level": String(level), "aria-hidden": "true" },
    });
  }
  legend.createSpan({ cls: "homepage-heatmap-legend-label", text: "多" });

  let summaryEl: HTMLElement | null = null;
  if (options.summary?.length) {
    const summary = host.createDiv({ cls: "homepage-rhythm-summary zd-activity-heatmap-summary" });
    summaryEl = summary;
    for (const item of options.summary) {
      const stat = summary.createDiv({ cls: "homepage-rhythm-stat" });
      stat.createDiv({ cls: "homepage-rhythm-stat-label", text: item.label });
      stat.createDiv({ cls: "homepage-rhythm-stat-value", text: String(item.value) });
      if (item.unit) stat.createDiv({ cls: "homepage-rhythm-stat-unit", text: item.unit });
    }
  }

  let frame: number | null = null;
  let disposed = false;

  const render = () => {
    if (disposed || !host.isConnected) return;
    const styles = window.getComputedStyle(host);
    const cellSize = Number.parseFloat(styles.getPropertyValue("--rhythm-cell-size")) || 14;
    const cellGap = Number.parseFloat(styles.getPropertyValue("--rhythm-cell-gap")) || 3;
    const labelsWidth = dayLabelsEl.offsetWidth || 16;
    const availableWidth = Math.max(0, bodyEl.clientWidth - labelsWidth - 8);
    const visibleWeeks = Math.max(
      minWeeks,
      Math.min(maxWeeks, Math.floor((availableWidth + cellGap) / (cellSize + cellGap))),
    );
    const visibleDays = days.slice(-visibleWeeks * 7);
    host.style.setProperty("--rhythm-weeks", String(visibleWeeks));

    const maxValue = Math.max(1, ...days.map((day) => day.value));
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    gridEl.empty();
    for (const day of visibleDays) {
      const ratio = day.value / maxValue;
      const level = day.value <= 0 ? 0 : ratio > 0.75 ? 4 : ratio > 0.5 ? 3 : ratio > 0.25 ? 2 : 1;
      const cell = gridEl.createDiv({
        cls: "homepage-heatmap-cell",
        attr: {
          "data-level": String(level),
          title: `${day.date}: ${day.value} ${tooltipUnit}`,
          "aria-label": `${day.date}，${day.value} ${tooltipUnit}`,
        },
      });
      if (day.date > todayKey) cell.addClass("is-future");
    }

    monthsEl.empty();
    let previousMonth = "";
    visibleDays.forEach((day, index) => {
      const month = day.date.slice(5, 7);
      if (!month || month === previousMonth) return;
      previousMonth = month;
      const label = monthsEl.createSpan({
        cls: "homepage-heatmap-month-label",
        text: `${Number(month)}月`,
      });
      label.style.gridColumn = String(Math.floor(index / 7) + 1);
    });
  };

  const scheduleRender = () => {
    if (disposed) return;
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(() => {
      frame = null;
      render();
    });
  };

  const observer = typeof ResizeObserver === "undefined"
    ? null
    : new ResizeObserver(scheduleRender);
  observer?.observe(bodyEl);
  scheduleRender();

  return () => {
    disposed = true;
    observer?.disconnect();
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    wrap.remove();
    summaryEl?.remove();
  };
}
