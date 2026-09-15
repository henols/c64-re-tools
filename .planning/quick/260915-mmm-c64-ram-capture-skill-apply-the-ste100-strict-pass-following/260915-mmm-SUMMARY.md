---
quick_id: 260915-mmm
phase: quick-260915-mmm
plan: 01
subsystem: docs
tags: [ste100, asd-ste100, c64-ram-capture, skill-docs, lint]

actuals:
  tokens: 21000
  tasks: 3
  commits: 3

key-files:
  modified:
    - src/skills/c64-ram-capture/SKILL.md
    - src/skills/c64-ram-capture/templates/capture-record.template.md
    - src/skills/c64-ram-capture/transients/README.md

requirements-completed: [QUICK-260915-mmm]

duration: 15min
completed: 2026-09-15
status: complete
---

# Quick 260915-mmm: STE100 strict pass over c64-ram-capture Summary

**Applied the ASD-STE100 strict pass to all three markdown files of the `c64-ram-capture`
skill, cutting the combined `ste-lint.py` violation count from 68 to 4 with no change to
any fact, condition, scope qualifier or hedge.**

## Per-file counts

| File | Baseline | Final | Delta |
|---|---|---|---|
| `SKILL.md` | 46 | 3 | -43 |
| `templates/capture-record.template.md` | 12 | 0 | -12 |
| `transients/README.md` | 10 | 1 | -9 |
| **Total** | **68** | **4** | **-64** |

All three per-file counts are below their required baselines (46 / 12 / 10), and the
combined count (4) is below the combined baseline (68).

## Per-rule breakdown of what was removed

- **Semicolons removed:** 23 (`SKILL.md`) + 1 (template) + 2 (`README.md`) = 26. Each became
  a full stop and a new sentence, or (once, in the `KEYBOARD_FEED` paragraph) stayed a comma
  where the join was a simple coordinated clause.
- **Synonym-rotation clusters resolved (all 3, in `SKILL.md`):**
  - **check cluster** (`confirm` / `check` / `validated`) — replaced `confirm` at all four
    procedure sites (lines 56, 72, 109, 176 pre-edit) with `check`, and rewrote the
    `validated by the renderer` passive into an active clause naming the renderer as the
    actor and using `checks`. Left the adjective `verified` alone — a term of art the linter
    cannot see.
  - **start cluster** (`launch` / `start`) — reworded the sentence about the broker
    setting the drive type at the spawn event into "Every time the broker starts a stock
    instance, it sets the drive type", making the broker the actor of `starts`.
  - **correct cluster** (`fixed` / `correct` / `Fix` / `Fixed`) — rewrote "the keys are
    fixed" as the active "the keys never change". This also removed a passive-voice flag
    at the same site. It renamed the Troubleshooting table's `Fix` column header to
    `Correction`, and restated `Fixed 2026-08-04` as `Corrected 2026-08-04`. `correct` at
    line 159 (`"ranges-only" ... That is correct and transient`) was already the survivor.
    It needed no change.
- **Passive-voice conversions:** 12 in `SKILL.md` (of 15 flagged). 2 stay as lookup-row
  passives. 1 present-perfect stays, see below. 9 changed in the template. 7 changed in
  `README.md` (of 8 flagged). 1 stays as an unattributable measurement record. Named
  actors throughout: the proxy, the broker, `derive`, `compare-cross-binary.mjs`, the
  renderer, the reader, a test, `normalisePorts()`, this project, `vice_memory_read`.
- **Long sentences split:** 3 in `SKILL.md`'s `## References` table (27, 27, 28 words,
  each split inside its own cell without splitting the row), 2 in the template's
  `$D000-$DFFF` route table (38, 44 words, same rule).

## Deliberate exceptions (kept as-is)

- **`SKILL.md` line 72/74 area, `"has moved"`** (present-perfect). Kept: "the program
  counter has moved" states that the counter now differs from the value recorded before
  boot — current relevance, which the simple past would lose.
- **`SKILL.md`, `"Whether the emulator is wedged"`** (Which-skill-does-what lookup table).
  Kept passive: the object (the emulator's wedged state) is the topic of the lookup row,
  per the binding rules' lookup-row exception.
- **`SKILL.md`, `"no address set is inherited between releases"`** (References table, the
  `transients/README.md` row). Kept passive for the same lookup-row reason; this row also
  needed a length split (28 words), which was done without touching the kept passive.
- **`README.md`, `"A frame-anchored autostarted stop has already been measured over the
  cap at one jitter and under it at another."`** Kept passive: this is a measurement
  record with no genuine actor (nobody is credited with taking the two reference
  measurements), and inventing one ("someone measured...") would assert a fact not in the
  source.

No fact, measured number (`$D344`, `$D625`, `$D628`, `$FAD8`, `$FC51`, the four
`derive`-overflow reference points 0/66/300/1242, `TRANSIENT_ALLOW_LIST_CAP = 64`,
`STOCK_DETERMINISM_SEED`, `4242`, the 76-byte MEASURED claim, N ≥ 3, N(N-1)/2), date,
`Confidence:`/`MEASURED`/`Observed` claim, or hedge (`unexplained`, `an open question`,
`graded MEDIUM`) changed in meaning anywhere in the three files.

## New violations introduced, then removed

One rewrite briefly introduced a duplicated word ("So the the proxy guards...") while
converting a passive sentence to active voice in `SKILL.md`'s epoch-drift section. Caught
on the full `git diff` review immediately after the edit and corrected before the file was
staged — it never reached a commit.

## Structural integrity (template hazard)

`templates/capture-record.template.md` is a machine-consumed contract. Verified after
editing:

- Every `#`/`##`/`###` heading is byte-identical to its pre-change text and position (7
  headings, diffed directly against `git show HEAD~1`).
- Every field name in the Identity table's left column (`image path`, `size`, `sha256`,
  `binary sha256`, `argv digest`, `seed`, `capture route`, `checkpoint / trigger address`,
  `release`, `run`) is byte-identical.
- Every placeholder token (`<release>`, `<checkpoint>`, `<N>`, `<total>`, `<name>`,
  `<64 hex chars>`, `$____`, `$__`, `%________`, `memory-read`, `snapshot`, `PAL`, `NTSC`,
  `none`, `0`, `.VOID-<UTC timestamp>`) is byte-identical — diffed as a sorted set against
  the pre-change file.
- Total table-row count (`^|` lines) is unchanged at 28, before and after.
- `SKILL.md`'s `description:` frontmatter field is byte-identical to its pre-change state
  (diffed directly against `git show HEAD~3`).

## Commits

- `64d5fce0` — `docs(quick-260915-mmm-01): apply STE100 strict pass to c64-ram-capture SKILL.md`
- `4f0b0c5c` — `docs(quick-260915-mmm-02): apply STE100 strict pass to the capture-record template`
- `6bd13eea` — `docs(quick-260915-mmm-03): apply STE100 strict pass to transients/README.md`

## Self-Check: PASSED

- `src/skills/c64-ram-capture/SKILL.md` — FOUND, count 3 (< 46)
- `src/skills/c64-ram-capture/templates/capture-record.template.md` — FOUND, count 0 (< 12)
- `src/skills/c64-ram-capture/transients/README.md` — FOUND, count 1 (< 10)
- Combined count over the three files: 4 (< 68)
- Commit `64d5fce0` — FOUND in `git log`
- Commit `4f0b0c5c` — FOUND in `git log`
- Commit `6bd13eea` — FOUND in `git log`
