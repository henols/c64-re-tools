---
phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
verified: 2026-09-09T21:15:00Z
status: gaps_found
score: 4/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "Criterion 4 (PARSE-03): io decoded-prose section no longer casts an unchecked Partial<IoDecodedState> -- REQUIRED_IO_DECODED_KEYS completeness check added, refuses `incomplete-decoded-state` naming absent fields, proven by textmon-registers.test.ts and a source-derived interface-census test (CR-01, closed by plan 42-10)."
    - "WR-02 (chip-mismatch reply worded as malformed VIC-II reply) closed: a CIA/SID address inside io's own advertised range now refuses by chip name (`unsupported-chip`) instead of reading as a defective VIC-II dump (plan 42-11)."
    - "WR-01 (dropped binary-identity disagreement) closed: textCapabilityIdentityWarning() now reaches all five text-tool handlers, on both the success and refusal paths, published as an optional (never required) identityWarning field (plan 42-13)."
    - "Criterion 5's prof-flat cold-state misleading-message finding closed: the cold 'No profiling data available' reply is now a named profiling-not-started refusal code, not a generic parse-failure wrapper (plan 42-13)."
    - "42-09's broker-teardown verification method corrected: the harness now tracks the broker's own pid, sweeps for scratch-scoped strays, and asserts scratch-directory removal, with an unskipped planted control proving the assertion can fail (plan 42-12, G5)."
    - "Automated-gate regression (2 extra failures beyond the documented floor of 3) resolved: re-measured at 3941 tests / 3927 pass / 3 fail, independently re-run by this verification -- matches the documented anno-import/anno-register floor exactly, no new failing file."
  gaps_remaining:
    - "CR-02 (new, found by the post-round code review, NOT one of the five original gaps this round targeted): handleIoRegisters caches io's per-address chip-degradation classification under a binary-wide key ('io' literal), so a later call to a different address is silently judged on an earlier call's cached response -- confirmed by direct source read, not just trusting 42-REVIEW.md. This falsifies Success Criterion 5 for the io tool and is unfixed as of this verification."
  regressions: []
