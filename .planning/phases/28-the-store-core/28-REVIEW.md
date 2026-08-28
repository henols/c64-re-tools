---
phase: 28-the-store-core
reviewed: 2026-08-28T18:00:00Z
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
  critical: 1
  warning: 14
  info: 5
  total: 20
status: issues_found
---

# Phase 28: Code Review Report (round 4, post 28-13 / 28-14 / 28-15)

**Reviewed:** 2026-08-28
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Fourth round on the same fifteen files, after plans 28-13, 28-14 and 28-15
landed against round 3's `CR-05`, `CR-06`, `CR-07` and `WR-12`.

**Measured state, re-measured here rather than taken from the handoff:** the
eight `anno-*` / `block-class` test files are **159 pass / 0 fail / 0 skipped**
(`node --test`, 15.7 s), and `npx tsc --noEmit` exits 0.

**All four handed-over ids are genuinely closed.** Each was checked against the
code and, where the claim was behavioural, by driving the production functions
directly — not by reading the SUMMARY:

| Round-3 id | Verdict | Evidence |
|---|---|---|
| CR-05 | **Closed** for its reported cause, with a correctly-stated residual | `reconcileSnapshotRing` (`anno-store.ts:766-884`) contains no `delete from anno_snapshot` at all; the source-order control now asserts that ABSENCE and carries a positive needle control against `pruneSnapshots` so a blanked literal cannot make it vacuous. Driven: a store opened through a symlink alias survives one write with every pointer row and file intact. The stated residual was also driven and matches the comment exactly (see below). |
| CR-06 | **Closed** | `anno-store.ts:1264-1325` brackets the commit, rolls back, and refuses in-family carrying `code`. The cross-process control (`anno-durability.test.ts:407-488`) passes with a **measured 5309 ms** block — the writer's real `busy_timeout`, so the contention is genuine and not simulated. |
| CR-07 | **Closed**, both the sweep half and the `revertTo` half | The sweep's whole body is bracketed (`anno-store.ts:801-860`) with no route out that neither commits nor rolls back; `revertTo` step 6 wraps the sweep call (`anno-store.ts:1757-1767`). Residual noted as **WR-17**. |
| WR-12 | **Closed** | `pathEntryExists` (`anno-types.ts:773-783`) wraps every non-`ENOENT` stat failure into `AnnoStorePathError`; three new confinement cases (13/14/15) plant `ENOTDIR`, `EACCES` and ancestor-`ELOOP` and drive each through **both** entry points. |

**The CR-05 residual is correctly bounded and correctly stated.** Driven here:
after 40 writes through a symlink alias, `retainedRevisions()` on the real path
reports `[]`, rows `0..10` are gone (reaped by `pruneSnapshots`' ordinary floor,
exactly as `anno-store.ts:495-507` says), and the real ring's three files leak
permanently. That is the documented under-claim (28-07 P2) plus the documented
footprint residual, in the direction the comment names. Not re-reported as a
finding.

**One new BLOCKER, found by attacking the half of the ring the three rounds
never questioned.** Every round so far has argued about which half-state the
*sweep* may resolve. Nobody asked what `revertTo` does with a snapshot file that
is **present but not a database**:

* **CR-08** — `retainedRevisions()` (`:603-606`) and `revertTo` step 2
  (`:1630`) both witness a snapshot with `existsSync` and nothing else, and
  `revertTo` copies that file over the live store *after* closing the caller's
  handle, with no open and no `integrity_check`. **Reproduced with a 0-byte
  `r1.db`: the live store is replaced by 0 bytes, the caller gets no handle, and
  every later open refuses `AnnoStoreCorruptError`.** The current revision has no
  snapshot by design, so nothing recovers it. This is the module's own
  first measured fact — "A ZERO-LENGTH FILE OPENS, so the refusal is the store's
  OWN job" (`anno-store.ts:22-31`) — applied to `openStore` and never applied to
  the image `revertTo` installs.

**WR-13** is the mechanism that manufactures CR-08's input without anyone
hand-editing a file: the publish path (`stageSnapshot` `:1009-1015`,
`publishSnapshot` `:1047-1049`) never `fsync`s the snapshot or its directory,
while the pointer row that names it is committed durably by SQLite. The module
already owns `fsyncPath()` (`:322-329`) and uses it correctly on the *revert*
path (`:1660-1662`, `:1679-1680`) — the publish path is the one place it is
missing.

**Four further new Warnings are about round 3's own controls rather than its
code**, which is the class this round was asked to look for:

* **WR-14** — two of the three new root-sensitive controls report `ok` instead of
  skipping. `anno-store.test.ts:3098-3104` and `:3187-3193` do
  `assert.ok(true, "SKIPPED as root: … a test that cannot build its own
  precondition must say so rather than pass")` — which is precisely what they
  then do. The sibling control added in the same round
  (`anno-confinement.test.ts` case 14) uses node:test's real `{ skip: … }`. Under
  root the suite still reports 159/159 pass, 0 skipped, with CR-07's only
  behavioural control silently not executed.
