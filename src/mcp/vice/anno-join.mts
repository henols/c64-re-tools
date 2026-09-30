#!/usr/bin/env node
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
// through `setComment()`. A line comment the join did not write (one with no
// memmap provenance token) is never replaced. Every write of one join runs in
// one transaction: a refusal part-way leaves the store as it was.
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

import { applyAtomically, listComments, listXrefs, setComment, setDataType } from "./anno-store.mts";
import type { AnnoStoreHandle } from "./anno-store.mts";
import {
  decodeBankState,
  isBankConditionalAddress,
  regionAdmitsEntry,
  resolveBankedRegion,
} from "./anno-bank.mts";
import type { BankedRegion } from "./anno-bank.mts";
import type { ConstWriteFact } from "./anno-import.mts";
import { AnnoStoreError, assertRangeShape } from "./anno-types.mts";
import type { ContradictedComment, SplitTableReinterpretation, XrefRow } from "./anno-types.mts";
import { loadMemmap, memmapDigest, PROVENANCE_TOKEN_PREFIX, selectMemmapEntry } from "./memmap-lookup.mts";
import type { MemmapEntry, MemmapSelection } from "./memmap-lookup.mts";
// The graphics write-back. deriveGraphicsRanges()
// is structurally typed against ConstWriteFact -- GraphicsConstWriteFact's own
// shape is identical ({storeAddress, targetAddress, value}) -- so THIS module's
// own constWrites argument, already threaded for the bank-state block, is
// handed straight through with no translation layer.
import { deriveGraphicsRanges } from "./anno-graphics.mts";
import type { GraphicsMap } from "./anno-graphics.mts";

/** The axis-qualified provenance marker an annotated bank-conditional
 * comment carries, ALWAYS before `PROVENANCE_TOKEN_PREFIX`'s own digest
 * token (which stays last). Names the axis ("processor-port")
 * explicitly, so a later phase adding the VIC banking axis is additive
 * rather than ambiguous about which axis a given token names. */
const BANK_PROVENANCE_PREFIX = "[processor-port:";

/**
 * The reaching-values computation's own result shape: exactly one
 * recovered value reaches the address; several do (an array -- length 0
 * means none reach at all, length 2+ means genuine disagreement-or-agreement
 * to resolve); or the computation cannot decide at all. Nothing in this
 * project's current data model (a plain directed graph of already-resolved
 * `XrefRow`s) can currently produce `"unknown"` -- there is no signal here
 * for a dropped or unresolved reference (a stated limit of this computation) -- but
 * the shape is kept complete for a future importer that DOES emit such a
 * signal, rather than silently folding that case into "empty".
 */
type ReachingValues = { kind: "one"; value: number } | { kind: "several"; values: number[] } | { kind: "unknown" };

/** Builds a forward adjacency map from `xrefs`, ONCE per join run, reused for
 * every address's own reachability walk below. */
function buildAdjacency(xrefs: readonly XrefRow[]): Map<number, number[]> {
  const adjacency = new Map<number, number[]>();
  for (const xref of xrefs) {
    const list = adjacency.get(xref.fromAddress);
    if (list) list.push(xref.toAddress);
    else adjacency.set(xref.fromAddress, [xref.toAddress]);
  }
  return adjacency;
}

/** Plain forward reachability (DFS, visited-set guarded against cycles):
 * can `from` reach `target` by following zero or more `adjacency` edges? */
