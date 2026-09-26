#!/usr/bin/env node
// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from anno-enum-gen.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to .c64-re-tools/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// anno-enum-gen.mts -- the ONE authoritative place in this repo for value ->
// variant naming, the adjacent-pair rule, identifier sanitization, the
// per-register enum plan, the coverage report's wording contract, and the
// multi-bit register DECOMPOSITION into named, OR-able terms.
//
// WHAT LEFT, WHAT STAYED, AND WHERE THE ROUTE RETURNS. Read this paragraph
// before looking for a function that is not here.
//
//   WHAT LEFT: the ROUTE, and only the route. Four things went, because all
//   four spoke to the retired external analyser's own tool surface and every
//   module they spoke through was deleted in the same commit:
//     - the two disassembly searches that FETCHED the `lda` and `sta` rows;
//     - `parseSearchRows()`, which unwrapped that surface's own result shape;
//     - `createOrUpdateEnum()` and `applyUsage()`, which INSTALLED an enum
//       and bound it to an address through that surface;
//     - `generateEnums()`, the pass that strung those together.
//
//   WHAT STAYED: the HEURISTICS, all of them, as live code rather than as
//   prose about code that used to exist. This is the part the classification
//   registry exists to protect, so it was extracted from the route rather
//   than deleted with it:
//     - `variantNameFor()` and the bit-name table it decodes against -- the
//       whole naming vocabulary, untouched, still pinned by its
//       injectivity tests across all 256 values.
//     - `pairSearchRows()` -- the adjacent-pair rule (a store pairs with
//       an immediate load exactly 2 bytes earlier, adjacent-only, no
//       dataflow, a miss costs nothing), lifted out of the deleted fetch
//       loop verbatim and now a PURE function of two already-fetched row
//       arrays. Whoever rebuilds the fetch supplies the rows; the rule does
//       not change.
//     - `planEnumsForPairing()` -- one variant per DISTINCT
//       value the program actually writes, never a full
//       256-values-per-register table, with the first-seen `lda` address
//       kept as each value's representative binding site.
//     - `buildEnumGenerationReport()` -- the "no silent caps" wording
//       contract, which states a possible truncation in WORDS rather than
//       leaving it to be inferred from a row count.
//     - `sanitizeVariantMap()` and the identifier gate it runs, unchanged.
//
//   WHERE THE ROUTE RETURNS: this line used to say "NO PHASE CURRENTLY OWNS
//   ITS RETURN", and that too is now CORRECTED rather than deleted, for the
//   same reason the paragraph above was: deleting a withdrawal notice erases
//   the record that a capability went missing, and deleting a return notice
//   would erase the record of when and why it came back. The first
//   correction (recorded here, kept for the history): it forecast a rebuild
//   of the fetch and the install over this project's own annotation store,
//   rendering the enums into the ACME export. The ACME export route itself
//   did come back on 2026-08-31, as the `anno export-asm` CLI verb -- but the
//   work that rebuilt it covered that route ONLY: no requirement and no
//   success criterion of it mentioned `gen-enums`, and at that time no phase
//   owned rebuilding it.
//
//   THE SECOND CORRECTION, dated 2026-09-11: this route is owned again --
//   the ENUM half of the generated-enum capability only.
//   `fetchRegisterSearchRows()` walks a store's own `code`-typed ranges
//   through the same `disasm-decoder.mts` `decode()` `anno_disassemble` uses,
//   `generateEnumsFromStore()` strings fetch -> `pairSearchRows()` ->
//   `planEnumsForPairing()` -> `sanitizeVariantMap()` -> `installPlannedEnums()`
//   -> `buildEnumGenerationReport()`, and `installPlannedEnums()` installs
//   through the same `createProjectEnum()`/`updateProjectEnum()`/
//   `applyEnumUsage()` write path the by-hand route already used. The symbol
//   round trip (`export-lbl`/`import-lbl`) is a SEPARATE
//   capability this rebuild does not touch and remains unowned. Everything
//   above this paragraph is the specification this rebuild was built
//   against, and it needed no changes to build against: every surviving
//   heuristic is called here unmodified.
//
// MEASURED MECHANISM FACTS, PAST TENSE -- kept because they are WHY the
// heuristics have the shape they have, not because anything still calls the
// producer they were measured against (a real pinned-version 0.9.20 child on
// this host, by direct live call, never paraphrased from a document):
//   - An enum definition's variants were a flat `BTreeMap<u16, String>` -- a
//     plain value-to-name map, with NO bit-OR composition anywhere. That is
//     why `variantNameFor()` must produce one TOTAL name per value rather
//     than a composable set of flags.
//   - Applying an enum usage bound it to the INSTRUCTION ADDRESS holding the
//     immediate operand (the `lda`, never the `sta`) -- confirmed both by
//     direct call and by `handler.rs:1236-1264`'s own description text. That
//     is why `PairOccurrence` carries `ldaAddr` and not the store address.
//   - Applying an enum emitted its WHOLE variant list into the exported ACME
//     header; an unmatched value fell back to bare `#$xx` while the dead
//     definitions were still emitted. This is exactly why this module
//     generates one variant per value the program actually writes.
//   - Creating an enum FAILED with "Enum '<name>' already exists"
//     (`app_state.rs:443-457`'s `validate_new_enum_name`) if the name was
//     already taken -- there was no upsert. That is why `EnumInstallAction`
//     has two values and why re-runnability needed a documented
//     create-then-update precedence rather than a single call. A rebuilt
//     installer that cannot express "updated" has lost that property.
//   - The disassembly search matched its `query` regex against the
//     `mnemonic` and `operand` fields INDEPENDENTLY (`state/search.rs:
//     309-313`) -- they were NEVER concatenated into one searchable string.
//     A combined `"^sta \$(...)"`-shaped query therefore matched neither
//     field alone. The consequence that outlives it: the register and
//     immediate-mode narrowing belongs CLIENT-SIDE, against this project's
//     own curated register set derived from `anno-regbits.json`'s own keys,
//     which is what `pairSearchRows()` still does and what this module
//     requires.
//   - That search's `max_results` server-side default was 50
//     (`handler.rs:1074-1077`), which is where the "no silent caps" rule
//     came from: never accept a producer's own default ceiling, and report a
//     possible truncation in words.
//   - The live query view rendered an applied enum reference as
//     `EnumName.VARIANT` (a dot) while the ACME export rendered
//     `EnumName_VARIANT` (an underscore). VERSION-SCOPED to 0.9.20
//     (RESEARCH.md Assumption A2). A rebuilt route must RE-MEASURE the
//     equivalent discrepancy against its own export rather than inherit this
//     one -- the obligation belongs to the rebuild, not to a numbered phase.
//
// WHAT NOT TO DO, named concretely:
//   - Never write a machine-global enum. Generated enums live project-level
//     only, so nothing machine-wide is touched and a name collision cannot
//     silently overwrite another project's enum. The machine-wide config-dir
//     save route is never referenced anywhere in this file, and
//     `anno-enum-gen.test.ts`'s own zero-count grep asserts that
//     mechanically. That guard is DORMANT while this module has no install
//     route at all and goes live again the instant ANY install route is added
//     -- the condition is a route existing, not a phase arriving -- which is
//     exactly when it is needed, so it stays.
//   - Never call an install path with an unsanitized identifier.
//     `assertLegalAcmeIdentifier()` (defined in `anno-acme-ident.mts`,
//     re-exported here) runs on every variant name inside
//     `sanitizeVariantMap()`. Any rebuilt installer calls
//     `sanitizeVariantMap()` BEFORE it does any I/O, for the same reason the
//     deleted one did: sanitization is entirely client-side, so a rejected
//     name provably never reaches a child.
//   - Never re-derive the register set from a second hardcoded list. It comes
//     from `anno-regbits.json`'s own keys, via `loadRegBits()`, always.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_ACME_IDENTIFIER_LENGTH, assertLegalAcmeIdentifier } from "./anno-acme-ident.mjs";
import { decode } from "./disasm-decoder.mjs";
import { applyEnumUsage, createProjectEnum, listRanges, updateProjectEnum } from "./anno-store.mjs";
import { AnnoLabelError } from "./anno-types.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
// Beside this module (the package root), else one directory up (the
// compiled dist/ copy, one level below the package root).
const REGBITS_PATH = [join(HERE, "anno-regbits.json"), join(HERE, "..", "anno-regbits.json")].find((c) => existsSync(c)) ?? join(HERE, "anno-regbits.json");
/** The ceiling a caller states instead of trusting a producer's own default
 * (which was 50, `handler.rs:1074-1077`). The "no silent caps" rule: the
 * returned row count is compared against THIS value and a possible truncation
 * is reported in words. A rebuilt fetch passes it explicitly for the same
 * reason. */
