---
phase: quick-260911-syq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/research/questions.md
autonomous: true
requirements: [QUICK-260911-syq]
estimate:
  tokens: 45000
  raw_tokens: 45000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "`.planning/research/questions.md`'s last section carries a dated ANSWER subsection whose verdict is `No` -- nothing in the v1.0.0 rebuild half needs SID read-back, matrix keyboard or RESTORE/NMI."
    - "Each of the three capabilities is answered separately, and each answer names the file it was verified against, so a reader can re-run the check rather than trust the prose."
    - "Every factual claim in the answer was RE-DERIVED by running a command against the tree during execution -- the three claims this plan names as SUSPECT are corrected in the answer text rather than transcribed."
    - "The answer records the forward-looking `FUT-05` caveat and names `KEYBOARD_MATRIX_SET` as the remedy, explicitly NOT reinstating the fork backend, so a later milestone cannot read this answer as broader than it is."
    - "The answer states the framing correction: the owner reports the fork never worked, so removing it does not lose a capability -- it stops the documentation promising one."
    - "The answer hands Phase 52 the measured inventory of surviving `requires the fork` / `fork-only` routes in skill text, which Phase 52 criterion 3 must rewrite."
    - "The answer states in its own words that it ANSWERS the question and unblocks Phase 52, and that the formal dated ACCEPTANCE record is Phase 52's success criterion 3 and is deliberately NOT written here."
    - "The question section still carries its original `**Raised:**` and `**Blocks:**` lines unedited, with a new `**Settled:**` line added beside them -- the historical record of why the question existed is not overwritten."
    - "`git status --porcelain` shows no modification to any file other than `.planning/research/questions.md` and this plan's own directory."
  artifacts:
    - .planning/research/questions.md
  key_links:
    - "`.planning/research/questions.md` (last section) <- is the declared blocker of -> `.planning/ROADMAP.md` Phase 52's `**Depends on**` line. The answer must be legible as discharging exactly that dependency, or the phase stays blocked."
    - "The answer's `FUT-05` caveat <- must agree with -> `.planning/ROADMAP.md`'s Phase 50 note that places the real-title pipeline at `FUT-05`. If the answer overstates the caveat it re-blocks work that is already out of scope."
    - "The answer's skill-route inventory <- is consumed by -> Phase 52 success criterion 3 (`They stop being routed to the fork anywhere in skill text`). An undercount here leaves a dead route shipped."
---

<objective>
Answer the open research question *"Does anything in the v1.0.0 rebuild half need stock's
three hard losses?"* in `.planning/research/questions.md`, and mark it settled, so Phase 52
(Remove the Fork Backend) stops being blocked on it.

Purpose: Phase 52's `**Depends on**` line names this question by path and says the phase
must not run until it is answered. The answer is expected to be *No*, but it is only worth
anything if it was DERIVED rather than asserted -- the evidence below is a starting point
that the executor re-checks against the tree and corrects where it does not hold.

Output: one edited file. A `**Settled:**` line and a dated `### Answer` subsection appended
to the file's last section. Nothing else changes.
</objective>

<execution_context>
@/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/workflows/execute-plan.md
@/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/research/questions.md
@.planning/notes/fork-removal-reversal-basis.md
</context>

## SCOPE GUARD -- read before the first edit

**The only file this plan may modify is `.planning/research/questions.md`.**

Do NOT touch `ROADMAP.md`, `PROJECT.md`, `REQUIREMENTS.md`, `STATE.md`, `MILESTONES.md`,
any file under `src/`, or any test. Phase 52 owns every one of those, and several are pinned
by `docs-fork-decision.test.ts`, which reds on any edit to `PROJECT.md`'s `FORK-01` row.
Editing them here would leave the suite red for a phase that has not started.

**The formal dated ACCEPTANCE record is NOT written here.** It is Phase 52's own success
criterion 3 (`Stock's three hard losses ... are recorded as ACCEPTED, dated, with their
evidence, somewhere a reader hits before asking why a capability is missing`). This plan
produces the *research answer* that lets that criterion be met; writing the acceptance
record here would pre-empt the phase and split the record across two places.

Writing the SUMMARY into this plan's own `.planning/quick/260911-syq-*/` directory is the
normal execution output and is not a scope violation.

## The claimed answer, and the three claims that are SUSPECT

The orchestrator gathered the evidence below. **It is a starting point, not a dictation.**
Task 1 re-derives every claim. Three are already known to be loose and MUST be corrected
rather than copied:

| # | Claim as handed over | Why it is suspect |
|---|----------------------|-------------------|
| S-1 | *"the only subject in v1.0.0 is Phase 48's purpose-built SYNTHETIC fixture"* | Phase 45 and Phase 48 criterion 5 both reference **pre-existing** committed fixtures (`tracer.prg`, `bank.prg`, `smc.prg`). "The only subject" is wrong; the true statement is narrower and needs finding. |
| S-2 | *"Phase 50 criterion 1 narrows that mask **only** to catch `$D020`/`$D015`/`$D018`"* | Criterion 1 names those three as the **planted regression** that must be caught. It does not say the narrowing is limited to them. The word "only" is an over-read. |
| S-3 | *"RESTORE/NMI -- no mention in Phases 47-50"* | The answer's scope is the whole v1.0.0 rebuild half, which is Phases **45-50**. Check the full block, not a sub-range. |

The claimed answer, to be confirmed or corrected:

**No.** Nothing in the v1.0.0 rebuild half needs SID read-back, matrix keyboard, or
RESTORE/NMI.

- **SID read-back** -- the v1.0.0 equivalence instrument *excludes* SID rather than reading
  it. `src/skills/c64-ram-capture/scripts/compare.mjs` puts the whole `$D000-$DFFF` I/O
  range in its `VOLATILE` mask, SID's `$D400-$D7FF` included, on the stated ground that
  reading it samples live hardware and two captures can never agree there. Phase 48 does
  carry "music tables", but as annotation-store data under static analysis, not as a
  running player's register state.
- **Matrix keyboard** -- Phase 48's subject is authored by this project, so any input it
  needs can be designed against the KERNAL buffer that `KEYBOARD_FEED` (0x72) drives. The
  decisive point is scope: Phase 50's notes place the pipeline-on-a-real-title work
  (`bruce_lee`) at `FUT-05` and say it "is not this phase" -- so the one scenario that needs
  direct matrix control, driving a commercial game that scans `$DC00`/`$DC01`, is already
  outside this milestone.
- **RESTORE/NMI** -- nothing in the milestone reaches for it.

Two things the answer must carry beyond the verdict:

1. **The `FUT-05` caveat.** A later milestone must not read this answer as broader than it
   is. `FUT-05` would plausibly need matrix keyboard, because a game that scans the matrix
   directly cannot be driven through the KERNAL buffer. The remedy at that point is the
   upstream `KEYBOARD_MATRIX_SET` opcode (~60 lines in `monitor_binary.c` calling
   `keyboard_set_keyarr_any`, already identified in `PROJECT.md`), which closes the gap for
   every stock user -- **not** reinstating the fork backend, which the owner reports never
   worked.
2. **The framing correction.** The question is written as *"can we accept permanently LOSING
   these three capabilities?"* But the owner reports the fork never worked, so they were
   never actually available. Removing the fork does not lose a capability -- it stops the
   documentation promising one. Say this, because it is what makes the acceptance
   straightforward rather than a sacrifice.

## Citation discipline for the answer text

Cite ROADMAP content **by phase and criterion number, never by line number.** Roadmap line
numbers drift every phase, and a stale line reference in a settled answer reads as evidence
of a change that never happened. Line numbers are acceptable only for `PROJECT.md`'s
`KEYBOARD_MATRIX_SET` reference and for `compare.mjs`'s `VOLATILE` array, and only if the
executor read that line during this run.

No verification gate in this plan negative-greps `questions.md` -- every negative check
targets `ROADMAP.md` or `REQUIREMENTS.md`, which this plan does not edit. Do not add a gate
that greps the answer file for the absence of a word the answer itself has to use.

That is also why the two capability-keyword alternations below are allowlisted against the
comment-text discipline check. The hazard that check exists to catch is an executor writing
a negative-grepped literal into the very file the gate reads. It cannot occur here: both
alternations are read-only assertions over `ROADMAP.md` and `REQUIREMENTS.md`, and the only
file this plan writes is `questions.md`, which no gate counts.

<!-- planner-discipline-allow: \b(keyboard|matrix|nmi|restore|joystick|sid)\b -->
<!-- planner-discipline-allow: \b(keyboard|matrix|sid|nmi|restore|joystick)\b -->

<tasks>

<task type="tracer">
  <name>Task 1: Re-derive the evidence base, hardest capability first, and land the matrix-keyboard answer end-to-end</name>
  <files>.planning/research/questions.md</files>
  <precondition>`.planning/research/questions.md` ends with the section titled `## Does anything in the v1.0.0 rebuild half need stock's three hard losses?` -- if the file has been re-ordered since planning, locate that section before appending anything.</precondition>
  <action>
