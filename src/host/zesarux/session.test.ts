import assert from "node:assert/strict";
import { test } from "node:test";

import { WireFailure } from "../../protocol/messages.ts";
import { codeCoverageAddresses, firedStop, keysOf, parseRegisters, SPECTRUM_KEYS, visualmemAddresses } from "./session.ts";

// The get-registers answer of ZEsarUX 13.0 after set-register IX=04d2H.
const REGISTERS = "PC=11dc SP=ffff AF=3fa7 BC=00ff HL=b33a DE=ffff IX=04d2 IY=ffff AF'=ffff BC'=ffff HL'=0000 DE'=ffff I=3f R=26  F=S-5--PNC F'=SZ5H3PNC MEMPTR=11dc IM0 IFF-- VPS: 0 MMU=00000000000000000000000000000000";

test("the registers of get-registers, with the alternate set apart from the main set", () => {
  assert.deepEqual(parseRegisters(REGISTERS), {
    pc: 0x11dc,
    sp: 0xffff,
    af: 0x3fa7,
    bc: 0x00ff,
    de: 0xffff,
    hl: 0xb33a,
    ix: 0x04d2,
    iy: 0xffff,
    af2: 0xffff,
    bc2: 0xffff,
    de2: 0xffff,
    hl2: 0x0000,
    i: 0x3f,
    r: 0x26,
    im: 0,
    iff1: false,
    iff2: false,
  });
  const running = parseRegisters(REGISTERS.replace("IM0 IFF--", "IM1 IFF12"));
  assert.deepEqual([running.im, running.iff1, running.iff2], [1, true, true]);
});

test("an answer without a register is refused, not read as 0", () => {
  assert.throws(() => parseRegisters("PC=8000 SP=ff00"), (error) => error instanceof WireFailure && error.code === "operation-failed" && /no AF register/.test(error.message));
});

test("a visual memory dump gives each address with a count, one value per address from the first", () => {
  assert.deepEqual(visualmemAddresses("11DCH 1\n11DEH 1\n"), [0x11dc, 0x11de]);
  assert.deepEqual(visualmemAddresses("8000H 2 0 1\n\nC000H 0\n"), [0x8000, 0x8002]);
});

test("text maps to the keys of the Spectrum keyboard, with CAPS SHIFT and SYMBOL SHIFT", () => {
  assert.equal(SPECTRUM_KEYS.length, 40);
  assert.deepEqual(keysOf("a"), ["a"]);
  assert.deepEqual(keysOf("7"), ["7"]);
  assert.deepEqual(keysOf("A"), ["caps", "a"]);
  assert.deepEqual(keysOf(" "), ["space"]);
  assert.deepEqual(keysOf("\n"), ["enter"]);
  assert.deepEqual(keysOf('"'), ["symbol", "p"]);
  assert.deepEqual(keysOf("$"), ["symbol", "4"]);
  for (const char of "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 \n\",.:;+-=*/?()$!<>_#%&'@^") {
    for (const key of keysOf(char)) assert.ok(SPECTRUM_KEYS.includes(key), `${JSON.stringify(char)} gives ${key}`);
  }
  assert.throws(() => keysOf("~"), (error) => error instanceof WireFailure && error.code === "invalid-input");
});

test("a fired PC breakpoint is read by its address: ZEsarUX writes it in capitals and with no leading zeros", () => {
  const points = [
    { id: 1, kind: "breakpoint" as const, start: 0xec67, end: 0xec67, enabled: true },
    { id: 2, kind: "breakpoint" as const, start: 0x0038, end: 0x0038, enabled: true },
    { id: 3, kind: "watchpoint" as const, start: 0x9000, end: 0x9002, access: "write" as const, enabled: true },
  ];
  assert.deepEqual(firedStop("PC=EC67H", points, undefined), { reason: "breakpoint", pointId: 1 });
  assert.deepEqual(firedStop("PC=38H", points, undefined), { reason: "breakpoint", pointId: 2 });
  // The target of run_until wins over a breakpoint at the same address.
  assert.deepEqual(firedStop("PC=E200H", points, 0xe200), { reason: "target" });
  assert.deepEqual(firedStop("PC=EC67H", points, 0xec67), { reason: "target" });
  assert.deepEqual(firedStop("TSTATESP>=34944000", points, 0xe200), { reason: "frames" });
  assert.deepEqual(firedStop("Memory Breakpoint Write Address: 9001H Value: 01H", points, undefined), { reason: "watchpoint", pointId: 3 });
  assert.deepEqual(firedStop(undefined, points, undefined), {});
});

test("the code coverage answer gives the address of each executed instruction", () => {
  assert.deepEqual(codeCoverageAddresses("8102 8105 8107"), [0x8102, 0x8105, 0x8107]);
  assert.deepEqual(codeCoverageAddresses("38 39\nEC5B\n"), [0x38, 0x39, 0xec5b]);
  assert.deepEqual(codeCoverageAddresses(""), []);
  // After a load the coverage is off: the answer is an error, not addresses such as "be".
  assert.throws(() => codeCoverageAddresses("Error. It's not enabled"), (error) => error instanceof WireFailure && error.code === "operation-failed");
});
