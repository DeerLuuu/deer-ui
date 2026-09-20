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
 * **样式源也在射程里**（范围 C 的 W4）：原先这组判据只扫 `src/**` 的 `.ts/.tsx`，`src/styles/*.css`
 * 是盲区 —— 往 `kit.css` 注入 `@media (prefers-color-scheme: dark)` 或 `--sat:1px`，四条断言一条都不红。
 * 现在 `kit.host.css-*` 四条把同一套口径（库不自判主题 / PC / 安全区）扩到样式源，规则仍是**语义规则**：
 *  · 禁 `prefers-color-scheme`、`(pointer:` / `(hover:`、任何 `@media`（白名单本轮为空）；
 *  · `--sat/--sab/--sal/--sar` 的**写**是违规 —— 唯一例外是 `:root{}` 令牌块里的 `env()` 兜底默认值
 *    （`--sat:env(safe-area-inset-top,0px)` 合法，`var(--sat)` 的引用也合法）；
 *  · `[data-theme=…]` 选择器只许 `tokens.css` 里那一个 `[data-theme="light"]` 令牌块。
 * 扫描辅助函数**留在本文件**（纯函数、不碰 `tests/scan.ts`），自检段把合成样本喂给它们。
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

// ------------------------------------------------------------- A0-3 的 CSS 侧
//
// 为什么是语义规则而不是字符串黑名单：`--sat:env(safe-area-inset-top,0px)` 这类**声明**是库
// 唯一的合法写法（「库只声明 env() 兜底默认值、写入者永远是宿主」），把它判成违规就是假红。
// 违规的是**赋值/覆盖**（非 env() 的值、或不在 `:root{}` 令牌块里的 env() 声明）。

type CssBoundaryKind = "theme-media" | "pc-media" | "at-media" | "safearea-write" | "data-theme";
type CssBoundaryFinding = { kind: CssBoundaryKind; line: number; detail: string };

function lineAt(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text.charAt(i) === "\n") line++;
  return line;
}

/** CSS 去注释：把块注释换成等量空白（**保留换行**，行号不变）。
 *  CSS 里 `//` 不是注释起始（与 JS 不同），所以只认块注释 —— 注释里提到 `@media` / `--sat:1px` 不算数。 */
function stripCssComments(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const start = src.indexOf("/*", i);
    if (start < 0) {
      out += src.slice(i);
      break;
    }
    out += src.slice(i, start);
    const end = src.indexOf("*/", start + 2);
    const stop = end < 0 ? src.length : end + 2;
    for (let k = start; k < stop; k++) out += src.charAt(k) === "\n" ? "\n" : " ";
    i = stop;
  }
  return out;
}

/** 所有 `:root{ … }` 块的 [起点, 终点] 区间（大括号配平；调用前已去注释）。 */
function rootBlockRanges(src: string): [number, number][] {
  const out: [number, number][] = [];
  const re = /:root\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const open = src.indexOf("{", m.index);
    if (open < 0) break;
    let depth = 0;
    let i = open;
    for (; i < src.length; i++) {
      const c = src.charAt(i);
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    out.push([open, i]);
  }
  return out;
}

