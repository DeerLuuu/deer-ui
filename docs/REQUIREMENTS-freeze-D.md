# deer-ui 波次 D 冻结口径：F1（CJS 的 TS 消费者类型）+ F3（check-dist 判据放宽）

> **本文件是波次 D 全部实现与验收的唯一依据。** 它是 [`docs/REQUIREMENTS-freeze-C.md`](REQUIREMENTS-freeze-C.md)
> 与 [`docs/WAVE-C-closeout.md`](WAVE-C-closeout.md) §5.1 / §5.2 的续篇：范围 C 的 INV-C1…C8 继续有效，
> 本轮只做 **F1 + F3** 两条，其余条目明确不做（§9）。
>
> 本文件**不改任何代码/测试/构建/导出面**：它是零写入任务。文中每个数字、每个退出码、每个文件名都来自
> 本轮在 `%TEMP%` 夹具里的**实测**（命令与观察结果见 §3、§7），没有推测；实测不到的写「未能判定」。
>
> 实测环境（本机，全部只读或落在 `%TEMP%`，用完已删夹具）：
>
> | 项 | 值 |
> |---|---|
> | `node node_modules/typescript/lib/tsc.js --version` | **5.9.3** |
> | `npm test`（干净检出） | `assertions: 222` / `ALL PASS`（`[budget] 222 = ui.* 117 + kit.*+lib.* 105`） |
> | `npm run build` | `dist/styles.css：17790 B / 92 条规则 / 326 行`；`dist/` **39 个产物文件** |
> | `npm run check:dist` | `OK（39 个产物文件）` + `原生加载 OK（deer-ui 30；deer-ui/kit 25；deer-ui/tabs 2；deer-ui/tooltip 3）` |
> | `git status --porcelain` | 空 |

---

## 0. 本轮一句话范围

**让 CJS 的 TypeScript 消费者拿到**格式正确**的类型（F1），并让产物自检**不再把这件事判成失败、也不崩**（F3）。**

范围 C 已把「原生 `require` / `import` 都能跑」做成了真事（运行期 30/25/2/3 全对），但**类型侧只做了一半**：
四个 JS 入口的 `types` 条件不分模块格式，CJS 消费者命中的是 ESM 树的 `.d.ts`，于是 node16+CJS 与 node10 两条路
在**编译期**是坏的（§2 实测复现）。波次 D 只做这两条，**不动运行期产物、不动 DOM 契约、不动快照**。

---

## 1. 本轮不变量（INV-D1 … INV-D8）

| # | 不变量 | 判定命令 / 客观判据 |
|---|---|---|
| **INV-D1** | **`src/**` 与 DOM 契约不变**：`src/**` 的 `.ts` / `.tsx` **一个字节不改**；`tests/ui-kit.test.tsx` 的既有 `ui.*` 断言**一条不删、不改名、不弱化** | `git diff --exit-code -- src/`（退出码 0）**且** `npm test` 末两行 `assertions: N` / `ALL PASS`，且 `REMOVED = ∅`（与范围 C 的 222 条名单逐符号 diff） |
| **INV-D2** | **公开导出面不变**：`tests/snapshots/barrel-exports.json` **逐字节不变**（`.` 30 值 + 9 类型 / `./kit` 25+6 / `./tabs` 2+2 / `./tooltip` 3+1） | `git diff --exit-code -- tests/snapshots/barrel-exports.json`（退出码 0）**且** `npm test` 里 `kit.barrel.surface` 等 A0-2 断言 PASS。**不许**跑 `npm run snapshot:barrel` 让它变绿 |
| **INV-D3** | **样式字节不变**：`dist/styles.css` 仍 **17,790 B / 92 条规则 / 326 行** | `npm run build` 的输出行逐字匹配 `17790 B / 92 条规则 / 326 行` |
| **INV-D4** | **不引入新依赖、不引 bundler**：`dependencies` 仍为空；`devDependencies` / `peerDependencies` 不增（`typescript` 已在）；`src/**` 仍只依赖 `react`/`react-dom` 家族 | `git diff -- package.json` 只许出现 `exports` / `scripts` / `types` / `main` 四处语义改动；`npm test` 的 `kit.purity.offenders` PASS |
| **INV-D5** | **断言只许涨**：`assertions: N` 且 **N ≥ 222**；三道预算下限 `MIN_CONTRACT=62` / `MIN_INFRA=72` / `MIN_TOTAL=134` **数值一处不动** | `npm test` 末行；`git diff -- tests/budget.test.ts` 里三行常量无数值变化 |
| **INV-D6** | **运行期行为不变（这一条最容易被打坏）**：`require('deer-ui')` 与 `import('deer-ui')` **各 30 个导出**；`require('deer-ui/kit')` = 25；`deer-ui/tabs` = 2；`deer-ui/tooltip` = 3；**同一入口的 CJS / ESM 导出值集合一致**；**消费侧单例仍是「一个模块实例」**（同一格式内 `setKitPcMode === setKitPcMode`） | `node -e "console.log(Object.keys(require('deer-ui')).length)"` → 30；`node --input-type=module -e "import('deer-ui').then(m=>console.log(Object.keys(m).length))"` → 30；`npm run check:dist` 的原生加载冒烟（含 CJS/ESM 值集合一致性） |
| **INV-D7** | **`dist/cjs` 的格式作用域不变**：`dist/package.json` = `{"type":"module"}`、`dist/cjs/package.json` = `{"type":"commonjs"}` 仍然存在且正确 | `npm run check:dist`（第 ⑥ 条判据）PASS |
| **INV-D8** | **仓库结束时干净**：`git status --porcelain` 空；不留夹具文件、不留 `*.tgz`、不留 `dist/**` 入版本控制 | `git status --porcelain`（空）+ `git diff --quiet`（退出 0） |

> **INV-D6 与 F1 的关系**：F1 改的是**类型解析**，运行期 JS 一个字节都不该动。
> 但「让 CJS 树出正确声明」的推荐做法（§5 选项 A）会**连带把 CJS 的 JS 产物从 `.js` 改成 `.cjs`** ——
> 因此 INV-D6 从「39 个产物文件」升级成**行为判据**：文件数可以变（§5.4 给出新基线），
> 但四条入口的导出值集合与一致性**一个都不许变**。

---

## 2. F1 的问题陈述（复现命令 + 实测退出码，先自己看一遍）

### 2.1 复现夹具（本命令集在 §7 里被复用；**全部落在 `%TEMP%`，不碰仓库**）

