---
phase: 28-the-store-core
reviewed: 2026-08-29T00:28:33Z
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
  - src/mcp/vice/anno-coverage.test.ts
findings:
  critical: 3
  warning: 28
  info: 14
  total: 45
status: issues_found
---

# Phase 28: Code Review Report (rounds 1-6, cumulative)

**Reviewed:** 2026-08-29 (round 6, post 28-19 / 28-20 / 28-21 / 28-22)
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

> **THIS FILE IS APPEND-AND-PRESERVE.** Every finding id and every disposition
> table below is kept verbatim across rounds, because
> `src/mcp/vice/docs-review-disposition.test.ts` (AUDIT-01) asserts that every id
> appearing anywhere in this file is named in a recognised disposition source --
> deleting a finding deletes the disposition that references it. Round 6's
> findings are in **[Round 6 Findings](#round-6-findings-post-28-19--28-20--28-21--28-22)**
> at the end of the file; everything above it is rounds 3-5, unchanged. Round 6
> opens `CR-10`, `WR-26`-`WR-30` and `IN-09`-`IN-11`; the next free ids are
> `CR-11`, `WR-31`, `IN-12`.
>
> The summary immediately below is **round 5's**, kept as written.

## Summary

Fifth round on the same fifteen files, after plans 28-16, 28-17 and 28-18 landed
against round 4's `CR-08`, `WR-13`, `WR-14`, `WR-15`, `WR-16` and `WR-17`.

**Measured state, re-measured here rather than taken from the handoff:** the
eight `anno-*` / `block-class` test files are **169 pass / 0 fail / 0 skipped**
(`node --test`, 13.2 s), and `npx tsc --noEmit` exits 0.

**All six handed-over round-4 ids are genuinely closed for their reported
cause**, checked against the code and, where the claim was behavioural, by
driving the production functions directly. Two of them left a residual that this
round files as a NEW id rather than as a re-opening (`WR-15` → `WR-19`,
`WR-16` → `WR-18`); those residuals are different defects at the same site, not
the same defect unfixed.

| Round-4 id | Verdict | Evidence |
|---|---|---|
| CR-08 | **Closed** | `snapshotOpenFailure()` (`anno-store.ts:624-631`) is the single witness; `retainedRevisions()` (`:729-731`) filters on it, `revertTo` step 2 (`:1982-1996`) gates on it and step 3b (`:2044-2057`) gates on the STAGED copy. `grep -n existsSync anno-store.ts` shows **no** presence test on a snapshot path anywhere in the module — the only two live uses are `openStore`'s fresh-versus-existing decision (`:370`) and the ring DIRECTORY probe (`:1019`). Five committed controls drive a truncated and a foreign-bytes image. |
| WR-13 | **Closed** | `grep -c 'fsyncPath('` = **6**: the staged image at `:1233` (unguarded, before `begin immediate`) and the ring directory at `:1307` (best-effort). The asymmetry is correct and is not reported: `fsyncPath` is `openSync(dir, "r")`, which needs the same read bit `readdirSync` needs, so an unguarded directory fsync would make every `setDataType` throw against the pre-existing `chmod 0o300` fixture that is CR-07's only behavioural control. Verified: that fixture is `anno-store.test.ts:3208` and it still passes. |
| WR-14 | **Closed** | Both root guards are now `node:test` declaration options (`anno-store.test.ts:3185`, `:3259`), matching `anno-confinement.test.ts:579`'s form. The residual IN-02 predicted — `process.getuid?.()` is `undefined` on Windows, where `chmodSync` is a no-op and both bodies would run vacuously — is unchanged and is carried forward under IN-02. |
| WR-15 | **Closed for the SYNONYM half only.** | `commitStatements()` (`anno-seam.test.ts:382-390`) now matches an `exec()` whose single argument is a bare `commit` / `end` / `end transaction` literal, with two fixture controls. The residual is filed as **WR-19**: a trailing semicolon and a multi-statement `exec()` both still evade it, and both were verified as working commits against `node:sqlite`. |
| WR-16 | **Closed as written.** | Three handlers record `rolledBack` and branch their prose on it (`grep -c rolledBack` = 12); the sweep reports it through `rollbackFailed`. The residual is filed as **WR-18**: `rollbackFailed` has **no reader anywhere** — `pruneSnapshots` reads only `.deferred` and `revertTo:2186` discards the whole result — so the one state the field was added to report is still unhandled. |
| WR-17 | **Closed** | Both post-rename `openStore` calls in `revertTo` step 6 are inside handlers (`:2174-2185` and `:2186-2227`), a `ViceError` is rethrown unchanged and anything else is wrapped naming the store path and the revision. |

**One new BLOCKER, found by attacking the split-table half of `retype()` that
five rounds have not touched.** Every round so far has argued about the snapshot
ring. Nobody asked what the store's own split-and-preserve path does to a
split-table row's *even byte count* invariant:

* **CR-09** — retyping one byte inside a `lo_hi_address` table leaves an
  **11-byte `lo_hi_address` row on disk**, a shape `assertRangeShape()` refuses
  from a caller by name and `resolveSplitTargets()` cannot resolve at all.
  Reproduced through the public entry points, no hand-editing:
  `setDataType($1000..$100f, lo_hi_address)` then
  `setDataType($1004..$1004, byte)` yields
  `{ id: 3, start: 4101, endInclusive: 4111, dataType: 'lo_hi_address' }`.
  `changed: true`, no report, no refusal. Trap 6 of `anno-types.ts` — "NEVER let
  a validator return a value instead of throwing" — is honoured at the entry
  point and bypassed by the store's own remainder writer.

**Seven further new Warnings**, all reproduced or measured rather than argued:

* **WR-18** — `rollbackFailed` has no reader; `revertTo` returns a handle that
  may still be inside the sweep's open transaction, which is CR-07's exact
  symptom re-created on the revert path.
* **WR-19** — `db.exec("commit;")` is a fully working commit statement that the
  WR-15 matcher counts as **0**. Verified against `node:sqlite`: the statement
  commits, and `db.exec("insert into t values (2); commit")` commits too.
* **WR-20** — the "no module-level mutable state" control exists in **four
  hand-copied variants that disagree**. Measured: `export let cachedHandle = …`
  is caught by `anno-index.test.ts`'s copy and by **neither**
  `anno-seam.test.ts`'s nor `anno-types.test.ts`'s; `export const memo = new
  Map()` is caught by everything except `anno-seam.test.ts`'s. The weakest copy
  guards the seam — the one module where a cached connection would do the most
  damage.
* **WR-21** — `addScope` is the only write entry point with neither an
  idempotence check nor a shape rule. Reproduced: the same scope added twice
  stores two byte-identical rows and reports `changed: true` twice, and a nested
  scope is stored, while `ScopeRow`'s own doc comment says "no nesting: the
  schema says nested scopes are unsupported, and the store must not invent a
  capability the surface it mirrors does not have".
* **WR-22** — `revertTo`'s `revision` argument reaches SQL and a **filename**
  unvalidated, and SQLite's column affinity converts a bound TEXT operand, so
  `revertTo(handle, "0001")` FINDS the pointer row for revision 1 and then
  refuses with CR-08's corruption-flavoured message about
  `…/r0001.db`. Reproduced verbatim.
* **WR-23** — `contradictedCommentsFor`'s two arms treat the `undefined` data
  type inconsistently and the recorded rationale for the asymmetry is false.
  Reproduced: retyping to `undefined` reports a `[confirmed-code]` comment as
  contradicted and a `[confirmed-data]` comment as not.
* **WR-24** — `revertTo`'s staging path is per-PID, where `stageSnapshot`'s is
  per-ATTEMPT with an explicit comment saying why per-revision is not enough.
* **WR-25** — workspace confinement is opt-in on `openStore`, in a module whose
  whole premise is that the transport validates nothing.

Everything else from rounds 3 and 4 is re-verified in the source and carried
forward as **still open**: eight Warnings (WR-03, WR-05, WR-06, WR-07, WR-08,
WR-09, WR-10, WR-11) and five Info items. `WR-10` is unchanged and
`anno-store.ts` is still in `package.json`'s `files[]` (`:73`); the shipped set
is exactly `block-class.ts`, `anno-types.ts`, `anno-index.ts`, `anno-store.ts`
plus the pre-existing modules, and `anno-durability-mutator.mjs` is correctly
absent.

Design invariants named as out of scope were re-checked and **hold**: the single
`node:sqlite` seam (`anno-seam.test.ts` scans the `files[]`-derived shipped set),
the frozen twelve, no adjacency coalescing, `pragma journal_mode` still reads
`delete` and nothing sets it, `bank` uninterpreted, `anno-types.ts` and
`anno-store.ts` both absent from `hostpath-consumers.test.ts`'s five-member
closed set (asserted there by a `deepEqual` over every top-level module, so the
absence is genuinely mechanical). There is still **no SQL injection**: every
statement is a bound `prepare().run()` except the fixed `DDL`, the transaction
keywords, and the one `vacuum into` whose argument is refused for
`\0`/`\n`/`\r` and single-quote escaped by doubling (`sqlQuotedPath`, `:311-318`)
— and the only value that reaches a *path* from a caller unvalidated is WR-22's
`revision`, which cannot traverse because the pointer-row gate refuses anything
SQLite will not convert to the integer of an existing row. No debug artifacts, no
`eval`, no dynamic `Function`.

`anno-coverage.test.ts` was read and is unchanged since 28-03; per the phase
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


### Round-5 finding dispositions

Every id opened by round 5, with the plan that carries it and the evidence from
that plan's own SUMMARY, in the round-4 table's form: a `fix` cell names its plan
and quotes a number or a line reference; a cell that could not do that reads
`accept` with what makes it acceptable.

`28-REVIEW.md` deliberately files no disposition for its own findings, so the
round-5 verifier recorded a verdict for each of the twelve in
`.planning/phases/28-the-store-core/28-VERIFICATION.md`'s
`### Round-5 Finding Dispositions (from the verifier seat)` table. **This table is
the transcription that instruction asked for**, and the reason is the verifier's
own: *"a disposition that lives only in this file disappears the next time this
file is overwritten. That is exactly how round 4 lost the disposition it thought
it had."* The twelve are `CR-09`, `WR-18`, `WR-19`, `WR-20`, `WR-21`, `WR-22`,
`WR-23`, `WR-24`, `WR-25`, `IN-06`, `IN-07`, `IN-08`.

| Id | Disposition |
|---|---|
| CR-09 | **`fix`, by 28-19 task 1** (`e93ddf0`). `retype()` gained a remainder shape gate that runs BEFORE the first delete, and the refusal is `AnnoSplitRemainderError extends AnnoRangeShapeError`. Evidence from 28-19-SUMMARY.md, the verifier's own six-line drive re-driven through production entry points only: before the plan the second call returned `{revision:2, changed:true, contradictedComments:[]}` and left `id=3 4101..4111 lo_hi_address` — **span 11, odd**; after it the same call throws `AnnoSplitRemainderError`, `listRanges()` is the unchanged single row `id=1 4096..4111 lo_hi_address bank=null` before AND after, and `currentRevision()` reads **1** before and **1** after. The legal-remainder neighbour still succeeds: `setDataType($1004..$1007, "byte")` returns `changed: true` and three rows. The verifier's severity correction is carried, not dropped: CR-09 falsifies criterion **3**'s stated purpose, not criterion 1. Suite count `169 -> 186`. |
| WR-18 | **`fix`, by 28-20 task 3** (`5f3abc0`). `rollbackFailed` had exactly ONE reader in the tree and it was a test assertion; it now has two PRODUCTION readers, quoted from 28-20-SUMMARY.md with their line numbers: `anno-store.ts:1193` — `if (swept.deferred) return swept.rollbackFailed;` (`pruneSnapshots`) — and `anno-store.ts:2502` — `reopenNeeded = reconcileSnapshotRing(restored).rollbackFailed;` (`revertTo` step 6). The fact is carried on the handle (`transactionStateUnknown`) so the committed write still reports success and the NEXT call refuses by name, which is what keeps 28-11 P5 intact. `grep -c 'rollbackFailed' src/mcp/vice/anno-store.ts` was **12** at 28-19's tree. |
| WR-19 | **`fix`, by 28-22 task 1** (`ce41965` RED, `ba278fd` GREEN). The single-commit-site control now matches the commit STATEMENT inside an `exec()` string literal, anchored at a statement boundary, instead of requiring the literal and the statement to be the same string. Fixture counts, old matcher then new: the three bare spellings **3 -> 3** (28-18's coverage not regressed), the three semicolon spellings `commit;` / `end;` / `COMMIT ;` **0 -> 3**, the multi-statement `db.exec("insert into t values (1); commit")` **0 -> 1**, the negative fixture **0 -> 0**. The planting that proves the residual was real: with a second, fully working commit site spelled `db.exec("commit;")` in `anno-store.ts`, the OLD matcher counted **1** and passed, and the new control reports `not ok 15 - the seam contains exactly one commit statement, so the single planted-violation site is unique` / *"found 2"*. |
| WR-20 | **`accept`.** Four hand-copied variants of the no-module-level-mutable-state control that disagree, the seam's copy being the weakest. What makes it acceptable is the verifier's own basis, quoted: *"Accepted as recorded, low priority. Not verified in depth this round; no criterion or requirement depends on it."* No ROADMAP criterion and no `STORE-*` requirement is scored against it, so a divergence between the four copies cannot move a verdict. No plan in round 5 touched any of the four. |
| WR-21 | **`fix`, by 28-21 task 1** (`f67917a` RED, `9d292bb` GREEN). `addScope` gained an idempotence check and a no-nesting refusal, and both of its doc comments became true. Evidence from 28-21-SUMMARY.md, driven through production entry points: `first : {"revision":1,"changed":true}` then `repeat : {"revision":2,"changed":false}` with `listScopes().length` = **1** — where the pre-task tree produced `changed: true` **twice** and **two** byte-identical rows. The nested case throws `AnnoRangeShapeError` naming both scopes' ends and the existing `id=1`, with `listScopes().length` = **1** after; the disjoint and adjacent discrimination controls both read **2**, the adjacent one starting at exactly `0x2001` against an inclusive end of `0x2000`. |
| WR-22 | **`fix`, by 28-20 task 1** (`bf08b30`). `revertTo`'s `revision` is validated by `assertRevisionArgument()` as the function's first statement, before the pointer-row `select` and before `snapshotPathFor`. Evidence from 28-20-SUMMARY.md: `revertTo(handle, "0001")` threw `AnnoStoreError` — the CR-08 CORRUPTION refusal, *"a pointer row claims it, but its snapshot…"* — before the plan, and throws `AnnoRevisionArgumentError | corrupt-family=false` after it, together with `"1"`, `" 1 "`, `"1.0"`, `-1`, `1.5` and `NaN`. Staging residue after every refused call: **0**. The class is new rather than reused, and the recorded reason is that `AnnoStoreStaleRevisionError` carries TWO revisions and an argument error has no second one. |
| WR-23 | **`accept`.** The `undefined`-data-type asymmetry in `contradictedCommentsFor` with a false recorded rationale. The verifier's basis, quoted: *"Accepted as recorded, low priority. Fix the comment when the function is next touched."* Stated as a FACT rather than implied: **no plan in round 5 touched `contradictedCommentsFor`** — `git diff 9db1e3d..HEAD -- src/mcp/vice/ \| grep -c 'contradictedCommentsFor'` returns **0** over the whole round, where `9db1e3d` is the commit that opened round 5. The condition the verdict attaches to therefore did not arise, and the comment is still false and still recorded. |
| WR-24 | **`fix`, by 28-20 task 2** (`7a63c7c`). `revertTo`'s staging path is now per-ATTEMPT rather than per-(pid, revision), derived from `randomUUID()` — the same primitive `stageSnapshot` uses — and all three cleanups route through `discardSnapshot()`. Numbers from 28-20-SUMMARY.md: `discardSnapshot(staging)` occurrences inside `revertTo`'s body **3**, bare `rmSync(staging` occurrences inside that same body **0**, and several sequential reverts to the same revision leave a `.revert-` residue count of **0**. Observed red as PLANTING D: `not ok 43 - WR-24, STRUCTURAL: revertTo's staging name derives from randomUUID, and all three of its cleanups route through discardSnapshot rather than a bare rmSync`. |
| WR-25 | **`fix`, by 28-21 tasks 2 and 3** (`df619ad`, `0a44886`). Workspace confinement is now `openStore`'s DEFAULT: a `workspaceRoot` is required unless the caller passes `unconfinedModuleDerivedPath: true`, and the guard sits before the `resolve()` decision and before `new DatabaseSync`. Evidence from 28-21-SUMMARY.md: the default refusal names the transport's own non-validation, and `existsSync(path)` afterwards is **`false`** — the assertion that matters, because a guard placed after the constructor would throw the right class over a file it had already created. The escape is ONE greppable word pinned to exactly **4** call sites under strict `codeOnly()`, observed red as `not ok 20 - WR-25 pin: the unconfined escape is used by NO shipped module but the seam, and exactly at its enumerated module-derived opens`. |
| IN-06 | **`fix`, by 28-19 task 1** (`e93ddf0`), in the same edit as CR-09 because it lives on the same two lines. `insertRange()` takes `bank` as a parameter and `retype()` hands the overlapped row's `bank` to both remainder inserts, while the newly typed range still carries `null` — read back through `listRanges()` after a production `setDataType`. `anno-store.test.ts`'s bank control was narrowed from "never READ" to "never INTERPRETED" by exact line shape, with an unconditional no-branch / no-compare / no-arithmetic assertion added beside it, so the pass-through does not blind the reserved-field control. |
| IN-07 | **`accept`.** A bad enum variant name is refused with a message naming the enum. What makes it acceptable: the verifier recorded it `Accepted, INFO` with no follow-up asked for, no criterion or requirement is scored against it, and the observed behaviour is a refusal that already identifies the offending enum — the outcome an improvement would aim at. No plan in round 5 touched it and none claims to. |
| IN-08 | **`accept`.** `buildPaintIndex` accepts a row whose `id` collides with `NO_ROW`. What makes it acceptable: the verifier recorded it `Accepted, INFO`; the colliding id is not producible through any store entry point (ids are assigned by SQLite's `rowid`, which never yields the sentinel), so reaching it requires a hand-built row that no production caller can construct. Recorded rather than fixed, and no plan in round 5 touched it. |

**Both carried-forward human-verification items are STILL OPEN.** They are rows
rather than an omission for the reason the round-4 table records: an item must
not be lost between rounds by being ABSENT rather than by being closed.

| Carried-forward item | Status |
|---|---|
| `openStore`'s `integrity_check could not be run at all` arm | **STILL OPEN — not claimed closed by this round.** The arm refuses in-family with an `AnnoStoreCorruptError` naming the path, the connection closed and nothing partial returned. The reason is UNCHANGED from rounds 3, 4 and 5: the arm is defensive and has no reachable input without filesystem- or SQLite-level fault injection, so its presence and wiring are verified in source plus the structural `assertInsideHandler("export function openStore", "pragma integrity_check", 800)` control, and no test exercises the throw. **The line reference drifts every round and is therefore given by FUNCTION AND ARM first:** it is the `catch` around `db.prepare("pragma integrity_check").all()` inside `openStore`. Re-derived on 28-22's own tree it is `anno-store.ts:530-535`, the throw at `:534`; round 5 cited `:465-468` and round 4 cited `:432`. No plan in round 5 (28-19, 28-20, 28-21, 28-22) constructs that input, and none claims it does — 28-21 edited `openStore` again, which is what moved the number. |
| 28-17's `backstop`-tagged host-crash durability bound | **STILL OPEN — not claimed closed by this round, and deliberately NOT promoted.** The truth: after an interruption between `vacuum into` and the pointer row's commit, the reachable outcomes are bounded to two, both non-destructive. The round-5 verifier **ABSTAINED** on it as `insufficient_spec` rather than counting it verified, and its reason is unchanged: an `fsync` has NO in-process observable, so the only in-process evidence is the SOURCE ORDER of two `fsyncPath()` calls — presence, not behaviour. Verifying it needs host-level crash or power-loss injection across the `stageSnapshot` fsync / `publishSnapshot` rename / pointer-row commit sequence. It stays a `backstop` truth; 28-17 P5 and 28-18 P3 both forbid promoting it, and 28-22's closing gate re-states that it was not promoted. |

**Line-number drift, stated so a reader does not treat it as a contradiction:**
the round-3 and round-4 finding bodies below keep the line references they were
written with. 28-16, 28-17 and 28-18 moved code, so several of those references
are now stale by tens of lines. The round-5 bodies above are cited against the
tree at review time. Where the two disagree about a location for the same defect,
the round-5 citation is the current one.

## Critical Issues

### CR-09: `retype()`'s split-and-preserve writes a split-table row with an ODD byte count — a shape the store refuses at its own entry point and cannot resolve

**File:** `src/mcp/vice/anno-store.ts:1707-1733` (the remainder inserts at `:1724` and `:1727`), with `src/mcp/vice/anno-types.ts:685-690` and `:1239-1245`
**Severity:** BLOCKER
*(new in round 5)*

**Issue:**
`assertRangeShape()` refuses, BY NAME, a split-table range whose byte count is
odd — "the low half and the high half must be the same length"
(`anno-types.ts:685-690`) — and `resolveSplitTargets()` throws
`AnnoRangeShapeError` on an odd byte array (`:1239-1245`). `retype()`'s
split-and-preserve path re-inserts the surviving remainders of an overlapped row
with **`row.data_type` carried over and no shape check at all**:

```ts
// :1721-1729
for (const row of overlapping) {
  db.prepare("delete from anno_range where id = ?").run(row.id);
  if (row.start < start) {
    insertRange(db, row.start, start - 1, row.data_type);      // <-- no assertRangeShape
  }
  if (row.end_inclusive > endInclusive) {
    insertRange(db, endInclusive + 1, row.end_inclusive, row.data_type);  // <-- no assertRangeShape
  }
}
```

**Reproduced through the public entry points only** — no hand-edited store, no
test-only export:

```
setDataType(h, { start: 0x1000, endInclusive: 0x100f, dataType: "lo_hi_address" })  // 16 bytes, 8 entries
setDataType(h, { start: 0x1004, endInclusive: 0x1004, dataType: "byte" })           // accepted, changed: true

listRanges(h) ->
  { id: 2, start: 4096, endInclusive: 4099, dataType: 'lo_hi_address', bank: null }   // 4 bytes  -- legal
  { id: 3, start: 4101, endInclusive: 4111, dataType: 'lo_hi_address', bank: null }   // 11 bytes -- IMPOSSIBLE
  { id: 4, start: 4100, endInclusive: 4100, dataType: 'byte',          bank: null }
```

Row 3 is a `lo_hi_address` table of 11 bytes. `setDataType` would refuse to
create it; `resolveSplitTargets()` cannot resolve it; nothing reports that it
exists. The write returns `changed: true` and no diagnostic. This is the module's
own trap 6 — "NEVER let a validator return a value instead of throwing. A refusal
that returns a default writes the default into the store" — honoured at the entry
point and bypassed by the store's own remainder writer, which is the one writer a
caller cannot inspect.

The consequence is not cosmetic. `anno-types.ts`'s header calls split-table
ORIENTATION "the one irreversible decision in this area … there is no field to
migrate, so the recovery cost is a hand re-annotation of every split table in
every project file". A silently unresolvable split row is exactly that loss,
delivered by an ordinary one-byte retype.

**Fix:** decide the semantics and enforce them in `retype()`, in the same
transaction, so the store never persists a shape it would refuse:

```ts
function preserveRemainder(db: DatabaseSync, start: number, endInclusive: number, dataType: string): void {
  // A remainder that is no longer a legal shape for its own type cannot be
  // preserved AS that type. Demote it to `undefined` -- the vocabulary member
  // that asserts nothing -- rather than writing a row the store would refuse.
  const legalSplit = !(SPLIT_DATA_TYPES as readonly string[]).includes(dataType) || (endInclusive - start + 1) % 2 === 0;
  insertRange(db, start, endInclusive, legalSplit ? dataType : "undefined");
}
```

Demotion is one of three defensible answers; the other two are (a) REFUSE the
whole retype when it would fragment a split table into an illegal remainder, with
a message naming the table and the entry boundary, and (b) round the retype
outward to the nearest entry boundary — which this module must not do, because
`anno-types.ts` trap 7's reasoning ("never substitute, nothing records that it
happened") applies to a silently widened range just as it does to a sanitised
name. Whichever is chosen, `anno-overlap.test.ts` must gain the case: it currently
exercises five overlap shapes and none of them is a split-table row, so this
defect is invisible to the suite that exists to prove `STORE-02`.

### CR-08: `revertTo` replaces the live store with a snapshot image it never opens — a snapshot that exists but is not a database destroys the store irrecoverably

> **ROUND-5 STATUS: CLOSED by 28-16.** Body preserved as the historical record; its line references predate 28-16/17/18. Verified in the round-5 summary table above.

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

### WR-18: `rollbackFailed` has no reader anywhere, so the leaked-transaction state 28-17 added it to report is still unhandled — and `revertTo` hands that connection back to the caller

**File:** `src/mcp/vice/anno-store.ts:2186` (`revertTo` step 6), `:1149` (`pruneSnapshots`), `:939` and `:1063` (the producer)
**Severity:** WARNING
*(new in round 5; the residual of WR-16's fix, not a re-opening of it)*

**Issue:**
28-17 widened `reconcileSnapshotRing`'s result to
`{ droppedFiles, deferred, rollbackFailed }` and its doc comment says
`rollbackFailed` "is the one state in which the sentence above cannot be honoured,
and the one this function has no other way to report, because rethrowing is
forbidden here (28-11 P5)". Measured: **nothing reads it.**

```
$ grep -n 'rollbackFailed' anno-store.ts anno-store.test.ts
anno-store.ts:939,952,954,1061,1063,1087,1089   <- producer + comments only
anno-store.test.ts:3981                          <- asserts it is `false` on the happy path
```

The two call sites:

```ts
// :1149 -- pruneSnapshots reads .deferred and nothing else
if (reconcileSnapshotRing(handle).deferred) return;

// :2186 -- revertTo step 6 discards the WHOLE result
reconcileSnapshotRing(restored);
```

So when the sweep's own `rollback` throws, the transaction it opened on the
CALLER's connection at `:950` stays open and:

* through `pruneSnapshots` → `runWriteSequence` step 9's swallowing wrap, an
  ordinary `setDataType` **reports success** and every later write on that handle
  fails "cannot start a transaction within a transaction" — which is CR-07's
  exact reported symptom, reachable again through the one sub-case 28-17's fix
  chose to report rather than handle;
* through `revertTo`, the function **returns `restored` to the caller** with that
  transaction open and the store's write lock held, with no field, no throw and
  no diagnostic distinguishing it from a clean revert.

A field whose only reader asserts it is always `false` is precisely what this
module's own doc mocks two paragraphs earlier: "a field that can only ever answer
one value is a claim the next reader has to falsify by experiment".

**Fix:** consume it at both sites. `pruneSnapshots` should return the fact rather
than `void`, and `revertTo` must not return a handle it cannot vouch for:

```ts
// revertTo step 6
const swept = reconcileSnapshotRing(restored);
if (swept.rollbackFailed) {
  // The connection may still hold an open transaction. Do not hand it back --
  // close it and reopen, which is the same remedy the two write-path handlers
  // already tell the caller to apply.
  try { closeStore(restored); } catch { /* the handle is already unusable */ }
  return openStore(storePath);
}
return restored;
```

and in `runWriteSequence` step 9, when the sweep reports `rollbackFailed`, the
write is still committed (28-11 P5 holds) but the HANDLE is not reusable — so the
fact belongs on the returned result or on a one-time `stderr` warning, not
swallowed.

### WR-19: the repaired commit-statement control still misses a trailing semicolon and a multi-statement `exec()`, both of which commit

**File:** `src/mcp/vice/anno-seam.test.ts:382-390` (`commitStatements`), used at `:430`
**Severity:** WARNING
*(new in round 5; the residual of WR-15's fix)*

**Issue:**
WR-15's fix replaced a `/\bcommit\b/gi` word count with a statement matcher:

```ts
return source.match(/\bexec\(\s*(['"`])\s*(?:commit|end(?:\s+transaction)?)\s*\1\s*\)/gi) ?? [];
```

That closes the SYNONYM hole and is a real improvement. It does not close the
hole. Measured against `node:sqlite` on Node 22.22 — both of these are fully
working commits, and both are counted as **0** by the matcher:

```
"db.exec(\"commit;\")"                              -> 0 matches; statement commits (verified)
"db.exec(\"insert into t values (2); commit\")"     -> 0 matches; both statements ran, row count 2 (verified)
```

`DatabaseSync.exec()` runs *multiple* statements — that is why `db.exec(DDL)` at
`:411` works at all — so any string ending in `; commit` is a second commit site,
and a bare `commit;` is the spelling a developer copying from a SQL console would
write first. The control's whole purpose is that the durability proof's planted
violation has exactly one site; with either spelling present, removing the one
matched `commit` leaves a working commit behind and
`anno-durability-mutator.mjs`'s `no-commit` mode silently stops planting anything.

**Fix:** match the STATEMENT inside the literal rather than the whole literal, and
keep both existing fixture controls plus two new negative-to-positive ones:

```ts
const COMMIT_STATEMENT_RE = /(?:^|;)\s*(?:commit|end(?:\s+transaction)?)\s*(?:;|$)/i;

function commitStatements(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(/\bexec\(\s*(['"`])([\s\S]*?)\1\s*\)/g)) {
    if (COMMIT_STATEMENT_RE.test(m[2])) out.push(m[0]);
  }
  return out;
}
```

Add `db.exec("commit;")` and `db.exec("insert into t values (1); commit")` to
`THREE_SPELLINGS_FIXTURE` (renaming it), and verify `NO_STATEMENT_FIXTURE` still
yields 0 — the `(?:^|;)` anchor is what keeps `step: "the commit could not be
completed"` uncounted.

### WR-20: the "no module-level mutable state" control exists in four hand-copied variants that disagree, and the seam's copy is the weakest

**File:** `src/mcp/vice/anno-seam.test.ts:285`, `src/mcp/vice/anno-types.test.ts:525-526`, `src/mcp/vice/anno-index.test.ts:477-478`, `src/mcp/vice/block-class.test.ts:319-320`
**Severity:** WARNING
*(new in round 5)*

**Issue:**
Four modules declare "NEVER hold module-level mutable state" as a load-bearing
trap, and each has its own copy of the scan that is supposed to enforce it. The
four copies are not the same scan. Measured, by running each predicate over the
same four candidate lines:

| candidate line | seam | types | index | block-class |
|---|---|---|---|---|
| `export let cachedHandle = undefined;` | **false** | **false** | true | **false** |
| `export const memo = new Map();` | **false** | true | true | **false** |
| `let x = 1;` | true | true | true | true |
| `const memo = new Map();` | true | true | true | true |

`anno-index.test.ts`'s copy is the only complete one — it carries
`(?:export\s+)?` on BOTH arms. `anno-types.test.ts` carries it on the `const` arm
only. `anno-seam.test.ts` and `block-class.test.ts` carry it on neither, so
`export let` and `export const … = new Map()` pass both. The blindest copy guards
`anno-store.ts`, the module where a memoised connection or a cached
`retainedRevisions` result would do the most damage — and where the pressure to
add one is highest, because `retainedRevisions()` opens up to 32 databases per
call and its own doc comment says "If a caller ever needs 'retained' on a
per-write hot path, the answer has to be cached".

This is the same defect class as WR-15: a structural control that reads as
enforcement and does not enforce. It is not a style point — the seam's own
header, `anno-types.ts` trap 3 and `block-class.ts` trap 3 all cite the scan as
the reason the rule cannot be undone silently.

**Fix:** one definition, one home, four callers — the discipline
`anno-seam.test.ts` already applies to `commitStatements()` and `codeOnly()`:

```ts
// in whichever of these files is the natural home (or a tiny shared test helper)
export function moduleLevelMutableOffenders(strippedSrc: string): string[] {
  return strippedSrc.split("\n").filter(
    (line) =>
      /^(?:export\s+)?(let|var)\s/.test(line) ||
      /^(?:export\s+)?const\s+\w+\s*(:[^=]*)?=\s*(new\s+(Map|Set|WeakMap|WeakSet)\b|\[|\{)/.test(line),
  );
}
```

and give it a planted-violation control of its own (a local fixture containing all
four candidate lines above), so the coverage the fixture proves is the coverage
every caller gets.

### WR-21: `addScope` is the only write entry point with neither idempotence nor a shape rule — duplicates and nested scopes are stored, both reported as `changed: true`

**File:** `src/mcp/vice/anno-store.ts:2377-2394`, with `src/mcp/vice/anno-types.ts:359-367` and `src/mcp/vice/anno-store.ts:175-188`
**Severity:** WARNING
*(new in round 5)*

**Issue:**
Every other write entry point reads the existing row first and returns
`changed: false` for a byte-identical repeat — `setDataType` (via `retype`'s
exact-match arm), `setLabel`, `setComment`, `putXref`, `createProjectEnum`,
`updateProjectEnum`. `addScope` inserts unconditionally and hardcodes
`changed: true`:

```ts
const { revision } = applyWrite(handle, (db) => {
  db.prepare("insert into anno_scope(start, end_inclusive) values (?, ?)").run(start, endInclusive);
  return true;
}, { baseRevision: args.baseRevision });
return { revision, changed: true };
```

Reproduced:

```
addScope($1000..$2000) -> { revision: 1, changed: true }
addScope($1000..$2000) -> { revision: 2, changed: true }     // byte-identical duplicate row
addScope($1400..$1500) -> { revision: 3, changed: true }     // NESTED inside the first two
listScopes ->
  { id: 1, start: 4096, endInclusive: 8192 }
  { id: 2, start: 4096, endInclusive: 8192 }
  { id: 3, start: 5120, endInclusive: 5376 }
```

Two documented claims break at once. `AnnoWriteResult`'s doc comment says
`changed` "is the ONLY signal that distinguishes a no-op from a real edit" — here
it can never say no-op, so an agent re-running an annotation pass (the exact case
that comment names) grows the scope table without bound and cannot tell.
`ScopeRow`'s doc comment says "There is no name field and **no nesting**: the
schema says nested scopes are unsupported, and the store must not invent a
capability the surface it mirrors does not have" — the store records a nested
scope set silently, which is inventing exactly that capability. There is also no
delete verb for scopes, so neither is recoverable except by revert.

**Fix:** make the duplicate a no-op and decide the nesting rule explicitly:

```ts
const existing = db.prepare("select id from anno_scope where start = ? and end_inclusive = ?").get(start, endInclusive);
if (existing) return false;                       // byte-identical repeat is a no-op, as everywhere else
const overlapping = db.prepare("select id, start, end_inclusive from anno_scope where end_inclusive >= ? and start <= ?")
  .all(start, endInclusive) as { id: number; start: number; end_inclusive: number }[];
if (overlapping.length > 0) {
  throw new AnnoRangeShapeError(
    `scope ${start}..${endInclusive} overlaps scope ${overlapping[0].start}..${overlapping[0].end_inclusive} (id ${overlapping[0].id}) -- ` +
      `nested and overlapping scopes are unsupported, so the write is REFUSED rather than stored as a shape nothing downstream can read`,
    { start, endInclusive },
  );
}
```

If overlap is in fact wanted, delete the "no nesting" sentence from `ScopeRow`'s
doc comment in the same commit and say what a nested scope means — the two
readings must not both be in the tree.

### WR-22: `revertTo`'s `revision` argument is unvalidated, and SQLite's column affinity turns a plain argument error into CR-08's corrupt-snapshot refusal

**File:** `src/mcp/vice/anno-store.ts:1939` (`revertTo`), `:1944-1947` (the pointer-row lookup), `:566-568` (`snapshotPathFor`)
**Severity:** WARNING
*(new in round 5; same class as WR-06, different site and different consequence)*

**Issue:**
`revision` is typed `number` and reaches two places with no validator: a bound
SQL parameter, and a **filename**. SQLite applies the column's INTEGER affinity
to a bound TEXT operand, so a numeric-looking string MATCHES the pointer row —
verified on Node 22.22:

```
select revision from s where revision = ?   with "1", "0001", " 1 ", "1.0"   ->  all return {revision: 1}
```

`snapshotPathFor` then builds the path from the RAW argument, so the two disagree.
Reproduced end to end against a healthy store retaining `[0, 1, 2]`:

```
revertTo(h, "0001")
-> AnnoStoreError: cannot revert to revision 0001: a pointer row claims it, but its snapshot
   /tmp/…/p.annostore.snapshots/r0001.db is not a readable annotation store (…: cannot open …)
```

That message is CR-08's corruption refusal, produced by an argument error. It
tells a caller its snapshot ring is damaged when the only thing wrong is the
string it passed — the exact confusion `AnnoStoreCorruptError`'s own doc comment
forbids ("'the annotations are gone' and 'there are no annotations' must not read
the same"). Phase 29 puts this on an MCP tool path where, per `anno-types.ts`'s
header, `validate: (value) => ({ value })` means a JSON `"1"` arrives verbatim.
Path traversal is NOT reachable — a non-numeric string fails the affinity
conversion and the pointer-row gate refuses first — so this is a diagnostic and
correctness defect, not a security one.

**Fix:** validate at the entry, next to WR-06's `assertBaseRevision`, and reuse
it for both:

```ts
function assertRevision(value: unknown, what: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new AnnoStoreStaleRevisionError(
      `${what} ${JSON.stringify(value)} is not a revision -- expected a non-negative integer. A numeric STRING is refused on purpose: ` +
        `SQLite's column affinity would match the pointer row while the snapshot FILENAME is built from the string, so "0001" would ` +
        `find revision 1's row and then look for r0001.db.`,
    );
  }
  return value as number;
}
```

### WR-23: `contradictedCommentsFor` treats the `undefined` data type inconsistently between its two arms, and the recorded rationale for the asymmetry is false

**File:** `src/mcp/vice/anno-store.ts:1768-1773`, with its doc comment at `:1750-1754` and the pinning test at `src/mcp/vice/anno-store.test.ts:1040-1062`
**Severity:** WARNING
*(new in round 5)*

**Issue:**
The rule is two lines:

```ts
if (CODE_GRADE_BRACKETS.includes(gradeBracket)) return dataType !== "code";
if (DATA_GRADE_BRACKETS.includes(gradeBracket)) return dataType === "code";
```

so `undefined` — the vocabulary member that asserts nothing — contradicts a
code-asserting grade and does not contradict a data-asserting one. Reproduced:

```
setComment($1000, line, "[confirmed-code] entry point")
setComment($1001, line, "[confirmed-data] sprite table")
setDataType($1000..$1001, "undefined").contradictedComments
->  [ { address: 4096, grade: "[confirmed-code]", contradictedBy: "undefined" } ]     // one, not two
```

The doc comment's justification for the second arm is "a data-asserting grade is
contradicted by `code`, and by nothing else — **every other member of the
vocabulary is another way of saying data**". That sentence is false for
`undefined` (which is the vocabulary's explicit "not determined") and arguable for
`external_file`. So the asymmetry rests on a stated reason that does not hold, and
the pinning test at `anno-store.test.ts:1040-1062` iterates
`DATA_TYPES.filter(t => t !== "code")` on both arms — which locks the asymmetry in
mechanically while recording no decision about it.

The consequence is a false positive in the direction trap 9 warns about: un-typing
a region (retyping to `undefined`) reports every code-graded comment in it as
"made false", when nothing has been asserted that could falsify it. Trap 9's own
argument — "a report that fires every time is a report nobody reads, so the one
case that matters stops being noticed" — applies directly.

**Fix:** either exclude `undefined` from both arms and record why, or state the
asymmetry as a decision. Excluding it is the reading consistent with the doc:

```ts
export function contradictedCommentsFor(gradeBracket: string | null, dataType: DataType): boolean {
  if (gradeBracket === null) return false;
  // `undefined` asserts nothing, so it cannot make any grade false. Excluded
  // from BOTH arms, not just the data arm, so the two read the same way.
  if (dataType === "undefined") return false;
  if (CODE_GRADE_BRACKETS.includes(gradeBracket)) return dataType !== "code";
  if (DATA_GRADE_BRACKETS.includes(gradeBracket)) return dataType === "code";
  return false;
}
```

and change the pinning test's two loops to exclude `undefined` explicitly, with a
third loop asserting `undefined` contradicts NOTHING — so the decision is visible
in the control rather than implied by a filter.

### WR-24: `revertTo`'s staging path is per-PID where `stageSnapshot`'s is per-ATTEMPT, and three unguarded `rmSync` sites will delete another attempt's in-flight copy

**File:** `src/mcp/vice/anno-store.ts:1998`, with the cleanup sites at `:2011`, `:2047` and `:2069`; contrast `:1231`
**Severity:** WARNING
*(new in round 5; distinct from WR-11, which reports the LEAK of this same file, not its uniqueness)*

**Issue:**
`stageSnapshot` names its staging file per ATTEMPT and its doc comment says why in
capitals: "THE UNIQUENESS IS PER ATTEMPT, NOT PER REVISION … a revision number can
recur after a revert, and two attempts at the same revision — **in this process or
another** — must not share a path".

```ts
// :1231 -- the writer, per attempt
const staging = join(dirname(snapPath), `r${revision}.${process.pid}.${randomUUID()}.tmp`);

// :1998 -- the revert, per (pid, revision)
const staging = `${storePath}.revert-${process.pid}-${revision}`;
```

Two `revertTo(handle, r)` attempts for the same `r` share a path. Two failure
modes follow, both from code already in the function: the second attempt's
`copyFileSync` overwrites the first's copy **between the first's step-3b
validation and its step-5 rename**, so the image validated is not the image
installed; and any of the three `rmSync(staging, { force: true })` cleanup sites
deletes the other attempt's in-flight file, after which its `renameSync` fails
with the caller's handle already closed at `:2058`. Two processes can share a PID
in this repo's own everyday architecture — a container and its host see the same
bind-mounted workspace through different PID namespaces, which is the boundary
CLAUDE.md calls "load-bearing everywhere".

**Fix:** use the same primitive the writer uses, and route the cleanups through the
existing helper rather than a bare `rmSync` (which is WR-11's other half):

```ts
const staging = `${storePath}.revert-${process.pid}-${randomUUID()}`;
…
discardSnapshot(staging);   // instead of rmSync(staging, { force: true }) at :2011, :2047, :2069
```

`randomUUID` is already imported at `:129`. Note that the name still sits outside
`SNAPSHOT_FILE_PATTERN` and outside the store's own basename-derived ring, so a
kill still leaks it — that half stays open under WR-11.

### WR-25: workspace confinement is opt-in on `openStore`, in a module whose stated premise is that nothing upstream validates anything

**File:** `src/mcp/vice/anno-store.ts:368-370`
**Severity:** WARNING
*(new in round 5)*

**Issue:**

```ts
export function openStore(path: string, opts: { workspaceRoot?: string; mustExist?: boolean } = {}): AnnoStoreHandle {
  const resolved = opts.workspaceRoot === undefined ? resolve(path) : storePathWithinWorkspace(path, opts.workspaceRoot);
```

With `workspaceRoot` omitted the path is merely `resolve()`d — no symlink
resolution, no root comparison, no diagnostic — and `openStore`'s default
behaviour is to CREATE the file. `anno-types.ts`'s header states the threat model
plainly: the MCP proxy's validator is `validate: (value) => ({ value })`, "so
every argument reaches the store UNVALIDATED: an address of 65536, a misspelled
data type, **and a store path pointing outside the workspace** all look identical
to the transport". Confinement is the mitigation for the third of those three, and
it is the only one a caller can forget. Two of this phase's own blockers (CR-03,
CR-04) were confinement escapes; the remaining escape is simply not passing the
option.

Note this module's neighbouring option got the opposite treatment: `mustExist` is
an explicit opt-IN precisely so a judge cannot accidentally create what it judges.
The safety-critical default is inverted here.

**Fix:** make the safe path the default and the unconfined path explicit and
greppable, in the style `mustExist` already establishes:

```ts
export function openStore(
  path: string,
  opts: { workspaceRoot?: string; mustExist?: boolean; unconfined?: true } = {},
): AnnoStoreHandle {
  if (opts.workspaceRoot === undefined && opts.unconfined !== true) {
    throw new AnnoStorePathError(
      `${path}: openStore needs a workspaceRoot -- the transport validates nothing, so an unconfined store path is a store file created ` +
        `wherever the caller's argument pointed. Pass { unconfined: true } only for a path this module derived itself.`,
      { path },
    );
  }
```

The three internal call sites that legitimately pass a module-derived path
(`snapshotOpenFailure` at `:626`, `revertTo`'s step-3b validation at `:2045` and
its reopen at `:2175`/`:2194`) take `unconfined: true`, and `anno-seam.test.ts`
pins that the guard exists and that those are the only sites using it — the same
mechanism it already uses for `applyWriteWithoutCommit`.

### WR-13: the published snapshot is never fsynced, so a durable pointer row can name a non-durable file

> **ROUND-5 STATUS: CLOSED by 28-17.** Body preserved as the historical record; verified in the round-5 summary table above.

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

> **ROUND-5 STATUS: CLOSED by 28-17.** Body preserved as the historical record; the Windows `process.getuid` residual it predicted stays open under IN-02.

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

> **ROUND-5 STATUS: CLOSED by 28-18 for its SYNONYM half only.** The trailing-semicolon and multi-statement residual is filed as WR-19.

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

> **ROUND-5 STATUS: CLOSED by 28-17 as written.** The unread-`rollbackFailed` residual is filed as WR-18.

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

> **ROUND-5 STATUS: CLOSED by 28-16 task 3.** Body preserved as the historical record.

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

### IN-06: `retype`'s remainder inserts drop the reserved `bank` column

**File:** `src/mcp/vice/anno-store.ts:1684-1686` (`insertRange`), called at `:1724` and `:1727`
**Severity:** WARNING (informational tier)
*(new in round 5)*
**Issue:** `insertRange()` hardcodes `null` for `bank`, so the surviving head and
tail of a split row lose whatever `bank` the original row carried. Unobservable
today — the DDL comment says "every row this store writes today has it null" and
nothing reads the column except `listRanges()`'s mapper — but the column is
declared as reserved for a future banked-memory model, and a split-and-preserve
path that drops it is exactly the silent loss that model will inherit. Same call
sites as CR-09, so the two are naturally fixed together.
**Fix:** give `insertRange` a `bank: number | null` parameter and pass
`row.bank` through from the overlapped row, keeping `null` for the newly typed
range.

### IN-07: a bad enum VARIANT NAME is refused with a message that names the enum instead

**File:** `src/mcp/vice/anno-store.ts:2445`, with `src/mcp/vice/anno-types.ts:1090-1099`
**Severity:** WARNING (informational tier)
*(new in round 5)*
**Issue:** `validatedVariants()` validates each variant's NAME by calling
`assertEnumName(value)`, whose refusal reads `project enum name "3 bad" is not a
legal identifier`. The offending value is a variant name, not the enum's name, so
a caller with a 40-variant mapping is told the wrong field is wrong and has to
diff to find out which. `AnnoLabelError` already carries `reason`, and the
neighbouring validator (`assertCommentText`) already takes a `what` option for
exactly this.
**Fix:** give `assertEnumName` the same `{ what }` option
`assertCommentText` has, and call it as
`assertEnumName(value, { what: \`variant name for key ${JSON.stringify(key)}\` })`.

### IN-08: `buildPaintIndex` accepts a row whose `id` collides with `NO_ROW`

**File:** `src/mcp/vice/anno-index.ts:130` (the `fill`), with `:61-63` (`NO_ROW`)
**Severity:** WARNING (informational tier)
*(new in round 5)*
**Issue:** `NO_ROW`'s doc comment justifies `-1` on the ground that it "can never
collide with a row id (SQLite `autoincrement` ids start at 1)" — but this function
is deliberately PURE and takes hand-built rows precisely so the tie-break case is
reachable (trap 1, and the module header's whole argument). It validates
`start` and `endInclusive` in three arms and does not validate `id` at all, so
`{ id: -1, … }` paints cells that `resolveAt` then reports as uncovered. The
argument for `-1` is about the store's rows; the function's contract is about any
rows.
**Fix:** a fourth arm beside the three that already exist:

```ts
if (!Number.isInteger(row.id) || row.id <= NO_ROW) {
  throw new AnnoRangeShapeError(
    `range id ${String(row.id)} is not a paintable row id -- expected an integer above ${NO_ROW}, because ${NO_ROW} is the ` +
      `"nothing covers this address" sentinel and a row painted with it is indistinguishable from an unpainted cell`,
    { start: row.start, endInclusive: row.endInclusive },
  );
}
```

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


## Round 6 Findings (post 28-19 / 28-20 / 28-21 / 28-22)

**Reviewed:** 2026-08-29
**Depth:** standard
**Files Reviewed:** 15 (the identical set; the diff under review is
`9db1e3d..HEAD`, which touched six of them: `anno-store.ts`, `anno-types.ts`,
`anno-store.test.ts`, `anno-overlap.test.ts`, `anno-seam.test.ts`,
`anno-durability-mutator.mjs`)

**Measured state, re-measured here rather than taken from the handoff:** the
eight `anno-*` / `block-class` test files are **210 pass / 0 fail / 0 skipped**
(`node --test`, 13.5 s).

### Round-6 verdicts on the four round-5 plans

Every id the fifth gap-closure round claimed is checked in the code, and where
the claim is behavioural it is re-driven through production entry points on a
scratch store. **All five behavioural claims reproduce.** Two of them close
their reported cause and leave a residual this round files as a NEW id rather
than as a re-opening — the residuals are different defects at the same site.

| Round-5 id | Round-6 verdict | Evidence re-measured here |
|---|---|---|
| CR-09 | **Closed for its reported cause; residual filed as CR-10.** The gate is `retype()`'s pre-delete loop (`anno-store.ts:1979-1990`) calling `remainderRefusal()` (`:1855-1896`), which asks `assertRangeShape()` itself rather than re-implementing the even-count rule. Re-driven: `setDataType($3000..$300f, lo_hi_address)` then `setDataType($3004..$3004, byte)` throws `AnnoSplitRemainderError` naming both spans and the 11-byte remainder; the row set and the revision are unchanged. The residual is that **an EVEN remainder is accepted and silently re-pairs every entry in the table** — see CR-10. |
| WR-18 | **Closed as written; residual filed as WR-26.** `rollbackFailed` has two production readers (`anno-store.ts:1234` in `pruneSnapshots`, `:2547` in `revertTo` step 6) and the fact is carried on `AnnoStoreHandle.transactionStateUnknown` (`:325`), read at `runWriteSequence`'s first statement (`:1501`). The residual: **the flag is set at ONE of the four sites that can observe a failed rollback**, and the other three are the ones that already know the fact. |
| WR-19 | **Closed for the two spellings it names; residual filed as WR-27.** `commitStatements()` (`anno-seam.test.ts:378-397`) now tests statement contents inside an `exec()` literal. Re-measured with the exact regex: `db.exec("commit;")` → 1, `db.exec("insert into t values (1); commit")` → 1, the prose fixture → 0. The residual: **`db.prepare("commit").run()` — the idiom this module uses for every other statement — is a fully working commit that the matcher counts as 0** (verified against `node:sqlite`, not argued). |
| WR-21 | **Closed; residual filed as WR-28.** Re-driven: `addScope($2000..$2100)` → `{revision:1,changed:true}`, the repeat → `{revision:2,changed:false}` with `listScopes().length === 1`, and a nested `$2050..$2060` throws `AnnoRangeShapeError`. The residual: **the refusal is unrecoverable** — there is no scope delete verb anywhere in the module (`grep 'delete from anno_' anno-store.ts` returns exactly two hits, neither on `anno_scope`), so a mistyped scope permanently blocks its span once it ages past the 32-revision ring. |
| WR-22 | **Closed.** `assertRevisionArgument()` (`anno-store.ts:2229-2246`) is `revertTo`'s first statement (`:2252`). Re-driven over eight values — `"1"`, `1.5`, `-1`, `NaN`, `Infinity`, `true`, `null`, `undefined` — all eight throw `AnnoRevisionArgumentError` and none reaches the pointer-row `select`. Nothing to add. |
| WR-24 | **Closed.** `anno-store.ts:2337` is `${storePath}.revert-${process.pid}.${randomUUID()}.tmp` and all three cleanups are `discardSnapshot(staging)`; `grep -c 'rmSync(staging'` inside `revertTo` is 0. |
| WR-25 | **Closed; two notes filed as IN-11.** The guard is `openStore`'s first statement (`:425-433`), before `resolve()` and before `new DatabaseSync`, and the four escape sites are the enumerated module-derived opens (`:695`, `:2388`, `:2520`, `:2559`). Re-driven: `openStore(path)` throws `AnnoStorePathError` and `existsSync(path)` is `false` afterwards. |
| WR-20, WR-23, IN-07, IN-08 | **Accepted by the round-5 verifier; re-checked as unchanged and carried forward.** `contradictedCommentsFor` is byte-identical (`:2039-2044`), the four module-level-mutable-state scans still disagree, and neither `NO_ROW` nor `assertEnumName`'s `what` was touched. |

### What this round attacked, and what it found

Rounds 1-5 argued about the snapshot ring and the revert path. This round
attacked the two areas the fifth round's own fixes created: **the semantics the
new remainder gate does NOT check**, and **the wiring of the new poisoned-handle
flag**. Both yielded.

* **CR-10 (BLOCKER)** — the remainder gate checks byte-count parity and nothing
  else, so an ordinary `setDataType` that fragments a split table on an EVEN
  boundary is accepted, silently re-pairs every entry in both remainders, and
  reports `changed: true`. That is the exact "irreversible split ORIENTATION"
  loss `retype()`'s own DECISION 1 comment cites as its reason for refusing the
  odd case — and `anno-overlap.test.ts:592` pins the corrupted row set as
  correct.
* **WR-26** — `handle.transactionStateUnknown` is set at one of four
  rollback-failure sites. The three that do not set it are the three that
  compute the fact and print it in prose.
* **WR-27** — the single-commit-site control still cannot see
  `prepare("commit").run()`, measured working.
* **WR-28** — `addScope`'s new refusal has no inverse verb.
* **WR-29** — 28-20 inserted `assertRevisionArgument` between `revertTo`'s
  120-line contract comment and `revertTo`, so the contract now documents the
  private validator.
* **WR-30** — `pruneSnapshots` changed from `void` to `boolean` with no
  documentation of what the boolean means, in a module that documents
  everything.

Nothing new was found in `anno-index.ts`, `block-class.ts`, `package.json` or
`anno-coverage.test.ts`; all four are unchanged since round 5 and their open
items (IN-03, IN-08, WR-10) are carried forward. **There is still no SQL
injection and no new one was introduced**: the round's new SQL is three bound
`prepare().run()`/`get()` statements in `addScope` and `retype`, and the new
staging name is `pid` + `randomUUID()`. No debug artifacts, no `eval`, no
dynamic `Function`, no new host-path consumer (`anno-store.ts` and
`anno-types.ts` are still absent from `hostpath-consumers.test.ts`'s closed set).

**Note for the orchestrator:** the nine new ids below will red
`docs-review-disposition.test.ts` (AUDIT-01) until each is named in a recognised
disposition source. That is the guard working, not a defect in it.

### CR-10: an EVEN split-table remainder is accepted and silently re-pairs every entry in the table — the parity gate 28-19 added does not protect the orientation its own comment says it protects

**File:** `src/mcp/vice/anno-store.ts:1959-2004` (`retype()`, the gate at
`:1979-1990` and the remainder inserts at `:1995` and `:1998`), with
`src/mcp/vice/anno-types.ts:784-789` (`assertRangeShape`'s only split rule) and
`:1329-1355` (`resolveSplitTargets`)
**Severity:** BLOCKER
*(new in round 6; the residual of CR-09's fix, not a re-opening of it)*

**Issue:**
A split table's layout is **first half / second half**, stated by
`resolveSplitTargets`'s own doc comment and implemented at
`anno-types.ts:1347-1352`: entry `i` of an `n`-entry table is
`bytes[i] | (bytes[n + i] << 8)`. The pairing of a byte with its partner is
therefore a function of **the row's start and the row's length**, and any change
to either re-pairs every entry.

`assertRangeShape()` knows exactly one rule about split tables — the byte count
must be even (`anno-types.ts:784`). CR-09's fix asks that one rule about each
remainder. So the gate refuses the ODD fragment and **accepts every even one**,
including every even fragment that destroys the pairing.

Reproduced through the public entry points only, on a fresh store, no
hand-editing and no test-only export:

```
setDataType(h, { start: 0x1000, endInclusive: 0x100f, dataType: "lo_hi_address" })
setDataType(h, { start: 0x1004, endInclusive: 0x1007, dataType: "byte" })
   -> { revision: 2, changed: true, contradictedComments: [] }

listRanges(h) ->
  { id: 2, start: 0x1000, endInclusive: 0x1003, dataType: 'lo_hi_address', bank: null }
  { id: 3, start: 0x1008, endInclusive: 0x100f, dataType: 'lo_hi_address', bank: null }
  { id: 4, start: 0x1004, endInclusive: 0x1007, dataType: 'byte',          bank: null }
```

Both remainders are even, both are re-acceptable at `setDataType`, both decode
under `resolveSplitTargets` — and **both mean something different from what they
meant before the call**:

| entry | pairing BEFORE (one 8-entry table) | pairing AFTER (row id 2, a 2-entry table) |
|---|---|---|
| 0 | `$1000` lo with `$1008` hi | `$1000` lo with `$1002` hi |
| 1 | `$1001` lo with `$1009` hi | `$1001` lo with `$1003` hi |

Every one of the eight recorded targets is now a different 16-bit value. There
is no report, no `contradictedComments` entry, no refusal, and no field
recording that the table was ever 16 bytes wide — so the recovery cost is the
one `anno-types.ts`'s header names for orientation loss: "a hand re-annotation
of every split table in every project file".

**Three things make this a BLOCKER rather than the WARNING its parity sibling
would have been.**

1. **It is strictly worse than CR-09, which was rated BLOCKER.** CR-09 produced
   an 11-byte row that `resolveSplitTargets()` REFUSES — a loud, detectable
   shape. This produces a row that resolves happily and returns wrong numbers.
   A refusal is recoverable; a plausible wrong answer is not.
2. **The module's own stated reason for refusing the odd case applies verbatim
   to this case, and was not followed through.** `retype()`'s DECISION 1
   comment (`:1921-1941`) rejects demoting an illegal remainder "because it
   destroys the recorded split ORIENTATION, which this module's own header calls
   the one irreversible decision in this area with no field to migrate -- a
   one-way data decision taken silently on the caller's behalf". The accepted
   path above takes exactly that decision, silently, on the caller's behalf.
3. **The suite pins the defect as correct.**
   `anno-overlap.test.ts:592` ("the LEGAL remainder case on the same split
   row") asserts the three-row set above BY VALUE and calls it legal, and the
   round-trip invariant at `:1190` asks only that every row be "re-acceptable at
   setDataType and decodable by resolveSplitTargets". Decodability is not
   preservation: a re-paired table decodes perfectly. So no control in the suite
   can go red on this, and the one control closest to it certifies it.

**Fix:** the honest rule for a first-half/second-half layout is that a split row
cannot be fragmented at all — there is no interior boundary at which the halves
survive, including the midpoint (splitting `$1000..$100f` at `$1008` yields two
8-byte tables whose entries pair within themselves, which is also wrong).
So refuse the partial overlap of a split row outright, in the SAME pre-delete
gate CR-09 added, and reuse its error class:

```ts
// In the gate loop, BEFORE remainderRefusal() -- a split row that is only
// PARTIALLY covered cannot be preserved at all. Its layout is
// first-half/second-half (`resolveSplitTargets`), so entry i pairs byte i with
// byte n + i: changing either end of the row re-pairs EVERY entry. An even
// remainder is not a legal fragment, only a legally SHAPED one -- the parity
// rule is the only thing `assertRangeShape` knows about split tables, and it
// is not the rule that matters here.
if (isSplitDataType(row.data_type as DataType) && (row.start < start || row.end_inclusive > endInclusive)) {
  throw new AnnoSplitRemainderError(
    `typing ${hexRange(start, endInclusive)} would fragment the ${row.data_type} table id ${row.id} ` +
      `(${hexRange(row.start, row.end_inclusive)}): a split table stores every entry's low byte in its FIRST half and its high byte ` +
      `in its SECOND half, so any change to either end re-pairs every entry in it. The whole retype is REFUSED rather than silently ` +
      `re-interpreting ${(row.end_inclusive - row.start + 1) / 2} targets. Retype the WHOLE table (${hexRange(row.start, row.end_inclusive)}) ` +
      `to the type you want first, then type the sub-range.`,
    { start: row.start, endInclusive: row.end_inclusive, rowId: row.id, rowStart: row.start, rowEndInclusive: row.end_inclusive,
      dataType: row.data_type as DataType },
  );
}
```

The parity check stays: it is still the right refusal for a NON-split remainder
of a row whose type later gains an even-count rule, and removing it would drop
CR-09's control. Two test changes belong in the same commit: rewrite
`anno-overlap.test.ts:592` to assert the REFUSAL (it currently certifies the
defect), and add the pairing table above as the evidence — an assertion over
`resolveSplitTargets`'s targets before and after, which is the only assertion
that can see this class of loss. `SEQUENCE`'s `expect` values in the round-trip
invariant will need re-deriving; the `refusals >= 3` non-vacuity floor rises
with them.

### WR-26: the poisoned-handle flag is set at ONE of the four sites that observe a failed rollback, and the three that skip it are the three that already computed the fact

**File:** `src/mcp/vice/anno-store.ts:1782` (the only site that sets it), with
the three that do not: `:1601-1612` (the publish handler), `:1717-1745` (the
commit handler) and `:1650-1663` (the mutation-refusal handler)
**Severity:** WARNING
*(new in round 6; the residual of WR-18's fix)*

**Issue:**
28-20 added `AnnoStoreHandle.transactionStateUnknown` and a refusal at
`runWriteSequence`'s first statement (`:1501-1510`) whose stated purpose is to
replace SQLite's bare `cannot start a transaction within a transaction` — CR-07's
symptom — with a named refusal. It is set in exactly one place:

```
$ grep -n 'transactionStateUnknown' anno-store.ts
325   the field
464   openStore: initialised false
1501  runWriteSequence: the refusal reads it
1782  runWriteSequence step 9: `if (pruneSnapshots(handle)) handle.transactionStateUnknown = true;`
```

Three other sites in the same file compute the identical fact into a local named
`rolledBack` and then throw it away:

```ts
// :1601 (publish handler) and :1717 (commit handler), same shape
let rolledBack = true;
try { handle.db.exec("rollback"); } catch { rolledBack = false; }
…
throw new AnnoStoreError(… rolledBack ? "…rolled back…" : "…CLOSE IT AND REOPEN…",
  { data: { …, rolledBack, … } });          // <-- the fact is reported and DISCARDED

// :1650 (the mutation-refusal handler) does not even track it
try { handle.db.exec("rollback"); } catch { /* deliberately ignored */ }
throw mutationError;
```

The consequence is that the state the new gate exists to name stays reachable
from the two paths most likely to produce it, and it is WORSE than the sweep
path it does cover, because on these paths the transaction that stays open holds
the revision compare-and-swap:

1. the commit fails and its rollback fails; the caller is told to close and
   reopen but the handle is not marked;
2. the caller — an MCP tool handler that catches, reports and continues, which
   is the Phase 29 shape — calls `setDataType` again;
3. `handle.transactionStateUnknown` is `false`, so the gate passes;
4. `currentRevision(handle)` reads **inside the still-open transaction** and
   returns `rev + 1`, a revision the disk does not have — the exact
   discrepancy the commit handler's own message warns about ("this connection
   may report `${rev + 1}` for a write that never landed");
5. `begin immediate` throws SQLite's bare
   `cannot start a transaction within a transaction`, outside the `ViceError`
   family — CR-07's reported symptom, from the site that had the fact in a local
   variable one statement earlier.

The mutation-refusal handler (`:1650-1663`) is the newest of the three and the most
exposed: 28-21's `addScope` overlap refusal throws from inside `mutate`, so
every refused scope now runs that rollback.

**Fix:** one assignment at each site, before the throw, next to the existing
`rolledBack` local:

```ts
if (!rolledBack) handle.transactionStateUnknown = true;
```

and at `:1650`, track the fact rather than swallowing it:

```ts
} catch (mutationError) {
  try {
    handle.db.exec("rollback");
  } catch {
    // A ROLLBACK THAT FAILED IS NOT A ROLLBACK. The caller's refusal is still
    // what gets thrown -- but this connection may hold an open transaction with
    // the compare-and-swap applied, so the NEXT call must refuse by name rather
    // than surfacing SQLite's bare "cannot start a transaction within a
    // transaction".
    handle.transactionStateUnknown = true;
  }
  discardSnapshot(staging);
  throw mutationError;
}
```

`anno-store.test.ts`'s WR-18 behavioural control already proves what happens
once the flag is set, so the new controls only have to prove it gets set — three
structural assertions in the shape of the existing
`assert.match(body.slice(call, call + 200), /handle\.transactionStateUnknown = true/)`
control at `:4434`, one per handler.

### WR-27: the single-commit-site control is still blind to `prepare("commit").run()` — the spelling this module uses for every other statement, verified as a working commit

**File:** `src/mcp/vice/anno-seam.test.ts:378-397` (`commitStatements`), used at
`:506`
**Severity:** WARNING
*(new in round 6; the second residual of WR-15 → WR-19)*

**Issue:**
WR-19's repair matches a commit statement **inside an `exec()` call**:

```ts
for (const m of source.matchAll(/\bexec\(\s*(['"`])([\s\S]*?)\1\s*\)/g)) {
  if (COMMIT_STATEMENT_RE.test(m[2] as string)) out.push(m[0]);
}
```

`exec()` is not the only way to commit, and it is not even this module's usual
way: `anno-store.ts` issues **every** other statement through
`prepare(...).run()` / `.get()` / `.all()`, and reserves `exec()` for the four
transaction keywords and the DDL. Measured on this host, Node 22, `node:sqlite`:

```
db.exec("begin immediate"); db.prepare("insert into t values (1)").run();
db.prepare("commit").run();
   -> a SECOND connection reads { c: 1 }        // the transaction committed
```

and measured with the file's own regex:

```
'db.prepare("commit").run();'                  -> 0 matches
'handle.db.prepare("end transaction").run();'  -> 0 matches
'const s = db.prepare("commit"); s.run();'     -> 0 matches
'db.exec("commit");'                           -> 1 match
```

So a second, fully working commit site written in the module's own dominant
idiom leaves the control at 1 and green. The control's entire purpose is that
`anno-durability-mutator.mjs`'s `no-commit` planting has a unique site to
remove; with a `prepare`-spelled commit present, `applyWriteWithoutCommit` still
commits and the durability proof plants nothing while reporting a pass. This is
the same defect class as WR-15 and WR-19, one layer out: the matcher was widened
along the axis the last residual named instead of along the axis that decides
what SQLite executes.

**Fix:** match the CALL, not the method name — every route from a string literal
to SQLite, which is `exec()` and `prepare()`:

```ts
// EVERY ROUTE FROM A LITERAL TO SQLITE, not just exec(). `prepare("commit").run()`
// is a fully working commit (measured) and is the idiom this module uses for
// every other statement, so a matcher that only knows exec() is blind to the
// spelling a contributor is most likely to write.
for (const m of source.matchAll(/\b(?:exec|prepare)\(\s*(['"`])([\s\S]*?)\1\s*\)/g)) {
  if (COMMIT_STATEMENT_RE.test(m[2] as string)) out.push(m[0]);
}
```

Add `db.prepare("commit").run();` and `handle.db.prepare("END TRANSACTION").run();`
to a new fixture with its own expected count (not folded into
`SIX_SPELLINGS_FIXTURE`, for the reason `MULTI_STATEMENT_FIXTURE`'s own comment
gives), and re-verify `NO_STATEMENT_FIXTURE` still yields 0 — it contains
`prepare` calls with non-commit literals, so it is already the right negative
control. `commitTransaction()` itself uses `exec`, so the seam's own count stays
1.

### WR-28: `addScope`'s new overlap refusal is unrecoverable — there is no scope delete verb, so one mistyped scope permanently blocks its span

**File:** `src/mcp/vice/anno-store.ts:2761-2801` (`addScope`, the refusal at `:2790-2799`), with the module's
complete delete surface
**Severity:** WARNING
*(new in round 6; the residual of WR-21's fix)*

**Issue:**
28-21 made `addScope` refuse any scope overlapping an existing one. The store has
no verb that removes a scope — or a label, a comment, an xref or an enum:

```
$ grep -n 'delete from anno_' src/mcp/vice/anno-store.ts
1250:  delete from anno_snapshot where revision = ?     (the prune)
1993:  delete from anno_range where id = ?              (retype's split-and-preserve)
```

So `addScope($1000, $ffff)` — one transposed end, and both ends arrive
unvalidated from a transport whose validator is `validate: (value) => ({ value })`
— makes **every future scope from `$1000` up permanently unaddable**. The only
route back is `revertTo`, which is bounded at `MAX_SNAPSHOT_REVISIONS` (32): once
32 further writes have happened, the mistake is permanent for the life of the
project file, and the store's own published floor will refuse the revision that
would undo it, by name.

Before 28-21 the same typo was recoverable — the corrected scope was simply added
alongside, and a downstream consumer picked the one it wanted. The refusal is the
right rule (`ScopeRow`'s doc comment and the mirrored schema both say nested
scopes are unsupported); what is missing is its inverse. A write verb whose
mistakes cannot be undone is a data-loss surface even when every individual
refusal is correct.

**Fix:** ship the inverse verb in the same phase as the refusal. It is the
smallest entry point in the module and it fits the existing shape exactly:

```ts
/** Removes the scope covering exactly `start..endInclusive`, or reports
 * `changed: false` when no such scope exists. THE INVERSE OF `addScope`'s
 * OVERLAP REFUSAL, and it ships with it rather than after it: a refusal with no
 * inverse turns one mistyped end into a permanently unusable span, because the
 * snapshot ring is bounded at MAX_SNAPSHOT_REVISIONS and a revert past the bound
 * is refused by name. Exact-span only -- a delete that guessed which overlapping
 * scope the caller meant would be the substitution trap 7 forbids. */
export function removeScope(
  handle: AnnoStoreHandle,
  args: { start: number | string; endInclusive: number | string; baseRevision?: number },
): AnnoWriteResult {
  const start = parseStoreAddress(args.start, { what: "start" });
  const endInclusive = parseStoreAddress(args.endInclusive, { what: "endInclusive" });
  assertRangeShape(start, endInclusive, "byte");
  const { revision, result } = applyWrite(
    handle,
    (db) => Number(db.prepare("delete from anno_scope where start = ? and end_inclusive = ?").run(start, endInclusive).changes) > 0,
    { baseRevision: args.baseRevision },
  );
  return { revision, changed: result };
}
```

If a delete verb is out of scope for Phase 28, say so IN `addScope`'s doc comment
next to the refusal — "there is deliberately no inverse verb yet; a mistyped
scope is recoverable only by `revertTo` within the ring bound" — so the trap is
recorded where the caller reads about the refusal, rather than discovered.

### WR-29: `revertTo`'s 120-line contract comment now documents `assertRevisionArgument` instead

**File:** `src/mcp/vice/anno-store.ts:2166-2228` (the two adjacent doc blocks)
and `:2247` (the function they were written for)
**Severity:** WARNING
*(new in round 6, introduced by 28-20)*

**Issue:**
28-20 inserted `assertRevisionArgument` between `revertTo`'s doc comment and
`revertTo`. The file now reads:

```ts
/**
 * Restores the whole store to the state it had at `revision` …
 * … THE REFUSAL SET HAS THREE ARMS …
 * … NOTHING IS CLOSED AND NOTHING IS RENAMED UNTIL THE STAGED IMAGE HAS BEEN
 * OPENED AS AN ANNOTATION STORE THIS BUILD CAN SPEAK TO …
 */
/**
 * The one gate on a revision-shaped argument …
 */
function assertRevisionArgument(value: unknown, parameter: string): number { … }

export function revertTo(handle: AnnoStoreHandle, revision: number): AnnoStoreHandle {
```

Two consecutive JSDoc blocks: TypeScript, every IDE and every doc generator
attach BOTH to `assertRevisionArgument`, and `revertTo` — the module's most
dangerous function, the one that closes the caller's handle and renames a file
over the store — is left with no doc comment at all. In a module whose entire
review history turns on comments that must stay true (28-07 P3, the recorded
reversals, "a rationale that became false is evidence"), a contract detached from
its function is not cosmetic: the next editor of `revertTo` hovers it and sees
nothing, and the ordering guarantee the comment exists to enforce
("NOTHING IS CLOSED AND NOTHING IS RENAMED UNTIL…") is invisible at the point of
edit.

**Fix:** move `assertRevisionArgument` and its own doc block ABOVE `revertTo`'s
contract comment, so each block sits immediately above the function it describes.
The validator is private and its position is free; the contract's position is
not. Consider a one-line structural control in `anno-store.test.ts` — the file
already extracts function bodies from the stripped source — asserting that the
text `export function revertTo` is preceded by a `*/` within a line or two, which
is what "the contract is attached" means mechanically.

### WR-30: `pruneSnapshots` changed from `void` to `boolean` with no documentation of the boolean, and only the in-module caller translates it

**File:** `src/mcp/vice/anno-store.ts:1160-1190` (the doc comment) and `:1191`
(the signature), with the single translating caller at `:1782`
**Severity:** WARNING
*(new in round 6, introduced by 28-20)*

**Issue:**
`pruneSnapshots` is an EXPORTED function of a module listed in
`package.json`'s `files[]`. 28-20 changed it to return `boolean`. Its doc
comment — 31 lines, covering the trap-10 ordering, the two-statement kill window,
the imported bound and the `busy_timeout` cost — says nothing about the return
value at all, and the value is not self-describing: `true` does not mean
"pruned", it means "the sweep's own rollback threw, so this connection may still
hold an open transaction and the store's write lock".

The translation from that boolean to `handle.transactionStateUnknown` exists at
exactly one call site (`:1782`). Any other caller — and this is a public export,
so Phase 29's tool layer is a plausible one — gets `true`, has no documented way
to know what it means, drops it, and is left holding precisely the connection
WR-18 was raised about, with the poisoned-handle gate never armed.

**Fix:** document it, and make the safe translation the function's own job rather
than its caller's:

```ts
/**
 * …
 * RETURNS whether the sweep reported that its OWN rollback failed -- the one
 * state it cannot fix and cannot throw about (28-11 P5). `true` means this
 * connection may still hold an open transaction and the store's write lock, and
 * the handle has been marked `transactionStateUnknown` so the NEXT write refuses
 * by name. It does NOT mean anything was pruned; nothing here reports that.
 */
export function pruneSnapshots(handle: AnnoStoreHandle): boolean {
  …
  const swept = reconcileSnapshotRing(handle);
  if (swept.deferred) {
    if (swept.rollbackFailed) handle.transactionStateUnknown = true;   // <-- here, not at the caller
    return swept.rollbackFailed;
  }
```

with `runWriteSequence` step 9 reduced to `pruneSnapshots(handle);` — the
existing structural control at `anno-store.test.ts:4395` then has to move to this
function, which is where the fact now lands. That also fixes WR-26's fourth
corner for free: every route that can leave a transaction open marks the handle
at the site that discovers it.

### IN-09: `AnnoSplitRemainderError` inherits `start`/`endInclusive` and fills them with the REMAINDER, where every other member of the family fills them with the caller's range

**File:** `src/mcp/vice/anno-types.ts:544-592` (the class) and
`src/mcp/vice/anno-store.ts:1885-1893` (its only construction site)
**Severity:** WARNING (informational tier)
*(new in round 6)*
**Issue:** the class documents itself as extending `AnnoRangeShapeError` so
"every existing `instanceof AnnoRangeShapeError` caller keeps working". Such a
caller reads `.start`/`.endInclusive`. Everywhere else in the module those two
fields are the span the CALLER named — `assertRangeShape` passes the argued
range, `addScope`'s overlap refusal passes the incoming scope. Here they are the
remainder the store computed, which the caller never mentioned and cannot act on
directly, and they duplicate `remainderStart`/`remainderEndInclusive` exactly. A
generic handler that highlights `e.start..e.endInclusive` highlights the wrong
span, and does so silently.
**Fix:** pass the CALLER's range to `super` and let the remainder live only in
its own two named fields:
`super(message, { start: options.callerStart, endInclusive: options.callerEndInclusive })`,
with `remainderRefusal` supplying `callerStart`/`callerEndInclusive` (it already
takes both). Then drop `start`/`endInclusive` from
`AnnoSplitRemainderErrorOptions`, which today only exist to be duplicated.

### IN-10: `remainderRefusal`'s repair advice is computed per row, so it can name a value another overlapped row would refuse

**File:** `src/mcp/vice/anno-store.ts:1872-1881`
**Severity:** WARNING (informational tier)
*(new in round 6)*
**Issue:** the refusal ends with "The nearest `${boundaryName}` values that would
leave an even ${side} are `${boundary - 1}` and `${boundary + 1}`". The gate loops
over every overlapping row and throws on the FIRST illegal remainder, so the
advice is computed from one row while the retype may overlap several. With two
split rows of opposite parity at either end of the caller's range, following the
printed advice moves the boundary into the other row's illegal remainder and the
retry is refused again, with the same shape of message pointing the other way.
Both suggested values are in range (a head remainder implies `row.start < start`,
a tail one implies `endInclusive < row.end_inclusive`), so this is a diagnostic
quality issue and not an out-of-range suggestion.
**Fix:** either qualify the sentence ("…for THIS row; other overlapped rows may
impose their own boundaries"), or collect every remainder refusal in the gate
loop and report them together — the latter is the better answer if CR-10's
whole-row refusal lands, because a caller then wants the full list of tables its
range would fragment.

### IN-11: the WR-25 escape pin counts one exact substring, so a fifth escape spelled without the space is invisible

**File:** `src/mcp/vice/anno-seam.test.ts:639` (`ESCAPE_AT_A_CALL_SITE`) and
`:661-668` (the count), with the same shape at
`src/mcp/vice/anno-store.test.ts:3694`, `:3920` and `:4490`
**Severity:** WARNING (informational tier)
*(new in round 6)*
**Issue:** the pin is
`const ESCAPE_AT_A_CALL_SITE = "unconfinedModuleDerivedPath: true";` counted by
`split(...).length - 1` and compared for exact equality with 4. The repo has no
formatter config of any kind (no `.eslintrc*`, no `.prettierrc*`, no
`biome.json`), so spelling is a matter of habit: a fifth escape written
`{unconfinedModuleDerivedPath:true}` or `{ unconfinedModuleDerivedPath : true }`
leaves the count at 4 and the test green, which is the silent direction. The
loud direction — reformatting an existing site drops the count to 3 and reddens —
is fine. The cross-module scan at `:671` is spelling-independent
(`includes("unconfinedModuleDerivedPath")`), so only additional sites INSIDE the
seam can evade. Same class as WR-20: a structural control that reads as
enforcement and can be stepped around by an equivalent spelling.
**Fix:** count a regex rather than a substring —
`(seamCode.match(/unconfinedModuleDerivedPath\s*:\s*true/g) ?? []).length` — and
give the count its own local fixture carrying all three spellings, in the style
`commitStatements`'s fixtures already establish in the same file.

## Round 7 Findings (post 28-23)

**Reviewed:** 2026-08-29T00:28:33Z
**Depth:** standard
**Files Reviewed:** 15 (the identical set; the diff under review is
`0df4ab3^..HEAD`, which touched **four** of them: `anno-types.ts`,
`anno-store.ts`, `anno-types.test.ts`, `anno-overlap.test.ts`. The other six --
`package.json`, `anno-coverage.test.ts`, `anno-index.ts`, `block-class.ts`,
`anno-store.test.ts`, `anno-durability-mutator.mjs` -- are byte-identical to the
tree round 6 reviewed: `git diff --stat 0df4ab3^..HEAD` over those six paths is
empty. `anno-store.ts` is still in `package.json:73`'s `files[]`, so WR-10 is
carried unchanged.)

**Measured state, re-measured here rather than taken from the handoff:** the
eight `anno-*` / `block-class` test files are **218 pass / 0 fail / 0 skipped**
(`node --test`, 13.5 s, **real exit 0**), and `./node_modules/.bin/tsc --noEmit`
exits 0. Both numbers reproduce 28-23-SUMMARY.md exactly.

### Round-7 verdict on 28-23's single id

| Round-6 id | Round-7 verdict | Evidence re-measured here |
|---|---|---|
| CR-10 | **Closed for its reported cause -- the SILENCE -- and only for that.** Re-driven through production entry points on a fresh store: `setDataType($1000..$100f, lo_hi_address)` then `setDataType($1004..$1007, byte)` still returns `changed: true` and still leaves the same three rows, but now also returns `reinterpretedSplitTables.length === 1` carrying `entryCountBefore: 8`, the eight `entryPairsBefore` couples, both survivors with their own couples, `preservedEntryPairs: []`, and a `summary` that names the row, both spans and the count. Every one of the round-6 verifier's five geometries is re-driven in `anno-overlap.test.ts` at its own caller ranges and asserted **by value**. The pairing loss itself is unchanged and was never claimed closed: answer (b) was the verifier's own sanctioned option, and `revertTo` remains the recovery path inside the 32-revision ring. Two residuals at the new sites are filed below as **WR-31** and **WR-32**, and three notes as **IN-12**, **IN-13**, **IN-14** -- new ids, never re-openings. |

**Three things 28-23 claimed that I checked and could not falsify**, recorded as
verified negatives so a later round does not re-spend the time:

* **The `resolveSplitTargets()` extraction is behaviour-preserving.** Driven as a
  DIFFERENTIAL, not read: the pre-28-23 `resolveSplitTargets` (a `git worktree`
  at `b681488`) and the current one were run side by side over **80** cases --
  eight byte images (empty, 1, 2, 3, 8 bytes, a `Uint8Array`, out-of-byte-range
  and non-integer values) x ten `dataType` arguments (the four layouts, `byte`,
  `""`, `null`, `undefined`, `7`, `{}`) -- comparing the returned object, the
  thrown constructor NAME, the message, and `start` / `endInclusive` /
  `dataType` / `validTypes`. **0 differences.** The `entryCount: n` ->
  `entryCount: targets.length` change and the moved odd-count refusal are not
  observable.
* **Every `setDataType` return path populates `reinterpretedSplitTables`.**
  `retype()` has exactly two `return` statements and one call site
  (`anno-store.ts:2315`); both returns carry the field, and it is threaded
  through `applyWrite`'s result unconditionally at `:2318-2325`. Refusals throw,
  so no refusal path carries it. The "always present, never absent" contract is
  also PINNED behaviourally at the two paths most likely to omit it:
  `anno-overlap.test.ts:335` asserts `deepEqual(r.result?.reinterpretedSplitTables, [])`
  for every NON-SPLIT case, and `:807` asserts `deepEqual(again.reinterpretedSplitTables, [])`
  on the `changed: false` identical repeat -- `deepEqual(undefined, [])` fails, so
  both are genuine presence pins. I raised this as a suspected control gap and
  withdrew it on the evidence.
* **The gate really does run entirely before the first `delete`.** `retype()`
  has two separate `for (const row of overlapping)` loops: the gate at
  `:2141-2152` (both `remainderRefusal` calls and then `splitReinterpretation`)
  and the mutation at `:2154-2162`. Verified behaviourally as well: every refused
  drive leaves `listRanges()` deep-equal (ids included) and `currentRevision()`
  unmoved.

**No new structural or security exposure.** `SCHEMA_VERSION` is still `2`
(`anno-types.ts:154`) and the round's diff contains no `create table` /
`create index` / `alter table` / `SCHEMA_VERSION` assignment -- the single match
is a COMMENT in DECISION 1 explaining why a column was rejected. No directory
layout change. No new SQL of any kind: the round added zero statements, and
`retype()`'s two `prepare()` calls are the pre-existing bound ones. No new
imports from `node:fs` / `node:path`, so `anno-store.ts` and `anno-types.ts` stay
out of `hostpath-consumers.test.ts`'s closed five-member set. No `eval`, no
dynamic `Function`, no `console.log`, no `debugger`, no TODO/FIXME, no secrets:
grep over all four changed files returns nothing but one `/tmp/annosym-XXXX/`
path inside a doc comment.

### Carried forward from round 6 -- the eight ids 28-23 was deliberately not scoped to

Plan 28-23 was scoped to CR-10 alone. Each of the eight is **re-checked against
the current tree** here, with the line it now sits on, so it cannot be lost
between rounds by being ABSENT rather than by being closed. None is re-filed.

| Id | Status on the 28-23 tree | Re-checked how |
|---|---|---|
| WR-26 | **STILL OPEN, unchanged.** | `grep -n 'transactionStateUnknown' anno-store.ts` -> `:330` (the field), `:469` (initialised `false`), `:1506` (the gate reads it), `:1787` (the ONLY setter, `if (pruneSnapshots(handle)) …`). The three sites that compute `let rolledBack = true` and never set it are still `:1123`, `:1606` and `:1722`; the mutation-refusal handler at `:1655-1665` still swallows its rollback failure with no local at all. One setter, four observers. |
| WR-27 | **STILL OPEN, unchanged.** | `commitStatements()` (`anno-seam.test.ts:405-414`) still iterates `source.matchAll(/\bexec\(\s*(['"`])([\s\S]*?)\1\s*\)/g)`. `prepare("commit").run()` -- the idiom `anno-store.ts` uses for every other statement -- is still counted 0. |
| WR-28 | **STILL OPEN, unchanged.** | `grep -n 'delete from anno_' anno-store.ts` returns exactly two hits, `:1255` (`anno_snapshot`) and `:2155` (`anno_range`); the only scope verbs are `addScope` (`:2942`) and `listScopes` (`:2993`). `addScope`'s overlap refusal still has no inverse. |
| WR-29 | **STILL OPEN, unchanged.** | `assertRevisionArgument` is `:2410` and its own doc block still sits between `revertTo`'s contract comment and the code; `export function revertTo` is `:2428`, preceded by `assertRevisionArgument`'s closing `}` at `:2426` and a blank line. `revertTo` still has no attached doc comment. |
| WR-30 | **STILL OPEN, unchanged.** | `export function pruneSnapshots(handle: AnnoStoreHandle): boolean` is `:1196`; the doc block above it ends at `:1195` on the `busy_timeout` sentence and still says nothing about what the boolean means. Its only translator is still `:1787`. |
| IN-09 | **STILL OPEN, unchanged.** | `anno-types.ts:645` is still `super(message, { start: options.start, endInclusive: options.endInclusive })`, and `remainderRefusal` still binds those to the REMAINDER (`anno-store.ts:1888-1889`). |
| IN-10 | **STILL OPEN, unchanged.** | `remainderRefusal`'s per-row "nearest legal boundary" advice is still computed inside the single-row call (`anno-store.ts:1874-1882`), while the gate still loops over every overlapping row and throws on the first refusal. |
| IN-11 | **STILL OPEN, unchanged.** | `const ESCAPE_AT_A_CALL_SITE = "unconfinedModuleDerivedPath: true";` is still `anno-seam.test.ts:639`, still counted by `seamCode.split(ESCAPE_AT_A_CALL_SITE).length - 1` at `:661`. |

### What this round attacked, and what it found

Round 6 attacked the semantics the parity gate does not check. This round
attacked **the code 28-23 wrote to answer it**: the newly extracted
`splitPartnerOffsets()`, the new public `splitEntryAddressPairs()`, the
reinterpretation gate's ordering and failure modes, the new always-present result
field, the rewritten DECISION 1 comment, and the two test files whose case table
and invariant grew. Five findings, none of them a BLOCKER, all reproduced or
measured rather than argued:

* **WR-31** -- the new gate calls `splitEntryAddressPairs()` on the OVERLAPPED
  ROW'S OWN SPAN, which the parity checks above it never validate. Against a
  store an EARLIER PUBLISHED BUILD wrote (the 11-byte `lo_hi_address` row CR-09
  documented), an ordinary `setDataType` that the immediately preceding build
  ACCEPTED now throws a bare `AnnoRangeShapeError` naming a span the caller never
  mentioned -- and the gate's own comment says this cannot happen. Driven across
  three builds via `git worktree`.
* **WR-32** -- `dropContained()`, the symmetric carve-out 28-23 calls
  load-bearing and defends in a 20-line comment, **never drops a single key** in
  the committed suite. Measured: 0 drops on the lost side and 0 on the reported
  side across all twelve `SEQUENCE` steps. The geometry that would exercise it is
  reachable and accepted, and is in neither `SEQUENCE` nor `SPLIT_CASES`.
* **IN-12** -- `preservedEntryPairs` is provably empty for every reachable input,
  and no control in the suite can tell the computed field from a hardcoded `[]`.
* **IN-13** -- `splitReinterpretation()` narrows with the PREFIX predicate
  `isSplitDataType` and then calls a function that re-validates with EXACT
  membership; the two disagree, observably.
* **IN-14** -- the partner rule the round reduced to one definition is restated in
  prose inside a user-facing string in `anno-store.ts`, outside the `n + i` grep
  that was scoped to `anno-types.ts`.

Nothing new was found in `anno-index.ts`, `block-class.ts`, `package.json`,
`anno-store.test.ts`, `anno-durability-mutator.mjs` or `anno-coverage.test.ts`;
all six are unchanged since round 6 and their open items (IN-03, IN-08, WR-10)
are carried forward. `anno-coverage.test.ts` was read and is still unchanged
since 28-03; per the phase note it is reviewed but not extended or re-verified,
and nothing was found in it.

**Note for the orchestrator:** the five new ids below will red
`docs-review-disposition.test.ts` (AUDIT-01) until each is named in a recognised
disposition source. That is the guard working, not a defect in it.

### WR-31: the new reinterpretation gate validates the OVERLAPPED ROW'S span, which nothing above it checks -- so a split row an earlier build wrote turns an ordinary retype into a refusal about a range the caller never named

**File:** `src/mcp/vice/anno-store.ts:1938-1943` (`splitReinterpretation`'s
`splitEntryAddressPairs(row.start, row.end_inclusive, layout)` call), with the
gate at `:2141-2152`, its ordering comment at `:2131-2139`,
`splitReinterpretation`'s own doc claim at `:1918-1922`, and
`src/mcp/vice/anno-types.ts:1476-1483`
**Severity:** WARNING
*(new in round 7; a residual at CR-10's fix site, not a re-opening of CR-10)*

**Issue:**
`splitReinterpretation()` computes `entryPairsBefore` by asking
`splitEntryAddressPairs()` about **the overlapped row's own span**:

```ts
// anno-store.ts:1943
const before = splitEntryAddressPairs(row.start, row.end_inclusive, layout);
```

and `splitEntryAddressPairs()` calls `assertRangeShape(start, endInclusive, layout)`,
which **throws** on an odd span. Nothing before that point validates the row's
own span: `remainderRefusal()` asks about the head and the tail, never about the
row. Both of the module's comments state the opposite:

```
// the gate, :2133-2136
// ORDER WITHIN THE LOOP IS LOAD-BEARING TWICE OVER: the two refusal checks run
// before the reinterpretation for the SAME row, so a row whose remainder fails
// parity never reaches a computation that would refuse it a second time with a
// worse message;

// splitReinterpretation, :1919-1921
// After, because a remainder that fails the parity gate is not a remainder this
// store will ever write and `splitEntryAddressPairs()` would refuse it;
```

Both sentences are about the REMAINDER. Neither covers the ROW, and the ordering
they describe does not protect the call that was actually added. This is the
third instance in this phase of a comment stating a guarantee the code below it
does not provide (28-07 P3, 28-21 P1).

**The input is not hypothetical, and it was not hand-built.** `anno-store.ts` is
in `package.json`'s `files[]` and every merge to `main` auto-publishes, so every
intermediate state of this module has shipped -- including the pre-28-19 one
CR-09 was raised against, whose ONLY reported symptom was that it persisted
exactly this row. Driven across three builds through production entry points
only, with `git worktree`:

```
# (1) the pre-28-19 build (worktree at e3adb18) writes the store, production API only
setDataType($1000..$100f, lo_hi_address); setDataType($1004..$1004, byte)
  rows: [2, 4096, 4099, lo_hi_address] [3, 4101, 4111, lo_hi_address] [4, 4100, 4100, byte]
                                        ^^^^^^^^^^^^^^ 11 bytes -- CR-09's row, on disk

# (2) the build IMMEDIATELY BEFORE 28-23 (worktree at b681488) opens that store
setDataType($1009..$1009, byte)          ->  ACCEPTED, changed: true
  rows: [2,4096,4099,lo_hi_address] [4,4100,4100,byte]
        [5,4101,4104,lo_hi_address] [6,4106,4111,lo_hi_address] [7,4105,4105,byte]
                                        both remainders EVEN -- the illegal row is REPAIRED

# (3) HEAD (28-23) opens the same store, same call
setDataType($1009..$1009, byte)          ->  THROWS
  AnnoRangeShapeError: a lo_hi_address table needs an even byte count, but
  4101..4111 is 11 byte(s) -- the low half and the high half must be the same length
  rows after: unchanged     revision: 2 -> 2
```

Three separate problems, in the order a caller meets them:

1. **A behavioural regression the round did not intend.** The write was accepted
   by the build 28-23 replaced, and its acceptance was the only *partial* route
   that repaired the legacy row. A full cover still works
   (`setDataType($1005..$100f, byte)` was re-driven and accepted), so the state
   is recoverable -- which is why this is a WARNING and not a BLOCKER -- but the
   caller is given no hint that a full cover is the way out.
2. **The refusal names a range the caller never mentioned.** The caller asked
   about `$1009..$1009`; the message is about `4101..4111`. It is not
   `AnnoSplitRemainderError`, it carries no `rowId`, no `side`, no
   "the whole retype is refused, so nothing was written" sentence, and its
   inherited `start`/`endInclusive` are the ROW's -- the same confusion IN-09
   reports at the sibling site, arriving here through a different class.
   `remainderRefusal()` exists precisely to translate an `AnnoRangeShapeError`
   into a message that names the caller's boundary and the remedy; this call site
   bypasses it.
3. **The same call site refuses on the row's `data_type` too** -- see IN-13.

The refusal IS in-family (`AnnoRangeShapeError extends ViceError`), the write is
atomic (rows deep-equal, revision unmoved), and no data is lost. That is what
holds this to a WARNING.

**Fix:** ask the row the same question the remainders are asked, through the same
translator, so a legacy row produces the module's own refusal instead of a raw
shape error -- or, better, treat a row the store could never have written today
as un-analysable rather than as a reason to refuse the caller's write:

```ts
// In splitReinterpretation, BEFORE the first splitEntryAddressPairs call:
//
// THE ROW'S OWN SPAN IS NOT GUARANTEED LEGAL. `remainderRefusal()` above asks
// about the HEAD and the TAIL, never about the row, and an odd split row is
// exactly what builds before 28-19 persisted (CR-09) -- a shape that is still on
// disk in any store those builds wrote. Analysing it would throw an
// AnnoRangeShapeError naming a span the caller never mentioned, and would refuse
// a write the previous build accepted (and which REPAIRS the row).
if ((row.end_inclusive - row.start + 1) % 2 !== 0) return null;   // nothing this record can describe
```

Whichever answer is taken, the two comments quoted above must be corrected in
the same commit -- they currently assert the protection this finding shows is
absent -- and `anno-overlap.test.ts` should gain the case, seeded the way the
CR-09 body already shows: an odd split row constructed through `applyWrite` (the
file already does exactly that for the `bank` control at `:821-831`), then a
production `setDataType` over it, asserting the chosen outcome by value.

### WR-32: `dropContained()` -- the symmetric carve-out 28-23 calls load-bearing -- never drops a key in the committed suite, and the geometry that would exercise it is reachable and absent from both tables

**File:** `src/mcp/vice/anno-overlap.test.ts:1723-1755` (`dropContained` and its
doc), used at `:1872-1873`; with `SEQUENCE` at `:1789-1791` and `SPLIT_CASES` at
`:946-1118`
**Severity:** WARNING
*(new in round 7)*

**Issue:**
28-23's SUMMARY lists "Symmetric carve-out: a set comparison's exclusion filter
applied identically to both operands" as one of four patterns the round
established, gives it a 20-line doc comment, and spends planting T3-B proving
that a one-sided version reds. In the committed suite the function is **inert**.

Measured by replaying the file's own `SEQUENCE` verbatim against the production
entry points and counting what `dropContained` removes at each step:

```
step  0  records 1  vanished 8   reported 8   carve-out drops: lost 0  reported 0
step  1  records 0  vanished 0   reported 0   carve-out drops: lost 0  reported 0
step  2  REFUSED
step  3  records 1  vanished 8   reported 8   carve-out drops: lost 0  reported 0
step  4  REFUSED
step  5  records 1  vanished 8   reported 8   carve-out drops: lost 0  reported 0
step  6  REFUSED
step  7  records 1  vanished 8   reported 8   carve-out drops: lost 0  reported 0
step  8  records 0  vanished 0   reported 0   carve-out drops: lost 0  reported 0
step  9  records 0  vanished 0   reported 0   carve-out drops: lost 0  reported 0
step 10  records 0  vanished 0   reported 0   carve-out drops: lost 0  reported 0
step 11  records 2  vanished 10  reported 10  carve-out drops: lost 0  reported 0
TOTAL carve-out drops across the whole SEQUENCE:  lost 0   reported 0
```

So in every executed assertion the invariant reduces to
`vanished === reportedLost`, and `dropContained` is applied to two sets it does
not change. **A `dropContained` written with the comparison inverted, or one that
dropped nothing at all, is green.** The doc comment states the premise honestly
("No step in today's `SEQUENCE` covers more than 8 contiguous bytes of a split
row") but does not draw the consequence, and the same premise holds of
`SPLIT_CASES`: no entry there both leaves a surviving fragment AND wholly
contains an entry pair.

**Such a geometry is reachable and is accepted today** -- driven through
production entry points only, on a fresh store:

```
setDataType($1000..$100f, lo_hi_address)
setDataType($1000..$1009, byte)   ->  changed: true, ONE record
  entryPairsBefore: ($1000,$1008) ($1001,$1009) ($1002,$100a) … ($1007,$100f)
  survivor:         $100a..$100f, 3 entries        preserved: 0
  rows now:         [2, $100a..$100f, lo_hi_address] [3, $1000..$1009, byte]
  pairs WHOLLY CONTAINED in the caller's range:  ($1000,$1008)  ($1001,$1009)
```

Two pairs are carved out on both sides, a fragment survives, and the invariant is
exercised for real. Any caller range covering 9 or more contiguous bytes of a
16-byte split row produces one, which is ordinary annotation work -- the same
argument DECISION 1 makes for accepting the fragmentation in the first place.

This is the same defect class as WR-20, WR-15 and IN-11, and this file's own
standard for it is explicit: a control's coverage must be proven by a case, not
by a comment. The round proved the symmetry with a PLANTING that was reverted;
nothing in the tree proves it now.

**Fix:** add the geometry to both tables, so the carve-out has a green case as
well as a red one:

```ts
// in SEQUENCE, after the existing $1004..$1007 pair
{ start: 0x1000, endInclusive: 0x1009, dataType: "byte", expect: "accepted", expectReinterpretedRows: 1,
  note: "lo_hi_address, no head, tail 6 -- even, so accepted; and the ONLY step whose caller range WHOLLY CONTAINS entry pairs " +
        "(($1000,$1008) and ($1001,$1009)), so it is the one step that exercises dropContained on both sides" },
```

and a matching `SPLIT_CASES` entry (`n: 4`, `c: 0x1000`, `d: 0x1009`) with its
`reinterpreted` couples hand-derived in the table's existing style. Re-derive
`finalRows`, `accepted`, `reinterpretingSteps` and `totalReportedLostPairs` with
it. A cheaper alternative that does not touch the sequence: give `dropContained`
its own local fixture control -- three keys, one contained, one straddling, one
outside -- in the style `commitStatements`'s fixtures already establish in
`anno-seam.test.ts`.

### IN-12: `preservedEntryPairs` can only ever be empty, and no control can tell the computed field from a hardcoded `[]`

**File:** `src/mcp/vice/anno-store.ts:1968-1971`, with
`src/mcp/vice/anno-types.ts:410-420` and the assertions at
`anno-overlap.test.ts:1185-1190`, `:1373`, `:1908`
**Severity:** WARNING (informational tier)
*(new in round 7)*
**Issue:** 28-23's key decisions record: *"`preservedEntryPairs` is COMPUTED by
comparing the before and after sets, never hardcoded to empty."* The computation
is real. But the module's own DECISION 1 arithmetic proves the field's value is a
constant: a survivor of `m` entries pairs its byte `j` with its byte `m + j`,
which matches an original `(i, n + i)` only when `m == n`, and a survivor with
`m == n` is not a fragment. A head survivor starts at the row's own start and has
`m < n`; a tail survivor starts strictly later, so both coordinates shift. **No
reachable input yields a non-empty `preservedEntryPairs`** -- which is why every
assertion in the suite expects `[]`, why `SPLIT_CASES` asserts
`preservedCount === 0` as a table-wide invariant, and why the always-`0 of N`
sentence is baked into `summary`. So the decision the round recorded is not
falsifiable by anything in the tree: replacing the two lines with
`const preservedEntryPairs: readonly (readonly [number, number])[] = [];` keeps
the suite green. The shape is also the one this module's own doc mocks, quoted in
WR-18's body: *"a field that can only ever answer one value is a claim the next
reader has to falsify by experiment."* Not a defect -- the future-proofing
argument is sound and is recorded -- but the claim and its evidence should not be
confused.
**Fix:** state the constancy where the field is declared rather than leaving it
implied ("empty for every input reachable TODAY, by the arithmetic above; computed
rather than asserted so a future layout with a different pairing stays correct"),
and, if the computation is to be defended by a control, unit-test
`splitReinterpretation`'s intersection against a hand-built survivor set that
DOES overlap `entryPairsBefore` -- the only way to show the `Set` arithmetic and
`entryPairKey()` are right in the direction they are never exercised in.

### IN-13: `splitReinterpretation` narrows split membership with a PREFIX test and then calls a function that re-validates with EXACT membership

**File:** `src/mcp/vice/anno-store.ts:1932-1943`, with
`src/mcp/vice/anno-types.ts:211-213` (`isSplitDataType`) and `:1466-1474`
(`assertSplitLayout`)
**Severity:** WARNING (informational tier)
*(new in round 7)*
**Issue:** the gate decides a row is a split table with
`if (!isSplitDataType(dataType)) return null;`, which is
`SPLIT_PREFIXES.some((prefix) => value.startsWith(prefix))` -- a prefix test. It
then calls `splitEntryAddressPairs()`, whose first act is `assertSplitLayout()`,
an EXACT membership test against the frozen four. The two disagree on any
`data_type` beginning `lo_hi_` or `hi_lo_` that is not one of the four names, and
`anno_range.data_type` has **no CHECK constraint** (`anno-store.ts:246`), so the
column can hold such a value from a foreign writer or a future/older vocabulary.
Observed, with the row inserted by a raw `node:sqlite` connection and the retype
driven through `setDataType`:
```
row: [2, 12288, 12303, "lo_hi_pointer"]
setDataType($3004..$3007, "byte")
  -> AnnoTypeError: "lo_hi_pointer" is not a split-table layout -- expected one of:
     lo_hi_address, hi_lo_address, lo_hi_word, hi_lo_word
```
A refusal about a type the caller never named, from a write that touches only
four bytes. Same root as WR-31 -- the gate trusts the on-disk row -- but a
different predicate and a different error class, and it needs a hand-built or
foreign store, so it is filed at the informational tier rather than with WR-31.
The redundant `const layout = dataType as SplitDataType` at `:1937` is a symptom:
TypeScript has already narrowed `dataType` by that line, and the cast exists
because the two predicates are not the same predicate.
**Fix:** narrow with the same predicate the consumer enforces --
`if (!(SPLIT_DATA_TYPES as readonly string[]).includes(dataType)) return null;` --
which makes the cast unnecessary and makes an unrecognised type a row this record
declines to describe rather than a refusal of the caller's write.

### IN-14: the partner rule the round reduced to ONE definition is restated in prose inside a user-facing string, outside the grep that proved the reduction

**File:** `src/mcp/vice/anno-store.ts:1979` (the `summary` literal), with
`src/mcp/vice/anno-types.ts:1441` (the definition) and the SUMMARY's own
`n + i` grep
**Severity:** WARNING (informational tier)
*(new in round 7)*
**Issue:** 28-23's headline deliverable is *"the split layout's partner rule has
exactly ONE definition in the repo"*, evidenced by
`grep -n 'n + i' src/mcp/vice/anno-types.ts` returning one line. The grep is
scoped to **one file**. Run across the module, the rule appears in four places:
```
anno-types.ts:1441      offsets.push([i, n + i] as const);              <- THE definition
anno-store.ts:1979      `A split table pairs byte i with byte n + i, …` <- a PROSE copy, shipped to the caller
anno-overlap.test.ts:1718  pairs.add(pairKey(row.start + i, row.start + n + i));  <- the independent oracle
anno-types.test.ts:171     targets.push(bytes[i] | (bytes[n + i] << 8));          <- the worked-arithmetic pin
```
The two test copies are deliberate and documented -- an independent oracle must
not import its subject, and both are asserted against. The `anno-store.ts` copy
is neither: it is a sentence inside the `summary` the store hands a caller, it is
asserted by no control (the SUMMARY records `summary` verbatim, but no test
compares it against the layout), and if the pairing ever changes it becomes a
false statement delivered in the store's own voice. That is the exact class this
module treats as a real finding (WR-23: "the recorded rationale for the asymmetry
is false"), one step earlier.
**Fix:** either derive the sentence from the record it accompanies -- e.g.
`` `entry i of ${before.entryCount} pairs its own byte i with its own byte ${before.entryCount} + i` `` --
so it cannot describe a rule the data contradicts, or widen the round's own grep
to the module (`grep -rn 'n + i' src/mcp/vice --include=*.ts`) and pin the four
hits with their reasons, in the style `anno-seam.test.ts` already uses for the
`unconfinedModuleDerivedPath` sites.


---

_Reviewed: 2026-08-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Round: 7 (ADDITIVE to rounds 1-6, every byte of which is preserved above. Round 7 reviews the sixth gap-closure round, plan 28-23 (`0df4ab3`, `e606894`, `871de8b`). It records CR-10 as closed for its reported cause -- the SILENCE -- on a re-drive through production entry points, re-checks all EIGHT round-6 ids that 28-23 was deliberately not scoped to (WR-26, WR-27, WR-28, WR-29, WR-30, IN-09, IN-10, IN-11) and finds every one of them unchanged and still open, and opens WR-31, WR-32, IN-12, IN-13 and IN-14 at the sites 28-23 created. No new BLOCKER. Three of 28-23's claims were attacked and could not be falsified: the `resolveSplitTargets()` extraction is behaviour-preserving over an 80-case differential against the previous build, every `setDataType` return path populates `reinterpretedSplitTables` and its presence is genuinely pinned, and the gate runs entirely before the first `delete`. Both carried-forward human-verification items remain open and are claimed by nothing here.)_
_Round: 6 (ADDITIVE to round 5, which is preserved verbatim below the title. Round 6 re-verifies all nine round-5 ids that were dispositioned `fix`, re-checks the four dispositioned `accept`, and opens CR-10, WR-26, WR-27, WR-28, WR-29, WR-30, IN-09, IN-10 and IN-11. Two of the round-5 fixes -- CR-09's parity gate and WR-18's poisoned-handle flag -- reproduce as claimed and leave residuals filed as new ids, never as re-openings. Both carried-forward human-verification items remain open and are unchanged.)_

_Round: 5 (supersedes the round-4 review of the same file set; CR-08, WR-13, WR-14, WR-16 and WR-17 are dispositioned CLOSED with evidence, WR-15 CLOSED for its synonym half with the residual filed as WR-19, WR-16's residual filed as WR-18, and every other round-3/round-4 id is carried forward explicitly. Both prior disposition tables are preserved verbatim.)_
