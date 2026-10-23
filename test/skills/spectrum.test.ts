// The ZX Spectrum skill scripts on a project with a tape, a snapshot and a
// screen: spectrum-basic, spectrum-media and spectrum-memory-map.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { withWrite } from "../../src/knowledge/database.ts";
import { writeMachine } from "../../src/knowledge/write.ts";
import { readPng } from "../../src/graphics.testkit.ts";
import { keyboardCounterSnapshot } from "../fixtures/z80/keyboard-counter.ts";
import { readEnvelope, type ScriptEnvelope } from "../kit.ts";
import { screenOf } from "../../skills/spectrum-media/scripts/lib/screen.ts";

const skills = resolve(import.meta.dirname, "../../skills");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-spectrum-skills-"));
mkdirSync(join(project, ".c64-re-tools", "local"), { recursive: true });
after(() => rmSync(project, { recursive: true, force: true }));
const home = process.cwd();

const text = (value: string) => [...value].map((char) => char.charCodeAt(0));
const basicLine = (number: number, bytes: number[]) => [number >> 8, number & 0xff, (bytes.length + 1) & 0xff, (bytes.length + 1) >> 8, ...bytes, 0x0d];
const literal = (digits: string, hidden = Number(digits)) => [...text(digits), 0x0e, 0, 0, hidden & 0xff, hidden >> 8, 0];
/** A TAP block: its length, the flag byte, the bytes and the XOR checksum. */
function tapBlock(flag: number, bytes: number[]): number[] {
  const body = [flag, ...bytes];
  body.push(body.reduce((xor, byte) => xor ^ byte, 0));
  return [body.length & 0xff, body.length >> 8, ...body];
}
const header = (type: number, name: string, length: number, param1: number, param2: number) =>
  tapBlock(0, [type, ...text(name.padEnd(10)), length & 0xff, length >> 8, param1 & 0xff, param1 >> 8, param2 & 0xff, param2 >> 8]);

// 10 CLEAR 24999: LOAD "" CODE : RANDOMIZE USR 0, with 25000 hidden behind the 0.
const program = basicLine(10, [0xfd, ...literal("24999"), 0x3a, 0xef, 0x22, 0x22, 0xaf, 0x3a, 0xf9, 0xc0, ...literal("0", 25000)]);
const code = [0xf3, 0xc9];
const loaderBlocks = [...header(0, "loader", program.length, 10, program.length), ...tapBlock(0xff, program), ...header(3, "game", code.length, 25000, 32768), ...tapBlock(0xff, code)];
writeFileSync(join(project, "game.tap"), Uint8Array.from(loaderBlocks));
// 10 POKE 23613,0: the program length of the header holds 4 more bytes of machine code after the line; 6 bytes of variables follow.
const pokeLine = basicLine(10, [0xf4, ...literal("23613"), 0x2c, ...literal("0")]);
const hidden = [...pokeLine, 0xf3, 0x31, 0x00, 0x80, 0x61, 0, 0, 1, 0, 0];
writeFileSync(join(project, "basic.tap"), Uint8Array.from([...loaderBlocks, ...header(0, "hidden", hidden.length, 10, pokeLine.length + 4), ...tapBlock(0xff, hidden)]));
// 10 POKE (PEEK 23613+256*PEEK 23614),PEEK 23627: POKE (PEEK 23613+256*PEEK 23614)+1,PEEK 23628: the end of the BASIC starts the code in the 3 bytes of variables.
const errorReturn = [0x28, 0xbe, ...literal("23613"), 0x2b, ...literal("256"), 0x2a, 0xbe, ...literal("23614"), 0x29];
const varsLine = basicLine(10, [0xf4, ...errorReturn, 0x2c, 0xbe, ...literal("23627"), 0x3a, 0xf4, ...errorReturn, 0x2b, ...literal("1"), 0x2c, 0xbe, ...literal("23628")]);
const varsProgram = [...varsLine, 0xf3, 0x18, 0xfe];
writeFileSync(join(project, "vars.tap"), Uint8Array.from([...header(0, "vars", varsProgram.length, 10, varsLine.length), ...tapBlock(0xff, varsProgram)]));
// A TZX with a pure-data block of 4 bytes: the own loader of the program decides what they are.
writeFileSync(join(project, "pure.tzx"), Uint8Array.from([...text("ZXTape!"), 0x1a, 1, 20, 0x14, ...new Array(7).fill(0), 4, 0, 0, 0xff, 1, 2, 3]));
writeFileSync(join(project, "counter.z80"), keyboardCounterSnapshot());
const screen = new Uint8Array(6912);
screen[0] = 0xff;
screen.fill(0x38, 6144);
writeFileSync(join(project, "title.scr"), screen);

