#!/usr/bin/env node
// r2000-enum-gen.ts -- the ONE authoritative place in this repo for value ->
// variant naming, the adjacent-pair pass, identifier sanitization, enum
// installation and the coverage report (D-20/D-22/D-23, R2000-13, criterion
// 3 -- the phase's most distinctive deliverable: neither this project nor
// regenerator2000 can produce it alone).
//
// MEASURED MECHANISM FACTS (all confirmed by direct live calls against a
// real regenerator2000 0.9.20 child on this host, not merely paraphrased
// from RESEARCH.md):
//   - `EnumDefinition.variants` is a flat `BTreeMap<u16, String>` -- a plain
//     value-to-name map. There is NO bit-OR composition anywhere in 0.9.20.
//   - `r2000_apply_enum_usage` binds to the INSTRUCTION ADDRESS holding the
//     immediate operand (the `lda`, never the `sta`) -- confirmed both by
//     direct call and by `handler.rs:1236-1264`'s own description text.
//   - Applying an enum emits its WHOLE variant list into the exported ACME
//     header; an unmatched value falls back to bare `#$xx` while the dead
//     definitions are still emitted. This is exactly why D-20 generates one
//     variant per value the program actually writes, never a full
//     256-values-per-register table.
//   - `r2000_create_project_enum` FAILS with "Enum '<name>' already exists"
//     (`app_state.rs:443-457`'s `validate_new_enum_name`) if the name is
//     already taken -- there is no upsert. This module's own precedence
//     (documented at `createOrUpdateEnum()` below): try create first, and
//     ONLY on an "already exists" failure fall back to
//     `r2000_update_project_enum`, which replaces the variant map wholesale
//     (R2000-13's own "re-runnable" requirement).
//   - `r2000_search_disassembly` matches its `query` regex against the
//     `mnemonic` and `operand` fields INDEPENDENTLY (`state/search.rs:
//     309-313`, `text_matches(&line.mnemonic, ...)` OR
//     `text_matches(&line.operand, ...)`) -- they are NEVER concatenated
//     into one searchable string. This corrects RESEARCH.md's own Pattern 2
//     code example, which assumed a combined `"^sta \$(...)"`-shaped query
//     would match a "mnemonic + operand" string; measured live, it does not
//     (a query is applied to `mnemonic` OR `operand`, so a combined pattern
//     never matches either field alone). This module instead queries the
//     MNEMONIC exactly (`"^lda$"` / `"^sta$"`, case-insensitive per the
//     server's own `(?i)` prefix) and does the register/immediate-mode
//     narrowing CLIENT-SIDE against this project's own curated register set
//     -- still derived from `r2000-regbits.json`'s own keys, never a second
//     hardcoded list, exactly as D-23 requires; only the MECHANISM by which
//     that narrowing happens changed from "one combined regex" to "two exact
//     mnemonic queries plus a client-side operand filter".
//   - `r2000_search_disassembly`'s `max_results` server-side default is 50
//     (`handler.rs:1074-1077`) -- always pass an explicit value on this
//     surface (D-23's "no silent caps": the returned count is compared
//     against the requested ceiling and a truncation signal is reported in
//     words, never left to be inferred).
//
// WHAT NOT TO DO, named concretely:
//   - Never assert criterion 3 against `r2000_search_disassembly`'s own
//     rendered operand text. Measured discrepancy (RESEARCH.md, confirmed
//     unchanged this session): the live query view renders an applied enum
//     reference as `EnumName.VARIANT` (a dot), while the ACME export
//     (`--export_asm`) renders `EnumName_VARIANT` (an underscore) -- exactly
//     what criterion 3's own wording quotes. This finding is VERSION-SCOPED
//     to regenerator2000 0.9.20 (RESEARCH.md Assumption A2) -- re-verify
//     against `--export_asm` at execution time rather than trusting it as
//     permanent; Task 3's acceptance test records what it observes on this
//     run rather than assuming the historical finding still holds.
//   - Never omit `max_results` on a `r2000_search_disassembly` call in this
//     module. Every call site below passes it explicitly.
//   - Never call `r2000_create_project_enum` (or `_update_`) with an
//     unsanitized identifier. `assertLegalAcmeIdentifier()` (now defined in
//     `r2000-acme-ident.ts`, re-exported here) runs on the enum name AND
//     every variant name inside `sanitizeVariantMap()`, which is called
//     BEFORE `createOrUpdateEnum()` ever reaches `runR2000Tool()` -- proven
//     zero-spawn in `r2000-enum-gen.test.ts` via a spy binary.
//   - Never write a machine-global enum. Every call in this module goes
//     through `runR2000Tool()` (`r2000-tools.ts`, plan 11-05), which only
//     knows `r2000_create_project_enum`/`r2000_update_project_enum` -- the
//     machine-wide config-dir save route named in D-21 is never referenced
//     anywhere in this file (asserted mechanically by
//     `r2000-enum-gen.test.ts`'s own zero-count grep).
//   - Never call `r2000-mcp-client.ts` directly. Every child interaction in
//     this module goes through `r2000-tools.ts`'s `runR2000Tool()`, so the
//     curated allow-list gate and the per-call auto-save both apply for
//     free, exactly as plan 11-05's own "Next Phase Readiness" note
//     instructs.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runR2000Tool } from "./r2000-tools.ts";
import type { RegBitsField, RegBitsTable } from "./r2000-regbits-gen.ts";
import { MAX_ACME_IDENTIFIER_LENGTH, assertLegalAcmeIdentifier } from "./r2000-acme-ident.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REGBITS_PATH = join(HERE, "r2000-regbits.json");

