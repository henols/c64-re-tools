---
phase: 28-the-store-core
reviewed: 2026-08-27T19:13:52Z
depth: standard
files_reviewed: 14
files_reviewed_list:
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
  warning: 11
  info: 4
  total: 18
status: issues_found
---

# Phase 28: Code Review Report

**Reviewed:** 2026-08-27T19:13:52Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the whole `anno-*` vertical plus the `block-class.ts` / `r2000-coverage.test.ts`
edits. The 113 tests in the phase's own five test files all pass locally
(`node --test anno-*.test.ts block-class.test.ts` → 59 + 54 pass, 0 fail), and the
structural guards (`anno-seam.test.ts`, the module-level-mutable-state scans, the
`files[]` assertions, the derived `block-class` cross-check) are genuinely
falsifiable — every one carries its own non-vacuity assertion and I could not find
a tautological or self-satisfying assertion among them. The overlap arithmetic in
`retype()` is correct for all five geometric cases, the paint index is correct at
both inclusive ends and at `$FFFF`, the validators are total, and every statement
except the fixed `DDL`, the transaction keywords and the one escaped `vacuum into`
is a bound-parameter `prepare().run()`. There is no SQL injection.

The defects are concentrated in the **snapshot ring / revert surface** and in the
**path confinement**, and they are not hypothetical — three of them I reproduced
against the real code:

* `revertTo()` restores `anno_snapshot` *from the snapshot image*, so after any
  revert the pointer rows describe files the prune has already deleted.
  `oldestRetainedRevision()` then reports a revision that cannot be reverted to,
  and following that advice destroys the handle with a raw `ENOENT` instead of the
  named refusal `STORE-04` requires (CR-01, reproduced).
* the snapshot path is `rm`'d and re-written with no synchronisation and no
  ownership check, so a committed pointer row can end up describing a *different*
  revision's bytes — a silently wrong revert (CR-02, consequence reproduced).
* `storePathWithinWorkspace()` compares `resolve()`d paths, not real paths, so a
  symlink inside the workspace places the store file outside it — the exact
  outcome `anno-store.ts` trap 7 exists to prevent (CR-03, reproduced).

The prune's own file-then-row ordering also contradicts the rationale trap 10
states for it (WR-01), which is the second route into CR-01's broken state.

Design invariants named as out of scope in the review brief (the single
`node:sqlite` seam, no module-level mutable binding, the frozen twelve, no
adjacency coalescing on the insert path, `ExperimentalWarning`, the spawned
mutator) were verified as *held*, not reported as defects.

## Critical Issues

### CR-01: after any `revertTo`, the pointer rows outlive their files — the reported floor lies and following it closes the caller's handle with a raw `ENOENT`

**File:** `src/mcp/vice/anno-store.ts:802-833` (with `:408-412` and `:430-451`)

**Issue:**
`revertTo()` replaces the whole store file with the snapshot image, and
`anno_snapshot` is part of that image. The snapshot for revision *r* was taken
*before* the pointer row for *r* was inserted (`:499` precedes `:511`), so the
restored table holds pointer rows for revisions `0..r-1`. On a store that has been
written past the ring bound, those files were already deleted by
`pruneSnapshots()` — so the restored table points at files that do not exist, and
nothing ever reconciles it.

Three consequences, all reproduced on the committed code (40 writes, then
`revertTo(8)`):

```
rev 40  files 32  oldestRetained 8
after revertTo(8): rev 8 rows 8
pointer rows now: [0,1,2,3,4,5,6,7]          <- every one of these files is gone
files now: r8.db..r39.db                     <- 32 files no pointer row claims
oldestRetainedRevision REPORTS: 0            <- a floor that cannot be honoured
revertTo(3) threw: Error ENOENT: no such file or directory, copyfile '.../r3.db'
handle UNUSABLE after failed revert: Error database is not open
```

1. `oldestRetainedRevision()` returns `0`. Its own doc comment says it is read from
   the rows precisely so it can never "name a revision no row records, and a floor
   naming an unrevertable revision is worse than no floor at all" — the failure it
   was written to avoid is the one it now produces.
