---
phase: 40-the-three-preprocessing-host-tools
verified: 2026-09-08T20:45:00Z
status: passed
score: 4/4 roadmap truths verified (3 live success criteria + gap G-40-1/PREP-05 fully closed)
behavior_unverified: 0
overrides_applied: 0
behavior_unverified_items: []
coincidental_reliance_items: []
re_verification:
  previous_status: human_needed
  previous_score: "4/4 roadmap truths verified (plus 27/29 plan-level must-haves; 2 flagged for human judgment)"
  gaps_closed:
    - "G-40-1 (UAT test 1, MAJOR): ghidra.analyze's per-run project directories landed at <repoRoot>/tools/ghidra-runs/, outside D-33's one root, and the prior record called this an unavoidable external-tool constraint. CLOSED: the runs root now resolves through a broker-minted, verified, relative-target symlink handle (<repoRoot>/c64-re-tools -> .c64-re-tools), the bytes land physically under .c64-re-tools/runs/ghidra/, and no production module joins the repo root with the retired tools/ segment."
  gaps_remaining: []
  regressions: []
---

# Phase 40: The Three Preprocessing Host Tools Verification Report (Re-verification after gap closure)

**Phase Goal:** `c1541` and `petcat` are reachable from a container-side skill
script over the typed `host_tool` control op v0.8.0 shipped — so a disk's real
structure and a BASIC stub's handover point are available before any
disassembler is spent on the image — and a failure in either is reported as a
failure despite `c1541` exiting `0` on error. (`cartconv` and `PREP-03`
removed from scope by owner direction before any of it was built.)

**Verified:** 2026-09-08T20:45:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (plans 40-08..40-11, gap `G-40-1`)

This report supersedes the prior `40-VERIFICATION.md` (`human_needed`), which
is preserved in git history. Its verdict was NOT carried forward; every claim
below was re-derived against the current tree, and the two prior
human-judgment items were independently re-checked rather than assumed
resolved.

## Part 1 — Is gap G-40-1 closed, and is PREP-05 genuinely satisfied?

The owner's two binding requirements (`40-UAT.md`, test 1, `reported:`):

> "the sym link must be created by the broker so the mcp and other tooling
> is still working from inside a devcontainer" — and the runs root must not
> live under `tools/`.

### R1 — The runs root is NOT under `tools/`

| Check | Method | Result |
|---|---|---|
| No production module joins repo root with `"tools"` for Ghidra runs | `grep -n '"tools"' ghidra-project.mts resources/ghidra-project.mjs host-tool.mts resources/host-tool.mjs` | Zero hits |
| `GHIDRA_RUNS_DIR_NAME` (the retired constant) is gone everywhere | `grep -rn GHIDRA_RUNS_DIR_NAME` across `*.ts`/`*.mts`/`*.mjs` | Zero hits |
| `git ls-files tools/` is empty (the directory is vestigial) | direct execution this session | `0` |
| The path handed to Ghidra is computed once, in `ghidraRunsRoot(repoRoot)` | Read `ghidra-project.mts:130-149` | `join(repoRoot, "c64-re-tools", "runs", "ghidra")` — the non-dotted handle segment, never `tools/` |
| The physical bytes land under `.c64-re-tools/` | Read `ghidraRunsRealRoot()`; **directly reproduced live** (see below) | `join(repoRoot, ".c64-re-tools", "runs", "ghidra")`; confirmed on disk |
| `.gitignore` covers the root + its alias, not `tools/ghidra-runs/` | `grep -n 'c64-re-tools\|ghidra-runs' .gitignore` | One stanza: `/.c64-re-tools/` + `/c64-re-tools` (no trailing slash); zero `ghidra-runs` outside comments |

**LIVE reproduction, run directly by this verification** (not trusted from a
SUMMARY): `timeout 5 node resources/vice-broker.mjs --repo-root <fresh temp
dir> --dry-run` produced this stderr line before any control-listener
activity —

```
vice-broker: ghidra runs handle <tmp>/c64-re-tools -> .c64-re-tools
```

— and the filesystem after the run showed:

```
<tmp>/c64-re-tools -> .c64-re-tools   (symlink, relative target)
<tmp>/.c64-re-tools/runs/ghidra/       (physical, empty — no run occurred)
```

R1 is **VERIFIED**, both by code reading and by a live process run performed
independently during this verification.

### R2 — The symlink is created BY THE BROKER

