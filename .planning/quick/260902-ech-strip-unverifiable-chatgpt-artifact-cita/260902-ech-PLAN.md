---
task: Strip unverifiable ChatGPT-artifact citations from docs/undocumented-opcodes-ghidra.md
date: 2026-09-02
mode: quick
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/undocumented-opcodes-ghidra.md
autonomous: true
requirements: []

estimate:
  tokens: 30000
  raw_tokens: 20000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "docs/undocumented-opcodes-ghidra.md contains zero occurrences of utm_source."
    - "The file contains zero inline reference-style citation markers matching (\\[[^]]*\\]\\[[0-9]+\\])."
    - "The file contains zero trailing link definitions matching ^\\[[0-9]+\\]: ."
    - "The author's own caveat sentence beginning 'One caveat: I validated the opcode coverage' is still present, byte-identical."
    - "Every SLEIGH source line and every other prose line is byte-identical to its pre-edit state."
    - "The commit contains exactly one path: docs/undocumented-opcodes-ghidra.md."
  artifacts:
    - docs/undocumented-opcodes-ghidra.md
    - /tmp/260902-ech-PRE.md
  key_links:
    - "The pre-edit snapshot is the ONLY baseline available (the file is untracked, so there is no git diff to compare against). Task 1 must take it before touching the file, or task 2's proof is impossible."
---

# Strip unverifiable ChatGPT-artifact citations

<objective>
Remove the 7 inline `([Name][N])` citation markers and the 6 trailing `[N]: https://...`
link definitions from `docs/undocumented-opcodes-ghidra.md`, leaving every other byte of
the file unchanged.

Purpose: 5 of the 6 URLs carry `utm_source=chatgpt.com` tracking parameters — they are an
artifact of the chat session that produced the document, not a bibliography anyone
assembled or checked. Reference `[4]` points at `github.com/noop-dev/VICE_emu`, a
third-party fork mirror of VICE's `64doc.txt` rather than upstream VICE. None of the six
were ever verified against their claimed sources. A citation nobody checked is worse than
no citation, because it borrows authority it has not earned.

What survives, deliberately: the author's own caveat sentence at line 766 ("One caveat: I
validated the opcode coverage and wrote this against the current Ghidra SLEIGH
definitions, but I don't have Ghidra's SLEIGH compiler installed..."). That sentence is the
document's honest provenance signal — it states plainly what was and was not verified. It
is the thing the fake citations were crowding out, and it MUST NOT be touched.

Output: one modified file, one commit containing that file and nothing else.
</objective>

<context>
@.planning/STATE.md
@CLAUDE.md
</context>

## Verified facts (re-confirmed against the working tree on 2026-09-02)

All of the following were measured, not assumed. The executor must re-confirm the counts
as a precondition (task 1) because the file is untracked and unguarded, so it can drift.

| Fact | Value |
|------|-------|
| Target | `docs/undocumented-opcodes-ghidra.md` |
| Line count (pre-edit) | 776 |
| Git status | untracked (`??`) — **no git baseline exists** |
| Inline markers | 7, at lines 558, 628, 638, 693, 712, 737, 762 |
| Marker shape | all 7 are at end-of-line, all 7 preceded by exactly one space, all 7 follow a full stop |
| Link definitions | 6, at lines 771-776 |
| Orphaned blank lines | 4, at lines 767-770 (separate the caveat paragraph from the link defs) |
| `utm_source` occurrences | 5 |
| Other reference-style links | none — `grep -n '\]\['` returns exactly the 7 markers |
| Caveat sentence | line 766, the last line of real content |
| EOF | file ends with exactly one newline |
| Lines removed by this task | 10 (4 blank + 6 link defs) → final count 766 |

### Two drift findings the executing agent must know

**1. The git state in the task brief is stale.** The brief describes branch
`chore/purge-external-analyser-refs` with 592 unstaged + 22 staged files. The actual tree
on 2026-09-02 is branch `main`, **zero** staged files, **zero** modified tracked files, and
five untracked paths:

```
?? .planning/state.json
?? docs/dissambler-workflow.md
?? docs/undocumented-opcodes-ghidra.md
?? docs/vice-mcp-ideas.md
?? skills-lock.json
```

The "explicit path in `git add`" constraint still stands and is still load-bearing — just
for a different reason than the brief gave. `git add -A` / `git add .` / `git commit -a`
would now sweep in the **four other untracked files** (`.planning/state.json`,
`docs/dissambler-workflow.md`, `docs/vice-mcp-ideas.md`, `skills-lock.json`), three of
which have been carried deliberately untracked across Phases 31 and 32 as scratch files and
are named as the expected baseline in several phase summaries. Committing them by accident
would be a real regression. **Do not use `-A`, `.`, or `-a`.**

**2. Three live documents cite this file as "776 lines" and will read stale at 766.**

- `.planning/ROADMAP.md:479`
- `.planning/PROJECT.md:976`
- `.planning/todos/pending/2026-09-01-ghidra-headless-one-command-6502-decompile-wrapper-proposal.md:105`

(A fourth, `.planning/milestones/v0.7.0-ROADMAP.md:1073`, is an archived milestone snapshot
and is correct as a historical record — leave it.)

These are **deliberately out of scope**: the task constraints restrict this change to a
single file and a single-path commit. They are recorded here rather than silently absorbed.
The executor MUST report them in the SUMMARY as a known, accepted consequence so the user
can decide whether to fix them separately. Do not edit them in this task.

No live CI guard, test, or script references this file or asserts the four-file untracked
baseline (`grep -rln` over `scripts/`, `src/`, `.github/` returns nothing), so this change
cannot redden the suite.

### Pre-existing trailing whitespace — do NOT fix

Lines **584**, **594** and **743** each end with a trailing space. This is pre-existing and
has nothing to do with the citations. It must survive untouched — "do not reword, reflow or
improve any prose" includes not tidying whitespace the task did not create. Task 2 asserts
the count is still exactly 3.

### The removal recipe (dry-run proven)

This exact two-stage pipeline was run against a scratch copy of the current file and
produced the intended 766-line result with all gates green. It is drift-robust: it keys on
patterns, not on line numbers.

Stage 1 — strip markers: `sed -E 's/ \(\[[^]]*\]\[[0-9]+\]\)$//'`
  Anchored to end-of-line, and consumes the single leading space, so `...matrices. ([C64 Wiki][1])`
  becomes `...matrices.` — terminating period kept, no trailing space, no doubled space.

Stage 2a — drop link definitions: `sed -E '/^\[[0-9]+\]: /d'`

Stage 2b — drop the now-orphaned trailing blank lines only:
  `awk '/^$/{b=b "\n"; next} {printf "%s", b; b=""; print}'`
  This buffers blank runs and emits them only when a non-blank line follows, so interior
  blank lines are preserved exactly and only the trailing run is dropped. Verified: the
  first 600 lines are byte-identical after the transform.

## Tasks

<tasks>

