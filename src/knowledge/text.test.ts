import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { Refusal } from "../errors.ts";
import { openForWrite, textPath } from "./database.ts";
import { ensureSchema } from "./schema.ts";
import { loadText, newRevisionId, REVISION_ID, REVISIONS_FILE, revisionsText, TABLES, tableText } from "./text.ts";
import { importFindings } from "./import.ts";
import { applyBatch, renameSymbol, setRelease, setStartScreen, setSwitch, unclassifyRegion } from "./write.ts";
import { addCoverage, setImage } from "./program.ts";
import { COVERAGE } from "../c64.ts";

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function root(): string {
  const folder = mkdtempSync(join(tmpdir(), "c64-re-tools-text-"));
  roots.push(folder);
  return folder;
}

function emptyIndex(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  ensureSchema(db);
  return db;
}

/** The text of every knowledge file of an index. */
function allText(db: DatabaseSync): Map<string, { text: string }> {
  const files = new Map([[REVISIONS_FILE, { text: revisionsText(db) }]]);
  for (const spec of TABLES) files.set(spec.file, { text: tableText(db, spec) });
  return files;
}

/** NOP from $8000, so the code region decodes to $8079 LDA #$c0; $8100 INC $fb, BNE +2, INC $fc. */
const bytes = new Map([[0x8079, 0xa9], [0x807a, 0xc0], [0x8100, 0xe6], [0x8101, 0xfb], [0x8102, 0xd0], [0x8103, 0x02], [0x8104, 0xe6], [0x8105, 0xfc]]);
const image = { byteAt: (address: number) => bytes.get(address) ?? (address >= 0x8000 && address < 0x8079 ? 0xea : undefined), platform: new Map<string, number>() };

/** A project with a row in every table and a revision with evidence. */
function fullProject(): { folder: string; db: DatabaseSync } {
  const folder = root();
  const db = openForWrite(folder);
  applyBatch(db, { origin: "llm", description: "everything", evidence: [{ kind: "note", ref: "seen in a run" }, { kind: "file", ref: "notes.md", sha256: "a".repeat(64) }] }, [
    { op: "rename", address: 0x80c0, name: "irq_handler", kind: "routine" },
    { op: "rename", address: 0x0400, name: "screen", space: "drive8" },
    { op: "classify", start: 0x9000, end: 0x90ff, type: "words", element: 2 },
    { op: "classify", start: 0x8000, end: 0x80ff, type: "code" },
    { op: "comment", address: 0x80c0, placement: "line", text: "The raster interrupt." },
    { op: "reference", from: 0x8000, to: 0x80c0, kind: "call" },
    { op: "module", start: 0x8000, file: "main_loop.asm", title: "Main loop" },
  ]);
  setRelease(db, { origin: "user" }, { label: "ORIGINAL", file: "original/game.prg", sha256: "b".repeat(64), base: true, comment: "The first release." });
  setSwitch(db, { origin: "user", image }, { name: "CRACK", kind: "crack", comment: "The crack skips the check." });
  applyBatch(db, { origin: "user", image }, [
    { op: "operand", address: 0x8079, select: "lo", symbol: "irq_handler" },
    { op: "patch", start: 0x8079, end: 0x807a, switch: "CRACK", code: "lda #0", comment: "No check." },
    { op: "macro", name: "inc16", params: ["dst"], body: "inc .dst\nbne +\ninc .dst+1\n+" },
    { op: "use", start: 0x8100, end: 0x8105, macro: "inc16", args: ["$fb"] },
  ]);
  unclassifyRegion(db, { origin: "user" }, { start: 0x9000, end: 0x900f });
  setStartScreen(db, { origin: "user" }, { mode: "multicolour", screen: 0x5c00, bitmap: 0x6000, colours: 0x7f40, border: 0, background: 6, comment: "The loading picture." });
  renameSymbol(db, { origin: "user" }, { address: 0x80c0, name: "raster_irq" });
  setImage(db, { origin: "user" }, { segments: [{ start: 0x8000, end: 0x8105 }], byteAt: (address) => address & 0xff, entry: 0x8000, state: { registers: { pc: "$8000" } }, stages: [{ stage: 0 }] });
  const run = new Uint8Array(0x10000);
  run[0x8000] = COVERAGE.ramExecute | COVERAGE.ramWrite;
  addCoverage(db, { origin: "user" }, { maps: [{ name: "local/run.bin", bytes: run }] });
  importFindings(db, { analyzer: "ghidra", coverage: [{ start: 0xa000, end: 0xa0ff }], authoritative: { symbols: true, regions: true, references: true }, symbols: [{ address: 0xa000, name: "FUN_a000", kind: "routine" }], regions: [], references: [] });
  return { folder, db };
}

test("a revision id is the CET time and a random part, and it sorts after the one before", () => {
  const now = new Date("2026-10-15T20:45:01.123Z");
  const random = new Uint8Array([0, 1, 10, 35, 36, 255]);
  const id = newRevisionId("0", now, random);
  assert.equal(id, "20261015T214501.123-01az03");
  assert.match(id, REVISION_ID);
  // A clock that stands still or goes back still gives a later id.
  assert.equal(newRevisionId(id, now, random), "20261015T214501.124-01az03");
  assert.equal(newRevisionId(id, new Date("2026-10-15T19:00:00.000Z"), random), "20261015T214501.124-01az03");
  assert.equal(newRevisionId(id, new Date("2026-10-15T21:00:00.000Z"), random), "20261015T220000.000-01az03");
  assert.notEqual(newRevisionId("0", now), newRevisionId("0", now), "two computers at the same time get different ids");
});