/** The server-side default (`handler.rs:1074-1077`) this surface's own
 * `runR2000Tool()` wrapper REQUIRES an explicit override for -- named here
 * so every call site in this module states its ceiling instead of trusting
 * the child's own default. */
export const DEFAULT_MAX_RESULTS = 10_000;

// MAX_ACME_IDENTIFIER_LENGTH / assertLegalAcmeIdentifier() now live in
// r2000-acme-ident.ts (plan 260821-a86, T-11-NAME-INJECT) -- that module is
// the ONE authoritative place for the ACME identifier policy, consumed by
// THIS file's createOrUpdateEnum()/sanitizeVariantMap() below plus two more
// entry routes (r2000-tools.ts's r2000_set_label_name, r2000-symbols.ts's
// importLabels()) that could not import it from here without forming a
// cycle (this file statically imports runR2000Tool FROM r2000-tools.ts).
// Re-exported here (imported above) so this file's own existing
// consumers/tests keep their current import path.
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
 *     property `r2000-enum-gen.test.ts`'s 256-value check exists to catch.
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
      `variantNameFor: no bit-name table entry for register ${key} -- r2000-regbits.json has no fields ` +
        "for this address (add an OVERRIDES entry in r2000-regbits-gen.ts, or exclude it from generation).",
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

/** Parses one `r2000_search_disassembly` `ToolCallResult` into its rows,
 * throwing (naming `what`) on a reported `isError` or an unparsable body --
 * never silently treating either as "no rows". */
