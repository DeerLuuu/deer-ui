#!/usr/bin/env node
/**
 * dist 产物自检（方案 §4.3 的 CI 清单里那几条能本地化的）：
 *  ① 每个 `exports` 子路径的目标文件**真实存在**（含 `types` / `import` / `require` 三条），且 `types` 条件
 *     排在**最前** —— exports 的条件是**按顺序匹配**的，types 排在 import 后面等于没写；
 *  ② dist 里**没有** `react-dom.development`（说明 React 没被打进库）；
 *  ③ dist 里**没有外链**（`https?://`，`www.w3.org/2000/svg` 是 SVG 命名空间，豁免）—— 方案 R2 的 `file://` 离线形态；
 *  ④ 产物同时有 `.js` 与 `.d.ts`（ESM + 类型声明都出来了）；
 *  ⑤ **样式表**（`dist/styles.css`）：非空、`:root{` 与 `[data-theme="light"]{` 各**恰好一次**（重复注入/拼接两次会在这里红）、
 *     无外链、不含示范页的 `.demo-*` 版式，**同一条（选择器 + 声明）不许出现两遍**，并打印字节数与规则条数
 *     （「构建成功」≠「产物里有东西」）。
 *     ⚠️ 这里判的是**两个令牌块**各一次，**不是** `.dlg{` —— 库 CSS 里 `.dlg` / `.panel` / `.rowlabel` / `.btn.off`
 *     都是「基础规则 + 变体 / 动画」的**合法重复**，数子串会把它误判成「注入了两遍」；「能不能改顺序」那类
 *     等价判据在应用侧按**扁平规则多重集合**比（应用仓 `tests/css-rules.ts`）。
 *
 * 跑法：`npm run check:dist`（在 `npm run build` 之后）；`prepack` 也会跑它，所以打出来的 tarball 必然自洽。
 *
 * 本轮（双格式产物）又加三条，都是「产物真的能被原生加载」这条承诺的机器判据：
 *  ⑥ **两棵树的格式互斥**：`dist/` 是 ESM、`dist/cjs/` 是 CJS；两棵树各带一个格式作用域
 *     `package.json`（`type: module` / `type: commonjs`），且两棵树里不许出现对方的写法
 *     （ESM 树里不许有 `require(` / `exports.`，CJS 树里不许有 `import` / `export` 语句）。
 *     还要求**所有相对说明符都带 `.js` 后缀** —— Node 的解析器不补后缀、不认目录，漏一个就是
 *     运行期 `ERR_MODULE_NOT_FOUND`，而打包器会把这种错吃掉（所以必须在产物上判，不能只在源码上判）。
 *  ⑦ **原生加载冒烟**：真的 `require()` 一次、`import()` 一次（走 `exports` 条件，即消费者的真实路径），
 *     并且四个入口的 **CJS 与 ESM 导出值集合必须一致** —— 不一致就是「一种消费者看得见、另一种看不见」。
 */
import { createRequire } from "node:module";
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

// ---- ⑥ 双格式：格式作用域 / 两棵树语法互斥 / 相对说明符必须带 .js ----
/** 去掉注释：判据只关心**代码**，而本仓库的源码注释里就写着 `require()` / `import()` 这类词。 */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
}
const relPosix = (p) => path.relative(libRoot, p).split(path.sep).join("/");
for (const [dir, want] of [["", "module"], ["cjs", "commonjs"]]) {
  const label = "dist/" + (dir ? dir + "/" : "") + "package.json";
  const abs = path.join(distDir, dir, "package.json");
  if (!existsSync(abs)) {
    failures.push(label + " 不存在：两棵产物树各自声明格式（由 scripts/build-styles.mjs 在构建收尾写出）");
    continue;
  }
  let got;
  try { got = JSON.parse(readFileSync(abs, "utf8")).type; }
  catch (e) { got = "<解析失败：" + e.message + ">"; }
  if (got !== want) failures.push(label + ' 里的 "type" 应为 "' + want + '"，实际 ' + JSON.stringify(got));
  notes.push(label + "(type: " + got + ")");
}

