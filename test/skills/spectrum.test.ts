// The ZX Spectrum skill scripts on a project with a tape, a snapshot and a
// screen: spectrum-basic, spectrum-media and spectrum-memory-map.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { readPng } from "../../src/graphics.testkit.ts";
import { keyboardCounterSnapshot } from "../fixtures/z80/keyboard-counter.ts";
import { readEnvelope, type ScriptEnvelope } from "../kit.ts";

const skills = resolve(import.meta.dirname, "../../skills");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-spectrum-skills-"));
mkdirSync(join(project, ".c64-re-tools", "local"), { recursive: true });
after(() => rmSync(project, { recursive: true, force: true }));

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
writeFileSync(join(project, "game.tap"), Uint8Array.from([...header(0, "loader", program.length, 10, program.length), ...tapBlock(0xff, program), ...header(3, "game", code.length, 25000, 32768), ...tapBlock(0xff, code)]));
writeFileSync(join(project, "counter.z80"), keyboardCounterSnapshot());
const screen = new Uint8Array(6912);
screen[0] = 0xff;
screen.fill(0x38, 6144);
writeFileSync(join(project, "title.scr"), screen);

/** Runs a script in the project: `result` is the body, or { error: { code, message } } for a refusal. */
function run(skill: string, script: string, ...args: string[]): { status: number | null; result: Record<string, unknown>; envelope: ScriptEnvelope } {
  const child = spawnSync(process.execPath, [...process.execArgv, join(skills, skill, "scripts", script), ...args], { cwd: project, encoding: "utf8" });
  assert.equal(child.stderr, "", child.stderr);
  const { envelope, json } = readEnvelope(child.stdout, child.status);
  return { status: child.status, result: json as Record<string, unknown>, envelope };
}

test("spectrum-basic lists the loader of a tape with the hidden number, its handoffs and the CODE file", () => {
  const { status, result, envelope } = run("spectrum-basic", "basic.ts", "list", "game.tap");
  assert.equal(status, 0);
  assert.equal(envelope.hint, "Disassemble the machine code at $61a8. The CODE file game at block 2 loads to that address.");
  assert.deepEqual(result, {
    programs: [
      {
        block: 0,
        name: "loader",
        autostart: 10,
        listing: ['10 CLEAR 24999: LOAD "" CODE : RANDOMIZE USR 0{=25000}'],
        handoffs: [
          { kind: "clear", line: 10, address: "$61a7" },
          { kind: "load-code", line: 10 },
          { kind: "usr", line: 10, address: "$61a8" },
        ],
        variableBytes: 0,
      },
    ],
    code: [{ block: 2, name: "game", address: "$61a8", length: 2 }],
  });
  const refused = run("spectrum-basic", "basic.ts", "list", "title.scr");
  assert.equal(refused.status, 2);
  assert.deepEqual([refused.envelope.ok, refused.envelope.code], [false, "invalid-input"]);
  assert.match(String((refused.result.error as { message: string }).message), /is no BASIC program/);
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
  assert.equal(run("spectrum-media", "media.ts", "screen", "counter.z80", "--border", "2", "--out", ".c64-re-tools/local/x.png").status, 2);
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

test("spectrum-basic tells the bytes after the last line apart from the variables, and gives a POKE of ERR_SP as a handoff", () => {
  // 10 POKE 23613,0: the program length of the header holds 4 more bytes of machine code after the line; 6 bytes of variables follow.
  const line = basicLine(10, [0xf4, ...literal("23613"), 0x2c, ...literal("0")]);
  const hidden = [0xf3, 0x31, 0x00, 0x80];
  const variables = [0x61, 0, 0, 1, 0, 0];
  const data = [...line, ...hidden, ...variables];
  writeFileSync(join(project, "hidden.tap"), Uint8Array.from([...header(0, "hidden", data.length, 10, line.length + hidden.length), ...tapBlock(0xff, data)]));
  const { status, result, envelope } = run("spectrum-basic", "basic.ts", "list", "hidden.tap");
  assert.equal(status, 0);
  const [listed] = (result as { programs: Array<Record<string, unknown>> }).programs;
  assert.deepEqual([listed!.variableBytes, listed!.hiddenBytes], [6, { offset: line.length, bytes: 4 }]);
  assert.deepEqual(listed!.handoffs, [{ kind: "err-sp", line: 10 }]);
  assert.match(envelope.hint!, /Line 10 changes the error return at ERR_SP: an error or the end of the BASIC then starts machine code\./);
  assert.match(envelope.hint!, new RegExp(`The program hidden has 4 bytes after its last line at offset ${line.length} of the program, which LIST does not show`));
});
