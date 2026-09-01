---
phase: 19-absorbed-procedures-and-the-coverage-instrument
plan: 09
subsystem: coverage-instrument
tags: [fixtures, census, false-positive-control, validation-record, release-hold]
status: complete

requires:
  - "19-08: the dispatch-context gate, provenDispatchTargets() seam and dispatch.splitTableCandidates advisory class"
  - "19-07: the discharged MIT inclusion condition and the recorded release-hold decision"
provides:
  - "fixtures/coverage/fp1-indexed-copy-loop + fp1b-immediate-copy-loop: the census false-positive control PAIR, generated"
  - "make-coverage-fixtures.mjs per-fixture `program` support plus four enforced pair invariants"
  - "anno-coverage.test.ts: a REPORT-level non-inflation control and an FP1b earns-its-place test"
  - "19-VALIDATION.md extended with the gap-closure run's executed evidence and nine flagged assumptions"
affects:
  - "Phase 19 re-verification: gap 2 missing items 3 and 5 are now answerable from committed artifacts"

tech-stack:
  added: []
  patterns:
    - "A control fixture's defining relationship is enforced by the generator that writes it, not asserted in a comment about it"
    - "A numeric bound an assertion checks is DECLARED BY THE FIXTURE (store.code_size), never typed into the test"
    - "A false-positive control must be observed RED against the pre-fix instrument before it is allowed to count as evidence"
    - "Observe-RED without git stash: a `git archive <precommit>^` shadow tree in the scratchpad plus a recorded null-hypothesis shim"

key-files:
  created:
    - src/mcp/vice/fixtures/coverage/fp1-indexed-copy-loop/project.regen2000proj
    - src/mcp/vice/fixtures/coverage/fp1-indexed-copy-loop/store.json
    - src/mcp/vice/fixtures/coverage/fp1b-immediate-copy-loop/project.regen2000proj
    - src/mcp/vice/fixtures/coverage/fp1b-immediate-copy-loop/store.json
  modified:
    - src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs
    - src/mcp/vice/fixtures/coverage/README.md
    - src/mcp/vice/anno-coverage.test.ts
    - .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-VALIDATION.md

key-decisions:
  - "The two false-positive payloads write their 57 data bytes out IN FULL in their own literal rather than sharing a constant. A shared constant would make the identical-tail invariant true by construction and therefore worthless; written twice, the invariant is a real check that a real edit can break — and both plants were demonstrated."
  - "`code_size` is emitted only by the false-positive pair, not by all eight fixtures. The five nc* controls are not asserted about numerically, and a field they do not use would be a number with no stated purpose. The count test enforces the converse: a store declaring `code_size` must declare a non-empty `purpose`."
  - "ABS-02's `Complete` status in REQUIREMENTS.md was REPORTED, not repaired. 19-09 is read-only over that file by its own must_haves and by threat T-19G-09-03; editing it would be this plan writing a status claim into the document the gap closure exists to keep honest."
  - "`requirements.mark-complete` was NOT run for COV-01/COV-02. 19-08 had to revert the same automatic step; 19-09 skipped it deliberately."
  - "`nyquist_compliant` was re-examined rather than left standing by default, and the two new evidence rows that are a green run only are named in the file."
  - "`git stash` was NOT used at any point. The observe-RED demonstration used a `git archive 1706d8b^` shadow tree in the scratchpad, following 19-06/07/08's precedent; it was deleted afterwards (/tmp is a RAM-backed tmpfs here)."

requirements-completed: []

metrics:
  duration: "~55 min"
  completed: 2026-08-25
  tasks: 3
  commits: 3
  files: 8

actuals:
  tokens: 11815
  tasks: 3
  commits: 3

