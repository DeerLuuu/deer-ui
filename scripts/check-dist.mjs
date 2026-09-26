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
 * 双格式产物那轮又加三条，都是「产物真的能被原生加载」这条承诺的机器判据：
 *  ⑥ **两棵树的格式互斥**：`dist/` 是 ESM、`dist/cjs/` 是 CJS；两棵树各带一个格式作用域
 *     `package.json`（`type: module` / `type: commonjs`），且两棵树里不许出现对方的写法
 *     （ESM 树里不许有 `require(` / `exports.`，CJS 树里不许有 `import` / `export` 语句）。
 *     还要求**所有相对说明符都带后缀**（ESM 树 `.js`、CJS 树 `.cjs`）**且目标真实存在** —— Node 的解析器
 *     不补后缀、不认目录，漏一个就是运行期 `ERR_MODULE_NOT_FOUND`，而打包器会把这种错吃掉
 *     （所以必须在产物上判，不能只在源码上判）。
 *  ⑦ **原生加载冒烟**：真的 `require()` 一次、`import()` 一次（走 `exports` 条件，即消费者的真实路径），
 *     并且四个入口的 **CJS 与 ESM 导出值集合必须一致** —— 不一致就是「一种消费者看得见、另一种看不见」。
 *
 * 波次 D（F1 + F3）在本文件动了两处：
 *  - 判据 ① 放宽：`types` 从「必须是 `keys[0]`」改成「**必须存在**，且位置在 `import`/`require` **之前**」，
 *    允许它的值是**两级对象**（`{import, require}`），递归 `existsSync`，非字符串叶子判 FAIL 而**不是抛异常**；
 *    另加「`types.require` 必须指向 `dist/cjs/**.d.cts`」这条按格式分流的落地判据。判据本身带**自检**
 *    （N1…N6 六个合成负例，见下），所以它不可能退化成恒真。
 *  - 产物形态：CJS 树的扩展名由 `.js` / `.d.ts` 归一成 `.cjs` / `.d.cts`（`scripts/build-styles.mjs` 收尾做，
 *    本文件校验）；因此「CJS 树里不许有声明」这条**已不存在** —— 反过来要求「ESM 树的每个模块都要有
 *    配套的 `.d.cts`」，并禁止两棵树混用对方的扩展名、禁止模块清单不对应。
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

/**
 * `exports` 的形状与目标存在性（判据 ①，波次 D 的 F3 放宽版）。规则（冻结文档 §5.1）：
 *   ① 字符串值（`./styles.css`）：目标必须存在；
 *   ② 对象值（JS 子入口）：**`types` 必须存在**，且位置必须在 `import` / `require` **之前**
 *      （exports 按顺序匹配；`types` 排在它们后面 = 格式错配 —— 实测 node16+CJS 会退回 TS1479）。
 *      允许 `types` 不是第一个键，也允许它的值是**对象**（两级 `{import, require}`，CJS 消费者靠它拿 `.d.cts`）；
 *   ③ 目标逐一双检：字符串 → `existsSync`；对象 → 对每个子键值（**必须是字符串**，否则 FAIL）→ `existsSync`；
 *   ④ **任何输入都不许抛未捕获异常**：畸形值（对象叶子 / 数字 / null / 数组）判 FAIL，而不是让脚本崩。
 * @param {{exports?: Record<string, unknown>}} pkgObj 待判的 package.json
 * @param {string} root 目标路径的解析基准（仓库根）
 * @returns {string[]} 失败文案（空数组 = 通过）
 */
