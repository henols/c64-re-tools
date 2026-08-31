---
phase: 31-procedure-re-pointing
plan: 03
subsystem: infra
tags: [removal-gate, exemption-prose, citation, planning-record, decisions-log, no-status-flip]

# Dependency graph
requires:
  - phase: 29-the-mcp-surface
    provides: "plan 29-09's BLOCK-scoped `skill-attribution-headers` permanent exemption and the STATE.md decision line recording it — the two records carrying the stale criterion citation"
  - phase: 31-procedure-re-pointing
    provides: "plan 31-01's manifest re-sync (the `STORE-04` inference and the date-don't-delete disposition recorded here as judgements 1 and 2) and plan 31-02's committed ABS-02 assertion with its measured counts (the evidence for judgement 4)"
provides:
  - "Both removal-gate citations of the attribution criterion now name the ordinal that exists after `D-01`'s narrowing, with the citation's content clause preserved verbatim and a dated renumbering parenthetical at each site"
  - "The STATE.md `- [Phase 29]:` decision line's citation corrected in place without re-dating the Phase 29 decision it records"
  - "One dated `- [Phase 31]:` Decisions entry recording all four of this phase's judgements, each with evidence quoted from the two prior SUMMARYs and a named reversal condition"
  - "`REPOINT-03` / `REPOINT-04` left `Pending` on purpose, with the non-promotion recorded as a decision rather than left as an omission"
