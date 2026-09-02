---
task: Strip unverifiable ChatGPT-artifact citations from docs/undocumented-opcodes-ghidra.md
date: 2026-09-02
mode: quick
type: execute
status: complete
subsystem: docs
tags: [provenance, citations, ghidra, sleigh, cleanup]

requires: []
provides:
  - "docs/undocumented-opcodes-ghidra.md carries zero unverified third-party citations"
affects:
  - docs/undocumented-opcodes-ghidra.md

tech-stack:
  added: []
  patterns:
    - "Untracked-file surgery proven against a pre-edit /tmp snapshot rather than git diff"

key-files:
  created:
    - docs/undocumented-opcodes-ghidra.md   # created in git terms: was untracked, now tracked
  modified: []

decisions:
  - "Removed the 6 citations outright rather than repairing them: 5 carried utm_source=chatgpt.com and none had been verified against their claimed sources."
  - "Preserved the author's own caveat sentence byte-identical as the document's honest provenance signal."
  - "Left the three stale '776 lines' cross-references unedited — out of scope for a single-path commit; reported as an open item."
  - "Did not run any gsd state.* verb: they are documented to corrupt STATE.md, and any edit would leave a tracked modification this task is forbidden to commit."

metrics:
  duration: ~8 min
  completed: 2026-09-02

actuals:
  tokens: 4966      # chars/4 over docs/undocumented-opcodes-ghidra.md post-edit (19866 bytes)
  tasks: 3
  commits: 1
---

# Quick Task 260902-ech: Strip unverifiable ChatGPT-artifact citations — Summary

Removed 7 inline `([Name][N])` reference markers and the 6 trailing `[N]: https://...`
link definitions from `docs/undocumented-opcodes-ghidra.md` — 5 of which carried
`utm_source=chatgpt.com` tracking parameters and none of which had ever been verified —
leaving all 766 remaining lines byte-identical, including the author's own caveat sentence.

## What was done

| Task | Name | Outcome | Commit |
|------|------|---------|--------|
| 1 (tracer) | Snapshot baseline, perform surgical removal | `TRACER_OK` | (folded into 3) |
| 2 | Prove removal mechanically against snapshot | `GATES_OK` | (read-only, no commit) |
| 3 | Commit the single file, and nothing else | `COMMIT_OK` | `6749c66` |

One atomic commit, per the task constraint. Task 1 produced the edit; task 2 changed no
files; task 3 committed. Committing at task 1 as well would have produced two commits and
violated the single-commit constraint.

## Precondition re-confirmation (task 1)

Every planned fact was re-measured against the working tree before any edit, and every one
matched planning time exactly — the file had not drifted:

```
branch                = main
git status            = ?? docs/undocumented-opcodes-ghidra.md  (untracked)
line count            = 776
sha256                = 151fefe69553407ea192ab1db87167fc3dcd6b6c704f9c67c7dfbaf50c0fc26a
inline markers        = 7
link definitions      = 6
utm_source            = 5
trailing-space lines  = 3
staged/modified tracked paths = 0
```

The sha256 prefix `151fefe69553407e` is the exact value the plan recorded at planning time.

## Baseline snapshot

`/tmp/260902-ech-PRE.md` was taken **before** any edit — it is the only baseline that will
ever exist, because the file was untracked and `git diff` had nothing to compare against.

| Artifact | sha256 |
|----------|--------|
| `/tmp/260902-ech-PRE.md` (pre-edit, 776 lines) | `151fefe69553407ea192ab1db87167fc3dcd6b6c704f9c67c7dfbaf50c0fc26a` |
| `docs/undocumented-opcodes-ghidra.md` (post-edit, 766 lines) | `665609331710644e1f5a1b461b69ad5253ddc374402966ccacf7e40d75f7232b` |

## Gate results — actual observed values

Each gate was run individually and its real output captured, not merely asserted to pass.

### Task 1 — `TRACER_OK`

Re-derived the expected transform from the snapshot and diffed it against the edited file:

```
$ sed -E 's/ \(\[[^]]*\]\[[0-9]+\]\)$//' /tmp/260902-ech-PRE.md \
  | sed -E '/^\[[0-9]+\]: /d' \
  | awk '/^$/{b=b "\n"; next} {printf "%s", b; b=""; print}' > /tmp/260902-ech-EXPECTED.md
$ diff /tmp/260902-ech-EXPECTED.md docs/undocumented-opcodes-ghidra.md
TRACER_OK
```

`diff` was silent — the edited file is byte-for-byte the expected transform of the snapshot.

File mode was preserved across the atomic `mv` from `/tmp`: `664`, identical to the sibling
untracked doc `docs/vice-mcp-ideas.md`.

### Task 2 — `GATES_OK` (nine assertions, individually measured)

| # | Gate | Expected | **Actual observed** |
|---|------|----------|---------------------|
| a | `grep -c 'utm_source'` | 0 | **0** |
| b | `grep -cE '\(\[[^]]*\]\[[0-9]+\]\)'` | 0 | **0** |
| c | `grep -cE '^\[[0-9]+\]: '` | 0 | **0** |
| d | `grep -c 'One caveat: I validated the opcode coverage'` | 1 | **1** |
| e1 | line count = snapshot − 10 | 766 | **766** (snapshot **776**) |
| e2 | `diff PRE POST \| grep -c '^<'` | 17 | **17** |
| e3 | `diff PRE POST \| grep -c '^>'` | 7 | **7** |
| f | `grep -cE ' $'` (trailing-space lines) | 3 | **3** |
| g | `grep -cE '  \.'` (doubled space before period) | 0 | **0** |

The combined chained command printed `GATES_OK`.

