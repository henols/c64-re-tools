#!/usr/bin/env node
// r2000-cli.ts -- the thin CLI ergonomics layer over the guarded regenerator2000
// seam (D-06). Reached as `vice-mcp r2000 <verb>` because that bin is the only
// surface that resolves identically across the Claude Code plugin route and
// both npm-installer routes: `installer/bin/cli.mjs`'s `viceServerEntry()`
// always launches this server via `npx` in BOTH npm-installer modes, and
// neither route places `.claude/mcp/vice/*.ts` as plain files inside a
// consuming project for some other filesystem-path-resolving design to find.
//
// WHAT NOT TO DO, named concretely:
//   - Never accept a caller-supplied passthrough of extra flags to
//     regenerator2000 (D-07). Every child-process argv is built only by
//     `r2000-launch.ts`'s fixed builders (`buildExportAsmArgs()`,
//     `buildVerifyArgs()`) -- this file adds exactly two options of its own
//     (`--entry`, `--out`), neither of which reaches the child process argv.
//   - Never auto-pick a `.d64` entry when the caller does not name one (D-02).
//     A silent auto-pick would happily analyse a cracktro or loader stub's
//     bytes instead of the actual game -- precisely the failure
//     `c64-provenance-diff` exists to prevent elsewhere in this project. Zero
//     `--entry` means: print the directory listing, tell the user to re-run
//     with `--entry NAME`, and exit 2. Never guess.
//   - Never dispatch a flat `.raw`/`.bin` capture by its BYTE LENGTH alone
//     (WR-07). The incident: a 4096-byte `capture.raw` fell through to the
//     `bytes.length === 65536` branch's `else`, which is `parsePrg()` --
//     whose first two bytes become the load address -- so a truncated
//     capture silently "bootstrapped" with origin `$62c5` (its own first two
//     payload bytes read backwards) and exit 0, with every downstream
//     address wrong and no diagnostic. That is exactly the "silently guess"
//     behaviour D-02 exists to forbid, just for a different input shape.
//     `.raw`/`.bin` inputs are now dispatched by EXTENSION, before the
//     length check, so `flatImageOrigin()`'s own named refusal (any length
//     other than exactly 65536) is always reachable for those two
//     extensions.

//
// `runR2000Cli()` returns an exit code and never terminates the process
// itself, so it is testable in-process as well as from the bin (the bin,
// `vice-proxy.ts`, is the only place that ends the process with this
// function's return value). All output goes to stdout/stderr via
// `console.log`/`console.error` -- never a thrown stack trace for an
// expected, user-facing failure (missing file, unknown `.d64` entry, `.vsf`
// input): each of those produces a single actionable line instead.
//
// Import nothing from `hostpath.ts` or `containerpath.ts`. Every path this
// CLI handles is already container-side: regenerator2000 runs on the MCP
// proxy's side of the boundary (D-R4), and translating any of these
// arguments would be the mirror image of the DERIV-07 screenshot-path trap,
// where a client-side-derived path was wrongly translated a second time.
// This absence is asserted structurally by `hostpath-consumers.test.ts`
// (D-08), not merely stated here.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";

import { buildExportAsmArgs, runR2000, R2000ViceFlagError } from "./r2000-launch.ts";
import { synthesizeProject, parsePrg, flatImageOrigin } from "./r2000-project.ts";
import { listEntries, extractEntry, assertPlainImage } from "./r2000-d64.ts";
import { verifyProject } from "./r2000-verify.ts";
import { generateEnums } from "./r2000-enum-gen.ts";
import { exportLabels, importLabels } from "./r2000-symbols.ts";
import { renderMemoryMap, checkRenderedMemoryMap } from "./r2000-memmap-render.ts";

const NPX_INVOCATION = "npx -y @henols/vice-mcp r2000 <verb>";
const PLUGIN_INVOCATION = "node <plugin-root>/.claude/mcp/vice/vice-proxy.ts r2000 <verb>";

