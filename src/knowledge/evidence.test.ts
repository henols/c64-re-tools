import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { openForWrite } from "./database.ts";
import { changedEvidence } from "./evidence.ts";
import { addCoverage } from "./program.ts";
import { renameSymbol, setComment } from "./write.ts";

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

const sha = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");

function file(root: string, path: string, bytes: Uint8Array | string): void {
  mkdirSync(join(root, path, ".."), { recursive: true });
  writeFileSync(join(root, path), bytes);
}

function coverageMap(address: number): Uint8Array {
  const bytes = new Uint8Array(0x10000);
  bytes[address] = 4;
  return bytes;
}

test("an evidence file that is missing or changed is found with the revisions that give it; an earlier SHA-256 of a file is history", () => {
  const root = mkdtempSync(join(tmpdir(), "c64-re-tools-evidence-"));
  roots.push(root);
  const db = openForWrite(root);
  try {
    file(root, "tests/trap.json", "one");
    const cite = (text: string) => [{ kind: "test" as const, ref: "tests/trap.json", sha256: sha(text) }];
    const first = renameSymbol(db, { origin: "llm", evidence: cite("one") }, { address: 0x1000, name: "trap" }).revision!;
    const second = setComment(db, { origin: "llm", evidence: cite("one") }, { address: 0x1000, placement: "line", text: "The trap." }).revision!;
    // The map of a recording, imported two times: the first import is history.
    const old = coverageMap(0x1000);
    const current = coverageMap(0x1001);
    file(root, "tests/recordings/a/coverage.bin", current);
    addCoverage(db, { origin: "llm" }, { maps: [{ name: "tests/recordings/a/coverage.bin", bytes: old }] });
    const imported = addCoverage(db, { origin: "llm" }, { maps: [{ name: "tests/recordings/a/coverage.bin", bytes: current }] }).revision!;
    // A map in the local folder is no evidence that git keeps: it does not count when it is gone.
    addCoverage(db, { origin: "llm" }, { maps: [{ name: ".c64-re-tools/local/run.bin", bytes: old }] });
    assert.deepEqual(changedEvidence(db, root), []);

    rmSync(join(root, "tests/trap.json"));
    file(root, "tests/recordings/a/coverage.bin", old);
    assert.deepEqual(changedEvidence(db, root), [
      { file: "tests/recordings/a/coverage.bin", state: "changed", revisions: [imported] },
      { file: "tests/trap.json", state: "missing", revisions: [first, second] },
    ]);
    assert.deepEqual(changedEvidence(db, root, (path) => path.startsWith("tests/recordings/")).map((change) => change.file), ["tests/recordings/a/coverage.bin"]);
  } finally {
    db.close();
  }
});
