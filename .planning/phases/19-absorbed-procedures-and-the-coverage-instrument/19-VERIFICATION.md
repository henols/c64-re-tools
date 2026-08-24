---
phase: 19-absorbed-procedures-and-the-coverage-instrument
verified: 2026-08-24T18:46:48Z
status: gaps_found
score: 3/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "SC2 — Absorbed procedure text carries a per-file attribution header naming the source repository, file path, and the pinned commit, and `THIRD-PARTY-NOTICES.md` records the true dual `MIT OR Apache-2.0` licence for the absorbed text specifically"
    status: partial
    reason: >-
      The attribution headers and the dual-licence record are both genuinely present and
      accurate (independently confirmed: all five upstream sha256 digests match the real
      repository at the pin). The failure is 19-01's own ABS-02 prohibition — "MUST NOT ship
      a documentation claim that the same commit falsifies" — which is violated by shipped
      text. `src/mcp/vice/THIRD-PARTY-NOTICES.md:115-117` asserts "The MIT permission notice
      and copyright above travel inside every absorbed file's header, which is what ships in
      both published tarballs." Three independent falsifications, all reproduced: (a) the MIT
      permission notice text ("Permission is hereby granted, free of charge...") appears
      NOWHERE in the repository — a repo-wide grep returns only 19-REVIEW.md's own quotation
      of the fix; (b) no absorbed file header contains it — the headers carry the copyright
      line and the licence NAME only; (c) `@henols/vice-mcp` ships ZERO skill files
      (`npm pack --dry-run` file list), so no absorbed header ships in that tarball at all,
      while the false claim itself IS packed there. Separately, MIT's own inclusion condition
      ("this permission notice shall be included in all copies or substantial portions") is
      therefore undischarged for the elected licence.
    artifacts:
      - path: "src/mcp/vice/THIRD-PARTY-NOTICES.md"
        issue: "Lines 115-117 assert a permission notice that exists nowhere, and assert it ships in a tarball that contains no skill files. Packed into the published tarball."
      - path: "src/skills/routine-queue-walker/SKILL.md"
        issue: "Attribution header (and the four sibling headers in c64-memory-mapping/c64-program-recon) carries the licence name and copyright but no permission notice."
    missing:
      - "Reproduce the MIT permission notice verbatim in `src/mcp/vice/THIRD-PARTY-NOTICES.md`, `installer/THIRD-PARTY-NOTICES.md` and the root `THIRD-PARTY-NOTICES.md`, so the elected licence's inclusion condition is actually discharged."
      - "Correct or delete the sentence at `src/mcp/vice/THIRD-PARTY-NOTICES.md:115-117` — in particular the 'ships in both published tarballs' clause, which is false for `@henols/vice-mcp` regardless of the notice fix."
      - "Add a guard asserting the permission-notice text is present in every notices file that claims incorporation, so the claim cannot drift from the fact again."
  - truth: "SC4 — Running the coverage tool against a binary reports three distinct numbers ... and any label reached from more than one call site requires cross-reference-backed documentation to count"
    status: partial
    reason: >-
      Two of three clauses hold and were confirmed live. The third — the multi-caller
      cross-reference rule — is defeatable, and the phase goal's own qualifier ("a coverage
      instrument ... that resists being gamed") is falsified twice over. BOTH defects were
      reproduced against shipped code at REPORT level, not inferred.
      (1) `namesACaller()` (`r2000-coverage.ts:990-1005`) tests `lower.includes("$" + hex)`
      with no boundary anchor. Taking the NC4 control fixture EXACTLY as shipped — a label at
      $0820 with callers [$0810, $0816], documented without naming either — and appending a
      mention of an unrelated but perfectly ordinary C64 address, `$8106`, to its comment
      flips `multiCallerUndocumented` from {count:1,addresses:[2080]} to {count:0,addresses:[]}.
      The comment still names neither caller. The label then counts as documented, stays in
      `labels.kindRatio.user`, stays in the reproducibility sample population, and produces no
      finding. The negative control that exists to catch precisely this passes only because
      its shipped comment happens to contain no colliding hex — fixture-only reliance.
      (2) The Class-3 split lo/hi table scan (`r2000-coverage.ts:578-620`) pairs ANY two
      indexed `ld*` instructions within 8 decoded instructions, with no dispatch-context gate,
      reconstructs up to 64 targets out of whatever bytes lie at the two bases, and feeds them
      back as `extraSeeds` at `r2000-coverage.ts:1311`. Two 64-byte programs, each containing
      exactly 7 bytes of real code and 57 bytes of ordinary data, differing ONLY in that one
      uses indexed rather than immediate addressing (a screen+colour copy loop — the single
      most ordinary C64 idiom), report structural completeness of reached=7/unreached=57
      versus reached=55/unreached=9. The headline structural measure inflates 8x from ordinary
      data. `linearSweepDecodable` is indeed reported beside the census and never summed, so
      19-03's literal truth "Decodability is never counted as evidence of code" holds as
      written — but the same outcome is reached by the other route: ordinary DATA is
      classified `reached-as-instruction`.
    artifacts:
      - path: "src/mcp/vice/r2000-coverage.ts"
        issue: "namesACaller() at ~990-1005 matches caller hex as an unanchored substring; the label-name branch has the same shape (rawComment.includes(name))."
      - path: "src/mcp/vice/r2000-coverage.ts"
        issue: "Class-3 split lo/hi scan at ~578-620 has no dispatch-context gate and promotes reconstructed data words to descent seeds via extraSeeds at :1311."
      - path: "src/mcp/vice/r2000-coverage.test.ts"
        issue: "Test adequacy: the split-table scan has a POSITIVE control only (line 495-502, 'a split lo/hi table pair is reconstructed'). No test asks whether an ordinary indexed load pair is wrongly treated as a table. No test anchors namesACaller(). The suite is green because it never poses either question."
    missing:
      - "Anchor namesACaller() on a hex-token boundary (non-hex-digit or end of string) and compare against a canonical width; anchor the label-name branch on a word boundary too."
      - "Gate the Class-3 split-table scan on real dispatch context (a following indexed indirect jump, a pha/pha/rts idiom, or a corroborating cross-reference) before its targets may become descent seeds — or report them as a separate advisory class that never enters extraSeeds."
      - "Add a false-positive control fixture: a program of known code size containing an ordinary two-table indexed copy loop, asserting the census does NOT inflate."
      - "Add an anchoring control for namesACaller(): the NC4 comment plus a colliding longer hex must still report the label as undocumented."
      - "Re-check REQUIREMENTS.md line 59 — COV-02 is marked [x] Complete on the strength of a rule that does not hold."
