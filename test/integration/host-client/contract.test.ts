// Contract tests: the real host-client against the real Host Runtime server,
// with a stub VICE session behind it. They pin what crosses the private
// boundary: operations, results and error codes.

import assert from "node:assert/strict";
import { after, test } from "node:test";

import { ViceSessionClient } from "../../../src/host-client/vice-session.ts";
import { startHostServer, type HostServer, type ViceSessionFactory } from "../../../src/host/server.ts";
import { WireFailure, type Registers } from "../../../src/protocol.ts";

const REGISTERS: Registers = { pc: 0x2100, a: 0x42, x: 3, y: 0, sp: 0xf9, flags: { n: false, v: false, b: false, d: false, i: true, z: false, c: true } };

interface StubState {
  opened: Array<{ videoStandard: string }>;
  closed: number;
  calls: Array<[string, unknown]>;
}

function stub(state: StubState): ViceSessionFactory {
  return async ({ videoStandard }) => {
    state.opened.push({ videoStandard });
    return {
      async handle(op, params) {
        state.calls.push([op, params]);
        switch (op) {
          case "status":
            return { state: "stopped", videoStandard, warp: false, pc: 0x2100 } as never;
          case "memoryRead": {
            const { address, size, space } = params as { address: number; size: number; space: string };
            if (space === "drive8") throw new WireFailure("unsupported-in-space", "no drive in the stub");
            return { address, data: "ab".repeat(size) } as never;
          }
          case "registersGet":
            return REGISTERS as never;
        }
        throw new Error("unreachable");
      },
      async close() {
        state.closed++;
      },
    };
  };
}

const servers: HostServer[] = [];
after(async () => {
  await Promise.all(servers.map((server) => server.close()));
});

async function host(factory: ViceSessionFactory): Promise<NodeJS.ProcessEnv> {
  const server = await startHostServer({ port: 0, createViceSession: factory });
  servers.push(server);
  return { C64RT_HOST: `${server.host}:${server.port}` };
}

const failsWith = (code: string) => (error: unknown) => error instanceof WireFailure && error.code === code;

test("status, memoryRead and registersGet cross the boundary with typed results", async () => {
  const state: StubState = { opened: [], closed: 0, calls: [] };
  const client = await ViceSessionClient.open({ videoStandard: "ntsc", env: await host(stub(state)) });
  assert.deepEqual(state.opened, [{ videoStandard: "ntsc" }]);
  assert.deepEqual(await client.status(), { state: "stopped", videoStandard: "ntsc", warp: false, pc: 0x2100 });
  assert.deepEqual(await client.memoryRead({ address: 0xe000, size: 3, space: "c64", view: "ram" }), { address: 0xe000, data: "ababab" });
  assert.deepEqual(await client.registersGet("c64"), REGISTERS);
  assert.deepEqual(state.calls, [
    ["status", {}],
    ["memoryRead", { address: 0xe000, size: 3, space: "c64", view: "ram" }],
    ["registersGet", { space: "c64" }],
  ]);
  await client.close();
  await waitFor(() => state.closed === 1);
});

test("session errors keep their code and message", async () => {
  const client = await ViceSessionClient.open({ videoStandard: "pal", env: await host(stub({ opened: [], closed: 0, calls: [] })) });
  await assert.rejects(client.memoryRead({ address: 0, size: 1, space: "drive8", view: "cpu" }), (error: unknown) => {
    assert.ok(failsWith("unsupported-in-space")(error));
    assert.equal((error as Error).message, "no drive in the stub");
    return true;
  });
  await client.close();
});

test("the host validates parameters before the session sees them", async () => {
  const state: StubState = { opened: [], closed: 0, calls: [] };
  const client = await ViceSessionClient.open({ videoStandard: "pal", env: await host(stub(state)) });
  await assert.rejects(client.memoryRead({ address: 0xfff0, size: 32, space: "c64", view: "cpu" }), failsWith("invalid-input"));
  assert.deepEqual(state.calls, []);
  await client.close();
});

test("a session that cannot start fails the open with the host's error", async () => {
  const env = await host(async () => {
    throw new WireFailure("installation-incomplete", "VICE (x64sc) is not installed on the host.");
  });
  await assert.rejects(ViceSessionClient.open({ videoStandard: "pal", env }), failsWith("installation-incomplete"));
});

test("two clients get two independent sessions", async () => {
  const state: StubState = { opened: [], closed: 0, calls: [] };
  const env = await host(stub(state));
  const [first, second] = await Promise.all([ViceSessionClient.open({ videoStandard: "pal", env }), ViceSessionClient.open({ videoStandard: "pal", env })]);
  assert.equal(state.opened.length, 2);
  await first.close();
  await waitFor(() => state.closed === 1);
  assert.equal((await second.status()).state, "stopped");
  await second.close();
  await waitFor(() => state.closed === 2);
});

test("a host that shuts down fails the session as lost machine state", async () => {
  const state: StubState = { opened: [], closed: 0, calls: [] };
  const server = await startHostServer({ port: 0, createViceSession: stub(state) });
  const client = await ViceSessionClient.open({ videoStandard: "pal", env: { C64RT_HOST: `${server.host}:${server.port}` } });
  await server.close();
  await client.closed;
  await assert.rejects(client.status(), failsWith("machine-state-lost"));
  assert.equal(state.closed, 1);
});

async function waitFor(condition: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("condition not reached in time");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
