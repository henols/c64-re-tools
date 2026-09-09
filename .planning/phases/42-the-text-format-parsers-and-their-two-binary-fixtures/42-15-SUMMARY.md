---
phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
plan: 15
subsystem: text-monitor-parsers
tags: [text-capability-probe, io-registers, caching, cache-invalidation, parse-04, cr-02]

requires:
  - phase: 42 (prior plans, rounds 0-1)
    provides: the five text-monitor parsers (memmapshow/chis/prof-flat/bt/io), the shared
      capability probe module, and the identity-cross-check machinery this plan corrects
provides:
  - "textCapabilityVerdictFor(): a pure verdict builder over an already-observed response,
    with no dial, no cache read, and no cache write"
  - "NEVER_CACHED_COMMANDS: a frozen, named set structurally excluding a command's outcome
    from the binary-wide capability cache when that outcome is decided by the caller's own
    argument"
  - "handleIoRegisters classifying its own reply end to end, closing CR-02"
affects: [42-16 (live proof and PARSE-04 restoration, depends on this fix)]

actuals:
  tokens: 7700
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Pure verdict builder over an already-observed response, reused by the cache-owning
      caller (runProbe) and the cache-bypassing caller (handleIoRegisters) so there is
      exactly one verdict-construction site"
    - "A named, frozen, exported set (NEVER_CACHED_COMMANDS) making a category of cache
      misuse structurally unrepresentable rather than relying on a predicate a future
      reader could \"simplify\" away"

key-files:
  created: []
  modified:
    - src/mcp/vice/text-capability-probe.ts
    - src/mcp/vice/text-capability-probe.test.ts
    - src/mcp/vice/text-tools.ts
    - src/mcp/vice/text-tools.test.ts

key-decisions:
  - "Both remedies from 42-VERIFICATION.md's gap were applied together: a pure builder
    (textCapabilityVerdictFor) so the handler never asks the cache a per-call question, AND
    a structural exclusion (NEVER_CACHED_COMMANDS) so the cache's own domain cannot silently
    re-admit io later. Either alone leaves a real hole (see PLAN.md's plan_decisions)."
  - "Deviation from the plan's literal Task 1 acceptance-criteria wording: the probe-level
    double-call control tests textCapabilityVerdictFor() directly (not two
    probeTextCapability() calls) because Task 1 explicitly leaves runProbe()'s cacheable
    predicate unchanged -- a literal two-probeTextCapability-calls control cannot pass Task
    1's own verify gate (fail 0) until Task 2's NEVER_CACHED_COMMANDS lands. This is
    documented in full under Deviations below."

requirements-completed: [PARSE-04]

coverage:
  - id: D1
    description: "handleIoRegisters classifies the response it itself received via
      textCapabilityVerdictFor(); no await probeTextCapability remains in its body"
    requirement: "PARSE-04"
    verification:
      - kind: unit
        ref: "text-tools.test.ts#handleIoRegisters (CR-02, direction a): a degrading first call never causes a later call's real register dump to be discarded"
        status: pass
      - kind: unit
        ref: "text-tools.test.ts#handleIoRegisters (CR-02, direction b): a healthy first call never suppresses a later call's genuine chip degradation behind the parse-failure wrapper"
        status: pass
    human_judgment: false
  - id: D2
    description: "io is structurally excluded from probeTextCapability's cache domain --
      write, read, and in-flight memo -- while memmapshow/chis/bt/prof flat are unaffected"
    requirement: "PARSE-04"
    verification:
      - kind: unit
        ref: "text-capability-probe.test.ts#probeTextCapability (CR-02): io is excluded from the cache's domain -- two sequential probes dial twice, paired with memmapshow still caching under the same identity"
        status: pass
      - kind: unit
        ref: "text-capability-probe.test.ts#probeTextCapability (CR-02): two concurrent un-awaited io probes dial TWICE and each receives its own response -- the in-flight memo never applies to io"
        status: pass
      - kind: unit
        ref: "text-capability-probe.test.ts#cacheability invariant: every TEXT_CAPABILITY_COMMANDS member is either cached-and-served or declared in NEVER_CACHED_COMMANDS"
        status: pass
    human_judgment: false
  - id: D3
    description: "The published vice_io_registers inputSchema (tools-manifest.json) is
      byte-unchanged by this internal wiring fix"
    verification:
      - kind: other
        ref: "git diff -- src/mcp/vice/tools-manifest.json (empty, checked after each task)"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-09-09
status: complete
---

# Phase 42 Plan 15: Close CR-02 -- io classified on its own reply, not a cached prior call's Summary

**`handleIoRegisters` now builds its verdict from the response it itself dialed via a new pure
builder (`textCapabilityVerdictFor`), and `io` is structurally excluded from
`probeTextCapability`'s binary-wide cache domain (`NEVER_CACHED_COMMANDS`) -- closing the one
remaining Blocker from Phase 42's round-2 code review (CR-02) and restoring PARSE-04.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-09-09T21:23:00Z (approx, from STATE.md's last-recorded timestamp before this plan began)
- **Completed:** 2026-09-09T21:39:25Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `text-capability-probe.ts` gained `textCapabilityVerdictFor()`, a pure verdict builder with
  no dial, no cache read, and no cache write, reused by `runProbe()` so there is exactly one
  verdict-construction site in the module.
