#!/usr/bin/env node
// anno-cli.ts -- the thin CLI ergonomics layer over the annotation store.
// Reached as `node <plugin-root>/src/mcp/vice/vice-proxy.ts anno <verb>` on
// the plugin route or an in-repo checkout, and as `vice-mcp anno <verb>`
// from the npm package (which runs the compiled dist/ copy).
// No usage line names an `npx` form: never-auto-install binds shipped
// remedy text, and `npx -y` installs.
//
// ---------------------------------------------------------------------------
// NINE VERBS: render-memmap, coverage, export-asm, evid-disagreements,
// decomp-completeness, hazard-report, export-project, import-project and
// `call`. Eight are named reports over the workspace's own annotation
// project; `call` is the one generic route to the curated `anno_*` tools
// (`CURATED_ANNO_TOOLS` in anno-tool-defs.mts): it takes a tool name and one
// JSON argument object and hands both to `runAnnoTool()` unchanged, so no
// tool is reimplemented here. The bootstrap, verify, gen-enums, export-lbl
// and import-lbl verbs of an earlier analyser-backed CLI have no route.
// ---------------------------------------------------------------------------
//
// WHAT NOT TO DO, named concretely:
//   - Never auto-pick an input when the caller does not name one. A
//     silent auto-pick would happily analyse a cracktro or loader stub's
//     bytes instead of the actual game -- precisely the failure
//     `c64-provenance` exists to prevent elsewhere in this project.
//     Every verb takes EXISTING inputs and refuses rather than guess:
//     `render-memmap` demands its provenance sidecar by name, `coverage`
//     demands its annotation store by name, and `export-asm` demands BOTH an
//     existing store and an existing image. No verb derives one
//     caller-supplied path from another.
//   - Never grow a second path validator. Every caller-supplied path below
//     goes through `storePathWithinWorkspace()` -- the ONE confinement seam,
//     the same one `anno-tools.mts` puts its store and image arguments
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
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, sep } from "node:path";

import { compareRenderedMemoryMap } from "./anno-memmap-check.mts";
// The tree writer. `acme-verify.ts` -- the module that DOES spawn ACME -- is
// deliberately NOT imported here and must never be: it is test-only.
import { writeExportAsmTree } from "./anno-tree-writer.mts";
import { coverageFindings } from "./anno-coverage.mts";
import type { CoverageReport } from "./anno-coverage.mts";
import type { HazardReport } from "./anno-hazard-report.mts";
import type { EvidReconciliation } from "./evid-reconcile.mts";
import { AnnoProjectError, storePathWithinWorkspace, workspaceRelativePath } from "./anno-types.mts";
import { jsonParsePosition } from "./anno-memmap-render.mts";
import { repoRoot } from "./repo-root.ts";
// `call`'s one generic runner. A STATIC import is safe here -- `vice-proxy.ts`
// reaches this whole module only through its own dynamic import, so it never
// becomes part of the server's startup cost.
import { CURATED_ANNO_TOOLS } from "./anno-tool-defs.mts";
import { annoRefusal, annoRunner, runAnnoTool } from "./anno-call-client.ts";
import { annoDbPath, type AnnoCallResult, type RunAnno } from "./anno-workspace-store.ts";
// The report engine: every report is computed there, from the store and the
// bytes this verb stages. This module confines, reads, writes and prints.
import type { AnnoReportName } from "./anno-reports.mts";
import type {
  DecompCompletenessReport,
  DecompExecutionManifest,
} from "./anno-reports.mts";


/** What a verb runs its call through, and the workspace it runs in. The
 * root is read only when a verb needs it, so a verb refused at parsing never
 * resolves one. */
interface CliContext {
  workspaceRoot: () => string;
  runAnno: () => RunAnno;
}

/** What `runAnnoCli()` runs its calls through; tests inject a runner over
 * their own database. Defaults to the workspace's annotations.db under
 * `repoRoot()`. */
export interface AnnoCliDeps {
  runAnno?: RunAnno;
  workspaceRoot?: string;
}

/** A report's answer, with the project it answered for. */
interface ReportAnswer {
  projectId: string;
  json: unknown;
  files: { name: string; bytes: Uint8Array }[];
}

/** A refused report call. */
class ReportFailure extends Error {
  readonly failure: Extract<AnnoCallResult, { ok: false }>;
  constructor(failure: Extract<AnnoCallResult, { ok: false }>) {
    super(failure.message);
    this.failure = failure;
  }
}

/**
 * Runs one report for the workspace's project. Each input in `files` is a
 * confined local path, staged under its key; the engine receives its name and
 * bytes, never the path. A read in a workspace with no project is refused.
 */
async function runReport(
  ctx: CliContext,
  name: AnnoReportName,
  args: Record<string, unknown>,
  files: Record<string, string | undefined>,
  mode: "read" | "write" = "read",
): Promise<ReportAnswer> {
  const staged: Record<string, unknown> = { ...args };
  const slots: Record<string, string> = {};
  for (const [key, path] of Object.entries(files)) {
    if (path === undefined) continue;
    const slot = `f${Object.keys(slots).length}`;
    slots[slot] = path;
    staged[key] = { $file: slot };
  }
  const result = await ctx.runAnno()({ mode, kind: "report", name, args: staged, files: slots });
  if (!result.ok) throw new ReportFailure(result);
  if (result.type !== "report") throw new Error(`a report was answered with a ${result.type} answer`);
  return { projectId: result.projectId, json: result.json, files: result.files };
}

/** Prints a report failure: a refusal the engine wrote in full, verbatim;
 * anything else after the verb. */
function reportFailure(verb: string, err: unknown): number {
  if (err instanceof ReportFailure) {
    const failure = err.failure;
    if (failure.code === "refused") console.error(failure.message);
    else if (failure.code === "failed") console.error(`${verb}: ${failure.message}`);
    else if (failure.code === "no_project") console.error(annoRefusal(verb, failure).message);
    else console.error(`${verb}: ${failure.message}`);
  } else if (err instanceof AnnoProjectError) {
    // Already names the verb: "<verb> refused: this workspace has no ...".
    console.error(errMsg(err));
  } else {
    console.error(`${verb}: ${errMsg(err)}`);
  }
  return 1;
}

/** The project a report answered for, as the reports print it. */
function projectLabel(projectId: string): string {
  return `project ${projectId}`;
}

const PLUGIN_INVOCATION = "node <plugin-root>/src/mcp/vice/vice-proxy.ts anno <verb>";
const NPM_INVOCATION = "vice-mcp anno <verb>";

