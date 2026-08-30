#!/usr/bin/env node
// make-export-asm-fixtures.mjs -- the reproducible generator for the
// export-asm round-trip fixtures.
//
// WHY A GENERATOR RATHER THAN A HAND-COMMITTED BLOB: `smc.prg` is only
// evidence for anything while it is EXACTLY what `smc.a` assembles to. Its
// defining property -- that an `inc` writes to the immediate-operand byte of
// an earlier `lda #` -- lives in the source, and a hand-committed blob would
// let the two drift apart silently. `anno-export-asm.test.ts` carries a
// regenerator-agreement test that re-assembles `smc.a` and byte-compares it
// against the committed `smc.prg`, so a drift is a red rather than a quiet
// degradation of every test that reads the fixture.
//
// DETERMINISM IS PART OF THE CONTRACT: running this script twice must leave
// `git status --porcelain src/mcp/vice/fixtures/export-asm` empty. There is no
// timestamp, no random value and no host-dependent path in the emitted file --
// ACME's `-f cbm` output is a pure function of the source.
//
// IT REFUSES RATHER THAN WRITING A PARTIAL FIXTURE. If ACME is missing, or
// exits non-zero, or writes no output file, this script prints the reason and
// exits non-zero WITHOUT touching `smc.prg`. A generator that half-wrote its
// output on a broken toolchain would replace a good fixture with a bad one and
// every test over it would then be testing the failure.
//
// WHY IT DOES NOT IMPORT `acme-gate.ts`: that module is TEST-ONLY by its own
// header -- it must never appear in `package.json`'s `files[]` and must never
// be imported by anything that is not a `*.test.ts`. This generator is neither
// a test nor a shipped module, so it reads `ACME_BIN` from the environment by
// the same exact name the gate does (a rename on either side is what the
// gate's own WHAT-NOT-TO-DO paragraph forbids) and does its own probe.
//
// THE FILENAME DELIBERATELY CARRIES NO TEST SUFFIX, for the reason
// `fixtures/coverage/make-coverage-fixtures.mjs` states: a `*.test.mjs` here
// would register `fixtures/export-asm` as a suite directory that no CI step
// runs.
//
// Regenerate with:
//   cd src/mcp/vice && node fixtures/export-asm/make-export-asm-fixtures.mjs

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Read by the exact name `acme-gate.ts` and `.github/workflows/ci.yml` bind.
 * Never rename one side only. */
const ACME_BIN = process.env.ACME_BIN ?? "acme";

/** Every fixture this script owns: its ACME source, its emitted image, and the
 * ACME output format that image is captured in. */
const FIXTURES = [{ source: "smc.a", output: "smc.prg", format: "cbm" }];

function fail(reason) {
  process.stderr.write(`make-export-asm-fixtures: ${reason}\n`);
  process.stderr.write("make-export-asm-fixtures: REFUSING to write a partial fixture -- nothing was changed.\n");
  process.exit(1);
}

// Probe first, and refuse before writing anything. The probe is the argv-array
// form, never a shell-interpreted command string: `ACME_BIN` is externally
// supplied and reaches a process launch here.
const probe = spawnSync(ACME_BIN, ["--version"], { encoding: "utf8", timeout: 30_000 });
if (probe.error || probe.status !== 0) {
  fail(`no usable ACME at ${JSON.stringify(ACME_BIN)} (set ACME_BIN, or put \`acme\` on PATH): ${probe.error ? String(probe.error.message) : `exit ${String(probe.status)}`}`);
}

const workDir = mkdtempSync(join(tmpdir(), "make-export-asm-fixtures-"));
try {
  for (const fixture of FIXTURES) {
    const sourcePath = join(HERE, fixture.source);
    const outputPath = join(HERE, fixture.output);
    const tempOut = join(workDir, fixture.output);

    if (!existsSync(sourcePath)) fail(`the ACME source ${JSON.stringify(sourcePath)} does not exist`);

    const r = spawnSync(ACME_BIN, ["--cpu", "6510", "-f", fixture.format, "-o", tempOut, sourcePath], {
      encoding: "utf8",
      timeout: 30_000,
    });
    if (r.status !== 0) fail(`ACME refused ${fixture.source} (exit ${String(r.status)}):\n${r.stderr ?? ""}`);
    if (!existsSync(tempOut)) fail(`ACME exited 0 for ${fixture.source} but wrote no output file`);

    // Written only after the assembly succeeded AND produced a file, so a
    // broken toolchain can never truncate the committed fixture.
    writeFileSync(outputPath, readFileSync(tempOut));
    process.stdout.write(`make-export-asm-fixtures: wrote ${fixture.output} (${readFileSync(outputPath).length} bytes)\n`);
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
