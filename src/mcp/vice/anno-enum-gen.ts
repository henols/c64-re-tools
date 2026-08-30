#!/usr/bin/env node
// anno-enum-gen.ts -- the ONE authoritative place in this repo for value ->
// variant naming, the adjacent-pair rule, identifier sanitization, the
// per-register enum plan and the coverage report's wording contract
// (D-20/D-22/D-23, R2000-13).
//
// WHAT LEFT, WHAT STAYED, AND WHERE THE ROUTE RETURNS (plan 29-10, D-01,
// 2026-08-30). Read this paragraph before looking for a function that is not
// here.
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
//       whole D-22 naming vocabulary, untouched, still pinned by its
//       injectivity tests across all 256 values.
//     - `pairSearchRows()` -- the D-23 adjacent-pair rule (a store pairs with
//       an immediate load exactly 2 bytes earlier, adjacent-only, no
//       dataflow, a miss costs nothing), lifted out of the deleted fetch
//       loop verbatim and now a PURE function of two already-fetched row
//       arrays. Whoever rebuilds the fetch supplies the rows; the rule does
//       not change.
//     - `planEnumsForPairing()` -- D-20's own rule: one variant per DISTINCT
//       value the program actually writes, never a full
//       256-values-per-register table, with the first-seen `lda` address
//       kept as each value's representative binding site.
//     - `buildEnumGenerationReport()` -- D-23's "no silent caps" wording
//       contract, which states a possible truncation in WORDS rather than
//       leaving it to be inferred from a row count.
//     - `sanitizeVariantMap()` and the identifier gate it runs, unchanged.
//
//   WHERE THE ROUTE RETURNS: **NO PHASE CURRENTLY OWNS ITS RETURN**, and this
//   line used to say otherwise. It forecast a rebuild of the fetch and the
//   install over this project's own annotation store, rendering the enums into
//   the ACME export. The ACME export route itself did come back on 2026-08-31,
//   as the `anno export-asm` CLI verb -- but the work that rebuilt it covered
//   that route ONLY: no requirement and no success criterion of it mentioned
//   `gen-enums`, and no phase currently owns rebuilding it. The forecast was
//   therefore wrong, and it is CORRECTED here
//   rather than deleted, because deleting the notice would erase the record
//   that the capability went missing. Everything above is the specification
//   whoever eventually rebuilds it builds against.
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
//     definitions were still emitted. This is exactly why D-20 generates one
//     variant per value the program actually writes.
//   - Creating an enum FAILED with "Enum '<name>' already exists"
//     (`app_state.rs:443-457`'s `validate_new_enum_name`) if the name was
//     already taken -- there was no upsert. That is why `EnumInstallAction`
//     has two values and why R2000-13's re-runnability needed a documented
//     create-then-update precedence rather than a single call. A rebuilt
//     installer that cannot express "updated" has lost that requirement.
//   - The disassembly search matched its `query` regex against the
//     `mnemonic` and `operand` fields INDEPENDENTLY (`state/search.rs:
//     309-313`) -- they were NEVER concatenated into one searchable string.
//     A combined `"^sta \$(...)"`-shaped query therefore matched neither
//     field alone. The consequence that outlives it: the register and
//     immediate-mode narrowing belongs CLIENT-SIDE, against this project's
//     own curated register set derived from `anno-regbits.json`'s own keys,
//     which is what `pairSearchRows()` still does and what D-23 requires.
//   - That search's `max_results` server-side default was 50
//     (`handler.rs:1074-1077`), which is where D-23's "no silent caps" rule
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
//   - Never write a machine-global enum. The machine-wide config-dir save
//     route named in D-21 is never referenced anywhere in this file, and
//     `anno-enum-gen.test.ts`'s own zero-count grep asserts that
//     mechanically. That guard is DORMANT while this module has no install
//     route at all and goes live again the instant ANY install route is added
//     -- the condition is a route existing, not a phase arriving -- which is
//     exactly when it is needed, so it stays.
//   - Never call an install path with an unsanitized identifier.
//     `assertLegalAcmeIdentifier()` (defined in `anno-acme-ident.ts`,
//     re-exported here) runs on every variant name inside
//     `sanitizeVariantMap()`. Any rebuilt installer calls
//     `sanitizeVariantMap()` BEFORE it does any I/O, for the same reason the
//     deleted one did: sanitization is entirely client-side, so a rejected
//     name provably never reaches a child.
//   - Never re-derive the register set from a second hardcoded list. It comes
//     from `anno-regbits.json`'s own keys, via `loadRegBits()`, always.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { RegBitsField, RegBitsTable } from "./anno-regbits-gen.ts";
import { MAX_ACME_IDENTIFIER_LENGTH, assertLegalAcmeIdentifier } from "./anno-acme-ident.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REGBITS_PATH = join(HERE, "anno-regbits.json");