2. `revertTo(3)` finds a pointer row, so it never reaches the named-refusal branch.
   It closes the handle (`:823`), then `copyFileSync` throws a bare Node `ENOENT`
   `Error` — not an `AnnoStoreError`, not a `ViceError`, breaking the family
   contract `AnnoCommentGradeError`'s doc comment is built on — and the caller is
   left holding a closed handle. Every later call throws `database is not open`.
   `STORE-04` requires a revert past the bound to be "refused BY NAME"; here it is
   a crash that also destroys the connection.
3. The refusal message for any *other* unreachable revision names `oldest = 0`, so
   it actively steers the caller into (2).
4. 32 snapshot files are orphaned and never pruned (`pruneSnapshots()` iterates
   *rows*, so a file with no row is invisible to it). The `MAX_SNAPSHOT_REVISIONS`
   bound on the directory — threat `T-28-diskgrowth` — no longer holds after a
   revert.

**Fix:** reconcile the two truths at the one place that can, and make the revert
path fail before it destroys anything:

```ts
export function revertTo(handle: AnnoStoreHandle, revision: number): AnnoStoreHandle {
  const pointer = handle.db.prepare("select path from anno_snapshot where revision = ?").get(revision) as
    | { path: string }
    | undefined;
  // A pointer row whose file is gone is NOT a reachable revision: after a
  // revert the restored table names files the prune already removed.
  if (!pointer || !existsSync(pointer.path)) {
    throw new AnnoStoreError(`cannot revert to revision ${revision}: no snapshot is retained for it. ...`);
  }
  ...
  // and do the copy + fsync BEFORE closeStore(handle) -- see WR-02.
}
```

and make `oldestRetainedRevision()` report the smallest revision whose file is
actually present, so the floor it publishes is one `revertTo` can honour. Either
that, or reconcile on open: drop pointer rows with no file and adopt orphan files
whose revision is derivable from the filename (the durability test already proves
that derivation works).

### CR-02: the snapshot path is re-created with no ownership check, so a committed pointer row can describe a different revision's bytes

**File:** `src/mcp/vice/anno-store.ts:485-511`

**Issue:**
`runWriteSequence()` reads the revision (`:485`), computes
`snapshots/r<rev>.db`, **unconditionally deletes whatever is there** (`:498`) and
re-creates it with `vacuum into` (`:499`) — all *before* `begin immediate` (`:501`),
i.e. outside any lock and with no check that the path is not already owned by a
committed pointer row.

The interleaving is reachable and the module explicitly supports concurrent
writers (`{ timeout: 5_000 }` at `:317`, plus a cross-process CAS test):

```
B: reads rev = 5                                  (:485)
A: reads rev = 5, vacuums r5.db, CAS 5->6, inserts pointer (5, r5.db), COMMITS
B: rmSync(r5.db)   <- deletes the file A's committed pointer row references (:498)
B: vacuum into r5.db  <- re-creates it from the CURRENT (revision 6) state (:499)
B: begin immediate; CAS on rev=5 fails -> rollback, AnnoStoreStaleRevisionError
```

B's write is correctly refused, but the store is left with pointer row
`(5 → r5.db)` describing revision **6**. `revertTo(5)` then silently restores the
wrong revision. Reproduced (the interleaving simulated by performing B's two
statements at `:498-499` verbatim):

```
rev 2 rows 2
revertTo(1) gave revision 2 with 2 row(s) -- expected revision 1 with 1 row
```

A narrower kill inside the same window (after B's `rmSync`, before B's vacuum
completes) leaves the pointer row aimed at a missing/partial file, which is
trap 10's forbidden state reached by a second route.

Note the `vacuum into` is a full database copy, so the window is proportional to
store size — it is not a microsecond race.

**Fix:** make the snapshot filename unique per attempt and only publish it inside
the transaction, so a losing writer can never touch a winner's file:

```ts
const staging = join(dirname(snapPath), `r${rev}.${process.pid}.${randomUUID()}.tmp`);
mkdirSync(dirname(staging), { recursive: true });
handle.db.exec(`vacuum into ${sqlQuotedPath(staging)}`);
handle.db.exec("begin immediate");
const cas = ...;                       // only the winner gets here
renameSync(staging, snapPath);         // still before the pointer-row insert
handle.db.prepare("insert into anno_snapshot(revision, path) values (?, ?)").run(rev, snapPath);
```

and unlink `staging` on the rollback path. Do **not** keep the unconditional
`rmSync(snapPath)`: "a revision number can recur after a revert" is real, but the
stale file must be removed by the writer that *owns* the new pointer row, not by
one that may be about to be refused.

