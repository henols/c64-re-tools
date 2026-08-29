#!/usr/bin/env node
// anno-cli.ts -- the thin CLI ergonomics layer over the annotation store
// (D-06). Reached as `vice-mcp r2000 <verb>` because that bin is the only
// surface that resolves identically across the Claude Code plugin route and
// both npm-installer routes: `installer/bin/cli.mjs`'s `viceServerEntry()`
// always launches this server via `npx` in BOTH npm-installer modes, and
// neither route places `src/mcp/vice/*.ts` as plain files inside a
// consuming project for some other filesystem-path-resolving design to find.
//
// ---------------------------------------------------------------------------
// TWO VERBS. THAT IS THE WHOLE SURFACE (D-14, 2026-08-29).
// ---------------------------------------------------------------------------
// This file used to carry eight. Six were removed in one commit because they
// were delivery paths for the retired external analyser this project used to
// rent an annotation store from: three drove its child process directly and
// three reached it through capability modules that did. Removing the analyser
// without removing them would have left six verbs that typecheck, dispatch,
// and then fail at the first call.
//
// What went, and where it went:
//   - `bootstrap`, `export-asm`, `verify` -- the analyser's own routes. The
//     export/reassembly route returns with the ACME oracle, rebuilt over the
//     store rather than resurrected.
//   - `gen-enums`, `export-lbl`, `import-lbl` -- the enum generator and the
//     VICE-label round trip. Same fate, same route: they come back as
//     rebuilds over the store, not as restored code. Until then the symbol
//     round trip has NO route at all, which is recorded as a withdrawal in
//     `.planning/PROJECT.md`'s shipped-capability list rather than left for a
//     reader to discover by running it.
//
// WHAT NOT TO DO, named concretely:
//   - Never auto-pick an input when the caller does not name one (D-02). A
//     silent auto-pick would happily analyse a cracktro or loader stub's
//     bytes instead of the actual game -- precisely the failure
//     `c64-provenance-diff` exists to prevent elsewhere in this project.
//     Both surviving verbs take an EXISTING project and refuse rather than
//     guess: `render-memmap` demands its provenance sidecar by name, and
//     `coverage` demands its annotation store by name. Neither derives the
//     other's path from the one it was given.
//   - Never grow a second path validator. Every caller-supplied path below
//     goes through `storePathWithinWorkspace()` -- the ONE confinement seam,
//     the same one `anno-tools.ts` puts its store and image arguments
//     through. A second answer to "is this path inside the workspace" is a
//     confinement escape waiting to be written.
//
// `runR2000Cli()` returns an exit code and never terminates the process
// itself, so it is testable in-process as well as from the bin (the bin,
// `vice-proxy.ts`, is the only place that ends the process with this
// function's return value). All output goes to stdout/stderr via
// `console.log`/`console.error` -- never a thrown stack trace for an
// expected, user-facing failure (missing file, unreadable store, refused
// overwrite): each of those produces a single actionable line instead.
//
// Import nothing from `hostpath.ts` or `containerpath.ts`. Every path this
// CLI handles is already container-side, and translating any of these
// arguments would be the mirror image of the DERIV-07 screenshot-path trap,
// where a client-side-derived path was wrongly translated a second time.
// This absence is asserted structurally by `hostpath-consumers.test.ts`
// (D-08), not merely stated here.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { renderMemoryMap, checkRenderedMemoryMap } from "./anno-memmap-render.ts";
// The coverage instrument (COV-01/COV-02). It declares its own input shapes
// and never reads a store, a file or a tool on its own behalf -- a caller
// fetches and hands the data in, which is exactly what makes the store
// re-point below a CALLER-side change and nothing more.
import { buildCoverageReport, coverageFindings } from "./anno-coverage.ts";
import type { CoverageReport, R2000Comment, R2000CrossReference, R2000Symbol } from "./anno-coverage.ts";
// The store's block-entry shape comes from the boundary that owns its
// vocabulary, not from the census -- see `block-class.ts`.
import type { BlockEntry } from "./block-class.ts";
import { openStore, closeStore, listLabels, listComments, listRanges } from "./anno-store.ts";
import type { AnnoStoreHandle } from "./anno-store.ts";
// The derived half of STORE-06: cross-references are DERIVED from the bytes
// plus the store's typed ranges plus the few rows that cannot be recovered
// from bytes at all. There is exactly one definition of that union and this
// file calls it rather than restating it.
import { crossReferencesTo } from "./anno-derive.ts";
import { storePathWithinWorkspace } from "./anno-types.ts";
import type { CommentRow, LabelRow, RangeRow } from "./anno-types.ts";
import { decodeRawData } from "./prg-image.ts";
import { repoRoot } from "./repo-root.ts";
const NPX_INVOCATION = "npx -y @henols/vice-mcp r2000 <verb>";
const PLUGIN_INVOCATION = "node <plugin-root>/src/mcp/vice/vice-proxy.ts r2000 <verb>";

