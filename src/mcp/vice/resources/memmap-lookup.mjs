#!/usr/bin/env node
// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from memmap-lookup.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to .c64-re-tools/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// memmap-lookup.mts
//
// Phase 37, plan 37-01 (IMP-01/AUTO-01's shared foundation): the ONE loader
// for `c64-memory-mapping`'s own `memmap.json`, its content digest, and
// narrowest-containing-range selection over its 959 entries.
//
// Every path here is repo-relative and derived from this module's own location, the
// same posture `anno-regbits-gen.mts` and `dxa-blocks.ts` take for themselves.
// It also NEVER NAMES `node:sqlite` and NEVER OPENS THE ANNOTATION STORE:
// `anno-store.mts` is the one module permitted to name that
// dependency, and this module answers a pure question about a static JSON
// file that has nothing to do with the store's own persistence.
//
// D-37-03: `anno-regbits-gen.mts:62` already computes the SAME `HERE`-relative
// five-hop path to `memmap.json` and `anno-regbits-gen.mts:377` already
// computes its sha256 digest, for a different purpose (bit-name generation).
// This module COPIES that formula rather than importing the generator --
// `anno-regbits-gen.mts`'s own header declares itself "the sole read of
// c64-memory-mapping's own memmap.json ... for this purpose", and widening
// that consumer set is a separate decision this plan does not make.
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: loading and caching
// `memmap.json`'s 959 entries, computing the file's own sha256 provenance
// digest, and the NARROWEST-CONTAINING-RANGE selection rule an address
// resolves through. `anno-join.mts` calls this module; nothing else needs to.
//
// WHAT NOT TO DO:
//   - Never re-derive `MEMMAP_PATH`'s repo candidate from a different
//     relative offset. This formula has already broken once when the skills
//     tree moved (plan 16-01's own deviation note) -- one HERE-relative
//     constant, copied verbatim in shape from `anno-regbits-gen.mts:62`.
//     The package-local candidate checked first is the copy build.ts's
//     buildServer() places beside the compiled module in dist/: the npm
//     package does not carry the skills tree.
//   - Never mutate the cached entries array. `loadMemmap()` returns the same
//     frozen array on every call after the first; a caller that needs a
//     filtered view copies it.
//   - Never derive "is this range bank-conditional" from `memmap.json`'s own
//     fields. `BANK_CONDITIONAL_RANGES` below is HAND-MAINTAINED on purpose
//     (37-RESEARCH.md Pitfall 2) -- the schema carries no structured
//     bank-condition field, only free prose inside `desc`.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
/** Where `c64-memory-mapping`'s `memmap.json` is read from: a package-local
 * copy beside this module first (dist/memmap.json in the npm package, copied
 * there by build.ts's buildServer()), else the repo skill path, using the
 * SAME five-hop formula `anno-regbits-gen.mts:62` uses. Copied, not imported
 * (D-37-03). */
const PACKAGE_MEMMAP_PATH = join(HERE, "memmap.json");
const REPO_MEMMAP_PATH = join(HERE, "..", "..", "..", "skills", "c64-memory-mapping", "memmap.json");
export const MEMMAP_PATH = existsSync(PACKAGE_MEMMAP_PATH) ? PACKAGE_MEMMAP_PATH : REPO_MEMMAP_PATH;
/** Module-level cache, exactly as `anno-enum-gen.mts`'s `loadRegBits()` caches
 * its own generated table -- `memmap.json` is read and parsed once per
 * process, never per call. */
let cachedEntries;
/** Reads and parses `memmap.json`, caching the parsed array. Refuses BY NAME
 * if the top-level shape is not `{sources, entries}` or if `entries` is
 * empty -- a malformed or truncated memmap.json must not read as "a memmap
 * with nothing in it". */
