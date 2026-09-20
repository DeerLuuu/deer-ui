# deer-ui 范围 C 冻结口径（t1 产出）

> **本文件是范围 C 全部实现与验收的唯一依据。** 它是 [`docs/REQUIREMENTS-freeze.md`](REQUIREMENTS-freeze.md)（范围 A/B 口径）
> 的**续篇**：范围 A 的 §1 不变量与范围 B 的缺口登记仍有效，本轮只做「收尾」——**加固判据、补齐零断言符号、
> 补审已提交产物**，并把上一轮没走完的流程补完。
>
> 本文件只规定「什么算做完」，不规定实现细节。要改本文件任何一条，必须同时给出新的**客观判定方式**与**命令**。
>
> 生成时的实测基线（本机，只读命令，工作区干净）：
>
> | 命令 | 结果 |
> |---|---|
> | `npm test` | `assertions: 143` / `ALL PASS`（`[budget] 构成：143 = ui.* 71 + kit.*+lib.* 72`） |
> | `npm run build` | `dist/styles.css：17790 B / 92 条规则 / 326 行`；两棵产物树各带作用域 `package.json` |
> | `npm run check:dist` | `OK（39 个产物文件）` + `原生加载 OK（deer-ui 30 值；deer-ui/kit 25；deer-ui/tabs 2；deer-ui/tooltip 3）` |
> | `git status --porcelain` | 空 |
>
> 本文件自身**不改任何代码**：它是零写入任务（inScope 为空）。文中所有「实测」都来自本轮只读复核命令
> （`npm test` / `npm run build` / `node -e`），运行留下的 `dist/`、`tests/.ts-out/` 是 gitignore 覆盖的再生成产物。

---

## 0. 本轮一句话范围

**范围 C = 把「已提交的东西」变成「有判据的东西」，把「没有判据的东西」变成「有主人、有命令的东西」。**

四条主线：

1. **A0-2 加固**：类型级再导出（`export type *`）对导出面快照完全不可见 + A0-2 缺自检段 + 根入口「三子入口并集」无判据。
2. **A0-3 看见 CSS**：四条 A0-3 判据只扫 `src/**/*.ts(x)`，`src/styles/*.css` 是判据盲区（同一轮审计出：暗色媒体查询、`--sat` 赋值注入都全绿）。
3. **补齐 12 个零断言公开符号**（清单见 §3，与 README「已知缺口」逐字一致）。
4. **补审已提交产物**：上一轮的双格式改造没有经过独立质量门（原终局验证任务被任务图阻塞），本轮由独立审计员补审。

---

## 1. 本轮不变量（INV-C1 … INV-C8，先读这条）

每条都有**唯一判定命令**；任何一条变红 = 本轮失败。

| # | 不变量 | 判定命令 / 客观判据 |
|---|---|---|
| **INV-C1** | **DOM 契约不变**。范围 A §1 的 INV-1 逐字继续有效：`Dialog` 仍渲染 fragment（`.dlg-mask` + `.dlg[role=dialog][aria-modal=true][aria-label][data-guide]`，内部顺序 `dlg-head → top → dlg-body → extra → dlg-foot`）；其余控件类名/层级/`role`/`aria-*` 一处不改 | `npm test` 里 62 条从宿主逐字搬来的 `ui.*` 契约断言全绿（**名字一条不改**） |
| **INV-C2** | **公开导出面不变**。`tests/snapshots/barrel-exports.json` **逐字节不变**：`.` 30 值 + 9 类型 / `./kit` 25 值 + 6 类型 / `./tabs` 2 值 + 2 类型 / `./tooltip` 3 值 + 1 类型 | `git diff --exit-code -- tests/snapshots/barrel-exports.json` 退出码 0 **且** `npm test` 末两行是 `assertions: N` / `ALL PASS` |
| **INV-C3** | **产物字节不变**。`dist/` 仍 **39 个产物文件**；`dist/styles.css` 仍 **17,790 B / 92 条规则**（= `src/styles/*.css` 内容未改） | `npm run build` 打印 `17790 B / 92 条规则`；`npm run check:dist` 打印 `OK（39 个产物文件` |
| **INV-C4** | **依赖面不变**。不新增任何 `dependencies` / `devDependencies`；`src/**` 仍只依赖 `react` / `react-dom` 家族 + 库内相对路径且不越出 `src/`；仍然零运行时依赖、无 bundler | `git diff -- package.json`（只许出现 `scripts` 之外的空白/无改动）+ `npm test`（`kit.purity.offenders` 空） |
| **INV-C5** | **断言只许涨**。`npm test` 末行 `assertions: N` 必须 **N ≥ 143**；**任何既有断言的名字都不许删、不许改名、不许弱化**（`REMOVED = ∅`） | `npm test` 输出现值与 143 基线名单（本文件 §7 附录 A）逐符号 diff；`REMOVED` 必须为空 |
| **INV-C6** | **预算三道下限一处不动**。`tests/budget.test.ts` 的 `MIN_CONTRACT=62` / `MIN_INFRA=72` / `MIN_TOTAL=134` **不得上调、不得下调** | `git diff -- tests/budget.test.ts` 的 diff 里不得出现这三行的数值变化（只允许注释与**新增**断言代码） |
| **INV-C7** | **仓库不新增宿主依赖、不留临时文件**。`git status --porcelain` 为空；不新增 `*.tgz`、`tests/.ts-out/`、`dist/` 的**入库** | `git status --porcelain` + `git diff --exit-code`（结尾必须干净） |
| **INV-C8** | **工作区在范围 C 结束时仍然干净且全绿**（含差分验证的临时改动必须还原） | 最后一次提交后重跑 §6 的 V-C1 … V-C5 |

> **INV-C6 与 INV-C5 的张力已裁定**：纪律是「下限不涨」（§4 有解释），而「只许涨」由 INV-C5 用
> **既不删除也不改名的实测计数**来判；因此**不许**为了让数字好看去上调三道下限，也不许为了让断言跑绿去删断言。

---

## 2. 本轮要做的条目（每条：目标 / 客观判定 / 命令）

约定：命令一律从库根执行。`npm test` = `node scripts/tsc.mjs -p tests/tsconfig.json && node tests/.ts-out/tests/run-tests.js`。

### W1 — A0-2 看见类型级再导出（A0-2-1）

| 项 | 内容 |
|---|---|
| **目标** | `tests/scan.ts` 的 `barrelSurface()` 必须识别**类型级** re-export：`export type * from "…"` 与 `export type * as ns from "…"`。前者只并入**类型**集合（不并入值），后者把 `ns` 并入**类型**集合（它是类型命名空间）。裸 `export * from` / `export * as ns from` 的行为**不得回归**。 |
| **客观判定** | ① 反例（该抓的抓住）：给夹具入口加 `export type * from "./x"`（`x.ts` 同时导出 `interface Api` 与 `const v`）后，`barrelSurface` = `{values:[], types:["Api"]}`；加 `export type * as napi from "./x"` 后 = `{values:[], types:["napi"]}`。② 不改坏（该放过的放过 + 不回归）：`export * from "./x"` = `{values:["v"], types:["Api"]}`；`export * as ns from "./x"` = `{values:["ns"], types:[]}`；本地 `export type Local = 1` = `{values:[], types:["Local"]}`；动态 `import("./x")` = `{values:[], types:[]}`；`export { type Api as Alias } from "./x"` = `{values:[], types:["Alias"]}`。③ **空集契约**：`barrelSurface` 对「解析不到 / 深度 > 8 / 已访问」返回 `{values:[], types:[]}`，这条不许变。 |
| **命令** | `npm test`（新断言全绿）+ `git diff --exit-code -- tests/snapshots/barrel-exports.json`（**快照必须一字不动**：本轮不新增任何公开符号） |
| **现状证据（本轮只读复核）** | 用与 `tests/scan.ts` 同算法的探针在合成夹具上实测，当前实现：`export type *` → `{"values":[],"types":[]}`（**完全漏掉**）、`export type * as napi` → `{"values":[],"types":[]}`、`export *` → `{"values":["v"],"types":["Api"]}`、`export * as ns` → `{"values":["ns"],"types":[]}`、`export type Local` → `{"values":[],"types":["Local"]}`、动态 `import()` → `{"values":[],"types":[]}`。即：**只有类型级星号是漏的**，其余六种现状都已正确（修的时候别改坏）。 |
| **实现归属** | `tests/scan.ts`（**唯一主人**：A0-2 实现者）。已归档的补丁草稿见 `docs/NEXT-round-B.md` §1.2（`reStar` 加 `(type\s+)?` 捕获 + 分支处理），可直接采用；草稿里 `export type * as ns` 记入 `values` 的那一行**按本文件改判为 `types`**（理由：`export type * as ns` 造出的是类型命名空间，`import { ns } from …` 用不了，把它记成值是**假红**风险与**假绿**风险并存的那一侧）。 |

