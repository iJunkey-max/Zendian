# ZENdian

Obsidian UI 美化插件。整合 Border 主题、Phycat Apple 风格配色与 Style Settings，提供统一设置面板和精致视觉体验。

当前版本：`2.0.18U` | 最低 Obsidian 版本：`1.12.7`

## 功能特性

**视觉增强**
- 卡片式布局 — 圆角卡片提升视觉层次
- HSL 强调色系统 — 所有颜色派生自三个根变量
- 焦点指示器 — 鼠标悬停行高亮，列表层级颜色区分

**专注与效率**
- 自动隐藏 — Tab 栏、侧边栏、状态栏等按需隐藏
- 专注模式 — 降低非当前行透明度，聚焦编辑

**排版系统**
- Phycat 排版 — 标题、段落、行高、字间距精细控制
- H1-H6 自定义 — 字体、字重、颜色、分隔线
- 代码块/引用块/标注/表格 — 全面样式定制

**兼容性**
- 第三方插件 — DB Folder、Projects、Surfing
- 移动端适配 — 平板卡片布局、手机端全屏抽屉

## 安装

### 从源码构建

```bash
git clone https://github.com/Junkey/zendian.git
cd zendian
npm install
npm run build
```

复制到 Obsidian 仓库：

```bash
# Windows
cp dist/main.js dist/styles.css manifest.json "C:\path\to\vault\.obsidian\plugins\zendian\"

# macOS / Linux
cp dist/main.js dist/styles.css manifest.json /path/to/vault/.obsidian/plugins/zendian/
```

在 Obsidian 中按 `Ctrl+R` 重新加载，然后在 设置 > 第三方插件 中启用。

### 构建命令

| 命令 | 说明 |
|------|------|
| `npm run build` | 构建 CSS + JS（生产模式） |
| `npm run build:css` | 仅构建 CSS |
| `npm run build:js` | 仅构建 JS |
| `npm run dev` | 监听模式，文件变更时自动重建 |

## 项目结构

```
zendian/
├── src/
│   ├── main.ts                 # 插件入口
│   ├── core/
│   │   ├── event-bus.ts        # 事件总线
│   │   ├── settings-manager.ts # 设置管理
│   │   └── module-manager.ts   # 模块管理
│   ├── modules/                # 功能模块（21个）
│   └── ui/
│       └── settings-tab.ts     # 设置面板 UI
├── css/
│   ├── base/
│   │   └── border-theme.css    # 核心主题：HSL 强调色、工作区布局、卡片
│   ├── overlays/
│   │   └── phycat-overlay.css  # Apple 风格覆盖层
│   ├── settings-blocks/
│   │   ├── border-settings.css # @settings 定义
│   │   └── phycat-settings.css # Phycat 专属设置
│   └── ui/
│       └── style-settings-ui.css # 设置面板样式
├── scripts/
│   └── build-css.mjs           # CSS 合并脚本
├── dist/                       # 构建产物
├── manifest.json
├── package.json
└── esbuild.config.mjs
```

## 技术架构

### 运行时流程

1. 插件加载 → `SettingsManager` 解析 `styles.css` 中的 `@settings` 块
2. `syncAccentColor()` 读取 Obsidian 强调色，设置 `--accent-h/s/l`
3. `applyAllSettings()` 应用所有设置（CSS class 或内联变量）
4. `observeThemeChange()` 监听主题切换，重新同步颜色
5. `ModuleManager` 初始化 21 个功能模块

### 颜色系统

所有颜色派生自三个 HSL 根变量：

```css
--accent-h  /* 色相，0-360 */
--accent-s  /* 饱和度，0-100% */
--accent-l  /* 亮度，0-100% */
```

派生变量：
- `--color-accent` — 原始强调色
- `--color-accent-1/2/3` — 偏移变体
- `--background-primary/secondary/tertiary` — 带色调的表面
- `--text-normal/muted/faint` — 带色相的文字
- `--background-modifier-border` — 去饱和边框

### @settings 系统

设置以 YAML 风格定义在 CSS 注释中：

```css
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

支持类型：`class-toggle`、`class-select`、`variable-number`、`variable-text`、`variable-color`、`variable-themed-color`、`heading`、`info-text`

### 设置面板

7 个选项卡：

| 选项卡 | 内容 |
|--------|------|
| ZENdian | 插件信息、版本、功能亮点 |
| 视图与工作区 | 卡片布局、侧边栏、标签页、动效 |
| 文件树 | 文件列表、彩虹文件夹 |
| 禅意与专注 | 自动隐藏、专注模式、焦点指示器 |
| 排版与阅读 | 段落间距、标题系统、文本细节 |
| 渲染元素 | 代码块、引用块、列表、表格、标注 |
| 移动端与适配 | 移动端设置、第三方插件兼容 |

## 开发指南

### 添加新设置

1. 在 `css/settings-blocks/border-settings.css` 添加定义：

```yaml
-
    id: my-new-setting
    title: My New Setting
    title.zh: 我的新设置
    type: class-toggle
    default: true
```

2. 根据类型添加 CSS 规则：

```css
/* class-toggle */
body.my-new-setting .some-element {
    /* 样式 */
}

/* variable 类型 */
.some-element {
    property: var(--my-new-setting);
}
```

3. 运行 `npm run build`，重新加载 Obsidian。

### 关键文件位置

**卡片布局** — `css/base/border-theme.css`
- 浅色模式：搜索 `card-layout-open-light`
- 暗色模式：搜索 `card-layout-open-dark`
- 阴影变量：`--card-shadow-light` / `--card-shadow-dark`
- 圆角变量：`--card-border-radius-light` / `--card-border-radius-dark`

**强调色派生** — `css/base/border-theme.css`
- 浅色主题：`.theme-light` 块
- 暗色主题：`.theme-dark` 块

### 调试设置数据

设置存储在 `data.json`（插件目录下），键格式：`{groupId}@@{settingId}`

```json
{
  "Components@@autohide": true,
  "Appearance-light@@card-layout-open-light": true,
  "Editor@@phycat-spacing@@line-height-customize": 2.2
}
```

## 依赖

- **运行时**：无（纯 CSS + 原生 TypeScript）
- **构建**：esbuild、TypeScript

## 许可证

MIT

衍生自：
- [obsidian-border](https://github.com/Akifyss/obsidian-border) by Akifyss (MIT)
- [obsidian-style-settings](https://github.com/mgmeyers/obsidian-style-settings) by mgmeyers (MIT)
- Phycat 主题 CSS