Verify first, write second. This task proves the whole path -- source check, correction,
prose, in-file -- on the capability the question itself says to check hardest.

**Step 1: run the checks.** Run each from the repo root and keep the raw output; you will
cite it. Do not substitute a remembered result for a run.

  - Scan the v1.0.0 phase block for the three capabilities, word-bounded:
    `awk '/^### Phase 45:/,/^### Phase 51:/' .planning/ROADMAP.md | grep -inE '\b(keyboard|matrix|nmi|restore|joystick|sid)\b'`
  - Scan the same block for the sound-adjacent and input-adjacent words separately, because
    these DO occur and need interpreting rather than counting:
    `awk '/^### Phase 45:/,/^### Phase 51:/' .planning/ROADMAP.md | grep -inE '\b(music|sound|input)\b'`
  - Read Phase 48 whole, to settle S-1 and to see the subject's own criterion 1:
    `awk '/^### Phase 48:/,/^### Phase 49:/' .planning/ROADMAP.md`
  - Read Phase 50 whole, to settle S-2 and to confirm the `FUT-05` placement:
    `awk '/^### Phase 50:/,/^### Phase 51:/' .planning/ROADMAP.md`
  - Confirm the remedy is where the evidence says, and note the line:
    `grep -n 'KEYBOARD_MATRIX_SET' .planning/PROJECT.md`
  - Inventory the surviving fork routes in skill text, which Phase 52 criterion 3 consumes:
    `grep -rniE 'requires the fork|fork-only' src/skills/`

**Step 2: correct S-1, S-2 and S-3** against what you just read, and write the corrected
statements down. If any check contradicts the handed-over evidence elsewhere too, the check
wins and the answer says the corrected thing.

**Step 3: open the answer in the file.** Append to the end of `questions.md` -- the target
section is the last one, so end-of-file is the right place -- a subsection headed
`### Answer, 2026-09-11: No` carrying, in this order:

  1. the one-line verdict;
  2. a `**Matrix keyboard -- not needed.**` paragraph giving the CORRECTED S-1 statement
     about Phase 48's subject, the `KEYBOARD_FEED` (0x72) KERNAL-buffer route that makes an
     authored fixture's input designable, and the decisive `FUT-05` scope point in Phase 50's
     own words;
  3. the `FUT-05` forward caveat as its own paragraph, naming `KEYBOARD_MATRIX_SET` and its
     `monitor_binary.c` / `keyboard_set_keyarr_any` shape as the remedy, and stating
     explicitly that the remedy is NOT reinstating the fork backend.

Follow the citation discipline stated above. Leave the section's existing `**Raised:**` and
`**Blocks:**` lines untouched in this task. Do not touch any file other than
`.planning/research/questions.md`.
  </action>
  <verify>
    <automated>test "$(awk '/^### Phase 45:/,/^### Phase 51:/' .planning/ROADMAP.md | grep -icE '\b(keyboard|matrix|nmi|restore|joystick|sid)\b')" = 0 && grep -q '^### Answer, 2026-09-11: No' .planning/research/questions.md && grep -q 'KEYBOARD_MATRIX_SET' .planning/research/questions.md && grep -q 'FUT-05' .planning/research/questions.md && test -z "$(git status --porcelain -- .planning/ROADMAP.md .planning/PROJECT.md .planning/REQUIREMENTS.md .planning/STATE.md src/)" && echo TASK1-OK</automated>
  </verify>
  <done>The v1.0.0 phase block is confirmed to contain zero word-bounded hits for the three capabilities; S-1, S-2 and S-3 are corrected in writing; `questions.md` carries the `### Answer, 2026-09-11: No` heading, the verdict line, the matrix-keyboard paragraph and the `FUT-05` caveat naming `KEYBOARD_MATRIX_SET`; and no file outside `.planning/research/questions.md` is modified.</done>
</task>

<task type="auto">
  <name>Task 2: Add the SID read-back and RESTORE/NMI answers and the requirements cross-check</name>
  <files>.planning/research/questions.md</files>
  <action>
Expand the answer subsection Task 1 opened with the remaining two capabilities and the
cross-check that makes the verdict hold over the whole milestone rather than phase by phase.

