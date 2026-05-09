# ZENdian Homepage 新版功能开发执行包

## 适用对象

本执行包用于把“现代化主页 / Dashboard / New tab replacement”作为 ZENdian 的新版功能模块接入现有插件。

## 当前结论

现有插件产物显示，ZENdian 已具备以下基础：

1. `EventBus`：用于跨模块通知设置变化、主题变化。
2. `SettingsManager`：统一维护 `DEFAULT_SETTINGS`、`loadData()`、`saveData()`、`updateMultiple()`。
3. `ModuleManager`：以 `module.id / module.name / module.load(ctx) / module.unload()` 形式加载功能模块。
4. 已有 `newTab` 配置与 CSS 美化逻辑，但目前仍是美化 Obsidian 原生 empty tab，并非真正接管为自定义主页视图。
5. 已有 Style Settings 元数据块、设置面板、模块化 CSS 风格，适合继续扩展。

因此 Homepage 不应作为零散补丁开发，而应作为 `homepage` 模块加入 ModuleManager。

## 交付内容

- `01_MVP_需求规格说明.md`
- `02_技术架构与接入点.md`
- `03_开发任务拆解.md`
- `04_代码骨架_TypeScript.md`
- `05_样式追加_CSS.md`
- `06_测试验收清单.md`
- `src/homepage/constants.ts`
- `src/homepage/types.ts`
- `src/homepage/utils.ts`
- `src/homepage/HomepageSearchService.ts`
- `src/homepage/HomepageStatsService.ts`
- `src/homepage/HomepageRecentService.ts`
- `src/homepage/HomepageRenderer.ts`
- `src/homepage/HomepageView.ts`
- `src/homepage/HomepageModule.ts`
- `styles/homepage.css`

## 开发原则

第一版只做 MVP：

- 自定义 `ItemView`
- 命令打开主页
- 可选接管 empty tab
- Omnibox 文件搜索
- 最近文件
- 基础统计卡片
- 保留现有 new tab 样式兼容开关

暂不做：

- React
- dnd-kit
- Bases 深度解析
- Shadow DOM widget
- 外部插件注册 API
- 多端布局树

这些放入 V2 / V3。

## 推荐落地方式

不要直接改编译后的 `main.js`。应回到源码工程，新增 `src/homepage/*`，然后在入口文件中注册 `HomepageModule`，最后重新构建生成新版 `main.js`。

