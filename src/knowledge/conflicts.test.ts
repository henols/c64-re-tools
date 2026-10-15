// Conflicts after a git merge (D69): two computers write the same project, git
// keeps the lines of both, and the knowledge shows the conflicts until a merge
// revision decides them.

import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { conflicts, type Conflict } from "./conflicts.ts";
import { KnowledgeError, openForRead, openForWrite, textPath, transaction, withWrite } from "./database.ts";
import { importFindings } from "./import.ts";
import { listRegions, operandAt, referencesFrom, symbolAt } from "./read.ts";
import { addReference, Change, classifyRegion, mergeConflicts, renameSymbol, setComment, setModule, setOperand, unclassifyRegion, type OperandImage, type WriteContext } from "./write.ts";

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function project(): string {
  const root = mkdtempSync(join(tmpdir(), "c64-re-tools-conflicts-"));
  roots.push(root);
  return root;
}

const llm: WriteContext = { origin: "llm" };
const platform = new Map([["CINV", 0x0314]]);

/** Waits until the clock moves on, so the next revision of another computer is newer by its time. */
function later(): void {
  const start = Date.now();
  while (Date.now() < start + 2);
}

/** Two copies of one project, as two clones of one repository: the base work, then the work of each computer. */
function computers(base: (root: string) => void, first: (root: string) => void, second: (root: string) => void): string {
  const origin = project();
  base(origin);
  const [a, b] = [project(), project()];
  for (const root of [a, b]) if (existsSync(textPath(origin))) cpSync(textPath(origin), textPath(root), { recursive: true });
  first(a);
  later();
  second(b);
  return union(a, b);
}

/** The knowledge that git makes with merge=union: the lines of both sides of each file. */
function union(a: string, b: string): string {
  const root = project();
  mkdirSync(textPath(root), { recursive: true });
  const names = new Set([...readdirSync(textPath(a)), ...readdirSync(textPath(b))]);
  for (const name of names) {
    const lines = (folder: string) => (existsSync(join(textPath(folder), name)) ? readFileSync(join(textPath(folder), name), "utf8").split("\n").filter((line) => line !== "") : []);
    writeFileSync(join(textPath(root), name), `${[...new Set([...lines(a), ...lines(b)])].join("\n")}\n`);
  }
  return root;
}

function read<T>(root: string, work: (db: DatabaseSync) => T): T {
  const db = openForRead(root)!;
  try {
    return work(db);
  } finally {
    db.close();
  }
}

const rules = (found: Conflict[]) => found.map((conflict) => conflict.rule);
const isConflict = (error: unknown) => error instanceof KnowledgeError && error.code === "conflict";
const nothing = () => undefined;

test("two names at one address and one name at two addresses are conflicts, and merge keeps the newer name", () => {
  const root = computers(
    (base) => withWrite((db) => renameSymbol(db, llm, { address: 0x2100, name: "l2100" }), base),
    (a) => withWrite((db) => renameSymbol(db, llm, { address: 0x2100, name: "read_joystick" }), a),
    (b) => withWrite((db) => renameSymbol(db, llm, { address: 0x2100, name: "poll_input" }), b),
  );
  const found = read(root, conflicts);
  assert.deepEqual(rules(found), ["symbol-address"]);
  assert.deepEqual(found[0]!.rows.map((entry) => (entry.row as { name: string }).name), ["read_joystick", "poll_input"], "oldest first");
  const merged = withWrite((db) => mergeConflicts(db, { origin: "user", description: "keep the newer name" }, platform), root);
  assert.deepEqual(merged.current.map((choice) => [choice.rule, (choice.kept.row as { name: string }).name, choice.closed.map((entry) => (entry.row as { name: string }).name)]), [["symbol-address", "poll_input", ["read_joystick"]]]);
  assert.deepEqual(read(root, conflicts), []);
  assert.equal(read(root, (db) => symbolAt(db, 0x2100)?.name), "poll_input");

  const moved = computers(
    nothing,
    (a) => withWrite((db) => renameSymbol(db, llm, { address: 0x2100, name: "main" }), a),
    (b) => withWrite((db) => renameSymbol(db, llm, { address: 0x2200, name: "main" }), b),
  );
  assert.deepEqual(rules(read(moved, conflicts)), ["symbol-name"]);
  withWrite((db) => mergeConflicts(db, llm, platform), moved);
  assert.equal(read(moved, (db) => symbolAt(db, 0x2200)?.name), "main");
  assert.equal(read(moved, (db) => symbolAt(db, 0x2100)), undefined);
});

test("overlapping regions are a conflict, and merge keeps the newer region and the parts of the older one outside it", () => {
  const root = computers(
    nothing,
    (a) => withWrite((db) => classifyRegion(db, llm, { start: 0x1000, end: 0x10ff, type: "words", element: 2 }), a),
    (b) => withWrite((db) => classifyRegion(db, llm, { start: 0x1080, end: 0x117f, type: "code" }), b),
  );
  assert.deepEqual(rules(read(root, conflicts)), ["region"]);
  withWrite((db) => mergeConflicts(db, llm, platform), root);
  assert.deepEqual(
    read(root, (db) => listRegions(db).map((region) => [region.start, region.end, region.type, region.element])),
    [
      [0x1000, 0x107f, "words", 2],
      [0x1080, 0x117f, "code", undefined],
    ],
  );
});