// `verify` is the criterion-4 (R2000-06) proof route: it runs
// regenerator2000's own `--verify` and reports the verdict `r2000-verify.ts`'s
// `acmeVerdict()` derives from the PARSED ACME result line -- never from the
// child process's exit code (D-10). A skipped ACME reads as a failure here,
// not as an absence, even on a transcript whose own exit code and summary
// line both say "passed" -- see r2000-verify.ts's header comment and
// r2000-verify.test.ts's pinned trap transcript for the live incident this
// guards against. A future maintainer reading only this file must not
// reintroduce a `result.status === 0` shortcut anywhere in `cmdVerify()`.
//
// FLOW-02 (D-11.1-01): the `.vsf` paragraph below used to end by naming a
// specific numbered phase as the eventual owner of closing that gap. That
// phase shipped and never touched `.vsf` bootstrap, so the sentence told a
// user to wait on a remediation that would never arrive. A phase number is
// a planning artifact -- it has no place in a shipped diagnostic. Corrected
// to name the backlog file instead; see the matching fix in
// `bootstrapProject()` below and `docs-dangling-refs.test.ts`'s guard
// against this defect class recurring anywhere in this file's string
// literals.
const USAGE = `usage (npm install):    ${NPX_INVOCATION}
usage (plugin/in-repo): ${PLUGIN_INVOCATION}

verbs:
  bootstrap <input> [--entry NAME] [--out PROJECT] [--force]
      Accepts a .prg, a .d64 (pick an entry with --entry), or a flat 64K
      .raw/.bin capture. Writes a .regen2000proj to --out (default: the
      input path with its extension replaced by .regen2000proj). Refuses to
      overwrite an existing file at that path unless --force is given. A
      .regen2000proj input is refused outright -- bootstrap never re-reads
      one; use export-asm or verify on it directly.

  export-asm <input-or-project> [--out FILE] [--force]
      If given a .regen2000proj it is used directly; otherwise this bootstraps
      the input to a temporary project first, so a bare .prg becomes ACME
      source in one command with no human interaction. Writes ACME source to
      --out (default: the input stem plus .a). Refuses to overwrite an
      existing file at that path unless --force is given.

  verify <input-or-project> [--entry NAME]
      The criterion-4 (R2000-06) reassembly proof: exports and reassembles
      through regenerator2000's own --verify, and prints each assembler's
      parsed result line. Exits 0 only when ACME's own line reports success --
      a skipped ACME is a failure here, never a pass, regardless of the child
      process's own exit code or its "All roundtrip verifications passed."
      summary line (D-10). Accepts a .regen2000proj directly, or bootstraps a
      bare .prg/.d64/flat-64K input to a temporary project first, exactly
      like export-asm.

  gen-enums <project> [--max-results N]
      Generates program-specific enums from the register writes an existing
      .regen2000proj's disassembly already contains (D-20/D-22/D-23,
      R2000-13) -- one variant per DISTINCT value actually written, named
      from the curated bit-name table (r2000-regbits.json), applied at every
      matching immediate-load address, and saved. Prints total/paired/
      unpaired register-store counts and, per created/updated enum, its name
      and variant count. Requires an EXISTING .regen2000proj (this verb does
      not bootstrap from a raw input -- run bootstrap first). --max-results
      overrides the 10000-row ceiling on each of the two search passes this
      verb runs internally; exits non-zero, printing the reason, when either
      pass returns exactly its own ceiling (coverage may be incomplete) or
      when generateEnums() itself refuses (an illegal generated identifier,
      or an enum install that failed outright).

  export-lbl <project> [--out FILE]
      Exports the project's user-defined labels to a VICE label file
      (R2000-14): "al C:xxxx .Name" lines that stock-symbols.ts's existing
      parser accepts. The written file is read back and validated through
      that same parser before this verb reports success -- a regenerator2000
      exit code has lied before (r2000-verify.ts's D-10 founding incident),
      so the exit code alone is never trusted. Defaults --out to the project
      path's stem plus .lbl. Prints the written path and the symbol count
      parsed back from the file. Requires an EXISTING .regen2000proj (this
      verb does not bootstrap from a raw input).

  import-lbl <project> <lbl>
      Imports a VICE label file into the project (R2000-15, the D-28 path):
      --import_lbl paired with --mcp-server-stdio plus an explicit
      r2000_save_project -- the only combination that actually persists the
      import (--import_lbl alone under --headless silently discards it,
      main.rs:800-806). Prints the names imported, then an explicit line
      naming the fact that the import was persisted by an explicit save
      (proven by re-reading the project from disk in a fresh process, never
      trusted from the child's own success text alone). Exits non-zero,
      printing the reason, when the result is not disk-verified, or when the
      given .lbl fails stock-symbols.ts's own size/line/symbol ceilings.
      Requires an EXISTING .regen2000proj (this verb does not bootstrap from
      a raw input).

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
      an EXISTING .regen2000proj and an EXISTING --provenance sidecar (this
      verb does not bootstrap from a raw input).

.d64 input with no --entry named prints the directory listing and exits 2 --
this CLI never guesses which entry to use (D-02).

.vsf input is not supported by any verb -- regenerator2000's auto-detected
machine-type field is correct only by coincidence for C64 snapshots, and no
R2000-* requirement covers .vsf as a bootstrap input (D-34). The idea is
recorded as backlog at
.planning/todos/pending/2026-08-20-vsf-as-a-bootstrap-input.md. Convert to
.prg, .d64 or a flat 64K capture.
`;

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface ParsedArgs {
  positional: string[];
  entry?: string;
  out?: string;
  force?: boolean;
}

