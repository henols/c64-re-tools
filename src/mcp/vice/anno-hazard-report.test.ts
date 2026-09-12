#!/usr/bin/env node
// anno-hazard-report.test.ts
//
// HERMETIC except for reading three committed fixture images off disk
// (`fixtures/export-asm/smc.prg`, `fixtures/dxa/tracer.prg`, this module's
// own source text) -- no store, no VICE, no network.
//
// Behaviors covered, grouped by the stable name prefixes the plan declares:
//
//   hazard class-2:  the self-modifying-code detector -- opcode-byte hits,
//                     operand-byte hits, read-modify-write instructions,
//                     non-findings (hardware register / zp scratch / outside
//                     the image), the committed negative control, and the
//                     indirect-indexed miss named as a limit
//   hazard shape:    no boolean field but `truncated`, no banned field name,
//                     de-duplication and survival on the (class, anchor,
//                     mechanism) triple, empty-input safety, no-signal never
//                     read as clean
//   hazard order:    determinism and ascending-by-anchor ordering
//   hazard read-only: a structural source-text assertion

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildHazardReport,
  HAZARD_CLASSES,
  HAZARD_DETECTION_STRENGTHS,
  HAZARD_LIMITS,
  type HazardReport,
} from "./anno-hazard-report.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = join(HERE, "anno-hazard-report.ts");

const SMC_PRG_PATH = join(HERE, "fixtures", "export-asm", "smc.prg");
const TRACER_PRG_PATH = join(HERE, "fixtures", "dxa", "tracer.prg");

/** A committed `.prg`'s bytes and load address, split the same way every
 * caller in this tree splits a loaded image: the first two bytes are the
 * little-endian load address, and are never passed to `decode()` as part of
 * the payload. */
function loadPrg(path: string): { bytes: Uint8Array; origin: number } {
  const raw = readFileSync(path);
  const origin = raw[0]! | (raw[1]! << 8);
  return { bytes: new Uint8Array(raw.subarray(2)), origin };
}

// ---------------------------------------------------------------------------
// hazard class-2: opcode-byte hit (hand-built)
// ---------------------------------------------------------------------------

test("hazard class-2: a store landing on another instruction's opcode byte yields one finding with mechanism store-target-in-instruction-opcode-byte", () => {
  // $0800 nop            <- host, 1 byte, its own opcode byte is $0800
  // $0801 lda #$60
  // $0803 sta $0800      <- target ($0800) is the host's opcode byte
  const bytes = new Uint8Array([0xea, 0xa9, 0x60, 0x8d, 0x00, 0x08]);
  const report = buildHazardReport({ bytes, origin: 0x0800 });
  assert.equal(report.findings.length, 1);
  const [finding] = report.findings;
  assert.equal(finding!.hazardClass, "self-modifying-code");
  assert.equal(finding!.mechanism, "store-target-in-instruction-opcode-byte");
  assert.equal(finding!.anchorAddress, 0x0800);
  assert.equal(finding!.blockedAddress, 0x0800);
  assert.equal(finding!.strength, "static-shape-matched");
  assert.equal(finding!.corroboration, "none");
});

// ---------------------------------------------------------------------------
// hazard class-2: operand-byte hit, both hand-built and the committed smc.prg
// ---------------------------------------------------------------------------

test("hazard class-2: a read-modify-write instruction landing on another instruction's operand byte yields mechanism store-target-in-instruction-operand-byte", () => {
  // $0800 lda #$00       <- host, 2 bytes; $0801 is its operand byte
  // $0802 dec $0801      <- RMW, target ($0801) is the host's operand byte
  const bytes = new Uint8Array([0xa9, 0x00, 0xce, 0x01, 0x08]);
  const report = buildHazardReport({ bytes, origin: 0x0800 });
  assert.equal(report.findings.length, 1);
  const [finding] = report.findings;
  assert.equal(finding!.mechanism, "store-target-in-instruction-operand-byte");
  assert.equal(finding!.anchorAddress, 0x0800);
  assert.equal(finding!.blockedAddress, 0x0801);
});

