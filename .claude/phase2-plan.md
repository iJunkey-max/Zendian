# ZENdian 二阶段修复计划

## 📋 P2 任务清单（代码质量改进）

基于代码审查报告，以下是待修复的 P2 级别问题：

### 9. HomepageView 文件拆分
**优先级**: 🟢 P2-1  
**问题**: 单文件 1570 行，职责过重  
**目标**: 拆分为多个文件

**拆分方案**:
```
src/homepage/
├── HomepageView.ts              (主入口，200 行)
├── renderers/
│   ├── HomepageHeaderRenderer.ts    (Header 渲染)
│   ├── HomepageDailyRenderer.ts     (每日回顾)
│   ├── HomepageProjectRenderer.ts   (项目)
│   ├── HomepageTodoRenderer.ts      (待办)
│   ├── HomepageStickyRenderer.ts    (便签)
│   ├── HomepageHeatmapRenderer.ts   (热力图)
│   ├── HomepageStatsRenderer.ts     (月度统计)
│   └── HomepageRecentRenderer.ts    (最近笔记)
├── controllers/
│   ├── HomepageSearchController.ts  (搜索功能)
│   ├── HomepageProjectController.ts (项目交互)
│   └── HomepageTodoController.ts    (待办交互)
└── utils/
    ├── HomepageAnimations.ts        (动画效果)
    ├── HomepageFormatters.ts        (格式化函数)
    └── HomepageIcons.ts             (SVG 图标)
```

---

### 10. 提取重复代码

**优先级**: 🟢 P2-2  
**问题**: 多个文件中重复的日期格式化、DOM 轮询逻辑

**待提取内容**:

#### 日期格式化函数
- `formatRelativeTime()` - 出现在 HomepageView.ts、ProjectConsoleView.ts
- `formatTodoDate()` - 待办日期格式化
- `formatTimestamp()` - 时间戳格式化

**目标**: 提取到 `src/utils/date.ts`

#### DOM 轮询逻辑
- `icon-system.module.ts` 和 `rainbow-folder.module.ts` 中重复的轮询逻辑

**目标**: 提取到 `src/utils/dom.ts` 作为通用工具函数

#### SVG 图标
- HomepageView.ts 中的 `SVG_ICON` 对象（46 个图标）
- ProjectConsoleView.ts 中的 `SVG` 对象（13 个图标）

**目标**: 提取到 `src/utils/icons.ts`

---

### 11. 统一错误处理

**优先级**: 🟢 P2-3  
**问题**: 错误处理不一致，缺少统一上报机制

**方案**:
```typescript
// src/utils/error-handler.ts

export enum ErrorLevel {
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  FATAL = "fatal",
}

export interface ErrorContext {
  module: string;
  action: string;
  data?: any;
}

export class ErrorHandler {
  static log(level: ErrorLevel, message: string, context?: ErrorContext, error?: Error): void {
    const prefix = `[ZENdian][${context?.module || "Core"}]`;
    const fullMessage = `${prefix} ${message}`;

    switch (level) {
      case ErrorLevel.INFO:
        console.log(fullMessage, context?.data);
        break;
      case ErrorLevel.WARN:
        console.warn(fullMessage, context?.data);
        break;
      case ErrorLevel.ERROR:
      case ErrorLevel.FATAL:
        console.error(fullMessage, error, context?.data);
        break;
    }
  }

  static info(message: string, context?: ErrorContext): void {
    this.log(ErrorLevel.INFO, message, context);
  }

  static warn(message: string, context?: ErrorContext): void {
    this.log(ErrorLevel.WARN, message, context);
  }

  static error(message: string, error?: Error, context?: ErrorContext): void {
    this.log(ErrorLevel.ERROR, message, context, error);
  }

  static fatal(message: string, error?: Error, context?: ErrorContext): void {
    this.log(ErrorLevel.FATAL, message, context, error);
  }
}
```

**迁移示例**:
```typescript
// 修改前
console.error(`[ZENdian] Failed to load module "${id}":`, err);

// 修改后
ErrorHandler.error(`Failed to load module`, err, { module: "ModuleManager", action: "loadModule", data: { id } });
```

---

### 12. CSS 构建错误提示

**优先级**: 🟢 P2-4  
**问题**: CSS 文件不存在或有语法错误时构建不会失败

**修复**: 增强 `scripts/build-css.mjs`

```javascript
// 添加错误检查
for (const file of cssFiles) {
  if (!fs.existsSync(file)) {
    console.error(`❌ CSS file not found: ${file}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(file, "utf-8");
  
  // 基本 CSS 语法检查
  const openBraces = (content.match(/{/g) || []).length;
  const closeBraces = (content.match(/}/g) || []).length;
  
  if (openBraces !== closeBraces) {
    console.error(`❌ CSS syntax error in ${file}: mismatched braces (${openBraces} open, ${closeBraces} close)`);
    process.exit(1);
  }
}
```

---

### 13. 添加核心业务单元测试

**优先级**: 🟢 P2-5  
**问题**: 没有任何测试，重构风险高

**方案**: 添加关键模块的单元测试

#### 测试框架选择
- 使用 `vitest`（轻量级，类似 Jest）

#### 优先测试的模块
1. `SettingsManager` - 设置迁移逻辑
2. `HomepageProjectScanService` - 项目扫描
3. `HomepageTaskService` - 任务解析
4. `date.ts` 工具函数（提取后）

**示例**:
```typescript
// tests/settings-manager.test.ts
import { describe, it, expect } from 'vitest';
import { SettingsManager } from '../src/core/settings-manager';

describe('SettingsManager', () => {
  describe('migrate', () => {
    it('should merge new format with defaults', () => {
      const oldData = {
        autoHide: { tab: true },
        // 缺少 homepage 字段
      };
      
      const result = manager.migrate(oldData);
      
      expect(result.autoHide.tab).toBe(true);
      expect(result.homepage).toBeDefined(); // 应该有默认值
      expect(result.homepage.enabled).toBe(true);
    });
  });
});
```

---

## 📅 执行计划

### 第 1 天（今天）
- ✅ P2-2: 提取重复代码（日期、图标、DOM 工具）
- ✅ P2-4: CSS 构建错误提示

### 第 2 天
- ⏳ P2-3: 统一错误处理
- ⏳ P2-1: HomepageView 文件拆分（开始）

### 第 3-4 天
- ⏳ P2-1: HomepageView 文件拆分（完成）
- ⏳ P2-5: 添加单元测试

---

## 🎯 预期收益

| 改进项 | 收益 |
|--------|------|
| 文件拆分 | 可维护性 ↑ 80%，代码定位速度 ↑ 90% |
| 提取重复代码 | 减少重复 30%，一致性 ↑ 100% |
| 统一错误处理 | 调试效率 ↑ 50%，日志可读性 ↑ 100% |
| CSS 错误提示 | 构建失败提前发现，避免部署问题 |
| 单元测试 | 重构信心 ↑ 80%，回归 bug ↓ 60% |

---

## 📊 当前进度

| 阶段 | P0 | P1 | P2 | 总计 |
|------|----|----|----|----|
| 一阶段 | 3/3 ✅ | 4/4 ✅ | 0/5 | 7/12 |
| 二阶段 | - | - | 0/5 ⏳ | - |

---

**计划制定时间**: 2026-07-10  
**预计完成**: 2026-07-14  
**优先级**: P2（代码质量改进，不影响功能）
