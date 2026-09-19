---
status: resolved
trigger: "why are gsd creating documents in @docs/ it is only for the projects own files and not for gsd"
created: 2026-09-19
updated: 2026-09-19
---

# Debug: GSD phase artifacts are written into the operator-owned `docs/` tree

## Symptoms

Symptoms below were MEASURED by the orchestrator before this file was created, not
collected by questioning the user. Every claim carries the command or commit that
produced it. Treat them as evidence, not as premises to re-assert.

**expected_behavior**: `docs/` holds only documents the operator (project owner) put
there — documentation about the C64 tooling product itself. GSD phase artifacts
(evidence, decision records, criterion answers) belong under `.planning/phases/<phase>/`.

**actual_behavior**: GSD phase artifacts are being written into `docs/`. Two are there now:

- `docs/phase58-declaration-provenance.md` — frontmatter `phase: 58-one-declaration-four-places-that-can-no-longer-disagree`, `decision_ids: [D-02 … D-11]`. Added by commit `6a17f33d` (2026-09-17), message `feat(58-02): the provenance record -- every case where two sources disagreed, and which won`.
- `docs/phase59-tool-location-placement.md` — frontmatter `phase: 59-the-tool-location-seam-and-its-precedence-order`, `decision_ids: [D-01 … D-17]`. Added by commit `eee67456` (2026-09-18), message `docs(59-05): answer criterion 5 in writing and audit the new document's citations`. Its own body opens: "This file answers ROADMAP criterion 5 for Phase 59 in writing".

Both are unambiguously GSD artifacts by their own frontmatter, and both were written by
phase executors during plan execution.

**error_messages**: None. This fails silently — nothing reds, nothing warns. That silence
is itself a symptom and is likely central to the root cause.

**timeline**: ROADMAP.md:681 records the precedent as having "quietly recurred at every
phase since 2026-08-11". The critical timing fact:

- Phase 53 ("Operator-Owned `docs/`") exists precisely to end this. Its goal (ROADMAP.md:1525): "`docs/` contains only what the operator put there."
- Phase 53 **ran**: commit `ccdc58da` (2026-09-17) `feat(53-04): relocate 27 evidence documents into their phase evidence/ dirs`.
- `docs/phase58-…md` was committed **the same day** (`6a17f33d`, 2026-09-17).
- `docs/phase59-…md` was committed **the next day** (`eee67456`, 2026-09-18).

So the relocation half of Phase 53 succeeded and the recurrence resumed immediately.
This is NOT "a cleanup that was never run" — it is a cleanup that ran and did not hold.

**reproduction**: `ls docs/phase*` → returns 2 files that should not exist there. Any phase
whose ROADMAP success criterion asks for a written answer appears to reproduce it.

## Leads (orchestrator-gathered, UNVERIFIED — confirm or eliminate each)

1. **The Phase 53 guard criterion appears struck through in ROADMAP.md.** Around
   ROADMAP.md:1557 the criterion reads `~~A guard reds on a docs/phase* path appearing in
   src/** or tools/** …~~`. If the guard was descoped, the relocation shipped without the
   mechanism meant to prevent recurrence — which matches the observed timeline exactly.
   VERIFY the strikethrough and what replaced it, if anything.
2. **Phase 53 is not closed.** ROADMAP.md:681 checkbox is still `- [ ]`, and
   `.planning/STATE.md` lists `53` under `carried_forward_phases` (alongside 51, 54, 57)
   while the project is now on Phase 63. Determine what part of 53 remains open and whether
   the guard is the open part.
3. **ROADMAP.md:1373-1374 records a planning deviation**: "PLANNING DEVIATION, recorded
   2026-09-14, from 'this is why Phase 53 runs before Phase 51'. Phase 53 has not run, and
   this phase was planned anyway." Ordering was already violated once here.
