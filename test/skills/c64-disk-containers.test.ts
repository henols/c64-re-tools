// CRT and T64 files in the c64-disk script: read locally, without the
// host; each CRT bank becomes a PRG for its knowledge space.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { parseCrt, parseT64 } from "../../skills/c64-disk/scripts/lib/containers.ts";
import { readEnvelope } from "../kit.ts";

const script = resolve(import.meta.dirname, "../../skills/c64-disk/scripts/disk.ts");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-containers-"));
after(() => rmSync(project, { recursive: true, force: true }));

function crt(type: number, exrom: number, game: number, chips: Array<{ bank: number; address: number; data: number[] }>): Buffer {
  const header = Buffer.alloc(0x40);
  header.write("C64 CARTRIDGE   ", 0, "latin1");
  header.writeUInt32BE(0x40, 0x10);
  header.writeUInt16BE(0x0100, 0x14);
  header.writeUInt16BE(type, 0x16);
  header[0x18] = exrom;
  header[0x19] = game;
  header.write("TEST CART", 0x20, "latin1");
  const packets = chips.map((chip) => {
    const packet = Buffer.alloc(0x10 + chip.data.length);
    packet.write("CHIP", 0, "latin1");
    packet.writeUInt32BE(packet.length, 4);
    packet.writeUInt16BE(0, 8);
    packet.writeUInt16BE(chip.bank, 10);
    packet.writeUInt16BE(chip.address, 12);
    packet.writeUInt16BE(chip.data.length, 14);
    Buffer.from(chip.data).copy(packet, 0x10);
    return packet;
  });
  return Buffer.concat([header, ...packets]);
}

function t64(files: Array<{ name: string; start: number; data: number[]; end?: number }>): Buffer {
  const header = Buffer.alloc(0x40 + 0x20 * files.length);
  header.write("C64S tape image file", 0, "latin1");
  header.writeUInt16BE(0x0101, 0x20);
  header.writeUInt16LE(files.length, 0x22);
  header.writeUInt16LE(files.length, 0x24);
  header.write("TEST TAPE".padEnd(24, " "), 0x28, "latin1");
  let offset = header.length;
  const bodies: Buffer[] = [];
  files.forEach((file, index) => {
    const at = 0x40 + 0x20 * index;
    header[at] = 1;
    header[at + 1] = 0x82;
    header.writeUInt16LE(file.start, at + 2);
    header.writeUInt16LE(file.end ?? file.start + file.data.length, at + 4);
    header.writeUInt32LE(offset, at + 8);
    header.write(file.name.padEnd(16, " "), at + 0x10, "latin1");
    bodies.push(Buffer.from(file.data));
    offset += file.data.length;
  });
  return Buffer.concat([header, ...bodies]);
}

