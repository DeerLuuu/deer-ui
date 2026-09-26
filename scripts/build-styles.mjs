#!/usr/bin/env node
/**
 * 把样式源拼成**单一 CSS**：`src/styles/*.css` → `dist/styles.css`（`npm run build` 的后半步）。
 *
 * 为什么要有这一步：`tsc` 只出 JS + `.d.ts`，不会拷 `.css`；而库的公开面要求「一条
 * `import "deer-ui/styles.css"` 就能拿到全部样式」（方案 §4.3：消费者只加一次请求，
 * `file://` 下也不多一次网络往返）。
 *
 * 三条口径：
 *   ① **顺序固定**：`tokens.css` 在前（设计令牌），`kit.css` 在后（控件规则）。规则里全是 `var(--…)`，
 *      令牌必须先声明；顺序写死在这里，不靠目录遍历的巧合。
 *   ② **只拼不改**：逐字节拼接两个源文件，一个字都不重写（源文件自己就是「逐条原样从应用样式表剪下来」的，
 *      见两个文件头的说明）；这样 `dist/styles.css` 里每条规则都能在源里逐字节找到。
 *      唯一例外是**行尾归一成 LF**：仓库 `core.autocrlf=true`，Linux 检出拿到 LF、Windows 检出拿到 CRLF，
 *      不归一就会让同一次提交在不同平台上产出**字节不同**的 `dist/styles.css`（打出来的 tarball 也就
 *      不可复现）。归一的是行尾，不是声明 —— 规则内容逐字节不变。
 *   ③ **报告产物本身**：打印字节数与规则条数 —— 「构建成功」不等于「产物里有东西」（AGENTS.md §7 记过
 *      「脚本没打、看起来像环境坑」的教训）。
 *   ④ **构建收尾（本轮新增）**：给两棵产物树各写一个「格式作用域」`package.json`
 *      （`dist/` = `type: module`、`dist/cjs/` = `type: commonjs`）。它属于「一遍源码两遍 tsc」这条链的
 *      **最后一步**，所以落在这个必然执行的收尾脚本里，而不是让 `build` 脚本去写 `node -e` 的引号体操。
 *      为什么需要它：根 `package.json` **有意不加** `type`（那会连带改掉全仓库对 `.js` 的解析语义 ——
 *      `tests/.ts-out/*.js` 是 tsc 出的 CommonJS，`scripts/*.mjs` 与 `examples/` 也在同一棵树里），
 *      于是两棵树的格式必须由各自的 `package.json` 声明，否则 Node 会把 ESM 产物按 CommonJS 解析而当场报错。
 *   ⑤ **构建收尾（波次 D 的 F1）**：CJS 树的**扩展名归一** —— `*.js → *.cjs`、`*.d.ts → *.d.cts`，
 *      并把两棵（`.cjs` 与 `.d.cts`）里的**相对说明符**由 `./x.js` 改成 `./x.cjs`。收尾后带一组守卫
 *      （见本文件末段）：任何一条不成立就**抛错、指名到文件**，不产出「看起来对」的半成品树。
 *      为什么需要它：`exports` 的 `types` 条件要按模块格式分流，CJS 消费者必须拿到 `.d.cts`
 *      （`.d.cts` 是**无条件**的 CJS 声明；`.d.ts` 的格式要靠最近的 `package.json` 推断，会被
 *      ESM 树的作用域误伤）。tsc 的产物扩展名只由**源扩展名**决定（`.ts → .js/.d.ts`、`.cts → .cjs/.d.cts`），
 *      而 `.tsx` 源**不能**改名成 `.cts`（JSX 在 `.cts` 里是语法错误：实测 `error TS1005: '>' expected`；
 *      `.ctsx` 也不是 TS 支持的扩展名：实测 `error TS6054`）。本库 12 个模块里 6 个是 `.tsx`（含公开入口
 *      `tabs.tsx`），所以「`.cts` 源镜像」这条路走不通；这里改对**生成物**做机械归一，目标形态
 *      （`.cjs` + `.d.cts` 的自洽 CJS 树）与冻结文档 §6.1 的选项 A 完全一致，且**没有**第二个真相来源
 *      —— 树仍然只由 `src/**` 经两遍 tsc 产生。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const libRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/** 顺序即层叠顺序：令牌 → 控件 */
