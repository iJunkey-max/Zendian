import { App, type TFile } from "obsidian";
import type { HomepageDailyNoteSettings, HomepageDailyNoteSummary } from "./types";
import { HomepageDailyNoteAdapter } from "./HomepageAdapters";

export class HomepageDailyNoteService {
  private readonly adapter: HomepageDailyNoteAdapter;

  constructor(private app: App) {
    this.adapter = new HomepageDailyNoteAdapter(app);
  }

  async getTodayNote(settings: HomepageDailyNoteSettings): Promise<HomepageDailyNoteSummary> {
    return this.adapter.resolveToday(settings);
  }

  async openTodayNote(settings: HomepageDailyNoteSettings): Promise<TFile> {
    return this.adapter.openToday(settings);
  }
}
