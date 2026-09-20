#!/usr/bin/env node
/**
 * dist 产物自检（方案 §4.3 的 CI 清单里那几条能本地化的）：
 *  ① 每个 `exports` 子路径的目标文件**真实存在**（含 `types` / `import` 两条），且 `types` 条件排在**最前**
 *     —— exports 的条件是**按顺序匹配**的，types 排在 import 后面等于没写；
 *  ② dist 里**没有** `react-dom.development`（说明 React 没被打进库）；
 *  ③ dist 里**没有外链**（`https?://`，`www.w3.org/2000/svg` 是 SVG 命名空间，豁免）—— 方案 R2 的 `file://` 离线形态；
 *  ④ 产物同时有 `.js` 与 `.d.ts`（ESM + 类型声明都出来了）。
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
  for (const url of text.match(/https?:\/\/[^\s"')]+/g) || []) {
    if (url.startsWith("https://www.w3.org/2000/svg") || url.startsWith("http://www.w3.org/2000/svg")) continue;
    failures.push(`${rel} 里出现外链：${url}`);
  }
  notes.push(rel);
}

if (failures.length) {
  console.error("[deer-ui] check-dist: FAIL");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("[deer-ui] check-dist: OK（" + notes.length + " 个产物文件：" + notes.join(", ") + "）");
