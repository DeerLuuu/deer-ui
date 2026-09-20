/**
 * 本仓库**不引 @types/node**（离线装不上；PixelCraft 的 tests/ 也是同样的做法：每个文件自己
 * `declare const require`）。这里把库测试真正需要的三样东西集中声明一次。
 */
declare const require: (m: string) => any;
declare const __dirname: string;
declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  exitCode?: number;
};
