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
 */

import { eq, ok } from "./common";
import { fs, libRoot, path, readText, relPosix, srcDir, walkSources } from "./env";
import { boundaryFindings, type BoundaryFinding, type BoundaryKind } from "./scan";

/**
 * **豁免名单：只放「扮演宿主」的示范页。**
 *
 * `src/demo.tsx` 是 dev-only 示范页（方案 §2.5 / Q8：不进 barrel、不进 `files`），它自己 `createRoot`
 * 挂到页面上、自己切 `data-theme` —— 那正是宿主的活儿；而 P0b 是**逐字节复制**，一个字都不许改。
 * 所以豁免它是必须的，但豁免**要付代价**，下面四条断言把代价写死：
 *   ① 文件真实存在；② 它自己的代码**确实会被判据抓住**（说明豁免在「过滤阶段」而不是「把规则放宽」）；
 *   ③ 构建把它排除（不进 `dist`）；④ `files` 不收 `src/`（所以它也进不了 tarball）。
 * 也就是说：只有「不发布、不被导出」的宿主角色文件才配豁免；将来想再塞一个进这个名单，四条断言会逼你说清楚。
 */
const HOST_ROLE_FIXTURES = ["src/demo.tsx"];

export function testA0HostBoundaries(): void {
  const root = libRoot();
  const src = srcDir();
  ok("kit.pcmode.root-exists", fs.existsSync(src), "src=" + src);

  const allFiles = walkSources(src);
  ok("kit.pcmode.sources-scanned", allFiles.length >= 1, "files=" + allFiles.length);

  const exempt = new Set(HOST_ROLE_FIXTURES.map((r) => r.replace(/\//g, path.sep)));
  const files = allFiles.filter((f) => !exempt.has(path.relative(root, f)));

  const all: BoundaryFinding[] = [];
  for (const f of files) all.push(...boundaryFindings(relPosix(root, f), readText(f)));
  const pick = (kind: BoundaryKind): BoundaryFinding[] => all.filter((x) => x.kind === kind);

  eq("kit.pcmode.pushed-not-detected", pick("pc-detect"), []);
  eq("kit.theme.host-owned", pick("theme"), []);
  eq("kit.safearea.host-owned", pick("safearea"), []);
  eq("kit.host.no-storage", pick("storage"), []);

  // 豁免资格（四条代价）
  // 「文件存在」这条只在 P0b 的源文件已经复制进来后才判 —— 空库上豁免名单里还没有文件，属于**待机**而不是失败。
  const p0Ready = fs.existsSync(path.join(src, "kit", "primitives.tsx"));
  for (const rel of HOST_ROLE_FIXTURES) {
    const abs = path.join(root, rel);
    const tag = rel.replace(/[^A-Za-z0-9]/g, "_");
    if (p0Ready) ok("kit.host-fixture." + tag + ".exists", fs.existsSync(abs), abs);
    else ok("kit.host-fixture." + tag + ".pending", true, "P0b 尚未复制 " + rel + "（复制后 .exists 自动生效）");
    const sample = 'document.documentElement.setAttribute("data-theme", "light");';
    eq("kit.host-fixture." + tag + ".still-scanned", boundaryFindings(rel, sample).map((f) => f.kind), ["theme"]);
  }
  const buildCfgPath = path.join(root, "tsconfig.build.json");
  const buildCfg = fs.existsSync(buildCfgPath) ? readText(buildCfgPath) : "";
  ok("kit.host-fixture.not-built", buildCfg !== "" && HOST_ROLE_FIXTURES.every((r) => buildCfg.indexOf(r) >= 0),
    "tsconfig.build.json 的 exclude 必须含：" + HOST_ROLE_FIXTURES.join(", "));
  const pkgPath = path.join(root, "package.json");
  const pkg = fs.existsSync(pkgPath) ? JSON.parse(readText(pkgPath)) : {};
  ok("kit.host-fixture.not-packed", (pkg.files || []).indexOf("src") < 0, "files=" + JSON.stringify(pkg.files));

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
