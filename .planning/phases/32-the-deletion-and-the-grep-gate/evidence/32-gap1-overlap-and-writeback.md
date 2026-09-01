# Phase 32 — gap 1: the overlap arithmetic, and the registry write-back reached

Written by plan **32-21** (gap-closure round 3, wave 2). It extends the format of
`evidence/32-gap4-sweep-rerun.md` rather than inventing one: pre-flight readings, the raw
command, the raw output, the registry diff shape, and the discard with its reasoning.

**What this file is for.** Round 3's verification recorded truth 14 as FAILED on one row:
`src/mcp/vice/hop-chain-comments.test.ts`'s committed evidence could not be re-measured by the
committed instrument, and because a refused plant sets the run's hard-failure flag, the whole-set
registry write-back could not be reached while that row stood. This file is the measurement that
discharges it, plus every bite proof behind the fix, plus the register of what this round did NOT
take.

---

## 0. Environment — recorded once, and repeated beside every figure below

| Fact | Value |
|---|---|
| **Checkout root** | `/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-adc279c1ee3498cde` — a GSD worktree on branch `worktree-agent-adc279c1ee3498cde`, forked from `01894b9`. **Not** the main checkout. |
| **Commit measured (pre-flight)** | `77b7323a134bd29972eda901d300e77cd1a9c6cf` (tasks 1 and 2 committed; task 3's decision comment present as an uncommitted working-tree change) |
| **Plan base** | `01894b98956fa9f3ea83eb0ca085caaec68f8119` (plan 32-20 merged) |
| **Broker unit** | `systemctl --user is-active vice-broker` → `inactive`, exit 4 |
| **Broker process** | `ps -eo pid,args \| grep -i vice-broker \| grep -v grep` → no output, exit 1 |

**Why the broker state is beside every figure.** A live broker reds `vice-proxy.test.ts`'s
BACK-05 D–G ordering test **deterministically** — not as a flake — so a suite figure recorded
without its broker state is void rather than merely unlabelled. It was `inactive` for every
figure in this file. The `pgrep -af vice-broker` trap recorded in `evidence/32-close-gate.md` §2b
is avoided the same way that file avoids it: the process probe excludes its own command line.

**Why the checkout root is beside every figure.** A worktree baseline (an EMPTY
`git status --porcelain`) and a main-checkout baseline (four untracked files at dispatch:
`docs/dissambler-workflow.md`, `docs/undocumented-opcodes-ghidra.md`, `docs/vice-mcp-ideas.md`,
`skills-lock.json`) are different facts and must not be interchanged. **Every "tree returned to
baseline" claim in this file means zero porcelain lines in THIS worktree**, apart from the
tracked files this plan itself is editing, which are named where they appear.

**`grep -a` throughout.** A plain `grep` silently skips a file containing a NUL byte and has
already produced one false decision in this project.

---

## 1. Task 1 — gap 1 itself

### 1a. THE RED, against the harness as plan 32-20 left it

The case group was written and run **before a line of the fix existed**.

```
$ cd src/mcp/vice && node --test audit-harness-restore.test.ts        exit=1
ok 1 - SIGINT delivered inside the plant window exits 130 and restores byte-for-byte
ok 2 - SIGTERM delivered inside the plant window exits 130 and restores byte-for-byte
ok 3 - negative control: the same driver finishing WITHOUT a signal exits 0 and is also byte-identical
ok 4 - WR-03: after a first restoreAll(), a second call is a genuine no-op rather than a re-write
ok 5 - gap 2 / CR-10: SIGINT in the SECOND window -- after a restore cycle has already completed -- still restores
ok 6 - gap 2 / CR-10: SIGTERM in the SECOND window -- after a restore cycle has already completed -- still restores
ok 7 - the attempt log is complete and every recorded exit code is the discriminating one
not ok 8 - plant contract / overlap-accepted: a replacement that textually overlaps its own pre-existing occurrence is accepted, and the file grows by exactly one byte at the match position
ok 9 - plant contract / pre-existing-replacement-accepted: a replacement that already occurs elsewhere in the target, non-overlapping, is still accepted
ok 10 - plant contract / substitution-is-verbatim: a replacement carrying a match-substitution pattern reaches disk BYTE FOR BYTE, uninterpreted
ok 11 - plant contract / find-absent-refused: a find that matches zero times is refused, the measured count is named, and nothing is written
ok 12 - plant contract / find-twice-refused: a find that matches twice is refused, the measured count is named, and nothing is written
ok 13 - plant contract / empty-replacement-refused: an empty `replace` field is refused BY NAME and nothing is written
# tests 13
# suites 0
# pass 12
# fail 1
# skipped 0
# todo 0
# duration_ms 2067.9969
```

**Exactly one failure, and it is the new case.** Every other case in the group, and every case
plan 32-20 left green, passes in that same run — which is what proves the new case is the one
doing the work rather than the group being broadly broken.

The failure is the harness's own post-condition, verbatim:

```
error: |-
  the overlap descriptor was REFUSED: row fixtures/harness-signal/plant-contract-driver.mjs:
  plant post-condition FAILED for plant-contract-target.txt -- the recorded `replace` string
  occurs 1 time(s) in that file BEFORE the mutation and 1 time(s) after it, so the mutation
  would INTRODUCE it 0 time(s); exactly 1 is required. A mismatch means the bytes this harness
  would write are not the bytes this row records, so the row would promise a reader a
  hand-reproducible find/replace that does not reproduce. Nothing was written. The three counts
  are reported separately so the divergence can be located: whether the replacement reaches the
  mutated text at all, whether the write lands it more than once, and how many times it was
  already present independently of this mutation (CR-02, CR-06).
  This is gap 1: the plant post-condition cannot see a replacement that overlaps its own
  pre-existing occurrence, so it refuses an honest descriptor and blocks the whole-set registry
  write-back.
```

`INTRODUCE it 0 time(s)` is the whole defect. Broker inactive; worktree root.

**The case is modelled on the real row, not on a description of it.** The committed descriptor
for `src/mcp/vice/hop-chain-comments.test.ts` plants into
`src/mcp/vice/absorbed-answer-key.test.ts` with `replace` equal to `find` with one newline
prepended, and the find sits on its own line. The driver's `overlap-accepted` case reproduces
exactly that shape against a throwaway target.

### 1b. THE GREEN, after the arithmetic was corrected

```
$ cd src/mcp/vice && node --test audit-harness-restore.test.ts        exit=0
ok 1 ... ok 13
# tests 13
# suites 0
# pass 13
# fail 0
# skipped 0
# todo 0
# duration_ms 1850.395506
```

Broker inactive; worktree root.

### 1c. BITE PROOF 1 — the whole-file difference form restored

The plant is exactly the three deleted bindings and the equality check on their difference,
re-introduced against the FINAL state of the file:

```
$ git diff -- scripts/audit-mutation-harness.mjs        (the plant, abridged to the changed lines)
+  // BITE PROOF 1 PLANT -- the whole-file difference form, deliberately restored.
   const preExisting = text.split(descriptor.replace).length - 1;
   const afterMutation = mutated.split(descriptor.replace).length - 1;
   const introduced = afterMutation - preExisting;
+  const matchIndex = text.indexOf(descriptor.find);
   ...
   if (introduced !== 1) {
```

```
$ cd src/mcp/vice && node --test audit-harness-restore.test.ts        exit=1
not ok 8 - plant contract / overlap-accepted: ...
# tests 13   # pass 12   # fail 1
```

**Only `overlap-accepted` goes red; every other case stays green.** With the plant removed:

```
$ cd src/mcp/vice && node --test audit-harness-restore.test.ts        exit=0
# tests 13   # pass 13   # fail 0
```

### 1d. BITE PROOF 2 — the substitution reverted to a replacement STRING

This is the proof that the corrected post-condition is a standing **pin** on the `CR-02` fix
rather than a tautology. The plant is one line:

```
-  const mutated = text.replace(descriptor.find, () => descriptor.replace);
+  const mutated = text.replace(descriptor.find, descriptor.replace);
```

```
$ cd src/mcp/vice && node --test audit-harness-restore.test.ts        exit=1
not ok 10 - plant contract / substitution-is-verbatim: ...
# tests 13   # pass 12   # fail 1
```

**And the failure is reported BY the post-condition's own message**, which is the point:

```
error: |-
  the plant was REFUSED: row fixtures/harness-signal/plant-contract-driver.mjs: plant
  post-condition FAILED for plant-contract-target.txt -- the recorded `replace` string did not
  land verbatim at the unique match position. At index 56 the mutated text does NOT begin with
  the recorded replacement, and the mutation changes the text by 30 character(s) where an exact
  substitution would change it by 3. Either fact failing means the bytes this harness would
  write are not the bytes this row records -- the CR-02 divergence class -- so the row would
  promise a reader a hand-reproducible find/replace that does not reproduce. Nothing was
  written. Do NOT edit the recorded evidence to satisfy this check: the descriptor is the record
  and the instrument is what moves (CR-02, CR-06, CR-09).
```

Both facts fail together, as the plan's flagged assumption 1 required them to be able to: the
position assertion is **FALSE**, and the length delta is **+30** against an expected **+3**.
(The planner's own measurement of the same phenomenon on a different descriptor was +2 against
an expected −4; the numbers differ because the descriptor differs, and this file records what
was measured here rather than importing the planner's figure.) With the plant removed:

```
$ cd src/mcp/vice && node --test audit-harness-restore.test.ts        exit=0
# tests 13   # pass 13   # fail 0
$ git status --porcelain
 M scripts/audit-mutation-harness.mjs
 M src/mcp/vice/audit-harness-restore.test.ts
?? src/mcp/vice/fixtures/harness-signal/plant-contract-driver.mjs
```

Exactly this task's own tracked changes plus its new file. Zero unexplained entries — this
worktree's baseline is an empty porcelain.

### 1e. Comment-stripped, NUL-safe census after Task 1

```
$ grep -ac 'narrowing costs nothing' scripts/audit-mutation-harness.mjs          0
$ grep -avE '^[[:space:]]*(//|\*|/\*)' scripts/audit-mutation-harness.mjs > code-only.txt
$ grep -ac 'preExisting'            code-only.txt                                0
$ grep -ac 'afterMutation'          code-only.txt                                0
$ grep -acE 'await|async |\.then\(' code-only.txt                                0
$ grep -ac 'matchIndex'             scripts/audit-mutation-harness.mjs           3
$ grep -ac 'hop-chain-comments'     scripts/audit-mutation-harness.mjs           2
```

The two counter censuses are comment-stripped for a stated reason **in reverse**: the
replacement comment describes the deleted bindings by concept and never reproduces their
identifiers, so it cannot invalidate its own census; and the deleted sentence is not re-quoted
anywhere, which is why its whole-file count is a real zero.

The module is still **wholly synchronous** — zero code occurrences of `await`, `async ` or
`.then(`. Plan 32-19's standing prohibition against injecting an `await` into this instrument is
not lifted by this plan.

### 1f. Export surface and syntax

```
$ node -e 'import("./scripts/audit-mutation-harness.mjs").then(m=>process.stdout.write(Object.keys(m).sort().join(",")))'
pendingRestoreCount,plant,restoreAll
$ node --check scripts/audit-mutation-harness.mjs                                     exit=0
$ node --check src/mcp/vice/fixtures/harness-signal/plant-contract-driver.mjs         exit=0
```

No fourth export. `revert`, `runGuard`, `measureRow`, `selectRows` and `main` stay private.

### 1g. Two single-row re-runs against the REAL registry

The round-3 row and round 2's row, both after Task 1, both with the churn discarded:

```
$ node scripts/audit-mutation-harness.mjs --row src/mcp/vice/hop-chain-comments.test.ts --out <gitignored scratch>
  OBSERVED RED  src/mcp/vice/hop-chain-comments.test.ts: guard exit status 1 (control exit status 0)
                command: node --test hop-chain-comments.test.ts
  counts: measured=1 skipped=0 total=1
  registry: .../guard-fates.json
  tree: restored byte-identical to the baseline
exit=0

$ node scripts/audit-mutation-harness.mjs --row scripts/lib/skill-honesty-checks.mjs --out <gitignored scratch>
  OBSERVED RED  scripts/lib/skill-honesty-checks.mjs: guard exit status 1 (control exit status 0)
                command: node scripts/check-skill-fork-honesty.mjs
  counts: measured=1 skipped=0 total=1
  registry: .../guard-fates.json
  tree: restored byte-identical to the baseline
exit=0

$ git checkout -- .planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json
$ git diff --stat -- .planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json
                (no output — discarded)
```

**Round 3 did not fix its case by breaking round 2's.** Note also that both lines read
`registry: <path>` rather than `registry: NOT written (...)` — the write-back was already
reachable for a single-row selection once the arithmetic was corrected.

---

## 2. Task 2 — the two hardenings in the same function

### 2a. `CR-11`, the silent truncation — THE BEFORE-STATE

Run against the harness as Task 1 left it. This is the concrete demonstration that the finding
was real rather than theoretical, recorded even though the verifier dispositioned it **latent**:

```
$ node src/mcp/vice/fixtures/harness-signal/plant-contract-driver.mjs <scratch> non-latin1-refused
{"case":"non-latin1-refused","planted":true,"refusalMessage":null,"targetByteIdentical":false,
 "lengthBefore":110,"lengthAfter":110,"lengthDelta":0,"expectedDelta":0,"matchIndex":56,
 "replacementVerbatimAtMatchIndex":false,
 "bytesAtMatchIndexBase64":"SEFSTkVTU19QTEFOVF9DT05UUkFDVF9FFFRBSUw=",
 "recordedReplacementBase64":"SEFSTkVTU19QTEFOVF9DT05UUkFDVF9FFFRBSUw=",
 "pendingRestoreCount":1}
```

`planted: true` with `replacementVerbatimAtMatchIndex: false`. The descriptor's replacement is
`HARNESS_PLANT_CONTRACT_E—TAIL`, carrying **U+2014 EM DASH**; the bytes that reached disk decode
as `HARNESS_PLANT_CONTRACT_E` + `0x14` + `TAIL`. The plant SUCCEEDED and wrote bytes the
descriptor does not record — **and said nothing**. That is `CR-11`.

The same run as a test case:

```
not ok 14 - plant contract / non-latin1-refused: a descriptor that is not latin1-representable is refused BY NAME rather than truncated in silence
error: |-
  the plant SUCCEEDED. The write path truncates every code point above U+00FF while the
  post-condition counts the untruncated string, so this plant put bytes on disk that are NOT
  the bytes the descriptor records -- and said nothing. That is CR-11.
```

### 2b. `CR-11` — THE AFTER-STATE

```
$ node src/mcp/vice/fixtures/harness-signal/plant-contract-driver.mjs <scratch> non-latin1-refused
{"case":"non-latin1-refused","planted":false,
 "refusalMessage":"row fixtures/harness-signal/plant-contract-driver.mjs: plant descriptor
   field `replace` is NOT latin1-representable -- code point U+2014 at index 24. The mutated
   text is written through a latin1 buffer, which would TRUNCATE it, while the post-condition
   below compares the untruncated string -- so the bytes on disk would differ from the bytes
   this row records and NOTHING would say so. Refused before any path resolution and before any
   read or write (CR-11).",
 "targetByteIdentical":true,"pendingRestoreCount":0}
```

The refusal names the **field**, the **code point** and its **index**; nothing was written; the
target is byte-identical; the pending count is 0.

**Where the check sits, and why that matters.** It runs immediately AFTER the loop requiring each
of `file`, `find` and `replace` to be a non-empty string, and BEFORE the containment call, the
`readFileSync`, the occurrence check, the substitution, the post-condition and the write. So a
descriptor that cannot be written faithfully is refused before any path is resolved and before
any byte is read or written. Verified by reading the function; the surrounding order is named
here so a later reader can check it without re-deriving it.

**Measured basis, and it must move nothing.** 35 committed plant descriptors, 0 carrying any code
point above U+00FF. §3 below is where that claim stops being an assertion.

**Not widened beyond what was measured.** No normalisation step, no transcoding fallback, no
warning-only mode, no per-row opt-out.

### 2c. `WR-34`, the misattributed refusal — BOTH STATES

**BEFORE** — refused, but in the vocabulary of a command-line flag the operator never passed:

```
$ node src/mcp/vice/fixtures/harness-signal/plant-contract-driver.mjs <scratch> bad-plant-target-attribution
{"case":"bad-plant-target-attribution","planted":false,
 "refusalMessage":"--root \"<root>/plant-contract-escape-target.txt\" resolves to
   <root>/plant-contract-escape-target.txt, which is OUTSIDE the repository root
   <root>/.harness-signal-scratch-t2a. Refusing: this flag decides which tree the audit reads
   and writes, so it is contained to the repository by construction rather than by convention.
   Note that a sibling directory whose name merely shares the root's prefix (e.g. a `-evil`
   suffix) is refused here too -- the comparison is segment-wise.",
 "targetByteIdentical":true,"pendingRestoreCount":0}
```

**AFTER** — same refusal, attributed to the registry, with the containment message carried
verbatim as the cause:

```
{"case":"bad-plant-target-attribution","planted":false,
 "refusalMessage":"row fixtures/harness-signal/plant-contract-driver.mjs: this row's
   `plant.file` field names a path (\"../plant-contract-escape-target.txt\") that is outside the
   tree this run was pointed at. The path came from the REGISTRY, not from a `--root` argument,
   so the row is what needs correcting. Containment refusal, verbatim: --root
   \"<root>/plant-contract-escape-target.txt\" resolves to
   <root>/plant-contract-escape-target.txt, which is OUTSIDE the repository root
   <root>/.harness-signal-scratch-t2b. Refusing: this flag decides which tree the audit reads
   and writes, so it is contained to the repository by construction rather than by convention.
   Note that a sibling directory whose name merely shares the root's prefix (e.g. a `-evil`
   suffix) is refused here too -- the comparison is segment-wise. (WR-34)",
 "targetByteIdentical":true,"pendingRestoreCount":0}
```

**`planted: false` in BOTH states.** That is the assertion that matters: containment behaviour is
identical, the same resolver is called with the same arguments and reaches the same decision, and
the test asserts the refusal happens in both — so a message improvement cannot be mistaken for,
or quietly become, a relaxation. The test's `planted === false` assertion carries that in words:
*"CONTAINMENT WAS RELAXED … This assertion is the one that must never change."*

### 2d. The formal RED and GREEN for Task 2

```
RED   (harness as Task 1 left it):  exit=1   # tests 15   # pass 13   # fail 2
                                    not ok 14 - non-latin1-refused
                                    not ok 15 - bad-plant-target-attribution
GREEN (both changes applied):       exit=0   # tests 15   # pass 15   # fail 0   # duration_ms 2521.554908
```

The 13 pre-existing cases stayed green in the red run.

### 2e. Task 2 source census, and no live row moved

```
$ grep -ac 'latin1' scripts/audit-mutation-harness.mjs                                8   (>= 3)
$ grep -ac 'CR-11'  scripts/audit-mutation-harness.mjs                                2   (>= 1)
$ grep -ac 'WR-34'  scripts/audit-mutation-harness.mjs                                2   (>= 1)
$ node -e 'import(...).then(m=>Object.keys(m).sort().join(","))'   pendingRestoreCount,plant,restoreAll
$ node --check scripts/audit-mutation-harness.mjs                                     exit=0
$ node --check src/mcp/vice/fixtures/harness-signal/plant-contract-driver.mjs         exit=0
```

Both single-row re-runs repeated after Task 2 — `src/mcp/vice/hop-chain-comments.test.ts` and
`scripts/lib/skill-honesty-checks.mjs` — both `OBSERVED RED`, exit 0, `tree: restored
byte-identical to the baseline`, churn discarded with a path-scoped `git checkout --` and
`git diff --stat` empty afterwards. `npm run typecheck` exit 0; `node scripts/check-guard-fates.mjs`
exit 0.

---

## 3. Task 3 — the whole set

### 3a. Pre-flight readings, taken BEFORE the sweep

Taken freshly, not imported from the planner's measurement: an unmeasurable row is otherwise
unattributable.

```
$ git rev-parse HEAD
77b7323a134bd29972eda901d300e77cd1a9c6cf

$ systemctl --user is-active vice-broker
inactive                                          exit=4

$ ps -eo pid,args | grep -i vice-broker | grep -v grep
                (no output)                       exit=1

$ git rev-parse --show-toplevel
/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-adc279c1ee3498cde

$ git status --porcelain            <- the baseline every row is compared to
 M scripts/audit-mutation-harness.mjs

$ node scripts/audit-gate.mjs
audit-gate: OK -- 9 docs guards green, 7 milestone audits scanned, 5 declaring a gated status
exit=0
```

**The standalone gate matters more than it looks.** `scripts/audit-gate.mjs` is the UNPLANTED
control for one of the 35 rows. In the round-3 verifier's own sweep it exited 1 because a docs
guard was transiently red, which made that row come back `UNMEASURABLE` for a reason that had
nothing to do with the plant. It is green here, so that row is interpretable.

**The one porcelain line is this plan's own uncommitted Task-3 comment**, not stray churn. The
harness compares every row against the baseline it captured at its own start, so a tracked file
already modified at that moment is carried in the baseline and does not affect the comparison.

### 3b. The sweep

```
$ node scripts/audit-mutation-harness.mjs --all --out <a fresh gitignored scratch path outside the phase's evidence tree>
```

Run unbounded in the background rather than under a short shell timeout: 35 measured rows, each
spawning an unplanted control and a planted run, each bounded by the harness's own 15-second
per-run ceiling. **Exit status 0.** Empty stderr.

Its **raw, unedited stdout** follows between the two sentinel lines the plan's automated check
keys on. Nothing else is inside that region — no commentary, no elision, no re-ordering. The
check counts **inside that region and nowhere else**, deliberately: the prose in this file
legitimately discusses a refused plant and an unmeasurable row as gap 1's own history, and a
file-wide count would be invalidated by this document's own narrative.

```text
SWEEP-TRANSCRIPT-BEGIN
audit-mutation-harness: selected 61 row(s)
  OBSERVED RED  src/mcp/vice/r2000-verb-coverage.test.ts: guard exit status 1 (control exit status 0)
                command: node --test anno-verb-coverage.test.ts
  OBSERVED RED  scripts/lib/r2000-cli-verbs.mjs: guard exit status 1 (control exit status 0)
                command: node scripts/check-skill-tool-coverage.mjs
  OBSERVED RED  scripts/lib/r2000-cli-verbs.d.mts: guard exit status 1 (control exit status 0)
                command: node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
  OBSERVED RED  src/mcp/vice/docs-r2000-decisions.test.ts: guard exit status 1 (control exit status 0)
                command: node --test docs-absorbed-decisions.test.ts
  OBSERVED RED  src/mcp/vice/r2000-answer-key.test.ts: guard exit status 1 (control exit status 0)
                command: node --test absorbed-answer-key.test.ts
  OBSERVED RED  src/mcp/vice/r2000-spawn-seam.test.ts: guard exit status 1 (control exit status 0)
                command: node --test spawn-seam.test.ts
  OBSERVED RED  src/mcp/vice/r2000-cli.test.ts: guard exit status 1 (control exit status 0)
                command: node --test --test-name-pattern VERB_OPTIONS carries exactly the surviving verbs anno-cli.test.ts
  OBSERVED RED  src/mcp/vice/r2000-confidence.test.ts: guard exit status 1 (control exit status 0)
                command: node --test anno-confidence.test.ts
  OBSERVED RED  src/mcp/vice/r2000-coverage-grammar.test.ts: guard exit status 1 (control exit status 0)
                command: node --test anno-coverage-grammar.test.ts
  OBSERVED RED  src/mcp/vice/r2000-coverage.test.ts: guard exit status 1 (control exit status 0)
                command: node --test anno-coverage.test.ts
  OBSERVED RED  src/mcp/vice/r2000-d64.test.ts: guard exit status 1 (control exit status 0)
                command: node --test anno-d64.test.ts
  OBSERVED RED  src/mcp/vice/r2000-enum-gen.test.ts: guard exit status 1 (control exit status 0)
                command: node --test anno-enum-gen.test.ts
  OBSERVED RED  src/mcp/vice/r2000-memmap-render.test.ts: guard exit status 1 (control exit status 0)
                command: node --test anno-memmap-render.test.ts
  OBSERVED RED  src/mcp/vice/r2000-regbits.test.ts: guard exit status 1 (control exit status 0)
                command: node --test anno-regbits.test.ts
  OBSERVED RED  src/mcp/vice/r2000-tools.test.ts: guard exit status 1 (control exit status 0)
                command: node --test anno-tools.test.ts
  OBSERVED RED  scripts/audit-gate.mjs: guard exit status 1 (control exit status 0)
                command: node scripts/audit-gate.mjs
  OBSERVED RED  scripts/check-npm-packages.mjs: guard exit status 1 (control exit status 0)
                command: node scripts/check-npm-packages.mjs
  OBSERVED RED  scripts/check-skill-fork-honesty.mjs: guard exit status 1 (control exit status 0)
                command: node scripts/check-skill-fork-honesty.mjs
  OBSERVED RED  scripts/check-skill-tool-coverage.mjs: guard exit status 1 (control exit status 0)
                command: node scripts/check-skill-tool-coverage.mjs
  OBSERVED RED  scripts/generate-tool-support-table.mjs: guard exit status 1 (control exit status 0)
                command: node --test --test-name-pattern byte-identical to committed tool-support-table.test.mjs
  OBSERVED RED  scripts/lib/skill-corpus.d.mts: guard exit status 1 (control exit status 0)
                command: node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
  OBSERVED RED  scripts/lib/skill-descriptions.d.mts: guard exit status 1 (control exit status 0)
                command: node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
  SKIPPED       scripts/lib/skill-descriptions.mjs: verdict kept-unchanged -- owes no observed-red evidence (D-05)
  OBSERVED RED  scripts/lib/skill-honesty-checks.mjs: guard exit status 1 (control exit status 0)
                command: node scripts/check-skill-fork-honesty.mjs
  OBSERVED RED  src/mcp/vice/audit-integrity.test.ts: guard exit status 1 (control exit status 0)
                command: node --test --test-name-pattern registry-drift detector audit-integrity.test.ts
  OBSERVED RED  src/mcp/vice/capability-registry.test.ts: guard exit status 1 (control exit status 0)
                command: node --test capability-registry.test.ts
  OBSERVED RED  src/mcp/vice/disasm-roundtrip.test.ts: guard exit status 1 (control exit status 0)
                command: node --test disasm-roundtrip.test.ts
  OBSERVED RED  src/mcp/vice/docs-dangling-refs.test.ts: guard exit status 1 (control exit status 0)
                command: node --test docs-dangling-refs.test.ts
  OBSERVED RED  src/mcp/vice/hop-chain-comments.test.ts: guard exit status 1 (control exit status 0)
                command: node --test hop-chain-comments.test.ts
  OBSERVED RED  src/mcp/vice/hostpath-consumers.test.ts: guard exit status 1 (control exit status 0)
                command: node --test hostpath-consumers.test.ts
  OBSERVED RED  src/mcp/vice/skill-acme-build-cli.test.ts: guard exit status 1 (control exit status 0)
                command: node --test skill-acme-build-cli.test.ts
  SKIPPED       src/mcp/vice/skill-attribution.test.ts: verdict kept-unchanged -- owes no observed-red evidence (D-05)
  SKIPPED       src/mcp/vice/stock-connect.test.ts: verdict kept-unchanged -- owes no observed-red evidence (D-05)
  OBSERVED RED  src/mcp/vice/stock-dispatch.test.ts: guard exit status 1 (control exit status 0)
                command: node --test stock-dispatch.test.ts
  OBSERVED RED  src/mcp/vice/tool-support-table.test.mjs: guard exit status 1 (control exit status 0)
                command: node --test --test-name-pattern derived-union equality tool-support-table.test.mjs
  OBSERVED RED  src/mcp/vice/vice-proxy.test.ts: guard exit status 1 (control exit status 0)
                command: node --test --test-name-pattern tools/list survives a missing or corrupt snapshot vice-proxy.test.ts
  SKIPPED       src/mcp/vice/r2000-launch.test.ts: verdict deleted -- owes no observed-red evidence (D-05)
  SKIPPED       src/mcp/vice/r2000-mcp-client.test.ts: verdict deleted -- owes no observed-red evidence (D-05)
  SKIPPED       src/mcp/vice/r2000-project.test.ts: verdict deleted -- owes no observed-red evidence (D-05)
  SKIPPED       src/mcp/vice/r2000-session.test.ts: verdict deleted -- owes no observed-red evidence (D-05)
  SKIPPED       src/mcp/vice/r2000-symbol-roundtrip.test.ts: verdict deleted -- owes no observed-red evidence (D-05)
  SKIPPED       src/mcp/vice/r2000-upstream-audit.test.ts: verdict deleted -- owes no observed-red evidence (D-05)
  SKIPPED       src/mcp/vice/r2000-verify.test.ts: verdict deleted -- owes no observed-red evidence (D-05)
  SKIPPED       scripts/check-no-regenerator2000.d.mts: verdict kept-unchanged -- owes no observed-red evidence (D-05)
  SKIPPED       scripts/check-no-regenerator2000.mjs: verdict kept-unchanged -- owes no observed-red evidence (D-05)
  SKIPPED       scripts/lib/anno-cli-invocations.mjs: verdict kept-unchanged -- owes no observed-red evidence (D-05)
  SKIPPED       src/mcp/vice/acme-gate.test.ts: verdict kept-unchanged -- owes no observed-red evidence (D-05)
  OBSERVED RED  src/mcp/vice/anno-derivation.test.ts: guard exit status 1 (control exit status 0)
                command: node --test anno-derivation.test.ts
  SKIPPED       src/mcp/vice/anno-index.test.ts: verdict kept-unchanged -- owes no observed-red evidence (D-05)
  SKIPPED       src/mcp/vice/anno-seam.test.ts: verdict kept-unchanged -- owes no observed-red evidence (D-05)
  SKIPPED       src/mcp/vice/anno-store.test.ts: verdict kept-unchanged -- owes no observed-red evidence (D-05)
  SKIPPED       src/mcp/vice/anno-types.test.ts: verdict kept-unchanged -- owes no observed-red evidence (D-05)
  SKIPPED       src/mcp/vice/block-class.test.ts: verdict kept-unchanged -- owes no observed-red evidence (D-05)
  SKIPPED       src/mcp/vice/fixtures/planted-removal-fixture.md.txt: verdict kept-unchanged -- owes no observed-red evidence (D-05)
  SKIPPED       src/mcp/vice/fixtures/planted-removal-fixture.ts.txt: verdict kept-unchanged -- owes no observed-red evidence (D-05)
  OBSERVED RED  src/mcp/vice/module-classification.test.ts: guard exit status 1 (control exit status 0)
                command: node --test module-classification.test.ts
  SKIPPED       src/mcp/vice/prg-image.test.ts: verdict kept-unchanged -- owes no observed-red evidence (D-05)
  SKIPPED       src/mcp/vice/removal-gate.test.ts: verdict kept-unchanged -- owes no observed-red evidence (D-05)
  SKIPPED       src/mcp/vice/shipped-modules.test.ts: verdict kept-unchanged -- owes no observed-red evidence (D-05)
  SKIPPED       src/mcp/vice/block-class.ts: verdict kept-unchanged -- owes no observed-red evidence (D-05)
  SKIPPED       src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs: verdict kept-unchanged -- owes no observed-red evidence (D-05)
  counts: measured=35 skipped=26 total=61
  evidence: /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-adc279c1ee3498cde/.harness-signal-scratch-sweep/32-21-all.md
  registry: /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-adc279c1ee3498cde/.planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json
  tree: restored byte-identical to the baseline
SWEEP-TRANSCRIPT-END
```

**What that transcript establishes, machine-checkable inside the region:**

| Assertion | Required | Measured |
|---|---|---|
| `counts: measured=35 skipped=26 total=61` lines | exactly 1 | **1** |
| `OBSERVED RED` lines | exactly 35 | **35** |
| `SKIPPED` lines | exactly 26 | **26** |
| `tree: restored byte-identical to the baseline` lines | exactly 1 | **1** |
| `registry: NOT written` lines | exactly 0 | **0** |
| `PLANT REFUSED` lines | exactly 0 | **0** |
| `UNMEASURABLE` lines | exactly 0 | **0** |

The 26 evidence-owing-nothing rows are reported `SKIPPED` **in their own registry positions**,
each naming its verdict (`kept-unchanged` or `deleted`) and `D-05`, rather than being filtered
out of the report — an omitted row and a row that owes nothing are different facts.

The row this whole round is about appears in that transcript as:

```
  OBSERVED RED  src/mcp/vice/hop-chain-comments.test.ts: guard exit status 1 (control exit status 0)
                command: node --test hop-chain-comments.test.ts
```

**And the last summary line reads `registry: <path>`, not `registry: NOT written (...)`.** The
write-back was reached.

### 3c. The registry write-back — the diff SHAPE, recorded while it was still on disk

Measured immediately after the sweep, by comparing the on-disk registry against `HEAD` field by
field rather than by reading the hunks:

```
$ git diff --numstat -- .planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json
56      56      .planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json

$ <field-level comparison against HEAD>
{
  "rowCountBefore": 61,
  "rowCountAfter": 61,
  "rowOrderUnchanged": true,
  "added": [],
  "removed": [],
  "recordedRedBlocksRefreshed": 30,
  "evidenceOwingNothingRows": 26,
  "evidenceOwingNothingRowsTouched": 0
}
```

Every one of the 30 rows whose JSON changed carries verdict `re-pointed`; the list includes
`src/mcp/vice/hop-chain-comments.test.ts`, which is the row that could not be measured at all
before this plan.

**An honest note on 30 versus 35.** The sweep rewrites `observedRed` for **all 35** measured
rows — the assignment is unconditional for a row that produced one. Only **30** of the results
DIFFER byte-wise from what was committed; the other 5 came back byte-identical (same excerpt,
same exit statuses). "35 blocks refreshed / 30 blocks changed" is the accurate statement, and
this file records the measured 30 rather than the round number the plan anticipated.

**File-level shape, restated plainly:** the file changed; the row COUNT is still 61; the row
ORDER is unchanged; no row was added and none removed; and the 26 evidence-owing-nothing rows are
untouched.

### 3d. The discard, under `D-08`

```
$ git checkout -- .planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json
$ git diff --quiet -- .planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json
exit=0
$ rm -rf <the scratch output path>
```

`git diff --quiet` exiting 0 is the machine-checked form of *no dated row was replaced by this
plan*.

**Why the churn is discarded, and why that does not undo the proof.** The criterion asked for is
that the write-back is REACHED and the registry WRITTEN, and that is satisfied by the write
having happened and having been observed on disk — the shape above is the durable artefact.
Keeping the content would replace all 35 committed recorded-red blocks, which are DATED RECORDS
of measurements taken during the sweep plans, with fresh excerpts and durations, to no end.
Plan 32-15 set this precedent and `D-08` is the rule. **The discard is a separate recorded
decision; it does not undo the proof.** If a later reader wants the fresh evidence committed,
that is a deliberate act with its own reasoning, not a side effect of a verification run.

### 3e. The write-back decision, recorded at the site

Written as a dated 2026-09-01 comment block in `scripts/audit-mutation-harness.mjs`, beside the
hard-failure assignment (a short cross-reference) and the suppression-cause enumeration (the full
block). **THE DECISION: a refused plant BLOCKS the whole-set registry write-back, and the
refused-plant flag is NOT separated from the failed flag.** Its four grounds:

1. **The basis.** This instrument's entire product is non-vacuity evidence. A PARTIAL write-back
   would produce a registry mixing freshly-measured evidence for some rows with committed
   evidence for others, with nothing in the file recording which is which — so a reader could not
   tell a re-measured row from a stale one. That is the laundering this phase exists against, and
   it would be introduced by the instrument whose job is to prevent it.
2. **The precedent.** This repository's gate design carries no relaxation hatches by standing
   decision, and this instrument already applies the same fail-closed rule twice within twenty
   lines: to a selection that matched zero rows, and to a selection every row of which was
   skipped — both on the stated ground that an empty measurement is not a green.
3. **Reachability, proven rather than argued.** The path was never PERMANENTLY unreachable by
   POLICY; it was unreachable because of the arithmetic defect corrected in Task 1. The `--all`
   run in §3b reaches this branch and writes the registry. That run is the proof; the argument is
   not.
4. **The rejected branch, named.** Separating the refused-plant flag from the failed flag — so a
   refusal reports against its own row without suppressing the write-back for the others — was
   considered and is **REJECTED on ground 1, not on effort.** The suppression-cause enumeration
   stays exactly as it is, with the refusal remaining a **separately named cause**, so a
   suppressed write-back always tells the operator which of the four fired.

**Reversibility: reversible.** The rejected branch is a two-line change at the same site. No
on-disk format changes, no published contract breaks, no migration — the registry's own bytes are
unaffected by the choice. Recorded at the site rather than only in a SUMMARY so a later reader
finds the reasoning where the code is.

The four enumerated suppression causes are **unchanged**: every selected row was skipped; a row's
plant was refused; a row was unmeasurable; a row's guard exited 0 with the violation planted.

---

## 4. The removal gate's EMPTY terminal state

```
$ node scripts/check-no-regenerator2000.mjs
check-no-<subject>: OK -- scanned 412 files (382 tracked outside ".planning/" + 30
  shipped-but-untracked installer paths, floor 350); 157 occurrence(s) permanently exempt,
  0 temporarily allow-listed across 0 entries.
  temporary allow-list by discharging plan (opened 2026-08-29; asserted EMPTY since 2026-08-30,
  plan 29-11):
                (nothing follows — the list is EMPTY)
exit=0
```

**157 permanent exemptions and a temporary allow-list that is EMPTY — 0 occurrences across 0
entries.** An empty allow-list is what a completed cutover looks like; a gate that would pass
equally with entries in it has not been checked, which is why the emptiness is recorded here as a
figure in its own right rather than left implicit behind the exit status.

**Before and after this plan's changes: identical, and derived rather than guessed.** The first
attempt at a genuine "before" reading — parking this plan's three files and re-running — was
INVALID and is recorded as such rather than quietly dropped: the new driver is tracked at `HEAD`,
so removing it from the worktree made the gate fail with *"is in the scope set but is not on disk
-- the walk or the pack list is stale"* and a non-vacuity error, which measures the experiment
rather than the tree. The files were restored (`git restore --staged` on the two tracked paths,
index only, working tree untouched) and the gate returned to exit 0. The before-state is
therefore established by a derivation instead:

```
$ git diff 01894b9 -- . > plan-diff.txt          (933 lines: this plan's whole change against its base)
$ grep -aci 'regenerator2000' plan-diff.txt
0
```

This plan's entire diff introduces **zero** occurrences of the gate's subject, and none of its
three files appears in any of the twelve exact-pin exemption groups — so the 412/157/0/0 figures
are unchanged by construction. **This round adds no entry to the temporary allow-list.**

---

## 5. Ledger entry 35 — closed on the measurement that discharges it

```
$ node .claude/gsd-core/bin/gsd-tools.cjs windows fixed 35
$ <the plan's own ledger checker, reading through the tool rather than off the file>
LEDGER OK {"open":20,"fixed":8,"total":40,"entry35":"fixed","reason35Len":1263}
```

**Arithmetic reconciled:** one closure against plan 32-20's 21-open / 7-fixed / 40-total ledger
gives **20 open, 8 fixed, 40 total**. Entry ids are strictly ascending, proving no row was
reordered or renumbered.

Field-level comparison against `HEAD`, which is stronger than reading the hunks:

```
rows before=40 after=40
changed rows: [{"id":35,"fields":["status","reason","resolved_at"]}]
order unchanged: true
```

**Exactly one status transition (`open → fixed` on entry 35), and no other row changed at all.**
`git diff -- .planning/WINDOWS.md` is 6 insertions / 6 deletions across three hunks: the three
frontmatter counters plus `last_updated`, entry 35's markdown row, and entry 35's JSON
`status` / `resolved_at`.

**NO NEW ENTRY IS OPENED BY THIS PLAN.** Entry 33's successor (entry 40) was appended and closed
by plan 32-20, and this round's remaining defect is the one entry 35 already describes.

**The `reason` was hand-written into both representations**, and that is a tooling workaround
rather than a liberty: `gsd-tools windows fixed <id>` sets `status` and `resolved_at` but leaves
`reason` empty and takes no reason argument, while this closure owes a citation. A script wrote
`reason` for row 35 — **and only row 35** — into the markdown table and the JSON block, refusing
to run unless that row was already `fixed` with an empty reason and asserting it made exactly one
edit in each representation. The same workaround, for the same cause, is recorded in plan 32-20's
SUMMARY.

The citation itself names the sweep line that discharges the entry, the write-back shape, the
cause that was removed, and the standing `overlap-accepted` case that pins it.

---

## 6. Gates and suite figures — every one beside its broker state and checkout root

All taken in the worktree `/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-adc279c1ee3498cde`
with the broker **inactive**.

| Command | Result |
|---|---|
| `node scripts/check-no-regenerator2000.mjs` | exit 0 — 412 files, 157 permanent exemptions, temporary allow-list EMPTY |
| `node scripts/check-guard-fates.mjs` | exit 0 — `setA=43 setB=16 setC=2 total=61 rows=61 (floors setA=43 setB=16 setC=2 total=61)` |
| `node scripts/audit-gate.mjs` | exit 0 — `9 docs guards green, 7 milestone audits scanned, 5 declaring a gated status` |
| `cd src/mcp/vice && npm run typecheck` | exit 0 — `tsc --noEmit -p tsconfig.json`, no diagnostics |
| `cd src/mcp/vice && node --test audit-harness-restore.test.ts` | exit 0 — 15 tests, 15 pass, 0 fail |
| `cd src/mcp/vice && npm run test:automated` | exit 1 — 3027 tests, **3020 pass, 1 fail**, 1 skipped, 5 todo, 45090 ms |

### What `test:automated`'s exit code MEANS, rather than the code quoted bare

`npm run test:automated` runs the **automated glob only**, skipping the manual-only list, and it
carries a historical failure baseline of its own. **The 44-, 7- and 5-failure baselines are
SUPERSEDED; the clean floor is ZERO.** So a non-zero failure count is a regression unless it is
attributed, and this one is:

```
not ok 1554 - path agreement (D-3, D-6, THE regression this task exists to catch): the
              launcher's own repo_root (resources/ and tools/ copies) agrees with Node's
              supervisorDir()/dirname(EPOCH_FILE), and the agreed path is not under .claude
  location: '.../src/mcp/vice/repo-root.test.ts:178:1'
  error:    'the agreed directory must not sit under .claude -- got
             <worktree>/.vice-supervisor (the exact regression a naive move would introduce)'
```

That is **broken-windows entry 36**, already on the ledger and already open: the
`!includes('.claude')` substring predicate fails **unconditionally** when the suite runs from a
GSD worktree under `.claude/worktrees/`. It is a property of WHERE this checkout is, not of what
this plan changed, and it is expected ABSENT from the main checkout after the wave merges. It is
recorded, not worked around, and not counted against this plan. **On this plan's own subject the
floor is met: 0 failures attributable to anything this plan touched.**

### The whole-glob `npm test` was NOT run, and that is a statement rather than an omission

It blocks indefinitely on `vice-proxy.test.ts` — **broken-windows entry 26**, previously measured
still running when killed at 300106 ms and `exit=124` under a 180 s bound. `npm run
test:automated` is the terminating gate and is the figure recorded above.

### One provisioning step, recorded

`npm ci --no-audit --no-fund` was run in `src/mcp/vice` because a fresh worktree carries no
`node_modules` and `npm run typecheck` / `npm run test:automated` cannot run without it. That is
the project's own provisioning step (`scripts/ensure-mcp-deps.sh`), from the committed lockfile.
**No package was added and no manifest or lockfile changed** — `node_modules/` is gitignored and
`git status --porcelain` was unaffected.

---

## 7. The deferral register — every remaining finding named, not dropped

**The scope line, stated once and applied uniformly: a hardening is TAKEN when it lands in a
function this round already edits, and DEFERRED when it does not.** `CR-11` and `WR-34` were
taken on exactly that rule — both sit inside the plant function gap 1 rewrote. Everything below
does not.

**NO DISPOSITION IS RE-OPENED.** Nothing here is re-litigated, and no code change was made on the
strength of a disagreement with one.

| Id | What it is | Why it is not in this round's scope |
|---|---|---|
| `WR-30` | The removal-gate scratch entry in `.gitignore` is justified by a porcelain assertion the same round narrowed; the entry is still correct and still needed, and only its stated reason drifted. | `.gitignore` is not edited by this round. |
| `WR-31` | A docblock in `src/mcp/vice/audit-root-args.test.ts` claims the population predicate catches a root-accepting script however it reads its root, while the predicate keys on the literal flag token. The guard is fixed and proven to bite; the sentence over-reaches. | That file is not edited by this round. |
| `WR-32` | `scripts/audit-gate.mjs` records that it never writes as the basis for being on the argv seam but not the containment resolver; it does spawn guard suites, so an uncontained root is executed rather than merely read. The decision is defensible and the recorded basis is incomplete. | That file is not edited by this round. |
| `WR-33` | A predicate-precision note with no live evasion. | Dispositioned **ACCEPTED** by the round-3 verifier. |
| `WR-35` | An allow-list hardening on a registry that is a committed, CI-gated artefact. | Dispositioned **ACCEPTED**. |
| `IN-11` | Cosmetic. | Dispositioned **ACCEPTED**, measured green today. |
| `IN-12` | Verbose. | Dispositioned **ACCEPTED**, measured green today. |
| `IN-13` | A stale forward reference. | Dispositioned **ACCEPTED**, measured green today. |
| `IN-14` | An ordering dependence in the attempt-log test. | Dispositioned **ACCEPTED**, measured green today. Honoured rather than disturbed: this round's case group records nothing into the attempt log, so the five-per-signal expectation is untouched. |
| `IN-15` | `scripts/audit-gate.mjs` accepts a repeated boolean flag silently at exit 0 while a repeated value flag is a named hard error — an asymmetry in the strict parser with no behavioural consequence today. | That file is not edited by this round. |

**Ledger entries left open, named so that their staying open reads as a decision rather than an
oversight:** `28`, `29`, `30`, `31`, `32`, `34`, `36`, `37`, `38`, `39`. This plan's scope is
entry **35** only.

**One observation, recorded WITHOUT acting on it.** Entry **38**'s stated content — a
completeness assertion red by design pending plan 32-18 — appears **DISCHARGED** by the round-3
verifier's own measurement of that guard at 62 tests, 62 passing, proven to bite on a planted
ninth root-accepting script. It is **recommended for a ledger sweep outside this round** rather
than closed here, because closing an entry this plan did not measure would be exactly the
shortcut this phase exists against.

**Dissents: none.** Every disposition above is accepted as the verifier recorded it.

---

## 8. What this file does NOT claim

- It does not claim the sweep proves the absence of a flake. One green whole-set run is one
  green whole-set run.
- It does not claim `test:automated` reached a zero-failure floor **in this worktree**. It did
  not, for a ledgered reason that is a property of the checkout location, and that is said in
  words in §6 rather than smoothed over.
- It does not claim the registry now carries fresh evidence. It carries its committed, dated
  evidence; what was proved is that the write-back path is REACHABLE and was REACHED, and the
  content was then discarded under `D-08` as a separate recorded decision.
- It does not claim the corrected post-condition is independently falsifiable on every run. It
  holds by construction while the substitution goes through a replacer function — that is the
  point, and §1d is where the assumption was converted into an observation.

---

*Phase: 32-the-deletion-and-the-grep-gate*
*Plan: 32-21*
*Written: 2026-09-01*