const SOURCES = ["src/styles/tokens.css", "src/styles/kit.css"];
const OUT = "dist/styles.css";

/** 数「选择器块」条数：跳过注释、字符串与 @keyframes 的内层块只算外层一条。 */
function countRules(css) {
  let rules = 0;
  let depth = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "/" && css[i + 1] === "*") { const e = css.indexOf("*/", i + 2); i = e < 0 ? css.length : e + 1; continue; }
    if (c === '"' || c === "'") { const q = c; i++; while (i < css.length && css[i] !== q) { if (css[i] === "\\") i++; i++; } continue; }
    if (c === "{") { depth++; if (depth === 1) rules++; }
    else if (c === "}") depth--;
  }
  return rules;
}

const parts = SOURCES.map((rel) => {
  const abs = path.join(libRoot, rel);
  const text = readFileSync(abs, "utf8").replace(/\r\n?/g, "\n");
  return { rel, text };
});
const out = parts.map((p) => p.text.replace(/\s+$/, "")).join("\n") + "\n";
mkdirSync(path.join(libRoot, "dist"), { recursive: true });
writeFileSync(path.join(libRoot, OUT), out, "utf8");

const bytes = Buffer.byteLength(out, "utf8");
console.log("[deer-ui] " + OUT + "："
  + bytes + " B / " + countRules(out) + " 条规则 / " + out.split("\n").length + " 行"
  + "（" + parts.map((p) => p.rel + " " + Buffer.byteLength(p.text, "utf8") + " B").join(" + ") + "）");

