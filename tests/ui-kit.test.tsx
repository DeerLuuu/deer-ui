// Component contract tests for the kit — **P0b 从 PixelCraft 搬来的那一份**。
//
// 来源：PixelCraft `tests/ui-kit.test.tsx`（提交 189ef94 时的工作区版本）。搬运口径是「原样搬运、不许削弱」：
//   · 断言名、断言表达式、中文字面量**逐字保留**（所以下面的名字仍是 `ui.*` 前缀，一一对得回应用侧那份）；
//   · 只改了两类东西：① 路径（`../src/ui/kit/*` → `../src/kit/*`）；② 类型引用
//     （删掉本文件里的 `declare const require/__dirname`，因为库的 `tests/globals.d.ts` 已经全局声明了它们）；
//   · `ui.kit.purity` 的白名单按**库的布局**写（react/react-dom 家族 + 库内相对路径，且相对路径不得越出 `src/`）
//     —— 应用侧那份列的 `../../engine/expr` / `../tooltip` 是应用布局专属的，库内已经换成 `../internal/*` 与 `../tooltip`；
//     判定逻辑直接复用 `tests/scan.ts`（与 A0-1 同一份实现，不会漂移）。
//
// **留在宿主侧的 8 条**（本文件不含，理由见交付报告）：`ui.demo.*` 6 条（示范页在 `examples/`，库测试不依赖它）、
// `ui.overlay-full-wiring`（断言的是宿主 `src/ui/App.tsx` 的接线）、`ui.dropmenu.pop-css`（断言的是宿主 `src/ui/style.css`）。
//
// The container has no jsdom, so instead of mounting into a DOM the kit is
// rendered with react-dom/server and asserted on its markup. Every claim here
// is one the styles, the guide anchors or an existing call site depends on:
// class names, aria attributes and the head → top → body → extra → foot order.
import { renderToStaticMarkup } from "react-dom/server";
import { eq, ok } from "./common";
import { classifySpecifier, importSpecifiers, insideDir, resolveSpec } from "./scan";
import { Dialog } from "../src/kit/Dialog";
import { Row, RowActions, ChipGroup, Segmented, Switch, NumberField, ColorField } from "../src/kit/Form";
import { Icon, Btn } from "../src/kit/primitives";
import { HoverTip, hoverTipPos, setHoverTipsEnabled } from "../src/kit/HoverTip";

const fs = require("fs");
const path = require("path");

const html = (el: unknown): string => renderToStaticMarkup(el as never);

/**
 * 取出 `src` 里 **`String(name(...))` 这次调用**的实参文本。
 *
 * 为什么要带 `String(` 前缀、还要自己按括号配对截：
 *   ① 直接搜 `scrubValue(` 会先命中文件头的 `import { … scrubValue … } from "../internal/scrub";`
 *      —— 那条 import 里根本没有调用，判据会变成永远看空串；
 *   ② 外面套着 `String(...)`，而 `.` 不匹配换行、懒惰正则会在第一个 `)` 就收尾。
 * 找不到或括号不配对返回 null。
 */
function callArgs(src: string, name: string): string | null {
  const at = src.indexOf("String(" + name + "(");
  if (at < 0) return null;
  const open = at + "String(".length + name.length;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "(") depth++;
    else if (c === ")") { depth--; if (depth === 0) return src.slice(open + 1, i); }
  }
  return null;
}

/** 实参里出现的**裸标识符**（`a.n` / `b.min` 这种带成员访问的不算）。 */
function bareArgs(args: string): string[] {
  const out: string[] = [];
  for (const chunk of args.split(",")) {
    const id = chunk.trim().match(/^[A-Za-z_$][\w$]*$/);
    if (id) out.push(id[0]);
  }
  return out;
}

