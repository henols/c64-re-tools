---
phase: 19-absorbed-procedures-and-the-coverage-instrument
plan: 05
subsystem: testing
tags: [skills, dispatch, jaccard, ci-gates, decisions, validation, the external analyser, licensing]

# Dependency graph
requires:
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "19-01's seventh skill (routine-queue-walker), the pinned upstream manifest with its resync_triggers array, and the D18-16 stdio-multiplexing measurement this plan's decision 5 closes on"
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "19-02's four remaining absorbed procedures and its deliberate byte-identical hold on every description, which is what let this plan measure a stable corpus"
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "19-03's coverage instrument and 19-04's coverage CLI verb and packer finding — the deliverables decisions 2 and 3 date"
  - phase: 11-anno-annotation-surface
    provides: "anno-tools.ts's curated surface and its header, which carried the cursor-tool invitation this plan closes"
  - phase: 08-stock-backend-parity
    provides: "the three-file gate shape (predicate module / CI runner / planted-violation test) and ci-guardrails.test.mjs's frozen guard-script list this plan's fourth gate joins"
provides:
  - "scripts/lib/skill-descriptions.mjs — pure, string-in predicates for trigger-collision detection: frontmatter parse, clause split, a seven-step normalisation, Jaccard, the collision detector, the allowlist audit, and the hand-maintained-copy comparison"
  - "scripts/check-skill-description-overlap.mjs — the fourth blocking CI gate, wired into ci.yml and held there by the frozen guard-script list"
  - "src/mcp/vice/skill-description-overlap.test.ts — 32 tests: positive control, false-positive control, boundary, ordering, staleness, and every normalisation step pinned individually"
  - "DESCRIPTION_OVERLAP_THRESHOLD = 0.35 with the measurement that fixes its value recorded beside it, and an EMPTY COLLISION_ALLOWLIST"
  - "Three sharpened skill descriptions, and CLAUDE.md's project-skills table now compared byte-for-byte by the same gate"
  - "19-DECISIONS.md — five dated decisions, each with evidence, alternatives and a named checkable reversal or re-sync condition"
  - "19-VALIDATION.md — every requirement beside a command that actually ran, fourteen planted-violation demonstrations, and the full seven-step phase gate"
affects: [phase-20-decomposition, phase-21-rebuild, milestone-close]

actuals:
  tokens: 32302
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Trigger-collision detection as a fourth instance of the three-file gate shape, reusing skill-corpus.mjs rather than deriving a second walker"
    - "A threshold whose justifying measurement is recorded beside the constant, naming what would change it (a re-measured ceiling) and what would not (a failing pair)"
    - "Shrink-by-failing allowlist with BOTH directions asserted: an uncovered collision fails, and so does an entry covering no live collision"
    - "String endsWith stemming and character-class-only filters, so a text-processing gate carries no backtrackable pattern at all"

key-files:
  created:
    - scripts/lib/skill-descriptions.mjs
    - scripts/lib/skill-descriptions.d.mts
    - scripts/check-skill-description-overlap.mjs
    - src/mcp/vice/skill-description-overlap.test.ts
    - .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-DECISIONS.md
  modified:
    - .github/workflows/ci.yml
    - src/mcp/vice/ci-guardrails.test.mjs
    - src/mcp/vice/anno-tools.ts
    - src/skills/acme-build/SKILL.md
    - src/skills/c64-memory-mapping/SKILL.md
    - src/skills/routine-queue-walker/SKILL.md
    - CLAUDE.md
    - .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-VALIDATION.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "The absorbed procedures are a SNAPSHOT at one pinned commit, not a tracked dependency — re-sync is a hash comparison against the manifest's five digests, mechanised by its resync_triggers array, with two named triggers: any move off the external analyser 0.9.20, and any change to anno_get_binary_info's field set"
  - "anno_toggle_splitter (DECOMP-01, BUILD-02) and anno_set_immediate_format (which IS BUILD-03's low/high-byte mechanism) are PROPOSED in Phase 19 and implemented at the start of Phase 20 — the absorption diff acted as a requirements-discovery instrument, and dating that here is exactly what ABS-04 exists for"
  - "SURF-03's acceptance bar is 'a project-owned route exists, is exercised end to end, and never guesses', NOT 'a name is reported on this machine' — closed on a negative result stated as one, with upstream's signature table deliberately not copied and no invented name placed on the upstream-prefixed surface"
  - "MIT is elected from the dual MIT OR Apache-2.0, and loses nothing: Apache-2.0 §4(b)'s modification notice is discharged regardless by every per-file header's ADAPTED, NOT VERBATIM statement"
  - "D18-16's reader-writer deferral is CLOSED by measurement, not re-deferred: the child reads serially, so the upgrade would buy zero parallelism and the coarse FIFO mutex is an exact model of the child rather than a compromise"
  - "The cursor-tool invitation in anno-tools.ts is answered rather than left open — a real caller DID appear in this phase's diff, and its own upstream text forbids relying on the cursor, so the trio stays held"
  - "A collision is resolved by SHARPENING a description; the threshold constant was not touched, no skill was excluded, and the allowlist is empty in both directions"
  - "The new gate was wired into ci.yml as a blocking step in the same commit that created it — a guard script CI does not run is a file, not a control"

