import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(
  resolve(import.meta.dirname, "../css/overlays/phycat-overlay.css"),
  "utf8",
);
const borderCss = readFileSync(
  resolve(import.meta.dirname, "../css/base/border-theme.css"),
  "utf8",
);

const yamlRule = css.indexOf(
  '.workspace-leaf-content[data-type="markdown"] .metadata-container {',
);
const embeddedYamlRule = css.indexOf(
  '.workspace-leaf-content[data-type="markdown"] .markdown-embed .metadata-container {',
);

if (
  yamlRule === -1 ||
  embeddedYamlRule < yamlRule ||
  !/\.markdown-embed \.metadata-container\s*\{\s*display:\s*none !important/.test(css)
) {
  console.error("CSS 契约检查失败：嵌入笔记的 YAML 属性容器必须保持隐藏");
  process.exit(1);
}

if (
  !/\.markdown-embed \.markdown-embed-title\s*\{\s*display:\s*none;?\s*\}/.test(
    borderCss,
  ) ||
  /\.markdown-embed \.markdown-embed-link\s*\{\s*display:\s*none/.test(borderCss)
) {
  console.error("CSS 契约检查失败：嵌入笔记必须仅隐藏文件名标题并保留跳转图标");
  process.exit(1);
}

if (
  !/--table-line-height:\s*1\.2;/.test(css) ||
  !/--table-cell-padding:\s*3px 8px;/.test(css) ||
  !/min-width:\s*min\(100%, 34rem\);/.test(css) ||
  !/\.markdown-preview-view table\s*\{[\s\S]*?width:\s*fit-content !important;/.test(
    css,
  ) ||
  !/\.table-cell-wrapper\s*\{\s*padding:\s*var\(--table-cell-padding\) !important;[\s\S]*?min-height:\s*0 !important;/.test(
    css,
  ) ||
  !/body :is\(\.markdown-rendered, \.markdown-source-view\.mod-cm6\.is-live-preview\) table\s*\{\s*width:\s*fit-content !important;/.test(
    borderCss,
  ) ||
  !/\.table-width-customized[\s\S]*?>div:has\(>table\)[\s\S]*?width:\s*var\(--table-width\) !important;/.test(
    borderCss,
  )
) {
  console.error("CSS 契约检查失败：Markdown 表格必须保持紧凑密度并尊重自定义宽度");
  process.exit(1);
}

console.log("✓ CSS 契约检查通过");