const USAGE = `usage (npm install):    ${NPX_INVOCATION}
usage (plugin/in-repo): ${PLUGIN_INVOCATION}

verbs:
  render-memmap <project> --provenance FILE [--out FILE] [--check]
      Generates the Markdown memory map from the project's store plus a
      validated provenance sidecar (D-24: the store is canonical, this
      output is a GENERATED VIEW -- never hand-edit it). Without --check,
      writes --out (default: memory-map.md beside the project) and prints
      the row count, the number of [unknown]-graded rows, and the render
      digest. With --check, re-renders in memory and compares against the
      file at --out: prints "in sync" and exits 0 when they match, prints
      the first differing line and exits non-zero on drift (from either a
      hand edit OR a store-side change since the file was last rendered),
      or prints "missing" and exits non-zero when --out does not exist yet.
      --check is how a hand edit to the generated file is caught. Requires
      an EXISTING project and an EXISTING --provenance sidecar (this verb
      does not create either).

  coverage <project> --store FILE [--out FILE] [--force] [--sample N]
      Measures how far a program has actually been reverse-engineered
      (COV-01/COV-02), through anno-coverage.ts. <project> supplies the
      PAYLOAD BYTES and the load origin; --store names the ANNOTATION STORE
      holding the labels, comments and typed ranges. Those are two separate
      files on purpose: the store holds annotations and never bytes, so a
      derived measure has to be told which bytes it is measuring and this
      verb refuses to guess one from the other. Prints three separately
      named measures -- the structural byte census, the two label figures,
      and the sampled reproducibility result -- plus the comment-vacuity
      measure, the indirect-dispatch scan and the divergence sub-report,
      each under its own heading with its own numbers. Writes the JSON
      report to --out when given, refusing to overwrite an existing file
      there unless --force is passed; --sample overrides the
      reproducibility sample size. Exits non-zero ONLY for a caller error
      or a store it could not read -- a low measurement is a RESULT, never
      a failure, so a bad report still exits 0.
      This verb deliberately reports separate numbers and never a single
      combined figure: one aggregate is precisely what makes a coverage
      claim unfalsifiable, because any one weak measure can be hidden by
      averaging it against a strong one.

Both verbs require inputs that already exist. Neither creates a project, a
store or a sidecar, and neither derives one path from another -- this CLI
never guesses (D-02).
`;

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * IN-06 (D-11.1-04): the ONE declared verb-to-accepted-options fact in this
 * file. Every option every verb's own code actually reads is listed here --
 * ground truth, not merely what USAGE happens to say.
 *
 * The defect this map exists against, kept on the record because the shape
 * outlives the verb it was found on: a verb accepted a flag its own code
 * never read, so a caller who passed it got no error and no effect. Listing
 * only the options a verb ACTUALLY reads means `checkAcceptedOptions()` below
 * refuses the rest before the verb ever runs.
 *
 * `coverage`'s `--store` is REQUIRED rather than optional, and it is declared
 * here for the same reason as every other entry: the verb reads it. It is not
 * defaulted from `<project>` -- see this file's header on never deriving one
 * caller-supplied path from another.
 */
export const VERB_OPTIONS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "render-memmap": ["--provenance", "--out", "--check"],
  coverage: ["--store", "--out", "--force", "--sample"],
});

/**
 * The one shared refusal check IN-06 generalises to every verb (WR-08's
 * closed-option-set posture, applied uniformly rather than verb by verb).
 * Scans `rest` for any `--flag`-shaped token not in `verb`'s accepted set
 * from `VERB_OPTIONS` and returns a one-line refusal naming the flag and the
 * accepted set; returns `undefined` when every flag-shaped token is
 * accepted (or when `verb` is not a key in the map at all, so an unknown
 * verb still falls through to `runR2000Cli()`'s own "unknown verb"
 * message). Never throws -- this file's never-throw posture applies here
 * too.
 */
export function checkAcceptedOptions(verb: string, rest: string[]): string | undefined {
  const accepted = VERB_OPTIONS[verb];
  if (!accepted) return undefined;
  for (const token of rest) {
    if (token.startsWith("--") && !accepted.includes(token)) {
      const acceptedList = accepted.length > 0 ? accepted.join(", ") : "none";
      return `${verb}: unknown option "${token}" -- not accepted by this verb (accepted: ${acceptedList})`;
    }
  }
  return undefined;
}

