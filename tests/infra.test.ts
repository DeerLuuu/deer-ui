/**
 * 库测试基建自身的断言（方案 §4.4 契约层 / R9）。
 *
 * R9 的实测教训：应用侧有测试**单跑**时 `window is not defined`（只有全套跑才过，靠前面某个测试装的桩）。
 * 库这一侧不许继承这种隐式顺序依赖 —— 所以：
 * ① 自带 DOM 桩（`tests/dom-stub.ts`），**用完还原**，不依赖也不污染全局；
 * ② 库根必须能从产物路径反推出来，且确实指到本仓库（不是哪个 `node_modules` 里的副本）。
 */

import { ok } from "./common";
import { fs, libRoot, path, readText, srcDir } from "./env";
import { installDomStub } from "./dom-stub";

export function testInfra(): void {
  const g = globalThis as any;

  const root = libRoot();
  ok("lib.runner.lib-root", fs.existsSync(path.join(root, "package.json")), "root=" + root);

  const manifest = JSON.parse(readText(path.join(root, "package.json")));
  ok("lib.runner.package-name", manifest.name === "deer-ui", "name=" + manifest.name);
  const licensePath = path.join(root, "LICENSE");
  ok("lib.runner.license-matches-file", manifest.license === "MIT" && fs.existsSync(licensePath),
    "license=" + manifest.license + " / LICENSE 存在：" + fs.existsSync(licensePath));
  const ignorePath = path.join(root, ".gitignore");
  ok("lib.runner.gitignore-has-dist", fs.existsSync(ignorePath) && readText(ignorePath).indexOf("dist/") >= 0);
  ok("lib.runner.src-dir", fs.existsSync(srcDir()), "src=" + srcDir());

  const restore = installDomStub();
  ok("lib.runner.dom-stub.window", typeof g.window === "object" && typeof g.window.innerWidth === "number");
  ok("lib.runner.dom-stub.document", typeof g.document === "object" && typeof g.document.createElement === "function");
  ok("lib.runner.dom-stub.matchmedia", g.window.matchMedia("(pointer: fine)").matches === false);
  ok("lib.runner.dom-stub.rect", typeof g.document.createElement("div").getBoundingClientRect().width === "number");
  restore();
  ok("lib.runner.dom-stub.restored", typeof g.window === "undefined" && typeof g.document === "undefined");
}
