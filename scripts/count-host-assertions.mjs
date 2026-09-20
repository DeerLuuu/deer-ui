#!/usr/bin/env node
/**
 * **文档化的核查手段**（不是库测试的一部分）：一条命令复现「宿主 `ui kit` 小节 70 = 搬进库 62 + 留宿主 8」这个账。
 *
 * 跑法：`npm run count:host-assertions`（可选 `$DEERUI_HOST_REPO` 指向别的 PixelCraft 检出）。
 *
 * 做法（**只读宿主仓库**，产物全在 `os.tmpdir()`）：
 *   ① 把宿主的 `src/` 与 `node_modules/` 以 **junction** 链进临时目录（一个字都不改宿主），
 *      把宿主 `tests/ui-kit.test.tsx` + `tests/common.ts` 复制进去当夹具，再补一个只负责 `finish()` 的入口；
 *   ② 用本仓库那条 tsc 解析链编译夹具，**在进程内把 `common.ok/eq` 包一层记录每条断言的运行期名字**；
 *   ③ 同样记录**库侧** `tests/.ts-out/tests/run-tests.js` 的断言名字；
 *   ④ 打印：宿主总数 / 搬入（两边同名的部分）/ 留宿主（差集，逐条列出）/ 有没有「库侧改名或新增」（必须为 0）
 *      / 库侧按前缀的构成（`ui.*` 搬入 + `kit.*`+`lib.*` 基建）。
 *
 * 三条纪律（为什么它是脚本而不是测试）：
 *   1. **库测试不依赖宿主 `tests/`**：夹具只存在于临时目录，`npm test` 完全不碰它；
 *   2. **不参与 CI**：CI 里没有宿主仓库，这条只在「两台仓库都在手边」时跑；
 *   3. 数字有变化时**两处一起改**：`tests/budget.test.ts` 的 `MIN_HOST_MOVED` 与本文件的 `EXPECTED`。
 *
 * 另一种数法（连本仓库都不需要）：在宿主仓库跑 `node tests/.ts-out/tests/run-tests.js`，
 * 按 `--- 小节名 ---` 分段统计 `ok ` 行 —— 总数须与末尾 `assertions:` 一致（= 8090），口径才自洽。
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { libRoot, runTsc } from "./tsc-path.mjs";

/** 台账里写死的期望值（改一个就要连 `tests/budget.test.ts` 一起改，README「计数口径」有说明）。 */
const EXPECTED = { host: 70, moved: 62, hostOnly: 8 };
/** 宿主侧那 8 条**为什么留宿主**（逐条理由，与 README 的台账一致）。 */
const HOST_ONLY_REASONS = {
  "ui.demo.": "示范页在 examples/（库测试不依赖它），6 条",
  "ui.overlay-full-wiring": "断言的是宿主 src/ui/App.tsx 的接线",
  "ui.dropmenu.pop-css": "断言的是宿主 src/ui/style.css",
};

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------- 采集模式
// 子进程里跑一个编译产物，记录每条运行期断言名（避免宿主与库两套测试在同一进程里互相污染 globalThis）。
if (process.argv[2] === "--collect") {
  const entry = process.argv[3];
  const outFile = process.argv[4];
  const common = require(path.join(path.dirname(entry), "common.js"));
  const names = [];
  const ok0 = common.ok;
  const eq0 = common.eq;
  common.ok = function (n, c, d) {
    names.push(n);
    return ok0(n, c, d);
  };
  common.eq = function (n, a, b) {
    names.push(n);
    return eq0(n, a, b);
  };
  const log = [];
  const log0 = console.log;
  console.log = (...a) => log.push(a.join(" "));
  let err = null;
  try {
    require(entry);
  } catch (e) {
    err = e && e.message ? e.message : String(e);
  }
  console.log = log0;
  writeFileSync(outFile, JSON.stringify({ names, tail: log.slice(-3), err }, null, 2), "utf8");
  // 编译产物里 `process.exitCode = 1` 可能被置上（FATAL）；这里按「采集成功」退出。
  process.exit(0);
}

