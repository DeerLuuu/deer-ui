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
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

// ---- 构建收尾：两棵产物树的「格式作用域」package.json（见文件头 ④） ----
// 只在目录已存在时写：CJS 那趟（第二遍 tsc --outDir dist/cjs）没跑时不凭空造目录，好让 check:dist
// 如实报「dist/cjs 里没有 .js」而不是被一个空目录骗过去。
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