export const DEFAULT_MAX_RESULTS = 10_000;
// MAX_ACME_IDENTIFIER_LENGTH / assertLegalAcmeIdentifier() live in
// anno-acme-ident.mts (plan 260821-a86, T-11-NAME-INJECT) -- that module is
// the ONE authoritative place for the ACME identifier policy, consumed by
// THIS file's sanitizeVariantMap() below plus anno-symbols.ts's own pre-spawn
// label-name gate. Re-exported here (imported above) so this file's existing
// consumers and tests keep their current import path.
export { MAX_ACME_IDENTIFIER_LENGTH, assertLegalAcmeIdentifier };
// ---------------------------------------------------------------------------
// The bit-name table (Task 1) -- loaded once, from the committed generated
// artifact, never re-derived from memmap.json at runtime.
// ---------------------------------------------------------------------------
let cachedTable;
function loadRegBits() {
    if (cachedTable)
        return cachedTable;
    const doc = JSON.parse(readFileSync(REGBITS_PATH, "utf8"));
    const { _generated, ...table } = doc;
    cachedTable = table;
    return cachedTable;
}
/** Test-only reset, so a test can install a synthetic table without this
 * module's cache surviving across cases. Not exported for production use. */
export function __resetRegBitsCacheForTests(table) {
    cachedTable = table;
}
export function registerKeyFor(address) {
    return `$${address.toString(16).toUpperCase().padStart(4, "0")}`;
}
/**
 * Decodes `value` against `register`'s fields (from the loaded bit-name
 * table), in ascending bit order, emitting one token per field:
 *   - a "numeric" field ALWAYS emits `NAME` concatenated with the decoded
 *     number (e.g. `YSCROLL` + `3` = `YSCROLL3`) -- total by construction,
 *     nothing to look up;
 *   - a "flag"/"enum" field emits its own `tokens[decoded]` string. This
 *     table's own fields (Task 1) give EVERY flag/enum field an EXPLICIT
 *     token for every value it can take -- including an explicit EMPTY
 *     STRING for a state that is silent by design (e.g. `$D011`'s ECM/RST8,
 *     silent when clear) -- so "no token defined" is a genuine data error,
 *     never an expected shape. When it happens anyway, this function
 *     REFUSES (throws), naming the register/field/value, rather than
 *     silently dropping the field: a dropped token could make two distinct
 *     register values decode to the identical name, which is exactly the
 *     property `anno-enum-gen.test.ts`'s 256-value check exists to catch.
 *   - an empty-string token contributes NOTHING to the joined name (it is
 *     filtered out before the final `_`-join) -- this is what makes the
 *     silent-by-design case above actually silent in the output.
 *
 * The measured target this function is pinned against:
 * `variantNameFor(0xd011, 0x1b) === "YSCROLL3_ROW25_SCREENON_TEXT"`.
 */
