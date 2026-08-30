#!/usr/bin/env node
// anno-cli.ts -- the thin CLI ergonomics layer over the annotation store
// (D-06). Reached as `vice-mcp anno <verb>` because that bin is the only
// surface that resolves identically across the Claude Code plugin route and
// both npm-installer routes: `installer/bin/cli.mjs`'s `viceServerEntry()`
// always launches this server via `npx` in BOTH npm-installer modes, and
// neither route places `src/mcp/vice/*.ts` as plain files inside a
// consuming project for some other filesystem-path-resolving design to find.
//
// ---------------------------------------------------------------------------
// THREE VERBS. THAT IS THE WHOLE SURFACE (D-14, 2026-08-29; third verb landed
// 2026-08-31).
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
//     withdrawal in `.planning/PROJECT.md`'s shipped-capability list rather
//     than left for a reader to discover by running it. The exact wording of
//     those withdrawal notices across both skill trees is re-pointed in one
//     place, by the plan that owns the tree-wide sweep (30-06); this file
//     states the code fact and does not restate their text, so the two edits
//     cannot contradict each other.
//
// WHAT NOT TO DO, named concretely:
//   - Never auto-pick an input when the caller does not name one (D-02). A
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
//     now names the mechanism that keeps it. `29-VERIFICATION.md` gap 3 /
//     `29-REVIEW.md` CR-02 and CR-03 reproduced three escapes on this very
//     tree, on arguments the shipped playbooks tell an agent to compose in a
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
//     deliberately rather than discovered (WR-02): it does not associate a
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
import { basename, dirname, extname, join } from "node:path";

import { renderMemoryMap, checkRenderedMemoryMap } from "./anno-memmap-render.ts";
// The ACME source emitter (EXPORT-01). It reads the store and the image and
// returns text plus counts; it starts no assembler and knows nothing about
// one. `acme-verify.ts` -- the module that DOES spawn ACME -- is deliberately
// NOT imported here and must never be: it is test-only (it is absent from
// `package.json`'s `files[]` on purpose), so a shipped module importing it
// would drag it into the published closure `check-npm-packages.mjs` walks.
import { exportAsm } from "./anno-export-asm.ts";
import type { ExportAsmResult } from "./anno-export-asm.ts";
// The coverage instrument (COV-01/COV-02). It declares its own input shapes
// and never reads a store, a file or a tool on its own behalf -- a caller
// fetches and hands the data in, which is exactly what makes the store
// re-point below a CALLER-side change and nothing more.
import { buildCoverageReport, coverageFindings, loadProjectImage } from "./anno-coverage.ts";
import type { CoverageReport, LoadedProject, R2000Comment, R2000CrossReference, R2000Symbol } from "./anno-coverage.ts";
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
import { repoRoot } from "./repo-root.ts";
const NPX_INVOCATION = "npx -y @henols/vice-mcp anno <verb>";
const PLUGIN_INVOCATION = "node <plugin-root>/src/mcp/vice/vice-proxy.ts anno <verb>";