/**
 * Refuses to overwrite an existing file at `outPath` unless the caller
 * passed `--force`. Shared by every verb that writes an output file, so
 * overwrite safety stays uniform rather than one verb accreting a check the
 * others lack (CR-01/CR-02).
 */
function refuseOverwrite(outPath: string, force: boolean | undefined, verbLabel: string, extraHint = ""): boolean {
  if (force || !existsSync(outPath)) return true;
  console.error(
    `${verbLabel}: refusing to overwrite the existing file ${outPath}${extraHint} -- ` +
      `pass --force to overwrite it deliberately.`,
  );
  return false;
}

interface RenderMemmapParsedArgs {
  positional: string[];
  provenance?: string;
  provenanceMissingValue?: boolean;
  out?: string;
  outMissingValue?: boolean;
  check?: boolean;
  unknownOption?: string;
}

/** Fixed, closed option set for render-memmap -- exactly `--provenance`,
 * `--out` and `--check`. Per WR-08's posture (do not silently accept a flag
 * a verb does not implement, or a flag missing its value), any OTHER
 * `--flag`-shaped token is refused as `unknownOption`, and `--provenance`/
 * `--out` with no value (or a flag-shaped "value") is refused via their own
 * `*MissingValue` fields. */
function parseRenderMemmapArgs(rest: string[]): RenderMemmapParsedArgs {
  const positional: string[] = [];
  let provenance: string | undefined;
  let provenanceMissingValue = false;
  let out: string | undefined;
  let outMissingValue = false;
  let check = false;
  let unknownOption: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--provenance") {
      const value = rest[i + 1];
      if (value === undefined || value.startsWith("--")) {
        provenanceMissingValue = true;
      } else {
        provenance = value;
        i++;
      }
    } else if (a === "--out") {
      const value = rest[i + 1];
      if (value === undefined || value.startsWith("--")) {
        outMissingValue = true;
      } else {
        out = value;
        i++;
      }
    } else if (a === "--check") {
      check = true;
    } else if (a.startsWith("--")) {
      unknownOption ??= a;
    } else {
      positional.push(a);
    }
  }
  return { positional, provenance, provenanceMissingValue, out, outMissingValue, check, unknownOption };
}

/**
 * `render-memmap <project> --provenance FILE [--out FILE] [--check]` --
 * D-24's generated-view verb, via `anno-memmap-render.ts`'s
 * `renderMemoryMap()`/`checkRenderedMemoryMap()`. Never writes a file when
 * `--check` is given -- that mode only reads and reports.
 */
async function cmdRenderMemmap(rest: string[]): Promise<number> {
  const {
    positional,
    provenance,
    provenanceMissingValue,
    out,
    outMissingValue,
    check,
    unknownOption,
  } = parseRenderMemmapArgs(rest);

  if (unknownOption) {
    console.error(`render-memmap: unknown option "${unknownOption}"\n`);
    console.log(USAGE);
    return 1;
  }
  if (provenanceMissingValue) {
    console.error("render-memmap: --provenance requires a value\n");
    console.log(USAGE);
    return 1;
  }
  if (outMissingValue) {
    console.error("render-memmap: --out requires a value\n");
    console.log(USAGE);
    return 1;
  }

  const project = positional[0];
  if (!project) {
    console.error("render-memmap: usage: render-memmap <project> --provenance FILE [--out FILE] [--check]");
    return 1;
  }
  if (!existsSync(project)) {
    console.error(`render-memmap: project file not found: ${project}`);
    return 1;
  }
  if (!provenance) {
    console.error("render-memmap: --provenance FILE is required\n");
    console.log(USAGE);
    return 1;
  }
  if (!existsSync(provenance)) {
    console.error(`render-memmap: provenance sidecar not found: ${provenance}`);
    return 1;
  }

  const outPath = out ?? join(dirname(project), "memory-map.md");

  if (check) {
    let result: Awaited<ReturnType<typeof checkRenderedMemoryMap>>;
    try {
      result = await checkRenderedMemoryMap({ projectPath: project, provenancePath: provenance, renderedPath: outPath });
    } catch (err) {
      console.error(`render-memmap: ${errMsg(err)}`);
      return 1;
    }
    if (result.status === "in-sync") {
      console.log(`render-memmap: in sync (${outPath})`);
      return 0;
    }
    if (result.status === "missing") {
      console.error(`render-memmap: missing -- ${outPath} does not exist yet. Run render-memmap without --check first.`);
      return 1;
    }
    console.error(`render-memmap: drifted at line ${result.line}`);
    console.error(`  expected: ${result.expected}`);
    console.error(`  actual:   ${result.actual}`);
    return 1;
  }

  let rendered: Awaited<ReturnType<typeof renderMemoryMap>>;
  try {
    rendered = await renderMemoryMap({ projectPath: project, provenancePath: provenance });
  } catch (err) {
    console.error(`render-memmap: ${errMsg(err)}`);
    return 1;
  }
  try {
    writeFileSync(outPath, rendered.markdown);
  } catch (err) {
    // WR-09 (D-11.1-04): the same shape as bootstrapProject()'s write above,
    // one verb over -- an ordinary write failure (missing parent directory,
    // permissions, full disk) must not throw past this verb's own
    // never-throw contract.
    console.error(`render-memmap: could not write ${outPath}: ${errMsg(err)}`);
    return 1;
  }
  console.log(
    `render-memmap: wrote ${outPath} (${rendered.rowCount} row(s), ${rendered.unknownCount} [unknown], digest ${rendered.renderDigest})`,
  );
  return 0;
}

