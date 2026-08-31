---
phase: 32-the-deletion-and-the-grep-gate
plan: 14
subsystem: audit-instrumentation
tags: [gap-closure, evidence-hygiene, harness, CR-02, CR-04, signals]
status: complete

requires:
  - "scripts/audit-mutation-harness.mjs (phase 32 plan 32-01)"
  - ".planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json (61 rows)"
  - "32-VERIFICATION.md gaps[2] and behavior_unverified_items[0]"
provides:
  - "plant() that writes exactly the bytes its descriptor records, with a throwing post-condition"
  - "runGuard() that distinguishes a signal-terminated child from a non-zero exit"
  - "A per-row driver that records a signal-killed planted run as UNMEASURABLE, never as an observed red"
  - "evidence/32-gap3-harness-correction.md — the re-measured row plus the signal-path attempt log"
  - "A dated CORRECTION block in evidence/32-sweep-renamed-rows.md"
affects:
  - "Every future run of the mutation harness; no CI surface (D-17 — the harness is not a CI job)"

tech-stack:
  added: []
  patterns:
    - "Replacer FUNCTION substitution instead of a replacement string, so no $-pattern is interpreted"
    - "Post-condition asserted BEFORE any byte is written, not after"
    - "Instrument readings taken through the real CLI against a throwaway in-repository scratch root, never through a test seam added to the instrument"
    - "Race driven on an OBSERVABLE (polled on-disk bytes) rather than a timer"

key-files:
  created:
    - ".planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap3-harness-correction.md"
  modified:
    - "scripts/audit-mutation-harness.mjs"
    - ".planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json"
    - ".planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-sweep-renamed-rows.md"
    - ".planning/WINDOWS.md"

decisions:
  - "The one in-place correction the plan authorised was measured to be a NO-OP and was NOT performed. Writing the interpreted string there instead would have been a retyped value, which the plan's own prohibition forbids."
  - "The restore-on-signal invariant is recorded as STILL BEHAVIOUR-UNVERIFIED, with a newly-measured mechanism: there is no window, not a narrow one."
  - "60 of 61 registry rows were deliberately not re-run."

metrics:
  duration: "~55 min"
  completed: 2026-09-01

actuals:
  tokens: 31000
  tasks: 3
  commits: 3
---

# Phase 32 Plan 14: Gap 3 — Evidence Hygiene in the Instrument Whose Product Is Evidence — Summary

The mutation harness now writes exactly the bytes its descriptors record and asserts it before
writing, and can no longer turn an out-of-memory kill into a recorded red; the one row whose
recorded mutation was not the applied mutation was re-measured by machine and still red; and
the verifier's human-routed restore-on-signal check was driven mechanically and came back
**still behaviour-unverified** — for a stronger reason than anyone expected.

## Commits

| # | Hash | Task |
|---|------|------|
| 1 | `7638c6f` | The harness writes what it records, and a kill is not a failure |
| 2 | `205dc3c` | Re-measure the one affected row and disclose the record additively |
| 3 | `326ea72` | The restore-on-signal invariant is still behaviour-unverified, and now we know why |

## Task 1 — the instrument's own before-and-after reading

**Vehicle.** The harness exports nothing and no test seam was added to it. Every reading below
was taken by running the real `scripts/audit-mutation-harness.mjs` CLI against a throwaway
root at `.audit-root-synth-32-14/` inside the repository, carrying its own three-row
`guard-fates.json` and its own tiny guard scripts. No production file was planted, the real
registry was not read, and the scratch root was removed before the task ended.

`git status --porcelain` was **empty** before the scratch root was created; while it existed it
showed exactly one collapsed untracked entry, `?? .audit-root-synth-32-14/`, so the harness's
own baseline stayed stable across every run.

### Row DOLLAR — CR-02, the whole dollar-pattern family

`plant.replace` carried all six interpreted patterns in one string:
`PLANTED[$$][$&][$` + "`" + `][$'][$1][$<name>]END`. The guard was inverted on purpose — it reads the target
while the plant is still on disk (the harness reverts in its `finally`, so nothing downstream
can inspect them) and exits **non-zero when the bytes equal the recorded replacement**.

