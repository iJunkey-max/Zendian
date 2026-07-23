# ZENdian 官方关系图谱美化：技术与 UI 设计方案

> 状态：已恢复官方图谱增强路线
>
> 目标环境：Obsidian 1.12.7+
> 范围：官方 `graph` 与 `localgraph` 视图

## 1. 方案结论

ZENdian 不再注册独立知识图谱，不再维护 Vault 图索引、d3-force 布局或 PixiJS 场景。图谱的数据、节点、连线、搜索、筛选、分组、显示、力导向、拖拽和缩放全部由 Obsidian 官方实现。

插件只在官方图谱 View 的 `containerEl` 上添加作用域类名、背景变量和 CSS 氛围层。节点颜色、形状、尺寸、聚焦状态与交互均由 Obsidian 官方 Renderer 完整负责。

## 2. 模块结构

```text
PluginSettings.graph
        │
        ▼
GraphModule ── layout / theme / settings events
        │
        ├─ graph leaf.containerEl
        ├─ localgraph leaf.containerEl
        └─ graph.css
             ├─ nebula color variables
             ├─ filament nebula and star dust atmosphere
             └─ native controls visual polish
```

`GraphModule` 只遍历已经实例化的 `graph` 和 `localgraph` 叶子，不调用 `setViewState`，因此不会强制加载隐藏的 DeferredView。样式挂在叶子自身容器上，主区域、侧栏和弹出窗口分别使用正确的 document 与主题环境。

## 3. 视觉系统

- 节点、焦点节点、标签、附件与未解析节点均使用 Obsidian 官方颜色和圆点样式。
- ZENdian 不再修改节点对象、Sprite、透明度或节点颜色变量。
- 三组径向/锥形渐变与原始生成素材加工得到的 `nebula-filament.png` 丝状星云蒙版组成低透明度星云，星尘由低密度径向纹理生成。
- 桌面端星云使用 48 秒与 72 秒基础周期缓慢位移、旋转和非等比变形。
- 移动端、低性能模式和 `prefers-reduced-motion` 下动画完全停止。
- 氛围层 `pointer-events: none`，不会覆盖官方图谱鼠标交互。

## 4. 官方控制面板

原生控制面板的结构、顺序和功能保持不变，仅调整视觉：248px 宽度、12px 圆角和内边距、半透明表面、细边框、主题阴影与强调色焦点环。紧凑模式将输入控件高度收敛到 32px；移动端关闭背景模糊。

## 5. 设置

入口：`设置 → ZENdian → 工作区 → 关系图谱`。

- 关系图谱美化
- 星云浓度
- 星云持续漂移
- 漂移速度
- 显示星尘
- 局部图谱增强
- 紧凑控制面板
- 恢复默认

## 6. 安全边界

- 不注册自定义图谱 ItemView。
- 不读取或写入 `.obsidian/graph.json`。
- Bridge 只访问官方节点数组与节点 Sprite 的 texture/tint/alpha；所有访问集中在单文件中并可完整恢复。
- 不创建第二套 Canvas、坐标同步器或连线覆盖层。
- 不创建逐帧 JavaScript 动画。
- 不改变官方节点命中区域、拖拽、缩放或按钮事件。
- 设置或主题变化时只请求一次官方 CSS 调色板刷新，禁止逐帧刷新。

## 7. 验收

运行 `npm run check` 与 `npm run build`，并在真实 Obsidian 中验证浅色/深色、全局/局部、主区域/侧栏/弹出窗口、控制面板、节点拖拽、画布缩放、移动端和 reduced-motion。关闭总开关后不得残留类名、变量、事件或氛围层。
