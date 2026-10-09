// A stopped machine must stay stopped, against real VICE
// through the real Host Runtime: stopped at a breakpoint, it takes every
// read-only operation, then idles past several heartbeat intervals. The CPU
// stopwatch is the proof: it reads 0 cycles only if no instruction ran.

import assert from "node:assert/strict";
import { after, test } from "node:test";

import { ViceSessionClient } from "../../../src/host-client/vice-session.ts";
import { HEARTBEAT_INTERVAL_MS } from "../../../src/protocol.ts";
import { liveSkip, startHost, stopHosts } from "./live.ts";

after(stopHosts);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("a machine stopped at a breakpoint never runs through reads and idle time", { skip: liveSkip, timeout: 120_000 }, async () => {
  const host = await startHost();
  const session = await ViceSessionClient.open({ videoStandard: "pal", env: { C64RT_HOST: host.address } });
  try {
    // The KERNAL waits for a key in a loop through $e5cd.
    await session.breakpoint({ action: "add", address: 0xe5cd, space: "c64" });
    let stopped = await session.status();
    for (let i = 0; i < 200 && stopped.state !== "stopped"; i++) {
      await sleep(25);
      stopped = await session.status();
    }
    assert.equal(stopped.state, "stopped");
    await session.timing("start");

    const neverRan = async (when: string) => {
      const status = await session.status();
      assert.equal(status.state, "stopped", when);
      assert.equal(status.pc, stopped.pc, when);
      assert.deepEqual(await session.timing("read"), { cycles: "0" }, `${when}: no cycle ran`);
    };

    const memory = { address: 0x0400, space: "c64", view: "cpu" } as const;
    await session.registersGet("c64");
    await session.memoryRead({ address: 0x0400, size: 256, space: "c64", view: "cpu" });
    await session.memoryRead({ address: 0xe000, size: 16, space: "c64", view: "ram" });
    await session.disassemble({ address: 0xe5cd, count: 8, space: "c64", view: "cpu" });
    await session.memorySearch({ start: 0xe000, end: 0xffff, pattern: [0xa5, 0xc6], space: "c64", view: "cpu", maxResults: 4 });
    await session.memoryCompare({ left: memory, right: { ...memory, address: 0x0800 }, size: 64 });
    await session.cpuHistory({ limit: 20, space: "c64" });
    await session.backtrace({ depth: 8, space: "c64" });
    await session.vicii();
    await session.sprites([0, 1]);
    await session.cia("both");
    await session.sid();
    await session.observe({ registers: "c64", memory: [{ ...memory, size: 16 }], vicii: true, sprites: [], cia: "both", sid: true, screen: true, timing: true });
    await session.screenCapture();
    await session.breakpoint({ action: "list" });
    await session.watchpoint({ action: "list" });
    await session.memmap({ action: "read", start: 0x0000, end: 0xffff, maxRanges: 8 });
    await session.profile(5);
    await session.snapshot({ action: "list" });
    await neverRan("after every read-only operation");

    // Several heartbeat pings pass; nothing reaches VICE.
    await sleep(HEARTBEAT_INTERVAL_MS * 2 + 2_000);
    await neverRan("after idling");
  } finally {
    await session.close();
  }
});
