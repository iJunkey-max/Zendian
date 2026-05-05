# ZENdian

Obsidian UI 美化插件 — 整合 Border 主题、Phycat Apple 风格覆盖层与 Style Settings，提供统一的设置面板和精致的视觉体验。

## 快速开始

### 安装到开发环境

```bash
git clone https://github.com/Junkey/zendian.git
cd zendian
npm install
npm run build
```

将构建产物复制到 Obsidian 仓库：

```bash
# Windows
cp dist/main.js dist/styles.css manifest.json "C:\path\to\vault\.obsidian\plugins\zendian\"

# macOS / Linux
cp dist/main.js dist/styles.css manifest.json /path/to/vault/.obsidian/plugins/zendian/
```

在 Obsidian 中按 Ctrl+R 重新加载，然后在 设置 > 第三方插件 中启用。

### 构建命令

| 命令 | 说明 |
|------|------|
| `npm run build` | 构建 CSS + JS（生产模式） |
| `npm run build:css` | 仅构建 CSS — 合并所有 CSS 文件到 `dist/styles.css` |
| `npm run build:js` | 仅构建 JS — 打包 TypeScript 到 `dist/main.js` |
| `npm run dev` | 监听模式 — 文件变更时自动重建 |

## 项目结构

```
zendian/
├── src/
│   ├── main.ts              # 插件入口 — 注册设置面板，初始化管理器
│   ├── css-processor.ts     # 解析 CSS 中的 @settings 块，将设置值应用到 DOM
│   └── settings-tab.ts      # 渲染设置面板 UI
├── css/
│   ├── base/
│   │   └── border-theme.css       # 核心主题：HSL 强调色系统、工作区布局、卡片布局
│   ├── overlays/
│   │   └── phycat-overlay.css     # Apple 风格覆盖层：标题、代码块、表格、callout
│   ├── settings-blocks/
│   │   ├── border-settings.css    # @settings 定义（组件、外观、编辑器等）
│   │   └── phycat-settings.css    # Phycat 专属 @settings（间距、标题尺寸）
│   └── ui/
│       └── style-settings-ui.css  # 设置面板样式（侧边栏导航、可折叠卡片）
├── scripts/
│   └── build-css.mjs              # CSS 合并脚本 — 拼接文件，去重 @settings
├── dist/
│   ├── main.js                    # 构建后的 JS
│   └── styles.css                 # 构建后的 CSS
├── manifest.json                  # Obsidian 插件清单
├── versions.json                  # Obsidian 版本兼容映射
├── package.json
└── esbuild.config.mjs             # JS 打包配置
```

## 工作原理

### CSS 构建流程

`scripts/build-css.mjs` 按固定顺序拼接 CSS 文件：

1. `border-settings.css` — @settings 定义（插件运行时解析）
2. `border-theme.css` — 核心主题变量和布局规则
3. `phycat-overlay.css` — Apple 风格视觉增强
4. `style-settings-ui.css` — 设置面板 UI

后加载的文件在级联中优先级更高。相同 `id` 的重复 `@settings` 块会自动去重。

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

支持的类型：`class-toggle`、`class-select`、`variable-number`、`variable-text`、`variable-color`、`variable-themed-color`、`heading`、`info-text`。

### 颜色系统

所有颜色派生自三个 HSL 根变量：

```
--accent-h（色相，0-360）
--accent-s（饱和度，0-100%）
--accent-l（亮度，0-100%）
```

插件运行时通过 `css-processor.ts` 从 Obsidian 的 `--interactive-accent` 读取计算后的颜色值，转换为 HSL 后设置到 `document.body`。

派生变量：
- `--color-accent` — 原始强调色
- `--color-accent-1/2/3` — 偏移变体（更亮、去饱和）
- `--background-primary/secondary/tertiary` — 带强调色色调的表面
- `--text-normal/muted/faint` — 带色相的灰色文字
- `--background-modifier-border` — 去饱和的强调色边框

### 运行时流程

1. 插件加载 → `css-processor.ts` 解析 `styles.css` 中的 `@settings` 块
2. `syncAccentColor()` 读取 Obsidian 的强调色，设置 `--accent-h/s/l`
3. `applyAllSettings()` 遍历所有设置，将保存的值（或默认值）以 CSS class 或内联 CSS 变量的形式应用到 `document.body`
4. `observeThemeChange()` 监听 `body` class 变化，主题切换时重新同步强调色和主题色
5. `settings-tab.ts` 渲染带侧边栏导航和可折叠分组的设置面板

## 常见开发任务

### 添加新设置

1. 在 `css/settings-blocks/border-settings.css` 的对应 `@settings` 块中添加设置定义：

```yaml
-
    id: my-new-setting
    title: My New Setting
    title.zh: 我的新设置
    type: class-toggle
    default: true
```

2. 如果是 `class-toggle`，在 CSS 中添加使用该 class 的规则：

```css
body.my-new-setting .some-element {
    /* 启用时的样式 */
}
```

3. 如果是 `variable-number/text/color`，在 CSS 中引用变量：

```css
.some-element {
    property: var(--my-new-setting);
}
```

4. 运行 `npm run build`，重新加载 Obsidian。

### 修改卡片布局

卡片布局 CSS 在 `css/base/border-theme.css`：
- 浅色模式：搜索 `card-layout-open-light`（约第 1079 行）
- 暗色模式：搜索 `card-layout-open-dark`（约第 1117 行）
- 卡片阴影：`--card-shadow-light` / `--card-shadow-dark`（约第 943 行）
- 卡片圆角：`--card-border-radius-light` / `--card-border-radius-dark`

### 调整强调色行为

HSL 派生公式在 `css/base/border-theme.css`：
- 浅色主题：`.theme-light` 块（约第 186 行）
- 暗色主题：`.theme-dark` 块（约第 307 行）
- 背景变体：`theme-dark-background-darker`、`theme-dark-background-brighter`、`theme-dark-background-pure-black`

### 调试设置数据

插件将设置存储在 Obsidian 的 `data.json` 中（位于插件目录下）。键格式：`{groupId}@@{settingId}`。示例：

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
