import assert from "node:assert/strict";
import { test } from "node:test";

import { SYMBOL_NAME } from "../address.ts";
import { Refusal } from "../errors.ts";
import { SPECTRUM_AREAS, spectrumDecode, spectrumLookup, spectrumPlatformNames } from "./spectrum.ts";

test("a Spectrum address gives its ROM routine, system variable or area, else the application", () => {
  assert.deepEqual(spectrumLookup(0x0556), { address: 0x0556, kind: "platform", area: "rom", name: "LD_BYTES", meaning: spectrumLookup(0x0556).meaning });
  assert.deepEqual([spectrumLookup(0x5c79).name, spectrumLookup(0x5c79).entryStart], ["FRAMES", 0x5c78]);
  assert.deepEqual([spectrumLookup(0x4100).kind, spectrumLookup(0x4100).area], ["platform", "screen"]);
  assert.deepEqual([spectrumLookup(0x8000).kind, spectrumLookup(0x8000).area], ["application", "ram"]);
});

test("the platform names are symbol names, each one once, and the areas cover the 64 KiB without a gap", () => {
  const names = spectrumPlatformNames().map((entry) => entry.name);
  assert.equal(new Set(names).size, names.length);
  for (const name of names) assert.match(name, SYMBOL_NAME, name);
  for (let index = 1; index < SPECTRUM_AREAS.length; index++) assert.equal(SPECTRUM_AREAS[index]!.start, SPECTRUM_AREAS[index - 1]!.end + 1);
  assert.deepEqual([SPECTRUM_AREAS[0]!.start, SPECTRUM_AREAS.at(-1)!.end], [0, 0xffff]);
});

test("a ULA OUT, a paging write and an attribute decode into their fields", () => {
  assert.deepEqual(spectrumDecode("ula", 0x12), { border: 2, mic: false, beeper: true });
  assert.deepEqual(spectrumDecode("paging", 0x1f), { ramBank: 7, screenBank: 7, rom: 1, locked: false });
  assert.deepEqual(spectrumDecode("attribute", 0xc7), { ink: 7, paper: 0, bright: true, flash: true });
  assert.throws(() => spectrumDecode("ula", 256), Refusal);
});
