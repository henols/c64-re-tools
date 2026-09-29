#!/usr/bin/env node
// anno-store.mts
//
// The ONE module in this repo that names `node:sqlite`. Nothing else may open,
// query or write an annotation store file; every other module reaches the
// store through the functions below.
//
// ONE FILE, ONE PROJECT. A workspace's annotations.db holds exactly one
// project (`soleProjectStore` refuses a file with more). A handle is bound to
// that project's id when it is made, and every read and write below touches
// only that project's rows: no function takes a project id as an argument,
// and there is no cross-project query.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// `node:sqlite` is still marked *active development* on the Node 22 line: its
// surface can change under a patch release, and it emits an
// `ExperimentalWarning` on first load. A dependency with that profile earns a
// blast radius of exactly one file -- and, more to the point, a CONFINEMENT
// THAT IS ASSERTED rather than promised.
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
//     one reason the store has no revert verb. No comment in this repo may claim the session surface is
//     absent, because that is false.
//
// THIS MODULE MUST BE LISTED IN `package.json`'s `files[]`, and the reason is
// NOT the reachability reason `prg-image.mts:30-36` gives for itself. This
// module is not yet reachable from the published entry point's import closure,
// and only one direction was ever asserted mechanically -- every
// REACHABLE module must be listed -- never the converse. The real reason to
// list it: the shipped-module assertion scans `shippedTsModules()`, which is derived
// from `files[]`, so an unlisted module makes that assertion VACUOUS. It would
// pass by scanning a set this file is not in. Copying the reachability sentence
// here would plant a false claim in a brand-new seam header, which is the
// defect `block-class.mts`'s own stale rationale demonstrates.
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO -- each entry names a specific, named trap
// ---------------------------------------------------------------------------
//   1. NEVER load a SQLite extension: not through the two extension-loading
//      methods on `DatabaseSync.prototype`, and not through the constructor
//      option that permits them. Both exist, and either one turns this
//      module's caller-supplied FILE ARGUMENT into arbitrary code loading.
//   2. NEVER write a double-quoted SQL string literal. `node:sqlite` disables
//      the double-quoted-string misfeature by default, so
//      `insert into t values ("a")` throws `no such column: "a"` rather than
//      inserting the letter a. Single quotes for literals, or bound parameters.
//   3. NEVER interpolate a value into `exec()`. `exec()` takes NO parameters,
//      which is exactly why everything else goes through `prepare().run()`.
//      `exec()` runs only the fixed `DDL` and the transaction keywords.
//   4. NEVER set `journal_mode`, and never set `synchronous`. See the second
//      measured fact above: the mode is persistent in the FILE, so this is not
//      a per-connection preference that a later caller could override.
//   5. NEVER create an FTS5 virtual table. Measured: an indexed
//      `LIKE 'prefix%'` is 2.02 ms against FTS5 `MATCH`'s 2.99 ms, with a
//      121.8 ms index rebuild, over 20,000 rows. Adding FTS5 later is
//      ADDITIVE; removing it is a schema migration. The search surface belongs
//      elsewhere and this module must simply not foreclose it.
//   6. NEVER add an explicit save or flush verb. Durability is this module's
//      responsibility, not the caller's: every accepted write commits before it
//      returns. A save verb is a way for a caller to lose data by forgetting.
//   7. NEVER translate the store path. A translated path would let a store
//      write land outside the workspace, silently.
//   8. NEVER cache a derived index, census or xref on disk. A cached
//      derivation is a second truth that can disagree with the rows; see
//      `anno-index.mts`'s trap 2.
//   9. NEVER turn the contradicted-comment report into an error or a refusal,
//      and never widen the rule to "any comment at the address". Both changes
//      look like tightening and are the opposite. A REFUSAL would push a caller
//      toward deleting the comment to get the retype through, converting a
//      reported loss into a silent one -- the exact outcome the report exists to
//      prevent. A WIDENED rule would fire on every retype of a
//      commented range, and a report that fires every time is a report nobody
//      reads, so the one case that matters stops being noticed.
//  10. NEVER prepare a statement on a project table outside `scopeOf()`. The
//      scoped statement binds the handle's project id as `$pid` and refuses
//      any SQL that does not name it; a raw `db.prepare` on a project table
//      reads or writes EVERY project's rows. Only `anno_meta` and
//      `anno_project` are reached through the raw connection.
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync, type SQLInputValue, type StatementResultingChanges } from "node:sqlite";

import { buildPaintIndex, type PaintIndex } from "./anno-index.mts";
import {
  assertAccessKind,
  assertCommentText,
  assertCommentType,
  assertDataType,
  assertEnumName,
  assertEvidSourceBank,
  assertLabelKind,
  assertLegalLabel,
  assertRangeShape,
  assertRunIdentityDigest,
  assertRunIdentitySeed,
  isSplitDataType,
  splitEntryAddressPairs,
  ADDRESS_MAX,
  ADDRESS_MIN,
  AnnoCommentError,
  AnnoCommentGradeError,
  AnnoLabelError,
  AnnoProjectError,
  AnnoRangeShapeError,
  AnnoSplitRemainderError,
  AnnoStoreCorruptError,
  AnnoStoreError,
  AnnoStorePathError,
  AnnoStoreStaleRevisionError,
  AnnoTypeError,
  assertProjectId,
  parseStoreAddress,
  parseVariantKey,
  storePathWithinWorkspace,
  SCHEMA_VERSION,
  type CommentRow,
  type CommentType,
  type ContradictedComment,
  type DataType,
  type EvidExecRow,
  type EvidSourceBank,
  type ExcludedRangeRow,
  type LabelKind,
  type LabelRow,
  type EnumUsageRow,
  type ObservedRunRow,
  type ProjectEnumRow,
  type RangeRow,
  type ScopeRow,
  type SplitDataType,
  type SplitTableReinterpretation,
  type SplitTableSurvivor,
  type XrefAccessKind,
  type XrefRow,
} from "./anno-types.mts";
import { CONFIDENCE_GRADES, parseConfidencePrefix, AnnoConfidenceGradeError } from "./anno-confidence.mts";
// Imported for ONE purpose: the family predicate the guarded regions below use to
// decide "rethrow unchanged" versus "wrap". Every `Anno*Error` in `anno-types.mts`
// already extends it, so nothing new enters the module graph -- `anno-types.mts`
// imports the same class from the same file.
import { ViceError } from "./vice-errors.mts";

/**
 * What every write entry point in this module returns.
 *
 * `changed` is the ONLY signal that distinguishes a no-op from a real edit. The
 * revision is NOT that signal: every accepted write advances it by exactly one,
 * including a write that turned out to be identical to what was already stored.
 * That is deliberate -- a repeated identical write is accepted rather than
 * refused (an agent re-running an annotation pass must not have to diff first),
 * and a caller's `base_revision` must see every accepted write.
 */
export interface AnnoWriteResult {
  revision: number;
  changed: boolean;
}

/**
 * The complete on-disk schema, created in full at first open.
 *
 * THE REVERSAL THIS RECORDS, kept rather than deleted because a rationale that
 * became false is evidence. This paragraph used to read "created in full at
 * first open so `SCHEMA_VERSION` stays 1 and no later work alters an on-disk
 * shape". The FIRST half is still true and is why every table below exists from
 * the very first write. The SECOND half became false: `anno_snapshot` carried a
 * `path text not null` column holding the snapshot's ABSOLUTE location, and two
 * destructive consequences were reproduced against committed code -- two stores
 * in one directory sharing one ring and a directory rename plus one
 * write destroying the whole revert history. The column is DROPPED at
 * `SCHEMA_VERSION` 2 and the location is computed from the handle by
 * `snapshotDirFor()` at every read and every delete, so there is no persisted
 * absolute string left for a second namespace -- a bind mount seen from the
 * host and from a container is this repo's own everyday case -- to disagree
 * with. `anno-types.mts`'s `SCHEMA_VERSION` doc comment carries the whole
 * argument and the reason a version-1 store is refused rather than migrated.
 *
 * THE VERSION 2 DDL CHANGE TOUCHED ONLY `anno_snapshot`. Every other table's
 * column list below, including the reserved and uninterpreted `bank` columns,
 * was byte-identical to version 1's.
 *
 * THAT SENTENCE IS KEPT AND SCOPED RATHER THAN DELETED, because at
 * `SCHEMA_VERSION` 3 it stopped being the whole truth: version 3 (2026-08-29) ADDS
 * one table, `anno_enum_usage`, and its index. It changes no existing table's
 * column list, so the scoped claim above still holds of every table version 2
 * had. The version 3 table associates ONE address with ONE `anno_enum` row by
 * enum **id** -- see `anno-types.mts`'s `SCHEMA_VERSION` doc comment for what
 * the bump buys, why no migration arm was written, and the basis measured on
 * the day that cost was accepted.
 *
 * `anno_xref` and its `access_kind` column exist from the very first write.
 * Two requirement texts look like they conflict here and do not: one
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
 *
 * AT `SCHEMA_VERSION` 4, ONE MORE TABLE IS ADDED:
 * `anno_evid_exec`, the durable runtime-execution evidence table. See
 * `anno-types.mts`'s `SCHEMA_VERSION` doc comment for what the bump buys and
 * the decided, dated fate of an existing version-3 store (`reaffirm-refusal`
 * -- no migration arm). `anno_evid_exec` carries NO `bank` column and NO
 * nullable column at all: unlike the annotation tables above, every field on
 * a row here is a fact the runtime evidence layer is licensed to assert, or
 * the row does not exist. Its run-identity key is the bare triple
 * `(image_sha256, argv_digest, seed)`, selected by a live A/B that measured
 * `no-perturbation` from instrumentation -- there is deliberately no
 * `run_class` column.
 *
 * AT `SCHEMA_VERSION` 5, ONE MORE TABLE IS ADDED:
 * `anno_excluded_range`, the durable record of a user-requested exclusion --
 * its extent and the reason the user gave. See `anno-types.mts`'s
 * `SCHEMA_VERSION` doc comment for what the bump buys, why a table was chosen
 * over a column on `anno_range`, and the decided, dated fate of an existing
 * version-4 store (`reaffirm-refusal` -- no migration arm). `reason` is `not
 * null`: an exclusion with no reason is a hole with a row in front of it.
 * `anno_excluded_range` carries NO `bank` column, for the same reason
 * `ExcludedRangeRow`'s own doc comment gives -- an exclusion is a statement
 * about the subject program, not a memory view.
 *
 * AT `SCHEMA_VERSION` 6 EVERY TABLE IS KEYED BY PROJECT.
 * `anno_project` holds the project's id and its revision, and
 * `anno_meta` keeps only the schema version. Every other table carries
 * `project_id`, and every UNIQUE constraint and index leads with it. A
 * workspace's file holds one project (`soleProjectStore`).
 * `anno_snapshot` is gone with the snapshot ring. See `anno-types.mts`'s
 * `SCHEMA_VERSION` doc comment.
 */
export const DDL = `
create table anno_meta (
  id integer primary key check(id = 1),
  schema_version integer not null
);

create table anno_project (
  project_id text primary key,
  revision integer not null
);

create table anno_range (
  id integer primary key autoincrement,
  project_id text not null,
  start integer not null,
  end_inclusive integer not null,
  data_type text not null,
  bank integer
);

create table anno_label (
  id integer primary key autoincrement,
  project_id text not null,
  address integer not null,
  name text not null,
  kind text not null,
  bank integer,
  unique(project_id, name)
);

create table anno_comment (
  id integer primary key autoincrement,
  project_id text not null,
  address integer not null,
  comment_type text not null,
  text text not null,
  bank integer,
  unique(project_id, address, comment_type)
);

create table anno_scope (
  id integer primary key autoincrement,
  project_id text not null,
  start integer not null,
  end_inclusive integer not null
);

create table anno_enum (
  id integer primary key autoincrement,
  project_id text not null,
  name text not null,
  variants text not null,
  description text,
  unique(project_id, name)
);

create table anno_enum_usage (
  id integer primary key autoincrement,
  project_id text not null,
  address integer not null,
  enum_id integer not null references anno_enum(id),
  bank integer,
  unique(project_id, address, bank)
);

create table anno_xref (
  id integer primary key autoincrement,
  project_id text not null,
  from_address integer not null,
  to_address integer not null,
  access_kind text not null,
  bank integer
);

create table anno_evid_exec (
  id integer primary key autoincrement,
  project_id text not null,
  image_sha256 text not null,
  argv_digest text not null,
  seed text not null,
  address integer not null,
  source_bank text not null,
  unique(project_id, image_sha256, argv_digest, seed, address, source_bank)
);

create table anno_excluded_range (
  id integer primary key autoincrement,
  project_id text not null,
  start integer not null,
  end_inclusive integer not null,
  reason text not null,
  unique(project_id, start, end_inclusive)
);

create index anno_range_end_start on anno_range(project_id, end_inclusive, start);
create index anno_label_address on anno_label(project_id, address);
create index anno_comment_address on anno_comment(project_id, address);
create index anno_scope_start on anno_scope(project_id, start);
create index anno_enum_usage_address on anno_enum_usage(project_id, address);
create index anno_xref_to on anno_xref(project_id, to_address);
create index anno_evid_exec_address on anno_evid_exec(project_id, address);
create index anno_excluded_range_start on anno_excluded_range(project_id, start);
`;