| Check | Method | Result |
|---|---|---|
| `ensureGhidraRunsHandle()` is called from `vice-broker.mts`'s `run()` | Direct code read, `vice-broker.mts:1176` | Present, one call site |
| It runs AFTER the unconditional startup reap and BEFORE the control listener binds | Direct code read (the call sits between `reapOrphanedInstances()` at ~line 1122 and `startControlListener()` at ~line 1183) | Confirmed by reading; **also mechanically gated** by `vice-broker-supervision.test.ts`'s structural ordering predicate, which locates both anchors by name and asserts the offset comparison in both directions, with two planted-violation controls (call site removed; call site relocated after the listener) proving the predicate is not vacuous |
| A refusal never aborts broker startup | Direct code read: the call is outside any `try/catch`, and the if/else branches only `process.stderr.write(...)`, never `throw`/`return` | Confirmed; also asserted structurally (`vice-broker-supervision.test.ts`, "a Ghidra runs handle refusal is consumed into a stderr write, never a throw or an early return") |
| `readlinkSync()` inside `ensureGhidraRunsHandle()` is guarded (WR-01 fix) | Direct code read, `ghidra-project.mts` | Wrapped in `try/catch`, matching the documented "Never throws" contract at the broker call site |
| The symlink is actually created when the broker runs, before the control listener is reachable | **LIVE reproduction** (see above) | Confirmed: the handle line prints, and the symlink exists on disk, in a run this verification performed itself |

Test run performed directly: `node --test vice-broker-supervision.test.ts` →
5/5 pass, including the two R2 structural tests and their planted-violation
control.

R2 is **VERIFIED**, both by code reading, by the mechanically-gated
structural test (with non-vacuity proven by planted violations), and by a
live process run performed independently during this verification — the
strongest of the three forms of evidence available for an ordering
invariant at process startup.

### Never-repairs / refuse-by-name property

Read directly in `ensureGhidraRunsHandle()`: a real directory, a wrong-target
symlink (including an absolute target), or a plain file at the handle path
all refuse by name, naming what was found and the manual remedy, with no
unlink/replace/rename anywhere in the function. `ghidra-project.test.ts`
(53 tests, `fail 0`, run directly this session) exercises all of these cases
plus a dedicated regression test proving `resolveGhidraProject()` propagates
a handle refusal before the reservation `mkdirSync` — the exact
silent-violation hole the gap diagnosis identified.

### The live-Ghidra fragility guard

`ghidra-live.test.ts` (opt-in, `VICE_LIVE_GHIDRA_ONLY=1`) carries a positive
SYMLINK GUARD (a full import+analysis through the handle lands the project
database physically under the dotted root) and a negative control (a literal
dotted location produces no database). Per the orchestrator's measured facts,
both halves passed against real Ghidra 12.1.3 twice this run (once by the
40-09 executor, once by the code reviewer) — this verifier did not re-run the
opt-in live-Ghidra suite (it requires the 543 MiB non-vendored install and
several minutes of JVM startup), but the guard's existence, wiring, and
non-vacuity (an explicit negative control) are confirmed by direct code
reading, and the doubled independent pass record is credible corroboration
this verifier accepts rather than re-derives.

### PREP-05 requirements coverage

`REQUIREMENTS.md` marks `PREP-05` `[x]` Complete with a rider naming exactly
the mechanism confirmed above (`getAbsolutePath()`/`getCanonicalPath()`,
plans `40-08`/`40-09`/`40-10`/`40-11`, gap `G-40-1` CLOSED). This matches the
codebase evidence, not merely the claim.

**Verdict — Part 1: Gap G-40-1 is CLOSED. PREP-05 is genuinely satisfied,
independently re-derived (including one live process run), not merely
marked satisfied.**

## Part 2 — Do the three original (live) success criteria still hold?

Criterion 3 (`cartconv`/cartridge banks) remains struck out, not renumbered,
and is not scored, per the phase's own amendment and this task's instruction.

