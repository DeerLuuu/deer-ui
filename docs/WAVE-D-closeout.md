# 波次 D 收尾记录：CJS 的 TypeScript 消费者类型支持（F1）+ `check-dist` 判据放宽与崩溃修复（F3）

> 口径在 [`REQUIREMENTS-freeze-D.md`](REQUIREMENTS-freeze-D.md)；本文件是**收尾记录**：
> 做了什么 / 验证到什么程度 / 还剩什么。
>
> **证据来源分栏（本文件全篇遵守）**：
> - **`[亲跑]`** = 本文件落笔时（队长）或指定成员在**当前状态**下亲自跑出来的；
> - **`[引用 t12]`** / **`[引用 t13]`** = 引用那两条独立验证 / 质量门任务的结论，**不冒充自己跑的**；
> - **`[实测]`** = 有确切命令与输出的观察，不区分谁跑的时点会标出来。

---

## 1. 到底修了什么

### F1：CJS 的 TypeScript 消费者拿不到类型（high，面向消费者）

**病根**：`exports` 的 `types` 条件**不区分模块格式** —— 四个入口命中的都是 ESM 树的
`./dist/*.d.ts`，而它被 `dist/package.json` 的 `"type": "module"` 判成 **ESM 声明**。

**改造前的实测映射**（`[引用 t12]` + t10 复现）：

| 消费者工程 | 结果 |
|---|---|
| node16 + **CJS**：`import { Dialog } from "deer-ui/kit"` | **TS1479** |
| node16 + **CJS**：`import kit = require("deer-ui/kit")` | **TS1471** |
| **node10** | **TS2307** |
| node16 + **ESM** / **bundler** | exit 0（一直正常，所以这条只在 CJS 侧可见） |

**修法（加法，不回滚双格式）**：

1. CJS 那一遍构建**开声明**（新增 `tsconfig.cjs.json`：`module: CommonJS` + `moduleResolution: Node10`
   + `outDir: dist/cjs` + `declaration: true`）。
2. `scripts/build-styles.mjs` 收尾做**生成物机械归一**：产物扩展名 `.js → .cjs`、声明 `.d.ts → .d.cts`、
   相对说明符 `.js → .cjs`（实测改写 34 处），并写出两棵树的格式作用域 `package.json`。
3. `exports` 的每个 JS 子入口改成**嵌套条件**：

   ```json
   ".": {
     "import":  { "types": "./dist/index.d.ts",     "default": "./dist/index.js" },
     "require": { "types": "./dist/cjs/index.d.cts", "default": "./dist/cjs/index.cjs" }
   }
   ```

4. 补根 `package.json` 的顶层 `"types"` + `"main"`（都指 CJS 树）给 node10 兜底。

**为什么是 `.d.cts` 而不是 `dist/cjs/**/*.d.ts`**：`.d.cts` 把「这是 CommonJS 声明」写在**扩展名**里，
不依赖目录作用域。两种都能过（`[引用 t13]` 实测 `dist/cjs/**/*.d.ts` 在 commonjs 作用域下也可用），
取前者是因为更显式。

**为什么不做「`.cts` 源镜像」**（冻结文档 §6.1 的原始设想）：`.tsx` 源不能改名成 `.cts` ——
JSX 在 `.cts` 里是语法错误（`TS1005`），而 `.ctsx` 不是 TS 支持的扩展名（`TS6054` 列出了全部合法扩展名）。
本库 12 个模块里有 **6 个是 `.tsx`**（含公开入口 `tabs.tsx`），所以那条路**物理上不可行**；
改用「对生成物做机械归一」，目标形态与 §6.1 一致，且**没有**「镜像 vs `src/**` 分叉」这个新风险。

### F3：`check-dist` 的 `types` 首位判据与 F1 互斥，且遇嵌套对象直接崩

- 位置：`scripts/check-dist.mjs` 的 `checkExports()`。
- **两个问题**：①「`types` 必须排在 `Object.keys(cond)[0]`」把 F1 唯一可行的嵌套形状**定义成失败**；
  ② 对条件值直接 `path.join(libRoot, target)`，无字符串守卫 → 遇对象抛
  `TypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type string. Received an instance of Object`
  （**脚本崩，不是判据红**；`[引用 t12]` 用 HEAD 版 check-dist 对着两级 `types` 独立复现过）。
