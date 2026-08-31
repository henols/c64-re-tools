---
phase: 31-procedure-re-pointing
verified: 2026-08-31T10:12:24Z
status: gaps_found
score: 5/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "A committed assertion — not a grep run once — scores REPOINT-03's exact sentence: every ABS-02 attribution block in BOTH skill trees carries both naming lines, byte-identically, and the two trees carry equal numbers of them"
    status: failed
    reason: >-
      Reproduced independently. `installer/skills/` is gitignored (`.gitignore:43`) with 0
      tracked files and is materialised only by `packFiles()` -> `prepack` ->
      `sync-skills.mjs`. In `.github/workflows/ci.yml` the `Test` step that runs the suite is
      at `:110` (`run: npm test` at `:141`), while the first step that materialises the
      shipped tree is `Validate npm package contents` at `:169`. So where the assertion
      actually runs automatically, the shipped tree does not exist,
      `skippableEmptyRoot(SHIPPED, 0)` returns true, the loop `continue`s with NO diagnostic,
      and the `if (shipped)` guard skips the cross-tree `assert.deepEqual` entirely. CI
      therefore scores 5 blocks in ONE tree, not 10 across two — the "across two trees" half
      of criterion 1 has no automated reader. Verifier reproduction: with
      `installer/skills/` moved aside, `node --test --test-name-pattern 'both skill trees
      carry the ABS-02 naming lines' skill-attribution.test.ts` reported `ok 1 ... # pass 1 #
      fail 0 # skipped 0` — a silent pass, not a skip. (Tree restored byte-identical
      afterwards; `git status --porcelain installer/ src/skills/` empty.)
    artifacts:
      - path: "src/mcp/vice/skill-attribution.test.ts"
        issue: >-
          `skippableEmptyRoot()` makes the shipped-tree branch unconditionally skippable when
          the tree yields zero files, and the two-tree `deepEqual` is guarded by
          `if (shipped)`. Neither emits a diagnostic when the shipped half is not scored, so
          the absence is indistinguishable from a pass.
      - path: ".github/workflows/ci.yml"
        issue: >-
          Step ordering: `Test` (`:110`/`:141`) precedes the steps that generate
          `installer/skills/` (`:169` `check-npm-packages.mjs`, `:179`
          `check-no-regenerator2000.mjs`).
    missing:
      - "Either materialise `installer/skills/` before the `Test` step in CI, or make the shipped-tree skip LOUD — a named `t.skip()`/recorded reason rather than a bare `continue` — so a run that scored only one tree cannot be read as having scored two."
      - "Tighten `skippableEmptyRoot()` so a shipped root that EXISTS but holds no `SKILL.md` is a failure rather than a skip (code review WR-01): today `fileCount === 0` skips regardless of whether the directory is absent or merely empty."
  - truth: "The two naming lines are compared with `grep -rx` semantics — exact whole-line byte equality, only a trailing `\\r` tolerated"
    status: partial
    reason: >-
      The predicate `namingLineCountsIn()` is itself exact (`===`, no trim, no case folding,
      no normalisation, no substring) — that much is true. But it is handed
      `attributionBlocks()`'s regex capture `m[1]`, which begins mid-line immediately after
      the `ATTRIBUTION (ABS-02)` marker and ends mid-line immediately before `-->`. The first
      and last elements of its `split("\n")` are therefore line FRAGMENTS, not lines, so the
      documented `grep -rx` equivalence is false at both block boundaries. Verifier
      reproduction with the real constants and the real extractor: the head plant
      `ATTRIBUTION (ABS-02)Adapted from regenerator2000.` scores `{"adapted":1,"repository":1}`
      while `grep -cx 'Adapted from regenerator2000\.'` over the same text returns `0`; the
      tail plant `  Source repository: <url>-->` likewise scores `{"adapted":1,"repository":1}`.
      Neither existing proof can catch this — both one-character plants land on interior
      lines, and the cross-tree `deepEqual` compares counts while the sync copies a defect
      across symmetrically. LATENT, not active: all 10 real blocks on the current tree have
      empty first and last fragments (measured per block), so this does not affect the
      criterion-1 measurement recorded below. It is a false-ACCEPT hole plus a code-comment
      claim the tree falsifies.
    artifacts:
      - path: "src/mcp/vice/skill-attribution.test.ts"
        issue: >-
          `namingLineCountsIn()` documents `grep -rx` semantics but receives a mid-line-
          anchored capture group; the comment block above `ABS02_ADAPTED_LINE` repeats the
          `grep -rx` claim.
    missing:
      - "Feed the predicate whole lines — anchor the extractor to line boundaries, or drop the block's first and last fragment before comparing — so the `grep -rx` claim in the comment is true as written."
      - "Add a boundary plant to the adjacent proof test (marker and naming line on one physical line) so the strictness claim covers the two positions the existing interior plants cannot reach."
