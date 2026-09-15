---
quick_id: 260915-hwe
phase: quick-260915-hwe
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QUICK-260915-hwe]

# This plan delivers .planning/STATE.md and .planning/ROADMAP.md content.
# It therefore takes the stock per-plan worktree carve-out. See CLAUDE.md,
# "GSD Execution Isolation", item 1. A worktree executor must not touch
# those two files.
USE_WORKTREES_FOR_PLAN: false

files_modified:
  - .planning/STATE.md
  - .planning/ROADMAP.md
  - .planning/codebase/CONCERNS.md
  - .planning/todos/pending/2026-09-13-vice-proxy-test-leaks-scratch-dirs-into-planning-root.md

files_deleted: []
# Two deletions happen that git does NOT record as deletions.
#  1. Git does not track the 19 `.planning/vice-proxy-evidence-test-*`
#     directories. `git ls-files` returns 0 of them. Their deletion makes
#     no git diff.
#  2. The todo moves from pending/ to completed/ by `git mv`. Git records
#     a rename, not a deletion.
# `files_deleted` is therefore empty by measurement, not by omission.

estimate:
  tokens: 34000
  raw_tokens: 34000
  tasks: 3
  confidence: low   # sample_count 0, factor 1.0, applied false

must_haves:
  truths:
    - "`.planning/` holds zero `vice-proxy-evidence-test-*` directories."
    - "A grep of `.planning/` for the scratch-dir leak returns a record that names the leak closed. That record also states why it is closed."
    - "A reader of `.planning/ROADMAP.md` learns two facts: the `## Progress` table must stay, and no test enforces that today."
    - "Every `## Progress` table row survives. The cut and dissolved phase rows survive."
  artifacts:
    - ".planning/todos/completed/2026-09-13-vice-proxy-test-leaks-scratch-dirs-into-planning-root.md"
  key_links:
    - "The moved todo's `## Resolution` section names commit d8ed053e. That commit is the reason remedies 1 to 3 are moot."
    - "The rewritten ROADMAP paragraph names commit 276c15c9. That commit deleted the table's former mechanical consumer."
    - "STATE.md's Deferred Items table holds no `Pending` row for a todo that now sits in `completed/`."
---

<objective>
Retire two planning records. Both describe a defect that no longer exists. Also
correct one ROADMAP claim that cites a deleted test as its reason.

Purpose: three records state false things in the present tense. A reader who
acts on the todo or on the CONCERNS entry chases a writer that is gone. A reader
who acts on the ROADMAP paragraph trusts a guard that does not exist.

Output: this plan deletes 19 residue directories. It moves one todo to
`completed/` and records the closure reason inside that file. It marks one
CONCERNS entry resolved. It replaces one ROADMAP paragraph with an accurate
reason to keep the table.

Scope bound: this plan changes NO file under `src/`, `scripts/`, `installer/` or
`.github/`. It is a planning-records cleanup only.

Word discipline for this plan: "delete" is the only verb for removal. "check" is
the only verb for a truth test. "correct" is the only verb for a change to
text that states something false.
</objective>

<execution_context>
@/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/workflows/execute-plan.md
@/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/todos/pending/2026-09-13-vice-proxy-test-leaks-scratch-dirs-into-planning-root.md
@.planning/codebase/CONCERNS.md
</context>

<measured_baseline>
The planner measured each fact below read-only on 2026-09-15. The tree was on
`main` at `4d8baf1f`. Each task re-checks the fact it depends on before it acts.

