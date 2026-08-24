#!/usr/bin/env node
// r2000-session.test.ts -- the tracer's own end-to-end proof (plan 18-03,
// SESS-01): many r2000_* calls in one vice-proxy.ts process are served by
// ONE held regenerator2000 child, and a project-path change evicts and
// respawns exactly once. Also carries D18-09's three-scenario
// save-discipline planted-violation gate.
//
// D-11 gate shape copied from r2000-tools.test.ts's own (skipReasonFor()
// plus the always-running assertR2000RequiredIfEnvSet test) rather than a
// hand-rolled `if (!available) return`, which would report a false PASS
// instead of a SKIP.
import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runR2000Tool } from "./r2000-tools.ts";
import { synthesizeProject } from "./r2000-project.ts";
import { R2000_BIN, skipReasonFor, assertR2000RequiredIfEnvSet } from "./r2000-test-gate.ts";
import { __r2000SessionStateForTest, __resetR2000SessionForTest } from "./r2000-session.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

const SKIP_REASON: string | false = skipReasonFor("r2000-session.test.ts");

test("regenerator2000 availability gate (D-11)", () => {
  assertR2000RequiredIfEnvSet(assert);
});

let liveWorkDir: string | undefined;

before(() => {
  // Created UNDER this directory (matching r2000-tools.test.ts's own
  // `.r2000-tools-test-live-` convention), not under the OS temp dir --
  // resolveStorePath() requires every project path to resolve inside the
  // workspace root, and a bare `os.tmpdir()` path never does.
  liveWorkDir = mkdtempSync(join(HERE, ".r2000-session-test-live-"));
});

beforeEach(async () => {
  await __resetR2000SessionForTest();
});

after(async () => {
  await __resetR2000SessionForTest();
  if (liveWorkDir) rmSync(liveWorkDir, { recursive: true, force: true });
});

/** Synthesises a fresh `.regen2000proj` from the committed
 * `probe-illegal.prg` fixture (the only .prg committed anywhere in this
 * repo -- D-31), under a unique name so the live tests below never collide
 * on one file. */
function synthesizeFixtureProject(name: string): { projectPath: string; origin: number } {
  const fixturePath = join(
    HERE,
    "..",
    "..",
    "..",
    ".planning",
    "phases",
    "09-the-assumption-probe-go-no-go",
    "evidence",
    "fixture",
    "probe-illegal.prg",
  );
  const prgBytes = readFileSync(fixturePath);
  const origin = prgBytes.readUInt16LE(0);
  const body = prgBytes.subarray(2);
  const projectJson = synthesizeProject(body, { origin });
  const projectPath = join(liveWorkDir!, `${name}.regen2000proj`);
  writeFileSync(projectPath, projectJson);
  return { projectPath, origin };
}

test(
  "gated: three consecutive r2000_* calls against the same project are served by ONE held child -- openCount stays 1, pid unchanged",
  { skip: SKIP_REASON },
  async () => {
    const { projectPath, origin } = synthesizeFixtureProject("reuse");

    const disasm = await runR2000Tool("r2000_disassemble", { project: projectPath, address: origin });
    assert.equal(disasm.isError, false, `r2000_disassemble failed: ${JSON.stringify(disasm)}`);
    const stateAfter1 = __r2000SessionStateForTest();
    assert.equal(stateAfter1.openCount, 1, `expected openCount 1 after call 1 (R2000_BIN="${R2000_BIN}")`);
    const heldPid = stateAfter1.pid;
    assert.ok(heldPid !== undefined, "expected the held session to expose a real pid after call 1");

    const setLabel = await runR2000Tool("r2000_set_label_name", {
      project: projectPath,
      address: origin,
      name: "entry_point",
    });
    assert.equal(setLabel.isError, false, `r2000_set_label_name failed: ${JSON.stringify(setLabel)}`);
    const stateAfter2 = __r2000SessionStateForTest();
    assert.equal(stateAfter2.openCount, 1, "expected openCount to stay 1 after call 2 -- one held child served both calls");
    assert.equal(stateAfter2.pid, heldPid, "expected the same pid after call 2");

    const getSymbols = await runR2000Tool("r2000_get_symbols", { project: projectPath, kind: "user" });
    assert.equal(getSymbols.isError, false, `r2000_get_symbols failed: ${JSON.stringify(getSymbols)}`);
    const stateAfter3 = __r2000SessionStateForTest();
    assert.equal(stateAfter3.openCount, 1, "expected openCount to stay 1 after call 3 -- one held child served all three");
    assert.equal(stateAfter3.pid, heldPid, "expected the same pid after call 3");

    const symbols = JSON.parse(getSymbols.content[0]!.text) as Array<{ name: string }>;
    assert.ok(
      symbols.some((s) => s.name === "entry_point"),
      `expected entry_point (written by call 2) to be visible to call 3, served by the same held child, got ${JSON.stringify(symbols)}`,
    );
  },
);

test(
  "gated: a call against a different project path evicts the held child and spawns exactly one fresh one -- openCount 2, different pids",
  { skip: SKIP_REASON },
  async () => {
    const projectA = synthesizeFixtureProject("evict-a");
    const projectB = synthesizeFixtureProject("evict-b");

    const callA = await runR2000Tool("r2000_get_binary_info", { project: projectA.projectPath });
    assert.equal(callA.isError, false, `r2000_get_binary_info (A) failed: ${JSON.stringify(callA)}`);
    const stateAfterA = __r2000SessionStateForTest();
    assert.equal(stateAfterA.openCount, 1, "expected openCount 1 after the first project's call");
    const pidA = stateAfterA.pid;
    assert.ok(pidA !== undefined, "expected a real pid after project A's call");

    const callB = await runR2000Tool("r2000_get_binary_info", { project: projectB.projectPath });
    assert.equal(callB.isError, false, `r2000_get_binary_info (B) failed: ${JSON.stringify(callB)}`);
    const stateAfterB = __r2000SessionStateForTest();
    assert.equal(
      stateAfterB.openCount,
      2,
      "expected openCount to increment to exactly 2 -- the project-path change must evict and respawn exactly once",
    );
    assert.notEqual(stateAfterB.pid, pidA, "expected a different pid after the project-path change");
  },
);
