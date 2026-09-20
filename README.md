# deer-ui

PixelCraft（像素工坊）把 **UI 表现层**独立出来的控件库：React 18 + 无运行时依赖（除 `react` / `react-dom` peer）。
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

**现状（P0b 已落地）**：应用侧 P0 切片的 **9 个文件**已复制进来（`src/kit/*` 7 个 + `src/tabs.tsx` + `src/tooltip.ts`，
逐字节等价、只改了 `src/kit/scrub.tsx` 的 2 行 import 指向库内 `src/internal/*`）；`src/engine/{expr,scrub}` 作为
**内联副本**进了 `src/internal/`（库不得反向 import 宿主，方案 R11 接受这份重复）；示范页在 `examples/demo.tsx`
（不进 barrel / 不进 `files` / 库测试不依赖）。断言台账见下面「P0b 落地记录」。

## 目录结构

```
src/index.ts            公开 barrel（只 re-export；A0-2 盯着它）
src/kit/                P0b 从 PixelCraft `src/ui/kit` 复制的 7 个文件（index.ts 是 barrel）
src/tabs.tsx            TabBar / DropMenu
src/tooltip.ts          showTip / hideTip / subscribeTip（**库独占**，见方案 R10）
src/internal/expr.ts    内联自 PixelCraft `src/engine/expr.ts`（算式求值；文件头有出处与防分叉说明）
src/internal/scrub.ts   内联自 PixelCraft `src/engine/scrub.ts`（拖动/滚轮数值数学）
examples/demo.tsx       dev-only 示范页（逐字节复制自应用 `kit/demo.tsx`，只有 1 行 import 改动）
                        —— **不进 barrel / 不进 files / 不进 dist**；库测试不依赖它（那 6 条 ui.demo.* 留在宿主侧）
tests/tsconfig.json     库测试的编译编排（rootDir=库根、outDir=tests/.ts-out、include 用 glob）
tests/common.ts         ok / eq / finish（打印 `assertions: N` 与 `ALL PASS`）
tests/env.ts            Node 标准库薄封装 + 库根解析（DEERUI_LIB_ROOT 可覆盖）
tests/scan.ts           三条判据用到的纯扫描函数（可单测，见下）
tests/a0-purity.test.ts         A0-1 纯度白名单
tests/a0-barrel.test.ts         A0-2 barrel 导出面快照
tests/a0-host-boundaries.test.ts A0-3 不得自判 PC / 主题 / 安全区
tests/ui-kit.test.tsx   P0b 从应用 `tests/ui-kit.test.tsx` 搬来的 62 条控件 DOM 契约断言
tests/dom-stub.ts       自带 DOM 桩（R9：库测试不许依赖应用侧 stubEnv()）
tests/snapshots/barrel-exports.json  ★ 导出面快照（改导出面必须显式更新）
scripts/tsc.mjs         解析一个可用的 tsc（本地 → $DEERUI_TSC → 平级 PixelCraft）
scripts/check-dist.mjs  dist 产物自检（exports 目标存在 / 没打进 React / 无外链 / 没有 demo）
scripts/link-dev-deps.mjs 无网络环境下的 devDependency 权宜链接（见下）
scripts/pack-vendor.mjs  产出应用侧约定的 deerui-<version>.tgz 并打印 sha256
tsconfig.examples.json  示范页的类型检查（它不在 src 里，但 import 路径漂了要能红）
```

## 命令

```sh
npm run typecheck      # tsc -p tsconfig.json --noEmit（src，strict: true）
                       #   && tsc -p tsconfig.examples.json（示范页，它不在 src 里）
npm run build          # tsc -p tsconfig.build.json → dist/（ESM + .d.ts，逐文件，无 bundler）
npm test               # 编译 tests/ 到 tests/.ts-out 后运行；末两行是 assertions: N / ALL PASS
npm run snapshot:barrel  # 导出面**有意**变化时更新快照（必须连同提交信息一起说明）
npm run check:dist     # 构建产物自检（CI 在 build 之后跑）
npm pack               # 出 deer-ui-0.1.0.tgz（prepack 会先 build + check:dist）
npm run pack:vendor    # 再落一份应用侧约定的 deerui-0.1.0.tgz（见「打包与消费」）
```

## 工具链：没有 node_modules 时怎么办

新仓库**没有** `node_modules`，而本机 `npm install --offline` 装不上（实测 `ENOTCACHED`：
`npm error request to http://mirrors.cloud.tencent.com/npm/react failed: cache mode is 'only-if-cached'`）。
两条**离线**路线（有网络的环境请直接 `npm install`，CI 就是这么做的）：

1. **tsc 从哪儿来** —— `scripts/tsc.mjs` 按顺序找一个能用的 tsc，并在 stderr 打印用的是哪一个：
   ① 本仓库 `node_modules/typescript/lib/tsc.js` → ② 环境变量 `$DEERUI_TSC` →
   ③ **平级的 PixelCraft 检出** `../pixelcraft/node_modules/typescript/lib/tsc.js`。
   （别照抄应用侧那条 `node_modules/typescript/bin/tsc.js`：本机真路径在 `lib/tsc.js`，`bin/tsc` 只是无扩展名的 shell 包装。）
