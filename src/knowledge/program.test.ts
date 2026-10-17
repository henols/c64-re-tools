import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { Refusal } from "../errors.ts";
import { COVERAGE } from "../c64.ts";
import { indexPath, openForRead, textPath, withWrite } from "./database.ts";
import { listSpaces } from "./read.ts";
import { addCoverage, analyzedBytes, coverageRuns, programCoverage, programImage, setImage, type ImageRequest } from "./program.ts";
import { revert } from "./write.ts";

const projects: string[] = [];
after(() => {
  for (const root of projects) rmSync(root, { recursive: true, force: true });
});

function project(): string {
  const root = mkdtempSync(join(tmpdir(), "c64-re-tools-program-"));
  projects.push(root);
  return root;
}

const llm = { origin: "llm" as const };
const text = (root: string, file: string) => readFileSync(join(textPath(root), file), "utf8");
const lines = (root: string, file: string) => text(root, file).trim().split("\n");

/** The image of a 64 KiB memory in which each byte is the low byte of its address plus `seed`. */
function image(segments: Array<{ start: number; end: number }>, seed = 0, extra: Partial<ImageRequest> = {}): ImageRequest {
  return { segments, byteAt: (address) => (address + seed) & 0xff, ...extra };
}

/** Reads the program again from the text only: the index is made again. */
function fromText(root: string) {
  rmSync(indexPath(root), { force: true });
  const db = openForRead(root)!;
  try {
    return { image: programImage(db), coverage: programCoverage(db), spaces: listSpaces(db) };
  } finally {
    db.close();
  }
}

