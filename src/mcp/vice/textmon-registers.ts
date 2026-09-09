// textmon-registers.ts
//
// THE ONE owning module for VICE's `io` text-monitor output (PARSE-02,
// PARSE-03). Nothing else in this tree reads or interprets an `io` reply --
// a handler dials the wire, this module is the only place that turns the
// framed text into structured data.
//
// WHY THIS FILE EXISTS RATHER THAN LIVING INSIDE THE TOOL HANDLER: the same
// reasoning `textmon-memmap.ts`, `textmon-profile.ts` and `disasm-decoder.ts`
// state for themselves applies here unchanged -- keeping the parser
// import-free of transport code means any future non-tool consumer can
// depend on this one file without dragging in a socket, and PARSE-03's own
// never-throw discipline (D-42-3, decided once in plan 42-01 for all five
// text parsers this phase adds) means this module can never be the thing
// that silently launders a wire error into a parse result, because it
// never touches the wire at all.
//
// THREE OUTCOMES, NOT TWO, FOR THE DECODED-PROSE SECTION (this plan's own
// D-42-3 refinement). `prof flat`, `chis`, `bt` and `memmapshow` are closed
// formats: every field is either recognised or it is drift. `io`'s middle
// section is not -- it is free-form decoded prose whose line set differs
// per chip, and a parser that refused every line it had not seen before
// would refuse a legitimate reply from a chip the committed captures never
// sampled. So THIS module has three outcomes for that section only:
// recognised fields decode to typed values; a recognised label whose VALUE
// cannot be parsed refuses by name (that is drift, and it is loud, via the
// `unparseable-value` refusal code); and a line matching no recognised
// shape at all is preserved verbatim in `unrecognisedLines`, which the
// result carries and the tool reports as a count -- never mapped onto a
// typed field. The hex dump, the memspace marker and the sprite table are
// CLOSED sets and refuse like every other format's fields.
//
// WHAT NOT TO DO:
//   - Never import anything -- not `node:` anything, not `text-protocol.ts`,
//     not `textmon-fixtures.ts`, not even a type-only import of a sibling
//     module. Purity is asserted mechanically by this file's own test.
//   - Never throw on a malformed or drifted input (D-42-3). Return the
//     discriminated `IoRegistersParseResult` instead.
//   - Never slice the sprite table at guessed/literal column widths. Some
//     real rows (`X-Pos:`) have NO separating space at all between adjacent
//     values -- a whitespace split would collapse them into one token and
//     silently shift every sprite's value one column left. Column offsets
//     are derived from the `Sprites:` header line's OWN token positions,
//     every time, never a literal width constant.
//   - Never treat VICE's own two graceful-degradation replies ("No details
//     available." / "No I/O regs available") as a successful decode of an
//     empty chip. A caller that received `{ok:true, value:{sections:[]}}`
//     for one of these could not tell "the chip reported it has nothing to
//     show" from "this parse found nothing" -- the second reads like a
//     defect in this project. Both strings are source-traced from
//     `monitor.c:1980-2000` (not live-observed -- see this module's test
//     file for why) and are recognised as their own named refusal codes,
//     each carrying the observed string verbatim.
//   - Never let an unrecognised decoded-prose line populate a typed field.
//     Push it verbatim to `unrecognisedLines` and move on -- see the
//     "THREE OUTCOMES" note above.
//   - Never accept a memspace marker other than the main CPU's ("C"). A
//     drive-contaminated default memspace (CLAUDE.md's own documented
//     constraint) makes every following field describe the wrong CPU; the
//     refusal names the `vice_device_console` remedy tool by name, matching
//     plan 42-02's own established convention for the same hazard.

/** One 64-byte VIC-II register dump, decoded from four `>C:aaaa  ...` rows.
 * `baseAddress` is the first row's own address field -- never assumed. */
export interface IoRegisterDump {
  readonly baseAddress: number;
  readonly bytes: readonly number[];
}

/** The three VIC-II display-mode bits, decoded from `Mode: ... (ECM/BMM/MCM=a/b/c)`. */
export interface IoDisplayMode {
  readonly name: string;
  readonly ecm: boolean;
  readonly bmm: boolean;
  readonly mcm: boolean;
}

/** The typed decode of `io`'s free-form middle prose section -- see this
 * module's header comment for the three-outcome rule this section alone
 * follows. Every field here comes from one of the six recognised label
 * prefixes this module knows; nothing here is ever populated from an
 * unrecognised line (see `IoRegisters.unrecognisedLines`). */
