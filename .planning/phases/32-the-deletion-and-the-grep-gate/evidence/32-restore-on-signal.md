# Restore-on-signal: the invariant OBSERVED, and WR-03's latch settled

Plan 32-19, gap-closure round 2. Continues `evidence/32-gap3-harness-correction.md`'s
signal-path section in the same attempt-log format, extended with the exit code and the
emitted marker, so the two rounds read side by side.

**Verdict, stated before the log so it cannot be mistaken for a summary of a summary:
the restore-on-signal invariant IS OBSERVED, through the harness's own registered
handler, for both SIGINT and SIGTERM, in 10 attempts out of 10. `WR-03`'s latch doubt is
SETTLED, in the direction that could have gone the other way.**

---

## 0. Preconditions, read before anything was measured

**Commit measured.** `e61ee285cff5ce8debb4778d17a8df915257197e` (`e61ee28`), on
`worktree-agent-a1ff406ebc453752e`, forked from `07a9b48`. The three plan commits under it:

| Commit | Subject |
|---|---|
| `b55ec3f` | `feat(32-19)`: export three harness symbols so the real signal handler is reachable |
| `4d95bd7` | `test(32-19)`: add failing test for the harness restore-on-signal invariant (RED) |
| `9215e49` | `feat(32-19)`: two in-process drivers — the invariant is OBSERVED (GREEN) |
| `e61ee28` | `fix(32-19)`: scope the porcelain assertion to what this test can be responsible for |

**Date.** 2026-09-01.

**Broker state (D-13).** Read-only, by the method `evidence/32-close-gate.md` §2b
establishes and for the reason it gives. Nothing here stops, kills, restarts or otherwise
touches the developer's `vice-broker` systemd user unit.

```
$ systemctl --user is-active vice-broker
inactive
exit=4
```

```
$ ps -eo pid,args | grep -i vice-broker | grep -v grep
exit=1          (no output — no matching process)
```

```
$ ps -eo pid,args | grep -i x64sc | grep -v grep
exit=1          (no output — no emulator running)
```

> **The `pgrep` trap, honoured rather than re-derived.** §2b records that
> `pgrep -af vice-broker` SELF-MATCHES — it finds its own wrapping command line and
> reports a hit on an idle host, which would assert a live broker where there is none.
> The `ps | grep -v grep` form above is the one whose output is trustworthy, and it is
> the form every broker reading in this document uses. §2b is cited rather than the
> decision retaken.

**Why the broker state is recorded beside every figure.** A live broker reds the BACK-05
D–G ordering test deterministically
(`.planning/todos/pending/2026-08-26-back-05-test-fails-deterministically-on-a-live-broker-host.md`),
so a suite figure recorded without its broker state is void rather than merely unlabelled.
The broker was **inactive for every figure in this document**.

---

## 1. What plan 32-14 measured, and why this round could do better

Plan 32-14 drove ten attempts, five per signal, against the real harness. It used an
observable rather than a timer — polling the planted file every 2 ms and signalling only
once the mutation was visible on disk. **All ten landed inside the window. All ten exited
`0`. None ran the handler.**

Its measured cause was not a narrow window but the absence of one: `main()` and everything
it calls are wholly synchronous, so Node cannot dispatch a JavaScript signal handler while
that stack is on the CPU. The signal is queued, the stack unwinds, `finally { revert }` and
`finally { restoreAll }` run, and the process exits normally with the queued callback
undelivered. In its own words:

> The verifier's four attempts did not miss a narrow window. There is no window.

The verifier's own either-or, quoted from `32-VERIFICATION.md` `behavior_unverified_items[0].test`:

> Landing it needs either an in-process driver (the harness exports nothing today) or an
> injected `await` in the plant window.

And its `expected`:

> Exit 130 for the signals, every planted file byte-identical to its pre-run bytes,
> `git status --porcelain` byte-identical to the baseline, and the second `restoreAll()`
> a no-op rather than a re-write.

**This round takes the first branch and refuses the second.** Injecting an `await` would
change how the instrument behaves when it is really run, in order to test how it behaves
when it is really run — the shape of defect this whole phase exists against.

