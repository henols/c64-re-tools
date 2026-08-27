---
phase: 28-the-store-core
reviewed: 2026-08-28T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - src/mcp/vice/anno-confinement.test.ts
  - src/mcp/vice/anno-durability-mutator.mjs
  - src/mcp/vice/anno-durability.test.ts
  - src/mcp/vice/anno-index.test.ts
  - src/mcp/vice/anno-index.ts
  - src/mcp/vice/anno-overlap.test.ts
  - src/mcp/vice/anno-seam.test.ts
  - src/mcp/vice/anno-store.test.ts
  - src/mcp/vice/anno-store.ts
  - src/mcp/vice/anno-types.test.ts
  - src/mcp/vice/anno-types.ts
  - src/mcp/vice/block-class.test.ts
  - src/mcp/vice/block-class.ts
  - src/mcp/vice/package.json
  - src/mcp/vice/r2000-coverage.test.ts
findings:
  critical: 4
  warning: 11
  info: 4
  total: 19
status: issues_found
---

# Phase 28: Code Review Report (round 2, post gap-closure)

**Reviewed:** 2026-08-28
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

This is a **re-review** of the same file set after plans 28-07, 28-08 and 28-09 landed.
The 136 tests in the phase's own eight test files pass locally
(`node --test anno-*.test.ts block-class.test.ts` -> 136 pass, 0 fail).

**The three prior Critical findings and the four targeted Warnings were re-examined
against the code as it now stands, not taken on trust.** Six of the seven are
genuinely fixed; one is only partially fixed. Verdicts (old ids, from the
2026-08-27 round):

| Prior id | Claim | Verdict now |
|---|---|---|
| CR-01 | pointer rows outlive their files; the published floor lies; revert kills the handle with `ENOENT` | **Resolved.** `retainedRevisions()` (`anno-store.ts:479-485`) is one predicate requiring row AND file; `oldestRetainedRevision()` and `revertTo()`'s refusal both read it; `reconcileSnapshotRing()` drops both half-states. Not carried forward. |
| CR-02 | a losing writer overwrites a winner's published snapshot | **Resolved.** Staged under a per-attempt name and published by rename only after the CAS is won (`:680-687`, `:826-834`). Not carried forward. |
| CR-03 | symlink bypasses the workspace confinement | **PARTIALLY resolved.** The *live*-symlink case is genuinely closed. A **dangling** symlink still escapes and the store file is still created outside the workspace root -- reproduced below as **CR-04**. |
| WR-01 | prune deletes the file before its row | **Resolved.** Row-then-file at `:634-644`, with the inverted rationale corrected in trap 10. |
| WR-02 | `revertTo` closes the handle before any I/O | **Resolved.** Stage + fsync at `:1173-1187` precede `closeStore` at `:1194`; the residual (rename failure) is stated. |
| WR-04 | raw SQLite errors and a leaked connection out of `openStore` | **Mostly resolved.** Constructor and fresh-init are wrapped. The `pragma integrity_check` at `:396` is still unwrapped and still leaks the connection -- carried as **WR-04** below. |
| WR-11 | CAS refusal omits `currentRevision` | **Resolved.** Read before the rollback at `:819-825`. |

The fixes are real and well-argued. But **the mechanism the fixes are built on --
`reconcileSnapshotRing()`'s new directory sweep, plus the fact that a snapshot's
identity is a bare filesystem path -- introduces three new destructive defects**,
all reproduced against the committed code:

* two annotation stores in **one directory share one `snapshots/` directory**,
  so each one deletes and overwrites the other's snapshots and `revertTo`
  restores the **wrong store's database** (CR-01);
* the sweep deletes a **concurrent writer's published-but-uncommitted** snapshot,
  manufacturing exactly the orphan-pointer-row state trap 10 declares
  unsurvivable (CR-02);
* `anno_snapshot.path` is an **absolute** path, so **renaming the project
  directory** makes the whole ring look unretained and the next write deletes
  every snapshot file and row (CR-03).

Everything else below is carried forward from the prior round, re-verified as
still open, plus two new robustness gaps in the staged-snapshot window.

Design invariants named as out of scope (the single `node:sqlite` seam, the
frozen twelve, no adjacency coalescing on the insert path, no module-level
mutable state, `ExperimentalWarning`, the spawned mutator, test files absent
from `files[]`) were verified as **held**, not reported as defects. There is
still no SQL injection: every statement is a bound `prepare().run()` except the
fixed `DDL`, the transaction keywords and the one escaped `vacuum into`.

