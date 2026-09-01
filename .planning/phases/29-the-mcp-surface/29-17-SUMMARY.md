---
phase: 29-the-mcp-surface
plan: 17
subsystem: planning-record
tags: [requirements, record-of-intent, cut-01, mcp-04, audit-gate, provenance]

requires:
  - phase: 29-the-mcp-surface
    provides: "29-VERIFICATION.md's first measurement of CUT-01, and its two-option human_verification item"
  - phase: 29-the-mcp-surface
    provides: "29-10-SUMMARY.md's honest record that the CUT-01 sizing figure had never been re-measured"
provides:
  - "CUT-01 corrected to the measured figures (26,023 pre-phase / 10,066 net removed / 15,957 surviving) and moved to Complete on the owner's 2026-08-30 decision"
  - "CUT-01's measurement provenance carried inside the requirement entry: both commits, the file-selection predicate at each end, and one counting command for both"
  - "A stated re-derivation status: the pre-phase end reproduces exactly; the surviving-line figure does not, and the divergence is recorded rather than reconciled"
  - "MCP-04's per-phase status-table row corrected DOWN to Gaps Found, ending a live disagreement between two tables in one file"
affects: [phase-32-cut-04, milestone-audit, gap-closure-round-2-verification]

actuals:
  tokens: 3518
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "A requirement's status row, checkbox, sizing sentence and narrative paragraph move as ONE edit — never the row alone"
    - "A measured figure carries its provenance (commits + predicate + counting command) inside the entry, not in a footnote"
    - "A re-measurement that disagrees with the authorising verdict is surfaced as a finding, never applied on the spot"

key-files:
  created:
    - .planning/phases/29-the-mcp-surface/29-17-SUMMARY.md
  modified:
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Implemented the owner's 2026-08-30 decision: correct CUT-01's text to the measured figures and mark it Complete, rather than accept the shortfall and hold it Partial"
  - "Kept the verifier's 15,957 surviving-line figure in the requirement text even though re-derivation yielded 19,714, because the owner decided on those specific numbers — the divergence is recorded as a finding here and named inside the entry itself"
  - "Did NOT reproduce the three falsified figures in the replacement narrative: the plan's own automated verify requires them absent file-wide, and restating them would re-seed falsified numerals into the record"
  - "Skipped the optional .planning/WINDOWS.md ledger append — the plan's verification requires the diff to show exactly one changed file, and the ledger is documented as best-effort and never blocking"

patterns-established:
  - "Provenance-in-entry: a sizing claim states the two commits it was measured at, the file-selection predicate used at each, and the single counting command applied to both, so 'lines' has one definition across the subtraction"
  - "Re-derivation status as a first-class field: an entry says whether its own figures reproduce, so a reader can tell a measured number from a transcribed one"

requirements-completed: [CUT-01]

coverage:
  - id: D1
    description: "CUT-01's checkbox, sizing sentence, traceability row and narrative paragraph all corrected in one commit and all agreeing with each other and with 29-VERIFICATION.md"
    requirement: "CUT-01"
    verification:
      - kind: other
        ref: "grep -c '26,023' && grep -c '10,066' && grep -c '15,957' && grep -c '8f21d77' .planning/REQUIREMENTS.md"
        status: pass
      - kind: other
        ref: "grep -n '12.4k|12.9k|25,759|10,102|15,657|25.7k' .planning/REQUIREMENTS.md (exit 1 — all falsified figures absent)"
        status: pass
      - kind: other
        ref: "node scripts/audit-gate.mjs (exit 0)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/audit-integrity.test.ts + docs-dangling-refs.test.ts + docs-review-disposition.test.ts (59/59 pass)"
        status: pass
      - kind: other
        ref: "git diff f16d0b1 HEAD -- .planning/REQUIREMENTS.md (checkbox, sentence, row and paragraph all changed together; never the row alone)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The surviving-line figure 15,957 as the correct value for CUT-01's sizing claim"
    requirement: "CUT-01"
    verification:
      - kind: other
        ref: "re-derivation at f16d0b1 under the entry's stated predicate — yields 19,714, NOT 15,957"
        status: fail
    human_judgment: true
    rationale: "The figure did not reproduce under any plausible file-selection predicate tried (three were tried; see Re-derivation below). It is retained because the owner decided on these specific numbers on 2026-08-30 and an executor's re-measurement is a finding, not a licence to substitute. Only a human can decide whether to re-open the decision, correct the figure, or re-scope the predicate."
  - id: D3
    description: "MCP-04's per-phase status-table row corrected DOWN to Gaps Found, agreeing with the traceability table and with the verification's BLOCKED verdict"
    requirement: "MCP-04"
    verification:
      - kind: other
        ref: "grep -n 'MCP-04' .planning/REQUIREMENTS.md — both status-bearing rows read Gaps Found"
        status: pass
      - kind: other
        ref: "node scripts/audit-gate.mjs (exit 0)"
        status: pass
    human_judgment: false

