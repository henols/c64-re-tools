// textmon-backtrace.ts
//
// THE ONE owning module for VICE's `bt` (backtrace) text-monitor output
// (PARSE-02, PARSE-03). Nothing else in this tree reads or interprets a
// `bt` reply -- a handler dials the wire, this module is the only place
// that turns the framed text into structured data. This module's sibling
// is `textmon-cpuhistory.ts` (Task 1 of this same plan); both share the
// address/bytes/disassembly column layout the `chis` format established,
// and both inherit D-42-3 (a parser returns a discriminated refusal, never
// throws) from plan 42-01's `textmon-memmap.ts`.
//
// WHY THIS FILE EXISTS RATHER THAN LIVING INSIDE THE TOOL HANDLER: the same
// reasoning `textmon-memmap.ts` and `textmon-cpuhistory.ts` state for
// themselves applies here unchanged.
//
// WHAT NOT TO DO:
//   - Never import anything -- not `node:` anything, not `text-protocol.ts`,
//     not `textmon-fixtures.ts`, not even a type-only import of a sibling
//     module. Purity is asserted mechanically by this file's own test.
//   - Never throw on a malformed or drifted input (D-42-3). Return the
//     discriminated `BacktraceParseResult` instead.
//   - Never re-sort or reverse `frames`. VICE emits the JSR chain in its own
//     order -- the chain's own order IS the evidence; silently re-sorting
//     or reversing it would restate which call is innermost.
//   - Never truncate the frame list to a caller-requested depth. That is
//     the tool's concern (plan 42-07), never this module's -- a parser that
//     truncated would make the frame count a function of a caller's
//     argument rather than of the machine.
//   - Never read an unrecognised origin token as if it were an address. An
//     unknown origin means the format has drifted from what this parser
//     has ever seen; fabricating a caller from it would be worse than
//     refusing.
//   - Never treat the literal `+-` form (a negative SP offset) as a sign to
//     "honour" separately from the digits -- the `+` is a fixed part of the
//     field VICE always prints, and the sign lives in the digits' own
//     prefix (see `parseSpOffset()` below).
//   - Never strip a leading entry-echo prompt. `bt` never emits one
//     (`fixtures/textmon/README.md`'s "Framing" section) -- stripping a
//     first line here would delete the current-PC line.

/**
 * The current-PC frame: where execution is actually paused. Carries no
 * caller, callee or SP offset -- those only apply to the call frames below
 * it in the reconstructed chain.
 */
export interface BacktraceCurrentPc {
  readonly address: number;
  readonly bytes: readonly number[];
  readonly disassembly: string;
}

/** The closed set of non-numeric frame origins: the three interrupt
 * vectors. A numeric origin (a 4-hex-digit return address) is represented
 * as a `number` instead -- see {@link BacktraceFrame.origin}. */
export type BacktraceOriginName = "reset" | "irq" | "nmi";

/** One reconstructed call frame. `origin` is either the caller's own
 * address (a `number`) or one of the three interrupt-vector names -- never
 * a token this parser has not explicitly recognised. `spOffset` is signed;
 * VICE's own literal `+-` form for a negative offset is decoded, never
 * treated as an edge case. */
export interface BacktraceFrame {
  readonly origin: number | BacktraceOriginName;
  readonly callee: number;
  readonly spOffset: number;
  readonly address: number;
  readonly bytes: readonly number[];
  readonly disassembly: string;
}

/** The full decoded backtrace: the current-PC frame plus every call frame,
 * in VICE's own emitted order -- never re-sorted, never reversed, never
 * truncated. */
export interface Backtrace {
  readonly currentPc: BacktraceCurrentPc;
  readonly frames: readonly BacktraceFrame[];
}

/** The closed refusal-code union (D-42-3). `malformed-frame-line` covers a
 * frame line whose overall layout does not match at all -- a STRUCTURAL
 * mismatch, distinct from `unrecognised-origin` and `malformed-sp-offset`,
 * each of which covers a line that IS laid out correctly but carries a
 * value this parser has never seen at that position. */
export type BacktraceRefusalCode =
  | "empty-response"
  | "missing-current-pc-line"
  | "malformed-frame-line"
  | "unrecognised-origin"
  | "malformed-sp-offset"
  | "unrecognised-memspace";

/** A parser refusal (D-42-3): returned, never thrown. */
export interface TextParseRefusal {
  readonly code: BacktraceRefusalCode;
  readonly message: string;
  readonly line: string;
  readonly lineNumber: number;
}

/** D-42-3's discriminated shape: a parser never throws, it returns one of
 * these two arms. */
export type BacktraceParseResult = { ok: true; value: Backtrace } | { ok: false; refusal: TextParseRefusal };

// ---------------------------------------------------------------------------
// Framing constants -- this module's OWN copy, never imported from
// text-protocol.ts. The transport strips the trailing `(C:$xxxx)` prompt on
// the live wire path, but a fixture's raw `text` still carries it, so this
// module strips it defensively too -- never a leading prompt, since `bt`
// carries no entry-echo (README.md's "Framing" section).
// ---------------------------------------------------------------------------

