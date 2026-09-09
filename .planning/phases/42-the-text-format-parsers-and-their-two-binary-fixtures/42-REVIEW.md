---
phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
reviewed: 2026-09-09T16:01:20Z
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
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 42: Code Review Report

**Reviewed:** 2026-09-09T16:01:20Z
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Summary

Phase 42 builds five text-format parsers (`memmapshow`, `chis`, `bt`, `prof flat`, `io`) behind
five single-owner modules, a shared capability probe (PARSE-04), and the frozen text-command
allowlist. The engineering discipline in this phase is unusually high: every parser returns a
discriminated refusal rather than throwing (D-42-3), `textmon-seam.test.ts` mechanically proves
PARSE-03's one-owning-module rule with a declared-consumer census plus planted violations,
`hostpath-consumers.test.ts` proves none of the new modules reach `hostpath.ts`, and
`TEXT_COMMAND_ALLOWLIST` stays a closed, frozen `as const` array with every parameterised
command routed through one bounded builder (`buildTextCommand()`). The five parsers correctly
keep `execute` as its own bit (PARSE-01), never fold an unrecognised glyph/flag/origin into a
default, and the `docs/phase42-text-format-drift-citations.md` evidence record carries file,
line, binary, version and date for every MEASURED claim.

Against that strong baseline, one real gap survives in `textmon-registers.ts`: the `io` parser's
decoded-prose section is cast to a fully-typed `IoDecodedState` without ever checking that all
six recognised fields were actually observed — a genuine violation of this phase's own
"never silently default, refuse on drift" discipline for the one format that is not fully
closed. Two further gaps are lower-severity: a computed binary-identity disagreement is silently
dropped from the user-facing capability message, and the `io` parser cannot successfully decode
a non-VIC-II chip section despite the tool's own input schema accepting any address.

## Critical Issues

### CR-01: `IoDecodedState` is cast without verifying all six recognised fields were observed — a genuine format drift silently produces an incomplete object typed as complete

