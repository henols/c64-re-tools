#!/usr/bin/env node
// releases.ts
//
// N-way release registry accessor. This is the only module that reads a release
// identifier out of the registry -- every other module takes the id as an
// argument and never touches the registry file directly. `release` is the
// primary noun rather than "the canonical image": there are N releases, each
// owning a set of dumps, with `canonical` demoted to a boolean on one entry.
//
// Portable: the registry's location comes from `project-paths.ts`, so a project
// with a different data layout points the toolkit at its own via
// `C64RE_DATA_DIR` / `C64RE_REGISTRY` rather than editing this file.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { registryFile, releaseDataDir } from "./project-paths.ts";

/** An address as a registry record carries it: `"$08B1"`, `"0x8b1"`, a
 * decimal string, or a number. `watch-loads.ts`'s `addrNum()` parses it. */
export type Address = number | string;

/** The four file-naming fields of a dump (a dump is a four-file set). */
export type DumpFileField = "bin" | "capture_record" | "chip_state" | "range_manifest";

/** One dump a release owns. Every file field is project-relative and may be
 * absent in a registry that is still being filled in. */
export interface DumpEntry {
  label: string;
  bin?: string;
  sha256?: string;
  capture_record?: string;
  chip_state?: string;
  range_manifest?: string;
}

/** A loader re-entry range recorded on a release. */
export interface LoaderRange {
  start: Address;
  end: Address;
  note?: string;
  evidence?: string;
}

/** One resolved sentinel of a release's recorded `watch_set`. */
export interface WatchSentinel {
  name: string;
  kind: string;
  tier: string;
  type: string;
  start: number;
  end: number;
  reason: string;
  evidence: string;
}

/** A release's provenance offset, as diff-images.ts's `anchor-search` verb
 * records it. `offset` is `null` until an offset is proven. */
export interface ProvenanceOffsetRecord {
  role: string;
  reference_release: string | null;
  offset: number | null;
  anchor_count: number | null;
  anchors_agreeing: number | null;
  proven_at: string;
  method: string;
}

/** The dump trigger recorded on a release. */
export interface ReleaseTrigger {
  address?: Address | null;
  kind?: string | null;
}

/** One `releases[]` entry. */
export interface ReleaseEntry {
  id: string;
  canonical?: boolean;
  disk_image: string;
  disk_sha256?: string;
  dumps: DumpEntry[];
  loader_ranges?: LoaderRange[];
  watch_set?: WatchSentinel[];
  provenance_offset?: ProvenanceOffsetRecord | null;
  trigger?: ReleaseTrigger | null;
}

/** The whole registry file. */
export interface Registry {
  schema_version?: number;
  schema_notes?: string;
  releases: ReleaseEntry[];
}

export const registryPath: string = registryFile();

const die = (m: string): never => { console.error(`error: ${m}`); process.exit(1); };

export function loadRegistry(): Registry {
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
function saveRegistry(reg: Registry): void {
  writeFileSync(registryPath, JSON.stringify(reg, null, 2) + "\n");
}

/** The full entry for `id`, or throws with the known-id list on a miss. */
export function release(id: string): ReleaseEntry {
  const reg = loadRegistry();
  const r = reg.releases.find((r) => r.id === id);
  if (!r) assertKnownRelease(id, reg);
  // assertKnownRelease() throws on a miss, so `r` is set here.
  return r as ReleaseEntry;
}

/**
 * The registry's own N-readiness documentation:
 * a top-level `schema_notes` string, sibling to `schema_version` and
 * `releases`, stating the mechanical claim that adding a release is one
 * `releases[]` entry plus one invocation of `tools/recover.mjs`. Kept as a
 * plain top-level field rather than a JSON comment (JSON has none) or a
 * per-release field (it describes the registry's shape, not any one
 * release). Rehearsed against the real validator in
 * a release's own NOTES.md.
 */
export function schemaNotes(): string | null {
  return loadRegistry().schema_notes ?? null;
}

export function releaseDir(id: string): string {
  const reg = loadRegistry();
  assertKnownRelease(id, reg);
  return releaseDataDir(id);
}

/** Dies with the list of known ids on a miss -- see plan Layer 2. */
export function assertKnownRelease(id: string, reg?: Registry | null): void {
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
export function upsertRelease(id: string, fn: (entry: ReleaseEntry) => ReleaseEntry): ReleaseEntry {
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
