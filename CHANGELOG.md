# 变更日志

本文件记录 deer-ui 的**可感知变化**。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

> **为什么没有历史版本条目**：本仓库不是从「有版本历史的仓库」里长出来的（它是从宿主应用的 `src/ui/`
> 原样切出来的），在此之前没有任何 CHANGELOG；当前版本号 `0.1.0`、`private: true`、**从未发布**。
> 凭印象补写 `0.0.x` 条目等于编造，所以这里只从建立本文件这一轮开始记。要查更早的事，看 `git log`。

## [Unreleased]

本轮 = 「补齐工程规范 + 修已确认的运行期 bug」，范围、bug 三态裁定与验收命令见
`docs/REQUIREMENTS-freeze.md`。**已冻结的 DOM 契约与公开导出面未变**（详见下面「未变」一节）。

### 修复

- **`DropMenu` 打开期间每次 render 都重挂 window 监听**（`src/tabs.tsx` 的 `useLayoutEffect` 缺依赖数组：
  打开状态下滚动 / resize / 父组件更新都会「先摘再挂」resize+scroll）。修法：补上依赖数组，**不改变**
  下拉本体的 portal 与 `position: fixed`。回归断言：`ui.dropmenu.layout-effect-deps`
  （源码级判据：该 hook 的块尾必须带依赖数组 `[open]`）。
- **`ScrubNum` 拖动中 `min` / `max` / `step` 变更被旧闭包吞掉**（事件处理器定义在按下那一帧的闭包里，
  再挂到 window 上，读到的是**注册时**的 props）。修法：边界与 `onChange` 走 ref，处理器读**当帧**值。
  回归断言：`ui.scrubnum.bounds-live` / `ui.scrubnum.bounds-ref`（源码级），加上
  `tests/ui-hooks.test.tsx` 里真正跑 effect 生命周期的 `ui.hooks.drag-handler-live` /
  `ui.scrubnum.drag-live-bounds`（拖动中把 `min` 改成 500，下一次 `pointermove` 必须提交 `500`）。
- **`ScrubNum` 拖动中被卸载不摘 window 监听、且仍会调 `onChange`**（`pointermove` / `pointerup` /
  `pointercancel` 只在抬起路径摘除，组件没有任何卸载清理；本库的 `<Keep>` 是**延迟卸载**语义，
  所以这是正常用法）。修法：ref 化 + 卸载 cleanup。回归断言：`ui.hooks.arm-wired` /
  `ui.hooks.arm-registers` / `ui.scrubnum.unmount-cleanup`（按下 → arm 挂上 3 个监听 → 卸载后必须剩 0 个），
  以及 `ui.hooks.recorder-restored` 这条「运行器用完还原、不污染后面断言」的护栏。
- 上述三条「确认」级 bug 各带**新回归断言**：本轮新增 9 条 `ui.*`，`npm test` 末两行变成
  `assertions: 143` / `ALL PASS`；`tests/budget.test.ts` 的三道下限（134 / 62 / 72）**一处没动**。
  t1 裁定为「存疑」的四条（滚轮累加器跨手势残值、380ms 内卸载留下 `armT`、SSR 下 `useLayoutEffect`、
  `DropMenu` 与外层 `Dialog` 的 Esc 抢占）本轮**有意不改**，登记在 `docs/REQUIREMENTS-freeze.md` §3.3。

### 新增

- **`.editorconfig`**：编辑器基线，唯一一条硬规则是 `end_of_line = lf`（与库根 `.gitattributes` 的
  `* text=auto eol=lf` 是同一条铁律的编辑器侧）。它**不产生 CI 判据**（本仓库没有 lint / format 工具链）。
- **`CONTRIBUTING.md`**：本地起步（`npm ci` 会顺带跑 `prepare`）、提交前必跑的四条命令、
  改导出面的流程（`npm run snapshot:barrel` + 提交信息写明增删改）、三条不变量（DOM 契约是公开面、
  不引运行时依赖、不得自判 PC / 主题 / 安全区），以及 `package.json` 全部 scripts 的逐条说明。
- **`CHANGELOG.md`**（本文件）。

### 变更

- **`README.md` 对账**（只改与实测 / 源码不符的地方，结构未动）：
  - 断言数改成实测的 **143**（`ui.*` 71 + `kit.*`+`lib.*` 72；预算下限仍 134 = 62 + 72）、
    `dist/` 25 个文件、`styles.css` 17,790 B / 92 条规则 / 326 行、四个入口的符号数
    （30 + 9 / 25 + 6 / 2 + 2 / 3 + 1）逐项与机器输出核对；
  - 「A0 三条判据都有自检段」改为事实：**A0-1 / A0-3 带自检段，A0-2 没有**；
  - 如实登记 A0-2 的**已知可见性缺口**：`tests/scan.ts` 的 re-export 正则认不出 `export type * from "…"`，
    所以「公开导出面冻结」这条不变量对**类型级**再导出不设防；
  - 补上「库不发 `"use client"`」这条**受限结论**：App Router 的服务端组件不能直接用这些控件
    （它们用 hooks 与事件处理器），消费侧要自己划客户端边界；**不**声明「已验证支持 SSR」
    （本仓库测试用 `renderToStaticMarkup`，不执行 effects，SSR 路径不可机检）；
  - 两处与仓库事实不符的句子改准：「仓库树里没有一行 JS/CSS」（实际有手写源码 `src/styles/*.css` 等）、
    「`.gitattributes` 全文一行」（实际 13 行：12 行注释 + 1 行指令）；
  - 「测试基建的三处有意选择」补记本轮新加的 **effect 生命周期运行器**
    （`tests/ui-hooks.test.tsx`：在 `renderToStaticMarkup` + `tests/dom-stub.ts` 之上手动跑 effect 与
    cleanup，**仍然不是渲染器**、**不引 jsdom**）。