coverage:
  - deliverable: "A committed, generated false-positive control PAIR for the structural census"
    human_judgment: false
    verification:
      - kind: test
        ref: "src/mcp/vice/anno-coverage.test.ts#a false-positive control fixture is committed for the census, and the census declines to inflate on it"
        status: pass
      - kind: command
        ref: "cd src/mcp/vice && node --test anno-coverage.test.ts"
        status: pass
  - deliverable: "The pair is GENERATED, deterministically, and its only-difference-is-addressing-mode relationship is enforced by the generator"
    human_judgment: false
    verification:
      - kind: command
        ref: "cd src/mcp/vice && node fixtures/coverage/make-coverage-fixtures.mjs && node fixtures/coverage/make-coverage-fixtures.mjs && test -z \"$(git status --porcelain fixtures/coverage)\""
        status: pass
      - kind: command
        ref: "two planted invariant violations observed throwing, then restored (messages recorded below)"
        status: pass
  - deliverable: "The census does not inflate: equal reachedAsInstruction across the twins, neither exceeding the declared code size"
    human_judgment: false
    verification:
      - kind: test
        ref: "src/mcp/vice/anno-coverage.test.ts#a false-positive control fixture is committed for the census, and the census declines to inflate on it"
        status: pass
      - kind: command
        ref: "observed RED first against a pre-19-08 shadow tree: 55 !== 7"
        status: pass
  - deliverable: "The fixture count is pinned consistently in the test, the README count, the README table and the generator invariant"
    human_judgment: false
    verification:
      - kind: test
        ref: "src/mcp/vice/anno-coverage.test.ts#the committed control set is exactly the pinned size, and every fixture carries a project file and a store file"
        status: pass
  - deliverable: "19-VALIDATION.md extended with executed gap-closure evidence and the nine flagged assumptions, no original row deleted"
    human_judgment: false
    verification:
      - kind: command
        ref: "git diff -- 19-VALIDATION.md | grep -c '^-|' returns 0; all 52 original non-separator table lines present byte-for-byte"
        status: pass
  - deliverable: "REQUIREMENTS.md verified to still record COV-02 incomplete, without being edited"
    human_judgment: false
    verification:
      - kind: command
        ref: "grep -c '^- \\[ \\] \\*\\*COV-02\\*\\*' .planning/REQUIREMENTS.md returns 1; git status --porcelain on that path is empty"
        status: pass
  - deliverable: "The release hold's named lifting condition and owner are recorded rather than left as an open-ended default"
    human_judgment: true
    rationale: "Whether the recorded condition is the RIGHT condition to publish on is the human decision already taken at 19-07's checkpoint. This plan's job is to restate it verbatim so it cannot decay into a permanent unnamed hold; no test can decide that it was the right call."
---

# Phase 19 Plan 09: The False-Positive Census Control and the Validation Record Summary

**The census now has a committed false-positive control that was proven red before the gate landed: two 64-byte programs differing only in a seven-byte prologue, generated together under four enforced invariants, reporting `reachedAsInstruction` 55 and 7 against the pre-19-08 instrument and 7 and 7 now — with the phase's validation record extended rather than rewritten, and `REQUIREMENTS.md` verified honest without being touched.**

Duration ~55 min · 3 tasks · 3 commits · 8 files.

## Accomplishments

1. **The false-positive control pair is committed and GENERATED.** `fp1-indexed-copy-loop` and
   `fp1b-immediate-copy-loop` bring the committed control set to eight. Both are written by
   `make-coverage-fixtures.mjs` through the repository's own `synthesizeProject()`, and running the
   generator twice leaves `git status --porcelain src/mcp/vice/fixtures/coverage` empty.

2. **"Differs only in addressing mode" is now a checked property, not a sentence.** The generator
   throws on four invariants, ordered so the message names the invariant an edit actually broke:
   equal payload length, 64 bytes each, each prologue exactly `FP_CODE_SIZE`, and byte-identical
   from offset `FP_CODE_SIZE` onward. Both plantable invariants were planted and observed throwing.

3. **The report-level non-inflation control exists and was seen red.** It reads both committed
   fixtures through `buildCoverageReport()` and asserts equal `structural.reachedAsInstruction`,
   neither exceeding the `code_size` its own store declares, exactly one advisory
   `dispatch.splitTableCandidates` entry for the indexed fixture and none for its twin, and
   `provenDispatchTargets()` returning `[]` for both.

4. **Every count and sameness claim in the README and generator header is true of this commit.**
   The word "six" no longer appears in the README (`grep -ci six` → 0), the project-file
   "identical across all six" claim is scoped to the five `nc*` fixtures, and a new section
   describes the pair's own two programs.

5. **`19-VALIDATION.md` was extended, not replaced** — ten new executed-evidence rows, the nine
   flagged assumptions, a re-examined Nyquist flag, and an open known-gap row for ABS-02.

