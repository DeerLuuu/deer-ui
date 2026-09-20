# 范围 C 收尾记录（t7 产出）

> 本文件是**范围 C 的终局收尾记录**，不是需求文档：需求与验收口径在
> [`docs/REQUIREMENTS-freeze-C.md`](REQUIREMENTS-freeze-C.md)（冻结件，本轮不改）。
> 范围 A/B 的口径在 [`docs/REQUIREMENTS-freeze.md`](REQUIREMENTS-freeze.md)，
> 范围 B 的未完成项清单在 [`docs/NEXT-round-B.md`](NEXT-round-B.md)。
>
> **读法**：§1 做完了什么、§2 有意不做、§3 还剩什么（索引）、§4 证据等级（哪些只有一方证据）、
> §5 下一轮入口（可直接接手，含 F1/F2/F3 与 V1 的具体改法）、§6 本轮不变量核对。
>
> 所有数字都是**本轮（t7）干净状态下一次性跑出来的实测值**，命令见 §6.1 与每条括号里的出处。

---

## 1. 范围 C 实际完成项（逐条一行，带文件）

| # | 完成项 | 落地文件 | 判据 / 断言 | 谁验的 |
|---|---|---|---|---|
| C-1 | **A0-2 看见类型级再导出**：`reStar` 带 `(type\s+)?` 捕获，`export type * from` / `export type * as ns from` 分别并入类型集合 | `tests/scan.ts` | 合成夹具差分（HEAD 版返回空面 → 修复版 `types:["Api"]`） | t3 实现，**t5 独立复现**（同一反例在 HEAD 树 143 ALL PASS、修复树 3 FAIL） |
| C-2 | **A0-1 说明符收集补齐**：`export type { A } from "…"` 也进依赖图判定 | `tests/scan.ts` / `tests/a0-purity.test.ts` | 自检 5 条 | t3 实现，t5 间接覆盖（REMOVED=∅ 逐名 diff） |
| C-3 | **A0-2 自检段**（此前是三条 A0 判据里唯一没有的） | `tests/a0-barrel.test.ts` | `kit.barrel.selfcheck.*`（夹具在 `os.tmpdir()`，`finally` 删除并还原 `DEERUI_LIB_ROOT`） | t3 实现，**t5 反证**：退回 HEAD 版 `reStar` → 恰好 `selfcheck.0/1` 红 |
| C-4 | **根入口并集判据**：在**内存里**比较「根面」与「全部 JS 入口（含根自己）的并集」，不读快照、不写文件 | `tests/a0-barrel.test.ts` | `kit.barrel.root-union` + `kit.barrel.root-union.nonvacuous`（并集全空会让上面那条恒真） | t3 实现，**t5 反例**：删 `export * from "./tooltip.js"` **且手工把快照同步成同形状**（纯作弊路径）后，唯一 FAIL 就是 `kit.barrel.root-union` |
| C-5 | **A0-3 覆盖 CSS**：同一套「不自判主题/安全区/PC」口径扩到 `src/styles/*.css` | `tests/a0-host-boundaries.test.ts` | `kit.host.css-no-color-scheme` / `css-safearea-decls` / `css-media-allowlist` / `css-no-data-theme` + 自检 | t3 实现，**t5 注入负例**：`@media (prefers-color-scheme: dark)` / `--sat:1px` / `[data-theme="dark"]` 各自变红；**合法** `:root{--sat:env(…)}` 放过 |
| C-6 | **12 个零断言符号补齐**（见 §1.1） | `tests/ui-kit.test.tsx` + `tests/ui-hooks.test.tsx` | 新增 **46 条** `ui.*` | t4 实现，**t5 逐个改坏→红→改回**（12/12 命中），t4 另做 8 组差分 |
| C-7 | **BUG-5 判据落地**：计时器桩从「当场执行、返回 0」改成「返回不执行的 id + 记账」 | `tests/ui-hooks.test.tsx` | `ui.hooks.arm-deferred` / `arm-timer-pending` / `arm-timer-cleared` / `arm-timer-no-ghost` | t4 实现，**t5 反证**：退回旧桩 → 8 条红（新桩是这些断言的前提） |
| C-8 | **F5 判据可移植**：6 处硬编码 `__dirname/../../../src/…` → `srcDir()`（认 `DEERUI_LIB_ROOT`） | `tests/ui-kit.test.tsx` | 副本负例：完整副本 + `DEERUI_LIB_ROOT` 指向副本 → 222 ALL PASS；只改副本的 `primitives.tsx` → 恰好 `ui.overlay-full` 红 | t4 实现（t5 亦在逐字节副本里做过同样的事） |
| C-9 | **双格式产物独立补审**（上一轮改造没走过质量门） | 无写入路径；结论见 t2 报告 | require/import × 4 入口 = 30/25/2/3，且与快照**逐元素相等**；React 单实例成立 | **t2 独立审计**（副本里做 3 个破坏性负例） |
| C-10 | **计数与文档对账** | `README.md` / `CHANGELOG.md` / 本文件 | 现值 **222 = ui.\* 117 + kit.\*+lib.\* 105**；三道下限 62/72/134 **一处未动** | t7（本次）；t5 已独立确认 `REMOVED=∅`、`ADDED=79`（ui 46 + kit/lib 33） |
| C-11 | **终局验证** | 本文件 §6.1 | 四条命令 + 原生加载两条，退出码全 0 | t7 本次；t5 独立跑过同一组命令 |