const cjsPrefix = path.join(distDir, "cjs") + path.sep;
const esmJs = js.filter((f) => !f.startsWith(cjsPrefix));
const cjsJs = js.filter((f) => f.startsWith(cjsPrefix));
if (!cjsJs.length) failures.push("dist/cjs/ 里没有 .js：第二遍 tsc（--module commonjs --outDir dist/cjs）没跑");
if (dts.some((f) => f.startsWith(cjsPrefix))) failures.push("dist/cjs/ 里出现 .d.ts：第二遍 tsc 要带 --declaration false（类型只出一份，在 ESM 树里）");

for (const f of esmJs) {
  const rel = relPosix(f);
  const t = stripComments(readFileSync(f, "utf8"));
  if (/\brequire\s*\(/.test(t)) failures.push(rel + " 里出现 require() —— 它在 ESM 树里（第一遍产物被 CJS 化了？）");
  if (/^\s*(?:module\.exports|exports\.)/m.test(t)) failures.push(rel + " 里出现 exports./module.exports —— 它在 ESM 树里");
  for (const m of t.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)["'](\.[^"']*)["']/g)) {
    if (!m[1].endsWith(".js")) failures.push(rel + " 的相对说明符没带 .js 后缀：" + m[1] + "（Node 不补后缀、不认目录，运行期会 ERR_MODULE_NOT_FOUND）");
  }
}
for (const f of cjsJs) {
  const rel = relPosix(f);
  const t = stripComments(readFileSync(f, "utf8"));
  if (/^\s*export\s/m.test(t) || /^\s*import\s+[^\s(]/m.test(t)) failures.push(rel + " 里出现 ESM 的 import/export 语句 —— 它在 CJS 树里");
  else if (!/\brequire\s*\(/.test(t) && !/exports\./.test(t)) failures.push(rel + " 里既没有 require() 也没有 exports. —— 不像 CJS 产物");
  for (const m of t.matchAll(/\brequire\s*\(\s*["'](\.[^"']*)["']\s*\)/g)) {
    if (!m[1].endsWith(".js")) failures.push(rel + " 的相对 require 没带 .js 后缀：" + m[1]);
  }
}

// ---- ⑦ 原生加载冒烟：走 exports 条件真的 require / import 一次，且两条路的导出值必须一致 ----
/** 只取「值」的名字（丢掉 interop 噪声），排序后比较。 */
const valueNames = (m) => Object.keys(m).filter((k) => k !== "default" && k !== "__esModule").sort();
const nativeRequire = createRequire(import.meta.url);
const smoke = [];
for (const label of [".", "./kit", "./tabs", "./tooltip"]) {
  if (!pkg.exports || !pkg.exports[label]) continue;
  const spec = label === "." ? pkg.name : pkg.name + label.slice(1);
  let cjsKeys = null;
  let esmKeys = null;
  try { cjsKeys = valueNames(nativeRequire(spec)); }
  catch (e) { failures.push("原生 require(" + JSON.stringify(spec) + ") 失败：" + (e && e.message)); }
  try { esmKeys = valueNames(await import(spec)); }
  catch (e) { failures.push("原生 import(" + JSON.stringify(spec) + ") 失败：" + (e && e.message)); }
  if (!cjsKeys || !esmKeys) continue;
  const onlyCjs = cjsKeys.filter((k) => !esmKeys.includes(k));
  const onlyEsm = esmKeys.filter((k) => !cjsKeys.includes(k));
  if (onlyCjs.length || onlyEsm.length) {
    failures.push(spec + " 的 CJS / ESM 导出值不一致：CJS " + cjsKeys.length + " 个、ESM " + esmKeys.length
      + " 个；只在 CJS [" + onlyCjs.join(",") + "]；只在 ESM [" + onlyEsm.join(",") + "]");
  } else {
    smoke.push(spec + " " + cjsKeys.length + " 值");
  }
}

if (failures.length) {
  console.error("[deer-ui] check-dist: FAIL");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("[deer-ui] check-dist: OK（" + notes.length + " 个产物文件：" + notes.join(", ") + "）");
console.log("[deer-ui] check-dist: 原生加载 OK（" + smoke.join("；") + "；同一入口的 CJS/ESM 导出值一致）");
