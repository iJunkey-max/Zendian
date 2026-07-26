import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const failures = [];

function requireCondition(condition, message) {
  if (!condition) failures.push(message);
}

const extension = read("src/modules/editor-enhance/typewriter.extension.ts");
const focusClock = read("src/focus-clock/FocusClockController.ts");
const css = read("css/base/border-theme.css");
const focusActiveRule =
  css.match(/\.border-focus-mode \.cm-lineWrapping > \.cm-line\.cm-active\s*\{([^}]*)\}/)?.[1] ??
  "";
const typewriterActiveRule =
  css.match(
    /\.cm-editor\[data-zendian-typewriter-active\] \.cm-line\.cm-active\s*\{([^}]*)\}/,
  )?.[1] ?? "";

requireCondition(
  !/behavior\s*:\s*["']smooth["']/.test(extension),
  "打字机滚动不得使用不可控的原生 smooth 行为",
);
requireCondition(
  /scrollDOM\.scrollTop\s*=\s*measurement\.desiredScrollTop/.test(extension),
  "打字机滚动必须同步固定真实滚动位置",
);
requireCondition(
  extension.includes("expectedProgrammaticScrollTop") &&
    extension.includes("Math.abs(this.view.scrollDOM.scrollTop - this.expectedProgrammaticScrollTop) <= 1"),
  "程序化滚动必须按预期 scrollTop 识别，不能用短生命周期布尔标记误判",
);
requireCondition(
  /private readonly onScroll[\s\S]*?this\.suspension === "manual-scroll"[\s\S]*?cause: "geometry", animate: false[\s\S]*?^\s*\};/m.test(
    extension,
  ) &&
    !/private readonly onScroll[\s\S]*?this\.suspendForManualScroll\(\)[\s\S]*?^\s*\};/m.test(
      extension,
    ),
  "文档初次加载的内部 scroll 不得被误判为手动滚动；键盘导航必须保持自动定位",
);
requireCondition(
  extension.includes('this.scheduleMeasure({ cause: "navigation", animate: false })') &&
    extension.includes("this.pointerSettleFrame = ownerWindow.requestAnimationFrame"),
  "单击空选区后必须在选区稳定时同步将真实编辑行移回固定轨道",
);
requireCondition(
  extension.includes("--zendian-typewriter-content-offset"),
  "打字机动画必须使用每编辑器视觉偏移变量",
);
requireCondition(
  extension.includes(".markdown-source-view.mod-cm6") &&
    extension.includes("!sourceView.classList.contains(\"is-live-preview\")"),
  "打字机运行资格必须能从纯源码编辑器 DOM 独立确认",
);
requireCondition(
  /StateField\.define<DecorationSet>/.test(extension) &&
    /provide:\s*\(field\)\s*=>\s*EditorView\.decorations\.from\(field\)/.test(extension),
  "块级 Spacer 必须通过 StateField 的直接 decorations facet 提供",
);
requireCondition(
  !/ViewPlugin\.fromClass\([\s\S]*decorations:\s*\(/.test(extension),
  "ViewPlugin 不得间接提供会改变垂直布局的块级 Spacer",
);
requireCondition(
  !/document\.body\.(?:addClass|removeClass|toggleClass)\(["'](?:border-focus-mode|focus-mode-typewriter)/.test(
    focusClock,
  ),
  "专注时钟不得绕过编辑器增强模块直接修改专注模式类",
);
requireCondition(
  !/scale\(|font-weight\s*:|padding\s*:/.test(focusActiveRule),
  "专注活动行不得改变缩放、字重或几何内边距",
);
requireCondition(
  !/scale\(|font-weight\s*:|padding\s*:/.test(typewriterActiveRule),
  "打字机遮罩可复用发布版质感，但不得恢复会破坏固定位置的几何变化",
);
requireCondition(
  /prefers-reduced-motion:\s*reduce/.test(css),
  "打字机动画必须支持 reduced-motion",
);
requireCondition(
  !extension.includes("zendian-typewriter-focus-track") &&
    !css.includes("zendian-typewriter-focus-track"),
  "打字机遮罩必须绑定真实活动行，不能保留会与光标脱节的独立轨道",
);
requireCondition(
    /linear-gradient\(/.test(typewriterActiveRule) &&
    /var\(--interactive-accent\)\s*13%/.test(typewriterActiveRule) &&
    /border-radius:\s*8px/.test(typewriterActiveRule) &&
    !/inset 2px 0 0/.test(typewriterActiveRule) &&
    /0 4px 14px rgba\(35,\s*24,\s*32,\s*0\.065\)/.test(typewriterActiveRule) &&
    /backdrop-filter:\s*blur\(7px\) saturate\(1\.06\)/.test(typewriterActiveRule),
  "打字机活动行必须保留发布版毛玻璃语言和渐隐表面，且不得恢复左侧强调线",
);

function loadPureModule(path) {
  const code = ts.transpileModule(read(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: path,
  }).outputText;
  const exports = {};
  new Function("exports", code)(exports);
  return exports;
}

const helpers = {
  ...loadPureModule("src/modules/editor-enhance/typewriter.math.ts"),
  ...loadPureModule("src/modules/editor-enhance/focus-mode-runtime.ts"),
  ...loadPureModule("src/modules/editor-enhance/source-mode.math.ts"),
};

assert.deepEqual(helpers.calculateAnchor(1000), {
  anchorLocalY: 550,
  smallViewport: false,
});
assert.deepEqual(helpers.calculateAnchor(200), {
  anchorLocalY: 100,
  smallViewport: true,
});
assert.deepEqual(helpers.calculateScrollTarget(100, 40, 1000, 400), {
  desiredScrollTop: 140,
  appliedDelta: 40,
});
assert.deepEqual(helpers.calculateScrollTarget(590, 40, 1000, 400), {
  desiredScrollTop: 600,
  appliedDelta: 10,
});
assert.equal(helpers.calculateMotionDuration(40, 20, false, false), 100);
assert.equal(helpers.calculateMotionDuration(60, 20, false, false), 0);
assert.equal(helpers.calculateMotionDuration(20, 20, false, true), 0);
assert.equal(helpers.mergeMotionOffset(8, 20), 28);
assert.deepEqual(helpers.resolveFocusModeRuntime(false, true, true), {
  persistent: false,
  clockTemporary: true,
  active: true,
  typewriterActive: true,
});
assert.equal(
  helpers.shouldRestoreSourceMode(
    {
      originalWasSource: false,
      switchedByPlugin: true,
      manuallyOverridden: false,
      filePathAtSwitch: "note.md",
      noticeShown: false,
    },
    true,
  ),
  true,
);
assert.equal(
  helpers.shouldRestoreSourceMode(
    {
      originalWasSource: false,
      switchedByPlugin: true,
      manuallyOverridden: true,
      filePathAtSwitch: "note.md",
      noticeShown: true,
    },
    true,
  ),
  false,
);

if (failures.length) {
  console.error("打字机契约检查失败：");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("✓ 打字机行为与契约检查通过");
