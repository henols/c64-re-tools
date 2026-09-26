#!/usr/bin/env node
// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from anno-join.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to .c64-re-tools/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// anno-join.mts
//
// The mechanical join between stored
// cross-references and `memmap.json`, with no agent call, no queue walk and
// no skill invocation anywhere in the loop.
//
// THIS MODULE RECEIVES AN ALREADY-OPEN STORE HANDLE, exactly like
// `anno-import.mts` -- there is no second store session anywhere in this
// file. It never names `node:sqlite`, never calls `openStore()`/`closeStore()`
// itself, and the image range it needs arrives as plain numbers (`imageOrigin`, `imageByteLength`) that
// the caller has already derived from a loaded image, mirroring
// `dxa-blocks.ts`'s own header posture of reading only already-fetched facts
// a caller passes in.
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: reading `listXrefs()`'s
// distinct target addresses, classifying each one (inside the loaded image,
// no `memmap.json` entry, or annotated) and writing the resulting comment
// through `setComment()`. This module's own criterion -- no agent, no queue
// walk, no skill invocation -- is checked STRUCTURALLY over this module's own
// source in `anno-join.test.ts`, not merely asserted here in
// prose.
//
// WHAT NOT TO DO:
//   - Never import anything under `skills/`. This function's entire
//     point is that annotating an address costs one mechanical call, not an
//     agent turn.
//   - Never spawn a child process from this module.
//   - Never carry a bank value forward past a point where two paths
//     disagree, and never default an unresolved bank state to the power-on
//     value (T-37-26). A reaching-values set of size other than one, or one
//     that decodes to more than one region, DECLINES -- see the bank-state
//     block below.
//
// `runMemmapJoin()` gains an
// OPTIONAL `constWrites` argument. When `undefined` (every pre-37-06 call
// site, and every existing test in this file), the bank-state machinery
// below is a complete no-op and every address resolves EXACTLY as it did
// before this plan -- the candidate-constraint argument must not change any
// unconstrained selection's answer. Only when a caller explicitly supplies
// an array (even an empty one) does the reaching-values/decline logic
// activate for addresses inside `BANK_CONDITIONAL_RANGES`. The
// reaching-values computation is deliberately conservative -- it is NOT a
// dataflow analysis. It uses only what the export gives: the recovered
// constant stores to the processor port (each with its own address), and
// the cross-reference graph the importer already stored via `putXref()`.
// The set of recovered values reaching a given address is the set of
// `constWrites` whose OWN store address can reach that address, walked
// forward over that same graph. Where the graph does not connect a store to
// the address at all, that value is simply not in the reaching set --
// the decline-on-empty-or-disagreement rule (below) is what turns
// "nothing reaches this point" into a stated absence rather than a silent
// default.
import { listXrefs, setComment, setDataType } from "./anno-store.mjs";
import { decodeBankState, isBankConditionalAddress, regionAdmitsEntry, resolveBankedRegion, } from "./anno-bank.mjs";
import { loadMemmap, memmapDigest, PROVENANCE_TOKEN_PREFIX, selectMemmapEntry } from "./memmap-lookup.mjs";
// The graphics write-back. deriveGraphicsRanges()
// is structurally typed against ConstWriteFact -- GraphicsConstWriteFact's own
// shape is identical ({storeAddress, targetAddress, value}) -- so THIS module's
// own constWrites argument, already threaded for the bank-state block, is
// handed straight through with no translation layer.
import { deriveGraphicsRanges } from "./anno-graphics.mjs";
/** The axis-qualified provenance marker an annotated bank-conditional
 * comment carries, ALWAYS before `PROVENANCE_TOKEN_PREFIX`'s own digest
 * token (which stays last). Names the axis ("processor-port")
 * explicitly, so a later phase adding the VIC banking axis is additive
 * rather than ambiguous about which axis a given token names. */
const BANK_PROVENANCE_PREFIX = "[processor-port:";
/** Builds a forward adjacency map from `xrefs`, ONCE per join run, reused for
 * every address's own reachability walk below. */
