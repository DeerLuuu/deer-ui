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
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
