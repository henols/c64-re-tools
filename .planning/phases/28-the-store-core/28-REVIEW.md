---
phase: 28-the-store-core
reviewed: 2026-08-28T12:00:00Z
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
  critical: 3
  warning: 9
  info: 5
  total: 17
status: issues_found
---

# Phase 28: Code Review Report (round 3, post 28-10 / 28-11 / 28-12)

**Reviewed:** 2026-08-28
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Third round on the same fifteen files, after plans 28-10, 28-11 and 28-12 landed
against round 2's four Critical findings. **The phase's own eight test files are
150/150 green** (`node --test anno-*.test.ts block-class.test.ts` → 150 pass, 0
fail, 13.3 s), and three of the four claimed closures hold up under direct
verification. They were checked against the code and by driving the production
functions, not taken on trust:

| Round-2 id | Claim | Verdict, verified |
|---|---|---|
| CR-01 | two stores in one directory share a ring | **Closed by 28-10.** `snapshotDirFor()` (`anno-store.ts:491-493`) keys the ring on `basename(handle.path)`; two distinct files in one directory cannot collide. The CR-01 test is real and its RED is recorded. |
| CR-02 | the sweep deletes a concurrent writer's published snapshot | **Closed by 28-11.** The exclusion is exact, not timed: publication is reachable only from behind a won CAS *inside* `begin immediate`, so a published-but-uncommitted writer holds the very lock the sweep now takes first (`:702`). Reproduced as working: the sweep blocks the full `busy_timeout` and returns `deferred: true`. |
| CR-03 | an absolute persisted path turns a directory move into destruction | **Closed by 28-10 for its reported cause** (`anno_snapshot` is one column; every location is recomputed). **But the CLASS is reopened by a new cause** — the ring is now keyed on the store path's *basename spelling*, and a second spelling of the same file destroys the whole ring. Carried forward as **CR-05**, reproduced twice. |
| CR-04 | a dangling symlink bypasses workspace confinement | **Closed by 28-12.** The walk stops at a path *entry* (`lstatSync`), hops a dangling link against the link's own directory, and bounds the chain at Linux's own `MAXSYMLINKS`. The dangling leaf and dangling directory cases are both refused now. **But the new predicate throws where the old one returned** — see **WR-12**. |
| WR-01 | any throw between staging and the mutation leaks state | **Closed by 28-11** for the named window (two handlers at `:1039-1048` and `:1068-1126`). The *property* it invoked — "everything the store throws is a `ViceError`" — is still false one statement later; see **CR-06**. |
| WR-02 | a post-commit prune failure is reported as a write failure | **Closed by 28-11** (`:1182-1186`, non-rethrowing). The swallow is correct, and it is also what makes **CR-07** silent. |
| WR-04 | `pragma integrity_check` unwrapped, leaks the connection | **Closed by 28-11** (`:427-433`). |

**Three new Critical findings, all reproduced against the committed code by
driving the production functions.** Two of them are the *same shape* as the
defects 28-10 and 28-11 closed — a truth about a file's identity that a second
spelling can disagree with, and a transaction that a throw can leave open — which
is why they are worth stating as findings rather than as follow-ups:

* **CR-05** — a snapshot's location is a total function of `(handle, revision)`,
  and `handle` is a *path spelling*, not the store. Reach the same store file
  under a second name (a symlink alias, or `mv proj.annostore other.annostore` —
  the residual 28-10 states as accepted) and the very next accepted write
  **deletes every pointer row**. Renaming back does not undo it: the rows are
  gone, `revertTo` refuses forever, and the snapshot files leak into a second
  ring nothing bounds. The stated residual says the old ring "is deliberately
  NEVER DELETED and `retainedRevisions()` then honestly reports `[]`" — that is
  an understatement of what actually happens to the rows.
* **CR-06** — `commitTransaction` at step 8 (`:1162`) is outside every handler.
  A concurrent *reader* (not writer) makes it fail `SQLITE_BUSY`; the error
  escapes the `ViceError` family as a bare `Error` and the connection is left
  inside an open transaction with the CAS, the mutation and the pointer row all
  applied — holding the store's write lock so no other connection can even read.
  The WR-02 structural control proves the `pruneSnapshots(handle)` call one line
  *below* it is guarded, which is the near-miss.