function buildAdjacency(xrefs) {
    const adjacency = new Map();
    for (const xref of xrefs) {
        const list = adjacency.get(xref.fromAddress);
        if (list)
            list.push(xref.toAddress);
        else
            adjacency.set(xref.fromAddress, [xref.toAddress]);
    }
    return adjacency;
}
/** Plain forward reachability (DFS, visited-set guarded against cycles):
 * can `from` reach `target` by following zero or more `adjacency` edges? */
function canReach(from, target, adjacency) {
    if (from === target)
        return true;
    const visited = new Set([from]);
    const stack = [from];
    while (stack.length > 0) {
        const current = stack.pop();
        for (const next of adjacency.get(current) ?? []) {
            if (next === target)
                return true;
            if (!visited.has(next)) {
                visited.add(next);
                stack.push(next);
            }
        }
    }
    return false;
}
/** The set of recovered processor-port values whose OWN store
 * address can reach `targetAddress`, over `adjacency`. Never a dataflow
 * analysis -- purely "does the stored cross-reference graph connect this
 * store to this address". */
function computeReachingValues(targetAddress, constWrites, adjacency) {
    const reaching = [];
    for (const write of constWrites) {
        if (canReach(write.storeAddress, targetAddress, adjacency))
            reaching.push(write.value);
    }
    if (reaching.length === 1)
        return { kind: "one", value: reaching[0] };
    return { kind: "several", values: reaching };
}
/** Raised when `runMemmapJoin()`'s own inputs cannot support a join at all --
 * currently only the zero-byte-image refusal below. Follows `anno-import.mts`'s
 * `AnnoImportError` construction idiom (a bare `Error` subclass, not
 * `AnnoStoreError`, since this module never touches the store's own
 * persistence). */
export class AnnoJoinError extends Error {
    constructor(message) {
        super(message);
        this.name = "AnnoJoinError";
    }
}
/**
 * Joins every DISTINCT `toAddress` `listXrefs()` holds against `memmap.json`,
 * in ascending address order. An address inside the caller's own loaded
 * image range is a program address, not a hardware/memory-map feature, and
 * is skipped WITHOUT a `memmap.json` lookup -- the membership test runs
 * BEFORE `selectEntry()` is called at all, so the guard is a
 * control-flow fact rather than a result-filtering one: this file's own
 * contract says an
 * in-image address is "never looked up in memmap.json", a claim about what
 * runs, not merely about what the caller sees back. An address with no
 * containing `memmap.json` entry is skipped for that reason instead;
 * everything else is annotated with the selected entry's label via
 * `setComment()`. Running this twice over an unchanged store re-classifies
 * every address identically and reports `commentsChanged: 0` on the second
 * run, because `setComment()` itself reports `changed: false` for a
 * byte-identical repeat.
 *
 * `selectEntry` defaults to the real `selectMemmapEntry` and exists as an
 * injection point for exactly one reason: it is the seam that makes "never
 * looked up" checkable at all. Without it, the only available assertion is
 * on the RESULT, and a result-filtering implementation (compute the
 * selection, then discard it for an in-image address) would pass that
 * assertion while still violating the requirement. A test passes a counting
 * spy in its place and asserts zero calls for an all-in-image store.
 */
