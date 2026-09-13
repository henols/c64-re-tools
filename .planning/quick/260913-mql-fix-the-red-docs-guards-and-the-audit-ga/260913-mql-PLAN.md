---
phase: quick-260913-mql
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/STATE.md
  - .planning/todos/pending/2026-09-13-vice-proxy-test-leaks-scratch-dirs-into-planning-root.md
  - .planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/49-REVIEW-FIX.md
  - src/mcp/vice/requirement-ids.ts
  - src/mcp/vice/anno-register.test.ts
  - src/mcp/vice/anno-import.test.ts
  - scripts/audit-gate.mjs
  - src/mcp/vice/audit-integrity.test.ts
autonomous: true
requirements: [QUICK-260913-mql]

estimate:
  tokens: 85000
  raw_tokens: 58000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "`node --test src/mcp/vice/docs-deferred-ledger.test.ts` exits 0. Both of its previously-red cases are green, including the planted-violation case whose whole point is that the REAL text is reported by neither predicate."
    - "`node --test src/mcp/vice/docs-review-disposition.test.ts` exits 0, with phase 49's CR-01 dispositioned through a source that guard already recognises — not through a new source added to the guard."
    - "`node --test src/mcp/vice/anno-register.test.ts` and `node --test src/mcp/vice/anno-import.test.ts` each exit 0, and a fabricated requirement id is STILL reported as undeclared. The membership check got wider on a measured basis, not weaker."
    - "Exactly ONE resolver decides whether a cited requirement id is real. Neither test file hand-rolls a second one."
    - "`node scripts/audit-gate.mjs --root . --json` reports `allowed: true` and an EMPTY `redGuards` array — because every guard is genuinely green, not because the reporting is vague."
    - "The gate attributes redness to the specific guard FILE that failed. On a synthetic tree where exactly one of N guard files fails, `redGuards` has exactly one member and it is that file."
    - "The attribution regression test was proven RED against the pre-fix logic before the fix landed, and the proof is recorded in the SUMMARY."
    - "The gate's three load-bearing design properties survive untouched: the guard set is still DERIVED from a directory read, the non-vacuity floor is unchanged, and behaviour once a call is in scope is still fail-CLOSED."
    - "Running all ten guards still fits inside the hook's 30-second PreToolUse budget, by a bound the code enforces rather than by luck."
    - "No docs guard was narrowed, excluded, weakened or given a new exemption anywhere in this task."
    - "The measured suite result after the task is compared member-by-member against the measured baseline captured before it; the 9 opt-in environment skips are still skips."
    - "Three separate atomic commits exist, one per root cause, each revertible alone."
  artifacts:
    - .planning/STATE.md
    - .planning/todos/pending/2026-09-13-vice-proxy-test-leaks-scratch-dirs-into-planning-root.md
    - .planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/49-REVIEW-FIX.md
    - src/mcp/vice/requirement-ids.ts
    - scripts/audit-gate.mjs
    - src/mcp/vice/audit-integrity.test.ts
  key_links:
    - "Each new Deferred Items table row <-> a file that actually exists under `.planning/todos/pending/` AND is tracked by git, so the ledger reads identically on a fresh clone and in CI."
    - "The 49-REVIEW-FIX.md disposition entry <-> commit 29d4c467, which is what actually removed both citations CR-01 named; the record cites the commit rather than asserting a fix."
    - "The single requirement-id resolver <-> both `anno-register.test.ts`'s DIRECTION 5 and `anno-import.test.ts`'s register-surface test, which import it rather than re-deriving it."
    - "`redGuards` <-> the exit status of that guard file's OWN subprocess run; attribution no longer depends on parsing the test runner's output format at all."
    - "The per-file spawn loop's TOTAL time budget <-> the 30-second PreToolUse timeout in `.claude/settings.json`, which the hook path shares."
---

<objective>
Make the test suite genuinely green ahead of a 479-commit push that CI has never
seen, by fixing three real defects and one reporting defect that has been
misleading every reader of the audit gate.

Purpose: local `main` is 479 commits ahead of `origin/main`; the last commit CI
observed is `a3c0d21d` and the five most recent CI runs all concluded `failure`.
CI runs the FULL `*.test.*` glob with no `continue-on-error`, and every merge to
`main` auto-publishes a patch version. The target is a green suite, not a
tidier report.

Output: three atomic commits — a STATE.md ledger reconciliation plus a phase-49
review disposition; a single requirement-id resolver replacing two stale reads;
and per-file attribution in `scripts/audit-gate.mjs` with a regression test that
is red against today's logic.
</objective>