function checkExports(pkgObj, root) {
  const out = [];
  const isStr = (v) => typeof v === "string";
  const kindOf = (v) => (v === null ? "null" : Array.isArray(v) ? "数组" : typeof v);
  const checkTarget = (label, target) => {
    if (!isStr(target)) { out.push(label + " 的目标必须是字符串，实际是 " + kindOf(target)); return; }
    if (!existsSync(path.join(root, target))) out.push(label + " 目标不存在：" + target);
  };
  const isPlainObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  /** 「一个格式分支」的判据：`types` 必须存在且排在 `default` 之前，两者都必须是字符串且目标存在。
   *  这里只做**结构 + 存在性**；「`types` 必须落在 CJS 树」那条按格式的落地判据在下面统一做。 */
  const checkBranch = (sub, branch) => {
    if (!isPlainObj(branch)) { out.push(sub + " 必须是对象（形如 {types, default}），实际是 " + kindOf(branch)); return; }
    const bKeys = Object.keys(branch);
    if (!("types" in branch)) out.push(sub + " 缺少 types（该格式的消费者靠它拿类型）");
    if (!("default" in branch)) out.push(sub + " 缺少 default（该格式的运行期产物）");
    if ("types" in branch && bKeys.indexOf("types") > bKeys.indexOf("default")) {
      out.push(sub + " 的 types 排在 default 之后（exports 按顺序匹配）：" + bKeys.join(", "));
    }
    for (const [leaf, leafTarget] of Object.entries(branch)) checkTarget(sub + "." + leaf, leafTarget);
  };
  for (const [label, cond] of Object.entries(pkgObj.exports || {})) {
    if (label === "./package.json") continue;
    if (isStr(cond)) { checkTarget('exports["' + label + '"]', cond); continue; }
    if (!isPlainObj(cond)) {
      out.push('exports["' + label + '"] 的值必须是字符串或对象，实际是 ' + kindOf(cond));
      continue;
    }
    const keys = Object.keys(cond);
    const iTypes = keys.indexOf("types");
    // 两种形状都要认，且**都不许漏**：
    //   ① **嵌套**（本库自波次 D 起，并自 `fix/exports-types-per-format`）：
    //      `{ import: {types, default}, require: {types, default} }` —— 每个分支各自带 types。
    //   ② **平铺**：`{ types, import, require }` —— types 是顶层键，且必须在 import/require 之前。
    //  合成的自检样本里两种形状都有（N1/N2 是平铺的错位样本，N3 是目标形状），所以这里不能只认一种。
    const nestedBranches = ["import", "require"].filter((k) => isPlainObj(cond[k]));
    if (nestedBranches.length > 0) {
      for (const fmt of nestedBranches) checkBranch('exports["' + label + '"].' + fmt, cond[fmt]);
      // 嵌套形状下顶层不该再重复一个 types（重复会让「哪个生效」变得含糊）
      if (iTypes >= 0) {
        out.push('exports["' + label + '"] 在嵌套形状下不该再在顶层写 types（每个格式分支各自带 types）：' + keys.join(", "));
      }
    } else if (iTypes < 0) {
      out.push('exports["' + label + '"] 缺少 types 条件（CJS / ESM 消费者都要靠它拿类型）');
    } else {
      for (const orderKey of ["import", "require"]) {
        const i = keys.indexOf(orderKey);
        if (i >= 0 && iTypes > i) {
          out.push('exports["' + label + '"] 的 types 排在 ' + orderKey + ' 之后（exports 按顺序匹配，会让 '
            + orderKey + ' 消费者命中另一种格式的声明）：' + keys.join(", "));
        }
      }
    }
    if (nestedBranches.length === 0) {
      for (const [kind, target] of Object.entries(cond)) {
        const sub = 'exports["' + label + '"].' + kind;
        if (isStr(target)) { checkTarget(sub, target); continue; }
        if (!isPlainObj(target)) {
          out.push(sub + " 必须是字符串或两级对象（如 types 的 {import, require}），实际是 " + kindOf(target));
          continue;
        }
        for (const [leaf, leafTarget] of Object.entries(target)) checkTarget(sub + "." + leaf, leafTarget);
      }
    }
    // 按格式分流的落地判据：**CJS 消费者拿到的类型目标必须是 CJS 侧的声明**，不许拿 ESM 树的 .d.ts 冒充
    // （冒充的后果实测是 node16+CJS 的 TS1479 / TS1471，以及 node10 的 TS2307）。两种形状各取各的 require 侧：
    //   嵌套：cond.require.types ；平铺：cond.types.require
    const nestedReq = isPlainObj(cond.require) ? cond.require.types : undefined;
    const flatTypes = isPlainObj(cond.types) ? cond.types.require : undefined;
    const reqTypes = isStr(nestedReq) ? nestedReq : isStr(flatTypes) ? flatTypes : undefined;
    if (reqTypes !== undefined && (!reqTypes.startsWith("./dist/cjs/") || !reqTypes.endsWith(".d.cts"))) {
      out.push('exports["' + label + '"] 的 require 侧类型目标必须指向 dist/cjs 下的 .d.cts（按格式的 CJS 声明），实际：'
        + reqTypes + "（用 ESM 树的 .d.ts 冒充会让 node16+CJS 消费者报 TS1479）");
    }
  }
  return out;
}
failures.push(...checkExports(pkg, libRoot));
let selfTestNote = "";

