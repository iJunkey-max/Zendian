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
  font: string;
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
  font: string;
  size: string;
  weight: number;
  textTransform: string;
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
  focusModeTypewriter: boolean;
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
  borderWidth: string;
  borderOpacity: number;
  padding: string;
  titlePadding: string;
  titleSize: string;
  contentPadding: string;
  contentRadius: string;
}

/** 列表与表格模块设置 */
export interface ListTableSettings {
  listIndent: string;
  listSpacing: string;
  ulMarkerRestore: boolean;
  disableAlternativeCheckboxes: boolean;
  checkboxRadius: string;
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
  externalFilter: string;
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
  padding: string;
  borderRadius: string;
  fontStyle: string;
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
  colors: string[];
  iconSize: number;
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
}

/** 图标匹配规则 */
export interface IconRule {
  regex: string;
  iconId: string;
  color?: string;
}

/** 页眉图片模块设置 */
export interface BannerSettings {
  enabled: boolean;
  yamlKey: string;
  height: number;
  style: string;
  position: string;
}

/** 图标系统模块设置 */
export interface IconSystemSettings {
  enabled: boolean;
  customEnabled: boolean;
  tabIconsEnabled: boolean;
  installedLibraries: string[];
  defaultRules: IconRule[];
  customIcons: Record<string, string>;
}

/** 项目分类。项目文件夹名称固定为 `{number}_{name}`。 */
export interface ProjectCategory {
  number: string;
  name: string;
}

/** 新建项目时使用的自定义一级子文件夹模板。 */
export interface ProjectSubfolderTemplate {
  number: string;
  name: string;
  icon: string;
}

/** 主页模块设置 */
export interface HomepageSettings {
  /** 是否启用主页替换新标签页 */
  enabled: boolean;
  /** 用户名（问候语） */
  userName: string;
  /** 天气模块开关 */
  weatherEnabled: boolean;
  /** 天气位置（城市名或 lat,lon） */
  weatherLocation: string;
  /** 每日笔记分类文件夹（逗号分隔） */
  dailyNoteFolders: string;
  /** 项目看板开关 */
  projectBoardEnabled: boolean;
  /** 项目分类列表 */
  projectCategories: ProjectCategory[];
  /** 新建项目时创建的一级子文件夹；空数组表示不创建。 */
  projectSubfolders: Record<string, ProjectSubfolderTemplate[]>;
  /** 项目归档文件夹名 */
  projectArchiveFolder: string;
  /** 热力图开关 */
  heatmapEnabled: boolean;
  /** 月度统计开关 */
  monthlyStatsEnabled: boolean;
  /** 书摘开关 */
  bookmarksEnabled: boolean;
  /** 最近笔记数量 */
  recentNoteCount: number;
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
  iconSystem: IconSystemSettings;
  banner: BannerSettings;
  homepage: HomepageSettings;
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
      font: "",
      weight: 700,
      textTransform: "",
      colorScheme: "default",
      alignment: "center",
      size: 1.618,
    },
    h2: {
      divider: false,
      font: "",
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
      font: "",
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
      font: "",
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
      font: "",
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
      font: "",
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
      font: "",
      size: "1.5em",
      weight: 700,
      textTransform: "",
    },
    collapseIconRestore: false,
    indicatorOff: false,
  },
  editorEnhance: {
    focusMode: false,
    focusModeOpacity: 0.5,
    focusModeTypewriter: true,
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
    borderWidth: "0px",
    borderOpacity: 0.25,
    padding: "",
    titlePadding: "",
    titleSize: "",
    contentPadding: "",
    contentRadius: "",
  },
  listTable: {
    listIndent: "2.25em",
    listSpacing: "0.075em",
    ulMarkerRestore: false,
    disableAlternativeCheckboxes: false,
    checkboxRadius: "6px",
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
    externalFilter: "none",
  },
  image: {
    centerAlign: false,
    darken: false,
    zoomOff: false,
  },
  embed: {
    seamless: false,
    padding: "",
    borderRadius: "",
    fontStyle: "",
    maxHeight: "",
  },
  checkbox: {
    colorful: false,
  },
  rainbowFolder: {
    enabled: false,
    opacity: 0.4,
    colors: [
      "var(--color-red)",
      "var(--color-orange)",
      "var(--color-yellow)",
      "var(--color-green)",
      "var(--color-cyan)",
      "var(--color-blue)",
      "var(--color-purple)",
      "var(--color-pink)",
    ],
    iconSize: 16,
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
  },
  iconSystem: {
    enabled: false,
    customEnabled: false,
    tabIconsEnabled: false,
    installedLibraries: [],
    defaultRules: [
      { regex: "\\.md$", iconId: "lucide-file-text" },
      { regex: "\\.pdf$", iconId: "lucide-file-text" },
      { regex: "\\.(png|jpe?g|gif|svg|bmp|webp)$", iconId: "lucide-image" },
      { regex: "\\.(mp3|wav|ogg|flac|m4a)$", iconId: "lucide-headphones" },
      { regex: "\\.(mp4|webm|avi|mov|mkv)$", iconId: "lucide-film" },
      { regex: "\\.(zip|7z|tar|gz|rar)$", iconId: "lucide-archive" },
      { regex: "\\.(js|ts|jsx|tsx)$", iconId: "lucide-file-code" },
      { regex: "\\.(html|htm)$", iconId: "lucide-globe" },
      { regex: "\\.css$", iconId: "lucide-palette" },
      { regex: "\\.(json|yaml|yml|toml)$", iconId: "lucide-braces" },
      { regex: "\\.(doc|docx)$", iconId: "lucide-file-text" },
      { regex: "\\.(xls|xlsx|csv)$", iconId: "lucide-table" },
      { regex: "\\.(ppt|pptx)$", iconId: "lucide-presentation" },
      { regex: "\\.excalidraw\\.md$", iconId: "lucide-pen-tool" },
      { regex: "\\.canvas$", iconId: "lucide-layout-dashboard" },
    ],
    customIcons: {},
  },
  banner: {
    enabled: false,
    yamlKey: "banner",
    height: 250,
    style: "fade-bottom",
    position: "center",
  },
  homepage: {
    enabled: true,
    userName: "",
    weatherEnabled: false,
    weatherLocation: "",
    dailyNoteFolders: "",
    projectBoardEnabled: true,
    projectCategories: [
      { number: "10", name: "课程" },
      { number: "20", name: "竞赛" },
      { number: "30", name: "研究" },
      { number: "40", name: "技能" },
      { number: "50", name: "生活" },
    ],
    projectSubfolders: {},
    projectArchiveFolder: "99_归档",
    heatmapEnabled: true,
    monthlyStatsEnabled: true,
    bookmarksEnabled: true,
    recentNoteCount: 6,
  },
};
