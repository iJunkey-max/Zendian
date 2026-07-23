/**
 * CSS build script for ZENdian plugin.
 * Merges CSS source files into a single styles.css,
 * controlling cascade order.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// CSS files in merge order (later files override earlier ones)
const CSS_MERGE_ORDER = [
  "css/design-system.css",           // 设计系统（基础样式）
  "css/base/border-theme.css",
  "css/overlays/phycat-overlay.css",
  "css/overlays/graph.css",
  "css/overlays/banner.css",
  "css/overlays/focus-clock.css",
  "css/overlays/homepage.css",
  "css/overlays/console-enhanced.css", // 项目控制台增强样式
  "css/ui/style-settings-ui.css",
];

function countUnescapedQuotes(text, quote) {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== quote) continue;
    let backslashes = 0;
    for (let j = i - 1; j >= 0 && text[j] === "\\"; j--) backslashes++;
    if (backslashes % 2 === 0) count++;
  }
  return count;
}

function build() {
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
      const singleQuotes = countUnescapedQuotes(line, "'");
      const doubleQuotes = countUnescapedQuotes(line, '"');

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
    const cssText = readFileSync(fullPath, "utf-8");
    parts.push(cssText);
  }

  const output = parts.join("\n\n");

  const distDir = resolve(ROOT, "dist");
  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }

  const outputPath = resolve(distDir, "styles.css");
  writeFileSync(outputPath, output, "utf-8");

  const sizeKB = Math.round(Buffer.byteLength(output, "utf-8") / 1024);
  console.log(`\n✅ Built styles.css: ${sizeKB} KB`);
}

build();
