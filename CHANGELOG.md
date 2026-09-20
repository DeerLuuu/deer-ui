# 变更日志

本文件记录 deer-ui 的**可感知变化**。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

> **为什么没有历史版本条目**：本仓库不是从「有版本历史的仓库」里长出来的（它是从宿主应用的 `src/ui/`
> 原样切出来的），在此之前没有任何 CHANGELOG；当前版本号 `0.1.0`、`private: true`、**从未发布**。
> 凭印象补写 `0.0.x` 条目等于编造，所以这里只从建立本文件这一轮开始记。要查更早的事，看 `git log`。

## [Unreleased]

`Unreleased` 里目前累积了**三段**工作（每段的口径与验收命令都有独立文档）：

| 段 | 内容 | 口径 / 记录 |
|---|---|---|
| 范围 A/B | 工程规范底座 + 三条已确认运行期 bug（BUG-1/2/3） | [`docs/REQUIREMENTS-freeze.md`](docs/REQUIREMENTS-freeze.md) |
| 双格式产物 | ESM（`dist/`）+ CJS（`dist/cjs/`）两条原生加载路（提交 `032698d`；**当时未写 CHANGELOG，本文件这次补记**） | 下面「双格式产物（补记）」 |
| 范围 C | 判据加固（A0-2 类型级 / 根并集 / A0-3 覆盖 CSS）+ 12 个零断言符号补齐 + BUG-5 判据 + 双格式补审 + 收尾 | [`docs/REQUIREMENTS-freeze-C.md`](docs/REQUIREMENTS-freeze-C.md)、[`docs/WAVE-C-closeout.md`](docs/WAVE-C-closeout.md) |

> **计数口径**：下面每一段里写的 `assertions: N` / `dist/` 文件数都是**那一段落盘当时的实测值**。
> **现值是 `assertions: 222`（= `ui.*` 117 + `kit.*`+`lib.*` 105）、`dist/` 39 个产物文件** ——
> 以 README「断言台账与预算闸门」/「这个版本验证到了哪一步」与 `docs/WAVE-C-closeout.md` 为准。
> **已冻结的 DOM 契约与公开导出面三段都没变**（每段各有「未变」一节）。

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
- 上述三条「确认」级 bug 各带**新回归断言**：范围 B 当时新增 9 条 `ui.*`，`npm test` 末两行变成
  `assertions: 143` / `ALL PASS`（**当时的计数**；范围 C 之后为 222）；`tests/budget.test.ts` 的三道下限
  （134 / 62 / 72）**一处没动**。
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
  - 断言数改成实测的 **143**（范围 B 当时：`ui.*` 71 + `kit.*`+`lib.*` 72；预算下限仍 134 = 62 + 72）、
    `dist/` 25 个文件（范围 B 当时；双格式改造后是 39）、`styles.css` 17,790 B / 92 条规则 / 326 行、
    四个入口的符号数（30 + 9 / 25 + 6 / 2 + 2 / 3 + 1）逐项与机器输出核对；
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
- **产物未变（范围 B 当时的形态）**：`dist/` 仍 25 个文件，`dist/styles.css` 仍
  **17,790 B / 92 条规则 / 326 行**，`npm run check:dist` 仍 OK。`dist/` 的文件数在随后的双格式改造里
  变成 **39**（多了 `dist/cjs/` 树），`styles.css` 的字节/规则数三段都没变。
- **依赖面未变**：`package.json` 的 `dependencies` 仍为空、`devDependencies` 与 `peerDependencies`
  一行没动（本轮**没有**新增任何依赖，也没有新增 lint / format 工具链）；`src/**` 仍只依赖
  `react` / `react-dom` 家族与库内相对路径。
- **包内容未变**：`files` 仍是 `dist` / `LICENSE` / `README.md`；新增的 `.editorconfig` /
  `CONTRIBUTING.md` / `CHANGELOG.md` **不进 npm 包**。

### 双格式产物（补记：提交 `032698d`，当时未写 CHANGELOG）

- `exports` 的四个 JS 子入口各给 `{ types, import, require }` 三个条件；`dist/` 是 ESM 树（类型声明只在
  这一棵）、`dist/cjs/` 是 CJS 树，两棵树各带一份作用域 `package.json`（`{"type":"module"}` /
  `{"type":"commonjs"}`）。`src/**` 的相对导入统一补 `.js` 后缀（NodeNext 语义）—— 因为**目录导入**
  （`./kit`）在原生 `node` 下是 `ERR_UNSUPPORTED_DIR_IMPORT`。
- **实测**（范围 C 由 t2 独立补审 + t7 复跑）：`require('deer-ui')` / `import('deer-ui')` × 四个入口 =
  **30 / 25 / 2 / 3**，且与 `tests/snapshots/barrel-exports.json` **逐元素相等**（排序后比，不是只比长度）；
  `React` 仍是单实例；`dist/` 从 25 个文件变成 **39 个产物文件**（`check:dist` 同时新增「格式作用域 /
  两树互斥 / 相对说明符带 `.js`」与「原生加载冒烟」两组判据）。
