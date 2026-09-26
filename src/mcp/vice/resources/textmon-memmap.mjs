// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from textmon-memmap.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to .c64-re-tools/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// textmon-memmap.mts
//
// THE ONE owning module for VICE's `memmapshow` text-monitor output
// (PARSE-01, PARSE-03). Nothing else in this tree reads or interprets a
// `memmapshow` reply -- a handler dials the wire, this module is the only
// place that turns the framed text into structured data.
//
// WHY THIS FILE EXISTS RATHER THAN LIVING INSIDE THE TOOL HANDLER: the exact
// reasoning `disasm-decoder.mts` states for itself applies here unchanged --
// keeping the parser import-free of transport code means any future
// non-tool consumer (an offline diff over two captured maps, say) can depend
// on this one file without dragging in a socket. It is also PARSE-03's own
// requirement: an owning module that is pure by construction cannot be the
// thing that silently launders a wire error into a parse result, because it
// never touches the wire at all.
//
// WHAT NOT TO DO:
//   - Never import anything -- not `node:` anything, not `text-protocol.ts`,
//     not `textmon-fixtures.ts`, not even a type-only import of a sibling
//     module. Purity is asserted mechanically by this file's own test
//     (reads this module's source, greps for a top-level `import`) -- it is
//     not a style preference to be relaxed later.
//   - Never throw on a malformed or drifted input (D-42-3, decided once for
//     all five text parsers this phase adds). Return the discriminated
//     `AccessMapParseResult` instead. `withTextTool()`'s own `try/catch`
//     converts anything THROWN into a transport-error message -- a thrown
//     refusal would be reported to the caller as a WIRE failure, laundering
//     a format-drift refusal into exactly the "absorbed into a
//     plausible-looking wrong answer" failure mode PARSE-03 exists to
//     prevent.
//   - Never fold `execute` into `read`, default it from `read`, or treat the
//     absence of a read glyph as evidence about execute. VICE emits
//     `MEMMAP_*_X` as a bit distinct from `MEMMAP_*_R`/`_W` and prints each
//     as its own glyph -- an entry with `--x` (execute recorded, no read) is
//     real, measured output, not an edge case to normalize away.
//   - Never treat an empty or whitespace-only payload as a zero-entry
//     access map. Those are two different facts: "nothing was captured"
//     and "the capture recorded no access anywhere" are not the same
//     sentence, and collapsing them is exactly the "absence read as a
//     claim" failure T-42-05 exists to close.
//   - Never add a field, key, label or enum member anywhere in this module
//     or its answer types that classifies an address as DATA on the
//     strength of never having been observed. An address absent from
//     `AccessMap.entries` is reported only as a count against
//     `addressesQueried` in `accessMapRanges()`'s result -- never rendered,
//     named, or implied as anything else.
//   - Never add a second buffer or a second length cap here. The transport
//     (`text-protocol.ts`'s `TEXT_MAX_BUFFERED_LEN`) is the one place that
//     bound lives; this module receives an already-framed string and its
//     own `maxRanges` budget bounds only what is EMITTED to a caller, never
//     what is read.
// ---------------------------------------------------------------------------
// Framing constants -- this module's OWN copies, never imported from
// text-protocol.ts (purity rule above). `text-protocol.ts`'s `PROMPT_RE` is
// tail-anchored only and is applied by the transport to strip the TRAILING
// prompt before this module ever sees the string; the LEADING entry-echo
// prompt `memmapshow` alone emits is untouched by the transport and must be
// tolerated here.
// ---------------------------------------------------------------------------
const LEADING_PROMPT_RE = /^\(C:\$[0-9A-Fa-f]{4}\)\s*/;
const TRAILING_PROMPT_RE = /\(C:\$[0-9A-Fa-f]{4}\)\s*$/;
/** VICE's own header line, byte-for-byte -- two spaces after `IO`, one
 * after `ROM`, no trailing space (`mon_memmap.c`'s own `mon_out()` call,
 * confirmed against both committed real captures). */
const HEADER_LINE = "addr: IO  ROM RAM";
/** A data line's overall layout: a 4-hex-digit address, `: `, then three
 * space-separated 3-character glyph groups (IO, ROM, RAM, in that fixed
 * order), then whatever trailer text follows (validated separately by
 * `parseTrailer()`). A line that does not match this AT ALL is a
 * STRUCTURAL malformation (`malformed-line`) -- the per-character glyph
 * and per-suffix trailer checks below only run once this much has already
 * matched. */
const DATA_LINE_RE = /^([0-9a-fA-F]{4}): (.{3}) (.{3}) (.{3})(.*)$/;
/** The closed, ordered set of recognised trailer suffixes. Order matters:
 * `parseTrailer()` strips them in VICE's own emission order, per the plan's
 * own framing note -- never a set membership test that would accept the
 * three suffixes in any order. */