test("an image goes into the text in rows of at most 64 bytes and comes back the same", () => {
  const root = project();
  const state = { registers: { pc: "$0400", a: 1 }, pages: { $0000: "2f37" } };
  const stages = [{ stage: 0, entry: "$0871", wrote: [{ start: "$0400", end: "$07e7" }] }];
  const written = withWrite((db) => setImage(db, llm, image([{ start: 0x0801, end: 0x0900 }, { start: 0xc000, end: 0xc003 }], 0, { entry: 0x0810, state, stages })), root);
  assert.equal(written.current.bytes, 0x100 + 4);
  // $0801-$083f, then whole rows of 64, then the end of the segment; one row for $c000-$c003.
  assert.equal(written.current.rowsAdded, 6);
  assert.match(lines(root, "memory.jsonl")[0]!, /^\{"id":"[^"]+\/1","space":"c64","at":"\$0801","bytes":"0102[0-9a-f]+3f","origin":"llm","added":"[^"]+","closed":null\}$/);
  assert.match(text(root, "entry.jsonl"), /"entry":"\$0810","state":\{"registers":\{"pc":"\$0400","a":1\},"pages":\{"\$0000":"2f37"\}\},"stages":\[/);
  const read = fromText(root);
  assert.deepEqual(read.image!.segments, [{ start: 0x0801, end: 0x0900 }, { start: 0xc000, end: 0xc003 }]);
  assert.equal(read.image!.byteAt(0x08ff), 0xff);
  assert.equal(read.image!.byteAt(0xc003), 0x03);
  assert.equal(read.image!.entry, 0x0810);
  assert.deepEqual(read.image!.state, state);
  assert.deepEqual(read.image!.stages, stages);
  assert.deepEqual(read.spaces, ["c64"]);
});

test("an image that the knowledge has writes nothing, and a changed byte replaces only its row", () => {
  const root = project();
  const segments = [{ start: 0x1000, end: 0x10ff }];
  withWrite((db) => setImage(db, llm, image(segments)), root);
  const again = withWrite((db) => setImage(db, llm, image(segments)), root);
  assert.equal(again.revision, null);
  const patched: ImageRequest = { segments, byteAt: (address) => (address === 0x1042 ? 0xea : address & 0xff) };
  const changed = withWrite((db) => setImage(db, llm, patched), root);
  assert.deepEqual([changed.current.rowsAdded, changed.current.rowsClosed], [1, 1]);
  assert.equal(fromText(root).image!.byteAt(0x1042), 0xea);
  // A shorter image closes the rows it no longer has; history keeps them.
  withWrite((db) => setImage(db, llm, image([{ start: 0x1000, end: 0x103f }])), root);
  assert.deepEqual(fromText(root).image!.segments, [{ start: 0x1000, end: 0x103f }]);
  assert.equal(lines(root, "memory.jsonl").length, 5);
});

test("a PRG without an entry closes the entry of an earlier capture, and spaces stay apart", () => {
  const root = project();
  withWrite((db) => setImage(db, llm, image([{ start: 0x0400, end: 0x04ff }], 0, { entry: 0x0400, state: { registers: {} } })), root);
  withWrite((db) => setImage(db, llm, image([{ start: 0x0300, end: 0x03ff }], 7, { space: "drive8" })), root);
  withWrite((db) => setImage(db, llm, image([{ start: 0x0400, end: 0x04ff }])), root);
  const db = openForRead(root)!;
  try {
    assert.equal(programImage(db)!.entry, undefined);
    assert.equal(programImage(db, "drive8")!.byteAt(0x0300), 7);
    assert.deepEqual(listSpaces(db), ["c64", "drive8"]);
    assert.equal(programImage(db, "bank0"), undefined);
  } finally {
    db.close();
  }
});

test("an image is refused when its segments overlap or a state has no entry", () => {
  const root = project();
  const refused = (code: string) => (error: unknown) => error instanceof Refusal && error.code === code;
  assert.throws(() => withWrite((db) => setImage(db, llm, image([{ start: 0x1000, end: 0x1010 }, { start: 0x1010, end: 0x1020 }])), root), refused("invalid-input"));
  assert.throws(() => withWrite((db) => setImage(db, llm, image([{ start: 0x1000, end: 0x1010 }], 0, { state: {} })), root), refused("invalid-input"));
});

test("analyzed bytes are a PRG for one segment without a state, else the 64 KiB", () => {
  const root = project();
  withWrite((db) => setImage(db, llm, image([{ start: 0x0801, end: 0x0803 }])), root);
  assert.deepEqual(analyzedBytes(fromText(root).image!), { bytes: Buffer.from([0x01, 0x08, 0x01, 0x02, 0x03]), kind: "prg" });
  withWrite((db) => setImage(db, llm, image([{ start: 0x0801, end: 0x0803 }], 0, { entry: 0x0801, state: {} })), root);
  const flat = analyzedBytes(fromText(root).image!);
  assert.equal(flat.kind, "flat64k");
  assert.equal(flat.bytes.length, 0x10000);
});

/** A coverage map with `flags` at each address of the ranges. */
function map(...ranges: Array<[number, number, number]>): Uint8Array {
  const bytes = new Uint8Array(0x10000);
  for (const [start, end, flags] of ranges) for (let address = start; address <= end; address++) bytes[address]! |= flags;
  return bytes;
}

test("coverage maps join into ranges of each kind, and one run's write and execute is wx", () => {
  const root = project();
  const { ramExecute: x, ramWrite: w, ramRead: r, romRead } = COVERAGE;
  const first = map([0x1000, 0x1000, x], [0x1003, 0x1003, x], [0x2000, 0x2003, r], [0xe000, 0xe001, romRead], [0x3000, 0x3000, w]);
  // The second run writes and executes $3001: self-modified. $3000 is written in run one and executed in run two: no wx.
  const second = map([0x1000, 0x1000, x], [0x1006, 0x1006, x], [0x3000, 0x3000, x], [0x3001, 0x3001, w | x]);
  const written = withWrite((db) => addCoverage(db, llm, { maps: [{ name: "local/a.bin", bytes: first }, { name: "local/b.bin", bytes: second }] }), root);
  assert.deepEqual(written.current.imported, ["local/a.bin", "local/b.bin"]);
  const coverage = fromText(root).coverage!;
  for (const address of [0x1000, 0x1003, 0x1006, 0x3000, 0x3001]) assert.ok(coverage.map[address]! & x, `x at ${address}`);
  assert.equal(coverage.map[0x1001]! & x, 0);
  assert.equal(coverage.map[0x2003], r);
  assert.equal(coverage.map[0xe001], romRead);
  assert.deepEqual([coverage.selfModified[0x3000], coverage.selfModified[0x3001]], [0, 1]);
  // Ranges only for flags that no earlier run set: $1000 of run two adds no row.
  assert.equal(lines(root, "coverage.jsonl").filter((line) => line.includes('"start":"$1000"')).length, 1);
  const revision = JSON.parse(lines(root, "revisions.jsonl").at(-1)!) as { operation: string; evidence: Array<{ kind: string; ref: string; sha256: string }> };
  assert.equal(revision.operation, "coverage");
  assert.deepEqual(revision.evidence.map((item) => item.ref), ["local/a.bin", "local/b.bin"]);
});

test("a coverage map that the knowledge has is not imported again; one that adds no flag is still evidence", () => {
  const root = project();
  const bytes = map([0x1000, 0x1002, COVERAGE.ramExecute]);
  withWrite((db) => addCoverage(db, llm, { maps: [{ name: "a.bin", bytes }] }), root);
  const again = withWrite((db) => addCoverage(db, llm, { maps: [{ name: "a.bin", bytes }] }), root);
  assert.equal(again.revision, null);
  assert.deepEqual(again.current.known, ["a.bin"]);
  const subset = withWrite((db) => addCoverage(db, llm, { maps: [{ name: "b.bin", bytes: map([0x1001, 0x1001, COVERAGE.ramExecute]) }] }), root);
  assert.notEqual(subset.revision, null);
  assert.equal(subset.current.ranges, 0);
  const db = openForRead(root)!;
  try {
    assert.deepEqual(coverageRuns(db).map((run) => [run.name, run.space]), [["a.bin", "c64"], ["b.bin", "c64"]]);
  } finally {
    db.close();
  }
  assert.throws(() => withWrite((db) => addCoverage(db, llm, { maps: [{ name: "short.bin", bytes: new Uint8Array(10) }] }), root), (error: unknown) => error instanceof Refusal && error.code === "invalid-input");
});

test("revert takes the image and the coverage back too", () => {
  const root = project();
  const segments = [{ start: 0x1000, end: 0x103f }];
  const first = withWrite((db) => setImage(db, llm, image(segments)), root);
  withWrite((db) => setImage(db, llm, image(segments, 1, { entry: 0x1000 })), root);
  withWrite((db) => addCoverage(db, llm, { maps: [{ name: "a.bin", bytes: map([0x1000, 0x1000, COVERAGE.ramExecute]) }] }), root);
  withWrite((db) => revert(db, llm, { revision: first.revision! }), root);
  const read = fromText(root);
  assert.equal(read.image!.byteAt(0x1000), 0x00);
  assert.equal(read.image!.entry, undefined);
  assert.equal(read.coverage, undefined);
});

test("a coverage map is known only in the space that it went into, and the runs of a name are oldest first", () => {
  const root = project();
  const first = map([0x1000, 0x1002, COVERAGE.ramExecute]);
  const second = map([0x2000, 0x2002, COVERAGE.ramExecute]);
  withWrite((db) => addCoverage(db, llm, { maps: [{ name: "a.bin", bytes: first }] }), root);
  const drive = withWrite((db) => addCoverage(db, llm, { space: "drive8", maps: [{ name: "a.bin", bytes: first }] }), root);
  assert.deepEqual(drive.current.imported, ["a.bin"]);
  assert.equal(drive.current.ranges, 1);
  withWrite((db) => addCoverage(db, llm, { maps: [{ name: "a.bin", bytes: second }] }), root);
  const db = openForRead(root)!;
  try {
    const runs = coverageRuns(db);
    assert.deepEqual(runs.map((run) => run.space), ["c64", "drive8", "c64"]);
    assert.deepEqual([...runs].sort((a, b) => a.revision.localeCompare(b.revision)), runs);
    assert.equal(runs.filter((run) => run.space === "c64").at(-1)!.sha256, runs[2]!.sha256);
  } finally {
    db.close();
  }
});