<execution_context>
@/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/workflows/execute-plan.md
@/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@scripts/audit-gate.mjs

Read `scripts/audit-gate.mjs`'s header BEFORE editing it. It records three
deliberate design decisions that must survive this change: a guard set derived
from a directory read (never a hand-typed second list), a non-vacuity floor, and
fail-CLOSED behaviour once a hook call is in scope. It also forbids, by name, a
waiver file or an environment-variable relaxation hatch. None of those are
touched by anything below.

`.planning/STATE.md` is 380 KB. Do NOT read it whole — it will blow the context
budget. Locate each edit site with `grep -n`, read only that range with
`sed -n '<a>,<b>p'`, and change it with an exact-string `Edit`.

Do NOT route any STATE.md change through a `gsd_run query state.*` verb. Those
verbs are known to flatten Current Position prose, delete standalone `NONE`
tokens anywhere in the file, and re-serialize YAML in a way that empties block
scalars. Edit the file directly and `git diff` the result before committing.
</context>

<measured_baseline>
Everything in this block was measured live at planning time, on this tree, and
supersedes the orchestrator's brief wherever the two disagree. Re-confirm
anything a task depends on; do not take a number here on faith if the task's own
verification can produce it.

**The 7 failures decompose 2 / 1 / 3 / 1, not 2 / 1 / 2 / 1.**

- **A — `docs-deferred-ledger.test.ts`, 2 failures.** Direction A names **TWO**
  pending todos with no Deferred Items row, not one:
  `capability-registry-manifest-claim-stale` (tracked) and
  `2026-09-13-vice-proxy-test-leaks-scratch-dirs-into-planning-root`
  (**untracked** — it is in `git status` as `??`). The file's planted-violation
  case fails on the same two stems, because it asserts the REAL text is clean.
- **B — `docs-review-disposition.test.ts`, 1 failure.** Exactly
  `49-REVIEW.md: CR-01`. **Its substance is already fixed**: CR-01 named
  `acme-verify.ts:413` (a bare `plan 49-03` citation) and
  `acme-verify.test.ts:811` (a bare `D47-D` id), and commit `29d4c467`
  ("state the mechanism instead of citing planning vocabulary") removed both.
  Verified by reading the current lines. What is missing is only the RECORD.
- **C — `anno-import.test.ts` 1 + `anno-register.test.ts` 2 = 3 failures.** The
  brief said "one requirement id". It is **eleven**, across **ten verbs**,
  producing **fifteen** basis problems: `STORE-01`, `STORE-04`, `STORE-06`,
  `MCP-04`, `IMP-01`, `IMP-02`, `AUTO-01`, `EVID-01`, `EVID-03`, `EVID-04`,
  `EVID-05`. `anno-register.test.ts`'s second failure — "planted violation (the
  negative control)" — is the same cause: its CLEAN synthetic fixture cites
  `STORE-06`.
- **D — `audit-integrity.test.ts`, 1 failure.** See the mechanism below.

**Which side of C is wrong — measured, not inferred.** Neither the citations
nor the live requirements document. All eleven ids are REAL, were declared in
`**BOLD**` form, and are archived under `.planning/milestones/`:
`STORE-04`/`STORE-06`/`MCP-04` in `v0.7.0-REQUIREMENTS.md`, `STORE-01` and
`AUTO-01` in `v0.7.0` and `v0.8.0`, `IMP-01`/`IMP-02` in `v0.8.0`,
`EVID-01`/`EVID-03`/`EVID-04`/`EVID-05` in `v0.9.0`. `/gsd-complete-milestone`
archives the live document and removes it at each close, so **a correct tree
goes red purely because a milestone rotated**. Inventing a requirement or
rewriting a citation would both be falsifications. The defect is the RESOLVER.

`anno-register.test.ts:76`'s `requirementsPath()` already half-anticipated this
— but its fallback fires only when the live file is ABSENT, and then takes the
lexicographic-max archive only. Measured: parsing `**FAMILY-NN**` out of the
live file UNION all seven archived `v*-REQUIREMENTS.md` yields **243** ids and
covers all eleven. The negative fixture `NOPE-99` is in none of them, so the
anti-rubber-stamp property survives intact.

`anno-import.test.ts:353` is a second, weaker copy of the same property: a bare
`readFileSync(...).includes(reqId)` against the live file only, with no archive
awareness at all.

