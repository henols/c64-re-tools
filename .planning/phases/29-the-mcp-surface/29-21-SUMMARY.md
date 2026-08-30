---
phase: 29-the-mcp-surface
plan: 21
subsystem: planning-record
tags: [requirements, record-of-intent, cut-01, mcp-04, measurement, provenance, audit-gate]

requires:
  - phase: 29-the-mcp-surface
    provides: "29-VERIFICATION.md (round 2, 2026-08-30T15:20Z) — the independent re-measurement that scored CUT-01 truth 6 ✗ FAILED, and the MCP-04 ✓ SATISFIED (was BLOCKED) verdict"
  - phase: 29-the-mcp-surface
    provides: "29-17-SUMMARY.md's recorded decision to keep the verifier's as-measured surviving figure rather than substitute a re-measurement — the decision this plan supersedes"
  - phase: 29-the-mcp-surface
    provides: "29-10-SUMMARY.md — the plan that performed the deletion this requirement sizes"
provides:
  - "CUT-01's every numeral MEASURED during this plan, by running the predicate the entry itself documents, at the commits it names, with the counting command it names"
  - "A sizing sentence that NAMES its anchor commit (`f16d0b1`), so the surviving figure re-derives for a later reader instead of drifting with HEAD"
  - "A corrected `d30b63e` clause: the entry recorded 18,728 there, which was the 20-descendant subtotal quoted as the total; the total is 19,714"
  - "CUT-01 moved to Complete with checkbox, sizing sentence, both provenance paragraphs and traceability row in ONE edit"
  - "MCP-04 promoted to Complete across all four of its sites on the quoted re-verification verdict, with its evidence cell rewritten so no live cell quotes the superseded BLOCKED verdict"
affects: [phase-32-cut-04, milestone-audit, gap-closure-round-2-verification]

actuals:
  tokens: 6119
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "A sizing figure NAMES the commit it was measured at, because a HEAD-relative figure is not re-derivable by construction"
    - "A record whose purpose is that its numbers are measured does not restate falsified numerals in its LIVE text — they survive in the dated superseded paragraphs instead"
    - "A status row moves UP only on a quoted verification verdict, and the quotation is verbatim rather than paraphrased"

key-files:
  created:
    - .planning/phases/29-the-mcp-surface/29-21-SUMMARY.md
  modified:
    - .planning/REQUIREMENTS.md

key-decisions:
  - "RE-MEASURED rather than transcribed: ran the predicate, wrote what the commands returned. The figures happen to agree with 29-VERIFICATION.md's 19,714 / 6,309 exactly — but they are this plan's measurement, not a copy of the verifier's"
  - "29-17's recorded reasoning ('an executor's re-measurement is a finding rather than a licence to substitute') is SUPERSEDED here, explicitly rather than silently: this plan is authorised by a verification verdict that scored the resulting entry ✗ FAILED, so re-measuring and substituting is exactly its instruction"
  - "No `overrides:` entry written. 29-VERIFICATION.md offered one; the owner's 2026-08-30 decision was 'correct the text to the measured figures', and recording the divergence as acceptable would defeat CUT-01's own stated purpose"
  - "The anchor commit `f16d0b1` was NOT changed — only the figure moved. Keeping the anchor leaves the entry's provenance paragraph structurally intact and is the smallest honest edit"
  - "Corrected a second, quieter error the plan asked to settle: :132 claimed 'the same predicate yields 18,728 at d30b63e'. Measured, d30b63e yields 19,714; 18,728 is the 20-descendant subtotal, not the total"
  - "Kept the verbatim string '✓ SATISFIED (was BLOCKED)' in MCP-04's live evidence cell rather than paraphrasing it away to satisfy a literal reading of task 2 criterion 2 — see Issues Encountered"
  - "Skipped the .planning/WINDOWS.md ledger append and the deferred-items.md log, as 29-17 did: the plan's own verification requires `git diff --name-only` across the plan to list exactly `.planning/REQUIREMENTS.md`, and both ledgers are documented as best-effort and never blocking"

patterns-established:
  - "Anchored sizing figures: a line-count claim states the commit it holds at and says why anchoring is necessary, so the claim stays checkable after the tree moves"
  - "Scoped absence assertions: 'the superseded numeral is gone' is asserted over the LIVE entry extracted by text range, paired with a positive assertion that the dated superseded paragraphs still carry it — a whole-file absence check would force gutting a paragraph the convention orders kept"

requirements-completed: [CUT-01, MCP-04]

