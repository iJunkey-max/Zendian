# ZENdian

ZENdian 是面向 Obsidian 的个人知识与项目工作区插件。它以智能主页为入口，将项目、任务、时间轴、文件快照和数据洞察连接在同一套工作流中，同时保留专注写作与界面增强能力。

当前正式版本：`V3.0.02 Lection`
最低 Obsidian 版本：`1.12.7`

> V3 是一次产品定位升级：ZENdian 的重点已从 UI 美化转向知识工作与项目推进。插件不提供第三方插件或第三方主题适配。

## 核心能力

### 智能主页

- 在统一入口查看项目、待办、最近笔记、书签、天气、活动热力图与月度统计。
- 支持项目分类、项目子文件夹和归档目录配置。
- 月度笔记、编辑、待办完成、活跃天数与专注时长使用统一活动记录实时刷新。
- 主页模块可按需开启，减少不需要的信息干扰。

### 项目管理

- 使用项目控制台集中查看项目简介、状态、进度、任务和近期活动。
- 项目简介、时间轴、里程碑与待办统一保存在 `项目主页.home`，减少项目附属文件。
- 支持规划中、实施中、复核中、已结束和暂停等明确状态。
- 项目分类和目录结构由设置驱动，便于建立稳定的工作区约定。

### 任务协同

- 支持任务优先级、标签、截止日期与时间。
- 主页只展示从主页和项目主页创建的待办，不再扫描项目 Markdown 文件。
- 待办先按 P0–P3 排序；同优先级按截止时间升序，无截止时间时按创建时间排序。
- 提供逾期识别、完成状态和趋势统计。

### 时间轴与项目快照

- 按时间记录文件、任务和项目状态事件。
- 为受支持的文本文件生成内容快照并进行哈希去重。
- 支持手动检查点、版本差异预览、删除文件恢复与安全回档。

### 数据洞察

- 提供活动热力图、任务趋势、完成率和项目健康度等视图。
- 通过统一数据服务与缓存机制降低重复扫描开销。

### 写作与界面

- 状态栏专注时钟支持目标、预设与自定义时长、暂停、继续、提前结束、完成和休息计时。
- 专注过程使用简洁图标控制，完成记录自动汇入主页专注时长统计。
- 专注模式、打字机滚动、紧凑阅读宽度、段落与标题排版。
- 代码块、引用、标注、列表、表格、嵌入、图像和页眉设置。
- 文件树图标、彩虹文件夹、自动隐藏、卡片布局与移动端布局。
- 明暗模式下使用独立可读性令牌，改善辅助文字和小字号内容的辨识度。

## V3 设置中心

- 顶部横向分类导航，默认首先展示“关于”。
- 分类包括工作区、编辑与阅读、标题与内容、文件与图标、主页和设备。
- 支持搜索、条件展开、基础/高级设置、单组重置和全部重置。
- 设置项与运行时功能保持一致，旧版无效字段会在加载时自动清理。
- “第三方插件适配”目前仅为“敬请期待”占位，不包含兼容代码。

## 安装

### 从 GitHub Release 安装

1. 打开最新的 [GitHub Release](https://github.com/iJunkey-max/Zendian/releases/latest)。
2. 下载 `main.js`、`styles.css` 和 `manifest.json`。
3. 创建目录：`<Vault>/.obsidian/plugins/zendian/`。
4. 将三个文件放入该目录。
5. 重启 Obsidian，在“设置 → 第三方插件”中启用 ZENdian。

### 使用 BRAT

1. 安装并启用 [BRAT](https://github.com/TfTHacker/obsidian42-brat)。
2. 执行命令 `BRAT: Add a beta plugin for testing`。
3. 输入仓库地址：`https://github.com/iJunkey-max/Zendian`。

### 从源码构建

```bash
git clone https://github.com/iJunkey-max/Zendian.git
cd Zendian
npm install
npm run build
```

常用命令：

| 命令 | 用途 |
| --- | --- |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run check:settings` | 设置字段、面板与消费者契约检查 |
| `npm run build:css` | 构建 `dist/styles.css` |
| `npm run build:js` | 构建 `dist/main.js` |
| `npm run build` | 完整生产构建 |
| `npm run dev` | 开发监听模式 |

## V2 升级到 V3

- 现有有效插件设置会继续保留并迁移。
- Style Settings 元数据入口已移除，所有设置统一在 ZENdian 设置面板管理。
- 已废弃或没有消费者的字段会从保存数据中清理。
- DB Folder、Projects、Surfing、Kanban、Calendar、Make.md、Checklist 等第三方插件适配代码已移除。
- 若升级后界面仍显示旧样式，请执行 `Ctrl+R` 或完全重启 Obsidian。

完整变化请查看 [CHANGELOG.md](CHANGELOG.md) 和 [V3.0.02 Lection Release Notes](RELEASE_NOTES_3.0.02.md)。

## 支持范围

- 支持 Obsidian `1.12.7` 及以上版本。
- 支持桌面、平板和手机布局。
- 支持 Obsidian 原生浅色与暗色模式。
- 不承诺第三方插件或第三方主题的视觉与行为兼容。

## 反馈

请通过 [GitHub Issues](https://github.com/iJunkey-max/Zendian/issues) 提交缺陷和功能建议。报告问题时建议附上 Obsidian 版本、操作系统、复现步骤和必要截图。

## 许可

[MIT License](LICENSE)