```sh
# 0) 先在仓库里构建（会产生 dist/，gitignore 覆盖）
npm run build

# 1) 夹具目录 = 一个「安装好的 deer-ui」，依赖用 junction 指回仓库的 node_modules
set F=%TEMP%\deerui-f1
mkdir "%F%\node_modules"
xcopy /E /I /Y dist "%F%\node_modules\deer-ui\dist"
copy /Y package.json "%F%\node_modules\deer-ui\package.json"
copy /Y LICENSE "%F%\node_modules\deer-ui\LICENSE"
mklink /J "%F%\node_modules\react"     "Z:\deer-ui\node_modules\react"
mklink /J "%F%\node_modules\react-dom" "Z:\deer-ui\node_modules\react-dom"
mklink /J "%F%\node_modules\@types"    "Z:\deer-ui\node_modules\@types"
```

> **为什么必须用夹具**：直接对仓库里的 `dist/` 做 `paths` 映射或相对 import，TypeScript **不会**走
> `package.json` 的 `exports` 条件，于是测不到「消费者真正命中的是哪份声明」。夹具里 `deer-ui` 是一个
> **真实安装形态**（`node_modules/deer-ui` + 自己的 `package.json`），这才是消费者路径。

### 2.2 四个消费者的实测结果（**改动前**，即当前 HEAD 的 `exports`）

`types` 条件是字符串 `./dist/<x>.d.ts`（ESM 树），`import` → `./dist/<x>.js`，`require` → `./dist/cjs/<x>.js`。

| 消费者 | 源文件 | tsconfig | **实测退出码 / 错误码** |
|---|---|---|---|
| **node16 + CJS**，`import { Dialog } from "deer-ui/kit"` | `consumer.cts` | `{"type":"commonjs"}` + `module: node16` + `moduleResolution: node16` | **exit 2 / TS1479**（"current file is a CommonJS module whose imports will produce 'require' calls; however, the referenced file is an ECMAScript module…"） |
| **node16 + CJS**，`import kitNs = require("deer-ui/kit")` | `consumer.cts` | 同上 | **exit 2 / TS1471**（"Module 'deer-ui/kit' cannot be imported using this construct. The specifier only resolves to an ES module…"） |
| **node16 + ESM**，`import { Dialog } from "deer-ui/kit"` | `consumer.mts` | `{"type":"module"}` + `module: node16` | **exit 0** |
| **bundler**，`import { Dialog } from "deer-ui/kit"` | `consumer.ts` | 无 `type` + `module: esnext` + `moduleResolution: bundler` | **exit 0** |
| **node10**，`import { Dialog } from "deer-ui/kit"` | `consumer.ts` | 无 `type` + `module: commonjs` + `moduleResolution: node10` | **exit 2 / TS2307** |
| **node10**，`import { Dialog } from "deer-ui"`（根入口） | `consumer.ts` | 同上 | **exit 2 / TS2307** |

> 结论：与 `WAVE-C-closeout.md` §5.1 的记录**逐条一致**（TS1479 / TS1471 / TS2307 / ESM 与 bundler 绿）。

### 2.3 根因（实测，不是推测）

`exports` 的 `types` 条件**不区分模块格式** → 四条路径都命中 `./dist/*.d.ts`；
而该文件在 `dist/package.json` 的 `"type": "module"` 作用域下被判定为 **ESM 声明**。
`dist/cjs/` 里**既没有 `.d.ts` 也没有 `.d.cts`**（构建的第二遍带 `--declaration false`）。

---

## 3. 实测：tsc 能不能产出 CJS 侧的 `.d.cts`？

### 3.1 实验一 —— 把 CJS 那一遍的声明打开（确切命令）

```sh
node Z:\deer-ui\node_modules\typescript\lib\tsc.js -p Z:\deer-ui\tsconfig.build.json \
  --module commonjs --moduleResolution node10 --outDir dist/cjs
#   ↑ 与 package.json 的 build 脚本逐字相同，唯一差别是把结尾的 --declaration false 拿掉
#   （tsconfig.build.json 里 declaration: true 是全局的，CLI 的 --declaration false 只是覆盖它）
```

**exit 0。观察到的产物文件名（实测，完整列表 24 项）：**

```
dist/cjs/index.js          dist/cjs/index.d.ts
dist/cjs/tabs.js           dist/cjs/tabs.d.ts
dist/cjs/tooltip.js        dist/cjs/tooltip.d.ts
dist/cjs/internal/expr.js  dist/cjs/internal/expr.d.ts
dist/cjs/internal/scrub.js dist/cjs/internal/scrub.d.ts
dist/cjs/kit/index.js      dist/cjs/kit/index.d.ts
dist/cjs/kit/Dialog.js     dist/cjs/kit/Dialog.d.ts
dist/cjs/kit/Form.js       dist/cjs/kit/Form.d.ts
dist/cjs/kit/HoverTip.js   dist/cjs/kit/HoverTip.d.ts
dist/cjs/kit/pcmode.js     dist/cjs/kit/pcmode.d.ts
dist/cjs/kit/primitives.js dist/cjs/kit/primitives.d.ts
dist/cjs/kit/scrub.js      dist/cjs/kit/scrub.d.ts
```

> **答案：`index.d.ts`，不是 `index.d.cts`。** 观察到的 12 个声明文件全是 `.d.ts`。
>
> 数法（可复核）：CJS 树 **12 个 `.js` + 12 个 `.d.ts` = 24 个文件**；
> 其中 `internal/` 2 个模块、`kit/` 6 个模块、根 4 个模块（`index` / `tabs` / `tooltip` + 目录级）。

### 3.2 为什么是 `.d.ts` —— 最小夹具的同族实测（确切命令与输出）

```sh
# 夹具：src/a.ts（.ts 源）+ src/b.cts（.cts 源），module: commonjs + declaration: true
node Z:\deer-ui\node_modules\typescript\lib\tsc.js -p %TEMP%\deerui-dcts-probe\tsconfig.json
#   exit 0
```

**观察到的产物文件名：**

| 源文件 | 产出的 JS | 产出的声明 |
|---|---|---|
| `src/a.ts` | `out/a.js` | **`out/a.d.ts`** |
| `src/b.cts` | `out/b.cjs` | **`out/b.d.cts`** |

> **机制（实测确认）**：声明文件的扩展名由**源文件扩展名**决定，`--module commonjs` 不改它。
> `.ts` → `.d.ts`，`.cts` → `.d.cts`。
> ⇒ **只要 `src/**` 里全是 `.ts`/`.tsx`（现状就是），那一遍 tsc 永远产出 `.d.ts`，产出不了 `.d.cts`。**
> `tsconfig.build.json` 的 `declaration: true` 在这里帮不上忙。

