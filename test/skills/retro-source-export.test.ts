// The parts of an export that need no tool: the free ranges of planDrops,
// the tests for the new project and the README.

import assert from "node:assert/strict";
import { test } from "node:test";

import type { RegionType } from "../../src/knowledge/schema.ts";
import { blocksOf, type DropInput, planDrops, readmeText, rewriteTest } from "../../skills/retro-source/scripts/lib/export.ts";

const EXECUTE = 1 << 2;
const READ = 1 << 0;

/** A program of instructions at their addresses: the memory, the instructions and one segment over all of them. */
function program(code: Array<[number, number[]]>, data: Array<[number, number[]]> = []) {
  const memory = new Uint8Array(0x10000);
  const instructions = new Map<number, number>();
  let start = 0xffff;
  let end = 0;
  for (const [address, bytes] of code) {
    memory.set(bytes, address);
    instructions.set(address, bytes.length);
    start = Math.min(start, address);
    end = Math.max(end, address + bytes.length - 1);
  }
  for (const [address, bytes] of data) {
    memory.set(bytes, address);
    start = Math.min(start, address);
    end = Math.max(end, address + bytes.length - 1);
  }
  return { memory, instructions, segments: [{ start, end }] };
}

function input(base: ReturnType<typeof program>, more: Partial<DropInput> = {}): DropInput {
  return { ...base, entry: 0x1000, regions: [], references: [], operandTargets: new Map(), changed: [], keep: [], drop: [], routines: [], ...more };
}

function covered(addresses: number[], flag = EXECUTE): Uint8Array {
  const map = new Uint8Array(0x10000);
  for (const address of addresses) map[address] = map[address]! | flag;
  return map;
}

// $1000 start: JSR helper; RTS. $1004 helper: RTS. $1005 used: LDA #1; JSR inner; RTS (executed, no call).
// $100b inner: RTS (not executed). $100c dead: LDA #2; RTS.
const BASE = program([
  [0x1000, [0x20, 0x04, 0x10]],
  [0x1003, [0x60]],
  [0x1004, [0x60]],
  [0x1005, [0xa9, 0x01]],
  [0x1007, [0x20, 0x0b, 0x10]],
  [0x100a, [0x60]],
  [0x100b, [0x60]],
  [0x100c, [0xa9, 0x02]],
  [0x100e, [0x60]],
]);
const RAN = covered([0x1000, 0x1003, 0x1004, 0x1005, 0x1007, 0x100a]);

test("blocks end after RTS, JMP and the like, and at a gap", () => {
  assert.deepEqual(blocksOf(BASE.instructions, BASE.memory), [
    { start: 0x1000, end: 0x1003 },
    { start: 0x1004, end: 0x1004 },
    { start: 0x1005, end: 0x100a },
    { start: 0x100b, end: 0x100b },
    { start: 0x100c, end: 0x100e },
  ]);
});

test("dead code becomes free; code that ran but that the entry does not reach stays and is listed, with the code it calls", () => {
  const plan = planDrops(input(BASE, { coverage: RAN, routines: [{ address: 0x1005, name: "used" }] }));
  assert.deepEqual(plan.free, [{ start: 0x100c, end: 0x100e, what: "code" }]);
  assert.deepEqual(plan.unreachableExecuted, [{ start: 0x1005, end: 0x100a, routine: "used" }]);
  assert.equal(plan.rooted, true);
});

test("--drop makes the listed code free, and the code that only it calls goes with it", () => {
  const plan = planDrops(input(BASE, { coverage: RAN, drop: [{ start: 0x1005, end: 0x100a }] }));
  assert.deepEqual(plan.free, [{ start: 0x1005, end: 0x100e, what: "code" }]);
  assert.deepEqual(plan.unreachableExecuted, []);
});

