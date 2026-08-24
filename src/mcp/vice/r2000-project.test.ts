// r2000-project.test.ts
//
// Two clearly separated halves, mirroring disasm-roundtrip.test.ts's shape
// with every ACME_*/VICE_REQUIRE_ACME symbol renamed to its R2000_*/
// VICE_REQUIRE_R2000 counterpart (this file does not import from or modify
// that file -- Phase 4's protected stock-disassembler round-trip test is
// untouched).
//
// Unit half (always runs, no external binary): pins the exact JSON shape
// synthesizeProject() writes, so a future edit that silently adds a field,
// drops a forced setting, or breaks the gzip+base64 round trip fails here
// immediately (D-04's minimality claim and D-05's forced-settings claim are
// both assertions, not assumptions).
//
// Integration half (gated): synthesises a real project from a small in-test
// `.prg` containing an illegal opcode (`lax` zeropage, $A7), writes it to a
// node:fs temp dir, and runs a REAL regenerator2000 --headless --export_asm
// against it -- this IS D-04's self-check that the minimal file is
// compatible: a real binary loaded and exported from it, not a version
// table.
//
// ---------------------------------------------------------------------------
// GATE (D-11, mirrors disasm-roundtrip.test.ts's D-08 gate exactly)
// ---------------------------------------------------------------------------
// Exactly one test always runs, never skipped: "regenerator2000 availability
// gate (D-11)". With VICE_REQUIRE_R2000 set, a missing regenerator2000 FAILS
// that test. Locally, with no regenerator2000 installed, every other
// integration test in this file skips with a named reason via node:test's
// own `{ skip }` option -- SKIP_REASON is computed ONCE at module scope,
// never a hand-rolled `if (!available) return` (which would report a false
// PASS rather than a SKIP).
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO
// ---------------------------------------------------------------------------
//   - Never interpolate any test input into a shell command string. The
//     gated test below spawns regenerator2000 with an argv array
//     (T-10-02), and every temp path comes from node:fs's own
//     mkdtempSync -- never a hand-built path, never shell:true.
//   - Never add this file to test-gate.mjs's MANUAL_ONLY_TESTS -- it must
//     terminate cleanly with or without regenerator2000 installed (D-11
//     explicitly keeps it out of CI's manual-only set).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  R2000_SYSTEM_C64,
  synthesizeProject,
  parsePrg,
  flatImageOrigin,
  decodeRawData,
  ensureProjectSettings,
  R2000ProjectSettingsError,
} from "./r2000-project.ts";
import { R2000_BIN, skipReasonFor, assertR2000RequiredIfEnvSet } from "./r2000-test-gate.ts";

// ---------------------------------------------------------------------------
// Unit half -- always runs, no external binary involved.
// ---------------------------------------------------------------------------

test("synthesizeProject: exact top-level key set (D-04 minimality, pinned)", () => {
  const out = JSON.parse(synthesizeProject(Buffer.from([1, 2, 3]), { origin: 0x0801 }));
  assert.deepEqual(Object.keys(out).sort(), ["blocks", "origin", "raw_data_base64", "settings"]);
});

test("synthesizeProject: exact settings key set, forced values (D-05, pinned)", () => {
  const out = JSON.parse(synthesizeProject(Buffer.from([1, 2, 3]), { origin: 0x0801 }));
  assert.deepEqual(Object.keys(out.settings).sort(), ["system", "use_illegal_opcodes"]);
  assert.equal(out.settings.use_illegal_opcodes, true);
  assert.equal(out.settings.system, R2000_SYSTEM_C64);
  assert.equal(R2000_SYSTEM_C64, "Commodore 64");
});

test("synthesizeProject: explicit system is written verbatim, never inferred", () => {
  const out = JSON.parse(
    synthesizeProject(Buffer.from([1, 2, 3]), { origin: 0x0801, system: "Commodore 128" }),
  );
  assert.equal(out.settings.system, "Commodore 128");
});

test("synthesizeProject: blocks is an empty array, origin is a plain number", () => {
  const out = JSON.parse(synthesizeProject(Buffer.from([1, 2, 3]), { origin: 0x1000 }));
  assert.deepEqual(out.blocks, []);
  assert.equal(typeof out.origin, "number");
  assert.equal(out.origin, 0x1000);
});

test("synthesizeProject: raw_data_base64 round-trips through gzip+base64 (D-01's own live finding)", () => {
  const payload = Buffer.from([0xde, 0xad, 0xbe, 0xef, 0x00, 0x01, 0x02, 0x03]);
  const out = JSON.parse(synthesizeProject(payload, { origin: 0x0801 }));
  const decoded = decodeRawData(out.raw_data_base64);
  assert.deepEqual(Buffer.from(decoded), payload);
});