- `handleIoRegisters` (text-tools.ts) no longer reaches `probeTextCapability`'s memoised entry
  point at all -- it classifies the fresh response it just dialed through the pure builder.
- `NEVER_CACHED_COMMANDS` (frozen, sole member `"io"`) structurally excludes `io` from the
  cache's domain in all three places a cache can act: the write (`runProbe`'s `cacheable`
  predicate), the read (`probeTextCapability`'s cache-read early return), and the concurrency
  memo (`inFlightProbes`).
- Both of CR-02's reachable wrong answers are now covered by controls that were run against the
  pre-fix tree and observed to fail: a first degrading `io` call no longer discards a later
  call's real register dump, and a first healthy call no longer suppresses a later call's
  genuine chip degradation behind the generic parse-failure wrapper.
- `vice_io_registers`'s published `inputSchema` (`tools-manifest.json`) is byte-unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: One io call, judged on its own reply, end to end -- the pure verdict builder and
   the rewired handler** - `bbdf4958` (fix)
2. **Task 2: io removed from the cache's domain -- the never-cached set, the concurrency hole,
   and the second failure direction** - `c34eb41c` (fix)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified

- `src/mcp/vice/text-capability-probe.ts` - added `textCapabilityVerdictFor()` /
  `TextCapabilityVerdictForOptions`, refactored `runProbe()` onto it, added
  `NEVER_CACHED_COMMANDS` and wired it into `runProbe()`'s `cacheable` predicate and
  `probeTextCapability()`'s cache-read/in-flight-memo skip, extended the module's D-42-2 header
  paragraph and WHAT-NOT-TO-DO list
- `src/mcp/vice/text-capability-probe.test.ts` - probe-level double-call controls (both
  orderings), a never-touches-the-cache assertion, an identity-disagreement assertion for the
  new builder, the never-cached/discriminating-memmapshow-pair case, the concurrent-io case,
  the `TEXT_CAPABILITY_COMMANDS` cacheability invariant, and the byte-equality/
  first-non-empty-line encoding cases
- `src/mcp/vice/text-tools.ts` - rewired `handleIoRegisters` to build its verdict via
  `textCapabilityVerdictFor()`; rewrote the handler's doc comment and inline comment block to
  state the corrected reason
- `src/mcp/vice/text-tools.test.ts` - the direction-(a) and direction-(b) handler-level
  controls (both orderings of degradation vs. real dump), and the resolved-identity
  empty-reply preservation case; `resetTextCapabilityCache` added to the existing import from
  `./text-capability-probe.ts` (no new import statement)

## Decisions Made

- **Both remedies applied together, not either alone.** 42-VERIFICATION.md's gap named two
  acceptable remedies (never-cache `io` in the `cacheable` check; bypass the cache for `io`'s
  degradation check). Remedy 1 alone leaves the handler still asking a capability API a content
  question -- a later reader could "simplify" the predicate back. Remedy 2 alone leaves the
  cache's own domain still willing to file an `io` verdict for a different caller. Both land:
  the handler classifies fresh via a pure builder with no cache and no dial, AND `io` is removed
  from the cache's domain structurally.
- **`runProbe()` refactored onto the same builder, not left as a second construction site** --
  the module's own `identityDisagreementText()` doc comment states the discipline ("exactly one
  wording in exactly one place"); two verdict constructors would drift.
- **No new refusal code and no new rendered wording minted.** The two degradation strings, the
  indeterminate line, and the missing-group line all keep their exact existing text, produced by
  the same `textCapabilityRefusalMessage()`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan-internal inconsistency] Task 1's probe-level double-call control tests