## Structural Findings (fallow)

No `<structural_findings>` block was supplied with this review.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: two stores in one directory share one `snapshots/` directory -- each destroys the other's ring, and `revertTo` restores the WRONG store's database

**File:** `src/mcp/vice/anno-store.ts:423-425` (with `:546-583` and `:1139-1219`)
**Severity:** BLOCKER

**Issue:**
`snapshotPathFor()` keys the snapshot path on the store's **directory** and the
revision number only:

```ts
return join(handle.dir, "snapshots", `r${revision}.db`);
```

Nothing in the path names the store *file*. Two stores that live side by side --
`project/game.annostore` and `project/loader.annostore`, an entirely ordinary
layout that nothing forbids or documents against -- therefore share
`project/snapshots/r0.db`, `r1.db`, ... . Three separate losses follow, and all
three were reproduced on the committed code:

1. **`reconcileSnapshotRing()`'s directory sweep (`:570-582`) deletes the other
   store's snapshots.** The sweep unlinks every `r<digits>.db` whose revision is
   not in *this* store's `retainedRevisions()`. It runs at the top of
   `pruneSnapshots()`, i.e. on **every accepted write**. So the first write to
   `loader.annostore` silently deletes `game.annostore`'s ring.
2. **`publishSnapshot()`'s rename overwrites the other store's snapshot**, so a
   committed pointer row ends up describing a foreign database. This is CR-02
   from the prior round reintroduced through a different door: the ownership
   discipline is per-revision, and revision numbers are not unique across stores
   in one directory.
3. **`revertTo()` restores the foreign image over this store.** Reproduced:

```
A rev 2 rows: [ 'code@4096', 'code@4352' ]        # game.annostore
B rev 2 rows: [ 'petscii@2049', 'petscii@2304' ]  # loader.annostore, same dir
snapshots/: [ 'r0.db', 'r1.db' ] | A retained: [ 0, 1 ]
A revertTo(1) -> rev 1 rows: [ 'petscii@2049' ]
```

`game.annostore` reverted to *its own* revision 1 and came back holding
`loader.annostore`'s annotations. Every one of game's rows is gone, no error was
raised, and `retainedRevisions()` reported the revision as perfectly retained
beforehand -- the ownership predicate cannot see the problem because both halves
(row and file) genuinely exist. This is `STORE-04`'s revert guarantee producing
the opposite of the recorded state, silently.

**Fix:** make the snapshot directory a property of the store FILE, not of its
parent directory, and derive it in the one place that already owns the layout:

```ts
export function snapshotPathFor(handle: AnnoStoreHandle, revision: number): string {
  // The snapshots sibling is per STORE FILE. Keyed on the directory alone, two
  // stores in one directory share a ring: each one's reconciliation sweep
  // deletes the other's files and revertTo restores the other's database.
  return join(handle.dir, `${basename(handle.path)}.snapshots`, `r${revision}.db`);
}
```

and read the same helper everywhere `join(handle.dir, "snapshots")` is spelled
today (`reconcileSnapshotRing()` at `:566`). Add a test that opens two stores in
one directory, writes to both, and asserts that a revert on each returns *its
own* rows and that neither ring loses a file.

### CR-02: the reconciliation sweep deletes a concurrent writer's published-but-uncommitted snapshot, producing the orphan pointer row trap 10 calls unsurvivable

**File:** `src/mcp/vice/anno-store.ts:566-582` (reached from `:611-617`)
**Severity:** BLOCKER

**Issue:**
`reconcileSnapshotRing()`'s directory sweep decides a file is an orphan purely
from **this connection's committed view** of `anno_snapshot`. A concurrent
writer publishes its snapshot by `renameSync` at `:832` and inserts its pointer
row at `:834` -- but the rename is a **filesystem** act and the row is a
**transactional** one, so between `:832` and the writer's `commit` at `:870` the
file is visible to every other process while the row is visible to none.

The prune runs at exactly that moment. `runWriteSequence` calls
`pruneSnapshots()` immediately after its own `commit` (`:870-875`), and a writer
blocked on `begin immediate` is woken by precisely that commit -- so the
interleaving is not rare, it is the *likely* one under contention. The module
explicitly supports concurrent writers (`{ timeout: 5_000 }` at `:317`, plus a
cross-process CAS proof in `anno-durability.test.ts`).