duration: 23min
completed: 2026-08-30
status: complete
---

# Phase 29 Plan 17: CUT-01 Record Correction Summary

**CUT-01's three falsified sizing figures replaced by the measured ones with their derivation carried inside the entry, the requirement moved to Complete on the owner's 2026-08-30 decision in the same edit as its sentence, and MCP-04's stale `Complete` corrected down so two tables in one file stop giving different answers.**

## Performance

- **Duration:** ~23 min
- **Started:** 2026-08-30T10:35:00Z (approximate — the executor did not stamp a start time before its first read)
- **Completed:** 2026-08-30T10:58:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Re-derived both ends of the measurement from git history before touching the record, rather than transcribing the verification report.
- Rewrote `CUT-01`'s sizing sentence to the measured figures and moved its checkbox, traceability row and narrative paragraph in the **same commit** — the specific failure mode the verifier named and the audit gate exists against.
- Carried the provenance into the requirement entry itself: both measured commits, the file-selection predicate at each end, and one counting command applied to both, so "lines" has a single definition across the subtraction.
- Recorded a **re-derivation status** inside the entry: the pre-phase end reproduces exactly; the surviving-line figure does not. The verifier's number was kept and the divergence surfaced rather than silently reconciled.
- Corrected `MCP-04`'s row in the six-row per-phase status table from `Complete` down to `Gaps Found`, closing a disagreement `e87650e` left behind when it corrected only the traceability table.

## Task Commits

1. **Task 1: Re-derive the figures, rewrite the sentence and move the row in ONE edit** — `be4e1fe` (docs)
2. **Task 2: Correct MCP-04 down in the per-phase status table** — `95c66f8` (docs)

## Files Created/Modified

- `.planning/REQUIREMENTS.md` — `CUT-01` corrected and completed with provenance; `MCP-04`'s per-phase row corrected down with the reason recorded beneath the table.
- `.planning/phases/29-the-mcp-surface/29-17-SUMMARY.md` — this summary.

## Re-derivation: exact commands and exact output

Every figure below was measured in this worktree, from git blobs, before any edit.

### Pre-phase end, at `8f21d77`

File-selection predicate — `anno-*.ts` under `src/mcp/vice/`, which excludes `anno-regbits.json` because the requirement is a `.ts` claim:

```
$ git ls-tree -r --name-only 8f21d77 -- src/mcp/vice | grep -E '^src/mcp/vice/anno-.*\.ts$' | wc -l
35
```

Total lines:

```
$ git ls-tree -r --name-only 8f21d77 -- src/mcp/vice \
    | grep -E '^src/mcp/vice/anno-.*\.ts$' \
    | while read f; do git show "8f21d77:$f" | wc -l; done \
    | awk '{s+=$1} END {print "total_lines="s}'
total_lines=26023
```

Test / non-test split:

```
$ ... | grep -E '^src/mcp/vice/anno-.*\.test\.ts$' | ... 
test_lines=15988

$ ... | grep -E '^src/mcp/vice/anno-.*\.ts$' | grep -v '\.test\.ts$' | ...
nontest_lines=10035
```

`10,035 + 15,988 = 26,023`. **The pre-phase end re-derives EXACTLY**, in all three figures and in the file count, matching `29-VERIFICATION.md` to the line.

### Surviving end, at `f16d0b1` (the phase HEAD this correction was written against)

Predicate — the `anno-*` name-descendants of the 35-file set, plus the three renamed test files the verification enumerates individually. Same counting command (`git show <commit>:<path> | wc -l`, summed):

```
anno_descendants_files=20  anno_descendants_lines=18728
absorbed-answer-key.test.ts  285
spawn-seam.test.ts           470
docs-absorbed-decisions.test.ts 231
                             ---
three named files:           986

TOTAL = 18,728 + 986 = 19,714
```

Fifteen of the 35 original files have no `ANNO-*` name-twin at HEAD (`anno-launch*`, `anno-mcp-client*`, `anno-project*`, `anno-session*`, `anno-symbol-roundtrip.test.ts`, `anno-test-gate.ts`, `anno-derivation.test.ts`, `anno-verify*`, plus `absorbed-answer-key.test.ts` and `spawn-seam.test.ts` which are two of the three named renames).

