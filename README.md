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

**迁移期现状（A0 骨架）**：`src/` 下只有三个**占位**文件（`kit/index.ts` / `tabs.tsx` / `tooltip.ts`）
和一个根 barrel `index.ts`。P0b 会用应用侧 9 个文件的逐字节副本覆盖这三个占位文件 ——
占位文件头部都写了「★ 占位文件 ★ P0b 会整体覆盖」，不要手改。

## 目录结构

```
src/index.ts            公开 barrel（只 re-export；A0-2 盯着它）
src/kit/index.ts        ★ 占位：P0b 覆盖为 kit barrel（25 值 + 6 类型）
src/tabs.tsx            ★ 占位：P0b 覆盖为 TabBar / DropMenu
src/tooltip.ts          ★ 占位：P0b 覆盖为 showTip / hideTip / subscribeTip（库独占）
tests/tsconfig.json     库测试的编译编排（rootDir=库根、outDir=tests/.ts-out、include 用 glob）
tests/common.ts         ok / eq / finish（打印 `assertions: N` 与 `ALL PASS`）
tests/env.ts            Node 标准库薄封装 + 库根解析（DEERUI_LIB_ROOT 可覆盖）
tests/scan.ts           三条判据用到的纯扫描函数（可单测，见下）
tests/a0-purity.test.ts         A0-1 纯度白名单
tests/a0-barrel.test.ts         A0-2 barrel 导出面快照
tests/a0-host-boundaries.test.ts A0-3 不得自判 PC / 主题 / 安全区
tests/dom-stub.ts       自带 DOM 桩（R9：库测试不许依赖应用侧 stubEnv()）
tests/snapshots/barrel-exports.json  ★ 导出面快照（改导出面必须显式更新）
scripts/tsc.mjs         解析一个可用的 tsc（本地 → $DEERUI_TSC → 平级 PixelCraft）
scripts/check-dist.mjs  dist 产物自检（exports 目标存在 / 没打进 React / 无外链）
scripts/link-dev-deps.mjs 无网络环境下的 devDependency 权宜链接（见下）
```

## 命令

```sh
npm run typecheck      # tsc -p tsconfig.json --noEmit（src，strict: true）
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

**A0-3 的唯一豁免：`src/demo.tsx`**（方案 §2.5 / Q8 的 dev-only 示范页）。它自己 `createRoot` 挂到页面上、
自己切 `data-theme` —— 那是**宿主**的活，而 P0b 要逐字节复制它，一个字都不许改。豁免要付四条机器代价
（`kit.host-fixture.*`）：① 文件真实存在（P0b 前为 `pending`）；② 它的代码**照样会被判据抓住**
（证明豁免发生在过滤阶段，而不是把规则放宽）；③ `tsconfig.build.json` 把它排除（不进 `dist`）；
④ `files` 不收 `src/`（进不了 tarball）。**示范页必须落在 `src/demo.tsx`**（它 `import "./index"` 拿的是根 barrel）；
放进 `src/kit/` 会被 A0-3 判红。

### P0b 复制进来时，判据会红成什么样（已用真实文件校准）

把应用侧 `src/ui/kit` 的 7 个文件 + `tabs.tsx` + `tooltip.ts` 按库布局摆好跑一遍本仓库的判据（夹具在 `%TEMP%`，未入库）：

- **A0-1 会红 2 条**，且正是方案 §2.6 说的那类越界：`src/kit/scrub.tsx:7 -> ../../engine/expr`、
  `src/kit/scrub.tsx:8 -> ../../engine/scrub`（解析得到、但落在 `src/` 之外）。按方案把它们内联进
  `src/internal/{expr,scrub}.ts` 后转绿；`primitives.tsx` 的 `../tooltip` 因为 `tooltip.ts` 就在库根，**不再算越界**。
- **A0-2 会红**（快照还是空库那一份）—— 那时导出面从 0 变成
  `./kit` = **25 个值 + 6 个类型**（与方案 §3.2 的数字一致），根入口 `.` 再补上 `TabBar` / `DropMenu` 与
  `tooltip` 的 3 个值 + `Tip` 类型。跑一次 `npm run snapshot:barrel` 即可。
- **A0-3 全绿**（真实文件里没有 PC / 主题 / 安全区自判；`window.innerWidth` 与 `(orientation: landscape)` 都被正确放过）。
- `lib.budget.assertions>=112` 在复制完成后**自动生效**（P0b 前是 `p0-pending` 待机）。

### 导出面快照怎么用

- 改动**导出面**必须显式更新：`npm run snapshot:barrel`，然后在提交信息里写清加了/删了/改了什么符号。
- 快照文件 `tests/snapshots/barrel-exports.json` 的 diff 就是「这次公开面变了什么」的清单。
- P0b 把 9 个文件复制进来后，这份快照会**立刻变红**（这是设计如此）；跑一次 `npm run snapshot:barrel` 即可。

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