### 1.1 12 个零断言符号 → 断言名（t4 交付，逐个差分过）

`Keep`(6) `ui.keep.entrance` / `exit-keeps-subtree` / `exit-out-class` / `exit-timer-scheduled` / `exit-unmounts-after-ms` / `exit-timer-cleared`
`TipHost`(3) `ui.tiphost.empty-without-tip` / `renders-after-showtip` / `unsubscribes-on-unmount`
`useBlankTap`(6) `ui.blanktap.tap-fires` / `slow-press` / `move-exceeds-tol` / `child-target` / `tol-boundary-inclusive` / `up-without-down`
`useLandscape`(3) `ui.landscape.ssr-false` / `matchmedia-true` / `ssr-effect-guard`
`TabBar`(5) `ui.tabbar.structure` / `selected` / `badge` / `guide` / `right`
`showTip`+`hideTip`+`subscribeTip`(8) `ui.tooltip.subscribe-immediate` / `show-emits-current` / `hide-emits-null` / `hide-idempotent-no-emit` / `autohide-schedules` / `show-cancels-autohide` / `autohide-emits-null` / `unsubscribe-stops`
`setKitPcMode`+`kitPcOn`+`useKitPcMode`(7) `ui.pcmode.kitpcon-default` / `set-on` / `set-off` / `notifies-subscribers` / `idempotent-no-extra-notify` / `hook-snapshot` / `hook-follows-store`
`useHoverTipsEnabled`(2) `ui.hovertips.hook-follows-setter` / `hook-restored`

合计 40 条直接钉符号；另 6 条是范围 C 配套（BUG-5 的 4 条 + `ui.hooks.leak-check`、`ui.pcmode.state-restored` 两条还原哨兵）= **46**。

> `Overlay`（`ui.overlay-full`）与 `DropMenu`（3 条 `ui.dropmenu.*`）在范围 B 修 BUG-1 时已补断言，
> **不在**这 12 个里，也没有被重复计算。

---

## 2. 范围 C 有意不做（延期项：理由 + 下一轮入口）