interface CoverageParsedArgs {
  positional: string[];
  store?: string;
  storeMissingValue?: boolean;
  out?: string;
  outMissingValue?: boolean;
  force?: boolean;
  sample?: number;
  sampleRaw?: string;
  sampleMissingValue?: boolean;
  unknownOption?: string;
}

/** Fixed, closed option set for coverage -- exactly `--store`, `--out`,
 * `--force` and `--sample`. Same WR-08 posture as `parseRenderMemmapArgs()`
 * above: an unimplemented flag is refused as `unknownOption`, and
 * `--store`/`--out`/`--sample` with a missing or flag-shaped value are refused
 * through their own `*MissingValue` fields rather than silently swallowing the
 * next token. */
function parseCoverageArgs(rest: string[]): CoverageParsedArgs {
  const positional: string[] = [];
  let store: string | undefined;
  let storeMissingValue = false;
  let out: string | undefined;
  let outMissingValue = false;
  let force = false;
  let sample: number | undefined;
  let sampleRaw: string | undefined;
  let sampleMissingValue = false;
  let unknownOption: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--store") {
      const value = rest[i + 1];
      if (value === undefined || value.startsWith("--")) {
        storeMissingValue = true;
      } else {
        store = value;
        i++;
      }
    } else if (a === "--out") {
      const value = rest[i + 1];
      if (value === undefined || value.startsWith("--")) {
        outMissingValue = true;
      } else {
        out = value;
        i++;
      }
    } else if (a === "--sample") {
      const value = rest[i + 1];
      if (value === undefined || value.startsWith("--")) {
        sampleMissingValue = true;
      } else {
        sampleRaw = value;
        sample = Number.parseInt(value, 10);
        i++;
      }
    } else if (a === "--force") {
      force = true;
    } else if (a.startsWith("--")) {
      unknownOption ??= a;
    } else {
      positional.push(a);
    }
  }
  return { positional, store, storeMissingValue, out, outMissingValue, force, sample, sampleRaw, sampleMissingValue, unknownOption };
}

// ---------------------------------------------------------------------------
// THE STORE-TO-CENSUS ADAPTER (Discretion 4).
//
// `anno-coverage.ts` declares four input shapes and fetches NONE of them: a
// caller hands the data in. So moving the census from the retired analyser's
// project JSON onto this project's own annotation store is a CALLER-side
// change and nothing else -- the four functions below, and no edit to the
// instrument.
//
// THE COLUMN MAPPING, stated once, here, because a vocabulary mismatch at this
// boundary changes coverage verdicts SILENTLY (T-29-29):
//
//   LabelRow   -> R2000Symbol        address, name, kind. `kind` needs no
//                                    translation: the store's LABEL_KINDS are
//                                    the same four tokens the census filters
//                                    on ("User"/"Auto"/"System"/"Platform").
//                                    `id` and `bank` are store-only and are
//                                    dropped. The census never reads a
//                                    symbol's `type`, so its absence from the
//                                    store costs nothing.
//   CommentRow -> R2000Comment       address, commentType -> type, text ->
//                                    comment. COMMENT_TYPES is "line"/"side",
//                                    which is exactly the census's own pair.
//   RangeRow   -> BlockEntry         start -> start_address, endInclusive ->
//                                    end_address (both INCLUSIVE on both
//                                    sides), dataType -> type. That last
//                                    column is the one the census must NOT
//                                    interpret itself: it goes through
//                                    `block-class.ts`, the one boundary
//                                    allowed to read a store block spelling,
//                                    and `block-class.test.ts` pins the class
//                                    each of the frozen twelve resolves to BY
//                                    NAME so this mapping cannot drift
//                                    quietly.
//   derived    -> R2000CrossReference the union `crossReferencesTo()` computes
//                                    from the bytes, the typed split tables
//                                    and the stored rows.
// ---------------------------------------------------------------------------

