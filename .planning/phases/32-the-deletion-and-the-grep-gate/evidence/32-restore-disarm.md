# The restore machinery was disarmable: the latch deleted, and the guard watched biting

Plan 32-20, gap-closure round 3, gap 2 / `CR-10`. Successor to
`evidence/32-restore-on-signal.md`, whose reachability result stands and is not restated
here — this document records the half of plan 32-19's must-have 1 that the round-3
verifier falsified, and the proof that the case now guarding it can be made to fail.

**Verdict, stated before the log so it cannot be mistaken for a summary of a summary: a
process that has ALREADY completed one restore cycle now restores its next captured plant
on SIGINT and on SIGTERM, observed through the harness's own registered handler at exit
`130` with a byte-identical restore. The two cases that say so were watched FAILING against
a deliberately re-introduced latch before they were trusted. The shipped CLI path was never
affected, and nothing below describes it as having been.**

---

## 0. Preconditions, read before anything was measured

**Checkout root.** `/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a53088416713c98f1`
— a GSD worktree on branch `worktree-agent-a53088416713c98f1`, forked from `ccb55f9`.
Every figure in this document was taken from THAT root, not from the main checkout, and
each figure below repeats it rather than relying on this paragraph.

**Commit measured.** `1adfee2631e27cf4bb264df91df7a7ff082079e2` (`1adfee2`), the tip of
this plan's three code commits:

| Commit | Subject |
|---|---|
| `1aa20f0` | `test(32-20)`: add failing second-window disarm cases and their in-process driver (RED) |
| `6e6d76a` | `fix(32-20)`: delete the restore latch — the map clear is the only mechanism (GREEN) |
| `1adfee2` | `test(32-20)`: WR-29 admit non-hidden `src/` paths, WR-28 read the child exit state |

**Date.** 2026-09-01.

**Broker state (D-13).** Read-only, by the method `evidence/32-close-gate.md` §2b
establishes and for the reason it gives. Nothing in this run stops, kills, restarts or
otherwise touches the developer's `vice-broker` systemd user unit.

```
$ systemctl --user is-active vice-broker
inactive
exit=4
```

```
$ ps -eo pid,args | grep -i vice-broker | grep -v grep
exit=1          (no output — no matching process)
```

> **The `pgrep` trap, honoured rather than re-derived.** §2b records that
> `pgrep -af vice-broker` SELF-MATCHES — it finds its own wrapping command line and reports
> a hit on an idle host. The `ps | grep -v grep` form above is the one whose output is
> trustworthy, and it is the form every broker reading in this document uses.

**Why the broker state rides beside every figure.** A live broker reds
`vice-proxy.test.ts`'s BACK-05 D–G ordering test **deterministically** — not as a flake —
so a suite figure recorded without its broker state is void rather than merely unlabelled.
**The broker was inactive for every figure in this document.**

**Tree baseline, and it is NOT the main checkout's baseline.** `git status --porcelain`
in this worktree returns **zero lines**. The four pre-existing untracked files that the
main checkout carries at dispatch — `docs/dissambler-workflow.md`,
`docs/undocumented-opcodes-ghidra.md`, `docs/vice-mcp-ideas.md`, `skills-lock.json` — are
**not** present here, because a fresh worktree does not carry another checkout's untracked
files. Every "tree returned to baseline" claim below therefore means *empty porcelain in
this worktree*, and says so. Importing the four-file figure into a worktree measurement
without naming the tree would be exactly the unearned precision this phase exists against.

---

## 1. The defect, CITED rather than re-derived

The round-3 verifier reproduced this independently, against a scratch root, with its own
driver. Its four measured values, quoted from `32-VERIFICATION.md` `gaps[1]`:

```
plant        -> PLANTED_ONE,  pendingRestoreCount() = 1
restoreAll() -> ORIGINAL,     pendingRestoreCount() = 0
plant again  -> PLANTED_TWO,  pendingRestoreCount() = 1
SIGINT       -> EXIT=130, and FINAL ON DISK: PLANTED_TWO
```

The first cycle restored cleanly; the second did not. The process exited `130` **as
advertised** and left a captured original unrestored — precisely the half of plan 32-19's
must-have 1 that reads *"restores every captured original byte-for-byte"*.

That reproduction is cited, not repeated. This plan owns the fix and the guard, and
re-deriving someone else's measurement adds no fact.

