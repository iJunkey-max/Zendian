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

  for (const relPath of CSS_MERGE_ORDER) {
    const fullPath = resolve(ROOT, relPath);
    if (!existsSync(fullPath)) {
      console.warn(`Warning: ${relPath} not found, skipping.`);
      continue;
    }

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
        description: "v2.0.19E"
        description.zh: "v2.0.19E"
    -
        id: zendian-changelog
        title: Changelog
        title.zh: 版本记录
        type: info-text
        description: "**v1.0.0** — Initial release<br>- Merged Border theme, Phycat overlay, and Style Settings<br>- Apple-style settings panel with sidebar navigation<br>- Full Chinese localization<br>- Rainbow folder support<br>- Theme accent color sync with Obsidian<br>- Default card layout with grid background"
        description.zh: "**v1.0.0** — 首发版本<br>- 整合 Border 主题、Phycat 覆盖层与 Style Settings<br>- 苹果风格设置面板，侧边栏导航<br>- 全面中文本地化<br>- 彩虹文件夹支持<br>- 主题色与 Obsidian 同步<br>- 默认卡片布局与网格背景"
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
  console.log(`Built styles.css: ${sizeKB} KB (${seenSettingsIds.size + 1} @settings groups)`);
}

build();
