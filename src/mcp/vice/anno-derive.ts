#!/usr/bin/env node
// anno-derive.ts
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: answers DERIVED from the
// program bytes on every query -- the cross-reference set for an address, and
// the search over labels, comments and rendered instruction text. Every answer
// here is recomputed from the caller's own bytes and the store's own range
// table each time it is asked for. Nothing this module computes is retained
// between calls, in memory or anywhere else.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// A cached derivation would be a SECOND ON-DISK TRUTH that can disagree with
// the range table it came from, and the disagreement would be invisible because
// both answers look authoritative. That is not this module's opinion -- three
// places in this tree state the rule independently:
//
//   * `anno-store.ts`'s `putXref` doc block, in as many words: "nothing
//     derivable is ever written here. A cached derivation would be a SECOND
//     ON-DISK TRUTH that can disagree with the range table it came from".
//   * `anno-types.ts`'s `XrefRow` type doc: "Only NON-DERIVABLE references live
//     here".
//   * `COV-01`'s derived-from-bytes byte-coverage census, whose whole
//     discipline is that coverage is computed from bytes rather than recorded
//     beside them.
//
// Splitting the derivation into its own module is what makes that rule
// ENFORCEABLE rather than merely stated: `anno-derive.test.ts`'s structural
// control reads THIS FILE's comment-stripped source and asserts it carries no
// SQL write verb, no filesystem write call and no persistence binding. A rule
// living in a file whose whole subject is derivation is a rule a reader trips
// over before breaking.
//
// ---------------------------------------------------------------------------
// THE MATCHING RULE, stated as a decision rather than left to be inferred
// ---------------------------------------------------------------------------
// Search matching is a BYTE-EXACT SUBSTRING test over the corpus text, CASE
// SENSITIVE, applied identically to all three corpora. No Unicode
// normalisation is applied and none is assumed.
//
// Case sensitivity is not a default that fell out of `String.prototype`
// includes: `anno-store.ts`'s `setLabel` doc block records that the store's own
// name-versus-name comparison is "EXACT BYTE EQUALITY -- the SQL `=` on a text
// column with the default (binary) collation [...] No case folding, no Unicode
// normalisation, no trimming." A search that case-folded would report a hit on
// a label the store itself considers a DIFFERENT name, so the search and the
// store would disagree about identity. `r2000_search_disassembly`'s
// case-insensitive default is the shape this deliberately does not copy, and
// the divergence is named in the tool description rather than left for a caller
// to discover from a missing hit.
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO
// ---------------------------------------------------------------------------
//   - Never write anything, anywhere, on any path in this file. No cache table,
//     no index file, no memoised store column, no snapshot. That means: no SQL
//     write statement, no `node:fs` write call, and no naming of the
//     persistence builtin `node:sqlite` -- the store is reached ONLY through
//     `anno-store.ts`'s own read entry points (STORE-07).
//   - Never import `hostpath.ts`, `containerpath.ts` or `container-guard.mts`.
//     This module is proxy-local; a host/container-translated path would point
//     the derivation at bytes on the wrong side of the container boundary
//     (MCP-02, and `hostpath-consumers.test.ts` names this module as forbidden).
//   - Never add a second address parser, a second range validator or a second
//     data-type vocabulary. `parseStoreAddress`, `assertRangeShape` and
//     `assertDataType` are imported from `anno-types.ts` for exactly that
//     reason; a divergent second rule would accept an address the store refuses.
//   - Never re-derive a split table's partner arithmetic. `splitEntryAddressPairs`
//     is the ONE place that knows an entry's partner; a second copy could
//     disagree about what an entry IS, silently, because both copies produce
//     legal answers.
//   - Never give `max_results` a default. An implicit ceiling makes a truncated
//     answer indistinguishable from a complete one; the ceiling is the caller's
//     and the true total comes back beside the truncated list.
//   - Never return a plausible zero for something this surface cannot answer.
//     An unsupported corpus comes back as `{available:false, reason}` in the
//     register style of `stock-cia.ts`'s unavailability table -- what was asked
//     for, why it cannot be answered, and where the nearest answerable thing
//     lives.
import { listComments, listLabels, listRanges, listXrefs } from "./anno-store.ts";
import type { AnnoStoreHandle } from "./anno-store.ts";
import {
  ADDRESS_MAX,
  ADDRESS_MIN,
  AnnoStoreError,
  assertDataType,
  assertRangeShape,
  isSplitDataType,
  parseStoreAddress,
  producesXrefsFor,
  resolveSplitTargets,
  splitEntryAddressPairs,
} from "./anno-types.ts";
import type { AnnoStoreErrorOptions, DataType, RangeRow } from "./anno-types.ts";
import { decode } from "./disasm-decoder.ts";
import type { Instruction } from "./disasm-decoder.ts";
import { renderLine } from "./disasm-renderer.ts";

