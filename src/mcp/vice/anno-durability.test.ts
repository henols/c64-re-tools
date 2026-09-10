// anno-durability.test.ts -- the ONE combined proof that `STORE-04` asks for:
// a separate OS process mutates an annotation store and SIGKILLs itself with no
// clean close, a FRESH process reopens the file, the mutation reads back BY
// VALUE, and the revert returns the prior value -- all in the SAME test.
//
// WHY ONE TEST AND NOT TWO. Split into a durability test and a revert test,
// BOTH STAY GREEN over a store that satisfies neither claim: the durability
// half passes on anything that happens to have flushed, and the revert half
// passes in-process without ever proving the snapshot outlived the writer.
// Combined, ONE planted violation -- removing `anno-store.ts`'s single `commit`
// -- fails both halves at once, because the snapshot POINTER ROW is inserted in
// the same transaction as the mutation. That fusion is the mechanism, and it is
// documented at `runWriteSequence` in the seam itself.
//
// THE TWO BOOLEANS ARE VALUES, ASSERTED AS VALUES. The observation helper below
// returns them; the assertions read them and sit outside any `try`. The reason
// is measured rather than stylistic: in phase research the revert half failed
// with a NAMED DOMAIN ERROR (`AnnoStoreError: no snapshot recorded for revision
// 0`) rather than an assertion failure, so a `try/catch` wrapped around the
// assertions would have absorbed the red and reported a pass. The only `catch`
// in this file CONVERTS that domain error into `false`; it never wraps an
// assertion.
//
// Every temp directory is `mkdtempSync(join(tmpdir(), "anno-"))` removed in an
// unconditional `finally`, and THE PARENT DOES THE CLEANING because on the
// SIGKILL path the child cannot: `/tmp` here is a tmpfs with cleanup disabled,
// and these cases leave database files, hot journals and a `snapshots/`
// directory behind.
//
// NOTHING here asserts stderr is empty, and nothing may: `node:sqlite` emits an
// `ExperimentalWarning` unconditionally on first load, and every spawn below
// pipes the child's stdio (never inherits it, never ignores it) to keep that
// warning out of the TAP stream rather than to inspect it.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  closeStore,
  currentRevision,
  deleteExecObservationsForRun,
  insertExecObservations,
  listExecObservations,
  listRanges,
  openStore,
  revertTo,
  setDataType,
} from "./anno-store.ts";
import { AnnoAddressError, AnnoStoreCorruptError, AnnoStoreError, AnnoTypeError, SCHEMA_VERSION } from "./anno-types.ts";
import type { RangeRow } from "./anno-types.ts";
import { ViceError } from "./vice.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The spawned, never-imported child. Its name deliberately does not match the
 * `*.test.*` glob -- collected as a test it would SIGKILL the runner. */
const MUTATOR_FILENAME = "anno-durability-mutator.mjs";
const MUTATOR = join(HERE, MUTATOR_FILENAME);

/** The mutator's fourth mode, and the one argv token it needs beyond the store
 * path. Named here rather than spelled inline for the same reason the mutator
 * names its own mode constants: a typo in a mode string looks like a store bug,
 * not like a typo. */
const MODE_HOLD_READ = "hold-read";

/** The mutator's fifth mode: one `anno_evid_exec` insert, through the same
 * commit/no-commit writer selection the range modes use (43-02). */
const MODE_INSERT_EVID = "insert-evid";

/** The one run identity plus one address every evidence durability test in
 * this file plants and reads back BY VALUE. `imageSha256`/`argvDigest` are
 * shaped like real sha256 hex digests (64 lowercase hex characters) even
 * though nothing here computed them from real bytes -- `insertExecObservations`
 * validates the SHAPE, not the provenance. */
const EVID_IDENTITY = {
  imageSha256: "a".repeat(64),
  argvDigest: "b".repeat(64),
  seed: "43-02-durability-seed",
  address: 0xea31,
  sourceBank: "rom",
} as const;

/**
 * Blocks until `marker` exists, with a HARD CAP. The cap is what makes a child
 * that never started a loud failure instead of a silent pass: without it a
 * `existsSync` spin would hang the whole suite, and with an unchecked
 * fall-through the test would go on to attempt its write against a store nobody
 * was reading and observe an ordinary SUCCESS -- passing the file, proving
 * nothing.
 *
 * `Atomics.wait` for the pause, not a timer: the caller is about to block its
 * own event loop inside a synchronous store write, so nothing asynchronous
 * could be observed here anyway.
 */
function waitForMarker(marker: string): void {
  const pause = new Int32Array(new SharedArrayBuffer(4));
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (existsSync(marker)) return;
    Atomics.wait(pause, 0, 0, 50);
  }
  assert.fail(
    `the ${MODE_HOLD_READ} child never created its readiness marker at ${marker} within 10 s -- the separate OS process that was ` +
      `supposed to hold a READ transaction never started, so every assertion below would have measured an UNCONTENDED write`,
  );
}

/** The range the killed modes write, restated here so the readback is BY VALUE
 * against numbers this file names rather than against whatever the child
 * happened to write. */
const EXPECTED = { start: 0x0810, endInclusive: 0x084f, dataType: "lo_hi_address" } as const;

/** What one mutate-kill-reopen run observed. Plain data: every field is
 * computed before this record is returned, so every assertion against it runs
 * outside any `try`. */