patterns-established:
  - "The dispatcher read as an acceptance step: reading all seven descriptions in one sitting and requiring a one-clause distinguisher per skill found two trigger fights scoring 0.200 and 0.167 that the threshold would never have fired on"
  - "Sharpening names the distinguishing INPUT or OUTPUT rather than deleting trigger clauses — deleting a trigger would make a skill undiscoverable to move a metric"
  - "A verbatim hand-maintained copy is compared by the same gate that owns the canonical text, not by a one-off diff at the moment it was written"
  - "A confounded measurement is recorded with its confound named, never dropped and never reported as a result"

requirements-completed: [ABS-03, ABS-04]

coverage:
  - id: D1
    description: "A pairwise description check runs clean across the whole final seven-skill inventory and prints one OK line carrying skills scanned, pairs compared, the observed maximum with its pair, the threshold and the allowlist size"
    requirement: ABS-03
    verification:
      - kind: integration
        ref: "node scripts/check-skill-description-overlap.mjs -- exit 0; 7 skills scanned, 21 pairs compared, observed maximum 0.250 (c64-program-recon :: c64-provenance-diff), threshold 0.35 inclusive, allowlist size 0"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/skill-description-overlap.test.ts#live-execution control: check-skill-description-overlap.mjs exits 0 with its OK line"
        status: pass
    human_judgment: false
  - id: D2
    description: "The contention rule is inclusive at the threshold and unconditional on an identical normalised token set, one-token clauses are ignored, and a description yielding zero comparable clauses fails rather than passing silently"
    requirement: ABS-03
    verification:
      - kind: unit
        ref: "src/mcp/vice/skill-description-overlap.test.ts#a pair scoring EXACTLY at the threshold IS reported -- the comparison is inclusive, not strict"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/skill-description-overlap.test.ts#identical normalised clauses collide REGARDLESS of the threshold, even at an absurd one"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/skill-description-overlap.test.ts#a clause with fewer than two surviving tokens is ignored entirely"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/skill-description-overlap.test.ts#a description with no trigger phrase and nothing comparable is REPORTED as a failure, not passed"
        status: pass
    human_judgment: false
  - id: D3
    description: "The check is non-vacuous in both directions: a planted exact duplicate is reported, and the two real near-threshold pairs are not"
    requirement: ABS-03
    verification:
      - kind: unit
        ref: "src/mcp/vice/skill-description-overlap.test.ts#planted violation: an exact-duplicate description scores the maximum and IS reported"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/skill-description-overlap.test.ts#false-positive control: the real pairs 19-RESEARCH.md section 4.3 measured just below T are NOT reported"
        status: pass
      - kind: integration
        ref: "acme-build's description copied verbatim over c64-ram-capture's -- runner exit 1 naming both skills, the colliding clause and score 1.000; restored, exit 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "The allowlist shrinks by failing: every entry names both skills, quotes the clause verbatim, carries a reason and an ISO date, and is asserted still-live — a stale entry fails the check until deleted"
    requirement: ABS-03
    verification:
      - kind: unit
        ref: "src/mcp/vice/skill-description-overlap.test.ts#a synthetic STALE allowlist entry is reported as stale"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/skill-description-overlap.test.ts#an entry missing its date, its reason or its verbatim clause is reported malformed"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/skill-description-overlap.test.ts#a live collision with a matching entry is covered; without one it is uncovered"
        status: pass
    human_judgment: false
  - id: D5
    description: "Traversal and census assertions are relations, not literals: pairs compared equals n*(n-1)/2 and the scanned count is asserted against a floor"
    requirement: ABS-03
    verification:
      - kind: unit
        ref: "src/mcp/vice/skill-description-overlap.test.ts#the pairs-compared equality bites on a corpus that lost a SKILL.md (demonstrated on a synthetic map, never on the real tree)"
        status: pass
      - kind: other
        ref: "! grep -Eq 'length === [0-9]+' scripts/check-skill-description-overlap.mjs -- exit 0; ! grep -Eq 'readdirSync|function walk' -- exit 0 (the corpus walker is imported, not re-derived)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Every collision the checker fired on was resolved by sharpening a description, with the observed maximum measured before and after; no skill removed, no exemption added, the threshold untouched"
    requirement: ABS-03
    verification:
      - kind: integration
        ref: "measured with the same command before and after: acme-build :: c64-memory-mapping 0.200 -> 0.100; c64-memory-mapping :: routine-queue-walker 0.167 -> 0.111; inventory maximum 0.250 -> 0.250; allowlist size 0 -> 0"
        status: pass
      - kind: other
        ref: "git diff HEAD -- scripts/lib/skill-descriptions.mjs | grep -c 'DESCRIPTION_OVERLAP_THRESHOLD' returns 0; ls -d src/skills/*/ returns 7"
        status: pass
    human_judgment: true
    rationale: "The two sharpened pairs were found by the plan's own <human-check> -- reading all seven descriptions in one sitting as a dispatcher and requiring a one-clause distinguisher per skill. The metric never fired on either (both sat well under the threshold), so what counts as a real trigger fight here is a reader's judgment that no test asserts. The measured drops are evidence the edits helped; they are not evidence the judgment was right."
  - id: D7
    description: "Every hand-maintained VERBATIM copy of a description agrees with its source, checked permanently rather than once"
    requirement: ABS-03
    verification:
      - kind: integration
        ref: "check-skill-description-overlap.mjs OK line: 'CLAUDE.md project-skills table: 7 rows, all byte-identical to their SKILL.md'"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/skill-description-overlap.test.ts#planted violation: a single changed character in the copy is reported as a disagreement"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/skill-description-overlap.test.ts#planted violation: a skill missing from the copy, and a stale row naming no skill, are both reported"
        status: pass
    human_judgment: false
  - id: D8
    description: "No sharpened description reintroduced a deferred-capability trigger phrase or dropped a mention a gate depends on"
    requirement: ABS-03
    verification:
      - kind: unit
        ref: "src/mcp/vice/skill-attribution.test.ts -- exit 0, 8/8 pass"
        status: pass
      - kind: integration
        ref: "node scripts/check-skill-tool-coverage.mjs and node scripts/check-skill-fork-honesty.mjs -- both exit 0 with their own OK lines"
        status: pass
    human_judgment: false
  - id: D9
    description: "19-DECISIONS.md records five dated decisions — the snapshot-versus-drift trade with its named re-sync triggers and their checking mechanism, the two future-surface tool proposals with the requirement each serves and the phase that implements them, the packer-identity acceptance bar with its named re-open trigger, the dual-licence election, and the closure of the inherited concurrency deferral — each with a reversal or re-sync condition"
    requirement: ABS-04
    verification:
      - kind: other
        ref: "grep -Ec '^\\|? *(Reversal|Re-sync|Reopen)' 19-DECISIONS.md returns 5; DECOMP-01, BUILD-02, BUILD-03 and FUT-01 all named; 19-STDIO-MULTIPLEXING-EVIDENCE.md and resync_triggers both cited"
        status: pass
    human_judgment: true
    rationale: "The plan's own flagged_assumptions row (ABS-04, edge-probe, unresolved/unclassified) says this plainly: the reversal-condition count is STRUCTURAL. It cannot distinguish a checkable condition from a well-formed but unfalsifiable one. The plan's <human-check> -- 'confirm the condition is something a person could actually notice happening' -- is the only thing standing between the two, and it is not a probe-derived predicate. Left unresolved deliberately rather than auto-resolved with a backstop marker."
  - id: D10
    description: "The dual-licence election published in two npm tarballs"
    requirement: ABS-04
    verification:
      - kind: other
        ref: "19-DECISIONS.md decision 4; licence string read verbatim from two independent copies (Cargo.toml.orig:28 and crates/external-analyser-core/Cargo.toml:5); election present in both THIRD-PARTY-NOTICES.md files and every per-file header, with commit and digest asserted equal to the manifest's by skill-attribution.test.ts"
        status: pass
    human_judgment: true
    rationale: "CARRIED FORWARD from 19-01 (D3) and 19-02 (D5), deliberately not closed silently. A licence election published to npm is a legal claim, not a test outcome. Every mechanical check passes -- the strings are present, they agree with the manifest, and the pre-absorption false claim is gone -- but whether these are the right terms to publish is a human call the phase verifier should see."
  - id: D11
    description: "19-VALIDATION.md names, per requirement, a test or command that actually ran, with no placeholder rows and no requirement supported only by prose"
    requirement: ABS-04
    verification:
      - kind: other
        ref: "status: draft -> complete and nyquist_compliant: false -> true; zero occurrences of TBD, TODO or an empty table cell; all seven of ABS-01..SURF-03 appear beside a command string and an observed result; a fourteen-row planted-violation table with red-then-green outcomes"
        status: pass
    human_judgment: false
  - id: D12
    description: "The full test suite passes — the whole suite, not the automated subset — with any pre-existing unrelated failures recorded as a measured baseline rather than attributed to this phase"
    requirement: ABS-04
    verification:
      - kind: integration
        ref: "cd src/mcp/vice && npm test (the FULL glob, never test:automated) -- 2547 tests, 2502 pass, 0 fail, 40 skipped, 5 todo"
        status: pass
      - kind: integration
        ref: "tsc --noEmit exit 0; npm run smoke exit 0 (80 tools advertised); node --test 'src/skills/*/scripts/*.test.mjs' 114/105/0 fail/9 skipped; all four check scripts exit 0"
        status: pass
      - kind: integration
        ref: "baseline attempt at pre-phase commit a352500 in a detached worktree -- 7 failures, ALL host-path/build-staging tests confounded by the relocated checkout and symlinked node_modules; all pass in the real tree, so there is no inherited-failure baseline to net out"
        status: pass
    human_judgment: false
  - id: D13
    description: "The new gate is a blocking CI step, not merely a committed file"
    verification:
      - kind: unit
        ref: "src/mcp/vice/ci-guardrails.test.mjs -- 20 tests pass; the frozen guard-script list now holds 4 entries and each is asserted to run as exactly one BLOCKING step with no continue-on-error"
        status: pass
    human_judgment: false

