// pnpm test: node --test over the given test files, or over every test. Every
// node process of the run, also each script that a test starts, shares one
// compile cache, so a module is type-stripped once and not at each start.

import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const files = process.argv.length > 2 ? process.argv.slice(2) : ["src/**/*.test.ts", "test/**/*.test.ts"];
const run = spawnSync(process.execPath, ["--test", ...files], {
  stdio: "inherit",
  env: { NODE_COMPILE_CACHE: join(root, "node_modules", ".cache", "node-compile-cache"), ...process.env },
});
process.exit(run.status ?? 1);
