/** QuickNoteModal - 便签添加/编辑面板 */

import { App, Modal, Notice, Setting, TFolder } from "obsidian";
import type { HomepageQuickNote } from "./types";
import { createSharedFormShell } from "../ui/panel-shell";

type QuickNoteSaveCallback = (note: Omit<HomepageQuickNote, "id">) => Promise<void> | void;

const FOLDER_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H9l2 2h7.5A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5Z"/></svg>`;

export class QuickNoteModal extends Modal {
  private form: QuickNoteFormController;

  constructor(app: App, onSave: QuickNoteSaveCallback, existing?: HomepageQuickNote, fixedFolderPath = "") {
    super(app);
    this.form = new QuickNoteFormController(app, onSave, existing, fixedFolderPath, () => this.close());
  }

  onOpen(): void {
    this.modalEl.addClass("zendian-shared-modal");
    this.form.render(this.contentEl);
  }

  onClose(): void {
    this.form.destroy();
    this.contentEl.empty();
  }
}

export function renderQuickNoteForm(
  app: App,
  container: HTMLElement,
  onSave: QuickNoteSaveCallback,
  existing: HomepageQuickNote | undefined,
  fixedFolderPath: string,
  close: () => void,
): QuickNoteFormController {
  const form = new QuickNoteFormController(app, onSave, existing, fixedFolderPath, close);
  form.render(container);
  return form;
}

export class QuickNoteFormController {
  private label = "";
  private folderPath = "";
  private folders: string[] = [];
  private suggestionsEl: HTMLElement | null = null;
  private previewEl: HTMLElement | null = null;
  private activeSuggestion = 0;
  private filteredFolders: string[] = [];
  private fixedFolderPath: string;

  constructor(
    private app: App,
    private onSave: QuickNoteSaveCallback,
    existing: HomepageQuickNote | undefined,
    fixedFolderPath: string,
    private close: () => void,
  ) {
    this.fixedFolderPath = fixedFolderPath.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    if (this.fixedFolderPath) this.folderPath = this.fixedFolderPath;
    this.folders = app.vault.getAllLoadedFiles()
      .filter((item): item is TFolder => item instanceof TFolder && Boolean(item.path))
      .map((folder) => folder.path)
      .sort((a, b) => a.localeCompare(b, "zh-CN"));

    if (existing) {
      this.label = existing.label;
      const separator = existing.path.lastIndexOf("/");
      this.folderPath = this.fixedFolderPath || (separator >= 0 ? existing.path.slice(0, separator) : "");
    }
  }

  render(contentEl: HTMLElement): void {
    contentEl.empty();
    const shell = createSharedFormShell(contentEl, {
      title: "新建灵感速记",
      description: this.fixedFolderPath
        ? `将自动保存到“${this.fixedFolderPath}”文件夹。`
        : "选择仓库文件夹，速记将绑定到同名 Markdown 文件。",
      panelClass: "zendian-quicknote-create-modal",
      actionsClass: "zendian-popout-form-actions",
    });
    const formBody = shell.body;

    new Setting(formBody)
      .setName("标签名称")
      .addText((text) => {
        text
          .setPlaceholder("例如：今日想法")
          .setValue(this.label)
          .onChange((value) => {
            this.label = value;
            this.updatePathPreview();
          });
        text.inputEl.addClass("zendian-quicknote-label-input");
      });

    if (!this.fixedFolderPath) {
      const folderSetting = new Setting(formBody).setName("存放文件夹");
      folderSetting.settingEl.addClass("zendian-quicknote-folder-setting");
      folderSetting.controlEl.addClass("zendian-quicknote-folder-control");
      folderSetting.addText((text) => {
        text.setPlaceholder("输入路径搜索文件夹").setValue(this.folderPath || "/");
        const input = text.inputEl;
        input.addClass("zendian-quicknote-folder-input");
        input.setAttribute("autocomplete", "off");
        input.setAttribute("spellcheck", "false");
        input.setAttribute("role", "combobox");
        input.setAttribute("aria-autocomplete", "list");
        input.setAttribute("aria-expanded", "false");

        this.suggestionsEl = folderSetting.controlEl.createDiv({
          cls: "zendian-quicknote-folder-suggestions",
          attr: { role: "listbox", "aria-label": "文件夹建议" },
        });
        this.suggestionsEl.hide();

        const updateSuggestions = (): void => {
          this.folderPath = normalizeFolderInput(input.value);
          this.activeSuggestion = 0;
          this.renderFolderSuggestions(input);
          this.updatePathPreview();
        };
        input.addEventListener("input", updateSuggestions);
        input.addEventListener("focus", () => this.renderFolderSuggestions(input));
        input.addEventListener("blur", () => window.setTimeout(() => this.hideSuggestions(input), 120));
        input.addEventListener("keydown", (event) => this.handleFolderKeydown(event, input));
      });
    }

    this.previewEl = formBody.createDiv({ cls: "zendian-quicknote-path-preview" });
    this.updatePathPreview();

    const actions = shell.actions;
    const cancel = actions.createEl("button", { text: "取消", attr: { type: "button" } });
    cancel.addEventListener("click", () => this.close());
    const submit = actions.createEl("button", { cls: "mod-cta", text: "创建速记", attr: { type: "button" } });
    submit.addEventListener("click", async () => this.saveNote());
  }