/** Looks up `register`'s bit-name table entry, or throws naming the register
 * and the remedy -- the ONE lookup+refusal both `variantNameFor()` and
 * `decomposeRegisterValue()` share, so the two can never disagree about
 * which registers are decodable at all. */
function requireRegBitsEntry(key, callerName) {
    const table = loadRegBits();
    const entry = table[key];
    if (!entry) {
        throw new Error(`${callerName}: no bit-name table entry for register ${key} -- anno-regbits.json has no fields ` +
            "for this address (add an OVERRIDES entry in anno-regbits-gen.mts, or exclude it from generation).");
    }
    return entry.fields;
}
/**
 * THE ONE MEMBERSHIP-TEST PREDICATE: answers "does
 * `anno-regbits.json` have an entry for this register at all", independent
 * of whether that entry, once found, can fully decompose any particular
 * value. `pairSearchRows()` above already narrows candidate `sta` targets
 * this same way (`knownRegisters.has(key)`, built from this table's own
 * keys) before ever treating one as a register; this export gives the two
 * render surfaces (`anno-export-asm.mts`, `anno-tools.mts`'s
 * `renderDisassembleListing()`) the identical membership check so a
 * register-SHAPED enum name for a register the table simply does not cover
 * (e.g. `D020`, `D021` -- confirmed absent from the curated table)
 * falls through to the plain single-symbol path instead of being attempted,
 * and failing, through `decomposeRegisterValue()`.
 *
 * `key` is the SAME `$`-prefixed shape `registerKeyFor()` produces and the
 * table's own keys use (e.g. `"$D011"`) -- callers holding only the bare
 * `regKey.slice(1)` enum name (e.g. `"D011"`) must prefix it with `$` before
 * calling this, exactly as `requireRegBitsEntry()`'s own callers already do
 * via `registerKeyFor()`.
 *
 * Deliberately NOT folded into `requireRegBitsEntry()`: that function's job
 * is "fetch or throw naming the remedy" for a caller that already believes
 * the register IS decodable; this function's job is "may I even ask" for a
 * caller that does not yet know. Collapsing them would force every
 * membership check to pay for (and catch) a thrown error it does not want.
 */
