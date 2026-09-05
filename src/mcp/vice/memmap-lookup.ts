#!/usr/bin/env node
// memmap-lookup.ts
//
// Phase 37, plan 37-01 (IMP-01/AUTO-01's shared foundation): the ONE loader
// for `c64-memory-mapping`'s own `memmap.json`, its content digest, and
// narrowest-containing-range selection over its 959 entries.
//
// THIS MODULE MUST NEVER IMPORT `hostpath.ts` OR `containerpath.ts` -- every
// path here is repo-relative and derived from this module's own location, the
// same posture `anno-regbits-gen.ts` and `dxa-blocks.ts` take for themselves.
// It also NEVER NAMES `node:sqlite` and NEVER OPENS THE ANNOTATION STORE:
// `anno-store.ts` is the one module `anno-seam.test.ts` allows to name that
// dependency, and this module answers a pure question about a static JSON
// file that has nothing to do with the store's own persistence.
//
// D-37-03: `anno-regbits-gen.ts:62` already computes the SAME `HERE`-relative
// five-hop path to `memmap.json` and `anno-regbits-gen.ts:377` already
// computes its sha256 digest, for a different purpose (bit-name generation).
// This module COPIES that formula rather than importing the generator --
// `anno-regbits-gen.ts`'s own header declares itself "the sole read of
// c64-memory-mapping's own memmap.json ... for this purpose", and widening
// that consumer set is a separate decision this plan does not make.
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: loading and caching
// `memmap.json`'s 959 entries, computing the file's own sha256 provenance
// digest, and the NARROWEST-CONTAINING-RANGE selection rule an address
// resolves through. `anno-join.ts` calls this module; nothing else needs to.
//
// WHAT NOT TO DO:
//   - Never re-derive `MEMMAP_PATH` from a different relative offset. This
//     formula has already broken once when the skills tree moved (plan
//     16-01's own deviation note) -- one HERE-relative constant, copied
//     verbatim in shape from `anno-regbits-gen.ts:62`.
//   - Never mutate the cached entries array. `loadMemmap()` returns the same
//     frozen array on every call after the first; a caller that needs a
//     filtered view copies it.
//   - Never derive "is this range bank-conditional" from `memmap.json`'s own
//     fields. `BANK_CONDITIONAL_RANGES` below is HAND-MAINTAINED on purpose
//     (37-RESEARCH.md Pitfall 2) -- the schema carries no structured
//     bank-condition field, only free prose inside `desc`.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The `HERE`-relative path to `c64-memory-mapping`'s `memmap.json`, using the
 * SAME five-hop formula `anno-regbits-gen.ts:62` uses. Copied, not imported
 * (D-37-03). */
export const MEMMAP_PATH = join(HERE, "..", "..", "..", "src", "skills", "c64-memory-mapping", "memmap.json");

/** One entry as `memmap.json` holds it. MEASURED at plan time: 959 entries,
 * `start`/`end` are INCLUSIVE integers with no length field, and `sym` is
 * present on 219 of them. */
export interface MemmapEntry {
  start: number;
  end: number;
  label: string;
  section: string;
  desc: string;
  src: string;
  sym?: string;
}

interface MemmapDocument {
  sources: unknown[];
  entries: MemmapEntry[];
}

/** Module-level cache, exactly as `anno-enum-gen.ts`'s `loadRegBits()` caches
 * its own generated table -- `memmap.json` is read and parsed once per
 * process, never per call. */
let cachedEntries: readonly MemmapEntry[] | undefined;

/** Reads and parses `memmap.json`, caching the parsed array. Refuses BY NAME
 * if the top-level shape is not `{sources, entries}` or if `entries` is
 * empty -- a malformed or truncated memmap.json must not read as "a memmap
 * with nothing in it". */