export interface IoDecodedState {
  readonly rasterCycle: number;
  readonly rasterLine: number;
  readonly rasterIrqLine: number;
  readonly mode: IoDisplayMode;
  readonly borderColor: number;
  readonly backgroundColor: number;
  readonly scrollX: number;
  readonly scrollY: number;
  readonly rasterCounter: number;
  readonly idle: boolean;
  readonly screenColumns: number;
  readonly screenRows: number;
  readonly vc: number;
  readonly vcbase: number;
  readonly vmli: number;
  readonly phi1: number;
  readonly videoBase: number;
  readonly charsetBase: number;
  readonly charsetSource: string;
}

/** The closed, ten-member row-label set the sprite table carries -- an
 * unknown row in it is drift, not free prose (see this module's header
 * comment's "THREE OUTCOMES" note, which does NOT apply to this table). */
export type SpriteRowLabel =
  | "Enabled"
  | "DMA/dis"
  | "Pointer"
  | "MC"
  | "MCBASE"
  | "X-Pos"
  | "Y-Pos"
  | "X/Y-Exp"
  | "Pri./MC"
  | "Color";

/** One sprite-table row: a closed-set label plus exactly eight raw,
 * trimmed cell values -- sliced at the header's own declared offsets, not
 * at a guessed width (see this module's header comment). */
export interface SpriteTableRow {
  readonly label: SpriteRowLabel;
  readonly values: readonly string[];
}

/** The full sprite table. `columns` is the count asserted from the
 * `Sprites:` header line itself -- always 8 for a well-formed table, and
 * the parser refuses (`sprite-column-count`) rather than proceeding when
 * it is anything else. */
export interface SpriteTable {
  readonly columns: number;
  readonly rows: readonly SpriteTableRow[];
}

/** One decoded chip section: the header names the chip, the dump is its
 * 64-byte register range, `decoded` is the typed middle-prose state, and
 * `sprites` is the fixed-shape sprite table. */
export interface IoChipSection {
  readonly chip: string;
  readonly dump: IoRegisterDump;
  readonly decoded: IoDecodedState;
  readonly sprites: SpriteTable;
}

/** The full decoded `io` reply. `sections` is an array even though the
 * tool in plan 42-07 always dials a single-address form -- the command
 * itself accepts a bare invocation that dumps every chip, and a parser
 * that hard-assumed one section would refuse a legitimate reply.
 * `unrecognisedLines` carries every decoded-prose line this module did not
 * recognise, verbatim, across every section -- drift stays visible in the
 * answer instead of being dropped from it, and a caller reporting a
 * non-zero count is reporting a real finding. */
export interface IoRegisters {
  readonly sections: readonly IoChipSection[];
  readonly unrecognisedLines: readonly string[];
}

/** The closed refusal-code union (D-42-3): an empty response, a malformed
 * dump row, an unrecognised memspace marker, a recognised decoded-prose
 * label whose value could not be parsed, an unrecognised sprite-row label,
 * a sprite header declaring a column count other than eight, and the two
 * graceful-degradation outcomes (see this module's header comment). */
export type IoRegistersRefusalCode =
  | "empty-response"
  | "malformed-dump"
  | "unrecognised-memspace"
  | "unparseable-value"
  | "unrecognised-sprite-row"
  | "sprite-column-count"
  | "no-details-available"
  | "no-io-regs-available";

/** A parser refusal (D-42-3): returned, never thrown. `line` and
 * `lineNumber` name the offending content whenever one exists. */
export interface TextParseRefusal {
  readonly code: IoRegistersRefusalCode;
  readonly message: string;
  readonly line: string;
  readonly lineNumber: number;
}

/** D-42-3's discriminated shape: a parser never throws, it returns one of
 * these two arms. */
export type IoRegistersParseResult = { ok: true; value: IoRegisters } | { ok: false; refusal: TextParseRefusal };

// ---------------------------------------------------------------------------
// Framing constants -- this module's OWN copies, never imported from
// text-protocol.ts (purity rule above). `io` carries no leading entry-echo
// prompt (unlike `memmapshow`) per fixtures/textmon/README.md's own
// "Framing" section -- only a TRAILING exit-prompt is ever stripped. Note
// while reading the captures: this command's trailing prompt carries a
// DIFFERENT address than the other four commands' (`(C:$d040)` here, vs.
// `(C:$e5d1)` for `prof flat`/`bt` on the same run) -- the parser keys on
// the prompt's SHAPE, never its value.
// ---------------------------------------------------------------------------