4. **The instruction may originate upstream of the executor.** Check whether the 58-02 and
   59-05 PLAN.md task text, or the phase success criteria they answer, literally name a
   `docs/` destination path. If a plan names the path, the executor is complying correctly
   and the defect is in the planner or in the ROADMAP criterion wording — not in executor
   behaviour. This distinction decides where any fix belongs.
5. **A `docs/`-shaped escape may be encoded in a guard's own allowlist.** ROADMAP.md:1339
   mentions a "defining document" escape for decision AND requirement ids, noting "`docs/`
   ships in …". Check whether an existing citation/ledger guard actively *requires* these
   files to sit in `docs/`, which would mean the guard and Phase 53 are in direct conflict.

## Current Focus

hypothesis: The `docs/` destination was NOT chosen by the executor and NOT specified by any
  ROADMAP criterion. It was inferred from in-tree precedent by the phase-58 discuss agent
  ("this project already has a convention for that"), frozen into 58-02-PLAN.md, and then
  re-inferred by the phase-59 planner from the single file phase 58 had just created. The
  rule that would have blocked it exists in exactly one place no planning agent reads.
test: Settled — see reasoning_checkpoint below. All five leads resolved on direct evidence.
expecting: n/a — root cause confirmed.
next_action: Raise a decision checkpoint. The three fix sites are CLAUDE.md (project-owned,
  non-roadmap, checkpoint-gated), the Phase 53 re-scope (ROADMAP-owned — recommend only),
  and the hardcoded paths in `src/mcp/vice/phase58-citation-ledger.test.ts:46-47` which
  currently BLOCK the relocation of the two files.

reasoning_checkpoint:
  hypothesis: "GSD artifacts land in `docs/` because file placement is inferred from in-tree
    precedent, and the rule forbidding it is absent from every document a planning agent
    reads. The precedent is self-propagating, so removing the files does not remove the
    mechanism: one surviving instance regenerates the convention."
  confirming_evidence:
    - "58-DISCUSSION-LOG.md:57-58 states the reason verbatim: 'this project already has a
      convention for that (docs/phase40-preprocessing-tools-decisions.md,
      docs/stock-hard-losses.md)'. The user's answer to that question was 'You decide.'"
    - "Neither ROADMAP criterion names a path. Phase 58 criterion 5 = 'the declaration
      records which was chosen and why'. Phase 59 criterion 5 = 'The phase records which
      shape it took'. Both are silent on destination."
    - "Both PLAN.md files name the path in <files>, in deliverables, and inside their own
      automated verification commands — so the executor complied correctly."
    - "CLAUDE.md, .planning/ENGINEERING_RULES.md and .planning/codebase/CONVENTIONS.md
      contain zero occurrences of the rule. `grep -ic 'operator-owned' CLAUDE.md` = 0."
    - "Timestamps: 58-02-PLAN.md committed 2026-09-17 11:55; relocation ccdc58da ran
      2026-09-17 14:04; the doc landed 16:34. The plan predated the cleanup by 2h09m."
    - "59-05-PLAN.md:277 cites `docs/phase58-declaration-provenance.md` as 'the whole
      document, as the format precedent' — the ONLY surviving docs/phase* file at that
      moment, placed there by phase 58 the previous afternoon."
  falsification_test: "If a ROADMAP success criterion had literally named a `docs/`
    destination path, the defect would sit in the roadmap wording and not in precedent
    inference. Both criteria were read verbatim; neither names a path. Hypothesis survives."
  fix_rationale: "The recurrence loop has exactly one edge that is cheap to cut: the absent
    written rule. Placing 'docs/ is operator-owned; phase artifacts go to
    .planning/phases/NN-*/evidence/' in CLAUDE.md puts it in the one file every GSD role
    (discuss, research, plan, execute, verify) loads unconditionally, so the precedent
    inference never gets made. Deleting the two files alone does NOT fix it — that is
    precisely the experiment Phase 53 already ran on 27 files, and it failed within hours."
  blind_spots:
    - "Not tested: whether a future discuss agent actually honours a CLAUDE.md line over a
      surviving in-tree precedent. The two offending files remain on disk, so the wrong
      precedent still outnumbers the rule until they move."
    - "`docs/dissambler-workflow.md` and `docs/vice-mcp-ideas.md` are untracked and were not
      classified as operator- or GSD-authored."
    - "Not audited: phases 60, 61 and 62 for the same pattern under non-`phase*` filenames."
  candidate_causes:
    - "code/process: the placement rule is absent from CLAUDE.md, ENGINEERING_RULES.md and
      CONVENTIONS.md; it lives only in the ROADMAP section of a phase that has not closed"
    - "data (the repository tree itself): 27 accumulated docs/phase*.md files WERE the
      convention signal the discuss agent sampled and cited"
    - "config/tooling: Phase 53 criterion 6 — the only mechanical guard — was WITHDRAWN
      2026-09-17, and the recurrence risk explicitly accepted, so nothing reds"
  and_gate: "YES — this needs more than one condition at once. Had the rule been written in
    CLAUDE.md, 27 precedents would not have produced the 'this project already has a
    convention' sentence. Had there been zero precedent files, that sentence could not have
    been written either. Both were necessary for the FIRST occurrence. The withdrawn guard
    (third cause) is what makes the loop STABLE after cleanup — necessary for the RECURRENCE,
    not for the first instance. Root cause is therefore a conjunction of three, not one."

