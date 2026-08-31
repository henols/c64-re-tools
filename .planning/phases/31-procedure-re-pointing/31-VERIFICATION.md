---
phase: 31-procedure-re-pointing
verified: 2026-08-31T14:05:00Z
status: passed
score: 13/13 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 5/7
  previous_report: "the round-1 report is superseded but preserved in full below under § Superseded Round 1 (2026-08-31T10:12:24Z) — ROADMAP.md and 31-04-PLAN.md cite it by name"
  gaps_closed:
    - "A committed assertion — not a grep run once — scores REPOINT-03's exact sentence: every ABS-02 attribution block in BOTH skill trees carries both naming lines, byte-identically, and the two trees carry equal numbers of them"
    - "The two naming lines are compared with `grep -rx` semantics — exact whole-line byte equality, only a trailing `\\r` tolerated"
  gaps_remaining: []
  regressions: []
gaps: []
deferred: []
behavior_unverified_items: []
coincidental_reliance_items: []
human_verification: []
---

# Phase 31: Procedure Re-pointing Verification Report (round 2 — after gap closure)

**Phase Goal:** The attribution and provenance record that outlives the deleted code is
correct — the `ABS-02` chain byte-identical across both trees, the one trigger description
that named the retired analyser rewritten **substantively** and re-checked for collisions,
and Phase 19's manifest re-synced in the same commit that changes what it describes.
Narrowed by `D-01`: the re-pointing itself was carried out in Phase 29 plan 29-09.

**Verified:** 2026-08-31T14:05:00Z
**Status:** passed
**Re-verification:** Yes — round 2, after gap-closure plan 31-04. Round 1 scored
`gaps_found` at 5/7 with **both ROADMAP success criteria already VERIFIED**; its two gaps
were narrowly about the DURABILITY of the guard plan 31-02 committed. Both are closed.

## What this round measured, and how

Nothing in this report is read out of a SUMMARY. Every figure below was re-measured at
`HEAD` (`7ab5f11`) by the verifier, and the two closed gaps were re-tested **by
reproducing the exact conditions round 1 used to prove them open** — with the generated
tree relocated, under `CI=1` and without it, and with the pre-fix code path re-evaluated
in isolation to prove the new assertions are non-vacuous.