export function hasRegBitsEntry(key) {
    return loadRegBits()[key] !== undefined;
}
/**
 * Decodes ONE field of `register`'s value against `field` -- the single
 * decode step `variantNameFor()` and `decomposeRegisterValue()` BOTH walk in
 * the same ascending bit order (Task 1's own rule: "do not write a second
 * decode"). A numeric field ALWAYS returns a non-empty token (total by
 * construction). A flag/enum field's token is looked up in `field.tokens`;
 * an explicitly-silent state (empty string) is returned as `""`, never
 * treated as absent; a genuinely missing token throws, naming the register,
 * the field and the decoded value, exactly as before this extraction.
 */
function decodeField(key, field, value) {
    const decoded = (value & field.mask) >>> field.shift;
    if (field.kind === "numeric") {
        return { decoded, token: `${field.name}${decoded}` };
    }
    const token = field.tokens?.[decoded];
    if (token === undefined) {
        throw new Error(`variantNameFor: register ${key} field "${field.name}" (kind ${field.kind}) has no token for decoded ` +
            `value ${decoded} (full register value 0x${value.toString(16)}) -- refusing rather than silently ` +
            "dropping a field, which could make two distinct register values decode to the same name.");
    }
    return { decoded, token };
}
export function variantNameFor(register, value) {
    const key = registerKeyFor(register);
    const fields = requireRegBitsEntry(key, "variantNameFor");
    const tokens = [];
    for (const field of fields) {
        const { token } = decodeField(key, field, value);
        if (token !== "")
            tokens.push(token);
    }
    if (tokens.length === 0) {
        // Every field decoded to an explicitly-silent token (e.g. all eight
        // sprite-plane flags clear at once) -- the only way this can happen is a
        // register whose EVERY field is a flag/enum with a silent-by-design
        // state, at the one value where every field lands on that state. An
        // empty string is not a legal ACME identifier, so this is not "no
        // change needed", it is the single degenerate case this table's design
        // creates -- named explicitly (`V<value>`) rather than left empty. Since
        // a numeric field always emits a non-empty token, this fallback can only
        // ever fire for AT MOST one value per register (the all-fields-silent
        // one), so it can never collide with a genuine multi-token name.
        return `V${value}`;
    }
    return tokens.join("_");
}
/**
 * THE ONE OWNING DECODER: splits `value` into one named term per
 * bit-field of `register`, arithmetically exact. Both render surfaces
 * (`anno-export-asm.mts`'s OR-ed constants, and `anno_disassemble`'s
 * readable comment) consume THIS function rather than decoding
 * independently -- see this module's own header for why that is the whole
 * point.
 *
 * Rules, each pinned by a test in `anno-enum-gen.test.ts`:
 *   - Walks the SAME field loop, in the SAME ascending bit order, and the
 *     SAME per-field decode (`decodeField()` above) that `variantNameFor()`
 *     walks -- never a second decode.
 *   - A field whose token is the explicit empty string AND whose masked
 *     contribution is zero is OMITTED: it contributes nothing to the OR and
 *     nothing to the name (the silent-by-design case).
 *   - A field whose token is the empty string but whose masked contribution
 *     is NON-zero is a DATA ERROR in `anno-regbits.json`'s own OVERRIDES
 *     table -- refused by name, exactly like the missing-token case
 *     `decodeField()` already refuses.
 *   - After building the terms, the OR of every term's `value` MUST equal
 *     the input `value`. When it does not -- the table's fields do not cover
 *     every set bit of `value` -- this REFUSES, naming the register, the
 *     value and the uncovered bits in hex, with the remedy. Never emits a
 *     residual hex literal into the term list: a magic number in the OR
 *     expression is exactly what criterion 5 forbids.
 *   - The degenerate all-silent case (every field decodes to a silent
 *     token) returns the single `V<value>` term rather than an empty list,
 *     mirroring `variantNameFor()`'s own fallback so the two never disagree
 *     about what that value is called. This can only happen when `value`
 *     itself is `0` for a register whose fields fully cover the byte (every
 *     silent field's masked contribution is, by the rule above, zero) --
 *     the OR-reconstruction check above still runs FIRST, so a value this
 *     branch would otherwise mis-accept as "all silent" but that actually
 *     has uncovered bits is refused there instead, never silently treated
 *     as degenerate.
 */
