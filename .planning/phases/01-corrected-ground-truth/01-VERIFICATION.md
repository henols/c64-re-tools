---
phase: 01-corrected-ground-truth
verified: 2026-08-12T16:28:02Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
---

# Phase 1: Corrected Ground Truth Verification Report

**Phase Goal:** Every downstream plan reads protocol facts that match what the emulator actually does
**Verified:** 2026-08-12T16:28:02Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `docs/phase0-binmon-findings.md` and `docs/stock-vice-parity.md` name `RL`/`CY` as the condition-parser pseudo-registers | ✓ VERIFIED | `docs/phase0-binmon-findings.md:52-59` and `docs/stock-vice-parity.md:86-93` both name `RL`/`CY`, cite `mon_lex.l:559-560` for the `LIN`/`CYC` → `0x8f` rejection, `mon_parse.y:168` for no operator precedence, `monitor.c:1597` for hex-by-default literals |
| 2 | Neither doc asserts pause-on-demand requires a checkpoint | ✓ VERIFIED | `grep -ci "pause on demand\|pause-now\|pause model"` = 0 in `docs/roadmap-stock-vice.md`; `docs/phase0-binmon-findings.md` §4 states `monitor_startup_trap()` fires on any inbound byte (`monitor_binary.c:281`, `monitor.c:395`), "no temporary checkpoint is required" |
| 3 | Neither doc asserts `REGISTERS_GET` cannot source a stopwatch | ✓ VERIFIED | `grep -cF 'cannot be a stopwatch'` = 0; `docs/phase0-binmon-findings.md:15-19` states `REGISTERS_GET` (0x31) **does** return `LIN`/`CYC` (`mon_register6502.c:57`) and gives the reconstruction formula |
| 4 | Neither doc asserts CPU history's compile flag is the risk; both name VICE ≥ 3.10 as the real gate | ✓ VERIFIED | `grep -cF 'compile-time'` = 0 in `phase0-binmon-findings.md`; both docs contain "VICE >= 3.10"/"VICE ≥ 3.10" with the `0x83`-vs-`0x8f` distinction (`docs/phase0-binmon-findings.md:32-38`, `docs/stock-vice-parity.md:41-48,73-78`) |
| 5 | `.planning/intel/constraints.md` agrees; `CON-stopwatch-via-cpuhistory` no longer PROVISIONAL | ✓ VERIFIED | `grep -c PROVISIONAL .planning/intel/constraints.md` = 0; block carries `status: SETTLED — gated by VICE version, not a build-time compile flag` (line 108) plus a `VERSION GATE:` bullet (lines 113-119) |
| 6 | `docs/phase0-binmon-findings.md` section 4 names five unsolicited event types, not three | ✓ VERIFIED | Section 4 (lines 76-91) names `STOPPED`, `RESUMED`, `JAM` (zero-length body), `CHECKPOINT_INFO` (0x11), `REGISTER_INFO` (0x31), plus the shared-response-type/demux hazard |
| 7 | `probe-binmon.mjs` has been run against a real stock `x64sc -binarymonitor` and output recorded in the repo | ✓ VERIFIED | `docs/phase1-probe-results.md` records a run against `/usr/bin/x64sc` (stock VICE 3.9.0.0) and `/usr/local/bin/x64sc` (barryw fork 3.10.0.0), both raw transcripts pasted verbatim; probe process cleanup confirmed (`pgrep -x x64sc` empty, `ss -ltn` shows neither 6502 nor 6503 listening — reconfirmed live during this verification) |
| 8 | Recorded output states api version, VICE version quad, `CPUHISTORY_GET` `0x83`-vs-`0x8f` outcome, `DISPLAY_GET` geometry, `PALETTE_GET` entry count, and observed unsolicited event sequence, for both binaries | ✓ VERIFIED | `docs/phase1-probe-results.md:23-38` summary table has one row per field, one column per build, all filled from the captures. Stock 3.9 column: `api_version=0x2`, `3.9.0.0`, `CPUHISTORY_GET → INVALID_TYPE (0x83)`, geometry `dw=504 dh=312 xo=136 yo=51 iw=320 ih=200 bpp=8`, `16` palette entries, full arrow-joined event sequence. Fork column likewise filled, explicitly labelled "not stock" throughout, with the aborted-session event sequence honestly reported rather than left blank |
| 9 | Each of the five UNVERIFIED items is answered or recorded as an accepted unknown with "what breaks if wrong" | ✓ VERIFIED | `docs/phase1-probe-results.md:44-120`: item 1 RESOLVED (both builds); item 2 RESOLVED (stock 3.9, exactly as originally scoped in `01-RESEARCH.md`); item 3 RESOLVED (stock 3.9, silent no-op); item 4 split — acceptance/firing RESOLVED (both builds), `$D012` phase-offset half ACCEPTED UNKNOWN with verbatim "what breaks" text (GAIN-06 tools "systematically off by a fixed cycle count"); item 5 RESOLVED with an honest caveat about sample-coordinate choice. Fork-as-3.10 gap given its own ACCEPTED UNKNOWN subsection with a stated consequence |
| 10 | `docs/roadmap-stock-vice.md` no longer claims pause-on-demand needs a workaround; names the full unsolicited event set | ✓ VERIFIED | All three original occurrences corrected (lines 61-62→72-77, 86→96-99, 111→129); `grep -ci "pause on demand\|pause-now\|pause model"` = 0; event set at lines 101-105 names all five opcodes plus the demux hazard; wire-framing paraphrase corrected to include `api_version` |
| 11 | `01-VALIDATION.md` signed off and its broken DOC-03 gate fixed | ✓ VERIFIED | `status: approved`, `nyquist_compliant: true`, `wave_0_complete: true` in frontmatter; no `⬜ pending` rows; `-A2` assertion replaced with the stronger whole-file `grep -c PROVISIONAL` (row documents the original bug) |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `docs/phase0-binmon-findings.md` | Corrected §1/§4 findings, RL/CY, five events, no compile-flag framing | ✓ VERIFIED | All acceptance-criteria greps from 01-01-PLAN.md re-run and pass; empirical-step section points at `phase1-probe-results.md` |
| `docs/stock-vice-parity.md` | RL/CY named, A.3 removed as a loss, A.5/B.1 version-gated | ✓ VERIFIED | On-demand pause retired from losses list with an explicit contiguous-renumbering note (line 15-18); A.5→item 4, B.1→item 1 both version-gated |
| `.planning/intel/constraints.md` | Four rewritten blocks, SETTLED, no PROVISIONAL/OUTSTANDING | ✓ VERIFIED | `CON-stopwatch-via-cpuhistory` SETTLED, `CON-no-monotonic-cycle-register` no longer denies stopwatch role, `CON-no-pause-now-opcode` renamed to `CON-inbound-byte-halts-machine` with no dangling reference, `CON-async-event-demux` lists five types, `CON-probe-outstanding` renamed `CON-probe-resolved` (RESOLVED) |
| `docs/roadmap-stock-vice.md` | Pause model + event coverage fully corrected | ✓ VERIFIED | Status banner dated 2026-08-12, all three pause occurrences fixed, framing paraphrase corrected |
| `.claude/mcp/vice/probe-binmon.mjs` | Extended probe, 1000 lines, `--selftest`, 13 numbered checks | ✓ VERIFIED | `wc -l` = 1000 (min_lines 400 required); `--selftest` passes offline with no socket; checks 1-13 present, each independently try/catch-wrapped; `node --check` clean |
| `docs/phase1-probe-results.md` | Recorded empirical run, 353 lines | ✓ VERIFIED | `wc -l` = 353 (min_lines 80 required); contains `PALETTE_GET`, `CPUHISTORY_GET`+`0x83`, `DISPLAY_GET`, `api_version`, ≥6 RESOLVED/ACCEPTED UNKNOWN markers, both build paths named |
| `.planning/phases/01-corrected-ground-truth/01-VALIDATION.md` | Signed off | ✓ VERIFIED | `status: approved`, checklist complete, no `pending` markers |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `docs/phase0-binmon-findings.md` | VICE source citations | inline citation on every corrected claim | ✓ WIRED | `mon_lex.l:559-560`, `monitor_binary.c:281/384-394`, `monitor.c:395/1597`, `mon_register6502.c:57`, `mon_parse.y:168` all present and attached to the claims they support |
| `docs/stock-vice-parity.md` B.1 | VICE ≥ 3.10 version gate | explicit caveat | ✓ WIRED | Line 73: "it requires **VICE >= 3.10**" |
| `.planning/intel/constraints.md` `CON-stopwatch-via-cpuhistory` | VICE ≥ 3.10 gate + 0x83/0x8f distinction | `VERSION GATE:` bullet | ✓ WIRED | Lines 113-119 |
| `.planning/intel/constraints.md` `CON-async-event-demux` | Phase 2 PROTO-03 | five named event opcodes incl. 0x11/0x31 | ✓ WIRED | Lines 142-152 |
| new probe checks | existing `BinMon`/`encode()` | `mon.send(cmdType, body)` | ✓ WIRED | All 13 checks call `mon.send(CMD.X, bodyBuilder(...))`; no second framing implementation; single `node:net` import confirmed |
| `CONDITION_SET` check | `CHECKPOINT_INFO` (0x11) event path | `RESP_NAME` extension + `parseCheckpointInfo` | ✓ WIRED | Check 10 reads `hitCount` via `parseCheckpointInfo`; `_onData` demuxes 0x11/0x31 by request-id, never resolving a pending request with an event |
| `docs/phase0-binmon-findings.md` | `docs/phase1-probe-results.md` | rewritten empirical-step section | ✓ WIRED | "The empirical probe has been run — see docs/phase1-probe-results.md" section links the file and states outcomes |
| `.planning/intel/constraints.md` `CON-probe-resolved` (was `CON-probe-outstanding`) | `docs/phase1-probe-results.md` | `status: RESOLVED — see ...` | ✓ WIRED | Line 192 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Probe self-test proves wire encoders/parsers offline | `node .claude/mcp/vice/probe-binmon.mjs --selftest` | `SELFTEST PASS - all wire body builders and response parsers verified offline`, exit 0 | ✓ PASS |
| Doc-correction grep gates from all four plans | full set of `grep -c`/`grep -l` assertions from 01-01/01-02/01-03/01-04 plans, re-run live | all pass (see gap-check narrative below) | ✓ PASS |
| No leftover emulator process/listening port | `pgrep -x x64sc`; `ss -ltn \| grep -E ':(6502\|6503) '` | empty / `0` | ✓ PASS |
| Non-regression backstop (automatable subset) | `node --test` on all `*.test.*` files excluding `broker-e2e`, `vice-broker-launch`, `vice-proxy` (documented as stalling outside a devcontainer, tracked as accepted debt) | `# tests 299 / # pass 294 / # fail 0 / # todo 5` | ✓ PASS |
| No debt markers introduced | `grep -nE "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across all 7 phase-modified files | no matches | ✓ PASS |

Note on the full `npm test` run: the unfiltered command hangs (matches the documented, user-accepted `.planning/todos/pending/2026-08-12-vice-broker-tests-stall-outside-devcontainer.md`), so it was run with the three known-stalling files excluded, per the verification context's explicit instruction not to treat that as a phase gap. The 294/0 pass count matches `01-REVIEW.md`'s claim exactly.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| DOC-01 | 01-01 | `phase0-binmon-findings.md` no longer asserts pause/stopwatch/compile-flag errors; names VICE ≥ 3.10 | ✓ SATISFIED | Truths 2-4 above |
| DOC-02 | 01-01 | Both docs name `RL`/`CY` | ✓ SATISFIED | Truth 1 above |
| DOC-03 | 01-02, 01-04 | `constraints.md` reflects corrected findings, `CON-stopwatch-via-cpuhistory` no longer PROVISIONAL | ✓ SATISFIED | Truth 5, 11 above |
| VERIF-01 | 01-03, 01-04 | Probe run against real stock VICE, results recorded | ✓ SATISFIED | Truths 7-8 above |
| VERIF-04 | 01-03, 01-04 | Five UNVERIFIED items resolved or accepted-unknown | ✓ SATISFIED | Truth 9 above |

All five requirement IDs declared in phase plan frontmatter (`01-01`: DOC-01, DOC-02; `01-02`: DOC-03, DOC-01; `01-03`: VERIF-01, VERIF-04; `01-04`: VERIF-01, VERIF-04, DOC-03) are present in `.planning/REQUIREMENTS.md`'s traceability table, all mapped to Phase 1 exclusively. No orphaned requirements: `grep -n "Phase 1" .planning/REQUIREMENTS.md`'s traceability rows list exactly DOC-01, DOC-02, DOC-03, VERIF-01, VERIF-04 — matching the five IDs given in this verification's scope, no extra Phase-1-mapped ID is unclaimed by any plan.

Note: `.planning/REQUIREMENTS.md`'s checkbox list (lines 14-16, 114, 117) and its traceability `Status` column (lines 155-157, 219, 222) still read "Pending"/unchecked for these five IDs. This mirrors every other requirement in the file (all 68 rows read "Pending" regardless of phase-completion state), so it is a project-wide convention of not updating this file per-phase rather than a Phase-1-specific gap — ROADMAP.md is the source of truth for phase completion and correctly shows Phase 1 checked off. Not counted as a gap.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any of the seven phase-modified files. No overcorrection markers (`grep -ciE 'cpu history is (now )?(unnecessary|no longer needed|redundant)'` = 0). No re-quoted removed wording anywhere (all "gate hygiene constraint" negative-assertion greps pass). The one known code defect (CR-01 in `01-REVIEW.md`, non-exception-safe checkpoint cleanup) was found by an independent code review and fixed in commit `bfee49b`, verified present in the current `probe-binmon.mjs` (checks 9 and 10 both use `finally` blocks for cleanup, confirmed by direct reading).

### Human Verification Required

None. Every truth in this phase was verifiable by direct file inspection, grep, running `--selftest`, and confirming process/port cleanup — no visual, real-time, or subjective-quality judgment was required. The plan-level `<human-check>` verification steps (reading the corrected docs end-to-end for coherence, confirming the recorded dispositions are honest) were performed directly during this verification pass (see Goal Achievement narrative above and the two adjudicated notes below) rather than deferred.

### Judgment calls requested by the verification brief

**On criterion 3 ("a real stock x64sc"):** The stock-3.9 half (`/usr/bin/x64sc`, Debian-packaged, unmodified) fully satisfies criterion 3 on its own — every required field (api version, version quad, `CPUHISTORY_GET` 0x83/0x8f, `DISPLAY_GET` geometry, `PALETTE_GET` count, event sequence) is present and correctly attributed to that build. The document is honest and unambiguous that the 3.10 column comes from the barryw fork, not a stock 3.10 build — this is stated in the header table, every summary-table column header, the "Fork-as-3.10 accepted unknown" section, and even the raw-output section headers. No claim anywhere asserts fork behavior as stock-3.10 behavior. **Verdict: criterion 3 is met.**

**On the WR-01 `PC=` mislabeling in the raw transcripts:** The verbatim transcripts do contain 30 fabricated-looking `PC=` values for `REGISTER_INFO`/`CHECKPOINT_INFO` events, produced by a probe bug present at capture time. This does not weaken any of the document's actual dispositions: every RESOLVED/ACCEPTED UNKNOWN conclusion in the summary table and the five-item section is derived from event *type names* (which were always correctly demultiplexed and printed) and from the explicit numbered-check result lines (e.g. `hitCount=1 FIRED`, `8-byte: OK 9-byte(+memspace): OK`), never from the mislabeled `PC=` values themselves. The correction note preceding the raw output is prominent, precise (it gives the exact correct decode for both mislabeled fields), and explains why the transcript was preserved rather than silently edited — altering a verbatim capture to show output the tool never produced would itself be a ground-truth violation. The underlying probe bug (WR-01) was found by code review and fixed in the shipped script, so no future run will reproduce it. **Verdict: this is an acceptable, well-disclosed resolution and does not leave criterion 3 unmet.**

**On criterion 4's items 2/3 stock-3.9-only data:** Both items are dispositioned **RESOLVED**, not ACCEPTED UNKNOWN, despite lacking a fork-3.10 data point. This is correct rather than a gap: `01-RESEARCH.md`'s original UNVERIFIED-item table (item 2: "...on VICE 3.9"; item 3 gated on stock TDE precondition) scoped both items specifically to VICE 3.9, and the probe run answers exactly that scope on stock 3.9 with concrete evidence (`Drive8TrueEmulation int=1`, `MEM_SET` byte unchanged). The results document is explicit and honest about the missing fork data point for both items and states the causal chain (item 4's check-10 anomaly aborting the fork session before checks 11-13 ran) rather than omitting it. Since neither item's original scope required fork corroboration, there is no unstated "what breaks if wrong" gap here — the fork gap for these two items is disclosed as a fact about the run, not hidden as an unresolved assumption. **Verdict: honest and complete as scoped.**

### Gaps Summary

No gaps. All 11 observable truths verified against the actual codebase (not SUMMARY claims), all 7 required artifacts exist and are substantive (well above stated minimum sizes) and wired, all 8 key links confirmed by direct source reading, all 5 requirement IDs traced and satisfied, no anti-patterns or debt markers found, and the previously-identified code review findings (1 critical + 4 warning + 3 info) are confirmed fixed in the current file state, not merely claimed fixed. The phase goal — "every downstream plan reads protocol facts that match what the emulator actually does" — is achieved: the two normative documents, the derived constraints file, and the ADR all agree with each other and with an actual empirically-recorded probe run against real VICE builds, and every known discrepancy between claim and evidence (the fork-vs-stock-3.10 gap, the WR-01 mislabeling, the checkpoint-flood anomaly) is disclosed rather than hidden.

---

*Verified: 2026-08-12T16:28:02Z*
*Verifier: Claude (gsd-verifier)*