### W2 — 给 A0-2 补自检段（A0-2-2）

| 项 | 内容 |
|---|---|
| **目标** | A0-2 是三条 A0 判据里**唯一没有自检段**的。补一段与 A0-1/A0-3 同形的自检：合成夹具喂给 `barrelSurface`，断言「该抓的抓住、该放过的放过」。补完后 README「三条 A0 判据**都有**自检段」才能从「已改成真话（只有 A0-1/A0-3）」恢复成真话。 |
| **客观判定** | ① 至少 8 条自检断言（建议命名 `kit.barrel.selfcheck.<i>`，与 `kit.pcmode.selfcheck.<i>` 同形）；② 覆盖 §W1 的**全部六种**输入 + `export type *`（+ `export type * as`）两种该抓的；③ **判据被改坏必须能红**：把 `reStar` 改回旧正则后，至少一条自检断言变红（差分验证）；④ 夹具目录必须在 `os.tmpdir()` 下 `mkdtemp` 建立、`finally` 里删除，期间 `DEERUI_LIB_ROOT` 指向它并在 `finally` 里还原。**不许**在仓库里留任何夹具文件。 |
| **命令** | `npm test`；夹具泄漏检查：`git status --porcelain` 为空 |
| **实现归属** | `tests/a0-barrel.test.ts`（**唯一主人**：A0-2 实现者）。 |

### W3 — 根入口「三子入口并集」判据（A0-2-3）

| 项 | 内容 |
|---|---|
| **目标** | 加一条断言（建议名 `kit.barrel.root-union`）：从 `package.json.exports` 取**所有 JS 入口目标**（`types` 条件优先，与 `tests/a0-barrel.test.ts:entryPoints()` 同口径；排除 `./package.json` 与以 `.css` 结尾的非 JS 入口），各自 `barrelSurface` 后求**值集并集 ∪ 类型集并集**，断言 `barrelSurface(<rootsrc/index.ts>)` 的值集/类型集与该并集**逐项相等**（双向：不得多、不得少）。 |
| **客观判定** | ① 今天就绿：本轮只读验算 值集 30/30、类型集 9/9 相等；② **不是恒真**：把 `src/index.ts` 的任一条 `export *` 注释掉（内存/临时改动，验证后还原），该断言必须变红。本轮只读复核已证：人为丢掉 tooltip 那条 `export *` 后，根面不再包含 `showTip` 等符号 ⇒ 并集比较必然不等 ⇒ 断言红。③ `kit.barrel.surface`（快照）在快照未更新时仍会在**还原后**变红——但这条新断言的职责是「**在快照没被改动的正常提交里**，删掉一条 `export *` 也必须红」（快照是同一份文件，删 `export *` 会让快照比较也红；因此负例必须在**同时临时更新快照**的前提下做，或者直接在内存里比较两个 `Surface`）。**采用后者：负例用内存中的 `barrelSurface` 结果做，不碰仓库任何文件。** |
| **命令** | `npm test`；以及负例（内存级）：把 `src/index.ts` 文本读进内存、删掉一条 `export *` 行、`barrelSurface` 一个临时文件 → 断言不等 → 证明非恒真（做完无残留文件，`git status --porcelain` 为空） |
| **实现归属** | `tests/a0-barrel.test.ts`（**唯一主人**：A0-2 实现者，与 W2 同文件）。`tests/scan.ts` 如需一个「并集」纯函数，也归 A0-2 实现者。 |

### W4 — A0-3 看见 CSS（A0-3-1）

| 项 | 内容 |
|---|---|
| **目标** | 让「库不自行判定主题 / 安全区 / PC 模式」这条判据**覆盖 `src/styles/*.css`**。新增一组断言（建议名 `kit.host.css-no-color-scheme` / `kit.host.css-safearea-decls` / `kit.host.css-media-allowlist` / `kit.host.css-no-data-theme`，前缀 `kit.`），对 `src/styles/*.css` 的**去注释后正文**判定：① 不得出现 `prefers-color-scheme`；② `--sat/--sab/--sal/--sar` 只许作为 `var(--sa*)` **引用**，作为**声明/赋值**（`--sat:`、`--sat= `、`style.setProperty`）出现即红；③ 除 `:root` / `[data-theme="light"]` 两个令牌块外，不得出现 `[data-theme=…]` 选择器；④ `@media` 只许出现在**显式白名单**里，白名单本轮为**空**（当前实测：`tokens.css` / `kit.css` / `dist/styles.css` 去注释后 `@media` 数均为 **0**）—— 即「要往 `src/styles/*.css` 加一条 `@media`，必须先在冻结口径里把它加进白名单」，这是刻意的摩擦；同时**独立**保留一条与白名单无关的禁令：`(pointer:` / `(hover:` / `prefers-color-scheme` 三种媒体特征在 CSS 里出现即红（与 A0-3 在 TS 侧的措辞完全对齐）。 |
| **客观判定** | ① 现状全绿（实测：两种源 + 产物各 0 条 `@media`、0 处 `prefers-color-scheme`、4 处 `--sa*:` 声明**全在 tokens.css 的 `:root` 兜底块里**、6 处 `var(--sa*)` 引用在 kit.css）；② **五种绕过写法必须各自变红**（每一种至少一条断言变红，逐条给出注入后的断言名）：<br> (i) `src/styles/kit.css` 注入 `@media (prefers-color-scheme: dark){ .dlg{…} }` → `kit.host.css-no-color-scheme` 红<br> (ii) `src/styles/kit.css` 注入 `--sat:1px` → `kit.host.css-safearea-decls` 红<br> (iii) 注入 `@media (pointer: fine){ … }` → `kit.host.css-media-allowlist` 红<br> (iv) 注入 `[data-theme="light"]{ … }` 第二块 → 既有 `kit.styles.tokens-both-themes` 红（若第二块写在 tokens.css；写在 kit.css 则由 `kit.host.css-no-data-theme` 兜住 —— **这条断言本轮一并加上**）<br> (v) 注入 `@media (orientation: landscape){ … }` → `kit.host.css-media-allowlist` 红（**并把这条写进自检段**，防止有人把白名单放宽成 `orientation` 就悄悄放过 PC/主题判定）<br>③ 有自检段（建议 = 6 条：`prefers-color-scheme` 抓、`--sat:1px` 抓、`--sat` 的 `var()` 引用放过、`@media (pointer:fine)` 抓、`@media (orientation: landscape)` 抓、注释里的字样放过）。 |
| **命令** | `npm test`；差分：注入 (i)…(v) 的**任意一条**后 `npm test` 必须 `FAIL`，然后 `git restore src/styles/*.css` 还原并重跑 `npm test` 必须 `ALL PASS`，且 `git status --porcelain` 为空（**注入→观察→还原**必须在同一个 turn 内完成，`src/**` 本轮冻结） |
| **实现归属** | `tests/styles.test.ts`（**唯一主人**：A0-3 实现者）。**纯函数辅助（去注释 / 顶层块 / 声明计数）写在同一个文件里**，不要为了复用去动 `tests/scan.ts`（那是 A0-2 实现者的独占路径 —— 见 §5 归属表）。 |

### W5 — 补齐 12 个零断言公开符号（SYM-1）

