---
schema_version: 1
open_count: 12
waived_count: 0
fixed_count: 3
total_count: 15
last_updated: 2026-08-26T15:56:52.138Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | quick-260823-kf6 | deviation | src/mcp/vice/audit-integrity.test.ts | 262 | Pre-existing failure (T-12-04 hardcoded tech_debt=3 count), predates this task's commit 76f7b15; out of scope, see quick task's deferred-items.md | open |  | 2026-08-23T12:59:39.120Z |  |
| 2 | 18 | deviation | src/mcp/vice/r2000-mcp-client.ts |  | npm test (no flags) never exited when regenerator2000 is installed locally. RESOLVED at phase 18 wave 2's post-merge gate: NOT pre-existing -- plan 18-03's rewire of runR2000Tool() through r2000-session.ts's HELD slot left every non-vice-proxy host pinned open by the child's ref'd stdio handles (r2000-cli.test.ts:1303 calls runR2000Tool once). Disproven by direct measurement: the same file exits in 2s at the wave-1 tip ebe90f8 and hung at f6a5b03. Fixed by unref'ing the child and its three stdio pipes in openR2000Session(); plain npm test now exits 0. | fixed | Root-caused and fixed at the wave-2 post-merge gate; the "pre-existing" attribution was inferred from the import chain, never measured against an unmodified checkout. | 2026-08-24T09:42:05.932Z | 2026-08-24T10:06:33.000Z |
| 3 | 19 | deviation | src/mcp/vice |  | Unreproduced single-test flake: the first full npm test after plan 19-01 reported 1 failure (2470 tests); three consecutive re-runs reported 0. The failing subtest name was not captured. Capture it with tee if it recurs. | open |  | 2026-08-24T16:17:20.435Z |  |
| 4 | 19 | unrun-verify | src/skills/c64-program-recon/scripts/packer-finding.test.mjs |  | The oracle-route test for the packer finding SKIPS (visibly) because no external packer identifier is installed, so parseUnp64Stdout()'s accepted marker set is an unmeasured assumption and SURF-03's positive branch has never executed. Re-open trigger: install the identifier, build a genuinely packed fixture, confirm the name and the HIGH confidence. | open |  | 2026-08-24T17:39:41.733Z |  |
| 5 | 19 | deviation | .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-04-PLAN.md |  | Task 1 acceptance criterion invokes 'node src/mcp/vice/r2000-cli.ts coverage --nonsense-flag', which cannot exit non-zero: r2000-cli.ts has no main guard by design. Satisfied through the real entry point (vice-proxy.ts r2000 coverage --nonsense-flag, exit 1); recorded so a later re-run of the plan text does not read as a regression. | open |  | 2026-08-24T17:39:41.840Z |  |
| 6 | 19 | deviation | .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-05-PLAN.md |  | Task 3(e) required the pre-existing failure baseline to be measured by stashing or checking out the pre-phase commit. git stash is forbidden in this project, and a checkout would have moved HEAD over committed work, so the baseline was taken in a detached worktree at a352500 with a symlinked node_modules. That run reported 7 failures, ALL of them host-path / build-staging / workspace-translation tests that assert about where the checkout is -- an artefact of the measurement location, not a baseline. Every one passes in the real tree (post-phase run: 0 fail). Recorded so a later reader does not mistake the confounded 7 for inherited failures, and so the next phase needing a baseline picks a method that does not relocate the checkout. | open |  | 2026-08-24T18:13:07.770Z |  |
| 7 | 19 | unmet-truth | .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-REVIEW.md |  | 17 Phase 19 review findings (CR-01, IN-01..IN-04, WR-01..WR-12) undispositioned; 19-06 discharges CR-01 and WR-02, the rest are owned by 19-07/19-08/19-09 and keep docs-review-disposition.test.ts + audit-integrity D-12-02 red until 19-09 lands | open |  | 2026-08-24T21:28:33.217Z |  |
| 8 | 19 | deviation | src/mcp/vice/skill-attribution.test.ts |  | 19-07 deferred WR-11: three suites and five shipped-prose citations hard-code a .planning/phases/19- path that GSD archives at milestone close; 19-07 added no new instance | open |  | 2026-08-24T21:56:23.195Z |  |
| 9 | 19 | deviation | src/mcp/vice/skill-attribution.test.ts |  | 19-07 deferred WR-12: manifestEntryFor() lies to the type system and can throw a TypeError instead of its intended message; not called by 19-07's guard | open |  | 2026-08-24T21:56:23.308Z |  |
| 10 | 19 | deviation | src/mcp/vice/r2000-coverage.test.ts |  | trueReturnGuardChains() cut for-header semicolons; fixed in the same commit by tracking parenthesis depth | fixed |  | 2026-08-25T11:57:33.035Z | 2026-08-25T11:58:16.142Z |
| 11 | 19 | deviation | src/mcp/vice/r2000-coverage.test.ts |  | PUSH_IDIOM_WINDOW_EDGE declared interior to (zeropage-vector-jumped-through, class-3-pass) rather than OUTSIDE as plan 19-18 specified; the plan's position was factually false | fixed |  | 2026-08-25T13:22:44.057Z | 2026-08-25T13:23:33.194Z |
| 12 | 23 | deviation | .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/tools/verify/task1-verify-as-planned.bash |  | 23-02 task 1 <verify> is unsatisfiable as written: it asserts DXA_TARBALL_SHA256_VERIFIED: pass and a bare-decimal FIXTURE_DATA_RECOVERY_PCT, both of which SCHEMA.md's frozen domains forbid. Evidence follows SCHEMA.md; the check is recorded failing, not repaired. | open |  | 2026-08-26T10:58:18.286Z |  |
| 13 | 23 | deviation | src/mcp/vice/r2000-session.test.ts | 615 | Load-flaky: crash-counter assertion fails under full-suite parallelism, green in isolation and on re-run; logged in phase 23 deferred-items, not fixed (evidence convention 9 forbids touching src/) | open |  | 2026-08-26T11:40:12.713Z |  |
| 14 | 23 | unmet-truth | .planning/REQUIREMENTS.md |  | PROOF-01/02/03 not met at the Phase 23 close: criteria never measured (no depacked flat-64K capture, D-03); rows read Pending with the reason | open |  | 2026-08-26T15:56:45.162Z |  |
| 15 | 23 | unrun-verify | .planning/phases/23-the-real-release-gate-go-degrade-no-go/23-11-PLAN.md |  | 23-11 Task 3's automated verify asserts all five PROOF rows read Complete; recorded unsatisfiable because PROOF-01/02/03 were never measured (phase-wide precedent: the evidence is not bent to a plan regex) | open |  | 2026-08-26T15:56:52.138Z |  |

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
    "file": "src/mcp/vice/r2000-mcp-client.ts",
    "line": null,
    "description": "npm test (no flags) never exited when regenerator2000 is installed locally. RESOLVED at phase 18 wave 2's post-merge gate: NOT pre-existing -- plan 18-03's rewire of runR2000Tool() through r2000-session.ts's HELD slot left every non-vice-proxy host pinned open by the child's ref'd stdio handles (r2000-cli.test.ts:1303 calls runR2000Tool once). Disproven by direct measurement: the same file exits in 2s at the wave-1 tip ebe90f8 and hung at f6a5b03. Fixed by unref'ing the child and its three stdio pipes in openR2000Session(); plain npm test now exits 0.",
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
    "description": "Task 1 acceptance criterion invokes 'node src/mcp/vice/r2000-cli.ts coverage --nonsense-flag', which cannot exit non-zero: r2000-cli.ts has no main guard by design. Satisfied through the real entry point (vice-proxy.ts r2000 coverage --nonsense-flag, exit 1); recorded so a later re-run of the plan text does not read as a regression.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-24T17:39:41.840Z",
    "resolved_at": null
  },
  {
    "id": 6,
    "kind": "deviation",
    "phase": "19",
    "file": ".planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-05-PLAN.md",
    "line": null,
    "description": "Task 3(e) required the pre-existing failure baseline to be measured by stashing or checking out the pre-phase commit. git stash is forbidden in this project, and a checkout would have moved HEAD over committed work, so the baseline was taken in a detached worktree at a352500 with a symlinked node_modules. That run reported 7 failures, ALL of them host-path / build-staging / workspace-translation tests that assert about where the checkout is -- an artefact of the measurement location, not a baseline. Every one passes in the real tree (post-phase run: 0 fail). Recorded so a later reader does not mistake the confounded 7 for inherited failures, and so the next phase needing a baseline picks a method that does not relocate the checkout.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-24T18:13:07.770Z",
    "resolved_at": null
  },
  {
    "id": 7,
    "kind": "unmet-truth",
    "phase": "19",
    "file": ".planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-REVIEW.md",
    "line": null,
    "description": "17 Phase 19 review findings (CR-01, IN-01..IN-04, WR-01..WR-12) undispositioned; 19-06 discharges CR-01 and WR-02, the rest are owned by 19-07/19-08/19-09 and keep docs-review-disposition.test.ts + audit-integrity D-12-02 red until 19-09 lands",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-24T21:28:33.217Z",
    "resolved_at": null
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
    "file": "src/mcp/vice/r2000-coverage.test.ts",
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
    "file": "src/mcp/vice/r2000-coverage.test.ts",
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
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-26T10:58:18.286Z",
    "resolved_at": null
  },
  {
    "id": 13,
    "kind": "deviation",
    "phase": "23",
    "file": "src/mcp/vice/r2000-session.test.ts",
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
  }
]
````
