/**
 * HomepageStatsService — Vault 统计扫描
 *
 * 提供热力图、月度统计、最近笔记等数据
 */

import { App, type TFile } from "obsidian";
import type { HeatmapDay, MonthlyStats, RecentNoteItem } from "./types";

export class HomepageStatsService {
  constructor(private app: App) {}

  /**
   * 获取热力图数据（最近 N 天的文件修改计数）
   * @param days 天数，默认 245（35 周）
   */
  getHeatmapData(days = 245): HeatmapDay[] {
    const now = new Date();
    const startMs = now.getTime() - days * 86_400_000;
    const counts = new Map<string, number>();

    // 初始化所有日期为 0
    for (let i = 0; i < days; i++) {
      const d = new Date(startMs + i * 86_400_000);
      counts.set(this.formatDate(d), 0);
    }

    // 统计文件修改时间
    const files = this.app.vault.getFiles();
    for (const file of files) {
      const mtime = file.stat.mtime;
      if (mtime >= startMs) {
        const key = this.formatDate(new Date(mtime));
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries()).map(([date, count]) => ({ date, count }));
  }

  /**
   * 获取月度统计
   */
  getMonthlyStats(): MonthlyStats {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthStart = new Date(year, month, 1).getTime();
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();

    const files = this.app.vault.getFiles();
    let noteCount = 0;
    let editCount = 0;
    const activeDaysSet = new Set<string>();

    for (const file of files) {
      const ctime = file.stat.ctime;
      const mtime = file.stat.mtime;

      // 本月创建的笔记
      if (ctime >= monthStart && ctime <= monthEnd) {
        noteCount++;
      }

      // 本月编辑的笔记
      if (mtime >= monthStart && mtime <= monthEnd) {
        editCount++;
        activeDaysSet.add(this.formatDate(new Date(mtime)));
      }
    }

    const activeDays = activeDaysSet.size;
    const consecutiveDays = this.calcConsecutiveDays(activeDaysSet);

    return {
      noteCount,
      editCount,
      taskCompleted: 0, // 需要扫描 vault 中的 [x] 任务
      newTags: 0,       // 需要扫描 frontmatter 标签
      activeDays,
      consecutiveDays,
    };
  }

  /**
   * 获取最近修改的笔记
   */
  getRecentNotes(limit: number): RecentNoteItem[] {
    const files = this.app.vault.getMarkdownFiles();

    // 按修改时间排序
    const sorted = files
      .filter((f) => !f.path.startsWith(".obsidian/"))
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .slice(0, limit);

    return sorted.map((file) => ({
      title: file.basename,
      path: file.path,
      mtime: file.stat.mtime,
      tags: this.extractTags(file),
      preview: "", // 需要异步读取，先留空
    }));
  }

  /**
   * 异步获取笔记预览内容（前 N 个字符）
   */
  async getNotePreview(path: string, maxLen = 80): Promise<string> {
    try {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) return "";
      const content = await this.app.vault.cachedRead(file);
      // 去掉 frontmatter 和标题行
      const cleaned = content
        .replace(/^---[\s\S]*?---\n?/, "")
        .replace(/^#+\s+.*$/gm, "")
        .replace(/\n+/g, " ")
        .trim();
      return cleaned.slice(0, maxLen);
    } catch {
      return "";
    }
  }

  /**
   * 获取今日笔记路径和状态
   */
  getDailyNoteInfo(): { path: string; exists: boolean } {
    const dailyNotesPlugin = (this.app as any).internalPlugins?.getPluginById?.("daily-notes");
    const settings = dailyNotesPlugin?.instance?.settings ?? dailyNotesPlugin?.settings ?? {};
    const folder = settings.folder ?? "";
    const format = settings.format ?? "YYYY-MM-DD";

    const now = new Date();
    const dateStr = this.formatDateByPattern(now, format);
    const path = folder ? `${folder}/${dateStr}.md` : `${dateStr}.md`;
    const exists = this.app.vault.getAbstractFileByPath(path) instanceof TFile;

    return { path, exists };
  }

  // ── 私有方法 ──────────────────────────────────────────────

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  private formatDateByPattern(d: Date, pattern: string): string {
    const tokens: Array<[string, string]> = [
      ["YYYY", `${d.getFullYear()}`],
      ["MM", `${d.getMonth() + 1}`.padStart(2, "0")],
      ["DD", `${d.getDate()}`.padStart(2, "0")],
      ["M", `${d.getMonth() + 1}`],
      ["D", `${d.getDate()}`],
    ];
    let result = pattern;
    for (const [token, replacement] of tokens) {
      result = result.replace(new RegExp(token, "g"), replacement);
    }
    return result;
  }

  /**
   * 计算连续活跃天数（从今天往回数）
   */
  private calcConsecutiveDays(activeDays: Set<string>): number {
    let count = 0;
    const now = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(now.getTime() - i * 86_400_000);
      if (activeDays.has(this.formatDate(d))) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  /**
   * 从文件提取 YAML frontmatter 标签
   */
  private extractTags(file: TFile): string[] {
    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;
    if (!frontmatter) return [];

    const tags = frontmatter.tags;
    if (Array.isArray(tags)) return tags.map(String).slice(0, 3);
    if (typeof tags === "string") return tags.split(",").map((t: string) => t.trim()).slice(0, 3);
    return [];
  }
}
