// ScrubNum — numeric field with a scrub gesture and an arithmetic pad.
//
// SESSION-free (docs/UI.md §1.1): the translated pad tooltip arrives through
// `padTitle`; src/ui/base.tsx wraps this with the app's i18n text.
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { evalExpr } from "../internal/expr.js";
import { SCRUB_DEAD_PX, scrubValue, takeNotches, wheelNotches } from "../internal/scrub.js";

export interface ScrubNumProps {
  value: string | number;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  step?: number;
  title?: string;
  placeholder?: string;
  style?: React.CSSProperties;
  /** accept arithmetic ("12+3*2"); false = digits only */
  expr?: boolean;
  /** tooltip of the formula pad (app layer supplies the translated string) */
  padTitle?: string;
}

/**
 * Numeric input with a scrub gesture: long-press (no typing) then slide
 * up/down or left/right to change the value. The magnitude per pixel follows
 * the bounds (the whole range takes ~600px, see engine/scrub.ts) so a light
 * flick can no longer jump across the field.
 *
 * The field also accepts a formula: while it has focus the text is kept
 * verbatim ("64*2+8") and evaluated live (see src/engine/expr.ts). A small
 * operator pad pops up under the field, because the numeric phone keypad has
 * no + − × ÷ keys.
 */
export function ScrubNum({
  value, onChange, min, max, step, title, placeholder, style, expr = true, padTitle,
}: ScrubNumProps) {
  const elRef = useRef<HTMLInputElement | null>(null);
  const armT = useRef<number | null>(null);
  const anchor = useRef<{ x: number; y: number; n: number } | null>(null);
  /** leftover wheel travel (a notch is delivered as many small events) */
  const wheelAcc = useRef(0);
  /** newest value applied inside one frame (props lag until re-render) */
  const wheelVal = useRef<number | null>(null);
  /**
   * 拖动/滚轮期间**必须读最新 props** 的那几项。
   *
   * 为什么要有这个 ref：拖动的两个处理器在 `arm()` 里定义、再挂到 `window` 上
   * （`window.addEventListener("pointermove", mv)`）。事件处理器看到的是**注册那一帧**的闭包，
   * 所以直接读 `min/max/step/onChange` 会拿到陈旧值 —— 拖动已经 arm 之后父组件改了边界
   * （改单位、切预设）就会被旧闭包吞掉，算出越界值或步长不符（BUG-2）。每次 render 刷新这个
   * ref，`mv` / 滚轮处理器就总能按当帧边界算。
   */
  const bounds = useRef({ min, max, step, onChange });
  bounds.current = { min, max, step, onChange };
  /**
   * 拖动期间挂在 `window` 上的那两个处理器。
   *
   * `end()` 是「卸载」与「pointerup」两条路都要摘的对象，所以它必须**按引用**被 `arm` 记住，
   * 不能靠闭包里的函数标识猜（`down` 是 React 事件处理器，定时器闭包与卸载 effect 各自看到的
   * 函数可能不是同一个实例 —— 靠闭包就会摘不掉、监听留在 window 上，BUG-3 正是这么来的）。
   * 只在 `arm` 里写，不在 render 期写（render 必须无副作用）。
   */
  const live = useRef<{ mv: (ev: PointerEvent) => void; end: () => void } | null>(null);
  /** raw text while focused (null = show the committed value) */
  const [text, setText] = useState<string | null>(null);
  /** screen position of the operator pad while focused */
  const [pad, setPad] = useState<{ left: number; top: number } | null>(null);
  const clampN = (n: number) => {
    const b = bounds.current;
    if (b.min != null) n = Math.max(b.min, n);
    if (b.max != null) n = Math.min(b.max, n);
    return n;
  };
  const numeric = () => {
    if (text !== null) { const e = evalExpr(text); if (e !== null) return clampN(e); }
    const n = parseFloat(String(value));
    return Number.isFinite(n) ? n : (bounds.current.min ?? 0);
  };
  /** commit an evaluated result (integers unless a fractional step is declared) */
  const commit = (n: number) => {
    const st = bounds.current.step;
    const q = st != null && !Number.isInteger(st) ? n : Math.round(n);
    bounds.current.onChange(String(clampN(q)));
  };
  /** 摘掉拖动期间挂在 window 上的监听 + 清掉还没到点的 armT（pointerup 与卸载共用这条路） */
  const detachLive = (): void => {
    if (armT.current !== null) { window.clearTimeout(armT.current); armT.current = null; }
    anchor.current = null;
    const l = live.current;
    if (!l) return;
    window.removeEventListener("pointermove", l.mv);
    window.removeEventListener("pointerup", l.end);
    window.removeEventListener("pointercancel", l.end);
    live.current = null;
  };
  const arm = () => {
    const mv = (ev: PointerEvent) => {
      const a = anchor.current;
      if (!a) return;
      const dx = ev.clientX - a.x;
      const dy = ev.clientY - a.y;
      const d = Math.abs(dy) > Math.abs(dx) ? -dy : dx; // drag up or right increases
      if (Math.abs(d) < SCRUB_DEAD_PX) return;          // ignore the arming wobble
      const b = bounds.current;                          // 当帧的 min/max/step，不是 arm 那一帧的
      bounds.current.onChange(String(scrubValue(a.n, d, b.min, b.max, b.step)));
    };
    const end = () => detachLive();
    live.current = { mv, end };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };
  const down = (e: React.PointerEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const x = e.clientX;
    const y = e.clientY;
    armT.current = window.setTimeout(() => {
      armT.current = null;
      try { el.blur(); } catch { /* ignore */ }
      anchor.current = { x, y, n: numeric() };
      arm();
    }, 380);
  };
  const clearT = () => { if (armT.current !== null) { window.clearTimeout(armT.current); armT.current = null; } };
  // ---- formula editing ----------------------------------------------------
  const edit = (v: string) => {
    setText(v);
    const n = evalExpr(v);
    if (n !== null) commit(n); // live: the rest of the UI follows as you type
  };
  const placePad = () => {
    const el = elRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPad({
      left: Math.max(6, Math.min(window.innerWidth - 292, r.left)),
      top: Math.min(window.innerHeight - 46, r.bottom + 6),
    });
  };
  useEffect(() => {
    if (!pad) return;
    const on = () => placePad();
    window.addEventListener("resize", on);
    window.addEventListener("scroll", on, true);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("scroll", on, true);
    };
  }, [pad !== null]);
  const blur = () => {
    const t = text;
    setText(null);
    setPad(null);
    if (t === null) return;
    const n = evalExpr(t);
    // an unfinished formula ("12+") falls back to the last committed value
    if (n === null) commit(parseFloat(String(value)) || (min ?? 0));
    else commit(n);
  };
  /** PC：鼠标悬停在数字框上滚动滚轮＝按步长调值（0ms、无需聚焦） */
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    wheelVal.current = null;   // props 变了：以 props 为准
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // accumulate: one step per mouse notch, however many events it arrives in
      const { steps, rest } = takeNotches(wheelAcc.current + wheelNotches(e.deltaY, e.deltaMode));
      wheelAcc.current = rest;
      if (!steps) return;
      const b = bounds.current;  // 边界与 onChange 一律走 live ref（[value, text] 只决定重算基准）
      const span = b.min != null && b.max != null ? b.max - b.min : 0;
      const stepN = b.step != null ? b.step : span > 200 ? 5 : 1;
      const cur = wheelVal.current ?? numeric();
      const next = clampN(cur - steps * stepN);
      if (next !== cur) { wheelVal.current = next; commit(next); }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [value, text]);

  /**
   * 卸载清理（BUG-3）。`detachLive()` 只在 pointerup / pointercancel 走，**组件在按住期间被卸载**
   * （本库自己的 `<Keep>` 就是延迟卸载语义）不会走那条路：三个 window 监听会留在 window 上，
   * 卸载后 pointermove 还会继续调 onChange 去 setState 一个已经不存在的组件。
   * 这里挂一个空依赖的 effect，卸载时把 armT / 三个监听 / 拖动状态一次清干净。
   * （清 `wheelAcc` 是顺手把「手势残值」在实例销毁时归零；手势**内部**的累加语义没动。）
   */
  useEffect(() => () => {
    detachLive();
    wheelAcc.current = 0;
  }, []);

  /** insert at the caret of the (controlled) field, keeping the caret put */
  const insert = (ins: string) => {
    const el = elRef.current;
    const cur = text ?? String(value);
    const at = el && el.selectionStart != null ? el.selectionStart : cur.length;
    edit(cur.slice(0, at) + ins + cur.slice(at));
    window.requestAnimationFrame(() => {
      try { el?.focus(); el?.setSelectionRange(at + ins.length, at + ins.length); } catch { /* ignore */ }
    });
  };
  const backspace = () => {
    const el = elRef.current;
    const cur = text ?? String(value);
    const at = el && el.selectionStart != null ? el.selectionStart : cur.length;
    if (at <= 0) return;
    edit(cur.slice(0, at - 1) + cur.slice(at));
    window.requestAnimationFrame(() => {
      try { el?.focus(); el?.setSelectionRange(at - 1, at - 1); } catch { /* ignore */ }
    });
  };
  return (
    <>
      <input
        ref={elRef}
        type="text"
        inputMode="decimal"
        value={text ?? String(value)}
        title={title}
        placeholder={placeholder}
        style={style}
        onChange={(e) => (expr ? edit(e.target.value) : onChange(e.target.value))}
        onFocus={() => { if (!expr) return; setText(String(value)); placePad(); }}
        onBlur={blur}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); elRef.current?.blur(); } }}
        onPointerDown={down}
        onPointerUp={clearT}
        onPointerCancel={clearT}
      />
      {pad && createPortal(
        <div className="calcpad" style={{ left: pad.left, top: pad.top }} title={padTitle}
          onPointerDown={(e) => e.preventDefault()}>
          {["(", ")", "+", "\u2212", "\u00d7", "\u00f7"].map((c) => (
            <button key={c} type="button" className="cp-key" onClick={() => insert(c === "\u2212" ? "-" : c === "\u00d7" ? "*" : c === "\u00f7" ? "/" : c)}>{c}</button>
          ))}
          <button type="button" className="cp-key cp-back" onClick={backspace}>{"\u232b"}</button>
          <button type="button" className="cp-key cp-eq" onClick={() => elRef.current?.blur()}>{"="}</button>
        </div>,
        document.body,
      )}
    </>
  );
}
