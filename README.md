# deer-ui

一个**独立的 React 18 控件库**：控件的 DOM 契约、行为与无障碍属性由它负责，**样式也自带**
（设计令牌 + 控件规则，打成一条 `deer-ui/styles.css`）。可用于任何像素画 / 绘图 / 工具类应用的界面，
不要求你先知道任何宿主应用。

- **包名** `deer-ui`、**版本** `0.1.0`、**许可** MIT（见 [`LICENSE`](LICENSE)）。
- **零运行时依赖**（除 `react` / `react-dom` peer）；**无构建框架**：`tsc` 出 ESM + `.d.ts`，`tsc` 不拷 CSS，
  所以 `npm run build` 是「`tsc` → 拼样式」两步。
- **源码真相只在这个仓库**：消费者（宿主应用）不得在自己的树里改副本或 `node_modules/deer-ui` —— 改控件来这里改。

> ⚠️ **裸名 `deer-ui` 在 npm 上已被别人占用**（latest `1.1.10`，作者 `bear-ui`；本机未联网复现过）。
> `name` 字段仍写着 `deer-ui`（GitHub 仓库名与 npm 包名不冲突），但**将来真要 `npm publish` 必须换名**，
> 候选是 scope 名下的 `@deerluu/deer-ui`。现在 `private: true` 已经把误发布这条路堵住，v0 **不发 npm**。

## 来源与已知消费者

deer-ui 从 **PixelCraft（像素工坊）** 的 `src/ui/` 里切出来：控件族（`Dialog` / `Form` / `primitives` /
`scrub` / `HoverTip` / `pcmode`）、标签页与下拉菜单（`tabs`）、长按与悬停提示（`tooltip`）、设计令牌与
kit 控件规则，都是**先在那个应用里长出来、再原样搬进来**的（搬运时的逐行差异见下文「P0b 落地记录」）。
PixelCraft 现在是它的**第一个消费者**，也是目前唯一的消费者；它通过 committed tarball 安装，
那份 tarball 就取自本仓库 `npm pack` 的产物。

**除这两句之外，本文档不需要你了解 PixelCraft。** 库源码里**没有**任何指向那个应用的 import、路径或回退，
库测试也不依赖它 —— 只有本仓库在的机器上就能装完、测完、构建完（见「独立安装验证」）。

---

## 安装

三种方式，任选一种：

```sh
# ① git 依赖（公开仓库）
npm i github:DeerLuuu/deer-ui

# ② 本地 tarball（v0 的主要交付形式；不需要联网）
npm pack --pack-destination .        # → deer-ui-0.1.0.tgz（prepack 会先 build + check:dist）
npm i ./deer-ui-0.1.0.tgz

# ③ 本仓库内开发
git clone <this-repo> deer-ui && cd deer-ui && npm ci
```

> **文件名差一个连字符，别记错**：npm 的 tarball 名由**包名**决定（`deer-ui-0.1.0.tgz`）；
> 面向宿主仓库时本仓库另有 `npm run pack:vendor`，产出的名字是 `deerui-0.1.0.tgz`（宿主的历史约定，
> 例如 PixelCraft 的 `file:vendor/deerui-0.1.0.tgz`）。**两者是同一份包**（装完都是 `deer-ui/`，
> 路径由 `package.json` 的 `exports` 决定，与文件名无关），`pack:vendor` 会打印 sha256。

三条要求：

1. **React 必须单实例**：`peerDependencies` 写 `react` / `react-dom` `^18.3.0`，库**不**自带 React。
   两份 React = `Invalid hook call` + `useSyncExternalStore` 订阅表分裂。宿主装 `file:` **目录**（而不是
   tarball）时，npm 会把库装成指向源目录的 junction/symlink，很容易连带出第二份 `react` —— 用 tarball 装成**真目录**就没有这个问题。
2. **消费者必须是打包器**（bundler-only）：源码里的相对 import **不带 `.js` 后缀**，`dist` 是逐文件的 ESM，
   **不发 CJS**，`package.json` 也不写 `"type": "module"`。因此 `node` / `require()` 直接吃 `dist` 会失败
   —— 消费者只允许是打包器（esbuild / vite / webpack 都行）或浏览器。
   （两条路——「源码写 `.js` 后缀」与「声明 bundler-only」——都可行，但**不能留默认**；这里明确选后者。）
