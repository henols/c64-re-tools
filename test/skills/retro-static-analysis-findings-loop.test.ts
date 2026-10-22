// The iterative loop through the real skill scripts with Ghidra, which the
// script runs itself:
//   Ghidra import → semantic rename → Ghidra seeded from knowledge →
//   the same importer, history and conflicts kept, echoed seeds not owned.
// The language checks are in src/native/ghidra/language.test.ts.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { analysisSubjectPrg } from "../fixtures/prg/analysis-subject.ts";
import { importPrg } from "../fixtures/program.ts";
import { openForRead, withWrite } from "../../src/knowledge/database.ts";
import { historyAt, revisions } from "../../src/knowledge/history.ts";
import { analyzerNamesAt, symbolAt } from "../../src/knowledge/read.ts";
import { nthIn } from "../../src/knowledge/revisions.testkit.ts";
import { renameSymbol } from "../../src/knowledge/write.ts";
import { readEnvelope } from "../kit.ts";

const script = resolve(import.meta.dirname, "../../skills/retro-static-analysis/scripts/static-analysis.ts");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-m8-"));
after(() => rmSync(project, { recursive: true, force: true }));

/** Runs an analysis in the project. No Host Runtime runs: the script runs its tools itself. */
async function analyze(...args: string[]): Promise<Record<string, unknown>> {
  const child = spawn(process.execPath, [...process.execArgv, script, "analyze", ...args], { cwd: project, env: { ...process.env, C64RT_HOST: "127.0.0.1:1" }, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  assert.equal(stderr, "");
  return readEnvelope(stdout, status).json as Record<string, unknown>;
}

/** Reads the knowledge of the project. */
function read<T>(work: (db: ReturnType<typeof openForRead>) => T): T {
  const db = openForRead(project);
  try {
    return work(db);
  } finally {
    db?.close();
  }
}

test("Ghidra findings, a semantic rename and a seeded re-run go through one importer", { timeout: 120_000 }, async () => {
  // 1. The program goes into the knowledge; the first Ghidra pass makes generated names, regions and references Ghidra knowledge.
  importPrg(project, analysisSubjectPrg);
  const first = await analyze("--entry", "$080d");
  assert.equal(first.revision, nthIn(project, 2), JSON.stringify(first));
  assert.deepEqual(read((db) => analyzerNamesAt(db, 0x0818)), [{ space: "c64", address: 0x0818, name: "FUN_0818", kind: "routine", origin: "ghidra", revision: nthIn(project, 2) }]);

  // 2. Semantic work: the LLM names the routine; the user marks $080d as data (wrong on purpose).
  withWrite((db) => renameSymbol(db, { origin: "llm", description: "stores the result", expectedRevision: nthIn(project, 2) }, { address: 0x0818, name: "init_result", kind: "routine" }), project);
  withWrite((db) => renameSymbol(db, { origin: "user", expectedRevision: nthIn(project, 3) }, { address: 0x080d, name: "start_table", kind: "variable" }), project);

  // 3. Seeded re-run: Ghidra gets the semantic names; nothing changes owner, the contradiction is reported.
  const second = await analyze("--entry", "$080d", "--decompile", "$080d");
  assert.equal(second.revision, null, JSON.stringify(second));
  assert.deepEqual(second.conflicts, [
    {
      at: "$080d",
      knowledge: { name: "start_table", kind: "variable", origin: "user", at: "$080d" },
      ghidra: { name: "start_table", kind: "routine" },
      problem: "code and data disagree",
    },
  ]);
  const decompiled = (second.decompilations as Array<{ entry: string; text: string }>)[0]!;
  assert.match(decompiled.text, /init_result\(\);/, "the decompiler uses the semantic name");

  // 4. Knowledge after the loop: semantic names stay with their owners, history is complete.
  read((db) => {
    assert.deepEqual(symbolAt(db, 0x0818), { space: "c64", address: 0x0818, name: "init_result", kind: "routine", origin: "llm", revision: nthIn(project, 3) });
    assert.deepEqual(analyzerNamesAt(db, 0x0818).map((row) => row.name), ["FUN_0818"], "Ghidra's own name stays a second name");
    assert.deepEqual(
      historyAt(db, 0x0818).flatMap((entry) => (entry.entity === "symbol" || entry.entity === "analyzer-name" ? [[entry.entity, entry.row.name, entry.row.origin]] : [])),
      [
        ["analyzer-name", "FUN_0818", "ghidra"],
        ["symbol", "init_result", "llm"],
      ],
    );
    assert.deepEqual(revisions(db).map((entry) => [entry.id, entry.origin]).reverse(), [
      [nthIn(project, 1), "user"],
      [nthIn(project, 2), "ghidra"],
      [nthIn(project, 3), "llm"],
      [nthIn(project, 4), "user"],
    ]);
  });
});
