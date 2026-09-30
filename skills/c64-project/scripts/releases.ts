#!/usr/bin/env node
// releases.ts
//
// N-way release registry accessor. This is the only module that reads or
// writes the registry file -- every other module takes a release id as an
// argument and goes through the functions here. `release` is the primary noun
// rather than "the canonical image": there are N releases, each owning a set
// of dumps, with `canonical` demoted to a boolean on one entry.
//
// Portable: the registry's location comes from `project-paths.ts`, so a project
// with a different data layout points the toolkit at its own via
// `C64RE_DATA_DIR` / `C64RE_REGISTRY` rather than editing this file. The path
// is computed on each call, so importing this module works outside a project.
import { readFileSync, writeFileSync, existsSync, mkdirSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import { registryFile, releaseDataDir } from "./project-paths.ts";

/** An address as a registry record carries it: `"$08B1"`, `"0x8b1"`, a
 * decimal string, or a number. `address.ts`'s `addrNum()` parses it. */
export type Address = number | string;

/** The dump label that diff-images.ts and watch-loads.ts read as a release's
 * primary dump. */
export const PRIMARY_DUMP_LABEL = "run1";

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

/** The generated-tier digest diff-images.ts's `ledger` verb records. */
export interface LedgerRecord {
  generated_tier_sha256: string;
  gap_tolerance: number;
  generated_at: string;
}

/** The whole registry file. */
export interface Registry {
  schema_version?: number | string;
  schema_notes?: string;
  releases: ReleaseEntry[];
  ledger?: LedgerRecord;
}

/** Checks the parts of the shape every reader relies on, and names the first
 * part that is wrong. */
function checkRegistryShape(raw: unknown, path: string): Registry {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`registry ${path} is not a JSON object`);
  }
  const reg = raw as Partial<Registry>;
  if (!Array.isArray(reg.releases)) {
    throw new Error(`registry ${path} has no "releases" array`);
  }
  reg.releases.forEach((r, i) => {
    if (typeof r !== "object" || r === null) throw new Error(`registry ${path}: releases[${i}] is not an object`);
    if (typeof r.id !== "string" || r.id === "") throw new Error(`registry ${path}: releases[${i}] has no "id" string`);
    if (!Array.isArray(r.dumps)) {
      throw new Error(`registry ${path}: release "${r.id}" has no "dumps" array -- add "dumps": [] to the entry`);
    }
  });
  return reg as Registry;
}