const TRAILING_PROMPT_RE = /\(C:\$[0-9A-Fa-f]{4}\)\s*$/;

/** The one recognised memspace letter: the main CPU. Any other letter means
 * the monitor's default memspace is pointed at a drive (CLAUDE.md's
 * `default_memspace` contamination constraint). */
const MAIN_CPU_MEMSPACE = "C";

/**
 * The shared suffix every line (the current-PC line and every frame line
 * alike) carries: an arbitrary prefix (captured separately and validated by
 * the caller), then a memspace marker (`.`, one letter, `:`, 4 hex digits),
 * three literal spaces, a 12-character-wide raw-bytes column, then the
 * disassembly text running to the end of the line (never padded here --
 * unlike `chis`, nothing follows it on this format, so trailing width is
 * whatever the mnemonic and operand actually need). The non-greedy prefix
 * capture matches the SHORTEST text before the first occurrence of the
 * memspace-marker pattern, which is exactly once per line by construction.
 */
const SUFFIX_RE = /^(.*?)\.([A-Za-z]):([0-9A-Fa-f]{4})   (.{12})(.*)$/;

/**
 * A frame line's prefix, once split from the shared suffix above: an origin
 * token (captured loosely as any 4 characters, validated separately against
 * the closed origin set below), ` -> `, the callee address (exactly 4 hex
 * digits), ` [SP +`, the offset field (captured loosely, validated
 * separately -- VICE's own literal `+-` form for a negative offset means
 * the digits' own prefix carries the sign, never a separate sign to
 * honour), `]`, one trailing space.
 */
const FRAME_PREFIX_RE = /^(.{4}) -> ([0-9A-Fa-f]{4}) \[SP \+([^\]]*)\] $/;

/** The closed origin-name set: VICE's three interrupt vectors, each printed
 * padded to 4 characters (`"RST "`, `"IRQ "`, `"NMI "`) -- the same width
 * as a 4-hex-digit numeric origin. */
const ORIGIN_NAMES: ReadonlyArray<{ token: string; name: BacktraceOriginName }> = [
  { token: "RST ", name: "reset" },
  { token: "IRQ ", name: "irq" },
  { token: "NMI ", name: "nmi" },
];

function makeRefusal(code: BacktraceRefusalCode, message: string, line: string, lineNumber: number): TextParseRefusal {
  return { code, message, line, lineNumber };
}

/** Decodes the 12-character-wide raw-bytes column (1 to 3 space-separated
 * hex byte pairs, space-padded on the right to a fixed width) -- the exact
 * same shape `chis` uses. */
function parseBytesField(field: string): { ok: true; bytes: number[] } | { ok: false } {
  const trimmed = field.trimEnd();
  if (!/^[0-9A-Fa-f]{2}(?: [0-9A-Fa-f]{2}){0,2}$/.test(trimmed)) return { ok: false };
  const bytes = trimmed.split(" ").map((token) => parseInt(token, 16));
  return { ok: true, bytes };
}

/** Decodes the SP-offset field's raw captured text (whatever sat between
 * `+` and `]`) into a signed integer. VICE's own literal `+-` form for a
 * negative offset means the field can read `-241` directly (no leading
 * spaces) or `  3` (spaces then an unsigned magnitude) -- both are valid
 * shapes of "optional leading spaces, optional minus, digits"; anything
 * else refuses. */
function parseSpOffset(raw: string): { ok: true; value: number } | { ok: false } {
  if (!/^ *-?\d+$/.test(raw)) return { ok: false };
  return { ok: true, value: parseInt(raw.trim(), 10) };
}

/** Matches the shared address/bytes/disassembly suffix against `line`,
 * returning its four parts, or `undefined` if the line does not carry the
 * memspace-marker-plus-address pattern at all. */
function matchSuffix(
  line: string,
): { prefix: string; memspace: string; addrHex: string; bytesField: string; disasm: string } | undefined {
  const match = SUFFIX_RE.exec(line);
  if (!match) return undefined;
  return { prefix: match[1]!, memspace: match[2]!, addrHex: match[3]!, bytesField: match[4]!, disasm: match[5]! };
}

/**
 * Parses `bt`'s framed text-monitor reply into a structured
 * {@link Backtrace}. Never throws (D-42-3): every failure mode returns
 * `{ ok: false, refusal }` naming exactly what was wrong and where.
 *
 * Bounded by construction: one pass over the payload's lines, each
 * iteration consumes exactly one line, no recursion anywhere in this
 * function.
 */