deferred: []
---

# Phase 31: Procedure Re-pointing Verification Report

**Phase Goal:** The attribution and provenance record that outlives the deleted code is
correct — the `ABS-02` chain byte-identical across both trees, the one trigger description
that named the retired analyser rewritten **substantively** and re-checked for collisions,
and Phase 19's manifest re-synced in the same commit that changes what it describes.

**Verified:** 2026-08-31T10:12:24Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Scope note for any gap-closure round

**Both ROADMAP success criteria are VERIFIED, by independent measurement rather than from the
SUMMARYs.** The two gaps are narrowly about the DURABILITY of the guard plan 31-02 committed
to keep criterion 1 true — its reach in CI, and its whole-line claim at block boundaries. A
gap-closure plan must not re-litigate the criteria, re-measure the chain, or rewrite
`routine-queue-walker/SKILL.md`'s description (final, and rewriting it re-triggers `ABS-03`
and breaks CLAUDE.md's byte-identity assertion). Scope is two files:
`src/mcp/vice/skill-attribution.test.ts` and `.github/workflows/ci.yml`.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | **(SC1a)** The `ABS-02` chain is intact: 10 instances across two trees, each with its two naming lines byte-identical | ✓ VERIFIED | Measured directly, not read. 5 `ATTRIBUTION (ABS-02)` blocks per tree in 3 files (`c64-memory-mapping` 2, `c64-program-recon` 2, `routine-queue-walker` 1) = **10 across two trees**. `grep -rx 'Adapted from regenerator2000\.'` → **5** per tree; `grep -rx '  Source repository: …'` → **5** per tree. Per-block enumeration confirms exactly one of each line in every one of the 10 blocks. All three files **byte-identical** between `src/skills/` and `installer/skills/` (`diff -q` clean ×3). |
| 2 | **(SC1b)** `routine-queue-walker/SKILL.md:3`'s `description:` changed **substantively**, and `ABS-03`'s pairwise collision check passes on the rewritten text | ✓ VERIFIED | Line 3 now names "an existing C64 annotation store's backlog"; `grep -ci 'regenerator2000\|r2000'` over that line → **0**. Rewrite landed in 29-09 per `D-01`'s narrowing, as the ROADMAP note states. `node scripts/check-skill-description-overlap.mjs` → exit 0: **7 skills scanned, 21 pairs compared, observed maximum 0.250** (`c64-program-recon :: c64-provenance-diff`), threshold 0.35, allowlist size 0, **CLAUDE.md project-skills table 7 rows all byte-identical**. `skill-description-overlap.test.ts` green. |
| 3 | **(SC2)** `upstream-procedure-manifest.json` is updated in the **same commit** that changes what it describes, including a criterion for `r2000_undo`'s `omit` disposition, so the justification assertion cannot record a reversed decision | ✓ VERIFIED | Exactly **one** commit touches the manifest: `7adcbaf`, `1 file changed, 9 insertions(+), 8 deletions(-)` — no intermediate commit half-describes the surface, and insertions ≥ deletions so no fact was deleted with its token. `r2000_undo` keys are `disposition,justification,upstream_citation,requirement_id,sites`; `disposition` = **`omit`**; `requirement_id` = **`STORE-04`**, which satisfies the optional field's shape gate `/^[A-Z][A-Z0-9]*-\d+$/`. The reversal guard holds: `anno_undo`/`anno_revert` occur **0** times in `anno-tools.ts`, so `anno-derivation.test.ts`'s `disposition === "curated"` ↔ curated assertion pins `omit`. |
| 4 | **(31-01)** No manifest sentence points a reader at a module, symbol or test Phase 29 deleted; every retired reference became a re-pointed route or a dated past-tense fact | ✓ VERIFIED | Retired-token sweep over the manifest: `r2000-tools` **0**, `r2000-session` **0**, `r2000-upstream-audit` **0**, `CURATED_R2000_TOOLS` **0**. Live subjects present and resolving: `CURATED_ANNO_TOOLS` ×1 (exists in `anno-tools.ts`), `anno-tools.ts` ×5, `anno-derivation.test.ts` ×1, `R2000_UPSTREAM_CLONE` ×1 (byte-identical, so the CI binding is intact), `STORE-04` ×3. Every new citation resolves: `revertTo` exists in `anno-store.ts`, `base_revision` ×8 in `anno-tools.ts`, `STORE-04` is `REQUIREMENTS.md:85` (**Complete**, Phase 28), `D2` at `:46` records "undo → whole-store snapshot/restore, not a per-edit inverse journal" and `:202` records the per-edit journal as Out of Scope. The justification's direction matches the record — omission stands, decided not reversed. |
| 5 | **(31-02)** A committed assertion scores criterion 1's sentence across **BOTH** trees, durably | ✗ FAILED | See gap 1. The assertion exists, is substantive and is wired into both `npm test` and `test:automated` (not in `MANUAL_ONLY_TESTS`), and it does score both trees **locally**, where the generated tree is present. But in CI the `Test` step at `:110` precedes the steps that generate `installer/skills/` at `:169`/`:179`, so the shipped half is silently skipped with no diagnostic. Reproduced by relocating the tree: `# pass 1 # fail 0 # skipped 0`. |
| 6 | **(31-02)** The two naming lines are compared with `grep -rx` semantics — exact whole-line byte equality | ✗ FAILED | See gap 2. `namingLineCountsIn()` is exact, but it is handed `attributionBlocks()`'s `m[1]` capture, so its first and last `split("\n")` elements are line fragments. Both boundary plants score `{adapted:1, repository:1}` where `grep -cx` returns `0`. Latent on the current tree (all 10 real blocks have empty boundary fragments), so truth 1's measurement is unaffected. |
| 7 | **(31-03)** No living guard or state record cites the criterion ordinal `D-01` removed; the four judgements are recorded; no requirement status moved ahead of this verdict | ✓ VERIFIED | `grep -c 'Phase 31 criterion 4'` → **0** in `scripts/check-no-regenerator2000.mjs` and **0** in `.planning/STATE.md`; `'Phase 31 criterion 1'` → **2** and **1** respectively. The citation's content clause survives verbatim: `'two naming lines byte-identical'` ×2 in the gate. `^- \[Phase 31\]:` ×1 in STATE.md, and reading it confirms all four judgements are present with evidence and a **named reversal condition** each — not a paraphrase that lost its point. Historical records untouched: `29-09-SUMMARY.md` still reads `'Phase 31 criterion 4'` ×4. `REPOINT-03`/`REPOINT-04` still `Pending` with unticked checkboxes. `removal-gate.test.ts` 8/8 green; gate reports `skill-attribution-headers 24`, `attribution-guard-test 14`, temporary allow-list empty, exit 0. |

