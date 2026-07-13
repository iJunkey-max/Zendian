import { readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const types = read("src/types/settings.types.ts");
const panel = read("src/ui/settings-tab.ts");
const buildCss = read("scripts/build-css.mjs");

const removedFields = [
  "pluginCompat:",
  "canvasBorder:",
  "externalFilter:",
  "dailyNoteFolders:",
  "colorfulCheckbox:",
  "colors: string[]",
  "iconSize:",
  "style: string",
  "fontStyle:",
];

const requiredPanelIds = [
  "canvas-card-border-width",
  "file-names-untrim",
  "focus-indicator-codeblock-line-number",
  "p-spacing",
  "p-spacing-br",
  "new-tab-image",
  "checkbox-radius",
  "embed-border-radius",
  "homepage-project-archive",
];

const failures = [];
for (const field of removedFields) {
  if (types.includes(field)) failures.push(`废弃字段仍存在于设置类型：${field}`);
}
for (const id of requiredPanelIds) {
  if (!panel.includes(`"${id}"`)) failures.push(`必要设置未进入面板：${id}`);
}
if (buildCss.includes("@settings") || buildCss.includes("settings-blocks")) {
  failures.push("CSS 构建仍包含 Style Settings 元数据入口");
}

if (failures.length) {
  console.error(failures.map((message) => `- ${message}`).join("\n"));
  process.exit(1);
}

console.log("✓ 设置契约检查通过");
