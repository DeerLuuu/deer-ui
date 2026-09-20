/**
 * 断言预算闸门（方案 §4.4：CI 断言 **N ≥ 112**，不只看「没报错」）。
 *
 * A0 骨架期库里还没有 P0 的源文件，闸门自动**待机**；P0b 把 9 个文件复制进来后，
 * 只要库侧断言总数掉到 112 以下，这条就红 —— 从而钉住「搬进来的断言一条都不许丢」。
 */

import { ok, total } from "./common";
import { fs, path, srcDir } from "./env";

export function testAssertionBudget(): void {
  const p0Marker = path.join(srcDir(), "kit", "primitives.tsx");
  if (!fs.existsSync(p0Marker)) {
    ok("lib.budget.p0-pending", true, "P0 源文件尚未复制，≥112 闸门待机（P0b 复制后自动生效）");
    return;
  }
  ok("lib.budget.assertions>=112", total >= 112, "库侧断言 total=" + total);
}
