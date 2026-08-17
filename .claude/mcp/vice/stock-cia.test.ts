// node:test coverage of stock-cia.ts -- decodeCia() and handleCiaGetState.
// Every "session" below is built by makeSession(), whose `client` is a real
// EventEmitter (never a real socket) with a `send` spy recording every call
// as [commandType, body] -- matching stock-disassemble.test.ts's own
// DI-stub convention: these tests assert WIRING (call order, call count,
// byte-level body contents, answer shape) and pure decode correctness,
// never a real protocol round trip.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { handleCiaGetState, decodeCia, CIA_UNAVAILABLE_FIELDS, CIA1_BASE, CIA2_BASE, CIA_LENGTH } from "./stock-cia.ts";
import { CommandType, ErrorCode } from "./stock-protocol.ts";
import { resetRunStateTrackersForTest } from "./stock-runstate.ts";
import type { StockConnectSession } from "./stock-connect.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";

beforeEach(() => {
  resetRunStateTrackersForTest();
});

type SendCall = [number, Buffer];

/** Builds a fake StockConnectSession whose `client` is a real EventEmitter
 * with a `send` spy recording every call as [commandType, body]. `sendImpl`
 * decides what each call resolves (or throws) to. Never a real socket. */
function makeSession(sendImpl: (commandType: number, body: Buffer) => unknown): {
  session: StockConnectSession;
  calls: SendCall[];
} {
  const calls: SendCall[] = [];
  const client = Object.assign(new EventEmitter(), {
    send: async (commandType: number, body: Buffer = Buffer.alloc(0)) => {
      calls.push([commandType, body]);
      return sendImpl(commandType, body);
    },
  });
  const session = { client } as unknown as StockConnectSession;
  return { session, calls };
}

const DEPS = {} as unknown as StockDispatchDeps;

function memoryGetReply(bytes: number[], requestId = 1) {
  return { type: "memory_get" as const, requestId, errorCode: ErrorCode.Ok, bytes: Buffer.from(bytes), related: [] };
}

function parseAnswer(result: { content: { text: string }[] }): Record<string, unknown> {
  return JSON.parse(result.content[0]!.text);
}

// ---------------------------------------------------------------------------
// Fixtures -- one 16-byte corpus per chip, per-offset annotated. Values are
// deliberately distinct between chips so a chip mix-up in the dispatch
// (wrong fixture returned for wrong start address) would be caught.
// ---------------------------------------------------------------------------

// CIA1 ($DC00):
//   portA=0xef (bit4 clear -> joystick2 FIRE pressed, everything else released)
//   portB=0xfe (bit0 clear -> joystick1 UP pressed)
//   ddrA=0xff, ddrB=0x00
//   timerA=0x1234 (bytes 0x34,0x12), timerB=0x5678 (bytes 0x78,0x56)
//   TOD: tenths=5, seconds=0x42(BCD 42), minutes=0x59(BCD 59), hours=0x8b (pm, BCD->11)
//   SDR=0xa5
//   ICR=0b10000011 (timer A + timer B underflow, interruptGenerated)
//   CRA=0b10000001 (started, TOD 50Hz)
//   CRB=0b01000000 (countSource 2 -- "timer a underflows")
const CIA1_BYTES = [0xef, 0xfe, 0xff, 0x00, 0x34, 0x12, 0x78, 0x56, 0x05, 0x42, 0x59, 0x8b, 0xa5, 0x83, 0x81, 0x40];

// CIA2 ($DD00):
//   portA=0xc1 (bank bits %01 -> vicBank:2, vicBankBase:32768; bits6-7 set -> serialClockIn/serialDataIn)
//   portB=0x00 (all RS232 lines clear)
//   ddrA=0x0f, ddrB=0xf0 -- distinguishable from CIA1's 0xff/0x00
//   timerA=0x2211 (bytes 0x11,0x22), timerB=0x4433 (bytes 0x33,0x44) -- distinguishable from CIA1
//   TOD bytes distinguishable from CIA1's
//   SDR=0x5a, ICR/CRA/CRB distinguishable from CIA1's
const CIA2_BYTES = [0xc1, 0x00, 0x0f, 0xf0, 0x11, 0x22, 0x33, 0x44, 0x01, 0x02, 0x03, 0x04, 0x5a, 0x02, 0x02, 0x20];

// ---------------------------------------------------------------------------
// Decode correctness -- decodeCia() is pure, drive it directly.
// ---------------------------------------------------------------------------

test("CIA1 portA.joystick2 is active-low decoded -- fire pressed, rest released", () => {
  const decoded = decodeCia(1, new Uint8Array(CIA1_BYTES));
  assert.deepEqual((decoded.portA as Record<string, unknown>).joystick2, {
    up: false,
    down: false,
    left: false,
    right: false,
    fire: true,
  });
});