Every experiment restored the tree byte-identically. `installer/skills/` hashed
`a7f1b06b…914bf8` before the first relocation and after the last one, unchanged across
four separate runs.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | **(SC1a)** The `ABS-02` chain is intact: **10 instances across two trees**, each with its two naming lines byte-identical | ✓ VERIFIED | Re-measured, not carried over. `ATTRIBUTION (ABS-02)` blocks: **5** under `src/skills/`, **5** under `installer/skills/` = **10**. `grep -rax` (whole-line, `-a` for the NUL-byte hazard) for `Adapted from regenerator2000.` → **5** per tree; for `  Source repository: https://github.com/ricardoquesada/regenerator2000` → **5** per tree. All three carrier files (`c64-memory-mapping`, `c64-program-recon`, `routine-queue-walker`) **byte-identical** between trees (`diff -q` clean ×3). The committed guard now scores this **per block** over whole physical lines and reports **0 offenders** across both roots. |
| 2 | **(SC1b)** `routine-queue-walker/SKILL.md:3`'s `description:` changed **substantively**; `ABS-03`'s pairwise collision check passes on the rewritten text | ✓ VERIFIED | Line 3 reads `description: Drive an existing C64 annotation store's backlog of undocumented routines and auto-named symbols to closure — …`; subject tokens on that line (`regenerator2000|r2000`, case-insensitive) → **0**. `node scripts/check-skill-description-overlap.mjs` → exit **0**: 7 skills scanned, **21 pairs** compared, observed maximum **0.250** (`c64-program-recon :: c64-provenance-diff`) against threshold 0.35, allowlist size 0, CLAUDE.md project-skills table 7 rows all byte-identical. |
| 3 | **(SC2)** `upstream-procedure-manifest.json` is updated in the **same commit** that changes what it describes, including a criterion for `r2000_undo`'s `omit` disposition, so the justification assertion cannot record a reversed decision | ✓ VERIFIED | `git log -- <manifest>` shows exactly **one** Phase-31 commit: `7adcbaf`, **1 file changed, 9 insertions(+), 8 deletions(-)** — no intermediate commit half-describes the surface, and insertions ≥ deletions. Parsed from the live JSON: `r2000_undo.disposition` = **`omit`**, `requirement_id` = **`STORE-04`**, `upstream_citation` and `sites` present. Reversal guard re-measured: `anno_undo|anno_revert` occurs **0** times in `anno-tools.ts` (`grep -ac`), so `anno-derivation.test.ts`'s curated↔disposition assertion pins `omit`. That suite is green in the full run below. |
| 4 | **(31-01, regression)** No manifest sentence points a reader at a module, symbol or test Phase 29 deleted; the manifest, the removal gate and `REQUIREMENTS.md` are untouched by the closure round | ✓ VERIFIED | Regression check, since round 1 verified the content. `git log abab85b~1..HEAD -- <manifest> scripts/check-no-regenerator2000.mjs .planning/REQUIREMENTS.md src/skills installer/scripts` → **empty**. The plan's five commits (`20b6a2d`, `66d2743`, `8e5d307`, `90634b1`, `b650146`) touch only `ci.yml`, `skill-attribution.test.ts`, `31-REVIEW-FIX.md` and `31-04-SUMMARY.md`. The prohibition held. |
| 5 | **(gap 1 → truth 5)** A committed assertion scores criterion 1's sentence across **BOTH** trees **durably** — at the moment it runs in CI the shipped tree exists, materialised by a step ordered before `Test` through the one existing producer | ✓ VERIFIED | Behaviorally, not structurally. `.github/workflows/ci.yml:126` `- name: Generate the shipped skills tree (scored by skill-attribution.test.ts)`, `:127` `working-directory: installer`, `:128` `run: node scripts/sync-skills.mjs` — **before** `- name: Test` at `:130`. No second sync path is introduced: this is the exact command `installer`'s `prepack` runs. And the ordering is no longer load-bearing for *safety*: with the tree relocated and `CI=1`, the named test now **FAILS** — `not ok 1 … error: '…/installer/skills is absent under CI, where an explicit workflow step materialises it before the suite runs — …'`, `# pass 0 # fail 1`. Round 1's reproduction of the same condition produced `ok 1 … # pass 1 # fail 0 # skipped 0`. The silent pass is gone. |
| 6 | **(quoted `gaps[0].missing[0]`)** BOTH branches of the either/or are taken: the CI step materialises the tree **AND** every unscored root is recorded with a named reason, emitted as a `t.diagnostic()` naming the root, with an unconditional summary diagnostic reporting how many declared roots were scored | ✓ VERIFIED | Observed output, both states. Tree present: `# ABS-02 naming lines: scored 2 of 2 declared root(s) [src/skills, installer/skills]; 0 unscored`. Tree relocated, no `CI`: `# ABS-02 naming lines: root installer/skills NOT scored -- …does not exist: a fresh clone has never run the installer's prepack…` followed by `# ABS-02 naming lines: scored 1 of 2 declared root(s) [src/skills]; 1 unscored`. The summary line is emitted unconditionally (`skill-attribution.test.ts:1092`), and `assert.equal(totals.size + unscoredRoots.length, SKILL_ATTRIBUTION_ROOTS.length, …)` (`:1099`) makes a root that is neither scored nor recorded a failure. A one-tree run can no longer be read as a two-tree run. |
| 7 | **(quoted `gaps[0].missing[1]`, code review WR-01)** The skip is keyed on **ABSENCE** (and on not being a CI run), never on emptiness, and every branch is asserted from injected inputs rather than from whichever tree happens to exist | ✓ VERIFIED | `skippableEmptyRoot(root, fileCount)` is gone; `emptyRootVerdict(root, fileCount, probe)` (`:512`) returns `{ skippable, reason }` and takes `{ rootExists, ci }` as **explicit arguments** — it calls neither `existsSync` nor `process.env` itself. Five branches asserted directly from injected probes at `:978-1006`, plus a non-empty-reason loop at `:1009-1021`. **Live-proven, not just asserted:** with the tree relocated and an *empty* `installer/skills/` created, the named test FAILS — `error: '…installer/skills EXISTS but yields no SKILL.md -- that is an interrupted or partial sync, not an un-run one, so it must fail rather than skip'`. The `existsSync(root)` → `probe.rootExists` wiring at `:1037` is therefore real, not decorative. |
| 8 | **(gap 2 → truth 6)** The two naming lines are compared with `grep -rx` semantics — exact whole-line byte equality, only a trailing `\r` tolerated — and the claim is true **as written at both block boundaries**, because the predicate can only ever receive whole physical lines | ✓ VERIFIED | `namingLineCountsIn(lines: readonly string[])` (`:461`): per element, strip at most one trailing `\r`, then `===` against each constant. No `trim`, no case folding, no normalisation, no `includes`. **Every call site audited by hand** — `:1072` (`block` from `attributionBlockLines()`), `:1174` (`clean`, likewise), `:1218`/`:1238` (`.map()` of `clean`, so still whole lines), `:1266`/`:1277`/`:1290`/`:1301` (boundary plants/controls from `attributionBlockLines()`), `:1311` (explicit array literal). **Zero** occurrences of `attributionBlocks(…).split` or `attributionBlocks(…)[n]` outside two comments that forbid exactly that route. The capture-based extractor keeps its own job (registry-row content matching) and the two are asserted to agree on block count per file (`:1066-1070`). Typecheck clean (`tsc --noEmit`, exit 0). |
| 9 | **(quoted `gaps[1].missing[0]`)** The **line-anchored** route is taken, not the fragment-dropping one, so a naming line jammed onto a boundary line is reported as an **OFFENDER** rather than silently discarded | ✓ VERIFIED | `attributionBlockLines()` (`:240`) walks the file's own `split("\n")` and returns `lines.slice(open, i+1)` — the marker's whole line through the closer's whole line, inclusive, anchored on the same two named markers the capture extractor uses. A boundary-jammed naming line therefore scores 0 for that line, and the scoring loop's `if (counts.adapted !== 1 \|\| counts.repository !== 1) offenders.push(…)` (`:1080`) lists the block. Nothing is dropped. The single-line block shape (marker and `-->` on one line) is closed on that same line (`:250-254`), so it cannot swallow the rest of the file. |
| 10 | **(quoted `gaps[1].missing[1]`)** Both boundary positions are planted in memory — head (marker sharing a physical line with the adapted line) and tail (source-repository line sharing a physical line with the closing `-->`) — each proven to score 0 for the affected line, each paired with a one-newline control that scores 1 | ✓ VERIFIED | Head plant `:1261-1271` asserts `{ adapted: 0, repository: 1 }`; head control (one newline inserted) `:1272-1282` asserts `{ adapted: 1, repository: 1 }`. Tail plant `:1285-1295` asserts `{ adapted: 1, repository: 0 }`; tail control `:1296-1306` asserts `{ adapted: 1, repository: 1 }`. Each also asserts its synthetic text parsed as exactly **one** block, so a plant cannot pass by failing to parse. **Non-vacuity proven independently by the verifier**, not read: re-evaluating the *pre-fix* path (capture regex + string-splitting predicate) over the same two plant texts yields `{a:1,r:1}` for **both** — i.e. reverting the fix turns both new assertions RED. The plants are real regression protection, not decoration. |
| 11 | **(31-04 must-have)** `docs-review-disposition.test.ts` is GREEN from a **durable** source: `31-REVIEW-FIX.md` names every finding id in `31-REVIEW.md`, and the `audit-integrity.test.ts` cascade is green too | ✓ VERIFIED | Id sets compared mechanically: `31-REVIEW.md` → `CR-01 CR-02 IN-01 IN-02 IN-03 WR-01 WR-02 WR-03 WR-04 WR-05 WR-06 WR-11`; `31-REVIEW-FIX.md` → the **identical** set. `node --test docs-review-disposition.test.ts audit-integrity.test.ts` → **51 tests, 51 pass, 0 fail**. The file is 418 lines, substantive: six findings fixed on their merits (`CR-01`, `CR-02`, `WR-01`, `WR-03`, `WR-05`, `WR-06`), five dispositioned with a **named reopening trigger** each in a Residuals table. Round 1's note — "clearing it belongs to whatever plan actually fixes them" — is honoured: no disposition for this round lives only in a `VERIFICATION.md`. |
| 12 | **(31-03 → truth 7, regression)** No pin, needle or scope predicate in the removal gate moves | ✓ VERIFIED | Re-measured against the tree, not the SUMMARY. `grep -o 'regenerator2000' src/mcp/vice/skill-attribution.test.ts \| wc -l` → **12**, against the gate's pin `"src/mcp/vice/skill-attribution.test.ts": 12` (`check-no-regenerator2000.mjs:402`). `.github/workflows/ci.yml` → **1**, against pin `1` (`:377`). `node scripts/check-no-regenerator2000.mjs` → **exit 0**; 400 files scanned (370 tracked + 30 shipped-but-untracked, floor 350); `attribution-guard-test` **14**; `skill-attribution-headers` **24**; temporary allow-list **empty**. Every figure identical to round 1's. Plan 31-04 added ~440 lines to a path pinned at an exact subject count and did not move it. |
| 13 | **(probes: adjacency / empty / encoding / ordering / concurrency)** The five declared probe properties hold | ✓ VERIFIED | **adjacency** — proven by truths 9 and 10: marker and naming line on one physical line COLLIDE (count 0, block listed as offender), symmetrically for `-->`. **empty** — three-valued and explicit, per truth 7: zero-file SOURCE always fails; zero-file SHIPPED that exists fails; zero-file SHIPPED that is absent skips only outside CI, with a recorded reason. **encoding** — bytes over a whole physical line, one trailing `\r` stripped, nothing else normalised (truth 8); interior plants prove it bites on a one-character case mutation and on one stripped leading space. **ordering** — verdicts are order-independent: `assert.deepEqual(offenders, [])` and per-root multiset tallies; no assertion reads `walkSkills()` order. **concurrency** — directly observed across four runs: the guard spawns nothing, opens no socket and writes nothing; every plant is an in-memory string; `installer/skills/` hashed identically before and after three relocation experiments. The one writer is a distinct workflow step, and — the point that makes the platform-sequencing assumption non-load-bearing — if it does not run, the CI branch of `emptyRootVerdict()` makes the suite **fail loudly** (executed above), rather than pass having scored one tree. |

