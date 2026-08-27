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
import { closeSync, copyFileSync, existsSync, fsyncSync, mkdirSync, openSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { buildPaintIndex, type PaintIndex } from "./anno-index.ts";
import {
  assertDataType,
  assertRangeShape,
  AnnoStoreCorruptError,
  AnnoStoreError,
  AnnoStorePathError,
  AnnoStoreStaleRevisionError,
  parseStoreAddress,
  storePathWithinWorkspace,
  SCHEMA_VERSION,
  type DataType,
  type RangeRow,
} from "./anno-types.ts";

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
 *   8. commit -- once, through the module's one commit site.
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

  const result = mutate(handle.db);

  if (doCommit) {
    commitTransaction(handle.db);
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
 * Returns how many `anno_range` rows the mutation touched (deletes plus
 * inserts).
 */
function retype(db: DatabaseSync, start: number, endInclusive: number, dataType: DataType): number {
  const overlapping = db
    .prepare("select id, start, end_inclusive, data_type from anno_range where end_inclusive >= ? and start <= ? order by id")
    .all(start, endInclusive) as { id: number; start: number; end_inclusive: number; data_type: string }[];

  let touched = 0;
  for (const row of overlapping) {
    db.prepare("delete from anno_range where id = ?").run(row.id);
    touched += 1;
    if (row.start < start) {
      insertRange(db, row.start, start - 1, row.data_type);
      touched += 1;
    }
    if (row.end_inclusive > endInclusive) {
      insertRange(db, endInclusive + 1, row.end_inclusive, row.data_type);
      touched += 1;
    }
  }

  insertRange(db, start, endInclusive, dataType);
  return touched + 1;
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
): { revision: number; changed: number } {
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

  const { revision, result } = applyWrite(handle, (db) => retype(db, start, endInclusive, dataType), {
    baseRevision: args.baseRevision,
  });
  return { revision, changed: result };
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
    throw new AnnoStoreError(
      `cannot revert to revision ${revision}: no snapshot is recorded for it -- available revisions: ${available.length === 0 ? "(none)" : available.join(", ")}`,
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