**What made the first branch cheap already existed.** `scripts/audit-mutation-harness.mjs`
already ends with an `IS_ENTRY_POINT` guard — the same idiom `scripts/check-guard-fates.mjs`
uses at `:857-860` — so importing the module registers its four process handlers WITHOUT
running `main()`. A driver that imports the module, plants into a scratch root and then
awaits a timer has all three things the attempt needed at once: the real handlers
registered, a real plant on disk, and an event loop that is turning. **The window is
created outside the harness. The harness stays synchronous, unchanged and un-widened.**

---

## 2. The harness was not widened — measured, not asserted

| Claim | Command | Result |
|---|---|---|
| Syntax valid | `node --check scripts/audit-mutation-harness.mjs` | exit `0` |
| Exactly three exports | `node -e 'import("./scripts/audit-mutation-harness.mjs").then(m=>console.log(Object.keys(m).sort().join(",")))'` | `pendingRestoreCount,plant,restoreAll` — exit `0` |
| Import is inert (no output) | a one-line script that only imports the module | exit `0`, **0 bytes stdout, 0 bytes stderr** |
| Import is inert (no writes) | `git status --porcelain` before/after that script | **byte-identical** |
| CLI unchanged | `node scripts/audit-mutation-harness.mjs --row scripts/lib/skill-honesty-checks.mjs --out <scratch>` | `OBSERVED RED ... guard exit status 1 (control exit status 0)`, `tree: restored byte-identical to the baseline` |
| Fate guard unchanged | `node scripts/check-guard-fates.mjs` | `OK -- setA=43 setB=16 setC=2 total=61 rows=61` |
| Scoped tree effect | `git status --porcelain -- scripts/ .planning/` | exactly one path: `scripts/audit-mutation-harness.mjs` |

The registry churn from the CLI run was discarded with a scoped
`git checkout -- .planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json`
and the scratch output directory removed.

### 2a. The synchronous-module count, and a grep that now self-matches