// ---------------------------------------------------------------- 主流程
const HOST = path.resolve(process.env.DEERUI_HOST_REPO || path.join(libRoot, "..", "pixelcraft"));
const hostTest = path.join(HOST, "tests", "ui-kit.test.tsx");
const hostCommon = path.join(HOST, "tests", "common.ts");
if (!existsSync(hostTest) || !existsSync(hostCommon) || !existsSync(path.join(HOST, "src"))) {
  console.error("[deerui] 找不到宿主仓库的 tests/ui-kit.test.tsx + tests/common.ts + src/：");
  console.error("         " + HOST);
  console.error("         用 $DEERUI_HOST_REPO 指向 PixelCraft 检出（本夹具只读它，不改一个字节）。");
  process.exit(1);
}

const tmp = mkdtempSync(path.join(os.tmpdir(), "deerui-count-"));
console.log("[deerui] 宿主仓库（只读）：" + HOST);
console.log("[deerui] 夹具目录：" + tmp);

// ① 夹具：junction 宿主 src/ 与 node_modules/，复制两个测试文件，补一个 finish 入口
mkdirSync(path.join(tmp, "tests"), { recursive: true });
symlinkSync(path.join(HOST, "src"), path.join(tmp, "src"), "junction");
symlinkSync(path.join(HOST, "node_modules"), path.join(tmp, "node_modules"), "junction");
cpSync(hostCommon, path.join(tmp, "tests", "common.ts"));
cpSync(hostTest, path.join(tmp, "tests", "ui-kit.test.tsx"));
writeFileSync(
  path.join(tmp, "tests", "run-host.ts"),
  ['import { finish } from "./common";', 'import { testUiKit } from "./ui-kit.test";', "", "testUiKit();", "finish();", ""].join("\n"),
  "utf8"
);
writeFileSync(
  path.join(tmp, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        module: "commonjs",
        target: "es2019",
        lib: ["es2020", "dom"],
        moduleResolution: "node",
        jsx: "react-jsx",
        esModuleInterop: true,
        skipLibCheck: true,
        strict: false,
        // junction 进来的 src 走「链接路径」参与编译，否则 tsc 会把 rootDir 重算成 tmpdir 的上一层
        preserveSymlinks: true,
        rootDir: ".",
        outDir: "tests/.ts-out",
      },
      include: ["tests/**/*.ts", "tests/**/*.tsx"],
    },
    null,
    2
  ),
  "utf8"
);

// ② 编译夹具 + 编译库测试（幂等）
const hostTc = path.join(tmp, "tsconfig.json");
if (runTsc(["-p", hostTc], { quiet: false }) !== 0) {
  console.error("[deerui] 夹具编译失败");
  process.exit(1);
}
const libTestsTc = path.join(libRoot, "tests", "tsconfig.json");
if (runTsc(["-p", libTestsTc], { quiet: true }) !== 0) {
  console.error("[deerui] 库测试编译失败（tests/tsconfig.json）");
  process.exit(1);
}

// ③ 分别在子进程里采集名字
function collect(entry, label) {
  const out = path.join(tmp, label + "-names.json");
  const res = spawnSync(process.execPath, [process.argv[1], "--collect", entry, out], { stdio: "inherit", cwd: libRoot });
  if (res.status !== 0 || !existsSync(out)) {
    console.error("[deerui] 采集 " + label + " 失败");
    process.exit(1);
  }
  return JSON.parse(readFileSync(out, "utf8"));
}

const hostRun = collect(path.join(tmp, "tests", ".ts-out", "tests", "run-host.js"), "host");
const libRun = collect(path.join(libRoot, "tests", ".ts-out", "tests", "run-tests.js"), "lib");

