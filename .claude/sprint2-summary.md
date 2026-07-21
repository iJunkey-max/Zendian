# Sprint 2 完成总结

## ✅ 已完成任务

### 1. 核心服务集成到插件主类

**修改文件**: `src/main.ts`

**新增内容**:
```typescript
// 导入三个新服务
import { ActivityLogService } from "./services/ActivityLogService";
import { ProjectMetadataService } from "./services/ProjectMetadataService";
import { TaskSyncService } from "./services/TaskSyncService";

// 在插件类中声明服务实例（public，可被视图访问）
public activityLogService!: ActivityLogService;
public projectMetadataService!: ProjectMetadataService;
public taskSyncService!: TaskSyncService;

// onload() 中初始化
this.activityLogService = new ActivityLogService(this.app);
this.projectMetadataService = new ProjectMetadataService(this.app);
this.taskSyncService = new TaskSyncService(this.app);
await this.activityLogService.load();

// 监听 vault 事件自动记录活动
this.registerEvent(this.app.vault.on("create", ...));  // 记录创建笔记
this.registerEvent(this.app.vault.on("modify", ...));  // 记录编辑文件

// onunload() 中清理
this.activityLogService?.flush();  // 强制保存
```

**效果**:
- ✅ 三个服务在插件加载时初始化
- ✅ 活动日志自动记录创建和编辑事件
- ✅ 插件卸载时自动保存日志
- ✅ 视图可通过 `this.app.plugins.plugins.zendian.activityLogService` 访问服务

### 2. 测试数据部署

**目标位置**: `C:\Users\Junkey\Desktop\Test\`

**已部署内容**:
- 10 个完整项目（5 个类型文件夹）
- ~150 个任务（Timeline.md，带 @due/@priority 标记）
- 90 天活动日志（activity-log.json）
- 5 个便签（homepage-data.json）
- README.md 说明文档

**验证方法**:
```powershell
# 检查项目文件夹
ls "C:\Users\Junkey\Desktop\Test\10.学习"

# 检查活动日志
cat "C:\Users\Junkey\Desktop\Test\.obsidian\plugins\zendian\activity-log.json"

