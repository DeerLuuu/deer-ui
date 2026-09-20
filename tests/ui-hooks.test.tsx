// 控件**副作用生命周期**的回归测试（BUG-2 的陈旧边界 / BUG-3 的卸载清理）。
//
// 为什么不照 ui-kit.test.tsx 那样静态渲染完事：本库的控件契约一律走 `renderToStaticMarkup`
// （不执行 effect），也不引 jsdom（README「测试基建的三处有意选择」）。而这两条 bug 只活在
// **effect 生命周期 / window 监听**里，只读源码字符串钉不住。所以这里加一个**极小**的 effect 运行器：
//
//   ① 复用 tests/dom-stub.ts 的 `installDomStub()`（让 `window` / `document` 在 Node 里存在）；
//   ② 在它之上只加三件事：window 的 add/removeEventListener 记账；`setTimeout` 立即执行
//      （ScrubNum 的 380ms 长按 arm 定时器于是当场「到点」，不用真睡 380ms）；`useRef` / `useState`
//      换成「按调用序号分配槽位」的实现 —— ref 槽跨 render 复用同一个对象（真实 React 就是这样，
//      不然重渲染会造个新 ref，旧 handler 永远看不到新值），state 槽的值由测试在每次 render 前给定；
//   ③ `renderToStaticMarkup` 照常渲染组件（hook 规则、组件函数体、props 都是真的），只把
//      `useEffect` 换成记录器：SSR 本来就跳过 effect，于是我们拿到「effect 回调」这份事实，
//      再手动跑它（= commit）、手动跑它返回的 cleanup（= 卸载）。
//
// 于是「按下 → arm 往 window 挂 pointermove → 父组件换边界 → 拖动 → 卸载摘监听」整条链子上的
// **真实函数**都被执行到：数的是组件自己注册的监听，喂事件也是喂给它自己的 handler。
//
// 它仍然不是渲染器：不解析布局（`getBoundingClientRect` 返回全 0）、不派发 React 合成事件
// （元素上的 `onXxx` 由测试从元素树里取出来直接调用）。用完必须还原，不污染后面的测试（R9）。
import React, { useEffect, useRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ScrubNum } from "../src/kit/scrub";
import { installDomStub } from "./dom-stub";
import { ok } from "./common";

type Any = any;

const REC_KEY = "__deeruiHookRec";
const DRAG_EVENTS = ["pointermove", "pointerup", "pointercancel"];

interface Harness {
  /** window 上的监听（event → handler 集合）。数的是**组件自己**挂上去的那些 */
  listeners: Map<string, Set<Any>>;
  /** 开一次新 render：hook 槽位归零，state 槽位按参数覆盖 */
  begin(nextStates: unknown[]): void;
  /** 跑掉本次 staged 的 effect（= 一次 commit） */
  runEffects(): void;
  /** 逐个跑掉已登记的 cleanup（= React 卸载） */
  unmount(): void;
  restore(): void;
}

type HookSurface = {
  useEffect: (fn: () => unknown, deps?: unknown[]) => unknown;
  useRef: (init: unknown) => { current: unknown };
};

function installHarness(): Harness {
  const done = installDomStub();                    // 用完还原：不污染后面的测试
  const g = globalThis as Any;
  const prior = g[REC_KEY];

  const listeners = new Map<string, Set<Any>>();
  const track = (t: string, fn: Any, remove: boolean): void => {
    let set = listeners.get(t);
    if (remove) { set?.delete(fn); return; }
    if (!set) { set = new Set(); listeners.set(t, set); }
    set.add(fn);
  };
  const window = g.window as Any;
  window.addEventListener = (t: string, fn: Any): void => track(t, fn, false);
  window.removeEventListener = (t: string, fn: Any): void => track(t, fn, true);
  const realSetTimeout = window.setTimeout;
  window.setTimeout = (fn: () => void): number => { fn(); return 0; };   // 长按 arm 当场到点

  const cleanups: Array<() => void> = [];
  const staged: Array<() => unknown> = [];
  const refs: Any[] = [];
  const states: unknown[] = [];
  const seq = { ref: 0, state: 0 };

  const hooks = React as unknown as HookSurface;
  const realEffect = hooks.useEffect;
  const realRef = hooks.useRef;
  const realState = (React as Any).useState as (i: unknown) => [unknown, (v: unknown) => void];

  hooks.useEffect = (fn: () => unknown, _deps?: unknown[]): unknown => { staged.push(fn); return undefined; };
  hooks.useRef = (init: unknown): { current: unknown } => {
    const i = seq.ref++;
    if (!(i in refs)) refs[i] = { current: init };
    return refs[i];
  };
  (React as Any).useState = (init: unknown): [unknown, (v: unknown) => void] => {
    const i = seq.state++;
    if (!(i in states)) states[i] = init;
    return [states[i], () => { /* setter 由测试驱动下一次 render */ }];
  };

  g[REC_KEY] = { listeners };

  return {
    listeners,
    begin: (nextStates: unknown[]) => {
      seq.ref = 0;
      seq.state = 0;
      for (let i = 0; i < nextStates.length; i++) states[i] = nextStates[i];
    },
    runEffects: () => {
      for (const fn of staged.splice(0)) {
        const r = fn();
        if (typeof r === "function") cleanups.push(r as () => void);
      }
    },
    unmount: () => { for (const c of cleanups.splice(0)) c(); },
    restore: () => {
      hooks.useEffect = realEffect;
      hooks.useRef = realRef;
      (React as Any).useState = realState;
      window.setTimeout = realSetTimeout;
      listeners.clear();
      refs.length = 0;
      states.length = 0;
      if (typeof prior === "undefined") delete g[REC_KEY]; else g[REC_KEY] = prior;
      done();
    },
  };
}

