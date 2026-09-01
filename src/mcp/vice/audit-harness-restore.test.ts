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
// ITS SCOPE IS NOW TWO PROPERTIES, NOT ONE (2026-09-01, plan 32-20, gap 2 /
// `CR-10`). Everything above is the REACHABILITY property: that the harness's own
// registered handler can be reached at all. The round-3 verifier then measured a
// second property this file was blind to -- whether the restore machinery can be
// DISARMED. It can, and the defect arrived with this very file's own remedy:
// exporting `plant()` and `restoreAll()` made the restore path reachable more
// than once per process, while `restoreAll()` was guarded by a module-level
// boolean that was set on the first call and never reset. A consumer that
// completed one restore cycle therefore permanently no-opped all four handlers.
// Reproduced against a scratch root as `plant -> restoreAll -> plant -> SIGINT`
// giving `EXIT=130`, `pendingRestoreCount()` = 1 and the second plant still on
// disk. The five cases already here could not see it: each of their children
// plants exactly once. The two second-window cases below are the discriminating
// ones, and they were watched failing against a deliberately re-introduced latch
// before they were trusted -- see
// `.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-restore-disarm.md`.
//
// ITS SCOPE IS NOW THE PLANT CONTRACT AS WELL (2026-09-01, plan 32-21, gap 1 /
// `CR-09` / `WR-36`). Everything above is about the RESTORE machinery. The
// case group at the foot of this file is about the other half of the same
// function: what `plant()` ACCEPTS, what it REFUSES, and whether the bytes it
// writes are the bytes the descriptor records.
//
// `WR-36` is why it is here rather than in a one-off manual run. It records that
// three of the harness's behaviours -- the plant post-condition arithmetic, the
// SKIPPED reporting and the refused-plant reporting -- shipped with NO standing
// coverage at all, in a phase whose own criterion is that *a guard that cannot be
// made to fail has not been re-pointed*. Reproduced with a NUL-safe census at
// plan time: only `audit-root-args.test.ts` and this file referenced the harness
// at all, and neither exercised any of the three.
//
// THE TWO HALVES SHARE THIS FILE BECAUSE THEY SHARE THE PLUMBING. Both drive the
// harness through a spawned child that imports it, both point it at a throwaway
// scratch root under `SCRATCH_PREFIX`, both assert an empty attributable
// porcelain delta, and both clean up in a `t.after` that runs on assertion
// failure. Splitting them would duplicate `porcelain()`,
// `attributablePorcelainDelta()`, `deadline()` and the survivor-killing hook
// into a second file, and two copies of a concurrency-sensitive porcelain filter
// is exactly how one of them silently stops matching the other.
//
// THE FILE'S NAME IS LEFT UNCHANGED DELIBERATELY, not by oversight. It now
// covers more than restoration and a name like `audit-harness.test.ts` would
// read better -- but a rename is a file DELETION plus a file addition in the
// diff, and this phase's wave merging refuses any branch whose diff deletes a
// file (`cleanup-wave`'s deletion check). The cost of the accurate name is a
// hand-merged branch; the cost of the inaccurate one is this paragraph.
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
const DISARM_DRIVER = join(FIXTURES, "restore-disarm-driver.mjs");
const PLANT_CONTRACT_DRIVER = join(FIXTURES, "plant-contract-driver.mjs");

/** Matches the `/.harness-signal-scratch-*` entry `.gitignore` carries. The
 * scratch root MUST live inside the repository -- `resolveContainedRoot()`
 * refuses anything outside it -- and it must be ignored, or it would appear in
 * `git status --porcelain` and make the porcelain-identity assertion below
 * untestable. */
const SCRATCH_PREFIX = ".harness-signal-scratch-";

/** The line the signal driver emits AFTER its plant reaches disk. Everything the
 * parent needs to make an authoritative byte comparison rides on it. */
const MARKER = "HARNESS-SIGNAL-DRIVER-PLANTED ";

/** The line the DISARM driver emits after its SECOND plant reaches disk -- a
 * distinct prefix so a first-window marker could never satisfy a second-window
 * wait. */
const DISARM_MARKER = "HARNESS-DISARM-DRIVER-PLANTED-TWICE ";

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

/** What the DISARM driver reports. It is a superset of `PlantedMarker`: the same
 * three fields the byte comparison needs, plus the three pending counts that
 * prove the child really completed a restore cycle and really re-planted. */
