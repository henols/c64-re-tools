---
phase: 28-the-store-core
verified: 2026-08-27T19:32:49Z
status: gaps_found
score: 8/11 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "The snapshots/ directory is bounded at MAX_SNAPSHOT_REVISIONS, the anno_snapshot pointer rows are pruned to match, and a revert to a pruned revision is REFUSED by name with the oldest retained revision in the message (28-06 truth 7; 28-06 prohibition 3)"
    status: partial
    reason: "The bound, the pruning and the named refusal all hold on a forward-only store — independently reproduced. They stop holding after the FIRST revertTo: the snapshot image is a `vacuum into` of the whole store, so it carries the anno_snapshot table, and restoring it reinstates pointer rows for revisions whose FILES the prune already deleted. oldestRetainedRevision() then reports a floor that cannot be honoured, and following that floor throws a raw non-ViceError ENOENT out of copyFileSync — after revertTo has already closed the caller's handle, so there is no handle left to diagnose with. This is CR-01, reproduced verbatim."
    artifacts:
      - path: "src/mcp/vice/anno-store.ts"
        issue: "DDL:246-249 puts anno_snapshot inside the snapshot image that runWriteSequence:499 takes with `vacuum into`; revertTo:802-833 restores that image wholesale; oldestRetainedRevision:408-412 reads min(revision) from the restored rows and reports 0 with no file behind it; revertTo:824-829 does all filesystem work AFTER closeStore(handle) (WR-02), so the ENOENT escapes with the connection already closed."
    missing:
      - "Exclude anno_snapshot from the restored image, or reconcile the pointer rows against the snapshots/ directory immediately after a restore, so the reported floor is one revertTo can actually honour"
      - "Convert a missing snapshot FILE into the same named AnnoStoreError refusal the missing POINTER ROW already produces at revertTo:806-816 — a snapshot the ring promises and cannot deliver must be refused, not crashed on"
      - "Do the copy/fsync/rename before closeStore, or return the original handle on failure, so a failed revert leaves the caller a usable handle"
      - "A test pinning revertTo-then-oldestRetainedRevision-then-revertTo; no test in the phase exercises a second revert after a prune"
  - truth: "Snapshot pruning happens AFTER the commit and outside the write transaction, and a kill between the commit and the prune leaves extra files, never a missing one the revert path still points at (28-06 truth 8)"
    status: partial
    reason: "The first half is true and verified in code: runWriteSequence step 9 calls pruneSnapshots after commitTransaction and outside the transaction. The second half is FALSIFIED BY THE PRUNE LOOP'S OWN ORDER. pruneSnapshots:445-457 does rmSync(file) and THEN `delete from anno_snapshot`, per doomed row. A kill between those two statements leaves precisely the state trap 10 names as the one the revert path cannot survive — a pointer row aimed at a file that is already gone. The code comment concludes 'The file is deleted before its pointer row for the same reason -- the opposite order can produce the bad state and this one cannot', which is inverted with respect to its own premise. This is WR-01, confirmed by reading the loop; CR-01 reaches the identical bad state by a second route that needs no kill at all."
    artifacts:
      - path: "src/mcp/vice/anno-store.ts"
        issue: "pruneSnapshots:430-458 — file-then-row ordering, with a doc comment asserting the opposite guarantee. The unlink is correctly swallowed and the row delete correctly not swallowed, but the two are in the order that produces the forbidden state rather than the harmless one."
    missing:
      - "Swap the two statements: delete the pointer row first, then unlink the file, so a kill mid-loop leaves an orphan FILE (harmless, reconcilable by revision number) instead of an orphan ROW"
      - "Correct the inverted conclusion in the doc comment so it matches the code and trap 10's premise"
  - truth: "anno-types.ts provides workspace path confinement — a store write cannot land outside the workspace root (28-01 artifact `provides`; anno-store.ts trap 7)"
    status: partial
    reason: "The `..` half of the control works and is pinned; I reproduced its refusal (AnnoStorePathError). The symlink half does not exist. storePathWithinWorkspace compares resolve(path) against resolve(workspaceRoot) + sep, and resolve() normalises `..` but does not resolve symbolic links, so a symlinked subdirectory inside the workspace escapes confinement. Reproduced: with workspaceRoot=<ws> and <ws>/escape a symlink to a sibling directory, openStore(<ws>/escape/p.annostore) succeeded and the store file was CREATED outside the workspace root. This is CR-03. The module's own header premise is that this path arrives unvalidated from the transport (vice-proxy.ts's validator is `(value) => ({ value })`), so a checked-in or agent-created symlink is sufficient — no privileged access is needed."
    artifacts:
      - path: "src/mcp/vice/anno-types.ts"
        issue: "storePathWithinWorkspace:702-712 — resolve() only; no realpath resolution of either the root or the deepest existing ancestor of the target."
      - path: "src/mcp/vice/anno-store.test.ts"
        issue: "The confinement tests pin the sibling-prefix and `..` cases only. No test plants a symlink, so the gap is invisible to the suite."
    missing:
      - "Compare real paths: realpathSync the workspace root, and realpath the deepest EXISTING ancestor of the store path so a not-yet-created file still works"
      - "A test asserting a symlinked subdirectory is REFUSED, not followed, alongside the existing sibling-prefix pin"
