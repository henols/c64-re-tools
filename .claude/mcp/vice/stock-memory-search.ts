#!/usr/bin/env node
// stock-memory-search.ts
//
// vice_memory_search / vice_memory_compare -- the DERIV-01 pair. Both are
// DERIVED tools: the binary monitor's confirmed command set
// (docs/phase0-binmon-findings.md §5) has no MEMORY_SEARCH or MEMORY_COMPARE
// opcode at all, so both answers are computed CLIENT-SIDE from one bounded
// MEM_GET read per range -- the same shape stock-disassemble.ts already
// uses. Registered through withDerivedTool("...", { needsSession: true },
// ...) in stock-dispatch.ts, never withStockSession() (D-01/D-03).
//
// WHAT NOT TO DO:
//   - Never import hostpath.ts or vice-proxy.ts, and never call the
//     fork-forwarding function's rewriteArguments() -- hostpath-consumers.test.ts
//     gates this file's absence from the closed host-path consumer set
//     (D-02). Neither tool takes a path argument at all.
//   - Never issue an unrequested resume (Phase 3 D-05) -- these handlers
//     send MEM_GET and nothing else. `runState` on the answer (via
//     stockAnswer()) reports the halt honestly.
//   - Never turn the MEM_GET body's side-effect flag on -- searching or
//     comparing across $D000-$DFFF must never clear a pending VIC-II IRQ
//     flag or otherwise mutate emulator state as a side effect of reading
//     it. `sidefx` is hardcoded `false` at every call site below with no
//     argument to override it.
//   - Never build the answer outside stockAnswer() (D-06) -- that is
//     exactly how an answer ships without `runState`.
//   - Never re-derive address/byte-count parsing locally (D-04) --
//     stock-address.ts's parseAddress()/parseByteCount() are the only seam.
//   - Never implement `vice_memory_compare`'s `mode:'snapshot'` as a
//     destructive snapshot restore or a `.vsf` parser (D-05-01) -- it is
//     refused by name, before any MEM_GET is sent.
import { CommandType, memGetBody } from "./stock-protocol.ts";
import { parseAddress, parseByteCount } from "./stock-address.ts";
import { convertWireError, isErrorText, stockAnswer, type StockSessionHandler, type StockErrorResult } from "./stock-handler.ts";

/** True iff `value` is a well-formed, generic JSON object -- not null, not
 * an array. Matches this module tree's own isPlainObject() convention
 * (stock-memory.ts, stock-disassemble.ts et al.) -- a small private copy,
 * not a shared import. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The fork's own documented `max_results`/`max_differences` bounds, quoted
 * verbatim from its description: default 100, refused above 10000. */
const DEFAULT_MAX_RESULTS = 100;
const MAX_MAX_RESULTS = 10000;

/** A hard ceiling on client-side scan cost, independent of the
 * pattern-longer-than-range-searched refusal below. */
const MAX_PATTERN_BYTES = 0x1000;

/**
 * Validates `input` as a non-empty array of integers 0..255, mirroring
 * vice_memory_write's own `data` array validation loop verbatim in
 * structure (stock-memory.ts). Used for both `pattern` and `mask`. Returns
 * the validated `number[]` on success, or a ready-to-return
 * `StockErrorResult` on failure -- callers `return`-propagate the error
 * branch directly.
 */
function parseByteArray(toolName: string, what: string, input: unknown): number[] | StockErrorResult {
  if (!Array.isArray(input)) {
    return isErrorText(`${toolName}: ${what} must be a non-empty array of integers 0..255, got ${typeof input}`);
  }
  if (input.length === 0) {
    return isErrorText(`${toolName}: ${what} must not be empty`);
  }
  const values: number[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const value: unknown = input[index];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 0xff) {
      return isErrorText(`${toolName}: ${what}[${index}] must be an integer 0..255, got ${JSON.stringify(value)}`);
    }
    values.push(value);
  }
  return values;
}

/** Narrows a `parseByteArray()` result to its error branch. */
function isByteArrayError(result: number[] | StockErrorResult): result is StockErrorResult {
  return !Array.isArray(result);
}

// ---------------------------------------------------------------------------
// vice_memory_search
// ---------------------------------------------------------------------------

