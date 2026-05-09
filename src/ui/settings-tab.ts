/**
 * ZENdian 设置面板
 * 精简版：无字体设置、无颜色设置，text 输入改为 select/slider
 */

import { App, PluginSettingTab, Setting } from "obsidian";
import type ZENdianPlugin from "../main";
import type { SettingsManager } from "../core/settings-manager";
import type { ModuleManager } from "../core/module-manager";
import type { PluginSettings } from "../types/settings.types";
import { BUILTIN_LIBRARIES, type IconSystemModule } from "../modules/icon-system.module";
import { IconPickerModal } from "./icon-picker-modal";

// ============================================================
// 设置项定义
// ============================================================

interface SettingDef {
  id: string;
  titleZh: string;
  descZh?: string;
  type: "toggle" | "select" | "number" | "number-slider" | "text";
  get: (s: PluginSettings) => any;
  set: (s: PluginSettings, val: any) => Partial<PluginSettings[keyof PluginSettings]>;
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  step?: number;
  format?: string;
  placeholder?: string;
  visible?: (s: PluginSettings) => boolean;
}

interface SectionDef {
  id: string;
  title: string;
  titleZh: string;
  settings?: SettingDef[];
  headingTabs?: boolean;
  iconSystem?: boolean;
}

interface TabDef {
  id: string;
  name: string;
  icon: string;
  sections: SectionDef[];
  isAbout?: boolean;
}

// ============================================================
// 辅助函数
// ============================================================

function toggle(id: string, titleZh: string, get: (s: PluginSettings) => boolean, set: (s: PluginSettings, v: boolean) => any, descZh?: string): SettingDef {
  return { id, titleZh, descZh, type: "toggle", get, set: (s, v) => set(s, v) };
}

function select(id: string, titleZh: string, options: { label: string; value: string }[], get: (s: PluginSettings) => string, set: (s: PluginSettings, v: string) => any, descZh?: string): SettingDef {
  return { id, titleZh, descZh, type: "select", get, set: (s, v) => set(s, v), options };
}

function num(id: string, titleZh: string, get: (s: PluginSettings) => number, set: (s: PluginSettings, v: number) => any, opts?: { min?: number; max?: number; step?: number; format?: string }, descZh?: string): SettingDef {
  return { id, titleZh, descZh, type: "number", get, set: (s, v) => set(s, v), ...opts };
}

function slider(id: string, titleZh: string, get: (s: PluginSettings) => number, set: (s: PluginSettings, v: number) => any, min: number, max: number, step: number, descZh?: string): SettingDef {
  return { id, titleZh, descZh, type: "number-slider", get, set: (s, v) => set(s, v), min, max, step };
}

function text(id: string, titleZh: string, get: (s: PluginSettings) => string, set: (s: PluginSettings, v: string) => any, placeholder?: string, descZh?: string): SettingDef {
  return { id, titleZh, descZh, type: "text", get, set: (s, v) => set(s, v), placeholder };
}

// ============================================================
// About 页面 SVG 图标
// ============================================================

const ABOUT_SVG_LOGO = `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M24 4L42 14V34L24 44L6 34V14L24 4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  <path d="M24 4L42 14L24 24L6 14L24 4Z" fill="currentColor" fill-opacity="0.12"/>
  <path d="M24 24V44" stroke="currentColor" stroke-width="2"/>
  <circle cx="24" cy="24" r="4" fill="currentColor" fill-opacity="0.3"/>
</svg>`;

