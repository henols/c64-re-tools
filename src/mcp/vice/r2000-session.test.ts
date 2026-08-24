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
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runR2000Tool, __R2000_TEST_ONLY_SUPPRESS_INTERNAL_SAVE } from "./r2000-tools.ts";
import { synthesizeProject } from "./r2000-project.ts";
import { R2000_BIN, skipReasonFor, assertR2000RequiredIfEnvSet } from "./r2000-test-gate.ts";
import {
  __r2000SessionStateForTest,
  __resetR2000SessionForTest,
  closeR2000SessionSync,
  runInR2000Session,
} from "./r2000-session.ts";
import {
  R2000ChildExitError,
  R2000TimeoutError,
  R2000RestartBudgetExhaustedError,
} from "./r2000-mcp-client.ts";

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

// ===========================================================================
// Plan 18-04 task 2: SESS-02's proof -- stub-driven crash scenarios (D18-10
// through D18-14) and a live kill. Every assertion below reads
// __r2000SessionStateForTest()'s OWN counters and checks error identity by
// `instanceof`, never message text and never wall-clock timing (`crashCount`/
// `dead` were added to that snapshot by task 1 for exactly this purpose).
// ===========================================================================

/**
 * One stub server body, selecting its per-child behaviour from
 * `process.env.SESS02_STUB_MODE` (read ONCE at child startup, matching real
 * regenerator2000's own one-shot-per-process nature -- a mode never changes
 * mid-life for an already-spawned child). Every `tools/call` frame received
 * is appended to `process.env.SESS02_CALL_LOG` (when set) as `<name>\n`,
 * regardless of mode, so the no-retry assertion below can count frames by
 * tool name directly rather than inferring it from call outcomes.
 *
 *   "happy"                 -- answers every tools/call normally, forever.
 *   "exit-mid-call"         -- dies (exit 1) on the FIRST tools/call frame,
 *                              before answering it (a mid-call death).
 *   "die-on-second-call"    -- answers the FIRST tools/call frame normally,
 *                              then dies (exit 1) on the SECOND, before
 *                              answering it -- lets one test script produce
 *                              "respawn, run (ok), then crash again" in a
 *                              single child lifetime, for the restart-budget
 *                              test's repeated cycles.
 *   "exit-after-reply-delayed" -- answers the FIRST tools/call frame
 *                              normally, then exits cleanly (code 0) on its
 *                              own ~30ms later, with NO request pending --
 *                              the between-calls death (D18-10).
 *   "wedge"                 -- answers `initialize` normally, then never
 *                              answers any `tools/call` (the wedge, D18-13).
 */
const SESS02_STUB_SOURCE = `
import { createInterface } from "node:readline";
import { appendFileSync } from "node:fs";
const MODE = process.env.SESS02_STUB_MODE || "happy";
const LOG = process.env.SESS02_CALL_LOG;
const rl = createInterface({ input: process.stdin, terminal: false });
function send(msg) { process.stdout.write(JSON.stringify(msg) + "\\n"); }
let liveCallCount = 0;
rl.on("line", (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.method === "initialize") {
    send({ jsonrpc: "2.0", id: msg.id, result: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      serverInfo: { name: "sess02-stub-" + MODE, version: "0.0.0" },
    } });
    return;
  }
  if (msg.method === "notifications/initialized") return;
  if (msg.method === "tools/call") {
    const name = (msg.params && msg.params.name) || "";
    if (LOG) appendFileSync(LOG, name + "\\n");
    liveCallCount++;
    if (MODE === "wedge") return; // never answer any tools/call
    if (MODE === "exit-mid-call" && liveCallCount === 1) { process.exit(1); }
    if (MODE === "die-on-second-call" && liveCallCount >= 2) { process.exit(1); }
    send({ jsonrpc: "2.0", id: msg.id, result: { content: [ { type: "text", text: "ok " + name } ] } });
    if (MODE === "exit-after-reply-delayed" && liveCallCount === 1) {
      setTimeout(() => process.exit(0), 30);
    }
    return;
  }
  if (msg.id !== undefined) {
    send({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "unhandled method " + msg.method } });
  }
});
`;

let sess02Dir: string | undefined;

after(() => {
  if (sess02Dir) rmSync(sess02Dir, { recursive: true, force: true });
});

