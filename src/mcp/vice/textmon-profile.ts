// textmon-profile.ts
//
// THE ONE owning module for VICE's `prof flat` text-monitor output
// (PARSE-02, PARSE-03). Nothing else in this tree reads or interprets a
// `prof flat` reply -- a handler dials the wire, this module is the only
// place that turns the framed text into structured data.
//
// WHY THIS FILE EXISTS RATHER THAN LIVING INSIDE THE TOOL HANDLER: the same
// reasoning `textmon-memmap.ts` and `disasm-decoder.ts` state for themselves
// applies here unchanged -- keeping the parser import-free of transport code
// means any future non-tool consumer can depend on this one file without
// dragging in a socket, and PARSE-03's own never-throw discipline (D-42-3,
// decided once in plan 42-01 for all five text parsers this phase adds)
// means this module can never be the thing that silently launders a wire
// error into a parse result, because it never touches the wire at all.
//
// THE ONE HAZARD THAT DEFINES THIS MODULE. VICE's flat profiler writes its
// cycle counts with U+202F (NARROW NO-BREAK SPACE, UTF-8 bytes e2 80 af) as
// the thousands separator -- MEASURED directly against both committed real
// captures (`xxd fixtures/textmon/flat-profile-stock.txt`) and recorded in
// `fixtures/textmon/README.md`'s own "Encoding" section. In JavaScript, the
// regular-expression whitespace class (`\s`) MATCHES U+202F. So the obvious
// implementation -- split each row on a run of `\s` -- silently cuts every
// cycle count into pieces and yields only the first piece: the stock
// capture's leading row would read `2` instead of `2326151`, an inverted
// answer with no error anywhere. THIS MODULE THEREFORE NEVER SPLITS ON `\s`.
// Every row is tokenized on runs of the ASCII space character (U+0020) ONLY
// (`/ +/`, never `/\s+/`), so a thousands-separated number -- whose internal
// separator is U+202F, not U+0020 -- survives tokenization as ONE token.
// Each numeric token is then parsed by first stripping U+202F and requiring
// the remainder to be digits only. Do not "simplify" this back to a
// whitespace-class split; that is the defect this module exists to avoid.
//
// WHAT NOT TO DO:
//   - Never import anything -- not `node:` anything, not `text-protocol.ts`,
//     not `textmon-fixtures.ts`, not even a type-only import of a sibling
//     module. Purity is asserted mechanically by this file's own test.
//   - Never throw on a malformed or drifted input (D-42-3). Return the
//     discriminated `FlatProfileParseResult` instead.
//   - Never sort or re-rank `entries`. VICE emits rows in its own rank
//     order (by cycles descending); this module performs NO array-sorting
//     or array-reversing call anywhere, asserted mechanically by this
//     file's own test scanning the source for one. Re-ranking, including
//     "stabilizing" a tie by re-sorting on a secondary key, would restate
//     which address dominates the profile -- the whole point of the format
//     -- and is never this module's decision to make.
//   - Never use `\s`, `String.prototype.trim()` on a whole row before
//     tokenizing, or any other general-whitespace-class operation on a row
//     that still contains its numeric fields -- see the hazard note above.
//   - Never silently accept an ASCII space in place of the thousands
//     separator by concatenating split fragments back together. A row using
//     the wrong separator character is drift and must refuse by name
//     (`unrecognised-separator`), never be silently repaired.
//   - Never assume the percentage's decimal separator is a comma. The
//     captures render it as a comma (the capturing host's locale), but a
//     period is an equally legitimate reading from a different host; both
//     are accepted and the OBSERVED separator is recorded on the result
//     rather than assumed or discarded.

/** One decoded `prof flat` row, in VICE's own emitted order (rank order by
 * cycles, descending) -- this module performs no sort of its own, ever. */
export interface FlatProfileEntry {
  readonly totalCycles: number;
  readonly totalPercent: number;
  readonly selfCycles: number;
  readonly selfPercent: number;
  readonly address: number;
}

/** The full decoded flat profile. `decimalSeparator` records which of the
 * two accepted decimal-point characters was observed in the payload's
 * percentage fields -- a real environmental fact, never assumed. */
