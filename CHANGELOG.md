# 更新日志

ZENdian 插件的所有重要变更将记录在此文件中。

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