const ANNOTATION_SUFFIXES = [
    { suffix: " (dummy)", annotation: "dummy" },
    { suffix: " (uninitialized read)", annotation: "uninitialized-read" },
    { suffix: " (uninitialized exec)", annotation: "uninitialized-exec" },
];
function makeRefusal(code, message, line, lineNumber) {
    return { code, message, line, lineNumber };
}
/** Decodes one 3-character glyph group. Recognised characters only:
 * position 0 is `r` or `-`, position 1 is `w` or `-`, position 2 is `x` or
 * `-` -- exact match, case-sensitive (VICE has never emitted an uppercase
 * glyph; recognition is exact, not case-insensitive). The group's WIDTH is
 * already guaranteed to be exactly 3 by `DATA_LINE_RE`'s own capture group,
 * so only content is checked here. */
function parseGlyphGroup(group) {
    const r = group[0];
    const w = group[1];
    const x = group[2];
    if (r !== "r" && r !== "-")
        return { ok: false, badChar: r };
    if (w !== "w" && w !== "-")
        return { ok: false, badChar: w };
    if (x !== "x" && x !== "-")
        return { ok: false, badChar: x };
    return { ok: true, flags: { read: r === "r", write: w === "w", execute: x === "x" } };
}
/** Decodes the trailer following a data line's three glyph groups: zero or
 * more of the three recognised suffixes, in VICE's own emission order
 * (`ANNOTATION_SUFFIXES`'s own order). Any leftover text that is not a
 * clean, ordered concatenation of recognised suffixes refuses. Bounded by
 * construction -- at most three iterations over a fixed array, no
 * recursion. */
function parseTrailer(trailer) {
    let rest = trailer;
    const annotations = [];
    for (const { suffix, annotation } of ANNOTATION_SUFFIXES) {
        if (rest.startsWith(suffix)) {
            annotations.push(annotation);
            rest = rest.slice(suffix.length);
        }
    }
    if (rest !== "")
        return { ok: false };
    return { ok: true, annotations };
}
/**
 * Parses `memmapshow`'s framed text-monitor reply into a structured
 * {@link AccessMap}. Input is the string `TextMonitorClient.command()`
 * resolves to, or a fixture's `text` -- both must parse identically (see
 * the module header). Never throws (D-42-3): every failure mode returns
 * `{ ok: false, refusal }` naming exactly what was wrong and where.
 *
 * Bounded by construction: one pass over the payload's lines, each
 * iteration consumes exactly one line, no recursion anywhere in this
 * function.
 */