* **CR-07** — `reconcileSnapshotRing`'s own transaction has no `try/finally`. Any
  throw between `:702` and `:757` leaves it open on the caller's connection, and
  step 9's WR-02 wrap **swallows** it, so an accepted write can silently wedge its
  own handle and lock the store out for every reader. Worse, the sweep's
  "decline and report" rule then *masks* the state: a subsequent sweep on that
  connection fails `begin immediate` with "cannot start a transaction within a
  transaction" and reports `deferred: true` — indistinguishable from ordinary
  contention.

Everything else from round 2 is re-verified: eight Warnings and four Info items
are unchanged in the source and are carried forward as still open, with one new
Warning (WR-12) and one new Info (IN-05).

Design invariants named as out of scope were verified as **held**: the single
`node:sqlite` seam, the frozen twelve, no adjacency coalescing on the insert
path, no module-level mutable state, the one `commit` statement, `bank`
uninterpreted, `anno-types.ts`'s absence from the host-path consumer set, and the
`vacuum into` escaping. There is still **no SQL injection**: every statement is a
bound `prepare().run()` except the fixed `DDL`, the transaction keywords and the
one single-quote-escaped `vacuum into`.

The four stated limits listed as deliberate residuals (STORE-01 check-then-open,
byte-wise path comparison, the ~5 s contention stall at two sites) were checked
and are **not** re-reported. The store-FILE-rename residual **is** re-reported,
because the stated limit is understated (CR-05).

## Structural Findings (fallow)

No `<structural_findings>` block was supplied with this review.

## Narrative Findings (AI reviewer)

### Round-2 finding dispositions

Every round-2 id, carried forward explicitly. Ids marked *still open* have their
full section below.

| Id | Disposition |
|---|---|
| CR-01 | **Closed by 28-10.** Verified in code and by the passing CR-01 test. |
| CR-02 | **Closed by 28-11.** Verified: the exclusion is derived from a lock the writer already holds. |
| CR-03 | **Closed by 28-10** for its reported cause; **class reopened by CR-05** with a new cause. |
| CR-04 | **Closed by 28-12.** Verified: dangling leaf and dangling directory links are both refused at the predicate. Adjacent regression filed as WR-12. |
| WR-01 | **Closed by 28-11** for the named window; the family-escape property it invoked is still false at the commit statement (CR-06). |
| WR-02 | **Closed by 28-11.** |
| WR-03 | **Still open** — `anno-store.ts:391-403` unchanged. |
| WR-04 | **Closed by 28-11.** |
| WR-05 | **Still open** — `anno-store.ts:1840` unchanged. |
| WR-06 | **Still open** — `anno-store.ts:1024` unchanged. |
| WR-07 | **Still open** — no byte bound added to either identifier validator or to the variants blob. |
| WR-08 | **Still open** — `retype()` unchanged; `anno-overlap.test.ts:463` still covers only the two-call insert path. |
| WR-09 | **Still open** — `anno-store.ts:1929` unchanged. |
| WR-10 | **Still open, and further entrenched** — 28-11's CR-02 and deferred-prune tests both now depend on `applyWriteWithoutCommit`. |
| WR-11 | **Still open** — `revertTo` unchanged apart from comments; 28-11 added a new residual at step 6 (see below). |
| IN-01 | **Still open** — `anno-store.ts:1393-1394` unchanged. |
| IN-02 | **Still open** — `anno-store.ts:322-329` unchanged. A pending todo exists. |
| IN-03 | **Still open** — `anno-index.ts:142-150` unchanged. |
| IN-04 | **Still open** — `anno-index.test.ts:155` unchanged. |

## Critical Issues

### CR-05: the snapshot ring is keyed on the store path's basename SPELLING, so one write under a second spelling of the same file deletes every pointer row — irreversibly

**File:** `src/mcp/vice/anno-store.ts:491-493` (with `:571-574`, `:715-718`, `:745-749`)
**Severity:** BLOCKER

**Issue:**
28-10 replaced a persisted absolute path with a computed one:

```ts
export function snapshotDirFor(handle: AnnoStoreHandle): string {
  return join(handle.dir, basename(handle.path) + SNAPSHOT_DIR_SUFFIX);
}
```

That removes the persisted-string primitive, and CR-03's reported cause (a
directory rename) is genuinely closed. But the *identity* the ring is now keyed
on is `handle.path` — **a path spelling, not the store**. `openStore(path)`
without a `workspaceRoot` does not realpath at all (`:346`: `resolve(path)`), so
the same store file reached under a second name gets a **second, empty ring**,
and `retainedRevisions()` (`:571-574`) then reports every existing pointer row as
unretained. `reconcileSnapshotRing` classifies all of them as orphan ROWS — the
direction it is written to destroy — and deletes them (`:745-749`), committed
(`:757`) and irreversible.

