/**
 * ZENdian 设置面板
 * 精简版：无字体设置、无颜色设置，text 输入改为 select/slider
 */

import { App, getIcon, Notice, PluginSettingTab, Setting, SliderComponent, TFolder, TextComponent } from "obsidian";
import type ZENdianPlugin from "../main";
import type { SettingsManager } from "../core/settings-manager";
import type { ModuleManager } from "../core/module-manager";
import { DEFAULT_SETTINGS, type PluginSettings } from "../types/settings.types";
import { getProjectCategoryFolder } from "../homepage/project-categories";
import { BUILTIN_LIBRARIES, type IconSystemModule } from "../modules/icon-system.module";
import { IconPickerModal } from "./icon-picker-modal";
import { DonationModal, type DonationChannel } from "./donation-modal";
import { confirmAction } from "./confirm-modal";
import { openPopoutForm } from "./popout-form";
import { getProjectSubfolderName, validateProjectSubfolderTemplate } from "../homepage/project-subfolders";

// ============================================================
// 设置项定义
// ============================================================

interface SettingBase {
  id: string;
  titleZh: string;
  descZh?: string;
  keywords?: string[];
  advanced?: boolean;
  visible?: (s: PluginSettings) => boolean;
}

interface ToggleDef extends SettingBase {
  type: "toggle";
  get: (s: PluginSettings) => boolean;
  set: (s: PluginSettings, val: boolean) => Partial<PluginSettings>;
}

interface SelectDef extends SettingBase {
  type: "select";
  get: (s: PluginSettings) => string;
  set: (s: PluginSettings, val: string) => Partial<PluginSettings>;
  options?: { label: string; value: string }[];
}

interface NumberDef extends SettingBase {
  type: "number";
  get: (s: PluginSettings) => number;
  set: (s: PluginSettings, val: number) => Partial<PluginSettings>;
  min?: number;
  max?: number;
  step?: number;
  format?: string;
}

interface SliderDef extends SettingBase {
  type: "number-slider";
  get: (s: PluginSettings) => number;
  set: (s: PluginSettings, val: number) => Partial<PluginSettings>;
  min: number;
  max: number;
  step: number;
  format?: string;
}

interface TextDef extends SettingBase {
  type: "text" | "color";
  get: (s: PluginSettings) => string;
  set: (s: PluginSettings, val: string) => Partial<PluginSettings>;
  placeholder?: string;
}

interface ButtonDef extends SettingBase {
  type: "button";
  buttonText: string;
  get: (s: PluginSettings) => boolean;
  set: (s: PluginSettings, val: boolean) => Partial<PluginSettings>;
}

type SettingDef = ToggleDef | SelectDef | NumberDef | SliderDef | TextDef | ButtonDef;