/** 扫描一份样式源（`rel` 形如 `src/styles/kit.css`，只用于 `[data-theme]` 的合法位置判定）。 */
function cssBoundaryFindings(rel: string, css: string): CssBoundaryFinding[] {
  const src = stripCssComments(css);
  const out: CssBoundaryFinding[] = [];
  const push = (kind: CssBoundaryKind, index: number, detail: string): void => {
    out.push({ kind, line: lineAt(src, index), detail });
  };
  let m: RegExpExecArray | null;

  const reTheme = /\(\s*prefers-color-scheme\s*:/g;
  while ((m = reTheme.exec(src))) push("theme-media", m.index, "CSS 里判定主题：" + m[0].replace(/\s+/g, ""));

  const rePc = /\(\s*(?:any-)?(?:pointer|hover)\s*:/g;
  while ((m = rePc.exec(src))) push("pc-media", m.index, "CSS 里判定 PC：" + m[0].replace(/\s+/g, ""));

  const reAt = /@media\b/g;
  while ((m = reAt.exec(src))) {
    push("at-media", m.index, "@media（白名单本轮为空）：" + src.slice(m.index, m.index + 60).split("{")[0].trim());
  }

  const roots = rootBlockRanges(src);
  const reDecl = /--sa[tblr]\s*:\s*([^;{}]*)/g;
  while ((m = reDecl.exec(src))) {
    const idx = m.index;
    const envFallback = /^env\s*\(/.test(m[1].trim());
    const inRoot = roots.some(([a, b]) => idx > a && idx < b);
    if (!envFallback || !inRoot) {
      push("safearea-write", idx, "写安全区变量：" + m[0].replace(/\s+/g, " ")
        + (envFallback ? "（env() 兜底但不在 :root 令牌块里 ⇒ 覆盖）" : "（不是 env() 兜底默认值）"));
    }
  }
  const reAssign = /--sa[tblr]\s*=(?!=)/g;
  while ((m = reAssign.exec(src))) push("safearea-write", m.index, "赋值形式：" + m[0].replace(/\s+/g, ""));

  const reThemeSel = /\[\s*data-theme\b[^\]]*\]/g;
  while ((m = reThemeSel.exec(src))) {
    const sel = m[0].replace(/\s+/g, "");
    const allowed = /tokens\.css$/.test(rel) && sel === '[data-theme="light"]';
    if (!allowed) push("data-theme", m.index, "自判主题的选择器：" + sel + '（只许 tokens.css 的 [data-theme="light"] 令牌块）');
  }
  return out;
}

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

  // ---- A0-3 的 CSS 侧（范围 C 的 W4）：样式源也要被看见 ----
  // 原先这里只扫 `src/**` 的 `.ts/.tsx`，`src/styles/*.css` 完全在射程外：往 kit.css 注入
  // `@media (prefers-color-scheme: dark)` 或 `--sat:1px`，上面四条一条都不会红。
  const stylesDir = path.join(src, "styles");
  const cssNames = fs.existsSync(stylesDir)
    ? fs.readdirSync(stylesDir).sort().filter((f) => f.endsWith(".css"))
    : [];
  ok("kit.host.css.sources-scanned", cssNames.length >= 2,
    "src/styles/*.css = " + cssNames.join(",") + "（样式源为空会让下面四条恒真）");

  const cssFindings: { file: string; f: CssBoundaryFinding }[] = [];
  for (const name of cssNames) {
    const rel = "src/styles/" + name;
    for (const f of cssBoundaryFindings(rel, readText(path.join(stylesDir, name)))) cssFindings.push({ file: rel, f });
  }
  const cssOf = (kind: CssBoundaryKind): string[] => cssFindings
    .filter((x) => x.f.kind === kind)
    .map((x) => x.file + ":" + x.f.line + " " + x.f.detail);

  eq("kit.host.css-no-color-scheme", cssOf("theme-media"), []);
  eq("kit.host.css-safearea-decls", cssOf("safearea-write"), []);
  eq("kit.host.css-media-allowlist", [...cssOf("pc-media"), ...cssOf("at-media")], []);
  eq("kit.host.css-no-data-theme", cssOf("data-theme"), []);

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

  // 自检（CSS 侧）：同一套「该抓的抓住、该放过的放过」。
  // 注意两条**放过**样本是刻意留的：`:root{--sat:env(…)}`（库唯一的合法声明）与 `var(--sat)` 的引用 ——
  // 谁把 `--sa*` 改成「见字就红」，它们立刻变红（防止把合法声明判成违规）。
  const cssSamples: [string, string, CssBoundaryKind[]][] = [
    ["src/styles/kit.css", "@media (prefers-color-scheme: dark){.dlg{color:#000}}", ["at-media", "theme-media"]],
    ["src/styles/kit.css", ":root{--sat:1px}", ["safearea-write"]],
    ["src/styles/kit.css", ".dlg{padding:var(--sat) var(--sab)}", []],
    ["src/styles/kit.css", "@media (pointer: fine){.btn{display:none}}", ["at-media", "pc-media"]],
    ["src/styles/kit.css", "@media (orientation: landscape){.btn{display:none}}", ["at-media"]],
    ["src/styles/kit.css", "/* @media (prefers-color-scheme: dark){:root{--sat:1px}} */", []],
    ["src/styles/tokens.css", ":root{--sat:env(safe-area-inset-top,0px)}", []],
    ["src/styles/kit.css", ".dlg{--sat:env(safe-area-inset-top,100px)}", ["safearea-write"]],
    ["src/styles/kit.css", '[data-theme="light"]{--bg:#fff}', ["data-theme"]],
    ["src/styles/tokens.css", '[data-theme="light"]{--bg:#fff}', []],
  ];
  cssSamples.forEach(([file, code, want], i) => {
    eq("kit.host.css.selfcheck." + i, cssBoundaryFindings(file, code).map((f) => f.kind).sort(), want);
  });
}
