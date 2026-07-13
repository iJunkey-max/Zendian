#!/usr/bin/env node

/**
 * 测试数据生成脚本
 *
 * 功能：
 * - 生成 10 个项目（分布在 5 个类型文件夹）
 * - 每个项目包含完整的文件结构
 * - 生成 90 天的活动日志
 * - 生成 5 个便签
 *
 * 使用方法：
 * node scripts/generate-test-vault.mjs <目标路径>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// 配置
// ============================================================

const TYPE_FOLDERS = [
  { name: '10_课程', type: '课程' },
  { name: '20_竞赛', type: '竞赛' },
  { name: '30_研究', type: '研究' },
  { name: '40_技能', type: '技能' },
  { name: '50_生活', type: '生活' },
];

const PROJECTS = [
  { type: '课程', name: '前端架构设计', priority: 'high', status: 'active' },
  { type: '课程', name: 'TypeScript 进阶', priority: 'medium', status: 'active' },
  { type: '技能', name: 'Obsidian 插件开发', priority: 'high', status: 'active' },
  { type: '竞赛', name: 'Q2 产品迭代', priority: 'urgent', status: 'active' },
  { type: '竞赛', name: '客户需求分析', priority: 'high', status: 'paused' },
  { type: '研究', name: '博客写作计划', priority: 'medium', status: 'active' },
  { type: '技能', name: '开源项目', priority: 'medium', status: 'active' },
  { type: '生活', name: '健康管理', priority: 'medium', status: 'active' },
  { type: '研究', name: 'AI 工具调研', priority: 'high', status: 'active' },
  { type: '研究', name: 'Rust 生态探索', priority: 'low', status: 'paused' },
];

const ICONS = [
  'lucide-book-open',
  'lucide-briefcase',
  'lucide-pen-tool',
  'lucide-heart',
  'lucide-flask',
  'lucide-code',
  'lucide-rocket',
  'lucide-target',
  'lucide-star',
  'lucide-zap',
];

const DESCRIPTIONS = [
  '深入学习前端架构设计模式，提升系统设计能力',
  '系统学习 TypeScript 高级特性和实践技巧',
  '从零开始学习 Obsidian 插件开发，打造个人工具',
  '完成 Q2 产品迭代，包含 5 个核心功能模块',
  '收集并分析客户需求，输出产品需求文档',
  '定期输出技术博客，分享学习心得',
  '维护和开发个人开源项目，回馈社区',
  '制定健康计划，追踪运动和饮食数据',
  '调研主流 AI 工具，评估在工作流中的应用场景',
  '探索 Rust 生态，学习系统编程新思路',
];

const TASK_TEMPLATES = [
  '阅读《{}》第 {} 章',
  '完成 {} 模块的代码实现',
  '编写 {} 的技术文档',
  '进行 {} 功能的测试验证',
  '整理 {} 相关的学习笔记',
  '设计 {} 的架构方案',
  '优化 {} 的性能表现',
  '修复 {} 的已知问题',
  '调研 {} 的最佳实践',
  '准备 {} 的演示 Demo',
];

const NOTE_TITLES = [
  '学习笔记',
  '会议记录',
  '灵感收集',
  '问题清单',
  '资源汇总',
  '实践总结',
  '技术调研',
  '项目复盘',
  '周报月报',
  '读书笔记',
];

// ============================================================
// 工具函数
// ============================================================

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(array) {
  return array[randomInt(0, array.length - 1)];
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

// ============================================================
// 生成器
// ============================================================

/**
 * 生成项目 .home 文件
 */
function generateHomeFile(project, icon, description) {
  const data = {
    name: project.name,
    icon,
    description,
    type: project.type,
    status: project.status,
    createdAt: formatDate(daysAgo(randomInt(30, 90))),
    updatedAt: formatDate(daysAgo(randomInt(0, 7))),
    metadata: {
      priority: project.priority,
      tags: generateTags(project),
      collaborators: [],
      dependencies: [],
      deadline: project.priority === 'urgent' ? formatDate(daysAgo(-30)) : undefined,
    },
    viewConfig: {
      pinnedFiles: [],
      hiddenFolders: [],
      customSections: [],
    },
    milestones: generateMilestones(project),
    deliverables: generateDeliverables(project),
  };

  return JSON.stringify(data, null, 2);
}

