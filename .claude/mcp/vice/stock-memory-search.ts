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