const TRAILING_PROMPT_RE = /\(C:\$[0-9A-Fa-f]{4}\)\s*$/;

/** VICE's own two graceful-degradation strings for this command
 * (`monitor.c:1980-2000`), traced from source rather than observed live --
 * this project did not build a VICE binary with the relevant chip support
 * disabled this session (see this module's test file for the full
 * citation). Exact literal match, case- and punctuation-sensitive. */
const NO_DETAILS_AVAILABLE_TEXT = "No details available.";
const NO_IO_REGS_AVAILABLE_TEXT = "No I/O regs available";

/** A chip-section header: a bare identifier then a single trailing colon,
 * nothing else on the line (e.g. `VIC-II:`). */
const CHIP_HEADER_RE = /^([A-Za-z][A-Za-z0-9_./-]*):$/;

/** The loose shape that identifies a line as dump-row-SHAPED (`>` + a
 * memspace letter + `:` + a 4-hex-digit address + two spaces) -- used to
 * decide whether to keep consuming dump rows at all, distinct from the
 * STRICT full-row regex below that validates one once this much has
 * already matched. A line matching this loose shape but failing the strict
 * regex is a STRUCTURAL malformation (`malformed-dump`), never silently
 * skipped as "not a dump row". */
const DUMP_ROW_PREFIX_RE = /^>([A-Za-z]):([0-9a-fA-F]{4})  /;

/** One dump row's full, strict layout: memspace letter, 4-hex address, two
 * spaces, four groups of four 2-hex-digit values (each group
 * space-separated internally, two spaces between groups), three spaces,
 * then the 16-character rendered character column. */
const DUMP_ROW_RE =
  /^>([A-Za-z]):([0-9a-fA-F]{4})  ((?:[0-9a-fA-F]{2} ){3}[0-9a-fA-F]{2})  ((?:[0-9a-fA-F]{2} ){3}[0-9a-fA-F]{2})  ((?:[0-9a-fA-F]{2} ){3}[0-9a-fA-F]{2})  ((?:[0-9a-fA-F]{2} ){3}[0-9a-fA-F]{2})   (.{16})$/;

/** The main CPU's memspace marker letter -- the only one this module
 * accepts anywhere a marker appears (CLAUDE.md's documented
 * `default_memspace` contamination constraint). */
const MAIN_CPU_MEMSPACE = "C";

const SPRITE_HEADER_PREFIX = "Sprites: ";

const SPRITE_ROW_LABELS: readonly SpriteRowLabel[] = [
  "Enabled",
  "DMA/dis",
  "Pointer",
  "MC",
  "MCBASE",
  "X-Pos",
  "Y-Pos",
  "X/Y-Exp",
  "Pri./MC",
  "Color",
];

function isSpriteRowLabel(value: string): value is SpriteRowLabel {
  return (SPRITE_ROW_LABELS as readonly string[]).includes(value);
}

function makeRefusal(code: IoRegistersRefusalCode, message: string, line: string, lineNumber: number): TextParseRefusal {
  return { code, message, line, lineNumber };
}

/** The six recognised decoded-prose label prefixes, each paired with the
 * full-line detail regex that extracts its typed values once the prefix
 * has matched. A line whose PREFIX matches one of these but whose DETAIL
 * regex does not is `unparseable-value`, naming this recogniser's `label`.
 * A line matching no prefix at all is unrecognised (see the module header
 * comment's "THREE OUTCOMES" note). */
