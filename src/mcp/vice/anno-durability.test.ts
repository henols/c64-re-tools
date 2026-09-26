// anno-durability.test.ts -- the ONE combined proof that `STORE-04` asks for:
// a separate OS process mutates an annotation store and SIGKILLs itself with no
// clean close, a FRESH process reopens the file, and the mutation AND the
// project's revision advance read back BY VALUE -- all in the SAME test.
//
// WHY ONE TEST AND NOT TWO. The revision advance and the mutation share one
// transaction, so ONE planted violation -- removing `anno-store.ts`'s single
// `commit` -- fails both at once: the row is gone and the revision is still 0.
// That fusion is the mechanism, documented at `runWriteSequence`.
//
// THE BOOLEANS ARE VALUES, ASSERTED AS VALUES. The observation helper below
// returns them; the assertions read them and sit outside any `try`.
//
// Every temp directory is `mkdtempSync(join(tmpdir(), "anno-"))` removed in an
// unconditional `finally`, and THE PARENT DOES THE CLEANING because on the
// SIGKILL path the child cannot: `/tmp` here is a tmpfs with cleanup disabled,
// and these cases leave database files and hot journals behind.
//
// NOTHING here asserts stderr is empty, and nothing may: `node:sqlite` emits an
// `ExperimentalWarning` unconditionally on first load, and every spawn below
// pipes the child's stdio (never inherits it, never ignores it) to keep that
// warning out of the TAP stream rather than to inspect it.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
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
  setDataType,
} from "./anno-store.ts";
import { AnnoAddressError, AnnoStoreCorruptError, AnnoStoreError, AnnoTypeError, SCHEMA_VERSION } from "./anno-types.ts";
import type { RangeRow } from "./anno-types.ts";
import { ViceError } from "./vice-errors.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The spawned, never-imported child. Its name deliberately does not match the
 * `*.test.*` glob -- collected as a test it would SIGKILL the runner. */
const MUTATOR_FILENAME = "store-durability-mutator.ts";
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
  /** The project's revision after the kill: 1 when the write committed, 0 when
   * it did not. It moves in the same transaction as the mutation. */
  revisionAfterKill: number;
  /** Every row the reopened store returned, so the all-or-nothing property can
   * be asserted on the actual set rather than only on a boolean. */
  rangesAfterKill: RangeRow[];
}

/**
 * Runs the mutator in `mode`, then reopens the store in THIS process and
 * computes the observation.
 *
 * ONE HELPER, CALLED BY BOTH THE COMMITTING TEST AND ITS PLANTED COUNTERPART.
 * That sharing is the requirement, not a convenience: `STORE-04` asks that
 * removing the commit reddens THAT SAME TEST, so the planted run must not be
 * able to drift into a different sequence than the one it is the counterpart
 * of. The `try/finally` is temp-directory cleanup only and has no `catch`.
 */