human_verification:
  - test: "Review the `MIT OR Apache-2.0` -> MIT election now published in two npm tarballs, and the notices wording that will replace the falsified sentence."
    expected: "A lawyer-or-owner judgement that the election is correct and the inclusion condition is discharged by the corrected notices."
    why_human: "A licence election and the sufficiency of an attribution notice are legal claims. No test settles them. Flagged by 19-01, 19-02 and 19-DECISIONS decision 4; CR-03 bears directly on it."
  - test: "Review 19-03's `flat-three` coverage report schema (`COVERAGE_SCHEMA_VERSION` 1, `COVERAGE_REPORT_KEYS`) before Phase 20 reads it."
    expected: "Explicit human acceptance of the top-level key set, since a schema test now pins it and Phase 20 hardens it."
    why_human: "Auto-selected under `mode: yolo` and never shown to a human. It is a forward-compatibility commitment, not a correctness property a test can decide."
coincidental_reliance_items:
  - truth: "NC4 (`nc4-multi-caller-unnamed`) proves the multi-caller rule fires"
    reason: fixture-only
    harden: "NC4 passes only because its shipped comment contains no hex string that collides with a caller's short-form hex. The precondition 'the comment contains no colliding hex' is established by the fixture's own text and is nowhere enforced by the rule. Anchor the match, then add the colliding-hex variant as a second control."
---

# Phase 19: Absorbed Procedures and the Coverage Instrument — Verification Report

**Phase Goal:** Upstream's five analyze procedures become this project's own skills — absorbed, attributed, and diffed against the curated surface — and a coverage instrument exists that resists being gamed, before any decomposition work runs under it.

**Verified:** 2026-08-24T18:46:48Z (HEAD `81d46d1`)
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

