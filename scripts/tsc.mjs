#!/usr/bin/env node
/**
 * 选一个能用的 tsc 再跑（npm 脚本里所有 tsc 调用都走这里）。
 * 「怎么找 tsc」的两级顺序与那条 `bin/tsc` 的坑写在 `scripts/tsc-path.mjs`。
 */
import { runTsc } from "./tsc-path.mjs";

process.exit(runTsc(process.argv.slice(2)));
