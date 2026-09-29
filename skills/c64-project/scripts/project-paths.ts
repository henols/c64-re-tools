#!/usr/bin/env node
// project-paths.ts
//
// Where this toolkit's data lives, resolved portably.
//
// These modules ship as a bundled skill toolkit and may be installed at any
// depth in any project, so nothing here counts directory hops. Two rules:
//
//   1. The project root is, in this order: `C64RE_PROJECT_ROOT`, then
//      `CLAUDE_PROJECT_DIR`, then the nearest directory with a `.git` entry
//      at or above the current working directory. The walk starts at the
//      working directory and never at this file: an installed skill can sit
//      outside the project it works on.
//   2. Every data location is overridable by environment variable, so a project
//      that does not use this repo's `recovery/` + `disks/` layout can point the
//      toolkit at its own without editing any module.
//
// Every function computes its answer when it is called. Importing this module
// does no work, so a script that does not need a project root still loads
// outside a checkout.
//
// Pure path arithmetic over the filesystem. Contacts nothing.
import { existsSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, parse } from "node:path";

/**
 * The project root: `C64RE_PROJECT_ROOT`, then `CLAUDE_PROJECT_DIR`, then the
 * nearest ancestor of `process.cwd()` (itself included) that holds a `.git`
 * entry. Throws, naming the start directory and the variable to set, when
 * none of the three gives a root.
 */
export function projectRoot(): string {
  if (process.env.C64RE_PROJECT_ROOT) return resolve(process.env.C64RE_PROJECT_ROOT);
  if (process.env.CLAUDE_PROJECT_DIR) return resolve(process.env.CLAUDE_PROJECT_DIR);
  const start = process.cwd();
  let dir = start;
  const { root } = parse(dir);
  while (true) {
    if (existsSync(join(dir, ".git"))) return dir;
    if (dir === root) break;
    dir = dirname(dir);
  }
  throw new Error(
    "project-paths: could not locate the project root -- no `.git` found at or above " +
      `${start}, and neither C64RE_PROJECT_ROOT nor CLAUDE_PROJECT_DIR is set. Set C64RE_PROJECT_ROOT ` +
      "to the directory that holds your data dirs.",
  );
}

/**
 * Directory holding the release registry and the per-release dump directories.
 * Defaults to `<project root>/recovery`; override with `C64RE_DATA_DIR`.
 */
export function dataRoot(): string {
  return process.env.C64RE_DATA_DIR
    ? resolve(process.env.C64RE_DATA_DIR)
    : join(projectRoot(), "recovery");
}

/**
 * Directory holding the disk images a registry entry's `disk_image` is
 * relative to. Defaults to the project root itself, because registry entries
 * record project-relative paths like `disks/foo.d64`; override with
 * `C64RE_DISKS_ROOT` when they are relative to something else.
 */
export function disksRoot(): string {
  return process.env.C64RE_DISKS_ROOT
    ? resolve(process.env.C64RE_DISKS_ROOT)
    : projectRoot();
}

/** The release registry file. Override the whole path with `C64RE_REGISTRY`. */
export function registryFile(): string {
  return process.env.C64RE_REGISTRY
    ? resolve(process.env.C64RE_REGISTRY)
    : join(dataRoot(), "RELEASES.json");
}

/** One release's own data directory. */
export function releaseDataDir(id: string): string {
  return join(dataRoot(), id);
}

/** The four roots, or a refusal that names why the project root is unknown. */
export function resolvedRoots():
  | { ok: true; projectRoot: string; dataRoot: string; disksRoot: string; registry: string }
  | { ok: false; message: string } {
  try {
    return { ok: true, projectRoot: projectRoot(), dataRoot: dataRoot(), disksRoot: disksRoot(), registry: registryFile() };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// True when this file is the process entry point, also when it runs through a symlink.
const invokedDirectly = process.argv[1] !== undefined && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const result = resolvedRoots();
  if (result.ok && !process.argv.includes("--json")) {
    console.log(`project root: ${result.projectRoot}`);
    console.log(`data root:    ${result.dataRoot}`);
    console.log(`disks root:   ${result.disksRoot}`);
    console.log(`registry:     ${result.registry}`);
  }
  console.log(JSON.stringify(result));
  process.exitCode = result.ok ? 0 : 1;
}
