# ZENdian UI 视觉开发规范

> 适用范围：所有插件自有界面 —— 智能首页、项目控制台、设置页、弹窗与弹出面板、专注时钟、图谱控制面板、Banner、日程弹层等。
>
> 核心目标：**视觉统一 + 控件复用**。同一类控件只做一套样式，各处直接复用；禁止为「同样的视觉效果」再写一份 CSS 或 TS。

## 1. 设计原则

1. **一致性** — 所有组件使用统一设计 Token（`--zd-*`），颜色、间距、圆角、阴影、字号集中管理。
2. **可维护性** — 业务 CSS / TS 里**不硬编码**颜色、阴影、圆角、间距数值，只消费 Token。
3. **主题友好** — 深色 / 浅色通过 `.theme-dark` / `.theme-light` 覆盖 Token 自动切换，组件不感知具体主题。
4. **响应式与可访问** — 适配桌面 / 窄窗口 / 移动端；动画与过渡尊重 `prefers-reduced-motion`。

## 2. 三层架构

```
┌─ css/design-system.css    设计 Token 与基础原语（唯一事实来源）
├─ css/ui/unified-ui.css    统一 UI 语义层：把各 surface 本地变量映射到 --zd-ui-*
└─ 各 surface 样式           只消费 Token，不再各自定义颜色/阴影/圆角
   （css/overlays/*.css · css/ui/style-settings-ui.css · css/base/border-theme.css）
```

- **第 1 层**定义全部 `--zd-*` 设计 Token 和 `--zd-ui-*` 语义别名。
- **第 2 层**（unified-ui.css）负责「统一」：主页、设置、弹窗、弹出面板、专注时钟、图谱控制面板共享同一套 surface / border / radius / shadow / focus 语言。
- **第 3 层**各 surface 样式只 `var(--zd-ui-*)`，**不再定义**自己的颜色 / 阴影 / 圆角。

## 3. 设计 Token 速查（`--zd-*`）

### 3.1 颜色

| 分组 | Token | 说明 |
| --- | --- | --- |
| 主色 | `--zd-primary` / `-light` / `-dark` / `-alpha` | 跟随 Obsidian 强调色 `hsl(var(--accent-h), var(--accent-s), var(--accent-l))` |
| 语义色 | `--zd-success` / `--zd-warning` / `--zd-error` / `--zd-info`（各带 `-light` 低透明版） | 成功 / 警告 / 错误 / 信息 |
| 优先级 | `--zd-priority-p0` ~ `--zd-priority-p3` | P0 红 / P1 橙 / P2 蓝 / P3 灰 |
| 状态 | `--zd-status-active` / `-paused` / `-completed` / `-archived` | 项目状态 |

背景 / 文本 / 边框 / 阴影 / 分割线按 `.theme-light` / `.theme-dark` 分开定义：

| 分组 | Token |
| --- | --- |
| 背景 | `--zd-bg-primary` / `-secondary` / `-tertiary` / `-hover` / `-active` |
| 文本 | `--zd-text-primary` / `-secondary` / `-tertiary` / `-disabled` / `-inverse` |
| 边框 | `--zd-border-default` / `-hover` / `-focus` |
| 阴影 | `--zd-shadow-xs` / `-sm` / `-md` / `-lg` / `-xl` |
| 分割线 | `--zd-divider` |

### 3.2 间距（4px 基础单位）

`--zd-space-1`(4px) · `-2`(8) · `-3`(12) · `-4`(16) · `-5`(20) · `-6`(24) · `-8`(32) · `-10`(40) · `-12`(48) · `-16`(64)

### 3.3 圆角

`--zd-radius-none`(0) · `-sm`(4) · `-md`(8) · `-lg`(12) · `-xl`(16) · `-2xl`(24) · `-full`(9999)

### 3.4 字体

