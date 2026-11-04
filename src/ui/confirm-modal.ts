import { App, Modal, Setting } from "obsidian";

export interface ConfirmActionOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  warning?: boolean;
}

class ConfirmActionModal extends Modal {
  private settled = false;

  constructor(
    app: App,
    private readonly options: ConfirmActionOptions,
    private readonly resolve: (value: boolean) => void,
  ) {
    super(app);
    this.modalEl.addClass("zendian-shared-modal");
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: this.options.title });
    contentEl.createEl("p", { text: this.options.message });

    const actions = new Setting(contentEl);
    actions.settingEl.addClass("zendian-confirm-actions");
    actions.addButton((button) => button
      .setButtonText(this.options.cancelText ?? "取消")
      .onClick(() => this.close()));
    actions.addButton((button) => {
      button.setButtonText(this.options.confirmText ?? "确认");
      if (this.options.warning !== false) button.setWarning();
      button.onClick(() => {
        if (this.settled) return;
        this.settled = true;
        this.resolve(true);
        this.close();
      });
    });
  }

  onClose(): void {
    if (!this.settled) {
      this.settled = true;
      this.resolve(false);
    }
    this.contentEl.empty();
  }
}

export function confirmAction(app: App, options: ConfirmActionOptions): Promise<boolean> {
  return new Promise((resolve) => new ConfirmActionModal(app, options, resolve).open());
}
