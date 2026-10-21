// The routine library of c64-provenance (D71): a routine from the knowledge of
// one program, its file, and the search for it in another program at another
// address, with the names there as an apply batch.

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import type { CommentRow, OperandRow, ReferenceRow, RegionRow, SymbolRow } from "../../src/knowledge/read.ts";
import { Refusal } from "../../src/errors.ts";
import { findRoutine, libraryFolder, parseRoutine, readLibrary, routineFrom, routineText, saveRoutine, suggest, type ProgramKnowledge, type Routine, type RoutineSource } from "../../skills/c64-provenance/scripts/lib/library.ts";

const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-library-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

/**
 * The routine at `base` ($1000 in program A): a loop that copies a table of the
 * routine to the SID, a call inside the routine, a zero-page read, and a pointer
 * to the table as two immediates. `sid` and `zp` are the outside addresses.
 */
function routineBytes(base: number, sid = 0xd400, zp = 0xfb): number[] {
  const lo = (value: number) => value & 0xff;
  const hi = (value: number) => value >> 8;
  const table = base + 0x20;
  const pointer = base + 0x14;
  return [
    0xa2, 0x00, // LDX #$00
    0xbd, lo(table), hi(table), // LDA table,X
    0x9d, lo(sid), hi(sid), // STA sid,X
    0xe8, // INX
    0xe0, 0x07, // CPX #$07
    0xd0, 0xf5, // BNE base+2
    0x20, lo(pointer), hi(pointer), // JSR set_pointer
    0xa5, zp, // LDA zp
    0x60, // RTS
    0xea, // NOP
    0xa9, lo(table), // set_pointer: LDA #<table
    0xa0, hi(table), // LDY #>table
    0x60, // RTS
    0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, // fill to base+$20
    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, // table
  ];
}

const A = 0x1000;
const bytesA = routineBytes(A);
const END = A + bytesA.length - 1;
const row = { space: "c64", origin: "llm" as const, revision: "r" };

function source(overrides: Partial<RoutineSource> = {}): RoutineSource {
  return {
    name: "play",
    title: "The sound routine",
    program: "game-a",
    image: "a.prg",
    start: A,
    end: END,
    byteAt: (address) => bytesA[address - A]!,
    analyzed: [
      { ...row, start: A, end: A + 0x13, type: "code", origin: "ghidra" },
      { ...row, start: A + 0x14, end: A + 0x18, type: "code", origin: "ghidra" },
    ] as RegionRow[],
    symbols: [
      { ...row, address: A, name: "play", kind: "routine" },
      { ...row, address: A + 0x14, name: "set_pointer", kind: "routine" },
      { ...row, address: A + 0x20, name: "voice_table", kind: "data" },
    ] as SymbolRow[],
    regions: [{ ...row, start: A + 0x20, end: A + 0x26, type: "bytes" }] as RegionRow[],
    comments: [{ ...row, address: A + 0x14, placement: "line", text: "Point X/Y at the table." }] as CommentRow[],
    references: [
      { ...row, from: A + 0x0d, to: A + 0x14, kind: "call" },
      { ...row, from: A + 0x05, to: 0xd400, kind: "write" },
    ] as ReferenceRow[],
    operands: [
      { ...row, address: A + 0x14, select: "lo", symbol: "voice_table", offset: 0 },
      { ...row, address: A + 0x16, select: "hi", symbol: "voice_table", offset: 0 },
    ] as OperandRow[],
    platform: new Map([["SIGVOL", 0xd418]]),
    ...overrides,
  };
}

