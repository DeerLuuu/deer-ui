/**
 * 「找一个能用的 tsc 再跑」的共用实现（`scripts/tsc.mjs` 与 `scripts/count-host-assertions.mjs` 都用它）。
 *
 * 新仓库**没有 node_modules**，而本机 `npm install --offline` 装不上（ENOTCACHED，实测见 README），所以按顺序找：
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

/** 本仓库根（`scripts/` 的上一级）。 */
export const libRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function findTsc() {
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
  return candidates.find((c) => existsSync(c.file)) || null;
}

/** 用找到的 tsc 跑一次；返回退出码。`stdio: "inherit"` 让调用方看到原始输出。 */
export function runTsc(args, { cwd = libRoot, quiet = false } = {}) {
  const found = findTsc();
  if (!found) {
    console.error("[deer-ui] 找不到可用的 tsc。装依赖（npm install），或设 $DEERUI_TSC 指向 typescript/lib/tsc.js。");
    return 2;
  }
  if (!quiet) console.error("[deer-ui] tsc: " + found.how + " → " + found.file);
  const res = spawnSync(process.execPath, [found.file, ...args], { stdio: "inherit", cwd });
  return res.status === null ? 1 : res.status;
}
