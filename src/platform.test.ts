import assert from "node:assert/strict";
import { test } from "node:test";

import { COVERAGE } from "./c64.ts";
import { platformNames, platformNamesFor, romUseOf, romUseOfPort } from "./platform.ts";

test("a program without the KERNAL and BASIC gets no system or ROM names, only the processor port and I/O (D75)", () => {
  // The Bruce Lee run: the source named the game's zero page CHRGET, PNTR and ADRAY2.
  const names = (use: { basic: boolean; kernal: boolean }) => new Set(platformNamesFor(use).map((entry) => entry.name));
  const none = names({ basic: false, kernal: false });
  for (const name of ["CHRGET", "PNTR", "ADRAY2", "CINV", "CHROUT"]) assert.equal(none.has(name), false, name);
  for (const name of ["D6510", "R6510", "EXTCOL", "SCROLY"]) assert.equal(none.has(name), true, name);
  const kernal = names({ basic: false, kernal: true });
  assert.equal(kernal.has("CHROUT"), true);
  assert.equal(kernal.has("PNTR"), true, "the system area is the KERNAL's workspace too");
  assert.equal([...kernal].some((name) => platformNames().find((entry) => entry.name === name)!.address >= 0xa000 && platformNames().find((entry) => entry.name === name)!.address <= 0xbfff), false, "no BASIC ROM entry");
  assert.equal(names({ basic: true, kernal: true }).size, platformNames().length);
});

test("the ROMs in use come from ROM accesses in the coverage, or from $01", () => {
  const coverage = new Uint8Array(0x10000);
  assert.deepEqual(romUseOf(coverage, COVERAGE.romExecute), { basic: false, kernal: false });
  coverage[0xffd2] = COVERAGE.romExecute;
  assert.deepEqual(romUseOf(coverage, COVERAGE.romExecute), { basic: false, kernal: true });
  coverage[0xa000] = COVERAGE.ramRead | COVERAGE.romRead;
  assert.deepEqual(romUseOf(coverage, COVERAGE.romExecute).basic, false, "bytes of the BASIC ROM read as data are no use of BASIC");
  assert.deepEqual(romUseOfPort(0x37), { basic: true, kernal: true });
  assert.deepEqual(romUseOfPort(0x36), { basic: false, kernal: true });
  assert.deepEqual(romUseOfPort(0x35), { basic: false, kernal: false });
});
