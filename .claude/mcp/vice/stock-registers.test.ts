// node:test coverage of stock-registers.ts. Every "client" below is a
// two-method-shaped stub object (only `.send` is ever called) cast via
// `as unknown as ViceMonitorClient` -- never a real socket, matching this
// module tree's own DI-stubbing convention (stock-dispatch.test.ts's own
// header comment). Synthetic replies are returned DIRECTLY from the spy as
// already-parsed shapes (ResolvedResponse), not built through
// binmon-fixtures.ts's encodeResponseFrame() -- these tests assert catalog
// resolution, argument validation, and answer shape, never frame decoding,
// which stock-protocol.test.ts already owns.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { CommandType, type ResolvedResponse, type ViceMonitorClient } from "./stock-protocol.ts";
import type { StockConnectSession } from "./stock-connect.ts";
import { registerCatalogFor, resetRegisterCatalogsForTest, handleRegistersAvailable } from "./stock-registers.ts";

beforeEach(() => {
  resetRegisterCatalogsForTest();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A representative REGISTERS_AVAILABLE enumeration: PC (2 bytes), four
 * 1-byte GP registers, and FL (the whole processor status register --
 * standing in for whichever name a real build actually uses). */
const REGISTER_FIXTURE = [
  { id: 0, size: 2, name: "PC" },
  { id: 1, size: 1, name: "A" },
  { id: 2, size: 1, name: "X" },
  { id: 3, size: 1, name: "Y" },
  { id: 4, size: 1, name: "SP" },
  { id: 5, size: 1, name: "FL" },
];

interface SendCall {
  commandType: number;
  body: Buffer;
}

/** Builds a fake client + session pair. `sendCalls` is a shared array the
 * test can inspect after invoking a handler/registerCatalogFor(). */
function makeFakeSession(options: {
  registersAvailable?: typeof REGISTER_FIXTURE;
} = {}): { session: StockConnectSession; sendCalls: SendCall[] } {
  const sendCalls: SendCall[] = [];
  const registersAvailable = options.registersAvailable ?? REGISTER_FIXTURE;

  const fakeClient = {
    send: async (commandType: number, body: Buffer = Buffer.alloc(0)): Promise<ResolvedResponse> => {
      sendCalls.push({ commandType, body });
      if (commandType === CommandType.RegistersAvailable) {
        return {
          type: "registers_available",
          requestId: 1,
          errorCode: 0,
          registers: registersAvailable,
          related: [],
        } as unknown as ResolvedResponse;
      }
      throw new Error(`makeFakeSession: unexpected commandType 0x${commandType.toString(16)}`);
    },
  } as unknown as ViceMonitorClient;

  const session = {
    client: fakeClient,
    versionQuad: "3.9",
    capabilities: { cpuHistory: "absent" },
    host: "127.0.0.1",
    port: 6502,
    targetId: "test-target",
    brokerControl: {} as unknown as StockConnectSession["brokerControl"],
    deps: {},
    baselineEpoch: null,
  } as unknown as StockConnectSession;

  return { session, sendCalls };
}

function parseAnswer(result: { content: { type: "text"; text: string }[]; isError: boolean }): Record<string, unknown> {
  return JSON.parse(result.content[0]!.text) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Task 1: registerCatalogFor() / resetRegisterCatalogsForTest() / handleRegistersAvailable
// ---------------------------------------------------------------------------

test("registerCatalogFor: maps PC/A/X/Y/SP names to ids and back", async () => {
  const { session } = makeFakeSession();
  const catalog = await registerCatalogFor(session);

  for (const reg of REGISTER_FIXTURE) {
    assert.equal(catalog.byName.get(reg.name)?.id, reg.id, `byName["${reg.name}"] should resolve to id ${reg.id}`);
    assert.equal(catalog.byId.get(reg.id)?.name, reg.name, `byId[${reg.id}] should resolve to name "${reg.name}"`);
  }
});

test("registerCatalogFor: a second call on the SAME session records no second send", async () => {
  const { session, sendCalls } = makeFakeSession();
  await registerCatalogFor(session);
  await registerCatalogFor(session);
  assert.equal(sendCalls.length, 1, "the catalog must be fetched exactly once per session");
});

test("registerCatalogFor: a DIFFERENT session object triggers a fresh fetch", async () => {
  const first = makeFakeSession();
  const second = makeFakeSession();
  await registerCatalogFor(first.session);
  await registerCatalogFor(second.session);
  assert.equal(first.sendCalls.length, 1);
  assert.equal(second.sendCalls.length, 1);
});

test("registerCatalogFor: the REGISTERS_AVAILABLE body is exactly one byte, 0x00", async () => {
  const { session, sendCalls } = makeFakeSession();
  await registerCatalogFor(session);
  assert.equal(sendCalls.length, 1);
  assert.equal(sendCalls[0]!.commandType, CommandType.RegistersAvailable);
  assert.deepEqual(sendCalls[0]!.body, Buffer.from([0x00]));
});

test("registerCatalogFor: an empty register list refuses rather than caching", async () => {
  const { session } = makeFakeSession({ registersAvailable: [] });
  await assert.rejects(() => registerCatalogFor(session), /zero registers/);
});

test("handleRegistersAvailable: lists every register in wire order and carries runState", async () => {
  const { session, sendCalls } = makeFakeSession();
  const result = await handleRegistersAvailable({}, session, {} as never);

  assert.equal(result.isError, false);
  const payload = parseAnswer(result);
  assert.equal(payload.count, REGISTER_FIXTURE.length);
  assert.equal(payload.memspace, "main");
  assert.ok("runState" in payload, "answer must carry runState (D-06)");
  assert.deepEqual(
    payload.registers,
    REGISTER_FIXTURE.map((r) => ({ id: r.id, name: r.name, size: r.size })),
    "registers must appear in the wire's own order",
  );
  assert.equal(sendCalls.length, 1);
});

test("handleRegistersAvailable: refuses an unexpected argument by naming it", async () => {
  const { session } = makeFakeSession();
  const result = await handleRegistersAvailable({ bogus: 1 }, session, {} as never);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /bogus/);
});