### 3.3 产出的 `.d.cts` 内部引用与 CJS 解析兼容吗？—— **分两种情况，实测结论相反**

**(a) 由 `.cts` 源编出来的 `.d.cts`：兼容。** 最小夹具 `b.cts` 引用 `./a.cjs`，产出：

```ts
// out/b.d.cts
export declare const bv: number;
export interface Bapi { y: number }
```

消费侧（`{"type":"commonjs"}` + `node16`）实测：

| 测试 | 命令 | 结果 |
|---|---|---|
| `import { kv } from "pkgk/kit"`，声明是**跨文件再导出**且 `skipLibCheck: false` | `tsc --noEmit --strict --skipLibCheck false --module node16 --moduleResolution node16 c.cts` | **exit 0 / OK** |
| 同上，`skipLibCheck: true` | 同上把 `false` 换 `true` | **exit 0 / OK** |

**(b) 把现有 ESM 树的 `.d.ts` 原样改名成 `.d.cts`：`skipLibCheck: true` 才能过。** 用**真实的 deer-ui `dist/`** 实测
（把 `dist/cjs/**/*.d.ts` 复制成 `*.d.cts`，`exports.types` 改成两级）：

| 消费者 | `skipLibCheck: true` | `skipLibCheck: false` |
|---|---|---|
| node16 + CJS，`import { Dialog } from "deer-ui/kit"` | **exit 0** | **exit 2 / TS1479**，报错位置：`dist/cjs/kit/index.d.cts(1,78): … the referenced file is an ECMAScript module and cannot be imported with 'require'` |
| node16 + CJS，`import kitNs = require("deer-ui/kit")` | **exit 0** | **exit 2 / TS1479** |
| node16 + ESM | exit 0 | exit 0 |
| bundler | exit 0 | exit 0 |
| node10 + 根入口（**加了顶层 `types`**） | **exit 0** | **exit 2 / TS1259**（"Module … can only be default-imported using the 'esModuleInterop' flag"） |
| node10 + 子路径 | exit 2 / TS2307 | exit 2 / TS2307 + TS1259 |