test("CIA1 portB.joystick1.up is true, the other four false", () => {
  const decoded = decodeCia(1, new Uint8Array(CIA1_BYTES));
  const joystick1 = (decoded.portB as Record<string, unknown>).joystick1 as Record<string, boolean>;
  assert.equal(joystick1.up, true);
  assert.equal(joystick1.down, false);
  assert.equal(joystick1.left, false);
  assert.equal(joystick1.right, false);
  assert.equal(joystick1.fire, false);
});

test("CIA2 portA decodes vicBank/vicBankBase and the serial bus bits", () => {
  const decoded = decodeCia(2, new Uint8Array(CIA2_BYTES));
  const portA = decoded.portA as Record<string, unknown>;
  assert.equal(portA.vicBank, 2);
  assert.equal(portA.vicBankBase, 32768);
  assert.equal(portA.serialClockIn, true);
  assert.equal(portA.serialDataIn, true);
  // 0xc1 bits 2-5 are all clear.
  assert.equal(portA.rs232Txd, false);
  assert.equal(portA.serialAtnOut, false);
  assert.equal(portA.serialClockOut, false);
  assert.equal(portA.serialDataOut, false);
});

test("CIA2 portB decodes RS232 fields; the per-chip field sets do not union", () => {
  const cia1 = decodeCia(1, new Uint8Array(CIA1_BYTES));
  const cia2 = decodeCia(2, new Uint8Array(CIA2_BYTES));
  const cia2PortB = cia2.portB as Record<string, unknown>;
  assert.equal(cia2PortB.rs232Rxd, false);
  assert.equal(cia2PortB.ri, false);
  assert.equal(cia2PortB.dcd, false);
  assert.equal(cia2PortB.userPortH, false);
  assert.equal(cia2PortB.cts, false);
  assert.equal(cia2PortB.dsr, false);
  // Two dedicated assertions proving the per-chip field sets are genuinely
  // different, not a union.
  assert.ok(!("joystick2" in cia2PortB), "CIA2 portB must not carry a joystick2 key");
  assert.ok(!("vicBank" in (cia1.portA as Record<string, unknown>)), "CIA1 portA must not carry a vicBank key");
});

test("portADirection.outputs is all true for 0xff and portBDirection.outputs all false for 0x00", () => {
  const decoded = decodeCia(1, new Uint8Array(CIA1_BYTES));
  const portADirection = decoded.portADirection as { outputs: boolean[] };
  const portBDirection = decoded.portBDirection as { outputs: boolean[] };
  assert.deepEqual(portADirection.outputs, [true, true, true, true, true, true, true, true]);
  assert.deepEqual(portBDirection.outputs, [false, false, false, false, false, false, false, false]);
});

test("timerA.current and timerB.current reconstruct little-endian", () => {
  const decoded = decodeCia(1, new Uint8Array(CIA1_BYTES));
  assert.equal((decoded.timerA as { current: number }).current, 0x1234);
  assert.equal((decoded.timerB as { current: number }).current, 0x5678);
});

test("tod decodes BCD -- a raw pass-through would give seconds:66, not 42", () => {
  const decoded = decodeCia(1, new Uint8Array(CIA1_BYTES));
  const tod = decoded.tod as Record<string, unknown>;
  assert.equal(tod.tenths, 5);
  assert.equal(tod.seconds, 42);
  assert.equal(tod.minutes, 59);
  assert.equal(tod.hours, 11);
  assert.equal(tod.pm, true);
});

test("serialShiftRegister is the raw SDR byte", () => {
  const decoded = decodeCia(1, new Uint8Array(CIA1_BYTES));
  assert.equal(decoded.serialShiftRegister, 0xa5);
});

test("interruptStatus decodes ICR bits and names interruptKind per chip", () => {
  const cia1 = decodeCia(1, new Uint8Array(CIA1_BYTES));
  const cia2 = decodeCia(2, new Uint8Array(CIA2_BYTES));
  const status1 = cia1.interruptStatus as Record<string, unknown>;
  assert.equal(status1.timerAUnderflow, true);
  assert.equal(status1.timerBUnderflow, true);
  assert.equal(status1.todAlarm, false);
  assert.equal(status1.serialShiftComplete, false);
  assert.equal(status1.flagPin, false);
  assert.equal(status1.interruptGenerated, true);
  assert.equal(status1.interruptKind, "irq");
  const status2 = cia2.interruptStatus as Record<string, unknown>;
  assert.equal(status2.interruptKind, "nmi");
});