/** Fixed, closed option set -- exactly `--entry`, `--out` and `--force`. No
 * rest field, no passthrough: an unrecognised flag is treated as a
 * positional token (and will surface as "input file not found" rather than
 * silently reaching regenerator2000, since nothing here ever forwards raw
 * argv to the child process). */
function parseArgs(rest: string[]): ParsedArgs {
  const positional: string[] = [];
  let entry: string | undefined;
  let out: string | undefined;
  let force = false;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--entry") entry = rest[++i];
    else if (a === "--out") out = rest[++i];
    else if (a === "--force") force = true;
    else positional.push(a!);
  }
  return { positional, entry, out, force };
}

/**
 * Refuses to overwrite an existing file at `outPath` unless the caller
 * passed `--force`. Shared by every verb that writes an output file
 * (`bootstrap`, `export-asm`) so overwrite safety stays uniform rather than
 * one verb accreting a check the others lack (CR-01/CR-02).
 */
function refuseOverwrite(outPath: string, force: boolean | undefined, verbLabel: string, extraHint = ""): boolean {
  if (force || !existsSync(outPath)) return true;
  console.error(
    `${verbLabel}: refusing to overwrite the existing file ${outPath}${extraHint} -- ` +
      `pass --force to overwrite it deliberately.`,
  );
  return false;
}

interface BootstrapOutcome {
  code: number;
  path?: string;
}

/**
 * Shared bootstrap logic used both by the `bootstrap` verb directly and by
 * `export-asm` when handed a bare input rather than an existing
 * `.regen2000proj`. Never throws for an expected, user-facing failure --
 * every branch below returns a `{ code }` result with a one-line message
 * already printed to stderr/stdout, so callers never see a stack trace for a
 * missing file, an unknown `.d64` entry, or a `.vsf` input.
 */