/** An open annotation database: the connection and its resolved path. It is
 * owned by its CALLER -- this module holds no connection of its own. */
export interface AnnoDatabase {
  db: DatabaseSync;
  path: string;
}

/**
 * An open database bound to ONE project. `db` is the raw connection; store
 * functions never prepare a project-table statement on it directly (trap 10),
 * they go through `scopeOf(handle)`, which binds `projectId`.
 */
export interface AnnoStoreHandle {
  db: DatabaseSync;
  path: string;
  projectId: string;
}

/** The ONE `commit` statement in this module. Both the first-open schema
 * creation and the write sequence route through here, so the single site a
 * durability proof plants its violation against is unique and unambiguous. */
function commitTransaction(db: DatabaseSync): void {
  db.exec("commit");
}

/** A prepared statement whose `$pid` parameter is already bound. */
export interface ScopedStatement {
  run(...params: SQLInputValue[]): StatementResultingChanges;
  get(...params: SQLInputValue[]): unknown;
  all(...params: SQLInputValue[]): unknown[];
}

/** The only way a store function prepares a statement on a project table. */
export interface ScopedDb {
  prepare(sql: string): ScopedStatement;
}

/**
 * Wraps the connection so every statement is bound to `projectId`.
 *
 * A statement that does not name `$pid` is REFUSED at prepare time rather than
 * run. SQLite binds an unsupplied named parameter as NULL without complaint, so
 * an unscoped statement would not fail loudly on its own: a write would insert
 * rows no project owns, and a read would quietly return nothing.
 */
function scoped(db: DatabaseSync, projectId: string): ScopedDb {
  const named = { pid: projectId };
  return {
    prepare(sql: string): ScopedStatement {
      if (!sql.includes("$pid")) {
        throw new AnnoStoreError(`refusing an unscoped statement -- every project-table statement must bind $pid: ${sql}`);
      }
      const statement = db.prepare(sql);
      return {
        run: (...params) => statement.run(named, ...params),
        get: (...params) => statement.get(named, ...params),
        all: (...params) => statement.all(named, ...params),
      };
    },
  };
}

/** The scoped statement factory for `handle`'s project. */
export function scopeOf(handle: AnnoStoreHandle): ScopedDb {
  return scoped(handle.db, handle.projectId);
}

/**
 * Opens the annotation database at `path`, creating and initialising it when it does not
 * exist yet, and REFUSING it when it exists but is not a store this build can
 * speak to.
 *
 * A `workspaceRoot` IS REQUIRED unless the caller explicitly asks for the
 * unconfined path with `unconfinedModuleDerivedPath: true`, and the inversion is
 * deliberate. Confinement used to be opt-IN, which made the mitigation
 * for the one unvalidated input this module's own header calls out the one a
 * caller could forget -- and two of this store's recorded blockers were confinement
 * escapes. The escape exists for exactly one shape: a path the CALLER derived
 * itself rather than took from an argument, where there is nothing left to
 * confine. Every such call site carries a one-line comment naming the derived
 * value that produced its path.
 *
 * When `workspaceRoot` is supplied the path is confined to it first. Whether
 * the file existed is asked with `existsSync` BEFORE the connection is
 * constructed, because constructing `DatabaseSync` creates the file. Whether
 * to create the schema is then decided under the write lock
 * (`initialiseUnderWriteLock`), so racing first writers agree.
 *
 * `timeout` is set so a genuinely concurrent writer WAITS for the lock rather
 * than failing `SQLITE_BUSY` on contact. No other connection option is passed:
 * see traps 1 and 4.
 *
 * `mustExist` EXISTS FOR EXACTLY ONE PURPOSE: JUDGING A FILE THE CALLER IS
 * ABOUT TO INSTALL, and its two halves are inseparable. This function's default
 * behaviour is to CREATE and initialise an absent store -- which is the right
 * default for opening a project's store and precisely the wrong one for asking
 * "is this snapshot image a store I can speak to", because a judge that can
 * create or modify the thing it judges is not a judge: it would manufacture the
 * very empty store it was asked to detect and then report it healthy. So with
 * `mustExist` set, an absent path is REFUSED BY NAME before `new DatabaseSync`
 * is constructed, which makes the create-and-initialise branch below
 * unreachable, and the connection is opened `readOnly`.
 *
 * READ-ONLY IS NOT BELT-AND-BRACES ON THE EXISTENCE TEST -- it closes the
 * residual window the existence test leaves. Between the `existsSync` above and
 * the constructor below the file can be unlinked; a writable open would then
 * create it, and the judgement would be about a file this call had just made
 * up. Measured on this host at plan time: a `readOnly` open of an absent path
 * REFUSES with `unable to open database file` rather than creating it. Nothing
 * downstream is duplicated for this option -- the `anno_meta` read, the
 * `schema_version` comparison and `pragma integrity_check` are REUSED
 * UNCHANGED, because those four checks together ARE the definition of "an
 * annotation store this build can speak to" and a second list of them would be
 * a second answer to the one question this option exists to answer once.
 */
export function openAnnoDatabase(
  path: string,
  opts: { workspaceRoot?: string; mustExist?: boolean; unconfinedModuleDerivedPath?: boolean } = {},
): AnnoDatabase {
  // CONFINEMENT IS THE DEFAULT, AND THE ESCAPE IS A WORD A GREP CAN FIND.
  // `anno-types.mts`'s header names the three things nothing upstream
  // validates -- "an address of 65536, a misspelled data type, and a store path
  // pointing outside the workspace all look identical to the transport" -- and
  // this was the only one of the three whose mitigation a caller could simply
  // forget. Two of this project's own review findings were confinement
  // escapes.
  //
  // REFUSED BEFORE THE PATH IS RESOLVED AND LONG BEFORE `new DatabaseSync`, for
  // the same reason `mustExist` is refused where it is and recorded in its own
  // comment: this function's default behaviour is to CREATE the file, so after
  // the constructor there is no longer a question to ask -- the store would
  // already exist wherever the argument pointed.
  if (opts.workspaceRoot === undefined && opts.unconfinedModuleDerivedPath !== true) {
    throw new AnnoStorePathError(
      `${path}: refusing to open an annotation store without a workspace root. The MCP transport validates NOTHING -- ` +
        `\`vice-proxy.ts\`'s raw-schema validator is \`validate: (value) => ({ value })\` -- so an unconfined store path is a store file ` +
        `created wherever the caller's argument pointed. Pass { workspaceRoot } to confine the path, or ` +
        `{ unconfinedModuleDerivedPath: true } if and only if THIS MODULE derived the path itself.`,
      { path },
    );
  }

  const resolved = opts.workspaceRoot === undefined ? resolve(path) : storePathWithinWorkspace(path, opts.workspaceRoot);
  const fresh = !existsSync(resolved);

  // REFUSED BEFORE THE CONNECTION IS CONSTRUCTED, and the position is the whole
  // point: `new DatabaseSync` on an absent path CREATES the file, so after that
  // line there is no way left to ask the question -- and the answer would be
  // "yes, a healthy empty store", about a file this call invented.
  if (opts.mustExist === true && fresh) {
    throw new AnnoStoreError(
      `${resolved}: cannot open an annotation store here -- the file does not exist, and this open was asked to JUDGE an existing image ` +
        `rather than create one. An absent image is refused rather than initialised, because a judge that creates the thing it judges ` +
        `would report the empty store it just made as healthy.`,
      { data: { path: resolved } },
    );
  }

  // WRAPPED, AND THE CLASS IS DELIBERATE. Two reproduced inputs -- a path that
  // IS a directory, and a path whose parent directory does not exist -- both
  // throw a bare `unable to open database file` here, with no path in the
  // message and outside the `ViceError` family that every other refusal in this
  // module belongs to. `AnnoStorePathError` rather than a new class, because
  // both cases say the same thing `storePathWithinWorkspace` already says:
  // this is not a place a store can live.
  let db: DatabaseSync;
  try {
    db = opts.mustExist === true ? new DatabaseSync(resolved, { readOnly: true, timeout: 5_000 }) : new DatabaseSync(resolved, { timeout: 5_000 });
  } catch (e) {
    throw new AnnoStorePathError(`${resolved}: cannot open an annotation store here (${(e as Error).message})`, { path: resolved });
  }
  const adb: AnnoDatabase = { db, path: resolved };

  if (opts.mustExist !== true) {
    // WRAPPED FOR THE CONNECTION, NOT ONLY FOR THE MESSAGE: an unwrapped
    // failure would leave both the connection and the transaction open, and
    // the caller could reach neither.
    try {
      initialiseUnderWriteLock(db, fresh);
    } catch (e) {
      rollBackConnectionQuietly(db);
      db.close();
      throw new AnnoStoreError(`${resolved}: failed to initialise a fresh annotation store (${(e as Error).message})`);
    }
  }

  let meta: { schema_version: number } | undefined;
  try {
    meta = db.prepare("select schema_version from anno_meta where id = 1").get() as { schema_version: number } | undefined;
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
    // NAMES THE REMEDY AND DENIES NOTHING IS LOST. This build refuses rather than upgrades -- see
    // `anno-types.mts`'s `SCHEMA_VERSION` doc comment for the decided,
    // dated reason -- and the refusal happens BEFORE any write, so the
    // file on disk is exactly what it was a moment ago: its labels,
    // comments and enums are not lost, only unreadable by this build.
    throw new AnnoStoreCorruptError(
      `${resolved}: schema_version ${meta.schema_version}, expected ${SCHEMA_VERSION} -- refusing to open rather than upgrade. This file is ` +
        `left exactly as it was: nothing on it is read, rewritten or deleted by this refusal. Open it with a build whose SCHEMA_VERSION is ` +
        `${meta.schema_version} to read it (see anno-types.mts's SCHEMA_VERSION doc comment for what changed at each version), or hand-copy ` +
        `its rows into a fresh store at this build's version.`,
      { path: resolved },
    );
  }

  // THE LAST KNOWN FAMILY ESCAPE IN THIS FUNCTION. The two blocks either
  // side of this one are already wrapped, and for the same two reasons: an
  // unwrapped failure here leaks the CONNECTION as well as escaping the
  // `ViceError` family, so the caller loses the file handle with no way to
  // reach it. The shape deliberately matches those two -- close, then refuse
  // with `AnnoStoreCorruptError` naming the path -- because a store whose
  // integrity check cannot even RUN is not a store this build can speak to,
  // which is the same fact the non-`ok` branch below reports.
  let check: { integrity_check: string }[];
  try {
    check = db.prepare("pragma integrity_check").all() as { integrity_check: string }[];
  } catch (e) {
    db.close();
    throw new AnnoStoreCorruptError(`${resolved}: integrity_check could not be run at all (${(e as Error).message})`, { path: resolved });
  }
  if (check.length !== 1 || check[0].integrity_check !== "ok") {
    db.close();
    throw new AnnoStoreCorruptError(`${resolved}: integrity_check reported ${JSON.stringify(check)}`, { path: resolved });
  }

  return adb;
}

/** True when the file already holds the store's own `anno_meta` table.
 * Throws when the file is not a SQLite database at all. */
function hasMetaTable(db: DatabaseSync): boolean {
  const row = db.prepare("select count(*) as n from sqlite_master where type = 'table' and name = 'anno_meta'").get() as { n: number };
  return row.n > 0;
}

function rollBackConnectionQuietly(db: DatabaseSync): void {
  try {
    db.exec("rollback");
  } catch {
    // no open transaction, or a second error: the first one is the one to report
  }
}