The 17 removed / 7 added split decomposes exactly as planned: 7 marker lines rewritten in
place (7 `<` + 7 `>`), plus 10 whole lines deleted (4 orphaned blanks at 767–770 and 6 link
definitions at 771–776) contributing 10 further `<` and no `>`.

### Negative invariants — confirmed by direct inspection

- **Trailing whitespace untouched.** The 3 pre-existing trailing-space lines are still at
  lines **584, 594, 743** — same line numbers as before, since every removal is at line 767
  or later. They were deliberately not tidied.
- **No SLEIGH source line changed.** The full `diff` contains only the 13 known citation
  sites; no SLEIGH definition appears in it.
- **Caveat sentence byte-identical.** `cmp` of line 766 pre vs. post is silent. It remains
  the last line of real content.
- **EOF.** The file ends with exactly one newline (`0a`); the 4 orphaned blank lines are
  gone and no new trailing blank was introduced.

### Task 3 — `COMMIT_OK`

```
$ git add docs/undocumented-opcodes-ghidra.md
$ git diff --cached --name-only
docs/undocumented-opcodes-ghidra.md
$ git diff --cached --name-only | grep -c .
1
```

Index held exactly one path before committing. `git add -A`, `git add .` and `git commit -a`
were never used.

```
$ git show --name-only --format= HEAD
docs/undocumented-opcodes-ghidra.md          # exactly 1 path
$ git diff --diff-filter=D --name-only HEAD~1 HEAD | grep -c .
0                                            # zero deletions
COMMIT_OK
```

Commit `6749c66` on `main`, `1 file changed, 766 insertions(+)`. It registers as
`create mode 100644` because the file was previously untracked — this is the file entering
git, not a rewrite.

Post-commit `git status --porcelain`, showing the four deliberately-untracked scratch files
undisturbed:

```
?? .planning/quick/260902-ech-strip-unverifiable-chatgpt-artifact-cita/
?? .planning/state.json
?? docs/dissambler-workflow.md
?? docs/vice-mcp-ideas.md
?? skills-lock.json
```

Zero staged and zero modified tracked paths remain.

## What was removed, and what each reference actually pointed at

| Ref | Line | Target | Problem |
|-----|------|--------|---------|
| `[1]` | 558 | `c64-wiki.com/wiki/illegal_opcodes` | `utm_source=chatgpt.com` |
| `[2]` | 628 | `github.com/NationalSecurityAgency/ghidra/wiki/FAQ` | `utm_source=chatgpt.com` |
| `[3]` | 638 | `.../analyzeHeadlessREADME.md` | `utm_source=chatgpt.com` |
| `[4]` | 693, 762 | `github.com/noop-dev/VICE_emu/.../64doc.txt` | third-party **fork mirror** of VICE's `64doc.txt`, not upstream VICE |
| `[5]` | 712 | `ghidra.re/.../sleigh_definitions.html` | `utm_source=chatgpt.com` |
| `[6]` | 737 | `github.com/.../ghidra/discussions/5584` | `utm_source=chatgpt.com` |

`[4]` is the one reference without a tracking parameter, and it is the one pointing at a
fork mirror rather than the upstream source it claims. None of the six had been checked
against what they were cited for.

## Deviations from Plan

None — the plan executed exactly as written. No auto-fix rule fired; no gate needed
loosening; no drift was found.

## Known Stubs

None. This task removed content; it introduced no placeholder, TODO, or unwired code path.

## Open item for the user — three now-stale "776 lines" cross-references

**Not handled by this task, by design.** The task is constrained to a single file and a
single-path commit. These three live documents describe the file as "776 lines" and now read
one line-count out of date at **766**. All three were re-confirmed to still say 776 after the
commit:

| File | Line | Text (truncated) |
|------|------|------------------|
| `.planning/ROADMAP.md` | 479 | "…`docs/undocumented-opcodes-ghidra.md`, 776 lines, all 105 bytes…" |
| `.planning/PROJECT.md` | 976 | "…`docs/undocumented-opcodes-ghidra.md`, 776 lines, all…" |
| `.planning/todos/pending/2026-09-01-ghidra-headless-one-command-6502-decompile-wrapper-proposal.md` | 105 | "…exists in full at `docs/undocumented-opcodes-ghidra.md` (776 lines,…" |

A fourth hit, `.planning/milestones/v0.7.0-ROADMAP.md:1073`, is an **archived milestone
snapshot** and is correct as a historical record — it should be left at 776.

The claim these three make is otherwise still true (the SLEIGH source is complete, all 105
bytes covered); only the line count moved, and it moved because 10 lines of unverified
citation apparatus left. **The orchestrator/user decides** whether to correct the three in a
follow-up.

## CI impact

None. `grep -rln 'undocumented-opcodes-ghidra' scripts/ src/ .github/` returns **0** files,
so no test, guard, or packaging check reads this document or asserts its length. This change
cannot redden the suite.

## STATE.md

Deliberately left untouched and clean. Running the `gsd query state.*` verbs is documented in
this project's operating memory as corrupting STATE.md (`state.add-decision`,
`record-session` and `add-blocker` each have known defects requiring hand-repair), and any
edit would leave a modified tracked file that this task's constraints forbid committing —
producing a dirty tree rather than a clean one. ROADMAP.md was likewise not updated, per the
quick-task constraint.

## Self-Check: PASSED

- `docs/undocumented-opcodes-ghidra.md` — FOUND (766 lines, sha256 `665609331710644e…`)
- `/tmp/260902-ech-PRE.md` — FOUND (776 lines, sha256 `151fefe69553407e…`)
- Commit `6749c66` — FOUND in `git log`, HEAD of `main`, exactly 1 path
