import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { KnowledgeError, openForWrite } from "./database.ts";
import { revision as revisionChanges } from "./history.ts";
import { importFindings, type NormalizedFindings } from "./import.ts";
import { currentRevision, listReferences, listSymbols, regionsOverlapping, symbolAt } from "./read.ts";
import { classifyRegion, renameSymbol } from "./write.ts";

const roots: string[] = [];
const databases: DatabaseSync[] = [];
after(() => {
  for (const db of databases) db.close();
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function fresh(): DatabaseSync {
  const root = mkdtempSync(join(tmpdir(), "c64-re-tools-import-"));
  roots.push(root);
  const db = openForWrite(root);
  databases.push(db);
  return db;
}

const failsWith = (code: string) => (error: unknown) => error instanceof KnowledgeError && error.code === code;

function findings(analyzer: "dxa" | "ghidra", start: number, end: number, parts: Partial<NormalizedFindings> = {}): NormalizedFindings {
  return {
    analyzer,
    coverage: [{ start, end }],
    authoritative: { symbols: true, regions: true, references: true },
    symbols: [],
    regions: [],
    references: [],
    ...parts,
  };
}

const regionList = (db: DatabaseSync) => regionsOverlapping(db, 0, 0xffff).map((region) => [region.start, region.end, region.type, region.origin]);
const count = (db: DatabaseSync, sql: string) => (db.prepare(sql).get() as { n: number }).n;

test("a re-analysis closes the analyzer's own symbol that it no longer finds", () => {
  const db = fresh();
  const first = importFindings(
    db,
    findings("ghidra", 0x2000, 0x22ff, {
      symbols: [
        { address: 0x2100, name: "FUN_2100", kind: "routine" },
        { address: 0x2200, name: "FUN_2200", kind: "routine" },
      ],
    }),
    { toolVersion: "test 1" },
  );
  assert.equal(first.revision, 1);
  assert.equal(first.symbols.added, 2);
  const stored = db.prepare("SELECT origin, operation, tool_version FROM revisions WHERE id = 1").get();
  assert.deepEqual({ ...stored }, { origin: "ghidra", operation: "import-ghidra", tool_version: "test 1" });

  const second = importFindings(db, findings("ghidra", 0x2000, 0x22ff, { symbols: [{ address: 0x2100, name: "FUN_2100", kind: "routine" }] }));
  assert.equal(second.revision, 2);
  assert.deepEqual(second.symbols, { added: 0, changed: 0, retired: 1, unchanged: 1 });
  assert.equal(symbolAt(db, 0x2200), undefined);
  assert.equal(symbolAt(db, 0x2100)?.revision, 1, "the unchanged symbol keeps its row");
  assert.equal(count(db, "SELECT count(*) AS n FROM symbols WHERE address = 8704 AND valid_to_revision = 2"), 1, "the old row stays in history");
});

test("the same result again changes nothing and makes no revision", () => {
  const db = fresh();
  const result = findings("dxa", 0x0801, 0x08ff, {
    symbols: [{ address: 0x080d, name: "l080d", kind: "label" }],
    regions: [{ start: 0x080d, end: 0x0812, type: "code" }],
    references: [{ from: 0x0810, to: 0x080d, kind: "jump" }],
  });
  importFindings(db, result);
  const again = importFindings(db, result);
  assert.equal(again.revision, null);
  assert.deepEqual([again.symbols.unchanged, again.regions.unchanged, again.references.unchanged], [1, 1, 1]);
  assert.equal(currentRevision(db), 1);
});

test("stale references inside the coverage retire; references from outside stay", () => {
  const db = fresh();
  importFindings(
    db,
    findings("ghidra", 0x2100, 0x23ff, {
      references: [
        { from: 0x2110, to: 0x3000, kind: "read" },
        { from: 0x2120, to: 0x4000, kind: "call" },
        { from: 0x2300, to: 0x5000, kind: "jump" },
      ],
    }),
  );
  const result = importFindings(db, findings("ghidra", 0x2100, 0x21ff, { references: [{ from: 0x2110, to: 0x3000, kind: "read" }] }));
  assert.deepEqual(result.references, { added: 0, changed: 0, retired: 1, unchanged: 1 });
  assert.deepEqual(
    listReferences(db).map((reference) => [reference.from, reference.to, reference.kind]),
    [
      [0x2110, 0x3000, "read"],
      [0x2300, 0x5000, "jump"],
    ],
  );
});

test("a targeted region re-analysis keeps the parts outside its coverage", () => {
  const db = fresh();
  importFindings(db, findings("dxa", 0x2000, 0x2fff, { regions: [{ start: 0x2000, end: 0x2fff, type: "code" }] }));
  const result = importFindings(db, findings("dxa", 0x2400, 0x24ff, { regions: [{ start: 0x2400, end: 0x24ff, type: "bytes" }] }));
  assert.equal(result.revision, 2);
  assert.deepEqual(result.regions, { added: 0, changed: 1, retired: 0, unchanged: 0 }, "the covered part changed its type");
  assert.deepEqual(regionList(db), [
    [0x2000, 0x23ff, "code", "dxa"],
    [0x2400, 0x24ff, "bytes", "dxa"],
    [0x2500, 0x2fff, "code", "dxa"],
  ]);
  assert.equal(count(db, "SELECT count(*) AS n FROM regions WHERE valid_to_revision = 2"), 1, "the original row becomes history");
  // An unchanged targeted run leaves the rows alone, also one that crosses the coverage.
  assert.equal(importFindings(db, findings("dxa", 0x2300, 0x24ff, { regions: [{ start: 0x2300, end: 0x23ff, type: "code" }, { start: 0x2400, end: 0x24ff, type: "bytes" }] })).revision, null);
  // A region type that changes in place counts as changed.
  const changed = importFindings(db, findings("dxa", 0x2400, 0x24ff, { regions: [{ start: 0x2400, end: 0x24ff, type: "words" }] }));
  assert.deepEqual(changed.regions, { added: 0, changed: 1, retired: 0, unchanged: 0 });
});

test("semantic knowledge is kept; only a code/data disagreement is a conflict", () => {
  const db = fresh();
  renameSymbol(db, { origin: "llm" }, { address: 0x2100, name: "update_player", kind: "routine" });
  renameSymbol(db, { origin: "user" }, { address: 0x3000, name: "player_x", kind: "variable" });
  classifyRegion(db, { origin: "llm" }, { start: 0x4000, end: 0x403f, type: "sprite" });
  classifyRegion(db, { origin: "user" }, { start: 0x5000, end: 0x50ff, type: "bitmap" });
  const result = importFindings(
    db,
    findings("ghidra", 0x2000, 0x5fff, {
      symbols: [
        { address: 0x2100, name: "FUN_2100", kind: "routine" },
        { address: 0x3000, name: "FUN_3000", kind: "routine" },
      ],
      regions: [
        { start: 0x4000, end: 0x40ff, type: "bytes" },
        { start: 0x5000, end: 0x50ff, type: "code" },
      ],
    }),
  );
  assert.equal(symbolAt(db, 0x2100)?.name, "update_player");
  assert.equal(symbolAt(db, 0x3000)?.name, "player_x");
  assert.deepEqual(
    result.conflicts.map((conflict) => (conflict.category === "symbol" ? [conflict.category, conflict.address, conflict.reason] : [conflict.category, conflict.start, conflict.end])),
    [
      ["symbol", 0x3000, "kind"],
      ["region", 0x5000, 0x50ff],
    ],
  );
  assert.deepEqual(regionList(db), [
    [0x4000, 0x403f, "sprite", "llm"],
    [0x4040, 0x40ff, "bytes", "ghidra"],
    [0x5000, 0x50ff, "bitmap", "user"],
  ]);
});

test("an analyzer does not replace another analyzer; a contradiction is a conflict", () => {
  const db = fresh();
  importFindings(db, findings("dxa", 0x3000, 0x30ff, { regions: [{ start: 0x3000, end: 0x30ff, type: "code" }], symbols: [{ address: 0x3000, name: "l3000", kind: "label" }] }));
  const result = importFindings(
    db,
    findings("ghidra", 0x3000, 0x30ff, { regions: [{ start: 0x3000, end: 0x30ff, type: "bytes" }], symbols: [{ address: 0x3000, name: "FUN_3000", kind: "routine" }] }),
  );
  assert.equal(result.revision, null);
  assert.deepEqual(result.conflicts, [{ category: "region", start: 0x3000, end: 0x30ff, current: { type: "code", origin: "dxa" }, finding: { type: "bytes" } }]);
  assert.deepEqual(regionList(db), [[0x3000, 0x30ff, "code", "dxa"]]);
  assert.equal(symbolAt(db, 0x3000)?.name, "l3000", "a different generated name for code is compatible");
});

test("a non-authoritative category adds facts but retires none", () => {
  const db = fresh();
  importFindings(db, findings("ghidra", 0x2000, 0x20ff, { references: [{ from: 0x2010, to: 0x3000, kind: "read" }] }));
  const partial = findings("ghidra", 0x2000, 0x20ff, { references: [{ from: 0x2020, to: 0x3001, kind: "write" }] });
  partial.authoritative.references = false;
  const result = importFindings(db, partial);
  assert.deepEqual(result.references, { added: 1, changed: 0, retired: 0, unchanged: 0 });
  assert.equal(listReferences(db).length, 2);
});

test("a name in use elsewhere is a conflict, not an overwrite", () => {
  const db = fresh();
  renameSymbol(db, { origin: "llm" }, { address: 0x9000, name: "FUN_2100", kind: "routine" });
  const result = importFindings(db, findings("ghidra", 0x2000, 0x21ff, { symbols: [{ address: 0x2100, name: "FUN_2100", kind: "routine" }] }));
  assert.equal(result.conflicts[0]?.category === "symbol" && result.conflicts[0].reason, "name-taken");
  assert.equal(symbolAt(db, 0x2100), undefined);
  assert.equal(listSymbols(db).length, 1);
});

test("an unusable result or a stale revision imports nothing", () => {
  const db = fresh();
  renameSymbol(db, { origin: "llm" }, { address: 0x1000, name: "start", kind: "routine" });
  for (const bad of [
    findings("ghidra", 0x2000, 0x20ff, { symbols: [{ address: 0x3000, name: "FUN_3000", kind: "routine" }] }),
    findings("ghidra", 0x2000, 0x20ff, { regions: [{ start: 0x2000, end: 0x2010, type: "code" }, { start: 0x2010, end: 0x2020, type: "bytes" }] }),
    findings("ghidra", 0x2000, 0x20ff, { regions: [{ start: 0x20f0, end: 0x2100, type: "code" }] }),
    findings("ghidra", 0x2000, 0x20ff, { symbols: [{ address: 0x2000, name: "a b", kind: "routine" }] }),
    findings("ghidra", 0x2000, 0x20ff, { references: [{ from: 0x1fff, to: 0x2000, kind: "call" }] }),
    { ...findings("ghidra", 0x2000, 0x20ff), coverage: [] },
  ]) {
    assert.throws(() => importFindings(db, bad), failsWith("invalid-input"), JSON.stringify(bad));
  }
  assert.throws(() => importFindings(db, findings("dxa", 0x2000, 0x20ff, { symbols: [{ address: 0x2000, name: "l2000", kind: "label" }] }), { expectedRevision: 0 }), failsWith("stale-revision"));
  assert.equal(currentRevision(db), 1);
});

test("a failure in the middle of an import rolls all of it back", () => {
  const db = fresh();
  db.exec("CREATE TEMP TRIGGER fail_boom BEFORE INSERT ON \"references\" BEGIN SELECT RAISE(ABORT, 'boom'); END");
  assert.throws(
    () =>
      importFindings(
        db,
        findings("dxa", 0x2000, 0x20ff, {
          symbols: [{ address: 0x2000, name: "l2000", kind: "label" }],
          regions: [{ start: 0x2000, end: 0x20ff, type: "code" }],
          references: [{ from: 0x2000, to: 0x2000, kind: "jump" }],
        }),
      ),
    /boom/,
  );
  db.exec("DROP TRIGGER fail_boom");
  assert.equal(currentRevision(db), 0);
  assert.equal(count(db, "SELECT count(*) AS n FROM symbols") + count(db, "SELECT count(*) AS n FROM regions"), 0);
});

test("history shows an import as one revision of the analyzer", () => {
  const db = fresh();
  importFindings(db, findings("dxa", 0x0801, 0x08ff, { symbols: [{ address: 0x080d, name: "l080d", kind: "label" }], regions: [{ start: 0x080d, end: 0x0812, type: "code" }] }));
  const changes = revisionChanges(db, 1);
  assert.equal(changes.revision.origin, "dxa");
});