  destroy(): void {
    this.suggestionsEl = null;
    this.previewEl = null;
  }

  private renderFolderSuggestions(input: HTMLInputElement): void {
    if (!this.suggestionsEl) return;
    const query = normalizeFolderInput(input.value).toLocaleLowerCase("zh-CN");
    const candidates = ["", ...this.folders];
    this.filteredFolders = candidates
      .filter((path) => !query || path.toLocaleLowerCase("zh-CN").includes(query))
      .sort((a, b) => folderScore(a, query) - folderScore(b, query) || a.localeCompare(b, "zh-CN"))
      .slice(0, 8);

    this.suggestionsEl.empty();
    if (!this.filteredFolders.length) {
      this.suggestionsEl.createDiv({ cls: "zendian-quicknote-folder-empty", text: "没有匹配的文件夹" });
    } else {
      this.filteredFolders.forEach((path, index) => {
        const option = this.suggestionsEl!.createDiv({
          cls: `zendian-quicknote-folder-option${index === this.activeSuggestion ? " is-active" : ""}`,
          attr: { role: "option", "aria-selected": String(index === this.activeSuggestion) },
        });
        const icon = option.createSpan({ cls: "zendian-quicknote-folder-icon" });
        icon.innerHTML = FOLDER_ICON;
        option.createSpan({
          cls: "zendian-quicknote-folder-path",
          text: path || "仓库根目录",
        });
        option.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          this.selectFolder(path, input);
        });
      });
    }
    this.suggestionsEl.show();
    input.setAttribute("aria-expanded", "true");
  }

  private handleFolderKeydown(event: KeyboardEvent, input: HTMLInputElement): void {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!this.filteredFolders.length) this.renderFolderSuggestions(input);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      this.activeSuggestion = Math.max(0, Math.min(this.filteredFolders.length - 1, this.activeSuggestion + direction));
      this.updateActiveSuggestion();
    } else if (event.key === "Enter" && this.suggestionsEl?.isShown() && this.filteredFolders.length) {
      event.preventDefault();
      this.selectFolder(this.filteredFolders[this.activeSuggestion], input);
    } else if (event.key === "Escape") {
      this.hideSuggestions(input);
    }
  }

  private updateActiveSuggestion(): void {
    if (!this.suggestionsEl) return;
    this.suggestionsEl.querySelectorAll<HTMLElement>(".zendian-quicknote-folder-option").forEach((option, index) => {
      option.classList.toggle("is-active", index === this.activeSuggestion);
      option.setAttribute("aria-selected", String(index === this.activeSuggestion));
      if (index === this.activeSuggestion) option.scrollIntoView({ block: "nearest" });
    });
  }

  private selectFolder(path: string, input: HTMLInputElement): void {
    this.folderPath = path;
    input.value = path || "/";
    this.hideSuggestions(input);
    this.updatePathPreview();
  }

  private hideSuggestions(input: HTMLInputElement): void {
    this.suggestionsEl?.hide();
    input.setAttribute("aria-expanded", "false");
  }

  private updatePathPreview(): void {
    if (!this.previewEl) return;
    this.previewEl.empty();
    const icon = this.previewEl.createSpan({ cls: "zendian-quicknote-path-preview-icon" });
    icon.innerHTML = FOLDER_ICON;
    const label = normalizeLabel(this.label) || "标签名称";
    const path = this.folderPath ? `${this.folderPath}/${label}.md` : `${label}.md`;
    const text = this.previewEl.createDiv({ cls: "zendian-quicknote-path-preview-text" });
    text.createSpan({ cls: "zendian-quicknote-path-preview-caption", text: "将绑定到" });
    text.createSpan({ cls: "zendian-quicknote-path-preview-value", text: path });
  }

  private async saveNote(): Promise<void> {
    const label = normalizeLabel(this.label);
    if (!label) {
      new Notice("请填写便签标签名称");
      return;
    }
    if (/[\\/:*?"<>|]/.test(label)) {
      new Notice("标签名称不能包含 \\ / : * ? \" < > |");
      return;
    }
    const folderPath = normalizeFolderInput(this.folderPath);
    if (folderPath && !(this.app.vault.getAbstractFileByPath(folderPath) instanceof TFolder)) {
      new Notice("请选择仓库中已有的文件夹");
      return;
    }
    const path = folderPath ? `${folderPath}/${label}.md` : `${label}.md`;
    try {
      await this.onSave({ label, path, color: "default" });
      this.close();
    } catch (error) {
      console.error("[ZENdian] 创建灵感速记失败:", error);
      new Notice(error instanceof Error ? error.message : "创建灵感速记失败");
    }
  }
}

function normalizeFolderInput(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function normalizeLabel(value: string): string {
  return value.trim().replace(/\.md$/i, "").trim();
}

function folderScore(path: string, query: string): number {
  if (!query) return path ? path.split("/").length : 0;
  const lowerPath = path.toLocaleLowerCase("zh-CN");
  const name = lowerPath.split("/").pop() || "";
  if (lowerPath === query) return 0;
  if (name.startsWith(query)) return 1;
  if (lowerPath.startsWith(query)) return 2;
  return 3;
}
