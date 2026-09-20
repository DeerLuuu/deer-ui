#!/usr/bin/env node
/**
 * 打 tarball，并按**应用侧 vendor 的约定文件名**再落一份：`deerui-0.1.0.tgz`。
 *
 * 为什么需要这一步：npm 的 tarball 文件名由**包名**决定，所以 `npm pack` 出来的是
 * `deer-ui-0.1.0.tgz`；而方案 §4.6 / 应用侧消费路径写的是 `file:vendor/deerui-<version>.tgz`。
 * 两个名字指同一份包（装完仍是 `deer-ui`），差一个连字符 —— 手工重命名最容易记错，
 * 所以让脚本一次产出两份并打印指纹，应用侧直接拷 `deerui-<version>.tgz` 进 `vendor/` 即可。
 *
 * 跑法：`npm run pack:vendor`（`prepack` 会先 build + check:dist，所以产物必然自洽）。
 *
 * **可复现**（2026-09-20 加）：tarball 是「工作区文件的快照」，所以行尾必须与检出平台无关 ——
 * 行尾由仓库根的 `.gitattributes`（`* text=auto eol=lf`）统一成 LF。下面还有一道
 * **打包后的行尾闸门**：只要将要进包的文件里出现 CR，就直接失败并删掉中间产物 ——
 * 宿主把这份包的 bytes / md5 / sha256 钉进了 `tests/ui-fork.test.ts` 与 lockfile 的 `integrity`，
 * 一个带 CRLF 的包会让「照 README 重打一遍」的人对不上数，而他会以为是自己操作错了。
 */
import { copyFileSync, existsSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const libRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(libRoot, "package.json"), "utf8"));
const packed = `${pkg.name}-${pkg.version}.tgz`;
const vendored = `deerui-${pkg.version}.tgz`;
const rel = (p) => path.relative(libRoot, p).split(path.sep).join("/");

/** 会进 tarball 的文件：`files` 白名单（目录递归展开）+ npm 强制带上的 `package.json`。 */
function packableFiles() {
  const out = [];
  const add = (abs) => {
    const st = statSync(abs);
    if (st.isDirectory()) for (const name of readdirSync(abs).sort()) add(path.join(abs, name));
    else out.push(abs);
  };
  for (const entry of [...(pkg.files || []), "package.json"]) {
    const abs = path.join(libRoot, entry);
    if (existsSync(abs)) add(abs);
  }
  return out;
}

/**
 * 行尾闸门：**在 npm pack 之后**跑（此时 `prepack` 的 build 刚把 `dist/` 重新生成过，
 * 所以盘上的文件 == 真进包的那批），逐个数 CR。有一处就失败 —— 绝不产出一个指纹对不上的包。
 */
function assertLfOnly() {
  const files = packableFiles();
  const offenders = [];
  for (const f of files) {
    const buf = readFileSync(f);
    let cr = 0;
    for (const b of buf) if (b === 0x0d) cr++;
    if (cr) offenders.push(rel(f) + "（" + cr + " 个 CR）");
  }
  if (offenders.length) {
    console.error("[deer-ui] pack:vendor 中止：将要进包的文件里有 CRLF ⇒ 打出来的包不可复现。");
    for (const o of offenders) console.error("  - " + o);
    console.error("         本仓库的行尾由 .gitattributes（`* text=auto eol=lf`）统一成 LF；");
    console.error("         这条属性不会自动改写**加它之前**克隆出来的老工作区 —— 重新 clone 一次即可。");
    return false;
  }
  console.log("[deer-ui] 行尾闸门：进包的 " + files.length + " 个文件全是 LF（跨检出可复现的前提）");
  return true;
}

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
if (!assertLfOnly()) {
  rmSync(from, { force: true });   // 中途产物不留：宁可没有包，也不要一个不可复现的包
  process.exit(1);
}

const to = path.join(libRoot, vendored);
copyFileSync(from, to);
const bytes = readFileSync(to);
const md5 = createHash("md5").update(bytes).digest("hex");
const sha = createHash("sha256").update(bytes).digest("hex");
console.log("[deer-ui] " + packed + " → " + vendored + "（bytes " + statSync(to).size
  + "，md5 " + md5 + "，sha256 " + sha + "）");
console.log("[deer-ui] 应用侧：拷 " + vendored + " 到 <pixelcraft>/vendor/，然后 npm i file:vendor/" + vendored);
console.log("[deer-ui] 提醒：宿主把上面三条指纹钉进 tests/ui-fork.test.ts（VENDOR_BYTES/MD5/SHA256）与 lockfile 的 integrity，换包后要同步。");
rmSync(path.join(libRoot, packed), { force: true });