## The release hold — restated VERBATIM from 19-07's SUMMARY

This is the act this plan owns. Both strings below are copied from
`19-07-SUMMARY.md` § *The human decision (Task 2), recorded verbatim*.

**Selected option id, at 19-07's Task 2 checkpoint:**

```
approve-wording-release-on-reverification
```

**The named condition that lifts the release hold:**

```
Phase 19 re-verification returns no gaps.
```

The option, as presented and chosen, verbatim from 19-07's SUMMARY:

> **Approve the wording; the release is a separate act taken once Phase 19 re-verification passes.**
> The wording question is settled now, while it is cheap, and the publish is conditioned on the one
> artifact that would justify it — a re-verification that finds the gaps closed. `[skip release]`
> stays on every commit; 19-09 records "Phase 19 re-verification returns no gaps" as the named
> condition that lifts the hold, so it is a condition a later reader can check rather than a promise.

**No gap-closure commit published anything.** All **12** commits from 19-06 through 19-09 carry
`[skip release]` in their subject — verified with
`git log --oneline 5c68473..HEAD --format='%h %s' | grep -c '\[skip release\]'` → **12**, over
12 commits total. Lifting the hold is a **separate, later act**, conditioned on a re-verification
that has not run. It is not lifted here, and this plan authored no release-bearing commit.

## Which 19-08 identifiers this plan actually asserted against

19-08's Task 1 checkpoint selected option **`narrow-and-add-sibling`** (not
`gate-only-no-shape-change`), so an advisory field does exist and the absent-from-every-target-list
fallback was **not** needed. Read by role, the identifiers used are:

| Role | Identifier as 19-08 implemented it | How this plan reads it |
|---|---|---|
| The advisory split-table field | `dispatch.splitTableCandidates` (`anno-coverage.ts:584`) | `indexed.dispatch.splitTableCandidates.length === 1`, `orientationResolved === false`, `targets === []`; twin `=== 0` |
| The proven-target seam | `provenDispatchTargets(scan)` (`anno-coverage.ts:954`) | `provenDispatchTargets(report.dispatch)` deep-equals `[]` for both fixtures |
| The narrowed raw list | `dispatch.discoveredTargets` | not read by the new assertions — reading it would defeat the seam it exists to be |

The schema is `COVERAGE_SCHEMA_VERSION` 2 with the nine-entry `COVERAGE_REPORT_KEYS` unchanged;
this plan changed no schema and added no report field.

## The two planted generator-invariant violations, as observed

Both plants were made in the real generator, run, and restored from a scratchpad backup. The
invariants sit at module top level, **before** the `for (const fixture of FIXTURES) writeFixture(...)`
loop, so no fixture file was written during either plant.

**Plant 1 — one byte deleted from `IMMEDIATE_COPY_LOOP`** (the trailing `0x20` at `$084F`):

```
Error: the false-positive pair must be EQUAL IN LENGTH -- INDEXED_COPY_LOOP is 64 bytes and
IMMEDIATE_COPY_LOOP is 63; comparing their censuses is meaningless unless they differ ONLY in
the code prologue
```

**Plant 2 — one DATA byte changed in only one payload** (`$0817`: `0x10` → `0x11`, in the
immediate literal only):

```
Error: the false-positive pair must be BYTE-IDENTICAL from offset 7 onward -- they differ at
offset 7 ($817): indexed has $10, immediate has $11. "Differing ONLY in addressing mode" is a
CHECKED property of these fixtures, not a claim in a comment
```

After restoring, the generator ran clean and the tree matched the committed fixtures byte for byte.

## The report-level control, observed RED before the gate landed

A control whose data merely happens not to trigger the heuristic proves nothing — this plan's own
prohibition. So the committed pair was run through the **pre-19-08 instrument**.

**Mechanism (no `git stash` — the stash ref is shared across worktrees here), following
19-06/07/08's precedent:**

