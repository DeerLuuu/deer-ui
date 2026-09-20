/**
 * 三条 A0 判据用到的**纯扫描函数**。
 *
 * 之所以单独成模块：判据的「语义」必须能被单测（自检）钉住 ——
 * 否则「空库上判据全绿」可能只是因为它恒真。a0-*.test.ts 里各有一段自检，
 * 把合成样本喂进来断言「该抓的抓住、该放过的放过」。
 */

import { fs, path } from "./env";

export type Finding = { file: string; line: number; detail: string };

// ----------------------------------------------------------------- 通用

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text.charAt(i) === "\n") line++;
  return line;
}

/**
 * 把 `//` 与块注释替换成等量空格（**保留换行**，行号不变）。
 * 目的：注释里出现 `localStorage` / `matchMedia("(pointer: fine)")` 这类字样不该误报。
 * 逐字符扫、带字符串状态，所以字符串里的 `//`（例如 URL）不会被当成注释。
 */
export function stripComments(text: string): string {
  let out = "";
  let i = 0;
  const n = text.length;
  let state = "code";
  while (i < n) {
    const c = text.charAt(i);
    const d = i + 1 < n ? text.charAt(i + 1) : "";
    if (state === "code") {
      if (c === "/" && d === "/") {
        state = "line";
        out += "  ";
        i += 2;
        continue;
      }
      if (c === "/" && d === "*") {
        state = "block";
        out += "  ";
        i += 2;
        continue;
      }
      if (c === "'") state = "single";
      else if (c === '"') state = "double";
      else if (c === "`") state = "tpl";
      out += c;
      i++;
      continue;
    }
    if (state === "line") {
      if (c === "\n") {
        state = "code";
        out += c;
      } else out += " ";
      i++;
      continue;
    }
    if (state === "block") {
      if (c === "*" && d === "/") {
        state = "code";
        out += "  ";
        i += 2;
        continue;
      }
      out += c === "\n" ? "\n" : " ";
      i++;
      continue;
    }
    // 字符串内部
    if (c === "\\") {
      out += c + d;
      i += 2;
      continue;
    }
    if ((state === "single" && c === "'") || (state === "double" && c === '"') || (state === "tpl" && c === "`")) {
      state = "code";
    }
    out += c;
    i++;
  }
  return out;
}

/** 文本里所有字符串字面量的**内容**（带行号）。带状态机，所以不会把注释里的引号算进来。 */
export function stringLiterals(text: string): { value: string; line: number }[] {
  const out: { value: string; line: number }[] = [];
  let i = 0;
  const n = text.length;
  let state = "code";
  let start = 0;
  let buf = "";
  while (i < n) {
    const c = text.charAt(i);
    const d = i + 1 < n ? text.charAt(i + 1) : "";
    if (state === "code") {
      if (c === "/" && d === "/") {
        state = "line";
        i += 2;
        continue;
      }
      if (c === "/" && d === "*") {
        state = "block";
        i += 2;
        continue;
      }
      if (c === "'" || c === '"' || c === "`") {
        state = c === "'" ? "single" : c === '"' ? "double" : "tpl";
        start = i;
        buf = "";
        i++;
        continue;
      }
      i++;
      continue;
    }
    if (state === "line") {
      if (c === "\n") state = "code";
      i++;
      continue;
    }
    if (state === "block") {
      if (c === "*" && d === "/") {
        state = "code";
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (c === "\\") {
      buf += d;
      i += 2;
      continue;
    }
    const closing = state === "single" ? "'" : state === "double" ? '"' : "`";
    if (c === closing) {
      out.push({ value: buf, line: lineOf(text, start) });
      state = "code";
      i++;
      continue;
    }
    buf += c;
    i++;
  }
  return out;
}

// ------------------------------------------------- A0-1 纯度白名单

/** `react` / `react-dom` 家族（含 `react/jsx-runtime`、`react-dom/server`、`react-dom/client`）。 */
export function isReactFamily(mod: string): boolean {
  return mod === "react" || mod === "react-dom" || mod.startsWith("react/") || mod.startsWith("react-dom/");
}

export type SpecVerdict = "ok" | "escape" | "unresolved" | "not-allowed";

/**
 * 一条 import 说明符的判定。
 * @param target 相对说明符解析出来的**绝对路径**（解析不到传 null）
 * @param insideSrc 解析结果是否仍在库的 `src/` 内
 */
export function classifySpecifier(mod: string, target: string | null, insideSrc: boolean): SpecVerdict {
  if (!mod.startsWith(".")) return isReactFamily(mod) ? "ok" : "not-allowed";
  if (!target) return "unresolved";
  return insideSrc ? "ok" : "escape";
}

/** 相对说明符 → 真实文件（bundler 风格：允许省后缀，允许目录下的 index）。 */
export function resolveSpec(fromFile: string, spec: string): string | null {
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [base, base + ".ts", base + ".tsx", base + ".d.ts",
    path.join(base, "index.ts"), path.join(base, "index.tsx")];
  for (const c of candidates) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  return null;
}

export function insideDir(dir: string, p: string): boolean {
  const rel = path.relative(dir, p);
  if (rel === "" || rel.startsWith("..")) return false;
  return !/^[A-Za-z]:/.test(rel);
}

/** 文件正文里所有 import / require / re-export 的说明符（含行号，去重）。 */
export function importSpecifiers(text: string): { mod: string; line: number }[] {
  const src = stripComments(text);
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[^"'`]*?\bfrom\s+)?["']([^"']+)["']/g,
    /\bexport\s+(?:\*|\{[^}]*\})\s*(?:as\s+[A-Za-z_$][\w$]*\s+)?from\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  const seen = new Set<string>();
  const out: { mod: string; line: number }[] = [];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const mod = m[1];
      const line = lineOf(src, m.index);
      const key = line + "|" + mod;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ mod, line });
    }
  }
  return out.sort((a, b) => (a.line - b.line) || (a.mod < b.mod ? -1 : 1));
}