test("a routine keeps its bytes, the addresses that move with it, the operands that may differ, and its knowledge at offsets", () => {
  const { routine, leftOut } = routineFrom(source());
  assert.deepEqual(leftOut, []);
  assert.equal(routine.bytes.length, 0x27);
  assert.deepEqual(routine.instructions, [0x00, 0x02, 0x05, 0x08, 0x09, 0x0b, 0x0d, 0x10, 0x12, 0x13, 0x14, 0x16, 0x18]);
  // The code regions of the analyzer give the routine its code; other regions come from the user and the LLM.
  assert.deepEqual(routine.regions, [
    { start: 0x00, end: 0x13, type: "code" },
    { start: 0x14, end: 0x18, type: "code" },
    { start: 0x20, end: 0x26, type: "bytes" },
  ]);
  assert.deepEqual(routine.relocations, [
    { at: 0x03, size: "word", value: 0x20 },
    { at: 0x0e, size: "word", value: 0x14 },
    { at: 0x15, size: "lo", value: 0x20 },
    { at: 0x17, size: "hi", value: 0x20 },
  ]);
  // STA $d400,X and LDA $fb address something outside the routine; branches and other immediates are fixed.
  assert.deepEqual(routine.variable, [0x06, 0x07, 0x11]);
  assert.deepEqual(routine.symbols.map((symbol) => [symbol.at, symbol.name]), [[0, "play"], [0x14, "set_pointer"], [0x20, "voice_table"]]);
  // The reference to the SID leaves the routine, so it is not kept.
  assert.deepEqual(routine.references, [{ from: 0x0d, to: 0x14, kind: "call" }]);
  assert.deepEqual(routine.operands, [{ at: 0x14, select: "lo", symbol: "voice_table" }, { at: 0x16, select: "hi", symbol: "voice_table" }]);
});

test("the routine file has its keys in a fixed order and reads back the same", () => {
  const { routine } = routineFrom(source());
  const text = routineText(routine);
  assert.deepEqual(
    [...text.matchAll(/^ {2}"(\w+)":/gm)].map((match) => match[1]),
    ["name", "title", "from", "length", "bytes", "instructions", "relocations", "variable", "symbols", "regions", "comments", "references", "operands"],
  );
  assert.match(text, /^ {4}"a200bd2010[0-9a-f]{22}",$/m, "16 bytes on each line");
  assert.deepEqual(parseRoutine(text, "play.json"), routine);
  assert.equal(routineText(parseRoutine(text, "play.json")), text);
  assert.throws(() => parseRoutine(text, "other.json"), /its name play is not its file name/);
  assert.throws(() => parseRoutine(text.replace('"length": 39', '"length": 40'), "play.json"), Refusal);
});

test("a routine refuses a short range, a range without code, an instruction past its end, and a bad name", () => {
  assert.throws(() => routineFrom(source({ end: A + 14 })), /has 15 bytes\. A routine has at least 16/);
  assert.throws(() => routineFrom(source({ analyzed: [] })), /no code region/);
  assert.throws(() => routineFrom(source({ end: A + 0x10 })), /The instruction at \$1010 runs past the end \$1010/);
  assert.throws(() => routineFrom(source({ name: "1play" })), /A routine name is a letter/);
});

test("an operand expression that names something outside the routine and a table across the border are left out", () => {
  const { routine, leftOut } = routineFrom(
    source({
      operands: [
        { ...row, address: A + 0x14, select: "expr", expression: "<SIGVOL", offset: 0 },
        { ...row, address: A + 0x16, select: "hi", symbol: "music_data", offset: 0 },
      ] as OperandRow[],
      regions: [{ ...row, start: A + 0x20, end: A + 0x30, type: "bytes" }] as RegionRow[],
    }),
  );
  assert.deepEqual(routine.operands, [{ at: 0x14, select: "expr", expression: "<SIGVOL" }]);
  assert.deepEqual(routine.regions.filter((region) => region.type !== "code"), []);
  assert.deepEqual(leftOut.map((item) => item.what), ["the operand at $1016", "the bytes region $1020-$1030"]);
  // Without the operand expressions, the immediates are fixed bytes.
  assert.ok(!routine.relocations.some((relocation) => relocation.size !== "word"));
});

