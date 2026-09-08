---
phase: 39-the-dual-channel-coexistence-gate-go-degrade-no-go
fixed_at: 2026-09-08T00:17:11Z
review_path: .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/39-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 6
skipped: 2
status: partial
---

# Phase 39: Code Review Fix Report

**Fixed at:** 2026-09-08
**Source review:** `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/39-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (1 critical + 4 warnings + 3 info)
- Fixed: 6 (CR-01, WR-02 [doc-only], WR-03, WR-04, IN-01, IN-02)
- Skipped (wontfix, reasoned): 2 (WR-01, IN-03)

**Gate result:** `node --test textmon-fixtures.test.ts` — 17/17 pass (was 11/11 before this
round; 5 new per-key tests from WR-04, 1 new path-traversal test from IN-01). `npx tsc --noEmit`
(via `npm run typecheck`) clean. No file under `src/mcp/vice/fixtures/textmon/*.txt` or `*.json`,
`binmon-fixtures.ts`, or `.planning/phases/39-*/evidence/` was touched.

## Fixed Issues

### CR-01: README's universal "entry-echo, then output, then exit-prompt" framing claim is contradicted by 10 of the 12 committed fixture payloads

**Files modified:** `src/mcp/vice/fixtures/textmon/README.md`
**Commit:** `760280bd`
**Applied fix:** Re-derived the `(C:$xxxx)` occurrence counts myself against the committed
payloads (byte-inspected with `grep -a`, not copied from the review on trust) — confirmed
`access-map-{stock,fork}.txt` = 2, `backtrace-{stock,fork}.txt` = 1,
`cpu-history-{stock,fork}.txt` = 1, `flat-profile-{stock,fork}.txt` = 1,
`register-decode-{stock,fork}.txt` = 1, `connect-banner-{stock,fork}.txt` = 0 — an exact match to
the review's own counts. Rewrote the "Framing" section's heading and body to state plainly that
only `memmapshow` (`access-map-*`) carries a leading entry-echo prompt, that the other four command
pairs carry only the trailing exit-prompt, and that `connect-banner` carries neither (it is the
pre-prompt banner, captured before any command is sent). Also corrected the second, previously
unflagged instance of the same false universal claim in the "Source paths" section's intro
paragraph ("including both the entry-echo prompt and the final exit prompt … with no trimming"),
which the review's Issue text also quoted as part of CR-01's claim.

## Warnings

### WR-01: Provenance validation checks key presence, never value type — a malformed sidecar can load "successfully"

**Disposition:** wontfix, mirrored by design.
**Reasoning:** D-18 requires `textmon-fixtures.ts` to mirror `binmon-fixtures.ts`'s sidecar-validation
contract exactly — presence-only, not type-checked (`binmon-fixtures.ts:289-297` has the identical
`k in provenance` / `=== true` pattern, confirmed by reading that file directly rather than assuming
the review's citation). Tightening only the text loader would make the two loaders disagree about
what a valid sidecar is, which is worse than the shared gap: a caller could no longer trust "both
loaders enforce the same five-key contract" without checking which one. If this gap is ever closed,
it must be closed in both `textmon-fixtures.ts` and `binmon-fixtures.ts` in one change — no code
changed here.

### WR-02: All twelve committed sidecars share the exact same millisecond-precision `capturedAt`, which is implausible for independent live captures

**Files modified:** `src/mcp/vice/fixtures/textmon/README.md`
**Commit:** `2ba0d973`
**Disposition:** wontfix (regenerating with fabricated per-file timestamps is explicitly out of
scope — inventing provenance is strictly worse than imprecise provenance, and `synthetic: false`
already asserts these are real captures), documented.
**Applied fix:** Added one sentence stating `capturedAt` is the batch run's start time, not each
individual capture's completion time, so a future reader does not mistake the shared timestamp for
per-capture measurement. No fixture file (`.txt`/`.json`) was touched — only the README.

### WR-03: README's "Case" column values are not valid `loadTextFixture()` arguments

**Files modified:** `src/mcp/vice/fixtures/textmon/README.md`
**Commit:** `559bbdf2`
**Applied fix:** Verified the real loader case names by calling `listTextFixtures()` directly against
the committed fixture directory (returns exactly the 12 `-stock`/`-fork` suffixed stems, confirmed
live, not assumed from the review). Renamed the Source-paths table's "Case" column to "Command
group" and added an explicit "Loader case name" column carrying the real suffixed stems, plus a
one-line note that the bare command-group name is never a valid `caseName`. Also renamed the
"Case" header in the separate command-set table to "Command group" for consistency, since its
values were never loader case names either.

### WR-04: The missing-key test exercises only one combined-omission scenario, not each of the five required keys individually

**Files modified:** `src/mcp/vice/textmon-fixtures.test.ts`
**Commit:** `564445e7`
**Applied fix:** Added a loop over `REQUIRED_PROVENANCE_KEYS`, producing five new sub-tests, each
writing a sidecar with all five keys present except exactly one, and asserting the thrown message
names that one omitted key. The original combined-omission test was left in place unchanged. Kept
entirely inside the existing `textmon-fixtures.test.ts` — no second test file was added (D-19
authorized exactly one for this phase; `test-gate.test.ts`'s `MANUAL_ONLY_TESTS` union guard would
trip on a second).

## Info

### IN-01: `loadTextFixture`'s `caseName` is joined into the fixture path with no traversal guard

**Files modified:** `src/mcp/vice/textmon-fixtures.ts`, `src/mcp/vice/textmon-fixtures.test.ts`
**Commit:** `be9cf695`
**Judgment:** fixed, not wontfix. No untrusted input reaches `caseName` today, but the guard is
cheap and every real case name is a bare `-stock`/`-fork` suffixed stem with no directory
component, so it cannot reject any currently-passing call. Added a check at the top of
`loadTextFixture()` refusing any `caseName` containing `/`, `\`, or `..`, throwing the existing
`MissingTextFixtureError` type rather than resolving outside `baseDir`. Verified all nine call
sites in `textmon-fixtures.test.ts` still pass (17/17) and added a new test proving the refusal for
five representative malicious inputs (`../../../etc/passwd`, `sub/dir`, `sub\dir`, `..`, `a/../b`).

### IN-02: Two committed-fixture assertions use loose lower-bound thresholds instead of the actual known counts

**Files modified:** `src/mcp/vice/textmon-fixtures.test.ts`
**Commit:** `2abde0b1`
**Judgment:** fixed, not left loose. The counts are not environment-dependent — the fixture batch
is committed and fixed in size — so tightening is safe. `assert.ok(cases.length >= 6, ...)` became
`assert.equal(cases.length, 12, ...)` and `assert.ok(paths.size >= 2, ...)` became
`assert.equal(paths.size, 2, ...)`, both verified against the actual committed batch
(`listTextFixtures()` returns 12 names; the two `capturedFrom` prefixes are `stock:`/`fork:`). This
is exactly the class of gap CR-01 demonstrated matters: a loose threshold is what let a false
framing claim survive undetected.

### IN-03: `connect-banner`'s `command` field is a prose description, not a literal command

**Disposition:** wontfix, intentional and already documented.
**Reasoning:** The banner arrives before any command is sent, so there is no literal command to
name — `"(connect banner, no command sent)"` is the only honest value for this one field on these
two sidecars. The README's own "The command set" table already documents this
(`connect-banner | (none — captured from the connect itself) | ...`). No code or documentation
changed for this finding.

---

_Fixed: 2026-09-08_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