const USAGE = `usage (plugin/in-repo): ${PLUGIN_INVOCATION}
usage (npm install):    ${NPM_INVOCATION}

verbs:
  render-memmap --provenance FILE --out FILE [--force] [--check]
      Generates the Markdown memory map of this workspace's annotation
      project plus a validated provenance sidecar (the project is canonical;
      this output is a GENERATED VIEW -- never hand-edit it). Without --check,
      writes --out, refusing to overwrite an existing file there unless
      --force is passed, and prints the row count, the number of
      [unknown]-graded rows, and the render digest.
      With --check, re-renders and compares against the file at --out: prints
      "in sync" and exits 0 when they match, prints the first differing line
      and exits non-zero on drift, or prints "missing" and exits non-zero when
      --out does not exist yet. Drift is reported when, and only when, one of
      these changed: this file itself (a hand edit -- which is what --check
      exists to catch); a row of the project (a range, a label, a comment, or
      a comment's confidence grade); the provenance sidecar's bytes; the
      sidecar's location RELATIVE TO THE WORKSPACE ROOT; or the renderer.
      Relocating the checkout is NOT drift, and neither is a fresh clone: the
      banner records only the workspace-relative sidecar location.
      Requires an EXISTING annotation project and an EXISTING --provenance
      sidecar (this verb creates neither).

  coverage <image> [--out FILE] [--force] [--sample N]
      Measures how far a program has actually been reverse-engineered
      through anno-coverage.mts. <image> supplies the PAYLOAD BYTES and the
      load origin; the labels, comments and typed ranges are this workspace's
      annotation project. The project holds annotations and never bytes, so a
      derived measure has to be told which bytes it is measuring.
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
      a refused overwrite of an existing --out without --force), for a project
      it could not read, for a report it could not write, and for an image
      whose PAYLOAD COULD NOT BE DECODED -- that last is not a low score but
      a measurement taken over nothing, and it is reported AFTER the report
      so the reason is on screen. A LOW MEASUREMENT IS A RESULT, NEVER A
      FAILURE, so a bad report still exits 0.
      This verb deliberately reports separate numbers and never a single
      combined figure: one aggregate is precisely what makes a coverage
      claim unfalsifiable, because any one weak measure can be hidden by
      averaging it against a strong one.

  export-asm <image> --out DIR [--ledger FILE] [--force]
      Writes a TREE of ACME source files for a program from this workspace's
      annotation project into --out, a DIRECTORY (D47-A: one output shape at
      every layer, never a second one for a project with no scopes). <image>
      supplies the PAYLOAD BYTES and the load origin; the project holds the
      ranges, labels, comments and enums, and never bytes, so an exporter has
      to be told which bytes it is describing.
      The tree's entry point is root.a, which !sources symbols.a (every
      symbol definition) first, then one file per annotation scope, then
      unscoped.a last for any block that lies inside no scope. A project with
      no scopes yet still writes this same three-file shape -- root.a,
      symbols.a, unscoped.a -- rather than a second, single-file output.
      --out is REQUIRED: the tree goes where you name it. The directory may
      not BE, and may not CONTAIN, the image or the ledger -- --force does not
      lift that refusal. A non-empty destination is otherwise refused unless
      --force is passed, and --force replaces only the names this export
      itself produces -- any other entry already in the directory is refused
      by name, never deleted to make room.
      --ledger names c64-provenance's generated recovery/PROVENANCE.md.
      Supplying it makes the export carry each covered range's recorded
      Verdict and Confidence as inline comments. It is OPTIONAL:
      omitting it exports exactly as before. The flag changes COMMENT TEXT
      ONLY -- it never changes which bytes or which blocks are emitted, and a
      range the supplied ledger does not cover is refused by name rather than
      emitted unannotated.
      Requires an EXISTING annotation project and an EXISTING image, and
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

  evid-disagreements [--run IMAGE_SHA256:ARGV_DIGEST:SEED] [--json]
      Answers where this workspace's byte-derived block classification (its
      own typed ranges) and the observed-execution evidence (anno_evid_exec
      rows, written by anno_evid_ingest) DISAGREE -- the SAME reconciliation
      join the anno_evid_disagreements tool calls, rendered as three
      distinguishable states. Disagreements print FIRST, as rows; agreement
      prints as a single count line, never as rows; an address the block
      table covers with no observation anywhere prints as its own count line
      stating plainly that absence proves nothing -- never evidence that the
      address holds data. Two further count lines name evidence about
      addresses the block table does not classify as code or data at all, so
      a reader summing every line gets what the block table covers, never
      what the program is. No percentage, rate or coverage figure is ever
      printed. --json prints the raw JSON answer instead of the rendered
      report. --run picks the recorded run to answer for; a project that
      holds several runs refuses without it, and one run needs no --run.
      Requires an EXISTING annotation project; creates none and writes
      nothing.

  decomp-completeness --fixture NAME --disagreements FILE --manifest FILE [--json]
      The decomposition-closure completeness answer for ONE fixture, whose
      annotations are this workspace's project. Three REQUIRED arguments,
      none defaulted from another: --fixture names the fixture (its manifest
      path, or just its stem, e.g. "dxa/tracer.prg" or "tracer");
      --disagreements names the JSON "anno evid-disagreements --json" wrote
      for this project's own run; --manifest names the execution manifest
      recording which committed fixtures were actually run. Omitting ANY of
      the three refuses BY NAME with exit 1 -- there is no default and no
      empty-array substitute for a missing disagreement input, because an
      omitted query and a query that found nothing must never render the
      same report.
      The supplied --disagreements document is refused, by name, when it is
      missing any EvidReconciliation field, and when its own recorded
      runIdentity (image_sha256/argv_digest/seed) matches no row in the
      SAME project's own evid-runs table -- a fabricated or foreign empty
      document is refused, never rendered as "no disagreements" (RESEARCH.md
      Pitfall 9, anti-vacuity). The supplied --manifest is refused, by name,
      when it does not list --fixture -- an unlisted fixture is never
      defaulted to "executed".
      Reports the project's byte census (per data type, with an explicit
      denominator and an undefined-byte count that must read zero), the
      survivor search (auto-named labels still sitting in a code region,
      matched by the SAME frozen prefix set the c64-reverse-engineering
      skill's candidate queue uses), the fixture's own execution disposition read
      from --manifest (a NOT EXECUTED fixture renders that fact by name,
      never a clean bill of health), and the disagreement input verbatim.
      Never prints a percentage, rate or combined figure -- the same rule
      this CLI applies to every verb's own report. --json prints the raw
      JSON answer instead of the rendered report.
      Requires an EXISTING annotation project, an EXISTING --disagreements
      document and an EXISTING --manifest file; creates none and writes
      nothing.

  hazard-report --image FILE [--json]
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
      Requires an EXISTING annotation project and an EXISTING image; creates
      neither and writes nothing.

  export-project --out FILE [--force]
      Writes this workspace's whole annotation project -- every range, label,
      comment, enum, cross-reference, observation, scope and exclusion -- as
      one JSON export document at --out, refusing to overwrite an existing
      file unless --force is passed. The document is a text copy of the
      project's committed annotations.db: it diffs and reviews like source,
      and it is the format the test fixtures use. Requires an EXISTING
      annotation project.

  import-project <file>
      Fills this workspace's project from an export-project document, in one
      transaction: every row lands, or none does. The project must be EMPTY
      -- one that already holds any annotation is refused and left
      untouched, never merged. In a workspace with no project yet it creates
      one, as any write does.

  call NAME (--args JSON | --args-file FILE)
      The name set and the argument shapes are exactly the former anno_* MCP
      tools' own. A write in a workspace with no annotation project yet
      creates it: .c64-re-tools/annotations.db, with its one project.

Every annotation lives in this workspace's project, the SQLite file
.c64-re-tools/annotations.db -- a project artifact, committed with the rest of
the project. Every report verb except import-project reads it and refuses a
workspace with no project; none derives one path from another -- this CLI
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
 * No verb takes a store: every annotation is the workspace's own project,
 * in its .c64-re-tools/annotations.db.
 *
 * `export-asm` deliberately carries NO assembler-facing option. It writes
 * source and runs no assembler, so there is no binary to name, no exit status
 * to surface and no flag that could imply either. `--ledger` does not weaken
 * that claim: it is an EVIDENCE-CARRYING
 * INPUT, exactly like `<image>`, never an assembler-facing option -- it names
 * a file to READ, not a way to run or configure an assembler.
 */
export const VERB_OPTIONS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "render-memmap": ["--provenance", "--out", "--force", "--check"],
  coverage: ["--out", "--force", "--sample"],
  "export-asm": ["--out", "--ledger", "--force"],
  "evid-disagreements": ["--run", "--json"],
  "decomp-completeness": ["--fixture", "--disagreements", "--manifest", "--json"],
  "hazard-report": ["--image", "--json"],
  "export-project": ["--out", "--force"],
  "import-project": [],
  call: ["--args", "--args-file"],
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
 * file's header states.
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
 * passed `--force`. Called by the THREE verbs that write a single output FILE
 * -- `cmdRenderMemmap()` (non-`--check` branch only; `--check` never writes),
 * `cmdCoverage()` and `cmdExportProject()` -- so overwrite safety is uniform
 * across all three rather than one verb accreting a check the others lack.
 *
 * "SHARED BY EVERY VERB THAT WRITES AN OUTPUT FILE" IS WHAT THIS DOC USED TO
 * SAY, AND IT WAS NOT TRUE. `render-memmap` wrote an output file and had
 * neither `--force` in its option set nor a call to this function anywhere on
 * its path; an independent review reproduced it destroying a pre-existing file
 * silently, exit code 0. The claim is now stated as the THREE call sites it
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
 * BACK UP TO THREE with `export-project`, whose `--out` is one file, the
 * project's export document.
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
 * `anno export-asm g.prg --out -x` took `-x` as the output path, and the run
 * failed downstream as a confinement or not-found error about a file called
 * `-x` rather than as the `--out requires a value` refusal the parser was
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

/** Confines one caller path to the workspace, printing the refusal when it
 * escapes. The ONE confinement seam, for every path every verb takes. */
function confine(verb: string, raw: string, workspaceRoot: string, what = "path"): string | undefined {
  try {
    return storePathWithinWorkspace(raw, workspaceRoot, what);
  } catch (err) {
    console.error(`${verb}: ${errMsg(err)}`);
    return undefined;
  }
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
 * `render-memmap --provenance FILE --out FILE [--force] [--check]` -- the
 * generated-view verb. The report engine renders the workspace's project
 * with the staged sidecar; this verb writes the file, or with `--check` compares it,
 * and never writes on `--check`.
 *
 * BOTH OF THIS VERB'S PATHS ARE CONFINED before any filesystem probe, because
 * an existence check is itself an oracle for a path the seam is about to
 * refuse. `--out` is required: the map goes where the caller names it.
 */
async function cmdRenderMemmap(rest: string[], ctx: CliContext): Promise<number> {
  const { positional, provenance, provenanceMissingValue, out, outMissingValue, force, check, unknownOption } = parseRenderMemmapArgs(rest);

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
  if (positional.length > 0) {
    console.error(
      `render-memmap: takes no positional argument, got ${JSON.stringify(positional[0])} -- the annotations are this workspace's own ` +
        "project; name the sidecar with --provenance and the output with --out.",
    );
    return 1;
  }
  if (!provenance) {
    console.error("render-memmap: --provenance FILE is required\n");
    console.log(USAGE);
    return 1;
  }
  if (!out) {
    console.error("render-memmap: --out FILE is required -- the memory map goes where you name it; there is no default.\n");
    console.log(USAGE);
    return 1;
  }

  const workspaceRoot = ctx.workspaceRoot();
  const provenancePath = confine("render-memmap", provenance, workspaceRoot, "--provenance path");
  if (provenancePath === undefined) return 1;
  if (!existsSync(provenancePath)) {
    console.error(`render-memmap: provenance sidecar not found: ${provenancePath}`);
    return 1;
  }
  const outPath = confine("render-memmap", out, workspaceRoot, "--out path");
  if (outPath === undefined) return 1;

  // The banner records the sidecar's WORKSPACE-RELATIVE location, so a
  // relocated checkout renders the same bytes.
  const renderArgs = { sidecar_location: workspaceRelativePath(provenancePath, workspaceRoot) };

  if (check) {
    if (!existsSync(outPath)) {
      console.error(`render-memmap: missing -- ${outPath} does not exist yet. Run render-memmap without --check first.`);
      return 1;
    }
    let result: ReturnType<typeof compareRenderedMemoryMap>;
    try {
      const onDisk = readFileSync(outPath, "utf8");
      const rendered = await runReport(ctx, "render-memmap", renderArgs, { sidecar: provenancePath });
      result = compareRenderedMemoryMap(onDisk, new TextDecoder().decode(rendered.files[0]!.bytes));
    } catch (err) {
      return reportFailure("render-memmap", err);
    }
    if (result.status === "in-sync") {
      console.log(`render-memmap: in sync (${outPath})`);
      return 0;
    }
    console.error(`render-memmap: drifted at line ${result.line}`);
    console.error(`  expected: ${result.expected}`);
    console.error(`  actual:   ${result.actual}`);
    return 1;
  }

  // `--check` never writes, so the overwrite refusal belongs on THIS branch
  // only, against the CONFINED path.
  if (!refuseOverwrite(outPath, force, "render-memmap")) {
    return 1;
  }

  let rendered: ReportAnswer;
  try {
    rendered = await runReport(ctx, "render-memmap", renderArgs, { sidecar: provenancePath });
  } catch (err) {
    return reportFailure("render-memmap", err);
  }
  const summary = rendered.json as { renderDigest: string; rowCount: number; unknownCount: number };
  try {
    writeFileSync(outPath, rendered.files[0]!.bytes);
  } catch (err) {
    // An ordinary write failure (missing parent directory, permissions, full
    // disk) must not throw past this verb's own never-throw contract.
    console.error(`render-memmap: could not write ${outPath}: ${errMsg(err)}`);
    return 1;
  }
  console.log(`render-memmap: wrote ${outPath} (${summary.rowCount} row(s), ${summary.unknownCount} [unknown], digest ${summary.renderDigest})`);
  return 0;
}