**File:** `src/mcp/vice/textmon-registers.ts:344-370` (and the caller at `:576-577`, `:629-634`)
**Issue:**
`decodeProseLines()` accumulates matches from `PROSE_RECOGNISERS` (six labels: "Raster
cycle/line", "Mode", "Colors", "Scroll X/Y", "VC", "Video") into a `Partial<Record<keyof
IoDecodedState, unknown>>`. A line matching no recognised prefix is correctly pushed to
`unrecognisedLines` (drift-on-*extra*-content is visible), but there is no check that every one
of the six recognisers actually fired before the function returns:

```ts
function decodeProseLines(...): DecodeProseResult {
  const state: Partial<Record<keyof IoDecodedState, unknown>> = {};
  for (...) {
    // recognised -> apply(match, state); unrecognised -> unrecognisedLines.push(original)
  }
  return { ok: true, state: state as IoDecodedState };   // <-- unchecked cast
}
```

`IoDecodedState`'s own type declares every one of `rasterCycle`, `rasterLine`, `rasterIrqLine`,
`mode`, `borderColor`, `backgroundColor`, `scrollX`, `scrollY`, `rasterCounter`, `idle`,
`screenColumns`, `screenRows`, `vc`, `vcbase`, `vmli`, `phi1`, `videoBase`, `charsetBase`,
`charsetSource` as **required**, non-optional fields (`textmon-registers.ts:83-103`). If VICE
ever drops, renames, or reorders one of the six lines this parser recognises — the exact
"semantic drift with no syntax change" hazard CLAUDE.md already documents for the `mc`/`ms`
glyph inversion, and the class of bug PARSE-04/D-42-3 exist to catch — the resulting section is
still reported `ok: true` with the missing field(s) silently `undefined`, cast to a type that
promises a `number`/`boolean`/`string`. A caller reading `sections[0].decoded.borderColor` would
get `undefined` with no refusal, no `unrecognised-*` code, and no signal that anything was
wrong — precisely the "confidently wrong answer with no error anywhere" failure mode this
phase's other four parsers are built to refuse against (see `textmon-cpuhistory.ts`'s and
`textmon-backtrace.ts`'s own "never default an unrecognised ... " header rules, which
`textmon-registers.ts` states it inherits). No test in `textmon-registers.test.ts` exercises a
decoded-prose block missing one of the six recognised lines while the sprite table is still
present, so this gap is untested as well as unguarded.

**Fix:**
```ts
const REQUIRED_KEYS: (keyof IoDecodedState)[] = [
  "rasterCycle", "rasterLine", "rasterIrqLine", "mode", "borderColor", "backgroundColor",
  "scrollX", "scrollY", "rasterCounter", "idle", "screenColumns", "screenRows",
  "vc", "vcbase", "vmli", "phi1", "videoBase", "charsetBase", "charsetSource",
];
const missing = REQUIRED_KEYS.filter((k) => !(k in state));
if (missing.length > 0) {
  return {
    ok: false,
    refusal: makeRefusal(
      "unparseable-value", // or a new "incomplete-decoded-state" code
      `io: the decoded-prose block starting at line ${startLineNumber} is missing the recognised ` +
        `field(s) ${missing.join(", ")} -- never returned as a complete decode`,
      proseLines[proseLines.length - 1] ?? "",
      startLineNumber,
    ),
  };
}
return { ok: true, state: state as IoDecodedState };
```

## Warnings

### WR-01: `identityDisagreement` is computed but never surfaced by `textCapabilityRefusalMessage()`

**File:** `src/mcp/vice/text-capability-probe.ts:274-290` (computed) vs. `:485-517`
(rendered)
**Issue:** `identityDisagreementText()` produces a human-readable sentence naming both the
dispatch-resolved identity and the broker's own reported identity when they definitely
disagree, and `runProbe()` stores it on the verdict as `identityDisagreement` (`:329`, `:351`).
The module's own header calls this exact hazard out as something the project has "paid for
once" (a capability answer mislabelled to the wrong binary). However,
`textCapabilityRefusalMessage()` — the ONE function every one of the five text-tool handlers
consults to decide whether to refuse — only branches on `verdict.outcome` (`"missing"` /
`"indeterminate"`) and `ioChipDegradationText()`; it never reads `verdict.identityDisagreement`
at all. A verdict whose `outcome` happens to be `"capable"` (the common case) but which also
carries a genuine identity disagreement renders **nothing** — the disagreement is silently
dropped, and none of `handleMemmapShow`/`handleCpuHistory`/`handleProfileFlat`/
`handleBacktrace`/`handleIoRegisters` inspect `verdict.identityDisagreement` directly either.
The disagreement correctly prevents caching (so a later call re-probes), but the caller of
*this* call is never told that the identity used to attribute the answer might not match what
the broker actually reports — a real, reachable scenario given `resolvedBinaryPath` is
documented elsewhere (`stock-dispatch.ts:680-694`) as "a ONE-TIME, MCP-server-process-startup
PATH probe ... independent of which binary the broker actually leased for THIS request."
**Fix:** Render a fourth line shape in `textCapabilityRefusalMessage()` (or a dedicated,
separately-surfaced warning) whenever `verdict.identityDisagreement` is present, regardless of
`outcome` — e.g. append it as an informational line even on an otherwise-`capable` verdict, so a
caller sees "this answer's identity could not be confirmed" rather than nothing at all. Add a
test asserting a `capable` verdict carrying `identityDisagreement` produces a non-empty message.

### WR-02: `parseIoRegisters()` unconditionally requires a `Sprites:` table for every chip section, so a legitimate non-VIC-II `io` reply can never decode and refuses with a misleading message

**File:** `src/mcp/vice/textmon-registers.ts:580-605`
**Issue:** `vice_io_registers`'s own `inputSchema` accepts any `address` 0-65535
(`tools-manifest.stock.json:4313-4328`), and the module's header states `sections` is an array
"even though the tool ... always dials a single-address form -- the command itself accepts a
bare invocation that dumps every chip, and a parser that hard-assumed one section would refuse a
legitimate reply." In practice, though, every chip section is required to end with a `Sprites:`
header and an eight-column sprite table:
```ts
if (!spriteHeaderLine.startsWith(SPRITE_HEADER_PREFIX)) {
  return { ok: false, refusal: makeRefusal("sprite-column-count", `io: chip "${chip}" is
    missing its expected "Sprites:" header line ...`, ...) };
}
```
A sprite table is a VIC-II-only concept. An `address` inside CIA1 (`$DC00`-`$DCFF`), CIA2
(`$DD00`-`$DDFF`), or SID (`$D400`-`$D41F`) — all within the tool's own advertised 0-65535
range — would produce a chip section with no `Sprites:` line at all, so `parseIoRegisters()`
always refuses it with `sprite-column-count`, worded as if a genuine VIC-II reply were missing
its sprite table rather than "this chip never has one." This is not data fabrication (the
parser safely refuses rather than guessing), but it is a misleading refusal reason for a
legitimately different, capable reply — exactly the "a refusal that reads like a defect in this
project" outcome PARSE-04's own design principle (stated in `text-capability-probe.ts`'s header)
is built to avoid for the *capability* layer, and the same principle should extend to the
*parser* layer for chip-shape differences. No fixture or test in `textmon-registers.test.ts`
exercises a CIA or SID address at all — only `VIC-II` via `$D020` is tested.
**Fix:** Either (a) scope `vice_io_registers`'s documented contract explicitly to VIC-II
addresses (tighten the schema/description, and have the handler refuse a CIA/SID address by
name before dialing, mirroring `handleIoRegisters`'s own "REQUIRED" pre-dial refusals), or (b)
make the sprite-table requirement conditional on `chip === "VIC-II"` and give CIA/SID sections
their own (even if currently minimal/`unrecognisedLines`-only) decoded shape, with a refusal
message that names the chip and says plainly "this parser does not yet decode <chip>'s
registers" rather than "missing its expected Sprites: header line."

## Info

### IN-01: `handleIoRegisters()` computes `classification` and immediately discards it

**File:** `src/mcp/vice/text-tools.ts:579-582`
**Issue:**
```ts
const classification = classifyTextCapabilityResponse("io", response);
void classification;
const verdict = await probeTextCapability({ command: "io", identity, brokerIdentity, dial: async () => response });
```
The comment above this explains *why* the classification result is not further consulted (`io`
can only ever classify `capable`/`indeterminate`, so the probe's own renderer is what actually
matters), but the call itself is then pure dead computation — `classifyTextCapabilityResponse()`
is invoked and its result is voided without ever being read. This is harmless today (the
function is a cheap, side-effect-free string comparison) but is confusing to a future reader:
it looks like a half-finished refactor.
**Fix:** Either remove the call entirely (the explanatory comment can stand on its own above
the `probeTextCapability()` call), or replace it with an assertion the comment implies but never
states, e.g. `assert(classification.outcome !== "missing")` in a debug/test build, to make the
"io never classifies missing" invariant self-documenting rather than a comment plus a voided
variable.

### IN-02: `FlatProfile.decimalSeparator` only records the first row's separator, not a per-row invariant

**File:** `src/mcp/vice/textmon-profile.ts:280-282`, `:406-408`, `:419`
**Issue:** `parsePercentField()` accepts either `,` or `.` as the decimal separator per token
(by design — "a period is an equally legitimate reading from a different host"), but
`FlatProfile.decimalSeparator` is set once, from the first data row's own observed separator,
and never checked against subsequent rows:
```ts
if (decimalSeparator === undefined) {
  decimalSeparator = totalPercentResult.separator;
}
```
A row using a different separator than the first (which the parser would otherwise happily
accept, since each `parsePercentField()` call is independent) is silently absorbed without being
reflected in the reported `decimalSeparator`, and without any refusal — a caller trusting
`decimalSeparator` to describe the whole payload could misread later rows' percentages using the
wrong assumed separator if they use it for re-formatting. In practice VICE emits one
locale-consistent separator per run, so this is unlikely to occur in a real capture, but the
module's own stated design goal ("the OBSERVED separator is recorded ... rather than assumed or
discarded") is only honoured for the first row.
**Fix:** Either validate every row's separator against the first-observed one and refuse
(`unrecognised-percentage` or a new code) on a genuine mismatch, or rename/document
`decimalSeparator` explicitly as "the first row's observed separator" rather than implying it
describes the whole payload.

---

_Reviewed: 2026-09-09T16:01:20Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