## Discrepancy — stated, not reconciled

**The verification's surviving-line figure of 15,957 did not re-derive.** The measurement above yields **19,714**, a difference of **3,757 lines**.

This is not commit drift. The same predicate was run at `d30b63e` — the commit that added `29-VERIFICATION.md` — and yields the identical `18,728` for the `anno-*` descendants, so nothing in `src/mcp/vice/` moved between the verification and this correction.

Three alternative set-definitions were tried and none reproduces 15,957:

| Candidate definition | Measured |
|---|---|
| `anno-*` name-descendants at HEAD + the three named renamed tests (the entry's stated predicate) | **19,714** |
| The ORIGINAL sizes at `8f21d77` of the lineages that survive (i.e. how much of the 26,023 belonged to files that lived on) | **19,839** |
| ALL `anno-*.ts` at HEAD (36 files — includes the Phase-28 store modules, which are not anno descendants) + the three named tests | **37,891** |

A subset-sum search over the 23-file universe of the first definition was also run, looking for a plausible exclusion set worth 3,757 lines. It returned twelve arbitrary combinations (`anno-acme-ident.ts + anno-cli.test.ts + anno-cli.ts + …`) and no natural one — no coherent predicate produces 15,957.

**What was done about it, and why.** Per the plan's own instruction and threat `T-29-17-03`, the verifier's figure was **kept** in the requirement text: the owner decided on those specific numbers on 2026-08-30, and an executor's re-measurement is a finding rather than a licence to substitute. The divergence is recorded here AND named inside `CUT-01`'s own entry, so a later reader meets it in the record rather than only in this summary. Note that `10,066` is the subtraction `26,023 − 15,957` and therefore inherits the same status — the entry says so explicitly.

## Before and after

### `CUT-01`'s sizing sentence

**Before** (line 128, checkbox unchecked):

> - [ ] **CUT-01**: The external analyser integration is deleted — a **net ~12.4k lines** of the 25,759-line `anno-*.ts` surface (10,102 non-test + 15,657 test), the remaining ~12.9k surviving under new names. Both figures correct v0.6.0's `CUT-01`/`CUT-02`, which asserted 19,181; a phase sized at 25.7k deletes the coverage instrument and the enum generator

**After** (checkbox checked, plus two provenance paragraphs folded into the same entry):

> - [x] **CUT-01**: The external analyser integration is deleted — a **net 10,066 lines** of the **26,023-line, 35-file** `anno-*.ts` surface (10,035 non-test + 15,988 test), the remaining **15,957 lines** surviving under new names. These figures supersede v0.6.0's `CUT-01`/`CUT-02`, which asserted 19,181: the surface was 26,023 rather than 19,181, and a phase sized at 26.0k deletes the coverage instrument and the enum generator.
>
>   **Provenance, carried here rather than in a footnote …** — names `8f21d77` and `f16d0b1`, the predicate at each end, and the single counting command applied to both.
>
>   **Re-derivation status, stated rather than implied …** — records that the pre-phase end reproduces exactly, that the surviving end yields 19,714 under the stated predicate and 18,728 at `d30b63e` so the divergence is not commit drift, and that 15,957 is the verifier's as-measured figure kept on the owner's decision.

### `CUT-01`'s narrative paragraph

**Before:**

> **`CUT-01` is `Partial`, not `Complete`, and the reason is its own evidence.** … But this requirement is worded as a **sizing** claim … and no plan has re-measured that figure against the delivered tree. … Marking it `Complete` would claim a measurement nobody took, which is the failure the audit gate exists against. A verification pass that re-measures the two figures is what moves this row.

**After** — two paragraphs replacing the one:

> **`CUT-01` MOVES UP to `Complete` on the OWNER's decision of 2026-08-30, after the measurement that had never been taken was taken — and its sizing sentence was rewritten in the same edit as its row.** … records that the pass happened, that all three figures were falsified in the same direction, the two options the `human_verification` item put to the owner, which one the owner chose, and that the substantive claim was independently confirmed (zero `anno-*.ts` under `src/mcp/vice/`; the removal gate green tree-wide with an **empty** temporary allow-list).
>
> **The paragraph this replaces was correct when it was written, and is superseded rather than wrong.** … says plainly which paragraph is live, records that `29-11-SUMMARY.md`'s wording of the `Partial` record is superseded by the same decision, and names the 15,957 non-re-derivation.

### `MCP-04`'s per-phase status-table row

**Before:**

> \| `MCP-04` \| Complete \| `29-03-SUMMARY.md`, `29-06-SUMMARY.md` (explicit addressing, idempotent edits, the depth-capped batch, refusal by name) \|

**After:**

> \| `MCP-04` \| Gaps Found \| `29-VERIFICATION.md` (Requirements Coverage, `MCP-04` row) is the authority, and it scores this requirement ✗ **BLOCKED**: *"Explicit addressing, idempotence and per-item batch status all hold — but CR-01 delivers exactly the 'plausible-looking zero' this requirement names, and CR-06 makes the batch's documented nesting unusable with a message contradicting the tool's own description."* So the row records a partial truth precisely rather than flattening it: three clauses — explicit addressing, idempotent edits, per-item batch status — DO hold on `29-03-SUMMARY.md` and `29-06-SUMMARY.md`; the refusal-by-name clause and the documented nesting do not, on **CR-01** and **CR-06** \|

A sentence was added beneath the table recording that `e87650e` corrected the traceability table and never reached this one, that the stale half was the live claim, and that the row moves back UP only on a re-verification verdict — never on the completion of the gap-closure plans addressing `CR-01` and `CR-06`.

## Full `git diff --stat`

```
$ git diff --stat f16d0b1 HEAD
 .planning/REQUIREMENTS.md | 16 ++++++++++++----
 1 file changed, 12 insertions(+), 4 deletions(-)

$ git diff f16d0b1 HEAD --name-only
.planning/REQUIREMENTS.md
```

Exactly one file changed, as the plan requires. Change set, verified line by line: `CUT-01`'s four places (checkbox+sentence, two provenance paragraphs, traceability row, narrative paragraph) plus `MCP-04`'s one row and its accompanying sentence. **No other requirement status moved in either direction. No Phase 28 row was edited. `REPOINT-01`, `REPOINT-02` and `MCP-04` were not moved up.**

## Decisions Made

- **Kept the verifier's 15,957 despite a failed re-derivation.** Recorded as a finding in this summary and named inside the requirement entry, per the plan's `T-29-17-03` mitigation. Substituting 19,714 would have overridden an owner decision on the strength of an executor's own measurement.
- **Did not reproduce the falsified figures in the replacement prose.** The plan's automated verify requires `12.4k` (and the rest) absent **file-wide**, not merely absent from the sizing sentence. The narrative therefore describes the falsification directionally — larger surface, more surviving, smaller net removal — and points at `29-VERIFICATION.md` and this file's own history for the superseded numerals. This also avoids re-seeding falsified figures into a grep-searchable record.
- **Skipped the `.planning/WINDOWS.md` ledger append.** The executor protocol documents ledger population as best-effort and never blocking; the plan's verification item 4 requires the diff to show exactly one changed file, and its `T-29-17-05` mitigation forbids widening scope. The plan's explicit boundary wins. The 15,957 divergence is instead recorded in two durable places: this summary and `CUT-01`'s own entry.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Falsified figures had to be removed file-wide, not just from the sizing sentence**

- **Found during:** Task 1
- **Issue:** The first draft of the replacement narrative quoted the three superseded figures (`25,759 / 10,102 / 15,657`, `~12.4k`, `~12.9k`) while explaining what had been refuted, and quoted `29-10-SUMMARY.md` verbatim. That satisfied the acceptance criterion (which scopes the prohibition to the sizing sentence) but **failed the plan's own `<verify><automated>` block**, which requires `! grep -q '12.4k' .planning/REQUIREMENTS.md` over the whole file.
- **Fix:** Rewrote both affected passages to state the falsification directionally and to paraphrase the `29-10-SUMMARY.md` citation, keeping the 8,221-line figure that plan actually delivered. Verified with `grep -n '12\.4k\|12\.9k\|25,759\|10,102\|15,657\|25\.7k' .planning/REQUIREMENTS.md` → exit 1.
- **Files modified:** `.planning/REQUIREMENTS.md`
- **Verification:** grep exit 1; `node scripts/audit-gate.mjs` exit 0.
- **Committed in:** `be4e1fe` (Task 1 commit)

**2. [Rule 2 - Missing Critical] The entry states its own re-derivation status**

- **Found during:** Task 1
- **Issue:** `must_haves.truths` requires the entry to carry provenance "so a later reader can re-derive every figure rather than take it on trust". One figure does not re-derive. Stating a provenance that implies all three do would be exactly threat `T-29-17-02` — a number impersonating a measurement.
- **Fix:** Added a "Re-derivation status" paragraph inside `CUT-01` recording which end reproduces, which does not, the re-derived value, and that the divergence is adjudicated in this summary. The plan's own instruction to "note the divergence so the next reader can adjudicate it" authorises this.
- **Files modified:** `.planning/REQUIREMENTS.md`
- **Verification:** Present in the committed entry; audit gate and the three record guards green.
- **Committed in:** `be4e1fe` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 missing-critical).
**Impact on plan:** Both were required to satisfy the plan's own verify block and `must_haves`. Neither widened scope — the change set is still one file and the rows the plan named.