interface CoverageParsedArgs {
  positional: string[];
  out?: string;
  outMissingValue?: boolean;
  force?: boolean;
  sample?: number;
  sampleRaw?: string;
  sampleMissingValue?: boolean;
  unknownOption?: string;
}

/** Fixed, closed option set for coverage -- exactly `--out`, `--force` and
 * `--sample`. Same closed-option-set posture as `parseRenderMemmapArgs()`
 * above: an unimplemented flag is refused as `unknownOption`, and
 * `--out`/`--sample` with a missing or flag-shaped value are refused
 * through their own `*MissingValue` fields rather than silently swallowing the
 * next token. */
function parseCoverageArgs(rest: string[]): CoverageParsedArgs {
  const positional: string[] = [];
  let out: string | undefined;
  let outMissingValue = false;
  let force = false;
  let sample: number | undefined;
  let sampleRaw: string | undefined;
  let sampleMissingValue = false;
  let unknownOption: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--out") {
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
  return { positional, out, outMissingValue, force, sample, sampleRaw, sampleMissingValue, unknownOption };
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
 * combined figure at the point of display. `anno-coverage.mts`'s report
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
 * `coverage <image> [--out FILE] [--force] [--sample N]` -- the coverage
 * instrument, computed by the report engine from the workspace's project
 * and the staged image. The image supplies the bytes; the project holds annotations
 * and never bytes, so the measure has to be told which bytes it measures.
 *
 * BOTH PATHS ARE CONFINED -- the positional and `--out` -- through the one
 * seam, before any probe. The report's `project.path` is restored to the
 * confined path this verb read: the engine saw only the file's name.
 *
 * The exit code is 0 for any report it managed to build, however poor the
 * numbers are -- a bad score is a result, not a failure. Non-zero is reserved
 * for a caller error (bad path, bad option, refused overwrite), for a project
 * it could not read, and for a payload it could not decode.
 */
async function cmdCoverage(rest: string[], ctx: CliContext): Promise<number> {
  const { positional, out, outMissingValue, force, sample, sampleRaw, sampleMissingValue, unknownOption } = parseCoverageArgs(rest);

  if (unknownOption) {
    console.error(`coverage: unknown option "${unknownOption}"\n`);
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
    console.error("coverage: usage: coverage <image> [--out FILE] [--force] [--sample N]");
    return 1;
  }
  if (sample !== undefined && (!Number.isInteger(sample) || sample <= 0)) {
    console.error(`coverage: --sample must be a positive integer, got "${sampleRaw}"`);
    return 1;
  }

  const workspaceRoot = ctx.workspaceRoot();
  const projectPath = confine("coverage", project, workspaceRoot, "image path");
  if (projectPath === undefined) return 1;
  const outPath = out === undefined ? undefined : confine("coverage", out, workspaceRoot, "--out path");
  if (out !== undefined && outPath === undefined) return 1;
  if (!existsSync(projectPath)) {
    console.error(`coverage: project file not found: ${projectPath}`);
    return 1;
  }

  // Against the CONFINED path, so the file this check protects is the file
  // that would actually be written.
  if (outPath !== undefined && !refuseOverwrite(outPath, force, "coverage")) {
    return 1;
  }

  let report: CoverageReport;
  try {
    const answer = await runReport(ctx, "coverage", sample !== undefined ? { sample_size: sample } : {}, { image: projectPath });
    report = answer.json as CoverageReport;
    report.project.path = projectPath;
  } catch (err) {
    return reportFailure("coverage", err);
  }

  printCoverageReport(report);

  if (outPath !== undefined) {
    try {
      writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
    } catch (err) {
      console.error(`coverage: could not write ${outPath}: ${errMsg(err)}`);
      return 1;
    }
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
  out?: string;
  outMissingValue?: boolean;
  /** The ledger `c64-provenance` generates
   * (`recovery/PROVENANCE.md`). OPTIONAL -- see `ExportAsmOptions.ledgerPath`
   * in `anno-export-asm.mts` for why. */
  ledger?: string;
  ledgerMissingValue?: boolean;
  force?: boolean;
  unknownOption?: string;
}

/** Fixed, closed option set for export-asm -- exactly `--out`, `--ledger`
 * and `--force`. The SAME closed-option-set posture, and deliberately the same
 * SHAPE, as `parseRenderMemmapArgs()` and `parseCoverageArgs()` above rather
 * than a third convention: an unimplemented flag is refused as
 * `unknownOption`, and `--out`/`--ledger` with a missing or
 * flag-shaped value are refused through their own `*MissingValue` fields
 * rather than silently swallowing the next token. */
function parseExportAsmArgs(rest: string[]): ExportAsmParsedArgs {
  const positional: string[] = [];
  let out: string | undefined;
  let outMissingValue = false;
  let ledger: string | undefined;
  let ledgerMissingValue = false;
  let force = false;
  let unknownOption: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--out") {
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
  return { positional, out, outMissingValue, ledger, ledgerMissingValue, force, unknownOption };
}

/**
 * Whether `dir` (a directory `--out` is about to become, or
 * already is) either equals `candidate` exactly, or genuinely CONTAINS it.
 * Compared by PATH SEGMENT via a trailing separator, never by string prefix
 * (T-47-14) -- `candidate.startsWith(dir)` alone would also match a
 * SIBLING whose name merely starts with the same characters (`game-src2`
 * beside `game-src`), which is exactly the false positive a segment boundary
 * rules out.
 *
 * Both arguments MUST already be confined, realpath-resolved strings (this
 * verb's inputs and `--out` all go through `storePathWithinWorkspace()`
 * before either ever reaches here); this function performs no confinement of
 * its own and compares the two strings it is given.
 */
function pathIsOrContains(dir: string, candidate: string): boolean {
  if (candidate === dir) return true;
  const withTrailingSep = dir.endsWith(sep) ? dir : dir + sep;
  return candidate.startsWith(withTrailingSep);
}

/**
 * `export-asm <image> --out DIR [--ledger FILE] [--force]` -- a TREE of ACME
 * source files for a program, planned by the report engine from the
 * workspace's project and the staged image, and written here.
 *
 * EVERY PATH IS CONFINED before any probe, and the RAW CALLER STRING IS DEAD
 * after it: the confined realpath is what is read, compared and written.
 * The output directory may not BE, and may not CONTAIN, the image, the
 * ledger or the project's annotations.db, and `--force` does not lift that
 * refusal: nobody types it meaning
 * "destroy my input". The directory's own overwrite contract is
 * `writeExportAsmTree()`'s.
 *
 * THIS VERB DOES NOT ASSEMBLE. It writes source text and nothing it prints
 * may be read as a verification result.
 */
async function cmdExportAsm(rest: string[], ctx: CliContext): Promise<number> {
  const { positional, out, outMissingValue, ledger, ledgerMissingValue, force, unknownOption } = parseExportAsmArgs(rest);

  if (unknownOption) {
    console.error(`export-asm: unknown option "${unknownOption}"\n`);
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
    console.error("export-asm: usage: export-asm <image> --out DIR [--ledger FILE] [--force]");
    return 1;
  }
  if (!out) {
    console.error("export-asm: --out DIR is required -- the tree goes where you name it; there is no default.\n");
    console.log(USAGE);
    return 1;
  }

  const workspaceRoot = ctx.workspaceRoot();
  const imagePath = confine("export-asm", positional[0]!, workspaceRoot, "image path");
  if (imagePath === undefined) return 1;
  const ledgerPath = ledger === undefined ? undefined : confine("export-asm", ledger, workspaceRoot, "--ledger path");
  if (ledger !== undefined && ledgerPath === undefined) return 1;
  if (!existsSync(imagePath)) {
    console.error(`export-asm: image not found: ${imagePath}`);
    return 1;
  }
  if (ledgerPath !== undefined && !existsSync(ledgerPath)) {
    console.error(
      `export-asm: ledger not found: ${ledgerPath} -- regenerate it with c64-provenance's "ledger" verb, or omit ` +
        "--ledger to export without provenance annotation.",
    );
    return 1;
  }
  const outPath = confine("export-asm", out, workspaceRoot, "--out path");
  if (outPath === undefined) return 1;
  // The project's own database lives inside the workspace, so an --out at or
  // above it would put the tree among the annotations it was exported from.
  const storePath = confine("export-asm", annoDbPath(workspaceRoot), workspaceRoot);
  if (storePath === undefined) return 1;

  for (const { path: inputPath, which } of [
    { path: imagePath, which: "image (<image>)" },
    { path: ledgerPath, which: "ledger (--ledger)" },
    { path: storePath, which: "annotation store (.c64-re-tools/annotations.db)" },
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

  let summary: {
    files: string[];
    sourceOrder: string[];
    blockCount: number;
    symbolCount: number;
    autoNamedSymbolCount: number;
    unexpressibleCount: number;
    midInstructionLabelCount: number;
    enumSubstitutionCount: number;
    excludedRangeCount: number;
  };
  try {
    const answer = await runReport(ctx, "export-asm", {}, { image: imagePath, ledger: ledgerPath });
    summary = answer.json as typeof summary;
    writeExportAsmTree(outPath, { files: answer.files, sourceOrder: summary.sourceOrder }, force === true);
  } catch (err) {
    return reportFailure("export-asm", err);
  }
  // Every file MINUS the two structural files that are ALWAYS written
  // (symbols.a, root.a) -- the files that carry this project's own content.
  const dataFileCount = summary.files.length - 2;
  console.log(
    `export-asm: wrote ${outPath} (${summary.files.length} file(s), ${dataFileCount} data file(s), ${summary.blockCount} block(s), ` +
      `${summary.symbolCount} symbol(s), ${summary.autoNamedSymbolCount} auto-named, ${summary.unexpressibleCount} unexpressible instruction(s), ` +
      `${summary.midInstructionLabelCount} mid-instruction label(s), ${summary.enumSubstitutionCount} enum substitution(s), ` +
      `${summary.excludedRangeCount} exclusion(s) marked)`,
  );
  console.log("export-asm: this tree has NOT been assembled -- this command writes source text and runs no assembler.");
  return 0;
}

interface EvidDisagreementsParsedArgs {
  positional: string[];
  run?: string;
  runMissingValue?: boolean;
  json?: boolean;
  unknownOption?: string;
}

/** Fixed, closed option set for evid-disagreements -- exactly `--json`, a
 * plain boolean parsed the same shape `--force`/`--check` already use. Same
 * closed-option-set posture as every other verb's own parser: an
 * unimplemented flag is refused as `unknownOption`. */
function parseEvidDisagreementsArgs(rest: string[]): EvidDisagreementsParsedArgs {
  const positional: string[] = [];
  let json = false;
  let run: string | undefined;
  let runMissingValue = false;
  let unknownOption: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--json") {
      json = true;
    } else if (a === "--run") {
      const value = rest[i + 1];
      if (value === undefined || value.startsWith("-")) runMissingValue = true;
      else {
        run = value;
        i += 1;
      }
    } else if (a.startsWith("--")) {
      unknownOption ??= a;
    } else {
      positional.push(a);
    }
  }
  return { positional, run, runMissingValue, json, unknownOption };
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
function printEvidDisagreementsReport(label: string, r: EvidReconciliation): void {
  console.log(`evid-disagreements: ${label}`);
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
 * `evid-disagreements [--json]` -- where the workspace's typed ranges and its
 * observed-execution evidence disagree, as the report engine's
 * reconciliation answers it. `--json` prints the raw answer, with the project and the run
 * identity beside it; otherwise `printEvidDisagreementsReport()` renders the
 * three states.
 */
async function cmdEvidDisagreements(rest: string[], ctx: CliContext): Promise<number> {
  const { positional, run, runMissingValue, json, unknownOption } = parseEvidDisagreementsArgs(rest);

  if (unknownOption) {
    console.error(`evid-disagreements: unknown option "${unknownOption}"\n`);
    console.log(USAGE);
    return 1;
  }
  if (runMissingValue) {
    console.error("evid-disagreements: --run requires a value\n");
    console.log(USAGE);
    return 1;
  }
  if (positional.length > 0) {
    console.error(`evid-disagreements: takes no positional argument, got ${JSON.stringify(positional[0])} -- it answers for this workspace's own project.`);
    return 1;
  }

  let selector: { image_sha256: string; argv_digest: string; seed: string } | undefined;
  if (run !== undefined) {
    const first = run.indexOf(":");
    const second = first < 0 ? -1 : run.indexOf(":", first + 1);
    if (first < 0 || second < 0 || second === run.length - 1) {
      console.error("evid-disagreements: --run must read IMAGE_SHA256:ARGV_DIGEST:SEED");
      return 1;
    }
    selector = { image_sha256: run.slice(0, first), argv_digest: run.slice(first + 1, second), seed: run.slice(second + 1) };
  }

  let answer: ReportAnswer;
  try {
    answer = await runReport(ctx, "evid-disagreements", selector === undefined ? {} : { run: selector }, {});
  } catch (err) {
    return reportFailure("evid-disagreements", err);
  }
  // `runIdentity` rides beside the reconciliation, `null` unless the project
  // holds exactly one run, so decomp-completeness can validate this document
  // against the SAME project's evid-runs table.
  const { runIdentity, ...reconciliation } = answer.json as { runIdentity: { imageSha256: string; argvDigest: string; seed: string } | null } & EvidReconciliation;

  if (json) {
    console.log(JSON.stringify({ project: answer.projectId, runIdentity, ...reconciliation }, null, 2));
    return 0;
  }
  printEvidDisagreementsReport(projectLabel(answer.projectId), reconciliation);
  return 0;
}

/** Strips a trailing recognised extension and any leading directory
 * segments, so `dxa/tracer.prg` and `tracer` both reduce to the bare stem
 * `tracer` -- the ONE fixture-identity comparison this verb makes. Never a
 * full-path comparison: the manifest's paths are fixtures-relative, `--fixture`
 * is whatever the caller typed, and the two only ever agree on the bare
 * stem. */
function fixtureStem(path: string): string {
  const base = basename(path);
  return base.replace(/\.[^./]+$/, "");
}

interface DecompCompletenessParsedArgs {
  positional: string[];
  fixture?: string;
  fixtureMissingValue?: boolean;
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
  let fixture: string | undefined;
  let fixtureMissingValue = false;
  let disagreements: string | undefined;
  let disagreementsMissingValue = false;
  let manifest: string | undefined;
  let manifestMissingValue = false;
  let json = false;
  let unknownOption: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--fixture") {
      const value = rest[i + 1];
      if (isMissingOptionValue(value)) fixtureMissingValue = true;
      else {
        fixture = value;
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
  return { positional, fixture, fixtureMissingValue, disagreements, disagreementsMissingValue, manifest, manifestMissingValue, json, unknownOption };
}

/**
 * `decomp-completeness --fixture NAME --disagreements FILE --manifest FILE
 * [--json]` -- the completeness gate for one fixture whose annotations are
 * the workspace's project. Three required arguments, none defaulted from
 * another. This verb finds the fixture's manifest entry and stages the
 * fixture's own image beside it; the report engine validates the disagreement
 * document against the project's own runs and computes every measure.
 */
async function cmdDecompCompleteness(rest: string[], ctx: CliContext): Promise<number> {
  const { fixture, fixtureMissingValue, disagreements, disagreementsMissingValue, manifest, manifestMissingValue, json, unknownOption } =
    parseDecompCompletenessArgs(rest);

  if (unknownOption) {
    console.error(`decomp-completeness: unknown option "${unknownOption}"\n`);
    console.log(USAGE);
    return 1;
  }
  if (fixtureMissingValue) {
    console.error("decomp-completeness: --fixture requires a value\n");
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
  if (!fixture) {
    console.error("decomp-completeness: --fixture NAME is required -- this verb answers a question about ONE fixture.\n");
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
        'never defaulted to "executed".\n',
    );
    console.log(USAGE);
    return 1;
  }

  const workspaceRoot = ctx.workspaceRoot();
  const disagreementsPath = confine("decomp-completeness", disagreements, workspaceRoot, "--disagreements path");
  if (disagreementsPath === undefined) return 1;
  const manifestPath = confine("decomp-completeness", manifest, workspaceRoot, "--manifest path");
  if (manifestPath === undefined) return 1;
  if (!existsSync(disagreementsPath)) {
    console.error(`decomp-completeness: --disagreements file not found: ${disagreementsPath}`);
    return 1;
  }
  if (!existsSync(manifestPath)) {
    console.error(`decomp-completeness: --manifest file not found: ${manifestPath}`);
    return 1;
  }

  let manifestDoc: unknown;
  try {
    manifestDoc = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (err) {
    // Never the parser's own message: it quotes the file's bytes.
    console.error(`decomp-completeness: --manifest file is not valid JSON${jsonParsePosition(err)}`);
    return 1;
  }
  if (typeof manifestDoc !== "object" || manifestDoc === null || !Array.isArray((manifestDoc as Record<string, unknown>).fixtures)) {
    console.error(`decomp-completeness: --manifest file does not carry a top-level "fixtures" array: ${manifestPath}`);
    return 1;
  }
  const manifestFixtures = (manifestDoc as DecompExecutionManifest).fixtures;

  const stem = fixtureStem(fixture);
  const manifestEntry = manifestFixtures.find((f) => fixtureStem(f.path) === stem);
  if (!manifestEntry) {
    console.error(
      `decomp-completeness: no fixture matching ${JSON.stringify(fixture)} (stem ${JSON.stringify(stem)}) is listed in the manifest ` +
        `${manifestPath} -- an unlisted fixture is refused, never defaulted to "executed".`,
    );
    return 1;
  }

  // The fixture's own bytes -- the manifest entry's path, resolved beside the
  // manifest file, never a second guess at where the image lives. An image
  // that is not there is not sent; the report says so by name.
  // The derived path goes through the same confinement seam as every other
  // path: an entry that climbs out of the workspace is refused by name.
  const fixtureImagePath = confine("decomp-completeness", join(dirname(manifestPath), manifestEntry.path), workspaceRoot, "the manifest entry's image path");
  if (fixtureImagePath === undefined) return 1;
  let report: DecompCompletenessReport;
  try {
    const answer = await runReport(ctx, "decomp-completeness", { manifest_entry: manifestEntry }, {
      disagreements: disagreementsPath,
      fixture_image: existsSync(fixtureImagePath) ? fixtureImagePath : undefined,
    });
    report = answer.json as DecompCompletenessReport;
  } catch (err) {
    return reportFailure("decomp-completeness", err);
  }

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
 * invocation without `--json`; `completeness-report.ts`'s
 * `renderCompletenessReport()` is the report the c64-annotations skill
 * actually reads, built from this same verb's `--json` answer.
 */
function printDecompCompletenessReport(r: DecompCompletenessReport): void {
  console.log(`decomp-completeness: ${projectLabel(r.project)}`);
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
  image?: string;
  imageMissingValue?: boolean;
  json?: boolean;
  unknownOption?: string;
}

/** Fixed, closed option set for hazard-report -- exactly `--image` and
 * `--json`. Same closed-option-set posture as every other verb's own
 * parser: an unimplemented flag is refused as `unknownOption`, and an
 * option with a missing or flag-shaped value is refused through its own
 * `*MissingValue` field rather than silently swallowing the next token. */
function parseHazardReportArgs(rest: string[]): HazardReportParsedArgs {
  const positional: string[] = [];
  let image: string | undefined;
  let imageMissingValue = false;
  let json = false;
  let unknownOption: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--image") {
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
  return { positional, image, imageMissingValue, json, unknownOption };
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
function printHazardReport(label: string, imagePath: string, r: HazardReport & { matched: number; returned: number }): void {
  console.log(`hazard-report: ${label}`);
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
 * `hazard-report --image FILE [--json]` -- the movement-hazard report for the
 * workspace's project over the staged image, as the report engine computes it. It
 * REPORTS and changes nothing. `--json` prints the raw answer with the
 * project and the image beside it.
 */
async function cmdHazardReport(rest: string[], ctx: CliContext): Promise<number> {
  const { image, imageMissingValue, json, unknownOption } = parseHazardReportArgs(rest);

  if (unknownOption) {
    console.error(`hazard-report: unknown option "${unknownOption}"\n`);
    console.log(USAGE);
    return 1;
  }
  if (imageMissingValue) {
    console.error("hazard-report: --image requires a value\n");
    console.log(USAGE);
    return 1;
  }
  if (!image) {
    console.error("hazard-report: --image FILE is required -- the project holds annotations, never bytes.\n");
    console.log(USAGE);
    return 1;
  }

  const imagePath = confine("hazard-report", image, ctx.workspaceRoot(), "image path");
  if (imagePath === undefined) return 1;
  if (!existsSync(imagePath)) {
    console.error(`hazard-report: image not found: ${imagePath}`);
    return 1;
  }

  let answer: ReportAnswer;
  try {
    answer = await runReport(ctx, "hazard-report", {}, { image: imagePath });
  } catch (err) {
    return reportFailure("hazard-report", err);
  }
  const report = answer.json as HazardReport & { returned: number; matched: number };
  if (json) {
    console.log(JSON.stringify({ project: answer.projectId, image: imagePath, ...report }, null, 2));
    return 0;
  }
  printHazardReport(projectLabel(answer.projectId), imagePath, report);
  return 0;
}

// ---------------------------------------------------------------------------
// The text pair: `export-project` and `import-project`. The committed
// annotations.db is binary, so these give it a text form that diffs and
// reviews, and fill a fresh project from one -- the fixtures' own format.
// ---------------------------------------------------------------------------

interface ExportProjectParsedArgs {
  positional: string[];
  out?: string;
  outMissingValue?: boolean;
  force?: boolean;
  unknownOption?: string;
}

/** Fixed, closed option set for export-project -- exactly `--out` and
 * `--force`, the same shape as every other verb's parser. */
function parseExportProjectArgs(rest: string[]): ExportProjectParsedArgs {
  const positional: string[] = [];
  let out: string | undefined;
  let outMissingValue = false;
  let force = false;
  let unknownOption: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--out") {
      const value = rest[i + 1];
      if (isMissingOptionValue(value)) outMissingValue = true;
      else {
        out = value;
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
  return { positional, out, outMissingValue, force, unknownOption };
}

function countsLine(counts: Record<string, number>): string {
  return Object.entries(counts)
    .map(([key, n]) => `${n} ${key}`)
    .join(", ");
}

/** `export-project --out FILE [--force]` -- the workspace's whole project as
 * one export document, written where `--out` names. */
async function cmdExportProject(rest: string[], ctx: CliContext): Promise<number> {
  const { positional, out, outMissingValue, force, unknownOption } = parseExportProjectArgs(rest);
  if (unknownOption) {
    console.error(`export-project: unknown option "${unknownOption}"\n`);
    console.log(USAGE);
    return 1;
  }
  if (outMissingValue) {
    console.error("export-project: --out requires a value\n");
    console.log(USAGE);
    return 1;
  }
  if (positional.length > 0) {
    console.error(`export-project: takes no positional argument, got ${JSON.stringify(positional[0])} -- it exports this workspace's own project.`);
    return 1;
  }
  if (!out) {
    console.error("export-project: --out FILE is required -- the document goes where you name it; there is no default.\n");
    console.log(USAGE);
    return 1;
  }
  const outPath = confine("export-project", out, ctx.workspaceRoot(), "--out path");
  if (outPath === undefined) return 1;
  if (!refuseOverwrite(outPath, force, "export-project")) return 1;

  let answer: ReportAnswer;
  try {
    answer = await runReport(ctx, "export-project", {}, {});
  } catch (err) {
    return reportFailure("export-project", err);
  }
  try {
    writeFileSync(outPath, answer.files[0]!.bytes);
  } catch (err) {
    console.error(`export-project: could not write ${outPath}: ${errMsg(err)}`);
    return 1;
  }
  const { counts } = answer.json as { counts: Record<string, number> };
  console.log(`export-project: wrote ${outPath} (${projectLabel(answer.projectId)}: ${countsLine(counts)})`);
  return 0;
}

/** `import-project <file>` -- fills the workspace's EMPTY project from an
 * export document, in one transaction. A write: in a workspace with no
 * project yet, it registers one first. */
async function cmdImportProject(rest: string[], ctx: CliContext): Promise<number> {
  const positional = rest.filter((a) => !a.startsWith("--"));
  if (positional.length !== 1) {
    console.error("import-project: usage: import-project <file> -- exactly one export-project document");
    return 1;
  }
  const documentPath = confine("import-project", positional[0]!, ctx.workspaceRoot(), "document path");
  if (documentPath === undefined) return 1;
  if (!existsSync(documentPath)) {
    console.error(`import-project: document not found: ${documentPath}`);
    return 1;
  }

  let answer: ReportAnswer;
  try {
    answer = await runReport(ctx, "import-project", {}, { document: documentPath }, "write");
  } catch (err) {
    return reportFailure("import-project", err);
  }
  const { imported } = answer.json as { imported: Record<string, number> };
  console.log(`import-project: imported ${documentPath} into ${projectLabel(answer.projectId)} (${countsLine(imported)})`);
  return 0;
}

interface CallParsedArgs {
  positional: string[];
  args?: string;
  argsMissingValue?: boolean;
  argsFile?: string;
  argsFileMissingValue?: boolean;
}

/** Fixed, closed option set for `call` -- exactly `--args` and `--args-file`.
 * Uses the SAME `isMissingOptionValue()` predicate the other three parsers
 * share (30-REVIEW WR-09), so `call anno_get_symbols --args --args-file` (a
 * flag where a value was expected) is refused as a missing value rather than
 * silently taking the next flag as `--args`'s value. */
function parseCallArgs(rest: string[]): CallParsedArgs {
  const positional: string[] = [];
  let args: string | undefined;
  let argsMissingValue = false;
  let argsFile: string | undefined;
  let argsFileMissingValue = false;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--args") {
      const value = rest[i + 1];
      if (isMissingOptionValue(value)) {
        argsMissingValue = true;
      } else {
        args = value;
        i++;
      }
    } else if (a === "--args-file") {
      const value = rest[i + 1];
      if (isMissingOptionValue(value)) {
        argsFileMissingValue = true;
      } else {
        argsFile = value;
        i++;
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, args, argsMissingValue, argsFile, argsFileMissingValue };
}

/**
 * `call <anno_tool_name> (--args JSON | --args-file FILE)` -- D-12's one
 * generic verb. It refuses a name outside `CURATED_ANNO_TOOLS`, reads the
 * argument object from exactly one of `--args`/`--args-file`, and hands both
 * straight to `runAnnoTool()` UNCHANGED -- there is no second implementation
 * of any of the 28 former MCP verbs here, and `anno-tools.mts` is not edited
 * by this change. The name set and the argument shapes are exactly the
 * former `anno_*` MCP tools' own, so a skill's existing argument
 * documentation for those tools stays valid against this verb.
 *
 * USAGE spells the positional `NAME`, not `<anno_tool_name>` -- deliberately
 * NOT angle-bracketed, unlike every other verb's positional. Every other
 * `<...>`-shaped synopsis token on this CLI is a caller-supplied PATH, and
 * `anno-cli-path-consumers.test.ts`'s own positional direction reads any
 * `<...>` token as exactly that: a path argument requiring its own
 * `storePathWithinWorkspace()` call site. A tool NAME is not a path and is
 * never confined, so bracketing it would misclassify it as one and desync
 * the path-consumers seam count from its own inventory.
 *
 * `--args-file`'s path IS a caller-supplied path and goes through the SAME
 * ONE confinement seam every other path this CLI accepts uses,
 * `storePathWithinWorkspace()` against `ctx.workspaceRoot()` -- read BEFORE the file
 * is opened, so a path outside the workspace root never reaches
 * `readFileSync` at all. A JSON parse failure never echoes the file's bytes
 * back (the CR-03 posture this file's header names): the refusal names only
 * the flag, never the content that failed to parse.
 *
 * Every missing-value check runs BEFORE `positional[0]` is read, matching
 * the other three parsers' own discipline (see `cmdRenderMemmap()`'s own
 * ordering): `call some.project --args -x` must refuse "`--args` requires a
 * value", never fall through and report "-x" or "some.project" as anything.
 */
async function cmdCall(rest: string[], ctx: CliContext): Promise<number> {
  const { positional, args, argsMissingValue, argsFile, argsFileMissingValue } = parseCallArgs(rest);

  if (argsMissingValue) {
    console.error("call: --args requires a value\n");
    console.log(USAGE);
    return 1;
  }
  if (argsFileMissingValue) {
    console.error("call: --args-file requires a value\n");
    console.log(USAGE);
    return 1;
  }
  if (args !== undefined && argsFile !== undefined) {
    console.error("call: --args and --args-file may not both be given -- pick exactly one\n");
    console.log(USAGE);
    return 1;
  }

  const name = positional[0];
  if (!name) {
    console.error("call: usage: call NAME (--args JSON | --args-file FILE)");
    return 1;
  }
  if (!CURATED_ANNO_TOOLS.includes(name)) {
    console.error(`call: unknown anno tool "${name}" -- accepted names: ${CURATED_ANNO_TOOLS.join(", ")}`);
    return 1;
  }
  if (args === undefined && argsFile === undefined) {
    console.error("call: one of --args JSON or --args-file FILE is required\n");
    console.log(USAGE);
    return 1;
  }

  let raw: string;
  if (argsFile !== undefined) {
    const workspaceRoot = ctx.workspaceRoot();
    let argsFilePath: string;
    try {
      argsFilePath = storePathWithinWorkspace(argsFile, workspaceRoot, "--args-file");
    } catch (err) {
      console.error(`call: ${errMsg(err)}`);
      return 1;
    }
    try {
      raw = readFileSync(argsFilePath, "utf8");
    } catch (err) {
      console.error(`call: could not read --args-file: ${errMsg(err)}`);
      return 1;
    }
  } else {
    raw = args!;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Never echo `raw` back -- the same CR-03 posture `cmdRenderMemmap()`'s
    // own confinement gives `--provenance`, applied here to the parse
    // failure itself rather than to a path.
    console.error(`call: --args${argsFile !== undefined ? "-file" : ""} did not parse as JSON`);
    return 1;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    console.error(`call: --args${argsFile !== undefined ? "-file" : ""} must decode to a JSON object`);
    return 1;
  }

  const result = await runAnnoTool(name, parsed, { runAnno: ctx.runAnno(), workspaceRoot: ctx.workspaceRoot() });
  const text = result.content.map((c) => c.text).join("");
  if (result.isError) {
    console.error(text);
    return 1;
  }
  console.log(text);
  return 0;
}

/**
 * Entry point for the `anno` subcommand. Returns an exit code; never calls
 * exit the process directly (the bin does that). Handles `--help`/no verb/unknown
 * verb per `acme.ts`'s own dispatch convention (`skills/c64-assembler/
 * scripts/acme.ts`), with one deliberate difference: an explicit `--help`
 * returns 0 (a no-op invocation with no verb also returns 0), while an
 * unrecognised verb returns 1.
 */
export async function runAnnoCli(argv: string[], deps: AnnoCliDeps = {}): Promise<number> {
  const [verb, ...rest] = argv;
  let workspaceRoot: string | undefined = deps.workspaceRoot;
  const ctx: CliContext = {
    workspaceRoot: () => (workspaceRoot ??= repoRoot()),
    runAnno: () => annoRunner({ runAnno: deps.runAnno, workspaceRoot: ctx.workspaceRoot() }),
  };

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
        return await cmdRenderMemmap(rest, ctx);
      case "coverage":
        return await cmdCoverage(rest, ctx);
      case "export-asm":
        return await cmdExportAsm(rest, ctx);
      case "evid-disagreements":
        return await cmdEvidDisagreements(rest, ctx);
      case "decomp-completeness":
        return await cmdDecompCompleteness(rest, ctx);
      case "hazard-report":
        return await cmdHazardReport(rest, ctx);
      case "export-project":
        return await cmdExportProject(rest, ctx);
      case "import-project":
        return await cmdImportProject(rest, ctx);
      case "call":
        return await cmdCall(rest, ctx);
      default:
        // Corrected 2026-08-30. This prefix read
        // `anno:` -- the subcommand renamed to `anno` on 2026-08-29
        // -- so a user who mistyped a verb was answered by a subcommand that
        // no longer dispatches. Only the STRING moved: the enclosing function
        // keeps its current name, so no consumer, test or record entry moves
        // with it.
        console.error(
          `anno: unknown verb "${verb}" -- this CLI has exactly nine: render-memmap, coverage, export-asm, ` +
            "evid-disagreements, decomp-completeness, hazard-report, export-project, import-project and call\n",
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