**PRE-FIX reading** — the harness's hard failure:

```
audit-mutation-harness: measured 1 row(s)
  ZERO-EXIT     scratch/dollar: the guard exited 0 WITH the violation planted. The plant did not bite. ...
EXIT=1
```

The guard's own printed bytes, verbatim from the captured evidence:

```
EXPECTED (recorded replacement): "PLANTED[$$][$&][$`][$'][$1][$<name>]END"
OBSERVED (bytes on disk):        "before PLANTED[$][MARKER][before ][ after\n][$1][$<name>]END after\n"
ok 1 - the planted bytes do NOT contain the recorded replacement (occurrences: 0)
```

Four of the six patterns were silently rewritten on the way to disk: `$$` → `$`, `$&` →
`MARKER` (the match), `` $` `` → `before ` (the prefix), `$'` → ` after\n` (the suffix). `$1`
and `$<name>` survived only because a string search pattern exposes no captures.

**POST-FIX reading** — an observed red with a green control:

```
audit-mutation-harness: measured 1 row(s)
  OBSERVED RED  scratch/dollar: guard exit status 1 (control exit status 0)
                command: node guard-dollar.mjs
EXIT=0
```

```
EXPECTED (recorded replacement): "PLANTED[$$][$&][$`][$'][$1][$<name>]END"
OBSERVED (bytes on disk):        "before PLANTED[$$][$&][$`][$'][$1][$<name>]END after\n"
not ok 1 - the planted bytes contain the recorded replacement EXACTLY ONCE
```

Byte for byte, across the whole family. The two readings differ, so the vehicle is exercising
the branch.

### Row SIGNAL — CR-04

The guard exits 0 when the plant is absent and sends itself `SIGKILL` when it is present, so
the unplanted control is green and the planted child dies by signal.

**PRE-FIX** — the defect, observed:

```
audit-mutation-harness: measured 1 row(s)
  OBSERVED RED  scratch/signal: guard exit status 1 (control exit status 0)
                command: node guard-signal.mjs
  registry: .../guard-fates.json
EXIT=0
```

And the fabricated record the harness wrote back for a child that never exited:

```json
"exitStatus": 1,
"excerpt": "plant observed -- sending SIGKILL to self",
"control": { "exitStatus": 0, "excerpt": "ok 1 - unplanted control" }
```

**POST-FIX**:

```
audit-mutation-harness: measured 1 row(s)
  UNMEASURABLE  scratch/signal: the PLANTED guard run was TERMINATED BY SIGKILL and never
  exited, so it carries no exit status. A signal-killed child proves nothing about the plant:
  it was killed, not failed. Recorded as UNMEASURABLE rather than as an observed red, and NOT
  retried -- re-run the row once the cause of the kill (an out-of-memory reaper, a native
  crash) is understood (CR-04).
  registry: NOT written (a row was unmeasurable or exited 0)
EXIT=1
```

`observedRed present: false` — measured on the scratch registry afterwards.

### The post-condition is reachable

A third scratch descriptor, whose target already carried the replacement string once so the
mutated text would contain it twice, makes `plant()` throw. Verbatim:

```
audit-mutation-harness: FAIL -- row scratch/inconsistent: plant post-condition FAILED for
target-inconsistent.txt -- the recorded `replace` string occurs 2 time(s) in the mutated text,
expected exactly 1. The mutation that would reach disk is not the mutation this descriptor
records, so the row would promise a reader a hand-reproducible find/replace it cannot perform.
Nothing was written. Fix the descriptor rather than the assertion (CR-02).
```

It names the row, the descriptor's file and both counts. The real `guard-fates.json` was not
edited to produce it.

### The pre-existing rules are unchanged

| Edge | Result |
|------|--------|
| `find` matches 0 times | `plant \`find\` string occurs 0 time(s) in target-dollar.txt, expected exactly 1. …` — existing message |
| `find` matches 3 times | `plant \`find\` string occurs 3 time(s) in target-inconsistent.txt, expected exactly 1. …` — existing message |
| `find` is `""` (`[edge:CUT-04/empty]`) | `plant descriptor field \`find\` must be a non-empty string.` — throws rather than silently matching |
| child exits non-zero | still recorded as a red (row DOLLAR post-fix) |
| timeout branch | left separate, with its own distinct reason |

### Grep criteria

| Check | Value |
|-------|-------|
| `node --check scripts/audit-mutation-harness.mjs` | `0` |
| `grep -c 'replace(descriptor.find, descriptor.replace)'` | `0` (returns 1 at HEAD — non-vacuous) |
| `grep -c 'CR-02'` | `3` |
| `grep -c 'CR-04'` | `5` |
| `grep -c 'export'` | `0`, unchanged |

`git status --porcelain -- scripts/ .planning/phases/32-the-deletion-and-the-grep-gate/` after
the scratch root was removed listed exactly one path, `scripts/audit-mutation-harness.mjs`.

## Task 2 — the re-measurement, and a finding about the authorised correction

**Broker state, read READ-ONLY before anything else: DOWN.** `systemctl --user is-active
vice-broker` → `inactive` (exit 4); no broker process; no `x64sc`; no `.vice-supervisor/`.

The `ps -eo pid,args | grep -i vice-broker | grep -v grep` reading returned `exit=0` and
**that is a second instance of the process-name false-positive trap** `evidence/32-close-gate.md`
records — here an unrelated `node --test` run matched because its argv lists
`vice-broker-acquire.test.ts`, `vice-broker-client.test.ts` and `vice-broker-supervision.test.ts`.
Narrowing the same read-only command with `| grep -v -- "--test"` returns `exit=1`. The method
is that document's, not a second one invented here.

**Commit measured:** `7638c6f1f7019e33b12845c93b7ad882904bbc42`.

**The re-run.** `node scripts/audit-mutation-harness.mjs --row src/mcp/vice/r2000-enum-gen.test.ts
--out .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap3-harness-correction.md`
→ exit `0`, `OBSERVED RED … guard exit status 1 (control exit status 0)`, tree restored
byte-identical. The harness wrote the new `observedRed` back itself; it was not hand-edited.

**The re-measured excerpt, and why it differs.** The comparison line is now:

```
'$0D011' !== '$D011'
```

— six characters **with** the sigil, where the committed record read `'0D011' !== '$D011'` —
five characters, no sigil. Exactly the predicted shape: with the recorded replacement reaching
disk intact, the guard fails on the padding width rather than on a deleted sigil. Verdict
unchanged: still red, control still green.

Registry diff confinement: `git diff --numstat` on `guard-fates.json` → `2 2`, a single hunk at
`@@ -456,12 +456,12 @@`, touching only that row's `observedRed.excerpt` and
`observedRed.control.excerpt`. 61 rows before and after; the other 60 byte-identical.
`observedRed.command` is byte-identical to `observedRed.control.command`.

### FINDING: the authorised in-place correction is a NO-OP, and was not performed

The plan authorised exactly one in-place edit — the `replace:` value on the affected row's
Plant line at `32-sweep-renamed-rows.md:3889` — and only if the corrected value were the
**re-measured** one rather than a retyped one. Measured: the value the fixed harness applies is

```
- **Plant:** `src/mcp/vice/anno-enum-gen.ts`: `return `$${…padStart(4, "0")}`;` → `return `$${…padStart(5, "0")}`;`
```

which `diff` reports as **byte-identical** to the line already committed at `:3889`. That is
the fix's whole effect: the recorded replacement now reaches disk intact, so the recorded value
was already a correct description of what the *fixed* harness does. It was only ever wrong as a
description of what the *pre-fix* harness did.

Writing the *interpreted* string onto that line instead would have been a retyped, derived
value — forbidden by the plan's own prohibition and precisely the fact-laundering `T-32-09`
exists to prevent. So **no in-place edit was made**:

```
git diff --numstat -- …/32-sweep-renamed-rows.md
70	0	.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-sweep-renamed-rows.md
```

**70 additions, 0 deletions.** The plan's acceptance criterion anticipated a deletions count of
exactly 1; the honest measured number is 0, and it is better. `[edge:CUT-06/ordering]` is
satisfied more strongly than it asked: not one pre-existing byte moved, and a post-condition in
the splice script asserted that every original line is still present, in order, unmodified.

The dated CORRECTION block was appended immediately after the affected row's section (before
the next row's `## ` heading) and carries all the required items plus this finding as its own
numbered item: date and round; what was wrong (`CR-02`, named); what the preserved raw output
below the Plant line actually is and why it is left byte-identical; the no-op finding; the
unchanged conclusion **cited to `32-VERIFICATION.md` rather than re-measured**; where the
re-measured run lives with both exit statuses; and the 1-of-61 scope with its reason.

**Fate gate, before and after this task — identical:**

```
check-guard-fates: OK -- setA=43 setB=16 setC=2 total=61 rows=61 (floors setA=43 setB=16 setC=2 total=61)
  derived from 273 path(s) at 0394cbc; forward map 21 same-path / 15 renamed / 7 gone; set B 22 raw candidate(s) minus 6 already-claimed successor(s); set C parsed from .planning/ROADMAP.md line 830.
gate=0
```

`git diff --name-only` for this task listed no `*-SUMMARY.md` and did not list
`32-VERIFICATION.md`.

## Task 3 — restore-on-signal: STILL BEHAVIOUR-UNVERIFIED

**Row chosen:** `src/mcp/vice/skill-acme-build-cli.test.ts`, recorded planted-run duration
**842.4 ms** (`# duration_ms 842.353365`, a real TAP summary in its excerpt), plant
`src/mcp/vice/acme-gate.ts`: `"acme"` → `"acmeZZ"`.

The registry's longest recorded planted run is `src/mcp/vice/vice-proxy.test.ts` at 1555.4 ms,
and it was **measured and rejected rather than skipped**: its unplanted control fails in this
worktree because `src/mcp/vice/node_modules` was absent (`# fail 1`, `# duration_ms 8509.6`),
and a failing control makes the harness record the row UNMEASURABLE and never plant it — so
that row offers no window of any width.

**Vehicle:** spawn the real harness as a child, poll `src/mcp/vice/acme-gate.ts` every **2 ms**
until its bytes contain `acmeZZ` — the plant, observed directly on disk — and only then send
the signal. Nothing was added to the harness: `grep -c 'export'` is still `0`.

**Ten attempts, five per signal. All ten landed inside the window. None ran the handler.**

| Attempt | Landed | Polls | Sent at | Child lifetime | Exit code | Killed by | `main()` completed | File byte-identical | Porcelain byte-identical |
|---|---|---|---|---|---|---|---|---|---|
| SIGINT 1 | yes | 590 | 1404 ms | 2183 ms | `0` | null | yes | yes | yes |
| SIGINT 2 | yes | 645 | 1557 ms | 2384 ms | `0` | null | yes | yes | yes |
| SIGINT 3 | yes | 707 | 1603 ms | 2386 ms | `0` | null | yes | yes | yes |
| SIGINT 4 | yes | 649 | 1462 ms | 2121 ms | `0` | null | yes | yes | yes |
| SIGINT 5 | yes | 587 | 1326 ms | 2149 ms | `0` | null | yes | yes | yes |
| SIGTERM 1 | yes | 693 | 1591 ms | 2512 ms | `0` | null | yes | yes | yes |
| SIGTERM 2 | yes | 711 | 1617 ms | 2435 ms | `0` | null | yes | yes | yes |
| SIGTERM 3 | yes | 593 | 1360 ms | 2059 ms | `0` | null | yes | yes | yes |
| SIGTERM 4 | yes | 686 | 1552 ms | 2251 ms | `0` | null | yes | yes | yes |
| SIGTERM 5 | yes | 767 | 1816 ms | 2770 ms | `0` | null | yes | yes | yes |

**The measured cause.** `main()` and everything it calls are wholly synchronous:
`grep -c 'await\|async \|\.then(' scripts/audit-mutation-harness.mjs` returns `0`, and every
subprocess and git call is `spawnSync` (`:292`) or `execFileSync` (`:123`, `:553`). Node cannot
dispatch a JavaScript signal handler while synchronous JavaScript is on the stack, so a signal
delivered during the blocking planted `spawnSync` is queued, not handled; by the time the stack
unwinds, `measureRow`'s `finally { revert(...) }` and `main`'s `finally { restoreAll() }` have
already run and the process exits normally with the queued callback undelivered.

**The verifier's four attempts did not miss a narrow window. There is no window.**

- The **safety property held every time** — planted file and working tree byte-identical on all
  ten attempts — but via the ordinary `finally` path, **not** the signal handler.
- The **advertised invariant is NOT observed**: the run was not interrupted and it did not exit
  130. Recorded as **still behaviour-unverified**, in those words.
- **`WR-03`'s latch doubt is likewise not settled.** The plan expected the double restore
  (handler's, then exit handler's) to be exercised by construction; it was not, because the
  handler never ran. No claim is made about the latch under a handler-driven restore.
- **No assertion was weakened**, and no flag, hook or export was added to widen the window.

Each completed attempt rewrote the chosen row's `observedRed` into `guard-fates.json`; that one
specific file was restored with `git checkout -- <that path>` after each attempt, so this task
changed no dated record. `git diff --name-only` for Task 3 listed exactly one file,
`evidence/32-gap3-harness-correction.md`.

## Plan-level verification

| # | Check | Result |
|---|-------|--------|
| 1 | `node --check scripts/audit-mutation-harness.mjs` | exit `0` |
| 2 | Scratch readings pre/post-fix, rows DOLLAR and SIGNAL | recorded verbatim above, and **differing** |
| 3 | Post-condition reachable, message recorded, scratch tree removed | yes |
| 4 | The single re-run with command, output, exit status, control exit status | in `evidence/32-gap3-harness-correction.md` |
| 5 | `git diff --numstat` on `32-sweep-renamed-rows.md` deletions | **0**, not 1 — see the Task 2 finding |
| 6 | `node scripts/check-guard-fates.mjs` before and after | exit `0`, same measured line |
| 7 | SIGINT and SIGTERM attempt logs | full 10-row table, both signals |
| 8 | `git status --porcelain`, scoped, before and after every task | byte-identical each time |
| 9 | `cd src/mcp/vice && npm run test:automated` | **2950 tests, 2943 pass, 1 fail, 1 skipped, 5 todo**, broker DOWN |

**The one failure is a worktree-location artifact, not a regression.** `repo-root.test.ts:178`
— "path agreement (D-3, D-6…)" — asserts the resolved supervisor dir must not sit under
`.claude`:

```
error: 'the agreed directory must not sit under .claude -- got
/home/henrik/…/.claude/worktrees/agent-a4c097c848a03c6d7/.vice-supervisor
(the exact regression a naive move would introduce)'
```

This worktree *is* `.claude/worktrees/agent-…`, so the assertion is structurally unsatisfiable
from inside GSD worktree isolation and will pass again once the branch is merged into the main
checkout. It is unrelated to this plan's changes.

`src/mcp/vice/node_modules` was absent in this worktree and was provisioned with `npm ci` from
the committed lockfile (the repo's own `scripts/ensure-mcp-deps.sh` path — no new dependency,
no manifest or lockfile change, `node_modules/` is gitignored). Before provisioning the same
gate reported 51 failures, all of the form
`spawnSync …/node_modules/.bin/tsc ENOENT`; after, 1. Broker was `inactive` at both ends.

Nothing in the repository imports the harness (`grep -rln "audit-mutation-harness"` → the file
itself, only), so no test could be affected by Task 1. The registry- and doc-reading guards were
run individually as well and are green: `guard-fates.test.ts`, `docs-linerefs.test.ts`,
`docs-dangling-refs.test.ts`, `comment-phase-pointers.test.ts` (57/57);
`audit-integrity.test.ts`, `docs-review-disposition.test.ts`, `docs-deferred-ledger.test.ts`,
`removal-gate.test.ts` (65/65).

## Deviations from Plan

### 1. [Rule 1 — measured contradiction] The authorised in-place correction is a no-op and was not made

- **Found during:** Task 2, step C.
- **Issue:** The plan authorised correcting `32-sweep-renamed-rows.md:3889`'s `replace:` value
  to "the value the fixed harness applied", and its acceptance criterion required a deletions
  count of exactly 1. Measured: that value is byte-identical to the line already committed.
  The instruction is a no-op, so the criterion it implies cannot be met by following it.
- **Resolution:** No edit made. Deletions count is 0. The alternative — writing the interpreted
  string — would be a retyped value, which the plan's own first prohibition forbids and which
  `T-32-09` exists to prevent. Disclosed as numbered item 4 of the CORRECTION block and recorded
  in `.planning/WINDOWS.md` as a `deviation`.
- **Files:** `.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-sweep-renamed-rows.md`
- **Commit:** `205dc3c`

### 2. [Rule 2 — missing critical functionality] The evidence renderer dropped the new UNMEASURABLE state's output

- **Found during:** Task 1, step C.
- **Issue:** `evidenceMarkdown()`'s `unmeasurable` branch rendered only the control run. A row
  that becomes UNMEASURABLE because the *planted* run was killed would have had its captured
  planted output silently dropped — the very output that is the record's subject.
- **Resolution:** The branch now renders the planted command, the termination reason (signal
  named) and the raw planted output when a planted run exists. This is not one of the four
  additions step D forbade (flag, env var, export, unhandled-rejection handler, buffer limit);
  it is the rendering the new state needs to be recordable at all.
- **Files:** `scripts/audit-mutation-harness.mjs`
- **Commit:** `7638c6f`

### 3. [Rule 3 — blocking] Chosen signal row swapped, with the rejection measured

- **Found during:** Task 3, step A.
- **Issue:** The registry's longest-recorded row (`vice-proxy.test.ts`) has a failing unplanted
  control in this worktree, so the harness never plants it and no window exists.
- **Resolution:** Used the longest-recorded row with a green control here
  (`skill-acme-build-cli.test.ts`). Both the rejection and its measurement are recorded in the
  evidence file rather than silently skipped.
- **Commit:** `326ea72`

### 4. [Rule 3 — blocking] `node_modules` provisioned to make verification step 9 meaningful

- **Found during:** plan-level verification.
- **Issue:** The worktree had no `src/mcp/vice/node_modules`, producing 51 spurious failures.
- **Resolution:** `npm ci` from the committed lockfile — the repo's own SessionStart-hook path.
  No new package, no manifest or lockfile change, and `node_modules/` is gitignored, so the tree
  is unchanged.

## Threat Flags

None. `files_modified` contains no manifest and no lockfile, no package-manager install added a
dependency, and no new network, auth, file-access or schema surface was introduced. The three
mitigations the plan assigned were applied: `T-32-12` (replacer function plus throwing
post-condition), `T-32-13` (signal-terminated child recorded UNMEASURABLE, timeout kept
separate) and `T-32-14` (bytes and porcelain captured before and asserted after every signal
attempt, tree confirmed restored). `T-32-09` was mitigated more strongly than planned — 0
deletions rather than the 1 authorised. `T-32-03` remains `accept`, unchanged.

## Known Stubs

None.

## Broken-windows ledger

Two entries appended to `.planning/WINDOWS.md`:

- `unmet-truth` — the restore-on-signal invariant is still behaviour-unverified, with the
  measured mechanism (`scripts/audit-mutation-harness.mjs:103`).
- `deviation` — the authorised in-place correction measured as a no-op
  (`evidence/32-sweep-renamed-rows.md:3889`).

## Self-Check

- `scripts/audit-mutation-harness.mjs` — FOUND
- `.planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json` — FOUND
- `.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-sweep-renamed-rows.md` — FOUND
- `.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap3-harness-correction.md` — FOUND
- Commits `7638c6f`, `205dc3c`, `326ea72` — FOUND

## Self-Check: PASSED