/** Runs a script in the project (or in `cwd`): `result` is the body, or { error: { code, message } } for a refusal. */
function run(skill: string, script: string, ...args: string[]): { status: number | null; result: Record<string, unknown>; envelope: ScriptEnvelope } {
  return runIn(project, skill, script, ...args);
}

function runIn(cwd: string, skill: string, script: string, ...args: string[]): { status: number | null; result: Record<string, unknown>; envelope: ScriptEnvelope } {
  const child = spawnSync(process.execPath, [...process.execArgv, join(skills, skill, "scripts", script), ...args], { cwd, encoding: "utf8" });
  assert.equal(child.stderr, "", child.stderr);
  const { envelope, json } = readEnvelope(child.stdout, child.status);
  return { status: child.status, result: json as Record<string, unknown>, envelope };
}

test("spectrum-basic lists the programs of a tape with the bytes after the last line, the variables and the CODE files, and hints at the machine code", () => {
  const { status, result, envelope } = run("spectrum-basic", "basic.ts", "list", "basic.tap");
  assert.equal(status, 0);
  const body = result as { programs: Array<Record<string, unknown>>; code: unknown[] };
  assert.deepEqual(
    body.programs.map((item) => [item.block, item.name, item.autostart, item.variableBytes, item.hiddenBytes]),
    [
      [0, "loader", 10, 0, undefined],
      [4, "hidden", 10, 6, { offset: pokeLine.length, bytes: 4 }],
    ],
  );
  assert.deepEqual(body.code, [{ block: 2, name: "game", address: "$61a8", length: 2 }]);
  // The hint names the USR address with its CODE file, and the hidden bytes.
  assert.match(envelope.hint!, /\$61a8.*block 2/);
  assert.match(envelope.hint!, new RegExp(`offset ${pokeLine.length}`));
});

test("spectrum-basic gives the word that the BASIC copies into the error return at ERR_SP, with its name", () => {
  const { status, result, envelope } = run("spectrum-basic", "basic.ts", "list", "vars.tap");
  assert.equal(status, 0);
  const [item] = (result as { programs: Array<{ handoffs: unknown[]; variableBytes: number }> }).programs;
  assert.deepEqual([item!.handoffs, item!.variableBytes], [[{ kind: "err-sp", line: 10, from: "$5c4b", fromName: "VARS" }], 3]);
  assert.match(envelope.hint!, /copies VARS \(\$5c4b\) into the error return/);
  assert.match(envelope.hint!, /disassemble the 3 bytes of the variables/);
});

test("spectrum-media gives a pure-data block its length without a flag and a checksum, and read writes all its bytes", () => {
  const listing = run("spectrum-media", "media.ts", "blocks", "pure.tzx");
  assert.deepEqual((listing.result as { blocks: unknown[] }).blocks, [{ block: 0, kind: "pure-data", id: "$14", length: 4 }]);
  assert.equal(run("spectrum-media", "media.ts", "read", "pure.tzx", "0", "--out", ".c64-re-tools/local/pure.bin").status, 0);
  assert.deepEqual([...readFileSync(join(project, ".c64-re-tools/local/pure.bin"))], [0xff, 1, 2, 3]);
});

test("spectrum-media lists the blocks, writes the data of a block, gives a snapshot and draws a screen", () => {
  const listing = run("spectrum-media", "media.ts", "blocks", "game.tap");
  const blocks = listing.result as { count: number; blocks: Array<Record<string, unknown>> };
  assert.equal(blocks.count, 4);
  assert.match(listing.envelope.hint ?? "", /disassemble it at its address: block 3 at \$61a8\.$/);
  assert.match(listing.envelope.nextAction ?? "", / read game\.tap 3 --out \.c64-re-tools\/local\/game\.bin /);
  assert.deepEqual(blocks.blocks[2], { block: 2, kind: "standard", flag: "$00", length: 17, checksumOk: true, header: { type: "code", name: "game", length: 2, address: "$61a8" } });
  assert.equal(run("spectrum-media", "media.ts", "read", "game.tap", "3", "--out", ".c64-re-tools/local/game.bin").status, 0);
  assert.deepEqual([...readFileSync(join(project, ".c64-re-tools/local/game.bin"))], code);
  const state = run("spectrum-media", "media.ts", "snapshot", "counter.z80").result as { model: string; registers: { pc: string; im: number }; border: number };
  assert.deepEqual([state.model, state.registers.pc, state.registers.im, state.border], ["48k", "$8000", 1, 7]);
  const shot = run("spectrum-media", "media.ts", "screen", "title.scr", "--out", ".c64-re-tools/local/title.png");
  assert.deepEqual([shot.result.width, shot.result.height], [320, 256]);
  const png = readPng(readFileSync(join(project, ".c64-re-tools/local/title.png")));
  assert.deepEqual([png.width, png.height], [320, 256]);
});

