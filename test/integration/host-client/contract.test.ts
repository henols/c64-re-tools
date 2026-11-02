// Contract tests: the real host-client against the real Host Runtime server,
// with a stub VICE session behind it. Besides the operations and results
// (operations.test.ts), they pin what crosses the private boundary: a session
// error with its code and message, and the loss of the machine state.

import assert from "node:assert/strict";
import { test } from "node:test";

import { failsWith } from "../../../src/errors.testkit.ts";
import { ViceSessionClient } from "../../../src/host-client/vice-session.ts";
import { startHostServer, type ViceSessionFactory } from "../../../src/host/server.ts";
import { WireFailure } from "../../../src/protocol/messages.ts";

/** A session that answers status and refuses memoryRead; `closed` counts its closes. */
function stub(state: { closed: number }): ViceSessionFactory {
  return async ({ videoStandard }) => ({
    async handle(op) {
      if (op === "status") return { state: "stopped", videoStandard, warp: false, window: false, cartridge: false, pc: 0x2100 } as never;
      if (op === "memoryRead") throw new WireFailure("unsupported-in-space", "no drive in the stub");
      throw new Error("unreachable");
    },
    async close() {
      state.closed++;
    },
  });
}

test("session errors keep their code and message", async (t) => {
  const server = await startHostServer({ port: 0, createViceSession: stub({ closed: 0 }) });
  t.after(() => server.close());
  const client = await ViceSessionClient.open({ videoStandard: "pal", env: { C64RT_HOST: `${server.host}:${server.port}` } });
  await assert.rejects(client.memoryRead({ address: 0, size: 1, space: "drive8", view: "cpu" }), failsWith("unsupported-in-space", /^no drive in the stub$/));
  await client.close();
});

test("a host that shuts down fails a session that the emulator answered as lost machine state", async () => {
  const state = { closed: 0 };
  const server = await startHostServer({ port: 0, createViceSession: stub(state) });
  const client = await ViceSessionClient.open({ videoStandard: "pal", env: { C64RT_HOST: `${server.host}:${server.port}` } });
  await client.status();
  await server.close();
  await client.closed;
  await assert.rejects(client.status(), failsWith("machine-state-lost"));
  assert.equal(state.closed, 1);
});