# Metrics
duration: 46 min
completed: 2026-08-24
status: complete
---

# Phase 19 Plan 05: Inventory-Wide Trigger Uniqueness, Five Dated Decisions, and the Phase Gate Summary

**A pairwise Jaccard trigger-collision gate over all seven skill descriptions — threshold 0.35 justified by the measurement that produced it, empty allowlist, wired blocking into CI — plus three descriptions sharpened by a dispatcher read the metric never fired on, five dated decisions with checkable reversal conditions, and a green seven-step phase gate.**

## Performance

- **Duration:** 46 min
- **Started:** 2026-08-24T19:30Z (approx.)
- **Completed:** 2026-08-24T20:16Z
- **Tasks:** 3
- **Files modified:** 15 (5 created, 10 modified)

## Accomplishments

- **ABS-03 closed on a gate that discriminates.** The three-file checker scans all seven skills, compares all 21 pairs, and exits 0 at an observed maximum of **0.250** against an **inclusive** threshold of **0.35**, with an **empty** allowlist. It is green on *sharpened descriptions*, not a weakened gate: no skill was excluded, no exemption was added, and the threshold constant was never touched (`git diff` over it returns 0 hits after Task 2).
- **The threshold carries its own justification.** `DESCRIPTION_OVERLAP_THRESHOLD` sits beside a comment recording the clean-inventory ceiling (0.250), the two real pairs just under it (0.200 each), and the fact that **upstream's own two most-similar siblings scored 0.261 — above this project's clean ceiling**, which is why absorbed descriptions were rewritten on absorption rather than carried. It also names what would justify changing it (a re-measured ceiling) and what would not (a failing pair).
- **My own measurement reproduced 19-RESEARCH.md §4.3 exactly** — 0.250, 0.200, 0.200 on the same three pairs, from an independently written implementation of the documented normalisation. That agreement is the strongest evidence the normalisation is the one the research described.
- **The dispatcher read found two trigger fights the metric never would have.** Both sat far below the threshold (0.200 and 0.167). Sharpening dropped them to 0.100 and 0.111.
- **ABS-04 closed with five dated decisions**, each carrying evidence, alternatives, and a named condition a person could actually notice happening.
- **The phase gate is green across all seven CI-gating steps**, with the pre-phase baseline attempt recorded honestly rather than reported as a result.