export interface FlatProfile {
  readonly entries: readonly FlatProfileEntry[];
  readonly decimalSeparator: "," | ".";
}

/** The closed refusal-code union (D-42-3): an empty response, a missing or
 * unrecognised header/rule pair, a structurally malformed row (wrong field
 * count, non-hex address), an unrecognised thousands separator (a numeric
 * group broken apart by an ASCII space rather than joined by U+202F), and
 * an unrecognised percentage shape. */
export type FlatProfileRefusalCode =
  | "empty-response"
  | "missing-header"
  | "malformed-row"
  | "unrecognised-separator"
  | "unrecognised-percentage";

/** A parser refusal (D-42-3): returned, never thrown. `line` and
 * `lineNumber` name the offending content whenever one exists -- for the
 * whole-payload `empty-response` refusal, `line` is empty and `lineNumber`
 * is 0. */
export interface TextParseRefusal {
  readonly code: FlatProfileRefusalCode;
  readonly message: string;
  readonly line: string;
  readonly lineNumber: number;
}

/** D-42-3's discriminated shape: a parser never throws, it returns one of
 * these two arms. */
export type FlatProfileParseResult = { ok: true; value: FlatProfile } | { ok: false; refusal: TextParseRefusal };

// ---------------------------------------------------------------------------
// Framing constants -- this module's OWN copies, never imported from
// text-protocol.ts (purity rule above). `prof flat` carries no leading
// entry-echo prompt (unlike `memmapshow`) per fixtures/textmon/README.md's
// own "Framing" section -- only a TRAILING exit-prompt is ever stripped.
// ---------------------------------------------------------------------------

const TRAILING_PROMPT_RE = /\(C:\$[0-9A-Fa-f]{4}\)\s*$/;

/** VICE's own two-line header, byte-for-byte -- MEASURED identical across
 * both the stock and fork real captures. Neither line's content depends on
 * the reported row count. */
const HEADER_LINE = "        Total      %          Self      %";
const RULES_LINE = "------------- ------ ------------- ------";

/** The narrow no-break space (U+202F) VICE uses as its thousands separator
 * -- see this module's header comment for the full hazard explanation. */
const THOUSANDS_SEPARATOR = "\u202f";

/** A numeric field: one or more digits, optionally interleaved with the
 * narrow no-break space thousands separator -- NEVER an ASCII space, which
 * is exclusively the inter-field tokenizer's own delimiter (see
 * `tokenizeRow` below). */
const NUMERIC_FIELD_RE = new RegExp(`^[0-9${THOUSANDS_SEPARATOR}]+$`);

/** A percentage field: one or more digits, a decimal separator (comma or
 * period, both accepted -- see this module's header comment), one or more
 * digits, then a trailing `%`. */
const PERCENT_FIELD_RE = /^(\d+)([,.])(\d+)%$/;

function makeRefusal(code: FlatProfileRefusalCode, message: string, line: string, lineNumber: number): TextParseRefusal {
  return { code, message, line, lineNumber };
}

/** Tokenizes one data row on runs of the ASCII space character ONLY (never
 * `\s`, never any other Unicode space) -- the one hazard this module exists
 * to defend against. A thousands-separated numeric field survives this
 * split as a single token because its internal separator is U+202F, not
 * U+0020. */
function tokenizeRow(row: string): string[] {
  return row.split(/ +/).filter((token) => token.length > 0);
}

type NumericFieldResult =
  | { ok: true; value: number }
  | { ok: false; code: "unrecognised-separator" | "malformed-row"; detail: string };

/** Parses the totalCycles/selfCycles field from its (possibly split-apart,
 * if malformed) token run. A well-formed field is exactly ONE token
 * matching `NUMERIC_FIELD_RE`. When tokenization instead produced more than
 * one token, the field is malformed -- but WHY it split apart matters: if
 * every fragment is digits-only, an ASCII space stood where the narrow
 * no-break space belongs (`unrecognised-separator`, the specific, named
 * hazard this module exists to catch); anything else is a generic
 * structural malformation (`malformed-row`). */
