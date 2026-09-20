/**
 * 库自带样式的**机器判据**（P2：把 tokens 与 kit 控件规则搬进库）。
 *
 * 这一组断言**完全不碰宿主仓库**（t1 的纪律：没有 PixelCraft 也得能跑），只钉库自己的四件事：
 *  ① 样式源在（`src/styles/{tokens,kit}.css`），令牌两主题齐、关键令牌与关键控件的规则都在；
 *  ② **归属不越界**：`kit.css` 里出现的每个 class，都必须真的是**库源码用过的字符串**
 *     （= 没有把应用侧的规则搬进来；判据与生成时用的那条规则同源）；
 *  ③ 产物链路接上了：`exports["./styles.css"]` → `dist/styles.css`、`build` 脚本真的会拼、
 *     `sideEffects` 没把 `*.css` 丢掉、`src/styles/*.css` 全都被拼接脚本收进去（不重不漏）；
 *  ④ 示范页**只吃库自己的样式**：`examples/demo.tsx` import 了库样式源，且不再出现宿主外壳的 class。
 *
 * 与宿主（应用）的 `{选择器→声明}` 多重集合等价**不在这里**：那需要宿主的样式表在手边，
 * 属应用侧（t3/t4）的验收 —— 库这一侧只保证「搬进来的每条规则逐条原样、且没有多搬」。
 */
import { libRoot, readJson, readText, walkSources } from "./env";
import { fs, path } from "./env";
import { ok } from "./common";

/** 去掉注释（CSS 与 TS 共用；注释里提到的东西不算数）。 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/** 选择器里出现的 class（`.foo` → foo）；要求点号后是字母，避开 `.5s` / `cubic-bezier(.2,…)`。 */
function classesInCss(css: string): string[] {
  const out = new Set<string>();
  for (const m of stripComments(css).matchAll(/\.(-?[A-Za-z][\w-]*)/g)) out.add(m[1]);
  return [...out];
}