| 项 | 内容 |
|---|---|
| **目标** | 12 个公开符号每个**至少一条真断言**（判据见 §3 清单）；断言写进 `tests/ui-kit.test.tsx`（渲染类，`renderToStaticMarkup` 断 DOM 契约）或 `tests/ui-hooks.test.tsx`（需要 effect / window 监听 / 计时器的，用既有的极小 effect 运行器）。 |
| **客观判定** | ① 12 个符号**逐个**有一条**名字含该符号语义**的断言（`ui.keep.*` / `ui.tiphost.*` / `ui.blanktap.*` / `ui.landscape.*` / `ui.tabbar.*` / `ui.tooltip.*` / `ui.pcmode.*` / `ui.hovertips.*`），断言名清单写进提交信息；② **逐符号差分**：至少抽查 3 个符号（必须含 `Keep`、`TabBar`、`showTip`）给出「改坏源码 → 对应断言变红 → 还原」的证据；③ **不写恒真填充**：任何一条断言在「把被测行为改成它的反面」后都必须变红；④ **快照与计数**：`tests/snapshots/barrel-exports.json` 一字不动；⑤ 结论与 README 逐字一致：本轮结束时 `README.md` 的「已知缺口」里**不再**有「12 个零直接断言」这一条（改成已完成，并写明覆盖到哪个程度）。 |
| **命令** | `npm test`（`ui.*` 数量必须 ≥ 71 + 12 个符号各自至少 1 条） |
| **实现归属** | `tests/ui-kit.test.tsx` + `tests/ui-hooks.test.tsx`（**唯一主人**：符号工程师）。`tests/run-tests.ts` **不归他改**（新断言挂进既有文件即可，`testUiKit` / `testUiHooks` 都已被 `run-tests.ts` 调用）。 |

### W6 — 计数与文档对账（SYM-2）

| 项 | 内容 |
|---|---|
| **目标** | ① 修 `tests/budget.test.ts:24` 的过期注释：「新增 7 条（2+2+4）」→ 实测 **+9**（`ui-kit` 53→56 = +3：`ui.dropmenu.layout-effect-deps`、`ui.scrubnum.bounds-live`、`ui.scrubnum.bounds-ref`；新文件 `ui-hooks` 6 条），并把范围 A 实测口径 143 = `ui.*` 71 + `kit.*+lib.*` 72 写成**现值记录**；② `README.md` 的 `assertions: 143`（「开发与调试」）、断言台账三行现值、「这个版本验证到了哪一步」表全部更新到**本轮实测值**；③ `CHANGELOG.md` 的 `assertions: N` 同步；④ 顺手订正 README「已知缺口」里**本轮已消除**的那几条（12 个零断言、A0-2 类型级不可见、A0-2 无自检段、A0-3 看不见 CSS），**并不得**把仍存在的缺口（令牌超集、混用格式单例分裂、无障碍一半、三端只静态守、React 只测 18.3.1、样式归属判据弱、预算闸门钉条数、A0-1 `escape` 依赖目标存在、示范页跑不起来、lint 缺失）删掉。 |
| **客观判定** | ① `npm test` 实测 `assertions: N` 与 `README.md` / `CHANGELOG.md` / `budget.test.ts` 注释里的数字**三处一致**；② `git diff -- tests/budget.test.ts` 中 `MIN_CONTRACT` / `MIN_INFRA` / `MIN_TOTAL` 三行数值**未变**；③ README 里凡有机器判据的数字（`assertions: N`、`dist/` 文件数、`styles.css` 字节数/规则数、四个入口的符号数）逐条等于实测；④ 无机器判据的数字（`:root` 143 个令牌 / 34 被引用 / 浅色块 77 个）**保持原值**或按 `node scripts/build-styles.mjs` 输出核对，不得凭印象改。 |
| **命令** | `npm test` + `npm run build` + `npm run check:dist`（三条输出与 README 逐条对账） |
| **实现归属** | `README.md`、`CHANGELOG.md`、`tests/budget.test.ts`（**唯一主人**：符号工程师）。 |

### W7 — 独立补审已提交的双格式产物（AUDIT-1）

| 项 | 内容 |
|---|---|
| **定位** | **不是**新实现、**不写代码**：这是对**已提交**产物（提交 `032698d`）的**独立质量门补审**——上一轮的双格式改造没有经过独立审计（原终局验证任务被任务图阻塞而无法派发）。审计员不拥有任何路径的写权，结论是 `verdict=pass` 或 `needs_revision`（带 findings）。 |
| **必须回答的问题（逐条给证据）** | ① **双包危险**：四个入口都同时有 `import` / `require` 两条条件；`src/tooltip.ts` 与 `src/kit/pcmode.ts` 是**模块级单例**。宿主一半 `require` 一半 `import` 同一子入口时，订阅表会不会分裂？分裂在**本仓库内**能不能被观察到？能不能在不改公开导出面的前提下用一条断言把它钉住？<br>② **React 单实例**：`dist/` 与 `dist/cjs/` 两棵树里有没有 `react` 的**内联副本**（`react-dom.development` 那条已有检查）；`require('deer-ui')` 与 `import('deer-ui')` 拿到的是不是**同一个** `react` 实例（本仓库 `node_modules` 只有一份，这对消费者是否仍然成立）？<br>③ **消费者真实可用性**：`check-dist` 的原生加载冒烟走的是 `exports` 条件（消费者路径），这是否等价于「装进 `node_modules/deer-ui` 后可用」？`types` 条件在最前、`.d.ts` 只在 ESM 树里、`dist/cjs/` 无 `.d.ts` —— 对 `"moduleResolution": "node16"/"bundler"` 的消费者分别意味着什么？<br>④ **`check-dist` 的新增判据是不是真的会红**（这是本审计的核心）：上一轮加了 ⑥ 格式作用域/两树互斥/相对说明符带 `.js`、⑦ 原生加载冒烟，但**没有任何判据证明它们会红**（`check-dist.mjs` 自己不被测试覆盖）。审计前先读代码，本轮只读复核已发现**两处可能是漏洞**、**必须给出结论**：<br> (a) ESM 树的相对说明符正则 `/(?:\bfrom\s*|\bimport\s*\(\s*)["'](\.[^"']*)["']/g`：**`export * from "./x"` 会不会被 `\bfrom\s*` 命中**？（读代码给结论 + 给出可复现的负例手法）<br> (b) CJS 树的相对 `require` 正则只查 `require("…")`：`require("./x")` 之外（如经 `__importStar` / 变量拼接）的路径是否漏判？<br>⑤ **负例必须实测**（不许只看代码）：在 `dist/`（**再生成产物，允许破坏**）里做至少 3 个负例——(i) 把 `dist/cjs/kit/index.js` 一条相对 `require` 的 `.js` 去掉；(ii) 在 `dist/kit/index.js` 里插一行 `require("x")`；(iii) 删掉 `dist/tooltip.js`（= `exports["./tooltip"].import` 目标不存在）。每例必须观察到 `npm run check:dist` 退出码非 0，并记录它命中哪条判据；跑完 `npm run build` 复原，最后 `npm run check:dist` 必须 OK。 |
| **客观判定** | ① 五个问题**逐条**有明确结论（有 / 没有 / 不可判，并附代码位置或命令输出）；② 至少 3 个负例**实测**到红，且每例记录命中的判据文字；③ 有结论说明「`check-dist` 是否真的能在双格式退化时变红」，并明确哪些退化它**抓不到**（这些写进「已知缺口」给 `symbols-engineer` 转写，不自己改 README）；④ `npm run build` 复原后 `npm run check:dist` OK、`npm test` `ALL PASS`、`git status --porcelain` 为空；⑤ 结束时不留任何 `dist/` 改动（`dist/` 本就 gitignore，但**必须在结束前重跑一次 `npm run build`**，让工作区的 `dist/` 回到与 `src/` 一致的状态）。 |
| **命令** | `npm run build` / `npm run check:dist` / `npm test` / `node -e "console.log(require('deer-ui/kit').setKitPcMode === (await import('deer-ui/kit')).setKitPcMode)"`（双包危险的自检式，记录实际结果） |
| **实现归属** | **无写入路径**（`inScope` 为空）。允许的写操作只有：`dist/**`（gitignore 的再生成产物，跑完必须 `npm run build` 复原）。**禁止**改 `src/**`、`tests/**`、`scripts/**`、`package.json`、`README.md`、`CHANGELOG.md`。 |