/** Builds a fresh stub wrapper + a fresh, minimal `.regen2000proj` under a
 * unique subdirectory of `sess02Dir`, so each test in this section gets its
 * own project path (never colliding with a sibling test's own held slot). */
function setUpSess02Fixture(name: string): { projectPath: string; wrapper: string } {
  if (!sess02Dir) sess02Dir = mkdtempSync(join(HERE, ".r2000-session-test-sess02-"));
  const dir = join(sess02Dir, name);
  mkdirSync(dir);
  const stubScript = join(dir, "stub.mjs");
  writeFileSync(stubScript, SESS02_STUB_SOURCE);
  const wrapper = join(dir, "wrapper.sh");
  writeFileSync(wrapper, `#!/bin/sh\nexec "${process.execPath}" "${stubScript}" "$@"\n`);
  chmodSync(wrapper, 0o755);
  const projectPath = join(dir, "p.regen2000proj");
  writeFileSync(projectPath, synthesizeProject(new Uint8Array([0]), { origin: 0xc000 }));
  return { projectPath, wrapper };
}

/** Polls `__r2000SessionStateForTest()` until `predicate` is true or
 * `timeoutMs` elapses -- used ONLY to wait for a stub's own scheduled exit
 * (or a real SIGKILL's exit event) to be observed, never to wait out a
 * fixed sleep. */
async function waitUntilSessionState(
  predicate: (s: ReturnType<typeof __r2000SessionStateForTest>) => boolean,
  timeoutMs: number,
): Promise<ReturnType<typeof __r2000SessionStateForTest>> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const s = __r2000SessionStateForTest();
    if (predicate(s)) return s;
    if (Date.now() >= deadline) return s;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** Saves the named env vars, runs `fn`, then restores them exactly --
 * `undefined` beforehand means "delete", not "set to the string
 * 'undefined'". Shared by every test below that points `R2000_BIN` and a
 * stub-mode var at the fixtures above. */
async function withEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) saved[k] = process.env[k];
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test(
  "stub: a child that exits cleanly between two calls is invisible and lossless -- next call succeeds, openCount +1, crashCount +1, no error",
  async () => {
    const { projectPath, wrapper } = setUpSess02Fixture("between-calls");
    await withEnv({ R2000_BIN: wrapper, SESS02_STUB_MODE: "exit-after-reply-delayed" }, async () => {
      const r1 = await runInR2000Session(projectPath, (call) => call("t", {}));
      assert.ok(r1, "expected call 1 to succeed");
      const s1 = __r2000SessionStateForTest();
      assert.equal(s1.openCount, 1);
      assert.equal(s1.crashCount, 0);
      assert.equal(s1.dead, false);

      const s2 = await waitUntilSessionState((s) => s.dead === true, 2000);
      assert.equal(s2.dead, true, "expected the stub's own scheduled exit to have landed between calls");
      assert.equal(s2.crashCount, 1, "expected the between-calls exit to count as exactly one crash");

      const r2 = await runInR2000Session(projectPath, (call) => call("t", {}));
      assert.ok(r2, "expected call 2 to succeed transparently (D18-11) -- no error surfaced to the caller");
      const s3 = __r2000SessionStateForTest();
      assert.equal(s3.openCount, 2, "expected exactly one respawn");
      assert.equal(s3.crashCount, 1, "expected the crash counter to still read 1 -- unchanged by a successful call");
      assert.equal(s3.dead, false);
    });
  },
);

test(
  "stub: a child that exits mid-call rejects with R2000ChildExitError, is never retried, and a subsequent call opens a fresh child and succeeds",
  async () => {
    const { projectPath, wrapper } = setUpSess02Fixture("mid-call");
    const logPath = join(sess02Dir!, "mid-call", "calls.log");
    await withEnv(
      { R2000_BIN: wrapper, SESS02_STUB_MODE: "exit-mid-call", SESS02_CALL_LOG: logPath },
      async () => {
        await assert.rejects(
          () => runInR2000Session(projectPath, (call) => call("r2000_probe_tool", {})),
          (err: unknown) => {
            assert.ok(err instanceof R2000ChildExitError, `expected R2000ChildExitError, got ${(err as Error)?.name}`);
            return true;
          },
        );
        const s1 = __r2000SessionStateForTest();
        assert.equal(s1.open, false, "expected the slot to be cleared after a mid-call death");
        assert.equal(s1.crashCount, 1);

        const frames = readFileSync(logPath, "utf8")
          .split("\n")
          .filter((l) => l === "r2000_probe_tool");
        assert.equal(frames.length, 1, "expected exactly one tools/call frame for the tool that died mid-call -- no retry");
      },
    );

    // A subsequent call, same path, mode flipped so the freshly-spawned
    // child does not immediately die again -- proves the mid-call failure
    // was loud for the call that died, not sticky for the session.
    await withEnv({ R2000_BIN: wrapper, SESS02_STUB_MODE: "happy" }, async () => {
      const r2 = await runInR2000Session(projectPath, (call) => call("r2000_probe_tool", {}));
      assert.ok(r2, "expected the next call to open a fresh child and succeed");
      const s2 = __r2000SessionStateForTest();
      assert.equal(s2.openCount, 2, "expected exactly one respawn after the mid-call death");
    });
  },
);

