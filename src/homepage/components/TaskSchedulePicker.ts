export interface TaskScheduleValue {
  date: string;
  time: string;
}

const ICONS = {
  calendar: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  chevronLeft: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>`,
  chevronRight: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`,
};

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function createTaskSchedulePicker(
  parent: HTMLElement,
  value: TaskScheduleValue,
  onChange: (value: TaskScheduleValue) => void,
): () => void {
  const doc = parent.ownerDocument;
  let current = { ...value };
  let panel: HTMLElement | null = null;
  let activeTrigger: HTMLButtonElement | null = null;

  const dateTrigger = createTrigger(parent, "calendar", "选择日期", "选择截止日期");
  const timeTrigger = createTrigger(parent, "clock", "选择时间", "选择截止时间");

  const refreshTriggers = (): void => {
    setTriggerValue(dateTrigger, current.date || "选择日期", Boolean(current.date));
    setTriggerValue(timeTrigger, current.time || "选择时间", Boolean(current.time));
  };

  const emit = (next: Partial<TaskScheduleValue>): void => {
    current = { ...current, ...next };
    refreshTriggers();
    onChange({ ...current });
  };

  const closePanel = (): void => {
    panel?.remove();
    panel = null;
    activeTrigger?.setAttribute("aria-expanded", "false");
    activeTrigger = null;
  };

  const positionPanel = (): void => {
    if (!panel || !activeTrigger) return;
    const anchorRect = activeTrigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const margin = 10;
    let left = anchorRect.left;
    let top = anchorRect.bottom + 8;
    if (left + panelRect.width > window.innerWidth - margin) left = window.innerWidth - panelRect.width - margin;
    if (top + panelRect.height > window.innerHeight - margin) top = anchorRect.top - panelRect.height - 8;
    panel.style.left = `${Math.max(margin, left)}px`;
    panel.style.top = `${Math.max(margin, top)}px`;
    panel.style.visibility = "visible";
  };

  const openPanel = (trigger: HTMLButtonElement, kind: "date" | "time"): void => {
    if (activeTrigger === trigger && panel) {
      closePanel();
      return;
    }
    closePanel();
    activeTrigger = trigger;
    trigger.setAttribute("aria-expanded", "true");
    panel = doc.body.createDiv({
      cls: `zendian-schedule-popover zendian-schedule-popover--${kind}`,
      attr: { role: "dialog", "aria-label": kind === "date" ? "选择截止日期" : "选择截止时间" },
    });
    panel.style.visibility = "hidden";
    if (kind === "date") renderCalendar(panel, current.date, emit, closePanel);
    else renderTimePicker(panel, current.time, emit, closePanel);
    requestAnimationFrame(positionPanel);
  };

  dateTrigger.addEventListener("click", () => openPanel(dateTrigger, "date"));
  timeTrigger.addEventListener("click", () => openPanel(timeTrigger, "time"));

  const onPointerDown = (event: PointerEvent): void => {
    const target = event.target as Node;
    if (panel?.contains(target) || parent.contains(target)) return;
    closePanel();
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && panel) {
      const trigger = activeTrigger;
      closePanel();
      trigger?.focus();
    }
  };
  doc.addEventListener("pointerdown", onPointerDown);
  doc.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", positionPanel);
  window.addEventListener("scroll", positionPanel, true);
  refreshTriggers();

  return () => {
    closePanel();
    doc.removeEventListener("pointerdown", onPointerDown);
    doc.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("resize", positionPanel);
    window.removeEventListener("scroll", positionPanel, true);
  };
}

function createTrigger(
  parent: HTMLElement,
  icon: "calendar" | "clock",
  placeholder: string,
  label: string,
): HTMLButtonElement {
  const button = parent.createEl("button", {
    cls: `zendian-task-schedule-trigger zendian-task-schedule-trigger--${icon}`,
    attr: { type: "button", "aria-label": label, "aria-haspopup": "dialog", "aria-expanded": "false" },
  });
  const iconEl = button.createSpan({ cls: "zendian-task-schedule-trigger__icon" });
  iconEl.innerHTML = ICONS[icon];
  button.createSpan({ cls: "zendian-task-schedule-trigger__value is-placeholder", text: placeholder });
  return button;
}

function setTriggerValue(button: HTMLButtonElement, text: string, hasValue: boolean): void {
  const value = button.querySelector<HTMLElement>(".zendian-task-schedule-trigger__value");
  if (!value) return;
  value.textContent = text;
  value.classList.toggle("is-placeholder", !hasValue);
}