const FEAT_ICONS = {
  autoHide: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="3" width="20" height="18" rx="2"/>
    <path d="M2 8h20"/>
    <circle cx="7" cy="5.5" r="1" fill="currentColor" stroke="none"/>
    <circle cx="10" cy="5.5" r="1" fill="currentColor" stroke="none"/>
    <path d="M9 15l-3-3m0 0l3-3m-3 3h6" opacity="0.7"/>
    <path d="M18 15l-3-3m0 0l3-3m-3 3h6" transform="translate(-3,0)" opacity="0.3"/>
  </svg>`,
  focusMode: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <circle cx="12" cy="12" r="4"/>
    <line x1="12" y1="3" x2="12" y2="7"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
    <line x1="3" y1="12" x2="7" y2="12"/>
    <line x1="17" y1="12" x2="21" y2="12"/>
  </svg>`,
  cardLayout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
    <rect x="6" y="6" width="5" height="5" rx="1.5" fill="currentColor" fill-opacity="0.15"/>
    <rect x="13" y="6" width="5" height="5" rx="1.5" fill="currentColor" fill-opacity="0.15"/>
    <rect x="6" y="13" width="12" height="5" rx="1.5" fill="currentColor" fill-opacity="0.15"/>
  </svg>`,
  headings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 5v14"/>
    <path d="M4 12h8"/>
    <path d="M12 5v14"/>
    <path d="M17 7v10"/>
    <path d="M17 12h3.5"/>
    <path d="M17 7h3"/>
  </svg>`,
  codeBlocks: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="3" width="20" height="18" rx="2"/>
    <path d="M2 7h20"/>
    <path d="M8 13l-2.5 2.5L8 18"/>
    <path d="M16 13l2.5 2.5L16 18"/>
    <line x1="13" y1="12" x2="11" y2="19" opacity="0.6"/>
  </svg>`,
  compat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
    <path d="M2 17l10 5 10-5"/>
    <path d="M2 12l10 5 10-5"/>
  </svg>`,
  iconSystem: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
    <circle cx="12" cy="13" r="2" fill="currentColor" fill-opacity="0.2"/>
    <path d="M12 11v4"/>
    <path d="M10 13h4"/>
  </svg>`,
};

interface FeatureItem {
  icon: string;
  title: string;
  desc: string;
}

const FEATURES: FeatureItem[] = [
  { icon: FEAT_ICONS.autoHide, title: "自动隐藏", desc: "Tab 栏、侧边栏、状态栏等 UI 元素智能隐藏" },
  { icon: FEAT_ICONS.focusMode, title: "专注模式", desc: "降低非当前行透明度，聚焦当前编辑" },
  { icon: FEAT_ICONS.cardLayout, title: "卡片式布局", desc: "圆角卡片提升视觉层次与内容组织" },
  { icon: FEAT_ICONS.headings, title: "标题自定义", desc: "H1-H6 字重、分隔线、间距、字号全面定制" },
  { icon: FEAT_ICONS.codeBlocks, title: "代码与引用块", desc: "代码块、引用块、标注、表格的全面样式定制" },
  { icon: FEAT_ICONS.compat, title: "第三方兼容", desc: "DB Folder、Projects、Surfing 等插件兼容" },
  { icon: FEAT_ICONS.iconSystem, title: "图标系统", desc: "数据驱动的文件树图标，支持 Lucide + 第三方图标库" },
];

// ============================================================
// 菜单配置
// ============================================================

const MENU_CONFIG: TabDef[] = [
  {
    id: "zendian-about",
    name: "ZENdian",
    icon: "✦",
    sections: [],
    isAbout: true,
  },
  {
    id: "workspace",
    name: "视图与工作区",
    icon: "🖥️",
    sections: [
      {
        id: "card-layout", title: "Card & Layout", titleZh: "卡片与布局",
        settings: [
          toggle("card-layout-open", "启用卡片布局", (s) => s.cardLayout.enabled, (s, v) => ({ cardLayout: { ...s.cardLayout, enabled: v } })),
          toggle("immersive-canvas", "沉浸式白板", (s) => s.canvas.immersive, (s, v) => ({ canvas: { ...s.canvas, immersive: v } }), "移除白板的边框和阴影，使其与背景融为一体"),
          select("canvas-card-menu", "Canvas 卡片菜单位置", [
            { label: "居中", value: "center" }, { label: "左侧", value: "left" }, { label: "右侧", value: "right" },
          ], (s) => s.cardLayout.canvasMenu, (s, v) => ({ cardLayout: { ...s.cardLayout, canvasMenu: v as any } }), "设置白板卡片右键菜单的弹出位置"),
          toggle("media-embed-card-border-off", "移除媒体卡片边框", (s) => s.cardLayout.mediaEmbedBorderOff, (s, v) => ({ cardLayout: { ...s.cardLayout, mediaEmbedBorderOff: v } }), "移除图片、视频等媒体嵌入卡片的边框和阴影"),
        ],
      },
      {
        id: "sidebar", title: "Sidebar", titleZh: "侧边栏",
        settings: [
          toggle("outline-enhanced", "增强大纲样式", (s) => s.outline.enhanced, (s, v) => ({ outline: { ...s.outline, enhanced: v } }), "显示完整的文件名，不因窗口宽度不足而截断"),
        ],
      },
      {
        id: "tabs", title: "Tabs", titleZh: "新标签页",
        settings: [
          select("new-tab-btn-select", "新标签页按钮", [
            { label: "文字按钮（Obsidian 默认）", value: "text-btn-restore" }, { label: "默认", value: "default" },
          ], (s) => s.newTab.buttonStyle, (s, v) => ({ newTab: { ...s.newTab, buttonStyle: v as any } }), "选择新标签页顶部显示的按钮样式"),
          select("new-tab-image-select", "新标签页图像", [
            { label: "无", value: "none" }, { label: "Obsidian Logo", value: "default" },
            { label: "旧版默认", value: "old" }, { label: "自定义", value: "customize" },
          ], (s) => s.newTab.imageStyle, (s, v) => ({ newTab: { ...s.newTab, imageStyle: v as any } }), "选择新标签页显示的图像，可选择自定义图片"),
        ],
      },
      {
        id: "ui-details", title: "UI Details", titleZh: "界面细节",
        settings: [
          toggle("scrollbar-hide", "隐藏滚动条", (s) => s.scrollbar.hide, (s, v) => ({ scrollbar: { ...s.scrollbar, hide: v } }), "完全隐藏滚动条，内容仍可滚动，界面更简洁"),
          toggle("restored-scrollbars", "还原滚动条样式", (s) => s.scrollbar.restored, (s, v) => ({ scrollbar: { ...s.scrollbar, restored: v } }), "将滚动条恢复为系统默认样式，而非主题自定义的细滚动条"),
          toggle("setting-item-title-icon-remove", "移除设置项图标", (s) => s.uiDetail.settingItemTitleIconRemove, (s, v) => ({ uiDetail: { ...s.uiDetail, settingItemTitleIconRemove: v } }), "移除设置面板中每个选项左侧的小图标，使界面更简洁"),
          toggle("extra-anim-remove", "移除额外动效", (s) => s.uiDetail.extraAnimRemove, (s, v) => ({ uiDetail: { ...s.uiDetail, extraAnimRemove: v } }), "关闭插件添加的过渡动画，适合追求简洁或性能较低的设备"),
          slider("anim-speed", "动效速度", (s) => s.uiDetail.animSpeed, (s, v) => ({ uiDetail: { ...s.uiDetail, animSpeed: v } }), 0.5, 2, 0.05, "调整过渡动画的速度，1为默认，小于1变慢，大于1变快"),
        ],
      },
    ],
  },
  {
    id: "file-tree",
    name: "文件树",
    icon: "🌲",
    sections: [
      {
        id: "file-tree-basic", title: "File Explorer", titleZh: "文件列表",
        settings: [
          toggle("CTA-BTN-enable", "更大的新建笔记按钮", (s) => s.fileTree.ctaBtnEnable, (s, v) => ({ fileTree: { ...s.fileTree, ctaBtnEnable: v } }), "将文件列表顶部的新建笔记按钮放大并添加背景色，使其更醒目"),
          toggle("folder-font-bold", "加粗文件夹字体", (s) => s.fileTree.folderFontBold, (s, v) => ({ fileTree: { ...s.fileTree, folderFontBold: v } })),
        ],
      },
      {
        id: "file-tree-rainbow", title: "Folder Overlay", titleZh: "文件夹层级遮罩",
        settings: [
          toggle("rainbow-folder", "启用层级遮罩", (s) => s.rainbowFolder.enabled, (s, v) => ({ rainbowFolder: { ...s.rainbowFolder, enabled: v } }), "为文件树中的文件夹标题添加彩虹色循环背景"),
          slider("rainbow-folder-opacity", "遮罩深度", (s) => s.rainbowFolder.opacity, (s, v) => ({ rainbowFolder: { ...s.rainbowFolder, opacity: v } }), 0.05, 0.8, 0.05, "调整文件夹标题背景遮罩的透明度，0为完全透明，1为完全不透明"),
        ],
      },
    ],
  },
  {
    id: "icon-resources",
    name: "图标与资源库",
    icon: "🎨",
    sections: [
      {
        id: "icon-system-main", title: "Icon System", titleZh: "图标系统",
        iconSystem: true,
      },
    ],
  },
  {
    id: "zen",
    name: "禅意与专注",
    icon: "🧘",
    sections: [
      {
        id: "auto-hide", title: "Auto Hide", titleZh: "自动隐藏",
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
        id: "focus-mode", title: "Focus Mode", titleZh: "专注模式",
        settings: [
          toggle("border-focus-mode", "启用专注模式", (s) => s.editorEnhance.focusMode, (s, v) => ({ editorEnhance: { ...s.editorEnhance, focusMode: v } }), "降低非编辑行的透明度，减少视觉干扰，让注意力集中在当前正在编辑的段落。配合下方滑块可调节透明度强度"),
          slider("line-normal-opacity", "普通行透明度", (s) => s.editorEnhance.focusModeOpacity, (s, v) => ({ editorEnhance: { ...s.editorEnhance, focusModeOpacity: v } }), 0.05, 1, 0.05, "降低非当前行的透明度，让注意力集中在正在编辑的段落"),
          {
            ...toggle("focus-mode-typewriter", "打字机滚动", (s) => s.editorEnhance.focusModeTypewriter, (s, v) => ({ editorEnhance: { ...s.editorEnhance, focusModeTypewriter: v } }), "输入时光标始终保持在屏幕垂直中央，减少视线跳动，适合长时间沉浸式写作"),
            visible: (s) => s.editorEnhance.focusMode,
          },
        ],
      },
      {
        id: "hover-indicator", title: "Hover Indicator", titleZh: "焦点指示",
        settings: [
          toggle("line-hover-indicator", "启用焦点指示器", (s) => s.editorEnhance.hoverIndicator, (s, v) => ({ editorEnhance: { ...s.editorEnhance, hoverIndicator: v } }), "鼠标悬停的行左侧显示竖线标记，在长文档中帮助快速定位当前浏览位置。配合列表层级指示可进一步区分嵌套层次"),
          toggle("focus-indicator-list-level", "指示列表层级", (s) => s.editorEnhance.hoverIndicatorListLevel, (s, v) => ({ editorEnhance: { ...s.editorEnhance, hoverIndicatorListLevel: v } }), "焦点指示器根据列表缩进层级显示不同颜色"),
        ],
      },
    ],
  },
  {
    id: "typography",
    name: "排版与阅读",
    icon: "📝",
    sections: [
      {
        id: "page-paragraph", title: "Page & Paragraph", titleZh: "页面与段落",
        settings: [
          slider("file-line-width", "阅读区宽度", (s) => s.typography.fileLineWidth, (s, v) => ({ typography: { ...s.typography, fileLineWidth: v } }), 400, 1600, 50, "单位 px"),
          toggle("editor-grid-background-pattren", "网格背景图案", (s) => s.editorEnhance.gridBackground, (s, v) => ({ editorEnhance: { ...s.editorEnhance, gridBackground: v } }), "在编辑器背景显示淡雅的网格线，营造书写纸效果"),
          select("grid-background-pattern-size", "网格背景尺寸", [
            { label: "小", value: "24px" }, { label: "中", value: "36px" }, { label: "大", value: "48px" },
          ], (s) => s.editorEnhance.gridBackgroundSize, (s, v) => ({ editorEnhance: { ...s.editorEnhance, gridBackgroundSize: v } }), "接受任何 CSS background-size 值"),
          toggle("text-align-justify", "段落两端对齐", (s) => s.typography.textAlignJustify, (s, v) => ({ typography: { ...s.typography, textAlignJustify: v } }), "使段落文本左右两端对齐，类似报纸排版效果"),
          slider("letter-spacing", "字间距", (s) => s.typography.letterSpacing, (s, v) => ({ typography: { ...s.typography, letterSpacing: v } }), 0, 5, 0.5, "调整字符之间的间距，0为默认，正值增大间距"),
          slider("line-height-customize", "段落行高", (s) => s.typography.lineHeight, (s, v) => ({ typography: { ...s.typography, lineHeight: v } }), 1, 3, 0.1, "调整段落文本的行高，值越大行距越宽松"),
        ],
      },
      {
        id: "heading-system", title: "Heading System", titleZh: "标题系统",
        headingTabs: true,
      },
      {
        id: "banner", title: "Banner", titleZh: "页眉图片",
        settings: [
          toggle("banner-enabled", "启用页眉图片", (s) => s.banner.enabled, (s, v) => ({ banner: { ...s.banner, enabled: v } }), "在笔记顶部显示页眉图片，需在 frontmatter 中设置对应键名的图片链接"),
          text("banner-yaml-key", "页眉 YAML 键名", (s) => s.banner.yamlKey, (s, v) => ({ banner: { ...s.banner, yamlKey: v } }), "banner", "用于读取图片的 YAML frontmatter 键名"),
          slider("banner-height", "页眉高度", (s) => s.banner.height, (s, v) => ({ banner: { ...s.banner, height: v } }), 150, 1000, 10, "调整页眉图片的高度（像素）"),
          select("banner-position", "图片对齐方式", [
            { label: "居中 (Center)", value: "center" },
            { label: "顶部向下 (Top)", value: "top" },
            { label: "底部向上 (Bottom)", value: "bottom" },
          ], (s) => s.banner.position, (s, v) => ({ banner: { ...s.banner, position: v } }), "选择图片在页眉容器中的对齐和裁剪锚点"),
        ],
      },
      {
        id: "text-details", title: "Text Details", titleZh: "文本细节",
        settings: [
          select("link-decoration", "链接装饰", [
            { label: "下划线偏移", value: "underline-offset" }, { label: "下划线", value: "underline" },
            { label: "无装饰", value: "none" }, { label: "虚线", value: "dotted" },
          ], (s) => s.link.decoration, (s, v) => ({ link: { ...s.link, decoration: v } }), "设置链接的装饰样式，如 underline、none、dashed"),
          select("link-decoration-thickness", "链接装饰粗细", [
            { label: "自动", value: "auto" }, { label: "细", value: "1px" }, { label: "粗", value: "2px" },
          ], (s) => s.link.decorationThickness, (s, v) => ({ link: { ...s.link, decorationThickness: v } }), "设置链接下划线的粗细，如 auto、1px、2px"),
          select("link-external-decoration", "外部链接样式", [
            { label: "下划线偏移", value: "underline-offset" }, { label: "下划线", value: "underline" },
            { label: "无装饰", value: "none" }, { label: "虚线", value: "dotted" },
          ], (s) => s.link.externalDecoration, (s, v) => ({ link: { ...s.link, externalDecoration: v } }), "设置外部链接的装饰样式，如 underline、none"),
        ],
      },
    ],
  },
  {
    id: "elements",
    name: "渲染元素",
    icon: "🧩",
    sections: [
      {
        id: "code-blockquote", title: "Code & Blockquotes", titleZh: "代码与引用",
        settings: [
          select("codeblock-style-select", "代码块主题", [
            { label: "自定义", value: "customize" }, { label: "Dracula", value: "dracula" },
            { label: "Solarized Light", value: "solarized-light" }, { label: "Solarized Dark", value: "solarized-dark" },
            { label: "One Dark", value: "one-dark" },
          ], (s) => s.codeBlock.theme, (s, v) => ({ codeBlock: { ...s.codeBlock, theme: v as any } }), "选择代码块的配色主题方案"),
          slider("code-line-height", "代码行高", (s) => s.typography.codeLineHeight, (s, v) => ({ typography: { ...s.typography, codeLineHeight: v } }), 1, 3, 0.1, "调整代码块中文本的行高"),
          slider("blockquote-line-height", "引用块行高", (s) => s.typography.blockquoteLineHeight, (s, v) => ({ typography: { ...s.typography, blockquoteLineHeight: v } }), 1, 3, 0.1, "调整引用块中文本的行高"),
        ],
      },
      {
        id: "list-table", title: "Lists & Tables", titleZh: "列表与表格",
        settings: [
          select("list-indent", "列表缩进", [
            { label: "紧凑", value: "1.5em" }, { label: "标准", value: "2.25em" }, { label: "宽松", value: "3em" },
          ], (s) => s.listTable.listIndent, (s, v) => ({ listTable: { ...s.listTable, listIndent: v } })),
          slider("list-spacing", "列表间距", (s) => parseFloat(s.listTable.listSpacing) || 0.075, (s, v) => ({ listTable: { ...s.listTable, listSpacing: `${v}em` } }), 0, 1, 0.025, "设置列表项之间的垂直间距"),
          toggle("ul-marker-restore", "恢复无序列表默认样式", (s) => s.listTable.ulMarkerRestore, (s, v) => ({ listTable: { ...s.listTable, ulMarkerRestore: v } }), "将无序列表的圆点标记恢复为 Obsidian 默认样式"),
          toggle("disable-alternative-checkboxes", "禁用备用复选框", (s) => s.listTable.disableAlternativeCheckboxes, (s, v) => ({ listTable: { ...s.listTable, disableAlternativeCheckboxes: v } }), "如果你使用 CSS 片段实现了自己的复选框样式，请禁用此项"),
          toggle("colorful-checkbox", "多彩复选框", (s) => s.checkbox.colorful, (s, v) => ({ checkbox: { ...s.checkbox, colorful: v } }), "为 Checklist 插件的复选框添加不同颜色，区分任务状态"),
          select("table-width-select", "表格宽度", [
            { label: "与行宽一致", value: "default" }, { label: "Obsidian 默认", value: "obsidian-default" }, { label: "自定义", value: "customized" },
          ], (s) => s.listTable.tableWidthMode, (s, v) => ({ listTable: { ...s.listTable, tableWidthMode: v as any } }), "选择表格宽度的计算方式"),
          slider("table-width", "自定义表格宽度", (s) => s.listTable.tableWidth, (s, v) => ({ listTable: { ...s.listTable, tableWidth: v } }), 10, 100, 1, "编辑器面板宽度的百分之（%）"),
          slider("table-line-height", "表格行高", (s) => s.typography.tableLineHeight, (s, v) => ({ typography: { ...s.typography, tableLineHeight: v } }), 1, 3, 0.1, "调整表格单元格中文本的行高"),
        ],
      },
      {
        id: "callout-embed", title: "Callouts & Embeds", titleZh: "标注与内嵌",
        settings: [
          select("callout-style-select", "标注风格", [
            { label: "自定义", value: "customize" }, { label: "风格 1", value: "style-1" },
            { label: "风格 2", value: "style-2" }, { label: "风格 3", value: "style-3" }, { label: "风格 4", value: "style-4" },
          ], (s) => s.callout.style, (s, v) => ({ callout: { ...s.callout, style: v as any } }), "选择标注块的视觉风格方案"),
          slider("callout-border-opacity", "标注边框透明度", (s) => s.callout.borderOpacity, (s, v) => ({ callout: { ...s.callout, borderOpacity: v } }), 0, 1, 0.05, "调整标注边框的透明度，0为完全透明，1为完全不透明"),
          toggle("seamless-embeds", "无缝嵌入", (s) => s.embed.seamless, (s, v) => ({ embed: { ...s.embed, seamless: v } }), "移除嵌入文档的边框和背景，使其与正文融为一体"),
          select("embed-max-height", "嵌入最大高度", [
            { label: "不限制", value: "" }, { label: "300px", value: "300px" },
            { label: "500px", value: "500px" }, { label: "800px", value: "800px" },
          ], (s) => s.embed.maxHeight, (s, v) => ({ embed: { ...s.embed, maxHeight: v } }), "限制嵌入文档的最大高度，超出部分可滚动"),
        ],
      },
      {
        id: "images", title: "Images", titleZh: "图像",
        settings: [
          toggle("img-center-align", "图像居中", (s) => s.image.centerAlign, (s, v) => ({ image: { ...s.image, centerAlign: v } })),
          toggle("img-darken", "暗黑模式暗化图像", (s) => s.image.darken, (s, v) => ({ image: { ...s.image, darken: v } })),
          toggle("zoom-off", "关闭图像缩放", (s) => s.image.zoomOff, (s, v) => ({ image: { ...s.image, zoomOff: v } })),
        ],
      },
    ],
  },
  {
    id: "mobile",
    name: "移动端与适配",
    icon: "📱",
    sections: [
      {
        id: "mobile-layout", title: "Mobile Layout", titleZh: "移动端布局",
        settings: [
          toggle("card-layout-pad-open", "平板卡片布局", (s) => s.mobile.cardLayoutPad, (s, v) => ({ mobile: { ...s.mobile, cardLayoutPad: v } }), "在平板设备上启用卡片式笔记布局"),
          toggle("drawer-phone-full-width", "手机侧边栏全屏", (s) => s.mobile.drawerPhoneFullWidth, (s, v) => ({ mobile: { ...s.mobile, drawerPhoneFullWidth: v } }), "在手机端打开侧边栏时自动全屏显示，关闭后返回笔记"),
        ],
      },
      {
        id: "plugin-compat", title: "Plugin Compatibility", titleZh: "第三方插件适配",
        settings: [
          toggle("DB-table-full-width-off", "关闭 DB Folder 全宽", (s) => s.pluginCompat.dbTableFullWidthOff, (s, v) => ({ pluginCompat: { ...s.pluginCompat, dbTableFullWidthOff: v } }), "让 DB Folder 插件的表格不自动撑满整个窗口宽度"),
          select("DB-table-bg-color", "DB Folder 背景色", [
            { label: "默认", value: "default" }, { label: "适配背景", value: "adapt" }, { label: "统一背景", value: "unify" },
          ], (s) => s.pluginCompat.dbTableBgColor, (s, v) => ({ pluginCompat: { ...s.pluginCompat, dbTableBgColor: v as any } }), "设置 DB Folder 表格的背景颜色方案"),
          select("Projects-bg-color", "Projects 背景色", [
            { label: "默认", value: "default" }, { label: "适配背景", value: "adapt" }, { label: "统一背景", value: "unify" },
          ], (s) => s.pluginCompat.projectsBgColor, (s, v) => ({ pluginCompat: { ...s.pluginCompat, projectsBgColor: v as any } }), "设置 Projects 插件的背景颜色方案"),
          toggle("Surfing-bookmark-bar-hide", "Surfing 隐藏书签栏", (s) => s.pluginCompat.surfingBookmarkBarHide, (s, v) => ({ pluginCompat: { ...s.pluginCompat, surfingBookmarkBarHide: v } }), "使用 Surfing 插件浏览网页时自动隐藏书签栏，获得更大浏览空间"),
        ],
      },
    ],
  },
];

// ============================================================
// H1-H6 Tab 组件
// ============================================================

type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
const HEADING_LEVELS: HeadingLevel[] = ["h1", "h2", "h3", "h4", "h5", "h6"];

const WEIGHT_OPTIONS = [
  { label: "300 细", value: "300" }, { label: "400 常规", value: "400" }, { label: "500 中", value: "500" },
  { label: "600 半粗", value: "600" }, { label: "700 粗", value: "700" }, { label: "900 特粗", value: "900" },
];

function renderHeadingTabs(
  containerEl: HTMLElement,
  settingsManager: SettingsManager,
): void {
  // ---- 顶部：inline title + 全局 ----
  const topRow = containerEl.createDiv("zendian-heading-top-row");

  const inlineGroup = topRow.createDiv("zendian-heading-group");
  inlineGroup.createEl("span", { text: "页内标题", cls: "zendian-heading-group-label" });
  new Setting(inlineGroup).setName("移除分隔线").addToggle((t) => {
    const s = settingsManager.getSettings();
    t.setValue(s.headings.inlineTitle.dividerRemove);
    t.onChange(async (v) => { await settingsManager.updateMultiple({ headings: { ...s.headings, inlineTitle: { ...s.headings.inlineTitle, dividerRemove: v } } }); });
  });
  new Setting(inlineGroup).setName("字号").addSlider((sl) => {
    const s = settingsManager.getSettings();
    sl.setLimits(0.8, 3, 0.1);
    sl.setValue(parseFloat(s.headings.inlineTitle.size) || 1.5);
    sl.setDynamicTooltip();
    sl.onChange(async (v) => { await settingsManager.updateMultiple({ headings: { ...s.headings, inlineTitle: { ...s.headings.inlineTitle, size: `${v}em` } } }); });
  });
  new Setting(inlineGroup).setName("字重").addDropdown((d) => {
    const s = settingsManager.getSettings();
    for (const o of WEIGHT_OPTIONS) d.addOption(o.value, o.label);
    d.setValue(String(s.headings.inlineTitle.weight));
    d.onChange(async (v) => { await settingsManager.updateMultiple({ headings: { ...s.headings, inlineTitle: { ...s.headings.inlineTitle, weight: Number(v) } } }); });
  });

  const globalGroup = topRow.createDiv("zendian-heading-group");
  globalGroup.createEl("span", { text: "全局", cls: "zendian-heading-group-label" });
  new Setting(globalGroup).setName("移除指示器").addToggle((t) => {
    const s = settingsManager.getSettings();
    t.setValue(s.headings.indicatorOff);
    t.onChange(async (v) => { await settingsManager.updateMultiple({ headings: { ...s.headings, indicatorOff: v } }); });
  });
  new Setting(globalGroup).setName("还原折叠图标").addToggle((t) => {
    const s = settingsManager.getSettings();
    t.setValue(s.headings.collapseIconRestore);
    t.onChange(async (v) => { await settingsManager.updateMultiple({ headings: { ...s.headings, collapseIconRestore: v } }); });
  });

  // ---- Tab 栏 ----
  const tabBar = containerEl.createDiv("zendian-heading-tabs");
  const tabBtns = new Map<HeadingLevel, HTMLElement>();
  let active: HeadingLevel = "h1";

  for (const lv of HEADING_LEVELS) {
    const btn = tabBar.createDiv("zendian-heading-tab-btn");
    btn.textContent = lv.toUpperCase();
    btn.dataset.level = lv;
    if (lv === active) btn.classList.add("active");
    tabBtns.set(lv, btn);
  }

  // ---- 设置区 ----
  const area = containerEl.createDiv("zendian-heading-settings");

  function renderLevel(lv: HeadingLevel): void {
    area.empty();
    const s = settingsManager.getSettings();
    const h = s.headings[lv] as any;

    // H2 专属：样式切换（亮色+暗色统一）
    if (lv === "h2") {
      new Setting(area).setName("标题风格").addDropdown((d) => {
        d.addOption("twin", "线条");
        d.addOption("capsule", "方框");
        d.setValue(h.style || "twin");
        d.onChange(async (v) => {
          const cur = settingsManager.getSettings();
          await settingsManager.updateMultiple({ headings: { ...cur.headings, h2: { ...cur.headings.h2, style: v } } });
        });
      });
    }

    // 通用设置
    new Setting(area).setName("对齐方式").addDropdown((d) => {
      d.addOption("left", "居左");
      d.addOption("center", "居中");
      d.addOption("right", "居右");
      d.setValue(h.alignment || "left");
      d.onChange(async (v) => {
        const cur = settingsManager.getSettings();
        await settingsManager.updateMultiple({ headings: { ...cur.headings, [lv]: { ...cur.headings[lv], alignment: v } } });
      });
    });

    new Setting(area).setName("字号").addSlider((sl) => {
      sl.setLimits(0.8, 2.5, 0.01);
      sl.setValue(h.size);
      sl.setDynamicTooltip();
      sl.onChange(async (v) => {
        const cur = settingsManager.getSettings();
        await settingsManager.updateMultiple({ headings: { ...cur.headings, [lv]: { ...cur.headings[lv], size: v } } });
      });
    });

    new Setting(area).setName("前间距").addSlider((sl) => {
      sl.setLimits(0.5, 3, 0.1);
      sl.setValue(h.spacingStart);
      sl.setDynamicTooltip();
      sl.onChange(async (v) => {
        const cur = settingsManager.getSettings();
        await settingsManager.updateMultiple({ headings: { ...cur.headings, [lv]: { ...cur.headings[lv], spacingStart: v } } });
      });
    });

    new Setting(area).setName("后间距").addSlider((sl) => {
      sl.setLimits(0.5, 3, 0.1);
      sl.setValue(h.spacingEnd);
      sl.setDynamicTooltip();
      sl.onChange(async (v) => {
        const cur = settingsManager.getSettings();
        await settingsManager.updateMultiple({ headings: { ...cur.headings, [lv]: { ...cur.headings[lv], spacingEnd: v } } });
      });
    });
  }

  // Tab 切换事件
  tabBar.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest(".zendian-heading-tab-btn") as HTMLElement | null;
    if (!target) return;
    const lv = target.dataset.level as HeadingLevel;
    if (lv === active) return;
    active = lv;
    for (const [k, btn] of tabBtns) btn.classList.toggle("active", k === lv);
    renderLevel(lv);
  });

  renderLevel(active);
}

// ============================================================
// 设置面板主类
// ============================================================

export class ZENdianSettingTab extends PluginSettingTab {
  private settingsManager: SettingsManager;
  private moduleManager: ModuleManager;
  private activeTabId = "zendian-about";
  private navItems = new Map<string, HTMLElement>();
  private tabContents = new Map<string, HTMLElement>();

  constructor(app: App, plugin: ZENdianPlugin, settingsManager: SettingsManager, moduleManager: ModuleManager) {
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
    for (const [id, item] of this.navItems) item.classList.toggle("active", id === tabId);
    for (const [id, section] of this.tabContents) section.style.display = id === tabId ? "" : "none";
  }

  private renderAboutPage(containerEl: HTMLElement): void {
    const about = containerEl.createDiv("zendian-about");

    // ── Hero Section ──
    const hero = about.createDiv("zendian-about-hero");
    hero.createDiv("zendian-about-glow");
    const iconWrap = hero.createDiv("zendian-about-icon");
    iconWrap.innerHTML = ABOUT_SVG_LOGO;
    hero.createEl("h1", { text: "ZENdian", cls: "zendian-about-title" });
    const version = (this.plugin as any).manifest?.version ?? "unknown";
    hero.createEl("span", { text: `v${version}`, cls: "zendian-about-version" });
    hero.createEl("p", { text: "Designed by Junkey", cls: "zendian-about-author" });

    // ── Description Card ──
    const card = about.createDiv("zendian-about-card");
    card.createEl("p", {
      text: "一款综合性的 Obsidian UI 美化插件，集成 Border 主题、Phycat 苹果风格配色、增强 Markdown 渲染和 Style Settings 自定义面板。",
    });

    // ── Feature Grid ──
    const features = about.createDiv("zendian-about-features");
    features.createEl("h3", { text: "功能亮点" });
    const grid = features.createDiv("zendian-about-grid");
    for (const feat of FEATURES) {
      const featureCard = grid.createDiv("zendian-about-feature-card");
      const iconEl = featureCard.createDiv("zendian-about-feat-icon");
      iconEl.innerHTML = feat.icon;
      featureCard.createEl("div", { text: feat.title, cls: "zendian-about-feat-title" });
      featureCard.createEl("div", { text: feat.desc, cls: "zendian-about-feat-desc" });
    }

    // ── Footer ──
    about.createDiv("zendian-about-footer").createEl("span", {
      text: "Crafted with care by Junkey",
    });
  }

  private renderTabContent(containerEl: HTMLElement, tab: TabDef): void {
    for (const section of tab.sections) {
      const heading = containerEl.createDiv("zendian-section-heading");
      heading.createEl("h3", { text: `${section.titleZh} (${section.title})` });

      const sectionContent = containerEl.createDiv("zendian-section-content");

      if (section.headingTabs) {
        renderHeadingTabs(sectionContent, this.settingsManager);
      } else if (section.iconSystem) {
        this.renderIconSystem(sectionContent);
      } else {
        for (const def of section.settings ?? []) {
          this.renderSetting(sectionContent, def);
        }
      }
    }
  }

  private renderSetting(containerEl: HTMLElement, def: SettingDef): void {
    const settings = this.settingsManager.getSettings();
    const wrapper = (def.visible && !def.visible(settings))
      ? containerEl.createDiv("zendian-disabled")
      : containerEl;

    const applyDesc = (s: Setting) => { if (def.descZh) s.setDesc(def.descZh); return s; };

    switch (def.type) {
      case "toggle":
        applyDesc(new Setting(wrapper).setName(def.titleZh)).addToggle((toggle) => {
          toggle.setValue(def.get(settings));
          toggle.onChange(async (val) => { await this.settingsManager.updateMultiple(def.set(settings, val)); });
        });
        break;

      case "select":
        applyDesc(new Setting(wrapper).setName(def.titleZh)).addDropdown((dropdown) => {
          for (const opt of def.options ?? []) dropdown.addOption(opt.value, opt.label);
          dropdown.setValue(def.get(settings));
          dropdown.onChange(async (val) => { await this.settingsManager.updateMultiple(def.set(settings, val)); });
        });
        break;

      case "number":
        applyDesc(new Setting(wrapper).setName(def.titleZh)).addText((text) => {
          text.inputEl.type = "number";
          if (def.min !== undefined) text.inputEl.min = String(def.min);
          if (def.max !== undefined) text.inputEl.max = String(def.max);
          if (def.step !== undefined) text.inputEl.step = String(def.step);
          text.setValue(String(def.get(settings)));
          text.onChange(async (val) => { const n = parseFloat(val); if (!isNaN(n)) await this.settingsManager.updateMultiple(def.set(settings, n)); });
        });
        break;

      case "text":
        applyDesc(new Setting(wrapper).setName(def.titleZh)).addText((text) => {
          if (def.placeholder) text.setPlaceholder(def.placeholder);
          text.setValue(def.get(settings));
          text.onChange(async (val) => { await this.settingsManager.updateMultiple(def.set(settings, val)); });
        });
        break;

      case "number-slider":
        applyDesc(new Setting(wrapper).setName(def.titleZh)).addSlider((slider) => {
          slider.setLimits(def.min ?? 0, def.max ?? 1, def.step ?? 0.01);
          slider.setValue(def.get(settings));
          slider.setDynamicTooltip();
          slider.onChange(async (val) => { await this.settingsManager.updateMultiple(def.set(settings, val)); });
        });
        break;
    }
  }

  private renderIconSystem(containerEl: HTMLElement): void {
    const sm = this.settingsManager;
    const mod = this.moduleManager.getModule("icon-system") as IconSystemModule | undefined;

    // ── 基础开关 ──
    const toggleSection = containerEl.createDiv("zendian-icon-section");
    toggleSection.createEl("h4", { text: "基本设置 (General)" });

    new Setting(toggleSection).setName("启用全局文件图标").setDesc("为文件树启用数据驱动的动态图标系统，替代默认的静态图标").addToggle((t) => {
      const s = sm.getSettings();
      t.setValue(s.iconSystem.enabled);
      t.onChange(async (v) => await sm.updateMultiple({ iconSystem: { ...s.iconSystem, enabled: v } }));
    });

    new Setting(toggleSection).setName("启用独立自定义图标").setDesc("允许通过右键菜单为单独文件指定自定义图标").addToggle((t) => {
      const s = sm.getSettings();
      t.setValue(s.iconSystem.customEnabled);
      t.onChange(async (v) => await sm.updateMultiple({ iconSystem: { ...s.iconSystem, customEnabled: v } }));
    });

    new Setting(toggleSection).setName("启用标签页图标").setDesc("在工作区的标签页标题前显示对应的文件图标").addToggle((t) => {
      const s = sm.getSettings();
      t.setValue(s.iconSystem.tabIconsEnabled);
      t.onChange(async (v) => await sm.updateMultiple({ iconSystem: { ...s.iconSystem, tabIconsEnabled: v } }));
    });

    // ── 已安装图库 ──
    const libSection = containerEl.createDiv("zendian-icon-section");
    libSection.createEl("h4", { text: "图标库 (Icon Libraries)" });

    for (const lib of BUILTIN_LIBRARIES) {
      new Setting(libSection)
        .setName(lib.label)
        .setDesc(`安装 ${lib.label} 图标集`)
        .addToggle((t) => {
          t.setValue(mod?.isLibraryInstalled(lib.name) ?? false);
          t.onChange(async (v) => {
            if (!mod) return;
            try {
              v ? await mod.installLibrary(lib.name) : await mod.uninstallLibrary(lib.name);
            } catch (err) {
              console.error("[ZENdian] Library operation failed:", err);
              t.setValue(!v);
            }
          });
        });
    }

    // 添加自定义库入口
    const addLibSetting = new Setting(libSection).setName("添加图标库").setDesc("输入自定义图标库名称（预置库请使用上方开关）");
    let libInput: HTMLInputElement;
    addLibSetting.addText((text) => {
      libInput = text.inputEl;
      text.setPlaceholder("my-icons");
    });
    addLibSetting.addButton((btn) => {
      btn.setButtonText("安装").onClick(async () => {
        const name = libInput.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
        if (!name || !mod) return;
        try {
          await mod.installLibrary(name);
          libInput.value = "";
        } catch {
          // ignore
        }
      });
    });

    // ── 默认图标规则 ──
    const rulesSection = containerEl.createDiv("zendian-icon-section");
    rulesSection.createEl("h4", { text: "默认图标规则 (Default Rules)" });

    const rulesContainer = rulesSection.createDiv("zendian-icon-rules-list");

    const renderRules = () => {
      rulesContainer.empty();
      const s = sm.getSettings();
      const rules = s.iconSystem.defaultRules;

      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const row = rulesContainer.createDiv("zendian-icon-rule-row");

        // 正则输入
        const regexInput = row.createEl("input", {
          cls: "zendian-icon-rule-regex",
          type: "text",
          value: rule.regex,
          placeholder: "\\.md$",
        }) as HTMLInputElement;

        // 图标选择按钮
        const iconBtn = row.createEl("button", {
          cls: "zendian-icon-rule-icon-btn",
          text: rule.iconId || "选择图标",
        }) as HTMLButtonElement;
        iconBtn.addEventListener("click", () => {
          const libraries = ["Lucide", ...(s.iconSystem.installedLibraries)];
          new IconPickerModal(this.app, libraries, (iconId) => {
            if (iconId === null) return;
            iconBtn.textContent = iconId;
            const current = sm.getSettings();
            const newRules = [...current.iconSystem.defaultRules];
            newRules[i] = { ...newRules[i], iconId };
            sm.updateMultiple({ iconSystem: { ...current.iconSystem, defaultRules: newRules } });
          }).open();
        });

        // 颜色输入
        const colorInput = row.createEl("input", {
          cls: "zendian-icon-rule-color",
          type: "text",
          value: rule.color || "",
          placeholder: "颜色(可选)",
        }) as HTMLInputElement;

        // 失焦时保存正则和颜色
        const saveFields = async () => {
          const current = sm.getSettings();
          const newRules = [...current.iconSystem.defaultRules];
          newRules[i] = {
            ...newRules[i],
            regex: regexInput.value,
            color: colorInput.value || undefined,
          };
          await sm.updateMultiple({ iconSystem: { ...current.iconSystem, defaultRules: newRules } });
        };
        regexInput.addEventListener("blur", saveFields);
        colorInput.addEventListener("blur", saveFields);

        // 删除按钮
        const delBtn = row.createEl("button", {
          cls: "zendian-icon-rule-delete",
          text: "×",
        }) as HTMLButtonElement;
        delBtn.addEventListener("click", async () => {
          const current = sm.getSettings();
          const newRules = current.iconSystem.defaultRules.filter((_, idx) => idx !== i);
          await sm.updateMultiple({ iconSystem: { ...current.iconSystem, defaultRules: newRules } });
          renderRules();
        });
      }

      // 添加新规则按钮
      const addBtn = rulesContainer.createEl("button", {
        cls: "zendian-icon-rule-add",
        text: "+ 添加规则",
      });
      addBtn.addEventListener("click", async () => {
        const current = sm.getSettings();
        const newRules = [...current.iconSystem.defaultRules, { regex: "", iconId: "lucide-file", color: undefined }];
        await sm.updateMultiple({ iconSystem: { ...current.iconSystem, defaultRules: newRules } });
        renderRules();
      });
    };

    renderRules();
  }
}