/** `LabelRow[]` as the census's symbol shape. */
export function symbolsFromStore(rows: readonly LabelRow[]): R2000Symbol[] {
  return rows.map((row) => ({ address: row.address, name: row.name, kind: row.kind }));
}

/** `CommentRow[]` as the census's comment shape. */
export function commentsFromStore(rows: readonly CommentRow[]): R2000Comment[] {
  return rows.map((row) => ({ address: row.address, type: row.commentType, comment: row.text }));
}

/** `RangeRow[]` as the census's block shape. The `dataType` column is copied
 * VERBATIM and never compared here -- `block-class.ts` is the only place in
 * this tree allowed to interpret it. */
export function blocksFromStore(rows: readonly RangeRow[]): BlockEntry[] {
  return rows.map((row) => ({ start_address: row.start, end_address: row.endInclusive, type: row.dataType }));
}

/**
 * The census's fourth input, derived in ONE pass over the store and the image
 * rather than fetched one address at a time.
 *
 * WHAT THIS REPLACED, and why the replacement has no ceiling. The previous
 * implementation issued one transport round trip PER LABEL through a held
 * child process, and bounded that at a hard ceiling of 512 lookups, printing a
 * note when the ceiling bit. Over an in-process derivation that ceiling would
 * be strictly worse than the bound it used to express: it would truncate a
 * COMPLETE answer and call the remainder a floor. So it is gone, and this
 * function answers over the WHOLE population -- every non-System, non-Platform
 * label the store holds.
 *
 * `System`/`Platform` labels are excluded because every label figure already
 * excludes them, so deriving their callers would buy the census nothing.
 */
export function crossReferencesFromStore(
  handle: AnnoStoreHandle,
  image: Uint8Array,
  origin: number,
  symbols: readonly R2000Symbol[],
): R2000CrossReference[] {
  const targets = [
    ...new Set(
      (Array.isArray(symbols) ? symbols : [])
        .filter((s) => s && String(s.kind ?? "") !== "System" && String(s.kind ?? "") !== "Platform")
        .map((s) => s.address),
    ),
  ].sort((a, b) => a - b);
  return targets.map((address) => ({ address, callers: crossReferencesTo(handle, image, origin, address).callers }));
}

/**
 * The payload bytes and the load origin, read from the SAME project file the
 * census reads them from.
 *
 * Deliberately not a second byte source: `buildCoverageReport()` decodes this
 * file itself, and handing `crossReferencesTo()` bytes from somewhere else
 * would let the two halves of one report disagree about which program they
 * describe. Returns `null` -- never a throw and never a guess -- when the file
 * is unreadable or carries no decodable payload; the census reports that same
 * condition itself, in its own words, and the verb exits non-zero on it.
 */
function projectImage(projectPath: string): { origin: number; bytes: Uint8Array } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(projectPath, "utf8"));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const project = parsed as Record<string, unknown>;
  const origin = typeof project.origin === "number" && Number.isSafeInteger(project.origin) ? project.origin : 0;
  if (typeof project.raw_data_base64 !== "string") return null;
  try {
    const bytes = new Uint8Array(decodeRawData(project.raw_data_base64));
    return bytes.length === 0 ? null : { origin, bytes };
  } catch {
    return null;
  }
}

function hexAddr(address: number): string {
  return `$${address.toString(16).padStart(4, "0")}`;
}

function ratio(value: number | null): string {
  return value === null ? "UNAVAILABLE" : value.toFixed(3);
}

function addressList(addresses: readonly number[], cap = 12): string {
  if (addresses.length === 0) return "none";
  const shown = addresses.slice(0, cap).map(hexAddr).join(", ");
  return addresses.length > cap ? `${shown}, ... (${addresses.length} in all)` : shown;
}

/**
 * Renders the report as separately-headed sections.
 *
 * THE ONE RULE THIS FUNCTION EXISTS TO HOLD (COV-01, and the reason the
 * rendering lives here rather than being a generic pretty-printer): print
 * every measure's own numbers under its own heading, and never compute a
 * combined figure at the point of display. `anno-coverage.ts`'s report
 * object carries no aggregate -- if one ever appears, it will be because
 * somebody averaged, summed or weighted these numbers HERE. Do not. The
 * ratios below measure different populations (labels, comments, sampled
 * addresses); they are not commensurable and combining them would produce a
 * number that means nothing while reading like a verdict.
 */