test("--drop is refused for code that the entry reaches, for code that kept code calls, for a cut block, a changed patch and a range outside the image", () => {
  assert.throws(() => planDrops(input(BASE, { coverage: RAN, drop: [{ start: 0x1004, end: 0x1004 }] })), /holds the code \$1004-\$1004, which the entry or a vector reaches/);
  assert.throws(() => planDrops(input(BASE, { coverage: RAN, drop: [{ start: 0x100b, end: 0x100b }] })), /the code at \$1007 stays and goes to \$100b/);
  assert.throws(() => planDrops(input(BASE, { coverage: RAN, drop: [{ start: 0x100c, end: 0x100d }] })), /cuts the code \$100c-\$100e/);
  assert.throws(() => planDrops(input(BASE, { coverage: RAN, drop: [{ start: 0x100c, end: 0x100e }], changed: [{ start: 0x100c, end: 0x100e }] })), /overlaps the patch/);
  assert.throws(() => planDrops(input(BASE, { coverage: RAN, drop: [{ start: 0x100c, end: 0x1010 }] })), /\$100f is in no segment/);
  assert.throws(() => planDrops(input(BASE, { coverage: RAN, drop: [{ start: 0x100c, end: 0x100e }], keep: [{ start: 0x100e, end: 0x100e }] })), /overlaps --keep/);
});

test("instructions that Ghidra decoded in a data region are data, not dead code", () => {
  const plan = planDrops(input(BASE, { coverage: RAN, regions: [{ start: 0x100c, end: 0x100e, type: "bytes" }] }));
  // The region is data, so the data rules decide: untouched bytes that nothing names become free as data. A charset stays.
  assert.deepEqual(plan.free, [{ start: 0x100c, end: 0x100e, what: "data" }]);
  const rooms = planDrops(input(BASE, { coverage: RAN, regions: [{ start: 0x100c, end: 0x100e, type: "charset" }] }));
  assert.deepEqual(rooms.free, []);
});

test("--keep and a changed patch keep dead code", () => {
  assert.deepEqual(planDrops(input(BASE, { coverage: RAN, keep: [{ start: 0x100c, end: 0x100c }] })).free, []);
  assert.deepEqual(planDrops(input(BASE, { coverage: RAN, changed: [{ start: 0x100c, end: 0x100d }] })).free, []);
});

test("without coverage, or without an entry and vectors, nothing becomes free by itself", () => {
  assert.deepEqual(planDrops(input(BASE)).free, []);
  const noEntry = input(BASE, { coverage: RAN });
  delete noEntry.entry;
  const unrooted = planDrops(noEntry);
  assert.deepEqual([unrooted.free, unrooted.rooted], [[], false]);
  assert.deepEqual(planDrops(input(BASE, { drop: [{ start: 0x100c, end: 0x100e }] })).free, [{ start: 0x100c, end: 0x100e, what: "code" }]);
});

// $1000 start: LDX #0; LDA table,X; RTS. $1006 table: two addresses, $100a and $100b. $100a one: RTS. $100b two: RTS.
// Data: $100c unused bytes and $1010 a part of a charset. LDA table,X reads only in the table.
const TABLE = program(
  [
    [0x1000, [0xa2, 0x00]],
    [0x1002, [0xbd, 0x06, 0x10]],
    [0x1005, [0x60]],
    [0x100a, [0x60]],
    [0x100b, [0x60]],
  ],
  [
    [0x1006, [0x0a, 0x10, 0x0b, 0x10]],
    [0x100c, [1, 2, 3, 4]],
    [0x1010, [5, 6, 7, 8]],
  ],
);
const REGIONS: Array<{ start: number; end: number; type: RegionType }> = [
  { start: 0x1006, end: 0x1009, type: "addresses" },
  { start: 0x100c, end: 0x100f, type: "bytes" },
  { start: 0x1010, end: 0x1013, type: "charset" },
];

test("a table that kept code reads keeps its entries, and untouched data that nothing names becomes free, except graphics data", () => {
  const plan = planDrops(input(TABLE, { coverage: covered([0x1000, 0x1002, 0x1005]), regions: REGIONS }));
  assert.deepEqual(plan.free, [{ start: 0x100c, end: 0x100f, what: "data" }]);
});