test("timerAControl decodes started and todFrequency50Hz, the rest false", () => {
  const decoded = decodeCia(1, new Uint8Array(CIA1_BYTES));
  const cra = decoded.timerAControl as Record<string, unknown>;
  assert.equal(cra.started, true);
  assert.equal(cra.underflowOnPortB, false);
  assert.equal(cra.underflowPulseMode, false);
  assert.equal(cra.oneShot, false);
  assert.equal(cra.forceLoad, false);
  assert.equal(cra.countsCntPin, false);
  assert.equal(cra.serialOutput, false);
  assert.equal(cra.todFrequency50Hz, true);
});

test("timerBControl decodes countSource and its meaning string", () => {
  const decoded = decodeCia(1, new Uint8Array(CIA1_BYTES));
  const crb = decoded.timerBControl as Record<string, unknown>;
  assert.equal(crb.countSource, 2);
  assert.equal(crb.countSourceMeaning, "timer a underflows");
});

test("registersHex is 32 characters and round-trips to the fixture bytes", () => {
  const decoded = decodeCia(1, new Uint8Array(CIA1_BYTES));
  const hex = decoded.registersHex as string;
  assert.equal(hex.length, 32);
  const roundTripped = Array.from({ length: 16 }, (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16));
  assert.deepEqual(roundTripped, CIA1_BYTES);
});

// ---------------------------------------------------------------------------
// Criterion 3 -- unavailable fields are never zero and never absent.
// ---------------------------------------------------------------------------

test("every CIA_UNAVAILABLE_FIELDS member decodes as {available:false, reason} on both chips", () => {
  const cia1 = decodeCia(1, new Uint8Array(CIA1_BYTES));
  const cia2 = decodeCia(2, new Uint8Array(CIA2_BYTES));
  for (const decoded of [cia1, cia2]) {
    const unavailable = decoded.unavailable as Record<string, { available: boolean; reason: string }>;
    for (const [name] of CIA_UNAVAILABLE_FIELDS) {
      const field = unavailable[name];
      assert.ok(field && typeof field === "object", `${name} must be a plain object`);
      assert.equal(field.available, false, `${name}.available must be false`);
      assert.ok(typeof field.reason === "string" && field.reason.length > 0, `${name}.reason must be a non-empty string`);
    }
  }
});

test("timerALatch is never the number 0 and never an absent key", () => {
  const decoded = decodeCia(1, new Uint8Array(CIA1_BYTES));
  const unavailable = decoded.unavailable as Record<string, unknown>;
  assert.notEqual(unavailable.timerALatch, 0);
  assert.ok("timerALatch" in unavailable, "timerALatch must be present as a key");
});

test("D-05-11 pairing: the readable half and the unreadable half of one address are two distinct fields", () => {
  const decoded = decodeCia(1, new Uint8Array(CIA1_BYTES));
  const unavailable = decoded.unavailable as Record<string, { available: boolean }>;
  assert.equal(typeof (decoded.timerA as { current: number }).current, "number");
  assert.equal(unavailable.timerALatch!.available, false);
  assert.equal(typeof (decoded.interruptStatus as { raw: number }).raw, "number");
  assert.equal(unavailable.interruptEnableMask!.available, false);
  assert.equal(typeof (decoded.tod as { seconds: number }).seconds, "number");
  assert.equal(unavailable.todAlarmTime!.available, false);
});

// ---------------------------------------------------------------------------
// Wire body and guards -- drive handleCiaGetState through the fake session.
// The fake sendImpl dispatches on the request body's `start` field so a
// both-chips call returns a DIFFERENT 16-byte corpus per chip.
// ---------------------------------------------------------------------------

function ciaSendImpl(commandType: number, body: Buffer): unknown {
  const start = body.readUInt16LE(1);
  if (start === CIA1_BASE) {
    return memoryGetReply(CIA1_BYTES);
  }
  if (start === CIA2_BASE) {
    return memoryGetReply(CIA2_BYTES);
  }
  throw new Error(`ciaSendImpl: unexpected start address 0x${start.toString(16)}`);
}

test("omitting cia reads both chips in ascending order", async () => {
  const { session, calls } = makeSession(ciaSendImpl);
  const result = await handleCiaGetState({}, session, DEPS);
  assert.equal(calls.length, 2);
  assert.equal(calls[0]![1].readUInt16LE(1), 0xdc00);
  assert.equal(calls[0]![1].readUInt16LE(3), 0xdc0f);
  assert.equal(calls[1]![1].readUInt16LE(1), 0xdd00);
  assert.equal(calls[1]![1].readUInt16LE(3), 0xdd0f);
  const answer = parseAnswer(result as { content: { text: string }[] });
  const cias = answer.cias as Record<string, unknown>[];
  assert.equal(cias.length, 2);
  assert.deepEqual(
    cias.map((c) => c.chip),
    [1, 2],
  );
  assert.equal(answer.requested, "both");
});

