---
phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
plan: 05
subsystem: mcp-tooling
tags: [vice, text-monitor, capability-probe, memmapshow, chis, build-flag, in-process-cache, tdd]

# Dependency graph
requires:
  - phase: 42
    provides: "plan 42-01's textmon-memmap.ts discriminated-refusal shape (D-42-3, inherited here), textmon-fixtures.ts's loadTextFixture(), and the committed fixtures/textmon/ two-binary capture batch"
provides:
  - "text-capability-probe.ts -- the per-command, per-binary text-monitor build-capability probe: classifyTextCapabilityResponse(), textCapabilityCacheKey(), probeTextCapability() (in-process cache, D-42-2), textCapabilityRefusalMessage() (three distinguishable shapes)"
  - "The PARSE-04 answer: a missing capability is always named with its command, its binary and its one remedy; two commands sharing one build macro (memmapshow/chis) are told about once, not twice"
affects: [42-07, 42-09]

# Actuals (#2632)
actuals:
  tokens: 11668
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dependency-injected dial function + identity, no transport/filesystem import (only a type-only ViceBackend import, erased at runtime) -- mirrors host-tool.mts's findSiblingBinary()/backend-detect.mts's resolvedBackend() memoisation shape, applied to a probe rather than a filesystem resolution"
    - "In-flight promise memo keyed on (cacheKey, command), same single-owner check-and-set discipline as broker-launch.mts's inFlight guard -- two concurrent probes of the same key+command dial exactly once"
    - "Message renderer keyed by reason SHAPE, not one wording reused for every case (capability-registry.ts's own capabilityRefusalMessage() discipline) -- missing / indeterminate / chip-level-degradation are three distinct wordings, never conflated"

key-files:
  created:
    - src/mcp/vice/text-capability-probe.ts
    - src/mcp/vice/text-capability-probe.test.ts

key-decisions:
  - "classifyTextCapabilityResponse() gates the 'missing' outcome to CPUHISTORY_GATED_COMMANDS (memmapshow, chis) only -- bt/prof flat/io can never classify missing even if their first line happened to coincidentally equal the disabled-stub literal, because VICE never gates them behind FEATURE_CPUMEMHISTORY"
  - "io's own two runtime degradation strings ('No details available.' / 'No I/O regs available') are a RENDER-TIME distinction over an otherwise-capable io verdict, not a fourth TextCapabilityOutcome member -- the outcome stays exactly the three-state shape Task 1's own action text locks (capable/missing/indeterminate), and textCapabilityRefusalMessage() detects the chip-degradation case separately when building the message"
  - "The full three-shape render function (missing/indeterminate/chip-degradation) was written complete in Task 1's commit, since a character-accurate renderer needs all three distinctions to exist from the start -- Task 2 landed as a test-only commit extending coverage over already-correct logic, the same implementation-predates-test situation plan 42-01 documented for its own tdd=\"true\" Task 2"

requirements-completed: [PARSE-04]

coverage:
  - id: D1
    description: "A missing capability (memmapshow/chis compiled out) is named with its command, its binary, and its one remedy -- two commands sharing the remedy are told about once, not twice"
    requirement: "PARSE-04"
    verification:
      - kind: unit
        ref: "text-capability-probe.test.ts#textCapabilityRefusalMessage: a single missing verdict's message names the command, the capability, the binary path and the configure flag"
        status: pass
      - kind: unit
        ref: "text-capability-probe.test.ts#textCapabilityRefusalMessage: two missing verdicts sharing the stub render exactly ONE remedy sentence naming both commands"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each of the five commands is probed on its own and cached on its own -- two commands sharing one build macro (memmapshow/chis) still get separate probes and separate cache entries"
    requirement: "PARSE-04"
    verification:
      - kind: unit
        ref: "text-capability-probe.test.ts#probeTextCapability: memmapshow and chis occupy separate cache entries -- probing one requires its own dial for the other"
        status: pass
    human_judgment: false
  - id: D3
    description: "The cache is in-process only, keyed on a proven binary identity, and provably never written to disk"
    requirement: "PARSE-04"
    verification:
      - kind: unit
        ref: "text-capability-probe.test.ts#source-level: text-capability-probe.ts contains no filesystem write call and no reference to the tool-written root"
        status: pass
      - kind: unit
        ref: "text-capability-probe.test.ts#probeTextCapability: an indeterminate outcome/a rejected dial/an unkeyable identity/a definite identity disagreement is NOT cached (four dedicated cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "An indeterminate answer is a named state, never an empty success and never a cached fact; the three-shape message never conflates a missing build capability with io's own chip-level degradation"
    requirement: "PARSE-04"
    verification:
      - kind: unit
        ref: "text-capability-probe.test.ts#classifyTextCapabilityResponse: an empty reply classifies indeterminate, never capable"
        status: pass
      - kind: unit
        ref: "text-capability-probe.test.ts#textCapabilityRefusalMessage: the register command's own two degradation strings render as a chip-level degradation, distinct wording from a missing build capability"
        status: pass
    human_judgment: false

