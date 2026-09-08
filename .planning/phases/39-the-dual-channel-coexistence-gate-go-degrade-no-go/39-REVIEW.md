---
phase: 39-the-dual-channel-coexistence-gate-go-degrade-no-go
reviewed: 2026-09-08T00:07:47Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - src/mcp/vice/textmon-fixtures.ts
  - src/mcp/vice/textmon-fixtures.test.ts
  - src/mcp/vice/fixtures/textmon/README.md
  - docs/phase39-dual-channel-coexistence-gate-findings.md
  - CLAUDE.md
  - src/mcp/vice/fixtures/textmon/access-map-stock.json
  - src/mcp/vice/fixtures/textmon/access-map-stock.txt
  - src/mcp/vice/fixtures/textmon/access-map-fork.json
  - src/mcp/vice/fixtures/textmon/access-map-fork.txt
  - src/mcp/vice/fixtures/textmon/backtrace-stock.json
  - src/mcp/vice/fixtures/textmon/backtrace-stock.txt
  - src/mcp/vice/fixtures/textmon/backtrace-fork.json
  - src/mcp/vice/fixtures/textmon/backtrace-fork.txt
  - src/mcp/vice/fixtures/textmon/connect-banner-stock.json
  - src/mcp/vice/fixtures/textmon/connect-banner-stock.txt
  - src/mcp/vice/fixtures/textmon/connect-banner-fork.json
  - src/mcp/vice/fixtures/textmon/connect-banner-fork.txt
  - src/mcp/vice/fixtures/textmon/cpu-history-stock.json
  - src/mcp/vice/fixtures/textmon/cpu-history-stock.txt
  - src/mcp/vice/fixtures/textmon/cpu-history-fork.json
  - src/mcp/vice/fixtures/textmon/cpu-history-fork.txt
  - src/mcp/vice/fixtures/textmon/flat-profile-stock.json
  - src/mcp/vice/fixtures/textmon/flat-profile-stock.txt
  - src/mcp/vice/fixtures/textmon/flat-profile-fork.json
  - src/mcp/vice/fixtures/textmon/flat-profile-fork.txt
  - src/mcp/vice/fixtures/textmon/register-decode-stock.json
  - src/mcp/vice/fixtures/textmon/register-decode-stock.txt
  - src/mcp/vice/fixtures/textmon/register-decode-fork.json
  - src/mcp/vice/fixtures/textmon/register-decode-fork.txt
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 39: Code Review Report

**Reviewed:** 2026-09-08T00:07:47Z
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

This was an evidence-not-code phase, and the real code surface (`textmon-fixtures.ts` +
its test) is small, clean, and correctly mirrors `binmon-fixtures.ts`'s established
five-key provenance contract by deliberate design (D-18) — that duplication is not
flagged. `npx tsc --noEmit` is clean, `node --test textmon-fixtures.test.ts` passes all
11 assertions, and `docs-linerefs.test.ts` and `totality-walk.mjs` both reproduce exactly
what `docs/phase39-dual-channel-coexistence-gate-findings.md` claims for them. All seven
of the findings document's `evidence/<file>:<line>` citations were checked byte-for-byte
against the actual evidence files and all seven resolve correctly, including the
"final occurrence" transcription rule where a file (`39-cross-channel-resume.md`) has
earlier `corrupts` occurrences before the cited final `clean` one.

The one BLOCKER is in the committed fixture data itself, not in `textmon-fixtures.ts`:
`fixtures/textmon/README.md`'s own "Framing" section states, as a general, previously
undocumented fact, that "the stock text monitor's true reply framing for **any**
command is three parts" — an entry-echo prompt, the output, then an exit prompt — and
that every committed `.txt` includes "**both** the entry-echo prompt and the final exit
prompt." Byte-inspection of the twelve committed payloads shows this is true only for
the `access-map` pair; the other five command pairs (`backtrace`, `cpu-history`,
`flat-profile`, `register-decode`, and by definition `connect-banner`) contain only the
trailing exit prompt. Phase 42's parsers are explicitly named as this fixture batch's
consumer, and a parser built to strip a leading `(C:$xxxx) ` off every command's output
(per this README) will silently corrupt the first line of five of the six commands'
real captured output.