export function loadRegistry(): Registry {
  const path = registryFile();
  if (!existsSync(path)) {
    throw new Error(`no registry at ${path}`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`registry ${path} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  return checkRegistryShape(raw, path);
}

/**
 * Persist the registry. JSON.stringify preserves each object's insertion
 * (key) order, so a read-modify-write via upsertRelease keeps a stable key
 * order automatically -- callers should not rebuild release objects from
 * scratch with a different key order.
 */
function saveRegistry(reg: Registry): void {
  const path = registryFile();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(reg, null, 2) + "\n");
}

/** The full entry for `id`, or throws with the known-id list on a miss. */
export function release(id: string): ReleaseEntry {
  const reg = loadRegistry();
  const r = reg.releases.find((r) => r.id === id);
  if (!r) assertKnownRelease(id, reg);
  // assertKnownRelease() throws on a miss, so `r` is set here.
  return r as ReleaseEntry;
}

/** The registry's top-level `schema_notes` string, or null when it has none. */
export function schemaNotes(): string | null {
  return loadRegistry().schema_notes ?? null;
}

export function releaseDir(id: string): string {
  const reg = loadRegistry();
  assertKnownRelease(id, reg);
  return releaseDataDir(id);
}

/** Throws with the list of known ids when `id` is not in the registry. */
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

/** Records the ledger's generated-tier digest at the top level of the registry. */
export function recordLedger(record: LedgerRecord): void {
  const reg = loadRegistry();
  reg.ledger = record;
  saveRegistry(reg);
}

/** A release id is used as a directory name, so it must be one plain segment. */
const RELEASE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Adds a release entry with an empty `dumps` array. Creates the registry file
 * when it does not exist. Refuses an id that is already registered, an id
 * that is not one plain path segment, and an empty disk image path.
 */
export function registerRelease({ id, diskImage, canonical = false }: { id: string; diskImage: string; canonical?: boolean }): ReleaseEntry {
  if (!RELEASE_ID.test(id)) {
    throw new Error(`register: release id ${JSON.stringify(id)} must match ${RELEASE_ID.source} -- it names a directory`);
  }
  if (diskImage.trim() === "") throw new Error("register: --disk-image must not be empty");
  const reg: Registry = existsSync(registryFile()) ? loadRegistry() : { schema_version: "1.0", releases: [] };
  if (reg.releases.some((r) => r.id === id)) {
    throw new Error(`register: release "${id}" is already in the registry`);
  }
  if (canonical && reg.releases.some((r) => r.canonical === true)) {
    const current = reg.releases.find((r) => r.canonical === true)!.id;
    throw new Error(`register: release "${current}" is already canonical -- only one entry carries canonical: true`);
  }
  const entry: ReleaseEntry = { id, canonical, disk_image: diskImage, dumps: [] };
  reg.releases.push(entry);
  saveRegistry(reg);
  return entry;
}

/** The fields of a `dump-artifacts.ts write-set` result that `addDump()` reads. */
export interface WriteSetResult {
  ok: true;
  release: string;
  label: string;
  bin: string;
  state: string;
  map: string;
  capture: string;
  sha256: string;
}

function parseWriteSetResult(raw: unknown, path: string): WriteSetResult {
  if (typeof raw !== "object" || raw === null) throw new Error(`add-dump: ${path} is not a write-set result object`);
  const r = raw as Record<string, unknown>;
  if (r.ok !== true) throw new Error(`add-dump: ${path} is not a successful write-set result (ok is ${JSON.stringify(r.ok)})`);
  for (const key of ["release", "label", "bin", "state", "map", "capture", "sha256"]) {
    if (typeof r[key] !== "string" || r[key] === "") {
      throw new Error(`add-dump: ${path} has no "${key}" string -- give the file that write-set printed`);
    }
  }
  return r as unknown as WriteSetResult;
}

/**
 * Records one dump set in its release's `dumps[]`, from the one-line JSON
 * result that `dump-artifacts.ts write-set` printed. The label and release
 * come from that result. Refuses a label the release already has unless
 * `force` is set, and refuses a result for a release that is not registered.
 */
export function addDump(writeSet: unknown, { from = "write-set result", force = false }: { from?: string; force?: boolean } = {}): DumpEntry {
  const ws = parseWriteSetResult(writeSet, from);
  const entry: DumpEntry = {
    label: ws.label,
    bin: ws.bin,
    sha256: ws.sha256,
    capture_record: ws.capture,
    chip_state: ws.state,
    range_manifest: ws.map,
  };
  upsertRelease(ws.release, (r) => {
    const others = r.dumps.filter((d) => d.label !== ws.label);
    if (others.length !== r.dumps.length && !force) {
      throw new Error(`add-dump: release "${ws.release}" already has a dump labelled "${ws.label}" -- pass --force to replace it`);
    }
    return { ...r, dumps: [...others, entry] };
  });
  return entry;
}

// -------------------------------------------------------------------- CLI

/** Every result this script prints. The last stdout line is always one of
 * these, as JSON. */
export type ScriptResult = { ok: true; [key: string]: unknown } | { ok: false; message: string };

function optValue(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith("--")) throw new Error(`--${name} needs a value`);
  return v;
}

function selfPath(): string {
  const self = fileURLToPath(import.meta.url);
  const r = relative(process.cwd(), self);
  return !r || r.startsWith("..") || isAbsolute(r) ? self : r;
}

export function usage(): string {
  return `usage: node ${selfPath()} <command> [--json]

  list                                            every registered release
  show <id>                                       one release entry
  schema-notes                                    the registry's schema_notes
  register --id <id> --disk-image <path> [--canonical]
                                                  add a release (creates the registry)
  add-dump --from <write-set.json> [--force]      record a write-set dump set in its release

diff-images.ts and watch-loads.ts read the dump labelled "${PRIMARY_DUMP_LABEL}" as a
release's primary dump. The last stdout line is one JSON result.`;
}

/** The CLI as a function. `say` receives the human-readable lines. Never throws. */
export function main(argv: readonly string[], say: (line: string) => void = () => {}): ScriptResult {
  const [cmd, ...rest] = argv;
  try {
    if (cmd === "list") {
      const releases = loadRegistry().releases.map((r) => ({ id: r.id, canonical: r.canonical === true, disk_image: r.disk_image, dumps: r.dumps.length }));
      for (const r of releases) say(`${r.id}  canonical=${r.canonical}  disk_image=${r.disk_image}  dumps=${r.dumps}`);
      return { ok: true, registry: registryFile(), releases };
    }
    if (cmd === "show") {
      const id = rest.find((a) => !a.startsWith("--"));
      if (!id) return { ok: false, message: "usage: show <release-id>" };
      const entry = release(id);
      say(JSON.stringify(entry, null, 2));
      return { ok: true, release: entry };
    }
    if (cmd === "schema-notes") {
      const notes = schemaNotes();
      say(notes ?? "(no schema_notes field set)");
      return { ok: true, schema_notes: notes };
    }
    if (cmd === "register") {
      const id = optValue(rest, "id");
      const diskImage = optValue(rest, "disk-image");
      if (!id || diskImage === undefined) return { ok: false, message: "usage: register --id <id> --disk-image <path> [--canonical]" };
      const entry = registerRelease({ id, diskImage, canonical: rest.includes("--canonical") });
      say(`registered ${entry.id} in ${registryFile()}`);
      return { ok: true, registry: registryFile(), release: entry };
    }
    if (cmd === "add-dump") {
      const from = optValue(rest, "from");
      if (!from) return { ok: false, message: "usage: add-dump --from <write-set.json> [--force]" };
      const text = readFileSync(resolve(from), "utf8");
      const last = text.split("\n").filter((l) => l.trim() !== "").pop() ?? "";
      let parsed: unknown;
      try {
        parsed = JSON.parse(last);
      } catch {
        return { ok: false, message: `add-dump: the last line of ${from} is not JSON -- give the file that write-set printed` };
      }
      const dump = addDump(parsed, { from, force: rest.includes("--force") });
      const releaseId = (parsed as { release: string }).release;
      say(`recorded dump "${dump.label}" on release ${releaseId}`);
      return { ok: true, release: releaseId, dump };
    }
    return { ok: false, message: cmd ? `unknown command ${JSON.stringify(cmd)}\n${usage()}` : usage() };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// True when this file is the process entry point, also when it runs through a symlink.
const invokedDirectly = process.argv[1] !== undefined && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const json = argv.includes("--json");
  const result = main(argv.filter((a) => a !== "--json"), json ? () => {} : (line) => console.log(line));
  console.log(JSON.stringify(result));
  process.exitCode = result.ok ? 0 : 1;
}
