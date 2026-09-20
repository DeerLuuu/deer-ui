# deer-ui

一个**独立的 React 18 控件库**。控件的 DOM 契约、行为与无障碍属性由它负责，**样式也自带**
（设计令牌 + 控件规则，打成一条 `deer-ui/styles.css`）。适用于像素画 / 绘图 / 工具类应用的界面。

- **公开仓库**：<https://github.com/DeerLuuu/deer-ui>（public，MIT）
- **零运行时依赖**：`react` / `react-dom` 只是 peer，**不带** React
- **无构建框架**：`tsc` 出逐文件产物（ESM + `.d.ts`，以及第二次 `tsc` 出的 CJS），不引 bundler；
  `tsc` 不拷 CSS，所以 `build` 是「两遍 `tsc` → 拼样式」
- **未发 npm**：`private: true`，v0 只以 tarball / git 依赖交付（原因见「发布面」）
- **源码真相只在这个仓库**：宿主不得在自己的树里改副本或 `node_modules/deer-ui` —— 改控件来这里改

> 它的血缘是某个像素工具的 `src/ui/`，但**这个库不依赖、也不需要你了解那个应用**：
> `src/**` 里没有任何指向它的 import、路径或回退，测试也不碰它。
> 只有这一个仓库的机器就能装完、测完、构建完。

---

## 安装

```sh
# ① git 依赖（公开仓库）
npm i github:DeerLuuu/deer-ui

# ② 本地 tarball（v0 的主要交付形式；不需要联网）
npm pack --pack-destination .        # → deer-ui-0.1.0.tgz（prepack 会先 build + check:dist）
npm i ./deer-ui-0.1.0.tgz

# ③ 本仓库内开发
git clone https://github.com/DeerLuuu/deer-ui.git deer-ui && cd deer-ui && npm ci
```

**三条路都会先构建再交付 —— 因为 `dist/` 不入库**（`.gitignore` 里有 `dist/`；仓库树里没有一行**构建产物** JS/CSS ——
有的只是手写源码：`src/styles/*.css` / `examples/demo.css` / `scripts/*.mjs`）：

| 路 | 谁负责构建 |
|---|---|
| ① git 依赖 | npm 克隆后先装**这个 git 包自己的 devDependencies**、再跑 `prepare`（= `npm run build`），**然后**才把它装进 `node_modules/deer-ui`。`package.json` 里的 `"prepare": "npm run build"` 就是为这条存在的 |
| ② tarball | `npm pack` / `npm publish` 前的 `prepack`（= `build` + `check:dist`） |
| ③ 本仓库内开发 | `npm ci` / `npm install` 也会跑一次 `prepare`，所以装完 `dist/` 就已经有了 |

> **`prepare` 会在本地 `npm install` / `npm ci` 时也跑一遍 build**。这是「产物不入库」的库仓库的正常形态，
> 不是缺陷；重复跑是幂等的（`tsc` 与 `build-styles.mjs` 只覆盖 `dist/`）。

> ⚠️ **别在库仓库自己的树上跑 `npm ci --omit=dev`**：`prepare` 要 `typescript`（devDependency），
> 省掉 dev 依赖它就直接红（退出码 2，`[deer-ui] 找不到可用的 tsc…`）。
> **消费者项目里 `--omit=dev` 没问题** —— 为 git 依赖装 devDependencies 是 npm 自己的行为。

### 三条硬要求

1. **React 必须单实例**：`peerDependencies` 写 `react` / `react-dom` `^18.3.0`。
   两份 React = `Invalid hook call` + `useSyncExternalStore` 订阅表分裂。
   宿主装 `file:` **目录**（而非 tarball）时 npm 可能装成指向源目录的 symlink，容易连带出第二份 `react`；装成**真目录**没有这个问题。
