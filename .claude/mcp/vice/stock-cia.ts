#!/usr/bin/env node
// stock-cia.ts
//
// vice_cia_get_state -- a DERIVED tool (DERIV-05): its answer is computed
// CLIENT-SIDE by decoding the bytes one MEM_GET per CIA returns, never
// answered by a binary-monitor opcode -- the monitor has no CIA command at
// all. Registered through withDerivedTool("vice_cia_get_state",
// { needsSession: true }, handleCiaGetState) in stock-dispatch.ts, never
// withStockSession(). This is stock-vicii.ts's sibling, not a second
// template -- both follow the exact same "one sidefx:false MEM_GET, decode
// client-side, wrap unreadable fields" shape.
//
// WHY THIS FILE EXISTS: DERIV-05's other half. The CIA is the sharpest case
// of "the register map is not the chip" in this whole project: THREE of its
// address ranges mean DIFFERENT things on read than on write --
// $xx04-$xx07 (timer current count vs. latch), $xx0D (interrupt status vs.
// enable mask), $xx08-$xx0B (current TOD vs. alarm, while CRB bit 7 is set).
// A naive decoder that reports only the read side under an ambiguous name
// leaves the caller believing it has the write side. plan_decision_D-05-11
// (05-04-PLAN.md) is the binding form of the fix: the readable side is named
// for what it actually is (`timerA.current`, `interruptStatus`, `tod`), and
// the write side is a SEPARATE, explicit `{ available: false, reason }`
// field naming the sharing address.
//
// Bit-field names below were transcribed ONCE from
// `.claude/skills/c64-memory-mapping/memmap.json`'s entries for $DC00,
// $DC01, $DC02, $DC03, $DC08-$DC0F, $DD00, $DD01 and $DD0D, and
// cross-checked at write time -- the same "committed literal, cross-checked
// once, no automated drift check" posture Phase 4's D-06 already accepted
// for the disassembler's opcode table.
//
// TWO CLARIFICATIONS THAT ARE OTHERWISE EASY TO GET WRONG:
//   - Port A/B bits are ACTIVE-LOW for joysticks and the keyboard matrix: a
//     CLEAR bit means pressed. Every joystick field below is computed as
//     `((raw >> bit) & 1) === 0` -- do not "fix" this polarity later.
//   - This is NOT a keyboard-matrix read. $DC00/$DC01 expose only the
//     current column selection and row result; the full matrix is
//     `vice_keyboard_matrix`, which is provably unrecoverable on stock
//     (`docs/stock-vice-parity.md` SS A item 2) and is Phase 8's business.
//
// WHAT NOT TO DO:
//   - Never import hostpath.ts or vice-proxy.ts -- this tool takes no path
//     argument at all; the host-facing surface is empty by construction
//     (hostpath-consumers.test.ts's closed five-member consumer list must
//     stay exactly five).
//   - Never turn the MEM_GET body's side-effect flag on. `sidefx` is
//     hardcoded `false` below with NO argument to override it, because
//     $DC0D/$DD0D clear their interrupt-status bits ON READ in hardware --
//     reading them wrongly would destroy pending interrupt flags the
//     running program has not yet serviced. This is a sharper case than
//     VIC-II's $D01E/$D01F: those clear stale collision data, this clears
//     an interrupt the program was about to service.
//   - Never issue an unrequested resume (Phase 3 D-05) -- this handler
//     sends MEM_GET and nothing else. `runState` on the answer (via
//     stockAnswer()) reports the halt honestly.
//   - Never build the answer outside stockAnswer() (D-06).
//   - Never re-derive address/byte-count parsing locally (D-04) -- this
//     module has no address argument to parse (`cia` is validated as an
//     explicit 1-or-2 literal, not a byte count or address), but every
//     other family module's discipline still applies: no local regex.
//   - Never report an unavailable field as `0` or omit it. The five
//     write-side/internal fields below are rendered from
//     CIA_UNAVAILABLE_FIELDS, never as five hand-written literals.
import { CommandType, memGetBody } from "./stock-protocol.ts";
import { convertWireError, isErrorText, stockAnswer, type StockSessionHandler } from "./stock-handler.ts";

