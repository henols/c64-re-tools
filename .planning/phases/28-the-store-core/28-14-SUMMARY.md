---
phase: 28-the-store-core
plan: 14
subsystem: database
tags: [sqlite, node-sqlite, transactions, error-family, cross-process, lock-contention, gap-closure]

requires:
  - phase: 28-13
    provides: "a `reconcileSnapshotRing` that no longer throws on any reachable input — which is exactly why this plan's `revertTo` step-6 handler is defence-in-depth with a declared structural backstop rather than a behaviourally reachable arm"
  - phase: 28-11
    provides: "the two existing `runWriteSequence` handlers (pre-lock staging, WR-01 main window) whose shape the new commit handler matches, and step 9's WR-02 swallow, which this plan leaves byte-identical"
  - phase: 28-08
    provides: "the `AnnoStoreError` / `ViceError` family and its `code`/`data` option fields, which the new refusal uses without adding a class or a field"
provides:
  - "an accepted-path write whose COMMIT cannot escape the ViceError family, cannot leave the store's write lock held, and cannot leave `currentRevision()` reporting a write that never landed — proven with a genuinely separate OS process rather than a simulated lock (CR-06)"
  - "a `revertTo` that always hands back a usable handle for a revert that already succeeded on disk, even if its step-6 housekeeping sweep throws (CR-07's third property)"
  - "a fourth `anno-durability-mutator.mjs` mode that holds a real SQLite SHARED lock in another OS process, signalled by a marker file — the construction any future contention test needs"
affects: [28-15, 29, anno-store, write-path, revert-path]

actuals:
  tokens: 27500
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A control's REACH is declared in its own header: the composite control says in as many words that it passes with and without the edit, and names the backstop that actually discriminates. Round 3 found three live blockers under green controls whose reach was never declared."
    - "A structural backstop states WHY its arm is unreachable, not merely that it is structural — and is proved discriminating by removing the handler and watching it, and only it, go red."
    - "Cross-process contention is constructed, never simulated: a second handle in the same process shares nothing that would make SQLite's lock manager behave as it does between two OS processes."
    - "A readiness handshake between parent and spawned child is a MARKER FILE plus a hard-capped synchronous spin that `assert.fail`s by name — a spin with no cap hangs the suite, and a fall-through would measure an uncontended write and pass for the wrong reason."

key-files:
  created: []
  modified:
    - "src/mcp/vice/anno-store.ts"
    - "src/mcp/vice/anno-store.test.ts"
    - "src/mcp/vice/anno-durability.test.ts"
    - "src/mcp/vice/anno-durability-mutator.mjs"

key-decisions:
  - "The commit handler ROLLS BACK rather than merely wrapping: the rollback is what releases the store's write lock and undoes the CAS, the mutation and the pointer-row insert together. Wrapping alone would have closed the family-escape half of CR-06 and left both the leaked lock and the phantom revision."
  - "The `data.step` value is spelled `committing the write transaction`, not `commit`: `anno-seam.test.ts`'s single-commit-site control counts `/\\bcommit\\b/i` over the stripped source WITH STRING LITERALS KEPT, so the bare token in a `step` string would have been counted as a second commit statement. The reason is recorded inline at the site so a future 'tidy-up' cannot silently redden that control."
  - "`revertTo`'s step-6 handler CLOSES `restored` and REOPENS rather than returning the same handle: if the sweep threw, that connection's transaction state is unknown, and handing back a connection that may hold the write lock is the defect being closed, not a repair of it."
  - "IN-05 is taken in its cheap half ONLY — `code` is propagated on this one wrap. `cause` is not added: that needs a new field on `ViceErrorOptions` in `vice.ts`, a shared module outside this phase's scope."

patterns-established:
  - "A refusal message carries BOTH numbers of the conflict it reports: the revision the write would have become, and the revision the store is still at."
  - "Every new comment states the limit of what its code provides — the no-op-ness of `discardSnapshot` at the commit site, the deliberate orphan FILE it leaves, and the unreachability of the step-6 arm — rather than asserting a guarantee the code does not have."