2. **同时提供 ESM 与 CJS 两份产物**（双格式）：`exports` 的每个 JS 子入口都给出
   `{ types, import, require }` 三个条件（`types` 必须排第一）。相对 import **带 `.js` 后缀**，
   `dist/` 是 ESM 树、`dist/cjs/` 是 CJS 树，两棵树各带一份作用域 `package.json`
   （`{"type":"module"}` / `{"type":"commonjs"}`）。所以**原生 `node` 也能直接用**：

   ```sh
   node -e "console.log(Object.keys(require('deer-ui')).length)"          # → 30
   node --input-type=module -e "import('deer-ui').then(m=>console.log(Object.keys(m).length))"   # → 30
   ```

   ⚠️ **一个应用只用一种格式**：`tooltip` / `pcmode` 是模块级单例，CJS 与 ESM 各有一份实例，
   混用会让订阅表分裂、长按提示**静默消失**。检测办法：
   `require('deer-ui/kit').setKitPcMode === (await import('deer-ui/kit')).setKitPcMode` 为 `false` 即中招。
   打包器不会混用；只有同一工程里既有 `require` 又有 `import` 同一子入口时才需要留意。
3. **样式是最先加载的**：库段必须在应用自己的样式表**之前**引入。同优先级的选择器**后写的赢**；
   反过来的话，应用想覆写库的令牌/基础规则就得靠提高选择器权重。

> **库不发 `"use client"`（Next.js App Router 消费者必读）**：在 `src/**` 里搜不到这条指令 —— 这是**静态事实**
> （不是「已经在 Next.js 上验过」）。`Dialog` / `DropMenu` / `ScrubNum` 这些控件用了 hooks 与事件处理器
> （`onClick` / `onPointerDown` …），而 App Router 的**服务端组件**不允许用这些，所以**不能**在服务端组件里
> 直接 `import` 后渲染它们（Next.js 会在构建期报错）。消费侧要自己划客户端边界：写一层带 `"use client"` 的
> 包装组件，在包装里 `import { Dialog } from "deer-ui/kit"`，再由服务端组件渲染这个包装。
>
> 这里**只**声明这条静态事实，**不**声明「已验证支持 SSR」：本仓库的测试用 `renderToStaticMarkup`
> （**不执行 effects**），SSR 运行时路径在本仓库**不可机检** —— 这也是冻结口径里那条「SSR 下
> `useLayoutEffect` 会不会抛」只被裁定为**存疑**、没有列进本轮修复的原因（`docs/REQUIREMENTS-freeze.md`
> §3.1 的 BUG-6 与 §3.3）。

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

### 四条设计约定

照着写就不会「控件长得不对」：

| 约定 | 口径 |
|---|---|
| **DOM 契约** | 控件的类名、元素层级、`role` / `aria-*` 由库决定，宿主**不要改**（改 class = 样式与引导锚点同时静默失效）。追加自定义类走 `className` / `bodyClass` |
| **主题由宿主切** | 库**不**自己判定主题：它只写两套令牌块（`:root` 与 `[data-theme="light"]`），由宿主把 `data-theme` 写到 `<html>` 上 |
| **PC 模式 / 安全区由宿主判** | 库**不**探测指针设备、不写 `data-pc`、不写 `--sat/--sab/--sal/--sar`：它只**消费**被推入的状态（`setKitPcMode` / `kitPcOn` 等） |
| **文案由宿主给** | 库不持有 i18n 字典，只收「键名 + 英文默认值」或直接收 props（例如 `ScrubNum` 的 `padTitle`） |

### 两个「不给就静默坏」的隐式依赖

这两处不满足时**不报错**，只是看不见效果——排查时先想它们：

| 组件 | 依赖 | 症状 |
|---|---|---|
| `Icon` | `<use href="#id">` 指向的 **sprite 符号集属宿主资源**，库不发图标数据 | 图标整片空白 |
| `TipHost` + `deer-ui/tooltip` | 宿主必须挂**恰好一个** `TipHost`，且 `deer-ui/tooltip` 是**模块级单例** | 长按提示静默消失 |

> **单例的坑**：宿主若同时装进两份 `tooltip` 模块，控件写进 A 表的订阅、宿主的 `TipHost` 订阅 B 表 →
> 提示永远不显示。宿主里同名的模块必须改成再导出或删掉。

## 组件清单

四个 JS 子入口 + 一条 CSS 子路径（定义在 `package.json` 的 `exports`，`types` 条件排在 `import` 前）。
下面每个入口的符号数都是 `tests/snapshots/barrel-exports.json` 里的**实测值**。

