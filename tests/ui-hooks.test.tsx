// 控件**副作用生命周期**的回归测试（BUG-2 的陈旧边界 / BUG-3 的卸载清理 / BUG-5 的未到点定时器清理）。
//
// 为什么不照 ui-kit.test.tsx 那样静态渲染完事：本库的控件契约一律走 `renderToStaticMarkup`
// （不执行 effect），也不引 jsdom（README「测试基建的三处有意选择」）。而这几条 bug 只活在
// **effect 生命周期 / window 监听 / 计时器**里，只读源码字符串钉不住。所以这里加一个**极小**的
// effect 运行器：
//
//   ① 复用 tests/dom-stub.ts 的 `installDomStub()`（让 `window` / `document` 在 Node 里存在）；
//   ② 在它之上只加四件事：
//      · window 的 add/removeEventListener 记账（数的是**组件自己**挂上去的监听）；
//      · 一个**不自动执行**的计时器桩：`setTimeout` 返回 id 并记账、`clearTimeout` 记账 ——
//        测试必须显式 `timers.fire(id)` 才算到点。旧的桩 `setTimeout = (fn) => { fn(); return 0; }`
//        把「定时器还没到点」这个状态整个抹掉了：ScrubNum 的 380ms 长按 arm、Keep 的退场窗口、
//        showTip 的 autoHide 全都当场执行，`detachLive()` 里的 `clearTimeout` 于是只是
//        「碰巧被执行到」，删掉它没有任何断言会红（BUG-5 的判据盲区，范围 C 修的就是这里）；
//      · `useRef` / `useState` 换成「按调用序号分配槽位」的实现 —— ref 槽跨 render 复用同一个对象
//        （真实 React 就是这样），state 槽的值由测试在每次 render 前给定，并被 setter **真实写回**
//        （所以 effect 里的 setState 能在下一次 render 被看见，「到点才卸载」这类契约才可判）；
//      · `useSyncExternalStore` 换成「注册订阅 + 数通知次数」的桩：订阅回调被调用几次 = 推送式
//        状态真的通知了几次（`setKitPcMode` 的幂等性靠它判）。
//   ③ `renderToStaticMarkup` 照常渲染组件（hook 规则、组件函数体、props 都是真的），只把
//      `useEffect` 换成记录器：SSR 本来就跳过 effect，于是我们拿到「effect 回调」这份事实，
//      再手动跑它（= commit）、手动跑它返回的 cleanup（= 卸载）。
//
// 它仍然不是渲染器：不解析布局（`getBoundingClientRect` 返回全 0）、不派发 React 合成事件
// （元素上的 `onXxx` 由测试从元素树里取出来直接调用）。用完必须还原，不污染后面的测试（R9）。
import React, { useEffect, useRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ScrubNum } from "../src/kit/scrub";
import { Keep, TipHost, useBlankTap, useLandscape } from "../src/kit/primitives";
import { showTip, hideTip, subscribeTip } from "../src/tooltip";
import { kitPcOn, setKitPcMode, useKitPcMode } from "../src/kit/pcmode";
import { installDomStub } from "./dom-stub";
import { eq, ok } from "./common";

type Any = any;

const REC_KEY = "__deeruiHookRec";
const DRAG_EVENTS = ["pointermove", "pointerup", "pointercancel"];

/** 计时器桩的记账面：没有它，「未到点」这个状态就不可判（BUG-5）。 */
interface Timers {
  /** 还没到点、也没被 clear 的 id（升序） */
  pending(): number[];
  /** 某 id 注册时的 ms；没注册过返回 null */
  delayOf(id: number): number | null;
  /** 真的跑掉一个还没到点的定时器（= 到点）；返回它当时是否还在 pending 里 */
  fire(id: number): boolean;
  /** 跑掉全部 pending，返回条数（幽灵定时器探针） */
  fireAll(): number;
  /** 被 clearTimeout 掉的 id，按调用顺序 */
  cleared(): number[];
}

interface Harness {
  /** window 上的监听（event → handler 集合）。数的是**组件自己**挂上去的那些 */
  listeners: Map<string, Set<Any>>;
  timers: Timers;
  /** useSyncExternalStore 收到的通知次数（订阅回调被调用） */
  notices(): number;
  /** useState 的 setter 被调用次数（TipHost 卸载退订的判据） */
  setCallCount(): number;
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
  useState: (init: unknown) => [unknown, (v: unknown) => void];
  useSyncExternalStore: (subscribe: Any, getSnapshot: Any, getServerSnapshot?: Any) => unknown;
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