**Scope, stated plainly so this document does not over-claim.** The **shipped CLI path was
never affected**, and the verifier proved it twice. `main()` calls the per-row revert from
*inside* the row loop — and that revert deletes its entry from the captured-originals map
without consulting any latch — and calls the restore-all function exactly once, in the
`finally` *after* that loop. The latch could therefore never be set while a plant was on
disk during a real sweep, and the verifier's own 61-row `--all` run finished
`tree: restored byte-identical to the baseline`. The one in-process consumer that existed
plants once per child process, which is exactly why its 5/5 green did not catch this.

---

## 2. The remedy, and why it needed no replacement mechanism

`restoreAll()` ends with `originals.clear()`. A second call therefore iterates an empty map
and writes nothing **with no latch present at all**. The latch was redundant for the
property it was added for and harmful for the property it broke, so it is **deleted**, and
nothing is put in its place — no counter, no set of already-restored paths, no flag under
another name, no size check, no guard inside the signal handler. Two mechanisms for one
property is how this defect returns under a new name.

**Comment-stripped, NUL-safe census** at `1adfee2`, from the worktree root. `grep -a` is
used throughout because a plain `grep` silently skips a file containing a NUL byte and has
already produced one false decision in this project.

```
$ grep -avE '^[[:space:]]*(//|\*|/\*)' scripts/audit-mutation-harness.mjs > /tmp/code-only.txt
$ grep -ac 'let restored'    /tmp/code-only.txt   ->  0
$ grep -ac 'if (restored)'   /tmp/code-only.txt   ->  0
$ grep -ac 'restored = true' /tmp/code-only.txt   ->  0
$ grep -acE 'await|async |\.then\(' /tmp/code-only.txt   ->  0
$ grep -ac 'originals.clear()' /tmp/code-only.txt ->  1
$ grep -ac 'originals.clear()' scripts/audit-mutation-harness.mjs  ->  2
```

The whole-file count of `originals.clear()` is **2** and the code-only count is **1**: the
second hit is the correction comment naming that call as the mechanism, which is the
intended shape. The three latch censuses are comment-stripped for the same reason in
reverse — a correction comment that quoted the deleted statements verbatim would invalidate
its own census, so the comment describes them by concept and never reproduces them.

**Export surface, unchanged — no fourth symbol:**

```
$ node -e 'import("./scripts/audit-mutation-harness.mjs").then(m=>process.stdout.write(Object.keys(m).sort().join(",")))'
pendingRestoreCount,plant,restoreAll
```

**Syntax:**

```
$ node --check scripts/audit-mutation-harness.mjs                                   exit=0
$ node --check src/mcp/vice/fixtures/harness-signal/restore-disarm-driver.mjs        exit=0
```

---

## 3. THE BITE PROOF — both halves, verbatim

The order below is the one that was actually run, and it is worth naming because it is
stronger than the order the plan asked for. The discriminating cases were written and run
**against the latch as it stood committed**, BEFORE a line of the fix existed — so the
first RED is against the real defect, not against a re-introduction of it. The formal
re-introduction was then performed against the FINAL state of both files, so the acceptance
criterion is satisfied on its own terms as well.

Broker: **inactive** for all four runs. Checkout root: the worktree named in §0.

### 3a. RED — the cases written against the committed latch, before the fix existed

`$ cd src/mcp/vice && node --test audit-harness-restore.test.ts` → `exit=1`

```
ok 1 - SIGINT delivered inside the plant window exits 130 and restores byte-for-byte
ok 2 - SIGTERM delivered inside the plant window exits 130 and restores byte-for-byte
ok 3 - negative control: the same driver finishing WITHOUT a signal exits 0 and is also byte-identical
ok 4 - WR-03: after a first restoreAll(), a second call is a genuine no-op rather than a re-write
not ok 5 - gap 2 / CR-10: SIGINT in the SECOND window -- after a restore cycle has already completed -- still restores
not ok 6 - gap 2 / CR-10: SIGTERM in the SECOND window -- after a restore cycle has already completed -- still restores
ok 7 - the attempt log is complete and every recorded exit code is the discriminating one
# tests 7
# pass 5
# fail 2
```

### 3b. GREEN — the same command after the latch was deleted

`$ cd src/mcp/vice && node --test audit-harness-restore.test.ts` → `exit=0`, 7 tests,
7 pass, 0 fail.

