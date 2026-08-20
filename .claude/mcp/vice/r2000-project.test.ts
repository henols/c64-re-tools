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
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  R2000_SYSTEM_C64,
  synthesizeProject,
  parsePrg,
  flatImageOrigin,
  decodeRawData,
} from "./r2000-project.ts";

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
// Integration half -- gated on a real regenerator2000 binary.
// ---------------------------------------------------------------------------

const R2000_BIN = process.env.R2000_BIN ?? "regenerator2000";

function probeR2000(): boolean {
  const r = spawnSync(R2000_BIN, ["--version"], { encoding: "utf8", timeout: 10_000 });
  if (r.error) return false;
  const banner = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  return /regenerator2000/i.test(banner);
}

const R2000_AVAILABLE = probeR2000();

/** Computed exactly once. Every regenerator2000-dependent test in this file
 * passes this through node:test's own `{ skip }` option -- never a
 * hand-rolled early return, which would report a false PASS rather than a
 * SKIP (disasm-roundtrip.test.ts's own D-08 pattern, renamed here per
 * D-11). */
const SKIP_REASON: string | false = R2000_AVAILABLE
  ? false
  : `r2000-project.test.ts's regenerator2000-dependent suites are skipped -- no real ` +
    `regenerator2000 was found at R2000_BIN="${R2000_BIN}". Set R2000_BIN to an absolute ` +
    `path to a real "regenerator2000" binary, or install one (cargo install regenerator2000 -- ` +
    `verified against 0.9.20 during Phase 9/10 planning). D-11 keeps CI from setting ` +
    `VICE_REQUIRE_R2000, so this is an expected SKIP there -- see the "regenerator2000 ` +
    `availability gate (D-11)" test below for the hard-fail path.`;

test("regenerator2000 availability gate (D-11)", () => {
  if (process.env.VICE_REQUIRE_R2000) {
    assert.ok(
      R2000_AVAILABLE,
      `VICE_REQUIRE_R2000 is set but no real regenerator2000 was found at R2000_BIN="${R2000_BIN}" -- ` +
        `a maintainer who sets this variable expects a hard FAIL, never a SKIP, when the binary is ` +
        `actually missing.`,
    );
  }
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
