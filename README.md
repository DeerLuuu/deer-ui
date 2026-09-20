# deer-ui

PixelCraft（像素工坊）把 **UI 表现层**独立出来的控件库：React 18 + **自带样式**（设计令牌 + 控件规则，
`deer-ui/styles.css`）+ 无运行时依赖（除 `react` / `react-dom` peer）。
方案与依据全在应用仓库的 `docs/PLAN-deer-ui.md`（本文只写**这个仓库自己的**口径）。

- **包名** `deer-ui`、**版本** `0.1.0`、**许可** MIT（版权归 DeerLuuu，与 `package.json` 的 `license` 字段一致）。
- **v0 不发布 npm**：只以 `npm pack` 出来的 tarball 交付（应用侧用 `file:vendor/deerui-<version>.tgz` 消费）。
- **源码真相只在这个仓库**：应用侧禁止直接改 `vendor/` 里的 tarball 内容或（拆仓后）库的副本。

> ⚠️ **裸名 `deer-ui` 在 npm 上已被别人占用**（latest `1.1.10`，作者 `bear-ui`，本机未联网复现过）。
> 所以 `name` 字段虽然写着 `deer-ui`（GitHub 仓库名与 npm 包名不冲突），**将来真要 `npm publish` 必须换名**，
> 候选是 scope 名下的 `@deerluu/deer-ui`。当前 `private: true` 已经把误发布这条路堵住。

## 与 PixelCraft 的关系

| 项 | 口径 |
|---|---|
| 定位 | 「PixelCraft 内部复用」优先，将来才谈对外（方案 Q6 默认值） |
| 库放什么 | **DOM 契约 / 控件行为 / 无障碍属性** |
| 应用放什么 | **业务文案 / 数据 / 布局位置 / 什么时候显示** |
| 谁判 PC 模式 / 主题 / 安全区 | **宿主**。库只消费被推入的状态（方案 R3，见下面 A0-3） |
| 谁提供 i18n 文案 | **宿主**。库只收「键名 + 英文默认值」（P3 才接） |
| 改库的顺序 | 先在本仓库改 → 打 tarball → 应用侧一个独立提交（提交信息带**库的 sha**，不带库版本号） |

**现状**：应用侧 P0 切片的 **9 个文件**已复制进来（`src/kit/*` 7 个 + `src/tabs.tsx` + `src/tooltip.ts`，
逐字节等价、只改了 `src/kit/scrub.tsx` 的 2 行 import 指向库内 `src/internal/*`）；`src/engine/{expr,scrub}` 作为
**内联副本**进了 `src/internal/`（库不得反向 import 宿主，方案 R11 接受这份重复）；示范页在 `examples/demo.tsx`
（不进 barrel / 不进 `files` / 库测试不依赖）。**样式已经进库**（P2）：`src/styles/{tokens,kit}.css` →
`dist/styles.css`，`exports["./styles.css"]`，判定规则与对账见「库自带样式」一节。断言台账见下面「P0b 落地记录」。

## 目录结构

