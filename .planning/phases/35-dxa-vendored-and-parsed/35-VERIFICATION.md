---
phase: 35-dxa-vendored-and-parsed
verified: 2026-09-04T16:00:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "Success criterion 2, clause 2 (amended 2026-09-04, commit cffc8056): the shipped parser's loud handling of a real unknown listing form from an actual run, independently re-measured for BOTH real anomalies this phase found."
  gaps_remaining: []
  regressions: []
requirements_confirmed: [DXA-01, DXA-02, DXA-03, DXA-04]
---

# Phase 35: dxa, Vendored and Parsed — Verification Report (re-verification)

**Phase Goal:** A raw C64 image goes in and a machine-readable code/data map comes out, from a
dxa this project vendors and builds at a pinned version — with the listing parser loud by name
rather than silently mis-parsing, and every rate it will ever be measured against derived from a
committed script before the tool runs.

**Verified:** 2026-09-04
**Status:** passed
**Re-verification:** Yes — after an owner-approved amendment to success criterion 2 (commit
`cffc8056`), following my own prior pass (`gaps_found`, 4/5) which contested exactly this clause.

## What changed since the prior pass, and how it was judged

The prior pass's gap was not "the code is wrong" — it was a **naming dispute**: whether SC2's
"this project's parser refusing by name" could be satisfied by a *different*, pre-existing
Phase 23 evidence script (`dxa-listing-parse.mjs`), when the phase's own shipped parser
(`dxa-listing.ts`) demonstrably does NOT refuse on either real anomaly this phase found. My prior
adjudication went AGAINST that reading. The owner did not override that adjudication; instead the
owner amended the criterion itself, on the argument that "refusing by name" named a MECHANISM,
not the actual goal, and that the shipped parser's deliberate report-not-refuse disposition
(decision `A-04`) is a legitimate, superior design that still satisfies the real goal — never
silently absorbing an anomaly.

I re-derived this independently rather than accepting the owner's framing at face value. My own
finding, reached by re-reading `dxa-listing.ts`'s full disposition logic (not just the two cases
this phase happened to find): **every byte `parseDumpListing()` ever touches lands in exactly one
of three loud buckets, with no fourth, silent path.**

1. An in-window byte claimed by exactly one line → `code` or `data` (normal case).
2. An in-window byte claimed by two or more lines → `unclassified`, with every claiming line and
   class named in `reason` (never silently resolved by a tie-break).
3. A byte on a matched line but **outside** the declared window → the **entire line** is pushed
   to `outOfWindow[]`, verbatim, never dropped.
