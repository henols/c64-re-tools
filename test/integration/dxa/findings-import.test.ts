// Through the real skill scripts and real DXA, which the script runs itself:
// a fixture PRG goes through DXA, normalized findings and the importer into
// knowledge.db; a second, seeded run changes the result and retires the
// obsolete DXA facts, keeps the history and protects the semantic knowledge;
// a malformed listing imports nothing.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { DXA, findTool } from "../../../src/native/discover.ts";
import { openForRead } from "../../../src/knowledge/database.ts";
import { historyAt } from "../../../src/knowledge/history.ts";
import { currentRevision, regionsOverlapping, symbolAt } from "../../../src/knowledge/read.ts";
import { analysisSubjectPrg } from "../../fixtures/prg/analysis-subject.ts";

let skip: string | false = false;
try {
  findTool(DXA);
} catch {
  skip = "dxa is not installed: install dxa or set C64RT_DXA to run this test";
}

const skills = resolve(import.meta.dirname, "../../../skills");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-m7-"));
writeFileSync(join(project, "game.prg"), analysisSubjectPrg);
after(() => rmSync(project, { recursive: true, force: true }));

async function skill(env: NodeJS.ProcessEnv, name: string, file: string, ...args: string[]): Promise<{ status: number | null; json: Record<string, unknown> }> {
  // No Host Runtime: the script would fail if it asked one for DXA.
  const child = spawn(process.execPath, [join(skills, name, "scripts", file), ...args], { cwd: project, env: { ...env, C64RT_HOST: "127.0.0.1:1" }, stdio: ["ignore", "pipe", "inherit"] });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  return { status, json: JSON.parse(stdout) as Record<string, unknown> };
}

const regions = () => {
  const db = openForRead(project);
  const list = regionsOverlapping(db, 0, 0xffff).map((region) => [region.start, region.end, region.type, region.origin]);
  db?.close();
  return list;
};

test("DXA findings reconcile through the importer, protect semantic knowledge and never import half a result", { skip, timeout: 300_000 }, async () => {
  const env = process.env;

  // 1. First DXA pass: its regions and labels become DXA knowledge.
  const first = await skill(env, "c64-static-analysis", "analyze.ts", "game.prg", "--analyzer", "dxa");
  assert.equal(first.status, 0, JSON.stringify(first.json));
  assert.equal(first.json.revision, 1);
  assert.deepEqual(regions(), [
    [0x0801, 0x080c, "bytes", "dxa"],
    [0x080d, 0x0815, "code", "dxa"],
    [0x0816, 0x0817, "bytes", "dxa"],
    [0x0818, 0x0823, "code", "dxa"],
    [0x0824, 0x0827, "bytes", "dxa"],
  ]);

  // 2. Semantic work: the LLM names the routine, the user says what the table is.
  assert.equal((await skill(env, "c64-knowledge", "knowledge.ts", "rename", "$0818", "init_result", "--kind", "routine", "--expect-revision", "1")).json.revision, 2);
  assert.equal((await skill(env, "c64-knowledge", "knowledge.ts", "classify", "$0824", "$0827", "sprite", "--origin", "user", "--expect-revision", "2")).json.revision, 3);

  // 3. A changed program: NOPs instead of the JMP let the code run on into the routine, so the two
  //    unused bytes become reachable code. (A JMP to them is not enough: DXA keeps them as data.)
  const changed = Buffer.from(analysisSubjectPrg);
  changed.set([0xea, 0xea, 0xea, 0xea, 0xea], 0x0813 - 0x0801 + 2);
  writeFileSync(join(project, "game-v2.prg"), changed);
  const second = await skill(env, "c64-static-analysis", "analyze.ts", "game-v2.prg", "--analyzer", "dxa");
  assert.equal(second.status, 0, JSON.stringify(second.json));
  assert.equal(second.json.revision, 4);
  assert.deepEqual(second.json.conflicts, [], "a finer data type from the user is no conflict");
  assert.deepEqual((second.json.changes as { regions: unknown }).regions, { added: 1, changed: 0, retired: 3, unchanged: 1 });
  assert.deepEqual(regions(), [
    [0x0801, 0x080c, "bytes", "dxa"],
    [0x080d, 0x0823, "code", "dxa"],
    [0x0824, 0x0827, "sprite", "user"],
  ]);
  const db = openForRead(project);
  assert.deepEqual(symbolAt(db, 0x0818), { address: 0x0818, name: "init_result", kind: "routine", origin: "llm", revision: 2 }, "the echoed seed stays semantic");
  const regionHistory = historyAt(db, 0x0816).flatMap((entry) => (entry.entity === "region" ? [[entry.row.type, entry.row.origin, entry.to ?? null]] : []));
  assert.deepEqual(regionHistory, [
    ["bytes", "dxa", 4],
    ["code", "dxa", null],
  ], "the retired DXA data region stays in the history");
  const symbolHistory = historyAt(db, 0x0818).flatMap((entry) => (entry.entity === "symbol" ? [[entry.row.name, entry.row.origin]] : []));
  assert.deepEqual(symbolHistory, [
    ["l818", "dxa"],
    ["init_result", "llm"],
  ]);
  const before = currentRevision(db);
  db?.close();

  // 4. A malformed listing (a dxa that stops early) imports nothing.
  const fake = join(project, "fake-dxa.ts");
  writeFileSync(fake, `#!/usr/bin/env node\nprocess.stdout.write("0801 0b 08 0a \\t.byt $0b,$08,$0a\\n0804 00 9e 32 \\t.byt $00,$9e,$32\\n");\n`);
  chmodSync(fake, 0o755);
  // Windows starts no script by its shebang: a .cmd file runs it through Node (the supervisor starts .cmd through cmd.exe).
  const program = process.platform === "win32" ? join(project, "fake-dxa.cmd") : fake;
  if (program !== fake) writeFileSync(program, `@"${process.execPath}" "${fake}" %*\r\n`);
  const broken = await skill({ ...process.env, C64RT_DXA: program }, "c64-static-analysis", "analyze.ts", "game.prg", "--analyzer", "dxa");
  assert.equal(broken.status, 1);
  assert.match((broken.json.error as { message: string }).message, /incomplete or inconsistent listing\. Nothing was imported/);
  const after = openForRead(project);
  assert.equal(currentRevision(after), before, "no revision for a malformed result");
  after?.close();
});