| # | 延期项 | 为什么不在这轮 | 下一轮入口 |
|---|---|---|---|
| D-1 | **F1：CJS 的 TypeScript 消费者拿不到类型** | `exports` 按格式分流 `types` + 新增 `.d.cts` 要改 `package.json` 与产物布局，属新判据级改动；且它被 `check-dist` 的「`types` 必须排第一」判据（F3）**正面挡住** | §5.1（含单变量实验结论）；**必须与 F3 一起做** |
| D-2 | **F3：`check-dist` 的 `types` 首位判据与 F1 修法互斥，且遇嵌套对象会 `TypeError`** | `scripts/**` 本轮冻结（冻结口径 N-11） | §5.2；与 D-1 同一提交 |
| D-3 | **BUG-4（滚轮累加器跨手势残值）** | 因果链存在但属设计取舍；无「手势边界」信号可机检；改它动的是滚轮手感 | 冻结口径 §4 已写明：将来引入 `onWheel` 去抖（约 150ms 归零）时，必须同时给「纯函数 + 假计时器」级断言 |
| D-4 | **BUG-8（`DropMenu` 与 `Dialog` 的 Esc 抢占）** | 取决于调用方挂载顺序；改任一侧都撞 INV-C1/INV-C2，本仓库无真实挂载运行时可判 | 需在**宿主**里同开两个控件验证「Esc 只关最上层」；本仓库只登记 |
| D-5 | **`check-dist` 的私有模块图/循环依赖/逐文件可加载** | 冻结口径 N-2（`scripts/**` 冻结） | 从 `exports` 出发做模块图遍历 + 逐文件 `import()` |
| D-6 | **抗 filler 的语义闸门** | 需要「断言 → 判据语义」的映射，没有通用解 | 本轮替代做法：与 HEAD 名单逐符号 diff（`REMOVED=∅`），t5 已独立执行 |
| D-7 | **lint / format 工具链** | 冻结口径 N-4（新依赖 + 大面积格式化 diff） | 与 CHANGELOG「本轮登记但不实施」的 F-1 同一条 |
| D-8 | **令牌收敛（143 定义 → 34 引用）/ 改 `src/styles/*.css`** | 会破 INV-C3（17,790 B / 92 规则） | 单独一批，需重跑令牌断言 |
| D-9 | **正常 SSR / 真机三端复核** | `renderToStaticMarkup` 不执行 effects；无 Android 设备、无 Next.js 冒烟工程 | 不得写「已核」；三端目前只有静态判据 |

---

## 3. 已知缺口索引（读完这一段就知道该看哪儿）

| 位置 | 内容 |
|---|---|
| `README.md` →「已知缺口（别让它们消失）」 | **汇总索引的主表**（本轮已按实测更新：12 个符号那条改成已完成、A0-2 类型级可见性改成已修、预算注释那条改成已订正 + V1 更正） |
| `README.md` →「三条硬要求」第 2 条 | 双格式的**运行期可用**与**类型不可用（F1）**、以及 F2（自检式恒 false）的新口径 |
| `docs/NEXT-round-B.md` | 范围 B 的待办与「计划缺陷复盘」（历史件，§1/§2 的事项已由范围 C 关闭） |
| `docs/REQUIREMENTS-freeze.md` | 范围 A/B 的需求与不变量（**其数字是范围 A/B 生成时的基线**，现值见本文件与 README） |
| `docs/REQUIREMENTS-freeze-C.md` | 范围 C 的冻结口径与 143 条基线名单（**冻结件，本轮一字未改**） |
| 本文件 §5 | 下一轮入口：F1 / F3 / V1 的具体行号、改法与耦合关系 |

**仍然存在、且本轮明确保留的缺口**（不许删）：令牌超集、双包单例分裂、无障碍只做一半（无焦点陷阱 / `aria-live`）、
三端只静态守、React 只测 18.3.1、样式归属判据弱（`kit.styles.kit-classes-owned` 只证明字面量出现过）、
预算闸门钉条数不钉覆盖率、A0-1 `escape` 依赖目标文件真实存在、示范页跑不起来、lint 缺失。

---

## 4. 证据等级（本仓库的历史教训：没人复核的改动最容易带病）