function printCoverageReport(report: CoverageReport): void {
  const s = report.structural;
  const classSum = s.reachedAsInstruction + s.tableEntry + s.referencedAsData + s.unreached;

  console.log(`coverage: ${report.project.path}`);
  console.log(
    `  origin ${hexAddr(report.project.origin)}, ${report.project.size} byte(s), payload ` +
      (report.project.payloadDecoded ? "decoded" : `UNAVAILABLE -- ${report.project.reason ?? "reason not recorded"}`),
  );
  console.log(`  schema version ${report.schemaVersion}, generated ${report.generatedAt}`);
  console.log("");

  console.log("  MEASURE 1 of 3 -- structural byte census (raw bytes plus the seed set only; the store cannot move it)");
  console.log(`    reached-as-instruction : ${s.reachedAsInstruction}`);
  console.log(`    table-entry            : ${s.tableEntry}`);
  console.log(`    referenced-as-data     : ${s.referencedAsData}`);
  console.log(`    unreached              : ${s.unreached}`);
  console.log(`    the four classes sum to ${classSum} of ${s.rangeBytes} censused byte(s)`);
  console.log(
    `    linear-sweep decodable : ${s.linearSweepDecodable} byte(s) -- reported BESIDE the census, never added to it; ` +
      "decodability is not evidence of code",
  );
  console.log(`    seeds: ${s.seeds.length} (${addressList(s.seeds)}); descent steps ${s.steps}; truncated: ${s.truncated ? "YES" : "no"}`);
  console.log("");

  console.log("  MEASURE 2 of 3 -- label figures (two of them, both printed; neither is folded into the other)");
  console.log(
    `    kind ratio over non-System labels: ${report.labels.kindRatio.user} user / ${report.labels.kindRatio.auto} auto ` +
      `-> user fraction ${ratio(report.labels.kindRatio.userFraction)}`,
  );
  console.log(
    `    auto-prefix names remaining      : ${report.labels.autoPrefixNamesRemaining} at ${addressList(report.labels.autoPrefixNameAddresses)}`,
  );
  console.log(`    System labels excluded           : ${report.labels.systemExcluded}`);
  console.log(
    `    disqualified by the multi-caller rule: ${report.labels.excludedByMultiCallerRule.length} at ` +
      `${addressList(report.labels.excludedByMultiCallerRule)}`,
  );
  console.log("");

  const repro = report.reproducibility;
  console.log("  MEASURE 3 of 3 -- sampled reproducibility (the bytes route versus the store route; neither reads the other's input)");
  console.log(
    `    sampled ${repro.sampled}, agreed ${repro.agreed}, disagreed ${repro.disagreed} -> agreement rate ${ratio(repro.agreementRate)}`,
  );
  console.log(`    sample rule: ${repro.sampleRule}`);
  console.log(`    sampled addresses: ${addressList(repro.addresses)}`);
  for (const c of repro.comparisons) {
    console.log(`      ${hexAddr(c.address)}  bytes=${c.fromBytes}  store=${c.fromStore}  ${c.agreed ? "agree" : "DISAGREE"}`);
  }
  console.log(
    `    multi-caller labels documented without naming a caller: ${repro.multiCallerUndocumented.count} at ` +
      `${addressList(repro.multiCallerUndocumented.addresses)}`,
  );
  if (repro.reason) console.log(`    reason: ${repro.reason}`);
  console.log("");

  const vac = report.commentVacuity;
  console.log("  comment vacuity (its own measure -- kept out of the three above, not averaged into them)");
  console.log(`    commented addresses : ${vac.commentedAddresses}`);
  console.log(`    distinct comments   : ${vac.distinctComments} -> distinct-comment ratio ${ratio(vac.distinctCommentRatio)}`);
  console.log(
    `    graded              : ${vac.gradedAddresses} graded, ${vac.unknownGradedAddresses} [unknown] -> graded fraction ${ratio(vac.gradedFraction)}`,
  );
  console.log(`    banned-generic      : ${vac.bannedGenericAddresses.length} at ${addressList(vac.bannedGenericAddresses)}`);
  console.log(`    near-miss grade token: ${vac.malformedGradeAddresses.length} at ${addressList(vac.malformedGradeAddresses)}`);
  if (vac.reason) console.log(`    reason: ${vac.reason}`);
  console.log("");

  const d = report.dispatch;
  console.log("  indirect-dispatch scan (feeds the census its extra seeds; reported as counts, never graded)");
  console.log(
    `    indirect jumps ${d.indirectJumps.length}, multi-entry tables ${d.multiEntryTables.length}, ` +
      `split lo/hi tables ${d.splitTables.length}, stack-return dispatch ${d.stackReturnDispatch.length}`,
  );
  console.log(
    `    discovered targets ${d.discoveredTargets.length}, table-entry addresses ${d.tableEntryAddresses.length}, ` +
      `truncated: ${d.truncated ? "YES" : "no"}`,
  );
  console.log("");

  const div = report.divergence;
  console.log("  divergence sub-report (census versus the store's own block table -- a COMPARISON, not a measure of completeness)");
  if (!div.blocksSupplied) {
    console.log(`    UNAVAILABLE -- ${div.reason ?? "reason not recorded"}`);
  } else {
    console.log(`    census reached as instructions but the store does not call Code : ${div.censusCodeStoreNotCode} byte(s)`);
    console.log(`    the store calls Code but the census never reached             : ${div.storeCodeCensusUnreached} byte(s)`);
    console.log(`    covered by no block entry at all                              : ${div.uncoveredByStore} byte(s)`);
    console.log(`    compared over ${div.comparedBytes} byte(s)`);
  }
  console.log(`    ${div.note}`);
  console.log("");

  const verdict = coverageFindings(report);
  console.log("  per-measure findings (one named measure each -- this list is not a rating and carries no number)");
  if (verdict.clean) {
    console.log("    none -- every measure is above its own threshold");
  } else {
    for (const f of verdict.findings) console.log(`    [${f.measure}] ${f.reason}`);
  }
  console.log("");
  console.log(
    "  Read the numbers against each other, never as one figure: a high user fraction beside a large unreached count " +
      "means the wrong things were named, and a large divergence means the store and the bytes disagree about what is code.",
  );
}

