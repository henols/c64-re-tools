import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

import { checkedProgramCitation, readImage, readPrg } from "./image.ts";

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

test("a JSON value that is no object, as the file or as a segment, a stage or the program, is no image.json", () => {
  writeFileSync("image.bin", Buffer.alloc(0x10000));
  for (const [text, message] of [
    ["null", /it is not a JSON object/],
    ["[]", /it is not a JSON object/],
    [JSON.stringify({ image: "image.bin", segments: [null] }), /segment 1 is not an object/],
    [JSON.stringify({ image: "image.bin", segments: [{ start: "$0400", end: "$04ff" }], stages: [7] }), /stage 1 is not an object/],
    [JSON.stringify({ image: "image.bin", segments: [{ start: "$0400", end: "$04ff" }], program: "game.prg" }), /its program is not an object/],
    [JSON.stringify({ image: "image.bin", segments: [{ start: "$0400", end: "$04ff" }], program: { file: "game.prg" } }), /its program has no file and SHA-256/],
  ] as const) {
    writeFileSync("bad.json", text);
    assert.throws(() => readImage("bad.json"), { code: "invalid-input", message }, text);
  }
});

test("an image.json cites its program file only while the project has that file with the bytes that the capture ran", () => {
  // game.prg holds 00 c0 ea 60. A rebuild after the capture gives other bytes.
  const sha256 = "0".repeat(64);
  const real = createHash("sha256").update(Buffer.from([0x00, 0xc0, 0xea, 0x60])).digest("hex");
  assert.deepEqual(checkedProgramCitation("capture/image.json", { file: "./game.prg", sha256: real }), { file: "game.prg", sha256: real });
  assert.throws(() => checkedProgramCitation("capture/image.json", { file: "game.prg", sha256 }), { code: "conflict", message: /Capture the program again/ });
  assert.throws(() => checkedProgramCitation("capture/image.json", { file: "gone.prg", sha256: real }), { code: "not-found", message: /Capture the program again/ });
  assert.throws(() => checkedProgramCitation("capture/image.json", { file: "../v1/game.prg", sha256: real }), { code: "invalid-input", message: /Capture the program again/ });
});

test("readImage reads a PRG as one segment at its load address", () => {
  const image = readImage("game.prg");
  assert.deepEqual(image.segments, [{ start: 0xc000, end: 0xc001 }]);
  assert.equal(image.byteAt(0xc001), 0x60);
});

test("readImage reads image.bin and entry_state.json beside an image.json that it gets by its absolute path", () => {
  const capture = join(project, "capture");
  mkdirSync(capture);
  writeFileSync(join(capture, "image.json"), JSON.stringify({ image: "image.bin", segments: [{ start: "$c000", end: "$c001" }] }));
  writeFileSync(join(capture, "image.bin"), Buffer.alloc(0x10000, 0xea));
  const page = "00".repeat(256);
  writeFileSync(join(capture, "entry_state.json"), JSON.stringify({ registers: { pc: "$c000", a: 0, x: 0, y: 0, sp: 0xff, flags: {} }, cpuPort: { $00: 0x2f, $01: 0x37 }, pages: { $0000: page, $0100: page, $0200: page, $0300: page } }));
  const image = readImage(join(capture, "image.json"));
  assert.equal(image.byteAt(0xc000), 0xea);
  assert.equal(image.state?.pc, 0xc000);
});