The goal has two halves joined by "and". The **absorption half is achieved, and achieved well** — verified against the real upstream repository over the network, not merely against the project's own manifest. The **instrument half is not**: the goal's own qualifier is "a coverage instrument ... that **resists being gamed**", and two distinct gaming routes were reproduced at report level against shipped code. The clause "before any decomposition work runs under it" makes this blocking rather than cosmetic — Phase 20 is *Decomposition to Closure* and consumes exactly these numbers.

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | Five procedures absorbed at a pinned commit into `c64-program-recon`/`c64-memory-mapping` + a new routine-queue-walker; every tool call diffed against the curated `r2000_*` surface; zero runtime dependency on `.agent/skills/` | ✓ VERIFIED | **Independently confirmed against upstream.** Fetched all five procedure files from `github.com/ricardoquesada/regenerator2000` at `493f8404...` — all five sha256 digests AND byte counts match the manifest exactly (4457 / 14674 / 15308 / 9248 / 9705 bytes). Five `ATTRIBUTION (ABS-02)` blocks across exactly three destinations, matching `manifest.procedures` destinations 1:1. Tool diff: 33 curated + 8 non-curated, each non-curated entry carrying a substantive justification, an upstream citation and its sites; four citations spot-checked at their claimed line numbers in the fetched upstream files — all exact. `check-skill-tool-coverage.mjs` exits 0 (17 distinct `r2000_*` names, all curated). `grep -rn "\.agent/skills" src/skills/` → 0 hits. |
| 2 | Per-file attribution header naming source repo, file path, pinned commit; `THIRD-PARTY-NOTICES.md` records the true dual `MIT OR Apache-2.0` for the absorbed text specifically | ✗ FAILED | Literal clauses hold — headers carry all six provenance fields; both notices files carry an `## Incorporated material` section naming the dual licence, the copyright and the MIT election for the absorbed prose specifically. **But 19-01's explicit ABS-02 prohibition is violated by shipped text** (CR-03 reproduced): `src/mcp/vice/THIRD-PARTY-NOTICES.md:115-117`. See Gaps. |
| 3 | No two skills contend for the same trigger; a pairwise description check runs clean across all of them | ✓ VERIFIED | `check-skill-description-overlap.mjs` exits 0: 7 skills, 21 pairs (= n(n−1)/2 for n=7), observed max **0.250** (`c64-program-recon` :: `c64-provenance-diff`) against an **inclusive** threshold of 0.35, **allowlist size 0**. The threshold is measured, not taste: `skill-descriptions.mjs:64-97` records the clean-inventory ceiling, two real pairs at 0.200, and upstream's own most-similar sibling pair at 0.261 — which is why the absorbed descriptions were rewritten rather than carried. Prohibitions honoured: no skill removed from the inventory, no exemption added (allowlist empty), threshold not raised. |
| 4 | Three distinct numbers, never one aggregate; a mechanically auto-labelled or "handles data" binary visibly fails; any label reached from >1 call site requires cross-reference-backed documentation to count | ✗ FAILED | Clauses A and B pass; clause C is defeatable, and the goal's "resists being gamed" fails twice. See Gaps and Behavioural Spot-Checks. |
| 5 | Packer identity surfaced as a recon finding; the snapshot-versus-drift trade is a dated decision naming its own re-sync trigger | ✓ VERIFIED | `packer-finding.mjs` (610 lines): `PACKER_VERDICTS` frozen to exactly four; `identifiedByOracle()` is structurally the only constructor that assigns `packer` and it **throws** on a non-string/empty name; `unknownFinding()` throws on an empty reason; both `spawnSync` sites pass an argument array with `shell: false`. Wired — `c64-program-recon/SKILL.md:88-89` names the script path from the repo root. 16/17 tests pass, 1 skip (the live oracle gate). Decision 1 (`19-DECISIONS.md:28-86`) is dated, states the trade, and names a re-sync trigger whose **mechanism** is a hash comparison against `manifest.resync_triggers` — checkable, not aspirational. |