test("cia:1 reads only $DC00-$DC0F", async () => {
  const { session, calls } = makeSession(ciaSendImpl);
  const result = await handleCiaGetState({ cia: 1 }, session, DEPS);
  assert.equal(calls.length, 1);
  const answer = parseAnswer(result as { content: { text: string }[] });
  assert.equal((answer.cias as unknown[]).length, 1);
  assert.equal(answer.requested, "1");
});

test("cia:2 reads only $DD00-$DD0F", async () => {
  const { session, calls } = makeSession(ciaSendImpl);
  await handleCiaGetState({ cia: 2 }, session, DEPS);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]![1].readUInt16LE(1), 0xdd00);
  assert.equal(calls[0]![1].readUInt16LE(3), 0xdd0f);
});

test('cia:"2" (string form) is accepted and normalised to 2', async () => {
  const { session } = makeSession(ciaSendImpl);
  const result = await handleCiaGetState({ cia: "2" }, session, DEPS);
  const answer = parseAnswer(result as { content: { text: string }[] });
  assert.equal(answer.requested, "2");
});

test("sidefx regression guard: every call's body has length 8 and body[0] === 0x00", async () => {
  const { session, calls } = makeSession(ciaSendImpl);
  await handleCiaGetState({}, session, DEPS);
  assert.ok(calls.length >= 2);
  for (const [, body] of calls) {
    assert.equal(body.length, 8);
    assert.equal(body[0], 0x00);
  }
});

for (const bad of [0, 3, 1.5, "both"]) {
  test(`cia:${JSON.stringify(bad)} is refused naming the received value, with zero sends`, async () => {
    const { session, calls } = makeSession(ciaSendImpl);
    const result = await handleCiaGetState({ cia: bad }, session, DEPS);
    assert.equal((result as { isError: boolean }).isError, true);
    assert.match((result as { content: { text: string }[] }).content[0]!.text, new RegExp(JSON.stringify(bad).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(calls.length, 0);
  });
}

test("an unexpected key is refused naming it and listing cia, with zero sends", async () => {
  const { session, calls } = makeSession(ciaSendImpl);
  const result = await handleCiaGetState({ chip: 1 }, session, DEPS);
  assert.equal((result as { isError: boolean }).isError, true);
  const text = (result as { content: { text: string }[] }).content[0]!.text;
  assert.match(text, /chip/);
  assert.match(text, /cia/);
  assert.equal(calls.length, 0);
});

test("non-object args are refused with zero sends", async () => {
  const { session, calls } = makeSession(ciaSendImpl);
  const result = await handleCiaGetState("nope" as unknown as Record<string, unknown>, session, DEPS);
  assert.equal((result as { isError: boolean }).isError, true);
  assert.equal(calls.length, 0);
});

test("a wrong response type is refused naming memory_get", async () => {
  const { session } = makeSession(() => ({ type: "ping" as const, requestId: 1, errorCode: ErrorCode.Ok, related: [] }));
  const result = await handleCiaGetState({ cia: 1 }, session, DEPS);
  assert.equal((result as { isError: boolean }).isError, true);
  assert.match((result as { content: { text: string }[] }).content[0]!.text, /memory_get/);
});

test("a 15-byte reply is refused as a short read, naming which chip", async () => {
  const { session } = makeSession(() => memoryGetReply(new Array(15).fill(0)));
  const result = await handleCiaGetState({ cia: 2 }, session, DEPS);
  assert.equal((result as { isError: boolean }).isError, true);
  const text = (result as { content: { text: string }[] }).content[0]!.text;
  assert.match(text, /a short read is a wrong answer/);
  assert.match(text, /CIA2/);
});

test("a send() rejection on the second chip returns a converted refusal, not a partial answer", async () => {
  let callIndex = 0;
  const { session, calls } = makeSession((commandType, body) => {
    callIndex += 1;
    if (callIndex === 2) {
      throw new Error("simulated wire failure");
    }
    return ciaSendImpl(commandType, body);
  });
  const result = await handleCiaGetState({}, session, DEPS);
  assert.equal((result as { isError: boolean }).isError, true);
  assert.match((result as { content: { text: string }[] }).content[0]!.text, /vice_cia_get_state/);
  assert.equal(calls.length, 2);
});

test("the successful answer carries runState, proving stockAnswer() built it", async () => {
  const { session } = makeSession(ciaSendImpl);
  const result = await handleCiaGetState({ cia: 1 }, session, DEPS);
  const answer = parseAnswer(result as { content: { text: string }[] });
  assert.ok("runState" in answer);
});

// Sanity: CIA_LENGTH matches the fixtures used throughout this file.
test("CIA_LENGTH is 16, matching every fixture in this file", () => {
  assert.equal(CIA_LENGTH, 16);
  assert.equal(CIA1_BYTES.length, CIA_LENGTH);
  assert.equal(CIA2_BYTES.length, CIA_LENGTH);
});
