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
  "css/settings-blocks/phycat-settings.css",
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
name: ZENdian Info
id: zendian-info
settings:
    -
        id: zendian-version
        title: ZENdian Version
        type: info-text
        description: "ZENdian v1.0.0 — Based on Border Theme by Akifyss, Phycat overlay, and Style Settings by mgmeyers."
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
