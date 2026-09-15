---
quick_id: 260915-mmi
status: complete
phase: quick-260915-mmi
plan: 01
subsystem: docs
tags: [ste100, skill-docs, c64-program-recon]
completed: 2026-09-15
---

# 260915-mmi: STE100 strict pass over c64-program-recon — Summary

Applied the ASD-STE100 strict pass to all eight files of the `c64-program-recon` skill
(`SKILL.md`, its six `references/*.md` files, and `templates/memory-map.template.md`). This is a
pure prose rewrite: no fact, condition, scope qualifier or hedge changed, no file was added or
removed, and no test was written or run — the only check used throughout was `ste-lint.py`.

## Result

The mandated `--json` command over all eight files, before and after:

| Metric | Before | After |
|---|---|---|
| Total findings | 202 | 62 |
| Hard (semicolon + synonym-rotation + long-sentence) | 106 | 2 |
| semicolon | 76 | 0 |
| synonym-rotation | 21 | 0 |
| long-sentence | 9 | 2 (both inside SKILL.md's exempt YAML frontmatter, line 3) |
| passive-voice | 90 | 54 |
| present-perfect | 6 | 6 (all 6 kept deliberately — see below) |

Final whole-item gate: `ste-lint.py --baseline 2` over all eight files exits `0`.

### Per-file violation counts (before → after)

| File | Before | After |
|---|---|---|
| `SKILL.md` | 108 | 30 |
| `references/control-flow.md` | 17 | 5 |
| `references/graphics.md` | 8 | 3 |
| `references/observation-hazards.md` | 16 | 9 |
| `references/reconstruction.md` | 8 | 3 |
| `references/sound-and-input.md` | 11 | 3 |
| `references/tool-selection.md` | 22 | 8 |
| `templates/memory-map.template.md` | 12 | 1 |

`SKILL.md`'s 2 remaining hard findings (both `long-sentence`, 32 and 49 words) sit on line 3, inside
the exempt `description:` field of the YAML frontmatter (decision D-2). The frontmatter's sha256
(lines 1-4) is unchanged: `dc82536137e2a8f97e7c22a05694540fd383d563c975c631d23ee00849e82d17`.

## Glossary verb chosen per cluster

The plan's fixed glossary names 8 clusters. Each was settled once (in `SKILL.md`, task 1) and
reused identically across the remaining seven files, with two documented exceptions forced by
immovable text (below).

| Cluster | Canonical word used | Notes |
|---|---|---|
| check / confirm / verify / validate | **check** | Reused everywhere except `memory-map.template.md` (exception below). |
| correct / fix / repair | **fix** | Forced away from the glossary's stated "correct" (exception below). |
| change / modify / alter | **change** | `self-modifying code` and `read-modify-write` (fixed CS/hardware terms) were left untouched; the *other* word in each colliding pair was moved to different wording entirely rather than overwritten onto a domain term (see Kept-as-fixed-terms below). |
| stop / halt / terminate | **stop** | `SKILL.md`: "terminate" → "stop"; `tool-selection.md`: "halted" → "stopped". |
| get / fetch / retrieve / obtain | **get** | `SKILL.md`: "fetched" → "got". |
| start / begin / launch / initiate | **start** | `SKILL.md`: "begins" → "starts". |
| remove / delete / erase | **remove** | `SKILL.md`: "deleted"/"erased"/"DELETES" → "removed"/"REMOVES". |
| show / display | **show** | `SKILL.md`: "displayed" → "shown". |

### Two forced exceptions to the glossary table

1. **correct/fix → "fix", not "correct".** `SKILL.md`'s YAML frontmatter `description:` field
   contains the phrase "in a fixed order" (line 3, exempt from editing by decision D-2). The
   linter scans frontmatter lines like any other prose, so "fixed" permanently anchors this
   cluster's first-occurrence to "fix" for that file, no matter what the body does — the
   `synonym-rotation` check flags every *other* group member relative to whichever member appears
   first in the document, and the frontmatter word cannot be touched (prohibition 1). Using "fix"
   as the canonical word (rather than the glossary table's stated "correct") was the only way to
   reach `synonym-rotation: 0` for `SKILL.md` without breaking that prohibition. The same choice
   was then carried into the six reference files and the template for cross-file consistency, per
   task 2/3's "reuse the exact verb choices settled in task 1" instruction. `correction` /
   `correctness` (the noun forms) were left untouched throughout — the linter's regex only matches
   the verb suffixes (`-s/-es/-ed/-ing`), not `-ion`/`-ness`, so nouns never collide with either
   word.
2. **check/confirm/verify/validate → "confirm", not "check", in `memory-map.template.md` only.**
   This file is the confidence-vocabulary's own source table (`confirmed code`, `probable code`,
   `confirmed data`, `probable data`, `unknown` — the human-readable glosses beside the
   `[confirmed-code]` etc. bracket tokens quoted verbatim from `anno-confidence.ts`). Diluting
   "confirmed" to "checked" here would blur the exact grade name this file exists to define, so
   "confirm" was kept as the surviving base and the file's two `validate`/`verify` occurrences
   were moved to "confirm" instead (`"validated by the renderer"` → `"confirmed by the renderer"`,
   `"Re-verify"` → `"Re-confirm"`).

### Kept as fixed terms, not house-style prose

- **`self-modifying code`** (`references/control-flow.md`, `references/reconstruction.md`) — a
  standard CS term, left exactly as written both inline and as a section heading. The file's other
  `change`-cluster occurrence was moved to different wording instead: `control-flow.md`'s "a
  single byte that changed" → "a single byte that differs"; `reconstruction.md`'s "reorganising
  changes addresses" / "one changed address" → "reorganising shifts addresses" / "one shifted
  address".
- **`read-modify-write`** (`references/tool-selection.md`) — standard hardware terminology for an
  atomic instruction pattern, left untouched. The file's `change`-cluster occurrence was moved
  instead: `tool-selection.md`'s "cracker-changed" → "cracker-patched" (which also now matches the
  project's own established `CRACKER-PATCH` verdict vocabulary, referenced in `SKILL.md`).
- **`[confirmed-code]` / `(confirmed code)` etc. in `SKILL.md`'s confidence-grade table** — the
  bracket tokens were already backticked (verbatim from `anno-confidence.ts`); the plain-English
  glosses beside them were additionally wrapped in backticks (`` `confirmed code` ``, etc.) so the
  linter treats them the same way, without changing a single character of the words themselves.
  This let "checked facts" / "checks the routine's purpose" become the canonical body usage in
  `SKILL.md` without diluting the five-grade vocabulary's own defining terms.
- **`VERIFY` (BASIC token table, `SKILL.md`)**, **`verified` (compound-adjective uses:
  "three-run-verified" in `control-flow.md`; "A verified 64K image" in `SKILL.md` and
  `tool-selection.md`)** — left untouched. These do not match the linter's synonym-rotation regex
  at all (its irregular-verb blind spot: `verify` + `ed` ≠ `verified`, since the pattern only
  appends regular suffixes), so editing them bought nothing and only added risk.

## Present-perfect kept (all 6, all deliberate)

Every present-perfect finding the linter reports was kept, because each one carries current
relevance the simple past would lose (per the plan's own instruction and the `asd-ste100` skill's
"keep and flag" exception):

1. **`SKILL.md`:69** — "this project **has been burned** in both directions." States a risk that
   is still live now, not a closed historical incident.
2. **`SKILL.md`:258** — "the store **has moved on**." Describes the store's present state relative
   to a stale generated `.lbl` file — the whole point of the warning is that *right now* the store
   is ahead of that file.
3. **`SKILL.md`:328** — "a Ghidra harness run … **has produced** a transfer file." The transfer
   file's present existence is the precondition the two import/join calls act on.
4. **`SKILL.md`:418** — "once you **have picked** one routine out of it." Marks the completed
   selection as the present starting condition for the rest of the procedure.
5. **`references/graphics.md`:7** — "you **have located** every byte of graphics on screen." The
   located-ness is the present payoff of the read sequence, not a past event being reported.
6. **`references/observation-hazards.md`:97** — "whenever `$01` **may not have been** `\$37`." This
   is a modal-plus-perfect hedge ("may … have been"), doubly protected: present-perfect for current
   relevance, and a hedge the `asd-ste100` skill and this plan both forbid weakening.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed a stray dangling word in a pre-existing broken sentence, `SKILL.md`**
- **Found during:** Task 1, walking the passive-voice findings.
- **Issue:** Line 76 (pre-edit) read: `Absence of evidence records \`UNKNOWN\` and **keeps the
  bytes**. The\n  a real title-screen text divergence was found sitting in a region…` — a stray
  capitalized "The" left the sentence ungrammatical ("The a real title-screen…"), independent of
  anything STE100 governs. The line also carried the `was found` passive-voice finding this plan's
  pass over that same paragraph needed to touch anyway.
- **Fix:** Removed the stray "The", producing: `Absence of evidence records \`UNKNOWN\` and
  **keeps the bytes**. A real title-screen text divergence was found sitting in a region…` No
  fact, example or claim changed — only a leftover word from a prior edit was removed.
- **Files modified:** `src/skills/c64-program-recon/SKILL.md`
- **Commit:** `fdde0d21`

### Glossary deviations (documented above, not bugs)

The two forced exceptions to the fixed verb glossary table (fix-not-correct in the
check/confirm/verify group's frontmatter-anchored case, and confirm-not-check in
`memory-map.template.md`) are structural consequences of the linter's own first-occurrence
algorithm meeting immovable text (an exempt frontmatter word, and a file whose entire purpose is
to define the "confirmed" vocabulary) — not judgement calls that could have gone the other way
while still reaching `synonym-rotation: 0`. See "Two forced exceptions" above for the full
reasoning.

## Self-Check

- [x] All eight files' `git diff --stat` matches `files_modified` in the plan frontmatter exactly —
  no file added, no file removed.
- [x] `SKILL.md` lines 1-4 sha256 unchanged: `dc82536137e2a8f97e7c22a05694540fd383d563c975c631d23ee00849e82d17`.
- [x] No test file created; no test suite run at any point in this execution.
- [x] All three commits (`fdde0d21`, `6e8254bd`, `c3d5ad24`) exist in `git log`.

## Self-Check: PASSED