```
src/index.ts            公开 barrel（只 re-export；A0-2 盯着它）
src/kit/                P0b 从 PixelCraft `src/ui/kit` 复制的 7 个文件（index.ts 是 barrel）
src/tabs.tsx            TabBar / DropMenu
src/tooltip.ts          showTip / hideTip / subscribeTip（**库独占**，见方案 R10）
src/internal/expr.ts    内联自 PixelCraft `src/engine/expr.ts`（算式求值；文件头有出处与防分叉说明）
src/internal/scrub.ts   内联自 PixelCraft `src/engine/scrub.ts`（拖动/滚轮数值数学）
src/styles/tokens.css   设计令牌（`:root` + `[data-theme="light"]`，**库自带**，P2 从应用样式表逐条搬来）
src/styles/kit.css      只属于 kit 的控件规则（同类口径：按组件真的渲染出哪个 class 判归属）
examples/demo.tsx       dev-only 示范页（逐字节复制自应用 `kit/demo.tsx`，只有 1 行 import 改动）
                        —— **不进 barrel / 不进 files / 不进 dist**；库测试不依赖它（那 6 条 ui.demo.* 留在宿主侧）
examples/demo.css       示范页自己的版式（dev-only）：示范页**只吃库自己的样式**，不再假设宿主提供
examples/globals-css.d.ts  `declare module "*.css"`（只给示范页的 CSS import 用）
tests/tsconfig.json     库测试的编译编排（rootDir=库根、outDir=tests/.ts-out、include 用 glob）
tests/common.ts         ok / eq / finish（打印 `assertions: N` 与 `ALL PASS`）
tests/env.ts            Node 标准库薄封装 + 库根解析（DEERUI_LIB_ROOT 可覆盖）
tests/scan.ts           三条判据用到的纯扫描函数（可单测，见下）
tests/a0-purity.test.ts         A0-1 纯度白名单
tests/a0-barrel.test.ts         A0-2 barrel 导出面快照（非 JS 入口如 `./styles.css` 单独一条判据）
tests/a0-host-boundaries.test.ts A0-3 不得自判 PC / 主题 / 安全区
tests/ui-kit.test.tsx   P0b 从应用 `tests/ui-kit.test.tsx` 搬来的 62 条控件 DOM 契约断言
tests/styles.test.ts    样式归属判据（令牌齐 / 关键规则在 / kit.css 的 class 都在库源码里 / 产物链路）
tests/dom-stub.ts       自带 DOM 桩（R9：库测试不许依赖应用侧 stubEnv()）
tests/snapshots/barrel-exports.json  ★ 导出面快照（改导出面必须显式更新）
scripts/tsc.mjs         解析一个可用的 tsc 再跑（两级顺序见 scripts/tsc-path.mjs）
scripts/tsc-path.mjs    「怎么找 tsc」的唯一实现（只有本仓库 node_modules 与 $DEERUI_TSC 两个来源）
scripts/build-styles.mjs 样式源 → `dist/styles.css`（`npm run build` 的后半步；tsc 不拷 CSS）
scripts/check-dist.mjs  dist 产物自检（exports 目标存在 / 没打进 React / 无外链 / 没有 demo / styles.css 幂等）
scripts/link-dev-deps.mjs 离线应急：把**显式指定**的 node_modules 链进来（必须设 $DEERUI_DEPS_SOURCE，见下）
scripts/pack-vendor.mjs  产出应用侧约定的 deerui-<version>.tgz 并打印 sha256
tsconfig.examples.json  示范页的类型检查（它不在 src 里，但 import 路径漂了要能红）
```

## 命令

```sh
npm ci                 # 按 package-lock.json 装依赖（CI 与本地首选；装完即可跑下面全部命令）
npm run typecheck      # tsc -p tsconfig.json --noEmit（src，strict: true）
                       #   && tsc -p tsconfig.examples.json（示范页，它不在 src 里）
npm run build          # tsc -p tsconfig.build.json → dist/（ESM + .d.ts，逐文件，无 bundler）
                       #   && node scripts/build-styles.mjs → dist/styles.css（脚本会打印字节数/规则数）
npm test               # 编译 tests/ 到 tests/.ts-out 后运行；末两行是 assertions: N / ALL PASS
npm run snapshot:barrel  # 导出面**有意**变化时更新快照（必须连同提交信息一起说明）
npm run check:dist     # 构建产物自检（CI 在 build 之后跑）
npm pack               # 出 deer-ui-0.1.0.tgz（prepack 会先 build + check:dist）
npm run pack:vendor    # 再落一份应用侧约定的 deerui-0.1.0.tgz（见「打包与消费」）
```

宿主消费样式（一条子路径，`file://` 下也不多一次网络往返）：

