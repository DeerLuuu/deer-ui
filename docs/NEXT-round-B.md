# 下一轮工作清单（范围 B：未完成项）

> 本文件是**待办**，不是本轮交付。范围 A（三个运行期 bug 修复 + 工程规范底座）已提交完成，
> 见 CHANGELOG 的 Unreleased 段与 `git log`。
>
> 范围 B 的四条任务（A0-2 判据加固、14 个零断言符号覆盖、双格式产物、终局验证）**本该在本轮做完**，
> 但被计划缺陷堵死，**一条都没落地**（双格式产物除外，见 §4 的状态）。原因见 §0，务必先读——
> 下一轮重建计划时要避开同样的坑。

---

## 0. 为什么范围 B 一条都没做成（计划缺陷复盘）

四条硬约束叠加，把任务图冻死了：

| 工具行为 | 后果 |
|---|---|
| 任务的 `inScope` / `acceptance` / `verify` **创建后不可修订**（`agent_teams_edit_plan` 不提供这些字段） | 契约一旦写错就永久错误 |
| **全局** inScope 冲突校验：对某任务的编辑，只要该任务的范围与**任何**现存任务相交就被拒 | 范围重叠的任务**永远无法再编辑**（包括改 deps 与 assignee） |
| 运行中的团队只允许 `update_task` 改「pending 且从未开始」的任务；`remove_task` / roster 编辑被拒 | 无法删除或重建被堵死的任务 |
| 失败（failed）的依赖会**硬阻塞**下游 claim（实测报错 `task t8 is blocked by unfinished dependencies: t7`） | 一条契约级失败会把整条链锁死 |

**具体错法**：我把共享路径（`README.md`、`tests/budget.test.ts`、`tests/run-tests.ts`、
`tests/common.ts`）**同时**写进了 `t8` 与 `t9` 两条任务的 inScope。`t8` 的范围 ⊃ `t9` 的范围，
于是 `t8` 从此不可编辑 → 它的 deps 改不掉 → 它永远停在依赖失败任务的状态。
而 `create_task` 同样跑全局校验，导致连「新建一条替代任务」都被拒（所有路径都已被占用）。

**另外两处同类错法**：把「`npm run lint` 退出码 0」写进了 `t5` 与 `t7` 的 verify/acceptance，
而冻结文档 §F-1 已明文排除 lint 工具链。两名成员都**正确拒绝**了「造一个恒真 lint 凑 exit 0」，
于是 `t5` 与 `t7` 只能落 failed。**好消息**：这两条失败都成了有效的验收证据，
没让任何假绿通过。

**下一轮必须遵守**：
1. 每个**路径只有一个主人**。共享文件（计数类：`tests/budget.test.ts`、`README.md`）尤其要先定归属。
2. **不要把已排除项写进任何 verify**。写任务书前先读冻结文档的「不做」清单。
3. 计划阶段就把 DAG 与 inScope 写全，不要指望事后用 `edit_plan` 校正。

---

## 1. A0-2 导出面判据加固（**未落地**，已有验证过的补丁草稿）

### 1.1 缺口（t2 已用可复现反例证明）

`tests/scan.ts:231` 的 `reStar` 只匹配裸 `export * from "…"`：

```ts
const reStar = /export\s+\*\s*(?:as\s+([A-Za-z_$][\w$]*)\s+)?from\s*["']([^"']+)["']/g;
```

`export type * from "./secret"` 因 `\*\s*` 落在 `type` 之后而失配，`exec` 停在开头 →
**当前实现对 `export type *` 完全返回空面**。后果：给 `src/kit/index.ts` 加一行
`export type * from "./secret"`，`134/ALL PASS`、快照不变，而消费者却能
`import type { SecretApi } from "deer-ui/kit"` 成功。**这是「公开导出面冻结」的唯一判据被绕过。**

### 1.2 补丁草稿（implementer-bugs 提供，已用夹具实测过三条行为，**尚未落盘**）

```ts
const reStar = /export\s+(type\s+)?\*\s*(?:as\s+([A-Za-z_$][\w$]*)\s+)?from\s*["']([^"']+)["']/g;
// 循环内：
const isType = Boolean(m[1]);
if (m[2]) { (isType ? types : values).add(m[2]); continue; }   // export [type] * as ns
const target = resolveSpec(entryAbs, m[3]);
if (!target) continue;
const sub = barrelSurface(target, seen, depth + 1);
if (!isType) for (const v of sub.values) values.add(v);        // type * 不引入值
for (const t of sub.types) types.add(t);
```