// ---- 构建收尾⑤：CJS 树的扩展名归一（见文件头 ⑤） ----
/** 去掉注释：守卫只关心**代码**，而本仓库的注释里就写着 `require()` / `import()` 这类词。 */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
}
/** 说明符的三种出现形态：`require("./x.js")`（产物 JS）、`from "./x.js"`（声明）、`import("./x.js")`。 */
const SPEC_RE = /(require\s*\(\s*|from\s*|import\s*\(\s*)(["'])(\.\.?\/[^"']+)\2/g;
function walkFiles(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const abs = path.join(dir, name);
    if (statSync(abs).isDirectory()) walkFiles(abs, out);
    else out.push(abs);
  }
  return out;
}
const cjsDir = path.join(libRoot, "dist", "cjs");
if (!existsSync(cjsDir)) {
  console.log("[deer-ui] CJS 树扩展名归一：跳过（dist/cjs 不存在 —— 第二遍 tsc 没跑，check:dist 会如实报）");
} else {
  const renamed = [];
  for (const abs of walkFiles(cjsDir)) {
    if (abs.endsWith(".d.ts")) { const to = abs.slice(0, -".d.ts".length) + ".d.cts"; renameSync(abs, to); renamed.push([abs, to]); }
    else if (abs.endsWith(".js")) { const to = abs.slice(0, -".js".length) + ".cjs"; renameSync(abs, to); renamed.push([abs, to]); }
  }
  let rewritten = 0;
  for (const abs of walkFiles(cjsDir)) {
    if (!/\.(cjs|d\.cts)$/.test(abs)) continue;
    const text = readFileSync(abs, "utf8");
    const next = text.replace(SPEC_RE, (m, head, q, spec) => {
      const swapped = spec.replace(/\.js$/, ".cjs");
      if (swapped !== spec) rewritten++;
      return head + q + swapped + q;
    });
    if (next !== text) writeFileSync(abs, next, "utf8");
  }

  // ---- 守卫（任何一条不成立 → 抛错，指名到文件；绝不产出半成品树） ----
  const problems = [];
  const after = walkFiles(cjsDir);
  const relOf = (abs, base) => path.relative(base, abs).split(path.sep).join("/");
  for (const abs of after) {
    const rel = "dist/cjs/" + relOf(abs, cjsDir);
    if (!/\.(cjs|d\.cts|json)$/.test(abs)) { problems.push(rel + " 既不是 .cjs 也不是 .d.cts（归一漏了）"); continue; }
    if (!/\.(cjs|d\.cts)$/.test(abs)) continue;
    const text = readFileSync(abs, "utf8");
    if ([...text.matchAll(SPEC_RE)].length !== [...stripComments(text).matchAll(SPEC_RE)].length) {
      problems.push(rel + " 的**注释**里出现了像「相对说明符」的字符串：归一会被误伤，请改写那句注释");
    }
    for (const m of stripComments(text).matchAll(SPEC_RE)) {
      const spec = m[3];
      if (!spec.endsWith(".cjs")) { problems.push(rel + " 的相对说明符不是 .cjs：" + spec); continue; }
      if (!existsSync(path.resolve(path.dirname(abs), spec))) problems.push(rel + " 的相对说明符指向不存在的文件：" + spec);
    }
    if (abs.endsWith(".cjs")) {
      const dcts = abs.slice(0, -".cjs".length) + ".d.cts";
      if (!existsSync(dcts)) problems.push(rel + " 没有配套的 .d.cts 声明（" + path.basename(dcts) + "）—— CJS 消费者会拿不到类型");
    }
  }
  // 两棵树的模块清单必须一一对应（同相对路径、只差扩展名）：这是「CJS 树没漏模块 / 没多出孤儿」的机检。
  const stemOf = (abs, base) => relOf(abs, base).replace(/\.(?:d\.cts|d\.ts|cjs|js)$/, "");
  const esmStems = new Set(walkFiles(path.join(libRoot, "dist"))
    .filter((f) => !f.startsWith(cjsDir + path.sep) && /\.(?:js|d\.ts)$/.test(f))
    .map((f) => stemOf(f, path.join(libRoot, "dist"))));
  const cjsStems = new Set(after.filter((f) => /\.(?:cjs|d\.cts)$/.test(f)).map((f) => stemOf(f, cjsDir)));
  for (const s of esmStems) if (!cjsStems.has(s)) problems.push("CJS 树缺模块 " + s + "（ESM 树有它 —— 第二遍 tsc 的 include/声明开关退化了？）");
  for (const s of cjsStems) if (!esmStems.has(s)) problems.push("CJS 树多出模块 " + s + "（ESM 树里没有 —— 孤儿产物）");

  if (problems.length) {
    console.error("[deer-ui] CJS 树扩展名归一：FAIL（" + problems.length + " 条）");
    for (const p of problems) console.error("  - " + p);
    process.exit(1);
  }
  console.log("[deer-ui] CJS 树扩展名归一：" + renamed.filter(([, to]) => to.endsWith(".cjs")).length + " 个 .cjs + "
    + renamed.filter(([, to]) => to.endsWith(".d.cts")).length + " 个 .d.cts；相对说明符改写 " + rewritten + " 处；"
    + "模块清单与 ESM 树一一对应（" + cjsStems.size + " 个模块）");
}

// ---- 构建收尾：两棵产物树的「格式作用域」package.json（见文件头 ④） ----
// 只在目录已存在时写：CJS 那趟（第二遍 tsc --outDir dist/cjs）没跑时不凭空造目录，好让 check:dist
// 如实报「dist/cjs 里没有 .cjs」而不是被一个空目录骗过去。
const FORMAT_SCOPES = [
  { dir: "dist", type: "module" },
  { dir: "dist/cjs", type: "commonjs" },
];
const scopes = [];
for (const { dir, type } of FORMAT_SCOPES) {
  const abs = path.join(libRoot, dir);
  if (!existsSync(abs)) continue;
  writeFileSync(path.join(abs, "package.json"), JSON.stringify({ type }, null, 2) + "\n", "utf8");
  scopes.push(dir + "/package.json(" + type + ")");
}
console.log("[deer-ui] 产物格式作用域：" + (scopes.length ? scopes.join(" + ") : "（没有——check:dist 会报缺）"));
