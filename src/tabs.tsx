/**
 * ★ 占位文件（A0 骨架）★ —— P0b 会用应用中 `src/ui/tabs.tsx` 的**逐字节副本整体覆盖本文件**。
 *
 * 现在它只导出 0 个符号，作用是让 `exports["./tabs"]` 指向一个真实存在的产物
 * （`dist/tabs.js` / `dist/tabs.d.ts`），这样「能编译 / 能打包 / 能验产物」在骨架阶段就成立。
 * 覆盖之后 `TabBar` / `DropMenu` 会出现在这里，并被根入口 `src/index.ts` 的 `export * from "./tabs"` 抬上公开面。
 */
export {};