### `deer-ui/kit` — 25 个值 + 6 个类型

| 组件 / 函数 | 渲染或作用 |
|---|---|
| `Dialog` | `.dlg-mask` + `.dlg[role=dialog][aria-modal]`；`head → top → body → extra → foot` 顺序，**渲染 fragment**（挂载/卸载由调用方用 `<Keep>` 控制） |
| `Row` / `RowActions` | `.rowlabel` + children + 可选 `.row-note`；`.row-actions` |
| `ChipGroup<T>` | `.chips` + `.chip[.on]`（选项 `{ id, label, guide?, hidden? }`） |
| `Segmented<T>` | `.tabs` + `.tab[.on]`（同 `ChipOption` 形状） |
| `Switch` | `<button class="sw[.on]" role="switch" aria-checked>` |
| `NumberField` / `ColorField` | `Row` + `ScrubNum`；`Row` + `<input type="color">` + `.set-hex` |
| `ScrubNum` | 拖动 / 滚轮调数值，支持算式输入（数学内联在 `src/internal/scrub.ts` / `expr.ts`） |
| `HoverTip` / `useHoverTip` / `hoverTipPos` / `hoverTipsEnabled` / `useHoverTipsEnabled` / `setHoverTipsEnabled` | PC 悬停提示 |
| `Icon` | sprite `<use href="#id">` 机制（**图标数据不在这里**，符号集属宿主资源） |
| `Btn` / `Keep` / `Overlay` / `TipHost` | 按钮 / 进出场包裹 / 遮罩面板（`full` 为真时 `.panel-full` 铺满）/ 提示宿主 |
| `useBlankTap` / `useLandscape` | 空白处轻点、横竖屏布局查询 |
| `kitPcOn` / `setKitPcMode` / `useKitPcMode` | PC 模式**被推入**的状态（宿主判定后写给库） |

类型：`ChipOption` / `DialogProps` / `HoverTipApi` / `HoverTipProps` / `RowProps` / `ScrubNumProps`。

### `deer-ui/tabs` — 2 个值 + 2 个类型

`TabBar`（`.tabbar` / `.tabbar-tabs` / `.tabbar-tab` / `.tabbar-right`）、
`DropMenu`（`.dropmenu*`，下拉本体 portal + `position:fixed`，不会被 `overflow` 容器裁掉）；
类型 `TabItem` / `DropOption`。

### `deer-ui/tooltip` — 3 个值 + 1 个类型

`showTip` / `hideTip` / `subscribeTip`（类型 `Tip`）。**模块级可变单例**，见上文「隐式依赖」。

### 产物形态（两棵树）

| 树 | 位置 | 内容 |
|---|---|---|
| ESM | `dist/*.js` + `dist/*.d.ts` | `exports` 的 `import` 条件指这里；类型声明只在这一棵 |
| CJS | `dist/cjs/*.js` | `exports` 的 `require` 条件指这里 |
| 样式 | `dist/styles.css` | 两棵树共用这一份（不在 `dist/cjs/` 里重复） |

两棵树各自带一份**作用域** `package.json`（`dist/package.json` = `{"type":"module"}`、
`dist/cjs/package.json` = `{"type":"commonjs"}`），由 `scripts/build-styles.mjs` 在构建收尾时写出并确认进包。
根 `package.json` **有意不写 `type` 字段** —— 加了会把 `tests/.ts-out/*.js` 这批 CJS 产物当 ESM 炸掉。

### `deer-ui`（根入口）— 30 个值 + 9 个类型

只做 re-export（`index.ts` 不许写实现，A0-2 的 `kit.barrel.reexport-only` 盯着这条）：三个子入口的并集。
**四种模块格式各一套**：上面五个入口（4 个 JS + 1 个 CSS）在 `require` 与 `import` 两条路径下都能解析。

### `deer-ui/styles.css` — 非 JS 入口

`dist/styles.css`，**17,790 B / 92 个顶层块**（85 条规则 + 7 个 `@keyframes`），326 行。

