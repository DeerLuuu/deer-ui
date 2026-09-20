#!/usr/bin/env node
/**
 * 找一个能用的 tsc 再跑（npm 脚本里所有 tsc 调用都走这里）。
 *
 * 新仓库**没有 node_modules**，而本机 `npm install --offline` 装不上（ENOTCACHED，实测见 README）。
 * 所以按顺序找：
 *   ① 本仓库 `node_modules/typescript/lib/tsc.js`（正常路径，CI 走这条）
 *   ② 环境变量 `$DEERUI_TSC`
 *   ③ **平级的 PixelCraft 检出** `../pixelcraft/node_modules/typescript/lib/tsc.js`（无网络时的权宜路线）
 *
 * 注意别照抄应用仓库那条 `node_modules/typescript/bin/tsc.js`：本机真路径在 `lib/tsc.js`，
 * `bin/tsc` 只是无扩展名的 shell 包装（方案 D5 记过这个坑）。
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const libRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const candidates = [
  { how: "本地 node_modules", file: path.join(libRoot, "node_modules", "typescript", "lib", "tsc.js") },
];
if (process.env.DEERUI_TSC) {
  candidates.push({ how: "$DEERUI_TSC", file: path.resolve(process.env.DEERUI_TSC) });
}
candidates.push({
  how: "平级 PixelCraft（离线权宜）",
  file: path.resolve(libRoot, "..", "pixelcraft", "node_modules", "typescript", "lib", "tsc.js"),
});

const found = candidates.find((c) => existsSync(c.file));
if (!found) {
  console.error("[deer-ui] 找不到可用的 tsc。装依赖（npm install），或设 $DEERUI_TSC 指向 typescript/lib/tsc.js。");
  process.exit(2);
}

const args = process.argv.slice(2);
console.error("[deer-ui] tsc: " + found.how + " → " + found.file);
const res = spawnSync(process.execPath, [found.file, ...args], { stdio: "inherit", cwd: libRoot });
process.exit(res.status === null ? 1 : res.status);
