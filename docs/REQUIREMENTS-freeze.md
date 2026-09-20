# deer-ui 规范化：范围冻结与验收口径（t1 产出）

> 本文件是后续**实现与验收的唯一依据**，也是一份**冻结口径**：任何人要改它，必须在提交信息里写清
> 「改了哪一条、为什么」。本文件只描述「规定什么」，不描述「怎么实现」。
>
> 生成时的回归基线（2026/9/20，本机实测）：
>
> | 命令 | 结果 |
> |---|---|
> | `node scripts/tsc.mjs -p tsconfig.json --noEmit` | exit 0 |
> | `node scripts/tsc.mjs -p tsconfig.examples.json` | exit 0 |
> | `node scripts/tsc.mjs -p tests/tsconfig.json` → `node tests/.ts-out/tests/run-tests.js` | `assertions: 134` / `ALL PASS` |
> | `node scripts/tsc.mjs -p tsconfig.build.json` → `node scripts/build-styles.mjs` | `dist/` 25 个产物；`styles.css` **17,790 B / 92 条规则 / 326 行** |
> | `node scripts/check-dist.mjs` | OK（25 个产物文件） |
>
> 以上五条**全绿**是本次「规范 + 修 bug」的**起点与终点**。任何一条变红 = 本轮失败。

---

## 0. 范围边界（写死）

**本次要做（in scope）**

1. 补齐**工程规范**缺口：可执行、可判定的那些（见 §2），每条都必须接上本仓库**已有**的验证命令。
2. 修复**已确认的运行时 bug**：仅限 §3.2 中裁定为「确认」的三条。
3. 补齐**文档**缺口：与仓库实际状态一致，不写没验过的话（见 §2 E 组）。

**本次不做（out of scope）**

| 不做的事 | 理由（客观） |
|---|---|
| 发 npm / `npm publish` | `package.json` 是 `private: true`；裸名 `deer-ui` 在 npm 已被他人占用（README「发布面」）；发布面本身尚未定型 |
| 改包名 / 改子路径（`deer-ui` → `@deerluu/deer-ui`） | 改包名会让 `import … from "deer-ui/kit"` 全线失效，且与「公开导出面冻结」直接冲突 |
| 给 `Dialog` 加 portal / 焦点陷阱 / 关闭后归还焦点 / `TipHost` 加 `aria-live` | README「已知缺口」明说无障碍只做了一半；这属于**新功能 + 改 DOM 层级**，会同时破坏「不改冻结 DOM 契约」这条不变量 |
| 引入 jsdom / vitest / puppeteer / 任何新运行时依赖 | README「测试基建的三处有意选择」：历史 bug 全是布局类，jsdom 没有布局；本库零运行时依赖是产品承诺 |
| 引入 bundler（vite/rollup/tsup） | tsconfig 注释 §「四条不改回」第 4 条：一条 tsc 同时出 ESM + `.d.ts` |
| 删/改/弱化任何既有断言，或下调预算闸门 | §4 不变量：134 条断言只许涨 |
| 改任何渲染出的类名 / 元素层级 / `role` / `aria-*` | §4 不变量：DOM 契约冻结 |
| 改 `tests/snapshots/barrel-exports.json` 里的符号集合 | §4 不变量：公开导出面冻结 |
| 让 `examples/demo.tsx` 真跑起来 / 补 sprite 图标数据 | README「已知缺口」：示范页的 devserver 与图标集都属宿主资源，不在本仓库 |
| 令牌收敛（143 定义 → 34 引用） | README：这是一次**有意的**改动，要重跑令牌断言，与本轮「规范 + 修 bug」不同批次 |
| 写三端兼容（`file://` / 旧 WebView）的「已核」结论 | 本机没有 Android 设备；只能静态守 |
| 动 `src, tests, scripts, examples, .github, package.json` 之外的**契约性**内容 | 除本文件与 §2 E 组允许的文档外，不新增面 |

---

## 1. 本轮不变量（冻结，先读这条）

**INV-1 DOM 契约不变。** 以下逐字冻结（来源：`src/kit/Dialog.tsx` 文件头、`tests/ui-kit.test.tsx` 的 62 条 `ui.*`）：