```
git archive 1706d8b^ src/mcp/vice .planning/phases/19-.../evidence | tar -x -C <scratch>/shadow
cp src/mcp/vice/anno-coverage.test.ts <scratch>/shadow/src/mcp/vice/          # the NEW tests
cp -r fixtures/coverage/fp1-* <scratch>/shadow/src/mcp/vice/fixtures/coverage/ # the NEW fixtures
# + a recorded NULL-HYPOTHESIS SHIM appended to the shadow's PRE-fix anno-coverage.ts:
#     export function provenDispatchTargets(scan: IndirectDispatchScan): number[] {
#       return scan.discoveredTargets;
#     }
cd <scratch>/shadow/src/mcp/vice && node --test --test-name-pattern '<the two new tests>' anno-coverage.test.ts
```

`1706d8b` is 19-08's gate commit, so `1706d8b^` is the last instrument state before the gate. The
shim expresses the pre-fix behaviour through the post-fix API (pre-fix there is no advisory class
and every reconstructed pairing seeded the descent directly), which isolates the change under test
instead of degenerating into an import error. The shadow tree was deleted afterwards.

**Observed: `# tests 2 / # pass 1 / # fail 1`.**

**RED — `a false-positive control fixture is committed for the census, and the census declines to
inflate on it`:**

```
error: two committed programs with identical code content, differing ONLY in addressing mode,
must report the same structural.reachedAsInstruction. Pre-gate the indexed fixture reached 55 of
its 64 bytes against 7 bytes of real code, while the immediate twin reached 7 …

55 !== 7

expected: 7
actual: 55
operator: 'strictEqual'
```

**The full pre-fix vs post-fix report, measured on the COMMITTED fixtures:**

| Fixture | | `reachedAsInstruction` | `referencedAsData` | `unreached` | `splitTables` | `discoveredTargets` | `tableEntryAddresses` |
|---|---|---|---|---|---|---|---|
| `fp1-indexed-copy-loop` | **pre-19-08** | **55** | 0 | 9 | **1** | **8** | **34** |
| `fp1-indexed-copy-loop` | **post-fix** | **7** | 2 | 55 | 0 | 0 | 0 |
| `fp1b-immediate-copy-loop` | pre-19-08 | 7 | 0 | 57 | 0 | 0 | 0 |
| `fp1b-immediate-copy-loop` | post-fix | 7 | 0 | 57 | 0 | 0 | 0 |

Both fixtures declare `code_size: 7`. Pre-gate the indexed fixture reached **55 of 64 bytes against
7 bytes of real code** — an 8× inflation manufactured out of 57 bytes of ordinary data — and it did
so through the same `buildCoverageReport()` path a real user's report goes through. The two
`referencedAsData` bytes post-fix are the two operand bases, correctly classified as data.

**Stated explicitly, as this run's discipline requires:** the second new test,
`FP1b earns its place: without a committed twin, FP1's census could only be compared against a
remembered number`, **PASSED pre-fix and was not observed red**. It is a structural assertion about
the committed payloads (same origin, size, `code_size`; differing prologues; identical 57-byte
tails; a non-zero live baseline), not an assertion about the gate, so there is nothing about it a
pre-gate instrument would fail. No claim is made that it was red.

## The fixture count, pinned in four places

| Where | Value |
|---|---|
| `anno-coverage.test.ts` — `COMMITTED_CONTROL_FIXTURES`, read by the renamed count test | **8** |
| `README.md` opening sentence | **"Eight** committed synthetic fixtures, in two groups" |
| `README.md` per-fixture table | **8** rows (six `nc*`, two `fp*`) |
| `make-coverage-fixtures.mjs` header — the shared-program invariant | "the **eight** fixtures are two groups"; the shared-program claim now scoped to "the five findings controls (NC1..NC5)" |

The count test was **renamed** so its name carries no stale number
(`six control fixtures are committed…` → `the committed control set is exactly the pinned size, and
every fixture carries a project file and a store file`). `grep -ci six` over the README returns
**0**. The README no longer claims every fixture carries the same program: the
`## Shape of each fixture` row now reads "Identical across the **five** `nc*` fixtures", and
`## The one shared program` is retitled `## The program shared by the five nc* fixtures`.

## REQUIREMENTS.md — verified, not edited, and one drift reported

Observed 2026-08-25, with `git status --porcelain .planning/REQUIREMENTS.md` **empty** at the end
of the run (this plan made no edit, and did not run `requirements.mark-complete`):