test(
  "stub: a child that answers nothing within the call timeout rejects with R2000TimeoutError, is killed, and the crash counter increases by 1",
  async () => {
    const { projectPath, wrapper } = setUpSess02Fixture("wedge");
    await withEnv({ R2000_BIN: wrapper, SESS02_STUB_MODE: "wedge" }, async () => {
      const start = Date.now();
      await assert.rejects(
        () => runInR2000Session(projectPath, (call) => call("t", {}), { timeoutMs: 200 }),
        (err: unknown) => {
          assert.ok(err instanceof R2000TimeoutError, `expected R2000TimeoutError, got ${(err as Error)?.name}`);
          return true;
        },
      );
      assert.ok(Date.now() - start < 10_000, "expected the wedge test to complete well under 10s");
      const s = __r2000SessionStateForTest();
      assert.equal(s.open, false, "expected the wedged handle to be killed and the slot cleared");
      assert.equal(s.crashCount, 1);
    });
  },
);

test(
  "stub: with R2000_RESTART_BUDGET=2, two crash-then-respawn-then-succeed cycles run, and the third crash's respawn is refused with R2000RestartBudgetExhaustedError naming the count and the limit",
  async () => {
    const { projectPath, wrapper } = setUpSess02Fixture("budget");
    await withEnv({ R2000_BIN: wrapper, R2000_RESTART_BUDGET: "2" }, async () => {
      for (let cycle = 0; cycle < 3; cycle++) {
        process.env.SESS02_STUB_MODE = "die-on-second-call";
        const ok = await runInR2000Session(projectPath, (call) => call("t", {}));
        assert.ok(ok, `cycle ${cycle}: expected the (re)spawned call to succeed`);
        await assert.rejects(
          () => runInR2000Session(projectPath, (call) => call("t", {})),
          (err: unknown) => {
            assert.ok(
              err instanceof R2000ChildExitError,
              `cycle ${cycle}: expected R2000ChildExitError, got ${(err as Error)?.name}`,
            );
            return true;
          },
          `cycle ${cycle}: expected the second call against the same child to crash`,
        );
      }
      const stateAfter3Crashes = __r2000SessionStateForTest();
      assert.equal(stateAfter3Crashes.crashCount, 3, "expected exactly three recorded crashes");

      await assert.rejects(
        () => runInR2000Session(projectPath, (call) => call("t", {})),
        (err: unknown) => {
          assert.ok(
            err instanceof R2000RestartBudgetExhaustedError,
            `expected R2000RestartBudgetExhaustedError, got ${(err as Error)?.name}`,
          );
          const e = err as InstanceType<typeof R2000RestartBudgetExhaustedError>;
          assert.equal(e.crashCount, 3, "expected the public crashCount field to read 3");
          assert.equal(e.limit, 2, "expected the public limit field to read 2");
          assert.match(e.message, /3/, "expected the message to contain the observed crash count");
          assert.match(e.message, /2/, "expected the message to contain the configured limit");
          return true;
        },
      );
    });

    // Restores after a refusal: an explicit test reset clears the budget
    // gate, and the next call succeeds.
    await __resetR2000SessionForTest();
    await withEnv({ R2000_BIN: wrapper, SESS02_STUB_MODE: "happy" }, async () => {
      const ok = await runInR2000Session(projectPath, (call) => call("t", {}));
      assert.ok(ok, "expected the next call, after __resetR2000SessionForTest(), to succeed");
      assert.equal(__r2000SessionStateForTest().crashCount, 0, "expected the reset to have zeroed the crash counter");
    });
  },
);