// ---------------------------------------------------------------------------
// Refusals. Both are `AnnoStoreError` subclasses and therefore `ViceError`s --
// never a bare `Error` -- so one `catch` takes the whole family and the caller
// can name which member fired.
// ---------------------------------------------------------------------------

export interface AnnoDeriveArgumentErrorOptions extends AnnoStoreErrorOptions {
  argument?: string;
  value?: unknown;
}

/** An argument this module cannot derive from: an absent or non-positive
 * `max_results`, a query that is not a string, or an image larger than the
 * address space it is supposed to describe. The MCP transport validates
 * NOTHING (`vice-proxy.ts:3230`'s `validate: (value) => ({ value })`), so every
 * such argument is re-checked at the boundary that actually runs. */
export class AnnoDeriveArgumentError extends AnnoStoreError {
  argument?: string;
  value?: unknown;

  constructor(message: string, { argument, value, ...rest }: AnnoDeriveArgumentErrorOptions = {}) {
    super(message, rest);
    this.name = "AnnoDeriveArgumentError";
    this.argument = argument;
    this.value = value;
  }
}

export interface AnnoDerivedTargetErrorOptions extends AnnoStoreErrorOptions {
  fromAddress?: number;
  target?: number;
}

/** A decoded edge whose computed target left the 6510's address space.
 *
 * UNREACHABLE TODAY, AND DELIBERATELY KEPT: `disasm-decoder.ts`'s rule 2 masks
 * every address it produces with `& 0xffff`, and its relative branch resolves
 * `(address + 2 + signed8(offset)) & 0xffff`, so no `Instruction` this module
 * can be handed carries an out-of-space target. This is defence in depth on a
 * currently unreachable path -- the same posture `disasm-decoder.ts` records for
 * its own `startAddress` bound -- and it exists so that a future decoder change
 * that stopped wrapping is REPORTED BY NAME rather than silently wrapped or
 * truncated here, where the wrap would look like a legitimate address. */
export class AnnoDerivedTargetError extends AnnoStoreError {
  fromAddress?: number;
  target?: number;

  constructor(message: string, { fromAddress, target, ...rest }: AnnoDerivedTargetErrorOptions = {}) {
    super(message, rest);
    this.name = "AnnoDerivedTargetError";
    this.fromAddress = fromAddress;
    this.target = target;
  }
}

// ---------------------------------------------------------------------------
// Bounds (T-29-15). Both are caller-facing refusals rather than silent
// truncation: an answer quietly computed over less than it was asked about is
// the failure the whole `max_results` convention exists against.
// ---------------------------------------------------------------------------

/** The largest `image` this module will look at: the 6510's whole address
 * space. A longer buffer cannot be a C64 program image -- every range the store
 * can hold is bounded to `$0000..$ffff` by `assertRangeShape` -- so it is a
 * caller mistake (a whole `.d64`, an unsplit archive) and is refused by name
 * rather than walked. */
export const ANNO_DERIVE_MAX_IMAGE_BYTES = ADDRESS_MAX - ADDRESS_MIN + 1;

/** The default ceiling on how many bytes `searchAnnotations` will decode to
 * build its instruction corpus. Overridable through the environment variable of
 * the same name, READ AT CALL TIME (never frozen at module load) -- the same
 * read-at-call-time convention `r2000-tools.ts`'s `R2000_READ_REGION_MAX_BYTES`
 * override uses, so one `node --test` process can point several different caps
 * at this code within a single run. */
export const ANNO_SEARCH_MAX_CORPUS_BYTES = ADDRESS_MAX - ADDRESS_MIN + 1;

function currentCorpusByteCap(): number {
  const raw = process.env.ANNO_SEARCH_MAX_CORPUS_BYTES;
  if (raw === undefined) return ANNO_SEARCH_MAX_CORPUS_BYTES;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : ANNO_SEARCH_MAX_CORPUS_BYTES;
}

