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
import { resetBankCatalogsForTest } from "./stock-memory.ts";
import type { StockConnectSession } from "./stock-connect.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";

beforeEach(() => {
  resetRunStateTrackersForTest();
  resetBankCatalogsForTest();
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

/** The catalog observed live on VICE 3.9 (05-REVIEW.md), with `io`
 * deliberately a NON-ZERO id (3) so a regression back to a hardcoded
 * bank 0x0000 cannot pass. */
function banksAvailableReply(requestId = 2) {
  return {
    type: "banks_available" as const,
    requestId,
    errorCode: ErrorCode.Ok,
    banks: [
      { id: 0, name: "default" },
      { id: 0, name: "cpu" },
      { id: 1, name: "ram" },
      { id: 2, name: "rom" },
      { id: 3, name: "io" },
      { id: 4, name: "cart" },
    ],
    related: [],
  };
}

/** Catalog with no `io` entry at all -- for the refusal case. */
function noIoBanksAvailableReply(requestId = 2) {
  return {
    type: "banks_available" as const,
    requestId,
    errorCode: ErrorCode.Ok,
    banks: [
      { id: 0, name: "default" },
      { id: 1, name: "ram" },
    ],
    related: [],
  };
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
//   ddrA=0xff, ddrB=0x00 -- WR-02: ddrA=0xff means this fixture is, by the
//     confounded condition itself, a confounded reading; see the WR-02 test
//     group below and the two joystick decode tests above, which assert
//     confounded:true rather than deepEqual-ing a plain joystick shape.
//   timerA=0x1234 (bytes 0x34,0x12), timerB=0x5678 (bytes 0x78,0x56)
//   TOD: tenths=5, seconds=0x42(BCD 42), minutes=0x59(BCD 59), hours=0x91
//     (BCD 11, bit7 set -> PM) -- WR-03: this replaces the previous coincidence
//     fixture, whose masked low nibble was NOT valid BCD and only decoded to
//     11 by luck under the old, unvalidated formula.
//   SDR=0xa5
//   ICR=0b10000011 (timer A + timer B underflow, interruptGenerated)
//   CRA=0b10000001 (started, TOD 50Hz)
//   CRB=0b01000000 (countSource 2 -- "timer a underflows")
const CIA1_BYTES = [0xef, 0xfe, 0xff, 0x00, 0x34, 0x12, 0x78, 0x56, 0x05, 0x42, 0x59, 0x91, 0xa5, 0x83, 0x81, 0x40];

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
  const joystick2 = (decoded.portA as Record<string, unknown>).joystick2 as Record<string, unknown>;
  assert.equal(joystick2.up, false);
  assert.equal(joystick2.down, false);
  assert.equal(joystick2.left, false);
  assert.equal(joystick2.right, false);
  assert.equal(joystick2.fire, true);
  // CIA1_BYTES' ddrA is 0xff (all port A pins configured as outputs), so
  // this fixture is, by WR-02's own condition, a confounded reading -- the
  // five booleans above are annotated, not altered.
  assert.equal(joystick2.confounded, true);
  assert.ok(typeof joystick2.confoundedReason === "string" && joystick2.confoundedReason.length > 0);
});

test("CIA1 portB.joystick1.up is true, the other four false", () => {
  const decoded = decodeCia(1, new Uint8Array(CIA1_BYTES));
  const joystick1 = (decoded.portB as Record<string, unknown>).joystick1 as Record<string, boolean>;
  assert.equal(joystick1.up, true);
  assert.equal(joystick1.down, false);
  assert.equal(joystick1.left, false);
  assert.equal(joystick1.right, false);
  assert.equal(joystick1.fire, false);
  // Same CIA1_BYTES fixture (ddrA=0xff) -- portB.joystick1 shares the same
  // confounded condition as portA.joystick2 above (both are CIA1, keyed off
  // the same DDRA byte, WR-02).
  assert.equal(joystick1.confounded, true);
});

// ---------------------------------------------------------------------------
// WR-02/WR-03 -- CIA1 joystick fields are annotated `confounded` when a
// direction bit that reads LOW could be something other than a pressed
// direction; CIA2 is never confounded (it has no joystick fields at all).
//
// WR-03 (re-review): the flag is PER READ ACTUAL and PER BIT. The original
// predicate was `DDRA !== 0x00`, true on every booted C64 (the KERNAL leaves
// DDRA = $FF), so it could not discriminate. These cases pin the new
// semantics: a HIGH bit is never confounded; a LOW bit is confounded when its
// own pin drives low, or when the OTHER port is driving a matrix line low.
// ---------------------------------------------------------------------------

/** Clones a fixture, overriding byte offset 0x02 (DDRA/portADirection). */
function withDdrA(bytes: number[], ddrA: number): number[] {
  const clone = [...bytes];
  clone[0x02] = ddrA;
  return clone;
}

/** Clones a fixture, overriding any of the four port/DDR bytes
 * (PRA/PRB/DDRA/DDRB at offsets 0x00-0x03) -- the whole input to the
 * confounded predicate in one helper. */
function withPorts(bytes: number[], overrides: { pra?: number; prb?: number; ddra?: number; ddrb?: number }): number[] {
  const clone = [...bytes];
  if (overrides.pra !== undefined) clone[0x00] = overrides.pra;
  if (overrides.prb !== undefined) clone[0x01] = overrides.prb;
  if (overrides.ddra !== undefined) clone[0x02] = overrides.ddra;
  if (overrides.ddrb !== undefined) clone[0x03] = overrides.ddrb;
  return clone;
}

function joysticks(bytes: number[]): { j2: Record<string, unknown>; j1: Record<string, unknown>; notes: string[] } {
  const decoded = decodeCia(1, new Uint8Array(bytes));
  return {
    j2: (decoded.portA as Record<string, unknown>).joystick2 as Record<string, unknown>,
    j1: (decoded.portB as Record<string, unknown>).joystick1 as Record<string, unknown>,
    notes: decoded.notes as string[],
  };
}

test("WR-02 not confounded: CIA1 with ddrA=0x00 -- confounded false on both joysticks, notes empty", () => {
  const decoded = decodeCia(1, new Uint8Array(withDdrA(CIA1_BYTES, 0x00)));
  const joystick2 = (decoded.portA as Record<string, unknown>).joystick2 as Record<string, unknown>;
  const joystick1 = (decoded.portB as Record<string, unknown>).joystick1 as Record<string, unknown>;
  assert.equal(joystick2.confounded, false);
  assert.equal(joystick1.confounded, false);
  assert.deepEqual(joystick2.confoundedDirections, []);
  assert.deepEqual(joystick1.confoundedDirections, []);
  assert.ok(!("confoundedReason" in joystick2), "confoundedReason must be absent when not confounded");
  assert.ok(!("confoundedReason" in joystick1), "confoundedReason must be absent when not confounded");
  assert.deepEqual(decoded.notes, []);
});

test("WR-02 confounded: CIA1 with ddrA=0xff -- confounded true on both joysticks, reason names $DC00/$DC01, direction booleans unchanged", () => {
  const notConfounded = decodeCia(1, new Uint8Array(withDdrA(CIA1_BYTES, 0x00)));
  const confounded = decodeCia(1, new Uint8Array(withDdrA(CIA1_BYTES, 0xff)));
  const j2NotConfounded = (notConfounded.portA as Record<string, unknown>).joystick2 as Record<string, unknown>;
  const j2 = (confounded.portA as Record<string, unknown>).joystick2 as Record<string, unknown>;
  const j1NotConfounded = (notConfounded.portB as Record<string, unknown>).joystick1 as Record<string, unknown>;
  const j1 = (confounded.portB as Record<string, unknown>).joystick1 as Record<string, unknown>;

  assert.equal(j2.confounded, true);
  assert.equal(j1.confounded, true);
  for (const holder of [j2, j1]) {
    const reason = holder.confoundedReason;
    assert.ok(typeof reason === "string" && reason.length >= 80, "confoundedReason must be a substantial string");
    assert.match(reason as string, /\$DC00/);
    assert.match(reason as string, /\$DC01/);
  }

  // The five direction booleans are annotated, never altered, by the
  // confounded flag.
  for (const key of ["up", "down", "left", "right", "fire"] as const) {
    assert.equal(j2[key], j2NotConfounded[key], `joystick2.${key} must be unchanged by confounded`);
    assert.equal(j1[key], j1NotConfounded[key], `joystick1.${key} must be unchanged by confounded`);
  }

  assert.equal((confounded.notes as string[]).length, 1);
});

test("WR-03: DDRA=$ff with PRA=$ff is CLEAN -- every direction reads HIGH, so nothing can be a phantom press", () => {
  const { j2, j1, notes } = joysticks(withPorts(CIA1_BYTES, { pra: 0xff, prb: 0xff, ddra: 0xff, ddrb: 0x00 }));
  assert.equal(j2.confounded, false, "a read whose direction bits are all high cannot be confounded, whatever DDRA says");
  assert.equal(j1.confounded, false);
  assert.deepEqual(j2.confoundedDirections, []);
  assert.deepEqual(j1.confoundedDirections, []);
  assert.deepEqual(notes, []);
});

test("WR-03: DDRA=$ff with PRA=$fe is CONFOUNDED on exactly one direction -- up, the single driven-low pin", () => {
  const { j2, j1 } = joysticks(withPorts(CIA1_BYTES, { pra: 0xfe, prb: 0xff, ddra: 0xff, ddrb: 0x00 }));
  assert.equal(j2.up, true, "the boolean is annotated, never altered");
  assert.equal(j2.confounded, true);
  assert.deepEqual(j2.confoundedDirections, ["up"], "only the low bit is suspect -- the other four read high");
  assert.match(j2.confoundedReason as string, /up/);
  // Port B's own directions all read high, so nothing there is suspect even
  // though port A is driving a column low.
  assert.equal(j1.confounded, false);
  assert.deepEqual(j1.confoundedDirections, []);
});

test("WR-03 the live booted-machine sample: $DC00=0x7F with DDRA=$ff is reported CLEAN on both joysticks", () => {
  // The bytes the reviewer read off a freshly-booted /usr/bin/x64sc:
  // 7f ff ff 00 67 1f ff ff 00 00 00 01 00 00 01 08.
  const live = [0x7f, 0xff, 0xff, 0x00, 0x67, 0x1f, 0xff, 0xff, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x01, 0x08];
  const { j2, j1, notes } = joysticks(live);
  // Only bit 7 (a column line) is low; bits 0-4 all read high.
  assert.equal(j2.confounded, false, "the flag must discriminate -- this is an unambiguous nothing-pressed read");
  assert.equal(j1.confounded, false);
  for (const key of ["up", "down", "left", "right", "fire"] as const) {
    assert.equal(j2[key], false);
    assert.equal(j1[key], false);
  }
  assert.deepEqual(notes, []);
});

test("WR-03: a direction whose own pin is an INPUT and reads low is genuine -- DDRA=0x01 does not confound the fire bit", () => {
  // CIA1_BYTES: PRA=0xef (bit 4 low -> fire). DDRA=0x01 drives bit 0 only,
  // and bit 0 reads HIGH, so nothing is being driven low at all.
  const { j2 } = joysticks(withDdrA(CIA1_BYTES, 0x01));
  assert.equal(j2.fire, true);
  assert.equal(j2.confounded, false, "an input pin reading low is a genuine press");
  assert.deepEqual(j2.confoundedDirections, []);
});

test("WR-03: DDRA=0x10 DOES confound the fire bit -- the same low bit, now on a driven output pin", () => {
  const { j2 } = joysticks(withDdrA(CIA1_BYTES, 0x10));
  assert.equal(j2.fire, true);
  assert.equal(j2.confounded, true);
  assert.deepEqual(j2.confoundedDirections, ["fire"]);
});

test("WR-03: joystick1 consults DDRB, not DDRA -- DDRA=$00 with DDRB=$f0 driving the fire pin low confounds joystick1 only", () => {
  const { j2, j1 } = joysticks(withPorts(CIA1_BYTES, { pra: 0xff, prb: 0xef, ddra: 0x00, ddrb: 0xf0 }));
  assert.equal(j1.fire, true);
  assert.equal(j1.confounded, true, "port B's own DDR must be consulted for joystick1 -- the old predicate only ever read DDRA");
  assert.deepEqual(j1.confoundedDirections, ["fire"]);
  assert.match(j1.confoundedReason as string, /DDRB \(\$DC03 = 0xf0\)/);
  // Port A reads all-high and drives nothing, so joystick2 stays clean.
  assert.equal(j2.confounded, false);
});

test("WR-03 the cross-port path: a port A column driven low makes port B's LOW bits suspect (a pressed key could short them)", () => {
  // DDRA=$ff, PRA=$7f -> column 7 driven low. Port B is all inputs, but its
  // bit 0 reads low: that could be joystick 1 up, or the key at that column.
  const { j1, j2 } = joysticks(withPorts(CIA1_BYTES, { pra: 0x7f, prb: 0xfe, ddra: 0xff, ddrb: 0x00 }));
  assert.equal(j1.up, true);
  assert.equal(j1.confounded, true);
  assert.deepEqual(j1.confoundedDirections, ["up"]);
  assert.match(j1.confoundedReason as string, /pressed KEY/);
  // The same read with NO column driven low is genuine -- the control that
  // proves the cross-port term, not the low bit, is doing the work.
  const clean = joysticks(withPorts(CIA1_BYTES, { pra: 0x7f, prb: 0xfe, ddra: 0x00, ddrb: 0x00 }));
  assert.equal(clean.j1.up, true);
  assert.equal(clean.j1.confounded, false);
  assert.equal(j2.confounded, false, "port A's own low bit is bit 7, outside the five direction bits");
});

test("WR-03: the chip-level note names the suspect directions per joystick, and is absent when nothing is suspect", () => {
  const suspect = joysticks(withPorts(CIA1_BYTES, { pra: 0xfe, prb: 0xfd, ddra: 0xff, ddrb: 0xff }));
  assert.equal(suspect.notes.length, 1);
  assert.match(suspect.notes[0]!, /joystick 2: up/);
  assert.match(suspect.notes[0]!, /joystick 1: down/);
  const clean = joysticks(withPorts(CIA1_BYTES, { pra: 0xff, prb: 0xff, ddra: 0xff, ddrb: 0xff }));
  assert.deepEqual(clean.notes, []);
});

test("WR-03 non-vacuity: the flag genuinely discriminates -- it is false for some realistic reads and true for others", () => {
  const cases = [
    { name: "booted, nothing pressed", bytes: withPorts(CIA1_BYTES, { pra: 0x7f, prb: 0xff, ddra: 0xff, ddrb: 0x00 }), expected: false },
    { name: "no scan, fire pressed", bytes: withPorts(CIA1_BYTES, { pra: 0xef, prb: 0xff, ddra: 0x00, ddrb: 0x00 }), expected: false },
    { name: "fire pin driven low", bytes: withPorts(CIA1_BYTES, { pra: 0xef, prb: 0xff, ddra: 0x10, ddrb: 0x00 }), expected: true },
  ] as const;
  for (const { name, bytes, expected } of cases) {
    assert.equal(joysticks(bytes).j2.confounded, expected, `joystick2.confounded for "${name}"`);
  }
});

test("WR-02: CIA2 is never confounded -- no joystick1/joystick2 keys at all, notes empty", () => {
  const decoded = decodeCia(2, new Uint8Array(withDdrA(CIA2_BYTES, 0xff)));
  const portA = decoded.portA as Record<string, unknown>;
  const portB = decoded.portB as Record<string, unknown>;
  assert.ok(!("joystick2" in portA));
  assert.ok(!("joystick1" in portB));
  assert.deepEqual(decoded.notes, []);
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
  assert.deepEqual(tod.invalidBcd, []);
});

// ---------------------------------------------------------------------------
// WR-03 -- fromBcd() never invents a decimal from a non-BCD byte; the tod
// object omits the field and names it in invalidBcd instead, with rawHex
// always present. A dedicated helper builds fixtures with TOD bytes
// overridden, distinct from CIA1_BYTES's own valid 0x91 hours byte.
// ---------------------------------------------------------------------------

/** Clones a fixture, overriding the TOD tenths/seconds/minutes/hours bytes
 * (offsets 0x08/0x09/0x0a/0x0b) that are omitted from the override object. */
function withTod(
  bytes: number[],
  overrides: { tenths?: number; seconds?: number; minutes?: number; hours?: number },
): number[] {
  const clone = [...bytes];
  if (overrides.tenths !== undefined) clone[0x08] = overrides.tenths;
  if (overrides.seconds !== undefined) clone[0x09] = overrides.seconds;
  if (overrides.minutes !== undefined) clone[0x0a] = overrides.minutes;
  if (overrides.hours !== undefined) clone[0x0b] = overrides.hours;
  return clone;
}

// CR-01 (re-review) -- tenths is the fourth TOD field, and it goes through the
// SAME fromBcd()/omit/invalidBcd path as its three siblings. Before this fix it
// reported `todTenthsRaw & 0x0f` raw, so 0x0f became an impossible `tenths: 15`
// with an empty invalidBcd and no note.

test("CR-01: an invalid tenths byte (0x0f) omits tod.tenths, lists it in invalidBcd, keeps rawHex, and notes $DC08", () => {
  const decoded = decodeCia(1, new Uint8Array(withTod(CIA1_BYTES, { tenths: 0x0f })));
  const tod = decoded.tod as Record<string, unknown>;
  assert.ok(!("tenths" in tod), "tod.tenths must be omitted, never the fabricated 15");
  assert.deepEqual(tod.invalidBcd, ["tenths"]);
  assert.match(tod.rawHex as string, /^0f/);
  const notes = decoded.notes as string[];
  assert.ok(notes.some((n) => n.includes("$DC08") && n.includes("0f")), "notes must name $DC08 and the raw byte 0f");
});

test("CR-01: every low nibble 0x0a-0x0f is refused and 0x00-0x09 decode straight through", () => {
  for (let nibble = 0x0a; nibble <= 0x0f; nibble += 1) {
    const tod = decodeCia(1, new Uint8Array(withTod(CIA1_BYTES, { tenths: nibble }))).tod as Record<string, unknown>;
    assert.ok(!("tenths" in tod), `tenths must be omitted for a low nibble of 0x${nibble.toString(16)}`);
    assert.deepEqual(tod.invalidBcd, ["tenths"]);
  }
  for (let nibble = 0x00; nibble <= 0x09; nibble += 1) {
    const tod = decodeCia(1, new Uint8Array(withTod(CIA1_BYTES, { tenths: nibble }))).tod as Record<string, unknown>;
    assert.equal(tod.tenths, nibble);
    assert.deepEqual(tod.invalidBcd, []);
  }
});

test("CR-01: the unused high nibble of $xx08 never invalidates tenths -- 0xf5 still decodes to 5", () => {
  const tod = decodeCia(1, new Uint8Array(withTod(CIA1_BYTES, { tenths: 0xf5 }))).tod as Record<string, unknown>;
  assert.equal(tod.tenths, 5);
  assert.deepEqual(tod.invalidBcd, []);
});

test("CR-01: invalidBcd lists all four names in register order tenths/seconds/minutes/hours", () => {
  const decoded = decodeCia(
    1,
    new Uint8Array(withTod(CIA1_BYTES, { tenths: 0x0c, seconds: 0x9f, minutes: 0xaa, hours: 0x1b })),
  );
  const tod = decoded.tod as Record<string, unknown>;
  assert.deepEqual(tod.invalidBcd, ["tenths", "seconds", "minutes", "hours"]);
  // pm and rawHex survive every refusal -- they are the caller's escape hatch.
  assert.equal(tod.pm, false);
  assert.equal(tod.rawHex, "0c9faa1b");
});

test("WR-03: hours byte 0x91 decodes to 11 PM (tens digit genuinely exercised)", () => {
  const decoded = decodeCia(1, new Uint8Array(withTod(CIA1_BYTES, { hours: 0x91 })));
  const tod = decoded.tod as Record<string, unknown>;
  assert.equal(tod.hours, 11);
  assert.equal(tod.pm, true);
  assert.deepEqual(tod.invalidBcd, []);
});

test("WR-03: hours byte 0x12 decodes to 12 AM (a different tens digit than 0x91)", () => {
  const decoded = decodeCia(1, new Uint8Array(withTod(CIA1_BYTES, { hours: 0x12 })));
  const tod = decoded.tod as Record<string, unknown>;
  assert.equal(tod.hours, 12);
  assert.equal(tod.pm, false);
  assert.deepEqual(tod.invalidBcd, []);
});

test("WR-03: an invalid seconds byte (0x9f) omits tod.seconds, lists it in invalidBcd, keeps rawHex, and notes $DC09", () => {
  const decoded = decodeCia(1, new Uint8Array(withTod(CIA1_BYTES, { seconds: 0x9f })));
  const tod = decoded.tod as Record<string, unknown>;
  assert.ok(!("seconds" in tod), "tod.seconds must be omitted, never a fabricated number");
  assert.deepEqual(tod.invalidBcd, ["seconds"]);
  assert.match(tod.rawHex as string, /9f/);
  const notes = decoded.notes as string[];
  assert.ok(notes.some((n) => n.includes("$DC09") && n.includes("9f")), "notes must name $DC09 and the raw byte 9f");
});

test("WR-03: an invalid minutes byte (0xaa) omits tod.minutes and lists it in invalidBcd", () => {
  const decoded = decodeCia(1, new Uint8Array(withTod(CIA1_BYTES, { minutes: 0xaa })));
  const tod = decoded.tod as Record<string, unknown>;
  assert.ok(!("minutes" in tod));
  assert.deepEqual(tod.invalidBcd, ["minutes"]);
  const notes = decoded.notes as string[];
  assert.ok(notes.some((n) => n.includes("$DC0A") && n.includes("aa")));
});

test("WR-03: an hours byte whose masked low nibble is 0xb (e.g. 0x1b) omits tod.hours and lists it in invalidBcd", () => {
  const decoded = decodeCia(1, new Uint8Array(withTod(CIA1_BYTES, { hours: 0x1b })));
  const tod = decoded.tod as Record<string, unknown>;
  assert.ok(!("hours" in tod));
  assert.deepEqual(tod.invalidBcd, ["hours"]);
  const notes = decoded.notes as string[];
  assert.ok(notes.some((n) => n.includes("$DC0B") && n.includes("1b")));
});

test("WR-03: two invalid TOD bytes list both names in invalidBcd, in the fixed order seconds/minutes/hours", () => {
  const decoded = decodeCia(1, new Uint8Array(withTod(CIA1_BYTES, { seconds: 0x9f, minutes: 0xaa })));
  const tod = decoded.tod as Record<string, unknown>;
  assert.deepEqual(tod.invalidBcd, ["seconds", "minutes"]);
});

test("WR-03: fromBcd's behaviour asserted through decodeCia's tod object -- valid and invalid bytes", () => {
  const valid42 = decodeCia(1, new Uint8Array(withTod(CIA1_BYTES, { seconds: 0x42 })));
  assert.equal((valid42.tod as Record<string, unknown>).seconds, 42);

  const valid00 = decodeCia(1, new Uint8Array(withTod(CIA1_BYTES, { seconds: 0x00 })));
  assert.equal((valid00.tod as Record<string, unknown>).seconds, 0);

  const valid99 = decodeCia(1, new Uint8Array(withTod(CIA1_BYTES, { seconds: 0x99 })));
  assert.equal((valid99.tod as Record<string, unknown>).seconds, 99);

  const invalid9f = decodeCia(1, new Uint8Array(withTod(CIA1_BYTES, { seconds: 0x9f })));
  assert.ok(!("seconds" in (invalid9f.tod as Record<string, unknown>)));

  const invalidA0 = decodeCia(1, new Uint8Array(withTod(CIA1_BYTES, { seconds: 0xa0 })));
  assert.ok(!("seconds" in (invalidA0.tod as Record<string, unknown>)));
});

test("WR-03: every fixture's decoded tod.seconds/minutes/hours (when present) is within its valid range", () => {
  const fixtures = [new Uint8Array(CIA1_BYTES), new Uint8Array(CIA2_BYTES)];
  for (const bytes of fixtures) {
    for (const chip of [1, 2] as const) {
      const tod = decodeCia(chip, bytes).tod as Record<string, unknown>;
      if ("seconds" in tod) assert.ok((tod.seconds as number) >= 0 && (tod.seconds as number) <= 59);
      if ("minutes" in tod) assert.ok((tod.minutes as number) >= 0 && (tod.minutes as number) <= 59);
      if ("hours" in tod) assert.ok((tod.hours as number) >= 0 && (tod.hours as number) <= 12);
    }
  }
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
  if (commandType === CommandType.BanksAvailable) {
    return banksAvailableReply();
  }
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
  const memGetCalls = calls.filter(([commandType]) => commandType === CommandType.MemoryGet);
  assert.equal(memGetCalls.length, 2);
  assert.equal(memGetCalls[0]![1].readUInt16LE(1), 0xdc00);
  assert.equal(memGetCalls[0]![1].readUInt16LE(3), 0xdc0f);
  assert.equal(memGetCalls[1]![1].readUInt16LE(1), 0xdd00);
  assert.equal(memGetCalls[1]![1].readUInt16LE(3), 0xdd0f);
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
  assert.equal(calls.filter(([commandType]) => commandType === CommandType.MemoryGet).length, 1);
  const answer = parseAnswer(result as { content: { text: string }[] });
  assert.equal((answer.cias as unknown[]).length, 1);
  assert.equal(answer.requested, "1");
});

test("cia:2 reads only $DD00-$DD0F", async () => {
  const { session, calls } = makeSession(ciaSendImpl);
  await handleCiaGetState({ cia: 2 }, session, DEPS);
  const memGetCalls = calls.filter(([commandType]) => commandType === CommandType.MemoryGet);
  assert.equal(memGetCalls.length, 1);
  assert.equal(memGetCalls[0]![1].readUInt16LE(1), 0xdd00);
  assert.equal(memGetCalls[0]![1].readUInt16LE(3), 0xdd0f);
});

test('cia:"2" (string form) is accepted and normalised to 2', async () => {
  const { session } = makeSession(ciaSendImpl);
  const result = await handleCiaGetState({ cia: "2" }, session, DEPS);
  const answer = parseAnswer(result as { content: { text: string }[] });
  assert.equal(answer.requested, "2");
});

test("sidefx regression guard: every MemoryGet call's body has length 8 and body[0] === 0x00", async () => {
  const { session, calls } = makeSession(ciaSendImpl);
  await handleCiaGetState({}, session, DEPS);
  const memGetCalls = calls.filter(([commandType]) => commandType === CommandType.MemoryGet);
  assert.ok(memGetCalls.length >= 2);
  for (const [, body] of memGetCalls) {
    assert.equal(body.length, 8);
    assert.equal(body[0], 0x00);
  }
});

// ---------------------------------------------------------------------------
// CR-01 (05-09) -- io bank resolution wired into handleCiaGetState.
// ---------------------------------------------------------------------------

test("handleCiaGetState: every MemoryGet call's wire body bank field (offset 6) carries the resolved io id, not 0", async () => {
  const { session, calls } = makeSession(ciaSendImpl);
  await handleCiaGetState({}, session, DEPS);
  const memGetCalls = calls.filter(([commandType]) => commandType === CommandType.MemoryGet);
  assert.equal(memGetCalls.length, 2);
  for (const [, body] of memGetCalls) {
    assert.equal(body.readUInt16LE(6), 3);
    assert.notEqual(body.readUInt16LE(6), 0);
  }
});

test("handleCiaGetState: a both-chips call sends exactly one BanksAvailable and two MemoryGet", async () => {
  const { session, calls } = makeSession(ciaSendImpl);
  await handleCiaGetState({}, session, DEPS);
  assert.equal(calls.filter(([commandType]) => commandType === CommandType.BanksAvailable).length, 1);
  assert.equal(calls.filter(([commandType]) => commandType === CommandType.MemoryGet).length, 2);
});

test('handleCiaGetState: the answer\'s top-level bank deep-equals { id: 3, name: "io" }', async () => {
  const { session } = makeSession(ciaSendImpl);
  const result = await handleCiaGetState({ cia: 1 }, session, DEPS);
  const answer = parseAnswer(result as { content: { text: string }[] });
  assert.deepEqual(answer.bank, { id: 3, name: "io" });
});

test("handleCiaGetState: a catalog with no io bank refuses, naming the reported banks, and sends zero MemoryGet", async () => {
  const { session, calls } = makeSession((commandType, body) => (commandType === CommandType.BanksAvailable ? noIoBanksAvailableReply() : ciaSendImpl(commandType, body)));
  const result = await handleCiaGetState({}, session, DEPS);
  assert.equal((result as { isError: boolean }).isError, true);
  const text = (result as { content: { text: string }[] }).content[0]!.text;
  assert.match(text, /default/);
  assert.match(text, /ram/);
  assert.ok(!calls.some(([commandType]) => commandType === CommandType.MemoryGet));
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
  const { session } = makeSession((commandType) =>
    commandType === CommandType.BanksAvailable ? banksAvailableReply() : { type: "ping" as const, requestId: 1, errorCode: ErrorCode.Ok, related: [] },
  );
  const result = await handleCiaGetState({ cia: 1 }, session, DEPS);
  assert.equal((result as { isError: boolean }).isError, true);
  assert.match((result as { content: { text: string }[] }).content[0]!.text, /memory_get/);
});

test("a 15-byte reply is refused as a short read, naming which chip", async () => {
  const { session } = makeSession((commandType) => (commandType === CommandType.BanksAvailable ? banksAvailableReply() : memoryGetReply(new Array(15).fill(0))));
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
