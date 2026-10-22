import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

import { MACHINES } from "../machine.ts";
import { writeZ80, type SpectrumSnapshot } from "../spectrum.ts";
import { readImage, readPrg, readProgramFile, snapshotImage } from "./image.ts";

const project = mkdtempSync(join(tmpdir(), "c64-re-tools-image-"));
const cwd = process.cwd();
before(() => {
  mkdirSync(join(project, ".c64-re-tools"));
  writeFileSync(join(project, "game.d64"), Buffer.alloc(174848));
  writeFileSync(join(project, "game.TAP"), Buffer.alloc(64));
  writeFileSync(join(project, "game.prg"), Buffer.from([0x00, 0xc0, 0xea, 0x60]));
  writeFileSync(join(project, "GAME.PRG"), Buffer.from([0x00, 0xc0, 0xea, 0x60]));
  writeFileSync(join(project, "bruce lee"), Buffer.from([0x01, 0x08, 0x00, 0x00]));
  writeFileSync(join(project, "README.md"), "# A game\n\nThe notes of the game.\n");
  process.chdir(project);
});
after(() => {
  process.chdir(cwd);
  rmSync(project, { recursive: true, force: true });
});

test("readImage refuses a disk, tape or cartridge image by its extension, with the message of readPrg", () => {
  const disk = "game.d64 is a disk image (.d64), not a PRG. Get the PRG out of it, and give the path of that PRG.";
  assert.throws(() => readImage("game.d64"), { code: "invalid-input", message: disk });
  assert.throws(() => readPrg("game.d64"), { code: "invalid-input", message: disk });
  assert.throws(() => readImage("game.TAP"), { code: "invalid-input", message: /^game\.TAP is a tape file \(\.tap\), not a PRG\./ });
});

test("a file of one or two bytes is too short for a PRG, with no remedy for disk images", () => {
  writeFileSync(join(project, "one.prg"), Buffer.from([0x01]));
  writeFileSync(join(project, "two.prg"), Buffer.from([0x01, 0x08]));
  const short = (name: string, count: string) => `${name} is too short for a PRG: it has ${count}, and a PRG has a 2-byte load address and at least one byte. Give the complete PRG file.`;
  assert.throws(() => readPrg("one.prg", "Use loads"), { code: "invalid-input", message: short("one.prg", "1 byte") });
  assert.throws(() => readImage("two.prg"), { code: "invalid-input", message: short("two.prg", "2 bytes") });
});

test("a PRG has the extension .prg in any letter case or no extension; every other file is refused before its bytes are read", () => {
  assert.equal(readPrg("GAME.PRG").start, 0xc000);
  assert.equal(readPrg("bruce lee").start, 0x0801);
  const message = "README.md is not a PRG: a PRG has the extension .prg or no extension, not .md. Give the PRG of the program, or rename the file to .prg when it is a PRG.";
  assert.throws(() => readPrg("README.md"), { code: "invalid-input", message });
  assert.throws(() => readImage("README.md"), { code: "invalid-input", message: /^README\.md is not an image\.json of an unpacked program or a PRG: a PRG has the extension \.prg or no extension, not \.md\./ });
});

test("a JSON value that is no object, as the file or as a segment or a stage, is no image.json", () => {
  writeFileSync("image.bin", Buffer.alloc(0x10000));
  for (const [text, message] of [
    ["null", /it is not a JSON object/],
    ["[]", /it is not a JSON object/],
    [JSON.stringify({ image: "image.bin", segments: [null] }), /segment 1 is not an object/],
    [JSON.stringify({ image: "image.bin", segments: [{ start: "$0400", end: "$04ff" }], stages: [7] }), /stage 1 is not an object/],
  ] as const) {
    writeFileSync("bad.json", text);
    assert.throws(() => readImage("bad.json"), { code: "invalid-input", message }, text);
  }
});

test("readImage reads a PRG as one segment at its load address", () => {
  const image = readImage("game.prg");
  assert.deepEqual(image.segments, [{ start: 0xc000, end: 0xc001 }]);
  assert.equal(image.byteAt(0xc001), 0x60);
});

/** A snapshot of the model with the PC at $8000 and the RAM banks of `banks`. */
function spectrumSnapshot(model: "48k" | "128k", port7ffd: number, banks = Array.from({ length: 8 }, () => new Uint8Array(0x4000))): SpectrumSnapshot {
  const registers = { af: 0, bc: 0, de: 0, hl: 0, af2: 0, bc2: 0, de2: 0, hl2: 0, ix: 0, iy: 0x5c3a, sp: 0x8ff0, pc: 0x8000, i: 0x3f, r: 0, iff1: false, iff2: false, im: 1 as const };
  return { model, registers, border: 0, port7ffd, banks };
}

test("a 128K snapshot gives the CPU view with the paged bank, the paging in the state, and each other RAM bank that holds data", () => {
  const banks = Array.from({ length: 8 }, () => new Uint8Array(0x4000));
  banks[1]![0] = 0xc9;
  banks[2]![0] = 0xf3;
  banks[3]![0x10] = 0x55;
  const image = snapshotImage(spectrumSnapshot("128k", 0x13, banks));
  assert.equal(image.machine, "spectrum128");
  assert.deepEqual([image.main.segments, image.main.entry, image.main.byteAt(0x8000), image.main.byteAt(0xc010)], [[{ start: 0x4000, end: 0xffff }], 0x8000, 0xf3, 0x55]);
  assert.equal(image.main.state.port7ffd, "$13");
  // Banks 5, 2 and the paged bank 3 are in the CPU view; of the others only bank 1 holds data.
  assert.deepEqual(image.banks.map((bank) => [bank.bank, bank.byteAt(0xc000)]), [[1, 0xc9]]);
});

test("a Spectrum project takes a snapshot as its program and refuses a tape with the way to a snapshot; a .tzx is a Spectrum tape in a C64 project too", () => {
  writeFileSync("counter.z80", writeZ80(spectrumSnapshot("48k", 0)));
  writeFileSync("game.tzx", Uint8Array.of(1, 2, 3));
  writeFileSync("loader.tap", Uint8Array.of(1, 2, 3));
  writeFileSync("block1.bin", Uint8Array.of(1, 2, 3));
  const read = readProgramFile("counter.z80", MACHINES.spectrum48);
  assert.ok("snapshot" in read);
  assert.deepEqual([read.snapshot.machine, read.snapshot.main.segments], ["spectrum48", [{ start: 0x4000, end: 0xffff }]]);
  for (const tape of ["game.tzx", "loader.tap"]) {
    assert.throws(() => readProgramFile(tape, MACHINES.spectrum48), { code: "invalid-input", message: /is a ZX Spectrum tape .* export the machine state as a \.z80 snapshot/ }, tape);
  }
  assert.throws(() => readProgramFile("block1.bin", MACHINES.spectrum48), { code: "invalid-input", message: /block1\.bin is no snapshot\. A program of the ZX Spectrum 48K comes into the knowledge as a \.z80 or \.sna snapshot/ });
  assert.throws(() => readProgramFile("game.tzx", MACHINES.c64), { code: "invalid-input", message: /is a ZX Spectrum tape/ });
});