const hostUi = hostRun.names.filter((n) => n.startsWith("ui."));
const libUi = libRun.names.filter((n) => n.startsWith("ui."));
const libSet = new Set(libUi);
const hostSet = new Set(hostUi);
const moved = hostUi.filter((n) => libSet.has(n));
const hostOnly = hostUi.filter((n) => !libSet.has(n));
const onlyLib = libUi.filter((n) => !hostSet.has(n));

const byPrefix = {};
for (const n of libRun.names) {
  const p = n.split(".")[0];
  byPrefix[p] = (byPrefix[p] || 0) + 1;
}
const demoOnly = hostOnly.filter((n) => n.startsWith("ui.demo."));
const otherOnly = hostOnly.filter((n) => !n.startsWith("ui.demo."));

console.log("");
console.log("========== 计数口径（宿主 ui kit 小节）==========");
console.log("宿主 tests/ui-kit.test.tsx 运行期断言 = " + hostUi.length
  + (hostUi.length === EXPECTED.host ? "（与台账一致）" : "（⚠️ 台账记的是 " + EXPECTED.host + "，改了就要同步 EXPECTED 与 tests/budget.test.ts）"));
console.log("  搬进库（两边同名同义）      = " + moved.length
  + (moved.length === EXPECTED.moved ? "（与台账一致）" : "（⚠️ 台账记的是 " + EXPECTED.moved + "）"));
console.log("  留宿主（差集）              = " + hostOnly.length
  + (hostOnly.length === EXPECTED.hostOnly ? "（与台账一致）" : "（⚠️ 台账记的是 " + EXPECTED.hostOnly + "）"));
if (demoOnly.length) {
  console.log("      - ui.demo.* ×" + demoOnly.length + " → " + HOST_ONLY_REASONS["ui.demo."]);
  console.log("        （" + demoOnly.join(", ") + "）");
}
for (const n of otherOnly) {
  console.log("      - " + n + " → " + (HOST_ONLY_REASONS[n] || "（没写理由，补上）"));
}
console.log("库侧有、宿主没有（改名/新增，必须为 0）= " + onlyLib.length + (onlyLib.length ? " → " + onlyLib.join(", ") : ""));
console.log("");
console.log("========== 库侧构成 ==========");
console.log("库侧合计 = " + libRun.names.length + "（ui.* " + (byPrefix.ui || 0)
  + " + kit.* " + (byPrefix.kit || 0) + " + lib.* " + (byPrefix.lib || 0) + "）");
console.log("  搬入 ui.*         = " + (byPrefix.ui || 0) + "（下限 " + EXPECTED.moved + "）");
console.log("  其中 ui.demo.*    = " + libUi.filter((n) => n.startsWith("ui.demo.")).length
  + "（台账：0 —— 示范页在 examples/，库测试不依赖它）");
console.log("  基建 kit.*+lib.*  = " + ((byPrefix.kit || 0) + (byPrefix.lib || 0)));
console.log("");
console.log("[deerui] 夹具与名字清单留在 " + tmp + "（可以删）");

// ④ 硬判据：库侧不许有「改名/新增」的 ui.*，搬入数不许掉，差集条数必须等于台账
const problems = [];
if (onlyLib.length) problems.push("库侧出现宿主没有的 ui.* 断言（改名或新增）：" + onlyLib.join(", "));
if (moved.length < EXPECTED.moved) problems.push("搬入数 " + moved.length + " < 台账 " + EXPECTED.moved);
if (hostOnly.length !== EXPECTED.hostOnly) problems.push("留宿主条数 " + hostOnly.length + " ≠ 台账 " + EXPECTED.hostOnly);
if (moved.length + hostOnly.length !== hostUi.length) problems.push("账不平：搬入 + 留宿主 ≠ 宿主总数");

if (problems.length) {
  console.error("[deerui] count:host-assertions FAIL");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log("[deerui] count:host-assertions: OK（" + hostUi.length + " = " + moved.length + " + " + hostOnly.length + "）");
