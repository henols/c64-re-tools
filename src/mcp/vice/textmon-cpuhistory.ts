// textmon-cpuhistory.ts
//
// THE ONE owning module for VICE's `chis` (CPU history) text-monitor output
// (PARSE-02, PARSE-03). Nothing else in this tree reads or interprets a
// `chis` reply -- a handler dials the wire, this module is the only place
// that turns the framed text into structured data.
//
// WHY THIS FILE EXISTS RATHER THAN LIVING INSIDE THE TOOL HANDLER: same
// reasoning `textmon-memmap.ts` states for itself (D-42-3, inherited from
// plan 42-01, not re-decided here) -- keeping the parser import-free of
// transport code means any future non-tool consumer can depend on this one
// file without dragging in a socket, and an owning module that is pure by
// construction cannot be the thing that silently launders a wire error into
// a parse result, because it never touches the wire at all.
//
// WHAT NOT TO DO:
//   - Never import anything -- not `node:` anything, not `text-protocol.ts`,
//     not `textmon-fixtures.ts`, not even a type-only import of a sibling
//     module. Purity is asserted mechanically by this file's own test
//     (reads this module's source, greps for a top-level `import`) -- it is
//     not a style preference to be relaxed later.
//   - Never throw on a malformed or drifted input (D-42-3). Return the
//     discriminated `CpuHistoryParseResult` instead. `withTextTool()`'s own
//     `try/catch` converts anything THROWN into a transport-error message --
//     a thrown refusal would be reported to the caller as a WIRE failure,
//     laundering a format-drift refusal into exactly the "absorbed into a
//     plausible-looking wrong answer" failure mode PARSE-03 exists to
//     prevent.
//   - Never default an unrecognised flag character to "clear" or an
//     unrecognised memspace marker to the main CPU. Either silent default is
//     an inverted statement about the machine's state -- refuse by name
//     instead (see `parseFlags()` and the memspace check in
//     `parseCpuHistoryLine()` below).
//   - Never enforce monotonicity across entries' `cycles` values. There is
//     no monotonic cycle register on this backend (CLAUDE.md's own
//     constraint) -- asserting an ordering the emulator does not promise
//     would turn a legitimate reading into a refusal.
//   - Never assume the cycle-count column is narrower than 12 digits. VICE
//     widened this column; a parser that hardcodes an 8-digit width would
//     refuse or truncate a value the real emulator can legitimately emit.
//   - Never strip a leading entry-echo prompt. Unlike `memmapshow`, `chis`
//     never emits one (`fixtures/textmon/README.md`'s "Framing" section) --
//     stripping a first line here would delete a real history entry.

/** The eight processor-status-flag positions, in VICE's own fixed print
 * order. Index 2 ("unused") is the 6502's reserved status bit -- VICE
 * always prints it with the set-glyph `-` when set, never a letter, but per
 * this module's closed decoding rule it is still just one more position
 * that is either its set-glyph or a clear-glyph `.`; it is represented as
 * its own member here rather than folded into a neighbour. */
export interface CpuHistoryFlags {
  readonly n: boolean;
  readonly v: boolean;
  readonly unused: boolean;
  readonly b: boolean;
  readonly d: boolean;
  readonly i: boolean;
  readonly z: boolean;
  readonly c: boolean;
}

/** One decoded `chis` entry -- one executed instruction. */
export interface CpuHistoryEntry {
  readonly address: number;
  readonly bytes: readonly number[];
  readonly disassembly: string;
  readonly registers: {
    readonly a: number;
    readonly x: number;
    readonly y: number;
    readonly sp: number;
  };
  readonly flags: CpuHistoryFlags;
  readonly cycles: number;
}

/** The full decoded CPU history: entries in VICE's own emitted order,
 * oldest first, exactly as `chis` printed them -- never re-sorted. */
export interface CpuHistory {
  readonly entries: readonly CpuHistoryEntry[];
}

/** The closed refusal-code union (D-42-3). `malformed-line` covers a data
 * line whose overall layout does not match at all (including a missing
 * cycle-count column) -- a STRUCTURAL mismatch, distinct from the three
 * content-level refusals below, each of which covers a line that IS laid
 * out correctly but carries a value this parser has never seen at that
 * position. */
export type CpuHistoryRefusalCode =
  | "empty-response"
  | "malformed-line"
  | "unrecognised-flag"
  | "unrecognised-memspace"
  | "unrecognised-register-label";