test("a pointer table inside the routine moves with it, also a split RTS table", () => {
  const table = [0x00, 0x10, 0x14, 0x10, 0x00, 0x20]; // $1000, $1014 (inside), $2000 (outside)
  const bytes = [...bytesA.slice(0, 0x20), ...table, 0x13, 0x13, 0x10, 0x10, 0, 0];
  const split = routineFrom(
    source({
      end: A + bytes.length - 1,
      byteAt: (address) => bytes[address - A]!,
      analyzed: [...source().analyzed, { ...row, start: A + 0x20, end: A + 0x25, type: "addresses" }, { ...row, start: A + 0x26, end: A + 0x29, type: "rts-addresses-split" }] as RegionRow[],
      regions: [],
      symbols: [],
      operands: [],
    }),
  ).routine;
  assert.deepEqual(
    split.relocations.filter((relocation) => relocation.at >= 0x20),
    [
      { at: 0x20, size: "word", value: 0x00 },
      { at: 0x22, size: "word", value: 0x14 },
      { at: 0x26, size: "lo", value: 0x13 },
      { at: 0x27, size: "lo", value: 0x13 },
      { at: 0x28, size: "hi", value: 0x13 },
      { at: 0x29, size: "hi", value: 0x13 },
    ],
  );
});

/** A program with the routine at `base` among other bytes, as one segment from $0800. */
function program(base: number, sid?: number, zp?: number): { segments: Array<{ start: number; end: number }>; byteAt: (address: number) => number } {
  const memory = new Uint8Array(0x10000);
  for (let address = 0x0800; address < 0x4000; address++) memory[address] = (address * 7) & 0xff;
  memory.set(routineBytes(base, sid, zp), base);
  return { segments: [{ start: 0x0800, end: 0x3fff }], byteAt: (address) => memory[address]! };
}

test("match finds the routine at another address, with its own outside operands listed", () => {
  const { routine } = routineFrom(source());
  assert.deepEqual(findRoutine(routine, program(A)), [{ routine: "play", start: A, shift: 0, differing: [] }]);
  assert.deepEqual(findRoutine(routine, program(0x3000, 0xd500, 0xfc)), [
    {
      routine: "play",
      start: 0x3000,
      shift: 0x2000,
      differing: [
        { address: 0x3005, library: 0xd400, program: 0xd500, size: 2 },
        { address: 0x3010, library: 0xfb, program: 0xfc, size: 1 },
      ],
    },
  ]);
  // An address into the routine that does not move with it is no match.
  const broken = program(0x3000);
  assert.deepEqual(findRoutine(routine, { ...broken, byteAt: (address) => (address === 0x3004 ? 0x10 : broken.byteAt(address)) }), []);
  // A routine outside every segment, or across a segment end, is not found.
  assert.deepEqual(findRoutine(routine, { ...program(0x3000), segments: [{ start: 0x0800, end: 0x3010 }] }), []);
});

/** Knowledge with the given rows, as match reads it. */
function knowledgeOf(rows: { symbols?: SymbolRow[]; regions?: RegionRow[]; comments?: CommentRow[]; operands?: OperandRow[]; suppressed?: number[] } = {}): ProgramKnowledge {
  const symbols = rows.symbols ?? [];
  return {
    symbolAt: (address) => symbols.find((symbol) => symbol.address === address),
    symbolNamed: (name) => symbols.find((symbol) => symbol.name === name),
    regionsOverlapping: (start, end) => (rows.regions ?? []).filter((region) => region.start <= end && region.end >= start),
    commentsAt: (address) => (rows.comments ?? []).filter((comment) => comment.address === address),
    referencesFrom: () => [],
    operandAt: (address) => (rows.operands ?? []).find((operand) => operand.address === address),
    symbolSuppressed: (address) => (rows.suppressed ?? []).includes(address),
    regionSuppressed: () => false,
    referenceSuppressed: () => false,
  };
}