export function decomposeRegisterValue(register, value) {
    const key = registerKeyFor(register);
    const fields = requireRegBitsEntry(key, "decomposeRegisterValue");
    const enumName = key.slice(1); // "$D011" -> "D011", the SAME prefix planEnumsForPairing() derives.
    const terms = [];
    const commentParts = [];
    let orAccumulator = 0;
    for (const field of fields) {
        const { decoded, token } = decodeField(key, field, value);
        const masked = value & field.mask;
        commentParts.push(`${field.name}=${decoded}`);
        if (token === "") {
            if (masked !== 0) {
                throw new Error(`decomposeRegisterValue: register ${key} field "${field.name}" decoded a NON-ZERO contribution ` +
                    `(0x${masked.toString(16)}) from an explicitly-silent token at decoded value ${decoded} (full register ` +
                    `value 0x${value.toString(16)}) -- a silent token must correspond to a zero masked contribution, or the ` +
                    "OR-reconstruction below would silently drop a real bit. This is a data error in anno-regbits.json's " +
                    "OVERRIDES table (anno-regbits-gen.mts), not a value this function can decompose.");
            }
            continue; // silent-by-design, zero contribution -- omitted from both the OR and the name.
        }
        terms.push({ name: `${enumName}_${token}`, value: masked, fieldName: field.name, decoded });
        orAccumulator |= masked;
    }
    if (orAccumulator !== value) {
        const uncovered = value & ~orAccumulator & 0xff;
        throw new Error(`decomposeRegisterValue: register ${key} value 0x${value.toString(16)} is not fully covered by its fields -- the ` +
            `OR of the decomposed terms is 0x${orAccumulator.toString(16)}, leaving bits 0x${uncovered.toString(16)} unaccounted ` +
            "for. Refusing to emit a lossy decomposition rather than a residual hex literal (add an OVERRIDES entry in " +
            "anno-regbits-gen.mts and regenerate anno-regbits.json).");
    }
    if (terms.length === 0) {
        // Every field decoded to an explicitly-silent, zero-contribution token --
        // the invariant check above already proved value === 0 in this branch
        // (orAccumulator is the OR of zeros), so this mirrors variantNameFor()'s
        // own V<value> fallback exactly, never disagreeing about what value 0
        // (or any all-silent value) is called.
        terms.push({ name: `${enumName}_V${value}`, value, fieldName: "", decoded: value });
    }
    // T-45-10's mitigation, run here rather than left to a downstream caller:
    // MEASURED against the real committed table (register $0001, "MOS 6510
    // Micro-Processor On-Chip I/O Port") that a numeric-leading `enumName`
    // (`registerKeyFor(1).slice(1)` is the all-digit string "0001") produces
    // an illegal ACME identifier for EVERY term of that register, regardless
    // of value -- `sanitizeVariantMap()` never catches this because it only
    // validates a bare variant name, never the enum-name prefix this
    // function's own OR-emission shape adds. Refusing here, before returning
    // anything, is the same client-side-before-I/O property
    // `sanitizeVariantMap()` already holds -- an illegal name provably never
    // reaches a render surface.
    for (const term of terms) {
        assertLegalAcmeIdentifier(term.name, `decomposeRegisterValue term for register ${key} value 0x${value.toString(16)}`);
    }
    return {
        terms,
        comment: `${key}: ${commentParts.join(", ")}`,
        multiField: fields.length >= 2,
    };
}
/** Parses an ACME-style immediate operand string (`"#$1b"`, `"#42"`,
 * `"#%00011011"`) into its numeric value. Throws on anything else, naming
 * the offending operand text -- never silently returns 0 for an
 * unparsable operand, which would misname a variant. */
export function parseImmediateOperand(operand) {
    if (!operand.startsWith("#")) {
        throw new Error(`parseImmediateOperand: "${operand}" is not an immediate operand (does not start with "#")`);
    }
    const body = operand.slice(1);
    let value;
    if (body.startsWith("$")) {
        value = Number.parseInt(body.slice(1), 16);
    }
    else if (body.startsWith("%")) {
        value = Number.parseInt(body.slice(1), 2);
    }
    else {
        value = Number.parseInt(body, 10);
    }
    if (!Number.isInteger(value) || Number.isNaN(value)) {
        throw new Error(`parseImmediateOperand: could not parse "${operand}" as a numeric immediate value`);
    }
    return value;
}
/** Normalises a store's operand text (`"$d011"`) into the same `$xxxx`
 * (uppercase, no padding assumptions beyond what the server itself emits)
 * shape used as this module's own register-lookup key, so the two never
 * silently fail to match on case alone. */
