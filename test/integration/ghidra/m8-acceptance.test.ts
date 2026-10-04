// Milestone 8 acceptance (19 §10), the iterative loop through the real skill
// scripts and a real Host Runtime with real Ghidra:
//   Ghidra import → semantic rename → Ghidra seeded from knowledge →
//   the same importer, history and conflicts kept, echoed seeds not owned.
// The language checks are in language.test.ts. Skipped without Ghidra.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { ProcessSupervisor } from "../../../src/host/processes.ts";
import { startHostServer, type HostServer } from "../../../src/host/server.ts";
import { findGhidra } from "../../../src/host/tools/ghidra/index.ts";
import { createToolDispatcher } from "../../../src/host/tools/index.ts";
import { WireFailure } from "../../../src/protocol.ts";
import { analysisSubjectPrg } from "../../fixtures/prg/analysis-subject.ts";

let skip: string | false = false;
try {
  findGhidra();
} catch {
  skip = "Ghidra is not installed: set C64RT_GHIDRA to the Ghidra installation directory to run this test";
}

const skills = resolve(import.meta.dirname, "../../../skills");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-m8-"));
writeFileSync(join(project, "game.prg"), analysisSubjectPrg);
let server: HostServer | undefined;
after(async () => {
  await server?.close();
  rmSync(project, { recursive: true, force: true });
});

async function hostAddress(): Promise<string> {
  if (server === undefined) {
    const supervisor = new ProcessSupervisor();
    supervisor.installExitGuard();
    server = await startHostServer({
      port: 0,
      createViceSession: async () => {
        throw new WireFailure("machine-unavailable", "no emulators here");
      },
      tools: createToolDispatcher({ supervisor }),
    });
  }
  return `${server.host}:${server.port}`;
}

/** Runs a skill script in the project. The host runs in this process, so the script must not block it. */
async function skill(name: string, file: string, ...args: string[]): Promise<Record<string, unknown>> {
  const child = spawn(process.execPath, [join(skills, name, "scripts", file), ...args], { cwd: project, env: { ...process.env, C64RT_HOST: await hostAddress() }, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  await once(child, "exit");
  assert.equal(stderr, "");
  return JSON.parse(stdout) as Record<string, unknown>;
}

test("Ghidra findings, a semantic rename and a seeded re-run go through one importer", { skip, timeout: 900_000 }, async () => {
  // 1. First Ghidra pass: generated names, regions and references become Ghidra knowledge.
  const first = await skill("c64-static-analysis", "analyze.ts", "game.prg", "--entry", "$080d");
  assert.equal(first.revision, 1, JSON.stringify(first));
  assert.deepEqual((await skill("c64-knowledge", "knowledge.ts", "at", "$0818")).symbol, { address: "$0818", name: "FUN_0818", kind: "routine", origin: "ghidra", revision: 1 });

  // 2. Semantic work: the LLM names the routine; the user marks $080d as data (wrong on purpose).
  const renamed = await skill("c64-knowledge", "knowledge.ts", "rename", "$0818", "init_result", "--kind", "routine", "--reason", "stores the result", "--expect-revision", "1");
  assert.equal(renamed.revision, 2, JSON.stringify(renamed));
  const marked = await skill("c64-knowledge", "knowledge.ts", "rename", "$080d", "start_table", "--kind", "variable", "--origin", "user", "--expect-revision", "2");
  assert.equal(marked.revision, 3, JSON.stringify(marked));

  // 3. Seeded re-run: Ghidra gets the semantic names; nothing changes owner, the contradiction is reported.
  const second = await skill("c64-static-analysis", "analyze.ts", "game.prg", "--entry", "$080d", "--decompile", "$080d");
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
  const at = await skill("c64-knowledge", "knowledge.ts", "at", "$0818");
  assert.deepEqual(at.symbol, { address: "$0818", name: "init_result", kind: "routine", origin: "llm", revision: 2 });
  const history = (await skill("c64-knowledge", "knowledge.ts", "history", "$0818")) as { history: Array<{ entity: string; name?: string; origin: string }> };
  assert.deepEqual(
    history.history.filter((entry) => entry.entity === "symbol").map((entry) => [entry.name, entry.origin]),
    [
      ["FUN_0818", "ghidra"],
      ["init_result", "llm"],
    ],
  );
  const revisions = (await skill("c64-knowledge", "knowledge.ts", "revisions")) as { revisions: Array<{ id: number; origin: string }> };
  assert.deepEqual(revisions.revisions.map((entry) => [entry.id, entry.origin]).sort(), [
    [1, "ghidra"],
    [2, "llm"],
    [3, "user"],
  ]);
});