### W8 — 终局验证（VERIFY-1）

| 项 | 内容 |
|---|---|
| **目标** | 在全部实现落盘后，按 §6 的 V-C1 … V-C5 逐条跑；外加**差分式反证**：证明本轮新增的每一条判据**都不是恒真**。 |
| **客观判定** | ① V-C1…V-C5 全绿；② INV-C1…INV-C8 逐条有证据；③ `assertions: N ≥ 143` 且 `REMOVED = ∅`（与 §7 附录 A 的 143 条基线名单逐符号 diff）；④ `tests/budget.test.ts` 三道下限数值未变；⑤ 至少 5 条差分（A0-2 类型级、根并集、A0-3 暗色媒体查询、A0-3 `--sat` 赋值、12 符号里抽查的 3 个）各自「改坏即红、还原即绿」；⑥ `git status --porcelain` 空。 |
| **命令** | §6 的 V-C1…V-C5 + 各差分命令 |
| **实现归属** | **无写入路径**（只读 + 临时改动必须还原）。 |

---

## 3. 12 个零断言符号清单与各自的最低判据

**清单（与 README「已知缺口」逐字一致，实测复核：`tests/**` 里对这 12 个名字的引用数 = 0）**：

`Keep` · `TipHost` · `useBlankTap` · `useLandscape` · `TabBar` · `showTip` · `hideTip` · `subscribeTip` ·
`setKitPcMode` · `kitPcOn` · `useKitPcMode` · `useHoverTipsEnabled`

> 早先盘点列 14 个，含 `Overlay` / `DropMenu`；它们在范围 B 修 BUG-1 时已补上断言（`ui.overlay-full`、3 条 `ui.dropmenu.*`），
> **当前实际是 12 个**。本轮**只做这 12 个**，不许把 `Overlay` / `DropMenu` 再算一遍凑数。

| 符号 | 源码位置 | 最低判据（改坏就必须红） |
|---|---|---|
| `Keep` | `src/kit/primitives.tsx:125-148` | `renderToStaticMarkup(<Keep on el={<span/>}/>)` 出 `.keep` 且**不含** `out`；`on=false` 且已挂载过时，退场期间出 `.keep.out` 且**仍渲染缓存子树**（用 effect 运行器推进 `ms` 后退场才发生）。至少 2 条：入口态 + 退场态。 |
| `TipHost` | `src/kit/primitives.tsx:95-105` | 无提示时渲染 `null`（markup 为空串）；`showTip({title,desc})` 之后（`subscribeTip` 立即回调）渲染出 `.tip-host` + `.th-title` + `.th-desc`。 |
| `useBlankTap` | `src/kit/primitives.tsx:153-171` | 直接调用返回的两个 handler：位移 ≤ 容差且 ≤ 700ms 且 `target===currentTarget` → 触发；**位移超容差 / 超时 / target 是子元素** → 不触发。（不需要 DOM，纯状态机） |
| `useLandscape` | `src/kit/primitives.tsx:12-25` | SSR（无 `window`）下渲染不抛且返回 `false`（BUG-6 的守卫）；有 `window` 时初值取 `matchMedia("(orientation: landscape)").matches` —— 用 DOM 桩把 `matches` 置 `true` 后必须返回 `true`。 |
| `TabBar` | `src/tabs.tsx:23-50` | `.tabbar` + `.tabbar-tabs` 层级、每个 item 一个 `.tabbar-tab`（选中项加 `on`）、`badge` 出 `.tabbar-badge`、`right` 出 `.tabbar-right`、`guide` 进 `data-guide`、`className` 追加到 `.tabbar`。 |
| `showTip` | `src/tooltip.ts:13-18` | `subscribeTip` 订阅后 `showTip(t)` 收到 `t`；`autoHideMs>0` 时用桩计时器到点后收到 `null`。 |
| `hideTip` | `src/tooltip.ts:20-23` | `showTip` 后 `hideTip()` → 订阅者收到 `null`；**无提示时再调不重复 emit**（`current` 为 null 时不 emit）。 |
| `subscribeTip` | `src/tooltip.ts:29-33` | `subscribeTip` 注册时**立即**用当前值回调一次；返回的退订函数调用后**不再**收到事件。 |
| `setKitPcMode` | `src/kit/pcmode.ts:12-16` | `setKitPcMode(true)` → `kitPcOn()` 为 `true`；**同值重复设置不触发订阅者**（`pcOn === on` 提前返回）；异值才触发。 |
| `kitPcOn` | `src/kit/pcmode.ts:18-20` | 默认 `false`；`setKitPcMode(true)` 后 `true`。（测试结尾必须还原成 `false`，避免污染后面断言 —— R9 顺序无关） |
| `useKitPcMode` | `src/kit/pcmode.ts:27-29` | 通过 `renderToStaticMarkup` 在一个探针组件里调用，断言其返回值等于 `kitPcOn()`（`useSyncExternalStore` 在 SSR 走 `getServerSnapshot`）。 |
| `useHoverTipsEnabled` | `src/kit/HoverTip.tsx` | 与 `setHoverTipsEnabled` 成对：读到的值随 setter 变化，并在测试结尾还原。 |

**纪律（写在任务书里，同时是验收判据）**：
- 每条断言必须「改坏源码即变红」；**至少抽查 `Keep` / `TabBar` / `showTip` 三个**给出「改坏 → 红 → 还原 → 绿」的实测记录。
- 断言名必须含符号语义，便于 `REMOVED = ∅` 的逐符号 diff。
- **不许**为凑数字加断言；**不许**写 `ui.filler` 一类恒真断言（范围 A 已实测过这条作弊路径）。
- 触到 `window` / 计时器的测试**必须在 `finally` 里还原**（`tests/dom-stub.ts` 的 `installDomStub()` 返回值 + `tests/ui-hooks.test.tsx` 的 `harness.restore()`），且不得让后续断言变成顺序依赖（既有 `lib.runner.dom-stub.restored` 是这条的哨兵）。

---

## 4. 遗留 bug 候选逐条裁定（二态：**本轮做** / **本轮不做**）

二态定义：**本轮做** = 有代码级因果链，且能在**本仓库**（无浏览器、无 jsdom、无真实 effect 运行时的既有测试栈）内给出**可机检判定**；
**本轮不做** = 缺判定能力（无设备/无渲染器/取决于调用方结构），或「改了没有客观判定」——本轮只登记，**不得顺手改**。
**本条无第三态**：任何「大概有问题」都必须落进某一态并给出理由。