function bootstrapProject(
  input: string,
  opts: { entry?: string; outPath?: string; force?: boolean },
): BootstrapOutcome {
  if (!existsSync(input)) {
    console.error(`bootstrap: input file not found: ${input}`);
    return { code: 1 };
  }

  const ext = extname(input).toLowerCase();
  if (ext === ".regen2000proj") {
    // CR-02: without this branch, a .regen2000proj input fell through to
    // parsePrg(), which happily "parsed" the JSON text as a .prg (its first
    // two bytes read as a bogus little-endian load address), and the
    // derived out-path was then byte-identical to the input path --
    // clobbering the project with garbage synthesised from its own text.
    // Decision (see commit message): refuse rather than silently pass it
    // through unchanged -- bootstrap's whole job is synthesising a project
    // from RAW input, and a caller who names an existing .regen2000proj as
    // bootstrap's input almost certainly meant export-asm or verify, which
    // already accept a .regen2000proj directly and do the right thing.
    console.error(
      `bootstrap: ${input} is already a .regen2000proj -- bootstrap synthesises project files from raw ` +
        "input (a .prg, a .d64 entry, or a flat 64K capture), it never re-reads one. Use export-asm or " +
        "verify on it directly.",
    );
    return { code: 1 };
  }
  if (ext === ".vsf") {
    // FLOW-02 (D-11.1-01): this refusal used to end by naming a specific
    // numbered phase as the eventual owner of closing that gap. That phase
    // shipped and never touched `.vsf` bootstrap -- the sentence pointed a
    // user at a remediation path that would never exist. Name the backlog
    // file instead; the WHY (the machine-type coincidence) stays, since
    // that is the reason a user actually needs.
    console.error(
      "bootstrap: .vsf input is not supported -- regenerator2000's auto-detected machine-type field only " +
        'reads correctly by coincidence ("C64SC" falls through to its own default, matching none of its ' +
        "literal System arms). Filed as backlog, not covered by any R2000-* requirement (D-34): see " +
        ".planning/todos/pending/2026-08-20-vsf-as-a-bootstrap-input.md. Convert to .prg, .d64 or a flat " +
        "64K capture instead.",
    );
    return { code: 1 };
  }

  let bytes: Uint8Array;
  try {
    bytes = readFileSync(input);
  } catch (err) {
    console.error(`bootstrap: could not read ${input}: ${errMsg(err)}`);
    return { code: 1 };
  }

  let origin: number;
  let body: Uint8Array;

  if (ext === ".d64") {
    try {
      assertPlainImage(bytes);
    } catch (err) {
      console.error(`bootstrap: ${errMsg(err)}`);
      return { code: 1 };
    }

    if (!opts.entry) {
      // D-02's fail-loud contract, implemented here and nowhere else: never
      // pick an entry. A silent auto-pick would happily analyse a cracktro
      // or loader stub instead of the game.
      let entries;
      try {
        entries = listEntries(bytes);
      } catch (err) {
        console.error(`bootstrap: ${errMsg(err)}`);
        return { code: 1 };
      }
      console.log(`bootstrap: ${input} is a .d64 image with no --entry given -- directory listing:`);
      if (entries.length === 0) {
        console.log("  (no entries)");
      } else {
        for (const e of entries) {
          console.log(`  ${e.name}\t${e.type}\t${e.sizeBlocks} block(s)`);
        }
      }
      console.log("Re-run with --entry NAME to choose one. This CLI never guesses (D-02).");
      return { code: 2 };
    }

    let extracted: Uint8Array;
    try {
      extracted = extractEntry(bytes, opts.entry);
    } catch (err) {
      console.error(`bootstrap: ${errMsg(err)}`);
      return { code: 1 };
    }
    try {
      ({ origin, body } = parsePrg(extracted));
    } catch {
      // WR-09 (D-11.1-04): parsePrg() throws only when its input is under 3
      // bytes (a .prg needs a 2-byte load address plus at least 1 payload
      // byte). Every sibling branch below already wraps its own parsePrg()
      // call -- this was the one gap, and its unwrapped throw escaped to
      // runR2000Cli()'s last-resort net, surfacing as `r2000: parsePrg:
      // input is N byte(s)` -- a message naming an internal function to a
      // user who only ever supplied a disk image. Reworded entirely in the
      // caller's own vocabulary (the entry name, never `parsePrg`) so the
      // never-throw contract holds on this branch too.
      console.error(
        `bootstrap: entry "${opts.entry}" holds ${extracted.length} byte(s) -- not a loadable program ` +
          "(a .prg needs at least 3 bytes: a 2-byte load address plus at least 1 payload byte). Choose a " +
          "different --entry, or use a different input.",
      );
      return { code: 1 };
    }
  } else if (ext === ".raw" || ext === ".bin") {
    // WR-07: dispatch by extension, not by byte length, so a truncated or
    // oversized flat capture hits flatImageOrigin()'s own named refusal
    // instead of falling through to parsePrg() and being silently
    // reinterpreted as a .prg (see the header comment above).
    try {
      origin = flatImageOrigin(bytes);
    } catch (err) {
      console.error(`bootstrap: ${errMsg(err)}`);
      return { code: 1 };
    }
    body = bytes;
  } else if (bytes.length === 65536) {
    // Extension-less flat capture (no `.raw`/`.bin` suffix): the only
    // remaining route by which a 65536-byte flat image reaches
    // flatImageOrigin() is this length check, kept for that case alone.
    origin = flatImageOrigin(bytes);
    body = bytes;
  } else {
    try {
      ({ origin, body } = parsePrg(bytes));
    } catch (err) {
      console.error(`bootstrap: ${errMsg(err)}`);
      return { code: 1 };
    }
  }

  const outPath = opts.outPath ?? input.replace(/\.[^./\\]+$/, "") + ".regen2000proj";
  if (!refuseOverwrite(outPath, opts.force, "bootstrap")) {
    return { code: 1 };
  }
  let projectJson: string;
  try {
    projectJson = synthesizeProject(body, { origin });
  } catch (err) {
    console.error(`bootstrap: ${errMsg(err)}`);
    return { code: 1 };
  }
  try {
    writeFileSync(outPath, projectJson);
  } catch (err) {
    // WR-09 (D-11.1-04): an ENOENT (missing parent directory), EACCES or
    // ENOSPC here is an ordinary, expected failure -- refuseOverwrite()
    // above only handles the exists-case; this is the everything-else case,
    // and it must not throw past this function's own never-throw contract.
    console.error(`bootstrap: could not write ${outPath}: ${errMsg(err)}`);
    return { code: 1 };
  }
  console.log(`bootstrap: wrote ${outPath} (origin $${origin.toString(16).padStart(4, "0")})`);
  return { code: 0, path: outPath };
}