coverage:
  - id: D1
    description: "CUT-01's every numeral produced by a command this plan ran, at a commit the sizing sentence names, with the checkbox, sentence, both provenance paragraphs and the traceability row moved in one edit"
    requirement: "CUT-01"
    verification:
      - kind: other
        ref: "node measure-cut01.mjs — git ls-tree 8f21d77 filtered ^src/mcp/vice/r2000-.*\\.ts$ (35 files), git show <commit>:<path> | wc -l summed at both ends; pre 26,023 / surviving 19,714 / net 6,309"
        status: pass
      - kind: other
        ref: "awk-extracted live CUT-01 entry | grep -c -e '15,957' -e '10,066' == 0 (was 2 before the edit)"
        status: pass
      - kind: other
        ref: "grep -n 'f16d0b1' .planning/REQUIREMENTS.md — anchor named inside the :128 sizing sentence"
        status: pass
      - kind: other
        ref: "node scripts/audit-gate.mjs exit 0; node scripts/check-no-regenerator2000.mjs exit 0 with an EMPTY temporary allow-list"
        status: pass
      - kind: other
        ref: "independent re-derivation from a clean shell, third run, identical figures; reversed-order re-derivation equal; dirty-tree re-run identical"
        status: pass
    human_judgment: false
  - id: D2
    description: "MCP-04 promoted to Complete at all four of its sites on the quoted re-verification verdict and on nothing else, with the superseded BLOCKED quote replaced in the evidence cell"
    requirement: "MCP-04"
    verification:
      - kind: other
        ref: "grep -n 'MCP-04' .planning/REQUIREMENTS.md — five consistent hits (:99 ticked, :232 Complete, :268 Complete + SATISFIED quote, :272 new dated paragraph, :274 preserved paragraph)"
        status: pass
      - kind: other
        ref: "git diff -U0 | requirement-id extraction over changed table rows returns exactly {MCP-04} — no unintended flip"
        status: pass
      - kind: other
        ref: "grep -c 'corrected DOWNWARD on 2026-08-30' == 1 and grep -c 'MOVES BACK DOWN' == 1 — both superseded dated paragraphs survive"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/docs-review-disposition.test.ts — 7/7 pass"
        status: pass
    human_judgment: false
  - id: D3
    description: "The requirement record now answers both halves of the CUT-01 question the same way — :128's sizing sentence and :132's re-derivation status agree, so a reader can act on both"
    requirement: "CUT-01"
    verification: []
    human_judgment: true
    rationale: "Whether the corrected prose actually reads coherently to a later reader — and whether the anchoring rationale is convincing rather than merely present — is an editorial judgment no grep asserts. The mechanical halves (numerals equal, superseded numerals absent from the live entry, anchor named) are covered by D1."

duration: 15 min
completed: 2026-08-30
status: complete
---

# Phase 29 Plan 21: CUT-01 re-measured and MCP-04 promoted Summary

**CUT-01's sizing claim rebuilt from a measurement this plan RAN — 26,023 pre-phase at `8f21d77`, 19,714 surviving at the newly-named anchor `f16d0b1`, 6,309 net removed — and MCP-04 moved to `Complete` across all four of its sites on the verifier's quoted `✓ SATISFIED (was BLOCKED)` verdict.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-30T16:00:44Z
- **Completed:** 2026-08-30T16:15:37Z
- **Tasks:** 2
- **Files modified:** 1 (`.planning/REQUIREMENTS.md`)

## Accomplishments

- Executed CUT-01's own documented predicate rather than transcribing a figure — the specific failure 29-17 made — and wrote whatever the commands returned.
- Anchored the surviving figure to `f16d0b1` **inside the sizing sentence**, with the reason stated: the same predicate returns 20,960 at `6715a75`, so a HEAD-relative figure is not re-derivable by construction.
- Settled the internal disagreement the plan flagged: `:132` claimed `18,728 at d30b63e`; measured, `d30b63e` yields **19,714** — 18,728 is the 20-descendant subtotal quoted as if it were the total.
- Promoted MCP-04 on the re-verification verdict and on nothing else, rewriting its **evidence cell** as well as its status cell so no live cell quotes the superseded BLOCKED verdict.
- Every superseded dated paragraph kept intact, still carrying the superseded numerals — the supersede-with-a-date convention asserted positively, not merely not-violated.

## The measurement, quoted as executed

The measurement was driven by a script that runs exactly the commands the entry documents. It is reproduced here command-by-command with its raw output.

**Predicate (unchanged, executed rather than re-invented):**