## Task Commits

1. **Task 1: the three-file pairwise checker with its threshold justified from measurement** — `9702a19` (feat)
2. **Task 2: sharpen every description the check fires on, across the final seven-skill inventory** — `f3c0664` (fix)
3. **Task 3: five dated decisions, a validation table with no placeholders, and the phase gate** — `32b50b5` (docs)

## Files Created/Modified

- `scripts/lib/skill-descriptions.mjs` (545 lines) — the predicate module. Frontmatter parse, trigger-clause split, the seven-step normalisation, Jaccard, the collision detector, the allowlist audit, and the hand-maintained-copy comparison. Every export takes a string; the module contains no dynamic module load, no require, no dynamic evaluation and no child-process call, asserted at source level.
- `scripts/lib/skill-descriptions.d.mts` — type declarations so the colocated `.ts` test can import the `.mjs` under strict mode (the fourth instance of this repo's established pattern).
- `scripts/check-skill-description-overlap.mjs` (214 lines) — the CI runner. Imports the corpus walker rather than re-deriving it, accumulates into an error list, never throws, prints one OK line.
- `src/mcp/vice/skill-description-overlap.test.ts` (394 lines) — 32 tests over the same predicate module the runner imports.
- `.github/workflows/ci.yml`, `src/mcp/vice/ci-guardrails.test.mjs` — the new gate as a blocking step, plus the frozen guard-script list raised 3 → 4.
- `src/skills/{acme-build,c64-memory-mapping,routine-queue-walker}/SKILL.md`, `CLAUDE.md` — three sharpened descriptions, propagated byte-identically.
- `src/mcp/vice/anno-tools.ts` — the cursor-tool invitation replaced with its outcome.
- `19-DECISIONS.md` (348 lines, new), `19-VALIDATION.md` (rewritten), `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`.

## The sharpening pass, measured

The checker reported **zero collisions** on the seven-skill inventory before any edit. Task 2's `<human-check>` — read all seven as a dispatcher, and state in one clause what makes each the right choice over its nearest neighbour — is what produced the work list.

Two pairs failed that test. Both hinged on `c64-memory-mapping`'s annotate/document clauses being under-specified about what they take *in*:

| Pair | Before | After | The hesitation |
|---|---:|---:|---|
| `acme-build` :: `c64-memory-mapping` | 0.200 | **0.100** | "list the symbols a program uses" vs "document a disassembly listing" — a caller asking "what symbols does this program use" could mean the assembler's symbol table or an address resolution |
| `c64-memory-mapping` :: `routine-queue-walker` | 0.167 | **0.111** | "annotate or comment assembly" vs "annotate every remaining routine in a project" — both claim annotation work |

Each was resolved by naming the distinguishing **input or output**, never by deleting a trigger clause:

- `acme-build`: "list the symbols a program uses" → "list which symbols an assembled build actually used from its symbol file" (the input is a build, not an address).
- `c64-memory-mapping`: the two clauses now name the resolution against the published memory map and the addresses touched.
- `routine-queue-walker`: "document all undocumented subroutines" now carries its own input, "left in an annotation project".

**Inventory maximum: 0.250 → 0.250, unchanged.** The top pair (`c64-program-recon` :: `c64-provenance-diff`, "reverse engineer a C64 game" :: "cracktro code from game code") was deliberately left alone: the overlap is the single word *game*, and the two are cleanly distinguished by what the caller has in hand — one unknown binary versus two or more releases. Narrowing "reverse engineer a C64 game" would make `c64-program-recon` undiscoverable for its primary trigger to move a number, which the plan explicitly prohibits.

**`COLLISION_ALLOWLIST` length: 0, before and after.** Nothing exempted. Nothing excluded. The threshold constant untouched.

## Decisions Made

The five dated decisions are in `19-DECISIONS.md` in full; in brief:

1. **Snapshot, not tracked dependency** — 53,392 bytes across five paths at `493f8404…`. Re-sync is a hash comparison, mechanised by the manifest's `resync_triggers`. Two triggers: any move off 0.9.20 (read the new crate's own `.cargo_vcs_info.json`, no guessing), and any change to `anno_get_binary_info`'s field set.
2. **Two future-surface tools proposed** — `anno_toggle_splitter` (DECOMP-01, BUILD-02: without it two adjacent tables merge and there is no boundary to cut on) and `anno_set_immediate_format` (which *is* BUILD-03's low/high-byte step). Implemented at the start of Phase 20; both mutating, so both through the existing session seam. The withdrawal condition is named.
3. **SURF-03's bar** — "a project-owned route exists and never guesses", closed on a negative result stated as one, with what was *not* done (upstream's signature table not copied, no library linkage, no invented name on the `anno_` prefix) and why.
4. **MIT elected**, losing nothing: Apache-2.0 §4(b)'s modification notice is discharged regardless by every header's adaptation statement.
5. **D18-16 CLOSED by measurement** — the child reads serially, so a reader-writer upgrade buys zero parallelism and the coarse FIFO mutex is an *exact model* rather than a compromise. The cursor-tool invitation is answered in the same breath: a real caller appeared, and its own upstream text forbids relying on the cursor.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Wired the new gate into CI as a blocking step**