gaps:
  - truth: "A missing build capability is named per command and per binary, and a user is never handed a silent empty result or a parse error that reads like a bug in this project (Success Criterion 5, PARSE-04)."
    status: failed
    reason: >-
      Confirmed by direct source read, independently of 42-REVIEW.md's CR-02 finding text:
      handleIoRegisters (text-tools.ts:625) calls `probeTextCapability({ command: "io", identity,
      brokerIdentity, dial: async () => response })` with the LITERAL string "io" as the cache
      key's command component, never the address-specific command it actually dialed
      (`built.command`, e.g. "io $d020"). probeTextCapability() (text-capability-probe.ts:415-444)
      caches strictly on `(textCapabilityCacheKey(identity), command)` and on a cache hit returns
      the stored verdict WITHOUT ever invoking `dial()` (:427-429). Because `io`'s classification
      of "capable" is per-call, per-address content (this project's own CLAUDE.md: "one degrades
      per-chip at runtime instead of refusing"), not a binary-wide build property the way
      memmapshow/chis capability is, caching it under a binary-wide key produces two independently
      reachable wrong answers documented in full in 42-REVIEW.md's CR-02: (a) a FIRST io call that
      happens to hit a degrading chip poisons the cache, so a LATER call to a perfectly healthy
      chip (e.g. $D020/VIC-II) gets its real register dump silently discarded and replaced with a
      refusal claiming "the chip has nothing to report here" -- a plausible-looking WRONG answer,
      not a disclosed missing-capability message; (b) the inverse -- a first call caches
      "capable" from a real dump, and a later call to a genuinely degrading chip has its
      degradation missed by the stale cached verdict, falls through to the parser, which
      correctly returns a named refusal code, but handleIoRegisters' generic wrapper renders it
      as "io's response could not be parsed" -- exactly the "reads like a bug in this project"
      failure mode Criterion 5 exists to prevent. This is reachable in production (any session
      probing more than one chip/address with vice_io_registers), confirmed untested
      (text-capability-probe.test.ts has no test calling probeTextCapability twice for "io" under
      one identity with two different responses; text-tools.test.ts's handleIoRegisters tests
      never populate resolvedBinaryPath, so the cache path is structurally unexercised by the
      existing suite), and unfixed as of this verification. It is properly dispositioned as an
      open, pending todo (.planning/todos/pending/2026-09-09-io-degradation-probe-cached-under-a-
      binary-wide-key.md, severity major) with a matching STATE.md Deferred Items row -- so the
      project's process guards are honestly green -- but disposition-as-deferred is not the same
      as the criterion being met, and REQUIREMENTS.md/ROADMAP.md marking PARSE-04 Complete is
      premature against this evidence.
    artifacts:
      - path: "src/mcp/vice/text-tools.ts"
        issue: "handleIoRegisters (line 625) probes capability with the literal command \"io\" instead of the address-specific built.command, so the capability-probe cache (keyed on command) is shared across every address dialed against one binary."
      - path: "src/mcp/vice/text-capability-probe.ts"
        issue: "runProbe()'s cacheable check (line 383) treats io's verdict as cacheable on the same terms as memmapshow/chis's genuine binary-wide build capability, though io's outcome is per-call content, not a binary property."
    missing:
      - "Either never cache \"io\" in probeTextCapability's cacheable check (io's capable verdict is not a property of the binary), or bypass the cache entirely for io's chip-degradation check and re-classify the fresh response on every call, independent of the probe's cached verdict."
      - "A text-capability-probe.test.ts case that calls probeTextCapability twice for \"io\" under the SAME resolved identity with two DIFFERENT responses (one real dump, one degradation string) and asserts the SECOND call's degradation detection reflects the SECOND response, not the first."
deferred:
  - truth: "The two manual-only verifications from 42-VALIDATION.md (a genuinely --disable-cpuhistory build; io's two degradation strings observed live rather than source-traced)."
    addressed_in: "Not phase-scoped -- no build with --disable-cpuhistory exists on this host; declared open in docs/phase42-text-format-drift-citations.md's closing block, not hidden."
    evidence: "42-14-SUMMARY.md's restated-open-items list, item 2; 42-VALIDATION.md's own Manual-Only Verifications table."
  - truth: "RAM-execute hardware evidence for memmapshow's execute bit (Criterion 1)."
    addressed_in: "Declared accepted scope in 42-01's own must-haves; still 0/1565 over the searched denominator."
    evidence: "docs/phase42-text-format-drift-citations.md, 42-09-SUMMARY.md, 42-14-SUMMARY.md restated-open-items item 3."
  - truth: "IN-02's behavioural half (a per-row decimal-separator consistency check)."
    addressed_in: "Deliberately left unbuilt this round -- documentation half only, an explicit recorded decision (no committed capture or known VICE behaviour exercises a mixed-separator payload)."
    evidence: "42-REVIEW.md IN-02 disposition; 42-14-SUMMARY.md restated-open-items item 4."
  - truth: "42-VALIDATION.md's own draft/pending-approval status."
    addressed_in: "Belongs to /gsd-validate-phase 42, not this phase's plans."
    evidence: "42-VALIDATION.md frontmatter (status: draft, Approval: pending), unaffected by this round."
  - truth: "No tool in this tree can start VICE's profiler (a prior `prof on`)."
    addressed_in: ".planning/WINDOWS.md #55, open; 42-13 changed how the cold state is DESCRIBED (profiling-not-started), not the capability to start it."
    evidence: "42-14-SUMMARY.md restated-open-items item 1."
coincidental_reliance_items: []
human_verification: []
---

# Phase 42: The Text-Format Parsers and Their Two-Binary Fixtures Verification Report

**Phase Goal:** Five human-formatted text outputs become structured data behind exactly one owning module each — with `memmapshow`'s execute bit preserved as its own bit for RAM and ROM alike, so a code-versus-data answer derived from real execution exists as data rather than as text — and an unrecognised value fails loudly instead of being absorbed into a plausible-looking wrong answer.

**Verified:** 2026-09-09T21:15:00Z
**Status:** gaps_found
**Re-verification:** Yes — after gap-closure round (plans 42-10..42-14), re-verifying the phase as a whole on the post-round tree.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `memmapshow` gives a per-address access map where execute is its own bit, RAM and ROM alike (Criterion 1, PARSE-01) | ✓ VERIFIED | Unchanged by this round. `textmon-memmap.ts` declares `execute: boolean` independent of `read`/`write`. ROM-execute proven from a real capture; RAM-execute exercised by a declared-synthetic case (accepted scope, no live hardware evidence, honestly disclosed — not scored as a gap). |
| 2 | `prof flat`, `chis`, `bt`, `io` return structured results, `chis` per-entry cycle counts MEASURED on 3.9 (Criterion 2, PARSE-02) | ✓ VERIFIED | Unchanged by this round; all four parsers exist, proven against two real committed binary captures each plus a live dial. |
| 3 | Each format has exactly one owning module, asserted structurally (Criterion 3, PARSE-03) | ✓ VERIFIED | `textmon-seam.test.ts` re-run: 149/149 pass. Structural guard untouched by this round's fixes (they landed inside the already-owning modules `textmon-registers.ts`/`text-capability-probe.ts`/`text-tools.ts`). |
| 4 | A drifted format fails loudly instead of a plausible-looking wrong answer, for all five formats (Criterion 4, PARSE-03) | ✓ VERIFIED | CR-01 closed: `decodeProseLines()` (`textmon-registers.ts:414-454`) now filters the accumulated state against `REQUIRED_IO_DECODED_KEYS` (19 keys, declared and set-equality-tested against `IoDecodedState`'s own interface body) before ever casting, refusing `incomplete-decoded-state` naming every absent field. Re-confirmed directly from source, not from 42-REVIEW.md's text. `textmon-registers.test.ts` (line 419: interface census; lines 452-501: WR-02 chip-gate controls) plus the pre-existing four other formats' drift controls all pass. `node --test textmon-registers.test.ts text-capability-probe.test.ts text-tools.test.ts textmon-seam.test.ts` → 149 tests, 149 pass, 0 fail (measured directly by this verification). Note: this criterion is about semantic *format drift* across VICE versions specifically; CR-02 (below) is a distinct wiring/caching defect, not a drift-recognition failure, so it is scored against Criterion 5 rather than here. |
| 5 | A missing build capability is named per command and per binary; a user is never handed a silent empty result or a parse error that reads like a bug in this project (Criterion 5, PARSE-04) | ✗ **FAILED** | Three of this round's fixes for Criterion 5 hold: `prof flat`'s cold state is now the named `profiling-not-started` code (confirmed at `textmon-profile.ts:111,152,269`), and `textCapabilityIdentityWarning()` reaches all five handlers on both success and refusal paths (confirmed at `text-tools.ts:293,307,325` and equivalents for the other four tools). **But a new Critical defect (CR-02), found by the fresh post-round code review and independently re-verified here against source, falsifies this criterion for `io`:** `handleIoRegisters` (`text-tools.ts:625`) probes capability with the literal string `"io"` rather than the address-specific command it actually dialed; `probeTextCapability()`'s cache (`text-capability-probe.ts:415-444`) is keyed on `(identity, command)` and, on a cache hit, returns the stored verdict **without re-dialing**, so `io`'s inherently per-address, per-call classification is served stale from whatever the FIRST call to a given binary happened to return. This produces either a false refusal discarding a real, successful register dump, or a legitimate chip-degradation reply wrapped in "response could not be parsed" — both are the exact failure modes this criterion exists to prevent. See Gaps below. |

**Score:** 4/5 truths verified, 1 failed (Criterion 5).

### Deferred Items

None of the phase's declared open items are deferred to a *later phase* — they are declared, accepted-scope exclusions of *this* phase, restated honestly rather than hidden (RAM-execute hardware evidence, the two manual-only verifications, IN-02's behavioural half, `42-VALIDATION.md`'s draft status, and the profiler-start capability). See frontmatter `deferred:` for the full list with evidence. None of these bear on the gap below.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/mcp/vice/textmon-registers.ts` | `io` owning module, CR-01/WR-02 fixed | ✓ VERIFIED | `REQUIRED_IO_DECODED_KEYS` completeness check (lines 380-453), chip gate (lines 639-663) both confirmed by direct source read |
| `src/mcp/vice/text-capability-probe.ts` | WR-01 fixed; `io` cache correctness | ⚠️ VERIFIED-BUT-DEFECTIVE | `textCapabilityIdentityWarning()` exists and is wired (WR-01 resolved); the cache's `io` handling is the site of the new CR-02 defect |
| `src/mcp/vice/text-tools.ts` | 5 handlers, identity-warning wiring, `io` chip-gate rendering | ⚠️ VERIFIED-BUT-DEFECTIVE | `withIdentityWarning()` wired on all 5 handlers (confirmed); `handleIoRegisters` (line 625) is the site of CR-02 (wrong cache key passed to `probeTextCapability`) |
| `src/mcp/vice/textmon-profile.ts` | `profiling-not-started` named state | ✓ VERIFIED | Lines 61, 102-111, 152, 269 confirmed |
| `.planning/todos/pending/2026-09-09-io-degradation-probe-cached-under-a-binary-wide-key.md` | CR-02 disposition record | ✓ VERIFIED | Present, severity `major`, correctly names it pre-existing (dates to plan 42-07) not introduced by this round |
| `.planning/STATE.md` | Deferred Items row for CR-02 | ✓ VERIFIED | Line 1866: `text-channel \| 2026-09-09-io-degradation-probe-cached-under-a-binary-wide-key \| major \| Pending` |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `text-tools.ts` (`handleIoRegisters`) | `text-capability-probe.ts` (`probeTextCapability`) | called with literal `"io"` instead of `built.command` | ✗ **MISWIRED** — this is the mechanism of CR-02: the handler's dial-time response never reaches a fresh classification once the cache is warm |
| `text-tools.ts` (all 5 handlers) | `text-capability-probe.ts` (`textCapabilityIdentityWarning`) | called before dial, rendered on success + refusal paths | ✓ WIRED |
| `textmon-registers.ts` (`decodeProseLines`) | `REQUIRED_IO_DECODED_KEYS` | completeness check before `state as IoDecodedState` cast | ✓ WIRED |
| `textmon-registers.ts` (`parseIoRegisters`) | chip gate → `unsupported-chip` | sits after dump-row validation, before decoded-prose/sprite checks | ✓ WIRED |

### Behavioral Spot-Checks / Test Execution

| Check | Command | Result | Status |
|---|---|---|---|
| Phase 42's io/capability/tools/seam files | `node --test textmon-registers.test.ts text-capability-probe.test.ts text-tools.test.ts textmon-seam.test.ts` | tests 149, pass 149, fail 0 | ✓ PASS |
| `text-capability-probe.test.ts` alone | `node --test text-capability-probe.test.ts` | tests 35, pass 35, fail 0 | ✓ PASS (no test exercises the CR-02 double-call-different-response scenario — confirmed by grep, only single-response `io` cases exist at lines 277/362/369/396/416) |
| Typecheck | `npm run typecheck` | exit 0 (orchestrator-measured; not independently re-run, consistent with a docs/test-only round) | ✓ PASS |
| **Full automated gate** (clean environment confirmed via `ps` before running) | `npm run test:automated` | tests 3941, pass 3927, fail 3 — independently re-run by this verification | ✓ PASS (matches documented pre-existing floor exactly: `anno-import.test.ts`, `anno-register.test.ts`; no new failing file) |
| `docs-review-disposition.test.ts` | `node --test docs-review-disposition.test.ts` | tests 7, pass 7, fail 0 | ✓ PASS — CR-02 is dispositioned (named in this VERIFICATION.md, the todo file, and STATE.md), so the process guard is honestly green even though the underlying defect remains open |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| PARSE-01 | 42-01, 42-09, 42-12, 42-14 | `memmapshow` execute-as-own-bit access map | ✓ SATISFIED | Unchanged by this round |
| PARSE-02 | 42-02, 42-03, 42-04, 42-07, 42-09, 42-12, 42-13, 42-14 | Four structured-result parsers | ✓ SATISFIED | Unchanged by this round |
| PARSE-03 | 42-01, 42-02, 42-03, 42-06, 42-08, 42-09, 42-10, 42-11, 42-14 | One owning module per format; ≥2-binary fixtures; drift refuses loudly | ✓ SATISFIED | CR-01/WR-02 closed and re-confirmed against source |
| PARSE-04 | 42-05, 42-06, 42-07, 42-09, 42-10, 42-13, 42-14 | Missing capability named per command/binary, never silent/misleading | ✗ **NOT SATISFIED** | CR-02 (new finding, not one of the five original demotion causes) falsifies the "never a parse error/wrong answer that reads like a bug" clause for `io`. `.planning/REQUIREMENTS.md` currently marks this Complete (flipped by plan 42-14 on the evidence available *before* CR-02 was found at 19:52:54Z, ~13 minutes after 42-14 completed at 19:39:42Z) — this verification finds that marking premature. |

No orphaned requirements: PARSE-01..04 are declared across the 14 plans' frontmatter and REQUIREMENTS.md's Phase 42 mapping matches exactly.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `src/mcp/vice/text-tools.ts` | 625 | `handleIoRegisters` probes capability with the literal `"io"` rather than the address-specific `built.command` | 🛑 Blocker | = 42-REVIEW.md CR-02, independently re-confirmed. Falsifies Criterion 5/PARSE-04 for `io`. |
| `src/mcp/vice/text-capability-probe.ts` | 383 | `runProbe()`'s `cacheable` check treats `io`'s verdict as a binary-wide property, same as `memmapshow`/`chis`, though `io`'s outcome is per-call/per-address content | 🛑 Blocker (same root cause as above) | Cache staleness produces false refusals or misleading parse-failure wrappers for `io` |

No `TBD`/`FIXME`/`XXX` markers found in any phase-42 source file (re-confirmed).

### Validation Artifact State

`42-VALIDATION.md` remains `status: draft`, **Approval: pending** — declared open by 42-14 itself, not hidden. Not scored as a gap (belongs to `/gsd-validate-phase 42`), but not to be read as satisfied either.

### Gaps Summary

One gap blocks a clean pass, carried forward from a defect the fresh post-round code review found (not one of the five gaps this round's plans targeted, and not present in the prior `42-VERIFICATION.md`'s gap list because it had not yet been discovered):

**CR-02 (Blocker, Criterion 5 / PARSE-04):** `handleIoRegisters` shares the binary-wide capability-probe cache for `io`'s inherently per-address chip-degradation check, by passing the literal command string `"io"` instead of the address-specific command actually dialed. This is reachable in ordinary use (any session that calls `vice_io_registers` against more than one address/chip within one broker session — the normal way an agent investigates several chips) and produces either a silently discarded real register dump (replaced with a false "nothing to report" refusal) or a legitimate degradation reply wrapped in a "response could not be parsed" message. Both are the exact failure modes Success Criterion 5 exists to prevent. The defect is real, independently re-verified against current source (not trusted from 42-REVIEW.md's prose), untested, and unfixed as of this verification. It is honestly and correctly dispositioned as an open, pending todo with a matching STATE.md ledger row — the project's own process guards (`docs-review-disposition.test.ts`) are correctly green — but a recorded disposition is not the same as the criterion being met. `.planning/REQUIREMENTS.md`'s current `PARSE-04: Complete` marking, applied by plan 42-14 on the evidence available at the time (before CR-02 was found), is premature against this evidence and should be reverted to `Pending` pending a fix.

All five of the original round's demotion causes (CR-01, WR-01, WR-02, the automated-gate regression, and the prof-flat cold-state message) are genuinely closed and re-verified directly against source and a fresh independent test run — this is not a repeat of the same gaps, but one new one.

---

_Verified: 2026-09-09T21:15:00Z_
_Verifier: Claude (gsd-verifier)_