2. **react / @types 从哪儿来** —— `npm run link:devdeps` 把平级 PixelCraft 里已经装好的
   `typescript` / `react` / `react-dom` / `scheduler` / `loose-envify` / `js-tokens` / `csstype` / `prop-types` / `@types`
   以 **junction** 链进本仓库的 `node_modules/`（`node_modules/` 已被 `.gitignore` 忽略，不进提交）。
   这是**离线权宜**：链过去的 React 与宿主是同一份物理文件，反而天然满足「React 单实例」。
   有网络时删掉 `node_modules/` 直接 `npm install` 即可，`package.json` 里该有的 devDependency 一条不少。

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

**断言台账**（机器口径：用 `%TEMP%` 的计数夹具把应用那份 `ui-kit.test.tsx` 单独编译运行一次，记录运行期断言名）：

| 项 | 条数 | 说明 |
|---|---|---|
| 应用侧 `tests/ui-kit.test.tsx` 运行期断言 | **70** | 不是方案里写的 112（见下「112 的差异」） |
| └ 搬进库（`tests/ui-kit.test.tsx`） | **62** | 名字逐字保留（仍是 `ui.*`），比对结果「库侧有、应用侧没有」= **0 条**，即零改名、零削弱 |
| └ 留在宿主侧 | **8** | `ui.demo.*` 6 条（示范页在 `examples/`，库测试不依赖它）+ `ui.overlay-full-wiring`（断言宿主 `src/ui/App.tsx` 接线）+ `ui.dropmenu.pop-css`（断言宿主 `src/ui/style.css`） |
| 库侧运行期断言合计 | **123** | 62（搬来的）+ 61（A0-1/A0-2/A0-3/infra/预算闸门）—— 预算闸门 `≥ 112` 因此成立 |

**112 的差异**（必须写清楚，免得下一轮以为丢了 42 条）：`docs/PLAN-deer-ui.md` 里「112 条 DOM 契约断言」这个数字
与 `tests/ui-kit.test.tsx` 的实际运行条数（70）对不上；本仓库按**实测**记账（夹具与结果都在 `%TEMP%`，
可复现：`node deerui-hostcount-setup.mjs` → 编译 → `node deerui-names.cjs …`）。要核 112 的来源，得回应用仓库重新数一遍。

**给宿主侧（t3）的两条硬约束**：
1. 应用侧 `src/ui/kit/demo.tsx` **P0b 不能删** —— 那 6 条 `ui.demo.*` 还要渲染它；按 Q8，应用侧副本到 P7 才删。
2. 应用侧现在有 62 条断言与库侧**同名同义**（双跑窗口）。t3 把它们从应用侧删掉时，建议按名字对账：
   `库侧 ui.* 集合 == 应用侧 ui.* 集合 − 8（上面那三条来源）`。

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
   静态扫描 + 自写 runner；输出末尾必须是 `assertions: N` 与 `ALL PASS` 两行，CI 断言 **N ≥ 112**（P0b 起硬门）。
   `tests/dom-stub.ts` 是自带的最小 DOM 桩（R9：**不许**依赖应用侧 `stubEnv()`）。
3. **`src` 用 `strict: true`，`tests` 用 `strict: false`**：`src` 是本仓库新写的（不背历史包袱，方案 §4.1 说的
   「改 strict 是独立的一轮」指应用侧）；`tests` 要能直接吃下从应用侧搬来的既有测试文件，所以跟应用侧一致。
   两处都写死 `"jsx": "react-jsx"`（少一份就会让宿主 esbuild 退回经典 JSX 变换，出白屏包，见 AGENTS.md §6.8）。

## 打包与消费

```sh
npm run pack:vendor            # → deerui-0.1.0.tgz（同时也产出 npm 自己命名的 deer-ui-0.1.0.tgz，脚本里已清掉中间那份）
# 应用侧（PixelCraft）：
#   cp deerui-0.1.0.tgz <app>/vendor/
#   npm i file:vendor/deerui-0.1.0.tgz
```

> **文件名差一个连字符，别记错**：npm 的 tarball 名由**包名**决定（`deer-ui-0.1.0.tgz`），
> 而方案 §4.6 / 应用侧消费路径写的是 `file:vendor/deerui-<version>.tgz`。两者是同一份包（装完仍是 `deer-ui`，
> 路径由 `package.json` 的 `exports` 决定，与文件名无关）。`npm run pack:vendor` 会顺手重命名并打印 sha256，
> 手工重命名这一步就不用做了。

`files` 只收 `dist` / `LICENSE` / `README.md`；`tests/`、`scripts/`、`.github/` 都不进包。
`sideEffects: ["*.css"]`**不是** `false`：将来 P2 的样式块是有副作用的（现在 P0 阶段库里没有 CSS）。

**bundler-only 声明（方案 Q4 选 (b)）**：源码里的相对 import **不带 `.js` 后缀**，`dist` 是逐文件的 ESM，
**不发 CJS**。因此 `node` 直接 `import` `dist` 会失败 —— 消费者只允许是打包器（宿主 esbuild）或浏览器。
两条路（写后缀 / 声明 bundler-only）都可行，但**不能留默认**，这里选的是后者并写在这里。

## CI

`.github/workflows/ci.yml`：`npm install` → `typecheck` → `build` → `check:dist` → `test` → `pack --dry-run`。
仓库当前**没有 lockfile**（离线环境生成不出来），所以 CI 用 `npm install` 而不是 `npm ci`；补锁是独立的一轮。

## 许可

MIT（`LICENSE`，版权行 `Copyright (c) 2026 DeerLuuu`），与 `package.json` 的 `"license": "MIT"` 一致。
