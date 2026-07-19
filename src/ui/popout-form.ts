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
  className?: string;
  render: (container: HTMLElement, api: PopoutFormApi) => void | (() => void) | Promise<void | (() => void)>;
}

interface PopoutFormSession extends PopoutFormOptions {
  id: string;
}

const sessions = new Map<string, PopoutFormSession>();
let latestSessionId = "";

export async function openPopoutForm(app: App, options: PopoutFormOptions): Promise<boolean> {
  try {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessions.set(id, { ...options, id });
    latestSessionId = id;
    const leaf = app.workspace.openPopoutLeaf({ size: options.size });
    await leaf.setViewState({
      type: VIEW_TYPE_ZENDIAN_FORM_POPOUT,
      active: true,
      state: { sessionId: id },
    });
    void app.workspace.revealLeaf(leaf);
    return true;
  } catch (error) {
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
    let sessionId = String(this.leaf.getViewState().state?.sessionId || "");
    if (!sessions.has(sessionId) && sessions.size === 1) {
      sessionId = Array.from(sessions.keys())[0];
    } else if (!sessions.has(sessionId) && latestSessionId && sessions.has(latestSessionId)) {
      sessionId = latestSessionId;
    }
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
    if (latestSessionId === sessionId) latestSessionId = "";
    this.sessionId = "";
    const container = this.containerEl.children[1] as HTMLElement | undefined;
    container?.empty();
  }
}