test("synthesizeProject: origin out of range throws naming the value and valid range", () => {
  assert.throws(() => synthesizeProject(Buffer.from([1]), { origin: -1 }), /out of range/);
  assert.throws(() => synthesizeProject(Buffer.from([1]), { origin: 0x10000 }), /out of range/);
  assert.throws(() => synthesizeProject(Buffer.from([1]), { origin: 1.5 }), /out of range/);
});

test("synthesizeProject: empty payload throws", () => {
  assert.throws(() => synthesizeProject(Buffer.alloc(0), { origin: 0x0801 }), /empty/);
});

test("parsePrg: extracts a little-endian load address and the remaining body", () => {
  const { origin, body } = parsePrg(Buffer.from([0x01, 0x08, 0xa9, 0x00, 0x60]));
  assert.equal(origin, 0x0801);
  assert.deepEqual(Buffer.from(body), Buffer.from([0xa9, 0x00, 0x60]));
});

test("parsePrg: a 2-byte or shorter input throws", () => {
  assert.throws(() => parsePrg(Buffer.from([0x01, 0x08])), /3 bytes/);
  assert.throws(() => parsePrg(Buffer.from([0x01])), /3 bytes/);
  assert.throws(() => parsePrg(Buffer.alloc(0)), /3 bytes/);
});

test("flatImageOrigin: returns 0 for exactly 65536 bytes", () => {
  assert.equal(flatImageOrigin(Buffer.alloc(65536)), 0);
});

test("flatImageOrigin: throws otherwise, naming the actual length", () => {
  assert.throws(() => flatImageOrigin(Buffer.alloc(65535)), /65535/);
  assert.throws(() => flatImageOrigin(Buffer.alloc(0)), /0/);
});

// ---------------------------------------------------------------------------
// ensureProjectSettings() -- unit half, always runs, no external binary.
//
// Mirrors r2000-spawn-seam.test.ts's planted-violation shape: reintroduce
// the known-bad state, watch the guard catch it, restore. Every case in
// r2000-project.ts's Task 1 <behavior> list gets its own named test below,
// plus a committed non-vacuity pair proving the forcing assertion actually
// distinguishes the real implementation from a "forcing step removed"
// mutant, rather than passing regardless of whether the force ever ran.
// ---------------------------------------------------------------------------

function withTempDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "r2000-project-test-unit-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** A full, realistic project fixture -- every top-level key `synthesizeProject()`
 * writes, plus a couple of forward-compatible keys this module never touches
 * (`labels`, `user_side_comments`), so the "every other key survives" test has
 * something non-trivial to prove unchanged. */
function makeFixture(overrides: { useIllegalOpcodes?: boolean; system?: string | undefined; noSettings?: boolean }) {
  const fixture: Record<string, unknown> = {
    origin: 0x0801,
    raw_data_base64: "deadbeef==",
    blocks: [{ kind: "code", start: 0x0801, end: 0x0810 }],
    labels: { "0x0801": "start" },
    user_side_comments: { "0x0801": "entry point" },
  };
  if (!overrides.noSettings) {
    fixture.settings = {
      use_illegal_opcodes: overrides.useIllegalOpcodes ?? false,
      ...(overrides.system === undefined ? {} : { system: overrides.system }),
    };
  }
  return fixture;
}

test("ensureProjectSettings: use_illegal_opcodes false -- forced to true, re-read from disk", () => {
  withTempDir((dir) => {
    const path = join(dir, "p.regen2000proj");
    writeFileSync(path, JSON.stringify(makeFixture({ useIllegalOpcodes: false, system: R2000_SYSTEM_C64 })));

    const result = ensureProjectSettings(path);
    assert.equal(result.changed, true);

    const after = JSON.parse(readFileSync(path, "utf8"));
    assert.equal(after.settings.use_illegal_opcodes, true);
  });
});

test("ensureProjectSettings: use_illegal_opcodes already true -- idempotent no-op, file unchanged", () => {
  withTempDir((dir) => {
    const path = join(dir, "p.regen2000proj");
    const before = makeFixture({ useIllegalOpcodes: true, system: R2000_SYSTEM_C64 });
    writeFileSync(path, JSON.stringify(before));
    const beforeHash = sha256(readFileSync(path));

    const result = ensureProjectSettings(path);
    assert.equal(result.changed, false);

    const afterHash = sha256(readFileSync(path));
    assert.equal(afterHash, beforeHash, "an already-forced project must not be rewritten at all");
    assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), before);
  });
});

