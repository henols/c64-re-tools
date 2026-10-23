import assert from "node:assert/strict";
import { test } from "node:test";

import { SYMBOL_NAME } from "../address.ts";
import { Refusal } from "../errors.ts";
import { C64, MACHINES, SPECTRUM_TIMING } from "../machine.ts";
import { platformNames, platformNamesOfSpace } from "../platform.ts";
import { AY_CLOCK_HZ, SPECTRUM_AREAS, SPECTRUM_AY, spectrumContention, spectrumDecode, spectrumDecodeAy, spectrumLookup, spectrumModelOf, spectrumPlatformNames, spectrumTimingFacts } from "./spectrum.ts";

test("a Spectrum address gives its ROM routine, system variable or area, else the application", () => {
  assert.deepEqual(spectrumLookup(0x0556, "48k"), { address: 0x0556, kind: "platform", area: "rom", name: "LD_BYTES", meaning: spectrumLookup(0x0556, "48k").meaning });
  assert.deepEqual([spectrumLookup(0x5c79, "48k").name, spectrumLookup(0x5c79, "48k").entryStart], ["FRAMES", 0x5c78]);
  assert.deepEqual([spectrumLookup(0x4100, "48k").kind, spectrumLookup(0x4100, "48k").area], ["platform", "screen"]);
  assert.deepEqual([spectrumLookup(0x8000, "128k").kind, spectrumLookup(0x8000, "128k").area], ["application", "ram"]);
});

test("$5B00-$5BFF is the printer buffer on the 48K and holds the names of the 128K ROM on the 128K", () => {
  assert.deepEqual([spectrumLookup(0x5b5c, "48k").area, spectrumLookup(0x5b5c, "48k").name], ["printer-buffer", undefined]);
  assert.deepEqual([spectrumLookup(0x5b5c, "128k").area, spectrumLookup(0x5b5c, "128k").name], ["printer-buffer", "BANK_M"]);
  assert.deepEqual([spectrumLookup(0x5b05, "128k").name, spectrumLookup(0x5b05, "128k").entryStart], ["SWAP", 0x5b00]);
  assert.deepEqual([spectrumLookup(0x5b81, "128k").name, spectrumLookup(0x5bff, "128k").name, spectrumLookup(0x5b66, "128k").name], ["OLDSP", "TSTACK", "FLAGS3"]);
  // The project machine decides, not the space: the 48K and the 128K have the same main space.
  const named = (machine: (typeof MACHINES)[keyof typeof MACHINES]) => platformNamesOfSpace(machine, machine.spaces.main).map((entry) => entry.name);
  assert.ok(named(MACHINES.spectrum128).includes("BANK_M"));
  assert.ok(!named(MACHINES.spectrum48).includes("BANK_M"));
  assert.deepEqual([spectrumModelOf(MACHINES.spectrum128), spectrumModelOf(MACHINES.spectrum48)], ["128k", "48k"]);
  assert.deepEqual(platformNamesOfSpace(MACHINES.spectrum128, "ram3"), []);
  assert.deepEqual(platformNamesOfSpace(C64, "c64"), platformNames());
  assert.deepEqual(platformNamesOfSpace(C64, "drive8"), []);
});

test("the platform names are symbol names, each one once, and the areas cover the 64 KiB without a gap", () => {
  for (const model of ["48k", "128k"] as const) {
    const names = spectrumPlatformNames(model).map((entry) => entry.name);
    assert.equal(new Set(names).size, names.length, model);
    for (const name of names) assert.match(name, SYMBOL_NAME, name);
  }
  for (let index = 1; index < SPECTRUM_AREAS.length; index++) assert.equal(SPECTRUM_AREAS[index]!.start, SPECTRUM_AREAS[index - 1]!.end + 1);
  assert.deepEqual([SPECTRUM_AREAS[0]!.start, SPECTRUM_AREAS.at(-1)!.end], [0, 0xffff]);
});

test("a ULA OUT, a paging write and an attribute decode into their fields", () => {
  assert.deepEqual(spectrumDecode("ula", 0x12), { border: 2, mic: false, beeper: true });
  assert.deepEqual(spectrumDecode("paging", 0x1f), { ramBank: 7, screenBank: 7, rom: 1, locked: false });
  assert.deepEqual(spectrumDecode("attribute", 0xc7), { ink: 7, paper: 0, bright: true, flash: true });
  assert.throws(() => spectrumDecode("ula", 256), Refusal);
});

