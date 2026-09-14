#!/usr/bin/env node
// anno-cli.ts -- the thin CLI ergonomics layer over the annotation store.
// Reached as `vice-mcp anno <verb>` because that bin is the only
// surface that resolves identically across the Claude Code plugin route and
// both npm-installer routes: `installer/bin/cli.mjs`'s `viceServerEntry()`
// always launches this server via `npx` in BOTH npm-installer modes, and
// neither route places `src/mcp/vice/*.ts` as plain files inside a
// consuming project for some other filesystem-path-resolving design to find.
//
// ---------------------------------------------------------------------------
// FIVE VERBS. THAT IS THE WHOLE SURFACE -- narrowed to two, then grown back
// one verb at a time as each earned a real route over this project's own
// annotation store: a third verb landed first; a fourth, `evid-disagreements`,
// followed as the CLI route for the disagreement query, so a planted test has
// three RENDERED, textually-distinguishable states to compare rather than
// only the MCP tool's JSON, which a test can only inspect structurally; a
// fifth, `decomp-completeness`, followed as the CLI route for the
// decomposition-completeness report's ONLY data path into a real store. Each
// raise of the count DELIBERATELY SUPERSEDES the prior "THAT IS THE WHOLE
// SURFACE" framing rather than silently reopening it -- this is the second
// raise over that framing, not the first.
// ---------------------------------------------------------------------------
// This file used to carry eight. Six were removed in one commit because they
// were delivery paths for the retired external analyser this project used to
// rent an annotation store from: three drove its child process directly and
// three reached it through capability modules that did. Removing the analyser
// without removing them would have left six verbs that typecheck, dispatch,
// and then fail at the first call. That paragraph is kept rather than deleted:
// it records what went and why, and it stays true.
//
// What went, and where it stands now:
//   - `bootstrap`, `export-asm`, `verify` -- the analyser's own routes.
//     `export-asm` RETURNED on 2026-08-31 as a REBUILD OVER THE ANNOTATION
//     STORE behind a real-ACME byte-diff oracle -- not as restored code, and
//     not sharing a line with the deleted implementation. It is the third
//     verb below. `bootstrap` and `verify` did not come back: `bootstrap`
//     created the analyser's own project file, which no longer exists as a
//     format this repo produces, and `verify` drove the analyser's own
//     checker.
//   - `gen-enums`, `export-lbl`, `import-lbl` -- the enum generator and the
//     VICE-label round trip. These did NOT return with `export-asm`. No
//     requirement and no success criterion of the phase that rebuilt
//     `export-asm` covers any of them, and NO PHASE CURRENTLY OWNS THEM, so
//     the symbol round trip still has NO route at all. That is recorded as a
//     withdrawal in this project's own capability record rather than left for
//     a reader to discover by running it. The exact wording of those
//     withdrawal notices across both skill trees is kept in exactly one
//     place; this file states the code fact and does not restate their text,
//     so the two edits cannot contradict each other.
//
// WHAT NOT TO DO, named concretely:
//   - Never auto-pick an input when the caller does not name one. A
//     silent auto-pick would happily analyse a cracktro or loader stub's
//     bytes instead of the actual game -- precisely the failure
//     `c64-provenance-diff` exists to prevent elsewhere in this project.
//     Every verb takes EXISTING inputs and refuses rather than guess:
//     `render-memmap` demands its provenance sidecar by name, `coverage`
//     demands its annotation store by name, and `export-asm` demands BOTH an
//     existing store and an existing image. No verb derives one
//     caller-supplied path from another.
//   - Never grow a second path validator. Every caller-supplied path below
//     goes through `storePathWithinWorkspace()` -- the ONE confinement seam,
//     the same one `anno-tools.ts` puts its store and image arguments
//     through. A second answer to "is this path inside the workspace" is a
//     confinement escape waiting to be written.
//
//     THIS PARAGRAPH WAS FALSE WHEN IT WAS FIRST WRITTEN, and that is why it
//     now names the mechanism that keeps it. An independent verification pass
//     reproduced three escapes on this very tree, on arguments the shipped
//     playbooks tell an agent to compose in a
//     Bash invocation: `render-memmap --out` and `coverage --out` reached
//     `writeFileSync` as raw caller strings (the first silently replacing a
//     pre-existing file OUTSIDE the workspace root and exiting 0), and
//     `render-memmap --provenance` reached `readFileSync` raw, making it an
//     arbitrary-file read oracle that then DISCLOSED the file's opening bytes
//     through an interpolated parse error. Four of the six arguments were
//     unconfined while this paragraph said all of them were.
//
//     A header naming a maintained property is a written warrant for the next
//     maintainer not to check, so when the property and the prose disagree the
//     prose is the more dangerous half. What went wrong is worth stating
//     precisely: the SEAM was never weak -- `anno-confinement.test.ts` proves
//     the predicate fifteen ways, including the symlink and dangling-link
//     classes -- but its CONSUMER SET was unenumerated, and nothing could fail
//     when a new argument skipped it. `anno-cli-path-consumers.test.ts` closes
//     exactly that asymmetry: it ENUMERATES every caller-supplied path
//     argument this CLI accepts -- the flags derived from `VERB_OPTIONS`
//     below, the positionals derived from each verb's `--help` synopsis line
//     -- and fails when the inventory and the surface disagree in either
//     direction, or when the number of confinement call sites in this file
//     falls below the inventory's size. A new path-shaped flag or positional
//     therefore joins the audit automatically instead of by a reviewer
//     noticing.
//
//     AND WHAT IT DOES NOT CHECK, stated in terms so the limit can be closed
//     deliberately rather than discovered: it does not associate a
//     particular argument with a particular call site. "Six arguments each
//     confined once" and "five confined with one of them confined twice" read
//     the same to it. That association needs per-argument dataflow through
//     this file -- a static-analysis job, deliberately not taken on in a
//     gap-closure round -- so what this paragraph now claims is the narrower
//     property the test has, not the wider one it used to be credited with.
//
//   - Never use the RAW caller string after confining it.
//     `storePathWithinWorkspace()` returns the REALPATH, not its input, so
//     carrying the original forward reintroduces the escape one line below the
//     check that refused it -- and makes every "wrote X" line name a file that
//     is not the one on disk.
//
// `runAnnoCli()` returns an exit code and never terminates the process
// itself, so it is testable in-process as well as from the bin (the bin,
// `vice-proxy.ts`, is the only place that ends the process with this
// function's return value). All output goes to stdout/stderr via
// `console.log`/`console.error` -- never a thrown stack trace for an
// expected, user-facing failure (missing file, unreadable store, refused
// overwrite): each of those produces a single actionable line instead.
//
// Import nothing from `hostpath.ts` or `containerpath.ts`. Every path this
// CLI handles is already container-side, and translating any of these
// arguments would be the mirror image of a screenshot-path trap this project
// hit before, where a client-side-derived path was wrongly translated a
// second time. This absence is asserted structurally by
// `hostpath-consumers.test.ts`, not merely stated here.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { renderMemoryMap, checkRenderedMemoryMap } from "./anno-memmap-render.ts";
// The ACME source emitter. It reads the store and the image and
// returns text plus counts; it starts no assembler and knows nothing about
// one. `acme-verify.ts` -- the module that DOES spawn ACME -- is deliberately
// NOT imported here and must never be: it is test-only (it is absent from
// `package.json`'s `files[]` on purpose), so a shipped module importing it
// would drag it into the published closure `check-npm-packages.mjs` walks.
import { exportAsmTree } from "./anno-export-asm.ts";
import type { ExportAsmTreeResult } from "./anno-export-asm.ts";
// The coverage instrument. It declares its own input shapes
// and never reads a store, a file or a tool on its own behalf -- a caller
// fetches and hands the data in, which is exactly what makes the store
// re-point below a CALLER-side change and nothing more.
import { buildCoverageReport, coverageFindings, loadProjectImage, AUTO_NAME_PREFIX_RE } from "./anno-coverage.ts";
import type { CoverageReport, LoadedProject, AnnoComment, AnnoCrossReference, AnnoSymbol } from "./anno-coverage.ts";
// The store's block-entry shape comes from the boundary that owns its
// vocabulary, not from the census -- see `block-class.ts`.
import type { BlockEntry } from "./block-class.ts";
import { openStore, closeStore, listLabels, listComments, listRanges, listExecObservations, listObservedRuns, listXrefs } from "./anno-store.ts";
import type { AnnoStoreHandle } from "./anno-store.ts";
// The shared 6502/6510 decoder. `decomp-completeness`'s
// entry-point and referenced-address censuses walk the
// SAME code-range decode `anno_disassemble` and `anno-enum-gen.ts`'s
// `fetchRegisterSearchRows()` already use -- never a second decoder, never a
// regex over rendered text.
import { decode } from "./disasm-decoder.ts";
import type { Instruction } from "./disasm-decoder.ts";
// The disagreement query's own pure join. This
// is the SAME reconcileObservedExecution() the anno_evid_disagreements MCP
// tool calls -- reached here directly (a static import, never lazy) because
// this module IS the CLI, not a startup-cost-sensitive MCP server entry
// point.
import { reconcileObservedExecution } from "./evid-reconcile.ts";
// The pure, read-only movement-hazard report. The SAME buildHazardReport()
// the anno_hazard_report MCP tool calls -- reached here directly (a static
// import, never lazy) because this module IS the CLI.
import { buildHazardReport } from "./anno-hazard-report.ts";
import type { HazardReport } from "./anno-hazard-report.ts";
import type { EvidReconciliation } from "./evid-reconcile.ts";
// The derived half of the cross-reference union: cross-references are DERIVED from the bytes
// plus the store's typed ranges plus the few rows that cannot be recovered
// from bytes at all. There is exactly one definition of that union and this
// file calls it rather than restating it.
import { crossReferencesTo } from "./anno-derive.ts";
import { storePathWithinWorkspace, isSplitDataType } from "./anno-types.ts";
import type { CommentRow, LabelRow, RangeRow, DataType } from "./anno-types.ts";
import { repoRoot } from "./repo-root.ts";
// The three comment-text conventions, declared once in
// anno-store-export.ts and imported everywhere they are matched -- never
// restated as a second literal.
import { DECLINE_COMMENT_PREFIX, DISAGREEMENT_ACCEPTED_COMMENT_PREFIX, AUTHORED_PROVENANCE_COMMENT_PREFIX } from "./anno-store-export.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const NPX_INVOCATION = "npx -y @henols/vice-mcp anno <verb>";
const PLUGIN_INVOCATION = "node <plugin-root>/src/mcp/vice/vice-proxy.ts anno <verb>";

