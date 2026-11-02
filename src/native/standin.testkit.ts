// Stand-in native tools for tests: shell scripts.

import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** A stand-in executable `name` in `directory` that runs the given shell lines. */
export function shellStandIn(directory: string, name: string, lines: readonly string[]): string {
  const path = join(directory, name);
  writeFileSync(path, ["#!/bin/sh", ...lines, ""].join("\n"));
  chmodSync(path, 0o755);
  return path;
}

/** A stand-in executable that prints the given lines and exits with `exit`. */
export function standIn(directory: string, name: string, lines: string[], exit = 0): string {
  return shellStandIn(directory, name, [...lines.map((line) => `echo '${line}'`), `exit ${exit}`]);
}
