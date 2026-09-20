/**
 * 库测试入口。跑法：`npm test`（= 先 tsc 编译 tests/ 到 tests/.ts-out，再 node 这个产物）。
 *
 * 输出契约（CI 与文档都按这两行报数）：
 *   assertions: N
 *   ALL PASS
 * 失败时打印 FAIL 行、抛错并置 `process.exitCode = 1` —— 不吞错、不「跳过」。
 */

import { finish } from "./common";
import { testInfra } from "./infra.test";
import { testA0Purity } from "./a0-purity.test";
import { testA0Barrel } from "./a0-barrel.test";
import { testA0HostBoundaries } from "./a0-host-boundaries.test";
import { testUiKit } from "./ui-kit.test";
import { testAssertionBudget } from "./budget.test";

function main(): void {
  console.log("--- 库测试基建（自带 DOM 桩 / 库根 / 许可证） ---");
  testInfra();
  console.log("--- A0-1 kit 纯度白名单（react / react-dom + 库内相对路径） ---");
  testA0Purity();
  console.log("--- A0-2 barrel 导出面快照（公开面 = API） ---");
  testA0Barrel();
  console.log("--- A0-3 库内不得自判 PC / 主题 / 安全区 ---");
  testA0HostBoundaries();
  console.log("--- 控件 DOM 契约（库自带；P0b 从应用侧 tests/ui-kit.test.tsx 搬来，名字逐字保留） ---");
  testUiKit();
  console.log("--- 断言预算闸门（库自己的下限 123 = 控件契约 62 + 判据与基建 61） ---");
  testAssertionBudget();
  finish();
}

try {
  main();
} catch (e) {
  const msg = e && (e as Error).message ? (e as Error).message : String(e);
  console.log("FATAL " + msg);
  if (e && (e as Error).stack) console.log((e as Error).stack);
  process.exitCode = 1;
}
