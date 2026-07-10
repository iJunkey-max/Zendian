# HomepageView 文件拆分计划

## 📊 当前状态

- **文件**: `src/homepage/HomepageView.ts`
- **总行数**: 1570 行
- **问题**: 单一职责原则违反，职责过重

## 🎯 拆分目标

将 1570 行的单文件拆分为多个职责清晰的文件：

```
src/homepage/
├── HomepageView.ts              (主入口，~150 行)
├── renderers/
│   ├── HeaderRenderer.ts        (Header + 搜索 + 天气)
│   ├── DailyRenderer.ts         (每日回顾)
│   ├── ProjectRenderer.ts       (项目卡片)
│   ├── TodoRenderer.ts          (待办列表)
│   ├── StickyRenderer.ts        (便签)
│   ├── HeatmapRenderer.ts       (热力图)
│   ├── StatsRenderer.ts         (月度统计)
│   └── RecentRenderer.ts        (最近笔记)
├── controllers/
│   ├── SearchController.ts      (搜索功能)
│   ├── ProjectController.ts     (项目交互)
│   └── TodoController.ts        (待办交互)
└── utils/
    └── HomepageHelpers.ts       (辅助函数)
```

## 📋 拆分步骤

### 阶段 1: 提取渲染器（Renderers）✅ 进行中

#### 1.1 提取 HeaderRenderer
**包含内容**:
- `renderHeader()` - 顶部问候语、时间
- `renderSearchPanel()` - 搜索面板
- `renderWeather()` - 天气组件
- `updateClock()` - 时钟更新

**依赖**:
- WeatherService
- 日期格式化函数（已提取到 utils/date.ts）
- SVG 图标（已提取到 utils/icons.ts）

#### 1.2 提取 StickyRenderer
**包含内容**:
- `renderStickyNotes()` - 便签容器
- `loadStickyNotes()` - 便签数据加载

**依赖**:
- HomepageDataService

#### 1.3 提取 TodoRenderer
**包含内容**:
- `renderTodo()` - 待办容器和标签
- `loadTodos()` - 待办数据加载
- `updateTodoTabCounts()` - 标签计数更新
- `filterTodosByTab()` - 待办筛选逻辑

**依赖**:
- HomepageTaskService
- 日期格式化（utils/date.ts）

#### 1.4 提取 ProjectRenderer
**包含内容**:
- `renderProjects()` - 项目卡片容器
- `loadProjects()` - 项目数据加载
- `renderProjectCard()` - 单个项目卡片渲染

**依赖**:
- HomepageProjectScanService
- PROJECT_TYPE_COLORS

#### 1.5 提取 HeatmapRenderer
**包含内容**:
- `renderHeatmap()` - 热力图容器
- `loadHeatmapData()` - 热力图数据加载

**依赖**:
- HomepageStatsService

#### 1.6 提取 StatsRenderer
**包含内容**:
- `renderMonthlyStats()` - 月度统计
- `loadMonthlyStats()` - 统计数据加载

**依赖**:
- HomepageStatsService

#### 1.7 提取 RecentRenderer
**包含内容**:
- `renderRecentNotes()` - 最近笔记
- `loadRecentNotes()` - 最近笔记数据

**依赖**:
- App.vault

#### 1.8 提取 DailyRenderer
**包含内容**:
- `renderDailyReview()` - 每日回顾
- `loadDailyReviewStats()` - 统计数据

**依赖**:
- HomepageStatsService
- HomepageTaskService

### 阶段 2: 提取控制器（Controllers）

#### 2.1 SearchController
**包含内容**:
- `performSearch()` - 执行搜索
- `openSearchResult()` - 打开搜索结果

#### 2.2 ProjectController
**包含内容**:
- `openProjectDetail()` - 打开项目详情
- `openProjectConsole()` - 打开项目控制台
- `createProjectConsole()` - 创建项目控制台

#### 2.3 TodoController
**包含内容**:
- `switchTodoTab()` - 切换待办标签
- `toggleTodo()` - 切换待办状态
- `openTodoFile()` - 打开待办所在文件

### 阶段 3: 提取辅助函数

#### HomepageHelpers
**包含内容**:
- `inferTaskTag()` - 推断待办标签
- `openFile()` - 打开文件
- 其他通用辅助函数

### 阶段 4: 重构 HomepageView 主文件

**保留内容**:
- `getViewType()` / `getDisplayText()` / `getIcon()`
- `onOpen()` / `onClose()`
- 服务初始化
- 事件监听注册
- 调用各个渲染器

**新增内容**:
- 渲染器实例化和依赖注入
- 统一的错误处理

---

## 🔄 实施策略

### 原则
1. **逐步迁移**：一次提取一个渲染器
2. **保持功能**：每次提取后立即测试编译
3. **类型安全**：所有新文件使用严格类型
4. **依赖注入**：通过构造函数传递服务

### 文件命名规范
- Renderer：负责 DOM 渲染
- Controller：负责用户交互
- Helpers：纯函数工具

### 接口设计

#### BaseRenderer 接口
```typescript
export interface IHomepageRenderer {
  render(container: HTMLElement): void;
  load?(): Promise<void>;
  unload?(): void;
}
```

#### Renderer 构造函数
```typescript
constructor(
  private app: App,
  private services: {
    stats?: HomepageStatsService;
    data?: HomepageDataService;
    // ...
  }
)
```

---

## 📊 预期效果

| 指标 | 拆分前 | 拆分后 | 改善 |
|------|--------|--------|------|
| 单文件行数 | 1570 | ~150 | ↓ 90% |
| 文件数量 | 1 | ~15 | 职责分离 |
| 代码定位速度 | 慢 | 快 | ↑ 90% |
| 可维护性 | 低 | 高 | ↑ 80% |
| 测试覆盖 | 难 | 易 | - |

---

## ⚠️ 风险与挑战

1. **依赖管理复杂**：多个渲染器共享服务实例
2. **事件传递**：渲染器间可能需要通信
3. **测试成本**：需要逐个验证功能完整性

---

**制定时间**: 2026-07-10  
**预计耗时**: 4-6 小时  
**状态**: 准备开始