const disk = (...args: string[]) => {
  const run = spawnSync(process.execPath, [...process.execArgv, script, ...args], { cwd: project, encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
  return { status: run.status, ...readEnvelope(run.stdout, run.status) };
};

test("a CRT gives its type, its mode and each bank; unknown types are refused by name", () => {
  const normal = parseCrt(crt(0, 0, 1, [{ bank: 0, address: 0x8000, data: [0x09, 0x80] }]));
  assert.deepEqual([normal.typeName, normal.mode, normal.chips.length], ["normal", "8k", 1]);
  const ocean = parseCrt(crt(5, 0, 0, [0, 1, 2].map((bank) => ({ bank, address: 0x8000, data: [bank] }))));
  assert.deepEqual(ocean.chips.map((chip) => [chip.bank, chip.address]), [[0, 0x8000], [1, 0x8000], [2, 0x8000]]);
  assert.throws(() => parseCrt(crt(1, 0, 0, [{ bank: 0, address: 0x8000, data: [0] }])), /hardware type 1; this toolkit reads types 0 \(normal\), 5 \(Ocean\), 19 \(Magic Desk\), 32 \(EasyFlash\)/);
  assert.throws(() => parseCrt(Buffer.alloc(0x50)), /not a CRT/);
});

test("crt writes one PRG for each bank and chip, for space bankN, with a manifest", () => {
  writeFileSync(join(project, "easy.crt"), crt(32, 1, 0, [
    { bank: 0, address: 0x8000, data: [0xaa, 0xbb] },
    { bank: 0, address: 0xa000, data: [0xcc] },
    { bank: 1, address: 0x8000, data: [0xdd] },
  ]));
  const listed = disk("directory", "easy.crt");
  assert.equal(listed.status, 0, JSON.stringify(listed.json));
  assert.deepEqual(listed.json.chips, [
    { bank: 0, address: "$8000", size: 2, space: "bank0" },
    { bank: 0, address: "$a000", size: 1, space: "bank0" },
    { bank: 1, address: "$8000", size: 1, space: "bank1" },
  ]);
  const written = disk("crt", "easy.crt", "--out", "cart");
  assert.equal(written.status, 0, JSON.stringify(written.json));
  assert.match(written.envelope.hint!, /Analyze each bank PRG in its own knowledge space/);
  assert.deepEqual([...readFileSync(join(project, "cart", "bank0-a000.prg"))], [0x00, 0xa0, 0xcc]);
  assert.equal(JSON.parse(readFileSync(join(project, "cart", "crt.json"), "utf8")).typeName, "EasyFlash");
  assert.equal(disk("bam", "easy.crt").status, 2);
  assert.equal(disk("crt", "game.d64", "--out", "x").status, 2, "crt needs a .crt file");
});

test("a file of a kind that a command does not take is refused with every kind that it takes, and a bad CRT or T64 is a media error", () => {
  writeFileSync(join(project, "notes.txt"), "text");
  const refused = (args: string[]) => {
    const result = disk(...args);
    assert.equal(result.status, 2, args.join(" "));
    return { code: result.envelope.code!, message: result.envelope.error!, hint: result.envelope.hint };
  };
  const media = "The file has a defect, or its content is not of its type. Give this message to the user. Do not change the file.";
  assert.deepEqual(refused(["directory", "notes.txt"]), { code: "invalid-input", message: "notes.txt is not a file that directory takes.", hint: "Give a .d64, .d71, .d81 or .g64 disk image, a .t64 tape file or a .crt cartridge file." });
  assert.equal(refused(["read", "notes.txt", "GAME", "--out", "x.prg"]).hint, "Give a .d64, .d71, .d81 or .g64 disk image or a .t64 tape file.");
  assert.equal(refused(["bam", "notes.txt"]).hint, "Give a .d64, .d71, .d81 or .g64 disk image.");
  assert.equal(refused(["crt", "game.d64", "--out", "x"]).hint, "Give a .crt cartridge file.");
  writeFileSync(join(project, "bad.crt"), Buffer.alloc(0x50));
  writeFileSync(join(project, "bad.t64"), Buffer.alloc(0x50));
  assert.deepEqual(refused(["directory", "bad.crt"]), { code: "media-error", message: "bad.crt: the file is not a CRT: it does not start with C64 CARTRIDGE.", hint: media });
  assert.deepEqual(refused(["crt", "bad.crt", "--out", "x"]).code, "media-error");
  writeFileSync(join(project, "short.crt"), Buffer.from("C64 CARTRIDGE   \0\0\0\x40", "latin1"));
  assert.deepEqual(refused(["directory", "short.crt"]), { code: "media-error", message: "short.crt: the CRT header is shorter than 64 bytes: the file has only 20 bytes.", hint: media });
  assert.deepEqual(refused(["directory", "bad.t64"]), { code: "media-error", message: "bad.t64: the file is not a T64: it does not start with C64.", hint: media });
  assert.deepEqual(refused(["read", "bad.t64", "GAME", "--out", "x.prg"]).code, "media-error");
  writeFileSync(join(project, "type1.crt"), crt(1, 0, 0, [{ bank: 0, address: 0x8000, data: [0] }]));
  assert.equal(refused(["directory", "type1.crt"]).code, "media-error", "a hardware type that the script does not read");
});

test("a T64 lists its files, corrects a wrong end address, and extracts a file as a PRG", () => {
  const tape = t64([
    { name: "GAME", start: 0x0801, data: [1, 2, 3, 4], end: 0xc3c6 },
    { name: "DATA", start: 0x2000, data: [9, 8] },
  ]);
  const parsed = parseT64(tape);
  assert.deepEqual(parsed.entries.map((entry) => [entry.name, entry.start, entry.bytes, entry.fixedSize ?? false]), [["GAME", 0x0801, 4, true], ["DATA", 0x2000, 2, false]]);
  writeFileSync(join(project, "game.t64"), tape);
  const listed = disk("directory", "game.t64");
  assert.equal(listed.status, 0, JSON.stringify(listed.json));
  assert.deepEqual(listed.json.entries[0], { name: "GAME", start: "$0801", end: "$0804", bytes: 4, fixedSize: true });
  const read = disk("read", "game.t64", "GAME", "--out", "extracted/game.prg");
  assert.equal(read.status, 0, JSON.stringify(read.json));
  assert.deepEqual([...readFileSync(join(project, "extracted", "game.prg"))], [0x01, 0x08, 1, 2, 3, 4]);
  assert.equal(disk("read", "game.t64", "NONE", "--out", "x.prg").json.error.code, "not-found");
  assert.equal(existsSync(join(project, "x.prg")), false);
  assert.equal(disk("chain", "game.t64", "GAME").status, 2, "a T64 has no blocks");
});
