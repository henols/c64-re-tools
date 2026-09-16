---
phase: 50-equivalence-and-modifiability
verified: 2026-09-16T13:00:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".planning/REQUIREMENTS.md"
  - ".planning/phases/50-equivalence-and-modifiability/50-01-PLAN.md"
  - ".planning/phases/50-equivalence-and-modifiability/50-01-SUMMARY.md"
  - ".planning/phases/50-equivalence-and-modifiability/50-02-PLAN.md"
  - ".planning/phases/50-equivalence-and-modifiability/50-02-SUMMARY.md"
  - ".planning/phases/50-equivalence-and-modifiability/50-03-PLAN.md"
  - ".planning/phases/50-equivalence-and-modifiability/50-03-SUMMARY.md"
  - ".planning/phases/50-equivalence-and-modifiability/50-04-PLAN.md"
  - ".planning/phases/50-equivalence-and-modifiability/50-04-SUMMARY.md"
  - ".planning/phases/50-equivalence-and-modifiability/50-05-PLAN.md"
  - ".planning/phases/50-equivalence-and-modifiability/50-05-SUMMARY.md"
  - ".planning/phases/50-equivalence-and-modifiability/50-06-PLAN.md"
  - ".planning/phases/50-equivalence-and-modifiability/50-06-SUMMARY.md"
  - ".planning/phases/50-equivalence-and-modifiability/50-07-PLAN.md"
  - ".planning/phases/50-equivalence-and-modifiability/50-07-SUMMARY.md"
  - ".planning/phases/50-equivalence-and-modifiability/50-08-PLAN.md"
  - ".planning/phases/50-equivalence-and-modifiability/50-08-SUMMARY.md"
  - ".planning/phases/50-equivalence-and-modifiability/50-REVIEW.md"
  - ".planning/phases/50-equivalence-and-modifiability/evidence/LOAD-ROUTE.md"
  - ".planning/phases/50-equivalence-and-modifiability/evidence/REBUILD.md"
  - ".planning/phases/50-equivalence-and-modifiability/evidence/capture-run.mjs"
  - ".planning/phases/50-equivalence-and-modifiability/evidence/make-rebuild.mjs"
  - ".planning/phases/50-equivalence-and-modifiability/evidence/make-sidecar.mjs"
  - "docs/phase50-ci-boundary.md"
  - "docs/phase50-equivalence-transcript.md"
  - "docs/phase50-exported-edit-findings.md"
  - "docs/phase50-exported-modifiability-transcript.md"
  - "docs/phase50-modifiability-findings.md"
  - "docs/phase50-modifiability-transcript.md"
  - "src/mcp/vice/fixtures/hazard-subject/exported-edit.manifest.json"
  - "src/mcp/vice/fixtures/hazard-subject/hazard-subject-align-nosprite.a"
  - "src/mcp/vice/fixtures/hazard-subject/hazard-subject-align-regressed.a"
  - "src/mcp/vice/fixtures/hazard-subject/hazard-subject-dispatch-regressed.a"
  - "src/mcp/vice/fixtures/hazard-subject/hazard-subject-exported-edit.prg"
  - "src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.allowlist.json"
  - "src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.annostore.json"
  - "src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.prg"
  - "src/mcp/vice/fixtures/hazard-subject/hazard-subject-regressed.prg"
  - "src/mcp/vice/fixtures/hazard-subject/make-exported-edit.mjs"
  - "src/mcp/vice/fixtures/hazard-subject/make-hazard-subject-annostore.mjs"
  - "src/mcp/vice/fixtures/hazard-subject/make-hazard-subject-fixtures.mjs"
  - "src/mcp/vice/hazard-subject-exported-edit.test.ts"
  - "src/mcp/vice/hazard-subject-variants.test.ts"
  - "src/mcp/vice/phase50-transcript-freshness.test.ts"
  - "src/mcp/vice/reassembly-gate-exported-edit-run.test.ts"
  - "src/mcp/vice/reassembly-gate-modified-run.test.ts"
  - "src/mcp/vice/stock-derived.ts"
  - "src/mcp/vice/stock-dispatch.ts"
  - "src/mcp/vice/text-protocol.ts"
  - "src/mcp/vice/text-tools.ts"
  - "src/mcp/vice/tools-manifest.stock.json"
  - "src/skills/c64-ram-capture/SKILL.md"
  - "src/skills/c64-ram-capture/scripts/compare-cross-binary.mjs"
  - "src/skills/c64-ram-capture/scripts/compare-cross-binary.test.mjs"
