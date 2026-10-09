// One scenario PASSes an equivalent reconstruction, FAILs a behaviorally
// different one, and is INCONCLUSIVE when its checkpoint cannot be reached. Original and rebuild run one after
// the other in one real VICE; the original's names come from knowledge.db,
// the rebuild's from its symbol files. Opt-in with C64RT_LIVE_VICE.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { formatC64Address } from "../../../src/c64.ts";
import { ProcessSupervisor } from "../../../src/native/processes.ts";
import { startHostServer, type HostServer } from "../../../src/host/server.ts";
import { viceSessionFactory } from "../../../src/host/vice/session.ts";
import { openForWrite } from "../../../src/knowledge/database.ts";
import { renameSymbol } from "../../../src/knowledge/write.ts";
import { BROKEN, EQUIVALENT, ORIGINAL } from "../../fixtures/prg/counter-variants.ts";
import { liveEnv, liveLog, liveSkip } from "./live.ts";

const script = resolve(import.meta.dirname, "../../../skills/c64-testing/scripts/test.ts");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-m9-"));
let server: HostServer | undefined;
after(async () => {
  await server?.close();
  rmSync(project, { recursive: true, force: true });
});

function setUpProject(): void {
  writeFileSync(join(project, "original.prg"), ORIGINAL.prg);
  writeFileSync(join(project, "good.prg"), EQUIVALENT.prg);
  writeFileSync(join(project, "bad.prg"), BROKEN.prg);
  const db = openForWrite(project);
  for (const [name, address] of Object.entries(ORIGINAL.symbols)) renameSymbol(db, { origin: "llm" }, { address, name, kind: name === "counter" ? "variable" : "label" });
  db.close();
  // The good rebuild's symbols as c64-assembler prints them; the bad one's as a plain map.
  const assembled = { assembled: true, symbols: Object.entries(EQUIVALENT.symbols).map(([name, address]) => ({ name, kind: "address", address: formatC64Address(address), used: true })) };
  writeFileSync(join(project, "good.json"), JSON.stringify(assembled));
  writeFileSync(join(project, "bad.json"), JSON.stringify(Object.fromEntries(Object.entries(BROKEN.symbols).map(([name, address]) => [name, formatC64Address(address)]))));
  const scenario = (name: string, rebuild: string, checkpoint: string, timeoutFrames: number) => ({
    name,
    original: { program: "original.prg", symbols: "knowledge" },
    rebuild: { program: `${rebuild}.prg`, symbols: `${rebuild}.json` },
    steps: [
      { reset: "hard" },
      { frames: 150 },
      { load: true },
      { registers: { pc: "start" } },
      { runUntil: { at: checkpoint }, timeoutFrames },
      { frames: 2 },
      { observe: "counted", memory: ["counter"], registers: ["a"], screen: {}, vicii: true },
    ],
  });
  writeFileSync(join(project, "pass.json"), JSON.stringify(scenario("counts to ten", "good", "done", 100)));
  writeFileSync(join(project, "fail.json"), JSON.stringify(scenario("counts to ten", "bad", "done", 100)));
  writeFileSync(join(project, "inconclusive.json"), JSON.stringify(scenario("counts to ten", "good", "never", 10)));
}

async function hostAddress(): Promise<string> {
  if (server === undefined) {
    const supervisor = new ProcessSupervisor();
    supervisor.installExitGuard();
    server = await startHostServer({ port: 0, createViceSession: viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog }) });
  }
  return `${server.host}:${server.port}`;
}

async function runTest(scenario: string): Promise<{ status: number | null; json: Record<string, unknown> }> {
  const child = spawn(process.execPath, [script, scenario], { cwd: project, env: { ...process.env, C64RT_HOST: await hostAddress() }, stdio: ["ignore", "pipe", "inherit"] });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  return { status, json: JSON.parse(stdout) as Record<string, unknown> };
}

test("the equivalent rebuild passes, the different one fails, an unreachable checkpoint is inconclusive", { skip: liveSkip, timeout: 300_000 }, async () => {
  setUpProject();

  const pass = await runTest("pass.json");
  assert.deepEqual(pass.json, { result: "PASS", scenario: "counts to ten", checkpoints: ["counted"], differences: [] });
  assert.equal(pass.status, 0);

  const fail = await runTest("fail.json");
  assert.equal(fail.status, 1);
  assert.equal(fail.json.result, "FAIL");
  // Only the counter differs: the screen, the border and A are the same on both sides.
  assert.deepEqual(fail.json.differences, [{ checkpoint: "counted", what: "memory counter", original: 10, rebuild: 9 }]);

  const inconclusive = await runTest("inconclusive.json");
  assert.equal(inconclusive.status, 3);
  assert.equal(inconclusive.json.result, "INCONCLUSIVE");
  assert.match(inconclusive.json.reason as string, /original side did not reach the checkpoint before 10 frames/);
});