requirements-completed: [STORE-04, STORE-05, STORE-07]

coverage:
  - id: D1
    description: "With a genuinely separate OS process holding a READ transaction, an accepted-path write REFUSES inside the ViceError family naming the store path and the revision, `currentRevision()` is unchanged, and `handle.db.exec(\"begin immediate\")` succeeds afterwards"
    requirement: "STORE-05"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-durability.test.ts#CR-06: with a separate OS process holding a READ transaction, the commit REFUSES inside the ViceError family, the revision is unchanged, and the write lock is released"
        status: pass
      - kind: integration
        ref: "negative control: the same test against 8743bcf's anno-store.ts fails with 'expected AnnoStoreError, got Error: database is locked: database is locked' (4 pass / 1 fail)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The store is usable again after a contention refusal: once the reading process exits, the same handle performs an accepted `setDataType` that advances the revision by exactly one"
    requirement: "STORE-04"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-durability.test.ts#CR-06 (closing assertions: accepted.revision === revisionBefore + 1, the accepted row present, the refused row absent)"
        status: pass
    human_judgment: false
  - id: D3
    description: "`revertTo` returns a usable handle at the reverted revision when its step-6 sweep cannot read the ring — the end-to-end COMPOSITE property of 28-13's non-throwing sweep plus this plan's handler"
    requirement: "STORE-07"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-store.test.ts#revertTo returns a usable handle even when its step-6 sweep cannot read the ring (composite: 28-13's non-throwing sweep plus this handler)"
        status: pass
      - kind: other
        ref: "DECLARED NON-DISCRIMINATING for this plan's handler — measured: it passes identically with the handler removed (64 pass / 1 fail, and the one fail is the structural backstop, not this control)"
        status: pass
    human_judgment: false
  - id: D4
    description: "`revertTo`'s step-6 sweep call sits inside a still-open handler that closes the suspect connection and reopens — the SOURCE-STRUCTURAL backstop, and the only control in the tree that discriminates this edit"
    requirement: "STORE-07"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#revertTo step 6, STRUCTURAL BACKSTOP: the sweep call sits inside a handler, so a future edit that reintroduces a throw cannot cost the caller a handle"
        status: pass
      - kind: unit
        ref: "negative control: with the handler removed from anno-store.ts, this test and only this test fails (64 pass / 1 fail)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Step 8's `commitTransaction(handle.db)` call sits inside a still-open `try` whose `catch` contains a `rollback` — the source assertion the plan asks be recorded rather than shipped as a permanent control"
    requirement: "STORE-04"
    verification:
      - kind: other
        ref: "one-off run of the WR-02 instrument over the stripped source: PASS body=4036 call=3110 try=3098 catch=3144 rollbackInCatch=true"
        status: pass
      - kind: unit
        ref: "cd src/mcp/vice && grep -c 'db.exec(\"commit\")' anno-store.ts  →  1; anno-seam.test.ts green"
        status: pass
    human_judgment: false
  - id: D6
    description: "The new mutator mode obeys every clause of the TEST-ONLY header: absent from package.json files[], never imported by a production module, filename outside the *.test.* glob"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-durability.test.ts#the mutator is test-only: absent from package.json files[], and its filename does not match the *.test.* glob the runner collects"
        status: pass
      - kind: unit
        ref: "node -e \"const p=require('./src/mcp/vice/package.json'); if (p.files.includes('anno-durability-mutator.mjs')) { process.exit(1) }\"  →  exit 0"
        status: pass
    human_judgment: false

duration: 14 min
completed: 2026-08-28
status: complete
---

# Phase 28 Plan 14: The Commit Statement Comes Inside the Family Summary

**`runWriteSequence`'s step-8 commit and `revertTo`'s step-6 sweep are each brought inside a handler, so an ordinary READER in another OS process can no longer make an accepted write escape the `ViceError` family, leave the store's write lock held and leave `currentRevision()` reporting a write that never landed (CR-06) — and a housekeeping failure after a revert that already succeeded on disk can no longer cost the caller a handle (CR-07's third property).**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-28T11:29:30Z
- **Completed:** 2026-08-28T11:43:30Z
- **Tasks:** 3 of 3
- **Files modified:** 4