> **导出面是快照管理的**：`tests/snapshots/barrel-exports.json` 逐符号记下每个入口的公开面；
> 有意改导出面必须跑 `npm run snapshot:barrel`，并在提交信息里说明加了 / 删了 / 改了什么。

## 样式与令牌

一条子路径：`import "deer-ui/styles.css"` → `dist/styles.css`
（= `src/styles/tokens.css` + `src/styles/kit.css`，由 `scripts/build-styles.mjs` **逐字节拼接**，中间不加任何东西）。

**为什么是「一条子路径 + 单文件」**：`file://` 形态下每个额外请求都是真开销，而且拼接顺序（令牌 → 控件）
必须固定 —— 规则里全是 `var(--…)`，令牌必须先声明。

- **两套主题**：令牌只在 `:root`（暗色，默认）与 `[data-theme="light"]` 两处定义，规则里不写裸色值。
  浅色块逐个覆盖主题色令牌（**77 个**）；固定色令牌（画布 HUD / 状态色 / 装饰）两主题同值、**不得**在浅色块覆盖。
- **切换方式**：宿主把 `data-theme="light"` 写到 `<html>` 上即可，库**不参与判定**。推荐同时同步
  `<meta name="theme-color">`（`file://` / 移动端 WebView 下地址栏颜色才跟得上）。
- **令牌规模（实测）**：`:root` 定义 **143 个** `--*` 变量，其中**库自己的规则引用 34 个**；
  余下 109 个里绝大多数是宿主外壳域在用（浮动球 `--orb-fg`、停靠条 `--dock-bg`、HUD `--hud-*`、
  引导遮罩 `--guide-shade*`、安全区 `--sat/--sab/--sal/--sar` …）。
  ⇒ **这套令牌目前是超集，不是最小集**：宿主可以放心直接用这 143 个里的任何一个，但**新增令牌请加在宿主自己的
  `:root` 里**（注意宿主 `:root` 在库段之后、会覆盖同名令牌）。库后续会把令牌收敛到它真正引用的那批，
  届时是一次**有意的**改动（要重跑令牌断言）。
- **命名规则**：`--sp-*` 间距 / `--r-*` 圆角 / `--fs-*` 字号 / `--sh-*` 阴影 / `--z-*` 层级 /
  语义色按角色命名（`--bg3`、`--text-2`、`--accent-soft`）。
- **安全区**（`--sat` / `--sab` / `--sal` / `--sar`）：库只声明 `env()` 兜底默认值，**写入者永远是宿主**。
- **PC 密度覆写**（`html[data-pc] .btn{…}` 那批）**不在库里**：PC 模式由宿主判定并写 `data-pc`。

### 行尾与打包可复现

**唯一一处归一化是行尾**：拼接时统一成 **LF**。仓库 `core.autocrlf=true`，Linux 检出拿 LF、Windows 检出拿 CRLF；
不归一就会让同一次提交在不同平台产出**字节不同**的 `dist/styles.css`，打出来的 tarball 也就不可复现。
归一的是行尾，不是声明 —— 规则内容逐字节不变。

库根 `.gitattributes` 里**生效的指令只有一行**：`* text=auto eol=lf`（其余 12 行是解释它的注释），
让**任何平台、任何一次克隆**检出的文本文件都是 LF。
这不是洁癖：`npm pack` / `pack:vendor` 打的是**工作区文件的快照**，只要工作区行尾随平台变，
同一个 commit 就会打出不同的 tarball —— 差异就是 `LICENSE` / `README.md` / `package.json` 里的 `\r`
（几十个字节量级）。

> 这里**故意不写具体字节数**：`README.md` 自己就进包（`files` 含 `README.md`），所以任何一次 README
> 改动都会让「某个 tarball 多少字节」这条数字**必然过期、永远追不上**。要字节/指纹的地方是
> `npm run pack:vendor` 的**输出**（它每次打印实打实的三条指纹），不是 README 里钉死的常量。

## 开发与调试