- `Dialog` 渲染 **fragment**，不是 portal：`.dlg-mask` + `.dlg[role=dialog][aria-modal=true][aria-label][data-guide]`，
  内部顺序恒为 `dlg-head → (top) → dlg-body → (extra) → dlg-foot`；`dlg-foot` 只在给 `footer` 时出现；无 `onClose` 时不出 `×`。
- 其余控件的类名/层级：`.rowlabel` / `.row-note` / `.row-actions` / `.chips > .chip[.on]` / `.tabs > .tab[.on]` /
  `.sw[role=switch][aria-checked]` / `.btn[.active][.danger]` / `svg + <use href="#id">` / `.htip[role=tooltip]` /
  `.panel[.panel-full]` + `.panel-mask` / `.keep[.out]` / `.tabbar` / `.tabbar-tabs` / `.tabbar-tab[.on]` / `.tabbar-badge` /
  `.tabbar-right` / `.dropmenu*`（`DropMenu` 的下拉**本来就是** portal + `position:fixed`，这不属于「新增 portal」）。

**INV-2 公开导出面不变。** `tests/snapshots/barrel-exports.json` 是唯一判据，四个 JS 入口 + 一条 CSS 子路径的符号集合不许增删改：

- `.`：30 值 + 9 类型；`./kit`：25 值 + 6 类型；`./tabs`：2 值 + 2 类型；`./tooltip`：3 值 + 1 类型。
- `src/index.ts` 仍然**只 re-export**（`kit.barrel.reexport-only` 盯着）。

**INV-3 断言与产物不变（只许涨）。** `npm test` 必须继续打印 `assertions: 134` / `ALL PASS`；`npm run build` 后
`dist/` 仍 25 个产物、`dist/styles.css` 仍 **17,790 B / 92 条规则**（= 内容未改），`npm run check:dist` 仍 OK。

**INV-4 依赖面不变。** `src/**` 仍只许依赖 `react` / `react-dom` 家族 + 库内相对路径且不得越出 `src/`（A0-1）；
库仍不自行判定 PC 模式 / 主题 / 安全区，不碰 storage（A0-3）。

**INV-5 计数类数字必须双处一致。** 若因修 bug 或补规范而**新增**断言，`tests/budget.test.ts` 的
`MIN_CONTRACT` / `MIN_INFRA` 与 `README.md` 里的数字必须同步更新，否则 `lib.budget.assertions` 或文档对账失败。

> **判定不变量的命令见 §5**：INV-1/INV-2/INV-3 由 V-2 与 V-3 判定，INV-4 由 V-1 与 V-2 判定，INV-5 由 V-2 判定。

---

## 2. 工程规范条目（每条：目标 / 客观判定 / 命令）

约定：**命令一律从库根执行**。`node tests/.ts-out/tests/run-tests.js` 需要先跑 `node scripts/tsc.mjs -p tests/tsconfig.json`
（`tests/run-tests.ts` 是 TS，`node tests/run-tests.ts` 直接跑会失败），所以下文统一用 `npm test` 或「编译 + 运行」两步写法。

### A 组：源码与类型

| # | 目标 | 客观判定 | 命令 |
|---|---|---|---|
| **A-1** | `src/**` 依赖白名单与 `src/` 边界 | `kit.purity.offenders` 判定数组为空（相对 import 可解析、不越出 `src/`） | `node scripts/tsc.mjs -p tsconfig.json --noEmit` **和** `npm test` |
| **A-2** | 库不自行判定 PC / 主题 / 安全区、不碰 storage | `kit.pcmode.pushed-not-detected` / `kit.theme.host-owned` / `kit.safearea.host-owned` / `kit.host.no-storage` 四条断言 PASS | `npm test` |
| **A-3** | 入口文件只 re-export | `kit.barrel.reexport-only` PASS | `npm test` |
| **A-4** | `src` strict 类型检查零错误 | 退出码 0（`noEmitOnError` + `strict: true` + `noUnusedLocals`） | `node scripts/tsc.mjs -p tsconfig.json --noEmit` |
| **A-5** | 示范页不许烂（它在 `src/` 外，属独立 tsconfig） | 退出码 0 | `node scripts/tsc.mjs -p tsconfig.examples.json` |
| **A-6** | 不引第三方运行时依赖 / 无 bundler | 本次改动的 `changedPaths` 不含 `package.json` 的 dependencies 段；`node_modules` 无新增包；`kit.purity.offenders` 仍空 | `git diff -- package.json` + `npm test` |
| **A-7** | 「本库不发 `"use client"`」这条**受限结论**必须写在 README 里 | `grep -c '"use client"' src/**` 的输出为 0（源码里不出现该指令）；README 含一句说明它对 Next.js App Router 消费者的含义 | `grep -rn "use client" src/` + E-2 目视 |