## Accomplishments

- **CR-06 closed, and proved cross-process.** Step 8's `commitTransaction(handle.db)` — the one statement in the sequence whose failure leaves the transaction OPEN with everything applied — now sits inside a handler that rolls back (releasing the write lock and undoing the CAS, the caller's mutation and the pointer-row insert together), discards the staging name, rethrows a `ViceError` unchanged, and otherwise refuses by name stating that nothing was written and the store is still at revision N. The regression test drives a genuinely separate OS process holding a READ transaction and spends ~5.2 s doing it — the writer's own `busy_timeout` elapsing, which is what makes the contention real.
- **CR-07's third property closed.** `revertTo` step 6's sweep is wrapped; on a throw the handler closes `restored` (whose transaction state would be unknown) inside its own swallowing `try` and returns a freshly opened handle through `openStore`, which is already inside the family. Round 3 observed this exact line throw a bare `Error: EACCES` AFTER a successful `rev 4 -> rev 2`, returning no handle at all.
- **Every control's reach is DECLARED, and the declarations were measured, not asserted.** The unreadable-ring `revertTo` control is labelled COMPOSITE and non-discriminating in its own header — and that label was verified by removing the handler and watching it stay green. The structural backstop is labelled as the control that bites — and that was verified by the same run, in which it and only it went red.
- **IN-05's cheap half folded in on this wrap only.** The new refusal carries `code` from the underlying error, so a caller can ask whether the failure was lock contention without substring-matching the message. `vice.ts` and `ViceErrorOptions` are untouched.
- **All anno tests green:** `node --test anno-*.test.ts` → **141 pass / 0 fail / 0 skipped**, exit 0 (was 138 before this plan: +2 from task 2, +1 from task 3). `npx tsc --noEmit` clean. `grep -c 'db.exec("commit")'` still returns `1`.

## Task Commits

1. **Task 1: CR-06 — the commit comes inside the family, rolling back so the write lock is released** — `03a1855` (fix)
2. **Task 2: `revertTo` step 6 — a housekeeping failure never costs the caller a handle** — `777d900` (fix)
3. **Task 3: the cross-process proof, via a fourth mutator mode** — `328cf62` (test)

## Files Created/Modified

- `src/mcp/vice/anno-store.ts` — two hunks only, at `runWriteSequence`'s `doCommit` branch and `revertTo`'s step 6. `git diff -U0 8743bcf HEAD` reports exactly `@@ -1265 +1265,61 @@ function runWriteSequence` and `@@ -1666,0 +1727,29 @@ / @@ -1668 +1757,10 @@ export function revertTo`. `reconcileSnapshotRing`, `pruneSnapshots`, `openStore`, the DDL, the confinement predicate and `revertTo` steps 1–5 are byte-identical to their post-28-13 state.
- `src/mcp/vice/anno-store.test.ts` — two new controls appended (composite + structural backstop), nothing else touched.
- `src/mcp/vice/anno-durability-mutator.mjs` — a fourth mode `hold-read`, its `HOLD_READ_MS` bound, and a header section recording the mode and the three decisions behind it.
- `src/mcp/vice/anno-durability.test.ts` — the `MODE_HOLD_READ` token, the `waitForMarker` bounded spin, and the CR-06 cross-process test.

## Which Controls Are Behavioural and Which Are Source-Structural

The plan's `<output>` asks this be recorded explicitly, and for each backstop the reason its arm is unreachable. Round 3 found three live blockers sitting under green structural controls, and an unlabelled structural control is how that happens.