* **WR-15** — the seam's "exactly one commit statement" control
  (`anno-seam.test.ts:378-392`) matches `/\bcommit\b/gi`, and SQLite accepts
  `END` / `END TRANSACTION` as exact synonyms of `COMMIT`. A second commit site
  spelled `db.exec("end")` passes the control that exists to keep the durability
  proof's planted violation unique.
* **WR-16** — all three repaired handlers assert an outcome they do not verify
  ("the transaction has been rolled back, so the store is still at revision N",
  `:1311-1314`), after a `rollback` whose own failure is swallowed. Node 22's
  `DatabaseSync` has **no** `isTransaction` (checked: the prototype carries
  `open, close, prepare, exec, function, location, aggregate, createSession,
  applyChangeset, enableLoadExtension, loadExtension`), so the claim cannot be
  checked cheaply — which is a reason not to *assert* it.
* **WR-17** — `revertTo` step 6 guards the sweep but not the `openStore` the
  guard depends on (`:1756`, and again at `:1766`), and that reopen is the more
  likely failure of the two: it runs `integrity_check` on the image the function
  has just installed. The handler itself is unreachable dead code by the code's
  and the test's own admission.

Everything else from round 3 is re-verified in the source and carried forward as
**still open**: eight Warnings (WR-03, WR-05, WR-06, WR-07, WR-08, WR-09, WR-10,
WR-11) and five Info items. `IN-05` is now *half* closed — `code` is set on the
CR-06 wrap only.

Design invariants named as out of scope were re-checked and **hold**: the single
`node:sqlite` seam, the frozen twelve, no adjacency coalescing, no module-level
mutable state, `bank` uninterpreted, `anno-types.ts` outside the host-path
consumer set. There is still **no SQL injection**: every statement is a bound
`prepare().run()` except the fixed `DDL`, the transaction keywords, and the one
`vacuum into` whose argument is refused for `\0`/`\n`/`\r` and single-quote
escaped by doubling (`sqlQuotedPath`, `:311-318`). No debug artifacts, no
`eval`, no dynamic `Function`.

`r2000-coverage.test.ts` was read and is unchanged since 28-03; per the phase
note it is reviewed but not extended or re-verified. Nothing was found in it.

## Structural Findings (fallow)

No `<structural_findings>` block was supplied with this review.

## Narrative Findings (AI reviewer)

### Round-3 finding dispositions

| Id | Disposition |
|---|---|
| CR-05 | **Closed by 28-13** for its reported cause. Verified in code (`anno-store.ts:834-837`, the removed step 3) and by driving a symlink alias. Residual verified as bounded and as stated. |
| CR-06 | **Closed by 28-14.** Verified in code (`:1264-1325`) and by the cross-process control's measured 5309 ms. |
| CR-07 | **Closed by 28-13 + 28-14**, both halves. Verified in code (`:801-860`, `:1757-1767`). Residual filed as WR-17. |
| WR-12 | **Closed by 28-15.** Verified in code (`anno-types.ts:773-783`) and by the three new confinement cases. |
| WR-03 | **Still open** — `anno-store.ts:391-403` unchanged, and CR-06's closure makes contention on this path demonstrably reachable. |
| WR-05 | **Still open** — `anno-store.ts:2054` unchanged. |
| WR-06 | **Still open** — `anno-store.ts:1127` unchanged. |
| WR-07 | **Still open** — `anno-types.ts:1034` unchanged; no byte bound on either identifier validator or on the variants blob. |
| WR-08 | **Still open** — `retype()` (`anno-store.ts:1406-1437`) unchanged. |
| WR-09 | **Still open** — `anno-store.ts:2143` unchanged. |
| WR-10 | **Still open, and further entrenched** — `applyWriteWithoutCommit` gained a fourth mutator mode (`hold-read`) in 28-14; `anno-store.ts` is still in `package.json:73`'s `files[]`. |
| WR-11 | **Still open** — `revertTo` (`anno-store.ts:1613-1771`) unchanged apart from step 6's handler; the unguarded `rmSync(staging, …)` at `:1660` and `:1679` and the unswept `.revert-<pid>-<rev>` staging name at `:1646` are both as reported. |
| IN-01 | **Still open** — `anno-store.ts:1556-1557` unchanged. |
| IN-02 | **Still open** — `anno-store.ts:322-329` unchanged. |
| IN-03 | **Still open** — `anno-index.ts:142-150` unchanged. |
| IN-04 | **Still open** — `anno-index.test.ts:147-175` unchanged. |
| IN-05 | **Half closed** — `code` is now set on the CR-06 wrap (`anno-store.ts:1316`) and on no other wrap; `cause` is still absent from `ViceErrorOptions` (`vice.ts:245-249`). |

### Round-4 finding dispositions

Every id opened by round 4, with the plan that carries it and the evidence from
that plan's own SUMMARY. A `fix` cell names its plan and quotes a number or a
line reference; a cell that could not do that would read `accept` with what makes
it acceptable, in the form the round-4 verifier used for the under-claim residual.