interface SectionDef {
  id: string;
  title: string;
  titleZh: string;
  settings?: SettingDef[];
  headingTabs?: boolean;
  iconSystem?: boolean;
  projectCategories?: boolean;
  projectSubfolders?: boolean;
  comingSoon?: boolean;
  hideGroupReset?: boolean;
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

function slider(id: string, titleZh: string, get: (s: PluginSettings) => number, set: (s: PluginSettings, v: number) => any, min: number, max: number, step: number, descZh?: string): SettingDef {
  return { id, titleZh, descZh, type: "number-slider", get, set: (s, v) => set(s, v), min, max, step };
}

function text(id: string, titleZh: string, get: (s: PluginSettings) => string, set: (s: PluginSettings, v: string) => any, placeholder?: string, descZh?: string): SettingDef {
  return { id, titleZh, descZh, type: "text", get, set: (s, v) => set(s, v), placeholder };
}

function color(id: string, titleZh: string, get: (s: PluginSettings) => string, set: (s: PluginSettings, v: string) => any, descZh?: string): SettingDef {
  return { id, titleZh, descZh, type: "color", get, set: (s, v) => set(s, v) };
}

function advanced(def: SettingDef): SettingDef {
  return { ...def, advanced: true };
}

function when(def: SettingDef, visible: (settings: PluginSettings) => boolean): SettingDef {
  return { ...def, visible };
}

function button(id: string, titleZh: string, buttonText: string, set: (s: PluginSettings) => Partial<PluginSettings>, descZh?: string): SettingDef {
  return { id, titleZh, descZh, type: "button", buttonText, get: () => true, set: (s) => set(s) };
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
  homepage: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/>
    <rect x="14" y="3" width="7" height="4" rx="1.5"/>
    <rect x="14" y="10" width="7" height="11" rx="1.5"/>
    <rect x="3" y="13" width="7" height="8" rx="1.5"/>
  </svg>`,
};

interface FeatureItem {
  icon: string;
  title: string;
  desc: string;
}

const FEATURES: FeatureItem[] = [
  { icon: FEAT_ICONS.homepage, title: "智能主页", desc: "集中查看待办、便签、最近笔记、书摘、天气、热力图与月度数据" },
  { icon: FEAT_ICONS.cardLayout, title: "项目管理", desc: "按分类创建项目目录，配置子文件夹模板、项目状态与归档规则" },
  { icon: FEAT_ICONS.iconSystem, title: "项目控制台", desc: "通过 .home 控制台管理项目简介、任务、交付物、进度与最近文件" },
  { icon: FEAT_ICONS.focusMode, title: "任务协同", desc: "以项目主页保存项目任务，管理优先级、标签、日程与完成状态" },
  { icon: FEAT_ICONS.autoHide, title: "时间轴", desc: "汇总文件、任务和项目事件，支持日期分组、事件筛选与检查点" },
  { icon: FEAT_ICONS.codeBlocks, title: "项目快照", desc: "为文本文件建立去重快照，提供差异预览、检查点和安全恢复" },
  { icon: FEAT_ICONS.compat, title: "数据洞察", desc: "通过活动热力图、任务趋势、完成率和项目健康度了解推进情况" },
  { icon: FEAT_ICONS.headings, title: "写作与界面", desc: "以专注模式、排版、图标和界面细节辅助日常知识工作" },
];

// ============================================================
// 菜单配置
// ============================================================

const SECTION_SOURCE: TabDef[] = [
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
          advanced(slider("canvas-card-border-width", "Canvas 卡片边框", (s) => s.cardLayout.canvasBorderWidth, (s, v) => ({ cardLayout: { ...s.cardLayout, canvasBorderWidth: v } }), 0, 8, 1, "边框宽度，单位 px")),
          select("canvas-card-menu", "Canvas 卡片菜单位置", [
            { label: "居中", value: "center" }, { label: "左侧", value: "left" }, { label: "右侧", value: "right" },
          ], (s) => s.cardLayout.canvasMenu, (s, v) => ({ cardLayout: { ...s.cardLayout, canvasMenu: v as any } }), "设置白板卡片右键菜单的弹出位置"),
          toggle("media-embed-card-border-off", "移除媒体卡片边框", (s) => s.cardLayout.mediaEmbedBorderOff, (s, v) => ({ cardLayout: { ...s.cardLayout, mediaEmbedBorderOff: v } }), "移除图片、视频等媒体嵌入卡片的边框和阴影"),
        ],
      },
      {
        id: "graph-view", title: "Graph View", titleZh: "关系图谱",
        hideGroupReset: true,
        settings: [
          toggle("graph-view-enabled", "关系图谱美化", (s) => s.graph.enabled, (s, v) => ({ graph: { ...s.graph, enabled: v } }), "美化 Obsidian 官方全局图谱与局部图谱，不替换其数据、布局或交互"),
          when(slider("graph-nebula-intensity", "星云浓度", (s) => s.graph.nebulaIntensity, (s, v) => ({ graph: { ...s.graph, nebulaIntensity: v } }), 0, 1, 0.05, "调整官方图谱底层星云氛围，不改变节点和连线布局"), (s) => s.graph.enabled),
          when(toggle("graph-motion-enabled", "星云持续漂移", (s) => s.graph.motionEnabled, (s, v) => ({ graph: { ...s.graph, motionEnabled: v } }), "桌面端缓慢漂移；移动端与减少动态效果模式始终静止"), (s) => s.graph.enabled),
          when(slider("graph-motion-speed", "漂移速度", (s) => s.graph.motionSpeed, (s, v) => ({ graph: { ...s.graph, motionSpeed: v } }), 0.5, 1.5, 0.05, "调节三层星云的漂移速度"), (s) => s.graph.enabled && s.graph.motionEnabled),
          when(toggle("graph-starfield-enabled", "显示星尘", (s) => s.graph.starfieldEnabled, (s, v) => ({ graph: { ...s.graph, starfieldEnabled: v } }), "显示低密度、不闪烁的星尘层"), (s) => s.graph.enabled),
          when(toggle("graph-local-boost", "局部图谱增强", (s) => s.graph.localGraphBoost, (s, v) => ({ graph: { ...s.graph, localGraphBoost: v } }), "提高局部图谱文字与连线对比度"), (s) => s.graph.enabled),
          when(toggle("graph-compact-controls", "紧凑控制面板", (s) => s.graph.compactControls, (s, v) => ({ graph: { ...s.graph, compactControls: v } }), "收紧官方图谱控制面板的尺寸与间距"), (s) => s.graph.enabled),
          when(button("graph-reset-defaults", "恢复默认", "恢复", () => ({ graph: { ...DEFAULT_SETTINGS.graph } }), "恢复关系图谱的全部默认设置"), (s) => s.graph.enabled),
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
          {
            ...text("new-tab-image", "自定义图片地址", (s) => s.newTab.imageUrl, (s, v) => ({ newTab: { ...s.newTab, imageUrl: v } }), "https://… 或仓库资源地址", "仅在选择自定义图像时使用"),
            visible: (s) => s.newTab.imageStyle === "customize",
          },
        ],
      },
      {
        id: "ui-details", title: "UI Details", titleZh: "界面细节",
        settings: [
          toggle("scrollbar-hide", "隐藏滚动条", (s) => s.scrollbar.hide, (s, v) => ({ scrollbar: { ...s.scrollbar, hide: v, restored: v ? false : s.scrollbar.restored } }), "完全隐藏滚动条，内容仍可滚动，界面更简洁"),
          toggle("restored-scrollbars", "还原滚动条样式", (s) => s.scrollbar.restored, (s, v) => ({ scrollbar: { ...s.scrollbar, restored: v, hide: v ? false : s.scrollbar.hide } }), "将滚动条恢复为系统默认样式，而非主题自定义的细滚动条"),
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
          toggle("file-names-untrim", "显示完整文件名", (s) => s.fileTree.fileNamesUntrim, (s, v) => ({ fileTree: { ...s.fileTree, fileNamesUntrim: v } }), "允许较长文件名完整显示而不是省略"),
          toggle("folder-font-bold", "加粗文件夹字体", (s) => s.fileTree.folderFontBold, (s, v) => ({ fileTree: { ...s.fileTree, folderFontBold: v } })),
        ],
      },
      {
        id: "file-tree-cards", title: "File List Style", titleZh: "文件列表样式",
        settings: [
          select("folder-cards-style", "样式", [{ label: "卡片", value: "card" }, { label: "胶囊", value: "capsule" }], (s) => s.folderCards.style, (s, v) => ({ folderCards: { ...s.folderCards, style: v === "capsule" ? "capsule" : "card" } }), "选择递归卡片样式或旧版文件夹胶囊遮罩样式"),
          toggle("folder-cards", "启用文件列表样式", (s) => s.folderCards.enabled, (s, v) => ({ folderCards: { ...s.folderCards, enabled: v } }), "按文件夹嵌套关系显示文件列表样式"),
          { ...slider("folder-cards-opacity", "颜色强度", (s) => s.folderCards.opacity, (s, v) => ({ folderCards: { ...s.folderCards, opacity: v } }), 0.05, 0.8, 0.05, "调整文件夹样式主题色表面的强度"), visible: (s) => s.folderCards.enabled },
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
          { ...slider("line-normal-opacity", "普通行透明度", (s) => s.editorEnhance.focusModeOpacity, (s, v) => ({ editorEnhance: { ...s.editorEnhance, focusModeOpacity: v } }), 0.05, 1, 0.05, "降低非当前行的透明度，让注意力集中在正在编辑的段落"), visible: (s) => s.editorEnhance.focusMode },
          {
            ...toggle("focus-mode-typewriter", "打字机滚动", (s) => s.editorEnhance.focusModeTypewriter, (s, v) => ({ editorEnhance: { ...s.editorEnhance, focusModeTypewriter: v } }), "编辑时自动使用源码模式，并将当前输入位置固定在视口约 55% 处；换行时周围内容轻柔滑动。手动滚动或切换到实时预览时会暂时暂停"),
            visible: (s) => s.editorEnhance.focusMode,
          },
          toggle("focus-clock-enabled", "启用专注时钟", (s) => s.editorEnhance.focusClockEnabled, (s, v) => ({ editorEnhance: { ...s.editorEnhance, focusClockEnabled: v } }), "在右下角状态栏显示专注时钟入口；专注进行时仅显示计时和图标控制"),
          { ...select("focus-clock-default-minutes", "默认专注时长", [
            { label: "25 分钟", value: "25" },
            { label: "50 分钟", value: "50" },
            { label: "90 分钟", value: "90" },
          ], (s) => String(s.editorEnhance.focusClockDefaultMinutes), (s, v) => ({ editorEnhance: { ...s.editorEnhance, focusClockDefaultMinutes: Number(v) } }), "打开面板时预选的专注时长"), visible: (s) => s.editorEnhance.focusClockEnabled },
          { ...slider("focus-clock-break-minutes", "默认休息时长", (s) => s.editorEnhance.focusClockBreakMinutes, (s, v) => ({ editorEnhance: { ...s.editorEnhance, focusClockBreakMinutes: v } }), 0, 30, 1, "设为 0 时，专注完成后不进入休息倒计时"), visible: (s) => s.editorEnhance.focusClockEnabled },
          { ...toggle("focus-clock-auto-focus-mode", "计时时启用编辑器专注效果", (s) => s.editorEnhance.focusClockAutoEnableFocusMode, (s, v) => ({ editorEnhance: { ...s.editorEnhance, focusClockAutoEnableFocusMode: v } }), "只在本次计时期间临时启用，结束后恢复原状态"), visible: (s) => s.editorEnhance.focusClockEnabled },
          { ...toggle("focus-clock-sound", "结束提示音", (s) => s.editorEnhance.focusClockSound, (s, v) => ({ editorEnhance: { ...s.editorEnhance, focusClockSound: v } }), "专注或休息倒计时结束时播放轻提示音"), visible: (s) => s.editorEnhance.focusClockEnabled },
        ],
      },
      {
        id: "hover-indicator", title: "Hover Indicator", titleZh: "焦点指示",
        settings: [
          toggle("line-hover-indicator", "启用焦点指示器", (s) => s.editorEnhance.hoverIndicator, (s, v) => ({ editorEnhance: { ...s.editorEnhance, hoverIndicator: v } }), "鼠标悬停的行左侧显示竖线标记，在长文档中帮助快速定位当前浏览位置。配合列表层级指示可进一步区分嵌套层次"),
          toggle("focus-indicator-list-level", "指示列表层级", (s) => s.editorEnhance.hoverIndicatorListLevel, (s, v) => ({ editorEnhance: { ...s.editorEnhance, hoverIndicatorListLevel: v } }), "焦点指示器根据列表缩进层级显示不同颜色"),
          advanced(toggle("focus-indicator-codeblock-line-number", "指示代码块行号", (s) => s.editorEnhance.hoverIndicatorCodeblockLineNumber, (s, v) => ({ editorEnhance: { ...s.editorEnhance, hoverIndicatorCodeblockLineNumber: v } }), "在代码块焦点指示中显示行号层级")),
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
          slider("file-line-width", "阅读区宽度", (s) => s.typography.fileLineWidth, (s, v) => ({ typography: { ...s.typography, fileLineWidth: v } }), 560, 1200, 20, "编辑与阅读共用的正文版心宽度；860px 兼顾信息密度与长文可读性"),
          toggle("editor-grid-background-pattren", "网格背景图案", (s) => s.editorEnhance.gridBackground, (s, v) => ({ editorEnhance: { ...s.editorEnhance, gridBackground: v } }), "在编辑器背景显示淡雅的网格线，营造书写纸效果"),
          { ...select("grid-background-pattern-size", "网格背景尺寸", [
            { label: "小", value: "24px" }, { label: "中", value: "36px" }, { label: "大", value: "48px" },
          ], (s) => s.editorEnhance.gridBackgroundSize, (s, v) => ({ editorEnhance: { ...s.editorEnhance, gridBackgroundSize: v } }), "选择网格密度"), visible: (s) => s.editorEnhance.gridBackground },
          toggle("text-align-justify", "段落两端对齐", (s) => s.typography.textAlignJustify, (s, v) => ({ typography: { ...s.typography, textAlignJustify: v } }), "使段落文本左右两端对齐，类似报纸排版效果"),
          slider("letter-spacing", "字间距", (s) => s.typography.letterSpacing, (s, v) => ({ typography: { ...s.typography, letterSpacing: v } }), 0, 1.5, 0.1, "轻微增加中英文混排行距感，默认 0.2px"),
          slider("line-height-customize", "段落行高", (s) => s.typography.lineHeight, (s, v) => ({ typography: { ...s.typography, lineHeight: v } }), 1.4, 2.2, 0.05, "默认 1.7，在紧凑信息密度与连续阅读之间取平衡"),
          advanced(text("p-spacing", "段落间距", (s) => s.typography.paragraphSpacing, (s, v) => ({ typography: { ...s.typography, paragraphSpacing: v } }), "1em", "支持合法 CSS 长度，例如 1em 或 16px")),
          advanced(toggle("p-spacing-br", "空行也使用段落间距", (s) => s.typography.paragraphSpacingBr, (s, v) => ({ typography: { ...s.typography, paragraphSpacingBr: v } }))),
        ],
      },
      {
        id: "heading-system", title: "Heading System", titleZh: "标题系统",
        headingTabs: true,
      },
      {
        id: "banner", title: "Banner", titleZh: "页眉图片",
        settings: [
          { ...select("banner-display-mode", "展示模式", [
            { label: "智能混合 (Smart)", value: "smart" },
            { label: "铺满裁剪 (Cover)", value: "cover" },
            { label: "完整显示 (Contain)", value: "contain" },
          ], (s) => s.banner.displayMode, (s, v) => ({ banner: { ...s.banner, displayMode: v as "smart" | "cover" | "contain" } }), "智能模式会在裁剪过多时使用模糊背景和完整前景图"), visible: (s) => s.banner.enabled },
          { ...slider("banner-content-overlap", "内容上移量", (s) => s.banner.contentOverlap, (s, v) => ({ banner: { ...s.banner, contentOverlap: v } }), 0, 220, 10, "标题和属性面板叠入页眉图片底部的距离（像素）"), visible: (s) => s.banner.enabled },
          toggle("banner-enabled", "启用页眉图片", (s) => s.banner.enabled, (s, v) => ({ banner: { ...s.banner, enabled: v } }), "在笔记顶部显示页眉图片，需在 frontmatter 中设置对应键名的图片链接"),
          { ...text("banner-yaml-key", "页眉 YAML 键名", (s) => s.banner.yamlKey, (s, v) => ({ banner: { ...s.banner, yamlKey: v } }), "banner", "用于读取图片的 YAML frontmatter 键名"), visible: (s) => s.banner.enabled },
          { ...slider("banner-height", "页眉高度", (s) => s.banner.height, (s, v) => ({ banner: { ...s.banner, height: v } }), 150, 1000, 10, "调整页眉图片的高度（像素）"), visible: (s) => s.banner.enabled },
          { ...select("banner-position", "图片对齐方式", [
            { label: "居中 (Center)", value: "center" },
            { label: "顶部向下 (Top)", value: "top" },
            { label: "底部向上 (Bottom)", value: "bottom" },
          ], (s) => s.banner.position, (s, v) => ({ banner: { ...s.banner, position: v } }), "选择图片在页眉容器中的对齐和裁剪锚点"), visible: (s) => s.banner.enabled },
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
          advanced(select("link-decoration-hover", "链接悬停装饰", [
            { label: "下划线", value: "underline" }, { label: "无装饰", value: "none" }, { label: "虚线", value: "dotted" },
          ], (s) => s.link.decorationHover, (s, v) => ({ link: { ...s.link, decorationHover: v } }))),
          select("link-external-decoration", "外部链接样式", [
            { label: "下划线偏移", value: "underline-offset" }, { label: "下划线", value: "underline" },
            { label: "无装饰", value: "none" }, { label: "虚线", value: "dotted" },
          ], (s) => s.link.externalDecoration, (s, v) => ({ link: { ...s.link, externalDecoration: v } }), "设置外部链接的装饰样式，如 underline、none"),
          advanced(select("link-external-decoration-hover", "外部链接悬停装饰", [
            { label: "下划线", value: "underline" }, { label: "无装饰", value: "none" }, { label: "虚线", value: "dotted" },
          ], (s) => s.link.externalDecorationHover, (s, v) => ({ link: { ...s.link, externalDecorationHover: v } }))),
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
          slider("code-line-height", "代码行高", (s) => s.typography.codeLineHeight, (s, v) => ({ typography: { ...s.typography, codeLineHeight: v } }), 1.3, 2, 0.05, "编辑与阅读代码块共用，默认 1.5"),
          slider("blockquote-line-height", "引用块行高", (s) => s.typography.blockquoteLineHeight, (s, v) => ({ typography: { ...s.typography, blockquoteLineHeight: v } }), 1.3, 2, 0.05, "默认 1.6，保持引用内容清晰但不过度膨胀"),
          advanced(text("code-block-padding-x", "代码块水平内边距", (s) => s.codeBlock.horizontalPadding, (s, v) => ({ codeBlock: { ...s.codeBlock, horizontalPadding: v } }), "14px", "同时作用于阅读模式代码内容")),
          advanced(text("code-block-margin", "代码块外边距", (s) => s.codeBlock.blockMargin, (s, v) => ({ codeBlock: { ...s.codeBlock, blockMargin: v } }), "0.8em 0", "控制代码块与正文的垂直距离")),
          when(advanced(color("code-background-light", "代码背景（浅色）", (s) => s.codeBlock.backgroundLight, (s, v) => ({ codeBlock: { ...s.codeBlock, backgroundLight: v } }), "留空时跟随主题")), (s) => s.codeBlock.theme === "customize"),
          when(advanced(color("code-background-dark", "代码背景（深色）", (s) => s.codeBlock.backgroundDark, (s, v) => ({ codeBlock: { ...s.codeBlock, backgroundDark: v } }), "留空时跟随主题")), (s) => s.codeBlock.theme === "customize"),
          when(advanced(color("code-border-light", "代码边框（浅色）", (s) => s.codeBlock.borderLight, (s, v) => ({ codeBlock: { ...s.codeBlock, borderLight: v } }), "留空时跟随主题")), (s) => s.codeBlock.theme === "customize"),
          when(advanced(color("code-border-dark", "代码边框（深色）", (s) => s.codeBlock.borderDark, (s, v) => ({ codeBlock: { ...s.codeBlock, borderDark: v } }), "留空时跟随主题")), (s) => s.codeBlock.theme === "customize"),
          advanced(color("blockquote-background-light", "引用背景（浅色）", (s) => s.blockquote.backgroundLight, (s, v) => ({ blockquote: { ...s.blockquote, backgroundLight: v } }), "留空时跟随主题")),
          advanced(color("blockquote-background-dark", "引用背景（深色）", (s) => s.blockquote.backgroundDark, (s, v) => ({ blockquote: { ...s.blockquote, backgroundDark: v } }), "留空时跟随主题")),
          advanced(text("blockquote-padding", "引用块内边距", (s) => s.blockquote.padding, (s, v) => ({ blockquote: { ...s.blockquote, padding: v } }), "0.75em 1em 0.75em 2.5em")),
          advanced(text("blockquote-margin", "引用块外边距", (s) => s.blockquote.margin, (s, v) => ({ blockquote: { ...s.blockquote, margin: v } }), "0.75em 0")),
        ],
      },
      {
        id: "list-table", title: "Lists & Tables", titleZh: "列表与表格",
        settings: [
          select("list-indent", "列表缩进", [
            { label: "紧凑", value: "1.5em" }, { label: "紧凑平衡", value: "1.75em" }, { label: "标准", value: "2.25em" }, { label: "宽松", value: "3em" },
          ], (s) => s.listTable.listIndent, (s, v) => ({ listTable: { ...s.listTable, listIndent: v } })),
          slider("list-spacing", "列表间距", (s) => parseFloat(s.listTable.listSpacing) || 0.075, (s, v) => ({ listTable: { ...s.listTable, listSpacing: `${v}em` } }), 0, 1, 0.025, "设置列表项之间的垂直间距"),
          toggle("ul-marker-restore", "恢复无序列表默认样式", (s) => s.listTable.ulMarkerRestore, (s, v) => ({ listTable: { ...s.listTable, ulMarkerRestore: v } }), "将无序列表的圆点标记恢复为 Obsidian 默认样式"),
          toggle("disable-alternative-checkboxes", "禁用备用复选框", (s) => s.listTable.disableAlternativeCheckboxes, (s, v) => ({ listTable: { ...s.listTable, disableAlternativeCheckboxes: v } }), "如果你使用 CSS 片段实现了自己的复选框样式，请禁用此项"),
          toggle("colorful-checkbox", "多彩复选框", (s) => s.checkbox.colorful, (s, v) => ({ checkbox: { ...s.checkbox, colorful: v } }), "为 Checklist 插件的复选框添加不同颜色，区分任务状态"),
          select("table-width-select", "表格宽度", [
            { label: "与行宽一致", value: "default" }, { label: "Obsidian 默认", value: "obsidian-default" }, { label: "自定义", value: "customized" },
          ], (s) => s.listTable.tableWidthMode, (s, v) => ({ listTable: { ...s.listTable, tableWidthMode: v as any } }), "选择表格宽度的计算方式"),
          { ...slider("table-width", "自定义表格宽度", (s) => s.listTable.tableWidth, (s, v) => ({ listTable: { ...s.listTable, tableWidth: v } }), 10, 100, 1, "编辑器面板宽度的百分比"), visible: (s) => s.listTable.tableWidthMode === "customized" },
          slider("table-line-height", "表格行高", (s) => s.typography.tableLineHeight, (s, v) => ({ typography: { ...s.typography, tableLineHeight: v } }), 1.2, 2, 0.05, "默认 1.4，适合高密度表格"),
          advanced(text("table-cell-padding", "表格单元格内边距", (s) => s.listTable.tableCellPadding, (s, v) => ({ listTable: { ...s.listTable, tableCellPadding: v } }), "7px 10px")),
          advanced(text("table-margin", "表格外边距", (s) => s.listTable.tableMargin, (s, v) => ({ listTable: { ...s.listTable, tableMargin: v } }), "0.8em 0")),
          advanced(text("checkbox-radius", "复选框圆角", (s) => s.listTable.checkboxRadius, (s, v) => ({ listTable: { ...s.listTable, checkboxRadius: v } }), "6px", "支持合法 CSS 圆角值")),
          advanced(color("table-header-background-light", "表头背景（浅色）", (s) => s.listTable.tableHeaderBgLight, (s, v) => ({ listTable: { ...s.listTable, tableHeaderBgLight: v } }), "留空时跟随主题")),
          advanced(color("table-header-background-dark", "表头背景（深色）", (s) => s.listTable.tableHeaderBgDark, (s, v) => ({ listTable: { ...s.listTable, tableHeaderBgDark: v } }), "留空时跟随主题")),
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
          when(advanced(text("callout-border-width", "标注边框", (s) => s.callout.borderWidth, (s, v) => ({ callout: { ...s.callout, borderWidth: v } }), "1px", "自定义模式下使用合法 CSS 边框宽度")), (s) => s.callout.style === "customize"),
          when(advanced(text("callout-padding", "标注内边距", (s) => s.callout.padding, (s, v) => ({ callout: { ...s.callout, padding: v } }), "12px", "自定义模式下生效")), (s) => s.callout.style === "customize"),
          when(advanced(text("callout-margin", "标注外边距", (s) => s.callout.margin, (s, v) => ({ callout: { ...s.callout, margin: v } }), "0.8em 0", "自定义模式下生效")), (s) => s.callout.style === "customize"),
          when(advanced(text("callout-title-padding", "标注标题内边距", (s) => s.callout.titlePadding, (s, v) => ({ callout: { ...s.callout, titlePadding: v } }), "8px 16px")), (s) => s.callout.style === "customize"),
          when(advanced(text("callout-title-size", "标注标题字号", (s) => s.callout.titleSize, (s, v) => ({ callout: { ...s.callout, titleSize: v } }), "inherit")), (s) => s.callout.style === "customize"),
          when(advanced(text("callout-content-padding", "标注内容内边距", (s) => s.callout.contentPadding, (s, v) => ({ callout: { ...s.callout, contentPadding: v } }), "0 16px")), (s) => s.callout.style === "customize"),
          when(advanced(text("callout-content-radius", "标注内容圆角", (s) => s.callout.contentRadius, (s, v) => ({ callout: { ...s.callout, contentRadius: v } }), "4px")), (s) => s.callout.style === "customize"),
          toggle("seamless-embeds", "无缝嵌入", (s) => s.embed.seamless, (s, v) => ({ embed: { ...s.embed, seamless: v } }), "移除嵌入文档的边框和背景，使其与正文融为一体"),
          select("embed-max-height", "嵌入最大高度", [
            { label: "不限制", value: "" }, { label: "300px", value: "300px" },
            { label: "500px", value: "500px" }, { label: "800px", value: "800px" },
          ], (s) => s.embed.maxHeight, (s, v) => ({ embed: { ...s.embed, maxHeight: v } }), "限制嵌入文档的最大高度，超出部分可滚动"),
          advanced(text("embed-border-radius", "嵌入圆角", (s) => s.embed.borderRadius, (s, v) => ({ embed: { ...s.embed, borderRadius: v } }), "0px", "支持合法 CSS 圆角值")),
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
    name: "移动端",
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
        comingSoon: true,
      },
    ],
  },
  {
    id: "homepage",
    name: "主页",
    icon: "🏠",
    sections: [
      {
        id: "homepage-basic", title: "Homepage", titleZh: "主页设置",
        settings: [
          toggle("homepage-enabled", "启用主页", (s) => s.homepage.enabled, (s, v) => ({ homepage: { ...s.homepage, enabled: v } }), "将新标签页默认内容替换为主页仪表盘"),
          toggle("homepage-popout-panels", "面板使用新窗口", (s) => s.mobile.openPanelsInNewWindow ?? true, (s, v) => ({ mobile: { ...s.mobile, openPanelsInNewWindow: v } }), "新建项目、待办、速记、全部列表和专注钟会优先在独立窗口打开；不支持时自动回退到当前窗口"),
          text("homepage-username", "用户名", (s) => s.homepage.userName, (s, v) => ({ homepage: { ...s.homepage, userName: v } }), "你的名字", "用于主页问候语显示"),
          text("homepage-project-archive", "项目归档文件夹", (s) => s.homepage.projectArchiveFolder, (s, v) => ({ homepage: { ...s.homepage, projectArchiveFolder: v } }), "99_归档", "项目归档时移动到此文件夹"),
        ],
      },
      {
        id: "homepage-inspiration-notes", title: "Inspiration Notes", titleZh: "灵感速记",
        settings: [
          text("homepage-inspiration-folder", "绑定文件夹", (s) => s.homepage.inspirationNotesFolder, (s, v) => ({ homepage: { ...s.homepage, inspirationNotesFolder: v.trim() } }), "例如：00_灵感速记", "文件夹内的 Markdown 文件会自动作为灵感速记，可在主页左右切换"),
        ],
      },
      {
        id: "homepage-project-categories", title: "Project Categories", titleZh: "项目分类",
        projectCategories: true,
      },
      {
        id: "homepage-project-subfolders", title: "Project Subfolders", titleZh: "项目子文件夹",
        projectSubfolders: true,
      },
      {
        id: "homepage-modules", title: "Modules", titleZh: "模块开关",
        settings: [
          toggle("homepage-weather", "天气模块", (s) => s.homepage.weatherEnabled, (s, v) => ({ homepage: { ...s.homepage, weatherEnabled: v } }), "在主页显示天气信息"),
          { ...text("homepage-weather-location", "天气位置", (s) => s.homepage.weatherLocation, (s, v) => ({ homepage: { ...s.homepage, weatherLocation: v } }), "城市名或纬度,经度", "例如: Beijing 或 39.9,116.4"), visible: (s) => s.homepage.weatherEnabled },
          toggle("homepage-project-board", "项目看板", (s) => s.homepage.projectBoardEnabled, (s, v) => ({ homepage: { ...s.homepage, projectBoardEnabled: v } })),
          toggle("homepage-heatmap", "热力图", (s) => s.homepage.heatmapEnabled, (s, v) => ({ homepage: { ...s.homepage, heatmapEnabled: v } })),
          toggle("homepage-monthly-stats", "月度统计", (s) => s.homepage.monthlyStatsEnabled, (s, v) => ({ homepage: { ...s.homepage, monthlyStatsEnabled: v } })),
          toggle("homepage-bookmarks", "书摘", (s) => s.homepage.bookmarksEnabled, (s, v) => ({ homepage: { ...s.homepage, bookmarksEnabled: v } })),
          slider("homepage-recent-count", "最近笔记数量", (s) => s.homepage.recentNoteCount, (s, v) => ({ homepage: { ...s.homepage, recentNoteCount: v } }), 3, 12, 1, "主页显示的最近笔记卡片数量"),
        ],
      },
    ],
  },
];

const SECTION_BY_ID = new Map(
  SECTION_SOURCE.flatMap((tab) => tab.sections.map((section) => [section.id, section] as const)),
);

function sections(...ids: string[]): SectionDef[] {
  return ids.map((id) => SECTION_BY_ID.get(id)).filter((section): section is SectionDef => Boolean(section));
}

const MENU_CONFIG: TabDef[] = [
  { id: "zendian-about", name: "关于", icon: "info", sections: [], isAbout: true },
  { id: "workspace", name: "工作区", icon: "layout-dashboard", sections: sections("card-layout", "graph-view", "tabs", "auto-hide", "ui-details") },
  { id: "reading", name: "编辑与阅读", icon: "book-open-text", sections: sections("focus-mode", "hover-indicator", "page-paragraph", "text-details") },
  { id: "content", name: "标题与内容", icon: "type", sections: sections("heading-system", "code-blockquote", "callout-embed", "list-table", "images", "banner") },
  { id: "files", name: "文件与图标", icon: "folder-tree", sections: sections("file-tree-basic", "file-tree-cards", "icon-system-main", "sidebar") },
  { id: "homepage", name: "主页", icon: "house", sections: sections("homepage-basic", "homepage-inspiration-notes", "homepage-modules", "homepage-project-categories", "homepage-project-subfolders") },
  { id: "compat", name: "设备", icon: "monitor-smartphone", sections: sections("mobile-layout", "plugin-compat") },
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
  const inlineAdvanced = inlineGroup.createEl("details", { cls: "zendian-advanced" });
  inlineAdvanced.createEl("summary", { text: "高级设置" });
  new Setting(inlineAdvanced).setName("字体").setDesc("留空时继承主题字体").addText((input) => {
    const s = settingsManager.getSettings();
    input.setValue(s.headings.inlineTitle.font).setPlaceholder("inherit");
    input.onChange(async (v) => {
      const cur = settingsManager.getSettings();
      await settingsManager.updateMultiple({ headings: { ...cur.headings, inlineTitle: { ...cur.headings.inlineTitle, font: v } } });
    });
  });
  new Setting(inlineAdvanced).setName("文字转换").addDropdown((d) => {
    const s = settingsManager.getSettings();
    d.addOption("", "跟随主题").addOption("none", "保持原样").addOption("uppercase", "大写").addOption("lowercase", "小写");
    d.setValue(s.headings.inlineTitle.textTransform);
    d.onChange(async (v) => {
      const cur = settingsManager.getSettings();
      await settingsManager.updateMultiple({ headings: { ...cur.headings, inlineTitle: { ...cur.headings.inlineTitle, textTransform: v } } });
    });
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

    if (lv !== "h1") {
      new Setting(area).setName("前间距").addSlider((sl) => {
        sl.setLimits(0.25, 2.5, 0.05).setValue(h.spacingStart).setDynamicTooltip();
        sl.onChange(async (v) => {
          const cur = settingsManager.getSettings();
          await settingsManager.updateMultiple({ headings: { ...cur.headings, [lv]: { ...cur.headings[lv], spacingStart: v } } });
        });
      });
      new Setting(area).setName("后间距").addSlider((sl) => {
        sl.setLimits(0.25, 2.5, 0.05).setValue(h.spacingEnd).setDynamicTooltip();
        sl.onChange(async (v) => {
          const cur = settingsManager.getSettings();
          await settingsManager.updateMultiple({ headings: { ...cur.headings, [lv]: { ...cur.headings[lv], spacingEnd: v } } });
        });
      });
    }

    const advancedGroup = area.createEl("details", { cls: "zendian-advanced" });
    advancedGroup.createEl("summary", { text: "高级样式" });
    new Setting(advancedGroup).setName("显示分隔线").addToggle((t) => {
      t.setValue(Boolean(h.divider));
      t.onChange(async (v) => {
        const cur = settingsManager.getSettings();
        await settingsManager.updateMultiple({ headings: { ...cur.headings, [lv]: { ...cur.headings[lv], divider: v } } });
      });
    });
    new Setting(advancedGroup).setName("字体").setDesc("留空时继承主题字体").addText((input) => {
      input.setValue(h.font || "").setPlaceholder("inherit");
      input.onChange(async (v) => {
        const cur = settingsManager.getSettings();
        await settingsManager.updateMultiple({ headings: { ...cur.headings, [lv]: { ...cur.headings[lv], font: v } } });
      });
    });
    new Setting(advancedGroup).setName("字重").addDropdown((d) => {
      for (const option of WEIGHT_OPTIONS) d.addOption(option.value, option.label);
      d.setValue(String(h.weight));
      d.onChange(async (v) => {
        const cur = settingsManager.getSettings();
        await settingsManager.updateMultiple({ headings: { ...cur.headings, [lv]: { ...cur.headings[lv], weight: Number(v) } } });
      });
    });
    new Setting(advancedGroup).setName("文字转换").addDropdown((d) => {
      d.addOption("", "跟随主题").addOption("none", "保持原样").addOption("uppercase", "大写").addOption("lowercase", "小写");
      d.setValue(h.textTransform || "");
      d.onChange(async (v) => {
        const cur = settingsManager.getSettings();
        await settingsManager.updateMultiple({ headings: { ...cur.headings, [lv]: { ...cur.headings[lv], textTransform: v } } });
      });
    });
    new Setting(advancedGroup).setName("颜色").addDropdown((d) => {
      d.addOption("default", "跟随主题").addOption("accent", "强调色");
      d.setValue(h.colorScheme || "default");
      d.onChange(async (v) => {
        const cur = settingsManager.getSettings();
        await settingsManager.updateMultiple({ headings: { ...cur.headings, [lv]: { ...cur.headings[lv], colorScheme: v as "default" | "accent" } } });
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
  private zendianPlugin: ZENdianPlugin;
  private settingsManager: SettingsManager;
  private moduleManager: ModuleManager;
  private activeTabId = "zendian-about";
  private navItems = new Map<string, HTMLElement>();
  private contentEl: HTMLElement | null = null;

  constructor(app: App, plugin: ZENdianPlugin, settingsManager: SettingsManager, moduleManager: ModuleManager) {
    super(app, plugin);
    this.zendianPlugin = plugin;
    this.settingsManager = settingsManager;
    this.moduleManager = moduleManager;
  }

  display(): void {
    this.displayIn(this.containerEl);
  }

  displayIn(containerEl: HTMLElement, options: { showWindowButton?: boolean } = {}): void {
    containerEl.empty();
    this.navItems.clear();

    const wrapper = containerEl.createDiv("zendian-settings-wrapper");
    const toolbar = wrapper.createDiv("zendian-toolbar");
    const identity = toolbar.createDiv("zendian-toolbar-identity");
    identity.createEl("h2", { text: "ZENdian 设置" });
    identity.createEl("p", { text: "配置主页、项目工作流、任务系统与写作界面。" });
    const actions = toolbar.createDiv("zendian-toolbar-actions");
    const search = actions.createEl("input", { cls: "zendian-search", type: "search", placeholder: "搜索设置…" });
    search.setAttribute("aria-label", "搜索设置");
    search.addEventListener("input", () => this.renderSearch(search.value));
    if (options.showWindowButton !== false) {
      const openWindow = actions.createEl("button", {
        cls: "zendian-open-window",
        attr: { type: "button", "aria-label": "在新窗口打开 ZENdian 设置", title: "在新窗口打开" },
      });
      const openWindowIcon = getIcon("panel-top-open");
      if (openWindowIcon) openWindow.appendChild(openWindowIcon);
      openWindow.createSpan({ text: "新窗口" });
      openWindow.addEventListener("click", () => { void this.openSettingsPopout(); });
    }
    const resetAll = actions.createEl("button", { cls: "zendian-reset-all", text: "全部恢复默认" });
    resetAll.addEventListener("click", async () => {
      if (!await confirmAction(this.app, {
        title: "恢复全部设置",
        message: "确定恢复 ZENdian 的全部设置吗？当前自定义配置会被替换。",
        confirmText: "恢复默认",
      })) return;
      await this.settingsManager.updateMultiple(structuredClone(DEFAULT_SETTINGS));
      new Notice("ZENdian 设置已恢复默认");
      this.renderActiveTab();
    });

    const shell = wrapper.createDiv("zendian-settings-shell");

    const nav = shell.createEl("nav", { cls: "zendian-nav" });
    nav.setAttribute("aria-label", "设置分类");
    for (const tab of MENU_CONFIG) {
      const item = nav.createEl("button", { cls: "zendian-nav-item" });
      const icon = getIcon(tab.icon);
      if (icon) item.appendChild(icon);
      item.createEl("span", { text: tab.name });
      item.dataset.tabId = tab.id;
      if (tab.id === this.activeTabId) item.classList.add("active");
      item.setAttribute("aria-current", tab.id === this.activeTabId ? "page" : "false");
      item.addEventListener("click", () => this.switchTab(tab.id));
      this.navItems.set(tab.id, item);
    }

    this.contentEl = shell.createDiv("zendian-content");
    this.renderActiveTab();
  }

  private async openSettingsPopout(): Promise<void> {
    const popoutTab = new ZENdianSettingTab(
      this.app,
      this.zendianPlugin,
      this.settingsManager,
      this.moduleManager,
    );
    popoutTab.activeTabId = this.activeTabId;
    const opened = await openPopoutForm(this.app, {
      title: "ZENdian 设置",
      icon: "settings-2",
      size: { width: 1120, height: 820 },
      className: "zendian-settings-popout",
      render: (container) => {
        popoutTab.displayIn(container, { showWindowButton: false });
      },
    });
    if (!opened) new Notice("当前设备不支持独立设置窗口，已保留当前设置页");
  }

  private switchTab(tabId: string): void {
    if (tabId === this.activeTabId) return;
    this.activeTabId = tabId;
    for (const [id, item] of this.navItems) {
      item.classList.toggle("active", id === tabId);
      item.setAttribute("aria-current", id === tabId ? "page" : "false");
    }
    this.renderActiveTab();
  }

  private renderActiveTab(): void {
    if (!this.contentEl) return;
    this.contentEl.empty();
    const tab = MENU_CONFIG.find((item) => item.id === this.activeTabId) ?? MENU_CONFIG[0];
    if (tab.isAbout) this.renderAboutPage(this.contentEl);
    else this.renderTabContent(this.contentEl, tab);
  }

  private renderSearch(query: string): void {
    if (!this.contentEl) return;
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) {
      this.renderActiveTab();
      return;
    }
    this.contentEl.empty();
    this.contentEl.createEl("h2", { text: `搜索“${query.trim()}”`, cls: "zendian-page-title" });
    let matches = 0;
    for (const tab of MENU_CONFIG.filter((item) => !item.isAbout)) {
      for (const section of tab.sections) {
        const defs = (section.settings ?? []).filter((def) =>
          [def.titleZh, def.descZh, def.id, ...(def.keywords ?? [])].filter(Boolean).join(" ").toLocaleLowerCase().includes(normalized),
        );
        const customMatch = !section.settings && section.titleZh.toLocaleLowerCase().includes(normalized);
        if (defs.length || customMatch) {
          this.renderSection(this.contentEl, section, defs.length ? defs : undefined, tab.name);
          matches += defs.length || 1;
        }
      }
    }
    if (!matches) this.contentEl.createDiv("zendian-empty-state").setText("没有匹配的设置，请尝试功能名称或更短的关键词。");
  }

  private renderAboutPage(containerEl: HTMLElement): void {
    const about = containerEl.createDiv("zendian-about");

    // ── Hero Section ──
    const hero = about.createDiv("zendian-about-hero");
    hero.createDiv("zendian-about-glow");
    const iconWrap = hero.createDiv("zendian-about-icon");
    iconWrap.innerHTML = ABOUT_SVG_LOGO;
    hero.createEl("h1", { text: "ZENdian", cls: "zendian-about-title" });
    const version = this.zendianPlugin.manifest.version ?? "unknown";
    const displayVersion = version === "unknown" ? version : `V${version.toUpperCase()}`;
    hero.createEl("span", { text: displayVersion, cls: "zendian-about-version" });
    hero.createEl("p", { text: "Designed by Junkey", cls: "zendian-about-author" });

    // ── Description Card ──
    const card = about.createDiv("zendian-about-card");
    card.createEl("p", {
      text: "面向个人知识工作与项目推进的 Obsidian 功能插件。以智能主页连接任务、项目、时间轴、快照和数据洞察，并提供统一的写作与界面体验。",
    });

    // ── Feature Grid ──
    const features = about.createDiv("zendian-about-features");
    features.createEl("h3", { text: "核心能力" });
    const grid = features.createDiv("zendian-about-grid");
    for (const feat of FEATURES) {
      const featureCard = grid.createDiv("zendian-about-feature-card");
      const iconEl = featureCard.createDiv("zendian-about-feat-icon");
      iconEl.innerHTML = feat.icon;
      featureCard.createEl("div", { text: feat.title, cls: "zendian-about-feat-title" });
      featureCard.createEl("div", { text: feat.desc, cls: "zendian-about-feat-desc" });
    }

    // ── Donation ──
    const support = about.createDiv("zendian-about-support");
    const supportHeading = support.createDiv("zendian-about-support-heading");
    supportHeading.createEl("h3", { text: "支持项目" });
    supportHeading.createEl("p", {
      text: "如果 ZENdian 对你有所帮助，可以自愿赞赏，支持后续维护与改进。",
    });
    const supportActions = support.createDiv("zendian-about-support-actions");
    const channels: Array<{ id: DonationChannel; name: string; desc: string }> = [
      { id: "wechat", name: "微信赞赏", desc: "使用微信扫码" },
      { id: "alipay", name: "支付宝赞赏", desc: "使用支付宝扫码" },
    ];
    for (const channel of channels) {
      const button = supportActions.createEl("button", {
        cls: `zendian-donation-button is-${channel.id}`,
        attr: { type: "button", "aria-label": `打开${channel.name}二维码` },
      });
      button.createSpan({ cls: "zendian-donation-channel", text: channel.name });
      button.createSpan({ cls: "zendian-donation-desc", text: channel.desc });
      button.addEventListener("click", () => new DonationModal(this.app, channel.id).open());
    }
    support.createEl("p", {
      cls: "zendian-about-support-note",
      text: "赞赏完全自愿，不影响任何功能、更新或技术支持。",
    });

    // ── Footer ──
    about.createDiv("zendian-about-footer").createEl("span", {
      text: "A personal workspace for notes, tasks and projects",
    });
  }

  private renderTabContent(containerEl: HTMLElement, tab: TabDef): void {
    containerEl.createEl("h2", { text: tab.name, cls: "zendian-page-title" });
    for (const section of tab.sections) {
      if (tab.id === "homepage" && section.id !== "homepage-basic" && !this.settingsManager.getSettings().homepage.enabled) continue;
      this.renderSection(containerEl, section);
    }
  }

  private renderSection(containerEl: HTMLElement, section: SectionDef, defs = section.settings, context?: string): void {
    const card = containerEl.createDiv("zendian-section-card");
    const heading = card.createDiv("zendian-section-heading");
    const titleWrap = heading.createDiv();
    titleWrap.createEl("h3", { text: section.titleZh });
    if (context) titleWrap.createEl("span", { text: context, cls: "zendian-section-context" });
    if (defs?.length && !section.hideGroupReset) {
      const reset = heading.createEl("button", { cls: "zendian-card-reset", text: "恢复本组" });
      reset.addEventListener("click", async () => {
        for (const def of defs) {
          const current = this.settingsManager.getSettings();
          await this.settingsManager.updateMultiple(def.set(current, def.get(DEFAULT_SETTINGS) as never));
        }
        new Notice(`${section.titleZh}已恢复默认`);
        this.renderActiveTab();
      });
    }
    const sectionContent = card.createDiv("zendian-section-content");
    if (section.headingTabs) renderHeadingTabs(sectionContent, this.settingsManager);
    else if (section.iconSystem) this.renderIconSystem(sectionContent);
    else if (section.projectCategories) this.renderProjectCategories(sectionContent);
    else if (section.projectSubfolders) this.renderProjectSubfolders(sectionContent);
    else if (section.comingSoon) sectionContent.createDiv("zendian-coming-soon").setText("敬请期待");
    else {
      const settings = this.settingsManager.getSettings();
      const visibleDefs = (defs ?? []).filter((def) => !def.visible || def.visible(settings));
      for (const def of visibleDefs.filter((item) => !item.advanced)) this.renderSetting(sectionContent, def);
      const advancedDefs = visibleDefs.filter((item) => item.advanced);
      if (advancedDefs.length) {
        const disclosure = sectionContent.createEl("details", { cls: "zendian-advanced" });
        disclosure.createEl("summary", { text: `高级设置 · ${advancedDefs.length}` });
        for (const def of advancedDefs) this.renderSetting(disclosure, def);
      }
    }
  }

  private renderProjectCategories(containerEl: HTMLElement): void {
    const section = containerEl.createDiv("zendian-project-categories");
    section.createEl("p", {
      cls: "zendian-project-category-help",
      text: "可为每个分类选择图标；保存后会同步更新“编号_名称”文件夹。删除分类仅移除设置，已有文件夹和项目会保留。",
    });

    const list = section.createDiv("zendian-project-category-list");

    const setIconButton = (button: HTMLButtonElement, iconId: string): void => {
      button.empty();
      const icon = iconId.startsWith("lucide-") ? getIcon(iconId.slice("lucide-".length)) : null;
      if (icon) button.appendChild(icon);
      else button.createSpan({ text: iconId || "选择图标" });
      button.title = iconId || "选择图标";
    };

    const openIconPicker = (currentIcon: string, onSelect: (iconId: string) => void): void => {
      const settings = this.settingsManager.getSettings();
      const libraries = ["Lucide", ...settings.iconSystem.installedLibraries];
      new IconPickerModal(this.app, libraries, (iconId) => {
        if (iconId !== null) onSelect(iconId || currentIcon);
      }).open();
    };

    const validateCategory = (
      number: string,
      name: string,
      categories: Array<{ number: string; name: string }>,
      ignoreIndex = -1,
    ): { message: string; field: "number" | "name" } | null => {
      if (!/^\d+$/.test(number)) return { message: "标签编号只能包含数字", field: "number" };
      if (!name || /[\\/:*?"<>|]/.test(name) || name === "." || name === "..") {
        return { message: "请输入有效的标签名字，不能包含 \\ / : * ? \" < > |", field: "name" };
      }
      if (categories.some((category, index) => index !== ignoreIndex && category.number === number)) {
        return { message: `标签编号 ${number} 已存在`, field: "number" };
      }
      if (categories.some((category, index) => index !== ignoreIndex && category.name === name)) {
        return { message: `标签名字“${name}”已存在`, field: "name" };
      }
      return null;
    };

    const renderList = () => {
      list.empty();
      const categories = this.settingsManager.getSettings().homepage.projectCategories;

      if (categories.length === 0) {
        list.createDiv({ cls: "zendian-project-category-empty", text: "暂无项目分类，请在下方添加。" });
      }

      for (let i = 0; i < categories.length; i++) {
        const category = categories[i];
        const row = list.createDiv("zendian-project-category-row");
        let selectedIcon = category.icon
          || this.settingsManager.getSettings().iconSystem.customIcons[getProjectCategoryFolder(category)]
          || "lucide-folder";
        const iconButton = row.createEl("button", {
          cls: "zendian-project-subfolder-icon",
          attr: { type: "button", "aria-label": `修改 ${category.name} 的分类文件夹图标` },
        });
        setIconButton(iconButton, selectedIcon);
        const editNumber = row.createEl("input", {
          cls: "zendian-project-category-number-input",
          type: "text",
          value: category.number,
          attr: { inputmode: "numeric", "aria-label": `${category.name} 的分类编号` },
        });
        const editName = row.createEl("input", {
          cls: "zendian-project-category-name-input",
          type: "text",
          value: category.name,
          attr: { "aria-label": `${category.name} 的分类名称` },
        });
        const folderPreview = row.createSpan({
          cls: "zendian-project-category-folder",
          text: getProjectCategoryFolder(category),
        });

        const actions = row.createDiv("zendian-project-category-actions");
        const saveButton = actions.createEl("button", {
          cls: "zendian-project-category-save",
          text: "保存",
          attr: { "aria-label": `保存项目分类 ${category.name}`, disabled: "true" },
        });

        const deleteButton = actions.createEl("button", {
          cls: "zendian-project-category-delete",
          text: "×",
          attr: { "aria-label": `删除项目分类 ${category.name}` },
        });
        deleteButton.addEventListener("click", async () => {
          if (!await confirmAction(this.app, {
            title: "删除项目分类",
            message: `删除项目分类“${category.name}”？已有文件夹和项目会保留。`,
            confirmText: "删除分类",
          })) return;
          const current = this.settingsManager.getSettings();
          const projectCategories = current.homepage.projectCategories.filter((_, index) => index !== i);
          const projectSubfolders = { ...current.homepage.projectSubfolders };
          const projectDeliverableFolders = { ...current.homepage.projectDeliverableFolders };
          delete projectSubfolders[category.number];
          delete projectDeliverableFolders[category.number];
          await this.settingsManager.update("homepage", { projectCategories, projectSubfolders, projectDeliverableFolders });
          new Notice(`已删除分类“${category.name}”，文件夹 ${getProjectCategoryFolder(category)} 已保留`);
          this.display();
        });

        const updateEditState = () => {
          const number = editNumber.value.trim();
          const name = editName.value.trim();
          folderPreview.textContent = `${number || "编号"}_${name || "标签名字"}`;
          saveButton.disabled = number === category.number
            && name === category.name
            && selectedIcon === (category.icon || "lucide-folder");
        };
        iconButton.addEventListener("click", () => {
          openIconPicker(selectedIcon, (iconId) => {
            selectedIcon = iconId;
            setIconButton(iconButton, selectedIcon);
            updateEditState();
          });
        });
        editNumber.addEventListener("input", updateEditState);
        editName.addEventListener("input", updateEditState);

        const saveCategory = async () => {
          if (saveButton.disabled) return;
          const number = editNumber.value.trim();
          const name = editName.value.trim();
          const current = this.settingsManager.getSettings();
          const validation = validateCategory(number, name, current.homepage.projectCategories, i);
          if (validation) {
            new Notice(validation.message);
            (validation.field === "number" ? editNumber : editName).focus();
            return;
          }

          const updatedCategory = { number, name, icon: selectedIcon };
          const oldFolderPath = getProjectCategoryFolder(category);
          const newFolderPath = getProjectCategoryFolder(updatedCategory);
          const oldFolder = this.app.vault.getAbstractFileByPath(oldFolderPath);
          const target = this.app.vault.getAbstractFileByPath(newFolderPath);
          let renamed = false;

          if (oldFolderPath !== newFolderPath) {
            if (oldFolder && !(oldFolder instanceof TFolder)) {
              new Notice(`无法修改分类：${oldFolderPath} 不是文件夹`);
              return;
            }
            if (oldFolder && target) {
              new Notice(`无法重命名：目标 ${newFolderPath} 已存在`);
              return;
            }
            if (!oldFolder && target && !(target instanceof TFolder)) {
              new Notice(`无法修改分类：仓库根目录已有同名文件 ${newFolderPath}`);
              return;
            }
          }

          saveButton.disabled = true;
          try {
            if (oldFolderPath !== newFolderPath && oldFolder instanceof TFolder) {
              await this.app.vault.rename(oldFolder, newFolderPath);
              renamed = true;
            } else if (oldFolderPath !== newFolderPath && !target) {
              await this.app.vault.createFolder(newFolderPath);
            }

            const projectCategories = [...current.homepage.projectCategories];
            projectCategories[i] = updatedCategory;
            const projectSubfolders = { ...current.homepage.projectSubfolders };
            const projectDeliverableFolders = { ...current.homepage.projectDeliverableFolders };
            if (category.number !== number) {
              projectSubfolders[number] = projectSubfolders[category.number] ?? [];
              delete projectSubfolders[category.number];
              if (projectDeliverableFolders[category.number]) {
                projectDeliverableFolders[number] = projectDeliverableFolders[category.number];
                delete projectDeliverableFolders[category.number];
              }
            }

            const customIcons = Object.fromEntries(
              Object.entries(current.iconSystem.customIcons).map(([path, iconId]) => {
                if (path === oldFolderPath || path.startsWith(`${oldFolderPath}/`)) {
                  return [`${newFolderPath}${path.slice(oldFolderPath.length)}`, iconId];
                }
                return [path, iconId];
              })
            );
            customIcons[newFolderPath] = selectedIcon;

            await this.settingsManager.updateMultiple({
              homepage: { ...current.homepage, projectCategories, projectSubfolders, projectDeliverableFolders },
              iconSystem: { ...current.iconSystem, customIcons },
            });

            const categoryFolder = this.app.vault.getAbstractFileByPath(newFolderPath);
            const metadataUpdates = categoryFolder instanceof TFolder
              ? categoryFolder.children
                .filter((child): child is TFolder => child instanceof TFolder && !child.name.startsWith("99"))
                .map(async (projectFolder) => {
                  const metadata = await this.zendianPlugin.projectMetadataService.getMetadata(projectFolder.path);
                  if (metadata && metadata.type !== name) {
                    await this.zendianPlugin.projectMetadataService.updateType(projectFolder.path, name);
                  }
                })
              : [];
            const metadataResults = await Promise.allSettled(metadataUpdates);
            const failedMetadataUpdates = metadataResults.filter((result) => result.status === "rejected").length;

            if (failedMetadataUpdates > 0) {
              console.warn(`[ZENdian] ${failedMetadataUpdates} 个项目的分类元数据同步失败`);
              new Notice(`分类已更新，但有 ${failedMetadataUpdates} 个项目的 .home 类型同步失败`);
            } else {
              new Notice(`已更新分类并同步文件夹为 ${newFolderPath}`);
            }
            this.display();
          } catch (error) {
            if (renamed && oldFolder instanceof TFolder) {
              try {
                await this.app.vault.rename(oldFolder, oldFolderPath);
              } catch (rollbackError) {
                console.error("[ZENdian] 回滚分类文件夹失败:", rollbackError);
              }
            }
            console.error("[ZENdian] 更新项目分类失败:", error);
            new Notice(`更新项目分类失败：${newFolderPath}`);
            saveButton.disabled = false;
          }
        };

        saveButton.addEventListener("click", saveCategory);
        for (const input of [editNumber, editName]) {
          input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") saveCategory();
          });
        }
      }
    };

    const addRow = section.createDiv("zendian-project-category-add-row");
    let newIcon = "lucide-folder";
    const iconButton = addRow.createEl("button", {
      cls: "zendian-project-subfolder-icon",
      attr: { type: "button", "aria-label": "选择新项目分类文件夹图标" },
    });
    setIconButton(iconButton, newIcon);
    const numberInput = addRow.createEl("input", {
      cls: "zendian-project-category-number-input",
      type: "text",
      placeholder: "编号，如 10",
      attr: { inputmode: "numeric", "aria-label": "项目分类编号" },
    });
    const nameInput = addRow.createEl("input", {
      cls: "zendian-project-category-name-input",
      type: "text",
      placeholder: "标签名字，如 课程",
      attr: { "aria-label": "项目分类名称" },
    });
    const folderPreview = addRow.createSpan({
      cls: "zendian-project-category-preview",
      text: "编号_标签名字",
    });
    const addButton = addRow.createEl("button", {
      cls: "zendian-project-category-add",
      text: "+",
      attr: { "aria-label": "新增项目分类" },
    });

    iconButton.addEventListener("click", () => {
      openIconPicker(newIcon, (iconId) => {
        newIcon = iconId;
        setIconButton(iconButton, newIcon);
      });
    });

    const updatePreview = () => {
      const number = numberInput.value.trim();
      const name = nameInput.value.trim();
      folderPreview.textContent = number || name ? `${number || "编号"}_${name || "标签名字"}` : "编号_标签名字";
    };
    numberInput.addEventListener("input", updatePreview);
    nameInput.addEventListener("input", updatePreview);

    const addCategory = async () => {
      const number = numberInput.value.trim();
      const name = nameInput.value.trim();
      const current = this.settingsManager.getSettings();
      const categories = current.homepage.projectCategories;
      const validation = validateCategory(number, name, categories);
      if (validation) {
        new Notice(validation.message);
        (validation.field === "number" ? numberInput : nameInput).focus();
        return;
      }

      const category = { number, name, icon: newIcon };
      const folderPath = getProjectCategoryFolder(category);
      const existing = this.app.vault.getAbstractFileByPath(folderPath);
      if (existing && !(existing instanceof TFolder)) {
        new Notice(`无法创建分类：仓库根目录已有同名文件 ${folderPath}`);
        return;
      }

      try {
        if (!existing) await this.app.vault.createFolder(folderPath);
        await this.settingsManager.updateMultiple({
          homepage: { ...current.homepage, projectCategories: [...categories, category] },
          iconSystem: {
            ...current.iconSystem,
            customIcons: { ...current.iconSystem.customIcons, [folderPath]: newIcon },
          },
        });
        numberInput.value = "";
        nameInput.value = "";
        newIcon = "lucide-folder";
        setIconButton(iconButton, newIcon);
        updatePreview();
        renderList();
        new Notice(existing ? `已添加分类并关联文件夹 ${folderPath}` : `已添加分类并创建文件夹 ${folderPath}`);
        this.display();
      } catch (error) {
        console.error("[ZENdian] 创建项目分类失败:", error);
        new Notice(`创建项目分类失败：${folderPath}`);
      }
    };

    addButton.addEventListener("click", addCategory);
    for (const input of [numberInput, nameInput]) {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") addCategory();
      });
    }

    renderList();
  }

  private renderProjectSubfolders(containerEl: HTMLElement): void {
    const section = containerEl.createDiv("zendian-project-subfolders");
    section.createEl("p", {
      cls: "zendian-project-category-help",
      text: "按项目分类分别设置子文件夹。模板仅用于以后新建的项目；修改或删除不会改动已有项目。",
    });
    const categories = this.settingsManager.getSettings().homepage.projectCategories;
    if (!categories.length) {
      section.createDiv({ cls: "zendian-project-category-empty", text: "请先添加项目分类，再配置该分类的子文件夹。" });
      return;
    }
    let activeCategoryNumber = categories[0].number;
    const tabs = section.createDiv({ cls: "zendian-project-subfolder-tabs", attr: { role: "tablist" } });
    const list = section.createDiv("zendian-project-subfolder-list");

    const setIconButton = (button: HTMLButtonElement, iconId: string): void => {
      button.empty();
      const lucideName = iconId.startsWith("lucide-") ? iconId.slice(7) : iconId;
      const icon = getIcon(lucideName);
      if (icon) button.appendChild(icon);
      else button.createSpan({ text: iconId || "选择图标" });
      button.title = iconId || "选择图标";
    };

    const openIconPicker = (currentIcon: string, onSelect: (iconId: string) => void): void => {
      const settings = this.settingsManager.getSettings();
      const libraries = ["Lucide", ...settings.iconSystem.installedLibraries];
      new IconPickerModal(this.app, libraries, (iconId) => {
        if (iconId !== null) onSelect(iconId || currentIcon);
      }).open();
    };

    const renderList = (): void => {
      list.empty();
      const homepage = this.settingsManager.getSettings().homepage;
      const templates = homepage.projectSubfolders[activeCategoryNumber] ?? [];
      const releaseSetting = list.createDiv("zendian-project-deliverable-folder");
      const releaseCopy = releaseSetting.createDiv("zendian-project-deliverable-folder-copy");
      releaseCopy.createDiv({ cls: "zendian-project-deliverable-folder-title", text: "交付物文件夹" });
      releaseCopy.createDiv({
        cls: "zendian-project-deliverable-folder-description",
        text: "发布 ZIP 将保存在该项目子文件夹中，并从普通文件扫描中排除。",
      });
      const releaseSelect = releaseSetting.createEl("select", {
        cls: "dropdown zendian-project-deliverable-folder-select",
        attr: { "aria-label": "选择交付物文件夹" },
      });
      releaseSelect.createEl("option", { text: "未设置", value: "" });
      for (const template of templates) {
        const value = getProjectSubfolderName(template);
        releaseSelect.createEl("option", { text: value, value });
      }
      releaseSelect.value = homepage.projectDeliverableFolders[activeCategoryNumber] ?? "";
      releaseSelect.addEventListener("change", async () => {
        const current = this.settingsManager.getSettings();
        const projectDeliverableFolders = { ...current.homepage.projectDeliverableFolders };
        if (releaseSelect.value) projectDeliverableFolders[activeCategoryNumber] = releaseSelect.value;
        else delete projectDeliverableFolders[activeCategoryNumber];
        await this.settingsManager.update("homepage", { projectDeliverableFolders });
        new Notice(releaseSelect.value ? `交付物将发布到 ${releaseSelect.value}` : "已取消交付物文件夹配置");
      });
      if (!templates.length) {
        list.createDiv({
          cls: "zendian-project-category-empty",
          text: "暂未设置子文件夹，新建项目时不会创建任何子文件夹。",
        });
      }

      templates.forEach((template, index) => {
        const row = list.createDiv("zendian-project-subfolder-row");
        let selectedIcon = template.icon || "lucide-folder";
        const iconButton = row.createEl("button", {
          cls: "zendian-project-subfolder-icon",
          attr: { type: "button", "aria-label": `修改 ${template.name} 的文件夹图标` },
        });
        setIconButton(iconButton, selectedIcon);
        const numberInput = row.createEl("input", {
          cls: "zendian-project-category-number-input",
          type: "text",
          value: template.number,
          attr: { inputmode: "numeric", "aria-label": `${template.name} 的文件夹编号` },
        });
        const nameInput = row.createEl("input", {
          cls: "zendian-project-category-name-input",
          type: "text",
          value: template.name,
          attr: { "aria-label": `${template.name} 的文件夹名称` },
        });
        const preview = row.createSpan({
          cls: "zendian-project-category-folder",
          text: getProjectSubfolderName(template),
        });
        const actions = row.createDiv("zendian-project-category-actions");
        const saveButton = actions.createEl("button", {
          cls: "zendian-project-category-save",
          text: "保存",
          attr: { type: "button", disabled: "true", "aria-label": `保存子文件夹模板 ${template.name}` },
        });
        const deleteButton = actions.createEl("button", {
          cls: "zendian-project-category-delete",
          text: "×",
          attr: { type: "button", "aria-label": `删除子文件夹模板 ${template.name}` },
        });

        const updateState = (): void => {
          const number = numberInput.value.trim();
          const name = nameInput.value.trim();
          preview.textContent = `${number || "编号"}_${name || "名称"}`;
          saveButton.disabled = number === template.number && name === template.name && selectedIcon === template.icon;
        };
        numberInput.addEventListener("input", updateState);
        nameInput.addEventListener("input", updateState);
        iconButton.addEventListener("click", () => {
          openIconPicker(selectedIcon, (iconId) => {
            selectedIcon = iconId;
            setIconButton(iconButton, selectedIcon);
            updateState();
          });
        });

        const saveTemplate = async (): Promise<void> => {
          if (saveButton.disabled) return;
          const number = numberInput.value.trim();
          const name = nameInput.value.trim();
          const current = this.settingsManager.getSettings();
          const templates = current.homepage.projectSubfolders[activeCategoryNumber] ?? [];
          const validation = validateProjectSubfolderTemplate(number, name, templates, index);
          if (validation) {
            new Notice(validation.message);
            (validation.field === "number" ? numberInput : nameInput).focus();
            return;
          }
          const projectSubfolders = { ...current.homepage.projectSubfolders };
          const updatedTemplates = [...templates];
          const previousFolderName = getProjectSubfolderName(updatedTemplates[index]);
          updatedTemplates[index] = { number, name, icon: selectedIcon };
          projectSubfolders[activeCategoryNumber] = updatedTemplates;
          const projectDeliverableFolders = { ...current.homepage.projectDeliverableFolders };
          if (projectDeliverableFolders[activeCategoryNumber] === previousFolderName) {
            projectDeliverableFolders[activeCategoryNumber] = `${number}_${name}`;
          }
          await this.settingsManager.update("homepage", { projectSubfolders, projectDeliverableFolders });
          new Notice(`已更新子文件夹模板 ${number}_${name}，已有项目不会改变`);
          renderList();
        };
        saveButton.addEventListener("click", saveTemplate);
        for (const input of [numberInput, nameInput]) {
          input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") saveTemplate();
          });
        }
        deleteButton.addEventListener("click", async () => {
          if (!await confirmAction(this.app, {
            title: "删除子文件夹模板",
            message: `删除子文件夹模板“${template.name}”？已有项目不会改变。`,
            confirmText: "删除模板",
          })) return;
          const current = this.settingsManager.getSettings();
          const projectSubfolders = { ...current.homepage.projectSubfolders };
          const templates = projectSubfolders[activeCategoryNumber] ?? [];
          projectSubfolders[activeCategoryNumber] = templates.filter((_, itemIndex) => itemIndex !== index);
          const projectDeliverableFolders = { ...current.homepage.projectDeliverableFolders };
          if (projectDeliverableFolders[activeCategoryNumber] === getProjectSubfolderName(template)) {
            delete projectDeliverableFolders[activeCategoryNumber];
          }
          await this.settingsManager.update("homepage", { projectSubfolders, projectDeliverableFolders });
          new Notice(`已删除子文件夹模板“${template.name}”，已有项目文件夹不会被删除`);
          renderList();
        });
      });
    };

    const addRow = section.createDiv("zendian-project-subfolder-add-row");
    let newIcon = "lucide-folder";
    const iconButton = addRow.createEl("button", {
      cls: "zendian-project-subfolder-icon",
      attr: { type: "button", "aria-label": "选择新子文件夹图标" },
    });
    setIconButton(iconButton, newIcon);
    const numberInput = addRow.createEl("input", {
      cls: "zendian-project-category-number-input",
      type: "text",
      placeholder: "编号，如 10",
      attr: { inputmode: "numeric", "aria-label": "子文件夹编号" },
    });
    const nameInput = addRow.createEl("input", {
      cls: "zendian-project-category-name-input",
      type: "text",
      placeholder: "名称，如 笔记",
      attr: { "aria-label": "子文件夹名称" },
    });
    const preview = addRow.createSpan({ cls: "zendian-project-category-preview", text: "编号_名称" });
    const addButton = addRow.createEl("button", {
      cls: "zendian-project-category-add",
      text: "+",
      attr: { type: "button", "aria-label": "新增项目子文件夹模板" },
    });

    iconButton.addEventListener("click", () => {
      openIconPicker(newIcon, (iconId) => {
        newIcon = iconId;
        setIconButton(iconButton, newIcon);
      });
    });
    const updatePreview = (): void => {
      const number = numberInput.value.trim();
      const name = nameInput.value.trim();
      preview.textContent = number || name ? `${number || "编号"}_${name || "名称"}` : "编号_名称";
    };
    numberInput.addEventListener("input", updatePreview);
    nameInput.addEventListener("input", updatePreview);

    const addTemplate = async (): Promise<void> => {
      const number = numberInput.value.trim();
      const name = nameInput.value.trim();
      const current = this.settingsManager.getSettings();
      const templates = current.homepage.projectSubfolders[activeCategoryNumber] ?? [];
      const validation = validateProjectSubfolderTemplate(number, name, templates);
      if (validation) {
        new Notice(validation.message);
        (validation.field === "number" ? numberInput : nameInput).focus();
        return;
      }
      await this.settingsManager.update("homepage", {
        projectSubfolders: {
          ...current.homepage.projectSubfolders,
          [activeCategoryNumber]: [...templates, { number, name, icon: newIcon }],
        },
      });
      numberInput.value = "";
      nameInput.value = "";
      newIcon = "lucide-folder";
      setIconButton(iconButton, newIcon);
      updatePreview();
      renderList();
      new Notice(`已添加子文件夹模板 ${number}_${name}`);
    };
    addButton.addEventListener("click", addTemplate);
    for (const input of [numberInput, nameInput]) {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") addTemplate();
      });
    }
    const renderTabs = (): void => {
      tabs.empty();
      const currentCategories = this.settingsManager.getSettings().homepage.projectCategories;
      if (!currentCategories.some((category) => category.number === activeCategoryNumber)) {
        activeCategoryNumber = currentCategories[0]?.number || "";
      }
      for (const category of currentCategories) {
        const button = tabs.createEl("button", {
          cls: `zendian-project-subfolder-tab${category.number === activeCategoryNumber ? " is-active" : ""}`,
          text: category.name,
          attr: {
            type: "button",
            role: "tab",
            "aria-selected": String(category.number === activeCategoryNumber),
          },
        });
        button.addEventListener("click", () => {
          activeCategoryNumber = category.number;
          numberInput.value = "";
          nameInput.value = "";
          newIcon = "lucide-folder";
          setIconButton(iconButton, newIcon);
          updatePreview();
          renderTabs();
          renderList();
        });
      }
    };
    renderTabs();
    renderList();
  }

  private renderSetting(containerEl: HTMLElement, def: SettingDef): void {
    const settings = this.settingsManager.getSettings();
    const applyDesc = (s: Setting) => { if (def.descZh) s.setDesc(def.descZh); return s; };
    const row = applyDesc(new Setting(containerEl).setName(def.titleZh));
    const update = async (value: boolean | string | number, refresh = false) => {
      const current = this.settingsManager.getSettings();
      await this.settingsManager.updateMultiple((def.set as (s: PluginSettings, value: never) => Partial<PluginSettings>)(current, value as never));
      if (refresh) this.renderActiveTab();
    };

    switch (def.type) {
      case "toggle":
        row.addToggle((toggle) => {
          toggle.setValue(def.get(settings));
          toggle.onChange(async (val) => update(val, true));
        });
        break;

      case "select":
        row.addDropdown((dropdown) => {
          for (const opt of def.options ?? []) dropdown.addOption(opt.value, opt.label);
          dropdown.setValue(def.get(settings));
          dropdown.onChange(async (val) => update(val, true));
        });
        break;

      case "number":
        row.addText((text) => {
          text.inputEl.type = "number";
          if (def.min !== undefined) text.inputEl.min = String(def.min);
          if (def.max !== undefined) text.inputEl.max = String(def.max);
          if (def.step !== undefined) text.inputEl.step = String(def.step);
          text.setValue(String(def.get(settings)));
          text.onChange(async (val) => { const n = parseFloat(val); if (!isNaN(n)) await update(n); });
        });
        break;

      case "text":
        row.addText((text) => {
          if (def.placeholder) text.setPlaceholder(def.placeholder);
          text.setValue(def.get(settings));
          text.onChange(async (val) => update(val));
        });
        break;

      case "color": {
        const current = def.get(settings);
        row.addColorPicker((picker) => {
          picker.setValue(current || "#808080");
          picker.onChange(async (val) => update(val));
        });
        row.addExtraButton((button) => button
          .setIcon("eraser")
          .setTooltip("跟随主题")
          .onClick(async () => update("", true)));
        break;
      }

      case "number-slider":
        let sliderControl: SliderComponent;
        let numberControl: TextComponent;
        const clampValue = (value: number): number => Math.max(def.min, Math.min(def.max, value));
        const syncControls = (value: number) => {
          sliderControl?.setValue(value);
          numberControl?.setValue(String(value));
        };
        row.addSlider((slider) => {
          sliderControl = slider;
          slider.setLimits(def.min ?? 0, def.max ?? 1, def.step ?? 0.01);
          slider.setValue(def.get(settings));
          slider.setDynamicTooltip();
          slider.onChange(async (val) => {
            const normalized = clampValue(val);
            syncControls(normalized);
            await update(normalized);
          });
        }).addText((text) => {
          numberControl = text;
          text.inputEl.type = "number";
          text.inputEl.classList.add("zendian-slider-value");
          text.inputEl.min = String(def.min);
          text.inputEl.max = String(def.max);
          text.inputEl.step = String(def.step);
          text.setValue(String(def.get(settings)));
          text.onChange(async (val) => {
            const parsed = Number.parseFloat(val);
            if (Number.isFinite(parsed)) {
              const normalized = clampValue(parsed);
              syncControls(normalized);
              await update(normalized);
            } else {
              syncControls(def.get(this.settingsManager.getSettings()));
            }
          });
        });
        break;

      case "button":
        row.addButton((control) => {
          control.setButtonText(def.buttonText);
          control.onClick(async () => update(true, true));
        });
        return;
    }

    row.addExtraButton((button) => button
      .setIcon("rotate-ccw")
      .setTooltip("恢复默认")
      .onClick(async () => {
        const current = this.settingsManager.getSettings();
        await this.settingsManager.updateMultiple((def.set as (s: PluginSettings, value: never) => Partial<PluginSettings>)(current, def.get(DEFAULT_SETTINGS) as never));
        this.renderActiveTab();
      }));
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
        } catch (error) {
          console.error("[ZENdian] 安装图标库失败", error);
          new Notice("图标库安装失败，请检查名称或网络状态");
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
          try {
            new RegExp(regexInput.value);
            regexInput.classList.remove("zendian-input-invalid");
          } catch {
            regexInput.classList.add("zendian-input-invalid");
            new Notice("图标规则不是有效的正则表达式");
            return;
          }
          if (colorInput.value && !CSS.supports("color", colorInput.value)) {
            colorInput.classList.add("zendian-input-invalid");
            new Notice("请输入有效的 CSS 颜色");
            return;
          }
          colorInput.classList.remove("zendian-input-invalid");
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
          if (!await confirmAction(this.app, {
            title: "删除图标规则",
            message: `删除图标规则“${rule.regex || "未命名规则"}”？`,
            confirmText: "删除规则",
          })) return;
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