### B 组：测试与断言闸门

| # | 目标 | 客观判定 | 命令 |
|---|---|---|---|
| **B-1** | 134 条断言全绿 | 末两行必须是 `assertions: 134` 与 `ALL PASS` | `npm test` |
| **B-2** | 预算闸门分开判、只许涨 | `lib.budget.assertions` PASS，且 stdout 那行 `[budget] 构成：` 的数字与 `budget.test.ts` 常量一致 | `npm test` |
| **B-3** | 修 bug 必须带一条**回归断言**（不许只改源码） | 每条「确认」级 bug 在 `tests/` 里有一条名字含该组件名的新断言——**新增断言数 = 确认级 bug 数**；因此 `MIN_INFRA` 同步 +N | `npm test` + `tests/budget.test.ts` 对账 |
| **B-4** | 断言零顺序依赖（本仓库自己的教训 R9） | 每条断言单独跑也必须 PASS；`lib.runner.dom-stub.restored` PASS | `npm test` |
| **B-5** | 测试不许依赖宿主仓库 | `npm test` 在**没有宿主仓库**的目录里也全绿（A0 三条 + 全部 `ui.*`/`kit.*`/`lib.*` 都是本仓库自足） | 见 V-6 |

### C 组：构建产物与交付

| # | 目标 | 客观判定 | 命令 |
|---|---|---|---|
| **C-1** | `dist/` 可构建、逐文件 ESM + `.d.ts` | 退出码 0，且 `dist/` 下 `.js` 与 `.d.ts` 都存在 | `node scripts/tsc.mjs -p tsconfig.build.json` |
| **C-2** | `dist/styles.css` 为 tokens+kit 逐字节拼接 | 打印 `17790 B / 92 条规则 / 326 行` | `node scripts/build-styles.mjs` |
| **C-3** | 产物自检（exports 目标存在、types 条件在前、无 React 内联、无外链、无 demo、样式无重复规则） | `check-dist: OK`（退出码 0） | `node scripts/check-dist.mjs` |
| **C-4** | CI 流水线顺序与本地一致 | `.github/workflows/ci.yml` 的步骤集合 = {`npm ci` → `typecheck` → `build` → `test` → `check:dist`}，且工作流文件名是 GitHub 认得的 `.yml`（不是 `.example`） | 目视 + `git ls-files .github` |
| **C-5** | `prepack` 必然先 build + check:dist | `package.json.scripts.prepack` 同时含 `build` 与 `check:dist` | `git diff -- package.json`（本轮不应改）+ 目视 |

### D 组：提交与仓库工艺

| # | 目标 | 客观判定 | 命令 |
|---|---|---|---|
| **D-1** | 行尾归一 LF，tarball 跨平台可复现 | `git ls-files --eol` 全为 `i/lf w/lf attr/text=auto eol=lf`；`pack:vendor` 的 CR 闸门不触发 | `git ls-files --eol` |
| **D-2** | 提交信息说明改动面 | 本次每个提交信息里都写明：改了哪些文件性质、是否触及导出面（触及必须显式写「导出面未变/有意变更」） | `git log -1 --stat` |
| **D-3** | 不提交产物 | `git status --porcelain` 不含 `dist/`、`tests/.ts-out/`、`*.tgz`（`.gitignore` 已覆盖） | `git status --porcelain` |
| **D-4** | 版本号不被随手改 | `package.json.version` 仍为 `0.1.0`；`private` 仍为 `true` | `git diff -- package.json` |

### E 组：文档对账（只读仓库事实，不发明数字）

