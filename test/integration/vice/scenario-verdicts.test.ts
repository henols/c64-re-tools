// One scenario PASSes an equivalent reconstruction, FAILs a behaviorally
// different one, and is INCONCLUSIVE when its checkpoint cannot be reached. Reference and rebuild run one after
// the other in one real VICE; the reference's names come from the knowledge,
// the rebuild's from its symbol files. Opt-in with C64RT_LIVE_VICE.

import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { formatC64Address } from "../../../src/c64.ts";
import { openForWrite } from "../../../src/knowledge/database.ts";
import { renameSymbol } from "../../../src/knowledge/write.ts";
import { BROKEN, EQUIVALENT, REFERENCE } from "../../fixtures/prg/counter-variants.ts";
import { runScript, scratchDir, skillScript } from "../../kit.ts";
import { hostServer, liveSkip } from "./live.ts";

const script = skillScript("c64-testing", "testing.ts");
const project = scratchDir("verdicts");
const host = hostServer();

function setUpProject(): void {
  writeFileSync(join(project, "reference.prg"), REFERENCE.prg);
  writeFileSync(join(project, "good.prg"), EQUIVALENT.prg);
  writeFileSync(join(project, "bad.prg"), BROKEN.prg);
  const db = openForWrite(project);
  for (const [name, address] of Object.entries(REFERENCE.symbols)) renameSymbol(db, { origin: "llm" }, { address, name, kind: name === "counter" ? "variable" : "label" });
  db.close();
  // The good rebuild's symbols as c64-assembler prints them; the bad one's as a plain map.
  const assembled = { assembled: true, symbols: Object.entries(EQUIVALENT.symbols).map(([name, address]) => ({ name, kind: "address", address: formatC64Address(address), used: true })) };
  writeFileSync(join(project, "good.json"), JSON.stringify(assembled));
  writeFileSync(join(project, "bad.json"), JSON.stringify(Object.fromEntries(Object.entries(BROKEN.symbols).map(([name, address]) => [name, formatC64Address(address)]))));
  const scenario = (name: string, rebuild: string, checkpoint: string, timeoutFrames: number) => ({
    name,
    reference: { program: "reference.prg", symbols: "knowledge" },
    rebuild: { program: `${rebuild}.prg`, symbols: `${rebuild}.json` },
    steps: [
      { reset: "hard" },
      { frames: 150 },
      { load: true },
      { registers: { pc: "start" } },
      { runUntil: { target: { kind: "address", address: checkpoint }, timeoutFrames } },
      { frames: 2 },
      { observe: "counted", memory: ["counter"], registers: ["a"], screen: {}, vicii: true },
    ],
  });
  writeFileSync(join(project, "pass.json"), JSON.stringify(scenario("counts to ten", "good", "done", 100)));
  writeFileSync(join(project, "fail.json"), JSON.stringify(scenario("counts to ten", "bad", "done", 100)));
  writeFileSync(join(project, "inconclusive.json"), JSON.stringify(scenario("counts to ten", "good", "never", 10)));
}

const runTest = async (scenario: string) => runScript(script, ["test", scenario], { cwd: project, host: await host() });

test("the equivalent rebuild passes, the different one fails, an unreachable checkpoint is inconclusive", { skip: liveSkip, timeout: 300_000 }, async () => {
  setUpProject();

  const pass = await runTest("pass.json");
  assert.deepEqual(pass.json, { result: "PASS", scenario: "counts to ten", checkpoints: ["counted"], differences: [] });
  assert.equal(pass.status, 0);

  const fail = await runTest("fail.json");
  assert.equal(fail.status, 0);
  assert.equal(fail.json.result, "FAIL");
  // Only the counter differs: the screen, the border and A are the same on both sides.
  assert.deepEqual(fail.json.differences, [{ checkpoint: "counted", what: "memory counter", bytes: { count: 1, listed: [{ address: "$c100", reference: "0a", rebuild: "09" }] } }]);

  const inconclusive = await runTest("inconclusive.json");
  assert.equal(inconclusive.status, 0);
  assert.equal(inconclusive.json.result, "INCONCLUSIVE");
  assert.match(inconclusive.json.reason as string, /reference side did not reach the checkpoint before 10 frames/);
});
