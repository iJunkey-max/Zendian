import { App, ItemView, type WorkspaceLeaf } from "obsidian";

export const VIEW_TYPE_ZENDIAN_FORM_POPOUT = "zendian-form-popout";

export interface PopoutFormApi {
  close: () => void;
  leaf: WorkspaceLeaf;
}

export interface PopoutFormOptions {
  title: string;
  icon?: string;
  size: {
    width: number;
    height: number;
  };
  position?: "bottom-right";
  className?: string;
  render: (container: HTMLElement, api: PopoutFormApi) => void | (() => void) | Promise<void | (() => void)>;
}

interface PopoutFormSession extends PopoutFormOptions {
  id: string;
}

const sessions = new Map<string, PopoutFormSession>();
const leafSessions = new WeakMap<WorkspaceLeaf, string>();

export async function openPopoutForm(app: App, options: PopoutFormOptions): Promise<boolean> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let leaf: WorkspaceLeaf | null = null;
  try {
    sessions.set(id, { ...options, id });
    leaf = app.workspace.getLeaf("window");
    leafSessions.set(leaf, id);
    await leaf.setViewState({
      type: VIEW_TYPE_ZENDIAN_FORM_POPOUT,
      active: true,
      state: { sessionId: id },
    });
    void app.workspace.revealLeaf(leaf);
    {
      const popoutWindow = leaf.view.containerEl.ownerDocument.defaultView;
      const settleWindow = (): void => {
        if (!popoutWindow || popoutWindow.closed) return;
        popoutWindow.resizeTo(options.size.width, options.size.height);
        if (options.position !== "bottom-right") return;
        const currentDisplay = popoutWindow.screen as Screen & { availLeft?: number; availTop?: number };
        const currentLeft = currentDisplay.availLeft ?? 0;
        const currentTop = currentDisplay.availTop ?? 0;
        const width = Math.min(popoutWindow.outerWidth || options.size.width, currentDisplay.availWidth - 32);
        const height = Math.min(popoutWindow.outerHeight || options.size.height, currentDisplay.availHeight - 32);
        popoutWindow.moveTo(
          currentLeft + currentDisplay.availWidth - width - 16,
          currentTop + currentDisplay.availHeight - height - 16,
        );
      };
      settleWindow();
      popoutWindow?.requestAnimationFrame(settleWindow);
    }
    return true;
  } catch (error) {
    sessions.delete(id);
    if (leaf) {
      leafSessions.delete(leaf);
      try { await leaf.detach(); } catch (cleanupError) { console.warn("[ZENdian] Failed to close popout.", cleanupError); }
    }
    console.warn("[ZENdian] Failed to open popout form.", error);
    return false;
  }
}

export class PopoutFormView extends ItemView {
  private session: PopoutFormSession | null = null;
  private sessionId = "";
  private cleanup: (() => void) | null = null;

  getViewType(): string {
    return VIEW_TYPE_ZENDIAN_FORM_POPOUT;
  }

  getDisplayText(): string {
    return this.session?.title || "ZENdian";
  }

  getIcon(): string {
    return this.session?.icon || "panel-top-open";
  }

  async onOpen(): Promise<void> {
    const sessionId = leafSessions.get(this.leaf) || String(this.leaf.getViewState().state?.sessionId || "");
    this.sessionId = sessionId;
    this.session = sessions.get(sessionId) || null;
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("zendian-popout-form");
    if (this.session?.className) container.addClass(this.session.className);

    if (!this.session) {
      container.createEl("h2", { text: "面板已过期" });
      container.createDiv({ text: "请关闭此窗口后重新打开。" });
      return;
    }

    const cleanup = await this.session.render(container, {
      leaf: this.leaf,
      close: () => {
        void this.leaf.detach();
      },
    });
    if (typeof cleanup === "function") this.cleanup = cleanup;
  }

  async onClose(): Promise<void> {
    this.cleanup?.();
    this.cleanup = null;
    const sessionId = this.sessionId || String(this.leaf.getViewState().state?.sessionId || "");
    if (sessionId) sessions.delete(sessionId);
    leafSessions.delete(this.leaf);
    this.sessionId = "";
    const container = this.containerEl.children[1] as HTMLElement | undefined;
    container?.empty();
  }
}
