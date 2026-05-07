/**
 * ZENdian Plugin 统一设置类型定义
 *
 * 设计原则：
 * 1. 按功能模块分组，每个模块拥有独立的设置命名空间
 * 2. 使用字面量类型约束选项值
 * 3. 所有字段必须有明确的类型，不允许 any
 */

// ============================================================
// 子类型定义
// ============================================================

/** 标题样式设置 */
export interface HeadingStyle {
  divider: boolean;
  weight: number;
  textTransform: string;
  colorScheme: "default" | "accent";
  alignment: "left" | "center" | "right";
  spacingStart: number;
  spacingEnd: number;
  size: number;
  style?: string;
}

/** H1 特有设置 */
export type H1Style = Omit<HeadingStyle, "spacingStart" | "spacingEnd">;

/** 页内标题设置 */
export interface InlineTitleStyle {
  dividerRemove: boolean;
  size: string;
  weight: number;
}

/** 代码块主题 */
export type CodeblockTheme =
  | "customize"
  | "dracula"
  | "solarized-light"
  | "solarized-dark"
  | "one-dark";

/** 标注风格 */
export type CalloutStyle =
  | "customize"
  | "style-1"
  | "style-2"
  | "style-3"
  | "style-4";

/** 表格宽度模式 */
export type TableWidthMode = "default" | "obsidian-default" | "customized";

/** 新标签页按钮样式 */
export type NewTabButtonStyle = "text-btn-restore" | "default";

/** 新标签页图像 */
export type NewTabImage = "none" | "default" | "old" | "customize";

/** Canvas 菜单位置 */
export type CanvasMenuPosition = "center" | "left" | "right";

/** DB Folder 背景色方案 */
export type DBTableBgColor = "default" | "adapt" | "unify";

/** Projects 背景色方案 */
export type ProjectsBgColor = "default" | "adapt" | "unify";

// ============================================================
// 模块设置接口
// ============================================================

/** 自动隐藏模块设置 */
export interface AutoHideSettings {
  tab: boolean;
  statusBar: boolean;
  ribbon: boolean;
  navHeader: boolean;
  tabBar: boolean;
  vaultProfile: boolean;
}

/** 卡片布局模块设置 */
export interface CardLayoutSettings {
  enabled: boolean;
  canvasBorder: string;
  canvasMenu: CanvasMenuPosition;
  mediaEmbedBorderOff: boolean;
}

/** 标题样式模块设置 */
export interface HeadingSettings {
  h1: H1Style;
  h2: HeadingStyle;
  h3: HeadingStyle;
  h4: HeadingStyle;
  h5: HeadingStyle;
  h6: HeadingStyle;
  inlineTitle: InlineTitleStyle;
  collapseIconRestore: boolean;
  indicatorOff: boolean;
}

/** 编辑器增强模块设置 */
export interface EditorEnhanceSettings {
  focusMode: boolean;
  focusModeOpacity: number;
  hoverIndicator: boolean;
  hoverIndicatorListLevel: boolean;
  hoverIndicatorCodeblockLineNumber: boolean;
  gridBackground: boolean;
  gridBackgroundSize: string;
}

/** 排版模块设置 */
export interface TypographySettings {
  fileLineWidth: number;
  letterSpacing: number;
  lineHeight: number;
  codeLineHeight: number;
  blockquoteLineHeight: number;
  tableLineHeight: number;
  paragraphSpacing: string;
  paragraphSpacingBr: boolean;
  textAlignJustify: boolean;
}

/** 代码块模块设置 */
export interface CodeBlockSettings {
  theme: CodeblockTheme;
  backgroundLight: string;
  backgroundDark: string;
  borderLight: string;
  borderDark: string;
}

/** 引用块模块设置 */
export interface BlockquoteSettings {
  backgroundLight: string;
  backgroundDark: string;
}

/** 标注模块设置 */
export interface CalloutSettings {
  style: CalloutStyle;
  borderOpacity: number;
}