3. **样式是最先加载的**：库段必须在应用自己的样式表**之前**引入（同优先级的选择器**后写的赢** —— 反过来的话，
   应用想覆写库的令牌/基础规则就得靠提高选择器权重）。见「样式与令牌」。

## 使用

```tsx
// ① 先库里那句样式，再是宿主自己的样式表：库段令牌 + 控件基础规则在前，宿主的覆写在后面
import "deer-ui/styles.css";
import "./app/style.css";

// ② JS 从子入口按需取（三个子入口互相独立，只取用得上的那个）
import { Dialog, Btn, ChipGroup, Row, Switch, Overlay, showTip } from "deer-ui/kit";
import { TabBar, DropMenu } from "deer-ui/tabs";
```

```tsx
<Dialog title="重命名" onClose={close} footer={<Btn onClick={save}>保存</Btn>}>
  <Row label="名称"><input value={name} onChange={…} /></Row>
</Dialog>
```

四条设计约定（照着写就不会「控件长得不对」）：

| 约定 | 口径 |
|---|---|
| **DOM 契约** | 控件的类名、元素层级、`role` / `aria-*` 由库决定，宿主**不要改**（改 class = 样式与引导锚点同时静默失效）。追加自定义类走 `className` / `bodyClass` |
| **主题由宿主切** | 库**不**自己判定主题：它只写两套令牌块（`:root` 与 `[data-theme="light"]`），由宿主把 `data-theme` 写到 `<html>` 上（见「主题与 CSS 变量」） |
| **PC 模式 / 安全区由宿主判** | 库**不**探测指针设备、不写 `data-pc`、不写 `--sat/--sab/--sal/--sar`：它只**消费**被推入的状态（`setKitPcMode` / `kitPcOn` 等），安全区变量只给 `env()` 兜底默认值 |
| **文案由宿主给** | 库不持有 i18n 字典，只收「键名 + 英文默认值」或直接收 props（例如 `ScrubNum` 的 `padTitle`） |

## 组件清单

四个 JS 子入口 + 一条 CSS 子路径（`package.json` 的 `exports`，`types` 条件排在 `import` 前）：

### `deer-ui/kit` — 25 个值 + 6 个类型

| 组件 / 函数 | 渲染或作用 |
|---|---|
| `Dialog` | `.dlg-mask` + `.dlg[role=dialog][aria-modal]`；`head → top → body → extra → foot` 顺序，fragment（挂载/卸载由调用方用 `<Keep>` 控制） |
| `Row` / `RowActions` | `.rowlabel` + children + 可选 `.row-note`；`.row-actions` |
| `ChipGroup<T>` | `.chips` + `.chip[.on]`（选项 `{ id, label, guide?, hidden? }`） |
| `Segmented<T>` | `.tabs` + `.tab[.on]`（同 `ChipOption` 形状） |
| `Switch` | `<button class="sw[.on]" role="switch" aria-checked>` |
| `NumberField` / `ColorField` | `Row` + `ScrubNum`；`Row` + `<input type="color">` + `.set-hex` |
| `ScrubNum` | 拖动 / 滚轮调数值（`engine/scrub` 的数学**内联**在 `src/internal/scrub.ts`） |
| `HoverTip` / `useHoverTip` / `hoverTipPos` / `hoverTipsEnabled` / `useHoverTipsEnabled` / `setHoverTipsEnabled` | PC 悬停提示 |
| `Icon` | sprite `<use href="#id">` 机制（**图标数据不在这里**，符号集属应用资源） |
| `Btn` / `Keep` / `Overlay` / `TipHost` | 按钮 / 进出场包裹 / 遮罩面板（`full` 为真时 `.panel-full` 铺满）/ 提示宿主 |
| `useBlankTap` / `useLandscape` | 空白处轻点、横竖屏布局查询 |
| `kitPcOn` / `setKitPcMode` / `useKitPcMode` | PC 模式**被推入**的状态（宿主判定后写给库） |

类型：`ChipOption` / `DialogProps` / `HoverTipApi` / `HoverTipProps` / `RowProps` / `ScrubNumProps`。

### `deer-ui/tabs` — 2 个值 + 2 个类型

`TabBar`（`.tabbar` / `.tabbar-tabs` / `.tabbar-tab` / `.tabbar-right`）、`DropMenu`（`.dropmenu*`，
下拉本体 portal + `position:fixed`，不会被 `overflow` 容器裁掉）；类型 `TabItem` / `DropOption`。

