---
phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
reviewed: 2026-09-09T19:52:54Z
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
  critical: 1
  warning: 0
  info: 0
  total: 1
status: issues_found
---

# Phase 42: Code Review Report (Re-Review After Gap-Closure)

**Reviewed:** 2026-09-09T19:52:54Z
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Summary

This is a re-review of the gap-closure round (plans 42-10 through 42-14) against the five
findings recorded in the prior `42-REVIEW.md` (2026-09-09T16:01:20Z). All five reused finding IDs
are addressed below with an explicit disposition, verified against the code as it stands, not
against the plans' own summaries.

**Disposition of the five prior findings, verified against source and tests:**

- **CR-01 (critical, unchecked decoded-state cast) — RESOLVED.** `decodeProseLines()`
  (`textmon-registers.ts:414-454`) now filters `REQUIRED_IO_DECODED_KEYS` (19 keys,
  `textmon-registers.ts:380-400`) against the accumulated state via `in` and refuses
  `incomplete-decoded-state`, naming every absent field, before the former unchecked
  `state as IoDecodedState` cast is ever reached. `textmon-registers.test.ts:419-439` asserts, by
  reading the interface body off this module's own real source, that `REQUIRED_IO_DECODED_KEYS`
  is set-equal to `IoDecodedState`'s declared fields in both directions — a field added to the
  interface later without a matching addition to the constant fails this test, closing the exact
  drift CR-01 named. Verified.
- **WR-02 (chip-mismatch reply worded as malformed VIC-II reply) / IN-01 (discarded
  classification call) — RESOLVED.** The chip gate in `parseIoRegisters()`
  (`textmon-registers.ts:639-663`) sits after dump-row validation (so `unrecognised-memspace`
  still outranks it — proven by `textmon-registers.test.ts:493-499`) and before the
  blank-separator/decoded-prose/sprite-table checks, so a non-VIC-II chip is refused by its own
  name (`unsupported-chip`) rather than falling into a VIC-II-shaped complaint.
  `handleIoRegisters` (`text-tools.ts:639-641`) renders that one code's message verbatim, with no
  wrapper, while every other code keeps the generic "response could not be parsed" wrapper. The
  discarded `classifyTextCapabilityResponse("io", response)` call IN-01 named is gone; the
  handler now consults the probe's own renderer unconditionally instead. `textmon-registers.test.ts:452-499`
  proves the chip gate reports the actual chip name (CIA1, SID), never a hard-coded alternative,
  and that a malformed-dump/incomplete-decoded-state/sprite-column-count code is never produced
  for a legitimately different chip. Verified.