| # | Fact | How the planner measured it |
|---|------|------------------------------|
| B1 | 19 directories match `.planning/vice-proxy-evidence-test-*`. All are empty. | `find .planning/vice-proxy-evidence-test-* -type f \| wc -l` returns `0` |
| B2 | Git tracks none of the 19. | `git ls-files '.planning/vice-proxy-evidence-test-*' \| wc -l` returns `0` |
| B3 | Gitignore covers none of the 19. | `git check-ignore -v .planning/vice-proxy-evidence-test-XyZ12` returns rc 1 |
| B4 | The writer `tmpWorkspaceIncidentsDir()` is gone from the tree. | `grep -rn` over `*.ts`, `*.mts` and `*.mjs`, excluding `node_modules`, returns `0` hits |
| B5 | Commit `d8ed053e` deleted that writer. Its subject is "test(55-03): delete the proxy-local recycle test block, paired to its successors". | `git log --oneline -1 d8ed053e` |
| B6 | Git tracks the todo file. The move therefore needs `git mv`. | `git ls-files` returns the pending path |
| B7 | `.planning/todos/completed/` exists. Its convention keeps the original body and appends a `## Resolution` section. | `2026-08-19-releases-json-schema-undocumented.md:32` and `2026-08-13-confirm-help-discriminator-against-real-vice-binaries.md:107` |
| B8 | `comment-phase-pointers.test.ts` exists nowhere in the tree. | `find . -name 'comment-phase-pointers*'` outside `.git` and `node_modules` returns `0` |
| B9 | Commit `276c15c9` deleted that test. Its subject is "test(260914-poo): delete 43 non-qualifying tests and module-classification.ts". | `git log --oneline -1 276c15c9` |
| B10 | `parseCutPhasesFromRoadmap` has NO live code consumer. Only `.planning/` prose and `graph.json` still name it. | `grep -rn` over `*.ts`, `*.mts`, `*.mjs` and `*.cjs`, excluding `node_modules`, returns `0` hits |
| B11 | The live `## Progress` table holds **60** phase rows. | `sed -n '/^## Progress/,$p' .planning/ROADMAP.md \| grep -c '^\| [0-9]'` |
| B12 | `.planning/todos/pending/` holds **15** files. STATE.md's Deferred Items table holds 15 matching rows. The two agree today. | `ls .planning/todos/pending/*.md \| wc -l` |
| B13 | The todo slug appears **4** times in STATE.md. Lines 247, 267 and 1460 are historical prose. Line 2208 is the live Deferred Items table row. | `grep -c` |

The planner found two corrections at planning time. Both change what the
executor writes.

**C1. The claim "cut phases exist nowhere else once a milestone is archived" is
FALSE. Do not write it.**
The archived milestone ROADMAPs are cumulative snapshots. They are not
per-milestone slices. Measured phase-row counts are: `v0.2.0` 12, `v0.3.0` 21,
`v0.4.0` 20, `v0.5.0` 25, `v0.7.0` 35, `v0.8.0` 41, `v0.9.0` 47. The `v0.9.0`
archive therefore already carries every cut row, which are `6.`, `20.`, `21.`,
`22.` and `25.`.

Task 3 writes this accurate claim instead. The live table is the only current
and complete per-phase record. Each archive freezes at its own milestone close.
The newest archive stops at 47 rows and carries nothing for Phases 45 to 56. A
collapse of the live table would therefore leave the newest phases with no
per-phase record. It would also force a reader to rebuild history from seven
frozen snapshots.

**C2. A SECOND stale mention of the deleted test sits BELOW the Progress
table.**
The footnote that opens "v0.9.0 shipped and collapsed 2026-09-10" ends with this
sentence: "`comment-phase-pointers.test.ts` parses it, and collapsing it empties
the cut-phase set and reds four of its tests." That footnote is a dated record
of a decision taken on 2026-09-10. The test still existed then. The reason was
true then. The footnote is not a live standing instruction.

That footnote is deliberately OUT OF SCOPE for this plan. The task description
authorizes exactly one ROADMAP edit. Task 3 leaves the footnote byte-identical.
Task 3 also records in the SUMMARY that the executor read it and judged it
historical. A later reader must not count it as a miss.
</measured_baseline>

<tasks>

<task type="tracer">
  <name>Task 1: Delete the 19 empty residue directories, one emptiness check each</name>
  <files>.planning/vice-proxy-evidence-test-* (19 untracked, empty directories)</files>
  <precondition>The shell runs at the repository root. `.planning/` exists.</precondition>
  <action>
This is the tracer slice. It deletes the physical residue that tasks 2 and 3
describe. After task 1, the later tasks change only prose.

Check fact B4 first. The writer must still be absent. Grep the repository for
the identifier `tmpWorkspaceIncidentsDir` across `*.ts`, `*.mts` and `*.mjs`.
Exclude `node_modules`. If that grep returns ANY hit, STOP and report it. The
leak is live again and this plan's premise is void.

Then delete the directories. Gate every deletion on its own emptiness check. Do
NOT run one broad recursive deletion. Do NOT delete anything above `.planning/`.

For each path that matches `.planning/vice-proxy-evidence-test-*`:

1. Count the regular files under it. Use `find <dir> -type f | wc -l`.
2. If the count is 0, delete that one directory. Prefer `rmdir`.
3. If the count is NOT 0, skip that directory. Leave it on disk. Record its path
   and its file list. A non-empty directory is new evidence, not residue.

