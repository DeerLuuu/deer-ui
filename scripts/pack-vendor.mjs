#!/usr/bin/env node
/**
 * 打 tarball，并按**应用侧 vendor 的约定文件名**再落一份：`deerui-0.1.0.tgz`。
 *
 * 为什么需要这一步：npm 的 tarball 文件名由**包名**决定，所以 `npm pack` 出来的是
 * `deer-ui-0.1.0.tgz`；而方案 §4.6 / 应用侧消费路径写的是 `file:vendor/deerui-<version>.tgz`。
 * 两个名字指同一份包（装完仍是 `deer-ui`），差一个连字符 —— 手工重命名最容易记错，
 * 所以让脚本一次产出两份并打印 sha256，应用侧直接拷 `deerui-<version>.tgz` 进 `vendor/` 即可。
 *
 * 跑法：`npm run pack:vendor`（`prepack` 会先 build + check:dist，所以产物必然自洽）。
 */
import { copyFileSync, existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const libRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(libRoot, "package.json"), "utf8"));
const packed = `${pkg.name}-${pkg.version}.tgz`;
const vendored = `deerui-${pkg.version}.tgz`;

// 不直接 spawn `npm.cmd`：Windows 上会 EINVAL（CVE-2024-27980 之后的 Node），
// 用 shell 又会带 DEP0190 警告。最稳的一条是「用当前 node 直接跑 npm 的 CLI 入口」。
const npmCli = [
  path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
  path.join(path.dirname(process.execPath), "lib", "node_modules", "npm", "bin", "npm-cli.js"),
].find((p) => existsSync(p));
const res = npmCli
  ? spawnSync(process.execPath, [npmCli, "pack"], { cwd: libRoot, stdio: "inherit" })
  : spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["pack"], { cwd: libRoot, stdio: "inherit", shell: process.platform === "win32" });
if (res.error) {
  console.error("[deer-ui] 调用 npm pack 失败：" + res.error.message);
  process.exit(1);
}
if (res.status !== 0) process.exit(res.status === null ? 1 : res.status);

const from = path.join(libRoot, packed);
if (!existsSync(from)) {
  console.error("[deer-ui] 没找到 npm pack 的产物：" + from);
  process.exit(1);
}
const to = path.join(libRoot, vendored);
copyFileSync(from, to);
const sha = createHash("sha256").update(readFileSync(to)).digest("hex");
console.log("[deer-ui] " + packed + " → " + vendored + "（" + statSync(to).size + " B，sha256 " + sha + "）");
console.log("[deer-ui] 应用侧：拷 " + vendored + " 到 <pixelcraft>/vendor/，然后 npm i file:vendor/" + vendored);
rmSync(path.join(libRoot, packed), { force: true });
