/**
 * 断言预算闸门（方案 §4.4：CI 断言 **N ≥ 下限**，不只看「没报错」）。
 *
 * ## 前提数字的来源与数法（2026-09-20 **修正**）
 *
 * 本条闸门原先写死 `>= 112`，那个 112 **是错数** —— 来自上一轮复核者对
 * `docs/PLAN-deer-ui.md` 的误记（队长已独立实测裁定）。真实的账是：
 *
 * | 项 | 条数 | 来源 |
 * |---|---|---|
 * | 应用侧 `tests/ui-kit.test.tsx`（宿主 `ui kit` 小节）运行期断言 | **70** | 宿主侧实测（下面两种数法都能复现） |
 * | └ 搬进库（本仓库 `tests/ui-kit.test.tsx`） | **62** | 名字逐字保留，仍是 `ui.*` |
 * | └ 留在宿主侧 | **8** | `ui.demo.*` 6 条（示范页在 `examples/`，库测试不依赖）+ `ui.overlay-full-wiring`（断言宿主 `App.tsx` 接线）+ `ui.dropmenu.pop-css`（断言宿主 `style.css`） |
 * | 库侧 A0-1/A0-2/A0-3 + 库测试基建 | **61** | 本仓库自己的判据与基建（含本条闸门） |
 * | **库侧合计** | **123** | 62 + 61 |
 *
 * **两种数法**（README「计数口径」一节有完整命令）：
 *  ① **宿主分段统计法**（不需要本仓库）：跑应用侧 `node tests/.ts-out/tests/run-tests.js`，
 *     按 `--- 小节名 ---` 分段统计 `ok ` 行；总数须与末尾 `assertions:` 一致（= 8090）——口径自洽的判据。
 *  ② **夹具法**：`npm run count:host-assertions`（本仓库脚本，只读宿主仓库，产物写 `os.tmpdir()`），
 *     把两条运行期断言**名字**都记下来，给出「搬入 / 留宿主 / 有没有改名」的名字级差集。
 *     ⚠️ 这个夹具**不在** `npm test` 里、也**不让**库测试依赖宿主的 `tests/` —— 它只是文档化的核查手段。
 *
 * ## 闸门钉什么
 *
 * 不写死外部数字，只钉**库侧自己的两个下限**：搬进来的那 62 条不许掉、A0/基建那 61 条不许掉。
 * 两个下限分开判（总数会掩盖「基建长胖、搬来的变少」这种组合）。
 * 空仓（P0 源文件还没复制）时自动**待机**，只有一条 `lib.budget.p0-pending`。
 */

import { byPrefix, ok, total } from "./common";
import { fs, path, srcDir } from "./env";

/** 应用侧搬入的断言下限（宿主 `ui kit` 小节 70 − 留宿主 8）。 */
export const MIN_HOST_MOVED = 62;
/** 库里 A0 判据 + 测试基建的断言下限（实测值，含本条闸门自己）。 */
export const MIN_LIB_BASE = 61;
/** 库侧总数下限 = 搬入 + 基建。 */
export const MIN_TOTAL = MIN_HOST_MOVED + MIN_LIB_BASE;

export function testAssertionBudget(): void {
  const p0Marker = path.join(srcDir(), "kit", "primitives.tsx");
  if (!fs.existsSync(p0Marker)) {
    ok("lib.budget.p0-pending", true, "P0 源文件尚未复制，"
      + MIN_TOTAL + " 条闸门待机（复制后自动生效）");
    return;
  }

  // `total` 是本条被计入**之前**的值（ok() 自己才 +1），所以要 +1 才是最终打印的 `assertions:` 数字。
  const finalTotal = total + 1;
  const moved = byPrefix["ui"] || 0;
  const base = (byPrefix["kit"] || 0) + (byPrefix["lib"] || 0) + 1;
  // 打印一行构成（不是断言，只为让跑测试的人**看得见**前提数字，别再来一次「112」）。
  console.log("[budget] 构成：" + finalTotal + " = 搬入 ui.* " + moved + " + 基建 kit.*+lib.* " + base
    + "；下限 " + MIN_TOTAL + " = 搬入 " + MIN_HOST_MOVED + " + 基建 " + MIN_LIB_BASE);
  ok("lib.budget.assertions",
    finalTotal >= MIN_TOTAL && moved >= MIN_HOST_MOVED && base >= MIN_LIB_BASE,
    "final total=" + finalTotal + "（下限 " + MIN_TOTAL + " = 搬入 " + MIN_HOST_MOVED + " + 基建 " + MIN_LIB_BASE
      + "）；ui.*（搬入）=" + moved + "（下限 " + MIN_HOST_MOVED + "）；kit.*+lib.*（基建）=" + base
      + "（下限 " + MIN_LIB_BASE + "）");
}