Reproduced twice against the committed code, both times through the production
entry points only.

**(a) a symlink alias to the store file** (`ln -s real.annostore alias.annostore`):

```
A ring: /tmp/anno-alias-XXXX/real.annostore.snapshots [ 'r0.db', 'r1.db', 'r2.db' ]
A retained: [ 0, 1, 2 ] rev 3
B ring: /tmp/anno-alias-XXXX/alias.annostore.snapshots exists: false
B retained (BEFORE any write): []  oldest -1
after ONE write through the alias:
  pointer rows: [ 3 ]                          <-- rows 0,1,2 DELETED
  old ring: [ 'r0.db', 'r1.db', 'r2.db' ]      <-- files still there, unreachable
  new ring: [ 'r3.db' ]                        <-- a SECOND ring, bounded by nothing
reopened by REAL path: retained [] oldest -1
revertTo(1) REFUSED: AnnoStoreError | no snapshot is retained for it
```

**(b) the stated residual, `mv proj.annostore other.annostore`** — which 28-10's
SUMMARY records as accepted because "it is deliberately NEVER DELETED and
`retainedRevisions()` then honestly reports `[]`". The FILES are not deleted; the
**ROWS are**, so undoing the rename does not recover anything:

```
before:                    retained [0,1,2]  rows [0,1,2]
after mv, before a write:  retained []       rows [0,1,2]
after ONE write:                             rows [3]        <-- all three rows gone
renamed BACK:  ring on disk [r0.db,r1.db,r2.db]  retained []  oldest -1
revertTo(1) REFUSED
```

So the stated limit is understated in two ways: the loss is not an under-claim
but a deletion, and it is not reversible by restoring the name. Two further
consequences: `MAX_SNAPSHOT_REVISIONS` no longer bounds the on-disk footprint
(each spelling accretes its own ring, and a sweep can only ever see the ring it
names), and nothing in `AnnoWriteResult` reports any of it.

Case (a) is immune when a `workspaceRoot` IS supplied, because
`storePathWithinWorkspace` realpaths an existing store file — but the
`workspaceRoot` is optional at `:345`, `revertTo` itself calls `openStore` without
one (`:1551`), and case (b) defeats realpath entirely.

**Fix (minimum, closes both cases):** apply 28-11's own decline rule to the
ownership question the sweep cannot answer. A ring directory that is **absent
while `anno_snapshot` holds rows** is not a ring full of orphan rows; it is a ring
this handle cannot establish ownership of, exactly the state the sweep is
required to abstain from:

```ts
// The ring directory's ABSENCE is not evidence that its rows are orphans. The
// ring is named from `basename(handle.path)`, so a second spelling of the same
// store file -- a symlink alias, or a store-file rename -- produces an absent
// ring beside a full pointer table. Deleting those rows destroys the whole
// revert history irreversibly (CR-05, reproduced). Decline, and say so.
if (!existsSync(snapshotDir) && rows.length > 0) {
  commitTransaction(handle.db);
  return { droppedRows, droppedFiles, deferred: true };
}
```

**Fix (complete):** make the ring's identity travel with the store's *contents*
rather than with its name — a random ring id minted into `anno_meta` at first
open, with the ring at `join(handle.dir, ".anno-ring-" + ringId)`. That is a
persisted string, but a *relative* one that names a sibling of whatever directory
the handle is in, so it survives every spelling, every rename and both sides of a
bind mount. Pin it with two tests: one that opens a store through a symlink alias
and asserts the pointer rows and files survive a write, and one that renames the
store file, writes, renames back, and asserts `revertTo` still honours the
pre-rename floor.

### CR-06: the commit statement is outside every handler — a concurrent READER makes an accepted write escape the error family and leave the connection wedged with the write lock held

**File:** `src/mcp/vice/anno-store.ts:1162` (with `:303-305` and `:1182-1186`)
**Severity:** BLOCKER

**Issue:**
28-11 wrapped the staging call, the CAS/publish/insert window and the post-commit
prune. It did not wrap the statement between the last two:

```ts
if (doCommit) {
  commitTransaction(handle.db);   // :1162 -- outside every try in this function
  try { pruneSnapshots(handle); } catch { /* WR-02 */ }
}
```

