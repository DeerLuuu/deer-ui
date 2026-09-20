# 贡献指南（CONTRIBUTING）

deer-ui 是一个**独立的 React 18 控件库**：`dist/` **不入库**，仓库里只有 `src` + 测试 + 构建脚本，
`npm ci` / `npm pack` 都会先把 `dist/` 建出来（见 `README.md`「安装」）。

这份指南只写**本仓库真的能跑的命令**。下面出现的每一条都在 `package.json` 的 `scripts` 里，
没有一条是「应该有但还没有」的：本仓库现在**没有** lint / format 工具链，所以本文档里**不会**出现
lint / format 类的命令（这个缺口的解除条件登记在 `CHANGELOG.md` 的「本轮登记但不实施」）。

---

## 1. 三条不变量（改之前先读）

改动撞上任何一条，都不是「风格问题」，而是**不变量违反**：

| # | 不变量 | 它意味着什么 | 谁在盯 |
|---|---|---|---|
| **INV-A** | **DOM 契约是公开面，只许在一处改** | 控件的类名、元素层级、`role` / `aria-*` **就是**库的 API（宿主的样式与引导锚点按它们写）。要改就同时改 `src` 与 `tests/ui-kit.test.tsx` 里对应的断言，并在提交信息里写明；**不许**只在源码里悄悄改掉、也不许把断言删了了事 | `ui.*` 断言（现 71 条，只许涨；`tests/ui-kit.test.tsx` 是 DOM 契约那一份，`tests/ui-hooks.test.tsx` 是 effect 生命周期那一份） |
| **INV-B** | **不引运行时依赖** | `dependencies` 必须一直是空的；`react` / `react-dom` 只是 `peer`。`src/**` 只许 import `react` / `react-dom` 家族与库内相对路径（不得越出 `src/`），也不许 `localStorage` / `sessionStorage` | `kit.purity.offenders` / `kit.host.no-storage`（A0-1、A0-3） |
| **INV-C** | **不得自判 PC / 主题 / 安全区** | 库不探测指针设备、不写 `data-pc` / `data-theme`、不写 `--sat/--sab/--sal/--sar`：这些都**由宿主判定后推入**（`setKitPcMode` / `kitPcOn`、写 `<html data-theme="light">`）。允许 `window.innerWidth` 这类**测量**用法与 `(orientation: landscape)` 这类布局查询 | `kit.pcmode.pushed-not-detected` / `kit.theme.host-owned` / `kit.safearea.host-owned`（A0-3） |

本轮的完整冻结口径（范围、bug 三态裁定、验收命令）在 `docs/REQUIREMENTS-freeze.md`。

---

## 2. 本地起步

```sh
git clone https://github.com/DeerLuuu/deer-ui.git deer-ui
cd deer-ui
npm ci                     # 按 package-lock.json 装，严格一致；装完会顺带跑一次 prepare（= build）
```

- **`npm ci` 会顺带跑 `prepare`（= `npm run build`）**，所以装完 `dist/` 就已经有了 —— 这是
  「产物不入库」的库仓库的正常形态，重复跑是幂等的。
- ⚠️ **别在库仓库自己的树上跑 `npm ci --omit=dev`**：`prepare` 需要 `typescript`（devDependency），
  省掉 dev 依赖它当场红（`[deer-ui] 找不到可用的 tsc…`）。消费者项目里 `--omit=dev` 没问题。
- 真的没网时只有一条应急路：`DEERUI_DEPS_SOURCE=<某个已装好的 node_modules> npm run link:devdeps`。
  它把 devDependency 以 junction 链进来，**不是**一次真安装（不写 lockfile、不校验 integrity），
  只配当应急手段。

---

## 3. 提交前必跑

与 `.github/workflows/ci.yml` 的步骤**同一顺序**（CI 只是多一步 `npm ci`）：

```sh
npm run typecheck && npm run build && npm test && npm run check:dist
```

| 命令 | 它判什么 | 期望 |
|---|---|---|
| `npm run typecheck` | `src`（`strict: true`、`noEmitOnError`）+ `examples/`（独立 tsconfig） | 退出码 0 |
| `npm run build` | `tsc -p tsconfig.build.json`（逐文件 ESM + `.d.ts`）→ 拼 `dist/styles.css` | 退出码 0，末尾打印字节数 / 规则数 / 行数 |
| `npm test` | 编译 `tests/` 到 `tests/.ts-out/` 后运行 | 末两行 `assertions: N` 与 `ALL PASS`，且 **N ≥ 134** |
| `npm run check:dist` | 产物自检（`exports` 目标存在、`types` 条件在前、无 React 内联、无外链、样式幂等） | `OK` |

- **顺序不能反**：`check:dist` 是**对 `dist/` 的**自检，没 build 过就没东西可检。
- **新增断言必须同步计数**：`tests/budget.test.ts` 钉着两个**下限**（`ui.* ≥ 62` 与
  `kit.*` + `lib.*` ≥ 72，**分开判** —— 总数会掩盖「基建长胖、控件契约变少」）；涨断言不用改下限，
  但 `README.md` 里的断言数字（「开发与调试」「断言台账」「这个版本验证到了哪一步」三处）要跟着实测值改。
