// Stand-in native tools for tests: Node scripts.

import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** A stand-in executable `name` in `directory` that runs `source` with Node. */
export function nodeStandIn(directory: string, name: string, source: string): string {
  const script = join(directory, `${name}.ts`);
  writeFileSync(script, `#!/usr/bin/env node\n${source}`);
  chmodSync(script, 0o755);
  // Windows starts no script by its shebang: a .cmd file runs it through Node.
  if (process.platform !== "win32") return script;
  const program = join(directory, `${name}.cmd`);
  writeFileSync(program, `@"${process.execPath}" "${script}" %*\r\n`);
  return program;
}