```ts
import "deer-ui/styles.css";   // = dist/styles.css（tokens + kit 规则，单文件）
```

## 依赖与工具链

**首选 `npm ci`**：仓库里有 `package-lock.json`（联网 `npm install` 生成并入库），照着它装即可 ——
不需要本机另外准备 `node_modules`，也不需要**平级的 PixelCraft 检出**。库必须能在只有这一个仓库的机器上
装完、测完、构建完（CI 与「无宿主环境」验证跑的都是这条）。

1. **tsc 从哪儿来** —— `scripts/tsc.mjs` 按顺序找一个能用的 tsc，并在 stderr 打印用的是哪一个：
   ① 本仓库 `node_modules/typescript/lib/tsc.js` → ② 环境变量 `$DEERUI_TSC`。
   （别照抄应用侧那条 `node_modules/typescript/bin/tsc.js`：本机真路径在 `lib/tsc.js`，`bin/tsc` 只是无扩展名的 shell 包装。）
2. **react / @types 从哪儿来** —— 同样来自 `npm ci`。**真的没网**时才用离线应急口子：
   `DEERUI_DEPS_SOURCE=<某个已装好的 node_modules> npm run link:devdeps`
   （把它里面的 `typescript` / `react` / `react-dom` / `scheduler` / `loose-envify` / `js-tokens` / `csstype` / `prop-types` / `@types`
   以 **junction** 链进本仓库的 `node_modules/`；`node_modules/` 已被 `.gitignore` 忽略，不进提交）。
   **来源必须显式给**：早先它默认去链平级的 `../pixelcraft/node_modules`，那是一条隐式的邻居依赖，
   已删除（不设 `DEERUI_DEPS_SOURCE` 就直接报错退出）。链接过去的是同一份物理文件，所以顺带满足
   「React 单实例」；但它**不是**一次真安装（不写 lockfile、不校验 integrity），只配当应急手段。

> **React 必须单实例**（硬约束）：`peerDependencies` 写 `^18.3.0`，库**不**自带 React。
> 两份 React = `Invalid hook call` + `useSyncExternalStore` 订阅表分裂；应用侧走 tarball（真目录）而不是
> `file:` 目录链接，就是为了这条。

## 三条 A0 机器判据（本仓库的「公开面」= 会红的东西）

| 判据 | 断言名 | 内容 |
|---|---|---|
| A0-1 纯度白名单 | `kit.purity.offenders` | `src/**` 只许依赖 `react` / `react-dom` / `react-dom/*` / `react/*` 与**库内相对路径**；相对路径必须解析得到、且**不得越出 `src/`**（`../../engine/expr` 这类越界会被点名） |
| A0-2 导出面快照 | `kit.barrel.surface` / `kit.barrel.entry.*` / `kit.barrel.reexport-only` | 按 `package.json` 的 `exports` 逐入口把导出面**逐符号快照**成 JSON；入口文件（`index.ts`）只许 re-export，不许写实现 |
| A0-3 不得自判 PC / 主题 / 安全区 | `kit.pcmode.pushed-not-detected` / `kit.theme.host-owned` / `kit.safearea.host-owned` / `kit.host.no-storage` | 禁的是**判定性调用**：`matchMedia` 带 `pointer:` / `hover:` / `prefers-color-scheme`、写 `data-pc` / `data-theme`、写 `--sat/--sab/--sal/--sar`、`localStorage`/`sessionStorage` 全禁。**允许** `window.innerWidth/innerHeight` 的测量用法与 `(orientation: landscape)` 这类布局查询（方案 §7.1 R3 的修正措辞） |

三条判据都有**自检**段（`kit.purity.selfcheck` / `kit.pcmode.selfcheck.*` 等）：把合成样本喂给扫描函数，
断言「该抓的抓住、该放过的放过」。这样**空库上判据也不是恒真**的 —— 判据本身被改坏会被自己的自检抓住。

