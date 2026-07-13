/**
 * HomepageDataService — JSON 数据持久化
 *
 * 管理主页业务数据（项目、便签、格言）
 * 存储路径：.obsidian/plugins/zendian/homepage-data.json
 */

import { App, TFile } from "obsidian";
import type { HomepageData, HomepageQuickNote, HomepageQuote } from "./types";

const DATA_FILE = ".obsidian/plugins/zendian/homepage-data.json";

const DEFAULT_QUOTES: HomepageQuote[] = [
  { text: "每一个你不知道的时刻，都是你未触及的边界。", author: "海马星球" },
  { text: "学而不思则罔，思而不学则殆。", author: "孔子" },
  { text: "千里之行，始于足下。", author: "老子" },
  { text: "吾生也有涯，而知也无涯。", author: "庄子" },
  { text: "博学之，审问之，慎思之，明辨之，笃行之。", author: "《中庸》" },
  { text: "业精于勤，荒于嬉；行成于思，毁于随。", author: "韩愈" },
  { text: "路漫漫其修远兮，吾将上下而求索。", author: "屈原" },
  { text: "纸上得来终觉浅，绝知此事要躬行。", author: "陆游" },
  { text: "知之为知之，不知为不知，是知也。", author: "孔子" },
  { text: "温故而知新，可以为师矣。", author: "孔子" },
];

const DEFAULT_DATA: HomepageData = {
  quickNotes: [],
  quotes: DEFAULT_QUOTES,
};

export class HomepageDataService {
  private data: HomepageData = DEFAULT_DATA;
  private loaded = false;

  constructor(private app: App) {}

  /**
   * 加载数据（首次调用时从文件读取）
   */
  async load(): Promise<HomepageData> {
    if (this.loaded) return this.data;

    try {
      const exists = await this.app.vault.adapter.exists(DATA_FILE);
      if (exists) {
        const raw = await this.app.vault.adapter.read(DATA_FILE);
        const parsed = JSON.parse(raw);
        this.data = this.mergeWithDefaults(parsed);
      } else {
        this.data = { ...DEFAULT_DATA };
        await this.save();
      }
    } catch {
      this.data = { ...DEFAULT_DATA };
    }

    this.loaded = true;
    return this.data;
  }

  /**
   * 保存数据到文件
   */
  async save(): Promise<void> {
    try {
      const dir = DATA_FILE.substring(0, DATA_FILE.lastIndexOf("/"));
      if (!(await this.app.vault.adapter.exists(dir))) {
        await this.app.vault.adapter.mkdir(dir);
      }
      await this.app.vault.adapter.write(DATA_FILE, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.error("[ZENdian] Failed to save homepage data:", e);
    }
  }

  // ── 便签管理 ──────────────────────────────────────────────

  getQuickNotes(): HomepageQuickNote[] {
    return this.data.quickNotes;
  }

  async addQuickNote(label: string, path: string, color: string, content?: string): Promise<HomepageQuickNote> {
    const note: HomepageQuickNote = {
      id: this.generateId(),
      label,
      path,
      color,
      content,
    };
    this.data.quickNotes.push(note);
    await this.save();
    return note;
  }

  async deleteQuickNote(id: string): Promise<void> {
    this.data.quickNotes = this.data.quickNotes.filter((n) => n.id !== id);
    await this.save();
  }

  async updateQuickNoteContent(id: string, content: string): Promise<void> {
    const note = this.data.quickNotes.find((n) => n.id === id);
    if (note) {
      note.content = content;
      const file = this.app.vault.getAbstractFileByPath(note.path);
      if (file instanceof TFile) {
        await this.app.vault.modify(file, content);
      } else {
        await this.app.vault.create(note.path, content);
      }
      await this.save();
    }
  }

  async updateQuickNote(id: string, updates: Partial<Omit<HomepageQuickNote, "id">>): Promise<void> {
    const note = this.data.quickNotes.find((n) => n.id === id);
    if (note) {
      Object.assign(note, updates);
      await this.save();
    }
  }

  // ── 格言 ─────────────────────────────────────────────────

  getQuotes(): HomepageQuote[] {
    return this.data.quotes.length > 0 ? this.data.quotes : DEFAULT_QUOTES;
  }

  /**
   * 获取今日格言（按日期固定，同一天显示同一条）
   */
  getTodayQuote(): HomepageQuote {
    const quotes = this.getQuotes();
    const today = new Date();
    const dayOfYear = Math.floor(
      (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86_400_000
    );
    return quotes[dayOfYear % quotes.length];
  }

  // ── 私有方法 ──────────────────────────────────────────────

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  private mergeWithDefaults(raw: Partial<HomepageData>): HomepageData {
    return {
      quickNotes: Array.isArray(raw.quickNotes) ? raw.quickNotes : [],
      quotes: Array.isArray(raw.quotes) && raw.quotes.length > 0 ? raw.quotes : DEFAULT_QUOTES,
    };
  }
}