  // ---- 计时器桩（BUG-5 判据的前提）------------------------------------------
  // 返回**不执行**的 id 并记账；「到点」只能由测试显式 fire()。clearTimeout 也记账，
  // 于是「按下后在 380ms 内卸载，必须把未到点的定时器清掉」第一次成为可机检的事实。
  const realSetTimeout = window.setTimeout;
  const realClearTimeout = window.clearTimeout;
  let nextTimer = 1;
  const pending = new Map<number, { fn: () => void; ms: number }>();
  const cleared: number[] = [];
  window.setTimeout = (fn: () => void, ms?: number): number => {
    const id = nextTimer++;
    pending.set(id, { fn, ms: ms ?? 0 });
    return id;
  };
  window.clearTimeout = (id: number): void => { cleared.push(id); pending.delete(id); };
  const fireOne = (id: number): boolean => {
    const p = pending.get(id);
    if (!p) return false;
    pending.delete(id);
    p.fn();
    return true;
  };
  const timers: Timers = {
    pending: () => [...pending.keys()].sort((a, b) => a - b),
    delayOf: (id) => { const p = pending.get(id); return p ? p.ms : null; },
    fire: fireOne,
    fireAll: () => {
      let n = 0;
      for (const id of [...pending.keys()].sort((a, b) => a - b)) if (fireOne(id)) n++;
      return n;
    },
    cleared: () => cleared.slice(),
  };

  const cleanups: Array<() => void> = [];
  const staged: Array<() => unknown> = [];
  const refs: Any[] = [];
  const states: unknown[] = [];
  let setCalls = 0;
  const seq = { ref: 0, state: 0 };

  const hooks = React as unknown as HookSurface;
  const realEffect = hooks.useEffect;
  const realRef = hooks.useRef;
  const realState = hooks.useState;
  const realStore = hooks.useSyncExternalStore;

  hooks.useEffect = (fn: () => unknown, _deps?: unknown[]): unknown => { staged.push(fn); return undefined; };
  hooks.useRef = (init: unknown): { current: unknown } => {
    const i = seq.ref++;
    if (!(i in refs)) refs[i] = { current: init };
    return refs[i];
  };
  hooks.useState = (init: unknown): [unknown, (v: unknown) => void] => {
    const i = seq.state++;
    // React 的 lazy initializer（`useState(() => …)`）只在首次挂载时调用一次 —— 桩也要这样，
    // 否则 `useLandscape` 的初值会变成一个**函数**（类型是 boolean，行为不是）。
    if (!(i in states)) states[i] = typeof init === "function" ? (init as () => unknown)() : init;
    return [states[i], (v: unknown) => { setCalls++; states[i] = v; }];
  };
  // 「同一个组件实例因通知而重渲染」的模型：renderToStaticMarkup 每次调用都是一次新挂载，
  // 但这里只注册**一次**订阅（真实 React 客户端也是每挂载一次），第二次起的 render 复用它。
  let notices = 0;
  let storeCb: (() => void) | null = null;
  let storeUnsub: (() => void) | null = null;
  hooks.useSyncExternalStore = (subscribe: Any, getSnapshot: Any, getServerSnapshot?: Any): unknown => {
    if (!storeCb) {
      storeCb = () => { notices++; };
      const un = subscribe(storeCb);
      if (typeof un === "function") storeUnsub = un as () => void;
    }
    return (typeof getServerSnapshot === "function" ? getServerSnapshot : getSnapshot)();
  };

  g[REC_KEY] = { listeners };

