/**
 * A0-2：**barrel 导出面快照**（方案 §2.6）。
 *
 * 「公开面 = API」这句话的机器形态：按 `package.json` 的 `exports` 逐入口把导出面**逐符号**写成
 * `tests/snapshots/barrel-exports.json`，导出面一改就红。要改就得显式跑 `npm run snapshot:barrel`，
 * 于是快照的 diff 就是「这次公开面变了什么」的清单（提交信息里必须说明）。
 *
 * 顺带两条：① `exports` 指向的**源文件必须存在**（防止 exports 指到不存在的产物）；
 * ② `index.ts` 这种入口文件**只许 re-export**（方案 §3.1）。
 */

import { eq, ok } from "./common";
import { exists, fs, libRoot, path, readJson, readText, relPosix } from "./env";
import { barrelSurface, localDeclarations, type Surface } from "./scan";

const SNAPSHOT_REL = "tests/snapshots/barrel-exports.json";

type Entry = { label: string; file: string | null };

/** 从 `package.json` 的 `exports` 反推每个子路径对应的**源文件**（dist 目标 → src 源）。 */
function entryPoints(root: string): Entry[] {
  const pkgPath = path.join(root, "package.json");
  const pkg = exists(pkgPath) ? readJson(pkgPath) : {};
  const out: Entry[] = [];
  const map = pkg.exports && typeof pkg.exports === "object" ? pkg.exports : {};
  for (const label of Object.keys(map)) {
    if (label === "./package.json") continue;
    const cond = map[label];
    const target = typeof cond === "string" ? cond : cond && (cond.import || cond.default);
    if (typeof target !== "string" || target.indexOf("./dist/") !== 0) {
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
  ok("kit.barrel.entries", entries.length >= 4, "entries=" + entries.map((e) => e.label).join(" "));
  eq("kit.barrel.entry-sources", entries.filter((e) => !e.file).map((e) => e.label), []);

  const actual: Record<string, Surface> = {};
  for (const e of entries) {
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

  // 入口 barrel 只许 re-export（实现文件如 tabs.tsx / tooltip.ts 不受这条约束）
  const locals: unknown[] = [];
  for (const e of entries) {
    if (!e.file || path.basename(e.file) !== "index.ts") continue;
    locals.push(...localDeclarations(relPosix(root, e.file), readText(e.file)));
  }
  eq("kit.barrel.reexport-only", locals, []);
}