扫描前会**去掉注释**（保留行号），所以「注释里提了一句 `localStorage`」不会误报。

**示范页为什么不需要豁免**：`examples/demo.tsx` 是 dev-only 示范页（方案 §2.5 / Q8），它自己
`createRoot` 挂到页面上、自己切 `data-theme` —— 那是**宿主**的活。P0b 把它放在 `src/` **之外**，而 A0-3 只扫
`src/**`，所以它在射程之外；`kit.examples.*` 四条把这件事钉住：① 它在 `src/` 之外（`src/demo.tsx` 不得存在）；
② **它的正文照样会被判据抓住**（`kit.examples.would-be-caught` —— 证明「放过」靠的是位置，不是把规则放宽）；
③ 它不进 `files`（进不了 tarball）；④ `check:dist` 另有一条「dist 里不得出现 demo」。

### P0b 落地记录（2026-09-20）

**复制口径**：应用侧 12 个文件按字节复制进来，然后只做「import 路径 + 必要的类型引用」改动。逐行核对（行尾归一后）：

| 库内文件 | 相对应用侧 | 改了什么 |
|---|---|---|
| `src/kit/{primitives,Dialog,Form,HoverTip,pcmode,index}.tsx/ts`、`src/tabs.tsx`、`src/tooltip.ts` | **逐行相同** | 无 |
| `src/kit/scrub.tsx` | 差 **2 行** | 第 7 行 `../../engine/expr` → `../internal/expr`；第 8 行 `../../engine/scrub` → `../internal/scrub` |
| `examples/demo.tsx` | 差 **1 行** | 第 14 行 `./index` → `../src/index`（它从 `src/ui/kit/` 挪到了 `examples/`） |
| `src/internal/{expr,scrub}.ts` | 多 **5 行**头部 | 出处注释 + 「库不得反向 import 宿主 / 防分叉」说明；其余 87 / 60 行逐行相同 |

**库自己的断言台账**（数法：`npm test` 末行的 `assertions: N`，构成由 `tests/common.ts` 的 `byPrefix` 打印）：

| 项 | 条数 | 说明 |
|---|---|---|
| `ui.*` 控件 DOM 契约（`tests/ui-kit.test.tsx`） | **62** | P0b 从应用侧那份**逐字搬来**：名字一条没改、条件一条没削（比对见应用仓库 `docs/PLAN-deer-ui.md` §10） |
| `kit.*` + `lib.*`（A0-1/A0-2/A0-3 + 测试基建 + 样式归属判据 + 预算闸门） | **72** | 库自己的判据与基建 |
| **库侧运行期断言合计**（= 预算闸门下限） | **134** | 62 + 72，只许涨（`.github/workflows/ci.yml` 会跑 `npm test`） |

### 计数口径（库侧 134 = 62 + 72）

```sh
npm test        # 末两行 `assertions: 134` / `ALL PASS`，上面另有一行 `[budget] 构成：…`
```

**应用侧那份账（宿主 `ui kit` 小节 70 = 搬入 62 + 留宿主 8）本仓库不再维护**（2026-09-20 移出）：
P0b 时期这里有个 `scripts/count-host-assertions.mjs` 夹具（靠 junction 链宿主的 `src/` 与 `node_modules/`
去复现 70/62/8），`tests/budget.test.ts` 里也有个 `MIN_HOST_MOVED = 62`。**两样都删了**，理由：

1. 那是**应用侧的账**：它读宿主 `tests/ui-kit.test.tsx`，还得宿主的安装树在手边 —— 应用侧会自己收下（含那 62 条
   同名同义断言的收口）；
2. 库测试**不许**依赖宿主仓库：库必须能在**没有 PixelCraft 在场**的目录里 `npm ci` + `npm test` + `npm run build`
   （本轮独立验证就是这么跑的，见「独立安装验证」）。

