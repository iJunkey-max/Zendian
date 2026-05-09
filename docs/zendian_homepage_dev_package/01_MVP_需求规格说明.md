# 01 MVP 需求规格说明

## 1. 功能名称

ZENdian Homepage / 主页控制台 / 新标签页增强系统

## 2. 版本定位

建议版本号：`v2.2.0`

原因：这是一个新增大功能，不是 bugfix，也不是纯样式修订。

## 3. 产品目标

把 Obsidian 的空白新标签页从“被动 empty state”升级为 ZENdian 的统一入口页，提供搜索、近期文件、知识库状态与快捷入口。

## 4. MVP 功能范围

### 4.1 主页视图

- 注册自定义视图：`zendian-homepage-view`
- 继承 `ItemView`
- 显示名称：`ZENdian Homepage`
- 支持命令面板打开
- 支持在新 leaf 中打开

### 4.2 新标签页接管

- 监听 `active-leaf-change`
- 当 leaf 的 view type 为 `empty` 时，替换为 Homepage view
- 设置项可关闭
- 防止重复替换和无限触发

### 4.3 Omnibox 搜索

- 首页顶部提供搜索框
- 支持搜索文件名、路径
- 支持 `ext:md`、`ext:canvas` 简单过滤
- 点击结果打开文件
- 无结果时支持创建同名 Markdown 文件

### 4.4 最近文件

- 默认展示最近修改文件 10 条
- 支持设置展示数量
- 点击文件打开
- 展示文件路径、相对修改时间

### 4.5 统计卡片

- 总文件数
- Markdown 文件数
- Canvas 文件数
- 今日修改数
- Vault 总大小

### 4.6 快捷入口

MVP 只做固定的快捷按钮：

- 新建笔记
- 打开命令面板
- 打开图谱
- 打开设置

不做自定义快捷入口编辑器。

## 5. 非 MVP 范围

- 拖拽布局
- Widget 市场
- Weather / Quote
- Task radar
- Bases database parser
- Dataview adapter
- Shadow DOM 小组件
- 外部插件 Hook API
- 移动端独立布局树

## 6. 用户设置项

```ts
homepage: {
  enabled: boolean;
  replaceEmptyTab: boolean;
  openOnStartup: boolean;
  focusSearchOnOpen: boolean;
  showStats: boolean;
  showRecentFiles: boolean;
  recentFileLimit: number;
  showQuickActions: boolean;
  enableCreateFromSearch: boolean;
  defaultCreateFolder: string;
}
```

## 7. 默认设置

```ts
homepage: {
  enabled: true,
  replaceEmptyTab: false,
  openOnStartup: false,
  focusSearchOnOpen: true,
  showStats: true,
  showRecentFiles: true,
  recentFileLimit: 10,
  showQuickActions: true,
  enableCreateFromSearch: true,
  defaultCreateFolder: ""
}
```

注意：`replaceEmptyTab` MVP 默认建议为 `false`，避免用户升级后突然改变工作流。用户确认后再开启。

## 8. 验收标准

- 插件启用后无控制台错误
- 命令面板可以打开 Homepage
- 开启 `replaceEmptyTab` 后，新建空白页自动变为 Homepage
- 关闭 `replaceEmptyTab` 后，Obsidian 原生空白页恢复
- Omnibox 可以检索文件
- 点击搜索结果能打开文件
- 无结果创建文件功能可用
- 最近文件排序正确
- Vault 文件变更后首页数据可刷新
- 卸载插件后事件监听与视图清理正常