### `deer-ui/tooltip` — 3 个值 + 1 个类型

`showTip` / `hideTip` / `subscribeTip`（类型 `Tip`）。**这是模块级可变单例**（订阅表是模块级 `Set`）：
消费侧一旦同时装进两份 `tooltip`，控件写进 A 表而宿主的 `TipHost` 订阅 B 表 → 长按提示**静默消失**。
所以它由库**独占**：宿主的同名模块必须改成再导出或删掉。

### `deer-ui`（根入口）— 30 个值 + 9 个类型

只做 re-export（`index.ts` 不许写实现，A0-2 的 `kit.barrel.reexport-only` 盯着这条）：三个子入口的并集。

### `deer-ui/styles.css` — 非 JS 入口

`dist/styles.css`，**17,790 B / 92 个顶层块**（85 条规则 + 7 个 `@keyframes`，见「样式与令牌」）。

> **导出面是快照管理的**：`tests/snapshots/barrel-exports.json` 逐符号记下每个入口的公开面；
> 有意改导出面必须跑 `npm run snapshot:barrel` 并在提交信息里说明加了 / 删了 / 改了什么。
> 上面这些数字就是快照里的实测值（`./kit` = 25 值 + 6 类型、`.` = 30 值 + 9 类型）。

## 主题与 CSS 变量

- **两套主题**：令牌只在 `:root`（暗色，默认）与 `[data-theme="light"]` 两处定义，规则里不写裸色值。
  浅色块逐个覆盖主题色令牌（**77 个**），固定色令牌（画布 HUD / 状态色 / 装饰）两主题同值、**不得**在浅色块覆盖。
- **切换方式**：宿主把 `data-theme="light"` 写到 `<html>` 上即可，库**不参与判定**。推荐同时同步
  `<meta name="theme-color">`（`file://` / 移动端 WebView 下地址栏颜色才跟得上）。
- **令牌规模（实测）**：`:root` 定义 **143 个** `--*` 变量，其中**库自己的规则引用 34 个**；
  其余 109 个里 **93 个是宿主外壳域在用**（浮动球 `--orb-fg`、停靠条 `--dock-bg`、对称提示 `--sym-strong`、
  HUD `--hud-*`、引导遮罩 `--guide-shade*`、安全区 `--sat/--sab/--sal/--sar` …），**16 个当前无人引用**。
  ⇒ **这套令牌目前是超集，不是最小集**：宿主可以放心直接用这 143 个里的任何一个，但**新增令牌请加在宿主自己的
  `:root` 里**（并注意宿主 `:root` 在库段之后、会覆盖同名令牌）。库后续会把令牌收敛到它真正引用的那批，
  届时是一次**有意的**改动（要重跑令牌断言）。
- **命名规则**：`--sp-*` 间距 / `--r-*` 圆角 / `--fs-*` 字号 / `--sh-*` 阴影 / `--z-*` 层级 /
  语义色按角色命名（`--bg3`、`--text-2`、`--accent-soft`）。
- **安全区**（`--sat` / `--sab` / `--sal` / `--sar`）：库只声明 `env()` 兜底默认值，**写入者永远是宿主**
  （`notch` / 手势条 / 分屏都要按平台判定）。
- **PC 密度覆写**（`html[data-pc] .btn{…}` 那批）**不在库里**：PC 模式由宿主判定并写 `data-pc`，库不自判。

## 库自带样式（`dist/styles.css`）

**一条子路径**：`import "deer-ui/styles.css"` → `dist/styles.css`
（= `src/styles/tokens.css` + `src/styles/kit.css`，由 `scripts/build-styles.mjs` **逐字节拼接**，中间不加任何东西）。
`tsc` 不拷 CSS，所以 `npm run build` = 「`tsc` → 拼样式」两步，脚本会打印字节数与规则条数。

**内容（实测）**：**17,790 B / 92 个顶层块 = 85 条规则 + 7 个 `@keyframes`**，326 行。

**为什么是「一条子路径 + 单文件」**：`file://` 形态下每个额外请求都是真开销，而且拼接顺序（令牌 → 控件）
必须固定 —— 规则里全是 `var(--…)`，令牌必须先声明。