// ---------------------------------------------------------------------------
// Shared byte plumbing. Every slice below is bounded by a `RangeRow`'s OWN
// `start`/`endInclusive` and by the image's own length (T-29-17): a derived
// answer can never read a byte outside a range a human typed.
// ---------------------------------------------------------------------------

function assertImage(image: unknown): Uint8Array {
  if (!(image instanceof Uint8Array)) {
    throw new AnnoDeriveArgumentError(
      'the program "image" must be a Uint8Array of the bytes to derive from -- the store holds NO program image (D-07), so every ' +
        "derived answer is computed from bytes the caller names.",
      { argument: "image", value: typeof image },
    );
  }
  if (image.length > ANNO_DERIVE_MAX_IMAGE_BYTES) {
    throw new AnnoDeriveArgumentError(
      `the program "image" is ${image.length} bytes, which exceeds ANNO_DERIVE_MAX_IMAGE_BYTES (${ANNO_DERIVE_MAX_IMAGE_BYTES}, the ` +
        "6510's whole address space). Every range this store can hold is bounded to $0000..$ffff, so a longer buffer is not a program " +
        "image -- refused by name rather than walked.",
      { argument: "image", value: image.length },
    );
  }
  return image;
}

function assertOrigin(origin: unknown): number {
  return parseStoreAddress(origin, { what: "origin" });
}

/**
 * The bytes of `range` as they sit in `image`, or `null` when the range is not
 * reachable in this image at all.
 *
 * `range.start - origin` is computed and CHECKED before it is used: a negative
 * offset handed to `subarray()` counts from the END of the buffer, which would
 * silently return a plausible-looking slice of the wrong bytes. The tail is
 * clamped to the image's own length so a range that runs past the last byte
 * yields the bytes that exist (which `decode()` reports as `truncated`) rather
 * than a fabricated remainder.
 */
function sliceForRange(image: Uint8Array, origin: number, range: RangeRow): Uint8Array | null {
  const begin = range.start - origin;
  if (begin < 0 || begin >= image.length) return null;
  const end = Math.min(range.endInclusive - origin + 1, image.length);
  if (end <= begin) return null;
  return image.subarray(begin, end);
}

/** Re-narrows a row's `data_type` text through the ONE vocabulary. `listRanges`
 * casts the column (`row.data_type as DataType`) without validating it, so this
 * is where a store written by something else stops being trusted. */
function rangeDataType(range: RangeRow): DataType {
  return assertDataType(range.dataType);
}

/** Every range this store types `code`, with its bytes and its own shape
 * re-validated. */
function codeRanges(handle: AnnoStoreHandle): RangeRow[] {
  return listRanges(handle).filter((range) => rangeDataType(range) === "code");
}

/** Decodes one `code` range fresh. There is deliberately no memoisation here,
 * not even within a single call: see this file's header. */
function decodeRange(image: Uint8Array, origin: number, range: RangeRow): Instruction[] {
  const bytes = sliceForRange(image, origin, range);
  if (bytes === null) return [];
  assertRangeShape(range.start, range.endInclusive, rangeDataType(range));
  return decode(bytes, range.start, { end: range.endInclusive });
}

/**
 * The address an instruction REFERENCES, or `undefined` when it references
 * none.
 *
 *   * No operand at all (`rts`, `nop`) -- nothing to reference.
 *   * `immediate` -- the operand IS the value. `lda #$c0` encodes the byte
 *     `$c0`; reporting it as a reference to `$00c0` would invent an edge.
 *   * `indirect` -- `jmp ($0314)` transfers to whatever the two bytes AT
 *     `$0314` hold. That target is not derivable from this instruction, and
 *     attributing an edge to the vector's own address would name the wrong one.
 *   * Everything else (`absolute`, `zeropage`, `relative`) references an
 *     address: `resolvedTarget` when the decoder resolved one (a branch, a
 *     `jmp`/`jsr` absolute), `operand.value` otherwise.
 */
