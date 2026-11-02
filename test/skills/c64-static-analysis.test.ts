// The c64-static-analysis script with the decompiler and real DXA, which it runs
// itself.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { DXA } from "../../src/native/discover.ts";
import { openForRead } from "../../src/knowledge/database.ts";
import { analyzerNamesAt, listReferences, regionsOverlapping, symbolAt } from "../../src/knowledge/read.ts";
import { analysisSubjectPrg, MAIN, ROUTINE, TABLE_START } from "../fixtures/prg/analysis-subject.ts";
import { nthIn } from "../../src/knowledge/revisions.testkit.ts";
import { importPrg } from "../fixtures/program.ts";
import { runScript, scratchDir, skillScript, toolSkip } from "../kit.ts";

const dxaSkip = toolSkip(DXA);

const script = skillScript("c64-static-analysis", "static-analysis.ts");
const project = scratchDir("analysis");
// The program is the first revision of the knowledge.
importPrg(project, analysisSubjectPrg);

function analyze(...args: string[]) {
  return runScript(script, ["analyze", ...args], { cwd: project });
}

test("an analysis imports the decompiler's structure into knowledge and reports it", { timeout: 600_000 }, async () => {
  const { status, json } = await analyze("--entry", "$080d", "--decompile", "$0818", "--max-listed", "1");
  assert.equal(status, 0, JSON.stringify(json));
  assert.deepEqual(json.coverage, [{ start: "$0801", end: "$0827" }]);
  assert.equal(json.revision, nthIn(project, 2));
  assert.deepEqual(json.changes.names, { added: 2, changed: 0, retired: 0, unchanged: 0, suppressed: 0 });
  assert.deepEqual(json.conflicts, []);
  // The rest of the list is in the knowledge as the analyzer names of the decompiler.
  assert.deepEqual(json.functions, { count: 2, listed: [{ entry: "$080d", name: "FUN_080d" }], rest: "a larger --max-listed. The project knowledge has all of them as analyzer names" });
  assert.equal(json.decompilations[0]?.entry, "$0818");

  const db = openForRead(project);
  assert.equal(symbolAt(db, ROUTINE), undefined, "an analyzer name is no symbol");
  assert.equal(analyzerNamesAt(db, ROUTINE)[0]?.origin, "decompiler");
  assert.deepEqual(regionsOverlapping(db, 0, 0xffff).map((region) => [region.start, region.end, region.type, region.origin]), [
    [MAIN, 0x0815, "code", "decompiler"],
    [ROUTINE, 0x0823, "code", "decompiler"],
    // LDA $0824 makes the decompiler define the byte it reads.
    [TABLE_START, TABLE_START, "bytes", "decompiler"],
  ]);
  assert.ok(listReferences(db).some((reference) => reference.from === 0x081d && reference.to === TABLE_START && reference.kind === "read"));
  db?.close();
});

test("a DXA pass imports its regions and labels and writes the listing", { skip: dxaSkip, timeout: 120_000 }, async () => {
  const { status, json } = await analyze("--analyzer", "dxa", "--out-listing", "analysis/game.lst");
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.analyzer, "dxa");
  assert.equal(json.listing.out, "analysis/game.lst");
  assert.deepEqual(json.regions.listed, [
    { start: "$0801", end: "$080c", classification: "data" },
    { start: "$080d", end: "$0815", classification: "code" },
    { start: "$0816", end: "$0817", classification: "data" },
    { start: "$0818", end: "$0823", classification: "code" },
    { start: "$0824", end: "$0827", classification: "data" },
  ]);
  assert.match(readFileSync(join(project, "analysis", "game.lst"), "utf8"), /jsr /);
  const { labels } = json;
  assert.equal(labels.listed.length, labels.count, "a short list is not cut");
  assert.equal(labels.rest, undefined);
  const db = openForRead(project);
  // DXA's own facts sit beside the decompiler's from the test above; it does not replace them.
  assert.ok(regionsOverlapping(db, 0x0801, 0x080c).some((region) => region.origin === "dxa" && region.type === "bytes"));
  db?.close();
});

test("--decompile and --out-listing are refused with the analyzer that does not take them", async () => {
  for (const args of [
    ["--analyzer", "dxa", "--decompile", "$0818"],
    ["--out-listing", "x.lst"],
  ]) {
    const { status, json } = await analyze(...args);
    assert.equal(status, 2, args.join(" "));
    assert.equal(json.error.code, "invalid-input");
  }
});