/**
 * `coverage <project> --store FILE [--out FILE] [--force] [--sample N]` --
 * COV-01's delivery path: the instrument from `anno-coverage.ts`, run against
 * a real program and a real annotation store.
 *
 * TWO PATHS, NEITHER DERIVED FROM THE OTHER. `<project>` carries the payload
 * bytes and the load origin; `--store` names the annotation store holding the
 * labels, comments and typed ranges. The store holds annotations and never
 * bytes, so a derived measure has to be told which bytes it is measuring, and
 * guessing one path from the other is exactly the auto-pick D-02 forbids.
 *
 * Two properties this function must keep:
 *   - NO SECOND PATH VALIDATOR (T-19-22 / T-29-28). Both caller-supplied paths
 *     are confined by `storePathWithinWorkspace()` against `repoRoot()` -- the
 *     one seam, the same one `anno-tools.ts` puts its own store and image
 *     arguments through. `openStore()` is then handed the same workspace root,
 *     so its own confinement agrees by construction rather than by a second
 *     rule.
 *   - THE STORE IS OPENED ONCE, read-only, for the whole verb, and closed in a
 *     `finally`. `mustExist` is what makes "the annotations are gone" and
 *     "there are no annotations" refuse differently instead of reading the
 *     same: without it this verb would CREATE an empty store at the named path
 *     and report a measurement of nothing.
 *
 * The exit code is 0 for any report it managed to build, however poor the
 * numbers are -- a bad score is a result, not a failure. Non-zero is reserved
 * for a caller error (bad path, bad option, refused overwrite) and for a store
 * it could not read or a payload it could not decode.
 */