**Score: 3/5 truths verified** (0 present-but-behaviour-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/skills/routine-queue-walker/SKILL.md` | Absorbed procedure, attributed, curated-tools-only | ✓ VERIFIED | Exists; frontmatter present; attribution header at :5-30; digest matches upstream |
| `src/skills/c64-memory-mapping/SKILL.md` | Two absorbed procedures, attributed | ✓ VERIFIED | 2 attribution blocks (:235, :486) |
| `src/skills/c64-program-recon/SKILL.md` | One absorbed procedure + reference-only BASIC material | ✓ VERIFIED | 2 attribution blocks (:303, :505); names `packer-finding.mjs` |
| `src/mcp/vice/r2000-coverage.ts` | Census, widened dispatch scan, three measures, pinned schema | ⚠️ HOLLOW | Present, wired, data flows — but two measurement defects reproduced (see Gaps) |
| `src/mcp/vice/r2000-coverage.test.ts` | Schema test, independence test, six controls | ⚠️ INADEQUATE | 93/93 pass. Positive-only control for the split-table scan; no anchoring control for `namesACaller()` |
| `src/mcp/vice/skill-attribution.test.ts` | Frozen-registry presence/absence guard | ✓ VERIFIED | Passes; registry holds a row per source path |
| `src/mcp/vice/r2000-upstream-audit.test.ts` | Rejects abbreviated/floating refs; requires justifications | ✓ VERIFIED | Passes; manifest carries full 40-hex commit and per-tool justifications |
| `scripts/lib/skill-descriptions.mjs` | Pure predicates | ✓ VERIFIED | Threshold measured and documented in situ |
| `scripts/check-skill-description-overlap.mjs` | CI runner + OK line | ✓ VERIFIED | Exits 0 with the full metrics line |
| `src/skills/c64-program-recon/scripts/packer-finding.mjs` | Packer finding, hard-unknown default | ✓ VERIFIED | 610 lines; never-infer-a-name enforced structurally |
| `src/mcp/vice/THIRD-PARTY-NOTICES.md` | Incorporated-material section | ✗ SHIPS A FALSE CLAIM | Section correct; :115-117 falsified by the same commit |
| `installer/THIRD-PARTY-NOTICES.md` | Notices in the package carrying absorbed prose | ✓ VERIFIED | Packed (`npm pack --dry-run`); 7 SKILL.md also packed, in sync with `src/skills/` |
| `.../19-DECISIONS.md` | Five dated decisions with reversal/re-sync conditions | ✓ VERIFIED | Five decisions, each with an explicit reversal or re-sync condition |
| `.../19-VALIDATION.md` | Per-requirement test/command that ran | ✓ VERIFIED | 52 table rows; no placeholder rows found |
| `.../evidence/coverage-reproducibility/ANSWER.sha256` | Non-retrofittable seal | ✓ VERIFIED | Seal is over the canonical answer LINE between markers (not the whole file — an initial whole-file digest mismatch resolved on reading the test); the seal test passes and fails-closed when RE-DERIVED is absent |
| `.../19-STDIO-MULTIPLEXING-EVIDENCE.md` | D18-16 measurement of record | ✓ VERIFIED | 223 lines; re-runnable driver committed beside it |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `routine-queue-walker/SKILL.md` | `upstream-procedure-manifest.json` | Header quotes commit + sha256 | ✓ WIRED — and the sha256 matches the real upstream bytes |
| `skill-attribution.test.ts` | manifest | Header-vs-manifest agreement per absorbed file | ✓ WIRED |
| `check-npm-packages.mjs` | `scripts/lib/skill-corpus.mjs` | `topLevelSkillDirs()` supplies the relation | ✓ WIRED |
| `installer/package.json` | `installer/THIRD-PARTY-NOTICES.md` | `files[]` entry | ✓ WIRED — confirmed in the packed file list |
| `r2000-coverage.ts` | `disasm-decoder.ts` | `decode()` supplies the instruction stream | ✓ WIRED |
| `r2000-cli.ts` | `r2000-coverage.ts` | `cmdCoverage()` → `buildCoverageReport()` | ✓ WIRED — exercised live |
| `r2000-cli.ts` | `r2000-session.ts` | Store reads via the single-owner session seam | ✓ WIRED — `queryR2000Json` only; no new spawn site |
| `c64-program-recon/SKILL.md` | `scripts/packer-finding.mjs` | Playbook names the path from repo root | ✓ WIRED (:88-89) |
| `check-skill-description-overlap.mjs` | `scripts/lib/skill-descriptions.mjs` | Runner imports the predicates the test imports | ✓ WIRED |
| `19-DECISIONS.md` | manifest `resync_triggers` | Decision 1's checking mechanism | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data? | Status |
|---|---|---|---|---|
| `r2000-cli.ts` coverage verb | symbols / comments / blocks / cross-references | Live `r2000_get_*` over the session seam | Yes — live run returned 10 symbols, real xrefs | ✓ FLOWING |
| `r2000-coverage.ts` census | raw program bytes | `loadProject()` → base64+gzip decode of the real project file | Yes | ✓ FLOWING |
| `r2000-coverage.ts` census seeds | `extraSeeds` | `scanIndirectDispatch().discoveredTargets` | Yes — **but reconstructs seeds from ordinary data; this is the CR-02 defect** | ⚠️ FLOWING-BUT-WRONG |
| `packer-finding.mjs` `packer` field | oracle stdout | `spawnSync(cmd, [args], {shell:false})` | Yes — and structurally unreachable from entropy | ✓ FLOWING |

### Behavioural Spot-Checks

| Behaviour | Command | Result | Status |
|---|---|---|---|
| Upstream pin is real, not asserted | `curl` all 5 paths at `493f8404...` + `sha256sum` | 5/5 MATCH on digest and byte count | ✓ PASS |
| Upstream citations are real | `sed -n '85p;158p'` / `'31p;74p'` on fetched upstream files | All 4 spot-checked citations exact | ✓ PASS |
| Coverage verb runs end to end | `node vice-proxy.ts r2000 coverage src/.../nc1-all-auto/project.regen2000proj` | rc=0; prints "MEASURE 1 of 3", "MEASURE 2 of 3", "MEASURE 3 of 3", divergence sub-report, and an explicit "Read the numbers against each other, never as one figure" | ✓ PASS |
| No aggregate figure anywhere | Inspect live report + `COVERAGE_REPORT_KEYS` schema test | No combined percentage in the object or the rendering | ✓ PASS |
| Vacuous binary visibly fails | All 6 control fixtures through `buildCoverageReport` + `coverageFindings` | 6/6 match `expect_clean`; NC1 all-auto → 2 findings, NC2 generic-comments → 4 findings, NC5 well-documented → clean | ✓ PASS |
| **Multi-caller rule resists gaming** | NC4 as shipped vs NC4 + "; mirrors the value at `$8106`" appended to the $0820 comment | `multiCallerUndocumented` {count:1,[2080]} → **{count:0,[]}**. Names neither caller ($0810/$0816). | ✗ **FAIL** |
| **Structural census resists gaming** | Two 64-byte programs, each 7 bytes real code + 57 bytes data, differing only immediate vs indexed addressing | reached **7/64** vs reached **55/64**; `splitTables=1`, `discovered=1` | ✗ **FAIL** |
| Packer finding never infers a name | `node --test packer-finding.test.mjs` | 17 tests, 16 pass, 1 skip (live oracle gate), 0 fail | ✓ PASS |
| Phase-19 suites | `node --test r2000-coverage.test.ts skill-attribution.test.ts r2000-upstream-audit.test.ts skill-description-overlap.test.ts r2000-verb-coverage.test.ts` | 93 tests, 92 pass, 1 skip, 0 fail | ✓ PASS |
| Skill gates | `check-skill-description-overlap` / `-tool-coverage` / `-fork-honesty` | all exit 0 | ✓ PASS |

**On the green-suite / reproduced-defect tension.** Both are true and they are not in conflict — they are the same finding seen twice. The suite passes because it never poses either question. `r2000-coverage.test.ts:495-502` asserts the split-table scan *reconstructs a real table* (a positive control) and nothing asserts it *declines an ordinary indexed load pair*. NC4 asserts the multi-caller rule fires on a comment that happens to contain no colliding hex, and nothing asserts it on one that does. For criterion 4 specifically — whose whole subject is an instrument that cannot be talked into a clean verdict — a control set with no adversarial half is not evidence of the property being claimed. This is a test-adequacy gap, not a flaky-test gap.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| ABS-01 | 19-01, 19-02 | Five procedures absorbed at a pinned commit, tool calls diffed, no `.agent/skills/` runtime dep | ✓ SATISFIED | All 5 digests confirmed against upstream; 8 non-curated dispositions justified; 0 `.agent/skills` refs |
| ABS-02 | 19-01, 19-02 | Attributed per file and in `THIRD-PARTY-NOTICES.md` under the true dual licence | ✗ BLOCKED | Attribution correct; a shipped notices claim is falsified by the same commit (prohibition violation) |
| ABS-03 | 19-05 | No two skills contend for the same trigger | ✓ SATISFIED | 21/21 pairs clean, max 0.250 < 0.35, allowlist 0 |
| ABS-04 | 19-05 | Snapshot-versus-drift is a dated decision with a named re-sync trigger | ✓ SATISFIED | Decision 1 + `manifest.resync_triggers` mechanism |
| COV-01 | 19-03, 19-04 | Three distinct numbers, never one aggregate | ✓ SATISFIED | Live report prints three named measures, no combined figure |
| COV-02 | 19-03 | A vacuous pass is detectable; multi-caller labels require cross-reference-backed documentation | ✗ BLOCKED | Vacuity half verified (6/6 controls). Multi-caller half defeated by an unanchored substring match — reproduced. **REQUIREMENTS.md:59 marks this `[x]` Complete.** |
| SURF-03 | 19-04 | Packer identity surfaced as a recon finding | ✓ SATISFIED | Four frozen verdicts, single name-assigning constructor, wired into the recon playbook |

**Orphaned requirements:** none. All seven IDs mapped to Phase 19 in REQUIREMENTS.md are claimed by a plan, and no plan claims an ID outside the seven.

### Prohibition Checks

| Plan | Prohibition | Status |
|---|---|---|
| 19-01 (ABS-02) | MUST NOT claim verbatim provenance for adapted text or vice versa | ✓ HONOURED — every header says "ADAPTED, NOT VERBATIM" with named deviations |
| 19-01 (ABS-02) | **MUST NOT ship a documentation claim that the same commit falsifies** | ✗ **VIOLATED, AND SHIPPED** — `src/mcp/vice/THIRD-PARTY-NOTICES.md:115-117`, packed into `@henols/vice-mcp` |
| 19-02 (ABS-01) | MUST NOT ship an absorbed step needing a tool this project does not expose | ✓ HONOURED — `check-skill-tool-coverage` exits 0; all 17 extracted `r2000_*` names curated |
| 19-03 (COV-01) | MUST NOT compute/emit/store/display a single combined coverage figure | ✓ HONOURED — verified in the live report object and the rendering |
| 19-03 (COV-02) | MUST NOT let an absent input or empty sealed answer read as a pass | ✓ HONOURED — NC1's report reads "UNKNOWN rather than clean" for both unavailable measures; the seal test fails closed |
| 19-04 (SURF-03) | MUST NOT report a packer name no oracle stated verbatim | ✓ HONOURED — structurally enforced by a single throwing constructor |
| 19-04 (COV-01) | MUST NOT record a live run as evidence without command and raw output | ✓ HONOURED — `19-STDIO-MULTIPLEXING-EVIDENCE.md` carries the command sequence and raw output |
| 19-05 (ABS-03) | MUST NOT resolve a collision by removal, exemption, or raising the threshold | ✓ HONOURED — 7/7 skills scanned, allowlist size 0, threshold justified by measurement |
| 19-05 (ABS-04) | MUST NOT record a decision as settled without a named reversal condition | ✓ HONOURED — all five decisions carry one |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `src/mcp/vice/THIRD-PARTY-NOTICES.md` | 115-117 | Shipped claim falsified by its own commit | 🛑 Blocker | Prohibition violation; published in a tarball |
| `src/mcp/vice/r2000-coverage.ts` | ~992-1006 | Unanchored `String.includes` used as an identity match | 🛑 Blocker | Defeats the multi-caller rule |
| `src/mcp/vice/r2000-coverage.ts` | ~578-621 | Ungated heuristic promoting reconstructed data to descent seeds | 🛑 Blocker | Inflates the headline structural measure |
| `src/mcp/vice/r2000-coverage.test.ts` | 495-502 | Positive-only control for a heuristic whose risk is false positives | ⚠️ Warning | Green suite conceals both blockers |
| — | — | Debt markers (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`) across the phase's 13 primary source files | ℹ️ Clean | **None found** |