deferred: []
prohibition_flags:  # all nine are verification: judgment — see the section below. Non-authoritative LLM-judge verdicts; human review recommended.
  - statement: "MUST NOT let revert history grow without bound ... never a silent best-effort (28-06 P9)"
    verdict: partially_held
    flagged: true
    reason: "Bound is a named constant and the forward-path refusal is named; post-revert the refusal degrades into an unhandled ENOENT, which is worse than the best-effort the prohibition forbids. Overlaps gap 1."
  - statement: "The other eight judgment-tier prohibitions (28-03 P1/P2, 28-04 P3/P4, 28-05 P5/P6, 28-06 P7/P8)"
    verdict: held
    flagged: true
    reason: "Each independently reproduced (see Prohibition Assessment). Flagged only because verification: judgment admits no automated proof — unverified-prohibition, human review recommended."
---

# Phase 28: The Store Core — Verification Report

**Phase Goal:** This project owns the annotation state — labels, comments, per-range typing over the full 12-member vocabulary, scopes and project enums — durable across a `SIGKILL`, revertible, and reachable through exactly one persistence seam. The milestone's one irreversible decision lands here.
**Verified:** 2026-08-27T19:32:49Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## What this verification did

Everything below marked VERIFIED was reproduced by this verifier against the
committed code at `57dfb0b`, in its own process — not read out of a SUMMARY. That
includes running the phase's own six test files (98 top-level tests, 0 failures),
running independent probes against `anno-store.ts`/`anno-types.ts`/`anno-index.ts`
/`block-class.ts`, and **removing `runWriteSequence`'s single `commit` by hand to
observe criterion 4's red on the real shipped call path**, then restoring the file
(`git diff --stat` clean, suite green again).

The three phase-28 blockers in `28-REVIEW.md` were each reproduced independently
rather than taken on the reviewer's word. Two of them reproduced *verbatim*,
including the reviewer's exact reported output line. One reviewer claim (WR-08's
"merges adjacent same-type rows", framed as a `STORE-02` contradiction) is
**refuted** in that framing.

## Goal Achievement

### Observable Truths