const PROSE_RECOGNISERS: ReadonlyArray<{
  label: string;
  prefix: string;
  detailRe: RegExp;
  apply: (m: RegExpExecArray, state: Partial<Record<keyof IoDecodedState, unknown>>) => void;
}> = [
  {
    label: "Raster cycle/line",
    prefix: "Raster cycle/line:",
    detailRe: /^Raster cycle\/line: (\d+)\/(\d+) IRQ: (\d+)$/,
    apply: (m, s) => {
      s.rasterCycle = Number(m[1]);
      s.rasterLine = Number(m[2]);
      s.rasterIrqLine = Number(m[3]);
    },
  },
  {
    label: "Mode",
    prefix: "Mode:",
    detailRe: /^Mode: (.+) \(ECM\/BMM\/MCM=(\d)\/(\d)\/(\d)\)$/,
    apply: (m, s) => {
      s.mode = { name: m[1], ecm: m[2] === "1", bmm: m[3] === "1", mcm: m[4] === "1" } satisfies IoDisplayMode;
    },
  },
  {
    label: "Colors",
    prefix: "Colors:",
    detailRe: /^Colors: Border: ([0-9a-fA-F]) BG: ([0-9a-fA-F])$/,
    apply: (m, s) => {
      s.borderColor = parseInt(m[1]!, 16);
      s.backgroundColor = parseInt(m[2]!, 16);
    },
  },
  {
    label: "Scroll X/Y",
    prefix: "Scroll X/Y:",
    detailRe: /^Scroll X\/Y: (\d+)\/(\d+), RC (\d+), Idle: (\d+), (\d+)x(\d+)$/,
    apply: (m, s) => {
      s.scrollX = Number(m[1]);
      s.scrollY = Number(m[2]);
      s.rasterCounter = Number(m[3]);
      s.idle = m[4] === "1";
      s.screenColumns = Number(m[5]);
      s.screenRows = Number(m[6]);
    },
  },
  {
    label: "VC",
    prefix: "VC $",
    detailRe: /^VC \$([0-9a-fA-F]+), VCBASE \$([0-9a-fA-F]+), VMLI\s+(\d+), Phi1 \$([0-9a-fA-F]+)$/,
    apply: (m, s) => {
      s.vc = parseInt(m[1]!, 16);
      s.vcbase = parseInt(m[2]!, 16);
      s.vmli = Number(m[3]);
      s.phi1 = parseInt(m[4]!, 16);
    },
  },
  {
    label: "Video",
    prefix: "Video $",
    detailRe: /^Video \$([0-9a-fA-F]+), Charset \$([0-9a-fA-F]+) \((.+)\)$/,
    apply: (m, s) => {
      s.videoBase = parseInt(m[1]!, 16);
      s.charsetBase = parseInt(m[2]!, 16);
      s.charsetSource = m[3];
    },
  },
];

type DecodeProseResult =
  | { ok: true; state: IoDecodedState }
  | { ok: false; refusal: TextParseRefusal };

/** Decodes the free-form decoded-prose block per this module's
 * three-outcome rule: a recognised prefix with a matching detail shape
 * updates `state`; a recognised prefix whose detail shape fails to match
 * refuses `unparseable-value`, naming the recogniser's label; a line
 * matching no recognised prefix at all is pushed verbatim onto
 * `unrecognisedLines` and never populates a typed field. Bounded by
 * construction: one pass over `proseLines`, each iteration tries at most
 * six fixed recognisers, no recursion. */
function decodeProseLines(proseLines: readonly string[], startLineNumber: number, unrecognisedLines: string[]): DecodeProseResult {
  const state: Partial<Record<keyof IoDecodedState, unknown>> = {};
  for (let i = 0; i < proseLines.length; i++) {
    const original = proseLines[i]!;
    const trimmed = original.trim();
    const lineNumber = startLineNumber + i;
    const recogniser = PROSE_RECOGNISERS.find((r) => trimmed.startsWith(r.prefix));
    if (!recogniser) {
      unrecognisedLines.push(original);
      continue;
    }
    const match = recogniser.detailRe.exec(trimmed);
    if (!match) {
      return {
        ok: false,
        refusal: makeRefusal(
          "unparseable-value",
          `io: line ${lineNumber} carries the recognised "${recogniser.label}" label but its value could not be parsed: ${JSON.stringify(original)}`,
          original,
          lineNumber,
        ),
      };
    }
    recogniser.apply(match, state);
  }
  return { ok: true, state: state as IoDecodedState };
}

interface SpriteHeaderResult {
  ok: true;
  boundaries: number[];
}
interface SpriteHeaderFailure {
  ok: false;
  count: number;
}

/** Derives the sprite table's column boundaries from the `Sprites:` header
 * line's OWN token positions -- never a guessed literal width (see this
 * module's header comment). Each column label's start position, minus one
 * character, becomes that column's left boundary; the header line's own
 * length is the final (right) boundary. This one-character shift is what
 * makes the SAME boundary set correctly slice every row even though real
 * rows' own label fields vary in length (7-11 characters) -- see this
 * module's test file for the measured proof. */
