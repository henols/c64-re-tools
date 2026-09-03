---
phase: 34-the-host-tool-execution-seam
verified: 2026-09-03T23:09:04Z
status: passed
score: 7/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 6/7
  gaps_closed:
    - "CR-05 / gap 3: resolveWorkspacePath() now walks BOTH the workspace root and the candidate path through a new ancestor-realpath function (realpathOfNearestExisting(), host-tool.mts:487-559) before the prefix comparison, and returns the WALKED real path — not the lexical join — as its ok:true result (host-tool.mts:561-586). Independently reproduced live (not accepted from SUMMARY/REVIEW claims): the exact escape round 2 demonstrated (a symlink planted inside a temp workspace, pointing at an external temp directory, `resolveWorkspacePath(root, \"link/pwned.txt\")`) now returns `{ ok: false, message: 'workspace path escapes the workspace root...' }`, and the external directory's listing stays empty. Also independently confirmed the discrimination property claimed (not just the refusal): a symlink planted INSIDE the workspace pointing at an in-workspace real directory is FOLLOWED and ACCEPTED, resolving to the real in-workspace location — proving this is a real confinement fix, not an over-broad \"refuse every symlink\" patch that would also break legitimate in-workspace links."
  gaps_remaining: []
  regressions: []
gaps: []
deferred: []
human_verification: []
---

# Phase 34: The Host-Tool Execution Seam Verification Report