async function parseSearchRows(
  resultPromise: ReturnType<typeof runR2000Tool>,
  what: string,
): Promise<DisasmSearchRow[]> {
  const result = await resultPromise;
  const text = result.content.map((c) => c.text).join("");
  if (result.isError) {
    throw new Error(`${what} failed: ${text}`);
  }
  let rows: unknown;
  try {
    rows = JSON.parse(text);
  } catch (err) {
    throw new Error(`${what}: could not parse response as JSON (${err instanceof Error ? err.message : String(err)}): ${text}`);
  }
  if (!Array.isArray(rows)) {
    throw new Error(`${what}: expected an array of rows, got ${typeof rows}`);
  }
  return rows as DisasmSearchRow[];
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
 * Runs the two-pass search (all `lda` instructions, all `sta` instructions --
 * queried by EXACT mnemonic match, per this module's own measured correction
 * to RESEARCH.md's combined-regex assumption, see header comment) and pairs
 * each store to a register this module's bit-name table knows with an
 * immediate load exactly 2 bytes earlier (D-23: adjacent-only, no
 * dataflow -- `lda #imm` is always 2 bytes in immediate mode, so the
 * following store begins at `ldaAddr + 2` regardless of the store's own
 * addressing mode).
 */
export async function pairImmediateLoadsToStores(
  projectPath: string,
  maxResults: number = DEFAULT_MAX_RESULTS,
): Promise<PairingResult> {
  const table = loadRegBits();
  const knownRegisters = new Set(Object.keys(table));

  const ldaRows = await parseSearchRows(
    runR2000Tool("r2000_search_disassembly", {
      project: projectPath,
      query: "^lda$",
      use_regex: true,
      max_results: maxResults,
      search_labels: false,
      search_comments: false,
      search_instructions: true,
    }),
    "r2000_search_disassembly (pass 1: lda)",
  );
  const pass1Truncated = ldaRows.length === maxResults;

  const staRows = await parseSearchRows(
    runR2000Tool("r2000_search_disassembly", {
      project: projectPath,
      query: "^sta$",
      use_regex: true,
      max_results: maxResults,
      search_labels: false,
      search_comments: false,
      search_instructions: true,
    }),
    "r2000_search_disassembly (pass 2: sta)",
  );
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
// Enum installation (D-20/D-21/D-33-adjacent: only through runR2000Tool()).
// ---------------------------------------------------------------------------

/** Formats a numeric value the way `r2000_create_project_enum`'s own
 * `EnumDefinition::parse_variants` accepts (`$`-prefixed lowercase hex),
 * matching the measured example in this phase's own RESEARCH.md exactly. */
function formatVariantKey(value: number): string {
  return `$${value.toString(16)}`;
}

/**
 * Builds the `{ "$1b": "YSCROLL3_..." }`-shaped variants object for
 * `r2000_create_project_enum`/`_update_`, calling `assertLegalAcmeIdentifier`
 * on every variant name FIRST -- this is the whole reason
 * `createOrUpdateEnum()` below can prove zero child spawns for a rejected
 * name: sanitization happens entirely client-side, before any I/O.
 */
export function sanitizeVariantMap(regKey: string, variants: ReadonlyMap<number, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [value, name] of variants) {
    assertLegalAcmeIdentifier(name, `variant name for ${regKey} value 0x${value.toString(16)}`);
    out[formatVariantKey(value)] = name;
  }
  return out;
}

export type EnumInstallAction = "created" | "updated";

/**
 * Creates (or, on an "already exists" failure, updates) the project-level
 * enum named after `regKey` (e.g. `$D011` -> enum name `D011`) with
 * `variants`. Precedence, decided and documented here: CREATE is tried
 * first; only when regenerator2000 itself reports the name already exists
 * (`validate_new_enum_name`'s own message, `app_state.rs:455`) does this
 * function fall back to UPDATE, which replaces the variant map wholesale --
 * this is what makes a re-run of `generateEnums()` idempotent (R2000-13's
 * "re-runnable" requirement) rather than failing on every run after the
 * first.
 *
 * `assertLegalAcmeIdentifier` runs on the enum name and (via
 * `sanitizeVariantMap`) every variant name BEFORE either child call --
 * proven zero-spawn in `r2000-enum-gen.test.ts` via a spy binary.
 */
export async function createOrUpdateEnum(
  projectPath: string,
  regKey: string,
  variants: ReadonlyMap<number, string>,
): Promise<EnumInstallAction> {
  const enumName = regKey.slice(1); // "$D011" -> "D011"
  assertLegalAcmeIdentifier(enumName, `enum name for ${regKey}`);
  const variantsObj = sanitizeVariantMap(regKey, variants);

  const createResult = await runR2000Tool("r2000_create_project_enum", {
    project: projectPath,
    name: enumName,
    variants: variantsObj,
  });
  if (!createResult.isError) return "created";

  const createText = createResult.content.map((c) => c.text).join(" ");
  if (!/already exists/i.test(createText)) {
    throw new Error(`r2000_create_project_enum failed for "${enumName}": ${createText}`);
  }

  const updateResult = await runR2000Tool("r2000_update_project_enum", {
    project: projectPath,
    name: enumName,
    variants: variantsObj,
  });
  if (updateResult.isError) {
    throw new Error(
      `r2000_update_project_enum failed for "${enumName}" (after create reported already-exists): ` +
        `${updateResult.content.map((c) => c.text).join(" ")}`,
    );
  }
  return "updated";
}

async function applyUsage(projectPath: string, address: number, enumName: string): Promise<void> {
  const result = await runR2000Tool("r2000_apply_enum_usage", {
    project: projectPath,
    address,
    name: enumName,
  });
  if (result.isError) {
    throw new Error(
      `r2000_apply_enum_usage failed at address ${address} for enum "${enumName}": ` +
        `${result.content.map((c) => c.text).join(" ")}`,
    );
  }
}

// ---------------------------------------------------------------------------
// generateEnums() -- the whole pass, and its coverage report.
// ---------------------------------------------------------------------------

export interface EnumInstallSummary {
  regKey: string;
  enumName: string;
  variantCount: number;
  action: EnumInstallAction;
  usagesApplied: number;
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

export interface GenerateEnumsOptions {
  projectPath: string;
  maxResults?: number;
}

/**
 * The whole D-20/D-22/D-23 pass: two exact-mnemonic searches (explicit
 * `max_results`, never the server's own 50-row default), adjacent-only
 * pairing, one variant per DISTINCT value observed per register (D-20),
 * create-or-update per register (this module's own documented precedence),
 * apply-usage at every paired `lda` address (never the store address --
 * measured, `handler.rs:1236-1264`), and a coverage report naming totals,
 * pairing counts and any possible truncation explicitly.
 *
 * Persistence: every mutating call here goes through `runR2000Tool()`
 * (`r2000-tools.ts`), whose own per-call auto-save (D-17) already persists
 * each create/update/apply the instant its own session closes -- see that
 * module's header for why a SECOND, standalone `r2000_save_project` call
 * after a sequence of already-auto-saving calls is not issued here: it would
 * only ever observe an unchanged hash (nothing pending) and report a
 * spurious `R2000SaveNotPersistedError`, which `r2000-tools.ts`'s own header
 * documents as the expected (not buggy) shape of that specific call
 * sequence. Persistence itself is independently proven at the ACME EXPORT
 * layer (Task 3), not re-asserted here.
 */
export async function generateEnums({ projectPath, maxResults = DEFAULT_MAX_RESULTS }: GenerateEnumsOptions): Promise<EnumGenerationReport> {
  const pairing = await pairImmediateLoadsToStores(projectPath, maxResults);

  const byRegister = new Map<string, Map<number, number>>(); // regKey -> value -> representative ldaAddr (first seen)
  const occurrencesByRegister = new Map<string, PairOccurrence[]>();
  for (const occ of pairing.occurrences) {
    if (!byRegister.has(occ.regKey)) byRegister.set(occ.regKey, new Map());
    if (!occurrencesByRegister.has(occ.regKey)) occurrencesByRegister.set(occ.regKey, []);
    byRegister.get(occ.regKey)!.set(occ.value, occ.ldaAddr);
    occurrencesByRegister.get(occ.regKey)!.push(occ);
  }

  const enums: EnumInstallSummary[] = [];
  for (const [regKey, valuesToLdaAddr] of byRegister) {
    const address = Number.parseInt(regKey.slice(1), 16);
    const variants = new Map<number, string>();
    for (const value of valuesToLdaAddr.keys()) {
      variants.set(value, variantNameFor(address, value));
    }

    const action = await createOrUpdateEnum(projectPath, regKey, variants);

    const occurrences = occurrencesByRegister.get(regKey) ?? [];
    for (const occ of occurrences) {
      const enumName = regKey.slice(1);
      await applyUsage(projectPath, occ.ldaAddr, enumName);
    }

    enums.push({
      regKey,
      enumName: regKey.slice(1),
      variantCount: variants.size,
      action,
      usagesApplied: occurrences.length,
    });
  }

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
    enums,
    summaryLines,
  };
}