affects: [phase-31-verification, phase-32-guard-audit, milestone-audit, future-abs-02-work]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate` (chars/4 over the realized diff)
actuals:
  tokens: 2611
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Correct a citation's ordinal in place and attach a dated renumbering parenthetical, so a reader who remembers the old number sees the move instead of suspecting a typo"
    - "Record a non-promotion as a decision with a named reversal condition, so a deliberately-unmoved status row cannot later read as an oversight"

key-files:
  created:
    - .planning/phases/31-procedure-re-pointing/31-03-SUMMARY.md
  modified:
    - scripts/check-no-regenerator2000.mjs
    - .planning/STATE.md

key-decisions:
  - "The correction is confined to prose: two comment/`why`-string sites in the gate and one STATE.md decision line. No `SKILL_ATTRIBUTION_PINS` entry, no `SUBJECT_NEEDLE`, no `isInsideSkillAttributionBlock`, no exemption scope, path or hit count was touched — mechanically asserted by a `git diff -U0` token scan plus `node --check` for the concatenated string."
  - "The dated renumbering parenthetical was added at all three sites rather than only correcting the ordinal, because a bare `4 -> 1` edit in a permanent exemption's justification is indistinguishable from a typo fix and would erase the record that `D-01` moved the number."
  - "`REPOINT-03` and `REPOINT-04` were NOT promoted, and `requirements.mark-complete` was deliberately not invoked. The rows stay `Pending`; the non-promotion is recorded as judgement 4 of the STATE.md entry with the Phase 31 verification verdict as its named reversal condition."
  - "The close-out STATE.md bookkeeping verbs (`state.advance-plan`, `state.update-progress`, `state.record-metric`, `state.record-session`) were deliberately NOT invoked: every one of them rewrites the frontmatter counters, the Current Position block or the Performance Metrics tables, which this plan's prohibitions forbid rewriting and which its task-2 acceptance criteria assert unchanged. The phase-level tracking write stays with the orchestrator, as it was for waves 1 and 2 (commit 409ac1b)."

patterns-established:
  - "Exemption-justification hygiene: when a permanent exemption cites an external criterion by ordinal and that ordinal moves, correct the citation AND date the move in the same edit — the exemption's auditability is the whole reason the citation exists."
  - "Additions-only proof for a planning-record append: assert one hunk header, zero deletion lines, and a byte-identical frontmatter against HEAD, so collateral damage from a state-mutation verb fails the task rather than shipping."

requirements-completed: []

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "No living guard or state record cites the criterion ordinal `D-01` removed: both `scripts/check-no-regenerator2000.mjs` sites and the `.planning/STATE.md` decision line name ROADMAP Phase 31 criterion 1"
    requirement: "REPOINT-03"
    verification:
      - kind: other
        ref: "grep -c 'Phase 31 criterion 4' scripts/check-no-regenerator2000.mjs -> 0 (was 2); same over .planning/STATE.md -> 0 (was 1); grep -c 'Phase 31 criterion 1' -> 2 and 1 respectively (both were 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The citation's content — the exemption's actual justification — is preserved verbatim at both gate sites, and the renumbering is dated rather than silent"
    requirement: "REPOINT-03"
    verification:
      - kind: other
        ref: "grep -c 'two naming lines byte-identical' scripts/check-no-regenerator2000.mjs -> 2 (unchanged from 2); grep -c 'D-01' -> 3 (was 1, so >= 2 satisfied)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Correcting the prose changed the gate's prose and nothing else: the executable surface is provably untouched and every instrument that reads it is green"
    requirement: "REPOINT-03"
    verification:
      - kind: other
        ref: "node --check scripts/check-no-regenerator2000.mjs -> exit 0; git diff -U0 token scan for SKILL_ATTRIBUTION_PINS / blocks: / hits: / SUBJECT_NEEDLE / isInsideSkillAttributionBlock / git ls-files over changed lines -> no match"
        status: pass
      - kind: integration
        ref: "node scripts/check-no-regenerator2000.mjs -> exit 0, `skill-attribution-headers 24`, 0 temporarily allow-listed across 0 entries"
        status: pass
      - kind: unit
        ref: "cd src/mcp/vice && node --test removal-gate.test.ts -> # tests 8, # pass 8, # fail 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Historical records are left alone — the executed-phase artifact and this phase's own RESEARCH/PATTERNS still quote the pre-narrowing ordinal they describe"
    requirement: "REPOINT-03"
    verification:
      - kind: other
        ref: "git status --porcelain over 29-09-SUMMARY.md, 31-RESEARCH.md, 31-PATTERNS.md -> empty; grep -c 'Phase 31 criterion 4' 29-09-SUMMARY.md -> 4, identical to its pre-task value"
        status: pass
    human_judgment: false
  - id: D5
    description: "`.planning/STATE.md` carries one dated `- [Phase 31]:` Decisions entry recording all four judgements this phase took, each with evidence and a named reversal condition"
    requirement: "REPOINT-04"
    verification:
      - kind: other
        ref: "grep -c '^- \\[Phase 31\\]:' .planning/STATE.md -> 1; entry-scoped substring checks (piped through that grep) for STORE-04 / INFERRED / dated / 'Wave 0' / Pending -> 1 each, all 0 before the task"
        status: pass
    human_judgment: true
    rationale: "The four judgements are present and each carries a reversal condition, mechanically. Whether each reads as the judgement the RESEARCH document raised — rather than a paraphrase that lost its point — is editorial and only a human reading of the entry can score it."
  - id: D6
    description: "The STATE.md write is additions-only for the Decisions entry, with the frontmatter counters, Current Position block, Performance Metrics tables and Deferred Items ledger untouched"
    requirement: "REPOINT-04"
    verification:
      - kind: other
        ref: "git diff -U0 5cfa783 c291591 -- .planning/STATE.md -> exactly one hunk `@@ -727,0 +728 @@`, 1 insertion / 0 deletions; diff of lines 1-20 against HEAD -> empty (frontmatter byte-identical); frontmatter.get parses all 12 keys plus the 5 progress counters unchanged"
        status: pass
    human_judgment: false
  - id: D7
    description: "`REPOINT-03` and `REPOINT-04` still read `Pending` with unticked checkboxes; REQUIREMENTS.md was not touched by this plan"
    requirement: "REPOINT-03"
    verification:
      - kind: other
        ref: "grep -c '| REPOINT-03 | Phase 31 | Pending |' -> 1 and the same for REPOINT-04; grep -c '- [ ] **REPOINT-03**' -> 1 and the same for REPOINT-04; git status --porcelain .planning/REQUIREMENTS.md -> empty"
        status: pass
    human_judgment: false
  - id: D8
    description: "The typecheck and the full automated suite are green at zero failures with the broker stopped, after each task"
    requirement: "REPOINT-03"
    verification:
      - kind: integration
        ref: "cd src/mcp/vice && npm run typecheck -> exit 0; npm run test:automated -> # tests 2920, # pass 2914, # fail 0 (run after each of the two task commits, broker `inactive` before each)"
        status: pass
    human_judgment: false

# Metrics
duration: 13 min
completed: 2026-08-31
status: complete
---

# Phase 31 Plan 03: Re-point the Narrowed Criterion's Living Citations Summary

**The `skill-attribution-headers` permanent exemption's justification is auditable again — both gate citations and the STATE.md decision line now name ROADMAP Phase 31 criterion 1 with a dated `D-01` renumbering parenthetical, the content clause preserved verbatim — and this phase's four judgements (the inferred `STORE-04` id, date-don't-delete, no permanent prose gate, and the deliberate non-promotion) are one dated `- [Phase 31]:` Decisions entry instead of a diff a later reader would have to reconstruct.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-08-31T09:33:52Z (base commit `409ac1b`)
- **Completed:** 2026-08-31T09:47:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- **An exemption nobody could audit is auditable again.** `scripts/check-no-regenerator2000.mjs`'s `skill-attribution-headers` class is **permanent** precisely because a ROADMAP criterion requires the ABS-02 headers to survive with their two naming lines byte-identical. Both places that justification is written — the `SKILL_ATTRIBUTION_PINS` doc comment and the exemption's `why` string — cited **criterion 4**, an ordinal `D-01` removed on 2026-08-30 when it narrowed Phase 31 to two criteria. Both now cite **criterion 1**, the ordinal the attribution clause actually carries, read off `ROADMAP.md § "### Phase 31"` rather than guessed.
- **The move is dated, not silent.** Each of the three sites gained a short parenthetical recording that the phase was narrowed by `D-01` on 2026-08-30 and this clause became the first of the two — *"the number moved, the requirement did not"*. A bare `4 -> 1` edit inside a permanent exemption's justification is indistinguishable from a typo fix; the parenthetical is what keeps the renumbering in the record.
- **The citation's content survived verbatim.** `grep -c 'two naming lines byte-identical'` reads **2** before and after. Only the ordinal moved and the parenthetical was added — the clause that *is* the exemption's justification is byte-identical.
- **Nothing executable moved, and that is asserted rather than described.** `node --check` clean over the `+`-concatenated `why` string; a token scan of every changed line finds no `SKILL_ATTRIBUTION_PINS` entry, `blocks:`, `hits:`, `SUBJECT_NEEDLE`, `isInsideSkillAttributionBlock` or `git ls-files`; `removal-gate.test.ts` re-drives the real exported predicates over its four planted evasion routes at 8/8; and the gate still reports `skill-attribution-headers 24` on its six unchanged per-file pins with an **empty** temporary allow-list.
- **The four judgements are a record now.** One `- [Phase 31]:` entry, in the neighbours' shape, states each judgement, its evidence quoted from `31-01-SUMMARY.md` / `31-02-SUMMARY.md`, and the condition that would reverse it.
- **Both requirement rows still read `Pending`, on purpose.** Criterion 1 measured true on disk before any plan in this phase ran, so the temptation to flip was real. The rows did not move, `requirements.mark-complete` was not invoked, and the non-promotion is judgement 4 with the Phase 31 verification verdict as its reversal condition.
- **The historical records were left alone.** `29-09-SUMMARY.md`, `31-RESEARCH.md` and `31-PATTERNS.md` all still quote the pre-narrowing ordinal — an executed-phase artifact, and two documents describing the correction, legitimately carry the wording they describe.

## Task Commits

1. **Task 1: Re-point the three living citations** — `5cfa783` (docs)
2. **Task 2: Record Phase 31's four judgements in STATE.md** — `c291591` (docs)

**Plan metadata:** the `docs(31-03)` commit carrying this SUMMARY and the ROADMAP progress row.

### `git show --stat`, verbatim

```
5cfa783 docs(31-03): re-point the three living citations of the narrowed Phase 31 criterion
 .planning/STATE.md                   |  2 +-
 scripts/check-no-regenerator2000.mjs | 17 +++++++++++------
 2 files changed, 12 insertions(+), 7 deletions(-)