- **改法**：放宽为「`types` 必须**存在**，且位置在 `import` / `require` **之前**（允许其值是对象）」；
  嵌套对象递归取值并逐一 `existsSync`；**非字符串叶子判 FAIL 不抛异常**。
  并且**两种形状都认**（嵌套 + 平铺）—— 因为判据自检样本里两种都有。
- **没有变成「宽松化」**：常驻自检 **N1…N11（11/11）** 随每次 `check:dist` / `prepack` 跑
  （`[亲跑]` 输出 `判据自检 11/11`）。新增的 **N8…N11 专测嵌套形状** —— 没有它们，新加的分支
  就是没被自检覆盖的；补上后实测：N8 目标形状放行、N9 冒充判红、N10 缺 `types` 判红、N11 `types` 错位判红。
- **按格式的落地判据**：`require` 侧的类型目标必须是 `dist/cjs/**/*.d.cts`，
  拿 ESM 树的 `.d.ts` 冒充即判红 —— 这条直接盯着 F1 的病根，两种形状各取各的 `require` 侧。

---

## 2. 验证到了什么程度

### 2.1 消费者侧真判据（F1 的**唯一**真判据，不是「exports 形状看起来对」）

`[引用 t12]` 用真实消费者工程（deer-ui 经 junction、走真 `exports` 条件、TS 5.9.3、
`strict: true` + **`skipLibCheck: false`**）：**12/12 必测全 exit 0**
（cjs / esm / bundler × root / kit / tabs / tooltip），探针含**全部公开类型的 `IsAny` 反例**
（类型退化成 `any` 时 `@ts-expect-error` 会 unused 报错）与 `import ns = require(...)` 写法。

`[引用 t13]` 用**自己建的**夹具（`node_modules\deer-ui` = package.json + dist + LICENSE 的逐字节副本，
可变异）**独立复跑**，同样全部 exit 0。

`[亲跑]`（队长，本次合并后）自建夹具复跑 **16 条**：
4 入口 × {node16+CJS 的 `import` 形式、node16+CJS 的 `import x = require` 形式、node16+ESM、bundler}，
全部 `skipLibCheck: false` → **16 PASS / 0 FAIL**。

> 三次独立复跑（t12 / t13 / 队长）都得到全绿，且用的夹具互不相同。这是本波次最硬的一条证据。

### 2.2 反向验证（证明测的是**真机制**，不是恰好不报错）

`[引用 t12]`：
- `--traceResolution` 抓到 CJS 消费者 `Matched 'exports' condition 'types' → 'require' →
  Using 'exports' subpath '.' with target './dist/cjs/index.d.cts'`，ESM 侧命中 `./dist/index.d.ts`；
- 把四个入口的 `types.require` 指回 ESM 的 `.d.ts` → CJS 夹具 **4/4 变红**（TS1479 + TS1541，
  `import x = require` 另报 TS1471 + TS1542）；
- 挪走 12 个 `.d.cts` → 4/4 变红（TS7016）；
- 两种变异逐次 sha256 byte-exact 还原后都回到 12/12 green。

`[引用 t13]` 也**亲手**做了反向验证：require 侧 `types` 指回 ESM `.d.ts` → cjs 夹具 exit 2 /
TS1479 ×4 + TS1541，哈希还原后回绿。

### 2.3 `.d.cts` 实体与作用域

`[引用 t12]`：12 个 `.d.cts` + 12 个 `.cjs`，模块清单**双向一一对应**；
四个入口的 require 侧声明 **1968 / 695 / 1087 / 253 B**（最小 150 B，**无空文件无占位**）；
16 处相对说明符全是 `.cjs` 且目标存在；`dist/package.json = module`、`dist/cjs/package.json = commonjs` 各就各位。

`[亲跑]`（队长）：`dist` **51** 个文件、`dist/cjs` **12 `.cjs` + 12 `.d.cts`**、
四入口 require 侧声明 **1968 / 695 / 1087 / 253 B** —— 与上面的引用一致。

### 2.4 F3 的负例与崩溃

`[引用 t13]` 在副本里跑了 **6 个真负例**，全部 exit 1 且 **`TypeError = false`**：
`types` 排在 `import` 之后（报 `"import, require, types"`）、排在 `require` 之后、叶子是 number、
删 `types`、`require` 目标不存在、`types = null`。基线（两级 `types` 嵌套对象）exit 0 不崩。

### 2.5 node10（如实写明限制，不夸大）