**D's mechanism — the gate's own stated premise is FALSE on this runner.**
`parseRedGuardNames()` (`audit-gate.mjs:437`) claims:

> "When `node --test` is invoked with multiple file arguments, each file
> surfaces as its own top-level (column-zero) test, so a top-level `not ok`
> line whose name matches one of the guard basenames identifies exactly which
> file broke."

Measured on Node v24.20.0, two ways:

1. The default reporter is now **spec**, not TAP, even when stdout is a pipe.
   The captured `stdout` contains zero `^not ok ` lines and zero
   `^# Subtest: ` lines, so BOTH parse attempts find nothing and the function
   falls through to `return [...guardFiles]` — every guard named red. That
   fallback is not a rare safety net; it is the permanent code path.
2. Forcing `--test-reporter=tap` does NOT fix it. Under TAP the column-zero
   entries are the individual **test names**, flattened across all files. No
   per-file top-level subtest exists at all. `guardFiles.includes(candidate)`
   can therefore never match under either reporter.

So attribution by output parsing is structurally impossible with a single
multi-file spawn. Measured alternative: ten separate one-file spawns cost
**1.697 s wall total** and give exact verdicts —
`docs-deferred-ledger.test.ts=1`, `docs-review-disposition.test.ts=1`, and
**0 for the other eight**. `GUARD_RUN_TIMEOUT_MS` is 15000 and the
PreToolUse hook timeout in `.claude/settings.json` is 30 seconds.

**Scope decision, stated plainly: D IS IN SCOPE.** Fixing A and B alone makes
D-12-02 pass incidentally while leaving the reporting defect latent to mislead
the next reader exactly as it misled this investigation's first pass. It gets
its own task and its own commit.

**Live-observation authority.** The file/line scope authorized below rests on
the reads above. If a task finds the tree has moved — a line no longer says
what this block says, a stem list differs, a failure count differs — STOP,
re-measure, and record the divergence in the SUMMARY rather than forcing the
written scope.
</measured_baseline>

<tasks>

<task type="auto">
  <name>Task 1: Close the two genuinely-red docs guards — the ledger row gap and the undispositioned review finding</name>
  <files>.planning/STATE.md, .planning/todos/pending/2026-09-13-vice-proxy-test-leaks-scratch-dirs-into-planning-root.md, .planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/49-REVIEW-FIX.md</files>
  <precondition>No VICE broker is running. A live broker deterministically reddens one test in the wider suite this plan later measures; `ls .c64-re-tools/supervisor/` was empty at planning time. Confirm before the final verification, and stop any broker found.</precondition>
  <action>
TWO SEPARATE COMMITS. Do not combine them — each root cause must be revertible
alone.

**Commit 1 of 2 — the Deferred Items ledger (root cause A).**

First re-derive the ground truth rather than trusting this plan:
`ls .planning/todos/pending/*.md` and
`node --test src/mcp/vice/docs-deferred-ledger.test.ts`. The assertion names
exactly which stems lack a row.

The guard keys on a stem appearing as its OWN Markdown table cell — the regex
is `\|\s*<stem>\s*\|` — so a mention in prose does not satisfy it and a row
whose Item cell carries a trailing `.md` does not either. The live Pending
table is the FIRST table under `## Deferred Items` (locate it with
`grep -n '^## Deferred Items' .planning/STATE.md`, then read forward with
`sed -n`); it currently carries 8 rows under the header
`| Category | Item | Priority | Status |`.

Add one row per missing stem, with the Item cell holding the bare stem and no
extension. Take each row's Priority from the todo file's own frontmatter, and
choose each Category from the values already present in this table's Pending
rows; if genuinely none fits, add a new value and say why in the commit
message rather than forcing a wrong one. The vice-proxy scratch-dir todo
declares `area: testing` and `severity: minor` in its own frontmatter — use
those. The capability-registry todo declares `priority: low`, which this
table spells `minor`.

`git add` the untracked todo file
`.planning/todos/pending/2026-09-13-vice-proxy-test-leaks-scratch-dirs-into-planning-root.md`
IN THIS SAME COMMIT. A row whose file is untracked would make the ledger read
differently on a fresh clone than it does here, which is the class of defect
this guard exists to catch, in the other direction.

