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
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runR2000Tool, __R2000_TEST_ONLY_SUPPRESS_INTERNAL_SAVE } from "./r2000-tools.ts";
import { synthesizeProject } from "./r2000-project.ts";
import { R2000_BIN, skipReasonFor, assertR2000RequiredIfEnvSet } from "./r2000-test-gate.ts";
import { __r2000SessionStateForTest, __resetR2000SessionForTest, closeR2000SessionSync } from "./r2000-session.ts";

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

// ===========================================================================
// D18-09: the save-discipline planted-violation gate -- this phase's own
// go/no-go, landed before anything else depends on the session. Three
// scenarios, matching .planning/research/ARCHITECTURE.md's Q2 exactly:
//   1. Green path -- a mutation persists across a SIGKILL delivered the
//      instant runR2000Tool() resolves.
//   2. Non-vacuity -- with the internal save suppressed, the identical
//      sequence now correctly fails. If it did not, scenario 1 would be
//      proving nothing.
//   3. Mid-window crash -- a child killed between the mutating tools/call
//      and its own internal save surfaces a named, distinguishable error,
//      never a silent success, and leaves the file byte-identical.
// ===========================================================================

const SCENARIO_1_TITLE =
  "gated: D18-09 scenario 1 (green path) -- a mutation persists across a SIGKILL delivered the instant runR2000Tool() resolves";
const SCENARIO_2_TITLE =
  "gated: D18-09 scenario 2 (non-vacuity) -- with the internal save suppressed, the SAME kill-and-reread sequence now correctly finds the label ABSENT";

/** Reads `labels[String(address)]` out of a `.regen2000proj`'s raw JSON on
 * disk -- confirmed live shape (a real regenerator2000 0.9.20 run) is
 * `{"<address>":[{"name":...,"label_type":...,"kind":...}]}`. Read straight
 * from disk with `readFileSync`/`JSON.parse`, never through a reopened
 * session, so this helper's own correctness does not depend on the code
 * path scenarios 1/2 are testing. */
function readLabelNamesAtAddress(projectPath: string, address: number): string[] {
  const raw = readFileSync(projectPath, "utf8");
  const parsed = JSON.parse(raw) as { labels?: Record<string, Array<{ name: string }>> };
  return (parsed.labels?.[String(address)] ?? []).map((l) => l.name);
}

test("D18-09 non-vacuity control: __R2000_TEST_ONLY_SUPPRESS_INTERNAL_SAVE reads off at module load", () => {
  assert.equal(
    __R2000_TEST_ONLY_SUPPRESS_INTERNAL_SAVE.active,
    false,
    "expected r2000-tools.ts's save-suppression toggle to default off at module load -- it must only ever " +
      "be on for the instant scenario 2 itself is running",
  );
});

test("D18-09 non-vacuity control: __R2000_TEST_ONLY_SUPPRESS_INTERNAL_SAVE's identifier appears in r2000-tools.ts only at its definition and its one read site", () => {
  const src = readFileSync(join(HERE, "r2000-tools.ts"), "utf8");
  const matches = src.match(/__R2000_TEST_ONLY_SUPPRESS_INTERNAL_SAVE/g) ?? [];
  assert.equal(
    matches.length,
    2,
    `expected the toggle's identifier to appear exactly twice in r2000-tools.ts (its definition and its one ` +
      `read site inside runR2000Tool()'s mutating branch) -- found ${matches.length} occurrence(s); a third ` +
      `occurrence would mean production code somewhere else reads or sets this test-only toggle.`,
  );
});

test(
  SCENARIO_1_TITLE,
  { skip: SKIP_REASON },
  async () => {
    const { projectPath, origin } = synthesizeFixtureProject("d18-09-scenario1");

    const setLabel = await runR2000Tool("r2000_set_label_name", {
      project: projectPath,
      address: origin,
      name: "scenario1_label",
    });
    assert.equal(setLabel.isError, false, `r2000_set_label_name failed: ${JSON.stringify(setLabel)}`);

    // The instant the mutating call resolves, SIGKILL the held child --
    // closeR2000SessionSync() calls the session's own killSync() directly,
    // bypassing the graceful stdin-close path entirely.
    const killed = closeR2000SessionSync("D18-09 scenario 1 planted kill");
    assert.ok(killed, "expected a live session to be held (and killed) right after the mutating call resolved");

    const names = readLabelNamesAtAddress(projectPath, origin);
    assert.ok(
      names.includes("scenario1_label"),
      `expected "scenario1_label" to survive a SIGKILL delivered the instant the mutating call resolved -- ` +
        `if THIS assertion fails, persistence itself has regressed (see "${SCENARIO_2_TITLE}" for the paired ` +
        `non-vacuity control). Got labels: ${JSON.stringify(names)}`,
    );
  },
);