const USAGE = `usage (npm install):    ${NPX_INVOCATION}
usage (plugin/in-repo): ${PLUGIN_INVOCATION}

verbs:
  render-memmap <store> --provenance FILE [--out FILE] [--force] [--check]
      Generates the Markdown memory map from an annotation store plus a
      validated provenance sidecar (D-24: the store is canonical, this
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
      (COV-01/COV-02), through anno-coverage.ts. <image> supplies the
      PAYLOAD BYTES and the load origin; --store names the ANNOTATION STORE
      holding the labels, comments and typed ranges. Those are two separate
      files on purpose: the store holds annotations and never bytes, so a
      derived measure has to be told which bytes it is measuring and this
      verb refuses to guess one from the other.
      <image> is dispatched IN THIS ORDER, and the order is load-bearing:
      first, a .raw or .bin is read as a flat capture BY EXTENSION, before
      any length check, so a truncated capture is refused BY NAME instead
      of falling through to the .prg parser (WR-07: a 4096-byte .raw once
      had its first two bytes read as a load address and reported a
      complete-looking measurement); then any file that is NOT a .prg and
      is exactly 65536 bytes is read as a flat capture, which is the one
      branch that does dispatch on byte length; then a .prg, whose first
      two bytes are the load address. The retired JSON project form
      survives as a TRAILING LEGACY branch, reached only when none of
      those matched -- its only producer was deleted (D-14) and it is kept
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

  export-asm <image> --store FILE [--out FILE] [--force]
      Writes ACME source for a program from its annotation store. <image>
      supplies the PAYLOAD BYTES and the load origin; --store names the
      ANNOTATION STORE holding the ranges, labels, comments and enums. Those
      are two separate files on purpose, and NEITHER IS DERIVED FROM THE
      OTHER: the store holds annotations and never bytes, so an exporter has
      to be told which bytes it is describing and this verb refuses to guess
      one from the other.
      The default --out is the image's basename with a .a extension, in the
      STORE's own directory. That derived default is put through the SAME
      confinement seam as a caller-supplied --out, rather than trusted
      because this verb computed it. An existing destination is refused
      unless --force is passed.
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

Every verb requires inputs that already exist. None creates a project, a
store or a sidecar, and none derives one path from another -- this CLI
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
 * defaulted from `<image>` -- see this file's header on never deriving one
 * caller-supplied path from another. `export-asm`'s `--store` is required on
 * the same terms and for the same reason.
 *
 * `export-asm` deliberately carries NO assembler-facing option. It writes
 * source and runs no assembler, so there is no binary to name, no exit status
 * to surface and no flag that could imply either.
 */
export const VERB_OPTIONS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "render-memmap": ["--provenance", "--out", "--force", "--check"],
  coverage: ["--store", "--out", "--force", "--sample"],
  "export-asm": ["--store", "--out", "--force"],
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
 * passed `--force`. Called by ALL THREE verbs that write an output file --
 * `cmdRenderMemmap()` (non-`--check` branch only; `--check` never writes),
 * `cmdCoverage()` and `cmdExportAsm()` -- so overwrite safety is uniform
 * rather than one verb accreting a check the others lack (CR-01/CR-02).
 *
 * "SHARED BY EVERY VERB THAT WRITES AN OUTPUT FILE" IS WHAT THIS DOC USED TO
 * SAY, AND IT WAS NOT TRUE. `render-memmap` wrote an output file and had
 * neither `--force` in its option set nor a call to this function anywhere on
 * its path; `29-REVIEW.md` CR-02 reproduced it destroying a pre-existing file
 * silently, exit code 0. The claim is now stated as the two call sites it
 * actually has, because a count is checkable where "every" is not.
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
 * `--out`, `--force` and `--check`. Per WR-08's posture (do not silently
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
 * -- D-24's generated-view verb, via `anno-memmap-render.ts`'s
 * `renderMemoryMap()`/`checkRenderedMemoryMap()`. Never writes a file when
 * `--check` is given -- that mode only reads and reports.
 *
 * ALL THREE OF THIS VERB'S PATHS ARE CONFINED, and the reason each one is
 * named here rather than left to a reader to infer is that two of them were
 * NOT, and shipped that way. `29-VERIFICATION.md` gap 3 / `29-REVIEW.md`
 * CR-02 and CR-03 reproduced both on this tree:
 *
 *   - `--out` reached `writeFileSync` as the RAW caller string. Pointed
 *     outside the workspace root it exited 0, printed `wrote /tmp/.../
 *     PRECIOUS.md` and replaced that pre-existing file's bytes. `--force`
 *     was not in this verb's option set at all, so `refuseOverwrite()` --
 *     whose own doc claims the safety is uniform across every verb that
 *     writes an output file -- was never reached from here (CR-02).
 *   - `--provenance` reached `readFileSync` as the RAW caller string, making
 *     it an arbitrary-file read oracle; the sidecar parse failure then
 *     interpolated Node's own parse error, which carries a snippet of the
 *     file, so the oracle DISCLOSED CONTENT (CR-03). Confining it here also
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
 * site (WR-02), so six arguments confined once each and five confined with one
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

  // CR-03. The sidecar is confined BEFORE the existence check, so a path
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

  // CR-02. The default is applied FIRST and the result confined AFTER, so the
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

  // CR-02, the second half. `--check` never writes, so the overwrite refusal
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
 * `coverage <image> --store FILE [--out FILE] [--force] [--sample N]` --
 * COV-01's delivery path: the instrument from `anno-coverage.ts`, run against
 * a real program and a real annotation store.
 *
 * TWO PATHS, NEITHER DERIVED FROM THE OTHER. `<image>` carries the payload
 * bytes and the load origin; `--store` names the annotation store holding the
 * labels, comments and typed ranges. The store holds annotations and never
 * bytes, so a derived measure has to be told which bytes it is measuring, and
 * guessing one path from the other is exactly the auto-pick D-02 forbids.
 *
 * Two properties this function must keep:
 *   - NO SECOND PATH VALIDATOR (T-19-22 / T-29-28), over ALL THREE of this
 *     verb's caller-supplied paths -- the positional, `--store` and `--out`.
 *     The count is stated because it was WRONG: this doc said "both" and meant
 *     it, while `--out` reached `refuseOverwrite()` and `writeFileSync()` as
 *     the raw caller string. `29-REVIEW.md` CR-02 reproduced the escape --
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
 *     with a given call site (WR-02), so it cannot tell six arguments
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

  // T-19-22 / T-29-28 / CR-02: the ONE confinement seam, for ALL THREE
  // caller-supplied paths. Never a second hand-rolled one, and never a
  // different rule for the store than for the program it annotates -- or, as
  // CR-02 found, no rule at all for the report this verb writes.
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
    // failure it is, AFTER the report, so the reason is on screen (COV-02).
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
  force?: boolean;
  unknownOption?: string;
}

/** Fixed, closed option set for export-asm -- exactly `--store`, `--out` and
 * `--force`. The SAME WR-08 posture, and deliberately the same SHAPE, as
 * `parseRenderMemmapArgs()` and `parseCoverageArgs()` above rather than a
 * third convention: an unimplemented flag is refused as `unknownOption`, and
 * `--store`/`--out` with a missing or flag-shaped value are refused through
 * their own `*MissingValue` fields rather than silently swallowing the next
 * token. */
function parseExportAsmArgs(rest: string[]): ExportAsmParsedArgs {
  const positional: string[] = [];
  let store: string | undefined;
  let storeMissingValue = false;
  let out: string | undefined;
  let outMissingValue = false;
  let force = false;
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
    } else if (a === "--force") {
      force = true;
    } else if (a.startsWith("--")) {
      unknownOption ??= a;
    } else {
      positional.push(a);
    }
  }
  return { positional, store, storeMissingValue, out, outMissingValue, force, unknownOption };
}

/**
 * The destination `export-asm` writes to when the caller names none: the
 * IMAGE's basename with its extension replaced by `.a`, in the STORE's own
 * directory.
 *
 * The store's directory rather than the image's, deliberately and for the
 * reason `render-memmap`'s `memory-map.md` default already gives: the output
 * is a GENERATED VIEW of the annotations, so it belongs beside the artefact it
 * was generated from. The image is an input this verb only reads.
 *
 * A name with no extension keeps its whole basename and gains `.a`; a name
 * that already ends in `.a` is unchanged in spelling, which is correct -- the
 * caller then gets the overwrite refusal rather than a silently-different
 * destination.
 */
function defaultExportAsmOut(imagePath: string, storeDir: string): string {
  const base = basename(imagePath);
  const ext = extname(base);
  const stem = ext === "" ? base : base.slice(0, -ext.length);
  return join(storeDir, `${stem}.a`);
}

/**
 * `export-asm <image> --store FILE [--out FILE] [--force]` -- ACME source for
 * a program, emitted from its annotation store by `anno-export-asm.ts`'s
 * `exportAsm()`.
 *
 * ALL THREE OF THIS VERB'S PATHS ARE CONFINED, and the ORDER each step happens
 * in is the load-bearing part rather than the mere presence of the calls. It
 * follows `cmdRenderMemmap()`'s chain deliberately, because that chain is the
 * corrected shape of three reproduced escapes (`29-VERIFICATION.md` gap 3 /
 * `29-REVIEW.md` CR-02 and CR-03) on exactly the argument shapes this verb
 * has:
 *
 *   - `<image>` and `--store` go through `storePathWithinWorkspace()` BEFORE
 *     any `existsSync` probe. A stat is itself an oracle -- it answers "does
 *     this file exist" for any path this process can reach -- so probing first
 *     and confining second would leak that answer for a path the seam is about
 *     to refuse.
 *   - `--out`'s DEFAULT is applied FIRST and the result confined AFTER, so a
 *     path this verb computed is confined by the same rule as one a caller
 *     supplied, rather than trusted because this verb computed it (CR-02).
 *   - From each seam call onwards the RAW CALLER STRING IS DEAD.
 *     `storePathWithinWorkspace()` returns the REALPATH, and it is the
 *     realpath that reaches `readFileSync`, `openStore()`, `refuseOverwrite()`
 *     and `writeFileSync` -- so every printed line names the file that is
 *     actually on disk.
 *   - `refuseOverwrite()` runs against the CONFINED destination, so the file
 *     it protects is the file that would actually be written.
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
  const { positional, store, storeMissingValue, out, outMissingValue, force, unknownOption } = parseExportAsmArgs(rest);

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

  if (positional.length !== 1) {
    console.error("export-asm: usage: export-asm <image> --store FILE [--out FILE] [--force]");
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

  // T-30-15 / CR-03: the ONE confinement seam, on both input paths, BEFORE any
  // filesystem probe. `openStore()` downstream is handed this same workspace
  // root, so its own confinement agrees by construction rather than by a
  // second rule.
  const workspaceRoot = repoRoot();
  let imagePath: string;
  let storePath: string;
  try {
    imagePath = storePathWithinWorkspace(image, workspaceRoot);
    storePath = storePathWithinWorkspace(store, workspaceRoot);
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

  // T-30-02 / CR-02. The default is applied FIRST and the RESULT confined,
  // so the derived path and a caller-supplied one are confined by the same
  // rule.
  let outPath: string;
  try {
    outPath = storePathWithinWorkspace(out ?? defaultExportAsmOut(imagePath, dirname(storePath)), workspaceRoot);
  } catch (err) {
    console.error(`export-asm: ${errMsg(err)}`);
    return 1;
  }

  // Against the CONFINED path, so the file this check protects is the file
  // that would actually be written.
  if (!refuseOverwrite(outPath, force, "export-asm")) {
    return 1;
  }

  let result: ExportAsmResult;
  try {
    result = exportAsm({ storePath, imagePath, workspaceRoot });
  } catch (err) {
    // Every refusal the exporter raises -- an uncovered range, an
    // inexpressible enum binding, a comment with no line to attach to --
    // arrives here already named. It is reported as this verb's own
    // single actionable line and never as a thrown stack trace, and the verb
    // exits non-zero rather than reporting success over a dropped annotation.
    console.error(`export-asm: ${errMsg(err)}`);
    return 1;
  }
  try {
    writeFileSync(outPath, result.source);
  } catch (err) {
    // Same shape as `cmdRenderMemmap()`'s write failure one verb over (WR-09):
    // an ordinary write failure -- missing parent directory, permissions, full
    // disk -- must not throw past this verb's own never-throw contract.
    console.error(`export-asm: could not write ${outPath}: ${errMsg(err)}`);
    return 1;
  }
  console.log(
    `export-asm: wrote ${outPath} (${result.blocks.length} block(s), ${result.symbolCount} symbol(s), ` +
      `${result.autoNamedSymbolCount} auto-named, ${result.unexpressibleCount} unexpressible instruction(s), ` +
      `${result.midInstructionLabelCount} mid-instruction label(s), ${result.enumSubstitutionCount} enum substitution(s))`,
  );
  console.log("export-asm: this file has NOT been assembled -- this command writes source text and runs no assembler.");
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
      case "export-asm":
        return await cmdExportAsm(rest);
      default:
        // WR-14 site 2, corrected 2026-08-30 (plan 29-16). This prefix read
        // `r2000:` -- the subcommand renamed to `anno` on 2026-08-29 (29-09)
        // -- so a user who mistyped a verb was answered by a subcommand that
        // no longer dispatches. Only the STRING moved: the enclosing function
        // keeps its current name, so no consumer, test or record entry moves
        // with it (see the plan's <wr14_scope_decision>).
        console.error(`anno: unknown verb "${verb}" -- this CLI has exactly three: render-memmap, coverage and export-asm\n`);
        console.log(USAGE);
        return 1;
    }
  } catch (err) {
    // A last-resort net: every expected failure path above already returns its
    // own code with its own message, so anything arriving here is unexpected
    // and is reported verbatim rather than swallowed. The loud failure is the
    // point (D-07).
    // WR-14 site 2, second half -- same correction, same reason.
    console.error(`anno: ${errMsg(err)}`);
    return 1;
  }
}