function canReach(from: number, target: number, adjacency: Map<number, number[]>): boolean {
  if (from === target) return true;
  const visited = new Set<number>([from]);
  const stack = [from];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const next of adjacency.get(current) ?? []) {
      if (next === target) return true;
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
function computeReachingValues(
  targetAddress: number,
  constWrites: readonly ConstWriteFact[],
  adjacency: Map<number, number[]>,
): ReachingValues {
  const reaching: number[] = [];
  for (const write of constWrites) {
    if (canReach(write.storeAddress, targetAddress, adjacency)) reaching.push(write.value);
  }
  if (reaching.length === 1) return { kind: "one", value: reaching[0]! };
  return { kind: "several", values: reaching };
}

/** Raised when `runMemmapJoin()`'s own inputs cannot support a join: a
 * zero-byte image, or a graphics map index or range the derivation cannot
 * back. Part of the store's error family, so a caller catches it with the
 * rest. */
export class AnnoJoinError extends AnnoStoreError {
  constructor(message: string) {
    super(message);
    this.name = "AnnoJoinError";
  }
}

/** What one `runMemmapJoin()` call reports. `addressesConsidered` is always
 * the sum of the next five fields. The three `graphics*` fields are always
 * present and `0` when `constWrites` is omitted or when
 * the selected map derives zero ranges -- never absent, so a caller reads
 * them unconditionally instead of guarding on them, mirroring
 * `SetDataTypeResult`'s own "always present, often empty" convention for
 * `contradictedComments`/`reinterpretedSplitTables`. */
export interface JoinCounts {
  addressesConsidered: number;
  annotated: number;
  skippedInImage: number;
  skippedNoMapEntry: number;
  /** Addresses whose line comment someone else wrote: left as they are. */
  skippedExistingComment: number;
  declined: number;
  commentsChanged: number;
  graphicsRangesWritten: number;
  graphicsContradictedComments: number;
  graphicsReinterpretedSplitTables: number;
}

/**
 * What the graphics write-back reports, in full --
 * `JoinCounts`'s own `graphics*` fields are the COUNTS of these same
 * `contradictedComments`/`reinterpretedSplitTables` arrays; this record
 * carries the disclosures themselves so neither is dropped (must_haves.truths:
 * "the join's returned counts include the contradicted-comment and
 * fragmented-split-table disclosures the range write reported; neither is
 * dropped"). `mapIndex` records WHICH of `deriveGraphicsRanges()`'s several
 * maps was written -- this project's own rule (several valid combinations are
 * several maps, never one merged map) means writing more than one would
 * write mutually-contradicting ranges into the SAME store, so exactly one is
 * ever written and this field is the record of which. */
export interface GraphicsWriteBack {
  mapIndex: number;
  rangesWritten: number;
  contradictedComments: readonly ContradictedComment[];
  reinterpretedSplitTables: readonly SplitTableReinterpretation[];
}

/** One address's own outcome. A skip or a decline always carries a non-empty
 * `reason` naming WHY in the join's own vocabulary; an annotation carries the
 * `label` it wrote. */
export interface JoinDecision {
  address: number;
  outcome: "annotated" | "skipped-in-image" | "skipped-no-entry" | "skipped-existing-comment" | "declined";
  reason?: string;
  label?: string;
}

export interface RunMemmapJoinArgs {
  imageOrigin: number;
  imageByteLength: number;
  /** The recovered `$01` const-write facts this run
   * has evidence for, typically `parseConstWrites()`'s own output over one
   * imported export. `undefined` (every pre-37-06 call site) means "this run
   * carries no bank-state evidence at all" -- the bank-state machinery is a
   * complete no-op and every address resolves EXACTLY as before this plan.
   * An explicit array (even `[]`) activates it for addresses inside
   * `BANK_CONDITIONAL_RANGES`. */
  constWrites?: readonly ConstWriteFact[];
  /** Which of `deriveGraphicsRanges()`'s
   * several maps to write back, when `constWrites` derives more than one
   * distinct register-value combination. Defaults to `0`. Consulted ONLY
   * when `constWrites` is supplied AT ALL (the SAME gate that activates the
   * bank-state block above) -- omitting `constWrites` entirely skips the
   * graphics write-back completely, exactly like the bank-state block. Out
   * of range for the derived map count refuses BY NAME (`AnnoJoinError`)
   * rather than silently clamping or picking a default. */
  graphicsMapIndex?: number;
  /** The whole join's compare-and-swap guard, checked under the write lock
   * before the first write. */
  baseRevision?: number;
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
 * containing `memmap.json` entry is skipped for that reason instead, and so
 * is an address whose line comment the join did not write (it carries no
 * memmap provenance token): a human's comment is never replaced. Everything
 * else is annotated with the selected entry's label via `setComment()`. All
 * writes run in one transaction, after the graphics map is checked, so a
 * refusal leaves the store unchanged. Running this twice over an unchanged store re-classifies
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
export function runMemmapJoin(
  handle: AnnoStoreHandle,
  args: RunMemmapJoinArgs,
  entries: readonly MemmapEntry[] = loadMemmap(),
  selectEntry: (address: number, entries: readonly MemmapEntry[]) => MemmapSelection | undefined = selectMemmapEntry,
): { counts: JoinCounts; decisions: JoinDecision[]; graphics?: GraphicsWriteBack } {
  if (args.imageByteLength === 0) {
    throw new AnnoJoinError(
      "runMemmapJoin refused: the image's own body length is 0 -- an image with no bytes has no range, and treating " +
        "it as a zero-width range at its own origin would silently make one address (the origin) read as in-image.",
    );
  }

  // The graphics map is chosen and checked BEFORE the first write, so an
  // index or a range the derivation cannot back refuses a join that has
  // written nothing. Several distinct register-value combinations describe
  // mutually contradicting layouts, so only the selected map is written.
  let selectedGraphics: { mapIndex: number; map: GraphicsMap } | undefined;
  if (args.constWrites !== undefined) {
    const maps = deriveGraphicsRanges(args.constWrites);
    const mapIndex = args.graphicsMapIndex ?? 0;
    const map: GraphicsMap | undefined = maps[mapIndex];
    if (map === undefined) {
      throw new AnnoJoinError(
        `runMemmapJoin refused: graphicsMapIndex ${mapIndex} is out of range -- deriveGraphicsRanges() produced ` +
          `${maps.length} map(s) for this run's own constWrites. Nothing was written.`,
      );
    }
    for (const range of map.ranges) {
      try {
        assertRangeShape(range.start, range.endInclusive, range.dataType);
      } catch (err) {
        throw new AnnoJoinError(
          `runMemmapJoin refused: graphics map ${mapIndex} derived a ${range.kind} range $${range.start.toString(16)}-` +
            `$${range.endInclusive.toString(16)} the store cannot hold (${err instanceof Error ? err.message : String(err)}). Nothing was written.`,
        );
      }
    }
    selectedGraphics = { mapIndex, map };
  }

  return applyAtomically(handle, () => joinInsideTransaction(handle, args, entries, selectEntry, selectedGraphics), {
    baseRevision: args.baseRevision,
  });
}

function joinInsideTransaction(
  handle: AnnoStoreHandle,
  args: RunMemmapJoinArgs,
  entries: readonly MemmapEntry[],
  selectEntry: (address: number, entries: readonly MemmapEntry[]) => MemmapSelection | undefined,
  selectedGraphics: { mapIndex: number; map: GraphicsMap } | undefined,
): { counts: JoinCounts; decisions: JoinDecision[]; graphics?: GraphicsWriteBack } {
  // Computed ONCE per join run, so two comments written in the same run
  // carry byte-identical tokens.
  const digest = memmapDigest();

  const xrefs = listXrefs(handle);
  const targets = [...new Set(xrefs.map((xref) => xref.toAddress))].sort((a, b) => a - b);

  // Built once per run and reused for every address's reachability walk.
  // Only consulted when `args.constWrites` is supplied.
  const bankAdjacency = buildAdjacency(xrefs);

  // The line comment already at each address, read under the write lock.
  const lineComments = new Map<number, string>();
  for (const row of listComments(handle)) {
    if (row.commentType === "line") lineComments.set(row.address, row.text);
  }

  // The inclusive image range, from the image's body bytes -- never from
  // the file's byte count, which on the .prg route includes the two-byte
  // load-address header.
  const imageStart = args.imageOrigin;
  const imageEnd = args.imageOrigin + args.imageByteLength - 1;

  const decisions: JoinDecision[] = [];
  let annotated = 0;
  let skippedInImage = 0;
  let skippedNoMapEntry = 0;
  let skippedExistingComment = 0;
  let declined = 0;
  let commentsChanged = 0;

  // Writes the join's comment at `address`, unless a line comment the join
  // did not write is already there. setComment() -> assertCommentText()
  // refuses (never truncates) a text that overflows MAX_COMMENT_BYTES; that
  // refusal propagates, because a truncated provenance token would be a
  // wrong answer that reports success.
  const writeJoinComment = (address: number, label: string, commentText: string, reason?: string): void => {
    const existing = lineComments.get(address);
    if (existing !== undefined && !existing.includes(PROVENANCE_TOKEN_PREFIX)) {
      skippedExistingComment += 1;
      decisions.push({
        address,
        outcome: "skipped-existing-comment",
        reason: `$${address.toString(16)} already carries a line comment the join did not write; it is left as it is`,
      });
      return;
    }
    const write = setComment(handle, { address, commentType: "line", text: commentText });
    annotated += 1;
    if (write.changed) commentsChanged += 1;
    decisions.push({ address, outcome: "annotated", label, ...(reason !== undefined ? { reason } : {}) });
  };

  for (const address of targets) {
    // THE GUARD: an in-image address is a program address, and it is skipped
    // before selectEntry() is ever called.
    if (address >= imageStart && address <= imageEnd) {
      skippedInImage += 1;
      decisions.push({
        address,
        outcome: "skipped-in-image",
        reason:
          `address $${address.toString(16)} lies inside the loaded image's own range ($${imageStart.toString(16)}-` +
          `$${imageEnd.toString(16)}) and is therefore a program address, never looked up in memmap.json`,
      });
      continue;
    }

    // THE BANK-STATE BLOCK. Only entered when the caller supplied
    // `constWrites` AND the address is inside one of the bank-conditional
    // ranges; everywhere else the candidate set stays unconstrained.
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

      // Resolves the entry for one region, applied as a candidate constraint
      // BEFORE selection runs (never a post-filter).
      const annotateUnderRegion = (region: Exclude<BankedRegion, "not_applicable">, bankNote: string): void => {
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
        const reason =
          reaching.kind === "several"
            ? `reached under differing processor-port values (${bankNote}) that all resolve to the same region (${region})`
            : undefined;
        writeJoinComment(address, selection.entry.label, commentText, reason);
      };

      if (reaching.kind === "one") {
        const region = resolveBankedRegion(address, decodeBankState(reaching.value));
        annotateUnderRegion(region as Exclude<BankedRegion, "not_applicable">, `$${reaching.value.toString(16)}`);
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

      const region = regionsByValue[0]! as Exclude<BankedRegion, "not_applicable">;
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

    // The selected entry's label, one space, the provenance prefix, then the
    // full 64-character digest -- always LAST, never truncated.
    writeJoinComment(address, selection.entry.label, `${selection.entry.label} ${PROVENANCE_TOKEN_PREFIX}${digest}`);
  }

  // THE GRAPHICS WRITE-BACK, after the per-address loop: graphics ranges are
  // derived from register VALUES, never from the cross-reference targets.
  let graphics: GraphicsWriteBack | undefined;
  if (selectedGraphics !== undefined) {
    let rangesWritten = 0;
    const contradictedComments: ContradictedComment[] = [];
    const reinterpretedSplitTables: SplitTableReinterpretation[] = [];
    for (const range of selectedGraphics.map.ranges) {
      const write = setDataType(handle, { start: range.start, endInclusive: range.endInclusive, dataType: range.dataType });
      rangesWritten += 1;
      // Disclosures a successful range write can carry -- surfaced, never
      // dropped.
      contradictedComments.push(...write.contradictedComments);
      reinterpretedSplitTables.push(...write.reinterpretedSplitTables);
    }
    graphics = { mapIndex: selectedGraphics.mapIndex, rangesWritten, contradictedComments, reinterpretedSplitTables };
  }

  const counts: JoinCounts = {
    addressesConsidered: targets.length,
    annotated,
    skippedInImage,
    skippedNoMapEntry,
    skippedExistingComment,
    declined,
    commentsChanged,
    graphicsRangesWritten: graphics?.rangesWritten ?? 0,
    graphicsContradictedComments: graphics?.contradictedComments.length ?? 0,
    graphicsReinterpretedSplitTables: graphics?.reinterpretedSplitTables.length ?? 0,
  };
  return graphics === undefined ? { counts, decisions } : { counts, decisions, graphics };
}
