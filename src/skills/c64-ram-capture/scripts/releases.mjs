#!/usr/bin/env node
// N-way release registry accessor. This is the only module that reads a release
// identifier out of the registry -- every other module takes the id as an
// argument and never touches the registry file directly. `release` is the
// primary noun rather than "the canonical image": there are N releases, each
// owning a set of dumps, with `canonical` demoted to a boolean on one entry.
//
// Portable: the registry's location comes from `project-paths.mjs`, so a project
// with a different data layout points the toolkit at its own via
// `C64RE_DATA_DIR` / `C64RE_REGISTRY` rather than editing this file.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { registryFile, releaseDataDir } from "./project-paths.mjs";

export const registryPath = registryFile();

const die = (m) => { console.error(`error: ${m}`); process.exit(1); };

export function loadRegistry() {
  if (!existsSync(registryPath)) {
    throw new Error(`no registry at ${registryPath}`);
  }
  return JSON.parse(readFileSync(registryPath, "utf8"));
}

/**
 * Persist the registry. JSON.stringify preserves each object's insertion
 * (key) order, so a read-modify-write via upsertRelease keeps a stable key
 * order automatically -- callers should not rebuild release objects from
 * scratch with a different key order.
 */
function saveRegistry(reg) {
  writeFileSync(registryPath, JSON.stringify(reg, null, 2) + "\n");
}

/** The full entry for `id`, or throws with the known-id list on a miss. */
export function release(id) {
  const reg = loadRegistry();
  const r = reg.releases.find((r) => r.id === id);
  if (!r) assertKnownRelease(id, reg);
  return r;
}

/**
 * The registry's own N-readiness documentation (01-03-PLAN.md's Task 2):
 * a top-level `schema_notes` string, sibling to `schema_version` and
 * `releases`, stating the mechanical claim that adding a release is one
 * `releases[]` entry plus one invocation of `tools/recover.mjs`. Kept as a
 * plain top-level field rather than a JSON comment (JSON has none) or a
 * per-release field (it describes the registry's shape, not any one
 * release). Rehearsed against the real validator in
 * a release's own NOTES.md.
 */
export function schemaNotes() {
  return loadRegistry().schema_notes ?? null;
}

export function releaseDir(id) {
  const reg = loadRegistry();
  assertKnownRelease(id, reg);
  return releaseDataDir(id);
}

/** Dies with the list of known ids on a miss -- see plan Layer 2. */
export function assertKnownRelease(id, reg) {
  const registry = reg || loadRegistry();
  const known = registry.releases.map((r) => r.id);
  if (!known.includes(id)) {
    throw new Error(`unknown release "${id}" -- known releases: ${known.join(", ")}`);
  }
}

/**
 * Read-modify-write: `fn` receives a shallow copy of the release entry and
 * returns the replacement; the whole registry is then re-persisted with
 * stable key order. This is the only sanctioned way to mutate an entry.
 */
export function upsertRelease(id, fn) {
  const reg = loadRegistry();
  const idx = reg.releases.findIndex((r) => r.id === id);
  if (idx === -1) {
    throw new Error(`unknown release "${id}" -- known releases: ${reg.releases.map((r) => r.id).join(", ")}`);
  }
  reg.releases[idx] = fn({ ...reg.releases[idx] });
  saveRegistry(reg);
  return reg.releases[idx];
}

// -------------------------------------------------------------------- CLI

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "list") {
    const reg = loadRegistry();
    for (const r of reg.releases) {
      console.log(`${r.id}  canonical=${r.canonical}  disk_image=${r.disk_image}  dumps=${r.dumps.length}`);
    }
  } else if (cmd === "show") {
    if (!rest[0]) die("usage: show <release-id>");
    console.log(JSON.stringify(release(rest[0]), null, 2));
  } else if (cmd === "schema-notes") {
    console.log(schemaNotes() ?? "(no schema_notes field set)");
  } else {
    console.log(`usage: node ${fileURLToPath(import.meta.url)} <list|show <id>|schema-notes>`);
    process.exit(cmd ? 1 : 0);
  }
}