function cmdBootstrap(rest: string[]): number {
  const { positional, entry, out, force } = parseArgs(rest);
  const input = positional[0];
  if (!input) {
    console.error("bootstrap: usage: bootstrap <input> [--entry NAME] [--out PROJECT] [--force]");
    return 1;
  }
  return bootstrapProject(input, { entry, outPath: out, force }).code;
}

function cmdExportAsm(rest: string[]): number {
  const { positional, entry, out, force } = parseArgs(rest);
  const input = positional[0];
  if (!input) {
    console.error("export-asm: usage: export-asm <input-or-project> [--out FILE] [--force]");
    return 1;
  }
  if (!existsSync(input)) {
    console.error(`export-asm: input file not found: ${input}`);
    return 1;
  }

  const ext = extname(input).toLowerCase();
  let projectPath: string;
  let tmpDir: string | undefined;

  try {
    if (ext === ".regen2000proj") {
      projectPath = input;
    } else {
      // Bootstrap to a temp project first, so a bare .prg (or .d64/.raw)
      // becomes ACME source in one command with no human interaction.
      tmpDir = mkdtempSync(join(tmpdir(), "r2000-cli-"));
      const tmpProjectPath = join(tmpDir, "bootstrap.regen2000proj");
      const outcome = bootstrapProject(input, { entry, outPath: tmpProjectPath });
      if (outcome.code !== 0) return outcome.code;
      projectPath = outcome.path!;
    }

    const outPath = out ?? input.replace(/\.[^./\\]+$/, "") + ".a";
    if (
      !refuseOverwrite(
        outPath,
        force,
        "export-asm",
        " with generated source -- acme-build's own convention pairs <stem>.a with <stem>.prg, so " +
          "the default target is very often hand-written source",
      )
    ) {
      return 1;
    }
    const argv = buildExportAsmArgs({ projectPath, outPath });
    const result = runR2000(argv);
    if (result.status !== 0) {
      console.error(`export-asm: regenerator2000 exited ${result.status}`);
      if (result.stderr) console.error(result.stderr);
      return result.status ?? 1;
    }
    console.log(`export-asm: wrote ${outPath}`);
    return 0;
  } finally {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * `verify <input-or-project>` -- the criterion-4 (R2000-06) reassembly
 * proof. Accepts a `.regen2000proj` directly, or bootstraps a bare input to
 * a temporary project first, exactly like `cmdExportAsm()` above. Prints
 * every parsed assembler result line, then the verdict's own reason. The
 * exit code comes from `verifyProject()`'s `ok` field -- which
 * `r2000-verify.ts`'s `acmeVerdict()` derives ONLY from the parsed ACME
 * result line, never from regenerator2000's own process exit code (D-10).
 * A skipped ACME therefore prints and exits as a failure here, reading as
 * exactly that -- never as a silent absence -- even though the underlying
 * `--verify` process may itself have exited 0 with a summary line claiming
 * success (r2000-verify.test.ts's pinned trap transcript is the live
 * incident this guards against).
 */
function cmdVerify(rest: string[]): number {
  const { positional, entry } = parseArgs(rest);
  const input = positional[0];
  if (!input) {
    console.error("verify: usage: verify <input-or-project> [--entry NAME]");
    return 1;
  }
  if (!existsSync(input)) {
    console.error(`verify: input file not found: ${input}`);
    return 1;
  }

  const ext = extname(input).toLowerCase();
  let projectPath: string;
  let tmpDir: string | undefined;

  try {
    if (ext === ".regen2000proj") {
      projectPath = input;
    } else {
      // Bootstrap to a temp project first, so a bare .prg (or .d64/.raw)
      // can be verified in one command with no human interaction.
      tmpDir = mkdtempSync(join(tmpdir(), "r2000-cli-"));
      const tmpProjectPath = join(tmpDir, "bootstrap.regen2000proj");
      const outcome = bootstrapProject(input, { entry, outPath: tmpProjectPath });
      if (outcome.code !== 0) return outcome.code;
      projectPath = outcome.path!;
    }

    const result = verifyProject(projectPath);
    for (const line of result.lines) {
      const glyph = line.outcome === "ok" ? "✓" : "✗";
      console.log(`  ${glyph} ${line.assembler} — ${line.detail}`);
    }

    if (!result.ok) {
      // Print the reason verbatim -- especially a "skipped" reason, which
      // must read as a failure and not as an absence (D-10).
      console.error(`verify: ${result.reason}`);
      return 1;
    }
    console.log(`verify: ${result.reason}`);
    return 0;
  } finally {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  }
}

interface GenEnumsParsedArgs {
  positional: string[];
  maxResults?: number;
  maxResultsRaw?: string;
  unknownOption?: string;
}

/** Fixed, closed option set for gen-enums -- exactly `--max-results`. Per
 * WR-08's posture (do not silently accept a flag a verb does not
 * implement), any OTHER `--flag`-shaped token is recorded as `unknownOption`
 * and refused by the caller, rather than silently treated as a positional
 * argument the way the other verbs' `parseArgs()` does. */
function parseGenEnumsArgs(rest: string[]): GenEnumsParsedArgs {
  const positional: string[] = [];
  let maxResults: number | undefined;
  let maxResultsRaw: string | undefined;
  let unknownOption: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--max-results") {
      maxResultsRaw = rest[++i];
      maxResults = maxResultsRaw !== undefined ? Number.parseInt(maxResultsRaw, 10) : Number.NaN;
    } else if (a.startsWith("--")) {
      unknownOption ??= a;
    } else {
      positional.push(a);
    }
  }
  return { positional, maxResults, maxResultsRaw, unknownOption };
}