test("ensureProjectSettings: no settings key at all -- both use_illegal_opcodes and system get set", () => {
  withTempDir((dir) => {
    const path = join(dir, "p.regen2000proj");
    writeFileSync(path, JSON.stringify(makeFixture({ noSettings: true })));

    const result = ensureProjectSettings(path);
    assert.equal(result.changed, true);

    const after = JSON.parse(readFileSync(path, "utf8"));
    assert.equal(after.settings.use_illegal_opcodes, true);
    assert.equal(after.settings.system, R2000_SYSTEM_C64);
  });
});

test("ensureProjectSettings: settings.system mismatch throws naming both values, file byte-identical after", () => {
  withTempDir((dir) => {
    const path = join(dir, "p.regen2000proj");
    writeFileSync(path, JSON.stringify(makeFixture({ useIllegalOpcodes: false, system: "Commodore 128" })));
    const beforeHash = sha256(readFileSync(path));

    assert.throws(
      () => ensureProjectSettings(path),
      (err: unknown) => {
        if (!(err instanceof R2000ProjectSettingsError)) return false;
        assert.match(err.message, /Commodore 128/);
        assert.match(err.message, new RegExp(R2000_SYSTEM_C64));
        assert.equal(err.projectPath, path);
        return true;
      },
    );

    const afterHash = sha256(readFileSync(path));
    assert.equal(afterHash, beforeHash, "a refusal must leave the file byte-identical");
  });
});