test("the changes name the routine at its program addresses, with the operand expressions that fit the image", () => {
  const { routine } = routineFrom(source());
  const image = program(0x3000, 0xd500);
  const { writes: batch, known, leftOut } = suggest([{ routine, matches: findRoutine(routine, image) }], knowledgeOf(), image, new Map());
  assert.deepEqual(leftOut, []);
  assert.equal(known, 0);
  assert.deepEqual(batch, [
    { op: "rename", address: "$3000", name: "play", kind: "routine" },
    { op: "rename", address: "$3014", name: "set_pointer", kind: "routine" },
    { op: "rename", address: "$3020", name: "voice_table", kind: "data" },
    { op: "classify", start: "$3000", end: "$3013", type: "code" },
    { op: "classify", start: "$3014", end: "$3018", type: "code" },
    { op: "classify", start: "$3020", end: "$3026", type: "bytes" },
    { op: "comment", address: "$3014", placement: "line", text: "Point X/Y at the table." },
    { op: "reference", from: "$300d", to: "$3014", kind: "call" },
    { op: "operand", address: "$3014", select: "lo", symbol: "voice_table" },
    { op: "operand", address: "$3016", select: "hi", symbol: "voice_table" },
  ]);
});

test("the batch leaves out user and LLM rows, names used elsewhere, removals, and operands without their name", () => {
  const { routine } = routineFrom(source());
  const memory = new Uint8Array(0x10000);
  memory.set(routineBytes(0x3000), 0x3000);
  const image = { segments: [{ start: 0x3000, end: 0x3fff }], byteAt: (address: number) => memory[address]! };
  const program = knowledgeOf({
    symbols: [
      { ...row, address: 0x3000, name: "play", kind: "routine" }, // known
      { ...row, address: 0x2000, name: "voice_table", kind: "data" }, // used elsewhere
      { ...row, address: 0x3014, name: "init_sound", kind: "routine", origin: "user" }, // a user name
    ],
    regions: [{ ...row, start: 0x3020, end: 0x3021, type: "words", origin: "user" }],
    comments: [{ ...row, address: 0x3014, placement: "line", text: "Another text." }],
  });
  const { writes: batch, known, leftOut } = suggest([{ routine, matches: findRoutine(routine, image) }], program, image, new Map());
  assert.equal(known, 1);
  assert.deepEqual(
    leftOut.map((item) => [item.address, item.op ?? "", item.reason]),
    [
      ["$3014", "rename", "the program names it init_sound (user)"],
      ["$3020", "rename", "the program uses the name voice_table at $2000"],
      ["$3020", "classify", "the program has the words region $3020-$3021 (user)"],
      ["$3014", "comment", "the program has a line comment there (llm)"],
      ["$3014", "operand", "its name voice_table was left out"],
      ["$3016", "operand", "its name voice_table was left out"],
    ],
  );
  assert.deepEqual(batch.map((write) => write.op), ["classify", "classify", "reference"]);

  const removed = suggest([{ routine, matches: findRoutine(routine, image) }], knowledgeOf({ suppressed: [0x3000] }), image, new Map());
  assert.deepEqual(removed.leftOut[0], { routine: "play", address: "$3000", op: "rename", reason: "a removal of a name holds there" });
});

/**
 * A short routine of program v1 at `start`, all its bytes fixed: LDA #`value`
 * eight times. Each value gives a routine that occurs once.
 */
function uniqueRoutine(name: string, start: number, value: number): Routine {
  return {
    name,
    from: { program: "v1", image: "v1.prg", start },
    bytes: Uint8Array.from({ length: 16 }, (_, index) => (index % 2 === 0 ? 0xa9 : value)),
    instructions: [0, 2, 4, 6, 8, 10, 12, 14],
    relocations: [],
    variable: [],
    symbols: [{ at: 0, name, kind: "routine" }],
    regions: [],
    comments: [],
    references: [],
    operands: [],
  };
}

/** A fill routine of program v1 at $2010: LDA abs five times and RTS, its ten operand bytes variable, so it fits at many places. */
const FILL_BYTES = [0xad, 0x00, 0x00, 0xad, 0x00, 0x00, 0xad, 0x00, 0x00, 0xad, 0x00, 0x00, 0xad, 0x00, 0x00, 0x60];
const fill: Routine = {
  ...uniqueRoutine("fill_row", 0x2010, 0),
  bytes: Uint8Array.from(FILL_BYTES),
  instructions: [0, 3, 6, 9, 12, 15],
  variable: [1, 2, 4, 5, 7, 8, 10, 11, 13, 14],
  comments: [{ at: 0, placement: "line", text: "Fills the row $2010-$201F of the colour RAM at $d800." }],
};