Report how many directories you deleted. Report how many you skipped. If you
skipped any directory, stop after this task and surface it. Tasks 2 and 3 would
otherwise write a closure claim that is not true.
  </action>
  <verify>
    <automated>test "$(find .planning -maxdepth 1 -name 'vice-proxy-evidence-test-*' | wc -l)" -eq 0 && test "$(git status --porcelain src/ | wc -l)" -eq 0</automated>
  </verify>
  <done>Zero `vice-proxy-evidence-test-*` entries remain directly under `.planning/`. No path under `src/` changed. The executor reported 19 deleted and 0 skipped. If any directory held files, the executor stopped and reported that directory instead.</done>
</task>

<task type="auto">
  <name>Task 2: Move the todo to completed/ with its closure reason, and delete its live ledger row</name>
  <files>.planning/todos/pending/2026-09-13-vice-proxy-test-leaks-scratch-dirs-into-planning-root.md, .planning/STATE.md</files>
  <action>
**Step 1. Move the todo.** Git tracks this file, per B6. Use `git mv`, not plain
`mv`. Move it from `.planning/todos/pending/` to `.planning/todos/completed/`.
Keep the filename unchanged.

**Step 2. Keep the existing frontmatter and body byte-identical.** The body
records what an author observed on 2026-09-13. That includes its `files:`
pointer to a line range whose helper no longer exists. A filed todo is a record
of its own moment. The correction belongs in the closure section. Do not rewrite
the observation.

**Step 3. Append a `## Resolution` section** at the end of the file. Match the
convention of the other completed todos, per B7. The section must state these
facts in plain prose:

- The closure date is 2026-09-15. The item closes as MOOT, not as corrected.
- Commit `d8ed053e` deleted the writer that the frontmatter names,
  `tmpWorkspaceIncidentsDir()`. Quote that commit's subject. Nothing recreates
  the directories now.
- A repository-wide grep for that identifier over `*.ts`, `*.mts` and `*.mjs`,
  outside `node_modules`, returns nothing. A grep for an `mkdtemp` call rooted
  at `.planning` also returns nothing.
- All three candidate remedies the todo proposed are therefore moot. Name all
  three: the startup reap, the relocated base, and the gitignore rule. A named
  list stops a reader from proposing one again.
- Task 1 of this quick task checked the 19 residue directories as empty and
  deleted them. That closes the todo's own final instruction.
- Nobody added the pattern to `.gitignore`. State the reason. With no writer
  there is nothing to ignore. An ignore rule would also hide a real recurrence.

**Step 4. Delete the live ledger row in STATE.md.** STATE.md is about 411 KB. Do
NOT read it whole. Do NOT rewrite it. Make exactly two targeted edits:

1. Delete the single Deferred Items table row whose Item column names this todo.
   It sits at line 2208. Its category is `testing` and its priority is `minor`.
   Delete the whole line. The table's own trailing note records this same
   convention for todos that become complete on disk.
2. Correct the figure in the ledger preamble at line 243. The sentence reads
   "The Deferred Items ledger below reads **15 open** pending todos". Change the
   figure to **14 open**. The pending tree drops from 15 files to 14.

Leave the three HISTORICAL mentions of this todo slug untouched. They sit at
lines 247, 267 and 1460. They are dated narrative about when an author filed the
item and when a later author counted it. They stay true.

**Step 5. Record one explicit non-goal in the SUMMARY.** The `### Pending Todos`
section near line 1458 opens with "10 pending (10 files in
`.planning/todos/pending/` + 0 UAT-gap rows = 10)". That figure was ALREADY
wrong before this task. The tree held 15 files, per B12. Do not correct it here.
Record the measured difference in the SUMMARY. A later reader must not mistake
this task's change from 15 to 14 for the cause of that older error.

Do not call any `gsd-tools` `state.*` verb against STATE.md. Those verbs reflow
and truncate prose in this file. Edit the file directly.
  </action>
  <verify>
    <automated>test ! -e .planning/todos/pending/2026-09-13-vice-proxy-test-leaks-scratch-dirs-into-planning-root.md && test -e .planning/todos/completed/2026-09-13-vice-proxy-test-leaks-scratch-dirs-into-planning-root.md && grep -q '^## Resolution' .planning/todos/completed/2026-09-13-vice-proxy-test-leaks-scratch-dirs-into-planning-root.md && grep -q 'd8ed053e' .planning/todos/completed/2026-09-13-vice-proxy-test-leaks-scratch-dirs-into-planning-root.md && test "$(ls .planning/todos/pending/*.md | wc -l)" -eq 14 && test "$(grep -c 'vice-proxy-test-leaks-scratch-dirs-into-planning-root' .planning/STATE.md)" -eq 3 && grep -q '14 open' .planning/STATE.md</automated>
  </verify>
  <done>The todo sits in `completed/`. Its original body is intact. It carries a `## Resolution` section that names `d8ed053e` and all three moot remedies. The pending tree holds 14 files. The todo slug appears exactly 3 times in STATE.md, which proves the table row is gone and the three historical mentions survive. The ledger preamble reads 14 open.</done>
