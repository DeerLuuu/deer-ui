/**
 * `import "./x.css"` 的类型声明（只给示范页用）。
 *
 * 库是 **bundler-only**：`.css` 的 import 由打包器（esbuild / vite / webpack）处理，`tsc` 只需要
 * 知道「这个模块存在」。所以这里给一个通配声明 —— 它是 **dev-only** 的（`tsconfig.examples.json`
 * 才 include 它），`src` 里没有任何 CSS import，产物 `dist/*.d.ts` 因此不受影响。
 */
declare module "*.css";