The Warnings are lower-stakes: the provenance loader validates key *presence* but never
*type* (a limitation inherited unchanged from `binmon-fixtures.ts`, not introduced here,
but still a live path where a malformed sidecar loads "successfully"); all twelve
sidecars carry the exact same millisecond-precision `capturedAt`, which is implausible
for genuinely independent live captures of a ~1.6MB scan versus a 0-byte banner and
undercuts the "measured, not assumed" framing the rest of the phase is built on; the
README's own "Case" column names (`access-map`, `flat-profile`, …) are not valid
`loadTextFixture()` arguments (the real case names carry a `-stock`/`-fork` suffix); and
the missing-key test only exercises one representative multi-key-omission scenario, not
each of the five keys individually.

## Critical Issues

### CR-01: README's universal "entry-echo, then output, then exit-prompt" framing claim is contradicted by 10 of the 12 committed fixture payloads

**File:** `src/mcp/vice/fixtures/textmon/README.md:74-94` (claim), contradicted by
`src/mcp/vice/fixtures/textmon/backtrace-stock.txt`, `backtrace-fork.txt`,
`cpu-history-stock.txt`, `cpu-history-fork.txt`, `flat-profile-stock.txt`,
`flat-profile-fork.txt`, `register-decode-stock.txt`, `register-decode-fork.txt`

**Issue:** The README states as a general, newly-measured fact: "the stock text
monitor's true reply framing for **any** command is **three parts**: an immediate echo
of the current halted PC as a `(C:$xxxx) ` prompt … then the command's own output, then
a second, final `(C:$xxxx) ` prompt," and separately that each `.txt` is captured
"including **both** the entry-echo prompt and the final exit prompt … with no trimming."

Counting literal `(C:$xxxx)` occurrences in each committed payload:

```
access-map-fork.txt:      2   (entry-echo + exit-prompt — matches the claim)
access-map-stock.txt:     2   (entry-echo + exit-prompt — matches the claim)
backtrace-fork.txt:       1   (exit-prompt only)
backtrace-stock.txt:      1   (exit-prompt only)
cpu-history-fork.txt:     1   (exit-prompt only)
cpu-history-stock.txt:    1   (exit-prompt only)
flat-profile-fork.txt:    1   (exit-prompt only)
flat-profile-stock.txt:   1   (exit-prompt only)
register-decode-fork.txt: 1   (exit-prompt only)
register-decode-stock.txt:1   (exit-prompt only)
```