test("the AY mixer, a volume and an envelope shape decode into their fields", () => {
  // A 0 bit turns a tone or a noise on.
  assert.deepEqual(spectrumDecode("ay-mixer", 0x78), { tone: { a: true, b: true, c: true }, noise: { a: false, b: false, c: false }, portA: "output", portB: "input" });
  assert.deepEqual(spectrumDecode("ay-mixer", 0x0e), { tone: { a: true, b: false, c: false }, noise: { a: false, b: true, c: true }, portA: "input", portB: "input" });
  assert.deepEqual(spectrumDecode("ay-volume", 0x1f), { level: 15, envelope: true });
  assert.deepEqual(spectrumDecode("ay-shape", 0x0e), { shape: 14, continue: true, attack: true, alternate: true, hold: false, form: "rises and falls again and again" });
  assert.equal(spectrumDecode("ay-shape", 0x02).form, "falls one time, then stays at 0");
  assert.equal(spectrumDecode("ay-shape", 0x0d).form, "rises one time, then stays at 15");
  assert.deepEqual(SPECTRUM_AY.map((register) => register.register), Array.from({ length: 16 }, (_, index) => index));
});

test("16 AY registers give the tone of each channel in Hz at the 128K clock, the mixer, the volumes and the envelope", () => {
  assert.equal(AY_CLOCK_HZ, 1_773_450);
  // R7 = $38 and R8 = 15: three tones, no noise, channel A at level 15. Periods of 0 count as 1.
  const probe = spectrumDecodeAy([0, 0, 0, 0, 0, 0, 0, 0x38, 15, 0, 0, 0, 0, 0, 0, 0]) as { channels: Array<Record<string, unknown>>; noise: Record<string, unknown>; envelope: Record<string, unknown> };
  assert.deepEqual(probe.channels[0], { channel: "A", tonePeriod: 0, toneHz: 110_840.63, tone: true, noise: false, level: 15, envelope: false });
  assert.deepEqual(probe.channels.map((channel) => [channel.tone, channel.noise, channel.level]), [[true, false, 15], [true, false, 0], [true, false, 0]]);
  assert.deepEqual(probe.noise, { period: 0, hz: 110_840.63 });
  assert.equal(probe.envelope.rampMs, 0.07);
  const set = spectrumDecodeAy([0x10, 0x01, 0x20, 0x02, 0x30, 0x03, 0x1f, 0x38, 0x0f, 0x0e, 0x1d, 0x00, 0x10, 0x09, 0x00, 0x00]) as { channels: Array<Record<string, unknown>>; noise: Record<string, unknown>; envelope: Record<string, unknown>; portA: unknown };
  assert.deepEqual(set.channels.map((channel) => [channel.tonePeriod, channel.toneHz, channel.level, channel.envelope]), [[0x110, 407.5, 15, false], [0x220, 203.75, 14, false], [0x330, 135.83, 13, true]]);
  assert.deepEqual(set.noise, { period: 31, hz: 3575.5 });
  assert.deepEqual([set.envelope.period, set.envelope.rampMs, set.envelope.form], [0x1000, 591.26, "falls one time, then stays at 0"]);
  assert.deepEqual(set.portA, { direction: "input", value: 0 });
  assert.throws(() => spectrumDecodeAy([0, 1, 2]), Refusal);
});

test("the timing of each model: lines and frames, the measured contention start, and the contended memory", () => {
  for (const timing of Object.values(SPECTRUM_TIMING)) assert.equal(timing.lineTstates * timing.frameLines, timing.frameTstates);
  assert.deepEqual([SPECTRUM_TIMING["48k"].contentionStart, SPECTRUM_TIMING["128k"].contentionStart], [14_336, 14_362]);
  assert.deepEqual([SPECTRUM_TIMING["48k"].frameTstates, SPECTRUM_TIMING["128k"].frameTstates], [69_888, 70_908]);
  assert.deepEqual(spectrumContention(0x4000, "48k"), { contended: true });
  assert.deepEqual(spectrumContention(0x8000, "128k"), {});
  assert.deepEqual(spectrumContention(0xc000, "48k"), {});
  assert.deepEqual(spectrumContention(0xffff, "128k"), { contendedBanks: [1, 3, 5, 7] });
  const facts = new Map(spectrumTimingFacts().map((fact) => [fact.name, fact]));
  assert.deepEqual([facts.get("contentionStart")!["48k"], facts.get("contentionStart")!["128k"], facts.get("contentionPattern")!["48k"]], [14_336, 14_362, "6,5,4,3,2,1,0,0"]);
});
