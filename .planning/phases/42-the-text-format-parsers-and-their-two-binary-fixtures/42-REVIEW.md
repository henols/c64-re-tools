---
phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
reviewed: 2026-09-10T00:00:00Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - CLAUDE.md
  - docs/phase42-text-format-drift-citations.md
  - docs/tool-support.md
  - src/mcp/vice/capability-registry.test.ts
  - src/mcp/vice/capability-registry.ts
  - src/mcp/vice/hostpath-consumers.test.ts
  - src/mcp/vice/package.json
  - src/mcp/vice/stock-derived.test.ts
  - src/mcp/vice/stock-derived.ts
  - src/mcp/vice/stock-dispatch.test.ts
  - src/mcp/vice/stock-dispatch.ts
  - src/mcp/vice/text-capability-probe.test.ts
  - src/mcp/vice/text-capability-probe.ts
  - src/mcp/vice/textmon-backtrace.test.ts
  - src/mcp/vice/textmon-backtrace.ts
  - src/mcp/vice/textmon-cpuhistory.test.ts
  - src/mcp/vice/textmon-cpuhistory.ts
  - src/mcp/vice/text-monitor-live.test.ts
  - src/mcp/vice/textmon-memmap.test.ts
  - src/mcp/vice/textmon-memmap.ts
  - src/mcp/vice/textmon-profile.test.ts
  - src/mcp/vice/textmon-profile.ts
  - src/mcp/vice/textmon-registers.test.ts
  - src/mcp/vice/textmon-registers.ts
  - src/mcp/vice/textmon-seam.test.ts
  - src/mcp/vice/text-protocol.test.ts
  - src/mcp/vice/text-protocol.ts
  - src/mcp/vice/text-tools.test.ts
  - src/mcp/vice/text-tools.ts
  - src/mcp/vice/tools-manifest.stock.json
  - src/mcp/vice/tool-support-table.test.mjs
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 42: Code Review Report (Round 2 Gap-Closure Re-Review)

**Reviewed:** 2026-09-10T00:00:00Z
**Depth:** standard
**Files Reviewed:** 30
**Status:** clean

## Summary

This is the round-2 re-review of this phase's scope, specifically targeting the single Critical
finding (`CR-02`) the round-1 re-review filed (dated 2026-09-09T19:52:54Z): `handleIoRegisters`
classified each `io` reply through `probeTextCapability()`'s binary-wide, identity-keyed cache,
even though `io`'s chip-level degradation outcome is decided by the caller's own `address`
argument, not by a property of the connected binary — so a second call to a different address
could be silently answered from the first call's cached verdict.

The actual code change for this round is narrow and fully isolated to three files:
`text-capability-probe.ts`, `text-tools.ts`, and `text-monitor-live.test.ts` (confirmed by diffing
`e5beed69..c8b83078`, the exact commit range spanning plans 42-15 and 42-16). Every other file in
this review's scope is byte-identical to the tree round 1 already reviewed and found clean apart
from `CR-02` itself.

**CR-02 disposition: RESOLVED, verified independently rather than accepted on the plan's own
summary.**

- `NEVER_CACHED_COMMANDS` (`text-capability-probe.ts:154`, frozen, sole member `"io"`) is checked
  at all three places a cache can act, and I traced each one directly against the source rather
  than trusting the doc comment's claim:
  - **Write path:** `runProbe()`'s `cacheable` predicate (`text-capability-probe.ts:469-474`)
    ANDs in `!NEVER_CACHED_COMMANDS.includes(command)` — an `io` verdict is never written to
    `capabilityCache`, however definitive its outcome.
  - **Read path:** `probeTextCapability()` (`text-capability-probe.ts:516-527`) checks
    `NEVER_CACHED_COMMANDS.includes(command)` and returns `runProbe(...)` directly, BEFORE the
    `capabilityCache.get(key)` read that every other command reaches — `io` can never be served a
    stale cached verdict even if one somehow existed.
  - **In-flight memo:** the same early return in the read path additionally sits before the
    `inFlightProbes` check, so two concurrent `io` probes for the same identity do not share one
    in-flight dial's promise — verified live in
    `text-capability-probe.test.ts`'s "two concurrent un-awaited io probes dial TWICE and each
    receives its own response" case, which asserts the two concurrent calls receive two
    genuinely different `response` values, not one shared answer.
- `handleIoRegisters` (`text-tools.ts:649`) no longer reaches `probeTextCapability()` at all for
  its capability/degradation check — it calls `textCapabilityVerdictFor()` directly on the
  response it just dialed. `textCapabilityVerdictFor()` (`text-capability-probe.ts:427-444`) does
  no dial, no cache read, and no cache write by construction — it is a pure function over an
  already-observed response. This closes the defect structurally, not just at the `probeTextCapability`
  call site: even if `NEVER_CACHED_COMMANDS` were ever accidentally reverted, `handleIoRegisters`
  itself no longer has a code path back into the shared cache.
- I ran `node --test text-capability-probe.test.ts text-tools.test.ts` myself (not merely reading
  the SUMMARY's transcription) — 95/95 pass, including the two new handler-level end-to-end
  controls (`handleIoRegisters (CR-02, direction a)` and `(direction b)`) that drive the fix
  through a RESOLVED, AGREEING broker identity so the cache is genuinely live during the test —
  the exact condition the original bug needed to be reachable in and the exact condition
  round 1's tests failed to exercise (`makeDeps()` left the identity unresolved, so
  `textCapabilityCacheKey()` returned `null` and the cache was never touched).
- `vice_io_registers`'s published `inputSchema` in `tools-manifest.stock.json` is unchanged by
  this round's diff (confirmed via `git diff e5beed69 c8b83078 -- tools-manifest.stock.json`,
  empty) — the backward-compatibility contract this project requires is intact.
- The new live control in `text-monitor-live.test.ts` (registered as the pre-existing 13th
  `MANUAL_ONLY_TESTS` entry, not a new file needing gate registration) dials `io` at two different
  addresses/chips (`$d020` VIC-II, `$dc00` CIA1) in one session and asserts the second verdict's
  `fromCache` is `false` and its `response` strictly equals the second reply — this is the
  genuine end-to-end proof no fixture or stub can substitute for, and it is additive to the
  existing five-format live case rather than a new broker-launching test (no new teardown
  surface introduced).

I found no way CR-02 survives, on any of the three cache-interaction paths, in either the pure
verdict builder, the handler, or the exported memoised entry point other callers still legitimately
use for the other four commands.

**No new findings.** I traced `handleIoRegisters` end to end against the fix, re-derived the two
failure directions from the original finding by hand against the current source (not from the
SUMMARY's prose alone), confirmed the five other unaffected text-tool handlers still hold their
own separate, correctly-functioning capability-cache usage (`memmapshow`, `chis`, `prof flat`,
`bt` all still call `probeTextCapability()` and still cache correctly — proven by
`text-capability-probe.test.ts`'s discriminating "memmapshow still caches under the same identity"
assertion sitting alongside every `io`-specific control), and re-ran the affected test files myself.
All reviewed files meet quality standards; no Critical, Warning, or Info issues found in this
round's diff or in the unchanged remainder of the scope.

---

_Reviewed: 2026-09-10T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