/**
 * Creates the schema when the file holds none yet, deciding under the write
 * lock. Two first writers racing on an absent file both reach this point;
 * the second one waits on `begin immediate`, then sees the first one's
 * committed `anno_meta` and creates nothing. A caller that opens the file
 * while a first writer is still initialising it waits the same way, instead
 * of reading the half-made file as a corrupt one.
 *
 * `fresh` says the file did not exist before this open. Only then is the
 * schema created: a file that existed and still holds no store after the
 * wait is a truncated or foreign file, and the checks after this refuse it.
 * A file that is not a SQLite database at all is left to those checks too.
 *
 * Residual: a file another process has created but not yet locked (the few
 * statements between its constructor and its `begin immediate`) still reads
 * as a file with no store.
 */
function initialiseUnderWriteLock(db: DatabaseSync, fresh: boolean): void {
  try {
    if (hasMetaTable(db)) return;
  } catch {
    return;
  }
  db.exec("begin immediate");
  if (!hasMetaTable(db) && fresh) {
    db.exec(DDL);
    db.prepare("insert into anno_meta(id, schema_version) values (1, ?)").run(SCHEMA_VERSION);
    commitTransaction(db);
    return;
  }
  db.exec("rollback");
}

/** Closes the database's connection. Safe to call once. */
export function closeAnnoDatabase(adb: AnnoDatabase): void {
  adb.db.close();
}

/** This project's revision, read from `anno_project`. An id with no row is
 * refused by name, never read as revision 0: that would report an empty project
 * for one whose rows are gone. */
function readProjectRevision(handle: AnnoStoreHandle): number {
  const row = handle.db.prepare("select revision from anno_project where project_id = ?").get(handle.projectId) as
    | { revision: number }
    | undefined;
  if (!row) {
    throw new AnnoProjectError(
      `${handle.path}: project ${handle.projectId} is not in this annotation database -- refusing to read it as an empty project`,
      { projectId: handle.projectId },
    );
  }
  return row.revision;
}

/**
 * Binds an open database to one project. Every store function reads and writes
 * only that project's rows.
 *
 * `create: true` registers an unknown id as a new, empty project, at revision
 * 0. Without it an unknown id is REFUSED: a read must never create a project,
 * because the new, empty project would answer "no annotations" for a project
 * whose rows are gone.
 */
export function projectStore(adb: AnnoDatabase, projectId: unknown, opts: { create?: boolean } = {}): AnnoStoreHandle {
  const id = assertProjectId(projectId);
  const handle: AnnoStoreHandle = { db: adb.db, path: adb.path, projectId: id };
  if (opts.create === true) {
    adb.db.prepare("insert into anno_project(project_id, revision) values (?, 0) on conflict(project_id) do nothing").run(id);
  }
  readProjectRevision(handle);
  return handle;
}

/**
 * Binds a workspace's annotation file to the ONE project it holds.
 *
 * With `create: true` a file with no project gets a new one, under a fresh
 * random id. The check and the insert share one `begin immediate`, so two
 * first writes racing on a new file agree on one project. Without `create`, a
 * file with no project is refused. A file holding more than one project is
 * always refused: picking one would be a guess.
 */
export function soleProjectStore(adb: AnnoDatabase, opts: { create?: boolean } = {}): AnnoStoreHandle {
  const ids = (): string[] =>
    (adb.db.prepare("select project_id from anno_project order by project_id").all() as { project_id: string }[]).map((r) => r.project_id);
  let found = ids();
  if (found.length === 0 && opts.create === true) {
    adb.db.exec("begin immediate");
    try {
      found = ids();
      if (found.length === 0) {
        const minted = randomUUID();
        adb.db.prepare("insert into anno_project(project_id, revision) values (?, 0)").run(minted);
        found = [minted];
      }
    } catch (e) {
      try {
        adb.db.exec("rollback");
      } catch {
        // the original error is the one worth reporting
      }
      throw e;
    }
    commitTransaction(adb.db);
  }
  if (found.length === 0) {
    throw new AnnoProjectError(`${adb.path} holds no annotation project -- refusing to read it as an empty one`);
  }
  if (found.length > 1) {
    throw new AnnoProjectError(
      `${adb.path} holds ${found.length} projects (${found.join(", ")}) -- a workspace's annotation file holds exactly one, and ` +
        "this refuses to pick one.",
    );
  }
  return projectStore(adb, found[0]);
}

/** The project a single-file store opened through `openStore` belongs to. */
export const FILE_STORE_PROJECT_ID = "00000000-0000-4000-8000-000000000000";

/**
 * Opens the database at `path` and binds it to `FILE_STORE_PROJECT_ID`, the
 * one project a single-file store holds. `opts` is `openAnnoDatabase`'s. The
 * project is created unless `mustExist` asks to judge an existing file.
 */
export function openStore(
  path: string,
  opts: { workspaceRoot?: string; mustExist?: boolean; unconfinedModuleDerivedPath?: boolean } = {},
): AnnoStoreHandle {
  const adb = openAnnoDatabase(path, opts);
  try {
    return projectStore(adb, FILE_STORE_PROJECT_ID, { create: opts.mustExist !== true });
  } catch (e) {
    adb.db.close();
    throw e;
  }
}

/** Closes the handle's connection. Safe to call once per handle. */
export function closeStore(handle: AnnoStoreHandle): void {
  handle.db.close();
}

/** The project's current revision. */
export function currentRevision(handle: AnnoStoreHandle): number {
  return readProjectRevision(handle);
}

/**
 * The write sequence, in one transaction. THE ORDER IS LOAD-BEARING:
 *
 *   1. `begin immediate`, which takes the database's write lock;
 *   2. read this project's revision;
 *   3. refuse if the caller based its edit on a different one;
 *   4. advance the revision by one;
 *   5. run the caller's mutation;
 *   6. commit -- once, through the module's one commit site.
 *
 * The revision is read INSIDE the lock, so no other writer can move it between
 * the read and the advance, and a stale `base_revision` is judged against the
 * revision this write actually builds on. The revision belongs to the project:
 * a write to one project never makes another project's `base_revision` stale.
 *
 * EVERY REFUSAL AND EVERY FAILURE ROLLS THE WHOLE TRANSACTION BACK, so a
 * refused write is indistinguishable from one never attempted. Several entry
 * points refuse from inside their mutation on purpose, because the refusal
 * needs to read rows under the same lock -- a label name already bound to a
 * different address is the load-bearing case.
 */
function runWriteSequence<T>(
  handle: AnnoStoreHandle,
  mutate: (db: ScopedDb) => T,
  doCommit: boolean,
  baseRevision?: number,
): { revision: number; result: T } {
  // Inside applyAtomically() the write joins the transaction that is already
  // open: same revision read, same stale check, same advance, and the outer
  // call commits or rolls back everything together.
  const joined = joinedTransactions.has(handle);
  if (!joined) beginWriteTransaction(handle);

  let rev: number;
  let result: T;
  try {
    rev = readProjectRevision(handle);
    assertBaseRevisionMatches(baseRevision, rev);
    handle.db.prepare("update anno_project set revision = revision + 1 where project_id = ?").run(handle.projectId);
    result = mutate(scopeOf(handle));
  } catch (e) {
    if (!joined) rollBackQuietly(handle);
    throw e;
  }

  if (doCommit && !joined) commitOrRollBack(handle, rev);

  return { revision: rev + 1, result };
}

/** Refuses a write whose `baseRevision` is not the revision read under the
 * write lock. `undefined` means an unconditional write. */
function assertBaseRevisionMatches(baseRevision: number | undefined, rev: number): void {
  if (baseRevision !== undefined && baseRevision !== rev) {
    throw new AnnoStoreStaleRevisionError(
      `refusing the write: base revision ${baseRevision} is not the current on-disk revision ${rev}. Nothing was written.`,
      { baseRevision, currentRevision: rev },
    );
  }
}

/** Handles inside `applyAtomically()`: their writes join its transaction. */
const joinedTransactions = new WeakSet<AnnoStoreHandle>();

function beginWriteTransaction(handle: AnnoStoreHandle): void {
  try {
    handle.db.exec("begin immediate");
  } catch (e) {
    throw new AnnoStoreError(
      `${handle.path}: could not start the write transaction (${(e as Error).message}). Nothing has been changed.`,
      { code: (e as { code?: number | string }).code, data: { path: handle.path, step: "begin the write transaction" } },
    );
  }
}

/** Rolls back, deliberately silently: if the rollback itself fails there is
 * nothing useful to do with that second error, and reporting it would
 * replace the caller's actual refusal with a confusing one. */
function rollBackQuietly(handle: AnnoStoreHandle): void {
  try {
    handle.db.exec("rollback");
  } catch {
    // deliberately ignored -- see above
  }
}

/**
 * Commits the open write transaction, which started at revision `rev`.
 *
 * A concurrent READER is enough to make `COMMIT` fail: it needs SQLite's
 * EXCLUSIVE lock, which `begin immediate` never took. The rollback is the
 * repair -- it releases the write lock and undoes the revision advance and the
 * mutation TOGETHER. Its outcome is RECORDED, not assumed: Node's
 * `DatabaseSync` exposes no transaction-state accessor, so this local is the
 * only thing that keeps the message honest.
 */
function commitOrRollBack(handle: AnnoStoreHandle, rev: number): void {
  try {
    commitTransaction(handle.db);
  } catch (e) {
    let rolledBack = true;
    try {
      handle.db.exec("rollback");
    } catch {
      rolledBack = false;
    }
    if (e instanceof ViceError) throw e;
    throw new AnnoStoreError(
      `${handle.path}: the write for revision ${rev + 1} could not be committed (${(e as Error).message}). ` +
        (rolledBack
          ? `Nothing was written and the transaction has been rolled back, so the project is still at revision ${rev}.`
          : `Nothing was written, but the rollback ALSO failed: this connection may still hold an open transaction and the ` +
            `database's write lock, so CLOSE IT AND REOPEN rather than reusing it. The project on disk is still at revision ${rev}.`),
      {
        code: (e as { code?: number | string }).code,
        data: { path: handle.path, revision: rev, rolledBack, step: "committing the write transaction" },
      },
    );
  }
}

/**
 * Runs `body` as ONE transaction: every write it makes on `handle` joins it,
 * and they commit together or not at all. A throw anywhere in `body` rolls
 * all of them back, so the project is left exactly as it was. Each joined
 * write still advances the revision, so the project ends where the same
 * writes made one by one would have left it.
 *
 * Nested calls on the same handle run inside the outer transaction.
 *
 * `baseRevision` is the whole call's compare-and-swap guard: it is compared
 * with the revision read under the write lock, before `body` runs, and a
 * mismatch refuses the call with nothing written.
 */
export function applyAtomically<T>(handle: AnnoStoreHandle, body: () => T, opts: { baseRevision?: number } = {}): T {
  if (joinedTransactions.has(handle)) {
    assertBaseRevisionMatches(opts.baseRevision, readProjectRevision(handle));
    return body();
  }
  beginWriteTransaction(handle);
  joinedTransactions.add(handle);
  let rev: number;
  let result: T;
  try {
    rev = readProjectRevision(handle);
    assertBaseRevisionMatches(opts.baseRevision, rev);
    result = body();
  } catch (e) {
    rollBackQuietly(handle);
    throw e;
  } finally {
    joinedTransactions.delete(handle);
  }
  commitOrRollBack(handle, rev);
  return result;
}

/** Runs `mutate` as one durable, revision-advancing write. */
export function applyWrite<T>(
  handle: AnnoStoreHandle,
  mutate: (db: ScopedDb) => T,
  opts: { baseRevision?: number } = {},
): { revision: number; result: T } {
  return runWriteSequence(handle, mutate, true, opts.baseRevision);
}

/**
 * The same sequence WITHOUT the commit. This exists for exactly one reason and
 * no other: the durability proof's planted violation is "remove the commit",
 * and a planting that drives the IDENTICAL code path is stronger evidence than
 * a hand-copied variant that can drift out of agreement with the real one.
 *
 * Its only caller is a spawned, test-only helper that is deliberately absent
 * from `package.json`'s `files[]`.
 */
export function applyWriteWithoutCommit<T>(
  handle: AnnoStoreHandle,
  mutate: (db: ScopedDb) => T,
  opts: { baseRevision?: number } = {},
): { revision: number; result: T } {
  return runWriteSequence(handle, mutate, false, opts.baseRevision);
}