| Control | Kind | Discriminates this plan's edit? | Evidence / reason |
|---|---|---|---|
| `anno-durability.test.ts#CR-06: with a separate OS process holding a READ transaction…` | **BEHAVIOURAL**, cross-process | **YES** — the one genuinely discriminating control this plan adds | Against `8743bcf`'s `anno-store.ts` it fails with `expected AnnoStoreError, got Error: database is locked: database is locked`. That is the review's §CR-06 reproduction verbatim. Runs in 5242 ms, i.e. the 5000 ms `busy_timeout` genuinely elapsed. |
| `anno-store.test.ts#revertTo returns a usable handle even when its step-6 sweep cannot read the ring (composite…)` | **BEHAVIOURAL**, but **COMPOSITE and NON-DISCRIMINATING for this plan** | **NO**, and its own header says so | After 28-13, `reconcileSnapshotRing` catches every reachable throw and returns `deferred: true` without rethrowing, so no test input reaches this plan's step-6 `catch`. **Measured**: with the handler removed the run is 64 pass / 1 fail and this control is among the 64. It pins the END-TO-END property (28-13's non-throwing sweep + this handler); it is not evidence for the handler. It carries its own non-vacuity check — all three ring files survive, proving the sweep genuinely could not read the directory — and a root-skip guard. |
| `anno-store.test.ts#revertTo step 6, STRUCTURAL BACKSTOP…` | **SOURCE-STRUCTURAL backstop** | **YES** — the only control in the tree that does | **Reason the arm is unreachable:** plan 28-13 bracketed `reconcileSnapshotRing`'s whole body in a handler that rolls back and returns `{ droppedFiles: [], deferred: true }` without rethrowing, so no reachable input makes the sweep throw. The handler is therefore defence in depth against a future edit that reintroduces a throw — precisely the edit rounds 1, 2 and 3 each made in this file. **Measured**: with the handler removed this test, and only this test, fails. |
| Step 8's commit-inside-a-handler check | **SOURCE ASSERTION, one-off, recorded here rather than shipped** | n/a | The plan asks for it as a recorded assertion, not a permanent control, "because the behaviour itself is proven cross-process by task 3 rather than by this structural check" — and task 1's `<files>` is `anno-store.ts` alone. Run with the WR-02 control's own instrument (`codeOnly(src, true)`, extract `function runWriteSequence`'s body, locate the call, require the nearest preceding `try {` to be still open and a `} catch` to follow): **PASS, body=4036 chars, call at 3110, open try at 3098, catch at 3144, `rollback` present inside the catch.** Non-vacuity: body length bound met, call found. |

## Prohibition Dispositions

All five prohibitions carried `status: unverified` in the plan. Each is disposed here against what was actually changed.