现在 `tests/budget.test.ts` 只钉库自己的两个下限（`ui.*` 62 与 `kit.*+lib.*` 72，**分开判** —— 总数会掩盖
「基建长胖、控件契约变少」），并且 `package.json` 里也没有 `count:host-assertions` 这条 script 了。

**复制时的行尾陷阱（实测）**：两个仓库都是 `core.autocrlf=true` 且都**没有** `.gitattributes`，
所以 PixelCraft 的**工作区**文件是 **CRLF**、而本仓库骨架阶段新建的文件是 LF。从应用侧拷文件进来**不必手工转 LF**
（`git add` 会按 `text=auto` 把 CRLF 归一成 LF 入库，与应用侧 blob 一致；P0b 复制的 12 个文件
`git hash-object` 与应用侧**逐个相同**），但**别拿两个工作区的字节直接比**（CRLF vs LF 会假红）。

### 导出面快照怎么用

- 改动**导出面**必须显式更新：`npm run snapshot:barrel`，然后在提交信息里写清加了/删了/改了什么符号。
- 快照文件 `tests/snapshots/barrel-exports.json` 的 diff 就是「这次公开面变了什么」的清单。
- P0b 落地时这份快照已按真实导出面更新：`./kit` = **25 个值 + 6 个类型**，`. ` 另含 `TabBar`/`DropMenu`
  与 `tooltip` 的 3 个值 + `Tip`。

## 库测试基建的三处**有意偏离**（相对应用仓库）

1. **`tests/tsconfig.json` 的 `include` 用 glob**（`../tests/**/*.ts`），不抄应用侧那份 60 条显式清单
   —— 那份清单每加一个测试要改两处，属历史包袱。`rootDir: ".."` 指向**库根**，
   `outDir: ".ts-out"` 因此落在 `tests/.ts-out/`，运行路径是 `node tests/.ts-out/tests/run-tests.js`。
2. **不引 jsdom / vitest / puppeteer**（方案 Q7）：控件契约走 `react-dom/server` 的 `renderToStaticMarkup` +
   静态扫描 + 自写 runner；输出末尾必须是 `assertions: N` 与 `ALL PASS` 两行，预算闸门要求
   **N ≥ 134**（= 库自带控件契约 62 + 判据与基建 72；口径写在 `tests/budget.test.ts` 顶部）。
   `tests/dom-stub.ts` 是自带的最小 DOM 桩（R9：**不许**依赖应用侧 `stubEnv()`）。
3. **`src` 用 `strict: true`，`tests` 用 `strict: false`**：`src` 是本仓库新写的（不背历史包袱，方案 §4.1 说的
   「改 strict 是独立的一轮」指应用侧）；`tests` 要能直接吃下从应用侧搬来的既有测试文件，所以跟应用侧一致。
   两处都写死 `"jsx": "react-jsx"`（少一份就会让宿主 esbuild 退回经典 JSX 变换，出白屏包，见 AGENTS.md §6.8）。

## 库自带样式（P2 拆样式）

**一条子路径**：`import "deer-ui/styles.css"` → `dist/styles.css`
（= `src/styles/tokens.css` + `src/styles/kit.css`，由 `scripts/build-styles.mjs` 逐字节拼接 —— `tsc` 不拷 CSS，
所以 `npm run build` 是「tsc → 拼样式」两步）。`npm run check:dist` 还会钉住产物：`:root{` 与
`[data-theme="light"]{` **各恰好一次**、没有重复规则、没有 `.demo-*`（示范页版式是 dev-only）、没有外链。

**内容（2026-09-20 实测）**：`dist/styles.css` **17,790 B / 92 个顶层块 = 85 条规则（逐个选择器算 103 个）+ 7 个 `@keyframes`**。

### 归属判定规则（可复核）

按**组件真的渲染出哪个 class** 判，不按名字像不像。判定脚本是一次性的（只活在 `%TEMP%`，**库与应用仓库里都不放**）：