| # | Truth (ROADMAP criterion) | Status | Evidence |
|---|---|---|---|
| 1 | A user gets a named file's real sector chain, plus BAM and directory, out of a `.d64` through `c1541`, over `host_tool`, with no `spawnSync` of a host binary anywhere in the skill tree | ✓ VERIFIED (unchanged, re-confirmed) | `d64-single-route.test.ts` (7/7, run directly this session) still enforces the one `.d64` route; `c1541.test.mjs` (LIVE tier against the real binary) still passes (part of the 44/44 run below). No file in this run's `files_modified` lists touches `c1541.mjs` or the skill route. |
| 2 | A user is shown what a BASIC stub does and where it hands over, literal `SYS` resolves, computed `SYS` declines by name | ✓ VERIFIED (unchanged, re-confirmed) | `petcat.test.mjs`'s 3 LIVE cases pass (part of the 44/44 run below). Untouched by this run's plans. |
| 4 | A failure is reported as a failure, proven separately on each shipped tool, with a non-vacuous exit-status control | ✓ VERIFIED (unchanged, re-confirmed), same disclosed evidentiary limit as before | `host-tool-oracle.test.ts` (13 of the 44 below) still passes; the disclosed limit (three of six `c1541` ids' non-vacuity proof rests on a fake stand-in binary rather than the real one) is unchanged by this run and was already accepted by the owner in `40-UAT.md` test 2 (`result: pass`) — see below. |

Test run performed directly this session:
`node --test d64-single-route.test.ts host-tool-oracle.test.ts ../../skills/c64-disk-access/scripts/c1541.test.mjs ../../skills/c64-petcat/scripts/petcat.test.mjs` → **44/44 pass**, including all LIVE cases against the real installed `c1541`/`petcat` binaries.

**Verdict — Part 2: all three live success criteria still hold. No
regression was introduced by the four gap-closure plans, confirmed by direct
re-execution rather than by trusting the prior verification's numbers.**

## Disposition of the two prior human-judgment items

The prior `40-VERIFICATION.md` (`human_needed`) held two items open:

1. **"Accept or reject the Ghidra exemption as permanent."** This is the
   exact question the owner answered in `40-UAT.md` test 1 with `result:
   issue` (severity `major`) — REJECTED, generating gap `G-40-1`, which is
   now closed per Part 1 above. There is no longer an exemption to accept or
   reject: `CLAUDE.md`'s D-33 bullet now reads "There is no remaining
   exception," confirmed against the code. **Discharged.**

2. **"Confirm the fake-stand-in-binary substitution for PREP-04 is
   acceptable."** The owner already answered this directly in `40-UAT.md`
   test 2: `result: pass`. No plan in this gap-closure round touched
   `host-tool-oracle.test.ts`, `host-tool.mts`'s classifiers, or
   `findSiblingBinary()`, so the disclosed evidentiary limit (three of six
   `c1541` ids' non-vacuity proof uses a fake binary reproducing the
   DOCUMENTED general failure shape rather than each verb's own measured
   output) is unchanged from what the owner already accepted. **Discharged
   by the owner's own UAT pass, not re-litigated here.**

No new human-judgment item was introduced by plans 40-08 through 40-11: every
coverage entry across their four SUMMARYs is `human_judgment: false` (checked
directly against all four SUMMARY files), and the code review that covered
this round found 0 BLOCKER findings, 1 WARNING (fixed, commit `22c13b30`,
confirmed present in the current tree), and 1 INFO (correctly acknowledged as
a forward-looking note, not a defect — `git ls-files tools/` independently
confirmed empty by this verification).

## Required Artifacts (gap-closure round)

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/mcp/vice/ghidra-project.mts` | `ensureGhidraRunsHandle()`, `ghidraRunsRoot()`, `ghidraRunsRealRoot()`, re-pointed `resolveGhidraProject()`, corrected doc comment | ✓ VERIFIED | All present, read directly; doc comment states the measured `getAbsolutePath()`/`getCanonicalPath()` mechanism and retracts the earlier overstatement. |
| `src/mcp/vice/resources/ghidra-project.mjs` | Rebuilt, byte-identical artifact | ✓ VERIFIED | `npm run build` re-run this session; `git status --porcelain resources/` empty; `resources-sync.test.ts` passes (part of the 163/163 run below). |
| `src/mcp/vice/ghidra-project.test.ts` | Migrated off retired location/constant, handle-refusal cases added | ✓ VERIFIED | 53/53 pass; zero `ghidra-runs`/`GHIDRA_RUNS_DIR_NAME` occurrences (grep-confirmed). |
| `src/mcp/vice/vice-broker.mts` + `resources/vice-broker.mjs` | Broker mints handle, R2 ordering | ✓ VERIFIED | Confirmed by code read, structural test, AND a live process run this session. |
| `.gitignore` | One stanza, root + alias, no trailing slash on alias | ✓ VERIFIED | Confirmed by direct read; a synthetic-repo check embedded in plan 40-08's own verify (not re-run here, but the resulting stanza was independently read and matches the documented git-symlink semantics). |
| `CLAUDE.md` D-33 bullet | Corrected, "no remaining exception" | ✓ VERIFIED | Direct read confirms the correction. |
| `.planning/todos/completed/2026-09-08-guard-ghidra-symlink-project-location.md` | Closed with Resolution | ✓ VERIFIED | Present in `completed/`, absent from `pending/`; `pending/` holds 7 files, matching the measured facts. |
| `REQUIREMENTS.md` / `ROADMAP.md` / `STATE.md` bookkeeping | `PREP-05` Complete, plan counts, decision log entries | ✓ VERIFIED | All three read directly and cross-checked; consistent with each other and with the code. |

## Test Suite Results (run directly this session, not trusted from SUMMARYs)

- `npm run typecheck` (src/mcp/vice): clean.
- `node --test ghidra-project.test.ts resources-sync.test.ts host-scripts.test.ts host-tool.test.ts`: **163/163 pass**.
- `node --test vice-broker-supervision.test.ts`: **5/5 pass** (includes the two R2 structural tests + planted-violation control).
- `node --test d64-single-route.test.ts host-tool-oracle.test.ts c1541.test.mjs petcat.test.mjs`: **44/44 pass** (includes all LIVE end-to-end cases against real `c1541`/`petcat`).
- `node --test docs-deferred-ledger.test.ts audit-integrity.test.ts`: **50/50 pass**.
- `npm run build` then `git status --porcelain resources/`: empty (zero drift).
- **LIVE reproduction**: `node resources/vice-broker.mjs --repo-root <fresh temp dir> --dry-run` — confirmed the handle-mint stderr line and the resulting symlink + physical runs tree on disk, independently of any SUMMARY claim.
- Full `npm run test:automated` was NOT re-run in this verification (a live broker process was found running on this host during verification — `pgrep vice-broker` returned a PID — which per this project's own documented finding deterministically reddens `BACK-05`; re-running the full suite now would produce a misleading, non-representative result). The orchestrator's supplied measurement (3603 tests / 3589 pass / 3 fail, all in `anno-register.test.ts`, pre-existing and out of phase 40's scope) is accepted as-is; the phase-scoped test files above were re-run directly and independently, and all pass.
- `git ls-files tools/`: `0` (independently confirmed).
- `git status --porcelain`: only the five pre-existing untracked paths (`.vice-snapshots/`, `.vice-supervisor/`, `docs/dissambler-workflow.md`, `docs/vice-mcp-ideas.md`, `src/mcp/vice/.anno-cli-test-*`, `tools/`) — no new untracked handle or root.

## Requirements Coverage

| Requirement | Status | Evidence |
|---|---|---|
| PREP-01 | ✓ SATISFIED (re-confirmed, unaffected by this round) | `REQUIREMENTS.md` `[x]`; criterion 1 above. |
| PREP-02 | ✓ SATISFIED (re-confirmed, unaffected by this round) | `REQUIREMENTS.md` `[x]`; criterion 2 above. |
| PREP-03 | WITHDRAWN — not scored, per instruction | `REQUIREMENTS.md` struck through, Excluded table row present. |
| PREP-04 | ✓ SATISFIED (re-confirmed, unaffected by this round; disclosed limit owner-accepted in UAT) | `REQUIREMENTS.md` `[x]`; criterion 4 above. |
| PREP-05 | ✓ SATISFIED (this round's deliverable) | `REQUIREMENTS.md` `[x]`; Part 1 above. |

No orphaned requirements: every id declared across all eleven plans'
`requirements:` frontmatter (`PREP-01`, `PREP-02`, `PREP-03`, `PREP-04`,
`PREP-05`) is accounted for above, and `REQUIREMENTS.md`'s Traceability table
maps no other id to Phase 40.

## Anti-Patterns Found

None. Scanned every file touched by plans 40-08 through 40-11
(`ghidra-project.mts`, `resources/ghidra-project.mjs`,
`ghidra-project.test.ts`, `vice-broker.mts`, `resources/vice-broker.mjs`,
`vice-broker-supervision.test.ts`, `host-tool.mts`, `host-tool.test.ts`,
`ghidra-live.test.ts`, `.gitignore`) for `TBD`/`FIXME`/`XXX`/`HACK`/
`PLACEHOLDER` — zero hits.

## Human Verification Required

None. Both items the prior verification routed to human judgment are
discharged (see "Disposition of the two prior human-judgment items" above) —
one by owner UAT decision closing gap `G-40-1`, the other by the owner's own
prior UAT pass. No new item was introduced by this round's four plans or by
this verification's own checks.

## Gaps Summary

No must-have truth FAILED, no artifact is MISSING or a STUB, no key link is
NOT_WIRED, and no BLOCKER-level anti-pattern or debt marker was found.
Gap `G-40-1`'s two owner-stated requirements (R1: not under `tools/`; R2: the
broker mints the symlink) both hold — verified not only by reading the code
and by the project's own structural/unit tests, but by a live process run
this verification performed itself, independent of any prior claim. The
three still-live original success criteria (1, 2, 4) were re-executed
directly and show no regression. `PREP-05` is genuinely satisfied. Both
prior human-judgment items are discharged, not silently dropped. The phase
is `passed`.

---

_Verified: 2026-09-08T20:45:00Z_
_Verifier: Claude (gsd-verifier)_
