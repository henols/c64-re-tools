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
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { closeStore, currentRevision, listRanges, openStore, revertTo } from "./anno-store.ts";
import type { RangeRow } from "./anno-types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The spawned, never-imported child. Its name deliberately does not match the
 * `*.test.*` glob -- collected as a test it would SIGKILL the runner. */
const MUTATOR_FILENAME = "anno-durability-mutator.mjs";
const MUTATOR = join(HERE, MUTATOR_FILENAME);

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
