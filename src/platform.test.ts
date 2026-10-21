import assert from "node:assert/strict";
import { test } from "node:test";

import { COVERAGE } from "./c64.ts";
import { platformNames, platformNamesFor, romRanges, romUseOf, romUseOfPort } from "./platform.ts";

test("a program without the KERNAL and BASIC gets no system or ROM names, only the processor port and I/O", () => {
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

test("the ROM ranges of an image come from the coverage, else from $01 of the entry state, and known code stays out", () => {
  // The image: $c000-$ffff.
  const image = (address: number) => (address >= 0xc000 ? 0 : undefined);
  const map = new Uint8Array(0x10000);
  map[0xe716] = COVERAGE.romExecute;
  map[0xe717] = COVERAGE.romExecute | COVERAGE.ramRead;
  assert.deepEqual(romRanges(map, { cpuPort: { $01: 0x35 } }, image, []), [{ start: 0xe716, end: 0xe716 }], "the coverage wins, and RAM that a run read is not ROM");
  assert.deepEqual(romRanges(undefined, { cpuPort: { $01: 0x37 } }, image, []), [{ start: 0xe000, end: 0xffff }], "BASIC is outside the image");
  assert.deepEqual(romRanges(undefined, { cpuPort: { $01: 0x35 } }, image, []), []);
  assert.deepEqual(romRanges(undefined, undefined, image, []), [], "no state, no ROM");
  assert.deepEqual(romRanges(undefined, { cpuPort: { $01: 0x37 } }, image, [0xe000]), [], "code of the knowledge there");
});