const USAGE = `usage (npm install):    ${NPX_INVOCATION}
usage (plugin/in-repo): ${PLUGIN_INVOCATION}

verbs:
  render-memmap <store> --provenance FILE [--out FILE] [--force] [--check]
      Generates the Markdown memory map from an annotation store plus a
      validated provenance sidecar (the store is canonical; this
      output is a GENERATED VIEW -- never hand-edit it). Without --check,
      writes --out (default: memory-map.md beside the STORE -- in the
      store's own directory), refusing to overwrite an existing file there
      unless --force is passed, and prints the row count, the number of
      [unknown]-graded rows, and the render digest. That derived default is
      put through the SAME confinement seam as a caller-supplied --out,
      rather than trusted because this verb computed it.
      With --check, re-renders in memory and compares against the file at
      --out: prints "in sync" and exits 0 when they match, prints the first
      differing line and exits non-zero on drift, or prints "missing" and
      exits non-zero when --out does not exist yet. Drift is reported when,
      and only when, one of these changed: this file itself (a hand edit --
      which is what --check exists to catch); a store row (a range, a label,
      a comment, or a comment's confidence grade); the provenance sidecar's
      bytes; the location of the store or the sidecar RELATIVE TO THE
      WORKSPACE ROOT; or the renderer. Relocating the checkout is NOT drift --
      the same tree at a different absolute path renders these same bytes,
      because the two locations the banner records are workspace-relative.
      Requires an EXISTING annotation store and an EXISTING --provenance
      sidecar (this verb creates neither).

  coverage <image> --store FILE [--out FILE] [--force] [--sample N]
      Measures how far a program has actually been reverse-engineered
      through anno-coverage.ts. <image> supplies the
      PAYLOAD BYTES and the load origin; --store names the ANNOTATION STORE
      holding the labels, comments and typed ranges. Those are two separate
      files on purpose: the store holds annotations and never bytes, so a
      derived measure has to be told which bytes it is measuring and this
      verb refuses to guess one from the other.
      <image> is dispatched IN THIS ORDER, and the order is load-bearing:
      first, a .raw or .bin is read as a flat capture BY EXTENSION, before
      any length check, so a truncated capture is refused BY NAME instead
      of falling through to the .prg parser (a 4096-byte .raw once
      had its first two bytes read as a load address and reported a
      complete-looking measurement); then any file that is NOT a .prg and
      is exactly 65536 bytes is read as a flat capture, which is the one
      branch that does dispatch on byte length; then a .prg, whose first
      two bytes are the load address. The retired JSON project form
      survives as a TRAILING LEGACY branch, reached only when none of
      those matched -- its only producer was deleted, and it is kept
      solely so an existing file on disk is not broken.
      Prints three separately named measures -- the structural byte census,
      the two label figures, and the sampled reproducibility result -- plus
      the comment-vacuity measure, the indirect-dispatch scan and the
      divergence sub-report, each under its own heading with its own
      numbers. Writes the JSON report to --out when given, refusing to
      overwrite an existing file there unless --force is passed; --sample
      overrides the reproducibility sample size.
      Exits non-zero for a caller error (a missing or malformed argument, a
      path outside the workspace root, a named file that does not exist, or
      a refused overwrite of an existing --out without --force), for a store
      it could not read, for a report it could not write, and for an image
      whose PAYLOAD COULD NOT BE DECODED -- that last is not a low score but
      a measurement taken over nothing, and it is reported AFTER the report
      so the reason is on screen. A LOW MEASUREMENT IS A RESULT, NEVER A
      FAILURE, so a bad report still exits 0.
      This verb deliberately reports separate numbers and never a single
      combined figure: one aggregate is precisely what makes a coverage
      claim unfalsifiable, because any one weak measure can be hidden by
      averaging it against a strong one.

  export-asm <image> --store FILE [--out DIR] [--ledger FILE] [--force]
      Writes a TREE of ACME source files for a program from its annotation
      store into --out, a DIRECTORY (D47-A: one output shape at every layer,
      never a second one for a store with no scopes). <image> supplies the
      PAYLOAD BYTES and the load origin; --store names the ANNOTATION STORE
      holding the ranges, labels, comments and enums. Those are two separate
      files on purpose, and NEITHER IS DERIVED FROM THE OTHER: the store
      holds annotations and never bytes, so an exporter has to be told which
      bytes it is describing and this verb refuses to guess one from the
      other.
      The tree's entry point is root.a, which !sources symbols.a (every
      symbol definition) first, then one file per annotation scope, then
      unscoped.a last for any block that lies inside no scope. A store with
      no scopes yet still writes this same three-file shape -- root.a,
      symbols.a, unscoped.a -- rather than a second, single-file output.
      The default --out is a DIRECTORY beside the STORE: the image's basename
      stem plus a fixed, extension-free suffix (no --out DIR should ever read
      as a file). That derived default is put through the SAME confinement
      seam as a caller-supplied --out, rather than trusted because this verb
      computed it. The directory may not BE, and may not CONTAIN, the store,
      the image or the ledger -- --force does not lift that refusal any more
      than it lifts the single-file version of it did. A non-empty
      destination is otherwise refused unless --force is passed, and --force
      replaces only the names this export itself produces -- any other entry
      already in the directory is refused by name, never deleted to make
      room.
      --ledger names c64-provenance-diff's generated recovery/PROVENANCE.md.
      Supplying it makes the export carry each covered range's recorded
      Verdict and Confidence as inline comments. It is OPTIONAL:
      omitting it exports exactly as before. The flag changes COMMENT TEXT
      ONLY -- it never changes which bytes or which blocks are emitted, and a
      range the supplied ledger does not cover is refused by name rather than
      emitted unannotated.
      Requires an EXISTING annotation store and an EXISTING image, and
      creates neither.
      THIS VERB DOES NOT ASSEMBLE ITS OUTPUT. It writes source text and
      nothing more: it starts no assembler, reads no assembler's exit status
      and compares no bytes. Whether that source reassembles to the image it
      came from is settled by the byte-diff oracle in this project's own test
      suite, which is deliberately test-only, so nothing this command prints
      may be read as a verification result.
      Refuses, by name and with exit 1, any annotation the exporter cannot
      express -- a range the image does not cover, an enum bound to an
      operand that cannot carry it, a comment with no line to attach to.
      Such an annotation is never silently dropped while this command
      reports success.

  evid-disagreements --store FILE [--json]
      Answers where the store's byte-derived block classification (its own
      typed ranges) and the observed-execution evidence (anno_evid_exec rows,
      written by anno_evid_ingest) DISAGREE -- the SAME reconciliation join
      the anno_evid_disagreements MCP tool calls, run here against a real
      store and rendered as three distinguishable states. Disagreements
      print FIRST, as rows; agreement prints as a single count line, never
      as rows; an address the block table covers with no observation
      anywhere prints as its own count line stating plainly that absence
      proves nothing -- never evidence that the address holds data. Two
      further count lines name evidence about addresses the block table
      does not classify as code or data at all, so a reader summing every
      line gets what the block table covers, never what the program is.
      No percentage, rate or coverage figure is ever printed. --json prints
      the raw JSON answer instead of the rendered report.
      Requires an EXISTING annotation store; creates none and writes
      nothing.

  decomp-completeness --store FILE --disagreements FILE --manifest FILE [--json]
      The decomposition-closure completeness answer for ONE
      per-fixture store. Three REQUIRED arguments, none defaulted from
      another: --store names the annotation store; --disagreements names the
      JSON "anno evid-disagreements --store <same store> --json" wrote for
      THIS store's own run; --manifest names the execution manifest
      recording which committed fixtures were actually run. Omitting ANY of
      the three refuses BY NAME with exit 1 -- there is no default and no
      empty-array substitute for a missing disagreement input, because an
      omitted query and a query that found nothing must never render the
      same report.
      The supplied --disagreements document is refused, by name, when it is
      missing any EvidReconciliation field, and when its own recorded
      runIdentity (image_sha256/argv_digest/seed) matches no row in the
      SAME store's own evid-runs table -- a fabricated or foreign empty
      document is refused, never rendered as "no disagreements" (RESEARCH.md
      Pitfall 9, anti-vacuity). The supplied --manifest is refused, by name,
      when it does not list the fixture this store belongs to -- an unlisted
      fixture is never defaulted to "executed".
      Reports the store's byte census (per data type, with an explicit
      denominator and an undefined-byte count that must read zero), the
      survivor search (auto-named labels still sitting in a code region,
      matched by the SAME frozen prefix set routine-queue-walker's own
      candidate queue uses), the fixture's own execution disposition read
      from --manifest (a NOT EXECUTED fixture renders that fact by name,
      never a clean bill of health), and the disagreement input verbatim.
      Never prints a percentage, rate or combined figure -- the same rule
      this CLI applies to every verb's own report. --json prints the raw
      JSON answer instead of the rendered report.
      Requires an EXISTING annotation store, an EXISTING --disagreements
      document and an EXISTING --manifest file; creates none and writes
      nothing.

  hazard-report --store FILE --image FILE [--json]
      Enumerates what blocks a program's code or data from being MOVED,
      relocated, rebased or stripped, across the movement-hazard
      constructions this surface can detect from decoded bytes alone. It
      REPORTS and changes NOTHING: it never removes, strips, relocates or
      rebases any part of the image, and never prints anything a caller
      could act on as an automatic relocation -- the operator decides.
      Findings print first, under their own heading, each carrying its own
      detection mechanism and detection-strength token. Region dispositions
      print next, grouped under three separate headings by outcome
      (hazard-reported, no-signal, unclassified) -- the no-signal heading's
      own text states plainly that no detection is not evidence that a
      region is safe to move. The named limits print last, verbatim. No
      percentage, rate or combined verdict is ever printed; each heading
      prints its own count against the report's own denominator. --json
      prints the raw JSON answer instead of the rendered report.
      Requires an EXISTING annotation store and an EXISTING image; creates
      neither and writes nothing.

Every verb requires inputs that already exist. None creates a project, a
store or a sidecar, and none derives one path from another -- this CLI
never guesses.
`;

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * The ONE declared verb-to-accepted-options fact in this
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
 * defaulted from `<image>` -- see this file's header on never deriving one
 * caller-supplied path from another. `export-asm`'s `--store` is required on
 * the same terms and for the same reason.
 *
 * `export-asm` deliberately carries NO assembler-facing option. It writes
 * source and runs no assembler, so there is no binary to name, no exit status
 * to surface and no flag that could imply either. `--ledger` does not weaken
 * that claim: it is an EVIDENCE-CARRYING
 * INPUT, exactly like `--store`, never an assembler-facing option -- it names
 * a file to READ, not a way to run or configure an assembler.
 */
export const VERB_OPTIONS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "render-memmap": ["--provenance", "--out", "--force", "--check"],
  coverage: ["--store", "--out", "--force", "--sample"],
  "export-asm": ["--store", "--out", "--ledger", "--force"],
  "evid-disagreements": ["--store", "--json"],
  "decomp-completeness": ["--store", "--disagreements", "--manifest", "--json"],
  "hazard-report": ["--store", "--image", "--json"],
});

/**
 * The one shared refusal check generalises to every verb (the same
 * closed-option-set posture, applied uniformly rather than verb by verb).
 * Scans `rest` for any `--flag`-shaped token not in `verb`'s accepted set
 * from `VERB_OPTIONS` and returns a one-line refusal naming the flag and the
 * accepted set; returns `undefined` when every flag-shaped token is
 * accepted (or when `verb` is not a key in the map at all, so an unknown
 * verb still falls through to `runAnnoCli()`'s own "unknown verb"
 * message). Never throws -- this file's never-throw posture applies here
 * too.
 *
 * THE LOOKUP IS AN OWN-PROPERTY READ, AND THAT IS THE WHOLE POINT (fixed
 * 2026-08-31, after a real crash reproduced it). `VERB_OPTIONS` is an object literal, so it
 * inherits from `Object.prototype`; a bare `VERB_OPTIONS[verb]` resolved
 * `hasOwnProperty`, `toString`, `constructor`, `valueOf` and `__proto__` to
 * TRUTHY inherited FUNCTIONS. Those sailed past the `if (!accepted) return
 * undefined` short-circuit and the next line crashed. Reproduced against the
 * shipped table before this fix:
 *
 *   `anno hasOwnProperty game.prg --force` -> TypeError: accepted.includes is not a function
 *
 * The call site at `runAnnoCli()` sits OUTSIDE that function's `try`, so the
 * throw escaped the function entirely and broke the never-throw contract this
 * file's header states. The identical defect was found and fixed one
 * directory over in this same phase -- `scripts/lib/anno-cli-invocations.mjs`
 * reads every verb-keyed table through its `own()` helper, and one of that
 * file's controls quotes THIS file's variable name verbatim as
 * `"accepted.includes is not a function"`. The hardening stopped at the
 * checker and never reached the CLI the checker models; it reaches it now.
 *
 * `Array.isArray()` rather than a bare truthiness test is deliberate belt and
 * braces: an own key whose value is somehow not an array falls through to
 * "unknown verb" instead of reaching `.includes()`.
 */
export function checkAcceptedOptions(verb: string, rest: string[]): string | undefined {
  const accepted = Object.hasOwn(VERB_OPTIONS, verb) ? VERB_OPTIONS[verb] : undefined;
  if (!Array.isArray(accepted)) return undefined;
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
 * passed `--force`. Called by the TWO verbs that write a single output FILE
 * -- `cmdRenderMemmap()` (non-`--check` branch only; `--check` never writes)
 * and `cmdCoverage()` -- so overwrite safety is uniform across both rather
 * than one verb accreting a check the other lacks.
 *
 * "SHARED BY EVERY VERB THAT WRITES AN OUTPUT FILE" IS WHAT THIS DOC USED TO
 * SAY, AND IT WAS NOT TRUE. `render-memmap` wrote an output file and had
 * neither `--force` in its option set nor a call to this function anywhere on
 * its path; an independent review reproduced it destroying a pre-existing file
 * silently, exit code 0. The claim is now stated as the TWO call sites it
 * actually has, because a count is checkable where "every" is not.
 *
 * "THE TWO CALL SITES" IS WHAT THIS SENTENCE SAID UNTIL 2026-08-31, AFTER
 * `cmdExportAsm()` BECAME THE THIRD. The paragraph directly
 * above had been updated to name all three; this one, whose entire point is
 * that a COUNT is checkable where "every" is not, was left carrying a stale
 * count -- the failure mode it exists to argue against, reproduced in
 * miniature two lines below itself. `anno-cli.test.ts` now asserts the count
 * mechanically, the way `anno-cli-path-consumers.test.ts` already does for the
 * confinement seam, so the next verb to write an output file cannot leave this
 * number behind again.
 *
 * BACK DOWN TO TWO, after `export-asm`'s `--out` was promoted
 * from a FILE to a DIRECTORY. A directory's overwrite question --
 * does this directory already hold something, and may `force` replace it --
 * is `exportAsmTree()`'s own output-directory contract,
 * never this function's single-file question, so `cmdExportAsm()` dropped its
 * call here rather than reshaping a file-shaped check to fit a directory. The
 * count this doc states, and the count `anno-cli.test.ts` checks mechanically,
 * moved back down to two with it.
 *
 * `outPath` MUST already be confined through `storePathWithinWorkspace()`.
 * This function performs no confinement of its own and must never be read as
 * providing any: it answers "does this file already exist", which is a
 * different question from "may this process write here", and running it
 * against an unconfined path produces a check that guards the wrong file.
 */
function refuseOverwrite(outPath: string, force: boolean | undefined, verbLabel: string, extraHint = ""): boolean {
  if (force || !existsSync(outPath)) return true;
  console.error(
    `${verbLabel}: refusing to overwrite the existing file ${outPath}${extraHint} -- ` +
      `pass --force to overwrite it deliberately.`,
  );
  return false;
}

/**
 * THE ONE "is this token a value, or the next flag?" TEST, shared by all THREE
 * option parsers below (fixed 2026-08-31, after a real failure reproduced it).
 *
 * The `*MissingValue` mechanism exists precisely to avoid "silently swallowing
 * the next token" when an option is given without its value. Until this
 * helper, each of the SEVEN option-with-a-value sites spelled the test inline
 * as `value === undefined || value.startsWith("--")` -- which refuses a
 * DOUBLE-dash token and accepts a single-dash one. So
 * `anno export-asm g.prg --store -x` took `-x` as the store path, and the run
 * failed downstream as a confinement or not-found error about a file called
 * `-x` rather than as the `--store requires a value` refusal the parser was
 * written to produce. A single-dash token is exactly the case the mechanism
 * missed.
 *
 * ANY leading `-` is refused, including a bare `-`. No verb in this CLI reads
 * stdin, so `-` has no meaning here, and a path that genuinely begins with a
 * dash is addressable as `./-x` -- which is also how every other CLI a caller
 * has used behaves. Refusing beats guessing which of the two a caller meant.
 *
 * ONE PREDICATE, SEVEN CALL SITES, deliberately: the three parsers' own docs
 * each claim they are "the SAME shape ... rather than a third convention", and
 * an inline copy per site is how that claim quietly stops being true. A fix
 * applied to one parser would leave the finding armed in the other two.
 */
function isMissingOptionValue(value: string | undefined): boolean {
  return value === undefined || value.startsWith("-");
}

interface RenderMemmapParsedArgs {
  positional: string[];
  provenance?: string;
  provenanceMissingValue?: boolean;
  out?: string;
  outMissingValue?: boolean;
  force?: boolean;
  check?: boolean;
  unknownOption?: string;
}

/** Fixed, closed option set for render-memmap -- exactly `--provenance`,
 * `--out`, `--force` and `--check`. Per this file's closed-option-set posture (do not silently
 * accept a flag a verb does not implement, or a flag missing its value), any
 * OTHER `--flag`-shaped token is refused as `unknownOption`, and
 * `--provenance`/`--out` with no value (or a flag-shaped "value") is refused
 * via their own `*MissingValue` fields.
 *
 * `--force` is parsed in the SAME boolean shape `parseCoverageArgs()` already
 * uses, deliberately rather than as a second convention: it feeds the same
 * `refuseOverwrite()` every writing verb shares, so a caller who learns the
 * opt-in on one verb has learned it on the others. */
function parseRenderMemmapArgs(rest: string[]): RenderMemmapParsedArgs {
  const positional: string[] = [];
  let provenance: string | undefined;
  let provenanceMissingValue = false;
  let out: string | undefined;
  let outMissingValue = false;
  let force = false;
  let check = false;
  let unknownOption: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--provenance") {
      const value = rest[i + 1];
      if (isMissingOptionValue(value)) {
        provenanceMissingValue = true;
      } else {
        provenance = value;
        i++;
      }
    } else if (a === "--out") {
      const value = rest[i + 1];
      if (isMissingOptionValue(value)) {
        outMissingValue = true;
      } else {
        out = value;
        i++;
      }
    } else if (a === "--force") {
      force = true;
    } else if (a === "--check") {
      check = true;
    } else if (a.startsWith("--")) {
      unknownOption ??= a;
    } else {
      positional.push(a);
    }
  }
  return { positional, provenance, provenanceMissingValue, out, outMissingValue, force, check, unknownOption };
}