## Evidence

- timestamp: 2026-09-19 — `ls docs/` returns 8 files; exactly 2 match `phase*`: `phase58-declaration-provenance.md`, `phase59-tool-location-placement.md`.
- timestamp: 2026-09-19 — `git log --diff-filter=A` attributes those two to `6a17f33d` (2026-09-17, plan 58-02) and `eee67456` (2026-09-18, plan 59-05).
- timestamp: 2026-09-19 — `git log --diff-filter=D -- 'docs/phase*'` shows `ccdc58da` (2026-09-17) `feat(53-04): relocate 27 evidence documents into their phase evidence/ dirs`. The relocation is real and already happened.
- timestamp: 2026-09-19 — both offending files carry GSD `phase:` and `decision_ids:` frontmatter; `phase59-…md` self-describes as answering a ROADMAP criterion.
- timestamp: 2026-09-19
  checked: ROADMAP.md:1523-1575, the Phase 53 section (LEAD 1).
  found: Criterion 6 is struck through and annotated **WITHDRAWN 2026-09-17**, on the grounds that such a guard "scans source text by construction" and quick task `260914-poo` (2026-09-14) locked D-1 "No test may assert on text at all". The section states outright: "**The recurrence risk is accepted and named** — nothing mechanical now stops a future plan writing evidence to `docs/` again. `DOCS-04` closes as SUPERSEDED, not met." The phase Goal was rewritten to "No guard is built".
  implication: LEAD 1 CONFIRMED. This explains the SILENCE (symptom: nothing reds) and why the cleanup does not hold. It does NOT explain why a plan chose `docs/` in the first place — absence of a guard is not an instruction.
- timestamp: 2026-09-19
  checked: ROADMAP.md:681 checkbox and the Phase 53 goal text (LEAD 2).
  found: `- [ ] **Phase 53** …` still unticked. Its own goal line still advertises "a guard stops the precedent" while the detail section says no guard is built — the summary line and the detail contradict each other.
  implication: LEAD 2 CONFIRMED. The open part of Phase 53 is the whole phase; the guard is not merely open, it was cancelled. The stale summary line hides that from anyone reading only the checklist.
- timestamp: 2026-09-19
  checked: `grep -n 'docs/' .planning/phases/58-*/58-02-PLAN.md` and the same for 59-05 (LEAD 4, the decisive one).
  found: 58-02-PLAN.md names `docs/phase58-declaration-provenance.md` at lines 8, 21, 31, 34, 66, 89 (`<files>`), 105, 169, 181, 183, 189, 211, 281, 317, 319, 334 — including inside its own `<automated>` verification commands (`D=docs/phase58-declaration-provenance.md; test -f "$D"`). 59-05-PLAN.md does the same for `docs/phase59-tool-location-placement.md` at lines 12, 31, 38, 42, 86, 271 (`<files>`), 285, 341, 353, 355, 357, 411.
  implication: The executors complied with an explicit, repeatedly-stated instruction, and their own success gates asserted on that path. Executor behaviour is CORRECT. The defect is strictly upstream.