test("every table and the revision log go to text and back unchanged", () => {
  const { db } = fullProject();
  const files = allText(db);
  const again = emptyIndex();
  loadText(again, files);
  assert.deepEqual(allText(again), files);
  for (const spec of TABLES) assert.notEqual(files.get(spec.file)!.text, "", spec.file);
  db.close();
});

test("each line has its keys in a fixed order and the lines are sorted by space and address", () => {
  const { folder, db } = fullProject();
  const lines = (file: string) => readFileSync(join(textPath(folder), file), "utf8").trimEnd().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
  const keys = (file: string) => lines(file).map((line) => Object.keys(line).join(","));
  assert.deepEqual(keys("symbols.jsonl"), [
    "id,space,address,name,kind,origin,added,closed",
    "id,space,address,name,kind,origin,added,closed",
    "id,space,address,name,kind,origin,added,closed",
  ]);
  assert.deepEqual(
    lines("symbols.jsonl").map((line) => [line.space, line.name]),
    [
      ["c64", "irq_handler"],
      ["c64", "raster_irq"],
      ["drive8", "screen"],
    ],
    "the C64 first, then the drive",
  );
  assert.deepEqual(
    lines("regions.jsonl").map((line) => [line.start, line.end, line.element ?? null, line.closed === null]),
    [
      ["$8000", "$80ff", null, true],
      ["$9000", "$90ff", 2, false],
      ["$9010", "$90ff", 2, true],
    ],
  );
  assert.deepEqual(keys("operands.jsonl"), ["id,space,address,select,symbol,offset,origin,added,closed", "id,space,address,select,symbol,offset,origin,added,closed"]);
  assert.deepEqual(keys("suppressions.jsonl"), ["id,space,entity,start,end,origin,added,closed"]);
  assert.deepEqual(keys("modules.jsonl"), ["id,space,start,file,title,origin,added,closed"]);
  assert.deepEqual(keys("references.jsonl"), ["id,space,from,to,kind,origin,added,closed", "id,space,from,to,kind,origin,added,closed"]);
  const [first] = lines(REVISIONS_FILE);
  assert.deepEqual(Object.keys(first!), ["id", "time", "origin", "operation", "reason", "evidence"]);
  assert.deepEqual(first!.evidence, [{ kind: "note", ref: "seen in a run" }, { kind: "file", ref: "notes.md", sha256: "a".repeat(64) }]);
  db.close();
});

const revision = "20261015T214501.123-aaaaaa";
const closing = "20261015T214502.000-bbbbbb";
const later = "20261015T214503.000-cccccc";
const revisionLine = (id: string) => `{"id":"${id}","time":"2026-10-15T21:45:01.123+01:00","origin":"llm","operation":"test"}\n`;
const symbolLine = (name: string, closed: string | null) =>
  `{"id":"${revision}/1","space":"c64","address":"$2100","name":"${name}","kind":"label","origin":"llm","added":"${revision}","closed":${closed === null ? "null" : `"${closed}"`}}\n`;

function load(symbols: string): DatabaseSync {
  const db = emptyIndex();
  loadText(db, new Map([[REVISIONS_FILE, { text: revisionLine(revision) + revisionLine(closing) + revisionLine(later) }], ["symbols.jsonl", { text: symbols }]]));
  return db;
}

const closedOf = (db: DatabaseSync) => (db.prepare("SELECT valid_to_revision AS closed FROM symbols").all() as Array<{ closed: string | null }>).map((row) => row.closed);

test("the lines of one row from the two sides of a merge are joined: a closed line wins, and the earlier close", () => {
  assert.deepEqual(closedOf(load(symbolLine("main", null) + symbolLine("main", closing))), [closing]);
  assert.deepEqual(closedOf(load(symbolLine("main", later) + symbolLine("main", null))), [later]);
  assert.deepEqual(closedOf(load(symbolLine("main", later) + symbolLine("main", closing))), [closing]);
  assert.deepEqual(closedOf(load(symbolLine("main", null) + symbolLine("main", null))), [null]);
  assert.throws(
    () => load(symbolLine("main", null) + symbolLine("other", null)),
    (error: unknown) => error instanceof Refusal && error.code === "invalid-database" && /symbols\.jsonl:2: the id .* is also on line 1 with other values/.test(error.message),
  );
});

test("a row must be added in the revision of its id, and its revisions must be in the log", () => {
  assert.throws(() => load(symbolLine("main", null).replace(`"added":"${revision}"`, `"added":"${later}"`)), /must be added in revision/);
  assert.throws(() => load(symbolLine("main", "20261015T214509.000-dddddd")), /the row .* is not valid: FOREIGN KEY/);
  assert.throws(() => load(symbolLine("main", null).replace("/1", "/0")), /is not a row id/);
});

test("the evidence of a coverage map keeps a space other than the C64 in the text, and a space that is not known is refused", () => {
  const { db } = fullProject();
  const log = revisionsText(db);
  db.close();
  // The C64 is the space of evidence without one, as of a row.
  assert.match(log, /"evidence":\[\{"kind":"coverage","ref":"local\/run\.bin","sha256":"[0-9a-f]{64}"\}\]/);
  const line = (space: string) => `{"id":"${revision}","time":"2026-10-15T21:45:01.123+01:00","origin":"llm","operation":"coverage","evidence":[{"kind":"coverage","ref":"a.bin","sha256":"${"b".repeat(64)}","space":"${space}"}]}\n`;
  const loaded = emptyIndex();
  loadText(loaded, new Map([[REVISIONS_FILE, { text: line("drive8") }]]));
  assert.deepEqual({ ...(loaded.prepare("SELECT space FROM evidence").get() as object) }, { space: "drive8" });
  assert.throws(() => loadText(emptyIndex(), new Map([[REVISIONS_FILE, { text: line("drive9") }]])), (error: unknown) => error instanceof Refusal && error.code === "invalid-database");
});