| # | Prohibition (carried forward) | Disposition | Evidence |
|---|---|---|---|
| P1 | MUST NOT convert a committed write into a caller-visible failure (28-11 P5 — HELD in round 3; the new commit handler runs BEFORE the commit returns and must not weaken it) | **HELD** | The new handler wraps `commitTransaction` and nothing else, so its `catch` runs only when the commit itself threw — i.e. before the commit ever returned, on a write that did NOT happen. Step 9's WR-02 swallow is **byte-identical**: `git diff 8743bcf HEAD -- anno-store.ts \| grep -E '^[-+].*pruneSnapshots'` is empty. The WR-02 structural control (which asserts the prune call sits inside a still-open `try` whose catch does not rethrow) is green, and 28-13's unreadable-ring test — which asserts `result.revision === revisionBefore + 1` for a committed write whose HOUSEKEEPING failed — is still green in the 141-test run. |
| P2 | MUST NOT report a conflict without both of the numbers that conflicted (28-08 P2 — HELD in round 3; the new refusal must name the revision the store is still at) | **HELD** | The refusal names both: `the write for revision ${rev + 1} could not be committed … so the store is still at revision ${rev}` (`anno-store.ts:1312-1313`). Asserted BEHAVIOURALLY, not by grep: the CR-06 test matches `new RegExp("still at revision " + revisionBefore)` against the thrown message, alongside the store-path check. |
| P3 | MUST NOT let a writer that is about to be refused mutate anything a committed writer owns (28-08 P1 — PARTIALLY HELD in round 3; the commit-failure path must roll the CAS back) | **HELD** | The rollback undoes the CAS, the caller's mutation and the pointer-row insert together; the cross-process test asserts `currentRevision(store) === revisionBefore` after the refusal, and that `begin immediate` then succeeds. **The one thing deliberately left behind is the PUBLISHED snapshot file**, and it is not something a committed writer owns: pointer rows only ever name revisions strictly BELOW the revision the store is at (argued at `publishSnapshot`'s doc comment and asserted there), and the published path is the CURRENT revision's — so no surviving row can claim it. With the pointer row rolled back it is an orphan FILE, the harmless direction, which the next accepted write's sweep reclaims. Stated in the code comment rather than left as an inference. |
| P4 | MUST NOT leave in place, or introduce, a comment that asserts a guarantee the code does not provide (28-07 P3 — VIOLATED in round 3) | **HELD for every site this plan owns; NOT closed phase-wide** | Every new comment states its own limit: the commit-site comment says `discardSnapshot` is a **no-op** by the time control reaches it and that the published file is **deliberately** left behind; the step-6 comment says in as many words that after 28-13 the `catch` is **not reachable from any input** and is defence in depth, and the plan's `<action>` explicitly forbade writing a comment claiming the arm is reachable. 28-13 task 3's two corrections survive untouched — `grep -n "Both halves are resolved here" anno-store.ts` returns nothing and neither correction was paraphrased back. **Still open elsewhere:** `anno-types.ts`'s falsified `realpathOfNearestExisting` claim (that every `realpathSync`/`lstatSync`/`readlinkSync` failure is rethrown as `AnnoStorePathError`) is untouched on purpose — it is 28-15's, where its code is fixed. |
| P5 | MUST NOT destroy the only remaining route back to a state the store still advertises as reachable (28-07 P1 — VIOLATED in round 3; must not be re-opened while editing the same function) | **HELD** | This plan introduces **no deletion of any kind**. `revertTo` steps 1–5, its refusal message, the staged-copy ordering and the `closeStore`-before-rename are byte-identical; `reconcileSnapshotRing` and `pruneSnapshots` are untouched (the whole `anno-store.ts` diff is two hunks, one inside `runWriteSequence`'s `doCommit` branch and one inside `revertTo`'s step 6). The only filesystem removal in the new code is `discardSnapshot(staging)` on a per-attempt staging name that no pointer row can name and that the reconciliation sweep is deliberately anchored not to match — and at that point it is a no-op. |

**Not re-disposed, and deliberately so:** 28-13 recorded prohibition **28-07 P2** (the floor/retained claim) as **VIOLATED in the UNDER-CLAIM direction, by design, and explicitly NOT closed**. This plan touched neither `retainedRevisions`, `oldestRetainedRevision` nor `snapshotDirFor`, so that disposition stands exactly as 28-13 left it. It is not in this plan's prohibition list and is **not** claimed closed here.

## Deviations from Plan

### 1. [Rule 3 — Blocking issue] The `data.step` value had to avoid the bare token `commit`

- **Found during:** Task 1.
- **Issue:** The plan asks for `data: { path, revision, step }` "with a `step` value that distinguishes this arm from the two existing ones". The natural spelling — `"commit the write transaction"` — reddened `anno-seam.test.ts`'s single-commit-site control: it counts `/\bcommit\b/i` over the module's stripped source **with string literals KEPT** (the commit statement itself is a string literal), so the bare token inside a `step` string is counted as a second commit statement. Measured: 83 pass / 1 fail, `found 2 -- a second one splits the durability proof's planted violation across two sites`.
- **Fix:** the step reads `"committing the write transaction"`. The gerund has no word boundary after `commit`, exactly as `commitTransaction` and `doCommit` do not — and it still distinguishes this arm from `"stage the pre-mutation snapshot"` and `"publish the snapshot and insert its pointer row"`. The reason is recorded **inline at the site** so a future tidy-up back to the shorter noun cannot silently redden that control.
- **Files modified:** `src/mcp/vice/anno-store.ts`.
- **Verification:** `node --test anno-store.test.ts anno-seam.test.ts anno-durability.test.ts` → 84 pass / 0 fail; `grep -c 'db.exec("commit")'` → 1.
- **Committed in:** `03a1855`.