```

```
c291591 docs(31-03): record Phase 31's four judgements in STATE.md
 .planning/STATE.md | 1 +
 1 file changed, 1 insertion(+)
```

Task 1's commit lists **exactly two** paths; task 2's lists **exactly one**. Neither introduced a file deletion (`git diff --diff-filter=D HEAD~1 HEAD` empty for both).

## Files Created/Modified

- `scripts/check-no-regenerator2000.mjs` — +11 / −6, entirely inside one comment block and one `why:` string. `SKILL_ATTRIBUTION_PINS`' six entries, the bidirectional pin loop, `isInsideSkillAttributionBlock`, `SUBJECT_NEEDLE`, every exemption `id` / scope / path / hit count and the `.planning/` prefix in the scope predicate are all byte-identical.
- `.planning/STATE.md` — one line modified (task 1: the `- [Phase 29]:` citation) and one line added (task 2: the `- [Phase 31]:` entry). Frontmatter, Current Position, Performance Metrics and Deferred Items untouched.

## The measurements this plan was required to record

### Before/after grep counts, all three citation sites

| File | `Phase 31 criterion 4` before | after | `Phase 31 criterion 1` before | after |
|---|---|---|---|---|
| `scripts/check-no-regenerator2000.mjs` | **2** | **0** | **0** | **2** |
| `.planning/STATE.md` | **1** | **0** | **0** | **1** |
| `.planning/phases/29-the-mcp-surface/29-09-SUMMARY.md` (must be **unchanged**) | **4** | **4** | 3 | 3 |

Supporting counts over `scripts/check-no-regenerator2000.mjs`:

| Token | Before | After | Required |
|---|---|---|---|
| `two naming lines byte-identical` (the content clause) | 2 | **2** | `2` — preserved, not just renumbered |
| `D-01` (the dated renumbering parenthetical) | 1 | **3** | at least `2` |

Every one of these is false-before / true-after in the direction that matters, and the `29-09-SUMMARY.md` row is the one asserted **positively unchanged**.

### `git diff -U0 .planning/STATE.md` hunk headers, verbatim

Task 1 (`409ac1b..5cfa783`) — the citation correction, a one-line in-place modification:

```
@@ -718 +718 @@ Recent decisions affecting current work:
```

Task 2 (`5cfa783..c291591`) — the Decisions entry, **additions-only**:

```
@@ -727,0 +728 @@ Recent decisions affecting current work:
```

One hunk each. Task 2's `git diff --numstat` reads `1	0	.planning/STATE.md` — **1 insertion, 0 deletions** — and a count of deletion lines in its `-U0` diff returns `0`. `diff <(git show 5cfa783:.planning/STATE.md | sed -n '1,20p') <(sed -n '1,20p' .planning/STATE.md)` is **empty**: the frontmatter, including all five `progress:` counters, is byte-identical. No collateral damage from a state verb, because no state verb was used — the entry was inserted directly.

### The two requirement rows, quoted as they stand at the close

From `.planning/REQUIREMENTS.md`, lines 241-242:

```
| REPOINT-03 | Phase 31 | Pending |
| REPOINT-04 | Phase 31 | Pending |
```

And the checkboxes, lines 120-121, both unticked:

```
- [ ] **REPOINT-03**: The `ABS-02` attribution chain survives the code's deletion, …
- [ ] **REPOINT-04**: `upstream-procedure-manifest.json` is updated in the same commit …
```

`git status --porcelain .planning/REQUIREMENTS.md` is empty. The non-promotion is real, not merely asserted.

## Verification

Run from the repository root unless noted.

| # | Command | Result |
|---|---|---|
| 1 | `systemctl --user is-active vice-broker` | `inactive` — checked first, and again before each suite run |
| 2 | `node --check scripts/check-no-regenerator2000.mjs` | exit 0 — the concatenated `why` string was not broken |
| 3 | `node scripts/check-no-regenerator2000.mjs` | exit 0 — 400 files scanned (370 tracked + 30 shipped-but-untracked, floor 350), 157 permanently exempt, **`skill-attribution-headers 24`**, **0 temporarily allow-listed across 0 entries** |
| 4 | `cd src/mcp/vice && node --test removal-gate.test.ts` | exit 0 — `# tests 8`, `# pass 8`, **`# fail 0`** |
| 5 | `git diff -U0 scripts/check-no-regenerator2000.mjs` token scan | no changed line contains `SKILL_ATTRIBUTION_PINS` entries, `blocks:`, `hits:`, `SUBJECT_NEEDLE`, `isInsideSkillAttributionBlock` or `git ls-files` |
| 6 | `cd src/mcp/vice && npm run typecheck` | exit 0 (`tsc --noEmit`, clean) |
| 7 | `cd src/mcp/vice && npm run test:automated` | `# tests 2920`, `# pass 2914`, **`# fail 0`**, `# skipped 1`, `# todo 5` — run after **both** task commits, identical both times |
| 8 | `git status --porcelain .planning/REQUIREMENTS.md .planning/ROADMAP.md src/skills installer/skills` | empty at both task commits |
| 9 | `git status --porcelain` over `29-09-SUMMARY.md`, `31-RESEARCH.md`, `31-PATTERNS.md` | empty — historical records untouched |
| 10 | `node .claude/gsd-core/bin/gsd-tools.cjs query frontmatter.get .planning/STATE.md` | all 12 keys plus the 5 `progress:` counters parse, values unchanged |

