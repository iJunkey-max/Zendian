/**
 * QuickNoteEditorModal — 便签编辑弹窗
 *
 * 功能：
 * - 分栏布局：左侧编辑器 + 右侧实时预览
 * - 自动保存（1 秒防抖）
 * - 键盘快捷键（Esc 关闭，Ctrl+S 立即保存）
 * - 使用 Obsidian 的 MarkdownRenderer 渲染预览
 */

import { App, Modal, MarkdownRenderer, Notice } from "obsidian";

export class QuickNoteEditorModal extends Modal {
  private content: string;
  private noteId: string;
  private noteLabel: string;
  private onSave: (id: string, content: string) => Promise<void>;

  private textArea!: HTMLTextAreaElement;
  private previewEl!: HTMLElement;
  private saveDebounce: number | null = null;
  private isDirty = false;

  constructor(
    app: App,
    noteId: string,
    noteLabel: string,
    initialContent: string,
    onSave: (id: string, content: string) => Promise<void>
  ) {
    super(app);
    this.noteId = noteId;
    this.noteLabel = noteLabel;
    this.content = initialContent;
    this.onSave = onSave;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("quicknote-editor-modal");

    // 标题栏
    const header = contentEl.createDiv({ cls: "quicknote-editor-header" });
    header.createEl("h2", { text: `编辑便签：${this.noteLabel}` });

    // 状态指示器
    const status = header.createDiv({ cls: "quicknote-editor-status" });
    status.createSpan({ cls: "quicknote-editor-status-text", text: "已保存" });

    // 分栏容器
    const container = contentEl.createDiv({ cls: "quicknote-editor-container" });

    // 左侧：编辑器
    const editorPane = container.createDiv({ cls: "quicknote-editor-pane" });
    editorPane.createDiv({ cls: "quicknote-editor-label", text: "编辑" });
    this.textArea = editorPane.createEl("textarea", {
      cls: "quicknote-textarea",
      value: this.content,
      attr: { placeholder: "输入便签内容...\n支持 Markdown 格式" },
    });

    // 右侧：预览
    const previewPane = container.createDiv({ cls: "quicknote-preview-pane" });
    previewPane.createDiv({ cls: "quicknote-editor-label", text: "预览" });
    this.previewEl = previewPane.createDiv({ cls: "quicknote-preview" });

    // 初始预览
    this.updatePreview();

    // 监听输入 → 防抖保存 + 更新预览
    this.textArea.addEventListener("input", () => {
      this.content = this.textArea.value;
      this.isDirty = true;
      this.updateStatus("未保存", false);
      this.scheduleSave();
      this.updatePreview();
    });

    // 键盘快捷键
    this.textArea.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      } else if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.saveNow();
      }
    });

    // 底部提示
    const footer = contentEl.createDiv({ cls: "quicknote-editor-footer" });
    footer.createSpan({ text: "提示：" });
    footer.createSpan({ cls: "quicknote-editor-hint", text: "Ctrl+S 保存 • Esc 关闭 • 自动保存 1 秒后" });

    // 自动聚焦
    setTimeout(() => {
      this.textArea.focus();
      this.textArea.setSelectionRange(this.content.length, this.content.length);
    }, 50);
  }

  /**
   * 更新预览
   */
  private updatePreview(): void {
    this.previewEl.empty();

    if (!this.content.trim()) {
      this.previewEl.createDiv({ cls: "quicknote-preview-empty", text: "预览区域为空" });
      return;
    }

    // 使用 Obsidian 的 MarkdownRenderer
    MarkdownRenderer.renderMarkdown(this.content, this.previewEl, "", null as any);
  }

  /**
   * 防抖保存
   */
  private scheduleSave(): void {
    if (this.saveDebounce !== null) {
      window.clearTimeout(this.saveDebounce);
    }

    this.updateStatus("保存中...", false);

    this.saveDebounce = window.setTimeout(() => {
      this.saveNow();
      this.saveDebounce = null;
    }, 1000);
  }

  /**
   * 立即保存
   */
  private async saveNow(): Promise<void> {
    if (!this.isDirty) return;

    try {
      await this.onSave(this.noteId, this.content);
      this.isDirty = false;
      this.updateStatus("已保存", true);
    } catch (e) {
      console.error("[QuickNoteEditor] 保存失败:", e);
      this.updateStatus("保存失败", false);
      new Notice("便签保存失败");
    }
  }

  /**
   * 更新状态指示器
   */
  private updateStatus(text: string, success: boolean): void {
    const statusEl = this.contentEl.querySelector(".quicknote-editor-status-text");
    if (statusEl) {
      statusEl.textContent = text;

      // 移除所有状态类
      statusEl.removeClass("is-saved");
      statusEl.removeClass("is-saving");
      statusEl.removeClass("is-error");

      // 添加对应状态类
      if (text === "已保存") {
        statusEl.addClass("is-saved");
      } else if (text === "保存中...") {
        statusEl.addClass("is-saving");
      } else if (text === "保存失败") {
        statusEl.addClass("is-error");
      }
    }
  }

  async onClose(): Promise<void> {
    // 确保最后的更改已保存
    if (this.saveDebounce !== null) {
      window.clearTimeout(this.saveDebounce);
      await this.saveNow();
    }

    this.contentEl.empty();
  }
}
