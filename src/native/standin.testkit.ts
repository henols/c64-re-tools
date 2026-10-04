// Stand-in native tools for tests: shell scripts that print fixed lines.

import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** A stand-in executable that prints the given lines and exits with `exit`. */
export function standIn(directory: string, name: string, lines: string[], exit = 0): string {
  const path = join(directory, name);
  writeFileSync(path, `#!/bin/sh\n${lines.map((line) => `echo '${line}'`).join("\n")}\nexit ${exit}\n`);
  chmodSync(path, 0o755);
  return path;
}