**Phase Goal:** A container-side skill script invokes a host binary — `acme`, `dxa`,
Ghidra — through one typed seam that consumes no emulator lease, returns paths rather than
payloads, and is the only route there is, with the ban on every other route written and
observed biting.
**Verified:** 2026-09-03T23:09:04Z
**Status:** passed
**Re-verification:** Yes — third round, closing gap 3 / CR-05 from round 2 (`34-10`/`34-11`)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Container-side skill invokes a host binary over a typed control op, routed before any lease-bearing path, consuming no lease, through a typed per-tool allowlist with **no argv passthrough anywhere** (SC1, SEAM-01/02) | ✓ VERIFIED (regression) | `HOST_TOOL_ARG_KEYS["oracle.probe"]` still `Object.freeze([])`; `preScript`/`postScript`/`includes` still resolved through `resolveWorkspacePath()` before `buildHostToolArgv()` reads them — now against the realpath-based implementation. Re-ran `host-tool.test.ts`: 83/83 pass (up from 67 at round 2, +16 new symlink/edge/equivalence cases from `34-10`). `34-REVIEW.md` round 3 independently re-confirms CR-01/CR-02/CR-03 CLOSED and unaffected by the `resolveWorkspacePath()` rewrite |
| 2 | `ghidra.analyze` completes over the shipped, default-configured host_tool control-plane route within its recorded per-invocation JVM binding (CR-04) | ✓ VERIFIED (regression) | `HOST_TOOL_TIMEOUT_MS`/client timeout tables unchanged by this round (no plan in `34-10`/`34-11` touched them, confirmed via `git show --stat` on both commits' diffs); the live overlapping-slow-`ghidra.analyze` end-to-end test still passes as part of the 83/83 run |
| 3 | `resolveWorkspacePath()` — the seam's own declared single confinement point — actually confines every path-bearing key to the workspace, including against a symlink planted inside the workspace tree (CR-05, gap 3) | ✓ VERIFIED | Independently reproduced live in this round: built a standalone repro script against the freshly-built `resources/host-tool.mjs` (not the test suite's own assertions), planted a real on-disk symlink inside a temp workspace pointing at an external temp directory, and called `resolveWorkspacePath()` on a path through it. Result: `{ ok: false, message: 'workspace path escapes the workspace root: "link/pwned.txt" resolves to /tmp/cr05-outside-.../pwned.txt, outside /tmp/cr05-ws-...' }` — the exact write-key escape round 2 demonstrated as succeeding is now refused, and the external directory's listing (`readdirSync`) stays `[]`. Also independently confirmed the "outDir"-shaped case (`resolveWorkspacePath(workspace, "link")`) is refused identically. Separately confirmed the discrimination claim: an in-workspace symlink (`insidelink` -> `realdir`, both inside the workspace) is FOLLOWED and ACCEPTED, resolving to the real in-workspace path — this is not an over-broad "refuse all symlinks" patch. `grep -c realpath host-tool.mts` is now 21 occurrences (was 0 at round 2); `realpathOfNearestExisting()`/`pathEntryExists()`/`MAX_SYMLINK_HOPS` are present, substantive (not stubs — full ancestor-walk logic with dangling-link and cycle handling, hop-bounded at 40, mirroring `anno-types.ts`'s already-reviewed twin), and wired (both `repoRoot` and the candidate route through the walk before the prefix check at `host-tool.mts:579`). `node build.ts` run fresh produces zero diff against the committed `resources/host-tool.mjs` (`git status --porcelain` empty) — the artifact the broker actually loads carries the fix, not just the source |
| 4 | The 64 KiB line cap is observed, not read about (SC2, SEAM-03) | ✓ VERIFIED (regression) | `host-tool-transport.test.ts` re-run as part of the combined 244-test run: all pass; `evidence/34-transport-cap.md` unchanged |
| 5 | Ghidra runs with one project directory per run id, `-deleteProject`, and the no-dot project-path refusal enforced in code (SC3, SEAM-04) | ✓ VERIFIED (regression) | `ghidra-project.test.ts` re-run in the same combined run: all pass; `evidence/34-ghidra-dotpath.md` unchanged |
| 6 | The whole-tree grep gate banning skill-script external-binary spawn bites on a planted violation, scoped to what a user actually receives (SC4, SEAM-05) | ✓ VERIFIED (regression) | `skill-external-spawn-gate.test.ts` re-run in the same combined run: all pass, including 3 planted-violation shapes; `node scripts/check-no-skill-external-spawn.mjs` clean |
| 7 | The new module family is inside the closed-consumer discipline with a second floor pinned over its own prefix, and the JVM lifetime binding is recorded with measurement and reversal condition (SC5, SEAM-06/07) | ✓ VERIFIED (regression) | `hostpath-consumers.test.ts` re-run in the same combined run: all pass; `docs/phase34-host-tool-seam-decisions.md` now carries an appended, dated Part 4 (CR-05 correction) plus new `A-15`/`A-16` rows, with the original text left legible above — confirmed by `git diff --numstat` showing zero deletions across both `34-11` commits |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/mcp/vice/host-tool.mts` | Host-bound executor: typed allowlist, argv construction, async spawn, workspace confinement | ✓ VERIFIED | Present, substantive, wired, tested (83/83 `host-tool.test.ts` pass). The argv-passthrough invariant (CR-01/02/03) and the confinement invariant beneath it (CR-05) now both hold, independently re-verified |
| `src/mcp/vice/host-tool-client.ts` | Container-side client, `containerPath()` translation, per-tool request-deadline timers | ✓ VERIFIED (regression) | Unchanged this round; still wired, cross-seam ordering test still passes |
| `src/mcp/vice/ghidra-project.mts` | Per-run project resolution, dot-segment refusal, argv builder | ✓ VERIFIED (regression) | Unchanged this round; present, substantive, wired |
| `scripts/check-no-skill-external-spawn.mjs` | Whole-tree grep gate, npm-pack scope | ✓ VERIFIED (regression) | Present, wired into CI, exits 0, gate tests pass |
| `src/mcp/vice/resources/host-tool.mjs`, `resources/ghidra-project.mjs` | Compiled artifacts in sync with `.mts` sources | ✓ VERIFIED | `resources-sync.test.ts` passes; independently confirmed via a fresh `node build.ts` run producing zero diff |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `broker-control.mts` `handleLine()` | `host-tool.mts` `runHostTool()` | `onHostTool` callback | ✓ WIRED (regression) | Unchanged; declared alongside, never composed from, the seven lease callbacks |
| `host-tool.mts` argv builders | `resolveWorkspacePath()` | boundary check | ✓ WIRED | All seven path-bearing keys route through this single function, and the function itself now confines correctly against a planted symlink — the "HOLLOW" finding from round 2 is closed |
| `host-tool-client.ts` `hostToolOverControlPlane()` | real broker `onHostTool` wiring | TCP control-plane round trip, per-tool deadline | ✓ WIRED (regression) | Unchanged this round; still completes for `ghidra.analyze` |

### Data-Flow Trace (Level 4)

Not applicable in the rendered-UI sense — this phase delivers a backend control-plane seam, not a rendered view. The relevant "does the value actually reach the real destination" trace is the argv-construction and confinement chain covered under Key Link Verification and Truth 3 above: every path-bearing argument flows from the wire request, through `resolveWorkspacePath()`'s real (walked) resolution, into `buildHostToolArgv()`'s argv array — never from a raw wire string, and never confined by a check that a symlink could defeat.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| CR-05 live reproduction (independent of the test suite) | standalone Node script against the freshly-built `resources/host-tool.mjs`: mkdtemp workspace + mkdtemp external dir + `symlinkSync` + `resolveWorkspacePath()` + attempted write | refused with the workspace-escape message; external directory listing stays `[]` | ✓ PASS |
| CR-05 discrimination check (independent of the test suite) | standalone Node script: in-workspace symlink to an in-workspace real directory, `resolveWorkspacePath()` called through it | accepted, resolves to the real in-workspace path | ✓ PASS |
| Full `host-tool.test.ts` (single file) | `node --test host-tool.test.ts` | 83/83 pass | ✓ PASS |
| Combined module-family + guard regression run | `node --test host-tool.test.ts host-tool-transport.test.ts ghidra-project.test.ts resources-sync.test.ts hostpath-consumers.test.ts spawn-seam.test.ts docs-linerefs.test.ts docs-deferred-ledger.test.ts docs-review-disposition.test.ts anno-confinement.test.ts anno-seam.test.ts skill-external-spawn-gate.test.ts` | 244/244 pass | ✓ PASS |
| Compiled-artifact drift check | `node build.ts` then `git status --porcelain resources/` | empty diff | ✓ PASS |
| Typecheck | `npm run typecheck` | clean | ✓ PASS |
| Full automated suite (run once, not filtered per truth) | `npm run test:automated` | `tests 3278 / suites 24 / pass 3270 / fail 2 / skipped 1 / todo 5` | ✓ PASS (both failures are the documented pre-existing `anno-register.test.ts` floor — `STORE-01`/`STORE-04`/`STORE-06`/`MCP-04` residue from the v0.8.0 REQUIREMENTS rewrite, unrelated to any file this round touched) |
| Debt-marker scan on phase-touched files | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER" host-tool.mts host-tool.test.ts host-tool-client.ts ghidra-project.mts vice-broker.mts` | no matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| SEAM-01 | 34-01 | Typed control op before lease path | ✓ SATISFIED (regression) | Unchanged from prior rounds |
| SEAM-02 | 34-01/34-07/34-08/34-10 | Typed per-tool allowlist, no argv passthrough | ✓ SATISFIED | CR-01/CR-02/CR-03 unchanged and CR-05 now also closed — the confinement layer the resolved argv values depend on for meaning now holds against a planted symlink |
| SEAM-03 | 34-01/34-02 | Path+digest+length via containerpath.ts | ✓ SATISFIED (regression) | `containerPath()` applied; 64KiB cap observed red |
| SEAM-04 | 34-03 | Per-run Ghidra dir, `-deleteProject`, dot-refusal in code | ✓ SATISFIED (regression) | Live transcript, unchanged |
| SEAM-05 | 34-04/34-05 | Migrations + whole-tree gate, npm-pack scope | ✓ SATISFIED (regression) | Gate wired into CI, biting |
| SEAM-06 | 34-06 | Second floor, closed-consumer discipline | ✓ SATISFIED (regression) | `hostpath-consumers.test.ts` passes |
| SEAM-07 | 34-06 | JVM binding, measurement, reversal condition | ✓ SATISFIED (regression) | Decision record now also carries the CR-05 correction and `A-15`/`A-16`; unchanged in substance |