test("the screen of a snapshot has the border of the snapshot: --border is only for a .scr file", () => {
  process.chdir(project);
  try {
    assert.equal(screenOf("counter.z80", undefined).border, 7);
    assert.throws(() => screenOf("counter.z80", 2), { code: "invalid-input", message: /^--border works only with a \.scr file/ });
  } finally {
    process.chdir(home);
  }
});

test("spectrum-memory-map names addresses, decodes the paging and exports a sjasmplus include", () => {
  const lookup = run("spectrum-memory-map", "memory-map.ts", "at", "$5c79", "ld_bytes", "$8000");
  assert.equal(lookup.envelope.hint, "The program decides the use of $8000. Find its use in the disassembly or in the emulator.");
  const found = lookup.result as { addresses: Array<Record<string, unknown>> };
  assert.deepEqual(
    found.addresses.map((item) => [item.address, item.kind, item.name, item.entryStart]),
    [
      ["$5c79", "platform", "FRAMES", "$5c78"],
      ["$0556", "platform", "LD_BYTES", undefined],
      ["$8000", "application", undefined, undefined],
    ],
  );
  assert.deepEqual(run("spectrum-memory-map", "memory-map.ts", "decode", "paging", "$17").result, { what: "paging", value: "$17", ramBank: 7, screenBank: 5, rom: 1, locked: false });
  assert.equal(run("spectrum-memory-map", "memory-map.ts", "export", "--out", ".c64-re-tools/local/zx.asm").status, 0);
  assert.match(readFileSync(join(project, ".c64-re-tools/local/zx.asm"), "utf8"), /^FRAMES EQU \$5c78 +; The frame counter/m);
});

test("spectrum-memory-map takes the model of the project machine, and gives the contention, the AY registers and the timing", () => {
  const at = (cwd: string) => (runIn(cwd, "spectrum-memory-map", "memory-map.ts", "at", "$5b5c", "$c000").result as { addresses: Array<Record<string, unknown>> }).addresses;
  // The skills project names no machine: the 48K printer buffer, contended as all of $4000-$7fff.
  assert.deepEqual(at(project).map((item) => [item.area, item.name, item.contended, item.contendedBanks]), [["printer-buffer", undefined, true, undefined], ["ram", undefined, undefined, undefined]]);
  const project128 = join(project, ".c64-re-tools", "local", "p128");
  mkdirSync(join(project128, ".c64-re-tools"), { recursive: true });
  withWrite((db) => writeMachine(db, { origin: "user" }, { machine: "spectrum128" }), project128);
  assert.deepEqual(at(project128).map((item) => [item.name, item.contended, item.contendedBanks]), [["BANK_M", true, undefined], [undefined, undefined, [1, 3, 5, 7]]]);
  assert.equal(runIn(project128, "spectrum-memory-map", "memory-map.ts", "export", "--out", ".c64-re-tools/local/zx.asm").status, 0);
  assert.match(readFileSync(join(project128, ".c64-re-tools/local/zx.asm"), "utf8"), /^BANK_M EQU \$5b5c /m);
  const ay = run("spectrum-memory-map", "memory-map.ts", "decode", "ay", "$10", "$01", "0", "0", "0", "0", "0", "$38", "15").result as { registers: string[]; channels: Array<Record<string, unknown>> };
  assert.deepEqual([ay.registers.length, ay.channels[0]!.toneHz, ay.channels[0]!.tone, ay.channels[0]!.noise, ay.channels[0]!.level], [16, 407.5, true, false, 15]);
  assert.deepEqual(run("spectrum-memory-map", "memory-map.ts", "decode", "ay-volume", "$1f").result, { what: "ay-volume", value: "$1f", level: 15, envelope: true });
  const listedNames = (list: string) => ((run("spectrum-memory-map", "memory-map.ts", "list", list).result as { entries: { listed: Array<{ name: string }> } }).entries.listed.map((item) => item.name));
  assert.equal(listedNames("ay")[7], "MIXER");
  assert.ok(listedNames("timing").includes("contentionStart"));
});
