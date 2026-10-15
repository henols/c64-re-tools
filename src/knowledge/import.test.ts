import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { KnowledgeError, openForWrite } from "./database.ts";
import { revision as revisionChanges, revisions } from "./history.ts";
import { importFindings, runProvenance, type Analyzer, type NormalizedFindings } from "./import.ts";
import { currentRevision, listReferences, listSuppressions, listSymbols, regionsOverlapping, symbolAt } from "./read.ts";
import { addReference, classifyRegion, removeReference, removeSymbol, renameSymbol, revert, unclassifyRegion } from "./write.ts";

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

function findings(analyzer: Analyzer, start: number, end: number, parts: Partial<NormalizedFindings> = {}): NormalizedFindings {
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
  assert.deepEqual(second.symbols, { added: 0, changed: 0, retired: 1, unchanged: 1, suppressed: 0 });
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
  assert.deepEqual(result.references, { added: 0, changed: 0, retired: 1, unchanged: 1, suppressed: 0 });
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
  assert.deepEqual(result.regions, { added: 0, changed: 1, retired: 0, unchanged: 0, suppressed: 0 }, "the covered part changed its type");
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
  assert.deepEqual(changed.regions, { added: 0, changed: 1, retired: 0, unchanged: 0, suppressed: 0 });
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
  assert.deepEqual(result.references, { added: 1, changed: 0, retired: 0, unchanged: 0, suppressed: 0 });
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

test("an analyzer import records the image hash and the analyzer version in its revision", () => {
  const db = fresh();
  const image = Buffer.from("abc");
  const sha256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
  importFindings(db, findings("dxa", 0x0801, 0x08ff, { symbols: [{ address: 0x080d, name: "l080d", kind: "label" }] }), runProvenance(image, "dxa 0.1.5"));
  importFindings(db, findings("ghidra", 0x2000, 0x20ff, { symbols: [{ address: 0x2000, name: "FUN_2000", kind: "routine" }] }), runProvenance(image, undefined));
  assert.deepEqual(
    revisions(db).map((revision) => [revision.origin, revision.inputHash, revision.toolVersion]),
    [
      ["ghidra", sha256, undefined],
      ["dxa", sha256, "dxa 0.1.5"],
    ],
  );
});

test("a non-authoritative symbol import moves the analyzer's own name and keeps its other rows", () => {
  const db = fresh();
  const partial = (symbols: NormalizedFindings["symbols"]) => {
    const result = findings("ghidra", 0x2000, 0x2fff, { symbols });
    result.authoritative.symbols = false;
    return result;
  };
  importFindings(db, partial([
    { address: 0x2100, name: "FUN_main", kind: "routine" },
    { address: 0x2200, name: "FUN_2200", kind: "routine" },
  ]));
  const moved = importFindings(db, partial([{ address: 0x2300, name: "FUN_main", kind: "routine" }]));
  assert.deepEqual(moved.conflicts, []);
  assert.deepEqual(moved.symbols, { added: 1, changed: 0, retired: 1, unchanged: 0, suppressed: 0 });
  assert.deepEqual(listSymbols(db).map((symbol) => [symbol.address, symbol.name]), [
    [0x2200, "FUN_2200"],
    [0x2300, "FUN_main"],
  ]);
});

test("a non-authoritative region import changes the type of the analyzer's own region under a finding", () => {
  const db = fresh();
  const partial = (regions: NormalizedFindings["regions"]) => {
    const result = findings("dxa", 0x2000, 0x2fff, { regions });
    result.authoritative.regions = false;
    return result;
  };
  importFindings(db, partial([{ start: 0x2000, end: 0x20ff, type: "bytes" }, { start: 0x2400, end: 0x24ff, type: "code" }]));
  const result = importFindings(db, partial([{ start: 0x2080, end: 0x217f, type: "code" }, { start: 0x2400, end: 0x24ff, type: "code" }]));
  assert.deepEqual(result.regions, { added: 1, changed: 1, retired: 0, unchanged: 1, suppressed: 0 });
  assert.deepEqual(regionList(db), [
    [0x2000, 0x207f, "bytes", "dxa"],
    [0x2080, 0x217f, "code", "dxa"],
    [0x2400, 0x24ff, "code", "dxa"],
  ]);
});

// D36: a user/LLM removal is a suppression that holds against every later import.

const ghidraRun = () =>
  findings("ghidra", 0x0400, 0x04ff, {
    symbols: [{ address: 0x0408, name: "FUN_0408", kind: "routine" }],
    regions: [{ start: 0x0400, end: 0x04ff, type: "code" }],
    references: [{ from: 0x0410, to: 0xef29, kind: "jump" }],
  });

test("removals by the LLM hold: the same analyzer run adds nothing again and counts the suppressed findings", () => {
  const db = fresh();
  importFindings(db, ghidraRun());
  removeSymbol(db, { origin: "llm", description: "not an entry" }, { address: 0x0408 });
  removeReference(db, { origin: "llm", description: "the vector is written at run time" }, { from: 0x0410, to: 0xef29, kind: "jump" });
  unclassifyRegion(db, { origin: "llm" }, { start: 0x0480, end: 0x04ff });
  const before = currentRevision(db);

  const again = importFindings(db, ghidraRun());
  assert.equal(again.symbols.suppressed, 1);
  assert.equal(again.references.suppressed, 1);
  assert.equal(again.regions.suppressed, 1);
  assert.equal(again.revision, null, "nothing changed");
  assert.equal(currentRevision(db), before);
  assert.equal(symbolAt(db, 0x0408), undefined);
  assert.deepEqual(listReferences(db), []);
  assert.deepEqual(regionList(db), [[0x0400, 0x047f, "code", "ghidra"]]);
});

test("a removal blocks the place for every analyzer, also after the removal of an LLM row", () => {
  const db = fresh();
  renameSymbol(db, { origin: "llm" }, { address: 0x0415, name: "boot_check" });
  removeSymbol(db, { origin: "llm" }, { address: 0x0415 });
  const result = importFindings(db, findings("dxa", 0x0400, 0x04ff, { symbols: [{ address: 0x0415, name: "l0415", kind: "label" }] }));
  assert.equal(result.symbols.suppressed, 1);
  assert.equal(symbolAt(db, 0x0415), undefined);
});

test("a non-authoritative region import also leaves a suppressed range free", () => {
  const db = fresh();
  classifyRegion(db, { origin: "llm" }, { start: 0x1000, end: 0x10ff, type: "bytes" });
  unclassifyRegion(db, { origin: "llm" }, { start: 0x1000, end: 0x10ff });
  const result = importFindings(db, {
    ...findings("dxa", 0x0f00, 0x11ff, { regions: [{ start: 0x0f00, end: 0x11ff, type: "code" }] }),
    authoritative: { symbols: true, regions: false, references: true },
  });
  assert.equal(result.regions.suppressed, 1);
  assert.deepEqual(regionList(db), [
    [0x0f00, 0x0fff, "code", "dxa"],
    [0x1100, 0x11ff, "code", "dxa"],
  ]);
});

test("a later write at the place lifts the suppression there, and only there", () => {
  const db = fresh();
  importFindings(db, ghidraRun());
  removeSymbol(db, { origin: "llm" }, { address: 0x0408 });
  removeReference(db, { origin: "llm" }, { from: 0x0410, to: 0xef29, kind: "jump" });
  unclassifyRegion(db, { origin: "llm" }, { start: 0x0400, end: 0x04ff });
  renameSymbol(db, { origin: "llm" }, { address: 0x0408, name: "irq_vector" });
  addReference(db, { origin: "user" }, { from: 0x0410, to: 0xef29, kind: "jump" });
  classifyRegion(db, { origin: "llm" }, { start: 0x0400, end: 0x040f, type: "code" });
  assert.deepEqual(
    listSuppressions(db).map((row) => [row.entity, row.start, row.end]),
    [["region", 0x0410, 0x04ff]],
    "the region suppression keeps its part outside the classified range",
  );
  const again = importFindings(db, ghidraRun());
  assert.equal(again.regions.suppressed, 1);
  assert.deepEqual(regionList(db), [[0x0400, 0x040f, "code", "llm"]]);
});

test("a revert to before the removal lifts the suppression and restores the analyzer row", () => {
  const db = fresh();
  const first = importFindings(db, ghidraRun());
  removeSymbol(db, { origin: "llm" }, { address: 0x0408 });
  assert.equal(listSuppressions(db).length, 1);
  revert(db, { origin: "user" }, { revision: first.revision! });
  assert.deepEqual(listSuppressions(db), []);
  assert.equal(symbolAt(db, 0x0408)?.name, "FUN_0408");
  assert.equal(importFindings(db, ghidraRun()).revision, null);
});

test("a revision shows the suppression it wrote", () => {
  const db = fresh();
  importFindings(db, ghidraRun());
  const removed = removeSymbol(db, { origin: "llm", description: "not an entry" }, { address: 0x0408 });
  const changes = revisionChanges(db, removed.revision!);
  assert.deepEqual(
    changes.added.map((entry) => entry.entity),
    ["suppression"],
  );
  assert.deepEqual(changes.closed.map((entry) => entry.entity), ["symbol"]);
});

test("a JMP table is code, and dual-use bytes conflict with no finding (D42)", () => {
  const db = fresh();
  classifyRegion(db, { origin: "llm" }, { start: 0x0500, end: 0x0508, type: "jumps" });
  classifyRegion(db, { origin: "llm" }, { start: 0x0408, end: 0x0409, type: "dual-use" });
  const result = importFindings(
    db,
    findings("ghidra", 0x0400, 0x05ff, {
      regions: [
        { start: 0x0400, end: 0x04ff, type: "code" },
        { start: 0x0500, end: 0x0508, type: "bytes" },
      ],
    }),
  );
  assert.deepEqual(
    result.conflicts.map((conflict) => (conflict.category === "region" ? [conflict.start, conflict.end, conflict.current.type] : [])),
    [[0x0500, 0x0508, "jumps"]],
    "data over a JMP table conflicts; code over dual-use bytes does not",
  );
});

test("a heuristic region replaces the DXA region where it lies, and DXA never replaces a heuristic region (D44)", () => {
  const db = fresh();
  importFindings(db, findings("dxa", 0x1000, 0x10ff, { regions: [{ start: 0x1000, end: 0x10ff, type: "code" }] }));
  importFindings(db, findings("heuristic", 0x1000, 0x10ff, { regions: [{ start: 0x1040, end: 0x104f, type: "rts-addresses" }] }));
  assert.deepEqual(regionList(db), [
    [0x1000, 0x103f, "code", "dxa"],
    [0x1040, 0x104f, "rts-addresses", "heuristic"],
    [0x1050, 0x10ff, "code", "dxa"],
  ]);
  const again = importFindings(db, findings("dxa", 0x1000, 0x10ff, { regions: [{ start: 0x1000, end: 0x10ff, type: "code" }] }));
  assert.deepEqual(regionList(db)[1], [0x1040, 0x104f, "rts-addresses", "heuristic"], "a DXA re-run keeps the table");
  assert.equal(again.conflicts.length, 1, "DXA's code over the table is a conflict");
});

test("a code finding over an executed instruction start replaces another analyzer's data, and nothing else (D58)", () => {
  const db = fresh();
  importFindings(db, findings("dxa", 0x1000, 0x10ff, { regions: [{ start: 0x1000, end: 0x10ff, type: "bytes" }], symbols: [{ address: 0x1010, name: "d1010", kind: "data" }] }));
  const ghidra = (executed?: (address: number) => boolean) =>
    findings("ghidra", 0x1000, 0x10ff, {
      regions: [{ start: 0x1000, end: 0x103f, type: "code" }],
      symbols: [{ address: 0x1010, name: "FUN_1010", kind: "routine" }],
      ...(executed === undefined ? {} : { executed }),
    });

  // Without coverage, the contradiction stays a conflict.
  const without = importFindings(db, ghidra());
  assert.deepEqual(
    without.conflicts.map((conflict) => conflict.category),
    ["symbol", "region"],
  );
  assert.deepEqual(regionList(db), [[0x1000, 0x10ff, "bytes", "dxa"]]);

  // A run executed $1010: the DXA data gives way under the code finding, its part outside stays.
  const executed = importFindings(db, ghidra((address) => address === 0x1010), { evidence: [{ kind: "coverage", ref: "runs/boot.bin", sha256: "0".repeat(64) }] });
  assert.deepEqual(executed.conflicts, []);
  assert.deepEqual(regionList(db), [
    [0x1000, 0x103f, "code", "ghidra"],
    [0x1040, 0x10ff, "bytes", "dxa"],
  ]);
  assert.equal(symbolAt(db, 0x1010)?.name, "FUN_1010");
  assert.deepEqual(revisionChanges(db, executed.revision!).revision.evidence, [{ kind: "coverage", ref: "runs/boot.bin", sha256: "0".repeat(64) }]);

  // User data stays, also over executed code.
  const user = fresh();
  classifyRegion(user, { origin: "user" }, { start: 0x2000, end: 0x20ff, type: "bytes" });
  const kept = importFindings(user, findings("ghidra", 0x2000, 0x20ff, { regions: [{ start: 0x2000, end: 0x20ff, type: "code" }], executed: () => true }));
  assert.equal(kept.conflicts.length, 1);
  assert.deepEqual(regionList(user), [[0x2000, 0x20ff, "bytes", "user"]]);
});