function normalizeOperandAsKey(operand) {
    if (!operand.startsWith("$"))
        return null;
    const hex = operand.slice(1);
    if (!/^[0-9a-fA-F]+$/.test(hex))
        return null;
    return `$${hex.toUpperCase().padStart(4, "0")}`;
}
/**
 * THE ADJACENT-PAIR RULE -- pure, and the reason this module survived
 * the cut when the fetch-and-install route was deleted. It was extracted
 * verbatim from the deleted two-pass fetch, which is now the CALLER's job:
 * hand it the `lda` rows and the `sta` rows and it pairs each store to a
 * register the bit-name table knows with an immediate load exactly 2 bytes
 * earlier.
 *
 * Adjacent-only, no dataflow: `lda #imm` is always 2 bytes in immediate mode,
 * so the following store begins at `ldaAddr + 2` regardless of the store's
 * own addressing mode. A store with no immediate load at exactly that address
 * is simply not paired -- "a miss costs nothing" is this rule's whole
 * posture, and what keeps it cheap enough to be worth having at all.
 *
 * The register narrowing is CLIENT-SIDE, against `anno-regbits.json`'s own
 * keys, never a second hardcoded list and never a producer-side query
 * (see the measured search-field fact in this module's header for why that
 * is not merely a preference).
 *
 * `maxResults` is the ceiling the caller asked its fetch for. A pass whose
 * row count EQUALS that ceiling is reported as possibly truncated -- this is
 * this module's "no silent caps" rule -- pass the same value the fetch used,
 * or the truncation signal is meaningless.
 */
export function pairSearchRows(ldaRows, staRows, maxResults = DEFAULT_MAX_RESULTS) {
    const table = loadRegBits();
    const knownRegisters = new Set(Object.keys(table));
    const pass1Truncated = ldaRows.length === maxResults;
    const pass2Truncated = staRows.length === maxResults;
    const immByAddr = new Map();
    for (const row of ldaRows) {
        if (!row.operand.startsWith("#"))
            continue; // not an immediate load
        try {
            immByAddr.set(row.address_decimal, parseImmediateOperand(row.operand));
        }
        catch {
            // An unparsable immediate operand is skipped (never paired), not fatal
            // to the whole pass -- "a miss costs nothing" is this module's posture.
        }
    }
    const knownStores = staRows.filter((row) => {
        const key = normalizeOperandAsKey(row.operand);
        return key !== null && knownRegisters.has(key);
    });
    const occurrences = [];
    for (const store of knownStores) {
        const regKey = normalizeOperandAsKey(store.operand);
        const ldaAddr = store.address_decimal - 2;
        const imm = immByAddr.get(ldaAddr);
        if (imm === undefined)
            continue; // adjacent-only -- a miss costs nothing
        occurrences.push({ regKey, value: imm, ldaAddr });
    }
    return {
        occurrences,
        totalRegisterStores: knownStores.length,
        pairedStores: occurrences.length,
        unpairedStores: knownStores.length - occurrences.length,
        pass1Truncated,
        pass2Truncated,
    };
}
// ---------------------------------------------------------------------------
// The enum PLAN and its wording contract. The installation
// route that consumed these was deleted; what a rebuilt one
// needs is all still here.
// ---------------------------------------------------------------------------
/** Formats a numeric value the way the retired producer's own
 * `EnumDefinition::parse_variants` accepted it (`$`-prefixed lowercase hex),
 * matching the measured example in this phase's own RESEARCH.md exactly.
 * Kept because it is the shape a variant KEY takes, and whoever rebuilds the
 * route needs to know what it was to decide whether to keep it. */
function formatVariantKey(value) {
    return `$${value.toString(16)}`;
}
/**
 * Builds the `{ "$1b": "YSCROLL3_..." }`-shaped variants object, calling
 * `assertLegalAcmeIdentifier` on every variant name FIRST.
 *
 * That ordering is the whole property, not an implementation detail: because
 * sanitization happens entirely client-side and before any I/O, a rejected
 * name provably never reaches a child process. The deleted installer proved
 * exactly that with a spy binary; any rebuilt installer inherits the property
 * by calling this function before it does any I/O of its own.
 */
export function sanitizeVariantMap(regKey, variants) {
    const out = {};
    for (const [value, name] of variants) {
        assertLegalAcmeIdentifier(name, `variant name for ${regKey} value 0x${value.toString(16)}`);
        out[formatVariantKey(value)] = name;
    }
    return out;
}
/**
 * THE GROUPING RULE, pure and route-free: group the paired occurrences by
 * register, keep ONE variant per DISTINCT value the program actually writes,
 * and name each with `variantNameFor()`.
 *
 * Never a full 256-values-per-register table. That is not an efficiency
 * choice: applying an enum emitted its WHOLE variant list into the exported
 * ACME header, so a table of 256 dead definitions is 256 lines of noise in
 * the output for every register touched. The measured fact is in this
 * module's header; this function is where the consequence lives.
 *
 * Extracted from the deleted `generateEnums()` pass with its
 * grouping and naming unchanged -- only the install calls that followed it
 * went.
 */