function referencedAddress(instruction: Instruction): number | undefined {
  const operand = instruction.operand;
  if (operand === undefined) return undefined;
  if (operand.role === "immediate" || operand.role === "indirect") return undefined;
  const target = instruction.resolvedTarget ?? operand.value;
  if (!Number.isInteger(target) || target < ADDRESS_MIN || target > ADDRESS_MAX) {
    throw new AnnoDerivedTargetError(
      `the instruction at $${instruction.address.toString(16).padStart(4, "0")} computed the target ${String(target)}, which is outside ` +
        `${ADDRESS_MIN}..${ADDRESS_MAX} ($0000-$ffff). Reported by name rather than wrapped or truncated: a wrapped target is a ` +
        "plausible-looking address pointing at the wrong place, and nothing downstream could tell.",
      { fromAddress: instruction.address, target: typeof target === "number" ? target : undefined },
    );
  }
  return target;
}

// ---------------------------------------------------------------------------
// Derived cross-references (STORE-06)
// ---------------------------------------------------------------------------

/** What `crossReferencesTo()` returns: the target, every address that reaches
 * it (ascending, de-duplicated), and the count restated as a field so a caller
 * can assert it without walking the array -- the same shape convention
 * `SplitTargets` uses. */
export interface CrossReferencesResult {
  to: number;
  callers: readonly number[];
  count: number;
}

/**
 * Every address that references `to`, unioned from THREE sources and returned
 * as one ascending, de-duplicated list.
 *
 *   1. THE DECODED CODE. Every range `listRanges()` types `code`, sliced out of
 *      `image` and decoded FRESH, keeping the instructions whose operand role
 *      references an address (see `referencedAddress`).
 *   2. THE TYPED SPLIT TABLES. Every range whose type is a split layout AND for
 *      which `producesXrefsFor()` is true -- the `_address` forms produce
 *      cross-references and the `_word` forms do not, which is the schema's own
 *      distinction and not a judgement made here. Each resolved target is
 *      attributed to its entry's own first-half address, taken from
 *      `splitEntryAddressPairs()` rather than recomputed.
 *   3. THE STORED ROWS. `listXrefs()` -- the ONLY half that lives on disk, and
 *      only because those references (a computed dispatch, a hand-asserted
 *      edge) cannot be recovered from the bytes at all.
 *
 * The union is a `Set`, so an address reached by two sources appears once; the
 * sort makes the answer stable regardless of the order the three sources are
 * walked. NOTHING IS WRITTEN.
 */
export function crossReferencesTo(
  handle: AnnoStoreHandle,
  image: Uint8Array,
  origin: number | string,
  to: number | string,
): CrossReferencesResult {
  const bytes = assertImage(image);
  const base = assertOrigin(origin);
  const target = parseStoreAddress(to, { what: "to" });

  const callers = new Set<number>();

  // 1. Derived from the bytes: every code range, decoded fresh.
  for (const range of codeRanges(handle)) {
    for (const instruction of decodeRange(bytes, base, range)) {
      if (referencedAddress(instruction) === target) callers.add(instruction.address);
    }
  }

  // 2. Derived from typed split tables (also bytes, also never stored).
  for (const range of listRanges(handle)) {
    const dataType = rangeDataType(range);
    if (!isSplitDataType(dataType) || !producesXrefsFor(dataType)) continue;
    const tableBytes = sliceForRange(bytes, base, range);
    // A PARTIAL split table is skipped rather than resolved. `anno-types.ts`'s
    // `SplitTableReinterpretation` records why: an entry's partner is a
    // function of the row's start AND its length, so a fragment re-pairs every
    // entry and decodes to DIFFERENT 16-bit values than the ones a human
    // recorded. Resolving a fragment would produce legal, plausible, wrong
    // targets.
    if (tableBytes === null || tableBytes.length !== range.endInclusive - range.start + 1) continue;
    const { targets } = resolveSplitTargets(tableBytes, dataType);
    const { pairs } = splitEntryAddressPairs(range.start, range.endInclusive, dataType);
    targets.forEach((resolved, i) => {
      if (resolved === target) callers.add(pairs[i]![0]);
    });
  }

  // 3. The ONLY stored half: references that cannot be recovered from bytes.
  for (const row of listXrefs(handle)) {
    if (row.toAddress === target) callers.add(row.fromAddress);
  }

  const sorted = [...callers].sort((a, b) => a - b);
  return { to: target, callers: sorted, count: sorted.length };
}

// ---------------------------------------------------------------------------
// Search (STORE-06)
// ---------------------------------------------------------------------------

