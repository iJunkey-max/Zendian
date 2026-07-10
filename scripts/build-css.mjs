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
  "css/settings-blocks/border-settings.css",
  "css/base/border-theme.css",
  "css/overlays/phycat-overlay.css",
  "css/overlays/banner.css",
  "css/overlays/homepage.css",
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
        description: "v2.1.04"
        description.zh: "v2.1.04"
    -
        id: zendian-changelog
        title: Changelog
        title.zh: 版本记录
        type: info-text
        description: "**v2.1.04Enhanced** — Banner & Dark Mode Fixes<br>- Fix banner blank space when image URL is invalid<br>- Fix infinite re-render loop for broken banner images<br>- Darker dark mode background (5-10% lightness)<br>**v2.1.03** — Banner (Page Header Image)<br>- Frontmatter-driven banner images for notes<br>- Glassmorphism metadata overlay, fade mask<br>- Per-leaf data-attribute isolation for split views<br>- Configurable height, YAML key, image position<br>- Reading/editing mode polling + event sync<br>**v2.1.02E** — Dynamic icon system<br>- Data-driven file tree icons with regex matching<br>- Lucide built-in + Boxicons/Coolicons/Tabler support<br>- Icon picker modal with grid layout<br>- Right-click custom icons per file<br>- Tab icons for workspace tabs<br>**v1.0.0** — Initial release<br>- Merged Border theme, Phycat overlay, and Style Settings<br>- Apple-style settings panel with sidebar navigation<br>- Full Chinese localization<br>- Rainbow folder support<br>- Theme accent color sync with Obsidian<br>- Default card layout with grid background"
        description.zh: "**v2.1.04Enhanced** — Banner 与深色模式修复<br>- 修复图片链接无效时页面顶部留白问题<br>- 修复死链图片导致无限重渲染闪烁<br>- 深色模式背景色调暗至 5-10% 亮度区间<br>**v2.1.03** — 页眉图片 (Banner)<br>- 基于 frontmatter 的笔记页眉图片<br>- 毛玻璃属性面板融合、渐变遮罩<br>- data-attribute 隔离分屏视图<br>- 可配置高度、YAML 键名、图片对齐方式<br>- 阅读/编辑模式心跳轮询 + 事件同步<br>**v2.1.02E** — 动态图标系统<br>- 数据驱动文件树图标，正则匹配引擎<br>- 内置 Lucide + Boxicons/Coolicons/Tabler 图标库<br>- 图标选择器弹窗，CSS Grid 多列网格<br>- 右键自定义单个文件图标<br>- 标签页图标显示<br>**v1.0.0** — 首发版本<br>- 整合 Border 主题、Phycat 覆盖层与 Style Settings<br>- 苹果风格设置面板，侧边栏导航<br>- 全面中文本地化<br>- 彩虹文件夹支持<br>- 主题色与 Obsidian 同步<br>- 默认卡片布局与网格背景"
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
