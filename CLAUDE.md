# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导。详细架构与文件职责索引见 [docs/开发者指南.md](docs/开发者指南.md)（本文件的超集）；用户功能与安装说明见 [README.md](README.md)。

> **Obsidian API 不能靠猜。** 官方 API 仓库：https://github.com/obsidianmd/obsidian-api 。写任何 Obsidian DOM / API 相关代码前，先查文档，或用 DevTools / 真实 DOM 片段确认结构。

## 项目概述

ZENdian 是 Obsidian 的工作空间增强插件（桌面端 + 移动端），TypeScript 编写、esbuild 构建。它不是纯视觉主题，而是一套围绕「记录—执行—复盘」的工作流，含两层能力：

1. **外观模块（24 个）**：切换 `document.body` 的 class、注入 CSS 自定义属性，增强编辑器、文件树、标题、Callout、代码块、Banner、关系图谱等界面。
2. **生产力功能**：智能首页、项目控制台（`.home` 文件）、结构化任务、项目时间线、历史快照、交付物发布、数据统计与专注计时。

> 历史说明：早期版本依赖 Obsidian「Style Settings」插件与 `@settings` CSS 块，现已移除——插件自带设置页是唯一设置入口（见 CHANGELOG）。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 监听 TS 变化，输出带内联 sourcemap 的 `dist/main.js` |
| `npm run build` | 依次构建 `dist/styles.css` + 生产版 `dist/main.js` |
| `npm run build:js` | 仅构建 JS（esbuild） |
| `npm run build:css` | 仅合并 CSS 到 `dist/styles.css` |
| `npm run typecheck` | 严格类型 + 未使用/不可达代码检查（`tsc --noEmit`） |
| `npm run check` | 运行全部静态契约检查（见下） |

`npm run check` 依次执行：`typecheck` + `check:settings` + `check:safety` + `check:css` + `check:typewriter` + `check:projects`（含 3 个子脚本）。这些是 `scripts/check-*.mjs` 的契约回归脚本，**没有单元测试框架**。

发布产物：`dist/main.js`、`dist/styles.css`、`manifest.json`。

## 架构总览

```
src/main.ts       组合根：组装服务、注册模块/View/命令、生命周期清理
src/core/         事件总线、设置管理、模块生命周期（无具体界面功能）
src/modules/      24 个可独立加载/卸载的外观模块
src/services/     跨功能数据服务（ActivityLog / TaskSync / ProjectMetadata）
src/focus-clock/  专注时钟控制器
src/homepage/     主页、项目控制台及约 20 个领域服务
src/ui/           设置页、弹出表单、图标选择等 UI
src/utils/        DOM / 日期 / 错误 / SVG / ZIP 等通用工具
css/              分层 CSS 源文件（base / overlays / ui）
```

边界：`main.ts` 只做组装；核心与模块不写具体业务；项目数据业务放在 `homepage/services/`，跨功能服务放 `src/services/`；TS 管理状态与 CSS 变量，最终视觉尽量由 CSS 完成。

## 核心接口

### 功能模块（`IFeatureModule`）

所有 `src/modules/*.module.ts` 实现该接口：

- `readonly id` / `readonly name` — 唯一标识与显示名
- `load(ctx: ModuleContext): Promise<void>` — 初始化，应用设置到 DOM（须可安全调用一次）
- `unload(): void` — 清理自己添加的 class、CSS 变量、DOM、事件、Timer、Observer（必须对称清理）
- `onSettingsChanged?(changedKeys, settings)` — 响应设置变更
- `onThemeChange?(isDark)` — 响应主题切换

`ModuleContext` 提供：`events`（事件总线）、`getSettings()`、`getSetting(key)`、`registerEditorExtension(ext)`（注册 CodeMirror 6 扩展）、`app`（Obsidian `App`）、`updateSettings(updates)`（批量更新 + 持久化 + 广播）。

### 事件（EventBus）

`EventBus.on()` 返回取消订阅函数；处理器异常被隔离记录，不阻断其他监听器。预定义事件（`Events`）：

| 事件 | 参数 | 触发时机 |
| --- | --- | --- |
| `settings:changed` | `changedKeys, settings` | 设置持久化后 |
| `theme:changed` | `isDark` | Obsidian `css-change` 后 |
| `activity:stats-changed` | — | 活动 / 专注统计变化后 |
| `focus-mode:temporary-changed` | `shouldEnableTemporarily`（布尔） | 专注时钟临时切换编辑器专注模式 |

### 设置（SettingsManager）

`PluginSettings` + `DEFAULT_SETTINGS`（`src/types/settings.types.ts`）是设置的唯一数据契约，含 **25 个顶层设置组**：24 个外观模块 + `homepage`。写入走 `settingsManager.update()` / `updateMultiple()`（200ms 防抖 + 串行队列），**不要绕过它直接改对象后保存**，否则模块收不到变更事件。卸载前调用 `flush()` 落盘。旧扁平键 `"groupId@@settingId"` 与旧结构在 `migrate()` 中迁移。

