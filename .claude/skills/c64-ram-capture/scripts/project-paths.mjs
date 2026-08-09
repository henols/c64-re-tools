#!/usr/bin/env node
// Where this toolkit's data lives, resolved portably.
//
// These modules ship as a bundled skill toolkit and may be installed at any
// depth in any project, so nothing here counts directory hops. Two rules:
//
//   1. The project root is found by walking UP for a `.git` marker. Counting
//      hops from `import.meta.url` breaks the moment the toolkit is installed
//      somewhere other than `.claude/skills/<skill>/scripts/`, and it breaks
//      silently -- paths resolve to a plausible wrong place rather than erroring.
//   2. Every data location is overridable by environment variable, so a project
//      that does not use this repo's `recovery/` + `disks/` layout can point the
//      toolkit at its own without editing any module.
//
// Pure path arithmetic over the filesystem. Contacts nothing.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, parse } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Nearest ancestor directory containing a `.git` entry, starting from this
 * file. Falls back to `C64RE_PROJECT_ROOT` when set, which also covers the
 * case of running from an export with no git metadata at all.
 */
export function projectRoot() {
  if (process.env.C64RE_PROJECT_ROOT) return resolve(process.env.C64RE_PROJECT_ROOT);
  let dir = HERE;
  const { root } = parse(dir);
  while (true) {
    if (existsSync(join(dir, ".git"))) return dir;
    if (dir === root) break;
    dir = dirname(dir);
  }
  throw new Error(
    "project-paths: could not locate the project root -- no `.git` found above " +
      `${HERE}. Set C64RE_PROJECT_ROOT to the directory that holds your data dirs.`,
  );
}

/**
 * Directory holding the release registry and the per-release dump directories.
 * Defaults to `<project root>/recovery`; override with `C64RE_DATA_DIR`.
 */
export function dataRoot() {
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
export function disksRoot() {
  return process.env.C64RE_DISKS_ROOT
    ? resolve(process.env.C64RE_DISKS_ROOT)
    : projectRoot();
}

/** The release registry file. Override the whole path with `C64RE_REGISTRY`. */
export function registryFile() {
  return process.env.C64RE_REGISTRY
    ? resolve(process.env.C64RE_REGISTRY)
    : join(dataRoot(), "RELEASES.json");
}

/** One release's own data directory. */
export function releaseDataDir(id) {
  return join(dataRoot(), id);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`project root: ${projectRoot()}`);
  console.log(`data root:    ${dataRoot()}`);
  console.log(`disks root:   ${disksRoot()}`);
  console.log(`registry:     ${registryFile()}`);
}