A `COMMIT` of a write transaction needs an EXCLUSIVE lock, so it fails
`SQLITE_BUSY` when **any other connection holds a read transaction** — not a
writer, a *reader*, which the CAS's `begin immediate` does not exclude. The
module explicitly supports concurrent connections (`{ timeout: 5_000 }` at
`:358`, plus a cross-process proof in `anno-durability.test.ts`), and a read
transaction outliving the 5 s `busy_timeout` is ordinary.

Reproduced with a genuinely separate OS process holding a read transaction:

```
READER: shared lock held
write threw after 5010 ms: Error | inFamily: false | database is locked
    at commitTransaction (anno-store.ts:304:6)
    at runWriteSequence (anno-store.ts:1162:5)
    at applyWrite (anno-store.ts:1198:10)
LEAKED TRANSACTION on the writer's handle -> cannot start a transaction within a transaction
```

Three separate defects fall out of that one line:

1. **The error is a bare `Error`, outside the `ViceError` family.** That is WR-01's
   own complaint verbatim — "the error is a bare `Error`, not an
   `AnnoStoreError`, so the 'everything the store throws is a `ViceError`'
   property does not hold on the contention path" — still true after the plan
   that closed WR-01, one statement further on.
2. **The transaction is left OPEN with everything applied** — the CAS, the caller's
   mutation and the pointer row. `currentRevision()` on that connection reports the
   advanced revision for a write that will never land, which is precisely the
   state the mutation rollback at `:1146-1150` exists to prevent.
3. **The connection holds the store's write lock indefinitely.** Nothing rolls it
   back, so every other connection is locked out (5 s then `SQLITE_BUSY`) until
   this handle closes, and the handle's own next write fails
   `cannot VACUUM from within a transaction`. On the phase-29 tool path a handle
   lives as long as the session.

The WR-02 structural control (`anno-store.test.ts:2684`) asserts that
`pruneSnapshots(handle)` sits inside a still-open `try`. The unguarded statement
is the one directly above it.

**Fix:** put the commit inside the same shape the rest of the sequence uses, and
name the refusal so a caller can tell "your write did not land" from "your store
is broken":

```ts
if (doCommit) {
  try {
    commitTransaction(handle.db);
  } catch (e) {
    // The commit is the one statement whose failure leaves the transaction OPEN
    // with the mutation applied. A concurrent READER is enough: COMMIT needs
    // EXCLUSIVE and `begin immediate` never excluded readers. Roll back so the
    // write lock is released and the handle stays usable, then refuse BY NAME
    // inside the family (reproduced: a bare `database is locked` Error and a
    // connection wedged for every other reader).
    try { handle.db.exec("rollback"); } catch { /* nothing useful to do */ }
    discardSnapshot(staging);
    if (e instanceof ViceError) throw e;
    throw new AnnoStoreError(
      `${handle.path}: the write for revision ${rev + 1} could not be committed (${(e as Error).message}). ` +
        `Nothing was written and the transaction has been rolled back, so the store is at revision ${rev}.`,
      { data: { path: handle.path, revision: rev, step: "commit" } },
    );
  }
  try { pruneSnapshots(handle); } catch { /* WR-02 */ }
}
```

Add a cross-process test in the shape `anno-durability.test.ts` already uses: a
child holding a read transaction, a parent write, asserting the throw is an
`AnnoStoreError`, that `currentRevision()` is unchanged, and that
`handle.db.exec("begin immediate")` afterwards succeeds.

### CR-07: `reconcileSnapshotRing`'s own transaction is not exception-safe, and step 9 swallows the throw — an accepted write can silently wedge its handle and lock the store out for every reader

**File:** `src/mcp/vice/anno-store.ts:690-781` (with `:840` and `:1182-1186`)
**Severity:** BLOCKER

**Issue:**
28-11 gave the sweep a transaction of its own but no `try/finally`. Everything
between `begin immediate` (`:702`) and `commitTransaction` (`:757`) can throw and
leave that transaction open **on the caller's connection**:

* `commitTransaction` itself — `SQLITE_BUSY` from a concurrent reader, exactly as
  in CR-06, or `SQLITE_FULL`/`SQLITE_IOERR`;