| ID | 现象 | 代码位置（实测行号） | 触发条件 | 裁定 | 理由 |
|---|---|---|---|---|---|
| **BUG-4** | 滚轮累加器跨手势残留，下一次滚轮结算出一次「幽灵步进」 | `src/kit/scrub.tsx:43`（`wheelAcc` ref）、`163-183`（`onWheel` 只在 `[value,text]` 变化时重置 `wheelVal`，**不清 `wheelAcc`**；仅 `192-195` 的卸载 effect 清 `wheelAcc`） | 用户滚了**不足 1 notch**（`\|Δ\| < 100`）后停止 → `wheelAcc` 留残值 → 下次滚轮第一格可能一次跳 2 步 | **本轮不做** | ① 因果链**存在**但**不是缺陷**：`takeNotches` 的数学是「累计 100px = 1 步」，同一个手势内的残值必须保留（否则同一个 notch 被浏览器切成 10–40 个事件时会被反复丢弃，这正是这段代码当初要修的问题）；跨手势残留只在「设备能细分出 < 1 notch 的滚动量」时可见，鼠标滚轮的 notch 是整块 delta（≥100px，`wheelNotches` 除 100 后恰为 1），触控板平滑滚动则是**连续运动**，残值被下一次事件消费在物理上仍然是一次连续滚动。② **无可机检判定**：判定它需要一个「手势边界」信号（真实浏览器的 `wheel` 事件之间无边界标记），本仓库无布局/无真实输入；写「`end()` 清 `wheelAcc`」那种断言只能证明代码里有那行字，**证明不了行为**（属于恒真填充）。③ 改它 = 改运行时行为（滚轮手感），超出「收尾」范围，且无回归判据可守。**登记**：若下一轮引入带计时器的 `onWheel` 去抖（约 150ms 归零），届时必须同时给出一条**纯函数 + 假计时器**级的断言（断言「两次手势之间累加器归零」），并重跑 `ui.scrubnum.*` 全部既有断言。 |
| **BUG-5** | `armT` 定时器在 380ms 内卸载时留下未清的可空定时器 | 实现位 `src/kit/scrub.tsx:88-97`（`detachLive()` 第一句 `if (armT.current !== null) { window.clearTimeout(armT.current); armT.current = null; }`），调用位 `192-195`（空依赖 effect 的 cleanup） | 按下（`down()` 在 `119` 起 380ms 定时器）后**在 380ms 内卸载**组件 | **本轮做（仅补判据，源码已固化）** | ① **代码因果链已消除**：`detachLive()` 现在在**卸载**路径上被调用，第一句就是 `clearTimeout(armT.current)`；范围 B 的 BUG-3 修复（`192-195` 的空依赖 effect）**已把 BUG-5 的实现一并覆盖**（`docs/NEXT-round-B.md` §3 的 F6 就是这么记的），本轮**不再改 `src/**`**。② **但判据仍然缺，而且现在是「靠巧合绿」**：实测复核 `tests/ui-hooks.test.tsx:65` 的计时器桩是 `window.setTimeout = (fn) => { fn(); return 0; }` —— 定时器当场执行、返回 id `0`，而 `arm()` 的定时器回调（`src/kit/scrub.tsx:119-124`）第一句就把 `armT.current` 置成 `null`；于是卸载时 `armT.current` 之所以仍非 null，靠的是**测试桩把真实的 pending 状态抹掉后留下的 `0`**。本轮用一个探针在 `detachLive()` 的 `clearTimeout` 那句前打印，实测输出 `PROBE:clearTimeout(0)`（只出现 1 次，来自 `ui.hooks.*` 的卸载路径）—— 也就是说：**这行源码确实会被执行到，但「380ms 未到点就卸载」这个真实场景从来没有被验证过**；把该行删掉，现有 143 条断言也**不会变红**。③ **本轮做的是判据**：让 `tests/ui-hooks.test.tsx` 的计时器桩返回**非执行**的可用 id 并记录 `clearTimeout` 调用（例如 `window.setTimeout = (fn) => { pending.push(fn); return NEXT_ID++; }` + 记录 `clearTimeout(id)`），再加一条断言：**按下后、定时器未到点时卸载 → 该 id 出现在 `clearTimeout` 记录里**（并且记录里**不含**未注册的 id，防恒真）。④ 该断言必须**改坏即红**：删掉 `detachLive()` 里那句 `clearTimeout`（临时改动、验证后还原）→ 新断言变红（旧桩下不会红，这正是本条存在的理由）。⑤ 归属：`tests/ui-hooks.test.tsx`（符号工程师）；**只许改测试，不许改 `src/kit/scrub.tsx`**。 |
| **BUG-8** | `DropMenu` 打开时 Esc 被外层 `Dialog` 抢占 | `src/tabs.tsx:101-106`（`useEffect(..., [open])` 里挂 window `keydown`，`setOpen(false)`）、`src/kit/Dialog.tsx:53-58`（`useEffect(..., [escClose, close])` 里挂 window `keydown`，调 `close()`） | 两者同开时按 Esc：两个 `window` 监听都触发，行为随**挂载顺序**变化 | **本轮不做** | ① **不是控件自己的契约缺陷**：两个控件各挂一个 `window` 级监听，**都**执行然后各自关自己 —— 谁「赢」取决于调用方的组件结构与挂载顺序（宿主不在此仓库），属于**调用方结构**问题（范围 A §3.3 的裁定原样维持）。② **改哪边都缺客观判定**：改 `Dialog` 要动它的 DOM/公开契约（`DialogProps` 是公开类型面，`escClose` 语义是文档化行为）＝ 撞 INV-C1/INV-C2；改 `DropMenu` 加「抢占抑制」需要一个「谁在上层」的信号，而本仓库的测试栈**没有真实挂载运行时**（`renderToStaticMarkup` 不执行 effect、每棵树是独立渲染的），两个 `window` 监听的**顺序**在测试里不存在 —— 写得出断言也证明不了行为。③ 真正解法（层级化 Esc 管理 / 显式 `topmost` 仲裁）是**新功能**，不是收尾，且必然改公开契约。**登记**：要判它，需要在**宿主**里同开 `<Dialog>` + `<DropMenu>` 验证「Esc 只关最上层」；本仓库只登记。 |

**附带裁决（本轮同时把这两条说清，免得下一轮重新发现）**：

- **BUG-4 与 BUG-5 不是同一类**：BUG-5 的实现已固化、缺的是**判据**（所以本轮做判据）；BUG-4 缺的是**判定能力**（所以本轮不做，连判据也不加）。
- **`tests/ui-hooks.test.tsx` 的计时器桩是「BUG-5 判据盲区」的根因**：`fn(); return 0;` 同时抹掉了「定时器还没到点」这个状态。修它是 W5/BUG-5 判据的一部分，**不得**因此改动 `src/kit/scrub.tsx`。

---

## 5. 文件归属表（每个路径**只有一个主人**）

规则（范围 B 的教训，逐条照做）：
1. 同一路径出现在两条任务的 `inScope` 里 ⇒ 两条任务**永远无法再编辑**（全局 inScope 冲突校验），所以**必须在计划阶段一次写对**。
2. 读侧（`verifier` / `reviewer` / `dual-format-auditor`）的写入范围**为空**：他们只跑命令、只读文件；任何临时改动必须在同一个 turn 内还原（`git status --porcelain` 为空是硬判据）。
3. 需要同一条路径的两条任务，必须**指定串行顺序**或**改归属** —— 本表无重叠。

| 路径 | 唯一主人 | 本轮动作性质 |
|---|---|---|
| `tests/scan.ts` | A0-2 实现者 | 写：`barrelSurface` 的 `reStar` 修复（+ 可选并集纯函数） |
| `tests/a0-barrel.test.ts` | A0-2 实现者 | 写：A0-2 自检段（W2）+ 根并集断言（W3） |
| `tests/styles.test.ts` | A0-3 实现者 | 写：CSS 可见性断言 + 自检段（W4）；本地纯函数辅助，不动 `scan.ts` |
| `tests/ui-kit.test.tsx` | 符号工程师 | 写：渲染类零断言符号断言（W5）+ **把硬编码 `__dirname/../../../src/…` 换成 `libRoot()`**（F5，见下）+ `ui.kit.export.*` 的循环 |
| `tests/ui-hooks.test.tsx` | 符号工程师 | 写：effect/计时器类零断言符号断言 + BUG-5 判据（其计时器桩必须能给「未到点」状态） |
| `tests/budget.test.ts` | 符号工程师 | 写：过期注释订正（`+9` / 143 现值）；**三道下限数值不动** |
| `README.md` | 符号工程师 | 写：数字对账 + 已消除缺口改写（W6） |
| `CHANGELOG.md` | 符号工程师 | 写：`assertions: N` + 本轮条目（W6） |
| `tests/run-tests.ts` | 符号工程师 | 只在需要新增一个测试文件时才改（默认**不改**：新断言挂进既有文件） |
| `src/**` | **无人**（本轮冻结） | 只读；差分验证允许临时改动，**同一 turn 内必须还原** |
| `scripts/**` | **无人**（本轮冻结） | 只读；`check-dist.mjs` 的补强**不在本轮**（见 §6 不做清单） |
| `package.json` / `tsconfig*.json` | **无人**（本轮冻结） | 只读（INV-C4） |
| `tests/snapshots/barrel-exports.json` | **无人**（本轮冻结） | 只读；**不许**跑 `npm run snapshot:barrel` 让它变绿（INV-C2） |
| `docs/REQUIREMENTS-freeze-C.md` | **本文件（t1 产出）** | 已写完，不再改（改它必须给新判据+命令，并在提交信息里写明） |
| `docs/NEXT-round-B.md` | **无人**（归档件） | 只读 |
| `dist/**`、`tests/.ts-out/**` | **无主人**（gitignore 的再生成产物） | 任何任务可重新生成；**不得入库**；结束前跑一次 `npm run build` 让 `dist/` 与 `src/` 一致 |