test(
  SCENARIO_2_TITLE,
  { skip: SKIP_REASON },
  async () => {
    const { projectPath, origin } = synthesizeFixtureProject("d18-09-scenario2");

    __R2000_TEST_ONLY_SUPPRESS_INTERNAL_SAVE.active = true;
    let setLabel;
    try {
      setLabel = await runR2000Tool("r2000_set_label_name", {
        project: projectPath,
        address: origin,
        name: "scenario2_label",
      });
    } finally {
      __R2000_TEST_ONLY_SUPPRESS_INTERNAL_SAVE.active = false;
    }
    assert.equal(setLabel.isError, false, `r2000_set_label_name (save suppressed) failed: ${JSON.stringify(setLabel)}`);

    const killed = closeR2000SessionSync("D18-09 scenario 2 planted kill (save suppressed)");
    assert.ok(killed, "expected a live session to be held (and killed) right after the mutating call resolved");

    const names = readLabelNamesAtAddress(projectPath, origin);
    assert.ok(
      !names.includes("scenario2_label"),
      `expected "scenario2_label" to be ABSENT with the internal save suppressed -- if THIS assertion fails ` +
        `(the label survived anyway), "${SCENARIO_1_TITLE}" is not actually exercising the save-discipline ` +
        `invariant and must be rewritten before it is trusted. Got labels: ${JSON.stringify(names)}`,
    );
  },
);

// -- Scenario 3: mid-window crash, via a scripted stub (never the real   --
// -- binary -- the SESSION's own crash handling is what is under test here,
// -- adapted into THIS file so it never contends with r2000-mcp-client.test
// -- .ts's own STUB_SOURCE for one shared stub-mode env var). --------------

/** One stub server body: answers `initialize` normally, answers every
 * mutating `tools/call` with a bare success (in-memory only -- this stub
 * never touches a real project file), then exits BEFORE answering the
 * `r2000_save_project` call that follows it -- landing the simulated crash
 * exactly inside the window between a mutation and its own internal save
 * (D18-09 scenario 3). */
const SCENARIO_3_STUB_SOURCE = `
import { createInterface } from "node:readline";
const rl = createInterface({ input: process.stdin, terminal: false });
function send(msg) { process.stdout.write(JSON.stringify(msg) + "\\n"); }
rl.on("line", (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.method === "initialize") {
    send({ jsonrpc: "2.0", id: msg.id, result: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      serverInfo: { name: "d18-09-scenario3-stub", version: "0.0.0" },
    } });
    return;
  }
  if (msg.method === "notifications/initialized") return;
  if (msg.method === "tools/call") {
    const name = msg.params && msg.params.name;
    if (name === "r2000_save_project") {
      process.exit(1); // die BEFORE answering the save -- never write anything
    }
    send({ jsonrpc: "2.0", id: msg.id, result: { content: [ { type: "text", text: "ok" } ] } });
    return;
  }
  if (msg.id !== undefined) {
    send({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "unhandled method " + msg.method } });
  }
});
`;

let scenario3Dir: string | undefined;

after(() => {
  if (scenario3Dir) rmSync(scenario3Dir, { recursive: true, force: true });
});

test(
  "D18-09 scenario 3: a child killed between a mutating tools/call and its own internal save surfaces a named, distinguishable error (never a silent success), leaving the file byte-identical",
  async () => {
    scenario3Dir = mkdtempSync(join(HERE, ".r2000-session-test-scenario3-"));
    const stubScript = join(scenario3Dir, "stub.mjs");
    writeFileSync(stubScript, SCENARIO_3_STUB_SOURCE);
    const wrapper = join(scenario3Dir, "r2000-stub-wrapper.sh");
    writeFileSync(wrapper, `#!/bin/sh\nexec "${process.execPath}" "${stubScript}" "$@"\n`);
    chmodSync(wrapper, 0o755);

    // A REAL (if minimal) .regen2000proj -- runInR2000Session() calls
    // ensureProjectSettings() (D18-32) before ever reaching this scenario's
    // stub, and that function requires valid, already-forced-settings JSON.
    // The stub itself never parses this file's content either way; only its
    // BYTES (unchanged after the crash) are what this scenario asserts on.
    const projectPath = join(scenario3Dir, "scenario3.regen2000proj");
    writeFileSync(projectPath, synthesizeProject(new Uint8Array([0]), { origin: 0xc000 }));
    const beforeHash = createHash("sha256").update(readFileSync(projectPath)).digest("hex");

    const savedBin = process.env.R2000_BIN;
    process.env.R2000_BIN = wrapper;
    let result: Awaited<ReturnType<typeof runR2000Tool>>;
    try {
      result = await runR2000Tool("r2000_set_label_name", {
        project: projectPath,
        address: 0xc000,
        name: "scenario3_label",
      });
    } finally {
      if (savedBin === undefined) delete process.env.R2000_BIN;
      else process.env.R2000_BIN = savedBin;
    }

    assert.equal(result.isError, true, "expected the mid-window crash to surface as an error result, never a success");
    assert.match(
      result.content[0]!.text,
      /R2000ChildExitError/,
      `expected the error text to name R2000ChildExitError by class -- got: ${result.content[0]!.text}`,
    );

    const afterHash = createHash("sha256").update(readFileSync(projectPath)).digest("hex");
    assert.equal(
      afterHash,
      beforeHash,
      "expected the project file's bytes to be hash-identical to their pre-call value -- the mutation must " +
        "be absent, not half-written",
    );
  },
);