**唯一例外是行尾**：拼接时把行尾统一成 **LF**。仓库 `core.autocrlf=true`，Linux 检出拿 LF、Windows 检出拿 CRLF；
不归一就会让同一次提交在不同平台产出**字节不同**的 `dist/styles.css`，打出来的 tarball 也就不可复现。
归一的是行尾，不是声明 —— 规则内容逐字节不变。

### 归属与对账（怎么复核「没搬错」）

`scripts/check-dist.mjs` 钉住产物本身：非空、`:root{` 与 `[data-theme="light"]{` **各恰好一次**、无重复规则、
没有 `.demo-*`（示范页版式是 dev-only）、没有外链、且 `dist/styles.css` 与两个源文件的拼接**幂等**。

> ⚠️ **不要用数子串的办法验「某选择器在不在」**：库 CSS 里 `.btn.off` / `.dlg` / `.panel` / `.rowlabel` /
> `.panel-mask,.dlg-mask` 都是「基础规则 + 变体 / 动画」的**合法重复**，`grep -c ".dlg{"` 会数错。
> 口径是 **按「选择器 + 声明」的扁平规则多重集合**比（相等 = 视觉零变化），它也允许改顺序。

归属判定按**组件真的渲染出哪个 class** 判，不按名字像不像：

| # | 规则 |
|---|---|
| R1 | 令牌块 `:root` / `[data-theme="light"]` → **库**（kit 每条规则都靠 `var(--…)` 取色取尺寸） |
| R2 | 普通规则**整条原子**（选择器列表 + 声明块不拆）：选择器里的类名**全部**由库组件渲染 → 库；只要有一个类名只有宿主在渲染 → 留宿主 |
| R3 | 纯元素选择器：`html` / `body` / `#root` 留宿主（页面外壳）；库组件渲染的元素（`*`、`svg`、`button`、文本类 `<input>`、`canvas,svg,img,button`）→ 库 |
| R4 | `html[data-pc] …`（PC 密度覆写）→ 留宿主：PC 模式由宿主判定 |
| R5 | `@keyframes`：被进库规则的声明引用 → 库；只被宿主规则引用 → 留宿主 |
| — | `@media` 块：没有一条 `@media` 里**只**含 kit 规则 → 整块留宿主（不把规则挪出 `@media`） |

**有意的取舍（不是漏搬）**：选择器列表里混着宿主类的规则整条留宿主
（例如 `.btn,.orb,.orb-item,.chip,…{…user-select…}`）—— 拆列表就要把声明块复制成两份，属「改结构」不属「搬家」；
代价是这几条里的 kit 类仍由宿主那份样式提供，视觉不变。

## 三条 A0 机器判据（本仓库的「公开面」= 会红的东西）

| 判据 | 断言名 | 内容 |
|---|---|---|
| A0-1 纯度白名单 | `kit.purity.offenders` | `src/**` 只许依赖 `react` / `react-dom` / `react-dom/*` / `react/*` 与**库内相对路径**；相对路径必须解析得到、且**不得越出 `src/`** |
| A0-2 导出面快照 | `kit.barrel.surface` / `kit.barrel.entry.*` / `kit.barrel.reexport-only` / `kit.barrel.css-entry` | 按 `package.json` 的 `exports` 逐入口把导出面**逐符号快照**成 JSON；入口文件只许 re-export，不许写实现；非 JS 入口（`./styles.css`）单独一条判据 |
| A0-3 不得自判 PC / 主题 / 安全区 | `kit.pcmode.pushed-not-detected` / `kit.theme.host-owned` / `kit.safearea.host-owned` / `kit.host.no-storage` | 禁的是**判定性调用**：`matchMedia` 带 `pointer:` / `hover:` / `prefers-color-scheme`、写 `data-pc` / `data-theme`、写 `--sat/--sab/--sal/--sar`、`localStorage`/`sessionStorage` 全禁。**允许** `window.innerWidth/innerHeight` 的测量用法与 `(orientation: landscape)` 这类布局查询 |

三条判据都有**自检**段（把合成样本喂给扫描函数，断言「该抓的抓住、该放过的放过」）——
**空库上判据也不是恒真**的，判据本身被改坏会被自己的自检抓住。扫描前会去掉注释（保留行号），
所以「注释里提了一句 `localStorage`」不会误报。