| Observation | Line | State |
|---|---|---|
| COV-02 checkbox | **59** | `- [ ] **COV-02**: A vacuous pass is detectable…` — **still unchecked**. `grep -c` → 1 |
| COV-02 status row | **135** | `\| COV-02 \| Phase 19 \| Gaps Found \|` |
| COV-01 status row | **134** | `\| COV-01 \| Phase 19 \| Gaps Found \|` |
| SURF-03 / ABS-01 / ABS-03 / ABS-04 | 129, 130, 132, 133 | all `Gaps Found` |
| **ABS-02 status row** | **131** | **`Complete`** — see below |

**The plan's second Task 3 verify command did not print `SEVEN-ROWS-STILL-GAPS-FOUND`: six of
seven rows read `Gaps Found`, not seven.** This is recorded as deviation 1 below. The must_haves
truth this plan is accountable for — *`REQUIREMENTS.md` still records COV-02 as NOT complete and
its status table row as `Gaps Found` at the end of this gap-closure run* — **holds**.

## Deviations from Plan

### 1. [Rule 1 — Finding, reported not repaired] ABS-02 is marked `Complete` by the run that fixed it

- **Found during:** Task 3, at the read-only verification of `REQUIREMENTS.md`.
- **Issue:** The plan's premise — "all seven Phase 19 rows read `Gaps Found`" — was true when the
  plan was authored and is no longer true. `354bbfa` (19-07's metadata commit, `docs(19-07):
  complete discharge-MIT-inclusion-condition plan`) flipped ABS-02's checkbox from `[ ]` to `[x]`
  and its status row from `Gaps Found` to `Complete`, via the execute-plan workflow's automatic
  `requirements.mark-complete` step reading 19-07's `requirements: [ABS-02]` frontmatter. This is
  exactly the defect class this plan's Task 3 exists to prevent — a requirement marked complete by
  the run that fixed it — and exactly what `d6d3fe3` ("revert premature Complete requirements")
  had already undone once for the other six IDs, and what 19-08 caught and reverted for
  COV-01/COV-02.
- **Fix:** **None applied — deliberately.** Task 3 is read-only over `REQUIREMENTS.md` by this
  plan's own acceptance criterion (`git status --porcelain .planning/REQUIREMENTS.md` must be
  empty) and by threat mitigation T-19G-09-03. Editing it here would be this plan writing a status
  claim into the document the gap closure exists to keep honest — the original defect in miniature,
  in the opposite direction. The drift is instead **reported**: a dedicated open row in
  `19-VALIDATION.md`'s known-gaps table, plus a `## Requirement status after this run` subsection
  recording six-of-seven with the exception named, plus this deviation.
- **Why the run did not halt on it:** the plan's "STOP and report" clause guards the state this
  plan is accountable for (COV-02), which holds. ABS-02 was drifted by a *completed sibling plan*,
  is outside this plan's `files_modified`, and is a row re-verification re-decides anyway — halting
  the phase's last plan would have left an illegal partial-plan state over a bookkeeping row while
  the report itself is the remedy.
- **What re-verification must do:** treat ABS-02's `Complete` as **unearned** and re-decide it on
  the evidence, alongside the six `Gaps Found` rows.
- **Commit:** `d8fd079`.

### 2. [Rule 2 — Missing critical] `requirements.mark-complete` deliberately NOT run

- **Found during:** the state-update step.
- **Issue:** This plan's frontmatter declares `requirements: [COV-02, COV-01]`. The workflow's
  `update_requirements` step would run `requirements.mark-complete COV-02 COV-01`, flipping both to
  `Complete` — the very act deviation 1 documents as a defect, and a direct violation of must_haves
  truth 4.
- **Fix:** the step was **skipped**, and `requirements-completed: []` is recorded in this SUMMARY's
  frontmatter rather than copying the plan's `requirements` array. `REQUIREMENTS.md` is byte-clean.
- **Commit:** n/a (an omission, verified by `git status --porcelain .planning/REQUIREMENTS.md`).

### 3. [Rule 1 — Bug] `state.add-blocker` stripped placeholder-looking words from two unrelated STATE.md lines

- **Found during:** the state-update step, by reading `git diff -- .planning/STATE.md` before
  committing rather than trusting the handler's success JSON.
- **Issue:** `gsd-tools query state.add-blocker` runs a placeholder-removal pass over STATE.md that
  is not scoped to the section it is writing. It silently deleted the standalone words `NONE` and
  `none` from two long-standing prose lines elsewhere in the file:
  - `broker used to launch stock \`x64sc\` with \`Drive8Type=0\` (NONE) by default.` → `(…)` —
    the parenthetical that names the drive-type value became empty.
  - ``the snapshot's raw `machine_name` (`"C64SC"`) matches none of `file_io.rs`'s four literal
    match arms`` → `matches of` — an ungrammatical sentence that **inverts the finding's meaning**
    (it now reads as though the name *does* match).
- **Fix:** both lines restored verbatim, and the diff re-read to confirm neither appears in it any
  more. Out of scope to fix the handler itself — logged here so a future run reads its own STATE.md
  diff instead of trusting the success JSON, which reported `{ "blocker": … }` with no hint of
  collateral damage.
- **Files modified:** `.planning/STATE.md` (repair only).
- **Verification:** `git diff -- .planning/STATE.md` contains no `-` line for either sentence.
- **Commit:** the final metadata commit below.

### 4. [Rule 1 — Bug] `state.advance-plan` / `roadmap.update-plan-progress` left stale position prose

- **Found during:** the same diff read.
- **Issue:** the counters advanced correctly (8/9 → 9/9, `completed_plans` 15 → 16) but the prose
  beside them still read `Plan: 9 of 9 complete (19-09 remaining)`, `Status: Wave 2 in progress —
  19-08 complete, 19-09 next`, and in ROADMAP.md `3/4 gap-closure plans (… 19-09 remaining)` —
  self-contradictory against the number on the same line.
- **Fix:** the three STATE.md lines and the one ROADMAP.md line were corrected to the real state,
  including naming Phase 19 re-verification as the next step and as the condition that lifts the
  release hold. The generated ROADMAP checkbox and status-table row were already correct.
- **Files modified:** `.planning/STATE.md`, `.planning/ROADMAP.md`.
- **Commit:** the final metadata commit below.

**Total deviations:** 4 — 1 finding reported without repair, 1 deliberate omission, 2 auto-fixed
tooling bugs.
**Impact:** deviations 1 and 2 concern requirement bookkeeping and are surfaced to re-verification
rather than silently absorbed. Deviations 3 and 4 are planning-artifact repairs; deviation 3 in
particular had inverted the meaning of a recorded Phase 10 finding and would have shipped as a
silent documentation corruption. **No code, fixture or test behaviour was changed by any of the
four.**

## The nine flagged assumptions this run does NOT reopen

All nine are carried into `19-VALIDATION.md`'s flagged-assumption table with their standing
evidence, and none is silently "resolved". Accounting: 8 authored into `must_haves.truths` across
19-06/07/08, plus these 9, == 17 applicable rows.

| # | Requirement | Category | Status | Standing evidence (named, not re-run here) |
|---|---|---|---|---|
| 1 | ABS-01 | `unclassified` | `unresolved` | `19-VERIFICATION.md` truth 1 (✓): five upstream sha256 digests **and** byte counts re-confirmed over the network at the pin; four manifest line-number citations spot-checked exact; `check-skill-tool-coverage.mjs` exit 0 over 17 curated names; `grep -rn '.agent/skills' src/skills/` → 0 hits |
| 2 | ABS-03 | `adjacency` | `unresolved` | Threshold is **inclusive** at 0.35 with a boundary test; `19-VERIFICATION.md` truth 3 (✓), 21/21 pairs, observed max 0.250, allowlist size 0 |
| 3 | ABS-03 | `empty` | `unresolved` | `skill-description-overlap.test.ts` already carries an emptied-corpus and stale-allowlist control (32/32 pass) |
| 4 | ABS-03 | `ordering` | `unresolved` | A stable-ordering test for equal-scoring pairs already exists in the same file |
| 5 | ABS-04 | `unclassified` | `unresolved` | The reversal-condition count is **structural** and cannot tell a checkable condition from a well-formed but unfalsifiable one. Left unresolved deliberately, no backstop marker. `19-VERIFICATION.md` truth 5 (✓): five dated decisions, each with a named reversal or re-sync condition |
| 6 | COV-01 | `encoding` | `unresolved` | Byte counts over `[origin, origin + size)`; exact string equality after a four-step pinned normalisation; ASCII case-sensitive prefix matching. `19-VERIFICATION.md` truth 4 A/B (✓). 19-08's 16-bit bound narrows the range, not the meaning of equality |
| 7 | COV-01 | `concurrency` | `unresolved` | A coverage run is read-only **by construction**, asserted at source level (no `writeFileSync` / `renameSync` / `appendFileSync` / `save_project` / live-session import). `anno-coverage.test.ts` section 11 (✓) |
| 8 | SURF-03 | `unclassified` | `unresolved` | `19-VERIFICATION.md` truth 5 (✓): `PACKER_VERDICTS` frozen to four; `identifiedByOracle()` the only site assigning `packer`, throwing on non-string/empty; both `spawnSync` sites `shell: false`; wired at `c64-program-recon/SKILL.md:88-89`. WR-08/WR-09 are open against that file and **DEFERRED** in 19-08 — they do not reopen SURF-03 |
| 9 | SURF-03 | `empty` | `unresolved` | The hard-unknown property is the requirement's own core: `unknownFinding()` throws on an empty reason, `identifiedByOracle()` on an empty name. `packer-finding.test.mjs` 17 tests, 16 pass, 1 visible skip (live oracle gate) |

## 19-VALIDATION.md — extended, proven not rewritten

- **All 52 original non-separator table lines are present byte-for-byte** in the new file
  (checked line-by-line against `git show HEAD:…19-VALIDATION.md`: 52 found, 0 missing).
- `git diff -- 19-VALIDATION.md | grep -c '^-|'` → **0**. No table row was deleted.
- The **only** deletion anywhere in the diff is the single frontmatter line `closed_by: 19-05`,
  replaced by `closed_by: 19-09` plus a new `extended: 2026-08-25`, which is the minimal honest
  frontmatter change the plan authorises.
- Added: the ten-row `## Gap-closure run → executed evidence` section, the
  `### Requirement status after this run` subsection, the ABS-02 known-gap row, the nine-row
  flagged-assumption table, and a `### Re-examined after the gap-closure run` subsection under
  `## Nyquist compliance`.
- **Nyquist re-examined, not left standing:** eight of the ten new rows carry both an executed
  command and a demonstrated failure. Two are a green run only and are named as such — COV-01 /
  19-08's live CLI run (no CLI plant; WR-05/06/07/10 record the CLI surface as untested and
  DEFERRED), and COV-02 / 19-09's determinism check (idempotence has no meaningful plant; the two
  generator invariants that *can* be planted were). `nyquist_compliant` stays `true` because both
  exceptions are individual rows, not requirements.