export function loadMemmap() {
    if (cachedEntries !== undefined)
        return cachedEntries;
    let parsed;
    try {
        parsed = JSON.parse(readFileSync(MEMMAP_PATH, "utf8"));
    }
    catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(`memmap-lookup: ${MEMMAP_PATH} could not be read/parsed as JSON (${reason}).`);
    }
    const doc = parsed;
    if (doc === null || typeof doc !== "object" || !Array.isArray(doc.sources) || !Array.isArray(doc.entries)) {
        throw new Error(`memmap-lookup: ${MEMMAP_PATH} is not a { sources, entries } document -- refusing to guess a shape for a ` +
            "malformed memmap.json.");
    }
    if (doc.entries.length === 0) {
        throw new Error(`memmap-lookup: ${MEMMAP_PATH}'s "entries" array is empty -- "a memmap with nothing in it" and "a memmap ` +
            'that failed to load" must not read the same, so this refuses rather than returning an empty selector.');
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
export function memmapDigest() {
    return createHash("sha256").update(readFileSync(MEMMAP_PATH)).digest("hex");
}
/**
 * D-37-13: the fixed, machine-parseable prefix `anno-join.mts` appends
 * `memmapDigest()`'s full 64-character lowercase hex digest to, on every
 * derived comment (`AUTO-08`). Chosen to be unlikely to collide with
 * ordinary comment prose and to sit LAST in the comment text (no closing
 * delimiter follows it), so a regex can find it without knowing the
 * preceding label's own shape: `new RegExp(PROVENANCE_TOKEN_PREFIX_ESCAPED +
 * "[0-9a-f]{64}$")`. Exported from here, not `anno-join.mts`, because the
 * digest and the prefix that names it belong to the same module as
 * `memmapDigest()` itself.
 */
export const PROVENANCE_TOKEN_PREFIX = "[memmap-sha256:";
/** Inclusive width of one entry: `end - start`. Named once so every step
 * below computes it identically. */
function inclusiveWidth(entry) {
    return entry.end - entry.start;
}
/**
 * STEP ONE, WIDTH -- the whole of narrowest-range-wins. Prefers the smallest
 * `end - start`; returns every entry tied at that minimum, since a single
 * winner here is `unique`ly correct only when nothing else shares its width.
 * Kept as its own named function (not folded into a single comparator) so
 * plan 37-04's control -- "switch selection to first-match" -- is a single,
 * small, textual replacement of exactly this step, per this plan's own
 * `<read_first>` instruction.
 */
function narrowestWidthSurvivors(containing) {
    let minWidth = Infinity;
    for (const entry of containing) {
        const width = inclusiveWidth(entry);
        if (width < minWidth)
            minWidth = width;
    }
    return containing.filter((entry) => inclusiveWidth(entry) === minWidth);
}
/**
 * STEP TWO, SYMBOL -- `AUTO-02`'s own tie-break. Among step one's survivors,
 * prefers an entry carrying a non-empty `sym` over one that does not.
 * D-37-11's `$0000` fixture (three equal-width contenders, exactly one
 * carrying `sym: "D6510"`) is this step's own fixture. Returns every
 * `sym`-carrying survivor when at least one exists, else returns every
 * survivor unchanged (this step decided nothing -- step three must run).
 */
function symbolSurvivors(survivors) {
    const withSym = survivors.filter((entry) => typeof entry.sym === "string" && entry.sym.length > 0);
    return withSym.length > 0 ? withSym : survivors.slice();
}
/**
 * STEP THREE, ORDER -- D-37-10. Among step two's survivors, the entry
 * appearing FIRST in `memmap.json`'s own `entries` array wins. Stated
 * explicitly, rather than left to whatever order a scan happened to
 * produce, because the phase's own headline `$D020` example needs it: two
 * 1-byte contenders there are tied on width AND neither carries a `sym`, so
 * without this named third rule the selection would be an unstated,
 * scan-order accident that a later refactor could change silently. No
 * `sort()` is used here -- a single linear scan over `entries` (the same
 * order the caller supplied) finds the first survivor, which is cheaper and
 * keeps this step's own mutation (plan 37-05's "reverse the tie-break")
 * a one-line replacement rather than a sort-comparator edit.
 */
function orderWinner(survivors, entries) {
    for (const entry of entries) {
        if (survivors.includes(entry))
            return entry;
    }
    // Unreachable: `survivors` is always drawn from `entries` by reference, so
    // the scan above always finds one before falling through.
    return survivors[0];
}
/**
 * The THREE-DEEP selection order (D-37-10): narrowest-containing-range,
 * then the `sym` tie-break (`AUTO-02`), then -- because those two do not
 * resolve every real tie in the committed `memmap.json` -- the stated
 * residual rule of "first in `entries` order". Collects every entry whose
 * inclusive `[start, end]` contains `address`; returns `undefined` if none
 * does. `tieBrokenBy` names WHICH step decided, so a caller (and plan
 * 37-04's controls) can tell width-decided from symbol-decided from
 * order-decided, not merely infer it from the winning entry's own shape.
 */
export function selectMemmapEntry(address, entries = loadMemmap()) {
    const containing = [];
    for (const entry of entries) {
        if (address < entry.start || address > entry.end)
            continue;
        containing.push(entry);
    }
    const contenderCount = containing.length;
    if (contenderCount === 0)
        return undefined;
    if (contenderCount === 1) {
        const entry = containing[0];
        return { entry, width: inclusiveWidth(entry), contenderCount, tieBrokenBy: "unique" };
    }
    const widthSurvivors = narrowestWidthSurvivors(containing);
    if (widthSurvivors.length === 1) {
        const entry = widthSurvivors[0];
        return { entry, width: inclusiveWidth(entry), contenderCount, tieBrokenBy: "width" };
    }
    const symSurvivors = symbolSurvivors(widthSurvivors);
    if (symSurvivors.length === 1) {
        const entry = symSurvivors[0];
        return { entry, width: inclusiveWidth(entry), contenderCount, tieBrokenBy: "symbol" };
    }
    const entry = orderWinner(symSurvivors, entries);
    return { entry, width: inclusiveWidth(entry), contenderCount, tieBrokenBy: "order" };
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
export const BANK_CONDITIONAL_RANGES = Object.freeze([
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