**Step 1: verify SID read-back.** Read the `VOLATILE` array and the comment above the
`$D000-$DFFF` entry in `src/skills/c64-ram-capture/scripts/compare.mjs` -- locate it with
`grep -n 'VOLATILE\|0xd000' src/skills/c64-ram-capture/scripts/compare.mjs` rather than a
fixed line range, then read the surrounding block. Confirm for yourself that the whole I/O
range including SID's `$D400-$D7FF` is masked, and that the stated reason is that reading it
samples live hardware. Then re-read Phase 50 criterion 1 with S-2's correction in hand, and
state what the narrowing actually is rather than what the handed-over evidence claimed.

**Step 2: verify RESTORE/NMI over the correct range** -- Phases 45-50, per S-3, which the
Task 1 scan already covers. State the finding as what the scan showed, not as an absence you
assumed.

**Step 3: run the requirements cross-check**, which is two commands because the two halves
need different treatment:

  - The hard half, which must return `0`:
    `awk '/^## v1.0.0 Requirements/,/^## Departures from/' .planning/REQUIREMENTS.md | grep -icE '\b(keyboard|matrix|sid|nmi|restore|joystick)\b'`
  - The interpreted half, which returns hits that are NOT counter-evidence and must be
    disambiguated in prose rather than counted:
    `awk '/^## v1.0.0 Requirements/,/^## Departures from/' .planning/REQUIREMENTS.md | grep -inE '\b(sound|input)\b'`
    Read each hit and say in the answer what it actually refers to. The handed-over evidence
    claimed the 15 requirements mention no "input" at all; if that is wrong, say what the
    word is doing there instead of dropping the claim silently.

**Step 4: write it.** Extend the `### Answer, 2026-09-11: No` subsection with a
`**SID read-back -- not needed.**` paragraph and a `**RESTORE / NMI -- not needed.**`
paragraph, each citing what you ran, followed by a `**Cross-check over the 15 requirements**`
paragraph stating the hard-half result, the disambiguated soft-half hits, and the requirement
ID set the check covered (`DECOMP-01..04`, `BUILD-01..07`, `EQUIV-01..04`).

Follow the citation discipline stated above. Do not touch any file other than
`.planning/research/questions.md`.
  </action>
  <verify>
    <automated>test "$(awk '/^## v1.0.0 Requirements/,/^## Departures from/' .planning/REQUIREMENTS.md | grep -icE '\b(keyboard|matrix|sid|nmi|restore|joystick)\b')" = 0 && grep -qi 'SID read-back' .planning/research/questions.md && grep -q 'compare.mjs' .planning/research/questions.md && grep -qE 'DECOMP-01' .planning/research/questions.md && test -z "$(git status --porcelain -- .planning/ROADMAP.md .planning/PROJECT.md .planning/REQUIREMENTS.md .planning/STATE.md src/)" && echo TASK2-OK</automated>
  </verify>
  <done>All three capabilities are answered in the file, each citing a command that was run this session; the requirements hard-half check returns 0 and is stated as such; every `sound`/`input` hit in the v1.0.0 requirement block is disambiguated in prose rather than omitted; no file outside `.planning/research/questions.md` is modified.</done>
</task>

<task type="auto">
  <name>Task 3: Mark the question settled, record the framing correction and the Phase 52 hand-off, and prove the scope guard held</name>
  <files>.planning/research/questions.md</files>
  <action>
Close the answer and make the file legible to the next reader as *settled*, not *open*.

**Step 1: add the settled marker.** Immediately after the section's existing `**Blocks:**`
line, add a `**Settled:**` line dated `2026-09-11` that says the question is answered below
and that Phase 52's stated dependency is discharged. Leave `**Raised:**` and `**Blocks:**`
themselves byte-identical -- they are the record of why the question existed, and the file's
own header says each question carries the date it was raised and what would settle it.

**Step 2: write the framing correction** as a closing paragraph of the answer. The question
asks whether permanently LOSING three capabilities is acceptable; the owner reports the fork
never worked, so they were never actually available. Removing the fork does not lose a
capability -- it stops the documentation promising one. State it plainly, and cite
`.planning/notes/fork-removal-reversal-basis.md` as where the owner's scope call is recorded.

**Step 3: hand off to Phase 52.** Add a short closing block that:

  - lists the surviving fork-route hits in skill text from Task 1's inventory, by file, so
    Phase 52 criterion 3 has the worklist rather than re-deriving it;
  - states that this entry ANSWERS the question and unblocks Phase 52, and that the formal
    dated ACCEPTANCE record is deliberately NOT written here because it is Phase 52's own
    success criterion 3.