### CR-03: the workspace confinement is bypassed by a symlink — the store file is created outside the workspace root

**File:** `src/mcp/vice/anno-types.ts:702-712`

**Issue:**
`storePathWithinWorkspace()` compares `resolve(path)` against
`resolve(workspaceRoot) + sep`. `resolve()` normalises `..` but does **not**
resolve symbolic links, so a symlink anywhere inside the workspace escapes the
confinement. Reproduced:

```
A) confinement BYPASSED via symlink; file created outside workspace: true
```

(`workspaceRoot = <ws>`, `path = <ws>/escape/p.annostore`, where `<ws>/escape` is a
symlink to a directory outside `<ws>`.)

This is the control whose entire stated purpose is that "a store write [must not]
land on the HOST filesystem, silently, outside the workspace"
(`anno-store.ts` trap 7), and it guards a path that arrives **unvalidated from the
transport** by this module's own header premise (`vice-proxy.ts`'s validator is
`(value) => ({ value })`). A checked-in or agent-created symlink is enough; no
privileged access is needed.

**Fix:** compare real paths, and resolve the deepest existing ancestor so a
not-yet-created store file still works:

```ts
import { realpathSync } from "node:fs";

function realpathOfNearestExisting(p: string): string {
  let current = resolve(p);
  const tail: string[] = [];
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) return resolve(p);   // nothing on this path exists
    tail.unshift(basename(current));
    current = parent;
  }
  return join(realpathSync(current), ...tail);
}

export function storePathWithinWorkspace(path: string, workspaceRoot: string): string {
  const resolvedRoot = realpathSync(resolve(workspaceRoot));
  const resolvedPath = realpathOfNearestExisting(path);
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(resolvedRoot + sep)) {
    throw new AnnoStorePathError(...);
  }
  return resolvedPath;
}
```

Add a test alongside the existing sibling-prefix pin: a symlinked subdirectory
must be **refused**, not followed.

## Warnings

### WR-01: the prune deletes the file before its pointer row, which is the opposite of what trap 10's own argument requires

**File:** `src/mcp/vice/anno-store.ts:437-450`

**Issue:** trap 10 states the preference explicitly — "extra files" are harmless,
"a pointer row aimed at a file that is already gone" is "the one failure direction
the revert path cannot survive" — and then concludes "The file is deleted before
its pointer row for the same reason -- the opposite order can produce the bad
state and this one cannot." That conclusion is inverted. The loop is:

```ts
rmSync(row.path, { force: true });                                   // file first
handle.db.prepare("delete from anno_snapshot where revision = ?").run(row.revision);  // row second
```

The prune runs outside any transaction (correctly, per the same trap), so a kill
between the two statements leaves **exactly** the forbidden state: a surviving
pointer row whose file is gone. Row-then-file leaves an orphan file, which the
same trap calls harmless and which `anno-durability.test.ts` already proves is
reconcilable by revision number. Secondarily, `rmSync`'s failure is swallowed
(deliberately) but the row is then deleted **unconditionally**, so an
undeletable file becomes a permanent orphan the ring bound can no longer see.

**Fix:** swap the two statements and drop the file only after its row is gone:

```ts
for (const row of doomed) {
  handle.db.prepare("delete from anno_snapshot where revision = ?").run(row.revision);
  try {
    rmSync(row.path, { force: true });
  } catch {
    // an orphan FILE is the harmless direction -- see trap 10
  }
}
```

and correct trap 10's last three sentences so the comment stops asserting the
opposite of what the code should do.

### WR-02: `revertTo` closes the handle before any filesystem work, so any I/O failure leaves the caller with no usable handle

**File:** `src/mcp/vice/anno-store.ts:823-832`

**Issue:** `closeStore(handle)` runs first, then `copyFileSync`, two `fsyncPath`s
and `renameSync`. Any failure in that sequence (`ENOENT` per CR-01, `ENOSPC`,
`EACCES`, `EXDEV`) throws with the connection already closed and no replacement
handle returned. The caller cannot even read the current revision to find out what
state it is in — demonstrated above (`handle UNUSABLE after failed revert`).
`anno-durability.test.ts:...` already has to guard its own `closeStore` in a
`try/catch` because of this asymmetry.

**Fix:** stage and fsync the copy **before** closing, and clean up the staging file
on failure:

```ts
const staging = `${storePath}.revert-${process.pid}-${revision}`;
copyFileSync(snapPath, staging);   // handle still open and usable if this throws
fsyncPath(staging);
fsyncPath(dir);
closeStore(handle);
try {
  renameSync(staging, storePath);
  fsyncPath(dir);
} catch (e) {
  rmSync(staging, { force: true });
  throw e;
}
```

### WR-03: a genuine lock timeout is reported as store corruption

**File:** `src/mcp/vice/anno-store.ts:328-341`

**Issue:** the `try` wraps only `select schema_version, revision from anno_meta`,
but the `catch` converts **any** thrown error into `AnnoStoreCorruptError` with a
message that says the store is "truncated, empty or foreign". A concurrent writer
holding the write lock longer than the 5 s busy timeout — precisely the situation
`{ timeout: 5_000 }` exists for, and one made likely by the full-database
`vacuum into` on every write — surfaces as "your annotations are gone". That is the
exact confusion this module's header says it exists to prevent, in the other
direction.

**Fix:** discriminate on SQLite's error code and rethrow busy/locked as its own
refusal:

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

### WR-04: `openStore` throws raw SQLite errors and leaks the connection on the fresh-store path

**File:** `src/mcp/vice/anno-store.ts:314-326`

**Issue:** two related gaps.

1. `new DatabaseSync(resolved, ...)` at `:317` is outside every `try`. Reproduced:
   a path that is a directory, and a path whose parent does not exist, both throw
   `Error: unable to open database file` — a bare SQLite error, no path, no
   `AnnoStoreError`, breaking the "everything the store throws is a `ViceError`"
   property that `AnnoCommentGradeError`'s whole rationale rests on.
2. The `fresh` branch (`:320-326`) runs `begin immediate`, the `DDL` and the meta
   insert with no `try`. If any statement fails — most plausibly a second process
   that also saw `existsSync === false`, giving `table anno_meta already exists` —
   the function throws with the connection **open** and the transaction **open**.

**Fix:** wrap the constructor and the fresh-init block, closing the handle and
rewriting the error:

```ts
let db: DatabaseSync;
try {
  db = new DatabaseSync(resolved, { timeout: 5_000 });
} catch (e) {
  throw new AnnoStorePathError(`${resolved}: cannot open an annotation store here (${(e as Error).message})`, { path: resolved });
}
...
if (fresh) {
  try {
    db.exec("begin immediate");
    db.exec(DDL);
    db.prepare("insert into anno_meta(id, schema_version, revision) values (1, ?, 0)").run(SCHEMA_VERSION);
    commitTransaction(db);
  } catch (e) {
    try { db.exec("rollback"); } catch { /* nothing useful to do */ }
    db.close();
    throw new AnnoStoreError(`${resolved}: failed to initialise a fresh annotation store (${(e as Error).message})`);
  }
  return handle;
}
```

### WR-05: the enum no-op check compares JSON text, so key ORDER decides whether an identical enum is accepted or refused

**File:** `src/mcp/vice/anno-store.ts:1119` (and `:1177-1181`)