**Score:** 5/7 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `.planning/phases/19-.../upstream-procedure-manifest.json` | Re-synced snapshot record; `contains: "STORE-04"` | ✓ VERIFIED | `STORE-04` present ×3 occurrences. Schema survives — `anno-derivation.test.ts` green. Changed in exactly one commit, one file. |
| `src/mcp/vice/skill-attribution.test.ts` | Two new tests scoring the two-naming-lines claim across both trees; `contains: "Adapted from regenerator2000."` | ⚠️ PARTIAL | Exists, substantive, wired, runs in both `npm test` and `test:automated`. The declared `contains` literal is **absent** (see Deviations #1). Two defects in the delivered assertion — gaps 1 and 2. |
| `scripts/check-no-regenerator2000.mjs` | Both citations naming the criterion that exists; `contains: "two naming lines byte-identical"` | ✓ VERIFIED | Contains ×2. `node --check` clean; gate exit 0; no pin, needle or scope predicate moved (`attribution-guard-test 14` / `skill-attribution-headers 24` unchanged). |
| `.planning/STATE.md` | Corrected Phase 29 citation + dated Phase 31 Decisions entry; `contains: "[Phase 31]"` | ✓ VERIFIED | Contains ×1. Frontmatter intact (all 12 keys + 5 progress counters). Entry records four judgements with reversal conditions. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| manifest `disposition_rationale.r2000_undo` | `ANNO_TOOL_DEFINITIONS` in `anno-tools.ts` | `derivationVerdict()` in `anno-derivation.test.ts`, compared in both directions | ✓ WIRED | This is the link that makes a reversed omission fail. Surface carries 0 `anno_undo`/`anno_revert`, so `omit` is the only passing value. Test green. |
| manifest `procedures[].sha256` / `commit` | ABS-02 attribution headers | `skill-attribution.test.ts` (procedure count, upstream-path set, per-row commit + digest) | ✓ WIRED | Untouched by the phase and still equal after it — 22/23 pass, 1 expected skip, 0 fail. |
| manifest third re-sync trigger | `CURATED_ANNO_TOOLS` in `src/mcp/vice/anno-tools.ts` | prose instruction; no mechanical reader | ✓ WIRED | Both anchors resolve on the live tree. Correctly recorded (31-03 judgement 3) as having no permanent gate, with a named recurrence trigger. |
| `ABS02_ADAPTED_LINE` / `ABS02_SOURCE_REPOSITORY_LINE` | `manifest.repository` | derivation, not retyped | ✓ WIRED | Derivation evaluated by the verifier: yields exactly `"Adapted from regenerator2000."` and `"  Source repository: https://github.com/ricardoquesada/regenerator2000"`. |
| `SKILL_ATTRIBUTION_ROOTS` | `src/skills/` **and** `installer/skills/` | corpus walk in the new test | ⚠️ PARTIAL | Both roots are declared and the departure is stated at the point of use, but the second root is unreachable where CI runs (gap 1). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `skill-attribution.test.ts` | `ABS02_UPSTREAM_NAME` | `manifest.repository` last path segment | ✓ — evaluates to `regenerator2000` | ✓ FLOWING |
| `skill-attribution.test.ts` | `totals` (source root) | `walkSkills(src/skills)` + `readFileSync` | ✓ — 5 blocks / 5 / 5 | ✓ FLOWING |
| `skill-attribution.test.ts` | `totals` (shipped root) | `walkSkills(installer/skills)` | ✗ in CI — root absent at the `Test` step, entry never written to the map | ⚠️ STATIC (unscored in CI) |
| `upstream-procedure-manifest.json` | `r2000_undo.requirement_id` | hand-recorded, inferred `STORE-04` | ✓ — resolves to a live Complete requirement | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| The manifest's schema, justification and both-directions surface agreement survive | `node --test anno-derivation.test.ts skill-attribution.test.ts` | 23 tests, 22 pass, 0 fail, 1 skipped | ✓ PASS |
| The removal gate and the ABS-03 collision check are green over the rewritten text | `node --test removal-gate.test.ts skill-description-overlap.test.ts` | 40 tests, 40 pass, 0 fail | ✓ PASS |
| The removal gate still reports its unchanged pins | `node scripts/check-no-regenerator2000.mjs` | exit 0; 400 files scanned; `skill-attribution-headers 24`; `attribution-guard-test 14`; 0 temporarily allow-listed across 0 entries | ✓ PASS |
| ABS-03 runner over all seven descriptions | `node scripts/check-skill-description-overlap.mjs` | exit 0; 7 skills, 21 pairs, max 0.250 < 0.35, allowlist 0, CLAUDE.md 7/7 byte-identical | ✓ PASS |
| The two-tree assertion actually scores two trees | relocate `installer/skills/`, run the named test | `ok 1 … # pass 1 # fail 0 # skipped 0` — silent pass, shipped tree never opened | ✗ FAIL (gap 1) |
| The naming-line predicate is `grep -rx`-equivalent at block boundaries | boundary plants through the real extractor + constants | predicate `{adapted:1, repository:1}`; `grep -cx` `0` | ✗ FAIL (gap 2) |
| `--schema state` route named in 31-03's `<verify>` | `gsd-tools query frontmatter.validate .planning/STATE.md --schema state` | `Error: Unknown schema: state. Available: plan, plan-gap-closure, summary, verification` | ✗ FAIL (plan-text defect, no consequence — see Deviations #4) |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | `find scripts -path '*/tests/probe-*.sh'` | no probe scripts exist in this repository | ? N/A |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| `REPOINT-03` | 31-02, 31-03 | The `ABS-02` chain survives the code's deletion — 5 blocks in 3 files under `src/skills/` plus their 5 synced twins, 10 instances across two trees, each carrying two naming lines; and `routine-queue-walker/SKILL.md:3`'s `description:` changes substantively, re-triggering `ABS-03` | ⚠️ **PARTIAL** — the STATE half is satisfied, the GUARD half is not | The 10-instance / two-naming-line / byte-identity claim and the substantive rewrite plus green `ABS-03` are all measured true (truths 1, 2). The committed assertion that was to make it durable does not score the shipped tree in CI (gap 1) and its whole-line claim is false at block boundaries (gap 2). **Keep `Pending`.** |
| `REPOINT-04` | 31-01, 31-03 | `upstream-procedure-manifest.json` is updated in the same commit that changes what it describes, and `r2000_undo`'s `omit` disposition is one v0.7.0 supplies a criterion for | ✓ **SATISFIED** | Truths 3, 4, 7. One commit (`7adcbaf`), one file, 9+/8−. `omit` intact with `requirement_id: STORE-04`. All four retired tokens at zero, every new citation resolving. `anno-derivation.test.ts` green. **Promotion is deferred to the phase verdict per the standing rule; this verdict is `gaps_found`, so the row stays `Pending` and moves with `REPOINT-03` on re-verification.** |

**Orphaned requirements: none.** `grep -E '^\| [A-Z0-9-]+ \| Phase 31 \|' .planning/REQUIREMENTS.md` returns exactly `REPOINT-03` and `REPOINT-04`, and both are claimed by plans in this phase. `REPOINT-01`/`REPOINT-02` correctly map to Phase 29 (`Complete`) after `D-01`'s move-not-duplicate, so every requirement still maps to exactly one phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `upstream-procedure-manifest.json` | — | `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` | — | **None found.** Debt-marker gate clean. |
| `src/mcp/vice/skill-attribution.test.ts` | — | same set | — | **None found.** |
| `scripts/check-no-regenerator2000.mjs` | — | same set | — | **None found.** |
| `src/mcp/vice/skill-attribution.test.ts` | ~277-284, ~350-355 | Code comment asserts `grep -rx` semantics that the tree falsifies at block boundaries | ⚠️ Warning | The project's own named antipattern ("a documentation claim the tree falsifies"). Covered by gap 2. |
| `src/mcp/vice/skill-attribution.test.ts` | `ABS02_BLOCKS_PER_TREE_FLOOR = 5` | Magic literal duplicating `manifest.procedures.length` (measured: also 5) | ℹ️ Info | Code review `WR-03`. The floor cannot ratchet with the manifest; harmless today, drifts silently when a sixth procedure is absorbed. |
| `src/mcp/vice/skill-attribution.test.ts` | plant test, `charAt(nameAt).toUpperCase()` | Plant depends on the derived name's first character having a distinct uppercase form | ℹ️ Info | Code review `WR-06`. Premise verified to hold today (`r` → `R`, distinct), so the proof is not vacuous. Latent for a future upstream name. |

## Code Review Findings Weighed as Evidence

Both BLOCKER findings were re-derived from the tree, not read from the report.

- **`CR-01` — CONFIRMED, and it is gap 1.** Premises verified: `installer/skills/` gitignored at `.gitignore:43`, `git ls-files installer/skills` → `0`; CI `Test` at `:110`/`:141` precedes `:169` and `:179`. Consequence verified by reproduction, which the reviewer's structural argument had left open: the run is a **silent pass**, not a skip — no diagnostic, and the cross-tree `deepEqual` never executes.
- **`CR-02` — CONFIRMED, and it is gap 2.** Both boundary plants demonstrated against the real extractor and the real constants. Also established what the finding did not: the defect is **latent**, because all 10 real blocks have empty first and last fragments, so it does not contaminate this report's measurement of criterion 1.

**Judgement on the question posed — is criterion 1 met?** Yes, as a claim about the tree, and this verdict is the scoring event the ROADMAP note asked for ("What remains for this phase is confirming that chain"). It was confirmed here by direct byte-level measurement across both trees, which is stronger evidence than the committed test provides. What is NOT met is plan 31-02's own declared must-have — that a *committed assertion* scores that sentence across both trees. Hence: criteria VERIFIED, guard FAILED, verdict `gaps_found`. The gaps are deliberately scoped to the guard so a closure round cannot grow into re-measuring the chain.

**Overlap with Phase 32, noted but deliberately NOT deferred.** Phase 32's criterion 1 is a retrospective non-vacuity audit of "every guard and CI script pinned to the deleted subject", and `skill-attribution.test.ts` is inside the `attribution-guard-test` exemption. But Phase 32's scope is the set of guards Phase 29 **re-pointed** (its note enumerates them; this newly-added assertion is not among them), so the match is tangential rather than clear and specific. Per the conservative rule these stay real Phase 31 gaps. A planner may reasonably choose to fold the fix into Phase 32; that is a scheduling choice, not a deferral this report grants.

## Deviations and Orchestrator Notes Scored

1. **Plan 31-02's `must_haves.artifacts[0].contains: "Adapted from regenerator2000."` is unmet — and more completely than reported.** `grep -c 'Adapted from regenerator2000\.' src/mcp/vice/skill-attribution.test.ts` → **0**. The phrase appears nowhere in the file; the orchestrator's belief that pre-existing header prose at lines 4 and 37 satisfies it is incorrect — those lines contain `regenerator2000` but not the phrase (the file's 12 subject occurrences are at `:4, :37, :403, :439, :454, :472, :475, :478, :489, :522, :1028, :1116`, none of them this string). **Scored as an accepted deviation, not a gap.** The stated cause is real and verified: `attribution-guard-test` pins that path at exactly **12**, so one literal spelling would make it 13 and red a gate no plan in this phase was permitted to edit. The semantic intent is fully delivered — the verifier evaluated the derivation and it yields exactly `"Adapted from regenerator2000."` and `"  Source repository: https://github.com/ricardoquesada/regenerator2000"`, and the test asserts the derivation's shape directly (non-empty, single path segment, the URL's real last segment). A literal would have been strictly worse: derived, a wrong derivation makes every block report as an offender. If this deviation should be recorded formally rather than narratively, add to this file's frontmatter:

   ```yaml
   overrides:
     - must_have: "src/mcp/vice/skill-attribution.test.ts contains \"Adapted from regenerator2000.\""
       reason: "Satisfied semantically by ABS02_ADAPTED_LINE derived from manifest.repository (verified to evaluate to exactly that string). A literal would break the attribution-guard-test exact pin of 12 for this path, which no Phase 31 plan was permitted to move."
       accepted_by: "<name>"
       accepted_at: "<ISO timestamp>"
   ```

2. **The pin figure — corrected reconciliation, recorded here so the next reader is not misled by `31-03-SUMMARY.md`.** There is **no discrepancy**. Measured from the gate source and from the tree:

   | Figure | What it is | Measured |
   | --- | --- | --- |
   | **12** | the `attribution-guard-test` exemption's **per-path** pin for `src/mcp/vice/skill-attribution.test.ts` (`scripts/check-no-regenerator2000.mjs:402`) | `grep -o 'regenerator2000' src/mcp/vice/skill-attribution.test.ts \| wc -l` → **12** |
   | **2** | the same exemption's per-path pin for `scripts/check-skill-fork-honesty.mjs` (`:403`) | `grep -o … \| wc -l` → **2** |
   | **14** | the exemption's **cross-file aggregate**, which is what the gate prints | gate output line `attribution-guard-test 14` |

   `31-02-SUMMARY.md` cites **12** and is correct — 12 is the pin that actually constrained its decision to derive rather than write a literal, because that decision only affects that one file. `31-03-SUMMARY.md:327` cites **14**, also correct as the gate's printed aggregate, but its parenthetical note framing 31-02's 12 as a conflicting figure is **spurious**: the two numbers are the same fact at different granularities. Treat that note as withdrawn. The orchestrator's mid-task correction is confirmed accurate.

3. **STATE.md phase-level counters deliberately stale — confirmed, not a gap.** Frontmatter reads `completed_plans: 55` (of 58) and Current Position reads `Plan: 1 of 3`, both against 3/3 plans executed. Plan 31-03's prohibitions forbid rewriting those blocks and its `key-decisions` record the four bookkeeping verbs as deliberately not invoked. Left to `phase.complete` — which project memory warns writes a stale position and flips unmet requirements, so diff it afterwards, and note that with this verdict `REPOINT-03`/`REPOINT-04` must **not** be promoted.

4. **Both plan-text defects in 31-03 confirmed; neither affects the criteria.**
   - `31-03-PLAN.md:166` asserts `grep -c 'Phase 31 criterion 4' 29-09-SUMMARY.md` → `1`. True count is **4**, verified, unchanged before and after (that file is edit-forbidden). The executor caught this: `31-03-SUMMARY.md` coverage `D4` records `-> 4, identical to its pre-task value`. The plan's *intent* — the historical artifact is untouched — was verified correctly by a corrected route. Plan-authoring defect only.
   - `31-03-PLAN.md:272`/`:299` name `--schema state`, which does not exist: the verb reports `Unknown schema: state. Available: plan, plan-gap-closure, summary, verification`. That `<verify>` step was therefore unexecutable as written. The executor substituted an adequate route (`git diff -U0` showing one hunk `@@ -727,0 +728 @@`, 1 insertion / 0 deletions, plus a byte-identical frontmatter diff against HEAD), and the verifier independently confirms STATE.md's frontmatter parses with all 12 keys and 5 progress counters intact. No consequence.

5. **`REPOINT-03`/`REPOINT-04` `Pending` is not an omission — confirmed, and they stay `Pending`.** Recorded as judgement 4 of the STATE.md entry with this verdict as the named reversal condition. Because this verdict is `gaps_found`, the reversal condition is not satisfied: neither row moves. `REPOINT-04` is scored ✓ SATISFIED above and may be promoted on the re-verification verdict that also clears `REPOINT-03`, per `REQUIREMENTS.md`'s four-sites-one-edit rule.

6. **The GSD isolation-guard identifier mismatch — recorded as tooling, not a phase defect.** `hooks/gsd-agent-isolation-guard.js` extracts `plan="03"`/`phase="31"` from `tool_input.description` (`:431`) while the per-plan gate writes the sentinel as `plan="31-03"`/`phase="31"`, so a fresh `none` sentinel is discarded as inapplicable and the guard falls back to the registry's `harness-worktree`, denying a legitimately sequential dispatch. Worked around by matching the reader's spelling. Confirmed that nothing under the vendored GSD tree was edited — `.claude/gsd-local-patches/` remains the project's stated invariant. Worth a `todo`; out of scope for this phase's verdict.

## Note on the review-disposition guard

`docs-review-disposition.test.ts` is red because committing `31-REVIEW.md` introduced findings with no recorded disposition. **This report deliberately records no dispositions.** A disposition written into `VERIFICATION.md` is non-durable — the next re-verification overwrites this file and every id whose only disposition lived here goes red again with nothing about the finding having changed, exactly as happened on phases 19 and 28. Durable sources are a completed todo under `.planning/todos/completed/` or a `<phase>-REVIEW-FIX.md`, neither of which is a verifier artifact. `CR-01` and `CR-02` are weighed above as evidence, on their merits, and both are real; the guard's red is therefore correct signal that they remain unfixed, and clearing it belongs to whatever plan actually fixes them.

## Gaps Summary

The phase's substantive claims are true. Both ROADMAP success criteria were verified by direct
measurement rather than from the SUMMARYs: the `ABS-02` chain really is 10 blocks across two
trees with both naming lines byte-identical in every one of them and all three shared files
byte-identical between trees; the description rewrite really is substantive and `ABS-03`
really passes on it at a comfortable margin; the manifest really landed in one commit with
`r2000_undo`'s `omit` intact, `STORE-04` attached, every retired token at zero and every new
citation resolving to a live subject. `REPOINT-04` is satisfied on the merits.

What is not delivered is the part that was supposed to make criterion 1 outlive this
verification. Plan 31-02's central must-have was a *committed assertion* scoring that sentence
across both trees, and in CI — the only place it runs unattended — it scores one tree and says
nothing about the other. The reproduction is unambiguous: with the shipped tree absent the test
reports a clean pass with zero skips. Separately, its documented `grep -rx` byte-exactness is
false at both block boundaries; that hole is latent today, but the *claim* is in a code comment
on a guard whose whole purpose is byte-exactness, which is the project's own named antipattern.

Both are small, well-localised fixes in two files. Until they land, criterion 1's two-tree half
rests on this report's measurement rather than on a standing guard — which is precisely the
state the ROADMAP note said `REPOINT-03` must not be recorded complete in.

---

_Verified: 2026-08-31T10:12:24Z_
_Verifier: Claude (gsd-verifier)_
