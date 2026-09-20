/**
 * A0-3：**库内不得自行判定 PC 模式 / 主题 / 安全区**（方案 §2.6 A0-3 + §7.1 R3 的**修正措辞**）。
 *
 * 判据是**语义规则**，不是字符串黑名单 —— 这一点必须写清楚，否则下一个人会「顺手」把它改回
 * 「出现 matchMedia / innerWidth 就红」，那样 P0b 的逐字节复制会当场变红，与「应用零改动 + 库测试全绿」冲突：
 *  - 禁：`(pointer: …)` / `(hover: …)` / `(prefers-color-scheme: …)` 媒体特征判定、写 `data-pc` / `data-theme`、
 *         写 `--sat/--sab/--sal/--sar`、`localStorage` / `sessionStorage`；
 *  - 许：`window.innerWidth/innerHeight` 的**测量**用法（`HoverTip` / `scrub` / `tabs` 都在用）、
 *         `(orientation: landscape)` 这类**布局**查询（`primitives.tsx` 在用）。
 *
 * 断言名沿用方案里那一条：`kit.pcmode.pushed-not-detected`。
 *
 * **示范页为什么不在射程里**：`examples/demo.tsx` 是 dev-only 示范页（方案 §2.5 / Q8），它自己
 * `createRoot` 挂到页面上、自己切 `data-theme` —— 那是**宿主**的活。P0b 把它放在 `src/` **之外**的
 * `examples/`（本判据只扫 `src/**`），所以**不需要豁免名单**；`kit.examples.*` 把这件事钉住：
 * ① 它在 `src/` 之外（`src/demo.tsx` 不得存在）；② **它的正文照样会被判据抓住**
 * （证明「放过」靠的是位置，不是把规则放宽）；③ 它不进 `files`（进不了 tarball）；
 * ④ 它不进构建（`npm run check:dist` 另有一条「dist 里不得有 demo」）。
 */

import { eq, ok } from "./common";
import { fs, libRoot, path, readText, relPosix, srcDir, walkSources } from "./env";
import { boundaryFindings, type BoundaryFinding, type BoundaryKind } from "./scan";

const DEMO_REL = "examples/demo.tsx";

export function testA0HostBoundaries(): void {
  const root = libRoot();
  const src = srcDir();
  ok("kit.pcmode.root-exists", fs.existsSync(src), "src=" + src);

  const files = walkSources(src);
  ok("kit.pcmode.sources-scanned", files.length >= 1, "files=" + files.length);

  const all: BoundaryFinding[] = [];
  for (const f of files) all.push(...boundaryFindings(relPosix(root, f), readText(f)));
  const pick = (kind: BoundaryKind): BoundaryFinding[] => all.filter((x) => x.kind === kind);

  eq("kit.pcmode.pushed-not-detected", pick("pc-detect"), []);
  eq("kit.theme.host-owned", pick("theme"), []);
  eq("kit.safearea.host-owned", pick("safearea"), []);
  eq("kit.host.no-storage", pick("storage"), []);

  // 示范页的位置契约（P0b 之前待机，不让空仓库变红）
  const p0Ready = fs.existsSync(path.join(src, "kit", "primitives.tsx"));
  const demoPath = path.join(root, DEMO_REL);
  if (p0Ready) ok("kit.examples.exists", fs.existsSync(demoPath), demoPath);
  else ok("kit.examples.pending", true, "P0b 尚未复制 " + DEMO_REL + "（复制后 .exists 自动生效）");
  if (fs.existsSync(demoPath)) {
    ok("kit.examples.outside-src", !fs.existsSync(path.join(src, "demo.tsx")),
      "示范页必须在 src/ 之外（现在在 " + DEMO_REL + "）：src/demo.tsx 不得存在");
    eq("kit.examples.would-be-caught",
      boundaryFindings(DEMO_REL, readText(demoPath)).map((f) => f.kind).indexOf("theme") >= 0, true);
  }
  const pkgPath = path.join(root, "package.json");
  const pkg = fs.existsSync(pkgPath) ? JSON.parse(readText(pkgPath)) : {};
  const packed: string[] = pkg.files || [];
  ok("kit.examples.not-packed", packed.indexOf("examples") < 0 && packed.indexOf("src") < 0, "files=" + JSON.stringify(packed));

  // 自检：判据的语义边界（「该抓的抓住、该放过的放过」）
  const samples: [string, BoundaryKind[]][] = [
    ['const m = window.matchMedia("(pointer: fine)");', ["pc-detect"]],
    ['const m = window.matchMedia("(hover: hover)");', ["pc-detect"]],
    ['const m = window.matchMedia("(any-pointer: coarse)");', ["pc-detect"]],
    ['const m = window.matchMedia("(orientation: landscape)");', []],
    ['const m = window.matchMedia(mq);', []],
    ['const m = window.matchMedia("(prefers-color-scheme: dark)");', ["theme"]],
    ["const w = window.innerWidth + window.innerHeight;", []],
    ['document.documentElement.dataset.theme = "light";', ["theme"]],
    ['document.documentElement.dataset.pc = "1";', ["pc-detect"]],
    ['document.documentElement.setAttribute("data-theme", "light");', ["theme"]],
    ['document.documentElement.style.setProperty("--sat", "10px");', ["safearea"]],
    ['const v = getComputedStyle(el).getPropertyValue("--sat");', []],
    ['const style = { "--sab": "0px" };', ["safearea"]],
    ['localStorage.setItem("k", "v");', ["storage"]],
    ["const s = window.sessionStorage;", ["storage"]],
    ['// 宿主里才碰 localStorage 与 matchMedia("(pointer: fine)")', []],
    ['/* matchMedia("(pointer: fine)") */', []],
    ['className="hovertip"', []],
  ];
  samples.forEach(([code, want], i) => {
    eq("kit.pcmode.selfcheck." + i, boundaryFindings("sample.ts", code).map((f) => f.kind), want);
  });
}
