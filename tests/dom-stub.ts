/**
 * 库测试**自带**的最小 DOM 桩（方案 §4.4 契约层 / R9：库的 runner 不许依赖应用侧 `session.test` 的 `stubEnv()`）。
 *
 * ⚠️ 它不是 jsdom：不解析布局、不派发事件、不算样式。
 * 它的唯一职责是让「读 `window` 尺寸 / 挂监听 / 读写 dataset / 取 `getComputedStyle`」这类代码
 * 在 Node 里**不抛 ReferenceError**，从而让「控件模块被 import 时不该炸」这条断言可写。
 * 真需要 DOM 的交互测试不在本库的测试栈里（方案 Q7：不引 jsdom/vitest/puppeteer）：
 * 控件契约一律走 `react-dom/server` 的 `renderToStaticMarkup`。
 *
 * 用法：`const restore = installDomStub(); ... restore();`（用完必须还原，别污染后面的测试）
 */

type Any = any;

function makeEl(tag: string): Any {
  const el: Any = {
    tagName: String(tag).toUpperCase(),
    nodeType: 1,
    children: [] as Any[],
    dataset: {},
    style: {
      setProperty(): void {},
      removeProperty(): void {},
      getPropertyValue(): string {
        return "";
      },
    },
    classList: {
      add(): void {},
      remove(): void {},
      toggle(): void {},
      contains(): boolean {
        return false;
      },
    },
    setAttribute(): void {},
    removeAttribute(): void {},
    getAttribute(): string | null {
      return null;
    },
    appendChild(c: Any): Any {
      el.children.push(c);
      return c;
    },
    removeChild(c: Any): Any {
      const i = el.children.indexOf(c);
      if (i >= 0) el.children.splice(i, 1);
      return c;
    },
    insertBefore(c: Any): Any {
      return el.appendChild(c);
    },
    addEventListener(): void {},
    removeEventListener(): void {},
    dispatchEvent(): boolean {
      return true;
    },
    getBoundingClientRect(): Any {
      return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 };
    },
    querySelector(): null {
      return null;
    },
    querySelectorAll(): Any[] {
      return [];
    },
    focus(): void {},
    blur(): void {},
    click(): void {},
  };
  return el;
}

export function installDomStub(): () => void {
  const g = globalThis as Any;
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const define = (key: string, value: unknown): void => {
    if (!saved.has(key)) saved.set(key, Object.getOwnPropertyDescriptor(g, key));
    try {
      Object.defineProperty(g, key, { value, configurable: true, writable: true });
    } catch {
      /* Node 里个别全局（如 navigator）可能是不可覆盖的访问器：忽略，测试自己按需降级 */
    }
  };

  const html = makeEl("html");
  const body = makeEl("body");
  const document: Any = {
    documentElement: html,
    body,
    head: makeEl("head"),
    activeElement: null,
    createElement: (t: string) => makeEl(t),
    createTextNode: (text: string) => ({ nodeType: 3, textContent: text }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const window: Any = {
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1,
    document,
    matchMedia: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }),
    addEventListener: () => {},
    removeEventListener: () => {},
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    requestAnimationFrame: (): number => 0,
    cancelAnimationFrame: (): void => {},
    setTimeout,
    clearTimeout,
  };
  document.defaultView = window;

  define("window", window);
  define("document", document);
  define("navigator", { userAgent: "deer-ui-dom-stub", maxTouchPoints: 0 });
  define("requestAnimationFrame", window.requestAnimationFrame);
  define("cancelAnimationFrame", window.cancelAnimationFrame);
  define("getComputedStyle", window.getComputedStyle);

  return () => {
    for (const [key, desc] of saved) {
      if (desc) Object.defineProperty(g, key, desc);
      else delete g[key];
    }
  };
}