Then reconcile the two live count claims that the added rows falsify. Both are
already wrong before this change, so leaving them is not neutral — it leaves a
self-contradicting document. Find them with
`grep -n 'Deferred Items ledger below reads' .planning/STATE.md` and
`grep -n 'pending (.* files in' .planning/STATE.md`. Recompute each figure
by COUNTING the tree (`ls .planning/todos/pending/*.md | wc -l`), never by
arithmetic on the stale figure — that instruction is the one the second of
those two sentences gives itself, and it is the right one. Adjust the
surrounding clause so the sentence stays true as prose, not just true as a
number. Leave every historical/superseded count elsewhere in the file alone:
those are dated records, and rewriting them would destroy the history the
section explicitly preserves.

Do not touch the `## Deferred Items` carried-forward tables, the `uat_gaps`
rows, or any `quick_tasks` row — the guard's own header states those
deliberately do not correspond to files in `.planning/todos/`.

**Commit 2 of 2 — the phase 49 review disposition (root cause B).**

`docs-review-disposition.test.ts` recognises five disposition sources and
REVIEW.md itself is not one of them. The applicable source here is the
established `*-REVIEW-FIX.md` convention in the phase's own directory (the
shape `02-REVIEW-FIX.md` and `07-REVIEW-FIX.md` already use). Phase 49's
directory has no such file yet.

Create
`.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/49-REVIEW-FIX.md`
recording CR-01's disposition. Before writing a word of it, VERIFY the finding's
current state yourself rather than copying this plan's claim: read
`49-REVIEW.md`'s CR-01 section, read the two lines it names
(`src/mcp/vice/acme-verify.ts` around 413 and
`src/mcp/vice/acme-verify.test.ts` around 811), and inspect commit `29d4c467`.

Write what you actually find. The finding as measured at planning time was
already fixed by that commit, so the honest disposition is "fixed, in commit
29d4c467, before this record was written" — and the record should say plainly
that the gap was the RECORD, not the code, because that is the lesson a later
reader needs. If you find either citation still present, fix it instead (state
the mechanism in place of the citation, exactly as that commit did) and record
the disposition against your own commit.

Do NOT broaden the disposition to the other planning-vocabulary citations that
survive elsewhere in those two files. CR-01 scoped itself explicitly to
citations this phase's own commits freshly introduced; the older ones are a
different question and are not this task's.

State the guard's own mechanism in the file so it is self-explaining: this
document is a recognised disposition source, which is why the record lives here
rather than as an annotation inside `49-REVIEW.md`.

Verify after each commit that the corresponding guard is green, and confirm the
OTHER one did not regress.
  </action>
  <verify>
    <automated>cd /home/henrik/dev/henrik/git/c64-re-tools && node --test src/mcp/vice/docs-deferred-ledger.test.ts && node --test src/mcp/vice/docs-review-disposition.test.ts</automated>
    <automated>cd /home/henrik/dev/henrik/git/c64-re-tools && test "$(ls .planning/todos/pending/*.md | wc -l)" = "$(git ls-files .planning/todos/pending/ | wc -l)"</automated>
  </verify>
  <done>
Both guard files exit 0. Every pending todo on disk has its own table cell in
STATE.md's Deferred Items Pending table, every pending todo is tracked by git,
the two live count claims agree with a fresh count of the tree, and phase 49's
CR-01 has a disposition in a source the guard already recognises. Two commits
exist, each revertible alone.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: One resolver for "is this requirement id real", spanning the milestone archive</name>
  <files>src/mcp/vice/requirement-ids.ts, src/mcp/vice/anno-register.test.ts, src/mcp/vice/anno-import.test.ts</files>
  <behavior>
    - Every one of the eleven ids currently reported undeclared resolves: STORE-01, STORE-04, STORE-06, MCP-04, IMP-01, IMP-02, AUTO-01, EVID-01, EVID-03, EVID-04, EVID-05.
    - A fabricated id (`NOPE-99`, the existing planted fixture) is STILL reported undeclared. Widening must not make the check vacuous.
    - The resolved set is non-vacuous and derived from disk: it clears a floor, and it fails loudly if it ever parses to nothing rather than passing over an empty set.
    - The resolver still works when the live `.planning/REQUIREMENTS.md` is absent, which is a designed state between a milestone close and the next open.
    - `anno-register.test.ts`'s DIRECTION 5 reports zero basis problems; its negative-control test reports zero.
    - `anno-import.test.ts`'s register-surface test passes for both `anno_import_ghidra_export` and `anno_join_memmap`.
  </behavior>
  <action>
The fix is the RESOLVER, and the basis is measured: the cited ids are real and
archived, the live document legitimately no longer carries them because the
milestone rotated. Do NOT add any of these ids to `.planning/REQUIREMENTS.md`
(they belong to closed milestones and are already marked Complete there), and do
NOT rewrite any citation in `anno-register.ts` (a verb's basis is the
requirement it actually implements).