/**
 * `gen-enums <project> [--max-results N]` -- D-20/D-22/D-23's whole pass,
 * driven through `generateEnums()` (`r2000-enum-gen.ts`, Task 2). Prints the
 * coverage report's own summary lines (total/paired/unpaired counts, one
 * line per created/updated enum) and returns non-zero when: an unknown
 * option was given (WR-08); no project path was given; the project file
 * does not exist; `--max-results` did not parse as a positive integer;
 * either search pass returned exactly its own ceiling (a possible-
 * truncation signal, D-23's "no silent caps" applied at the CLI's own exit
 * code); or `generateEnums()` itself threw (an illegal generated
 * identifier, or an enum install/apply call that failed outright).
 */
async function cmdGenEnums(rest: string[]): Promise<number> {
  const { positional, maxResults, maxResultsRaw, unknownOption } = parseGenEnumsArgs(rest);
  if (unknownOption) {
    console.error(`gen-enums: unknown option "${unknownOption}"\n`);
    console.log(USAGE);
    return 1;
  }

  const project = positional[0];
  if (!project) {
    console.error("gen-enums: usage: gen-enums <project> [--max-results N]");
    return 1;
  }
  if (!existsSync(project)) {
    console.error(`gen-enums: input file not found: ${project}`);
    return 1;
  }
  if (maxResults !== undefined && (!Number.isInteger(maxResults) || maxResults <= 0)) {
    console.error(`gen-enums: --max-results must be a positive integer, got "${maxResultsRaw}"`);
    return 1;
  }

  let report: Awaited<ReturnType<typeof generateEnums>>;
  try {
    report = maxResults !== undefined ? await generateEnums({ projectPath: project, maxResults }) : await generateEnums({ projectPath: project });
  } catch (err) {
    console.error(`gen-enums: ${errMsg(err)}`);
    return 1;
  }

  for (const line of report.summaryLines) {
    console.log(`  ${line}`);
  }

  if (report.pass1Truncated || report.pass2Truncated) {
    console.error(
      "gen-enums: a search pass returned exactly its own max_results ceiling -- coverage may be incomplete; " +
        "re-run with a higher --max-results",
    );
    return 1;
  }

  console.log(`gen-enums: ${report.enums.length} enum(s) created/updated`);
  return 0;
}