Plan 32-14's check was `grep -c 'await\|async \|\.then(' scripts/audit-mutation-harness.mjs`,
which returned `0`. **It no longer does — it returns `7` — and the honest reading of that
number is not "an `await` was injected".** All seven hits are prose inside the dated header
note this plan added, including the sentence that states the count is zero. The measuring
instrument moved inside its own subject.

This is the same shape as the `pgrep -af vice-broker` trap in §2b of `32-close-gate.md`,
where the bare probe found its own command line and would have asserted a live broker on an
idle host. Recording `7` as an injected `await` would be as wrong as rewording the paragraph
until the grep agreed with it. The discriminating form excludes comment lines:

```
$ grep -n 'await\|async \|\.then(' scripts/audit-mutation-harness.mjs \
    | grep -vE ':[[:space:]]*(//|\*)'
exit=1          (no output — ZERO code occurrences)
```

**The module is still wholly synchronous in code.** Both numbers are recorded here, and the
discriminating form is written into the file's own header so a later round uses it.

### 2b. What was NOT changed

No `await` was injected. No flag, environment variable, hook, delay or test mode was added —
the five flags are still `--root`, `--row`, `--rows`, `--all`, `--out`. `runGuard()`, the
restore machinery, the four handler registrations, `process.exit(130)`, the
`uncaughtException` handler and the `restored` latch are all untouched. `WR-03`'s latch was
under measurement in this plan, not under repair; changing it before measuring it would have
destroyed the measurement.

**The export surface is exactly three symbols and stops there.** `revert`, `runGuard`,
`measureRow`, `selectRows` and `main` stay private. `pendingRestoreCount()` returns the
internal map's SIZE rather than the map, so a driver can observe the restore machinery
without acquiring the ability to mutate it (T-32-36).

---

## 3. The attempt log — ten attempts, five per signal

**Vehicle.** `src/mcp/vice/audit-harness-restore.test.ts` spawns
`fixtures/harness-signal/signal-window-driver.mjs` with a gitignored scratch root. The
driver writes a target, plants through the harness's exported `plant()`, emits a single
marker line carrying the target path and its pre-plant bytes as base64, then awaits a
timer. The parent waits for the marker, then **independently observes the plant on disk**
by polling the target every 2 ms until its bytes contain the recorded replacement — plan
32-14's proven vehicle, reused rather than re-invented — and only then sends the signal.

Columns are plan 32-14's, plus **exit code** (which it also carried) and the **marker**.

| Attempt | Landed | Polls | Marker seen | Sent at | Child lifetime | Exit code | Killed by | File byte-identical | Porcelain byte-identical |
|---|---|---|---|---|---|---|---|---|---|
| SIGINT 1 | yes | 1 | 57 ms | 57 ms | 63 ms | `130` | null | yes | yes |
| SIGINT 2 | yes | 1 | 56 ms | 56 ms | 61 ms | `130` | null | yes | yes |
| SIGINT 3 | yes | 1 | 58 ms | 58 ms | 62 ms | `130` | null | yes | yes |
| SIGINT 4 | yes | 1 | 60 ms | 60 ms | 65 ms | `130` | null | yes | yes |
| SIGINT 5 | yes | 1 | 59 ms | 59 ms | 64 ms | `130` | null | yes | yes |
| SIGTERM 1 | yes | 1 | 43 ms | 43 ms | 47 ms | `130` | null | yes | yes |
| SIGTERM 2 | yes | 1 | 56 ms | 57 ms | 61 ms | `130` | null | yes | yes |
| SIGTERM 3 | yes | 1 | 41 ms | 41 ms | 45 ms | `130` | null | yes | yes |
| SIGTERM 4 | yes | 1 | 46 ms | 46 ms | 50 ms | `130` | null | yes | yes |
| SIGTERM 5 | yes | 1 | 46 ms | 47 ms | 50 ms | `130` | null | yes | yes |
| **none 1 (negative control)** | yes | 1 | 39 ms | 40 ms | 245 ms | **`0`** | null | **yes** | yes |

```
$ cd src/mcp/vice && node --test audit-harness-restore.test.ts
# tests 5   # pass 5   # fail 0   # duration_ms 1328.941657
exit=0
```

**Poll counts are 1 because the marker is emitted AFTER the plant reaches disk**, so the
mutation is already there when the parent's first poll runs. Plan 32-14's higher poll counts
(587–767) came from polling a full harness run that had to reach its plant through registry
selection and a green control first. Both rounds prove the same fact — the signal was
delivered while the plant was on disk — and this round proves it twice over, by the driver's
own marker and by the parent's independent read.

**Byte identity is a Buffer comparison, not a text comparison.** The target deliberately
carries a NUL, the lone bytes `0xFF 0xFE 0x80`, and the truncated two-byte sequence
`0xC3 0x28`. None has a UTF-8 interpretation; decoding and re-encoding any of them as UTF-8
yields `U+FFFD` (`EF BF BD`) instead. A restore that is merely text-equal produces different
bytes and fails the assertion. This is `[edge:CUT-04/encoding]` made concrete rather than
argued.

### 3a. The negative control, and why the exit code is the discriminating evidence

The last row is the same driver, same plant, same byte comparison, allowed to finish
**without** a signal. It exits `0` — through the harness's registered `exit` handler — and
its file is **also byte-identical**.

**That is the whole point of including it.** A byte-identical file proves nothing on its
own: it was true in all ten of plan 32-14's attempts, every one of which took the path that
was never in doubt. The only thing separating the control from the ten signalled attempts is
the exit code. A test asserting only byte identity would have passed against the exact state
this work exists to distinguish (T-32-37).

### 3b. Nothing left behind

Every attempt asserts, in addition to the byte comparison:

- **no partial write survived** — the scratch root's contents are read directly at the
  moment the child exits and must be exactly `["plant-target.txt"]`. This is asserted
  directly rather than inferred from git, because the scratch root is gitignored and a stray
  temp file inside it would never have appeared in `git status` at all;
- **no write escaped the scratch root** — no new porcelain entry under `.planning/` or
  `scripts/`, or naming the scratch prefix.

The scratch root is removed in a `t.after` that runs even when an assertion fails, and any
surviving child is `SIGKILL`ed there (T-32-34).

> **One assertion was narrowed, and the reason is measured rather than convenient.** The
> first form compared the WHOLE-REPO `git status --porcelain` byte-for-byte across each
> attempt. Run alone, that passed on all eleven attempts — and it still does, which is what
> the last column above records. Run inside `npm run test:automated`, which executes 120
> test files CONCURRENTLY, it failed three of five: a sibling test's own fixture directory
> appearing between one attempt's two readings is enough. That failure was a true statement
> about the repository and a false one about the harness, and keeping it would have made
> this file a flaky detector of other files' housekeeping. The strict comparison is still
> TAKEN and still RECORDED per attempt; it is reported rather than asserted, and the two
> assertions above — which are immune to sibling churn and strictly stronger about the
> scratch root — carry the weight.

---

## 4. `WR-03` — SETTLED, by a measurement that could have come out the other way

`WR-03` doubts whether the exit handler's `restoreAll()` after the signal handler's is a
genuine no-op or a second write. Round 2's review lists it as **"still stands"**. Plan 32-14
expected to exercise it by construction and could not, because the handler never ran; the
verifier recorded it as "unsettled rather than resolved".

**The obvious measurement would not have settled it.** Calling `restoreAll()` twice and
observing the original bytes still in place is compatible with BOTH hypotheses: a real no-op
and a re-write of the same original bytes produce identical results. It would have "passed"
against the very state `WR-03` doubts.

So `fixtures/harness-signal/restore-latch-driver.mjs` **changes the file between the two
calls**. After the first `restoreAll()` it writes a distinct sentinel by hand, then calls
`restoreAll()` again. Now the hypotheses predict different bytes: a genuine no-op leaves the
sentinel; a second write overwrites it with the original.

**The verdict, verbatim:**

```
$ node src/mcp/vice/fixtures/harness-signal/restore-latch-driver.mjs \
    /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a1ff406ebc453752e/.harness-signal-scratch-latchverdict
{"plantReallyHappened":true,"pendingCountBeforeFirstCall":1,"restoredToOriginalAfterFirstCall":true,"pendingCountAfterFirstCall":0,"sentinelIntactAfterSecondCall":true,"secondCallRewroteOriginal":false,"originalSha":"Ly8gaGFybmVzcyByZXN0b3Jl","afterSecondSha":"SEFSTkVTU19MQVRDSF9TRU5U"}
exit=0
```

**The discriminating observation: `sentinelIntactAfterSecondCall: true` together with
`secondCallRewroteOriginal: false`.** The hand-written sentinel SURVIVES the second call.
The second `restoreAll()` is a genuine no-op, not a re-write.

Supporting observations in the same verdict: the plant really happened
(`plantReallyHappened: true`), one original was captured before the first call
(`pendingCountBeforeFirstCall: 1`), the first call restored the pre-plant bytes
(`restoredToOriginalAfterFirstCall: true`), and the map was emptied by it
(`pendingCountAfterFirstCall: 0`).

**Disposition: `WR-03` is CLOSED rather than open.** It is settled by measurement, not by
argument, and the measurement had a failing outcome available to it. Had the sentinel been
overwritten, that would have been recorded here as a finding — the driver exits non-zero and
prints the same JSON on that path — and not silently repaired.

---

## 5. Broken-windows entry 33 — new state

Entry 33 currently reads:

> `| 33 | 32 | unmet-truth | scripts/audit-mutation-harness.mjs | 103 | Restore-on-signal invariant still behaviour-unverified: SIGINT/SIGTERM handlers cannot run mid-plant because main() is wholly synchronous; 10/10 attempts landed in the window and the child still exited 0, not 130 (plan 32-14 Task 3) | open | | 2026-08-31T22:34:00.734Z | |`

**New state: RESOLVED.** The invariant is observed through the harness's own registered
handler for both signals, 10/10 attempts exiting `130` with a null terminating signal, every
planted file restored byte-for-byte as a Buffer comparison, and no partial write left behind.
The entry's stated cause remains TRUE and is not contradicted — `main()` is still wholly
synchronous and a signal still cannot be dispatched mid-plant during a real CLI invocation.
What changed is that the invariant no longer had to be reached that way: the window is
created outside the harness by an in-process driver, which is the branch the verifier's own
either-or offered and the one that leaves the instrument alone.

Verifier truth 13 stops being present-but-unverified.

---

## 6. `D-17`, recorded in full — why harness code runs in CI and the decision still holds

Recorded here, once, because this is where a later auditor asking "why is harness code in
CI?" will look first. `src/mcp/vice/audit-harness-restore.test.ts`'s own header
cross-references this section.

**`D-17` says:** the mutation harness is a committed phase instrument, not a CI job. It
lives in the repo so a later phase can re-measure, but nothing runs it automatically. Its
two stated reasons: **(a)** it mutates files and drives the whole guard set — the wrong shape
for every-push CI; **(b)** its output is an audit measurement rather than a pass/fail
contract.

**Both reasons are false of this test, individually:**

| `D-17`'s reason | True of the harness | True of this test |
|---|---|---|
| mutates files | yes, in the real working tree | mutates only a throwaway, gitignored scratch root it creates and removes |
| drives the whole guard set | yes, every audited row | spawns **no** guard, drives **no** member of the audited set |
| reads the registry / writes evidence | yes | **neither** — the drivers call `plant()` directly and never `main()` |
| output is a measurement | yes, an evidence artifact | a pass/fail contract: 5 tests, assertions, exit status |

**What is actually exercised** is the harness's RESTORE MACHINERY — `plant()`, `restoreAll()`
and the registered signal handlers — against a scratch root. No registry row is planted.

**`D-16` is untouched.** The harness itself remains in **no CI step** and in **neither
`package.json` `scripts` block**. It is still invoked by hand, by its own file name. What
joined the automated suite is a `*.test.ts` file that happens to import the harness inside a
spawned child, which is a different thing from wiring the harness into CI.

**One structural precaution, load-bearing rather than stylistic (T-32-35).** Importing the
harness registers a SIGINT handler that calls `process.exit(130)`. Doing that inside the
test runner would change how the ENTIRE suite responds to an interrupt. So the test file
**never** imports the harness: every import happens inside a spawned driver child, and the
drivers live under `fixtures/harness-signal/`, which `test-gate.mjs`'s `automatedTestFiles()`
cannot reach because its `readdirSync` is non-recursive. Measured:

```
$ node -e 'import("./test-gate.mjs").then(m=>{const f=m.automatedTestFiles(process.cwd());
  console.log(f.length, f.includes("audit-harness-restore.test.ts"), f.some(x=>x.includes("driver")))})'
120 true false
```

120 automated files, the new test file **is** among them, **no** driver is.

---

## 7. The gates, re-run at `e61ee28` with the broker state beside them

Broker: **inactive** (§0), for every figure below.

```
$ node scripts/check-guard-fates.mjs
check-guard-fates: OK -- setA=43 setB=16 setC=2 total=61 rows=61 (floors setA=43 setB=16 setC=2 total=61)
  derived from 273 path(s) at 0394cbc; forward map 21 same-path / 15 renamed / 7 gone; set B 22 raw candidate(s) minus 6 already-claimed successor(s); set C parsed from .planning/ROADMAP.md line 846.
exit=0
```

```
$ node scripts/audit-gate.mjs
audit-gate: OK -- 9 docs guards green, 7 milestone audits scanned, 5 declaring a gated status
exit=0
```

```
$ cd src/mcp/vice && npm run typecheck
> tsc --noEmit -p tsconfig.json
exit=0
```

```
$ cd src/mcp/vice && npm run test:automated
# tests 3009   # suites 24   # pass 3001   # fail 2   # skipped 1   # todo 5
# duration_ms 45615.055666
exit=1
```

**The four counts: 3009 tests, 3001 pass, 2 fail, 1 skipped** (plus 5 todo), broker
**inactive**, at `e61ee28`.

### 7a. The two failures, and why neither belongs to this plan

`npm run test:automated` does **not** exit 0 on this base. Both survivors are stated rather
than absorbed, and neither is touched by this plan's diff — which is `.gitignore`,
`scripts/audit-mutation-harness.mjs` and three new files, and nothing else:

```
$ git diff --stat 07a9b48 HEAD
 .gitignore                                         |  11 +
 scripts/audit-mutation-harness.mjs                 |  85 +++-
 src/mcp/vice/audit-harness-restore.test.ts         | 472 +++++++++++++++++++++
 .../harness-signal/restore-latch-driver.mjs        | 137 ++++++
 .../harness-signal/signal-window-driver.mjs        | 141 ++++++
 5 files changed, 844 insertions(+), 2 deletions(-)
```

**1. `not ok 903` — `audit-root-args.test.ts`, "the matrix covers EVERY script wired to the
shared argv seam".** Reports `audit-gate` and `audit-mutation-harness` present on the seam
but absent from `MATRIX`. **This is plan 32-18's declared deliverable, executing in the same
wave**, and the orchestrator flagged it as expected on this base. The seam wiring it reads
was added to the harness by plan **32-17**, not by this plan; measured, this plan's diff
changes no line mentioning `parseRootArg` or `audit-root`:

```
$ git diff 07a9b48 HEAD -- scripts/audit-mutation-harness.mjs | grep -E "^[-+].*parseRootArg|^[-+].*audit-root"
exit=1          (no output — no seam line added or removed)
```

**2. `not ok 1536` — `repo-root.test.ts`, path agreement (D-3, D-6).** Its message:

> the agreed directory must not sit under .claude -- got
> `/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a1ff406ebc453752e/.vice-supervisor`

An artifact of executing inside a worktree that literally lives under `.claude/worktrees/`.
The assertion forbids the resolved supervisor directory from sitting under `.claude`, and in
a worktree it necessarily does. Environmental, not a code defect, and it disappears in the
main checkout after merge.

**Three failures were fixed and were this plan's own** — see §3b's note and commit `e61ee28`.
Before that fix the suite read `# fail 5`; after it, `# fail 2`.

### 7b. The whole-glob `npm test` was NOT run, and this is why

**`npm test` — the bare full glob `node --test '*.test.*'` — was not run, deliberately.** It
blocks indefinitely on `vice-proxy.test.ts`, which `evidence/32-close-gate.md` §2b measured
directly: `timeout 180 node --test vice-proxy.test.ts` returned `exit=124`, and plan 32-07
measured the same file still running when killed at 300106 ms. It is broken-windows entry
**#26**. That decision is **cited, not retaken** — §2b's own words: "the whole-glob form was
not run to green locally, and nothing in this document claims it was." The same holds here.

---

## 8. The verdict, in words

**The restore-on-signal invariant is OBSERVED, not claimed.**

On SIGINT and on SIGTERM, delivered while a plant is on disk and observed on disk before
delivery, the process exits **`130`** with a **null** terminating signal — meaning the
harness's own registered handler ran, because a registered handler suppresses the signal's
default action. Every captured original is restored **byte-for-byte**, asserted as a Buffer
comparison against a target carrying bytes no text round-trip could preserve. No partial
write survives. Ten attempts out of ten, five per signal.

**What changed relative to plan 32-14's ten attempts is not the harness.** It is that the
window now exists outside it. Plan 32-14 signalled a process whose entire stack was
synchronous JavaScript, so the queued handler could never be dispatched and all ten runs
exited `0` through the ordinary `finally` path. This round signals a process that has the
same four real handlers registered — by import, under the pre-existing `IS_ENTRY_POINT`
guard — a real plant on disk, and an idle event loop. The harness's runtime behaviour under
a real invocation is unchanged and still exits `0` through the ordinary path, which the
negative control demonstrates in the same suite run.

**The distinguishing evidence is the exit code, and both required signals are present:**
`130` versus plan 32-14's ten zeros, and the child's own emitted marker preceding every
signal. Neither alone would have been enough. Byte identity alone certainly would not have
been — the negative control has it too.

**`WR-03` is settled and closed.** Broken-windows entry 33 moves from `open` to resolved.

---

*Plan: 32-19. Commit measured: `e61ee28`. Broker: inactive. Date: 2026-09-01.*
