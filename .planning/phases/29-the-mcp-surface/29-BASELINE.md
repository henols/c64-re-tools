# Phase 29 — Pre-phase measured baseline

> Taken **2026-08-29**, before this phase deletes anything, at commit
> **`c27922ac44b16d70b7019858650aaaba71fae068`** (`docs(29): record planning
> complete — 12 plans in 8 waves`).
>
> Written by plan **29-02 Task 1**, whose whole purpose is that every later
> "is this green?" question in this phase has a **defined comparison target**.
> The full-glob suite has a non-zero failure baseline. Comparing against zero
> would either hide a regression or invent one.

---

## How this baseline is to be used (blocking)

**The phase gate compares the failing-file SET against the set recorded below —
never a count against zero.**

- A **file name appearing** in the failing set that is not recorded here is a
  **regression**, and it is attributed to the plan that introduced it.
- A **file name disappearing** from the recorded set is an **improvement**, and
  it must be **explained** in that plan's summary rather than silently banked.
  A guard that stopped failing because it stopped asserting is not an
  improvement.
- The **count** is secondary evidence. Two of the three failing files below are
  environment- or load-sensitive, so the count moves without the set moving.

---

## Environment at the time of the run

| Property | Value |
|---|---|
| Commit | `c27922ac44b16d70b7019858650aaaba71fae068` |
| Host | Linux 6.12.105+deb13-amd64, Node **v22.22.0** |
| **VICE broker running before the run?** | **No.** `systemctl --user status vice-broker` → `Unit vice-broker.service could not be found`; `ps aux | grep -E 'vice-broker\|x64sc'` → no matching processes. |
| **Stop command used** | **None was needed** — the broker was already down, so nothing was stopped. Had it been up, the stop is `systemctl --user stop vice-broker` (the project rule: the broker must run as a systemd user unit; `setsid`/`nohup` dies with the session). |
| Why this matters | A **live** broker makes `BACK-05`'s test fail deterministically. A baseline taken with the broker up would bake a phantom failure into the comparison set. |
| Emulator present? | No `x64sc` was running; the live/manual-only suites therefore fail or hang for want of one, which is the normal condition on this host. |

---

## `npm test` — the whole glob (`node --test '*.test.*'` in `src/mcp/vice`)

**Assumption A1 in `29-RESEARCH.md` said "~660 s runtime, ~44-failure baseline,
carried from project memory and NOT re-measured". It is now measured, and it is
wrong in the way that matters most: the run does not terminate on its own.**

| Metric | Measured value |
|---|---|
| Test files in the glob at this commit | **125** (`ls *.test.*`) |
| tests | **2880** |
| pass | **2760** |
| **fail: 48** | 48 |
| skipped | 67 |
| todo | 5 |
| suites | 24 |
| **Measured wall time** | **1578 s** (`duration_ms: 1578153`) — of which roughly **120 s** was real work and roughly **1458 s** was a single blocked child |
| Exit status | **1** |

### The run HANGS — this is the corrected form of assumption A1

All output stopped **~120 s** into the run. Twenty-four minutes later the
runner still had exactly one live child:

```
PID      ELAPSED   TIME      STAT  COMMAND
3552944  25:31     00:00:03  Sl    node vice-proxy.test.ts
```

25 minutes elapsed against **3 seconds of CPU** — blocked on I/O, not spinning.
`vice-proxy.test.ts` is one of the nine files `test-gate.mjs` disposition as
`MANUAL_ONLY_TESTS`; it needs a live broker and an emulator, and with neither
present it waits forever rather than failing.

The totals above were obtained by **killing that one child** (`kill -TERM`) and
letting the runner finish and print its summary. Two consequences, stated rather
than discovered:

1. **`vice-proxy.test.ts`'s 41 failures are a LOWER BOUND.** It was terminated
   part-way through; a completed run of that file would report at least that
   many.
2. **"Run the full glob" is not an unattended operation on this host.** It must
   be bounded — run it in the background, wait for output to go quiet, then
   terminate the blocked `vice-proxy.test.ts` child. A foreground `npm test`
   truncates against any tool timeout and produces a *wrong* baseline rather
   than no baseline.

### The failing-file SET (this is the comparison target)

| File | Failures | Automated set? | Character |
|---|---|---|---|
| `src/mcp/vice/vice-proxy.test.ts` | **41** (lower bound) | no — `MANUAL_ONLY_TESTS` | Needs a live broker/emulator. Absent one, its broker-facing assertions fail and the file eventually blocks. |
| `src/mcp/vice/anno-session.test.ts` | **5** | yes | Timing-sensitive FIFO-queue tests (`plan 18-06`). Load-sensitive on a busy host. |
| `src/mcp/vice/audit-integrity.test.ts` | **2** | yes | Census assertions that pin audit totals which legitimately grow per milestone — red on a correct tree. |

Failing test names, verbatim, for the two files in the automated set:

```
audit-integrity.test.ts:215  the docs guard set is derived from disk with a non-vacuity floor (D-12-07 / D-12-08)
audit-integrity.test.ts:251  the runtime registry (EXPECTED_DOCS_GUARD_NAMES) names every guard the disk-derived set carries -- registry-drift detector (CR-02, 17-REVIEW.md)
anno-session.test.ts:809    plan 18-06: five same-tick callers begin in strict FIFO arrival order
anno-session.test.ts:831    plan 18-06: a throwing callback releases the queue and the following entry still runs
anno-session.test.ts:854    plan 18-06: a waiting caller times out with AnnoSessionBusyError and is removed from the queue before it can run late
anno-session.test.ts:892    plan 18-06: the bounded wait applies only to waiting for the slot, not to a slow callback once it holds it
anno-session.test.ts:918    plan 18-06: the queue prevents a client-side lost update, and bypassing it makes the same scenario fail loud as non-exercising
```

