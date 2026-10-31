import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

import { failsWith } from "../errors.testkit.ts";
import { openForWrite } from "./database.ts";
import { importFindings } from "./import.ts";
import type { Analyzer } from "./schema.ts";
import { addressOfName, nameTable } from "./names.ts";
import { renameSymbol } from "./write.ts";
import { findings } from "./project.testkit.ts";

let root: string;
let db: DatabaseSync;

const analyzer = (name: Analyzer, symbols: Array<{ address: number; name: string }>, space?: string) =>
  importFindings(db, findings(name, 0x0800, 0x2fff, { symbols: symbols.map((symbol) => ({ ...symbol, kind: "routine" as const })), ...(space === undefined ? {} : { space }) }));

before(() => {
  root = mkdtempSync(join(tmpdir(), "c64-re-tools-names-"));
  db = openForWrite(root);
  renameSymbol(db, { origin: "llm" }, { address: 0x0810, name: "main_loop", kind: "routine" });
  renameSymbol(db, { origin: "llm" }, { address: 0x0300, name: "drive_loop", kind: "routine", space: "drive8" });
  analyzer("dxa", [
    { address: 0x0900, name: "l0900" },
    { address: 0x0a00, name: "shared" },
    { address: 0x0b00, name: "split" },
    { address: 0x0810, name: "dxa_main" },
  ]);
  analyzer("decompiler", [
    { address: 0x0a00, name: "shared" },
    { address: 0x0c00, name: "split" },
    { address: 0x0d00, name: "main_loop" },
  ]);
});
after(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

test("a symbol comes first, then an analyzer name that the analyzers give to one address", () => {
  assert.equal(addressOfName(db, "main_loop"), 0x0810, "the symbol wins over the name");
  assert.equal(addressOfName(db, "l0900"), 0x0900);
  assert.equal(addressOfName(db, "shared"), 0x0a00, "two analyzers, one address");
  assert.equal(addressOfName(db, "drive_loop", "drive8"), 0x0300);
  assert.throws(() => addressOfName(db, "split"), failsWith("invalid-input", /the analyzers give split to \$0b00 \(dxa\) and \$0c00 \(decompiler\)\. Give the address/));
  assert.throws(() => addressOfName(db, "nothing"), failsWith("not-found", /^nothing is not a name in the knowledge\. Give a \$ address, or a symbol or an analyzer name of the project knowledge\.$/));
  assert.throws(() => addressOfName(db, "main_loop", "drive8"), failsWith("not-found", /^main_loop is not a name in the knowledge in drive8\. Give a \$ address, or a symbol or an analyzer name of the project knowledge in drive8\.$/));
  assert.throws(() => addressOfName(undefined, "main_loop"), failsWith("not-found", /main_loop/), "no knowledge: no names");
});

test("the name table has every name that addressOfName accepts, and no other", () => {
  const table = nameTable(db);
  assert.deepEqual([...table.entries()].sort(), [
    ["dxa_main", 0x0810],
    ["l0900", 0x0900],
    ["main_loop", 0x0810],
    ["shared", 0x0a00],
  ]);
  for (const [name, address] of table) assert.equal(addressOfName(db, name), address, name);
  assert.deepEqual([...nameTable(db, "drive8")], [["drive_loop", 0x0300]]);
});