**Step 4: prove the scope guard held.** Run `git status --porcelain` and confirm the only
tracked-file modification is `.planning/research/questions.md`. Untracked entries that
pre-date this run (`.vice-snapshots/`, `.vice-supervisor/`, `docs/dissambler-workflow.md`,
`docs/vice-mcp-ideas.md`, `tools/`) and this plan's own quick directory are expected and are
not violations. If anything else is modified, revert it before committing.
  </action>
  <verify>
    <automated>grep -q '^\*\*Settled:\*\* 2026-09-11' .planning/research/questions.md && grep -q '^\*\*Raised:\*\* 2026-09-11 — `/gsd-explore`, owner scope call to remove the fork backend entirely.' .planning/research/questions.md && grep -q 'fork-removal-reversal-basis' .planning/research/questions.md && grep -q 'Phase 52' .planning/research/questions.md && test "$(git status --porcelain --untracked-files=no | grep -vc '.planning/research/questions.md')" = 0 && echo TASK3-OK</automated>
  </verify>
  <done>The question section carries a dated `**Settled:**` line beside its untouched `**Raised:**` and `**Blocks:**` lines; the answer closes with the framing correction citing the reversal-basis note, the per-file skill-route worklist, and an explicit statement that the formal acceptance record belongs to Phase 52 criterion 3; and `git status --porcelain --untracked-files=no` lists `.planning/research/questions.md` and nothing else.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| planning-record -> future executor | A settled research answer is read as fact by later phases; a wrong or overbroad claim here propagates without re-derivation. |
| this plan -> Phase 52's guarded records | `PROJECT.md`, `REQUIREMENTS.md` and `ROADMAP.md` are pinned by `docs-fork-decision.test.ts` and owned by a phase that has not started. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-syq-01 | Tampering | `.planning/PROJECT.md` `FORK-01` row | high | mitigate | Scope guard section plus a `git status --porcelain` gate in all three tasks' `<verify>`; any edit outside `questions.md` fails the task before commit. |
| T-syq-02 | Repudiation | the settled answer's evidence | medium | mitigate | Every claim must cite a command run during this session; the three named SUSPECT claims must be corrected, not transcribed, which forces the checks to actually run. |
| T-syq-03 | Information Disclosure | forward scope leakage | medium | mitigate | The `FUT-05` caveat is a required element of the answer, so a later milestone cannot read the verdict as broader than the v1.0.0 rebuild half. |
| T-syq-04 | Tampering | npm/pip/cargo installs | high | accept | No package-manager step exists in this plan; it edits one markdown file and runs `grep`/`awk`/`git`. |
</threat_model>

<verification>
1. `.planning/research/questions.md`'s last section carries `### Answer, 2026-09-11: No` with
   three separately-headed capability paragraphs, a requirements cross-check, the `FUT-05`
   caveat, the framing correction and the Phase 52 hand-off.
2. Both negative gates hold on the read-only sources:
   `awk '/^### Phase 45:/,/^### Phase 51:/' .planning/ROADMAP.md | grep -icE '\b(keyboard|matrix|nmi|restore|joystick|sid)\b'` returns `0`, and
   `awk '/^## v1.0.0 Requirements/,/^## Departures from/' .planning/REQUIREMENTS.md | grep -icE '\b(keyboard|matrix|sid|nmi|restore|joystick)\b'` returns `0`.
3. `git status --porcelain --untracked-files=no` lists `.planning/research/questions.md` and
   nothing else.
4. The answer contains no `.planning/ROADMAP.md:<digits>` style citation -- roadmap content is
   cited by phase and criterion.
5. No test is run and none is expected to change; `questions.md` is outside
   `docs-dangling-refs.test.ts`'s `ALWAYS_PRESENT_NORMATIVE_DOCS` and outside
   `docs-linerefs.test.ts`'s two-file scan set, both checked at planning time.
</verification>

<success_criteria>
- The research question is answered `No`, with per-capability evidence that was re-derived
  during execution rather than transcribed from this plan.
- S-1, S-2 and S-3 are each visibly corrected in the answer text.
- The question reads as SETTLED and Phase 52's `**Depends on**` line is discharged.
- The formal dated acceptance record is NOT present in this change -- it remains Phase 52's
  success criterion 3.
- Exactly one tracked file changed.
</success_criteria>

<output>
Create `.planning/quick/260911-syq-answer-the-v1-0-0-three-hard-losses-rese/260911-syq-SUMMARY.md` when done.

The SUMMARY must record, as its own section, the three SUSPECT claims and what each was
corrected to -- that correction record is the evidence that the verification pass was real,
and it is the part a reviewer will check first.
</output>
