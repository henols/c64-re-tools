---
phase: 35-dxa-vendored-and-parsed
verified: 2026-09-04T13:00:00Z
status: gaps_found
score: 4/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "Success criterion 2, clause 2: 'The parser's refusal is observed, provoked by a real unknown listing form from an actual run ... It is this project's parser refusing by name.'"
    status: partial
    reason: >
      A real, unplanted anomaly WAS found from an actual dxa run (the top-of-memory `$ffff`
      dump-column wraparound) and a real refusal WAS captured from it — but the refusal came
      from `dxa-listing-parse.mjs`, a pre-existing Phase 23 evidence script, not from
      `dxa-listing.ts`, the parser this phase (35) actually ships and the module the phase goal's
      own text ("the listing parser refusing by name") and success-criterion 2's own subject
      ("this project's parser") most naturally refer to. `dxa-listing.ts` was deliberately
      redesigned (decision A-04) NOT to refuse on this exact artefact, and this was confirmed by
      direct measurement (`covered.size === imageSize`, no throw — `dxa-live.test.ts`'s BOUNDARY
      case). A second real anomaly independently found on a real cracked release (BRUCE LEE via
      `danish.d64`, an end-of-image lookahead at `$b80f`) also does not provoke a refusal in
      `dxa-listing.ts`. Across every real run this phase performed, the SHIPPED production parser
      has never been observed to refuse on real dxa output — only a retired, non-shipped sibling
      script has. See "Criterion 2 adjudication" below for the full reasoning and the override
      path if the alternative reading is preferred.
    artifacts:
      - path: "src/mcp/vice/dxa-listing.ts"
        issue: "Never observed to refuse on any real dxa output collected by this phase; its one refusal predicate (`covered.size !== imageSize`) has only been exercised by a synthetic sixth-shape fixture (35-02) and by construction cannot be exercised by either real anomaly this phase found, both of which land inside the declared window."
    missing:
      - "Either: a real listing form that DOES provoke `dxa-listing.ts`'s own `covered.size !== imageSize` refusal from an actual run (none has been found in this phase's testing), or an explicit, human-accepted override recording that a pre-existing sibling script satisfies criterion 2's 'this project's parser' clause and that the production parser's report-not-refuse disposition on the two real anomalies found is the intended, accepted resolution."
requirements_contested:
  - id: DXA-02
    marked: Complete
    verdict: partially-contested
    reason: "The overlapping-decode ('unclassified with a stated reason, never a winner') half of DXA-02 is fully verified, including on a real -a-dump-shaped jsr-into-mid-instruction-target case. The 'real refusal, provoked by a real unknown listing form, from THIS project's own shipped parser' half is not verified — see the gap above."
requirements_confirmed: [DXA-01, DXA-03, DXA-04]
---

# Phase 35: dxa, Vendored and Parsed — Verification Report

**Phase Goal:** A raw C64 image goes in and a machine-readable code/data map comes out, from a
dxa this project vendors and builds at a pinned version — with the listing parser refusing by
name rather than silently mis-parsing, and every rate it will ever be measured against derived
from a committed script before the tool runs.