function deriveSpriteBoundaries(headerLine: string): SpriteHeaderResult | SpriteHeaderFailure {
  const allTokens = [...headerLine.matchAll(/\S+/g)];
  const columnTokens = allTokens.slice(1); // drop the "Sprites:" label token itself
  if (columnTokens.length !== 8) {
    return { ok: false, count: columnTokens.length };
  }
  const boundaries = columnTokens.map((m) => m.index! - 1);
  boundaries.push(headerLine.length);
  return { ok: true, boundaries };
}

type SpriteRowResult = { ok: true; row: SpriteTableRow } | { ok: false; label: string };

function parseSpriteRow(line: string, boundaries: readonly number[]): SpriteRowResult {
  const rawLabel = line.slice(0, boundaries[0]).trim();
  const label = rawLabel.replace(/:$/, "");
  if (!isSpriteRowLabel(label)) {
    return { ok: false, label: rawLabel };
  }
  const values: string[] = [];
  for (let c = 0; c < 8; c++) {
    values.push(line.slice(boundaries[c]!, boundaries[c + 1]).trim());
  }
  return { ok: true, row: { label, values } };
}

/**
 * Parses `io`'s framed text-monitor reply into a structured
 * {@link IoRegisters}. Input is the string `TextMonitorClient.command()`
 * resolves to, or a fixture's `text` -- both must parse identically. Never
 * throws (D-42-3): every failure mode returns `{ ok: false, refusal }`
 * naming exactly what was wrong and where.
 *
 * Bounded by construction: one pass over the payload's lines, advancing a
 * cursor that always moves forward by at least one line per iteration, no
 * recursion anywhere in this function.
 */
