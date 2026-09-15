#!/usr/bin/env node
// make-hazard-subject-fixtures.mjs -- the reproducible generator for the
// hazard-subject fixture tree.
//
// WHY A GENERATOR RATHER THAN A HAND-COMMITTED BLOB: `hazard-subject.prg` is
// only evidence for anything while it is EXACTLY what `hazard-subject.a`
// (which pulls in every other part with `!source`) assembles to. A
// hand-committed blob would let the source and the image drift apart
// silently. This tree's own fixture test re-assembles the root and
// byte-compares it against the committed image, so a drift is a red rather
// than a quiet degradation of every test that reads the fixture.
//
// DETERMINISM IS PART OF THE CONTRACT: running this script twice must leave
// `git status --porcelain src/mcp/vice/fixtures/hazard-subject` empty. There
// is no timestamp, no random value and no host-dependent path in either
// emitted file -- ACME's `-f cbm` output is a pure function of the source
// tree.
//
// IT REFUSES RATHER THAN WRITING A PARTIAL FIXTURE. If the assembler is
// missing, or exits non-zero, or writes no output file, this script prints
// the reason and exits non-zero WITHOUT touching either committed `.prg`. A
// generator that half-wrote its output on a broken toolchain would replace a
// good fixture with a bad one and every test over it would then be testing
// the failure.
//
// WHY IT DOES NOT IMPORT ANY TEST-ONLY MODULE: this generator lives under
// `fixtures/` and is neither a test nor a shipped module, so it reads the
// assembler binary name from the environment by the same exact name every
// other regenerator and gate in this tree binds, and does its own probe
// rather than importing a module that asserts its own absence from the
// package's shipped file list.
//
// THE FILENAME DELIBERATELY CARRIES NO TEST SUFFIX, for the same reason the
// sibling `export-asm` and `coverage` fixture generators carry none: a
// `*.test.mjs` here would register this directory as a suite directory that
// nothing actually runs as one.
//
// THE WORKING DIRECTORY IS SET TO THIS DIRECTORY for the assembler child
// process, so every root source's bare-filename `!source "..."` lines
// resolve without a directory component anywhere in the source text.
//
// THE SECOND AND THIRD FIXTURES HAVE NO COMMITTED ROOT SOURCE FILE OF THEIR
// OWN. Each root is SYNTHESIZED here, in memory, from the committed
// `hazard-subject.a` by swapping one or more of its bare-filename `!source`
// lines for a sibling variant's -- every other planted construction stays
// shared and unmodified between builds. The synthesized text is written to
// a throwaway file in the OS temp directory, never inside this fixture
// directory, so a run never leaves a stray file behind for `git status` to
// notice. One shared helper (`substituteSourceLines()`) performs every such
// swap; do not copy its body a third time -- see that function's own
// comment.
//
// Regenerate with:
//   cd src/mcp/vice && node fixtures/hazard-subject/make-hazard-subject-fixtures.mjs

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Read by the exact name every sibling regenerator and gate in this tree
 * binds. Never rename one side only. */
const ACME_BIN = process.env.ACME_BIN ?? "acme";

const ALIGNED_SOURCE_LINE = '!source "hazard-subject-align.a"';
const MISALIGNED_SOURCE_LINE = '!source "hazard-subject-align-misaligned.a"';
const DISPATCH_SOURCE_LINE = '!source "hazard-subject-dispatch.a"';
const DISPATCH_REGRESSED_SOURCE_LINE = '!source "hazard-subject-dispatch-regressed.a"';
const ALIGN_REGRESSED_SOURCE_LINE = '!source "hazard-subject-align-regressed.a"';
const ALIGN_NOSPRITE_SOURCE_LINE = '!source "hazard-subject-align-nosprite.a"';

/** THE ONE `!source`-line substitution implementation in this file. Reads
 * the committed `hazard-subject.a` root, and for every `[from, to]` pair in
 * `pairs`, replaces `from` with `to`. Refuses (via the caller's `fail()`)
 * rather than silently assembling the WRONG variant if the committed root
 * ever stops containing one of the exact lines being replaced. Every
 * synthesized-root fixture below calls this instead of re-implementing its
 * own read-and-replace. */
function substituteSourceLines(pairs) {
  let rootText = readFileSync(join(HERE, "hazard-subject.a"), "utf8");
  for (const [from, to] of pairs) {
    if (!rootText.includes(from)) {
      fail(`hazard-subject.a no longer contains ${JSON.stringify(from)} -- a synthesized root's substitution has nothing to replace`);
    }
    rootText = rootText.replace(from, to);
  }
  return rootText;
}

/** Builds the second build's root text by swapping the ONE `!source` line
 * that pulls in the aligned construction for the mis-aligned twin's own
 * file. */
function misalignedRootSource() {
  return substituteSourceLines([[ALIGNED_SOURCE_LINE, MISALIGNED_SOURCE_LINE]]);
}

/** Builds the third build's root text: the regressed twin. Swaps BOTH the
 * dispatch and the alignment `!source` lines for their regressed sibling
 * files, in one root, so the three planted single-bit regressions
 * (dispatch_target_1's $D020 immediate, plus the align routine's $D015 and
 * $D018 immediates) all land in the same image. Every other planted
 * construction (the SMC entry, the raster entry) stays shared and
 * unmodified with the committed subject. */