```
pre-phase set  = git ls-tree -r --name-only 8f21d77 -- src/mcp/vice
                 filtered by ^src/mcp/vice/r2000-.*\.ts$
surviving set  = the anno-* name-descendants of that set, plus the three
                 renamed test files 29-VERIFICATION.md enumerates:
                 absorbed-answer-key.test.ts, spawn-seam.test.ts,
                 docs-absorbed-decisions.test.ts
counting       = git show <commit>:<path> | wc -l, summed
```

### Step 1 — pre-phase end at `8f21d77`

```
$ git ls-tree -r --name-only 8f21d77 -- src/mcp/vice | grep -cE '^src/mcp/vice/r2000-.*\.ts$'
35
```

Selection non-empty, cardinality **35** — matches the count the entry names, so the predicate executed is the predicate documented. (Had it returned 0, the run is a hard stop, never a total of 0; had it returned any other count, the run stops and reports.)

`git show 8f21d77:<path> | wc -l`, per file:

```
    97  non-test  src/mcp/vice/r2000-acme-ident.ts
   285  TEST      src/mcp/vice/r2000-answer-key.test.ts
  1651  TEST      src/mcp/vice/r2000-cli.test.ts
  1511  non-test  src/mcp/vice/r2000-cli.ts
   154  TEST      src/mcp/vice/r2000-confidence.test.ts
   233  non-test  src/mcp/vice/r2000-confidence.ts
  2169  TEST      src/mcp/vice/r2000-coverage-grammar.test.ts
  4781  TEST      src/mcp/vice/r2000-coverage.test.ts
  2328  non-test  src/mcp/vice/r2000-coverage.ts
   389  TEST      src/mcp/vice/r2000-d64.test.ts
   310  non-test  src/mcp/vice/r2000-d64.ts
   353  TEST      src/mcp/vice/r2000-enum-gen.test.ts
   574  non-test  src/mcp/vice/r2000-enum-gen.ts
   527  TEST      src/mcp/vice/r2000-launch.test.ts
   357  non-test  src/mcp/vice/r2000-launch.ts
   776  TEST      src/mcp/vice/r2000-mcp-client.test.ts
   795  non-test  src/mcp/vice/r2000-mcp-client.ts
   464  TEST      src/mcp/vice/r2000-memmap-render.test.ts
   531  non-test  src/mcp/vice/r2000-memmap-render.ts
   414  TEST      src/mcp/vice/r2000-project.test.ts
   304  non-test  src/mcp/vice/r2000-project.ts
   421  non-test  src/mcp/vice/r2000-regbits-gen.ts
   250  TEST      src/mcp/vice/r2000-regbits.test.ts
   966  TEST      src/mcp/vice/r2000-session.test.ts
   693  non-test  src/mcp/vice/r2000-session.ts
   514  TEST      src/mcp/vice/r2000-spawn-seam.test.ts
   618  TEST      src/mcp/vice/r2000-symbol-roundtrip.test.ts
   388  non-test  src/mcp/vice/r2000-symbols.ts
    95  non-test  src/mcp/vice/r2000-test-gate.ts
  1030  TEST      src/mcp/vice/r2000-tools.test.ts
  1214  non-test  src/mcp/vice/r2000-tools.ts
   207  TEST      src/mcp/vice/r2000-upstream-audit.test.ts
   192  TEST      src/mcp/vice/r2000-verb-coverage.test.ts
   248  TEST      src/mcp/vice/r2000-verify.test.ts
   184  non-test  src/mcp/vice/r2000-verify.ts
PRE-PHASE TOTAL      = 26023
  non-test subtotal  = 10035
  test subtotal      = 15988
  split adds up      = true
  zero-line files    = none (each counted as a file regardless)
```

**The pre-phase end re-derives exactly**, as the entry already claimed: 26,023 = 10,035 + 15,988 across 35 files. Confirmed by running it, not assumed.

### Step 2 — surviving end at `f16d0b1`

`git cat-file -e f16d0b1:<path>` tested per candidate before counting; `git show f16d0b1:<path> | wc -l` over those that exist:

```
   285  src/mcp/vice/absorbed-answer-key.test.ts
    97  src/mcp/vice/anno-acme-ident.ts
  1017  src/mcp/vice/anno-cli.test.ts
   905  src/mcp/vice/anno-cli.ts
   154  src/mcp/vice/anno-confidence.test.ts
   233  src/mcp/vice/anno-confidence.ts
  2169  src/mcp/vice/anno-coverage-grammar.test.ts
  4781  src/mcp/vice/anno-coverage.test.ts
  2328  src/mcp/vice/anno-coverage.ts
   389  src/mcp/vice/anno-d64.test.ts
   310  src/mcp/vice/anno-d64.ts
   335  src/mcp/vice/anno-enum-gen.test.ts
   523  src/mcp/vice/anno-enum-gen.ts
   590  src/mcp/vice/anno-memmap-render.test.ts
   564  src/mcp/vice/anno-memmap-render.ts
   421  src/mcp/vice/anno-regbits-gen.ts
   250  src/mcp/vice/anno-regbits.test.ts
   254  src/mcp/vice/anno-symbols.ts
  1158  src/mcp/vice/anno-tools.test.ts
  2060  src/mcp/vice/anno-tools.ts
   190  src/mcp/vice/anno-verb-coverage.test.ts
   231  src/mcp/vice/docs-absorbed-decisions.test.ts
   470  src/mcp/vice/spawn-seam.test.ts
surviving file count = 23
SURVIVING TOTAL      = 19714
```

20 `anno-*` name-descendants = **18,728**; the three renamed test files (285 + 231 + 470) = **986**; 18,728 + 986 = **19,714**.

### The four edge assertions, each run and its result recorded

```
adjacency/injectivity: duplicate descendants = NONE (map is injective)
adjacency/no-silent-drop: pre-phase files with NO descendant at f16d0b1 = 15
empty: zero-line surviving files = none (a zero-line file would contribute 0
       and still count as a file); a selection returning zero files is a hard
       stop, never a total of 0
ordering: reversed-order re-derivation = 19714; equal to sorted-order = true
```

**The 15 pre-phase files fully removed** (no name-descendant at `f16d0b1`), enumerated rather than silently dropped:

```
src/mcp/vice/r2000-answer-key.test.ts
src/mcp/vice/r2000-launch.test.ts
src/mcp/vice/r2000-launch.ts
src/mcp/vice/r2000-mcp-client.test.ts
src/mcp/vice/r2000-mcp-client.ts
src/mcp/vice/r2000-project.test.ts
src/mcp/vice/r2000-project.ts
src/mcp/vice/r2000-session.test.ts
src/mcp/vice/r2000-session.ts
src/mcp/vice/r2000-spawn-seam.test.ts
src/mcp/vice/r2000-symbol-roundtrip.test.ts
src/mcp/vice/r2000-test-gate.ts
src/mcp/vice/r2000-upstream-audit.test.ts
src/mcp/vice/r2000-verify.test.ts
src/mcp/vice/r2000-verify.ts
```

(`r2000-answer-key.test.ts` and `r2000-spawn-seam.test.ts` have no `anno-` descendant because they were renamed to `absorbed-answer-key.test.ts` and `spawn-seam.test.ts`, which are counted on the survivor side as the three named files. The descendant map is a pure name transform and does not know about those renames — which is exactly why the entry enumerates the three separately.)

**Concurrency check.** The working tree was dirtied (`echo … >> .planning/REQUIREMENTS.md`, confirmed by `git status --short` reporting ` M .planning/REQUIREMENTS.md`), both measurements re-run, and the figures were **identical** — 26,023 / 10,035 / 15,988 / 19,714 / 6,309. `git show` reads the object store at a named commit and is unaffected by the tree. The touch was then reverted with `git checkout -- .planning/REQUIREMENTS.md` and `git status --short` confirmed clean.

### Step 3 — cross-checks (recorded here, deliberately NOT written into the entry)

```
d30b63e (d30b63e): surviving total = 19714 over 23 files; fully-removed = 15
HEAD    (6715a75): surviving total = 20960 over 23 files; fully-removed = 15
```

Re-run after both commits landed, `HEAD` = `5692265`: still **20,960**.

**This settles the disagreement the plan asked to settle.** `REQUIREMENTS.md:132` claimed *"the same predicate yields 18,728 at `d30b63e`"*; `29-VERIFICATION.md` measured **19,714** there. The measurement says **19,714** — the entry's 18,728 was the 20-descendant subtotal quoted as though it were the total. `:132` is corrected to 19,714.

### Net

```
net removal = pre-phase total 26023 - surviving total 19714 = 6309
```

### Does the measured figure agree with the verifier's 19,714?

**Yes — exactly, at both ends and for the net.** `agrees with verifier's surviving? true`, `agrees with verifier's net? true`. No third figure appeared. That agreement is the outcome, not the method: the numbers were derived by running the commands, and would have been written even had they disagreed.

## Task Commits

1. **Task 1: CUT-01 re-measured, four sites in one edit** — `7a49a3d` (docs)
2. **Task 2: MCP-04 promoted on the re-verification verdict, four sites in one edit** — `5692265` (docs)

## Before/after of every edited site, by line

