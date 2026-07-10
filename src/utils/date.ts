/**
 * 日期格式化工具函数
 * 提取自 HomepageView 和其他模块，避免重复代码
 */

/**
 * 格式化相对时间（用于最近文件等）
 * @param mtime 时间戳（毫秒）
 * @returns "刚刚" | "X 分钟前" | "X 小时前" | "X 天前" | "MM/DD"
 */
export function formatRelativeTime(mtime: number): string {
  const now = Date.now();
  const diffMs = now - mtime;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHour = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 7) return `${diffDay} 天前`;

  const d = new Date(mtime);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 格式化待办日期（用于待办列表）
 * @param ts 时间戳（毫秒）
 * @returns "今天" | "明天" | "MM-DD"
 */
export function formatTodoDate(ts: number): string {
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

/**
 * 格式化时间戳（用于笔记卡片等）
 * @param ts 时间戳（毫秒）
 * @returns "今天 HH:MM" | "昨天" | "X 天前" | "YYYY-MM-DD"
 */
export function formatTimestamp(ts: number): string {
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

/**
 * 格式化标准日期（YYYY-MM-DD）
 * @param date Date 对象或时间戳
 * @returns "YYYY-MM-DD"
 */
export function formatDate(date: Date | number): string {
  const d = typeof date === "number" ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 格式化中文日期（YYYY 年 MM 月 DD 日）
 * @param date Date 对象或时间戳
 * @returns "YYYY 年 MM 月 DD 日"
 */
export function formatChineseDate(date: Date | number): string {
  const d = typeof date === "number" ? new Date(date) : date;
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

/**
 * 获取星期几（中文）
 * @param date Date 对象或时间戳
 * @returns "星期一" ~ "星期日"
 */
export function getWeekdayChinese(date: Date | number): string {
  const d = typeof date === "number" ? new Date(date) : date;
  const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return weekdays[d.getDay()];
}
