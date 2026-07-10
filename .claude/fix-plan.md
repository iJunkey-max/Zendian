# ZENdian 代码修复计划

## 📋 修复优先级分级

### 🔴 P0 - 立即修复（影响功能/性能/安全）
1. Banner 模块类型安全问题
2. Banner 暴力轮询性能问题
3. 设置迁移缺失新字段
4. IconSystem ZIP 解压安全漏洞

### 🟡 P1 - 短期修复（功能完整性）
5. CalloutSettings 接口定义不完整
6. RainbowFolderSettings 缺少 colors 字段
7. 项目扫描服务增量更新
8. 主页便签功能实现

### 🟢 P2 - 中期改进（代码质量）
9. HomepageView 文件拆分
10. 错误处理统一化
11. 重复代码提取
12. 添加单元测试

---

## 🛠️ 详细修复方案

### P0-1: Banner 模块类型安全 + 性能优化

**文件**: `src/modules/banner.module.ts`

**问题**:
- 全部使用 `any` 类型
- 1秒轮询导致高 CPU 占用

**修复方案**:
```typescript
// 1. 添加正确的类型定义
import type { IFeatureModule, ModuleContext } from "../types/module.types";
import type { PluginSettings } from "../types/settings.types";
import { EventRef } from "obsidian";

export class BannerModule implements IFeatureModule {
  readonly id = "banner";
  readonly name = "页眉图片";
  
  private ctx!: ModuleContext;
  private eventRefs: EventRef[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private failedUrls = new Set<string>();
  private needsUpdate = false; // 脏标记

  // 2. 优化轮询机制
  async load(ctx: ModuleContext): Promise<void> {
    this.ctx = ctx;
    if (!ctx.getSettings().banner.enabled) return;

    // 事件驱动优先
    this.eventRefs.push(
      ctx.app.workspace.on('file-open', () => {
        this.needsUpdate = true;
      }),
      ctx.app.workspace.on('layout-change', () => {
        this.needsUpdate = true;
      }),
      ctx.app.metadataCache.on('changed', (file: TFile) => {
        const activeFile = this.ctx.app.workspace.getActiveFile();
        if (file === activeFile) {
          this.needsUpdate = true;
        }
      })
    );

    // 降低轮询频率到 5 秒，并添加脏检查
    this.pollTimer = setInterval(() => {
      if (this.needsUpdate) {
        this.renderAllBanners();
        this.needsUpdate = false;
      }
    }, 5000); // 1秒 → 5秒

    this.renderAllBanners();
  }
}
```

**预期效果**:
- CPU 占用降低 80%
- 类型安全，避免运行时错误

---

### P0-2: 设置迁移逻辑修复

**文件**: `src/core/settings-manager.ts`

**问题**: 新格式数据没有与默认值深度合并，导致新增字段为 undefined

**修复方案**:
```typescript
private migrate(oldData: Record<string, any>): PluginSettings {
  const settings = structuredClone(DEFAULT_SETTINGS);

  // 如果已经是新格式，深度合并而不是直接返回
  if (oldData.autoHide && typeof oldData.autoHide === "object") {
    for (const key of Object.keys(settings) as Array<keyof PluginSettings>) {
      if (key in oldData) {
        if (typeof oldData[key] === "object" && oldData[key] !== null && !Array.isArray(oldData[key])) {
          // 对象类型：展开合并
          settings[key] = { ...settings[key], ...oldData[key] } as any;
        } else {
          // 基本类型/数组：直接赋值
          (settings as any)[key] = oldData[key];
        }
      }
    }
    return settings;
  }

  // 旧格式迁移映射（保持现有逻辑）
  // ...
}
```

---

### P0-3: IconSystem ZIP 解压安全加固

**文件**: `src/modules/icon-system.module.ts`