| # | 目标 | 客观判定 | 命令 |
|---|---|---|---|
| **E-1** | README 里的数字与机器实测一致 | 本轮**可由机器复现**的六项逐条对：`assertions: 134`、`dist/` 25 个文件、`styles.css` 17,790 B / 92 条规则 / 326 行、`.` 30 值 + 9 类型、`./kit` 25 值 + 6 类型、`./tabs` 2 值 / `./tooltip` 3 值 | `npm test` / `node scripts/build-styles.mjs` / `node scripts/check-dist.mjs` / 读 `tests/snapshots/barrel-exports.json` |
| **E-1b** | README 里**当前无机器判据**的数字不得被当成事实改写 | 「`:root` 定义 143 个 `--*`、其中 34 个被库规则引用」「浅色块覆盖 77 个主题色令牌」「92 个顶层块 = 85 条规则 + 7 个 `@keyframes`」这三类**没有**对应断言；改动 README 时要么保留原值、要么按 §5 的 V-3 输出核对，**不许**凭印象改数 | 目视 + 与 `node scripts/build-styles.mjs` 输出对账 |
| **E-2** | 文档不写没验过的话 | 修完 bug 后全文搜「已经验过 / 已核 / 实测」段的每一项都仍为真；三端兼容**不得**以「已核」口吻书写；示范页仍不得声称能跑 | 目视 + `grep -n "已核" README.md` |
| **E-3** | `npm test` 的运行路径在文档里正确 | README 里给的跑法在干净检出上照抄可跑通（`npm ci` → `npm test`）；**不得**写 `node tests/run-tests.ts` 这种跑不通的形式 | 复现 README 命令 |

> **E 组只改文档，不改源码/断言**；E 组任一改动都不得让 §5 的五条命令变红。

---

### F 组：本轮**登记但不实施**的规范缺口（写清理由，避免下一轮重新发现）

| # | 缺口 | 客观事实 | 本轮不做的理由 |
|---|---|---|---|
| **F-1** | 没有任何 lint / format 工具链 | 全仓库没有 `.eslintrc*` / `eslint.config.*` / `.prettierrc*` / `.editorconfig`；唯一的 lint 相关痕迹是 `src/kit/scrub.tsx:144` 的一句 `// eslint-disable-next-line react-hooks/exhaustive-deps`——它**没有对应的 ESLint 配置**，是死注释 | 引入 ESLint/Prettier 会带来新依赖 + 大面积格式化 diff，属于「改范围」；本轮只允许删掉那句无效注释或把它改成普通说明（属 BUG-1 修复的附带产物） |
| **F-2** | 没有 `CHANGELOG.md` | 仓库根无此文件 | 本轮没有版本发布行为（不发 npm、不动 version），空的 CHANGELOG 是噪音 |
| **F-3** | 没有 `CONTRIBUTING.md` / issue / PR 模板 | `.github/` 下只有 `workflows/ci.yml` | 单人库、无外部贡献者之前，模板是纯维护负担 |

> F 组是**明确的范围边界**：发现它们不等于本轮要做它们。要解除，必须改本文件并把新命令写进 §5。

---

## 3. Bug 候选逐条裁定

三态定义：**确认** = 有代码级因果链、且至少一条可机检的判定方式（必须修，且带回归断言）；
**存疑** = 有触发路径但本机无 DOM 运行时/无设备可判定（**本轮不改**，只登记 + 给验证手段）；
**驳回** = 不是缺陷（有意决定 / 已被现有关卡覆盖 / 机制上不成立）。

### 3.1 裁定总表