/** A parser refusal (D-42-3): returned, never thrown. */
export interface TextParseRefusal {
  readonly code: CpuHistoryRefusalCode;
  readonly message: string;
  readonly line: string;
  readonly lineNumber: number;
}

/** D-42-3's discriminated shape: a parser never throws, it returns one of
 * these two arms. */
export type CpuHistoryParseResult = { ok: true; value: CpuHistory } | { ok: false; refusal: TextParseRefusal };

// ---------------------------------------------------------------------------
// Framing constants -- this module's OWN copy, never imported from
// text-protocol.ts (purity rule above). The transport strips the trailing
// `(C:$xxxx)` prompt before this module ever sees the string in the live
// wire path, but a fixture's raw `text` still carries it, so this module
// strips it defensively too -- never a leading prompt, since `chis` carries
// no entry-echo (README.md's "Framing" section).
// ---------------------------------------------------------------------------

const TRAILING_PROMPT_RE = /\(C:\$[0-9A-Fa-f]{4}\)\s*$/;

/** The 4-character-wide register-value hex pattern shared by every field. */
const HEX2 = "[0-9A-Fa-f]{2}";

/** One data line's overall layout, taken from the committed captures. A
 * memspace marker (`.`, one letter, `:`, 4 hex digits), two literal spaces,
 * a 12-character-wide raw-bytes column, a 15-character-wide disassembly
 * column, then the four register fields in loose `LABEL:hex` form (the
 * label text itself is validated separately, closing the "register labels
 * in this exact order" set without conflating a wrong label with a
 * structural malformation), an 8-character flag string, one or more spaces,
 * then a decimal cycle count of up to 12 digits. A line that does not match
 * this AT ALL -- including one missing the trailing cycle-count column
 * entirely -- is a STRUCTURAL malformation (`malformed-line`). */
const DATA_LINE_RE = new RegExp(
  `^\\.([0-9A-Za-z]):([0-9A-Fa-f]{4})  (.{12})(.{15})` +
    `([A-Za-z]+):(${HEX2}) ([A-Za-z]+):(${HEX2}) ([A-Za-z]+):(${HEX2}) ([A-Za-z]+):(${HEX2}) ` +
    `(.{8}) +(\\d{1,12})$`,
);

/** The eight flag positions' set-glyph sequence, VICE's own fixed order.
 * Index 2 ("unused") is the reserved bit, whose set-glyph happens to be a
 * literal hyphen -- not a special case, just this position's own glyph. */
const FLAG_SET_GLYPHS = "NV-BDIZC";
const FLAG_NAMES = ["n", "v", "unused", "b", "d", "i", "z", "c"] as const;

/** The one recognised memspace letter: the main CPU. Any other letter means
 * the monitor's default memspace is pointed at a drive (CLAUDE.md's
 * `default_memspace` contamination constraint) -- every field on the line
 * would then describe a different CPU than the caller believes. */
const MAIN_CPU_MEMSPACE = "C";

function makeRefusal(code: CpuHistoryRefusalCode, message: string, line: string, lineNumber: number): TextParseRefusal {
  return { code, message, line, lineNumber };
}

/** Decodes one 12-character-wide raw-bytes column (1 to 3 space-separated
 * hex byte pairs, space-padded on the right to a fixed width). The width
 * itself is already guaranteed by `DATA_LINE_RE`'s own fixed-length capture
 * group; only content is checked here. */
function parseBytesField(field: string): { ok: true; bytes: number[] } | { ok: false } {
  const trimmed = field.trimEnd();
  if (!/^[0-9A-Fa-f]{2}(?: [0-9A-Fa-f]{2}){0,2}$/.test(trimmed)) return { ok: false };
  const bytes = trimmed.split(" ").map((token) => parseInt(token, 16));
  return { ok: true, bytes };
}

/** Decodes the 8-character flag string. Character at index i must be either
 * a period (that flag clear) or `FLAG_SET_GLYPHS[i]` (that flag set) --
 * anything else refuses: a character silently treated as "clear" is an
 * inverted statement about the machine's flags. */
function parseFlags(flagStr: string): { ok: true; flags: CpuHistoryFlags } | { ok: false; badChar: string; position: number } {
  const flags: Record<string, boolean> = {};
  for (let i = 0; i < 8; i++) {
    const ch = flagStr[i]!;
    if (ch === ".") {
      flags[FLAG_NAMES[i]!] = false;
    } else if (ch === FLAG_SET_GLYPHS[i]) {
      flags[FLAG_NAMES[i]!] = true;
    } else {
      return { ok: false, badChar: ch, position: i };
    }
  }
  return { ok: true, flags: flags as unknown as CpuHistoryFlags };
}