</task>

<task type="auto">
  <name>Task 3: Mark the CONCERNS entry resolved and replace the ROADMAP table's stale reason</name>
  <files>.planning/codebase/CONCERNS.md, .planning/ROADMAP.md</files>
  <action>
**Part A. CONCERNS.md. Rewrite the entry in place and mark it resolved.**

The entry titled "**Test-leaked scratch directories accumulate in
`.planning/`:**" sits at lines 171 to 179. Do NOT move it into the `## Resolved
Since The Last Audit` table at line 32. That table covers the superseded
2026-08-11 audit only. This entry belongs to the 2026-09-01 audit. Rewrite it
where it stands. A reader who greps the symptom must still land on the answer.

The rewritten entry must do all of this:

- Keep a title that still holds the words a reader would grep for. Put the word
  resolved and the date 2026-09-15 in the title line itself.
- State that commit `d8ed053e` deleted the writer `tmpWorkspaceIncidentsDir()`.
  That deletion is why the recorded `Trigger`, which reads "running
  `vice-proxy.test.ts`", is no longer true.
- State that the recorded `Files` pointer,
  `src/mcp/vice/vice-proxy.test.ts:4711-4726`, names a line range whose helper
  no longer exists. A reader must treat that pointer as historical.
- State that an executor checked the 19 accumulated directories as empty and
  deleted them on 2026-09-15. State that nobody added the pattern to
  `.gitignore`, by decision.
- Point at
  `.planning/todos/completed/2026-09-13-vice-proxy-test-leaks-scratch-dirs-into-planning-root.md`
  for the full closure record.

Leave the surrounding entries untouched. Leave the `## Security Considerations`
heading at line 181 untouched.

**Part B. ROADMAP.md. Replace exactly one paragraph.**

Replace lines 2102 to 2109. That block opens with "**This per-phase table is
load-bearing, not decorative.**" and ends with "in a milestone archive." It sits
between the `## Progress` heading and the table header row. Replace nothing else
in this file.

The replacement paragraph must do three things:

1. Instruct a reader to KEEP the per-phase table and its column order. Every row
   stays. The cut and dissolved rows stay, which are `6.`, `20.`, `21.`, `22.`
   and `25.`.
2. Give the accurate reason, per correction C1 above. The live table is the only
   current and complete per-phase record. The archived
   `milestones/v0.*-ROADMAP.md` copies are cumulative snapshots frozen at their
   own close. The newest one, `v0.9.0`, stops at 47 phase rows and carries
   nothing for Phases 45 to 56. A collapse of the live table would leave the
   newest phases with no per-phase record. It would also force a reader to
   rebuild history from seven frozen snapshots. Do NOT write that cut phases
   "exist nowhere else". The planner measured that claim as false.
3. State that convention now maintains the table, and that no mechanism enforces
   it. Name where the enforcement went. Commit `276c15c9` deleted the former
   consumer, `comment-phase-pointers.test.ts`.

The replacement paragraph must NOT claim that some other test enforces the
table. No test does, per B10. State plainly that no test reads the table today.

**Part C. Two things to leave alone.**

Leave the archived copies untouched. The seven `.planning/milestones/v0.*-ROADMAP.md`
files record what each milestone said at its own time. All seven stay
byte-identical.

Leave the v0.9.0 footnote below the table untouched, per correction C2. It
records a decision taken on 2026-09-10 and was true then. Keep it
byte-identical. Record in the SUMMARY that you read it, judged it historical
rather than stale, and left it by decision. Name it in the SUMMARY so a later
reader does not count it as a miss.

Do not change the ROADMAP phase list. Do not change the requirements. Do not
change any plan checkbox. Do not change any Progress table row.
  </action>
  <verify>
    <automated>test "$(sed -n '/^## Progress/,$p' .planning/ROADMAP.md | grep -c '^| [0-9]')" -eq 60 && grep -q '276c15c9' .planning/ROADMAP.md && grep -q 'd8ed053e' .planning/codebase/CONCERNS.md && test -z "$(git status --porcelain .planning/milestones/)" && test "$(git status --porcelain src/ scripts/ installer/ .github/ | wc -l)" -eq 0</automated>
  </verify>
  <done>The CONCERNS entry carries the word resolved, the date 2026-09-15, and the hash `d8ed053e`. The ROADMAP paragraph above the table names `276c15c9`. It keeps the table for an accurate reason. It states that no test reads the table today. All 60 Progress rows survive. The seven archived milestone ROADMAPs are unchanged. Every path under `src/`, `scripts/`, `installer/` and `.github/` is unchanged.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none crossed | This plan reads and writes Markdown under `.planning/` only. It also deletes untracked empty directories under `.planning/`. It opens no network connection. It spawns no process. It reads no untrusted input. It changes no source code. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-Q260915-01 | Denial of Service | Task 1's directory deletion | high | mitigate | A `find -type f` emptiness check gates every single deletion. The executor skips and reports any non-empty directory. Deletion covers paths that match `.planning/vice-proxy-evidence-test-*` only. The action text forbids a broad recursive deletion above `.planning/`. |