- **已知代价**：同一入口的 CJS 与 ESM 是**两份模块实例**，所以 `tooltip` / `pcmode` 的模块级单例各有一份，
  混用会让长按提示**静默消失**。见 README「三条硬要求」第 2 条与「已知缺口」。
- **未变**：公开导出面逐字节未变（快照未改）、`dist/styles.css` **17,790 B / 92 条规则 / 326 行**未变、
  依赖面未变（仍零运行时依赖、无 bundler）。

> ⚠️ **这次改造当时没有走过独立质量门**（终局验证任务被任务图阻塞）。**范围 C 补做**了独立审计
> （t2，副本里的破坏性负例）：结论是「运行期承诺全部成立、不需要回滚」，同时发现 **F1 / F2 / F3**
> 三条缺陷（本轮只登记、不修，F2 已在 README 侧修正）。见
> [`docs/WAVE-C-closeout.md`](docs/WAVE-C-closeout.md) §5，以及下面表中的 C-1…C-4。

### 范围 C（收尾）：判据加固 + 12 个符号覆盖 + 双格式补审

- **新增判据**：
  - A0-2 看见**类型级**再导出（`export type * from "…"` / `export type * as ns from "…"`）+ A0-2 **自检段**
    （此前是三条 A0 判据里唯一没有自检段的）+ **根入口并集**判据 `kit.barrel.root-union`
    （在内存里比较根面与**全部 JS 入口**的并集，不靠重跑快照变绿；`*.nonvacuous` 另防并集全空）；
  - A0-3 的同一套口径**扩到样式源**：`kit.host.css-no-color-scheme` / `css-safearea-decls` /
    `css-media-allowlist` / `css-no-data-theme`；
  - **12 个零断言公开符号**的直接断言，共 **46 条** `ui.*`：`Keep` / `TipHost` / `useBlankTap` /
    `useLandscape` / `TabBar` / `showTip` / `hideTip` / `subscribeTip` / `setKitPcMode` / `kitPcOn` /
    `useKitPcMode` / `useHoverTipsEnabled`（逐符号断言名见 `docs/WAVE-C-closeout.md` §1.1）；
  - **BUG-5 判据**：`tests/ui-hooks.test.tsx` 的计时器桩改成「返回**不执行**的 id + `pending` / `cleared`
    记账」，新增 `ui.hooks.arm-timer-cleared` 等 4 条 —— 删掉 `src/kit/scrub.tsx` 的 `clearTimeout` 即红
    （旧桩下不会红，这正是这条判据存在的理由）；
  - **F5 判据可移植**：`tests/ui-kit.test.tsx` 的 6 处硬编码仓库根改成 `srcDir()`（认 `DEERUI_LIB_ROOT`），
    使负例能在无副作用副本里做。
- **计数**：`assertions: 222` / `ALL PASS`（`[budget] 222 = ui.* 117 + kit.*+lib.* 105`）；与 HEAD(143)
  名单逐符号 diff：**`REMOVED = ∅`**、`ADDED = 79`（ui 46 + kit/lib 33）。
- **未变**：三道预算下限 **134 / 62 / 72 一处未动**（`tests/budget.test.ts` 只改注释与新增断言）；
  `tests/snapshots/barrel-exports.json` **逐字节未变**；`dist/` 仍 **39** 个产物、`dist/styles.css` 仍
  **17,790 B / 92 条规则 / 326 行**；`src/**` 的 DOM 契约与公开导出面未变（`src/**` 本轮只被**临时**改动
  做差分验证，验证后逐字节还原，`git diff -- src` 为空）。
- **补审已提交产物**：t2 独立审计双格式产物 → 无 blocker、不需要回滚；发现 **F1**（CJS 的 TypeScript
  消费者拿不到类型：TS1479 / TS1471 / TS2307）、**F2**（README 的双包自检式恒为 `false`）、**F3**
  （`check-dist` 的「`types` 必须排第一」与 F1 的修法互斥，且遇嵌套对象 `TypeError`）。
  **F2 本轮已修**（README 改成应用侧约束）；**F1 / F3 只登记**（要动 `package.json` / `scripts/**`，
  超出范围 C 的写权）。
- **本轮不发版**：`version` 保持 `0.1.0`、`private: true`；没有新增任何依赖。

### 本轮登记但不实施（附解除条件）