// ------------------------------------------------- A0-2 导出面快照

export type Surface = { values: string[]; types: string[] };

/**
 * 解析一个入口文件的**导出面**（逐符号，值 / 类型分开）。
 * `export * from "./x"` 会递归进库内的相对路径（只认能解析到的文件）。
 * 正则全部在函数内新建：本函数会递归，模块级 `g` 正则的 lastIndex 会被递归踩坏。
 */
export function barrelSurface(entryAbs: string, seen: Set<string> = new Set(), depth = 0): Surface {
  const values = new Set<string>();
  const types = new Set<string>();
  if (depth > 8 || seen.has(entryAbs) || !fs.existsSync(entryAbs)) {
    return { values: [], types: [] };
  }
  seen.add(entryAbs);
  const src = stripComments(fs.readFileSync(entryAbs, "utf8"));

  const reNamed = /export\s+(type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
  const reStar = /export\s+\*\s*(?:as\s+([A-Za-z_$][\w$]*)\s+)?from\s*["']([^"']+)["']/g;

  let m: RegExpExecArray | null;
  while ((m = reNamed.exec(src))) {
    const wholeIsType = Boolean(m[1]);
    for (const raw of m[2].split(",")) {
      const item = raw.trim();
      if (!item) continue;
      const isType = wholeIsType || /^type\s+/.test(item);
      const body = item.replace(/^type\s+/, "");
      const alias = body.split(/\s+as\s+/);
      const name = (alias.length > 1 ? alias[1] : alias[0]).trim();
      if (!/^[A-Za-z_$][\w$]*$/.test(name)) continue;
      if (isType) types.add(name);
      else values.add(name);
    }
  }
  while ((m = reStar.exec(src))) {
    const nsName = m[1];
    if (nsName) {
      values.add(nsName);
      continue;
    }
    const target = resolveSpec(entryAbs, m[2]);
    if (!target) continue;
    const sub = barrelSurface(target, seen, depth + 1);
    for (const v of sub.values) values.add(v);
    for (const t of sub.types) types.add(t);
  }

  const reLocalValue = /^export\s+(?:declare\s+)?(?:async\s+)?(const|let|var|function|class|enum)\s+([A-Za-z_$][\w$]*)/gm;
  const reLocalType = /^export\s+(?:declare\s+)?(type|interface)\s+([A-Za-z_$][\w$]*)/gm;
  while ((m = reLocalValue.exec(src))) values.add(m[2]);
  while ((m = reLocalType.exec(src))) types.add(m[2]);
  if (/^export\s+default\b/m.test(src)) values.add("default");

  return { values: [...values].sort(), types: [...types].sort() };
}

/** barrel（`index.ts`）里**本文件自己声明**的导出 —— 方案 §3.1 要求公开 barrel 只做 re-export。 */
export function localDeclarations(rel: string, text: string): Finding[] {
  const src = stripComments(text);
  const out: Finding[] = [];
  for (const re of [
    /^export\s+(?:declare\s+)?(?:async\s+)?(const|let|var|function|class|enum)\s+([A-Za-z_$][\w$]*)/gm,
    /^export\s+(?:declare\s+)?(type|interface)\s+([A-Za-z_$][\w$]*)/gm,
  ]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      out.push({ file: rel, line: lineOf(src, m.index), detail: "barrel 内联声明 " + m[2] + "（只许 re-export）" });
    }
  }
  return out;
}

