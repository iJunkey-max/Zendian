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
const unifiedCss = readFileSync(
  resolve(import.meta.dirname, "../css/ui/unified-ui.css"),
  "utf8",
);
const graphCss = readFileSync(
  resolve(import.meta.dirname, "../css/overlays/graph.css"),
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

if (
  !/--zd-ui-page:\s*var\(--zd-ui-surface/.test(unifiedCss) ||
  !/\.zendian-homepage[\s\S]*?background:\s*var\(--zd-ui-page\)/.test(unifiedCss) ||
  !/\.zendian-settings-wrapper[\s\S]*?background:\s*var\(--zd-ui-control\)/.test(unifiedCss) ||
  !/\.modal\.zendian-shared-modal \.modal-content[\s\S]*?border-radius:\s*var\(--zd-ui-radius-card\)/.test(unifiedCss) ||
  !/\.zc-root\s*\{[\s\S]*?--zc-bg:\s*var\(--zd-ui-page\)[\s\S]*?--zc-radius:\s*var\(--zd-ui-radius-card\)/.test(unifiedCss) ||
  !/\.homepage-project-modal\s*\{[\s\S]*?background:\s*var\(--zd-ui-page\)/.test(unifiedCss) ||
  !/\.zendian-graph\s*\{[\s\S]*?--zd-graph-ui-page:\s*var\(--zd-ui-page/.test(graphCss) ||
  !/\.zendian-graph \.view-content\s*\{[\s\S]*?var\(--zd-graph-ui-page\)/.test(graphCss)
) {
  console.error("CSS 契约检查失败：主页、设置、共享弹窗和降级弹窗必须复用统一 UI Token");
  process.exit(1);
}

console.log("✓ CSS 契约检查通过");