/** Bytes where the fill routine fits two times, at `at` and at `at` + 1. */
const TWO_FILLS = [0xad, 0xad, 0x00, 0xad, 0xad, 0x00, 0xad, 0xad, 0x00, 0xad, 0xad, 0x00, 0xad, 0xad, 0x00, 0x60, 0x60];

/** An image of the segment $3000-$3fff with the given bytes at their addresses, and zero bytes between. */
function imageOf(places: Array<[number, readonly number[]]>): { segments: Array<{ start: number; end: number }>; byteAt: (address: number) => number } {
  const memory = new Uint8Array(0x10000);
  for (const [at, bytes] of places) memory.set(bytes, at);
  return { segments: [{ start: 0x3000, end: 0x3fff }], byteAt: (address) => memory[address]! };
}

test("match keeps the copies of a short routine that overlap", () => {
  const image = imageOf([[0x3010, FILL_BYTES], [0x3100, TWO_FILLS]]);
  assert.deepEqual(findRoutine(fill, image).map((match) => [match.start, match.shift]), [[0x3010, 0x1000], [0x3100, 0x10f0], [0x3101, 0x10f1]]);
});

test("a routine with several copies gets its names at the copy that has the shift of its neighbours in the library", () => {
  // The block $2000-$202f of v1 moved by $1000; two other places also fit the fill routine.
  const left = uniqueRoutine("draw_left", 0x2000, 1);
  const right = uniqueRoutine("draw_right", 0x2020, 2);
  const image = imageOf([[0x3000, [...left.bytes]], [0x3010, FILL_BYTES], [0x3020, [...right.bytes]], [0x3100, TWO_FILLS]]);
  const found = [left, fill, right].map((routine) => ({ routine, matches: findRoutine(routine, image) }));
  const { writes: batch, leftOut, check } = suggest(found, knowledgeOf(), image, new Map());
  assert.deepEqual(batch, [
    { op: "rename", address: "$3000", name: "draw_left", kind: "routine" },
    { op: "rename", address: "$3010", name: "fill_row", kind: "routine" },
    { op: "comment", address: "$3010", placement: "line", text: "Fills the row $3010-$301F of the colour RAM at $d800." },
    { op: "rename", address: "$3020", name: "draw_right", kind: "routine" },
  ]);
  const reason = "another copy of the routine; the copy at $3010 has the shift 4096 of its library neighbours draw_left and draw_right";
  assert.deepEqual(leftOut, [
    { routine: "fill_row", address: "$3100", reason },
    { routine: "fill_row", address: "$3101", reason },
  ]);
  // The address of the colour RAM is outside the routine: the agent examines the comment.
  assert.deepEqual(check, [{ routine: "fill_row", address: "$3010", comment: "Fills the row $3010-$301F of the colour RAM at $d800.", outside: ["$d800"] }]);

  // At the border of a moved block, one neighbour is enough when only one copy has its shift.
  const moved = uniqueRoutine("draw_right", 0x2020, 2);
  const border = imageOf([[0x3000, [...left.bytes]], [0x3010, FILL_BYTES], [0x3500, [...moved.bytes]], [0x3100, TWO_FILLS]]);
  const chosen = suggest([left, fill, moved].map((routine) => ({ routine, matches: findRoutine(routine, border) })), knowledgeOf(), border, new Map());
  assert.ok(chosen.writes.some((write) => write.name === "fill_row" && write.address === "$3010"));
  assert.match(chosen.leftOut[0]!.reason, /the copy at \$3010 has the shift 4096 of its library neighbour draw_left$/);

  // The moved comment is the comment that the program has already: it is known, not written.
  const known = suggest(found, knowledgeOf({ comments: [{ ...row, address: 0x3010, placement: "line", text: "Fills the row $3010-$301F of the colour RAM at $d800." }] }), image, new Map());
  assert.equal(known.known, 1);
  assert.deepEqual(known.check, []);
});