**Note for plan 29-10:** `anno-session.test.ts` is on that plan's deletion set.
When it goes, its 5 failures leave the set **by construction**, not by repair —
that is a *set change with a known cause*, and 29-10 must say so rather than
report an improvement.

---

## `npm run test:automated` (`node test-gate.mjs`)

| Metric | Measured value |
|---|---|
| Files derived by `automatedTestFiles()` at this commit | **116** (125 glob files minus the 9 `MANUAL_ONLY_TESTS`) |
| tests | **2761** |
| pass | **2720** |
| **failures: 7** | 7 |
| skipped | 29 |
| todo | 5 |
| Wall time | **80 s** |
| **Exit status** | **1** |

Failing set: `audit-integrity.test.ts` (2) + `anno-session.test.ts` (5) — the
same two automated files as the full glob, same tests.

**`test:automated` exits 1 on a clean tree.** It skips `MANUAL_ONLY_TESTS` *and*
carries this pre-existing failure baseline, so its exit code is **not** the
truth about whether a change regressed anything. Compare its failing set against
the table above instead.

**Reconciliation note (honest bookkeeping):** the `test:automated` run above was
taken *after* plan 29-02's own `removal-gate.test.ts` existed in the working
tree, so its `2761` includes that file's **8 passing tests**; without it the
figure is `2753`. The full-glob run started *before* that file was created, so
its `2880` is exactly HEAD's file set. Neither run's **failure set** is affected.

---

## Single-command gates

| Command | Exit status | Note |
|---|---|---|
| `cd src/mcp/vice && npm run typecheck` | **0** | `tsc --noEmit` |
| `node scripts/check-skill-tool-coverage.mjs` | **0** | 37 `vice_*` names / 17 `anno_*` / 8 CLI verbs, 8/8 resolved |
| `node scripts/check-skill-fork-honesty.mjs` | **0** | 11 fork-only mentions across 33 files, 24 names policed |
| `node scripts/check-npm-packages.mjs` | **0** | `@henols/vice-mcp` 81 files; `@henols/c64-re-tools` 34 files, 7 skills |
| `node scripts/check-skill-description-overlap.mjs` | **0** | 7 skills, 21 pairs, max score 0.250 vs threshold 0.35 |
| `node scripts/audit-gate.mjs` | **0** | 8 docs guards green, 7 milestone audits scanned |

All six were run with plan 29-02's own working-tree edits present (the
`packFiles` export and its entry-point guard in `check-npm-packages.mjs`, and
the new removal gate). `check-npm-packages.mjs` was additionally confirmed at
**0** immediately after the export edit and before anything else changed.

---

## Corrected blast radius — measured the way the gate measures

Measured with the removal gate's **own exported `subjectHits()` predicate**
(path **and** content, case-insensitive, one entry per occurrence, bytes read
and decoded in-process) against the **git blobs at commit `c27922a`**, so this
figure is directly comparable with what the gate reports about itself and was
taken before the gate existed in a commit.

| Figure | Value at `c27922a` |
|---|---|
| Tracked files, total | **1290** |
| Tracked files outside the `.planning/` **prefix** | **360** |
| Tracked files mentioning the subject, anywhere | **347** |
| Occurrences, anywhere | **3269** |
| **Tracked files mentioning the subject outside `.planning/`** | **59** |
| **Occurrences outside `.planning/`** | **396** |
| Occurrences in the gitignored-but-shipped `installer/skills/` tree | **27** across 8 files |

**`29-CONTEXT.md` and `CUT-02`'s 291 / 55 are superseded**, and so is
`29-RESEARCH.md`'s 339 / 61 — plan 29-01 landed between research and this
measurement. The numbers that matter for this phase are the two in bold, and
they are the ones the gate is built against.

**Grep is blind to one of them.** `src/mcp/vice/anno-memmap-render.ts` carries
a literal NUL byte at offset 12862, so GNU grep classifies the file as binary:

```
$ grep -c  'the external analyser' src/mcp/vice/anno-memmap-render.ts   # prints nothing, exit 1
$ grep -ac 'the external analyser' src/mcp/vice/anno-memmap-render.ts   # 1,             exit 0
```

Content-only totals outside `.planning/` therefore read **400 with `-a`** and
**399 without**, in the current working tree. The one-hit difference is the
measurement-provenance comment at `anno-memmap-render.ts:79`. Every census in
this phase uses `grep -a`, or reads bytes in-process as the gate does.

---

## What the gate itself reports on this tree

For comparison against the independent figures above:

```
check-no-<subject>: OK -- scanned 395 files (365 tracked outside ".planning/"
  + 30 shipped-but-untracked installer paths, floor 350);
  118 occurrence(s) permanently exempt, 312 temporarily allow-listed
  across 49 entries.
```

`395 = 365 + 30`: the 30 are `installer/skills/**` and friends, which
`git ls-files` cannot see and which `packFiles("installer")` supplies.
`118 + 312 = 430` accounts for every occurrence the gate found, including the
occurrences plan 29-02 itself added (the gate, its declarations, its test, its
two fixtures, the fixtures README and the CI step).