| 结论 | 证据等级 |
|---|---|
| A0-2 类型级去盲 / 根并集 / A0-3 CSS：真会红、不是恒真填充、既有断言一条没删 | **两方独立**：t3 实现自证 + **t5 独立变异**（30 次有效，逐次 `restore byte-exact`）+ t4 8 组差分 |
| 12 个符号 46 条断言：每条改坏即红 | **两方独立**：t4 逐组差分 + **t5 逐个符号改坏→红→改回**（12/12） |
| BUG-5 的 `clearTimeout` 判据不是形状检查 | **两方独立**：t4（删 `src/kit/scrub.tsx:89` → 红）+ t5（退回旧桩 → 8 条红） |
| 双格式运行期可用（原生 require/import、同格式内单例共享、React 单实例） | **t2 独立审计**（副本破坏性负例，非实现者自证）+ t7 重跑 `check:dist` 与两条原生加载（同结论） |
| **F1**（CJS 的 TS 消费者拿不到类型：TS1479 / TS1471 / TS2307；ESM/bundler exit 0） | **两方独立**：t2 单变量实验 + **t7 本次独立复现**（同一组错误码，ESM/bundler 两次 exit 0） |
| **F2**（README 的双包自检式恒为 false） | t2 实测（纯 CJS 与纯 ESM 宿主各自为 false）—— 与本轮 F1 复现同一批实验，**未再单独复核**，但结论方向不可能相反（两棵树必然是两个实例） |
| **F3**（`check-dist` 的 `types` 首位判据 + 嵌套对象 `TypeError`） | t2 上报 + **t7 读代码确认**：`scripts/check-dist.mjs:83-85` 只判 `Object.keys(cond)[0] !== "types"`；`:87-88` 对每个条件值直接 `path.join(libRoot, target)`，**嵌套对象没有类型守卫** |
| **V1**（`tests/budget.test.ts` 的历史分解绝对值偏 3） | t5 单方实测（`693ef56` vs 父 `dc337a3`）；t7 未重跑该 diff（`tests/**` 不在本轮写权范围） |
| `kit.barrel.root-union` 的判别力 | **t5 反例**（连快照一起改的作弊路径下仍红）。它的写法是：在内存里比较根面与「全部 JS 入口（含根自己）的并集」，守「根不许漏掉子入口符号」；`*.nonvacuous` 另外防「并集全空导致断言恒真」。**不是缺陷，没有待裁定口径。** |
| t6（质量门）结论 | **本轮不存在**：t6 的 deps 含 t7，review 排在集成之后。所以「t6 的 findings」这一项**没有可登记的内容**；它的审查对象是 t3/t4 的产物，t5 已先行独立验证。 |

---

## 5. 下一轮入口（可直接接手）

### 5.1 F1 —— CJS 的 TypeScript 消费者拿不到类型（high，面向消费者）

- **实测**（t2 + t7 各自复现，同一组错误码）：
  - node16 + **CJS** 工程：`import { Dialog } from "deer-ui/kit"` → **TS1479**；`import kit = require("deer-ui/kit")` → **TS1471**；
  - **node10** 解析：**TS2307**（根 `package.json` 没有顶层 `types` / `main` 兜底）；
  - node16 的 **ESM** 工程 / **bundler** 工程：**exit 0**。
- **根因**（t2 单变量实验）：`exports` 的 `types` 条件**不区分模块格式**，四个入口命中的都是 ESM 树的 `./dist/*.d.ts`，
  而它被 `dist/package.json` 的 `"type": "module"` 判成 **ESM 声明**；`dist/cjs/` 里既没有 `.d.ts` 也没有 `.d.cts`。
- **修法（加法，不需要回滚双格式）**：给 `exports` 的每个 JS 子入口按格式分流 `types`
  （`{"types": {"import": "./dist/x.d.ts", "require": "./dist/cjs/x.d.cts"}, "import": …, "require": …}`），
  构建时把 CJS 一遍的声明也输出到 `dist/cjs/**/*.d.cts`；根 `package.json` 是否补顶层 `types` 兜底另议（node10 才有用）。
- **必须一起做**：F3（§5.2）。否则改完 `check-dist` 直接红 / 崩。
- **收尾条件**：四个入口 × {CJS node16, ESM node16, bundler, node10} 的消费者工程各跑一次 `tsc --noEmit`，
  退出码记进任务输出；`npm run check:dist` 仍 OK。

### 5.2 F3 —— `check-dist` 的 `types` 首位判据与 F1 互斥、且遇嵌套对象会崩（medium）

- **位置**：`scripts/check-dist.mjs:83-85`（`const keys = Object.keys(cond); if (keys[0] !== "types") …`）
  与 `:87-88`（`for (const [kind, target] of Object.entries(cond)) … path.join(libRoot, target)`）。
- **两个问题**：① 「`types` 必须排在 `keys[0]`」把 F1 唯一可行的**两级 `exports`** 形状定义成失败；
  ② `target` 没做「字符串」守卫，交给 `path.join` → 遇到对象直接 `TypeError`（不是"判据红"，是**脚本崩**）。
- **改法**：把 ① 放宽成「`types` 必须存在且其**位置**在 `import` / `require` 之前（允许它的值是对象）」，
  ② 递归/显式处理嵌套对象（`{import, require}` 各取字符串目标逐一 `existsSync`）。
- **为什么必须与 F1 同一提交**：F3 不放宽，F1 的修法就无法通过 `check:dist`；F1 不改，F3 的问题不会被触发——
  两者是一条链。改完必须补一条**负例**（构造一个 `types` 排在 `import` 之后的 `exports` → 必须红），否则
  就是「宽松化」而不是「修正」。