### 2. [Rule 2 — a control with no non-vacuity check proves nothing] The composite control gained a ring-contents measurement

- **Found during:** Task 2.
- **Issue:** The plan's shape for the composite control ends at "`begin immediate` succeeds followed by a rollback". As written, "`revertTo` returned a handle" would be **equally true of a run in which the `chmod` did nothing** — as root, or on a filesystem ignoring the mode bits — so the control would pass without its own precondition ever existing. The root-skip guard covers the root case; nothing covered the rest.
- **Fix:** after the mode is restored, the control asserts the ring still holds `["r0.db", "r1.db", "r2.db"]` — every snapshot file a completed sweep would have reclaimed. That is the measurement that the sweep genuinely could not read the directory.
- **Files modified:** `src/mcp/vice/anno-store.test.ts`.
- **Verification:** green with the assertion (65 pass / 0 fail on `anno-store.test.ts`); the assertion is placed after the mode-restoring `finally` because the reader itself needs the directory readable.
- **Committed in:** `777d900`.

### 3. [Rule 1 — the plan's own criterion needed an interpretation, recorded rather than silently chosen] Task 1's structural check was run as a one-off, not shipped as a test

- **Found during:** Task 1.
- **Issue:** Task 1's acceptance criterion says "Assert it the way the WR-02 control already does … **and record it in the SUMMARY as a source assertion**, because the behaviour itself is proven cross-process by task 3 rather than by this structural check", while task 1's `<files>` names `src/mcp/vice/anno-store.ts` **only**. Adding a permanent test would have breached the task's declared file scope in a plan whose whole objective section is about scope discipline.
- **Fix:** the WR-02 instrument was reproduced verbatim as a one-off script over the shipped module and its result recorded above under "Which Controls Are Behavioural…". No test file was touched by task 1.
- **Files modified:** none (a scratchpad script, not committed).
- **Verification:** `PASS body=4036 call=3110 try=3098 catch=3144 rollbackInCatch=true`, exit 0.
- **Committed in:** n/a — recorded here, which is what the criterion asks for.

---

**Total deviations:** 3 auto-fixed (1 × Rule 3 blocking control conflict, 1 × Rule 2 missing non-vacuity, 1 × Rule 1 criterion interpretation).
**Impact on plan:** none on scope. Every change stayed inside the four files `files_modified` names, and `anno-store.ts`'s diff is the two statement ranges the plan authorised and no others.

## Issues Encountered

- **Task 1's acceptance criterion cites "the existing 135-test surface"** for `anno-store.test.ts` + `anno-seam.test.ts` + `anno-durability.test.ts`. The measured surface for those three files is **83** before this plan and **84** after task 1 (the 138 figure in 28-13's SUMMARY is the full seven-file `anno-*.test.ts` set). Noted so the next round does not read the mismatch as a missing test; `# fail 0` was the criterion actually enforced.
- **`28-13-SUMMARY.md` carries two stray XML-ish tokens** (`</content>` and `</invoke>`) in its "Prohibition Dispositions" region, left by the previous executor's write. Not repaired here — it is another plan's artifact and repairing it is outside this plan's `files_modified`. Recorded so it is not mistaken for a template feature.
- **The tracer feedback gate does not apply:** this plan declares no `type="tracer"` task. `workflow.auto_advance` and `workflow._auto_chain_active` are both `false` while `.planning/config.json` sets `mode: yolo` and the plan is `autonomous: true`; every task is `type="auto"` and no checkpoint was reached, so no gate decision had to be taken either way.

## Known Stubs

None. No stub, skipped test or unrun `<verify>` was introduced. The full run reports `# skipped 0` and `# todo 0`; nothing was appended to `.planning/WINDOWS.md`.

## Threat Flags