**Issue:** `existing.variants === variantsJson` compares
`JSON.stringify(validatedVariants(...))`, and `validatedVariants()` deliberately
preserves the caller's key order verbatim. So the same enum supplied with its keys
in a different order is *not* equal, and `createProjectEnum` throws
`AnnoLabelError: already exists with different contents` — contradicting its own
doc comment ("A byte-identical repeat is a no-op reporting `changed:false`, so
re-running a generation pass is safe"). Reproduced:

```
B) reordered IDENTICAL enum REFUSED: AnnoLabelError - project enum "e" already exists with different contents
```

Non-integer-like keys (`"$40"`, `"0b0100"`, i.e. two of the three forms the schema
names) keep insertion order, so this is not a corner case — it fires whenever a
generator's iteration order changes. `updateProjectEnum`'s `changed` computation
has the same flaw in the other direction: a reorder-only update reports
`changed:true` and rewrites the row.

**Fix:** compare by VALUE, keeping the stored keys verbatim (the round-trip
contract is untouched):

```ts
function sameVariants(storedJson: string, next: Record<string, string>): boolean {
  const stored = JSON.parse(storedJson) as Record<string, string>;
  const byValue = (m: Record<string, string>) =>
    Object.entries(m)
      .map(([k, v]) => [parseVariantKey(k), v] as const)
      .sort((a, b) => a[0] - b[0]);
  return JSON.stringify(byValue(stored)) === JSON.stringify(byValue(next));
}
```

### WR-06: `baseRevision` is the one argument no validator touches

**File:** `src/mcp/vice/anno-store.ts:487` (every entry point's `args.baseRevision`)

**Issue:** every other argument goes through an `assert*`/`parse*` before any SQL
runs — that is `anno-types.ts`'s whole premise, because "the transport validates
NOTHING". `baseRevision` is passed straight into
`baseRevision !== undefined && baseRevision !== rev`. A JSON caller supplying
`"3"` (a string), `3.0000001`, or `null` gets `AnnoStoreStaleRevisionError` even
when it is perfectly up to date, and `null` in particular reads as "I have a base"
rather than "I have none".

**Fix:** validate it with the same shape as the rest:

```ts
function assertBaseRevision(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new AnnoStoreStaleRevisionError(
      `baseRevision ${JSON.stringify(value)} is not a revision -- expected a non-negative integer or no value at all`,
      { baseRevision: undefined },
    );
  }
  return value as number;
}
```

### WR-07: label names, enum names and the variants blob have no size bound

**File:** `src/mcp/vice/anno-types.ts:779-823`; `src/mcp/vice/anno-store.ts:1053-1075`

**Issue:** `MAX_COMMENT_BYTES` exists because "[b]etween an unvalidated caller
argument (the transport validates nothing) and unbounded blob growth in the store
file, this number is the only thing standing". The same argument applies verbatim
to three neighbouring fields that have no bound at all:
`LEGAL_IDENTIFIER_RE` accepts an identifier of any length (a 10 MB label name is
legal), `assertEnumName` likewise, and `validatedVariants` bounds each key's
*value* (`MAX_VARIANT_KEY`) but not the number of variants nor the length of a
variant name — so one `createProjectEnum` call can write an arbitrarily large JSON
blob into a single row.

**Fix:** add a byte bound to the identifier validators and to the serialised
variants mapping, reusing the existing measurement helper:

```ts
export const MAX_IDENTIFIER_BYTES = 255;
export const MAX_VARIANTS_BYTES = MAX_COMMENT_BYTES * 16;
```

refusing over-long values by name (never truncating, per trap 7).

### WR-08: `retype` merges adjacent same-type rows and fragments a row on a same-type subrange retype; neither behaviour is pinned

**File:** `src/mcp/vice/anno-store.ts:602-628`

**Issue:** two observable behaviours of the retype path that no test covers, on a
requirement (`STORE-02`) that explicitly forbids merging:

```
two adjacent same-type rows:  [[1,400,4ff,byte],[2,500,5ff,byte]]
after retyping the union to the SAME type: [[3,400,5ff,byte]]  changed = true   <- merged
one code row: [[4,1000,10ff,code]]
after retyping a SUBRANGE to the same type: [[5,1080,10ff,code],[6,1000,107f,code]]  changed = true
```

The first is a merge of two rows a human deliberately kept separate (their ids and
boundaries are gone). The second is a semantic no-op that nevertheless splits the
row, churns every id, and reports `changed:true` — while `AnnoWriteResult`'s doc
comment says `changed` "is the ONLY signal that distinguishes a no-op from a real
edit". `anno-overlap.test.ts`'s adjacency test only exercises the *insert* path, so
either behaviour can be changed in either direction without a single test moving.

**Fix:** decide the semantics and pin them. Minimum: add two cases to
`anno-overlap.test.ts` asserting today's row sets by value, so the behaviour stops
being accidental. If the merge is unwanted, skip the delete/re-insert when a
covered row's `data_type` already equals `dataType` and its span lies wholly
inside `start..endInclusive`; if it is wanted, say so in `retype()`'s doc comment
next to the `STORE-02` reference, because the two currently read as contradictory.

### WR-09: `listProjectEnums` parses stored JSON with no guard

**File:** `src/mcp/vice/anno-store.ts:1208`

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

### WR-10: `applyWriteWithoutCommit` is a public export of a shipped module

**File:** `src/mcp/vice/anno-store.ts:571-577`; `src/mcp/vice/package.json:73`

**Issue:** the wrapper's guard is `anno-seam.test.ts`'s "no shipped module other
than the seam **names** it" — which says nothing about consumers of the published
`@henols/vice-mcp` package, and `anno-store.ts` is now in `files[]`. Calling it
leaves the connection inside an open transaction with the revision CAS already
applied and the snapshot pointer row inserted; `currentRevision()` on that same
connection then reports an advanced revision for a write that will never land, and
every later statement runs inside a transaction nobody meant to start. The comment
calls its only caller "a spawned, test-only helper", but nothing enforces that at
the package boundary.

**Fix:** gate it on the test-only entry rather than exporting it unconditionally,
e.g. require an explicit opt-in token the mutator passes:

```ts
export function applyWriteWithoutCommit<T>(
  handle: AnnoStoreHandle,
  mutate: (db: DatabaseSync) => T,
  opts: { baseRevision?: number; iAmTheDurabilityProof: true },
): { revision: number; result: T }
```

or move it behind `process.env.ANNO_STORE_DURABILITY_PROOF === "1"` and have
`anno-seam.test.ts` pin the guard. Either keeps the "identical code path" property
the durability proof needs.

### WR-11: the CAS-failure refusal omits `currentRevision`, contradicting its own error class's contract

**File:** `src/mcp/vice/anno-store.ts:506-508`

**Issue:** `AnnoStoreStaleRevisionError`'s doc comment says it "[c]arries both
numbers so the caller can say which two disagreed rather than 'conflict'". The
pre-transaction refusal at `:488-491` does. The CAS-failure refusal passes only
`{ baseRevision: rev }`, so `error.currentRevision` is `undefined` on exactly the
path where a concurrent writer moved the revision — the case where the second
number is most informative.

**Fix:**

```ts
const now = handle.db.prepare("select revision from anno_meta where id = 1").get() as { revision: number } | undefined;
handle.db.exec("rollback");
throw new AnnoStoreStaleRevisionError(`refusing the write: the revision moved under us (expected ${rev}, found ${now?.revision})`, {
  baseRevision: rev,
  currentRevision: now?.revision,
});
```

(read the value before the rollback, while the transaction still sees it).

## Info

### IN-01: a non-number, non-string range end is reported as a range-shape error

**File:** `src/mcp/vice/anno-store.ts:752-754`
**Issue:** the documented split of responsibilities ("`parseStoreAddress` owns the
STRING forms only ... a numeric argument is passed straight through") means
`null`, `true` or `{}` reach `assertRangeShape`, which reports
`start [object Object] is outside the address space` — an `AnnoRangeShapeError`
where `AnnoAddressError` ("that is not an address") is the answer the comment says
a caller must be able to tell apart.
**Fix:** in `setDataType`, route anything that is not `typeof === "number"` through
`parseStoreAddress` too; numbers keep the current pass-through.

### IN-02: `fsyncPath` opens with `"r"`

**File:** `src/mcp/vice/anno-store.ts:291-298`
**Issue:** `fsync` on a read-only descriptor, and `openSync` on a *directory* at
all, are not portable (both fail on Windows). Fine for the Linux/macOS hosts this
tree targets; noted so a later port does not discover it as a silent durability
loss.
**Fix:** none required today; if portability is added, guard with
`process.platform === "win32"` and document that the directory fsync is skipped.

### IN-03: `resolveAt` does not check the index length

**File:** `src/mcp/vice/anno-index.ts:139-149`
**Issue:** the address bound is validated but `index.length` is not, so a
short/foreign `Int32Array` returns `undefined` typed as `number` — which would
compare unequal to `NO_ROW` and read as "some row covers this".
**Fix:** `if (index.length !== PAINT_INDEX_SIZE) throw new AnnoRangeShapeError(...)`,
or assert it once at the top of the function.

### IN-04: the fixture overlap census never expires a range ending at `$FFFF`

**File:** `src/mcp/vice/anno-index.test.ts` (`fixtureOverlapCensus`)
**Issue:** removals are keyed at `endInclusive + 1`, which is `0x10000` for a range
ending at the top of memory — outside the sweep, so such ranges stay "active" for
the rest of the sweep. Harmless for the two `> 0` non-degeneracy assertions, but
both counters are slightly overstated, so the numbers must not later be asserted
as exact values.
**Fix:** clamp the removal key (`Math.min(row.endInclusive + 1, ADDRESS_MAX + 1)`)
and skip keys past `ADDRESS_MAX`, or note in the helper that the counts are lower
bounds.

---

_Reviewed: 2026-08-27T19:13:52Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
