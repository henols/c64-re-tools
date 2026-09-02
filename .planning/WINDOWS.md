---
schema_version: 1
open_count: 25
waived_count: 14
fixed_count: 9
total_count: 48
last_updated: 2026-09-02T21:30:13.836Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | quick-260823-kf6 | deviation | src/mcp/vice/audit-integrity.test.ts | 262 | Pre-existing failure (T-12-04 hardcoded tech_debt=3 count), predates this task's commit 76f7b15; out of scope, see quick task's deferred-items.md | open |  | 2026-08-23T12:59:39.120Z |  |
| 2 | 18 | deviation | src/mcp/vice/anno-mcp-client.ts |  | npm test (no flags) never exited when the external analyser is installed locally. RESOLVED at phase 18 wave 2's post-merge gate: NOT pre-existing -- plan 18-03's rewire of runAnnoTool() through anno-session.ts's HELD slot left every non-vice-proxy host pinned open by the child's ref'd stdio handles (anno-cli.test.ts:1303 calls runAnnoTool once). Disproven by direct measurement: the same file exits in 2s at the wave-1 tip ebe90f8 and hung at f6a5b03. Fixed by unref'ing the child and its three stdio pipes in openAnnoSession(); plain npm test now exits 0. | fixed | Root-caused and fixed at the wave-2 post-merge gate; the "pre-existing" attribution was inferred from the import chain, never measured against an unmodified checkout. | 2026-08-24T09:42:05.932Z | 2026-08-24T10:06:33.000Z |
| 3 | 19 | deviation | src/mcp/vice |  | Unreproduced single-test flake: the first full npm test after plan 19-01 reported 1 failure (2470 tests); three consecutive re-runs reported 0. The failing subtest name was not captured. Capture it with tee if it recurs. | open |  | 2026-08-24T16:17:20.435Z |  |
| 4 | 19 | unrun-verify | src/skills/c64-program-recon/scripts/packer-finding.test.mjs |  | The oracle-route test for the packer finding SKIPS (visibly) because no external packer identifier is installed, so parseUnp64Stdout()'s accepted marker set is an unmeasured assumption and SURF-03's positive branch has never executed. Re-open trigger: install the identifier, build a genuinely packed fixture, confirm the name and the HIGH confidence. | open |  | 2026-08-24T17:39:41.733Z |  |
| 5 | 19 | deviation | .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-04-PLAN.md |  | Task 1 acceptance criterion invokes 'node src/mcp/vice/anno-cli.ts coverage --nonsense-flag', which cannot exit non-zero: anno-cli.ts has no main guard by design. Satisfied through the real entry point (vice-proxy.ts anno coverage --nonsense-flag, exit 1); recorded so a later re-run of the plan text does not read as a regression. | waived | Provenance record, not a defect: the plan text was measured false and the implementation is correct. Nothing to fix; kept as history. | 2026-08-24T17:39:41.840Z | 2026-08-29T21:14:52.200Z |
| 6 | 19 | deviation | .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-05-PLAN.md |  | Task 3(e) required the pre-existing failure baseline to be measured by stashing or checking out the pre-phase commit. git stash is forbidden in this project, and a checkout would have moved HEAD over committed work, so the baseline was taken in a detached worktree at a352500 with a symlinked node_modules. That run reported 7 failures, ALL of them host-path / build-staging / workspace-translation tests that assert about where the checkout is -- an artefact of the measurement location, not a baseline. Every one passes in the real tree (post-phase run: 0 fail). Recorded so a later reader does not mistake the confounded 7 for inherited failures, and so the next phase needing a baseline picks a method that does not relocate the checkout. | waived | Provenance record, not a defect: the plan text was measured false and the implementation is correct. Nothing to fix; kept as history. | 2026-08-24T18:13:07.770Z | 2026-08-29T21:14:52.456Z |
| 7 | 19 | unmet-truth | .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-REVIEW.md |  | 17 Phase 19 review findings (CR-01, IN-01..IN-04, WR-01..WR-12) undispositioned; 19-06 discharges CR-01 and WR-02, the rest are owned by 19-07/19-08/19-09 and keep docs-review-disposition.test.ts + audit-integrity D-12-02 red until 19-09 lands | fixed |  | 2026-08-24T21:28:33.217Z | 2026-08-29T21:14:21.865Z |
| 8 | 19 | deviation | src/mcp/vice/skill-attribution.test.ts |  | 19-07 deferred WR-11: three suites and five shipped-prose citations hard-code a .planning/phases/19- path that GSD archives at milestone close; 19-07 added no new instance | open |  | 2026-08-24T21:56:23.195Z |  |
| 9 | 19 | deviation | src/mcp/vice/skill-attribution.test.ts |  | 19-07 deferred WR-12: manifestEntryFor() lies to the type system and can throw a TypeError instead of its intended message; not called by 19-07's guard | open |  | 2026-08-24T21:56:23.308Z |  |
| 10 | 19 | deviation | src/mcp/vice/anno-coverage.test.ts |  | trueReturnGuardChains() cut for-header semicolons; fixed in the same commit by tracking parenthesis depth | fixed |  | 2026-08-25T11:57:33.035Z | 2026-08-25T11:58:16.142Z |
| 11 | 19 | deviation | src/mcp/vice/anno-coverage.test.ts |  | PUSH_IDIOM_WINDOW_EDGE declared interior to (zeropage-vector-jumped-through, class-3-pass) rather than OUTSIDE as plan 19-18 specified; the plan's position was factually false | fixed |  | 2026-08-25T13:22:44.057Z | 2026-08-25T13:23:33.194Z |
| 12 | 23 | deviation | .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/tools/verify/task1-verify-as-planned.bash |  | 23-02 task 1 <verify> is unsatisfiable as written: it asserts DXA_TARBALL_SHA256_VERIFIED: pass and a bare-decimal FIXTURE_DATA_RECOVERY_PCT, both of which SCHEMA.md's frozen domains forbid. Evidence follows SCHEMA.md; the check is recorded failing, not repaired. | waived | Provenance record, not a defect: the plan text was measured false and the implementation is correct. Nothing to fix; kept as history. | 2026-08-26T10:58:18.286Z | 2026-08-29T21:14:52.765Z |
| 13 | 23 | deviation | src/mcp/vice/anno-session.test.ts | 615 | Load-flaky: crash-counter assertion fails under full-suite parallelism, green in isolation and on re-run; logged in phase 23 deferred-items, not fixed (evidence convention 9 forbids touching src/) | open |  | 2026-08-26T11:40:12.713Z |  |
| 14 | 23 | unmet-truth | .planning/REQUIREMENTS.md |  | PROOF-01/02/03 not met at the Phase 23 close: criteria never measured (no depacked flat-64K capture, D-03); rows read Pending with the reason | open |  | 2026-08-26T15:56:45.162Z |  |
| 15 | 23 | unrun-verify | .planning/phases/23-the-real-release-gate-go-degrade-no-go/23-11-PLAN.md |  | 23-11 Task 3's automated verify asserts all five PROOF rows read Complete; recorded unsatisfiable because PROOF-01/02/03 were never measured (phase-wide precedent: the evidence is not bent to a plan regex) | open |  | 2026-08-26T15:56:52.138Z |  |
| 16 | 28 | todo | src/mcp/vice/anno-types.ts |  | MAX_SNAPSHOT_REVISIONS = 32 is declared but not enforced: the snapshots/ directory grows unbounded until a later plan of phase 28 adds pruning (T-28-diskgrowth) | fixed |  | 2026-08-27T13:14:52.643Z | 2026-08-27T18:38:04.157Z |
| 17 | 28 | deviation | src/mcp/vice/anno-index.test.ts | 508 | The 'imports nothing but types from anno-types.ts' truth is asserted as exactly one import specifier plus family exclusions, not as import type: anno-index.ts imports two error CLASSES it throws, so a type-only import is unreachable | waived | Provenance record, not a defect: the plan text was measured false and the implementation is correct. Nothing to fix; kept as history. | 2026-08-27T13:34:12.253Z | 2026-08-29T21:14:53.111Z |
| 18 | 28 | deviation | src/mcp/vice/anno-store.ts |  | setDataType's result changed from { revision, changed: number } to AnnoWriteResult { revision, changed: boolean }; runWriteSequence now rolls back on a throwing mutation (both required by plan 28-04's own truths) | waived | Provenance record, not a defect: the plan text was measured false and the implementation is correct. Nothing to fix; kept as history. | 2026-08-27T14:10:41.641Z | 2026-08-29T21:14:53.405Z |
| 19 | 28 | deviation | src/mcp/vice/anno-store.test.ts |  | The plan's premise that the schema_version corrupt fixture needs a test-side node:sqlite import is measured FALSE: AnnoStoreHandle exposes its own db, so no second importer was added; the declared test-tree list in anno-seam.test.ts therefore has one member and it is anno-seam.test.ts itself (its planted route strings are string literals a keepLiteralBodies specifier scan cannot distinguish from route (d)) | waived | Provenance record, not a defect: the plan text was measured false and the implementation is correct. Nothing to fix; kept as history. | 2026-08-27T18:38:16.421Z | 2026-08-29T21:14:53.731Z |
| 20 | 28 | deviation | src/mcp/vice/anno-store.test.ts |  | Plan 28-06 Test 9 as written (revertTo(r) twice leaves the same state) is unsatisfiable: a snapshot of revision r contains pointer rows for 0..r-1 only, so a second revertTo(r) is refused by name. Asserted instead as the idempotency that holds -- the observable store state after one revert and after a refused second revert is identical | waived | Provenance record, not a defect: the plan text was measured false and the implementation is correct. Nothing to fix; kept as history. | 2026-08-27T18:38:16.632Z | 2026-08-29T21:14:53.983Z |
| 21 | 28 | deviation | src/mcp/vice/anno-store.ts |  | Plan 28-06's third planting (make the step-5 CAS unconditional) does NOT redden the cross-process test: that refusal comes from the step-2 base-revision check. The tautological CAS reddens only anno-seam.test.ts's structural CAS assertion; the semantic red was obtained by removing the step-2 check instead. Both results recorded at the test site | waived | Provenance record, not a defect: the plan text was measured false and the implementation is correct. Nothing to fix; kept as history. | 2026-08-27T18:38:16.829Z | 2026-08-29T21:14:54.252Z |
| 22 | 28 | deviation | src/mcp/vice/anno-confinement.test.ts |  | Case 15 cannot assert the plan's expected 40-hop message: the manual bound is structurally unreachable in ancestor position because the kernel's MAXSYMLINKS throws ELOOP at lstat first. Recorded as the finding; the leaf spelling's 40 is asserted beside it. | waived | Provenance record, not a defect: the plan text was measured false and the implementation is correct. Nothing to fix; kept as history. | 2026-08-28T12:05:16.879Z | 2026-08-29T21:14:54.456Z |
| 23 | 28 | deviation | src/mcp/vice/anno-store.ts |  | publishSnapshot's directory fsync is BEST EFFORT (guarded), not unguarded as 28-17 task 1's action text read: a mandatory directory fsync needs the same read bit readdirSync needs, so it refuses every write against a writable-but-unreadable ring and destroys CR-07's precondition. Failure leaves an orphan ROW (bounded, non-destructive). | waived | Provenance record, not a defect: the plan text was measured false and the implementation is correct. Nothing to fix; kept as history. | 2026-08-28T16:57:13.978Z | 2026-08-29T21:14:54.762Z |
| 24 | 28 | unrun-verify | src/mcp/vice/anno-store.ts | 432 | openStore's 'integrity_check could not be run at all' arm has no reachable input without filesystem- or SQLite-level fault injection: presence and wiring verified in source, no test exercises it. Carried forward OPEN by round 4 (28-16..28-18) and claimed closed by nothing; recorded as an explicit row in 28-REVIEW.md's round-4 disposition table. | open |  | 2026-08-28T17:16:13.859Z |  |
| 25 | 28 | deviation | src/mcp/vice/anno-store.ts |  | 28-18's closing gate: deleting step 3b's staged-image validation reddens ONE test (the truncated-image CR-08 test), not the two 28-18 task 3's action text names. The foreign-bytes sibling is absorbed by step 2's snapshotOpenFailure gate one step earlier -- 28-16-SUMMARY.md records the identical re-observation on its own final tree. | waived | Provenance record, not a defect: the plan text was measured false and the implementation is correct. Nothing to fix; kept as history. | 2026-08-28T17:16:14.108Z | 2026-08-29T21:14:55.072Z |
| 26 | 29 | unrun-verify | src/mcp/vice/vice-proxy.test.ts |  | vice-proxy.test.ts is MANUAL_ONLY (needs a live host VICE server) so the anno_* tools/list wire output after the registration substitution was proven structurally, never observed on a live client | open |  | 2026-08-29T14:09:23.640Z |  |
| 27 | 29 | deviation | src/mcp/vice/anno-store.ts |  | Plan 29-03's acceptance criterion 'the store revision is unchanged between two identical applyEnumUsage calls' was NOT implemented: it contradicts AnnoWriteResult's documented invariant that every accepted write advances the revision, and the plan's own instruction to copy putXref verbatim. changed:false carries the idempotency claim instead. | waived | Provenance record, not a defect: the plan text was measured false and the implementation is correct. Nothing to fix; kept as history. | 2026-08-29T15:46:45.831Z | 2026-08-29T21:14:55.313Z |
| 28 | 32 | deviation | scripts/audit-gate.mjs | 1210 | audit-gate.mjs --json ends with process.exit(result.allowed ? 0 : 1), and allowed tracks GATED AUDITS only -- so a structural error (e.g. a DOCS_GUARD_FLOOR breach) is reported inside the JSON payload's structuralErrors array while the process still exits 0. The text-mode branch (:1213-1218) does exit 1 on the same condition. Measured in plan 32-07 when a floor plant came back ZERO-EXIT under --json and red without it. Any caller treating the --json exit status as a structural-health check is reading a signal that cannot go non-zero for a structural error. | open |  | 2026-08-31T18:12:04.785Z |  |
| 29 | 32 | deviation | scripts/check-guard-fates.mjs |  | deriveForwardMap() resolves successors by two mechanisms only -- end-to-end 'git diff -M' and the name-descendant predicate (prefix swap, stem preserved) -- and both miss a rename where the STEM changed and the successor later grew past git's similarity threshold. Measured: 'git show --name-status -M c59fcef' reports R091 src/mcp/vice/anno-derivation.test.ts -> src/mcp/vice/anno-derivation.test.ts, the successor's own header records the rename, and all five predecessor test names survive verbatim; but the file grew 207 -> 478 lines so end-to-end -M does not score it. Consequence: the predecessor lands in forwardGone and the successor is independently derived into set B, so a truthful 'superseded' verdict would collide with the successor's own row on the duplicate-newSubject check. The relationship is NOT EXPRESSIBLE in the registry. Plan 32-08 recorded 'deleted' with the rename disclosed in full on the row and in evidence/32-deferred-fates.md section 5. Recommended fix (a strengthening, not a relaxation): add a third mechanism that inspects each gone member's removing commit for an R entry naming it as source; consequence is SET_B_FLOOR 16 -> 15 and TOTAL_FLOOR 61 -> 60. | open |  | 2026-08-31T18:46:51.480Z |  |
| 30 | 32 | deviation | src/mcp/vice/block-class.ts | 196 | The transitional capitalised block-type arm 'if (block.type === "Undefined") return "undefined";' is ALREADY INERT and its recorded justification does not hold for it. The arms' stated reason for surviving their own removal trigger is that 'every committed coverage fixture is still spelled in that vocabulary'. Structural census of the twelve src/mcp/vice/fixtures/coverage/*/store.json (parsed as JSON, not grepped): 11 blocks across 6 of the 12 directories, spelled Code x 5 and Byte x 6. "Undefined" appears ZERO times. So :195 (Code) is load-bearing -- it rescues 5 blocks that would otherwise fall through to data silently -- while :196 matches nothing. The comment at :180 also overstates the impact: it says deleting the arms reclassifies 'every fixture block' as data, but 6 of the 11 already resolve to data by design, so only 5 would change. Measured by plan 32-08 while resolving research assumption A7. Not acted on: deleting a half-inert arm is a change to a live classifier and ROADMAP.md scopes this phase to recording the fate, not performing the re-point. | open |  | 2026-08-31T18:47:06.035Z |  |
| 31 | 32 | deviation | .planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json |  | The fate registry's verdict vocabulary cannot express 'kept-unchanged but its assertions were later re-aimed' for a NET-NEW (set-B) member without overloading 're-pointed', and cannot express a rename whose successor is itself an independently derived member at all. Both surfaced in plan 32-08. (a) A set-B member did not exist at AUDIT_COMMIT, so 'historicalPath -> newSubject' has no historical side; the two genuinely re-aimed set-B guards (anno-derivation.test.ts, module-classification.test.ts) are recorded 're-pointed' with newSubject === historicalPath, which is the same shape the 18 same-path set-A rows already use, but the token now means two different things. (b) The plan text for task 1 invites an OPTIONAL 'strengthening' observedRed on kept-unchanged rows; the committed guard's predicate REJECTS observedRed on that verdict outright, so following the plan text would have redded the registry. Guard won; recorded here so the next registry consumer does not re-derive the same contradiction. | open |  | 2026-08-31T18:47:19.110Z |  |
| 32 | 32 | unrun-verify | src/mcp/vice/fork-live.test.ts |  | fork-live.test.ts cannot be exercised on this development host and its opt-in run is a guaranteed red: the non-upstream fork (the -mcpserver build) is NOT installed here. Measured in plan 32-09's close-gate run at 0d7d328: /usr/bin/x64sc reports 'x64sc (VICE 3.9)', /usr/local/bin/x64sc reports 'x64sc (VICE 3.10)', and '/usr/local/bin/x64sc -help / grep -ci mcpserver' returns 0 -- so BOTH x64sc binaries on PATH are genuine unpatched stock, and the /usr/local one that shadows stock is a locally-built stock 3.10, not the fork. Running 'VICE_LIVE_FORK_BIN=/usr/local/bin/x64sc node --test fork-live.test.ts' gives 6 tests / 0 pass / 6 fail, every one 'waitForEndpointReady: http://127.0.0.1:PORT/mcp (fork binary /usr/local/bin/x64sc) never answered within 20000ms (last error: TypeError: fetch failed)'. Consequence: fork-live.test.ts's 6 tests reach their default-SKIP branch both locally and on CI and have NO exercise route anywhere, so nothing currently proves them. This also corrects a standing assumption that 'the fork shadows stock on PATH' -- at /usr/local/bin it does not, it is a second stock build. Not fixed: installing the fork is out of phase 32's scope (ROADMAP.md scopes this phase to contain no build work by design). | open |  | 2026-08-31T19:22:26.336Z |  |
| 33 | 32 | unmet-truth | scripts/audit-mutation-harness.mjs | 103 | Restore-on-signal invariant still behaviour-unverified: SIGINT/SIGTERM handlers cannot run mid-plant because main() is wholly synchronous; 10/10 attempts landed in the window and the child still exited 0, not 130 (plan 32-14 Task 3) | fixed | Closes on its STATED content ONLY. That content -- the restore-on-signal invariant is behaviour-unverified because SIGINT/SIGTERM handlers cannot run mid-plant while main() is wholly synchronous -- is discharged: plan 32-19 reached the harness OWN registered handler from an in-process driver and recorded 10/10 attempts at exit 130 with a byte-identical restore. Cited: evidence/32-restore-on-signal.md and the 5/5 green run of src/mcp/vice/audit-harness-restore.test.ts. The entry stated CAUSE is NOT disputed and remains true: main() is still wholly synchronous and a real CLI invocation still cannot dispatch a handler mid-plant. The latch OTHER consequence -- the disarm, which this entry is not about -- is carried forward by entry 40, which was appended BEFORE this closure so no intermediate ledger state showed this entry closed with no successor present. | 2026-08-31T22:34:00.734Z | 2026-09-01T10:58:32.236Z |
| 34 | 32 | deviation | .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-sweep-renamed-rows.md | 3889 | Plan 32-14's one authorised in-place correction was measured to be a NO-OP: the value the fixed harness applies is byte-identical to the committed Plant line, so numstat is 70 additions / 0 deletions, not the 1 deletion the plan's acceptance criterion anticipated | open |  | 2026-08-31T22:34:07.678Z |  |
| 35 | 32 | unmet-truth | src/mcp/vice/hop-chain-comments.test.ts |  | guard-fates row cannot be re-measured by the committed harness: its plant.replace is its own plant.find with a newline prepended, so the introduced occurrence overlaps the pre-existing one and the post-condition refuses it (PLANT REFUSED in the 32-15 --all sweep) | fixed | Closes on the MEASUREMENT that discharges it, not on a description of one. The row now returns OBSERVED RED from the committed instrument in a WHOLE-SET sweep: plan 32-21's `--all` run at 77b7323 printed `OBSERVED RED  src/mcp/vice/hop-chain-comments.test.ts: guard exit status 1 (control exit status 0)` inside `counts: measured=35 skipped=26 total=61`, with ZERO `PLANT REFUSED` and ZERO `UNMEASURABLE`, and the registry write-back REACHED and observed on disk (30 of the 35 recorded-red blocks differing, row count 61 and row order unchanged, no evidence-owing-nothing row touched) before being discarded under D-08 so no dated record was replaced. The CAUSE was removed rather than worked around: the plant post-condition no longer subtracts whole-file totals -- which cannot see a replacement that textually overlaps its own pre-existing occurrence -- but asserts the recorded replacement lands at the unique match position with the exact length delta, which is exact under overlap. Pinned by the standing `overlap-accepted` case in src/mcp/vice/audit-harness-restore.test.ts, watched failing against the restored difference form before it was trusted. Full record: .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap1-overlap-and-writeback.md | 2026-09-01T07:18:08.572Z | 2026-09-01T11:42:54.584Z |
| 36 | 32 | deviation | src/mcp/vice/repo-root.test.ts | 249 | the !supervisorDir.includes('.claude') substring predicate fails unconditionally when the suite runs from a GSD worktree under .claude/worktrees/, so npm run test:automated cannot reach its 0-failure floor from there (measured 2994/2987/1 in plan 32-15) | open |  | 2026-09-01T07:18:16.264Z |  |
| 37 | 32 | deviation | scripts/lib/audit-root.mjs | 13 | Stale line citation: cites audit-gate.mjs:1147-1151 as the WR-03 try/catch; plan 32-16's 40-line header block moved it to ~1191. Not fixed here because plan 32-17 owns this file in the same wave. | open |  | 2026-09-01T07:45:46.016Z |  |
| 38 | 32 | deviation | src/mcp/vice/audit-root-args.test.ts | 428 | Completeness assertion red by design after plan 32-16 migrated audit-gate.mjs to parseRootArg(): audit-gate joins the derived population with no MATRIX row. Plan 32-18 owns the row and its own criteria require this red. Deliberately NOT relaxed. | open |  | 2026-09-01T07:45:46.201Z |  |
| 39 | 32 | deviation | .planning/phases/32-the-deletion-and-the-grep-gate/32-18-PLAN.md |  | Plan 32-18 cites audit-gate.mjs:90 for the fs import surface; plan 32-16's header block moved that import to :130. The names bound are unchanged. | open |  | 2026-09-01T07:45:46.468Z |  |
| 40 | 32 | unmet-truth | scripts/audit-mutation-harness.mjs |  | Restore machinery was DISARMABLE on the exported path: restoreAll() was guarded by a module-level boolean latch set on the first call and never reset, so once plan 32-19 exported plant()/restoreAll() any in-process consumer that completed one restore cycle permanently no-opped the exit, SIGINT, SIGTERM and uncaughtException handlers for the rest of the process. Round-3 verifier reproduced it against a scratch root (plant -> restoreAll -> plant -> SIGINT): EXIT=130, pendingRestoreCount() = 1, FINAL ON DISK: PLANTED_TWO (CR-10, gap 2). The SHIPPED CLI PATH WAS NEVER AFFECTED -- main() reverts per row from inside the row loop, which deletes from the captured-originals map without touching any latch, and calls restoreAll() exactly once in the finally after that loop, so the latch could never be set while a plant was on disk; the verifier 61-row --all sweep finished tree: restored byte-identical to the baseline. FIXED by plan 32-20: the latch is deleted with nothing replacing it, relying on the originals.clear() the same function already ends with, and pinned by the two second-window cases in src/mcp/vice/audit-harness-restore.test.ts, which were watched failing against a deliberately re-introduced latch (5 pass / 2 fail) and green once it was removed (7 pass / 0 fail). Successor to entry 33, appended before that entry closed. Evidence: .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-restore-disarm.md | fixed | Fixed by plan 32-20 in the same round it was recorded. The module-level latch is deleted from scripts/audit-mutation-harness.mjs with nothing replacing it, relying on the originals.clear() the same function already ends with, and the two second-window cases in src/mcp/vice/audit-harness-restore.test.ts were watched FAILING against a deliberately re-introduced latch (5 pass / 2 fail) before they were trusted, then green once it was removed (7 pass / 0 fail). recorded_at and resolved_at are seconds apart because the defect was found and fixed in the same round -- that is a record of that arc, not a backdated close. Bite proof in full: evidence/32-restore-disarm.md. | 2026-09-01T10:58:05.666Z | 2026-09-01T10:58:25.297Z |
| 41 | 33 | deviation | .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/33-02-PLAN.md |  | 33-02 Task 2's first automated verify greps the WHOLE of STATE.md for the two phase-32-review todo stems, but both stems legitimately appear in the historical '### Acknowledged at the v0.7.0 close' table (lines ~1474-1475) and its prose (~1488-1489); the command is unsatisfiable without deleting milestone-close history. Ran the section-and-table-cell-scoped equivalent instead, mirroring docs-deferred-ledger.test.ts's own stemHasOwnTableCell semantics. | open |  | 2026-09-02T17:56:38.934Z |  |
| 42 | 33 | deviation | .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-wallclock-control.md |  | WARP_BRACKET_CONTROL: red was reached by region overshoot, not by the spurious timeout ROADMAP success criterion 5 names; the timeout form was not observed (ACCEPTED LIMIT 1) | open |  | 2026-09-02T19:03:23.913Z |  |
| 43 | 33 | deviation | .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-autostart-sequencing.md |  | AUTOSTART_FRAME_EXACT: not-achieved — a frame-anchored post-load stop on danish.d64 reaches 66 differing addresses at jitter 4000, OVER D-22's committed cap of 64; 33-10 must record its jitters and must not retry until the allow-list fits | open |  | 2026-09-02T19:03:33.398Z |  |
| 44 | 33 | deviation | .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-04-slicer-substrate.md |  | SLICER: gate input not emitted by 33-04 -- SCHEMA.md 2.4 requires capture-predicate.test.ts and capture-seam.test.ts transcripts too, and neither file exists yet; 33-07 owns 33-slicer-validation.md and must emit the line | open |  | 2026-09-02T19:32:03.207Z |  |
| 45 | 33 | deviation | .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/33-06-PLAN.md |  | 33-06 Task 1's own <verify> demands broker-control.test.ts report fail 0, while Task 1's action text widens attemptAcquire()'s signature -- which two PRE-EXISTING structural tests pin as a literal string. Honouring the plan's Task-1/Task-2 split literally would have committed a knowingly-red suite. The two pinned signatures were updated inside Task 1's commit, and the boundary-refusal/eligibility cases the plan assigns to Task 2 landed there too (same file, same commit). Task 2 delivered its full remaining scope. Same shape as 33-05's own deviation 1. Recorded so a later re-run of the plan text does not read the placement as a regression. | waived | Provenance record, not a defect: the plan's own Task-1 <verify> gate and its Task-1/Task-2 split are mutually unsatisfiable for broker-control.test.ts, and the implementation is correct. Every acceptance criterion of both tasks is met; nothing to fix, kept as history. | 2026-09-02T20:35:13.880Z | 2026-09-02T20:35:29.422Z |
| 46 | 33 | deviation | src/mcp/vice/broker-launch.mts |  | The launch profile was not carried forward across crash-respawn or recycle (handleExit -> launchSupervised builds a brand new InstanceRecord). A recycled or crash-respawned {warp:true} instance would have come back UNWARPED with a record that no longer matched what the caller asked for -- reintroducing D-16/T-33-24's undetectable mismatch one respawn later, the same defect class CR-01 already caused once in this function. Fixed inside 33-06 Task 1's commit 11f897d via an optional seventh launchSupervised() parameter, mirroring CR-02's remoteMonitorPort carry-forward at both handleExit call sites. | fixed |  | 2026-09-02T20:35:14.413Z | 2026-09-02T20:35:28.860Z |
| 47 | 33 | unmet-truth | src/mcp/vice/stop-oracle.ts |  | CAP-03's structural bar is not total: the bidirectional import census and the image-buffer signature census cannot see a caller that reads the capture itself and passes a DERIVED SCALAR (a digest, a differing-address count, an equivalence verdict) into compareStopIdentity() -- no signature check can distinguish that number from a legitimately-read register value. Forbidden in stop-oracle.ts's WHAT NOT TO DO in prose only. Recorded as an ACCEPTED LIMIT in evidence/33-slicer-validation.md and carried from 33-07-PLAN.md's own flagged_assumptions, where the deterministic edge probe classified CAP-03's single edge unclassified. | waived | Knowingly-accepted design limit, not a defect: the two structural assertions are the strongest instruments available for a NEGATIVE STRUCTURAL requirement, and the derived-scalar route is unreachable by any signature or import census by construction. Recorded as an ACCEPTED LIMIT in evidence/33-slicer-validation.md, which 33-12's findings document collects verbatim, so the limit travels with the verdict rather than sitting as an open defect. Falsifiable by exactly one thing: such a call site appearing. | 2026-09-02T21:04:22.740Z | 2026-09-02T21:05:21.142Z |
| 48 | 33 | deviation | src/mcp/vice/package.json |  | check-npm-packages.mjs is RED from plan 33-06: broker-launch.mts is type-imported by the published vice-broker-client.ts but is not in files[]. No runtime impact (import type is erased) but the packaging gate is red for the rest of the phase. See phase 33 deferred-items.md D1. | open |  | 2026-09-02T21:30:13.836Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "quick-260823-kf6",
    "file": "src/mcp/vice/audit-integrity.test.ts",
    "line": 262,
    "description": "Pre-existing failure (T-12-04 hardcoded tech_debt=3 count), predates this task's commit 76f7b15; out of scope, see quick task's deferred-items.md",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-23T12:59:39.120Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "deviation",
    "phase": "18",
    "file": "src/mcp/vice/anno-mcp-client.ts",
    "line": null,
    "description": "npm test (no flags) never exited when the external analyser is installed locally. RESOLVED at phase 18 wave 2's post-merge gate: NOT pre-existing -- plan 18-03's rewire of runAnnoTool() through anno-session.ts's HELD slot left every non-vice-proxy host pinned open by the child's ref'd stdio handles (anno-cli.test.ts:1303 calls runAnnoTool once). Disproven by direct measurement: the same file exits in 2s at the wave-1 tip ebe90f8 and hung at f6a5b03. Fixed by unref'ing the child and its three stdio pipes in openAnnoSession(); plain npm test now exits 0.",
    "status": "fixed",
    "reason": "Root-caused and fixed at the wave-2 post-merge gate; the \"pre-existing\" attribution was inferred from the import chain, never measured against an unmodified checkout.",
    "recorded_at": "2026-08-24T09:42:05.932Z",
    "resolved_at": "2026-08-24T10:06:33.000Z"
  },
  {
    "id": 3,
    "kind": "deviation",
    "phase": "19",
    "file": "src/mcp/vice",
    "line": null,
    "description": "Unreproduced single-test flake: the first full npm test after plan 19-01 reported 1 failure (2470 tests); three consecutive re-runs reported 0. The failing subtest name was not captured. Capture it with tee if it recurs.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-24T16:17:20.435Z",
    "resolved_at": null
  },
  {
    "id": 4,
    "kind": "unrun-verify",
    "phase": "19",
    "file": "src/skills/c64-program-recon/scripts/packer-finding.test.mjs",
    "line": null,
    "description": "The oracle-route test for the packer finding SKIPS (visibly) because no external packer identifier is installed, so parseUnp64Stdout()'s accepted marker set is an unmeasured assumption and SURF-03's positive branch has never executed. Re-open trigger: install the identifier, build a genuinely packed fixture, confirm the name and the HIGH confidence.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-24T17:39:41.733Z",
    "resolved_at": null
  },
  {
    "id": 5,
    "kind": "deviation",
    "phase": "19",
    "file": ".planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-04-PLAN.md",
    "line": null,
    "description": "Task 1 acceptance criterion invokes 'node src/mcp/vice/anno-cli.ts coverage --nonsense-flag', which cannot exit non-zero: anno-cli.ts has no main guard by design. Satisfied through the real entry point (vice-proxy.ts anno coverage --nonsense-flag, exit 1); recorded so a later re-run of the plan text does not read as a regression.",
    "status": "waived",
    "reason": "Provenance record, not a defect: the plan text was measured false and the implementation is correct. Nothing to fix; kept as history.",
    "recorded_at": "2026-08-24T17:39:41.840Z",
    "resolved_at": "2026-08-29T21:14:52.200Z"
  },
  {
    "id": 6,
    "kind": "deviation",
    "phase": "19",
    "file": ".planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-05-PLAN.md",
    "line": null,
    "description": "Task 3(e) required the pre-existing failure baseline to be measured by stashing or checking out the pre-phase commit. git stash is forbidden in this project, and a checkout would have moved HEAD over committed work, so the baseline was taken in a detached worktree at a352500 with a symlinked node_modules. That run reported 7 failures, ALL of them host-path / build-staging / workspace-translation tests that assert about where the checkout is -- an artefact of the measurement location, not a baseline. Every one passes in the real tree (post-phase run: 0 fail). Recorded so a later reader does not mistake the confounded 7 for inherited failures, and so the next phase needing a baseline picks a method that does not relocate the checkout.",
    "status": "waived",
    "reason": "Provenance record, not a defect: the plan text was measured false and the implementation is correct. Nothing to fix; kept as history.",
    "recorded_at": "2026-08-24T18:13:07.770Z",
    "resolved_at": "2026-08-29T21:14:52.456Z"
  },
  {
    "id": 7,
    "kind": "unmet-truth",
    "phase": "19",
    "file": ".planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-REVIEW.md",
    "line": null,
    "description": "17 Phase 19 review findings (CR-01, IN-01..IN-04, WR-01..WR-12) undispositioned; 19-06 discharges CR-01 and WR-02, the rest are owned by 19-07/19-08/19-09 and keep docs-review-disposition.test.ts + audit-integrity D-12-02 red until 19-09 lands",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-24T21:28:33.217Z",
    "resolved_at": "2026-08-29T21:14:21.865Z"
  },
  {
    "id": 8,
    "kind": "deviation",
    "phase": "19",
    "file": "src/mcp/vice/skill-attribution.test.ts",
    "line": null,
    "description": "19-07 deferred WR-11: three suites and five shipped-prose citations hard-code a .planning/phases/19- path that GSD archives at milestone close; 19-07 added no new instance",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-24T21:56:23.195Z",
    "resolved_at": null
  },
  {
    "id": 9,
    "kind": "deviation",
    "phase": "19",
    "file": "src/mcp/vice/skill-attribution.test.ts",
    "line": null,
    "description": "19-07 deferred WR-12: manifestEntryFor() lies to the type system and can throw a TypeError instead of its intended message; not called by 19-07's guard",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-24T21:56:23.308Z",
    "resolved_at": null
  },
  {
    "id": 10,
    "kind": "deviation",
    "phase": "19",
    "file": "src/mcp/vice/anno-coverage.test.ts",
    "line": null,
    "description": "trueReturnGuardChains() cut for-header semicolons; fixed in the same commit by tracking parenthesis depth",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-25T11:57:33.035Z",
    "resolved_at": "2026-08-25T11:58:16.142Z"
  },
  {
    "id": 11,
    "kind": "deviation",
    "phase": "19",
    "file": "src/mcp/vice/anno-coverage.test.ts",
    "line": null,
    "description": "PUSH_IDIOM_WINDOW_EDGE declared interior to (zeropage-vector-jumped-through, class-3-pass) rather than OUTSIDE as plan 19-18 specified; the plan's position was factually false",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-25T13:22:44.057Z",
    "resolved_at": "2026-08-25T13:23:33.194Z"
  },
  {
    "id": 12,
    "kind": "deviation",
    "phase": "23",
    "file": ".planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/tools/verify/task1-verify-as-planned.bash",
    "line": null,
    "description": "23-02 task 1 <verify> is unsatisfiable as written: it asserts DXA_TARBALL_SHA256_VERIFIED: pass and a bare-decimal FIXTURE_DATA_RECOVERY_PCT, both of which SCHEMA.md's frozen domains forbid. Evidence follows SCHEMA.md; the check is recorded failing, not repaired.",
    "status": "waived",
    "reason": "Provenance record, not a defect: the plan text was measured false and the implementation is correct. Nothing to fix; kept as history.",
    "recorded_at": "2026-08-26T10:58:18.286Z",
    "resolved_at": "2026-08-29T21:14:52.765Z"
  },
  {
    "id": 13,
    "kind": "deviation",
    "phase": "23",
    "file": "src/mcp/vice/anno-session.test.ts",
    "line": 615,
    "description": "Load-flaky: crash-counter assertion fails under full-suite parallelism, green in isolation and on re-run; logged in phase 23 deferred-items, not fixed (evidence convention 9 forbids touching src/)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-26T11:40:12.713Z",
    "resolved_at": null
  },
  {
    "id": 14,
    "kind": "unmet-truth",
    "phase": "23",
    "file": ".planning/REQUIREMENTS.md",
    "line": null,
    "description": "PROOF-01/02/03 not met at the Phase 23 close: criteria never measured (no depacked flat-64K capture, D-03); rows read Pending with the reason",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-26T15:56:45.162Z",
    "resolved_at": null
  },
  {
    "id": 15,
    "kind": "unrun-verify",
    "phase": "23",
    "file": ".planning/phases/23-the-real-release-gate-go-degrade-no-go/23-11-PLAN.md",
    "line": null,
    "description": "23-11 Task 3's automated verify asserts all five PROOF rows read Complete; recorded unsatisfiable because PROOF-01/02/03 were never measured (phase-wide precedent: the evidence is not bent to a plan regex)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-26T15:56:52.138Z",
    "resolved_at": null
  },
  {
    "id": 16,
    "kind": "todo",
    "phase": "28",
    "file": "src/mcp/vice/anno-types.ts",
    "line": null,
    "description": "MAX_SNAPSHOT_REVISIONS = 32 is declared but not enforced: the snapshots/ directory grows unbounded until a later plan of phase 28 adds pruning (T-28-diskgrowth)",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-27T13:14:52.643Z",
    "resolved_at": "2026-08-27T18:38:04.157Z"
  },
  {
    "id": 17,
    "kind": "deviation",
    "phase": "28",
    "file": "src/mcp/vice/anno-index.test.ts",
    "line": 508,
    "description": "The 'imports nothing but types from anno-types.ts' truth is asserted as exactly one import specifier plus family exclusions, not as import type: anno-index.ts imports two error CLASSES it throws, so a type-only import is unreachable",
    "status": "waived",
    "reason": "Provenance record, not a defect: the plan text was measured false and the implementation is correct. Nothing to fix; kept as history.",
    "recorded_at": "2026-08-27T13:34:12.253Z",
    "resolved_at": "2026-08-29T21:14:53.111Z"
  },
  {
    "id": 18,
    "kind": "deviation",
    "phase": "28",
    "file": "src/mcp/vice/anno-store.ts",
    "line": null,
    "description": "setDataType's result changed from { revision, changed: number } to AnnoWriteResult { revision, changed: boolean }; runWriteSequence now rolls back on a throwing mutation (both required by plan 28-04's own truths)",
    "status": "waived",
    "reason": "Provenance record, not a defect: the plan text was measured false and the implementation is correct. Nothing to fix; kept as history.",
    "recorded_at": "2026-08-27T14:10:41.641Z",
    "resolved_at": "2026-08-29T21:14:53.405Z"
  },
  {
    "id": 19,
    "kind": "deviation",
    "phase": "28",
    "file": "src/mcp/vice/anno-store.test.ts",
    "line": null,
    "description": "The plan's premise that the schema_version corrupt fixture needs a test-side node:sqlite import is measured FALSE: AnnoStoreHandle exposes its own db, so no second importer was added; the declared test-tree list in anno-seam.test.ts therefore has one member and it is anno-seam.test.ts itself (its planted route strings are string literals a keepLiteralBodies specifier scan cannot distinguish from route (d))",
    "status": "waived",
    "reason": "Provenance record, not a defect: the plan text was measured false and the implementation is correct. Nothing to fix; kept as history.",
    "recorded_at": "2026-08-27T18:38:16.421Z",
    "resolved_at": "2026-08-29T21:14:53.731Z"
  },
  {
    "id": 20,
    "kind": "deviation",
    "phase": "28",
    "file": "src/mcp/vice/anno-store.test.ts",
    "line": null,
    "description": "Plan 28-06 Test 9 as written (revertTo(r) twice leaves the same state) is unsatisfiable: a snapshot of revision r contains pointer rows for 0..r-1 only, so a second revertTo(r) is refused by name. Asserted instead as the idempotency that holds -- the observable store state after one revert and after a refused second revert is identical",
    "status": "waived",
    "reason": "Provenance record, not a defect: the plan text was measured false and the implementation is correct. Nothing to fix; kept as history.",
    "recorded_at": "2026-08-27T18:38:16.632Z",
    "resolved_at": "2026-08-29T21:14:53.983Z"
  },
  {
    "id": 21,
    "kind": "deviation",
    "phase": "28",
    "file": "src/mcp/vice/anno-store.ts",
    "line": null,
    "description": "Plan 28-06's third planting (make the step-5 CAS unconditional) does NOT redden the cross-process test: that refusal comes from the step-2 base-revision check. The tautological CAS reddens only anno-seam.test.ts's structural CAS assertion; the semantic red was obtained by removing the step-2 check instead. Both results recorded at the test site",
    "status": "waived",
    "reason": "Provenance record, not a defect: the plan text was measured false and the implementation is correct. Nothing to fix; kept as history.",
    "recorded_at": "2026-08-27T18:38:16.829Z",
    "resolved_at": "2026-08-29T21:14:54.252Z"
  },
  {
    "id": 22,
    "kind": "deviation",
    "phase": "28",
    "file": "src/mcp/vice/anno-confinement.test.ts",
    "line": null,
    "description": "Case 15 cannot assert the plan's expected 40-hop message: the manual bound is structurally unreachable in ancestor position because the kernel's MAXSYMLINKS throws ELOOP at lstat first. Recorded as the finding; the leaf spelling's 40 is asserted beside it.",
    "status": "waived",
    "reason": "Provenance record, not a defect: the plan text was measured false and the implementation is correct. Nothing to fix; kept as history.",
    "recorded_at": "2026-08-28T12:05:16.879Z",
    "resolved_at": "2026-08-29T21:14:54.456Z"
  },
  {
    "id": 23,
    "kind": "deviation",
    "phase": "28",
    "file": "src/mcp/vice/anno-store.ts",
    "line": null,
    "description": "publishSnapshot's directory fsync is BEST EFFORT (guarded), not unguarded as 28-17 task 1's action text read: a mandatory directory fsync needs the same read bit readdirSync needs, so it refuses every write against a writable-but-unreadable ring and destroys CR-07's precondition. Failure leaves an orphan ROW (bounded, non-destructive).",
    "status": "waived",
    "reason": "Provenance record, not a defect: the plan text was measured false and the implementation is correct. Nothing to fix; kept as history.",
    "recorded_at": "2026-08-28T16:57:13.978Z",
    "resolved_at": "2026-08-29T21:14:54.762Z"
  },
  {
    "id": 24,
    "kind": "unrun-verify",
    "phase": "28",
    "file": "src/mcp/vice/anno-store.ts",
    "line": 432,
    "description": "openStore's 'integrity_check could not be run at all' arm has no reachable input without filesystem- or SQLite-level fault injection: presence and wiring verified in source, no test exercises it. Carried forward OPEN by round 4 (28-16..28-18) and claimed closed by nothing; recorded as an explicit row in 28-REVIEW.md's round-4 disposition table.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-28T17:16:13.859Z",
    "resolved_at": null
  },
  {
    "id": 25,
    "kind": "deviation",
    "phase": "28",
    "file": "src/mcp/vice/anno-store.ts",
    "line": null,
    "description": "28-18's closing gate: deleting step 3b's staged-image validation reddens ONE test (the truncated-image CR-08 test), not the two 28-18 task 3's action text names. The foreign-bytes sibling is absorbed by step 2's snapshotOpenFailure gate one step earlier -- 28-16-SUMMARY.md records the identical re-observation on its own final tree.",
    "status": "waived",
    "reason": "Provenance record, not a defect: the plan text was measured false and the implementation is correct. Nothing to fix; kept as history.",
    "recorded_at": "2026-08-28T17:16:14.108Z",
    "resolved_at": "2026-08-29T21:14:55.072Z"
  },
  {
    "id": 26,
    "kind": "unrun-verify",
    "phase": "29",
    "file": "src/mcp/vice/vice-proxy.test.ts",
    "line": null,
    "description": "vice-proxy.test.ts is MANUAL_ONLY (needs a live host VICE server) so the anno_* tools/list wire output after the registration substitution was proven structurally, never observed on a live client",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-29T14:09:23.640Z",
    "resolved_at": null
  },
  {
    "id": 27,
    "kind": "deviation",
    "phase": "29",
    "file": "src/mcp/vice/anno-store.ts",
    "line": null,
    "description": "Plan 29-03's acceptance criterion 'the store revision is unchanged between two identical applyEnumUsage calls' was NOT implemented: it contradicts AnnoWriteResult's documented invariant that every accepted write advances the revision, and the plan's own instruction to copy putXref verbatim. changed:false carries the idempotency claim instead.",
    "status": "waived",
    "reason": "Provenance record, not a defect: the plan text was measured false and the implementation is correct. Nothing to fix; kept as history.",
    "recorded_at": "2026-08-29T15:46:45.831Z",
    "resolved_at": "2026-08-29T21:14:55.313Z"
  },
  {
    "id": 28,
    "kind": "deviation",
    "phase": "32",
    "file": "scripts/audit-gate.mjs",
    "line": 1210,
    "description": "audit-gate.mjs --json ends with process.exit(result.allowed ? 0 : 1), and allowed tracks GATED AUDITS only -- so a structural error (e.g. a DOCS_GUARD_FLOOR breach) is reported inside the JSON payload's structuralErrors array while the process still exits 0. The text-mode branch (:1213-1218) does exit 1 on the same condition. Measured in plan 32-07 when a floor plant came back ZERO-EXIT under --json and red without it. Any caller treating the --json exit status as a structural-health check is reading a signal that cannot go non-zero for a structural error.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-31T18:12:04.785Z",
    "resolved_at": null
  },
  {
    "id": 29,
    "kind": "deviation",
    "phase": "32",
    "file": "scripts/check-guard-fates.mjs",
    "line": null,
    "description": "deriveForwardMap() resolves successors by two mechanisms only -- end-to-end 'git diff -M' and the name-descendant predicate (prefix swap, stem preserved) -- and both miss a rename where the STEM changed and the successor later grew past git's similarity threshold. Measured: 'git show --name-status -M c59fcef' reports R091 src/mcp/vice/anno-derivation.test.ts -> src/mcp/vice/anno-derivation.test.ts, the successor's own header records the rename, and all five predecessor test names survive verbatim; but the file grew 207 -> 478 lines so end-to-end -M does not score it. Consequence: the predecessor lands in forwardGone and the successor is independently derived into set B, so a truthful 'superseded' verdict would collide with the successor's own row on the duplicate-newSubject check. The relationship is NOT EXPRESSIBLE in the registry. Plan 32-08 recorded 'deleted' with the rename disclosed in full on the row and in evidence/32-deferred-fates.md section 5. Recommended fix (a strengthening, not a relaxation): add a third mechanism that inspects each gone member's removing commit for an R entry naming it as source; consequence is SET_B_FLOOR 16 -> 15 and TOTAL_FLOOR 61 -> 60.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-31T18:46:51.480Z",
    "resolved_at": null
  },
  {
    "id": 30,
    "kind": "deviation",
    "phase": "32",
    "file": "src/mcp/vice/block-class.ts",
    "line": 196,
    "description": "The transitional capitalised block-type arm 'if (block.type === \"Undefined\") return \"undefined\";' is ALREADY INERT and its recorded justification does not hold for it. The arms' stated reason for surviving their own removal trigger is that 'every committed coverage fixture is still spelled in that vocabulary'. Structural census of the twelve src/mcp/vice/fixtures/coverage/*/store.json (parsed as JSON, not grepped): 11 blocks across 6 of the 12 directories, spelled Code x 5 and Byte x 6. \"Undefined\" appears ZERO times. So :195 (Code) is load-bearing -- it rescues 5 blocks that would otherwise fall through to data silently -- while :196 matches nothing. The comment at :180 also overstates the impact: it says deleting the arms reclassifies 'every fixture block' as data, but 6 of the 11 already resolve to data by design, so only 5 would change. Measured by plan 32-08 while resolving research assumption A7. Not acted on: deleting a half-inert arm is a change to a live classifier and ROADMAP.md scopes this phase to recording the fate, not performing the re-point.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-31T18:47:06.035Z",
    "resolved_at": null
  },
  {
    "id": 31,
    "kind": "deviation",
    "phase": "32",
    "file": ".planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json",
    "line": null,
    "description": "The fate registry's verdict vocabulary cannot express 'kept-unchanged but its assertions were later re-aimed' for a NET-NEW (set-B) member without overloading 're-pointed', and cannot express a rename whose successor is itself an independently derived member at all. Both surfaced in plan 32-08. (a) A set-B member did not exist at AUDIT_COMMIT, so 'historicalPath -> newSubject' has no historical side; the two genuinely re-aimed set-B guards (anno-derivation.test.ts, module-classification.test.ts) are recorded 're-pointed' with newSubject === historicalPath, which is the same shape the 18 same-path set-A rows already use, but the token now means two different things. (b) The plan text for task 1 invites an OPTIONAL 'strengthening' observedRed on kept-unchanged rows; the committed guard's predicate REJECTS observedRed on that verdict outright, so following the plan text would have redded the registry. Guard won; recorded here so the next registry consumer does not re-derive the same contradiction.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-31T18:47:19.110Z",
    "resolved_at": null
  },
  {
    "id": 32,
    "kind": "unrun-verify",
    "phase": "32",
    "file": "src/mcp/vice/fork-live.test.ts",
    "line": null,
    "description": "fork-live.test.ts cannot be exercised on this development host and its opt-in run is a guaranteed red: the non-upstream fork (the -mcpserver build) is NOT installed here. Measured in plan 32-09's close-gate run at 0d7d328: /usr/bin/x64sc reports 'x64sc (VICE 3.9)', /usr/local/bin/x64sc reports 'x64sc (VICE 3.10)', and '/usr/local/bin/x64sc -help / grep -ci mcpserver' returns 0 -- so BOTH x64sc binaries on PATH are genuine unpatched stock, and the /usr/local one that shadows stock is a locally-built stock 3.10, not the fork. Running 'VICE_LIVE_FORK_BIN=/usr/local/bin/x64sc node --test fork-live.test.ts' gives 6 tests / 0 pass / 6 fail, every one 'waitForEndpointReady: http://127.0.0.1:PORT/mcp (fork binary /usr/local/bin/x64sc) never answered within 20000ms (last error: TypeError: fetch failed)'. Consequence: fork-live.test.ts's 6 tests reach their default-SKIP branch both locally and on CI and have NO exercise route anywhere, so nothing currently proves them. This also corrects a standing assumption that 'the fork shadows stock on PATH' -- at /usr/local/bin it does not, it is a second stock build. Not fixed: installing the fork is out of phase 32's scope (ROADMAP.md scopes this phase to contain no build work by design).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-31T19:22:26.336Z",
    "resolved_at": null
  },
  {
    "id": 33,
    "kind": "unmet-truth",
    "phase": "32",
    "file": "scripts/audit-mutation-harness.mjs",
    "line": 103,
    "description": "Restore-on-signal invariant still behaviour-unverified: SIGINT/SIGTERM handlers cannot run mid-plant because main() is wholly synchronous; 10/10 attempts landed in the window and the child still exited 0, not 130 (plan 32-14 Task 3)",
    "status": "fixed",
    "reason": "Closes on its STATED content ONLY. That content -- the restore-on-signal invariant is behaviour-unverified because SIGINT/SIGTERM handlers cannot run mid-plant while main() is wholly synchronous -- is discharged: plan 32-19 reached the harness OWN registered handler from an in-process driver and recorded 10/10 attempts at exit 130 with a byte-identical restore. Cited: evidence/32-restore-on-signal.md and the 5/5 green run of src/mcp/vice/audit-harness-restore.test.ts. The entry stated CAUSE is NOT disputed and remains true: main() is still wholly synchronous and a real CLI invocation still cannot dispatch a handler mid-plant. The latch OTHER consequence -- the disarm, which this entry is not about -- is carried forward by entry 40, which was appended BEFORE this closure so no intermediate ledger state showed this entry closed with no successor present.",
    "recorded_at": "2026-08-31T22:34:00.734Z",
    "resolved_at": "2026-09-01T10:58:32.236Z"
  },
  {
    "id": 34,
    "kind": "deviation",
    "phase": "32",
    "file": ".planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-sweep-renamed-rows.md",
    "line": 3889,
    "description": "Plan 32-14's one authorised in-place correction was measured to be a NO-OP: the value the fixed harness applies is byte-identical to the committed Plant line, so numstat is 70 additions / 0 deletions, not the 1 deletion the plan's acceptance criterion anticipated",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-31T22:34:07.678Z",
    "resolved_at": null
  },
  {
    "id": 35,
    "kind": "unmet-truth",
    "phase": "32",
    "file": "src/mcp/vice/hop-chain-comments.test.ts",
    "line": null,
    "description": "guard-fates row cannot be re-measured by the committed harness: its plant.replace is its own plant.find with a newline prepended, so the introduced occurrence overlaps the pre-existing one and the post-condition refuses it (PLANT REFUSED in the 32-15 --all sweep)",
    "status": "fixed",
    "reason": "Closes on the MEASUREMENT that discharges it, not on a description of one. The row now returns OBSERVED RED from the committed instrument in a WHOLE-SET sweep: plan 32-21's `--all` run at 77b7323 printed `OBSERVED RED  src/mcp/vice/hop-chain-comments.test.ts: guard exit status 1 (control exit status 0)` inside `counts: measured=35 skipped=26 total=61`, with ZERO `PLANT REFUSED` and ZERO `UNMEASURABLE`, and the registry write-back REACHED and observed on disk (30 of the 35 recorded-red blocks differing, row count 61 and row order unchanged, no evidence-owing-nothing row touched) before being discarded under D-08 so no dated record was replaced. The CAUSE was removed rather than worked around: the plant post-condition no longer subtracts whole-file totals -- which cannot see a replacement that textually overlaps its own pre-existing occurrence -- but asserts the recorded replacement lands at the unique match position with the exact length delta, which is exact under overlap. Pinned by the standing `overlap-accepted` case in src/mcp/vice/audit-harness-restore.test.ts, watched failing against the restored difference form before it was trusted. Full record: .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap1-overlap-and-writeback.md",
    "recorded_at": "2026-09-01T07:18:08.572Z",
    "resolved_at": "2026-09-01T11:42:54.584Z"
  },
  {
    "id": 36,
    "kind": "deviation",
    "phase": "32",
    "file": "src/mcp/vice/repo-root.test.ts",
    "line": 249,
    "description": "the !supervisorDir.includes('.claude') substring predicate fails unconditionally when the suite runs from a GSD worktree under .claude/worktrees/, so npm run test:automated cannot reach its 0-failure floor from there (measured 2994/2987/1 in plan 32-15)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-01T07:18:16.264Z",
    "resolved_at": null
  },
  {
    "id": 37,
    "kind": "deviation",
    "phase": "32",
    "file": "scripts/lib/audit-root.mjs",
    "line": 13,
    "description": "Stale line citation: cites audit-gate.mjs:1147-1151 as the WR-03 try/catch; plan 32-16's 40-line header block moved it to ~1191. Not fixed here because plan 32-17 owns this file in the same wave.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-01T07:45:46.016Z",
    "resolved_at": null
  },
  {
    "id": 38,
    "kind": "deviation",
    "phase": "32",
    "file": "src/mcp/vice/audit-root-args.test.ts",
    "line": 428,
    "description": "Completeness assertion red by design after plan 32-16 migrated audit-gate.mjs to parseRootArg(): audit-gate joins the derived population with no MATRIX row. Plan 32-18 owns the row and its own criteria require this red. Deliberately NOT relaxed.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-01T07:45:46.201Z",
    "resolved_at": null
  },
  {
    "id": 39,
    "kind": "deviation",
    "phase": "32",
    "file": ".planning/phases/32-the-deletion-and-the-grep-gate/32-18-PLAN.md",
    "line": null,
    "description": "Plan 32-18 cites audit-gate.mjs:90 for the fs import surface; plan 32-16's header block moved that import to :130. The names bound are unchanged.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-01T07:45:46.468Z",
    "resolved_at": null
  },
  {
    "id": 40,
    "kind": "unmet-truth",
    "phase": "32",
    "file": "scripts/audit-mutation-harness.mjs",
    "line": null,
    "description": "Restore machinery was DISARMABLE on the exported path: restoreAll() was guarded by a module-level boolean latch set on the first call and never reset, so once plan 32-19 exported plant()/restoreAll() any in-process consumer that completed one restore cycle permanently no-opped the exit, SIGINT, SIGTERM and uncaughtException handlers for the rest of the process. Round-3 verifier reproduced it against a scratch root (plant -> restoreAll -> plant -> SIGINT): EXIT=130, pendingRestoreCount() = 1, FINAL ON DISK: PLANTED_TWO (CR-10, gap 2). The SHIPPED CLI PATH WAS NEVER AFFECTED -- main() reverts per row from inside the row loop, which deletes from the captured-originals map without touching any latch, and calls restoreAll() exactly once in the finally after that loop, so the latch could never be set while a plant was on disk; the verifier 61-row --all sweep finished tree: restored byte-identical to the baseline. FIXED by plan 32-20: the latch is deleted with nothing replacing it, relying on the originals.clear() the same function already ends with, and pinned by the two second-window cases in src/mcp/vice/audit-harness-restore.test.ts, which were watched failing against a deliberately re-introduced latch (5 pass / 2 fail) and green once it was removed (7 pass / 0 fail). Successor to entry 33, appended before that entry closed. Evidence: .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-restore-disarm.md",
    "status": "fixed",
    "reason": "Fixed by plan 32-20 in the same round it was recorded. The module-level latch is deleted from scripts/audit-mutation-harness.mjs with nothing replacing it, relying on the originals.clear() the same function already ends with, and the two second-window cases in src/mcp/vice/audit-harness-restore.test.ts were watched FAILING against a deliberately re-introduced latch (5 pass / 2 fail) before they were trusted, then green once it was removed (7 pass / 0 fail). recorded_at and resolved_at are seconds apart because the defect was found and fixed in the same round -- that is a record of that arc, not a backdated close. Bite proof in full: evidence/32-restore-disarm.md.",
    "recorded_at": "2026-09-01T10:58:05.666Z",
    "resolved_at": "2026-09-01T10:58:25.297Z"
  },
  {
    "id": 41,
    "kind": "deviation",
    "phase": "33",
    "file": ".planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/33-02-PLAN.md",
    "line": null,
    "description": "33-02 Task 2's first automated verify greps the WHOLE of STATE.md for the two phase-32-review todo stems, but both stems legitimately appear in the historical '### Acknowledged at the v0.7.0 close' table (lines ~1474-1475) and its prose (~1488-1489); the command is unsatisfiable without deleting milestone-close history. Ran the section-and-table-cell-scoped equivalent instead, mirroring docs-deferred-ledger.test.ts's own stemHasOwnTableCell semantics.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-02T17:56:38.934Z",
    "resolved_at": null
  },
  {
    "id": 42,
    "kind": "deviation",
    "phase": "33",
    "file": ".planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-wallclock-control.md",
    "line": null,
    "description": "WARP_BRACKET_CONTROL: red was reached by region overshoot, not by the spurious timeout ROADMAP success criterion 5 names; the timeout form was not observed (ACCEPTED LIMIT 1)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-02T19:03:23.913Z",
    "resolved_at": null
  },
  {
    "id": 43,
    "kind": "deviation",
    "phase": "33",
    "file": ".planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-autostart-sequencing.md",
    "line": null,
    "description": "AUTOSTART_FRAME_EXACT: not-achieved — a frame-anchored post-load stop on danish.d64 reaches 66 differing addresses at jitter 4000, OVER D-22's committed cap of 64; 33-10 must record its jitters and must not retry until the allow-list fits",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-02T19:03:33.398Z",
    "resolved_at": null
  },
  {
    "id": 44,
    "kind": "deviation",
    "phase": "33",
    "file": ".planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-04-slicer-substrate.md",
    "line": null,
    "description": "SLICER: gate input not emitted by 33-04 -- SCHEMA.md 2.4 requires capture-predicate.test.ts and capture-seam.test.ts transcripts too, and neither file exists yet; 33-07 owns 33-slicer-validation.md and must emit the line",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-02T19:32:03.207Z",
    "resolved_at": null
  },
  {
    "id": 45,
    "kind": "deviation",
    "phase": "33",
    "file": ".planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/33-06-PLAN.md",
    "line": null,
    "description": "33-06 Task 1's own <verify> demands broker-control.test.ts report fail 0, while Task 1's action text widens attemptAcquire()'s signature -- which two PRE-EXISTING structural tests pin as a literal string. Honouring the plan's Task-1/Task-2 split literally would have committed a knowingly-red suite. The two pinned signatures were updated inside Task 1's commit, and the boundary-refusal/eligibility cases the plan assigns to Task 2 landed there too (same file, same commit). Task 2 delivered its full remaining scope. Same shape as 33-05's own deviation 1. Recorded so a later re-run of the plan text does not read the placement as a regression.",
    "status": "waived",
    "reason": "Provenance record, not a defect: the plan's own Task-1 <verify> gate and its Task-1/Task-2 split are mutually unsatisfiable for broker-control.test.ts, and the implementation is correct. Every acceptance criterion of both tasks is met; nothing to fix, kept as history.",
    "recorded_at": "2026-09-02T20:35:13.880Z",
    "resolved_at": "2026-09-02T20:35:29.422Z"
  },
  {
    "id": 46,
    "kind": "deviation",
    "phase": "33",
    "file": "src/mcp/vice/broker-launch.mts",
    "line": null,
    "description": "The launch profile was not carried forward across crash-respawn or recycle (handleExit -> launchSupervised builds a brand new InstanceRecord). A recycled or crash-respawned {warp:true} instance would have come back UNWARPED with a record that no longer matched what the caller asked for -- reintroducing D-16/T-33-24's undetectable mismatch one respawn later, the same defect class CR-01 already caused once in this function. Fixed inside 33-06 Task 1's commit 11f897d via an optional seventh launchSupervised() parameter, mirroring CR-02's remoteMonitorPort carry-forward at both handleExit call sites.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-02T20:35:14.413Z",
    "resolved_at": "2026-09-02T20:35:28.860Z"
  },
  {
    "id": 47,
    "kind": "unmet-truth",
    "phase": "33",
    "file": "src/mcp/vice/stop-oracle.ts",
    "line": null,
    "description": "CAP-03's structural bar is not total: the bidirectional import census and the image-buffer signature census cannot see a caller that reads the capture itself and passes a DERIVED SCALAR (a digest, a differing-address count, an equivalence verdict) into compareStopIdentity() -- no signature check can distinguish that number from a legitimately-read register value. Forbidden in stop-oracle.ts's WHAT NOT TO DO in prose only. Recorded as an ACCEPTED LIMIT in evidence/33-slicer-validation.md and carried from 33-07-PLAN.md's own flagged_assumptions, where the deterministic edge probe classified CAP-03's single edge unclassified.",
    "status": "waived",
    "reason": "Knowingly-accepted design limit, not a defect: the two structural assertions are the strongest instruments available for a NEGATIVE STRUCTURAL requirement, and the derived-scalar route is unreachable by any signature or import census by construction. Recorded as an ACCEPTED LIMIT in evidence/33-slicer-validation.md, which 33-12's findings document collects verbatim, so the limit travels with the verdict rather than sitting as an open defect. Falsifiable by exactly one thing: such a call site appearing.",
    "recorded_at": "2026-09-02T21:04:22.740Z",
    "resolved_at": "2026-09-02T21:05:21.142Z"
  },
  {
    "id": 48,
    "kind": "deviation",
    "phase": "33",
    "file": "src/mcp/vice/package.json",
    "line": null,
    "description": "check-npm-packages.mjs is RED from plan 33-06: broker-launch.mts is type-imported by the published vice-broker-client.ts but is not in files[]. No runtime impact (import type is erased) but the packaging gate is red for the rest of the phase. See phase 33 deferred-items.md D1.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-02T21:30:13.836Z",
    "resolved_at": null
  }
]
````