export const handleMemorySearch: StockSessionHandler = async (args, session, _deps) => {
  if (!isPlainObject(args)) {
    return isErrorText("vice_memory_search: arguments must be an object");
  }

  // --------------------------------------------------------- start/end (both required)

  let start: number, end: number;
  try {
    start = parseAddress(args.start, { what: "start" });
    end = parseAddress(args.end, { what: "end" });
  } catch (err) {
    return isErrorText(`vice_memory_search: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (end < start) {
    return isErrorText(`vice_memory_search: end (0x${end.toString(16)}) must be >= start (0x${start.toString(16)})`);
  }

  // --------------------------------------------------------- pattern (required)

  const patternResult = parseByteArray("vice_memory_search", "pattern", args.pattern);
  if (isByteArrayError(patternResult)) {
    return patternResult;
  }
  const pattern = patternResult;

  if (pattern.length > MAX_PATTERN_BYTES) {
    return isErrorText(`vice_memory_search: pattern is ${pattern.length} byte(s), which exceeds the maximum of ${MAX_PATTERN_BYTES}`);
  }
  const searched = end - start + 1;
  if (pattern.length > searched) {
    return isErrorText(
      `vice_memory_search: pattern is ${pattern.length} byte(s), longer than the ${searched} byte(s) searched (0x${start.toString(16)}-0x${end.toString(16)}) -- it can never match`,
    );
  }

  // --------------------------------------------------------- mask (optional)

  let mask: number[] | undefined;
  if (args.mask !== undefined) {
    const maskResult = parseByteArray("vice_memory_search", "mask", args.mask);
    if (isByteArrayError(maskResult)) {
      return maskResult;
    }
    mask = maskResult;
    if (mask.length !== pattern.length) {
      return isErrorText(
        `vice_memory_search: mask is ${mask.length} byte(s) but pattern is ${pattern.length} byte(s) -- mask is never padded or truncated to fit, the lengths must match exactly`,
      );
    }
  }

  // --------------------------------------------------------- max_results (optional, default 100, max 10000)

  let maxResults = DEFAULT_MAX_RESULTS;
  if (args.max_results !== undefined) {
    try {
      maxResults = parseByteCount(args.max_results, { max: MAX_MAX_RESULTS, what: "max_results" });
    } catch (err) {
      return isErrorText(`vice_memory_search: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // --------------------------------------------------------- bounded memory read (Phase 3 D-05: halts, never resumes)

  const body = memGetBody({ sidefx: false, start, end, memspace: 0x00, bank: 0x0000 });

  let response;
  try {
    response = await session.client.send(CommandType.MemoryGet, body);
  } catch (err) {
    return convertWireError("vice_memory_search", err);
  }

  if (response.type !== "memory_get") {
    return isErrorText(
      `vice_memory_search: the binary monitor replied with an unexpected response type ("${response.type}"), expected "memory_get"`,
    );
  }
  if (response.bytes.length !== searched) {
    return isErrorText(
      `vice_memory_search: expected ${searched} byte(s), got ${response.bytes.length} -- a short read is a wrong answer, not a partial success`,
    );
  }

  // --------------------------------------------------------- client-side scan (overlapping matches, bounded)

  const bytes = response.bytes;
  const matches: number[] = [];
  let truncated = false;
  for (let offset = 0; offset <= bytes.length - pattern.length; offset += 1) {
    let isMatch = true;
    for (let index = 0; index < pattern.length; index += 1) {
      const actual = bytes[offset + index]!;
      if (mask !== undefined) {
        const maskByte = mask[index]!;
        if ((actual & maskByte) !== (pattern[index]! & maskByte)) {
          isMatch = false;
          break;
        }
      } else if (actual !== pattern[index]) {
        isMatch = false;
        break;
      }
    }
    if (isMatch) {
      matches.push(start + offset);
      if (matches.length === maxResults) {
        truncated = true;
        break;
      }
    }
  }

  const payload: Record<string, unknown> = {
    start,
    end,
    searched,
    pattern,
    ...(mask !== undefined ? { mask } : {}),
    maxResults,
    matches,
    count: matches.length,
    truncated,
  };

  return stockAnswer(session.client, payload);
};

// ---------------------------------------------------------------------------
// vice_memory_compare -- mode 'ranges' only. mode 'snapshot' is refused by
// name (D-05-01): there is no memory-only snapshot producer tool on either
// backend (vice_snapshot_save writes a whole-machine .vsf), so serving it
// would mean either destructively restoring the machine to read memory out
// of it, or parsing an unverified binary snapshot format. Neither is
// implemented; the refusal fires before any MEM_GET is sent.
// ---------------------------------------------------------------------------

export const handleMemoryCompare: StockSessionHandler = async (args, session, _deps) => {
  if (!isPlainObject(args)) {
    return isErrorText("vice_memory_compare: arguments must be an object");
  }

  // --------------------------------------------------------- mode (required)

  if (typeof args.mode !== "string") {
    return isErrorText(`vice_memory_compare: mode must be a string, got ${typeof args.mode}`);
  }

  if (args.mode === "snapshot") {
    return isErrorText(
      "vice_memory_compare: mode:'snapshot' is not implemented on the stock backend -- there is no memory-only " +
        "snapshot producer tool on either backend (vice_snapshot_save writes a whole-machine .vsf), so serving it " +
        "would mean either destructively restoring the machine to read memory out of it, or parsing an unverified " +
        "binary snapshot format. Use mode:'ranges' to compare two live ranges captured at different points in " +
        "time, or use the c64-ram-capture skill's own full-image diff.",
    );
  }

  if (args.mode !== "ranges") {
    return isErrorText(`vice_memory_compare: mode must be "ranges" or "snapshot", got ${JSON.stringify(args.mode)}`);
  }

  // --------------------------------------------------------- range1_start/range1_end/range2_start (all required in mode:'ranges')

  if (args.range1_start === undefined) {
    return isErrorText("vice_memory_compare: range1_start is required when mode is 'ranges'");
  }
  if (args.range1_end === undefined) {
    return isErrorText("vice_memory_compare: range1_end is required when mode is 'ranges'");
  }
  if (args.range2_start === undefined) {
    return isErrorText("vice_memory_compare: range2_start is required when mode is 'ranges'");
  }

  let range1Start: number, range1End: number, range2Start: number;
  try {
    range1Start = parseAddress(args.range1_start, { what: "range1_start" });
    range1End = parseAddress(args.range1_end, { what: "range1_end" });
    range2Start = parseAddress(args.range2_start, { what: "range2_start" });
  } catch (err) {
    return isErrorText(`vice_memory_compare: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (range1End < range1Start) {
    return isErrorText(
      `vice_memory_compare: range1_end (0x${range1End.toString(16)}) must be >= range1_start (0x${range1Start.toString(16)})`,
    );
  }

  // --------------------------------------------------------- range2_end is DERIVED from range1's length -- never accepted as an argument

  const length = range1End - range1Start + 1;
  const range2End = range2Start + length - 1;
  if (range2End > 0xffff) {
    return isErrorText(
      `vice_memory_compare: range2_start (0x${range2Start.toString(16)}) + range1's length (${length}) would put range2_end at ` +
        `0x${range2End.toString(16)}, which exceeds the 16-bit address space -- range 2 takes range 1's length, there is no range2_end argument`,
    );
  }

  // --------------------------------------------------------- max_differences (optional, default 100, max 10000)

  let maxDifferences = DEFAULT_MAX_RESULTS;
  if (args.max_differences !== undefined) {
    try {
      maxDifferences = parseByteCount(args.max_differences, { max: MAX_MAX_RESULTS, what: "max_differences" });
    } catch (err) {
      return isErrorText(`vice_memory_compare: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // snapshot_name, start and end are declared on the manifest for D-03 input
  // compatibility only (see plan_decision_D-05-01) -- they belong solely to
  // the refused mode:'snapshot' path and are deliberately ignored here.

  // --------------------------------------------------------- two sequential MEM_GET reads, both sidefx:false
  //
  // The machine is already halted by the first read (Phase 3 D-05), so the
  // two reads are consistent with each other for a stopped machine; neither
  // issues a resume between them.

  const body1 = memGetBody({ sidefx: false, start: range1Start, end: range1End, memspace: 0x00, bank: 0x0000 });
  let response1;
  try {
    response1 = await session.client.send(CommandType.MemoryGet, body1);
  } catch (err) {
    return convertWireError("vice_memory_compare", err);
  }
  if (response1.type !== "memory_get") {
    return isErrorText(
      `vice_memory_compare: the binary monitor replied with an unexpected response type ("${response1.type}") for range 1, expected "memory_get"`,
    );
  }
  if (response1.bytes.length !== length) {
    return isErrorText(
      `vice_memory_compare: expected ${length} byte(s) for range 1, got ${response1.bytes.length} -- a short read is a wrong answer, not a partial success`,
    );
  }

  const body2 = memGetBody({ sidefx: false, start: range2Start, end: range2End, memspace: 0x00, bank: 0x0000 });
  let response2;
  try {
    response2 = await session.client.send(CommandType.MemoryGet, body2);
  } catch (err) {
    return convertWireError("vice_memory_compare", err);
  }
  if (response2.type !== "memory_get") {
    return isErrorText(
      `vice_memory_compare: the binary monitor replied with an unexpected response type ("${response2.type}") for range 2, expected "memory_get"`,
    );
  }
  if (response2.bytes.length !== length) {
    return isErrorText(
      `vice_memory_compare: expected ${length} byte(s) for range 2, got ${response2.bytes.length} -- a short read is a wrong answer, not a partial success`,
    );
  }

  // --------------------------------------------------------- diff, bounded at max_differences

  const bytes1 = response1.bytes;
  const bytes2 = response2.bytes;
  const differences: { offset: number; address1: number; address2: number; value1: number; value2: number }[] = [];
  let truncated = false;
  for (let offset = 0; offset < length; offset += 1) {
    const value1 = bytes1[offset]!;
    const value2 = bytes2[offset]!;
    if (value1 !== value2) {
      differences.push({ offset, address1: range1Start + offset, address2: range2Start + offset, value1, value2 });
      if (differences.length === maxDifferences) {
        truncated = true;
        break;
      }
    }
  }

  const payload: Record<string, unknown> = {
    mode: "ranges",
    range1Start,
    range1End,
    range2Start,
    range2End,
    length,
    maxDifferences,
    differences,
    count: differences.length,
    truncated,
    identical: differences.length === 0 && !truncated,
  };

  return stockAnswer(session.client, payload);
};