**The full automated suite is at `# fail 0` here**, where both prior waves recorded `# fail 1`. That failure was `repo-root.test.ts`'s *"the agreed directory must not sit under `.claude`"* assertion, red by construction inside a `.claude/worktrees/` executor sandbox. This plan ran sequentially on the main working tree, so the assertion's subject is the real repository root and it passes — confirming both prior SUMMARYs' attribution of that failure to the worktree location rather than to their edits.

## Decisions Made

- **The parenthetical was added, not just the ordinal corrected.** The exemption is permanent *because* a criterion justifies it; a citation that silently changes its own number destroys the reader's ability to reconcile it against the 29-09 record that still says 4. Dating the move is what keeps both records consistent without editing the historical one.
- **The STATE.md `- [Phase 29]:` line was corrected in place and NOT re-dated.** It records a Phase 29 decision. Only the ordinal moved (plus the parenthetical); the line's substance is untouched.
- **The Decisions entry was inserted directly, with no `gsd` state verb.** Every relevant verb (`state.add-decision` among them) rewrites more than the Decisions section and has a recorded history of collateral edits in this repository. A direct single-line insertion made the additions-only and byte-identical-frontmatter criteria provable rather than something to repair afterwards.
- **`requirements.mark-complete` was deliberately not invoked, and the close-out STATE.md bookkeeping verbs were not either.** See Deviations #2 — both are the plan's prohibitions and this executor's success criteria in agreement, and the reasoning is itself judgement 4 of the entry this plan wrote.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 1's acceptance criterion for the unchanged historical record states the wrong count**