test("hazard class-2: the committed smc.prg bytes produce exactly one finding, mechanism store-target-in-instruction-operand-byte", () => {
  const { bytes, origin } = loadPrg(SMC_PRG_PATH);
  const report = buildHazardReport({ bytes, origin });
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0]!.hazardClass, "self-modifying-code");
  assert.equal(report.findings[0]!.mechanism, "store-target-in-instruction-operand-byte");
});

// ---------------------------------------------------------------------------
// hazard class-2: read-modify-write instructions produce the same two
// mechanisms by target-byte position (opcode case, via inc)
// ---------------------------------------------------------------------------

test("hazard class-2: an increment landing on another instruction's opcode byte is mechanism store-target-in-instruction-opcode-byte", () => {
  // $0800 nop            <- host, opcode byte at $0800
  // $0801 inc $0800      <- RMW absolute, target is the host's opcode byte
  const bytes = new Uint8Array([0xea, 0xee, 0x00, 0x08]);
  const report = buildHazardReport({ bytes, origin: 0x0800 });
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0]!.mechanism, "store-target-in-instruction-opcode-byte");
});

// ---------------------------------------------------------------------------
// hazard class-2: non-findings
// ---------------------------------------------------------------------------

test("hazard class-2: a store to a hardware register, a zero-page scratch address, or an address outside every decoded instruction yields no finding", () => {
  // sta $d020 -- hardware register, far outside the tiny decoded image
  const hardware = buildHazardReport({ bytes: new Uint8Array([0x8d, 0x20, 0xd0]), origin: 0x0800 });
  assert.deepEqual(hardware.findings, []);

  // sta $02 -- zero-page scratch, no instruction lives at address 2
  const zpScratch = buildHazardReport({ bytes: new Uint8Array([0x85, 0x02]), origin: 0x0800 });
  assert.deepEqual(zpScratch.findings, []);

  // sta $9000 -- absolute, far past the end of a 3-byte image
  const outside = buildHazardReport({ bytes: new Uint8Array([0x8d, 0x00, 0x90]), origin: 0x0800 });
  assert.deepEqual(outside.findings, []);
});

test("hazard class-2: the committed tracer.prg bytes yield zero class-2 findings (negative control)", () => {
  const { bytes, origin } = loadPrg(TRACER_PRG_PATH);
  const report = buildHazardReport({ bytes, origin });
  assert.deepEqual(
    report.findings.filter((f) => f.hazardClass === "self-modifying-code"),
    [],
  );
});

test("hazard class-2: an indirect-indexed store yields no finding, and the report's limits name exactly that miss", () => {
  // lda #$00 ; sta ($01),y -- indirect_y. The zero-page pointer address (1)
  // is not itself a literal target this detector may test.
  const bytes = new Uint8Array([0xa9, 0x00, 0x91, 0x01]);
  const report = buildHazardReport({ bytes, origin: 0x0800 });
  assert.deepEqual(
    report.findings.filter((f) => f.hazardClass === "self-modifying-code"),
    [],
  );
  const indirectLimit = HAZARD_LIMITS.find(
    (l) => l.hazardClass === "self-modifying-code" && /indirect/i.test(l.limit),
  );
  assert.ok(indirectLimit, "HAZARD_LIMITS must name the indirect-indexed self-modification miss");
});

// ---------------------------------------------------------------------------
// hazard shape
// ---------------------------------------------------------------------------

/** Recursively walks a value, collecting every (key, value) pair found at
 * any depth -- mirrors evid-reconcile.test.ts's own banned-key walk. */
function collectEntries(value: unknown, out: Array<[string, unknown]> = []): Array<[string, unknown]> {
  if (Array.isArray(value)) {
    for (const item of value) collectEntries(item, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.push([k, v]);
      collectEntries(v, out);
    }
  }
  return out;
}