/**
 * 生成项目标签
 */
function generateTags(project) {
  const allTags = ['重要', '长期', '短期', '协作', '个人', '实验性'];
  const count = randomInt(1, 3);
  const tags = [];
  for (let i = 0; i < count; i++) {
    const tag = randomChoice(allTags);
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  }
  return tags;
}

/**
 * 生成里程碑
 */
function generateMilestones(project) {
  if (project.status === 'paused' || project.status === 'completed') {
    return [];
  }

  const count = randomInt(2, 4);
  const milestones = [];

  for (let i = 0; i < count; i++) {
    const completed = randomInt(0, 10) > 6;
    milestones.push({
      id: `milestone-${Date.now()}-${i}`,
      title: `阶段 ${i + 1} - ${randomChoice(['需求分析', '设计方案', '开发实现', '测试验证', '上线发布'])}`,
      deadline: formatDate(daysAgo(-randomInt(10, 60))),
      completed,
      deliverables: [],
      createdAt: formatDate(daysAgo(randomInt(30, 60))),
    });
  }

  return milestones;
}

/**
 * 生成交付物
 */
function generateDeliverables(project) {
  const count = randomInt(2, 5);
  const deliverables = [];
  const statuses = ['pending', 'in-progress', 'done'];

  for (let i = 0; i < count; i++) {
    deliverables.push({
      name: `交付物 ${i + 1}`,
      path: `30 交付物/deliverable-${i + 1}.md`,
      status: randomChoice(statuses),
    });
  }

  return deliverables;
}

/**
 * 生成 Timeline.md 文件
 */
function generateTimeline(project) {
  const lines = [`# ${project.name} - 任务时间线\n`];
  const taskCount = randomInt(10, 20);

  for (let i = 0; i < taskCount; i++) {
    const completed = randomInt(0, 10) > 5;
    const checkbox = completed ? '[x]' : '[ ]';

    const template = randomChoice(TASK_TEMPLATES);
    const taskText = template
      .replace('{}', randomChoice(['功能A', '模块B', '组件C', '系统D']))
      .replace('{}', randomInt(1, 10));

    const createdDate = formatDate(daysAgo(randomInt(5, 30)));
    let line = `- ${checkbox} ${taskText} @created(${createdDate})`;

    // 20% 概率添加截止日期
    if (randomInt(0, 10) > 8) {
      const dueDate = formatDate(daysAgo(-randomInt(5, 20)));
      line += ` @due(${dueDate})`;
    }

    // 30% 概率添加优先级
    if (randomInt(0, 10) > 7) {
      const priority = randomChoice(['low', 'medium', 'high']);
      line += ` @priority(${priority})`;
    }

    lines.push(line);
  }

  return lines.join('\n');
}

/**
 * 生成 Overview.md 文件
 */
function generateOverview(project, description) {
  return `# ${project.name}

> 创建于 ${formatDate(daysAgo(randomInt(30, 90)))}

## 项目简介

${description}

## 目标

- 目标 1：深入理解核心概念
- 目标 2：完成实践项目
- 目标 3：输出学习总结

## 资源

- [相关资源链接](https://example.com)
- [参考文档](https://example.com)

## 进展记录

### ${formatDate(daysAgo(7))}
完成了初步调研，整理了资源清单。

### ${formatDate(daysAgo(14))}
开始第一阶段的学习和实践。
`;
}

/**
 * 生成笔记文件
 */
function generateNote(project, index) {
  const title = `${randomChoice(NOTE_TITLES)}-${index}`;
  const date = formatDate(daysAgo(randomInt(1, 60)));

  return `# ${title}

创建于：${date}
项目：[[${project.name}]]
标签：#笔记 #${project.type}

## 内容

这是一条测试笔记，记录了关于 ${project.name} 的一些想法和进展。

- 要点 1：核心概念理解
- 要点 2：实践经验总结
- 要点 3：待解决的问题

## 参考

- 参考资料 1
- 参考资料 2
`;
}

/**
 * 生成项目结构
 */