| ID | 现象 | 代码位置 | 触发条件 | 裁定 |
|---|---|---|---|---|
| **BUG-1** | `DropMenu` 打开期间每次 render 都重挂 window 监听 | `src/tabs.tsx:88-97` | 菜单打开时任何一次重渲染（父组件更新、`setOpen`、滚动触发的 `measure()`） | **确认** |
| **BUG-2** | `ScrubNum` 拖动中 `min/max/step` 变更被旧闭包吞掉 | `src/kit/scrub.tsx:68-76`（`mv` 捕获 `min/max/step`）、`down` 在 `79-87` | 拖动已 arm 期间父组件改了 `min`/`max`/`step`（`mv` 仍按旧边界算） | **确认** |
| **BUG-3** | `ScrubNum` 在拖动中被卸载时不摘 window 监听、仍会调 `onChange` | `src/kit/scrub.tsx:61-67`（`end`）、`83-85`（`window.addEventListener`）；组件无 unmount cleanup | 拖动 arm 后组件被卸载（`<Keep>` 退场 / 条件渲染切走） | **确认** |
| **BUG-4** | 滚轮累加器跨手势残留，下一次滚轮结算出一次「幽灵步进」 | `src/kit/scrub.tsx:43`（`wheelAcc`）、`129-141`（不清零） | 用户滚了不足 1 notch（`|Δ| < 100`）后停止 → `wheelAcc` 留残值 → 下次滚轮第一格可能一次跳 2 步 | **存疑** |
| **BUG-5** | `ScrubNum` 早期 `return` 分支 / 快速卸载留下未清可空定时器 | `src/kit/scrub.tsx:79-87`（`armT` 只在 `end`/`clearT` 清） | 380ms 内卸载组件 | **存疑** |
| **BUG-6** | `useLandscape` / `DropMenu` 在 SSR 下可能抛 | `src/kit/primitives.tsx:14-20`、`src/tabs.tsx:88-97` | 仅当被 **`react-dom/server` 渲染的组件树 useEffect 真被执行**（真实的 Next.js/SSR 运行时）。本仓库测试用 `renderToStaticMarkup`，**effects 不执行**，故无法机检 | **存疑** |
| **BUG-7** | 拖出按钮后 `hover` 提示不消失 | `src/kit/primitives.tsx:78-81` | 鼠标按下后移出、pointerup 落在按钮外（`onPointerLeave` 会触发，故实际不成立） | **驳回** |
| **BUG-8** | `DropMenu` 打开时 Esc 被外层 Dialog 抢占 | `src/tabs.tsx:98-103` + `src/kit/Dialog.tsx:53-58`（两者都挂 `window` keydown） | 两者同开时按 Esc（行为随挂载顺序变化，是否存在由调用方结构决定，非控件缺陷） | **存疑** |
| **BUG-9** | `wheel` 监听 `addEventListener(..., {passive:false})` / `removeEventListener(...)` 选项不对称，摘不掉 | `src/kit/scrub.tsx:142-143` | 不成立：DOM 规范里 `removeEventListener` 的 `options` 参数只用于 `capture` 匹配，该监听确实被摘掉 | **驳回** |
| **BUG-10** | 只测过 React 18.3.1，peer 写 `^18.3.0` | `package.json:47-50`（刻意不改） | 18.3.0 / 19.x 未验证 —— 这是 README 已声明的**验证范围**，不是行为缺陷 | **驳回** |
| **BUG-11** | 示范页跑不起来 / `Icon` 全是空 `<use>` | `examples/demo.tsx` 文件头、`src/kit/primitives.tsx:24-30` | devserver 与 sprite 符号集都是**宿主资源**，README 已说明并说明其价值是「消费样板」 | **驳回** |
| **BUG-12** | `Dialog` 无障碍「只做了一半」（无焦点陷阱 / 不开焦点 / 关闭后不归还焦点 / 遮罩不是 portal / `TipHost` 无 `aria-live`） | `src/kit/Dialog.tsx:62-83`、`src/kit/primitives.tsx:92-102` | README「已知缺口」自己声明的**有意取舍**：README 与 `DialogProps` 都只承诺 `role`/`aria-modal`/`aria-label` | **驳回**（本轮明确不做：见 §0 表第 3 行；做了会改 DOM 层级 = 破坏 INV-1） |
| **BUG-13** | `kit.styles.kit-classes-owned` 只证明「class 出现在源码字符串字面量里」，有 class 拼错 / 规则漏写**无机器兜底** | `tests/styles.test.ts:91-98`（`stringTokens`），与 `tests/ui-kit.test.tsx` 的 62 条 `ui.*` 互补 | 触发场景 = 「源码把某控件的 class 改名/拼错，但 `kit.css` 未同步」：现有判据会**放过**它（字符串存在即算归属）。这不是运行时缺陷，而是**判据强度**问题 | **驳回**（本轮不加强该断言；若要升级为「控件渲染出的 class 必须都有规则」，必须新开一条断言并按 INV-5 同步计数） |

### 3.2 「确认」三条的因果链与验收判据

**BUG-1 — `DropMenu` 监听 churn（`src/tabs.tsx:88-97`）**

