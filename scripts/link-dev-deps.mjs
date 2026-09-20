#!/usr/bin/env node
/**
 * **无网络环境的权宜之计**：把平级 PixelCraft 检出里已经装好的 devDependency 以 **junction** 链进
 * 本仓库的 `node_modules/`（`node_modules/` 已被 `.gitignore` 忽略，不进提交）。
 *
 * 为什么需要它：本机 `npm install --offline` 装不上（实测 ENOTCACHED），而库测试要 `react` / `react-dom`
 * （`renderToStaticMarkup`）与 `@types/react*`（JSX 类型）。链过去的是**同一份物理文件**，
 * 反而天然满足「React 单实例」这条硬约束。
 *
 * 有网络时**不要**用它：删掉 `node_modules/` 直接 `npm install`（`package.json` 里该有的 devDependency 一条不少，
 * CI 走的就是那条路）。
 */
import { existsSync, mkdirSync, symlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const libRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = process.env.DEERUI_DEPS_SOURCE || path.resolve(libRoot, "..", "pixelcraft", "node_modules");
const dest = path.join(libRoot, "node_modules");

const PKGS = ["typescript", "react", "react-dom", "scheduler", "loose-envify", "js-tokens", "csstype", "prop-types", "@types"];

if (!existsSync(source)) {
  console.error("[deer-ui] 找不到依赖来源：" + source);
  console.error("         用 $DEERUI_DEPS_SOURCE 指向一个装着这些 devDependency 的 node_modules，或直接 npm install。");
  process.exit(1);
}
mkdirSync(dest, { recursive: true });

let linked = 0;
let skipped = 0;
for (const name of PKGS) {
  const from = path.join(source, name);
  const to = path.join(dest, name);
  if (!existsSync(from)) {
    console.log("skip  " + name + "（来源里没有）");
    skipped++;
    continue;
  }
  if (existsSync(to)) {
    console.log("skip  " + name + "（本地已存在，不动它）");
    skipped++;
    continue;
  }
  mkdirSync(path.dirname(to), { recursive: true });
  symlinkSync(from, to, "junction");
  console.log("link  " + name + " -> " + from);
  linked++;
}
console.log("[deer-ui] link-dev-deps 完成：link " + linked + " / skip " + skipped + "（node_modules/ 不入库；有网络时请改用 npm install）");