/** True iff `value` is a well-formed, generic JSON object -- not null, not
 * an array. Matches this module tree's own isPlainObject() convention
 * (stock-memory.ts, stock-disassemble.ts et al.). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const CIA1_BASE = 0xdc00;
export const CIA2_BASE = 0xdd00;
export const CIA_LENGTH = 0x10;

/**
 * The five fields no `MEM_GET` on stock can ever recover, in this fixed
 * order (a regression test pins this exact order and these exact names).
 * Each reason names the SHARING address and what the read side actually
 * returns -- see this plan's `plan_decision_D-05-11` for why this shape
 * (readable half named for what it is, unreadable half a distinct explicit
 * field) rather than silently reporting the read side under an ambiguous
 * name.
 */
export const CIA_UNAVAILABLE_FIELDS: ReadonlyArray<readonly [string, string]> = Object.freeze([
  [
    "timerALatch",
    "the timer A start value written behind $xx04/$xx05 -- reading those two addresses returns the timer's CURRENT counter (available as timerA.current), and the binary monitor has no CIA command that exposes the latch itself.",
  ],
  [
    "timerBLatch",
    "the timer B start value written behind $xx06/$xx07 -- reading those two addresses returns the timer's CURRENT counter (available as timerB.current), and the binary monitor has no CIA command that exposes the latch itself.",
  ],
  [
    "interruptEnableMask",
    "the interrupt-enable mask written to $xx0D -- a READ of $xx0D returns the interrupt STATUS flags (available as interruptStatus), not the mask, so the two halves of that one address are genuinely different data.",
  ],
  [
    "todAlarmTime",
    "the TOD alarm written behind $xx08-$xx0B while CRB bit 7 is set -- reading those addresses always returns the current time of day (available as tod), never the alarm, regardless of CRB's state.",
  ],
  [
    "todLatchState",
    "the internal TOD read-latch / halt flip-flop that freezes the TOD registers on a $xx08 read until $xx0B is read back -- not exposed anywhere in the memory-mapped register map at all.",
  ],
]);

/** Converts one BCD-encoded byte (e.g. `$42`) to its decimal value (`42`).
 * Used for TOD seconds/minutes/hours -- a raw-byte pass-through would give
 * `0x42 = 66`, which is exactly the bug this helper exists to prevent. */
function fromBcd(raw: number): number {
  return ((raw >> 4) & 0x0f) * 10 + (raw & 0x0f);
}

function bit(byte: number, n: number): number {
  return (byte >> n) & 1;
}

/** Active-low read: a CLEAR bit means the line is asserted (joystick
 * pressed). See this module's header comment -- never "fix" this to `=== 1`. */
function activeLow(byte: number, n: number): boolean {
  return bit(byte, n) === 0;
}

function boolBit(byte: number, n: number): boolean {
  return bit(byte, n) === 1;
}

const COUNT_SOURCE_MEANING: Readonly<Record<number, string>> = {
  0: "system cycles",
  1: "cnt pin positive edges",
  2: "timer a underflows",
  3: "timer a underflows with cnt high",
};

/**
 * Pure per-chip decoder. Takes exactly 16 bytes (the chip's full register
 * block, $xx00-$xx0F) and returns every readable field named for what it
 * actually is, plus the five unavailable write-side/internal fields wrapped
 * as `{ available: false, reason }`. Throws a plain `Error` on any length
 * other than 16 -- never silently pads or truncates.
 */