**修复方案**:
```typescript
private async extractZipToIcons(libraryName: string, buffer: ArrayBuffer): Promise<void> {
  const data = new Uint8Array(buffer);
  const adapter = this.ctx.app.vault.adapter;
  
  const MAX_FILE_SIZE = 512 * 1024; // 512KB per file
  const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB total
  let totalSize = 0;

  const dirPath = `${PLUGIN_DIR}/icons/${libraryName}`;
  try { await adapter.mkdir(dirPath); } catch { /* 可能已存在 */ }

  const entries = await this.parseZipEntries(data);

  for (const entry of entries) {
    // 安全检查 1: 只处理 .svg 文件
    if (!entry.name.endsWith(".svg") || entry.isDirectory) continue;

    // 安全检查 2: 防止路径穿越
    if (entry.name.includes("..") || entry.name.includes("\\")) {
      console.warn(`[ZENdian] Suspicious path in zip: ${entry.name}`);
      continue;
    }

    // 安全检查 3: 文件大小限制
    if (entry.data.length > MAX_FILE_SIZE) {
      console.warn(`[ZENdian] File too large (${entry.data.length} bytes): ${entry.name}`);
      continue;
    }

    totalSize += entry.data.length;
    if (totalSize > MAX_TOTAL_SIZE) {
      throw new Error("ZIP archive exceeds maximum allowed size");
    }

    const parts = entry.name.split("/");
    const fileName = parts[parts.length - 1];
    if (!fileName || !/^[\w\-\.]+\.svg$/.test(fileName)) {
      console.warn(`[ZENdian] Invalid filename: ${fileName}`);
      continue;
    }

    const svgText = new TextDecoder().decode(entry.data);
    
    // 安全检查 4: 基本 SVG 验证
    if (!svgText.trim().startsWith("<svg") || !svgText.includes("</svg>")) {
      console.warn(`[ZENdian] Invalid SVG content: ${fileName}`);
      continue;
    }

    const filePath = `${dirPath}/${fileName}`;
    try {
      await adapter.write(filePath, svgText);
    } catch (err) {
      console.warn(`[ZENdian] Failed to write ${filePath}:`, err);
    }
  }
}
```

---

### P1-1: 完善 CalloutSettings 接口

**文件**: `src/types/settings.types.ts`

**修复方案**:
```typescript
export interface CalloutSettings {
  style: CalloutStyle;
  borderWidth: string;
  borderOpacity: number;
  padding: string;
  titlePadding: string;
  titleSize: string;
  contentPadding: string;
  contentRadius: string;
}
```

**同时更新默认值**:
```typescript
callout: {
  style: "customize",
  borderWidth: "0px",
  borderOpacity: 0.25,
  padding: "",
  titlePadding: "",
  titleSize: "",
  contentPadding: "",
  contentRadius: "",
},
```

---

### P1-2: RainbowFolderSettings 添加 colors 字段

**文件**: `src/types/settings.types.ts`

**修复方案**:
```typescript
export interface RainbowFolderSettings {
  enabled: boolean;
  opacity: number;
  colors: string[]; // 新增
  iconSize: number; // 从迁移代码中发现
}
```

**默认值**:
```typescript
rainbowFolder: {
  enabled: false,
  opacity: 0.4,
  colors: [
    "var(--color-red)",
    "var(--color-orange)", 
    "var(--color-yellow)",
    "var(--color-green)",
    "var(--color-cyan)",
    "var(--color-blue)",
    "var(--color-purple)",
    "var(--color-pink)",
  ],
  iconSize: 16,
},
```

---

### P1-3: 项目扫描增量更新

**文件**: `src/homepage/HomepageProjectScanService.ts`

**修复方案**:
```typescript
export class HomepageProjectScanService {
  private cache = new Map<string, HomepageProject>();
  private lastScanTime = 0;
  private readonly CACHE_TTL = 30000; // 30秒缓存

  markDirty(): void {
    this.lastScanTime = 0; // 重置时间戳，不清空缓存
  }

  invalidate(folderPath: string): void {
    this.cache.delete(folderPath);
    // 不触发全量重扫
  }

  async getProjects(typeFolders: string, archiveFolder: string): Promise<HomepageProject[]> {
    const now = Date.now();
    
    // 如果缓存未过期，直接返回
    if (this.cache.size > 0 && (now - this.lastScanTime) < this.CACHE_TTL) {
      return Array.from(this.cache.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    }

    // 只扫描新增/修改的项目
    const projects: HomepageProject[] = [];
    const folders = typeFolders.split(",").map((f) => f.trim()).filter(Boolean);

    for (const typeFolderName of folders) {
      const typeLabel = extractTypeLabel(typeFolderName);
      if (!typeLabel) continue;

      const typeFolder = this.app.vault.getAbstractFileByPath(typeFolderName);
      if (!(typeFolder instanceof TFolder)) continue;

      for (const child of typeFolder.children) {
        if (!(child instanceof TFolder)) continue;
        if (child.name === archiveFolder || child.name.startsWith("99")) continue;

        // 检查缓存
        const cached = this.cache.get(child.path);
        const folderMtime = this.getFolderMtime(child);
        
        if (cached && cached.updatedAt >= folderMtime) {
          // 使用缓存
          projects.push(cached);
        } else {
          // 重新扫描
          const project = await this.scanProject(child, typeLabel);
          if (project) {
            projects.push(project);
            this.cache.set(project.id, project);
          }
        }
      }
    }

    this.lastScanTime = now;
    return projects.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  private getFolderMtime(folder: TFolder): number {
    let maxMtime = 0;
    for (const child of folder.children) {
      if (child instanceof TFile) {
        maxMtime = Math.max(maxMtime, child.stat.mtime);
      }
    }
    return maxMtime;
  }
}
```