test("ensureProjectSettings: missing path throws R2000ProjectSettingsError naming the path", () => {
  withTempDir((dir) => {
    const path = join(dir, "does-not-exist.regen2000proj");
    assert.throws(
      () => ensureProjectSettings(path),
      (err: unknown) => {
        if (!(err instanceof R2000ProjectSettingsError)) return false;
        assert.match(err.message, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        assert.equal(err.projectPath, path);
        return true;
      },
    );
  });
});

test("ensureProjectSettings: malformed JSON throws naming the path and parse failure, file byte-identical after", () => {
  withTempDir((dir) => {
    const path = join(dir, "p.regen2000proj");
    writeFileSync(path, "{ this is not valid json ");
    const beforeHash = sha256(readFileSync(path));

    assert.throws(
      () => ensureProjectSettings(path),
      (err: unknown) => {
        if (!(err instanceof R2000ProjectSettingsError)) return false;
        assert.match(err.message, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        assert.equal(err.projectPath, path);
        return true;
      },
    );

    const afterHash = sha256(readFileSync(path));
    assert.equal(afterHash, beforeHash, "a parse-refusal must leave the file byte-identical");
  });
});

test("ensureProjectSettings: a top-level JSON array throws rather than writing settings onto it", () => {
  withTempDir((dir) => {
    const path = join(dir, "p.regen2000proj");
    writeFileSync(path, JSON.stringify([1, 2, 3]));
    assert.throws(() => ensureProjectSettings(path), R2000ProjectSettingsError);
  });
});

test("ensureProjectSettings: a top-level JSON primitive throws rather than writing settings onto it", () => {
  withTempDir((dir) => {
    const path = join(dir, "p.regen2000proj");
    writeFileSync(path, JSON.stringify(42));
    assert.throws(() => ensureProjectSettings(path), R2000ProjectSettingsError);
  });
});

test("ensureProjectSettings: every other key survives the rewrite unchanged (deep equality)", () => {
  withTempDir((dir) => {
    const path = join(dir, "p.regen2000proj");
    const before = makeFixture({ useIllegalOpcodes: false, system: R2000_SYSTEM_C64 }) as {
      settings: { use_illegal_opcodes: boolean; system: string };
      [key: string]: unknown;
    };
    writeFileSync(path, JSON.stringify(before));

    const result = ensureProjectSettings(path);
    assert.equal(result.changed, true);

    const after = JSON.parse(readFileSync(path, "utf8"));
    const expectedAfter = structuredClone(before);
    expectedAfter.settings.use_illegal_opcodes = true;
    assert.deepEqual(after, expectedAfter);
  });
});

// -- Non-vacuity pair: the forcing assertion must distinguish the real
// implementation from a "forcing step removed" mutant, not pass either way.

/**
 * A test-only mutant of `ensureProjectSettings()`: performs the IDENTICAL
 * read-parse-rewrite pass, including the system-mismatch refusal, but
 * deliberately omits the `use_illegal_opcodes: true` force -- it writes back
 * whatever `use_illegal_opcodes` it found (defaulting to `false` if absent).
 * This exists SOLELY as the non-vacuity control for the sibling test's
 * forcing assertion below and must never be exported or called from
 * production code.
 */
function ensureProjectSettingsForcingRemoved(projectPath: string, opts: { system?: string } = {}): { changed: boolean } {
  const expectedSystem = opts.system ?? R2000_SYSTEM_C64;
  const parsed = JSON.parse(readFileSync(projectPath, "utf8")) as Record<string, unknown>;
  const existingSettings =
    typeof parsed.settings === "object" && parsed.settings !== null
      ? (parsed.settings as Record<string, unknown>)
      : undefined;
  const foundSystem = existingSettings?.system;
  if (foundSystem !== undefined && foundSystem !== expectedSystem) {
    throw new R2000ProjectSettingsError(`mutant: settings.system mismatch`, { projectPath });
  }
  parsed.settings = {
    ...(existingSettings ?? {}),
    // Deliberately NOT forced -- this is the mutant under test.
    use_illegal_opcodes: existingSettings?.use_illegal_opcodes === true,
    system: expectedSystem,
  };
  writeFileSync(projectPath, JSON.stringify(parsed));
  return { changed: true };
}

test("non-vacuity: the REAL ensureProjectSettings() leaves use_illegal_opcodes true", () => {
  withTempDir((dir) => {
    const path = join(dir, "p.regen2000proj");
    writeFileSync(path, JSON.stringify(makeFixture({ useIllegalOpcodes: false, system: R2000_SYSTEM_C64 })));

    ensureProjectSettings(path);

    const after = JSON.parse(readFileSync(path, "utf8"));
    assert.equal(after.settings.use_illegal_opcodes, true, "real implementation must force the setting to true");
  });
});

test("non-vacuity: the forcing-removed MUTANT leaves use_illegal_opcodes false, proving the assertion above is non-vacuous", () => {
  withTempDir((dir) => {
    const path = join(dir, "p.regen2000proj");
    writeFileSync(path, JSON.stringify(makeFixture({ useIllegalOpcodes: false, system: R2000_SYSTEM_C64 })));

    ensureProjectSettingsForcingRemoved(path);

    const after = JSON.parse(readFileSync(path, "utf8"));
    assert.equal(
      after.settings.use_illegal_opcodes,
      false,
      "mutant control must NOT force the setting -- if this fails, the mutant no longer differs from the real " +
        "implementation and the pair no longer proves anything",
    );
  });
});

// ---------------------------------------------------------------------------
// Integration half -- gated on a real regenerator2000 binary.
// ---------------------------------------------------------------------------

// Uses the shared r2000-test-gate.ts seam (R2000_BIN/skipReasonFor/
// assertR2000RequiredIfEnvSet, imported above) instead of a local copy --
// see 2026-08-21-migrate-hand-copied-acme-gates-to-r2000-test-gate.md.

/** Computed exactly once, by the shared seam. Every regenerator2000-dependent
 * test in this file passes this through node:test's own `{ skip }` option --
 * never a hand-rolled early return, which would report a false PASS rather
 * than a SKIP. */
const SKIP_REASON: string | false = skipReasonFor("r2000-project.test.ts");

test("regenerator2000 availability gate (D-11)", () => {
  assertR2000RequiredIfEnvSet(assert);
});

let r2000WorkDir: string | undefined;

after(() => {
  if (r2000WorkDir) rmSync(r2000WorkDir, { recursive: true, force: true });
});

test(
  "gated: a real regenerator2000 loads and exports ACME source from a Node-synthesised project (D-04 self-check)",
  { skip: SKIP_REASON },
  () => {
    if (!r2000WorkDir) r2000WorkDir = mkdtempSync(join(tmpdir(), "r2000-project-test-"));

    // A tiny .prg body containing at least one illegal opcode (`lax`
    // zeropage, $A7 $02) so the forced use_illegal_opcodes setting is
    // actually exercised, followed by `rts` ($60).
    const prgBody = Buffer.from([0xa7, 0x02, 0x60]);
    const origin = 0x0801;

    const projectJson = synthesizeProject(prgBody, { origin });
    const projectPath = join(r2000WorkDir, "synth.regen2000proj");
    const exportPath = join(r2000WorkDir, "synth.a");
    writeFileSync(projectPath, projectJson);

    const result = spawnSync(
      R2000_BIN,
      ["--headless", "--export_asm", exportPath, "--assembler", "acme", projectPath],
      { encoding: "utf8", timeout: 30_000 },
    );

    assert.equal(
      result.status,
      0,
      `regenerator2000 exited ${result.status} -- stdout: ${result.stdout} stderr: ${result.stderr}`,
    );
    assert.ok(existsSync(exportPath), `expected exported .a file at ${exportPath}`);

    const exported = readFileSync(exportPath, "utf8");
    assert.ok(exported.length > 0, "exported .a file is empty");
    assert.match(
      exported,
      /\blax\b/i,
      "exported ACME source should contain the illegal-opcode mnemonic 'lax', proving " +
        "use_illegal_opcodes: true was actually honoured by regenerator2000",
    );
  },
);