**串行顺序（DAG 的硬要求）**：

```
t1(本文件)
 ├─→ t2 A0-2 加固 ──┐
 ├─→ t3 A0-3 CSS  ──┼─→ t6 终局验证（读侧，零写入）─→ t8 集成收尾
 ├─→ t4 符号补齐 ───┤
 └─→ t5 计数对账 ───┘
 └─→ t7 双格式补审（无写入路径；只需 t1）──→ t8
```

- **串行理由 1**：`t3` 与 `t2` 都想要「扫描辅助函数」，本表把辅助函数**按文件切开**（`scan.ts` 归 t2、`styles.test.ts` 本地实现归 t3），因此两者可并行。
- **串行理由 2**：`t5`（计数对账）必须**晚于** `t2/t3/t4`，因为 `assertions: N` 是全局计数 —— 这就是 t5 的 deps 含 t2/t3/t4 的原因；否则 README 的数字必然过期。
- **串行理由 3**：`t6`（终局验证）晚于全部写入任务；`t7` 会**重建 `dist/`**，而 `t6` 也会跑构建 —— `dist/` 是同一份工作区资源，两者**不得并行**。安排：**t7 先跑完（并复原 `dist/`），t6 再跑**（t6 的 deps 含 t7）。
- **串行理由 4**：`t8`（集成收尾）晚于 `t6` 与 `t7`，负责最后一遍「工作区干净 + 全绿」。

**F5（硬编码仓库根）的处理**：`tests/ui-kit.test.tsx:189 / 196 / 202 / 227 / 242 / 243` 用
`path.resolve(__dirname, "../../../src/…")` 读源码，**不认 `DEERUI_LIB_ROOT`**，导致「在没有副作用副本里做负例」这条路对该文件不通。
归属给**符号工程师**（他本来就要改这个文件，且不与他人重叠），要求：改成 `path.join(libRoot(), "src", …)`（`libRoot()` 已支持 `DEERUI_LIB_ROOT` 覆盖），
**断言名与断言语义一字不改**，改完 `npm test` 全绿；并在提交信息里写明「这是判据可移植性修复，不是判据弱化」。
`tests/ui-hooks.test.tsx` 与 `tests/a0-*.test.ts` 已在用 `libRoot()`（实测复核：全仓库只剩 `ui-kit.test.tsx` 有硬编码 `../../../src`）。

---

## 6. 本轮明确**不做**的事（连同理由，避免下一轮重新发现）

| # | 不做的事 | 理由（客观） |
|---|---|---|
| **N-1** | **A0-3 的其余绕过写法（5 种）** | 本轮只做 W4 的三种 + 两种「已有判据能兜住」的变体。**明确不做的 5 种**：<br>(i) **CSS 里用 `env(safe-area-inset-*)` 直接写进声明**（绕过 `--sa*` 变量）：判据只认四个 `--sa*` 变量，`env()` 直写需要「规则与安全区的关系」的语义分析，本仓库没有 CSS 求值器；<br>(ii) **`@import` 外链或第二份样式文件**：`src/styles/` 下新增 `.css` 会被既有 `kit.styles.builder-covers-sources` 抓住（它会红），但「通过 `@import` 把判定规则藏在别处」需要跨文件 CSS 图解析 —— 不做；<br>(iii) **内联 `style={{ "--sat": "1px" }}` 的 CSS-in-JS 变体**：A0-3 扫的是 `src/**/*.ts(x)` 的字符串字面量与 `setProperty`，`style` 对象里的键会被 `stringLiterals` 看到（**现状已能抓**，见 `kit.pcmode.selfcheck.13` 的合成样本），但 `--sa*` 在 `src/styles/*.css` 与 TS 两条路上的**统一口径**不合并成一条判据 —— 不做合并（会动 `scan.ts` 的语义边界）；<br>(iv) **`@supports` / `@layer` / 容器查询里的同类判定**：本轮把白名单设成「`@media` 必须为零」，`@supports` 等**不受管**；要做需要一张完整的 at-rule 白名单 + 每种语法的解析，属判据重写；<br>(v) **`tokens.css` 里再开第三个主题块**（如 `[data-theme="dark"]`）：既有 `kit.styles.tokens-both-themes` 只数 `:root{` 与 `[data-theme="light"]{` 各一次，第三个块**看不到** —— 本轮不扩展它（改它就是改范围 A 已冻结的判据口径）。 |
| **N-2** | **`check:dist` 的「私有模块图完整性」** | 不做的具体形态：**没有被进包文件 import 到的 `dist/**` 模块**（`exports` 之外的可达性）、**循环依赖**、**tree-shaking 友好性**、**每个 `dist/**/*.js` 是否都能被原生加载**（现在的冒烟只走 4 个公开入口）。要做需要「从 `exports` 出发的模块图遍历 + 逐文件 `import()`」，属**新判据**，而且 `check-dist.mjs` 归 `scripts/**`（本轮冻结）。 |
| **N-3** | **134 闸门对「filler 断言」的抵抗** | 预算闸门钉的是**条数**（`MIN_TOTAL=134` / `MIN_CONTRACT=62` / `MIN_INFRA=72`），而范围 A 已实测过作弊路径：「删 5 条真断言 + 插 5 条 `ui.filler`」能让三个数字原值维持。**不做的理由**：一个能抵抗 filler 的闸门需要「断言 → 判据语义」的映射（例如断言名白名单、或每条断言必须关联一个被改坏会红的差分），这**没有通用解**；本轮的替代做法是**流程判据**：与 143 基线名单做 `REMOVED = ∅` 的逐符号 diff（INV-C5），并由 `t6` 复核。**登记**：真正把闸门升级成「语义闸门」是新判据级工作，属下一轮。 |
| **N-4** | **lint / format 工具链** | 本仓库**没有 `npm run lint`**（`package.json.scripts` 只有 `typecheck` / `build` / `test` / `test:build` / `snapshot:barrel` / `check:dist` / `pack:vendor` / `link:devdeps` / `prepare` / `prepack`），也没有任何 ESLint / Prettier 配置。范围 A §F-1 已明文排除：引入会带来新依赖 + 大面积格式化 diff（改范围）。**硬约束（照抄进每一份任务书）**：任何 `verify` / `acceptance` / `inScope` 里**不得出现 `npm run lint`**，也不得为了让某条 verify 变绿去**造一个恒真的 lint script**（范围 B 有两条任务因此只能落 failed，那两次失败是**有效的验收证据**，不要重演）。 |
| **N-5** | **发 npm / 改包名 / 改子路径** | `package.json` 是 `private: true`；裸名 `deer-ui` 在 npm 已被他人占用（README「发布面」）；改包名会让 `import … from "deer-ui/kit"` 全线失效并与「公开导出面冻结」直接冲突（INV-C2）。本轮**不碰** `package.json`。 |
| **N-6** | **`Dialog` 焦点陷阱 / portal / 关闭后归还焦点 / `TipHost` 的 `aria-live`** | README「已知缺口」自认的**有意取舍**；做了会改 DOM 层级 = 破坏 INV-C1。范围 A §0 表第 3 行、§3.1 BUG-12 已驳回。 |
| **N-7** | **BUG-3 之外的存疑项：BUG-4、BUG-8，以及范围 A §3.1 的全部「驳回」项（BUG-7/9/10/11/12/13）** | BUG-4 / BUG-8 的裁定与理由见 §4；驳回项不动（`reStar` 之外的判据强度问题属 N-3 一类）。**BUG-5 例外**：其实现已由范围 B 的 BUG-3 修复固化，本轮**只补判据**（§4）。 |
| **N-8** | **SSR / 真机三端「已核」结论** | 本机无 Android 设备、无 Next.js 冒烟工程；`renderToStaticMarkup` **不执行 effects**。只许静态守（README 已有口径），不得写「已核」。 |
| **N-9** | **令牌收敛（143 定义 → 34 引用）、改 `src/styles/*.css` 内容** | README 明说这是一次**有意的**改动，要重跑令牌断言；属不同批次。且改内容会破 INV-C3（17,790 B / 92 规则）。 |
| **N-10** | **给 `examples/demo.tsx` 补 sprite / 跑起 devserver；给仓库加宿主侧 CSS 多重集合等价判据** | devserver 与 sprite 符号集都是**宿主资源**（不在本仓库）；宿主侧 CSS 等价属应用仓库判据。 |
| **N-11** | **`scripts/**` 的任何改动（含给 `check-dist.mjs` 补判据）** | 本轮冻结 `scripts/**`（见 §5 归属表）。审计（W7）只**评估** `check-dist` 是否真的会红，**不修它**；发现漏洞写进审计报告 → 由 `symbols-engineer` 转写进 README「已知缺口」。 |