  return {
    listeners,
    timers,
    notices: () => notices,
    setCallCount: () => setCalls,
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
      if (storeUnsub) storeUnsub();
      storeCb = null;
      storeUnsub = null;
      hooks.useEffect = realEffect;
      hooks.useRef = realRef;
      hooks.useState = realState;
      hooks.useSyncExternalStore = realStore;
      window.setTimeout = realSetTimeout;
      window.clearTimeout = realClearTimeout;
      listeners.clear();
      pending.clear();
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
  // -------------------------------------------------------------- BUG-3 + BUG-5
  // 「按下 → arm（组件自己往 window 挂 pointermove/up/cancel）→ 被卸载」。
  // 修复前组件没有任何卸载清理，这三个监听会一直留在 window 上 ⇒ unmount-cleanup 红。
  // 计时器桩改成「不自动执行」后，按下与 arm 之间多了一个**真实的等待态**（380ms 未到点）。
  const h3 = installHarness();
  try {
    const base = { value: "10", onChange: () => { /* noop */ }, min: 0, max: 100, step: 1 };
    const r3 = renderNode(h3, () => ScrubNum(base) as React.ReactElement, [null, null]);
    h3.runEffects();                                 // = commit（组件自己的 effect 跑起来）
    const down = r3.handlers["onPointerDown"];
    ok("ui.hooks.arm-wired", typeof down === "function" && r3.markup.indexOf("<input") >= 0,
      "ScrubNum 渲染出 input 且暴露 onPointerDown");

    down(pointer(100, 100));                         // 按下：只登记 380ms 的长按定时器
    ok("ui.hooks.arm-deferred", dragCount(h3) === "0,0,0" && h3.timers.pending().length === 1
      && h3.timers.delayOf(h3.timers.pending()[0]) === 380,
      "到点前 window 上不应有拖动监听；pending=" + JSON.stringify(h3.timers.pending())
        + " ms=" + h3.timers.delayOf(h3.timers.pending()[0] ?? -1));

    h3.timers.fireAll();                             // 到点 → arm() 挂三个真 handler
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

  // -------------------------------------------------------------- BUG-5（本轮补的判据）
  // 「按下 → 380ms **未到点**就卸载」。`detachLive()` 的第一句必须把还没到点的 armT 清掉：
  // 否则那个定时器还活着，到点后 arm() 会给**已经卸载**的实例挂 window 监听（幽灵监听）。
  // 旧桩（当场执行、返回 0）下这条永远绿 —— 现在它是真的会红。
  const h5 = installHarness();
  try {
    const base5 = { value: "10", onChange: () => { /* noop */ }, min: 0, max: 100, step: 1 };
    const r5 = renderNode(h5, () => ScrubNum(base5) as React.ReactElement, [null, null]);
    h5.runEffects();
    r5.handlers["onPointerDown"](pointer(100, 100));
    const armIds = h5.timers.pending();
    ok("ui.hooks.arm-timer-pending", armIds.length === 1 && h5.timers.delayOf(armIds[0]) === 380,
      "按下后应有一个未到点的 380ms 定时器；pending=" + JSON.stringify(armIds)
        + " ms=" + (armIds.length ? h5.timers.delayOf(armIds[0]) : "none"));

    h5.unmount();                                    // 未到点就卸载
    ok("ui.hooks.arm-timer-cleared", armIds.length === 1
      && h5.timers.cleared().indexOf(armIds[0]) >= 0 && h5.timers.pending().length === 0,
      "卸载必须 clearTimeout(" + (armIds[0] ?? "?") + ")；cleared=" + JSON.stringify(h5.timers.cleared())
        + " pending=" + JSON.stringify(h5.timers.pending()));

    const ghost = h5.timers.fireAll();               // 幽灵定时器探针：已清掉 → 一个都不该被跑
    ok("ui.hooks.arm-timer-no-ghost", ghost === 0 && dragCount(h5) === "0,0,0",
      "卸载后再推进计时器：被跑掉 " + ghost + " 个，window 上监听 = " + dragCount(h5));
  } finally {
    h5.restore();
  }

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
    h2.timers.fireAll();                             // 长按到点（arm 发生）
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

  // --------------------------------------------------------------- Keep（延迟卸载）
  // 契约：on=true 立即渲染子树；on 转 false 时**保留缓存子树**并打上 .out，ms 到点才真的卸载。
  // 用计时器桩真实驱动整条链（入口态 → 退场窗口 → 到点卸载），不是只读静态 markup 里的类名。
  const kEl = React.createElement("span", { className: "k-probe" }, "K");
  const hk = installHarness();
  try {
    const renderKeep = (on: boolean): string =>
      renderNode(hk, () => Keep({ on, el: kEl, ms: 120 }) as React.ReactElement, []).markup;
    const mIn = renderKeep(true);
    ok("ui.keep.entrance", mIn.indexOf('class="keep"') >= 0 && mIn.indexOf("keep out") < 0
      && mIn.indexOf("k-probe") >= 0, "入口态 markup=" + JSON.stringify(mIn));
    hk.runEffects();                                 // commit：on === prev，effect 自己 early-return

    const mExiting = renderKeep(false);
    ok("ui.keep.exit-keeps-subtree", mExiting.indexOf('class="keep"') >= 0
      && mExiting.indexOf("keep out") < 0 && mExiting.indexOf("k-probe") >= 0,
      "退场窗口开始（.out 还没打上）仍渲染缓存子树：markup=" + JSON.stringify(mExiting));
    hk.runEffects();                                 // on 变 false → setOut(true) + 登记退场定时器

    const mOut = renderKeep(false);
    ok("ui.keep.exit-out-class", mOut.indexOf('class="keep out"') >= 0 && mOut.indexOf("k-probe") >= 0,
      "退场窗口 markup=" + JSON.stringify(mOut));
    const kIds = hk.timers.pending();
    ok("ui.keep.exit-timer-scheduled", kIds.length === 1 && hk.timers.delayOf(kIds[0]) === 120,
      "退场定时器 pending=" + JSON.stringify(kIds) + " ms=" + (kIds.length ? hk.timers.delayOf(kIds[0]) : "none"));

    hk.timers.fire(kIds[0]);                         // 到点 → setAlive(false) + setOut(false)
    const mGone = renderKeep(false);
    ok("ui.keep.exit-unmounts-after-ms", mGone === "", "到点后 markup=" + JSON.stringify(mGone));
  } finally {
    hk.restore();
  }

  // Keep 的退场定时器在**没到点就卸载**时必须被 clear（否则回调会 setState 一个已卸载的组件）。
  const hk2 = installHarness();
  try {
    const renderKeep2 = (on: boolean): string =>
      renderNode(hk2, () => Keep({ on, el: kEl, ms: 90 }) as React.ReactElement, []).markup;
    renderKeep2(true);
    hk2.runEffects();
    renderKeep2(false);
    hk2.runEffects();
    const ids = hk2.timers.pending();
    hk2.unmount();
    ok("ui.keep.exit-timer-cleared", ids.length === 1 && hk2.timers.cleared().indexOf(ids[0]) >= 0
      && hk2.timers.pending().length === 0,
      "卸载时 clearTimeout(" + (ids[0] ?? "?") + ")；cleared=" + JSON.stringify(hk2.timers.cleared())
        + " pending=" + JSON.stringify(hk2.timers.pending()));
  } finally {
    hk2.restore();
  }

  // -------------------------------------------------------- TipHost（走真实订阅路径）
  // 反例纪律：**不许**把 tip 塞进 harness 的 state 槽再断言。这里只跑 TipHost 自己的 effect
  // （= subscribeTip 接线），然后用 showTip() 走订阅通知推送；把接线删掉这条必须变红。
  const ht = installHarness();
  try {
    const first = renderNode(ht, () => React.createElement(TipHost), []).markup;
    eq("ui.tiphost.empty-without-tip", first, "");
    ht.runEffects();                                 // 只跑 effect：subscribeTip 接上（立即回调 null）
    showTip({ title: "长按提示", desc: "松手前别动" });
    const after = renderNode(ht, () => React.createElement(TipHost), []).markup;
    ok("ui.tiphost.renders-after-showtip", after.indexOf('class="tip-host"') >= 0
      && after.indexOf('class="th-title"') >= 0 && after.indexOf("长按提示") >= 0
      && after.indexOf('class="th-desc"') >= 0 && after.indexOf("松手前别动") >= 0,
      "showTip 之后 markup=" + JSON.stringify(after));

    ht.unmount();                                    // 卸载 → 跑 effect 返回的退订函数
    const calls = ht.setCallCount();
    showTip({ title: "不该再进来" });
    ok("ui.tiphost.unsubscribes-on-unmount", ht.setCallCount() === calls,
      "卸载后 showTip 仍触发了 " + (ht.setCallCount() - calls) + " 次 setState");
  } finally {
    hideTip();
    ht.restore();
  }

  // ------------------------------------------- tooltip（showTip / hideTip / subscribeTip）
  // 模块级单例：订阅表 + 当前 tip。每条断言都是一次真实的状态转换；结尾把单例还原。
  const htt = installHarness();
  try {
    hideTip();                                       // 起点：已知状态（前一个块可能留下过 tip）
    const seen: Array<Any> = [];
    const un = subscribeTip((t) => { seen.push(t); });
    ok("ui.tooltip.subscribe-immediate", seen.length === 1 && seen[0] === null,
      "subscribeTip 的首次回调（注册时立即用当前值）= " + JSON.stringify(seen));

    showTip({ title: "A" });
    ok("ui.tooltip.show-emits-current", seen.length === 2 && !!seen[1] && seen[1].title === "A",
      "showTip({title:'A'}) 之后订阅者收到 = " + JSON.stringify(seen[1]));

    hideTip();
    ok("ui.tooltip.hide-emits-null", seen.length === 3 && seen[2] === null,
      "hideTip() 之后订阅者收到 = " + JSON.stringify(seen[2]));

    hideTip();                                       // 已经是 null：不该再 emit
    ok("ui.tooltip.hide-idempotent-no-emit", seen.length === 3,
      "无提示时再 hideTip 的事件总数 = " + seen.length);

    showTip({ title: "B" }, 40);
    const bIds = htt.timers.pending();
    ok("ui.tooltip.autohide-schedules", bIds.length === 1 && htt.timers.delayOf(bIds[0]) === 40,
      "autoHideMs=40 的定时器 pending=" + JSON.stringify(bIds) + " ms=" + (bIds.length ? htt.timers.delayOf(bIds[0]) : "none"));

    showTip({ title: "C" });                         // 新 tip 必须取消上一条的 autoHide
    ok("ui.tooltip.show-cancels-autohide", htt.timers.pending().length === 0
      && htt.timers.cleared().indexOf(bIds[0]) >= 0,
      "showTip 未取消旧 autoHide：pending=" + JSON.stringify(htt.timers.pending())
        + " cleared=" + JSON.stringify(htt.timers.cleared()));

    showTip({ title: "D" }, 40);
    htt.timers.fire(htt.timers.pending()[0]);        // 到点 → current = null + emit
    ok("ui.tooltip.autohide-emits-null", seen.length > 0 && seen[seen.length - 1] === null,
      "autoHide 到点后最后一条事件 = " + JSON.stringify(seen[seen.length - 1]));

    const n = seen.length;
    un();                                            // 退订
    showTip({ title: "E" });
    ok("ui.tooltip.unsubscribe-stops", seen.length === n,
      "退订之后又收到 " + (seen.length - n) + " 条事件");
  } finally {
    hideTip();
    htt.restore();
  }

  // ------------------------------- pcmode（setKitPcMode / kitPcOn / useKitPcMode 的真实通知）
  // 反例纪律：不能写成「kitPcOn() 返回什么、hook 就返回什么」（同义反复）。这里真的切 store，
  // 并用 useSyncExternalStore 桩数**订阅回调被调用的次数**；同值重复设置必须一次都不通知。
  const hp = installHarness();
  try {
    ok("ui.pcmode.kitpcon-default", kitPcOn() === false, "kitPcOn() = " + kitPcOn());
    const PcProbe = (): React.ReactElement => {
      const on = useKitPcMode();
      return React.createElement("span", { "data-pc": String(on) });
    };
    const snap = (): string => renderToStaticMarkup(React.createElement(PcProbe as never));
    const m0 = snap();
    ok("ui.pcmode.hook-snapshot", m0.indexOf('data-pc="false"') >= 0, "初始 markup=" + m0);

    setKitPcMode(true);
    ok("ui.pcmode.set-on", kitPcOn() === true, "setKitPcMode(true) 之后 kitPcOn() = " + kitPcOn());
    ok("ui.pcmode.notifies-subscribers", hp.notices() === 1,
      "订阅回调被调用了 " + hp.notices() + " 次");
    const m1 = snap();                               // = 因通知而重渲染
    ok("ui.pcmode.hook-follows-store", m1.indexOf('data-pc="true"') >= 0,
      "通知后重渲染的 markup=" + m1);

    setKitPcMode(true);                              // 同值重复：pcOn === on 提前返回
    ok("ui.pcmode.idempotent-no-extra-notify", hp.notices() === 1,
      "同值重复设置后通知次数 = " + hp.notices());

    setKitPcMode(false);
    const m2 = snap();
    ok("ui.pcmode.set-off", kitPcOn() === false && m2.indexOf('data-pc="false"') >= 0,
      "setKitPcMode(false) 之后 kitPcOn() = " + kitPcOn() + "，重渲染 markup=" + m2);
  } finally {
    setKitPcMode(false);                             // 结尾还原，避免污染后面的断言（R9）
    hp.restore();
  }
  ok("ui.pcmode.state-restored", kitPcOn() === false, "测试结尾 kitPcOn() = " + kitPcOn());

  // ------------------------------------------------------------ useBlankTap
  // 纯状态机：位移 ≤ 容差 且 ≤ 700ms 且 target === currentTarget 才触发。
  // 不需要 DOM 桩（hook 只用 useRef），但需要控制 Date.now 才能判「超时」这一态。
  {
    const realNow = Date.now;
    let now = 1000;
    Date.now = () => now;
    try {
      let taps = 0;
      let api: { onPointerDown: (e: Any) => void; onPointerUp: (e: Any) => void } | null = null;
      const TapProbe = (): React.ReactElement => {
        api = useBlankTap(() => { taps++; }, 8);
        return React.createElement("span", { "data-tap": "1" });
      };
      renderToStaticMarkup(React.createElement(TapProbe as never));
      if (!api) throw new Error("useBlankTap 没有返回 handler");
      const host = {};
      const ev = (x: number, y: number, child = false): Any => ({
        clientX: x, clientY: y, target: child ? {} : host, currentTarget: host,
      });

      now = 1000; api.onPointerDown(ev(10, 10)); now = 1200; api.onPointerUp(ev(12, 12));
      ok("ui.blanktap.tap-fires", taps === 1,
        "容差内 + 700ms 内 + target===currentTarget → taps=" + taps);

      now = 2000; api.onPointerDown(ev(10, 10)); now = 2800; api.onPointerUp(ev(10, 10));
      ok("ui.blanktap.slow-press", taps === 1, "按住 800ms 后再松手 → taps=" + taps);

      now = 3000; api.onPointerDown(ev(10, 10)); now = 3100; api.onPointerUp(ev(40, 10));
      ok("ui.blanktap.move-exceeds-tol", taps === 1, "位移 30px > 容差 8 → taps=" + taps);

      now = 4000; api.onPointerDown(ev(10, 10)); now = 4100; api.onPointerUp(ev(10, 10, true));
      ok("ui.blanktap.child-target", taps === 1, "target 是子元素 → taps=" + taps);

      // 边界：位移恰好 = 容差仍算点击（判据是 `> moveTol` 才拦）—— 把比较写反也钉住
      now = 5000; api.onPointerDown(ev(10, 10)); now = 5100; api.onPointerUp(ev(18, 10));
      ok("ui.blanktap.tol-boundary-inclusive", taps === 2, "位移 = 8 = 容差 → taps=" + taps);

      let threw = false;
      try { api.onPointerUp(ev(10, 10)); } catch { threw = true; }
      ok("ui.blanktap.up-without-down", taps === 2 && !threw,
        "没有 down 的 up 必须是 no-op：taps=" + taps + " threw=" + threw);
    } finally {
      Date.now = realNow;
    }
  }

  // ------------------------------------------------------------ useLandscape
  // BUG-6 的守卫：SSR（无 window）下初值必须是 false 且**不抛**；有 window 时取 matchMedia；
  // effect 那条路在没有 window 时也必须守住（真实 SSR 运行时跑 effect 的那条路）。
  {
    const LandProbe = (): React.ReactElement =>
      React.createElement("span", { "data-land": String(useLandscape()) });
    ok("ui.landscape.ssr-false", (globalThis as Any).window === undefined
      && renderToStaticMarkup(React.createElement(LandProbe as never)).indexOf('data-land="false"') >= 0,
      "无 window 时 useLandscape() 必须是 false");

    const hl = installHarness();
    try {
      const w = (globalThis as Any).window as Any;
      w.matchMedia = (q: string): Any => ({
        matches: q === "(orientation: landscape)", media: q,
        addEventListener: () => { /* noop */ }, removeEventListener: () => { /* noop */ },
        addListener: () => { /* noop */ }, removeListener: () => { /* noop */ },
      });
      ok("ui.landscape.matchmedia-true",
        renderToStaticMarkup(React.createElement(LandProbe as never)).indexOf('data-land="true"') >= 0,
        "matchMedia('(orientation: landscape)').matches=true 时 useLandscape() 必须是 true");

      renderNode(hl, () => React.createElement(LandProbe), []);
      delete (globalThis as Any).window;             // 模拟真实 SSR：effect 跑的时候也没有 window
      let threw = false;
      try { hl.runEffects(); } catch { threw = true; }
      ok("ui.landscape.ssr-effect-guard", !threw,
        "无 window 时跑 useLandscape 的 effect 抛错=" + threw);
    } finally {
      hl.restore();
    }
  }

  // 收尾哨兵：最后一个 harness 也必须把 DOM 桩与自己加的键还原干净（R9）。
  ok("ui.hooks.leak-check", (globalThis as Any).window === undefined
    && (globalThis as Any)[REC_KEY] === undefined,
    "全部 ui-hooks 用例结束后没有残留的 window / 记录键");
}