function observeMutateKillReopen(mode: "commit" | "no-commit"): Observation {
  const dir = mkdtempSync(join(tmpdir(), "anno-"));
  try {
    const path = join(dir, "proj.annostore");

    // The store exists, with its DDL and its project at revision 0, BEFORE the
    // child runs -- so the child is a writer to an existing file rather than
    // its creator.
    closeStore(openStore(path, { workspaceRoot: dir }));

    try {
      execFileSync(process.execPath, [MUTATOR, path, mode], { stdio: "pipe" });
    } catch {
      // EXPECTED AND IGNORED. The child kills itself, so `execFileSync` throws
      // on the non-zero status (137 = 128 + SIGKILL). Every claim is read back
      // off the FILE, never off the child's exit.
    }

    // A different OS process from the mutator, by construction.
    const reopened = openStore(path, { workspaceRoot: dir });
    try {
      const rows = listRanges(reopened);
      const readBackByValue =
        rows.length === 1 && rows[0].start === EXPECTED.start && rows[0].endInclusive === EXPECTED.endInclusive && rows[0].dataType === EXPECTED.dataType;
      return { readBackByValue, revisionAfterKill: currentRevision(reopened), rangesAfterKill: rows };
    } finally {
      closeStore(reopened);
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
    // SCHEMA_VERSION 4) and its project at revision 0, BEFORE the child runs.
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

test("STORE-04, one combined test: a separate OS process mutates the store and SIGKILLs itself with no clean close, a FRESH process reopens the file, and the mutation and the revision advance read back BY VALUE", () => {
  const observed = observeMutateKillReopen("commit");

  assert.equal(
    observed.readBackByValue,
    true,
    `the DURABILITY half failed: after a real SIGKILL with no clean close, a fresh process read back ` +
      `${JSON.stringify(observed.rangesAfterKill)} rather than exactly ${JSON.stringify(EXPECTED)} (revision ${observed.revisionAfterKill})`,
  );
  assert.equal(observed.revisionAfterKill, 1, "the committed write advanced the project's revision by exactly one and the advance survived the kill");

  // ALL-OR-NOTHING, asserted on THIS SAME RUN. Both acceptable states are
  // enumerated explicitly; the property proven is that the THIRD state -- a
  // row present but wrong, from a half-applied write -- does not exist.
  const rows = observed.rangesAfterKill;
  const isCompleteMutation =
    rows.length === 1 && rows[0].start === EXPECTED.start && rows[0].endInclusive === EXPECTED.endInclusive && rows[0].dataType === EXPECTED.dataType;
  const isNothingAtAll = rows.length === 0;
  assert.equal(
    isCompleteMutation || isNothingAtAll,
    true,
    `an interrupted write must be all-or-nothing, but the reopened store held ${JSON.stringify(rows)} -- neither the complete ` +
      `${JSON.stringify(EXPECTED)} nor an empty set`,
  );
  assert.equal(isCompleteMutation, true, "on this store the committed write is expected to be the COMPLETE one, not the empty state");
});

test("STORE-04's planted violation, in the SAME shape and through the SAME helper: with the commit removed, readBackByValue is FALSE and the revision is still 0 -- one planting, both halves", () => {
  const observed = observeMutateKillReopen("no-commit");

  assert.equal(
    observed.readBackByValue,
    false,
    `with the commit removed the mutation must NOT survive, but a fresh process read back ${JSON.stringify(observed.rangesAfterKill)}`,
  );
  assert.equal(observed.revisionAfterKill, 0, "the revision advance rolled back with the mutation -- the project is still at revision 0");
  assert.deepEqual(observed.rangesAfterKill, [], "and no half of the write landed");

  // THE LIMIT OF THIS TEST: it is PERMANENTLY GREEN. It proves the
  // criterion's shape is falsifiable; the real red is observed by removing
  // `runWriteSequence`'s single `commit` BY HAND and watching the committing
  // test above fail.
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
  // kills itself. This is the exact predicate `test-gate.ts` uses.
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

test("SCHEMA_VERSION 6: a fresh store carries anno_evid_exec with exactly the no-change run-identity column set plus project_id, all NOT NULL", () => {
  const dir = mkdtempSync(join(tmpdir(), "anno-"));
  try {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      // RE-RECORDED 2026-09-26, 5 -> 6: `anno_evid_exec` gains `project_id`
      // like every project table; its identity columns are unchanged.
      assert.equal(SCHEMA_VERSION, 6, "this build's SCHEMA_VERSION is 6, the per-project database");
      const meta = store.db.prepare("select schema_version from anno_meta where id = 1").get() as { schema_version: number };
      assert.equal(meta.schema_version, 6, "a fresh store's declared schema_version is this build's SCHEMA_VERSION");

      const columns = store.db.prepare("pragma table_info(anno_evid_exec)").all() as { name: string; notnull: number; pk: number }[];
      assert.deepEqual(
        columns.map((c) => c.name).sort(),
        ["address", "argv_digest", "id", "image_sha256", "project_id", "seed", "source_bank"],
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

test("SCHEMA_VERSION 6: a store whose anno_meta.schema_version is 3 is refused by name, naming both versions, with its bytes and mtime unchanged", () => {
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
        assert.match(e.message, /expected 6/, "the refusal must name the version it wanted");
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

// IN-01 (46-REVIEW): the `reaffirm-refusal` doc comment in
// `anno-types.ts` states, as part of its own decision basis, "a version-4
// store does not open under this SCHEMA_VERSION" -- but until this test, no
// committed fixture actually constructed one; the general `openStore()`
// mismatch branch was exercised only via the version-3 fixture above. Same
// shape as that test, `4` in place of `3` throughout, so the two fixtures
// stay visibly parallel rather than one silently drifting from the other.
test("SCHEMA_VERSION 6: a store whose anno_meta.schema_version is 4 is refused by name, naming both versions, with its bytes and mtime unchanged", () => {
  const dir = mkdtempSync(join(tmpdir(), "anno-"));
  try {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    // Forging the version-4 state directly -- the point is a file THIS BUILD
    // must refuse, not a write it would ever perform.
    store.db.prepare("update anno_meta set schema_version = 4 where id = 1").run();
    closeStore(store);

    const statBefore = statSync(path);
    const bytesBefore = readFileSync(path);

    assert.throws(
      () => openStore(path, { workspaceRoot: dir }),
      (e: unknown) => {
        assert.ok(e instanceof AnnoStoreCorruptError, `expected AnnoStoreCorruptError, got ${String(e)}`);
        assert.match(e.message, /schema_version 4/, "the refusal must name the version it found");
        assert.match(e.message, /expected 6/, "the refusal must name the version it wanted");
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