interface DisarmMarker extends PlantedMarker {
  /** The FIRST plant's replacement, recorded so a reader of a failure can tell
   * which of the two mutations was left on disk. */
  firstReplacement: string;
  /** The driver's own observation that the first cycle put the pre-plant bytes
   * back. If this is false the second window was never entered cleanly. */
  restoredAfterFirstCycle: boolean;
  pendingAfterFirstPlant: number;
  pendingAfterRestore: number;
  pendingAfterSecondPlant: number;
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
 * did not write outside the scratch root it was pointed at. A new porcelain
 * entry under a tree the registry can actually name, or one naming this test's
 * own scratch prefix, is attributable and fails. A sibling's unrelated fixture
 * is not attributable and is ignored.
 *
 * `WR-29`: EXCLUDING `src/` OUTRIGHT WAS ONE PATH TOO MANY, and `src/` is where
 * a mis-contained plant would most often land. The admitted set is derived from
 * the committed registry rather than guessed, and the derivation was re-run
 * against `guard-fates.json` at the commit this note was written rather than
 * copied from the plan that asked for it:
 *
 *   61 rows, of which 35 carry a plant descriptor
 *     23 target a path under `src/`
 *     10 target a path under `scripts/`
 *      2 target a path under `.planning/` (`.planning/PROJECT.md` and an
 *        `ANSWER.sha256` under a phase-11 evidence directory)
 *      0 target a path containing a `/fixtures/` segment
 *
 * That basis supports exactly one conclusion, and this filter states no more
 * than it: all three trees the registry can name are admitted -- `.planning/`
 * and `scripts/` already were, and `src/` is added here -- so the admission now
 * covers every mis-containment target the registry can produce. `src/` paths
 * containing a `/fixtures/` segment stay excluded, which costs nothing against
 * that basis (0 of 35) and keeps out the concurrent sibling-fixture churn the
 * narrowing was originally written against.
 *
 * THE `/fixtures/` EXCLUSION ALONE WAS NOT ENOUGH, AND THAT IS A MEASUREMENT
 * RATHER THAN A PRECAUTION. The first form of this widening admitted every
 * non-`fixtures/` `src/` path, and `npm run test:automated` immediately red two
 * cases in this file with `?? src/mcp/vice/.anno-cli-test-6kraqX/` and
 * `?? src/mcp/vice/.anno-cli-test-8OGMOQ/` -- a concurrent sibling's own scratch
 * directory, a true statement about the repository and a false one about the
 * harness. Restricting the admission to `src/mcp/vice/` would NOT have helped:
 * that churn is inside `src/mcp/vice/`. What separates it from every real target
 * is that it is a HIDDEN directory. Measured both ways at the same commit:
 *
 *   - every in-repo scratch root any automated sibling creates under `src/` is
 *     dot-prefixed -- `.anno-cli-test-`, `.anno-memmap-cross-root-`,
 *     `.anno-memmap-empty-`, `.audit-root-synth-`, plus `anno-memmap-render`'s
 *     parameterised `.${prefix}-` form, which is dot-prefixed by construction.
 *     The one non-dot prefix in the tree, `vice-proxy-evidence-test-`, is
 *     created under `.planning/` by a manual-only file that this gate never
 *     runs -- and `.planning/` stays admitted unconditionally on purpose,
 *     because it is where a mis-contained run writes its registry and evidence.
 *   - 0 of the 23 `src/` plant targets contain a dot-prefixed path segment.
 *
 * So a `src/` path with a dot-prefixed segment is excluded. It costs nothing
 * against the registry basis and removes the whole measured churn class.
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
      const segments = path.split("/");
      const admissibleSrcPath =
        path.startsWith("src/") &&
        !path.includes("/fixtures/") &&
        !segments.some((s) => s.startsWith("."));
      return (
        path.startsWith(".planning/") ||
        path.startsWith("scripts/") ||
        admissibleSrcPath ||
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
    // WR-28. This loop used to read ONLY its own deadline, so a driver that died
    // before its plant became observable spun for the full 20 seconds and then
    // failed with a message about a deadline rather than about the dead child.
    // The marker loop above already gets this right; this mirrors it. No passing
    // run's outcome changes -- an early exit already failed here, just slowly and
    // uninterpretably. Applied to the SHARED routine so the negative control and
    // both signal paths all get it.
    assert.ok(
      !exited,
      `${signal} attempt ${index}: the driver exited (code ${String(exitCode)}) before its plant ` +
        `became observable in ${marker.target}. stdout:\n${stdout}\nstderr:\n${stderr}`,
    );
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

/**
 * One SECOND-WINDOW attempt end to end: the child plants, completes a restore
 * cycle, plants AGAIN, and is signalled while that second plant is on disk.
 *
 * WHY THIS DOES NOT REUSE `runAttempt`, AND WHY IT DOES NOT PUSH ONTO
 * `attempts`. The attempt log below is a transcript of plan 32-14's ten
 * first-window attempts, kept row-comparable across rounds, and the log's own
 * test asserts EXACTLY five signalled attempts per signal. Widening it would
 * silently redefine what a later reader is comparing against, and `IN-14`
 * already records that test's ordering dependence. So these cases record
 * nothing there. They reuse every helper that matters -- `porcelain()`,
 * `attributablePorcelainDelta()`, `deadline()`, `sleep()` and the caller's
 * kill-and-remove cleanup hook -- and only the marker shape and the two extra
 * pending-count assertions differ.
 */
async function runDisarmAttempt(
  signal: "SIGINT" | "SIGTERM",
  register: (child: PipedChild, scratch: string) => void,
): Promise<{
  exitCode: number | null;
  killedBy: NodeJS.Signals | null;
  fileByteIdentical: boolean;
  attributablePorcelainEntries: string[];
  scratchEntries: string[];
  marker: DisarmMarker;
}> {
  const scratch = mkdtempSync(join(ROOT, SCRATCH_PREFIX));
  const porcelainBefore = porcelain();

  const child = spawn(process.execPath, [DISARM_DRIVER, scratch, "30000"], {
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

  // 1. Wait for the SECOND-plant marker.
  const markerDeadline = Date.now() + MARKER_DEADLINE_MS;
  let markerLine: string | undefined;
  for (;;) {
    markerLine = stdout.split("\n").find((l) => l.startsWith(DISARM_MARKER));
    if (markerLine !== undefined) break;
    assert.ok(
      !exited,
      `${signal} disarm: the driver exited (code ${String(exitCode)}) before emitting its ` +
        `second-plant marker. stdout:\n${stdout}\nstderr:\n${stderr}`,
    );
    assert.ok(
      Date.now() < markerDeadline,
      `${signal} disarm: no second-plant marker within ${MARKER_DEADLINE_MS} ms. ` +
        `stdout:\n${stdout}\nstderr:\n${stderr}`,
    );
    await sleep(POLL_INTERVAL_MS);
  }
  const marker = JSON.parse(markerLine.slice(DISARM_MARKER.length)) as DisarmMarker;
  const original = Buffer.from(marker.originalBase64, "base64");

  // 2. The child really did complete a restore cycle and really did re-plant.
  //    Without these the case could pass while measuring a first window, which
  //    is what `signal-window-driver.mjs` already covers.
  assert.equal(
    marker.pendingAfterFirstPlant,
    1,
    `${signal} disarm: the driver's first plant did not register a captured original`,
  );
  assert.equal(
    marker.restoredAfterFirstCycle,
    true,
    `${signal} disarm: the driver's first restoreAll() did not put the pre-plant bytes back, so ` +
      "the second window was never entered from a clean state",
  );
  assert.equal(
    marker.pendingAfterRestore,
    0,
    `${signal} disarm: pendingRestoreCount() was not 0 after the first restore cycle, so no ` +
      "cycle completed and this case would not be exercising the second window at all",
  );
  assert.equal(
    marker.pendingAfterSecondPlant,
    1,
    `${signal} disarm: pendingRestoreCount() was not 1 after the second plant, so the driver ` +
      "never actually re-planted and there would be nothing for the handler to restore",
  );

  // 3. Observe the SECOND plant directly on disk before signalling.
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
    // WR-28, applied here as well as in the shared routine: a driver that died
    // before its plant became observable must fail immediately and by name.
    assert.ok(
      !exited,
      `${signal} disarm: the driver exited (code ${String(exitCode)}) before its second plant ` +
        `became observable in ${marker.target}. stdout:\n${stdout}\nstderr:\n${stderr}`,
    );
    assert.ok(
      Date.now() < plantDeadline,
      `${signal} disarm: the second replacement never appeared in ${marker.target} within ` +
        `${PLANT_POLL_DEADLINE_MS} ms after ${polls} poll(s).`,
    );
    await sleep(POLL_INTERVAL_MS);
  }
  assert.ok(
    !plantedBytes.equals(original),
    `${signal} disarm: the target's bytes while the SECOND plant is supposedly on disk are ` +
      "IDENTICAL to its pre-plant bytes. Nothing was mutated, so this attempt would pass " +
      "vacuously.",
  );

  // 4. Signal, inside the SECOND window.
  child.kill(signal);

  const exitDeadline = deadline(EXIT_DEADLINE_MS);
  const outcome = await Promise.race([
    exitPromise.then(() => "exited" as const),
    exitDeadline.promise,
  ]);
  exitDeadline.cancel();
  assert.equal(
    outcome,
    "exited",
    `${signal} disarm: the driver was still alive ${EXIT_DEADLINE_MS} ms after the signal was sent.`,
  );

  const afterBytes = readFileSync(marker.target);
  const fileByteIdentical = afterBytes.equals(original);
  const attributablePorcelainEntries = attributablePorcelainDelta(porcelainBefore, porcelain());
  const scratchEntries = readdirSync(scratch).sort();

  rmSync(scratch, { recursive: true, force: true });

  return {
    exitCode,
    killedBy,
    fileByteIdentical,
    attributablePorcelainEntries,
    scratchEntries,
    marker,
  };
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  test(`gap 2 / CR-10: ${signal} in the SECOND window -- after a restore cycle has already completed -- still restores`, async (t) => {
    const live: Array<{ child: PipedChild; scratch: string }> = [];
    t.after(() => {
      for (const { child, scratch } of live) {
        if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
        rmSync(scratch, { recursive: true, force: true });
      }
    });

    const a = await runDisarmAttempt(signal, (child, scratch) => live.push({ child, scratch }));

    assert.equal(
      a.exitCode,
      130,
      `${signal} disarm: expected exit code 130 from the harness's own ${signal} handler, got ` +
        `${String(a.exitCode)} (killed by ${String(a.killedBy)}).`,
    );
    assert.equal(
      a.killedBy,
      null,
      `${signal} disarm: the child was terminated BY the signal (${String(a.killedBy)}) rather ` +
        "than exiting through its own handler.",
    );

    // THE DISCRIMINATING ASSERTION FOR THIS PAIR. The exit code above is 130
    // with the defect present too -- the handler DOES run; it is `restoreAll()`
    // that returns without writing. So what separates a disarmed machine from a
    // sound one is this byte comparison, and only in the SECOND window.
    assert.ok(
      a.fileByteIdentical,
      `${signal} disarm: the SECOND plant (${a.marker.replacement}) was NOT restored. The ` +
        "process exited 130 through the harness's own handler and still left a captured " +
        "original unrestored -- the restore machinery was disarmed by the first completed " +
        "restore cycle. Compared as Buffers, not as text.",
    );
    assert.deepEqual(
      a.attributablePorcelainEntries,
      [],
      `${signal} disarm: the interrupted run left porcelain entries this test is responsible for.`,
    );
    assert.deepEqual(
      a.scratchEntries,
      ["disarm-target.txt"],
      `${signal} disarm: the scratch root held something other than the restored target when the ` +
        "child exited -- a partial write survived the interrupt.",
    );
  });
}

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

// ---------------------------------------------------------------------------
// THE PLANT CONTRACT (2026-09-01, plan 32-21, gap 1 / `CR-09` / `WR-36`)
// ---------------------------------------------------------------------------
//
// The cases below are about `plant()`'s OTHER half: what it accepts, what it
// refuses, and whether the bytes it writes are the bytes the descriptor
// records. See the third block of this file's header for why they share a file
// with the restore cases, and why the file keeps its name.

/** One line of JSON from `plant-contract-driver.mjs`. Every field is the
 * driver's OBSERVATION, not its opinion: the parent asserts on these rather
 * than on the child's exit status, which reports only whether an observation
 * could be made at all. */
interface PlantContractVerdict {
  case: string;
  planted: boolean;
  /** The harness's own refusal, verbatim, or `null` when the plant was accepted. */
  refusalMessage: string | null;
  targetByteIdentical: boolean;
  lengthBefore: number;
  lengthAfter: number;
  lengthDelta: number;
  /** `replace.length - find.length`, the delta an exact substitution produces. */
  expectedDelta: number;
  matchIndex: number | null;
  /** Measured by re-reading the FILE, which is what makes it able to catch a
   * write path that diverges from a string-level check inside the harness. */
  replacementVerbatimAtMatchIndex: boolean;
  bytesAtMatchIndexBase64: string | null;
  recordedReplacementBase64: string;
  originalBase64: string;
  afterBase64: string;
  pendingRestoreCount: number;
}

/**
 * Runs ONE named plant-contract case in its OWN child process against its OWN
 * scratch root. One case per child on purpose: a case that throws or corrupts
 * its target cannot then mask another, and no case inherits another's
 * captured-originals map.
 */
async function runPlantContractCase(
  caseName: string,
  register: (child: PipedChild, scratch: string) => void,
): Promise<PlantContractVerdict> {
  const scratch = mkdtempSync(join(ROOT, SCRATCH_PREFIX));
  const porcelainBefore = porcelain();

  const child = spawn(process.execPath, [PLANT_CONTRACT_DRIVER, scratch, caseName], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  register(child, scratch);

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (c: string) => {
    stdout += c;
  });
  child.stderr.on("data", (c: string) => {
    stderr += c;
  });

  const exited = new Promise<number | null>((res) => child.on("exit", (code) => res(code)));
  const exitDeadline = deadline(EXIT_DEADLINE_MS);
  const outcome = await Promise.race([exited, exitDeadline.promise]);
  exitDeadline.cancel();
  if (outcome === "timeout") {
    child.kill("SIGKILL");
    assert.fail(
      `plant-contract case ${caseName}: the driver did not exit within ${EXIT_DEADLINE_MS} ms. ` +
        `stdout:\n${stdout}\nstderr:\n${stderr}`,
    );
  }

  // A NON-ZERO exit means the driver could not make an observation at all -- bad
  // arguments, an unknown case, an unexpected throw OUTSIDE `plant()`. A REFUSED
  // plant is still exit 0, because a refusal is an observation and several cases
  // below expect one.
  assert.equal(
    outcome,
    0,
    `plant-contract case ${caseName}: the driver could not make an observation. ` +
      `stdout:\n${stdout}\nstderr:\n${stderr}`,
  );

  const lastLine = stdout.trim().split("\n").at(-1) ?? "";
  const verdict = JSON.parse(lastLine) as PlantContractVerdict;
  assert.equal(
    verdict.case,
    caseName,
    `plant-contract case ${caseName}: the driver reported a verdict for a DIFFERENT case ` +
      `(${verdict.case}); the assertions below would be measuring the wrong thing.`,
  );

  assert.deepEqual(
    attributablePorcelainDelta(porcelainBefore, porcelain()),
    [],
    `plant-contract case ${caseName}: the run left porcelain entries this test is responsible ` +
      "for -- a write escaped the scratch root.",
  );

  rmSync(scratch, { recursive: true, force: true });
  return verdict;
}

function plantContractCase(
  caseName: string,
  title: string,
  check: (v: PlantContractVerdict) => void,
): void {
  test(`plant contract / ${caseName}: ${title}`, async (t) => {
    const live: Array<{ child: PipedChild; scratch: string }> = [];
    t.after(() => {
      for (const { child, scratch } of live) {
        if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
        rmSync(scratch, { recursive: true, force: true });
      }
    });

    const verdict = await runPlantContractCase(caseName, (child, scratch) =>
      live.push({ child, scratch }),
    );
    check(verdict);
  });
}

// GAP 1 ITSELF. The descriptor's replacement is its find with one newline
// prepended, and the find sits on its own line -- so the occurrence the mutation
// introduces textually OVERLAPS an occurrence that was already in the file. The
// whole-file difference form computes `1 - 1 = 0` and refuses an HONEST
// descriptor. This is modelled on the real committed row
// `src/mcp/vice/hop-chain-comments.test.ts`, which has exactly this shape.
plantContractCase(
  "overlap-accepted",
  "a replacement that textually overlaps its own pre-existing occurrence is accepted, and the " +
    "file grows by exactly one byte at the match position",
  (v) => {
    assert.equal(
      v.planted,
      true,
      `the overlap descriptor was REFUSED: ${String(v.refusalMessage)}\nThis is gap 1: the plant ` +
        "post-condition cannot see a replacement that overlaps its own pre-existing occurrence, " +
        "so it refuses an honest descriptor and blocks the whole-set registry write-back.",
    );
    assert.equal(v.refusalMessage, null);
    assert.equal(v.expectedDelta, 1, "the case's own arithmetic: one prepended newline");
    assert.equal(
      v.lengthDelta,
      1,
      "the mutation must change the file by exactly one byte -- the mutation is REAL even though " +
        "the whole-file difference computes 0",
    );
    assert.equal(
      v.replacementVerbatimAtMatchIndex,
      true,
      "the recorded replacement must land verbatim at the unique match position",
    );
    assert.equal(v.targetByteIdentical, false, "nothing was written, so nothing was proved");

    // The exact byte shape, asserted rather than inferred from the length: the
    // bytes on disk are the pre-plant bytes with ONE newline inserted at the
    // match position and nothing else moved.
    const before = Buffer.from(v.originalBase64, "base64");
    const after = Buffer.from(v.afterBase64, "base64");
    const idx = v.matchIndex;
    assert.ok(idx !== null && idx >= 0, "the find must have a unique match position");
    const expected = Buffer.concat([
      before.subarray(0, idx as number),
      Buffer.from("\n", "latin1"),
      before.subarray(idx as number),
    ]);
    assert.ok(
      after.equals(expected),
      "the bytes on disk are not the pre-plant bytes with exactly one newline inserted at the " +
        "match position. Compared as Buffers, not as text.",
    );
  },
);

// ROUND 2'S OWN CASE. It must not regress while round 3's is fixed: the
// replacement already occurs once ELSEWHERE in the target, non-overlapping.
plantContractCase(
  "pre-existing-replacement-accepted",
  "a replacement that already occurs elsewhere in the target, non-overlapping, is still accepted",
  (v) => {
    assert.equal(
      v.planted,
      true,
      `round 2's own case regressed -- the plant was REFUSED: ${String(v.refusalMessage)}`,
    );
    assert.equal(v.refusalMessage, null);
    assert.equal(
      v.lengthDelta,
      v.expectedDelta,
      "the length delta must be exactly `replace.length - find.length`",
    );
    assert.equal(v.replacementVerbatimAtMatchIndex, true);
    assert.equal(v.targetByteIdentical, false);
  },
);

// THE PIN ON THE `CR-02` FIX, and what makes the corrected post-condition
// non-tautological. The replacement carries `$&`, which
// `String.prototype.replace` expands to the matched substring when it is given a
// replacement STRING. Reverting the harness's replacer FUNCTION to a replacement
// string makes this case red, reported by the post-condition's own message.
plantContractCase(
  "substitution-is-verbatim",
  "a replacement carrying a match-substitution pattern reaches disk BYTE FOR BYTE, uninterpreted",
  (v) => {
    assert.equal(v.planted, true, `the plant was REFUSED: ${String(v.refusalMessage)}`);
    assert.equal(
      v.bytesAtMatchIndexBase64,
      v.recordedReplacementBase64,
      "the bytes at the match position are NOT the recorded replacement's bytes. A replacement " +
        "STRING would have expanded `$&` to the matched text; a replacer FUNCTION returns it " +
        "verbatim. This is the CR-02 divergence class: the harness writing bytes the row does " +
        "not record.",
    );
    assert.equal(v.replacementVerbatimAtMatchIndex, true);
    assert.equal(v.lengthDelta, v.expectedDelta);
  },
);

plantContractCase(
  "find-absent-refused",
  "a find that matches zero times is refused, the measured count is named, and nothing is written",
  (v) => {
    assert.equal(v.planted, false, "a find matching zero times must never be planted");
    assert.match(
      v.refusalMessage ?? "",
      /occurs 0 time\(s\)/,
      "the refusal must name the MEASURED occurrence count, not merely that it was wrong",
    );
    assert.equal(v.targetByteIdentical, true, "a refused plant must write nothing");
    assert.equal(
      v.pendingRestoreCount,
      0,
      "a refused plant must capture nothing into the restore machinery",
    );
  },
);

plantContractCase(
  "find-twice-refused",
  "a find that matches twice is refused, the measured count is named, and nothing is written",
  (v) => {
    assert.equal(v.planted, false, "an ambiguous find must never be planted");
    assert.match(
      v.refusalMessage ?? "",
      /occurs 2 time\(s\)/,
      "the refusal must name the MEASURED occurrence count",
    );
    assert.equal(v.targetByteIdentical, true);
    assert.equal(v.pendingRestoreCount, 0);
  },
);

plantContractCase(
  "empty-replacement-refused",
  "an empty `replace` field is refused BY NAME and nothing is written",
  (v) => {
    assert.equal(v.planted, false);
    assert.match(
      v.refusalMessage ?? "",
      /field `replace` must be a non-empty string/,
      "the refusal must name the offending FIELD",
    );
    assert.equal(v.targetByteIdentical, true);
    assert.equal(v.pendingRestoreCount, 0);
  },
);