/**
 * The module's ONE range insert. `bank` is a parameter rather than a hardcoded
 * `null`: a remainder re-inserted by split-and-preserve carries the
 * overlapped row's own `bank` forward, and a newly typed range carries `null`.
 * `bank` is reserved and interpreted by nothing today, which is exactly why a
 * write path that silently dropped it would be an unobservable loss a future
 * banked-memory model inherits.
 */
function insertRange(db: ScopedDb, start: number, endInclusive: number, dataType: string, bank: number | null): void {
  db.prepare("insert into anno_range(project_id, start, end_inclusive, data_type, bank) values ($pid, ?, ?, ?, ?)").run(start, endInclusive, dataType, bank);
}

/** One overlapped row as `retype()` reads it. `bank` is selected because the
 * remainders re-inserted from this row must carry it forward. */
interface OverlappedRangeRow {
  id: number;
  start: number;
  end_inclusive: number;
  data_type: string;
  bank: number | null;
}

/**
 * Would preserving `remainderStart..remainderEndInclusive` as `row`'s own type
 * write a row the store would REFUSE at its own entry point? Returns the
 * refusal to throw, or `null` when the remainder is legal.
 *
 * THE QUESTION IS ASKED THROUGH `assertRangeShape` ITSELF, never through a
 * re-implemented even-count test. That is the whole point: there is then exactly
 * ONE definition of a legal range shape in the repo, and a rule added to it
 * later applies to the store's own writer for free. A second copy of the rule
 * here would drift the moment the first one is edited, and the drift is silent.
 *
 * It is a separate named function rather than inline code so the round-trip
 * invariant in `anno-overlap.test.ts` has a named thing to point at.
 */
function remainderRefusal(
  row: OverlappedRangeRow,
  remainderStart: number,
  remainderEndInclusive: number,
  side: "head" | "tail",
  callerStart: number,
  callerEndInclusive: number,
): AnnoSplitRemainderError | null {
  try {
    assertRangeShape(remainderStart, remainderEndInclusive, row.data_type as DataType);
    return null;
  } catch (e) {
    if (!(e instanceof AnnoRangeShapeError)) throw e;
    // The caller's own boundary on the OFFENDING side. Moving it by one flips
    // the remainder's parity, so the two nearest legal values are one either
    // way -- reported as numbers so the caller does not have to work out which
    // end to move or by how much.
    const boundaryName = side === "head" ? "start" : "endInclusive";
    const boundary = side === "head" ? callerStart : callerEndInclusive;
    const span = remainderEndInclusive - remainderStart + 1;
    const message =
      `typing ${callerStart}..${callerEndInclusive} (${hexRange(callerStart, callerEndInclusive)}) would split range id ${row.id} ` +
      `(${row.start}..${row.end_inclusive}, ${hexRange(row.start, row.end_inclusive)}, ${row.data_type}) and leave a ${side} remainder ` +
      `${remainderStart}..${remainderEndInclusive} (${hexRange(remainderStart, remainderEndInclusive)}) of ${span} byte(s), which is not a ` +
      `shape this store accepts: ${e.message}. The whole retype is refused, so nothing was written. The nearest ${boundaryName} values ` +
      `that would leave an even ${side} are ${boundary - 1} and ${boundary + 1}; alternatively extend the retype to one of the table's ` +
      `own entry boundaries, or retype the whole table to the type you want first.`;
    return new AnnoSplitRemainderError(message, {
      start: remainderStart,
      endInclusive: remainderEndInclusive,
      rowId: row.id,
      rowStart: row.start,
      rowEndInclusive: row.end_inclusive,
      dataType: row.data_type as DataType,
      remainderStart,
      remainderEndInclusive,
      side,
    });
  }
}

/** `$xxxx-$xxxx`, the spelling the rest of this module's messages use. */
function hexRange(start: number, endInclusive: number): string {
  return `$${start.toString(16).padStart(4, "0")}-$${endInclusive.toString(16).padStart(4, "0")}`;
}

/** A canonical key for one entry-address couple, so the intersection below is
 * exact set arithmetic rather than an `includes()` over arrays that compares
 * tuple IDENTITY and would report every pair lost. */
function entryPairKey(pair: readonly [number, number]): string {
  return `${pair[0]}:${pair[1]}`;
}

/**
 * What fragmenting `row` at the caller's range COSTS, or `null` when it costs
 * nothing this record could describe.
 *
 * `null` in exactly two cases, both of them honest:
 *   * the row is not a split-table layout -- asked through `isSplitDataType`,
 *     never through a hand-written list of the four names (`anno-types.mts` trap
 *     2). A non-split row's meaning does not depend on its extent, so there is
 *     nothing to disclose;
 *   * the caller's range leaves NO remainder of this row. Nothing survives, so
 *     no preservation is claimed and none is owed. A full cover is a deletion,
 *     and a deletion is already visible in the row set.
 *
 * Otherwise it consults the SPLIT LAYOUT'S OWN PAIRING RULE through
 * `splitEntryAddressPairs()` -- the same single definition `resolveSplitTargets()`
 * consumes -- once over the ROW's span and once over each remainder's, and
 * reports both sets plus their intersection.
 *
 * IT MUST RUN AFTER `remainderRefusal()` FOR THE SAME ROW AND BEFORE THE FIRST
 * `delete`. After, because a remainder that fails the parity gate is not a
 * remainder this store will ever write and `splitEntryAddressPairs()` would
 * refuse it; before, because a refusal must still cost nothing and an acceptance
 * must never be half-applied.
 *
 * PURE: no I/O, no SQL, no state. It reads the row shape it is handed.
 */
