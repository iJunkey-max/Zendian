import esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const prod = process.argv[2] === "production";

const context = await esbuild.context({
  absWorkingDir: projectRoot,
  entryPoints: [path.join(projectRoot, "src/main.ts")],
  bundle: true,
  // Obsidian provides the CodeMirror runtime used by MarkdownView. Keeping
  // both packages external prevents extension values from being created by a
  // second bundled @codemirror/state instance and rejected at editor startup.
  external: ["obsidian", "@codemirror/view", "@codemirror/state"],
  format: "cjs",
  target: "es2020",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  loader: {
    ".png": "dataurl",
    ".jpg": "dataurl",
    ".jpeg": "dataurl",
  },
  outfile: path.join(projectRoot, "dist/main.js"),
  minify: prod,
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
