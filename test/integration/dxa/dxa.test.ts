// Real-DXA checks of dxa.analyze through the real Host Runtime server and
// tools client. Skipped (never passed) when dxa is not installed.

import assert from "node:assert/strict";
import { after, test } from "node:test";

import { callTool } from "../../../src/host-client/tools.ts";
import { ProcessSupervisor } from "../../../src/host/processes.ts";
import { startHostServer, type HostServer } from "../../../src/host/server.ts";
import { DXA, findTool } from "../../../src/host/tools/discover.ts";
import { createToolDispatcher } from "../../../src/host/tools/index.ts";
import { WireFailure, type DxaParams } from "../../../src/protocol.ts";
import { analysisSubjectPrg, MAIN, ROUTINE, TABLE_END, TABLE_START } from "../../fixtures/prg/analysis-subject.ts";

let skip: string | false = false;
try {
  findTool(DXA);
} catch {
  skip = "dxa is not installed: install dxa or set C64RT_DXA to run these tests";
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

const params = (overrides: Partial<DxaParams> = {}): DxaParams => ({ imageKind: "prg", entryPoints: [], dataRanges: [], labels: [], ...overrides });

test("DXA finds the BASIC start by itself and classifies code and data", { skip }, async () => {
  const { result, attachments } = await callTool("dxa.analyze", params(), [analysisSubjectPrg], { env: await hostEnv() });
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
  const { result } = await callTool(
    "dxa.analyze",
    params({ labels: [{ address: ROUTINE, name: "init_result" }], dataRanges: [{ start: 0x0810, end: 0x0815 }] }),
    [analysisSubjectPrg],
    { env: await hostEnv() },
  );
  assert.ok(result.labels.some((label) => label.address === ROUTINE && label.name === "init_result"));
  assert.ok(result.regions.some((region) => region.start <= 0x0810 && region.end >= 0x0815 && region.classification === "data"));
});

test("a 64 KiB image starts at $0000", { skip }, async () => {
  const memory = Buffer.alloc(0x10000);
  memory.set([0xa9, 0x01, 0x8d, 0x20, 0xd0, 0x60], 0xc000);
  const { result } = await callTool("dxa.analyze", params({ imageKind: "flat64k", entryPoints: [0xc000] }), [memory], { env: await hostEnv() });
  assert.deepEqual(result.coverage, [{ start: 0x0000, end: 0xffff }]);
  assert.ok(result.regions.some((region) => region.start === 0xc000 && region.end === 0xc005 && region.classification === "code"));
});

test("a decompile request is refused before dxa starts", { skip }, async () => {
  await assert.rejects(
    callTool("dxa.analyze", { ...params(), decompile: [] } as never, [analysisSubjectPrg], { env: await hostEnv() }),
    (error: unknown) => error instanceof WireFailure && error.code === "invalid-input",
  );
});
