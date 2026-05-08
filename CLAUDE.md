# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导。

## 项目概述

ZENdian 是一个 Obsidian UI 美化插件，集成了 Border 主题、Phycat 苹果风格色彩叠加、增强 Markdown 渲染和 Style Settings。使用 TypeScript 编写，esbuild 构建。

## 常用命令

- `npm run build` — 完整生产构建（CSS + JS）
- `npm run build:js` — 仅构建 TypeScript（esbuild）
- `npm run build:css` — 仅构建 CSS（合并 css/ 目录文件到 dist/styles.css）
- `npm run dev` — 监听模式，带 sourcemaps

项目未配置测试套件或代码检查工具。

## 架构设计

**入口文件**：`src/main.ts` — 导出 `ZENdianPlugin extends Plugin`

**启动流程**：EventBus → SettingsManager.init() → ModuleManager.register(21 个模块) → loadAll() → 监听 css-change → 注册设置面板

### 核心服务 (`src/core/`)

- **EventBus** — 发布/订阅模式，两个事件：`SETTINGS_CHANGED`、`THEME_CHANGED`
- **SettingsManager** — 结构化设置持久化，防抖自动保存（200ms），支持从旧扁平键格式（`"groupId@@settingId"`）迁移
- **ModuleManager** — 模块注册、生命周期管理（`load`/`unload`/`loadAll`/`unloadAll`）、事件分发

### 模块系统 (`src/modules/`)

21 个功能模块，均实现 `IFeatureModule` 接口：
- `id` / `name` — 标识和显示名
- `load(ctx: ModuleContext)` — 初始化，应用设置到 DOM
- `unload()` — 清理 DOM 修改、定时器、观察者
- `onSettingsChanged?(changedKeys, settings)` — 响应设置变更
- `onThemeChange?(isDark)` — 响应主题切换

`ModuleContext` 提供：EventBus、设置获取器、CodeMirror 6 扩展注册器。

模块通过切换 `document.body` 上的 CSS 类名和注入/移除 CSS 自定义属性来工作，CSS 层消费这些类名和变量。

### 设置系统 (`src/types/settings.types.ts`)

`PluginSettings` 是结构化接口，包含 22 个模块级子接口（如 `AutoHideSettings`、`CardLayoutSettings`）。`DEFAULT_SETTINGS` 提供默认值。JS 设置面板（`src/ui/settings-tab.ts`）通过声明式 `MENU_CONFIG` 数组渲染 7 个标签页。

### CSS 构建 (`scripts/build-css.mjs`)

合并顺序：`border-settings.css` → `border-theme.css` → `phycat-overlay.css` → `style-settings-ui.css`。去重 `@settings` 块。输出：`dist/styles.css`。

CSS 使用 `@settings` 块（CSS 注释中的 YAML），供 Obsidian Style Settings 插件消费。

### 颜色系统

所有颜色源自三个 HSL CSS 变量：`--accent-h`、`--accent-s`、`--accent-l`。通过 `getComputedStyle()` 与 Obsidian 原生强调色同步。

## 关键开发经验

详细内容见 `.claude/experence.md`。

- **Obsidian DOM 结构不能靠猜**。写选择器前必须用 DevTools 或用户提供的 DOM 片段确认真实结构。
- **CSS 子代选择器（`>`）在 Obsidian 动态 DOM 中极脆弱**，因为存在多层 wrapper div。优先使用 JS 设置 per-element CSS 变量，CSS 负责消费。
- **读取主题变量**：用 `getComputedStyle(document.body)`，而非 `element.style`（后者只读内联样式）。
- **插件 `onload()` 执行时 DOM 可能未就绪**。用 `setInterval`（200ms，最多 50 次）轮询目标元素，找到后挂 MutationObserver。
- **JS 只负责设置 CSS 变量**，不要直接操作 `element.style.backgroundColor` 等。CSS 通过 `var()` 消费变量。
- **主题切换不会自动通知插件**。需监听 `app.workspace.on("css-change")`（未文档化事件）并广播给模块。
- **MutationObserver 回调需要防抖**，用 `requestAnimationFrame` 包裹，避免高频 DOM 变更导致性能问题。
- **线性透明度衰减在低值下失效**。使用指数衰减（`Math.pow(0.6, level)`）以确保层级间有可见差异。

## 添加新模块

1. 创建 `src/modules/<name>.module.ts`，实现 `IFeatureModule`
2. 在 `src/types/settings.types.ts` 中添加设置子接口，并在 `DEFAULT_SETTINGS` 中设置默认值
3. 在 `src/main.ts` 中导入并注册（`moduleManager.register(new NameModule())`）
4. 在 `css/` 目录下添加对应 CSS 文件
