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
//     to reach `applyWriteWithoutCommit`, a seam-private export.
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
// ---------------------------------------------------------------------------
// THE FOURTH MODE: HOLD A READ TRANSACTION (28-14, CR-06)
// ---------------------------------------------------------------------------
// `hold-read` writes nothing at all. It opens the store, runs a genuine read
// INSIDE a transaction and then holds that transaction open for a bounded
// lifetime. Its purpose is CR-06: a `COMMIT` of a write transaction needs
// SQLite's EXCLUSIVE lock, and `begin immediate` never excluded READERS -- so an
// ordinary reader in another process is enough to make an accepted-path write
// fail at its commit statement. That contention is only real ACROSS PROCESSES:
// two handles in one process share nothing that would make the lock manager
// behave as it does between two OS processes, so an in-process simulation would
// be a vacuous control.
//
// Three properties of the mode a reader would otherwise have to rederive:
//
//   1. `begin deferred` ALONE ACQUIRES NOTHING. SQLite takes the SHARED lock at
//      the first statement that actually reads, so the mode issues a real
//      `select` against `anno_meta` before it claims to be holding anything.
//   2. READINESS IS SIGNALLED BY A MARKER FILE, not by stdout, and only AFTER
//      that read has run. This file's own header forbids the parent inspecting
//      the child's chatter, and the parent's wait has to be a bounded
//      SYNCHRONOUS spin -- it blocks its own event loop inside the write it is
//      about to attempt, so it could not observe a pipe anyway.
//   3. THE HOLD IS BOUNDED, so a parent that dies cannot leave an orphan
//      process holding the store's lock forever. The bound is chosen to outlive
//      the writer's 5000 ms `busy_timeout` with margin; the parent kills the
//      child as soon as it is done, so the bound is a ceiling, not a delay.
//
// Nothing is written to stdout. The parent inspects the STORE FILE, never this
// process's chatter, and the `ExperimentalWarning` `node:sqlite` emits on first
// load is left alone -- the parent's `stdio: "pipe"` is what keeps it out of
// the TAP stream.
//
// ---------------------------------------------------------------------------
// THE FIFTH MODE: INSERT ONE EVIDENCE OBSERVATION (EVID-01, 43-02)
// ---------------------------------------------------------------------------
// `insert-evid` is `anno_evid_exec`'s own counterpart to the RANGE modes
// above, and it reuses their two decisions rather than re-deriving them:
//
//   * THE MUTATION IS A SINGLE RAW INSERT, for decision 2's exact reason.
//     `insertExecObservations()` (`anno-store.ts`) hard-wires `applyWrite`
//     (the COMMITTING wrapper) the same way `setDataType()` does, so routing
//     a committing planting through it and a no-commit planting through
//     `applyWriteWithoutCommit` would make the two plantings differ in more
//     than the commit. This mode inserts directly into `anno_evid_exec`
//     instead, through `mutateEvidence()` below -- the evidence-table analog
//     of `mutateStore()`.
//   * THE WRITER SELECTION IS THE SAME PARAMETER, not a new one: this mode's
//     OWN writer token (argv[4]) is spelled with the identical two strings
//     `MODE_COMMIT`/`MODE_NO_COMMIT` already use above, and
//     `pickWriter()` is the one ternary both the range dispatch and this
//     mode's dispatch read from. A caller cannot select a THIRD, undefined
//     writer by typo -- there are only ever two, named once.
//
// Argv layout: `<storePath> insert-evid <writerToken> <imageSha256>
// <argvDigest> <seed> <address> <sourceBank> [markerPath]`. Like the range
// modes, this mode SIGKILLs itself with no clean close -- the kill is the
// point, not an afterthought.
//
// ---------------------------------------------------------------------------
// THE OPTIONAL NINTH ARGV TOKEN: A READINESS MARKER (plan 43-07, EVID-05)
// ---------------------------------------------------------------------------
// `insert-evid` gains ONE more optional argv token rather than a second write
// sequence: a readiness-marker path, in the same position and refused with the
// same message shape `hold-read`'s own marker already uses above. The marker
// is written after `openStore()` returns and BEFORE `mutateEvidence()`'s write
// call starts, so a parent racing a SECOND writer against this one can order
// the two without sleeping -- it waits for the marker, then starts (or kills)
// the other side, rather than guessing at a delay. Omitted entirely, this mode
// behaves exactly as it did before this plan: no marker file is written, and
// every pre-existing caller (plan 43-02's own committing/no-commit durability
// pair) is unaffected.
import { writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { applyWrite, applyWriteWithoutCommit, closeStore, openStore } from "./anno-store.ts";

/** The four argv tokens. Spelled once here so the test file and this file
 * cannot disagree about them by a typo that would look like a store bug. */
const MODE_COMMIT = "commit";
const MODE_NO_COMMIT = "no-commit";
const MODE_COMMIT_AND_EXIT = "commit-and-exit";
const MODE_HOLD_READ = "hold-read";
const MODE_INSERT_EVID = "insert-evid";

/** How long `hold-read` keeps its read transaction open, in milliseconds. Well
 * clear of the writer's 5000 ms `busy_timeout` so the contention the parent
 * measures is decided by the lock and not by this timer -- and finite so a
 * parent that dies cannot orphan a process holding the store's lock. */
const HOLD_READ_MS = 12_000;

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

/** Resolves a writer-selection argv token to `commitWriter` or
 * `noCommitWriter` -- the ONE ternary every mode that needs the choice reads
 * from, so a typo'd third token fails loudly here rather than silently
 * picking a writer nobody asked for. */
function pickWriter(token) {
  if (token === MODE_NO_COMMIT) return noCommitWriter;
  if (token === MODE_COMMIT) return commitWriter;
  process.stderr.write(
    `anno-durability-mutator: expected a writer token of ${JSON.stringify(MODE_COMMIT)} or ${JSON.stringify(MODE_NO_COMMIT)}, got ${JSON.stringify(token)}\n`,
  );
  process.exit(2);
}

/**
 * Everything all three modes do, with the write wrapper and the range as its
 * only parameters. Returns the open handle; what happens to it next -- a
 * self-kill or a clean close -- is the caller's business and is the ONLY other
 * thing the modes differ in.
 */
function mutateStore(storePath, write, range) {
  // CONFINED, NOT ESCAPED (WR-25). `openStore`'s workspace root is REQUIRED as
  // of 28-21, and this helper has a real one to give: the store file's own
  // directory. It is not a module-derived path in `anno-store.ts`'s sense --
  // it arrives on argv -- so the escape hatch is the wrong remedy here and
  // would make this spawned helper the one caller that forgets.
  const handle = openStore(storePath, { workspaceRoot: dirname(storePath) });
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

/**
 * `mutateStore`'s evidence-table analog: the same shape, the same
 * `write`-as-only-parameter contract, a single raw insert -- never
 * `insertExecObservations()` itself, per this file's own decision 2 above.
 * `markerPath`, when supplied, is written AFTER the store is open and BEFORE
 * the insert starts -- the ordering a racing parent needs (plan 43-07). Omit
 * it (`undefined`) for the original, unordered call shape. Returns the open
 * handle; the caller's kill-or-close is, again, the only other thing this
 * mode differs from the range modes in.
 */
function mutateEvidence(storePath, write, identity, markerPath) {
  const handle = openStore(storePath, { workspaceRoot: dirname(storePath) });
  if (typeof markerPath === "string" && markerPath.length > 0) {
    writeFileSync(markerPath, `${process.pid}\n`);
  }
  write(handle, (db) => {
    db.prepare("insert into anno_evid_exec(image_sha256, argv_digest, seed, address, source_bank) values (?, ?, ?, ?, ?)").run(
      identity.imageSha256,
      identity.argvDigest,
      identity.seed,
      identity.address,
      identity.sourceBank,
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
} else if (mode === MODE_HOLD_READ) {
  const markerPath = process.argv[4];
  if (typeof markerPath !== "string" || markerPath.length === 0) {
    process.stderr.write(`anno-durability-mutator: mode ${MODE_HOLD_READ} needs argv[4], the readiness marker path\n`);
    process.exit(2);
  }
  // CONFINED, for the same reason as `mutateStore` above.
  const handle = openStore(storePath, { workspaceRoot: dirname(storePath) });
  handle.db.exec("begin deferred");
  // THE READ IS WHAT TAKES THE LOCK. `begin deferred` on its own acquires
  // nothing; the SHARED lock arrives with the first statement that actually
  // reads a page. One row out of `anno_meta` is the smallest statement that
  // does it.
  handle.db.prepare("select revision from anno_meta where id = 1").get();

  // ONLY NOW is the marker written: the parent treats its appearance as "the
  // reader is holding the lock", and writing it any earlier would let the
  // parent's write start against a store nothing was reading.
  writeFileSync(markerPath, `${process.pid}\n`);

  // A SYNCHRONOUS block, deliberately: an async timer would return to the event
  // loop, and nothing here should be able to run between the read and the close.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, HOLD_READ_MS);

  handle.db.exec("rollback");
  closeStore(handle);
  process.exit(0);
} else if (mode === MODE_INSERT_EVID) {
  const writerToken = process.argv[4];
  const imageSha256 = process.argv[5];
  const argvDigest = process.argv[6];
  const seed = process.argv[7];
  const address = Number(process.argv[8]);
  const sourceBank = process.argv[9];
  // OPTIONAL. Absent (`undefined`) preserves this mode's original,
  // unordered shape for every pre-existing caller (43-02). Supplied, it must
  // be a non-empty path -- the same refusal shape `hold-read`'s own marker
  // argument uses above (43-07).
  const markerPath = process.argv[10];
  if (
    typeof imageSha256 !== "string" ||
    typeof argvDigest !== "string" ||
    typeof seed !== "string" ||
    !Number.isInteger(address) ||
    typeof sourceBank !== "string"
  ) {
    process.stderr.write(
      `anno-durability-mutator: mode ${MODE_INSERT_EVID} needs argv[5..9] to be imageSha256, argvDigest, seed, address, sourceBank\n`,
    );
    process.exit(2);
  }
  if (markerPath !== undefined && (typeof markerPath !== "string" || markerPath.length === 0)) {
    process.stderr.write(
      `anno-durability-mutator: mode ${MODE_INSERT_EVID} needs argv[10], when supplied, to be a non-empty readiness marker path\n`,
    );
    process.exit(2);
  }
  const write = pickWriter(writerToken);
  mutateEvidence(storePath, write, { imageSha256, argvDigest, seed, address, sourceBank }, markerPath);
  // NO clean close and NO process.exit, for the identical reason the range
  // modes give above: the kill IS the point.
  process.kill(process.pid, "SIGKILL");
} else {
  process.stderr.write(`anno-durability-mutator: unknown mode ${JSON.stringify(mode)}\n`);
  process.exit(2);
}