> **为什么会这样**：`dist/cjs/package.json` 是 `{"type":"commonjs"}`，于是**同一棵树里**的 `.d.cts` 被判成 CJS 声明；
> 而它内部写的是 `export { X } from "./Dialog.js"`，那条 `./Dialog.js` 指向的却是 **ESM** 的 `dist/cjs/Dialog.js`
> —— 一条 CJS 声明去 `require` 一个 ES 模块，TypeScript 报 TS1479。`skipLibCheck: true` 会跳过 `.d.ts`/.d.cts`
> 内部的检查，所以**表面绿了**。
>
> **顺带实测**：把 `.d.cts` 内容换成「类型骨架」（`export declare const X: …` + `export type T = unknown`）能绕开
> TS1479，但会把公开类型降级成 `unknown`、把组件值降级成占位声明 —— **不是可接受的修法**（会静默毁掉消费者体验）。

### 3.4 结论（**这一条是本节的重点，不许含糊**）

| 问题 | 实测答案 |
|---|---|
| tsc 能否产出 CJS 侧的 `.d.cts`？ | **能，但前提是源文件是 `.cts`**。用现在的 `src/**`（`.ts`/`.tsx`）做那一遍 `--module commonjs`，**产出的是 `.d.ts`**（§3.1） |
| 产出的声明内部引用与 CJS 解析兼容吗？ | **`.cts` 源产出的 `.d.cts`：兼容**（`skipLibCheck: false` 也 exit 0，§3.3a）。**把 ESM `.d.ts` 改名成 `.d.cts`：不兼容**，只有 `skipLibCheck: true` 才过（§3.3b） |
| 因此「F1 一行 `--declaration false` 改成打开」够不够？ | **不够**。只打开声明会产出 `.d.ts`，而 `.d.ts` 落在 `{"type":"commonjs"}` 目录里仍然被判成 CJS 声明 —— 拿它当 `require` 的 `types` 目标，实测**和今天一样红**（§5.2 的现状 D 列） |

---

## 4. `exports` 的确切形状

### 4.1 目标形状（每个 JS 子入口，`types` 为**对象**，位置在 `import`/`require` **之前**）

```json
"exports": {
  ".": {
    "types": { "import": "./dist/index.d.ts",        "require": "./dist/cjs/index.d.cts" },
    "import": "./dist/index.js",
    "require": "./dist/cjs/index.cjs"
  },
  "./kit": {
    "types": { "import": "./dist/kit/index.d.ts",    "require": "./dist/cjs/kit/index.d.cts" },
    "import": "./dist/kit/index.js",
    "require": "./dist/cjs/kit/index.cjs"
  },
  "./tabs": {
    "types": { "import": "./dist/tabs.d.ts",         "require": "./dist/cjs/tabs.d.cts" },
    "import": "./dist/tabs.js",
    "require": "./dist/cjs/tabs.cjs"
  },
  "./tooltip": {
    "types": { "import": "./dist/tooltip.d.ts",      "require": "./dist/cjs/tooltip.d.cts" },
    "import": "./dist/tooltip.js",
    "require": "./dist/cjs/tooltip.cjs"
  },
  "./styles.css": "./dist/styles.css",
  "./package.json": "./package.json"
},
"types": "./dist/cjs/index.d.cts",
"main":  "./dist/cjs/index.cjs"
```

### 4.2 它与现有三条件怎么共存

- **顶层仍是「一个子路径 → 一个对象」**，对象里**四个键**：`types`（对象）/ `import` / `require`，以及原有的 `./styles.css`、`./package.json` 两条非 JS 入口（**不动**）。
- **`types` 必须排第一**：`exports` 的条件是**按顺序匹配**的。实测反例（§7 的 D 情形）：把 `require` 放到 `types` **前面**，node16+CJS 直接退化成 **TS1479**（因为 `require` 先命中 `./dist/cjs/*.js`，而它的声明被解析成 ESM 侧）。**这不是风格问题，是正确性问题。**
- **`types` 本身成为对象后，Node 不看它**：Node 只按 `import`/`require`/`default`/`node` 这些它认识的键匹配；`"types"` 对 Node 是**未知条件**，会被跳过。⚠️ **这一条本轮未能实测**（夹具里没有 `deer-ui` 的页面应用去真跑 Node 求值）—— 缺的是「装了包的应用跑 `require()`/`import()`」的端到端夹具；风险极低（这是社区通行做法），但**验收时必须把 `check:dist` 的原生加载冒烟当作它的判据**（它真的 `require()` / `import()` 一次并比导出值集合）。
- **`./styles.css` 与 `./package.json` 保持字符串**，不改形状（它们的 `exports` 值本来就不是对象）。
- **顶层 `types` / `main`**（§4.1 最后两行）只服务 **node10**，见 §6。

### 4.3 与 `check-dist` 判据 ① 的冲突点

`scripts/check-dist.mjs:83-85` 当前是：

```js
const keys = Object.keys(cond);
if (keys[0] !== "types") {
  failures.push(`exports["${label}"] 的条件里 types 不在最前（按顺序匹配）：${keys.join(", ")}`);
}
for (const [kind, target] of Object.entries(cond)) {
  if (!existsSync(path.join(libRoot, target))) failures.push(...);   // ← target 是对象时 path.join 抛 TypeError
}
```

- **冲突 1（判据错）**：`types` 的值是对象时，`keys[0]` 仍是 `"types"`，所以**放松前其实不会因为对象而红**；
  真正会红的是**另一种**写法（把 `types` 写在 `require` 之后）—— 那正是我们**要**红的（§4.2 实测 TS1479）。
  ⇒ 判据 ① 要**保持**「`types` 在最前」，只把措辞从「必须是 `keys[0]`」换成**可判定的位置规则**（§5）。
- **冲突 2（脚本崩，不是判据红）**：`Object.entries(cond)` 走到 `types` 时 `target` 是**对象**，
  `path.join(libRoot, target)` 抛 `TypeError: The "path" argument must be of type string`，
  `check-dist.mjs` **直接崩**（退出码非 0，但没有那条 **FAIL** 行、没有可读原因）。这是 F3 的第二个问题。

---

## 5. F3 —— 放宽后的确切判据（含必须新增的负例）

### 5.1 判定规则（逐条可实现）

对 `pkg.exports` 的**每个键**（跳过 `./package.json`）：

1. 值为**字符串**时（`./styles.css`）：`existsSync(join(libRoot, value))`，不存在即 FAIL。**（不变）**
2. 值为**对象**（JS 子入口）：
   - **a. `types` 必须存在**：`Object.prototype.hasOwnProperty.call(cond, "types")` 为假 → FAIL
     （`exports["<label>"] 缺少 types 条件`）。
   - **b. `types` 的位置必须在 `import` 与 `require` 之前**：
     `const keys = Object.keys(cond);` 令 `iTypes = keys.indexOf("types")`，
     对 `"import"` / `"require"` 中的每一个存在键 `k`，要求 `iTypes < keys.indexOf(k)`；
     违反 → FAIL（`exports["<label>"] 的 types 排在 <k> 之后（exports 按顺序匹配，会导致格式错配）`）。
     **允许** `types` 不是 `keys[0]`（例如将来加 `default`），但**必须**在 `import`/`require` 之前。
   - **c. 逐一 `existsSync` 每个**字符串**目标，并**递归**处理对象**：
     对每个键值对：值为字符串 → `existsSync`；值为对象 → 对它的每个子键值（要求是字符串，否则 FAIL）→ `existsSync`。
     递归深度上限 2 层就够（`types: {import, require}`），但要写成通用递归，且**遇到非字符串叶子必须 FAIL 而不是抛异常**。
   - 不存在的目标 → 原有的 `exports["<label>"].<kind> 目标不存在：<target>` FAIL 文案保留（可加 `.<subKind>`）。
3. **脚本在任何输入下都不许抛未捕获异常**：F3 的验收包含「用畸形 `exports`（对象叶子/数字/null）跑 `check-dist`，退出码 1 且打印 FAIL 行，**不是** `TypeError` 堆栈」。

### 5.2 必须新增的负例（每一条都要**实测**，不许只看代码）

> 负例的做法：把 `package.json` 的 `exports` 临时改成下面的形状 → 跑 `npm run check:dist` → 记录退出码与 FAIL 文案 → **还原**。
> 因为 `check-dist` 读的是仓库根的 `package.json`，负例必须在**仓库里**跑；因此它**只能是 t-verify 的差分实验**，
> 且必须在同一个 turn 内 `git restore package.json`（`git status --porcelain` 必须回到空）。

| # | 构造 | 期望 | 现状（本轮实测） |
|---|---|---|---|
| **N1** | `"./kit": { "import": …, "types": {…}, "require": … }`（`types` 排在 `import` 之后） | **FAIL**，文案含「types 排在 import 之后」 | 现状**不红**（`keys[0]` 仍是 `import` → 命中旧的 `keys[0] !== "types"` → 其实**会红**，但文案是「types 不在最前」，语义对、措辞不准） |
| **N2** | `"./kit": { "require": …, "import": …, "types": {…} }`（`types` 排在最后） | **FAIL** | 现状**会红**（同上） |
| **N3** | `"./kit": { "types": { "import": "./dist/kit/index.d.ts", "require": "./dist/cjs/kit/index.d.cts" }, … }`（`types` 是对象，**当前**代码路径） | **不红**（这是本轮的目标形状，必须能过） | **崩溃**：`path.join` 收到对象抛 `TypeError`（§4.3 冲突 2） |
| **N4** | `"./kit": { "types": { "import": "./dist/kit/NOPE.d.ts" }, … }`（对象里的目标不存在） | **FAIL**，文案指出具体缺失文件 | 崩溃（同 N3） |
| **N5** | `"./kit": { "types": 123, … }`（叶子不是字符串） | **FAIL**，文案指出类型不合法 | 崩溃 |
| **N6** | `"./kit": { "import": …, "require": … }`（**完全没有 `types`**） | **FAIL**，文案含「缺少 types 条件」 | 现状**会红**（`keys[0] !== "types"`），但文案是「不在最前」，语义不准 |

**N3 是「放宽」与「修正」的分界线**：今天 N3 是**崩**，改造后必须是**过**。N1/N2/N6 是「不许为了过 N3 而把判据放松成恒真」的守卫。

### 5.3 F3 的验收判据

- 上述 6 个负例**逐条实测**，退出码与 FAIL 文案记录进任务 output；
- `npm run check:dist` 在**目标形状**上 `OK`（退出码 0），并打印 `39 个产物文件` 或（选项 A 落地后的）新基线；
- `check-dist.mjs` 在**任何** `exports` 输入下都不抛未捕获异常；
- 既有判据 ②…⑦（React 不内联 / 无外链 / 两树互斥 / 相对说明符带后缀 / 原生加载冒烟 / 样式幂等）**不许弱化**。

### 5.4 关于「`.js` → `.cjs`」与产物文件数

若采用 §6 的**选项 A**（唯一能让 `skipLibCheck: false` 也绿的修法），CJS 树会从
`dist/cjs/**/*.js` 变成 `dist/cjs/**/*.cjs`，并**多出一份 `.d.cts`**。文件数**会变**，实测的现状分解是：

| 部位 | 现状（实测） | 选项 A 后 |
|---|---|---|
| ESM 树 `dist/*.js` + `dist/*.d.ts`（含 `kit/`、`internal/`） | 24 | 24（不变） |
| `dist/styles.css` | 1 | 1 |
| `dist/package.json` | 1 | 1 |
| CJS 树 `dist/cjs/**` | **12**（只有 `.js`） | **24**（`.cjs` + `.d.cts`） |
| `dist/cjs/package.json` | 1 | 1 |
| **合计** | **39**（= `check-dist` 打印的「39 个产物文件」） | **51**（预计） |

> **不要把 39 或 51 当常量写进文档**：`check-dist.mjs` 打印的是 `walk(dist)` 的实际条目数，
> 实现落地后**照实测值写**（`WAVE-C-closeout.md` §5.4 的 L-4 就是「写命令而不是写死数字」的教训）。
> 需要同步的地方至少三处：`check-dist.mjs` 里 `.js` / `.d.ts` 的枚举与 `dist/cjs/index.js` 的存在性断言、
> `exports.require` 的目标后缀、以及 `scripts/build-styles.mjs` 的收尾（`dist/cjs/package.json` 的 `type`）。
⚠️ `check-dist.mjs` 第 ⑥ 条里有一处正则会漏掉 `export * from "./x"`（ESM 树）——
它属于 **L 项**，本轮**只登记不修**（§9），但**改 `.cjs` 时必须确认它不会因此变松**。

---

## 6. `.d.cts` 的产出方式：两个选项 + **本轮冻结的推荐**

### 6.1 选项 A（推荐）：`.cts` 镜像源 → 第二遍 tsc 产出**自洽**的 CJS 树

- **做法**：构建时把 `src/**` 复制成一份**临时镜像**（`tsconfig` 的 outDir 之外），扩展名替换
  `.ts → .cts`、`.tsx → .ctsx`，并把文件内**相对 import 的 `.js` 后缀替换成 `.cjs`**；
  用这份镜像跑第二遍 `tsc --module commonjs --declaration true`（`--jsx react-jsx` 保持），
  产出 `dist/cjs/**/*.cjs` + `dist/cjs/**/*.d.cts`；跑完删掉镜像。
- **为什么能成**：实测（§3.2）`.cts` 源产出 `.d.cts`；实测（§3.3a）由 `.cts` 源编出的 `.d.cts`
  在 `skipLibCheck: false` 下也能被 node16+CJS 消费；实测（§3.3b）改名法过不了 `skipLibCheck: false`。
- **实测验证（Option A 形态的最小夹具）**：
  - node16 + CJS，`import { Dialog }` / `import type { DialogProps }` / `import kitNs = require(...)`，
    `--strict --skipLibCheck false --lib ES2020,DOM,DOM.Iterable --module node16 --moduleResolution node16` → **exit 0**
  - node10 根入口 `import { Dialog } from "deer-ui"`，`--module commonjs --moduleResolution node10` + 顶层 `types`/`main` → **exit 0**
- **代价 / 风险（必须在任务书里写明）**：
  1. CJS 树扩展名 `.js → .cjs`；`exports.require`、`check-dist`、`dist/cjs/package.json`（`type: commonjs` 可留可去）同步；
  2. `dist/` 文件数变化 → INV-D6 从「39 文件」升级成**行为判据**（§1 已写）；
  3. **需要一条「镜像与 `src/**` 不许分叉」的守卫**（新断言，例如「镜像由 `src/**` 机械生成，任意文件内容在扩展名替换后逐字节相同」），
     否则镜像树就是第二个真相来源；
  4. `scripts/**` 大改 —— 这是本波次最大的实现风险项。

### 6.2 选项 B（退路）：只做「按格式分流 + 改名」，并把 `skipLibCheck: true` 作为**显式前提**

- **做法**：构建第二遍照旧（或不改），把 `dist/cjs/**/*.d.ts` 复制成 `*.d.cts`（或直接把第二遍的声明输出重命名），
  `exports` 用 §4.1 的两级 `types`（`require` 指向 `.d.cts`）。
- **实测结果**：node16+CJS、node16+ESM、bundler **在 `skipLibCheck: true` 下全绿**；
  **`skipLibCheck: false` 下 node16+CJS 报 TS1479**（报错位置在 `dist/cjs/**/*.d.cts` 内部），node10 报 TS1259。
- **代价**：给消费者留了一条**必须开 `skipLibCheck`** 的前提。`skipLibCheck: true` 在真实工程里很常见（默认常开），
  但它**不是**我们能替消费者保证的东西 —— 这属于「把问题从『拿不到类型』降级为『需要一项编译开关』」，
  不是本波次口径（§0）里的「正确」。

### 6.3 本轮冻结的推荐（**A**）

> **推荐 A，理由是可判定的而不是审美**：口径要求「四个消费者 + node10 的根入口**都要绿**」。
> 实测只有 A 在 `skipLibCheck: false`（= 不靠消费者的开关）下达成 §7 的全部期望退出码；
> B 的绿是**条件绿**，条件不在我们手里。
>
> **若队长判定 A 的改动面（`.cjs` 改名 + 镜像守卫）超出波次 D 的承受范围**，允许退到 B，
> 但**必须**把三件事一起落盘，否则就是掩盖：
> ① `README` 明确写「CJS 消费者需 `skipLibCheck: true`」与原因（引用本文件 §3.3b 的实测）；
> ② 四次消费者验证的 `tsconfig` 里**显式**写 `"skipLibCheck": true`（不许靠默认）；
> ③ 在 `WAVE-C-closeout` 的已知缺口里登记「`.d.cts` 内部与 CJS 不自洽」这一条。
>
> **A 与 B 都做不到的事（本轮明确不做）**：让 `node10 + 子路径`（`deer-ui/kit`）通过 —— 见 §6.4。

### 6.4 node10 的处置：**补顶层 `types` 兜底 = 是；子路径 = 不支持并写进 README**

**实测（确切数据）**：

| 配置 | node10 根入口 `deer-ui` | node10 子路径 `deer-ui/kit` |
|---|---|---|
| 无顶层 `types` / `main`（现状） | **exit 2 / TS2307** | **exit 2 / TS2307** |
| `"types": "./dist/index.d.ts"` | **exit 0**（`skipLibCheck: true`）/ **exit 2 / TS1259**（`false`） | exit 2 / TS2307 |
| `"main": "./dist/cjs/index.js"` | **exit 0**（`skipLibCheck: true`） | exit 2 / TS2307 |
| `"main"` + `"types"` 同时 | **exit 0**（`true`） | exit 2 / TS2307 |
| 选项 A 形态：`"types": "./dist/cjs/index.d.cts"` + `"main": "./dist/cjs/index.cjs"` | **exit 0（`skipLibCheck: false` 也绿）** | exit 2 / TS2307 |

**裁定：补顶层 `types`（+ `main`），并把「node10 只支持根入口、不支持子路径」写进 README。**

理由（逐条客观）：

1. **顶层 `types` 与 `exports.types` 不冲突，且优先级有定论**：`exports` 存在时，
   `node16` / `nodenext` / `bundler` 三种解析**只**走 `exports`，顶层 `types` 被**忽略**（实测：加了顶层 `types`
   之后，node16 的四个消费者退出码一个都没变）；只有 **node10** 会去看顶层 `types`（实测：C6 从红变绿）。
   ⇒ 它不是「重复配置」，而是**只对老解析器生效的兜底**。
2. **顶层 `types` 该指向哪份**：指向 **CJS 声明**（`./dist/cjs/index.d.cts`，选项 A）或 `./dist/index.d.ts`（选项 B 必须配 `skipLibCheck`）。
   实测证据：指向 ESM 的 `./dist/index.d.ts` 时，`skipLibCheck: false` 的 node10 消费者报 **TS1259**
   （"can only be default-imported using the 'esModuleInterop' flag"）—— 因为 node10 是 CommonJS 语义，
   而那份声明是 ESM 的。**结论：顶层 `types` 与顶层 `main` 应当同格式**（都指 CJS 树）。
3. **子路径在 node10 下无解（结构性）**：node10 的解析算法**根本不读 `package.json` 的 `exports`**，
   它的子路径解析是「`node_modules/<pkg>/<subpath>` 当文件/目录找」（实测 trace：直接去找
   `node_modules/deer-ui/kit.{d.ts,ts,tsx}`）。要让它成立只能**在包里再造 `kit.d.ts` / `kit.js` 等物理文件**
   （或 `typesVersions` 重定向），那会**改变 `files`/`dist` 的公开形态**并且**必须动 `package.json` 之外的结构** ⇒ 属另一件事。
4. **口径现在怎么写**：README 必须新增一句「**`moduleResolution: node10`（`node`）只支持根入口 `deer-ui`；
   `deer-ui/kit` / `deer-ui/tabs` / `deer-ui/tooltip` 请用 `node16`/`nodenext`/`bundler`**」，
   并注明这不是缺陷而是 node10 不读 `exports` ≈ 本库是**子路径库**。**不许**写「已支持 node10」。

---

## 7. 四次消费者验证：确切命令 + **实测期望退出码**

### 7.1 命令（可直接抄进任务书；全部落在 `%TEMP%`，靠 junction 复用仓库依赖，不复制 `node_modules`）

```sh
:: ---- 夹具（一次性）----
set F=%TEMP%\deerui-wave-d
rmdir /S /Q "%F%" 2>nul
mkdir "%F%\node_modules"
call npm run build
xcopy /E /I /Y dist "%F%\node_modules\deer-ui\dist" >nul
copy /Y package.json "%F%\node_modules\deer-ui\package.json" >nul
copy /Y LICENSE      "%F%\node_modules\deer-ui\LICENSE" >nul
mklink /J "%F%\node_modules\react"     "Z:\deer-ui\node_modules\react"
mklink /J "%F%\node_modules\react-dom" "Z:\deer-ui\node_modules\react-dom"
mklink /J "%F%\node_modules\@types"    "Z:\deer-ui\node_modules\@types"