### 5.3 V1 —— `tests/budget.test.ts` 的历史分解注释（low，只登记）

- **位置**：`tests/budget.test.ts:24-27`（t3 本轮写入）。写法「`ui-kit` 53 → 56 = +3」的**绝对值整体偏 3**。
- **实测**（t5）：`693ef56` vs 父 `dc337a3` 的「控件 DOM 契约」段是 **62 → 65**；剔除其中 12 条 `ui.kit.*`
  才是 **50 → 53**。**增量 +3 与所列三个断言名（`ui.dropmenu.layout-effect-deps` / `ui.scrubnum.bounds-live` /
  `ui.scrubnum.bounds-ref`）都是对的。**
- **出处**：`docs/NEXT-round-B.md:127` 与 `docs/REQUIREMENTS-freeze-C.md:110`（t3 逐字照抄；两处都是「待办/口径草稿」语境）。
- **顺带**：该注释的现值停在 t3 落盘时的 `143 → 176`；范围 C 最终实测是 **222 = ui.\* 117 + kit.\*+lib.\* 105**。
- **为什么没顺手改**：`tests/**` 不在收尾任务的写权范围（且闸门的三道下限本身**一处未动**，错的只是注释分解）。
  下一轮：把该段改成「按段计数的正向说明 + 现值 222」，并在提交信息里写明这是**注释订正**。

### 5.4 其余 low（登记即可，不必单开任务）

| # | 项 | 说明 / 改法 |
|---|---|---|
| L-1 | CJS 树的相对 `require` 判据不承重、可绕 | t2：`require("./"+"primitives")` 这类拼接能全绿通过。判据只认字面量 `require("./x.js")`。改法：与 L-2 一起做「模块图级」判据（N-2 那条），或明确把它降级为「形状抽查」并在注释里写明 |
| L-2 | `check-dist` 有一条判据只比**名字集合** | 值面的比较用的是 `valueNames()`（排序后的名字集合，`check-dist.mjs:193-194`），不比对值与导出身份。所以「同名但不同实现」它能过；真正的双包危险（单例分裂）它抓不到（t2 已实证） |
| L-3 | node10 没有顶层 `types` 兜底 | 与 F1 同一批：要么补顶层 `types`（会与 `exports` 的 `types` 并存，需说明谁优先），要么在 README 明确「只支持 node16/bundler」 |
| L-4 | `docs/NEXT-round-B.md:132`（F8）写「12 个被跟踪文件工作区是 CRLF」 | **实测口径**：`git ls-files --eol` 统计 **`w/crlf` = 3**（`examples/demo.tsx`、`src/internal/expr.ts`、`src/internal/scrub.ts`），`w/lf = 51`（本机、本次检出）。t2 另记为 6、旧文写 12 —— **这个数随检出/平台变**，下一轮请写**命令**而不是固定数字。这些文件不进 tarball（`files` 只含 `dist` / `LICENSE` / `README.md`），打包可复现性不受影响 |

---

## 6. 本轮不变量核对（INV-C1…C8）

### 6.1 干净状态一次跑通（本文件所有数字的出处，本轮实测）

```sh
node scripts/tsc.mjs -p tests/tsconfig.json && node tests/.ts-out/tests/run-tests.js   # exit 0
#   → assertions: 222 / ALL PASS；[budget] 222 = ui.* 117 + kit.*+lib.* 105；下限 134 = 62 + 72

node scripts/tsc.mjs -p tsconfig.json --noEmit && node scripts/tsc.mjs -p tsconfig.examples.json  # exit 0, 0

node scripts/tsc.mjs -p tsconfig.build.json \
  && node scripts/tsc.mjs -p tsconfig.build.json --module commonjs --moduleResolution node10 --outDir dist/cjs --declaration false \
  && node scripts/build-styles.mjs && node scripts/check-dist.mjs                     # exit 0（四步全 0）
#   → dist/styles.css：17790 B / 92 条规则 / 326 行（tokens.css 7061 B + kit.css 10729 B）
#   → check-dist: OK（39 个产物文件）+ 原生加载 OK（deer-ui 30 / kit 25 / tabs 2 / tooltip 3；同入口 CJS/ESM 导出值一致）

node -e "console.log(Object.keys(require('deer-ui')).length)"                          # → 30
node --input-type=module -e "import('deer-ui').then(m=>console.log(Object.keys(m).length))"  # → 30
```