covered_digest: "v1:sha256:50227586abfd8040035e1a65509848c1c755d7831d8e3f3b8da4bb8114efe87b"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 50: Equivalence and Modifiability Verification Report

**Phase Goal:** The rebuilt program is shown behaving like the original in a real emulator, and shown being **changed** — one behaviour removed, one added — with committed transcripts as the artifacts of record rather than described walkthroughs, and the pipeline runnable from committed synthetic fixtures alone.

**Verified:** 2026-09-16T13:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth (ROADMAP criterion) | Status | Evidence |
|---|---|---|---|
| 1 | A cross-binary comparison mode exists with a narrowed mask committed before any rebuild is compared, an allowlist, per-binary checkpoints, and a planted `$D020`/`$D015`/`$D018` regression is observed being caught | ✓ VERIFIED | `src/skills/c64-ram-capture/scripts/compare-cross-binary.mjs` (committed `254de34d`, before any capture — commit `254de34d` predates every capture commit). Independently re-ran `compare-cross-binary.mjs cross original-a.bin regressed.bin` against the committed captures: `VERDICT: FAIL`, `exit=1`, names `$D015`, `$D018` and `$D020` individually among 6 divergences (the fourth planted mechanism surfaces as `$088F`/image + `$D015`/register; see detail below). 23/23 unit tests pass (`compare-cross-binary.test.mjs`). |
| 2 | The comparison is observed failing before it is trusted (paired red/green, same mechanism), a difference resolved by naming it in the allowlist, never by widening the mask | ✓ VERIFIED | git history: `d708a0be` (red control, regressed capture) precedes `41c34e42` (green comparison, rebuild) — order is a git fact, not prose. Independently re-ran both: regressed vs original → `VERDICT: FAIL`/exit 1; rebuild vs original → `VERDICT: PASS`/exit 0, `BYTE_IDENTICAL: yes`, 0 divergences. `50-04-SUMMARY.md` records the mask (`compare-cross-binary-mask-v1`) as calibrated and **unchanged** since. |
| 3 | Behavioural equivalence between original and rebuild is demonstrated in VICE with a committed transcript as the artifact of record; byte-identity is not the bar | ✓ VERIFIED | `docs/phase50-equivalence-transcript.md` (1070 lines) records the full capture procedure, mask calibration, red control and green comparison with literal command/response transcripts. `evidence/REBUILD.md` states explicitly: "This is not the acceptance criterion for this phase... The acceptance criterion is behavioural equivalence between the original and the rebuild, demonstrated in VICE with a committed transcript as the artifact of record" (lines 116-132), with byte-identity recorded as a subordinate "Optional extra" section. |
| 4 | One behaviour removed, one added in the rebuilt source, reassembled through Phase 49's gate, both observed in VICE, cross-referenced to a hazard-report finding | ✓ VERIFIED | Satisfied twice: (a) hand-written twin (`hazard-subject-align-nosprite.a`, plans 50-02/50-03/50-06) — gate verdict `acknowledged`/`R10` in `docs/phase50-modifiability-findings.md`, live capture in `docs/phase50-modifiability-transcript.md`. (b) **the literal-reading closure** (plan 50-08): edit made in `scope_087a.a`, a file `exportAsmTree()` itself emitted — proven by `make-exported-edit.mjs`'s `pristineExport.files.includes(file)` membership check (not a filename convention), reassembled through the unmodified gate (`reassembly-gate-exported-edit-run.test.ts`, 46/46 tests pass), captured live and independently re-verified against the committed `.bin` (byte-for-byte match at `$0885`, `$07F8`, `$0834`, `$FC/$FD`) and re-run through `compare-cross-binary.mjs` reproducing the transcript's exact `PASS`(allowlist)/`FAIL`(no allowlist) pair, exit 0/1 respectively. Both changes cross-referenced to hazard-report anchors `$088B` (removed) and `$0825` (added). |
| 5 | CI runs the pipeline on committed synthetic fixtures alone; the CI/manual boundary is stated; a stale transcript is caught; a broken step is observed reddening CI | ✓ VERIFIED | `docs/phase50-ci-boundary.md` states the offline/live split against named `ci.yml` steps. `phase50-transcript-freshness.test.ts` (11/11 tests pass, independently re-run) recomputes every transcript's subject digest, refuses orphans and green-without-red. A one-character digest corruption was planted, observed reddening the exact CI command (`VICE_REQUIRE_ACME=1 node --test phase50-transcript-freshness.test.ts`, and the full `npm run test:automated` gate, `pass 3674/fail 1`), then reverted — verbatim output committed. No copyrighted image anywhere in the pipeline; no new host prerequisite. |