### Task 1 — CUT-01 (commit `7a49a3d`)

| Line | Site | Before | After |
|---|---|---|---|
| 128 | checkbox | `- [ ] **CUT-01**` | `- [x] **CUT-01**` |
| 128 | sizing sentence, net | `a **net 10,066 lines** of the **26,023-line, 35-file** …` | `a **net 6,309 lines** removed from the **26,023-line, 35-file** …` |
| 128 | sizing sentence, surviving | `the remaining **15,957 lines** surviving under new names.` | `the remaining **19,714 lines surviving under new names as measured at commit \`f16d0b1\`**.` + a new clause stating *why* it is anchored (the same predicate yields 20,960 at `6715a75`, so a HEAD-relative figure is not re-derivable by construction) |
| 130 | provenance paragraph | predicate + counting command | **unchanged** — they are correct and are what was executed. Appended only what the measurement adds: `wc -l` counts newlines (so a file lacking a trailing newline contributes one fewer — accepted, identical rule at both ends); 15 of 35 removed outright, 20 surviving descendants + 3 renamed = 23 files; the descendant map is injective |
| 132 | re-derivation status | *"The surviving end does **not** re-derive … yields 19,714 … the same predicate yields 18,728 at `d30b63e`… The **15,957 recorded here is `29-VERIFICATION.md`'s as-measured figure**, kept because…"* | *"…**BOTH ENDS NOW RE-DERIVE.**"* — 19,714 at `f16d0b1` across 23 files, net 6,309; `d30b63e` corrected from 18,728 to **19,714** with the subtotal-quoted-as-total error named; 20,960 at `6715a75`; the dirty-tree and different-order re-derivations recorded; the "kept as the verifier's as-measured figure" sentence **deleted** — it was the defect. The superseded numerals are pointed at rather than restated |
| 242 | traceability row | `\| CUT-01 \| Phase 29 \| Gaps Found \|` | `\| CUT-01 \| Phase 29 \| Complete \|` |
| 253 | NEW dated paragraph | — | `**\`CUT-01\` MOVES BACK UP to \`Complete\` on 2026-08-30, on a measurement this plan TOOK rather than transcribed…**` — records the figures, the anchor, that the substantive claim was never in dispute and was re-observed, and that no `overrides:` entry was written and why |

`:255` (`MOVES BACK DOWN`), `:257` (`MOVES UP to Complete on the OWNER's decision`) and `:259` (`superseded rather than wrong`) — the pre-edit `:253`/`:255`/`:257` — are **kept byte-identical**. Three stacked dated paragraphs is the correct shape for this file.

### Task 2 — MCP-04 (commit `5692265`)

| Line | Site | Before | After |
|---|---|---|---|
| 99 | checkbox | `- [ ] **MCP-04**` | `- [x] **MCP-04**` (requirement text itself unchanged — nothing about what MCP-04 demands has changed, only whether it is met) |
| 232 | traceability row | `\| MCP-04 \| Phase 29 \| Gaps Found \|` | `\| MCP-04 \| Phase 29 \| Complete \|` |
| 268 | per-phase status row, status cell | `Gaps Found` | `Complete` |
| 268 | per-phase status row, evidence cell | quoted the superseded BLOCKED verdict in full (*"Explicit addressing, idempotence and per-item batch status all hold — but CR-01 delivers exactly the 'plausible-looking zero'…"*) | quotes the **authorising** verdict verbatim (*"Both defects re-executed and closed; named tests exist for each (`anno-tools.test.ts:823`, `:846`, `:1352`, `:1409`)."*), names CR-01 and CR-06 with the verifier's own re-execution sentences, states that the verifier **re-executed** rather than read, and keeps the row's convention of naming the evidencing summaries (`29-03`, `29-06`, `29-13`) |
| 272 | NEW dated paragraph | — | records the upward move on the 2026-08-30T15:20Z verdict, quotes `:274`'s own rule and shows it satisfied rather than bypassed, names the two closed findings, states that all four sites moved in one edit, and records that the promotion was taken by a gap-closure plan rather than from the orchestrator seat |

`:274` (`corrected DOWNWARD on 2026-08-30`) is **kept intact**.

## Row-by-row enumeration of the traceability table

Every changed row across the whole plan, by requirement id:

| Requirement | Before | After | Moved? |
|---|---|---|---|
| `MCP-04` (traceability, :232) | Gaps Found | Complete | **YES** — on the quoted re-verification verdict |
| `MCP-04` (per-phase status, :268) | Gaps Found | Complete | **YES** — same edit, evidence cell rewritten with it |
| `CUT-01` (traceability, :242) | Gaps Found | Complete | **YES** — on this plan's own measurement |
| `REPOINT-01` | Gaps Found | Gaps Found | no |
| `REPOINT-02` | Gaps Found | Gaps Found | no |
| `STORE-03` | Complete | Complete | no |
| every other row (MCP-01/02/03/05, STORE-*, EXPORT-*, REPOINT-03/04, CUT-02..06) | — | unchanged | no |

Asserted mechanically, not by eye:

```
$ git diff -U0 .planning/REQUIREMENTS.md | grep -E '^[-+]\|' \
    | grep -oE '\b(MCP|STORE|EXPORT|REPOINT|CUT|CORE|BACK|SKILL|ABS|IN)-[0-9]+\b' | sort -u
MCP-04
```

(run for task 2's diff; task 1's equivalent returned `CUT-01` alone). This is the guard against the recorded incident of a tool flipping every phase requirement to `Complete` on its own reading.

## Acceptance criteria — results

### Task 1

| # | Criterion | Result |
|---|---|---|
| 1 | Measurement quoted as executed commands with output, both ends, counts and split | **PASS** — the whole `## The measurement, quoted as executed` section above |
| 2 | Written figures equal measured figures | **PASS** — `grep -o` over `:128` returns `net 6,309 lines` and `19,714 lines surviving under new names as measured at commit \`f16d0b1\``; measurement returned net 6309 / surviving 19714 |
| 3 | Superseded numerals gone from the LIVE entry, still present in the kept paragraphs | **PASS** — live-entry `grep -c` was **2** before the edit (extraction range confirmed correct) and is **0** after; `grep 'MOVES UP to \`Complete\` on the OWNER' \| grep -c '15,957'` = 1 and `\| grep -c '10,066'` = 1; `grep 'superseded rather than wrong' \| grep -c '15,957'` = 1 (that paragraph carries only the surviving numeral and never carried the net one — not added) |
| 4 | `f16d0b1` named inside the `:128` sizing sentence | **PASS** — `grep -n 'f16d0b1'` hits :128, :130, :132, :253 |
| 5 | `git diff --stat` one file; all sites in the same diff | **PASS** — `1 file changed, 6 insertions(+), 4 deletions(-)` |
| 6 | `grep -c 'MOVES BACK DOWN'` ≥ 1 | **PASS** — 1 |
| 7 | Independent re-derivation from a clean shell | **PASS** — re-run twice more post-edit; identical each time |
| 8 | `audit-gate.mjs` exit 0; `check-no-regenerator2000.mjs` exit 0 with empty temporary allow-list | **PASS** — `audit-gate: OK -- 9 docs guards green, 7 milestone audits scanned, 5 declaring a gated status`; `check-no-<subject>: OK -- scanned 392 files … 0 temporarily allow-listed across 0 entries` |

### Task 2

| # | Criterion | Result |
|---|---|---|
| 1 | Five consistent `MCP-04` hits | **PASS** — `:99` ticked checkbox, `:232` `Complete` traceability row, `:268` `Complete` per-phase row quoting the SATISFIED verdict, `:272` new dated paragraph, `:274` preserved paragraph |
| 2 | Every remaining `BLOCKED` sits in a dated superseded paragraph, never a live status cell | **PARTIAL — see Issues Encountered.** Five occurrences on four lines, enumerated below |
| 3 | Diff touches MCP-04's four sites and no other requirement's status row | **PASS** — id extraction returns `{MCP-04}` |
| 4 | `audit-gate.mjs` exit 0 | **PASS** |
| 5 | `test:automated` counts + failing-file set; `docs-review-disposition.test.ts` 7/7 | **PASS** — 2727 pass / 1 fail; failing file `repo-root.test.ts` (environmental, below); `docs-review-disposition.test.ts` 7 pass / 0 fail |
| 6 | `grep -c 'corrected DOWNWARD on 2026-08-30'` ≥ 1 | **PASS** — 1 |

**Enumeration for criterion 2** (`grep -c 'BLOCKED'` returns 4 lines, 5 occurrences):

| Line | Paragraph it belongs to | Live status? |
|---|---|---|
| 255 | the dated, superseded `CUT-01 MOVES BACK DOWN to Gaps Found on 2026-08-30` paragraph (itself superseded by the new `:253`) | No — dated, superseded, and about CUT-01 |
| 268 | MCP-04's live per-phase **evidence** cell — the verifier's own current verdict string `✓ SATISFIED (was BLOCKED)`, quoted verbatim | No — the **status** cell reads `Complete`; this is the SATISFIED verdict naming its own prior state |
| 272 (×2) | the new dated 2026-08-30 paragraph — once quoting the same current `✓ SATISFIED (was BLOCKED)` verdict, once describing why the superseded BLOCKED quote was replaced | No — dated, live, and asserting the promotion |
| 274 | the preserved, dated `corrected DOWNWARD on 2026-08-30` paragraph | No — dated, superseded by `:272` |