### 3c. RED again — the latch DELIBERATELY RE-INTRODUCED against the final files

The re-introduction is exactly the three lines that were removed, applied to `1adfee2`:

```
$ git diff -- scripts/audit-mutation-harness.mjs
@@ -167,8 +167,11 @@ const EXCERPT_MAX = 4000;

 /** absolute path -> original bytes, captured BEFORE the first write. */
 const originals = new Map();
+let restored = false;

 export function restoreAll() {
+  if (restored) return;
+  restored = true;
   for (const [abs, bytes] of originals) {
     try {
       writeFileSync(abs, bytes);
```

`$ cd src/mcp/vice && node --test audit-harness-restore.test.ts` → `exit=1`

```
ok 1 - SIGINT delivered inside the plant window exits 130 and restores byte-for-byte
ok 2 - SIGTERM delivered inside the plant window exits 130 and restores byte-for-byte
ok 3 - negative control: the same driver finishing WITHOUT a signal exits 0 and is also byte-identical
ok 4 - WR-03: after a first restoreAll(), a second call is a genuine no-op rather than a re-write
not ok 5 - gap 2 / CR-10: SIGINT in the SECOND window -- after a restore cycle has already completed -- still restores
not ok 6 - gap 2 / CR-10: SIGTERM in the SECOND window -- after a restore cycle has already completed -- still restores
ok 7 - the attempt log is complete and every recorded exit code is the discriminating one
# tests 7
# suites 0
# pass 5
# fail 2
# skipped 0
# todo 0
# duration_ms 1320.487278
```

The two failures name the un-restored second plant, verbatim:

```
error: "SIGINT disarm: the SECOND plant (HARNESS_DISARM_TARGET_PLANTED_TWO) was NOT restored.
The process exited 130 through the harness's own handler and still left a captured original
unrestored -- the restore machinery was disarmed by the first completed restore cycle.
Compared as Buffers, not as text."

error: "SIGTERM disarm: the SECOND plant (HARNESS_DISARM_TARGET_PLANTED_TWO) was NOT restored.
The process exited 130 through the harness's own handler and still left a captured original
unrestored -- the restore machinery was disarmed by the first completed restore cycle.
Compared as Buffers, not as text."
```

**The five pre-existing cases stay green in that same run**, which is what proves the two
new cases are the ones doing the work rather than the file failing for an unrelated reason.

### 3d. GREEN — the plant removed

```
$ git checkout -- scripts/audit-mutation-harness.mjs
$ cd src/mcp/vice && node --test audit-harness-restore.test.ts        exit=0
```

```
ok 1 - SIGINT delivered inside the plant window exits 130 and restores byte-for-byte
ok 2 - SIGTERM delivered inside the plant window exits 130 and restores byte-for-byte
ok 3 - negative control: the same driver finishing WITHOUT a signal exits 0 and is also byte-identical
ok 4 - WR-03: after a first restoreAll(), a second call is a genuine no-op rather than a re-write
ok 5 - gap 2 / CR-10: SIGINT in the SECOND window -- after a restore cycle has already completed -- still restores
ok 6 - gap 2 / CR-10: SIGTERM in the SECOND window -- after a restore cycle has already completed -- still restores
ok 7 - the attempt log is complete and every recorded exit code is the discriminating one
# tests 7
# suites 0
# pass 7
# fail 0
# skipped 0
# todo 0
# duration_ms 1514.548498
```

**Tree after the plant was removed:**

```
$ git status --porcelain
                (no output — zero lines, this worktree's baseline; see §0)
```

### 3e. The `WR-03` sentinel case is green with NO latch present

Case 4 above, in every run in this section including 3b and 3d:

```
ok 4 - WR-03: after a first restoreAll(), a second call is a genuine no-op rather than a re-write
```

It is green **by construction, not by adjustment**. Nothing in that case, its driver or its
assertions was touched by this plan. It passes because `originals.clear()` leaves the second
call with an empty map to iterate — which is the same mechanism the latch deletion relies
on, so the case and the fix rest on one fact rather than two. That it is *also* green with
the latch present is `WR-27` restated: the sentinel distinguishes a no-op from a re-write,
which is what `WR-03` literally asked, and it cannot distinguish a latch from the map clear.

---

## 4. `WR-29` — the porcelain attribution, and the measured basis for it

**The basis was RE-DERIVED from the committed registry at this commit, not copied from the
plan.** Command and result:

```
$ node -e 'const r=JSON.parse(require("fs").readFileSync(".planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json","utf8"));
           const rows=r.rows||[]; const plants=rows.filter(x=>x.plant&&typeof x.plant.file==="string");
           const byTop={}; let fixtures=0;
           for(const p of plants){const f=p.plant.file; const top=f.split("/")[0]+"/";
             byTop[top]=(byTop[top]||0)+1; if(f.split("/").includes("fixtures"))fixtures++;}
           console.log(rows.length, plants.length, JSON.stringify(byTop), fixtures)'

total rows: 61
plant descriptors: 35
by top-level dir: {"scripts/":10,".planning/":2,"src/":23}
containing a /fixtures/ segment: 0
```

**No divergence from the planner's figure.** 35 plant descriptors — 23 `src/`, 10
`scripts/`, 2 `.planning/`, 0 under any `fixtures/` directory. The two `.planning/` targets
are `.planning/PROJECT.md` and an `ANSWER.sha256` under a phase-11 evidence directory.

The conclusion that basis supports, and no more: **all three trees the registry can name
are admitted** — `.planning/` and `scripts/` already were, and `src/` is added here — so the
admission now covers every mis-containment target the registry can produce.

### 4a. The `/fixtures/` exclusion alone was NOT sufficient — recorded as a finding

The plan anticipated a concurrency flake and prescribed, if one appeared, narrowing the
admission to `src/mcp/vice/` excluding `/fixtures/`. **That prescription would not have
worked, and the measurement is why.** The first form of the widening red two cases under the
concurrent suite:

```
$ cd src/mcp/vice && npm run test:automated
# tests 3019   # pass 3009   # fail 4

not ok 857 - negative control: the same driver finishing WITHOUT a signal exits 0 and is also byte-identical
  error: Expected values to be strictly deep-equal:
    + [ '?? src/mcp/vice/.anno-cli-test-6kraqX/' ]
    - []

not ok 858 - WR-03: after a first restoreAll(), a second call is a genuine no-op rather than a re-write
  error: the latch run left porcelain entries this test is responsible for
    + [ '?? src/mcp/vice/.anno-cli-test-8OGMOQ/' ]
    - []
```

The churn is a concurrent sibling's own scratch root **inside `src/mcp/vice/`**, so the
named narrowing would have admitted it unchanged. What actually separates it from every
real target is that it is a **hidden** directory. Measured both directions at this commit:

```
$ grep -rhoE 'mkdtempSync\(join\([A-Za-z_]+, *"[^"]+"' src/mcp/vice/*.test.ts src/mcp/vice/*.test.mts | sed 's/.*, *"/"/' | sort -u
".anno-cli-test-"
".anno-memmap-cross-root-"
".anno-memmap-empty-"
".audit-root-synth-"
"vice-proxy-evidence-test-"
```

Four of the five are dot-prefixed roots under `src/`; `anno-memmap-render.test.ts` also
builds a parameterised `` `.${opts.prefix}-` `` form, dot-prefixed by construction. The one
non-dot prefix, `vice-proxy-evidence-test-`, is created under `.planning/` by
`vice-proxy.test.ts`, which is manual-only and never runs in this gate — and `.planning/`
stays admitted unconditionally on purpose, because that is where a mis-contained run writes
its registry and evidence.

Against the registry: **0 of the 23 `src/` plant targets contain a dot-prefixed path
segment.** So the admission is `src/` paths with neither a `/fixtures/` segment nor any
dot-prefixed segment. It costs nothing against the basis and removes the whole measured
churn class. The admission was **narrowed, never widened back to excluding `src/`
outright**, and this section is the recorded reason.

### 4b. Both required runs, with the result recorded either way

| Run | Checkout root | Broker | Result |
|---|---|---|---|
| Isolated — `node --test audit-harness-restore.test.ts` | the worktree in §0 | inactive | `exit=0`, 7 tests, 7 pass, 0 fail |
| Concurrent — `npm run test:automated` | the worktree in §0 | inactive | `exit=1`, 3019 tests, 3012 pass, **1** fail, 1 skipped, 5 todo |

The single remaining concurrent failure is **not in this file and not caused by this plan**:

```
not ok 1546 - path agreement (D-3, D-6, ...): ... the agreed path is not under .claude
  location: 'src/mcp/vice/repo-root.test.ts:178:1'
  error: 'the agreed directory must not sit under .claude -- got
    /home/henrik/.../.claude/worktrees/agent-a53088416713c98f1/.vice-supervisor'
```