- timestamp: 2026-09-19
  checked: Phase 58 and Phase 59 success criteria, read verbatim from `.planning/milestones/v1.1.0-ROADMAP.md` (the detail was archived out of the live ROADMAP).
  found: Phase 58 criterion 5 — "**No remedy text is invented at authoring time.** … where two of those disagree today, the declaration records which was chosen and why instead of silently picking one." Phase 59 criterion 5 — "**The open placement question is answered in writing rather than drifted into.** The phase records which shape it took … and states what that choice costs Phase 60 in refactoring scope." NEITHER names a file, a directory, or `docs/`.
  implication: LEAD 4 SETTLED DECISIVELY. The criteria asked for "in writing" and said nothing about WHERE. The destination was invented downstream of the roadmap. The fix therefore does NOT belong in the criterion wording.
- timestamp: 2026-09-19
  checked: `.planning/phases/58-*/58-DISCUSSION-LOG.md:44-58`, Q2 "where the 'two sources disagreed, here's which won' record lives".
  found: The option table offered "A field in the JSON" / "A docs/ decision file" / "Both, split by job" / "You decide". **User's choice: You decide.** Claude selected "Both, split by job" and justified the location verbatim: "criterion 5's 'records which was chosen and why' needs prose a human reads, and **this project already has a convention for that** (`docs/phase40-preprocessing-tools-decisions.md`, `docs/stock-hard-losses.md`). (→ D-04)".
  implication: THE ORIGIN, in the agent's own words. The destination was inferred from in-tree precedent and recorded as a project convention. The owner delegated the choice and was never shown a `docs/`-vs-`.planning/` tradeoff. At that moment (log committed 2026-09-16 18:58) all 27 squatting files were still present — the squatting WAS the convention signal.
- timestamp: 2026-09-19
  checked: propagation of the destination through phase 58's artifact chain.
  found: 58-DISCUSSION-LOG:57 → 58-CONTEXT:76-78, 265-266, 290 → 58-RESEARCH:27-28, 118, 399, 561, 621 → 58-PATTERNS:15, 192-205 (an "Analog" table row pinning `docs/stock-hard-losses.md` + `docs/phase40-preprocessing-tools-decisions.md` as the structural model) → 58-02-PLAN.md → executor. Every stage restated the path; no stage questioned it.
  implication: Once inferred at discuss time the destination is never re-examined. There is no stage in the GSD chain whose job is to challenge an artifact's DESTINATION, only its content.
- timestamp: 2026-09-19
  checked: `grep -c 'docs/phase59' .planning/phases/59-*/*.md` — which phase-59 artifact first names the destination.
  found: `docs/phase59-tool-location-placement.md` appears in 59-05-PLAN.md, 59-01-PLAN.md, 59-REVIEW.md, 59-VERIFICATION.md, 59-05-SUMMARY.md — and in NONE of 59-DISCUSSION-LOG.md, 59-RESEARCH.md, 59-PATTERNS.md, 59-CONTEXT.md. 59-CONTEXT.md:319 cites only the phase-58 doc, as a reading reference. 59-05-PLAN.md:277 names `docs/phase58-declaration-provenance.md` as "the whole document, as the format precedent".
  implication: For Phase 59 the destination was invented by the PLANNER, with no discussion or research input, by copying the location of the single `docs/phase*` file that survived the relocation — the one Phase 58 had created 18 hours earlier. This is the self-propagation step, isolated.