- **Found during:** Task 1
- **Issue:** The plan specified the three-file checker but no CI step. A guard script that CI never runs is not a control — it is a file that passes locally and evaporates silently, which is the exact defect `ci-guardrails.test.mjs` was written to catch for the other three gates. `ci-suite-coverage.test.ts` covers *test directories*, not check scripts, so nothing would have noticed.
- **Fix:** Added a blocking `Validate skill description trigger uniqueness (Phase 19, ABS-03)` step to `.github/workflows/ci.yml`, and extended `ci-guardrails.test.mjs`'s frozen `GUARD_SCRIPTS` list 3 → 4 with its non-vacuity count derived from the array's own length plus a `>= 4` floor.
- **Files modified:** `.github/workflows/ci.yml`, `src/mcp/vice/ci-guardrails.test.mjs`
- **Verification:** `node --test ci-guardrails.test.mjs` — 20/20 pass, each guard asserted to run as exactly one blocking step with no `continue-on-error`.
- **Committed in:** `9702a19`

**2. [Rule 2 - Missing Critical] Made the CLAUDE.md copy agreement permanent instead of a one-off diff**

- **Found during:** Task 2
- **Issue:** The plan's acceptance criterion asked for "a comparison script or a diff over the extracted pairs" proving CLAUDE.md's table matches. Proving they agreed *once*, on the day the descriptions changed, proves nothing about tomorrow — and 19-RESEARCH.md §4.6 named this exact drift surface. A verbatim copy that nothing compares is a description a reader trusts and the dispatcher never sees.
- **Fix:** Added `skillTableDescriptions()` and `copyDisagreements()` to the predicate module and a live-gated assertion to the runner (a checkout with no such table is a visible SKIP, never a silent pass), plus four tests including planted drift, a missing row and a stale row.
- **Files modified:** `scripts/lib/skill-descriptions.mjs`, `scripts/lib/skill-descriptions.d.mts`, `scripts/check-skill-description-overlap.mjs`, `src/mcp/vice/skill-description-overlap.test.ts`
- **Verification:** OK line now reports "CLAUDE.md project-skills table: 7 rows, all byte-identical to their SKILL.md"; a one-character change is reported as `text-differs`.
- **Committed in:** `f3c0664`