No orphaned requirements — all seven `SEAM-*` ids declared across the plans are present in `.planning/REQUIREMENTS.md`'s Phase 34 section, all marked Complete (`.planning/REQUIREMENTS.md:407-413`).

### Anti-Patterns Found

None (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` grep across `host-tool.mts`, `host-tool.test.ts`, `host-tool-client.ts`, `ghidra-project.mts`, `vice-broker.mts` returns nothing).

Three review warnings, all previously known, none newly introduced, none blocking a must-have:
- **WR-01** (carried, unchanged): `check-no-skill-external-spawn.mjs`'s detector is evadable by aliasing the spawn function. Deferred by explicit decision.
- **WR-02** (carried, unchanged): `host_tool` has no admission control / concurrent-JVM ceiling. Deferred by explicit decision.
- **WR-03** (carried, unchanged, OPEN): `runOracleRun()`'s `mkdirSync` sits outside its own try/catch; the standalone CLI entry point has no `.catch()`. Filed as a pending todo (`.planning/todos/pending/2026-09-03-wr-03-host-tool-never-throws-contract-has-two-holes.md`), STATE.md ledger row intact, deliberately left out of this round's scope by `34-11`'s own decision record. This is a minor robustness gap on the standalone-CLI-only route (the real broker's own `.catch()` around `onHostTool` already absorbs the failure) — not a demonstrated exploit and not a phase must-have, so it does not block `passed` status, consistent with round 2's own scoring discipline for carried warnings.

**Minor documentation drift noted, not scored as a gap:** `.planning/STATE.md:1030`'s `### Pending Todos` section still reads "9 pending (9 files in `.planning/todos/pending/`...)" — stale by one, since the CR-05 todo moved to `completed/` in this round, leaving 8 files on disk (confirmed: `ls .planning/todos/pending/ | wc -l` = 8). This line sits inside `## Accumulated Context`, a section `docs-deferred-ledger.test.ts` does not scan (it only scans `## Deferred Items`, where `34-11` correctly corrected the count to "8 open" at `STATE.md:173-174`). No test reds on this, and it is pure bookkeeping prose unrelated to any SEAM-* requirement or phase truth — surfaced here for completeness, in the spirit of the project's own documented history of stale-STATE.md-prose defects, but it does not affect the phase goal and is not a blocker.

### Gaps Summary

None. This round closes the last outstanding gap from round 2 (CR-05 / gap 3) and re-confirms, via independent reproduction rather than trust in SUMMARY.md or REVIEW.md claims, that:

1. **The escape is genuinely closed.** The exact live repro round 2 used to demonstrate the defect (a symlink planted inside a workspace, pointing outside it, used as both a read key and a write key) now fails with the workspace-escape refusal message, and the outside directory is provably untouched.
2. **The fix discriminates rather than over-blocking.** A symlink pointing to an in-workspace location is followed and accepted, resolving to its real in-workspace path — ruling out the "refuse every symlink" failure mode that would have broken legitimate use while looking like a fix.
3. **The compiled artifact carries the fix.** A fresh `node build.ts` run produces zero diff against the committed `resources/host-tool.mjs`.
4. **No regression.** All six previously-verified truths were re-checked and still hold: 244/244 tests pass across the full module-family + ledger/disposition/confinement guard set, typecheck is clean, and the one full `test:automated` run matches the documented pre-existing 2-failure floor in `anno-register.test.ts` (unrelated to any file this round touched — confirmed neither `anno-register.test.ts` nor the anno tool register nor `REQUIREMENTS.md` appear in this round's 11 changed files).
5. **The record and the ledger agree with the code.** `docs/phase34-host-tool-seam-decisions.md` carries an appended (not rewritten) CR-05 correction and two new assumptions; the CR-05 todo moved to `completed/` with a Resolution section; `.planning/STATE.md`'s Deferred Items table (the section the ledger guard actually checks) is reconciled in the same commit as the todo move; WR-03's row and todo were correctly left untouched, since closing CR-05 does not close WR-03.

The three carried warnings (WR-01, WR-02, WR-03) remain open by explicit, recorded decision and do not block phase completion — this matches the same scoring discipline round 2 already applied to WR-01/WR-02, extended consistently to WR-03 now that it too has a documented disposition (a pending todo with a named owner-in-waiting, not a silent gap).

---

_Verified: 2026-09-03T23:09:04Z_
_Verifier: Claude (gsd-verifier)_