function generateProject(baseDir, project, icon, description) {
  const typeFolder = TYPE_FOLDERS.find((f) => f.type === project.type);
  const projectPath = path.join(baseDir, typeFolder.name, project.name);

  console.log(`  生成项目: ${project.name}`);

  // 创建项目文件夹结构
  ensureDir(projectPath);
  ensureDir(path.join(projectPath, '00 控制台'));
  ensureDir(path.join(projectPath, '10 笔记流'));
  ensureDir(path.join(projectPath, '20 工作区'));
  ensureDir(path.join(projectPath, '30 交付物'));
  ensureDir(path.join(projectPath, '90 资源库'));
  ensureDir(path.join(projectPath, '91 附件'));

  // 生成 .home 文件
  const homeContent = generateHomeFile(project, icon, description);
  fs.writeFileSync(
    path.join(projectPath, '00 控制台', `${project.name}.home`),
    homeContent,
    'utf-8'
  );

  // 生成 Timeline.md
  const timelineContent = generateTimeline(project);
  fs.writeFileSync(
    path.join(projectPath, '00 控制台', 'Timeline.md'),
    timelineContent,
    'utf-8'
  );

  // 生成 Overview.md
  const overviewContent = generateOverview(project, description);
  fs.writeFileSync(
    path.join(projectPath, '00 控制台', 'Overview.md'),
    overviewContent,
    'utf-8'
  );

  // 生成笔记文件
  const noteCount = randomInt(5, 10);
  for (let i = 1; i <= noteCount; i++) {
    const noteContent = generateNote(project, i);
    fs.writeFileSync(
      path.join(projectPath, '10 笔记流', `笔记-${i}.md`),
      noteContent,
      'utf-8'
    );
  }

  // 生成交付物文件
  const deliverableCount = randomInt(2, 5);
  for (let i = 1; i <= deliverableCount; i++) {
    const content = `# 交付物 ${i}\n\n这是交付物 ${i} 的内容。`;
    fs.writeFileSync(
      path.join(projectPath, '30 交付物', `deliverable-${i}.md`),
      content,
      'utf-8'
    );
  }
}

/**
 * 生成活动日志
 */
function generateActivityLog(baseDir) {
  console.log('生成活动日志...');

  const dailyActivities = {};

  for (let i = 0; i < 90; i++) {
    const date = formatDate(daysAgo(i));
    dailyActivities[date] = {
      date,
      noteCreated: randomInt(0, 5),
      noteEdited: randomInt(2, 15),
      taskCompleted: randomInt(0, 8),
      fileOpened: randomInt(5, 20),
      focusMinutes: randomInt(30, 240),
    };
  }

  const activityLogData = {
    dailyActivities,
    lastSyncTime: Date.now(),
  };

  const pluginDir = path.join(baseDir, '.obsidian', 'plugins', 'zendian');
  ensureDir(pluginDir);

  fs.writeFileSync(
    path.join(pluginDir, 'activity-log.json'),
    JSON.stringify(activityLogData, null, 2),
    'utf-8'
  );
}

/**
 * 生成便签数据
 */
function generateQuickNotes(baseDir) {
  console.log('生成便签数据...');

  const quickNotes = [
    {
      id: `note-${Date.now()}-1`,
      label: '周会待办',
      path: '便签/周会待办.md',
      color: 'yellow',
      content: '周会需要汇报的内容：\n- 本周进展\n- 下周计划\n- 需要支持',
      category: '工作',
      pinned: true,
      createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    },
    {
      id: `note-${Date.now()}-2`,
      label: '灵感收集',
      path: '便签/灵感.md',
      color: 'blue',
      content: '新的项目想法：\n- 自动化工作流工具\n- Obsidian 数据分析插件',
      category: '灵感',
      pinned: false,
      createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    },
    {
      id: `note-${Date.now()}-3`,
      label: '购物清单',
      path: '便签/购物.md',
      color: 'green',
      content: '本周需要采购：\n- 日用品\n- 书籍\n- 电子产品',
      category: '生活',
      pinned: false,
      createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    },
    {
      id: `note-${Date.now()}-4`,
      label: '学习计划',
      path: '便签/学习.md',
      color: 'pink',
      content: 'Q2 学习目标：\n- TypeScript 进阶\n- 系统设计\n- 算法刷题',
      category: '学习',
      pinned: true,
      createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now(),
    },
    {
      id: `note-${Date.now()}-5`,
      label: '待办事项',
      path: '便签/待办.md',
      color: 'purple',
      content: '本周待办：\n- 完成代码审查\n- 更新文档\n- 准备分享',
      category: '待办',
      pinned: false,
      createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    },
  ];

  const homepageData = {
    quickNotes,
    quotes: [
      { text: '知识是连接的，记录是思考的开始。', author: 'Keep Creating' },
    ],
    preferences: {
      layout: 'comfortable',
      hiddenSections: [],
      sectionOrder: [],
      projectFilters: {
        status: [],
        types: [],
        tags: [],
      },
    },
    activityLog: {},
  };

  const pluginDir = path.join(baseDir, '.obsidian', 'plugins', 'zendian');
  ensureDir(pluginDir);

  fs.writeFileSync(
    path.join(pluginDir, 'homepage-data.json'),
    JSON.stringify(homepageData, null, 2),
    'utf-8'
  );

  // 创建便签文件
  const noteDir = path.join(baseDir, '便签');
  ensureDir(noteDir);

  for (const note of quickNotes) {
    const fileName = path.basename(note.path);
    fs.writeFileSync(
      path.join(noteDir, fileName),
      note.content,
      'utf-8'
    );
  }
}