/**
 * Parses `chis`'s framed text-monitor reply into a structured
 * {@link CpuHistory}. Never throws (D-42-3): every failure mode returns
 * `{ ok: false, refusal }` naming exactly what was wrong and where.
 *
 * Bounded by construction: one pass over the payload's lines, each
 * iteration consumes exactly one line, no recursion anywhere in this
 * function.
 */
export function parseCpuHistory(text: string): CpuHistoryParseResult {
  if (typeof text !== "string" || text.trim() === "") {
    return {
      ok: false,
      refusal: makeRefusal(
        "empty-response",
        "chis: the response was empty or whitespace-only -- never decoded as a zero-entry CPU history, because an " +
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
        "chis: the response contained only prompt text and no entries -- never decoded as a zero-entry CPU history",
        "",
        0,
      ),
    };
  }

  const lines = body.split("\n");
  // A trailing "\n" before the (already-stripped) prompt splits into one
  // trailing empty element -- drop exactly that split artifact, never any
  // other blank line, so a genuinely blank line inside the payload still
  // reaches the data-line parser below and refuses structurally rather
  // than being silently swallowed here.
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  const entries: CpuHistoryEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNumber = i + 1;

    const match = DATA_LINE_RE.exec(line);
    if (!match) {
      return {
        ok: false,
        refusal: makeRefusal(
          "malformed-line",
          `chis: line ${lineNumber} does not match the expected entry layout: ${JSON.stringify(line)}`,
          line,
          lineNumber,
        ),
      };
    }

    const memspace = match[1]!;
    const addrHex = match[2]!;
    const bytesField = match[3]!;
    const disasm = match[4]!;
    const labelA = match[5]!;
    const hexA = match[6]!;
    const labelX = match[7]!;
    const hexX = match[8]!;
    const labelY = match[9]!;
    const hexY = match[10]!;
    const labelSp = match[11]!;
    const hexSp = match[12]!;
    const flagStr = match[13]!;
    const cyclesStr = match[14]!;

    if (memspace !== MAIN_CPU_MEMSPACE) {
      return {
        ok: false,
        refusal: makeRefusal(
          "unrecognised-memspace",
          `chis: line ${lineNumber} carries memspace marker ${JSON.stringify(memspace)}, not the main CPU's ` +
            `${JSON.stringify(MAIN_CPU_MEMSPACE)} -- the monitor's default memspace is likely pointed at a drive, ` +
            `which makes every field on this line describe the wrong CPU; reset it with the vice_device_console tool`,
          line,
          lineNumber,
        ),
      };
    }

    if (labelA !== "A" || labelX !== "X" || labelY !== "Y" || labelSp !== "SP") {
      return {
        ok: false,
        refusal: makeRefusal(
          "unrecognised-register-label",
          `chis: line ${lineNumber} does not carry the register labels in the expected A, X, Y, SP order: found ` +
            `${JSON.stringify([labelA, labelX, labelY, labelSp])}`,
          line,
          lineNumber,
        ),
      };
    }

    const bytesResult = parseBytesField(bytesField);
    if (!bytesResult.ok) {
      return {
        ok: false,
        refusal: makeRefusal(
          "malformed-line",
          `chis: line ${lineNumber} has a malformed raw-bytes column: ${JSON.stringify(bytesField)}`,
          line,
          lineNumber,
        ),
      };
    }

    const flagsResult = parseFlags(flagStr);
    if (!flagsResult.ok) {
      return {
        ok: false,
        refusal: makeRefusal(
          "unrecognised-flag",
          `chis: line ${lineNumber} has an unrecognised processor-flag character ${JSON.stringify(flagsResult.badChar)} ` +
            `at position ${flagsResult.position}: ${JSON.stringify(flagStr)}`,
          line,
          lineNumber,
        ),
      };
    }

    entries.push({
      address: parseInt(addrHex, 16),
      bytes: bytesResult.bytes,
      disassembly: disasm.trimEnd(),
      registers: {
        a: parseInt(hexA, 16),
        x: parseInt(hexX, 16),
        y: parseInt(hexY, 16),
        sp: parseInt(hexSp, 16),
      },
      flags: flagsResult.flags,
      cycles: parseInt(cyclesStr, 10),
    });
  }

  return { ok: true, value: { entries } };
}