/** The ceiling a caller states instead of trusting a producer's own default
 * (which was 50, `handler.rs:1074-1077`). D-23's "no silent caps" rule: the
 * returned row count is compared against THIS value and a possible truncation
 * is reported in words. A rebuilt fetch passes it explicitly for the same
 * reason. */
export const DEFAULT_MAX_RESULTS = 10_000;

// MAX_ACME_IDENTIFIER_LENGTH / assertLegalAcmeIdentifier() live in
// anno-acme-ident.ts (plan 260821-a86, T-11-NAME-INJECT) -- that module is
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
export function variantNameFor(register: number, value: number): string {
  const table = loadRegBits();
  const key = registerKeyFor(register);
  const entry = table[key];
  if (!entry) {
    throw new Error(
      `variantNameFor: no bit-name table entry for register ${key} -- anno-regbits.json has no fields ` +
        "for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).",
    );
  }

  const tokens: string[] = [];
  for (const field of entry.fields as RegBitsField[]) {
    const decoded = (value & field.mask) >>> field.shift;
    if (field.kind === "numeric") {
      tokens.push(`${field.name}${decoded}`);
      continue;
    }
    const token = field.tokens?.[decoded];
    if (token === undefined) {
      throw new Error(
        `variantNameFor: register ${key} field "${field.name}" (kind ${field.kind}) has no token for decoded ` +
          `value ${decoded} (full register value 0x${value.toString(16)}) -- refusing rather than silently ` +
          "dropping a field, which could make two distinct register values decode to the same name.",
      );
    }
    if (token !== "") tokens.push(token);
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

// ---------------------------------------------------------------------------
// The two-pass search + adjacent-pair (D-23).
// ---------------------------------------------------------------------------

export interface DisasmSearchRow {
  address: string;
  address_decimal: number;
  label: string;
  mnemonic: string;
  operand: string;
  comment: string;
}

/** Parses an ACME-style immediate operand string (`"#$1b"`, `"#42"`,
 * `"#%00011011"`) into its numeric value. Throws on anything else, naming
 * the offending operand text -- never silently returns 0 for an
 * unparsable operand, which would misname a variant. */
export function parseImmediateOperand(operand: string): number {
  if (!operand.startsWith("#")) {
    throw new Error(`parseImmediateOperand: "${operand}" is not an immediate operand (does not start with "#")`);
  }
  const body = operand.slice(1);
  let value: number;
  if (body.startsWith("$")) {
    value = Number.parseInt(body.slice(1), 16);
  } else if (body.startsWith("%")) {
    value = Number.parseInt(body.slice(1), 2);
  } else {
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
function normalizeOperandAsKey(operand: string): string | null {
  if (!operand.startsWith("$")) return null;
  const hex = operand.slice(1);
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
  return `$${hex.toUpperCase().padStart(4, "0")}`;
}

export interface PairOccurrence {
  regKey: string;
  value: number;
  ldaAddr: number;
}

export interface PairingResult {
  occurrences: PairOccurrence[];
  totalRegisterStores: number;
  pairedStores: number;
  unpairedStores: number;
  pass1Truncated: boolean;
  pass2Truncated: boolean;
}

/**
 * THE D-23 ADJACENT-PAIR RULE -- pure, and the reason this module survived
 * the cut (plan 29-10). It was extracted verbatim from the deleted two-pass
 * fetch, which is now the CALLER's job: hand it the `lda` rows and the `sta`
 * rows and it pairs each store to a register the bit-name table knows with an
 * immediate load exactly 2 bytes earlier.
 *
 * Adjacent-only, no dataflow: `lda #imm` is always 2 bytes in immediate mode,
 * so the following store begins at `ldaAddr + 2` regardless of the store's
 * own addressing mode. A store with no immediate load at exactly that address
 * is simply not paired -- D-23's "a miss costs nothing" posture, which is
 * what keeps this rule cheap enough to be worth having at all.
 *
 * The register narrowing is CLIENT-SIDE, against `anno-regbits.json`'s own
 * keys, never a second hardcoded list and never a producer-side query
 * (see the measured search-field fact in this module's header for why that
 * is not merely a preference).
 *
 * `maxResults` is the ceiling the caller asked its fetch for. A pass whose
 * row count EQUALS that ceiling is reported as possibly truncated, per D-23's
 * "no silent caps" -- pass the same value the fetch used, or the truncation
 * signal is meaningless.
 */
export function pairSearchRows(
  ldaRows: readonly DisasmSearchRow[],
  staRows: readonly DisasmSearchRow[],
  maxResults: number = DEFAULT_MAX_RESULTS,
): PairingResult {
  const table = loadRegBits();
  const knownRegisters = new Set(Object.keys(table));

  const pass1Truncated = ldaRows.length === maxResults;
  const pass2Truncated = staRows.length === maxResults;

  const immByAddr = new Map<number, number>();
  for (const row of ldaRows) {
    if (!row.operand.startsWith("#")) continue; // not an immediate load
    try {
      immByAddr.set(row.address_decimal, parseImmediateOperand(row.operand));
    } catch {
      // An unparsable immediate operand is skipped (never paired), not fatal
      // to the whole pass -- D-23's "a miss costs nothing" posture.
    }
  }

  const knownStores = staRows.filter((row) => {
    const key = normalizeOperandAsKey(row.operand);
    return key !== null && knownRegisters.has(key);
  });

  const occurrences: PairOccurrence[] = [];
  for (const store of knownStores) {
    const regKey = normalizeOperandAsKey(store.operand)!;
    const ldaAddr = store.address_decimal - 2;
    const imm = immByAddr.get(ldaAddr);
    if (imm === undefined) continue; // D-23: adjacent-only -- a miss costs nothing
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
// The enum PLAN and its wording contract (D-20/D-21/D-23). The installation
// route that consumed these was deleted by plan 29-10; what a rebuilt one
// needs is all still here.
// ---------------------------------------------------------------------------

/** Formats a numeric value the way the retired producer's own
 * `EnumDefinition::parse_variants` accepted it (`$`-prefixed lowercase hex),
 * matching the measured example in this phase's own RESEARCH.md exactly.
 * Kept because it is the shape a variant KEY takes, and whoever rebuilds the
 * route needs to know what it was to decide whether to keep it. */
function formatVariantKey(value: number): string {
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
export function sanitizeVariantMap(regKey: string, variants: ReadonlyMap<number, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [value, name] of variants) {
    assertLegalAcmeIdentifier(name, `variant name for ${regKey} value 0x${value.toString(16)}`);
    out[formatVariantKey(value)] = name;
  }
  return out;
}

/**
 * The two outcomes a rebuilt installer must still be able to report.
 *
 * KEPT ACROSS THE CUT (plan 29-10) even though nothing in this repo installs
 * an enum today. Creating an enum whose name already existed FAILED outright
 * on the retired producer -- there was no upsert -- so R2000-13's
 * "re-runnable" requirement was met by a documented precedence: try CREATE
 * first, and only on an already-exists failure fall back to UPDATE, which
 * replaces the variant map wholesale. That precedence, and this two-valued
 * result, are the requirement's whole observable content. A rebuilt installer
 * that can only ever report "created" has quietly dropped R2000-13.
 */
export type EnumInstallAction = "created" | "updated";

export interface EnumInstallSummary {
  regKey: string;
  enumName: string;
  variantCount: number;
  action: EnumInstallAction;
  usagesApplied: number;
}

/** One register's worth of the plan: the enum name, the sanitized variant
 * map, and every paired occurrence whose `lda` address a usage must be bound
 * to (never the store address -- see the measured binding fact in this
 * module's header). */
export interface PlannedEnum {
  regKey: string;
  enumName: string;
  /** value -> variant name, one entry per DISTINCT value observed (D-20). */
  variants: Map<number, string>;
  occurrences: PairOccurrence[];
}

/**
 * D-20's OWN RULE, pure and route-free: group the paired occurrences by
 * register, keep ONE variant per DISTINCT value the program actually writes,
 * and name each with `variantNameFor()`.
 *
 * Never a full 256-values-per-register table. That is not an efficiency
 * choice: applying an enum emitted its WHOLE variant list into the exported
 * ACME header, so a table of 256 dead definitions is 256 lines of noise in
 * the output for every register touched. The measured fact is in this
 * module's header; this function is where the consequence lives.
 *
 * Extracted from the deleted `generateEnums()` pass by plan 29-10 with its
 * grouping and naming unchanged -- only the install calls that followed it
 * went.
 */
export function planEnumsForPairing(pairing: PairingResult): PlannedEnum[] {
  // regKey -> value -> representative ldaAddr (first seen)
  const byRegister = new Map<string, Map<number, number>>();
  const occurrencesByRegister = new Map<string, PairOccurrence[]>();
  for (const occ of pairing.occurrences) {
    if (!byRegister.has(occ.regKey)) byRegister.set(occ.regKey, new Map());
    if (!occurrencesByRegister.has(occ.regKey)) occurrencesByRegister.set(occ.regKey, []);
    byRegister.get(occ.regKey)!.set(occ.value, occ.ldaAddr);
    occurrencesByRegister.get(occ.regKey)!.push(occ);
  }

  const planned: PlannedEnum[] = [];
  for (const [regKey, valuesToLdaAddr] of byRegister) {
    const address = Number.parseInt(regKey.slice(1), 16);
    const variants = new Map<number, string>();
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

export interface EnumGenerationReport {
  totalRegisterStores: number;
  pairedStores: number;
  unpairedStores: number;
  pass1Truncated: boolean;
  pass2Truncated: boolean;
  enums: EnumInstallSummary[];
  /** Human-readable summary lines, always including the word "truncat..." if
   * either pass hit its own `max_results` ceiling (D-23: "no silent caps" --
   * a possible truncation is stated in words, never left to be inferred). */
  summaryLines: string[];
}

/**
 * D-23's WORDING CONTRACT, pure and route-free: the coverage report that
 * names the totals, the pairing counts and -- in WORDS, never left to be
 * inferred from a row count that happens to equal a ceiling -- any pass that
 * may have been truncated.
 *
 * "No silent caps" is the whole point. A caller who reads
 * `pairedStores: 4000` off a run whose fetch ceiling was 4000 has no way to
 * know whether that is the answer or the ceiling; a line containing the word
 * "TRUNCATION" is the difference between a measurement and a guess.
 *
 * Extracted from the deleted `generateEnums()` pass by plan 29-10 with its
 * strings byte-identical, so a rebuilt pass reports in the same words rather
 * than paraphrasing them.
 */
export function buildEnumGenerationReport(
  pairing: PairingResult,
  enums: readonly EnumInstallSummary[],
  maxResults: number = DEFAULT_MAX_RESULTS,
): EnumGenerationReport {
  const summaryLines: string[] = [
    `total register stores seen: ${pairing.totalRegisterStores}`,
    `paired (adjacent lda #imm found): ${pairing.pairedStores}`,
    `unpaired (no adjacent immediate load): ${pairing.unpairedStores}`,
  ];
  if (pairing.pass1Truncated) {
    summaryLines.push(
      `TRUNCATION WARNING: pass 1 (lda search) returned exactly max_results=${maxResults} rows -- coverage may be incomplete`,
    );
  }
  if (pairing.pass2Truncated) {
    summaryLines.push(
      `TRUNCATION WARNING: pass 2 (sta search) returned exactly max_results=${maxResults} rows -- coverage may be incomplete`,
    );
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