`backtrace-stock.txt` begins directly with `             PC        .C:e5d1   8D 92 02
STA $0292` (the `bt` command's own column header), not a `(C:$xxxx) ` prompt.
`cpu-history-stock.txt`, `flat-profile-stock.txt` and `register-decode-stock.txt` behave
identically — only `access-map` (`memmapshow`, the one command slow enough for the
README to call out its segmented TCP arrival) actually carries the leading entry-echo
prompt. The general claim was extrapolated from a single, slow-enough-to-observe case
and is false for the other five command pairs actually committed in this batch.

This is directly load-bearing for Phase 42: `docs/phase39-dual-channel-coexistence-gate-findings.md`
§ *Recorded facts that gate nothing* item 7 names this exact fixture batch as
`PARSE-01..03`'s deliverable, and any parser written against this README's framing
section — e.g. one that unconditionally strips a leading `(C:$xxxx) ` token before
parsing a command's real output — will corrupt the first line of `bt`, `chis`,
`prof flat`, and `io` output for both binaries, while working correctly only for
`memmapshow`.

**Fix:** Correct the "Framing" section to state plainly that the entry-echo prompt was
observed only for `memmapshow` in this batch (the one command slow enough that the two
framing prompts arrive as separate TCP segments), and that the other five commands'
committed payloads begin directly with their own output and carry only the trailing
exit-prompt — e.g.:

```markdown
## Framing: every reply ends with an exit-prompt; a leading entry-echo is command-dependent

Every committed reply ends with a second `(C:$xxxx) ` prompt once the monitor returns to
its input-wait state. A *leading* entry-echo of the same form, written before the
command has actually executed, was observed in this batch only for `memmapshow`
(`access-map-{stock,fork}.txt`) — the one command slow enough that the entry-echo and
the rest of the reply routinely arrive as separate TCP segments. The other five
committed pairs (`backtrace`, `cpu-history`, `flat-profile`, `register-decode`) begin
directly with the command's own output and carry only the trailing exit-prompt. A parser
must not assume every command reply is prefixed with an entry-echo prompt.
```

## Warnings

### WR-01: Provenance validation checks key presence, never value type — a malformed sidecar can load "successfully"

**File:** `src/mcp/vice/textmon-fixtures.ts:157-163`

**Issue:** `loadTextFixture()`'s only validation is
`REQUIRED_PROVENANCE_KEYS.filter((k) => !(k in provenance))` — this only tests that a
key is *present* (with any value, including `null`), never that its value has a sane
type. A sidecar containing `"synthetic": null`, `"synthetic": "true"` (a string), or
`"capturedFrom": null` passes validation and returns a `TextFixture` without error.
Because `synthetic: provenance.synthetic === true` treats anything other than the
literal boolean `true` as `false`, a sidecar whose author intended `synthetic: true`
but wrote it as a string or left it `null` reads back as `synthetic: false` — a real
capture claim — which is exactly the "a fixture missing `synthetic` would otherwise
silently read back as a real capture" failure mode `binmon-fixtures.ts`'s own header
(cited at `textmon-fixtures.ts:48`) names as the reason the five-key contract exists.

This is not a regression introduced by this phase — `binmon-fixtures.ts:289-297` has
the identical `k in provenance` / `=== true` pattern, and `textmon-fixtures.ts` is
explicitly designed (D-18) to mirror it exactly. But since this phase's own review
scope specifically asks "is there a path where a malformed sidecar loads
successfully" — yes, for both loaders, on value type rather than key presence.

**Fix:** Add a type check per key alongside the presence check, at minimum for
`synthetic` (must be strictly `true` or `false`, never absent-from-check `null`/string):

```typescript
const missingKeys = REQUIRED_PROVENANCE_KEYS.filter((k) => !(k in provenance));
if (missingKeys.length > 0) { /* existing throw */ }
if (typeof provenance.synthetic !== "boolean") {
  throw new MissingTextFixtureError(
    `Captured text fixture "${caseName}" sidecar at ${jsonPath} has a non-boolean "synthetic" value (${JSON.stringify(provenance.synthetic)}) -- regenerate it with: ${REGENERATE_COMMAND}`,
    { path: jsonPath, command: REGENERATE_COMMAND },
  );
}
```

(If this is judged out of scope for a sibling-mirroring phase, at minimum file the same
gap against `binmon-fixtures.ts` so both loaders close it together.)

### WR-02: All twelve committed sidecars share the exact same millisecond-precision `capturedAt`, which is implausible for independent live captures

**File:** `src/mcp/vice/fixtures/textmon/access-map-stock.json:4`,
`access-map-fork.json:4`, `backtrace-stock.json:4`, `backtrace-fork.json:4`,
`connect-banner-stock.json:4`, `connect-banner-fork.json:4`, `cpu-history-stock.json:4`,
`cpu-history-fork.json:4`, `flat-profile-stock.json:4`, `flat-profile-fork.json:4`,
`register-decode-stock.json:4`, `register-decode-fork.json:4`

**Issue:** Every one of the 12 committed sidecars carries the identical
`"capturedAt": "2026-09-07T23:20:07.992Z"` — down to the millisecond — across six
different commands run against two separately-launched binaries, including
`memmapshow` (a ~1.6MB scan the README itself says takes long enough that its reply
"routinely arrive[s] as separate TCP segments") and `connect-banner` (a 0-byte, instant
capture). Genuinely independent, sequential live captures of a slow scan and an instant
no-op landing on the exact same millisecond, twelve times over, is not plausible; this
reads as a single timestamp computed once and stamped onto every sidecar rather than a
per-capture measurement. `loadTextFixture()`'s `TextFixture.provenance` doc and this
whole phase's "measured, not assumed" framing (e.g. `FIXTURE_ENCODING: has-high-bytes`,
"measured across every byte in this batch, not assumed") implies `capturedAt` is a
genuine per-capture timestamp; as committed, it cannot be used to distinguish or order
the twelve captures, and a consumer that infers real elapsed-time behavior from it
(e.g. to reason about capture ordering) would be misled.

**Fix:** Either regenerate the batch with per-capture timestamps (out of this review's
scope, since the capture script itself is excluded), or — cheaper — add a note to
`fixtures/textmon/README.md` stating explicitly that `capturedAt` reflects the batch
run's start time rather than each individual capture's completion time, so a future
reader doesn't assume otherwise.

### WR-03: README's "Case" column values are not valid `loadTextFixture()` arguments

**File:** `src/mcp/vice/fixtures/textmon/README.md:17-30` (table), vs.
`src/mcp/vice/textmon-fixtures.ts:121` (`loadTextFixture(caseName, …)`)