| T-Q260915-02 | Tampering | `.planning/STATE.md`, 411 KB, hand-maintained | medium | mitigate | The task makes two targeted line edits only. It forbids a whole-file read. It forbids a whole-file rewrite. It forbids the `gsd-tools` `state.*` verbs, which reflow prose. The verify gate asserts the slug count is exactly 3, so a wider edit fails. |
| T-Q260915-03 | Repudiation | The retired todo and the CONCERNS entry | medium | mitigate | The executor records the closure reason INSIDE the moved file and inside the rewritten entry. Both cite `d8ed053e`. A silent closure would lose the reason. The verify gate greps for that hash. |
| T-Q260915-04 | Tampering | `.planning/milestones/v0.*-ROADMAP.md`, 7 historical records | medium | mitigate | Task 3 puts these files out of scope in its action text. The verify gate asserts that `git status --porcelain .planning/milestones/` prints nothing. |
| T-Q260915-05 | Information Disclosure | The ROADMAP replacement paragraph | low | accept | The paragraph is repository-internal process guidance. It holds no secret. Accepted with no mitigation. |
| T-Q260915-SC | Tampering | npm, pip and cargo installs | high | accept | This plan holds no package-manager install task. It adds no dependency. The package-legitimacy gate therefore has no input. Accepted as not applicable, rather than skipped in silence. |
</threat_model>

<verification>
Filesystem checks and grep checks only. The task constraints state that no
test-suite run is required or useful here. No file under `src/` changes, so the
suite cannot observe this work. Do not add a suite run.

1. `find .planning -maxdepth 1 -name 'vice-proxy-evidence-test-*' | wc -l` returns `0`
2. `ls .planning/todos/pending/*.md | wc -l` returns `14`
3. `ls .planning/todos/completed/2026-09-13-vice-proxy-test-leaks-scratch-dirs-into-planning-root.md` finds the file
4. `grep -c 'vice-proxy-test-leaks-scratch-dirs-into-planning-root' .planning/STATE.md` returns `3`
5. `sed -n '/^## Progress/,$p' .planning/ROADMAP.md | grep -c '^| [0-9]'` returns `60`
6. `git status --porcelain src/ scripts/ installer/ .github/` prints nothing
7. `git status --porcelain .planning/milestones/` prints nothing
8. `git status --porcelain` lists the four intended paths only, as one rename
   and three modifications. It also lists whatever was already dirty before this
   task started. Snapshot that pre-existing dirty set first. The tree carried
   unrelated modifications at planning time.
</verification>

<success_criteria>
- Zero `vice-proxy-evidence-test-*` directories remain under `.planning/`. The
  executor checked each one as empty immediately before it deleted that one.
- The todo sits in `completed/`. Its original body is intact. Its `## Resolution`
  section names `d8ed053e`. It names all three now-moot remedies. It states that
  nobody added the pattern to `.gitignore`, and why.
- STATE.md's Deferred Items table holds no `Pending` row for the retired todo.
  Its ledger preamble reads 14 open.
- The CONCERNS entry reads as resolved and carries the date 2026-09-15. It states
  that its own recorded `Trigger` and `Files` pointer are historical.
- The ROADMAP paragraph keeps the table for an accurate reason. It names
  `276c15c9` as the commit that deleted the former mechanical consumer. It claims
  no replacement guard.
- All 60 Progress rows are unchanged. All seven archived milestone ROADMAPs are
  unchanged.
- No file under `src/`, `scripts/`, `installer/` or `.github/` changed.
- The SUMMARY records two deliberate non-goals. The first is the already-wrong
  "10 pending" line in STATE.md's `### Pending Todos` section. The second is the
  v0.9.0 close footnote below the Progress table.
</success_criteria>

<output>
Create `.planning/quick/260915-hwe-retire-two-stale-planning-records-delete/260915-hwe-SUMMARY.md` when done.
</output>