**3. [Rule 3 - Blocking] The baseline could not be measured by either method the plan named**

- **Found during:** Task 3(e)
- **Issue:** The plan required the pre-existing failure baseline to be established "by stashing this phase's changes or checking out the pre-phase commit". `git stash` is forbidden in this project (its stash list is shared across worktrees), and checking out the pre-phase commit would have moved `HEAD` over three commits of finished work.
- **Fix:** Took the baseline in a **detached worktree** at `a352500` (the commit before this phase's first) with a symlinked `node_modules`. That run reported **7 failures** — and all seven are host-path, workspace-translation and build-staging tests (`resolveStagingParent()`, `.build-tmp-*`, `containerpath.ts`'s host-root derivation, lexical `..` translation, the containerize safety net, the incident-record check). They fail because the harness ran them from `/tmp/…` against a *symlinked* `node_modules` — precisely the inputs those tests assert about. Every one passes in the real checkout.
- **Verification:** the post-phase in-place run is **0 fail** across 2547 tests, which covers all seven. A suite at 0 fail cannot be hiding an inherited failure.
- **Conclusion recorded:** there is no pre-existing-failure baseline to net out; the confounded 7 is recorded in `19-VALIDATION.md` and in `.planning/WINDOWS.md` with its confound named, rather than dropped or reported as inherited failures this phase did not cause.
- **Committed in:** `32b50b5`