The long superseded BLOCKED **quote** the criterion exists against is gone. No cell claims a BLOCKED status.

## Test results

```
$ npm --prefix src/mcp/vice run test:automated
# tests 2734
# suites 24
# pass 2727
# fail 1
# skipped 1
# todo 5
```

**Failing-file set, by name: `src/mcp/vice/repo-root.test.ts` — one test.**

```
not ok 1267 - path agreement (D-3, D-6, THE regression this task exists to catch):
  the launcher's own repo_root (resources/ and tools/ copies) agrees with Node's
  supervisorDir()/dirname(EPOCH_FILE), and the agreed path is not under .claude
  location: '…/.claude/worktrees/agent-ae117ffa8f4201ec4/src/mcp/vice/repo-root.test.ts:178:1'
  error: 'the agreed directory must not sit under .claude -- got
          /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-ae117ffa8f4201ec4/.vice-supervisor'
```

**This is a worktree-location artifact, not a regression from this plan.** The assertion is that the resolved supervisor directory must not sit under `.claude`; this executor's worktree literally *is* `.../.claude/worktrees/agent-…/`, so the assertion is unsatisfiable from inside a Claude Code worktree regardless of what the tree contains. It failed identically before any edit was made (observed in the pre-edit run) and it reads no planning document. In the main checkout the resolved path is `/home/henrik/dev/henrik/git/c64-re-tools/.vice-supervisor`, which is not under `.claude`. Out of scope under the executor's scope boundary; recorded here rather than in `deferred-items.md` because the plan's own verification requires the plan-wide diff to list exactly one file.

`docs-review-disposition.test.ts` verified green independently: **7 pass / 0 fail**. The two suite assertions that keyed on undispositioned review ids remain discharged.

## Plan-level verification

| Check | Result |
|---|---|
| Both measurements re-run from a clean shell reproduce the written figures | **PASS** (three runs total) |
| Live CUT-01 entry contains neither superseded numeral (0), having contained both (2) before | **PASS** |
| Dated superseded paragraphs still carry theirs | **PASS** (`15,957` ×1 in each of the two kept paragraphs; `10,066` ×1 in the move-up paragraph) |
| `f16d0b1` named inside the sizing sentence | **PASS** |
| MCP-04 `Complete` at all four sites, superseded BLOCKED quote replaced | **PASS** |
| `MOVES BACK DOWN` and `corrected DOWNWARD on 2026-08-30` survive | **PASS** (1 each) |
| `node scripts/audit-gate.mjs` exit 0 | **PASS** |
| `node scripts/check-no-regenerator2000.mjs` exit 0, empty temporary allow-list | **PASS** — `0 temporarily allow-listed across 0 entries` |
| `test:automated` | 2727 pass / 1 fail (`repo-root.test.ts`, environmental) |
| `git diff --name-only` across the plan lists exactly `.planning/REQUIREMENTS.md` | **PASS** |

**Regression guard for the four ✓ VERIFIED criteria.** This plan changed no code and no gate. The removal gate was re-run rather than assumed and is green tree-wide with an empty temporary allow-list; the nine SATISFIED requirements other than MCP-04 kept their rows untouched, asserted by the row-by-row enumeration above.

## Decisions Made

- **Re-measured rather than transcribed.** The figures agree with `29-VERIFICATION.md` exactly, but they are this plan's measurement. This is the entire point of CUT-01 and the specific failure 29-17 made.
- **29-17's reasoning superseded explicitly, not silently.** `29-17-SUMMARY.md` records: *"Kept the verifier's 15,957 surviving-line figure … because the owner decided on those specific numbers — an executor's re-measurement is a finding rather than a licence to substitute."* That was defensible for 29-17, which had no verdict authorising substitution. This plan does: round-2 verification scored the resulting entry ✗ FAILED and named the fix. Re-measuring and substituting is its instruction, not its improvisation.
- **No `overrides:` entry written.** The owner's 2026-08-30 decision was *"correct the text to the measured figures"*; an override would record the divergence as acceptable, defeating the requirement's own stated purpose.
- **The anchor was not changed.** `f16d0b1` was already documented as the phase HEAD the correction was written against. Keeping it means only the figure moved, leaving the provenance paragraph structurally intact.
- **Falsified numerals not restated in the live entry**, only pointed at — the same call 29-17 made, and correct. They survive verbatim in the two dated superseded paragraphs, which is the convention working rather than a gap.
- **`✓ SATISFIED (was BLOCKED)` kept verbatim** in MCP-04's evidence cell rather than paraphrased away; see Issues Encountered.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Provisioned the worktree's `src/mcp/vice/node_modules`**