test("hazard shape: no field is boolean except truncated, and no field name reads as a clean/dirty/safe/ok verdict", () => {
  const { bytes, origin } = loadPrg(SMC_PRG_PATH);
  const report: HazardReport = buildHazardReport({
    bytes,
    origin,
    ranges: [{ start_address: origin, end_address: origin + bytes.length - 1, type: "code" }],
  });
  const entries = collectEntries(report as unknown);
  assert.ok(entries.length > 0, "the walk must actually visit nested rows");
  for (const [key, val] of entries) {
    assert.ok(!/clean|dirty|safe|ok/i.test(key), `field name "${key}" reads as a safety verdict`);
    if (typeof val === "boolean") {
      assert.equal(key, "truncated", `only "truncated" may be a boolean field (found on "${key}")`);
    }
  }
});

test("hazard shape: every finding carries a non-empty mechanism and a strength drawn from the declared token list", () => {
  const { bytes, origin } = loadPrg(SMC_PRG_PATH);
  const report = buildHazardReport({ bytes, origin });
  assert.ok(report.findings.length > 0);
  for (const finding of report.findings) {
    assert.ok(finding.mechanism.length > 0);
    assert.ok((HAZARD_DETECTION_STRENGTHS as readonly string[]).includes(finding.strength));
  }
});

test("hazard shape: two findings at the same anchor address with different mechanisms both survive; identical triples appear once", () => {
  // Host: sta $9999 at $0800 (3 bytes: opcode $0800, operand bytes $0801-$0802)
  // Writer A: lda #$60 ; sta $0800   -> hits the host's OPCODE byte
  // Writer B: lda #$05 ; sta $0801   -> hits the host's OPERAND byte
  // Writer C: lda #$61 ; sta $0800   -> a SECOND opcode-byte hit, same triple as A
  const bytes = new Uint8Array([
    0x8d, 0x99, 0x99, // $0800 sta $9999 (host)
    0xa9, 0x60, // $0803 lda #$60
    0x8d, 0x00, 0x08, // $0805 sta $0800 (writer A: opcode-byte hit)
    0xa9, 0x05, // $0808 lda #$05
    0x8d, 0x01, 0x08, // $080a sta $0801 (writer B: operand-byte hit)
    0xa9, 0x61, // $080d lda #$61
    0x8d, 0x00, 0x08, // $080f sta $0800 (writer C: duplicate of A's triple)
  ]);
  const report = buildHazardReport({ bytes, origin: 0x0800 });
  const scMods = report.findings.filter((f) => f.hazardClass === "self-modifying-code");
  assert.equal(scMods.length, 2, "the duplicate triple from writer C must be de-duplicated to one");
  const mechanisms = scMods.map((f) => f.mechanism).sort();
  assert.deepEqual(mechanisms, ["store-target-in-instruction-opcode-byte", "store-target-in-instruction-operand-byte"]);
  assert.ok(scMods.every((f) => f.anchorAddress === 0x0800), "both survivors anchor at the same host address");
});

test("hazard shape: an empty input returns a zero denominator, empty findings and empty regions, never throws, never reads as 'no hazards'", () => {
  const report = buildHazardReport({ bytes: new Uint8Array(0), origin: 0 });
  assert.equal(report.denominator, 0);
  assert.deepEqual(report.findings, []);
  assert.deepEqual(report.regions, []);
  assert.deepEqual(report.classesEvaluated, []);
  // The limits array is still present -- absence of evaluation is not itself
  // a safety claim either.
  assert.ok(report.limits.length > 0);
});

test("hazard shape: a single-range store over an image with zero findings reports that range as no-signal, and the limits state that no detection is not evidence of safety", () => {
  const { bytes, origin } = loadPrg(TRACER_PRG_PATH);
  const report = buildHazardReport({
    bytes,
    origin,
    ranges: [{ start_address: origin, end_address: origin + bytes.length - 1, type: "code" }],
  });
  assert.equal(report.regions.length, 1);
  assert.equal(report.regions[0]!.outcome, "no-signal");
  assert.equal(report.regions[0]!.reason, undefined, "no-signal never carries a reason -- reason is unclassified-only");
  const safetyLimit = HAZARD_LIMITS.find((l) => l.hazardClass === null);
  assert.ok(safetyLimit && /no detection is not evidence of safety/i.test(safetyLimit.consequence));
});