---

## 7. 验收判据（本轮 PASS/FAIL）

本轮 PASS 当且仅当：

1. **W1…W8 每条的客观判定都被满足**，且 §6 的「不做」清单一条都没被越过。
2. **INV-C1…INV-C8 全部成立**（尤其：快照一字不动、`dist/styles.css` 17,790 B / 92 规则、`assertions: N ≥ 143`、`REMOVED = ∅`、三道下限数值未变）。
3. **每条新增判据都不是恒真**：至少 5 条差分（§W8 ⑤）有「改坏 → 红 → 还原 → 绿」的实测记录。
4. **文档三处一致**：`npm test` 的 `assertions:` / `README.md` / `CHANGELOG.md`（+ `budget.test.ts` 注释）的数字相同。
5. `git status --porcelain` 为空；`npm run check:dist` OK；`npm test` 末两行为 `assertions: N` / `ALL PASS`。

**FAIL 的典型信号**（任一出现即本轮未过）：
`assertions:` < 143；任何既有断言消失或改名；`tests/snapshots/barrel-exports.json` 被改动；
`styles.css` 字节数或规则数变化；`package.json` 出现依赖变更；三道预算下限被上调；
某条新增断言在「改坏源码」后仍然绿（恒真填充）；`npm run snapshot:barrel` 被用来让某条判据变绿；
`git status` 里出现夹具文件或未还原的临时改动。

---

## 8. 唯一验证命令集（V-C1 … V-C5）

从库根执行，按序：

```sh
# V-C1 类型检查（src strict + 示范页）
npm run typecheck

# V-C2 库测试（末两行须为 assertions: N / ALL PASS，N >= 143）
npm test

# V-C3 构建 + 产物自检（styles.css 须打印 17790 B / 92 条规则；check:dist 须 OK / 39 个产物文件）
npm run build && npm run check:dist

# V-C4 不变量（快照一字不动 + 三道下限未变 + 工作区干净）
git diff --exit-code -- tests/snapshots/barrel-exports.json
git diff -- tests/budget.test.ts        # 目视：MIN_CONTRACT / MIN_INFRA / MIN_TOTAL 数值未变
git status --porcelain                  # 须为空

# V-C5 原生双格式（消费者路径，不写任何文件）
node -e "console.log(Object.keys(require('deer-ui')).length)"      # → 30
node --input-type=module -e "import('deer-ui').then(m=>console.log(Object.keys(m).length))"   # → 30
```

> **禁止出现在任何 `verify` / `acceptance` 里的命令**：`npm run lint`（本仓库**没有**这个 script，且 lint 工具链属 §6 N-4 明确排除）、
> `npm run snapshot:barrel`（用它让判据变绿 = 掩盖导出面变化）、`npm publish`、任何 `npm install` 新包。
>
> **契约不可修订的硬约束（照抄进每一份任务书）**：任务的 `acceptance` / `verify` / `inScope`
> **创建后不可修订**（`agent_teams_edit_plan` 不提供这些字段），且**全局** inScope 冲突校验会让「范围与任何现存任务相交」的任务
> **永远无法再编辑**。所以：**每个路径只有一个主人**（§5），**写任务书时必须一次写对**，不要指望事后 `edit_plan` 校正。

---

## 9. 给 `symbols-engineer` 的编辑清单（我不写 README / CHANGELOG）

> 我不拥有 `README.md` / `CHANGELOG.md`（见 §5 归属表）。以下是需要**他**去改的**具体表述**；
> 每一条都必须在**判据先变绿之后**才改（顺序：实现 → 判据绿 → 文档），否则就是写没验过的话。

### 9.1 `README.md`「已知缺口」节

| 现有表述 | 要改成 |
|---|---|
| 「公开组件零直接断言的不止两个：实测是 **12 个** —— `Keep` · `TipHost` · …」 | 删掉「12 个零直接断言」这条缺口，改成**已完成**的记账：12 个符号各自的最直接断言名清单（逐个列出），并注明覆盖到哪一步（例：`Keep` = 入口态 + 退场态；`useBlankTap` = 纯状态机三态；`useKitPcMode` = SSR 快照值）。**不要把 `Overlay` / `DropMenu` 再算进去**。 |
| 「公开导出面判据对类型级再导出不可见：`tests/scan.ts` 的 `reStar` 只匹配裸 `export * from`…**A0-2 也是三条 A0 判据里唯一没有自检段的**」 | 改成**已修复**：`barrelSurface` 现在识别 `export type * from` / `export type * as ns from`；A0-2 有自检段（条数写明）；引用的补丁草稿链接改为「已落地」。 |
| 「三条判据里 **A0-1 与 A0-3 带自检段**」 | 改成「**三条都有自检段**」，并补一句 A0-3 的自检现在**同时覆盖 CSS**（`src/styles/*.css` 的暗色媒体查询 / 安全区赋值注入会被抓）。 |
| 「样式归属判据比它读起来弱」（`kit.styles.kit-classes-owned` 只证明字符串字面量有过 class） | **保留**（仍是事实），但补一句：本轮新增的三条 `kit.host.css-*` 判据管的是**CSS 侧**的判定性写法，与「class 是否漏写规则」是两回事。 |
| 「`tests/budget.test.ts:24` 的注释是一处过期数字：写「新增 7 条（2+2+4）」，实测是 **+9**」 | 改成**已订正**（写明现值 `assertions: N` 与构成 `ui.*` / `kit.*+lib.*`）。 |
| 「A0-2 … 修法与已验证的补丁草稿见 `docs/NEXT-round-B.md` §1」 | 改为指向本文件（`docs/REQUIREMENTS-freeze-C.md`）+ 写明已落地。 |
| 5 号「混用两种模块格式会让单例分裂」 | **保留**；若 `dual-format-auditor` 给出了「本仓库可否机检」的结论，按结论补一句（有断言就写断言名，没有就写清为什么不可机检）。 |
| 其余缺口（令牌超集 / 无障碍一半 / 三端只静态守 / React 只测 18.3.1 / 预算闸门钉条数 / A0-1 `escape` 依赖目标存在 / 示范页跑不起来 / lint 缺失） | **一条都不许删**；如与实测不符才改，且必须给出对账命令。 |

### 9.2 `README.md` 其它处

- 「开发与调试」里的 `assertions: 143` → 本轮实测值。
- 「断言台账与预算闸门」表的三行现值（`ui.*` / `kit.*+lib.*` / 合计）→ 本轮实测值；**预算下限三列保持 `62` / `72` / `134` 不变**（并保留那句「下限不跟着现值涨」的解释）。
- 「这个版本验证到了哪一步」表里 `npm run build` 的 `dist/` **39 个文件**、`styles.css` **17,790 B / 92 条规则**、原生加载四行 → 重跑 V-C3/V-C5 后照抄实测值。
- 「三条 A0 机器判据」表 → 补上 A0-2 的新断言名（`kit.barrel.root-union`、`kit.barrel.selfcheck.*`）与 A0-3 的 CSS 断言名（`kit.host.css-*`）。
- 目录结构段里的 `tests/` 描述 → 把「A0 三条判据（A0-1/A0-3 带自检段）」改成「三条都带自检段（A0-3 同时覆盖 CSS）」。

### 9.3 `CHANGELOG.md`