**Issue:** The README's Source-paths table lists a "Case" column with values like
`access-map`, `flat-profile`, `cpu-history`, `backtrace`, `register-decode`,
`connect-banner` for both the stock and fork row of each command. But
`loadTextFixture()`'s actual `caseName` argument must match the on-disk stem exactly,
and the on-disk stems are `access-map-stock`, `access-map-fork`,
`flat-profile-stock`, `flat-profile-fork`, etc. (confirmed by running
`listTextFixtures()`, which returns exactly those 12 suffixed names, never the
bare `access-map` form). A reader following the README's own vocabulary and calling
`loadTextFixture("access-map")` gets a `MissingTextFixtureError`, not the stock or fork
fixture the table appears to name.

**Fix:** Either rename the table's "Case" column to something like "Command group" and
add an explicit "Loader case name" column with the real suffixed stems, or state plainly
in prose that `loadTextFixture()`'s `caseName` argument is always the command-group name
plus a `-stock`/`-fork` suffix.

### WR-04: The missing-key test exercises only one combined-omission scenario, not each of the five required keys individually

**File:** `src/mcp/vice/textmon-fixtures.test.ts:97-114`

**Issue:** The single "sidecar missing a required provenance key" test writes a sidecar
containing only `capturedFrom` (i.e., missing all four of `viceVersion`, `capturedAt`,
`command`, `synthetic` at once) and asserts the thrown message names two of those four
(`viceVersion`, `synthetic`) — it never asserts on `capturedAt` or `command` appearing
in the message, and no test ever removes exactly one key while keeping the other four,
for any of the five keys. The implementation's validation logic is a single generic
`.filter()` over the fixed key array, so the risk of a key-specific bug hiding here is
low, but as written the suite cannot distinguish "the loader correctly enforces all five
keys" from "the loader happens to enforce whichever keys this one test bothered to
assert on."

**Fix:** Either parametrize the existing test over `REQUIRED_PROVENANCE_KEYS` (one
sub-case per key, omitting only that key) or at minimum extend the existing assertion to
check all five key names are correctly reported when all four non-`capturedFrom` keys
are missing simultaneously, e.g.:

```typescript
for (const key of REQUIRED_PROVENANCE_KEYS.filter((k) => k !== "capturedFrom")) {
  assert.match((err as Error).message, new RegExp(key));
}
```

## Info

### IN-01: `loadTextFixture`'s `caseName` is joined into the fixture path with no traversal guard

**File:** `src/mcp/vice/textmon-fixtures.ts:123-124`

**Issue:** `join(baseDir, \`${caseName}.txt\`)` and the `.json` equivalent perform no
validation on `caseName` — a value like `"../../../etc/passwd"` would resolve outside
`baseDir`. In practice `caseName` is only ever a hardcoded literal from tests, so this
isn't currently reachable with untrusted input, and `CLAUDE.md`'s host-path-translation
constraints apply to a different (host-facing) code path than this test-support loader.
Noted for completeness since the review scope explicitly named path handling as worth
checking.

**Fix:** Not required given the current closed set of callers; if this loader is ever
exposed to a caller-supplied `caseName` from outside the test suite, reject any value
containing `/`, `\`, or `..` before joining.

### IN-02: Two committed-fixture assertions use loose lower-bound thresholds instead of the actual known counts

**File:** `src/mcp/vice/textmon-fixtures.test.ts:168`, `:185-186`

**Issue:** `assert.ok(cases.length >= 6, ...)` and
`assert.ok(paths.size >= 2, ...)` both pass today against the real committed count of
12 cases / 2 distinct `capturedFrom` values, but a regression that silently dropped half
the committed fixtures (down to exactly 6) or collapsed both binaries' paths into one
`capturedFrom` value would still pass these specific assertions.

**Fix:** Tighten to the actual known values (`assert.equal(cases.length, 12, ...)`,
`assert.equal(paths.size, 2, ...)`) now that the batch is committed and its size is
known, or leave a comment explaining why a loose floor was chosen deliberately.

### IN-03: `connect-banner` sidecars' `command` field is a parenthetical description rather than a real command string

**File:** `src/mcp/vice/fixtures/textmon/connect-banner-stock.json:5`,
`connect-banner-fork.json:5`

**Issue:** Every other sidecar's `command` field is a literal monitor command
(`"memmapshow"`, `"bt"`, `"chis 4"`, `"prof flat 5"`, `"io $d020"`); the two
`connect-banner` sidecars instead carry the prose string
`"(connect banner, no command sent)"`. This is documented and intentional (the README
explains no command is sent for this case), so it's not a defect, but a consumer that
treats `command` as "the literal input to replay against a live monitor" for every
fixture (e.g. a differential re-capture tool) needs a special case for this one pair.

**Fix:** No action required; flagging only so a future consumer of `command` as a
replayable string is aware of the one non-literal exception.

---

_Reviewed: 2026-09-08T00:07:47Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