- **Found during:** Task 1, running the plan's `<verify>` command.
- **Issue:** `src/mcp/vice/node_modules` existed but was **empty** in this worktree (`ls | wc -l` = 0; the main checkout has 213 entries). `node_modules` is gitignored and is provisioned by the repo's `SessionStart` hook, which had not run for this worktree. The result was 36 test failures with causes like `spawnSync …/node_modules/.bin/tsc ENOENT` — the plan's `<verify>` was structurally unable to say anything about the tree.
- **Fix:** Ran the project's **own documented provisioning command**, `npm --prefix src/mcp/vice ci --no-audit --no-fund` — byte-for-byte what `scripts/ensure-mcp-deps.sh:40` runs. `added 237 packages in 6s`.
- **Why this is not the excluded case:** the executor's Rule-3 exclusion covers `npm install <pkg>` — resolving a *named* package, where a failure may indicate a slopsquatted or hallucinated name. `npm ci` installs exactly the committed `package-lock.json` and resolves no new name. No dependency was added, changed or removed; `package.json` and `package-lock.json` are untouched.
- **Verification:** failures fell from 36 to 1, and the survivor is the environmental `repo-root.test.ts` case above.
- **Committed in:** nothing — `node_modules` is gitignored, so this deviation contributes no bytes to either commit. `git status --short` was empty after both commits.

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** None on scope or content. The fix restored the verify environment; it changed no tracked file. The plan-wide diff is still exactly one file.

## Issues Encountered

**1. Task 2 criterion 2 is in tension with task 2's own action instruction, and the action instruction wins.**

Criterion 2 requires every remaining `BLOCKED` occurrence to sit inside a dated, superseded paragraph. The action instruction requires the authorising verdict to be *"quoted rather than paraphrased"*, and `29-VERIFICATION.md` § Requirements Coverage renders that verdict literally as `✓ SATISFIED (was BLOCKED)`. Quoting it verbatim therefore places the string `BLOCKED` inside a live evidence cell and inside the new dated paragraph.

Resolution: the quotation was kept verbatim. The criterion's *purpose* is met — no live cell claims a BLOCKED **status**, the status cells read `Complete`, and the long superseded BLOCKED quote that produced the one-file disagreement is gone. Editing `(was BLOCKED)` out to satisfy a literal reading would be paraphrasing the verdict, which the same task forbids. Logged rather than silently resolved, and enumerated line-by-line in the criterion table above.

**2. `repo-root.test.ts:178` cannot pass from inside a Claude Code worktree.** Detailed under Test results. Pre-existing, environmental, unrelated to this plan's subject; not fixed, not logged to `deferred-items.md` (the plan's verification requires a one-file diff), recorded here.

**3. No third figure appeared.** `<measurement_discipline>` required that a figure disagreeing with the verifier's 19,714 be written anyway and flagged prominently. It did not arise: the measurement returned 19,714 / 6,309, matching the verifier at both ends. Recorded because the absence of the finding is itself worth stating — the instruction was live, not moot by assumption.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Gap 2 is closed on its own terms: `:128` and `:132` now agree, every numeral in the live CUT-01 entry was produced by a command this plan ran, and the surviving figure names the commit it holds at so a later reader (Phase 32's `CUT-04`, the milestone audit) re-derives rather than believes.
- `MCP-04`'s record no longer disagrees with its own verifier, at any of the four sites the file answers that question from.
- `REPOINT-01` and `REPOINT-02` remain `Gaps Found` by design — plans 29-18, 29-19 and 29-20 address their gaps, but a completed plan is not a verdict. A round-3 verification is what may move them.
- Per the round's dated 2026-08-30 stopping rule: if round 3 again finds new defects in **plan-derived** truths while all five ROADMAP success criteria plus `CUT-01` read verified, the phase seals on the contract with its eleven OPEN-AS-WARNING residuals (WR-02, WR-03, WR-04, WR-06..WR-13) plus the three deferred ones (WR-14 → Phase 30, WR-15/WR-16 → on record) stated rather than running a round 4.

---
*Phase: 29-the-mcp-surface*
*Completed: 2026-08-30*