test(
  "stub: crash counting is not reset by an intervening successful call -- crash, success, crash, success, crash still reaches the refusal at budget 2",
  async () => {
    const { projectPath, wrapper } = setUpSess02Fixture("alternating");
    await withEnv({ R2000_BIN: wrapper, R2000_RESTART_BUDGET: "2" }, async () => {
      for (let cycle = 0; cycle < 3; cycle++) {
        process.env.SESS02_STUB_MODE = "die-on-second-call";
        await runInR2000Session(projectPath, (call) => call("t", {})); // success
        await assert.rejects(() => runInR2000Session(projectPath, (call) => call("t", {}))); // crash
      }
      assert.equal(__r2000SessionStateForTest().crashCount, 3, "success calls between crashes must not reset the counter");
      await assert.rejects(
        () => runInR2000Session(projectPath, (call) => call("t", {})),
        (err: unknown) => {
          assert.ok(err instanceof R2000RestartBudgetExhaustedError);
          return true;
        },
      );
    });
  },
);

test(
  "gated (LIVE): a real regenerator2000 child killed between calls is invisible and lossless -- openCount 2, crashCount 1",
  { skip: SKIP_REASON },
  async () => {
    const { projectPath } = synthesizeFixtureProject("sess02-live-kill");

    const r1 = await runR2000Tool("r2000_get_binary_info", { project: projectPath });
    assert.equal(r1.isError, false, `r2000_get_binary_info (1) failed: ${JSON.stringify(r1)}`);
    const s1 = __r2000SessionStateForTest();
    assert.equal(s1.openCount, 1);
    assert.equal(s1.crashCount, 0);
    const pid = s1.pid;
    assert.ok(pid !== undefined, "expected a real pid after the first call");

    // Kill the real child directly (bypassing closeR2000SessionSync(), which
    // is an EXPLICIT close and deliberately does not count as a crash) so
    // this module observes it exactly as it would observe a genuine crash.
    process.kill(pid!, "SIGKILL");

    const s2 = await waitUntilSessionState((s) => s.dead === true, 5000);
    assert.equal(s2.dead, true, "expected the module to observe the real SIGKILL as an exit event");
    assert.equal(s2.crashCount, 1);

    const r2 = await runR2000Tool("r2000_get_binary_info", { project: projectPath });
    assert.equal(r2.isError, false, `r2000_get_binary_info (2) failed: ${JSON.stringify(r2)}`);
    const s3 = __r2000SessionStateForTest();
    assert.equal(s3.openCount, 2, "expected exactly one real respawn");
    assert.equal(s3.crashCount, 1, "expected the crash counter to still read 1 after a successful real respawn");
  },
);

// ===========================================================================
// Plan 18-04 task 3(a) (D18-22): the clean-exit hook. Deliberately asserted
// HERE, in this module's own test file, rather than in vice-proxy.test.ts --
// that file's own structural test slices the SAME region for a DIFFERENT
// property (no promise-awaiting construct, exactly one
// controlSession.release() call) and is explicitly required by this plan to
// stay byte-for-byte unmodified (`git diff --stat` empty is one of this
// plan's own acceptance criteria), so plan 18-05 (which DOES edit
// vice-proxy.test.ts) and this plan never contend for the same file.
// ===========================================================================

test("structural: vice-proxy.ts's teardown region calls r2000-session.ts's own synchronous close function exactly once (D18-22)", () => {
  const proxyPath = join(HERE, "vice-proxy.ts");
  const source = readFileSync(proxyPath, "utf8");
  const beginIdx = source.indexOf("TEARDOWN-REGION-BEGIN");
  const endIdx = source.indexOf("TEARDOWN-REGION-END");
  assert.ok(beginIdx !== -1, "TEARDOWN-REGION-BEGIN marker must be present in vice-proxy.ts");
  assert.ok(endIdx !== -1 && endIdx > beginIdx, "TEARDOWN-REGION-END marker must be present after the begin marker");
  const region = source.slice(beginIdx, endIdx);
  const calls = region.match(/closeR2000SessionSync\(/g) || [];
  assert.equal(calls.length, 1, "expected the teardown region to call closeR2000SessionSync() exactly once");

  const staticImports = (source.match(/from "\.\/r2000-session\.ts"/g) || []).length;
  assert.equal(staticImports, 1, "expected exactly one static import of r2000-session.ts in vice-proxy.ts");
});
