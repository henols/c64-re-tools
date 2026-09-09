---
phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
verified: 2026-09-09T22:20:16Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "CR-02 (io's per-address chip-degradation classification served from a binary-wide capability cache) closed by plan 42-15: `textCapabilityVerdictFor()` (a pure verdict builder with no dial, no cache read, no cache write) added to `text-capability-probe.ts`; `handleIoRegisters` (text-tools.ts) rewired to build its verdict from the response it itself just dialed, and no longer calls `probeTextCapability` at all; `NEVER_CACHED_COMMANDS` (frozen, sole member \"io\") structurally excludes `io` from the cache's write path, read path, and in-flight-dial memo. Independently re-confirmed against current source by this verification, not trusted from SUMMARY prose."
    - "Both of CR-02's reachable wrong-answer directions verified non-vacuous by this verification directly: production code was reverted to the pre-42-15 commit (bbdf4958^) with the current test files left in place, and both `handleIoRegisters (CR-02, direction a)` and `(direction b)` cases were independently reproduced FAILING with the exact assertion text the SUMMARY quotes, then the tree was restored (confirmed clean via `git status --short`) and the same cases pass on HEAD."
    - "The fix proven live against genuine stock VICE 3.9, independently re-run by this verification (not merely read from the SUMMARY): `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test text-monitor-live.test.ts` -- 9/9 pass, and the MEASURED log line for the CR-02 two-address control (`first=\"io $d020\", second=\"io $dc00\", fromCache=false, secondParseOutcome=unsupported-chip`) matches the citation record byte-for-byte. Clean teardown independently confirmed after the run (no vice-broker/x64sc process, no surviving /tmp/text-monitor-live-* scratch directory)."
    - "PARSE-04 returned to Complete in REQUIREMENTS.md on a scoped 2-line diff (commit 908a76a4) -- PARSE-01/02/03 byte-identical, confirmed by this verification's own `git show` of that commit."
    - "The CR-02 disposition record closed (moved from .planning/todos/pending/ to completed/ with a Resolution section) and STATE.md's Deferred Items ledger corrected in the same round (8 -> 7 pending), confirmed by this verification: 7 files present under pending/, matching the ledger's own stated count."
  gaps_remaining: []
  regressions: []
coincidental_reliance_items: []
human_verification: []
---

# Phase 42: The Text-Format Parsers and Their Two-Binary Fixtures Verification Report

**Phase Goal:** Five human-formatted text outputs become structured data behind exactly one owning module each — with `memmapshow`'s execute bit preserved as its own bit for RAM and ROM alike, so a code-versus-data answer derived from real execution exists as data rather than as text — and an unrecognised value fails loudly instead of being absorbed into a plausible-looking wrong answer.