// ---- 判据自检（F3 的六个负例 N1…N6，每次 check:dist 都跑） ----
// 目的：证明这套判据**不是恒真**。放宽前它遇到两级 types 会崩（TypeError）；放宽后它必须仍然抓住
// 「types 排在 import/require 之后」「没有 types」「对象里的目标不存在」「叶子不是字符串」，
// 同时对**目标形状**（types 是两级对象）放行。合成输入只喂给 checkExports()，不碰仓库里的 package.json。
{
  const okEsm = "./dist/index.d.ts";
  const okEsmJs = "./dist/index.js";
  const okCjs = "./dist/cjs/index.d.cts";
  const okCjsJs = "./dist/cjs/index.cjs";
  const bad = "./dist/NOPE.d.ts";
  const cases = [
    ["N1 types 排在 import 之后", { exports: { "./kit": { import: okEsmJs, types: { import: okEsm, require: okCjs }, require: okCjsJs } } }, false],
    ["N2 types 排在最后", { exports: { "./kit": { require: okCjsJs, import: okEsmJs, types: { import: okEsm, require: okCjs } } } }, false],
    ["N3 types 是两级对象（本轮的目标形状）", { exports: { "./kit": { types: { import: okEsm, require: okCjs }, import: okEsmJs, require: okCjsJs } } }, true],
    ["N4 types 对象里的目标不存在", { exports: { "./kit": { types: { import: bad, require: okCjs }, import: okEsmJs, require: okCjsJs } } }, false],
    ["N5 types 的叶子不是字符串", { exports: { "./kit": { types: { import: 123 }, import: okEsmJs, require: okCjsJs } } }, false],
    ["N6 完全没有 types", { exports: { "./kit": { import: okEsmJs, require: okCjsJs } } }, false],
    ["N7 types.require 用 ESM 树的 .d.ts 冒充", { exports: { "./kit": { types: { import: okEsm, require: okEsm }, import: okEsmJs, require: okCjsJs } } }, false],
    // N8…N10：**嵌套形状**（本库自波次 D 起的实际形态）。没有这三条，上面新加的嵌套分支就是没被自检覆盖的。
    ["N8 嵌套形状（本轮的真实目标形态）", { exports: { "./kit": { import: { types: okEsm, default: okEsmJs }, require: { types: okCjs, default: okCjsJs } } } }, true],
    ["N9 嵌套形状下 require 侧 types 指 ESM 树（冒充）", { exports: { "./kit": { import: { types: okEsm, default: okEsmJs }, require: { types: okEsm, default: okCjsJs } } } }, false],
    ["N10 嵌套形状下分支缺 types", { exports: { "./kit": { import: { types: okEsm, default: okEsmJs }, require: { default: okCjsJs } } } }, false],
    ["N11 嵌套形状下 types 排在 default 之后", { exports: { "./kit": { import: { types: okEsm, default: okEsmJs }, require: { default: okCjsJs, types: okCjs } } } }, false],
  ];
  const selfFails = [];
  let passed = 0;
  for (const [name, synthetic, shouldPass] of cases) {
    let got;
    try { got = checkExports(synthetic, libRoot); }
    catch (e) { selfFails.push(name + " 抛异常（判据不许崩）：" + (e && e.message)); continue; }
    const didPass = got.length === 0;
    if (didPass === shouldPass) passed++;
    else selfFails.push(name + " 期望" + (shouldPass ? "通过" : "变红") + "，实际" + (didPass ? "通过" : "变红") + "：" + got.join(" / "));
  }
  if (selfFails.length) failures.push("判据自检失败：" + selfFails.join("；"));
  else selfTestNote = "判据自检 " + passed + "/" + cases.length + "（N1…N11：平铺与嵌套两种目标形状放行，错位/缺 types/坏叶子/冒充都判红）";
}

const files = walk(distDir);
if (!files.length) failures.push("dist/ 是空的：先跑 npm run build");
// 两棵树的产物扩展名（波次 D 起）：ESM 树 `.js` / `.d.ts`，CJS 树 `.cjs` / `.d.cts`。
const js = files.filter((f) => f.endsWith(".js") || f.endsWith(".cjs"));
const dts = files.filter((f) => f.endsWith(".d.ts") || f.endsWith(".d.cts"));
if (!js.length) failures.push("dist/ 里没有 .js / .cjs");
if (!dts.length) failures.push("dist/ 里没有 .d.ts / .d.cts");