`textCapabilityVerdictFor()` directly instead of two `probeTextCapability()` calls**
- **Found during:** Task 1, while implementing the probe-level control PLAN.md's acceptance
  criteria describe as "two `probeTextCapability`-path classifications for `io`."
- **Issue:** Task 1's own action text explicitly instructs leaving `runProbe()`'s `cacheable`
  predicate and cache-write behaviour unchanged in Task 1 ("the never-cached set is Task 2's
  subject"). Under the unmodified predicate, `io` is still cacheable after Task 1 alone, so two
  literal `probeTextCapability()` calls for `io` under one identity would still return the
  FIRST call's cached verdict on the second call -- exactly the CR-02 bug, still present by
  design until Task 2. A control written that way could not pass Task 1's own `<verify>`
  requirement that `node --test text-capability-probe.test.ts` report `fail 0` at the end of
  Task 1. Verified empirically: with `NEVER_CACHED_COMMANDS` absent (Task-1-only state),
  the addition-only diff still leaves `io` cacheable, so a literal two-`probeTextCapability`-call
  control would fail at that point, contradicting the task's own gate.
- **Fix:** Implemented the probe-level double-call control against `textCapabilityVerdictFor()`
  directly -- the exact new function Task 1 introduces and the exact route CR-02's fix takes
  when it does not want cache interference. This is genuinely non-vacuous: it does not exist at
  all on the pre-change tree (see verbatim failure text below) and exercises the real
  construction path. Task 2 separately and additionally covers the literal
  `probeTextCapability`-level "two sequential io probes dial twice" assertion the plan's wording
  described, once `NEVER_CACHED_COMMANDS` exists to make it pass.
- **Files modified:** src/mcp/vice/text-capability-probe.test.ts
- **Verification:** `node --test text-capability-probe.test.ts` reports `fail 0` at the end of
  both Task 1 and Task 2; the handler-level direction-(a) control (which DOES go through the
  real `probeTextCapability` cache path inside `handleIoRegisters`) independently reproduces and
  closes the actual CR-02 defect end to end.
- **Committed in:** `bbdf4958` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - plan-internal inconsistency).
**Impact on plan:** The substance of every `must_haves.truths` entry and every acceptance
criterion's INTENT is satisfied; only the literal mechanism of one control (which function it
calls) changed, because implementing it literally would have made the task's own stated verify
command fail. Task 2's tests separately and additionally cover the literal
`probeTextCapability`-level assertion the plan's wording described. No scope creep.

## Planted-Control Evidence (required by PLAN.md's `<output>`)

### Probe-level double-call control (Task 1) -- against the pre-change tree

Ran `node --test text-capability-probe.test.ts` against the tree exactly as it stood before
this plan (production code at commit `a7eaaf91`, new test file otherwise unmodified). The
module does not export `textCapabilityVerdictFor` at all:

```
file:///home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/text-capability-probe.test.ts:26
  textCapabilityVerdictFor,
  ^^^^^^^^^^^^^^^^^^^^^^^^
SyntaxError: The requested module './text-capability-probe.ts' does not provide an export named 'textCapabilityVerdictFor'
    at #asyncInstantiate (node:internal/modules/esm/module_job:455:21)
    at async ModuleJob.run (node:internal/modules/esm/module_job:553:5)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)

ℹ tests 1
ℹ pass 0
ℹ fail 1
```