**Verified:** 2026-09-09T22:20:16Z
**Status:** passed
**Re-verification:** Yes — third verification of this phase, after gap-closure round 2 (plans 42-15, 42-16), which targeted CR-02 alone.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `memmapshow` gives a per-address access map where execute is its own bit, RAM and ROM alike (Criterion 1, PARSE-01) | ✓ VERIFIED | Unchanged by rounds 1–2. `textmon-memmap.ts` declares `execute: boolean` independent of `read`/`write`. No source file for this criterion touched in round 2 (confirmed: `git diff e5beed69..c8b83078 --stat` touches only `text-capability-probe.ts`, `text-tools.ts`, and their test files plus `text-monitor-live.test.ts`). ROM-execute proven from a real capture; RAM-execute exercised by a declared-synthetic case (accepted scope, disclosed, not scored as a gap). |
| 2 | `prof flat`, `chis`, `bt`, `io` return structured results, `chis` per-entry cycle counts MEASURED on 3.9 (Criterion 2, PARSE-02) | ✓ VERIFIED | Unchanged by round 2; not a file this round touched (memmapshow/chis/bt/prof-flat handlers independently re-read this run at `text-tools.ts:301,424,476,552` — all four still call `probeTextCapability` normally, untouched by the CR-02 fix). Live-reconfirmed by this verification's own run of `text-monitor-live.test.ts` (chis entries=20, cycle range printed; prof flat rows=3; bt chain depth=2). |
| 3 | Each format has exactly one owning module, asserted structurally (Criterion 3, PARSE-03) | ✓ VERIFIED | Unchanged by round 2. `textmon-seam.test.ts` re-run by this verification as part of the nine-file sweep: 287/287 pass (no shrink from the 149/246 floors prior rounds recorded). |
| 4 | A drifted format fails loudly instead of a plausible-looking wrong answer, for all five formats (Criterion 4, PARSE-03) | ✓ VERIFIED | Unchanged by round 2 (CR-01/WR-02 closed in round 1, re-confirmed there; not touched by this round's diff). |
| 5 | A missing build capability is named per command and per binary; a user is never handed a silent empty result or a parse error that reads like a bug in this project (Criterion 5, PARSE-04) | ✓ VERIFIED | **CR-02 closed.** `handleIoRegisters` (`text-tools.ts:649`) no longer calls `probeTextCapability` at all — confirmed by direct source read: it builds its verdict via `textCapabilityVerdictFor({ command: "io", response, identity, ... })`, a pure function with no dial/cache-read/cache-write (`text-capability-probe.ts:427-444`). `NEVER_CACHED_COMMANDS` (frozen, sole member `"io"`, `text-capability-probe.ts:154`) is checked in `runProbe()`'s `cacheable` predicate (write path, line ~474), in `probeTextCapability()`'s pre-cache-read early return (read path, line ~516), and that same early return also skips the `inFlightProbes` memo (concurrency path). This verification independently reverted production code to the pre-fix commit (`bbdf4958^`) with current tests in place and reproduced BOTH CR-02 controls failing with the exact assertion text the SUMMARY records, then restored the tree (clean `git status`) and confirmed both pass on HEAD. The fix was further independently proven live against genuine stock `/usr/bin/x64sc` (VICE 3.9) by this verification's own run of `text-monitor-live.test.ts` (9/9 pass, `fromCache=false` on the second `io` dial, second reply's outcome `unsupported-chip` — distinct from the first dial's VIC-II decode, so the control is non-vacuous). Clean teardown independently confirmed. |

**Score:** 5/5 truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/mcp/vice/text-capability-probe.ts` | `textCapabilityVerdictFor()`, `NEVER_CACHED_COMMANDS`, `runProbe()` refactored onto the shared builder | ✓ VERIFIED | Confirmed by direct source read: single verdict-construction site (`runProbe` calls `textCapabilityVerdictFor`), `NEVER_CACHED_COMMANDS` wired at write/read/in-flight sites |
| `src/mcp/vice/text-tools.ts` | `handleIoRegisters` classifying its own fresh reply, no `await probeTextCapability` remaining in its body | ✓ VERIFIED | Confirmed: handler body calls `textCapabilityVerdictFor`, zero `probeTextCapability` calls in `handleIoRegisters`; the other four handlers (`handleMemmapShow`, `handleCpuHistory`, `handleProfileFlat`, `handleBacktrace`) are unchanged and still call `probeTextCapability` normally |
| `src/mcp/vice/text-capability-probe.test.ts` | Double-call/two-different-responses, never-cached, concurrency, and encoding controls | ✓ VERIFIED | 45 tests pass in this file alone (independently re-run); the relevant CR-02 cases confirmed present by name in test output |
| `src/mcp/vice/text-tools.test.ts` | Direction-(a)/(b) end-to-end handler controls under a resolved, agreeing identity | ✓ VERIFIED | 50 tests pass in this file alone (independently re-run); `handleIoRegisters (CR-02, direction a)` and `(direction b)` both present and passing |
| `src/mcp/vice/text-monitor-live.test.ts` | Two-address `io` control inside the existing five-format live case | ✓ VERIFIED | Independently re-run against genuine stock VICE 3.9 by this verification: 9/9 pass, MEASURED log line matches the citation record exactly |
| `.planning/todos/completed/2026-09-09-io-degradation-probe-cached-under-a-binary-wide-key.md` | CR-02 disposition closed with a Resolution section | ✓ VERIFIED | Present; corresponding `pending/` copy absent |
| `.planning/STATE.md` | Deferred Items ledger corrected (8 → 7 pending, io-degradation row removed) | ✓ VERIFIED | 7 files under `.planning/todos/pending/`, matching the ledger's stated "7 open" |
| `.planning/REQUIREMENTS.md` | `PARSE-04` returned to Complete, `PARSE-01..03` untouched | ✓ VERIFIED | `git show 908a76a4 -- .planning/REQUIREMENTS.md` shows exactly a 2-line diff (checkbox + traceability row); current file has all four PARSE-01..04 marked Complete |
| `docs/phase42-text-format-drift-citations.md` | Round-2 evidence blocks (22–24) with the defect, both remedies, and the live measurement | ✓ VERIFIED | Present, read in full, content matches the independently-reproduced test evidence |
| `src/mcp/vice/tools-manifest.json` | `vice_io_registers`'s `inputSchema` byte-unchanged by the internal wiring fix | ✓ VERIFIED | No diff present against this file at HEAD; the fix touches no schema/argument-validation code |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `text-tools.ts` (`handleIoRegisters`) | `text-capability-probe.ts` (`textCapabilityVerdictFor`) | called synchronously on the response the handler itself just dialed | ✓ WIRED (CR-02 fixed) |
| `text-tools.ts` (`handleIoRegisters`) | `text-capability-probe.ts` (`probeTextCapability`) | **absent** — confirmed zero occurrences inside the handler body | ✓ CORRECTLY UNWIRED (this is the fix — the handler must no longer reach the memoised entry point) |
| `text-capability-probe.ts` (`runProbe`) | `text-capability-probe.ts` (`textCapabilityVerdictFor`) | single verdict-construction site, reused by the cache-owning caller | ✓ WIRED |
| `text-capability-probe.ts` (`probeTextCapability`) | `NEVER_CACHED_COMMANDS` | early-return check before cache-read and before `inFlightProbes` registration | ✓ WIRED |
| `text-tools.ts` (`handleMemmapShow`/`handleCpuHistory`/`handleProfileFlat`/`handleBacktrace`) | `text-capability-probe.ts` (`probeTextCapability`) | unchanged, still memoised/cached | ✓ WIRED (unaffected by this round's fix — regression-checked) |

### Behavioral Spot-Checks / Test Execution (all independently run by this verification, not read from SUMMARY.md)

| Check | Command | Result | Status |
|---|---|---|---|
| CR-02 non-vacuity: revert production code to `bbdf4958^`, keep current tests | `node --test text-tools.test.ts` | Direction (a) fails with the exact quoted `AssertionError` text; direction (b) fails with the exact quoted mismatch text; tree restored, confirmed clean | ✓ PASS — controls proven genuinely red on pre-fix code |
| CR-02 fix at HEAD | `node --test text-capability-probe.test.ts text-tools.test.ts` | tests 95, pass 95, fail 0 | ✓ PASS |
| Four-file set (memmapshow's structural family) | `node --test docs-deferred-ledger.test.ts docs-review-disposition.test.ts docs-dangling-refs.test.ts docs-linerefs.test.ts comment-phase-pointers.test.ts shipped-modules.test.ts` | tests 63, pass 63, fail 0 | ✓ PASS |
| Nine-file phase-42 module sweep | `node --test textmon-memmap.test.ts textmon-cpuhistory.test.ts textmon-backtrace.test.ts textmon-profile.test.ts textmon-registers.test.ts textmon-seam.test.ts text-capability-probe.test.ts text-protocol.test.ts text-tools.test.ts` | tests 287, pass 287, fail 0 | ✓ PASS (no shrink from documented floor) |
| Typecheck | `npm run typecheck` | exit 0, no `error TS` | ✓ PASS |
| Live proof against genuine stock VICE 3.9 (MANUAL_ONLY, `/usr/bin/x64sc`) | `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test text-monitor-live.test.ts` | tests 9, pass 9, fail 0; CR-02 log line: `first="io $d020", second="io $dc00", fromCache=false, secondParseOutcome=unsupported-chip` | ✓ PASS — matches citation record byte-for-byte |
| Teardown after live run | `ps -eo pid,args \| grep -E 'vice-broker\.mjs\|/x64sc' \| grep -v grep`; `ls -d /tmp/text-monitor-live-*` | both empty | ✓ PASS — no leftover process or scratch directory |
| Environment precheck (per project memory: a live broker reddens `BACK-05` deterministically) | `pgrep -af '[v]ice-broker\|[x]64sc'` | empty before every gate run in this session | ✓ PASS |
| Full automated gate (orchestrator-measured, reproduced across 3 runs per the task brief) | `npm run test:automated` | tests 3954, suites 24, pass 3940, fail 3, skipped 6 — failures confined to `anno-import.test.ts`/`anno-register.test.ts` (documented pre-existing STORE-06 floor) | ✓ PASS — no phase-42 regression. Note: `test:automated` deliberately skips 12 `MANUAL_ONLY_TESTS`, of which `text-monitor-live.test.ts` is one; that exclusion is disclosed here, not hidden, and this verification independently ran that excluded file live to close the gap. |
| `git diff -- tools-manifest.json` | manual | empty | ✓ PASS |

Note on `npm test` (bare, full glob): per documented project knowledge this hangs on `vice-proxy.test.ts` and was never run.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| PARSE-01 | 42-01, 42-09, 42-12, 42-14 | `memmapshow` execute-as-own-bit access map | ✓ SATISFIED | Unchanged by round 2; REQUIREMENTS.md marks Complete, matches evidence |
| PARSE-02 | 42-02, 42-03, 42-04, 42-07, 42-09, 42-12, 42-13, 42-14 | Four structured-result parsers | ✓ SATISFIED | Unchanged by round 2; REQUIREMENTS.md marks Complete, matches evidence |
| PARSE-03 | 42-01, 42-02, 42-03, 42-06, 42-08, 42-09, 42-10, 42-11, 42-14 | One owning module per format; ≥2-binary fixtures; drift refuses loudly | ✓ SATISFIED | Unchanged by round 2; REQUIREMENTS.md marks Complete, matches evidence |
| PARSE-04 | 42-05, 42-06, 42-07, 42-09, 42-10, 42-13, 42-14, 42-15, 42-16 | Missing capability named per command/binary, never silent/misleading | ✓ SATISFIED | CR-02 closed by 42-15/42-16, independently re-verified against source, against a genuine pre-fix revert, and live against real stock VICE by this verification. REQUIREMENTS.md flip is a scoped 2-line diff (commit 908a76a4). |

No orphaned requirements: PARSE-01..04 are declared across the 16 plans' frontmatter and REQUIREMENTS.md's Phase 42 mapping matches exactly (128–131).

### Anti-Patterns Found

None in the round-2 diff. `TBD`/`FIXME`/`XXX` search across the four files this round modified (`text-capability-probe.ts`, `text-capability-probe.test.ts`, `text-tools.ts`, `text-tools.test.ts`) returns no matches. No debt markers, no placeholder returns, no hardcoded-empty stubs in the CR-02 fix path.

The round-2 code review (`42-REVIEW.md`, depth `standard`, 30 files, `status: clean`, 0 findings of any severity) independently re-derived CR-02's resolution from source rather than from the SUMMARYs, and this verification's own independent source read and revert-and-reproduce exercise reaches the same conclusion by an independent method.

### Human Verification Required

None. All five Success Criteria resolve to codebase-and-test evidence; the one item that genuinely requires a live emulator (Criterion 5's `io` cache-staleness proof) was independently re-run against real stock VICE 3.9 by this verification, not merely read from a prior run's transcript.

### Gaps Summary

None. All five Success Criteria are verified, all four requirement IDs (PARSE-01..04) are satisfied and correctly marked Complete in REQUIREMENTS.md, and the CR-02 defect that blocked round 2's predecessor verification is closed — independently re-confirmed by this verification through three separate methods: (1) direct source read of the fix's three sites (pure builder, cache write/read/in-flight exclusion), (2) reproducing both planted controls FAILING against a genuinely reverted pre-fix tree and then passing on HEAD, and (3) an independent live run against genuine stock `/usr/bin/x64sc` (VICE 3.9) reproducing the exact MEASURED evidence the citation record claims, with clean teardown confirmed.

Declared accepted-scope exclusions carried forward unchanged from prior rounds (none of these bear on any Success Criterion and are not gaps): the two `42-VALIDATION.md` manual-only items (no `--disable-cpuhistory` build on this host; `io`'s two degradation strings remain source-traced rather than live-observed — note this verification's live run hit the distinct `unsupported-chip` chip-gate path, not either degradation string, so this exclusion remains genuinely untouched); the RAM-execute hardware evidence (still 0/1565); IN-02's behavioural half (decimal-separator consistency, deliberately left as documentation-only); `42-VALIDATION.md`'s own draft/pending-approval status (belongs to `/gsd-validate-phase 42`); and the absence of any tool in this tree that can start VICE's profiler (`.planning/WINDOWS.md` #55).

---

_Verified: 2026-09-09T22:20:16Z_
_Verifier: Claude (gsd-verifier)_