interface Observation {
  /** The mutation is present, complete and equal to `EXPECTED` in all three
   * fields, read from a store file reopened by a DIFFERENT OS process than the
   * one that wrote it. */
  readBackByValue: boolean;
  /** `revertTo(0)` put the store back to no ranges at revision 0. FALSE also
   * when the revert was REFUSED -- see the one `catch` below. */
  revertReturnsPriorValue: boolean;
  /** The revision the file carried after the kill: 1 when the write committed,
   * 0 when it did not. Recorded so a reader can see WHY both halves move
   * together rather than having to infer it. */
  revisionAfterKill: number;
  /** Every row the reopened store returned, so the all-or-nothing property can
   * be asserted on the actual set rather than only on a boolean. */
  rangesAfterKill: RangeRow[];
  /** Snapshot files left in `snapshots/` after the kill, by filename. */
  snapshotFilesAfterKill: string[];
  /** The revisions `anno_snapshot` still points at after the kill. A file with
   * no row here is an ORPHAN, which is the harmless failure direction the
   * write sequence's ordering deliberately chooses. */
  snapshotRowsAfterKill: number[];
  /** The refusal message, when the revert was refused rather than performed.
   * Null when it was performed. */
  revertRefusal: string | null;
}

/**
 * Runs the mutator in `mode`, then reopens the store in THIS process and
 * computes the observation.
 *
 * ONE HELPER, CALLED BY BOTH THE COMMITTING TEST AND ITS PLANTED COUNTERPART.
 * That sharing is the requirement, not a convenience: `STORE-04` asks that
 * removing the commit reddens THAT SAME TEST, so the planted run must not be
 * able to drift into a different sequence than the one it is the counterpart
 * of.
 *
 * The `try/finally` here is TEMP-DIRECTORY CLEANUP ONLY and has no `catch`, so
 * it cannot absorb a failure. The single `catch` inside converts the revert's
 * named domain refusal into `revertReturnsPriorValue = false`, which is the
 * whole point: the caller asserts a VALUE, never merely that nothing threw.
 */