Reproduced with two connections, driving the production functions:

```
rev after two writes: 2 retained: [ 0, 1 ]
B published (uncommitted row) snapshot file exists: true r2.db
A reconcile droppedRows: [] droppedFiles: [ 'r2.db' ]     <- A deleted B's file
B committed. rev: 3
pointer rows: [ [0,'file OK'], [1,'file OK'], [2,'FILE GONE'] ]
retained (B): [ 0, 1 ]
revertTo(2) REFUSED: AnnoStoreError | cannot revert to revision 2: ...
```

Revision 2's pre-mutation snapshot is destroyed, so that write can **never** be
undone. The `retainedRevisions()` predicate stops it becoming an `ENOENT` crash
-- which is the prior CR-01 fix doing its job -- but the underlying loss is the
one trap 10 names: "a POINTER ROW AIMED AT A FILE THAT IS ALREADY GONE -- the one
failure direction the revert path cannot survive", now manufactured by the
reconciliation that exists to prevent it. Note the row-first ordering that
28-07 introduced does not help here, because it is another *process* that
deleted the file.

**Fix:** the sweep must not judge a file it cannot have created. Two options,
either sufficient:

* **Age the sweep.** Only unlink an unclaimed `r<n>.db` whose mtime is older
  than a bound comfortably longer than the longest possible publish-to-commit
  window, and re-check `retainedRevisions()` immediately before the unlink:

```ts
const stat = statSync(orphan, { throwIfNoEntry: false });
// A file younger than this may belong to a writer that has published but not
// yet committed its pointer row: the rename is filesystem-visible and the row
// is not. Deleting it destroys a snapshot a committed row is about to claim.
if (!stat || Date.now() - stat.mtimeMs < ORPHAN_FILE_GRACE_MS) continue;
```

* **Or serialise the sweep with the writers** by running it inside a
  `begin immediate` transaction taken for the sweep alone, so no other writer
  can be between its rename and its commit while the sweep runs (the unlinks
  still happen outside the transaction, but after the lock has proved no writer
  is mid-publish).

Add a two-connection test that plants the exact interleaving above and asserts
the published file survives and the revision stays revertible.

### CR-03: `anno_snapshot.path` is absolute, so renaming the project directory silently deletes the entire snapshot ring on the next write

**File:** `src/mcp/vice/anno-store.ts:479-485` (with `:834` and `:566-582`)
**Severity:** BLOCKER

**Issue:**
The pointer row stores the **absolute** path (`insert into anno_snapshot(revision, path)`
at `:834` with `snapPath` from `snapshotPathFor()`), and `retainedRevisions()`
tests that stored string:

```ts
return rows.filter((row) => existsSync(row.path)).map((row) => row.revision);
```

The moment the store is reached at a different absolute path -- a renamed
project directory, a moved checkout, or (directly relevant in this repo) the
same bind-mounted tree seen from the host and from a container -- **every** row's
stored path stops existing. `retainedRevisions()` returns `[]`, so:

* `oldestRetainedRevision()` reports `NO_RETAINED_REVISION` even though every
  snapshot file is sitting right there;
* `reconcileSnapshotRing()` treats every row as an orphan row **and every file as
  an orphan file**, and deletes both.

Reproduced -- one ordinary `mv` of the project directory, then one write:

```
before move: rev 5 retained [0,1,2,3,4] files [r0.db, r1.db, r2.db, r3.db, r4.db]
after move, before any write: retained [] oldest -1 files [r0.db..r4.db]
after ONE write: retained [ 5 ] files [ 'r5.db' ]
```

Five snapshot files and five pointer rows destroyed, with no error, no report and
nothing in `AnnoWriteResult` to notice it by. The annotations themselves survive,
but the whole of `STORE-04`'s revert history is gone.

**Fix:** stop treating the stored path as authoritative. The location is already
derivable from the handle, so derive it and store only what cannot be derived:

```ts
// The path column is a HINT, not the identity: it is absolute, and a store
// reached at a second absolute path (a moved project, a bind mount seen from
// the other side) would otherwise make every retained revision vanish and let
// the reconciliation delete the files it was meant to protect.
export function retainedRevisions(handle: AnnoStoreHandle): number[] {
  const rows = handle.db.prepare("select revision from anno_snapshot order by revision").all() as { revision: number }[];
  return rows.filter((row) => existsSync(snapshotPathFor(handle, row.revision))).map((row) => row.revision);
}
```

