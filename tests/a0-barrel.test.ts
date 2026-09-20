/**
 * A0-2：**barrel 导出面快照**（方案 §2.6）。
 *
 * 「公开面 = API」这句话的机器形态：按 `package.json` 的 `exports` 逐入口把导出面**逐符号**写成
 * `tests/snapshots/barrel-exports.json`，导出面一改就红。要改就得显式跑 `npm run snapshot:barrel`，
 * 于是快照的 diff 就是「这次公开面变了什么」的清单（提交信息里必须说明）。
 *
 * 顺带三条：① `exports` 指向的**源文件必须存在**（防止 exports 指到不存在的产物）；
 * ② `index.ts` 这种入口文件**只许 re-export**（方案 §3.1）；
 * ③ **非 JS 入口**（`./styles.css`）不进导出面快照（它没有 JS 导出面），由 `kit.barrel.css-entry`
 *    单独钉住「只有一个、指向 dist、源目录在」—— 免得「快照里多一个空条目」把公开面记歪。
 */

import { eq, ok } from "./common";
import { exists, fs, libRoot, path, readJson, readText, relPosix } from "./env";
import { barrelSurface, localDeclarations, type Surface } from "./scan";

const SNAPSHOT_REL = "tests/snapshots/barrel-exports.json";

/** 夹具用的 Node 原生 `fs` / `os`（`tests/env.ts` 的薄封装只包住判据真正用到的那几样）。
 *  夹具**必须**建在 `os.tmpdir()` 下、`finally` 里删掉 —— 仓库里不许留任何夹具文件。 */
const nodeFs = require("fs") as {
  mkdtempSync(prefix: string): string;
  rmSync(p: string, o?: { recursive?: boolean; force?: boolean }): void;
};
const nodeOs = require("os") as { tmpdir(): string };

type Entry = { label: string; file: string | null; css?: boolean };

/** 从 `package.json` 的 `exports` 反推每个子路径对应的**源文件**（dist 目标 → src 源）。
 *  `./styles.css` 这类**非 JS 入口**没有导出面可快照（它是一条 CSS 子路径），单独用一个标记表示，
 *  由 `kit.barrel.css-entry` 那条判据盯着 —— 不许把它悄悄塞进 JS 导出面快照里（那会让快照失真）。 */
function entryPoints(root: string): Entry[] {
  const pkgPath = path.join(root, "package.json");
  const pkg = exists(pkgPath) ? readJson(pkgPath) : {};
  const out: Entry[] = [];
  const map = pkg.exports && typeof pkg.exports === "object" ? pkg.exports : {};
  for (const label of Object.keys(map)) {
    if (label === "./package.json") continue;
    const cond = map[label];
    const target = typeof cond === "string" ? cond : cond && (cond.import || cond.default);
    if (typeof target !== "string" || !target.endsWith(".js")) {
      out.push({ label, file: null, css: true });
      continue;
    }
    if (target.indexOf("./dist/") !== 0) {
      out.push({ label, file: null });
      continue;
    }
    const rel = target.slice("./dist/".length).replace(/\.js$/, "");
    const candidates = [
      path.join(root, "src", rel + ".tsx"),
      path.join(root, "src", rel + ".ts"),
      path.join(root, "src", rel, "index.ts"),
      path.join(root, "src", rel, "index.tsx"),
    ];
    out.push({ label, file: candidates.find(exists) || null });
  }
  return out;
}