// ------------------------------------- A0-3 不得自判 PC / 主题 / 安全区

export type BoundaryKind = "pc-detect" | "theme" | "safearea" | "storage";
export type BoundaryFinding = Finding & { kind: BoundaryKind };

const RE_MEDIA_PC = /\(\s*(?:any-)?(?:pointer|hover)\s*:/;
const RE_MEDIA_THEME = /\(\s*prefers-color-scheme\s*:/;

/**
 * 库内不得**自行判定** PC 模式 / 主题 / 安全区（方案 §7.1 R3 的修正措辞：语义规则，不是字符串黑名单）：
 *  - `(pointer: …)` / `(hover: …)` / `(prefers-color-scheme: …)` 这类媒体特征 → 禁；
 *  - 写 `data-pc` / `data-theme` → 禁（主题与 PC 是宿主推入的）；
 *  - 写 `--sat/--sab/--sal/--sar` → 禁（安全区四个变量的唯一写入者是宿主）；
 *  - `localStorage` / `sessionStorage` → 全禁。
 * **允许**：`window.innerWidth/innerHeight` 的测量用法、`(orientation: landscape)` 这类布局查询。
 */
export function boundaryFindings(rel: string, text: string): BoundaryFinding[] {
  const src = stripComments(text);
  const out: BoundaryFinding[] = [];
  const push = (kind: BoundaryKind, index: number, detail: string): void => {
    out.push({ kind, file: rel, line: lineOf(src, index), detail });
  };

  for (const lit of stringLiterals(src)) {
    if (RE_MEDIA_PC.test(lit.value)) {
      out.push({ kind: "pc-detect", file: rel, line: lit.line, detail: "媒体特征判定 PC：" + lit.value.trim() });
    } else if (RE_MEDIA_THEME.test(lit.value)) {
      out.push({ kind: "theme", file: rel, line: lit.line, detail: "媒体特征判定主题：" + lit.value.trim() });
    }
  }

  let m: RegExpExecArray | null;
  const reDataset = /\.dataset\.(pc|theme)\s*=|\.dataset\[\s*["'](pc|theme)["']\s*\]\s*=/g;
  while ((m = reDataset.exec(src))) {
    const which = m[1] || m[2];
    push(which === "pc" ? "pc-detect" : "theme", m.index, "写 dataset." + which);
  }
  const reAttr = /setAttribute\s*\(\s*["']data-(pc|theme)["']/g;
  while ((m = reAttr.exec(src))) {
    const which = m[1];
    push(which === "pc" ? "pc-detect" : "theme", m.index, "写 data-" + which + " 属性");
  }
  const reSa = /setProperty\s*\(\s*["'`]--sa[tblr]["'`]|["'`]--sa[tblr]["'`]\s*[:=]/g;
  while ((m = reSa.exec(src))) {
    push("safearea", m.index, "写安全区变量：" + m[0].replace(/\s+/g, " "));
  }
  const reStore = /\b(localStorage|sessionStorage)\b/g;
  while ((m = reStore.exec(src))) {
    push("storage", m.index, "碰了 " + m[1]);
  }
  return out;
}