# Metrics
duration: 62min
completed: 2026-09-09
status: complete
---

# Phase 42 Plan 05: text-capability-probe -- per-command, per-binary build-capability answers Summary

**In-process, identity-keyed probe (`text-capability-probe.ts`) that answers PARSE-04: a text-monitor command disabled by a VICE build flag is named by command, capability, binary and remedy -- with memmapshow/chis merged into one remedy sentence (they share one macro), bt/prof flat never claiming a build gap (VICE gates neither), and io's own two runtime degradation strings reported as a chip fact, not a build fact.**

## Performance

- **Duration:** 62 min
- **Started:** 2026-09-09T15:29:00Z (approx, first Read call)
- **Completed:** 2026-09-09T16:31:00Z (approx)
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments

- `text-capability-probe.ts`: `classifyTextCapabilityResponse()` (pure, first-non-empty-line-only match against VICE's exact disabled-stub literal, scoped to `memmapshow`/`chis` only), `textCapabilityCacheKey()` (`backend:path`, refuses an unresolved identity), `probeTextCapability()` (in-process cache per D-42-2, in-flight promise memo so concurrent probes dial once), `textCapabilityRefusalMessage()` (three distinguishable shapes: missing build capability, indeterminate probe, `io`'s own chip-level degradation)
- The identity cross-check: a `probeTextCapability()` call accepts an optional broker-reported identity; a DEFINITE disagreement (backend or path) makes the verdict uncacheable and names both observed identities; absent evidence (`backend: null` / `binPath: ""`) is never treated as disagreement, mirroring `vice-proxy.ts`'s own backend-mismatch refusal discipline
- Caching discipline proven by dial-count assertions across 8 dedicated cases: a definitive (capable/missing) verdict caches (one dial across two sequential probes); an indeterminate outcome, a rejected dial, an unkeyable identity, and a definite identity disagreement each never cache (two dials across two probes each); an absent broker record does not block caching; two concurrent un-awaited probes of the same key+command dial exactly once; `memmapshow` and `chis` occupy separate cache entries under the same identity key
- 29 tests total, all green: classifier (capable path proven against the real `access-map-stock`/`cpu-history-stock` fixtures via `loadTextFixture`, identity built from the sidecar's own `capturedFrom`; disabled-stub exact match; later-line non-match control; empty-reply indeterminate; `bt`/`prof flat`/`io` never classify missing), cache key, all 8 caching/never-caching/concurrency/separate-entries cases, ordering (canonical `TEXT_CAPABILITY_COMMANDS` order regardless of input order), all three render shapes plus the phase-number-free assertion, and two source-level purity checks

## Task Commits

1. **Task 1: The classifier and the identity-keyed, in-process, never-persisted cache** - `0096e613` (feat) -- includes the full module (classifier, cache key, probe, and the complete three-shape render function -- see Deviations)
2. **Task 2: The user-facing answer -- named capability, named binary, one remedy, and the three no-guard cases** - `350fb5d4` (test) -- test-only, extending coverage over already-correct logic landed in Task 1

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/mcp/vice/text-capability-probe.ts` (517 lines) - The owning module: types, the classifier, the identity cross-check, the in-process cache, and the three-shape message renderer
- `src/mcp/vice/text-capability-probe.test.ts` (439 lines) - 29 tests across classification, caching, concurrency, ordering, message rendering, and two source-level purity checks

## Decisions Made

- **`classifyTextCapabilityResponse()` gates "missing" to `CPUHISTORY_GATED_COMMANDS` (`memmapshow`, `chis`) only.** `bt`, `prof flat`, and `io` can never classify "missing," even if their first line happened to exactly equal the disabled-stub literal -- VICE genuinely never compiles them behind `FEATURE_CPUMEMHISTORY`, so a coincidental string match must not be misread as a build gap on a command that has none. Proven by two dedicated tests feeding the exact stub literal to `bt`/`prof flat`/`io` and asserting `capable`.
- **`io`'s two degradation strings are a render-time distinction, not a fourth outcome.** `TextCapabilityVerdict.outcome` stays exactly the three-state shape Task 1's own action text locks (`capable`/`missing`/`indeterminate`) -- adding a fourth member would have widened a type the plan explicitly closed. `textCapabilityRefusalMessage()` instead inspects an otherwise-`capable` `io` verdict's response text at render time and produces the chip-level-degradation line only then.
- **The full three-shape render function landed in Task 1's commit; Task 2 is test-only.** A character-accurate `textCapabilityRefusalMessage()` needs the missing/indeterminate/chip-degradation distinctions to exist from the start of authoring -- there is no meaningful "simpler Task-1-only version" to write first and then extend, mirroring the identical situation plan 42-01 documented for its own `tdd="true"` Task 2 (implementation predates tests because a character-validating function cannot be built in two genuinely separable stages). Task 2's commit is `test(42-05):`, adding 8 new tests over unchanged production code, verified by a clean re-run showing 21→29 tests, 0 failures both before and after.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two stray NUL bytes introduced during authoring, caught before any commit**

- **Found during:** Task 1, running the first `<verify>` pass after writing the module and its test file
- **Issue:** The initial `Write` of `text-capability-probe.ts` landed with two literal NUL (`\x00`) bytes in place of two intended plain-space separators inside template-literal expressions (`` `${key} ${command}` `` and `` `${verdict.capability} ${verdict.remedy}` ``, both meant to read `` `${a} ${b}` ``) -- an authoring-time escaping artifact, not a design choice. The module's own source-level purity test (which greps the file's own text) initially reported a false positive for the tool-written-root literal, which is what surfaced the corruption: a plain `grep` on the file silently found nothing (the file classified as binary due to the embedded NUL, the same failure mode project note 8 documents for `anno-memmap-render.ts`), while `node`'s `readFileSync` + `.includes()` inside the test itself found the substring correctly.
- **Fix:** Located both NUL bytes at the byte level (`python3` scan) and replaced them with plain ASCII spaces. Verified zero NUL bytes and zero other stray control characters remain in either file with a full byte-level scan after the fix.
- **Files modified:** `src/mcp/vice/text-capability-probe.ts` (pre-commit; the committed version at `0096e613` already contains the fix -- no separate remediation commit was needed)
- **Verification:** `node --test text-capability-probe.test.ts` -- 21/21 pass (Task 1's own test count) after the fix; a dedicated byte-level Python scan confirms zero NUL bytes in either shipped file.
- **Committed in:** `0096e613` (Task 1 commit; the fix predates the commit)

**2. [Rule 1 - Bug] The module's own header comment named the tool-written root's literal directory name, tripping its own purity assertion**

- **Found during:** Task 1, same verification pass as Deviation 1
- **Issue:** The "WHAT NOT TO DO" section of the module's header comment originally wrote out `` `.c64-re-tools/` `` literally when explaining why capability verdicts must never be persisted there. The plan's own acceptance criterion requires "no reference to the tool-written root directory name" ANYWHERE in the module's own text, including comments -- not just executable code -- so this legitimate prose reference itself violated the criterion it was documenting.
- **Fix:** Reworded the sentence to say "the tool-written root directory" without naming the literal dotted path, preserving the same meaning.
- **Files modified:** `src/mcp/vice/text-capability-probe.ts`
- **Verification:** `node --test text-capability-probe.test.ts` -- the source-level purity test passes.
- **Committed in:** `0096e613` (Task 1 commit; the fix predates the commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1, both caught and fixed before any commit -- neither reached a shipped state).
**Impact on plan:** Both were authoring-time artifacts caught by this plan's own required tests before the first commit; neither affected the module's design or any acceptance criterion beyond the one that caught it. No scope creep.

## Issues Encountered

**Baseline measurement was contaminated once by a shared scratchpad path collision across parallel wave executors.** The very first `npm run test:automated` baseline attempt was written to the session-scoped scratchpad directory named in this agent's tool-use instructions; that directory is apparently shared across the four parallel worktree executors running this wave's plans concurrently (`42-02`/`42-03`/`42-04` alongside this plan), and a sibling executor's own concurrent baseline run appears to have overwritten the file mid-read, producing a wildly inflated and inconsistent failure count (60+ failures spanning broker/host-tool/CLI categories unrelated to this plan). Re-measuring into a private `/tmp` path scoped to this process's own PID, after confirming no sibling `node --test` process was still running, produced a clean, stable measurement: **exactly 8 pre-existing failures**, byte-for-byte matching the same four files plan `42-01`'s own SUMMARY already recorded as this worktree's floor: `anno-import.test.ts` (1), `anno-register.test.ts` (2), `dxa-seam.test.ts` (4, vendored dxa binary unbuilt in this worktree), `repo-root.test.ts` (1, this worktree's path sits under `.claude/worktrees/agent-.../`, tripping a "not under .claude" assertion). This measurement was taken both before and after this plan's own commits, with no change in count or in which files fail -- this plan introduces zero new failures. Future executors sharing this scratchpad path across a wave should use a private, PID-scoped temp path for any long-running baseline command instead.

## Measured Baseline (plan's own requirement)

`npm run test:automated`, measured twice (start of plan and after both commits), both times: **exit 1, exactly 8 pre-existing failures**, none introduced by this plan:
- `anno-import.test.ts` -- 1 failure
- `anno-register.test.ts` -- 2 failures
- `dxa-seam.test.ts` -- 4 failures (vendored `dxa` binary not built in this worktree)
- `repo-root.test.ts` -- 1 failure (worktree-path artifact: this worktree sits under `.claude/worktrees/`)

This matches plan `42-01`'s own recorded baseline exactly (same four files, same per-file counts), confirming these are stable, worktree-environment artifacts rather than anything this plan's changes touch.

## Cache-Key Strings (plan's own requirement)

For both binaries genuinely present on this host (per `fixtures/textmon/`'s own provenance sidecars, `capturedFrom`):

- `stock:/usr/bin/x64sc`
- `fork:/usr/local/bin/x64sc`

Both keys are produced by `textCapabilityCacheKey({ backend, binPath, resolved: true })` exactly as `"<backend>:<binPath>"`, and both are exercised by this plan's own tests (the stock identity directly; the fork identity as the disagreement case's second observed identity).

## Which Commands Can Legitimately Produce a Missing Verdict (plan's own requirement)

- **`memmapshow`, `chis`** -- YES, the only two. Both compiled behind the identical `FEATURE_CPUMEMHISTORY` build-time C macro; a probe for either can classify `missing`, and the two share one remedy sentence when both are missing on the same binary.
- **`bt`, `prof flat`** -- NO. VICE carries no build-time guard for either; a probe for them can only ever classify `capable` or `indeterminate`.
- **`io`** -- NO, but for a different reason than `bt`/`prof flat`: `io` also carries no build-time guard, but it degrades gracefully PER-CHIP at runtime with its own two fixed strings (`"No details available."` / `"No I/O regs available"`) when a specific register has no dump function or the register list is empty for the current bank. This is a CHIP-LEVEL fact, always reachable regardless of build flags, and `textCapabilityRefusalMessage()` reports it with distinct wording from a missing build capability -- never conflating "the chip has nothing here" with "the build lacks this feature."

The `CPUHISTORY_DISABLED_STUB` literal and `io`'s two degradation strings both remain **source-traced, not live-observed** -- read from VICE's own C source (`mon_memmap.c`, `monitor.c`) during this phase's research pass. No binary genuinely built without `--enable-cpuhistory` exists on this host, and building one is out of scope for this plan (`42-VALIDATION.md` records it as a manual-only verification item; plan `42-09` is the live-verification plan for the capable path only, against both real binaries this host does have).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `text-capability-probe.ts` is complete and self-contained: no tool wiring, no `package.json` `files[]` entry (both deliberately deferred to plan `42-07`, per this plan's own `<plan_decisions>` block).
- Plan `42-07` wires `probeTextCapability()`/`textCapabilityRefusalMessage()` into the actual `vice_memmap_show`/`vice_chis`/`vice_bt`/`vice_prof_flat`/`vice_io_registers` tool handlers and adds `text-capability-probe.ts` to `package.json`'s `files[]` -- at that point `docs-dangling-refs.test.ts`'s tree-wide phase-number scan will begin covering this module for real (today it is invisible to that scan, since it is not yet a shipped module; this plan's own local phase-number test is what stands in for that guard until then).
- Plan `42-09` (live verification) exercises the capable path live against both real binaries this host has (`stock:/usr/bin/x64sc`, `fork:/usr/local/bin/x64sc`); the missing-build-capability path has no live counterpart available on this host and stays a manual-only item.
- No blockers for sibling plans `42-02`/`42-03`/`42-04` in this wave -- this plan touched only its own two declared files.

---
*Phase: 42-the-text-format-parsers-and-their-two-binary-fixtures*
*Completed: 2026-09-09*