## Verification results

| # | Command | Result |
|---|---------|--------|
| 1 | `ls -d src/mcp/vice/fixtures/coverage/*/ \| wc -l` | **8** |
| 2 | generator run **twice**, then `git status --porcelain fixtures/coverage` | `wrote 8 control fixtures` both runs; porcelain **empty** — `DETERMINISTIC` |
| 3 | `cd src/mcp/vice && node --test anno-coverage.test.ts` | exit **0** — `# tests 55`, `# pass 55`, **`# fail 0`** |
| 4 | `cd src/mcp/vice && npm test` (the **FULL** suite, never `test:automated`) | exit **0** — `# tests 2564`, `# pass 2519`, **`# fail 0`**, 40 skipped, 5 todo |
| 5 | `cd src/mcp/vice && npx tsc --noEmit -p tsconfig.json` | exit **0** |
| 6a | `node scripts/check-npm-packages.mjs` | exit **0** — vice-mcp 75 files, c64-re-tools 34 files / 7 skills; nothing under `fixtures/` packed in either tarball |
| 6b | `node scripts/check-skill-tool-coverage.mjs` | exit **0** |
| 6c | `node scripts/check-skill-description-overlap.mjs` | exit **0** |
| 7 | `grep -c '^- \[ \] \*\*COV-02\*\*' .planning/REQUIREMENTS.md` | **1**; `git status --porcelain` on that path **empty** |
| 8 | `git diff -- 19-VALIDATION.md \| grep -c '^-\|'` | **0** — additions only inside the evidence tables |
| 9 | The two generator plants + the report-level RED run | recorded above with observed messages and values |
| 10 | `git log --oneline 5c68473..HEAD \| grep -c '\[skip release\]'` | **12** of 12 gap-closure commits |
| 11 | `git diff --diff-filter=D --name-only HEAD~3 HEAD` | **empty** — no file deleted by this plan |
| 12 | `grep -l '"expect_clean": true' fixtures/coverage/*/store.json` | only `nc5-well-documented` — still the sole clean control |