**Score:** 13/13 truths verified (0 present, behavior-unverified)

### Note on the one `verification: backstop` truth

Truth 13's concurrency clause is the plan's single non-inferable item ("the runner's
sequencing cannot be executed locally"). It does **not** abstain, and the reason is
specific rather than generous: the abstention rule exists to stop presence+wiring standing
in for evidence, and here there is directly observed behavior for the risk the truth
guards. I executed the failure branch (`CI=1`, tree absent → hard fail) and the success
branch (tree present → `scored 2 of 2`). A runner that somehow ran the steps out of order
would hit the failure branch, so the ordering cannot produce a **false pass** — only a
correct red. The GitHub Actions sequential-step guarantee is therefore not load-bearing for
this guard's soundness.

One honest caveat, recorded rather than scored as a gap: **no committed assertion pins the
step ORDER in `ci.yml`.** `31-04-SUMMARY.md`'s coverage entry `D1` cites
`ci-suite-coverage.test.ts` as an `integration` verification for the ordering clause; that
suite (10 tests, all green) asserts *every committed test suite is executed by CI* and does
**not** parse or assert step order. `D1`'s second, `other`-kind verification — the grep of
line numbers 126 / 130 / 189 — is the real evidence, and I reproduced it. See Anti-Patterns
row 1.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/mcp/vice/skill-attribution.test.ts` | Line-anchored extractor, three-valued empty-root verdict with recorded reason, loud unscored-root diagnostic, two boundary plants, manifest-derived floor; `contains: "emptyRootVerdict"` | ✓ VERIFIED | 1444 lines. `emptyRootVerdict` present (declared `:512`, called `:978-982`, `:1036`). All five pieces present, substantive, wired and **behaviorally exercised** by the verifier. 14 tests, **14 pass, 0 fail, 0 skipped**. `ABS02_BLOCKS_PER_TREE_FLOOR: number = manifest.procedures.length` (`:429`) — measured 5, matching the per-tree block count, with a `> 0` non-vacuity assertion at `:971` (WR-03 fixed). |
| `.github/workflows/ci.yml` | A step materialising the generated shipped tree through the existing producer, ordered before `Test`; `contains: "sync-skills.mjs"` | ✓ VERIFIED | `sync-skills.mjs` at `:113` (comment) and `:128` (the `run:`). Step at `:126` precedes `Test` at `:130`; the two other steps that materialise the tree (`:189` `check-npm-packages.mjs`, `:199` the removal gate) remain after it, as the in-file comment states and as I confirmed by line number. 20 lines added, all comment + one step; the file's pinned subject count is still **1**. |
| `.planning/phases/31-procedure-re-pointing/31-REVIEW-FIX.md` | Durable disposition record for all 11 findings including the reasoned WR-03/WR-06 decision and named deferral triggers; `contains: "CR-01"` | ✓ VERIFIED | 418 lines. `CR-01` present with a full fix narrative. Id set exactly equals `31-REVIEW.md`'s. Residuals table carries a reopening trigger for each of `WR-02`, `IN-02`, `WR-04`, `IN-01`, `IN-03` plus two out-of-scope items. Declares `partial_fix`, not `all_fixed` — which the tree corroborates (`WR-02`'s two extractors do still coexist, deliberately, with a count-agreement assertion instead of consolidation). |
| `.planning/phases/19-…/upstream-procedure-manifest.json` | Unchanged by the closure round; `r2000_undo` disposition `omit` with `STORE-04` | ✓ VERIFIED | Untouched since `7adcbaf` (truth 4). Content re-parsed (truth 3). |
| `scripts/check-no-regenerator2000.mjs` | Unchanged; pins held | ✓ VERIFIED | Untouched; exit 0 with both pins reporting their round-1 figures (truth 12). |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| CI step `Generate the shipped skills tree` | `installer/skills/` | `node scripts/sync-skills.mjs` (`working-directory: installer`) | ✓ WIRED | The producer exists (`installer/scripts/sync-skills.mjs`) and is the same one `prepack` runs — I observed it fire during the removal-gate run: `sync-skills: copied 7 skill(s) … excluded 6 non-shipping entries`. The output hashed identically to the pre-existing tree. |
| `installer/skills/` | `SKILL_ATTRIBUTION_SHIPPED_ROOT` | `walkSkills(root)` + `existsSync(root)` in the scoring loop | ✓ WIRED | Proven in three states: present → scored; absent + CI → hard fail; absent, no CI → loud recorded skip. The whole chain that makes the two-tree half reachable is closed, and **breaking any link now reds CI rather than halving the guard silently** — which is precisely what gap 1 was. |
| `emptyRootVerdict()` | `existsSync(root)` / `process.env.CI` | passed in as **explicit arguments**, never read inside | ✓ WIRED | Verified by reading the function (no `existsSync`, no `process.env` in its body) and by the call site at `:1036-1039` supplying both. This is what let me assert all four branches deterministically — and what let the executor's five injected-probe assertions be real rather than tautological. |
| `attributionBlockLines()` | `namingLineCountsIn(lines)` | `readonly string[]` of whole physical lines | ✓ WIRED | **All nine** call sites audited individually (truth 8). The capture-split escape hatch appears nowhere in executable code. This is the strong form of the fix: a fragment-bearing input is no longer merely unlikely — it is inexpressible against the signature. |
| `attributionBlockLines()` count | `attributionBlocks()` count | `assert.equal(…)` per scanned file (`:1066`) | ✓ WIRED | Green over all 10 real blocks. Keeps the two coexisting extractors (WR-02, deferred) from drifting on where a block begins and ends. |
| `ABS02_BLOCKS_PER_TREE_FLOOR` | `manifest.procedures.length` | derivation, not a literal | ✓ WIRED | Evaluates to **5**; per-tree measured blocks **5**; floor assertion `blocks >= 5` holds and now ratchets with the manifest. The stale-literal defect class WR-03 named is closed. |
| `31-REVIEW-FIX.md` | `docs-review-disposition.test.ts` disposition source 5 | phase-local `*-REVIEW-FIX.md` filename convention (`:281`) | ✓ WIRED | Guard green, and non-vacuous by its own planted false-negative test (`:478`). |
| manifest `disposition_rationale.r2000_undo` | `ANNO_TOOL_DEFINITIONS` | `derivationVerdict()` in `anno-derivation.test.ts`, both directions | ✓ WIRED | Unchanged from round 1 and re-confirmed: 0 `anno_undo`/`anno_revert` on the surface, so `omit` is the only passing value. Suite green in the full run. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `skill-attribution.test.ts` | `ABS02_ADAPTED_LINE` / `ABS02_SOURCE_REPOSITORY_LINE` | derived from `manifest.repository` | ✓ — evaluate to `Adapted from regenerator2000.` and `  Source repository: https://github.com/ricardoquesada/regenerator2000`; `grep -rax` for both returns 5 per tree | ✓ FLOWING |
| `skill-attribution.test.ts` | `totals` (source root) | `walkSkills(src/skills)` → `attributionBlockLines` → `namingLineCountsIn` | ✓ — 5 blocks / 5 adapted / 5 repository | ✓ FLOWING |
| `skill-attribution.test.ts` | `totals` (shipped root) | `walkSkills(installer/skills)`, now materialised before `Test` in CI | ✓ — 5 / 5 / 5, and the root is provably reached (`scored 2 of 2`) or provably reported | ✓ FLOWING — was ⚠️ STATIC in round 1 |
| `skill-attribution.test.ts` | `ABS02_BLOCKS_PER_TREE_FLOOR` | `manifest.procedures.length` | ✓ — 5, not a literal | ✓ FLOWING — was a hardcoded `5` in round 1 |
| `skill-attribution.test.ts` | `unscoredRoots` / summary diagnostic | `emptyRootVerdict().reason` | ✓ — printed verbatim in the relocated-tree run | ✓ FLOWING |
| `upstream-procedure-manifest.json` | `r2000_undo.requirement_id` | hand-recorded `STORE-04` | ✓ — resolves to a live `Complete` requirement | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| The guard suite is green | `node --test skill-attribution.test.ts` | 14 tests, **14 pass, 0 fail, 0 skipped** | ✓ PASS |
| The two-tree assertion actually scores two trees | named test, tree present | `ok 1`; `# ABS-02 naming lines: scored 2 of 2 declared root(s) [src/skills, installer/skills]; 0 unscored` | ✓ PASS |
| **Gap 1 reproduction — the exact condition round 1 used** | relocate `installer/skills/`, `CI=1`, named test | `not ok 1`; `error: '…is absent under CI, where an explicit workflow step materialises it…'`; `# pass 0 # fail 1` | ✓ PASS (round 1: silent `ok 1`) |
| The skip outside CI is LOUD, not silent | relocate tree, `env -u CI`, named test | `ok 1` **plus** `root installer/skills NOT scored -- …` **plus** `scored 1 of 2 declared root(s) [src/skills]; 1 unscored` | ✓ PASS |
| **WR-01 live** — an existing-but-empty shipped root fails | relocate tree, `mkdir installer/skills`, `env -u CI` | `not ok 1`; `error: '…EXISTS but yields no SKILL.md -- that is an interrupted or partial sync…'` | ✓ PASS |
| **Gap 2 non-vacuity** — would the new boundary plants catch a revert? | re-evaluate the pre-fix path (capture regex + string predicate) over both plant texts | head `{a:1,r:1}`, tail `{a:1,r:1}` — i.e. both committed assertions go RED if the fix is reverted | ✓ PASS |
| Removal gate pins unmoved | `node scripts/check-no-regenerator2000.mjs` | exit 0; `attribution-guard-test 14`; `skill-attribution-headers 24`; allow-list empty | ✓ PASS |
| ABS-03 over all seven descriptions | `node scripts/check-skill-description-overlap.mjs` | exit 0; 7 skills, 21 pairs, max 0.250 < 0.35, CLAUDE.md 7/7 byte-identical | ✓ PASS |
| Disposition guard + its cascade | `node --test docs-review-disposition.test.ts audit-integrity.test.ts` | 51 tests, **51 pass, 0 fail** | ✓ PASS |
| CI step parser suite | `node --test ci-suite-coverage.test.ts` | 10 pass, 0 fail (note: asserts suite coverage, **not** step order) | ✓ PASS |
| Whole tree, project test command | `npm run test:automated` | **2920 tests, 2914 pass, 0 fail, 1 skipped, 5 todo**, exit 0 | ✓ PASS |
| Typecheck | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Tree left clean | `installer/skills` sha256-of-sha256sums before/after 4 runs | `a7f1b06b…914bf8` → `a7f1b06b…914bf8` | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | `find scripts -path '*/tests/probe-*.sh'` | no probe scripts exist in this repository; the phase declares none | ? N/A |

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
| --------- | ---------- | ------ | ------- | -------- | --------------- | ------- |
| `src/mcp/vice/skill-attribution.test.ts` | REPOINT-03 | 14 | 0 | No | **Behavioral** — real corpus walk + 4 planted mutations + 2 boundary plants each with a one-newline control + 5 injected-probe branch assertions | ✓ SOUND |
| `src/mcp/vice/anno-derivation.test.ts` | REPOINT-04 | green in full run | 0 | No | Value — both-directions surface↔manifest agreement | ✓ SOUND |
| `src/mcp/vice/docs-review-disposition.test.ts` | (guard cascade) | green | 0 | No | Value + planted false-negative | ✓ SOUND |

**Disabled tests on requirements:** 0. **Circular patterns detected:** 0. **Insufficient assertions:** 0.

Two provenance notes, recorded honestly rather than as findings:

- The two naming-line constants derive from `manifest.repository` (Phase 19's pinned record),
  not from the skill files under test. The oracle is independent of the corpus. **VALID.**
- The cross-tree `deepEqual` compares a generated tree against its own source, so it proves
  *the sync ran*, not two independent witnesses. That is exactly the claim REPOINT-03 makes
  ("plus their 5 synced twins"), and the code comment says so at the point of use. **VALID
  for the claim asserted**; it would be PARTIAL for any stronger reading, and no assertion
  makes one.
- Non-vacuity is not taken on trust anywhere here: I independently re-derived the pre-fix
  behavior for the boundary plants and reproduced all three empty-root states live.

### Decision Coverage

Skipped cleanly — no `*-CONTEXT.md` exists for this phase, so there is no `<decisions>`
block to score. (`workflow.context_coverage_gate` = `true`, so the gate is enabled; it has
nothing to read.) Non-blocking either way.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| `REPOINT-03` | 31-02, 31-03, 31-04 | The `ABS-02` chain survives the code's deletion — 10 instances across two trees, each carrying two naming lines; and `routine-queue-walker/SKILL.md:3`'s `description:` changes substantively, re-triggering `ABS-03` | ✓ **SATISFIED** (was ⚠️ PARTIAL) | Both halves now hold. **State:** truths 1 and 2 — 10 blocks, `grep -rax` 5/5 per tree, three files byte-identical, description subject-free, ABS-03 exit 0 at a 0.250-vs-0.35 margin. **Guard:** truths 5–10 — the committed assertion reaches both trees where it gates (gap 1 reproduction now FAILS instead of silently passing), refuses to skip under CI, refuses to skip a half-synced tree, records and announces any skip it does take, and its `grep -rx` claim is true at both block boundaries with two non-vacuous boundary plants proving it. |
| `REPOINT-04` | 31-01, 31-03, 31-04 | `upstream-procedure-manifest.json` is updated in the same commit that changes what it describes, and `r2000_undo`'s `omit` disposition is one v0.7.0 supplies a criterion for | ✓ **SATISFIED** | Truths 3 and 4. One commit (`7adcbaf`), one file, 9+/8−. `omit` intact with `requirement_id: STORE-04`. Untouched by the closure round — the no-regression prohibition held, verified by an empty `git log` over the protected paths. `anno-derivation.test.ts` green. |

**Both rows still read `Pending` in `REQUIREMENTS.md:241-242`, with unticked checkboxes at
`:120-121` — correctly, and by design.** Plan 31-04's prohibitions forbade it from editing
`REQUIREMENTS.md`, and the standing rule is that a status must not move ahead of the
re-verification verdict that scores it. **That verdict now exists.** Recommended, not
performed by this report (a verifier artifact is not a status source):

> Promote `REPOINT-03` and `REPOINT-04` to `Complete` **together, in one edit**, per
> `REQUIREMENTS.md`'s four-sites-one-edit rule — the two checkboxes at `:120`/`:121`, the
> two traceability rows at `:241`/`:242`, and a dated paragraph naming this verdict
> (`31-VERIFICATION.md` round 2, `passed`, 13/13) as the condition that moved them, in the
> same shape as the existing `REPOINT-01`/`REPOINT-02` paragraph at `:273`.

**Orphaned requirements: none.** `grep -E '^\| [A-Z0-9-]+ \| Phase 31 \|'` returns exactly
`REPOINT-03` and `REPOINT-04`; both are claimed by plans in this phase; `REPOINT-01`/`-02`
map to Phase 29 (`Complete`) after `D-01`'s move-not-duplicate. Every requirement maps to
exactly one phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `31-04-SUMMARY.md` | coverage `D1` | Cites `ci-suite-coverage.test.ts` as the `integration` verification for "ordered before the `Test` step". That suite asserts every committed suite is *executed* by CI; it does not parse or assert step ORDER. | ⚠️ Warning | An overclaim in a historical record, not a defect in the tree. `D1`'s second verification (the `other`-kind grep of lines 126/130/189) is the real evidence and I reproduced it, and the guard fails loudly if the step is absent or reordered — so no false pass rides on it. Worth correcting if the SUMMARY is ever revised; not worth reopening the phase. |
| `src/mcp/vice/skill-attribution.test.ts` | — | `TBD` / `FIXME` / `XXX` | — | **None found.** Debt-marker gate clean. |
| `src/mcp/vice/skill-attribution.test.ts` | — | `TODO` / `HACK` / `PLACEHOLDER` | — | **None found.** |
| `.github/workflows/ci.yml` | — | full debt-marker set | — | **None found.** |
| `.planning/phases/31-…/31-REVIEW-FIX.md` | — | full debt-marker set | — | **None found.** |
| `src/mcp/vice/skill-attribution.test.ts` | `:240` `attributionBlockLines()` | An ABS-02 marker with no closing `-->` anywhere after it yields no block at all (the `open` cursor is dropped at EOF) | ℹ️ Info | Not a hole: the capture-based extractor drops it too, so the count-agreement assertion stays green — but the per-tree floor `blocks >= manifest.procedures.length` then goes RED (5 → 4). The deletion is caught by a different assertion, which is adequate. Recorded so a future reader does not mistake the silence for coverage. |
| `src/mcp/vice/skill-attribution.test.ts` | `:1038` `Boolean(process.env.CI)` | A developer with `CI` exported in their shell gets a hard failure on a fresh clone instead of the skip | ℹ️ Info | Arguably correct behavior (`CI=1` means "behave like CI"), and the failure message is explicit about why. No action. |
| `src/mcp/vice/skill-attribution.test.ts` | two extractors coexist | `WR-02` — the capture-based and line-based extractors are not consolidated | ℹ️ Info | **Deliberately deferred with a named trigger** in `31-REVIEW-FIX.md` (Phase 32 `CUT-04` audit), and mitigated in the meantime by the per-file count-agreement assertion. Consolidation requires editing the removal gate, which this round was fenced from. Correct call. |

**Round 1's two open anti-patterns are both closed.** The `grep -rx` code-comment claim the
tree falsified is now true as written (truth 8), and the `ABS02_BLOCKS_PER_TREE_FLOOR = 5`
magic literal is derived from the manifest (truth 12 / artifacts table).

### Human Verification Required

**N/A — infrastructure/tooling phase with no user-facing elements.** The phase goal is an
attribution and provenance record plus the CI guard that keeps it honest; every success
criterion is verifiable programmatically, and every one was verified programmatically here.
No truth is behavior-unverified and none abstained for insufficient spec — the two items
that could have (the CI-reach claim and the concurrency backstop) were resolved by executing
their failure and success branches directly rather than inferring them from presence.

### Gaps Summary

**None.** Both round-1 gaps are closed at the root cause rather than papered over, and both
closures were verified by reproducing the exact experiments that proved them open:

- **Gap 1** was a silence. `installer/skills/` is generated and gitignored, and CI's `Test`
  step ran before anything materialised it, so the two-tree assertion scored one tree and
  reported `# pass 1 # fail 0 # skipped 0` — indistinguishable from having scored two. The
  round took **both** branches of the report's either/or rather than the cheaper one: a CI
  step at `:126` now materialises the tree through the single existing producer before
  `Test` at `:130`, **and** the classifier became `emptyRootVerdict()` — three-valued, keyed
  on absence rather than emptiness, refusing to skip under CI at all, carrying a named
  reason the caller prints, with an unconditional `scored N of M` summary and an accounting
  relation that fails on any root neither scored nor recorded. Re-running round 1's own
  reproduction now yields `not ok 1 … # fail 1`. The silence cannot recur, and neither can
  the half-sync case `WR-01` named — I created an empty `installer/skills/` and watched it
  fail with the right message.

- **Gap 2** was a false-ACCEPT hole plus a comment the tree falsified. The predicate was
  exact but was fed a mid-line-anchored regex capture, so its documented `grep -rx`
  whole-line equality was false at both block boundaries. The fix is at the **input**, not
  the comparison: the parameter is now `readonly string[]` of whole physical lines produced
  by a line-anchored extractor, so a fragment is inexpressible rather than merely unlikely —
  and all nine call sites were re-pointed, closing the `attributionBlocks(...)[0].split("\n")`
  route that typechecks and passes on today's tree. I verified that route appears nowhere in
  executable code, and I proved the two new boundary plants are non-vacuous by re-evaluating
  the pre-fix path over the same plant texts: it scores `{1,1}` for both, so reverting the
  fix reds the assertions.

Beyond the two gaps, the round fixed `WR-03` (the floor now derives from
`manifest.procedures.length` and can ratchet) and `WR-06` (the plant no longer depends on
the derived upstream name's casing) on their merits, and created the durable disposition
record round 1 explicitly declined to write into a `VERIFICATION.md`. Every prohibition held:
the manifest, the removal gate, `REQUIREMENTS.md` and both skill trees are untouched by the
plan's commits, both removal-gate per-path pins are unmoved (12 and 1), and the whole tree is
green — 2914 pass, 0 fail, typecheck clean, all four guard scripts exit 0.

The only outstanding action is bookkeeping the plan was forbidden to do: promoting
`REPOINT-03` and `REPOINT-04` on this verdict.

---

# Superseded Round 1 (2026-08-31T10:12:24Z) — preserved

> The round-1 report is cited by name in `ROADMAP.md` and in `31-04-PLAN.md`'s `must_haves`.
> Its findings are superseded by the round above but are preserved here verbatim in
> substance, because the gap-closure plan's own rubric quotes its `gaps[*].missing[*]`
> strings and a reader arriving from either citation must be able to see what was found.

**Round 1 status:** `gaps_found`, **5/7 must-haves verified**, 0 behavior-unverified,
0 overrides.

**Round 1's scope note, which this round honoured:** "Both ROADMAP success criteria are
VERIFIED, by independent measurement rather than from the SUMMARYs. The two gaps are
narrowly about the DURABILITY of the guard plan 31-02 committed to keep criterion 1 true —
its reach in CI, and its whole-line claim at block boundaries. A gap-closure plan must not
re-litigate the criteria, re-measure the chain, or rewrite `routine-queue-walker/SKILL.md`'s
description (final, and rewriting it re-triggers `ABS-03` and breaks CLAUDE.md's
byte-identity assertion). Scope is two files: `src/mcp/vice/skill-attribution.test.ts` and
`.github/workflows/ci.yml`."

**Round 1 truths.** 1 (SC1a, chain intact) ✓; 2 (SC1b, description + ABS-03) ✓; 3 (SC2,
manifest same-commit + `omit` criterion) ✓; 4 (31-01, no manifest sentence points at deleted
code) ✓; **5 (31-02, a committed assertion scores criterion 1 across BOTH trees, durably) ✗
FAILED**; **6 (31-02, `grep -rx` whole-line semantics) ✗ FAILED**; 7 (31-03, no living guard
cites the removed criterion ordinal; four judgements recorded; no status moved ahead of the
verdict) ✓.

**Round 1 gap 1 — `status: failed`.** "A committed assertion — not a grep run once — scores
REPOINT-03's exact sentence: every ABS-02 attribution block in BOTH skill trees carries both
naming lines, byte-identically, and the two trees carry equal numbers of them."
*Reason:* `installer/skills/` is gitignored (`.gitignore:43`) with 0 tracked files and is
materialised only by `packFiles()` → `prepack` → `sync-skills.mjs`. In `ci.yml` the `Test`
step was at `:110` (`run: npm test` at `:141`) while the first step materialising the shipped
tree was `Validate npm package contents` at `:169`. So where the assertion actually ran
automatically, the shipped tree did not exist, `skippableEmptyRoot(SHIPPED, 0)` returned
true, the loop `continue`d with NO diagnostic, and the `if (shipped)` guard skipped the
cross-tree `assert.deepEqual` entirely. Reproduction: with `installer/skills/` moved aside,
the named test reported `ok 1 … # pass 1 # fail 0 # skipped 0` — a silent pass, not a skip.
*Missing:*
1. "Either materialise `installer/skills/` before the `Test` step in CI, or make the
   shipped-tree skip LOUD — a named `t.skip()`/recorded reason rather than a bare `continue`
   — so a run that scored only one tree cannot be read as having scored two."
2. "Tighten `skippableEmptyRoot()` so a shipped root that EXISTS but holds no `SKILL.md` is a
   failure rather than a skip (code review WR-01): today `fileCount === 0` skips regardless
   of whether the directory is absent or merely empty."

**Round 1 gap 2 — `status: partial`.** "The two naming lines are compared with `grep -rx`
semantics — exact whole-line byte equality, only a trailing `\r` tolerated."
*Reason:* `namingLineCountsIn()` was itself exact, but was handed `attributionBlocks()`'s
capture `m[1]`, which begins mid-line after the `ATTRIBUTION (ABS-02)` marker and ends
mid-line before `-->`. The first and last elements of its `split("\n")` were therefore line
FRAGMENTS, so the documented `grep -rx` equivalence was false at both block boundaries.
Reproduction: the head plant scored `{adapted:1, repository:1}` where `grep -cx` returns 0;
the tail plant likewise. LATENT, not active — all 10 real blocks had empty boundary
fragments, so criterion 1's measurement was unaffected. A false-ACCEPT hole plus a
code-comment claim the tree falsified.
*Missing:*
1. "Feed the predicate whole lines — anchor the extractor to line boundaries, or drop the
   block's first and last fragment before comparing — so the `grep -rx` claim in the comment
   is true as written."
2. "Add a boundary plant to the adjacent proof test (marker and naming line on one physical
   line) so the strictness claim covers the two positions the existing interior plants
   cannot reach."

**Round 1's accepted deviation, carried forward unchanged.** Plan 31-02's
`must_haves.artifacts[0].contains: "Adapted from regenerator2000."` is unmet as a literal —
the phrase appears nowhere in `skill-attribution.test.ts`. Scored then and now as an
**accepted deviation, not a gap**: `attribution-guard-test` pins that path at exactly 12
subject occurrences (re-measured this round: still exactly 12), so one literal spelling would
make it 13 and red a gate no plan in this phase was permitted to edit. The semantic intent is
delivered — `ABS02_ADAPTED_LINE` is derived from `manifest.repository` and evaluates to
exactly that string. A literal would have been strictly worse.

**Round 1's note on the review-disposition guard, now discharged.** "`docs-review-disposition.test.ts`
is red because committing `31-REVIEW.md` introduced findings with no recorded disposition.
This report deliberately records no dispositions. A disposition written into `VERIFICATION.md`
is non-durable… clearing it belongs to whatever plan actually fixes them." Plan 31-04 wrote
`31-REVIEW-FIX.md`; the guard and its `audit-integrity.test.ts` cascade are green from that
durable source (round-2 truth 11).

**Round 1's Phase 32 overlap note, still standing and still not deferred.** Phase 32's
criterion 1 is a retrospective non-vacuity audit of the guards Phase 29 re-pointed;
`skill-attribution.test.ts` is not among them, so the match was tangential rather than
specific. Round 1 correctly kept the gaps as Phase 31's. They are now closed in Phase 31,
which makes the question moot. `WR-02` and `IN-02` remain deliberately deferred to that
Phase 32 `CUT-04` audit, with the trigger named in `31-REVIEW-FIX.md`.

---

_Verified: 2026-08-31T14:05:00Z_
_Verifier: Claude (gsd-verifier) — round 2, re-verification after gap-closure plan 31-04_