export function testUiKit(): void {
  // ---------------------------------------------------------------- Dialog
  const d = html(
    <Dialog
      title="设置"
      onClose={() => { /* noop */ }}
      className="fxdlg"
      bodyClass="col"
      guide="dlg-settings"
      top={<div className="top-probe" />}
      extra={<div className="extra-probe" />}
      footer={<button type="button">ok</button>}
    >
      <span id="body-probe" />
    </Dialog>
  );
  ok("ui.dialog.mask", d.indexOf('class="dlg-mask"') >= 0);
  ok("ui.dialog.role", d.indexOf('role="dialog"') >= 0 && d.indexOf('aria-modal="true"') >= 0);
  ok("ui.dialog.aria-label", d.indexOf('aria-label="设置"') >= 0);
  ok("ui.dialog.classes", d.indexOf('class="dlg fxdlg"') >= 0);
  ok("ui.dialog.body-class", d.indexOf('class="dlg-body col"') >= 0);
  ok("ui.dialog.guide", d.indexOf('data-guide="dlg-settings"') >= 0);
  ok("ui.dialog.head-span", d.indexOf("<span>设置</span>") >= 0 && d.indexOf('class="grow"') >= 0);
  ok("ui.dialog.close", d.indexOf('aria-label="close"') >= 0 && d.indexOf("#i-x") >= 0);
  ok("ui.dialog.foot", d.indexOf('class="dlg-foot"') >= 0);
  {
    const ih = d.indexOf("top-probe");
    const ib = d.indexOf("body-probe");
    const ie = d.indexOf("extra-probe");
    const ifo = d.indexOf("dlg-foot");
    ok("ui.dialog.order", ih > 0 && ih < ib && ib < ie && ie < ifo, [ih, ib, ie, ifo].join(","));
  }

  const noClose = html(<Dialog title="确认" closeBtn={false} onClose={() => { /* noop */ }} />);
  eq("ui.dialog.no-close", noClose.indexOf("i-x") >= 0, false);
  eq("ui.dialog.no-footer", html(<Dialog title="菜单" onClose={() => { /* noop */ }} />).indexOf("dlg-foot") >= 0, false);
  // a dialog without onClose must not render an × either
  eq("ui.dialog.headerless-close", html(<Dialog title="x" />).indexOf("i-x") >= 0, false);

  // ------------------------------------------------------------------- Row
  const row = html(<Row label="宽度" hint="提示"><input /></Row>);
  ok("ui.row.label", row.indexOf('class="rowlabel"') >= 0 && row.indexOf("宽度") >= 0);
  ok("ui.row.hint", row.indexOf('class="row-note"') >= 0 && row.indexOf("提示") >= 0);
  ok("ui.row.order", row.indexOf("rowlabel") < row.indexOf("<input") && row.indexOf("<input") < row.indexOf("row-note"));
  eq("ui.row.no-label", html(<Row><span /></Row>).indexOf("rowlabel") >= 0, false);
  eq("ui.row.className", html(<Row label="a" className="x" />).indexOf('class="rowlabel x"') >= 0, true);

  const ra = html(<RowActions className="set-io"><button type="button">b</button></RowActions>);
  ok("ui.rowactions", ra.indexOf('class="row-actions set-io"') >= 0);

  // -------------------------------------------------------------- ChipGroup
  // NOTE: const narrowing would collapse the union, so cast at the call site
  const chips = html(
    <ChipGroup
      value={"b" as "a" | "b" | "c"}
      onChange={() => { /* noop */ }}
      options={[{ id: "a", label: "A" }, { id: "b", label: "B", guide: "btn-b" }, { id: "c", label: "C", hidden: true }]}
    />
  );
  ok("ui.chips.wrapper", chips.indexOf('class="chips"') >= 0);
  ok("ui.chips.on", chips.indexOf('class="chip on"') >= 0);
  eq("ui.chips.off-count", (chips.match(/class="chip"/g) || []).length, 1);
  eq("ui.chips.hidden", chips.indexOf(">C<") >= 0, false);
  ok("ui.chips.guide", chips.indexOf('data-guide="btn-b"') >= 0);

  const seg = html(
    <Segmented
      value={"png" as "png" | "gif"}
      onChange={() => { /* noop */ }}
      options={[{ id: "png", label: "PNG" }, { id: "gif", label: "GIF" }]}
    />
  );
  ok("ui.segmented", seg.indexOf('class="tabs"') >= 0 && seg.indexOf('class="tab on"') >= 0 && seg.indexOf('class="tab"') >= 0);
  ok("ui.segmented.labels", seg.indexOf("PNG") >= 0 && seg.indexOf("GIF") >= 0);

  // ----------------------------------------------------------------- Switch
  const on = html(<Switch checked label="开关" onChange={() => { /* noop */ }} />);
  ok("ui.switch.on", on.indexOf('role="switch"') >= 0 && on.indexOf('aria-checked="true"') >= 0 && on.indexOf('class="sw on"') >= 0);
  const off = html(<Switch checked={false} label="开关" onChange={() => { /* noop */ }} />);
  ok("ui.switch.off", off.indexOf('aria-checked="false"') >= 0 && off.indexOf('class="sw"') >= 0);
  ok("ui.switch.label", off.indexOf('aria-label="开关"') >= 0);

  // ---------------------------------------------------- NumberField / Color
  const nf = html(<NumberField label="列" value={4} onChange={() => { /* noop */ }} min={1} max={8} />);
  ok("ui.numberfield", nf.indexOf("rowlabel") >= 0 && nf.toLowerCase().indexOf('inputmode="decimal"') >= 0 && nf.indexOf('value="4"') >= 0);
  const cf = html(<ColorField label="底色" value="#112233" onChange={() => { /* noop */ }} />);
  ok("ui.colorfield", cf.indexOf('type="color"') >= 0 && cf.indexOf('class="set-hex"') >= 0 && cf.indexOf("#112233") >= 0);
  ok("ui.colorfield.row", cf.indexOf("rowlabel") >= 0);

  // ------------------------------------------------------------ primitives
  const btn = html(<Btn label="保存" onClick={() => { /* noop */ }} active danger guide="btn-save" />);
  ok("ui.btn", btn.indexOf('class="btn active danger"') >= 0 && btn.indexOf('aria-label="保存"') >= 0 && btn.indexOf('data-guide="btn-save"') >= 0);
  ok("ui.icon", html(<Icon id="i-x" size={16} />).indexOf('width="16"') >= 0);

  // ------------------------------------------------------------ HoverTip
  // the panel is positioned by a pure helper: to the lower-right of the cursor,
  // flipped when it would leave the viewport, always clamped inside it
  eq("ui.htip.pos.default", hoverTipPos(100, 100, 200, 60, 1000, 800), { x: 114, y: 114 });
  {
    // near the right edge -> flips to the left of the pointer
    const p1 = hoverTipPos(980, 100, 200, 60, 1000, 800);
    ok("ui.htip.pos.flip-x", p1.x < 980, "x=" + p1.x);
    // near the bottom edge -> flips above the pointer
    const p2 = hoverTipPos(100, 780, 200, 60, 1000, 800);
    ok("ui.htip.pos.flip-y", p2.y < 780, "y=" + p2.y);
    // a pointer in the corner still yields an on-screen panel
    const p3 = hoverTipPos(999, 799, 200, 60, 1000, 800);
    ok("ui.htip.pos.inside", p3.x >= 0 && p3.y >= 0 && p3.x + 200 <= 1000 && p3.y + 60 <= 800, JSON.stringify(p3));
    // a panel wider than the viewport is pinned to the edge, never negative
    const p4 = hoverTipPos(10, 10, 2000, 60, 1000, 800);
    ok("ui.htip.pos.oversize", p4.x >= 0 && p4.y >= 0, JSON.stringify(p4));
  }
  const htip = html(<HoverTip title="画笔" desc="按住拖动可调大小" x={40} y={40} />);
  ok("ui.htip.markup", htip.indexOf('class="htip"') >= 0 && htip.indexOf('role="tooltip"') >= 0);
  ok("ui.htip.title", htip.indexOf("htip-title") >= 0 && htip.indexOf("画笔") >= 0);
  ok("ui.htip.desc", htip.indexOf("htip-desc") >= 0 && htip.indexOf("按住拖动可调大小") >= 0);
  eq("ui.htip.no-desc", html(<HoverTip title="只有标题" x={10} y={10} />).indexOf("htip-desc") >= 0, false);
  // the kit exposes the on/off switch the app pushes PC mode into
  setHoverTipsEnabled(true);
  const { hoverTipsEnabled } = require("../src/kit/HoverTip") as { hoverTipsEnabled: () => boolean };
  eq("ui.htip.enabled-flag", hoverTipsEnabled(), true);
  setHoverTipsEnabled(false);
  eq("ui.htip.disabled-flag", hoverTipsEnabled(), false);
  // Btn must be wired to it (the hover tip is the desktop substitute for the
  // long-press tip, so it has to live inside Btn and not at the call sites)
  {
    const kitDir = path.resolve(__dirname, "../../../src/kit");
    const prim = fs.readFileSync(path.join(kitDir, "primitives.tsx"), "utf8");
    ok("ui.htip.btn-wired", prim.indexOf("useHoverTip") >= 0 && prim.indexOf("hover.node") >= 0);
    ok("ui.htip.mouse-not-longpress", prim.indexOf('e.pointerType === "mouse"') >= 0);
  }
  // 手机竖屏的面板整屏铺开（由 App 决定 full，kit 只负责加类名）
  {
    const prim = fs.readFileSync(path.resolve(__dirname, "../../../src/kit/primitives.tsx"), "utf8");
    ok("ui.overlay-full", /full = false/.test(prim) && prim.includes('full ? " panel-full" : ""'));
  }
  // 下拉列表必须 portal 出去：时间轴控制条是 `overflow-x:auto` 的滚动容器，
  // 绝对定位的列表会被它整块裁掉 —— 播放速度色片「点了没反应」就是这么来的
  {
    const tabs = fs.readFileSync(path.resolve(__dirname, "../../../src/tabs.tsx"), "utf8");
    ok("ui.dropmenu.portal", tabs.includes("createPortal") && tabs.includes("document.body"));
    ok("ui.dropmenu.fixed-pos", tabs.includes("dropmenu-pop") && tabs.includes("getBoundingClientRect"));
    // BUG-1 回归：`useLayoutEffect` 必须带依赖数组（只钉 `[open]`）。
    // 少了它每次 render 都「先摘再挂」resize/scroll，且会一路挂到下一个 hook 的 `}, […]);` 上去。
    // 判据只扫这一个 hook 的正文（在下一个 use* 调用前截断），不会把下面 useEffect 的依赖数组当答案。
    {
      const hook = "useLayoutEffect(() => {";
      const at = tabs.indexOf(hook);
      const tail = at < 0 ? "" : tabs.slice(at + hook.length);
      const next = tail.search(/use[A-Z]\w*\(/);
      const body = next < 0 ? tail : tail.slice(0, next);
      // 找这个 hook 的依赖数组：块尾形如 `}, [open]);`（正则里花括号不必转义）
      const deps = /^ {2}\}, \[([^\]]*)\]\);/m.exec(body);
      ok("ui.dropmenu.layout-effect-deps", at >= 0 && deps !== null && deps[1].trim() === "open",
        "hook=" + at + " deps=" + (deps ? "[" + deps[1] + "]" : "NONE"));
    }
  }

  // ------------------------------------------------------------ ScrubNum
  // BUG-2 回归：拖动期间必须读**当帧**的 min/max/step —— 拖动处理器是在 arm 时挂到 window 上的，
  // 直接读 props 就会捕获注册那一帧的值，拖动中父组件改边界（改单位 / 切预设）会被旧闭包吞掉。
  // 判据分两步：① 边界经 `bounds` ref 走（且每次 render 都刷新）；② 算值那次调用不出现裸 props。
  // （完整的事件驱动证明在 tests/ui-hooks.test.tsx 的 `ui.scrubnum.drag-live-bounds`。）
  {
    const scrub = fs.readFileSync(path.resolve(__dirname, "../../../src/kit/scrub.tsx"), "utf8");
    const args = callArgs(scrub, "scrubValue");
    const bare = args === null ? ["<没找到调用>"] : bareArgs(args);
    // 只允许 base / 位移 / ref 系的名字；`min` `max` `step` 这种裸 props 名字一旦出现就是捕获旧值。
    // 数一下条数：实参是 5 个，`a.n` / `b.min` / `b.max` / `b.step` 都是成员访问，裸标识符只剩位移 `d`。
    const staleProps = bare.some((n) => n === "min" || n === "max" || n === "step");
    ok("ui.scrubnum.bounds-live", !staleProps && bare.length === 1,
      "scrubValue(" + (args === null ? "<没找到调用>" : args.replace(/\s+/g, " ")) + ") 裸标识符=" + JSON.stringify(bare));
    ok("ui.scrubnum.bounds-ref", /const bounds = useRef\(\{ min, max, step, onChange \}\)/.test(scrub)
      && /^\s*bounds\.current = \{ min, max, step, onChange \};/m.test(scrub));
  }

  // --------------------------------------------------------- kit purity
  // 白名单是**库的形状**：react / react-dom 家族 + 库内相对路径（相对路径必须解析得到、且不得越出 src/）。
  // 逻辑与 A0-1（tests/a0-purity.test.ts）共用 tests/scan.ts，不存在两套实现漂移的可能。
  const kitDir = path.resolve(__dirname, "../../../src/kit");
  const libSrc = path.resolve(__dirname, "../../../src");
  const kitFiles: string[] = fs.readdirSync(kitDir).filter((f: string) => /\.(ts|tsx)$/.test(f));
  ok("ui.kit.sources", kitFiles.length >= 5, "files=" + kitFiles.length);
  const offenders: string[] = [];
  for (const f of kitFiles) {
    const abs = path.join(kitDir, f);
    for (const s of importSpecifiers(fs.readFileSync(abs, "utf8"))) {
      const target = s.mod.startsWith(".") ? resolveSpec(abs, s.mod) : null;
      const verdict = classifySpecifier(s.mod, target, target ? insideDir(libSrc, target) : false);
      if (verdict !== "ok") offenders.push(f + ":" + s.line + " -> " + s.mod + "（" + verdict + "）");
    }
  }
  eq("ui.kit.purity", offenders, []);

  // the barrel is what the demo page and, later, an external consumer import
  const barrel = fs.readFileSync(path.join(kitDir, "index.ts"), "utf8");
  for (const sym of ["Dialog", "Row", "ChipGroup", "Segmented", "Switch", "NumberField", "ColorField", "Btn", "Icon", "ScrubNum"]) {
    ok("ui.kit.export." + sym, new RegExp("\\b" + sym + "\\b").test(barrel));
  }
}