Re-confirm the basis before coding: run both test files, and check each reported
id against `.planning/milestones/v*-REQUIREMENTS.md`. If any id resolves NOWHERE
— live or archived — that one is a genuinely fabricated citation and a different
problem; stop and report it rather than widening the set to swallow it.

Create `src/mcp/vice/requirement-ids.ts` — a small, dependency-free module
exporting one function that returns the set of declared requirement ids, built
by parsing bold `**FAMILY-NN**` declarations out of the live
`.planning/REQUIREMENTS.md` when present UNION every
`.planning/milestones/v*-REQUIREMENTS.md`. Also return the list of documents it
actually read, so a caller can put that in an assertion message instead of
naming a single path that is no longer the whole truth. Take the repository root
as an explicit argument rather than resolving it internally, matching the
project's existing convention for path-taking helpers.

Throw — loudly, naming both locations — when NO requirements document is found
at all. An absent set would make every membership check vacuous, which is the
failure this whole register exists to prevent.

Then remove both existing derivations and point them at the new module:

- In `anno-register.test.ts`, `requirementsPath()` (around :76), the
  `REQUIREMENTS_PATH` constant (:92) and the parse inside
  `declaredRequirementIds()` (:216) are all replaced by a call into the new
  module. Keep `declaredRequirementIds`'s exported-to-the-file shape and its
  optional-argument form so the planted-violation tests that pass a set in
  keep working unchanged.
- In `anno-import.test.ts`, the bare `readFileSync(... "REQUIREMENTS.md")` at
  :353 and the `requirementsText.includes(reqId)` assertion at :364 are
  replaced by a set-membership check against the same resolver. This is the
  second, weaker copy of a property `anno-register.test.ts` owns; after this
  change there is exactly one derivation and two consumers.

Update every assertion MESSAGE that currently names `.planning/REQUIREMENTS.md`
as the sole authority — `basisProblems()`'s "NOT declared in
.planning/REQUIREMENTS.md" text (around :261) and DIRECTION 5's non-vacuity
message (around :387). After this change the authority is the live document plus
the milestone archive, and a message that names only one of them sends the next
maintainer to the wrong file. Keep the message's teaching half intact: a
plausible-looking id that nothing declares is the rubber stamp this register
exists to prevent.

Record the mechanism in the new module's header, in this codebase's house style:
WHY the file exists (a correct tree went red because a milestone close archives
the live requirements document and removes it, so ids from closed milestones
stopped resolving), what it is the ONE authoritative place for, and what NOT to
do — specifically, that relaxing the membership check to a SHAPE check is
forbidden, because the whole basis of the register is that a cited id is a real
one. That prohibition is already stated in `anno-register.test.ts`'s own header;
do not let this change quietly become the thing it warns against.

CLAUDE.md's planning-vocabulary rule binds all three of these files: they live
under `src/`. State mechanisms, not plan numbers and not bare `D-NN` ids. The
one permitted citation form is a decision id that resolves outside `.planning/`
with its document named.

Two constraints on the new module, both already checked against this tree:
it must NOT be added to `src/mcp/vice/package.json`'s `files[]` (it reads the
planning tree and must not ship), and it joins
`assumption-label-discipline.test.ts`'s automatic scan of every non-test source
file — which is inert unless the header uses an `[ASSUMED]` label, so simply do
not use one.
  </action>
  <verify>
    <automated>cd /home/henrik/dev/henrik/git/c64-re-tools && node --test src/mcp/vice/anno-register.test.ts && node --test src/mcp/vice/anno-import.test.ts</automated>
    <automated>cd /home/henrik/dev/henrik/git/c64-re-tools && node -e 'const f=require("./src/mcp/vice/package.json").files; if (f.includes("requirement-ids.ts")) { console.error("requirement-ids.ts must not ship"); process.exit(1); } console.log("not shipped: ok")'</automated>
    <automated>cd /home/henrik/dev/henrik/git/c64-re-tools && node --test src/mcp/vice/module-classification.test.ts src/mcp/vice/assumption-label-discipline.test.ts src/mcp/vice/shipped-modules.test.ts src/mcp/vice/spawn-seam.test.ts</automated>
  </verify>
  <done>