（`npm run build` / `npm run typecheck` / `npm run check:dist` 与上面逐条等价，见 `package.json`
的 scripts；`npm test` = 第一条。**本轮没有跑 `npm run lint`** —— 该 script 不存在，且属明确排除项。）

### 6.2 逐条

| 不变量 | 核对结果（本轮实测） |
|---|---|
| **INV-C1** DOM 契约不变 | `tests/ui-kit.test.tsx` 的既有 `ui.*` 断言**一条未删、一条未改名**（t5 与 HEAD 名单逐符号 diff：`REMOVED=∅`）；范围 C 只**增** 46 条 |
| **INV-C2** 公开导出面不变 | `git diff --exit-code -- tests/snapshots/barrel-exports.json` → 0；快照仍 `.` 30 值 + 9 类型 / `./kit` 25+6 / `./tabs` 2+2 / `./tooltip` 3+1（t5 另用 `git hash-object` 与 HEAD blob `735569dd…` 比对一致） |
| **INV-C3** 产物字节不变 | `dist/` = **39 个产物文件**、`dist/styles.css` = **17,790 B / 92 条规则 / 326 行**（本轮 `build` 实跑输出） |
| **INV-C4** 依赖面不变 | `package.json` 的 `dependencies` 仍为空、`devDependencies` / `peerDependencies` 未增；`kit.purity.offenders` 空 |
| **INV-C5** 断言只许涨 | `assertions: N` **N = 222 ≥ 143**；`REMOVED = ∅`；`ADDED = 79`（ui 46 + kit/lib 33，t5 独立 diff） |
| **INV-C6** 预算三道下限不动 | `tests/budget.test.ts` 的 `MIN_CONTRACT=62` / `MIN_INFRA=72` / `MIN_TOTAL=134` **数值未动**（t5 复核字面；`git diff` 只有注释与新增断言） |
| **INV-C7** 仓库不新增宿主依赖 / 不留临时文件 | `git status --porcelain` **空**（0 行）；`git diff --quiet` 退出 0；无 `*.tgz` / `dist/` / 夹具文件入版本控制（`dist/` 与 `tests/.ts-out/` 由 `.gitignore` 覆盖） |
| **INV-C8** 结束时仍干净且全绿 | 提交 `ab051d0` + `c088878` 之后重跑 V-C1..V-C5：全部 exit 0；`assertions: 222 / ALL PASS`；`dist/styles.css` 17,790 B / 92 规则 / 326 行；`check-dist` OK（39 产物）；原生 `require` 30 / `import` 30 |

> **上一版这两行写错了，此处更正（t6 质量门的 H1 finding）**：原版把 INV-C7 的判据偷换成
> 「porcelain 里没有 `*.tgz`/`dist/`/夹具文件」，并引用「本次任务回执」——而 `t7` 的 output 是空的
> （悬空引用）；「结束时仍干净」当时也与事实相反：**HEAD 仍是 `032698d`、本轮零提交、
> porcelain 13 行**（11 M + 2 ??）、`git diff --quiet` 退出 1。
> 即冻结口径的 PASS 判据当时**没有成立**，而收尾记录写成了成立——这是本轮唯一的 high，
> 且**不合格的是集成收尾这一步，`t3`/`t4` 的产物不受影响**（t6 独立复跑确认其实质全部成立）。
> 处置：由队长提交那 13 个文件（`ab051d0` tests + `c088878` docs），再重跑 V-C1..V-C5，
> 然后更正本表这两行。

### 6.3 本轮明确**没有**声明的事（诚实性纪律）

- **不声明「已验证支持 SSR」**：本仓库用 `renderToStaticMarkup`（不执行 effects），SSR 运行时路径在本仓库**不可机检**。
- **不声明三端「已核」**：无 Android 设备、无 Next.js 冒烟工程；只声明静态事实（`src/**` 里没有 `"use client"`）。
- **不声明「双包安全」**：CJS 与 ESM 各有一份 `tooltip` / `pcmode` 单例，混用会让长按提示**静默消失**（t2 已模块级实证）；
  库侧**没有**运行时检测（F2 那条自检式恒为 false，已从 README 删除）。
- **不声明 CJS 的 TypeScript 消费者可用**：见 F1（README「三条硬要求」第 2 条已改成如实表述）。