test("an indexed read of table-1 reaches the table and stops at its end; without regions it reaches 256 bytes", () => {
  const minus = program([[0x1000, [0xbd, 0x0b, 0x10]], [0x1003, [0x60]]], [[0x100c, [1, 2, 3, 4]], [0x1010, [5, 6, 7, 8]]]);
  const ran = covered([0x1000, 0x1003]);
  const regions: Array<{ start: number; end: number; type: RegionType }> = [
    { start: 0x1004, end: 0x100b, type: "unused" },
    { start: 0x100c, end: 0x100f, type: "bytes" },
    { start: 0x1010, end: 0x1013, type: "bytes" },
  ];
  // LDA table-1,X: the operand is the last byte of $1004-$100b, so the read goes on into the table at $100c, and not further.
  assert.deepEqual(planDrops(input(minus, { coverage: ran, regions })).free, [{ start: 0x1010, end: 0x1013, what: "data" }]);
  assert.deepEqual(planDrops(input(minus, { coverage: ran, regions: [{ start: 0x1010, end: 0x1013, type: "bytes" }] })).free, []);
});

test("a run that read data, a knowledge reference and an immediate pair keep it", () => {
  const ran = covered([0x1000, 0x1002, 0x1005]);
  ran[0x100d]! |= READ;
  assert.deepEqual(planDrops(input(TABLE, { coverage: ran, regions: REGIONS })).free, []);
  assert.deepEqual(planDrops(input(TABLE, { coverage: covered([0x1000, 0x1002, 0x1005]), regions: REGIONS, references: [{ from: 0x1002, to: 0x100c, kind: "read" }] })).free, []);
});

/** The free ranges of code at $1000 that ran in full, with four unused bytes at $100c-$100f that only an address in its immediates names. */
function freeWith(code: Array<[number, number[]]>, more: Partial<DropInput> = {}) {
  const base = program(code, [[0x100c, [1, 2, 3, 4]]]);
  return planDrops(input(base, { coverage: covered(code.map(([address]) => address)), regions: [{ start: 0x100c, end: 0x100f, type: "bytes" }], ...more })).free;
}
const BYTES_FREE = [{ start: 0x100c, end: 0x100f, what: "data" }];

test("two immediates are an address when they go into a pointer, into the registers of a JSR or onto the stack", () => {
  // LDA #<$100c; STA $fb; LDA #>$100c; STA $fc; RTS
  assert.deepEqual(freeWith([[0x1000, [0xa9, 0x0c]], [0x1002, [0x85, 0xfb]], [0x1004, [0xa9, 0x10]], [0x1006, [0x85, 0xfc]], [0x1008, [0x60]]]), []);
  // LDX #<$100c; LDY #>$100c; JSR $1009; RTS ($1009: RTS), as for a KERNAL call.
  assert.deepEqual(freeWith([[0x1000, [0xa2, 0x0c]], [0x1002, [0xa0, 0x10]], [0x1004, [0x20, 0x08, 0x10]], [0x1007, [0x60]], [0x1008, [0x60]]]), []);
  // LDA #>$100c; PHA; LDA #<$100c; PHA; RTS: the RTS trick.
  assert.deepEqual(freeWith([[0x1000, [0xa9, 0x10]], [0x1002, [0x48]], [0x1003, [0xa9, 0x0c]], [0x1005, [0x48]], [0x1006, [0x60]]]), []);
  // LDA #<$100c; TAX; LDA #>$100c; STX $fb; STA $fc; RTS: a transfer keeps the immediate.
  assert.deepEqual(freeWith([[0x1000, [0xa9, 0x0c]], [0x1002, [0xaa]], [0x1003, [0xa9, 0x10]], [0x1005, [0x86, 0xfb]], [0x1007, [0x85, 0xfc]], [0x1009, [0x60]]]), []);
});

