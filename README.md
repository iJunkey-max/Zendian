# 🚀 ZENdian

**ZENdian** 是一款致力于为 Obsidian 带来极致视觉享受与沉浸式输入体验的 UI 全面美化与增强插件。

本插件深度融合了 [**Border Theme**](https://github.com/Akifyss/obsidian-border "null") 的底层架构优势与 **Phycat Apple 设计语言** 的优雅配色。通过「核心 JS 框架 + 独立功能模块」的全新架构，不仅重塑了界面的视觉质感，还实现了诸多原生 CSS 无法完成的高级交互增强。

当前版本：`2.1.00F` | 最低 Obsidian 版本：`1.12.7`

## ✨ 核心特性

### 🍎 视觉重塑与毛玻璃美学

- **Apple 风格设计语言**：全局引入清透配色与排版叠加层，带来犹如原生 macOS 般的视觉体验。
    
- **卡片式布局**：圆角卡片提升视觉层次，配合背景网格纹理，带来真实的“书写纸”质感。
    
- **图片渲染优化**：自动应用 12px 圆角与微阴影，Hover 时平滑放大并提升亮度，图注（Figcaption）居中变色显示。
    

### 🧘 沉浸式写作：专注模式与打字机

- **景深毛玻璃专注模式**：非活动行自动降噪并施加 `blur(0.5px)` 局部模糊；当前活动行平滑放大，配合毛玻璃（Backdrop-filter）与柔和阴影，瞬间聚焦视线。
    
- **原生打字机滚动**：底层注入 CM6 ViewPlugin 实现平滑打字机模式，输入时光标始终完美固定在窗口 3/4 处，彻底告别频繁的视线跳动。
    
- **智能焦点指示器**：左侧悬浮指示线智能识别当前行，并支持显示代码块行号与列表嵌套层级。
    
- **智能自动隐藏**：Tab 栏、侧边栏、状态栏等 UI 元素按需隐藏，最大化阅读与写作空间。
    

### 🎨 Markdown 元素全面增强

- **多维标题系统 (H1-H6)**：高度自定义标题排版（对齐、字号、前后间距）。H2 支持「线条」与「方框/胶囊」风格无缝切换，暗色模式下自带绚丽径向渐变光晕。
    
- **沉浸式 Callout 标注**：全面重绘标注样式，Hover 时平滑浮起并伴有 Emoji 放大发光动效。
    
- **YAML Frontmatter 重塑**：完美适配 Obsidian 1.4+ 属性面板，替换为虚线边框、主色淡背景的精美卡片。
    
- **细节打磨**：重新定义行高、字间距、段落间距，深度优化脚注、表格、链接霓虹发光、及代码块的视觉表现。
    

### 🌈 灵动的文件树与侧边栏

- **动态彩虹文件夹**：采用全新的 JS + CSS 变量混合渲染方案，自底向上计算文件夹深度。遮罩浓度按指数衰减（`opacity * Math.pow(0.6, level)`），并由 MutationObserver 实时监听拖拽与折叠状态自动刷新。
    
- **Active 激活状态指示**：当前打开的文件在侧边栏拥有专属左侧边框、背景高亮与字重加粗。
    

### ⚙️ 优雅而强大的控制台

- **全新设置面板**：彻底告别冗长的下拉列表！采用顶部横排 Tab 导航布局，提供 7 大选项卡，支持鼠标滚轮和拖拽横向滑动浏览。
    
- **深度中文化**：超 40 个非基础设置项附带详尽中文说明，轻松掌控每一个开关。
    

## 📥 安装指南

### 方法一：普通用户安装（推荐）

1. 确保已在 Obsidian 中安装 [**Obsidian42 - BRAT**](https://github.com/TfTHacker/obsidian42-brat "null") 插件。
    
2. 启用 BRAT，在命令面板中输入 `BRAT: Add a beta plugin for testing`。
    
3. 粘贴本仓库的 GitHub 地址 `https://github.com/Junkey/zendian` 并添加。
    
4. 在社区插件列表中启用 **ZENdian**。
    

### 方法二：从源码构建（面向开发者）

```
git clone [https://github.com/Junkey/zendian.git](https://github.com/Junkey/zendian.git)
cd zendian
npm install
npm run build
```

编译完成后，将生成的产物复制到你的 Obsidian 仓库中：

```
# Windows
cp dist/main.js dist/styles.css manifest.json "C:\path\to\your\vault\.obsidian\plugins\zendian\"

# macOS / Linux
cp dist/main.js dist/styles.css manifest.json /path/to/your/vault/.obsidian/plugins/zendian/
```

然后在 Obsidian 中按 `Ctrl+R` 重新加载，并在「第三方插件」中启用。

|命令|说明|
|---|---|
|`npm run build`|构建 CSS + JS（生产模式）|
|`npm run build:css`|仅构建 CSS|
|`npm run build:js`|仅构建 JS|
|`npm run dev`|监听模式，文件变更时自动重建|

## 🏗️ 技术架构

本插件从 V2.0 版本开始，全面重构为 **「核心框架 + 功能模块」** 架构，将传统的纯 CSS 主题转变为动态可控的工程化系统。

### 项目结构

```
zendian/
├── src/
│   ├── main.ts                 # 插件入口
│   ├── core/
│   │   ├── event-bus.ts        # 事件总线 (EventBus)
│   │   ├── settings-manager.ts # 结构化设置管理
│   │   └── module-manager.ts   # 模块生命周期管理
│   ├── modules/                # 22 个独立功能模块 (如专注模式, 彩虹文件夹等)
│   └── ui/
│       └── settings-tab.ts     # 顶部横排 Tab 式设置面板 UI
├── css/
│   ├── base/
│   │   └── border-theme.css    # 核心主题：HSL 强调色、工作区布局、卡片
│   ├── overlays/
│   │   └── phycat-overlay.css  # Apple 风格覆盖层
│   ├── settings-blocks/
│   │   ├── border-settings.css # 旧版 @settings 定义
│   │   └── phycat-settings.css # Phycat 专属设置
│   └── ui/
│       └── style-settings-ui.css # 设置面板样式
├── scripts/
│   └── build-css.mjs           # CSS 合并与压缩脚本
├── dist/                       # 构建产物
├── manifest.json
└── package.json
```

### 运行时流程

1. **核心初始化**：插件加载，初始化 `EventBus` 和 `SettingsManager`。`SettingsManager` 会自动解析 `styles.css` 中的 `@settings` 块。
    
2. **数据迁移与绑定**：将旧版扁平的 `groupId@@settingId` 数据无缝迁移为结构化的 PluginSettings 对象。
    
3. **环境监听**：监听系统主题与 Obsidian `css-change` 事件，自动读取原生强调色并重算 `--accent-h/s/l`。
    
4. **模块按需加载**：`ModuleManager` 初始化并加载所有功能模块，各模块独立管理自身的 DOM Class 注入、CSS 变量配置及 CM6 Extension 的挂载。
    

### 颜色系统

ZENdian 的全站颜色均派生自三个基础 HSL 根变量，确保在任何主题色下都能保持视觉和谐：

```
--accent-h  /* 色相，0-360 */
--accent-s  /* 饱和度，0-100% */
--accent-l  /* 亮度，0-100% */
```

派生变量示例：

- `--color-accent` — 原始强调色
    
- `--color-accent-1/2/3` — 偏移变体
    
- `--background-primary/secondary/tertiary` — 带有主色调的底层表面
    
- `--text-normal/muted/faint` — 带有主色调的文本颜色
    
- `--background-modifier-border` — 去饱和边框
    

### @settings 系统

为了与旧有的 Style Settings 生态兼容并支持无缝迁移，设置元数据依然以 YAML 风格定义在 CSS 注释中：

```
/* @settings
name: 我的设置组
id: my-group
settings:
    -
        id: my-toggle
        title: Enable Feature
        title.zh: 启用功能
        type: class-toggle
        default: true
*/
```

_支持类型：`class-toggle`、`class-select`、`variable-number`、`variable-number-slider`、`variable-text`、`heading`、`info-text` 等。_

## 🛠️ 开发指南

### 添加新设置

1. 在 `css/settings-blocks/border-settings.css` 添加定义：
    

```
-
    id: my-new-setting
    title: My New Setting
    title.zh: 我的新设置
    type: class-toggle
    default: true
```

2. 根据类型添加对应的 CSS 规则：
    

```
/* 对于 class-toggle */
body.my-new-setting .some-element {
    /* 你的样式 */
}

/* 对于 variable 类型 */
.some-element {
    property: var(--my-new-setting);
}
```

3. 运行 `npm run build`，在 Obsidian 中重新加载。
    

### 关键文件定位

- **卡片布局** — `css/base/border-theme.css`
    
    - 浅色模式：搜索 `card-layout-open-light`
        
    - 暗色模式：搜索 `card-layout-open-dark`
        
    - 阴影与圆角：`--card-shadow-light` / `--card-border-radius-light`
        
- **强调色派生** — `css/base/border-theme.css`
    
    - 浅色主题请查阅 `.theme-light` 块，暗色主题请查阅 `.theme-dark` 块。
        

### 调试设置数据

设置数据持久化存储在插件目录下的 `data.json` 中，键格式采用兼容旧版的 `{groupId}@@{settingId}`：

```
{
  "Components@@autohide": true,
  "Appearance-light@@card-layout-open-light": true,
  "Editor@@phycat-spacing@@line-height-customize": 2.2
}
```

## 🤝 鸣谢与许可

**许可证:** MIT License

本项目的架构与美学理念离不开社区优秀开源项目的启发与支持，特别感谢：

- [**obsidian-border**](https://github.com/Akifyss/obsidian-border "null") by Akifyss (基于此主题进行的深度二次开发)
    
- [**obsidian-style-settings**](https://github.com/mgmeyers/obsidian-style-settings "null") by mgmeyers (启发了本插件的设置变量解析机制)
    
- **Phycat** (Apple 风格配色与排版设计理念)
    

## 🐛 反馈与支持

如果在享受 ZENdian 的过程中遇到任何 Bug，或有新的功能建议，欢迎在 [Issues](../../issues "null") 区提交反馈！