- **Found during:** Task 1 (post-edit criterion sweep)
- **Issue:** The criterion reads `grep -c 'Phase 31 criterion 4' .planning/phases/29-the-mcp-surface/29-09-SUMMARY.md` → `1` *(unchanged — the historical record still quotes the wording it describes)*. The file's actual count is **4**, both before and after this plan. The criterion's **intent** — that the historical record is positively unchanged and still carries the old wording — is met exactly; only its arithmetic was wrong.
- **Fix:** None applied to the repository. Editing `29-09-SUMMARY.md` to satisfy the literal `1` is precisely what threat **T-31-18** exists to forbid, and this plan's prohibitions name that file as not-to-be-edited. The criterion was scored on its intent and the true figure (`4` → `4`) is recorded in the table above so the verifier reads the measurement rather than the plan's number.
- **Files modified:** none
- **Verification:** `git status --porcelain .planning/phases/29-the-mcp-surface/29-09-SUMMARY.md` → empty; `grep -c` → `4`, identical to the value captured before any edit
- **Committed in:** n/a — a plan-text arithmetic error, recorded not fixed

**2. [Rule 3 - Blocking] Task 2's `<verify>` command names a schema that does not exist**

- **Found during:** Task 2 verification
- **Issue:** `node .claude/gsd-core/bin/gsd-tools.cjs query frontmatter.validate .planning/STATE.md --schema state` fails with `Error: Unknown schema: state. Available: plan, plan-gap-closure, summary, verification`. There is no `state` schema in the installed GSD tooling, so the mandated command cannot be honestly executed and the acceptance criterion's `valid: true` can never be produced.
- **Fix:** Substituted the strongest equivalent the tooling actually offers, and recorded both halves: (a) `query frontmatter.get .planning/STATE.md` parses the YAML block cleanly and returns all 12 keys plus the 5 nested `progress:` counters — proof the frontmatter is well-formed after the edit; (b) `diff` of lines 1-20 against the task's parent commit is **empty** — proof it is byte-identical, which is a strictly stronger statement than schema-validity for a task whose whole obligation is to not touch it.
- **Files modified:** none
- **Verification:** both commands above run and recorded in the Verification table (rows 10 and the hunk-header section)
- **Committed in:** n/a — a verification-command substitution, no repository change