**Inherited-suite note, reported honestly.** The orchestrator measured the full suite green at the
wave-2 boundary: `# tests 2560, # pass 2515, # fail 0`. It is green here at
`# tests 2564, # pass 2519, # fail 0` — exactly **+4 tests / +4 pass**, which is precisely this
plan's delta (two new named tests plus two new entries in the data-driven control loop, one per new
fixture directory). **Nothing is attributed to pre-existing breakage, because there is none.**

## Test-count accounting

| Point | `anno-coverage.test.ts` | Delta |
|---|---|---|
| Inherited from 19-08 | 51 | — |
| After Task 2 | **55** | **+4** = 2 authored tests + 2 auto-generated control-loop entries (`control FP1 (fp1-indexed-copy-loop): produces a non-clean result`, `control FP1b (…)`) |

The two new fixtures declare `expect_clean: false` and `expect_measure: null`. Both legitimately
come back non-clean (they carry no symbols and no comments, so `labels`, `commentVacuity`,
`reproducibility` and `divergence` all report), and pinning a measure would assert something the
fixtures are not for — the census property is what they are a control for, and that is asserted by
the named report-level test.

## Known Stubs

None. No hardcoded empty value, placeholder string, TODO or FIXME was introduced. The two new
fixture stores carry deliberately empty `symbols` / `comments` / `blocks` / `cross_references`
arrays — that emptiness is the fixture's design (anything else would be a second variable in a
two-variable comparison) and is documented in each store's own `purpose` field and in the README.

