/**
 * A0-1：**纯度白名单**（方案 §2.6 / §4.4「规范层」）。
 *
 * 规则：`src/**` 只许依赖 `react` / `react-dom`（含 `react/*`、`react-dom/*` 子入口）与**库内相对路径**；
 * 相对路径必须解析得到，且**不得越出 `src/`** —— 后者正是「kit 还不是自足的」那条会红的断言
 * （搬迁前 kit 里的 `../../engine/expr`、`../tooltip` 就是这么被点出来的）。
 *
 * 空库上必须绿：所以下面还有一段**自检**，把合成样本喂给 `classifySpecifier()`，
 * 断言判据本身不是恒真（该抓的抓住、该放过的放过）。
 */

import { eq, ok } from "./common";
import { fs, libRoot, readText, relPosix, srcDir, walkSources } from "./env";
import { classifySpecifier, importSpecifiers, insideDir, resolveSpec, type SpecVerdict } from "./scan";

export function testA0Purity(): void {
  const root = libRoot();
  const src = srcDir();
  ok("kit.purity.root-exists", fs.existsSync(src), "src=" + src);

  const files = walkSources(src);
  ok("kit.purity.sources-scanned", files.length >= 1, "files=" + files.length);

  const offenders: string[] = [];
  for (const f of files) {
    const rel = relPosix(root, f);
    for (const s of importSpecifiers(readText(f))) {
      const target = s.mod.startsWith(".") ? resolveSpec(f, s.mod) : null;
      const verdict = classifySpecifier(s.mod, target, target ? insideDir(src, target) : false);
      if (verdict === "ok") continue;
      const why = verdict === "not-allowed" ? "非白名单依赖" : verdict === "escape" ? "越出库根" : "解析不到";
      offenders.push(rel + ":" + s.line + " -> " + s.mod + "（" + why + "）");
    }
  }
  eq("kit.purity.offenders", offenders, []);

  // 自检：判据的语义边界（防止有人把它改成「见啥都放过」或「见啥都抓」）
  const cases: [string, string | null, boolean, SpecVerdict][] = [
    ["react", null, false, "ok"],
    ["react/jsx-runtime", null, false, "ok"],
    ["react-dom/server", null, false, "ok"],
    ["react-dom/client", null, false, "ok"],
    ["lodash", null, false, "not-allowed"],
    ["@deerluu/x", null, false, "not-allowed"],
    ["../tooltip", "/lib/src/tooltip.ts", true, "ok"],
    ["./Dialog", "/lib/src/kit/Dialog.tsx", true, "ok"],
    ["../../engine/expr", "/pixelcraft/src/engine/expr.ts", false, "escape"],
    ["./missing", null, false, "unresolved"],
  ];
  cases.forEach(([mod, target, inside, want], i) => {
    eq("kit.purity.selfcheck." + i + "." + mod.replace(/[^A-Za-z0-9]/g, "_"), classifySpecifier(mod, target, inside), want);
  });

  // 自检：**说明符收集**本身要看得见类型级 re-export —— 否则同一类盲区还有第二处：
  // `export type * from "…"` / `export type { A } from "…"` 会把**库外**模块拉进依赖图，
  // 而「只许依赖白名单 + 不越出 src/」这条判据连它们的说明符都收不到（`offenders` 恒空）。
  const specCases: [string, string[]][] = [
    ['export type * from "./x.js";', ["./x.js"]],
    ['export type { A, B as C } from "./x.js";', ["./x.js"]],
    ['export * from "./x.js";', ["./x.js"]],
    ['export * as ns from "./x.js";', ["./x.js"]],
    ['// export type * from "./x.js";', []],
  ];
  specCases.forEach(([code, want], i) => {
    eq("kit.purity.selfcheck.specifiers." + i, importSpecifiers(code).map((s) => s.mod), want);
  });
}
