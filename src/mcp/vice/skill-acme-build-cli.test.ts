// Coverage for src/skills/acme-build/scripts/acme.mjs -- the acme-build
// skill's ACME driver (new/build/sym verbs).
//
// acme.mjs's `VERBS[cmd](rest)` dispatch sits unconditionally at module
// scope (no entry-point guard, unlike driver.mjs), so importing it would
// also run it. Every case here is therefore a subprocess: an argument
// vector of `process.execPath` + [scriptPath, verb, ...flags], never a
// shell string.
//
// This file lives in src/mcp/vice/, not next to acme.mjs, for the same
// non-recursive-discovery reason as its two siblings (see
// skill-program-recon-cli.test.ts's header).
//
// ACME availability: this file imports the ONE shared availability seam
// (ACME_BIN / acmeSkipReasonFor / assertAcmeRequiredIfEnvSet) from
// ./acme-gate.ts, exactly like disasm-roundtrip.test.ts -- never a
// second, hand-rolled binary-presence probe. The seam lives under its own
// name rather than inside the external analyser gate module, so a
// prefix-driven cleanup there cannot silently turn this file's hard FAIL
// back into a skip (SEAM-01). The always-runs
// availability-gate test below fails loudly (not silently skips) when
// VICE_REQUIRE_ACME is set but no real ACME is found, which is CI's own
// condition.
//
// The cases split by whether they need an assembler at all:
//   - usage / unknown-verb / missing-path / nonexistent-path: need NEITHER
//     the acme binary nor its library. Run everywhere, unskipped.
//   - the scaffold (`new`) verb: needs neither the binary nor the library
//     either (it only reads the committed template.a and writes it to the
//     requested path -- no spawn at all). Run everywhere, unskipped.
//   - build/sym/diagnostic/option cases: need a real `acme` binary. Skipped
//     locally with a named reason when absent; hard-FAIL under
//     VICE_REQUIRE_ACME (CI's condition, which does install ACME).
//
// The assemble case mirrors .github/workflows/ci.yml's own "Assemble the
// acme-build scaffold (library-free)" step precisely: ACME explicitly
// cleared in the child env, scaffold then build, assert a non-empty .prg
// and its first two bytes equal the documented $0801 load address. The
// check is exit status plus the produced artefact, never an empty-stderr
// assertion -- ACME emits legal warnings (e.g. "Label name not in leftmost
// column") on otherwise-successful builds.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { ACME_BIN, acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./acme-gate.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = join(HERE, "..", "..", "skills", "acme-build", "scripts", "acme.mjs");

/** Computed once, by the shared seam -- never a second hand-rolled probe. */
const SKIP_REASON: string | false = acmeSkipReasonFor("skill-acme-build-cli.test.ts");

test("ACME availability gate (mirrors disasm-roundtrip.test.ts's D-08 gate) -- always runs, never skips", () => {
  assertAcmeRequiredIfEnvSet(assert);
});

test("acme.mjs is resolved at the expected relative path", () => {
  assert.ok(existsSync(SCRIPT_PATH), `expected acme.mjs at ${SCRIPT_PATH}`);
});

// ---------------------------------------------------------------------------
// Subprocess helper. `libraryFree: true` clears ACME in the child env,
// mirroring CI's `ACME= node ...` invocation and findAcmeLib()'s own
// "falsy env var -> not tried" semantics.
// ---------------------------------------------------------------------------

