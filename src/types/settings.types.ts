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
  canvasBorderWidth: number;
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
  focusClockEnabled: boolean;
  focusClockDefaultMinutes: number;
  focusClockBreakMinutes: number;
  focusClockAutoEnableFocusMode: boolean;
  focusClockSound: boolean;
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
  horizontalPadding: string;
  blockMargin: string;
}

/** 引用块模块设置 */
export interface BlockquoteSettings {
  backgroundLight: string;
  backgroundDark: string;
  padding: string;
  margin: string;
}

/** 标注模块设置 */
export interface CalloutSettings {
  style: CalloutStyle;
  borderWidth: string;
  borderOpacity: number;
  padding: string;
  margin: string;
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
  tableCellPadding: string;
  tableMargin: string;
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
  borderRadius: string;
  maxHeight: string;
}

/** 复选框模块设置 */
export interface CheckboxSettings {
  colorful: boolean;
}

/** 文件夹层级遮罩模块设置 */
export interface FolderCardSettings {
  enabled: boolean;
  opacity: number;
  style: "card" | "capsule";
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

/** Obsidian 官方关系图谱美化设置 */
export interface GraphSettings {
  enabled: boolean;
  nebulaIntensity: number;
  motionEnabled: boolean;
  motionSpeed: number;
  starfieldEnabled: boolean;
  localGraphBoost: boolean;
  compactControls: boolean;
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
  openPanelsInNewWindow: boolean;
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
  position: string;
  displayMode: "smart" | "cover" | "contain";
  contentOverlap: number;
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
  icon: string;
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
  /** 项目看板开关 */
  projectBoardEnabled: boolean;
  /** 项目分类列表 */
  projectCategories: ProjectCategory[];
  /** 新建项目时创建的一级子文件夹；空数组表示不创建。 */
  projectSubfolders: Record<string, ProjectSubfolderTemplate[]>;
  projectDeliverableFolders: Record<string, string>;
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
  /** 灵感速记绑定的文件夹；为空时沿用旧版独立速记数据。 */
  inspirationNotesFolder: string;
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
  folderCards: FolderCardSettings;
  newTab: NewTabSettings;
  canvas: CanvasSettings;
  graph: GraphSettings;
  scrollbar: ScrollbarSettings;
  outline: OutlineSettings;
  mobile: MobileSettings;
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
    canvasBorderWidth: 2,
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
      size: 1.55,
    },
    h2: {
      divider: false,
      font: "",
      weight: 675,
      textTransform: "",
      colorScheme: "default",
      alignment: "left",
      spacingStart: 1.1,
      spacingEnd: 0.65,
      size: 1.35,
      style: "twin",
    },
    h3: {
      divider: false,
      font: "",
      weight: 650,
      textTransform: "",
      colorScheme: "default",
      alignment: "left",
      spacingStart: 1,
      spacingEnd: 0.5,
      size: 1.2,
    },
    h4: {
      divider: false,
      font: "",
      weight: 625,
      textTransform: "",
      colorScheme: "default",
      alignment: "left",
      spacingStart: 0.85,
      spacingEnd: 0.4,
      size: 1.1,
    },
    h5: {
      divider: false,
      font: "",
      weight: 600,
      textTransform: "",
      colorScheme: "default",
      alignment: "left",
      spacingStart: 0.7,
      spacingEnd: 0.35,
      size: 1,
    },
    h6: {
      divider: false,
      font: "",
      weight: 575,
      textTransform: "",
      colorScheme: "default",
      alignment: "left",
      spacingStart: 0.7,
      spacingEnd: 0.35,
      size: 0.95,
    },
    inlineTitle: {
      dividerRemove: false,
      font: "",
      size: "1.45em",
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
    focusClockEnabled: true,
    focusClockDefaultMinutes: 25,
    focusClockBreakMinutes: 5,
    focusClockAutoEnableFocusMode: true,
    focusClockSound: true,
    hoverIndicator: false,
    hoverIndicatorListLevel: false,
    hoverIndicatorCodeblockLineNumber: false,
    gridBackground: true,
    gridBackgroundSize: "36px",
  },
  typography: {
    fileLineWidth: 860,
    letterSpacing: 0.2,
    lineHeight: 1.7,
    codeLineHeight: 1.5,
    blockquoteLineHeight: 1.6,
    tableLineHeight: 1.4,
    paragraphSpacing: "0.65em",
    paragraphSpacingBr: false,
    textAlignJustify: false,
  },
  codeBlock: {
    theme: "customize",
    backgroundLight: "",
    backgroundDark: "",
    borderLight: "",
    borderDark: "",
    horizontalPadding: "14px",
    blockMargin: "0.8em 0",
  },
  blockquote: {
    backgroundLight: "",
    backgroundDark: "",
    padding: "0.75em 1em 0.75em 2.5em",
    margin: "0.75em 0",
  },
  callout: {
    style: "customize",
    borderWidth: "1px",
    borderOpacity: 0.25,
    padding: "10px 12px",
    margin: "0.8em 0",
    titlePadding: "3px 9px",
    titleSize: "0.88em",
    contentPadding: "0 2px",
    contentRadius: "0px",
  },
  listTable: {
    listIndent: "1.75em",
    listSpacing: "0.1em",
    ulMarkerRestore: false,
    disableAlternativeCheckboxes: false,
    checkboxRadius: "6px",
    tableWidthMode: "default",
    tableWidth: 92,
    tableCellPadding: "7px 10px",
    tableMargin: "0.8em 0",
    tableHeaderBgLight: "",
    tableHeaderBgDark: "",
  },
  link: {
    decoration: "underline-offset",
    decorationHover: "underline",
    decorationThickness: "1px",
    externalDecoration: "underline-offset",
    externalDecorationHover: "underline",
  },
  image: {
    centerAlign: false,
    darken: false,
    zoomOff: false,
  },
  embed: {
    seamless: false,
    borderRadius: "",
    maxHeight: "",
  },
  checkbox: {
    colorful: false,
  },
  folderCards: {
    enabled: false,
    opacity: 0.4,
    style: "card",
  },
  newTab: {
    buttonStyle: "default",
    imageStyle: "default",
    imageUrl: "",
  },
  canvas: {
    immersive: false,
  },
  graph: {
    enabled: true,
    nebulaIntensity: 0.55,
    motionEnabled: true,
    motionSpeed: 0.75,
    starfieldEnabled: true,
    localGraphBoost: true,
    compactControls: true,
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
    openPanelsInNewWindow: true,
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
    customIcons: {
      "10_课程": "lucide-book-open",
      "20_竞赛": "lucide-trophy",
      "30_研究": "lucide-flask-conical",
      "40_技能": "lucide-wrench",
      "50_生活": "lucide-heart",
    },
  },
  banner: {
    enabled: false,
    yamlKey: "banner",
    height: 250,
    position: "center",
    displayMode: "smart",
    contentOverlap: 110,
  },
  homepage: {
    enabled: true,
    userName: "",
    weatherEnabled: false,
    weatherLocation: "",
    projectBoardEnabled: true,
    projectCategories: [
      { number: "10", name: "课程", icon: "lucide-book-open" },
      { number: "20", name: "竞赛", icon: "lucide-trophy" },
      { number: "30", name: "研究", icon: "lucide-flask-conical" },
      { number: "40", name: "技能", icon: "lucide-wrench" },
      { number: "50", name: "生活", icon: "lucide-heart" },
    ],
    projectSubfolders: {},
    projectDeliverableFolders: {},
    projectArchiveFolder: "99_归档",
    heatmapEnabled: true,
    monthlyStatsEnabled: true,
    bookmarksEnabled: true,
    recentNoteCount: 6,
    inspirationNotesFolder: "",
  },
};
