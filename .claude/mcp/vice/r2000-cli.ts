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
import { extname, join } from "node:path";

import { buildExportAsmArgs, runR2000, R2000ViceFlagError } from "./r2000-launch.ts";
import { synthesizeProject, parsePrg, flatImageOrigin } from "./r2000-project.ts";
import { listEntries, extractEntry, assertPlainImage } from "./r2000-d64.ts";
import { verifyProject } from "./r2000-verify.ts";

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
const USAGE = `usage (npm install):    ${NPX_INVOCATION}
usage (plugin/in-repo): ${PLUGIN_INVOCATION}

verbs:
  bootstrap <input> [--entry NAME] [--out PROJECT]
      Accepts a .prg, a .d64 (pick an entry with --entry), or a flat 64K
      .raw/.bin capture. Writes a .regen2000proj to --out (default: the
      input path with its extension replaced by .regen2000proj).

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

.d64 input with no --entry named prints the directory listing and exits 2 --
this CLI never guesses which entry to use (D-02).

.vsf input is not supported by any verb. Phase 9 found its machine-type
field only reads correctly by coincidence; closing that gap for real is
Phase 11's job, not this CLI's. Convert to .prg, .d64 or a flat 64K capture.
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
function bootstrapProject(input: string, opts: { entry?: string; outPath?: string }): BootstrapOutcome {
  if (!existsSync(input)) {
    console.error(`bootstrap: input file not found: ${input}`);
    return { code: 1 };
  }

  const ext = extname(input).toLowerCase();
  if (ext === ".vsf") {
    console.error(
      "bootstrap: .vsf input is not supported -- Phase 9 found its machine-type field only reads " +
        'correctly by coincidence ("C64SC" falls through to regenerator2000\'s own default, matching ' +
        "none of its literal System arms). Closing that gap for real is Phase 11's job, not this CLI's. " +
        "Convert to .prg, .d64 or a flat 64K capture instead.",
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
    ({ origin, body } = parsePrg(extracted));
  } else if (bytes.length === 65536) {
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
  let projectJson: string;
  try {
    projectJson = synthesizeProject(body, { origin });
  } catch (err) {
    console.error(`bootstrap: ${errMsg(err)}`);
    return { code: 1 };
  }
  writeFileSync(outPath, projectJson);
  console.log(`bootstrap: wrote ${outPath} (origin $${origin.toString(16).padStart(4, "0")})`);
  return { code: 0, path: outPath };
}

function cmdBootstrap(rest: string[]): number {
  const { positional, entry, out } = parseArgs(rest);
  const input = positional[0];
  if (!input) {
    console.error("bootstrap: usage: bootstrap <input> [--entry NAME] [--out PROJECT]");
    return 1;
  }
  return bootstrapProject(input, { entry, outPath: out }).code;
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