/** 列表与表格模块设置 */
export interface ListTableSettings {
  listIndent: string;
  listSpacing: string;
  ulMarkerRestore: boolean;
  disableAlternativeCheckboxes: boolean;
  tableWidthMode: TableWidthMode;
  tableWidth: number;
  tableHeaderBgLight: string;
  tableHeaderBgDark: string;
}

/** 链接模块设置 */
export interface LinkSettings {
  decoration: string;
  decorationHover: string;
  decorationThickness: string;
  externalDecoration: string;
  externalDecorationHover: string;
}

/** 图片模块设置 */
export interface ImageSettings {
  centerAlign: boolean;
  darken: boolean;
  zoomOff: boolean;
}

/** 嵌入文档模块设置 */
export interface EmbedSettings {
  seamless: boolean;
  maxHeight: string;
}

/** 复选框模块设置 */
export interface CheckboxSettings {
  colorful: boolean;
}

/** 文件夹层级遮罩模块设置 */
export interface RainbowFolderSettings {
  enabled: boolean;
  opacity: number;
}

/** 新标签页模块设置 */
export interface NewTabSettings {
  buttonStyle: NewTabButtonStyle;
  imageStyle: NewTabImage;
  imageUrl: string;
}

/** Canvas 模块设置 */
export interface CanvasSettings {
  immersive: boolean;
}

/** 滚动条模块设置 */
export interface ScrollbarSettings {
  hide: boolean;
  restored: boolean;
}

/** 大纲增强模块设置 */
export interface OutlineSettings {
  enhanced: boolean;
}

/** 移动端模块设置 */
export interface MobileSettings {
  cardLayoutPad: boolean;
  drawerPhoneFullWidth: boolean;
}

/** 第三方插件兼容模块设置 */
export interface PluginCompatSettings {
  dbTableFullWidthOff: boolean;
  dbTableBgColor: DBTableBgColor;
  projectsBgColor: ProjectsBgColor;
  surfingBookmarkBarHide: boolean;
  colorfulCheckbox: boolean;
}

/** UI 细节模块设置 */
export interface UIDetailSettings {
  settingItemTitleIconRemove: boolean;
  extraAnimRemove: boolean;
  animSpeed: number;
}

/** 文件树模块设置 */
export interface FileTreeSettings {
  ctaBtnEnable: boolean;
  fileNamesUntrim: boolean;
  folderFontBold: boolean;
  fileIconRemove: boolean;
  colorfulFolder: boolean;
}

// ============================================================
// 顶层设置接口
// ============================================================

/**
 * ZENdian Plugin 完整设置对象
 *
 * 结构化分组，每个模块拥有独立命名空间
 */
export interface PluginSettings {
  autoHide: AutoHideSettings;
  cardLayout: CardLayoutSettings;
  headings: HeadingSettings;
  editorEnhance: EditorEnhanceSettings;
  typography: TypographySettings;
  codeBlock: CodeBlockSettings;
  blockquote: BlockquoteSettings;
  callout: CalloutSettings;
  listTable: ListTableSettings;
  link: LinkSettings;
  image: ImageSettings;
  embed: EmbedSettings;
  checkbox: CheckboxSettings;
  rainbowFolder: RainbowFolderSettings;
  newTab: NewTabSettings;
  canvas: CanvasSettings;
  scrollbar: ScrollbarSettings;
  outline: OutlineSettings;
  mobile: MobileSettings;
  pluginCompat: PluginCompatSettings;
  uiDetail: UIDetailSettings;
  fileTree: FileTreeSettings;
}

// ============================================================
// 默认设置
// ============================================================