```sh
npm ci                 # 按 package-lock.json 装依赖（CI 与本地首选）；装完会顺带跑一次 prepare（= build）
npm run typecheck      # tsc -p tsconfig.json --noEmit（src，strict: true）
                       #   && tsc -p tsconfig.examples.json（示范页，它不在 src 里）
npm run build          # 两遍 tsc：ESM + .d.ts 进 dist/，CJS 进 dist/cjs/（逐文件，无 bundler）
                       #   && node scripts/build-styles.mjs → dist/styles.css（打印字节数/规则数）
npm test               # 编译 tests/ 到 tests/.ts-out 后运行；末两行是 assertions: 143 / ALL PASS
npm run snapshot:barrel # 导出面**有意**变化时更新快照（必须连同提交信息一起说明）
npm run check:dist     # 构建产物自检（CI 在 build 之后跑）
npm pack               # 出 deer-ui-0.1.0.tgz（prepack 会先 build + check:dist）
npm run pack:vendor    # 再落一份宿主约定的 deerui-0.1.0.tgz，并打印进包文件数与 bytes/md5/sha256
```

### 目录结构

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
tests/                  A0 三条判据（A0-1/A0-3 带自检段）+ 控件 DOM 契约 + 样式归属 + 预算闸门
tests/snapshots/barrel-exports.json  ★ 导出面快照（改导出面必须显式更新）
```

### 三条 A0 机器判据（本仓库的「公开面」= 会红的东西）

| 判据 | 断言名 | 内容 |
|---|---|---|
| A0-1 纯度白名单 | `kit.purity.offenders` | `src/**` 只许依赖 `react` / `react-dom` 家族与**库内相对路径**；相对路径必须解析得到、且**不得越出 `src/`** |
| A0-2 导出面快照 | `kit.barrel.surface` / `kit.barrel.entry.*` / `kit.barrel.reexport-only` / `kit.barrel.css-entry` | 按 `exports` 逐入口把导出面**逐符号快照**成 JSON；入口文件只许 re-export；非 JS 入口单独一条判据 |
| A0-3 不得自判 PC / 主题 / 安全区 | `kit.pcmode.pushed-not-detected` / `kit.theme.host-owned` / `kit.safearea.host-owned` / `kit.host.no-storage` | 禁**判定性调用**：`matchMedia` 带 `pointer:` / `hover:` / `prefers-color-scheme`、写 `data-pc` / `data-theme`、写 `--sat/--sab/--sal/--sar`、`localStorage`/`sessionStorage` 全禁。**允许** `window.innerWidth/innerHeight` 的测量用法与 `(orientation: landscape)` 这类布局查询 |

三条判据里 **A0-1 与 A0-3 带自检段**（把合成样本喂给扫描函数，断言「该抓的抓住、该放过的放过」）——
**空库上判据也不是恒真**的，判据本身被改坏会被自己的自检抓住。扫描前会去掉注释（保留行号），
所以「注释里提了一句 `localStorage`」不会误报。

> ⚠️ **A0-2 没有自检段，而且它认不出类型级再导出**：`tests/scan.ts` 的 re-export 正则只匹配裸
> `export * from "…"`（以及 `export * as ns from "…"`），`export type * from "…"` 这种**类型级**再导出
> 既不进快照、也不被判据看见。所以「公开导出面冻结」这条不变量目前有一个**已知可见性缺口**：
> 用 `export type * from` 往公开面里塞类型，不会有任何断言变红（登记见 `CHANGELOG.md` 的「本轮登记但不实施」F-4）。

**示范页为什么不需要豁免**：`examples/demo.tsx` 是 dev-only 示范页，它自己 `createRoot` 挂载、自己切
`data-theme` —— 那是**宿主**的活。它被放在 `src/` **之外**，而 A0-3 只扫 `src/**`；
`kit.examples.*` 四条把这件事钉住：① 它在 `src/` 之外（`src/demo.tsx` 不得存在）；
② **它的正文照样会被判据抓住**（`kit.examples.would-be-caught` —— 证明「放过」靠的是位置，不是把规则放宽）；
③ 它不进 `files`（进不了 tarball）；④ `check:dist` 另有一条「dist 里不得出现 demo」。

### 断言台账与预算闸门

| 项 | 现值 | 预算下限 | 说明 |
|---|---|---|---|
| `ui.*` 控件契约（DOM 契约 + 源码级 / 生命周期级判据） | **71** | **62** | 其中 62 条是从宿主逐字搬来的 DOM 契约（名字一条没改、条件一条没削），9 条是为本轮三条已确认 bug 补的回归断言与同族护栏 |
| `kit.*` + `lib.*`（A0-1/2/3 + 测试基建 + 样式归属 + 预算闸门） | **72** | **72** | 库自己的判据与基建 |
| **运行期断言合计**（= `npm test` 末行 `assertions:`） | **143** | **134** | 71 + 72 与 62 + 72；只许涨 |

`tests/budget.test.ts` 钉的是**库自己的两个下限**（`ui.*` ≥ 62 与 `kit.*`+`lib.*` ≥ 72，**分开判** ——
总数会掩盖「基建长胖、控件契约变少」）。下限**不跟着现值涨**：涨停的下限会在下一次正常加断言时逼人改闸门，
也就失去了「只许涨」的告警意义（本轮 134 → 143，三道下限一处没动）。

### 测试基建的三处有意选择

1. `tests/tsconfig.json` 的 `include` 用 glob，不用显式清单；`rootDir` 指向库根，运行路径是
   `node tests/.ts-out/tests/run-tests.js`。
2. **不引 jsdom / vitest / puppeteer** —— 控件契约走 `react-dom/server` 的 `renderToStaticMarkup` +
   静态扫描 + 自写 runner，输出末尾必须是 `assertions: N` 与 `ALL PASS` 两行。
   （理由：历史 UI bug 全是**布局类**，jsdom 没有布局 —— 引它换来「能跑事件」的错觉却抓不到真 bug。）
   本轮为 effect 生命周期又加了一个**极小的 effect 运行器**（`tests/ui-hooks.test.tsx`）：在
   `renderToStaticMarkup` + `tests/dom-stub.ts` 之上手动跑 effect 与它返回的 cleanup，
   **仍然不是渲染器**（不解析布局、不派发 React 合成事件），也**不引 jsdom**；用完必须还原。
3. `src` 用 `strict: true`、`tests` 用 `strict: false`。两处都写死 `"jsx": "react-jsx"`。

## 这个版本验证到了哪一步

**已经验过（本机实测，可复现）**：

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | exit 0（src strict + 示范页） |
| `npm test` | `assertions: 143` / `ALL PASS`（预算下限 134 = 62 + 72，未动） |
| `npm run build` | `dist/` **39 个文件**（ESM 树 + `dist/cjs/` CJS 树，两棵树各带作用域 `package.json`）；`styles.css` **17,790 B / 92 条规则** |
| `npm run check:dist` | OK |
| 原生加载 | `require('deer-ui')` → 30 个导出；`import('deer-ui')` → 30 个导出；`require('deer-ui/kit')` → 25 |

**其中一部分有公网机器判据**：GitHub Actions 工作流 `ci`（`.github/workflows/ci.yml`）在
`master` 上跑过并 `success`。⚠️ 截至 **`9fa9de3` 为止全仓库只触发过 1 次运行** —— 此前工作流文件
曾被改名为 `.github/ci.yml.example`（提交 `bce2647`）而不被 GitHub 识别，直到 `b0f259a` 恢复。
**所以历史提交并没有得到过公网 CI 的验证。** CI 流水线是：
`npm ci` → `typecheck` → `build` → `test` → `check:dist`。
（`npm ci` 自己会跑一次 `prepare`（= build），所以这条流水线里 build 实际跑了两遍；幂等。）

CI 里**没有、也不需要**任何宿主仓库在场 —— 这正是「库能独立安装与运行」这条地基的机器判据。

**独立安装验证（无宿主仓库在场）**：把库复制到一个**没有宿主仓库**的目录（排除 `node_modules/` 与 `.git/`），
在那里跑 `npm install` → `npm test` → `npm run build` → `npm run check:dist`，四条全绿才算过。
任何残留的 `../<某个宿主>/...` 回退都会在这种目录里当场暴露。

## 已知缺口（别让它们消失）

- **令牌是超集**（143 定义 / 34 被库引用）：见「样式与令牌」，收敛是一次有意的改动。
- **公开组件零直接断言的不止两个**：实测是 **12 个** —— `Keep` · `TipHost` · `useBlankTap` ·
  `useLandscape` · `TabBar` · `showTip` · `hideTip` · `subscribeTip` · `setKitPcMode` · `kitPcOn` ·
  `useKitPcMode` · `useHoverTipsEnabled`。（更早的盘点列出 14 个，含 `Overlay` 与 `DropMenu`；
  那两个在本轮修 BUG-1 时已补上断言：`ui.overlay-full` 与 3 条 `ui.dropmenu.*`。）
  `ScrubNum` 的键盘 / 指针路径、`tabs` 的滚动 / portal 行为**没有黄金 md5 兜底**。当前的行为保证来自
  「源码与宿主 HEAD 逐字节同一 + `dist` 是 `src` 的忠实产物 + 注入负例」，证不到这几处细节。
- **公开导出面判据对类型级再导出不可见**：`tests/scan.ts` 的 `reStar` 只匹配裸 `export * from`，
  识别不了 `export type * from "…"`。后果：往 `src/kit/index.ts` 加一行 `export type * from "./secret"`
  再跑 `snapshot:barrel`，会 `ALL PASS` 而快照不变，但消费者能 `import type { SecretApi } from "deer-ui/kit"`
  成功。**A0-2 也是三条 A0 判据里唯一没有自检段的**。修法与已验证的补丁草稿见
  [`docs/NEXT-round-B.md`](docs/NEXT-round-B.md) §1。
- **混用两种模块格式会让单例分裂**：见上文「三条硬要求」第 2 条。`tooltip` / `pcmode` 是模块级单例，
  CJS 与 ESM 是两份实例，同一工程里混用同一子入口会让长按提示**静默消失**（无任何报错）。
  库侧目前没有运行时检测，只有上面那条 `===` 比较可以自检。
- **无障碍只做了一半**：`Dialog` 有 `role="dialog"` + `aria-modal`，但**没有焦点陷阱、不开焦点、关闭后不归还焦点**；
  遮罩不是 portal；`TipHost` 的提示没有 `aria-live`。
- **三端兼容（`file://` / 旧 WebView）只能静态守**：本机没有 Android 设备，不许以「已核」口吻写进度。
- **React 只测过 18.3.1**（peer 写 `^18.3.0`）。
- **发布面尚未定型**：不发 npm、不提供 sprite 资源（图标属宿主资源）。
- **样式归属判据比它读起来弱**：`kit.styles.kit-classes-owned` 只证明 `kit.css` 里出现的 class
  在库源码的**字符串字面量**里出现过；一条注入了 `display:none` 的 `.dlg` 规则能过。类名拼错 / 规则漏写
  目前**没有机器兜底**。
- **预算闸门钉的是断言「条数」不是覆盖率**：涨条数不会自动带来覆盖。实测过的作弊路径：
  「删 5 条真断言 + 插 5 条 `ui.filler`」能让 `assertions:` 与三道下限原值维持、闸门全绿。
  防它只能靠与 HEAD 版逐符号 diff 确认 `REMOVED=[]`（本轮就是这么复核的）。
- **A0-1 的 `escape` 判定依赖目标文件真实存在**：`resolveSpec` 要 `existsSync`，所以一条指向**不存在**的
  库外路径（如 `../../engine/expr.js`）会被判 `unresolved` 而不是 `escape`。判据仍会红（`offenders` 非空），
  但归因会不准；这是既有行为，不是双格式改造引入的。
- **`tests/budget.test.ts:24` 的注释是一处过期数字**：写「新增 7 条（2+2+4）」，实测是 **+9**
  （`ui-kit` 53 → 56 = +3：`ui.dropmenu.layout-effect-deps`、`ui.scrubnum.bounds-live`、
  `ui.scrubnum.bounds-ref`；新文件 `ui-hooks` 6 条）。**闸门本身是对的** —— 三道下限 `134 / 62 / 72`
  一行未动，错的只是那句注释的分解。
- **lint / format 工具链完全缺失**：全仓库没有 ESLint / Prettier 配置，也没有 `npm run lint`
  （`src/kit/scrub.tsx` 里那句 `eslint-disable` 注解在本轮已删除）。引入时该加 `lint` / `format` /
  `format:check` 三条 script，并接进 `.github/workflows/ci.yml` 的 `npm ci` 之后、`typecheck` 之前。
- **示范页目前跑不起来**：`examples/demo.tsx` 文件头写的启动命令指向宿主的 `toolchain/devserver.js`，
  那个文件**不在本仓库**；仓库里也没有任何 sprite 定义，所以即使跑起来，`Icon` 也全是空 `<use>`。
  它现在的价值是「一份只吃库样式的消费样板」，并且被 `npm run typecheck` 检查着不让它烂掉。

## 打包与消费（给宿主维护者）

```sh
# 本仓库
npm run pack:vendor                  # → deerui-0.1.0.tgz（同时产出 npm 自己命名的 deer-ui-0.1.0.tgz，脚本清掉中间那份）
# 宿主仓库
#   cp deerui-0.1.0.tgz <app>/vendor/
#   npm i file:vendor/deerui-0.1.0.tgz
```

`files` 只收 `dist` / `LICENSE` / `README.md`；`tests/`、`scripts/`、`examples/`、`.github/` 都不进包。
`sideEffects: ["*.css"]`**不是** `false`：样式块是有副作用的。

> **文件名差一个连字符，别记错**：npm 的 tarball 名由**包名**决定（`deer-ui-0.1.0.tgz`）；
> 面向宿主仓库时本仓库另有 `npm run pack:vendor`，产出的名字是 `deerui-0.1.0.tgz`（宿主的历史约定，
> 例如 `file:vendor/deerui-0.1.0.tgz`）。**两者是同一份包**（装完都是 `deer-ui/`，路径由 `exports` 决定，
> 与文件名无关），`pack:vendor` 会打印三条指纹。

`scripts/pack-vendor.mjs` 里有一道**打包后的行尾闸门**：逐个检查将要进包的文件，出现 CR 就直接失败
（并删掉中间产物）—— 老检出（在这条属性之前克隆的）不会被自动改写，与其产出一个指纹对不上的包，
不如在这里当场停下。

> ⚠️ **指纹钉的是「某一份确定内容」**：宿主常把 `VENDOR_BYTES` / `VENDOR_MD5` / `VENDOR_SHA256`
> 钉进自己的测试，并把 sha512 写进 lockfile 的 `integrity`。这意味着**库这边任何一次重新打包
> （哪怕只改一个字节：改注释、改 README、加一条规则）都会让那些常量失效** ——
> 换包时必须按上面的命令重打、把三个指纹与 `integrity` 一起对齐，别指望「同一版本号 = 同一份字节」。

> **本仓库踩过的坑**：宿主把库升到「同一个版本号、不同内容」的 tarball 时，npm 可能**从缓存**拿出旧包 ——
> 装完 `node_modules/deer-ui` 里仍然没有新文件，而版本号看起来没变。破解：先改 lock 里 `deer-ui` 的
> `integrity`（或删掉 `node_modules/deer-ui` 再装），并**核对装出来的
> `node_modules/deer-ui/dist/styles.css` 与库仓库 `dist/styles.css` 逐字节相同**。

## 发布面

- **包名** `deer-ui`、**版本** `0.1.0`、**许可** MIT（见 [`LICENSE`](LICENSE)）。
- ⚠️ **裸名 `deer-ui` 在 npm 上已被别人占用**（latest `1.1.10`，作者 `bear-ui`；本机未联网复现过）。
  GitHub 仓库名与 npm 包名不冲突，但**将来真要 `npm publish` 必须换名**，候选是 scope 名下的
  `@deerluu/deer-ui`。现在 `private: true` 已经把误发布这条路堵住，v0 不发 npm。
- 换名意味着**所有 `import ... from "deer-ui/kit"` 都要改**，所以发布前先把名字定下来。

## 许可

MIT（[`LICENSE`](LICENSE)，版权行 `Copyright (c) 2026 DeerLuuu`），与 `package.json` 的 `"license": "MIT"` 一致。