Both anno test files exit 0. Exactly one derivation of the declared-id set
exists in the tree. The planted `NOPE-99` fixture is still reported undeclared,
proving the check kept its bite. The new module is absent from `files[]`, and
the four census guards most likely to notice a new source module are green.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Attribute redness to the guard file that actually failed</name>
  <files>src/mcp/vice/audit-integrity.test.ts, scripts/audit-gate.mjs</files>
  <reversibility rating="reversible">Replaces one multi-file subprocess with a bounded per-file loop inside a single function; the exported surface, the derived guard set and the fail-closed verdict are all unchanged, so reverting is a straight revert of one commit.</reversibility>
  <behavior>
    - RED FIRST: on a synthetic tree built with exactly one of N guard files failing, `redGuards` contains exactly one member and it is that file's basename. Against today's logic this reports every guard and FAILS. Add this test and watch it fail BEFORE writing the fix; record the failure output in the SUMMARY.
    - On the real tree with every guard green, `redGuards` is empty and `allowed` is true.
    - The existing planted-violation test still passes: the refusal reason names the offending guard's basename AND quotes that guard's own planted assertion text.
    - The existing structural tests still pass: an empty or short guard set is still a loud structural failure, and the runtime registry is still compared against the disk-derived set.
    - A guard that exceeds its time budget is still treated as RED, never as green and never as a hang.
  </behavior>
  <action>
Read `scripts/audit-gate.mjs`'s header first. Three properties are
non-negotiable and none of them is what this task changes: the guard set stays
DERIVED from `docsGuardFiles()`'s directory read, `DOCS_GUARD_FLOOR` and
`EXPECTED_DOCS_GUARD_NAMES` are untouched, and the hook stays fail-CLOSED once a
call is in scope. Adding a waiver, an env-var hatch, or a second hand-typed
guard list is forbidden by that header by name.

Confirm the defect yourself before fixing it: run
`node scripts/audit-gate.mjs --root . --json` and look at `redGuards` against
the per-file truth from running each `docs-*.test.ts` separately. Then confirm
the MECHANISM, because it is not the one the brief guessed — it is not a
timeout, and it is not an attribution loop crediting a failure to every file.
`parseRedGuardNames()` finds zero parseable lines and falls through to its
`return [...guardFiles]` fallback. That function's header states, as fact, that
each file surfaces as its own column-zero test. Check it: that premise does not
hold on this runner under the default reporter, and forcing
`--test-reporter=tap` does not restore it either — the column-zero TAP entries
are individual test names, flattened across files, with no per-file entry at
all. Attribution by output parsing is therefore structurally unavailable here,
not merely broken.

**Step 1 — the failing test, first.** Add the regression case to
`audit-integrity.test.ts`. `buildSyntheticTree()` already supports exactly what
is needed: `redGuardIndex` plants one red guard among otherwise-green ones, and
`plantedGuardBody()` gives each a distinguishable assertion. Assert that
`redGuards` equals the single expected basename — deep equality on the array,
not a `length >= 1` floor, because a floor is precisely what let the
all-guards-red fallback look correct. Pick a `redGuardIndex` other than 0 so the
test cannot pass by coincidence with the first-element assertion the existing
planted-violation test already makes. Run it. It MUST fail, and the failure must
show every guard named. Capture that output — it is the proof of
non-vacuity this task owes.

**Step 2 — the fix.** Change `runGuardsLive()` to spawn ONE subprocess PER guard
file and take each file's verdict from its OWN exit status. Attribution then
needs no output parsing whatsoever.

Constraints on the loop:

- The argv stays an ARRAY, still built exclusively from `docsGuardFiles()`'s
  return value — never a shell string, never anything derived from CLI argv,
  stdin, or scanned document text. That is a stated threat control, not a style
  preference.
- Keep `NODE_TEST_*` stripped from the child environment, for the reason the
  existing comment records: an inherited test context silently switches the
  nested runner's reporter to an IPC protocol and a genuinely failing guard
  comes back looking like it produced no output at all.
- Keep `runGuardsLive`'s existing `{ status, stdout, stderr }` return shape so
  no caller breaks, and ADD a per-file record carrying each file's own name and
  status. Aggregate `status` is 0 only when every file's is 0. Aggregate stdout
  concatenates every file's output, each preceded by a marker line naming the
  file it came from — a superset of what a caller sees today, so the refusal
  reason can still quote the failing assertion text verbatim.
- **Budget.** Ten sequential 15-second timeouts would allow 150 s, blowing the
  30-second PreToolUse budget the existing timeout comment was explicitly chosen
  to sit under. Make `GUARD_RUN_TIMEOUT_MS` a TOTAL budget for the whole loop:
  give each spawn only the time remaining, and when the budget is exhausted mark
  every not-yet-run guard RED with an explicit reason saying it was not run
  because the budget was exhausted. Fail-CLOSED, and the 30-second contract
  holds by construction rather than by measurement. Measured headroom: all ten
  guards complete in about 1.7 s.
