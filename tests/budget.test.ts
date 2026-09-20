/**
 * 断言预算闸门（方案 §4.4：CI 断言 **N ≥ 下限**，不只看「没报错」）。
 *
 * ## 这是库自己的账（2026-09-20 口径切换）
 *
 * 本条闸门只看**本仓库自己跑出来的断言条数**，不与任何外部仓库对账。
 * P0b 时期这里写的是 `MIN_HOST_MOVED = 62`（= 宿主 `ui kit` 小节 70 − 留在宿主 8）——
 * 那是**应用侧的记账**：它读宿主 `tests/ui-kit.test.tsx`，还配了一个 `scripts/count-host-assertions.mjs`
 * 夹具去链宿主的 `node_modules`。两样都在「把库变成真正独立的开源库」这一轮里**移出库**
 * （夹具脚本已删、`count:host-assertions` 这条 npm script 已删）。理由：① 库测试**不许**依赖宿主仓库
 * （没有 PixelCraft 也得能测）；② 应用侧自己会收下那份台账。宿主那份数的归属见应用仓库
 * `docs/PLAN-deer-ui.md` §10，别在本仓库里复活它。
 *
 * ## 闸门钉什么
 *
 * 下限取**本仓库实测现值**，两道分开判（只钉总数会掩盖「基建长胖、控件契约变少」这种组合）：
 *
 * | 项 | 条数 | 来源 |
 * |---|---|---|
 * | `ui.*` 控件 DOM 契约 | **62** | 库自带（`tests/ui-kit.test.tsx`） |
 * | `kit.*` + `lib.*`（A0 三条判据 + 测试基建 + 样式归属判据 + 本条闸门） | **72** | 库自带 |
 * | **库侧合计** | **134** | `npm test` 末行 `assertions:` 的实测值 |
 *
 * 数法：`npm test` 末尾打印 `assertions: N`；`tests/common.ts` 的 `byPrefix` 另给按前缀的构成。
 * 断言条数**只许涨**：要降就得改这里的下限，并在提交信息里写清为什么（别悄悄把闸门调松）。
 *
 * 空仓（P0 源文件还没复制）时自动**待机**，只有一条 `lib.budget.p0-pending`。
 */

import { byPrefix, ok, total } from "./common";
import { fs, path, srcDir } from "./env";

/** 库自带控件契约断言（`ui.*`）的下限。 */
export const MIN_CONTRACT = 62;
/** 库自身判据 + 测试基建（`kit.*` + `lib.*`）的下限，含本条闸门自己。 */
export const MIN_INFRA = 72;
/** 库侧断言总数下限 = 控件契约 + 判据与基建。 */
export const MIN_TOTAL = MIN_CONTRACT + MIN_INFRA;

export function testAssertionBudget(): void {
  const p0Marker = path.join(srcDir(), "kit", "primitives.tsx");
  if (!fs.existsSync(p0Marker)) {
    ok("lib.budget.p0-pending", true, "P0 源文件尚未复制，"
      + MIN_TOTAL + " 条闸门待机（复制后自动生效）");
    return;
  }

  // `total` 是本条被计入**之前**的值（ok() 自己才 +1），所以要 +1 才是最终打印的 `assertions:` 数字。
  const finalTotal = total + 1;
  const contract = byPrefix["ui"] || 0;
  const infra = (byPrefix["kit"] || 0) + (byPrefix["lib"] || 0) + 1;
  // 打印一行构成（不是断言，只为让跑测试的人**看得见**前提数字）。
  console.log("[budget] 构成：" + finalTotal + " = 控件契约 ui.* " + contract + " + 判据与基建 kit.*+lib.* " + infra
    + "；下限 " + MIN_TOTAL + " = 控件契约 " + MIN_CONTRACT + " + 判据与基建 " + MIN_INFRA);
  ok("lib.budget.assertions",
    finalTotal >= MIN_TOTAL && contract >= MIN_CONTRACT && infra >= MIN_INFRA,
    "final total=" + finalTotal + "（下限 " + MIN_TOTAL + " = 控件契约 " + MIN_CONTRACT + " + 判据与基建 " + MIN_INFRA
      + "）；ui.*（控件契约）=" + contract + "（下限 " + MIN_CONTRACT + "）；kit.*+lib.*（判据与基建）=" + infra
      + "（下限 " + MIN_INFRA + "）");
}
