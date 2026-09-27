#!/usr/bin/env node
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

import type { RegBitsField, RegBitsTable } from "./anno-regbits-gen.mts";
import { MAX_ACME_IDENTIFIER_LENGTH, assertLegalAcmeIdentifier } from "./anno-acme-ident.mts";

const HERE = dirname(fileURLToPath(import.meta.url));
// Beside this module (the package root), else one directory up (the
// compiled dist/ copy, one level below the package root).
const REGBITS_PATH = [join(HERE, "anno-regbits.json"), join(HERE, "..", "anno-regbits.json")].find((c) => existsSync(c)) ?? join(HERE, "anno-regbits.json");

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

let cachedTable: RegBitsTable | undefined;

function loadRegBits(): RegBitsTable {
  if (cachedTable) return cachedTable;
  const doc = JSON.parse(readFileSync(REGBITS_PATH, "utf8")) as Record<string, unknown>;
  const { _generated, ...table } = doc;
  cachedTable = table as unknown as RegBitsTable;
  return cachedTable;
}

/** Test-only reset, so a test can install a synthetic table without this
 * module's cache surviving across cases. Not exported for production use. */
export function __resetRegBitsCacheForTests(table?: RegBitsTable): void {
  cachedTable = table;
}

export function registerKeyFor(address: number): string {
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
function requireRegBitsEntry(key: string, callerName: string): RegBitsField[] {
  const table = loadRegBits();
  const entry = table[key];
  if (!entry) {
    throw new Error(
      `${callerName}: no bit-name table entry for register ${key} -- anno-regbits.json has no fields ` +
        "for this address (add an OVERRIDES entry in anno-regbits-gen.mts, or exclude it from generation).",
    );
  }
  return entry.fields as RegBitsField[];
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
export function hasRegBitsEntry(key: string): boolean {
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
function decodeField(key: string, field: RegBitsField, value: number): { decoded: number; token: string } {
  const decoded = (value & field.mask) >>> field.shift;
  if (field.kind === "numeric") {
    return { decoded, token: `${field.name}${decoded}` };
  }
  const token = field.tokens?.[decoded];
  if (token === undefined) {
    throw new Error(
      `decodeField: register ${key} field "${field.name}" (kind ${field.kind}) has no token for decoded ` +
        `value ${decoded} (full register value 0x${value.toString(16)}) -- refusing rather than silently ` +
        "dropping a field, which could make two distinct register values decode to the same name.",
    );
  }
  return { decoded, token };
}

// ---------------------------------------------------------------------------
// The ONE owning multi-bit decoder. `variantNameFor()`
// above already decodes a value into per-field tokens and joins them with
// `_` into ONE total name; this is that SAME token list, unjoined, each term
// carrying its own masked value -- so the OR-ed decomposition and the
// whole-value enum member are provably one vocabulary, never two.
// ---------------------------------------------------------------------------

/** One named, OR-able term of a decomposed register write. `name` is the
 * emitted ACME identifier (`<enumName>_<field token>`, the same
 * `regKey.slice(1)` prefix `planEnumsForPairing()` already uses for its own
 * `enumName`). `value` is this term's own masked contribution
 * (`value & field.mask`) -- the bitwise OR of every term's `value` in a
 * `RegisterDecomposition` reconstructs the original byte exactly, or
 * `decomposeRegisterValue()` refuses rather than return the lossy result. */
export interface RegisterTerm {
  name: string;
  value: number;
  fieldName: string;
  decoded: number;
}

/** The full decomposition of one register write. `comment` is the
 * mechanical decode text (`<REGKEY>: <FIELD>=<decoded>`, comma-separated, in
 * ascending bit order) -- the readability half; `terms` is the OR-able
 * half. `multiField` is true when the register's own table entry has two or
 * more fields, regardless of how many terms a particular value happened to
 * produce (a single-field register, or a value that silenced every
 * flag/enum field but one, is not "multi-bit" in the sense this module
 * cares about). */
export interface RegisterDecomposition {
  terms: RegisterTerm[];
  comment: string;
  multiField: boolean;
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
export function decomposeRegisterValue(register: number, value: number): RegisterDecomposition {
  const key = registerKeyFor(register);
  const fields = requireRegBitsEntry(key, "decomposeRegisterValue");
  const enumName = key.slice(1); // "$D011" -> "D011", the enum name prefix.

  const terms: RegisterTerm[] = [];
  const commentParts: string[] = [];
  let orAccumulator = 0;

  for (const field of fields) {
    const { decoded, token } = decodeField(key, field, value);
    const masked = value & field.mask;
    commentParts.push(`${field.name}=${decoded}`);

    if (token === "") {
      if (masked !== 0) {
        throw new Error(
          `decomposeRegisterValue: register ${key} field "${field.name}" decoded a NON-ZERO contribution ` +
            `(0x${masked.toString(16)}) from an explicitly-silent token at decoded value ${decoded} (full register ` +
            `value 0x${value.toString(16)}) -- a silent token must correspond to a zero masked contribution, or the ` +
            "OR-reconstruction below would silently drop a real bit. This is a data error in anno-regbits.json's " +
            "OVERRIDES table (anno-regbits-gen.mts), not a value this function can decompose.",
        );
      }
      continue; // silent-by-design, zero contribution -- omitted from both the OR and the name.
    }

    terms.push({ name: `${enumName}_${token}`, value: masked, fieldName: field.name, decoded });
    orAccumulator |= masked;
  }

  if (orAccumulator !== value) {
    const uncovered = value & ~orAccumulator & 0xff;
    throw new Error(
      `decomposeRegisterValue: register ${key} value 0x${value.toString(16)} is not fully covered by its fields -- the ` +
        `OR of the decomposed terms is 0x${orAccumulator.toString(16)}, leaving bits 0x${uncovered.toString(16)} unaccounted ` +
        "for. Refusing to emit a lossy decomposition rather than a residual hex literal (add an OVERRIDES entry in " +
        "anno-regbits-gen.mts and regenerate anno-regbits.json).",
    );
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

// ---------------------------------------------------------------------------
// The two-pass search + adjacent-pair.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// The enum PLAN and its wording contract. The installation
// route that consumed these was deleted; what a rebuilt one
// needs is all still here.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// THE REBUILT FETCH AND INSTALL, over this project's own
// disassembler and store. Everything above this line is a surviving
// heuristic, called here but never edited (`variantNameFor()`,
// `pairSearchRows()`, `planEnumsForPairing()`, `sanitizeVariantMap()`,
// `buildEnumGenerationReport()`).
// ---------------------------------------------------------------------------

