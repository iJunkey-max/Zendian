/**
 * CSS build script for ZENdian plugin.
 * Merges CSS source files into a single styles.css,
 * deduplicating @settings blocks and controlling cascade order.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// CSS files in merge order (later files override earlier ones)
const CSS_MERGE_ORDER = [
  "css/design-system.css",           // 设计系统（基础样式）
  "css/settings-blocks/border-settings.css",
  "css/base/border-theme.css",
  "css/overlays/phycat-overlay.css",
  "css/overlays/banner.css",
  "css/overlays/homepage.css",
  "css/overlays/quicknote-editor.css",
  "css/overlays/console-enhanced.css", // 项目控制台增强样式
  "css/ui/style-settings-ui.css",
];

function stripSettingsBlocks(cssText, seenIds) {
  const regex = /\/\*[\s!]*@settings\s*\n([\s\S]*?)\*\//g;
  return cssText.replace(regex, (fullMatch, block) => {
    const idMatch = block.match(/\bid:\s*([\w-]+)/);
    if (idMatch && seenIds.has(idMatch[1])) {
      return "";
    }
    if (idMatch) {
      seenIds.add(idMatch[1]);
    }
    return fullMatch;
  });
}

function build() {
  const seenSettingsIds = new Set();
  const parts = [];

  // 阶段 1: 验证所有文件存在且语法正确
  console.log("🔍 Validating CSS files...");
  for (const relPath of CSS_MERGE_ORDER) {
    const fullPath = resolve(ROOT, relPath);

    // 错误检查 1: 文件是否存在
    if (!existsSync(fullPath)) {
      console.error(`❌ CSS file not found: ${relPath}`);
      process.exit(1);
    }

    // 读取文件内容
    let cssText;
    try {
      cssText = readFileSync(fullPath, "utf-8");
    } catch (err) {
      console.error(`❌ Failed to read ${relPath}:`, err.message);
      process.exit(1);
    }

    // 错误检查 2: 基本 CSS 语法检查（括号匹配）
    const openBraces = (cssText.match(/{/g) || []).length;
    const closeBraces = (cssText.match(/}/g) || []).length;

    if (openBraces !== closeBraces) {
      console.error(`❌ CSS syntax error in ${relPath}:`);
      console.error(`   Mismatched braces: ${openBraces} open, ${closeBraces} close`);
      process.exit(1);
    }

    // 错误检查 3: 检测常见语法错误
    const lines = cssText.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 检测未闭合的字符串
      const singleQuotes = (line.match(/'/g) || []).length;
      const doubleQuotes = (line.match(/"/g) || []).length;

      if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) {
        console.warn(`⚠️  Possible unclosed string in ${relPath}:${i + 1}`);
        console.warn(`   ${line}`);
      }
    }

    console.log(`✅ ${relPath}`);
  }

  // 阶段 2: 合并 CSS 文件
  console.log("\n🔨 Building styles.css...");
  for (const relPath of CSS_MERGE_ORDER) {
    const fullPath = resolve(ROOT, relPath);
    let cssText = readFileSync(fullPath, "utf-8");
    cssText = stripSettingsBlocks(cssText, seenSettingsIds);
    parts.push(cssText);
  }

  const infoBlock = `/* @settings
name: ZENdian
name.zh: ZENdian
id: zendian
settings:
    -
        id: zendian-info
        title: Theme Info
        title.zh: 主题信息
        type: info-text
        description: "ZENdian — An elegant Obsidian theme combining Border Theme by Akifyss, Phycat overlay enhancements, and Style Settings by mgmeyers."
        description.zh: "ZENdian — 融合 Border 主题（Akifyss）、Phycat 增强覆盖层与 Style Settings（mgmeyers）的优雅 Obsidian 主题。"
        markdown: true
    -
        id: zendian-author
        title: Author
        title.zh: 作者
        type: info-text
        description: "Junkey"
        description.zh: "Junkey"
    -
        id: zendian-version
        title: Version
        title.zh: 版本
        type: info-text
        description: "V2.2.12BETA"
        description.zh: "V2.2.12BETA"
    -
        id: zendian-changelog
        title: Changelog
        title.zh: 版本记录
        type: info-text
        description: "**V2.2.12BETA** — Project Homepage Redesign<br>- Clear project, task, status, and activity hierarchy<br>- Project cards aligned with the ZENdian homepage design system<br>- Improved typography, contrast, spacing, and information density<br>- Responsive task viewport uses available space before scrolling<br>**v2.2.10Fix** — Homepage & Project Reliability<br>- Unified .home file resolution<br>- Timeline.md as the single task source<br>- Project-scoped file watching and cache invalidation<br>- Homepage settings and dependency injection fixes<br>- TypeScript strict check restored"
        description.zh: "**V2.2.12BETA** — 项目主页重设计<br>- 重构项目、任务、状态和活动的信息层级<br>- 项目卡片与 ZENdian 主页设计系统保持一致<br>- 优化字号、对比度、间距和信息密度<br>- 任务内容区优先利用可用高度后再滚动<br>**v2.2.10Fix** — 主页与项目可靠性修复<br>- 统一 .home 文件定位<br>- Timeline.md 作为唯一任务数据源<br>- 按项目隔离文件监听并修复缓存失效<br>- 修复主页设置响应与依赖注入<br>- 恢复 TypeScript 严格检查"
        markdown: true
*/
`;

  const output = infoBlock + "\n" + parts.join("\n\n");

  const distDir = resolve(ROOT, "dist");
  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }

  const outputPath = resolve(distDir, "styles.css");
  writeFileSync(outputPath, output, "utf-8");

  const sizeKB = Math.round(Buffer.byteLength(output, "utf-8") / 1024);
  console.log(`\n✅ Built styles.css: ${sizeKB} KB (${seenSettingsIds.size + 1} @settings groups)`);
}

build();