### Deferred Items

None of the gaps above is addressed by a later phase. Phase 20 (*Decomposition to Closure*) *consumes* the coverage instrument, so both instrument defects harden the moment it runs — which is precisely what the phase goal's clause "before any decomposition work runs under it" was written to prevent.

For completeness, two omissions ARE legitimately deferred and are **not** gaps: `r2000_toggle_splitter` and `r2000_set_immediate_format` are recorded in the manifest as future-surface proposals with named requirements (DECOMP-01/BUILD-02 and BUILD-03) and a named implementing phase, per 19-DECISIONS Decision 2.

### Human Verification Required

#### 1. The MIT election and the corrected notices wording

**Test:** Review the `MIT OR Apache-2.0` → MIT election now published in two npm tarballs, together with whatever replaces the falsified sentence at `src/mcp/vice/THIRD-PARTY-NOTICES.md:115-117`.
**Expected:** An owner-or-counsel judgement that the election is correct and that MIT's inclusion condition is discharged by the corrected notices.
**Why human:** A licence election and the sufficiency of an attribution notice are legal claims that no test settles. Carried forward explicitly by 19-01, 19-02 and 19-DECISIONS decision 4.

#### 2. The `flat-three` coverage report schema

**Test:** Review `COVERAGE_SCHEMA_VERSION` 1 and the exact `COVERAGE_REPORT_KEYS` top-level key set before Phase 20 reads it.
**Expected:** Explicit human acceptance of the key set.
**Why human:** Auto-selected under `mode: yolo` and never shown to a human. A schema test now pins it and Phase 20 will harden it — it is a forward-compatibility commitment, not a correctness property a test can decide.