export function parseIoRegisters(text: string): IoRegistersParseResult {
  if (typeof text !== "string" || text.trim() === "") {
    return {
      ok: false,
      refusal: makeRefusal(
        "empty-response",
        "io: the response was empty or whitespace-only -- never decoded as a zero-section reply, because an empty " +
          "response and a real capture that recorded no chips anywhere are two different facts",
        "",
        0,
      ),
    };
  }

  const body = text.replace(TRAILING_PROMPT_RE, "");
  const trimmedBody = body.trim();
  if (trimmedBody === "") {
    return {
      ok: false,
      refusal: makeRefusal(
        "empty-response",
        "io: the response contained only prompt text and no content -- never decoded as a zero-section reply",
        "",
        0,
      ),
    };
  }

  if (trimmedBody === NO_DETAILS_AVAILABLE_TEXT) {
    return {
      ok: false,
      refusal: makeRefusal(
        "no-details-available",
        `io: the chip reported "${NO_DETAILS_AVAILABLE_TEXT}" (source-traced, monitor.c:1980-2000) -- a named ` +
          "outcome, never decoded as a successful zero-section reply",
        trimmedBody,
        1,
      ),
    };
  }
  if (trimmedBody === NO_IO_REGS_AVAILABLE_TEXT) {
    return {
      ok: false,
      refusal: makeRefusal(
        "no-io-regs-available",
        `io: the bank reported "${NO_IO_REGS_AVAILABLE_TEXT}" (source-traced, monitor.c:1980-2000) -- a named ` +
          "outcome, never decoded as a successful zero-section reply",
        trimmedBody,
        1,
      ),
    };
  }

  const lines = body.split("\n");
  // A trailing "\n" before the (already-stripped) prompt splits into one
  // trailing empty element -- drop exactly that split artifact, never any
  // other blank line, so a genuinely blank line inside the payload still
  // participates in section framing below rather than being silently
  // swallowed here.
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  const sections: IoChipSection[] = [];
  const unrecognisedLines: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const headerLine = lines[i]!;
    const lineNumber = i + 1;
    const chipMatch = CHIP_HEADER_RE.exec(headerLine);
    if (!chipMatch) {
      unrecognisedLines.push(headerLine);
      i++;
      continue;
    }
    const chip = chipMatch[1]!;
    i++;

    // --- dump rows -----------------------------------------------------
    const byteRows: number[][] = [];
    let baseAddress: number | undefined;
    while (i < lines.length && DUMP_ROW_PREFIX_RE.test(lines[i] ?? "")) {
      const line = lines[i]!;
      const rowLineNumber = i + 1;
      const memspaceMatch = /^>([A-Za-z]):/.exec(line)!;
      const memspaceLetter = memspaceMatch[1]!;
      if (memspaceLetter !== MAIN_CPU_MEMSPACE) {
        return {
          ok: false,
          refusal: makeRefusal(
            "unrecognised-memspace",
            `io: line ${rowLineNumber} carries memspace marker "${memspaceLetter}", not the main CPU's -- run ` +
              `vice_device_console to reset the default device before retrying: ${JSON.stringify(line)}`,
            line,
            rowLineNumber,
          ),
        };
      }
      const match = DUMP_ROW_RE.exec(line);
      if (!match) {
        return {
          ok: false,
          refusal: makeRefusal(
            "malformed-dump",
            `io: line ${rowLineNumber} does not match the expected 16-byte hex dump layout: ${JSON.stringify(line)}`,
            line,
            rowLineNumber,
          ),
        };
      }
      if (baseAddress === undefined) baseAddress = parseInt(match[2]!, 16);
      const groups = [match[3]!, match[4]!, match[5]!, match[6]!];
      const rowBytes = groups.flatMap((g) => g.split(" ").map((b) => parseInt(b, 16)));
      byteRows.push(rowBytes);
      i++;
    }
    if (byteRows.length === 0 || baseAddress === undefined) {
      return {
        ok: false,
        refusal: makeRefusal(
          "malformed-dump",
          `io: chip section "${chip}" (line ${lineNumber}) has no register dump rows following its header`,
          headerLine,
          lineNumber,
        ),
      };
    }

    // --- blank separator -------------------------------------------------
    if (lines[i] !== "") {
      return {
        ok: false,
        refusal: makeRefusal(
          "malformed-dump",
          `io: expected a blank line after chip "${chip}"'s register dump, found ${JSON.stringify(lines[i] ?? "<end of input>")}`,
          lines[i] ?? "",
          i + 1,
        ),
      };
    }
    i++;

    // --- decoded prose -----------------------------------------------------
    const proseStartLineNumber = i + 1;
    const proseLines: string[] = [];
    while (i < lines.length && lines[i] !== "") {
      proseLines.push(lines[i]!);
      i++;
    }
    const proseResult = decodeProseLines(proseLines, proseStartLineNumber, unrecognisedLines);
    if (!proseResult.ok) return proseResult;
    if (i < lines.length && lines[i] === "") i++; // consume the blank separator before the sprite table

    // --- sprite table -----------------------------------------------------
    const spriteHeaderLine = lines[i] ?? "";
    const spriteHeaderLineNumber = i + 1;
    if (!spriteHeaderLine.startsWith(SPRITE_HEADER_PREFIX)) {
      return {
        ok: false,
        refusal: makeRefusal(
          "sprite-column-count",
          `io: chip "${chip}" is missing its expected "Sprites:" header line at line ${spriteHeaderLineNumber}: ${JSON.stringify(spriteHeaderLine)}`,
          spriteHeaderLine,
          spriteHeaderLineNumber,
        ),
      };
    }
    const boundariesResult = deriveSpriteBoundaries(spriteHeaderLine);
    if (!boundariesResult.ok) {
      return {
        ok: false,
        refusal: makeRefusal(
          "sprite-column-count",
          `io: the "Sprites:" header at line ${spriteHeaderLineNumber} declares ${boundariesResult.count} columns, not 8: ${JSON.stringify(spriteHeaderLine)}`,
          spriteHeaderLine,
          spriteHeaderLineNumber,
        ),
      };
    }
    i++;

    const spriteRows: SpriteTableRow[] = [];
    while (i < lines.length && lines[i] !== "") {
      const rowLine = lines[i]!;
      const rowLineNumber = i + 1;
      const rowResult = parseSpriteRow(rowLine, boundariesResult.boundaries);
      if (!rowResult.ok) {
        return {
          ok: false,
          refusal: makeRefusal(
            "unrecognised-sprite-row",
            `io: line ${rowLineNumber} has a sprite-table row label outside the closed ten-label set: ${JSON.stringify(rowResult.label)}`,
            rowLine,
            rowLineNumber,
          ),
        };
      }
      spriteRows.push(rowResult.row);
      i++;
    }
    if (i < lines.length && lines[i] === "") i++; // consume the blank separator before the next section, if any

    sections.push({
      chip,
      dump: { baseAddress, bytes: byteRows.flat() },
      decoded: proseResult.state,
      sprites: { columns: 8, rows: spriteRows },
    });
  }

  return { ok: true, value: { sections, unrecognisedLines } };
}