- timestamp: 2026-09-19
  checked: commit timestamps, relocation against plan authoring.
  found: 58-02-PLAN.md committed `ba853f5f` 2026-09-17 **11:55:09**. Relocation `ccdc58da` 2026-09-17 **14:04:00**. Offending doc `6a17f33d` 2026-09-17 **16:34:08**. 59-05-PLAN.md `aa33bb26` 2026-09-18 **10:55:40**; its doc `eee67456` 2026-09-18 **13:16:54**.
  implication: The two events are causally independent, not a botched cleanup. Phase 58's destination was frozen 2h09m BEFORE the relocation ran, and executed 2h30m after it — the cleanup passed straight through a live phase without touching its plan. Phase 59 then re-derived the destination from what phase 58 had left behind. This is the measured recurrence mechanism.
- timestamp: 2026-09-19
  checked: `src/mcp/vice/phase58-citation-ledger.test.ts` lines 46-47 (LEAD 5).
  found: `const DOC_PATH = join(REPO_ROOT, "docs", "phase58-declaration-provenance.md");` and `const PHASE59_DOC_PATH = join(REPO_ROOT, "docs", "phase59-tool-location-placement.md");` — hardcoded, asserted on at lines 244 and 248. The file was committed BY plan 59-05 on 2026-09-18, the day after the relocation.
  implication: A committed, CI-running test now PINS both files to `docs/`. `git mv`-ing them reds the suite. The recurrence has become load-bearing. This is lead 5's real shape.
- timestamp: 2026-09-19
  checked: the same constant in the guards the relocation DID repoint.
  found: `phase50-findings-contract.test.ts:48` and `phase50-transcript-freshness.test.ts:96` both read `const DOCS_DIR = join(REPO_ROOT, ".planning/phases/50-equivalence-and-modifiability/evidence");` — correctly repointed by Phase 53. (Their other `join(root, "docs")` occurrences are temp-dir fixtures and irrelevant.)
  implication: The sharpest demonstration of "the cleanup ran and did not hold": on 2026-09-17 Phase 53 repointed guard constants OUT of `docs/`, and on 2026-09-18 a new guard constant was committed pointing back INTO `docs/` — same role, same naming, opposite direction, one day apart.
- timestamp: 2026-09-19
  checked: every document a GSD planning agent loads unconditionally.
  found: `grep -ic 'operator-owned' CLAUDE.md` = **0**. CLAUDE.md's only `docs/` references are three citations of `docs/stock-hard-losses.md` as an authority and one line listing "project docs (`docs/`, `README.md`)" under Languages. `.planning/ENGINEERING_RULES.md` has no rule on `docs/` placement. `.planning/codebase/CONVENTIONS.md` mentions only `docs/stock-hard-losses.md`. `.claude/settings.json` is `{}` — no hooks.
  implication: The prohibition is written in exactly ONE place in the repository — the Phase 53 section of `.planning/ROADMAP.md`, which a phase-58 or phase-59 agent has no reason to read. Worse, CLAUDE.md's repeated citation of a `docs/*.md` file as an authoritative project record reads as positive endorsement of `docs/` for exactly this kind of decision document.
- timestamp: 2026-09-19
  checked: whether the two files reach users.
  found: `docs/` is absent from both npm `files[]` arrays (`src/mcp/vice/package.json`, `installer/package.json`). It does travel with the Claude Code plugin install, which is the whole repository.
  implication: Blast radius is the plugin install and the operator's own tree, not the npm tarballs. This bounds the urgency but not the defect.

- timestamp: 2026-09-19
  checked: `git log -- docs/phase58-declaration-provenance.md` and the `<files>` declarations of every plan in phases 60-63.
  found: The file has been touched by **12 commits** spanning phases 58, 60, 61 and 62 — the most recent `42b6a33b feat(62-04)` dated **2026-09-19, today**. `61-01-PLAN.md:94,186` and `61-03-PLAN.md:85,138` declare it in `<files>` as a write target. Across phases 60-63 plans there are **31** references to it. `docs/phase59-tool-location-placement.md` has 6 commits, phases 59 and 60.
  implication: ESCALATION. These are not two stale leftovers. Four subsequent phases have adopted them as live, actively-maintained project artifacts, and the dependency deepened again today. Relocation is now a multi-site operation, not a `git mv`.
