/**
 * ZENdian 设置面板
 * 基于结构化 PluginSettings 的完整设置 UI
 */

import { App, PluginSettingTab, Setting } from "obsidian";
import type ZENdianPlugin from "../main";
import type { SettingsManager } from "../core/settings-manager";
import type { ModuleManager } from "../core/module-manager";
import type { PluginSettings } from "../types/settings.types";

// ============================================================
// 设置项定义
// ============================================================

interface SettingDef {
  id: string;
  title: string;
  titleZh: string;
  type: "toggle" | "select" | "number" | "text" | "number-slider";
  /** 从 PluginSettings 读取值 */
  get: (s: PluginSettings) => any;
  /** 写入值到 PluginSettings */
  set: (s: PluginSettings, val: any) => Partial<PluginSettings[keyof PluginSettings]>;
  /** select 的选项 */
  options?: { label: string; value: string }[];
  /** number-slider 的范围 */
  min?: number;
  max?: number;
  step?: number;
  /** number 的单位后缀 */
  format?: string;
  /** 条件禁用 */
  dependsOn?: { check: (s: PluginSettings) => boolean };
  default?: any;
}

interface SectionDef {
  id: string;
  title: string;
  titleZh: string;
  settings: SettingDef[];
}

interface TabDef {
  id: string;
  name: string;
  icon: string;
  sections: SectionDef[];
  isAbout?: boolean;
}

// ============================================================
// 辅助函数：快速定义设置项
// ============================================================

function toggle(
  id: string,
  titleZh: string,
  get: (s: PluginSettings) => boolean,
  set: (s: PluginSettings, v: boolean) => any
): SettingDef {
  return { id, title: id, titleZh, type: "toggle", get, set: (s, v) => set(s, v) };
}

function select(
  id: string,
  titleZh: string,
  options: { label: string; value: string }[],
  get: (s: PluginSettings) => string,
  set: (s: PluginSettings, v: string) => any
): SettingDef {
  return { id, title: id, titleZh, type: "select", get, set: (s, v) => set(s, v), options };
}

function num(
  id: string,
  titleZh: string,
  get: (s: PluginSettings) => number,
  set: (s: PluginSettings, v: number) => any,
  opts?: { min?: number; max?: number; step?: number; format?: string }
): SettingDef {
  return { id, title: id, titleZh, type: "number", get, set: (s, v) => set(s, v), ...opts };
}

function slider(
  id: string,
  titleZh: string,
  get: (s: PluginSettings) => number,
  set: (s: PluginSettings, v: number) => any,
  min: number,
  max: number,
  step: number
): SettingDef {
  return { id, title: id, titleZh, type: "number-slider", get, set: (s, v) => set(s, v), min, max, step };
}

function text(
  id: string,
  titleZh: string,
  get: (s: PluginSettings) => string,
  set: (s: PluginSettings, v: string) => any
): SettingDef {
  return { id, title: id, titleZh, type: "text", get, set: (s, v) => set(s, v) };
}

// ============================================================
// 菜单配置
// ============================================================