export function runMemmapJoin(handle, args, entries = loadMemmap(), selectEntry = selectMemmapEntry) {
    if (args.imageByteLength === 0) {
        throw new AnnoJoinError("runMemmapJoin refused: the image's own body length is 0 -- an image with no bytes has no range, and treating " +
            "it as a zero-width range at its own origin would silently make one address (the origin) read as in-image.");
    }
    // Computed ONCE per join run and reused for every annotated row,
    // never recomputed per row -- two comments written in the same run are
    // therefore GUARANTEED to carry byte-identical tokens, not merely likely
    // to (the file cannot change mid-run, but a per-row recompute would still
    // be wasted work re-reading and re-hashing the same bytes for nothing).
    const digest = memmapDigest();
    const xrefs = listXrefs(handle);
    const targets = [...new Set(xrefs.map((xref) => xref.toAddress))].sort((a, b) => a - b);
    // Built ONCE per run, over the SAME xref graph the unconstrained
    // path already reads via `listXrefs()` above -- reused for every address's
    // own reachability walk below. `undefined` `args.constWrites` means the
    // bank-state block is never entered at all, so this adjacency map is built
    // but simply never consulted -- negligible cost, and keeps the "no
    // constWrites -> no-op" contract a single conditional rather than two
    // divergent code paths.
    const bankAdjacency = buildAdjacency(xrefs);
    // The inclusive image range, computed ONCE from the LoadedImage's own body
    // bytes -- never from `totalBytes` (the file's own byte count,
    // which on the .prg route includes the two-byte load-address header and
    // would shift this whole range by two bytes) and never a caller-supplied
    // number pair that could silently widen or narrow the program's own
    // extent.
    const imageStart = args.imageOrigin;
    const imageEnd = args.imageOrigin + args.imageByteLength - 1;
    const decisions = [];
    let annotated = 0;
    let skippedInImage = 0;
    let skippedNoMapEntry = 0;
    let declined = 0;
    let commentsChanged = 0;
    for (const address of targets) {
        // THE GUARD: one early-return, before selectEntry() is ever called. A
        // single textual deletion of this block removes it cleanly -- that
        // deletion is this file's own observed-red control.
        if (address >= imageStart && address <= imageEnd) {
            skippedInImage += 1;
            decisions.push({
                address,
                outcome: "skipped-in-image",
                reason: `address $${address.toString(16)} lies inside the loaded image's own range ($${imageStart.toString(16)}-` +
                    `$${imageEnd.toString(16)}) and is therefore a program address, never looked up in memmap.json`,
            });
            continue;
        }
        // THE BANK-STATE BLOCK. Only
        // entered when the caller supplied `constWrites` AT ALL (`undefined`
        // skips this whole block, falling through to the unconstrained path
        // below exactly as pre-37-06) AND the address is inside one of the
        // three bank-conditional ranges -- outside them, bank state is
        // irrelevant and the candidate set stays unconstrained regardless of
        // `constWrites`.
        if (args.constWrites !== undefined && isBankConditionalAddress(address)) {
            const reaching = computeReachingValues(address, args.constWrites, bankAdjacency);
            if (reaching.kind === "unknown") {
                declined += 1;
                decisions.push({
                    address,
                    outcome: "declined",
                    reason: `bank state at $${address.toString(16)} could not be determined -- the reaching-values computation could not decide`,
                });
                continue;
            }
            // Resolves ONE region (or refuses) for a single reaching value, applies
            // it as a candidate constraint BEFORE selection runs (never a
            // post-filter), and pushes the matching decision. Shared by
            // both the single-value and the several-values-same-region branches
            // below, so the annotate path is written exactly once.
            const annotateUnderRegion = (region, bankNote) => {
                const constrained = entries.filter((entry) => regionAdmitsEntry(entry, region));
                const selection = selectEntry(address, constrained);
                if (selection === undefined) {
                    skippedNoMapEntry += 1;
                    decisions.push({
                        address,
                        outcome: "skipped-no-entry",
                        reason: `no memmap.json entry admits the resolved ${region} region for $${address.toString(16)}`,
                    });
                    return;
                }
                const commentText = `${selection.entry.label} ${BANK_PROVENANCE_PREFIX}${bankNote}] ${PROVENANCE_TOKEN_PREFIX}${digest}`;
                const write = setComment(handle, { address, commentType: "line", text: commentText });
                annotated += 1;
                if (write.changed)
                    commentsChanged += 1;
                decisions.push({
                    address,
                    outcome: "annotated",
                    label: selection.entry.label,
                    ...(reaching.kind === "several" ? { reason: `reached under differing processor-port values (${bankNote}) that all resolve to the same region (${region})` } : {}),
                });
            };
            if (reaching.kind === "one") {
                const region = resolveBankedRegion(address, decodeBankState(reaching.value));
                annotateUnderRegion(region, `$${reaching.value.toString(16)}`);
                continue;
            }
            // reaching.kind === "several"
            if (reaching.values.length === 0) {
                declined += 1;
                decisions.push({
                    address,
                    outcome: "declined",
                    reason: `no recovered processor-port value reaches $${address.toString(16)} -- declining rather than defaulting to the power-on state`,
                });
                continue;
            }
            const uniqueValues = [...new Set(reaching.values)].sort((a, b) => a - b);
            const regionsByValue = uniqueValues.map((value) => resolveBankedRegion(address, decodeBankState(value)));
            const uniqueRegions = new Set(regionsByValue);
            if (uniqueRegions.size > 1) {
                declined += 1;
                const named = uniqueValues.map((value, i) => `$${value.toString(16)}(${regionsByValue[i]})`).join(", ");
                decisions.push({
                    address,
                    outcome: "declined",
                    reason: `$${address.toString(16)} is reached under disagreeing processor-port values: ${named}`,
                });
                continue;
            }
            const region = regionsByValue[0];
            const valuesNote = uniqueValues.map((value) => `$${value.toString(16)}`).join(",");
            annotateUnderRegion(region, valuesNote);
            continue;
        }
        const selection = selectEntry(address, entries);
        if (selection === undefined) {
            skippedNoMapEntry += 1;
            decisions.push({
                address,
                outcome: "skipped-no-entry",
                reason: "no memmap.json entry contains this address",
            });
            continue;
        }
        // The full comment text: the selected entry's label, one space, the
        // provenance prefix, then the full 64-character digest -- always LAST,
        // never truncated. setComment() -> assertCommentText() refuses
        // (never truncates) a text that overflows MAX_COMMENT_BYTES; that
        // refusal is left to propagate here rather than being pre-checked and
        // silently worked around, because a truncated provenance token would be
        // a wrong answer that reports success.
        const commentText = `${selection.entry.label} ${PROVENANCE_TOKEN_PREFIX}${digest}`;
        const write = setComment(handle, { address, commentType: "line", text: commentText });
        annotated += 1;
        if (write.changed)
            commentsChanged += 1;
        decisions.push({ address, outcome: "annotated", label: selection.entry.label });
    }
    // THE GRAPHICS WRITE-BACK. Runs AFTER the main
    // per-address loop above, as its own step -- graphics ranges are derived
    // from register VALUES, never from the cross-reference targets the loop
    // above walks, so there is no reason to interleave the two. Gated on the
    // SAME `constWrites !== undefined` condition the bank-state block uses:
    // omitting `constWrites` entirely is a complete no-op here too, exactly
    // like the bank-state block above.
    let graphics;
    if (args.constWrites !== undefined) {
        const maps = deriveGraphicsRanges(args.constWrites);
        const mapIndex = args.graphicsMapIndex ?? 0;
        const selectedMap = maps[mapIndex];
        if (selectedMap === undefined) {
            throw new AnnoJoinError(`runMemmapJoin refused: graphicsMapIndex ${mapIndex} is out of range -- deriveGraphicsRanges() produced ` +
                `${maps.length} map(s) for this run's own constWrites`);
        }
        // Write ONLY the selected map's own ranges -- never every map
        // deriveGraphicsRanges() returned. Several distinct register-value
        // combinations describe MUTUALLY CONTRADICTING layouts (the reason
        // several maps exist at all); writing more than one into the
        // same store would write ranges that disagree with each other by
        // construction.
        let rangesWritten = 0;
        const contradictedComments = [];
        const reinterpretedSplitTables = [];
        for (const range of selectedMap.ranges) {
            const write = setDataType(handle, { start: range.start, endInclusive: range.endInclusive, dataType: range.dataType });
            rangesWritten += 1;
            // Disclosures a successful range write can carry -- surfaced, never
            // dropped (must_haves.truths): a comment whose recorded confidence now
            // contradicts the type this write just assigned, or a split table this
            // write fragmented.
            contradictedComments.push(...write.contradictedComments);
            reinterpretedSplitTables.push(...write.reinterpretedSplitTables);
        }
        graphics = { mapIndex, rangesWritten, contradictedComments, reinterpretedSplitTables };
    }
    const counts = {
        addressesConsidered: targets.length,
        annotated,
        skippedInImage,
        skippedNoMapEntry,
        declined,
        commentsChanged,
        graphicsRangesWritten: graphics?.rangesWritten ?? 0,
        graphicsContradictedComments: graphics?.contradictedComments.length ?? 0,
        graphicsReinterpretedSplitTables: graphics?.reinterpretedSplitTables.length ?? 0,
    };
    return graphics === undefined ? { counts, decisions } : { counts, decisions, graphics };
}