**示范页为什么不需要豁免**：`examples/demo.tsx` 是 dev-only 示范页，它自己 `createRoot` 挂载、自己切
`data-theme` —— 那是**宿主**的活。它被放在 `src/` **之外**，而 A0-3 只扫 `src/**`；
`kit.examples.*` 四条把这件事钉住：① 它在 `src/` 之外（`src/demo.tsx` 不得存在）；
② **它的正文照样会被判据抓住**（`kit.examples.would-be-caught` —— 证明「放过」靠的是位置，不是把规则放宽）；
③ 它不进 `files`（进不了 tarball）；④ `check:dist` 另有一条「dist 里不得出现 demo」。

## 开发与调试

```sh
npm ci                 # 按 package-lock.json 装依赖（CI 与本地首选；装完即可跑下面全部命令）
npm run typecheck      # tsc -p tsconfig.json --noEmit（src，strict: true）
                       #   && tsc -p tsconfig.examples.json（示范页，它不在 src 里）
npm run build          # tsc -p tsconfig.build.json → dist/（ESM + .d.ts，逐文件，无 bundler）
                       #   && node scripts/build-styles.mjs → dist/styles.css（打印字节数/规则数）
npm test               # 编译 tests/ 到 tests/.ts-out 后运行；末两行是 assertions: 134 / ALL PASS
npm run snapshot:barrel  # 导出面**有意**变化时更新快照（必须连同提交信息一起说明）
npm run check:dist     # 构建产物自检（CI 在 build 之后跑）
npm pack               # 出 deer-ui-0.1.0.tgz（prepack 会先 build + check:dist）
npm run pack:vendor    # 再落一份宿主约定的 deerui-0.1.0.tgz 并打印 sha256（见「安装」）
```

**示范页**（dev-only，不进 `files` / 不进 `dist` / 库测试不渲染它）：`examples/demo.tsx` 一屏展示全部控件与变体、
令牌色板、暗/浅主题切换按钮；版式在 `examples/demo.css`，**它只吃库自己的样式**，不假设宿主提供
`.app-root` / `.topbar` 之类。它是「不依赖任何宿主就能看到控件长什么样」的那条路。

**目录结构**

```
src/index.ts            公开 barrel（只 re-export；A0-2 盯着它）
src/kit/                控件族 7 个文件（index.ts 是 barrel）
src/tabs.tsx            TabBar / DropMenu
src/tooltip.ts          showTip / hideTip / subscribeTip（库独占）
src/internal/expr.ts    内联的算式求值（文件头有出处与防分叉说明）
src/internal/scrub.ts   内联的拖动/滚轮数值数学
src/styles/tokens.css   设计令牌（:root + [data-theme="light"]）
src/styles/kit.css      只属于 kit 的控件规则
examples/demo.tsx       dev-only 示范页（不进 barrel / files / dist）
scripts/                tsc 查找、样式拼接、dist 自检、打包、离线应急
tests/                  A0 三条判据（含自检段）+ 控件 DOM 契约 + 样式归属 + 预算闸门
tests/snapshots/barrel-exports.json  ★ 导出面快照（改导出面必须显式更新）
```

**测试基建的三处有意选择**：① `tests/tsconfig.json` 的 `include` 用 glob（不抄宿主的 60 条显式清单）；
② **不引 jsdom / vitest / puppeteer** —— 控件契约走 `react-dom/server` 的 `renderToStaticMarkup` +
静态扫描 + 自写 runner，输出末尾必须是 `assertions: N` 与 `ALL PASS` 两行；③ `src` 用 `strict: true`、
`tests` 用 `strict: false`（测试要能吃下从宿主搬来的既有文件）。两处都写死 `"jsx": "react-jsx"`。

## 断言台账与预算闸门

| 项 | 条数 | 说明 |
|---|---|---|
| `ui.*` 控件 DOM 契约 | **62** | 从宿主逐字搬来：名字一条没改、条件一条没削 |
| `kit.*` + `lib.*`（A0-1/2/3 + 测试基建 + 样式归属 + 预算闸门） | **72** | 库自己的判据与基建 |
| **运行期断言合计**（= 预算闸门下限） | **134** | 62 + 72，只许涨 |

`tests/budget.test.ts` 钉的是**库自己的两个下限**（`ui.*` ≥ 62 与 `kit.*`+`lib.*` ≥ 61，**分开判** ——
总数会掩盖「基建长胖、控件契约变少」）；**宿主侧的账不在这个仓库**（宿主自己收，库不得反向依赖宿主仓库）。