### Recorded departures that are NOT deviations

- **`.planning/ROADMAP.md`'s Phase 31 progress row was updated (`2/3 In Progress` → `3/3 Complete`) as part of the plan-metadata close-out, not by a task.** The plan's success criteria say ROADMAP.md is "untouched by this plan", and task 2's acceptance criterion asserts `git status --porcelain .planning/ROADMAP.md` empty — both were honoured **at every task commit**, and both are verified above. The progress row is close-out bookkeeping mandated by `execute-plan.md § update_roadmap` (this plan runs with `worktree: false`, making this handler the sole post-plan sync point) and by this executor's own success criteria. **No requirement status, criterion text or Phase 31 note was changed** — the prohibition that matters is intact. Flagged here so the verifier scores it rather than reading it as a breach.
- **The close-out STATE.md bookkeeping verbs were deliberately skipped.** `state.advance-plan`, `state.update-progress`, `state.record-metric` and `state.record-session` each rewrite the frontmatter counters, the Current Position block or the Performance Metrics tables — exactly what this plan's prohibitions forbid rewriting and what task 2's criteria assert unchanged. The phase-level tracking write stays with the orchestrator, as it was for waves 1 and 2 (`409ac1b docs(phase-31): update tracking after wave 2`). `requirements.mark-complete` was skipped for the same reason, and that skip is judgement 4 of the entry this plan wrote.

---