## Threat Flags

None. This plan added no network endpoint, no auth path, no file-access pattern and no schema
change. The two new fixture payloads are synthetic 64-byte byte arrays, refused by
`assertLeanTarball()` in both tarballs (confirmed exit 0 after the two directories were added).
No dependency was added; `package-lock.json` was not touched.

## Issues Encountered

**1 — ABS-02 reads `Complete` in `REQUIREMENTS.md`** (deviation 1), set by 19-07's own metadata
commit. Reported, not repaired, for the reasons given. Phase 19 re-verification must re-decide it.

**2 — `gsd-tools query state.add-blocker` damages unrelated STATE.md prose** (deviation 3). Its
placeholder-removal pass is not scoped to the section it writes and deleted the standalone words
`NONE` and `none` from two long-standing sentences, one of which it thereby **inverted the meaning
of**. Repaired here. Any future run must read its own `git diff -- .planning/STATE.md` rather than
trusting the handler's success JSON, which reports nothing about the collateral edit.

## Next Phase Readiness

This is the last plan of Phase 19's gap-closure run. Both `19-VERIFICATION.md` gap 2 `missing`
items this plan owned are now answerable from committed artifacts: item 3 by the generated
false-positive control pair and its report-level test, item 5 by the verified-and-recorded
`REQUIREMENTS.md` state.

**The next step is Phase 19 re-verification** — which is both the thing entitled to re-check the
requirement boxes and, by 19-07's recorded decision, the **named condition that lifts the release
hold**. Until it returns no gaps, `[skip release]` stays on every commit.

## Self-Check: PASSED

Created files, all `[ -f ]` FOUND:

- `src/mcp/vice/fixtures/coverage/fp1-indexed-copy-loop/project.regen2000proj`
- `src/mcp/vice/fixtures/coverage/fp1-indexed-copy-loop/store.json`
- `src/mcp/vice/fixtures/coverage/fp1b-immediate-copy-loop/project.regen2000proj`
- `src/mcp/vice/fixtures/coverage/fp1b-immediate-copy-loop/store.json`

Commits, all FOUND in `git log --oneline --all`:

- `f961901` — `test(19-09): generate the false-positive census control pair [skip release]`
- `b1a2282` — `test(19-09): assert at report level that the census does not inflate [skip release]`
- `d8fd079` — `docs(19-09): extend the phase validation record with gap-closure evidence [skip release]`