## Issues Encountered

**The `test:automated` failing-file set is much larger than `29-BASELINE.md`'s, and the cause is the worktree, not this plan.**

- Baseline (`29-BASELINE.md`): 7 failures — `audit-integrity.test.ts` (2) + `anno-session.test.ts` (5). The latter left the set by construction when 29-10 deleted the file.
- This run: **36 failures / 2,634 pass / 2,676 tests**, across `repo-root.test.ts`, `resources-sync.test.ts`, `vice-broker-acquire.test.ts`, `vice-broker-supervision.test.ts`, `broker-control.test.ts`, `broker-kill.test.ts`, `build-atomic.test.ts`, `telemetry-import.test.ts`, `anno-cli.test.ts`, `vice-proxy.test.ts`, `disasm-roundtrip.test.ts`, `absorbed-answer-key.test.ts`.
- **Attribution is mechanical, not inferred.** `git diff f16d0b1 HEAD --name-only` returns exactly one path, `.planning/REQUIREMENTS.md`. Every source file under `src/mcp/vice/` is byte-identical to the base commit, so any test failing at HEAD fails identically at `f16d0b1`. The only guards that read `REQUIREMENTS.md` are `audit-integrity.test.ts`, `docs-dangling-refs.test.ts`, `docs-review-disposition.test.ts` and `scripts/audit-gate.mjs` — **all four green** (59/59 tests, gate exit 0).
- **The environment names itself.** `repo-root.test.ts`'s failure message is verbatim: `the agreed directory must not sit under .claude -- got /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-afc541937c56e907b/.vice-supervisor (the exact regression a naive move would introduce)`. This plan runs in a worktree under `.claude/`, which is precisely the condition that assertion forbids. The broker, build-atomic and resources-sync families are host/path/build-sensitive in the same way.
- The VICE broker was confirmed **inactive** before the run (`systemctl --user is-active vice-broker` → `inactive`; no `x64sc` process), so the known false-positive on `BACK-05` was not in play.
- **No regression is attributable to this plan.** The comparison that is meaningful for a `.planning/`-only change — the four record guards — is green, and was green before and after both commits.