**Score:** 5/5 truths verified, 0 present-behavior-unverified

### Notes and caveats (not blocking)

- **Criterion 1's literal wording names `compare.mjs`; the delivered instrument is a sibling module, `compare-cross-binary.mjs`.** `50-01-PLAN.md`'s own objective explicitly reasons through this: `compare.mjs`'s existing masking/drift-tolerance rules are correct for its own same-binary job and would return a false PASS on a real regression if reused for cross-binary work, so a sibling module with its own rules was written instead, without editing `compare.mjs`. This is a documented, reasoned engineering decision, not an unexplained deviation, and the capability the criterion describes (narrowed mask, allowlist, per-binary checkpoints, catching a planted `$D020`/`$D015`/`$D018` regression) is fully delivered and independently reproduced above. Recorded as an interpretation note rather than a gap.
- **Criterion 5's "observed reddening CI" was demonstrated locally against the exact CI command and environment, not on an actual GitHub Actions runner.** `docs/phase50-ci-boundary.md` discloses this plainly: "The developer was asked, and declined that run. Decision recorded 2026-09-16." The local observation reproduces the identical command (`VICE_REQUIRE_ACME=1 node --test phase50-transcript-freshness.test.ts`) and environment the `build` job's `Test` step uses, with verbatim red/green output committed both for the single file and for the full 3684-test aggregate gate. This is a disclosed, developer-accepted equivalence rather than a hidden gap.
- **Code review (`50-REVIEW.md`, committed `433cd325`) found one unresolved Critical (`CR-01`) and one unresolved Warning (`WR-01`).** `CR-01` (`TextMonitorClient.command()`'s `timeoutMs` silently ignored) traces to a Phase 41 commit (`fad65de8`), surfaced by Phase 50's review scope — not a Phase 50 regression, per the verification-notes' own instruction not to score Phase 50 down for it. `WR-01` (`compare-cross-binary.mjs` silently skips register-domain comparison when one side's `--state` sidecar carries no `registers` data) is a genuine defensive-completeness gap in the new instrument, but does not invalidate any of the delivered evidence: every committed sidecar in this phase carries populated `registers` data (49 keys, confirmed in `exported-edit.state.json`), so the skip path was never exercised by any committed transcript. Neither finding contradicts a verified truth above; both are pre-existing/adjacent quality items worth a follow-up, not phase-goal blockers.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/skills/c64-ram-capture/scripts/compare-cross-binary.mjs` | Cross-binary classifier | ✓ VERIFIED | 525 lines, 23/23 own tests pass, CLI independently re-run and reproduces all three transcripts' verdicts |
| `src/mcp/vice/fixtures/hazard-subject/hazard-subject-regressed.prg` + `.a` sources | Red-control twin | ✓ VERIFIED | Present, regenerable (`make-hazard-subject-fixtures.mjs`), 46/46 `hazard-subject-variants.test.ts` pass |
| `src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.{prg,annostore.json,allowlist.json}` | One-removed/one-added subject + pre-registered allowlist | ✓ VERIFIED | Allowlist committed `ca02a89c`, before any capture (`b37a7a34`, later) |
| `docs/phase50-modifiability-findings.md` | Modified subject's own gate verdict | ✓ VERIFIED | `acknowledged`/`R10`, machine-readable frontmatter |
| `.planning/.../evidence/captures/*.bin` + `.state.json` (original-a/b, regressed, rebuild, modified) | Committed live captures | ✓ VERIFIED | 5 capture pairs present; hashes cross-checked against transcript frontmatter |
| `docs/phase50-equivalence-transcript.md` | Equivalence transcript | ✓ VERIFIED | 1070 lines, red section (`$640`) precedes green (`$367`/`$961`) |
| `docs/phase50-modifiability-transcript.md` | Modifiability transcript | ✓ VERIFIED | 516 lines, PASS/FAIL pair reproduced |
| `src/mcp/vice/fixtures/hazard-subject/exported-edit.manifest.json` + `make-exported-edit.mjs` | Pre-registered exporter-output edit | ✓ VERIFIED | Membership-proof gate (`pristineExport.files.includes(file)`), byte predictions match assembled output exactly |
| `docs/phase50-exported-edit-findings.md` + `docs/phase50-exported-modifiability-transcript.md` | Exported-edit gate + live transcript | ✓ VERIFIED | Gate re-run via unmodified `reassembly-gate.ts`; live capture bytes independently re-verified against `.bin` |
| `src/mcp/vice/phase50-transcript-freshness.test.ts` + `docs/phase50-ci-boundary.md` | CI freshness guard + boundary statement | ✓ VERIFIED | 11/11 tests pass; boundary doc cites named `ci.yml` steps; broken-step observation committed verbatim |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `make-exported-edit.mjs` | `exportAsmTree()` (`anno-export-asm.ts`) | `importStoreDocument()` → `exportAsmTree()` → `verifyAcmeAssemblesTree()` | ✓ WIRED | No second assembler call site; edit target proven by `files` list membership |
| `reassembly-gate-exported-edit-run.test.ts` / `reassembly-gate-modified-run.test.ts` | `reassembly-gate.ts` | direct import, module unedited | ✓ WIRED | `git diff --quiet 702fb21b -- reassembly-gate.ts` confirmed unedited in 50-03; same module reused in 50-08 |
| `hazard-subject-exported-edit.prg` | live emulator | `HAZARD_SUBJECT_PRG_RELPATHS["exported-edit"]` → `vice_program_load {subject:"exported-edit"}` | ✓ WIRED | Confirmed present in `text-protocol.ts:307-313`; closed table, no caller-supplied path |
| `compare-cross-binary.mjs` | `hazard-subject-modified.allowlist.json` | `--allowlist` CLI flag | ✓ WIRED | Independently re-run: PASS with flag, FAIL (`--no-allowlist`), identical image pair both times |
| `phase50-transcript-freshness.test.ts` | `docs/phase50-*-transcript.md` (3 files) | `readdirSync(docsDir).filter(TRANSCRIPT_PATTERN)` | ✓ WIRED | Pattern `phase50-*-transcript.md` matches all 3 committed transcripts, confirmed via grep of source and `ls docs/` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Cross-binary comparison catches a planted register regression | `compare-cross-binary.mjs cross original-a.bin regressed.bin --state ... --checkpoint hazard_raster_entry` | `VERDICT: FAIL`, exit 1, 6 divergences incl. `$D015`/`$D018`/`$D020` | ✓ PASS |
| Rebuild passes behavioural equivalence | `compare-cross-binary.mjs cross original-a.bin rebuild.bin --state ...` | `VERDICT: PASS`, exit 0, `BYTE_IDENTICAL: yes`, 0 divergences | ✓ PASS |
| Exported-edit subject passes under pre-registered allowlist | `compare-cross-binary.mjs cross original-a.bin exported-edit.bin --allowlist hazard-subject-modified.allowlist.json` | `VERDICT: PASS`, exit 0, 28 allowlisted/0 divergences | ✓ PASS |
| Same pair fails without allowlist | same command `--no-allowlist` | `VERDICT: FAIL`, exit 1, 28 divergences | ✓ PASS |
| Exported-edit subject-file membership test suite | `node --test hazard-subject-exported-edit.test.ts reassembly-gate-exported-edit-run.test.ts hazard-subject-variants.test.ts reassembly-gate-modified-run.test.ts phase50-transcript-freshness.test.ts` | 46/46 pass | ✓ PASS |
| `compare-cross-binary.mjs`'s own unit suite | `node --test compare-cross-binary.test.mjs` | 23/23 pass | ✓ PASS |
| Full phase-50-relevant automated suite | `cd src/mcp/vice && npm run test:automated` (redirected, `$?` read same line) | 3693 tests, 3684 pass, 0 fail, 9 skipped (opt-in live tiers), exit 0 | ✓ PASS |
| Typecheck | `cd src/mcp/vice && npm run typecheck` | clean, exit 0 | ✓ PASS |

### Data-Flow Trace (byte-level, exported-edit subject)

| Claim | Source | Independently re-derived | Status |
|---|---|---|---|
| `hazard-subject-exported-edit.prg` sha256 in transcript frontmatter | `docs/phase50-exported-modifiability-transcript.md` | `sha256sum` on committed file matches exactly | ✓ FLOWING |
| Captured `.bin` bytes at `$0885` (removed sprite construction / added `jsr`) | transcript's byte table | `python3` read of committed `.bin` at same offset matches exactly | ✓ FLOWING |
| Captured `.bin` byte at `$07F8` (sprite pointer, now `$00`) | transcript | independently read, matches | ✓ FLOWING |
| Comparison verdicts (PASS/FAIL, exit codes, divergence counts) | transcript | independently re-run `compare-cross-binary.mjs`, output byte-for-byte identical | ✓ FLOWING |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| EQUIV-01 | 50-01, 50-04, 50-05, 50-06 | `compare.mjs`-class tool works in original-vs-different-binary mode | ✓ SATISFIED | See truths 1-2 above |
| EQUIV-02 | 50-04, 50-05, 50-06 | Behavioural equivalence original vs rebuild, transcript as artifact of record | ✓ SATISFIED | See truth 3 above |
| EQUIV-03 | 50-02, 50-03, 50-06, 50-08 | One behaviour removed and one added, reassembled, observed in VICE | ✓ SATISFIED | See truth 4 above — closed both the hand-written and exporter-emitted readings |
| EQUIV-04 | 50-07 | Synthetic fixtures committed, pipeline runnable in CI | ✓ SATISFIED | See truth 5 above |

No orphaned requirements: all four IDs mapped to Phase 50 in `REQUIREMENTS.md`'s traceability table (lines 330-333) are claimed by at least one plan's frontmatter `requirements:` field, and every plan's declared requirement is covered by verified evidence.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `src/mcp/vice/text-protocol.ts` | 847 | `timeoutMs` option declared but never read (`CR-01`, code review) | Info (pre-existing, Phase 41) | Does not affect any Phase 50 evidence; no phase-50 test relies on the timeout bound |
| `src/skills/c64-ram-capture/scripts/compare-cross-binary.mjs` | 315 | Register-domain comparison silently skipped when one sidecar's `registers` is empty (`WR-01`, code review) | Warning (unresolved) | Not exercised by any committed Phase 50 transcript (all sidecars carry populated `registers`); a real gap for future asymmetric-sidecar runs, flagged for follow-up |

No debt markers (`TBD`/`FIXME`/`XXX`) found in files modified by this phase.

### Human Verification Required

None. All must-haves resolved to VERIFIED via reproducible, independently re-run evidence (test suites, CLI re-execution, byte-level cross-checks against committed captures, and git-history ordering proofs).

### Gaps Summary

No gaps. All five ROADMAP success criteria and all four requirement IDs (EQUIV-01 through EQUIV-04) are independently verified against the codebase, not merely asserted by SUMMARY.md. The phase goal — the rebuilt program shown behaving like the original and shown being changed, with committed transcripts as the artifact of record and the pipeline runnable from committed synthetic fixtures alone — is achieved.

Two non-blocking items are worth carrying forward as follow-up (not phase-50 gaps): `WR-01` (compare-cross-binary.mjs's silent register-comparison skip on an asymmetric sidecar) and the pre-existing `CR-01` (text-protocol.ts's dead `timeoutMs`), both already recorded in `50-REVIEW.md`.

---

_Verified: 2026-09-16T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