* `readdirSync(snapshotDir)` (`:735`) — `EACCES` on the ring directory, or
  `ENOTDIR` when a regular file sits at the ring path (that input is *named* as
  reachable in WR-01's own pre-lock comment at `:1031-1037`);
* `dropRow.run()` (`:747`) and the two `prepare().all()` reads.

Reproduced, driving the exported sweep with one orphan row planted and a second
connection holding a read transaction:

```
sweep THREW after 5011 ms: Error | inFamily: false | database is locked
LEAKED TRANSACTION on A -> cannot start a transaction within a transaction
rows visible to A (inside its open txn): [ 0, 2 ]
rows visible to B: Error: database is locked          <-- the READER is now locked out too
```

and again with `EACCES` on the ring directory, which throws before the row
deletes:

```
retainedRevisions under EACCES: []            <-- every revision reads as unretained
sweep THREW: Error EACCES | inViceFamily: false
transaction state: STILL OPEN -> cannot start a transaction within a transaction
second connection blocked 5038 ms then: database is locked
```

Three compounding properties:

1. **It is silent on the production path.** `pruneSnapshots` is called from step 9
   inside WR-02's deliberately non-rethrowing wrap, so the write reports success
   and the handle is left holding a write transaction with nothing recording it.
   WR-02's swallow is correct; it is the missing `finally` that turns it into a
   silent wedge.
2. **The state conceals itself.** Once a transaction is leaked, every later sweep
   on that connection fails `begin immediate` with "cannot start a transaction
   within a transaction" and returns `deferred: true` — the same value ordinary
   contention produces. The doc comment at `:659-668` reads that value as "another
   writer holds the lock", which is then wrong.
3. **`revertTo` leaks the handle as well.** Step 6 (`:1551-1552`) is
   `const restored = openStore(storePath); reconcileSnapshotRing(restored);` with
   no `try`. If the sweep throws, the revert has already happened, the caller gets
   a non-family exception and no handle, and `restored` is unreachable while
   holding the store's write lock — nothing can close it.

Note the `existsSync`-based existence witness contributes to the `EACCES` case:
`existsSync` returns `false` for "cannot stat", so an unreadable ring makes every
revision read as unretained (`retained []` above) and drives the sweep toward
deleting every pointer row — CR-05's damage with a third cause.

**Fix:** make the transaction's lifetime structural, and keep the function's own
"decline rather than half-sweep" contract when it cannot finish:

```ts
try {
  handle.db.exec("begin immediate");
} catch {
  return { droppedRows, droppedFiles, deferred: true };
}
let orphanFiles: string[];
try {
  /* steps 2-3, unchanged */
  commitTransaction(handle.db);
} catch (e) {
  // A THROW HERE MUST NOT LEAVE THE CALLER'S CONNECTION IN A TRANSACTION. It
  // would hold the store's write lock with nothing to release it -- reproduced:
  // a concurrent reader could no longer read at all -- and step 9's WR-02 wrap
  // swallows the exception, so the wedge is silent.
  try { handle.db.exec("rollback"); } catch { /* nothing useful to do */ }
  return { droppedRows: [], droppedFiles: [], deferred: true };
}
/* step 5, the unlinks, outside the transaction as today */
```

Returning `deferred: true` keeps `pruneSnapshots`' early return correct and keeps
the failure in the harmless "extra FILES" direction. Then either give the sweep a
third state, or state in the doc comment that `deferred` now covers both "another
writer holds the lock" and "this sweep could not complete". Also wrap step 6 of
`revertTo` so a sweep failure closes `restored` and still returns a usable handle
(the revert has already succeeded; the sweep is housekeeping). Add two tests: the
reader-versus-sweep interleave above, asserting the connection has no open
transaction afterwards; and a `revertTo` whose step-6 sweep fails, asserting the
caller gets a handle.

## Warnings

### WR-12: the new confinement predicate throws where the old one returned — `ENOTDIR` and `EACCES` now escape `openStore` as bare `Error`s

**File:** `src/mcp/vice/anno-types.ts:773-775` (used by `:843` and `:947-957`)
**Severity:** WARNING

**Issue:** 28-12 correctly replaced `existsSync` with `lstat` in the ancestor
walk, but `lstatSync(p, { throwIfNoEntry: false })` suppresses **only `ENOENT`**:

```ts
function pathEntryExists(p: string): boolean {
  return lstatSync(p, { throwIfNoEntry: false }) !== undefined;
}
```

`existsSync` never threw; `lstatSync` does. Measured on this host (Node 22.22):
`ENOTDIR case -> THREW ENOTDIR`, `EACCES case -> THREW EACCES`. The walk's first
call is on the caller's own unvalidated path, so the ordinary input
`<ws>/notes.txt/p.annostore` — an ancestor that is a regular file — now escapes
the family. Old versus new, same input, same host:

```
OLD (pre-28-12) accepted: /tmp/anno-cmp-XXXX/ws/notes.txt/p.annostore
NEW threw: Error ENOTDIR
```

```
A)  threw: Error | inViceFamily: false | ENOTDIR: not a directory, lstat '.../ws/notes.txt/p.annostore'
A2) openStore threw: Error | inViceFamily: false
B)  (EACCES on an ancestor directory) threw: Error | inViceFamily: false | EACCES
```

Before the change, `openStore` refused these with `AnnoStorePathError` naming the
path (28-08's constructor wrapper). This also contradicts
`realpathOfNearestExisting`'s own doc comment at `:830-833`: "Every
`realpathSync`, `lstatSync` and `readlinkSync` failure is rethrown as
`AnnoStorePathError` naming the path" — true of the three wrapped call sites, not
of the one inside the predicate. `anno-confinement.test.ts` now has twelve cases
and none plants a non-directory or unreadable ancestor, which is why the gap is
invisible to a green suite.

**Fix:** keep the predicate a predicate for the one class it is about, and put
everything else in the family:

```ts
function pathEntryExists(p: string, resolved: string): boolean {
  try {
    return lstatSync(p, { throwIfNoEntry: false }) !== undefined;
  } catch (e) {
    // `throwIfNoEntry: false` suppresses ENOENT ONLY. ENOTDIR (an ancestor that
    // is a regular file) and EACCES still throw, and before 28-12 `existsSync`
    // returned false for both -- so an ordinary caller path regressed from a
    // named AnnoStorePathError to a bare Error.
    throw new AnnoStorePathError(
      `cannot stat the path entry ${JSON.stringify(p)} while confining ${JSON.stringify(resolved)} (${(e as Error).message})`,
      { path: resolved },
    );
  }
}
```

and add two `anno-confinement.test.ts` cases — a regular-file ancestor and an
unreadable ancestor directory — each asserting `AnnoStorePathError` and that
nothing was created.

### WR-03: a genuine lock timeout is reported as store corruption

**File:** `src/mcp/vice/anno-store.ts:391-403`
**Severity:** WARNING
*(carried forward, unchanged; and CR-06 above makes contention on this path
demonstrably reachable)*

**Issue:** the `try` wraps only `select schema_version, revision from anno_meta`,
but the `catch` converts **any** error into `AnnoStoreCorruptError` whose message
says the store is "truncated, empty or foreign". A concurrent writer holding the
lock past the 5 s `busy_timeout` therefore surfaces as "your annotations are
gone".

**Fix:** discriminate before classifying:

```ts
} catch (e) {
  db.close();
  const code = (e as { code?: string }).code ?? "";
  if (/SQLITE_BUSY|SQLITE_LOCKED/.test(code) || /database is locked/.test((e as Error).message)) {
    throw new AnnoStoreError(`${resolved}: another process holds the store lock -- the store is NOT corrupt`);
  }
  throw new AnnoStoreCorruptError(...);
}
```

See IN-05: the message substring is currently the only discriminator available.

### WR-05: the enum no-op check compares JSON text, so key ORDER decides whether an identical enum is accepted or refused

**File:** `src/mcp/vice/anno-store.ts:1840` (and `:1897-1902`)
**Severity:** WARNING
*(carried forward, unchanged)*

**Issue:** `existing.variants === variantsJson` compares
`JSON.stringify(validatedVariants(...))`, and `validatedVariants()` deliberately
preserves the caller's key order verbatim (`:1766-1768`). The same enum with its
keys reordered is therefore not equal, contradicting `createProjectEnum`'s own doc
comment ("A byte-identical repeat is a no-op reporting `changed:false`, so
re-running a generation pass is safe"). `updateProjectEnum` has the mirror flaw:
a reorder-only update reports `changed:true` and rewrites the row.

**Fix:** compare by VALUE while storing the keys verbatim:

```ts
function sameVariants(storedJson: string, next: Record<string, string>): boolean {
  const byValue = (m: Record<string, string>) =>
    Object.entries(m).map(([k, v]) => [parseVariantKey(k), v] as const).sort((a, b) => a[0] - b[0]);
  return JSON.stringify(byValue(JSON.parse(storedJson))) === JSON.stringify(byValue(next));
}
```

### WR-06: `baseRevision` is the one argument no validator touches

**File:** `src/mcp/vice/anno-store.ts:1024` (every entry point's `args.baseRevision`)
**Severity:** WARNING
*(carried forward, unchanged)*

**Issue:** every other argument goes through an `assert*`/`parse*` before any SQL
runs — that is `anno-types.ts`'s whole premise, because the transport validates
nothing. `baseRevision` goes straight into
`baseRevision !== undefined && baseRevision !== rev`, so a JSON caller supplying
`"1"` is told its base disagrees with a number it visibly equals, and `null` reads
as "I have a base" rather than "I have none".

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

**File:** `src/mcp/vice/anno-types.ts:1003`, `:1024`, `:1059-1068`; `src/mcp/vice/anno-store.ts:1774-1796`
**Severity:** WARNING
*(carried forward, unchanged)*

**Issue:** `MAX_COMMENT_BYTES` (`anno-types.ts:296`) exists because "[b]etween an
unvalidated caller argument (the transport validates nothing) and unbounded blob
growth in the store file, this number is the only thing standing". The same
argument applies verbatim to three neighbouring fields with no bound at all:
`LEGAL_IDENTIFIER_RE` accepts an identifier of any length, `assertEnumName`
likewise, and `validatedVariants` bounds neither the number of variants nor the
length of a variant name.

**Fix:** add a byte bound to both identifier validators and to the serialised
variants mapping, reusing `utf8ByteLength()` (`:1073`) and refusing over-long
values BY NAME (never truncating):

```ts
export const MAX_IDENTIFIER_BYTES = 255;
export const MAX_VARIANTS_BYTES = MAX_COMMENT_BYTES * 16;
```

### WR-08: `retype` merges adjacent same-type rows and fragments a row on a same-type subrange retype; neither behaviour is pinned

**File:** `src/mcp/vice/anno-store.ts:1243-1269`
**Severity:** WARNING
*(carried forward, unchanged — `anno-overlap.test.ts:463` still exercises two
separate `setDataType` calls, so neither behaviour can go red)*

**Issue:** two observable behaviours of the retype path that no test covers, on a
requirement (`STORE-02`) that explicitly forbids merging. Retyping the union of
two adjacent same-type rows deletes both and inserts one — two rows a human
deliberately kept separate are merged, their ids and boundaries gone — and
`changed:true` is reported for what is semantically a no-op, while
`AnnoWriteResult`'s doc comment says `changed` "is the ONLY signal that
distinguishes a no-op from a real edit". The mirror case (retyping a subrange of
one row to the type it already has) splits the row and churns every id.

**Fix:** decide the semantics and pin them. Minimum: add both cases to
`anno-overlap.test.ts` asserting today's row sets by value. If the merge is
unwanted, skip the delete/re-insert when a covered row's `data_type` already
equals `dataType` and its span lies wholly inside `start..endInclusive`; if it is
wanted, say so in `retype()`'s doc comment next to the `STORE-02` reference,
because the two currently read as contradictory.

### WR-09: `listProjectEnums` parses stored JSON with no guard

**File:** `src/mcp/vice/anno-store.ts:1929`
**Severity:** WARNING
*(carried forward, unchanged)*

**Issue:** `JSON.parse(row.variants)` on a row that `openStore`'s
`integrity_check` cannot vet (a hand-edited store, a foreign producer) throws a
bare `SyntaxError`, escaping the family and naming neither the enum nor the store
path.

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

### WR-10: two seam-private exports are public API of a published package, and the new tests entrench them

**File:** `src/mcp/vice/anno-store.ts:906` and `:1212`; `src/mcp/vice/package.json:73`
**Severity:** WARNING
*(carried forward; 28-11 widened the dependency)*

**Issue:** `anno-seam.test.ts` bounds `applyWriteWithoutCommit` and
`stageSnapshot` to "no shipped module *in this repo* names them", which says
nothing about consumers of the published `@henols/vice-mcp` tarball, and
`anno-store.ts` is in `files[]`. Calling `applyWriteWithoutCommit` leaves the
connection inside an open transaction with the CAS applied and the pointer row
inserted — the CR-02 and deferred-prune tests added by 28-11 rely on exactly that
property, so two more call sites now depend on the unguarded export.

**Fix:** gate both on an explicit test-only opt-in rather than exporting them
unconditionally — e.g. a required `{ iAmTheDurabilityProof: true }` member on the
options object, or `process.env.ANNO_STORE_DURABILITY_PROOF === "1"` — and have
`anno-seam.test.ts` pin the guard itself.

### WR-11: `revertTo` replaces the store file under any other open connection, which then writes into an unlinked inode

**File:** `src/mcp/vice/anno-store.ts:1450-1554`
**Severity:** WARNING
*(carried forward; and observed in passing while verifying CR-07 — a reader
holding a lock on the pre-revert inode does not contend with the post-revert
connection at all, which is the divergence itself)*

**Issue:** `revertTo` closes only *its own* handle before renaming the staged
image over the store path. A second connection keeps its descriptor on the **old
inode**: it sees none of the revert, its SQLite POSIX locks no longer coordinate
with anyone, and every write it makes lands in a file nothing will ever open
again. The doc comment's "atomic from a reader's point of view" is true only of
readers that open the path *after* the rename.

Three smaller points in the same body: the `rmSync(staging, { force: true })` in
the step-3 and step-5 catches (`:1497`, `:1517`) is unguarded, so a failure there
replaces the real error (`discardSnapshot()` at `:961-967` exists for exactly
this and is not used); the `${storePath}.revert-${pid}-${revision}` staging file
(`:1484`) sits outside every sweep's pattern, so a kill between the copy and the
rename leaks it permanently; and step 6 can now throw (CR-07) after the revert has
already happened.

**Fix:** state the single-connection precondition in the doc comment and enforce
what can be enforced — take `begin immediate` before staging so no concurrent
*writer* can be mid-transaction, route both cleanup calls through
`discardSnapshot()`, and wrap step 6. If concurrent readers must survive a revert,
the replacement has to be done in place (a `VACUUM INTO` back over the open
connection, or a `delete`+`insert` restore inside one transaction) rather than by
rename.

## Info

### IN-05: every wrapped refusal drops the underlying SQLite code, so contention and corruption are only distinguishable by substring

**File:** `src/mcp/vice/anno-store.ts:1043-1047`, `:1121-1125`, `:360`, `:432`; `src/mcp/vice/vice.ts:245-249`
**Severity:** WARNING (informational tier)
**Issue:** `ViceErrorOptions` carries `code` and `data` and no `cause`, and none
of the new wraps sets `code` — the original error object is preserved only as
interpolated text. So a caller cannot ask "was this `SQLITE_BUSY`?" without
matching `/database is locked/` on the message, which is what makes WR-03 awkward
to fix at the call site and what makes the CR-06 escape hard to classify even once
it is wrapped.
**Fix:** set `code` from `(e as { code?: string }).code` on every wrap, and add
`cause` to `ViceErrorOptions` (assigning `this.cause = cause`) so the chain
survives. Both are additive.

### IN-01: a non-number, non-string range end is reported as a range-shape error

**File:** `src/mcp/vice/anno-store.ts:1393-1394`
**Severity:** WARNING (informational tier)
**Issue:** the documented split ("`parseStoreAddress` owns the STRING forms
only... a numeric argument is passed straight through") means `null`, `true` or
`{}` reach `assertRangeShape`, which reports
`start [object Object] is outside the address space` — an `AnnoRangeShapeError`
where `AnnoAddressError` ("that is not an address") is the answer the comment says
a caller must be able to tell apart.
**Fix:** in `setDataType`, route anything that is not `typeof === "number"`
through `parseStoreAddress` too; numbers keep the current pass-through.

### IN-02: `fsyncPath` opens with `"r"`

**File:** `src/mcp/vice/anno-store.ts:322-329`
**Severity:** WARNING (informational tier)
**Issue:** `fsync` on a read-only descriptor, and `openSync` on a *directory* at
all, are not portable (both fail on Windows). Fine for the Linux/macOS hosts this
tree targets; noted so a later port does not discover it as a silent durability
loss. A pending todo already tracks it.
**Fix:** none required today; if portability is added, guard with
`process.platform === "win32"` and document that the directory fsync is skipped.

### IN-03: `resolveAt` does not check the index length

**File:** `src/mcp/vice/anno-index.ts:142-150`
**Severity:** WARNING (informational tier)
**Issue:** the address bound is validated but `index.length` is not, so a
short/foreign `Int32Array` returns `undefined` typed as `number` — which would
compare unequal to `NO_ROW` and read as "some row covers this".
**Fix:** `if (index.length !== PAINT_INDEX_SIZE) throw new AnnoRangeShapeError(...)`
once at the top of the function.

### IN-04: the fixture overlap census never expires a range ending at `$FFFF`

**File:** `src/mcp/vice/anno-index.test.ts:147-160` (`fixtureOverlapCensus`)
**Severity:** WARNING (informational tier)
**Issue:** removals are keyed at `endInclusive + 1`, which is `0x10000` for a
range ending at the top of memory — outside the sweep, so such ranges stay
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
_Round: 3 (supersedes the round-2 review of the same file set; every round-2 id is dispositioned above)_