// ---------------------------------------------------------------------------
// hazard order
// ---------------------------------------------------------------------------

test("hazard order: calling the builder twice on the same input returns deeply equal results, and findings are non-decreasing by anchor address", () => {
  const { bytes, origin } = loadPrg(SMC_PRG_PATH);
  const first = buildHazardReport({ bytes, origin });
  const second = buildHazardReport({ bytes, origin });
  assert.deepEqual(first, second);
  for (let i = 1; i < first.findings.length; i++) {
    assert.ok(first.findings[i]!.anchorAddress >= first.findings[i - 1]!.anchorAddress);
  }
});

// ---------------------------------------------------------------------------
// hazard read-only: structural source-text assertion (T-48-01)
// ---------------------------------------------------------------------------

test("hazard read-only: the module contains no file-write call, no store-open call, no cross-reference write call, no apply-write call, no live-session import and no path-translation import", () => {
  const source = readFileSync(MODULE_PATH, "utf8");
  const forbidden = [
    "writeFileSync",
    "renameSync",
    "appendFileSync",
    "save_project",
    "anno-session.ts",
    "openStore",
    "putXref",
    "applyWrite",
  ];
  for (const banned of forbidden) {
    assert.ok(!source.includes(banned), `anno-hazard-report.ts must never mention ${banned} -- a report run must be read-only by construction`);
  }
  assert.ok(!/hostpath|containerpath/.test(source), "the hazard report must stay absent from the path-translation consumer set");
});

test("hazard read-only: the module never uses the existing confidence-grade vocabulary's rendered bracket tokens", () => {
  const source = readFileSync(MODULE_PATH, "utf8");
  // Bracket form only -- the rendered collision this module's header discusses.
  // The bare word "unknown" is excluded deliberately: it is both a
  // TypeScript primitive type keyword this module legitimately uses in its
  // own argument-narrowing helpers and ordinary English, and flagging it
  // would fail on a false positive rather than a genuine vocabulary clash --
  // see this module's own header section on the separate vocabulary.
  for (const bracket of ["[confirmed-code]", "[probable-code]", "[confirmed-data]", "[probable-data]", "[unknown]"]) {
    assert.ok(!source.includes(bracket), `anno-hazard-report.ts must never render the existing confidence bracket token ${bracket}`);
  }
  for (const bareToken of ["confirmed-code", "probable-code", "confirmed-data", "probable-data"]) {
    assert.ok(!source.includes(bareToken), `anno-hazard-report.ts must never reuse the existing confidence token ${bareToken}`);
  }
});

// ---------------------------------------------------------------------------
// Shipped, not test-only
// ---------------------------------------------------------------------------

test("anno-hazard-report.ts IS present in package.json's files[] array", () => {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files: string[] };
  assert.ok(Array.isArray(pkg.files));
  assert.equal(pkg.files.includes("anno-hazard-report.ts"), true, "anno-hazard-report.ts must ship -- it is reachable through anno-tools.ts and anno-cli.ts once wired");
});

test("hazard shape: HAZARD_CLASSES and HAZARD_DETECTION_STRENGTHS are frozen and declared in a stable order", () => {
  assert.deepEqual(HAZARD_CLASSES, ["indexed-dispatch", "self-modifying-code", "page-alignment", "cycle-exact-raster"]);
  assert.ok(Object.isFrozen(HAZARD_CLASSES));
  assert.deepEqual(HAZARD_DETECTION_STRENGTHS, ["observed-corroborated", "static-shape-matched", "static-signature-only"]);
  assert.ok(Object.isFrozen(HAZARD_DETECTION_STRENGTHS));
});
