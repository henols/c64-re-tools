---
phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
verified: 2026-09-09T17:30:00Z
status: gaps_found
score: 3/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "A drifted format fails loudly instead of returning a plausible-looking wrong answer, for ALL FIVE formats (Success Criterion 4 / PARSE-03)."
    status: failed
    reason: >-
      Confirmed by direct source read: textmon-registers.ts's decodeProseLines()
      (lines 344-369) accumulates the six recognised io decoded-prose fields into
      `state: Partial<Record<keyof IoDecodedState, unknown>>` and returns
      `state as IoDecodedState` (line 369) with NO check that all required keys
      were actually populated. IoDecodedState declares 19 required, non-optional
      fields. If VICE renames, drops, or reorders one of the six recognised prose
      lines -- the exact "semantic drift, no syntax change" hazard CLAUDE.md
      documents for the mc/ms glyph inversion, and the class PARSE-04/D-42-3 exist
      to catch -- the function still returns `ok: true` with the missing field(s)
      silently `undefined`, typed as a required number/boolean/string, and no
      refusal code fires. This is CR-01 in 42-REVIEW.md (Critical), independently
      re-verified against the current tree rather than trusted from the review
      text. It holds for the other four formats (memmapshow, chis, bt, prof flat)
      -- each has a planted unrecognised-value/glyph/flag/origin control that
      passes -- but the io format's decoded-prose section is the one place this
      phase's own "never silently default, refuse on drift" rule is not enforced
      structurally. No test in textmon-registers.test.ts exercises a decoded-prose
      block missing one of the six recognised lines.
    artifacts:
      - path: "src/mcp/vice/textmon-registers.ts"
        issue: "decodeProseLines() (lines 344-369) casts an incomplete Partial<IoDecodedState> to the fully-required IoDecodedState without verifying all 19 required keys were observed before returning ok:true."
    missing:
      - "A required-keys completeness check in decodeProseLines() before the `state as IoDecodedState` cast, returning a named refusal (e.g. incomplete-decoded-state) naming the missing field(s) when any of the 19 required keys is absent."
      - "A test in textmon-registers.test.ts exercising a decoded-prose block with one of the six recognised lines removed while the sprite table is still present."
  - truth: "Every REVIEW.md finding recorded for this phase has a disposition somewhere (fixed, accepted, or filed) -- a precondition the project's own automated gate enforces for shippable phase completion."
    status: failed
    reason: >-
      Measured directly: `npm run test:automated` (clean environment, no broker/
      x64sc running, confirmed via pgrep before running) now returns 5 failures,
      not the documented pre-existing floor of 3. Two of the five are NEW,
      directly caused by this phase: (1) "every REVIEW.md finding id anywhere in
      .planning/phases/ has a recorded disposition (AUDIT-01, self-applied)"
      (docs-review-disposition.test.ts) fails naming exactly CR-01, IN-01, IN-02,
      WR-02 (WR-01 also undispositioned per manual check) as undispositioned
      anywhere -- not in a SUMMARY, not in 42-VERIFICATION.md (this file did not
      exist until now), not in a todo ledger entry, not in a MILESTONE-AUDIT
      tech_debt block, and no 42-REVIEW-FIX.md exists. (2) that failure cascades
      into "no milestone audit declares a gated status while any docs guard is
      red (D-12-02)" also going red, because docs-review-disposition.test.ts is
      now one of the red guards it checks. The 3 pre-existing anno-register/anno-
      import failures are unaffected and confirmed unrelated (empty diff for
      those files, matching the orchestrator's own measurement).
    artifacts:
      - path: ".planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures/42-REVIEW.md"
        issue: "5 findings (CR-01 Critical, WR-01/WR-02 Warning, IN-01/IN-02 Info) with no disposition recorded anywhere in the recognised disposition sources."
    missing:
      - "Either fix CR-01/WR-01/WR-02/IN-01/IN-02 and cite the fix commits, or record an explicit accept/defer disposition for each (e.g. in this VERIFICATION.md, a SUMMARY addendum, or a todo ledger entry under .planning/todos/), then re-run docs-review-disposition.test.ts and confirm it and the D-12-02 milestone-audit guard both return to green."
deferred: []
coincidental_reliance_items: []
human_verification:
  - test: "Build a genuinely --disable-cpuhistory VICE and dial memmapshow/chis against it."
    expected: "The capability probe names the missing capability (FEATURE_CPUMEMHISTORY) rather than returning empty or a parse error."
    why_human: "No such build exists on this host per 42-VALIDATION.md's own Manual-Only Verifications table; the stub string was traced from mon_memmap.c, not observed live. Recorded here rather than treated as satisfied."
  - test: "Reach io's two graceful-degradation strings (\"No details available.\" / \"No I/O regs available\") on a genuine live VICE target/bank."
    expected: "The probe/parser names the degradation as the chip reporting nothing to show, not a build gap or a parse failure."
    why_human: "Source-traced (monitor.c:1980-2000), not live-observed; not expected to fire on x64sc, which always builds VIC-II support. Recorded as INFERRED (assumption A1) in 42-VALIDATION.md."
---

# Phase 42: The Text-Format Parsers and Their Two-Binary Fixtures Verification Report

**Phase Goal:** Five human-formatted text outputs become structured data behind exactly one owning module each — with `memmapshow`'s execute bit preserved as its own bit for RAM and ROM alike, so a code-versus-data answer derived from real execution exists as data rather than as text — and an unrecognised value fails loudly instead of being absorbed into a plausible-looking wrong answer.

**Verified:** 2026-09-09T17:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `memmapshow` gives a per-address access map where execute is its own bit, RAM and ROM alike (Criterion 1, PARSE-01) | ✓ VERIFIED | `textmon-memmap.ts:61` declares `execute: boolean` as a field independent of `read`/`write`; never derived from `read` (checked at `:179`, `:422`). ROM-execute proven from a real capture (`textmon-memmap.test.ts:391`). RAM-execute is exercised by a **declared-synthetic** case (`:370`, `:379`) because the real idle-loop captures never ran RAM code — this limitation was declared up front in the plan's own must-haves, not discovered late. Live hardware evidence for RAM-execute was searched (1565 access-map entries from a genuine stock capture) and found 0/1565 — honestly recorded as a shortfall in `docs/phase42-text-format-drift-citations.md` and `42-09-SUMMARY.md`, not smoothed over. Criterion 1 is met at the "shipped as data, proven by code + synthetic fixture" level; the RAM half has no *hardware* evidence yet, exactly as the plan declared it would not. |
| 2 | `prof flat`, `chis`, `bt`, `io` return structured results, incl. `chis` per-entry cycle counts MEASURED on 3.9 (Criterion 2, PARSE-02) | ✓ VERIFIED (with caveat) | All four parsers exist, are exercised against two real committed binary captures each, and were additionally proven against a **live** genuine-stock dial in `text-monitor-live.test.ts` (8/8 pass). `chis` per-entry cycle counts on 3.9 are asserted from `fixtures/textmon/cpu-history-stock.json`'s own `viceVersion` field. **Caveat (see Anti-Patterns/Gaps below):** `vice_profile_flat` cannot produce real rows in production without a prior `prof on`, which no shipped tool issues — an honestly disclosed open item (`.planning/WINDOWS.md` #55) — and the resulting cold-state failure mode is a "could not be parsed" message rather than a clear "profiling not started" message, independently confirmed by tracing `handleProfileFlat` (see below). |
| 3 | Each format has exactly one owning module, asserted structurally (Criterion 3, PARSE-03) | ✓ VERIFIED | `textmon-seam.test.ts` (750 lines, 36 assertions run, all green) derives the family from disk with a non-vacuity floor (`TEXTMON_MODULE_FLOOR = 5 + 1`, matching the measured count), asserts an injective owner map, a closed per-format literal-consumer set and import-consumer set (measured-equals-declared, not one-directional), a byte-safe NUL-containing-module census, and 4 planted violations that are correctly reported plus 3 clean counterparts that are correctly NOT reported. This is real structural proof, not convention. |
| 4 | A drifted format fails loudly instead of a plausible-looking wrong answer, for **all five** formats (Criterion 4, PARSE-03) | ✗ **FAILED for `io`** | Confirmed by direct code read (not just trusting 42-REVIEW.md): `memmapshow`, `chis`, `bt`, and `prof flat` each correctly refuse by name on a planted unrecognised glyph/flag/origin/separator control (all pass in `node --test`). **`io` does not**, for its decoded-prose section: `textmon-registers.ts:369` casts an unchecked, possibly-incomplete object to the fully-required `IoDecodedState` type. A missing/renamed recognised line produces `ok:true` with `undefined` silently typed as required fields — exactly the failure mode this criterion exists to prevent. See Gaps below (= CR-01). |
| 5 | A missing build capability is named per command and per binary (Criterion 5, PARSE-04) | ✓ VERIFIED (with caveats) | `text-capability-probe.ts` implements per-command probing (`CANONICAL_COMMAND_ORDER`), an in-process-only cache keyed on resolved binary identity (`capabilityCache`, `:296`), in-flight dial memoisation (`inFlightProbes`, `:297`), never-cache-on-indeterminate/disagreement, and a merged remedy message for the shared `memmapshow`/`chis` guard. Proven live: all five commands return `capable` against genuine stock `/usr/bin/x64sc`, cache key `"stock:/usr/bin/x64sc"` for every one (`text-monitor-live.test.ts`, `42-09-SUMMARY.md`). **Two disclosed caveats, both real:** (a) `identityDisagreement` is computed (`text-capability-probe.ts:351`) but never read by `textCapabilityRefusalMessage()` (WR-01) — a genuine identity mismatch on an otherwise-`capable` verdict is silently dropped from the user-facing message; (b) `prof flat`'s cold "no profiling data" state is not a build-capability gap at all (correctly classified `capable`), so it falls through to `parseFlatProfile`, which refuses `missing-header` — surfacing as "prof flat's response could not be parsed" (`text-tools.ts:459-462`), a message that reads exactly like a parser defect in this project rather than "profiling is not running," independently confirmed by tracing the handler. |

**Score:** 3/5 truths fully verified, 1 failed (Criterion 4), 1 verified-with-disclosed-caveats (Criterion 5).

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| PARSE-01 | 42-01 | `memmapshow` execute-as-own-bit access map | ✓ SATISFIED | `textmon-memmap.ts`, live-proven |
| PARSE-02 | 42-02, 42-03, 42-07 | `prof flat`/`chis`/`bt`/`io` structured results, `chis` cycle counts on 3.9 | ✓ SATISFIED (prod caveat noted above) | All four parsers + live suite |
| PARSE-03 | 42-01, 42-02, 42-03, 42-04, 42-08 | One owning module per format; fixtures from ≥2 real binaries; drift refuses loudly | ⚠️ PARTIAL | Structural guard (criterion 3) fully proven; drift-refusal (criterion 4) fails for `io` (CR-01) |
| PARSE-04 | 42-05, 42-07 | Missing build capability named per command/binary, never silent/misleading | ⚠️ PARTIAL | Capability-probe design verified and live-proven; `prof flat`'s non-capability cold state produces a misleading "could not be parsed" message (see above); `identityDisagreement` silently dropped (WR-01) |

No orphaned requirements: REQUIREMENTS.md's Phase 42 mapping (PARSE-01..04, all marked "Complete") matches exactly the four IDs declared across the nine plans' frontmatter — every plan's requirement declaration is covered, and no REQUIREMENTS.md entry for Phase 42 is missing a plan.

**Note on REQUIREMENTS.md/ROADMAP.md marking these "Complete"/`[x]` already:** this verification finds that marking premature given the Criterion 4 failure (io) and the automated-gate regression below. This is a real disagreement between what was recorded and what the codebase currently proves — surfaced here rather than deferred.

### Required Artifacts (spot-checked against plan must_haves across all 9 plans)

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/mcp/vice/textmon-memmap.ts` | Owning module for `memmapshow`, ≥120 lines | ✓ VERIFIED | 494 lines, `execute` its own field, exported `parseAccessMap` |
| `src/mcp/vice/textmon-cpuhistory.ts` | Owning module for `chis`, ≥100 lines | ✓ VERIFIED | 335 lines |
| `src/mcp/vice/textmon-backtrace.ts` | Owning module for `bt`, ≥90 lines | ✓ VERIFIED | 385 lines |
| `src/mcp/vice/textmon-profile.ts` | Owning module for `prof flat`, ≥90 lines | ✓ VERIFIED | 420 lines |
| `src/mcp/vice/textmon-registers.ts` | Owning module for `io`, ≥150 lines | ⚠️ VERIFIED-BUT-DEFECTIVE | 638 lines; exists, substantive, wired, but contains CR-01 (unchecked cast) and WR-02 (unconditional Sprites: requirement for every chip) |
| `src/mcp/vice/text-capability-probe.ts` | Per-command per-binary probe, ≥130 lines | ✓ VERIFIED | 517 lines; contains WR-01 (disagreement dropped from message) |
| `src/mcp/vice/text-protocol.ts` | `TEXT_COMMAND_PARAM_SPECS`, `buildTextCommand()` | ✓ VERIFIED | Allowlist deliberately widened 8→10 verbs by plan 42-09 (`prof on`/`prof off`), documented as a "conscious, measured widening"; not a violation of 42-04's own (earlier-wave) "unchanged eight-literal" must-have, which was scoped to that plan's own point in time |
| `src/mcp/vice/textmon-seam.test.ts` | Structural single-owner guard, ≥160 lines | ✓ VERIFIED | 750 lines, non-vacuous, planted-violation-proven |
| `src/mcp/vice/text-tools.ts` | 5 text-channel handlers | ✓ VERIFIED | 602 lines, all 5 handlers present, `needsSession: false` confirmed via `stock-dispatch.ts` |
| `docs/tool-support.md` | Regenerated table with all 5 tools | ✓ VERIFIED | `vice_memmap_show`, `vice_cpu_history`, `vice_io_registers`, `vice_profile_flat` all stock-only-gain; `vice_backtrace` now ✅/✅ shared |
| `src/mcp/vice/capability-registry.ts` | 3 new stock-only-gain entries, backtrace removed | ✓ VERIFIED | Confirmed via green `capability-registry.test.ts`, `stock-dispatch.test.ts` |
| `docs/phase42-text-format-drift-citations.md` | Corrected, quotable drift citations | ✓ VERIFIED | ≥70 lines requirement met, contains "source-traced" and live-evidence blocks with binary/version/date |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `stock-dispatch.ts` | `text-tools.ts` | `withDerivedTool`, `needsSession: false` for all 5 tools | ✓ WIRED |
| `text-tools.ts` | `text-protocol.ts` | `buildTextCommand()` for every parameterised command | ✓ WIRED |
| `text-tools.ts` | `text-capability-probe.ts` | `classifyTextCapabilityResponse` before parse, all 5 handlers | ✓ WIRED |
| `text-tools.ts` | each `textmon-*.ts` | owning parser called, refusal surfaced by name | ✓ WIRED |
| `tools-manifest.stock.json` | `capability-registry.ts` | stock-only-gain set equals manifest-derived divergence set | ✓ WIRED (mechanical completeness test green) |
| `textmon-*.test.ts` | `textmon-fixtures.ts` | `loadTextFixture` reused, not re-derived | ✓ WIRED |

### Behavioral Spot-Checks / Test Execution

| Check | Command | Result | Status |
|---|---|---|---|
| Phase 42's own 9 unit-test files | `node --test textmon-memmap.test.ts textmon-cpuhistory.test.ts textmon-backtrace.test.ts textmon-profile.test.ts textmon-registers.test.ts textmon-seam.test.ts text-capability-probe.test.ts text-protocol.test.ts text-tools.test.ts` | tests 246, pass 246, fail 0 | ✓ PASS |
| Cross-cutting guards touched by this phase | `node --test docs-linerefs.test.ts docs-dangling-refs.test.ts hostpath-consumers.test.ts capability-registry.test.ts stock-dispatch.test.ts stock-derived.test.ts` | tests 206, pass 206, fail 0 | ✓ PASS |
| Typecheck | `npm run typecheck` | exit 0, clean | ✓ PASS |
| **Full automated gate** (broker/x64sc confirmed NOT running beforehand) | `npm run test:automated` | **tests 3913, pass 3897, fail 5** (documented floor is 3) | ✗ **FAIL — regression** |
| Live end-to-end suite (already run by plan 42-09; not re-run here to avoid a second live emulator launch) | `node --test text-monitor-live.test.ts` (opt-in) | 8/8 pass per `42-09-SUMMARY.md`, MEASURED 2026-09-09 | ✓ PASS (per prior measurement, not re-executed by this verification) |

**The 5 full-gate failures, itemised:**
1. `anno-register.test.ts` — `annoRegisterEntryFor()` — pre-existing, unrelated to Phase 42 (empty diff for this file)
2. `anno-register.test.ts` — DIRECTION 5 basis integrity — pre-existing, unrelated
3. `anno-register.test.ts` — planted violation negative control — pre-existing, unrelated
4. **`docs-review-disposition.test.ts`** — NEW, caused directly by this phase: 42-REVIEW.md's 5 findings (CR-01/WR-01/WR-02/IN-01/IN-02) have no recorded disposition anywhere
5. **`docs-integrity`/milestone-audit consistency test** — NEW, cascades from #4: "no milestone audit declares a gated status while any docs guard is red (D-12-02)" now fails because `docs-review-disposition.test.ts` is one of the red guards it checks

Items 1-3 match the documented pre-existing floor exactly (3 failures, `anno-register`/`anno-import`). **Items 4-5 are a genuine new regression this phase introduces and does not close** — this is measured directly, not inferred from SUMMARY claims.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `src/mcp/vice/textmon-registers.ts` | 344-369 | Unchecked type cast over a possibly-incomplete object (`state as IoDecodedState`) | 🛑 Blocker | Directly falsifies Success Criterion 4 for the `io` format (= 42-REVIEW.md CR-01, independently re-confirmed) |
| `src/mcp/vice/textmon-registers.ts` | 580-605 | `parseIoRegisters()` unconditionally requires a `Sprites:` header for every chip section, though the tool's own schema accepts any 0-65535 address; a CIA/SID address (all in-schema) always refuses with a message worded as if a genuine VIC-II reply were malformed | ⚠️ Warning | Misleading refusal for a legitimate reply shape (= 42-REVIEW.md WR-02); no CIA/SID test exists in `textmon-registers.test.ts` |
| `src/mcp/vice/text-capability-probe.ts` | 274-351 vs 485-517 | `identityDisagreement` computed but never read by `textCapabilityRefusalMessage()` | ⚠️ Warning | A genuine binary-identity mismatch on an otherwise-`capable` verdict is silently dropped from the user-facing message (= 42-REVIEW.md WR-01) |
| `src/mcp/vice/text-tools.ts` | 448-462 | `handleProfileFlat()`'s cold-profiler state (VICE's own "No profiling data available...") is correctly classified `capable` (it is not a build gap) but then fails `parseFlatProfile`'s `missing-header` check, surfacing as "prof flat's response could not be parsed" | ⚠️ Warning | Reads like a parser defect in this project rather than "profiling is not running" — an instance of exactly the failure mode Criterion 5 is built to prevent, additional to and more specific than the already-disclosed Window #55 |
| `.planning/phases/42-.../42-09-SUMMARY.md` line 225 vs `text-monitor-live.test.ts` `startBroker()`/`stopBroker()` | — | Teardown verification method (`systemctl --user is-active vice-broker.service` + `ps ... grep x64sc`) checks a systemd unit the test never uses (it spawns the broker directly via `spawn(process.execPath, [BROKER_ARTIFACT, ...])`) and greps only for `x64sc`, never `vice-broker`; the test's own in-process `pidsAliveAfterTeardown` assertion likewise only tracks recorded emulator pids (`recordPid(epochBefore.pid)`), never the broker child process itself | ⚠️ Warning | The orchestrator independently found a leaked `vice-broker.mjs` process (PID 1753509) alive 25 minutes after a run from this plan, with a leaked scratch dir — direct evidence the "teardown is verified rather than assumed" prohibition (marked `status: resolved` in 42-09's must_haves) is not actually exercised for the broker process by either the SUMMARY's manual check or the test's own assertions |

No `TBD`/`FIXME`/`XXX` markers found in any phase-42 source file.

### Validation Artifact State

`42-VALIDATION.md` remains `status: draft`, `nyquist_compliant: false`, `wave_0_complete: false`, all five per-task verification rows still read `⬜ pending` with `❌ W0` file-existence markers, and **Approval: pending** — despite all the referenced test files now existing and passing. This is validation *debt*, not evidence the phase failed, but it should not be read as satisfied; a `/gsd-validate-phase 42` pass to bring this artifact current is recommended alongside closing the gaps above.

### Gaps Summary

Two gaps block a clean pass:

1. **CR-01 (Blocker, Criterion 4 / PARSE-03):** `textmon-registers.ts`'s `io` decoded-prose section can return `ok: true` with an incomplete, unchecked-cast state object on format drift, the exact failure mode this phase exists to prevent. This is real and unfixed as of this verification.
2. **Automated-gate regression (2 new failures beyond the documented floor of 3):** `42-REVIEW.md`'s 5 findings have no recorded disposition anywhere, which the project's own `docs-review-disposition.test.ts` catches and which cascades into the milestone-audit consistency guard. This is a completion-process gap, not a runtime-correctness gap, but it is a real, currently-red automated check this phase's own tree introduces.

Three further items are disclosed, real, but not scored as blocking gaps because they were either declared as accepted scope up front (RAM-execute hardware evidence) or are honestly recorded elsewhere as open deviations (`prof on`, `.planning/WINDOWS.md` #55) — though this verification independently found and is additionally flagging the specific *misleading-message* consequence of the `prof on` gap, and the broker-teardown-verification-method gap, neither of which appears to have been previously named in exactly this form:

- RAM-execute has no live hardware evidence (0/1565), by design covered only by a declared-synthetic fixture — accepted scope, stated in 42-01's own must-haves.
- `vice_profile_flat` cannot produce real rows without an out-of-band `prof on`, and its cold-state failure message ("could not be parsed") reads like a project defect rather than "profiling not running" — Window #55 (open) covers the underlying capability gap; this verification adds the specific message-framing consequence.
- The live-suite teardown verification method (systemd-unit + x64sc-name check) does not actually check the process it is responsible for (a directly-spawned `vice-broker.mjs`), and a real leak was observed independently by the orchestrator.

---

_Verified: 2026-09-09T17:30:00Z_
_Verifier: Claude (gsd-verifier)_

---

## Orchestrator-measured addendum (execute-phase, 2026-09-09)

Appended by the execute-phase orchestrator after the verifier returned, following
this phase's existing post-merge-addendum convention (cf. commit `f117410c`). The
verifier's gap findings above are left exactly as authored; this section only
records measurements taken *after* that report was written, with their commands.

### Gap 2 ("undispositioned review findings") is SELF-RESOLVED — not a standing gap

`docs-review-disposition.test.ts` scans the phase directory for each finding id.
Writing `42-VERIFICATION.md` itself put all five ids in that directory, so the
guard the verifier measured red went green the moment its own report landed:

```
$ grep -c CR-01 42-VERIFICATION.md   -> 10   (WR-01: 8, WR-02: 6, IN-01: 4, IN-02: 4)
$ node --test docs-review-disposition.test.ts
  tests 7 | pass 7 | fail 0        (exit 0)
```

The verifier's 5-failure reading was therefore taken before/while writing the file
that satisfies the guard. **A gap-closure plan must NOT chase this.** Note the
disposition mechanism is a substring scan, so "dispositioned" here means "the id is
named in a recognised source", which these gap entries do satisfy — the CR-01 *code*
defect (gap 1) is untouched by that and remains fully open.

### Stable automated-suite state: 3 failures — the documented pre-existing floor

Measured with a verified-clean environment (`pgrep -af 'vice-broker|x64sc'` empty):

```
$ cd src/mcp/vice && npm run test:automated        # exit 1
  anno-import.test.ts (1), anno-register.test.ts (2), text-protocol.test.ts (1)

$ node --test text-protocol.test.ts                # exit 0
  tests 34 | pass 34 | fail 0
```

`text-protocol.test.ts` passes 34/34 in isolation — the banner-drain timing flake
already documented in `42-03-SUMMARY.md`, which observed the same file flake once
and pass in isolation. Neither it nor the disposition guard is a Phase 42 regression.
The floor is the 3 `anno-*` failures, proven pre-existing: all seven requirement ids
those assertions name had 0 occurrences in `REQUIREMENTS.md` at the phase diff base,
and Phase 42 produced an empty diff for both files.

### Leaked broker daemon — 42-09's teardown prohibition was NOT met

`42-09-PLAN.md` carries the prohibition "must not leave a broker daemon or an
emulator process alive — teardown ... is verified afterwards", marked
`status: resolved`. It was not met. PID 1753509 (`resources/vice-broker.mjs`,
`--repo-root /tmp/probe-double-prompt-uDHgs8`) was still alive ~25 min after the
run, launched from the since-deleted worktree. 42-09's own check grepped only for
`x64sc`, never for `vice-broker`, so it reported success. The orchestrator killed
the process and removed the leaked `/tmp` scratch dir. Consequence: **42-09's
"8 failures before and after" baseline was measured with that broker running**,
which CLAUDE.md records as deterministically reddening an unrelated ordering
assertion — that reading should not be relied on. The 3-failure floor above
supersedes it.

### Requirement scoping applied

`PARSE-03` and `PARSE-04` demoted to `Pending`; `PARSE-01` and `PARSE-02` left
`Complete`. `PARSE-03` is named directly by gap 1. `PARSE-04` is demoted on the
same evidence — its wording is "never handed a silent empty result or a parse
error", and CR-01 yields a silent result with `undefined` in required fields while
the verifier's own additional finding shows `prof flat`'s cold state surfacing as
"could not be parsed". The blunt all-ids revert was deliberately not used.
