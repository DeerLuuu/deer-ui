#!/usr/bin/env node
/**
 * **离线应急**：把**你显式指定**的一个 `node_modules/` 里已经装好的 devDependency 以 **junction**
 * 链进本仓库的 `node_modules/`（`node_modules/` 已被 `.gitignore` 忽略，不进提交）。
 *
 * 正常姿势是 `npm ci`（仓库有 `package-lock.json`，CI 走的就是这条）；本脚本只在**真的没网**时用：
 *
 * ```sh
 * # PowerShell: $env:DEERUI_DEPS_SOURCE="D:\somewhere\node_modules"; npm run link:devdeps
 * # sh:         DEERUI_DEPS_SOURCE=/somewhere/node_modules npm run link:devdeps
 * ```
 *
 * **为什么必须显式给来源**：早先这个脚本默认去链**平级的 PixelCraft 检出**
 * （`../pixelcraft/node_modules`）—— 那是一条隐式的「邻居依赖」，既让「本机恰好能跑」掩盖
 * 「独立安装其实坏了」，也把两个仓库的安装树悄悄绑在一起。库必须能在没有宿主仓库的目录里独立装、
 * 独立测（本轮独立验证就是在 `%TEMP%` 里跑的），所以默认来源**已删除**：不设 `DEERUI_DEPS_SOURCE`
 * 就直接报错退出，绝不猜。
 *
 * 链过去的是**同一份物理文件**，因此天然满足「React 单实例」这条硬约束（顺带一提，这也正是它只配
 * 当应急手段的原因：它不是一次真安装，不写 lockfile、不校验 integrity）。
 */
import { existsSync, mkdirSync, symlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const libRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dest = path.join(libRoot, "node_modules");

const rawSource = process.env.DEERUI_DEPS_SOURCE;
if (!rawSource) {
  console.error("[deer-ui] link:devdeps 需要显式指定依赖来源（本脚本只作离线应急）。");
  console.error("         先试 npm ci（仓库有 package-lock.json）；真的没网时：");
  console.error("         PowerShell:  $env:DEERUI_DEPS_SOURCE=\"<某个已装好的 node_modules>\"; npm run link:devdeps");
  console.error("         sh:          DEERUI_DEPS_SOURCE=<某个已装好的 node_modules> npm run link:devdeps");
  process.exit(1);
}
const source = path.resolve(rawSource);

const PKGS = ["typescript", "react", "react-dom", "scheduler", "loose-envify", "js-tokens", "csstype", "prop-types", "@types"];

if (!existsSync(source)) {
  console.error("[deer-ui] 找不到依赖来源：" + source);
  console.error("         检查 $DEERUI_DEPS_SOURCE 是否指向一个装着这些 devDependency 的 node_modules，或直接 npm ci。");
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
console.log("[deer-ui] link-dev-deps 完成：link " + linked + " / skip " + skipped
  + "（来源 " + source + "；node_modules/ 不入库；有网络时请改用 npm ci）");