- timestamp: 2026-09-19
  checked: tracked status and authorship of all 8 files in `docs/`.
  found: 6 tracked, 2 untracked (`dissambler-workflow.md`, `vice-mcp-ideas.md`). Both untracked files open in plain operator prose with no YAML frontmatter, no `phase:` key and no `decision_ids:`.
  implication: The untracked two are operator-authored and legitimately belong in `docs/`. Only the two `phase*`-named tracked files are GSD artifacts. Blind spot closed; scope stays at exactly two files.

## Eliminated

- hypothesis: "Nobody has ever cleaned `docs/` up." — ELIMINATED. Commit `ccdc58da` relocated 27 documents on 2026-09-17. The cleanup ran; it did not hold.
- hypothesis: "The executors chose the `docs/` path themselves (LEAD 4's second branch)." — ELIMINATED. Both 58-02-PLAN.md and 59-05-PLAN.md name the exact destination in `<files>`, in their deliverable lists, and inside their own `<automated>` verification commands. The executors complied with an explicit instruction and their gates confirmed compliance.
  timestamp: 2026-09-19
- hypothesis: "A ROADMAP success criterion instructed the `docs/` destination (LEAD 4's first branch)." — ELIMINATED. Phase 58 criterion 5 and Phase 59 criterion 5 were read verbatim from `.planning/milestones/v1.1.0-ROADMAP.md`. Neither names a file, a directory or `docs/`; both ask only that something be recorded "in writing". No fix belongs in the criterion wording.
  timestamp: 2026-09-19
- hypothesis: "An existing citation/ledger guard's allowlist actively REQUIRES these files to sit in `docs/` (LEAD 5 as stated)." — ELIMINATED IN THAT FORM. ROADMAP.md:1339's "defining document" passage is about § 21.2 REMOVING an escape for decision and requirement ids; it does not require any file to live in `docs/`. There is no allowlist escape. LEAD 5 is nonetheless real in a different shape — `phase58-citation-ledger.test.ts:46-47` hardcodes both paths — recorded under Evidence.
  timestamp: 2026-09-19
- hypothesis: "The 2026-09-14 Phase 51/53 ordering deviation (LEAD 3) caused these two files." — ELIMINATED AS CAUSAL. That deviation concerns Phase 51's planning-vocabulary guard being planned before Phase 53 ran, and it was closed in place by folding the hole into Phase 51 as `VOCAB-06` (a ninth guard category matching the `docs/phase*` path form, scoped to Phase 51's own scan surface). It is a real precedent for ordering slippage, but it is not on the causal path to `phase58-…md` or `phase59-…md`, neither of which was in Phase 51's scan surface. Note `VOCAB-06` is itself now dead: Phase 51's guard was among the 60 files deleted by `260914-poo`.
  timestamp: 2026-09-19

## Resolution

