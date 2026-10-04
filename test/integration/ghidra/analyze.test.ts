// Real-Ghidra checks of the Ghidra adapter, run where the skill script runs
// it. Skipped (never passed) when Ghidra is not found.

import assert from "node:assert/strict";
import { test } from "node:test";

import { analyze } from "../../../src/native/ghidra/analyze.ts";
import { findGhidra } from "../../../src/native/ghidra/index.ts";
import { ProcessSupervisor } from "../../../src/native/processes.ts";
import type { GhidraParams } from "../../../src/native/types.ts";
import { WireFailure } from "../../../src/protocol.ts";
import { analysisSubjectPrg, MAIN, MAIN_LOOP, RESULT, ROUTINE, TABLE_END, TABLE_START } from "../../fixtures/prg/analysis-subject.ts";

let skip: string | false = false;
try {
  findGhidra();
} catch {
  skip = "Ghidra is not installed: set C64RT_GHIDRA to the Ghidra installation directory to run these tests";
}

const supervisor = new ProcessSupervisor();
supervisor.installExitGuard();
const run = (params: GhidraParams) => analyze(params, Buffer.from(analysisSubjectPrg), { supervisor, signal: new AbortController().signal });

const seeds = (overrides: Partial<GhidraParams> = {}): GhidraParams => ({
  imageKind: "prg",
  entryPoints: [MAIN],
  dataRanges: [{ start: TABLE_START, end: TABLE_END }],
  labels: [
    { address: ROUTINE, name: "init_result" },
    { address: 0xd020, name: "VIC_BORDER" },
  ],
  decompile: [ROUTINE],
  ...overrides,
});

test("Ghidra finds the functions, regions and references of a known program", { skip, timeout: 600_000 }, async () => {
  const { result } = await run(seeds());
  assert.deepEqual(result.coverage, [{ start: 0x0801, end: 0x0827 }]);
  assert.deepEqual(result.functions, [
    { entry: MAIN, name: "FUN_080d", nameSource: "generated" },
    { entry: ROUTINE, name: "init_result", nameSource: "seed" },
  ]);
  assert.deepEqual(result.regions, [
    { start: MAIN, end: 0x0815, classification: "code" },
    { start: ROUTINE, end: 0x0823, classification: "code" },
    { start: TABLE_START, end: TABLE_END, classification: "data" },
  ]);
  assert.deepEqual(result.references, [
    { from: MAIN, to: ROUTINE, type: "call" },
    { from: MAIN_LOOP, to: 0xd020, type: "read" },
    { from: MAIN_LOOP, to: 0xd020, type: "write" },
    { from: 0x0813, to: MAIN_LOOP, type: "jump" },
    { from: 0x081a, to: RESULT, type: "write" },
    { from: 0x081d, to: TABLE_START, type: "read" },
  ]);
  assert.deepEqual(result.completeness, { functions: true, regions: true, references: true });
});

test("decompiled code uses the seed name and drops the decimal path of ADC", { skip, timeout: 600_000 }, async () => {
  const { result } = await run(seeds());
  const [decompiled] = result.decompilations;
  assert.equal(decompiled?.entry, ROUTINE);
  assert.equal(decompiled.truncated, false);
  assert.match(decompiled.text, /init_result\(void\)/);
  assert.match(decompiled.text, /\+ 5;/, "binary ADC");
  assert.doesNotMatch(decompiled.text, /\bD\b|0x60|0xa0/, "no decimal adjustment is left");
});

test("a run without an entry point in the program is refused before Ghidra starts", { skip }, async () => {
  await assert.rejects(
    run(seeds({ entryPoints: [0xe000] })),
    (error: unknown) => error instanceof WireFailure && error.code === "invalid-input",
  );
});