async function cmdCoverage(rest: string[]): Promise<number> {
  const { positional, store, storeMissingValue, out, outMissingValue, force, sample, sampleRaw, sampleMissingValue, unknownOption } =
    parseCoverageArgs(rest);

  if (unknownOption) {
    console.error(`coverage: unknown option "${unknownOption}"\n`);
    console.log(USAGE);
    return 1;
  }
  if (storeMissingValue) {
    console.error("coverage: --store requires a value\n");
    console.log(USAGE);
    return 1;
  }
  if (outMissingValue) {
    console.error("coverage: --out requires a value\n");
    console.log(USAGE);
    return 1;
  }
  if (sampleMissingValue) {
    console.error("coverage: --sample requires a value\n");
    console.log(USAGE);
    return 1;
  }

  const project = positional[0];
  if (!project) {
    console.error("coverage: usage: coverage <project> --store FILE [--out FILE] [--force] [--sample N]");
    return 1;
  }
  if (!store) {
    console.error(
      "coverage: --store FILE is required -- the annotation store holds the labels, comments and typed ranges, " +
        "and this verb will not derive its path from <project>.\n",
    );
    console.log(USAGE);
    return 1;
  }
  if (sample !== undefined && (!Number.isInteger(sample) || sample <= 0)) {
    console.error(`coverage: --sample must be a positive integer, got "${sampleRaw}"`);
    return 1;
  }

  // T-19-22 / T-29-28: the ONE confinement seam, for BOTH caller-supplied
  // paths. Never a second hand-rolled one, and never a different rule for the
  // store than for the program it annotates.
  const workspaceRoot = repoRoot();
  let projectPath: string;
  let storePath: string;
  try {
    projectPath = storePathWithinWorkspace(project, workspaceRoot);
    storePath = storePathWithinWorkspace(store, workspaceRoot);
  } catch (err) {
    console.error(`coverage: ${errMsg(err)}`);
    return 1;
  }
  if (!existsSync(projectPath)) {
    console.error(`coverage: project file not found: ${projectPath}`);
    return 1;
  }
  if (!existsSync(storePath)) {
    console.error(
      `coverage: annotation store not found: ${storePath} -- refusing to CREATE one, because "the annotations are ` +
        'gone" and "there are no annotations" must not read the same.',
    );
    return 1;
  }

  if (out && !refuseOverwrite(out, force, "coverage")) {
    return 1;
  }

  let symbols: R2000Symbol[];
  let comments: R2000Comment[];
  let blocks: BlockEntry[];
  let crossReferences: R2000CrossReference[];
  let handle: AnnoStoreHandle;
  try {
    handle = openStore(storePath, { workspaceRoot, mustExist: true });
  } catch (err) {
    console.error(`coverage: ${errMsg(err)}`);
    return 1;
  }
  try {
    symbols = symbolsFromStore(listLabels(handle));
    comments = commentsFromStore(listComments(handle));
    blocks = blocksFromStore(listRanges(handle));
    // The bytes come from the SAME file the census decodes, so the derived
    // half and the censused half can never describe different programs. A
    // payload that will not decode yields no cross-references at all rather
    // than a partial answer -- the census reports that condition itself and
    // this verb exits non-zero on it below.
    const image = projectImage(projectPath);
    crossReferences = image === null ? [] : crossReferencesFromStore(handle, image.bytes, image.origin, symbols);
  } catch (err) {
    console.error(`coverage: ${errMsg(err)}`);
    return 1;
  } finally {
    closeStore(handle);
  }

  let report: CoverageReport;
  try {
    report = buildCoverageReport({
      projectPath,
      symbols,
      comments,
      blocks,
      crossReferences,
      ...(sample !== undefined ? { sampleSize: sample } : {}),
    });
  } catch (err) {
    console.error(`coverage: ${errMsg(err)}`);
    return 1;
  }

  printCoverageReport(report);

  if (out) {
    try {
      writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
    } catch (err) {
      console.error(`coverage: could not write ${out}: ${errMsg(err)}`);
      return 1;
    }
    console.log(`coverage: wrote ${out} (schema version ${report.schemaVersion})`);
  }

  if (!report.project.payloadDecoded) {
    // Not a low measurement -- an unreadable payload means every byte-side
    // measure above was computed over nothing. Reported as the caller-facing
    // failure it is, AFTER the report, so the reason is on screen (COV-02).
    console.error(`coverage: the project's payload was UNAVAILABLE -- ${report.project.reason ?? "reason not recorded"}`);
    return 1;
  }
  return 0;
}

/**
 * Entry point for the `r2000` subcommand. Returns an exit code; never calls
 * exit the process directly (the bin does that). Handles `--help`/no verb/unknown
 * verb per `acme.mjs`'s own dispatch convention (`src/skills/acme-build/
 * scripts/acme.mjs`), with one deliberate difference: an explicit `--help`
 * returns 0 (a no-op invocation with no verb also returns 0), while an
 * unrecognised verb returns 1.
 */
export async function runR2000Cli(argv: string[]): Promise<number> {
  const [verb, ...rest] = argv;

  if (!verb || verb === "--help" || verb === "-h") {
    console.log(USAGE);
    return 0;
  }

  // IN-06 (D-11.1-04): the single call site for the shared verb-options
  // check, run BEFORE dispatch so a refused option never reaches any cmd*
  // function -- one place enforces the closed option set for every verb,
  // rather than seven places each doing (or, as `verify` proved, NOT doing)
  // it themselves.
  const optionError = checkAcceptedOptions(verb, rest);
  if (optionError) {
    console.error(optionError);
    console.log(USAGE);
    return 1;
  }

  try {
    switch (verb) {
      case "render-memmap":
        return await cmdRenderMemmap(rest);
      case "coverage":
        return await cmdCoverage(rest);
      default:
        console.error(`r2000: unknown verb "${verb}" -- this CLI has exactly two: render-memmap and coverage\n`);
        console.log(USAGE);
        return 1;
    }
  } catch (err) {
    // A last-resort net: every expected failure path above already returns its
    // own code with its own message, so anything arriving here is unexpected
    // and is reported verbatim rather than swallowed. The loud failure is the
    // point (D-07).
    console.error(`r2000: ${errMsg(err)}`);
    return 1;
  }
}