and make `revertTo()` (`:1165`) read `snapshotPathFor(handle, revision)` rather
than `pointer.path` for the same reason. Best paired with storing a **relative**
filename in the column (or dropping the column and making it purely derived), so
the two truths cannot diverge at all. Pin it with a test that renames the
containing directory between two writes and asserts the ring is intact.

### CR-04: the workspace confinement is still bypassed by a DANGLING symlink -- the store file is created outside the workspace root

**File:** `src/mcp/vice/anno-types.ts:732-752` (used by `:797-807`)
**Severity:** BLOCKER

**Issue:**
`realpathOfNearestExisting()` walks up to the deepest ancestor that `existsSync`
reports, and `existsSync` **follows symbolic links**. A symlink whose target does
not exist therefore reports `false`, so the walk steps *past* it and re-joins it
as an unresolved tail segment:

```ts
while (!existsSync(current)) {
  const parent = dirname(current);
  if (parent === current) return resolved;
  tail.unshift(basename(current));
  current = parent;
}
```

The link is then never resolved, the confinement compares a path the filesystem
will not use, and the subsequent `new DatabaseSync()` at `anno-store.ts:317`
creates the file **through** the link. Reproduced against the committed code:

```
target exists before: false
A) confinement ACCEPTED, returned: /tmp/annosym-XXXX/ws/p.annostore
A) file created OUTSIDE workspace: true
B) confinement ACCEPTED, returned: /tmp/annosym-XXXX/ws/sub/q.annostore   (dangling dir link)
C) refused (good): AnnoStorePathError                                     (live dir link -- the fixed case)
```

Case A is a one-line attack: `ln -s /somewhere/outside/x.db <ws>/p.annostore`.
No privileged access is needed and nothing has to pre-exist -- a dangling link is
*easier* to plant than the live one the fix does catch. This is the same control
whose stated purpose is that a store write must not "land on the HOST filesystem,
silently, outside the workspace" (`anno-store.ts` trap 7), guarding a path that
arrives unvalidated from the transport.

`anno-confinement.test.ts` has six cases and none of them plants a dangling link,
which is why the gap is invisible to a green suite.

**Fix:** decide the question with `lstat`, not `existsSync`, so a symlink counts
as "exists on this path" whether or not its target does:

```ts
import { lstatSync, realpathSync } from "node:fs";

function pathEntryExists(p: string): boolean {
  // lstat, NOT existsSync: existsSync follows the link and reports false for a
  // DANGLING one, which walks straight past the symlink the confinement most
  // needs to resolve.
  return lstatSync(p, { throwIfNoEntry: false }) !== undefined;
}

function realpathOfNearestExisting(p: string): string {
  const resolved = resolve(p);
  const tail: string[] = [];
  let current = resolved;
  while (!pathEntryExists(current)) { /* ...unchanged... */ }
  // `current` may itself be a dangling symlink: resolve its LINK TARGET
  // explicitly and re-enter the walk from there, so the escape is followed
  // rather than stepped over.
  ...
}
```

Concretely: when `lstatSync(current).isSymbolicLink()` and `realpathSync(current)`
throws `ENOENT`, resolve the link with `readlinkSync`, `resolve(dirname(current), link)`,
and restart the walk at that path. Then add two cases to
`anno-confinement.test.ts` -- a dangling leaf link and a dangling directory link,
both pointing outside the root -- each asserting `AnnoStorePathError` **and** that
nothing was created outside the workspace, matching test 1's two-part shape.

## Warnings

### WR-01: any throw between staging and the mutation leaks a `.tmp` nothing ever collects, leaves the transaction open, and escapes the `ViceError` family

**File:** `src/mcp/vice/anno-store.ts:805-834`
**Severity:** WARNING

**Issue:** `stageSnapshot()` runs at `:805`, but the first `try` in the sequence
only wraps `mutate()` at `:848`. Four statements sit between them with no
handler: `begin immediate` (`:807`), the CAS `.run()` (`:809`), the publishing
rename (`:832`) and the pointer-row insert (`:834`). A throw in any of them
leaks the staged file -- and the staging suffix is *deliberately* outside
`SNAPSHOT_FILE_PATTERN` (`:449`), so `reconcileSnapshotRing()` will never collect
it. That is unbounded growth in `snapshots/`, which is the threat
`MAX_SNAPSHOT_REVISIONS` exists to bound. A throw at `:834` additionally leaves
the transaction **open with the CAS already applied**, which is precisely the
state the comment at `:836-847` says the mutation rollback exists to prevent.