export function planEnumsForPairing(pairing) {
    // regKey -> value -> representative ldaAddr (first seen)
    const byRegister = new Map();
    const occurrencesByRegister = new Map();
    for (const occ of pairing.occurrences) {
        if (!byRegister.has(occ.regKey))
            byRegister.set(occ.regKey, new Map());
        if (!occurrencesByRegister.has(occ.regKey))
            occurrencesByRegister.set(occ.regKey, []);
        byRegister.get(occ.regKey).set(occ.value, occ.ldaAddr);
        occurrencesByRegister.get(occ.regKey).push(occ);
    }
    const planned = [];
    for (const [regKey, valuesToLdaAddr] of byRegister) {
        const address = Number.parseInt(regKey.slice(1), 16);
        const variants = new Map();
        for (const value of valuesToLdaAddr.keys()) {
            variants.set(value, variantNameFor(address, value));
        }
        planned.push({
            regKey,
            enumName: regKey.slice(1), // "$D011" -> "D011"
            variants,
            occurrences: occurrencesByRegister.get(regKey) ?? [],
        });
    }
    return planned;
}
/**
 * THE WORDING CONTRACT, pure and route-free: the coverage report that
 * names the totals, the pairing counts and -- in WORDS, never left to be
 * inferred from a row count that happens to equal a ceiling -- any pass that
 * may have been truncated.
 *
 * "No silent caps" is the whole point. A caller who reads
 * `pairedStores: 4000` off a run whose fetch ceiling was 4000 has no way to
 * know whether that is the answer or the ceiling; a line containing the word
 * "TRUNCATION" is the difference between a measurement and a guess.
 *
 * Extracted from the deleted `generateEnums()` pass with its
 * strings byte-identical, so a rebuilt pass reports in the same words rather
 * than paraphrasing them.
 */
export function buildEnumGenerationReport(pairing, enums, maxResults = DEFAULT_MAX_RESULTS) {
    const summaryLines = [
        `total register stores seen: ${pairing.totalRegisterStores}`,
        `paired (adjacent lda #imm found): ${pairing.pairedStores}`,
        `unpaired (no adjacent immediate load): ${pairing.unpairedStores}`,
    ];
    if (pairing.pass1Truncated) {
        summaryLines.push(`TRUNCATION WARNING: pass 1 (lda search) returned exactly max_results=${maxResults} rows -- coverage may be incomplete`);
    }
    if (pairing.pass2Truncated) {
        summaryLines.push(`TRUNCATION WARNING: pass 2 (sta search) returned exactly max_results=${maxResults} rows -- coverage may be incomplete`);
    }
    for (const e of enums) {
        summaryLines.push(`enum ${e.enumName}: ${e.action}, ${e.variantCount} variant(s), ${e.usagesApplied} usage(s) applied`);
    }
    return {
        totalRegisterStores: pairing.totalRegisterStores,
        pairedStores: pairing.pairedStores,
        unpairedStores: pairing.unpairedStores,
        pass1Truncated: pairing.pass1Truncated,
        pass2Truncated: pairing.pass2Truncated,
        enums: [...enums],
        summaryLines,
    };
}
const IMMEDIATE_LOAD_MNEMONICS = new Set(["lda", "ldx", "ldy"]);
const ABSOLUTE_STORE_MNEMONICS = new Set(["sta", "stx", "sty"]);
/** The slice of `image` covering `[start, endInclusive]`, or `null` when the
 * span is not entirely inside the image -- mirrors `anno-tools.mts`'s own
 * `sliceSpan()` bounds discipline (never a short slice, never a fabricated
 * byte for a range this image does not cover) without importing that
 * private function. */
function sliceImageRange(image, start, endInclusive) {
    const from = start - image.origin;
    const to = endInclusive - image.origin;
    if (from < 0 || to >= image.body.length || from > to)
        return null;
    return image.body.subarray(from, to + 1);
}
function searchRowAddress(instr) {
    return `$${instr.address.toString(16).toUpperCase().padStart(4, "0")}`;
}
function toSearchRow(instr, operand) {
    return { address: searchRowAddress(instr), address_decimal: instr.address, label: "", mnemonic: instr.mnemonic, operand, comment: "" };
}
/**
 * THE REBUILT FETCH. Walks `handle`'s own `code`-typed ranges,
 * decoding each through the SAME `disasm-decoder.mts` `decode()` function
 * `anno_disassemble` uses -- never a second decoder, never a regex over
 * rendered text. Returns two plain row arrays in the exact `DisasmSearchRow`
 * shape `pairSearchRows()` already consumes: pass 1, immediate loads
 * (`lda`/`ldx`/`ldy`); pass 2, absolute stores (`sta`/`stx`/`sty`) whose
 * target is a register `anno-regbits.json` knows.
 *
 * `maxResults` bounds EACH pass independently AS IT IS FETCHED, not merely
 * reported afterwards -- that is what makes `pairSearchRows()`'s own
 * truncation signal (a returned row count equal to the ceiling) a true
 * measurement rather than a coincidence: capping here is the only way a
 * caller comparing the returned length against the same ceiling can trust
 * what it sees ("no silent caps", stated at this module's top).
 */