function observeMutateKillReopen(mode: "commit" | "no-commit"): Observation {
  const dir = mkdtempSync(join(tmpdir(), "anno-"));
  try {
    const path = join(dir, "proj.annostore");

    // The store exists, with its DDL and its revision-0 meta row, BEFORE the
    // child runs -- so the child is a writer to an existing file rather than
    // its creator, and the file the parent reopens is not one the parent has
    // never seen initialised.
    closeStore(openStore(path, { workspaceRoot: dir }));

    try {
      execFileSync(process.execPath, [MUTATOR, path, mode], { stdio: "pipe" });
    } catch {
      // EXPECTED AND IGNORED. The child kills itself, so `execFileSync` throws
      // on the non-zero status (137 = 128 + SIGKILL). A run that did NOT throw
      // here would mean the child exited cleanly, which is the one thing this
      // proof must not permit -- and that is caught downstream, because a store
      // written by a cleanly-exiting child is not what any assertion below is
      // about. Swallowing the status is safe precisely because every claim is
      // read back off the FILE, never off the child's exit.
    }

    // A different OS process from the mutator, by construction.
    const reopened = openStore(path, { workspaceRoot: dir });
    try {
      const rows = listRanges(reopened);
      const revisionAfterKill = currentRevision(reopened);
      const snapshotDir = join(dir, "proj.annostore.snapshots");
      const snapshotFilesAfterKill = existsSync(snapshotDir) ? readdirSync(snapshotDir).sort() : [];
      const snapshotRowsAfterKill = (
        reopened.db.prepare("select revision from anno_snapshot order by revision").all() as { revision: number }[]
      ).map((row) => row.revision);

      const readBackByValue =
        rows.length === 1 && rows[0].start === EXPECTED.start && rows[0].endInclusive === EXPECTED.endInclusive && rows[0].dataType === EXPECTED.dataType;

      let revertReturnsPriorValue = false;
      let revertRefusal: string | null = null;
      try {
        const reverted = revertTo(reopened, 0);
        revertReturnsPriorValue = listRanges(reverted).length === 0 && currentRevision(reverted) === 0;
        closeStore(reverted);
      } catch (e) {
        // THE ONE CATCH IN THIS FILE, AND IT CONVERTS RATHER THAN ABSORBS. When
        // the commit is missing, the pointer row rolls back with everything
        // else and the revert is refused by NAME -- a domain error, not an
        // assertion failure. Turning it into `false` here is what lets the
        // caller assert a boolean; a `catch` around the caller's assertions
        // instead would have reported a pass.
        revertRefusal = (e as Error).message;
        revertReturnsPriorValue = false;
      }

      return {
        readBackByValue,
        revertReturnsPriorValue,
        revisionAfterKill,
        rangesAfterKill: rows,
        snapshotFilesAfterKill,
        snapshotRowsAfterKill,
        revertRefusal,
      };
    } finally {
      // `revertTo` closes the handle it was given on its success path, so this
      // close is for the refused path. Closing an already-closed handle throws,
      // which is why it is guarded rather than unconditional.
      try {
        closeStore(reopened);
      } catch {
        // already closed by a successful revertTo -- nothing to do
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * `anno_evid_exec`'s own counterpart to `observeMutateKillReopen`, ONE
 * HELPER CALLED BY BOTH the committing test and its planted counterpart, for
 * the identical reason: `T-43-09` asks that removing the commit reddens THAT
 * SAME TEST rather than a hand-copied variant that could drift out of
 * agreement with it.
 *
 * Reads back through `listExecObservations` -- the SHIPPED read path -- never
 * a raw query against `anno_evid_exec`, so this proof exercises the same
 * surface a real caller would.
 */
function observeEvidenceMutateKillReopen(writerToken: "commit" | "no-commit"): { rows: ReturnType<typeof listExecObservations> } {
  const dir = mkdtempSync(join(tmpdir(), "anno-"));
  try {
    const path = join(dir, "proj.annostore");

    // The store exists, with its DDL (including `anno_evid_exec` at
    // SCHEMA_VERSION 4) and its revision-0 meta row, BEFORE the child runs.
    closeStore(openStore(path, { workspaceRoot: dir }));

    try {
      execFileSync(
        process.execPath,
        [
          MUTATOR,
          path,
          MODE_INSERT_EVID,
          writerToken,
          EVID_IDENTITY.imageSha256,
          EVID_IDENTITY.argvDigest,
          EVID_IDENTITY.seed,
          String(EVID_IDENTITY.address),
          EVID_IDENTITY.sourceBank,
        ],
        { stdio: "pipe" },
      );
    } catch {
      // EXPECTED AND IGNORED -- the self-SIGKILL, for the identical reason
      // `observeMutateKillReopen`'s own catch gives.
    }

    // A different OS process from the mutator, by construction.
    const reopened = openStore(path, { workspaceRoot: dir });
    try {
      return { rows: listExecObservations(reopened) };
    } finally {
      closeStore(reopened);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("STORE-04, one combined test: a separate OS process mutates the store and SIGKILLs itself with no clean close, a FRESH process reopens the file, the mutation reads back BY VALUE, and revertTo(0) returns the prior value", () => {
  const observed = observeMutateKillReopen("commit");

  // Both halves, asserted as VALUES, outside any try. Each message names WHICH
  // half failed, because "the durability test failed" does not say whether the
  // mutation was lost or the undo was.
  assert.equal(
    observed.readBackByValue,
    true,
    `the DURABILITY half failed: after a real SIGKILL with no clean close, a fresh process read back ` +
      `${JSON.stringify(observed.rangesAfterKill)} rather than exactly ${JSON.stringify(EXPECTED)} (revision ${observed.revisionAfterKill})`,
  );
  assert.equal(
    observed.revertReturnsPriorValue,
    true,
    `the REVERT half failed: revertTo(0) did not return the prior value${observed.revertRefusal === null ? "" : ` -- it was refused: ${observed.revertRefusal}`}`,
  );

  // The mechanism, asserted rather than left to be inferred: the write
  // committed, so the revision advanced by exactly one and the pointer row for
  // the pre-mutation revision is on disk. These are the two things that move
  // TOGETHER when the commit is removed.
  assert.equal(observed.revisionAfterKill, 1, "the committed write advanced the revision by exactly one and the advance survived the kill");
  assert.deepEqual(observed.snapshotRowsAfterKill, [0], "and the pointer row for the pre-mutation revision survived with it, in the same transaction");

  // ---------------------------------------------------------------------
  // ALL-OR-NOTHING, asserted on THIS SAME RUN rather than in a test of its
  // own. That is deliberate: it is a property of the interrupted write just
  // performed, and giving it a separate test would mean a third call of the
  // shared helper -- a third SIGKILLed child proving a property of a run the
  // assertions above already have in hand. The helper is called exactly
  // twice in this file, once per mode, which is what keeps the planted
  // counterpart the counterpart OF THIS TEST.
  // ---------------------------------------------------------------------
  const rows = observed.rangesAfterKill;

  // BOTH acceptable states are enumerated explicitly. Asserting only the
  // expected one would make this test a second copy of the durability half
  // above; the property being proven here is that the THIRD state -- a row
  // present but wrong, a start without an end, a type from a half-applied
  // write -- does not exist.
  const isCompleteMutation =
    rows.length === 1 && rows[0].start === EXPECTED.start && rows[0].endInclusive === EXPECTED.endInclusive && rows[0].dataType === EXPECTED.dataType;
  const isNothingAtAll = rows.length === 0;

  assert.equal(
    isCompleteMutation || isNothingAtAll,
    true,
    `an interrupted write must be all-or-nothing, but the reopened store held ${JSON.stringify(rows)} -- neither the complete ` +
      `${JSON.stringify(EXPECTED)} nor an empty set`,
  );

  // And which of the two was observed, recorded so a silent flip from "always
  // complete" to "always empty" -- which the assertion above would tolerate --
  // is still visible in a failure message here.
  assert.equal(isCompleteMutation, true, "on this store the committed write is expected to be the COMPLETE one, not the empty state");
  assert.equal(isNothingAtAll, false);
});

test("STORE-04's planted violation, in the SAME shape and through the SAME helper: with the commit removed, readBackByValue is FALSE and revertReturnsPriorValue is FALSE -- one planting, both halves", () => {
  const observed = observeMutateKillReopen("no-commit");

  // BOTH halves asserted false, in ONE test, on ONE planting. This is the
  // criterion `STORE-04` states and the reason it demands one combined test
  // rather than two: the snapshot POINTER ROW is inserted in the same
  // transaction as the mutation, so removing the single `commit` destroys the
  // durability claim and the revert claim SIMULTANEOUSLY. Two separate tests
  // would both stay green over a store satisfying neither.
  assert.equal(
    observed.readBackByValue,
    false,
    `with the commit removed the mutation must NOT survive, but a fresh process read back ${JSON.stringify(observed.rangesAfterKill)}`,
  );
  assert.equal(
    observed.revertReturnsPriorValue,
    false,
    "with the commit removed the revert must NOT return the prior value: the pointer row rolled back with the mutation, so there is nothing to revert to",
  );

  // THE MECHANISM, ASSERTED RATHER THAN INFERRED. A reader should be able to
  // see WHY both halves fail, not just that they do: the revision
  // compare-and-swap rolled back with everything else, so the file is still at
  // revision 0 and `anno_snapshot` is empty -- while the pre-mutation snapshot
  // FILE is on disk, orphaned, which is the harmless failure direction the
  // write sequence's ordering deliberately chooses.
  assert.equal(observed.revisionAfterKill, 0, "the CAS's revision bump rolled back with the mutation -- the file is still at revision 0");
  assert.deepEqual(observed.snapshotRowsAfterKill, [], "and no pointer row landed, which is exactly why the revert half fails too");
  assert.deepEqual(observed.snapshotFilesAfterKill, ["r0.db"], "the snapshot FILE is still there, orphaned -- extra files, never a missing one");
  assert.ok(
    observed.revertRefusal !== null && /cannot revert to revision 0/.test(observed.revertRefusal),
    `the revert half fails through a NAMED refusal, which is why it is converted to a boolean rather than allowed to propagate: ${String(observed.revertRefusal)}`,
  );

  // THE VALUES MEASURED IN PHASE RESEARCH, recorded so a future divergence
  // from them is visible rather than silently absorbed into a still-green
  // test:
  //     [commit]    revision=1 readBackByValue=true  revertReturnsPriorValue=true  -> GREEN
  //     [no-commit] revision=0 readBackByValue=false revertReturnsPriorValue=false -> RED
  //                 (AnnoStoreError: no snapshot recorded for revision 0)
  //
  // AND THE LIMIT OF THIS TEST, stated because it is easy to over-read. This
  // test is PERMANENTLY GREEN: it proves the criterion's shape is falsifiable
  // and keeps proving it in CI. It is NOT `STORE-04`'s observed red, because
  // the planting is a parameter to a SIBLING entry point -- the absence of the
  // commit is never exercised in the real, shipped call path here. That
  // obligation is discharged separately, by removing `runWriteSequence`'s
  // single `commit` BY HAND, watching the committing test above go red in both
  // halves, and reverting. Both are required; neither substitutes for the
  // other, and a reader who takes this test's green FOR that red has mis-read
  // it.
});

test("an orphan snapshot file left in the kill window is identified by its revision and does not affect the readback", () => {
  const dir = mkdtempSync(join(tmpdir(), "anno-"));
  try {
    const path = join(dir, "proj.annostore");
    closeStore(openStore(path, { workspaceRoot: dir }));

    try {
      execFileSync(process.execPath, [MUTATOR, path, "commit"], { stdio: "pipe" });
    } catch {
      // the self-SIGKILL's status 137 -- expected, see the helper above
    }

    // A kill between `vacuum into` and the commit leaves a snapshot FILE whose
    // pointer row never landed. Reproduced here by planting the extra file
    // directly, because the window is too narrow to hit reliably by timing --
    // and the property under test is about the FILE's effect on a later read,
    // not about the window's width. The revision this orphan claims is chosen
    // ABOVE every real one, which is the case that would matter if the read
    // path ever consulted the directory listing instead of the pointer rows.
    const snapshotDir = join(dir, "proj.annostore.snapshots");
    const realSnapshots = readdirSync(snapshotDir).sort();
    assert.ok(realSnapshots.includes("r0.db"), `the pre-mutation snapshot must be on disk, found ${realSnapshots.join(", ")}`);
    const orphan = join(snapshotDir, "r99.db");
    copyFileSync(join(snapshotDir, "r0.db"), orphan);

    const reopened = openStore(path, { workspaceRoot: dir });
    try {
      // The orphan is identifiable BY ITS REVISION from its filename alone --
      // which is what makes it reconcilable rather than merely harmless.
      const onDisk = readdirSync(snapshotDir).sort();
      assert.ok(onDisk.includes("r99.db"), "the planted orphan is on disk");
      const pointed = (reopened.db.prepare("select revision from anno_snapshot order by revision").all() as { revision: number }[]).map(
        (row) => row.revision,
      );
      assert.deepEqual(pointed, [0], "and no pointer row claims it -- that is exactly what makes it an orphan");
      assert.deepEqual(
        onDisk.filter((name) => !pointed.includes(Number(/^r(\d+)\.db$/.exec(name)?.[1] ?? "-1"))),
        ["r99.db"],
        "the orphan set is derivable from the filenames and the pointer rows, with no extra bookkeeping",
      );

      // The readback is unaffected: an extra file in `snapshots/` is not part
      // of any read path.
      const rows = listRanges(reopened);
      assert.equal(rows.length, 1, "the readback is unaffected by an extra snapshot file");
      assert.equal(rows[0].start, EXPECTED.start);
      assert.equal(rows[0].endInclusive, EXPECTED.endInclusive);
      assert.equal(rows[0].dataType, EXPECTED.dataType);
      assert.equal(currentRevision(reopened), 1);
    } finally {
      closeStore(reopened);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the mutator is test-only: absent from package.json files[], and its filename does not match the *.test.* glob the runner collects", () => {
  // Following `acme-gate.test.ts`'s own mechanical check rather than trusting
  // the mutator's header comment.
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files: string[] };
  assert.ok(Array.isArray(pkg.files), "package.json must declare a files[] array");
  assert.equal(
    pkg.files.includes(MUTATOR_FILENAME),
    false,
    `${MUTATOR_FILENAME} must never ship: it is a test-only helper whose entire purpose is to reach the no-commit write wrapper`,
  );

  // The glob claim, asserted rather than stated. Collected as a test, this file
  // would run `process.kill(process.pid, "SIGKILL")` inside the runner's own
  // process -- so the name is the only thing between the glob and a suite that
  // kills itself. This is the exact predicate `test-gate.mjs` uses.
  assert.equal(
    /\.test\.[a-zA-Z0-9]+$/.test(MUTATOR_FILENAME),
    false,
    `${MUTATOR_FILENAME} must not match the *.test.* glob -- collected as a test it would SIGKILL the test runner`,
  );

  // And it really is on disk under that name, so neither assertion above is
  // about a file that does not exist.
  assert.equal(existsSync(MUTATOR), true, `${MUTATOR_FILENAME} must exist, or both assertions above are vacuous`);
});

test("CR-06: with a separate OS process holding a READ transaction, the commit REFUSES inside the ViceError family, the revision is unchanged, and the write lock is released", async () => {
  // WHY A SEPARATE OS PROCESS AND NOT A SECOND HANDLE. A `COMMIT` of a write
  // transaction needs SQLite's EXCLUSIVE lock, and step 4's `begin immediate`
  // never excluded READERS -- so an ordinary reader is enough to make an
  // ACCEPTED-path write fail at its commit statement. That contention is only
  // real across processes; simulating it in-process would be a vacuous control.
  //
  // Against the pre-plan code this exact construction threw a bare `Error:
  // database is locked` after ~5010 ms, outside the ViceError family, with the
  // transaction left OPEN, the compare-and-swap applied, and `currentRevision()`
  // reporting the advanced revision for a write that never landed.
  //
  // SLOW BY CONSTRUCTION, and deliberately not sped up: the ~5 s this test
  // spends is the writer's own `busy_timeout` elapsing, which is what makes the
  // contention real rather than instantaneous.
  const dir = mkdtempSync(join(tmpdir(), "anno-"));
  let child: ReturnType<typeof spawn> | undefined;
  const store = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
  try {
    const path = store.path;
    // One accepted write, so the revision under test is non-zero and there is
    // something in the store to observe.
    setDataType(store, { start: 0x1000, endInclusive: 0x100f, dataType: "byte" });
    const revisionBefore = currentRevision(store);
    assert.equal(revisionBefore, 1, "the fixture is at the revision this test thinks it is at");

    const marker = join(dir, "reader-ready");
    // `spawn`, NOT `execFileSync`: the child has to be alive and holding its
    // read transaction WHILE the parent writes, and `execFileSync` would block
    // the parent for the child's whole lifetime. `stdio: "pipe"` for this
    // file's stated reason -- keeping `node:sqlite`'s unconditional
    // `ExperimentalWarning` out of the TAP stream, never to inspect it.
    child = spawn(process.execPath, [MUTATOR, path, MODE_HOLD_READ, marker], { stdio: "pipe" });
    waitForMarker(marker);

    assert.throws(
      () => setDataType(store, { start: 0x2000, endInclusive: 0x200f, dataType: "code" }),
      (e: unknown) => {
        // FAMILY MEMBERSHIP is the assertion that distinguishes the two worlds:
        // a bare SQLite `Error` is exactly what the pre-plan code produced.
        assert.ok(e instanceof AnnoStoreError, `expected AnnoStoreError, got ${String(e)}: ${(e as Error).message}`);
        assert.ok(e instanceof ViceError, "and it must be inside the ViceError family -- a bare `database is locked` Error here is the defect");
        assert.ok((e as Error).message.includes(path), `the refusal must name the store path, got ${(e as Error).message}`);
        assert.match(
          (e as Error).message,
          new RegExp(`still at revision ${revisionBefore}`),
          `the refusal must say which revision the store is still at, got ${(e as Error).message}`,
        );
        return true;
      },
    );

    // THE COMPARE-AND-SWAP WAS ROLLED BACK. Against the pre-plan code this read
    // returned the ADVANCED revision, from inside a transaction that never
    // committed.
    assert.equal(currentRevision(store), revisionBefore, "a refused commit must leave the revision exactly where it was");

    // THE WRITE LOCK WAS RELEASED. Against the pre-plan code this statement
    // reported "cannot start a transaction within a transaction", because the
    // failed commit left its own transaction open on this connection.
    store.db.exec("begin immediate");
    store.db.exec("rollback");

    // AND THE REFUSAL LEFT NO RESIDUE ON THE CONNECTION: once the reader is
    // gone, an ordinary write on the SAME handle is accepted and advances the
    // revision by exactly one.
    child.kill("SIGKILL");
    await once(child, "exit");
    child = undefined;

    const accepted = setDataType(store, { start: 0x3000, endInclusive: 0x300f, dataType: "code" });
    assert.equal(accepted.revision, revisionBefore + 1, "an unobstructed write on the same handle advances the revision by exactly one");
    assert.equal(currentRevision(store), revisionBefore + 1, "and the store agrees");
    assert.equal(listRanges(store).filter((row) => row.start === 0x3000).length, 1, "the accepted write's row is really there");
    assert.equal(listRanges(store).filter((row) => row.start === 0x2000).length, 0, "while the refused write's row is absent");
  } finally {
    if (child !== undefined) child.kill("SIGKILL");
    closeStore(store);
    // THE PARENT DOES THE CLEANING, per this file's own rule.
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// EVID-01/EVID-02, SCHEMA_VERSION 4 (43-02): `anno_evid_exec` exists on a
// fresh store, a version-3 store is refused by name and left untouched, and
// one evidence observation survives a real process death end to end.
// ---------------------------------------------------------------------------

test("SCHEMA_VERSION 4: a fresh store carries anno_evid_exec with exactly the no-change run-identity column set, all NOT NULL", () => {
  const dir = mkdtempSync(join(tmpdir(), "anno-"));
  try {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      assert.equal(SCHEMA_VERSION, 4, "EVID-02's bump: this build's SCHEMA_VERSION is 4");
      const meta = store.db.prepare("select schema_version from anno_meta where id = 1").get() as { schema_version: number };
      assert.equal(meta.schema_version, 4, "a fresh store's declared schema_version is this build's SCHEMA_VERSION");

      const columns = store.db.prepare("pragma table_info(anno_evid_exec)").all() as { name: string; notnull: number; pk: number }[];
      assert.deepEqual(
        columns.map((c) => c.name).sort(),
        ["address", "argv_digest", "id", "image_sha256", "seed", "source_bank"],
        "anno_evid_exec must carry exactly the no-change identity columns plus address and source_bank -- no run_class (plan 43-01's " +
          "verdict), no bank (unlike the annotation tables), and no other column",
      );
      for (const column of columns) {
        if (column.pk === 1) continue; // `id integer primary key` reports notnull:0 -- SQLite's own convention, measured.
        assert.equal(column.notnull, 1, `${column.name} must be NOT NULL -- this table has no reserved or nullable column`);
      }
    } finally {
      closeStore(store);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("SCHEMA_VERSION 4: a store whose anno_meta.schema_version is 3 is refused by name, naming both versions, with its bytes and mtime unchanged", () => {
  const dir = mkdtempSync(join(tmpdir(), "anno-"));
  try {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    // Forging the version-3 state directly -- the point is a file THIS BUILD
    // must refuse, not a write it would ever perform (matching the existing
    // D-15 test's own approach in anno-store.test.ts).
    store.db.prepare("update anno_meta set schema_version = 3 where id = 1").run();
    closeStore(store);

    const statBefore = statSync(path);
    const bytesBefore = readFileSync(path);

    assert.throws(
      () => openStore(path, { workspaceRoot: dir }),
      (e: unknown) => {
        assert.ok(e instanceof AnnoStoreCorruptError, `expected AnnoStoreCorruptError, got ${String(e)}`);
        assert.match(e.message, /schema_version 3/, "the refusal must name the version it found");
        assert.match(e.message, /expected 4/, "the refusal must name the version it wanted");
        return true;
      },
    );

    const statAfter = statSync(path);
    const bytesAfter = readFileSync(path);
    assert.equal(bytesAfter.length, bytesBefore.length, "a refusal must not resize the file it refused");
    assert.ok(bytesAfter.equals(bytesBefore), "and it must not change a single byte -- the file stays recoverable by hand");
    assert.equal(statAfter.mtimeMs, statBefore.mtimeMs, "and it must not even touch the file's mtime");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("EVID-01/T-43-09: one evidence observation survives a real SIGKILL with no clean close and reads back BY VALUE via listExecObservations", () => {
  const { rows } = observeEvidenceMutateKillReopen("commit");
  assert.equal(rows.length, 1, `expected exactly one evidence row after the committing kill, got ${JSON.stringify(rows)}`);
  assert.equal(rows[0].imageSha256, EVID_IDENTITY.imageSha256);
  assert.equal(rows[0].argvDigest, EVID_IDENTITY.argvDigest);
  assert.equal(rows[0].seed, EVID_IDENTITY.seed);
  assert.equal(rows[0].address, EVID_IDENTITY.address);
  assert.equal(rows[0].sourceBank, EVID_IDENTITY.sourceBank);
});

test("EVID-01/T-43-09's planted violation, through the SAME mutator mode: with the commit removed, the evidence insert leaves NO row", () => {
  const { rows } = observeEvidenceMutateKillReopen("no-commit");
  assert.deepEqual(
    rows,
    [],
    "with the commit removed the evidence insert must NOT survive -- one planting, proving the readback and the transaction are fused " +
      "rather than separately green",
  );
});

test("insertExecObservations refuses an out-of-range address, a source bank outside the frozen three, and a non-64-lowercase-hex identity digest, each BY NAME, and none of the four attempts writes a row or advances the revision", () => {
  const dir = mkdtempSync(join(tmpdir(), "anno-"));
  try {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      const validDigest = "c".repeat(64);

      assert.throws(
        () =>
          insertExecObservations(store, {
            imageSha256: validDigest,
            argvDigest: validDigest,
            seed: "s",
            observations: [{ address: 0x10000, sourceBank: "ram" }],
          }),
        (e: unknown) => {
          assert.ok(e instanceof AnnoAddressError, `expected AnnoAddressError for an out-of-range address, got ${String(e)}`);
          return true;
        },
      );

      assert.throws(
        () =>
          insertExecObservations(store, {
            imageSha256: validDigest,
            argvDigest: validDigest,
            seed: "s",
            observations: [{ address: 0x1000, sourceBank: "vram" }],
          }),
        (e: unknown) => {
          assert.ok(e instanceof AnnoTypeError, `expected AnnoTypeError for an unknown source bank, got ${String(e)}`);
          assert.match(e.message, /source bank/, "the refusal must name what was wrong -- the source bank");
          return true;
        },
      );

      assert.throws(
        () =>
          insertExecObservations(store, {
            imageSha256: "not-a-hex-digest",
            argvDigest: validDigest,
            seed: "s",
            observations: [{ address: 0x1000, sourceBank: "ram" }],
          }),
        (e: unknown) => {
          assert.ok(e instanceof AnnoTypeError, `expected AnnoTypeError for a malformed imageSha256, got ${String(e)}`);
          return true;
        },
      );

      assert.throws(
        () =>
          insertExecObservations(store, {
            imageSha256: validDigest,
            argvDigest: validDigest.toUpperCase(),
            seed: "s",
            observations: [{ address: 0x1000, sourceBank: "ram" }],
          }),
        (e: unknown) => {
          assert.ok(e instanceof AnnoTypeError, `expected AnnoTypeError for an uppercase (wrong-case) argvDigest, got ${String(e)}`);
          return true;
        },
      );

      assert.deepEqual(listExecObservations(store), [], "no refused call may leave a row behind");
      assert.equal(currentRevision(store), 0, "and no refused call may advance the revision");
    } finally {
      closeStore(store);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// EVID-05, criterion 5 (plan 43-07): a bracket's validity races anything else
// touching the store, not merely a second sequential run. Two plantings:
// a genuinely CONCURRENT two-identity SIGKILL, and a RESET followed by a
// re-measure from a separate process, each asserted by VALUE against a
// neighbour identity's untouched rows.
// ---------------------------------------------------------------------------

const IDENTITY_A_CONCURRENT = {
  imageSha256: "1".repeat(64),
  argvDigest: "2".repeat(64),
  seed: "43-07-concurrent-identity-a",
  address: 0xea50,
  sourceBank: "ram",
} as const;

const IDENTITY_B_CONCURRENT = {
  imageSha256: "3".repeat(64),
  argvDigest: "4".repeat(64),
  seed: "43-07-concurrent-identity-b",
} as const;

const B_SEED_CONCURRENT = [
  { address: 0x9000, sourceBank: "ram" },
  { address: 0x9001, sourceBank: "ram" },
] as const;

const B_SECOND_BATCH_CONCURRENT = { address: 0x9002, sourceBank: "ram" } as const;

test(
  "EVID-05 concurrent planting: a bracket's validity survives a concurrent writer being killed mid-ingest, and the block table is " +
    "untouched throughout",
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "anno-"));
    let childA: ReturnType<typeof spawn> | undefined;
    let childB: ReturnType<typeof spawn> | undefined;
    try {
      const path = join(dir, "proj.annostore");

      // A COMPLETE, COMMITTED observation set for run identity B -- seeded
      // in-process, through the shipped write path, before either child
      // starts. `rangesBefore` is captured from the SAME handle, before it
      // is closed.
      const seedHandle = openStore(path, { workspaceRoot: dir });
      let rangesBefore: ReturnType<typeof listRanges>;
      try {
        insertExecObservations(seedHandle, {
          imageSha256: IDENTITY_B_CONCURRENT.imageSha256,
          argvDigest: IDENTITY_B_CONCURRENT.argvDigest,
          seed: IDENTITY_B_CONCURRENT.seed,
          observations: B_SEED_CONCURRENT,
        });
        rangesBefore = listRanges(seedHandle);
      } finally {
        closeStore(seedHandle);
      }

      const markerA = join(dir, "identity-a-ready");

      // TWO CHILDREN, SPAWNED TOGETHER -- never a second sequential run. A
      // carries a readiness marker (this mode's new optional argv token,
      // 43-07); B does not need one, since nothing here waits for it.
      childA = spawn(
        process.execPath,
        [
          MUTATOR,
          path,
          MODE_INSERT_EVID,
          "commit",
          IDENTITY_A_CONCURRENT.imageSha256,
          IDENTITY_A_CONCURRENT.argvDigest,
          IDENTITY_A_CONCURRENT.seed,
          String(IDENTITY_A_CONCURRENT.address),
          IDENTITY_A_CONCURRENT.sourceBank,
          markerA,
        ],
        { stdio: "pipe" },
      );
      childB = spawn(
        process.execPath,
        [
          MUTATOR,
          path,
          MODE_INSERT_EVID,
          "commit",
          IDENTITY_B_CONCURRENT.imageSha256,
          IDENTITY_B_CONCURRENT.argvDigest,
          IDENTITY_B_CONCURRENT.seed,
          String(B_SECOND_BATCH_CONCURRENT.address),
          B_SECOND_BATCH_CONCURRENT.sourceBank,
        ],
        { stdio: "pipe" },
      );

      // THE `once()` LISTENERS ARE ATTACHED IMMEDIATELY, BEFORE EITHER CHILD
      // CAN EXIT. This mode's own self-SIGKILL ending is near-instant --
      // measured well under `waitForMarker`'s own 50ms poll interval -- so a
      // parent that calls `once(child, "exit")` only AFTER waiting for the
      // marker or issuing the kill can miss an "exit" event that already
      // fired, and then hang forever awaiting one that will never come
      // again. Registering both listeners here, synchronously right after
      // both `spawn()` calls and before any blocking wait, is what makes
      // this safe regardless of how quickly either child terminates.
      const childAExit = once(childA, "exit");
      const childBExit = once(childB, "exit");

      // THE RACE: the parent waits for A's own readiness marker, then kills A
      // WITH NO CLEAN CLOSE -- while B's genuinely concurrent write is
      // in flight against the SAME store file. Killing an already-exited
      // process is harmless: Node's `kill()` does not throw for that case,
      // and this mode's own unconditional self-SIGKILL ending (unchanged by
      // this plan) means A may already be gone by the time this call lands.
      waitForMarker(markerA);
      childA.kill("SIGKILL");

      await childBExit;
      await childAExit;
      childA = undefined;
      childB = undefined;

      // A FRESH process, never one of the two writers.
      const fresh = openStore(path, { workspaceRoot: dir });
      let aRows: ReturnType<typeof listExecObservations>;
      let bRows: ReturnType<typeof listExecObservations>;
      let rangesAfter: ReturnType<typeof listRanges>;
      try {
        aRows = listExecObservations(fresh, {
          imageSha256: IDENTITY_A_CONCURRENT.imageSha256,
          argvDigest: IDENTITY_A_CONCURRENT.argvDigest,
          seed: IDENTITY_A_CONCURRENT.seed,
        });
        bRows = listExecObservations(fresh, {
          imageSha256: IDENTITY_B_CONCURRENT.imageSha256,
          argvDigest: IDENTITY_B_CONCURRENT.argvDigest,
          seed: IDENTITY_B_CONCURRENT.seed,
        });
        rangesAfter = listRanges(fresh);
      } finally {
        closeStore(fresh);
      }

      // THE SURVIVOR IS COMPLETE, BY VALUE: the union of its seed and its
      // second, concurrently-written batch -- never merely a matching count.
      const bExpected = [...B_SEED_CONCURRENT, B_SECOND_BATCH_CONCURRENT]
        .map((o) => ({ address: o.address, sourceBank: o.sourceBank }))
        .sort((x, y) => x.address - y.address);
      const bObserved = bRows.map((r) => ({ address: r.address, sourceBank: r.sourceBank })).sort((x, y) => x.address - y.address);
      assert.deepEqual(
        bObserved,
        bExpected,
        `identity B must survive a concurrent writer's SIGKILL as the complete union of its seed and second batch, got ${JSON.stringify(bObserved)}`,
      );

      // THE CASUALTY IS ALL-OR-NOTHING -- ONE derived predicate, never two
      // branches with different messages, so a partial set fails by name
      // with the observed count and the expected batch size in the message.
      const aBatch = [{ address: IDENTITY_A_CONCURRENT.address, sourceBank: IDENTITY_A_CONCURRENT.sourceBank }];
      const aObserved = aRows.map((r) => ({ address: r.address, sourceBank: r.sourceBank }));
      const isWholeBatch =
        aObserved.length === aBatch.length && aObserved.every((row, i) => row.address === aBatch[i]!.address && row.sourceBank === aBatch[i]!.sourceBank);
      const isEmpty = aObserved.length === 0;
      assert.ok(
        isWholeBatch || isEmpty,
        `identity A must be all-or-nothing after a SIGKILL with no clean close, but a fresh process observed ${aObserved.length} row(s) ` +
          `against an expected batch of ${aBatch.length}: ${JSON.stringify(aObserved)}`,
      );

      // THE BLOCK TABLE -- a completely different table -- was untouched
      // throughout, by either writer.
      assert.deepEqual(rangesAfter, rangesBefore, "the byte-derived block table must be untouched by any evidence-table writer");
    } finally {
      if (childA !== undefined) childA.kill("SIGKILL");
      if (childB !== undefined) childB.kill("SIGKILL");
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

const IDENTITY_A_RELAUNCH = {
  imageSha256: "5".repeat(64),
  argvDigest: "6".repeat(64),
  seed: "43-07-relaunch-identity-a",
} as const;

const IDENTITY_B_RELAUNCH = {
  imageSha256: "7".repeat(64),
  argvDigest: "8".repeat(64),
  seed: "43-07-relaunch-identity-b",
} as const;

test(
  "EVID-05 relaunch planting: a bracket reset followed by a re-measure from a separate process leaves its neighbour byte-identical -- " +
    "a bracket's validity races anything else touching the store, and a reset followed by a re-measure must not disturb a neighbour",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "anno-"));
    try {
      const path = join(dir, "proj.annostore");

      const aBatch = [{ address: 0xea70, sourceBank: "rom" }] as const;
      const bSeed = [
        { address: 0xea80, sourceBank: "ram" },
        { address: 0xea81, sourceBank: "ram" },
      ] as const;

      const seedHandle = openStore(path, { workspaceRoot: dir });
      try {
        insertExecObservations(seedHandle, {
          imageSha256: IDENTITY_A_RELAUNCH.imageSha256,
          argvDigest: IDENTITY_A_RELAUNCH.argvDigest,
          seed: IDENTITY_A_RELAUNCH.seed,
          observations: aBatch,
        });
        insertExecObservations(seedHandle, {
          imageSha256: IDENTITY_B_RELAUNCH.imageSha256,
          argvDigest: IDENTITY_B_RELAUNCH.argvDigest,
          seed: IDENTITY_B_RELAUNCH.seed,
          observations: bSeed,
        });

        // THE RESET: the store-side half of a bracket reset (EVID-05),
        // in-process, through the shipped write path -- identity A's rows
        // only.
        deleteExecObservationsForRun(seedHandle, {
          imageSha256: IDENTITY_A_RELAUNCH.imageSha256,
          argvDigest: IDENTITY_A_RELAUNCH.argvDigest,
          seed: IDENTITY_A_RELAUNCH.seed,
        });
      } finally {
        closeStore(seedHandle);
      }

      // THE RE-MEASURE: a SEPARATE spawned process re-ingests A's batch from
      // nothing. This mode always ends by SIGKILLing itself -- its own
      // unconditional ending, unchanged by this plan -- so the "error" here
      // is expected and caught the same way `observeEvidenceMutateKillReopen`
      // already does above.
      try {
        execFileSync(
          process.execPath,
          [
            MUTATOR,
            path,
            MODE_INSERT_EVID,
            "commit",
            IDENTITY_A_RELAUNCH.imageSha256,
            IDENTITY_A_RELAUNCH.argvDigest,
            IDENTITY_A_RELAUNCH.seed,
            String(aBatch[0].address),
            aBatch[0].sourceBank,
          ],
          { stdio: "pipe" },
        );
      } catch {
        // EXPECTED AND IGNORED -- the self-SIGKILL, for the identical reason
        // `observeEvidenceMutateKillReopen`'s own catch gives.
      }

      const fresh = openStore(path, { workspaceRoot: dir });
      try {
        const bRows = listExecObservations(fresh, {
          imageSha256: IDENTITY_B_RELAUNCH.imageSha256,
          argvDigest: IDENTITY_B_RELAUNCH.argvDigest,
          seed: IDENTITY_B_RELAUNCH.seed,
        });
        const bObserved = bRows.map((r) => ({ address: r.address, sourceBank: r.sourceBank })).sort((x, y) => x.address - y.address);
        const bExpected = [...bSeed].sort((x, y) => x.address - y.address);
        assert.deepEqual(
          bObserved,
          bExpected,
          `identity B's row set must be byte-identical to its seed after A's reset and re-ingest, got ${JSON.stringify(bObserved)}`,
        );

        const aRows = listExecObservations(fresh, {
          imageSha256: IDENTITY_A_RELAUNCH.imageSha256,
          argvDigest: IDENTITY_A_RELAUNCH.argvDigest,
          seed: IDENTITY_A_RELAUNCH.seed,
        });
        const aObserved = aRows.map((r) => ({ address: r.address, sourceBank: r.sourceBank }));
        assert.deepEqual(aObserved, [...aBatch], `identity A's row set must equal exactly its re-ingested batch, got ${JSON.stringify(aObserved)}`);
      } finally {
        closeStore(fresh);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
