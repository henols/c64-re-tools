#!/usr/bin/env node
// anno-durability-mutator.mjs -- the TEST-ONLY child process that mutates an
// annotation store and then SIGKILLs itself, so the durability claim is
// measured across a real process death rather than asserted about one.
//
// ---------------------------------------------------------------------------
// THIS MODULE IS TEST-ONLY
// ---------------------------------------------------------------------------
// Following `acme-gate.ts`'s own clause, and for the same reasons:
//
//   * It must NEVER appear in `package.json`'s `files[]`. A test-only helper
//     has no business in the published npm tarball, and
//     `anno-durability.test.ts` asserts that absence MECHANICALLY on every
//     suite run rather than trusting this comment.
//   * It must NEVER be imported by a production module. Its whole purpose is
//     to reach `applyWriteWithoutCommit`, and `anno-seam.test.ts` already
//     asserts no shipped module but the seam so much as names that wrapper.
//   * Its own filename deliberately does NOT match the `*.test.*` glob
//     `node --test` collects. Here that clause is LOAD-BEARING in a way it is
//     not for `acme-gate.ts`: this file is SPAWNED, and spawning it as a test
//     would run `process.kill(process.pid, "SIGKILL")` inside the test
//     runner's own process. The name is the only thing standing between the
//     glob and a suite that kills itself.
//
// ---------------------------------------------------------------------------
// WHY IT EXISTS
// ---------------------------------------------------------------------------
// `STORE-04` requires ONE combined test whose planted violation is the removal
// of the single `commit`, because two separate tests -- one for durability, one
// for revert -- both stay green over a store that satisfies neither claim. The
// mechanism that fuses them is in `anno-store.ts`: the snapshot POINTER ROW is
// inserted in the same transaction as the mutation, so losing the commit loses
// the mutation and the ability to undo it at the same instant.
//
// Measuring that needs a process that genuinely DIES mid-write. An in-process
// reopen of the same `DatabaseSync` proves nothing: it can be served from
// anything the writing connection still holds, and no journal was ever left
// hot. So: a separate OS process, a self-`SIGKILL` with NO clean close, and a
// parent that reopens the file afterwards.
//
// ---------------------------------------------------------------------------
// TWO DECISIONS A READER WOULD OTHERWISE HAVE TO REDERIVE
// ---------------------------------------------------------------------------
//   1. THE PLANTING IS A PARAMETER TO THE SAME CODE PATH. The committing and
//      the planted modes share ONE function and differ in exactly one thing:
//      which write wrapper it is handed. A hand-copied variant of the write
//      sequence could drift out of agreement with the real one, and then the
//      planting would stop testing what it claims to.
//   2. THE MUTATION IS A SINGLE RAW INSERT RATHER THAN `setDataType()`, and
//      that is forced by decision 1. `setDataType()` hard-wires the COMMITTING
//      wrapper, so routing the committing mode through it and the planted mode
//      through `applyWriteWithoutCommit` would make the two modes differ in
//      more than the commit -- exactly the drift decision 1 exists to prevent.
//      What is skipped by inserting directly is `retype()`'s
//      split-and-preserve logic, which is `STORE-02`'s subject and is proven
//      across all five overlap cases in `anno-overlap.test.ts`. It is not what
//      a durability proof is about: the sequence this file drives is the one
//      that matters here -- open, snapshot, `begin immediate`, the revision
//      compare-and-swap, the pointer row, the mutation, and the commit or its
//      absence.
//
// Nothing is written to stdout. The parent inspects the STORE FILE, never this
// process's chatter, and the `ExperimentalWarning` `node:sqlite` emits on first
// load is left alone -- the parent's `stdio: "pipe"` is what keeps it out of
// the TAP stream.
import { applyWrite, applyWriteWithoutCommit, closeStore, openStore } from "./anno-store.ts";

/** The three argv tokens. Spelled once here so the test file and this file
 * cannot disagree about them by a typo that would look like a store bug. */
const MODE_COMMIT = "commit";
const MODE_NO_COMMIT = "no-commit";
const MODE_COMMIT_AND_EXIT = "commit-and-exit";

/** The range the two KILLED modes write. The parent reads this back BY VALUE,
 * so all three fields matter. */
const KILLED_RANGE = { start: 0x0810, endInclusive: 0x084f, dataType: "lo_hi_address" };

/** The range the commit-and-exit mode writes -- DIFFERENT on purpose, so the
 * cross-process compare-and-swap proof can tell WHOSE row survived rather than
 * having to infer it from a row both processes could have written. */
const OTHER_PROCESS_RANGE = { start: 0x2000, endInclusive: 0x201f, dataType: "word" };

/** The committing wrapper, named once. */
const commitWriter = (handle, mutate) => applyWrite(handle, mutate);

/** The PLANTED wrapper: the identical sequence with its single `commit`
 * removed. Named once, and the only difference between this file's two killed
 * modes. */
const noCommitWriter = (handle, mutate) => applyWriteWithoutCommit(handle, mutate);

/**
 * Everything all three modes do, with the write wrapper and the range as its
 * only parameters. Returns the open handle; what happens to it next -- a
 * self-kill or a clean close -- is the caller's business and is the ONLY other
 * thing the modes differ in.
 */
function mutateStore(storePath, write, range) {
  const handle = openStore(storePath);
  write(handle, (db) => {
    db.prepare("insert into anno_range(start, end_inclusive, data_type, bank) values (?, ?, ?, ?)").run(
      range.start,
      range.endInclusive,
      range.dataType,
      null,
    );
    return true;
  });
  return handle;
}

const storePath = process.argv[2];
const mode = process.argv[3];

if (typeof storePath !== "string" || storePath.length === 0) {
  process.stderr.write("anno-durability-mutator: argv[2] must be a store path\n");
  process.exit(2);
}

if (mode === MODE_COMMIT || mode === MODE_NO_COMMIT) {
  mutateStore(storePath, mode === MODE_NO_COMMIT ? noCommitWriter : commitWriter, KILLED_RANGE);
  // NO clean close and NO process.exit: the kill IS the point. `closeStore`
  // here would flush and release the lock, which is the exact tidiness this
  // proof must not have -- a store that only survives an orderly shutdown has
  // not survived anything.
  process.kill(process.pid, "SIGKILL");
} else if (mode === MODE_COMMIT_AND_EXIT) {
  // No kill. This mode exists for the cross-process compare-and-swap proof:
  // another process's write has to be genuinely COMMITTED and its connection
  // genuinely gone before the parent's stale-base write is attempted, or the
  // refusal being measured could be a lock contention instead.
  closeStore(mutateStore(storePath, commitWriter, OTHER_PROCESS_RANGE));
  process.exit(0);
} else {
  process.stderr.write(`anno-durability-mutator: unknown mode ${JSON.stringify(mode)}\n`);
  process.exit(2);
}