function runAcme(args: string[], opts: { libraryFree?: boolean } = {}): { status: number | null; stdout: string; stderr: string } {
  const env = { ...process.env };
  if (opts.libraryFree) env.ACME = "";
  const r = spawnSync(process.execPath, [SCRIPT_PATH, ...args], { encoding: "utf8", env });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function withTempDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "acme-cli-test-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Cases needing neither the acme binary nor its library -- always run.
// ---------------------------------------------------------------------------

test("no arguments: prints usage and exits 0", () => {
  const r = runAcme([]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /usage: node .*acme\.mjs <command>/);
});

test("an unknown verb: prints usage and exits 1", () => {
  const r = runAcme(["bogus-verb"]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /usage: node .*acme\.mjs <command>/);
});

test("the build verb with a missing source path: exits 1 with the documented message", () => {
  const r = runAcme(["build"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /error: no source file given/);
});

test("the build verb with a path that does not exist: exits 1 with the documented message", () => {
  withTempDir((dir) => {
    const r = runAcme(["build", join(dir, "does-not-exist.a")]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /error: no such source file:/);
  });
});

test("the scaffold verb writes a source file at the requested path; run twice against the same path, the documented (refusal) behaviour is pinned", () => {
  withTempDir((dir) => {
    const target = join(dir, "game.a");
    const first = runAcme(["new", target], { libraryFree: true });
    assert.equal(first.status, 0);
    assert.ok(existsSync(target));
    const firstContent = readFileSync(target, "utf8");
    assert.match(firstContent, /!cpu 6510/);

    // Observed, pinned: a second scaffold against the same path refuses
    // rather than overwriting.
    const second = runAcme(["new", target], { libraryFree: true });
    assert.equal(second.status, 1);
    assert.match(second.stderr, /already exists/);
    assert.equal(readFileSync(target, "utf8"), firstContent, "a refused second scaffold must not touch the existing file");
  });
});

test("the scaffold verb writes a `; Build:` line naming the consumer's installed location, never this repository's source-tree location (16-REVIEW.md CR-01 class)", () => {
  withTempDir((dir) => {
    const target = join(dir, "game.a");
    const r = runAcme(["new", target], { libraryFree: true });
    assert.equal(r.status, 0);
    const content = readFileSync(target, "utf8");
    assert.match(
      content,
      /; Build:.*\.claude\/skills\/acme-build\/scripts\/acme\.mjs/,
      "the scaffold's Build: line must name the consumer-installed script path"
    );
    assert.doesNotMatch(
      content,
      /src\/skills\/acme-build\/scripts\/acme\.mjs/,
      "the scaffold must never name this repository's source-tree script path"
    );
  });
});

test("the scaffold verb with a missing path argument: exits 1 with the documented usage message", () => {
  const r = runAcme(["new"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /usage: new <file\.a>/);
});

// ---------------------------------------------------------------------------
// Assembler-dependent cases -- skipped locally with a named reason when no
// real ACME is present; hard-FAIL under VICE_REQUIRE_ACME via the gate test
// above.
// ---------------------------------------------------------------------------

test(
  "the scaffold verb needs no assembler library at all: with the library-path variable explicitly cleared, scaffolding still succeeds -- the same condition CI's own scaffold check uses",
  { skip: SKIP_REASON },
  () => {
    withTempDir((dir) => {
      const target = join(dir, "game.a");
      const r = runAcme(["new", target], { libraryFree: true });
      assert.equal(r.status, 0);
      assert.ok(existsSync(target));
    });
  },
);

test(
  "assembling the scaffolded source with the library path cleared produces a program file whose first two bytes are the documented load address (mirrors CI's library-free scaffold-and-assemble check)",
  { skip: SKIP_REASON },
  () => {
    withTempDir((dir) => {
      const src = join(dir, "game.a");
      const newRes = runAcme(["new", src], { libraryFree: true });
      assert.equal(newRes.status, 0);

      const buildRes = runAcme(["build", src], { libraryFree: true });
      // Check on exit status plus the produced artefact, never on stderr
      // being empty -- ACME emits legal warnings on this very scaffold
      // ("Label name not in leftmost column" is a known one), so an
      // empty-stderr assertion would be flaky by construction.
      assert.equal(buildRes.status, 0);
      const prgPath = join(dir, "game.prg");
      assert.ok(existsSync(prgPath), "expected game.prg to be produced");
      const bytes = readFileSync(prgPath);
      assert.ok(bytes.length > 2, "expected a non-empty program beyond the 2-byte load header");
      // template.a's BASIC program area starts at $0801 -- ACME's `cbm`
      // output format (acme.mjs's default -f) prepends the 2-byte
      // little-endian load address, so byte 0 = $01, byte 1 = $08.
      assert.equal(bytes[0], 0x01);
      assert.equal(bytes[1], 0x08);
    });
  },
);

test(
  "the symbol verb against the scaffolded source exits 0 and lists at least one symbol, with address-typed symbols marked the way the script documents",
  { skip: SKIP_REASON },
  () => {
    withTempDir((dir) => {
      const src = join(dir, "game.a");
      assert.equal(runAcme(["new", src], { libraryFree: true }).status, 0);

      const r = runAcme(["sym", src, "--json"], { libraryFree: true });
      assert.equal(r.status, 0);
      const symbols = JSON.parse(r.stdout) as { name: string; isAddress: boolean; value: string }[];
      assert.ok(symbols.length > 0, "expected at least one used symbol");
      const addressTyped = symbols.filter((s) => s.isAddress);
      assert.ok(addressTyped.length > 0, "expected at least one address-typed symbol (template.a declares several via !address)");
    });
  },
);

test(
  "a source file with a deliberate syntax error: exits non-zero, and the diagnostic carries a file, a line and a severity",
  { skip: SKIP_REASON },
  () => {
    withTempDir((dir) => {
      const src = join(dir, "bad.a");
      writeFileSync(
        src,
        ["* = $0801", "        lda #$00", "        this_is_not_a_valid_mnemonic #$01", "        rts", ""].join("\n"),
      );
      const r = runAcme(["build", src, "--json"], { libraryFree: true });
      assert.notEqual(r.status, 0);
      // Machine-readable mode: assert on the parsed structure, never on the
      // assembler's exact prose (that is ACME's wording, not this script's
      // contract) -- only the fields the script's own parser extracts.
      const parsed = JSON.parse(r.stdout) as {
        ok: boolean;
        errors: { file: string | null; line: number | null; severity: string }[];
      };
      assert.equal(parsed.ok, false);
      assert.ok(parsed.errors.length > 0, "expected at least one parsed error diagnostic");
      const err = parsed.errors[0]!;
      assert.ok(err.file, "expected the diagnostic to carry a file");
      assert.ok(typeof err.line === "number" && err.line > 0, "expected the diagnostic to carry a line number");
      assert.equal(err.severity, "error");
    });
  },
);

test(
  "the output-path (-o) and output-directory (--out-dir) options place the artefact where they say; the report-suppression (--no-report) option omits the report the default run writes",
  { skip: SKIP_REASON },
  () => {
    withTempDir((dir) => {
      const src = join(dir, "game.a");
      assert.equal(runAcme(["new", src], { libraryFree: true }).status, 0);

      // -o: explicit output path.
      const customOut = join(dir, "custom", "renamed.prg");
      const oRes = runAcme(["build", src, "-o", customOut], { libraryFree: true });
      assert.equal(oRes.status, 0);
      assert.ok(existsSync(customOut), "-o must place the .prg at the exact requested path");
      assert.ok(existsSync(join(dir, "custom", "renamed.rep")), "the default run writes a .rep report alongside the .prg");

      // --out-dir: same basename, different directory.
      const outDir = join(dir, "outdir");
      const dirRes = runAcme(["build", src, "--out-dir", outDir], { libraryFree: true });
      assert.equal(dirRes.status, 0);
      assert.ok(existsSync(join(outDir, "game.prg")), "--out-dir must place <source-basename>.prg inside the requested directory");

      // --no-report: the .rep file is omitted, everything else still writes.
      const noReportDir = join(dir, "noreport");
      const noReportRes = runAcme(["build", src, "--out-dir", noReportDir, "--no-report"], { libraryFree: true });
      assert.equal(noReportRes.status, 0);
      assert.ok(existsSync(join(noReportDir, "game.prg")));
      assert.ok(!existsSync(join(noReportDir, "game.rep")), "--no-report must omit the .rep the default run writes");
    });
  },
);

// Sanity: ACME_BIN is imported from the shared seam (never redeclared), so a
// change to the shared binary-name convention is visible here too.
test("ACME_BIN is the shared seam's binary name, not a second hand-rolled default", () => {
  assert.equal(ACME_BIN, process.env.ACME_BIN ?? "acme");
});