function renderCalendar(
  panel: HTMLElement,
  selectedValue: string,
  onChange: (value: Partial<TaskScheduleValue>) => void,
  close: () => void,
): void {
  let visibleMonth = parseDate(selectedValue) || new Date();
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);

  const render = (): void => {
    panel.empty();
    const header = panel.createDiv({ cls: "zendian-calendar-header" });
    const prev = header.createEl("button", { cls: "zendian-picker-icon-btn", attr: { type: "button", "aria-label": "上个月" } });
    prev.innerHTML = ICONS.chevronLeft;
    header.createDiv({
      cls: "zendian-calendar-month",
      text: `${visibleMonth.getFullYear()}年 ${visibleMonth.getMonth() + 1}月`,
    });
    const next = header.createEl("button", { cls: "zendian-picker-icon-btn", attr: { type: "button", "aria-label": "下个月" } });
    next.innerHTML = ICONS.chevronRight;
    prev.addEventListener("click", () => {
      visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
      render();
    });
    next.addEventListener("click", () => {
      visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
      render();
    });

    const weekdays = panel.createDiv({ cls: "zendian-calendar-weekdays" });
    for (const day of ["一", "二", "三", "四", "五", "六", "日"]) weekdays.createSpan({ text: day });

    const grid = panel.createDiv({ cls: "zendian-calendar-grid" });
    const mondayOffset = (visibleMonth.getDay() + 6) % 7;
    const firstCell = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1 - mondayOffset);
    const today = formatDate(new Date());
    for (let index = 0; index < 42; index++) {
      const date = new Date(firstCell.getFullYear(), firstCell.getMonth(), firstCell.getDate() + index);
      const dateValue = formatDate(date);
      const button = grid.createEl("button", {
        cls: "zendian-calendar-day",
        text: String(date.getDate()),
        attr: { type: "button", "aria-label": dateValue },
      });
      button.classList.toggle("is-outside", date.getMonth() !== visibleMonth.getMonth());
      button.classList.toggle("is-today", dateValue === today);
      button.classList.toggle("is-selected", dateValue === selectedValue);
      button.addEventListener("click", () => {
        onChange({ date: dateValue });
        close();
      });
    }

    const footer = panel.createDiv({ cls: "zendian-picker-footer" });
    const clear = footer.createEl("button", { cls: "zendian-picker-text-btn", text: "清除", attr: { type: "button" } });
    const todayButton = footer.createEl("button", { cls: "zendian-picker-text-btn is-accent", text: "今天", attr: { type: "button" } });
    clear.addEventListener("click", () => { onChange({ date: "", time: "" }); close(); });
    todayButton.addEventListener("click", () => { onChange({ date: today }); close(); });
  };
  render();
}

function renderTimePicker(
  panel: HTMLElement,
  selectedValue: string,
  onChange: (value: Partial<TaskScheduleValue>) => void,
  close: () => void,
): void {
  const now = new Date();
  const match = selectedValue.match(/^(\d{2}):(\d{2})$/);
  let hour = match ? Number(match[1]) : now.getHours();
  let minute = match ? Number(match[2]) : now.getMinutes();

  panel.createDiv({ cls: "zendian-time-title", text: "选择时间" });
  const columns = panel.createDiv({ cls: "zendian-time-columns" });
  const hourColumn = createTimeColumn(columns, "小时", 24, hour, (value) => {
    hour = value;
  });
  const minuteColumn = createTimeColumn(columns, "分钟", 60, minute, (value) => {
    minute = value;
  });

  const footer = panel.createDiv({ cls: "zendian-picker-footer" });
  const clear = footer.createEl("button", { cls: "zendian-picker-text-btn", text: "清除", attr: { type: "button" } });
  const nowButton = footer.createEl("button", { cls: "zendian-picker-text-btn", text: "现在", attr: { type: "button" } });
  const confirm = footer.createEl("button", { cls: "zendian-picker-text-btn is-accent", text: "确定", attr: { type: "button" } });
  clear.addEventListener("click", () => { onChange({ time: "" }); close(); });
  nowButton.addEventListener("click", () => {
    const current = new Date();
    onChange({ time: `${String(current.getHours()).padStart(2, "0")}:${String(current.getMinutes()).padStart(2, "0")}` });
    close();
  });
  confirm.addEventListener("click", () => {
    onChange({ time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` });
    close();
  });

  requestAnimationFrame(() => {
    hourColumn.querySelector(".is-selected")?.scrollIntoView({ block: "center" });
    minuteColumn.querySelector(".is-selected")?.scrollIntoView({ block: "center" });
  });
}

function createTimeColumn(
  parent: HTMLElement,
  label: string,
  count: number,
  selected: number,
  onSelect: (value: number) => void,
): HTMLElement {
  const wrapper = parent.createDiv({ cls: "zendian-time-column-wrap" });
  wrapper.createDiv({ cls: "zendian-time-column-label", text: label });
  const column = wrapper.createDiv({ cls: "zendian-time-column", attr: { role: "listbox", "aria-label": label } });
  for (let value = 0; value < count; value++) {
    const button = column.createEl("button", {
      cls: `zendian-time-option${value === selected ? " is-selected" : ""}`,
      text: String(value).padStart(2, "0"),
      attr: { type: "button", role: "option", "aria-selected": String(value === selected) },
    });
    button.addEventListener("click", () => {
      for (const option of column.querySelectorAll(".zendian-time-option")) {
        option.classList.remove("is-selected");
        option.setAttribute("aria-selected", "false");
      }
      button.addClass("is-selected");
      button.setAttribute("aria-selected", "true");
      onSelect(value);
    });
  }
  return column;
}
