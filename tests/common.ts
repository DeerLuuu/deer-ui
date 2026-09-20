/**
 * 极简测试助手：不依赖 DOM、不依赖 @types/node。
 * 输出格式与 PixelCraft 应用侧一致：每行 `ok  <name>` / `FAIL <name>`，末尾 `assertions: N` + `ALL PASS`，
 * 这样两边的「条数」可以直接对账（方案 §4.4 的计数纪律）。
 */
export let fails = 0;

/** 真正跑过的断言条数（eq + ok）。由 finish() 打印，文档里的数字才可复现。 */
export let total = 0;

/**
 * 按断言名的**第一段前缀**分桶计数（`ui.*` / `kit.*` / `lib.*`）。
 * 用途：预算闸门要能钉住「**库自带的那 62 条控件契约**不许掉」，而不是只钉一个总数 ——
 * 总数会掩盖「基建长胖、控件契约变少」这种组合（`tests/budget.test.ts` 的口径，README 有记账表）。
 */
export const byPrefix: Record<string, number> = {};

function bump(name: string): void {
  const p = name.split(".")[0];
  byPrefix[p] = (byPrefix[p] || 0) + 1;
}

export function eq(name: string, a: unknown, b: unknown): void {
  total++;
  bump(name);
  const same = JSON.stringify(a) === JSON.stringify(b);
  if (!same) {
    fails++;
    console.log("FAIL " + name + "\n  got: " + JSON.stringify(a) + "\n  want: " + JSON.stringify(b));
  } else {
    console.log("ok  " + name);
  }
}

export function ok(name: string, cond: boolean, detail = ""): void {
  total++;
  bump(name);
  if (!cond) {
    fails++;
    console.log("FAIL " + name + (detail ? "  " + detail : ""));
  } else {
    console.log("ok  " + name);
  }
}

export function finish(): void {
  if (fails > 0) throw new Error(fails + " failure(s)");
  console.log("assertions: " + total);
  console.log("ALL PASS");
}
