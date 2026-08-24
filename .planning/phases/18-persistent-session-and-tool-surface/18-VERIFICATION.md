---
phase: 18-persistent-session-and-tool-surface
verified: 2026-08-24T13:23:31Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 18: Persistent Session and Tool Surface Verification Report

**Phase Goal:** A regenerator2000 project stays open across a whole working session.
**Verified:** 2026-08-24T13:23:31Z
**Status:** passed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Many `r2000_*` calls reuse one held child and every spawn remains guarded against `--vice`. | VERIFIED | Live focused run: same PID and `openCount: 1` across three calls; `r2000-spawn-seam.test.ts` proves the two-site set and guard ordering. |
| 2 | Between-call crashes restart transparently; mid-call exits and wedges fail loudly and recoverably. | VERIFIED | Real SIGKILL and stub exit/timeout/restart-budget scenarios passed under regenerator2000 0.9.20. |
| 3 | Acknowledged mutations survive hard kill, and removing the internal save makes the oracle fail. | VERIFIED | D18-09 scenarios 1-3 passed, including the save-suppressed planted violation and byte-identical mid-window failure. |
| 4 | One owner serializes complete operations in FIFO order and prevents lost updates. | VERIFIED | Five-caller FIFO, bounded wait, throwing-holder release, and locked-vs-bypassed lost-update tests passed. |
| 5 | `r2000_read_region` is curated and `r2000_get_address_details` avoids the upstream `u16` overflow through client composition. | VERIFIED | Both region views and the cap-sized request passed live; full-64K address details used exactly four read calls in one session and never called the upstream same-named tool. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/mcp/vice/r2000-session.ts` | Held session, crash recovery, FIFO owner | VERIFIED | Substantive and wired through `runR2000Tool()`; live and stub behavior passed. |
| `src/mcp/vice/r2000-mcp-client.ts` | One guarded stdio spawn and named errors | VERIFIED | Exactly one async spawn; `assertNoViceFlag(argv)` precedes it. |
| `src/mcp/vice/r2000-tools.ts` | Session dispatch and 19 curated tools | VERIFIED | Both added tools are advertised, validated, and exercised live. |
| `src/mcp/vice/r2000-project.ts` | Pre-spawn settings enforcement | VERIFIED | Unit and live no-revert round trip passed. |
| `src/mcp/vice/r2000-session.test.ts` | Persistence, recovery, and serialization oracles | VERIFIED | Included in the 107-test focused live run with zero skips. |
| `18-PHASE-GATE-EVIDENCE.md` | Phase gate and requirement evidence | VERIFIED | Contains command results, skip census, six requirement rows, planted violations, and carried findings. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `runR2000Tool()` | `openR2000Session()` | `runInR2000Session()` | WIRED | The whole call, including mutating save, is the queue critical section. |
| `r2000-session.ts` | project settings | `ensureProjectSettings()` before spawn | WIRED | Live D18-35 test proves forcing and no-revert behavior. |
| `composeAddressDetails()` | four upstream reads | one held session callback | WIRED | Frame-count test proves four reads, no native details call, and no save. |
| package `files[]` | spawn-seam guard | shipped-module discovery | WIRED | `r2000-session.ts` is scanned and contributes no spawn site. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Phase 18 focused live behavior | Node 22.22 `--test --test-concurrency=1` over four r2000 suites with `VICE_REQUIRE_R2000=1` | 107 passed, 0 failed, 0 skipped | PASS |
| Type safety | `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` | exit 0 | PASS |
| Skill/tool coverage | `node scripts/check-skill-tool-coverage.mjs` | 10/10 used r2000 names curated; 19-tool surface | PASS |
| Full package regression | `npm test -- --test-concurrency=1` under Node 22.22 | rerun: 2415 passed, 0 failed, 40 environment skips, 5 existing emulator TODOs | PASS |

The first full-suite run reported one failure among 2,460 tests but its retained output did not include the failing assertion. An immediate logged rerun passed all tests. This is recorded as nondeterministic regression-suite risk; it did not affect the focused Phase 18 set, which passed authoritatively with live r2000 tests required.

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|---|---|---|---|
| SESS-01 | 18-01, 18-02, 18-03, 18-07 | SATISFIED | Same-child reuse, path eviction, settings enforcement, and guarded spawn-site tests passed. |
| SESS-02 | 18-04, 18-07 | SATISFIED | Real between-call kill plus mid-call, timeout, and restart-budget tests passed. |
| SESS-03 | 18-03, 18-07 | SATISFIED | SIGKILL persistence and save-suppressed non-vacuity tests passed. |
| SESS-04 | 18-06, 18-07 | SATISFIED | FIFO owner, bounded contention, and lost-update oracle passed. |
| SURF-01 | 18-05, 18-07 | SATISFIED | Region schema, bounds, both views, omitted default, and cap request passed. |
| SURF-02 | 18-01, 18-05, 18-07 | SATISFIED | D-36 composition passed against a real full-64K project without native upstream dispatch. |

No Phase 18 requirement is orphaned.

### Anti-Patterns Found

No untracked `TBD`, `FIXME`, or `XXX` marker was found in the Phase 18 implementation files. Existing planning-document TODO prose refers to previously recorded milestone coverage debt and is not a Phase 18 implementation stub.

### Human Verification

Approved by the user on 2026-08-24 after reviewing the live-test census,
requirement mappings, and stdin-EOF conclusion. The result is persisted in
`18-HUMAN-UAT.md`.

### Gaps Summary

No implementation or verification gaps remain.

---

_Verified: 2026-08-24T13:23:31Z_
_Verifier: Codex following the gsd-verifier contract_
