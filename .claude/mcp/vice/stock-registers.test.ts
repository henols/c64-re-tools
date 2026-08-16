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

import { CommandType, ResponseType, parseBuffer, type ResolvedResponse, type ViceMonitorClient } from "./stock-protocol.ts";
import { encodeResponseFrame } from "./binmon-fixtures.ts";
import type { StockConnectSession } from "./stock-connect.ts";
import {
  registerCatalogFor,
  resetRegisterCatalogsForTest,
  handleRegistersAvailable,
  handleRegistersGet,
  handleRegistersSet,
} from "./stock-registers.ts";

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

/** The exact REGISTERS_AVAILABLE enumeration observed LIVE against genuine
 * stock VICE 3.9 (/usr/bin/x64sc), recorded in 03-UAT.md test 5. `size` here
 * is the wire's own size byte, taken verbatim -- and it is a BIT count (8 or
 * 16 on a 6510), NEVER a byte count. This is the exact fact the pre-fix code
 * (`stock-registers.ts:260-268`, comparing `size` against `1`/`2`) got
 * wrong, and this fixture exists so that mistake cannot be silently
 * reintroduced: see the provenance-guard test below, which fails loudly if
 * this fixture is ever "corrected" back to 1/2. */
const LIVE_REGISTER_FIXTURE_3_9 = [
  { id: 3, size: 16, name: "PC" },
  { id: 0, size: 8, name: "A" },
  { id: 1, size: 8, name: "X" },
  { id: 2, size: 8, name: "Y" },
  { id: 4, size: 8, name: "SP" },
  { id: 55, size: 8, name: "00" },
  { id: 56, size: 8, name: "01" },
  { id: 5, size: 8, name: "FL" },
  { id: 53, size: 16, name: "LIN" },
  { id: 54, size: 16, name: "CYC" },
];

/** Builds one REGISTERS_AVAILABLE (0x83) item exactly as
 * stock-protocol.test.ts's own `availItem()` does:
 * `[item_size][id][size][nameLen][name]`. Not imported across test files
 * (this plan's own instruction) -- mirrored locally instead. */
function availItem(id: number, size: number, name: string): Buffer {
  const nameBytes = Buffer.from(name, "ascii");
  const payload = Buffer.concat([Buffer.from([id, size, nameBytes.length]), nameBytes]);
  return Buffer.concat([Buffer.from([payload.length]), payload]);
}

/** Wraps a list of {id, size, name} items into a real 0x83 response frame,
 * mirroring stock-protocol.test.ts's own `encodeResponseFrame()` usage. */
function registersAvailableFrame(items: Array<{ id: number; size: number; name: string }>, requestId = 1): Buffer {
  const count = Buffer.alloc(2);
  count.writeUInt16LE(items.length, 0);
  return encodeResponseFrame({
    responseType: ResponseType.RegistersAvailable,
    errorCode: 0x00,
    requestId,
    body: Buffer.concat([count, ...items.map((it) => availItem(it.id, it.size, it.name))]),
  });
}

/** Runs `items` through a REAL 0x83 frame and the REAL `parseBuffer()`,
 * returning the decoded `{id, size, name}` triples -- so every test that
 * consumes this (via `makeFakeSession({ registersAvailable: ... })`) sits
 * downstream of the genuine wire parser, not a hand-asserted shape. */
function decodeFixture(items: Array<{ id: number; size: number; name: string }>): Array<{ id: number; size: number; name: string }> {
  const frame = registersAvailableFrame(items);
  const { responses } = parseBuffer(frame, { desyncBytes: 0 });
  const parsed = responses[0] as { type: string; registers: Array<{ id: number; size: number; name: string }> };
  if (parsed.type !== "registers_available") {
    throw new Error(`decodeFixture: expected a registers_available reply, got "${parsed.type}"`);
  }
  return parsed.registers;
}

interface SendCall {
  commandType: number;
  body: Buffer;
}