interface ExportLblParsedArgs {
  positional: string[];
  out?: string;
  outMissingValue?: boolean;
  unknownOption?: string;
}

/** Fixed, closed option set for export-lbl -- exactly `--out`. Per WR-08's
 * posture (do not silently accept a flag a verb does not implement, or a
 * flag missing its value), any OTHER `--flag`-shaped token is refused as
 * `unknownOption`, and `--out` with no value (or a flag-shaped "value") is
 * refused as `outMissingValue`, rather than silently treated the way
 * bootstrap/export-asm's own looser `parseArgs()` does. */
function parseExportLblArgs(rest: string[]): ExportLblParsedArgs {
  const positional: string[] = [];
  let out: string | undefined;
  let outMissingValue = false;
  let unknownOption: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--out") {
      const value = rest[i + 1];
      if (value === undefined || value.startsWith("--")) {
        outMissingValue = true;
      } else {
        out = value;
        i++;
      }
    } else if (a.startsWith("--")) {
      unknownOption ??= a;
    } else {
      positional.push(a);
    }
  }
  return { positional, out, outMissingValue, unknownOption };
}

interface ImportLblParsedArgs {
  positional: string[];
  unknownOption?: string;
}

/** import-lbl takes no options at all besides its two positional arguments
 * -- any `--flag`-shaped token is refused as `unknownOption` (WR-08
 * posture), never silently treated as a positional. */
function parseImportLblArgs(rest: string[]): ImportLblParsedArgs {
  const positional: string[] = [];
  let unknownOption: string | undefined;
  for (const a of rest) {
    if (a.startsWith("--")) unknownOption ??= a;
    else positional.push(a);
  }
  return { positional, unknownOption };
}

/**
 * `export-lbl <project> [--out FILE]` -- the R2000-14 export leg, via
 * `r2000-symbols.ts`'s `exportLabels()`. Prints the written path and the
 * symbol count parsed back from the file (never the raw regenerator2000
 * exit code alone -- `exportLabels()` itself already re-reads and validates
 * the file through stock-symbols.ts's parser before returning).
 */
