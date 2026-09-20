/**
 * Node 标准库的薄封装：只包住库测试用得到的那几个 API。
 * 目的有两个：① 不引 @types/node（见 globals.d.ts 的说明）；② 扫描类判据拿到的
 * 文件列表 / 路径表示形式全仓库只有一处口径（相对路径一律 POSIX 风格，便于和快照 JSON 对账）。
 */

type FsLike = {
  readFileSync(p: string, enc: string): string;
  writeFileSync(p: string, data: string, enc: string): void;
  readdirSync(p: string): string[];
  existsSync(p: string): boolean;
  mkdirSync(p: string, o?: { recursive?: boolean }): void;
  statSync(p: string): { isDirectory(): boolean; isFile(): boolean };
};

type PathLike = {
  join(...p: string[]): string;
  resolve(...p: string[]): string;
  dirname(p: string): string;
  basename(p: string, ext?: string): string;
  relative(a: string, b: string): string;
  sep: string;
};

export const fs: FsLike = require("fs");
export const path: PathLike = require("path");

/**
 * 库根。
 * 默认：从本文件编译产物（`tests/.ts-out/tests/env.js`）**往上找第一个带 `package.json` 的目录**
 * —— 比写死「上溯 N 层」稳（改 rootDir/outDir 也不会悄悄指错）。
 * 可用 `DEERUI_LIB_ROOT` 覆盖 —— 负例验证与「用夹具跑判据」时用得上（不改仓库里的任何文件）。
 */
export function libRoot(): string {
  const env = process.env.DEERUI_LIB_ROOT;
  if (env) return path.resolve(env);
  let d = __dirname;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(d, "package.json"))) return d;
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  return path.resolve(__dirname, "..", "..", "..");
}

export function srcDir(): string {
  return path.join(libRoot(), "src");
}

export function exists(p: string): boolean {
  return fs.existsSync(p);
}

export function readText(p: string): string {
  return fs.readFileSync(p, "utf8");
}

/** 路径表示统一成 POSIX 风格（快照 / findings 里都写这种，Windows 上也能逐字节对账）。 */
export function relPosix(root: string, p: string): string {
  return path.relative(root, p).split(path.sep).join("/");
}

/**
 * 递归列出目录下的 `.ts` / `.tsx`（跳过 node_modules / dist / .git / .ts-out）。
 * 返回绝对路径，按字典序排好 —— 顺序稳定，输出才是可对账的。
 */
export function walkSources(dir: string, exts: readonly string[] = [".ts", ".tsx"]): string[] {
  const skip = new Set(["node_modules", "dist", ".git", ".ts-out", ".github"]);
  const out: string[] = [];
  const visit = (d: string): void => {
    if (!fs.existsSync(d)) return;
    for (const name of fs.readdirSync(d).sort()) {
      if (skip.has(name)) continue;
      const p = path.join(d, name);
      if (fs.statSync(p).isDirectory()) {
        visit(p);
        continue;
      }
      for (const ext of exts) {
        if (name.endsWith(ext)) {
          out.push(p);
          break;
        }
      }
    }
  };
  visit(dir);
  return out;
}

/** 读 JSON（快照文件 / package.json）。读不到或解析不了就抛，绝不静默回退成空对象。 */
export function readJson(p: string): any {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