:: ---- 七个消费者（4 个「入口 × 解析模式」+ 2 个 node10 专项 + 1 个根入口）----
:: C1 node16 + CJS（子入口、ESM 语法启用 require）
mkdir "%F%\C1" & cd /d "%F%\C1"
echo {"type":"commonjs"}> package.json
( echo import { Dialog } from "deer-ui/kit";
  echo import { TabBar, DropMenu } from "deer-ui/tabs";
  echo import { showTip } from "deer-ui/tooltip";
  echo import { Icon } from "deer-ui";
  echo export const a: typeof Dialog = Dialog;
  echo export const b: typeof TabBar = TabBar;
  echo export const c: typeof DropMenu = DropMenu;
  echo export const d: typeof showTip = showTip;
  echo export const e: typeof Icon = Icon; ) > consumer.cts
node "Z:\deer-ui\node_modules\typescript\lib\tsc.js" --noEmit --strict --skipLibCheck false \
  --lib ES2020,DOM,DOM.Iterable --module node16 --moduleResolution node16 consumer.cts
:: → 期望 exit 0

:: C2 node16 + CJS（import ... = require(...)）
( echo import kitNs = require("deer-ui/kit");
  echo import tabsNs = require("deer-ui/tabs");
  echo export const a = kitNs.Dialog;
  echo export const b = tabsNs.TabBar; ) > consumer2.cts