```tsx
useLayoutEffect(() => {          // ← 没有依赖数组
  if (!open) return;
  const onMove = () => measure();
  window.addEventListener("resize", onMove);
  window.addEventListener("scroll", onMove, true);
  return () => { ...removeEventListener... };
});                              // ← 没有第二个参数
```

因果链：无依赖数组 ⇒ **每次 render 都先清理再重挂**。`measure()` 里的 `setBox`/`setUp` 会触发 re-render
⇒ 打开状态下每次交互（滚动 / resize / 父组件 setState）都会重挂监听，`scroll` 用捕获阶段 + `{capture:true}`
的 `remove`（靠 `capture` 匹配，能摘掉），但重挂次数 = render 次数，属于真实的监听 churn（性能与顺序问题）。
**判定**：断言读源码 `src/tabs.tsx` 的 `useLayoutEffect` 调用结尾存在依赖数组（形如 `}, [open]);`），
且 `grep -c "addEventListener(\"scroll\"" src/tabs.tsx` 语义不变。修法必须**不改变 portal / `position:fixed` / class 组合**。

**BUG-2 — `ScrubNum` 拖动闭包捕获旧边界（`src/kit/scrub.tsx:68-76`）**

```tsx
const mv = (ev: PointerEvent) => {
  ...
  onChange(String(scrubValue(a.n, d, min, max, step)));   // ← 捕获 down() 那一刻的 props
};
```

因果链：`mv` 在 `down()` 的定时器闭包里定义并 `addEventListener` 到 `window`；`down` 是事件处理器，
它看到的 `min/max/step` 是**注册那一帧**的值。拖动期间父组件改了边界（例如改单位、切换预设），
`mv` 仍按旧边界算 ⇒ 出现越界值或步长不符。**判定**：断言新实现用 ref（或事件处理器内读取最新 props）
取边界，即 `src/kit/scrub.tsx` 里 `scrubValue(` 的实参不含直接来自 props 的变量；并保留
`ui.numberfield` / `ui.scrubnum` 系列既有断言。

**BUG-3 — 拖动中卸载不清理（`src/kit/scrub.tsx:61-67` / `77-87`）**

因果链：`window.addEventListener("pointermove"|"pointerup"|"pointercancel", …)` 只在 `end()`（pointerup /
pointercancel）与 `clearT()`（pointerup / pointercancel 的 React 处理器）里摘除；**组件被卸载时没有任何
cleanup**。卸载后 `mv` 仍活着：① 监听泄漏；② 还会调用 `onChange` 去 setState 一个已卸载组件。
本库自己的 `Keep` 就是「延迟卸载」语义（`src/kit/primitives.tsx:122-145`），所以这条路径是**产品正常用法**。
**判定**：断言 `src/kit/scrub.tsx` 存在 `useEffect(() => () => { ... removeEventListener ... }, [])`
（或等价的 ref 化 cleanup）——即卸载路径也会摘掉 `pointermove/pointerup/pointercancel`。

### 3.3 「存疑」登记表（本轮不改，必须能被下一轮直接接手）

| ID | 为什么是「存疑」而不是「确认」 | 需要什么才能判定 | 若判定为真，判定方式 |
|---|---|---|---|
| BUG-4 | 因果链存在，但「残值量级是否足以让下一格跳 2 步」取决于真实设备滚动（deltaMode / 平滑滚动切片）；本仓库无浏览器 | 真机或带布局的运行时 | 断言 `wheelNotches` 累加器在**手势边界**被清零：例如在 `end()` 里 `wheelAcc.current = 0`，并加一条纯函数级断言 |
| BUG-5 | 380ms 内卸载才会留下未清的 `armT` 定时器；定时器到点后仍会 `el.blur()`、`numeric()` 并往 window 挂监听，但组件已卸载不会再渲染，**危害等级未证实**（可能是纯泄漏、无可见症状） | 卸载时序测试（需要渲染器） | 断言 `armT.current` 在 unmount cleanup 里被 `clearTimeout` |
| BUG-6 | 本仓库的「无 jsdom」选择使 `renderToStaticMarkup` **不执行 effects**，所以 SSR 路径在本仓库**不可机检**；真实 SSR 运行时（Next.js）下 `window` 未定义会抛 | Next.js App Router / `react-dom/server` 的 streaming 真机 | 在 Next.js 冒烟工程里 `import { Dialog } from "deer-ui/kit"` 服务端渲染一次；或断言 `useLandscape` 的 effect 内有 `typeof window` 守卫 |
| BUG-8 | `window` 级 keydown 的事件顺序由挂载顺序决定，属**调用方结构**问题，不是控件自己的契约缺陷 | 调用方的 DOM 结构（宿主仓库不在此仓库） | 在宿主里同开 `<Dialog>` + `<DropMenu>` 验证 Esc 只关最上层；本仓库只登记 |