### 未变（本轮不变量，已逐条验证）

- **DOM 契约未变**：控件类名、元素层级、`role` / `aria-*` 一处没动（`tests/ui-kit.test.tsx` 的既有
  `ui.*` 断言全部保留，只增不改）。
- **公开导出面未变**：`tests/snapshots/barrel-exports.json` 未被修改（根入口 30 值 + 9 类型、
  `./kit` 25 + 6、`./tabs` 2 + 2、`./tooltip` 3 + 1）。
- **产物未变**：`dist/` 仍 25 个文件，`dist/styles.css` 仍 **17,790 B / 92 条规则 / 326 行**，
  `npm run check:dist` 仍 OK。
- **依赖面未变**：`package.json` 的 `dependencies` 仍为空、`devDependencies` 与 `peerDependencies`
  一行没动（本轮**没有**新增任何依赖，也没有新增 lint / format 工具链）；`src/**` 仍只依赖
  `react` / `react-dom` 家族与库内相对路径。
- **包内容未变**：`files` 仍是 `dist` / `LICENSE` / `README.md`；新增的 `.editorconfig` /
  `CONTRIBUTING.md` / `CHANGELOG.md` **不进 npm 包**。

### 本轮登记但不实施（附解除条件）

| # | 缺口 | 本轮为什么不做 | 解除条件（下一轮怎么接） |
|---|---|---|---|
| **F-1** | 没有任何 lint / format 工具链（无 `.eslintrc*` / `eslint.config.*` / `.prettierrc*`）。**原先唯一的 lint 痕迹**是 `src/kit/scrub.tsx` 里的一句 `// eslint-disable-next-line react-hooks/exhaustive-deps` —— 它没有任何执行者（仓库里没有 ESLint 配置），是死注释；本轮修 bug 时该行已随修复**删除**（`src/**` 现在搜不到 `eslint` 字样），但那**不是**被工具接管，只是不再需要静音 | 引入 ESLint / Prettier = 新依赖 + 大面积格式化 diff，属「改范围」；与「不引依赖」这条不变量直接冲突 | 下一轮拟加：`devDependencies` 增 `eslint` + `@eslint/js` + `typescript-eslint` + `eslint-plugin-react-hooks`（这是**唯一**能真正执行 `react-hooks/exhaustive-deps` 的插件），根加 `eslint.config.mjs`，`package.json` 加 `"lint": "eslint ."`（与 `"format-check": "prettier --check ."`），**并接进 `.github/workflows/ci.yml` 在 `npm ci` 之后、`npm run typecheck` 之前**（lint 比 typecheck 快，先红先停）。首次引入必须先跑一次全仓格式化并**单独成一个提交**，否则把格式化 diff 混进语义改动里没法审 |
| **F-2** | 没有 `CHANGELOG.md` | —— | **本轮已解除**：本文件即产物；此后每次有可感知变化就落一条 `Unreleased` |
| **F-3** | 没有 `CONTRIBUTING.md`（`.github/` 下只有 `workflows/ci.yml`） | —— | **本轮已解除**：`CONTRIBUTING.md` 即产物。issue / PR 模板仍**不做**（单人库，模板是纯维护负担） |
| **F-4** | A0-2 没有自检段，且 `tests/scan.ts` 的 re-export 正则认不出 `export type * from "…"` | 修扫描器 / 补自检段 = 改判据语义（`tests/**` 属另一条任务），且会让现有断言面变化 | 解除条件：`tests/scan.ts` 的 `reStar` 与 `importSpecifiers` 支持 `export type * from` / `export type * as ns from`，并给 A0-2 补一段与 A0-1 / A0-3 同形的自检（合成入口 → 断言快照里出现 / 不出现该类型符号）；改了要按 §4 不变量重跑导出面快照 |
| **F-5** | 行尾只有在**编辑器侧**才刚有 `.editorconfig`；机器侧仍只靠 `git ls-files --eol` 目视 | 加 CI 步骤 = 改 `.github/workflows/ci.yml`，而本轮没有 lint 可接，空加步骤只增加噪音 | 解除条件：要么随 F-1 一起在 CI 里加一步 `git ls-files --eol` 的行尾断言（`w/crlf` 出现即失败），要么在 F-1 的 lint 里覆盖 |
