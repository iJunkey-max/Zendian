# 更新日志

ZENdian 插件的所有重要变更将记录在此文件中。

## [2.1.04Enhanced] - 2026-05-09

### 修复

- **Banner 图片加载失败留白**：当 YAML 中的图片链接无效（死链或文件不存在）时，页面顶部不再留有空白。`<img>` 元素新增 `onerror` 事件处理，加载失败时自动清理占位 DOM 和 CSS 属性
- **Banner 无限重渲染闪烁**：修复死链图片导致 1 秒轮询与 `onerror` 形成无限循环（注入 → 清理 → 再注入）的问题。新增 `failedUrls` 缓存机制，失败的 URL 不再重复尝试加载

### 变更

- **深色模式背景色调暗**：降低 `.theme-dark` 及其变体（`background-darker`/`background-brighter`）的背景色亮度，从约 15-19% 降至 7-12% 区间，视觉更接近 `#121212` - `#1a1a1a` 的深邃效果，提升沉浸感

## [2.1.03] - 2026-05-09

### 新增

- **页眉图片 (Banner)**：全新 `BannerModule` 模块，从 frontmatter 读取图片 URL 注入笔记顶部
- 支持外部链接（http/https）和本地仓库图片（`[[wiki-link]]` 格式）
- 毛玻璃属性面板融合（亮色/暗色模式自适应）
- 图片渐变遮罩，与正文自然过渡
- data-attribute 隔离机制，支持分屏视图独立渲染
- 心跳轮询（1s）+ layout-change/file-open/metadataCache.changed 三重事件守护
- 防吞噬机制：已存在时更新 src + 强制置顶，避免 CM6 重建丢失
- 设置面板「排版与阅读」新增「页眉图片」配置区：启用开关、YAML 键名、高度滑块（150-1000px）、图片对齐方式（居中/顶部/底部）

### 变更

- 页眉高度滑块上限从 400 提升至 1000

## [2.1.02E] - 2026-05-09

### 新增

- **动态文件树图标系统**：全新 `IconSystemModule` 模块，基于正则匹配的数据驱动图标引擎，替代旧版 CSS 伪元素静态图标
- **内置 Lucide 图标**：文件树自动根据文件后缀匹配对应图标（md → file-text、pdf → file-text、图片 → image 等），文件夹使用 folder 图标
- **第三方图标库支持**：预置 Boxicons、Coolicons、Tabler Icons 三个图标库，设置面板一键勾选自动下载安装
- **图标选择器弹窗**：基于 `Modal` 的 CSS Grid 多列图标网格，支持库切换下拉、搜索过滤、点击选中
- **右键自定义图标**：文件树右键菜单「自定义图标」入口，可为单个文件指定专属图标
- **恢复默认功能**：图标选择器新增「恢复默认」按钮，可撤销自定义图标回到正则匹配
- **标签页图标**：开启后在工作区标签页标题前显示对应的文件图标，支持 layout-change / file-open 事件自动刷新
- **设置面板「图标与资源库」标签页**：包含全局开关、自定义图标开关、标签页图标开关、图标库管理、默认规则编辑器

### 变更

- 旧版 CSS 伪元素文件图标（~130 行）和彩虹文件夹 nth-child 规则已移除，由新图标系统完全接管
- `ModuleContext` 扩展 `app` 和 `updateSettings` 回调，模块可安全写入设置
- `SettingsManager.migrate()` 新旧格式深度合并，确保老用户升级不丢失新字段

## [2.1.00F] - 2026-05-08

### 修复

- 修复文件夹层级遮罩颜色不随主题色变化的问题：将 `--rf-bg` 内联 hsla 快照改为 CSS 变量原生响应式 `hsla(var(--accent-h/s/l))`，主题色变化时浏览器自动重算

### 变更

- 设置面板为约 40 个非基础设置项添加中文说明文字
- 为专注模式、焦点指示器、打字机滚动添加功能介绍

## [2.0.19E] - 2026-05-07

### 新增

- 专注模式打字机滚动：新增 CM6 ViewPlugin，光标行始终保持在窗口 3/4 处，原生平滑滚动
- 毛玻璃景深效果：非活动行 blur(0.5px) 降噪，活动行 scale(1.02) + backdrop-filter 毛玻璃高亮
- 专注模式设置新增「打字机滚动」开关（专注模式关闭时灰显）

### 变更

- 专注模式视觉全面重构：active line 背景从 hsla 迁移至 color-mix(in srgb, var(--interactive-accent) 8%, transparent)
- 活动行增加 font-weight: 500、box-shadow、border-radius: 8px
- cm-scroller 增加 padding-bottom: 75vh 确保最后一行可滚动到 3/4 处
- 代码块/表格组件异常处理：取消 transform、box-shadow、backdrop-filter 避免视觉错位
- 模块系统扩展：ModuleContext 新增 registerEditorExtension，支持模块注册 CM6 扩展

## [2.0.18U] - 2026-05-07

### 新增

