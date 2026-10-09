// Real-DXA checks of the DXA adapter, run where the skill script runs it.
// Skipped (never passed) when dxa is not installed.

import assert from "node:assert/strict";
import { test } from "node:test";

import { DXA, findTool } from "../../../src/native/discover.ts";
import { analyze } from "../../../src/native/dxa.ts";
import { ProcessSupervisor } from "../../../src/native/processes.ts";
import type { DxaParams } from "../../../src/native/types.ts";
import { analysisSubjectPrg, MAIN, ROUTINE, TABLE_END, TABLE_START } from "../../fixtures/prg/analysis-subject.ts";

let skip: string | false = false;
try {
  findTool(DXA);
} catch {
  skip = "dxa is not installed: install dxa or set C64RT_DXA to run these tests";
}

const supervisor = new ProcessSupervisor();
supervisor.installExitGuard();
const run = (params: DxaParams, image: Uint8Array) => analyze(params, Buffer.from(image), { supervisor, signal: new AbortController().signal });

const params = (overrides: Partial<DxaParams> = {}): DxaParams => ({ imageKind: "prg", entryPoints: [], dataRanges: [], labels: [], ...overrides });

test("DXA finds the BASIC start by itself and classifies code and data", { skip }, async () => {
  const { result, attachments } = await run(params(), analysisSubjectPrg);
  assert.deepEqual(result.coverage, [{ start: 0x0801, end: 0x0827 }]);
  assert.deepEqual(result.regions, [
    { start: 0x0801, end: MAIN - 1, classification: "data" },
    { start: MAIN, end: 0x0815, classification: "code" },
    { start: 0x0816, end: ROUTINE - 1, classification: "data" },
    { start: ROUTINE, end: 0x0823, classification: "code" },
    { start: TABLE_START, end: TABLE_END, classification: "data" },
  ]);
  assert.deepEqual(result.labels.map((label) => label.name), ["l80d", "l810", "l818", "l824"]);
  assert.deepEqual(result.completeness, { regions: true, labels: false });
  assert.match(attachments[0]!.toString("utf8"), /0818 a9 01\s+\tlda #\$01/);
});

test("seeds name a routine and turn code into data", { skip }, async () => {
  const { result } = await run(params({ labels: [{ address: ROUTINE, name: "init_result" }], dataRanges: [{ start: 0x0810, end: 0x0815 }] }), analysisSubjectPrg);
  assert.ok(result.labels.some((label) => label.address === ROUTINE && label.name === "init_result"));
  assert.ok(result.regions.some((region) => region.start <= 0x0810 && region.end >= 0x0815 && region.classification === "data"));
});

test("a 64 KiB image starts at $0000", { skip }, async () => {
  const memory = Buffer.alloc(0x10000);
  memory.set([0xa9, 0x01, 0x8d, 0x20, 0xd0, 0x60], 0xc000);
  const { result } = await run(params({ imageKind: "flat64k", entryPoints: [0xc000] }), memory);
  assert.deepEqual(result.coverage, [{ start: 0x0000, end: 0xffff }]);
  assert.ok(result.regions.some((region) => region.start === 0xc000 && region.end === 0xc005 && region.classification === "code"));
});