## 数据与服务层

- **TaskSyncService** — 只读写 `项目主页.home` 里的 `tasks` 数组；对外优先级 `urgent/high/medium/low`，存储层 `P0/P1/P2/P3`，服务自动转换。
- **ActivityLogService** — 笔记/任务活动、按日统计、专注会话持久化。
- **ProjectMetadataService** — 项目元数据、标签、里程碑、交付物兼容 API。
- **FocusClockController** — 状态栏专注时钟、会话状态机、休息、声音、记录。

项目控制台通过单例 `getServiceManager(app, taskSyncService)` 访问领域服务（`projectData` / `timeline` / `statistics` / `fileWatcher` / `snapshot` 等）。**项目的「事实来源」是项目根目录下的 `项目主页.home`（JSON）**；整体更新必须走 `mutateProjectHome()`（按项目串行 + `Vault.process` 防并发覆盖），不要自行实现「先读后写」。

## CSS 构建与颜色系统

`scripts/build-css.mjs` 按固定顺序合并到 `dist/styles.css`，靠后的文件层叠优先级更高：

1. `css/design-system.css` — 设计令牌与共享组件基础
2. `css/base/border-theme.css` — Border 风格主体
3. `css/overlays/phycat-overlay.css` — 苹果风颜色叠加
4. `css/overlays/graph.css` — 关系图谱美化
5. `css/overlays/banner.css` — Banner
6. `css/overlays/focus-clock.css` — 专注时钟
7. `css/overlays/homepage.css` — 智能首页
8. `css/overlays/console-enhanced.css` — 项目控制台
9. `css/ui/style-settings-ui.css` — 插件设置页
10. `css/ui/unified-ui.css` — 最终统一层

⚠️ 新增 CSS 文件必须显式加入 `CSS_MERGE_ORDER`，否则不会进入发布产物。

颜色派生自三个 HSL 变量 `--accent-h` / `--accent-s` / `--accent-l`，用 `getComputedStyle(document.body)` 与 Obsidian 原生强调色同步。

## 关键开发经验（易错点）

- 不要猜测 Obsidian DOM，写选择器前先用 DevTools 或真实 DOM 片段确认。
- 动态 DOM 中避免依赖脆弱的子代选择器 `>`；优先 JS 设 per-element CSS 变量，CSS 用 `var()` 消费。
- 主题变量从 `getComputedStyle(document.body)` 读，不要从 `element.style` 读。
- `onload()` 时布局可能未就绪；需要 DOM 的功能用 `onLayoutReady()` 或有上限的轮询。
- 高频 MutationObserver 回调用 `requestAnimationFrame` 合并。
- JS 优先设 class / CSS 变量，避免直接写 `element.style.backgroundColor` 之类的视觉属性。
- 所有用户输入路径必须规范化并限制在预期项目/插件目录内；删除 Vault 文件用 `app.vault.trash()` 而非永久删除。
- 缓存返回可变对象时隔离引用；写操作后同步失效所有派生缓存。
- 新代码必须通过 `strict`、`noUnusedLocals`、`noUnusedParameters` 和不可达代码检查。

## 常见扩展方式

### 新增外观模块

1. 在 `src/modules/` 创建 `<name>.module.ts`，实现 `IFeatureModule`。
2. 在 `settings.types.ts` 加设置接口、`PluginSettings` 字段和默认值。
3. 在 `src/ui/settings-tab.ts` 加对应设置 UI。
4. 在 `src/main.ts` 导入并 `moduleManager.register(new XxxModule())`。
5. 视觉规则加入对应 CSS 源文件，或新建文件并更新 `CSS_MERGE_ORDER`。
6. 运行 `npm run check`，并验证卸载后无遗留 class / 变量 / Observer / Timer。

### 新增项目数据字段

1. 更新 `ProjectConsoleData`（`src/homepage/types.ts`）。
2. 在 `ProjectHomeStore.normalizeData()` 补默认值 / 迁移逻辑。
3. 更新 `ProjectDataService` 的规范化与缓存失效范围。
4. 更新创建项目的默认数据与相关 UI；若字段影响报告 / 统计 / 历史，同步更新对应服务。

## 提交前检查

```bash
npm run check
npm run build
```

并手工确认：插件启用/禁用/重载无异常；浅/深色切换后模块刷新正确；首页、`.home` 控制台、设置页可打开；新增事件 / Observer / Timer 在卸载后停止；旧设置 / 旧 `.home` 可迁移；`git status` 无 `dist/`、`node_modules/` 或本地测试产物。

## 参考文档

- [docs/开发者指南.md](docs/开发者指南.md) — 详细架构、完整文件职责索引、View/命令清单
- [README.md](README.md) — 用户功能与安装说明
- [CHANGELOG.md](CHANGELOG.md) / [notes/](notes/) — 版本变更与发布说明
- [docs/项目数据与恢复.md](docs/项目数据与恢复.md) — 项目数据存储与恢复