**Verified:** 2026-09-04
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (roadmap success criterion) | Status | Evidence |
|---|---|---|---|
| 1 | SC1 (DXA-01): image → machine-readable map, from a vendored, pinned, digest-gated, locally-built dxa; digest gate before fetch; sha256 re-verified byte-for-byte; build reproduces the pinned binary digest; GPL notice quoted from source headers | ✓ VERIFIED | Independently re-measured: `vendor/dxa/dxa-0.1.5.tar.gz.sha256` = `8e40ed77...826799`; on-disk `vendor/dxa/dxa` sha256 = `0e2bf1a5...ec8523`, matching `build.bash`'s `BUILT_BINARY_SHA256` literal exactly. `build.bash` reads the pin file and refuses by name before any `curl`/fetch code path runs (lines 55-73, confirmed by direct read). `THIRD-PARTY-NOTICES.md:54-127` quotes `main.c`'s header verbatim, records per-file copyright variance, states the absent `LICENSE`/`COPYING` file, and supplies full GPL-2.0 text. `evidence/35-dxa01-reproducible-build.md` records all four digests, two equalities, and a pin-removed refusal transcript with no `curl` line. |
| 2a | SC2, clause 1: overlapping decode (`jsr` into a mid-instruction target) yields `unclassified` with a stated reason, never a winner | ✓ VERIFIED | `dxa-listing.ts:227-273` (claims-collect-then-resolve; no tie-break of any kind, confirmed by source-level grep-shaped test asserting zero occurrences of a resolution rule). `dxa-listing.test.ts` (26/26 pass, independently re-run) includes a case built from two REAL `-a dump`-shaped lines producing an overlapping decode, asserting `unclassified` with both claims named, even when the two claims agree on class. |
| 2b | SC2, clause 2: the parser's refusal is **observed**, provoked by a **real unknown listing form from an actual run**, and it is **this project's [shipped] parser** refusing by name | ✗ PARTIAL / CONTESTED | See "Criterion 2 adjudication" below. A real, unplanted refusal WAS captured (`evidence/35-dxa02-real-refusal.md`), but from `dxa-listing-parse.mjs` (a Phase 23 evidence script), not from `dxa-listing.ts` (this phase's shipped parser), which was deliberately redesigned NOT to refuse on the only two real anomalies this phase found and was confirmed, by measurement, not to. |
| 3 | SC3 (DXA-03): naming a known-data range excludes those bytes from discovery, via the store's 12-member `DATA_TYPES` vocabulary and `-B`/`-l` emitters, exercised on a real image | ✓ VERIFIED | `dxa-blocks.ts:70-78` sources `DATA_TYPES` from `anno-types.ts` directly (no thirteenth type, no parallel vocabulary — confirmed by grep). `evidence/35-dxa03-real-image.md`: real `danish.d64` corpus, extracted `BRUCE LEE (DC)`, before/after dxa classification of `$0819-$081f` (code → data) on the REAL vendored binary. Independently re-run: `dxa-live.test.ts`'s `EXCLUSION` and `CORPUS` cases both pass live against the real binary (5/5 in the full opt-in suite). |
| 4 | SC4 (DXA-04): every rate quoted about dxa has a ground-truth partition from a committed script, run before dxa, stating its denominator and positive class | ✓ VERIFIED | `dxa-partition.ts` (688 lines): two tiers, neither imports `dxa-listing.ts` or dxa's own output (confirmed by grep). Source-derived tier reproduces Phase 23's re-derived 145/131/3 exactly (independently re-run: `dxa-partition.test.ts` 34/34 pass). Byte-derived tier decides only the `.prg` header exclusion and a cleanly-parsed BASIC stub's certain-data span, reporting the rest `unknown`. `renderPartitionReport()` always names both tiers and states `POSITIVE_CLASS: data`; a zero-denominator rate is refused by name (tested). No `PROOF-01` claim or dxa-accuracy-on-real-code rate anywhere in this phase's code or evidence (confirmed by this verifier's own re-grep of all 4 evidence files, matching the phase's own honesty-pass result: 0 occurrences). |

**Score:** 4/5 truths verified (one truth, 2b, is a contested partial — see adjudication).

### Criterion 2 adjudication (required, not deferred)

Both readings the orchestrator flagged are real and arguable. I adopt the **AGAINST** reading —
criterion 2 is **not fully met** — for three reasons, weighed directly against the FOR reading:

1. **The phase's own goal text names a specific artifact.** The ROADMAP phase goal reads "...with
   **the listing parser** refusing by name..." (definite article, singular) in a phase whose
   entire deliverable IS `dxa-listing.ts` — the module every plan, every SUMMARY, and
   `THIRD-PARTY-NOTICES.md`'s own sibling documentation call "this project's [parser] to own and
   maintain." A pre-existing sibling script from a *different, already-closed* phase's evidence
   directory (`dxa-listing-parse.mjs`, Phase 23) is a defensible reading of "this project's own
   work" in the abstract, but it is not what a reader of Phase 35's goal statement — which exists
   specifically to deliver that parser — would understand "the listing parser" to mean.
2. **The empirical fact stands regardless of which script counts.** Across every real dxa run this
   phase performed (the top-of-memory wraparound, and the independently-discovered end-of-image
   lookahead on a real cracked release), `dxa-listing.ts` — the shipped, current, production
   parser — has *never once* been observed to refuse on real output. Its one refusal predicate
   (`covered.size !== imageSize`) has only ever fired on a hand-constructed synthetic sixth-shape
   line (35-02's own disclosed key-decision). That is precisely the category of evidence
   `DXA-02`'s amended text was written to exclude ("not only by a hand-planted malformed line").
3. **The redesign that prevents this is a legitimate, disclosed engineering call — but it changes
   what SC2 actually asks for, not just how it is satisfied.** A-04's window-contract redesign
   (report an out-of-window line in `outOfWindow[]` rather than refuse) is *better* than the
   Phase 23 script's naive running-count refusal in the cases this phase found — arguably it
   avoids a spurious refusal on a perfectly good listing. But SC2 explicitly asks for an
   *observed refusal*, not merely "never silently mis-parses" (the report-don't-refuse-don't-drop
   disposition is a third outcome the roadmap's refuse-vs-silently-mis-parse dichotomy did not
   anticipate). The phase's own evidence honestly states this is the tool's disposition, but
   candor about the gap does not close it.

**What is genuinely strong here, and is not in dispute:** the refusal *mechanism* in
`dxa-listing.ts` is real, tested, and correctly wired (a synthetic sixth shape does refuse, by
name, with the right diagnostic fields); the real, unplanted top-of-memory artifact is a
significant and honestly-documented discovery; and the decision to report rather than refuse on
it is defensible and well-reasoned, not an oversight. This is why the gap is scored as a
**partial**, not a full failure of criterion 2, and why 2a is separately scored VERIFIED.

**This looks like it may be intentional** — accepting the FOR reading is a reasonable outcome if
the phase owner judges "this project's parser" to include Phase 23's evidence script and accepts
that the shipped `dxa-listing.ts` reporting (not refusing) on real anomalies satisfies the
phase's intent. To accept this deviation, add to this file's frontmatter:

```yaml
overrides:
  - must_have: "Success criterion 2, clause 2: this project's parser refusing by name, provoked by a real unknown listing form from an actual run"
    reason: "dxa-listing-parse.mjs is a committed script in this repository and therefore satisfies 'this project's parser'; dxa-listing.ts's deliberate report-not-refuse disposition of the same real artefact is an accepted, superior design choice, not a gap."
    accepted_by: "<name>"
    accepted_at: "<ISO timestamp>"
```

If no override is recorded, the honest state of this phase is: DXA-02 is not fully satisfied by
the shipped parser, and a future real-world listing form that genuinely needs refusal (as opposed
to reporting) has not yet been found or exercised against `dxa-listing.ts`.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/mcp/vice/vendor/dxa/` (17 files + build.bash + pin + README) | Pinned, digest-verified, buildable dxa 0.1.5 source | ✓ VERIFIED | On-disk digests match pins exactly; `build.bash` reproduces `dxa` at pinned digest (re-run by this verifier: `bash vendor/dxa/build.bash verify` implicit via digest comparison above). |
| `src/mcp/vice/dxa-listing.ts` | Owns all 5 measured line shapes, window-contract refusal, unclassified overlap disposition | ✓ VERIFIED (mechanism) / ⚠️ never observed refusing on real input | 308 lines, exported `parseDumpListing`/`DumpListingMap`/`DumpRange`/`UnclassifiedByte`; `dxa-listing.test.ts` 26/26 pass (re-run). |
| `src/mcp/vice/dxa-partition.ts` | Two-tier ground-truth partition producer, never imports `dxa-listing.ts` | ✓ VERIFIED | 688 lines; `dxa-partition.test.ts` 34/34 pass (re-run); no `dxa-listing` import (confirmed by grep). |
| `src/mcp/vice/dxa-blocks.ts` | `-B`/`-l` emitter from the store's 12-member vocabulary | ✓ VERIFIED | 238 lines; `dxa-blocks.test.ts` 14/14 pass (re-run); sources `DATA_TYPES` from `anno-types.ts` (confirmed by grep). |
| `src/mcp/vice/dxa-run.ts` | Container-side orchestration through the host-tool seam; workspace-confined I/O | ✓ VERIFIED | 294 lines; `confineToWorkspace()` present and applied at both the image-read site (`:197`) and both write sites (`:251-252`) — the CR-01 code-review fix, confirmed present in source, not merely claimed in REVIEW-FIX.md. |
| `THIRD-PARTY-NOTICES.md` | GPL-2.0-or-later notice quoted from source headers, licence text supplied | ✓ VERIFIED | 534 lines; dxa section at `:54-127` quotes `main.c`'s header verbatim, records per-file copyright variance, states absent `LICENSE`/`COPYING`. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `host-tool.mts` `dxa.disassemble` branch | `vendor/dxa/dxa` (built binary) | `findDxaBinary()` two-candidate probe | ✓ WIRED | `dxa-live.test.ts` END TO END case runs the real seam-resolved binary path successfully (re-run: pass). |
| `dxa-run.ts` | `dxa-listing.ts`'s `parseDumpListing()` | window (`origin`/`imageSize`) computed from the image file, never the listing | ✓ WIRED | Confirmed in `dxa-run.ts` source: `parsePrg()`/`flatImageOrigin()` compute origin/imageSize before any listing text is read. |
| `dxa-blocks.ts` `emitDataBlocks()`/`emitLabels()` | `dxa-run.ts`'s wire request (`datablocksPath`/`labelsPath`) | `DxaRunArgs.knownDataRows` branch | ✓ WIRED | `dxa-live.test.ts` OMISSION case (zero rows → no path/flag emitted) and EXCLUSION case (non-zero rows → dxa's own classification changes) both pass live. |
| `dxa-partition.ts` | `dxa-listing.ts` | explicitly NEVER imports it (two independent ground-truth sources) | ✓ VERIFIED ABSENT | `grep -n "dxa-listing" dxa-partition.ts` → no match. |

### Behavioral Spot-Checks / Live Runs (independently re-executed by this verifier)

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full opt-in live suite against real pinned binary | `VICE_LIVE_DXA=1 VICE_LIVE_DXA_CORPUS=1 node --test dxa-live.test.ts` | 5/5 pass (END TO END, EXCLUSION, OMISSION, BOUNDARY, CORPUS) | ✓ PASS |
| Typecheck | `npm run typecheck` | clean | ✓ PASS |
| `dxa-listing.test.ts` | `node --test dxa-listing.test.ts` | 26/26 pass | ✓ PASS |
| `dxa-partition.test.ts` | `node --test dxa-partition.test.ts` | 34/34 pass | ✓ PASS |
| `dxa-blocks.test.ts` | `node --test dxa-blocks.test.ts` | 14/14 pass | ✓ PASS |
| Seam/family-floor suites | `node --test hostpath-consumers.test.ts host-tool.test.ts dxa-seam.test.ts dxa-build-gate.test.ts` | 124/124 pass | ✓ PASS |
| Full automated suite | `npm run test:automated` | 3371 tests, 3362 pass, 2 unique failing tests (both in `anno-register.test.ts`, pre-existing `STORE-*`/`MCP-04` bookkeeping drift, unrelated to dxa) | ✓ PASS (no phase-35 regression) |
| Packaging leak check | `node scripts/check-npm-packages.mjs` | 86 files, no `vendor/`, no test files leaked | ✓ PASS |
| Built binary digest | `sha256sum vendor/dxa/dxa` | `0e2bf1a5...ec8523`, matches `build.bash`'s pin exactly | ✓ PASS |
| Tarball pin digest | `cat vendor/dxa/dxa-0.1.5.tar.gz.sha256` | `8e40ed77...826799` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | REQUIREMENTS.md status | Verifier verdict |
|---|---|---|---|---|
| DXA-01 | 35-01, 35-05 | Vendored, pinned, digest-gated, locally-built dxa; GPL notice from source headers | Complete | ✓ CONFIRMED |
| DXA-02 | 35-01, 35-02, 35-05 | Listing parsed into byte-level map; refusal by name (not exit status); overlapping decode → unclassified | Complete | ⚠️ CONTESTED — the overlap-disposition half is confirmed; the "real refusal, this project's [shipped] parser" half is not (see gap/adjudication above) |
| DXA-03 | 35-04 | Known-data ranges excluded from discovery via `-B`/`-l`, store vocabulary, exercised on a real image | Complete | ✓ CONFIRMED |
| DXA-04 | 35-03 | Ground-truth partition from a committed script, run before dxa, denominator/positive-class stated | Complete | ✓ CONFIRMED |

No orphaned requirements: `grep -E "Phase 35" .planning/REQUIREMENTS.md` shows exactly these four, all declared across the five plans' `requirements:` frontmatter fields.

### Anti-Patterns Found

None of severity blocker/warning in the current source tree. The code-review gate
(`35-REVIEW.md`) found one BLOCKER (CR-01: unconfined local I/O in `dxa-run.ts`) and one WARNING
(WR-01: missing `Number.isInteger()` check in `dxa-blocks.ts`'s `assertRowShape()`) — **both
independently confirmed FIXED** in the current source (`confineToWorkspace()` present and applied
at all three call sites in `dxa-run.ts`; `Number.isInteger()` check present and ordered first in
`dxa-blocks.ts:144`). One INFO item (IN-01, an unused import in `host-tool.mts` pre-existing from
Phase 34) is accepted-not-fixed with a stated, reasonable rationale in `35-REVIEW-FIX.md`.

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any phase-35-authored source
file (`dxa-listing.ts`, `dxa-partition.ts`, `dxa-blocks.ts`, `dxa-run.ts`).

### Human Verification Required

None required beyond the developer decision already surfaced in "Criterion 2 adjudication" above
(whether to accept the override for SC2 clause 2). That decision is structural/interpretive, not
something further automated or manual testing would resolve — every fact needed to decide it is
already measured and recorded in `evidence/35-dxa02-real-refusal.md` and independently
re-confirmed by this verification pass.

### Gaps Summary

Three of four roadmap success criteria (SC1, SC3, SC4) are fully and independently verified —
digests re-computed and matched, live tests re-run against the real pinned binary, source
re-read line-by-line for the CR-01/WR-01 fixes, and the ground-truth partition script re-run
against its committed fixtures. SC2 is split: the overlapping-decode disposition
(`unclassified`, never a winner, even on agreement) is solid and independently confirmed. The
"real refusal, provoked by an actual run, by this project's own [shipped] parser" clause is not
met by `dxa-listing.ts` as shipped — the only real, unplanted refusal this phase produced came
from a different, pre-existing script (`dxa-listing-parse.mjs`, Phase 23), and the production
parser was deliberately redesigned, and confirmed, to REPORT rather than REFUSE on both real
anomalies this phase discovered. This is disclosed candidly in the phase's own evidence and
SUMMARY — it is not a concealment, and the underlying engineering decision (A-04) is reasonable
— but the specific letter of success criterion 2 is not satisfied by the current codebase absent
an explicit override decision. See the override block above for the concrete path to close this
without further code changes, if the phase owner agrees with the FOR reading.

---

_Verified: 2026-09-04_
_Verifier: Claude (gsd-verifier)_