async function cmdExportLbl(rest: string[]): Promise<number> {
  const { positional, out, outMissingValue, unknownOption } = parseExportLblArgs(rest);
  if (unknownOption) {
    console.error(`export-lbl: unknown option "${unknownOption}"\n`);
    console.log(USAGE);
    return 1;
  }
  if (outMissingValue) {
    console.error("export-lbl: --out requires a value\n");
    console.log(USAGE);
    return 1;
  }

  const project = positional[0];
  if (!project) {
    console.error("export-lbl: usage: export-lbl <project> [--out FILE]");
    return 1;
  }
  if (!existsSync(project)) {
    console.error(`export-lbl: project file not found: ${project}`);
    return 1;
  }

  const outPath = out ?? project.replace(/\.[^./\\]+$/, "") + ".lbl";
  let result: Awaited<ReturnType<typeof exportLabels>>;
  try {
    result = await exportLabels({ projectPath: project, outPath });
  } catch (err) {
    console.error(`export-lbl: ${errMsg(err)}`);
    return 1;
  }

  console.log(`export-lbl: wrote ${outPath} (${result.symbolCount} symbol(s))`);
  return 0;
}

/**
 * `import-lbl <project> <lbl>` -- the R2000-15/D-28 import leg, via
 * `r2000-symbols.ts`'s `importLabels()`. Prints the names imported, then an
 * explicit line naming that persistence was proven by an independent disk
 * re-read (never left implicit, so the transcript itself shows the D-28
 * trap was avoided). Exits non-zero -- naming the reason, which includes
 * stock-symbols.ts's own ceiling messages verbatim when the given `.lbl`
 * fails them -- whenever the result is not disk-verified.
 */
async function cmdImportLbl(rest: string[]): Promise<number> {
  const { positional, unknownOption } = parseImportLblArgs(rest);
  if (unknownOption) {
    console.error(`import-lbl: unknown option "${unknownOption}"\n`);
    console.log(USAGE);
    return 1;
  }

  const [project, lbl] = positional;
  if (!project || !lbl) {
    console.error("import-lbl: usage: import-lbl <project> <lbl>");
    return 1;
  }
  if (!existsSync(project)) {
    console.error(`import-lbl: project file not found: ${project}`);
    return 1;
  }
  if (!existsSync(lbl)) {
    console.error(`import-lbl: label file not found: ${lbl}`);
    return 1;
  }

  let result: Awaited<ReturnType<typeof importLabels>>;
  try {
    result = await importLabels({ projectPath: project, lblPath: lbl });
  } catch (err) {
    console.error(`import-lbl: ${errMsg(err)}`);
    return 1;
  }

  console.log(`import-lbl: imported ${result.importedNames.length} name(s): ${result.importedNames.join(", ")}`);
  if (!result.diskVerified) {
    console.error(`import-lbl: ${result.reason}`);
    return 1;
  }
  console.log(
    "import-lbl: persisted by an explicit r2000_save_project call over the same --mcp-server-stdio session " +
      "(D-28) -- verified by re-reading the project from disk in a fresh process, not merely trusted from the " +
      "child's own success text.",
  );
  return 0;
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
 * D-24's generated-view verb, via `r2000-memmap-render.ts`'s
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

/**
 * Entry point for the `r2000` subcommand. Returns an exit code; never calls
 * exit the process directly (the bin does that). Handles `--help`/no verb/unknown
 * verb per `acme.mjs`'s own dispatch convention (`.claude/skills/acme-build/
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

  try {
    switch (verb) {
      case "bootstrap":
        return cmdBootstrap(rest);
      case "export-asm":
        return cmdExportAsm(rest);
      case "verify":
        return cmdVerify(rest);
      case "gen-enums":
        return await cmdGenEnums(rest);
      case "export-lbl":
        return await cmdExportLbl(rest);
      case "import-lbl":
        return await cmdImportLbl(rest);
      case "render-memmap":
        return await cmdRenderMemmap(rest);
      default:
        console.error(`r2000: unknown verb "${verb}"\n`);
        console.log(USAGE);
        return 1;
    }
  } catch (err) {
    // An R2000ViceFlagError from the seam (or any other unexpected throw)
    // must be re-thrown or reported verbatim, never swallowed -- the loud
    // failure is the point (D-07). This is a last-resort net: every expected
    // failure path above already returns its own code with its own message.
    if (err instanceof R2000ViceFlagError) {
      console.error(err.message);
      return 1;
    }
    console.error(`r2000: ${errMsg(err)}`);
    return 1;
  }
}