const pointer = (clientX: number, clientY: number): Any => ({
  clientX, clientY, pointerType: "mouse", preventDefault: () => { /* noop */ },
});

const dragCount = (h: Harness): string =>
  DRAG_EVENTS.map((t) => h.listeners.get(t)?.size ?? 0).join(",");

/**
 * 渲染一次并返回元素树上的 handler（`onPointerDown` 等）。
 *
 * `node` 里**直接调组件函数**（`ScrubNum(props)`）：SSR 不会对 host 元素执行 ref
 * （`elRef.current` 恒为 null），我们只要「元素上的 props」这份事实。hook 规则仍成立 ——
 * 组件函数是在 `Probe` 组件的渲染过程中被调用的，`useEffect` / `useRef` / `useState`
 * 走的都是上面换过的实现。同一 harness 里多次调用 = 同一实例的多次 render。
 */
function renderNode(h: Harness, node: () => React.ReactElement, states: unknown[]): { markup: string; handlers: Record<string, Any> } {
  let handlers: Record<string, Any> = {};
  h.begin(states);
  const Probe = (): React.ReactElement => {
    const el = node();
    handlers = collectHandlers(el);
    return el;
  };
  const markup = renderToStaticMarkup(React.createElement(Probe as never));
  return { markup, handlers };
}

/** 深度遍历元素树，收集每个元素上的 `onXxx` handler（ScrubNum 的 input 在 fragment 里）。 */
function collectHandlers(node: Any): Record<string, Any> {
  const out: Record<string, Any> = {};
  const walk = (n: Any): void => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) { for (const c of n) walk(c); return; }
    const p = n.props as Record<string, Any> | undefined;
    if (p) {
      for (const k of Object.keys(p)) if (k.startsWith("on") && typeof p[k] === "function") out[k] = p[k];
      walk(p.children);
    }
  };
  walk(node);
  return out;
}

export function testUiHooks(): void {
  // -------------------------------------------------------------- BUG-3
  // 「按下 → arm（组件自己往 window 挂 pointermove/up/cancel）→ 被卸载」。
  // 修复前组件没有任何卸载清理，这三个监听会一直留在 window 上 ⇒ unmount-cleanup 红。
  const h3 = installHarness();
  try {
    const base = { value: "10", onChange: () => { /* noop */ }, min: 0, max: 100, step: 1 };
    const r3 = renderNode(h3, () => ScrubNum(base) as React.ReactElement, [null, null]);
    h3.runEffects();                                 // = commit（组件自己的 effect 跑起来）
    const down = r3.handlers["onPointerDown"];
    ok("ui.hooks.arm-wired", typeof down === "function" && r3.markup.indexOf("<input") >= 0,
      "ScrubNum 渲染出 input 且暴露 onPointerDown");

    down(pointer(100, 100));                         // 按下：armT 当场到点 → arm() 挂三个真 handler
    ok("ui.hooks.arm-registers", dragCount(h3) === "1,1,1",
      "arm 之后组件挂在 window 上的 pointermove/up/cancel = " + dragCount(h3));

    h3.unmount();                                    // = 卸载（跑每个 effect 的 cleanup）
    ok("ui.scrubnum.unmount-cleanup", dragCount(h3) === "0,0,0",
      "卸载后 window 上剩余的 pointermove/up/cancel = " + dragCount(h3));
  } finally {
    h3.restore();
  }
  ok("ui.hooks.recorder-restored", (globalThis as Any).window === undefined
    && (globalThis as Any)[REC_KEY] === undefined, "DOM 桩与自己加的记录键都已还原");

  // -------------------------------------------------------------- BUG-2
  // arm 已发生、拖动进行中，父组件换了边界：同一实例的下一次 render 里 handler 必须按**当帧**算。
  // 修复前 mv 捕获 arm 那一帧的 props：min 改成 500 之后照样提交 18 ⇒ drag-live-bounds 红。
  const h2 = installHarness();
  try {
    const seen: string[] = [];
    const commit = (v: string): void => { seen.push(v); };
    const r2 = renderNode(h2,
      () => ScrubNum({ value: "10", onChange: commit, min: 0, max: 100, step: 1 }) as React.ReactElement,
      [null, null]);
    h2.runEffects();
    r2.handlers["onPointerDown"](pointer(100, 100));
    seen.length = 0;                                 // 只看拖动之后的提交

    // 同一实例重渲染：换边界（ref 槽复用，所以 arm 时挂上的 handler 能看见新值）
    renderNode(h2,
      () => ScrubNum({ value: "10", onChange: commit, min: 500, max: 600, step: 1 }) as React.ReactElement,
      [null, null]);
    const mv = [...(h2.listeners.get("pointermove") ?? [])][0];
    ok("ui.hooks.drag-handler-live", typeof mv === "function", "pointermove handler 来自 arm()");
    mv(pointer(100, 40));                            // 向上拖 60px
    ok("ui.scrubnum.drag-live-bounds", seen.length === 1 && seen[0] === "500",
      "拖动中把 min 改成 500 后，pointermove 提交的值 = " + JSON.stringify(seen));
  } finally {
    h2.restore();
  }
}
