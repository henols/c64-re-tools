#!/usr/bin/env node
// anno-store.ts
//
// The ONE module in this repo that names `node:sqlite`. Nothing else may open,
// query or write an annotation store file; every other module reaches the
// store through the functions below (STORE-07).
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// `node:sqlite` is still marked *active development* on the Node 22 line: its
// surface can change under a patch release, and it emits an
// `ExperimentalWarning` on first load. A dependency with that profile earns a
// blast radius of exactly one file -- and, more to the point, a CONFINEMENT
// THAT IS ASSERTED rather than promised. `anno-seam.test.ts` scans the shipped
// module set and fails if any second module names the specifier, through any of
// its four working access routes.
//
// Three measured facts shaped the code below, and each one is here because the
// obvious reading of SQLite's behaviour is wrong:
//
//   * A ZERO-LENGTH FILE OPENS. Measured on this host: `new DatabaseSync()`
//     over an empty file succeeds, `pragma integrity_check` reports `ok`,
//     `sqlite_master` comes back empty and `user_version` reads 0. So SQLite
//     cannot tell "your annotations are gone" from "there are no annotations"
//     -- and the difference is the difference between a bug report and a
//     shrug. The refusal is therefore the store's OWN job: the `anno_meta`
//     row, the `schema_version` match, and `pragma integrity_check`
//     (0.73 ms measured on a 100 KB / 5,000-row store). Stated residual, not
//     a closed claim: a truncation small enough to leave the last page
//     internally consistent would still open.
//
//   * THE DEFAULT `delete` JOURNAL MODE IS THE RIGHT ONE, and it is not set
//     here. Measured: `delete` and `wal` survive `SIGKILL` identically.
//     `delete` is single-file at rest and leaves only a transient
//     `<db>-journal` after an unclean kill, which the next open rolls back and
//     removes; `wal` is the only mode with PERSISTENT `-wal`/`-shm` sidecars.
//     And `journal_mode` is a PERSISTENT DATABASE PROPERTY -- `pragma`
//     statements are not transactional -- so one stray `pragma journal_mode`
//     anywhere would be inherited by every later connection to that file, by
//     any process. Setting nothing is the decision; a test pins the mode so
//     the decision cannot be undone silently.
//
//   * `node:sqlite` DOES expose a session surface. `DatabaseSync.prototype`
//     carries `createSession` and `applyChangeset`, `ENABLE_SESSION` is
//     compiled in, and a changeset was replayed between two databases during
//     research. Only the changeset INVERSION primitive is missing -- which is
//     why revert is a whole-store snapshot restore rather than an inverted
//     changeset. No comment in this repo may claim the session surface is
//     absent, because that is false.
//
// THIS MODULE MUST BE LISTED IN `package.json`'s `files[]`, and the reason is
// NOT the reachability reason `prg-image.ts:30-36` gives for itself. This
// module is not yet reachable from the published entry point's import closure,
// and `scripts/check-npm-packages.mjs` asserts only one direction -- every
// REACHABLE module must be listed -- never the converse. The real reason to
// list it: `STORE-07`'s assertion scans `shippedTsModules()`, which is derived
// from `files[]`, so an unlisted module makes that assertion VACUOUS. It would
// pass by scanning a set this file is not in. Copying the reachability sentence
// here would plant a false claim in a brand-new seam header, which is the
// defect `block-class.ts`'s own stale rationale demonstrates.
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO -- each entry names a specific, named trap
// ---------------------------------------------------------------------------
//   1. NEVER load a SQLite extension: not through the two extension-loading
//      methods on `DatabaseSync.prototype`, and not through the constructor
//      option that permits them. Both exist, and either one turns this
//      module's caller-supplied FILE ARGUMENT into arbitrary code loading.
//      `anno-seam.test.ts` asserts all three names are absent from this
//      module's code.
//   2. NEVER write a double-quoted SQL string literal. `node:sqlite` disables
//      the double-quoted-string misfeature by default, so
//      `insert into t values ("a")` throws `no such column: "a"` rather than
//      inserting the letter a. Single quotes for literals, or bound parameters.
//   3. NEVER interpolate a value into `exec()`. `exec()` takes NO parameters,
//      which is exactly why everything else goes through `prepare().run()`.
//      There is one unavoidable exception -- `vacuum into '<path>'` cannot be
//      parameterised -- and that path is validated before it arrives and
//      single-quote-escaped by doubling at the one site that builds it.
//   4. NEVER set `journal_mode`, and never set `synchronous`. See the second
//      measured fact above: the mode is persistent in the FILE, so this is not
//      a per-connection preference that a later caller could override.
//   5. NEVER create an FTS5 virtual table. Measured: an indexed
//      `LIKE 'prefix%'` is 2.02 ms against FTS5 `MATCH`'s 2.99 ms, with a
//      121.8 ms index rebuild, over 20,000 rows. Adding FTS5 later is
//      ADDITIVE; removing it is a schema migration. The search surface belongs
//      to `STORE-06` and this module must simply not foreclose it.
//   6. NEVER add an explicit save or flush verb. Durability is this module's
//      responsibility, not the caller's: every accepted write commits before it
//      returns. A save verb is a way for a caller to lose data by forgetting.
//   7. NEVER import either host/container path-translation seam. The store file
//      is container-side; a host-translated path would let a store write land
//      on the HOST filesystem, silently, outside the workspace. That is
//      precisely the failure the closed consumer set in
//      `hostpath-consumers.test.ts` exists to prevent, and this module's
//      absence from it is asserted there rather than merely stated here.
//   8. NEVER cache a derived index, census or xref on disk. A cached
//      derivation is a second truth that can disagree with the rows; see
//      `anno-index.ts`'s trap 2.
//   9. NEVER turn the contradicted-comment report into an error or a refusal,
//      and never widen the rule to "any comment at the address". Both changes
//      look like tightening and are the opposite. A REFUSAL would push a caller
//      toward deleting the comment to get the retype through, converting a
//      reported loss into a silent one -- the exact outcome the report exists to
//      prevent (`STORE-03`). A WIDENED rule would fire on every retype of a
//      commented range, and a report that fires every time is a report nobody
//      reads, so the one case that matters stops being noticed (`STORE-01`).
//  10. NEVER prune the snapshot ring INSIDE the write transaction, and never
//      let a revert fall back to the nearest retained revision. A filesystem
//      unlink is not part of the transaction, so pruning inside it means a
//      rollback leaves a POINTER ROW AIMED AT A FILE THAT IS ALREADY GONE --
//      the one failure direction the revert path cannot survive. Pruning after
//      the commit inverts that failure deliberately: a kill in the window
//      between the commit and the prune leaves EXTRA files, which are harmless
//      and reconcilable by revision number. The file is deleted before its
//      pointer row for the same reason -- the opposite order can produce the
//      bad state and this one cannot. And a revert that SUBSTITUTES the nearest
//      retained revision for the one asked for changes the caller's intent with
//      nothing recording that it happened, so a revert past the bound is
//      refused BY NAME instead (`STORE-04`).
import { closeSync, copyFileSync, existsSync, fsyncSync, mkdirSync, openSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { buildPaintIndex, type PaintIndex } from "./anno-index.ts";
import {
  assertAccessKind,
  assertCommentText,
  assertCommentType,
  assertDataType,
  assertEnumName,
  assertLabelKind,
  assertLegalLabel,
  assertRangeShape,
  AnnoCommentGradeError,
  AnnoLabelError,
  AnnoStoreCorruptError,
  AnnoStoreError,
  AnnoStorePathError,
  AnnoStoreStaleRevisionError,
  AnnoTypeError,
  MAX_SNAPSHOT_REVISIONS,
  parseStoreAddress,
  parseVariantKey,
  storePathWithinWorkspace,
  SCHEMA_VERSION,
  type CommentRow,
  type CommentType,
  type ContradictedComment,
  type DataType,
  type LabelKind,
  type LabelRow,
  type ProjectEnumRow,
  type RangeRow,
  type ScopeRow,
  type XrefAccessKind,
  type XrefRow,
} from "./anno-types.ts";
import { CONFIDENCE_GRADES, parseConfidencePrefix, R2000ConfidenceGradeError } from "./r2000-confidence.ts";

/**
 * What every write entry point in this module returns.
 *
 * `changed` is the ONLY signal that distinguishes a no-op from a real edit. The
 * revision is NOT that signal: every accepted write advances it by exactly one,
 * including a write that turned out to be identical to what was already stored.
 * That is deliberate -- a repeated identical write is accepted rather than
 * refused (an agent re-running an annotation pass must not have to diff first),
 * and the revision has to advance for the snapshot ring to stay meaningful.
 */
export interface AnnoWriteResult {
  revision: number;
  changed: boolean;
}

/**
 * The complete on-disk schema, created in full at first open so
 * `SCHEMA_VERSION` stays 1 and no later work alters an on-disk shape.
 *
 * `anno_xref` and its `access_kind` column exist from the very first write.
 * Two requirement texts look like they conflict here and do not: `STORE-05`
 * requires the column, while the cross-reference criterion forbids CACHING a
 * DERIVED cross-reference on disk. Both hold at once -- the table exists, and
 * only non-derivable references (hand-asserted, or resolved from something
 * outside the bytes) are ever stored in it. Derivation stays on the query
 * side. This paragraph exists so a later reader does not have to rediscover
 * that the two criteria appeared to disagree.
 *
 * Every range, label, comment and xref row carries a nullable `bank` column
 * that NOTHING in this module interprets and no code path reads except the row
 * mapper in `listRanges()`. It is reserved, and every row written today has it
 * null.
 */
export const DDL = `
create table anno_meta (
  id integer primary key check(id = 1),
  schema_version integer not null,
  revision integer not null
);

create table anno_range (
  id integer primary key autoincrement,
  start integer not null,
  end_inclusive integer not null,
  data_type text not null,
  bank integer
);

create table anno_label (
  id integer primary key autoincrement,
  address integer not null,
  name text not null unique,
  kind text not null,
  bank integer
);

create table anno_comment (
  id integer primary key autoincrement,
  address integer not null,
  comment_type text not null,
  text text not null,
  bank integer,
  unique(address, comment_type)
);

create table anno_scope (
  id integer primary key autoincrement,
  start integer not null,
  end_inclusive integer not null
);

create table anno_enum (
  id integer primary key autoincrement,
  name text not null unique,
  variants text not null,
  description text
);

create table anno_xref (
  id integer primary key autoincrement,
  from_address integer not null,
  to_address integer not null,
  access_kind text not null,
  bank integer
);

create table anno_snapshot (
  revision integer primary key,
  path text not null
);

create index anno_range_end_start on anno_range(end_inclusive, start);
create index anno_label_address on anno_label(address);
create index anno_comment_address on anno_comment(address);
create index anno_xref_to on anno_xref(to_address);
`;

/** An open store: the connection, the resolved store path, and the directory
 * the snapshots sibling lives in. The handle is owned by its CALLER -- this
 * module holds no connection of its own, so two concurrent callers cannot
 * observe each other's connection state. */
export interface AnnoStoreHandle {
  db: DatabaseSync;
  path: string;
  dir: string;
}

/** The ONE `commit` statement in this module. Both the first-open schema
 * creation and the write sequence route through here, so the single site a
 * durability proof plants its violation against is unique and unambiguous. */
function commitTransaction(db: DatabaseSync): void {
  db.exec("commit");
}

/** The one place a filesystem path is spliced into SQL text, because
 * `vacuum into` cannot be parameterised and `exec()` takes no parameters
 * (trap 3). Refuses a path carrying a NUL or a newline outright rather than
 * escaping it, then doubles single quotes. */
function sqlQuotedPath(path: string): string {
  if (/[\0\n\r]/.test(path)) {
    throw new AnnoStorePathError(`store path ${JSON.stringify(path)} contains a control character -- refusing to splice it into SQL text`, {
      path,
    });
  }
  return `'${path.replace(/'/g, "''")}'`;
}

/** `fsync` a file or a directory by path. Directory fsync is what makes a
 * `rename` durable, not just visible. */
function fsyncPath(path: string): void {
  const fd = openSync(path, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/**
 * Opens the store at `path`, creating and initialising it when it does not
 * exist yet, and REFUSING it when it exists but is not a store this build can
 * speak to.
 *
 * When `workspaceRoot` is supplied the path is confined to it first. The
 * fresh-versus-existing decision is made with `existsSync` BEFORE the
 * connection is constructed, because constructing `DatabaseSync` creates the
 * file -- after that point there is no way left to ask the question.
 *
 * `timeout` is set so a genuinely concurrent writer WAITS for the lock rather
 * than failing `SQLITE_BUSY` on contact. No other connection option is passed:
 * see traps 1 and 4.
 */
export function openStore(path: string, opts: { workspaceRoot?: string } = {}): AnnoStoreHandle {
  const resolved = opts.workspaceRoot === undefined ? resolve(path) : storePathWithinWorkspace(path, opts.workspaceRoot);
  const fresh = !existsSync(resolved);
  const db = new DatabaseSync(resolved, { timeout: 5_000 });
  const handle: AnnoStoreHandle = { db, path: resolved, dir: dirname(resolved) };

  if (fresh) {
    db.exec("begin immediate");
    db.exec(DDL);
    db.prepare("insert into anno_meta(id, schema_version, revision) values (1, ?, 0)").run(SCHEMA_VERSION);
    commitTransaction(db);
    return handle;
  }

  let meta: { schema_version: number; revision: number } | undefined;
  try {
    meta = db.prepare("select schema_version, revision from anno_meta where id = 1").get() as
      | { schema_version: number; revision: number }
      | undefined;
  } catch (e) {
    db.close();
    throw new AnnoStoreCorruptError(
      `${resolved}: not an annotation store (${(e as Error).message}) -- refusing to treat a truncated, empty or foreign file as an empty store, ` +
        `because "the annotations are gone" and "there are no annotations" must not read the same. This is the branch a ZERO-LENGTH file takes: ` +
        `SQLite opens it, reports integrity_check ok and returns an empty sqlite_master, so the refusal has to be the store's own.`,
      { path: resolved },
    );
  }

  if (!meta) {
    db.close();
    throw new AnnoStoreCorruptError(
      `${resolved}: annotation store has no meta row -- refusing to treat a truncated, empty or foreign file as an empty store, ` +
        `because "the annotations are gone" and "there are no annotations" must not read the same`,
      { path: resolved },
    );
  }

  if (meta.schema_version !== SCHEMA_VERSION) {
    db.close();
    throw new AnnoStoreCorruptError(`${resolved}: schema_version ${meta.schema_version}, expected ${SCHEMA_VERSION}`, { path: resolved });
  }

  const check = db.prepare("pragma integrity_check").all() as { integrity_check: string }[];
  if (check.length !== 1 || check[0].integrity_check !== "ok") {
    db.close();
    throw new AnnoStoreCorruptError(`${resolved}: integrity_check reported ${JSON.stringify(check)}`, { path: resolved });
  }

  return handle;
}

/** Closes the connection. Safe to call once per handle. */
export function closeStore(handle: AnnoStoreHandle): void {
  handle.db.close();
}

/** The store's current revision, read from `anno_meta`. */
export function currentRevision(handle: AnnoStoreHandle): number {
  const row = handle.db.prepare("select revision from anno_meta where id = 1").get() as { revision: number } | undefined;
  if (!row) {
    throw new AnnoStoreCorruptError(`${handle.path}: annotation store has no meta row`, { path: handle.path });
  }
  return row.revision;
}

/** Where the pre-mutation snapshot of `revision` lives: a `snapshots/` sibling
 * directory of the store file, holding one file per revision. The extension
 * and the layout are decided here on purpose -- changing either later is a
 * user-visible file rename. */
export function snapshotPathFor(handle: AnnoStoreHandle, revision: number): string {
  return join(handle.dir, "snapshots", `r${revision}.db`);
}

/** What `oldestRetainedRevision()` reports when the ring holds NO snapshot at
 * all -- a freshly created store, or one restored from its very first
 * snapshot. Named rather than left as a bare `-1` for the same reason
 * `anno-index.ts`'s `NO_ROW` is named: a sentinel a caller has to recognise
 * from its VALUE is a sentinel a caller gets wrong. Reporting
 * `currentRevision()` in that state instead would be a LIE -- `revertTo`
 * refuses the current revision too, because no snapshot records it. */
export const NO_RETAINED_REVISION = -1;

/**
 * The smallest revision the snapshot ring still holds, or
 * `NO_RETAINED_REVISION` when it holds none. This is the FLOOR of what
 * `revertTo` can still honour.
 *
 * Read from the pointer ROWS rather than computed as
 * `currentRevision() - MAX_SNAPSHOT_REVISIONS`. The two agree on a store that
 * has only ever been written forward, and they DISAGREE after a revert -- the
 * arithmetic would then name a revision no row records, and a floor naming an
 * unrevertable revision is worse than no floor at all.
 */
export function oldestRetainedRevision(handle: AnnoStoreHandle): number {
  const row = handle.db.prepare("select min(revision) as oldest from anno_snapshot").get() as { oldest: number | null } | undefined;
  if (!row || row.oldest === null) return NO_RETAINED_REVISION;
  return row.oldest;
}

/**
 * Bounds the `snapshots/` sibling directory at `MAX_SNAPSHOT_REVISIONS` by
 * deleting every snapshot older than the newest `MAX_SNAPSHOT_REVISIONS`
 * revisions -- THE FILE FIRST, ITS POINTER ROW SECOND.
 *
 * MUST BE CALLED AFTER THE COMMIT AND OUTSIDE THE TRANSACTION. Trap 10 in the
 * module header carries the whole argument; the short form is that an unlink is
 * not transactional, so the ordering around the commit CHOOSES which failure a
 * kill in the window produces -- and the choice made here is "extra files"
 * over "a pointer row aimed at a deleted file".
 *
 * The bound itself lives in `anno-types.ts` and is imported, never copied: a
 * second literal would drift the moment the first one is edited, silently, and
 * a store whose pruning bound disagrees with its declared bound has a revert
 * history shorter than it says it has.
 */
export function pruneSnapshots(handle: AnnoStoreHandle): void {
  const floor = currentRevision(handle) - MAX_SNAPSHOT_REVISIONS;
  const doomed = handle.db.prepare("select revision, path from anno_snapshot where revision < ? order by revision").all(floor) as {
    revision: number;
    path: string;
  }[];

  for (const row of doomed) {
    // Swallowed on purpose, and ONLY here: an interrupted earlier prune may
    // already have removed this file, and a prune that threw on an
    // already-absent file would make the store unwritable after a single kill
    // in the window. The pointer-row delete below is deliberately NOT
    // swallowed -- a pointer row surviving its file is the exact state trap 10
    // exists to prevent, so it has to be loud.
    try {
      rmSync(row.path, { force: true });
    } catch {
      // deliberately ignored -- see above
    }
    handle.db.prepare("delete from anno_snapshot where revision = ?").run(row.revision);
  }
}

/**
 * The write sequence. THE ORDER BELOW IS LOAD-BEARING and is not a style
 * choice:
 *
 *   1. read the current revision;
 *   2. refuse immediately if the caller based its edit on a different one;
 *   3. take the pre-mutation snapshot with `vacuum into`;
 *   4. `begin immediate`;
 *   5. compare-and-swap the revision, requiring exactly one changed row;
 *   6. insert the snapshot pointer row for the PRE-mutation revision;
 *   7. run the caller's mutation;
 *   8. commit -- once, through the module's one commit site;
 *   9. prune the snapshot ring -- AFTER the commit and OUTSIDE the
 *      transaction, because an unlink is not transactional (trap 10).
 *
 * WHY THE SNAPSHOT PRECEDES THE MUTATION: reverse the two and a kill inside
 * the window leaves a DURABLE MUTATION WITH NO SNAPSHOT -- an edit that can
 * never be undone. In the present order a kill inside the window leaves an
 * orphan snapshot FILE, which is harmless and reconcilable by revision number.
 *
 * WHY THE POINTER ROW IS INSERTED INSIDE THE SAME TRANSACTION AS THE MUTATION:
 * that is the mechanism that makes the durability claim and the revert claim
 * fail TOGETHER from one planted violation instead of separately. Removing the
 * commit at step 8 loses the mutation and the pointer row at once, so a single
 * combined test reddens in both halves.
 */
function runWriteSequence<T>(
  handle: AnnoStoreHandle,
  mutate: (db: DatabaseSync) => T,
  doCommit: boolean,
  baseRevision?: number,
): { revision: number; result: T } {
  const rev = currentRevision(handle);

  if (baseRevision !== undefined && baseRevision !== rev) {
    throw new AnnoStoreStaleRevisionError(
      `refusing the write: base revision ${baseRevision} is not the current on-disk revision ${rev}`,
      { baseRevision, currentRevision: rev },
    );
  }

  const snapPath = snapshotPathFor(handle, rev);
  mkdirSync(dirname(snapPath), { recursive: true });
  // `vacuum into` refuses an existing target, and a revision number can recur
  // after a revert, so the stale file is removed rather than colliding.
  rmSync(snapPath, { force: true });
  handle.db.exec(`vacuum into ${sqlQuotedPath(snapPath)}`);

  handle.db.exec("begin immediate");

  const cas = handle.db.prepare("update anno_meta set revision = revision + 1 where id = 1 and revision = ?").run(rev);
  if (Number(cas.changes) !== 1) {
    handle.db.exec("rollback");
    throw new AnnoStoreStaleRevisionError(`refusing the write: the revision moved under us (expected ${rev})`, {
      baseRevision: rev,
    });
  }

  handle.db.prepare("insert into anno_snapshot(revision, path) values (?, ?)").run(rev, snapPath);

  // A REFUSAL RAISED INSIDE THE MUTATION MUST ROLL THE WHOLE SEQUENCE BACK.
  // Several entry points below refuse from inside their mutation on purpose,
  // because the refusal needs to read rows -- a label name already bound to a
  // different address is the load-bearing case, and reading it outside the
  // transaction would open a window in which a concurrent writer binds the
  // name between the read and the insert. Without this rollback the thrown
  // refusal would leave the transaction OPEN with the revision compare-and-swap
  // already applied, so `currentRevision()` on this same connection would report
  // an advanced revision for a write that was refused, and every later statement
  // would run inside a transaction nobody meant to start.
  //
  // The inner catch is deliberately silent: if the rollback itself fails there
  // is nothing useful to do with that second error, and reporting it would
  // replace the caller's actual refusal with a confusing one.
  let result: T;
  try {
    result = mutate(handle.db);
  } catch (mutationError) {
    try {
      handle.db.exec("rollback");
    } catch {
      // deliberately ignored -- see above
    }
    throw mutationError;
  }

  if (doCommit) {
    commitTransaction(handle.db);
    // STEP 9, AND ITS POSITION IS THE POINT: the prune runs AFTER the commit
    // and OUTSIDE the transaction (trap 10). It sits inside the `doCommit`
    // branch because a sequence that never commits has no accepted write to
    // bound.
    pruneSnapshots(handle);
  }

  return { revision: rev + 1, result };
}

/** Runs `mutate` as one durable, revision-advancing write. */
export function applyWrite<T>(
  handle: AnnoStoreHandle,
  mutate: (db: DatabaseSync) => T,
  opts: { baseRevision?: number } = {},
): { revision: number; result: T } {
  return runWriteSequence(handle, mutate, true, opts.baseRevision);
}

/**
 * The same sequence WITHOUT the commit. This exists for exactly one reason and
 * no other: the durability-and-revert proof's planted violation is "remove the
 * commit", and a planting that drives the IDENTICAL code path is stronger
 * evidence than a hand-copied variant that can drift out of agreement with the
 * real one.
 *
 * Its only caller is a spawned, test-only helper that is deliberately absent
 * from `package.json`'s `files[]`, and `anno-seam.test.ts` asserts that no
 * shipped module other than this one so much as names it.
 */
export function applyWriteWithoutCommit<T>(
  handle: AnnoStoreHandle,
  mutate: (db: DatabaseSync) => T,
  opts: { baseRevision?: number } = {},
): { revision: number; result: T } {
  return runWriteSequence(handle, mutate, false, opts.baseRevision);
}

function insertRange(db: DatabaseSync, start: number, endInclusive: number, dataType: string): void {
  db.prepare("insert into anno_range(start, end_inclusive, data_type, bank) values (?, ?, ?, ?)").run(start, endInclusive, dataType, null);
}

/**
 * SPLIT-AND-PRESERVE. Every row overlapping the new range is deleted, and the
 * parts of it that fall OUTSIDE the new range are re-inserted with their
 * original type -- the head when the old row started earlier, the tail when it
 * ended later.
 *
 * Why not the obvious `filter()`-and-insert (delete every overlapping row,
 * insert the new one): it is accidentally RIGHT on the total-typed-bytes
 * metric for four of the five overlap cases, and it LOSES BYTES in the
 * fully-contained case -- an old row strictly wider than the new one on both
 * sides has both its head and its tail discarded. That case is therefore the
 * detector, and a proof that exercises only the other four proves nothing.
 *
 * Returns whether the mutation CHANGED anything. Typing a range that is already
 * exactly that range with exactly that type is a no-op: it leaves the single
 * existing row alone and reports `false`. The revision still advances, because
 * every accepted write advances it by exactly one -- so `changed` is the ONLY
 * signal that distinguishes a no-op, and the revision is never that signal.
 */
function retype(db: DatabaseSync, start: number, endInclusive: number, dataType: DataType): boolean {
  const overlapping = db
    .prepare("select id, start, end_inclusive, data_type from anno_range where end_inclusive >= ? and start <= ? order by id")
    .all(start, endInclusive) as { id: number; start: number; end_inclusive: number; data_type: string }[];

  if (
    overlapping.length === 1 &&
    overlapping[0].start === start &&
    overlapping[0].end_inclusive === endInclusive &&
    overlapping[0].data_type === dataType
  ) {
    return false;
  }

  for (const row of overlapping) {
    db.prepare("delete from anno_range where id = ?").run(row.id);
    if (row.start < start) {
      insertRange(db, row.start, start - 1, row.data_type);
    }
    if (row.end_inclusive > endInclusive) {
      insertRange(db, endInclusive + 1, row.end_inclusive, row.data_type);
    }
  }

  insertRange(db, start, endInclusive, dataType);
  return true;
}

/** The two grade brackets that assert the addresses are CODE, and the two that
 * assert they are DATA -- derived from the five-grade vocabulary by their
 * token's suffix rather than restated here. The vocabulary has exactly one home
 * and this module is not it: a second copy of the four bracket strings would
 * drift the moment the first one is edited, and the drift is silent. */
const CODE_GRADE_BRACKETS: readonly string[] = CONFIDENCE_GRADES.filter((grade) => grade.token.endsWith("-code")).map((grade) => grade.bracket);
const DATA_GRADE_BRACKETS: readonly string[] = CONFIDENCE_GRADES.filter((grade) => grade.token.endsWith("-data")).map((grade) => grade.bracket);

/**
 * Does retyping a region to `dataType` make a comment graded `gradeBracket`
 * FALSE? The ONE definition of "contradicted" in this repo; the query path below
 * calls it, and so does its test, so the rule and its proof cannot drift.
 *
 * The rule:
 *   * a code-asserting grade is contradicted by any data type other than
 *     `code` -- the comment says the bytes execute and the retype says they do
 *     not;
 *   * a data-asserting grade is contradicted by `code`, and by nothing else --
 *     every other member of the vocabulary is another way of saying data, so a
 *     `byte` region retyped to `word` leaves such a comment true;
 *   * the no-reliable-interpretation grade, and an ungraded comment
 *     (`gradeBracket` null), are NEVER contradicted. Neither one asserted
 *     anything a retype could falsify.
 *
 * THE DECISION, WITH THE ALTERNATIVE NOT TAKEN. "Contradicts" means the retype
 * makes the comment FALSE -- not merely that a comment happens to sit at a
 * retyped address. The broad reading -- any comment at all at a retyped address
 * is contradicted -- was considered and REJECTED, because it would make every
 * retype of a commented range report, and a report that fires every time is a
 * report nobody reads. The report exists so a human notices the one case that
 * matters. A later reader must NOT "simplify" this predicate back into the broad
 * form; that is a regression wearing the clothes of a cleanup.
 */
export function contradictedCommentsFor(gradeBracket: string | null, dataType: DataType): boolean {
  if (gradeBracket === null) return false;
  if (CODE_GRADE_BRACKETS.includes(gradeBracket)) return dataType !== "code";
  if (DATA_GRADE_BRACKETS.includes(gradeBracket)) return dataType === "code";
  return false;
}

/**
 * Every stored comment inside `start..endInclusive` that retyping to `dataType`
 * makes false, in ascending address order.
 *
 * MUST RUN INSIDE THE RETYPE'S OWN TRANSACTION. Run outside it, a comment
 * written by another connection between the query and the retype would be
 * missed, and the report would be silently short by one -- which is the failure
 * mode a report is supposed to close, not open. `begin immediate` serialises the
 * pair.
 *
 * A malformed bracket token is REFUSED here, never read as ungraded: swallowing
 * it would quietly exempt that comment from the report forever.
 */
function collectContradictedComments(db: DatabaseSync, start: number, endInclusive: number, dataType: DataType): ContradictedComment[] {
  const rows = db
    .prepare("select address, comment_type, text from anno_comment where address >= ? and address <= ? order by address, comment_type")
    .all(start, endInclusive) as { address: number; comment_type: string; text: string }[];

  const out: ContradictedComment[] = [];
  for (const row of rows) {
    let grade: string | null;
    try {
      const parsed = parseConfidencePrefix(row.text);
      grade = parsed.grade === null ? null : parsed.grade.bracket;
    } catch (e) {
      if (e instanceof R2000ConfidenceGradeError) {
        throw new AnnoCommentGradeError(
          `the comment at address ${row.address} ($${row.address.toString(16).padStart(4, "0")}) carries a bracket token the store cannot ` +
            `interpret, so it cannot say whether typing that address as ${dataType} makes the comment false: ${e.message}`,
          { comment: row.text, cause: e },
        );
      }
      throw e;
    }
    if (contradictedCommentsFor(grade, dataType)) {
      out.push({
        address: row.address,
        commentType: row.comment_type as CommentType,
        text: row.text,
        grade: grade as string,
        contradictedBy: dataType,
      });
    }
  }
  return out;
}

/**
 * What `setDataType()` returns: `AnnoWriteResult` plus the comments this retype
 * has just made false.
 *
 * `contradictedComments` IS ALWAYS PRESENT AND OFTEN EMPTY, never absent, so a
 * caller reads the field unconditionally instead of guarding on it.
 *
 * THE CONTRADICTION IS DATA ON A SUCCESSFUL RESULT -- never an error, never a
 * refusal, and there is no option to make it one. See the module header's trap 9
 * for why: a refusal would push a caller toward deleting the comment to get the
 * retype through, which converts a REPORTED loss into a SILENT one.
 */
export interface SetDataTypeResult extends AnnoWriteResult {
  contradictedComments: readonly ContradictedComment[];
}

/**
 * Types the inclusive range `start..endInclusive` as `dataType`, preserving
 * whatever the overlapping rows said about the addresses outside it.
 *
 * Every argument is validated before any SQL runs -- the transport validates
 * nothing (see `anno-types.ts`'s header).
 */
export function setDataType(
  handle: AnnoStoreHandle,
  args: { start: number | string; endInclusive: number | string; dataType: unknown; baseRevision?: number },
): SetDataTypeResult {
  const dataType = assertDataType(args.dataType);
  // ORDERING IS LOAD-BEARING: `parseStoreAddress` owns the STRING forms only
  // -- what base is this text in, and is it a form the store accepts at all --
  // while `assertRangeShape` owns range-ness for both forms. A numeric
  // argument is therefore passed straight through, so an end of 65536 or -1 is
  // refused as a RANGE SHAPE rather than as an unparseable address. Collapsing
  // the two makes a caller unable to tell "that is not an address" from "those
  // two ends do not make a range".
  const start = typeof args.start === "string" ? parseStoreAddress(args.start, { what: "start" }) : args.start;
  const endInclusive = typeof args.endInclusive === "string" ? parseStoreAddress(args.endInclusive, { what: "endInclusive" }) : args.endInclusive;
  assertRangeShape(start, endInclusive, dataType);

  const { revision, result } = applyWrite(
    handle,
    (db) => {
      // The query precedes the mutation and shares its transaction: the rows it
      // reads are the ones the retype is about to contradict, and no concurrent
      // writer can slip a comment in between the two.
      const contradictedComments = collectContradictedComments(db, start, endInclusive, dataType);
      const changed = retype(db, start, endInclusive, dataType);
      return { changed, contradictedComments };
    },
    { baseRevision: args.baseRevision },
  );
  return { revision, changed: result.changed, contradictedComments: result.contradictedComments };
}

/** Every typed range, in insertion order. The `bank` column is read HERE and
 * nowhere else in this module. */
export function listRanges(handle: AnnoStoreHandle): RangeRow[] {
  const rows = handle.db.prepare("select id, start, end_inclusive, data_type, bank from anno_range order by id").all() as {
    id: number;
    start: number;
    end_inclusive: number;
    data_type: string;
    bank: number | null;
  }[];
  return rows.map((row) => ({
    id: row.id,
    start: row.start,
    endInclusive: row.end_inclusive,
    dataType: row.data_type as DataType,
    bank: row.bank,
  }));
}

/**
 * Restores the whole store to the state it had at `revision`, by replacing the
 * store file with that revision's snapshot. Whole-store restore rather than an
 * inverted changeset because the changeset INVERSION primitive is the one part
 * of `node:sqlite`'s session surface that is missing (see the third measured
 * fact in the header).
 *
 * The replacement is atomic from a reader's point of view: the snapshot is
 * copied to a staging file beside the store, both the file and its directory
 * are fsynced, and only then is the staging file renamed over the store path.
 * Returns a NEW handle -- the old one is closed and must not be reused.
 */
export function revertTo(handle: AnnoStoreHandle, revision: number): AnnoStoreHandle {
  const pointer = handle.db.prepare("select path from anno_snapshot where revision = ?").get(revision) as { path: string } | undefined;

  if (!pointer) {
    const available = (handle.db.prepare("select revision from anno_snapshot order by revision").all() as { revision: number }[]).map(
      (row) => row.revision,
    );
    const oldest = oldestRetainedRevision(handle);
    throw new AnnoStoreError(
      `cannot revert to revision ${revision}: no snapshot is retained for it. The oldest retained revision is ` +
        `${oldest === NO_RETAINED_REVISION ? "(none -- the ring is empty)" : oldest} and the current revision is ${currentRevision(handle)}; ` +
        `the ring holds at most ${MAX_SNAPSHOT_REVISIONS} revisions. The request is REFUSED rather than substituting the nearest retained ` +
        `revision, because returning a revision other than the one asked for changes the caller's intent with nothing recording that it ` +
        `happened. Available revisions: ${available.length === 0 ? "(none)" : available.join(", ")}`,
    );
  }

  const snapPath = pointer.path;
  const storePath = handle.path;
  const dir = handle.dir;

  closeStore(handle);

  const staging = `${storePath}.revert-${process.pid}-${revision}`;
  copyFileSync(snapPath, staging);
  fsyncPath(staging);
  fsyncPath(dir);
  renameSync(staging, storePath);
  fsyncPath(dir);

  return openStore(storePath);
}

/** The paint index over this store's current rows, rebuilt from the rows every
 * time (`anno-index.ts` traps 2 and 4). A convenience over
 * `buildPaintIndex(listRanges(handle))` -- it holds nothing between calls. */
export function paintIndexOf(handle: AnnoStoreHandle): PaintIndex {
  return buildPaintIndex(listRanges(handle));
}

// ---------------------------------------------------------------------------
// The five annotation kinds: labels, comments, scopes, project enums and
// cross-references. Every entry point below VALIDATES FIRST and only then goes
// through `applyWrite`, so no SQL runs on an unvalidated argument. Every
// statement is `prepare().run()` with bound parameters -- `exec()` stays
// restricted to the fixed `DDL`, the transaction keywords and the one escaped
// `vacuum into` (trap 3).
// ---------------------------------------------------------------------------

/**
 * Binds `name` to `address` with label kind `kind`.
 *
 * THE COLLISION IS REFUSED, NEVER RESOLVED. A name already bound to a
 * DIFFERENT address throws `AnnoLabelError` naming the name and both addresses.
 * It is not rebound, not suffixed and not sanitised: see `anno-types.ts` trap 7
 * for the hazard, which is that any of those silently merges or moves a name a
 * human deliberately chose, with nothing recording that it happened.
 *
 * The DDL's `unique(name)` constraint is a SECOND LINE OF DEFENCE and is
 * deliberately not the observable refusal. The named error is thrown first, from
 * inside the mutation's own transaction so a concurrent writer cannot bind the
 * name between the read and the insert; the constraint only catches a path that
 * bypassed this function entirely.
 *
 * The name-versus-name comparison is EXACT BYTE EQUALITY -- the SQL `=` on a
 * text column with the default (binary) collation, matching the definition
 * `assertLegalLabel()`'s doc comment states. No case folding, no Unicode
 * normalisation, no trimming.
 */
export function setLabel(
  handle: AnnoStoreHandle,
  args: { address: number | string; name: unknown; kind: unknown; baseRevision?: number },
): AnnoWriteResult {
  const address = parseStoreAddress(args.address, { what: "address" });
  const name = assertLegalLabel(args.name);
  const kind: LabelKind = assertLabelKind(args.kind);

  const { revision, result } = applyWrite(
    handle,
    (db) => {
      const existing = db.prepare("select id, address, kind from anno_label where name = ?").get(name) as
        | { id: number; address: number; kind: string }
        | undefined;

      if (existing && existing.address !== address) {
        throw new AnnoLabelError(
          `label name ${JSON.stringify(name)} is already bound to address ${existing.address} ` +
            `($${existing.address.toString(16).padStart(4, "0")}) and cannot also name address ${address} ` +
            `($${address.toString(16).padStart(4, "0")}) -- the write is REFUSED rather than rebinding the name or inventing a variant of it, ` +
            `because either would silently merge or move a name somebody chose on purpose`,
          { identifier: name, reason: "name already bound to a different address", existingAddress: existing.address, requestedAddress: address },
        );
      }

      if (existing) {
        if (existing.kind === kind) return false;
        db.prepare("update anno_label set kind = ? where id = ?").run(kind, existing.id);
        return true;
      }

      db.prepare("insert into anno_label(address, name, kind, bank) values (?, ?, ?, ?)").run(address, name, kind, null);
      return true;
    },
    { baseRevision: args.baseRevision },
  );
  return { revision, changed: result };
}

/** Every label, in ascending `id` order. One of the row mappers that read the
 * reserved `bank` column -- see `listRanges()` for why nothing else may. */
export function listLabels(handle: AnnoStoreHandle): LabelRow[] {
  const rows = handle.db.prepare("select id, address, name, kind, bank from anno_label order by id").all() as {
    id: number;
    address: number;
    name: string;
    kind: string;
    bank: number | null;
  }[];
  return rows.map((row) => ({
    id: row.id,
    address: row.address,
    name: row.name,
    kind: row.kind as LabelKind,
    bank: row.bank,
  }));
}

/**
 * Stores `text` as the `commentType` comment at `address`, replacing whatever
 * was there. One comment per `(address, comment_type)` pair -- the DDL's own
 * unique constraint -- so the two placements coexist at one address and a
 * repeated write of the same placement replaces rather than accumulates.
 *
 * A byte-identical repeat reports `changed:false`: it is accepted, not refused,
 * and the revision still advances (see `AnnoWriteResult`).
 */
export function setComment(
  handle: AnnoStoreHandle,
  args: { address: number | string; commentType: unknown; text: unknown; baseRevision?: number },
): AnnoWriteResult {
  const address = parseStoreAddress(args.address, { what: "address" });
  const commentType: CommentType = assertCommentType(args.commentType);
  const text = assertCommentText(args.text);

  const { revision, result } = applyWrite(
    handle,
    (db) => {
      const existing = db.prepare("select id, text from anno_comment where address = ? and comment_type = ?").get(address, commentType) as
        | { id: number; text: string }
        | undefined;

      if (existing) {
        if (existing.text === text) return false;
        db.prepare("update anno_comment set text = ? where id = ?").run(text, existing.id);
        return true;
      }

      db.prepare("insert into anno_comment(address, comment_type, text, bank) values (?, ?, ?, ?)").run(address, commentType, text, null);
      return true;
    },
    { baseRevision: args.baseRevision },
  );
  return { revision, changed: result };
}

/** Every comment, in ascending `id` order. Reads the reserved `bank` column. */
export function listComments(handle: AnnoStoreHandle): CommentRow[] {
  const rows = handle.db.prepare("select id, address, comment_type, text, bank from anno_comment order by id").all() as {
    id: number;
    address: number;
    comment_type: string;
    text: string;
    bank: number | null;
  }[];
  return rows.map((row) => ({
    id: row.id,
    address: row.address,
    commentType: row.comment_type as CommentType,
    text: row.text,
    bank: row.bank,
  }));
}

/**
 * Adds a lexical scope over the inclusive range `start..endInclusive`.
 *
 * NO NESTING, and that is a faithful mirror rather than a shortcut: the schema
 * this store mirrors says in as many words that nested scopes are not supported
 * (`r2000-tools.ts:320-324`). Inventing nesting here would create annotations no
 * exporter downstream can express.
 *
 * The shape check passes a NON-SPLIT data type on purpose. `assertRangeShape()`
 * carries the split-table even-count rule, and a scope is not a table -- a
 * three-byte routine is a perfectly good scope. Passing `"byte"` selects the
 * two rules that do apply (both ends inside the address space; the end not below
 * the start) and none of the ones that do not.
 *
 * ADDITIVE, matching the verb's own name in the schema (`add_scope`): two
 * identical calls produce two rows. There is no unique constraint on
 * `anno_scope` to make it otherwise, and collapsing duplicates here would be
 * this module inventing a policy the surface does not have.
 */
export function addScope(
  handle: AnnoStoreHandle,
  args: { start: number | string; endInclusive: number | string; baseRevision?: number },
): AnnoWriteResult {
  const start = parseStoreAddress(args.start, { what: "start" });
  const endInclusive = parseStoreAddress(args.endInclusive, { what: "endInclusive" });
  assertRangeShape(start, endInclusive, "byte");

  const { revision } = applyWrite(
    handle,
    (db) => {
      db.prepare("insert into anno_scope(start, end_inclusive) values (?, ?)").run(start, endInclusive);
      return true;
    },
    { baseRevision: args.baseRevision },
  );
  return { revision, changed: true };
}

/** Every scope, in ascending `id` order. `anno_scope` has no `bank` column --
 * a scope is a lexical region, not a memory view. */
export function listScopes(handle: AnnoStoreHandle): ScopeRow[] {
  const rows = handle.db.prepare("select id, start, end_inclusive from anno_scope order by id").all() as {
    id: number;
    start: number;
    end_inclusive: number;
  }[];
  return rows.map((row) => ({ id: row.id, start: row.start, endInclusive: row.end_inclusive }));
}

/**
 * Validates one project enum's variants mapping and returns it with its KEYS
 * VERBATIM.
 *
 * Every key goes through `parseVariantKey()`, which accepts exactly the forms
 * the schema names -- decimal, `0x`/`$` hex, `0b`/`%` binary -- and refuses
 * anything else. The parsed VALUE is used only to detect two keys naming the
 * same number, which is refused: `"64"` and `"$40"` in one mapping would mean
 * two variant names for one value, and nothing downstream could say which one
 * was meant.
 *
 * The keys are NOT canonicalised. A caller that wrote `"$40"` reads back
 * `"$40"`, because round-tripping by value is the store's contract and a
 * rewritten key is a value the caller never supplied.
 *
 * Every variant NAME is checked as an identifier, for the same reason a label
 * name is: it is emitted as a symbol downstream, so garbage accepted here
 * becomes an export failure a long way from its cause.
 */
function validatedVariants(variants: unknown): Record<string, string> {
  if (typeof variants !== "object" || variants === null || Array.isArray(variants)) {
    throw new AnnoTypeError(`enum variants ${JSON.stringify(variants)} is not a mapping of numeric-string keys to variant names`, {
      dataType: variants,
    });
  }
  const out: Record<string, string> = {};
  const seenValues = new Map<number, string>();
  for (const [key, value] of Object.entries(variants as Record<string, unknown>)) {
    const numeric = parseVariantKey(key);
    const alreadyAt = seenValues.get(numeric);
    if (alreadyAt !== undefined) {
      throw new AnnoTypeError(
        `enum variant keys ${JSON.stringify(alreadyAt)} and ${JSON.stringify(key)} both name the value ${numeric} -- refusing a mapping ` +
          `with two names for one value, because nothing downstream could say which was meant`,
        { dataType: key },
      );
    }
    seenValues.set(numeric, key);
    out[key] = assertEnumName(value);
  }
  return out;
}

/** Bounds a project enum's free-text description with the same byte bound
 * comment text carries, and without the semicolon rule -- a description is not
 * assembler comment text, so a leading `';'` is merely a character. */
function validatedDescription(description: unknown): string | null {
  if (description === undefined || description === null) return null;
  return assertCommentText(description, { what: "description", allowLeadingSemicolon: true });
}

function readEnumRow(db: DatabaseSync, name: string): { id: number; name: string; variants: string; description: string | null } | undefined {
  return db.prepare("select id, name, variants, description from anno_enum where name = ?").get(name) as
    | { id: number; name: string; variants: string; description: string | null }
    | undefined;
}

/**
 * Creates a project-local enum.
 *
 * A byte-identical repeat is a no-op reporting `changed:false`, so re-running a
 * generation pass is safe. A DIFFERENT enum under an existing name is REFUSED
 * with `AnnoLabelError` naming the collision, rather than overwritten -- the
 * same rule as a label, for the same reason.
 *
 * THERE IS NO DELETE VERB, here or anywhere in this module, and that is a
 * decision rather than an omission: the delete tool on the surface this store
 * mirrors has zero callers, and a regenerated enum set replaces an old one
 * through create-then-update. A delete verb whose only exercise is a test is a
 * data-loss path with no user.
 */
export function createProjectEnum(
  handle: AnnoStoreHandle,
  args: { name: unknown; variants: unknown; description?: unknown; baseRevision?: number },
): AnnoWriteResult {
  const name = assertEnumName(args.name);
  const variants = validatedVariants(args.variants);
  const description = validatedDescription(args.description);
  const variantsJson = JSON.stringify(variants);

  const { revision, result } = applyWrite(
    handle,
    (db) => {
      const existing = readEnumRow(db, name);
      if (existing) {
        if (existing.variants === variantsJson && existing.description === description) return false;
        throw new AnnoLabelError(
          `project enum ${JSON.stringify(name)} already exists with different contents -- the write is REFUSED rather than overwriting it. ` +
            `Use the update entry point, which replaces the variants mapping wholesale and says so.`,
          { identifier: name, reason: "enum name already in use with different contents" },
        );
      }
      db.prepare("insert into anno_enum(name, variants, description) values (?, ?, ?)").run(name, variantsJson, description);
      return true;
    },
    { baseRevision: args.baseRevision },
  );
  return { revision, changed: result };
}

/**
 * Updates a project-local enum: renames it, replaces its variants mapping, and
 * replaces its description, in any combination.
 *
 * THE VARIANTS MAPPING IS REPLACED WHOLESALE when one is supplied, matching the
 * schema's own words ("complete updated variants mapping"). It is not merged: a
 * merge would make a variant impossible to REMOVE, since there would be no way
 * to express its absence.
 *
 * A rename onto a name another enum already holds is refused, not merged.
 */
export function updateProjectEnum(
  handle: AnnoStoreHandle,
  args: { name: unknown; newName?: unknown; variants?: unknown; description?: unknown; baseRevision?: number },
): AnnoWriteResult {
  const name = assertEnumName(args.name);
  const newName = args.newName === undefined ? undefined : assertEnumName(args.newName);
  const variants = args.variants === undefined ? undefined : validatedVariants(args.variants);
  const variantsJson = variants === undefined ? undefined : JSON.stringify(variants);
  const description = args.description === undefined ? undefined : validatedDescription(args.description);

  const { revision, result } = applyWrite(
    handle,
    (db) => {
      const existing = readEnumRow(db, name);
      if (!existing) {
        throw new AnnoLabelError(`project enum ${JSON.stringify(name)} does not exist, so there is nothing to update`, {
          identifier: name,
          reason: "no such enum",
        });
      }
      if (newName !== undefined && newName !== name) {
        const clash = readEnumRow(db, newName);
        if (clash) {
          throw new AnnoLabelError(
            `cannot rename project enum ${JSON.stringify(name)} to ${JSON.stringify(newName)}: that name is already held by another enum -- ` +
              `the rename is REFUSED rather than merging two enums into one`,
            { identifier: newName, reason: "rename target already in use" },
          );
        }
      }

      const nextName = newName ?? existing.name;
      const nextVariants = variantsJson ?? existing.variants;
      const nextDescription = description === undefined ? existing.description : description;
      if (nextName === existing.name && nextVariants === existing.variants && nextDescription === existing.description) {
        return false;
      }

      db.prepare("update anno_enum set name = ?, variants = ?, description = ? where id = ?").run(
        nextName,
        nextVariants,
        nextDescription,
        existing.id,
      );
      return true;
    },
    { baseRevision: args.baseRevision },
  );
  return { revision, changed: result };
}

/** Every project enum, in ascending `id` order, with its variants mapping
 * parsed back out of the single JSON text column. */
export function listProjectEnums(handle: AnnoStoreHandle): ProjectEnumRow[] {
  const rows = handle.db.prepare("select id, name, variants, description from anno_enum order by id").all() as {
    id: number;
    name: string;
    variants: string;
    description: string | null;
  }[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    variants: JSON.parse(row.variants) as Record<string, string>,
    description: row.description,
  }));
}

/**
 * Records ONE NON-DERIVABLE cross-reference.
 *
 * THIS IS THE C-5 RECONCILIATION, written down here for a reader of the code
 * rather than left in a plan. Two requirement texts look like they conflict:
 * `STORE-05` requires cross-reference rows to carry their access kind from the
 * first write, while the cross-reference criterion requires references to be
 * DERIVED on every query and never cached on disk. Both hold at once, and this
 * entry point is where:
 *
 *   * the table and its `access_kind` column exist from the first write (the
 *     `DDL` above), so `STORE-05` is satisfied structurally;
 *   * the only rows ever written here are references that CANNOT be recovered
 *     from the bytes -- hand-asserted, or resolved from something outside the
 *     program image. The `COMPUTED_JUMP` case is exactly that: a computed
 *     dispatch produces no reference derivable from the bytes at all, which is
 *     why it needs somewhere to live;
 *   * nothing derivable is ever written here. A cached derivation would be a
 *     SECOND ON-DISK TRUTH that can disagree with the range table it came from,
 *     and the disagreement is invisible because both answers look
 *     authoritative. `resolveSplitTargets()` in `anno-types.ts` derives and
 *     returns; it never writes.
 *
 * The positive pin is in `anno-store.test.ts`: typing a `lo_hi_address` range,
 * whose targets are fully derivable from its bytes, leaves this table with zero
 * rows.
 *
 * Two references sharing a `from`/`to` pair but carrying different access kinds
 * are TWO ROWS. They are not merged: `READ` and `WRITE` at one pair of
 * addresses are two different facts, and merging them would invent a third.
 */
export function putXref(
  handle: AnnoStoreHandle,
  args: { fromAddress: number | string; toAddress: number | string; accessKind: unknown; baseRevision?: number },
): AnnoWriteResult {
  const fromAddress = parseStoreAddress(args.fromAddress, { what: "fromAddress" });
  const toAddress = parseStoreAddress(args.toAddress, { what: "toAddress" });
  const accessKind: XrefAccessKind = assertAccessKind(args.accessKind);

  const { revision, result } = applyWrite(
    handle,
    (db) => {
      const existing = db
        .prepare("select id from anno_xref where from_address = ? and to_address = ? and access_kind = ?")
        .get(fromAddress, toAddress, accessKind) as { id: number } | undefined;
      if (existing) return false;
      db.prepare("insert into anno_xref(from_address, to_address, access_kind, bank) values (?, ?, ?, ?)").run(
        fromAddress,
        toAddress,
        accessKind,
        null,
      );
      return true;
    },
    { baseRevision: args.baseRevision },
  );
  return { revision, changed: result };
}

/** Every stored cross-reference, in ascending `id` order. Empty unless
 * something called `putXref()` -- typing a range never puts a row here, and a
 * test pins that. Reads the reserved `bank` column. */
export function listXrefs(handle: AnnoStoreHandle): XrefRow[] {
  const rows = handle.db.prepare("select id, from_address, to_address, access_kind, bank from anno_xref order by id").all() as {
    id: number;
    from_address: number;
    to_address: number;
    access_kind: string;
    bank: number | null;
  }[];
  return rows.map((row) => ({
    id: row.id,
    fromAddress: row.from_address,
    toAddress: row.to_address,
    accessKind: row.access_kind as XrefAccessKind,
    bank: row.bank,
  }));
}
