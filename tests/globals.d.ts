/**
 * 本仓库**不引 @types/node**：库测试真正用到的 Node API 只有 `require` / `__dirname` / `process` 三样
 * （其余走 `tests/env.ts` 的薄封装，见那里为什么这样包）。这里集中声明一次，别在每个文件里重复。
 * （应用侧 PixelCraft 的 tests/ 也是同样的做法。）
 */
declare const require: (m: string) => any;
declare const __dirname: string;
declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  exitCode?: number;
};
