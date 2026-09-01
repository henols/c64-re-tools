// src/mcp/vice/audit-harness-restore.test.ts
//
// WHY THIS FILE EXISTS: `scripts/audit-mutation-harness.mjs` advertises a
// restore-on-signal invariant -- SIGINT or SIGTERM delivered while a plant is on
// disk exits 130, restores every captured original byte-for-byte, and leaves no
// partial write behind. Until now that was an ADVERTISEMENT, not an observation.
// Plan 32-14 drove ten attempts, five per signal, against the real harness,
// polling the planted file every 2 ms and signalling only once the mutation was
// visible on disk. All ten landed inside the window. All ten exited `0`. None
// ran the handler.
//
// Its measured cause was not a narrow window but the absence of one: `main()`
// and everything it calls are wholly synchronous, so Node cannot dispatch a
// JavaScript signal handler while that stack is running. The signal is queued,
// the stack unwinds, `finally { revert }` and `finally { restoreAll }` run, and
// the process exits normally with the queued callback undelivered. In that
// plan's own words: "The verifier's four attempts did not miss a narrow window.
// There is no window."
//
// This file creates the window OUTSIDE the harness rather than inside it. A
// driver under `fixtures/harness-signal/` imports the harness -- which registers
// its four real process handlers, because `IS_ENTRY_POINT` keeps `main()` from
// running on import -- plants a real mutation into a throwaway scratch root, and
// then awaits a timer. Real handlers, a real plant on disk, and an event loop
// that is turning. The harness is not modified, widened, flagged or delayed.
//
// WHAT NOT TO DO:
//
//   1. Do NOT import the harness into THIS process. Importing it registers a
//      SIGINT handler that calls `process.exit(130)`; doing that inside the test
//      runner would change how the entire suite responds to an interrupt. Every
//      import happens inside a spawned child. The drivers live under
//      `fixtures/`, which `test-gate.mjs`'s non-recursive `readdirSync` glob does
//      not reach, so they can never be collected as tests in their own right.
//
//   2. Do NOT accept an exit code of `0` as a pass. `0` is what plan 32-14
//      measured ten times through the ordinary `finally` path. THE EXIT CODE IS
//      THE DISCRIMINATING EVIDENCE, not the byte comparison: the negative control
//      below runs the same driver to completion with no signal and its file is
//      ALSO byte-identical, because the ordinary path restores too. A test that
//      asserted only byte identity would have passed against the very state this
//      file exists to distinguish.
//
//   3. Do NOT leave a plant on disk. Every attempt captures the target's bytes
//      before planting and asserts Buffer-level identity afterwards; the scratch
//      root is removed in a `t.after` that runs even when an assertion fails, and
//      any surviving child is killed there too. A forgotten plant would void
//      every later harness run -- the harness treats a dirty tree as VOID
//      EVIDENCE -- and could be committed by accident.
//
//   4. Do NOT let any wait run unbounded. This repository already has one test
//      file that does not terminate (`vice-proxy.test.ts`, broken-windows #26).
//      Every poll and every wait below carries an explicit deadline and fails
//      with a message naming what it was waiting for.
//
// WHY THIS IS IN THE AUTOMATED SUITE AND `D-17` IS STILL HONOURED. `D-17` keeps
// the mutation harness OUT of CI, for two stated reasons: it mutates files and
// drives the whole guard set, and its output is an audit measurement rather than
// a pass/fail contract. Both are false of this file. It drives the harness's
// RESTORE MACHINERY against a throwaway scratch root; it plants no registry row,
// spawns no guard, runs no member of the audited set, reads no registry and
// writes no evidence file; and it produces a pass/fail contract. The harness
// itself remains in no CI step and in neither `package.json` `scripts` block --
// `D-16` is untouched. The full reasoning is recorded once, in
// `.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-restore-on-signal.md`,
// which is where a later auditor asking "why does harness code run in CI?" will
// look first.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)); // <root>/src/mcp/vice
const ROOT = resolve(HERE, "..", "..", ".."); // <root>
const FIXTURES = join(HERE, "fixtures", "harness-signal");
const SIGNAL_DRIVER = join(FIXTURES, "signal-window-driver.mjs");
const LATCH_DRIVER = join(FIXTURES, "restore-latch-driver.mjs");

/** Matches the `/.harness-signal-scratch-*` entry `.gitignore` carries. The
 * scratch root MUST live inside the repository -- `resolveContainedRoot()`
 * refuses anything outside it -- and it must be ignored, or it would appear in
 * `git status --porcelain` and make the porcelain-identity assertion below
 * untestable. */