/** 默认设置值 */
export const DEFAULT_SETTINGS: PluginSettings = {
  autoHide: {
    tab: false,
    statusBar: false,
    ribbon: false,
    navHeader: false,
    tabBar: false,
    vaultProfile: false,
  },
  cardLayout: {
    enabled: true,
    canvasBorder: "2px solid",
    canvasMenu: "center",
    mediaEmbedBorderOff: false,
  },
  headings: {
    h1: {
      divider: false,
      weight: 700,
      textTransform: "",
      colorScheme: "default",
      alignment: "center",
      size: 1.618,
    },
    h2: {
      divider: false,
      weight: 675,
      textTransform: "",
      colorScheme: "default",
      alignment: "left",
      spacingStart: 1.318,
      spacingEnd: 1.318,
      size: 1.462,
      style: "twin",
    },
    h3: {
      divider: false,
      weight: 650,
      textTransform: "",
      colorScheme: "default",
      alignment: "left",
      spacingStart: 1.5,
      spacingEnd: 1.5,
      size: 1.318,
    },
    h4: {
      divider: false,
      weight: 625,
      textTransform: "",
      colorScheme: "default",
      alignment: "left",
      spacingStart: 1.5,
      spacingEnd: 1.5,
      size: 1.2,
    },
    h5: {
      divider: false,
      weight: 600,
      textTransform: "",
      colorScheme: "default",
      alignment: "left",
      spacingStart: 1.5,
      spacingEnd: 1.5,
      size: 1.2,
    },
    h6: {
      divider: false,
      weight: 575,
      textTransform: "",
      colorScheme: "default",
      alignment: "left",
      spacingStart: 1.5,
      spacingEnd: 1.5,
      size: 1.2,
    },
    inlineTitle: {
      dividerRemove: false,
      size: "1.5em",
      weight: 700,
    },
    collapseIconRestore: false,
    indicatorOff: false,
  },
  editorEnhance: {
    focusMode: false,
    focusModeOpacity: 0.5,
    hoverIndicator: false,
    hoverIndicatorListLevel: false,
    hoverIndicatorCodeblockLineNumber: false,
    gridBackground: true,
    gridBackgroundSize: "36px",
  },
  typography: {
    fileLineWidth: 900,
    letterSpacing: 1,
    lineHeight: 2.2,
    codeLineHeight: 1.6,
    blockquoteLineHeight: 1.6,
    tableLineHeight: 1.8,
    paragraphSpacing: "1em",
    paragraphSpacingBr: false,
    textAlignJustify: false,
  },
  codeBlock: {
    theme: "customize",
    backgroundLight: "",
    backgroundDark: "",
    borderLight: "",
    borderDark: "",
  },
  blockquote: {
    backgroundLight: "",
    backgroundDark: "",
  },
  callout: {
    style: "customize",
    borderOpacity: 0.25,
  },
  listTable: {
    listIndent: "2.25em",
    listSpacing: "0.075em",
    ulMarkerRestore: false,
    disableAlternativeCheckboxes: false,
    tableWidthMode: "default",
    tableWidth: 88,
    tableHeaderBgLight: "",
    tableHeaderBgDark: "",
  },
  link: {
    decoration: "underline",
    decorationHover: "underline",
    decorationThickness: "auto",
    externalDecoration: "underline",
    externalDecorationHover: "underline",
  },
  image: {
    centerAlign: false,
    darken: false,
    zoomOff: false,
  },
  embed: {
    seamless: false,
    maxHeight: "",
  },
  checkbox: {
    colorful: false,
  },
  rainbowFolder: {
    enabled: false,
    opacity: 0.4,
  },
  newTab: {
    buttonStyle: "default",
    imageStyle: "default",
    imageUrl: 'url(" ")',
  },
  canvas: {
    immersive: false,
  },
  scrollbar: {
    hide: false,
    restored: false,
  },
  outline: {
    enhanced: false,
  },
  mobile: {
    cardLayoutPad: false,
    drawerPhoneFullWidth: false,
  },
  pluginCompat: {
    dbTableFullWidthOff: false,
    dbTableBgColor: "default",
    projectsBgColor: "default",
    surfingBookmarkBarHide: false,
    colorfulCheckbox: false,
  },
  uiDetail: {
    settingItemTitleIconRemove: false,
    extraAnimRemove: false,
    animSpeed: 1,
  },
  fileTree: {
    ctaBtnEnable: false,
    fileNamesUntrim: false,
    folderFontBold: false,
    fileIconRemove: false,
    colorfulFolder: true,
  },
};