root_cause: |
  A conjunction of three conditions (AND-gate: YES — no one of them is sufficient).

  RC-1 — THE RULE IS NOT WHERE THE AGENTS READ. The rule "`docs/` is operator-owned; GSD
  phase artifacts belong under `.planning/phases/NN-*/evidence/`" is written in exactly one
  place in this repository: the Phase 53 section of `.planning/ROADMAP.md`, a phase that has
  not closed. CLAUDE.md, `.planning/ENGINEERING_RULES.md` and
  `.planning/codebase/CONVENTIONS.md` are all silent (`grep -ic 'operator-owned' CLAUDE.md`
  = 0). A discuss, research, plan, execute or verify agent working on phase 58 or 59 never
  reads phase 53's roadmap section. CLAUDE.md compounds this by citing `docs/stock-hard-losses.md`
  three times as an authoritative project record, which reads as endorsement of `docs/` as
  the home for exactly this kind of decision document.

  RC-2 — WITH NO WRITTEN RULE, THE TREE BECOMES THE RULE, AND IT SELF-PROPAGATES. GSD's
  planning agents infer file placement from in-tree precedent. Phase 58's discuss agent said
  so in its own words (58-DISCUSSION-LOG.md:57-58): "this project already has a convention
  for that (`docs/phase40-preprocessing-tools-decisions.md`, `docs/stock-hard-losses.md`)"
  — written while all 27 squatting files were still present, in answer to a question the
  owner had delegated with "You decide". The destination then propagated unchallenged through
  CONTEXT → RESEARCH → PATTERNS → PLAN → executor; no GSD stage exists whose job is to
  challenge an artifact's DESTINATION rather than its content. Because the inference is
  precedent-driven, ONE surviving instance regenerates the convention: phase 59's planner —
  with no discussion or research input naming any destination — copied the location of
  `docs/phase58-declaration-provenance.md`, the single `docs/phase*` file the relocation had
  left standing, citing it as "the whole document, as the format precedent"
  (59-05-PLAN.md:277). This is why deleting files cannot fix it, and the timestamps prove
  the cleanup was never at fault: 58-02-PLAN.md froze the destination at 11:55 on 2026-09-17,
  2h09m BEFORE the relocation ran at 14:04, and the executor wrote the file at 16:34.

  RC-3 — THE ONLY BRAKE WAS REMOVED BY DECISION, WHICH IS WHY IT FAILS SILENTLY. Phase 53's
  criterion 6 (a guard reddening on `docs/phase*`) was WITHDRAWN 2026-09-17 because such a
  guard "scans source text by construction" and quick task `260914-poo` (2026-09-14) locked
  D-1 "No test may assert on text at all". The section records "the recurrence risk is
  accepted and named" and closes `DOCS-04` as SUPERSEDED rather than met. RC-3 is not needed
  for the FIRST occurrence; it is what makes the loop STABLE after a cleanup.

  The regression is measurable in a single variable name. On 2026-09-17 Phase 53 repointed
  `DOCS_DIR` in `phase50-findings-contract.test.ts:48` and `phase50-transcript-freshness.test.ts:96`
  OUT of `docs/` and into `.planning/phases/50-*/evidence`. On 2026-09-18 plan 59-05 committed
  `phase58-citation-ledger.test.ts:46-47` with `DOC_PATH`/`PHASE59_DOC_PATH` hardcoded back
  INTO `join(REPO_ROOT, "docs", …)`. Same role, opposite direction, one day apart — and that
  test now BLOCKS relocating the two files without a matching edit.

RC-2 — CORRECTED 2026-09-19 BY OWNER CHALLENGE. The owner asked whether STATE.md, PROJECT.md
  or another GSD file carries a hint, "otherwise they would go under the planning as initially
  intended". Measured, and the challenge is upheld: RC-2 as first written located the precedent
  in the FILE TREE, which is wrong in the way that matters. The precedent lives in the PLANNING
  CORPUS ITSELF — the documents every planning role loads unconditionally. Counted 2026-09-19:
  **103** `docs/*.md` citations across `.planning/PROJECT.md` (41), `.planning/STATE.md` (35),
  `.planning/MILESTONES.md` (10) and `.planning/codebase/*.md` (17), overwhelmingly in the
  teaching shape "recorded in `docs/phaseNN-….md`" / "live in one place: `docs/…`".
  `PROJECT.md:331` does it for this very file: "A machine-read citation ledger in
  `docs/phase58-declaration-provenance.md`". An agent told to record something in writing reads
  PROJECT.md and STATE.md and meets dozens of worked examples of exactly the artifact it is
  about to create, each naming `docs/`.

  This explains what the file-tree account could not: WHY THE CLEANUP COULD NOT POSSIBLY HOLD.
  Phase 53 relocated the files and did not touch the citations. Of the 22 unique `docs/*.md`
  paths cited in that corpus, only **6 still exist — 16 are dangling**. The teaching signal
  survived the relocation completely intact, and 16/22 of it now points at nothing while still
  reading as instruction. Phase 53's criterion 4 swept `src/**` and `tools/**` for `docs/phase`
  citations; the planning corpus was never in its scan surface. A `git mv` of 27 files against
  103 surviving citations was never going to win.

  Corollary defect, recorded not fixed: `PROJECT.md:399` still states Phase 53 "never started"
  and quotes `docs/phase*.md` as holding 27 files. Commit `ccdc58da` relocated all 27 on
  2026-09-17 and `.planning/phases/53-operator-owned-docs/` exists. PROJECT.md is stale on this
  point, and it is one of the files a planner reads.