---

### P1-4: 实现主页便签功能

**文件**: `src/homepage/HomepageView.ts`

**当前问题**: 便签是硬编码假数据，无法编辑

**修复方案**:

1. **修改 renderStickyNotes 方法**:
```typescript
private renderStickyNotes(parent: HTMLElement): void {
  const card = parent.createDiv({ cls: "homepage-card homepage-col-4", attr: { "data-section": "sticky-notes" } });

  const titleRow = card.createDiv({ cls: "homepage-card-title-row" });
  const titleLeft = titleRow.createDiv({ cls: "homepage-card-title" });
  titleLeft.appendChild(svgIcon("stickyNote"));
  titleLeft.createSpan({ text: "便签" });
  const addLink = titleRow.createEl("a", { cls: "homepage-card-link", text: "新建便签" });
  addLink.addEventListener("click", () => this.openQuickNoteModal());

  const container = card.createDiv({ cls: "homepage-sticky-grid" });
  
  // 不再渲染占位符，改为空状态
  container.createDiv({ cls: "homepage-empty-state" });
}
```

2. **完善 loadStickyNotes 方法**:
```typescript
private loadStickyNotes(): void {
  const notes = this.dataService.getQuickNotes();
  const container = this.containerEl.querySelector('[data-section="sticky-notes"] .homepage-sticky-grid');
  if (!container) return;

  container.empty();

  if (notes.length === 0) {
    const empty = container.createDiv({ cls: "homepage-sticky-empty" });
    empty.createDiv({ cls: "homepage-empty-text", text: "暂无便签" });
    empty.createDiv({ cls: "homepage-empty-hint", text: "点击「新建便签」创建第一条" });
    return;
  }

  // 最多显示 3 个便签
  const displayNotes = notes.slice(0, 3);
  const colors = ["yellow", "blue", "green"];

  displayNotes.forEach((note, i) => {
    const noteEl = container.createDiv({
      cls: `homepage-sticky-note homepage-sticky-note--${colors[i % 3]}`,
    });

    noteEl.createDiv({ cls: "homepage-sticky-label", text: note.label });
    
    if (note.content) {
      noteEl.createDiv({ cls: "homepage-sticky-text", text: note.content });
    }

    noteEl.addEventListener("click", () => {
      if (note.path) {
        this.openFile(note.path);
      }
    });

    // 右上角删除按钮
    const delBtn = noteEl.createDiv({ cls: "homepage-sticky-delete", text: "×" });
    delBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await this.dataService.deleteQuickNote(note.id);
      this.loadStickyNotes();
    });
  });
}
```

3. **更新 HomepageQuickNote 类型**:
```typescript
// src/homepage/types.ts
export interface HomepageQuickNote {
  id: string;
  label: string;
  path: string;
  color: string;
  content?: string; // 新增：便签内容预览
}
```

---

## 📅 执行时间表

### 第 1 天（今天）
- ✅ P0-1: Banner 类型安全 + 性能优化
- ✅ P0-2: 设置迁移逻辑修复

### 第 2 天
- ✅ P0-3: IconSystem ZIP 安全加固
- ✅ P1-1: CalloutSettings 接口完善
- ✅ P1-2: RainbowFolderSettings 完善

### 第 3 天
- ✅ P1-3: 项目扫描增量更新
- ✅ P1-4: 主页便签功能实现

### 第 4-5 天
- 🟢 P2 任务：代码重构和测试

---

## ✅ 验证清单

每个修复完成后需要验证：

- [ ] TypeScript 编译无错误
- [ ] 热重载测试通过
- [ ] 相关功能手动测试
- [ ] 性能对比（如适用）
- [ ] 更新 CHANGELOG.md

---

## 📝 风险评估

| 修复项 | 风险等级 | 风险说明 | 缓解措施 |
|--------|----------|----------|----------|
| Banner 轮询改 5 秒 | 低 | 可能延迟显示 | 保留事件驱动机制 |
| 设置迁移修改 | 中 | 可能影响老用户 | 充分测试旧数据迁移 |
| ZIP 安全检查 | 低 | 可能拒绝合法文件 | 提供详细日志 |
| 便签功能重构 | 中 | UI 结构变化 | 保留 CSS 兼容性 |

---

**计划制定时间**: 2026-07-10  
**预计完成时间**: 2026-07-15  
**计划状态**: 待审批