## 依赖与工具链

**首选 `npm ci`**：仓库里有 `package-lock.json`（联网 `npm install` 生成并入库），照着它装即可 ——
不需要本机另外准备 `node_modules`，也不需要**平级宿主检出**。库必须能在只有这一个仓库的机器上装完、
测完、构建完（CI 与「独立安装验证」跑的都是这条）。

1. **tsc 从哪儿来** —— `scripts/tsc.mjs` 按顺序找一个能用的 tsc，并在 stderr 打印用的是哪一个：
   ① 本仓库 `node_modules/typescript/lib/tsc.js` → ② 环境变量 `$DEERUI_TSC`。
   （别照抄某些脚本里那条 `node_modules/typescript/bin/tsc.js`：真路径在 `lib/tsc.js`，`bin/tsc` 只是无扩展名的 shell 包装。）
2. **react / @types 从哪儿来** —— 同样来自 `npm ci`。**真的没网**时才用离线应急口子：
   `DEERUI_DEPS_SOURCE=<某个已装好的 node_modules> npm run link:devdeps`
   （把里面的 `typescript` / `react` / `react-dom` / `scheduler` 等以 **junction** 链进本仓库的 `node_modules/`；
   `node_modules/` 已被 `.gitignore` 忽略，不进提交）。
   **来源必须显式给**：早先它默认去链平级宿主仓库的 `node_modules`，那是一条**隐式的邻居依赖**，已删除
   （不设 `DEERUI_DEPS_SOURCE` 直接报错退出）。链过去的是同一份物理文件，顺带满足「React 单实例」，
   但它**不是**一次真安装（不写 lockfile、不校验 integrity），只配当应急手段。

## CI

`.github/workflows/ci.yml`（真文件，不是示例）：`npm ci` → `typecheck` → `build` → `test` → `check:dist`。

有 `package-lock.json`，所以走 `npm ci`：装上的是锁里那一份（版本 + integrity 都核），不受「今天 registry 上是哪个版本」
影响。CI 里**没有、也不需要**任何宿主仓库在场 —— 这正是「库能独立安装与运行」这条地基的机器判据。

> 若推送改动时 GitHub 报 token 缺 `workflow` scope（`.github/workflows/` 下的文件需要它），
> 临时把本文件改名为 `.github/ci.yml.example` 再推即可 —— 内容一个字不用改，等换一把有该 scope 的
> 凭据再推回去（先例：本仓库提交 `bce2647`）。

## 独立安装验证（无宿主仓库在场）

把库复制到一个**没有宿主仓库**的目录（排除 `node_modules/` 与 `.git/`），在那里跑：

```sh
npm install        # 联网真装（node_modules/react 是真目录，不是指向别处的 junction）
npm test           # assertions: 134 / ALL PASS
npm run build      # dist/（ESM + .d.ts + dist/styles.css）
npm run check:dist # 产物自检：OK（含 styles.css 的字节数与规则数）
```

四条全绿才算过；任何残留的 `../<某个宿主>/...` 回退（`scripts/tsc-path.mjs` 与 `scripts/link-dev-deps.mjs`
里曾各有一条）都会在这种目录里当场暴露。库侧 `node_modules/` **必须**是真目录 —— 用 junction 链别处的安装树
会让「React 单实例」看起来满足，实际是两个仓库被悄悄绑在一起。

## 有意偏离与已知缺口

**相对宿主仓库的三处有意偏离**（都在上文重复过，这里集中列一次）：

1. `tests/tsconfig.json` 的 `include` 用 glob，不用显式清单；`rootDir` 指向库根，运行路径是
   `node tests/.ts-out/tests/run-tests.js`。
2. 不引 jsdom / vitest（宿主历史 UI bug 全是**布局类**，jsdom 没有布局 —— 引它换来「能跑事件」的错觉却抓不到真 bug）；
   控件契约走 `renderToStaticMarkup` + 静态扫描。
3. `src` strict、`tests` 非 strict。

**已知缺口（别让它们消失）**：