/**
 * `render-memmap <store> --provenance FILE [--out FILE] [--force] [--check]`
 * -- the generated-view verb, via `anno-memmap-render.ts`'s
 * `renderMemoryMap()`/`checkRenderedMemoryMap()`. Never writes a file when
 * `--check` is given -- that mode only reads and reports.
 *
 * ALL THREE OF THIS VERB'S PATHS ARE CONFINED, and the reason each one is
 * named here rather than left to a reader to infer is that two of them were
 * NOT, and shipped that way. An independent verification pass
 * reproduced both on this tree:
 *
 *   - `--out` reached `writeFileSync` as the RAW caller string. Pointed
 *     outside the workspace root it exited 0, printed `wrote /tmp/.../
 *     PRECIOUS.md` and replaced that pre-existing file's bytes. `--force`
 *     was not in this verb's option set at all, so `refuseOverwrite()` --
 *     whose own doc claims the safety is uniform across every verb that
 *     writes an output file -- was never reached from here.
 *   - `--provenance` reached `readFileSync` as the RAW caller string, making
 *     it an arbitrary-file read oracle; the sidecar parse failure then
 *     interpolated Node's own parse error, which carries a snippet of the
 *     file, so the oracle DISCLOSED CONTENT. Confining it here also
 *     confines it for `anno-memmap-render.ts`, which reads it with no check
 *     of its own.
 *
 * Every one of them now goes through the SAME one confinement seam,
 * `storePathWithinWorkspace()` against `repoRoot()` (T-29-51) -- never a
 * second hand-rolled rule, and never a suffix check standing in for a
 * location check. The DEFAULT output path is confined too, deliberately: a
 * derived path is confined by the same rule as a caller-supplied one rather
 * than trusted because it was derived.
 *
 * The predicate was never the weak half -- `anno-confinement.test.ts` proves
 * it fifteen ways. Its CONSUMER SET was unenumerated, and that asymmetry is
 * the whole mechanism by which both findings shipped past a green suite.
 * `anno-cli-path-consumers.test.ts` is what closes it: it enumerates every
 * caller-supplied path argument this CLI accepts -- flags from
 * `VERB_OPTIONS`, positionals from each verb's `--help` synopsis line -- and
 * fails when the inventory and the surface disagree in either direction, or
 * when this file's confinement call sites number fewer than the inventory's
 * entries. It does not associate a particular argument with a particular call
 * site, so six arguments confined once each and five confined with one
 * of them confined twice read the same to it; that limit is named here rather
 * than papered over. A header that asserts a property must point at the
 * mechanism that keeps it, and must claim no more than the mechanism checks.
 */