That is **broken-windows entry 36**, already on the ledger: the `!includes('.claude')`
substring predicate fails unconditionally when the suite is run from a GSD worktree under
`.claude/worktrees/`. It is a property of WHERE this checkout is, not of anything this plan
touched, and it is expected to be absent once the branch is merged into a main checkout
whose root is not under `.claude`. Recorded here rather than left as an unexplained
non-zero exit.

**One green concurrent run is not proof of the absence of a flake**, and this document does
not claim it is. What it claims is narrower and checkable: the churn class that actually
fired was measured, its shape was identified, and the admission now excludes exactly that
shape on a stated basis. A second, different churn shape would red this file again, and the
recorded remedy is to measure it and narrow again — never to widen back to excluding `src/`.

---

## 5. `WR-28` — the plant-observation loop reads the child's exit state

The loop that polls the target for the planted bytes previously read **only its own
deadline**, while the marker loop directly above it already read `exited`. A driver that
died before its plant became observable therefore spun for the full 20 s and then failed
with a message about a deadline rather than about a dead child. The same assertion the
marker loop makes is now made here, applied to the **shared** routine so the negative
control and both first-window signal paths all get it, and again in the second-window
routine.

**No passing run's outcome changes** — an early exit already failed here, just slowly and
uninterpretably. Measured: the negative control still exits `0` and is still byte-identical
(case 3, green in every run in §3), and the file's isolated duration is unchanged in kind
(1.25 s before this plan, 1.51 s after, with two more spawned children).

---

## 6. The shipped CLI path, re-measured after the deletion

The deletion touches a cleanup path, so the CLI was re-run rather than reasoned about.
Checkout root: the worktree in §0. Broker: inactive.

```
$ node scripts/audit-mutation-harness.mjs --row scripts/lib/skill-honesty-checks.mjs \
    --out .harness-signal-scratch-cli/cli-regression.md
audit-mutation-harness: selected 1 row(s)
  OBSERVED RED  scripts/lib/skill-honesty-checks.mjs: guard exit status 1 (control exit status 0)
                command: node scripts/check-skill-fork-honesty.mjs
  counts: measured=1 skipped=0 total=1
  evidence: <worktree>/.harness-signal-scratch-cli/cli-regression.md
  registry: <worktree>/.planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json
  tree: restored byte-identical to the baseline
exit=0
```

The `--out` path is inside the gitignored `.harness-signal-scratch-*` prefix, so the run
produced no porcelain churn of its own; the directory was removed afterwards. The registry
write-back ran (it is not suppressed for a single successful row) and produced **byte-
identical content**, so no path-scoped `git checkout --` was needed:

```
$ git diff --stat
                (no output — the registry write-back changed nothing)
$ rm -rf .harness-signal-scratch-cli
$ git status --porcelain | wc -l
0
```

**Other gates**, same root, same broker state:

```
$ cd src/mcp/vice && npm run typecheck        exit=0   (tsc --noEmit -p tsconfig.json, no diagnostics)
$ node scripts/check-guard-fates.mjs          exit=0
check-guard-fates: OK -- setA=43 setB=16 setC=2 total=61 rows=61 (floors setA=43 setB=16 setC=2 total=61)
  derived from 273 path(s) at 0394cbc; forward map 21 same-path / 15 renamed / 7 gone;
  set B 22 raw candidate(s) minus 6 already-claimed successor(s); set C parsed from .planning/ROADMAP.md line 856.
```

**The whole-glob `npm test` was NOT run, and that is a statement rather than an omission.**
It blocks indefinitely on `vice-proxy.test.ts` — broken-windows entry **26**, measured
before as still running when killed at 300106 ms and as `exit=124` under a 180 s bound. The
automated subset (`npm run test:automated`) is the terminating gate and is the one recorded
in §4b.

---

## 7. The ledger movement, and its arithmetic before and after

The three movements were made **in this exact order**, and the order is load-bearing: no
intermediate state may have entry 33 closed with no successor present.

1. **Counters read first** (`windows status`, before anything was written):
   `open_count: 22`, `waived_count: 12`, `fixed_count: 5`, `total_count: 39`, max id `39`.