export function decodeCia(chip: 1 | 2, bytes: Uint8Array): Record<string, unknown> {
  if (bytes.length !== CIA_LENGTH) {
    throw new Error(`decodeCia: expected exactly ${CIA_LENGTH} bytes, got ${bytes.length}`);
  }

  const base = chip === 1 ? CIA1_BASE : CIA2_BASE;
  const registersHex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const portARaw = bytes[0x00]!;
  const portA: Record<string, unknown> = { raw: portARaw };
  if (chip === 1) {
    portA.joystick2 = {
      up: activeLow(portARaw, 0),
      down: activeLow(portARaw, 1),
      left: activeLow(portARaw, 2),
      right: activeLow(portARaw, 3),
      fire: activeLow(portARaw, 4),
    };
  } else {
    // $DD00 bits 0-1 are the VIC bank number, INVERTED: %00=bank3, %01=bank2,
    // %10=bank1, %11=bank0 -- the same `3 - (raw & 3)` form
    // dump-artifacts.mjs's own verified vicBank() uses.
    const vicBank = 3 - (portARaw & 3);
    portA.vicBank = vicBank;
    portA.vicBankBase = vicBank * 16384;
    portA.rs232Txd = boolBit(portARaw, 2);
    portA.serialAtnOut = boolBit(portARaw, 3);
    portA.serialClockOut = boolBit(portARaw, 4);
    portA.serialDataOut = boolBit(portARaw, 5);
    portA.serialClockIn = boolBit(portARaw, 6);
    portA.serialDataIn = boolBit(portARaw, 7);
  }

  const portBRaw = bytes[0x01]!;
  const portB: Record<string, unknown> = { raw: portBRaw };
  if (chip === 1) {
    portB.joystick1 = {
      up: activeLow(portBRaw, 0),
      down: activeLow(portBRaw, 1),
      left: activeLow(portBRaw, 2),
      right: activeLow(portBRaw, 3),
      fire: activeLow(portBRaw, 4),
    };
  } else {
    portB.rs232Rxd = boolBit(portBRaw, 0);
    portB.ri = boolBit(portBRaw, 3);
    portB.dcd = boolBit(portBRaw, 4);
    portB.userPortH = boolBit(portBRaw, 5);
    portB.cts = boolBit(portBRaw, 6);
    portB.dsr = boolBit(portBRaw, 7);
  }

  function directionOutputs(raw: number): boolean[] {
    const outputs: boolean[] = [];
    for (let n = 0; n < 8; n += 1) {
      outputs.push(boolBit(raw, n));
    }
    return outputs;
  }

  const portADirectionRaw = bytes[0x02]!;
  const portADirection = { raw: portADirectionRaw, outputs: directionOutputs(portADirectionRaw) };

  const portBDirectionRaw = bytes[0x03]!;
  const portBDirection = { raw: portBDirectionRaw, outputs: directionOutputs(portBDirectionRaw) };

  const timerA = { current: bytes[0x04]! | (bytes[0x05]! << 8) };
  const timerB = { current: bytes[0x06]! | (bytes[0x07]! << 8) };

  const todTenthsRaw = bytes[0x08]!;
  const todSecondsRaw = bytes[0x09]!;
  const todMinutesRaw = bytes[0x0a]!;
  const todHoursRaw = bytes[0x0b]!;
  const tod = {
    tenths: todTenthsRaw & 0x0f,
    seconds: fromBcd(todSecondsRaw),
    minutes: fromBcd(todMinutesRaw),
    hours: fromBcd(todHoursRaw & 0x1f),
    pm: bit(todHoursRaw, 7) === 1,
    rawHex: [todTenthsRaw, todSecondsRaw, todMinutesRaw, todHoursRaw].map((b) => b.toString(16).padStart(2, "0")).join(""),
  };

  const serialShiftRegister = bytes[0x0c]!;

  const icrRaw = bytes[0x0d]!;
  const interruptStatus = {
    raw: icrRaw,
    timerAUnderflow: boolBit(icrRaw, 0),
    timerBUnderflow: boolBit(icrRaw, 1),
    todAlarm: boolBit(icrRaw, 2),
    serialShiftComplete: boolBit(icrRaw, 3),
    flagPin: boolBit(icrRaw, 4),
    interruptGenerated: boolBit(icrRaw, 7),
    // Bit 7 means IRQ on CIA1 and NMI on CIA2 -- the answer says which,
    // rather than leaving the caller to remember which chip is wired where.
    interruptKind: chip === 1 ? "irq" : "nmi",
  };

  const craRaw = bytes[0x0e]!;
  const timerAControl = {
    raw: craRaw,
    started: boolBit(craRaw, 0),
    underflowOnPortB: boolBit(craRaw, 1),
    underflowPulseMode: boolBit(craRaw, 2),
    oneShot: boolBit(craRaw, 3),
    forceLoad: boolBit(craRaw, 4),
    countsCntPin: boolBit(craRaw, 5),
    serialOutput: boolBit(craRaw, 6),
    todFrequency50Hz: boolBit(craRaw, 7),
  };

  const crbRaw = bytes[0x0f]!;
  const countSource = (crbRaw >> 5) & 0b11;
  const timerBControl = {
    raw: crbRaw,
    started: boolBit(crbRaw, 0),
    underflowOnPortB: boolBit(crbRaw, 1),
    underflowPulseMode: boolBit(crbRaw, 2),
    oneShot: boolBit(crbRaw, 3),
    forceLoad: boolBit(crbRaw, 4),
    countSource,
    countSourceMeaning: COUNT_SOURCE_MEANING[countSource]!,
    todWriteSetsAlarm: boolBit(crbRaw, 7),
  };

  const unavailable: Record<string, { available: false; reason: string }> = {};
  for (const [name, reason] of CIA_UNAVAILABLE_FIELDS) {
    unavailable[name] = { available: false, reason };
  }

  return {
    chip,
    base,
    registersHex,
    portA,
    portB,
    portADirection,
    portBDirection,
    timerA,
    timerB,
    tod,
    serialShiftRegister,
    interruptStatus,
    timerAControl,
    timerBControl,
    unavailable,
  };
}

