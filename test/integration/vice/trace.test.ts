// Traces (D76): checkpoints that record each hit while the program runs on,
// with the instruction, its registers and the raster position. Opt-in with
// C64RT_LIVE_VICE.

import assert from "node:assert/strict";
import { after, test } from "node:test";

import { ProcessSupervisor } from "../../../src/native/processes.ts";
import { startHostServer, type HostServer } from "../../../src/host/server.ts";
import { viceSessionFactory } from "../../../src/host/vice/session.ts";
import { ViceSessionClient } from "../../../src/host-client/vice-session.ts";
import { liveEnv, liveLog, liveSkip } from "./live.ts";

let server: HostServer | undefined;
after(async () => {
  await server?.close();
});

test("a trace records the writes to a register with the instruction and the raster line, and the IRQ entries of each frame", { skip: liveSkip, timeout: 300_000 }, async () => {
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  server = await startHostServer({ port: 0, createViceSession: viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog }) });
  const client = await ViceSessionClient.open({ videoStandard: "pal", env: { C64RT_HOST: `${server.host}:${server.port}` } });
  try {
    // To READY, then $c000 LDA $d011 / AND #$ef / STA $d011 / LDX #$40 / DEX / BNE $c00a / JMP $c000.
    await client.execution({ action: "advance-frames", count: 150, space: "c64" });
    await client.memoryWrite({ address: 0xc000, data: "ad11d029ef8d11d0a240cad0fd4c00c0", space: "c64", view: "ram" });
    await client.registersSet("c64", { pc: 0xc000 });

    const writes = await client.trace({ points: [{ kind: "write", start: 0xd011, end: 0xd011 }], frames: 3, maxHits: 5 });
    assert.equal(writes.end, "hits", JSON.stringify(writes));
    assert.equal(writes.hits.length, 5);
    for (const hit of writes.hits) {
      assert.equal(hit.pc, 0xc005, "the instruction that wrote, not the next one");
      assert.equal(hit.text, "sta $d011");
      assert.equal(hit.address, 0xd011);
      assert.ok(hit.rasterLine >= 0 && hit.rasterLine < 312 && hit.rasterCycle < 63, JSON.stringify(hit));
    }
    assert.ok(new Set(writes.hits.map((hit) => hit.rasterLine * 63 + hit.rasterCycle)).size > 1, "each hit has its own raster position");

    // The KERNAL IRQ handler at $ea31 runs once in each frame.
    const irqs = await client.trace({ points: [{ kind: "exec", start: 0xea31, end: 0xea31 }], frames: 5, maxHits: 100 });
    assert.equal(irqs.end, "frames");
    assert.equal(irqs.frames, 5);
    assert.ok(irqs.hits.length >= 4 && irqs.hits.length <= 6, `${irqs.hits.length} IRQs in 5 frames`);
    assert.deepEqual([...new Set(irqs.hits.map((hit) => hit.pc))], [0xea31]);
    const frames = irqs.hits.map((hit) => hit.frame);
    assert.ok(frames[0]! <= 1 && frames.every((frame, index) => index === 0 || frame >= frames[index - 1]!), `frames count from 0 and go up: ${frames}`);
    assert.equal((await client.status()).state, "stopped", "the trace leaves the machine stopped");
  } finally {
    await client.close();
  }
});