function splitReinterpretation(
  row: OverlappedRangeRow,
  callerStart: number,
  callerEndInclusive: number,
): SplitTableReinterpretation | null {
  const dataType = row.data_type as DataType;
  if (!isSplitDataType(dataType)) return null;

  const hasHead = row.start < callerStart;
  const hasTail = row.end_inclusive > callerEndInclusive;
  if (!hasHead && !hasTail) return null;

  const layout = dataType as SplitDataType;
  const before = splitEntryAddressPairs(row.start, row.end_inclusive, layout);

  // HEAD THEN TAIL, and the order is part of the contract: within one record the
  // survivors read in ascending address order, which is the order the mutation
  // loop below re-inserts them in.
  const survivors: SplitTableSurvivor[] = [];
  const addSurvivor = (start: number, endInclusive: number): void => {
    const pairs = splitEntryAddressPairs(start, endInclusive, layout);
    survivors.push({ start, endInclusive, entryCount: pairs.entryCount, entryPairs: pairs.pairs });
  };
  if (hasHead) addSurvivor(row.start, callerStart - 1);
  if (hasTail) addSurvivor(callerEndInclusive + 1, row.end_inclusive);

  // THE INTERSECTION IS COMPUTED, NOT ASSUMED. It is empty today for every
  // proper fragment -- that is the arithmetic in `retype()`'s DECISION 1 -- but
  // hardcoding the emptiness would make this field a restatement of the layout
  // rather than a measurement of it, and it would stop being true the moment a
  // layout with a different pairing is added.
  const survivingKeys = new Set(survivors.flatMap((s) => s.entryPairs.map(entryPairKey)));
  const preservedEntryPairs = before.pairs.filter((pair) => survivingKeys.has(entryPairKey(pair)));

  const survivorText = survivors
    .map((s) => `${s.start}..${s.endInclusive} (${hexRange(s.start, s.endInclusive)}, ${s.entryCount} entries)`)
    .join(" and ");
  const summary =
    `typing ${callerStart}..${callerEndInclusive} (${hexRange(callerStart, callerEndInclusive)}) fragments range id ${row.id} ` +
    `(${row.start}..${row.end_inclusive}, ${hexRange(row.start, row.end_inclusive)}, ${dataType}, ${before.entryCount} entries), ` +
    `leaving ${survivorText}. A split table pairs byte i with byte n + i, so changing either end re-pairs every entry: ` +
    `${preservedEntryPairs.length} of ${before.entryCount} entry-address pairs are preserved. The surviving row(s) are still legal ` +
    `and still decode -- they decode to DIFFERENT 16-bit values than the ones recorded here.`;

  return {
    rowId: row.id,
    rowStart: row.start,
    rowEndInclusive: row.end_inclusive,
    dataType: layout,
    entryCountBefore: before.entryCount,
    entryPairsBefore: before.pairs,
    survivors,
    preservedEntryPairs,
    summary,
  };
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
 *
 * ---------------------------------------------------------------------------
 * DECISION 1: THE SPLIT-ROW REMAINDER RULE -- TWO OUTCOMES, NEITHER SILENT.
 * ---------------------------------------------------------------------------
 * A split-table row has TWO things that can go wrong when a caller's range
 * fragments it, and this function answers them differently on purpose. The
 * comment and the code below state ONE rule, and both halves of it are here.
 *
 * (1) THE ODD REMAINDER IS REFUSED, and the whole retype is refused with it.
 * A remainder that is not a legal shape for its OWN type -- the
 * odd-byte-count tail of a fragmented split table is the reachable case -- is a
 * row `setDataType` would decline to create and `resolveSplitTargets()` cannot
 * decode. The store never persists a range row it would refuse at its own entry
 * point, by any writer. DEMOTING the illegal remainder to the vocabulary's
 * `undefined` member was considered and REJECTED, because it destroys the
 * recorded split ORIENTATION, which this module's own header calls the one
 * irreversible decision in this area with no field to migrate -- a one-way data
 * decision taken silently on the caller's behalf. Rounding the caller's range
 * outward to an entry boundary is forbidden outright by `anno-types.mts` trap 7.
 *
 * (2) THE EVEN REMAINDER IS ACCEPTED **WITH A REPORT** -- never accepted
 * silently. Parity is not the only thing a fragment can break. A split
 * table pairs byte `i` with byte `n + i`, so an entry's partner is a function of
 * the row's START and its LENGTH, and changing either end re-pairs EVERY entry.
 *
 * THE ARITHMETIC, because it settles the design rather than merely describing
 * it: a surviving fragment of `m` entries pairs its own byte `j` with its own
 * byte `m + j`, which matches an original pair only when `m == n` -- only when
 * the fragment IS the whole row. **No proper fragment preserves a single entry
 * pair, at any boundary, THE MIDPOINT INCLUDED.** So preservation is not
 * something a cleverer boundary rule can recover, and the surviving rows are the
 * dangerous kind of wrong: legal, re-acceptable, decodable, and decoding to
 * different 16-bit values than the ones a human recorded.
 *
 * ANSWER (a) -- REFUSE ANY PARTIAL OVERLAP OF A SPLIT ROW -- WAS WEIGHED AND NOT
 * TAKEN. It is defensible and it is implementable, but it makes split tables
 * editable only WHOLESALE, and the inputs it would refuse are ordinary
 * annotation work: correcting a few bytes inside a table, or trimming a table
 * typed one entry too wide. Split-and-preserve exists for exactly that.
 *
 * WHAT IS TAKEN is answer (b): `splitReinterpretation()` builds one record per
 * fragmented split row, carrying the pairs the row read BEFORE and the pairs
 * each survivor reads AFTER, and `setDataType()` returns it as DATA on a
 * SUCCESSFUL result beside `contradictedComments`. The failing clause was never
 * "a partial overwrite must preserve"; it was "silently un-documenting a
 * previously annotated region is the exact failure the store exists to prevent".
 * Disclosure removes the silence, which is the clause that was actually false.
 *
 * RECORDING THE TABLE'S ORIGINAL EXTENT ON DISK -- so the pairing could be
 * reconstructed later -- WAS REJECTED. It is a new column, therefore a
 * `SCHEMA_VERSION` bump, therefore a one-way decision requiring the older
 * on-disk shape to refuse by name (28-10 P4); and this milestone's one
 * irreversible decision is already spent on the twelve-member vocabulary. The
 * return channel gives the caller the same fact at the only moment it can still
 * act on it, and costs nothing that cannot be reverted.
 *
 * BOTH CHECKS RUN OVER EVERY REMAINDER OF EVERY OVERLAPPING ROW BEFORE THE FIRST
 * `delete`, and the ordering is the guarantee, not a tidiness preference: a
 * refusal must cost nothing observable, and leaning on the transaction's
 * rollback to undo a half-applied mutation would make that depend on a rollback
 * that the commit handler's own `rollbackFailed` handling shows can itself fail.
 * Compute, refuse, then mutate. The parity check runs FIRST and is untouched by
 * the disclosure: a refusing retype returns no report because it returns nothing
 * at all.
 *
 * ---------------------------------------------------------------------------
 * DECISION 2: THE UNION COLLAPSE IS INTENDED.
 * ---------------------------------------------------------------------------
 * A caller range that SPANS several existing rows deletes all of them and
 * inserts one row. That is intended, and it does not contradict the store's
 * own adjacency rule: that rule forbids the store joining adjacent ranges OF ITS OWN ACCORD, and
 * here the caller asked for exactly one range and got exactly one range. The
 * store still never joins two rows nobody asked about -- see the behavioural
 * and structural adjacency controls.
 *
 * `changed: true` is CORRECT for that call even when every address resolves to
 * the same type afterwards, because `changed` reports the ROW SET and the row
 * identities really did change: both original ids are gone and a new one exists.
 * Both shapes -- the union retype and the same-type subrange, which fragments
 * one row into three with every id churned -- are pinned BY VALUE in
 * `anno-overlap.test.ts`, so "does not join" can be told apart from "was never
 * asked to".
 */
function retype(
  db: ScopedDb,
  start: number,
  endInclusive: number,
  dataType: DataType,
): { changed: boolean; reinterpretedSplitTables: readonly SplitTableReinterpretation[] } {
  const overlapping = db
    .prepare("select id, start, end_inclusive, data_type, bank from anno_range where project_id = $pid and end_inclusive >= ? and start <= ? order by id")
    // The cast names the shape INLINE rather than through `OverlappedRangeRow`
    // for one mechanical reason: `node:sqlite` types `all()` as
    // `Record<string, SQLOutputValue>[]`, and TypeScript refuses a direct
    // assertion to a named interface as insufficiently overlapping while
    // accepting the identical anonymous shape. The result is structurally the
    // interface, which is what the helper below takes.
    .all(start, endInclusive) as { id: number; start: number; end_inclusive: number; data_type: string; bank: number | null }[];

  if (
    overlapping.length === 1 &&
    overlapping[0].start === start &&
    overlapping[0].end_inclusive === endInclusive &&
    overlapping[0].data_type === dataType
  ) {
    // AN IDENTICAL REPEAT REPORTS NOTHING. Nothing is fragmented, so a second
    // disclosure of a fragmentation that already happened would be a false
    // report -- and the field is empty rather than absent, so the caller still
    // reads it unconditionally.
    return { changed: false, reinterpretedSplitTables: [] };
  }

  // THE GATE. Every remainder the loop below would write, asked the entry
  // point's own shape question, BEFORE anything is deleted or inserted -- and,
  // for a split row that survives that question, what the fragmentation COSTS.
  //
  // WHAT THIS GATE DOES NOT ASK, said here because "THE GATE" reads absolute
  // and a reader will otherwise take it for one (28-21 P1 / 28-07 P3):
  // the shape question is asked of REMAINDERS, never of the overlapped row
  // itself. A row the caller's range covers in full has no head and no tail,
  // so neither branch below runs and its shape is never examined -- correctly,
  // because the second loop DELETES it outright and a deletion owes no shape.
  // The consequence to hold on to: a malformed legacy row (one an already-
  // superseded build wrote) is refused only when something of it SURVIVES.
  // Do not read this gate as a validity check over `overlapping`; it is a
  // validity check over what `retype()` is about to write back.
  //
  // ORDER WITHIN THE LOOP IS LOAD-BEARING TWICE OVER: the two refusal checks run
  // before the reinterpretation for the SAME row, so a row whose remainder fails
  // parity never reaches a computation that would refuse it a second time with a
  // worse message; and the whole loop runs before the first `delete`, so a
  // refusal still costs nothing and an acceptance is never half-applied.
  //
  // The records are collected in the query's own `order by id` order, which is
  // what makes the report's array order ASCENDING OVERLAPPED-ROW ID rather than
  // an accident of iteration.
  const reinterpretedSplitTables: SplitTableReinterpretation[] = [];
  for (const row of overlapping) {
    if (row.start < start) {
      const refusal = remainderRefusal(row, row.start, start - 1, "head", start, endInclusive);
      if (refusal) throw refusal;
    }
    if (row.end_inclusive > endInclusive) {
      const refusal = remainderRefusal(row, endInclusive + 1, row.end_inclusive, "tail", start, endInclusive);
      if (refusal) throw refusal;
    }
    const reinterpretation = splitReinterpretation(row, start, endInclusive);
    if (reinterpretation !== null) reinterpretedSplitTables.push(reinterpretation);
  }

  for (const row of overlapping) {
    db.prepare("delete from anno_range where project_id = $pid and id = ?").run(row.id);
    if (row.start < start) {
      insertRange(db, row.start, start - 1, row.data_type, row.bank);
    }
    if (row.end_inclusive > endInclusive) {
      insertRange(db, endInclusive + 1, row.end_inclusive, row.data_type, row.bank);
    }
  }

  insertRange(db, start, endInclusive, dataType, null);
  return { changed: true, reinterpretedSplitTables };
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
function collectContradictedComments(db: ScopedDb, start: number, endInclusive: number, dataType: DataType): ContradictedComment[] {
  const rows = db
    .prepare("select address, comment_type, text from anno_comment where project_id = $pid and address >= ? and address <= ? order by address, comment_type")
    .all(start, endInclusive) as { address: number; comment_type: string; text: string }[];

  const out: ContradictedComment[] = [];
  for (const row of rows) {
    let grade: string | null;
    try {
      const parsed = parseConfidencePrefix(row.text);
      grade = parsed.grade === null ? null : parsed.grade.bracket;
    } catch (e) {
      if (e instanceof AnnoConfidenceGradeError) {
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
 * What `setDataType()` returns: `AnnoWriteResult` plus the two things this
 * retype has just cost that the row set alone does not show -- the comments it
 * made false, and the split tables it re-interpreted.
 *
 * BOTH REPORT FIELDS ARE ALWAYS PRESENT AND OFTEN EMPTY, never absent, so a
 * caller reads them unconditionally instead of guarding on them.
 *
 * BOTH ARE DATA ON A SUCCESSFUL RESULT -- never an error, never a refusal, and
 * there is no option to make either one. For `contradictedComments` see the
 * module header's trap 9: a refusal would push a caller toward deleting the
 * comment to get the retype through, which converts a REPORTED loss into a
 * SILENT one. `reinterpretedSplitTables` rides alongside it for the same reason
 * and by the same pattern.
 *
 * `reinterpretedSplitTables` carries one record per OVERLAPPED SPLIT ROW that
 * the accepted write fragmented -- the row's identity and span, the entry-address
 * pairs it read before, every surviving remainder's span and the pairs it reads
 * now, and the pairs PRESERVED (computed by comparing the two sets). It is empty
 * whenever the write fragmented no split row: a non-split overlap, a full cover,
 * an identical repeat. Its array order is ASCENDING OVERLAPPED-ROW ID, matching
 * the gate's own `order by id`; within a record the survivors are ordered HEAD
 * then TAIL. See `retype()`'s DECISION 1 for why this is a RETURN CHANNEL rather
 * than an on-disk column.
 */
export interface SetDataTypeResult extends AnnoWriteResult {
  contradictedComments: readonly ContradictedComment[];
  reinterpretedSplitTables: readonly SplitTableReinterpretation[];
}

/**
 * Types the inclusive range `start..endInclusive` as `dataType`, preserving
 * whatever the overlapping rows said about the addresses outside it.
 *
 * Every argument is validated before any SQL runs -- the transport validates
 * nothing (see `anno-types.mts`'s header).
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
      const { changed, reinterpretedSplitTables } = retype(db, start, endInclusive, dataType);
      return { changed, contradictedComments, reinterpretedSplitTables };
    },
    { baseRevision: args.baseRevision },
  );
  return {
    revision,
    changed: result.changed,
    contradictedComments: result.contradictedComments,
    reinterpretedSplitTables: result.reinterpretedSplitTables,
  };
}

/** Every typed range, in insertion order. The `bank` column is read HERE and
 * nowhere else in this module. */
export function listRanges(handle: AnnoStoreHandle): RangeRow[] {
  const rows = scopeOf(handle).prepare("select id, start, end_inclusive, data_type, bank from anno_range where project_id = $pid order by id").all() as {
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

/** The paint index over this store's current rows, rebuilt from the rows every
 * time (`anno-index.mts` traps 2 and 4). A convenience over
 * `buildPaintIndex(listRanges(handle))` -- it holds nothing between calls. */
export function paintIndexOf(handle: AnnoStoreHandle): PaintIndex {
  return buildPaintIndex(listRanges(handle));
}

// ---------------------------------------------------------------------------
// The five annotation kinds: labels, comments, scopes, project enums and
// cross-references. Every entry point below VALIDATES FIRST and only then goes
// through `applyWrite`, so no SQL runs on an unvalidated argument. Every
// statement is `prepare().run()` with bound parameters -- `exec()` stays
// restricted to the fixed `DDL` and the transaction keywords (trap 3).
// ---------------------------------------------------------------------------

/**
 * Binds `name` to `address` with label kind `kind`.
 *
 * THE COLLISION IS REFUSED, NEVER RESOLVED. A name already bound to a
 * DIFFERENT address throws `AnnoLabelError` naming the name and both addresses.
 * It is not rebound, not suffixed and not sanitised: see `anno-types.mts` trap 7
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
      const existing = db.prepare("select id, address, kind from anno_label where project_id = $pid and name = ?").get(name) as
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
        db.prepare("update anno_label set kind = ? where project_id = $pid and id = ?").run(kind, existing.id);
        return true;
      }

      db.prepare("insert into anno_label(project_id, address, name, kind, bank) values ($pid, ?, ?, ?, ?)").run(address, name, kind, null);
      return true;
    },
    { baseRevision: args.baseRevision },
  );
  return { revision, changed: result };
}

/** Every label, in ascending `id` order. One of the row mappers that read the
 * reserved `bank` column -- see `listRanges()` for why nothing else may. */
export function listLabels(handle: AnnoStoreHandle): LabelRow[] {
  const rows = scopeOf(handle).prepare("select id, address, name, kind, bank from anno_label where project_id = $pid order by id").all() as {
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
      const existing = db.prepare("select id, text from anno_comment where project_id = $pid and address = ? and comment_type = ?").get(address, commentType) as
        | { id: number; text: string }
        | undefined;

      if (existing) {
        if (existing.text === text) return false;
        db.prepare("update anno_comment set text = ? where project_id = $pid and id = ?").run(text, existing.id);
        return true;
      }

      db.prepare("insert into anno_comment(project_id, address, comment_type, text, bank) values ($pid, ?, ?, ?, ?)").run(address, commentType, text, null);
      return true;
    },
    { baseRevision: args.baseRevision },
  );
  return { revision, changed: result };
}

/** Every comment, in ascending `id` order. Reads the reserved `bank` column. */
export function listComments(handle: AnnoStoreHandle): CommentRow[] {
  const rows = scopeOf(handle).prepare("select id, address, comment_type, text, bank from anno_comment where project_id = $pid order by id").all() as {
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
 * (`anno-tools.mts:320-324`). Inventing nesting here would create annotations no
 * exporter downstream can express.
 *
 * The shape check passes a NON-SPLIT data type on purpose. `assertRangeShape()`
 * carries the split-table even-count rule, and a scope is not a table -- a
 * three-byte routine is a perfectly good scope. Passing `"byte"` selects the
 * two rules that do apply (both ends inside the address space; the end not below
 * the start) and none of the ones that do not.
 *
 * ENFORCED, as of 28-21, by the overlap refusal below: a scope that is nested
 * inside, contains, or partially overlaps an existing scope is REFUSED with an
 * `AnnoRangeShapeError` naming BOTH scopes -- the incoming one's two ends and
 * the existing one's id and two ends. Before that refusal existed this comment
 * and `ScopeRow`'s made a claim the code did not honour, which is exactly the
 * shape prohibition 28-07 P3 forbids. Adjacency is NOT overlap: two scopes that
 * merely touch at a boundary are two scopes, consistent with this store's own
 * treatment of ranges.
 *
 * A BYTE-IDENTICAL REPEAT IS AN ACCEPTED NO-OP reporting `changed: false`, and
 * this REVERSES a decision recorded here in as many words. The deleted
 * paragraph read "ADDITIVE, matching the verb's own name in the schema
 * (`add_scope`): two identical calls produce two rows [...] collapsing
 * duplicates here would be this module inventing a policy the surface does not
 * have." That reading is rejected on two grounds it could not see. First,
 * `AnnoWriteResult`'s own doc comment states that `changed` is the ONLY signal
 * distinguishing a no-op from a real edit -- and for scopes it could never say
 * no-op, so the module already had the policy and simply could not express it
 * here. Second, the MCP surface's own success criterion requires a repeated edit to
 * SUCCEED reporting no change, so the surface this store mirrors does have the
 * policy after all. The repeat is therefore accepted rather than refused, and
 * the revision still advances by one, exactly like every other write entry
 * point in this module.
 */
export function addScope(
  handle: AnnoStoreHandle,
  args: { start: number | string; endInclusive: number | string; baseRevision?: number },
): AnnoWriteResult {
  const start = parseStoreAddress(args.start, { what: "start" });
  const endInclusive = parseStoreAddress(args.endInclusive, { what: "endInclusive" });
  assertRangeShape(start, endInclusive, "byte");

  const { revision, result } = applyWrite(
    handle,
    (db) => {
      // IDEMPOTENCE FIRST, in the same shape `setLabel` and `setComment` use:
      // read the existing row inside the transaction and return `false`. It has
      // to run before the overlap check, because a byte-identical scope
      // overlaps itself and would otherwise be refused rather than accepted as
      // the no-op that surface's own criterion requires.
      const identical = db.prepare("select id from anno_scope where project_id = $pid and start = ? and end_inclusive = ?").get(start, endInclusive) as
        | { id: number }
        | undefined;
      if (identical) return false;

      // TWO RANGES OVERLAP IFF each starts at or before the other ends.
      // ADJACENCY FALLS OUT OF THE `>=`: an existing scope ending at exactly
      // `start - 1` fails `end_inclusive >= start`, so touching is not
      // overlapping. `order by id limit 1` reports the FIRST conflicting row
      // rather than an arbitrary one, so the message is reproducible.
      const overlapper = db
        .prepare("select id, start, end_inclusive from anno_scope where project_id = $pid and start <= ? and end_inclusive >= ? order by id limit 1")
        .get(endInclusive, start) as { id: number; start: number; end_inclusive: number } | undefined;
      if (overlapper) {
        throw new AnnoRangeShapeError(
          `scope ${start}..${endInclusive} ($${start.toString(16).padStart(4, "0")}..$${endInclusive.toString(16).padStart(4, "0")}) ` +
            `overlaps the existing scope id=${overlapper.id} ${overlapper.start}..${overlapper.end_inclusive} ` +
            `($${overlapper.start.toString(16).padStart(4, "0")}..$${overlapper.end_inclusive.toString(16).padStart(4, "0")}) -- ` +
            `nested and overlapping scopes are UNSUPPORTED by the schema this store mirrors, so the write is REFUSED rather than stored ` +
            `as a shape nothing downstream can express. The incoming scope is NOT trimmed and NOT split: supply a range disjoint from ` +
            `every existing scope. Two scopes that merely TOUCH at a boundary are disjoint and both accepted.`,
          { start, endInclusive },
        );
      }

      db.prepare("insert into anno_scope(project_id, start, end_inclusive) values ($pid, ?, ?)").run(start, endInclusive);
      return true;
    },
    { baseRevision: args.baseRevision },
  );
  return { revision, changed: result };
}

/** Every scope, in ascending `id` order. `anno_scope` has no `bank` column --
 * a scope is a lexical region, not a memory view. */
export function listScopes(handle: AnnoStoreHandle): ScopeRow[] {
  const rows = scopeOf(handle).prepare("select id, start, end_inclusive from anno_scope where project_id = $pid order by id").all() as {
    id: number;
    start: number;
    end_inclusive: number;
  }[];
  return rows.map((row) => ({ id: row.id, start: row.start, endInclusive: row.end_inclusive }));
}

/**
 * Removes the scope whose span is EXACTLY `start..endInclusive`, and returns
 * `changed: false` when no scope has that span.
 *
 * WHY THIS EXISTS, and why it is not an omission being corrected quietly.
 * A prior verification round recorded that `addScope`'s overlap refusal had
 * no inverse and carried the finding forward in as many words, "which puts
 * `addScope` on an agent-driven surface where a mistyped span is likelier".
 * The review that raised it spells out the consequence: one transposed end --
 * `addScope($1000, $ffff)` -- makes every future scope from `$1000` upward
 * permanently unaddable, with no way back short of rebuilding the project.
 * Its stated fix is to ship the inverse in the same phase as the
 * refusal. This is that inverse.
 *
 * THE SPAN MUST MATCH EXACTLY -- both ends, as stored. A scope is not trimmed,
 * split, or partially removed, for the same reason `addScope` does not trim an
 * overlapping incoming scope: a partial removal would leave a shape the schema
 * this store mirrors cannot express, and it would do so while reporting
 * success. A caller that does not know the stored span reads it from
 * `listScopes()` first.
 *
 * REMOVING A SCOPE THAT IS NOT THERE IS AN ACCEPTED NO-OP reporting
 * `changed: false`, matching `clearEnumUsage`'s direction: an inverse that
 * refuses when there is nothing to undo makes "undo this" conditional on
 * knowing whether it was ever done.
 *
 * THIS IS THE MODULE'S FOURTH ROW-DELETING STATEMENT. `clearEnumUsage`'s doc
 * block states the count as three; that sentence was true when it was written
 * and this one supersedes it. The count is written in prose, deliberately
 * without spelling the SQL prefix a census greps for, so a census over this
 * module counts STATEMENTS and not the sentences describing them. The statement
 * runs inside the write sequence's transaction, so a refusal raised anywhere in
 * the sequence rolls it back with everything else.
 */
export function removeScope(
  handle: AnnoStoreHandle,
  args: { start: number | string; endInclusive: number | string; baseRevision?: number },
): AnnoWriteResult {
  const start = parseStoreAddress(args.start, { what: "start" });
  const endInclusive = parseStoreAddress(args.endInclusive, { what: "endInclusive" });
  // The SAME non-split shape check `addScope` uses, and for the same reason: a
  // scope is not a table, so the split-table even-count rule must not apply to
  // it. Passing a different type here would make the inverse refuse spans the
  // forward verb accepts.
  assertRangeShape(start, endInclusive, "byte");

  const { revision, result } = applyWrite(
    handle,
    (db) => {
      const existing = db.prepare("select id from anno_scope where project_id = $pid and start = ? and end_inclusive = ?").get(start, endInclusive) as
        | { id: number }
        | undefined;
      if (!existing) return false;
      db.prepare("delete from anno_scope where project_id = $pid and id = ?").run(existing.id);
      return true;
    },
    { baseRevision: args.baseRevision },
  );
  return { revision, changed: result };
}

/**
 * Records a user-requested exclusion of `start..endInclusive`, with `reason`
 * stating WHY the user asked for it -- added at `SCHEMA_VERSION` 5.
 *
 * RECORDING AN EXCLUSION CHANGES NOTHING ABOUT WHICH BYTES THE EXPORT EMITS.
 * The exporter still walks this range's full byte span and emits a real
 * block, tagged with a visible marker comment, rather than a hole -- that is
 * this feature's whole invariant. An exporter implementation that skipped the
 * block on seeing an exclusion row would satisfy the word "exclude" and fail
 * the requirement outright: this table is a RECORD, never a filter, and the
 * store answers "what did the user record", never "should this range be
 * excluded".
 *
 * `reason` is validated through `assertCommentText()` -- the ONE comment-text
 * vocabulary this store has -- BEFORE the write opens, and an empty or
 * whitespace-only reason is refused with its own message: a `not null`
 * column satisfied by `""` records that something was excluded and loses WHY,
 * which is precisely the half of criterion 2 this record exists to carry.
 *
 * IDEMPOTENCE FIRST, inside the transaction and BEFORE the overlap check, the
 * same shape `addScope` uses: an identical repeat -- same extent, same reason
 * -- is an accepted NO-OP reporting `changed: false`. The SAME extent with a
 * DIFFERENT reason is REFUSED rather than silently overwritten -- the stored
 * reason is left exactly as it was, and the route to change it is to remove
 * the record with `removeExcludedRange` and add it again. Silently replacing
 * what somebody wrote and reporting success is the failure mode this store's
 * comment and label verbs already refuse.
 *
 * OVERLAP IS REFUSED using `addScope()`'s EXACT predicate --
 * `start <= ? and end_inclusive >= ?` with the two arguments TRANSPOSED, and
 * `order by id limit 1` so the message is reproducible -- so adjacency falls
 * out of the `>=` rather than a second rule: two exclusion records that
 * merely TOUCH at a boundary are disjoint and both accepted, and they stay
 * TWO records. The incoming record is NEVER trimmed or split; a caller
 * wanting a disjoint span reads `listExcludedRanges()` first, or removes the
 * conflicting record with `removeExcludedRange`.
 */
export function addExcludedRange(
  handle: AnnoStoreHandle,
  args: { start: number | string; endInclusive: number | string; reason: string; baseRevision?: number },
): AnnoWriteResult {
  const start = parseStoreAddress(args.start, { what: "start" });
  const endInclusive = parseStoreAddress(args.endInclusive, { what: "endInclusive" });
  assertRangeShape(start, endInclusive, "byte");

  const reason = assertCommentText(args.reason, { what: "exclusion reason" });
  if (reason.trim() === "") {
    throw new AnnoCommentError(
      `exclusion reason is empty or whitespace-only -- a "reason" column satisfied by an empty string records that something was excluded ` +
        `and loses WHY, which is precisely the half of criterion 2 this record exists to carry. Supply the reason the user gave.`,
      { reason: "empty reason" },
    );
  }

  const { revision, result } = applyWrite(
    handle,
    (db) => {
      // IDEMPOTENCE FIRST, `addScope`'s own shape: read the existing row
      // inside the transaction and BEFORE the overlap check, because a
      // byte-identical exclusion overlaps itself and would otherwise be
      // refused rather than accepted as the no-op an identical repeat requires.
      const identical = db
        .prepare("select id, reason from anno_excluded_range where project_id = $pid and start = ? and end_inclusive = ?")
        .get(start, endInclusive) as { id: number; reason: string } | undefined;
      if (identical) {
        if (identical.reason === reason) return false;
        throw new AnnoRangeShapeError(
          `exclusion ${start}..${endInclusive} ($${start.toString(16).padStart(4, "0")}..$${endInclusive.toString(16).padStart(4, "0")}) ` +
            `is already recorded (id=${identical.id}) with a DIFFERENT reason -- the stored reason is left EXACTLY as it was. Refusing rather ` +
            `than silently overwriting what somebody wrote: remove the record with removeExcludedRange and add it again to change the reason.`,
          { start, endInclusive },
        );
      }

      // TWO EXCLUSIONS OVERLAP IFF each starts at or before the other ends.
      // ADJACENCY FALLS OUT OF THE `>=`, `addScope()`'s exact predicate: an
      // existing exclusion ending at exactly `start - 1` fails
      // `end_inclusive >= start`, so touching is not overlapping. `order by id
      // limit 1` reports the FIRST conflicting row so the message is
      // reproducible.
      const overlapper = db
        .prepare("select id, start, end_inclusive from anno_excluded_range where project_id = $pid and start <= ? and end_inclusive >= ? order by id limit 1")
        .get(endInclusive, start) as { id: number; start: number; end_inclusive: number } | undefined;
      if (overlapper) {
        throw new AnnoRangeShapeError(
          `exclusion ${start}..${endInclusive} ($${start.toString(16).padStart(4, "0")}..$${endInclusive.toString(16).padStart(4, "0")}) ` +
            `overlaps the existing exclusion id=${overlapper.id} ${overlapper.start}..${overlapper.end_inclusive} ` +
            `($${overlapper.start.toString(16).padStart(4, "0")}..$${overlapper.end_inclusive.toString(16).padStart(4, "0")}) -- the incoming ` +
            `record is NOT trimmed and NOT split: supply a range disjoint from every existing exclusion. Two exclusions that merely TOUCH at a ` +
            `boundary are disjoint and both accepted. Read listExcludedRanges() first, or removeExcludedRange the conflicting record.`,
          { start, endInclusive },
        );
      }

      db.prepare("insert into anno_excluded_range(project_id, start, end_inclusive, reason) values ($pid, ?, ?, ?)").run(start, endInclusive, reason);
      return true;
    },
    { baseRevision: args.baseRevision },
  );
  return { revision, changed: result };
}

/** Every recorded exclusion, in ascending `id` order -- insertion order,
 * matching `listScopes()` and `listRanges()`. A consumer needing address
 * order sorts it itself, because a second ordering in the store would be a
 * second answer to the same question. `anno_excluded_range` has no `bank`
 * column, in the same shape `listScopes()`'s own doc comment uses for the
 * same absence: an exclusion is a statement about the subject program, not a
 * memory view. */
export function listExcludedRanges(handle: AnnoStoreHandle): ExcludedRangeRow[] {
  const rows = scopeOf(handle).prepare("select id, start, end_inclusive, reason from anno_excluded_range where project_id = $pid order by id").all() as {
    id: number;
    start: number;
    end_inclusive: number;
    reason: string;
  }[];
  return rows.map((row) => ({ id: row.id, start: row.start, endInclusive: row.end_inclusive, reason: row.reason }));
}

/**
 * Removes the exclusion whose span is EXACTLY `start..endInclusive`, and
 * returns `changed: false` when NO exclusion overlaps that span at all --
 * the exact inverse of `addExcludedRange`, following `removeScope()`.
 *
 * THE SPAN MUST MATCH EXACTLY -- both ends, as stored. A record is never
 * trimmed, split, or partially removed: a span that PARTIALLY OVERLAPS an
 * existing record (but does not match it end-for-end) is REFUSED BY NAME
 * rather than silently ignored, because a partial removal would leave a
 * shape nothing downstream can express, while reporting success. This is
 * stricter than `removeScope()`, which reports a mismatched span as a plain
 * no-op -- an exclusion's reason makes a near-miss removal more dangerous to
 * treat as "nothing happened", since a caller who meant to clear the record
 * would otherwise walk away believing it gone. A caller that does not know
 * the stored span reads it from `listExcludedRanges()` first.
 *
 * REMOVING A SPAN THAT DOES NOT OVERLAP ANYTHING STORED IS AN ACCEPTED NO-OP
 * reporting `changed: false`, matching `removeScope`'s own direction: an
 * inverse that refuses when there is genuinely nothing to undo makes "undo
 * this" conditional on knowing whether it was ever done.
 */
export function removeExcludedRange(
  handle: AnnoStoreHandle,
  args: { start: number | string; endInclusive: number | string; baseRevision?: number },
): AnnoWriteResult {
  const start = parseStoreAddress(args.start, { what: "start" });
  const endInclusive = parseStoreAddress(args.endInclusive, { what: "endInclusive" });
  // The SAME non-split shape check `addExcludedRange`/`removeScope` use, and
  // for the same reason: an exclusion is not a table, so the split-table
  // even-count rule must not apply to it.
  assertRangeShape(start, endInclusive, "byte");

  const { revision, result } = applyWrite(
    handle,
    (db) => {
      const existing = db.prepare("select id from anno_excluded_range where project_id = $pid and start = ? and end_inclusive = ?").get(start, endInclusive) as
        | { id: number }
        | undefined;
      if (existing) {
        db.prepare("delete from anno_excluded_range where project_id = $pid and id = ?").run(existing.id);
        return true;
      }

      // NO EXACT MATCH. Before reporting the ordinary "nothing to undo"
      // no-op, check whether the incoming span PARTIALLY overlaps a stored
      // record -- the same overlap predicate `addExcludedRange` uses. That
      // case is refused BY NAME rather than treated as a no-op, because the
      // caller plainly meant to remove something that exists and a silent
      // no-op would misreport the outcome.
      const overlapper = db
        .prepare("select id, start, end_inclusive from anno_excluded_range where project_id = $pid and start <= ? and end_inclusive >= ? order by id limit 1")
        .get(endInclusive, start) as { id: number; start: number; end_inclusive: number } | undefined;
      if (overlapper) {
        throw new AnnoRangeShapeError(
          `removeExcludedRange: ${start}..${endInclusive} ($${start.toString(16).padStart(4, "0")}..${endInclusive
            .toString(16)
            .padStart(4, "0")}) does not EXACTLY match the existing exclusion id=${overlapper.id} ${overlapper.start}..${overlapper.end_inclusive} ` +
            `($${overlapper.start.toString(16).padStart(4, "0")}..$${overlapper.end_inclusive.toString(16).padStart(4, "0")}), which it ` +
            `partially overlaps -- a record is never trimmed, split, or partially removed, because that would leave a shape nothing downstream ` +
            `can express while reporting success. Read listExcludedRanges() first to find the exact stored span.`,
          { start, endInclusive },
        );
      }

      return false;
    },
    { baseRevision: args.baseRevision },
  );
  return { revision, changed: result };
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

function readEnumRow(db: ScopedDb, name: string): { id: number; name: string; variants: string; description: string | null } | undefined {
  return db.prepare("select id, name, variants, description from anno_enum where project_id = $pid and name = ?").get(name) as
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
      db.prepare("insert into anno_enum(project_id, name, variants, description) values ($pid, ?, ?, ?)").run(name, variantsJson, description);
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

      db.prepare("update anno_enum set name = ?, variants = ?, description = ? where project_id = $pid and id = ?").run(
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
  const rows = scopeOf(handle).prepare("select id, name, variants, description from anno_enum where project_id = $pid order by id").all() as {
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
 * Associates ONE address with ONE project enum, so the address's operand is
 * formatted through that enum's variants (`SCHEMA_VERSION` 3).
 *
 * THE ASSOCIATION IS BY `anno_enum.id`, NEVER BY NAME, and that is the whole
 * design of the table. `updateProjectEnum` renames an enum in place, keeping
 * its id; a usage row that persisted the NAME would either be orphaned by the
 * rename or -- worse, because it is silent -- re-pointed at whatever enum next
 * took the old name. The name a caller passes here is resolved to an id ONCE,
 * at write time, and `listEnumUsage` resolves it back through a join at read
 * time.
 *
 * AN ENUM NAME NO `anno_enum` ROW CARRIES IS REFUSED BY NAME, naming the enum
 * that was not found, and nothing is written. The alternative -- creating the
 * enum implicitly -- would let a typo produce a real, empty enum that formats
 * nothing and looks deliberate.
 *
 * THE IDEMPOTENCY SHAPE IS `putXref`'s, COPIED RATHER THAN REINVENTED: the
 * existing row is selected first and `changed: false` is returned when the same
 * enum is already applied at the same address. The REVISION still advances --
 * see `AnnoWriteResult`, where that is the module's stated invariant for every
 * accepted write, `changed` being the only signal that separates a no-op from
 * a real edit.
 *
 * Every argument is validated through `anno-types.mts`'s own assertions before
 * any SQL runs. `parseStoreAddress` in particular refuses an UNPREFIXED numeric
 * string such as `"53280"` outright rather than guessing a base -- a recorded
 * failure in which a JSON `"1"` arrived verbatim and SQLite's column
 * affinity turned an argument error into a corruption refusal.
 */
export function applyEnumUsage(
  handle: AnnoStoreHandle,
  args: { address: number | string; name: unknown; baseRevision?: number },
): AnnoWriteResult {
  const address = parseStoreAddress(args.address, { what: "address" });
  const name = assertEnumName(args.name);

  const { revision, result } = applyWrite(
    handle,
    (db) => {
      // READ INSIDE THE TRANSACTION, for the reason the write sequence's own
      // rollback comment gives: resolving the enum outside it would open a
      // window in which a concurrent writer renames or removes it between the
      // read and the insert.
      const target = readEnumRow(db, name);
      if (!target) {
        throw new AnnoLabelError(
          `project enum ${JSON.stringify(name)} does not exist, so there is nothing to apply at $${address.toString(16).padStart(4, "0")} -- the write is ` +
            `REFUSED rather than creating the enum implicitly, because a mistyped name would otherwise become a real, empty enum that ` +
            `formats nothing and looks deliberate. Create it first.`,
          { identifier: name, reason: "no such enum" },
        );
      }

      const existing = db.prepare("select id, enum_id from anno_enum_usage where project_id = $pid and address = ? and bank is ?").get(address, null) as
        | { id: number; enum_id: number }
        | undefined;
      if (existing) {
        if (existing.enum_id === target.id) return false;
        // ONE ADDRESS CARRIES AT MOST ONE ENUM (the `unique(address, bank)`
        // constraint), so applying a DIFFERENT enum replaces rather than
        // refuses: the schema's own words for the verb are "Applies an enum
        // definition to format the immediate operand ... at a specific
        // address", which is a set, not an add.
        db.prepare("update anno_enum_usage set enum_id = ? where project_id = $pid and id = ?").run(target.id, existing.id);
        return true;
      }
      db.prepare("insert into anno_enum_usage(project_id, address, enum_id, bank) values ($pid, ?, ?, ?)").run(address, target.id, null);
      return true;
    },
    { baseRevision: args.baseRevision },
  );
  return { revision, changed: result };
}

/**
 * Clears the enum usage at one address. An address that carries none returns
 * `changed: false` and is NOT an error -- clearing is idempotent in the same
 * direction applying is, and the schema's own words make the empty name the
 * clear ("Omit or send empty to clear"), so a caller clearing twice is doing
 * the ordinary thing rather than a mistake worth refusing.
 *
 * Its row deletion runs inside the write sequence's transaction, so a refusal
 * raised anywhere in the sequence rolls it back with everything else.
 */
export function clearEnumUsage(handle: AnnoStoreHandle, args: { address: number | string; baseRevision?: number }): AnnoWriteResult {
  const address = parseStoreAddress(args.address, { what: "address" });

  const { revision, result } = applyWrite(
    handle,
    (db) => {
      const existing = db.prepare("select id from anno_enum_usage where project_id = $pid and address = ? and bank is ?").get(address, null) as
        | { id: number }
        | undefined;
      if (!existing) return false;
      db.prepare("delete from anno_enum_usage where project_id = $pid and id = ?").run(existing.id);
      return true;
    },
    { baseRevision: args.baseRevision },
  );
  return { revision, changed: result };
}

/** Every enum usage, in ascending ADDRESS order, with the enum's name resolved
 * through a join on `anno_enum.id` rather than read from a second on-disk copy
 * of it. Reads the reserved `bank` column. */
export function listEnumUsage(handle: AnnoStoreHandle): EnumUsageRow[] {
  const rows = scopeOf(handle)
    .prepare(
      // ONE LITERAL, NOT A CONCATENATION. The statement is long enough to want
      // wrapping and is deliberately not wrapped: the module's SQL is written
      // as bare statement literals so a census over this file reads the
      // statement it executes, and so no reader has to prove that a `+` between
      // two fragments joined only literals.
      "select u.id as id, u.address as address, u.enum_id as enum_id, e.name as enum_name, u.bank as bank from anno_enum_usage u join anno_enum e on e.id = u.enum_id and e.project_id = u.project_id where u.project_id = $pid order by u.address, u.id",
    )
    .all() as { id: number; address: number; enum_id: number; enum_name: string; bank: number | null }[];
  return rows.map((row) => ({
    id: row.id,
    address: row.address,
    enumId: row.enum_id,
    enumName: row.enum_name,
    bank: row.bank,
  }));
}

// ---------------------------------------------------------------------------
// THE RUNTIME EVIDENCE TABLE (`anno_evid_exec`, `SCHEMA_VERSION` 4).
// One raw shape used by all three functions below.
// ---------------------------------------------------------------------------

/** One `anno_evid_exec` row exactly as the column names read on disk --
 * `snake_case`, matching every other raw-row shape in this module.
 *
 * A `type` ALIAS RATHER THAN AN `interface`, and that is load-bearing rather
 * than stylistic: `node:sqlite`'s `all()` returns `Record<string,
 * SQLOutputValue>[]`, and casting that to a NAMED `interface` fails TS's
 * type-assertion comparability check ("neither type sufficiently overlaps")
 * even though the shapes are identical -- a `type` alias to the same object
 * shape is accepted. Measured against this exact query shape during this
 * plan's own implementation. */
type RawEvidExecRow = {
  id: number;
  image_sha256: string;
  argv_digest: string;
  seed: string;
  address: number;
  source_bank: string;
};

/** `RawEvidExecRow` -> `EvidExecRow`, the one mapping site both read functions
 * below share, so the two never drift into disagreeing about the shape. */
function toEvidExecRow(row: RawEvidExecRow): EvidExecRow {
  return {
    id: row.id,
    imageSha256: row.image_sha256,
    argvDigest: row.argv_digest,
    seed: row.seed,
    address: row.address,
    sourceBank: row.source_bank as EvidSourceBank,
  };
}

/**
 * Inserts one or more runtime-execution observations for one run identity,
 * keyed `(imageSha256, argvDigest, seed, address, sourceBank)` -- a live A/B
 * measured `no-perturbation` from instrumentation, so there is deliberately
 * no `run_class` discriminator.
 *
 * EVERY FIELD IS VALIDATED BEFORE THE FIRST STATEMENT RUNS, and every
 * refusal is a named `AnnoTypeError`/`AnnoAddressError` carrying the
 * offending value and the valid domain -- this module's existing refusal
 * register, never a fresh one. A caller-supplied `imageSha256`/`argvDigest`
 * that is not exactly 64 lowercase hex characters, a `seed` that is empty,
 * an `address` outside `ADDRESS_MIN..ADDRESS_MAX`, or a `sourceBank` outside
 * the frozen three is refused BEFORE the write transaction opens, so a bad
 * argument never reaches SQL and never partially inserts the rest of the
 * batch.
 *
 * THE WHOLE INSERT IS ONE `applyWrite` CALLBACK (T-43-09): every observation
 * in `args.observations` is written -- or skipped -- inside the SAME
 * transaction that `commitTransaction` commits, so a kill mid-ingest leaves
 * the set fully committed or fully absent, never a partial row set.
 *
 * AN OBSERVATION ALREADY PRESENT IS SKIPPED, NOT RE-INSERTED: the existing row is selected first, by the full
 * unique key, and the insert only runs when it is absent. `changed` is
 * `false` exactly when every observation in this call was already present --
 * the same `changed`-is-the-only-no-op-signal contract `AnnoWriteResult`
 * states for every other write entry point in this module. `revision` still
 * advances by exactly one on every accepted call, no-op or not, for the same
 * reason.
 *
 * `insertedCount` IS COUNTED INSIDE THIS SAME TRANSACTION, never
 * derived from a separate read taken before `applyWrite` opens it: a caller
 * that wants "how many of these rows were actually new" must not be handed a
 * number computed from a `listExecObservations()` snapshot that a concurrent
 * writer to the SAME run identity could have moved past between that read
 * and this insert's own commit. Counting the per-row `existing`/insert
 * branch already taken above is the one place this number can be exact.
 */
export interface InsertExecObservationsResult extends AnnoWriteResult {
  insertedCount: number;
}

export function insertExecObservations(
  handle: AnnoStoreHandle,
  args: {
    imageSha256: unknown;
    argvDigest: unknown;
    seed: unknown;
    observations: readonly { address: unknown; sourceBank: unknown }[];
    baseRevision?: number;
  },
): InsertExecObservationsResult {
  const imageSha256 = assertRunIdentityDigest(args.imageSha256, "imageSha256");
  const argvDigest = assertRunIdentityDigest(args.argvDigest, "argvDigest");
  const seed = assertRunIdentitySeed(args.seed);

  if (!Array.isArray(args.observations) || args.observations.length === 0) {
    throw new AnnoTypeError(`observations must be a non-empty array, got ${JSON.stringify(args.observations)}`, {
      dataType: args.observations,
    });
  }
  // VALIDATED IN FULL BEFORE THE FIRST STATEMENT, per this function's own
  // doc comment: a bad entry at index 9 must not leave entries 0..8 written.
  const parsedObservations = args.observations.map((obs) => ({
    address: parseStoreAddress((obs as { address: unknown }).address, { what: "address" }),
    sourceBank: assertEvidSourceBank((obs as { sourceBank: unknown }).sourceBank),
  }));

  const { revision, result } = applyWrite(
    handle,
    (db) => {
      let insertedCount = 0;
      for (const obs of parsedObservations) {
        const existing = db
          .prepare("select id from anno_evid_exec where project_id = $pid and image_sha256 = ? and argv_digest = ? and seed = ? and address = ? and source_bank = ?")
          .get(imageSha256, argvDigest, seed, obs.address, obs.sourceBank) as { id: number } | undefined;
        if (existing) continue;
        db.prepare("insert into anno_evid_exec(project_id, image_sha256, argv_digest, seed, address, source_bank) values ($pid, ?, ?, ?, ?, ?)").run(
          imageSha256,
          argvDigest,
          seed,
          obs.address,
          obs.sourceBank,
        );
        insertedCount++;
      }
      return insertedCount;
    },
    { baseRevision: args.baseRevision },
  );
  return { revision, changed: result > 0, insertedCount: result };
}

/** One shape used by `listExecObservations`'s four fixed queries below. */
type EvidRunIdentityFilter = { imageSha256: string; argvDigest: string; seed: string };

/**
 * Every runtime-execution observation, in ascending ADDRESS then `id` order,
 * with optional filters on `address` and on the full run identity. Never a
 * `select *` -- every column is named.
 *
 * A RUN-IDENTITY FILTER IS ALL THREE FIELDS TOGETHER OR NONE. A partial
 * identity (the seed alone, say) would silently widen the match to every
 * image/argv pair that happens to share it, which is not what "filter by run
 * identity" means -- refused BY NAME rather than accepted as a wider query
 * nobody asked for.
 */
export function listExecObservations(
  handle: AnnoStoreHandle,
  opts: { address?: number | string; imageSha256?: unknown; argvDigest?: unknown; seed?: unknown } = {},
): EvidExecRow[] {
  const hasAddress = opts.address !== undefined;
  const identityFieldsGiven = [opts.imageSha256, opts.argvDigest, opts.seed].filter((v) => v !== undefined).length;
  if (identityFieldsGiven > 0 && identityFieldsGiven < 3) {
    throw new AnnoTypeError(
      "listExecObservations: a run-identity filter requires imageSha256, argvDigest AND seed together -- a partial identity would silently widen the match",
      { dataType: { imageSha256: opts.imageSha256, argvDigest: opts.argvDigest, seed: opts.seed } },
    );
  }
  const hasIdentity = identityFieldsGiven === 3;

  const address = hasAddress ? parseStoreAddress(opts.address as number | string, { what: "address" }) : undefined;
  const identity: EvidRunIdentityFilter | undefined = hasIdentity
    ? {
        imageSha256: assertRunIdentityDigest(opts.imageSha256, "imageSha256"),
        argvDigest: assertRunIdentityDigest(opts.argvDigest, "argvDigest"),
        seed: assertRunIdentitySeed(opts.seed),
      }
    : undefined;

  let rows: RawEvidExecRow[];
  if (address !== undefined && identity !== undefined) {
    rows = scopeOf(handle)
      .prepare(
        "select id, image_sha256, argv_digest, seed, address, source_bank from anno_evid_exec where project_id = $pid and address = ? and image_sha256 = ? and argv_digest = ? and seed = ? order by address, id",
      )
      .all(address, identity.imageSha256, identity.argvDigest, identity.seed) as RawEvidExecRow[];
  } else if (address !== undefined) {
    rows = scopeOf(handle)
      .prepare("select id, image_sha256, argv_digest, seed, address, source_bank from anno_evid_exec where project_id = $pid and address = ? order by address, id")
      .all(address) as RawEvidExecRow[];
  } else if (identity !== undefined) {
    rows = scopeOf(handle)
      .prepare(
        "select id, image_sha256, argv_digest, seed, address, source_bank from anno_evid_exec where project_id = $pid and image_sha256 = ? and argv_digest = ? and seed = ? order by address, id",
      )
      .all(identity.imageSha256, identity.argvDigest, identity.seed) as RawEvidExecRow[];
  } else {
    rows = scopeOf(handle)
      .prepare("select id, image_sha256, argv_digest, seed, address, source_bank from anno_evid_exec where project_id = $pid order by address, id")
      .all() as RawEvidExecRow[];
  }

  return rows.map(toEvidExecRow);
}

/**
 * Every distinct run identity with an `anno_evid_exec` row, its accumulated
 * observation count, and the `denominator` those counts are a fraction of.
 *
 * WHY A DENOMINATOR IS RETURNED AT ALL, AND WHY IT NEVER FORMS A PERCENTAGE
 * ITSELF. A bare count invites the reading "the rest is data" -- exactly the
 * soundness violation this table's own discipline forbids (see `RuntimeExecClass`'s own doc
 * comment in `anno-types.mts`). `denominator` is `ADDRESS_MAX - ADDRESS_MIN +
 * 1`, read from `anno-types.mts`'s own constants rather than the literal
 * `65536` -- a caller comparing a run's `observationCount` against it forms
 * its own fraction, and there is deliberately no rounding site in this
 * module to do that division for them (see this file's `toFixed` census in
 * this task's own acceptance criteria).
 */
export function listObservedRuns(handle: AnnoStoreHandle): { runs: ObservedRunRow[]; denominator: number } {
  const rows = scopeOf(handle)
    .prepare(
      "select image_sha256, argv_digest, seed, count(*) as observation_count from anno_evid_exec where project_id = $pid group by image_sha256, argv_digest, seed order by image_sha256, argv_digest, seed",
    )
    .all() as { image_sha256: string; argv_digest: string; seed: string; observation_count: number }[];
  return {
    runs: rows.map((row) => ({
      imageSha256: row.image_sha256,
      argvDigest: row.argv_digest,
      seed: row.seed,
      observationCount: row.observation_count,
    })),
    denominator: ADDRESS_MAX - ADDRESS_MIN + 1,
  };
}

/**
 * Deletes every `anno_evid_exec` row for one run identity -- a bracket
 * reset. A run identity holding no rows returns `changed: false`
 * and is NOT an error: resetting an empty bracket is the ordinary thing,
 * matching `clearEnumUsage`'s own direction for the identical case.
 *
 * THIS IS THE MODULE'S FIFTH ROW-DELETING STATEMENT. `removeScope`'s doc
 * block (`anno-store.mts`) states the count as four; this one supersedes it.
 * The count is written in prose, deliberately without spelling the SQL
 * prefix a census greps for, so a `grep` over this module counts STATEMENTS
 * and not the sentences describing them. This statement runs inside the
 * write sequence's transaction, so a refusal raised anywhere in the
 * sequence rolls it back with everything else -- and a refusal here can
 * only come from validating the run-identity arguments themselves, since
 * deleting zero rows is success, not an error.
 */
export function deleteExecObservationsForRun(
  handle: AnnoStoreHandle,
  args: { imageSha256: unknown; argvDigest: unknown; seed: unknown; baseRevision?: number },
): AnnoWriteResult {
  const imageSha256 = assertRunIdentityDigest(args.imageSha256, "imageSha256");
  const argvDigest = assertRunIdentityDigest(args.argvDigest, "argvDigest");
  const seed = assertRunIdentitySeed(args.seed);

  const { revision, result } = applyWrite(
    handle,
    (db) => {
      const info = db.prepare("delete from anno_evid_exec where project_id = $pid and image_sha256 = ? and argv_digest = ? and seed = ?").run(imageSha256, argvDigest, seed);
      return Number(info.changes) > 0;
    },
    { baseRevision: args.baseRevision },
  );
  return { revision, changed: result };
}

/**
 * Records ONE NON-DERIVABLE cross-reference.
 *
 * THIS IS THE C-5 RECONCILIATION, written down here for a reader of the code
 * rather than left in a plan. Two requirement texts look like they conflict:
 * one requires cross-reference rows to carry their access kind from the
 * first write, while the cross-reference criterion requires references to be
 * DERIVED on every query and never cached on disk. Both hold at once, and this
 * entry point is where:
 *
 *   * the table and its `access_kind` column exist from the first write (the
 *     `DDL` above), so that requirement is satisfied structurally;
 *   * the only rows ever written here are references that CANNOT be recovered
 *     from the bytes -- hand-asserted, or resolved from something outside the
 *     program image. The `COMPUTED_JUMP` case is exactly that: a computed
 *     dispatch produces no reference derivable from the bytes at all, which is
 *     why it needs somewhere to live;
 *   * nothing derivable is ever written here. A cached derivation would be a
 *     SECOND ON-DISK TRUTH that can disagree with the range table it came from,
 *     and the disagreement is invisible because both answers look
 *     authoritative. `resolveSplitTargets()` in `anno-types.mts` derives and
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
        .prepare("select id from anno_xref where project_id = $pid and from_address = ? and to_address = ? and access_kind = ?")
        .get(fromAddress, toAddress, accessKind) as { id: number } | undefined;
      if (existing) return false;
      db.prepare("insert into anno_xref(project_id, from_address, to_address, access_kind, bank) values ($pid, ?, ?, ?, ?)").run(
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
  const rows = scopeOf(handle).prepare("select id, from_address, to_address, access_kind, bank from anno_xref where project_id = $pid order by id").all() as {
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