- Delete `parseRedGuardNames()` and derive `redGuards` from the per-file
  statuses in both `checkAuditGate()` and `hookGuardVerdict()`. Neither may grow
  its own copy of the derivation — the header's one-seam rule applies to this as
  much as to the guard list.

Replace that function's now-falsified header comment with what was actually
measured: the runner does not surface a per-file top-level entry under either
reporter, so a verdict is read from each file's own exit status instead. Say
plainly that the previous fallback made every run report every guard red, and
that this is what a whole investigation misread. Follow the file's existing
citation idiom — it is not a shipped source file and its header already cites
decision and review ids that way.

Keep the `reason` string's structure intact: the red guard names, the failing
assertion text, and the two legitimate routes (fix the documents, or change or
retire the guard in a commit).

Commit this as the third and final atomic commit.

**Step 3 — the real-tree check.** Only after Tasks 1 and 2 have landed should
`node scripts/audit-gate.mjs --root . --json` report `allowed: true` with an
EMPTY `redGuards`. An empty array is now a real claim rather than a vague one:
it means every one of the ten guard files exited 0 on its own.
  </action>
  <verify>
    <automated>cd /home/henrik/dev/henrik/git/c64-re-tools && node --test src/mcp/vice/audit-integrity.test.ts</automated>
    <automated>cd /home/henrik/dev/henrik/git/c64-re-tools && node scripts/audit-gate.mjs --root . --json > /tmp/mql-gate.json; echo "gate exit=$?"; node -e 'const j=require("/tmp/mql-gate.json"); if (j.allowed !== true) { console.error("allowed is not true:", j.reason); process.exit(1); } if (j.redGuards.length !== 0) { console.error("redGuards not empty:", j.redGuards); process.exit(1); } if (j.structuralErrors.length !== 0) { console.error("structural errors:", j.structuralErrors); process.exit(1); } console.log("gate clean, guards:", j.guardFiles.length)'</automated>
    <automated>cd /home/henrik/dev/henrik/git/c64-re-tools && for f in $(ls src/mcp/vice/docs-*.test.ts); do node --test "$f" > /dev/null 2>&1 || echo "RED: $f"; done; echo "per-file sweep done"</automated>
  </verify>
  <done>
The new attribution test was demonstrated RED against the pre-fix logic and is
GREEN after. `audit-integrity.test.ts` exits 0 in full. The gate reports
`allowed: true`, `redGuards: []` and no structural errors on the real tree, and
an independent per-file sweep agrees that no `docs-*.test.ts` is red. The
derived guard set, the non-vacuity floor and the fail-closed verdict are
unchanged, and the whole guard run still fits inside a bound the code enforces.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| hook stdin → `audit-gate.mjs --hook` | An arbitrary tool payload crosses here on every Write/Edit/Bash call in this repo. Untouched by this plan, but the file it enters is edited by Task 3. |
| `audit-gate.mjs` → guard subprocess | An argv array crosses into `spawnSync`. Task 3 changes how many times this crossing happens. |
| planning tree → test assertions | Task 2 widens which documents a test treats as authoritative for "this id is real". |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-mql-01 | Tampering | `runGuardsLive()`'s per-file `spawnSync` | high | mitigate | argv stays an ARRAY built only from `docsGuardFiles()`'s directory read — never a shell string, never anything derived from CLI argv, stdin or scanned document text. Task 3's action states this as a hard constraint and `spawn-seam.test.ts` runs in Task 2's verify. |
| T-mql-02 | Denial of Service | the `--hook` path, wired live to every Write/Edit/Bash | medium | mitigate | Ten sequential spawns must not multiply the time budget. `GUARD_RUN_TIMEOUT_MS` becomes a TOTAL budget for the loop, with unrun guards marked red on exhaustion, so the 30 s PreToolUse contract holds by construction. Measured actual: 1.7 s. |
| T-mql-03 | Repudiation | the STATE.md Deferred Items ledger | medium | mitigate | A row is only added alongside a file that exists AND is tracked by git; the untracked todo is `git add`ed in the same commit, and Task 1's second verify asserts the on-disk and tracked counts are equal. |
| T-mql-04 | Tampering | the widened requirement-id membership check | high | mitigate | Widening is justified per-id against the archive before coding, the planted `NOPE-99` fixture must still be reported, and a shape-check relaxation is prohibited by name in the new module's header. |
| T-mql-05 | Information Disclosure | `requirement-ids.ts` reading the planning tree | low | mitigate | The module is excluded from `package.json`'s `files[]`, asserted directly in Task 2's verify, so no planning-tree reader ships in either npm tarball. |
| T-mql-SC | Tampering | npm/pip/cargo installs | — | n/a | This plan installs no package and adds no dependency. The package-legitimacy gate is not engaged; no `[ASSUMED]`/`[SUS]` checkpoint is required. |
</threat_model>