| # | 规则 |
|---|---|
| R1 | 令牌块 `:root` / `[data-theme="light"]` → **库**（kit 的每条规则都靠 `var(--…)` 取色取尺寸） |
| R2 | 普通规则（选择器列表 + 声明块**整条原子**，不拆列表）：选择器里的类名**全部**由库组件渲染（`src/kit/**`、`src/tabs.tsx`、`src/tooltip.ts`、`examples/demo.tsx`）→ **库**；只要有一个类名只有应用侧在渲染 → **留应用** |
| R3 | 纯元素选择器（没有类名/属性选择器）：命中 `html` / `body` / `#root` → 留应用（页面外壳）；命中库组件渲染的元素（`*`、`svg`、`button`、文本类 `<input>`、`canvas,svg,img,button`）→ **库** |
| R4 | `html[data-pc] …`（PC 密度覆写）→ **留应用**：PC 模式由宿主判定并写 `data-pc`（方案 R3） |
| R5 | `@keyframes`：被进库规则的声明引用 → **库**（`.dlg` / `.panel` / `.tip-host` 的动画要它）；只被应用规则引用 → 留应用 |
| — | `@media` 块：本次**没有**一条 `@media` 里只含 kit 规则 → 整块留应用（方案 §5.2 P1 坑②：不把规则挪出 `@media`） |

### 对账（不重不漏 + 逐条原样）

对账拿**产物** `dist/styles.css` 与应用 `src/ui/style.css` 逐条比（行尾归一后比「选择器 + 声明」）：

| 项 | 数 |
|---|---|
| 应用 `style.css` | 831 条规则 + 34 个 `@keyframes` + 11 个 `@media`/其它块 |
| **进库** | **85 条规则**（2 个令牌块 + 83 条 kit 规则）+ **7 个 `@keyframes`** |
| **留应用** | **746 条规则** + 27 个 `@keyframes` + 11 个 `@media` |
| 账 | 85 + 746 = **831（不重不漏）**；两边的规则键（选择器+声明）多重集合**无交集** |
| 逐条原样 | 产物里 92 条规则/动画的**原文**全部命中原样式表（0 处不符）；`dist/styles.css` == 两个源文件逐字节拼接（幂等） |

完整的「进库 / 留应用」两份选择器清单在**本轮执行记录**里（一次性对账脚本与清单只写 `%TEMP%`，不往两个仓库里塞工具）。
**进库清单的权威副本就是 `src/styles/*.css`**：应用侧要删的就是与它逐条相同的那些规则。

### 有意的取舍（不是漏搬）

- **选择器列表里混着应用类的规则整条留应用**（例如 `.btn,.orb,.orb-item,.chip,.colorbox,.holdbtn,.cb-swatch{…user-select…}`
  与 `.view-canvas,…,.dlg,.menuitem,.sym-chiprow{…}`）：拆列表就要把声明块复制成两份，属「改结构」不属「搬家」；
  本轮取「整条原子」，代价是这几条里的 kit 类仍由应用那份样式提供（应用照样消费库样式，视觉不变）。
- `.panel-head` / `.panel-body` / `.row-note`（单独成条的那几处）/ `.menuitem` 留应用：**它们不是库组件渲染的**
  （库的 `Overlay` 只渲染 `.panel`，`Row` 只渲染 `.rowlabel` / `.row-actions` / `.row-note` 的**无样式默认**）。 
  这是「按组件判归属」的直接结果，也是后续要不要给库补一条 `.panel-body`/`.row-note` 默认样式的**入口**（本轮不新增声明）。
- **PC 密度覆写留应用**（`html[data-pc] .btn/.chip/.tab/.dlg*…`）：与 A0-3 同一条口径 —— 库不自判 PC 模式。
- 安全区变量 `--sat/--sab/--sal/--sar` **由库声明 `env()` 兜底默认值**，写入者永远是宿主
  （PixelCraft 的 `src/io/safearea.ts`，方案 §5.2 P2 坑①）。