node "Z:\deer-ui\node_modules\typescript\lib\tsc.js" --noEmit --strict --skipLibCheck false \
  --lib ES2020,DOM,DOM.Iterable --module node16 --moduleResolution node16 consumer2.cts
:: → 期望 exit 0

:: C3 node16 + ESM
mkdir "%F%\C3" & cd /d "%F%\C3"
echo {"type":"module"}> package.json
:: （消费者文件用 consumer.mts；内容与 C1 相同）
node "Z:\deer-ui\node_modules\typescript\lib\tsc.js" --noEmit --strict --skipLibCheck false \
  --lib ES2020,DOM,DOM.Iterable --module node16 --moduleResolution node16 consumer.mts
:: → 期望 exit 0

:: C4 bundler（无 type 字段）
mkdir "%F%\C4" & cd /d "%F%\C4"
:: （消费者文件用 consumer.ts；内容与 C1 相同）
node "Z:\deer-ui\node_modules\typescript\lib\tsc.js" --noEmit --strict --skipLibCheck false \
  --lib ES2020,DOM,DOM.Iterable --module esnext --moduleResolution bundler consumer.ts
:: → 期望 exit 0

:: C5 node10 + **子路径**（预期仍红：node10 不读 exports）
node "Z:\deer-ui\node_modules\typescript\lib\tsc.js" --noEmit --strict --skipLibCheck false \
  --lib ES2020,DOM,DOM.Iterable --module commonjs --moduleResolution node10 consumer.ts
:: → 期望 exit 2 / TS2307（这是**登记为已知限制**的）