**Passing state afterwards** (Task 1's own suite, this commit): both directions pass --
`textCapabilityVerdictFor (CR-02): dump-then-degradation...` and
`textCapabilityVerdictFor (CR-02): degradation-then-dump...` are both `✔` in the 39/39-pass run
recorded during execution.

### Handler-level direction-(a) control (Task 1) -- against the pre-change tree

Ran `node --test text-tools.test.ts` against the tree exactly as it stood before this plan
(new test file, old production code). The second call's real register dump was discarded
behind the first call's cached refusal -- the actual CR-02 defect, reproduced end to end:

```
✖ handleIoRegisters (CR-02, direction a): a degrading first call never causes a later call's real register dump to be discarded (106.89518ms)
  AssertionError [ERR_ASSERTION]: expected the second call's real register dump to succeed, not be discarded behind the first call's cached refusal -- got {"content":[{"type":"text","text":"vice_io_registers: io: /usr/bin/x64sc reports \"No details available.\" -- the chip has nothing to report here, not a missing build capability."}],"isError":true}

  true !== false
```

**Passing state afterwards:** `✔ handleIoRegisters (CR-02, direction a): ...` in the 50/50-pass
`text-tools.test.ts` run recorded after Task 2.

### Never-cached control (Task 2) -- against the tree as Task 1 left it

Ran `node --test text-capability-probe.test.ts` with production code reverted to Task 1's own
commit (`bbdf4958`) and Task 2's test additions already present. `NEVER_CACHED_COMMANDS` does
not exist yet:

```
file:///home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/text-capability-probe.test.ts:23
  NEVER_CACHED_COMMANDS,
  ^^^^^^^^^^^^^^^^^^^^^
SyntaxError: The requested module './text-capability-probe.ts' does not provide an export named 'NEVER_CACHED_COMMANDS'
    at #asyncInstantiate (node:internal/modules/esm/module_job:455:21)
    at async ModuleJob.run (node:internal/modules/esm/module_job:553:5)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)

ℹ tests 1
ℹ pass 0
ℹ fail 1
```

**Passing state afterwards:** `✔ probeTextCapability (CR-02): io is excluded from the cache's
domain -- two sequential probes dial twice, paired with memmapshow still caching under the same
identity` and `✔ probeTextCapability (CR-02): two concurrent un-awaited io probes dial TWICE and
each receives its own response...` both pass in the final 45/45-pass run.

(The same single import-error failure covers both the never-cached case and the concurrency
case, since both new tests import `NEVER_CACHED_COMMANDS` and the whole file fails to load
before either test body runs -- Node's ESM loader reports the missing export at module
instantiation time, before any individual test executes.)

### Exact rendered refusal text, second call, both handler-level direction controls (post-fix)

Both direction controls' second call renders the identical chip-fact wording (both feed the
same degradation string through the unchanged `textCapabilityRefusalMessage()`):

```
vice_io_registers: io: /usr/bin/x64sc reports "No details available." -- the chip has nothing to report here, not a missing build capability.
```

### `pgrep -af '[v]ice-broker|[x]64sc'` output, immediately before each gate run

Every check below returned nothing and exit code 1 (no match):

- Before Task 2 began: `PRECHECK_EXIT=1` (empty output)
- Before the four-file / nine-file / typecheck sweep: `PRECHECK_EXIT=1` (empty output)
- Before `npm run test:automated`: `PRECHECK_EXIT=1` (empty output)

### `npm run test:automated` figure

- **At plan start:** not independently re-measured before Task 1 (no source change had yet
  landed); the documented floor per project memory and CLAUDE.md is 3 failures in
  `anno-import.test.ts` / `anno-register.test.ts`.
- **At plan end:** `tests 3954`, `pass 3940`, `fail 3`, `skipped 6`. Failing files:
  `anno-import.test.ts`, `anno-register.test.ts` -- exactly the documented floor, no new
  failing file.

## Issues Encountered

None beyond the documented plan-internal inconsistency above (see Deviations).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `handleIoRegisters` is fixed end to end; `io` cannot occupy a cache entry through any path.
- The published tool surface (`tools-manifest.json`) is unchanged -- confirmed empty diff after
  both tasks.
- Ready for plan 42-16 (live proof against real stock VICE and PARSE-04 restoration), which
  depends on this fix being in place.

## Self-Check: PASSED

- `[ -f src/mcp/vice/text-capability-probe.ts ]` -- FOUND
- `[ -f src/mcp/vice/text-capability-probe.test.ts ]` -- FOUND
- `[ -f src/mcp/vice/text-tools.ts ]` -- FOUND
- `[ -f src/mcp/vice/text-tools.test.ts ]` -- FOUND
- `git log --oneline --all | grep -q bbdf4958` -- FOUND
- `git log --oneline --all | grep -q c34eb41c` -- FOUND
- `node --test text-capability-probe.test.ts` -- fail 0 (45 pass)
- `node --test text-tools.test.ts` -- fail 0 (50 pass)
- `node --test textmon-registers.test.ts text-capability-probe.test.ts text-tools.test.ts textmon-seam.test.ts` -- fail 0 (162 pass)
- Nine-file sweep -- fail 0 (287 pass)
- `npm run typecheck` -- exit 0, no `error TS`
- `git diff -- src/mcp/vice/tools-manifest.json` -- empty

---
*Phase: 42-the-text-format-parsers-and-their-two-binary-fixtures*
*Completed: 2026-09-09*