const MENU_CONFIG: TabDef[] = [
  // ──────────────────────────────────────────────
  // 0. 关于
  // ──────────────────────────────────────────────
  {
    id: "zendian-about",
    name: "ZENdian",
    icon: "✦",
    sections: [],
    isAbout: true,
  },

  // ──────────────────────────────────────────────
  // 1. 视图与工作区
  // ──────────────────────────────────────────────
  {
    id: "workspace",
    name: "视图与工作区",
    icon: "🖥️",
    sections: [
      {
        id: "card-layout",
        title: "Card & Layout",
        titleZh: "卡片与布局",
        settings: [
          toggle("card-layout-open", "启用卡片布局", (s) => s.cardLayout.enabled, (s, v) => ({ cardLayout: { ...s.cardLayout, enabled: v } })),
          toggle("immersive-canvas", "沉浸式白板", (s) => s.canvas.immersive, (s, v) => ({ canvas: { ...s.canvas, immersive: v } })),
          text("canvas-card-border-width", "Canvas 卡片边框", (s) => s.cardLayout.canvasBorder, (s, v) => ({ cardLayout: { ...s.cardLayout, canvasBorder: v } })),
          select("canvas-card-menu", "Canvas 卡片菜单位置", [
            { label: "居中", value: "center" },
            { label: "左侧", value: "left" },
            { label: "右侧", value: "right" },
          ], (s) => s.cardLayout.canvasMenu, (s, v) => ({ cardLayout: { ...s.cardLayout, canvasMenu: v as any } })),
          toggle("media-embed-card-border-off", "移除媒体卡片边框", (s) => s.cardLayout.mediaEmbedBorderOff, (s, v) => ({ cardLayout: { ...s.cardLayout, mediaEmbedBorderOff: v } })),
        ],
      },
      {
        id: "sidebar",
        title: "Sidebar",
        titleZh: "侧边栏",
        settings: [
          toggle("outline-enhanced", "增强大纲样式", (s) => s.outline.enhanced, (s, v) => ({ outline: { ...s.outline, enhanced: v } })),
        ],
      },
      {
        id: "tabs",
        title: "Tabs",
        titleZh: "新标签页",
        settings: [
          select("new-tab-btn-select", "新标签页按钮", [
            { label: "文字按钮（Obsidian 默认）", value: "text-btn-restore" },
            { label: "默认", value: "default" },
          ], (s) => s.newTab.buttonStyle, (s, v) => ({ newTab: { ...s.newTab, buttonStyle: v as any } })),
          select("new-tab-image-select", "新标签页图像", [
            { label: "无", value: "none" },
            { label: "Obsidian Logo", value: "default" },
            { label: "旧版默认", value: "old" },
            { label: "自定义", value: "customize" },
          ], (s) => s.newTab.imageStyle, (s, v) => ({ newTab: { ...s.newTab, imageStyle: v as any } })),
          text("new-tab-image", "自定义图像 URL", (s) => s.newTab.imageUrl, (s, v) => ({ newTab: { ...s.newTab, imageUrl: v } })),
        ],
      },
      {
        id: "ui-details",
        title: "UI Details & Animation",
        titleZh: "界面细节与动效",
        settings: [
          toggle("scrollbar-hide", "隐藏滚动条", (s) => s.scrollbar.hide, (s, v) => ({ scrollbar: { ...s.scrollbar, hide: v } })),
          toggle("restored-scrollbars", "还原滚动条样式", (s) => s.scrollbar.restored, (s, v) => ({ scrollbar: { ...s.scrollbar, restored: v } })),
          toggle("setting-item-title-icon-remove", "移除设置项图标", (s) => s.uiDetail.settingItemTitleIconRemove, (s, v) => ({ uiDetail: { ...s.uiDetail, settingItemTitleIconRemove: v } })),
          toggle("extra-anim-remove", "移除额外动效", (s) => s.uiDetail.extraAnimRemove, (s, v) => ({ uiDetail: { ...s.uiDetail, extraAnimRemove: v } })),
          slider("anim-speed", "动效速度", (s) => s.uiDetail.animSpeed, (s, v) => ({ uiDetail: { ...s.uiDetail, animSpeed: v } }), 0.5, 2, 0.05),
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // 2. 文件树
  // ──────────────────────────────────────────────
  {
    id: "file-tree",
    name: "文件树",
    icon: "🌲",
    sections: [
      {
        id: "file-tree-basic",
        title: "File Explorer",
        titleZh: "文件列表",
        settings: [
          toggle("CTA-BTN-enable", "更大的新建笔记按钮", (s) => s.fileTree.ctaBtnEnable, (s, v) => ({ fileTree: { ...s.fileTree, ctaBtnEnable: v } })),
          toggle("file-names-untrim", "不修剪文件名", (s) => s.fileTree.fileNamesUntrim, (s, v) => ({ fileTree: { ...s.fileTree, fileNamesUntrim: v } })),
          toggle("folder-font-bold", "加粗文件夹字体", (s) => s.fileTree.folderFontBold, (s, v) => ({ fileTree: { ...s.fileTree, folderFontBold: v } })),
          toggle("file-icon-remove", "移除自定义图标", (s) => s.fileTree.fileIconRemove, (s, v) => ({ fileTree: { ...s.fileTree, fileIconRemove: v } })),
          toggle("colorful-folder", "多彩文件夹图标", (s) => s.fileTree.colorfulFolder, (s, v) => ({ fileTree: { ...s.fileTree, colorfulFolder: v } })),
        ],
      },
      {
        id: "file-tree-rainbow",
        title: "Rainbow Folder",
        titleZh: "彩虹文件夹",
        settings: [
          toggle("rainbow-folder", "启用彩虹文件夹", (s) => s.rainbowFolder.enabled, (s, v) => ({ rainbowFolder: { ...s.rainbowFolder, enabled: v } })),
          ...Array.from({ length: 8 }, (_, i) =>
            text(`rainbow-folder-color-${i + 1}`, `颜色 ${i + 1}`, (s) => s.rainbowFolder.colors[i], (s, v) => {
              const colors = [...s.rainbowFolder.colors];
              colors[i] = v;
              return { rainbowFolder: { ...s.rainbowFolder, colors } };
            })
          ),
          num("rainbow-folder-icon-size", "图标大小", (s) => s.rainbowFolder.iconSize, (s, v) => ({ rainbowFolder: { ...s.rainbowFolder, iconSize: v } }), { min: 10, max: 24, format: "px" }),
          slider("rainbow-folder-opacity", "背景透明度", (s) => s.rainbowFolder.opacity, (s, v) => ({ rainbowFolder: { ...s.rainbowFolder, opacity: v } }), 0, 1, 0.01),
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // 3. 禅意与专注
  // ──────────────────────────────────────────────
  {
    id: "zen",
    name: "禅意与专注",
    icon: "🧘",
    sections: [
      {
        id: "auto-hide",
        title: "Auto Hide",
        titleZh: "自动隐藏",
        settings: [
          toggle("tab-autohide", "隐藏标签栏", (s) => s.autoHide.tab, (s, v) => ({ autoHide: { ...s.autoHide, tab: v } })),
          toggle("tab-title-bar-autohide", "隐藏标题栏", (s) => s.autoHide.tabBar, (s, v) => ({ autoHide: { ...s.autoHide, tabBar: v } })),
          toggle("Ribbon-autohide", "隐藏功能区", (s) => s.autoHide.ribbon, (s, v) => ({ autoHide: { ...s.autoHide, ribbon: v } })),
          toggle("nav-header-autohide", "隐藏导航头", (s) => s.autoHide.navHeader, (s, v) => ({ autoHide: { ...s.autoHide, navHeader: v } })),
          toggle("status-bar-autohide", "隐藏状态栏", (s) => s.autoHide.statusBar, (s, v) => ({ autoHide: { ...s.autoHide, statusBar: v } })),
          toggle("vault-profile-autohide", "隐藏仓库配置", (s) => s.autoHide.vaultProfile, (s, v) => ({ autoHide: { ...s.autoHide, vaultProfile: v } })),
        ],
      },
      {
        id: "focus-mode",
        title: "Focus Mode",
        titleZh: "专注模式",
        settings: [
          toggle("border-focus-mode", "启用专注模式", (s) => s.editorEnhance.focusMode, (s, v) => ({ editorEnhance: { ...s.editorEnhance, focusMode: v } })),
          slider("line-normal-opacity", "普通行透明度", (s) => s.editorEnhance.focusModeOpacity, (s, v) => ({ editorEnhance: { ...s.editorEnhance, focusModeOpacity: v } }), 0.05, 1, 0.05),
        ],
      },
      {
        id: "hover-indicator",
        title: "Hover Indicator",
        titleZh: "焦点指示",
        settings: [
          toggle("line-hover-indicator", "启用焦点指示器", (s) => s.editorEnhance.hoverIndicator, (s, v) => ({ editorEnhance: { ...s.editorEnhance, hoverIndicator: v } })),
          toggle("focus-indicator-list-level", "指示列表层级", (s) => s.editorEnhance.hoverIndicatorListLevel, (s, v) => ({ editorEnhance: { ...s.editorEnhance, hoverIndicatorListLevel: v } })),
          toggle("focus-indicator-codeblock-line-number", "指示代码块行号", (s) => s.editorEnhance.hoverIndicatorCodeblockLineNumber, (s, v) => ({ editorEnhance: { ...s.editorEnhance, hoverIndicatorCodeblockLineNumber: v } })),
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // 4. 排版与阅读
  // ──────────────────────────────────────────────
  {
    id: "typography",
    name: "排版与阅读",
    icon: "📝",
    sections: [
      {
        id: "page-paragraph",
        title: "Page & Paragraph",
        titleZh: "页面与段落",
        settings: [
          num("file-line-width", "阅读区宽度", (s) => s.typography.fileLineWidth, (s, v) => ({ typography: { ...s.typography, fileLineWidth: v } }), { min: 400, max: 1600, format: "px" }),
          toggle("editor-grid-background-pattren", "网格背景图案", (s) => s.editorEnhance.gridBackground, (s, v) => ({ editorEnhance: { ...s.editorEnhance, gridBackground: v } })),
          text("grid-background-pattern-size", "网格背景尺寸", (s) => s.editorEnhance.gridBackgroundSize, (s, v) => ({ editorEnhance: { ...s.editorEnhance, gridBackgroundSize: v } })),
          toggle("text-align-justify", "段落两端对齐", (s) => s.typography.textAlignJustify, (s, v) => ({ typography: { ...s.typography, textAlignJustify: v } })),
          text("p-spacing", "段落间距", (s) => s.typography.paragraphSpacing, (s, v) => ({ typography: { ...s.typography, paragraphSpacing: v } })),
          toggle("p-spacing-br", "段间距对换行生效", (s) => s.typography.paragraphSpacingBr, (s, v) => ({ typography: { ...s.typography, paragraphSpacingBr: v } })),
          slider("letter-spacing", "字间距", (s) => s.typography.letterSpacing, (s, v) => ({ typography: { ...s.typography, letterSpacing: v } }), 0, 5, 0.5),
          slider("line-height-customize", "段落行高", (s) => s.typography.lineHeight, (s, v) => ({ typography: { ...s.typography, lineHeight: v } }), 1, 3, 0.1),
        ],
      },
      {
        id: "heading-system",
        title: "Heading System",
        titleZh: "标题系统",
        settings: [
          // Inline title
          toggle("inline-title-divider-remove", "移除页内标题分隔线", (s) => s.headings.inlineTitle.dividerRemove, (s, v) => ({ headings: { ...s.headings, inlineTitle: { ...s.headings.inlineTitle, dividerRemove: v } } })),
          text("inline-title-font", "页内标题字体", (s) => s.headings.inlineTitle.font, (s, v) => ({ headings: { ...s.headings, inlineTitle: { ...s.headings.inlineTitle, font: v } } })),
          text("inline-title-size", "页内标题大小", (s) => s.headings.inlineTitle.size, (s, v) => ({ headings: { ...s.headings, inlineTitle: { ...s.headings.inlineTitle, size: v } } })),
          num("inline-title-weight", "页内标题字重", (s) => s.headings.inlineTitle.weight, (s, v) => ({ headings: { ...s.headings, inlineTitle: { ...s.headings.inlineTitle, weight: v } } })),
          text("inline-title-text-transform", "页内标题 text-transform", (s) => s.headings.inlineTitle.textTransform, (s, v) => ({ headings: { ...s.headings, inlineTitle: { ...s.headings.inlineTitle, textTransform: v } } })),
          // Global
          toggle("heading-indicator-off", "移除标题指示器", (s) => s.headings.indicatorOff, (s, v) => ({ headings: { ...s.headings, indicatorOff: v } })),
          toggle("collapse-icon-restore", "还原标题折叠图标", (s) => s.headings.collapseIconRestore, (s, v) => ({ headings: { ...s.headings, collapseIconRestore: v } })),
          // H1
          select("h1-alignment", "H1 对齐方式", [
            { label: "居中", value: "center" },
            { label: "居左", value: "left" },
          ], (s) => s.headings.h1.alignment, (s, v) => ({ headings: { ...s.headings, h1: { ...s.headings.h1, alignment: v as any } } })),
          toggle("h1-divider-on", "H1 分隔线", (s) => s.headings.h1.divider, (s, v) => ({ headings: { ...s.headings, h1: { ...s.headings.h1, divider: v } } })),
          text("h1-font", "H1 字体", (s) => s.headings.h1.font, (s, v) => ({ headings: { ...s.headings, h1: { ...s.headings.h1, font: v } } })),
          num("h1-weight", "H1 字重", (s) => s.headings.h1.weight, (s, v) => ({ headings: { ...s.headings, h1: { ...s.headings.h1, weight: v } } })),
          text("h1-text-transform", "H1 text-transform", (s) => s.headings.h1.textTransform, (s, v) => ({ headings: { ...s.headings, h1: { ...s.headings.h1, textTransform: v } } })),
          select("h1-color-select", "H1 颜色", [
            { label: "默认", value: "default" },
            { label: "强调色", value: "accent" },
          ], (s) => s.headings.h1.colorScheme, (s, v) => ({ headings: { ...s.headings, h1: { ...s.headings.h1, colorScheme: v as any } } })),
          // H2
          select("h2-style-select", "H2 亮色风格", [
            { label: "双子塔", value: "twin" },
            { label: "胶囊", value: "capsule" },
          ], (s) => s.headings.h2.lightStyle, (s, v) => ({ headings: { ...s.headings, h2: { ...s.headings.h2, lightStyle: v as any } } })),
          select("h2-style-dark-select", "H2 暗色风格", [
            { label: "霓虹双子塔", value: "neon-twin" },
            { label: "玻璃胶囊", value: "glass-capsule" },
          ], (s) => s.headings.h2.darkStyle, (s, v) => ({ headings: { ...s.headings, h2: { ...s.headings.h2, darkStyle: v as any } } })),
          toggle("h2-divider-on", "H2 分隔线", (s) => s.headings.h2.divider, (s, v) => ({ headings: { ...s.headings, h2: { ...s.headings.h2, divider: v } } })),
          text("h2-font", "H2 字体", (s) => s.headings.h2.font, (s, v) => ({ headings: { ...s.headings, h2: { ...s.headings.h2, font: v } } })),
          num("h2-weight", "H2 字重", (s) => s.headings.h2.weight, (s, v) => ({ headings: { ...s.headings, h2: { ...s.headings.h2, weight: v } } })),
          text("h2-text-transform", "H2 text-transform", (s) => s.headings.h2.textTransform, (s, v) => ({ headings: { ...s.headings, h2: { ...s.headings.h2, textTransform: v } } })),
          select("h2-color-select", "H2 颜色", [
            { label: "默认", value: "default" },
            { label: "强调色", value: "accent" },
          ], (s) => s.headings.h2.colorScheme, (s, v) => ({ headings: { ...s.headings, h2: { ...s.headings.h2, colorScheme: v as any } } })),
          slider("h2-spacing-scale-start", "H2 前间距", (s) => s.headings.h2.spacingStart, (s, v) => ({ headings: { ...s.headings, h2: { ...s.headings.h2, spacingStart: v } } }), 0.5, 3, 0.1),
          slider("h2-spacing-scale-end", "H2 后间距", (s) => s.headings.h2.spacingEnd, (s, v) => ({ headings: { ...s.headings, h2: { ...s.headings.h2, spacingEnd: v } } }), 0.5, 3, 0.1),
          // H3-H6
          ...(["h3", "h4", "h5", "h6"] as const).flatMap((lv) => {
            const h = (s: PluginSettings) => s.headings[lv];
            const S = (s: PluginSettings, partial: any) => ({ headings: { ...s.headings, [lv]: { ...s.headings[lv], ...partial } } });
            return [
              toggle(`${lv}-divider-on`, `${lv.toUpperCase()} 分隔线`, (s) => h(s).divider, (s, v) => S(s, { divider: v })),
              text(`${lv}-font`, `${lv.toUpperCase()} 字体`, (s) => h(s).font, (s, v) => S(s, { font: v })),
              num(`${lv}-weight`, `${lv.toUpperCase()} 字重`, (s) => h(s).weight, (s, v) => S(s, { weight: v })),
              text(`${lv}-text-transform`, `${lv.toUpperCase()} text-transform`, (s) => h(s).textTransform, (s, v) => S(s, { textTransform: v })),
              select(`${lv}-color-select`, `${lv.toUpperCase()} 颜色`, [
                { label: "默认", value: "default" },
                { label: "强调色", value: "accent" },
              ], (s) => h(s).colorScheme, (s, v) => S(s, { colorScheme: v })),
              slider(`${lv}-spacing-scale-start`, `${lv.toUpperCase()} 前间距`, (s) => h(s).spacingStart, (s, v) => S(s, { spacingStart: v }), 0.5, 3, 0.1),
              slider(`${lv}-spacing-scale-end`, `${lv.toUpperCase()} 后间距`, (s) => h(s).spacingEnd, (s, v) => S(s, { spacingEnd: v }), 0.5, 3, 0.1),
            ];
          }),
        ],
      },
      {
        id: "text-details",
        title: "Text Details",
        titleZh: "文本细节",
        settings: [
          text("link-decoration", "链接装饰", (s) => s.link.decoration, (s, v) => ({ link: { ...s.link, decoration: v } })),
          text("link-decoration-hover", "链接装饰（悬停）", (s) => s.link.decorationHover, (s, v) => ({ link: { ...s.link, decorationHover: v } })),
          text("link-decoration-thickness", "链接装饰粗细", (s) => s.link.decorationThickness, (s, v) => ({ link: { ...s.link, decorationThickness: v } })),
          text("link-external-decoration", "外部链接装饰", (s) => s.link.externalDecoration, (s, v) => ({ link: { ...s.link, externalDecoration: v } })),
          text("link-external-decoration-hover", "外部链接装饰（悬停）", (s) => s.link.externalDecorationHover, (s, v) => ({ link: { ...s.link, externalDecorationHover: v } })),
          text("link-external-filter", "外部链接滤镜", (s) => s.link.externalFilter, (s, v) => ({ link: { ...s.link, externalFilter: v } })),
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // 5. 渲染元素
  // ──────────────────────────────────────────────
  {
    id: "elements",
    name: "渲染元素",
    icon: "🧩",
    sections: [
      {
        id: "code-blockquote",
        title: "Code & Blockquotes",
        titleZh: "代码与引用",
        settings: [
          select("codeblock-style-select", "代码块主题", [
            { label: "自定义", value: "customize" },
            { label: "Dracula", value: "dracula" },
            { label: "Solarized Light", value: "solarized-light" },
            { label: "Solarized Dark", value: "solarized-dark" },
            { label: "One Dark", value: "one-dark" },
          ], (s) => s.codeBlock.theme, (s, v) => ({ codeBlock: { ...s.codeBlock, theme: v as any } })),
          text("code-background-light", "代码块背景（亮色）", (s) => s.codeBlock.backgroundLight, (s, v) => ({ codeBlock: { ...s.codeBlock, backgroundLight: v } })),
          text("code-border-light", "代码块边框（亮色）", (s) => s.codeBlock.borderLight, (s, v) => ({ codeBlock: { ...s.codeBlock, borderLight: v } })),
          text("code-background-dark", "代码块背景（暗色）", (s) => s.codeBlock.backgroundDark, (s, v) => ({ codeBlock: { ...s.codeBlock, backgroundDark: v } })),
          text("code-border-dark", "代码块边框（暗色）", (s) => s.codeBlock.borderDark, (s, v) => ({ codeBlock: { ...s.codeBlock, borderDark: v } })),
          slider("code-line-height", "代码行高", (s) => s.typography.codeLineHeight, (s, v) => ({ typography: { ...s.typography, codeLineHeight: v } }), 1, 3, 0.1),
          text("blockquote-background-light", "引用块背景（亮色）", (s) => s.blockquote.backgroundLight, (s, v) => ({ blockquote: { ...s.blockquote, backgroundLight: v } })),
          text("blockquote-background-dark", "引用块背景（暗色）", (s) => s.blockquote.backgroundDark, (s, v) => ({ blockquote: { ...s.blockquote, backgroundDark: v } })),
          slider("blockquote-line-height", "引用块行高", (s) => s.typography.blockquoteLineHeight, (s, v) => ({ typography: { ...s.typography, blockquoteLineHeight: v } }), 1, 3, 0.1),
        ],
      },
      {
        id: "list-table",
        title: "Lists & Tables",
        titleZh: "列表与表格",
        settings: [
          text("list-indent", "列表缩进", (s) => s.listTable.listIndent, (s, v) => ({ listTable: { ...s.listTable, listIndent: v } })),
          text("list-spacing", "列表间距", (s) => s.listTable.listSpacing, (s, v) => ({ listTable: { ...s.listTable, listSpacing: v } })),
          toggle("ul-marker-restore", "恢复无序列表默认样式", (s) => s.listTable.ulMarkerRestore, (s, v) => ({ listTable: { ...s.listTable, ulMarkerRestore: v } })),
          toggle("disable-alternative-checkboxes", "禁用备用复选框", (s) => s.listTable.disableAlternativeCheckboxes, (s, v) => ({ listTable: { ...s.listTable, disableAlternativeCheckboxes: v } })),
          text("checkbox-radius", "复选框圆角", (s) => s.listTable.checkboxRadius, (s, v) => ({ listTable: { ...s.listTable, checkboxRadius: v } })),
          toggle("colorful-checkbox", "多彩复选框", (s) => s.checkbox.colorful, (s, v) => ({ checkbox: { ...s.checkbox, colorful: v } })),
          select("table-width-select", "表格宽度", [
            { label: "与行宽一致", value: "default" },
            { label: "Obsidian 默认", value: "obsidian-default" },
            { label: "自定义", value: "customized" },
          ], (s) => s.listTable.tableWidthMode, (s, v) => ({ listTable: { ...s.listTable, tableWidthMode: v as any } })),
          slider("table-width", "自定义表格宽度", (s) => s.listTable.tableWidth, (s, v) => ({ listTable: { ...s.listTable, tableWidth: v } }), 10, 100, 1),
          text("table-header-background-light", "表头背景（亮色）", (s) => s.listTable.tableHeaderBgLight, (s, v) => ({ listTable: { ...s.listTable, tableHeaderBgLight: v } })),
          text("table-header-background-dark", "表头背景（暗色）", (s) => s.listTable.tableHeaderBgDark, (s, v) => ({ listTable: { ...s.listTable, tableHeaderBgDark: v } })),
          slider("table-line-height", "表格行高", (s) => s.typography.tableLineHeight, (s, v) => ({ typography: { ...s.typography, tableLineHeight: v } }), 1, 3, 0.1),
        ],
      },
      {
        id: "callout-embed",
        title: "Callouts & Embeds",
        titleZh: "标注与内嵌",
        settings: [
          select("callout-style-select", "标注风格", [
            { label: "自定义", value: "customize" },
            { label: "风格 1", value: "style-1" },
            { label: "风格 2", value: "style-2" },
            { label: "风格 3", value: "style-3" },
            { label: "风格 4", value: "style-4" },
          ], (s) => s.callout.style, (s, v) => ({ callout: { ...s.callout, style: v as any } })),
          text("callout-border-width", "标注边框宽度", (s) => s.callout.borderWidth, (s, v) => ({ callout: { ...s.callout, borderWidth: v } })),
          slider("callout-border-opacity", "标注边框透明度", (s) => s.callout.borderOpacity, (s, v) => ({ callout: { ...s.callout, borderOpacity: v } }), 0, 1, 0.05),
          text("callout-padding", "标注内边距", (s) => s.callout.padding, (s, v) => ({ callout: { ...s.callout, padding: v } })),
          text("callout-title-padding", "标注标题内边距", (s) => s.callout.titlePadding, (s, v) => ({ callout: { ...s.callout, titlePadding: v } })),
          text("callout-title-size", "标注标题大小", (s) => s.callout.titleSize, (s, v) => ({ callout: { ...s.callout, titleSize: v } })),
          text("callout-content-padding", "标注内容内边距", (s) => s.callout.contentPadding, (s, v) => ({ callout: { ...s.callout, contentPadding: v } })),
          text("callout-content-radius", "标注内容圆角", (s) => s.callout.contentRadius, (s, v) => ({ callout: { ...s.callout, contentRadius: v } })),
          toggle("seamless-embeds", "无缝嵌入", (s) => s.embed.seamless, (s, v) => ({ embed: { ...s.embed, seamless: v } })),
          text("embed-padding", "嵌入内边距", (s) => s.embed.padding, (s, v) => ({ embed: { ...s.embed, padding: v } })),
          text("embed-border-radius", "嵌入圆角", (s) => s.embed.borderRadius, (s, v) => ({ embed: { ...s.embed, borderRadius: v } })),
          text("embed-font-style", "嵌入字体风格", (s) => s.embed.fontStyle, (s, v) => ({ embed: { ...s.embed, fontStyle: v } })),
          text("embed-max-height", "嵌入最大高度", (s) => s.embed.maxHeight, (s, v) => ({ embed: { ...s.embed, maxHeight: v } })),
        ],
      },
      {
        id: "images",
        title: "Images",
        titleZh: "图像",
        settings: [
          toggle("img-center-align", "图像居中", (s) => s.image.centerAlign, (s, v) => ({ image: { ...s.image, centerAlign: v } })),
          toggle("img-darken", "暗黑模式暗化图像", (s) => s.image.darken, (s, v) => ({ image: { ...s.image, darken: v } })),
          toggle("zoom-off", "关闭图像缩放", (s) => s.image.zoomOff, (s, v) => ({ image: { ...s.image, zoomOff: v } })),
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // 6. 移动端与适配
  // ──────────────────────────────────────────────
  {
    id: "mobile",
    name: "移动端与适配",
    icon: "📱",
    sections: [
      {
        id: "mobile-layout",
        title: "Mobile Layout",
        titleZh: "移动端布局",
        settings: [
          toggle("card-layout-pad-open", "平板卡片布局", (s) => s.mobile.cardLayoutPad, (s, v) => ({ mobile: { ...s.mobile, cardLayoutPad: v } })),
          toggle("drawer-phone-full-width", "手机侧边栏全屏", (s) => s.mobile.drawerPhoneFullWidth, (s, v) => ({ mobile: { ...s.mobile, drawerPhoneFullWidth: v } })),
        ],
      },
      {
        id: "plugin-compat",
        title: "Plugin Compatibility",
        titleZh: "第三方插件适配",
        settings: [
          toggle("DB-table-full-width-off", "关闭 DB Folder 全宽", (s) => s.pluginCompat.dbTableFullWidthOff, (s, v) => ({ pluginCompat: { ...s.pluginCompat, dbTableFullWidthOff: v } })),
          select("DB-table-bg-color", "DB Folder 背景色", [
            { label: "默认", value: "default" },
            { label: "适配背景", value: "adapt" },
            { label: "统一背景", value: "unify" },
          ], (s) => s.pluginCompat.dbTableBgColor, (s, v) => ({ pluginCompat: { ...s.pluginCompat, dbTableBgColor: v as any } })),
          select("Projects-bg-color", "Projects 背景色", [
            { label: "默认", value: "default" },
            { label: "适配背景", value: "adapt" },
            { label: "统一背景", value: "unify" },
          ], (s) => s.pluginCompat.projectsBgColor, (s, v) => ({ pluginCompat: { ...s.pluginCompat, projectsBgColor: v as any } })),
          toggle("Surfing-bookmark-bar-hide", "Surfing 隐藏书签栏", (s) => s.pluginCompat.surfingBookmarkBarHide, (s, v) => ({ pluginCompat: { ...s.pluginCompat, surfingBookmarkBarHide: v } })),
        ],
      },
    ],
  },
];

// ============================================================
// 设置面板
// ============================================================

export class ZENdianSettingTab extends PluginSettingTab {
  private settingsManager: SettingsManager;
  private moduleManager: ModuleManager;
  private activeTabId = "zendian-about";
  private navItems = new Map<string, HTMLElement>();
  private tabContents = new Map<string, HTMLElement>();

  constructor(
    app: App,
    plugin: ZENdianPlugin,
    settingsManager: SettingsManager,
    moduleManager: ModuleManager
  ) {
    super(app, plugin);
    this.settingsManager = settingsManager;
    this.moduleManager = moduleManager;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const wrapper = containerEl.createDiv("zendian-settings-wrapper");

    // 顶部导航
    const nav = wrapper.createDiv("zendian-nav");
    for (const tab of MENU_CONFIG) {
      const item = nav.createDiv("zendian-nav-item");
      item.textContent = `${tab.icon} ${tab.name}`;
      item.dataset.tabId = tab.id;
      if (tab.id === this.activeTabId) item.classList.add("active");
      item.addEventListener("click", () => this.switchTab(tab.id));
      this.navItems.set(tab.id, item);
    }

    // 滚轮横向滚动
    nav.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        nav.scrollLeft += e.deltaY;
      }
    }, { passive: false });

    // 内容区
    const content = wrapper.createDiv("zendian-content");
    for (const tab of MENU_CONFIG) {
      const section = content.createDiv("zendian-tab-section");
      section.dataset.tabId = tab.id;
      if (tab.id !== this.activeTabId) section.style.display = "none";

      if (tab.isAbout) {
        this.renderAboutPage(section);
      } else {
        this.renderTabContent(section, tab);
      }
      this.tabContents.set(tab.id, section);
    }
  }

  private switchTab(tabId: string): void {
    if (tabId === this.activeTabId) return;
    this.activeTabId = tabId;
    for (const [id, item] of this.navItems) {
      item.classList.toggle("active", id === tabId);
    }
    for (const [id, section] of this.tabContents) {
      section.style.display = id === tabId ? "" : "none";
    }
  }

  private renderAboutPage(containerEl: HTMLElement): void {
    const about = containerEl.createDiv("zendian-about");

    const header = about.createDiv("zendian-about-header");
    header.createEl("div", { text: "✦", cls: "zendian-about-logo" });
    header.createEl("h1", { text: "ZENdian", cls: "zendian-about-title" });
    header.createEl("span", {
      text: `v${(this.plugin as any).manifest?.version ?? "unknown"}`,
      cls: "zendian-about-version",
    });

    const desc = about.createDiv("zendian-about-desc");
    desc.createEl("p", {
      text: "一款综合性的 Obsidian UI 美化插件，集成 Border 主题、Phycat 苹果风格配色、增强 Markdown 渲染和 Style Settings 自定义面板。",
    });

    const features = about.createDiv("zendian-about-features");
    features.createEl("h3", { text: "功能亮点" });
    const list = features.createEl("ul");
    for (const item of [
      "自动隐藏 Tab 栏、侧边栏、状态栏等 UI 元素",
      "专注模式 — 降低非当前行透明度，聚焦编辑",
      "卡片式布局 — 圆角卡片提升视觉层次",
      "Phycat 标题与段落间距系统 — 精细排版控制",
      "H1-H6 标题自定义 — 字体、字重、颜色、分隔线",
      "代码块、引用块、标注、表格的全面样式定制",
      "第三方插件兼容 — DB Folder、Projects、Surfing",
    ]) {
      list.createEl("li", { text: item });
    }
  }

  private renderTabContent(containerEl: HTMLElement, tab: TabDef): void {
    for (const section of tab.sections) {
      const heading = containerEl.createDiv("zendian-section-heading");
      heading.createEl("h3", { text: `${section.titleZh} (${section.title})` });

      const sectionContent = containerEl.createDiv("zendian-section-content");

      for (const def of section.settings) {
        this.renderSetting(sectionContent, def);
      }
    }
  }

  private renderSetting(containerEl: HTMLElement, def: SettingDef): void {
    const settings = this.settingsManager.getSettings();

    switch (def.type) {
      case "toggle":
        new Setting(containerEl)
          .setName(def.titleZh)
          .addToggle((toggle) => {
            toggle.setValue(def.get(settings));
            toggle.onChange(async (val) => {
              await this.settingsManager.updateMultiple(def.set(settings, val));
            });
          });
        break;

      case "select":
        new Setting(containerEl)
          .setName(def.titleZh)
          .addDropdown((dropdown) => {
            for (const opt of def.options ?? []) {
              dropdown.addOption(opt.value, opt.label);
            }
            dropdown.setValue(def.get(settings));
            dropdown.onChange(async (val) => {
              await this.settingsManager.updateMultiple(def.set(settings, val));
            });
          });
        break;

      case "number":
        new Setting(containerEl)
          .setName(def.titleZh)
          .addText((text) => {
            text.inputEl.type = "number";
            if (def.min !== undefined) text.inputEl.min = String(def.min);
            if (def.max !== undefined) text.inputEl.max = String(def.max);
            if (def.step !== undefined) text.inputEl.step = String(def.step);
            text.setValue(String(def.get(settings)));
            text.setPlaceholder(def.format ?? "");
            text.onChange(async (val) => {
              const num = parseFloat(val);
              if (!isNaN(num)) {
                await this.settingsManager.updateMultiple(def.set(settings, num));
              }
            });
          });
        break;

      case "number-slider":
        new Setting(containerEl)
          .setName(def.titleZh)
          .addSlider((slider) => {
            slider.setLimits(def.min ?? 0, def.max ?? 1, def.step ?? 0.01);
            slider.setValue(def.get(settings));
            slider.setDynamicTooltip();
            slider.onChange(async (val) => {
              await this.settingsManager.updateMultiple(def.set(settings, val));
            });
          })
          .addExtraButton((btn) => {
            btn.setIcon("reset").setTooltip("重置").onClick(async () => {
              await this.settingsManager.updateMultiple(def.set(settings, def.get(settings)));
              this.display();
            });
          });
        break;

      case "text":
        new Setting(containerEl)
          .setName(def.titleZh)
          .addText((text) => {
            text.setValue(def.get(settings));
            text.onChange(async (val) => {
              await this.settingsManager.updateMultiple(def.set(settings, val));
            });
          });
        break;
    }
  }
}