# 检查项目元数据
cat "C:\Users\Junkey\Desktop\Test\10.学习\前端架构设计\00 控制台\前端架构设计.home"
```

---

## 🎯 下一步：Sprint 3 - 主页核心交互

### Day 5: 待办原地勾选

#### 目标
让主页的待办列表支持**原地勾选**，点击复选框直接修改 Timeline.md 文件，无需跳转。

#### 实施计划

**文件**: `src/homepage/HomepageView.ts`

**步骤 1: 修改待办数据加载**
```typescript
private async loadTodos(): Promise<void> {
  const plugin = (this.app as any).plugins?.plugins?.zendian;
  if (!plugin?.taskSyncService) return;

  const settings = plugin.settingsManager.getSettings();
  const typeFolders = settings?.homepage?.projectTypeFolders || "";
  
  // 获取所有项目路径
  const projectPaths = await this.getProjectPaths(typeFolders);
  
  // 使用 TaskSyncService 获取所有任务
  const allTasks = await plugin.taskSyncService.getAllTasks(projectPaths);
  
  // 根据 currentTodoTab 过滤任务
  let filteredTasks = allTasks;
  if (this.currentTodoTab === "today") {
    filteredTasks = plugin.taskSyncService.filterTodayDue(allTasks);
  } else if (this.currentTodoTab === "week") {
    filteredTasks = plugin.taskSyncService.filterWeekDue(allTasks);
  } else if (this.currentTodoTab === "done") {
    filteredTasks = allTasks.filter(t => t.completed);
  }
  
  // 渲染任务列表
  this.renderTaskList(filteredTasks);
}
```

**步骤 2: 渲染任务时绑定点击事件**
```typescript
private renderTaskList(tasks: Task[]): void {
  const list = this.containerEl.querySelector('[data-section="todo"] .homepage-todo-list');
  if (!list) return;

  list.empty();

  for (const task of tasks) {
    const item = list.createDiv({ cls: "homepage-todo-item" });
    
    // 左侧：复选框
    const checkbox = item.createDiv({
      cls: `homepage-todo-checkbox${task.completed ? " homepage-todo-checkbox--done" : ""}`
    });
    
    // 绑定点击事件 → 调用 TaskSyncService
    checkbox.addEventListener("click", async (e) => {
      e.stopPropagation();
      await this.toggleTask(task);
    });
    
    // 中间：任务文本
    const text = item.createSpan({
      cls: `homepage-todo-text${task.completed ? " homepage-todo-text--done" : ""}`,
      text: task.text
    });
    
    // 点击文本 → 跳转到 Timeline.md
    text.addEventListener("click", () => {
      this.openFileAndScroll(task.projectPath + "/00 控制台/Timeline.md", task.line);
    });
    
    // 右侧：标签 + 日期
    // ...
  }
}
```

**步骤 3: 实现 toggleTask 方法（乐观更新 + 错误回滚）**
```typescript
private async toggleTask(task: Task): Promise<void> {
  const plugin = (this.app as any).plugins?.plugins?.zendian;
  if (!plugin?.taskSyncService) return;

  // 1. 乐观更新 UI（立即反馈）
  const checkbox = this.containerEl.querySelector(`[data-task-id="${task.projectPath}:${task.line}"]`);
  if (checkbox) {
    checkbox.toggleClass("homepage-todo-checkbox--done");
  }

  // 2. 调用 TaskSyncService 修改文件
  const success = await plugin.taskSyncService.toggleTask(task.projectPath, task.line);

  // 3. 如果失败，回滚 UI
  if (!success) {
    if (checkbox) {
      checkbox.toggleClass("homepage-todo-checkbox--done");
    }
    // 显示错误提示
    new Notice("任务状态更新失败");
  } else {
    // 记录活动日志
    if (!task.completed) {
      plugin.activityLogService.logActivity("task_completed", task.projectPath);
    }
    
    // 重新加载任务列表（更新计数）
    this.loadTodos();
  }
}
```

**步骤 4: 辅助方法 - 获取项目路径列表**
```typescript
private async getProjectPaths(typeFolders: string): Promise<string[]> {
  const paths: string[] = [];
  const folders = typeFolders.split(",").map(f => f.trim()).filter(Boolean);
  
  for (const typeFolder of folders) {
    const folder = this.app.vault.getAbstractFileByPath(typeFolder);
    if (folder instanceof TFolder) {
      for (const child of folder.children) {
        if (child instanceof TFolder) {
          paths.push(child.path);
        }
      }
    }
  }
  
  return paths;
}
```

#### 测试验证

**测试用例**:
1. 打开主页 → 待办列表显示所有项目的任务
2. 点击复选框 → Timeline.md 文件内容立即更新
3. 切换 Tab（今天/本周/已完成）→ 任务正确过滤
4. 点击任务文本 → 跳转到 Timeline.md 并高亮对应行

**性能要求**:
- 勾选响应时间 <100ms
- 大量任务（100+）时不卡顿

---

### Day 6: 便签编辑弹窗

#### 目标
双击便签弹出编辑器，支持 Markdown 实时预览，自动保存。

#### 实施计划

**新建文件**: `src/homepage/components/QuickNoteEditorModal.ts`

**核心功能**:
- 分栏布局：左侧编辑器 + 右侧预览
- 实时渲染 Markdown（使用 Obsidian 的 MarkdownRenderer）
- 自动保存（1 秒防抖）
- 键盘快捷键（Esc 关闭，Ctrl+S 立即保存）

**代码框架**:
```typescript
import { App, Modal, TextAreaComponent, MarkdownRenderer } from "obsidian";

export class QuickNoteEditorModal extends Modal {
  private content: string;
  private noteId: string;
  private onSave: (id: string, content: string) => Promise<void>;
  
  private textArea!: HTMLTextAreaElement;
  private previewEl!: HTMLElement;
  private saveDebounce: number | null = null;