/** Builds a fake client + session pair. `sendCalls` is a shared array the
 * test can inspect after invoking a handler/registerCatalogFor(). The
 * REGISTERS_GET/REGISTERS_SET reply shapes are overridable per test. */
function makeFakeSession(options: {
  registersAvailable?: typeof REGISTER_FIXTURE;
  registersGetReply?: Array<{ id: number; value: number }>;
  registersSetReply?: Array<{ id: number; value: number }>;
  failRegistersSet?: Error;
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
      if (commandType === CommandType.RegistersGet) {
        return {
          type: "registers",
          requestId: 1,
          errorCode: 0,
          registers: options.registersGetReply ?? [{ id: 1, value: 0x42 }],
          related: [],
        } as unknown as ResolvedResponse;
      }
      if (commandType === CommandType.RegistersSet) {
        if (options.failRegistersSet) {
          throw options.failRegistersSet;
        }
        return {
          type: "registers",
          requestId: 1,
          errorCode: 0,
          registers: options.registersSetReply ?? [{ id: 1, value: 0x42 }],
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

// ---------------------------------------------------------------------------
// Task 2: handleRegistersGet / handleRegistersSet
// ---------------------------------------------------------------------------

test("handleRegistersGet: renders names from the catalog and reports unknown ids", async () => {
  const { session } = makeFakeSession({
    registersGetReply: [
      { id: 1, value: 0x42 }, // A -- known
      { id: 99, value: 0x07 }, // unknown to the catalog
    ],
  });
  const result = await handleRegistersGet({}, session, {} as never);
  assert.equal(result.isError, false);
  const payload = parseAnswer(result);
  assert.deepEqual(payload.registers, { A: 0x42 });
  assert.deepEqual(payload.unknownIds, [{ id: 99, value: 0x07 }]);
  assert.equal(payload.memspace, "main");
  assert.ok("runState" in payload);
});

test("handleRegistersGet: refuses an unexpected argument by naming it", async () => {
  const { session } = makeFakeSession();
  const result = await handleRegistersGet({ extra: true }, session, {} as never);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /extra/);
});

test("handleRegistersSet: register 'a' resolves case-insensitively and encodes the correct wire body", async () => {
  const { session, sendCalls } = makeFakeSession({ registersSetReply: [{ id: 1, value: 5 }] });
  const result = await handleRegistersSet({ register: "a", value: 5 }, session, {} as never);
  assert.equal(result.isError, false);

  const setCall = sendCalls.find((c) => c.commandType === CommandType.RegistersSet);
  assert.ok(setCall, "expected a REGISTERS_SET send");
  const body = setCall!.body;
  // Wire layout (stock-protocol.ts's registersSetBody(), matching this
  // plan's own 03-02 sibling precedent): memspace(1) count(u16LE) then per
  // item itemSize(1) regId(1) value(u16LE) -- a 3-byte header, so the
  // FIRST item's itemSize byte sits at offset 3, not offset 2. (The plan's
  // own illustrative acceptance-criteria text names offset 2 -- the same
  // off-by-one already documented and corrected in 03-02-SUMMARY.md's own
  // deviation log for this identical body shape; corrected here the same
  // way, Rule 1 auto-fix.)
  assert.equal(body.readUInt16LE(1), 1, "count field must be 1 (one item)");
  assert.equal(body[3], 3, "itemSize byte for the first item must be 3");
  assert.equal(body[4], 1, "the resolved wire id for register A must be 1");
});

test("handleRegistersSet: unknown register name refuses naming the available names, zero REGISTERS_SET sends", async () => {
  const { session, sendCalls } = makeFakeSession();
  const result = await handleRegistersSet({ register: "ZZ", value: 1 }, session, {} as never);
  assert.equal(result.isError, true);
  const text = result.content[0]!.text;
  assert.ok(REGISTER_FIXTURE.some((r) => text.includes(r.name)), "refusal must name at least one available register");
  assert.equal(sendCalls.filter((c) => c.commandType === CommandType.RegistersSet).length, 0);
});

test("handleRegistersSet: a flag-bit name ('C') refuses with an explanatory 'status register' message", async () => {
  const { session, sendCalls } = makeFakeSession();
  const result = await handleRegistersSet({ register: "C", value: 1 }, session, {} as never);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /status register/);
  assert.equal(sendCalls.filter((c) => c.commandType === CommandType.RegistersSet).length, 0);
});

test("handleRegistersSet: an out-of-range value for a size-1 register refuses, zero sends", async () => {
  const { session, sendCalls } = makeFakeSession();
  const result = await handleRegistersSet({ register: "A", value: 0x100 }, session, {} as never);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /range/);
  assert.equal(sendCalls.filter((c) => c.commandType === CommandType.RegistersSet).length, 0);
});

test("handleRegistersSet: a read-back value differing from the requested value still answers ok, reporting both distinctly", async () => {
  const { session } = makeFakeSession({ registersSetReply: [{ id: 1, value: 0x99 }] });
  const result = await handleRegistersSet({ register: "A", value: 0x42 }, session, {} as never);
  assert.equal(result.isError, false);
  const payload = parseAnswer(result);
  assert.equal(payload.requestedValue, 0x42);
  assert.equal(payload.observedValue, 0x99);
  assert.ok("runState" in payload);
});

test("handleRegistersSet: a send() rejection produces isError:true with no 'wedge' wording", async () => {
  const { session } = makeFakeSession({ failRegistersSet: new Error("socket exploded") });
  const result = await handleRegistersSet({ register: "A", value: 1 }, session, {} as never);
  assert.equal(result.isError, true);
  assert.doesNotMatch(result.content[0]!.text.toLowerCase(), /wedge|hung|unresponsive/);
});

test("handleRegistersSet: missing/invalid register or value refuses before any send", async () => {
  const { session, sendCalls } = makeFakeSession();
  const missingRegister = await handleRegistersSet({ value: 1 }, session, {} as never);
  assert.equal(missingRegister.isError, true);

  const missingValue = await handleRegistersSet({ register: "A" }, session, {} as never);
  assert.equal(missingValue.isError, true);

  assert.equal(sendCalls.length, 0, "argument validation must refuse before any wire traffic, including the catalog fetch");
});

// ---------------------------------------------------------------------------
// DIRECT-02/DIRECT-09 gap closure (03-14): a wire-shaped REGISTERS_AVAILABLE
// fixture that fails against today's bits-vs-bytes bug. Every test below
// feeds `makeFakeSession({ registersAvailable: decodeFixture(...) })` --
// never the raw LIVE_REGISTER_FIXTURE_3_9 literal -- so the real parser
// sits inside the regression path (per this plan's Task 1 action).
// ---------------------------------------------------------------------------

test("LIVE_REGISTER_FIXTURE_3_9: every declared width is a BIT count (8 or 16), never a byte count (1 or 2)", () => {
  for (const reg of LIVE_REGISTER_FIXTURE_3_9) {
    assert.ok(
      reg.size === 8 || reg.size === 16,
      `register "${reg.name}" declares size ${reg.size} -- REGISTERS_AVAILABLE reports width in BITS (8 or 16 on a 6510), not bytes`,
    );
    assert.notEqual(reg.size, 1, `register "${reg.name}" must not declare a byte count (1) -- the wire reports BITS, not bytes`);
    assert.notEqual(reg.size, 2, `register "${reg.name}" must not declare a byte count (2) -- the wire reports BITS, not bytes`);
  }
});

test("LIVE_REGISTER_FIXTURE_3_9: round-trips through a real 0x83 response frame and the real parseBuffer()", () => {
  const decoded = decodeFixture(LIVE_REGISTER_FIXTURE_3_9);
  assert.deepEqual(decoded, LIVE_REGISTER_FIXTURE_3_9, "decoding a real 0x83 frame built from the fixture must yield the identical {id, size, name} triples");
});

test("handleRegistersSet: an ordinary 8-bit register write (A=42) is accepted against a live-shaped catalog (THE BLOCKER)", async () => {
  const { session } = makeFakeSession({
    registersAvailable: decodeFixture(LIVE_REGISTER_FIXTURE_3_9),
    registersSetReply: [{ id: 0, value: 42 }],
  });
  const result = await handleRegistersSet({ register: "A", value: 42 }, session, {} as never);
  assert.equal(result.isError, false, `expected success, got: ${result.isError ? result.content[0]!.text : ""}`);
  const payload = parseAnswer(result);
  assert.equal(payload.register, "A");
  assert.equal(payload.requestedValue, 42);
  assert.equal(payload.observedValue, 42);
});

test("handleRegistersSet: a 16-bit register write (PC=0xffff) is accepted against a live-shaped catalog", async () => {
  const { session } = makeFakeSession({
    registersAvailable: decodeFixture(LIVE_REGISTER_FIXTURE_3_9),
    registersSetReply: [{ id: 3, value: 0xffff }],
  });
  const result = await handleRegistersSet({ register: "PC", value: 0xffff }, session, {} as never);
  assert.equal(result.isError, false, `expected success, got: ${result.isError ? result.content[0]!.text : ""}`);
  const payload = parseAnswer(result);
  assert.equal(payload.register, "PC");
  assert.equal(payload.requestedValue, 0xffff);
  assert.equal(payload.observedValue, 0xffff);
});

test("handleRegistersSet: out-of-range values still refuse at the correct per-width boundary (256 / 0x10000), naming the range not 'byte'", async () => {
  const { session: session8 } = makeFakeSession({ registersAvailable: decodeFixture(LIVE_REGISTER_FIXTURE_3_9) });
  const result8 = await handleRegistersSet({ register: "A", value: 256 }, session8, {} as never);
  assert.equal(result8.isError, true);
  assert.match(result8.content[0]!.text, /0\.\.0xff\b/, "an 8-bit register's refusal must name the range 0..0xff");

  const { session: session16 } = makeFakeSession({ registersAvailable: decodeFixture(LIVE_REGISTER_FIXTURE_3_9) });
  const result16 = await handleRegistersSet({ register: "PC", value: 0x10000 }, session16, {} as never);
  assert.equal(result16.isError, true);
  assert.match(result16.content[0]!.text, /0\.\.0xffff\b/, "a 16-bit register's refusal must name the range 0..0xffff");
});

test("handleRegistersSet: a flag-bit name ('N') refuses naming FL under the live-shaped catalog, mentioning bit 7", async () => {
  const { session, sendCalls } = makeFakeSession({ registersAvailable: decodeFixture(LIVE_REGISTER_FIXTURE_3_9) });
  const result = await handleRegistersSet({ register: "N", value: 1 }, session, {} as never);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /FL/, "the refusal must name FL -- this fixture's build's own status register");
  assert.match(result.content[0]!.text, /bit 7/);
  assert.equal(sendCalls.filter((c) => c.commandType === CommandType.RegistersSet).length, 0);
});

test("handleRegistersAvailable: reports each register's live-shaped width unchanged, under the field name sizeBits", async () => {
  const { session } = makeFakeSession({ registersAvailable: decodeFixture(LIVE_REGISTER_FIXTURE_3_9) });
  const result = await handleRegistersAvailable({}, session, {} as never);
  assert.equal(result.isError, false);
  const payload = parseAnswer(result);
  const registers = payload.registers as Array<{ id: number; name: string; sizeBits: number }>;
  assert.equal(registers.length, LIVE_REGISTER_FIXTURE_3_9.length);
  for (const reg of registers) {
    const expected = LIVE_REGISTER_FIXTURE_3_9.find((r) => r.id === reg.id);
    assert.ok(expected, `unexpected register id ${reg.id} in the answer`);
    assert.equal(reg.sizeBits, expected!.size, `register "${reg.name}" must report its wire-reported width unchanged under "sizeBits"`);
  }
});