test("comments, references, operands, modules and region suppressions have their conflicts too", () => {
  const image: OperandImage = { byteAt: (address) => new Map([[0x8079, 0xa9], [0x807a, 0xc0]]).get(address), platform: new Map() };
  const root = computers(
    (base) => withWrite((db) => renameSymbol(db, llm, { address: 0x80c0, name: "irq_handler" }), base),
    (a) =>
      withWrite((db) => {
        setComment(db, llm, { address: 0x2100, placement: "line", text: "Reads the joystick." });
        addReference(db, llm, { from: 0x2000, to: 0x2100, kind: "call" });
        setModule(db, llm, { start: 0x0801, file: "boot.asm" });
        setModule(db, llm, { start: 0x8000, file: "irq.asm" });
        setOperand(db, { ...llm, image }, { address: 0x8079, select: "lo", symbol: "irq_handler" });
        classifyRegion(db, llm, { start: 0x3000, end: 0x30ff, type: "bytes" });
        return unclassifyRegion(db, llm, { start: 0x3000, end: 0x307f });
      }, a),
    (b) =>
      withWrite((db) => {
        setComment(db, llm, { address: 0x2100, placement: "line", text: "Polls port 2." });
        addReference(db, llm, { from: 0x2000, to: 0x2100, kind: "call" });
        setModule(db, llm, { start: 0x0801, file: "start.asm" });
        setModule(db, llm, { start: 0x9000, file: "irq.asm" });
        setOperand(db, { ...llm, image }, { address: 0x8079, select: "expr", expression: "<irq_handler" });
        classifyRegion(db, llm, { start: 0x3000, end: 0x30ff, type: "bytes" });
        return unclassifyRegion(db, llm, { start: 0x3040, end: 0x30bf });
      }, b),
  );
  assert.deepEqual(rules(read(root, conflicts)), ["region", "comment", "reference", "reference", "operand", "module-start", "module-file", "suppression-region"]);
  const merged = withWrite((db) => mergeConflicts(db, llm, platform), root);
  assert.equal(merged.current.length, 8);
  assert.deepEqual(read(root, conflicts), []);
  assert.equal(read(root, (db) => operandAt(db, 0x8079)?.expression), "<irq_handler");
  assert.deepEqual(read(root, (db) => referencesFrom(db, 0x8079).map((reference) => [reference.to, reference.kind])), [[0x80c0, "pointer"]], "one pointer reference stays");
});

test("while the knowledge has conflicts, writes and imports are refused, and merge is one revision", () => {
  const root = computers(
    nothing,
    (a) => withWrite((db) => renameSymbol(db, llm, { address: 0x2100, name: "a" }), a),
    (b) => withWrite((db) => renameSymbol(db, llm, { address: 0x2100, name: "b" }), b),
  );
  assert.throws(() => withWrite((db) => renameSymbol(db, llm, { address: 0x3000, name: "other" }), root), (error: unknown) => isConflict(error) && /two symbols at one address in c64 \(\$2100\).*knowledge\.ts merge/.test((error as Error).message));
  const findings = { analyzer: "dxa" as const, coverage: [{ start: 0x3000, end: 0x30ff }], authoritative: { symbols: true, regions: true, references: true }, symbols: [], regions: [], references: [] };
  assert.throws(() => withWrite((db) => importFindings(db, findings), root), isConflict);
  const merged = withWrite((db) => mergeConflicts(db, llm, platform), root);
  assert.notEqual(merged.revision, null);
  assert.equal(withWrite((db) => mergeConflicts(db, llm, platform), root).revision, null, "no conflicts, no revision");
  assert.notEqual(withWrite((db) => renameSymbol(db, llm, { address: 0x3000, name: "other" }), root).revision, null);
});

test("a write that would leave two current rows is refused before it commits", () => {
  const root = project();
  withWrite((db) => renameSymbol(db, llm, { address: 0x2100, name: "main" }), root);
  const before = readFileSync(join(textPath(root), "symbols.jsonl"), "utf8");
  const db = openForWrite(root);
  try {
    // A step that breaks the rules, as a bug would: a second current symbol at the address.
    assert.throws(
      () =>
        transaction(db, () => {
          const change = new Change(db, llm, "test");
          change.insertSymbol({ space: "c64", address: 0x2100, name: "other", kind: "label", origin: "llm" });
          change.check();
        }),
      (error: unknown) => isConflict(error) && /would leave two symbols at one address/.test((error as Error).message),
    );
  } finally {
    db.close();
  }
  assert.equal(readFileSync(join(textPath(root), "symbols.jsonl"), "utf8"), before);
  assert.equal(read(root, (db) => symbolAt(db, 0x2100)?.name), "main");
});