export function fetchRegisterSearchRows(handle, image, opts = {}) {
    const maxResults = opts.maxResults ?? DEFAULT_MAX_RESULTS;
    const knownRegisters = new Set(Object.keys(loadRegBits()));
    const ldaRows = [];
    const staRows = [];
    for (const range of listRanges(handle)) {
        if (range.dataType !== "code")
            continue;
        const bytes = sliceImageRange(image, range.start, range.endInclusive);
        if (bytes === null)
            continue; // this image does not cover the range -- never fabricate bytes for it
        const instructions = decode(bytes, range.start, { end: range.endInclusive });
        for (const instr of instructions) {
            if (ldaRows.length < maxResults && instr.mode === "immediate" && instr.operand && IMMEDIATE_LOAD_MNEMONICS.has(instr.mnemonic)) {
                ldaRows.push(toSearchRow(instr, `#$${instr.operand.value.toString(16).padStart(2, "0")}`));
            }
            else if (staRows.length < maxResults && instr.mode === "absolute" && instr.operand && ABSOLUTE_STORE_MNEMONICS.has(instr.mnemonic)) {
                const key = registerKeyFor(instr.operand.value);
                if (knownRegisters.has(key)) {
                    staRows.push(toSearchRow(instr, `$${instr.operand.value.toString(16).padStart(4, "0")}`));
                }
            }
        }
    }
    return { ldaRows, staRows };
}
/**
 * THE REBUILT INSTALL: create-or-update each planned enum through the
 * shipped `createProjectEnum()`/`updateProjectEnum()` write path -- the SAME
 * functions `anno_create_project_enum`/`anno_update_project_enum` dispatch
 * to, never a second install path -- and bind every occurrence through
 * `applyEnumUsage()`, at the `lda` address (never the store address -- the
 * measured binding fact in this module's header). `sanitizeVariantMap()`
 * runs FIRST, before any I/O, so an illegal identifier provably never
 * reaches the store (the same client-side-first property the deleted
 * installer proved with a spy binary).
 *
 * CREATE-THEN-UPDATE, never a delete: `createProjectEnum()` no-ops on a
 * byte-identical repeat and THROWS `AnnoLabelError` when the same name
 * already holds DIFFERENT content -- caught here and retried through
 * `updateProjectEnum()`, which replaces the variant map wholesale. This is
 * `EnumInstallAction`'s own documented re-runnability precedent (see its
 * comment above); an installer that could only ever report "created" would
 * have quietly dropped that re-runnability property.
 */
export function installPlannedEnums(handle, planned) {
    const summaries = [];
    for (const plan of planned) {
        const sanitized = sanitizeVariantMap(plan.regKey, plan.variants);
        const description = `Generated by anno-enum-gen.mts from ${plan.occurrences.length} observed write(s) to ${plan.regKey}.`;
        let action;
        try {
            createProjectEnum(handle, { name: plan.enumName, variants: sanitized, description });
            action = "created";
        }
        catch (err) {
            if (!(err instanceof AnnoLabelError))
                throw err;
            updateProjectEnum(handle, { name: plan.enumName, variants: sanitized, description });
            action = "updated";
        }
        let usagesApplied = 0;
        for (const occ of plan.occurrences) {
            applyEnumUsage(handle, { address: occ.ldaAddr, name: plan.enumName });
            usagesApplied += 1;
        }
        summaries.push({ regKey: plan.regKey, enumName: plan.enumName, variantCount: plan.variants.size, action, usagesApplied });
    }
    return summaries;
}
/**
 * THE REBUILT PASS: fetch -> `pairSearchRows()` -> `planEnumsForPairing()`
 * -> `installPlannedEnums()` (which itself calls `sanitizeVariantMap()`) ->
 * `buildEnumGenerationReport()`. The three middle heuristics are called,
 * never edited, exactly per this module's own header specification.
 */
export function generateEnumsFromStore(handle, image, opts = {}) {
    const maxResults = opts.maxResults ?? DEFAULT_MAX_RESULTS;
    const { ldaRows, staRows } = fetchRegisterSearchRows(handle, image, { maxResults });
    const pairing = pairSearchRows(ldaRows, staRows, maxResults);
    const planned = planEnumsForPairing(pairing);
    const installed = installPlannedEnums(handle, planned);
    return buildEnumGenerationReport(pairing, installed, maxResults);
}