/** The three corpora this surface has. Frozen and derived from, never
 * re-typed: `CorpusName` is `Extract`ed from it below. */
export const SEARCH_CORPORA = Object.freeze(["labels", "comments", "instructions"] as const);

/** One member of the frozen three. */
export type CorpusName = (typeof SEARCH_CORPORA)[number];

/** One search hit. `corpus` is carried on EVERY hit so a caller can tell a
 * label match from an instruction match without re-deriving which corpus could
 * have produced the text. */
export interface SearchHit {
  corpus: CorpusName;
  address: number;
  text: string;
}

/** What a corpus this surface does not have reports. Structurally identical to
 * `stock-cia.ts`'s unavailability entries, and for the same reason: an
 * unanswerable question must never come back as a plausible zero. */
export interface UnavailableCorpus {
  available: false;
  reason: string;
}

export interface SearchRequest {
  query: string;
  max_results: number;
  search_labels?: boolean;
  search_comments?: boolean;
  search_instructions?: boolean;
  [key: string]: unknown;
}

export interface SearchResult {
  query: string;
  caseSensitive: true;
  corpora: Record<CorpusName, { searched: boolean; entries: number }>;
  unavailable: Record<string, UnavailableCorpus>;
  results: SearchHit[];
  returned: number;
  total: number;
  truncated: boolean;
}

/** Where each corpus's own data actually lives, named in the unavailability
 * reason so a refusal points at the answerable thing instead of stopping at
 * "no". */
const NEAREST_ANSWERABLE =
  "labels (anno-store.ts's listLabels), comments (listComments) and the instruction text rendered from the ranges typed `code`";

function unavailableCorpus(name: string): UnavailableCorpus {
  return {
    available: false,
    reason:
      `search_${name} names the "${name}" corpus, which this surface does not search. The three corpora it does search are ` +
      `${NEAREST_ANSWERABLE}. Every other annotation kind is read directly through its own anno-store.ts list entry point rather ` +
      "than through this search, because a corpus with no rendered text has nothing for a substring rule to match.",
  };
}

function assertQuery(query: unknown): string {
  if (typeof query !== "string" || query === "") {
    throw new AnnoDeriveArgumentError(
      `"query" must be a non-empty string, got ${JSON.stringify(query)} -- an empty query would match every entry of every corpus, ` +
        "which is a listing rather than a search and is what the list entry points are for.",
      { argument: "query", value: query },
    );
  }
  return query;
}

/** `max_results` is REQUIRED with no default, and `0` is refused by name. An
 * implicit ceiling makes a truncated answer indistinguishable from a complete
 * one; a ceiling of zero asks for an answer that cannot carry information. */
function assertMaxResults(request: SearchRequest | undefined): number {
  const raw = request?.max_results;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw <= 0) {
    throw new AnnoDeriveArgumentError(
      `"max_results" must be a positive integer, got ${JSON.stringify(raw)} -- it is REQUIRED and has no default on this surface. ` +
        "Pass an explicit ceiling and compare the returned count against it to detect truncation; the true total comes back beside " +
        "the truncated list.",
      { argument: "max_results", value: raw },
    );
  }
  return raw;
}

/** True when the request did not explicitly disable this corpus. Enabled is the
 * default for all three, matching `r2000_search_disassembly`'s advertised
 * shape. */
function corpusEnabled(request: SearchRequest, corpus: CorpusName): boolean {
  const flag = request[`search_${corpus}`];
  return flag !== false;
}

/** Every `search_*` key naming something outside the frozen three. */
function unsupportedCorpora(request: SearchRequest): string[] {
  const known = new Set<string>(SEARCH_CORPORA);
  const found: string[] = [];
  for (const key of Object.keys(request)) {
    const match = /^search_(.+)$/.exec(key);
    if (match === null) continue;
    const name = match[1]!;
    if (!known.has(name)) found.push(name);
  }
  return found.sort();
}

/** The instruction corpus: one rendered line per decoded instruction, carrying
 * the address it was decoded at.
 *
 * `renderLine()` rather than `render()` over the whole range: a hit has to
 * carry the address it was found at, and `render()`'s output is one blob with a
 * `!cpu 6510` header and a symbol block. Both go through the same
 * `renderInstructionLine()` inside `disasm-renderer.ts`, so the text a search
 * matches is byte-identical to the text a listing shows.
 *
 * BOUNDED (T-29-15): the total number of bytes decoded for the corpus is capped
 * and exceeding the cap is REFUSED BY NAME. A silently truncated corpus would
 * report a genuine-looking zero for a term that is really there. */