---

**Total deviations:** 3 auto-fixed (2 missing critical, 1 blocking)
**Impact on plan:** No scope creep. Deviations 1 and 2 both close the same class of defect the plan itself is about — a control that exists but is never exercised. Deviation 3 is a methodology substitution forced by a project prohibition, with the substitute's own limitation recorded rather than hidden.

## Issues Encountered

- **Three test expectations were wrong on first write** (the stemmer turning `cross` → `cros`, `please` surviving unstemmed, and two synthetic capability sentences sharing enough tokens to collide at 0.5). All three were *my expectations*, not the predicate — fixed in the test, with the one-token control rewritten to use capability sentences that share nothing so the clause under test is the only thing that could make the pair collide.
- **The pre-phase baseline worktree was confounded** — see deviation 3. Resolved by recognising the confound rather than reporting seven failures this phase did not cause.
- **Ledger entry 3 (an unreproduced single-test flake recorded after 19-01) did not recur.** Three separate full-suite runs during this plan all reported 0 fail.

## Known Stubs

None. No hardcoded empty values, no placeholder text, no unwired components. Every measure the gate reports is computed from the live corpus.

## Threat Flags

None. The plan's threat register (T-19-26 … T-19-31, T-19-SC) is fully mitigated as written: the allowlist is asserted live in both directions (T-19-26); the predicate module is imported by both the runner and the test with a positive control, a false-positive control, a pairs-compared relation and a live-execution control (T-19-27); every predicate takes a string and the module's source is asserted free of the four call shapes and absent from the shipped `files[]` (T-19-28); the gate is the full suite with the baseline measured and its confound recorded (T-19-29); the scanned count is a floor and the pair count a derived relation, both asserted at source level (T-19-30); every decision carries a mechanically counted reversal condition and every validation row a command string (T-19-31); no package-manager install occurred (T-19-SC). No new network endpoint, auth path, file-access pattern or schema at a trust boundary was introduced.

The canon-referral breadcrumb on catastrophic backtracking is **stronger than recorded**: the normalisation uses `String.endsWith` for stemming and character-class-only replaces for filtering, so there is no backtrackable pattern in the module at all, not merely a non-super-linear one.

## User Setup Required

None — no external service configuration required. The `unp64` oracle remains uninstalled by design (19-DECISIONS.md decision 3), and its absence is a *visible skip*, not a failure.

## Next Phase Readiness

**Phase 19 is complete: 5/5 plans, all seven requirements Complete, the full gate green.**

Phase 20 opens knowing three things it would otherwise discover late:

1. **Two tools to implement first** — `anno_toggle_splitter` (DECOMP-01, BUILD-02) and `anno_set_immediate_format` (BUILD-03), both mutating, both through the existing session seam, both with a stated withdrawal condition. Recorded in ROADMAP Phase 20's Notes.
2. **The coverage report's `flat-three` schema was auto-selected under `yolo` mode and never reviewed by a human.** It is pinned so a silent rename fails, but the *shape* is unreviewed and hardens the moment Phase 20 reads it. Phase 20's first use is the moment to confirm or revise.
3. **The MIT licence election is a live human-judgment item**, carried forward from 19-01 and 19-02 rather than closed silently — a legal claim published in two npm tarballs that no test can settle.

Open ledger entries at close: 5 (`.planning/WINDOWS.md`), one of them added by this plan. None blocks Phase 20; all are visible to `/gsd-ship`.

## Self-Check: PASSED

All five created files verified present on disk with `[ -f ]`. All three task commits verified in `git log --oneline --all`. All plan-level `<verification>` commands re-run at close: four check scripts exit 0 with their own OK lines; `tsc --noEmit` exit 0; the FULL `npm test` 2547/2502/0 fail; the skills suite 114/105/0 fail; smoke exit 0; the live coverage run exit 0 against the previously-unseen Phase 11 fixture. Every artifact exceeds its `min_lines` floor (545/120, 214/60, 394/100, 348/60). `git show --stat` for the Task 3 commit names **both** `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md`, satisfying EC-19-05-ISOLATION's loud-failure criterion.

---
*Phase: 19-absorbed-procedures-and-the-coverage-instrument*
*Completed: 2026-08-24*
