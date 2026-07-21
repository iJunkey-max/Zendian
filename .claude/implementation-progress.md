# ZENdian 主页系统重构 - 实施进度

## ✅ 已完成

### Sprint 1 - Day 1-3: 数据层基础

#### 核心服务层

**ActivityLogService** (`src/services/ActivityLogService.ts`)
- ✅ 记录每日活动（创建笔记、编辑文件、完成任务）
- ✅ 计算每日/每月统计数据
- ✅ 生成热力图数据（最近 N 天）
- ✅ 获取趋势数据（用于折线图）
- ✅ 计算连续活跃天数
- ✅ 自动清理 365 天前的旧数据
- ✅ 防抖保存（2 秒）

**ProjectMetadataService** (`src/services/ProjectMetadataService.ts`)
- ✅ 读取和更新 .home 文件完整结构
- ✅ 管理项目状态（active/paused/completed/archived）
- ✅ 管理项目优先级（low/medium/high/urgent）
- ✅ 管理项目标签、协作者、依赖关系
- ✅ 里程碑管理（增删改查）
- ✅ 交付物管理（增删改查）
- ✅ 自动更新 updatedAt 字段

**TaskSyncService** (`src/services/TaskSyncService.ts`)
- ✅ 从 Timeline.md 解析任务
- ✅ 支持任务标记：@due(日期)、@priority(级别)、@created(日期)
- ✅ 切换任务完成状态（直接修改 Timeline.md）
- ✅ 添加/删除任务
- ✅ 任务统计（总数、已完成、逾期、今日到期）
- ✅ 任务过滤（今天/本周/逾期）
- ✅ 任务排序（优先级/截止日期）
- ✅ 聚合所有项目的任务（用于主页待办）

#### 测试数据生成

**generate-test-vault.mjs** (`scripts/generate-test-vault.mjs`)
- ✅ 生成 10 个项目（分布在 5 个类型文件夹）
- ✅ 每个项目包含完整文件结构
  - .home 文件（含状态、优先级、标签、里程碑）
  - Timeline.md（10-20 个任务，部分已完成，带标记）
  - Overview.md（项目概览）
  - 5-10 条笔记
  - 2-5 个交付物
- ✅ 生成 90 天活动日志（模拟真实使用）
- ✅ 生成 5 个便签（不同分类和颜色）
- ✅ 自动创建 README 说明文档

---

## 📋 下一步计划

### Sprint 2 - Day 4: 集成服务到插件

**任务清单**
- [ ] 修改 `src/main.ts` — 初始化三个服务
  ```typescript
  private activityLogService: ActivityLogService;
  private projectMetadataService: ProjectMetadataService;
  private taskSyncService: TaskSyncService;
  ```
- [ ] 监听 vault 事件 — 自动记录活动
  - `vault.on("create")` → 记录创建笔记
  - `vault.on("modify")` → 记录编辑文件
- [ ] 传递服务到 HomepageView 和 ProjectConsoleView
- [ ] 运行测试数据生成脚本

### Sprint 3 - Day 5-7: 主页核心交互

**Day 5: 待办原地勾选**
- [ ] 修改 `HomepageView.renderTodo()`
  - 集成 `TaskSyncService`
  - 复选框绑定点击事件
  - 乐观更新 UI + 错误回滚
- [ ] 添加快速跳转功能
  - 点击任务文本 → 打开 Timeline.md 并高亮行

**Day 6: 便签编辑弹窗**
- [ ] 创建 `QuickNoteEditorModal.ts`
  - Markdown 实时预览（分栏布局）
  - 自动保存（1 秒防抖）
  - 键盘快捷键（Esc 关闭，Ctrl+S 保存）
- [ ] 修改 `HomepageView.renderStickyNotes()`
  - 双击事件绑定
  - 显示编辑时间

**Day 7: 项目筛选器 + 每日回顾真实数据**
- [ ] 创建 `ProjectFilterBar.ts` 组件
  - 状态筛选（全部/进行中/暂停/已完成）
  - 排序选项（最近更新/优先级/完成度）
- [ ] 修改 `loadDailyReviewStats()`
  - 从 `ActivityLogService` 读取真实数据
  - 计算元气值（公式已定义）
  - 添加点击钻取功能

---

## 🧪 测试数据使用指南

### 生成测试数据

```bash
# 在项目根目录运行
node scripts/generate-test-vault.mjs ./test-vault

# 或指定自定义路径
node scripts/generate-test-vault.mjs "C:/Users/YourName/Documents/ObsidianVaults/ZENdian-Test"
```

### 测试数据内容

生成的 vault 包含：