- H2 标题风格切换：设置面板 H2 Tab 新增「线条」和「方框」两种风格，亮色/暗色同步切换

### 变更

- H2 方框风格配色从硬编码迁移至 `color-mix(in srgb, var(--primary-color), ...)` 适配任意主题色
- 亮色方框恢复白色文字 + 渐变背景 + position 动画
- 暗色方框恢复毛玻璃 + 径向渐变光晕 + ::after hover 浮现

## [2.0.16] - 2026-05-07

### 变更

- 移除亮色模式 HR 覆盖块（虚线变体），回退继承全局渐变横线 + 中间方框样式
- YAML frontmatter 选择器从已废弃的 `.frontmatter-container` 迁移至 Obsidian 1.4+ Properties UI 的 `.metadata-container`
- 隐藏 Obsidian 默认属性标题（`.metadata-properties-heading`）

### 修复

- 修复亮色模式下分隔线（`---`）因 `border: none` + `height: 0` 导致塌陷不可见的问题
- 修复文档属性样式未生效的问题（根因：Obsidian 1.4+ 已废弃 `.frontmatter-container` DOM 结构）

## [2.0.15] - 2026-05-07

### 新增

- 图片渲染样式：圆角 12px、微阴影、hover 缩放 + 亮度提升 + 深阴影、figcaption 居中变色
- YAML frontmatter 专属样式：虚线边框、主色淡背景、右上角 "YAML" 标签、hover 浮起 + 实线边框 + 发光
- 脚注样式：`.footnote-ref` 加粗强调色、`.footnote-item em` 小字灰色
- 选区高亮色（`::selection`）和光标颜色（`caret-color`）跟随主题主色
- 亮色主题 HR 变体：虚线样式 + scaleX 缩放动画，替代暗色渐变菱形风格
- 暗色 `caution` callout 完整样式（背景、标题、emoji、hover）
- 源码视图 H3-H6 标题 hover 效果：文字变色、霓虹发光、位移、伪元素增强
- 链接 hover 霓虹发光：暗色双色 text-shadow、亮色柔和阴影

### 变更

- 增强 callout hover 效果：添加 `transform: scale(1.01) translateY(-2px)` + `box-shadow` 浮起效果
- 增强 callout emoji hover：添加 `text-shadow: 0 0 25px currentColor` 发光
- 补充缺失的暗色 callout hover 规则（danger、error、bug、failure、missing、abstract、summary、tldr、quote）
- 增强加粗 hover：添加 `border-bottom` 霓虹边框 + 增强 `text-shadow` 双色发光
- `tldr` 加入 `abstract/summary` callout 组

### 修复

- 修复暗色 `failure`/`missing` callout 背景为纯黑（`rgba(0,0,0,0.2)`）而非红色调的问题
- 修复暗色 `caution` callout 缺失导致回退到灰色基础背景的问题
- 修复暗色 `caution` callout 背景色仅在 hover 时显示的问题（添加 `--callout-background` CSS 变量）

## [2.0.14] - 2026-05-07

### 重构

- 彩色文件夹模块完全重写，从纯 CSS 方案迁移至 JS + CSS 变量方案
  - 深度计算改为自底向上遍历（计数 `.nav-folder-children` 祖先节点），解决 DOM 结构不匹配问题
  - 颜色读取改用 `getComputedStyle(document.body)` 获取 Obsidian 原生 HSL 变量（`--accent-h/s/l`），替代临时 DOM 元素解析
  - 遮罩浓度从线性公式改为指数衰减 `opacity * Math.pow(0.6, level)`，层级差异更明显
  - 新增 `setInterval` 轮询机制解决插件 load() 时文件树 DOM 尚未挂载的时序问题
  - 新增 MutationObserver 监听文件树变化（展开/折叠/拖拽），自动重新计算遮罩

### 变更

- 移除旧版彩虹文件夹 8 色设置项（`rainbow-folder-color-1` ~ `rainbow-folder-color-8`）
- 移除旧版彩虹文件夹 CSS 样式（`border-theme.css` 中约 45 行）
- 新增 active 文件高亮样式（左侧边框 + 背景色 + 字重加粗）

### 修复

- 修复 `css-change` 事件从未触发的问题，`main.ts` 新增 `app.workspace.on("css-change")` 监听并广播 `THEME_CHANGED`
- 修复主题切换后遮罩颜色不跟随的问题

## [2.0.13] - 2026-05-06

### 重构

- 全面重构为「核心框架 + 功能模块」架构
  - 核心层：EventBus（事件总线）、SettingsManager（设置管理）、ModuleManager（模块生命周期管理）
  - 22 个功能模块独立封装，各自管理 CSS class 和 CSS 变量的加载与卸载
  - 设置数据从扁平 key-value（`"groupId@@settingId"`）迁移至结构化 PluginSettings 对象
  - 旧代码隔离至 `src/legacy/`，新架构从零搭建骨架
- 设置面板重写：基于结构化设置对象的 Tab 式 UI，支持 toggle/select/number/number-slider 渲染
- 提取公共 DOM 工具函数（ClassTracker、setCSSVar、removeCSSVar）至 `src/utils/dom.ts`