Reproduced (a second connection holding the write lock, so `begin immediate`
times out):

```
A's write threw after 5015ms: Error / Error | database is locked
  is it in the ViceError family? false
leaked .tmp staging files in snapshots/: [ 'r1.639924.da7e....tmp' ]
```

Note the second half: the error is a bare `Error`, not an `AnnoStoreError`, so
the "everything the store throws is a `ViceError`" property that
`AnnoCommentGradeError`'s whole rationale rests on does not hold on the
contention path.

**Fix:** widen the guard to the whole window and name the refusal:

```ts
const staging = stageSnapshot(handle, rev);
let published = false;
try {
  handle.db.exec("begin immediate");
  const cas = ...;
  if (Number(cas.changes) !== 1) { ...existing refusal... }
  publishSnapshot(staging, snapPath);
  published = true;
  handle.db.prepare("insert into anno_snapshot(revision, path) values (?, ?)").run(rev, snapPath);
  result = mutate(handle.db);
} catch (e) {
  try { handle.db.exec("rollback"); } catch { /* nothing useful to do */ }
  discardSnapshot(staging);
  if (e instanceof ViceError) throw e;
  throw new AnnoStoreError(`${handle.path}: the write sequence failed before it could commit (${(e as Error).message})`, { cause: e });
}
```

Also widen the "a refusal leaves NOTHING behind on disk" test in
`anno-store.test.ts` with a lock-contention case, since neither of its two
existing refusals reaches this window.

### WR-02: the post-commit prune can throw, so a write that DID commit is reported to the caller as a failure

**File:** `src/mcp/vice/anno-store.ts:870-877` (with `:558`, `:634`)
**Severity:** WARNING

**Issue:** `pruneSnapshots()` runs *after* `commitTransaction()` and issues
`delete from anno_snapshot ...` in autocommit at `:558` and `:634`. Those are
writes: under contention they raise `SQLITE_BUSY` after the 5 s timeout, and
`runWriteSequence` has no handler, so the exception propagates out of
`applyWrite`/`setDataType` for a write that is already durable. The caller reads
that as "the write failed" and retries; for the additive verbs (`addScope`, and
`putXref`/`setLabel` at a fresh key) the retry produces a second row. The prune's
own doc comment calls its position after the commit the guarantee, but never
states that a failure there must not be reported as a write failure.

**Fix:** the bound is best-effort by construction (it is not transactional), so
treat it that way and keep the accepted write's result:

```ts
if (doCommit) {
  commitTransaction(handle.db);
  try {
    pruneSnapshots(handle);
  } catch {
    // The write is ALREADY DURABLE. A prune failure is a bound not yet
    // enforced, never a failed write -- reporting it would make a caller retry
    // a write that landed, and the additive verbs would then double a row.
    // The next accepted write's prune re-enforces the bound.
  }
}
```

### WR-03: a genuine lock timeout is reported as store corruption

**File:** `src/mcp/vice/anno-store.ts:366-379`
**Severity:** WARNING
*(carried forward, unchanged since the prior round)*

**Issue:** the `try` wraps only `select schema_version, revision from anno_meta`,
but the `catch` converts **any** thrown error into `AnnoStoreCorruptError` whose
message says the store is "truncated, empty or foreign". A concurrent writer
holding the lock longer than the 5 s busy timeout -- the situation
`{ timeout: 5_000 }` exists for, and one WR-01 above shows is reachable -- surfaces
as "your annotations are gone". That is this module's own stated confusion,
running in the other direction.

**Fix:** discriminate on the SQLite error code before classifying:

```ts
} catch (e) {
  db.close();
  const code = (e as { code?: string }).code ?? "";
  if (/SQLITE_BUSY|SQLITE_LOCKED/.test(code)) {
    throw new AnnoStoreError(`${resolved}: another process holds the store lock (${code}) -- the store is NOT corrupt`);
  }
  throw new AnnoStoreCorruptError(...);
}
```

### WR-04: `openStore`'s `pragma integrity_check` is still unwrapped -- it leaks the connection and escapes the error family