function instructionCorpus(handle: AnnoStoreHandle, image: Uint8Array, origin: number): SearchHit[] {
  const cap = currentCorpusByteCap();
  const ranges = codeRanges(handle);
  let budget = 0;
  for (const range of ranges) {
    const bytes = sliceForRange(image, origin, range);
    if (bytes !== null) budget += bytes.length;
  }
  if (budget > cap) {
    throw new AnnoDeriveArgumentError(
      `the ranges typed \`code\` cover ${budget} byte(s) of this image, which exceeds the ANNO_SEARCH_MAX_CORPUS_BYTES cap of ${cap}. ` +
        "Refused rather than silently truncated: a corpus cut short reports a genuine-looking zero for a term that is really there. " +
        "Narrow the typed ranges, or raise ANNO_SEARCH_MAX_CORPUS_BYTES.",
      { argument: "image", value: budget },
    );
  }

  const hits: SearchHit[] = [];
  for (const range of ranges) {
    for (const instruction of decodeRange(image, origin, range)) {
      hits.push({ corpus: "instructions", address: instruction.address, text: renderLine(instruction) });
    }
  }
  return hits;
}

/**
 * Searches the three corpora for `request.query`.
 *
 * MATCHING IS BYTE-EXACT AND CASE-SENSITIVE over the corpus text, applied
 * identically to all three -- see the module header for why case folding would
 * put this search and the store's own name comparison into disagreement. The
 * rule is restated in the result body as `caseSensitive`, so a caller reading
 * an empty answer is told which rule produced it.
 *
 * EVERY CORPUS IS NAMED IN THE RESULT with the number of entries it held, so an
 * EMPTY RESULT over a real, non-empty corpus (a genuine zero) is distinguishable
 * from a corpus this surface does not have (`unavailable`, carrying a reason).
 * The two are separate fields; neither is inferable from the other.
 */
export function searchAnnotations(
  handle: AnnoStoreHandle,
  image: Uint8Array,
  origin: number | string,
  request: SearchRequest,
): SearchResult {
  const bytes = assertImage(image);
  const base = assertOrigin(origin);
  const bag: SearchRequest = (typeof request === "object" && request !== null ? request : {}) as SearchRequest;
  const query = assertQuery(bag.query);
  const maxResults = assertMaxResults(bag);

  const unavailable: Record<string, UnavailableCorpus> = {};
  for (const name of unsupportedCorpora(bag)) unavailable[name] = unavailableCorpus(name);

  const labelHits: SearchHit[] = listLabels(handle).map((row) => ({
    corpus: "labels" as const,
    address: row.address,
    text: row.name,
  }));
  const commentHits: SearchHit[] = listComments(handle).map((row) => ({
    corpus: "comments" as const,
    address: row.address,
    text: row.text,
  }));

  const enabled: Record<CorpusName, boolean> = {
    labels: corpusEnabled(bag, "labels"),
    comments: corpusEnabled(bag, "comments"),
    instructions: corpusEnabled(bag, "instructions"),
  };

  // The instruction corpus is only BUILT when it is going to be searched:
  // decoding every code range to answer a request that disabled the corpus
  // would pay the whole cost for nothing, and would raise the byte-cap refusal
  // for a corpus the caller did not ask about.
  const instructionHits: SearchHit[] = enabled.instructions ? instructionCorpus(handle, bytes, base) : [];

  const corpora: Record<CorpusName, { searched: boolean; entries: number }> = {
    labels: { searched: enabled.labels, entries: labelHits.length },
    comments: { searched: enabled.comments, entries: commentHits.length },
    instructions: { searched: enabled.instructions, entries: instructionHits.length },
  };

  const matched: SearchHit[] = [];
  for (const hit of [...labelHits, ...commentHits, ...instructionHits]) {
    if (!enabled[hit.corpus]) continue;
    if (hit.text.includes(query)) matched.push(hit);
  }

  const results = matched.slice(0, maxResults);
  return {
    query,
    caseSensitive: true,
    corpora,
    unavailable,
    results,
    returned: results.length,
    total: matched.length,
    truncated: matched.length > results.length,
  };
}
