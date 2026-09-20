/**
 * deer-ui 的包入口（`exports["."]`）。
 *
 * 规则（方案 §3.2-A / §3.1）：
 * ① 本文件**只做 re-export**，不写任何实现（A0-2 的 `kit.barrel.reexport-only` 会盯着这条）；
 * ② **子入口之间不得互相 import**（`./kit` / `./tabs` / `./tooltip` 各自独立，宿主按模块裁剪时不会连带拉回整棵子树）；
 *    只有**根入口** re-export 子入口，这是它的职责；
 * ③ 公开面 = 本文件解析出来的符号集合 = `tests/snapshots/barrel-exports.json` 的快照，
 *    改导出面必须显式跑 `npm run snapshot:barrel` 并说明改了什么。
 *
 * P0b 已落地：`src/kit/index.ts` / `src/tabs.tsx` / `src/tooltip.ts` 现在是应用侧的逐字节副本（只有
 * `src/kit/scrub.tsx` 的 2 行 import 指向内联进来的 `src/internal/*`），这三行 re-export 把
 * **25 个值 + 6 个类型**（kit）、`TabBar`/`DropMenu`（tabs）、`showTip`/`hideTip`/`subscribeTip`（tooltip）
 * 全部抬上了公开面（数字见 `tests/snapshots/barrel-exports.json`）。
 *
 * ⚠️ **「与应用侧逐字节同一」不再是全局事实**（本轮双格式产物）：库内**每条相对 import 都补了 `.js` 后缀**，
 * 因为产物要能被**原生** `require()` / `import()` 解析（Node 的解析器不补后缀、不认目录）。所以
 * 「逐字节复制」这条血缘记载今后只对**除 import 行以外**的正文成立 —— 那些差异是库侧的有意分歧，不是漂移。
 */

/** 控件族：Dialog / Form / primitives / scrub / HoverTip / pcmode 的 barrel。 */
export * from "./kit/index.js";

/** 标签页与下拉菜单（`tabs.tsx`；`kit/index.ts` 里没有它们，所以必须在根入口补这一行）。 */
export * from "./tabs.js";

/** 长按 / 悬停提示的模块级单例（**库独占**：宿主那份 `src/ui/tooltip.ts` 必须改成再导出或删掉，见方案 R10）。 */
export * from "./tooltip.js";