fix: APPLIED IN PART, remainder recommended. Root cause confirmed; the fix is checkpoint-gated because every candidate site is either ROADMAP-owned (recommend only, per scope constraints) or a project-owned file this session must not write unprompted. Recommended shape, in order of what actually cuts the recurrence loop: (1) CLAUDE.md gains the missing placement rule under Conventions — cuts RC-1 and is the only change that stops the precedent inference being made at all; (2) Phase 53 is re-scoped by its owning workflow to relocate the remaining two files AND repoint `src/mcp/vice/phase58-citation-ledger.test.ts:46-47` plus the 31 plan references — cuts RC-2 by removing the last precedent; (3) the owner reconsiders RC-3 on a narrower basis: criterion 6 was withdrawn because a citation guard "scans source text by construction", but a `readdirSync("docs")` assertion that no entry matches `phase*` reads the FILESYSTEM, not source text, and so is not obviously barred by D-1/D-2 — that is a requirements-shaped judgement for the owner, not this session.
  APPLIED 2026-09-19 with owner authorization (option A): `CLAUDE.md` gains a
  `**docs/ is operator-owned.**` bullet as the FIRST entry under `## Conventions`. It states the
  destination rule, binds it to the planner and discuss agent by name (an executor writes where
  its plan says, so a `docs/` path in a `<files>` block is already the defect), and — per the
  corrected RC-2 — explicitly disarms the 103 surviving citations by naming them as reversed-
  convention residue with 16/22 paths dangling, so a reader meeting "recorded in
  `docs/phaseNN-….md`" reads it as a stale pointer rather than house style. It records that no
  guard enforces this and why (criterion 6 withdrawn under `260914-poo` D-1).

  NOT applied, recommended to owning workflows: (2) Phase 53 re-scope to relocate the two
  remaining files, which must also repoint `src/mcp/vice/phase58-citation-ledger.test.ts:46-47`
  and the ~31 plan references or CI reds — note `docs/phase58-declaration-provenance.md` has 15
  commits and was written to on 2026-09-19 by `42b6a33b feat(62-04)`, so it is live, not stale;
  (3) the narrower RC-3 reading (a `readdirSync("docs")` check reads the filesystem, not source
  text, so D-1/D-2 may not bar it); (4) NEW — repoint or retire the 16 dangling citations and
  correct `PROJECT.md:399`'s "never started" claim. Item 4 is the one that decides whether the
  next cleanup holds, and it did not exist as a known item before this session.

verification: CLAUDE.md edit verified in place. Root-cause claims independently re-measured by
  the orchestrator rather than accepted from the subagent report: `grep -ic 'operator-owned'`
  = 0 across CLAUDE.md / ENGINEERING_RULES.md / CONVENTIONS.md; 58-DISCUSSION-LOG.md:57-58 quote
  confirmed verbatim; phase58-citation-ledger.test.ts:46-47 hardcoding confirmed; criterion 6
  WITHDRAWN annotation confirmed; citation census (103 total, 22 unique, 16 dangling) computed
  directly. One subagent figure corrected: the phase58 doc has 15 commits, not the 12 reported.
  NOT verified: that the CLAUDE.md bullet actually changes future planner behaviour — that is
  only observable on the next phase that must record something in writing, and it is the real
  test of this fix.
files_changed:
  - CLAUDE.md
  - .planning/debug/gsd-writes-into-operator-docs.md