`audit-integrity.test.ts` is notably **no longer failing** (44/44 in the scoped run). That is an improvement relative to the baseline set and it is explained rather than banked: `29-VERIFICATION.md` records the same red-then-green sequence, closed when that report supplied the missing review-finding dispositions. This plan did not cause it and did not need to.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `CUT-01` is closed on the owner's decision. It is the sixth of the six truths Phase 29 was scored on and the only one that needed no code.
- **One item is left for a human**, deliberately: whether 15,957 is the right surviving-line figure. It did not re-derive, the divergence is 3,757 lines, and no coherent predicate reproduces it. A re-verification pass or the milestone audit should adjudicate. The record does not hide this — `CUT-01`'s entry says it in its own words.
- `MCP-04` remains `Gaps Found` in both tables and moves up only on a re-verification verdict. Plans 29-13 through 29-16 address `CR-01` and `CR-06`; their completion is explicitly **not** grounds to move the row.
- `REPOINT-01` and `REPOINT-02` were untouched and stay `Gaps Found`, as the plan required.

---
*Phase: 29-the-mcp-surface*
*Completed: 2026-08-30*

## Self-Check: PASSED

- `.planning/REQUIREMENTS.md` — FOUND
- `.planning/phases/29-the-mcp-surface/29-17-SUMMARY.md` — FOUND
- Commit `be4e1fe` — FOUND
- Commit `95c66f8` — FOUND
- `node scripts/audit-gate.mjs` — exit 0
- `audit-integrity.test.ts` + `docs-dangling-refs.test.ts` + `docs-review-disposition.test.ts` — 59/59 pass, 0 fail
- `git diff f16d0b1 HEAD --name-only` — exactly `.planning/REQUIREMENTS.md`
- `.planning/STATE.md` and `.planning/ROADMAP.md` — unmodified