- **别提交产物**：`git status --porcelain` 里不该出现 `dist/`、`tests/.ts-out/`、`*.tgz`
  （`.gitignore` 已覆盖）。

---

## 4. 改公开导出面（唯一合法的流程）

`tests/snapshots/barrel-exports.json` 是导出面的**唯一判据**：它按 `package.json` 的 `exports`
逐入口记下每个符号。有意改动时：

```sh
npm run snapshot:barrel                 # 编译 tests/ 后以 --update-barrel 重写快照
git diff -- tests/snapshots/barrel-exports.json   # 逐符号看：加了什么 / 删了什么 / 改了什么
npm test                                # 再跑一遍，确认新快照与产物一致
```

然后**在提交信息里写明**加了 / 删了 / 改了哪些符号，并同步 `README.md`「组件清单」里的符号数
（那是人工对齐的 —— 没有断言拿 README 跟快照比）。

> ⚠️ `npm run snapshot:barrel` **不会**替你判断这次改动该不该做：它只把现状写成新快照。
> 导出面缩水（例如根入口少 re-export 一个子入口）同样会「通过」—— 判断责任在人，
> 提交信息是唯一的记录点。

---

## 5. 改 DOM 契约（= 改公开面）

1. 先改 `src/**`；
2. 同步改 `tests/ui-kit.test.tsx` 里对应的 `ui.*` 断言（**改语义**，不是删断言）；新增的断言名沿用
   `ui.<组件>.<行为>` 形态，条数只许涨；
3. 跑 `npm test`，并用 `npm run check:dist` 确认样式产物没被顺带改坏；
4. 提交信息里写明「改了什么契约、为什么」；能改出**回归断言**的，就带上一条。

**不要**为了「看起来进了公开面」而给 `src/index.ts` 写实现：根入口只许 re-export
（`kit.barrel.reexport-only` 盯着这条）。

---

## 6. 提交与行尾

- **行尾一律 LF**。库根 `.gitattributes` 里唯一的生效指令是 `* text=auto eol=lf`；
  `.editorconfig` 的 `end_of_line = lf` 是同一条铁律的编辑器侧。为什么不洁癖：
  `npm pack` / `pack:vendor` 打的是**工作区文件的快照**，行尾一随平台变，同一个 commit
  就会打出**字节不同**的 tarball（宿主把 bytes / md5 / sha256 与 lockfile 的 `integrity` 钉死了）。
- 自查：`git ls-files --eol` 里每一行都该是 `i/lf w/lf`。出现 `w/crlf` 就是你的编辑器在写 CRLF
  （`.gitattributes` 只保证**下一次检出**是 LF，不会改写你当前的工作区文件）。
- 提交信息写清**改动面**：改了哪些文件性质、是否触及导出面 / DOM 契约（触及必须显式写
  「导出面未变」或「有意变更 + 增删清单」）。

---

## 7. 命令速查（= `package.json` 的 `scripts`，逐条对应）

| 命令 | 实际做的事 |
|---|---|
| `npm ci` | 按 `package-lock.json` 装依赖；**顺带跑 `prepare`（= build）** |
| `npm run prepare` | `npm run build`（`npm ci`/`npm install` 自动触发；git 依赖安装时也靠它） |
| `npm run typecheck` | `tsc -p tsconfig.json --noEmit` + `tsc -p tsconfig.examples.json` |
| `npm run build` | `tsc -p tsconfig.build.json`（→ `dist/**`）→ `node scripts/build-styles.mjs`（→ `dist/styles.css`） |
| `npm test` | `tsc -p tests/tsconfig.json` → `node tests/.ts-out/tests/run-tests.js` |
| `npm run test:build` | 只编译 `tests/`（不运行）；改测试时想快速看类型错误用它 |
| `npm run snapshot:barrel` | 编译 `tests/` 后以 `--update-barrel` 运行，重写导出面快照 |
| `npm run check:dist` | `node scripts/check-dist.mjs`（产物自检；**在 build 之后**跑） |
| `npm run prepack` | `npm run build && npm run check:dist`（`npm pack` / `npm publish` 前自动跑） |
| `npm pack` | 出 `deer-ui-0.1.0.tgz`（走 `files` 白名单：`dist` / `LICENSE` / `README.md`） |
| `npm run pack:vendor` | 再落一份宿主约定的 `deerui-0.1.0.tgz`，并打印进包文件数与 bytes / md5 / sha256 |
| `npm run link:devdeps` | 无网应急：按 `DEERUI_DEPS_SOURCE` 把 devDependency 链进 `node_modules/` |

`README.md`「开发与调试」里出现的命令是这张表的一个子集，两者不许出现对方没有的命令。

---

## 8. 现在能改什么、暂时别改什么

- **欢迎**：`src/**` 的 bug 修复（带回归断言）、文档对账（README 里与实测不符的数字 / 陈述）、
  `tests/**` 的**新增**断言。
- **暂时别动**（不是永久禁令，是「要动就先改冻结口径」）：引入 lint / format 工具链、引入
  任何新依赖（含 jsdom / vitest / puppeteer）、改包名或 `exports` 子路径、给 `Dialog` 加
  portal / 焦点陷阱 / 关闭后归还焦点、把 `dist/` 提交进仓库。
  这些的**理由与解除条件**记在 `CHANGELOG.md` 的「本轮登记但不实施」一栏。