4. Anything that leaves the in-window `covered` set short of or over `imageSize` (a genuine
   *within-window* gap or double-count that classes 1-3 didn't already account for) still trips
   the `covered.size !== imageSize` refusal (`throw`).

There is no code path in which a byte the listing actually emits is discarded without landing in
one of these four dispositions. That is a stronger, more general claim than "the two anomalies we
found happen to be handled" — it is a structural argument that *no* real anomaly can be silently
absorbed by this parser, not just the two discovered so far. This is what makes the amendment
sound rather than merely convenient: it isn't "we got lucky that A-04 covers what we found," it's
"the four-way disposition is exhaustive by construction."

## Task 1 — Does the shipped parser actually satisfy the amended clause?

**Independently re-measured, not merely re-read from evidence.** I reproduced both real anomalies
myself, directly against the real vendored binary and `dxa-listing.ts`'s exported
`parseDumpListing()`, rather than trusting `evidence/35-dxa02-real-refusal.md`'s transcript or the
opt-in live-test suite alone.

**Anomaly 1 — the `$ffff` top-of-memory dump-column wraparound (synthetic-input, real-binary
reproduction of a real dxa behavior).** Ran `dxa-live.test.ts`'s BOUNDARY case directly:

```
VICE_LIVE_DXA=1 VICE_LIVE_DXA_CORPUS=1 node --test dxa-live.test.ts
```

Result: 5/5 pass, including `dxa-live BOUNDARY`, which asserts BOTH `covered.size === 65536`
(no throw) AND `outOfWindow.some(l => l.startsWith("ffff "))` (the artefact is named, not
dropped) — a case that would fail if the parser had merely swallowed the anomaly silently.

**Anomaly 2 — the `$b80f` end-of-image lookahead on the real `danish.d64` → `BRUCE LEE (DC)`
cracked release.** This one is recorded only as a manual evidence transcript
(`evidence/35-dxa02-real-refusal.md` Part 4), not codified as an automated test, so I reproduced
it myself from scratch: extracted the entry with `anno-d64.ts`'s `listEntries()`/`extractEntry()`,
ran the real vendored `dxa` binary with the exact flag set from the evidence record
(`-p all-nmos6502 -d skip-scanning -t detect-internal -R <entrypoints> -a dump`, entry point
`$0819`), and fed the resulting listing straight to `parseDumpListing()`:

```
covered.size = 45072   (equals imageSize exactly — no throw)
outOfWindow  = ["b80f ae a7 00 \t.byt $ae,$a7"]
```

This matches the evidence record's own numbers exactly. **Both real anomalies this phase ever
found are independently confirmed, by my own fresh reproduction (not the phase's own transcript),
to be REPORTED in `outOfWindow[]` and never silently dropped.**

**Verdict on Task 1: the amended clause is met.** The parser is loud, by name, on both real
unknown listing forms an actual run produced — not by a hand-planted line, not by dxa's exit
status (which the evidence record independently shows exits 0 on the same input).

## Task 2 — Is the amendment self-consistent?

**The authoritative text is consistent.** ROADMAP.md's Phase 35 goal line ("the listing parser
loud by name rather than silently mis-parsing"), success criterion 2's opening clause ("the
parser's loud handling ... is observed"), its second sentence ("either refusing, or explicitly
reporting ... so it is never silently absorbed"), and REQUIREMENTS.md's amended DXA-02 body
("the loud failure must come from this project's parser, by name — refusing, or explicitly
reporting the unknown form ... a silent mis-parse is what this forbids") all agree with each
other and with the measured shipped behavior. Criterion 2's clause 1 (overlapping decode →
`unclassified`, never a winner) is unchanged and remains independently verified.

**Two stale, non-authoritative mentions remain elsewhere in ROADMAP.md — flagged, not blocking.**
The amendment was applied to the phase's own detailed Success Criteria block (lines ~880-895) but
not propagated to two other prose spots that still use the pre-amendment "refuses by name"
phrasing:

- Line 456, the milestone Progress index one-liner for Phase 35: "...behind a parser that
  **refuses by name**." This is a summary index entry, not itself a scored success criterion, but
  a reader skimming only the Progress table would form the wrong impression of what this phase
  actually requires.
- Line 1103, the milestone-level validation-strategy note listing "eighteen criteria worthless as
  bare assertions," which still names "the dxa parser refusal" as one of the six Phase 35/36
  controls needing an observed-red transcript. This one is defensible as-is (it is about the
  refusal *mechanism's* red/green validation, which the synthetic sixth-shape test in `35-02`
  does supply), but the phrase itself is stale relative to the amendment.

Neither of these is a live requirement — the authoritative Success Criteria block and
REQUIREMENTS.md's DXA-02 body are the contract this verification scores against, and those are
consistent. This is recorded as a documentation-hygiene note, not a gap.

**Nothing else in ROADMAP.md demands a refusal from the production parser.** Line 575's Phase 24
text (predecessor requirement, "the parser refuses by name, proven by a planted malformed listing
line") is explicitly marked superseded by Phases 35/36 rather than edited in place (line 595's own
note), so it is intentionally historical, not a live duplicate requirement.

## Task 3 — Re-check the other three criteria and DXA-01/03/04 at current HEAD

Independently re-run (not merely re-cited from the prior pass), after confirming the two
code-review fix commits (`756d4a41` fixing CR-01/WR-01, `bd299b8f` dispositioning the review) sit
in the ancestry of HEAD and touch only `dxa-run.ts` (+90/-5) and `dxa-blocks.ts` (+15). Neither
`dxa-listing.ts`, `dxa-partition.ts`, `THIRD-PARTY-NOTICES.md`, nor `vendor/dxa/` changed at all
since the code-review commit `00910763` (confirmed by `git diff --stat`), so SC1/SC3/SC4's
evidentiary basis is untouched by these fixes.

- **`npm run typecheck`** → clean (re-run).
- **DXA-01 digests** → `sha256sum vendor/dxa/dxa` = `0e2bf1a5...ec8523`, matches
  `build.bash`'s `BUILT_BINARY_SHA256` literal exactly; `dxa-0.1.5.tar.gz.sha256` =
  `8e40ed77...826799` (re-measured directly, not copied from the evidence file).
- **DXA-04** → `grep -n "^import" dxa-partition.ts` confirms no `dxa-listing` import (only
  `readFileSync`, `fileURLToPath`, `resolvePath`, `parsePrg`); `dxa-partition.test.ts` 34/34 pass
  (re-run).
- **DXA-03** → `dxa-blocks.ts:70` imports `DATA_TYPES` directly from `anno-types.ts`;
  `dxa-blocks.test.ts` 14/14 pass (re-run).
- **`dxa-listing.test.ts`** → 26/26 pass (re-run) — clause 1 of SC2 (overlapping decode →
  `unclassified`, never a winner, even on agreement) unaffected by the amendment or the fix
  commits.
- **CR-01/WR-01 fixes present at HEAD** — `confineToWorkspace()` (workspace-escape guard, both
  read and write sites) and `assertRowShape()`'s `Number.isInteger()` check (checked first, before
  the range comparisons it previously defeated) both read directly from current source, matching
  `35-REVIEW-FIX.md`'s disposition.
- **Full opt-in live suite**: `VICE_LIVE_DXA=1 VICE_LIVE_DXA_CORPUS=1 node --test dxa-live.test.ts`
  → 5/5 pass (END TO END, EXCLUSION, OMISSION, BOUNDARY, CORPUS) — every case flows through
  `readLocalImageBytes()`/`confineToWorkspace()`, so the CR-01 fix did not regress the legitimate
  read/write paths.
- **`npm run test:automated`** → 3371 tests, 2 unique failing tests (`DIRECTION 5 (basis
  integrity)` and `planted violation (the negative control)`, both in `anno-register.test.ts`,
  both citing `STORE-01`/`STORE-04`/`STORE-06`/`MCP-04` requirements-bookkeeping drift — the
  documented pre-existing floor, unrelated to any file this phase touches). No new failures.
- **No debt markers**: `grep -n -E "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER"` over
  `dxa-listing.ts dxa-partition.ts dxa-blocks.ts dxa-run.ts` → empty.

**No regression found.** All three previously-confirmed criteria (SC1, SC3, SC4) and DXA-01/03/04
hold at current HEAD.

## Task 4 — Was amending the criterion the right call?

**Yes, on the merits, independently re-derived — not merely because the owner said so.** Three
reasons, weighed against the risk the original criterion was meant to guard:

1. **The protection the criterion exists for is preserved, and independently verified.** The
   original text's own stated purpose (superseded Phase 24 text, line 97/575: "a silent mis-parse
   here feeds phantom code into every stage downstream, which is the one failure this parser
   exists to prevent") is fully satisfied — I confirmed above, structurally, that no code path in
   `parseDumpListing()` can absorb an anomaly silently. Report-and-continue is not weaker than
   refuse-and-halt with respect to *that* risk; if anything it is stronger, since the caller still
   gets a full map AND an explicit list of what to distrust, rather than nothing at all.
2. **The empirical bar was not lowered to "anything passes."** Both real anomalies still had to be
   *found* from actual runs (not planted), and both still had to be shown *by measurement* — not
   by narration — to land in an explicit, named bucket rather than vanish. I re-did that
   measurement myself in Task 1 rather than trusting the phase's own transcript, and it holds.
3. **One legitimate concern, not fully closed by this phase, worth surfacing rather than
   silently accepting.** The claim "no amount of further searching would have produced a
   refusal" (ROADMAP's amendment text) is stated more strongly than what was actually
   established. What was established is that the *two* anomalies actually found don't trigger the
   refusal predicate. My own structural analysis above is what actually closes the concern (every
   disposition is loud), not the narrower "we searched and didn't find one" framing the amendment
   leads with. I'd have preferred the amendment's own reasoning to lead with the structural
   exhaustiveness argument rather than the search-exhaustion one, since the latter is weaker on
   its own (absence of evidence). This is a documentation-quality note, not a basis for
   withholding a pass — the stronger argument exists and I verified it directly against the code.

I do not think this amendment weakens a load-bearing protection. I would have flagged it if the
report-not-refuse disposition left any code path unaccounted for; it does not.

## Observable Truths (amended criterion set)

| # | Truth (roadmap success criterion) | Status | Evidence |
|---|---|---|---|
| 1 | SC1 (DXA-01): image → machine-readable map, from a vendored, pinned, digest-gated, locally-built dxa; digest gate before fetch; sha256 re-verified byte-for-byte; build reproduces the pinned binary digest; GPL notice quoted from source headers | ✓ VERIFIED | Digests independently re-measured and matched (Task 3); `build.bash` refuses before fetch on a missing/mismatched pin; `THIRD-PARTY-NOTICES.md:54-127` quotes `main.c`'s header verbatim. |
| 2a | SC2, clause 1: overlapping decode (`jsr` into a mid-instruction target) yields `unclassified` with a stated reason, never a winner | ✓ VERIFIED | `dxa-listing.ts:257-273` (claims-collect-then-resolve, no tie-break); `dxa-listing.test.ts` 26/26 pass (re-run), including a real `-a dump`-shaped agreeing-overlap case. |
| 2b | SC2, clause 2 (AMENDED 2026-09-04): the parser's loud handling of a real unknown listing form from an actual run is observed — refusing, or explicitly reporting so it is never silently absorbed | ✓ VERIFIED | Independently reproduced BOTH real anomalies myself against the real binary and `dxa-listing.ts` directly (Task 1): `$ffff` wraparound → `outOfWindow` names the line, `covered.size === imageSize`, no throw; `$b80f` end-of-image lookahead on real `danish.d64`/`BRUCE LEE` → same disposition, `outOfWindow = ["b80f ae a7 00 \t.byt $ae,$a7"]`. Structural argument (Task 1 preamble) that no fourth, silent disposition exists in `parseDumpListing()`. |
| 3 | SC3 (DXA-03): naming a known-data range excludes those bytes from discovery, via the store's 12-member `DATA_TYPES` vocabulary and `-B`/`-l` emitters, exercised on a real image | ✓ VERIFIED | `dxa-blocks.ts:70` sources `DATA_TYPES` from `anno-types.ts` directly; `dxa-live.test.ts`'s `EXCLUSION`/`CORPUS` cases pass live against the real binary and the real `danish.d64` release (re-run, Task 3). |
| 4 | SC4 (DXA-04): every rate quoted about dxa has a ground-truth partition from a committed script, run before dxa, stating its denominator and positive class | ✓ VERIFIED | `dxa-partition.ts` (688 lines) never imports `dxa-listing.ts` (re-confirmed by grep); reproduces Phase 23's 145/131/3 exactly; `renderPartitionReport()` always states both tiers and `POSITIVE_CLASS: data`. |

**Score:** 5/5 truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/mcp/vice/vendor/dxa/` (17 files + build.bash + pin + README) | Pinned, digest-verified, buildable dxa 0.1.5 source | ✓ VERIFIED | On-disk digests match pins exactly (re-measured). |
| `src/mcp/vice/dxa-listing.ts` | Owns all 5 measured line shapes, window-contract disposition (refuse/report/unclassified), unclassified overlap disposition | ✓ VERIFIED, including on both real anomalies this phase found | 308 lines; `dxa-listing.test.ts` 26/26 pass; both real anomalies independently reproduced by this verifier (Task 1). |
| `src/mcp/vice/dxa-partition.ts` | Two-tier ground-truth partition producer, never imports `dxa-listing.ts` | ✓ VERIFIED | 688 lines; `dxa-partition.test.ts` 34/34 pass; no `dxa-listing` import. |
| `src/mcp/vice/dxa-blocks.ts` | `-B`/`-l` emitter from the store's 12-member vocabulary, integer-address guard | ✓ VERIFIED | 238 lines; `dxa-blocks.test.ts` 14/14 pass; `Number.isInteger()` check present and ordered first (WR-01 fix, confirmed at HEAD). |
| `src/mcp/vice/dxa-run.ts` | Container-side orchestration through the host-tool seam; workspace-confined local I/O | ✓ VERIFIED | 294 lines (grew from 199 in the CR-01 fix); `confineToWorkspace()` present at the image-read site and both write sites, confirmed at current HEAD. |
| `THIRD-PARTY-NOTICES.md` | GPL-2.0-or-later notice quoted from source headers, licence text supplied | ✓ VERIFIED | 534 lines; unchanged since the code-review commit. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `host-tool.mts` `dxa.disassemble` branch | `vendor/dxa/dxa` (built binary) | `findDxaBinary()` two-candidate probe | ✓ WIRED | `dxa-live.test.ts` END TO END case passes (re-run). |
| `dxa-run.ts` | `dxa-listing.ts`'s `parseDumpListing()` | window (`origin`/`imageSize`) computed from the image file, never the listing, now through `confineToWorkspace()` | ✓ WIRED | Confirmed in source; all 5 live cases (which all exercise this path) pass. |
| `dxa-blocks.ts` `emitDataBlocks()`/`emitLabels()` | `dxa-run.ts`'s wire request (`datablocksPath`/`labelsPath`) | `DxaRunArgs.knownDataRows` branch, now through `confineToWorkspace()` on the write side | ✓ WIRED | `dxa-live.test.ts` OMISSION/EXCLUSION cases both pass live (re-run). |
| `dxa-partition.ts` | `dxa-listing.ts` | explicitly NEVER imports it | ✓ VERIFIED ABSENT | `grep -n "^import" dxa-partition.ts` → no `dxa-listing` (re-run, Task 3). |

### Behavioral Spot-Checks / Live Runs (independently re-executed by this verifier)

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full opt-in live suite against real pinned binary | `VICE_LIVE_DXA=1 VICE_LIVE_DXA_CORPUS=1 node --test dxa-live.test.ts` | 5/5 pass (END TO END, EXCLUSION, OMISSION, BOUNDARY, CORPUS) | ✓ PASS |
| Fresh, from-scratch reproduction of the `$b80f` real-cracked-release anomaly (not just the BOUNDARY test, which only covers `$ffff`) | ad hoc script: `anno-d64.ts` extract → real `dxa` binary → `parseDumpListing()` | `covered.size === 45072`, `outOfWindow === ["b80f ae a7 00 \t.byt $ae,$a7"]` | ✓ PASS |
| Typecheck | `npm run typecheck` | clean | ✓ PASS |
| `dxa-listing.test.ts` | `node --test dxa-listing.test.ts` | 26/26 pass | ✓ PASS |
| `dxa-partition.test.ts` | `node --test dxa-partition.test.ts` | 34/34 pass | ✓ PASS |
| `dxa-blocks.test.ts` | `node --test dxa-blocks.test.ts` | 14/14 pass | ✓ PASS |
| Full automated suite | `npm run test:automated` | 3371 tests, 2 unique failing tests (both `anno-register.test.ts`, pre-existing `STORE-*`/`MCP-04` bookkeeping drift, unrelated to dxa) | ✓ PASS (no phase-35 regression) |
| Built binary digest | `sha256sum vendor/dxa/dxa` | `0e2bf1a5...ec8523`, matches `build.bash`'s pin exactly | ✓ PASS |
| Tarball pin digest | `cat vendor/dxa/dxa-0.1.5.tar.gz.sha256` | `8e40ed77...826799` | ✓ PASS |
| No `dxa-listing` import in `dxa-partition.ts` | `grep -n "^import" dxa-partition.ts` | 4 imports, none `dxa-listing` | ✓ PASS |
| Debt-marker scan | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` over the four phase-35 modules | 0 matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | REQUIREMENTS.md status (as of this write-up) | Verifier verdict |
|---|---|---|---|---|
| DXA-01 | 35-01, 35-05 | Vendored, pinned, digest-gated, locally-built dxa; GPL notice from source headers | Complete | ✓ CONFIRMED |
| DXA-02 | 35-01, 35-02, 35-05 | Listing parsed into byte-level map; loud handling by name (refuse or explicit report), not exit status; overlapping decode → unclassified | Gaps Found (stale — reverted before the amendment landed; recommend flipping to Complete) | ✓ CONFIRMED under the amended text, independently re-measured |
| DXA-03 | 35-04 | Known-data ranges excluded from discovery via `-B`/`-l`, store vocabulary, exercised on a real image | Complete | ✓ CONFIRMED |
| DXA-04 | 35-03 | Ground-truth partition from a committed script, run before dxa, denominator/positive-class stated | Complete | ✓ CONFIRMED |

**Note on DXA-02's REQUIREMENTS.md row:** it still reads "Gaps Found" because it was reverted
(`c56fa7d1`) before the amendment (`cffc8056`) landed, and nothing has flipped it back since. This
verification's own verdict is CONFIRMED; updating the REQUIREMENTS.md status row is a bookkeeping
step outside this report's own authority to perform, but is recommended as the immediate next
action.

No orphaned requirements: `grep -E "Phase 35" .planning/REQUIREMENTS.md` shows exactly these four,
all declared across the five plans' `requirements:` frontmatter fields.

### Anti-Patterns Found

None of severity blocker/warning in the current source tree. The code-review gate (`35-REVIEW.md`)
found one BLOCKER (CR-01) and one WARNING (WR-01) — both independently confirmed FIXED at current
HEAD (Task 3). One INFO item (IN-01, unused import in `host-tool.mts`, pre-existing from Phase 34)
is accepted-not-fixed with a stated rationale in `35-REVIEW-FIX.md`.

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any phase-35-authored source
file.

**Documentation-hygiene note (non-blocking):** two prose mentions in ROADMAP.md outside the
phase's own Success Criteria block still use pre-amendment "refuses by name" language (line 456's
Progress-index one-liner, line 1103's validation-strategy note) — see Task 2 above. Recommend a
small follow-up edit so a skim of the Progress table doesn't misstate the current requirement.

### Human Verification Required

None. Every fact needed for this re-verification was independently measured directly against the
current source and the real vendored binary, including a from-scratch reproduction of both real
anomalies rather than relying on the phase's own transcripts.

### Gaps Summary

None. All four roadmap success criteria are independently verified at current HEAD, including the
amended clause, which this verifier re-derived and confirmed on its own terms rather than
accepting the amendment on the owner's authority alone. The two code-review fix commits that
landed after the prior pass touch only `dxa-run.ts` and `dxa-blocks.ts`, are additive
hardening (workspace confinement, integer-address guard), and do not disturb any previously
confirmed criterion — re-run and re-confirmed directly. One non-blocking documentation-hygiene
item remains (stale "refuses by name" phrasing in two ROADMAP.md prose spots outside the
authoritative criteria block) and one bookkeeping item remains (REQUIREMENTS.md's DXA-02 status
row still reads "Gaps Found" and should be updated to reflect this verification's CONFIRMED
verdict).

---

_Verified: 2026-09-04_
_Verifier: Claude (gsd-verifier)_
