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
// is no timestamp, no random value and no host-dependent path in the emitted
// file -- ACME's `-f cbm` output is a pure function of the source tree.
//
// IT REFUSES RATHER THAN WRITING A PARTIAL FIXTURE. If the assembler is
// missing, or exits non-zero, or writes no output file, this script prints
// the reason and exits non-zero WITHOUT touching `hazard-subject.prg`. A
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
// process, so the root source's bare-filename `!source "hazard-subject-smc.a"`
// resolves without a directory component anywhere in the source text.
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

/** The one root fixture this script owns. Later parts are pulled in by the
 * root's own `!source` lines, never listed here as separate entries -- there
 * is exactly one assembled image for the whole subject tree. */
const FIXTURES = [{ source: "hazard-subject.a", output: "hazard-subject.prg", format: "cbm" }];

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
    const sourcePath = join(HERE, fixture.source);
    const outputPath = join(HERE, fixture.output);
    const tempOut = join(workDir, fixture.output);

    if (!existsSync(sourcePath)) fail(`the ACME source ${JSON.stringify(sourcePath)} does not exist`);

    // `cwd: HERE` is load-bearing: the root source's `!source` lines are
    // bare filenames with no directory component, and ACME resolves a
    // relative `!source` argument against the assembler's own working
    // directory.
    const r = spawnSync(ACME_BIN, ["--cpu", "6510", "-f", fixture.format, "-o", tempOut, fixture.source], {
      encoding: "utf8",
      timeout: 30_000,
      cwd: HERE,
    });
    if (r.status !== 0) fail(`ACME refused ${fixture.source} (exit ${String(r.status)}):\n${r.stderr ?? ""}`);
    if (!existsSync(tempOut)) fail(`ACME exited 0 for ${fixture.source} but wrote no output file`);

    // Written only after the assembly succeeded AND produced a file, so a
    // broken toolchain can never truncate the committed fixture.
    writeFileSync(outputPath, readFileSync(tempOut));
    process.stdout.write(`make-hazard-subject-fixtures: wrote ${fixture.output} (${readFileSync(outputPath).length} bytes)\n`);
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
