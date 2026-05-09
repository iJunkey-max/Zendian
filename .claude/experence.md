# ZENdian 开发经验记录

## 彩色文件夹模块 (2.0.14) — 调试复盘

### 1. Obsidian DOM 结构不能靠猜

**教训**: Obsidian 的 DOM 结构与文档描述不一致。例如 `.nav-folder.mod-root` 不存在，文件夹之间有额外的 wrapper `<div>`，导致 CSS 子代选择器（`>`）全部失效。

**正确做法**: 让用户提供实际 DOM 片段，或在 DevTools 中确认真实结构后再写选择器。

### 2. CSS 子代选择器在动态 DOM 中极脆弱

**教训**: Obsidian 文件树有多层 wrapper `<div>`，`> .nav-folder > .nav-folder-title` 这种链式选择器几乎必然失败。即使改成后代选择器（空格），也无法区分嵌套层级。

**正确做法**: 需要按层级区分样式时，用 JS 设置 per-element CSS 变量，CSS 只负责消费变量。

### 3. `element.style` vs `getComputedStyle()`

**教训**: `element.style.getPropertyValue("--accent-h")` 只读内联样式。Obsidian 的主题变量通过 stylesheet 注入，必须用 `getComputedStyle(document.body)` 才能读到。

**规则**: 读取主题/CSS 变量 → `getComputedStyle()`；写入内联变量 → `element.style.setProperty()`。

### 4. 插件 load() 时 DOM 可能未挂载

**教训**: Obsidian 插件的 `onload()` 在工作区布局就绪前就执行，此时文件树 DOM 尚未渲染，`querySelector` 返回 null。

**解决方案**: 轮询等待目标元素出现（`setInterval` 200ms，最多 50 次），找到后挂载 MutationObserver 监听后续变化。

### 5. 线性公式在小数值下失效

**教训**: 线性衰减 `basePct * opacity` 在 opacity 较小时（如 0.12），所有层级锁定在最低阈值（5%），视觉上完全无法区分。

**正确做法**: 使用指数衰减 `opacity * Math.pow(0.6, level)`，每层减少 40%，层级差异显著。

### 6. CSS 变量注入优于直接操作 style

**教训**: 直接在 JS 中设置 `element.style.backgroundColor` 难以维护且无法被 CSS 覆盖。

**正确做法**: JS 只负责计算并设置 CSS 变量（`--rf-bg`），CSS 通过 `var(--rf-bg)` 消费，职责分离清晰。

### 7. 主题切换需要主动监听

**教训**: Obsidian 不会自动通知插件主题变化。需要在 `main.ts` 中显式监听 `app.workspace.on("css-change")` 事件并广播给模块。

**注意**: `css-change` 事件在 Obsidian 中存在但文档未提及，需要手动注册。

### 8. MutationObserver 需要防抖

**教训**: 文件树展开/折叠会触发大量 DOM 变更，直接在回调中执行计算会导致性能问题。

**正确做法**: 用 `requestAnimationFrame` 包裹回调，确保每帧最多执行一次。

---

*记录于 2026-05-07，基于 V2.0.14 彩色文件夹功能开发过程中的多轮调试。*

---

## 图标系统模块 (2.1.02E) — 开发复盘

### 1. SuggestModal 的虚拟滚动会破坏 CSS Grid 布局

**教训**: Obsidian 的 `SuggestModal` 底层使用虚拟滚动（Virtual DOM），会给子节点注入 `position: absolute` 等定位样式，直接破坏 CSS Grid 的 `grid-template-columns` 生效。无论怎么覆盖 CSS 都无法修复。

**正确做法**: 需要 Grid 布局的弹窗，应继承基础 `Modal`，手动创建搜索输入框和网格容器，自行实现搜索过滤逻辑。

### 2. 不稳定的 Obsidian 内部 API 必须用标准 DOM 查询替代

**教训**: `leaf.tabHeaderInnerIconEl` 是未稳定公开的 API，某些情况下不存在。同样，`.workspace-tab-header-inner-icon` 容器在文件原生没有图标时根本不会生成到 DOM 中，导致 `querySelector` 返回 null 并跳过渲染。

**正确做法**: 使用 `leaf.tabHeaderEl?.querySelector('.workspace-tab-header-inner')` 标准 DOM 查询，找到确定存在的父容器，然后 `insertBefore(wrapper, title)` 在标题前插入。