### Gaps Summary

Phase 19 delivered two things and got one of them right.

**The absorption is excellent, and it verifies exogenously.** This is the rarer outcome: rather than take the manifest's word for the pin, I fetched all five upstream procedure files from GitHub at commit `493f8404...` and confirmed every sha256 and every byte count. I then spot-checked four of the manifest's upstream line-number citations against the fetched files — all exact. The tool diff is genuine work: 33 curated calls plus 8 non-curated dispositions, each with a real justification, a cited upstream site, and (for the two deferred tools) a named future requirement and implementing phase. The description-overlap gate is a real gate with a measured threshold, zero exemptions, and a documented reason why upstream's own sibling pair (0.261) forced the absorbed descriptions to be rewritten rather than carried. The packer finding makes "never infer a name" a structural property rather than a rule: exactly one constructor can assign `packer`, and it throws rather than accept an empty string. Criteria 1, 3 and 5 are verified without reservation.

**The instrument is not yet an instrument that resists being gamed**, which is the goal's own qualifier. Both defects the code reviewer reported were re-reproduced here independently, at report level, against shipped code:

- Taking the NC4 negative control **exactly as committed** — the fixture whose stated purpose is "the two-caller label at $0820 is documented without naming either caller" — and adding a mention of `$8106`, an unrelated and entirely ordinary C64 address, to its comment flips the finding from `{count:1}` to `{count:0}`. The comment still names neither caller. Success criterion 4's final clause says such a label "requires cross-reference-backed documentation to count"; it does not.
- Two 64-byte programs with identical code content — 7 bytes of real code, 57 bytes of ordinary data — report structural completeness of 7/64 and 55/64 respectively. The only difference is that the second uses indexed rather than immediate addressing. An ordinary screen+colour copy loop is enough to make the headline structural measure over-report by 8x, because the split lo/hi table heuristic has no dispatch-context gate and feeds reconstructed data words back in as descent seeds.

The green test suite and the reproduced defects are not in tension; they are the same finding twice. The split-table scan has a positive control and no negative one, and NC4 passes only because its committed comment happens to contain no colliding hex — a precondition the fixture's own text supplies and the rule itself never enforces.

Separately, ABS-02's explicit prohibition — "MUST NOT ship a documentation claim that the same commit falsifies" — is violated by text that is already packed into `@henols/vice-mcp`. The notices file states that the MIT permission notice travels inside every absorbed file's header and ships in both tarballs. The permission notice text exists nowhere in the repository; the headers carry only the copyright line and the licence name; and the vice tarball ships no skill files at all. The third clause is false independently of the first two, so fixing the notice text alone will not discharge it.

None of this is deferrable. The phase goal ends "before any decomposition work runs under it", and Phase 20 is the decomposition work.

---

_Verified: 2026-08-24T18:46:48Z_
_Verifier: Claude (gsd-verifier)_