export function parseBacktrace(text: string): BacktraceParseResult {
  if (typeof text !== "string" || text.trim() === "") {
    return {
      ok: false,
      refusal: makeRefusal(
        "empty-response",
        "bt: the response was empty or whitespace-only -- never decoded as a zero-frame backtrace, because an " +
          "empty response and a real capture that recorded nothing are two different facts",
        "",
        0,
      ),
    };
  }

  const body = text.replace(TRAILING_PROMPT_RE, "");

  if (body.trim() === "") {
    return {
      ok: false,
      refusal: makeRefusal(
        "empty-response",
        "bt: the response contained only prompt text and no current-PC line -- never decoded as a zero-frame backtrace",
        "",
        0,
      ),
    };
  }

  const lines = body.split("\n");
  // A trailing "\n" before the (already-stripped) prompt splits into one
  // trailing empty element -- drop exactly that split artifact, never any
  // other blank line, so a genuinely blank line inside the payload still
  // reaches the line parser below and refuses structurally rather than
  // being silently swallowed here.
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  const pcLine = lines[0] ?? "";
  const pcMatch = matchSuffix(pcLine);
  if (!pcMatch || !/^\s*PC\s*$/.test(pcMatch.prefix)) {
    return {
      ok: false,
      refusal: makeRefusal(
        "missing-current-pc-line",
        `bt: the first line is not a recognised current-PC line: ${JSON.stringify(pcLine)}`,
        pcLine,
        1,
      ),
    };
  }
  if (pcMatch.memspace !== MAIN_CPU_MEMSPACE) {
    return {
      ok: false,
      refusal: makeRefusal(
        "unrecognised-memspace",
        `bt: the current-PC line carries memspace marker ${JSON.stringify(pcMatch.memspace)}, not the main CPU's ` +
          `${JSON.stringify(MAIN_CPU_MEMSPACE)} -- reset the default memspace with the vice_device_console tool`,
        pcLine,
        1,
      ),
    };
  }
  const pcBytesResult = parseBytesField(pcMatch.bytesField);
  if (!pcBytesResult.ok) {
    return {
      ok: false,
      refusal: makeRefusal(
        "malformed-frame-line",
        `bt: the current-PC line has a malformed raw-bytes column: ${JSON.stringify(pcMatch.bytesField)}`,
        pcLine,
        1,
      ),
    };
  }

  const currentPc: BacktraceCurrentPc = {
    address: parseInt(pcMatch.addrHex, 16),
    bytes: pcBytesResult.bytes,
    disassembly: pcMatch.disasm.trimEnd(),
  };

  const frames: BacktraceFrame[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNumber = i + 1;

    const suffixMatch = matchSuffix(line);
    if (!suffixMatch) {
      return {
        ok: false,
        refusal: makeRefusal(
          "malformed-frame-line",
          `bt: line ${lineNumber} does not match the expected frame layout: ${JSON.stringify(line)}`,
          line,
          lineNumber,
        ),
      };
    }

    const frontMatch = FRAME_PREFIX_RE.exec(suffixMatch.prefix);
    if (!frontMatch) {
      return {
        ok: false,
        refusal: makeRefusal(
          "malformed-frame-line",
          `bt: line ${lineNumber} does not match the expected "origin -> callee [SP +offset]" layout: ${JSON.stringify(line)}`,
          line,
          lineNumber,
        ),
      };
    }

    const originToken = frontMatch[1]!;
    const calleeHex = frontMatch[2]!;
    const offsetRaw = frontMatch[3]!;

    let origin: number | BacktraceOriginName;
    if (/^[0-9A-Fa-f]{4}$/.test(originToken)) {
      origin = parseInt(originToken, 16);
    } else {
      const named = ORIGIN_NAMES.find((entry) => entry.token === originToken);
      if (!named) {
        return {
          ok: false,
          refusal: makeRefusal(
            "unrecognised-origin",
            `bt: line ${lineNumber} carries an unrecognised frame origin ${JSON.stringify(originToken)} -- not a ` +
              `4-hex-digit address and not one of the three recognised interrupt-vector names`,
            line,
            lineNumber,
          ),
        };
      }
      origin = named.name;
    }

    if (suffixMatch.memspace !== MAIN_CPU_MEMSPACE) {
      return {
        ok: false,
        refusal: makeRefusal(
          "unrecognised-memspace",
          `bt: line ${lineNumber} carries memspace marker ${JSON.stringify(suffixMatch.memspace)}, not the main ` +
            `CPU's ${JSON.stringify(MAIN_CPU_MEMSPACE)} -- reset the default memspace with the vice_device_console tool`,
          line,
          lineNumber,
        ),
      };
    }

    const spOffsetResult = parseSpOffset(offsetRaw);
    if (!spOffsetResult.ok) {
      return {
        ok: false,
        refusal: makeRefusal(
          "malformed-sp-offset",
          `bt: line ${lineNumber} has a malformed SP-offset field ${JSON.stringify(offsetRaw)} -- never defaulted to zero`,
          line,
          lineNumber,
        ),
      };
    }

    const bytesResult = parseBytesField(suffixMatch.bytesField);
    if (!bytesResult.ok) {
      return {
        ok: false,
        refusal: makeRefusal(
          "malformed-frame-line",
          `bt: line ${lineNumber} has a malformed raw-bytes column: ${JSON.stringify(suffixMatch.bytesField)}`,
          line,
          lineNumber,
        ),
      };
    }

    frames.push({
      origin,
      callee: parseInt(calleeHex, 16),
      spOffset: spOffsetResult.value,
      address: parseInt(suffixMatch.addrHex, 16),
      bytes: bytesResult.bytes,
      disassembly: suffixMatch.disasm.trimEnd(),
    });
  }

  return { ok: true, value: { currentPc, frames } };
}