<verification>
**Verification strategy, decided deliberately rather than defaulted.** CI runs
`npm test` — the FULL `*.test.*` glob — which hangs locally on
`vice-proxy.test.ts`. `npm run test:automated` is bounded but excludes a
12-entry `MANUAL_ONLY_TESTS` list, so it alone does NOT generalise to what CI
runs. Cover both halves:

1. **Capture the baseline BEFORE any edit in this plan.** From `src/mcp/vice`:
   `npm run test:automated > /tmp/mql-before.txt 2>&1; echo "EXIT=$?"` — status
   read on the SAME line. Never pipe into `tail` or `head`: a pipe reports the
   pipe's status and fakes a green baseline. Record the failure COUNT, the
   failing test NAMES, and the SKIPPED SET as a set of names, not a number.
   Expected from planning-time measurement: 7 failures, 9 skips, ~4392 tests.
2. **Re-run the same command after all three commits** and compare
   member-by-member against the baseline. The target is zero failures. The 9
   skips are opt-in environment gates (Ghidra, live VICE, upstream clone) and
   must remain SKIPS — a skip that became a failure is a regression, not
   progress.
3. **Measure the CI delta the automated gate hides.** Run each of the 12
   `MANUAL_ONLY_TESTS` files individually, under an explicit shell `timeout`, and
   record pass / fail / timed-out for each:
   `vice-broker-launch.test.ts`, `vice-proxy.test.ts`, `broker-e2e.test.ts`,
   `stock-live.test.ts`, `stock-live-triage.test.ts`,
   `stock-live-broker-monitor.test.ts`, `stock-broker-live.test.ts`,
   `stock-a4-checkpoint-flood.test.ts`, `dxa-live.test.ts`,
   `ghidra-live.test.ts`, `ghidra-opcode-live.test.ts`,
   `text-monitor-live.test.ts`. This is the set CI runs and `test:automated`
   does not. `vice-proxy.test.ts` is the known hanger — bound it and record the
   timeout as an observation rather than letting it block. Report the result as
   a MEASURED delta in the SUMMARY; do not silently assume this set is green
   just because it is excluded locally.
4. **Stop any running broker first.** A live broker deterministically reddens
   one test in this suite, so a result measured against one is not a result.
5. `node scripts/audit-gate.mjs --root . --json` reports `allowed: true`,
   `redGuards: []`, `structuralErrors: []`.
6. An independent per-file sweep of every `src/mcp/vice/docs-*.test.ts` agrees
   that none is red — a cross-check on the gate that does not go through the
   gate.
7. `git log --oneline -3` shows three separate commits, one per root cause.
8. `git diff --name-only HEAD~3` lists only the files this plan names.
</verification>

<success_criteria>
Every one of the 7 pre-existing failures is closed at its actual root cause: the
ledger has a row per pending todo and each of those todos is tracked; phase 49's
CR-01 has a disposition in a source the guard recognises; a single resolver
decides whether a cited requirement id is real, spanning the milestone archive,
with its anti-rubber-stamp bite intact; and the audit gate names the guard file
that actually failed, proven by a test that was red against the old logic. No
guard was weakened, narrowed or exempted anywhere. The measured after-state is
compared member-by-member to a measured before-state, the 12 CI-only test files
are measured rather than assumed, and three revertible commits exist.
</success_criteria>

<output>
Create `.planning/quick/260913-mql-fix-the-red-docs-guards-and-the-audit-ga/260913-mql-SUMMARY.md` when done.

The SUMMARY must carry, as measurements rather than claims:
- the before/after failure counts and the skipped SET compared member-by-member;
- the individual result for each of the 12 `MANUAL_ONLY_TESTS` files;
- the captured RED output of the attribution regression test against the pre-fix
  logic, which is the only proof that test is non-vacuous;
- any divergence found between this plan's measured baseline and the tree as the
  executor found it.
</output>