夹具实测的三条不变式（**别改坏**）：
- `export type * from "./secret"`（secret 导出 `type SecretApi` + `const secretValue`）
  → 现在 `{"values":[],"types":[]}`（完全漏掉）；修复后应为 `values:[]`、`types:["SecretApi"]`。
- `export * from "./secret"` → `{"values":["secretValue"],"types":[]}`（现状正确；注意值星号
  本来就不引入类型）。
- `export * as ns from "./secret"` → 现状已 `values:["ns"]`（本来就对，别回归）。

### 1.3 A0-2 缺自检段（三条判据里唯一没有的）

`tests/a0-barrel.test.ts` 无任何合成样本自检，而 A0-1 / A0-3 都有。要补两类样本，
用 `DEERUI_LIB_ROOT` 指到仓库外的夹具目录（`finally` 清理，不污染仓库）：
- **该抓的抓住**：`export type * from "./x"` → `types:["Api"]`；`export * as ns from "./x"` → `values:["ns"]`。
- **该放过的放过**：仅本地声明 `export type Local = 1` → `{values:[],types:["Local"]}`；
  动态 `import("./x")` → `{values:[],types:[]}`（`barrelSurface` 只认静态 re-export）。
- 顺手钉住别改坏裸 `export *`：`export * from "./x"` → `values:["v"]`。

补完后，README 里「三条 A0 判据都有自检段」这句才能从「已改成真话（只有 A0-1/A0-3）」
恢复为「三条都有」——**修完再改文档，不要反过来**。

### 1.4 根入口并集无判据

删掉 `src/index.ts` 的 `export * from "./tooltip"` 再跑 `npm run snapshot:barrel` → 全绿，
而公开面悄悄少 4 个符号。要加一条断言（建议名 `kit.barrel.root-union`）：从 `package.json.exports`
取所有 `.js` 入口目标 → 各自 `barrelSurface` → 求并集；断言 `barrelSurface("src/index.ts")`
的值集与类型集与该并集**逐项相等**。**不得**靠重跑快照让它变绿。
（已只读验算：当前并集 = 根，值 30/30、类型 9/9 相等，所以这条今天就是绿的。）

---

## 2. 14 个零断言符号的直接覆盖（**未落地**）

README 原文只承认 `Keep` / `useBlankTap` 两个符号零断言；t2 在其时点实测是 **14 个**。
**注意（2026-09-20 复核修正）**：t3 修 BUG-1 时已给其中两个补上断言
（`Overlay` → `ui.overlay-full`；`DropMenu` → 3 条 `ui.dropmenu.*`，含新增的
`ui.dropmenu.layout-effect-deps`），所以**当前实际零断言的是 12 个**：

```
Keep · TipHost · useBlankTap · useLandscape · TabBar
showTip · hideTip · subscribeTip · setKitPcMode · kitPcOn · useKitPcMode · useHoverTipsEnabled
```

**两类打法**（t3 在 `tests/ui-hooks.test.tsx` 里已证明可行，可参照）：
- 纯状态机/模块级：`showTip` / `hideTip` / `subscribeTip`、`setKitPcMode` / `kitPcOn` /
  `useKitPcMode` / `useHoverTipsEnabled` —— 直接调用断言状态转换，无需 DOM。
- 渲染类：`Keep` / `Overlay` / `TipHost` / `TabBar` / `DropMenu` / `useBlankTap` / `useLandscape`
  —— `renderToStaticMarkup` 断 DOM 契约，能用 `tests/dom-stub.ts` 断行为就断
  （`Keep` 的延迟卸载与 `.out` 标记、`useBlankTap` 的距离/时长门限、`Overlay` 的 `panel-full`）。

**纪律**：不许写恒真填充断言（每条必须能「改坏源码即变红」，至少抽查 2 条给出证据）；
不许为凑数字加断言。预算闸门钉的是**条数**，而 t2 已证明「删 5 条真断言 + 插 5 条 `ui.filler`」
能让原值维持——所以下一轮请沿用本轮的防作弊做法：**与 HEAD 版逐符号 diff，确认 `REMOVED=[]`**。

---

## 3. 已知缺口与低优先级项（本轮登记，未修）