const SCRATCH_PREFIX = ".harness-signal-scratch-";

/** The line the signal driver emits AFTER its plant reaches disk. Everything the
 * parent needs to make an authoritative byte comparison rides on it. */
const MARKER = "HARNESS-SIGNAL-DRIVER-PLANTED ";

/** Attempts per signal. Five, matching plan 32-14's attempt log, so the two
 * rounds are directly comparable row for row. */
const ATTEMPTS_PER_SIGNAL = 5;

const MARKER_DEADLINE_MS = 20000;
const PLANT_POLL_DEADLINE_MS = 20000;
const EXIT_DEADLINE_MS = 20000;
const POLL_INTERVAL_MS = 2;

/** What `spawn(..., { stdio: ["ignore", "pipe", "pipe"] })` actually returns.
 * NOT `ChildProcessWithoutNullStreams`: stdin is IGNORED here, so it really is
 * `null`, and that looser alias would type it as a `Writable` that does not
 * exist -- which `tsc --noEmit` rejects rather than letting through. */
type PipedChild = ChildProcessByStdio<null, Readable, Readable>;

interface PlantedMarker {
  /** Absolute path of the planted target. */
  target: string;
  /** The target's bytes BEFORE the plant, as the driver itself read them. */
  originalBase64: string;
  /** The descriptor's recorded replacement, so the parent can observe the plant
   * on disk rather than trust the marker alone. */
  replacement: string;
}

interface Attempt {
  signal: "SIGINT" | "SIGTERM" | "none";
  index: number;
  markerSeenMs: number;
  polls: number;
  sentAtMs: number;
  lifetimeMs: number;
  exitCode: number | null;
  killedBy: NodeJS.Signals | null;
  fileByteIdentical: boolean;
  /** The strict whole-repo comparison. RECORDED, not asserted -- see
   * `attributablePorcelainDelta`. */
  porcelainByteIdentical: boolean;
  /** The asserted subset: new porcelain entries this test could have caused. */
  attributablePorcelainEntries: string[];
  /** The scratch root's contents at the moment the child exited. */
  scratchEntries: string[];
}

const attempts: Attempt[] = [];