for (const f of [...js, ...dts]) {
  const text = readFileSync(f, "utf8");
  const rel = path.relative(libRoot, f).split(path.sep).join("/");
  if (text.includes("react-dom.development")) failures.push(`${rel} 里出现 react-dom.development（React 被打进库了）`);
  // 示范页（examples/demo.tsx）是 dev-only：它不进 files、也不该出现在 dist 里（方案 §2.5 / Q8）
  if (/\/demo\.(?:cjs|js|d\.ts|d\.cts)$/.test(rel)) failures.push(`${rel} 出现在 dist 里（示范页不该进产物）`);
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
const esmDts = dts.filter((f) => !f.startsWith(cjsPrefix));
const cjsDts = dts.filter((f) => f.startsWith(cjsPrefix));
if (!cjsJs.length) failures.push("dist/cjs/ 里没有 .cjs：第二遍 tsc（node scripts/tsc.mjs -p tsconfig.cjs.json）没跑");
if (!cjsDts.length) failures.push("dist/cjs/ 里没有 .d.cts：第二遍 tsc 的 declaration 没开（CJS 消费者会拿不到类型）");
// ---- 按格式分流（F1 的产物级判据）：CJS 树必须有**每个模块**的 `.d.cts`，且不许混用别的形态 ----
{
  const missing = [];
  for (const f of esmDts) {
    const rel = path.relative(distDir, f).split(path.sep).join("/").replace(/\.d\.ts$/, ".d.cts");
    if (!existsSync(path.join(distDir, "cjs", rel))) missing.push(rel);
  }
  if (missing.length) {
    failures.push("dist/cjs/ 缺 " + missing.length + " 个按格式的声明（ESM 树每个模块都要有 .d.cts）：" + missing.join(", "));
  }
  const stale = [...cjsDts.filter((f) => f.endsWith(".d.ts")), ...cjsJs.filter((f) => f.endsWith(".js"))];
  if (stale.length) {
    failures.push("dist/cjs/ 里混进了 ESM 侧的扩展名（应归一成 .cjs / .d.cts）："
      + stale.map((f) => relPosix(f)).join(", ") + "（scripts/build-styles.mjs 的收尾没跑？）");
  }
  const esmStray = dts.filter((f) => !f.startsWith(cjsPrefix) && f.endsWith(".d.cts"));
  if (esmStray.length) failures.push("ESM 树里出现 .d.cts：" + esmStray.map((f) => relPosix(f)).join(", "));
}
// 两棵树的模块清单必须一一对应（同相对路径、只差扩展名）—— CJS 树漏模块 / 有孤儿都会在这里红。
{
  const stem = (rel) => rel.replace(/\.(?:d\.cts|d\.ts|cjs|js)$/, "");
  const esmStems = new Set(esmDts.concat(esmJs).map((f) => stem(path.relative(distDir, f).split(path.sep).join("/"))));
  const cjsStems = new Set(cjsDts.concat(cjsJs).map((f) => stem(path.relative(path.join(distDir, "cjs"), f).split(path.sep).join("/"))));
  const onlyEsm = [...esmStems].filter((s) => !cjsStems.has(s));
  const onlyCjs = [...cjsStems].filter((s) => !esmStems.has(s));
  if (onlyEsm.length) failures.push("CJS 树缺模块：" + onlyEsm.join(", "));
  if (onlyCjs.length) failures.push("CJS 树多出模块（ESM 树没有）：" + onlyCjs.join(", "));
}

for (const f of esmJs) {
  const rel = relPosix(f);
  const t = stripComments(readFileSync(f, "utf8"));
  if (/\brequire\s*\(/.test(t)) failures.push(rel + " 里出现 require() —— 它在 ESM 树里（第一遍产物被 CJS 化了？）");
  if (/^\s*(?:module\.exports|exports\.)/m.test(t)) failures.push(rel + " 里出现 exports./module.exports —— 它在 ESM 树里");
  for (const m of t.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)["'](\.[^"']*)["']/g)) {
    if (!m[1].endsWith(".js")) failures.push(rel + " 的相对说明符没带 .js 后缀：" + m[1] + "（Node 不补后缀、不认目录，运行期会 ERR_MODULE_NOT_FOUND）");
    else if (!existsSync(path.resolve(path.dirname(f), m[1]))) failures.push(rel + " 的相对说明符指向不存在的文件：" + m[1]);
  }
}
for (const f of cjsJs) {
  const rel = relPosix(f);
  const t = stripComments(readFileSync(f, "utf8"));
  if (/^\s*export\s/m.test(t) || /^\s*import\s+[^\s(]/m.test(t)) failures.push(rel + " 里出现 ESM 的 import/export 语句 —— 它在 CJS 树里");
  else if (!/\brequire\s*\(/.test(t) && !/exports\./.test(t)) failures.push(rel + " 里既没有 require() 也没有 exports. —— 不像 CJS 产物");
  for (const m of t.matchAll(/\brequire\s*\(\s*["'](\.[^"']*)["']\s*\)/g)) {
    if (!m[1].endsWith(".cjs")) failures.push(rel + " 的相对 require 没带 .cjs 后缀：" + m[1] + "（CJS 树在收尾统一归一成 .cjs）");
    else if (!existsSync(path.resolve(path.dirname(f), m[1]))) failures.push(rel + " 的相对 require 指向不存在的文件：" + m[1]);
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
console.log("[deer-ui] check-dist: " + selfTestNote);