### 新增

- 标题系统（H1-H6）新增 Tab 切换组件，点击 Tab 动态绑定对应级别的设置
- 所有标题级别（H1-H6）新增「对齐方式」选项（居左/居中/居右）
- 标题设置新增「文本转换」选项（无/大写/小写/首字母大写）
- 标题设置新增「字号」滑条（0.8 ~ 2.5）
- 文件夹层级遮罩功能：基于主题色，按文件夹层级递增遮罩深度，替代原有彩虹文件夹

### 变更

- 设置面板全面精简：移除所有颜色相关设置（颜色由主题色决定）
- 移除标题的字体设置，统一跟随 Obsidian 编辑器字体
- 移除标题的分隔线、字重、文本转换选项，简化为对齐 + 字号 + 前后间距
- 移除 H2 的亮色/暗色风格选项
- 链接装饰设置从 6 项精简为 3 项，text 输入改为 select 下拉
- 列表缩进、网格背景尺寸、嵌入最大高度等 text 输入改为 select 下拉
- 阅读区宽度、字号、间距等 text 输入改为 slider 滑条
- 移除段落间距、段间距对换行生效、外部链接滤镜、复选框圆角等低频设置
- 移除"不修剪文件名"、"指示代码块行号"等低频设置
- 移除标注模块的 padding/titlePadding/titleSize/contentPadding/contentRadius
- 移除嵌入模块的 padding/borderRadius/fontStyle
- 移除文件夹图标大小设置

### 修复

- 修复彩虹文件夹 CSS 选择器不匹配当前 Obsidian DOM 结构的问题
  - 根目录无 `.mod-root` 类名，改用 `.workspace-leaf-content[data-type="file-explorer"]` 作为起点
  - 选择器从直接子代（`>`）改为后代匹配（空格），通过 `.nav-folder` 嵌套次数区分层级
- 修复文件夹遮罩颜色被主题覆盖的问题，所有属性添加 `!important`
- 修复 H1-H6 Tab 栏纵向排布的问题，添加 `display: flex`
- 修复 `rainbow-folder` class 错误影响文件图标颜色的问题，图标改色仅属于 `colorful-folder`

## [2.0.5] - 2026-05-06

### 新增

- 新增「文件树」主选项卡，集中管理文件列表和彩虹文件夹设置
- 彩虹文件夹支持自定义 8 种颜色，可自由替换默认配色
- 彩虹文件夹支持自定义图标大小
- 新增 `rainbow-folder` class，与原有 `colorful-folder` 兼容

### 变更

- 文件列表相关设置（新建笔记按钮、文件名修剪、文件夹加粗等）从「视图与工作区」移至「文件树」选项卡
- 彩虹文件夹颜色从硬编码改为 CSS 变量，支持运行时动态切换

## [2.0.4] - 2026-05-06

### 新增

- 设置面板新增 ZENdian 核心选项卡，展示插件版本、作者、功能亮点和使用说明
- 选项卡栏支持鼠标滚轮横向滚动
- 选项卡栏支持鼠标拖拽滚动
- 为所有 CSS @settings 设置项补充中文说明（description.zh）

### 变更

- 设置面板主选项卡从左侧竖排改为顶部横排布局
- 次级设置卡片取消折叠，始终展开显示
- 隐藏选项卡栏滚动条
- 选项卡排布更加紧凑

## [2.0.2] - 2026-05-06

### 修复

- 修复插件启动时强调色（accent color）未正确加载的问题
  - 插件加载时 Obsidian 的 `--interactive-accent` 变量可能尚未计算完成
  - 新增重试机制：首次读取失败后自动重试（最多 10 次，间隔 500ms）
  - 增加系统主题切换监听（`prefers-color-scheme`），覆盖更多场景

## [1.0.0] - 2026-05-05

### 首次发布

- 集成 Border Theme v1.12.26 (by Akifyss) 作为基础 UI 主题
- 集成 Phycat Apple 设计语言配色方案和排版叠加层
- 集成增强的 Markdown 元素渲染样式（kbd、mark、strong、callout、表格、列表、任务、链接、代码块）
- 集成 Style Settings v1.0.9 (by mgmeyers) 可视化 CSS 变量配置功能
- 10 个 @settings 配置组：
  - zendian-info：插件信息与归属
  - phycat-spacing：阅读区间距（行高、字间距、段落间距）
  - phycat-headings：标题样式（H1-H6 大小、对齐、风格变体）
  - Info：Border 主题信息
  - Components：UI 组件开关（自动隐藏、文件浏览器、彩色文件夹等）
  - Appearance-light：亮色模式外观（预设、主题色、卡片布局）
  - Appearance-dark：暗色模式外观
  - Editor：编辑器增强（焦点模式、网格背景、代码块）
  - Mobile：移动端/平板设置
  - Plugin：插件兼容性设置
- 支持亮色/暗色模式切换
- CSS 构建脚本支持源文件合并与去重
