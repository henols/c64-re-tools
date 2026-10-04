// Real-Ghidra checks of ghidra.analyze through the real Host Runtime server
// and tools client. Skipped (never passed) when Ghidra is not found.

import assert from "node:assert/strict";
import { test, after } from "node:test";

import { callTool } from "../../../src/host-client/tools.ts";
import { ProcessSupervisor } from "../../../src/host/processes.ts";
import { startHostServer, type HostServer } from "../../../src/host/server.ts";
import { findGhidra } from "../../../src/host/tools/ghidra/index.ts";
import { createToolDispatcher } from "../../../src/host/tools/index.ts";
import { WireFailure, type GhidraParams } from "../../../src/protocol.ts";
import { analysisSubjectPrg, MAIN, MAIN_LOOP, RESULT, ROUTINE, TABLE_END, TABLE_START } from "../../fixtures/prg/analysis-subject.ts";

let skip: string | false = false;
try {
  findGhidra();
} catch {
  skip = "Ghidra is not installed: set C64RT_GHIDRA to the Ghidra installation directory to run these tests";
}

let server: HostServer | undefined;
after(async () => {
  await server?.close();
});

async function hostEnv(): Promise<NodeJS.ProcessEnv> {
  if (server === undefined) {
    const supervisor = new ProcessSupervisor();
    supervisor.installExitGuard();
    server = await startHostServer({
      port: 0,
      createViceSession: async () => {
        throw new WireFailure("machine-unavailable", "no emulators here");
      },
      tools: createToolDispatcher({ supervisor }),
    });
  }
  return { C64RT_HOST: `${server.host}:${server.port}` };
}

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
  const { result } = await callTool("ghidra.analyze", seeds(), [analysisSubjectPrg], { env: await hostEnv() });
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
  const { result } = await callTool("ghidra.analyze", seeds(), [analysisSubjectPrg], { env: await hostEnv() });
  const [decompiled] = result.decompilations;
  assert.equal(decompiled?.entry, ROUTINE);
  assert.equal(decompiled.truncated, false);
  assert.match(decompiled.text, /init_result\(void\)/);
  assert.match(decompiled.text, /\+ 5;/, "binary ADC");
  assert.doesNotMatch(decompiled.text, /\bD\b|0x60|0xa0/, "no decimal adjustment is left");
});

test("a run without an entry point in the program is refused before Ghidra starts", { skip }, async () => {
  await assert.rejects(
    callTool("ghidra.analyze", seeds({ entryPoints: [0xe000] }), [analysisSubjectPrg], { env: await hostEnv() }),
    (error: unknown) => error instanceof WireFailure && error.code === "invalid-input",
  );
});