function parseCiaArg(value: unknown): 1 | 2 {
  if (value === 1 || value === "1") {
    return 1;
  }
  if (value === 2 || value === "2") {
    return 2;
  }
  throw new Error(`cia must be 1 or 2 (or their "1"/"2" string forms), got ${JSON.stringify(value)}`);
}

export const handleCiaGetState: StockSessionHandler = async (args, session, _deps) => {
  if (!isPlainObject(args)) {
    return isErrorText("vice_cia_get_state: arguments must be an object");
  }

  const unexpected = Object.keys(args).filter((key) => key !== "cia");
  if (unexpected.length > 0) {
    return isErrorText(`vice_cia_get_state: unexpected argument(s): ${unexpected.join(", ")} -- the only accepted argument is "cia"`);
  }

  let chips: (1 | 2)[];
  let requested: 1 | 2 | "both";
  if (args.cia === undefined) {
    chips = [1, 2];
    requested = "both";
  } else {
    let parsed: 1 | 2;
    try {
      parsed = parseCiaArg(args.cia);
    } catch (err) {
      return isErrorText(`vice_cia_get_state: ${err instanceof Error ? err.message : String(err)}`);
    }
    chips = [parsed];
    requested = parsed;
  }

  const cias: Record<string, unknown>[] = [];
  for (const chip of chips) {
    const base = chip === 1 ? CIA1_BASE : CIA2_BASE;
    const body = memGetBody({ sidefx: false, start: base, end: base + CIA_LENGTH - 1, memspace: 0x00, bank: 0x0000 });

    let response;
    try {
      response = await session.client.send(CommandType.MemoryGet, body);
    } catch (err) {
      return convertWireError("vice_cia_get_state", err);
    }

    if (response.type !== "memory_get") {
      return isErrorText(
        `vice_cia_get_state: CIA${chip}: the binary monitor replied with an unexpected response type ("${response.type}"), expected "memory_get"`,
      );
    }

    if (response.bytes.length !== CIA_LENGTH) {
      return isErrorText(
        `vice_cia_get_state: CIA${chip}: expected ${CIA_LENGTH} byte(s), got ${response.bytes.length} -- ` +
          `a short read is a wrong answer, not a partial success`,
      );
    }

    cias.push(decodeCia(chip, response.bytes));
  }

  return stockAnswer(session.client, { requested, cias, count: cias.length });
};