- 族：`--zd-font-sans`、`--zd-font-mono`
- 字号：`--zd-text-xs`(11) · `-sm`(12) · `-base`(13) · `-md`(14) · `-lg`(16) · `-xl`(18) · `-2xl`(20) · `-3xl`(24) · `-4xl`(30)
- 字重：`--zd-font-normal`(400) · `-medium`(500) · `-semibold`(600) · `-bold`(700)
- 行高：`--zd-leading-none/tight/snug/normal/relaxed`；字距：`--zd-tracking-*`

### 3.5 动效与层级

- 时长：`--zd-duration-75/100/150/200/300/500`（ms）
- 缓动：`--zd-ease-linear/in/out/in-out`；组合：`--zd-transition-fast/normal/slow`
- 层级：`--zd-z-base`(0) · `-dropdown`(100) · `-sticky`(200) · `-overlay`(300) · `-modal`(400) · `-popover`(500) · `-toast`(600)
- 断点（仅作约定，实际写 media query）：`sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 · `2xl` 1536

## 4. 统一 UI 语义层（`--zd-ui-*`）

这些语义 Token 定义在 `body` 上（见 design-system.css 的「Shared UI aliases」与 unified-ui.css），是**每个 surface 必须消费的入口**：

| 语义 Token | 用途 |
| --- | --- |
| `--zd-ui-page` | 页面背景 |
| `--zd-ui-control` / `-hover` | 卡片 / 控件表面及其 hover |
| `--zd-ui-surface` / `-raised` / `-soft` | 表面三档 |
| `--zd-ui-text` / `-muted` / `-faint` | 三级文本 |
| `--zd-ui-divider` / `-strong` | 分割线 / 边框两档 |
| `--zd-ui-border` / `-strong` | 边框两档 |
| `--zd-ui-radius-card` | 卡片圆角（默认 `--zd-radius-lg`，12px） |
| `--zd-ui-radius-control` | 控件圆角（默认 `--zd-radius-md`，8px） |
| `--zd-ui-shadow-card` / `-hover` / `-dialog` | 卡片 / hover / 弹层阴影 |
| `--zd-ui-focus-ring` | 焦点环（`2px solid` 主色） |
| `--zd-ui-control-height` | 控件最小高度（34px） |
| `--zd-ui-card-padding` | 卡片内边距（16px） |

### 4.1 复用规则（关键）

每个 surface 的根类在 unified-ui.css 中把**自己的本地变量映射到上面的语义 Token**，业务样式只读本地变量。现有映射：

| Surface 根类 | 映射的本地变量 |
| --- | --- |
| `.zendian-homepage` | `--bg` `--surface` `--shadow-card` `--hp-border` `--hp-divider` `--text-main` `--text-muted` `--text-lighter` `--text-faint` |
| `.zc-root`（项目控制台） | `--zc-bg` `--zc-bg-secondary` `--zc-text` `--zc-text-secondary/tertiary` `--zc-border` `-hover` `--zc-shadow` `-hover` `--zc-radius` `-sm` `-xs` |
| `.zendian-settings-wrapper` | `--zd-settings-card` `-line` `-shadow` `-hover` `-radius-card` `-radius-control` |
| `.zendian-focus-clock-panel` / `-workspace` / popout | `--zd-focus-panel-surface` `-raised` `-border` `-radius-card` `-radius-control` `-shadow` |
| `.zendian-popout-form` / `.modal.zendian-shared-modal` | 直接使用 `--zd-ui-*`，无额外本地层 |
| `.zendian-graph` | 直接使用 `--zd-ui-*` |
| `.zendian-schedule-popover` | 直接使用 `--zd-ui-*` |

> **项目控制台（`.zc-root`）保留自己的工作台信息架构，但表面原语（surface / border / radius / shadow）必须与主页等界面一致**——即同样映射到 `--zd-ui-*`，不允许另起一套颜色 / 阴影 / 圆角。

## 5. 类名前缀规范

| 前缀 | 归属 |
| --- | --- |
| `.zendian-*` | 插件自有通用界面（主页、设置、弹窗、弹出面板、专注时钟、图谱、日程弹层） |
| `.zc-*` | 项目控制台 |
| `.hp-*` / `.homepage-*` | 智能首页 |
| `mod-cta` / `mod-warning` | Obsidian 按钮修饰（主按钮 / 危险按钮），沿用 Obsidian 约定 |

- 每个自有界面必须有**唯一根类名**，它是 unified-ui.css 挂载 Token 映射的锚点。
- **新 surface 必须在 unified-ui.css 补映射**，不能自己在业务样式里硬编码颜色 / 阴影 / 圆角。

## 6. 控件规范

### 6.1 按钮

| 类型 | 约定 |
| --- | --- |
| 主按钮（CTA） | Obsidian `ButtonComponent.setCta()`，或 `createEl("button", { cls: "mod-cta" })` |
| 危险按钮 | Obsidian `ButtonComponent.setWarning()`，或 `cls: "mod-warning"`；自定义场景可用 `is-danger` |
| 默认 / 次要按钮 | 不加修饰，走「控件表面 + 边框 + hover」的统一几何 |
| 自定义强调填充 | 仅确有需要时：`background: var(--zd-primary)` + `color: var(--text-on-accent)`（见 `.homepage-project-modal-btn--primary`） |

统一几何（由 unified-ui.css 的 `:is(button, .button)` 规则提供）：最小高度 32px（弹窗/共享弹窗）/ `--zd-ui-control-height`（34px），圆角 `--zd-ui-radius-control`，焦点态 `outline: var(--zd-ui-focus-ring)` + `outline-offset: 2px`。**不要为单个按钮重新手写这些**。

### 6.2 卡片

- 表面：`background: var(--zd-ui-control)`（或对应本地变量，如 `--surface` / `--zc-bg-secondary` / `--zd-settings-card`）
- 边框：`1px solid var(--zd-ui-divider)`
- 圆角：`var(--zd-ui-radius-card)`
- 阴影：`var(--zd-ui-shadow-card)`；hover 用 `--zd-ui-shadow-hover` + `--zd-ui-divider-strong`

### 6.3 输入框 / 下拉 / 文本域

- 背景 `var(--zd-ui-page)`，边框 `var(--zd-ui-divider)`，文本 `var(--zd-ui-text)`
- 圆角 `var(--zd-ui-radius-control)`，最小高度 `--zd-ui-control-height`
- 焦点：`border-color: var(--zd-primary)` + `box-shadow: 0 0 0 2px color-mix(in srgb, var(--zd-primary) 18%, transparent)`
- placeholder：`color: var(--zd-ui-text-faint)`

### 6.4 徽章 / 标签 / 分割线

- 徽章：`inline-flex`、`padding: var(--zd-space-1) var(--zd-space-2)`、`--zd-text-xs`、`--zd-font-medium`、圆角 `--zd-radius-full`
- 分割线：`height: 1px; background: var(--zd-ui-divider)`

### 6.5 焦点态与可访问性

- 所有可交互控件必须有 `:focus-visible` 焦点环：`outline: var(--zd-ui-focus-ring); outline-offset: 2px;`
- 语义化颜色配对：文字「错误」用 `--zd-error`，背景层用 `--zd-error-light`，不要只用颜色传达状态。

## 7. 复用清单（已有的直接复用，不要新造）

| 需要 | 复用件 |
| --- | --- |
| 确认 / 取消弹窗 | `confirmAction(app, options)`（`src/ui/confirm-modal.ts`），自动挂 `.zendian-shared-modal` |
| 任意内容弹出面板 | `openPopoutForm(app, options)`（`src/ui/popout-form.ts`），自动挂 `.zendian-popout-form` |
| 日期 / 时间选择弹层 | `.zendian-schedule-popover` |
| 图标选择 | `src/ui/icon-picker-modal.ts` |
| 卡片 / 输入 / 搜索 / 筛选下拉 | 各自 surface 已统一的 `.homepage-card`、`.homepage-search-input`、`.homepage-filter-select` 等 |
| 通用表单 / 弹窗宿主 | `PopoutFormView`（`VIEW_TYPE_ZENDIAN_FORM_POPOUT`） |

**判断标准**：新控件若和已有控件「长得一样」，就必须复用已有类名 / 组件，而不是复制一份 CSS。确需新变体时，先确认它是否只是「不同 Token 组合」，是则只加本地变量映射，不加新样式。

## 8. JS 侧规范

- **JS 只设置 class 与 CSS 变量，视觉一律交给 CSS 用 `var()` 消费**；不要直接写 `element.style.backgroundColor` 这类视觉属性。
- 统一使用 `src/utils/dom.ts` 的工具：
  - `setClass(el, className, condition)` — 按布尔值增删 class
  - `setCSSVar(el, prop, value)` / `removeCSSVar(el, prop)` — 设置 / 移除 CSS 变量（自动补 `--`）
  - `ClassTracker` — 跟踪已加 class，`cleanup()` 统一清理
  - `DOMPoller` / `waitForElement` — 等待 Obsidian 动态 DOM 就绪（默认 200ms × 最多 50 次）
- 主题变量从 `getComputedStyle(document.body)` 读取，不从 `element.style` 读取。
- 新增的 Timer / Observer / 事件监听，必须在 `unload()` / 返回的清理函数中对称清理。

## 9. 主题、动效与响应式

- **深 / 浅色**：只通过 `.theme-dark` / `.theme-light` 覆盖 `--zd-*` Token；组件 CSS 不写 `if (dark)` 判断，也不写两套色值。
- **reduced-motion**：动画与过渡必须尊重 `@media (prefers-reduced-motion: reduce)`（unified-ui.css 已有统一降级：`animation-duration: 0.01ms`）。
- **响应式**：用 media query（约定断点见 §3.5）；移动端关闭背景模糊等重效果；触控目标不小于 32px。
- **层级**：弹层 / 弹窗使用 `--zd-z-*`，不硬编码 z-index。

## 10. 开发检查清单

新增或改动任何界面 / 控件前：

- [ ] 颜色 / 阴影 / 圆角 / 间距全部来自 `--zd-*` / `--zd-ui-*` Token，无硬编码数值
- [ ] 新 surface 有唯一根类名，并已在 `css/ui/unified-ui.css` 补本地变量 → `--zd-ui-*` 映射
- [ ] 同类控件已查复用清单，未重复造轮子
- [ ] 主 / 危险按钮用了 `mod-cta` / `mod-warning`（或 `setCta()` / `setWarning()`）
- [ ] 所有可交互控件有 `:focus-visible` 焦点环
- [ ] 深色 / 浅色两态均已验证
- [ ] 尊重 `prefers-reduced-motion`
- [ ] 新增 Timer / Observer / 事件在 `unload()` 中对称清理
- [ ] `npm run check && npm run build` 通过

## 11. 参考文件

| 文件 | 内容 |
| --- | --- |
| `css/design-system.css` | 全部 `--zd-*` 设计 Token、`--zd-ui-*` 别名、基础原语与工具类 |
| `css/ui/unified-ui.css` | 统一 UI 语义层：各 surface → `--zd-ui-*` 的映射 |
| `css/ui/style-settings-ui.css` | 设置页消费方式示例 |
| `css/overlays/homepage.css` / `console-enhanced.css` | 首页 / 项目控制台消费方式示例 |
| `src/utils/dom.ts` | `setCSSVar` / `ClassTracker` / `DOMPoller` 等 JS 工具 |
| `src/ui/confirm-modal.ts` / `popout-form.ts` | 弹窗 / 弹出面板复用件 |
| `src/homepage/components/` | 卡片、筛选栏、图表等组件写法示例 |
