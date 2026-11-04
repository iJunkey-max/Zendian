/**
 * Shared panel primitives used by ZENdian-owned surfaces.
 *
 * The homepage remains the visual reference. This helper deliberately only
 * owns structure and semantics; each host can keep its existing class names
 * for data-specific styling while sharing the same panel frame.
 */

export interface SharedPanelShellOptions {
  panelClass: string;
  title: string;
  meta?: string;
  iconHtml?: string;
  onClose?: () => void;
  closeLabel?: string;
  bodyClass?: string;
  classNames?: Partial<SharedPanelClassNames>;
}

export interface SharedPanelClassNames {
  panel: string;
  header: string;
  icon: string;
  info: string;
  title: string;
  meta: string;
  close: string;
  body: string;
}

export interface SharedPanelShell {
  panel: HTMLElement;
  header: HTMLElement;
  icon: HTMLElement;
  info: HTMLElement;
  title: HTMLHeadingElement;
  meta: HTMLElement | null;
  closeButton: HTMLButtonElement | null;
  body: HTMLElement;
}

export interface SharedContentShellOptions {
  eyebrow: string;
  title: string;
  meta?: string;
  className?: string;
  classNames?: Partial<SharedContentClassNames>;
}

export interface SharedContentClassNames {
  heading: string;
  headingCopy: string;
  eyebrow: string;
  titleRow: string;
  title: string;
  meta: string;
  body: string;
}

export interface SharedContentShell {
  heading: HTMLElement;
  meta: HTMLElement | null;
  body: HTMLElement;
}

export interface SharedFormShellOptions {
  title: string;
  description?: string;
  panelClass?: string;
  bodyClass?: string;
  actionsClass?: string;
}

export interface SharedFormShell {
  panel: HTMLElement;
  header: HTMLElement;
  title: HTMLHeadingElement;
  description: HTMLElement | null;
  body: HTMLElement;
  actions: HTMLElement;
}

const DEFAULT_PANEL_CLASSES: SharedPanelClassNames = {
  panel: "zd-panel-shell",
  header: "zd-panel-header",
  icon: "zd-panel-icon",
  info: "zd-panel-header-info",
  title: "zd-panel-title",
  meta: "zd-panel-meta",
  close: "zd-panel-close",
  body: "zd-panel-body",
};

const DEFAULT_CONTENT_CLASSES: SharedContentClassNames = {
  heading: "zd-content-heading",
  headingCopy: "zd-content-heading-copy",
  eyebrow: "zd-content-eyebrow",
  titleRow: "zd-content-title-row",
  title: "zd-content-title",
  meta: "zd-content-count",
  body: "zd-panel-body",
};

/**
 * Create the standard ZENdian panel frame.
 *
 * Business-specific compatibility classes belong at call sites through
 * `classNames`; the shared primitive itself stays independent of any one
 * panel family (homepage, console, settings or a future extension).
 */
export function createSharedPanelShell(
  container: HTMLElement,
  options: SharedPanelShellOptions,
): SharedPanelShell {
  const classes = { ...DEFAULT_PANEL_CLASSES, ...options.classNames };
  const panel = container.createDiv({ cls: `${classes.panel} ${options.panelClass}` });
  const header = panel.createDiv({ cls: classes.header });
  const icon = header.createDiv({ cls: classes.icon });
  if (options.iconHtml) icon.innerHTML = options.iconHtml;

  const info = header.createDiv({ cls: classes.info });
  const title = info.createEl("h2", { cls: classes.title, text: options.title });
  const meta = options.meta
    ? info.createDiv({ cls: classes.meta, text: options.meta })
    : null;

  const closeButton = options.onClose
    ? header.createEl("button", {
      cls: classes.close,
      text: "×",
      attr: {
        type: "button",
        title: "关闭",
        "aria-label": options.closeLabel || `关闭${options.title}`,
      },
    })
    : null;
  closeButton?.addEventListener("click", options.onClose!);

  const body = panel.createDiv({ cls: `${classes.body}${options.bodyClass ? ` ${options.bodyClass}` : ""}` });
  return { panel, header, icon, info, title, meta, closeButton, body };
}

/** Create the repeatable heading/body shell used by project-console tabs. */
export function createSharedContentShell(
  container: HTMLElement,
  options: SharedContentShellOptions,
): SharedContentShell {
  const classes = { ...DEFAULT_CONTENT_CLASSES, ...options.classNames };
  const heading = container.createDiv({
    cls: `${classes.heading}${options.className ? ` ${options.className}` : ""}`,
  });
  const headingText = heading.createDiv({ cls: classes.headingCopy });
  headingText.createDiv({ cls: classes.eyebrow, text: options.eyebrow });
  const titleRow = headingText.createDiv({ cls: classes.titleRow });
  titleRow.createEl("h2", { cls: classes.title, text: options.title });
  const meta = options.meta
    ? titleRow.createSpan({ cls: classes.meta, text: options.meta })
    : null;
  const body = container.createDiv({ cls: classes.body });
  return { heading, meta, body };
}

/** Create a form frame that can host native Obsidian Setting controls. */
export function createSharedFormShell(
  container: HTMLElement,
  options: SharedFormShellOptions,
): SharedFormShell {
  const panel = container.createDiv({
    cls: `zd-form-shell${options.panelClass ? ` ${options.panelClass}` : ""}`,
  });
  const header = panel.createDiv({ cls: "zd-form-header" });
  const title = header.createEl("h2", { cls: "zd-form-title", text: options.title });
  const description = options.description
    ? header.createDiv({ cls: "zd-form-description", text: options.description })
    : null;
  const body = panel.createDiv({ cls: `zd-form-body${options.bodyClass ? ` ${options.bodyClass}` : ""}` });
  const actions = panel.createDiv({
    cls: `zd-form-actions${options.actionsClass ? ` ${options.actionsClass}` : ""}`,
  });
  return { panel, header, title, description, body, actions };
}