- **WR-01 (dropped binary-identity disagreement) — RESOLVED.** `textCapabilityIdentityWarning()`
  (`text-capability-probe.ts:288-304`) is now called by all five text-tool handlers
  (`text-tools.ts`), before the dial, and surfaced both on the success path (an optional
  `identityWarning` field, never in any tool's `required` list) and on every post-lease error path
  via `withIdentityWarning()` (`text-tools.ts:389-391`), refusal text first. `tools-manifest.stock.json`
  confirms `identityWarning` is `type: string` on all five tools and required on none.
  `text-capability-probe.test.ts:466-474` and `text-tools.test.ts`'s five-handler success-path test
  both exercise this end to end. Verified.
- **IN-02 (decimalSeparator doc overstated a whole-payload guarantee) — DOCUMENTATION HALF
  RESOLVED, BEHAVIOURAL HALF DELIBERATELY STILL OPEN, as stated.** `FlatProfile.decimalSeparator`'s
  doc comment (`textmon-profile.ts:86-91`) now correctly states it records only the FIRST data
  row's observed separator and is not validated against later rows. No per-row
  separator-consistency check was added — this is an explicit, recorded decision (no committed
  capture or known VICE behaviour exercises a payload mixing separators), not a fix that landed
  incompletely by accident. Nothing to re-raise here; restated for completeness only.

**A new, previously unflagged issue was found during this re-review** (not one of the five
reused IDs — see CR-02 below): the capability-probe cache `probeTextCapability()` uses to answer
"is this text-monitor command build-capable" is shared, unmodified, by `handleIoRegisters` for a
second purpose it was never designed for — detecting `io`'s own per-address, per-call chip
degradation text — and the cache's "capable, once true, forever true for this binary" contract
is unsound for that second purpose, because unlike a build flag, `io`'s per-call content varies
with the caller's own `address` argument.

## Critical Issues

### CR-02: `io`'s capability-probe cache serves a stale, address-specific response to every later call, causing false refusals and false non-refusals

**File:** `src/mcp/vice/text-capability-probe.ts:415-444` (the cache), `src/mcp/vice/text-tools.ts:613-629` (`handleIoRegisters`'s unconditional probe call)

**Issue:**

`handleIoRegisters` is the one handler among the five text tools that calls `probeTextCapability()`
**unconditionally**, on every call, regardless of `classifyTextCapabilityResponse()`'s own verdict
(`text-tools.ts:616-625`, comment: "the probe module's own renderer is always consulted below,
since it is what additionally catches io's own per-chip runtime degradation"). This is necessary
because `io` carries no build-time guard at all — `classifyTextCapabilityResponse()` can only ever
return `capable`/`indeterminate` for it — and the *only* place that recognises `io`'s two runtime
chip-degradation strings ("No details available." / "No I/O regs available") ahead of the parser
is `text-capability-probe.ts`'s `ioChipDegradationText()`, consulted via `textCapabilityRefusalMessage()`.

But `probeTextCapability()` (`text-capability-probe.ts:415-444`) is a **cache keyed only on
`{backend, binPath, command}`** — it was designed for `memmapshow`/`chis`, where "capable" is a
genuine, process-lifetime-stable property of the *binary* (a build-time C macro), so caching one
verdict per binary is correct. `io`'s classification is **not** binary-wide: whether a given `io`
call's reply is a real register dump or one of the two degradation strings depends on the
**address argument of that specific call**, which the cache key does not include.

Concretely, for a given (backend, binPath) identity, within one MCP server process:

1. The FIRST `vice_io_registers` call for that identity — for ANY address — dials, gets some
   response (`response = await client.command(command, ...)`), classifies `capable` (always, for
   `io`, once non-empty), and **that exact verdict, carrying that exact `response` string, is
   cached** (`runProbe()`'s `cacheable` check: `classification.outcome !== "indeterminate"` is
   true for any non-empty `io` reply, degraded or not).
2. Every SUBSEQUENT `vice_io_registers` call for the same identity — even to a completely
   different address/chip — calls `probeTextCapability()` again with `dial: async () => response`
   (the CURRENT call's fresh response), but `probeTextCapability()` finds the cached verdict and
   returns it **without ever invoking `dial()`** (`text-capability-probe.ts:425-429`:
   `if (cached) return { ...cached, fromCache: true };`). The verdict handed back to
   `textCapabilityRefusalMessage()` therefore carries the FIRST call's `response`, not the
   current call's.

This produces two distinct, reachable wrong answers, depending on which response happened to be
cached first:

- **False refusal (data that should have been returned is discarded).** If the FIRST `io` call for
  a binary happens to hit a chip that degrades (e.g. an address with no dump function), that
  degraded response is cached as the "capable" verdict for `io` on that identity. Every
  SUBSEQUENT call — including one to `$D020` (VIC-II) that comes back with a perfectly good
  64-byte register dump — gets the STALE cached (degraded) response handed to
  `ioChipDegradationText()`, which matches it, so `textCapabilityRefusalMessage()` renders "the
  chip has nothing to report here" and `handleIoRegisters` returns an error **for a call that
  actually succeeded**, discarding the real register dump this call obtained. This persists for
  the rest of the process's life (the cache is never invalidated per-address, only reset by
  `resetTextCapabilityCache()`, which no production code path calls).
- **Wrong-wording refusal (the exact WR-02 failure class, for two different codes).** If the FIRST
  `io` call is a real dump (cached "capable", non-degraded), a LATER call to an address that
  genuinely degrades will have its degradation missed by the (stale) capability layer — the probe
  returns `refusalMessage === ""` because the stale cached response isn't a degradation string —
  and falls through to `parseIoRegisters(response)` with the REAL (degraded) response. The parser
  independently recognises the two degradation strings via its own top-of-function equality check
  and returns them as named refusal codes (`no-details-available`/`no-io-regs-available`,
  `textmon-registers.ts:538-561`). But `handleIoRegisters`'s parse-refusal branch only special-cases
  `unsupported-chip` (plan 42-11's fix) — every OTHER code, including these two legitimate,
  named, non-defect outcomes, still gets wrapped in `"io's response could not be parsed (${code}
  at line ...) -- ${message}"` (`text-tools.ts:642-648`). This is precisely the "a legitimate
  chip reply reads like a parser defect in this project" failure mode WR-02 fixed for
  `unsupported-chip`, silently reopened for `no-details-available`/`no-io-regs-available` the
  moment the capability-probe cache goes stale.

This is reachable in production, not merely in theory: `deps.resolvedBinaryPath`/
`resolvedBinaryPathIsResolved` are set from `stock-dispatch.ts`'s real, one-time, resolved
`resolvedBackend()` call (`handlePing`'s own doc comment, `stock-dispatch.ts:681-694`), so
`textCapabilityCacheKey()` is non-null for any real deployment — the cache is genuinely populated
and genuinely reused across distinct `vice_io_registers` calls within one broker session, which is
the normal way an agent uses this tool (probing several chip addresses in one investigation).

This is untested: `text-capability-probe.test.ts` has no test calling `probeTextCapability` twice
for `"io"` with two DIFFERENT responses under the same identity. `text-tools.test.ts`'s
`handleIoRegisters` tests all use `makeDeps()`, which never sets `resolvedBinaryPath`/
`resolvedBinaryPathIsResolved`, so `identity.resolved` is `false` and `textCapabilityCacheKey()`
returns `null` for every one of those tests — the cache is structurally never exercised by the
existing suite for this handler, which is exactly why this was not caught.

**Fix:** `io`'s per-address content check must never be served from the same cache that
legitimately memoises a binary-wide build capability. Two independent ways to fix this, either
sufficient:

```ts
// Option A: never cache "io" at all -- its outcome is not a property of the
// binary, so caching it is categorically wrong regardless of key shape.
// In runProbe():
const cacheable =
  key !== null &&
  disagreement === null &&
  dialError === undefined &&
  classification.outcome !== "indeterminate" &&
  command !== "io"; // io's "capable" is per-call content, never binary-wide
```

or, if `io`'s verdict should still be cacheable for its (nonexistent) build-guard half:

```ts
// Option B: never SERVE a cached verdict for "io" without re-classifying the
// CURRENT response for chip-degradation -- i.e. handleIoRegisters must not
// rely on probeTextCapability()'s cache hit path for the degradation check at
// all, and should call ioChipDegradationText()-equivalent logic directly
// against the fresh `response` on every call, independent of whatever
// probeTextCapability() returns.
```

Whichever fix lands, add a `text-capability-probe.test.ts` case that calls `probeTextCapability`
twice for `"io"` under the SAME resolved identity with two DIFFERENT responses (one real dump,
one degradation string) and asserts the SECOND call's degradation detection reflects the SECOND
response, not the first — the exact scenario this finding traces through by hand above.

---

_Reviewed: 2026-09-09T19:52:54Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