Truths 1-5 are the ROADMAP success criteria (the contract). Truths 6-11 are
PLAN-frontmatter must-haves that add material scope beyond them.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Full 12-member vocabulary with the four split layouts as first-class members; a `lo_hi_address` fixture read as `hi_lo_address` produces a **differing resolved-target set**; collapsing the four to one `table` makes that control fail | ✓ VERIFIED | Probed over IDENTICAL bytes `[00 10 34 12 78 56]`: `lo_hi_address`→`[4608,30736,22068]` vs `hi_lo_address`→`[18,4216,13398]` — orientation is observable as a differing target set. Second axis also observable: `_address` → `producesXrefs:true`, `_word` → `false` with equal targets. `DATA_TYPES` is exactly the twelve members in the schema's order, frozen (read out of `assertDataType`'s own refusal message). Collapse planting is a real test: `anno-types.test.ts:208` ("the collapse planting, observed"), passes. The reassembly NON-control is recorded as an assertion at `:231` rather than used as the control. |
| 2 | Narrowest-range-wins exact at all **65,536** addresses, cross-validated against a second independent implementation with **zero** disagreements; tie-break, both ends and `$FFFF` pinned; `$0400-$0400` reports length 1; ranges never merged on adjacency, no splitter primitive | ✓ VERIFIED | `anno-index.test.ts:200-250` is a genuine exhaustive loop `ADDRESS_MIN..ADDRESS_MAX` against `resolveByScan`, with `assert.equal(comparisons, 0x10000)` asserted FIRST as the non-vacuity half. Fixture non-degeneracy pinned on BOTH axes (`:259` different lengths, `:268` equal lengths). 13 tests pass. Adjacency proven twice: behaviourally (`anno-overlap.test.ts:463`, and my own probe — `$0400-$04FF` + `$0500-$05FF` stay two rows with ids 1,2) and structurally (`:487` scans `codeOnly(anno-store.ts)` for `coalesc`/`merg`/`splitter`, offenders `[]`, with a `strict.length > 5_000` non-vacuity pin). |
| 3 | A partial overwrite **splits and preserves**; total typed bytes unchanged across all five overlap cases; planting `filter()`-and-insert makes the fully-contained case fail; a retype that contradicts a comment returns the contradicted comments **as data** | ✓ VERIFIED | Probed case 3 directly: `$2000-$20FF byte`, retype `$2040-$207F code` → 3 rows `[2000-203f byte][2080-20ff byte][2040-207f code]`, total typed bytes 256→256. Probed the contradiction rule: retype `code`→`byte` over three comments SUCCEEDED (`changed:true`) and returned exactly the `[confirmed-code]` one as data — the `[unknown]` and ungraded comments correctly not reported. Both plantings exist as passing tests (`anno-overlap.test.ts:312` planting A selective per-case, `:427` planting B), and `:358` measures why invariant B is not optional (case 4 loses 128 addresses while satisfying the naive total). |
| 4 | Durability and revert proven by **ONE combined planted-violation test**: mutate → `SIGKILL` no clean close → **fresh process** → reopen → reads back **by value** → revert returns prior value; removing the commit makes **that same test** go red, observed; a truncated store file is **refused**, never partial | ✓ VERIFIED | `anno-durability.test.ts:179` is one test asserting both halves as values outside any try, plus all-or-nothing on the same run; `:238` is the planted counterpart asserting BOTH booleans false on ONE planting. The child is a genuinely separate OS process (`execFileSync(process.execPath, [MUTATOR, ...])`) that runs `process.kill(process.pid, "SIGKILL")` at `anno-durability-mutator.mjs:125`. **I observed the red myself on the real shipped path**: replacing `commitTransaction`'s `db.exec("commit")` with a no-op turned `:179` from `ok` to `not ok`; restoring gave 4/4 green. Refusal probed independently — zero-length, foreign text, truncated mid-file, missing `anno_meta` row and mismatched `schema_version` all refused with `AnnoStoreCorruptError`. |
| 5 | Every write carries a schema version and a **reserved, uninterpreted** `bank` field; xref rows carry their access kind; a write on a stale base revision is **refused** rather than discarding another process's annotations, observed cross-process; `node:sqlite` reachable from exactly one module, asserted structurally | ✓ VERIFIED | DDL: `anno_meta.schema_version`; nullable `bank integer` on `anno_range`/`anno_label`/`anno_comment`/`anno_xref`; `anno_xref.access_kind text not null`; `XREF_ACCESS_KINDS` frozen as `["READ","WRITE","READ_WRITE","COMPUTED_JUMP"]`; no FTS5 table. `bank` is written NULL and read back but **never branched on** — grep for `bank ===`/`bank !==`/`if (…bank` across all three modules returns nothing, so "uninterpreted" is literally true. Cross-process CAS at `anno-store.test.ts:1176` uses a real second process and asserts both revisions on the error plus the exact surviving row set; I probed the refusal path independently. Single seam: `anno-store.ts` is the only entry in `package.json` `files[]` naming `node:sqlite` — the four other hits (`anno-store.test.ts`, `anno-overlap.test.ts`, `anno-durability.test.ts`, `anno-durability-mutator.mjs`) are all inside COMMENTS, stripped by `codeOnly`, and none is shipped. |
| 6 | A store file is refused rather than read when zero-length, truncated mid-file, missing its `anno_meta` row, or of a mismatched schema version — with the tail-truncation residual **stated**, not claimed closed (28-06 truth 3) | ✓ VERIFIED | All four probed, all `AnnoStoreCorruptError` (plus a foreign prose file, also refused). The residual is real and honestly recorded: I flipped a byte three from the end of a 30-write store and it OPENED — which is exactly what `anno-store.test.ts:292-308` states deliberately WITHOUT an assertion ("THE STATED RESIDUAL … asserting a behaviour nobody measured is how a stated residual becomes a false claim"). Stating it is what truth 3 asks for. |
| 7 | The snapshot ring is bounded, the pointer rows are pruned to match, and a revert past the bound is **REFUSED by name** with the oldest retained revision in the message (28-06 truth 7) | ✗ FAILED (partial) | Holds forward-only: after 40 writes, 32 files on disk, `oldestRetained` 8, and a revert below 8 refuses by name. **Breaks on the first revert.** `revertTo(8)` restored pointer rows `[0..7]` whose files the prune had deleted; `oldestRetainedRevision` then reported `0`; following that floor threw `Error: ENOENT … copyfile r0.db` — not a `ViceError`, and thrown after `revertTo` had already closed the handle. CR-01, reproduced. See gap 1. |
| 8 | Pruning happens after the commit and outside the transaction, and a kill in the window leaves **extra files, never a missing one the revert path still points at** (28-06 truth 8) | ✗ FAILED (partial) | First half verified in code (`runWriteSequence` step 9). Second half falsified by `pruneSnapshots:445-457`, which unlinks the FILE and then deletes its POINTER ROW — a kill between the two produces exactly the forbidden state, and the doc comment's own conclusion is inverted. WR-01, confirmed. See gap 2. |
| 9 | `anno-types.ts` provides workspace path confinement — a store write cannot land outside the workspace root (28-01 artifact `provides`; trap 7) | ✗ FAILED (partial) | `..` escape refused (`AnnoStorePathError`) — control works. Symlinked subdirectory NOT refused: the store file was created outside the workspace root. CR-03, reproduced. See gap 3. |
| 10 | A label name bound to a different address is refused; an illegal character refuses rather than being sanitised; the mnemonic denylist is DERIVED from `OPCODES` and compares case-insensitively; an unprefixed numeric address string is refused | ✓ VERIFIED | Probed all five refusals: same-name-different-address, `"init screen"`, `lda`, `LDA`, `Rol` — every one `AnnoLabelError`, and `listLabels` still held exactly the one original row, so nothing was sanitised into existence. Denylist is 76 entries (derived; `anno-types.test.ts:328` pins the size against a count computed from `OPCODES`, so a hand-typed list cannot pass). `parseStoreAddress`: `$0810`→2064, `0x0810`→2064, `0X0810`→2064, `"2064"`→`AnnoAddressError`. `anno_xref` held 0 rows after typing a `lo_hi_address` range — nothing derivable cached on disk. |
| 11 | The census vocabulary boundary accepts the store's lowercase vocabulary alongside the analyser's capitalised one, pinned by a **derived total** cross-check, with `block-class.ts`'s import list still empty | ✓ VERIFIED | Probed: all 12 `DATA_TYPES` map totally — exactly 1→`code`, exactly 1→`undefined`, 10→`data`; capitalised `Code`/`Undefined` still map correctly; `CODE`, `Code `, `cOdE` all fall through to `data`, so no third spelling was silently admitted. `block-class.ts` has **zero** `import` lines; the derived cross-check lives in `block-class.test.ts:130` with a `DATA_TYPES.length === 12` non-vacuity pin. `PRODUCTION_BLOCK_SPELLINGS` is the derived union at `r2000-coverage.test.ts:679`. 131 tests pass across the two files. The false header rationale was rewritten honestly (two vocabularies differing in case, never one case-insensitive comparison) with the transitional arm's removal condition named (`CUT-01`). |