function parseNumericField(tokens: readonly string[]): NumericFieldResult {
  if (tokens.length !== 1) {
    const detail = tokens.join(" ");
    if (tokens.length > 0 && tokens.every((t) => /^\d+$/.test(t))) {
      return { ok: false, code: "unrecognised-separator", detail };
    }
    return { ok: false, code: "malformed-row", detail };
  }
  const raw = tokens[0]!;
  if (!NUMERIC_FIELD_RE.test(raw)) {
    return { ok: false, code: "malformed-row", detail: raw };
  }
  const digitsOnly = raw.split(THOUSANDS_SEPARATOR).join("");
  return { ok: true, value: Number(digitsOnly) };
}

type PercentFieldResult = { ok: true; value: number; separator: "," | "." } | { ok: false };

/** Parses a percentage field. Both a comma and a period decimal separator
 * are accepted (the capturing host's locale, not a VICE constant); the
 * OBSERVED separator is returned alongside the numeric value rather than
 * assumed. A token that carries no recognisable decimal shape at all
 * (including one with the wrong separator character, e.g. a semicolon)
 * fails here. */
function parsePercentField(token: string): PercentFieldResult {
  const match = PERCENT_FIELD_RE.exec(token);
  if (!match) return { ok: false };
  const separator = match[2] as "," | ".";
  return { ok: true, value: Number(`${match[1]}.${match[3]}`), separator };
}

/**
 * Parses `prof flat`'s framed text-monitor reply into a structured
 * {@link FlatProfile}. Input is the string `TextMonitorClient.command()`
 * resolves to, or a fixture's `text` -- both must parse identically. Never
 * throws (D-42-3): every failure mode returns `{ ok: false, refusal }`
 * naming exactly what was wrong and where.
 *
 * Bounded by construction: one pass over the payload's lines, each
 * iteration consumes exactly one line, no recursion anywhere in this
 * function. Performs NO sort -- rows are returned in VICE's own emitted
 * order, entry by entry, as encountered.
 */
