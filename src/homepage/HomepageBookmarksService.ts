import { App, type TFile } from "obsidian";
import type { HomepageBookmarkEntry } from "./types";
import { HomepageBookmarksAdapter } from "./HomepageAdapters";

export class HomepageBookmarksService {
  private readonly adapter: HomepageBookmarksAdapter;

  constructor(app: App) {
    this.adapter = new HomepageBookmarksAdapter(app);
  }

  async getBookmarks(limit = 8): Promise<HomepageBookmarkEntry[]> {
    const items = await this.adapter.readBookmarks();
    return items.slice(0, Math.max(1, limit));
  }

  async openBookmark(entry: HomepageBookmarkEntry): Promise<TFile | null> {
    return this.adapter.openBookmark(entry);
  }
}