None. Every file touched is in the plan's `files_modified`; no new network endpoint, auth path, file-access pattern or schema change was introduced. The plan's threat register is discharged as planned: **T-28-06** (DoS at step 8's commit) mitigated by task 1 and proven cross-process by task 3; **T-28-07** (tampering — the CAS surviving a failed commit) mitigated by task 1's rollback and asserted behaviourally; **T-28-08** (DoS at `revertTo` step 6) mitigated by task 2; **T-28-10** (the mutator shipped to consumers) mitigated — the fourth mode changed none of the three clauses and both mechanical assertions are green. **T-28-09** stays `accept` (the new message interpolates the caller-supplied store path and the underlying SQLite message, exactly as every existing refusal in this module does) and **T-28-SC** stays `accept` (no dependency added, so the package-legitimacy gate has nothing to audit).

## Verification Results

- `cd src/mcp/vice && node --test anno-confinement.test.ts anno-durability.test.ts anno-index.test.ts anno-overlap.test.ts anno-seam.test.ts anno-store.test.ts anno-types.test.ts` → **141 pass / 0 fail / 0 skipped**, **real exit code 0** (captured via a redirect, not through a pipe).
- `cd src/mcp/vice && npx tsc --noEmit -p tsconfig.json` → clean, exit 0.
- `grep -c 'db.exec("commit")' src/mcp/vice/anno-store.ts` → **1**; `anno-seam.test.ts`'s single-commit-site control green.
- `git diff -U0 8743bcf HEAD -- src/mcp/vice/anno-store.ts` → exactly two regions: `function runWriteSequence` (the `doCommit` branch) and `export function revertTo` (step 6).
- `node -e "const p=require('./src/mcp/vice/package.json'); if (p.files.includes('anno-durability-mutator.mjs')) { process.exit(1) }"` → exit 0.
- Negative controls, each run by swapping an earlier `anno-store.ts` in and restoring it:
  - CR-06 test against `8743bcf` (pre-plan) → `not ok 5 … expected AnnoStoreError, got Error: database is locked: database is locked` (4 pass / 1 fail) — the review's reproduction, verbatim;
  - the step-6 structural backstop with the handler removed → `not ok 65` (64 pass / 1 fail), and the composite control stays GREEN in that same run, which is the measurement behind both controls' declared reach.
- No test added by this plan asserts stderr is empty (`git diff 8743bcf HEAD -- src/mcp/vice/*.test.ts | grep -i '^+.*stderr'` → empty).
- `grep -n "load-bearing" src/mcp/vice/anno-store.test.ts` → no line at all, so none inside either new control.

## Next Phase Readiness

- **28-15 is unblocked.** `anno-types.ts` and `anno-confinement.test.ts` were not touched; the falsified `realpathOfNearestExisting` doc claim is still there on purpose, for the plan that fixes its code.
- **CR-06 and CR-07 are both closed.** With 28-13's CR-05 and CR-07 closures, all three of round 3's blockers on `anno-store.ts` are closed behaviourally through production entry points, each with a negative control against the pre-plan code. **WR-12 is 28-15's** and is untouched here.
- **The family-closure property now holds at the commit statement**, which is the one place WR-01's own complaint survived the plan that closed WR-01. Whether it holds everywhere in the module is the next verification's call, not this SUMMARY's — this plan proves it only for step 8 and for `revertTo` step 6.
- **One prohibition is deliberately still violated elsewhere** — 28-07 P2 in the under-claim direction, owned and recorded by 28-13. It is untouched here and must not be read as closed.

## Self-Check: PASSED

- `.planning/phases/28-the-store-core/28-14-SUMMARY.md` — FOUND
- `src/mcp/vice/anno-store.ts` — FOUND
- `src/mcp/vice/anno-store.test.ts` — FOUND
- `src/mcp/vice/anno-durability.test.ts` — FOUND
- `src/mcp/vice/anno-durability-mutator.mjs` — FOUND
- Commit `03a1855` (task 1) — FOUND
- Commit `777d900` (task 2) — FOUND
- Commit `328cf62` (task 3) — FOUND
- Commit `35fb49b` (SUMMARY) — FOUND
- All task `<acceptance_criteria>` re-run and passing; plan `<verification>` re-run (141 pass / 0 fail / 0 skipped with real exit code 0, one commit site, `tsc --noEmit` clean, the `anno-store.ts` diff confined to two statement ranges).