| # | 缺口 | 说明 |
|---|---|---|
| F2 | `tests/budget.test.ts:24` 注释写「新增 7 条（2+2+4）」 | 实测 **+9**（`ui-kit` 53→56 = +3，新文件 `ui-hooks` 6 条），与 README 的 9 不一致。闸门本身正确，只需订正注释 |
| F3 | t3 曾自报「新增 5 条」 | 不实，下游一律用实测 **+9** |
| F5 | `tests/ui-kit.test.tsx:205` 等断言硬编码 `__dirname/../../../src/…` | 不认 `DEERUI_LIB_ROOT`，无法在无副作用副本里做负例（旧断言同病） |
| F6 | BUG-4（滚轮累加器跨手势残留）/ BUG-5（380ms 内卸载留 armT）/ BUG-8（Esc 抢占） | 按冻结文档 §3.3 为「存疑·本轮不改」。BUG-5 的 `armT` 清理由 BUG-3 的卸载 effect 顺带覆盖 |
| F7 | 公开类型面无判据 | 同 §1.1，即 A0-2 对 `export type *` 不可见 |
| F8 | 12 个被跟踪文件工作区是 CRLF | 历史遗留（`.gitattributes` 加之前克隆的树）+ t3 刚改的 `scrub.tsx`。它们**不进 tarball**，打包可复现性不受影响；下次重新 clone 即干净。**不是缺陷** |
| F9 | SSR / 真机路径无验证 | 本仓库 `renderToStaticMarkup` 不执行 effects、无 Next.js 冒烟工程、无 Android 设备。不得以「已核」口吻书写 |
| — | `tokens.css` 浅色块里 `--on-accent` 被同值重写一次 | 与 README「固定色令牌不得在浅色块覆盖」的字面规则轻微漂移，无行为影响，tokens 属该轮 out-of-scope |
| — | `recorder-restored` 未直验 React hooks 还原 | reviewer 观察，非阻断 |
| — | `Keep` 的 `ms` 仍会重启已启动的退场定时器 | 冻结口径未要求修，非漏修 |
| — | lint / format 工具链完全缺失 | 冻结文档 §F-1 明确排除。引入时该加 `lint` / `format` / `format:check` 三条 script，并接进 `.github/workflows/ci.yml` 的 `npm ci` 之后、`typecheck` 之前；首次格式化单独一个提交 |

---

## 4. 双格式产物（T-2）的状态

用户明确选择了「真做双格式产物」，目标：原生 `require('deer-ui')` 与 `import('deer-ui')` 都能成功。

**根因（已实测，不是 `exports` 条件问题）**：
```
require('./dist/index.js')  → ERR_UNSUPPORTED_DIR_IMPORT
import('./dist/index.js')   → ERR_UNSUPPORTED_DIR_IMPORT
  "Directory import '…/dist/kit' is not supported"
```
`dist/index.js` 里是 `export * from "./kit"`（无扩展名 + 指向目录）。因此**只补 `exports` 的
`require` 条件没有意义**——必须同时改源码导入形态与产物格式。`package.json` 目前也没有 `type` 字段。

**要做的事**：`src/**` 相对导入补 `.js` 后缀（含 `./kit` → `./kit/index.js`）；`tsconfig.json` 的
`moduleResolution` 从 `Bundler` 改 NodeNext 系；出 ESM + CJS 两份产物（CJS 目录放
`{"type":"commonjs"}` 作用域文件）；`exports` 每子入口给 `import` / `require` / `types`
（`types` 仍排第一，`check-dist.mjs` 盯着）；`build` 同步产出两份。

**风险（必须验证）**：双包危险——`tooltip.ts` / `pcmode.ts` 是模块级单例，宿主一半走 CJS
一半走 ESM 会让订阅表分裂、长按提示静默消失；React 单实例；`"type": "module"` 对
`scripts/` / `tests/` / `examples/` 的解析影响；改完 `src/**` 所有 import 行后，
README 里「逐字节复制、只改过 import 行」的血缘记载会再次过期，需同步更新。

**状态**：该任务（t10）依赖已改为只依赖已完成的 t3，因此**已可派发**，并且它已把
BUG-6（`useLandscape` 的 effect 缺 `typeof window` 守卫）折为第 0 项一并处理。
若你读到本文件时 t10 仍未完成，它就是**唯一在飞的范围 B 工作**。

---

## 5. BUG-6（用户已裁决本轮修，现归 t10）

`src/kit/primitives.tsx` 的 `useLandscape`：`useState` 初值处有
`typeof window === "undefined"` 守卫，但 `useEffect` 内**无条件**调用 `window.matchMedia(mq)`，
两条路不一致。真实 SSR / 客户端水合（Next.js App Router）会 `ReferenceError`。

修法：参照**同文件 `HoverTip`** 的既有写法，在 effect 开头加
`if (typeof window === "undefined") return;`。零风险（不改 DOM 契约、不改渲染输出、不改断言数）。