test("immediates that set chips, compare or only sit in registers are no address, and an operand row decides an immediate", () => {
  // LDA #$0c; STA $dc04; LDA #$10; STA $dc05; RTS: a CIA timer latch.
  assert.deepEqual(freeWith([[0x1000, [0xa9, 0x0c]], [0x1002, [0x8d, 0x04, 0xdc]], [0x1004, [0xa9, 0x10]], [0x1006, [0x8d, 0x05, 0xdc]], [0x1009, [0x60]]]), BYTES_FREE);
  // LDA #$0c; STA $dc0d; LDA #$10; STA $dc0d; RTS: one register two times.
  assert.deepEqual(freeWith([[0x1000, [0xa9, 0x0c]], [0x1002, [0x8d, 0x0d, 0xdc]], [0x1004, [0xa9, 0x10]], [0x1006, [0x8d, 0x0d, 0xdc]], [0x1009, [0x60]]]), BYTES_FREE);
  // LDA #$0c; LDX #$10; RTS, and CMP #$0c; CPX #$10; RTS: no store, no call.
  assert.deepEqual(freeWith([[0x1000, [0xa9, 0x0c]], [0x1002, [0xa2, 0x10]], [0x1004, [0x60]]]), BYTES_FREE);
  assert.deepEqual(freeWith([[0x1000, [0xc9, 0x0c]], [0x1002, [0xe0, 0x10]], [0x1004, [0x60]]]), BYTES_FREE);
  // LDA #$0c; STA $fb; LDA #$10; STA $fc; RTS with an operand row on the first LDA that names no address: a constant.
  const pointer: Array<[number, number[]]> = [[0x1000, [0xa9, 0x0c]], [0x1002, [0x85, 0xfb]], [0x1004, [0xa9, 0x10]], [0x1006, [0x85, 0xfc]], [0x1008, [0x60]]];
  assert.deepEqual(freeWith(pointer, { operandTargets: new Map([[0x1000, []]]) }), BYTES_FREE);
});

test("a JSR into ROM goes to no RAM code, and an immediate pair into ROM names nothing", () => {
  // $1000 JSR $1008; RTS. $1008: LDA $100c; RTS, as RAM under the KERNAL that a JSR to the ROM would decode.
  const base = program([[0x1000, [0x20, 0x08, 0x10]], [0x1003, [0x60]], [0x1008, [0xad, 0x0c, 0x10]], [0x100b, [0x60]]], [[0x100c, [1, 2, 3, 4]]]);
  const regions: Array<{ start: number; end: number; type: RegionType }> = [{ start: 0x100c, end: 0x100f, type: "bytes" }];
  assert.deepEqual(planDrops(input(base, { coverage: covered([0x1000, 0x1003]), regions })).free, [], "the RAM code at $1008 reads the bytes");
  assert.deepEqual(planDrops(input(base, { coverage: covered([0x1000, 0x1003]), regions, rom: [{ start: 0x1008, end: 0x100b }] })).free, [{ start: 0x1008, end: 0x100f, what: "code and data" }]);
});

test("the BASIC line that starts the program and the hardware vectors stay; other data at the first address becomes free", () => {
  const vectors = program([[0x1000, [0x60]]], [[0x0ffc, [9, 9, 9, 9]], [0xfffa, [0, 0x10, 0, 0x10, 0, 0x10]]]);
  vectors.segments = [{ start: 0x0ffc, end: 0x1000 }, { start: 0xfffa, end: 0xffff }];
  const regions: Array<{ start: number; end: number; type: RegionType }> = [{ start: 0x0ffc, end: 0x0fff, type: "bytes" }, { start: 0xfffa, end: 0xffff, type: "words" }];
  assert.deepEqual(planDrops(input(vectors, { coverage: covered([0x1000]), regions })).free, [{ start: 0x0ffc, end: 0x0fff, what: "data" }]);
  assert.deepEqual(planDrops(input(vectors, { coverage: covered([0x1000]), regions, basic: { start: 0x0ffc, end: 0x0ffe } })).free, []);
});

const SYMBOLS = new Map([["start", 0x1000], ["loop", 0x1003]]);