export function testA0Barrel(): void {
  const root = libRoot();
  const entries = entryPoints(root);
  const codeEntries = entries.filter((e) => !e.css);
  ok("kit.barrel.entries", codeEntries.length >= 4, "entries=" + codeEntries.map((e) => e.label).join(" "));
  eq("kit.barrel.entry-sources", codeEntries.filter((e) => !e.file).map((e) => e.label), []);

  // 非 JS 入口（样式表）：它不进导出面快照，但必须①只有一个、②指向 dist、③源文件真的在
  const stylesLabel = "./styles.css";
  const cssEntries = entries.filter((e) => e.css);
  const pkg = readJson(path.join(root, "package.json"));
  ok("kit.barrel.css-entry",
    cssEntries.length === 1 && cssEntries[0].label === stylesLabel
      && pkg.exports?.[stylesLabel] === "./dist/styles.css"
      && fs.existsSync(path.join(root, "src", "styles")),
    "cssExports=" + JSON.stringify(cssEntries.map((e) => e.label))
      + '；exports["./styles.css"]=' + JSON.stringify(pkg.exports?.[stylesLabel])
      + "；src/styles 存在=" + fs.existsSync(path.join(root, "src", "styles")));

  const actual: Record<string, Surface> = {};
  for (const e of codeEntries) {
    actual[e.label] = e.file ? barrelSurface(e.file) : { values: [], types: [] };
  }

  const snapPath = path.join(root, SNAPSHOT_REL);
  if (process.argv.indexOf("--update-barrel") >= 0) {
    fs.mkdirSync(path.dirname(snapPath), { recursive: true });
    fs.writeFileSync(snapPath, JSON.stringify(actual, null, 2) + "\n", "utf8");
    ok("kit.barrel.snapshot-written", true, SNAPSHOT_REL + "（记得在提交信息里说明导出面变化）");
    return;
  }

  ok("kit.barrel.snapshot-file", fs.existsSync(snapPath), "缺 " + SNAPSHOT_REL + "：跑 npm run snapshot:barrel");
  const want = fs.existsSync(snapPath) ? readJson(snapPath) : {};
  eq("kit.barrel.surface", actual, want);
  for (const label of Object.keys(actual)) {
    eq("kit.barrel.entry" + label.replace(/[^A-Za-z0-9]/g, "_"), actual[label], want[label]);
  }

  // 根入口 = 「全部 JS 入口的并集」（W3）。缺口：这条不变量此前**没有任何判据** —— 删掉
  // `src/index.ts` 的一条 `export *`、再把快照同步成「少了几个符号」的样子就能全绿，
  // 而公开面悄悄少掉的那几个符号没有任何东西盯着。这里在**内存里**比两个 `Surface`
  // （不读快照、不写文件）：反例走同一条路，所以必须变红，且**不许**靠重跑 `snapshot:barrel` 变绿。
  const jsEntries = codeEntries.filter((e) => e.file);
  const unionValues = new Set<string>();
  const unionTypes = new Set<string>();
  for (const e of jsEntries) {
    for (const v of actual[e.label].values) unionValues.add(v);
    for (const t of actual[e.label].types) unionTypes.add(t);
  }
  const union: Surface = { values: [...unionValues].sort(), types: [...unionTypes].sort() };
  const rootEntry = entries.filter((e) => e.label === ".")[0];
  const rootSurface: Surface = rootEntry && rootEntry.file ? barrelSurface(rootEntry.file) : { values: [], types: [] };
  ok("kit.barrel.root-union.nonvacuous",
    jsEntries.length >= 4 && union.values.length + union.types.length > 0,
    "JS 入口 " + jsEntries.length + " 个；并集值 " + union.values.length + " / 类型 " + union.types.length
      + "（并集全空会让下面那条断言恒真）");
  eq("kit.barrel.root-union", rootSurface, union);

  // 入口 barrel 只许 re-export（实现文件如 tabs.tsx / tooltip.ts 不受这条约束）
  const locals: unknown[] = [];
  for (const e of entries) {
    if (!e.file || path.basename(e.file) !== "index.ts") continue;
    locals.push(...localDeclarations(relPosix(root, e.file), readText(e.file)));
  }
  eq("kit.barrel.reexport-only", locals, []);

  // 自检：判据的语义边界（「该抓的抓住、该放过的放过」）——
  // A0-2 此前是三条 A0 判据里**唯一没有自检段**的（A0-1 / A0-3 都有）。
  // 夹具建在 `os.tmpdir()` 下、期间 `DEERUI_LIB_ROOT` 指向它，`finally` 里还原并删除 —— 不污染仓库。
  const samples: [string, string, Surface][] = [
    // 该抓的抓住：类型级星号（修复前**完全漏掉**，是「公开导出面冻结」被绕过的路）
    ["type-star", 'export type * from "./x.js";', { values: [], types: ["Api"] }],
    ["type-star-ns", 'export type * as napi from "./x.js";', { values: [], types: ["napi"] }],
    // 不许改坏：裸星号 / 命名空间星号
    ["star", 'export * from "./x.js";', { values: ["v"], types: ["Api"] }],
    ["star-ns", 'export * as ns from "./x.js";', { values: ["ns"], types: [] }],
    // 命名形式
    ["type-named", 'export type { Api } from "./x.js";', { values: [], types: ["Api"] }],
    ["type-named-alias", 'export { type Api as Alias } from "./x.js";', { values: [], types: ["Alias"] }],
    // 该放过的放过：本地声明 / 动态 import（barrelSurface 只认静态 re-export）
    ["local-type", "export type Local = 1;", { values: [], types: ["Local"] }],
    ["dynamic-import", 'void import("./x.js");', { values: [], types: [] }],
    // 空集契约：解析不到 → 空面（不许变）
    ["unresolved", 'export * from "./nope.js";', { values: [], types: [] }],
  ];
  const prevRoot = process.env.DEERUI_LIB_ROOT;
  const fixtureDir = nodeFs.mkdtempSync(path.join(nodeOs.tmpdir(), "deerui-a0-barrel-"));
  try {
    (process.env as any).DEERUI_LIB_ROOT = fixtureDir;
    fs.writeFileSync(path.join(fixtureDir, "x.ts"), "export interface Api { a: number }\nexport const v = 1;\n", "utf8");
    ok("kit.barrel.selfcheck.fixture-root", libRoot() === path.resolve(fixtureDir),
      "DEERUI_LIB_ROOT 应把判据的库根指到仓库外的夹具：" + fixtureDir);
    samples.forEach(([label, code, want], i) => {
      const entry = path.join(fixtureDir, "entry" + i + ".ts");
      fs.writeFileSync(entry, code + "\n", "utf8");
      eq("kit.barrel.selfcheck." + i + "." + label, barrelSurface(entry), want);
    });
  } finally {
    if (prevRoot === undefined) delete (process.env as any).DEERUI_LIB_ROOT;
    else (process.env as any).DEERUI_LIB_ROOT = prevRoot;
    nodeFs.rmSync(fixtureDir, { recursive: true, force: true });
  }
  ok("kit.barrel.selfcheck.fixture-cleanup", !fs.existsSync(fixtureDir), "夹具应已被删除：" + fixtureDir);
}
