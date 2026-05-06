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