test("a scenario compares the baseline with the build, and a run file runs the build", () => {
  const scenario = rewriteTest(JSON.stringify({ name: "s", original: { program: "game.prg", symbols: "knowledge" }, rebuild: { program: "build/x.prg", symbols: "none" }, steps: [{ registers: { pc: "start" } }] }), "game", SYMBOLS, []);
  assert.ok("kind" in scenario && scenario.kind === "scenario");
  assert.deepEqual(JSON.parse(scenario.text), { name: "s", steps: [{ registers: { pc: "start" } }], original: { program: "baseline/game.prg", symbols: "baseline/symbols/game.json" }, rebuild: { program: "build/game.prg", symbols: "build/symbols/game.json" } });
  const run = rewriteTest(JSON.stringify({ start: { program: "game.prg", load: true }, steps: [{ expect: "e", memory: [{ address: "$0400", data: "01" }] }] }), "game", SYMBOLS, []);
  assert.ok("kind" in run && run.kind === "run");
  assert.deepEqual(JSON.parse(run.text), { start: { program: "build/game.prg", load: true }, steps: [{ expect: "e", memory: [{ address: "$0400", data: "01" }] }] });
});

test("in a scenario, a step of the original alone goes, and a step of the rebuild alone runs on both sides", () => {
  const steps = [{ frames: 100, side: "original" }, { type: { mode: "text", text: " " }, side: "original" }, { frames: 5, side: "rebuild" }, { observe: "o", registers: ["a"] }];
  const rewritten = rewriteTest(JSON.stringify({ name: "s", original: { program: "a.prg" }, rebuild: { program: "b.prg" }, steps }), "game", SYMBOLS, []);
  assert.ok("kind" in rewritten);
  assert.deepEqual(JSON.parse(rewritten.text).steps, [{ frames: 5 }, { observe: "o", registers: ["a"] }]);
});

test("a test is left out for a snapshot, a name that the export does not have, an address in a free range, and a file that is not a test", () => {
  const steps = (step: unknown) => JSON.stringify({ start: { program: "game.prg" }, symbols: "knowledge", steps: [step] });
  assert.deepEqual(rewriteTest(JSON.stringify({ start: { snapshot: "a.vsf" }, steps: [] }), "game", SYMBOLS, []), { reason: "it restores a snapshot, which is a state of the old program" });
  assert.deepEqual(rewriteTest(steps({ observe: "o", memory: ["lives"] }), "game", SYMBOLS, []), { reason: "it names lives, which the exported program does not have" });
  assert.deepEqual(rewriteTest(steps({ write: { address: "$1005", data: "00" } }), "game", SYMBOLS, [{ start: 0x1004, end: 0x1008 }]), { reason: "it names $1005, which is in a free range" });
  assert.deepEqual(rewriteTest("[]", "game", SYMBOLS, []), { reason: "it is not a JSON object" });
  assert.deepEqual(rewriteTest("{", "game", SYMBOLS, []), { reason: "it is not JSON" });
  assert.deepEqual(rewriteTest("{}", "game", SYMBOLS, []), { reason: "it is not a scenario or a run file" });
});

test("the README gives the commands first, then the free ranges, the files and the origin", () => {
  const text = readmeText({
    name: "game",
    project: "old",
    revision: "r1",
    date: "2026-10-18",
    entryFile: "loader.asm",
    free: [{ start: 0x1000, end: 0x10ff, what: "code" }],
    switches: [{ name: "TRAINER", kind: "trainer", value: 1 }],
    tests: { written: [{ file: "tests/a.json", kind: "scenario" }, { file: "tests/r.json", kind: "run" }], leftOut: [{ file: "tests/s.json", reason: "it restores a snapshot" }] },
  });
  const order = ["## Build", "## Test", "## Free ranges", "## Files", "## Origin"].map((heading) => text.indexOf(heading));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(text, /^Assemble `src\/loader\.asm` to `build\/game\.prg`, with its symbols in `build\/symbols\/game\.json`\.\nAssemble `src\/main\.asm` to `\.c64-re-tools\/local\/program\.prg`, and compare it with the program in the project knowledge/m);
  assert.match(text, /^- `tests\/a\.json`: run the scenario\.\n- `tests\/r\.json`: run the run file, with its results in `\.c64-re-tools\/local\/runs\/r`\.\n/m);
  assert.match(text, /\| `\$1000-\$10ff` \| 256 \| code \|/);
  assert.match(text, /\| TRAINER \| trainer \| 1 \|/);
  assert.match(text, /- `tests\/s\.json`: it restores a snapshot\./);
});