| Id | Disposition |
|---|---|
| CR-08 | **`fix`, by 28-16.** The staged image is OPENED before the caller's handle is closed (new step 3b), and `retained` is promoted to the openable definition read from one witness (`snapshotOpenFailure`). Evidence, from 28-16-SUMMARY.md's before/after table: the live store across `revertTo(handle, 1)` with `r1.db` truncated goes `69,632 bytes -> 0 bytes` before the plan and `69,632 -> 69,632 bytes, byte-identical` after; a later `openStore` went from `AnnoStoreCorruptError … permanently` to succeeding at revision 3; `retainedRevisions()` across the same drive went from `[0, 1, 2]` (advertising an unopenable image) to `[0, 2]`. |
| WR-13 | **`fix`, by 28-17.** `stageSnapshot` fsyncs the staged image after its `vacuum into` and `publishSnapshot` fsyncs the ring directory after its `renameSync`, both through the module's existing `fsyncPath()`, so a durable pointer row can no longer name bytes that never reached disk. The evidence is deliberately STRUCTURAL, and the reason is recorded rather than glossed: an `fsync` has no in-process observable, so a behavioural assertion would be measuring file presence or a read-back and calling it durability — the 28-07 P3 shape. Numbers from 28-17-SUMMARY.md: `grep -c 'fsyncPath(' src/mcp/vice/anno-store.ts` `4 -> 6`, `grep -c 'exec("pragma'` `0` before and after, and the planted red `not ok 50 - the publish path's SOURCE ORDER is the durability guarantee (WR-13) …` observed and reverted. |
| WR-14 | **`fix`, by 28-17.** Both root guards moved out of the test bodies into `node:test`'s declaration options, in `anno-confinement.test.ts` case 14's form, so a control that cannot build its precondition skips visibly instead of reporting a pass. Evidence from 28-17-SUMMARY.md: under a forged `process.getuid` the file reports `# tests 73 / # pass 71 / # fail 0 / # skipped 2` with both reasons, where the pre-task file under the identical forgery reported `# skipped 0` and both controls falsely `ok`. The verifier's own qualifier is carried, not dropped: its round-4 CR-07 evidence did **not** depend on these two controls, so this restores the round's standing guarantee rather than the verdict's basis. Its uid-0 half is a forgery rather than a run as real root, and 28-17 offers it for judgment on exactly that footing. |
| WR-15 | **`fix`, by 28-18 task 1.** The single-commit-site control now matches `exec()` calls whose single argument is a bare statement literal in any of SQLite's three spellings (`commit`, `end`, `end transaction`) instead of counting the word `commit`. Numbers: over a local fixture carrying all three spellings the pre-task matcher yielded **1** and the statement matcher yields **3**; over a fixture of commit-ish identifiers plus a user-facing sentence it yields **0** where the pre-task matcher yielded **1**. The planting that proves WR-15 was real: with a second, working commit site spelled `db.exec("end")` in `anno-store.ts`, the pre-task control reported `ok 15 … 17/17 pass` and the statement matcher reports `not ok 15 … found 2`. The mirror cost is removed with the defect — `anno-store.ts`'s comment recording the `step` value's spelling as load-bearing is deleted (`grep -c "load-bearing"` `5 -> 4`, the value itself unchanged at `grep -c 'step: "committing the write transaction"'` = `1`). |
| WR-16 | **`fix`, by 28-17.** Three handlers stopped asserting a rollback whose own failure they had just swallowed: each records whether its `rollback` returned, the two throwing sites branch the refusal message on the recorded fact and carry `rolledBack` in `data`, and the sweep's handler — which must not throw, because prohibition 28-11 P5 forbids converting a committed write into a caller-visible failure on `revertTo`'s step-6 call path — reports the same fact through a widened `{ droppedFiles, deferred, rollbackFailed }` result instead. Numbers from 28-17-SUMMARY.md: `grep -c "rolledBack"` = **12** (criterion ≥ 6) and `grep -c "rollbackFailed"` = **11** (criterion ≥ 4), with both branch messages driven and their `data.rolledBack` values tabulated. |
| WR-17 | **`fix`, by 28-16 task 3** (`a907fb7`). Both `openStore` calls after the rename in `revertTo` step 6 are inside handlers; a `ViceError` is rethrown unchanged and anything else is wrapped in an `AnnoStoreError` stating the revert **LANDED ON DISK** and naming the store path and the revision (28-11 P5). Decided together with CR-08 because they are the same function and the same failure: CR-08's step 3b removes the reopen's most likely cause of throwing — an image that is not a store — without removing the class, so what is left, a store that became unopenable BETWEEN the rename and the reopen, is exactly the arm WR-17 asks a handler for. The control is structural by necessity, for the reason 28-16-SUMMARY.md records: constructing the guarded failure needs filesystem-level fault injection between the rename and the reopen. |
| carried forward: `behavior_unverified` | **STILL OPEN — not claimed closed by this round.** `openStore`'s `integrity_check could not be run at all` arm (`anno-store.ts:432`) refuses in-family; the expected answer is an `AnnoStoreCorruptError` naming the path with the connection closed and nothing partial returned. The reason is UNCHANGED from round 4: the arm is defensive and has no reachable input without filesystem- or SQLite-level fault injection, so its presence and wiring are verified in source and no test exercises it. No plan in this round (28-16, 28-17, 28-18) constructs that input, and none claims it does. This row is a record so the item cannot be lost between rounds by being ABSENT rather than by being closed. |

## Critical Issues

### CR-08: `revertTo` replaces the live store with a snapshot image it never opens — a snapshot that exists but is not a database destroys the store irrecoverably

**File:** `src/mcp/vice/anno-store.ts:1613-1771` (with `:603-606` and `:1630`)
**Severity:** BLOCKER

**Issue:**
Both witnesses of "this snapshot is usable" are `existsSync` and nothing more:

```ts
// :605 -- retainedRevisions
return rows.filter((row) => existsSync(snapshotPathFor(handle, row.revision))).map((row) => row.revision);

// :1630 -- revertTo step 2, the ONLY gate before the store is replaced
if (!pointer || !existsSync(snapPath)) { … refuse … }
```

After that gate, `revertTo` copies `snapPath` to a staging file (`:1657`),
fsyncs it, **closes the caller's handle** (`:1668`), and renames the staging file
over the store path (`:1675`). Nothing ever opens the image, runs
`pragma integrity_check`, or reads its `anno_meta` row. The one place this
module knows how to make that judgement — `openStore` — runs only *after* the
live store has already been overwritten (`:1756`).

Reproduced against the committed code through production entry points only, with
a snapshot truncated to zero bytes (the shape a crash between `vacuum into` and
`fsync` produces — see WR-13):

```
before:                     rev 3  rows 3  retained [0,1,2]  floor 0
truncate r1.db to 0 bytes
retained AFTER truncation:  [0,1,2]                <-- still advertised as revertible
revertTo(1) THREW: AnnoStoreCorruptError | "…: not an annotation store (no such table: anno_meta)"
store file size now: 0                             <-- the LIVE store is gone
reopen: AnnoStoreCorruptError | not an annotation store
```

Three properties make this a blocker rather than a robustness gap:

1. **The loss is total and unrecoverable.** The store's state at the CURRENT
   revision has no snapshot — that is by design (`revertTo` refuses the current
   revision "because no snapshot records it", `:534-540`). So the bytes destroyed
   here are the only copy.
2. **The caller is left with nothing.** The handle was closed at step 4, the
   throw comes from step 6's `openStore`, and no handle is returned. The step-3
   comment's promise — "every failure reachable here … leaves the caller a
   USABLE handle" — is true of step 3 and false of this failure, which is
   downstream of it.
3. **It needs no crash and no race.** Any snapshot file in the ring that is not
   a valid store — bit rot, a partial copy, a file another tool wrote, or WR-13's
   crash window — is sufficient. `retainedRevisions()` advertises it and
   `oldestRetainedRevision()` publishes it as the floor, so a caller following
   the store's own published floor walks straight into it.

This is the module's own first measured fact turned on its head. The header says
(`:22-31`) that SQLite cannot tell "your annotations are gone" from "there are no
annotations", so "the refusal is therefore the store's OWN job". That reasoning
was applied to `openStore` and never applied to the image `revertTo` installs.

**Fix:** validate the staged copy while the caller's handle is still open — the
exact window step 3's own comment says exists for this purpose — and refuse by
name rather than replacing anything:

```ts
  try {
    copyFileSync(snapPath, staging);
    fsyncPath(staging);
    fsyncPath(dir);
  } catch (e) { /* unchanged */ }

  // STEP 3b. THE STAGED IMAGE IS OPENED BEFORE ANYTHING IS REPLACED. `existsSync`
  // is not a witness that a file is a store -- this module's own first measured
  // fact is that a ZERO-LENGTH FILE OPENS, so presence proves nothing. Validating
  // HERE, with the caller's handle still open, is what keeps a bad snapshot a
  // REFUSAL instead of the irreversible destruction of the current revision --
  // which has no snapshot of its own by design (reproduced: a 0-byte r1.db left
  // the store at 0 bytes with no handle and no recovery).
  try {
    closeStore(openStore(staging));
  } catch (e) {
    rmSync(staging, { force: true });
    throw new AnnoStoreError(
      `cannot revert ${storePath} to revision ${revision}: the retained snapshot ${snapPath} is not a readable annotation store ` +
        `(${(e as Error).message}). NOTHING has been replaced -- the store is still at revision ${currentRevision(handle)} and this ` +
        `handle is still open. The snapshot is left on disk for inspection.`,
      { data: { path: storePath, snapshotPath: snapPath, operation: "validate", revision } },
    );
  }
```

Two supporting changes belong with it: teach `retainedRevisions()`'s consumers
that presence is not validity (at minimum, say so in its doc comment, which
currently calls the file "the EXISTENCE WITNESS" without qualification), and add
a test that truncates a retained snapshot to zero, asserts `revertTo` refuses by
name, asserts the caller's handle still answers `currentRevision()` and
`listRanges()`, and asserts the store file's size and byte content are unchanged.

## Warnings

### WR-13: the published snapshot is never fsynced, so a durable pointer row can name a non-durable file

**File:** `src/mcp/vice/anno-store.ts:1009-1015` and `:1047-1049` (with `:322-329`)
**Severity:** WARNING

**Issue:** `stageSnapshot` runs `vacuum into` and returns; `publishSnapshot` is a
bare `renameSync`. Neither fsyncs the snapshot file, and neither fsyncs the ring
directory the rename lands in:

```ts
export function stageSnapshot(handle, revision): string {
  …
  handle.db.exec(`vacuum into ${sqlQuotedPath(staging)}`);
  return staging;                       // no fsync
}

function publishSnapshot(stagingPath: string, snapPath: string): void {
  renameSync(stagingPath, snapPath);    // no fsync of the file, none of the dir
}
```

The pointer row that names that file is inserted inside the write transaction and
committed by SQLite, which **does** fsync. So the two halves of a revision's
record have different durability: the row is durable, the file is not. The
module's own helper for this — `fsyncPath()`, whose doc comment says "Directory
fsync is what makes a `rename` durable, not just visible" — is used correctly on
the revert path (`:1660-1662`, `:1679-1680`) and is missing here.

Trap 10's premise ("a kill in the window … leaves EXTRA files, which are
harmless") is true of a `SIGKILL`, which is what `anno-durability.test.ts`
exercises, and is not true of a host crash. After a host crash the two reachable
outcomes are: the file's directory entry is missing (an orphan ROW, which
28-13 has now made inert — fine), or the entry is present with unflushed
contents (a snapshot that `retainedRevisions()` advertises and that
**CR-08 then turns into total loss of the live store**).

**Fix:** fsync the staged image and the ring directory, in the order the revert
path already uses, so the file is durable before the row that names it can be:

```ts
export function stageSnapshot(handle: AnnoStoreHandle, revision: number): string {
  const snapPath = snapshotPathFor(handle, revision);
  mkdirSync(dirname(snapPath), { recursive: true });
  const staging = join(dirname(snapPath), `r${revision}.${process.pid}.${randomUUID()}.tmp`);
  handle.db.exec(`vacuum into ${sqlQuotedPath(staging)}`);
  // DURABLE BEFORE IT IS CLAIMED. The pointer row is committed by SQLite, which
  // fsyncs; without this the row is durable and the file it names is not, and a
  // host crash (not a SIGKILL -- the durability proof only covers SIGKILL) can
  // leave a PRESENT, PARTIAL snapshot that `retainedRevisions()` advertises.
  fsyncPath(staging);
  return staging;
}

function publishSnapshot(stagingPath: string, snapPath: string): void {
  renameSync(stagingPath, snapPath);
  fsyncPath(dirname(snapPath));   // the rename itself, made durable rather than merely visible
}
```

### WR-14: two of round 3's three root-sensitive controls report `ok` instead of skipping, so under root the suite is green with CR-07's only behavioural control not executed

**File:** `src/mcp/vice/anno-store.test.ts:3098-3104` and `:3187-3193`
**Severity:** WARNING

**Issue:** both new root guards are written as:

```ts
if (process.getuid?.() === 0) {
  assert.ok(true, "SKIPPED as root: … a test that cannot build its own precondition must say so rather than pass");
  return;
}
```

`assert.ok(true, msg)` never surfaces `msg` and never marks the test skipped — the
runner reports `ok`. The comment states the requirement and the code does the
opposite of it. The third control added in the same round does it correctly, in a
sibling file, with node:test's real mechanism:

```ts
// anno-confinement.test.ts, case 14
test("14. an UNREADABLE ancestor directory …", { skip: process.getuid?.() === 0 ? "running as root: …" : false }, () => { … });
```

The consequence is concrete: under root — a plausible CI/container configuration
for this repo, whose whole architecture assumes a devcontainer on the consumer
side — the CR-07 sweep control and the `revertTo` composite control silently do
not run, and the suite still reports **159 pass / 0 skipped**. A phase note that
records "0 skipped" as evidence of coverage is then measuring the wrong thing.

**Fix:** convert both to the `{ skip: … }` form the confinement file already
uses, so a skipped precondition is visible in the TAP output:

```ts
test(
  "CR-07: a sweep that throws inside its own transaction leaves the caller's connection with NO open transaction",
  { skip: process.getuid?.() === 0 ? "running as root: root ignores directory mode bits, so the unreadable-ring precondition cannot be planted" : false },
  () => { … },
);
```

### WR-15: the "exactly one commit statement" control is blind to SQLite's `END` synonym, and it now constrains user-facing error prose

**File:** `src/mcp/vice/anno-seam.test.ts:378-392` (with `src/mcp/vice/anno-store.ts:1316-1322`)
**Severity:** WARNING

**Issue:** the control that guarantees the durability proof's planted violation
has a unique site counts word occurrences:

```ts
const commitStatements = kept.match(/\bcommit\b/gi) ?? [];
assert.equal(commitStatements.length, 1, …);
```

SQLite accepts **`END`** and **`END TRANSACTION`** as exact synonyms of `COMMIT`.
A second commit site written `handle.db.exec("end")` therefore passes this
control unchanged, splits the planting the control exists to keep unique, and
lets half of the durability violation survive — which is verbatim the failure the
assertion message describes.

The mirror cost has already materialised: because the count runs over string
literals, the CR-06 refusal had to be worded around it, and `anno-store.ts`
now carries a comment explaining that the `step` value must read `"committing"`
and not `"commit"` "and the spelling is load-bearing". A structural invariant
that constrains the wording of user-facing error messages will be broken by the
next person who improves one, and the failure will surface in an unrelated file.

**Fix:** match the statements rather than the word, and cover the synonym:

```ts
// Every way SQLite ends a write transaction, matched as a STATEMENT rather than
// as a word: `END` and `END TRANSACTION` are exact synonyms of `COMMIT`, so a
// word count over `commit` alone leaves a second, working commit site invisible.
const commitStatements = kept.match(/exec\(\s*["'`]\s*(commit|end)(\s+transaction)?\s*["'`]\s*\)/gi) ?? [];
assert.equal(commitStatements.length, 1, …);
```

Matching `exec(...)` rather than a bare word also frees error-message prose,
which removes the `anno-store.ts:1316-1322` coupling entirely.

### WR-16: the three repaired handlers assert a rollback the code does not verify

**File:** `src/mcp/vice/anno-store.ts:1311-1314` (with `:1224-1228` and `:846-859`)
**Severity:** WARNING

**Issue:** every handler swallows its own `rollback` failure and then states the
outcome as fact:

```ts
try { handle.db.exec("rollback"); } catch { /* deliberately ignored */ }
discardSnapshot(staging);
throw new AnnoStoreError(
  `… Nothing was written and the transaction has been rolled back, so the store is still at revision ${rev}.`, …);
```

If the rollback threw, the transaction is still open with the compare-and-swap,
the mutation and the pointer row applied, the connection still holds the store's
write lock, and the message says the opposite — which is exactly the state CR-06
was raised about, now reported as its own repair. The sweep's handler
(`:846-859`) has the same shape and returns `deferred: true`, whose documented
meaning is "THIS SWEEP CHANGED NOTHING" (`:730-741`).

Node 22's `DatabaseSync` exposes no transaction-state accessor (checked on this
host: `open, close, prepare, exec, function, location, aggregate,
createSession, applyChangeset, enableLoadExtension, loadExtension`), so the
claim genuinely cannot be checked cheaply. That is a reason not to *assert* it.

**Fix:** report what happened rather than what was intended, at all three sites:

```ts
let rolledBack = true;
try {
  handle.db.exec("rollback");
} catch {
  // A ROLLBACK THAT FAILED IS NOT A ROLLBACK. Node 22's DatabaseSync exposes no
  // transaction-state accessor, so this flag is the only thing that can keep the
  // message honest -- and a message that claims a rollback that did not happen
  // reports the CR-06 state as its own repair.
  rolledBack = false;
}
…
throw new AnnoStoreError(
  `${handle.path}: the write for revision ${rev + 1} could not be committed (${(e as Error).message}). ` +
    (rolledBack
      ? `The transaction has been rolled back, so the store is still at revision ${rev}.`
      : `The rollback ALSO failed, so this connection may still hold an open transaction and the store's write lock -- close it and reopen.`),
  { code: (e as { code?: number | string }).code, data: { path: handle.path, revision: rev, rolledBack, step: "committing the write transaction" } },
);
```

### WR-17: `revertTo` step 6 guards the sweep but not the reopen the guard depends on, and the guard itself is unreachable

**File:** `src/mcp/vice/anno-store.ts:1756-1768`
**Severity:** WARNING

**Issue:**

```ts
const restored = openStore(storePath);      // :1756 -- OUTSIDE the handler
try {
  reconcileSnapshotRing(restored);
} catch {
  try { closeStore(restored); } catch { }
  return openStore(storePath);              // :1766 -- also outside any handler
}
return restored;
```

Two problems, in opposite directions:

* **The guarded call cannot throw.** 28-13 made `reconcileSnapshotRing`
  non-throwing on every input; the code comment (`:1747-1754`) and the
  structural test both say so in as many words, and the composite behavioural
  test states that it "passes IDENTICALLY with and without that handler". So the
  `catch` is unreachable defence-in-depth — acceptable, but it is not what closes
  CR-07's third property today.
* **The unguarded call can.** `openStore` at `:1756` runs `pragma
  integrity_check` and the `anno_meta` read against the image this function has
  just installed, and it is by far the more likely of the two to fail — that is
  the throw CR-08 reproduces. When it does, the revert has already landed, the
  caller's original handle was closed at step 4, and `revertTo` returns nothing.
  The stated property, "a housekeeping failure never costs the caller a handle",
  therefore holds only for the branch that cannot fire.

**Fix:** move the reopen inside the same guarantee, and say what the caller gets
when the store cannot be reopened at all (which is a real state, not a
housekeeping failure — CR-08's fix removes its main cause):

```ts
// THE REOPEN IS PART OF THE GUARANTEE, not a precondition of it: it runs
// integrity_check against the image this function just installed, so it is the
// step most likely to fail, and a failure here costs the caller a handle for a
// revert that has ALREADY landed on disk.
let restored: AnnoStoreHandle;
try {
  restored = openStore(storePath);
} catch (e) {
  if (e instanceof ViceError) throw e;
  throw new AnnoStoreError(
    `${storePath}: the revert to revision ${revision} LANDED ON DISK, but the restored store could not be reopened ` +
      `(${(e as Error).message}). The store file is the restored image; reopen it to inspect it.`,
    { data: { path: storePath, revision, step: "reopen after revert" } },
  );
}
```

### WR-03: a genuine lock timeout is reported as store corruption

**File:** `src/mcp/vice/anno-store.ts:391-403`
**Severity:** WARNING
*(carried forward, unchanged; CR-06's closure makes contention on this path demonstrably reachable and measured)*

**Issue:** the `try` wraps only `select schema_version, revision from anno_meta`,
but the `catch` converts **any** error into `AnnoStoreCorruptError` whose message
says the store is "truncated, empty or foreign". A concurrent writer holding the
lock past the 5 s `busy_timeout` therefore surfaces to a user as "your
annotations are gone" — and the CR-06 control proves that a five-second block
followed by `database is locked` is an ordinary, reachable state on this module's
own concurrency model.

**Fix:**

```ts
} catch (e) {
  db.close();
  const code = (e as { code?: string }).code ?? "";
  if (/SQLITE_BUSY|SQLITE_LOCKED/.test(code) || /database is locked/.test((e as Error).message)) {
    throw new AnnoStoreError(`${resolved}: another process holds the store lock -- the store is NOT corrupt`, { code });
  }
  throw new AnnoStoreCorruptError(…);
}
```

### WR-05: the enum no-op check compares JSON text, so key ORDER decides whether an identical enum is accepted or refused

**File:** `src/mcp/vice/anno-store.ts:2054` (and `:2110-2115`)
**Severity:** WARNING
*(carried forward, unchanged)*

**Issue:** `existing.variants === variantsJson` compares
`JSON.stringify(validatedVariants(...))`, and `validatedVariants()` deliberately
preserves the caller's key order verbatim (`:2079-2081`). The same enum with its
keys reordered is therefore not equal, contradicting `createProjectEnum`'s own
doc comment ("A byte-identical repeat is a no-op reporting `changed:false`, so
re-running a generation pass is safe") — a reorder-only repeat is *refused* with
`AnnoLabelError`, not reported as a no-op. `updateProjectEnum` has the mirror
flaw: a reorder-only update reports `changed:true` and rewrites the row.

**Fix:** compare by VALUE while storing the keys verbatim:

```ts
function sameVariants(storedJson: string, next: Record<string, string>): boolean {
  const byValue = (m: Record<string, string>) =>
    Object.entries(m).map(([k, v]) => [parseVariantKey(k), v] as const).sort((a, b) => a[0] - b[0]);
  return JSON.stringify(byValue(JSON.parse(storedJson))) === JSON.stringify(byValue(next));
}
```

### WR-06: `baseRevision` is the one argument no validator touches

**File:** `src/mcp/vice/anno-store.ts:1127` (every entry point's `args.baseRevision`)
**Severity:** WARNING
*(carried forward, unchanged)*

**Issue:** every other argument goes through an `assert*`/`parse*` before any SQL
runs — that is `anno-types.ts`'s whole premise, because the transport validates
nothing. `baseRevision` goes straight into
`baseRevision !== undefined && baseRevision !== rev`, so a JSON caller supplying
`"1"` is told its base disagrees with a number it visibly equals, and `null`
reads as "I have a base" rather than "I have none".

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

**File:** `src/mcp/vice/anno-types.ts:1034`, `:1055`, `:1090`; `src/mcp/vice/anno-store.ts:1988-2013`
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
variants mapping, reusing `utf8ByteLength()` and refusing over-long values BY
NAME (never truncating):

```ts
export const MAX_IDENTIFIER_BYTES = 255;
export const MAX_VARIANTS_BYTES = MAX_COMMENT_BYTES * 16;
```

### WR-08: `retype` merges adjacent same-type rows and fragments a row on a same-type subrange retype; neither behaviour is pinned

**File:** `src/mcp/vice/anno-store.ts:1406-1437`
**Severity:** WARNING
*(carried forward, unchanged — `anno-overlap.test.ts` still exercises two separate `setDataType` calls, so neither behaviour can go red)*

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

**File:** `src/mcp/vice/anno-store.ts:2143`
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

### WR-10: two seam-private exports are public API of a published package, and 28-14 widened the dependency again

**File:** `src/mcp/vice/anno-store.ts:1009` and `:1375`; `src/mcp/vice/package.json:73`
**Severity:** WARNING
*(carried forward; the dependency grew this round)*

**Issue:** `anno-seam.test.ts` bounds `applyWriteWithoutCommit` and
`stageSnapshot` to "no shipped module *in this repo* names them", which says
nothing about consumers of the published `@henols/vice-mcp` tarball, and
`anno-store.ts` is in `files[]`. Calling `applyWriteWithoutCommit` leaves the
connection inside an open transaction with the CAS applied and the pointer row
inserted. 28-14 added a fourth mutator mode against the same helper file, so the
test-only surface keeps growing while the export stays unconditional.

**Fix:** gate both on an explicit test-only opt-in rather than exporting them
unconditionally — e.g. a required `{ iAmTheDurabilityProof: true }` member on the
options object, or `process.env.ANNO_STORE_DURABILITY_PROOF === "1"` — and have
`anno-seam.test.ts` pin the guard itself.

### WR-11: `revertTo` replaces the store file under any other open connection, which then writes into an unlinked inode

**File:** `src/mcp/vice/anno-store.ts:1613-1771`
**Severity:** WARNING
*(carried forward, unchanged apart from step 6)*

**Issue:** `revertTo` closes only *its own* handle before renaming the staged
image over the store path. A second connection keeps its descriptor on the **old
inode**: it sees none of the revert, its SQLite POSIX locks no longer coordinate
with anyone, and every write it makes lands in a file nothing will ever open
again. The doc comment's "atomic from a reader's point of view" is true only of
readers that open the path *after* the rename.

Three smaller points in the same body, all unchanged: the
`rmSync(staging, { force: true })` in the step-3 and step-5 catches (`:1660`,
`:1680`) is unguarded, so a failure there replaces the real error
(`discardSnapshot()` at `:1064-1070` exists for exactly this and is not used);
the `${storePath}.revert-${pid}-${revision}` staging file (`:1647`) sits outside
every sweep's pattern, so a kill between the copy and the rename leaks it
permanently; and it sits in the store's own directory rather than in the ring, so
nothing will ever reclaim it.

**Fix:** state the single-connection precondition in the doc comment and enforce
what can be enforced — take `begin immediate` before staging so no concurrent
*writer* can be mid-transaction, and route both cleanup calls through
`discardSnapshot()`. If concurrent readers must survive a revert, the replacement
has to be done in place (a `VACUUM INTO` back over the open connection, or a
`delete`+`insert` restore inside one transaction) rather than by rename.

## Info

### IN-05: only ONE of the module's wraps carries the underlying SQLite code, and `cause` is still absent

**File:** `src/mcp/vice/anno-store.ts:1316` (the only site), `:1146-1150`, `:1224-1228`, `:360`, `:432`; `src/mcp/vice/vice.ts:245-249`
**Severity:** WARNING (informational tier)
*(half closed by 28-14)*
**Issue:** 28-14 set `code` on the CR-06 wrap and stated that `cause` was
deferred because it needs a new field on `ViceErrorOptions` in a shared module.
That is a reasonable scope call, but the result is that exactly one of six wraps
answers "was this `SQLITE_BUSY`?" without substring-matching — which is what
still makes WR-03 awkward to fix at the call site.
**Fix:** set `code` from `(e as { code?: string }).code` on the remaining wraps
(purely additive, same file), and add `cause` to `ViceErrorOptions` when a phase
touches `vice.ts`.

### IN-01: a non-number, non-string range end is reported as a range-shape error

**File:** `src/mcp/vice/anno-store.ts:1556-1557`
**Severity:** WARNING (informational tier)
**Issue:** the documented split ("`parseStoreAddress` owns the STRING forms
only… a numeric argument is passed straight through") means `null`, `true` or
`{}` reach `assertRangeShape`, which reports
`start [object Object] is outside the address space` — an `AnnoRangeShapeError`
where `AnnoAddressError` ("that is not an address") is the answer the comment
says a caller must be able to tell apart.
**Fix:** in `setDataType`, route anything that is not `typeof === "number"`
through `parseStoreAddress` too; numbers keep the current pass-through.

### IN-02: `fsyncPath` opens with `"r"`

**File:** `src/mcp/vice/anno-store.ts:322-329`
**Severity:** WARNING (informational tier)
**Issue:** `fsync` on a read-only descriptor, and `openSync` on a *directory* at
all, are not portable (both fail on Windows). Fine for the Linux/macOS hosts this
tree targets; noted so a later port does not discover it as a silent durability
loss. Its blast radius grows if WR-13 is fixed, since the publish path would then
depend on it too.
**Fix:** none required today; if portability is added, guard with
`process.platform === "win32"` and document that the directory fsync is skipped.
Note that the two root guards in WR-14 use `process.getuid?.()`, which is
`undefined` on Windows and would let those tests run their `chmod` fixtures as
no-ops.

### IN-03: `resolveAt` does not check the index length

**File:** `src/mcp/vice/anno-index.ts:142-150`
**Severity:** WARNING (informational tier)
**Issue:** the address bound is validated but `index.length` is not, so a
short/foreign `Int32Array` returns `undefined` typed as `number` — which would
compare unequal to `NO_ROW` and read as "some row covers this".
**Fix:** `if (index.length !== PAINT_INDEX_SIZE) throw new AnnoRangeShapeError(...)`
once at the top of the function.

### IN-04: the fixture overlap census never expires a range ending at `$FFFF`

**File:** `src/mcp/vice/anno-index.test.ts:147-175` (`fixtureOverlapCensus`)
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
_Round: 4 (supersedes the round-3 review of the same file set; CR-05, CR-06, CR-07 and WR-12 are all dispositioned CLOSED with evidence, and every other round-3 id is carried forward explicitly)_
