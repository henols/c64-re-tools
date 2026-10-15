// The c64-source generator (D48): the ACME opcode table, the layout and text
// of the source, the loader plan, and with real ACME and Ghidra the
// byte-identical round trip. The ACME and Ghidra parts are skipped (never
// passed) when the tool is not installed.

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { COVERAGE, instructionLength } from "../../src/c64.ts";
import { assemble } from "../../src/native/acme.ts";
import { ACME, findTool } from "../../src/native/discover.ts";
import { findGhidra } from "../../src/native/ghidra/index.ts";
import { localToolContext } from "../../src/native/local.ts";
import { copyOrder, planLoader, readEntryState, simulate, type EntryState } from "../../skills/c64-source/scripts/loader.ts";
import { MODE_LENGTH, OPCODES } from "../../skills/c64-source/scripts/opcodes.ts";
import { entriesInData, entryOutsideImage, layout, render, type SourceInput } from "../../skills/c64-source/scripts/source.ts";

let acmeSkip: string | false = false;
try {
  findTool(ACME);
} catch {
  acmeSkip = "ACME is not installed: install acme or set C64RT_ACME to run these tests";
}
let ghidraSkip: string | false = acmeSkip;
try {
  findGhidra();
} catch {
  ghidraSkip = "Ghidra is not installed: set C64RT_GHIDRA to the Ghidra installation directory to run these tests";
}

const projects: string[] = [];
after(() => {
  for (const project of projects) rmSync(project, { recursive: true, force: true });
});

function input(bytes: number[], start: number, overrides: Partial<SourceInput> = {}): SourceInput {
  return {
    segments: [{ start, end: start + bytes.length - 1 }],
    byteAt: (address) => bytes[address - start]!,
    instructions: new Map(),
    symbols: [],
    regions: [],
    comments: [],
    modules: [],
    referenceTargets: [],
    ...overrides,
  };
}

const textOf = (rendered: ReturnType<typeof render>, name: string) => rendered.files.find((file) => file.name === name)!.text;

test("the ACME table has every opcode, with the 6502 length of each", () => {
  for (let opcode = 0; opcode < 0x100; opcode++) {
    const entry = OPCODES[opcode];
    assert.ok(entry !== undefined, `opcode ${opcode.toString(16)}`);
    assert.equal(MODE_LENGTH[entry.mode], instructionLength(opcode), `opcode ${opcode.toString(16)} ${entry.mnemonic}`);
  }
});