## 打包与消费

```sh
npm run pack:vendor            # → deerui-0.1.0.tgz（同时也产出 npm 自己命名的 deer-ui-0.1.0.tgz，脚本里已清掉中间那份）
# 应用侧（PixelCraft）：
#   cp deerui-0.1.0.tgz <app>/vendor/
#   npm i file:vendor/deerui-0.1.0.tgz
```

消费方要引两条：**JS**（`deer-ui` / `deer-ui/kit` / `deer-ui/tabs` / `deer-ui/tooltip`）与**样式**
（`deer-ui/styles.css`）。样式只有一条子路径、单文件，`file://` 形态下也不多一次网络往返。

> **文件名差一个连字符，别记错**：npm 的 tarball 名由**包名**决定（`deer-ui-0.1.0.tgz`），
> 而方案 §4.6 / 应用侧消费路径写的是 `file:vendor/deerui-<version>.tgz`。两者是同一份包（装完仍是 `deer-ui`，
> 路径由 `package.json` 的 `exports` 决定，与文件名无关）。`npm run pack:vendor` 会顺手重命名并打印 sha256，
> 手工重命名这一步就不用做了。

`files` 只收 `dist` / `LICENSE` / `README.md`；`tests/`、`scripts/`、`.github/` 都不进包。
`sideEffects: ["*.css"]`**不是** `false`：样式块是有副作用的（`dist/styles.css` 现在真的有内容了；
`examples/demo.css` 是 dev-only，不在 `files` 里）。

**bundler-only 声明（方案 Q4 选 (b)）**：源码里的相对 import **不带 `.js` 后缀**，`dist` 是逐文件的 ESM，
**不发 CJS**。因此 `node` 直接 `import` `dist` 会失败 —— 消费者只允许是打包器（宿主 esbuild）或浏览器。
两条路（写后缀 / 声明 bundler-only）都可行，但**不能留默认**，这里选的是后者并写在这里。

## CI

`.github/workflows/ci.yml`（真文件，不是示例）：`npm ci` → `typecheck` → `build` → `test` → `check:dist`。

仓库**有 `package-lock.json`**（联网 `npm install` 生成并入库），所以走 `npm ci`：装上的是锁里那一份
（版本 + integrity 都核），不受「今天 registry 上是哪个版本」影响。CI 里**没有**、也不需要应用仓库
（PixelCraft）在场 —— 这正是「库能独立安装与运行」这条地基的机器判据。

> 若推送这次改动时 GitHub 报 token 缺 `workflow` scope（`.github/workflows/` 下的文件需要它），
> 临时把本文件改名为 `.github/ci.yml.example` 再推即可 —— 内容一个字不用改，等换一把有该 scope 的
> 凭据再推回去（先例：提交 `bce2647`）。

## 独立安装验证（无 PixelCraft 在场）

把库复制到一个**没有宿主仓库**的目录（排除 `node_modules/` 与 `.git/`），在那里跑：

```sh
npm install        # 联网真装（lockfile 已在仓库里，装完 node_modules/react 是真目录，不是指向别处的 junction）
npm test           # assertions: 134 / ALL PASS
npm run build      # dist/（ESM + .d.ts + dist/styles.css）
npm run check:dist # 产物自检：OK（含 styles.css 的字节数与规则数）
```

四条全绿才算过；任何残留的 `../pixelcraft/...` 回退（`scripts/tsc-path.mjs` 与 `scripts/link-dev-deps.mjs`
里曾各有一条）都会在这种目录里当场暴露。库侧 `node_modules/` **必须**是真目录 —— 用 junction 链宿主那份
会让「React 单实例」看起来满足，实际是两个仓库的安装树被悄悄绑在一起。

## 许可

MIT（`LICENSE`，版权行 `Copyright (c) 2026 DeerLuuu`），与 `package.json` 的 `"license": "MIT"` 一致。