`[引用 t12]` + `[引用 t13]` 一致：**根入口**在 `--esModuleInterop` 下 exit 0（不加报 **TS1259**）；
**子入口** exit 2 / **TS2307**。README 已写明这两条限制，且**没有**声称支持 node10 子入口。

### 2.6 回归底线与不变量

| 检查 | 结果 | 来源 |
|---|---|---|
| `npm test` | `assertions: 225` / `ALL PASS`（`ui.*` 117 + `kit.*+lib.*` 108） | `[亲跑]` |
| 预算三道下限 | `MIN_CONTRACT=62` / `MIN_INFRA=72` / `MIN_TOTAL=134` **未动**（`git diff` 无代码行变更） | `[亲跑]` |
| `typecheck`（src + examples） | exit 0 | `[亲跑]` |
| `npm run build`（清空 `dist/` 后从零） | exit 0；归一输出 `12 个 .cjs + 12 个 .d.cts；相对说明符改写 34 处；模块清单与 ESM 树一一对应` | `[亲跑]` |
| `npm run check:dist` | OK（51 产物 + 原生加载 30/25/2/3 + 判据自检 11/11） | `[亲跑]` |
| `dist/styles.css` | **17,790 B / 92 条规则 / 326 行**（未变） | `[亲跑]` + `[引用 t13]` |
| 原生加载 | `require` 30 / `import` 30 / `kit` 25 / `tabs` 2 / `tooltip` 3 | `[亲跑]` |
| `src/**` 未改 | `git diff --exit-code -- src` 退出 0 | `[亲跑]` |
| 快照未改 | `tests/snapshots/barrel-exports.json` 逐字节未变 | `[引用 t13]` |
| 依赖未增 | `dependencies` 仍为空、lockfile 逐字未变 | `[引用 t12]` + `[引用 t13]` |
| 构建可重现 | 两次 build 清单哈希完全相同 | `[引用 t13]` |

---

## 3. 与另一份独立实现的关系（合并，不是并存）

远端分支 **`fix/exports-types-per-format`**（提交 `4e8553f` + `bfa94c8`，两次 CI 均 `success`）
在 `master` 基础上**独立解决过同一对问题**。两条路线语义等价、形态不同：

| 维度 | 本波次（波次 D，已过独立验证 + 质量门） | `fix/exports-types-per-format`（已推、CI 成功） |
|---|---|---|
| `exports` 形状 | 嵌套 `{import:{types,default}, require:{types,default}}`（**合并后**） | 同样是嵌套形状（**这就是并进来的那一项**） |
| CJS 类型产物 | `.d.cts` + 运行期 `.cjs` | `dist/cjs/**/*.d.ts` + 运行期 `.js` |
| CJS 构建 | 独立 `tsconfig.cjs.json` + **生成物归一**（34 处说明符改写） | 只在 `build` 里加一遍 tsc（`--declaration true`），无后处理 |
| F3 | 两种形状都认 + 常驻自检 **N1…N11** | 也改了 check-dist（+283 行），并修了「只比名字集合」的弱判据 |
| 断言 | **并进**了它的 3 条 `kit.barrel.exports-*`（按 `.d.cts ↔ .cjs` 适配） | 3 条 `kit.barrel.exports-*`（原按 `.d.ts ↔ .js`） |

**队长裁定（用户批准）**：以本波次已过双门的实现为基线，**并入**那份实现的三个优点 ——
① 嵌套 `exports` 形状；② 3 条 `exports` 形状判据；③ 其安装路径修正
（**git 依赖在 npm 11 上装不成**，把 tarball 提为第①路）。合并后 `[亲跑]` 复验 16/16 消费者编译通过。

**为什么不让两份并存**：同一个问题留两份形态不同的实现，会让后续审查反复踩到
「到底以哪份为准」；而本波次这份的验证证据是三波里最硬的（16/16 消费者编译 + 反向验证 +
F3 六负例 + 常驻自检 11/11）。

### 3.1 并进来的第三项：git 依赖在 npm 11 上装不成（安装路径修正）

那份实现的第二个提交（`bfa94c8`）做了一次**很有价值的实测**：它按「别人怎么用」去跑 README 的
安装路①，结果发现 `npm i github:DeerLuuu/deer-ui` 在 **npm 11.17** 上直接失败：

```
npm error code EALLOWSCRIPTS
npm error --allow-scripts is not allowed in project-scoped installs.
npm error git dep preparation failed        ← 挡的正是 "prepare": "npm run build"
```