async function cmdRenderMemmap(rest: string[]): Promise<number> {
  const {
    positional,
    provenance,
    provenanceMissingValue,
    out,
    outMissingValue,
    force,
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

  const store = positional[0];
  if (!store) {
    console.error("render-memmap: usage: render-memmap <store> --provenance FILE [--out FILE] [--check]");
    return 1;
  }

  // T-29-51 / T-19-22: the ONE confinement seam, the same one `coverage` puts
  // both of its caller-supplied paths through. `openStore()` downstream is
  // handed this same workspace root, so its own confinement agrees by
  // construction rather than by a second rule.
  const workspaceRoot = repoRoot();
  let storePath: string;
  try {
    storePath = storePathWithinWorkspace(store, workspaceRoot);
  } catch (err) {
    console.error(`render-memmap: ${errMsg(err)}`);
    return 1;
  }
  if (!existsSync(storePath)) {
    console.error(
      `render-memmap: annotation store not found: ${storePath} -- refusing to CREATE one, because "the annotations are ` +
        'gone" and "there are no annotations" must not read the same.',
    );
    return 1;
  }
  if (!provenance) {
    console.error("render-memmap: --provenance FILE is required\n");
    console.log(USAGE);
    return 1;
  }

  // The sidecar is confined BEFORE the existence check, so a path
  // outside the workspace root never reaches the filesystem at all -- not as
  // an `existsSync` probe (which is itself an oracle: it answers "does this
  // file exist" for any path the process can stat) and not as the
  // `readFileSync` inside `renderMemoryMap()`. From here on the RAW caller
  // string is dead: `provenancePath` is the realpath the seam returned, and
  // it is what every downstream call receives.
  let provenancePath: string;
  try {
    provenancePath = storePathWithinWorkspace(provenance, workspaceRoot);
  } catch (err) {
    console.error(`render-memmap: ${errMsg(err)}`);
    return 1;
  }
  if (!existsSync(provenancePath)) {
    console.error(`render-memmap: provenance sidecar not found: ${provenancePath}`);
    return 1;
  }

  // The default is applied FIRST and the result confined AFTER, so the
  // derived path and a caller-supplied one are confined by the same rule --
  // rather than the default being trusted because this verb computed it.
  let outPath: string;
  try {
    outPath = storePathWithinWorkspace(out ?? join(dirname(storePath), "memory-map.md"), workspaceRoot);
  } catch (err) {
    console.error(`render-memmap: ${errMsg(err)}`);
    return 1;
  }

  if (check) {
    let result: Awaited<ReturnType<typeof checkRenderedMemoryMap>>;
    try {
      result = await checkRenderedMemoryMap({ storePath, provenancePath, renderedPath: outPath, workspaceRoot });
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

  // The second half of that same fix. `--check` never writes, so the overwrite refusal
  // belongs on THIS branch only -- and it runs against the CONFINED path, so
  // the file it protects is the file that would actually be written.
  if (!refuseOverwrite(outPath, force, "render-memmap")) {
    return 1;
  }

  let rendered: Awaited<ReturnType<typeof renderMemoryMap>>;
  try {
    rendered = await renderMemoryMap({ storePath, provenancePath, workspaceRoot });
  } catch (err) {
    console.error(`render-memmap: ${errMsg(err)}`);
    return 1;
  }
  try {
    writeFileSync(outPath, rendered.markdown);
  } catch (err) {
    // The same shape as bootstrapProject()'s write above,
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
 * `--force` and `--sample`. Same closed-option-set posture as `parseRenderMemmapArgs()`
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
      if (isMissingOptionValue(value)) {
        storeMissingValue = true;
      } else {
        store = value;
        i++;
      }
    } else if (a === "--out") {
      const value = rest[i + 1];
      if (isMissingOptionValue(value)) {
        outMissingValue = true;
      } else {
        out = value;
        i++;
      }
    } else if (a === "--sample") {
      const value = rest[i + 1];
      if (isMissingOptionValue(value)) {
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
//   LabelRow   -> AnnoSymbol        address, name, kind. `kind` needs no
//                                    translation: the store's LABEL_KINDS are
//                                    the same four tokens the census filters
//                                    on ("User"/"Auto"/"System"/"Platform").
//                                    `id` and `bank` are store-only and are
//                                    dropped. The census never reads a
//                                    symbol's `type`, so its absence from the
//                                    store costs nothing.
//   CommentRow -> AnnoComment       address, commentType -> type, text ->
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
//   derived    -> AnnoCrossReference the union `crossReferencesTo()` computes
//                                    from the bytes, the typed split tables
//                                    and the stored rows.
// ---------------------------------------------------------------------------

/** `LabelRow[]` as the census's symbol shape. */
export function symbolsFromStore(rows: readonly LabelRow[]): AnnoSymbol[] {
  return rows.map((row) => ({ address: row.address, name: row.name, kind: row.kind }));
}

/** `CommentRow[]` as the census's comment shape. */
export function commentsFromStore(rows: readonly CommentRow[]): AnnoComment[] {
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
  symbols: readonly AnnoSymbol[],
): AnnoCrossReference[] {
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
 * census reads them from -- and, since 2026-08-30, through the SAME FUNCTION.
 *
 * NOT a second byte source, and no longer only by convention. This used to be
 * a second hand-rolled decode sitting beside `buildCoverageReport()`'s own,
 * with a comment asking a reader to keep the two in step; two decodes over one
 * path is two answers to "which program does this report describe", and the
 * comment was the only thing holding them together (`T-29-16-02`). It now
 * delegates to `anno-coverage.ts`'s exported `loadProjectImage()`, so the
 * derived half and the censused half of one report CANNOT describe different
 * programs -- they are the same call.
 *
 * Returns `null` -- never a throw and never a guess -- when the payload did
 * not decode or decoded to nothing. The census reports that same condition
 * itself, in its own words, and the verb exits non-zero on it.
 */
function projectImage(projectPath: string): { origin: number; bytes: Uint8Array } | null {
  let loaded: LoadedProject;
  try {
    loaded = loadProjectImage(projectPath);
  } catch {
    // The one throw the loader has left is an unreadable PATH. This verb has
    // already checked existence above and the census reports the condition in
    // its own words, so a null is the right answer here rather than a second
    // diagnosis of the same fact.
    return null;
  }
  if (!loaded.payloadDecoded || loaded.bytes.length === 0) return null;
  return { origin: loaded.origin, bytes: loaded.bytes };
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
 * THE ONE RULE THIS FUNCTION EXISTS TO HOLD (and the reason the
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
 * `coverage <image> --store FILE [--out FILE] [--force] [--sample N]` --
 * This verb's delivery path: the instrument from `anno-coverage.ts`, run against
 * a real program and a real annotation store.
 *
 * TWO PATHS, NEITHER DERIVED FROM THE OTHER. `<image>` carries the payload
 * bytes and the load origin; `--store` names the annotation store holding the
 * labels, comments and typed ranges. The store holds annotations and never
 * bytes, so a derived measure has to be told which bytes it is measuring, and
 * guessing one path from the other is exactly the auto-pick this file forbids.
 *
 * Two properties this function must keep:
 *   - NO SECOND PATH VALIDATOR (T-19-22 / T-29-28), over ALL THREE of this
 *     verb's caller-supplied paths -- the positional, `--store` and `--out`.
 *     The count is stated because it was WRONG: this doc said "both" and meant
 *     it, while `--out` reached `refuseOverwrite()` and `writeFileSync()` as
 *     the raw caller string. An independent review reproduced the escape --
 *     `coverage <project> --store <store> --out /tmp/...` wrote the report
 *     outside the workspace root. All three now go through
 *     `storePathWithinWorkspace()` against `repoRoot()` -- the one seam, the
 *     same one `anno-tools.ts` puts its own store and image arguments through.
 *     `openStore()` is then handed the same workspace root, so its own
 *     confinement agrees by construction rather than by a second rule. The
 *     enumeration is now mechanical rather than prose:
 *     `anno-cli-path-consumers.test.ts` inventories this verb's path
 *     arguments -- flags from `VERB_OPTIONS`, positionals from the `--help`
 *     synopsis line -- and fails when that inventory and the surface disagree
 *     either way, or when this file's confinement call sites number fewer
 *     than the inventory's entries. It does not associate a given argument
 *     with a given call site, so it cannot tell six arguments
 *     confined once each from five confined with one confined twice.
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
    console.error("coverage: usage: coverage <image> --store FILE [--out FILE] [--force] [--sample N]");
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

  // The ONE confinement seam, for ALL THREE
  // caller-supplied paths. Never a second hand-rolled one, and never a
  // different rule for the store than for the program it annotates -- or, as
  // an earlier review found, no rule at all for the report this verb writes.
  const workspaceRoot = repoRoot();
  let projectPath: string;
  let storePath: string;
  let outPath: string | undefined;
  try {
    projectPath = storePathWithinWorkspace(project, workspaceRoot);
    storePath = storePathWithinWorkspace(store, workspaceRoot);
    outPath = out === undefined ? undefined : storePathWithinWorkspace(out, workspaceRoot);
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

  // Against the CONFINED path, so the file this check protects is the file
  // that would actually be written.
  if (outPath !== undefined && !refuseOverwrite(outPath, force, "coverage")) {
    return 1;
  }

  let symbols: AnnoSymbol[];
  let comments: AnnoComment[];
  let blocks: BlockEntry[];
  let crossReferences: AnnoCrossReference[];
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

  if (outPath !== undefined) {
    try {
      writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
    } catch (err) {
      console.error(`coverage: could not write ${outPath}: ${errMsg(err)}`);
      return 1;
    }
    // The CONFINED path, so the line names the file that was actually written
    // rather than whatever the caller typed.
    console.log(`coverage: wrote ${outPath} (schema version ${report.schemaVersion})`);
  }

  if (!report.project.payloadDecoded) {
    // Not a low measurement -- an unreadable payload means every byte-side
    // measure above was computed over nothing. Reported as the caller-facing
    // failure it is, AFTER the report, so the reason is on screen.
    console.error(`coverage: the project's payload was UNAVAILABLE -- ${report.project.reason ?? "reason not recorded"}`);
    return 1;
  }
  return 0;
}

interface ExportAsmParsedArgs {
  positional: string[];
  store?: string;
  storeMissingValue?: boolean;
  out?: string;
  outMissingValue?: boolean;
  /** The ledger `c64-provenance-diff` generates
   * (`recovery/PROVENANCE.md`). OPTIONAL -- see `ExportAsmOptions.ledgerPath`
   * in `anno-export-asm.ts` for why. */
  ledger?: string;
  ledgerMissingValue?: boolean;
  force?: boolean;
  unknownOption?: string;
}

/** Fixed, closed option set for export-asm -- exactly `--store`, `--out`,
 * `--ledger` and `--force`. The SAME closed-option-set posture, and deliberately the same
 * SHAPE, as `parseRenderMemmapArgs()` and `parseCoverageArgs()` above rather
 * than a third convention: an unimplemented flag is refused as
 * `unknownOption`, and `--store`/`--out`/`--ledger` with a missing or
 * flag-shaped value are refused through their own `*MissingValue` fields
 * rather than silently swallowing the next token. */
function parseExportAsmArgs(rest: string[]): ExportAsmParsedArgs {
  const positional: string[] = [];
  let store: string | undefined;
  let storeMissingValue = false;
  let out: string | undefined;
  let outMissingValue = false;
  let ledger: string | undefined;
  let ledgerMissingValue = false;
  let force = false;
  let unknownOption: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--store") {
      const value = rest[i + 1];
      if (isMissingOptionValue(value)) {
        storeMissingValue = true;
      } else {
        store = value;
        i++;
      }
    } else if (a === "--out") {
      const value = rest[i + 1];
      if (isMissingOptionValue(value)) {
        outMissingValue = true;
      } else {
        out = value;
        i++;
      }
    } else if (a === "--ledger") {
      const value = rest[i + 1];
      if (isMissingOptionValue(value)) {
        ledgerMissingValue = true;
      } else {
        ledger = value;
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
  return { positional, store, storeMissingValue, out, outMissingValue, ledger, ledgerMissingValue, force, unknownOption };
}

/**
 * The destination `export-asm` writes to when the caller names none: the
 * IMAGE's basename STEM plus a fixed, extension-free suffix, in the STORE's
 * own directory.
 *
 * The store's directory rather than the image's, deliberately and for the
 * reason `render-memmap`'s `memory-map.md` default already gives: the output
 * is a GENERATED VIEW of the annotations, so it belongs beside the artefact it
 * was generated from. The image is an input this verb only reads.
 *
 * NO EXTENSION, on purpose (`--out` was promoted from a
 * FILE to a DIRECTORY). This names a directory the tree is written
 * INTO, never a file -- a name ending in `.a` would read as a file to every
 * human and every tool that inspects it, and the tree this verb writes is
 * not one. The stem is derived the same way it always was (whatever
 * extension the image happens to carry is stripped, so `game.prg` and
 * `game.raw` derive the same default), the suffix is fixed text this
 * function owns rather than anything read off the image, and a name with no
 * extension at all keeps its whole basename.
 */
function defaultExportAsmOut(imagePath: string, storeDir: string): string {
  const base = basename(imagePath);
  const ext = extname(base);
  const stem = ext === "" ? base : base.slice(0, -ext.length);
  return join(storeDir, `${stem}-src`);
}

/**
 * Whether `containerPath` (a directory `--out` is about to become, or
 * already is) either equals `candidate` exactly, or genuinely CONTAINS it.
 * Compared by PATH SEGMENT via a trailing separator, never by string prefix
 * (T-47-14) -- `candidate.startsWith(containerPath)` alone would also match a
 * SIBLING whose name merely starts with the same characters (`game-src2`
 * beside `game-src`), which is exactly the false positive a segment boundary
 * rules out.
 *
 * Both arguments MUST already be confined, realpath-resolved strings (this
 * verb's inputs and `--out` all go through `storePathWithinWorkspace()`
 * before either ever reaches here); this function performs no confinement of
 * its own and compares the two strings it is given.
 */
function pathIsOrContains(containerPath: string, candidate: string): boolean {
  if (candidate === containerPath) return true;
  const withTrailingSep = containerPath.endsWith(sep) ? containerPath : containerPath + sep;
  return candidate.startsWith(withTrailingSep);
}

/**
 * `export-asm <image> --store FILE [--out DIR] [--ledger FILE] [--force]` --
 * a TREE of ACME source files for a program, emitted from its annotation
 * store by `anno-export-asm.ts`'s `exportAsmTree()` (`--out` promoted from a
 * FILE to a DIRECTORY, a decision made deliberately at a checkpoint rather
 * than left to fall out of implementation).
 *
 * EVERY ONE OF THIS VERB'S PATHS IS CONFINED, and the ORDER each step happens
 * in is the load-bearing part rather than the mere presence of the calls. It
 * follows `cmdRenderMemmap()`'s chain deliberately, because that chain is the
 * corrected shape of three reproduced escapes (an independent verification
 * pass) on exactly the argument shapes this verb
 * has:
 *
 *   - `<image>` and `--store` go through `storePathWithinWorkspace()` BEFORE
 *     any `existsSync` probe. A stat is itself an oracle -- it answers "does
 *     this file exist" for any path this process can reach -- so probing first
 *     and confining second would leak that answer for a path the seam is about
 *     to refuse.
 *   - `--ledger` joins that SAME confinement
 *     block, on the SAME terms, WHEN SUPPLIED -- it is a third input this run
 *     reads, not a second-class one confined later or not at all.
 *   - `--out`'s DEFAULT is applied FIRST and the result confined AFTER, so a
 *     path this verb computed is confined by the same rule as one a caller
 *     supplied, rather than trusted because this verb computed it.
 *     This is unchanged by the file-to-directory promotion: the confined
 *     result now NAMES A DIRECTORY rather than a file, but it is confined by
 *     the exact same call.
 *   - From each seam call onwards the RAW CALLER STRING IS DEAD.
 *     `storePathWithinWorkspace()` returns the REALPATH, and it is the
 *     realpath that reaches `readFileSync`, `openStore()`, `pathIsOrContains()`
 *     and `exportAsmTree()` -- so every printed line names the file or
 *     directory that is actually on disk.
 *   - The output directory may not BE, and may not CONTAIN, any of the three
 *     inputs -- generalised from the single-file version's plain
 *     equality check, once this verb started writing a directory rather than
 *     a file. `pathIsOrContains()` runs against
 *     the CONFINED destination and each CONFINED input, so what it protects
 *     is the input that would actually be read and the directory that would
 *     actually be written into -- and `--force` does not lift this refusal,
 *     for the same reason the single-file version never let it: nobody
 *     types `--force` meaning "destroy the annotations I spent a month
 *     writing".
 *   - The output-directory's own overwrite question -- does it already hold
 *     something, and may `--force` replace it -- is `exportAsmTree()`'s own
 *     contract, not a second check grown here. This
 *     verb adds no overwrite rule of its own for the directory as a whole.
 *
 * WHAT THIS VERB DOES NOT DO, stated here as well as in `USAGE` because a
 * reader of the code must not have to infer it: it does not assemble. It
 * spawns nothing, reads no assembler's exit status and compares no bytes. The
 * byte-diff oracle that settles whether this source reassembles to the image
 * it came from is test-only and is not importable from here -- a shipped
 * module importing it would drag a test-only module into `package.json`'s
 * `files[]` closure. Nothing this function prints may therefore read as a
 * verification result, and the summary says so in as many words.
 */
async function cmdExportAsm(rest: string[]): Promise<number> {
  const { positional, store, storeMissingValue, out, outMissingValue, ledger, ledgerMissingValue, force, unknownOption } =
    parseExportAsmArgs(rest);

  if (unknownOption) {
    console.error(`export-asm: unknown option "${unknownOption}"\n`);
    console.log(USAGE);
    return 1;
  }
  if (storeMissingValue) {
    console.error("export-asm: --store requires a value\n");
    console.log(USAGE);
    return 1;
  }
  if (outMissingValue) {
    console.error("export-asm: --out requires a value\n");
    console.log(USAGE);
    return 1;
  }
  if (ledgerMissingValue) {
    console.error("export-asm: --ledger requires a value\n");
    console.log(USAGE);
    return 1;
  }

  if (positional.length !== 1) {
    console.error("export-asm: usage: export-asm <image> --store FILE [--out DIR] [--ledger FILE] [--force]");
    return 1;
  }
  const image = positional[0]!;
  if (!store) {
    console.error(
      "export-asm: --store FILE is required -- the annotation store holds the ranges, labels, comments and enums, " +
        "and this verb will not derive its path from <image>.\n",
    );
    console.log(USAGE);
    return 1;
  }

  // The ONE confinement seam, on both input paths, BEFORE any
  // filesystem probe. `openStore()` downstream is handed this same workspace
  // root, so its own confinement agrees by construction rather than by a
  // second rule. `--ledger` joins this SAME block, WHEN SUPPLIED -- confined
  // before any probe on the same terms as `<image>` and `--store`, never
  // confined later or by a second rule.
  const workspaceRoot = repoRoot();
  let imagePath: string;
  let storePath: string;
  let ledgerPath: string | undefined;
  try {
    imagePath = storePathWithinWorkspace(image, workspaceRoot);
    storePath = storePathWithinWorkspace(store, workspaceRoot);
    if (ledger !== undefined) {
      ledgerPath = storePathWithinWorkspace(ledger, workspaceRoot);
    }
  } catch (err) {
    console.error(`export-asm: ${errMsg(err)}`);
    return 1;
  }
  if (!existsSync(storePath)) {
    console.error(
      `export-asm: annotation store not found: ${storePath} -- refusing to CREATE one, because "the annotations are ` +
        'gone" and "there are no annotations" must not read the same.',
    );
    return 1;
  }
  if (!existsSync(imagePath)) {
    console.error(`export-asm: image not found: ${imagePath}`);
    return 1;
  }
  if (ledgerPath !== undefined && !existsSync(ledgerPath)) {
    console.error(
      `export-asm: ledger not found: ${ledgerPath} -- regenerate it with c64-provenance-diff's "ledger" verb, or omit ` +
        "--ledger to export without provenance annotation.",
    );
    return 1;
  }

  // The default is applied FIRST and the RESULT confined,
  // so the derived path and a caller-supplied one are confined by the same
  // rule.
  let outPath: string;
  try {
    outPath = storePathWithinWorkspace(out ?? defaultExportAsmOut(imagePath, dirname(storePath)), workspaceRoot);
  } catch (err) {
    console.error(`export-asm: ${errMsg(err)}`);
    return 1;
  }

  // THE OUTPUT DIRECTORY MAY NOT BE, AND MAY NOT CONTAIN, AN INPUT, AND
  // `--force` DOES NOT OVERRIDE THIS (generalising an earlier plain-equality
  // refusal to containment now that `--out` names a directory
  // a whole tree is written into). The single-file version of this refusal
  // existed because `outPath` was confined and overwrite-checked but never
  // COMPARED to the inputs, so `anno export-asm game.raw --store g.annostore
  // --out g.annostore --force` overwrote the annotation store with ACME
  // text. Promoting `--out` to a directory widens the blast radius of the
  // same mistake from one file to everything the directory would hold, so the
  // check widens from equality to containment with it: the directory may not
  // itself BE an input's own path, and no input may live INSIDE it.
  // `--ledger` joins this SAME check: it is a
  // THIRD input this run reads, and `--force` must not lift the refusal for
  // it any more than it lifts it for the store or the image.
  //
  // SEPARATE FROM `exportAsmTree()`'s OWN output-directory contract AND
  // UNCONDITIONAL, deliberately. `--force` means "yes, replace the tree I
  // exported here before"; it cannot mean "yes, destroy the annotations I
  // spent a month writing", because nobody types it for that reason. This is
  // the one refusal in this file `--force` does not lift.
  //
  // Every path compared here is a confined realpath by this point
  // (`pathIsOrContains()`), so the comparison is exact and segment-bounded
  // rather than a string-shape guess about `..`, symlinks or a sibling
  // directory name that merely starts the same.
  for (const { path: inputPath, which } of [
    { path: storePath, which: "annotation store (--store)" },
    { path: imagePath, which: "image (<image>)" },
    { path: ledgerPath, which: "ledger (--ledger)" },
  ]) {
    if (inputPath !== undefined && pathIsOrContains(outPath, inputPath)) {
      console.error(
        `export-asm: refusing to write the exported tree to ${outPath} -- that directory is, or contains, this run's own ${which}. ` +
          `The export would destroy the input it was generated from, and --force does not lift this refusal. ` +
          `Pass a different --out.`,
      );
      return 1;
    }
  }

  // The output-directory contract itself -- create when missing, refuse a
  // non-empty directory without `--force`, and with `--force` replace only
  // the names this export produces -- lives entirely in `exportAsmTree()`.
  // This verb adds no second overwrite rule of its
  // own: it forwards the request and reports the library's own refusal
  // through this same single-line error path every other exporter refusal
  // already takes.
  let result: ExportAsmTreeResult;
  try {
    result = exportAsmTree({ storePath, imagePath, workspaceRoot, ledgerPath, outDir: outPath, force });
  } catch (err) {
    // Every refusal `exportAsmTree()` raises -- an uncovered range, an
    // inexpressible enum binding, a comment with no line to attach to, a
    // range crossing a scope boundary, or the output-directory contract's
    // own refusal -- arrives here already named. It is reported as this
    // verb's own single actionable line and never as a thrown stack trace,
    // and the verb exits non-zero rather than reporting success over a
    // dropped annotation or a scribbled-into directory.
    console.error(`export-asm: ${errMsg(err)}`);
    return 1;
  }
  // Every file this call wrote MINUS the two structural files that are
  // ALWAYS written (symbols.a, root.a) -- the scope files and the optional
  // unscoped.a, i.e. the files that actually carry this store's own content
  // rather than glue. `result.files.length` is never less than 2 (both are
  // unconditional), so this can never go negative.
  const dataFileCount = result.files.length - 2;
  console.log(
    `export-asm: wrote ${outPath} (${result.files.length} file(s), ${dataFileCount} data file(s), ${result.blocks.length} block(s), ` +
      `${result.symbolCount} symbol(s), ${result.autoNamedSymbolCount} auto-named, ${result.unexpressibleCount} unexpressible instruction(s), ` +
      `${result.midInstructionLabelCount} mid-instruction label(s), ${result.enumSubstitutionCount} enum substitution(s), ` +
      `${result.excludedRangeCount} exclusion(s) marked)`,
  );
  console.log("export-asm: this tree has NOT been assembled -- this command writes source text and runs no assembler.");
  return 0;
}

interface EvidDisagreementsParsedArgs {
  positional: string[];
  store?: string;
  storeMissingValue?: boolean;
  json?: boolean;
  unknownOption?: string;
}

/** Fixed, closed option set for evid-disagreements -- exactly `--store` and
 * `--json`. Same closed-option-set posture as every other verb's own parser: an
 * unimplemented flag is refused as `unknownOption`, and `--store` with a
 * missing or flag-shaped value is refused through its own `*MissingValue`
 * field rather than silently swallowing the next token. `--json` is a plain
 * boolean, parsed the same shape `--force`/`--check` already use. */
function parseEvidDisagreementsArgs(rest: string[]): EvidDisagreementsParsedArgs {
  const positional: string[] = [];
  let store: string | undefined;
  let storeMissingValue = false;
  let json = false;
  let unknownOption: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--store") {
      const value = rest[i + 1];
      if (isMissingOptionValue(value)) {
        storeMissingValue = true;
      } else {
        store = value;
        i++;
      }
    } else if (a === "--json") {
      json = true;
    } else if (a.startsWith("--")) {
      unknownOption ??= a;
    } else {
      positional.push(a);
    }
  }
  return { positional, store, storeMissingValue, json, unknownOption };
}

/**
 * Renders `r` as three separately-headed, textually-distinguishable
 * sections -- disagreements FIRST, agreement as a single count line,
 * never-observed as its own count line stating plainly that absence proves
 * nothing. THE ONE RULE THIS FUNCTION EXISTS TO HOLD, the SAME rule
 * `printCoverageReport()` holds two verbs over: print every measure's own
 * number under its own heading and NEVER compute or print a combined
 * figure, a percentage or a rate at the point of display. `denominator`
 * rides beside every count for exactly that reason.
 */
function printEvidDisagreementsReport(storePath: string, r: EvidReconciliation): void {
  console.log(`evid-disagreements: ${storePath}`);
  console.log("");
  console.log(`  DISAGREEMENTS (${r.disagreementCount} of ${r.denominator})`);
  if (r.disagreements.length === 0) {
    console.log("    none");
  } else {
    for (const d of r.disagreements) {
      console.log(`    ${hexAddr(d.address)}  byte-derived=${d.byteDerived}  runtime=${d.runtime}  banks=${d.sourceBanks.join(",")}`);
    }
  }
  console.log("");
  console.log(`  AGREEMENT: ${r.agreementCount} of ${r.denominator}`);
  console.log("");
  console.log(
    `  NO OBSERVATION: ${r.blockCoveredNeverObservedCount} of ${r.denominator} -- an address never observed executing ` +
      "proves NOTHING about what it is; absence is not evidence for or against any classification.",
  );
  console.log("");
  console.log(`  OBSERVED OUTSIDE ANY BLOCK: ${r.observedOutsideAnyBlockCount}`);
  console.log(`  OBSERVED AT UNDEFINED BLOCK: ${r.observedAtUndefinedBlockCount}`);
  console.log("");
  console.log(
    "  Read these five figures against each other, never combined into one: together they name what the block " +
      "table covers, never what the program actually is.",
  );
}

/**
 * `evid-disagreements --store FILE [--json]` -- the CLI route for the
 * disagreement query: the criterion that
 * settles the question is that a planted test needs the disagreement,
 * agreement and silence states rendered as three DIFFERENT pieces of TEXT
 * it can tell apart, which an MCP tool's JSON answer can only be inspected
 * structurally rather than textually.
 *
 * Opens the store READ-ONLY (`mustExist: true` -- this verb creates
 * nothing), fetches both sides itself (`listRanges()`/`listExecObservations()`),
 * maps the ranges through `blocksFromStore()` -- the ONE `RangeRow` ->
 * `BlockEntry` seam, never re-implemented here -- and calls
 * `reconcileObservedExecution()`, the SAME pure join
 * `anno_evid_disagreements` calls. `--json` prints the raw answer; otherwise
 * `printEvidDisagreementsReport()` renders the three states.
 */
async function cmdEvidDisagreements(rest: string[]): Promise<number> {
  const { store, storeMissingValue, json, unknownOption } = parseEvidDisagreementsArgs(rest);

  if (unknownOption) {
    console.error(`evid-disagreements: unknown option "${unknownOption}"\n`);
    console.log(USAGE);
    return 1;
  }
  if (storeMissingValue) {
    console.error("evid-disagreements: --store requires a value\n");
    console.log(USAGE);
    return 1;
  }
  if (!store) {
    console.error("evid-disagreements: --store FILE is required -- this verb answers a question about ONE annotation store.\n");
    console.log(USAGE);
    return 1;
  }

  // T-19-22/T-29-28-shaped confinement, the SAME seam every other verb's
  // caller-supplied path goes through.
  const workspaceRoot = repoRoot();
  let storePath: string;
  try {
    storePath = storePathWithinWorkspace(store, workspaceRoot);
  } catch (err) {
    console.error(`evid-disagreements: ${errMsg(err)}`);
    return 1;
  }
  if (!existsSync(storePath)) {
    console.error(
      `evid-disagreements: annotation store not found: ${storePath} -- refusing to CREATE one, because "the ` +
        'annotations are gone" and "there are no annotations" must not read the same.',
    );
    return 1;
  }

  let handle: AnnoStoreHandle;
  try {
    handle = openStore(storePath, { workspaceRoot, mustExist: true });
  } catch (err) {
    console.error(`evid-disagreements: ${errMsg(err)}`);
    return 1;
  }
  let reconciliation: EvidReconciliation;
  // Rule 2 (missing critical functionality): `runIdentity`
  // is NOT an `EvidReconciliation` field -- it rides alongside the spread
  // reconciliation in the JSON envelope, exactly like `store` already does.
  // Added so `decomp-completeness` has a run identity to
  // validate this document against the SAME store's own `anno_evid_runs`
  // table, rather than accepting a fabricated or foreign empty document as
  // this run's own answer. `null` when the store holds zero or more than one
  // distinct run identity -- an ambiguous "which run" is refused by the
  // consuming verb, never guessed here.
  let runIdentity: { imageSha256: string; argvDigest: string; seed: string } | null = null;
  try {
    const blocks = blocksFromStore(listRanges(handle));
    const observations = listExecObservations(handle);
    reconciliation = reconcileObservedExecution({ blocks, observations });
    const { runs } = listObservedRuns(handle);
    if (runs.length === 1) {
      const run = runs[0]!;
      runIdentity = { imageSha256: run.imageSha256, argvDigest: run.argvDigest, seed: run.seed };
    }
  } catch (err) {
    console.error(`evid-disagreements: ${errMsg(err)}`);
    return 1;
  } finally {
    closeStore(handle);
  }

  if (json) {
    console.log(JSON.stringify({ store: storePath, runIdentity, ...reconciliation }, null, 2));
    return 0;
  }
  printEvidDisagreementsReport(storePath, reconciliation);
  return 0;
}

// ---------------------------------------------------------------------------
// decomp-completeness -- the fifth verb.
// ---------------------------------------------------------------------------

/**
 * The frozen survivor prefix set, measured
 * against a real dxa+Ghidra-derived store rather than against roadmap prose
 * alone -- MEASURED against a zero-label population (derivation writes typed
 * ranges and xrefs, never names) and the reasoning this set was frozen
 * against. `AUTO_NAME_PREFIX_RE`
 * (imported from anno-coverage.ts, NEVER restated as a second literal here --
 * a census over this file for any of its own eleven prefix strings returns
 * zero, proving that) covers the eleven upstream-analyser-shaped
 * prefixes; this file adds three defensive, ANCHORED, case-sensitive cases no
 * import route writes today, kept here in case a future one ever carries a
 * raw dxa or Ghidra name through unrenamed: `l_XXXX` (an underscored form no
 * current tool emits), `FUN_XXXX`/`LAB_XXXX` (Ghidra's own default naming),
 * and `lXXX`/`lXXXX` (dxa's own real, no-underscore listing convention,
 * `dxa-listing.test.ts:52`). Anchored at both ends, unlike
 * `AUTO_NAME_PREFIX_RE`'s prefix-only match, because these three shapes are
 * short enough that an unanchored match would false-fire on a legitimate
 * longer authored name that merely starts the same way.
 */
const SURVIVOR_EXTRA_RE = /^(?:l_[0-9a-f]{4}|(?:FUN|LAB)_[0-9a-f]{4}|l[0-9a-f]{3,4})$/;

/** True iff `name` is a survivor under the frozen set above. ASCII
 * case-sensitive throughout -- `l_0810` IS a survivor, `L_0810` is NOT
 * (anno-coverage.test.ts's own `L_` exclusion precedent, restated for this
 * phase's own prefix set rather than reused blindly, since `L_` was never
 * one of `AUTO_NAME_PREFIX_RE`'s eleven prefixes to begin with). */
function isSurvivorLabelName(name: string): boolean {
  return AUTO_NAME_PREFIX_RE.test(name) || SURVIVOR_EXTRA_RE.test(name);
}

/** One row of the manifest `anno decomp-completeness --manifest FILE` reads.
 * `path` is relative to `src/mcp/vice/fixtures`; `reason` is
 * required (non-empty) when `execution` is `"not-executed"` and `null`
 * otherwise. */
interface DecompExecutionManifestEntry {
  path: string;
  execution: "executed" | "not-executed";
  reason: string | null;
  ghidraRoute: "flat64k" | "prg";
}

interface DecompExecutionManifest {
  fixtures: DecompExecutionManifestEntry[];
}

/** Strips a trailing recognised extension and any leading directory
 * segments, so `dxa/tracer.prg` and `tracer.annostore` both reduce to the
 * bare stem `tracer` -- the ONE fixture-identity comparison this verb makes.
 * Never a full-path comparison: the manifest's paths are fixtures-relative,
 * the store's own path is caller-supplied and workspace-relative, and the
 * two coordinate systems only ever agree on the bare stem. */
function fixtureStem(path: string): string {
  const base = basename(path);
  return base.replace(/\.[^./]+$/, "");
}

/** The subset of `EvidReconciliation` (verbatim field names, never renamed)
 * that a `--disagreements` document must carry for
 * `decomp-completeness` to accept it as real, plus the `runIdentity` this
 * verb (via `cmdEvidDisagreements`'s own `--json` branch) adds alongside it.
 * `disagreementInput` in the `--json` answer below is exactly this shape. */
interface DecompDisagreementInput extends EvidReconciliation {
  // (Rule 1 fix, disclosed): `null` is a THIRD, LEGITIMATE
  // value here -- `anno evid-disagreements --json`'s own `runIdentity` field
  // reads `null` when the store holds zero observed runs (listObservedRuns()),
  // which is exactly the real, non-fabricated answer a non-executed
  // fixture's store produces. Refusing null unconditionally made a real
  // `anno evid-disagreements --json` answer for a non-executed fixture
  // unusable by this verb, contradicting this phase's own must_haves ("a
  // non-executed fixture's disagreement answer is a real answer over zero
  // observations ... never an omitted argument"). The anti-vacuity property
  // is preserved below: null is accepted ONLY when the store's own evid-runs
  // table is ALSO empty (cmdDecompCompleteness's own match-check) -- a store
  // that DOES carry real runs must still supply a real, matching identity.
  runIdentity: { imageSha256: string; argvDigest: string; seed: string } | null;
}

const EVID_RECONCILIATION_FIELDS = [
  "disagreements",
  "disagreementCount",
  "agreementCount",
  "blockCoveredNeverObservedCount",
  "observedOutsideAnyBlockCount",
  "observedAtUndefinedBlockCount",
  "denominator",
  "positiveClass",
  "tier",
] as const;

/**
 * Validates a parsed `--disagreements` document has every `EvidReconciliation`
 * field AND a complete `runIdentity` -- refusing BY NAME, never silently
 * treating a missing field as an empty answer (a required
 * output-schema field only the real `--disagreements` input can populate).
 * Returns the validated document (typed as `DecompDisagreementInput`) or a
 * refusal message string. Never throws.
 */
function validateDisagreementDocumentShape(doc: unknown): DecompDisagreementInput | string {
  if (typeof doc !== "object" || doc === null) {
    return "decomp-completeness: the --disagreements document is not a JSON object -- refusing to render";
  }
  const bag = doc as Record<string, unknown>;
  for (const field of EVID_RECONCILIATION_FIELDS) {
    if (!(field in bag)) {
      return (
        `decomp-completeness: the --disagreements document is missing the "${field}" field -- ` +
        "this is not a real anno evid-disagreements --json answer, refusing to render"
      );
    }
  }
  const runIdentity = bag.runIdentity;
  // Rule 1 fix (disclosed): `null` is accepted HERE as a
  // well-formed shape -- it is `anno evid-disagreements --json`'s own real
  // answer for a store with zero observed runs (a non-executed
  // fixture). It is NOT yet accepted as a legitimate ANSWER: cmdDecompCompleteness's
  // own match-check below still refuses a null identity unless the store's
  // evid-runs table is ALSO genuinely empty, so a store that DOES carry real
  // runs can never slip past validation with a null identity.
  if (runIdentity !== null) {
    if (
      typeof runIdentity !== "object" ||
      typeof (runIdentity as Record<string, unknown>).imageSha256 !== "string" ||
      typeof (runIdentity as Record<string, unknown>).argvDigest !== "string" ||
      typeof (runIdentity as Record<string, unknown>).seed !== "string"
    ) {
      return (
        "decomp-completeness: the --disagreements document carries no complete runIdentity " +
        "(image_sha256/argv_digest/seed) -- an empty or ambiguous-run document is refused rather than " +
        "rendered as \"no disagreements\""
      );
    }
  }
  return doc as DecompDisagreementInput;
}

// ---------------------------------------------------------------------------
// The full measure set -- rangeProvenance
// (typed by evidence, never inferred), entryPoints, referencedAddresses and
// disagreementResolution (the gate-vs-bulletin distinction).
// ---------------------------------------------------------------------------

/** One typed range's provenance classification. Always
 * one of the three named values -- never a fourth, never a boolean. */
type RangeTypedBy = "observed-executing" | "byte-derived" | "authored";

interface RangeProvenanceRow {
  start: number;
  endInclusive: number;
  dataType: DataType;
  /** `dataType` unless it is one of the four `SPLIT_DATA_TYPES` members, in
   * which case it renders as `"table"` -- read from `anno-types.ts`'s
   * own `isSplitDataType()`, NEVER a restated literal, so the four split
   * spellings never appear in this file's own source as strings. */
  renderedType: string;
  typedBy: RangeTypedBy;
}

interface EntryPointPurposeElements {
  function: boolean;
  inputs: boolean;
  outputs: boolean;
  sideEffects: boolean;
}

interface EntryPointRow {
  address: number;
  name: string | null;
  /** True iff `name` is a real, authored label -- present AND not one of the
   * frozen survivor prefixes (an auto-generated name is not a name for this
   * gate's purposes, exactly like criterion 3's own survivor search). */
  hasName: boolean;
  purposeElements: EntryPointPurposeElements;
}

interface ReferencedAddressesCensus {
  resolved: number[];
  declined: { address: number; reason: string }[];
  unresolved: number[];
  denominator: number;
}

interface DisagreementResolutionRow {
  address: number;
  resolved: boolean;
  accepted: boolean;
  reason: string | null;
}

interface DisagreementResolutionCensus {
  rows: DisagreementResolutionRow[];
  unresolvedCount: number;
  denominator: number;
}

/**
 * The four hardware-chip memory-mapped register bands `c64-memory-mapping`'s
 * own `memmap.json` labels by name -- VIC-II, SID, CIA#1, CIA#2. Color RAM
 * ($D800-$DBFF) and the two generic "I/O Area" bands are deliberately
 * EXCLUDED: neither holds a chip register this project's curated
 * `anno-regbits.json` table names, and folding them in would make an
 * ordinary color-RAM write "hardware" by construction. `$0001` (the 6510's
 * own I/O port, zero page -- outside every one of these four bands) is
 * covered separately, by `hardwareRegisterAddresses()` below reading
 * `anno-regbits.json` itself, never a hand-restated address list.
 */
const HARDWARE_CHIP_RANGES: readonly { start: number; endInclusive: number }[] = Object.freeze([
  { start: 0xd000, endInclusive: 0xd3ff }, // VIC-II
  { start: 0xd400, endInclusive: 0xd7ff }, // SID
  { start: 0xdc00, endInclusive: 0xdcff }, // CIA#1
  { start: 0xdd00, endInclusive: 0xddff }, // CIA#2
]);

const REGBITS_PATH_FOR_HARDWARE_CHECK = join(HERE, "anno-regbits.json");

let cachedHardwareRegBitsAddresses: ReadonlySet<number> | undefined;

/** Every address `anno-regbits.json` names, read directly (this file never
 * imports `anno-enum-gen.ts`'s own private `loadRegBits()`, which is not
 * exported) -- this is a KEY-EXISTENCE check against the generated,
 * committed artifact, never a second bit-name derivation from memmap.json
 * (that generator's own header reserves that job to itself). Cached once per
 * process, mirroring `anno-enum-gen.ts`'s own cache discipline for the same
 * file. */
function hardwareRegBitsAddresses(): ReadonlySet<number> {
  if (cachedHardwareRegBitsAddresses === undefined) {
    const doc = JSON.parse(readFileSync(REGBITS_PATH_FOR_HARDWARE_CHECK, "utf8")) as Record<string, unknown>;
    const addresses = new Set<number>();
    for (const key of Object.keys(doc)) {
      if (key === "_generated") continue;
      const parsed = Number.parseInt(key.slice(1), 16);
      if (Number.isInteger(parsed)) addresses.add(parsed);
    }
    cachedHardwareRegBitsAddresses = addresses;
  }
  return cachedHardwareRegBitsAddresses;
}

/** True iff `address` is a hardware register address -- the union `anno-
 * regbits.json`'s own keys and memmap.json's four labelled chip bands
 * classify as hardware (see `HARDWARE_CHIP_RANGES`'s own doc comment for
 * what is deliberately excluded and why). */
function isHardwareRegisterAddress(address: number): boolean {
  if (hardwareRegBitsAddresses().has(address)) return true;
  return HARDWARE_CHIP_RANGES.some((r) => address >= r.start && address <= r.endInclusive);
}

/** The address an instruction references for the purposes of this file's
 * entry-point and referenced-address censuses -- mirrors `anno-derive.ts`'s
 * own (private, unexported) `referencedAddress()` rule exactly: no operand
 * (`rts`), an `immediate` operand (the value itself, never an address) and an
 * `indirect` operand (the target lives AT the operand, not IN it) all
 * reference nothing; everything else resolves to `resolvedTarget` when the
 * decoder produced one (a branch, a `jmp`/`jsr` absolute) or `operand.value`
 * otherwise. Restated here, not imported, because `anno-derive.ts` does not
 * export it. */
function instructionReferencedAddress(instruction: Instruction): number | undefined {
  const operand = instruction.operand;
  if (operand === undefined) return undefined;
  if (operand.role === "immediate" || operand.role === "indirect") return undefined;
  const target = instruction.resolvedTarget ?? operand.value;
  if (!Number.isInteger(target) || target < 0 || target > 0xffff) return undefined;
  return target;
}

/** Decodes every `code`-typed range fresh (never memoised, never a second
 * decoder) and returns every instruction found, tagged with nothing but its
 * own decoded shape. `image` is the SAME `{origin, bytes}` pair
 * `loadProjectImage()` already produced for this store's own fixture file. */
function decodeCodeRanges(ranges: readonly RangeRow[], image: { origin: number; bytes: Uint8Array }): Instruction[] {
  const instructions: Instruction[] = [];
  for (const range of ranges) {
    if (range.dataType !== "code") continue;
    const from = range.start - image.origin;
    const to = range.endInclusive - image.origin;
    if (from < 0 || to >= image.bytes.length || from > to) continue; // this image does not cover the range
    const bytes = image.bytes.subarray(from, to + 1);
    instructions.push(...decode(bytes, range.start, { end: range.endInclusive }));
  }
  return instructions;
}

/** True iff any comment at `address` starts with `prefix`. */
function hasCommentWithPrefix(comments: readonly CommentRow[], address: number, prefix: string): boolean {
  return comments.some((c) => c.address === address && c.text.startsWith(prefix));
}

/** The first comment at `address` starting with `prefix`, its text with the
 * prefix stripped and trimmed -- or `null` when none exists. */
function commentReasonAfterPrefix(comments: readonly CommentRow[], address: number, prefix: string): string | null {
  const found = comments.find((c) => c.address === address && c.text.startsWith(prefix));
  return found ? found.text.slice(prefix.length).trim() : null;
}

/** How ONE typed range was typed. Evidence beats
 * inference, stated as a fixed precedence that must never be reordered:
 * `observed-executing` (at least one real execute observation falls inside
 * the range) beats `authored` (the range's start address carries an
 * `AUTHORED_PROVENANCE_COMMENT_PREFIX` comment and no observation) beats
 * `byte-derived` (neither). */
function typedByFor(hasObservation: boolean, hasAuthoredComment: boolean): RangeTypedBy {
  if (hasObservation) return "observed-executing";
  if (hasAuthoredComment) return "authored";
  return "byte-derived";
}

/** Builds `rangeProvenance`: one row per typed range,
 * sorted ascending by `start` then `endInclusive` (ranges never overlap, so
 * this is already the input order once `ranges` itself is pre-sorted, but
 * the sort is restated here so this function's OWN output contract does not
 * depend on a caller's sort surviving unchanged). */
function buildRangeProvenance(
  ranges: readonly RangeRow[],
  observations: readonly { address: number }[],
  comments: readonly CommentRow[],
): RangeProvenanceRow[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.endInclusive - b.endInclusive);
  return sorted.map((r) => {
    const hasObservation = observations.some((o) => o.address >= r.start && o.address <= r.endInclusive);
    const hasAuthoredComment = hasCommentWithPrefix(comments, r.start, AUTHORED_PROVENANCE_COMMENT_PREFIX);
    return {
      start: r.start,
      endInclusive: r.endInclusive,
      dataType: r.dataType,
      renderedType: isSplitDataType(r.dataType) ? "table" : r.dataType,
      typedBy: typedByFor(hasObservation, hasAuthoredComment),
    };
  });
}

/** Builds `entryPoints`: every address that is the target of at least one
 * JSR-shaped cross-reference (a decoded `jsr` instruction in a `code` range,
 * unioned with every stored `listXrefs()` row whose target falls inside a
 * `code`-typed range -- the store's own `XrefAccessKind` vocabulary carries
 * no separate "call" member, so a stored xref landing in code is treated as
 * a call reference for this census), PLUS the image's own load/start
 * address (`image.origin`) -- the fixture's own natural entry point.
 * Sorted ascending by address.
 *
 * `image === null` (fixed 2026-09-11) means the fixture's
 * own bytes could not be located: no instructions are decoded and NO
 * `image.origin` candidate is added -- a missing image degrades this to
 * whatever the store's own stored `xrefs` already establish, never a
 * fabricated `$0000` from a placeholder's own zero origin. */
function buildEntryPoints(
  ranges: readonly RangeRow[],
  image: { origin: number; bytes: Uint8Array } | null,
  xrefs: readonly { toAddress: number }[],
  labels: readonly LabelRow[],
  comments: readonly CommentRow[],
): EntryPointRow[] {
  const codeRanges = ranges.filter((r) => r.dataType === "code");
  const instructions = image === null ? [] : decodeCodeRanges(ranges, image);

  const candidates = new Set<number>();
  if (image !== null) candidates.add(image.origin);
  for (const instr of instructions) {
    if (instr.mnemonic === "jsr") {
      const target = instructionReferencedAddress(instr);
      if (target !== undefined) candidates.add(target);
    }
  }
  for (const xref of xrefs) {
    if (codeRanges.some((r) => xref.toAddress >= r.start && xref.toAddress <= r.endInclusive)) {
      candidates.add(xref.toAddress);
    }
  }

  const purposeLabelPatterns: Record<keyof EntryPointPurposeElements, RegExp> = {
    function: /function:/i,
    inputs: /inputs:/i,
    outputs: /outputs:/i,
    sideEffects: /side effects:/i,
  };

  return [...candidates]
    .sort((a, b) => a - b)
    .map((address) => {
      const label = labels.find((l) => l.address === address);
      const hasName = label !== undefined && !isSurvivorLabelName(label.name);
      const addressComments = comments.filter((c) => c.address === address);
      const purposeElements: EntryPointPurposeElements = {
        function: addressComments.some((c) => purposeLabelPatterns.function.test(c.text)),
        inputs: addressComments.some((c) => purposeLabelPatterns.inputs.test(c.text)),
        outputs: addressComments.some((c) => purposeLabelPatterns.outputs.test(c.text)),
        sideEffects: addressComments.some((c) => purposeLabelPatterns.sideEffects.test(c.text)),
      };
      return { address, name: label?.name ?? null, hasName, purposeElements };
    });
}

/** Builds `referencedAddresses` (criterion 4): every non-hardware address a
 * `code` range's decoded instructions or the store's own `listXrefs()` rows
 * reference, classified `resolved` (an authored, non-survivor label exists),
 * `declined` (a `DECLINE_COMMENT_PREFIX` comment exists, carrying the
 * decline's own reason), or `unresolved` (neither) -- sorted ascending by
 * address within each bucket.
 *
 * `image === null` (fixed 2026-09-11): no instructions are
 * decoded, so this degrades to whatever the store's own stored `xrefs`
 * establish -- never fabricated from a placeholder image's bytes. */
function buildReferencedAddresses(
  ranges: readonly RangeRow[],
  image: { origin: number; bytes: Uint8Array } | null,
  xrefs: readonly { toAddress: number }[],
  labels: readonly LabelRow[],
  comments: readonly CommentRow[],
): ReferencedAddressesCensus {
  const instructions = image === null ? [] : decodeCodeRanges(ranges, image);
  const candidates = new Set<number>();
  for (const instr of instructions) {
    const target = instructionReferencedAddress(instr);
    if (target !== undefined && !isHardwareRegisterAddress(target)) candidates.add(target);
  }
  for (const xref of xrefs) {
    if (!isHardwareRegisterAddress(xref.toAddress)) candidates.add(xref.toAddress);
  }

  const resolved: number[] = [];
  const declined: { address: number; reason: string }[] = [];
  const unresolved: number[] = [];
  for (const address of [...candidates].sort((a, b) => a - b)) {
    const label = labels.find((l) => l.address === address);
    if (label !== undefined && !isSurvivorLabelName(label.name)) {
      resolved.push(address);
      continue;
    }
    const reason = commentReasonAfterPrefix(comments, address, DECLINE_COMMENT_PREFIX);
    if (reason !== null) {
      declined.push({ address, reason });
      continue;
    }
    unresolved.push(address);
  }
  return { resolved, declined, unresolved, denominator: resolved.length + declined.length + unresolved.length };
}

/** Builds `disagreementResolution` (the gate-vs-bulletin distinction,
 * criterion 2): one row per disagreement the supplied `--disagreements`
 * document carries, `accepted` when the address carries a
 * `DISAGREEMENT_ACCEPTED_COMMENT_PREFIX` comment, `resolved` identically (the
 * only resolution mechanism this gate recognises today), `reason` the
 * accepting comment's own text with the prefix stripped. `unresolvedCount`
 * is a named line beside its own `denominator`, never folded into any other
 * count -- criterion 2's own words: a nonzero unresolved count BLOCKS rather
 * than being reported beside a pass. */
function buildDisagreementResolution(
  disagreements: readonly { address: number }[],
  comments: readonly CommentRow[],
): DisagreementResolutionCensus {
  const rows = disagreements.map((d) => {
    const reason = commentReasonAfterPrefix(comments, d.address, DISAGREEMENT_ACCEPTED_COMMENT_PREFIX);
    const accepted = reason !== null;
    return { address: d.address, resolved: accepted, accepted, reason };
  });
  const unresolvedCount = rows.filter((r) => !r.resolved).length;
  return { rows, unresolvedCount, denominator: rows.length };
}

interface DecompCompletenessParsedArgs {
  positional: string[];
  store?: string;
  storeMissingValue?: boolean;
  disagreements?: string;
  disagreementsMissingValue?: boolean;
  manifest?: string;
  manifestMissingValue?: boolean;
  json?: boolean;
  unknownOption?: string;
}

/** Copies `parseEvidDisagreementsArgs()`'s own shape, function for function,
 * for three required flags instead of one -- same `*MissingValue` refusal,
 * same unknown-option refusal, same never-silently-swallow-the-next-token
 * discipline. */
function parseDecompCompletenessArgs(rest: string[]): DecompCompletenessParsedArgs {
  const positional: string[] = [];
  let store: string | undefined;
  let storeMissingValue = false;
  let disagreements: string | undefined;
  let disagreementsMissingValue = false;
  let manifest: string | undefined;
  let manifestMissingValue = false;
  let json = false;
  let unknownOption: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--store") {
      const value = rest[i + 1];
      if (isMissingOptionValue(value)) storeMissingValue = true;
      else {
        store = value;
        i++;
      }
    } else if (a === "--disagreements") {
      const value = rest[i + 1];
      if (isMissingOptionValue(value)) disagreementsMissingValue = true;
      else {
        disagreements = value;
        i++;
      }
    } else if (a === "--manifest") {
      const value = rest[i + 1];
      if (isMissingOptionValue(value)) manifestMissingValue = true;
      else {
        manifest = value;
        i++;
      }
    } else if (a === "--json") {
      json = true;
    } else if (a.startsWith("--")) {
      unknownOption ??= a;
    } else {
      positional.push(a);
    }
  }
  return { positional, store, storeMissingValue, disagreements, disagreementsMissingValue, manifest, manifestMissingValue, json, unknownOption };
}

/**
 * `decomp-completeness --store FILE --disagreements FILE --manifest FILE
 * [--json]` -- copies `cmdEvidDisagreements()`'s own shape: parse -> refuse
 * unknown option -> refuse missing value -> refuse missing required argument
 * BY NAME -> `storePathWithinWorkspace()` every caller-supplied path -> open
 * the store `mustExist: true` -> gather -> `--json` branch or rendered
 * branch. Three required arguments, none defaulted from another.
 */
async function cmdDecompCompleteness(rest: string[]): Promise<number> {
  const { store, storeMissingValue, disagreements, disagreementsMissingValue, manifest, manifestMissingValue, json, unknownOption } =
    parseDecompCompletenessArgs(rest);

  if (unknownOption) {
    console.error(`decomp-completeness: unknown option "${unknownOption}"\n`);
    console.log(USAGE);
    return 1;
  }
  if (storeMissingValue) {
    console.error("decomp-completeness: --store requires a value\n");
    console.log(USAGE);
    return 1;
  }
  if (disagreementsMissingValue) {
    console.error("decomp-completeness: --disagreements requires a value\n");
    console.log(USAGE);
    return 1;
  }
  if (manifestMissingValue) {
    console.error("decomp-completeness: --manifest requires a value\n");
    console.log(USAGE);
    return 1;
  }
  if (!store) {
    console.error("decomp-completeness: --store FILE is required -- this verb answers a question about ONE annotation store.\n");
    console.log(USAGE);
    return 1;
  }
  if (!disagreements) {
    console.error(
      "decomp-completeness: --disagreements FILE is required -- there is no default and no empty-array " +
        "substitute; omitting the disagreement input must never render the same report as a real, empty answer.\n",
    );
    console.log(USAGE);
    return 1;
  }
  if (!manifest) {
    console.error(
      "decomp-completeness: --manifest FILE is required -- a fixture absent from the manifest is refused, " +
        "never defaulted to \"executed\".\n",
    );
    console.log(USAGE);
    return 1;
  }

  const workspaceRoot = repoRoot();
  let storePath: string;
  let disagreementsPath: string;
  let manifestPath: string;
  try {
    storePath = storePathWithinWorkspace(store, workspaceRoot);
    disagreementsPath = storePathWithinWorkspace(disagreements, workspaceRoot);
    manifestPath = storePathWithinWorkspace(manifest, workspaceRoot);
  } catch (err) {
    console.error(`decomp-completeness: ${errMsg(err)}`);
    return 1;
  }

  if (!existsSync(storePath)) {
    console.error(
      `decomp-completeness: annotation store not found: ${storePath} -- refusing to CREATE one, because "the ` +
        'annotations are gone" and "there are no annotations" must not read the same.',
    );
    return 1;
  }
  if (!existsSync(disagreementsPath)) {
    console.error(`decomp-completeness: --disagreements file not found: ${disagreementsPath}`);
    return 1;
  }
  if (!existsSync(manifestPath)) {
    console.error(`decomp-completeness: --manifest file not found: ${manifestPath}`);
    return 1;
  }

  let disagreementDoc: unknown;
  try {
    disagreementDoc = JSON.parse(readFileSync(disagreementsPath, "utf8"));
  } catch (err) {
    console.error(`decomp-completeness: --disagreements file is not valid JSON: ${errMsg(err)}`);
    return 1;
  }
  const validated = validateDisagreementDocumentShape(disagreementDoc);
  if (typeof validated === "string") {
    console.error(validated);
    return 1;
  }
  const disagreementInput = validated;

  let manifestDoc: unknown;
  try {
    manifestDoc = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (err) {
    console.error(`decomp-completeness: --manifest file is not valid JSON: ${errMsg(err)}`);
    return 1;
  }
  if (
    typeof manifestDoc !== "object" ||
    manifestDoc === null ||
    !Array.isArray((manifestDoc as Record<string, unknown>).fixtures)
  ) {
    console.error(`decomp-completeness: --manifest file does not carry a top-level "fixtures" array: ${manifestPath}`);
    return 1;
  }
  const manifestFixtures = (manifestDoc as DecompExecutionManifest).fixtures;

  const stem = fixtureStem(storePath);
  const manifestEntry = manifestFixtures.find((f) => fixtureStem(f.path) === stem);
  if (!manifestEntry) {
    console.error(
      `decomp-completeness: no fixture matching store ${JSON.stringify(basename(storePath))} (stem ${JSON.stringify(stem)}) ` +
        `is listed in the manifest ${manifestPath} -- an unlisted fixture is refused, never defaulted to "executed".`,
    );
    return 1;
  }

  let handle: AnnoStoreHandle;
  try {
    handle = openStore(storePath, { workspaceRoot, mustExist: true });
  } catch (err) {
    console.error(`decomp-completeness: ${errMsg(err)}`);
    return 1;
  }

  let report: {
    store: string;
    fixture: string;
    executionDisposition: "executed" | "not-executed";
    notExecutedReason: string | null;
    byteCensus: { byType: Record<string, number>; undefinedCount: number; denominator: number; undefinedRanges: { start: number; endInclusive: number }[] };
    survivors: { address: number; name: string }[];
    rangeProvenance: RangeProvenanceRow[];
    // Fixed 2026-09-11: true when the fixture's own image
    // bytes could not be located -- see the fallback below. `entryPoints`/
    // `referencedAddresses` are DEGRADED (never fabricated) when this is
    // true: no synthetic `$0000` entry point is manufactured from a
    // zero-length placeholder's own `origin`.
    imageUnavailable: boolean;
    entryPoints: EntryPointRow[];
    referencedAddresses: ReferencedAddressesCensus;
    disagreementInput: DecompDisagreementInput;
    disagreementResolution: DisagreementResolutionCensus;
  };
  try {
    const ranges = listRanges(handle);
    const { runs } = listObservedRuns(handle);
    // Rule 1 fix (disclosed): a `null` runIdentity is accepted
    // ONLY when the store's own evid-runs table is ALSO genuinely empty --
    // the real, honest answer for a non-executed fixture. A store that
    // DOES carry real runs must still supply a real, matching identity; the
    // anti-vacuity property this whole check exists for is unaffected.
    if (disagreementInput.runIdentity === null) {
      if (runs.length !== 0) {
        console.error(
          `decomp-completeness: the --disagreements document carries a null run identity, but ${storePath}'s own ` +
            `evid-runs table is NOT empty (${runs.length} recorded run(s)) -- a store with real runs must supply a ` +
            "real, matching identity, never null.",
        );
        closeStore(handle);
        return 1;
      }
    } else {
      const matchesSomeRun = runs.some(
        (r) =>
          r.imageSha256 === disagreementInput.runIdentity!.imageSha256 &&
          r.argvDigest === disagreementInput.runIdentity!.argvDigest &&
          r.seed === disagreementInput.runIdentity!.seed,
      );
      if (!matchesSomeRun) {
        console.error(
          `decomp-completeness: the --disagreements document's run identity (image_sha256=${disagreementInput.runIdentity.imageSha256}, ` +
            `argv_digest=${disagreementInput.runIdentity.argvDigest}, seed=${JSON.stringify(disagreementInput.runIdentity.seed)}) ` +
            `matches no row in ${storePath}'s own evid-runs table -- a fabricated or foreign document is refused, never rendered.`,
        );
        closeStore(handle);
        return 1;
      }
    }

    const sortedRanges = [...ranges].sort((a, b) => a.start - b.start);
    const byType: Record<string, number> = {};
    let denominator = 0;
    let undefinedCount = 0;
    // Every gap between typed ranges, by ADDRESS -- so the gate can name
    // exactly which byte(s) are Undefined rather than reporting a bare
    // count (Task 1 Test 1: "a store with one undefined-typed byte ... renders
    // that byte's address"). Sorted ascending, matching every other array
    // this verb returns.
    const undefinedRanges: { start: number; endInclusive: number }[] = [];
    let cursor = sortedRanges.length > 0 ? sortedRanges[0]!.start : 0;
    for (const r of sortedRanges) {
      if (r.start > cursor) {
        const gap = r.start - cursor;
        undefinedCount += gap;
        denominator += gap;
        undefinedRanges.push({ start: cursor, endInclusive: r.start - 1 });
      }
      const len = r.endInclusive - r.start + 1;
      byType[r.dataType] = (byType[r.dataType] ?? 0) + len;
      denominator += len;
      cursor = Math.max(cursor, r.endInclusive + 1);
    }

    const labels = listLabels(handle);
    const survivors = labels
      .filter((l) => isSurvivorLabelName(l.name) && sortedRanges.some((r) => r.dataType === "code" && l.address >= r.start && l.address <= r.endInclusive))
      .map((l) => ({ address: l.address, name: l.name }))
      .sort((a, b) => a.address - b.address);

    // The full measure set. All four use the SAME
    // fixture bytes the derivation route itself read -- the fixtures-relative
    // manifest path, resolved beside this module (`fixtures/<manifestEntry.path>`),
    // never a second guess at where the image lives. An image that cannot be
    // located (never expected for a committed fixture, but never fabricated
    // either) degrades entryPoints/referencedAddresses to EMPTY -- never a
    // synthetic zero-length placeholder whose own `origin` (0) would read as
    // a real `$0000` entry point (fixed 2026-09-11: the
    // placeholder's origin was previously unioned into the candidate set
    // unconditionally, fabricating a plausible-looking but fictitious
    // finding). `imageUnavailable` reports the condition BY NAME instead.
    const comments = listComments(handle);
    const xrefs = listXrefs(handle);
    const fixtureImagePath = join(HERE, "fixtures", manifestEntry.path);
    const loadedImage = existsSync(fixtureImagePath) ? projectImage(fixtureImagePath) : null;
    const imageUnavailable = loadedImage === null;

    const rangeProvenance = buildRangeProvenance(sortedRanges, listExecObservations(handle), comments);
    const entryPoints = buildEntryPoints(sortedRanges, loadedImage, xrefs, labels, comments);
    const referencedAddresses = buildReferencedAddresses(sortedRanges, loadedImage, xrefs, labels, comments);
    const disagreementResolution = buildDisagreementResolution(disagreementInput.disagreements, comments);

    report = {
      store: storePath,
      fixture: manifestEntry.path,
      executionDisposition: manifestEntry.execution,
      notExecutedReason: manifestEntry.execution === "not-executed" ? manifestEntry.reason : null,
      byteCensus: { byType, undefinedCount, denominator, undefinedRanges },
      survivors,
      rangeProvenance,
      imageUnavailable,
      entryPoints,
      referencedAddresses,
      disagreementInput,
      disagreementResolution,
    };
  } catch (err) {
    console.error(`decomp-completeness: ${errMsg(err)}`);
    closeStore(handle);
    return 1;
  }
  closeStore(handle);

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return 0;
  }
  printDecompCompletenessReport(report);
  return 0;
}

/**
 * Copies `printEvidDisagreementsReport()`'s rendering discipline exactly:
 * every measure under its own heading, disagreements first, `denominator`
 * beside every count, an explicit sentence stating what absence does NOT
 * prove, and never a percentage, rate or combined figure -- the same rule
 * this CLI applies everywhere else. This is the FALLBACK text renderer for a direct CLI
 * invocation without `--json`; `completeness-report.mjs`'s
 * `renderCompletenessReport()` is the report the routine-queue-walker skill
 * actually reads, built from this same verb's `--json` answer.
 */
function printDecompCompletenessReport(r: {
  store: string;
  fixture: string;
  executionDisposition: "executed" | "not-executed";
  notExecutedReason: string | null;
  byteCensus: { byType: Record<string, number>; undefinedCount: number; denominator: number; undefinedRanges: { start: number; endInclusive: number }[] };
  survivors: { address: number; name: string }[];
  rangeProvenance: RangeProvenanceRow[];
  imageUnavailable: boolean;
  entryPoints: EntryPointRow[];
  referencedAddresses: ReferencedAddressesCensus;
  disagreementInput: DecompDisagreementInput;
  disagreementResolution: DisagreementResolutionCensus;
}): void {
  console.log(`decomp-completeness: ${r.store}`);
  console.log(`  FIXTURE: ${r.fixture}`);
  if (r.executionDisposition === "not-executed") {
    console.log(`  NOT EXECUTED: ${r.notExecutedReason ?? "(no reason recorded)"}`);
  } else {
    console.log("  EXECUTED: this fixture was run under the reproducible-run protocol.");
  }
  console.log("");
  console.log(`  BYTE CENSUS (denominator ${r.byteCensus.denominator})`);
  for (const [type, count] of Object.entries(r.byteCensus.byType).sort()) {
    console.log(`    ${type}: ${count} of ${r.byteCensus.denominator}`);
  }
  console.log(`    undefined: ${r.byteCensus.undefinedCount} of ${r.byteCensus.denominator}`);
  if (r.byteCensus.undefinedRanges.length > 0) {
    for (const gap of r.byteCensus.undefinedRanges) {
      console.log(`      UNDEFINED: ${hexAddr(gap.start)}-${hexAddr(gap.endInclusive)}`);
    }
  }
  console.log("");
  console.log(`  SURVIVORS (${r.survivors.length})`);
  if (r.survivors.length === 0) {
    console.log("    none");
  } else {
    for (const s of r.survivors) console.log(`    ${hexAddr(s.address)}  ${s.name}`);
  }
  console.log("");
  console.log(`  DISAGREEMENTS (${r.disagreementInput.disagreementCount} of ${r.disagreementInput.denominator})`);
  if (r.disagreementInput.disagreements.length === 0) {
    console.log("    none");
  } else {
    for (const d of r.disagreementInput.disagreements) {
      console.log(`    ${hexAddr(d.address)}  byte-derived=${d.byteDerived}  runtime=${d.runtime}  banks=${d.sourceBanks.join(",")}`);
    }
  }
  console.log(`  AGREEMENT: ${r.disagreementInput.agreementCount} of ${r.disagreementInput.denominator}`);
  console.log(
    `  NO OBSERVATION: ${r.disagreementInput.blockCoveredNeverObservedCount} of ${r.disagreementInput.denominator} -- ` +
      "an address never observed executing proves NOTHING about what it is; absence is not evidence for or against any classification.",
  );
  console.log(
    `  DISAGREEMENT RESOLUTION: ${r.disagreementResolution.rows.length - r.disagreementResolution.unresolvedCount} accepted, ` +
      `${r.disagreementResolution.unresolvedCount} unresolved of ${r.disagreementResolution.denominator} -- criterion 2's own gate: ` +
      "a nonzero unresolved count BLOCKS rather than being reported beside a pass.",
  );
  console.log("");

  console.log(`  RANGE PROVENANCE (${r.rangeProvenance.length} range(s))`);
  if (r.rangeProvenance.length === 0) {
    console.log("    none");
  } else {
    for (const row of r.rangeProvenance) {
      console.log(`    ${hexAddr(row.start)}-${hexAddr(row.endInclusive)}  ${row.renderedType}  typedBy: ${row.typedBy}`);
    }
  }
  console.log("");

  // Fixed 2026-09-11: named BY NAME, not inferred from a
  // suspiciously-empty entryPoints/referencedAddresses census.
  if (r.imageUnavailable) {
    console.log("  IMAGE UNAVAILABLE: the fixture's own image bytes could not be located -- entryPoints and referencedAddresses below are degraded to what the store's own stored xrefs establish, never fabricated from a placeholder image.");
    console.log("");
  }

  const fullyDocumented = r.entryPoints.filter(
    (e) => e.hasName && e.purposeElements.function && e.purposeElements.inputs && e.purposeElements.outputs && e.purposeElements.sideEffects,
  ).length;
  console.log(`  ENTRY POINTS (${fullyDocumented} of ${r.entryPoints.length})`);
  if (r.entryPoints.length === 0) {
    console.log("    none -- a zero-entry-point count is a fact about the candidate set, never evidence of completeness.");
  } else {
    for (const e of r.entryPoints) {
      const missing = (["function", "inputs", "outputs", "sideEffects"] as const).filter((k) => !e.purposeElements[k]);
      console.log(
        `    ${hexAddr(e.address)}  ${e.name ?? "(unnamed)"}  hasName=${e.hasName}` +
          (missing.length > 0 ? `  MISSING: ${missing.join(", ")}` : "  purpose comment complete"),
      );
    }
  }
  console.log("");

  console.log(`  REFERENCED NON-HARDWARE ADDRESSES (${r.referencedAddresses.resolved.length} resolved of ${r.referencedAddresses.denominator})`);
  if (r.referencedAddresses.denominator === 0) {
    console.log("    none -- a zero-referenced-address count is a fact about the candidate set, never evidence of completeness.");
  } else {
    console.log(`    RESOLVED: ${r.referencedAddresses.resolved.map(hexAddr).join(", ") || "none"}`);
    console.log(
      `    DECLINED: ${r.referencedAddresses.declined.length === 0 ? "none" : r.referencedAddresses.declined.map((d) => `${hexAddr(d.address)} (${d.reason})`).join(", ")}`,
    );
    console.log(`    UNRESOLVED: ${r.referencedAddresses.unresolved.length === 0 ? "none" : r.referencedAddresses.unresolved.map(hexAddr).join(", ")}`);
  }
  console.log("");
  console.log(
    "  Read every figure above against the others, never combined into one -- together they name what this " +
      "store's block table covers, never what the program actually is.",
  );
}

// ---------------------------------------------------------------------------
// hazard-report -- the CLI route for the movement-hazard report.
// ---------------------------------------------------------------------------

interface HazardReportParsedArgs {
  positional: string[];
  store?: string;
  storeMissingValue?: boolean;
  image?: string;
  imageMissingValue?: boolean;
  json?: boolean;
  unknownOption?: string;
}

/** Fixed, closed option set for hazard-report -- exactly `--store`,
 * `--image` and `--json`. Same closed-option-set posture as every other verb's own
 * parser: an unimplemented flag is refused as `unknownOption`, and an
 * option with a missing or flag-shaped value is refused through its own
 * `*MissingValue` field rather than silently swallowing the next token. */
function parseHazardReportArgs(rest: string[]): HazardReportParsedArgs {
  const positional: string[] = [];
  let store: string | undefined;
  let storeMissingValue = false;
  let image: string | undefined;
  let imageMissingValue = false;
  let json = false;
  let unknownOption: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--store") {
      const value = rest[i + 1];
      if (isMissingOptionValue(value)) {
        storeMissingValue = true;
      } else {
        store = value;
        i++;
      }
    } else if (a === "--image") {
      const value = rest[i + 1];
      if (isMissingOptionValue(value)) {
        imageMissingValue = true;
      } else {
        image = value;
        i++;
      }
    } else if (a === "--json") {
      json = true;
    } else if (a.startsWith("--")) {
      unknownOption ??= a;
    } else {
      positional.push(a);
    }
  }
  return { positional, store, storeMissingValue, image, imageMissingValue, json, unknownOption };
}

/**
 * Renders a hazard report as separately-headed, textually-distinguishable
 * sections -- findings first, then region dispositions grouped by outcome
 * under three separate headings, then the named limits verbatim. No
 * percentage, rate or combined verdict is ever printed at the point of
 * display: every heading prints its own count against the report's own
 * `denominator`, the same convention `printEvidDisagreementsReport()` uses.
 * The NO-SIGNAL heading's own text states, in as many words, that no
 * detection is not evidence that a region is safe to move -- so that
 * sentence is never left to a reader's inference.
 */
function printHazardReport(storePath: string, imagePath: string, r: HazardReport & { matched: number; returned: number }): void {
  console.log(`hazard-report: ${storePath}`);
  console.log(`  image: ${imagePath}`);
  console.log("");
  console.log(`  FINDINGS (${r.matched} of ${r.denominator}, ${r.returned} shown${r.truncated ? ", truncated" : ""})`);
  if (r.findings.length === 0) {
    console.log("    none");
  } else {
    for (const f of r.findings) {
      const blocked = f.blockedAddress !== null ? `  blocked=${hexAddr(f.blockedAddress)}` : "";
      console.log(`    ${hexAddr(f.anchorAddress)}  class=${f.hazardClass}  mechanism=${f.mechanism}  strength=${f.strength}${blocked}`);
      console.log(`      ${f.detail}`);
    }
  }
  console.log("");

  const hazardReported = r.regions.filter((region) => region.outcome === "hazard-reported");
  const noSignal = r.regions.filter((region) => region.outcome === "no-signal");
  const unclassified = r.regions.filter((region) => region.outcome === "unclassified");

  console.log(`  HAZARD-REPORTED REGIONS (${hazardReported.length} of ${r.denominator})`);
  if (hazardReported.length === 0) console.log("    none");
  else for (const region of hazardReported) console.log(`    ${hexAddr(region.start)}..${hexAddr(region.endInclusive)}`);
  console.log("");

  console.log(
    `  NO-SIGNAL REGIONS (${noSignal.length} of ${r.denominator}) -- no detection is not evidence that a region is ` +
      "safe to move, clean, or hazard-free; it means nothing this report knows how to look for fired there.",
  );
  if (noSignal.length === 0) console.log("    none");
  else for (const region of noSignal) console.log(`    ${hexAddr(region.start)}..${hexAddr(region.endInclusive)}`);
  console.log("");

  console.log(`  UNCLASSIFIED REGIONS (${unclassified.length} of ${r.denominator})`);
  if (unclassified.length === 0) console.log("    none");
  else for (const region of unclassified) console.log(`    ${hexAddr(region.start)}..${hexAddr(region.endInclusive)}  (${region.reason ?? "no reason recorded"})`);
  console.log("");

  // Rendered here so an operator reading ONLY the human-readable
  // report (never --json) still sees the declined dispatch candidates
  // HazardReport's own doc comment insists must never be silently dropped --
  // "an honest decline indistinguishable from an absence" is exactly the
  // confusion `HAZARD_LIMITS`'s `indexed-dispatch` entry warns against.
  console.log(
    `  UNPROVEN DISPATCH CANDIDATES (${r.unprovenDispatchCandidates.length}) -- declined by the imported scanner's promotion gate; ` +
      "a decline here is not a claim that no computed dispatch exists in this region, see LIMITS below",
  );
  if (r.unprovenDispatchCandidates.length === 0) {
    console.log("    none");
  } else {
    for (const c of r.unprovenDispatchCandidates) {
      const targets = c.orientationResolved ? addressList(c.targets) : "unresolved -- byte-swap orientation unknown, not printed as addresses";
      console.log(
        `    ${hexAddr(c.at)}  lo=${hexAddr(c.loBase)}  hi=${hexAddr(c.hiBase)}  entries=${c.entries}${c.truncated ? "  truncated" : ""}`,
      );
      console.log(`      targets: ${targets}`);
    }
  }
  console.log("");

  console.log("  LIMITS");
  for (const l of r.limits) {
    console.log(`    [${l.hazardClass ?? "all classes"}] ${l.limit}`);
    console.log(`      ${l.consequence}`);
  }
}

/**
 * `hazard-report --store FILE --image FILE [--json]` -- the CLI route for
 * the movement-hazard report, run here against a real store and a real
 * image rather than only exposed as an MCP answer (the same reason
 * `evid-disagreements` carries a CLI verb).
 *
 * Opens the store READ-ONLY (`mustExist: true` -- this verb creates
 * nothing), fetches every input itself (`listRanges()`/`listLabels()`/
 * `listComments()`/`listXrefs()`/`listExecObservations()`), maps the ranges
 * through `blocksFromStore()` -- the ONE `RangeRow` -> `BlockEntry` seam,
 * never re-implemented here -- loads the image through `projectImage()`,
 * and calls `buildHazardReport()`, the SAME pure function
 * `anno_hazard_report` calls. `--json` prints the raw answer; otherwise
 * `printHazardReport()` renders it.
 */
async function cmdHazardReport(rest: string[]): Promise<number> {
  const { store, storeMissingValue, image, imageMissingValue, json, unknownOption } = parseHazardReportArgs(rest);

  if (unknownOption) {
    console.error(`hazard-report: unknown option "${unknownOption}"\n`);
    console.log(USAGE);
    return 1;
  }
  if (storeMissingValue) {
    console.error("hazard-report: --store requires a value\n");
    console.log(USAGE);
    return 1;
  }
  if (imageMissingValue) {
    console.error("hazard-report: --image requires a value\n");
    console.log(USAGE);
    return 1;
  }
  if (!store) {
    console.error("hazard-report: --store FILE is required -- this verb answers a question about ONE annotation store.\n");
    console.log(USAGE);
    return 1;
  }
  if (!image) {
    console.error("hazard-report: --image FILE is required -- the store holds annotations, never bytes.\n");
    console.log(USAGE);
    return 1;
  }

  const workspaceRoot = repoRoot();
  let storePath: string;
  let imagePath: string;
  try {
    storePath = storePathWithinWorkspace(store, workspaceRoot);
    imagePath = storePathWithinWorkspace(image, workspaceRoot);
  } catch (err) {
    console.error(`hazard-report: ${errMsg(err)}`);
    return 1;
  }
  if (!existsSync(storePath)) {
    console.error(
      `hazard-report: annotation store not found: ${storePath} -- refusing to CREATE one, because "the ` +
        'annotations are gone" and "there are no annotations" must not read the same.',
    );
    return 1;
  }
  if (!existsSync(imagePath)) {
    console.error(`hazard-report: image not found: ${imagePath}`);
    return 1;
  }

  let handle: AnnoStoreHandle;
  try {
    handle = openStore(storePath, { workspaceRoot, mustExist: true });
  } catch (err) {
    console.error(`hazard-report: ${errMsg(err)}`);
    return 1;
  }
  let report: ReturnType<typeof buildHazardReport>;
  try {
    const ranges = blocksFromStore(listRanges(handle));
    const symbols = listLabels(handle);
    const comments = listComments(handle);
    const xrefs = listXrefs(handle);
    const execObservations = listExecObservations(handle);
    const loadedImage = projectImage(imagePath);
    if (loadedImage === null) {
      console.error(`hazard-report: ${imagePath} did not decode -- supply a .prg or an exactly-65536-byte flat capture`);
      return 1;
    }
    report = buildHazardReport({
      bytes: loadedImage.bytes,
      origin: loadedImage.origin,
      symbols,
      comments,
      ranges,
      xrefs,
      execObservations,
    });
  } catch (err) {
    console.error(`hazard-report: ${errMsg(err)}`);
    return 1;
  } finally {
    closeStore(handle);
  }

  // `matched`/`returned` always equal `report.findings.length` here -- this
  // verb has no `--max-results`/pagination option (unlike the MCP tool's
  // `anno_hazard_report`, which genuinely slices `report.findings` against
  // one). They are kept only to mirror that tool's JSON shape; a future
  // `--max-results` flag on THIS verb would need to make these two diverge
  // again, the same way the MCP tool's `dispatchHazardReport` already does.
  if (json) {
    console.log(JSON.stringify({ store: storePath, image: imagePath, ...report, returned: report.findings.length, matched: report.findings.length }, null, 2));
    return 0;
  }
  printHazardReport(storePath, imagePath, { ...report, returned: report.findings.length, matched: report.findings.length });
  return 0;
}

/**
 * Entry point for the `anno` subcommand. Returns an exit code; never calls
 * exit the process directly (the bin does that). Handles `--help`/no verb/unknown
 * verb per `acme.mjs`'s own dispatch convention (`src/skills/acme-build/
 * scripts/acme.mjs`), with one deliberate difference: an explicit `--help`
 * returns 0 (a no-op invocation with no verb also returns 0), while an
 * unrecognised verb returns 1.
 */
export async function runAnnoCli(argv: string[]): Promise<number> {
  const [verb, ...rest] = argv;

  if (!verb || verb === "--help" || verb === "-h") {
    console.log(USAGE);
    return 0;
  }

  try {
    // The single call site for the shared verb-options
    // check, run BEFORE dispatch so a refused option never reaches any cmd*
    // function -- one place enforces the closed option set for every verb,
    // rather than seven places each doing (or, as `verify` proved, NOT doing)
    // it themselves.
    //
    // INSIDE the try since 2026-08-31, as defence in depth.
    // It used to sit above this block, so a throw from it escaped
    // `runAnnoCli()` entirely -- which is exactly what a prototype-key verb
    // did. `checkAcceptedOptions()` is now own-property-safe and cannot
    // throw for that reason, but the never-throw contract this file's header
    // states should not depend on one callee staying careful: every
    // pre-dispatch check belongs under the last-resort net below.
    const optionError = checkAcceptedOptions(verb, rest);
    if (optionError) {
      console.error(optionError);
      console.log(USAGE);
      return 1;
    }

    switch (verb) {
      case "render-memmap":
        return await cmdRenderMemmap(rest);
      case "coverage":
        return await cmdCoverage(rest);
      case "export-asm":
        return await cmdExportAsm(rest);
      case "evid-disagreements":
        return await cmdEvidDisagreements(rest);
      case "decomp-completeness":
        return await cmdDecompCompleteness(rest);
      case "hazard-report":
        return await cmdHazardReport(rest);
      default:
        // Corrected 2026-08-30. This prefix read
        // `anno:` -- the subcommand renamed to `anno` on 2026-08-29
        // -- so a user who mistyped a verb was answered by a subcommand that
        // no longer dispatches. Only the STRING moved: the enclosing function
        // keeps its current name, so no consumer, test or record entry moves
        // with it.
        console.error(
          `anno: unknown verb "${verb}" -- this CLI has exactly six: render-memmap, coverage, export-asm, ` +
            "evid-disagreements, decomp-completeness and hazard-report\n",
        );
        console.log(USAGE);
        return 1;
    }
  } catch (err) {
    // A last-resort net: every expected failure path above already returns its
    // own code with its own message, so anything arriving here is unexpected
    // and is reported verbatim rather than swallowed. The loud failure is the
    // point.
    // Second half of that same fix -- same correction, same reason.
    console.error(`anno: ${errMsg(err)}`);
    return 1;
  }
}