2. **APPEND the successor entry** — kind `unmet-truth`, phase `32`, file
   `scripts/audit-mutation-harness.mjs`. The ledger assigned id **40**; that id was
   **read back** rather than assumed. Counters after: open 23, fixed 5, total 40.
3. **Mark entry 40 fixed.** Counters after: open 22, fixed 6, total 40.
4. **Close entry 33** — its successor already on the page. Counters after: open 21, fixed 7,
   total 40.

**Arithmetic, reconciled:** one append and two closures against a 22-open / 5-fixed /
39-total starting ledger gives **21 open, 7 fixed, 40 total**. Measured, through the tool's
own reader:

```
LEDGER OK {"open":21,"fixed":7,"total":40,"successor":40,"entry35":"open",
           "reason33Len":864,"reason40Len":671}
```

Entry **35 is untouched and still `open`** — plan 32-21 owns it.

### 7a. The ledger verified by DIFFING it, not by trusting the tool

This project has a standing record of planning-state verbs mutating more than they
advertise, so the file was diffed field by field against `HEAD`:

```
rows before=39 after=40
added=[40] removed=[]
row 33 changed fields: ["status","reason","resolved_at"]
pre-existing row ORDER unchanged: true
ids strictly ascending: true
```

`git diff --numstat -- .planning/WINDOWS.md` → `21 insertions, 8 deletions`, across exactly
seven hunks: the four frontmatter counters; entry 33's markdown row; one appended markdown
row (id 40); entry 33's JSON `status`/`reason`/`resolved_at`; and the appended JSON object
for id 40. **No pre-existing row was reordered, renumbered, reworded, or given a
`resolved_at` it did not have.**

**One honest note about "exactly two status transitions".** The net diff shows entry 33
transitioning `open → fixed`, and entry 40 arriving **already** `fixed`. That is because
step 2 and step 3 both happened before the commit, so the diff collapses
`append(open) → fix(40)` into a single appended row. The two transitions were really
performed, in the recorded order; the committed diff simply cannot show a state that existed
only between two uncommitted writes. Stating that is cheaper than letting a later reader
count one transition and conclude the order was not followed.

### 7b. `reason` had to be written by hand, and that is recorded rather than hidden

The `windows fixed` subcommand sets `status` and `resolved_at` but leaves `reason` empty.
Both closures owe a citation, so the `reason` field of rows 33 and 40 — and **only** those
two rows — was written into both representations the file carries (the markdown table and
the JSON block) by a script that refuses to run unless each target row is already `fixed`
and its `reason` is still empty, and that asserts it made exactly two edits in each
representation. The tool's own reader was then re-run and round-trips both reasons
(`reason33Len: 864`, `reason40Len: 671` above), so the two representations are consistent
and the ledger is still machine-readable.

### 7c. The timestamp arc, stated so it does not read as backdating

Entry 40's `recorded_at` (`2026-09-01T10:58:05.666Z`) and `resolved_at`
(`2026-09-01T10:58:25.297Z`) are **~20 seconds apart**, because the defect was found by the
round-3 verifier and fixed by this plan **in the same round**. That is a record of the
defect's whole arc, not a backdated close.

The two alternatives were both worse and both rejected on the page. Leaving the entry
**open** over a defect this plan removed would be a false open window. **Not opening it at
all** — closing entry 33 and recording nothing in its place — is exactly what
`gaps[1].missing[2]` forbids, and is the honesty laundering this phase's own criterion 1
exists against.

### 7d. What entry 33 closes ON

Entry 33's stated content is *"Restore-on-signal invariant still behaviour-unverified:
SIGINT/SIGTERM handlers cannot run mid-plant because main() is wholly synchronous."* That
content **is** discharged — `evidence/32-restore-on-signal.md`, 10/10 attempts at exit `130`
with byte-identical restores, and the 5/5 green run of the committed test file. It closes on
that content and on nothing else.

Its stated **cause** is not disputed and remains true: `main()` is still wholly synchronous,
and a real CLI invocation still cannot dispatch a handler mid-plant. What changed is that
the invariant no longer had to be reached that way. And the latch's *other* consequence —
the disarm, which entry 33 was never about — is carried forward by entry 40 rather than
evaporating with the entry that happened to be nearby.

---

_Measured 2026-09-01 at `1adfee2` on `worktree-agent-a53088416713c98f1`, in
`/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a53088416713c98f1`.
`vice-broker` inactive for every figure._