**Score:** 8/11 truths verified (0 present, behavior-unverified)

All five ROADMAP success criteria are VERIFIED. The three failures are
PLAN-frontmatter must-haves that extend beyond the roadmap contract — all three
in the snapshot/revert/confinement area, and all three convergent on the same two
review blockers.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/mcp/vice/anno-types.ts` | 12-member vocabulary, split layouts, validators, confinement, error family | ⚠️ HOLLOW (confinement) | 979 lines (min 320). All declared exports present; `DATA_TYPES`/`SPLIT_DATA_TYPES`/`COMMENT_TYPES`/`LABEL_KINDS`/`XREF_ACCESS_KINDS` frozen and probed. `storePathWithinWorkspace` is wired and called by `openStore`, but does not confine against symlinks — the one `provides` clause that does not hold. |
| `src/mcp/vice/anno-index.ts` | Pure narrowest-wins paint index, rebuilt never maintained | ✓ VERIFIED | 150 lines (min 70). `resolveAt` bound-checks the address with `AnnoAddressError`. No module-level mutable state (asserted structurally in its own test). |
| `src/mcp/vice/anno-store.ts` | The ONE `node:sqlite` module: DDL, corrupt-file refusal, revision CAS, `vacuum into` snapshot, split-and-preserve, revert, bounded ring | ⚠️ HOLLOW (revert path) | 1290 lines (min 510). Every declared export present. DDL, CAS, split-and-preserve, corrupt refusals and the single-commit site all verified. The snapshot ring's *accounting* does not survive a revert (gap 1) and the prune ordering contradicts its own stated guarantee (gap 2). |
| `src/mcp/vice/anno-seam.test.ts` | STORE-07 structural assertion, four planted access routes, comment-only negative control, `files[]` non-vacuity | ✓ VERIFIED | 399 lines (min 130). 16 tests pass. Both the shipped-set and test-tree scans pair `deepEqual` with a `length` assertion, and the test-tree scan pins `scanned.length > 50` and `includes("anno-store.test.ts")` before asserting — genuinely non-vacuous. |
| `src/mcp/vice/anno-store.test.ts` | Round-trips by value, idempotency, corrupt refusals, snapshot bound, cross-process CAS | ✓ VERIFIED | 1280 lines (min 300). 36 tests pass. Cross-process CAS uses a real second OS process. |
| `src/mcp/vice/anno-types.test.ts` | The irreversible decision frozen; split-orientation control with collapse planting | ✓ VERIFIED | 549 lines (min 220). 15 tests pass. |
| `src/mcp/vice/anno-index.test.ts` | Exhaustive 65,536-address cross-validation, four pins, non-degeneracy, module purity | ✓ VERIFIED | 530 lines (min 170). 13 tests pass. |
| `src/mcp/vice/anno-overlap.test.ts` | Five overlap cases, case 3 load-bearing, both plantings observed, adjacency non-merge, no-splitter structural | ✓ VERIFIED | 588 lines (min 240). 14 tests pass. |
| `src/mcp/vice/anno-durability.test.ts` | ONE combined mutate-SIGKILL-reopen-readback-revert test with its planted counterpart | ✓ VERIFIED | 372 lines (min 150). 4 tests pass. Planted red re-observed by this verifier on the real path. |
| `src/mcp/vice/anno-durability-mutator.mjs` | Test-only child process, three modes, self-SIGKILL | ✓ VERIFIED | 136 lines (min 90). Absent from `files[]` (confirmed) and does not match the `*.test.*` glob — pinned by its own test at `:348`. |
| `src/mcp/vice/block-class.ts` | The ONE store-vocabulary boundary, both vocabularies, transitional arm named | ✓ VERIFIED | 183 lines (min 60). Zero imports. |
| `src/mcp/vice/block-class.test.ts` | Spot checks plus derived total cross-check with non-vacuity | ✓ VERIFIED | Derived cross-check at `:130` over `DATA_TYPES`. |
| `src/mcp/vice/r2000-coverage.test.ts` | Label-kind agreement, derived literal cross-check, widened derived spellings union | ✓ VERIFIED | Derived union at `:679`. No coverage fixture changed. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `anno-store.ts` | `node:sqlite` | The only static import in the shipped set | ✓ WIRED | Confirmed independently against `package.json` `files[]`; all other tree hits are comments in unshipped test files. |
| `anno-store.ts` | `anno-types.ts` | Frozen vocabulary + every validator before any SQL | ✓ WIRED | `assertDataType`/`assertRangeShape`/`assertLegalLabel` etc. all called ahead of the write; probed by observing refusals with zero rows written. |
| `anno-store.ts` | `anno-index.ts` | `buildPaintIndex` over `listRanges`, rebuilt every call | ✓ WIRED | `paintIndexOf:838` holds nothing between calls. |
| `anno-types.ts` | `vice.ts` | `ViceError` base for the whole error family | ✓ WIRED | Every store refusal I triggered was an `Anno*Error`. Two exceptions escape the family — see WR-04 and CR-01. |
| `anno-types.ts` | `disasm-opcodes.ts` | `OPCODES` → derived mnemonic denylist | ✓ WIRED | 76 derived entries; size pinned against a count computed from `OPCODES`. |
| `anno-store.ts` | `r2000-confidence.ts` | `CONFIDENCE_GRADES` → the contradiction rule | ✓ WIRED | `CODE_GRADE_BRACKETS`/`DATA_GRADE_BRACKETS` filtered from the five-grade vocabulary by token suffix, never restated. |
| `anno-durability.test.ts` | `anno-durability-mutator.mjs` | `execFileSync`, spawned never imported | ✓ WIRED | Real child process, self-SIGKILL, status 137 tolerated. |
| `anno-store.ts` | `hostpath.ts` | MUST NOT exist | ✓ CORRECTLY ABSENT | Only a comment mentions it; `hostpath-consumers.test.ts` green. |
| `package.json` `files[]` | `anno-store.ts` | Non-vacuity of the single-seam assertion | ✓ WIRED | Present, so the assertion is not vacuous. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `anno-store.ts` | `listRanges` rows | `select … from anno_range order by id` | Yes — probed, real rows with real ids | ✓ FLOWING |
| `anno-store.ts` | `contradictedComments` | `collectContradictedComments` query inside the write transaction | Yes — probed, one real entry with grade and `contradictedBy` | ✓ FLOWING |
| `anno-store.ts` | `oldestRetainedRevision` | `select min(revision) from anno_snapshot` | Yes, but the value can name a revision with no file behind it | ⚠️ STATIC-EQUIVALENT (gap 1) |
| `anno-index.ts` | `PaintIndex` | `Int32Array` painted from `listRanges` output | Yes — 65,536 entries, cross-validated | ✓ FLOWING |
| `block-class.ts` | `BlockClass` | The block listing's own `type` field | Yes — probed over both vocabularies | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase test files pass | `node --test anno-{store,types,index,overlap,seam,durability}.test.ts` | 36+15+13+14+16+4 = 98 tests, 0 fail | ✓ PASS |
| Criterion 4's planted red, on the REAL path | replace `commitTransaction`'s `db.exec("commit")` with a no-op, run the combined test | `not ok 1 - STORE-04, one combined test…` — then restored, `git diff` clean, 4/4 green | ✓ PASS |
| 12-member split orientation observable | probe `resolveSplitTargets` over identical bytes | lo_hi vs hi_lo target sets differ; `_address` produces xrefs, `_word` does not | ✓ PASS |
| Corrupt-store refusals | probe 5 corruption modes through `openStore` | 5/5 `AnnoStoreCorruptError`; tail-byte flip opens (the stated residual) | ✓ PASS |
| Cross-process CAS refusal | probe stale `baseRevision` | `AnnoStoreStaleRevisionError`, other row intact, refused row absent | ✓ PASS |
| Label rules | probe 5 illegal label writes | 5/5 `AnnoLabelError`, nothing sanitised | ✓ PASS |
| Split-and-preserve case 3 | probe fully-contained retype | 3 rows, 256→256 bytes | ✓ PASS |
| CR-01 reproduction | 40 writes → `revertTo(8)` → follow reported floor | floor reported 0; raw non-`ViceError` `ENOENT` | ✗ FAIL (gap 1) |
| CR-02 reproduction | loser re-vacuums a winner's snapshot path → `revertTo(1)` | `revertTo(1) gave revision 2 with 2 row(s)` | ✗ FAIL (see below) |
| CR-03 reproduction | symlinked subdir inside workspace | store file created outside workspace root | ✗ FAIL (gap 3) |
| Typecheck | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Package manifests | `node scripts/check-npm-packages.mjs` | `OK`, 80 + 34 files | ✓ PASS |
| Related guards | `node --test docs-linerefs.test.ts hostpath-consumers.test.ts` | 14 tests, 0 fail | ✓ PASS |
| Plan 28-03 tests | `node --test block-class.test.ts r2000-coverage.test.ts` | 131 tests, 0 fail | ✓ PASS |
| Disposition guard (pre-this-file) | `node --test docs-review-disposition.test.ts` | RED, listing 17 `28-REVIEW.md` ids | ✗ FAIL (closed by this file) |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| n/a | — | This phase declares no `scripts/*/tests/probe-*.sh`; its probe obligations are the `STORE-0N probe:` clauses inside the plan truths, verified above through the test files and my own probes | ✓ N/A |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| STORE-01 | 28-01, 28-03, 28-04 | Labels, comments, per-range typing over the full 12-member vocabulary, scopes, project enums | ✓ SATISFIED | Truths 1, 10, 11. All five annotation kinds round-trip; the twelve members are frozen and probed. |
| STORE-02 | 28-01, 28-05 | Ranges stored as ranges, **never merged on adjacency**, no splitter introduced | ✓ SATISFIED | Truth 2. Proven behaviourally (adjacent rows stay two, verified by my own probe) and structurally (no `coalesc`/`merg`/`splitter` identifier in `codeOnly(anno-store.ts)`, with non-vacuity pinned). WR-08's "merge" framing refuted below. |
| STORE-03 | 28-01, 28-02, 28-05 | Narrowest-wins exact at all 65,536 addresses, cross-validated, tie-break/ends/partial-overwrite pinned | ✓ SATISFIED | Truths 2, 3. Real exhaustive loop with an asserted comparison count and an independent oracle. |
| STORE-04 | 28-01, 28-06 | Survives restart, edit revertible, **one** combined planted-violation test, removing the commit observed red | ⚠️ PARTIAL | Truth 4 VERIFIED — I observed the red myself. But truths 7 and 8 FAILED: the ring's accounting does not survive a revert, and the prune ordering contradicts its own guarantee. The requirement's literal contract is met; its revert path has two reproduced defects. |
| STORE-05 | 28-01, 28-04, 28-06 | Schema version + reserved uninterpreted `bank` from the first write; xref access kinds; stale-base write refused | ✓ SATISFIED | Truth 5. `bank` verified never branched on anywhere. `anno_scope`/`anno_enum` carry no `bank` column — a **documented deliberate narrowing** ("a scope is a lexical region, not a memory view"; an enum is not address-bound), consistent with 28-01's own truth wording, which names exactly the four address-bearing tables. Accepted as designed. |
| STORE-07 | 28-01 | `node:sqlite` reached through exactly one seam module | ✓ SATISFIED | Truth 5. Verified independently against `files[]`, not just via the test. |
| STORE-06 | — | Cross-references and search answerable | n/a — NOT ORPHANED | `REQUIREMENTS.md:227` maps it to **Phase 29**, and `REQUIREMENTS.md:250` states so explicitly. Correctly absent from every Phase 28 plan. |

No orphaned requirements. All six declared IDs are accounted for and all six are
marked `Complete` in `REQUIREMENTS.md`'s traceability table — **`STORE-04`'s
`Complete` mark is the one I would question**, given truths 7 and 8.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | `TBD` / `FIXME` / `XXX` | none | Zero debt markers across all 13 phase files. |
| — | — | `TODO` / `HACK` / `PLACEHOLDER` / "not yet implemented" | none | Zero. |
| `anno-store.ts` | 445-457 | Doc comment asserts the opposite of what the loop does | 🛑 Blocker | Gap 2. A future reader hardening this path will trust the comment. |
| `anno-store.ts` | 314-326 | `new DatabaseSync` and the whole fresh-store DDL block sit outside every `try` | ⚠️ Warning | WR-04. Raw `Error` escapes the `ViceError` family; connection leaks on the fresh path. |
| `anno-store.ts` | 335-341 | Unconditional `catch` → `AnnoStoreCorruptError` | ⚠️ Warning | WR-03. A lock timeout would read as "your annotations are gone". |
| `anno-types.ts` | 758 | `LEGAL_IDENTIFIER_RE` with no length bound | ⚠️ Warning | WR-07. `MAX_COMMENT_BYTES` exists for exactly this reason; three neighbouring fields lack it. |

## Review Finding Assessment (all 18 ids)

Reproduced or refuted in my own process where possible, not inherited.

### Blockers — all three reproduced

**CR-01 — VERIFIED REAL, blocks a must-have (gap 1).** Reproduced exactly as
reported: 40 writes, `revertTo(8)`, `oldestRetainedRevision` → `0`, following that
floor → `Error: ENOENT … copyfile r0.db`, `is ViceError-family? false`. Root cause
confirmed: the `vacuum into` image is the whole database including `anno_snapshot`,
so restoring it reinstates pointer rows for revisions whose files are gone. The
compounding factor is WR-02 — the handle was already closed when the `ENOENT`
threw. Falsifies 28-06 truths 7 and 8, and degrades 28-06 prohibition 3.

**CR-02 — VERIFIED REAL, blocks the goal's "revertible" clause.** Reproduced
verbatim, including the reviewer's own output line: `revertTo(1) gave revision 2
with 2 row(s) -- expected revision 1 with 1 row`. The `rmSync` + `vacuum into` at
`:498-499` run before `begin immediate`, so a stale-revision loser replaces a
winner's committed snapshot bytes; the loser's write is then correctly refused,
leaving a pointer row that describes the wrong revision and a `revertTo` that
silently succeeds with the wrong state. **Weighed against STORE-05 as instructed:
STORE-05 is NOT falsified** — I verified the stale write is refused and the other
process's row survives intact. The damage is entirely to the snapshot file, i.e.
to STORE-04's revert claim under concurrency. Silent wrong-answer severity; the
`vacuum into` is a full database copy, so the window scales with store size rather
than being a microsecond race.

**CR-03 — VERIFIED REAL, blocks a must-have (gap 3).** Reproduced: symlink escape
succeeded and created the store file outside the workspace root, while the `..`
control correctly refused. **Weighed against STORE-01 as instructed: STORE-01's
requirement text does not mention confinement, and no ROADMAP success criterion
does either** — so this falsifies 28-01's *artifact* `provides` clause and
`anno-store.ts`'s own trap 7, not a roadmap criterion. It nonetheless guards a
path the module's own header premise says arrives unvalidated from the transport,
which is why I am carrying it as a gap rather than a warning.

### Warnings

**WR-01 — VERIFIED REAL, blocks a must-have (gap 2).** Confirmed by reading
`pruneSnapshots`: `rmSync(row.path)` then `delete from anno_snapshot`. The doc
comment's conclusion ("this one cannot [produce the bad state]") is inverted with
respect to its own correctly-stated premise. Same forbidden state CR-01 reaches by
another route. One-line fix; the reasoning around it is already correct.

**WR-02 — VERIFIED REAL, contributes to gap 1.** Observed as a side effect of my
CR-01 probe: the `ENOENT` surfaced with the connection already closed, leaving no
handle to diagnose with. `closeStore` precedes all filesystem work in `revertTo`.

**WR-03 — VERIFIED REAL (by inspection), out of scope for this phase's truths.**
The `catch` at `:335` is unconditional and its message asserts corruption. A
`SELECT` on a WAL database does not normally block on a write lock, so
reachability is narrower than the finding implies — but the failure mode it
describes ("your annotations are gone" for a transient lock) is exactly the
confusion 28-06 prohibition 1 exists to prevent. Should be fixed; does not
falsify a truth.

**WR-04 — VERIFIED REAL, out of scope for this phase's truths.** Reproduced both
halves: a directory-as-path and a missing-parent path both throw a bare `Error`
with `ViceError-family? false`. The fresh-store DDL block is likewise outside any
`try`, so a failure there leaks the connection. Same family-escape class as
CR-01's `ENOENT`.

**WR-05 — VERIFIED REAL, but NARROWER than reported.** My first probe with plain
decimal keys `{"0":…,"1":…}` showed both orderings accepted with `changed:false` —
because JavaScript's own integer-index property ordering canonicalises them, which
the finding does not account for. Re-probed with `$`-prefixed keys (one of the four
accepted forms): `{"$01","$00"}` after `{"$00","$01"}` → `AnnoLabelError: project
enum "mode" already exists with different contents`. So the finding holds for the
`$`/`0x`/`%`/`0b` key forms and is masked for decimal. Real, contradicts
`createProjectEnum`'s own doc comment, out of scope for this phase's truths.

**WR-06 — VERIFIED REAL, out of scope.** Probed: `baseRevision` of `"1"`, `1.5`
and `null` all produce `AnnoStoreStaleRevisionError` against a store at revision 3.
Mitigating: the outcome is a **refusal**, so it fails safe — no write lands. It is
a diagnosability defect (a caller told "stale" when the real answer is "that is not
a revision number"), not a data-loss one.

**WR-07 — VERIFIED REAL, out of scope.** Confirmed: `MAX_COMMENT_BYTES = 4096`
exists; `LEGAL_IDENTIFIER_RE` has no length cap and neither does `assertEnumName`.
The finding's "same argument applies verbatim" reasoning is sound.

**WR-08 — PARTLY REFUTED, partly verified real. Its `STORE-02` framing is wrong.**
I reproduced both row sets exactly as printed. My assessment differs on what they
mean:

- *The "merge" is not a merge on adjacency.* Retyping `$0400-$05FF` to `byte` over
  two wholly-contained rows is the caller **explicitly requesting** that range;
  split-and-preserve correctly finds no head and no tail to preserve and emits one
  row for exactly what was asked. STORE-02 forbids the store **spontaneously**
  coalescing adjacent rows, and it does not: my pure-adjacency probe (`$0400-$04FF`
  then `$0500-$05FF`, no union retype) left two rows with ids 1 and 2. The
  `end_inclusive >= ? and start <= ?` overlap query provably cannot select a
  strictly-adjacent row. **So this is not a requirement-level contradiction, and
  criterion 2 stands.**
- *The fragmentation IS a real defect, on a different requirement.* A same-type
  subrange retype produced `[[2,1000,107f,code],[3,1080,10ff,code]]` with
  `changed:true` — three id churns and a row split for a semantic no-op, while
  `AnnoWriteResult`'s doc comment says `changed` "is the ONLY signal that
  distinguishes a no-op from a real edit". That is a genuine contract violation.
- The reviewer's core process point is correct either way: **neither behaviour is
  pinned by any test**, so both can flip silently. Worth fixing; not a blocker.

**WR-09 — ACCEPTED AS REAL, low priority.** `JSON.parse(row.variants)` is
unguarded. Reachable only via a hand-edited or foreign store — and such a store is
already refused at `openStore` unless the tampering preserved `anno_meta` and
`integrity_check`, which is a narrow window. Same error-family-escape class as
WR-04.

**WR-10 — VERIFIED REAL as a fact, ACCEPTED AS DESIGNED for this phase.**
Confirmed: `applyWriteWithoutCommit` is exported and `anno-store.ts` is in
`files[]`. The seam test does pin that no shipped module *names* it
(`anno-seam.test.ts:296`), which bounds the in-tree risk; the package-boundary risk
the finding names is real but is API hygiene, not a phase-28 truth. The
"identical code path" property the durability proof needs is genuinely load-bearing
and any fix must preserve it — the finding's suggested opt-in token does.

**WR-11 — VERIFIED REAL, narrow.** Confirmed by reading `:506-508`: the
CAS-failure refusal passes only `{ baseRevision: rev }`, so `currentRevision` is
`undefined` on exactly the path where a concurrent writer moved the revision. The
*pre-transaction* refusal — the one the cross-process test exercises and the one I
probed — does carry both numbers, which is why truth 5 still verifies. Fix is
three lines and must read the value before the rollback.

### Info

**IN-01 — ACCEPTED AS REAL, minor.** `null`/`true`/`{}` reach `assertRangeShape`
and are reported as range-shape rather than address errors. The documented
responsibility split is deliberate and stated; the finding is right that it makes
the two error classes indistinguishable for non-string non-number input.

**IN-02 — REFUTED as a defect on this platform.** `fsyncPath` opens with `"r"`;
on Linux `fsync(2)` on an `O_RDONLY` descriptor is permitted, and `O_RDONLY` is the
standard idiom for the directory fsync this function also performs. No observable
problem here; portability-only.

**IN-03 — ACCEPTED AS REAL, minor.** `resolveAt` bound-checks the *address*
(verified: `AnnoAddressError` outside `0..0xFFFF`) but not `index.length`, so a
hand-built short index would return `undefined` rather than `NO_ROW`.
`buildPaintIndex` is the only producer and always allocates `PAINT_INDEX_SIZE`, so
nothing is reachable today.

**IN-04 — ACCEPTED AS REAL, test-fixture only.** A fixture census note; does not
affect the exhaustive cross-validation's non-vacuity, which is separately asserted
on both axes and which I verified.

## Prohibition Assessment

All nine phase prohibitions are `verification: judgment` with
`status: unverified`. Per the autonomous-mode contract these receive
**NON-AUTHORITATIVE LLM-judge verdicts** and are flagged
`unverified-prohibition — human review recommended`. None is silently passed.

| # | Plan | Prohibition (abridged) | Non-authoritative verdict | Evidence |
|---|------|------------------------|---------------------------|----------|
| P1 | 28-03 | MUST NOT let a measured census number silently go to zero; any vocabulary change needs a derived TOTAL cross-check | HELD | `block-class.test.ts:130` iterates `DATA_TYPES` with a 12-member non-vacuity pin; `r2000-coverage.test.ts:679` derives the spellings union; the label-kind literal cross-check reads through `codeOnly(src, true)`. 131 tests pass. |
| P2 | 28-03 | MUST NOT repair the boundary by lowering a floor or deleting a rationale that became false | HELD | The false header premise was rewritten honestly, the transitional arm named with its removal condition (`CUT-01`), and the reversal recorded rather than the old rationale deleted. No floor lowered. |
| P3 | 28-04 | MUST NOT collapse two labels by sanitising a name | HELD | Probed 5 refusals; `listLabels` still held exactly the one original row afterwards. No normalisation/substitution/quoting step exists on the write path. |
| P4 | 28-04 | MUST NOT store anything derivable from program bytes in the xref table | HELD | Probed: `anno_xref` held 0 rows after typing a `lo_hi_address` split table whose targets are fully derivable. |
| P5 | 28-05 | MUST NOT silently un-document a previously annotated region | HELD | Probed case 3: 256 bytes preserved across 3 rows; the contradicted comment reported back as data. |
| P6 | 28-05 | MUST NOT report a contradicted comment as a failure | HELD | Probed: the retype SUCCEEDED with `changed:true` and returned the comment as data. |
| P7 | 28-06 | MUST NOT present a corrupt/foreign/zero-length store as a pristine empty store; state residuals | HELD | Probed 5 refusals. The tail-truncation residual is stated **without** an assertion, which is the honest form the prohibition asks for. |
| P8 | 28-06 | MUST NOT silently discard another process's committed annotations | HELD | Probed cross-process CAS: refused by name with both revisions, other process's row intact, refused row absent. |
| P9 | 28-06 | MUST NOT let revert history grow without bound; a named constant with a **refusal** past it, never a silent best-effort | **PARTIALLY HELD — FLAGGED** | `MAX_SNAPSHOT_REVISIONS = 32` is a named constant imported not copied, and the forward-path refusal is named and informative. Post-revert the refusal degrades into an unhandled `ENOENT` that also closes the handle — not a silent best-effort, but worse. Overlaps gap 1. |

## Gaps Summary

The phase delivered its five ROADMAP success criteria, and delivered them with
unusually strong evidence: a genuinely exhaustive 65,536-address cross-validation
with its comparison count asserted first, two real planted-violation controls in
the overlap path, a real second OS process for both the SIGKILL durability proof
and the CAS proof, and a structural single-seam assertion whose non-vacuity is
itself pinned. I re-observed criterion 4's planted red on the shipped code path
rather than taking the SUMMARY's word for it, and it reddened. Typecheck, package
manifests, and the phase's own 98 tests are clean, with zero debt markers.

What is missing is concentrated in one area: **the snapshot ring's accounting after
a revert, and the ordering around the prune.** Three reproduced defects converge
there.

1. The snapshot image contains the pointer table, so the first `revertTo` reinstates
   pointer rows for files the prune deleted. The reported floor becomes a lie, and
   following it crashes out of the `ViceError` family with the caller's handle
   already closed (CR-01 + WR-02).
2. The prune loop deletes the file before its pointer row — the exact inverse of
   what its own doc comment argues for — so a kill mid-loop produces the same
   pointer-row-without-file state by a second route (WR-01).
3. A stale-revision loser can replace a winner's committed snapshot bytes, because
   the `rm` and `vacuum into` happen outside any lock. The loser's *write* is
   correctly refused — STORE-05 holds — but `revertTo` then silently returns the
   wrong revision (CR-02).

Read together these are one concern, not three: **the snapshot ring has no
ownership or reconciliation discipline between its files and its pointer rows.**
Every one of them is invisible to the current suite because no test performs a
second revert, a mid-prune interruption, or a concurrent snapshot write. That is
the shape of gap this phase's own methodology is otherwise excellent at catching,
which makes its absence here worth naming rather than smoothing over.

Separately, the workspace confinement control is half-built: the `..` case is
pinned and works, the symlink case is neither pinned nor handled, and the store
file lands outside the workspace root (CR-03). Small fix, small test, real
exposure given the module's own stated premise that the path arrives unvalidated.

None of the three gaps is addressed by any later milestone phase — Phase 29 is the
MCP surface (`STORE-06`), Phase 30 is ACME reassembly — so none is deferrable.

I would also flag `REQUIREMENTS.md`'s `STORE-04 | Phase 28 | Complete` row for
reconsideration: the requirement's literal contract is met, but two of the plan's
own stated truths about its revert path are not.

---

_Verified: 2026-08-27T19:32:49Z_
_Verifier: Claude (gsd-verifier)_
