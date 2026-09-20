#!/usr/bin/env node
/**
 * dist 产物自检（方案 §4.3 的 CI 清单里那几条能本地化的）：
 *  ① 每个 `exports` 子路径的目标文件**真实存在**（含 `types` / `import` 两条），且 `types` 条件排在**最前**
 *     —— exports 的条件是**按顺序匹配**的，types 排在 import 后面等于没写；
 *  ② dist 里**没有** `react-dom.development`（说明 React 没被打进库）；
 *  ③ dist 里**没有外链**（`https?://`，`www.w3.org/2000/svg` 是 SVG 命名空间，豁免）—— 方案 R2 的 `file://` 离线形态；
 *  ④ 产物同时有 `.js` 与 `.d.ts`（ESM + 类型声明都出来了）；
 *  ⑤ **样式表**（`dist/styles.css`）：非空、`:root{` 与 `.dlg{` 各**恰好一次**（重复注入/拼接两次会在这里红）、
 *     无外链、不含示范页的 `.demo-*` 版式，并打印字节数与规则条数（「构建成功」≠「产物里有东西」）。
 *
 * 跑法：`npm run check:dist`（在 `npm run build` 之后）；`prepack` 也会跑它，所以打出来的 tarball 必然自洽。
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const libRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(libRoot, "dist");
const failures = [];
const notes = [];

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

/** 顶层规则块（注释/字符串安全；@keyframes 只算外层一条，内层块不再算） */
function topLevelRules(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "/" && text[i + 1] === "*") { const e = text.indexOf("*/", i + 2); i = e < 0 ? text.length : e + 2; continue; }
    const start = i;
    let j = i;
    while (j < text.length && text[j] !== "{" && text[j] !== ";") j++;
    if (j >= text.length) break;
    if (text[j] === ";") { i = j + 1; continue; }
    let depth = 0, k = j;
    for (; k < text.length; k++) {
      const ch = text[k];
      if (ch === "/" && text[k + 1] === "*") { const e = text.indexOf("*/", k + 2); k = e < 0 ? text.length : e + 1; continue; }
      const q = ch === '"' ? '"' : ch === "'" ? "'" : null;
      if (q) { k++; while (k < text.length && text[k] !== q) { if (text[k] === "\\") k++; k++; } continue; }
      if (ch === "{") depth++;
      else if (ch === "}") { depth--; if (!depth) break; }
    }
    out.push({ sel: text.slice(start, j).replace(/\s+/g, " ").trim(), body: text.slice(j + 1, k).replace(/\s+/g, " ").trim() });
    i = k + 1;
  }
  return out;
}

const pkg = JSON.parse(readFileSync(path.join(libRoot, "package.json"), "utf8"));
for (const [label, cond] of Object.entries(pkg.exports || {})) {
  if (label === "./package.json") continue;
  if (typeof cond === "string") {
    if (!existsSync(path.join(libRoot, cond))) failures.push(`exports["${label}"] 目标不存在：${cond}`);
    continue;
  }
  const keys = Object.keys(cond);
  if (keys[0] !== "types") {
    failures.push(`exports["${label}"] 的条件里 types 不在最前（按顺序匹配）：${keys.join(", ")}`);
  }
  for (const [kind, target] of Object.entries(cond)) {
    if (!existsSync(path.join(libRoot, target))) failures.push(`exports["${label}"].${kind} 目标不存在：${target}`);
  }
}

const files = walk(distDir);
if (!files.length) failures.push("dist/ 是空的：先跑 npm run build");
const js = files.filter((f) => f.endsWith(".js"));
const dts = files.filter((f) => f.endsWith(".d.ts"));
if (!js.length) failures.push("dist/ 里没有 .js");
if (!dts.length) failures.push("dist/ 里没有 .d.ts");

for (const f of [...js, ...dts]) {
  const text = readFileSync(f, "utf8");
  const rel = path.relative(libRoot, f).split(path.sep).join("/");
  if (text.includes("react-dom.development")) failures.push(`${rel} 里出现 react-dom.development（React 被打进库了）`);
  // 示范页（examples/demo.tsx）是 dev-only：它不进 files、也不该出现在 dist 里（方案 §2.5 / Q8）
  if (/\/demo\.(js|d\.ts)$/.test(rel)) failures.push(`${rel} 出现在 dist 里（示范页不该进产物）`);
  for (const url of text.match(/https?:\/\/[^\s"')]+/g) || []) {
    if (url.startsWith("https://www.w3.org/2000/svg") || url.startsWith("http://www.w3.org/2000/svg")) continue;
    failures.push(`${rel} 里出现外链：${url}`);
  }
  notes.push(rel);
}

// ---- ⑤ 样式表：dist/styles.css 必须真的拼出来了 ----
const stylesPath = path.join(distDir, "styles.css");
if (!existsSync(stylesPath)) {
  failures.push("dist/styles.css 不存在：先跑 npm run build（tsc 之后还有 scripts/build-styles.mjs 这一步）");
} else {
  const cssText = readFileSync(stylesPath, "utf8");
  const count = (needle) => cssText.split(needle).length - 1;
  const bytes = Buffer.byteLength(cssText, "utf8");
  // 规则条数：跳过注释/字符串，只数最外层块（@keyframes 的内层不算）
  let rules = 0, depth = 0;
  for (let i = 0; i < cssText.length; i++) {
    const c = cssText[i];
    if (c === "/" && cssText[i + 1] === "*") { const e = cssText.indexOf("*/", i + 2); i = e < 0 ? cssText.length : e + 1; continue; }
    if (c === '"' || c === "'") { const q = c; i++; while (i < cssText.length && cssText[i] !== q) { if (cssText[i] === "\\") i++; i++; } continue; }
    if (c === "{") { depth++; if (depth === 1) rules++; } else if (c === "}") depth--;
  }
  if (!bytes) failures.push("dist/styles.css 是空的");
  if (count(":root{") !== 1) failures.push("dist/styles.css 里 `:root{` 出现 " + count(":root{") + " 次（必须恰好 1 次：拼接脚本要么漏了、要么注入了两遍）");
  if (count("[data-theme=\"light\"]{") !== 1) failures.push("dist/styles.css 里 `[data-theme=\"light\"]{` 出现 " + count("[data-theme=\"light\"]{") + " 次（必须恰好 1 次）");
  if (/\.demo-/.test(cssText)) failures.push("dist/styles.css 里出现 `.demo-*`（示范页版式是 dev-only，见 examples/demo.css）");
  for (const url of cssText.match(/https?:\/\/[^\s"')]+/g) || []) {
    if (url.startsWith("https://www.w3.org/2000/svg") || url.startsWith("http://www.w3.org/2000/svg")) continue;
    failures.push("dist/styles.css 里出现外链：" + url);
  }
  // 幂等性：同一条规则（选择器 + 声明）不许出现两遍 —— 拼接脚本跑两次、或两个源文件有重叠，都会在这里红。
  // （`.btn.off` 这类「同选择器不同声明」是源码里本来就有的两条规则，键不同，不算重复。）
  const seen = new Set();
  for (const r of topLevelRules(cssText)) {
    const key = r.sel + "{" + r.body + "}";
    if (seen.has(key)) failures.push("dist/styles.css 里有重复规则：" + key.slice(0, 80));
    seen.add(key);
  }
  notes.push("dist/styles.css(" + bytes + " B / " + rules + " 条规则 / " + seen.size + " 条唯一规则)");
}

if (failures.length) {
  console.error("[deer-ui] check-dist: FAIL");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("[deer-ui] check-dist: OK（" + notes.length + " 个产物文件：" + notes.join(", ") + "）");