function porcelain(): string {
  return execFileSync("git", ["status", "--porcelain"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

/**
 * Porcelain entries present AFTER an attempt that were not present before it,
 * RESTRICTED to paths this test could be responsible for.
 *
 * WHY THIS IS NOT A PLAIN BYTE COMPARISON OF THE TWO READINGS. It was, and the
 * plain form is wrong here for a measured reason. `git status --porcelain` reads
 * the WHOLE repository, but `npm run test:automated` runs 120 test files
 * CONCURRENTLY, several of which legitimately create and delete their own
 * fixture directories in that same tree. Run alone this file's readings are
 * byte-identical every time; run inside the suite, a sibling's scratch file
 * appearing between one attempt's two readings failed three of these tests with
 * `git status --porcelain differs across the attempt` -- a true statement about
 * the repository and a false one about the harness. Asserting it would make this
 * file a flaky detector of other files' housekeeping.
 *
 * So the assertion is narrowed to what it was always FOR: proving the harness
 * did not write outside the scratch root it was pointed at. The places a
 * mis-contained harness run actually writes are its own registry and evidence
 * paths under `.planning/`, and `scripts/` -- so a new porcelain entry under
 * either, or one naming this test's own scratch prefix, is attributable and
 * fails. A sibling's unrelated fixture is not attributable and is ignored.
 *
 * The strict whole-repo byte comparison is still TAKEN and still RECORDED per
 * attempt (see `porcelainByteIdentical`); it is simply reported rather than
 * asserted, because under concurrency it measures the suite, not the subject.
 */
function attributablePorcelainDelta(before: string, after: string): string[] {
  const beforeLines = new Set(before.split("\n").filter((l) => l.length > 0));
  return after
    .split("\n")
    .filter((l) => l.length > 0 && !beforeLines.has(l))
    .filter((l) => {
      const path = l.slice(3);
      return (
        path.startsWith(".planning/") ||
        path.startsWith("scripts/") ||
        path.includes(SCRATCH_PREFIX)
      );
    });
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * A deadline for `Promise.race`, WITH A CANCEL. `Promise.race` does not cancel
 * the loser, so a bare `race([work, sleep(20000)])` leaves a live 20-second
 * timer behind every single time the work wins. Eleven of those held this
 * file's runner open for 21 s of wall clock against roughly 1 s of actual work
 * -- bounded, so not the unterminating-file hazard, but a twenty-fold tax on
 * the automated suite in exchange for nothing. Cancelling the loser takes the
 * same file back to about a second.
 */
function deadline(ms: number): { promise: Promise<"timeout">; cancel: () => void } {
  let handle: NodeJS.Timeout | undefined;
  const promise = new Promise<"timeout">((res) => {
    handle = setTimeout(() => res("timeout"), ms);
  });
  return { promise, cancel: () => clearTimeout(handle) };
}

/**
 * Runs one attempt end to end. `signal` of `"none"` is the NEGATIVE CONTROL: the
 * driver is allowed to finish on its own, which exercises the ordinary `exit`
 * path -- the same path all ten of plan 32-14's attempts took.
 */
async function runAttempt(
  signal: "SIGINT" | "SIGTERM" | "none",
  index: number,
  register: (child: PipedChild, scratch: string) => void,
): Promise<Attempt> {
  const scratch = mkdtempSync(join(ROOT, SCRATCH_PREFIX));
  const holdMs = signal === "none" ? 200 : 30000;
  const porcelainBefore = porcelain();
  const started = Date.now();

  const child = spawn(process.execPath, [SIGNAL_DRIVER, scratch, String(holdMs)], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  register(child, scratch);

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  let exited = false;
  let exitCode: number | null = null;
  let killedBy: NodeJS.Signals | null = null;
  const exitPromise = new Promise<void>((resolveExit) => {
    child.on("exit", (code, sig) => {
      exited = true;
      exitCode = code;
      killedBy = sig;
      resolveExit();
    });
  });

  // 1. Wait for the marker. It is emitted AFTER the plant reaches disk, so its
  //    arrival is the driver's own statement that the window is open.
  const markerDeadline = Date.now() + MARKER_DEADLINE_MS;
  let markerLine: string | undefined;
  for (;;) {
    markerLine = stdout.split("\n").find((l) => l.startsWith(MARKER));
    if (markerLine !== undefined) break;
    assert.ok(
      !exited,
      `${signal} attempt ${index}: the driver exited (code ${String(exitCode)}) before emitting ` +
        `its planted marker. stdout:\n${stdout}\nstderr:\n${stderr}`,
    );
    assert.ok(
      Date.now() < markerDeadline,
      `${signal} attempt ${index}: no planted marker within ${MARKER_DEADLINE_MS} ms. ` +
        `stdout:\n${stdout}\nstderr:\n${stderr}`,
    );
    await sleep(POLL_INTERVAL_MS);
  }
  const markerSeenMs = Date.now() - started;
  const marker = JSON.parse(markerLine.slice(MARKER.length)) as PlantedMarker;
  const original = Buffer.from(marker.originalBase64, "base64");

  // 2. Observe the plant DIRECTLY ON DISK before signalling -- plan 32-14's
  //    proven vehicle, reused rather than re-invented. A timer-based test is
  //    what produced ten uninterpretable attempts before that discipline
  //    existed. The marker alone is the driver's claim; this is the parent's
  //    own observation of the same fact.
  const plantDeadline = Date.now() + PLANT_POLL_DEADLINE_MS;
  let polls = 0;
  let planted = false;
  let plantedBytes: Buffer = Buffer.alloc(0);
  while (!planted) {
    polls += 1;
    try {
      plantedBytes = readFileSync(marker.target);
      planted = plantedBytes.includes(marker.replacement);
    } catch {
      planted = false;
    }
    if (planted) break;
    assert.ok(
      Date.now() < plantDeadline,
      `${signal} attempt ${index}: the recorded replacement never appeared in ${marker.target} ` +
        `within ${PLANT_POLL_DEADLINE_MS} ms after ${polls} poll(s). The plant did not reach ` +
        "disk, so nothing this attempt could measure would mean anything.",
    );
    await sleep(POLL_INTERVAL_MS);
  }

  // The plant really happened: a test that passes without ever planting proves
  // nothing about a restore.
  assert.ok(
    !plantedBytes.equals(original),
    `${signal} attempt ${index}: the target's bytes while the plant is supposedly on disk are ` +
      "IDENTICAL to its pre-plant bytes. Nothing was mutated, so there is nothing to restore " +
      "and this attempt would pass vacuously.",
  );

  // 3. Signal, inside the observed window.
  const sentAtMs = Date.now() - started;
  if (signal !== "none") child.kill(signal);

  // 4. Bounded wait for exit.
  const exitDeadline = deadline(EXIT_DEADLINE_MS);
  const outcome = await Promise.race([
    exitPromise.then(() => "exited" as const),
    exitDeadline.promise,
  ]);
  exitDeadline.cancel();
  assert.equal(
    outcome,
    "exited",
    `${signal} attempt ${index}: the driver was still alive ${EXIT_DEADLINE_MS} ms after the ` +
      "signal was sent.",
  );
  const lifetimeMs = Date.now() - started;

  const afterBytes = readFileSync(marker.target);
  const fileByteIdentical = afterBytes.equals(original);
  const porcelainAfter = porcelain();
  const porcelainByteIdentical = porcelainAfter === porcelainBefore;
  const attributable = attributablePorcelainDelta(porcelainBefore, porcelainAfter);

  // NO PARTIAL WRITE LEFT BEHIND, measured directly rather than inferred from
  // porcelain -- the scratch root is gitignored, so git could never have shown a
  // stray temp file inside it anyway. Exactly one entry, the target itself.
  const scratchEntries = readdirSync(scratch).sort();

  rmSync(scratch, { recursive: true, force: true });

  const record: Attempt = {
    signal,
    index,
    markerSeenMs,
    polls,
    sentAtMs,
    lifetimeMs,
    exitCode,
    killedBy,
    fileByteIdentical,
    porcelainByteIdentical,
    attributablePorcelainEntries: attributable,
    scratchEntries,
  };
  attempts.push(record);
  return record;
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  test(`${signal} delivered inside the plant window exits 130 and restores byte-for-byte`, async (t) => {
    const live: Array<{ child: PipedChild; scratch: string }> = [];
    t.after(() => {
      for (const { child, scratch } of live) {
        if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
        rmSync(scratch, { recursive: true, force: true });
      }
    });

    for (let i = 1; i <= ATTEMPTS_PER_SIGNAL; i += 1) {
      const a = await runAttempt(signal, i, (child, scratch) => live.push({ child, scratch }));

      // THE DISCRIMINATING ASSERTION. `0` here means the ordinary `finally`/
      // `exit` path ran and the harness's own registered handler did NOT -- the
      // exact state plan 32-14 measured ten times. That is a FAILURE of this
      // test, not a pass.
      assert.equal(
        a.exitCode,
        130,
        `${signal} attempt ${i}: expected exit code 130 from the harness's own ${signal} ` +
          `handler, got ${String(a.exitCode)} (killed by ${String(a.killedBy)}). An exit code ` +
          "of 0 means the run took the ordinary path and the restore-on-signal invariant is " +
          "STILL unobserved.",
      );
      assert.equal(
        a.killedBy,
        null,
        `${signal} attempt ${i}: the child was terminated BY the signal (${String(a.killedBy)}) ` +
          "rather than exiting through its own handler. A registered handler suppresses the " +
          "default action, so a non-null terminating signal means no handler ran.",
      );
      assert.ok(
        a.fileByteIdentical,
        `${signal} attempt ${i}: the planted target was NOT restored byte-for-byte. Compared as ` +
          "Buffers, not as text: the target deliberately carries bytes a text round-trip through " +
          "a different encoding would alter, so a merely text-equal restore fails here.",
      );
      assert.deepEqual(
        a.attributablePorcelainEntries,
        [],
        `${signal} attempt ${i}: the interrupted run left porcelain entries this test is ` +
          "responsible for -- a write that escaped the scratch root. (Unattributable churn from " +
          "concurrent test files is excluded by construction; see attributablePorcelainDelta.)",
      );
      assert.deepEqual(
        a.scratchEntries,
        ["plant-target.txt"],
        `${signal} attempt ${i}: the scratch root held something other than the restored target ` +
          "when the child exited -- a partial write survived the interrupt.",
      );
    }
  });
}

test("negative control: the same driver finishing WITHOUT a signal exits 0 and is also byte-identical", async (t) => {
  const live: Array<{ child: PipedChild; scratch: string }> = [];
  t.after(() => {
    for (const { child, scratch } of live) {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  const a = await runAttempt("none", 1, (child, scratch) => live.push({ child, scratch }));

  // WHY THIS CONTROL IS HERE. A byte-identical file proves NOTHING on its own:
  // it was true in all ten of plan 32-14's attempts, every one of which took the
  // path that was never in doubt. This control makes that concrete inside the
  // suite -- same driver, same plant, same byte comparison, and it passes -- so
  // the ONLY thing separating it from the two tests above is the exit code.
  assert.equal(
    a.exitCode,
    0,
    "the unsignalled control should finish normally through the harness's registered `exit` " +
      `handler, got ${String(a.exitCode)}`,
  );
  assert.equal(a.killedBy, null);
  assert.ok(
    a.fileByteIdentical,
    "the ordinary path must restore too -- if it did not, the exit code would not be the only " +
      "thing distinguishing these two paths, and the signal tests above would be measuring the " +
      "wrong difference.",
  );
  assert.deepEqual(a.attributablePorcelainEntries, []);
  assert.deepEqual(a.scratchEntries, ["plant-target.txt"]);
});

test("WR-03: after a first restoreAll(), a second call is a genuine no-op rather than a re-write", async (t) => {
  const scratch = mkdtempSync(join(ROOT, SCRATCH_PREFIX));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));

  const porcelainBefore = porcelain();
  const r = spawn(process.execPath, [LATCH_DRIVER, scratch], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  r.stdout.setEncoding("utf8");
  r.stderr.setEncoding("utf8");
  r.stdout.on("data", (c: string) => {
    stdout += c;
  });
  r.stderr.on("data", (c: string) => {
    stderr += c;
  });

  const exited = new Promise<number | null>((res) => r.on("exit", (code) => res(code)));
  const latchDeadline = deadline(EXIT_DEADLINE_MS);
  const outcome = await Promise.race([exited, latchDeadline.promise]);
  latchDeadline.cancel();
  if (outcome === "timeout") {
    r.kill("SIGKILL");
    assert.fail(`the latch driver did not exit within ${EXIT_DEADLINE_MS} ms`);
  }

  assert.equal(outcome, 0, `the latch driver failed. stdout:\n${stdout}\nstderr:\n${stderr}`);

  const verdict = JSON.parse(stdout.trim().split("\n").at(-1) ?? "{}") as Record<string, unknown>;

  // A latch that merely APPEARS idempotent because both writes produce the same
  // bytes is indistinguishable from a real no-op -- which is precisely WR-03's
  // doubt. The driver mutates the restored file by hand between the two calls,
  // so the two states are now distinguishable and this assertion picks between
  // them.
  assert.equal(
    verdict.restoredToOriginalAfterFirstCall,
    true,
    "the first restoreAll() did not put the pre-plant bytes back",
  );
  assert.equal(
    verdict.pendingCountAfterFirstCall,
    0,
    "pendingRestoreCount() should be 0 once every captured original has been written back",
  );
  assert.equal(
    verdict.sentinelIntactAfterSecondCall,
    true,
    "the second restoreAll() OVERWROTE the hand-written sentinel, so it was a re-write rather " +
      "than a no-op. That is the state WR-03 doubts, and it is a finding to record rather than " +
      "something to fix silently.",
  );

  assert.deepEqual(
    attributablePorcelainDelta(porcelainBefore, porcelain()),
    [],
    "the latch run left porcelain entries this test is responsible for",
  );
});

test("the attempt log is complete and every recorded exit code is the discriminating one", () => {
  const signalled = attempts.filter((a) => a.signal !== "none");
  assert.equal(
    signalled.length,
    ATTEMPTS_PER_SIGNAL * 2,
    "expected five attempts per signal, matching plan 32-14's attempt log",
  );
  const zeros = signalled.filter((a) => a.exitCode === 0);
  assert.deepEqual(
    zeros,
    [],
    "an exit code of 0 anywhere in the signalled attempt log means that attempt took the " +
      "ordinary path and observed nothing",
  );

  // Emitted so the evidence record can be transcribed from the run rather than
  // retyped from memory. Same columns as plan 32-14's table, plus the exit code
  // and the marker.
  const rows = attempts.map(
    (a) =>
      `| ${a.signal} ${a.index} | yes | ${a.polls} | ${a.markerSeenMs} ms | ${a.sentAtMs} ms | ` +
      `${a.lifetimeMs} ms | \`${String(a.exitCode)}\` | ${String(a.killedBy)} | ` +
      `${a.fileByteIdentical ? "yes" : "NO"} | ${a.porcelainByteIdentical ? "yes" : "NO"} |`,
  );
  console.log(`ATTEMPT-LOG\n${rows.join("\n")}`);
});