export function loadMemmap(): readonly MemmapEntry[] {
  if (cachedEntries !== undefined) return cachedEntries;

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(MEMMAP_PATH, "utf8"));
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`memmap-lookup: ${MEMMAP_PATH} could not be read/parsed as JSON (${reason}).`);
  }

  const doc = parsed as Partial<MemmapDocument> | null;
  if (doc === null || typeof doc !== "object" || !Array.isArray(doc.sources) || !Array.isArray(doc.entries)) {
    throw new Error(
      `memmap-lookup: ${MEMMAP_PATH} is not a { sources, entries } document -- refusing to guess a shape for a ` +
        "malformed memmap.json.",
    );
  }
  if (doc.entries.length === 0) {
    throw new Error(
      `memmap-lookup: ${MEMMAP_PATH}'s "entries" array is empty -- "a memmap with nothing in it" and "a memmap ` +
        'that failed to load" must not read the same, so this refuses rather than returning an empty selector.',
    );
  }

  cachedEntries = Object.freeze(doc.entries.slice());
  return cachedEntries;
}

/** The sha256 hex digest of `memmap.json`'s RAW BYTES -- the provenance value
 * `AUTO-08` (a later plan) appends to derived comment text. MEASURED at plan
 * time: this equals the same value `anno-regbits.json`'s committed banner
 * carries (`_generated.memmapSha256`), and the test that pins this asserts
 * that RELATION rather than a hard-coded literal, because the map is a living
 * file. */
export function memmapDigest(): string {
  return createHash("sha256").update(readFileSync(MEMMAP_PATH)).digest("hex");
}

/** What `selectMemmapEntry()` returns for a unique or a resolved-tie hit.
 * `contenderCount` is the number of containing entries the scan considered,
 * so a caller can tell a unique hit from a resolved tie without re-running
 * the scan itself. */
export interface MemmapSelection {
  entry: MemmapEntry;
  width: number;
  contenderCount: number;
}

/**
 * The NARROWEST-CONTAINING-RANGE selection rule (this plan's own slice of it
 * -- `AUTO-02`'s `sym` tie-break lands in a later plan). Collects every entry
 * whose inclusive `[start, end]` contains `address`; returns `undefined` if
 * none does; otherwise returns the one with the smallest `end - start`. Where
 * several contenders share the smallest width, THIS task returns the FIRST
 * one in `entries` order -- a later plan replaces that residual tie-break
 * with the `sym`-present rule and states the order explicitly.
 */
export function selectMemmapEntry(address: number, entries: readonly MemmapEntry[] = loadMemmap()): MemmapSelection | undefined {
  let best: MemmapEntry | undefined;
  let bestWidth = Infinity;
  let contenderCount = 0;

  for (const entry of entries) {
    if (address < entry.start || address > entry.end) continue;
    contenderCount += 1;
    const width = entry.end - entry.start;
    if (width < bestWidth) {
      best = entry;
      bestWidth = width;
    }
  }

  if (best === undefined) return undefined;
  return { entry: best, width: bestWidth, contenderCount };
}

/** One hand-maintained bank-conditional range: its meaning depends on the
 * processor port's bits #0-#2 at `$0001`. */
export interface BankConditionalRange {
  start: number;
  end: number;
  why: string;
}

/**
 * The three inclusive ranges whose interpretation depends on the processor
 * port, HAND-MAINTAINED rather than derived from `memmap.json` (37-RESEARCH.md
 * Pitfall 2): only 6 of 959 entries even mention the condition in free-text
 * `desc`, and there is no structured bank-condition field to scan instead.
 * Nothing in THIS module branches on this list -- a later plan's bank-decode
 * logic does. Landed here so the list has one home rather than being
 * reinvented per caller.
 */
export const BANK_CONDITIONAL_RANGES: readonly BankConditionalRange[] = Object.freeze([
  {
    start: 0xa000,
    end: 0xbfff,
    why: "BASIC ROM when banked in, otherwise RAM (bits #0-#2 of $0001 select between them).",
  },
  {
    start: 0xd000,
    end: 0xdfff,
    why: "I/O area, Character ROM, or RAM depending on $0001 bits #0-#2 -- the canonical three-way case.",
  },
  {
    start: 0xe000,
    end: 0xffff,
    why: "KERNAL ROM when banked in, otherwise RAM (bits #0-#2 of $0001 select between them).",
  },
]);