export function parseFlatProfile(text: string): FlatProfileParseResult {
  if (typeof text !== "string" || text.trim() === "") {
    return {
      ok: false,
      refusal: makeRefusal(
        "empty-response",
        "prof flat: the response was empty or whitespace-only -- never decoded as a zero-row profile, because an " +
          "empty response and a real capture that recorded no ranked cycles are two different facts",
        "",
        0,
      ),
    };
  }

  let body = text.replace(TRAILING_PROMPT_RE, "");
  if (body.trim() === "") {
    return {
      ok: false,
      refusal: makeRefusal(
        "empty-response",
        "prof flat: the response contained only prompt text and no header -- never decoded as a zero-row profile",
        "",
        0,
      ),
    };
  }

  const lines = body.split("\n");
  // A trailing "\n" before the (already-stripped) prompt splits into one
  // trailing empty element -- drop exactly that split artifact, never any
  // other blank line, so a genuinely blank data line still reaches the row
  // parser below and refuses structurally rather than being silently
  // swallowed here.
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  const headerLine = lines[0] ?? "";
  const rulesLine = lines[1] ?? "";
  if (headerLine !== HEADER_LINE || rulesLine !== RULES_LINE) {
    const badLine = headerLine !== HEADER_LINE ? headerLine : rulesLine;
    const badLineNumber = headerLine !== HEADER_LINE ? 1 : 2;
    return {
      ok: false,
      refusal: makeRefusal(
        "missing-header",
        `prof flat: expected the two-line header ${JSON.stringify(HEADER_LINE)} / ${JSON.stringify(RULES_LINE)}, ` +
          `found ${JSON.stringify(badLine)} at line ${badLineNumber}`,
        badLine,
        badLineNumber,
      ),
    };
  }

  const dataLines = lines.slice(2);
  if (dataLines.length === 0) {
    return {
      ok: false,
      refusal: makeRefusal(
        "malformed-row",
        "prof flat: the header was present but no data rows followed it -- never decoded as a zero-row profile",
        rulesLine,
        2,
      ),
    };
  }

  const entries: FlatProfileEntry[] = [];
  let decimalSeparator: "," | "." | undefined;

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i]!;
    const lineNumber = i + 3; // two header lines occupy lines 1-2

    const tokens = tokenizeRow(line);
    if (tokens.length === 0) {
      return {
        ok: false,
        refusal: makeRefusal("malformed-row", `prof flat: line ${lineNumber} is blank where a data row was expected`, line, lineNumber),
      };
    }

    const percentIdxs: number[] = [];
    for (let t = 0; t < tokens.length; t++) {
      if (tokens[t]!.endsWith("%")) percentIdxs.push(t);
    }
    if (percentIdxs.length !== 2) {
      return {
        ok: false,
        refusal: makeRefusal(
          "malformed-row",
          `prof flat: line ${lineNumber} does not carry exactly two percentage fields: ${JSON.stringify(line)}`,
          line,
          lineNumber,
        ),
      };
    }
    const [p1, p2] = percentIdxs as [number, number];

    const totalCyclesTokens = tokens.slice(0, p1);
    const selfCyclesTokens = tokens.slice(p1 + 1, p2);
    const addressTokens = tokens.slice(p2 + 1);

    if (addressTokens.length !== 1) {
      return {
        ok: false,
        refusal: makeRefusal(
          "malformed-row",
          `prof flat: line ${lineNumber} does not carry exactly one address field after the second percentage: ${JSON.stringify(line)}`,
          line,
          lineNumber,
        ),
      };
    }
    const addressToken = addressTokens[0]!;
    if (!/^[0-9a-fA-F]{4}$/.test(addressToken)) {
      return {
        ok: false,
        refusal: makeRefusal(
          "malformed-row",
          `prof flat: line ${lineNumber} has an address field that is not four hex digits: ${JSON.stringify(addressToken)}`,
          line,
          lineNumber,
        ),
      };
    }

    const totalCyclesResult = parseNumericField(totalCyclesTokens);
    if (!totalCyclesResult.ok) {
      return {
        ok: false,
        refusal: makeRefusal(
          totalCyclesResult.code,
          `prof flat: line ${lineNumber}'s total-cycles field ${JSON.stringify(totalCyclesResult.detail)} is ` +
            (totalCyclesResult.code === "unrecognised-separator"
              ? "split by an ASCII space rather than the narrow no-break space (U+202F) thousands separator"
              : "not a recognised numeric field"),
          line,
          lineNumber,
        ),
      };
    }
    const selfCyclesResult = parseNumericField(selfCyclesTokens);
    if (!selfCyclesResult.ok) {
      return {
        ok: false,
        refusal: makeRefusal(
          selfCyclesResult.code,
          `prof flat: line ${lineNumber}'s self-cycles field ${JSON.stringify(selfCyclesResult.detail)} is ` +
            (selfCyclesResult.code === "unrecognised-separator"
              ? "split by an ASCII space rather than the narrow no-break space (U+202F) thousands separator"
              : "not a recognised numeric field"),
          line,
          lineNumber,
        ),
      };
    }

    const totalPercentToken = tokens[p1]!;
    const totalPercentResult = parsePercentField(totalPercentToken);
    if (!totalPercentResult.ok) {
      return {
        ok: false,
        refusal: makeRefusal(
          "unrecognised-percentage",
          `prof flat: line ${lineNumber}'s total-percent field ${JSON.stringify(totalPercentToken)} does not match ` +
            "digits, a comma or period decimal separator, digits, then a trailing %",
          line,
          lineNumber,
        ),
      };
    }
    const selfPercentToken = tokens[p2]!;
    const selfPercentResult = parsePercentField(selfPercentToken);
    if (!selfPercentResult.ok) {
      return {
        ok: false,
        refusal: makeRefusal(
          "unrecognised-percentage",
          `prof flat: line ${lineNumber}'s self-percent field ${JSON.stringify(selfPercentToken)} does not match ` +
            "digits, a comma or period decimal separator, digits, then a trailing %",
          line,
          lineNumber,
        ),
      };
    }

    if (decimalSeparator === undefined) {
      decimalSeparator = totalPercentResult.separator;
    }

    entries.push({
      totalCycles: totalCyclesResult.value,
      totalPercent: totalPercentResult.value,
      selfCycles: selfCyclesResult.value,
      selfPercent: selfPercentResult.value,
      address: parseInt(addressToken, 16),
    });
  }

  return { ok: true, value: { entries, decimalSeparator: decimalSeparator ?? "," } };
}