- **令牌是超集**（143 定义 / 34 被库引用）：见「主题与 CSS 变量」，收敛是一次有意的改动。
- **公开组件 `Keep` 至今零直接断言**；`ScrubNum` 的键盘 / 指针路径、`tabs` 的滚动 / portal 行为**没有黄金 md5 兜底**。
  当前的行为保证来自「库源码与宿主 HEAD 逐字节同一 + `dist` 是 `src` 的忠实产物 + 注入负例」，证不到这三处细节。
- **三端兼容（`file://` / 旧 WebView）只能静态守**：本机没有 Android 设备，不许以「已核」口吻写进度。
- **React 只测过 18.3.1**（peer 写 `^18.3.0`）。
- **发布面尚未定型**：不发 npm、不提供 `./sprite.svg`（图标数据属宿主资源）。

## 打包与消费（给宿主维护者）

```sh
# 本仓库
npm run pack:vendor                  # → deerui-0.1.0.tgz（同时产出 npm 自己命名的 deer-ui-0.1.0.tgz，脚本清掉中间那份）
# 宿主仓库
#   cp deerui-0.1.0.tgz <app>/vendor/
#   npm i file:vendor/deerui-0.1.0.tgz
```

`files` 只收 `dist` / `LICENSE` / `README.md`；`tests/`、`scripts/`、`examples/`、`.github/` 都不进包。
`sideEffects: ["*.css"]`**不是** `false`：样式块是有副作用的（`examples/demo.css` 是 dev-only，不在 `files` 里）。

> **给宿主的提醒（本仓库踩过的坑）**：宿主把库升到「同一个版本号、不同内容」的 tarball 时，
> npm 可能**从缓存**拿出旧包 —— 装完 `node_modules/deer-ui` 里仍然没有新文件，而版本号看起来没变。
> 破解：先改 lock 里 `deer-ui` 的 `integrity`（或删掉 `node_modules/deer-ui` 再装），并**核对装出来的
> `node_modules/deer-ui/dist/styles.css` 与库仓库 `dist/styles.css` 逐字节相同**。宿主侧的 `deer-ui`
> 文件面（`exports` 有没有 `./styles.css`）是「装的是新包还是旧包」最直接的判据。

## 附：P0b 落地记录（搬运时的逐行差异）

控件族是**按字节**从 PixelCraft 复制进来的，然后只做「import 路径 + 必要的类型引用」改动。
逐行核对（行尾归一后）：

| 库内文件 | 相对来源 | 改了什么 |
|---|---|---|
| `src/kit/{primitives,Dialog,Form,HoverTip,pcmode,index}.tsx/ts`、`src/tabs.tsx`、`src/tooltip.ts` | **逐行相同** | 无 |
| `src/kit/scrub.tsx` | 差 **2 行** | `../../engine/expr` → `../internal/expr`；`../../engine/scrub` → `../internal/scrub` |
| `examples/demo.tsx` | 差 **1 行** | `./index` → `../src/index`（它从 `kit/` 挪到了 `examples/`） |
| `src/internal/{expr,scrub}.ts` | 多 **5 行**头部 | 出处注释 + 「库不得反向 import 宿主 / 防分叉」说明；其余 87 / 60 行逐行相同 |

`src/internal/*` 是**内联副本**（`engine/{expr,scrub}` 两个纯函数），不是「引宿主的包」——
接受这份重复是为了库不产生任何反向依赖。

**行尾陷阱（实测）**：宿主仓库 `core.autocrlf=true` 且没有 `.gitattributes`，所以宿主**工作区**文件是 **CRLF**、
而本仓库骨架阶段新建的文件是 LF。从宿主拷文件进来**不必手工转 LF**（`git add` 按 `text=auto` 归一成 LF 入库，
与宿主 blob 一致），但**别拿两个工作区的字节直接比**（CRLF vs LF 会假红）。本仓库**生成的样式产物统一 LF**
（见「库自带样式」）。

**还没收掉的一处注释级残留**：`src/kit/primitives.tsx` 与 `dist/kit/primitives.js` 里各留着一句
「实现住在宿主的 `src/ui/kit`」的过时注释（搬运时就带着）。属注释级、不影响行为，改它要重出一次 tarball，
登记待收（连同宿主侧 `src/ui/base.tsx:3` 的同一句）。

## 许可

MIT（[`LICENSE`](LICENSE)，版权行 `Copyright (c) 2026 DeerLuuu`），与 `package.json` 的 `"license": "MIT"` 一致。