| # | 缺口 | 本轮为什么不做 | 解除条件（下一轮怎么接） |
|---|---|---|---|
| **F-1** | 没有任何 lint / format 工具链（无 `.eslintrc*` / `eslint.config.*` / `.prettierrc*`）。**原先唯一的 lint 痕迹**是 `src/kit/scrub.tsx` 里的一句 `// eslint-disable-next-line react-hooks/exhaustive-deps` —— 它没有任何执行者（仓库里没有 ESLint 配置），是死注释；本轮修 bug 时该行已随修复**删除**（`src/**` 现在搜不到 `eslint` 字样），但那**不是**被工具接管，只是不再需要静音 | 引入 ESLint / Prettier = 新依赖 + 大面积格式化 diff，属「改范围」；与「不引依赖」这条不变量直接冲突 | 下一轮拟加：`devDependencies` 增 `eslint` + `@eslint/js` + `typescript-eslint` + `eslint-plugin-react-hooks`（这是**唯一**能真正执行 `react-hooks/exhaustive-deps` 的插件），根加 `eslint.config.mjs`，`package.json` 加 `"lint": "eslint ."`（与 `"format-check": "prettier --check ."`），**并接进 `.github/workflows/ci.yml` 在 `npm ci` 之后、`npm run typecheck` 之前**（lint 比 typecheck 快，先红先停）。首次引入必须先跑一次全仓格式化并**单独成一个提交**，否则把格式化 diff 混进语义改动里没法审 |
| **F-2** | 没有 `CHANGELOG.md` | —— | **本轮已解除**：本文件即产物；此后每次有可感知变化就落一条 `Unreleased` |
| **F-3** | 没有 `CONTRIBUTING.md`（`.github/` 下只有 `workflows/ci.yml`） | —— | **本轮已解除**：`CONTRIBUTING.md` 即产物。issue / PR 模板仍**不做**（单人库，模板是纯维护负担） |
| **F-4** | A0-2 没有自检段，且 `tests/scan.ts` 的 re-export 正则认不出 `export type * from "…"` | 修扫描器 / 补自检段 = 改判据语义（`tests/**` 属另一条任务），且会让现有断言面变化 | 解除条件：`tests/scan.ts` 的 `reStar` 与 `importSpecifiers` 支持 `export type * from` / `export type * as ns from`，并给 A0-2 补一段与 A0-1 / A0-3 同形的自检（合成入口 → 断言快照里出现 / 不出现该类型符号）；改了要按 §4 不变量重跑导出面快照 |
| **F-5** | 行尾只有在**编辑器侧**才刚有 `.editorconfig`；机器侧仍只靠 `git ls-files --eol` 目视 | 加 CI 步骤 = 改 `.github/workflows/ci.yml`，而本轮没有 lint 可接，空加步骤只增加噪音 | 解除条件：要么随 F-1 一起在 CI 里加一步 `git ls-files --eol` 的行尾断言（`w/crlf` 出现即失败），要么在 F-1 的 lint 里覆盖 |
| **C-1** | **CJS 的 TypeScript 消费者拿不到类型**：`exports` 的 `types` 条件不区分格式，命中的是 ESM 树的 `.d.ts`，`dist/cjs/` 没有 `.d.ts` / `.d.cts`。实测 node16+CJS `import` → **TS1479**、`import x = require()` → **TS1471**、node10 → **TS2307**；ESM / bundler 工程 exit 0 | 修法是加法（按格式分流 `types` + 补 `.d.cts`），但要动 `package.json` 与产物布局，**且被 C-2 判据正面挡住**，超出范围 C 的写权 | 与 **C-2 同一提交**：按格式分流 `types` + 输出 `dist/cjs/**/*.d.cts`；四个入口 × {CJS node16, ESM node16, bundler, node10} 各跑一次消费者 `tsc --noEmit`。见 `docs/WAVE-C-closeout.md` §5.1 |
| **C-2** | `scripts/check-dist.mjs:83-85` 判「`types` 必须是 `keys[0]`」，与 C-1 的修法互斥；`:87-88` 对条件值没有字符串守卫，注入一个对象值会 **`TypeError`（脚本崩）** | `scripts/**` 本轮冻结（冻结口径 N-11） | 放宽成「`types` 存在且排在 `import` / `require` **之前**（允许其值为对象）」+ 递归/显式取字符串目标；**必须同时补一条负例**（`types` 排在 `import` 之后 → 判据必须红），否则那是宽松化而不是修正。见 §5.2 |
| **C-3** | `tests/budget.test.ts` 的历史分解注释仍有两处口径问题：① 现值停在范围 C 中途的 `143 → 176`（最终 **222**）；② 「`ui-kit` 53 → 56 = +3」的**绝对值整体偏 3**（实测「控件 DOM 契约」段是 **62 → 65**，剔除 12 条 `ui.kit.*` 才是 50 → 53；**增量 +3 与所列三个断言名是对的**） | `tests/**` 不在收尾任务的写权范围；**闸门本身正确**（三道下限 134/62/72 未动），错的只是注释分解 | 下一轮改成「按段计数的正向说明 + 现值 222」，提交信息写明这是**注释订正**。出处与复现见 `docs/WAVE-C-closeout.md` §5.3（V1） |
| **C-4** | `check-dist` 的两条弱判据：① CJS 树的相对 `require` 只认字面量 `require("./x.js")`，`require("./"+"primitives")` 这类拼接能全绿通过；② 「同入口 CJS/ESM 导出值一致」比的是**排序后的名字集合**（`check-dist.mjs:193-194`），同名不同实现能过 ⇒ **抓不到单例分裂** | 同属 `scripts/**`；本轮只登记 | 与 N-2（私有模块图完整性）或 C-1 那一批一起做；另外 `docs/NEXT-round-B.md:132` 的 CRLF 计数已过期（本机 `git ls-files --eol` 实测 `w/crlf` = **3**），下一轮请写**命令**而不是固定数字。见 `docs/WAVE-C-closeout.md` §5.4 |