它试过 6 种绕法**全部无效**（`--ignore-scripts`、消费侧 `.npmrc` 的 `allow-scripts`、消费方
`package.json` 的 `allowScripts`、`npm_config_allow_scripts` 环境变量、清空全局 npmrc 干扰后重试、
直装 codeload 分支快照）；其中**最后一条装得上但 `node_modules/deer-ui/dist/` 是空的**
（产物不入库，`prepare` 被 npm 挡掉没跑），等于装了一个不可用的包。

**这类组合冲突不是本项目某次改动引入的**（npm 10 及以前没有这条限制），但它直接决定
「消费者能不能装」，所以本波次把它并进了 README：**tarball 提为第①路并标注「v0 唯一实测可用」**，
git 依赖降为第②路并挂实测报错块（含 6 种无效绕法与「彻底解法是发 npm」的指向），
顶部那条概述也从「tarball / git 依赖交付」改成「只以 tarball 交付」。

---

## 4. 下一轮入口（本轮明确不做或未验）

| # | 项 | 说明 |
|---|---|---|
| **N-1** | `npm pack` 后 `.d.cts` 是否随 `files: ["dist"]` 进 tarball | `[引用 t12]` 列为未验证项之一。**这是唯一还没被任何断言覆盖的交付路径**（仓库里的 `dist/` 能用 ≠ 打出来的包里带着它）。建议下一轮直接做：`npm pack` + 查 tar 清单（12 个 `.d.cts` / 12 个 `.cjs` / `dist/cjs/package.json`） |
| **N-2** | pack → install 的**真装包**路径 | `[引用 t12]` 的夹具走 junction，没走 `npm i <tarball>` |
| **N-3** | `import type … with { "resolution-mode": "require" }` 写法 | 第 4 种写法未测（前三种已验） |
| **N-4** | 跨 TypeScript 版本矩阵 | 只测了 TS 5.9.3 |
| **N-5** | 真实打包器产物（vite / webpack / rspack） | **只测了 tsc 的 `bundler` 解析模式**；真实打包器产物未验。这条界限要写清楚：**解析模式已验，打包器产物未验** |
| **L-1** | `check-dist` 的格式判据只钉 `require` 侧 | 把 `types.import` 指向 `.d.cts` 不会红（`[引用 t13]` 实测 exit 0）；影响实测为零（三个夹具仍全绿），但口径不齐。改法：镜像一条 `types.import` 必须是 `./dist/**/*.d.ts` + 自检 N12 |
| **L-2** | `npm run build` 不做 clean | 孤儿产物不会被删（改扩展名后尤其要留意历史残留） |
| **L-3** | 契约 `Verify` 第 3 条只跑第一遍 tsc | **不重建 CJS 树** —— 终局验证必须用完整的 `npm run build`（本文件 §2.6 就是这么做） |
| **L-4** | 冻结文档 §6.1「`.cts` 源镜像」 | 经实测不可行（JSX 扩展名），已被「生成物机械归一」替代；口径需在下一轮冻结文档里记正 |
| **L-5** | 冻结文档 §3.4 / §4.2 两处口径 | §3.4「CJS 作用域的 `.d.ts` 不行」是**前提错误**（实测可用）；§4.2「`require` 提到 `types` 前 ⇒ TS1479」在目标形状下**不成立**（实测 exit 0，因为 `index.cjs` 旁就有 `index.d.cts`）——「`types` 必须在前」现在只算稳健性规则 |

**仍登记但不实施的旧项**（不重复列出，见 [`WAVE-C-closeout.md`](WAVE-C-closeout.md) §5 与
[`NEXT-round-B.md`](NEXT-round-B.md)）：lint / format 工具链、包名更换（npm 上 `deer-ui` 已被占）、
Dialog 焦点陷阱、A0-3 五种绕过写法、`check-dist` 私有模块图、134 闸门对 filler 断言的抵抗、`env()` 例外收紧。

---

## 5. 本波次明确没有声明的事（诚实性纪律）

- **不声明「已验真实打包器产物」**：只验了 tsc 的 `bundler` **解析模式**（见 N-5）。
- **不声明「node10 子路径可用」**：只有根入口可用且需 `esModuleInterop`（见 §2.5）。
- **不声明「pack→install 已验证」**：见 N-1 / N-2。
- **不声明「所有 TypeScript 版本都行」**：只测了 TS 5.9.3（见 N-4）。
- **不声明 lint / format 已接入**：本仓库仍没有该工具链（`npm run lint` 不存在）。