<task type="tracer">
  <name>Task 1: Snapshot the baseline, then perform the surgical removal end-to-end</name>
  <files>docs/undocumented-opcodes-ghidra.md, /tmp/260902-ech-PRE.md</files>
  <precondition>`docs/undocumented-opcodes-ghidra.md` exists, is untracked (`git status --porcelain` shows `?? docs/undocumented-opcodes-ghidra.md`), is 776 lines, and carries exactly 7 inline markers and 6 link definitions. If any count differs, the file drifted since planning — HALT and report the actual counts rather than adapting the recipe silently.</precondition>
  <action>
    Work from the repo root `/home/henrik/dev/henrik/git/c64-re-tools`.

    FIRST, before any edit, copy the file to `/tmp/260902-ech-PRE.md` and record its
    `sha256sum` — this snapshot is the only baseline that will ever exist, because the file
    is untracked and `git diff` has nothing to compare against. If the snapshot is not taken
    first, the proof required by task 2 becomes impossible. At planning time the file's
    sha256 began `151fefe69553407e`; a different value simply means the file drifted, which
    the precondition already covers.

    THEN apply the two-stage pipeline from "The removal recipe" above, writing through a
    temp file and moving it into place (do not edit in place with `sed -i` and a separate
    truncation step — a single atomic replace keeps the file consistent if anything fails
    mid-way).

    Touch NOTHING else. Do not open, stage, revert or modify any other path — in particular
    not the four other untracked files. Do not rewrite, reword, reflow or improve any prose.
    Do not modify any SLEIGH source line. Do not add replacement citations, footnotes, or a
    References section. Do not tidy the pre-existing trailing spaces on lines 584, 594, 743.
  </action>
  <verify>
    <automated>cd /home/henrik/dev/henrik/git/c64-re-tools && sed -E 's/ \(\[[^]]*\]\[[0-9]+\]\)$//' /tmp/260902-ech-PRE.md | sed -E '/^\[[0-9]+\]: /d' | awk '/^$/{b=b "\n"; next} {printf "%s", b; b=""; print}' > /tmp/260902-ech-EXPECTED.md && diff /tmp/260902-ech-EXPECTED.md docs/undocumented-opcodes-ghidra.md && echo TRACER_OK</automated>
  </verify>
  <done>`/tmp/260902-ech-PRE.md` exists and its sha256 is recorded in the SUMMARY. The edited file reproduces the expected transform of that snapshot byte-for-byte; `diff` is silent and `TRACER_OK` prints.</done>
</task>

<task type="auto">
  <name>Task 2: Prove the removal mechanically against the pre-edit snapshot</name>
  <files>docs/undocumented-opcodes-ghidra.md (read-only), /tmp/260902-ech-PRE.md (read-only)</files>
  <precondition>`/tmp/260902-ech-PRE.md` exists and was captured by task 1 before any edit.</precondition>
  <action>
    Run the five gates below and quote every command's actual output verbatim in the
    SUMMARY. This task changes no files; it only proves the claim.

    (a) zero matches for `utm_source`.
    (b) zero matches for the inline-marker pattern.
    (c) zero matches for the link-definition pattern.
    (d) the caveat sentence is still present, exactly once.
    (e) the line count dropped by exactly 10 relative to the snapshot, and the only changed
        content is the 13 known sites — proven as: `diff` of snapshot against result yields
        exactly 17 removed lines (7 rewritten marker lines + 4 blank + 6 link definitions)
        and exactly 7 added lines (the 7 rewritten marker lines).

    Also assert the two negative invariants: the trailing-space line count is still exactly
    3 (lines 584, 594, 743 untouched), and no line anywhere gained a doubled space before a
    full stop.

    Note that the expected line count is derived from the snapshot rather than hardcoded, so
    the gate stays honest if the file drifted before execution.
  </action>
  <verify>
    <automated>cd /home/henrik/dev/henrik/git/c64-re-tools && F=docs/undocumented-opcodes-ghidra.md && P=/tmp/260902-ech-PRE.md && test "$(grep -c 'utm_source' $F)" = 0 && test "$(grep -cE '\(\[[^]]*\]\[[0-9]+\]\)' $F)" = 0 && test "$(grep -cE '^\[[0-9]+\]: ' $F)" = 0 && test "$(grep -c 'One caveat: I validated the opcode coverage' $F)" = 1 && test "$(wc -l < $F)" = "$(( $(wc -l < $P) - 10 ))" && test "$(diff $P $F | grep -c '^<')" = 17 && test "$(diff $P $F | grep -c '^>')" = 7 && test "$(grep -cE ' $' $F)" = 3 && test "$(grep -cE '  \.' $F)" = 0 && echo GATES_OK</automated>
  </verify>
  <done>All nine assertions pass and `GATES_OK` prints. Each gate's individual output is quoted in the SUMMARY, not merely asserted to have passed.</done>