export function parseAccessMap(text) {
    if (typeof text !== "string" || text.trim() === "") {
        return {
            ok: false,
            refusal: makeRefusal("empty-response", "memmapshow: the response was empty or whitespace-only -- never decoded as a zero-entry access map, " +
                "because an empty response and a real capture that recorded no access anywhere are two different facts", "", 0),
        };
    }
    let body = text;
    const leadingMatch = LEADING_PROMPT_RE.exec(body);
    if (leadingMatch) {
        body = body.slice(leadingMatch[0].length);
    }
    body = body.replace(TRAILING_PROMPT_RE, "");
    if (body.trim() === "") {
        return {
            ok: false,
            refusal: makeRefusal("empty-response", "memmapshow: the response contained only prompt text and no header -- never decoded as a zero-entry access map", "", 0),
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
    const headerLine = lines[0] ?? "";
    if (headerLine !== HEADER_LINE) {
        return {
            ok: false,
            refusal: makeRefusal("missing-header", `memmapshow: expected the header line ${JSON.stringify(HEADER_LINE)}, found ${JSON.stringify(headerLine)}`, headerLine, 1),
        };
    }
    const dataLines = lines.slice(1);
    if (dataLines.length === 0) {
        return {
            ok: false,
            refusal: makeRefusal("no-data-lines", "memmapshow: the header was present but no data lines followed it -- never decoded as a zero-entry access map", headerLine, 1),
        };
    }
    const entries = [];
    for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];
        const lineNumber = i + 2; // the header occupies line 1
        const match = DATA_LINE_RE.exec(line);
        if (!match) {
            return {
                ok: false,
                refusal: makeRefusal("malformed-line", `memmapshow: line ${lineNumber} does not match the expected "aaaa: xxx xxx xxx" layout: ${JSON.stringify(line)}`, line, lineNumber),
            };
        }
        const addrHex = match[1];
        const ioStr = match[2];
        const romStr = match[3];
        const ramStr = match[4];
        const trailer = match[5] ?? "";
        const ioResult = parseGlyphGroup(ioStr);
        if (!ioResult.ok) {
            return {
                ok: false,
                refusal: makeRefusal("unrecognised-glyph", `memmapshow: line ${lineNumber} has an unrecognised IO glyph character ${JSON.stringify(ioResult.badChar)}: ${JSON.stringify(line)}`, line, lineNumber),
            };
        }
        const romResult = parseGlyphGroup(romStr);
        if (!romResult.ok) {
            return {
                ok: false,
                refusal: makeRefusal("unrecognised-glyph", `memmapshow: line ${lineNumber} has an unrecognised ROM glyph character ${JSON.stringify(romResult.badChar)}: ${JSON.stringify(line)}`, line, lineNumber),
            };
        }
        const ramResult = parseGlyphGroup(ramStr);
        if (!ramResult.ok) {
            return {
                ok: false,
                refusal: makeRefusal("unrecognised-glyph", `memmapshow: line ${lineNumber} has an unrecognised RAM glyph character ${JSON.stringify(ramResult.badChar)}: ${JSON.stringify(line)}`, line, lineNumber),
            };
        }
        const trailerResult = parseTrailer(trailer);
        if (!trailerResult.ok) {
            return {
                ok: false,
                refusal: makeRefusal("unrecognised-annotation", `memmapshow: line ${lineNumber} has an unrecognised trailer ${JSON.stringify(trailer)}: ${JSON.stringify(line)}`, line, lineNumber),
            };
        }
        entries.push({
            address: parseInt(addrHex, 16),
            io: ioResult.flags,
            rom: romResult.flags,
            ram: ramResult.flags,
            annotations: trailerResult.annotations,
        });
    }
    return { ok: true, value: { entries } };
}
const DEFAULT_MAX_RANGES = 256;
const MAX_RANGES_CEILING = 4096;
function isValidAddress(value) {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 0xffff;
}
function isValidMaxRanges(value) {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}
function sameFlags(a, b) {
    return a.read === b.read && a.write === b.write && a.execute === b.execute;
}
function sameAnnotationSet(a, b) {
    if (a.length !== b.length)
        return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((value, index) => value === sortedB[index]);
}
/**
 * Walks `map.entries` (already in address order -- `parseAccessMap()`
 * always emits them that way, but this function re-sorts defensively
 * rather than trusting the caller) and merges a run of ADJACENT addresses
 * (address n+1 immediately following n) whose nine access booleans and
 * whose annotation set are all identical into one range. A single
 * differing bit, a differing annotation set, or an address gap starts a
 * new range. Bounded by construction: one pass over `map.entries`, no
 * recursion.
 *
 * There is no field, key or label anywhere in this function's return value
 * that classifies an address as data -- an address absent from
 * `map.entries` is reported only through the gap between
 * `addressesWithRecordedAccess` and `addressesQueried` (see this module's
 * header comment).
 */
export function accessMapRanges(map, opts = {}) {
    const options = opts && typeof opts === "object" ? opts : {};
    const startAddress = isValidAddress(options.startAddress) ? options.startAddress : 0;
    const endAddress = isValidAddress(options.endAddress) ? options.endAddress : 0xffff;
    const requestedMaxRanges = isValidMaxRanges(options.maxRanges) ? options.maxRanges : DEFAULT_MAX_RANGES;
    const maxRanges = Math.min(requestedMaxRanges, MAX_RANGES_CEILING);
    const sorted = [...map.entries].sort((a, b) => a.address - b.address);
    const filtered = sorted.filter((entry) => entry.address >= startAddress && entry.address <= endAddress);
    const merged = [];
    for (const entry of filtered) {
        const last = merged[merged.length - 1];
        if (last !== undefined &&
            last.end + 1 === entry.address &&
            sameFlags(last.io, entry.io) &&
            sameFlags(last.rom, entry.rom) &&
            sameFlags(last.ram, entry.ram) &&
            sameAnnotationSet(last.annotations, entry.annotations)) {
            merged[merged.length - 1] = { ...last, end: entry.address };
        }
        else {
            merged.push({
                start: entry.address,
                end: entry.address,
                io: entry.io,
                rom: entry.rom,
                ram: entry.ram,
                annotations: entry.annotations,
            });
        }
    }
    const rangeCount = merged.length;
    const truncated = rangeCount > maxRanges;
    const ranges = truncated ? merged.slice(0, maxRanges) : merged;
    const addressesQueried = endAddress >= startAddress ? endAddress - startAddress + 1 : 0;
    return {
        ranges,
        rangeCount,
        truncated,
        addressesWithRecordedAccess: filtered.length,
        addressesQueried,
    };
}