/** 源码里**字符串字面量**出现过的词（与生成器同口径：class 是写在 className 字符串里的）。 */
function stringTokens(sources: string[]): Set<string> {
  const set = new Set<string>();
  for (const raw of sources) {
    const src = stripComments(raw);
    for (const m of src.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)) {
      const lit = m[1] ?? m[2] ?? m[3] ?? "";
      for (const tok of lit.split(/[\s"']+/)) if (/^-?[A-Za-z][\w-]*$/.test(tok)) set.add(tok);
    }
  }
  return set;
}

const countOf = (text: string, needle: string) => text.split(needle).length - 1;

export function testKitStyles(): void {
  const root = libRoot();
  const tokensPath = path.join(root, "src", "styles", "tokens.css");
  const kitPath = path.join(root, "src", "styles", "kit.css");
  const hasTokens = fs.existsSync(tokensPath);
  const hasKit = fs.existsSync(kitPath);
  const tokens = hasTokens ? readText(tokensPath) : "";
  const kit = hasKit ? readText(kitPath) : "";

  ok("kit.styles.tokens-exists", hasTokens && tokens.length > 1000,
    "src/styles/tokens.css 应存在且非空（实测 " + tokens.length + " 字符）");
  ok("kit.styles.kit-exists", hasKit && kit.length > 1000,
    "src/styles/kit.css 应存在且非空（实测 " + kit.length + " 字符）");

  // ① 令牌：两主题各恰好一次 + 关键令牌齐（少一个，控件就有一个属性回落成初始值）
  const themeBlocks = countOf(tokens, ":root{") === 1 && countOf(tokens, '[data-theme="light"]{') === 1;
  const keyTokens = ["--bg:", "--bg2:", "--line:", "--text:", "--dim:", "--accent:", "--on-accent:", "--danger:",
    "--sp-4:", "--r-2:", "--fs-3:", "--sh-2:", "--z-dlg:", "--z-guide:",
    "--sat:", "--sab:", "--sal:", "--sar:",
    "--input-bg:", "--surface-pop:", "--ctl-bg-soft:"];
  const missingTokens = keyTokens.filter((t) => !tokens.includes(t));
  ok("kit.styles.tokens-both-themes", themeBlocks,
    ":root{ ×" + countOf(tokens, ":root{") + "，[data-theme=\"light\"]{ ×" + countOf(tokens, '[data-theme="light"]{'));
  ok("kit.styles.tokens-keys", missingTokens.length === 0,
    "缺令牌：" + missingTokens.join(",") + "（共查 " + keyTokens.length + " 个）");

  // ② kit 控件的关键规则（每个公开控件至少一条；名字与组件渲染出的 class 一一对应）
  const keyRules = [
    "button{", "svg{", "input,select{", "input:not([type])",
    ".btn{", ".btn.active{", ".btn.primary{", ".btn.small{", ".btn.mini{", ".grow{",
    ".panel-mask,.dlg-mask{", ".panel{", ".panel.panel-full{",
    ".dlg{position:fixed", ".dlg-head{", ".dlg-body{", ".dlg-foot{",
    ".rowlabel{", ".row-actions{", ".set-color{", ".set-hex{",
    ".chips{", ".chip{", ".tabs{", ".tab{", ".sw{",
    ".tip-host{", ".htip{", ".htip-title{", ".htip-desc{",
    ".calcpad{", ".cp-key{", ".cp-eq{", ".cp-back{",
    ".tabbar{", ".tabbar-tabs{", ".tabbar-tab{", ".tabbar-badge{",
    ".dropmenu{", ".dropmenu-btn{", ".dropmenu-list{", ".dropmenu-item{",
    ".keep.out{", "@keyframes pcFadeIn{", "@keyframes pcDlgIn{", "@keyframes tiph{",
  ];
  const missingRules = keyRules.filter((r) => !kit.includes(r));
  ok("kit.styles.kit-key-rules", missingRules.length === 0,
    "缺规则：" + missingRules.join(" | ") + "（共查 " + keyRules.length + " 条）");

  // ③ 归属不越界：kit.css 里的每个 class 都要在库源码里真的出现过
  const libSources = [
    ...walkSources(path.join(root, "src")).map(readText),
    ...walkSources(path.join(root, "examples")).map(readText),
  ];
  const tokensUsed = stringTokens(libSources);
  const strayClasses = classesInCss(kit).filter((c) => !tokensUsed.has(c));
  ok("kit.styles.kit-classes-owned", strayClasses.length === 0,
    "kit.css 里这些 class 在库源码里找不到（疑似把应用侧规则搬进来了）：" + strayClasses.join(","));

  // ④ 产物链路：exports / build 脚本 / sideEffects / 拼接覆盖
  const pkg = readJson(path.join(root, "package.json"));
  const exportOk = pkg.exports && pkg.exports["./styles.css"] === "./dist/styles.css";
  const buildWired = typeof pkg.scripts?.build === "string" && pkg.scripts.build.includes("scripts/build-styles.mjs");
  const sideEffects = JSON.stringify(pkg.sideEffects || []);
  ok("kit.styles.exports-wired", !!exportOk && buildWired && sideEffects.includes("*.css"),
    'exports["./styles.css"]=' + JSON.stringify(pkg.exports?.["./styles.css"])
    + "；build=" + JSON.stringify(pkg.scripts?.build) + "；sideEffects=" + sideEffects);

  const builderPath = path.join(root, "scripts", "build-styles.mjs");
  const builder = fs.existsSync(builderPath) ? readText(builderPath) : "";
  const listed = new Set([...builder.matchAll(/"(src\/styles\/[\w.-]+\.css)"/g)].map((m) => m[1].replace(/\\/g, "/")));
  const actual = fs.readdirSync(path.join(root, "src", "styles")).filter((f) => f.endsWith(".css"))
    .map((f) => "src/styles/" + f);
  const uncovered = actual.filter((f) => !listed.has(f));
  const phantom = [...listed].filter((f) => !actual.includes(f));
  ok("kit.styles.builder-covers-sources", builder.length > 0 && uncovered.length === 0 && phantom.length === 0,
    "未被拼接的源：" + uncovered.join(",") + "；脚本里列了但文件不存在：" + phantom.join(",")
    + "（实际 " + actual.join(",") + "）");

  // ⑤ 无外链（R2 的 file:// 离线形态）+ 示范页自给自足
  const externals = [tokens, kit].flatMap((t) => t.match(/https?:\/\/[^\s"')]+/g) || []);
  ok("kit.styles.no-external-url", externals.length === 0, "外链：" + externals.join(","));

  const demoPath = path.join(root, "examples", "demo.tsx");
  const demo = fs.existsSync(demoPath) ? readText(demoPath) : "";
  const importsLibCss = demo.includes("../src/styles/tokens.css") && demo.includes("../src/styles/kit.css");
  const hostClasses = ["app-root", "topbar", '"title"', "note"].filter((c) => demo.includes("className=\"" + c + "\""));
  ok("kit.styles.demo-self-contained", importsLibCss && hostClasses.length === 0,
    "import 库样式=" + importsLibCss + "；仍在用宿主外壳 class：" + hostClasses.join(","));
}