test("operands get names, forced sizes and labels inside instructions", () => {
  // $1000: LDA $0012 (absolute), STA $1007 (into the next instruction), LDA #0, LDA $1010 (zero page? no: absolute), JMP $1000
  const bytes = [0xad, 0x12, 0x00, 0x8d, 0x07, 0x10, 0xa9, 0x00, 0xad, 0x20, 0xd0, 0x4c, 0x00, 0x10];
  const instructions = new Map([[0x1000, 3], [0x1003, 3], [0x1006, 2], [0x1008, 3], [0x100b, 3]]);
  const laid = layout(input(bytes, 0x1000, { instructions, symbols: [{ address: 0xd020, name: "border" }, { address: 0x1000, name: "start" }] }));
  const rendered = render(laid, new Set(), ["header"]);
  const text = textOf(rendered, "segment_1000.asm");
  assert.match(text, /^start\n {8}lda\+2 \$0012$/m);
  assert.match(text, /sta l_1007\nl_1007 = \* \+ 1\n {8}lda #\$00/);
  assert.match(text, /lda border\n {8}jmp start/);
  assert.equal(textOf(rendered, "constants.asm"), "; Names outside the image.\nborder = $d020\n");
  assert.match(textOf(rendered, "main.asm"), /^; header\n\n!cpu 6510\n!source "constants.asm"\n\n\* = \$1000\n!source "segment_1000.asm"\n$/);
  assert.deepEqual([laid.namedLabels, laid.generatedLabels], [1, 1]);
});

test("tables, strings and sprites are written by their region type", () => {
  const bytes = [0x0b, 0x10, 0x0b, 0x10, 0x0a, 0x0a, 0x10, 0x10, 0x48, 0x49, 0x00, 0x60];
  const regions: SourceInput["regions"] = [
    { start: 0x1000, end: 0x1003, type: "addresses" },
    { start: 0x1004, end: 0x1007, type: "rts-addresses-split" },
    { start: 0x1008, end: 0x100a, type: "petscii" },
  ];
  const text = textOf(render(layout(input(bytes, 0x1000, { regions, instructions: new Map([[0x100b, 1]]) })), new Set(), []), "segment_1000.asm");
  assert.match(text, /!word l_100b,l_100b/);
  assert.match(text, /!byte <\(l_100b-1\),<\(l_100b-1\),>\(l_100b-1\),>\(l_100b-1\)/);
  assert.match(text, /!pet "hi"\n {8}!byte \$00\nl_100b\n {8}rts/);
});

test("knowledge that ACME cannot use is refused by name", () => {
  const bytes = [0x60];
  assert.throws(() => layout(input(bytes, 0x1000, { symbols: [{ address: 0x1000, name: "inc" }] })), /The symbol inc at \$1000 has the name of an instruction/);
  assert.throws(() => layout(input(bytes, 0x1000, { modules: [{ start: 0x1000, file: "main.asm" }] })), /which the generator writes itself/);
  const unused = layout(input(bytes, 0x1000, { modules: [{ start: 0x2000, file: "far.asm" }] })).unusedModules;
  assert.deepEqual(unused, [{ start: 0x2000, file: "far.asm" }]);
});

test("modules split a segment into files, each to the next module or the end of the segment", () => {
  const bytes = Array.from({ length: 32 }, () => 0xea);
  const laid = layout(input(bytes, 0x1000, { modules: [{ start: 0x1010, file: "second.asm", title: "Second half" }] }));
  assert.deepEqual(
    laid.pieces.map((piece) => [piece.file, piece.start, piece.end, piece.segmentStart]),
    [
      ["segment_1000.asm", 0x1000, 0x100f, true],
      ["second.asm", 0x1010, 0x101f, false],
    ],
  );
});

const state = (overrides: Partial<EntryState> = {}): EntryState => ({ pc: 0x0810, a: 0, x: 0, y: 0, sp: 0xf6, flags: 0x24, port: [0x2f, 0x37], pages: new Uint8Array(0x400), ...overrides });

test("the copy order lets no copy write over a source that is still to be copied, and a cycle has no order", () => {
  const copies = [
    { what: "a", target: { start: 0x2000, end: 0x20ff }, source: { start: 0x0900, end: 0x09ff } },
    { what: "b", target: { start: 0x0900, end: 0x09ff }, source: { start: 0x0a00, end: 0x0aff } },
  ];
  assert.deepEqual(copyOrder(copies), [0, 1], "a first: b writes over the packed bytes of a");
  assert.equal(copyOrder([copies[1]!, { what: "c", target: { start: 0x0a00, end: 0x0aff }, source: { start: 0x0900, end: 0x09ff } }]), undefined);

  const memory = new Int16Array(0x10000).fill(-1);
  for (let address = 0x0900; address <= 0x0aff; address++) memory[address] = address & 0xff;
  const ordered = copyOrder(copies)!.map((index) => ({ ...copies[index]!, backward: false }));
  assert.equal(simulate(memory, ordered, (address) => (address >= 0x2000 ? address & 0xff : (address + 0x100) & 0xff)), undefined);
});

test("the loader plan refuses a loader that would load into the I/O area, and puts the copier on free pages", () => {
  const byteAt = () => 0;
  const header: string[] = [];
  assert.throws(() => planLoader({ segments: [{ start: 0x1000, end: 0xdfff, files: ["a.asm"] }], byteAt, state: state(), entry: 0x1000, header }), /after \$cfff/);
  const plan = planLoader({ segments: [{ start: 0x0801, end: 0x0fff, files: ["a.asm"] }, { start: 0xc000, end: 0xc3ff, files: ["b.asm"] }], byteAt, state: state(), entry: 0x0810, header });
  assert.equal(plan.copier, 0xc400);
  assert.equal(plan.stackByte, 0x01f6);
  assert.match(plan.text, /ldx #\$f5\n {8}txs\n {8}lda #\$24\n {8}sta \$01f6/);
  assert.match(plan.text, /\n {8}plp\nc64_source_loader_jump jmp \$0810\n/, "the check of the loader stops at this label (F-32)");
});

test("an entry state file is read with its flags as PLP reads them, and a wrong one is refused", () => {
  const pages = Object.fromEntries(["$0000", "$0100", "$0200", "$0300"].map((page) => [page, "00".repeat(256)]));
  const read = readEntryState(JSON.stringify({ registers: { pc: "$0810", a: 1, x: 2, y: 3, sp: 0xf0, flags: { n: true, i: true, c: true } }, cpuPort: { $00: 0x2f, $01: 0x35 }, pages }), "e.json");
  assert.equal(read.flags, 0xa5);
  assert.deepEqual(read.port, [0x2f, 0x35]);
  assert.throws(() => readEntryState(JSON.stringify({ registers: { pc: "$0810" } }), "e.json"), /e.json is not an entry_state.json/);
});

test("with real ACME, data of every kind assembles to the same bytes", { skip: acmeSkip }, async () => {
  const bytes = Array.from({ length: 0x600 }, (_, index) => index & 0xff);
  const regions: SourceInput["regions"] = [
    { start: 0x2000, end: 0x20ff, type: "petscii" },
    { start: 0x2100, end: 0x21ff, type: "screen" },
    { start: 0x2200, end: 0x22ff, type: "words" },
    { start: 0x2300, end: 0x23ff, type: "addresses-split" },
    { start: 0x2400, end: 0x24ff, type: "sprite" },
    { start: 0x2500, end: 0x25ff, type: "rts-addresses" },
  ];
  const rendered = render(layout(input(bytes, 0x2000, { regions })), new Set(), []);
  const contents = rendered.files.map((file) => Buffer.from(file.text));
  const { result, attachments } = await assemble(
    { files: rendered.files.map((file, index) => ({ path: file.name, size: contents[index]!.length })), entrySource: "main.asm", includeDirs: [], defines: {} },
    contents,
    localToolContext(),
  );
  assert.equal(result.assembled, true, JSON.stringify(result.diagnostics));
  assert.deepEqual([...attachments![0]!.subarray(2)], bytes);
});

test("with real ACME, zero-page names outside the image assemble to zero-page instructions, and an address inside a platform entry is NAME+n", { skip: acmeSkip }, async () => {
  // LDA $66, STA ($66),Y, LDA $66,X, LDA $0005 (absolute), STA $0319, LDA $04, LDA $0004 (absolute), RTS;
  // $66 and $05 have names, NMINV is $0318-$0319 and ADRAY1 $03-$04, all outside the image.
  const bytes = [0xa5, 0x66, 0x91, 0x66, 0xb5, 0x66, 0xad, 0x05, 0x00, 0x8d, 0x19, 0x03, 0xa5, 0x04, 0xad, 0x04, 0x00, 0x60];
  const instructions = new Map([[0x1000, 2], [0x1002, 2], [0x1004, 2], [0x1006, 3], [0x1009, 3], [0x100c, 2], [0x100e, 3], [0x1011, 1]]);
  const symbols = [{ address: 0x66, name: "ptr" }, { address: 0x05, name: "small" }];
  const platform = [{ address: 0x03, end: 0x04, name: "ADRAY1" }, { address: 0x0318, end: 0x0319, name: "NMINV" }];
  const rendered = render(layout(input(bytes, 0x1000, { instructions, symbols, platform })), new Set(), []);
  assert.equal(textOf(rendered, "constants.asm"), "; Names outside the image.\nADRAY1 = $03\nsmall = $05\nptr = $66\nNMINV = $0318\n");
  assert.match(textOf(rendered, "segment_1000.asm"), /sta \(ptr\),y\n {8}lda ptr,x\n {8}lda\+2 small\n {8}sta NMINV\+1\n {8}lda ADRAY1\+1\n {8}lda\+2 ADRAY1\+1\n/);
  const contents = rendered.files.map((file) => Buffer.from(file.text));
  const { result, attachments } = await assemble(
    { files: rendered.files.map((file, index) => ({ path: file.name, size: contents[index]!.length })), entrySource: "main.asm", includeDirs: [], defines: {} },
    contents,
    localToolContext(),
  );
  assert.equal(result.assembled, true, JSON.stringify(result.diagnostics));
  assert.deepEqual([...attachments![0]!.subarray(2)], bytes);
});

test("with real Ghidra and ACME, the script writes source that assembles to the program, aliases as bytes", { skip: ghidraSkip, timeout: 600_000 }, async () => {
  const project = mkdtempSync(join(tmpdir(), "c64-re-tools-source-"));
  projects.push(project);
  // LDX #0; LDA $0012 (absolute); SBC #1 as $eb; NOP as $1a; ANC #$0f as $0b and as $2b; STA into the next LDA; BIT skip; RTS.
  const code = [0xa2, 0x00, 0xad, 0x12, 0x00, 0xeb, 0x01, 0x1a, 0x0b, 0x0f, 0x2b, 0x0f, 0x8d, 0x10, 0x10, 0xa9, 0x00, 0x2c, 0xa9, 0x01, 0x60];
  writeFileSync(join(project, "test.prg"), Uint8Array.from([0x00, 0x10, ...code]));
  const knowledge = resolve(import.meta.dirname, "../../skills/c64-knowledge/scripts/knowledge.ts");
  assert.equal(spawnSync(process.execPath, [...process.execArgv, knowledge, "rename", "$1000", "start", "--kind", "routine"], { cwd: project }).status, 0);
  // Files of an earlier run go, files of a person stay (F-25).
  mkdirSync(join(project, "src"));
  writeFileSync(join(project, "src", "segment_9000.asm"), "; Generated by c64-source. Do not edit: change the knowledge and generate again.\n");
  writeFileSync(join(project, "src", "loader.prg"), Uint8Array.from([0x01, 0x08]));
  writeFileSync(join(project, "src", "notes.asm"), "; my notes\n");
  writeFileSync(join(project, "src", "not_executed.json"), "{}\n");
  const child = spawn(process.execPath, [...process.execArgv, resolve(import.meta.dirname, "../../skills/c64-source/scripts/generate.ts"), "test.prg", "--out", "src"], {
    cwd: project,
    env: { ...process.env, C64RT_HOST: "127.0.0.1:1" },
    stdio: ["ignore", "pipe", "inherit"],
  });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  const json = JSON.parse(stdout) as { check: { identical: boolean }; asBytes: { listed: Array<{ address: string; instruction: string }> }; files: string[] };
  assert.equal(status, 0, stdout);
  assert.equal(json.check.identical, true);
  assert.deepEqual(json.asBytes.listed, [
    { address: "$1005", instruction: "sbc #$01" },
    { address: "$1007", instruction: "nop" },
    { address: "$100a", instruction: "anc #$0f" },
  ]);
  assert.deepEqual(json.files, ["segment_1000.asm", "constants.asm", "main.asm"]);
  const text = readFileSync(join(project, "src", "segment_1000.asm"), "utf8");
  assert.match(text, /^; Generated by c64-source\. /);
  assert.match(text, /^start\n {8}ldx #\$00\n {8}lda\+2 \$0012$/m);
  assert.deepEqual(readdirSync(join(project, "src")).sort(), ["constants.asm", "main.asm", "notes.asm", "segment_1000.asm"]);
  assert.match(text, /l_1010 = \* \+ 1\n {8}lda #\$00/);

  // With coverage, every range that no run executed goes to not_executed.json, and its mark gives the range (D49).
  const coverage = new Uint8Array(0x10000);
  for (const address of [0x1000, 0x1002]) coverage[address] = COVERAGE.ramExecute;
  writeFileSync(join(project, "run.bin"), coverage);
  const covered = spawnSync(process.execPath, [...process.execArgv, resolve(import.meta.dirname, "../../skills/c64-source/scripts/generate.ts"), "test.prg", "--out", "src", "--coverage", "run.bin"], {
    cwd: project,
    env: { ...process.env, C64RT_HOST: "127.0.0.1:1" },
    encoding: "utf8",
  });
  assert.equal(covered.status, 0, covered.stdout);
  const notExecuted = (JSON.parse(covered.stdout) as { notExecuted: { ranges: number; all: string } }).notExecuted;
  assert.equal(notExecuted.all, "src/not_executed.json");
  const all = JSON.parse(readFileSync(join(project, "src", "not_executed.json"), "utf8")) as { ranges: Array<{ start: string; end: string }> };
  assert.equal(all.ranges.length, notExecuted.ranges);
  assert.equal(all.ranges[0]!.start, "$1005");
  const marks = readFileSync(join(project, "src", "segment_1000.asm"), "utf8").match(/^; not executed .*$/gm);
  assert.deepEqual(marks, all.ranges.map((range) => `; not executed ${range.start}-${range.end}`));

  const refused = spawnSync(process.execPath, [...process.execArgv, resolve(import.meta.dirname, "../../skills/c64-source/scripts/generate.ts"), "test.prg"], { cwd: project, encoding: "utf8" });
  assert.equal(refused.status, 2, "--out is necessary");
});

test("with real Ghidra and ACME, a loader that cannot be planned still gives the checked source and says why (F-24)", { skip: ghidraSkip, timeout: 600_000 }, async () => {
  const project = mkdtempSync(join(tmpdir(), "c64-re-tools-source-"));
  projects.push(project);
  // 40 segments of 4 bytes: more copies than one loader can do. The first one starts with RTS.
  const hex = (value: number) => `$${value.toString(16).padStart(4, "0")}`;
  const segments = Array.from({ length: 40 }, (_, index) => ({ start: 0x1000 + index * 16, end: 0x1003 + index * 16 }));
  const memory = new Uint8Array(0x10000);
  for (const segment of segments) memory.fill(0x11, segment.start, segment.end + 1);
  memory[0x1000] = 0x60;
  mkdirSync(join(project, "unpacked"));
  writeFileSync(join(project, "unpacked", "image.bin"), memory);
  writeFileSync(join(project, "unpacked", "image.json"), JSON.stringify({ entry: "$1000", image: "image.bin", segments: segments.map((segment) => ({ start: hex(segment.start), end: hex(segment.end) })) }));
  writeFileSync(
    join(project, "unpacked", "entry_state.json"),
    JSON.stringify({
      registers: { pc: "$1000", a: 0, x: 0, y: 0, sp: 0xf6, flags: { n: false, v: false, b: false, d: false, i: false, z: false, c: false } },
      cpuPort: { $00: 0x2f, $01: 0x37 },
      pages: Object.fromEntries([0, 1, 2, 3].map((page) => [hex(page << 8), "00".repeat(256)])),
    }),
  );
  const run = spawnSync(process.execPath, [...process.execArgv, resolve(import.meta.dirname, "../../skills/c64-source/scripts/generate.ts"), "unpacked/image.json", "--out", "src", "--loader"], {
    cwd: project,
    env: { ...process.env, C64RT_HOST: "127.0.0.1:1" },
    encoding: "utf8",
  });
  assert.equal(run.status, 1, run.stdout + run.stderr);
  const json = JSON.parse(run.stdout) as { check: { identical: boolean }; files: string[]; loader: { verified: boolean; reason: string } };
  assert.equal(json.check.identical, true);
  assert.ok(json.files.includes("main.asm") && !json.files.includes("loader.asm"));
  assert.equal(json.loader.verified, false);
  assert.match(json.loader.reason, /needs 41 copies|needs 40 copies/);
});

test("with real Ghidra and ACME, an image whose entry is in no segment gives the checked source and fails (R2-02)", { skip: ghidraSkip, timeout: 600_000 }, async () => {
  const project = mkdtempSync(join(tmpdir(), "c64-re-tools-source-"));
  projects.push(project);
  // The program at $0801 is missing: the image has only $1000-$1003, which starts with RTS.
  const memory = new Uint8Array(0x10000);
  memory.set([0x60, 0xea, 0xea, 0xea], 0x1000);
  mkdirSync(join(project, "unpacked"));
  writeFileSync(join(project, "unpacked", "image.bin"), memory);
  writeFileSync(join(project, "unpacked", "image.json"), JSON.stringify({ entry: "$0801", image: "image.bin", segments: [{ start: "$1000", end: "$1003" }] }));
  writeFileSync(
    join(project, "unpacked", "entry_state.json"),
    JSON.stringify({
      registers: { pc: "$0801", a: 0, x: 0, y: 0, sp: 0xf6, flags: { n: false, v: false, b: false, d: false, i: false, z: false, c: false } },
      cpuPort: { $00: 0x2f, $01: 0x37 },
      pages: Object.fromEntries([0, 1, 2, 3].map((page) => [`$${(page << 8).toString(16).padStart(4, "0")}`, "00".repeat(256)])),
    }),
  );
  const generate = (...args: string[]) =>
    spawnSync(process.execPath, [...process.execArgv, resolve(import.meta.dirname, "../../skills/c64-source/scripts/generate.ts"), "unpacked/image.json", "--out", "src", ...(args.includes("--no-seed") ? [] : ["--entry", "$1000"]), ...args.filter((arg) => arg !== "--no-seed")], {
      cwd: project,
      env: { ...process.env, C64RT_HOST: "127.0.0.1:1" },
      encoding: "utf8",
    });
  const reason = /^The entry \$0801 is in no segment of the image: the image does not hold the program\. Capture it again/;
  const withLoader = generate("--loader");
  assert.equal(withLoader.status, 1, withLoader.stdout + withLoader.stderr);
  const json = JSON.parse(withLoader.stdout) as { check: { identical: boolean }; files: string[]; entryOutside: { entry: string; reason: string }; loader: { verified: boolean; reason: string } };
  assert.equal(json.check.identical, true);
  assert.ok(json.files.includes("main.asm") && !json.files.includes("loader.asm"));
  assert.equal(json.entryOutside.entry, "$0801");
  assert.equal(json.loader.verified, false);
  assert.match(json.loader.reason, reason);
  const source = generate();
  assert.equal(source.status, 1, source.stdout + source.stderr);
  assert.match((JSON.parse(source.stdout) as { entryOutside: { reason: string } }).entryOutside.reason, reason);
  // With no --entry and no knowledge, the image has no seed for Ghidra: still entryOutside, not a usage error (R3-01).
  const unseeded = generate("--no-seed", "--loader");
  assert.equal(unseeded.status, 1, unseeded.stdout + unseeded.stderr);
  const data = JSON.parse(unseeded.stdout) as { instructions: number; entryOutside: { reason: string }; loader: { verified: boolean } };
  assert.equal(data.instructions, 0);
  assert.match(data.entryOutside.reason, reason);
  assert.equal(data.loader.verified, false);
});

test("with coverage, each run of instructions that no run executed is marked and listed (D49)", () => {
  // $1000 NOP (executed), $1001 NOP, $1002 NOP, $1003-$1004 data, $1005 RTS
  const bytes = [0xea, 0xea, 0xea, 0x00, 0x00, 0x60];
  const coverage = new Uint8Array(0x10000);
  coverage[0x1000] = 0x04;
  const instructions = new Map([[0x1000, 1], [0x1001, 1], [0x1002, 1], [0x1005, 1]]);
  const regions: SourceInput["regions"] = [{ start: 0x1003, end: 0x1004, type: "bytes" }];
  const rendered = render(layout(input(bytes, 0x1000, { instructions, regions, coverage })), new Set(), []);
  assert.deepEqual(rendered.notExecuted, { instructions: 3, ranges: [{ start: 0x1001, end: 0x1002 }, { start: 0x1005, end: 0x1005 }] });
  assert.match(textOf(rendered, "segment_1000.asm"), /^ {8}nop\n; not executed \$1001-\$1002\n {8}nop\n {8}nop\n {8}!byte \$00,\$00\n; not executed \$1005-\$1005\n {8}rts\n$/m);
  assert.equal(render(layout(input(bytes, 0x1000, { instructions, regions })), new Set(), []).notExecuted, undefined);
});

test("an address without a knowledge name gets its platform name; a knowledge name wins, and a taken platform name is not used (D52)", () => {
  // STA $D020, STA $D021, JSR $FFD2, RTS
  const bytes = [0x8d, 0x20, 0xd0, 0x8d, 0x21, 0xd0, 0x20, 0xd2, 0xff, 0x60];
  const instructions = new Map([[0x1000, 3], [0x1003, 3], [0x1006, 3], [0x1009, 1]]);
  const platform = [{ address: 0xd020, end: 0xd020, name: "EXTCOL" }, { address: 0xd021, end: 0xd021, name: "BGCOL0" }, { address: 0xffd2, end: 0xffd4, name: "CHROUT" }];
  const laid = layout(input(bytes, 0x1000, { instructions, platform, symbols: [{ address: 0xd021, name: "background" }, { address: 0x2000, name: "CHROUT" }] }));
  const rendered = render(laid, new Set(), []);
  assert.match(textOf(rendered, "segment_1000.asm"), / {8}sta EXTCOL\n {8}sta background\n {8}jsr \$ffd2\n/);
  assert.equal(textOf(rendered, "constants.asm"), "; Names outside the image.\nEXTCOL = $d020\nbackground = $d021\n");
});

test("an analyzer name gives way to the platform name, and a user or LLM name still wins (D61)", () => {
  // STA $D020, STA $D021, STA $0314, RTS
  const bytes = [0x8d, 0x20, 0xd0, 0x8d, 0x21, 0xd0, 0x8d, 0x14, 0x03, 0x60];
  const instructions = new Map([[0x1000, 3], [0x1003, 3], [0x1006, 3], [0x1009, 1]]);
  const platform = [{ address: 0xd020, end: 0xd020, name: "EXTCOL" }, { address: 0xd021, end: 0xd021, name: "BGCOL0" }, { address: 0x0314, end: 0x0315, name: "CINV" }];
  const symbols: SourceInput["symbols"] = [
    { address: 0xd020, name: "ld020", origin: "dxa" },
    { address: 0xd021, name: "background", origin: "llm" },
    { address: 0x0314, name: "l0314", origin: "ghidra" },
    { address: 0x3000, name: "l3000", origin: "dxa" },
  ];
  const rendered = render(layout(input(bytes, 0x1000, { instructions, platform, symbols })), new Set(), []);
  assert.match(textOf(rendered, "segment_1000.asm"), / {8}sta EXTCOL\n {8}sta background\n {8}sta CINV\n/);
  assert.equal(textOf(rendered, "constants.asm"), "; Names outside the image.\nCINV = $0314\nEXTCOL = $d020\nbackground = $d021\n");
});

test("an address inside a platform entry gets NAME+n only when it has no name of its own and the entry name is in use (F-20)", () => {
  // STA $0319, STA $0315, STA $0317, RTS
  const bytes = [0x8d, 0x19, 0x03, 0x8d, 0x15, 0x03, 0x8d, 0x17, 0x03, 0x60];
  const instructions = new Map([[0x1000, 3], [0x1003, 3], [0x1006, 3], [0x1009, 1]]);
  const platform = [{ address: 0x0314, end: 0x0315, name: "CINV" }, { address: 0x0316, end: 0x0317, name: "CBINV" }, { address: 0x0318, end: 0x0319, name: "NMINV" }];
  // $0315 has a knowledge name; $0316 has a knowledge name too, so $0317 is that name +1; NMINV is taken by another address.
  const symbols = [{ address: 0x0315, name: "irqHigh" }, { address: 0x0316, name: "brkVector" }, { address: 0x2000, name: "NMINV" }];
  const rendered = render(layout(input(bytes, 0x1000, { instructions, platform, symbols })), new Set(), []);
  assert.match(textOf(rendered, "segment_1000.asm"), / {8}sta \$0319\n {8}sta irqHigh\n {8}sta brkVector\+1\n/);
  assert.equal(textOf(rendered, "constants.asm"), "; Names outside the image.\nirqHigh = $0315\nbrkVector = $0316\n");
});

test("an --entry in a data region of the knowledge is reported with the region (F-27)", () => {
  const regions = [
    { start: 0x0000, end: 0x04ff, type: "bytes" as const, origin: "dxa" },
    { start: 0x0500, end: 0x05ff, type: "code" as const, origin: "user" },
    { start: 0x0600, end: 0x07ff, type: "dual-use" as const, origin: "llm" },
  ];
  assert.deepEqual(entriesInData([0x0400, 0x0500, 0x0600, 0x0900], regions), [{ entry: 0x0400, region: regions[0] }]);
});

test("an image entry in no segment is named: the image does not hold the program (R2-02)", () => {
  const segments = [{ start: 0xc2ff, end: 0xcfff }, { start: 0xe000, end: 0xfffe }];
  assert.match(entryOutsideImage(0x0801, segments)!, /^The entry \$0801 is in no segment of the image: the image does not hold the program\./);
  assert.equal(entryOutsideImage(0xc300, segments), undefined);
  assert.equal(entryOutsideImage(undefined, segments), undefined);
});