### 3. 绝对不能用 `textContent = ""` 清空原生 DOM 容器

**教训**: 暴力清空 `tabHeaderIcon.textContent = ""` 会破坏 Obsidian 原生的视图重绘机制，导致功能连锁崩溃和原生 UI 被破坏。

**正确做法**: 用 CSS 隐藏原生元素（如 `.workspace-tab-header-inner-icon > svg:not(.zendian-injected-svg) { display: none }`），然后 `appendChild` 追加我们的图标。JS 只做追加，不做删除原生内容。

### 4. CSS 作用域必须加限定前缀防止误杀

**教训**: 为标签页编写的隐藏原生 SVG 的 CSS（`:not(.zendian-injected-svg)`）如果不加 `.mod-root` 前缀，会波及侧边栏的搜索、书签等面板，误杀它们的原生图标。

**正确做法**: 所有可能影响全局的 CSS 规则，必须加上 `.mod-root .workspace-tab-header` 等限定前缀，精确控制作用域。

### 5. CSS 语法错误会导致解析树断裂，影响范围远超预期

**教训**: 在 `phycat-overlay.css` 末尾追加图标系统样式时，前一个规则块（`body.theme-dark .codeblock-customizer-line-number-specific`）漏写了分号 `;` 和闭合大括号 `}`，导致整个 CSS 解析树断裂，连带侧边栏按钮等完全无关的样式全部失效。

**正确做法**: 追加 CSS 时必须确认前一个块已正确闭合。每次修改后检查构建产物（`dist/styles.css`）的对应位置，确认语法完整。

### 6. 文件树隐藏箭头后需要清除 padding 留白

**教训**: 隐藏 `.nav-folder-collapse-indicator` 和 `.tree-item-icon.collapse-icon` 后，`.nav-folder-title` 仍有原生的 `padding-left` / `padding-inline-start`，导致图标无法向左对齐补位，留下"幽灵占位"。

**正确做法**: 隐藏箭头的同时，必须追加 `padding-left: 0 !important; padding-inline-start: 0 !important` 和 `margin-left: 0 !important` 清除留白。

### 7. Obsidian 新版 DOM 类名会变化，选择器需要兼容

**教训**: 旧版 Obsidian 使用 `.nav-folder-collapse-indicator` 作为折叠箭头，新版 UI 更新为 `.tree-item-icon.collapse-icon`。只用旧选择器会导致新版失效。

**正确做法**: 隐藏箭头的 CSS 应同时包含新旧两个选择器，用逗号分隔确保兼容。

### 8. 浏览器原生 ZIP 解压：DecompressionStream 只支持 gzip/deflate，不支持 zip 容器

**教训**: `new DecompressionStream("deflate-raw")` 可以解压单个 deflate 数据流，但 zip 文件是一种容器格式，有自己的中央目录（EOCD）和本地文件头结构。不能直接把整个 zip 喂给 DecompressionStream。

**正确做法**: 需要实现最小化 zip 解析器：先解析中央目录获取条目列表，再按条目读取本地文件头定位数据偏移，最后对每个条目的压缩数据单独使用 `DecompressionStream("deflate-raw")` 解压。仅支持 STORED（无压缩）和 Deflate 两种方法即可覆盖绝大多数 zip 文件。

### 9. 设置迁移的深度合并不能遗漏新字段

**教训**: `SettingsManager.migrate()` 在检测到新格式数据时，如果直接 `return oldData as PluginSettings`，会丢失后续版本新增的字段（如 `iconSystem`），导致老用户升级后新功能的设置全部为 undefined。

**正确做法**: 新格式数据也必须与 `DEFAULT_SETTINGS` 做深度合并——遍历所有 key，对象类型用展开运算符合并，其他类型直接赋值。确保新增字段始终有默认值。

### 10. 模块写入设置需要安全的回调通道

**教训**: 功能模块需要持久化自己的设置（如安装的图标库列表、自定义图标映射），但 `ModuleContext` 最初只有读取设置的 API，没有写入能力。

**正确做法**: 在 `ModuleContext` 中扩展 `updateSettings: (updates: Partial<PluginSettings>) => Promise<void>` 回调，委托给 `SettingsManager.updateMultiple()`。模块通过 `ctx.updateSettings()` 写入，保持与核心服务的解耦。

---

*记录于 2026-05-09，基于 V2.1.02E 图标系统功能开发过程中的多轮调试与 UI 打磨。*