---

## 4. 验收判据（本轮 PASS/FAIL）

本轮 PASS 当且仅当：

1. §2 的 **A/B/C/D** 组每条都**跑过对应命令且退出码为 0**（E 组为文档对账，逐条目视确认无假话；
   E-1b 里没有机器判据的数字必须保留原值或按 V-3 输出核对）。
2. §3.2 的三条「确认」bug 都已修，且**每条都带一条新回归断言**（`tests/` 内，名字含组件名）。
3. 新增断言后 **`tests/budget.test.ts` 的三道下限常量一处不动**（`MIN_CONTRACT=62` / `MIN_INFRA=72` /
   `MIN_TOTAL=134`；实测已核：本轮 134 → 143 时这三行未改），需要同步的是**文档里的现值记录**：
   `README.md`（「开发与调试」「断言台账」「这个版本验证到了哪一步」三处）与 `CHANGELOG.md` 的
   `assertions: N` 必须等于 `npm test` 的实测值，且 `N ≥ MIN_TOTAL`（闸门只钉下限、不跟涨 ——
   涨停的下限会在下一次正常加测试时逼人改闸门，失去「只许涨」的告警意义）。
4. §1 的五条不变量全部成立：DOM 契约未变、导出面快照未变、`dist/styles.css` 仍 17,790 B、`dist/` 仍 25 文件、
   依赖面未变。
5. `git status --porcelain` 不含 `dist/`、`tests/.ts-out/`、`*.tgz`。

**FAIL 的典型信号**（任一出现即本轮未过）：`assertions:` 小于 134；`kit.barrel.surface` 红；
任一条 `ui.*` 红；`check-dist: FAIL`；`styles.css` 字节数或规则数变化；`package.json` 出现依赖变更。

---

## 5. 唯一验证命令集（V-1 … V-6）

从库根执行，按序：

```sh
# V-1 类型检查（src strict）
node scripts/tsc.mjs -p tsconfig.json --noEmit

# V-2 库测试（先编译 tests/，再跑产物；末两行须为 assertions: 134 / ALL PASS）
node scripts/tsc.mjs -p tests/tsconfig.json && node tests/.ts-out/tests/run-tests.js

# V-3 构建 + 产物自检
node scripts/tsc.mjs -p tsconfig.build.json && node scripts/build-styles.mjs && node scripts/check-dist.mjs

# V-4 示范页类型检查（A-5）
node scripts/tsc.mjs -p tsconfig.examples.json

# V-5 全量（等价于 CI 流水线，除 npm ci）
npm run typecheck && npm run build && npm test && npm run check:dist

# V-6 独立安装验证（§2 B-5 的地基判据；在「没有宿主仓库」的副本目录里跑）
#     先排除 node_modules/ .git/ dist/ tests/.ts-out/ 再复制
npm install && npm test && npm run build && npm run check:dist
```

> 任务契约里给的 Verify 两条就是 **V-1** 与 **V-2**；本文件把 **V-3/V-4** 也列为必须跑，因为
> 「DOM 契约 + 导出面」之外，产物与示范页同样是本轮不变量的一部分；**V-6** 是「库能独立安装运行」的机器判据。

---

## 6. 冻结声明

- 本文件是**需求与验收口径**，不是实现方案；实现必须只照 §1 不变量与 §2 条目的**判定方式**来，不得绕过命令。
- §3.1 的三态裁定**已冻结**：实现阶段不得把「存疑」当「确认」去改（那属于改范围），也不得把「确认」当「存疑」放过。
- 要改本文件任何一条，必须同时给出新的**客观判定方式**与**命令**，并在提交信息里写明理由。