function regressedRootSource() {
  return substituteSourceLines([
    [DISPATCH_SOURCE_LINE, DISPATCH_REGRESSED_SOURCE_LINE],
    [ALIGNED_SOURCE_LINE, ALIGN_REGRESSED_SOURCE_LINE],
  ]);
}

/** Builds the fourth build's root text: the MODIFIED subject. Swaps the
 * alignment `!source` line for `hazard-subject-align-nosprite.a`, which
 * removes the sprite construction and calls the second self-modifying
 * construction for the first time -- see that file's own header for the
 * two named finding anchors this modification cross-references. Every
 * other planted construction (the SMC entry, the dispatch entry, the
 * raster entry) stays shared and unmodified with the committed subject. */
function modifiedRootSource() {
  return substituteSourceLines([[ALIGNED_SOURCE_LINE, ALIGN_NOSPRITE_SOURCE_LINE]]);
}

/** The builds this script owns. The first assembles the committed root
 * directly; every other entry assembles a synthesized root (see above)
 * that pulls in every other planted construction UNCHANGED. Later parts of
 * each build are pulled in by `!source`, never listed here as separate
 * entries. */
const FIXTURES = [
  { rootSourceName: "hazard-subject.a", output: "hazard-subject.prg", format: "cbm" },
  { buildRootText: misalignedRootSource, output: "hazard-subject-misaligned.prg", format: "cbm" },
  { buildRootText: regressedRootSource, output: "hazard-subject-regressed.prg", format: "cbm" },
  { buildRootText: modifiedRootSource, output: "hazard-subject-modified.prg", format: "cbm" },
];

function fail(reason) {
  process.stderr.write(`make-hazard-subject-fixtures: ${reason}\n`);
  process.stderr.write("make-hazard-subject-fixtures: REFUSING to write a partial fixture -- nothing was changed.\n");
  process.exit(1);
}

// Probe first, and refuse before writing anything. The probe is the
// argv-array form, never a shell-interpreted command string: `ACME_BIN` is
// externally supplied and reaches a process launch here.
//
// THE FALLBACK LADDER: try `--version` first, then `--help`, because ACME
// 0.97 prints its banner to either depending on the build. A build where
// `--version` does not exit zero should not make this generator refuse a
// fixture that would in fact assemble fine.
function probeAcmeBanner() {
  let r = spawnSync(ACME_BIN, ["--version"], { encoding: "utf8", timeout: 30_000 });
  let banner = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.error || !/acme/i.test(banner)) {
    r = spawnSync(ACME_BIN, ["--help"], { encoding: "utf8", timeout: 30_000 });
    banner = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  }
  if (r.error) return { ok: false, detail: String(r.error.message) };
  if (!/acme/i.test(banner)) return { ok: false, detail: `neither --version nor --help printed an ACME banner (exit ${String(r.status)})` };
  return { ok: true, detail: "" };
}

const probe = probeAcmeBanner();
if (!probe.ok) {
  fail(`no usable ACME at ${JSON.stringify(ACME_BIN)} (set ACME_BIN, or put \`acme\` on PATH): ${probe.detail}`);
}

const workDir = mkdtempSync(join(tmpdir(), "make-hazard-subject-fixtures-"));
try {
  for (const fixture of FIXTURES) {
    const outputPath = join(HERE, fixture.output);
    const tempOut = join(workDir, fixture.output);

    // Either an existing committed root (`rootSourceName`, resolved relative
    // to this directory so `!source` lines with no directory component
    // work), or a root SYNTHESIZED into the same throwaway temp directory
    // the output goes to (`buildRootText`). Exactly one of the two is set
    // per entry.
    let acmeSourceArg;
    if (fixture.rootSourceName) {
      const sourcePath = join(HERE, fixture.rootSourceName);
      if (!existsSync(sourcePath)) fail(`the ACME source ${JSON.stringify(sourcePath)} does not exist`);
      acmeSourceArg = fixture.rootSourceName;
    } else {
      const tempRootPath = join(workDir, `synthesized-root-${fixture.output}.a`);
      writeFileSync(tempRootPath, fixture.buildRootText());
      acmeSourceArg = tempRootPath;
    }

    // `cwd: HERE` is load-bearing regardless of which branch above ran: every
    // `!source` line in either root (committed or synthesized) is a bare
    // filename with no directory component, and ACME resolves a relative
    // `!source` argument against the assembler's own working directory, not
    // against the root file's own location.
    const r = spawnSync(ACME_BIN, ["--cpu", "6510", "-f", fixture.format, "-o", tempOut, acmeSourceArg], {
      encoding: "utf8",
      timeout: 30_000,
      cwd: HERE,
    });
    if (r.status !== 0) fail(`ACME refused ${fixture.output}'s root (exit ${String(r.status)}):\n${r.stderr ?? ""}`);
    if (!existsSync(tempOut)) fail(`ACME exited 0 for ${fixture.output}'s root but wrote no output file`);

    // Written only after the assembly succeeded AND produced a file, so a
    // broken toolchain can never truncate the committed fixture.
    writeFileSync(outputPath, readFileSync(tempOut));
    process.stdout.write(`make-hazard-subject-fixtures: wrote ${fixture.output} (${readFileSync(outputPath).length} bytes)\n`);
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