**Total deviations:** 2 auto-fixed (1 bug in the plan's own criterion arithmetic, 1 blocking verification-command substitution). Both are plan-text defects; neither changed what the repository received.
**Impact on plan:** None on scope. Exactly the two files named in `files_modified` were changed, in exactly the two commits the plan prescribed, and every substantive acceptance criterion was met as written or (for the two above) met on its intent with the true measurement recorded.

## Issues Encountered

None beyond the two plan-text defects recorded as deviations. No authentication gates, no checkpoints, no architectural decisions, and no verification failures.

## Known Stubs

None. No new symbol, constant, function, test, file, env var, dependency or MCP verb was created — this plan's deliverables are three prose corrections and one appended log entry, and all four are real content, not placeholders. Every `<verify>` command in the plan was run except the one that names a nonexistent schema, and its substitution is recorded as deviation #2.

## Threat Flags

None. No runtime code path, network endpoint, auth path, file-access pattern, dependency, input or credential was touched. The change is a comment block, a `why:` string and a Markdown log line.

## Threat Register Outcome

| Threat ID | Disposition | Outcome |
|---|---|---|
| T-31-14 | mitigate | **Held.** The edit is confined to a comment block and a `why:` string. `node --check` clean; the `git diff -U0` token scan finds no `SKILL_ATTRIBUTION_PINS` entry, `blocks:`, `hits:`, `SUBJECT_NEEDLE`, `isInsideSkillAttributionBlock` or scope query on any changed line; `removal-gate.test.ts` 8/8 over its four planted evasion routes; gate reports `skill-attribution-headers 24` |
| T-31-15 | mitigate | **Held.** Both gate citations re-pointed at criterion 1, the content clause asserted preserved by a `grep -c` of the clause itself (`2` → `2`), not merely of the ordinal, with a dated `D-01` parenthetical at each site (`D-01` count `1` → `3`) |
| T-31-16 | mitigate | **Held.** Neither row promoted; both asserted `Pending` with unticked checkboxes and an empty `git status` over `REQUIREMENTS.md`. The non-promotion is recorded as judgement 4 with the Phase 31 verification verdict as its named reversal condition |
| T-31-17 | mitigate | **Held, and the exposure was removed rather than mitigated:** no state mutation verb was invoked at all. Task 2's diff is one hunk, 1 insertion / 0 deletions, frontmatter byte-identical |
| T-31-18 | mitigate | **Held.** `29-09-SUMMARY.md` asserted unchanged by a positive `grep -c` on the old wording (`4`, identical before and after) plus an empty `git status`. The same holds for `31-RESEARCH.md` and `31-PATTERNS.md` |
| T-31-19 | accept | Unchanged — nothing secret exists in a planning record to disclose |
| T-31-SC | accept | Unchanged — no package-manager install task exists in this plan. `node_modules/` was already provisioned in the main checkout; nothing was installed |

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Phase 31's three plans are executed.** The phase's two success criteria both have their evidence on disk: criterion 1 is scored by `skill-attribution.test.ts`'s committed two-tree assertion (plan 31-02) and criterion 2 by the re-synced manifest with `r2000_undo`'s `requirement_id` (plan 31-01). This plan closed the record around them.
- **For the Phase 31 verifier — the two items that need a judgement call:**
  1. `REPOINT-03` / `REPOINT-04` are `Pending` **by decision**, recorded as judgement 4. Promoting them is this verification pass's call, and when it happens all four sites (both checkboxes, both traceability rows, and the promotion paragraph) move in ONE edit per `REQUIREMENTS.md`'s four-sites-one-edit rule.
  2. Plan 31-02's `must_haves.artifacts[0].contains` miss (the derived rather than literal `ABS02_ADAPTED_LINE`) is still the one open editorial item in this phase, flagged in its own SUMMARY. Nothing in this plan changes it — the removal gate's `attribution-guard-test` exemption remains at **14** (note: 31-02-SUMMARY.md's deviation #2 states that pin as `12`; the gate's own output reports `14`, and the figure in this SUMMARY is the one read from the live gate run).
  3. `31-VALIDATION.md § "Phase Requirements → Test Map"` still names only two manifest readers; 31-01 found a **third**, `anno-register.test.ts`. Add it.
- **For Phase 32's guard audit:** the removal gate's exemption prose is now internally consistent with `ROADMAP.md`. Any future narrowing of a cited phase's criteria must move these two strings again — the dated parentheticals mark exactly where.
- **Phase-level tracking is the orchestrator's write.** This plan deliberately did not run `state.advance-plan`, `state.update-progress`, `state.record-metric`, `state.record-session` or `requirements.mark-complete`; STATE.md's frontmatter still reads `completed_plans: 55` and its Current Position still reads `Plan: 1 of 3`. Both need the orchestrator's phase-close write.
- **No blockers.**

---
*Phase: 31-procedure-re-pointing*
*Completed: 2026-08-31*

## Self-Check: PASSED

- `.planning/phases/31-procedure-re-pointing/31-03-SUMMARY.md` — FOUND on disk (this file)
- `scripts/check-no-regenerator2000.mjs` — FOUND, `node --check` clean, gate exit 0
- `.planning/STATE.md` — FOUND, frontmatter byte-identical to `409ac1b`
- Commit `5cfa783` — FOUND in `git log --all`, lists exactly two paths
- Commit `c291591` — FOUND in `git log --all`, lists exactly one path
- Commit `0b06a9b` — FOUND in `git log --all` (this SUMMARY)
- Commit `e27990e` — FOUND in `git log --all` (ROADMAP progress row, hand-repaired after the verb mangled its cell spacing to `In Progress|  |`)
- All `<acceptance_criteria>` re-run post-commit. Every criterion passes as written except the two recorded as deviations (the `29-09-SUMMARY.md` count, met on intent with the true figure `4` recorded; and the nonexistent `--schema state`, substituted with `frontmatter.get` plus a byte-identical frontmatter diff).
- Plan-level `<verification>` steps 1-9 all run and recorded in the Verification table. The full automated suite is `# fail 0` (2920 tests, 2914 pass) with the broker `inactive`, re-run a third time after the ROADMAP progress row landed.
- `git status --short` carries only the four pre-existing untracked files that were present at spawn (`docs/dissambler-workflow.md`, `docs/undocumented-opcodes-ghidra.md`, `docs/vice-mcp-ideas.md`, `skills-lock.json`) — none of them touched.