**File:** `src/mcp/vice/anno-store.ts:396-400`
**Severity:** WARNING
*(narrowed remainder of the prior round's WR-04)*

**Issue:** 28-08 wrapped the `DatabaseSync` constructor (`:315-319`) and the
fresh-init block (`:340-363`), which closes the two reproduced cases. The
integrity check two statements later was not:

```ts
const check = db.prepare("pragma integrity_check").all() as { integrity_check: string }[];
```

A throw here -- `SQLITE_BUSY` under contention, or an I/O error on a damaged file,
which is exactly the population this statement exists to screen -- escapes as a
bare SQLite `Error` with the connection **still open and never closed**. Every
other failure branch in this function calls `db.close()` first.

**Fix:** give it the same treatment as its neighbours:

```ts
let check: { integrity_check: string }[];
try {
  check = db.prepare("pragma integrity_check").all() as { integrity_check: string }[];
} catch (e) {
  db.close();
  throw new AnnoStoreCorruptError(`${resolved}: integrity_check could not be run (${(e as Error).message})`, { path: resolved });
}
```

(with WR-03's busy/locked discrimination applied here too, so a locked store is
not reported as a damaged one).

### WR-05: the enum no-op check compares JSON text, so key ORDER decides whether an identical enum is accepted or refused

**File:** `src/mcp/vice/anno-store.ts:1506` (and `:1560-1564`)
**Severity:** WARNING
*(carried forward, unchanged)*

**Issue:** `existing.variants === variantsJson` compares
`JSON.stringify(validatedVariants(...))`, and `validatedVariants()` deliberately
preserves the caller's key order verbatim. The same enum supplied with its keys
reordered is therefore *not* equal, contradicting `createProjectEnum`'s own doc
comment ("A byte-identical repeat is a no-op reporting `changed:false`, so
re-running a generation pass is safe"). Re-reproduced:

```
WR-05 STILL OPEN: reordered IDENTICAL enum REFUSED: AnnoLabelError -
  project enum "e" already exists with different contents
```

Non-integer-like keys (`"$40"`, `"0b0100"` -- two of the three forms the schema
names) keep insertion order, so this fires whenever a generator's iteration order
changes. `updateProjectEnum`'s `changed` computation has the same flaw in the
other direction: a reorder-only update reports `changed:true` and rewrites the row.

**Fix:** compare by VALUE while keeping the stored keys verbatim:

```ts
function sameVariants(storedJson: string, next: Record<string, string>): boolean {
  const byValue = (m: Record<string, string>) =>
    Object.entries(m).map(([k, v]) => [parseVariantKey(k), v] as const).sort((a, b) => a[0] - b[0]);
  return JSON.stringify(byValue(JSON.parse(storedJson))) === JSON.stringify(byValue(next));
}
```

### WR-06: `baseRevision` is the one argument no validator touches

**File:** `src/mcp/vice/anno-store.ts:798` (every entry point's `args.baseRevision`)
**Severity:** WARNING
*(carried forward, unchanged)*

**Issue:** every other argument goes through an `assert*`/`parse*` before any SQL
runs -- that is `anno-types.ts`'s whole premise, because the transport validates
nothing. `baseRevision` goes straight into `baseRevision !== undefined && baseRevision !== rev`.
Re-reproduced:

```
WR-06 STILL OPEN: correct string base refused: AnnoStoreStaleRevisionError -
  refusing the write: base revision 1 is not the current on-disk revision 1
WR-06 (null): AnnoStoreStaleRevisionError - base revision null is not the current on-disk revision 1
```

A JSON caller supplying `"1"` is told its base disagrees with a number it
visibly equals, and `null` reads as "I have a base" rather than "I have none".

**Fix:**

```ts
function assertBaseRevision(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new AnnoStoreStaleRevisionError(
      `baseRevision ${JSON.stringify(value)} is not a revision -- expected a non-negative integer or no value at all`,
    );
  }
  return value as number;
}
```

### WR-07: label names, enum names and the variants blob have no size bound

**File:** `src/mcp/vice/anno-types.ts:853`, `:874-898`, `:909-918`; `src/mcp/vice/anno-store.ts:1440-1460`
**Severity:** WARNING
*(carried forward, unchanged)*

**Issue:** `MAX_COMMENT_BYTES` exists because "[b]etween an unvalidated caller
argument (the transport validates nothing) and unbounded blob growth in the store
file, this number is the only thing standing". The same argument applies verbatim
to three neighbouring fields with no bound at all: `LEGAL_IDENTIFIER_RE` accepts
an identifier of any length, `assertEnumName` likewise, and `validatedVariants`
bounds each key's *value* (`MAX_VARIANT_KEY`) but neither the number of variants
nor the length of a variant name. Re-reproduced:

```
WR-07 STILL OPEN: a 200,000-char enum name was accepted and stored
```

**Fix:** add a byte bound to both identifier validators and to the serialised
variants mapping, reusing `utf8ByteLength()` at `anno-types.ts:923` and refusing
over-long values BY NAME (never truncating, per trap 7):

```ts
export const MAX_IDENTIFIER_BYTES = 255;
export const MAX_VARIANTS_BYTES = MAX_COMMENT_BYTES * 16;
```

### WR-08: `retype` merges adjacent same-type rows and fragments a row on a same-type subrange retype; neither behaviour is pinned

**File:** `src/mcp/vice/anno-store.ts:932-958`
**Severity:** WARNING
*(carried forward, unchanged -- `anno-overlap.test.ts:463` still covers only the INSERT path)*

**Issue:** two observable behaviours of the retype path that no test covers, on a
requirement (`STORE-02`) that explicitly forbids merging. Re-reproduced:

```
WR-08 before: [ [1,'400','4ff'], [2,'500','5ff'] ]
      after union retype to SAME type: [ [3,'400','5ff'] ]  changed= true
```

Two rows a human deliberately kept separate are merged into one, their ids and
boundaries gone -- and `changed:true` is reported for what is semantically a
no-op, while `AnnoWriteResult`'s doc comment says `changed` "is the ONLY signal
that distinguishes a no-op from a real edit". The mirror case (retyping a
subrange of one row to the type it already has) splits the row into two and
churns every id. `anno-overlap.test.ts`'s adjacency test exercises two *separate*
`setDataType` calls, so neither behaviour can go red.

**Fix:** decide the semantics and pin them. Minimum: add both cases to
`anno-overlap.test.ts` asserting today's row sets by value. If the merge is
unwanted, skip the delete/re-insert when a covered row's `data_type` already
equals `dataType` and its span lies wholly inside `start..endInclusive`; if it is
wanted, say so in `retype()`'s doc comment next to the `STORE-02` reference,
because the two currently read as contradictory.

### WR-09: `listProjectEnums` parses stored JSON with no guard

**File:** `src/mcp/vice/anno-store.ts:1595`
**Severity:** WARNING
*(carried forward, unchanged)*

**Issue:** `JSON.parse(row.variants)` on a row that `openStore`'s
`integrity_check` cannot vet (a hand-edited store, a foreign producer) throws a
bare `SyntaxError`, escaping the `AnnoStoreError`/`ViceError` family and naming
neither the enum nor the store path.

**Fix:**

```ts
variants: (() => {
  try {
    return JSON.parse(row.variants) as Record<string, string>;
  } catch (e) {
    throw new AnnoStoreCorruptError(
      `${handle.path}: project enum ${JSON.stringify(row.name)} (id ${row.id}) holds an unparseable variants mapping: ${(e as Error).message}`,
      { path: handle.path },
    );
  }
})(),
```

### WR-10: two seam-private exports are public API of a published package

**File:** `src/mcp/vice/anno-store.ts:1046-1052` and `:680-687`; `src/mcp/vice/package.json:73`
**Severity:** WARNING
*(carried forward, and WIDENED by 28-08: the set is now two)*

**Issue:** `anno-seam.test.ts:309-331` bounds `applyWriteWithoutCommit` and
`stageSnapshot` to "no shipped module *in this repo* names them". That says
nothing about consumers of the published `@henols/vice-mcp` tarball, and
`anno-store.ts` is in `files[]` (`package.json:73`). Calling
`applyWriteWithoutCommit` leaves the connection inside an open transaction with
the CAS already applied and the pointer row inserted; `currentRevision()` on that
connection then reports an advanced revision for a write that will never land.
Calling `stageSnapshot` leaves a `.tmp` the reconciliation sweep is deliberately
anchored not to match -- the seam test's own doc comment says exactly this, and
then guards only against in-repo callers.

**Fix:** gate both on the test-only entry rather than exporting them
unconditionally, e.g. an explicit opt-in the mutator passes:

```ts
export function applyWriteWithoutCommit<T>(
  handle: AnnoStoreHandle,
  mutate: (db: DatabaseSync) => T,
  opts: { baseRevision?: number; iAmTheDurabilityProof: true },
): { revision: number; result: T }
```

or guard both behind `process.env.ANNO_STORE_DURABILITY_PROOF === "1"` and have
`anno-seam.test.ts` pin the guard itself. Either keeps the "identical code path"
property the two proofs need.

### WR-11: `revertTo` replaces the store file under any other open connection, which then writes into an unlinked inode

**File:** `src/mcp/vice/anno-store.ts:1194-1214`
**Severity:** WARNING

**Issue:** `revertTo` closes only *its own* handle before renaming the staged
image over the store path. A second connection -- another process, or a second
`openStore` in this one -- keeps its file descriptor on the **old inode**. It
sees none of the revert, its SQLite POSIX locks no longer coordinate with anyone
(the new writer locks a different inode), and every write it makes lands in a
file nothing will ever open again. The doc comment says the replacement is
"atomic from a reader's point of view", which is true only of readers that open
the path *after* the rename; existing readers get silent divergence rather than
atomicity, and two writers on two inodes is a lost-update path with no error.

Two smaller points in the same body: the `rmSync(staging, { force: true })` in
the step-3 catch (`:1181`) is unguarded, so a failure there replaces the real
error (`discardSnapshot()` at `:735-741` exists for exactly this and is not
used); and if `openStore` at `:1217` throws, the revert has already happened but
the caller gets an exception and no handle, a residual step 6 does not state
while steps 3 and 5 both state theirs.

**Fix:** state the single-connection precondition in the doc comment and enforce
what can be enforced -- take the store's write lock (`begin immediate`) before
staging so a concurrent *writer* cannot be mid-transaction, and route both
cleanup calls through `discardSnapshot()`. If concurrent readers must be
supported across a revert, the replacement has to be done in place (a
`VACUUM INTO` back over the open connection, or a `delete`+`insert` restore
inside one transaction) rather than by rename.

## Info

### IN-01: a non-number, non-string range end is reported as a range-shape error

**File:** `src/mcp/vice/anno-store.ts:1082-1084`
**Severity:** WARNING (informational tier)
**Issue:** the documented split ("`parseStoreAddress` owns the STRING forms only
... a numeric argument is passed straight through") means `null`, `true` or `{}`
reach `assertRangeShape`, which reports `start [object Object] is outside the
address space` -- an `AnnoRangeShapeError` where `AnnoAddressError` ("that is not
an address") is the answer the comment says a caller must be able to tell apart.
**Fix:** in `setDataType`, route anything that is not `typeof === "number"`
through `parseStoreAddress` too; numbers keep the current pass-through.

### IN-02: `fsyncPath` opens with `"r"`

**File:** `src/mcp/vice/anno-store.ts:299-306`
**Severity:** WARNING (informational tier)
**Issue:** `fsync` on a read-only descriptor, and `openSync` on a *directory* at
all, are not portable (both fail on Windows). Fine for the Linux/macOS hosts this
tree targets; noted so a later port does not discover it as a silent durability
loss.
**Fix:** none required today; if portability is added, guard with
`process.platform === "win32"` and document that the directory fsync is skipped.

### IN-03: `resolveAt` does not check the index length

**File:** `src/mcp/vice/anno-index.ts:142-150`
**Severity:** WARNING (informational tier)
**Issue:** the address bound is validated but `index.length` is not, so a
short/foreign `Int32Array` returns `undefined` typed as `number` -- which would
compare unequal to `NO_ROW` and read as "some row covers this".
**Fix:** `if (index.length !== PAINT_INDEX_SIZE) throw new AnnoRangeShapeError(...)`
once at the top of the function.

### IN-04: the fixture overlap census never expires a range ending at `$FFFF`

**File:** `src/mcp/vice/anno-index.test.ts:147-160` (`fixtureOverlapCensus`)
**Severity:** WARNING (informational tier)
**Issue:** removals are keyed at `endInclusive + 1`, which is `0x10000` for a
range ending at the top of memory -- outside the sweep, so such ranges stay
"active" for the rest of it. Harmless for the two `> 0` non-degeneracy
assertions, but both counters are slightly overstated, so the numbers must not
later be asserted as exact values.
**Fix:** clamp the removal key (`Math.min(row.endInclusive + 1, ADDRESS_MAX + 1)`)
and skip keys past `ADDRESS_MAX`, or note in the helper that the counts are lower
bounds.

---

_Reviewed: 2026-08-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Round: 2 (supersedes the 2026-08-27T19:13:52Z review of the same file set)_