**项目（10个）**
```
10.学习/
  ├── 前端架构设计/          [状态: active, 优先级: high]
  ├── TypeScript 进阶/        [状态: active, 优先级: medium]
  └── Obsidian 插件开发/      [状态: active, 优先级: high]

20.工作/
  ├── Q2 产品迭代/            [状态: active, 优先级: urgent]
  └── 客户需求分析/           [状态: paused, 优先级: high]

30.创作/
  ├── 博客写作计划/           [状态: active, 优先级: medium]
  └── 开源项目/              [状态: active, 优先级: medium]

40.生活/
  └── 健康管理/              [状态: active, 优先级: medium]

50.研究/
  ├── AI 工具调研/            [状态: active, 优先级: high]
  └── Rust 生态探索/          [状态: paused, 优先级: low]
```

**每个项目包含**
- `.home` 文件：完整的项目元数据
- `Timeline.md`：10-20 个任务（部分完成，带 @due/@priority 标记）
- `Overview.md`：项目概览
- `10 笔记流/`：5-10 条笔记
- `30 交付物/`：2-5 个交付物文件

**活动日志**
- 90 天的历史数据
- 每日统计：创建笔记数、编辑次数、完成任务数、专注时长
- 存储路径：`.obsidian/plugins/zendian/activity-log.json`

**便签（5个）**
- 周会待办（黄色，置顶）
- 灵感收集（蓝色）
- 购物清单（绿色）
- 学习计划（粉色，置顶）
- 待办事项（紫色）

### 验证数据生成

生成完成后，检查以下文件：

```bash
test-vault/
├── README.md                                    # 生成的说明文档
├── 10.学习/前端架构设计/
│   ├── 00 控制台/
│   │   ├── 前端架构设计.home                    # 项目元数据
│   │   ├── Timeline.md                         # 任务列表
│   │   └── Overview.md                         # 项目概览
│   ├── 10 笔记流/
│   │   ├── 笔记-1.md
│   │   └── ...
│   └── 30 交付物/
│       └── deliverable-1.md
├── .obsidian/plugins/zendian/
│   ├── activity-log.json                       # 活动日志
│   └── homepage-data.json                      # 主页数据（便签）
└── 便签/
    ├── 周会待办.md
    └── ...
```

### 在 Obsidian 中使用

1. 打开 Obsidian
2. 选择「打开另一个 vault」→「打开文件夹作为 vault」
3. 选择生成的 `test-vault` 目录
4. 启用 ZENdian 插件（需要先在开发版本中构建并复制到 vault）
5. 打开主页（命令面板 → "打开主页"）

---

## 🎯 当前焦点

**立即行动**
1. ✅ 运行测试数据生成脚本
2. 🔄 集成服务到插件主类
3. 🔄 实现待办原地勾选功能

**验证指标**
- 测试数据生成成功（10 个项目 + 90 天日志）
- 服务初始化无错误
- 待办勾选响应时间 <100ms

---

## 📊 进度统计

- **总任务**: 56
- **已完成**: 3 个核心服务 + 测试数据生成
- **进度**: ~7%
- **预计完成**: Day 18（还需 15 天）

---

## 💡 技术要点

### .home 文件结构示例

```json
{
  "name": "前端架构设计",
  "icon": "lucide-book-open",
  "description": "深入学习前端架构设计模式，提升系统设计能力",
  "type": "学习",
  "status": "active",
  "createdAt": "2026-04-10",
  "updatedAt": "2026-07-03",
  "metadata": {
    "priority": "high",
    "tags": ["重要", "长期"],
    "collaborators": [],
    "dependencies": [],
    "deadline": "2026-08-15"
  },
  "viewConfig": {
    "pinnedFiles": [],
    "hiddenFolders": [],
    "customSections": []
  },
  "milestones": [
    {
      "id": "milestone-1720608000000-0",
      "title": "阶段 1 - 需求分析",
      "deadline": "2026-08-20",
      "completed": true,
      "deliverables": [],
      "createdAt": "2026-05-10"
    }
  ],
  "deliverables": [
    {
      "name": "交付物 1",
      "path": "30 交付物/deliverable-1.md",
      "status": "done"
    }
  ]
}
```

### Timeline.md 任务格式

```markdown
# 前端架构设计 - 任务时间线

- [x] 阅读《架构设计》第 3 章 @created(2026-06-15) @priority(high)
- [ ] 完成 模块B 的代码实现 @created(2026-06-20) @due(2026-07-15)
- [ ] 编写 功能A 的技术文档 @created(2026-06-25)
- [x] 进行 组件C 功能的测试验证 @created(2026-06-10) @priority(medium)
```

### 活动日志数据结构

```json
{
  "dailyActivities": {
    "2026-07-10": {
      "date": "2026-07-10",
      "noteCreated": 3,
      "noteEdited": 12,
      "taskCompleted": 5,
      "fileOpened": 18,
      "focusMinutes": 120
    }
  },
  "lastSyncTime": 1720608000000
}
```

---

## 🔄 下次更新

下一个检查点将在完成待办原地勾选功能后更新。

**预计时间**: Day 5 结束
**交付物**: 可用的待办勾选功能 + 快速跳转

---

最后更新：2026-07-10 (Sprint 1 完成)