  constructor(
    app: App,
    noteId: string,
    initialContent: string,
    onSave: (id: string, content: string) => Promise<void>
  ) {
    super(app);
    this.noteId = noteId;
    this.content = initialContent;
    this.onSave = onSave;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("quicknote-editor-modal");

    // 标题
    contentEl.createEl("h2", { text: "编辑便签" });

    // 分栏容器
    const container = contentEl.createDiv({ cls: "quicknote-editor-container" });

    // 左侧：编辑器
    const editorPane = container.createDiv({ cls: "quicknote-editor-pane" });
    this.textArea = editorPane.createEl("textarea", {
      cls: "quicknote-textarea",
      value: this.content,
    });

    // 右侧：预览
    const previewPane = container.createDiv({ cls: "quicknote-preview-pane" });
    this.previewEl = previewPane.createDiv({ cls: "quicknote-preview" });

    // 初始预览
    this.updatePreview();

    // 监听输入 → 防抖保存 + 更新预览
    this.textArea.addEventListener("input", () => {
      this.content = this.textArea.value;
      this.scheduleSave();
      this.updatePreview();
    });

    // 键盘快捷键
    this.textArea.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.close();
      } else if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.save();
      }
    });

    // 自动聚焦
    setTimeout(() => this.textArea.focus(), 50);
  }

  private updatePreview(): void {
    this.previewEl.empty();
    MarkdownRenderer.renderMarkdown(
      this.content,
      this.previewEl,
      "",
      null as any
    );
  }

  private scheduleSave(): void {
    if (this.saveDebounce !== null) {
      window.clearTimeout(this.saveDebounce);
    }
    this.saveDebounce = window.setTimeout(() => {
      this.save();
      this.saveDebounce = null;
    }, 1000);
  }

  private async save(): Promise<void> {
    await this.onSave(this.noteId, this.content);
  }

  onClose(): void {
    // 确保最后的更改已保存
    if (this.saveDebounce !== null) {
      window.clearTimeout(this.saveDebounce);
      this.save();
    }
    this.contentEl.empty();
  }
}
```

**集成到 HomepageView**:
```typescript
// 双击便签 → 弹出编辑器
noteEl.addEventListener("dblclick", () => {
  const plugin = (this.app as any).plugins?.plugins?.zendian;
  const dataService = plugin?.homepageDataService;
  
  new QuickNoteEditorModal(
    this.app,
    note.id,
    note.content || "",
    async (id, content) => {
      await dataService.updateQuickNoteContent(id, content);
      this.loadStickyNotes();  // 重新渲染
    }
  ).open();
});
```

---

### Day 7: 项目筛选器 + 每日回顾真实数据

#### 任务 A: 项目筛选器

**新建文件**: `src/homepage/components/ProjectFilterBar.ts`

**功能**:
- 状态筛选：全部 / 进行中 / 暂停 / 已完成
- 排序选项：最近更新 / 优先级 / 完成度 / 截止时间

#### 任务 B: 每日回顾真实数据

**修改**: `src/homepage/HomepageView.ts` 的 `loadDailyReviewStats()` 方法

**数据来源**:
```typescript
const plugin = (this.app as any).plugins?.plugins?.zendian;
const activity = plugin.activityLogService;
const taskService = plugin.taskSyncService;

// 今日活动
const today = activity.getTodayActivity();

// 任务统计（需要聚合所有项目）
const allProjects = await this.getProjectPaths(typeFolders);
const allTasks = await taskService.getAllTasks(allProjects);
const completedToday = allTasks.filter(t => 
  t.completed && isToday(t.completedAt)
);

// 元气值计算
const score = Math.min(100,
  today.created * 20 +
  completedToday.length * 15 +
  today.edited * 5 +
  consecutiveDays * 5
);
```

---

## 📊 当前进度

- **Sprint 1** (Day 1-3): ✅ 完成
- **Sprint 2** (Day 4): ✅ 完成
- **Sprint 3** (Day 5-7): 🔄 准备中
  - Day 5: 待办原地勾选
  - Day 6: 便签编辑弹窗
  - Day 7: 项目筛选 + 每日回顾

**总进度**: 4/18 天 (~22%)

---

## 🧪 测试环境

**测试 Vault 位置**: `C:\Users\Junkey\Desktop\Test\`

**验证清单**:
- [ ] 在 Obsidian 中打开测试 vault
- [ ] 启用 ZENdian 插件
- [ ] 打开主页，查看待办列表
- [ ] 点击复选框，验证 Timeline.md 文件更新
- [ ] 双击便签，验证编辑器弹出
- [ ] 切换项目筛选器，验证列表更新

---

## 💡 关键技术要点

### 1. 访问插件服务

在视图中访问服务：
```typescript
const plugin = (this.app as any).plugins?.plugins?.zendian;
const activityLog = plugin?.activityLogService;
const taskSync = plugin?.taskSyncService;
const projectMeta = plugin?.projectMetadataService;
```

### 2. 乐观更新 UI

先更新 UI（用户立即看到反馈），再异步修改文件，失败时回滚。

### 3. 防抖保存

用户编辑时不立即保存，等待 1 秒无操作后自动保存。

---

下一步：开始实施 Day 5 - 待办原地勾选功能！