</task>

<task type="auto">
  <name>Task 3: Commit the single file, and nothing else</name>
  <files>docs/undocumented-opcodes-ghidra.md</files>
  <precondition>Tasks 1 and 2 both green. `git status --porcelain` still lists the four other untracked files as untracked and shows no staged or modified tracked paths.</precondition>
  <action>
    Stage ONLY the explicit path: `git add docs/undocumented-opcodes-ghidra.md`.

    Before committing, assert the index holds exactly that one path — `git diff --cached
    --name-only` must output that single line and nothing more. If it shows anything else,
    unstage and HALT; something swept in extra paths.

    NEVER use `git add -A`, `git add .`, or `git commit -a`. Those would sweep in
    `.planning/state.json`, `docs/dissambler-workflow.md`, `docs/vice-mcp-ideas.md` and
    `skills-lock.json`, which are carried untracked on purpose.

    Commit message subject: `docs: strip unverified chat-artifact citations from undocumented-opcodes-ghidra.md`

    In the body, state plainly what was removed and why: 7 inline reference markers and 6
    link definitions, 5 of which carried `utm_source=chatgpt.com` tracking parameters and
    none of which were verified against their claimed sources; reference [4] pointed at a
    third-party fork mirror of VICE's 64doc.txt rather than upstream. Record that the
    author's own caveat sentence was preserved deliberately as the document's honest
    provenance signal, and that the file is otherwise byte-identical.

    Then report in the SUMMARY: the three stale "776 lines" citations named in the Context
    section above, which now read one line-count out of date and were left unedited because
    this task is scoped to a single file. Present them as an open item for the user, not as
    something handled.
  </action>
  <verify>
    <automated>cd /home/henrik/dev/henrik/git/c64-re-tools && test "$(git show --name-only --format= HEAD | grep -c .)" = 1 && git show --name-only --format= HEAD | grep -qx 'docs/undocumented-opcodes-ghidra.md' && test "$(git status --porcelain | grep -cE '^\?\? (\.planning/state\.json|docs/dissambler-workflow\.md|docs/vice-mcp-ideas\.md|skills-lock\.json)$')" = 4 && test "$(git status --porcelain | grep -c 'undocumented-opcodes')" = 0 && test "$(git status --porcelain | grep -vc '^??')" = 0 && echo COMMIT_OK</automated>
  </verify>
  <done>HEAD is a commit touching exactly one path, `docs/undocumented-opcodes-ghidra.md`. The four other untracked files remain untracked and unmodified. `COMMIT_OK` prints.</done>
</task>

</tasks>

<verification>
Run in order; all three must be green before the task is considered done:

1. `TRACER_OK` — the edited file is exactly the expected transform of the pre-edit snapshot.
2. `GATES_OK` — all nine mechanical assertions (a)-(e) plus the two negative invariants.
3. `COMMIT_OK` — the commit holds one path; the four untracked scratch files are undisturbed.

If any gate fails, restore from `/tmp/260902-ech-PRE.md` and report rather than iterating
blind — the snapshot is the only recovery path for an untracked file.
</verification>

<success_criteria>
- `grep -c 'utm_source' docs/undocumented-opcodes-ghidra.md` returns 0.
- Zero inline `([Name][N])` markers; zero `^[N]: ` link definitions.
- The "One caveat: I validated the opcode coverage" sentence is present and byte-identical.
- Line count is 766 (was 776); exactly 10 whole lines removed.
- No doubled space, no space-before-period, no new trailing whitespace introduced; the 3
  pre-existing trailing-space lines are untouched.
- Every SLEIGH source line unchanged.
- One commit, one path.
- The three stale "776 lines" citations are reported as an open item, not silently ignored.
</success_criteria>

<output>
Create `.planning/quick/260902-ech-strip-unverifiable-chatgpt-artifact-cita/260902-ech-SUMMARY.md` when done.
</output>