test("a routine with several copies gets no names when the shift of no neighbour chooses one copy", () => {
  const left = uniqueRoutine("draw_left", 0x2000, 1);
  const right = uniqueRoutine("draw_right", 0x2020, 2);
  const ambiguous = (found: Array<{ routine: Routine; matches: ReturnType<typeof findRoutine> }>, image: ReturnType<typeof imageOf>) => {
    const { writes: batch, leftOut } = suggest(found, knowledgeOf(), image, new Map());
    assert.ok(!batch.some((write) => write.name === "fill_row" || write.op === "comment"), JSON.stringify(batch));
    assert.deepEqual(
      leftOut.map((item) => [item.address, item.reason]),
      ["$3010", "$3100", "$3101"].map((address) => [address, "ambiguous: 3 copies of the routine, and the shift of no library neighbour chooses one copy"]),
    );
  };
  // The neighbours moved by $1000 and by $10f1, and a copy has each shift.
  const split = imageOf([[0x3000, [...left.bytes]], [0x3010, FILL_BYTES], [0x3100, TWO_FILLS], [0x3111, [...right.bytes]]]);
  ambiguous([left, fill, right].map((routine) => ({ routine, matches: findRoutine(routine, split) })), split);
  // A library without neighbours of the routine.
  const alone = imageOf([[0x3010, FILL_BYTES], [0x3100, TWO_FILLS]]);
  ambiguous([{ routine: fill, matches: findRoutine(fill, alone) }], alone);
});

test("the library is a plain folder: routine refuses a name that exists, and a project folder is no library", () => {
  const folder = libraryFolder("lib", { create: true, cwd: scratch });
  const { routine } = routineFrom(source());
  saveRoutine(folder, routine, false);
  assert.throws(() => saveRoutine(folder, routine, false), /already has the routine play\. Give another --name, or give --replace/);
  saveRoutine(folder, { ...routine, title: "Changed" }, true);
  assert.equal(readLibrary(folder)[0]!.title, "Changed");
  assert.match(readFileSync(join(folder, "play.json"), "utf8"), /"title": "Changed"/);
  writeFileSync(join(folder, "broken.json"), "{}");
  assert.throws(() => readLibrary(folder), /broken\.json is not a routine file of the library/);

  assert.throws(() => libraryFolder("missing", { create: false, cwd: scratch }), /There is no library folder missing/);
  mkdirSync(join(scratch, "game", ".c64-re-tools"), { recursive: true });
  assert.throws(() => libraryFolder("game", { create: true, cwd: scratch }), /game is a project folder\. A library is a plain folder/);
});

test("routine refuses a library in the knowledge of the project, also through a symbolic link, and makes no folder there", () => {
  const project = join(scratch, "project");
  mkdirSync(join(project, ".c64-re-tools", "knowledge"), { recursive: true });
  const knowledge = /--library: \.c64-re-tools\/knowledge(\/x3)? is in \.c64-re-tools\/knowledge\/, the knowledge of the project\. Only the commands that change the project knowledge write it: a write there destroys the knowledge\. Give a library folder beside the projects, for example \.\.\/library\.$/;
  assert.throws(() => libraryFolder(".c64-re-tools/knowledge", { create: true, cwd: project }), (error: unknown) => error instanceof Refusal && error.code === "invalid-input" && knowledge.test(error.message));
  assert.throws(() => libraryFolder(".c64-re-tools/knowledge/x3", { create: true, cwd: project }), knowledge);
  assert.equal(existsSync(join(project, ".c64-re-tools", "knowledge", "x3")), false);
  symlinkSync(join(project, ".c64-re-tools", "knowledge"), join(scratch, "linked"));
  assert.throws(() => libraryFolder("../linked", { create: true, cwd: project }), knowledge);
  // A library beside the project and a folder of the project outside the knowledge stay possible.
  assert.equal(libraryFolder("../library", { create: true, cwd: project }), join(scratch, "library"));
  assert.equal(libraryFolder(".c64-re-tools/local/library", { create: true, cwd: project }), join(project, ".c64-re-tools", "local", "library"));
});