/**
 * 生成 README
 */
function generateReadme(baseDir) {
  const readme = `# ZENdian 测试 Vault

这是 ZENdian 插件的测试数据集，包含：

## 项目结构

- **10 个项目**，分布在 5 个类型文件夹
- 每个项目包含完整的文件结构：
  - .home 文件（项目元数据）
  - Timeline.md（任务列表）
  - Overview.md（项目概览）
  - 5-10 条笔记
  - 2-5 个交付物

## 数据统计

- **项目总数**: 10
- **笔记总数**: ~70
- **任务总数**: ~150
- **活动日志**: 90 天
- **便签数量**: 5

## 项目列表

### 课程
1. 前端架构设计
2. TypeScript 进阶

### 竞赛
4. Q2 产品迭代
5. 客户需求分析

### 研究
6. 博客写作计划
9. AI 工具调研
10. Rust 生态探索

### 技能
3. Obsidian 插件开发
7. 开源项目

### 生活
8. 健康管理

## 使用方法

1. 在 Obsidian 中打开此文件夹作为 vault
2. 安装 ZENdian 插件
3. 打开主页（Ctrl+P → "打开主页"）
4. 体验完整功能

## 注意事项

- 这是测试数据，可以随意修改
- 活动日志数据已生成 90 天历史
- 项目状态包含"进行中"和"已暂停"

生成时间：${new Date().toLocaleString('zh-CN')}
`;

  fs.writeFileSync(path.join(baseDir, 'README.md'), readme, 'utf-8');
}

// ============================================================
// 主函数
// ============================================================

function main() {
  const targetDir = process.argv[2] || './test-vault';

  console.log('='.repeat(60));
  console.log('ZENdian 测试数据生成器');
  console.log('='.repeat(60));
  console.log(`目标目录: ${targetDir}\n`);

  // 创建基础目录
  ensureDir(targetDir);

  // 创建类型文件夹
  console.log('创建类型文件夹...');
  for (const typeFolder of TYPE_FOLDERS) {
    ensureDir(path.join(targetDir, typeFolder.name));
  }

  // 生成项目
  console.log('\n生成项目...');
  for (let i = 0; i < PROJECTS.length; i++) {
    const project = PROJECTS[i];
    const icon = ICONS[i % ICONS.length];
    const description = DESCRIPTIONS[i];
    generateProject(targetDir, project, icon, description);
  }

  // 生成活动日志
  console.log('\n生成活动日志...');
  generateActivityLog(targetDir);

  // 生成便签
  console.log('生成便签...');
  generateQuickNotes(targetDir);

  // 生成 README
  console.log('生成 README...');
  generateReadme(targetDir);

  console.log('\n' + '='.repeat(60));
  console.log('✅ 测试数据生成完成！');
  console.log('='.repeat(60));
  console.log(`\n目标目录: ${path.resolve(targetDir)}`);
  console.log('\n后续步骤:');
  console.log('1. 在 Obsidian 中打开此文件夹作为 vault');
  console.log('2. 安装 ZENdian 插件');
  console.log('3. 打开主页体验功能\n');
}

main();