- 新增范围 C 条目：A0-2 类型级可见性 + 根并集判据 + A0-2 自检段；A0-3 CSS 可见性；12 个零断言符号补齐（列名字）；BUG-5 判据补齐；双格式产物**补审**（写明是补审已提交产物、结论是什么）。
- `assertions: N` → 本轮实测值；`REMOVED = ∅` 与「三道下限未动」写进同一条目。
- **本轮仍不发版**：`version` 保持 `0.1.0`、`private: true`（INV-C4）。

---

## 10. 冻结声明

- 本文件是**范围 C 的需求与验收口径**，不是实现方案；实现只许照 §2 的判定方式与 §1 的不变量来，**不得绕过命令**。
- §4 的三条裁定（**BUG-4 不做** / **BUG-5 只补判据** / **BUG-8 不做**）**已冻结**：不得把「不做」当「存疑」顺手改，也不得把「已固化」当「还在」去重做。
- §5 的文件归属表**已冻结**：任何新增任务若与表中某路径相交，必须**先改本表**（并给出串行顺序或改归属），否则该任务无法创建/编辑。
- §6 的「不做」清单是**明确的范围边界**：发现它们不等于本轮要做它们。
- 要改本文件任何一条，必须同时给出新的**客观判定方式**与**命令**，并在提交信息里写明理由。

---

## 附录 A：143 条基线断言名单（`REMOVED = ∅` 的比对基准）

`REMOVED = ∅` 的判法：本轮结束时的断言输出里，下列每一个名字都必须**原样出现**（新增的断言名不在名单里，属正常增长）。

**`ui.*`（71 条）**：
`ui.btn` · `ui.chips.guide` · `ui.chips.hidden` · `ui.chips.off-count` · `ui.chips.on` · `ui.chips.wrapper` ·
`ui.colorfield` · `ui.colorfield.row` · `ui.dialog.aria-label` · `ui.dialog.body-class` · `ui.dialog.classes` ·
`ui.dialog.close` · `ui.dialog.foot` · `ui.dialog.guide` · `ui.dialog.headerless-close` · `ui.dialog.head-span` ·
`ui.dialog.mask` · `ui.dialog.no-close` · `ui.dialog.no-footer` · `ui.dialog.order` · `ui.dialog.role` ·
`ui.dropmenu.fixed-pos` · `ui.dropmenu.layout-effect-deps` · `ui.dropmenu.portal` · `ui.hooks.arm-registers` ·
`ui.hooks.arm-wired` · `ui.hooks.drag-handler-live` · `ui.hooks.recorder-restored` · `ui.htip.btn-wired` ·
`ui.htip.desc` · `ui.htip.disabled-flag` · `ui.htip.enabled-flag` · `ui.htip.markup` · `ui.htip.mouse-not-longpress` ·
`ui.htip.no-desc` · `ui.htip.pos.default` · `ui.htip.pos.flip-x` · `ui.htip.pos.flip-y` · `ui.htip.pos.inside` ·
`ui.htip.pos.oversize` · `ui.htip.title` · `ui.icon` · `ui.kit.export.Btn` · `ui.kit.export.ChipGroup` ·
`ui.kit.export.ColorField` · `ui.kit.export.Dialog` · `ui.kit.export.Icon` · `ui.kit.export.NumberField` ·
`ui.kit.export.Row` · `ui.kit.export.ScrubNum` · `ui.kit.export.Segmented` · `ui.kit.export.Switch` ·
`ui.kit.purity` · `ui.kit.sources` · `ui.numberfield` · `ui.overlay-full` · `ui.row.className` · `ui.row.hint` ·
`ui.row.label` · `ui.row.no-label` · `ui.row.order` · `ui.rowactions` · `ui.scrubnum.bounds-live` ·
`ui.scrubnum.bounds-ref` · `ui.scrubnum.drag-live-bounds` · `ui.scrubnum.unmount-cleanup` · `ui.segmented` ·
`ui.segmented.labels` · `ui.switch.label` · `ui.switch.off` · `ui.switch.on`

**`kit.*` + `lib.*`（72 条）**：
`kit.barrel.css-entry` · `kit.barrel.entries` · `kit.barrel.entry_` · `kit.barrel.entry__kit` · `kit.barrel.entry__tabs` ·
`kit.barrel.entry__tooltip` · `kit.barrel.entry-sources` · `kit.barrel.reexport-only` · `kit.barrel.snapshot-file` ·
`kit.barrel.surface` · `kit.examples.exists` · `kit.examples.not-packed` · `kit.examples.outside-src` ·
`kit.examples.would-be-caught` · `kit.host.no-storage` · `kit.pcmode.pushed-not-detected` · `kit.pcmode.root-exists` ·
`kit.pcmode.selfcheck.0` … `kit.pcmode.selfcheck.17`（18 条） · `kit.pcmode.sources-scanned` · `kit.purity.offenders` ·
`kit.purity.root-exists` · `kit.purity.selfcheck.0.react` · `kit.purity.selfcheck.1.react_jsx_runtime` ·
`kit.purity.selfcheck.2.react_dom_server` · `kit.purity.selfcheck.3.react_dom_client` · `kit.purity.selfcheck.4.lodash` ·
`kit.purity.selfcheck.5._deerluu_x` · `kit.purity.selfcheck.6.___tooltip` · `kit.purity.selfcheck.7.__Dialog` ·
`kit.purity.selfcheck.8.______engine_expr` · `kit.purity.selfcheck.9.__missing` · `kit.purity.sources-scanned` ·
`kit.safearea.host-owned` · `kit.styles.builder-covers-sources` · `kit.styles.demo-self-contained` ·
`kit.styles.exports-wired` · `kit.styles.kit-classes-owned` · `kit.styles.kit-exists` · `kit.styles.kit-key-rules` ·
`kit.styles.no-external-url` · `kit.styles.tokens-both-themes` · `kit.styles.tokens-exists` · `kit.styles.tokens-keys` ·
`kit.theme.host-owned` · `lib.budget.assertions` · `lib.runner.dom-stub.document` · `lib.runner.dom-stub.matchmedia` ·
`lib.runner.dom-stub.rect` · `lib.runner.dom-stub.restored` · `lib.runner.dom-stub.window` ·
`lib.runner.gitignore-has-dist` · `lib.runner.lib-root` · `lib.runner.license-matches-file` · `lib.runner.package-name` ·
`lib.runner.src-dir`

> 该名单由本轮只读命令 `npm test` 的实际输出整理（`ok` 行逐条抄录），可以在任何时刻用
> `npm test | Select-String "^ok  (ui|kit|lib)\."`（或 `grep`）重生成对照。

## 附录 B：本轮新增判据的预期清单（供 t6 核对「是否都真的存在」）

| 来源 | 建议断言名 | 条数（预期） |
|---|---|---|
| W1 + W2（A0-2 类型级 + 自检） | `kit.barrel.type-star-visible` · `kit.barrel.type-star-ns-visible` · `kit.barrel.selfcheck.<i>` | 2 + 8 = 10 |
| W3（根并集） | `kit.barrel.root-union` `（+ 1 条并集自检 `kit.barrel.union-selfcheck`）` | 2 |
| W4（A0-3 CSS 可见性） | `kit.host.css-no-color-scheme` · `kit.host.css-safearea-decls` · `kit.host.css-media-allowlist` · `kit.host.css-no-data-theme` + 自检 6 条 | 4 + 6 = 10 |
| W5（12 符号） | `ui.keep.*` · `ui.tiphost.*` · `ui.blanktap.*` · `ui.landscape.*` · `ui.tabbar.*` · `ui.tooltip.show*` · `ui.tooltip.hide*` · `ui.tooltip.subscribe*` · `ui.pcmode.set*` · `ui.pcmode.on*` · `ui.pcmode.hook*` · `ui.hovertips.enabled*` | 12~24 |
| BUG-5 判据（§4） | `ui.hooks.arm-timer-cleared` | 1 |
| **合计预期** | | **约 35 ~ 47 条 ⇒ `assertions:` 约 178 ~ 190** |

> 上表是**预期**，不是验收判据：验收只看「W1…W8 的客观判定是否成立」与「INV-C1…INV-C8」。
> 若实现给出的条数明显低于区间下限，`t6` 必须逐项核对「是不是有符号被跳过了」，而不是接受一个总数。