:: C6 node10 + **根入口**（顶层 types/main 的判据）
( echo import { Dialog, TabBar, showTip } from "deer-ui";
  echo import type { DialogProps, TabItem, Tip } from "deer-ui";
  echo export const a: typeof Dialog = Dialog;
  echo export const p: DialogProps = { title: "x" }; ) > consumer-root.ts
node "Z:\deer-ui\node_modules\typescript\lib\tsc.js" --noEmit --strict --skipLibCheck false \
  --lib ES2020,DOM,DOM.Iterable --module commonjs --moduleResolution node10 consumer-root.ts
:: → 期望 exit 0
```

> `--lib ES2020,DOM,DOM.Iterable` 是**必须**的：实测发现只给 `target: ES2020` 时，
> node10 路径会因 `@types/react` 引用 `Iterable` 而报 TS2304，那是**夹具缺 lib**，不是库的问题。

### 7.2 期望退出码表（**上表是本轮实测**；`+` = 修好后必须达到）

| 消费者 | 现状（实测） | 选项 A 目标（实测达成） | 选项 B 目标（实测达成，需 `skipLibCheck: true`） |
|---|---|---|---|
| C1 node16 + CJS（`import {}`） | **exit 2 / TS1479** | **exit 0** | exit 0 |
| C2 node16 + CJS（`import = require`） | **exit 2 / TS1471** | **exit 0** | exit 0 |
| C3 node16 + ESM | exit 0 | **exit 0** | exit 0 |
| C4 bundler | exit 0 | **exit 0** | exit 0 |
| C5 node10 子路径 | exit 2 / TS2307 | **exit 2 / TS2307**（已知限制，写进 README） | exit 2 / TS2307 |
| C6 node10 根入口 | **exit 2 / TS2307** | **exit 0**（顶层 `types` + `main` 指 CJS 树） | exit 0（`skipLibCheck: true`） |
| C7 node16 + ESM 根入口 | exit 0 | **exit 0** | exit 0 |

**A 的 7/7 与 B 的 7/7（带开关）都是实测结果**，不是推断：
A 形态的最小夹具跑出
`node16+CJS subpath skipLibCheck=false exit=0`、`node10 root skipLibCheck=false exit=0`；
B 形态跑出 `shape=after skipLibCheck=true` 全绿、`skipLibCheck=false` 在 C1/C2 → TS1479、C6 → TS1259。

### 7.3 差分判据（「新判据不是恒真」）

| 判据 | 差分做法 | 期望 |
|---|---|---|
| F1 的 `types` 分流真的在起作用 | 把 `exports.*.types` 从对象改回字符串（`./dist/x.d.ts`），重跑 C1/C2 | 必须退回 **TS1479 / TS1471** |
| `types` 的顺序真的重要 | 把 `require` 提到 `types` 之前，重跑 C1 | 必须退回 **TS1479** |
| `.d.cts` 真的被读到了 | 删掉 `dist/cjs/kit/index.d.cts`，重跑 C1 | 必须红（`types` 目标不存在 / 解析失败） |
| 顶层 `types` 真的在起作用（node10 根入口） | 删掉顶层 `types` 与 `main`，重跑 C6 | 必须退回 **TS2307** |
| F3 的负例不恒真 | §5.2 的 N1…N6 | 见 §5.2 的期望列 |

---

## 8. 文件归属表（每个路径**只有一个主人**，两两不相交）

> 硬约束（范围 B 的教训，逐条照做）：任务的 `acceptance` / `verify` / `inScope` **创建后不可修订**，
> 且全局 inScope 冲突校验会让「范围与任何现存任务相交」的任务**永远无法再编辑**。
> ⇒ **写任务书时必须一次写对**；下面每个路径只出现一次。

| 路径 | 唯一主人 | 动作 |
|---|---|---|
| `package.json` | **双格式产物工程师** | 写：`exports` 的四个 JS 子入口改成两级 `types`；顶层 `types` + `main`；`build` 脚本第二遍的命令（`.cjs` + 声明） |
| `tsconfig.build.json` | **双格式产物工程师** | 写：第二遍产物配置（若把 CLI 参数固化进配置） |
| `scripts/build-styles.mjs` | **双格式产物工程师** | 写：构建收尾对 `dist/cjs` 的作用域文件（`type: commonjs`）与 `.cjs` 产物的处理 |
| `scripts/*.mjs`（**新增**：`build-cjs.mjs` 或等价物） | **双格式产物工程师** | 写：`.cts` 镜像生成 → 第二遍 tsc → 镜像清理（选项 A）/ 声明改名（选项 B） |
| `scripts/check-dist.mjs` | **check-dist 工程师** | 写：判据 ① 放宽（`types` 存在且位置在 `import`/`require` 之前、允许对象、递归 `existsSync`、叶子类型守卫）；防崩溃；`.cjs` 枚举同步；**不改**既有判据 ②…⑦ 的语义 |
| `tests/dist.test.ts`（**新增**）或 `tests/infra.test.ts` | **check-dist 工程师** | 写：F3 的**负例夹具**（把 §5.2 的 N1…N6 形状喂给一个可导入的校验函数/子进程），使负例可重复、不依赖「临时改根 `package.json`」 |
| `tests/budget.test.ts` | **文档/计数工程师** | 写：注释里的现值（222 → 本轮新值）；**三道下限数值不动** |
| `README.md` | **文档/计数工程师** | 写：`exports` 新形状的说明；**node10 只支持根入口**的措辞（§6.4）；CJS 消费者的类型解析说明；验证命令与实际数字 |
| `CHANGELOG.md` | **文档/计数工程师** | 写：波次 D 条目（F1 + F3）、`assertions: N`、产物文件数新基线 |
| `src/**` | **无人（冻结）** | 只读；**一个字节不许改**（INV-D1）。差分验证允许临时改动，**同一 turn 内必须还原** |
| `tests/snapshots/barrel-exports.json` | **无人（冻结）** | 只读（INV-D2）；不许跑 `npm run snapshot:barrel` |
| `tests/ui-kit.test.tsx` / `tests/ui-hooks.test.tsx` / `tests/a0-*.ts` / `tests/scan.ts` / `tests/styles.test.ts` / `tests/common.ts` / `tests/env.ts` / `tests/dom-stub.ts` / `tests/run-tests.ts` | **无人（除非 check-dist 工程师需要注册新测试文件）** | 只读；如需新增测试文件，只有 `tests/run-tests.ts` 会被**同一个主人**（check-dist 工程师）改一次 |
| `docs/REQUIREMENTS-freeze-D.md` | **本文件（t10）** | 已写完；改它必须给新判据 + 命令 |
| `dist/**` / `tests/.ts-out/**` | **无主人**（gitignore 再生成产物） | 任何任务可重建；**不得入库**；差分验证破坏后**必须** `npm run build` 复原 |

**串行顺序（DAG 硬要求）**

```
t10(本文件)
 ├─→ t11 F3（check-dist 放宽 + 负例夹具）──┐
 ├─→ t12 F1（exports 形状 + .d.cts 产出）─┴─→ t13 消费者验证（7 条命令 + 差分）─→ t14 集成收尾
 └─→ t15 双格式/消费者独立审查（读侧，零写入）──────────────────────────────────┘
```

- **t11 与 t12 可并行**：路径不相交（`scripts/check-dist.mjs` + 新测试文件 vs `package.json` + `scripts/*.mjs`）。
  目标形状落地前，t11 的「对象形态」判据可以用**合成 `exports` 对象**测（喂给校验函数），不依赖 t12。
- **t13 必须晚于 t11 与 t12**：它跑的是真产物 + 真 `package.json`。
- **t13 与 t12 不得并行**：两者都会重建 `dist/`（同一份工作区资源）。
- **t15（审查）读侧零写入**：不得改任何文件；如需差分，只许动 `%TEMP%` 与 `dist/`（后者必须复原）。

---

## 9. 本轮明确**不做**的事

| # | 不做 | 理由 |
|---|---|---|
| **N-1** | **node10 + 子路径**（`deer-ui/kit` 在 `moduleResolution: node10` 下可解析） | node10 的算法**不读 `exports`**（实测 trace 直接找 `node_modules/deer-ui/kit.d.ts`）⇒ 只能靠再造物理文件或 `typesVersions`，会改变 `dist`/`files` 的公开形态。本轮**只做根入口兜底 + README 写明不支持子路径**（§6.4）。 |
| **N-2** | **L-1**（CJS 树的相对 `require` 判据不承重、可绕：`require("./"+"primitives")` 能全绿） | 「模块图级」判据是新判据，属 N-2 那一类，本轮**只登记**（`WAVE-C-closeout.md` §5.4）。 |
| **N-3** | **L-2**（`check-dist` 只比导出**名字集合**，不比实现/身份 ⇒ 抓不到双包单例分裂） | 同上，需模块图/身份级判据。**本轮不动**。 |
| **N-4** | **L-5**（A0-3 的 `env()` 例外口径收紧） | 属范围 C 登记的判据强度项，与 F1/F3 无关；收紧要同步改自检样本与注入负例（`tests/**`），本轮不做。 |
| **N-5** | **`check-dist` 第 ⑥ 条 ESM 相对说明符正则漏 `export * from`**（本轮只读复核发现） | 属 **L-1/L-2 同族**（判据强度），本轮**只登记**；但§5.4 要求「改 `.cjs` 时确认它不会因此变松」。 |
| **N-6** | **改包名 / 改子路径前缀**（`deer-ui` → `@deerluu/deer-ui`） | `private: true` + 裸名被占；改前缀等于改公开导入面，与「导出面冻结」冲突。 |
| **N-7** | **`Dialog` 焦点陷阱 / portal / `aria-live`** | 会改 DOM 层级 = 破坏 INV-D1；范围 A 已驳回。 |
| **N-8** | **lint / format 工具链** | 本仓库**没有 `npm run lint`**（`package.json.scripts` 里不存在），也没有任何 ESLint/Prettier 配置；范围 A §F-1 已明确排除。**任何 `verify` / `acceptance` 里都不得出现 `npm run lint`**，也不得为了让它绿去造一个恒真的 lint script。 |
| **N-9** | **让 `skipLibCheck: false` 之外的「更严格」验证**（如 `exactOptionalPropertyTypes`、`verbatimModuleSyntax` 全开下的消费者矩阵） | 属扩大范围；本轮只验证 §7 的 7 个消费者。 |
| **N-10** | **改 `dist/styles.css` / 令牌 / 样式归属判据** | INV-D3；与 F1/F3 无关。 |
| **N-11** | **发 npm / `npm publish` / 改 `version`** | `private: true`；发布面未定型。 |

---

## 10. 验收判据（波次 D 的 PASS/FAIL）

PASS 当且仅当：

1. **F1**：§4.1 的 `exports` 形状落地（四个 JS 子入口 + 顶层 `types`/`main`），且 §7.2 的**目标**退出码逐条达成
   （选项 A：C1/C2/C3/C4/C6/C7 全 exit 0，C5 exit 2/TS2307 为登记限制；选项 B：同前但验证需显式 `skipLibCheck: true`，并按 §6.3 的 ①②③ 一起落盘）。
2. **F3**：§5.1 的判定规则落地；§5.2 的 **N1…N6 逐条实测**（N3 从「崩」变「过」，N1/N2/N6 必须红）；
   `check-dist` 在任何 `exports` 输入下不抛未捕获异常；既有判据 ②…⑦ 未弱化。
3. **不变量 INV-D1…D8 全部成立**（尤其 INV-D6 的四条入口导出值集合与一致性、`require`/`import` 各 30）。
4. **差分**：§7.3 的五条差分逐条有「改坏 → 红/退化 → 还原 → 绿」的实测记录。
5. **文档三处一致**：`npm test` 的 `assertions:` / `README.md` / `CHANGELOG.md` 的数字相同；产物文件数按**实测新基线**写。
6. `git status --porcelain` 空；`npm run check:dist` OK；`npm test` 末两行 `assertions: N` / `ALL PASS`。

**FAIL 的典型信号**：C1 或 C2 仍报 TS1479/TS1471；`types` 被写成字符串（退化成现状）；`types` 排在 `require` 之后；
`check-dist` 在对象形状上打印 `TypeError` 堆栈而不是 FAIL 行；`src/**` 出现 diff；
`tests/snapshots/barrel-exports.json` 出现 diff；`styles.css` 字节数变化；`require`/`import` 的导出数不等于 30；
三道预算下限被上调；`npm run lint` 出现在任何 verify 里。

---

## 11. 冻结声明

- 本文件是波次 D 的**需求与验收口径**，不是实现方案。实现只许照 §1 不变量与 §4/§5/§6/§7 的判定来。
- §3 的实测结论（**tsc 用现有 `src/**` 产出 `.d.ts` 而不是 `.d.cts`**、**改名法过不了 `skipLibCheck: false`**）**已冻结**：
  任何「顺手把 `--declaration false` 改成打开」的方案都要先通过 §7.1 的 C1/C2 —— 实测会红。
- §6 的处置（**补顶层 `types` + `main`；node10 只支持根入口**）与 §9 的「不做」清单**已冻结**。
- 要改本文件任何一条，必须同时给出新的**客观判定方式**与**命令**，并在提交信息里写明理由。
