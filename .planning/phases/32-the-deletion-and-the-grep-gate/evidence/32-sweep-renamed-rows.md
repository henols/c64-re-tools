<!-- gsd:precondition-header -->
# Phase 32 plan 06 — the renamed-member sweep: asserted preconditions

Everything below the `---` is written by `scripts/audit-mutation-harness.mjs`
and is a captured `spawnSync` result, never a transcription. This header
carries the facts the harness does not capture: the broker state `D-13`
requires be ASSERTED and RECORDED, and the derivation correction this plan
had to make before it could measure anything.

## Broker state (read-only assertion — the unit was NOT stopped)

`D-13` makes broker-down an asserted, recorded precondition. A live broker
reddens the BACK-05 D-G ordering test deterministically, which would make an
observed red ambiguous. The broker runs as a systemd user unit on this host;
an audit script that tears down the developer's environment is the wrong
shape, so this is a READ ONLY check. Captured verbatim, immediately before
the sweep:

```
$ systemctl --user is-active vice-broker
inactive
(exit 4)

$ pgrep -af '[v]ice-broker'
(exit 1 -- 1 means no match, i.e. no broker process)

$ git rev-parse HEAD
8d6c442433143690e66ef4e9ee7c3492f03b2271

$ git status --porcelain
?? .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-sweep-renamed-rows.md
(end)
```

The bracketed `[v]ice-broker` pattern is deliberate: a plain
`pgrep -af vice-broker` matches its OWN shell command line and reports exit 0
with one hit, which reads as a live broker. That false positive was observed
on this run before the pattern was bracketed, and it is recorded here because
a future reader re-running the plain form will see the same thing.

## The selector was built from the registry, not retyped

`--rows` was constructed by filtering `guard-fates.json` for
`verdict === "re-pointed"` and joining the `historicalPath` values, so a
mistyped or truncated table cannot silently shrink the sweep. The harness
prints the number of rows it measured (`measured 15 row(s)`) and treats an
entry matching no row as a hard failure naming that entry.

## CORRECTION: the renamed group is FIFTEEN, and this plan owns FOURTEEN of them

`32-06-PLAN.md`'s `<objective>` table enumerates **16** renamed set-A members
and names `src/mcp/vice/anno-derivation.test.ts` -> `anno-derivation.test.ts`
as its row 6. That mapping is **not derivable** and was not used.

The plan instructs, in as many words, to re-derive before trusting the table
and to follow the derivation where the two disagree. Re-derived here against
`check-guard-fates.mjs`'s own exported `deriveAuditedSet()`, reading its
`forwardRenamed` field — the guard's mechanical forward map, which is git's
rename detection first and the name-descendant predicate second:

```
setA 43 setB 16 setC 2
renamed count: 15
--- samePath 21 gone 7
GONE  src/mcp/vice/anno-launch.test.ts
GONE  src/mcp/vice/anno-mcp-client.test.ts
GONE  src/mcp/vice/anno-project.test.ts
GONE  src/mcp/vice/anno-session.test.ts
GONE  src/mcp/vice/anno-symbol-roundtrip.test.ts
GONE  src/mcp/vice/anno-derivation.test.ts
GONE  src/mcp/vice/anno-verify.test.ts
```

21 + 15 + 7 = 43, which reconciles with `SET_A_FLOOR`. `nameDescendantCandidates()`
for `anno-derivation.test.ts` yields `anno-upstream-audit.test.ts`,
`absorbed-upstream-audit.test.ts` and `upstream-audit.test.ts`; none exists at
`AUDIT_END`, and git's `-M` heuristic does not score it either. Calling it
"renamed" onto `anno-derivation.test.ts` would need exactly the hand-typed map
the guard forbids.

This is not a new finding — it was already measured and recorded in
`evidence/32-audited-set-reconciliation.md` Sec 4.1 ("CORRECTION: 15 renamed /
7 gone, not the plan's 16 / 6"), which also notes that an earlier research
draft said 13 and that neither 13 nor 16 reproduces. The forward-map split is
**descriptive**; no floor depends on it, so nothing was edited to make either
reading win. `anno-derivation.test.ts` enters the registry as `deleted`
or `superseded` in the wave-5 sweep that owns the `gone` members.

Arithmetic for this plan, therefore:

| | count |
|---|---|
| renamed set-A members (derived) | 15 |
| already recorded (the tracer row, plan 32-01) | 1 |
| **new rows this plan adds** | **14** |
| **registry rows after this plan** | **15** |

All 15 are re-measured in the single sweep below, including the tracer's, so
the evidence document is one internally consistent record produced by one run
on one tree. The tracer's previously recorded excerpt cited a worktree
(`agent-adc0e44067665a83e`) that no longer exists; its row now carries a
freshly captured red from this tree.

## Guard-argv deviations, both forced and both recorded

Two rows do not use the plain `node --test <file>` shape. Neither is a
convenience and neither weakens the claim; both are consequences of measured
facts, and this plan modifies no script, so each is routed around rather than
patched.

1. **`scripts/lib/anno-cli-verbs.d.mts`** — the harness's third documented
   argv convention, `["--run", "typecheck"]`, spawns `npm --run typecheck`.
   npm 11 rejects that form. Measured, first attempt:

   ```
   Control command: `npm --run typecheck` (cwd `src/mcp/vice`)
   Control exit status: `1`
   Unknown command: "typecheck"
   Did you mean this?
     npm run typecheck # run the "typecheck" package script
   ```

   The UNPLANTED control did not exit 0, so the row came back **UNMEASURABLE**
   rather than red — the green-control rule doing precisely its job, refusing
   to let a broken invocation be banked as evidence. Re-pointed at the same
   compiler through the harness's node-argv convention:
   `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`, which is
   what `package.json`'s `typecheck` script runs. This is a **FINDING against
   `scripts/audit-mutation-harness.mjs`** (plan 32-01): of its three documented
   conventions, `--run` is the only one that had never been exercised, and it
   does not work as written.

2. **`src/mcp/vice/anno-cli.test.ts`** — the full
   `node --test anno-cli.test.ts` takes **20596ms** measured, against the
   harness's `GUARD_RUN_TIMEOUT_MS` of 15000ms. A timeout is mapped to status
   1, so an unscoped run would have timed out on BOTH legs: the green control
   would have failed (row UNMEASURABLE) and, had the control somehow passed,
   a timeout would have been banked as a red that proved nothing about the
   plant. Scoped with `--test-name-pattern` to the one assertion the plant
   targets, the run takes **2675ms**. The command still names the row's
   `newSubject` and still runs that guard's own assertion.

Per-file control timings measured before the sweep, for the record:

```
docs-absorbed-decisions.test.ts   exit=0    280ms
absorbed-answer-key.test.ts       exit=0    300ms
spawn-seam.test.ts                exit=0    841ms
anno-cli.test.ts                  exit=0  20596ms   <-- over the 15000ms bound
anno-confidence.test.ts           exit=0    268ms
anno-coverage-grammar.test.ts     exit=0   1314ms
anno-coverage.test.ts             exit=0   1654ms
anno-d64.test.ts                  exit=0    382ms
anno-enum-gen.test.ts             exit=0    405ms
anno-memmap-render.test.ts        exit=0   1353ms
anno-regbits.test.ts              exit=0    329ms
anno-tools.test.ts                exit=0    650ms
anno-verb-coverage.test.ts        exit=0    624ms
npm run typecheck                 exit=0   2034ms
```

## No synthetic `--root` tree was used, and none could have been

The plan's task-1 action contemplates `plant.kind: "root"` with a synthetic
fixture tree. **Every plant here is `kind: "worktree"`**, for a reason that is
mechanical rather than stylistic: `audit-mutation-harness.mjs`'s `plant()`
implements only the `worktree` kind and throws on anything else —
"a synthetic-fixture route lands with the sweep plans that need it". This
plan needed none, so none was built.

That also sidesteps the defect `evidence/32-root-override-inventory.md` Sec 6.1
records: `mktemp -d` cannot serve as a `--root`, because `resolveContainedRoot()`
refuses any root outside the repository, and a refused `--root` leaves the tree
untouched, so a "table unchanged" assertion would pass **vacuously**. No
`mktemp -d` appears anywhere in this plan's execution, and no scratch tree was
created inside the repository either — the harness mutates the real subject in
place and restores it, which is the whole point of the capture-before-write
contract.

## NUL-taint disclosure

`src/mcp/vice/anno-memmap-render.ts` carries a NUL byte at offset 15097
(line 315), and it IS this sweep's plant target for the
`anno-memmap-render.test.ts` row. That is byte-safe as a property of the
harness, not of the choice: `plant()` captures the original with
`readFileSync(abs)` and **no encoding**, performs the find/replace over a
`latin1` round-trip (byte-preserving for every code unit, NUL included), and
`revert()` writes the captured Buffer back verbatim. Checked mechanically
after the run:

```
$ git diff --exit-code --stat -- src/mcp/vice/anno-memmap-render.ts
(no output, exit 0)
```

Note for anyone re-deriving counts over that file: a plain `grep` silently
skips it because of the NUL. Use `grep -a`.

## What "observed red" means here, and what it does not

Every row below carries BOTH legs:

- a **green false-positive control**, run UNPLANTED, required to exit 0; and
- a **planted run**, required to exit non-zero.

A red with no green control is recorded UNMEASURABLE, never as an observed
red — that is what happened to the `.d.mts` row on its first attempt above.
No row in this sweep needed a second plant: all 15 bit on the first, and none
is recorded as a FINDING of possible vacuity.

Where research (`32-RESEARCH.md` Sec 2.3) notes a member already carries an
in-test non-vacuity assertion, that assertion was used ONLY as a map of where
a reusable plant shape lives. It is **not** the evidence. `D-04` distinguishes
"the guard asserts it can fail" from "the guard was observed failing against
its new subject", and `CUT-04` asks for the second; the raw captured output
below is that second claim and nothing else.

---

# Phase 32 — observed-red evidence (machine-captured)

Written by `scripts/audit-mutation-harness.mjs`. Every field below is a captured `spawnSync` result, not a transcription. Re-run the command in each row's **planted command** line after applying that row's plant to reproduce it.

- **Commit measured:** `8d6c442433143690e66ef4e9ee7c3492f03b2271`
- **Measured at:** 2026-08-31T17:22:33.639Z
- **Root:** `/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0`
- **Rows measured:** 15

## Tree state

`git status --porcelain` BEFORE the run (the baseline every row is compared to):

```
?? .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-sweep-renamed-rows.md
```

`git status --porcelain` AFTER the run:

```
?? .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-sweep-renamed-rows.md
```

**Byte-identical.** Every plant was reverted.

## `src/mcp/vice/anno-verb-coverage.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test anno-verb-coverage.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# Subtest: real-source parse: anno-cli.ts's dispatch switch yields exactly the 3 known verbs, never 'default'
ok 1 - real-source parse: anno-cli.ts's dispatch switch yields exactly the 3 known verbs, never 'default'
  ---
  duration_ms: 16.375333
  type: 'test'
  ...
# Subtest: positive control: every real verb is named by at least one real skill file (the Task 1 property, restated mechanically)
ok 2 - positive control: every real verb is named by at least one real skill file (the Task 1 property, restated mechanically)
  ---
  duration_ms: 16.70315
  type: 'test'
  ...
# Subtest: planted violation: an extra, genuinely new case is parsed and reported missing, while a real, documented verb is not
ok 3 - planted violation: an extra, genuinely new case is parsed and reported missing, while a real, documented verb is not
  ---
  duration_ms: 5.007724
  type: 'test'
  ...
# Subtest: comment hygiene: a case hidden in a block comment or a line comment is never parsed as a verb
ok 4 - comment hygiene: a case hidden in a block comment or a line comment is never parsed as a verb
  ---
  duration_ms: 0.507813
  type: 'test'
  ...
# Subtest: non-vacuity floor: ANNO_CLI_VERB_FLOOR matches the measured true count and the real parse meets it
ok 5 - non-vacuity floor: ANNO_CLI_VERB_FLOOR matches the measured true count and the real parse meets it
  ---
  duration_ms: 3.238227
  type: 'test'
  ...
# Subtest: the CI script's live execution path: `node scripts/check-skill-tool-coverage.mjs` exits 0 with 'OK' in stdout
ok 6 - the CI script's live execution path: `node scripts/check-skill-tool-coverage.mjs` exits 0 with 'OK' in stdout
  ---
  duration_ms: 360.383644
  type: 'test'
  ...
# Subtest: a verb the CLI actually dispatches is never documented as withdrawn, in either skill tree
ok 7 - a verb the CLI actually dispatches is never documented as withdrawn, in either skill tree
  ---
  duration_ms: 11.34923
  type: 'test'
  ...
# Subtest: the shipped skill tree's markdown is byte-identical to the source tree's -- asserted, never regenerated (30-REVIEW WR-11)
ok 8 - the shipped skill tree's markdown is byte-identical to the source tree's -- asserted, never regenerated (30-REVIEW WR-11)
  ---
  duration_ms: 0.769154
  type: 'test'
  ...
# Subtest: planted violation: the same predicate reports a dispatched verb documented as withdrawn, and stays silent for one the CLI does not dispatch
ok 9 - planted violation: the same predicate reports a dispatched verb documented as withdrawn, and stays silent for one the CLI does not dispatch
  ---
  duration_ms: 4.511347
  type: 'test'
  ...
# Subtest: planted control: an UNRELATED `returned` does not discharge a stale withdrawal claim (30-REVIEW WR-11)
ok 10 - planted control: an UNRELATED `returned` does not discharge a stale withdrawal claim (30-REVIEW WR-11)
  ---
  duration_ms: 6.196315
  type: 'test'
  ...
1..10
# tests 10
# suites 0
# pass 10
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 671.796305
```

### Planted run

- **Plant:** `scripts/lib/anno-cli-verbs.mjs`: `ANNO_CLI_VERB_FLOOR = 3` → `ANNO_CLI_VERB_FLOOR = 4`
- **Planted command:** `node --test anno-verb-coverage.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# Subtest: real-source parse: anno-cli.ts's dispatch switch yields exactly the 3 known verbs, never 'default'
ok 1 - real-source parse: anno-cli.ts's dispatch switch yields exactly the 3 known verbs, never 'default'
  ---
  duration_ms: 16.052675
  type: 'test'
  ...
# Subtest: positive control: every real verb is named by at least one real skill file (the Task 1 property, restated mechanically)
ok 2 - positive control: every real verb is named by at least one real skill file (the Task 1 property, restated mechanically)
  ---
  duration_ms: 16.314254
  type: 'test'
  ...
# Subtest: planted violation: an extra, genuinely new case is parsed and reported missing, while a real, documented verb is not
ok 3 - planted violation: an extra, genuinely new case is parsed and reported missing, while a real, documented verb is not
  ---
  duration_ms: 5.410111
  type: 'test'
  ...
# Subtest: comment hygiene: a case hidden in a block comment or a line comment is never parsed as a verb
ok 4 - comment hygiene: a case hidden in a block comment or a line comment is never parsed as a verb
  ---
  duration_ms: 0.532089
  type: 'test'
  ...
# Subtest: non-vacuity floor: ANNO_CLI_VERB_FLOOR matches the measured true count and the real parse meets it
not ok 5 - non-vacuity floor: ANNO_CLI_VERB_FLOOR matches the measured true count and the real parse meets it
  ---
  duration_ms: 2.342793
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-verb-coverage.test.ts:184:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    
    4 !== 3
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 3
  actual: 4
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-verb-coverage.test.ts:185:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: the CI script's live execution path: `node scripts/check-skill-tool-coverage.mjs` exits 0 with 'OK' in stdout
not ok 6 - the CI script's live execution path: `node scripts/check-skill-tool-coverage.mjs` exits 0 with 'OK' in stdout
  ---
  duration_ms: 342.722475
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-verb-coverage.test.ts:191:1'
  failureType: 'testCodeFailure'
  error: |-
    expected exit 0, got 1. stderr: check-skill-tool-coverage: FAIL
      - non-vacuity: expected at least 4 anno CLI verbs parsed from anno-cli.ts's dispatch switch, got 3 -- the parser or the switch statement itself may be broken
    
    
    1 !== 0
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 0
  actual: 1
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-verb-coverage.test.ts:194:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: a verb the CLI actually dispatches is never documented as withdrawn, in either skill tree
not ok 7 - a verb the CLI actually dispatches is never documented as withdrawn, in either skill tree
  ---
  duration_ms: 4.039509
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-verb-coverage.test.ts:376:1'
  failureType: 'testCodeFailure'
  error: 'the verb parse itself is broken; this scan would be vacuous'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-verb-coverage.test.ts:391:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: the shipped skill tree's markdown is byte-identical to the source tree's -- asserted, never regenerated (30-REVIEW WR-11)
ok 8 - the shipped skill tree's markdown is byte-identical to the source tree's -- asserted, never regenerated (30-REVIEW WR-11)
  ---
  duration_ms: 0.914316
  type: 'test'
  ...
# Subtest: planted violation: the same predicate reports a dispatched verb documented as withdrawn, and stays silent for one the CLI does not dispatch
ok 9 - planted violation: the same predicate reports a dispatched verb documented as withdrawn, and stays silent for one the CLI does not dispatch
  ---
  duration_ms: 6.566264
  type: 'test'
  ...
# Subtest: planted control: an UNRELATED `returned` does not discharge a stale withdrawal claim (30-REVIEW WR-11)
ok 10 - planted control: an UNRELATED `returned` does not discharge a stale withdrawal claim (30-REVIEW WR-11)
  ---
  duration_ms: 4.149757
  type: 'test'
  ...
1..10
# tests 10
# suites 0
# pass 7
# fail 3
# cancelled 0
# skipped 0
# todo 0
# duration_ms 656.98046
```

## `scripts/lib/anno-cli-verbs.mjs` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node scripts/check-skill-tool-coverage.mjs`
- **cwd:** `.`
- **Exit status:** `0` (must be 0)

Raw output:

```
check-skill-tool-coverage: OK -- 37 distinct vice_* names extracted from 33 files across 7 skill directories; 31 resolved as advertised on the stock manifest (38 tools total). Classified: 0 proxy-local (neither manifest), 2 proxy-local-with-stock-manifest-entry, 1 deny-listed, 2 not-a-tool-name, 6 fork-only-unrecoverable, 0 pending-later-phase. anno_*: 18 distinct names extracted, all curated (CURATED_ANNO_TOOLS has 19 entries). anno CLI verbs: 3 parsed from anno-cli.ts, 3/3 resolved (named by at least one skill file).

(node:255828) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
```

### Planted run

- **Plant:** `scripts/lib/anno-cli-verbs.mjs`: `text.includes(`anno ${verb}`)` → `text.includes(`anno-${verb}`)`
- **Planted command:** `node scripts/check-skill-tool-coverage.mjs`
- **cwd:** `.`
- **Exit status:** `1` (must be non-zero)

Raw output:

```

check-skill-tool-coverage: FAIL
  - anno coverage: parsed from anno-cli.ts's dispatch switch but named by NO skill file. Resolve by: (1) documenting it in a playbook, (2) removing the verb, or (3) recording it as a scope decision.
  - anno export-asm: parsed from anno-cli.ts's dispatch switch but named by NO skill file. Resolve by: (1) documenting it in a playbook, (2) removing the verb, or (3) recording it as a scope decision.
  - anno render-memmap: parsed from anno-cli.ts's dispatch switch but named by NO skill file. Resolve by: (1) documenting it in a playbook, (2) removing the verb, or (3) recording it as a scope decision.
```

## `scripts/lib/anno-cli-verbs.d.mts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```

```

### Planted run

- **Plant:** `scripts/lib/anno-cli-verbs.d.mts`: `export declare function verbsMissingFromSkills(verbs: string[], skillTexts: string[]): string[];` → `// planted: the verbsMissingFromSkills declaration is removed`
- **Planted command:** `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
anno-verb-coverage.test.ts(24,29): error TS2305: Module '"../../../scripts/lib/anno-cli-verbs.mjs"' has no exported member 'verbsMissingFromSkills'.
```

## `src/mcp/vice/docs-absorbed-decisions.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test docs-absorbed-decisions.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# Subtest: 1. non-vacuity: the guard's own phrase sets are non-empty and its section isolators return non-null for both documents
ok 1 - 1. non-vacuity: the guard's own phrase sets are non-empty and its section isolators return non-null for both documents
  ---
  duration_ms: 4.540163
  type: 'test'
  ...
# Subtest: 2. ARCHITECTURE.md's Architecture Change Record names D-17/D-18, carries a date, has six numbered steps, and names both guard filenames in step 5
ok 2 - 2. ARCHITECTURE.md's Architecture Change Record names D-17/D-18, carries a date, has six numbered steps, and names both guard filenames in step 5
  ---
  duration_ms: 1.42465
  type: 'test'
  ...
# Subtest: 3. ARCHITECTURE.md carries Rule A21 naming resolveStorePath, ChildProcess, and anno-mcp-client.ts
ok 3 - 3. ARCHITECTURE.md carries Rule A21 naming resolveStorePath, ChildProcess, and anno-mcp-client.ts
  ---
  duration_ms: 0.830046
  type: 'test'
  ...
# Subtest: 4. PROJECT.md's Key Decisions D-36 row states supersession of D-32, names handler.rs:1894, the upstream issue url, and a named reversal-trigger phrase
ok 4 - 4. PROJECT.md's Key Decisions D-36 row states supersession of D-32, names handler.rs:1894, the upstream issue url, and a named reversal-trigger phrase
  ---
  duration_ms: 2.1164
  type: 'test'
  ...
# Subtest: 5. cross-document consistency: every PROJECT.md line naming D-32 also names D-36 or the word 'supersede'
ok 5 - 5. cross-document consistency: every PROJECT.md line naming D-32 also names D-36 or the word 'supersede'
  ---
  duration_ms: 1.977749
  type: 'test'
  ...
1..5
# tests 5
# suites 0
# pass 5
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 224.785627
```

### Planted run

- **Plant:** `.planning/PROJECT.md`: `handler.rs:1894` → `handler.rs:1895`
- **Planted command:** `node --test docs-absorbed-decisions.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# Subtest: 1. non-vacuity: the guard's own phrase sets are non-empty and its section isolators return non-null for both documents
ok 1 - 1. non-vacuity: the guard's own phrase sets are non-empty and its section isolators return non-null for both documents
  ---
  duration_ms: 2.746477
  type: 'test'
  ...
# Subtest: 2. ARCHITECTURE.md's Architecture Change Record names D-17/D-18, carries a date, has six numbered steps, and names both guard filenames in step 5
ok 2 - 2. ARCHITECTURE.md's Architecture Change Record names D-17/D-18, carries a date, has six numbered steps, and names both guard filenames in step 5
  ---
  duration_ms: 0.763159
  type: 'test'
  ...
# Subtest: 3. ARCHITECTURE.md carries Rule A21 naming resolveStorePath, ChildProcess, and anno-mcp-client.ts
ok 3 - 3. ARCHITECTURE.md carries Rule A21 naming resolveStorePath, ChildProcess, and anno-mcp-client.ts
  ---
  duration_ms: 0.429393
  type: 'test'
  ...
# Subtest: 4. PROJECT.md's Key Decisions D-36 row states supersession of D-32, names handler.rs:1894, the upstream issue url, and a named reversal-trigger phrase
not ok 4 - 4. PROJECT.md's Key Decisions D-36 row states supersession of D-32, names handler.rs:1894, the upstream issue url, and a named reversal-trigger phrase
  ---
  duration_ms: 1.853943
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/docs-absorbed-decisions.test.ts:198:1'
  failureType: 'testCodeFailure'
  error: 'the D-36 row does not name handler.rs:1894'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/docs-absorbed-decisions.test.ts:205:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: 5. cross-document consistency: every PROJECT.md line naming D-32 also names D-36 or the word 'supersede'
ok 5 - 5. cross-document consistency: every PROJECT.md line naming D-32 also names D-36 or the word 'supersede'
  ---
  duration_ms: 1.148676
  type: 'test'
  ...
1..5
# tests 5
# suites 0
# pass 4
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 248.628816
```

## `src/mcp/vice/absorbed-answer-key.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test absorbed-answer-key.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# Subtest: ANSWER.sha256 is exactly 64 hex characters
ok 1 - ANSWER.sha256 is exactly 64 hex characters
  ---
  duration_ms: 2.888561
  type: 'test'
  ...
# Subtest: ANSWER.sha256 matches the sha256 recomputed from ANSWER.md's own canonical line (T-11-SEAL-DRIFT)
ok 2 - ANSWER.sha256 matches the sha256 recomputed from ANSWER.md's own canonical line (T-11-SEAL-DRIFT)
  ---
  duration_ms: 1.957713
  type: 'test'
  ...
# Subtest: the canonical answer line matches QUESTION.md's own grammar (four lowercase key=value fields, single spaces)
ok 3 - the canonical answer line matches QUESTION.md's own grammar (four lowercase key=value fields, single spaces)
  ---
  duration_ms: 0.701534
  type: 'test'
  ...
# Subtest: QUESTION.md does not contain the canonical answer line (T-11-LEAK)
ok 4 - QUESTION.md does not contain the canonical answer line (T-11-LEAK)
  ---
  duration_ms: 0.59501
  type: 'test'
  ...
# Subtest: QUESTION.md does not contain the sealed answer's distinctive field values (T-11-LEAK)
ok 5 - QUESTION.md does not contain the sealed answer's distinctive field values (T-11-LEAK)
  ---
  duration_ms: 0.960059
  type: 'test'
  ...
# Subtest: SESSION-B-ANSWER.md's canonical line hashes to the sealed ANSWER.sha256 (criterion 1, D-26 two-session comparison)
ok 6 - SESSION-B-ANSWER.md's canonical line hashes to the sealed ANSWER.sha256 (criterion 1, D-26 two-session comparison)
  ---
  duration_ms: 0.630714
  type: 'test'
  ...
# Subtest: SESSION-B-ANSWER.md's canonical line matches QUESTION.md's own grammar
ok 7 - SESSION-B-ANSWER.md's canonical line matches QUESTION.md's own grammar
  ---
  duration_ms: 0.61575
  type: 'test'
  ...
# Subtest: ACME availability gate (D-08), reused for criterion 1's fixture reproducibility
ok 8 - ACME availability gate (D-08), reused for criterion 1's fixture reproducibility
  ---
  duration_ms: 0.408491
  type: 'test'
  ...
# Subtest: criterion 1's committed fixture source and .prg both exist (non-vacuity for the byte-compare below)
ok 9 - criterion 1's committed fixture source and .prg both exist (non-vacuity for the byte-compare below)
  ---
  duration_ms: 1.377023
  type: 'test'
  ...
# Subtest: gated: assembling criterion 1's fixture source under real ACME reproduces the committed .prg byte-for-byte (11-07-T1)
ok 10 - gated: assembling criterion 1's fixture source under real ACME reproduces the committed .prg byte-for-byte (11-07-T1)
  ---
  duration_ms: 8.184849
  type: 'test'
  ...
1..10
# tests 10
# suites 0
# pass 10
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 236.259668
```

### Planted run

- **Plant:** `.planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion1/ANSWER.sha256`: `e64463d8` → `e64463d9`
- **Planted command:** `node --test absorbed-answer-key.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# Subtest: ANSWER.sha256 is exactly 64 hex characters
ok 1 - ANSWER.sha256 is exactly 64 hex characters
  ---
  duration_ms: 3.038083
  type: 'test'
  ...
# Subtest: ANSWER.sha256 matches the sha256 recomputed from ANSWER.md's own canonical line (T-11-SEAL-DRIFT)
not ok 2 - ANSWER.sha256 matches the sha256 recomputed from ANSWER.md's own canonical line (T-11-SEAL-DRIFT)
  ---
  duration_ms: 3.99494
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/absorbed-answer-key.test.ts:84:1'
  failureType: 'testCodeFailure'
  error: |-
    ANSWER.sha256 (e64463d9cef8fbb7699620a3c207de08a36b1189afd9700452a448d91d8c08cc) does not match the sha256 recomputed from ANSWER.md's canonical line "label=border_bump_up confidence=probable-data blocktype=byte xrefcount=2" (e64463d8cef8fbb7699620a3c207de08a36b1189afd9700452a448d91d8c08cc) -- the seal has drifted from the answer it seals. Re-seal by recomputing sha256 of the exact canonical line (no trailing newline) and rewriting ANSWER.sha256.
    + actual - expected
    
    + 'e64463d8cef8fbb7699620a3c207de08a36b1189afd9700452a448d91d8c08cc'
    - 'e64463d9cef8fbb7699620a3c207de08a36b1189afd9700452a448d91d8c08cc'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 'e64463d9cef8fbb7699620a3c207de08a36b1189afd9700452a448d91d8c08cc'
  actual: 'e64463d8cef8fbb7699620a3c207de08a36b1189afd9700452a448d91d8c08cc'
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/absorbed-answer-key.test.ts:89:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
  ...
# Subtest: the canonical answer line matches QUESTION.md's own grammar (four lowercase key=value fields, single spaces)
ok 3 - the canonical answer line matches QUESTION.md's own grammar (four lowercase key=value fields, single spaces)
  ---
  duration_ms: 0.716384
  type: 'test'
  ...
# Subtest: QUESTION.md does not contain the canonical answer line (T-11-LEAK)
ok 4 - QUESTION.md does not contain the canonical answer line (T-11-LEAK)
  ---
  duration_ms: 0.56703
  type: 'test'
  ...
# Subtest: QUESTION.md does not contain the sealed answer's distinctive field values (T-11-LEAK)
ok 5 - QUESTION.md does not contain the sealed answer's distinctive field values (T-11-LEAK)
  ---
  duration_ms: 1.013734
  type: 'test'
  ...
# Subtest: SESSION-B-ANSWER.md's canonical line hashes to the sealed ANSWER.sha256 (criterion 1, D-26 two-session comparison)
not ok 6 - SESSION-B-ANSWER.md's canonical line hashes to the sealed ANSWER.sha256 (criterion 1, D-26 two-session comparison)
  ---
  duration_ms: 1.10527
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/absorbed-answer-key.test.ts:179:1'
  failureType: 'testCodeFailure'
  error: |-
    SESSION-B-ANSWER.md's canonical line "label=border_bump_up confidence=probable-data blocktype=byte xrefcount=2" hashes to e64463d8cef8fbb7699620a3c207de08a36b1189afd9700452a448d91d8c08cc, which does not match the sealed ANSWER.sha256 (e64463d9cef8fbb7699620a3c207de08a36b1189afd9700452a448d91d8c08cc). Per this project's Rule 5/T-11-RETROFIT policy, a mismatch is a real result to report -- ANSWER.md, ANSWER.sha256 and QUESTION.md must not be edited to force this test green.
    + actual - expected
    
    + 'e64463d8cef8fbb7699620a3c207de08a36b1189afd9700452a448d91d8c08cc'
    - 'e64463d9cef8fbb7699620a3c207de08a36b1189afd9700452a448d91d8c08cc'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 'e64463d9cef8fbb7699620a3c207de08a36b1189afd9700452a448d91d8c08cc'
  actual: 'e64463d8cef8fbb7699620a3c207de08a36b1189afd9700452a448d91d8c08cc'
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/absorbed-answer-key.test.ts:184:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: SESSION-B-ANSWER.md's canonical line matches QUESTION.md's own grammar
ok 7 - SESSION-B-ANSWER.md's canonical line matches QUESTION.md's own grammar
  ---
  duration_ms: 0.634026
  type: 'test'
  ...
# Subtest: ACME availability gate (D-08), reused for criterion 1's fixture reproducibility
ok 8 - ACME availability gate (D-08), reused for criterion 1's fixture reproducibility
  ---
  duration_ms: 0.362665
  type: 'test'
  ...
# Subtest: criterion 1's committed fixture source and .prg both exist (non-vacuity for the byte-compare below)
ok 9 - criterion 1's committed fixture source and .prg both exist (non-vacuity for the byte-compare below)
  ---
  duration_ms: 1.223477
  type: 'test'
  ...
# Subtest: gated: assembling criterion 1's fixture source under real ACME reproduces the committed .prg byte-for-byte (11-07-T1)
ok 10 - gated: assembling criterion 1's fixture source under real ACME reproduces the committed .prg byte-for-byte (11-07-T1)
  ---
  duration_ms: 7.625537
  type: 'test'
  ...
1..10
# tests 10
# suites 0
# pass 8
# fail 2
# cancelled 0
# skipped 0
# todo 0
# duration_ms 236.67203
```

## `src/mcp/vice/spawn-seam.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test spawn-seam.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# Subtest: the discovered emulator spawn-site set equals EXPECTED_EMULATOR_SPAWN_SITES exactly, in both directions
ok 1 - the discovered emulator spawn-site set equals EXPECTED_EMULATOR_SPAWN_SITES exactly, in both directions
  ---
  duration_ms: 320.035271
  type: 'test'
  ...
# Subtest: every discovered emulator spawn site uses the argv-array form and builds no shell command string
ok 2 - every discovered emulator spawn site uses the argv-array form and builds no shell command string
  ---
  duration_ms: 168.100942
  type: 'test'
  ...
# Subtest: non-vacuity: the scanned module set is real, and at least one emulator spawn call site was discovered
ok 3 - non-vacuity: the scanned module set is real, and at least one emulator spawn call site was discovered
  ---
  duration_ms: 220.036142
  type: 'test'
  ...
# Subtest: planted violation: a module that spawns the emulator through a shell command string is reported unsafe
ok 4 - planted violation: a module that spawns the emulator through a shell command string is reported unsafe
  ---
  duration_ms: 0.783833
  type: 'test'
  ...
# Subtest: planted violation: a module whose emulator spawn passes an argv array reports safe
ok 5 - planted violation: a module whose emulator spawn passes an argv array reports safe
  ---
  duration_ms: 0.577835
  type: 'test'
  ...
# Subtest: planted violation: an argv-form emulator spawn whose second argument is a bare string, not an array, is reported unsafe
ok 6 - planted violation: an argv-form emulator spawn whose second argument is a bare string, not an array, is reported unsafe
  ---
  duration_ms: 0.486762
  type: 'test'
  ...
# Subtest: planted violation control: an emulator spawn mention that exists ONLY inside a block comment and a string literal is NOT reported
ok 7 - planted violation control: an emulator spawn mention that exists ONLY inside a block comment and a string literal is NOT reported
  ---
  duration_ms: 0.481119
  type: 'test'
  ...
# Subtest: planted violation control: a RegExp.prototype.exec() call is never mistaken for a shell spawn
ok 8 - planted violation control: a RegExp.prototype.exec() call is never mistaken for a shell spawn
  ---
  duration_ms: 0.418866
  type: 'test'
  ...
# Subtest: backend-detect.mts's own probeBackend() spawnSync(binPath, [flag] call is discovered and reports safe
ok 9 - backend-detect.mts's own probeBackend() spawnSync(binPath, [flag] call is discovered and reports safe
  ---
  duration_ms: 5.256358
  type: 'test'
  ...
# Subtest: the one-spawn-site invariant: backend-detect.mts contains exactly ONE emulator spawn call -- a second path means a probe was added without re-running the decision
ok 10 - the one-spawn-site invariant: backend-detect.mts contains exactly ONE emulator spawn call -- a second path means a probe was added without re-running the decision
  ---
  duration_ms: 4.59501
  type: 'test'
  ...
# Subtest: planted violation: duplicating backend-detect.mts's spawn statement into a second function makes the one-spawn-site invariant fail
ok 11 - planted violation: duplicating backend-detect.mts's spawn statement into a second function makes the one-spawn-site invariant fail
  ---
  duration_ms: 7.332141
  type: 'test'
  ...
1..11
# tests 11
# suites 0
# pass 11
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 925.453899
```

### Planted run

- **Plant:** `src/mcp/vice/backend-detect.mts`: `spawnSync(binPath, [flag], {` → `spawnSync(binPath, flag, {`
- **Planted command:** `node --test spawn-seam.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# Subtest: the discovered emulator spawn-site set equals EXPECTED_EMULATOR_SPAWN_SITES exactly, in both directions
ok 1 - the discovered emulator spawn-site set equals EXPECTED_EMULATOR_SPAWN_SITES exactly, in both directions
  ---
  duration_ms: 331.998154
  type: 'test'
  ...
# Subtest: every discovered emulator spawn site uses the argv-array form and builds no shell command string
not ok 2 - every discovered emulator spawn site uses the argv-array form and builds no shell command string
  ---
  duration_ms: 157.644173
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/spawn-seam.test.ts:301:1'
  failureType: 'testCodeFailure'
  error: 'backend-detect.mts: not every emulator spawn call passes an argv ARRAY as its second argument (the command-injection invariant this seam exists to hold)'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/spawn-seam.test.ts:311:12)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
  ...
# Subtest: non-vacuity: the scanned module set is real, and at least one emulator spawn call site was discovered
ok 3 - non-vacuity: the scanned module set is real, and at least one emulator spawn call site was discovered
  ---
  duration_ms: 170.522171
  type: 'test'
  ...
# Subtest: planted violation: a module that spawns the emulator through a shell command string is reported unsafe
ok 4 - planted violation: a module that spawns the emulator through a shell command string is reported unsafe
  ---
  duration_ms: 0.768215
  type: 'test'
  ...
# Subtest: planted violation: a module whose emulator spawn passes an argv array reports safe
ok 5 - planted violation: a module whose emulator spawn passes an argv array reports safe
  ---
  duration_ms: 0.664253
  type: 'test'
  ...
# Subtest: planted violation: an argv-form emulator spawn whose second argument is a bare string, not an array, is reported unsafe
ok 6 - planted violation: an argv-form emulator spawn whose second argument is a bare string, not an array, is reported unsafe
  ---
  duration_ms: 0.683708
  type: 'test'
  ...
# Subtest: planted violation control: an emulator spawn mention that exists ONLY inside a block comment and a string literal is NOT reported
ok 7 - planted violation control: an emulator spawn mention that exists ONLY inside a block comment and a string literal is NOT reported
  ---
  duration_ms: 0.634437
  type: 'test'
  ...
# Subtest: planted violation control: a RegExp.prototype.exec() call is never mistaken for a shell spawn
ok 8 - planted violation control: a RegExp.prototype.exec() call is never mistaken for a shell spawn
  ---
  duration_ms: 0.460748
  type: 'test'
  ...
# Subtest: backend-detect.mts's own probeBackend() spawnSync(binPath, [flag] call is discovered and reports safe
not ok 9 - backend-detect.mts's own probeBackend() spawnSync(binPath, [flag] call is discovered and reports safe
  ---
  duration_ms: 3.108105
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/spawn-seam.test.ts:429:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    
    false !== true
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/spawn-seam.test.ts:434:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: the one-spawn-site invariant: backend-detect.mts contains exactly ONE emulator spawn call -- a second path means a probe was added without re-running the decision
ok 10 - the one-spawn-site invariant: backend-detect.mts contains exactly ONE emulator spawn call -- a second path means a probe was added without re-running the decision
  ---
  duration_ms: 2.517109
  type: 'test'
  ...
# Subtest: planted violation: duplicating backend-detect.mts's spawn statement into a second function makes the one-spawn-site invariant fail
ok 11 - planted violation: duplicating backend-detect.mts's spawn statement into a second function makes the one-spawn-site invariant fail
  ---
  duration_ms: 4.811398
  type: 'test'
  ...
1..11
# tests 11
# suites 0
# pass 9
# fail 2
# cancelled 0
# skipped 0
# todo 0
# duration_ms 946.96654
```

## `src/mcp/vice/anno-cli.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test --test-name-pattern VERB_OPTIONS carries exactly the surviving verbs anno-cli.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# (node:256142) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: VERB_OPTIONS carries exactly the surviving verbs
ok 1 - VERB_OPTIONS carries exactly the surviving verbs
  ---
  duration_ms: 5.365528
  type: 'test'
  ...
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2767.82162
```

### Planted run

- **Plant:** `src/mcp/vice/anno-cli.ts`: `"export-asm": ["--store", "--out", "--force"],` → `"export-asmX": ["--store", "--out", "--force"],`
- **Planted command:** `node --test --test-name-pattern VERB_OPTIONS carries exactly the surviving verbs anno-cli.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# (node:256215) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: VERB_OPTIONS carries exactly the surviving verbs
not ok 1 - VERB_OPTIONS carries exactly the surviving verbs
  ---
  duration_ms: 4.828684
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-cli.test.ts:331:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
    
      [
        'coverage',
    +   'export-asmX',
    -   'export-asm',
        'render-memmap'
      ]
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
    0: 'coverage'
    1: 'export-asm'
    2: 'render-memmap'
  actual:
    0: 'coverage'
    1: 'export-asmX'
    2: 'render-memmap'
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-cli.test.ts:332:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2636.820492
```

## `src/mcp/vice/anno-confidence.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test anno-confidence.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# Subtest: CONFIDENCE_GRADES has exactly five members with the exact five phrases from the template
ok 1 - CONFIDENCE_GRADES has exactly five members with the exact five phrases from the template
  ---
  duration_ms: 2.648541
  type: 'test'
  ...
# Subtest: CONFIDENCE_GRADES tokens and brackets are the five canonical bracket tokens
ok 2 - CONFIDENCE_GRADES tokens and brackets are the five canonical bracket tokens
  ---
  duration_ms: 0.283068
  type: 'test'
  ...
# Subtest: every grade round-trips through formatConfidenceComment -> parseConfidencePrefix
ok 3 - every grade round-trips through formatConfidenceComment -> parseConfidencePrefix
  ---
  duration_ms: 0.506804
  type: 'test'
  ...
# Subtest: parseConfidencePrefix returns grade: null for a plain comment, without throwing
ok 4 - parseConfidencePrefix returns grade: null for a plain comment, without throwing
  ---
  duration_ms: 0.195745
  type: 'test'
  ...
# Subtest: parseConfidencePrefix returns grade: null for an empty comment
ok 5 - parseConfidencePrefix returns grade: null for an empty comment
  ---
  duration_ms: 0.308877
  type: 'test'
  ...
# Subtest: parseConfidencePrefix returns grade: null for a comment with an unclosed bracket
ok 6 - parseConfidencePrefix returns grade: null for a comment with an unclosed bracket
  ---
  duration_ms: 0.165805
  type: 'test'
  ...
# Subtest: parseConfidencePrefix throws on a plain typo, naming the offending token and all five valid ones
ok 7 - parseConfidencePrefix throws on a plain typo, naming the offending token and all five valid ones
  ---
  duration_ms: 1.132717
  type: 'test'
  ...
# Subtest: parseConfidencePrefix throws on wrong case
ok 8 - parseConfidencePrefix throws on wrong case
  ---
  duration_ms: 0.243856
  type: 'test'
  ...
# Subtest: parseConfidencePrefix throws on an underscore instead of a hyphen
ok 9 - parseConfidencePrefix throws on an underscore instead of a hyphen
  ---
  duration_ms: 0.482993
  type: 'test'
  ...
# Subtest: parseConfidencePrefix throws on a plural
ok 10 - parseConfidencePrefix throws on a plural
  ---
  duration_ms: 0.554207
  type: 'test'
  ...
# Subtest: parseConfidencePrefix throws on extra whitespace inside the brackets
ok 11 - parseConfidencePrefix throws on extra whitespace inside the brackets
  ---
  duration_ms: 0.415268
  type: 'test'
  ...
# Subtest: parseConfidencePrefix throws on a near-miss single-word grade
ok 12 - parseConfidencePrefix throws on a near-miss single-word grade
  ---
  duration_ms: 0.281321
  type: 'test'
  ...
# Subtest: formatConfidenceComment throws on an invalid grade token
ok 13 - formatConfidenceComment throws on an invalid grade token
  ---
  duration_ms: 1.717089
  type: 'test'
  ...
# Subtest: searchQueryForGrade throws on an invalid grade token
ok 14 - searchQueryForGrade throws on an invalid grade token
  ---
  duration_ms: 0.285148
  type: 'test'
  ...
# Subtest: searchQueryForGrade returns a string that appears verbatim in a graded comment
ok 15 - searchQueryForGrade returns a string that appears verbatim in a graded comment
  ---
  duration_ms: 0.316284
  type: 'test'
  ...
1..15
# tests 15
# suites 0
# pass 15
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 203.16172
```

### Planted run

- **Plant:** `src/mcp/vice/anno-confidence.ts`: `phrase: "probable code",` → `phrase: "probable-code",`
- **Planted command:** `node --test anno-confidence.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# Subtest: CONFIDENCE_GRADES has exactly five members with the exact five phrases from the template
not ok 1 - CONFIDENCE_GRADES has exactly five members with the exact five phrases from the template
  ---
  duration_ms: 8.463384
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-confidence.test.ts:20:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
    
      [
        'confirmed code',
    +   'probable-code',
    -   'probable code',
        'confirmed data',
        'probable data',
        'unknown'
      ]
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
    0: 'confirmed code'
    1: 'probable code'
    2: 'confirmed data'
    3: 'probable data'
    4: 'unknown'
  actual:
    0: 'confirmed code'
    1: 'probable-code'
    2: 'confirmed data'
    3: 'probable data'
    4: 'unknown'
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-confidence.test.ts:23:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
# Subtest: CONFIDENCE_GRADES tokens and brackets are the five canonical bracket tokens
ok 2 - CONFIDENCE_GRADES tokens and brackets are the five canonical bracket tokens
  ---
  duration_ms: 0.704443
  type: 'test'
  ...
# Subtest: every grade round-trips through formatConfidenceComment -> parseConfidencePrefix
ok 3 - every grade round-trips through formatConfidenceComment -> parseConfidencePrefix
  ---
  duration_ms: 1.350769
  type: 'test'
  ...
# Subtest: parseConfidencePrefix returns grade: null for a plain comment, without throwing
ok 4 - parseConfidencePrefix returns grade: null for a plain comment, without throwing
  ---
  duration_ms: 0.572677
  type: 'test'
  ...
# Subtest: parseConfidencePrefix returns grade: null for an empty comment
ok 5 - parseConfidencePrefix returns grade: null for an empty comment
  ---
  duration_ms: 0.466471
  type: 'test'
  ...
# Subtest: parseConfidencePrefix returns grade: null for a comment with an unclosed bracket
ok 6 - parseConfidencePrefix returns grade: null for a comment with an unclosed bracket
  ---
  duration_ms: 0.412366
  type: 'test'
  ...
# Subtest: parseConfidencePrefix throws on a plain typo, naming the offending token and all five valid ones
ok 7 - parseConfidencePrefix throws on a plain typo, naming the offending token and all five valid ones
  ---
  duration_ms: 2.025743
  type: 'test'
  ...
# Subtest: parseConfidencePrefix throws on wrong case
ok 8 - parseConfidencePrefix throws on wrong case
  ---
  duration_ms: 0.499021
  type: 'test'
  ...
# Subtest: parseConfidencePrefix throws on an underscore instead of a hyphen
ok 9 - parseConfidencePrefix throws on an underscore instead of a hyphen
  ---
  duration_ms: 0.985435
  type: 'test'
  ...
# Subtest: parseConfidencePrefix throws on a plural
ok 10 - parseConfidencePrefix throws on a plural
  ---
  duration_ms: 1.149101
  type: 'test'
  ...
# Subtest: parseConfidencePrefix throws on extra whitespace inside the brackets
ok 11 - parseConfidencePrefix throws on extra whitespace inside the brackets
  ---
  duration_ms: 0.722553
  type: 'test'
  ...
# Subtest: parseConfidencePrefix throws on a near-miss single-word grade
ok 12 - parseConfidencePrefix throws on a near-miss single-word grade
  ---
  duration_ms: 0.427088
  type: 'test'
  ...
# Subtest: formatConfidenceComment throws on an invalid grade token
ok 13 - formatConfidenceComment throws on an invalid grade token
  ---
  duration_ms: 0.488923
  type: 'test'
  ...
# Subtest: searchQueryForGrade throws on an invalid grade token
ok 14 - searchQueryForGrade throws on an invalid grade token
  ---
  duration_ms: 0.455042
  type: 'test'
  ...
# Subtest: searchQueryForGrade returns a string that appears verbatim in a graded comment
ok 15 - searchQueryForGrade returns a string that appears verbatim in a graded comment
  ---
  duration_ms: 0.505106
  type: 'test'
  ...
1..15
# tests 15
# suites 0
# pass 14
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 229.454819
```

## `src/mcp/vice/anno-coverage-grammar.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test anno-coverage-grammar.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# Subtest: the composed corpus is bounded, stratified across every family, and large enough to be a population
ok 1 - the composed corpus is bounded, stratified across every family, and large enough to be a population
  ---
  duration_ms: 2.944705
  type: 'test'
  ...
# Subtest: every family contributed at least MIN_PER_FAMILY members, so the corpus cap is not a prefix of one family
ok 2 - every family contributed at least MIN_PER_FAMILY members, so the corpus cap is not a prefix of one family
  ---
  duration_ms: 1.011838
  type: 'test'
  ...
# Subtest: building the corpus twice yields byte-identical payloads in identical order
ok 3 - building the corpus twice yields byte-identical payloads in identical order
  ---
  duration_ms: 151.762613
  type: 'test'
  ...
# Subtest: every payload is exactly 64 bytes with an intact data tail, and no two indexed arrangements are byte-identical
ok 4 - every payload is exactly 64 bytes with an intact data tail, and no two indexed arrangements are byte-identical
  ---
  duration_ms: 33.946916
  type: 'test'
  ...
# Subtest: a twin differs from its own indexed member, and two members share a twin only when they differ solely in index register
ok 5 - a twin differs from its own indexed member, and two members share a twin only when they differ solely in index register
  ---
  duration_ms: 25.492461
  type: 'test'
  ...
# Subtest: no generated payload contains the JAM opcode at any offset
ok 6 - no generated payload contains the JAM opcode at any offset
  ---
  duration_ms: 25.656743
  type: 'test'
  ...
# Subtest: every arrangement carries exactly one terminator and it is the last fragment
ok 7 - every arrangement carries exactly one terminator and it is the last fragment
  ---
  duration_ms: 2.16938
  type: 'test'
  ...
# Subtest: every y-indexed load the alphabet emits renders to the absolute_y opcode and never the zeropage_y one
ok 8 - every y-indexed load the alphabet emits renders to the absolute_y opcode and never the zeropage_y one
  ---
  duration_ms: 35.269793
  type: 'test'
  ...
# Subtest: all nine pinned regression members are present in the corpus by byte identity
ok 9 - all nine pinned regression members are present in the corpus by byte identity
  ---
  duration_ms: 0.962817
  type: 'test'
  ...
# Subtest: the corpus reaches every generative dimension: order, interleaving, gap placement and length
ok 10 - the corpus reaches every generative dimension: order, interleaving, gap placement and length
  ---
  duration_ms: 5.687352
  type: 'test'
  ...
# Subtest: the module under test is READ-ONLY by construction, and this suite writes no file
ok 11 - the module under test is READ-ONLY by construction, and this suite writes no file
  ---
  duration_ms: 1.339331
  type: 'test'
  ...
# Subtest: the oracle never reaches the instrument: no decode, no scan, no census inside the oracle section
ok 12 - the oracle never reaches the instrument: no decode, no scan, no census inside the oracle section
  ---
  duration_ms: 0.956435
  type: 'test'
  ...
# Subtest: the oracle's SCOPE is honest: no corpus payload reaches classes 1 or 2, so the oracle may be silent about them
ok 13 - the oracle's SCOPE is honest: no corpus payload reaches classes 1 or 2, so the oracle may be silent about them
  ---
  duration_ms: 289.216926
  type: 'test'
  ...
# Subtest: the computed oracle AGREES with all nine hand-declared pinned verdicts
ok 14 - the computed oracle AGREES with all nine hand-declared pinned verdicts
  ---
  duration_ms: 1.678156
  type: 'test'
  ...
# Subtest: the set of arrangements the instrument PROVES equals exactly the set the oracle says carries a proven link
ok 15 - the set of arrangements the instrument PROVES equals exactly the set the oracle says carries a proven link
  ---
  duration_ms: 5.751554
  type: 'test'
  ...
# Subtest: an arrangement the oracle says is unlinked moves not one byte into the seed set or the table-entry class
ok 16 - an arrangement the oracle says is unlinked moves not one byte into the seed set or the table-entry class
  ---
  duration_ms: 17.406267
  type: 'test'
  ...
# Subtest: an unlinked arrangement's census reaches exactly its own prologue and classifies no table byte as code
ok 17 - an unlinked arrangement's census reaches exactly its own prologue and classifies no table byte as code
  ---
  duration_ms: 10.98686
  type: 'test'
  ...
# Subtest: twins: an unlinked pair reports the same census, and a LINKED indexed member reaches strictly more than its twin
ok 18 - twins: an unlinked pair reports the same census, and a LINKED indexed member reaches strictly more than its twin
  ---
  duration_ms: 4.163643
  type: 'test'
  ...
# Subtest: the instrument is NOT quietly measuring nothing: the corpus carries a population of genuinely linked arrangements
ok 19 - the instrument is NOT quietly measuring nothing: the corpus carries a population of genuinely linked arrangements
  ---
  duration_ms: 3.949336
  type: 'test'
  ...
# Subtest: degenerate inputs produce empty dispatch collections and no throw
ok 20 - degenerate inputs produce empty dispatch collections and no throw
  ---
  duration_ms: 0.789712
  type: 'test'
  ...
# Subtest: every address list the scan publishes is strictly ascending and free of duplicates, and scanning twice is stable
ok 21 - every address list the scan publishes is strictly ascending and free of duplicates, and scanning twice is stable
  ---
  duration_ms: 15.928975
  type: 'test'
  ...
# Subtest: the suite stays inside its 30-second budget, so a runaway enumeration is caught rather than tolerated
ok 22 - the suite stays inside its 30-second budget, so a runaway enumeration is caught rather than tolerated
  ---
  duration_ms: 0.345911
  type: 'test'
  ...
1..22
# tests 22
# suites 0
# pass 22
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1126.185013
```

### Planted run

- **Plant:** `src/mcp/vice/disasm-decoder.ts`: `case "absolute_y": {
        const value = b1! | (b2! << 8);` → `case "absolute_y": {
        const value = b1! | (b2! << 9);`
- **Planted command:** `node --test anno-coverage-grammar.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# Subtest: the composed corpus is bounded, stratified across every family, and large enough to be a population
ok 1 - the composed corpus is bounded, stratified across every family, and large enough to be a population
  ---
  duration_ms: 3.360196
  type: 'test'
  ...
# Subtest: every family contributed at least MIN_PER_FAMILY members, so the corpus cap is not a prefix of one family
ok 2 - every family contributed at least MIN_PER_FAMILY members, so the corpus cap is not a prefix of one family
  ---
  duration_ms: 1.040361
  type: 'test'
  ...
# Subtest: building the corpus twice yields byte-identical payloads in identical order
ok 3 - building the corpus twice yields byte-identical payloads in identical order
  ---
  duration_ms: 169.010515
  type: 'test'
  ...
# Subtest: every payload is exactly 64 bytes with an intact data tail, and no two indexed arrangements are byte-identical
ok 4 - every payload is exactly 64 bytes with an intact data tail, and no two indexed arrangements are byte-identical
  ---
  duration_ms: 46.408607
  type: 'test'
  ...
# Subtest: a twin differs from its own indexed member, and two members share a twin only when they differ solely in index register
ok 5 - a twin differs from its own indexed member, and two members share a twin only when they differ solely in index register
  ---
  duration_ms: 31.022012
  type: 'test'
  ...
# Subtest: no generated payload contains the JAM opcode at any offset
ok 6 - no generated payload contains the JAM opcode at any offset
  ---
  duration_ms: 49.58162
  type: 'test'
  ...
# Subtest: every arrangement carries exactly one terminator and it is the last fragment
ok 7 - every arrangement carries exactly one terminator and it is the last fragment
  ---
  duration_ms: 4.576442
  type: 'test'
  ...
# Subtest: every y-indexed load the alphabet emits renders to the absolute_y opcode and never the zeropage_y one
ok 8 - every y-indexed load the alphabet emits renders to the absolute_y opcode and never the zeropage_y one
  ---
  duration_ms: 57.742354
  type: 'test'
  ...
# Subtest: all nine pinned regression members are present in the corpus by byte identity
ok 9 - all nine pinned regression members are present in the corpus by byte identity
  ---
  duration_ms: 1.810632
  type: 'test'
  ...
# Subtest: the corpus reaches every generative dimension: order, interleaving, gap placement and length
ok 10 - the corpus reaches every generative dimension: order, interleaving, gap placement and length
  ---
  duration_ms: 7.765019
  type: 'test'
  ...
# Subtest: the module under test is READ-ONLY by construction, and this suite writes no file
ok 11 - the module under test is READ-ONLY by construction, and this suite writes no file
  ---
  duration_ms: 1.486587
  type: 'test'
  ...
# Subtest: the oracle never reaches the instrument: no decode, no scan, no census inside the oracle section
ok 12 - the oracle never reaches the instrument: no decode, no scan, no census inside the oracle section
  ---
  duration_ms: 1.042348
  type: 'test'
  ...
# Subtest: the oracle's SCOPE is honest: no corpus payload reaches classes 1 or 2, so the oracle may be silent about them
ok 13 - the oracle's SCOPE is honest: no corpus payload reaches classes 1 or 2, so the oracle may be silent about them
  ---
  duration_ms: 230.36751
  type: 'test'
  ...
# Subtest: the computed oracle AGREES with all nine hand-declared pinned verdicts
ok 14 - the computed oracle AGREES with all nine hand-declared pinned verdicts
  ---
  duration_ms: 1.731676
  type: 'test'
  ...
# Subtest: the set of arrangements the instrument PROVES equals exactly the set the oracle says carries a proven link
not ok 15 - the set of arrangements the instrument PROVES equals exactly the set the oracle says carries a proven link
  ---
  duration_ms: 10.711054
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-coverage-grammar.test.ts:1964:1'
  failureType: 'testCodeFailure'
  error: |-
    the instrument and the oracle disagree over 2000 composed payloads.
      PROVEN but NOT expected (0) -- false positives of the kind that has failed this criterion three times:
      EXPECTED but NOT proven (22) -- an over-tightening that would make the instrument measure nothing:
        xx-hi-first/adjacent-stores#0  `lda $0838,x : sta $fc : lda $0830,x : sta $fb : jmp ($00fb)`  [oracle: LINKED by R1..R6 class-3 zeropage-vector-jumped-through]
        xx-hi-first/adjacent-stores#6  `lda $0838,x : sta $fc : nop : nop : lda $0830,x : sta $fb : jmp ($00fb)`  [oracle: LINKED by R1..R6 class-3 zeropage-vector-jumped-through]
        xx-hi-first/adjacent-stores-and-indirect-read#0  `lda $0838,x : sta $fc : lda $0830,x : nop : nop : sta $fb : lda ($fb),y : jmp ($00fb)`  [oracle: LINKED by R1..R6 class-3 zeropage-vector-jumped-through]
        xx-hi-first/adjacent-stores-and-indirect-read#3  `lda $0838,x : sta $fc : lda $0830,x : sta $fb : lda ($fb),y : jmp ($00fb)`  [oracle: LINKED by R1..R6 class-3 zeropage-vector-jumped-through]
        xx-hi-first/adjacent-stores-and-indirect-read#9  `lda $0838,x : sta $fc : lda ($fb),y : lda $0830,x : sta $fb : nop : nop : jmp ($00fb)`  [oracle: LINKED by R1..R6 class-3 zeropage-vector-jumped-through]
        xx-hi-first/pushes-and-adjacent-stores#6  `lda $0838,x : sta $fc : lda $0830,x : pha : sta $fb : pha : jmp ($00fb)`  [oracle: LINKED by R1..R6 class-3 zeropage-vector-jumped-through]
        xx-hi-first/two-pushes#pin0  `lda $0838,x : pha : lda $0830,x : pha : rts`  [oracle: LINKED by R2+R6 class-4 window published]
        xx-lo-first/adjacent-stores#3  `lda $0830,x : sta $fb : lda $0838,x : sta $fc : nop : jmp ($00fb)`  [oracle: LINKED by R1..R6 class-3 zeropage-vector-jumped-through]
        ... and 14 more
    + actual - expected
    
      {
    +   expectedNotProven: [
    +     'xx-hi-first/adjacent-stores#0',
    +     'xx-hi-first/adjacent-stores#6',
    +     'xx-hi-first/adjacent-stores-and-indirect-read#0',
    +     'xx-hi-first/adjacent-stores-and-indirect-read#3',
    +     'xx-hi-first/adjacent-stores-and-indirect-read#9',
    +     'xx-hi-first/pushes-and-adjacent-stores#6',
    +     'xx-hi-first/two-pushes#pin0',
    +     'xx-lo-first/adjacent-stores#3',
    +     'xx-lo-first/adjacent-stores#pin1',
    +     'xx-lo-first/adjacent-stores-and-indirect-read#6',
    +     'xx-lo-first/four-stores-two-pairs#7',
    +     'xx-lo-first/pushes-and-adjacent-stores#0',
    +     'xx-lo-first/pushes-and-adjacent-stores#6',
    +     'xx-lo-first/pushes-and-adjacent-stores#pin0',
    +     'yy-hi-first/four-stores-two-pairs#7',
    +     'yy-hi-first/pushes-and-adjacent-stores#3',
    +     'yy-hi-first/two-pushes#0',
    +     'yy-hi-first/two-pushes#6',
    +     'yy-lo-first/adjacent-stores#3',
    +     'yy-lo-first/adjacent-stores#6',
    +     'yy-lo-first/four-stores-two-pairs#5',
    +     'yy-lo-first/pushes-transfers-and-adjacent-stores#2'
    +   ],
    -   expectedNotProven: [],
        provenNotExpected: []
      }
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
    provenNotExpected:
    expectedNotProven:
  actual:
    provenNotExpected:
    expectedNotProven:
      0: 'xx-hi-first/adjacent-stores#0'
      1: 'xx-hi-first/adjacent-stores#6'
      2: 'xx-hi-first/adjacent-stores-and-indirect-read#0'
      3: 'xx-hi-first/adjacent-stores-and-indirect-read#3'
      4: 'xx-hi-first/adjacent-stores-and-indirect-read#9'
      5: 'xx-hi-first/pushes-and-adjacent-stores#6'
      6: 'xx-hi-first/two-pushes#pin0'
      7: 'xx-lo-first/adjacent-stores#3'
      8: 'xx-lo-first/adjacent-stores#pin1'
      9: 'xx-lo-first/adjacent-stores-and-indirect-read#6'
      10: 'xx-lo-first/four-stores-two-pairs#7'
      11: 'xx-lo-first/pushes-and-adjacent-stores#0'
      12: 'xx-lo-first/pushes-and-adjacent-stores#6'
      13: 'xx-lo-first/pushes-and-adjacent-stores#pin0'
      14: 'yy-hi-first/four-stores-two-pairs#7'
      15: 'yy-hi-first/pushes-and-adjacent-stores#3'
      16: 'yy-hi-first/two-pushes#0'
      17: 'yy-hi-first/two-pushes#6'
      18: 'yy-lo-first/adjacent-stores#3'
      19: 'yy-lo-first/adjacent-stores#6'
      20: 'yy-lo-first/four-stores-two-pairs#5'
      21: 'yy-lo-first/pushes-transfers-and-adjacent-stores#2'
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-coverage-grammar.test.ts:1985:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: an arrangement the oracle says is unlinked moves not one byte into the seed set or the table-entry class
ok 16 - an arrangement the oracle says is unlinked moves not one byte into the seed set or the table-entry class
  ---
  duration_ms: 20.411887
  type: 'test'
  ...
# Subtest: an unlinked arrangement's census reaches exactly its own prologue and classifies no table byte as code
ok 17 - an unlinked arrangement's census reaches exactly its own prologue and classifies no table byte as code
  ---
  duration_ms: 10.114643
  type: 'test'
  ...
# Subtest: twins: an unlinked pair reports the same census, and a LINKED indexed member reaches strictly more than its twin
not ok 18 - twins: an unlinked pair reports the same census, and a LINKED indexed member reaches strictly more than its twin
  ---
  duration_ms: 0.985206
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-coverage-grammar.test.ts:2048:1'
  failureType: 'testCodeFailure'
  error: "xx-lo-first/pushes-and-adjacent-stores#pin0 (`lda $0830,x : pha : sta $fb : lda $0838,x : pha : sta $fc : rts`) [oracle: LINKED by R1..R6 class-3 stack-return-push-idiom]: a linked arrangement seeds a descent its twin cannot, so it must reach strictly more than the twin's 13 bytes -- observed 13"
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-coverage-grammar.test.ts:2064:14)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: the instrument is NOT quietly measuring nothing: the corpus carries a population of genuinely linked arrangements
not ok 19 - the instrument is NOT quietly measuring nothing: the corpus carries a population of genuinely linked arrangements
  ---
  duration_ms: 4.381781
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-coverage-grammar.test.ts:2083:1'
  failureType: 'testCodeFailure'
  error: 'xx-lo-first/pushes-and-adjacent-stores#pin0 (`lda $0830,x : pha : sta $fb : lda $0838,x : pha : sta $fc : rts`): a linked arrangement must publish a non-empty seed set'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-coverage-grammar.test.ts:2094:12)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: degenerate inputs produce empty dispatch collections and no throw
ok 20 - degenerate inputs produce empty dispatch collections and no throw
  ---
  duration_ms: 0.919126
  type: 'test'
  ...
# Subtest: every address list the scan publishes is strictly ascending and free of duplicates, and scanning twice is stable
ok 21 - every address list the scan publishes is strictly ascending and free of duplicates, and scanning twice is stable
  ---
  duration_ms: 18.550003
  type: 'test'
  ...
# Subtest: the suite stays inside its 30-second budget, so a runaway enumeration is caught rather than tolerated
ok 22 - the suite stays inside its 30-second budget, so a runaway enumeration is caught rather than tolerated
  ---
  duration_ms: 0.397739
  type: 'test'
  ...
1..22
# tests 22
# suites 0
# pass 19
# fail 3
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1253.232346
```

## `src/mcp/vice/anno-coverage.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test anno-coverage.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# (node:256390) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: the report's top-level key set is exactly the pinned set, in order, and carries the schema version
ok 1 - the report's top-level key set is exactly the pinned set, in order, and carries the schema version
  ---
  duration_ms: 34.163722
  type: 'test'
  ...
# Subtest: COV-01: no key anywhere in the report matches a combined-figure vocabulary
ok 2 - COV-01: no key anywhere in the report matches a combined-figure vocabulary
  ---
  duration_ms: 4.437166
  type: 'test'
  ...
# Subtest: independence: rewriting every block entry to one type leaves every census byte count unchanged and moves only the divergence sub-report
ok 3 - independence: rewriting every block entry to one type leaves every census byte count unchanged and moves only the divergence sub-report
  ---
  duration_ms: 4.149702
  type: 'test'
  ...
# Subtest: the production block-spelling list is the DERIVED union of BOTH accepted vocabularies, with no duplicates
ok 4 - the production block-spelling list is the DERIVED union of BOTH accepted vocabularies, with no duplicates
  ---
  duration_ms: 0.663641
  type: 'test'
  ...
# Subtest: substitutability: the substituted vocabulary shares no string with EITHER accepted production vocabulary, which is what makes a left-behind comparison site observable
ok 5 - substitutability: the substituted vocabulary shares no string with EITHER accepted production vocabulary, which is what makes a left-behind comparison site observable
  ---
  duration_ms: 0.481489
  type: 'test'
  ...
# Subtest: substitutability: feeding the census a second, zero-overlap block vocabulary through the adapter leaves every census byte count exact and moves only the divergence sub-report
ok 6 - substitutability: feeding the census a second, zero-overlap block vocabulary through the adapter leaves every census byte count exact and moves only the divergence sub-report
  ---
  duration_ms: 3.505936
  type: 'test'
  ...
# Subtest: substitutability: on an UNGRADED comment set every fromStore value moves while every fromBytes value holds -- the sharpest form of the bytes-versus-store claim
ok 7 - substitutability: on an UNGRADED comment set every fromStore value moves while every fromBytes value holds -- the sharpest form of the bytes-versus-store claim
  ---
  duration_ms: 3.985154
  type: 'test'
  ...
# Subtest: idempotency: building the coverage report twice over the same fixture through the adapter yields deep-equal reports
ok 8 - idempotency: building the coverage report twice over the same fixture through the adapter yields deep-equal reports
  ---
  duration_ms: 3.035118
  type: 'test'
  ...
# Subtest: a lowercase label kind collapses the user tally to zero with no error -- the silent zero, made loud
ok 9 - a lowercase label kind collapses the user tally to zero with no error -- the silent zero, made loud
  ---
  duration_ms: 3.475612
  type: 'test'
  ...
# Subtest: derived agreement: every member of the store's label-kind vocabulary appears as a literal in the census's source
ok 10 - derived agreement: every member of the store's label-kind vocabulary appears as a literal in the census's source
  ---
  duration_ms: 43.359744
  type: 'test'
  ...
# Subtest: SUPPLEMENT (not the proof): the census module's source carries no production block-type literal
ok 11 - SUPPLEMENT (not the proof): the census module's source carries no production block-type literal
  ---
  duration_ms: 32.378116
  type: 'test'
  ...
# Subtest: SUPPLEMENT (WR-12): no shipped module passes CoverageOptions.blockClassifier
ok 12 - SUPPLEMENT (WR-12): no shipped module passes CoverageOptions.blockClassifier
  ---
  duration_ms: 216.613884
  type: 'test'
  ...
# Subtest: decodability: removing the seed set collapses the reached count, so a census that barely responds to its seeds would fail here
ok 13 - decodability: removing the seed set collapses the reached count, so a census that barely responds to its seeds would fail here
  ---
  duration_ms: 0.786078
  type: 'test'
  ...
# Subtest: WR-03: the descent stops at an illegal opcode instead of claiming it -- four code bytes are four, not sixty-four
ok 14 - WR-03: the descent stops at an illegal opcode instead of claiming it -- four code bytes are four, not sixty-four
  ---
  duration_ms: 0.543744
  type: 'test'
  ...
# Subtest: WR-03 both directions: the same payload filled with `nop` still reports every one of its sixty-four bytes reached
ok 15 - WR-03 both directions: the same payload filled with `nop` still reports every one of its sixty-four bytes reached
  ---
  duration_ms: 0.485966
  type: 'test'
  ...
# Subtest: WR-03: the two members of the pair are the same length and differ at exactly the sixty filler offsets
ok 16 - WR-03: the two members of the pair are the same length and differ at exactly the sixty filler offsets
  ---
  duration_ms: 0.327241
  type: 'test'
  ...
# Subtest: WR-03: the four byte classes still sum to rangeBytes for both members -- the byte the descent stopped claiming became unreached
ok 17 - WR-03: the four byte classes still sum to rangeBytes for both members -- the byte the descent stopped claiming became unreached
  ---
  duration_ms: 0.711237
  type: 'test'
  ...
# Subtest: WR-03: reachedAsInstruction never exceeds linearSweepDecodable -- the report cannot contradict itself about its own bytes
ok 18 - WR-03: reachedAsInstruction never exceeds linearSweepDecodable -- the report cannot contradict itself about its own bytes
  ---
  duration_ms: 1.351022
  type: 'test'
  ...
# Subtest: WR-03 regression: every committed coverage fixture reports the SAME reached count it did before the tightening
ok 19 - WR-03 regression: every committed coverage fixture reports the SAME reached count it did before the tightening
  ---
  duration_ms: 7.046967
  type: 'test'
  ...
# Subtest: WR-03 regression: the previously-unseen Phase 11 fixture's census is unchanged at 68 of 100
ok 20 - WR-03 regression: the previously-unseen Phase 11 fixture's census is unchanged at 68 of 100
  ---
  duration_ms: 1.67017
  type: 'test'
  ...
# Subtest: emptiness: a zero-byte, a one-byte and a seedless payload each report zero reached and unreached == range, with no thrown error
ok 21 - emptiness: a zero-byte, a one-byte and a seedless payload each report zero reached and unreached == range, with no thrown error
  ---
  duration_ms: 0.621709
  type: 'test'
  ...
# Subtest: emptiness: an undecodable payload reports an explicit reason rather than throwing or reading as clean (COV-02)
ok 22 - emptiness: an undecodable payload reports an explicit reason rather than throwing or reading as clean (COV-02)
  ---
  duration_ms: 1.163706
  type: 'test'
  ...
# Subtest: a missing or empty project path is the ONE caller-contract violation this module throws for
ok 23 - a missing or empty project path is the ONE caller-contract violation this module throws for
  ---
  duration_ms: 1.651601
  type: 'test'
  ...
# Subtest: idempotency: two consecutive reports over the same fixture are deeply equal once the timestamp is removed
ok 24 - idempotency: two consecutive reports over the same fixture are deeply equal once the timestamp is removed
  ---
  duration_ms: 22.890849
  type: 'test'
  ...
# Subtest: ordering: every offending-address list in every fixture's report is in ascending numeric order
ok 25 - ordering: every offending-address list in every fixture's report is in ascending numeric order
  ---
  duration_ms: 7.995753
  type: 'test'
  ...
# Subtest: normalisation pins the exact rules: ASCII lowercase, backticks and emphasis stripped, whitespace runs collapsed, trimmed
ok 26 - normalisation pins the exact rules: ASCII lowercase, backticks and emphasis stripped, whitespace runs collapsed, trimmed
  ---
  duration_ms: 0.453584
  type: 'test'
  ...
# Subtest: two identical normalised comments at different addresses count as ONE distinct comment
ok 27 - two identical normalised comments at different addresses count as ONE distinct comment
  ---
  duration_ms: 0.371801
  type: 'test'
  ...
# Subtest: a zero-comment project reports a NULL distinct-comment ratio with a zero commented-address count, never a division
ok 28 - a zero-comment project reports a NULL distinct-comment ratio with a zero commented-address count, never a division
  ---
  duration_ms: 0.364128
  type: 'test'
  ...
# Subtest: a comment equal to a banned-generic entry after normalisation never counts as documentation
ok 29 - a comment equal to a banned-generic entry after normalisation never counts as documentation
  ---
  duration_ms: 0.43582
  type: 'test'
  ...
# Subtest: a near-miss confidence token is reported as a measured defect, never thrown and never degraded to ungraded
ok 30 - a near-miss confidence token is reported as a measured defect, never thrown and never degraded to ungraded
  ---
  duration_ms: 0.521581
  type: 'test'
  ...
# Subtest: BANNED_GENERIC_COMMENTS is a named, non-empty set with at least five entries
ok 31 - BANNED_GENERIC_COMMENTS is a named, non-empty set with at least five entries
  ---
  duration_ms: 0.365654
  type: 'test'
  ...
# Subtest: AUTO_NAME_PREFIX_RE deliberately excludes the prefix upstream shares between predefined and user-defined label types
ok 32 - AUTO_NAME_PREFIX_RE deliberately excludes the prefix upstream shares between predefined and user-defined label types
  ---
  duration_ms: 0.353758
  type: 'test'
  ...
# Subtest: the cross-reference rule engages at strictly MORE THAN ONE caller, and not at one
ok 33 - the cross-reference rule engages at strictly MORE THAN ONE caller, and not at one
  ---
  duration_ms: 0.718688
  type: 'test'
  ...
# Subtest: ANCHORING: a colliding longer hex never satisfies the multi-caller rule -- NC4 plus $8106 is still undocumented, and the well-documented control is still clean
ok 34 - ANCHORING: a colliding longer hex never satisfies the multi-caller rule -- NC4 plus $8106 is still undocumented, and the well-documented control is still clean
  ---
  duration_ms: 2.261456
  type: 'test'
  ...
# Subtest: ANCHORING: a caller's label name satisfies the rule only on an identifier boundary
ok 35 - ANCHORING: a caller's label name satisfies the rule only on an identifier boundary
  ---
  duration_ms: 0.881646
  type: 'test'
  ...
# Subtest: WR-13: a caller's label name counts only when the comment USES it as a reference -- an ordinary English word in ordinary prose names no caller
ok 36 - WR-13: a caller's label name counts only when the comment USES it as a reference -- an ordinary English word in ordinary prose names no caller
  ---
  duration_ms: 2.240246
  type: 'test'
  ...
# Subtest: WR-13: the fixture-level both-directions statement -- NC5 stays CLEAN and NC4 is still caught by `reproducibility`
ok 37 - WR-13: the fixture-level both-directions statement -- NC5 stays CLEAN and NC4 is still caught by `reproducibility`
  ---
  duration_ms: 1.900156
  type: 'test'
  ...
# Subtest: every reported count is a count of the deduped list printed beside it
ok 38 - every reported count is a count of the deduped list printed beside it
  ---
  duration_ms: 7.148936
  type: 'test'
  ...
# Subtest: two symbols at one address produce a count of one, not two
ok 39 - two symbols at one address produce a count of one, not two
  ---
  duration_ms: 0.570253
  type: 'test'
  ...
# Subtest: the kind figure is over non-System labels only, and reports a null fraction rather than a divide when there are none
ok 40 - the kind figure is over non-System labels only, and reports a null fraction rather than a divide when there are none
  ---
  duration_ms: 0.324791
  type: 'test'
  ...
# Subtest: dispatch class 1: an indirect jump through a ZERO-PAGE vector is found and reported, with a null target
ok 41 - dispatch class 1: an indirect jump through a ZERO-PAGE vector is found and reported, with a null target
  ---
  duration_ms: 0.566777
  type: 'test'
  ...
# Subtest: dispatch class 2: a multi-entry table yields every entry, not the single entry upstream reads
ok 42 - dispatch class 2: a multi-entry table yields every entry, not the single entry upstream reads
  ---
  duration_ms: 0.45419
  type: 'test'
  ...
# Subtest: dispatch class 3: a PROVEN split lo/hi table pair is reconstructed from its two bases
ok 43 - dispatch class 3: a PROVEN split lo/hi table pair is reconstructed from its two bases
  ---
  duration_ms: 0.490679
  type: 'test'
  ...
# Subtest: a PROVEN split table survives an unrelated indexed load between its two halves (WR-15)
ok 44 - a PROVEN split table survives an unrelated indexed load between its two halves (WR-15)
  ---
  duration_ms: 0.98869
  type: 'test'
  ...
# Subtest: only a PROVEN pairing consumes its leading load, and at most one advisory candidate is emitted per leading load
ok 45 - only a PROVEN pairing consumes its leading load, and at most one advisory candidate is emitted per leading load
  ---
  duration_ms: 1.138031
  type: 'test'
  ...
# Subtest: dispatch class 4: the stack-return dispatch idiom is found even though it contains no indirect-jump opcode
ok 46 - dispatch class 4: the stack-return dispatch idiom is found even though it contains no indirect-jump opcode
  ---
  duration_ms: 0.798233
  type: 'test'
  ...
# Subtest: dispatch class 4 DECLINES a pha/pha/rts window whose two loads use different index registers
ok 47 - dispatch class 4 DECLINES a pha/pha/rts window whose two loads use different index registers
  ---
  duration_ms: 0.671372
  type: 'test'
  ...
# Subtest: dispatch class 4 DECLINES a window whose reconstructed entry point does not decode as a legal instruction
ok 48 - dispatch class 4 DECLINES a window whose reconstructed entry point does not decode as a legal instruction
  ---
  duration_ms: 0.631378
  type: 'test'
  ...
# Subtest: dispatch class 3 DECLINES an ordinary two-table indexed read loop
ok 49 - dispatch class 3 DECLINES an ordinary two-table indexed read loop
  ---
  duration_ms: 0.524155
  type: 'test'
  ...
# Subtest: an ordinary indexed copy loop does not inflate the census over its immediate twin
ok 50 - an ordinary indexed copy loop does not inflate the census over its immediate twin
  ---
  duration_ms: 0.895092
  type: 'test'
  ...
# Subtest: the class-4 stack-return idiom is not also reported as a class-3 split table
ok 51 - the class-4 stack-return idiom is not also reported as a class-3 split table
  ---
  duration_ms: 0.772029
  type: 'test'
  ...
# Subtest: an advisory split-table candidate never reaches the census
ok 52 - an advisory split-table candidate never reaches the census
  ---
  duration_ms: 0.720336
  type: 'test'
  ...
# Subtest: a census whose origin plus size would leave the 16-bit space is bounded, AND SO IS ITS OWN DISPATCH SUB-REPORT
ok 53 - a census whose origin plus size would leave the 16-bit space is bounded, AND SO IS ITS OWN DISPATCH SUB-REPORT
  ---
  duration_ms: 2.016965
  type: 'test'
  ...
# Subtest: bounded walk: a table whose entries would chain indefinitely reports truncation and terminates (T-19-12)
ok 54 - bounded walk: a table whose entries would chain indefinitely reports truncation and terminates (T-19-12)
  ---
  duration_ms: 0.862741
  type: 'test'
  ...
# Subtest: bounded walk: the descent walker honours an explicit step bound and reports truncation rather than looping
ok 55 - bounded walk: the descent walker honours an explicit step bound and reports truncation rather than looping
  ---
  duration_ms: 0.820849
  type: 'test'
  ...
# Subtest: the committed control set is exactly the pinned size, and every fixture carries a project file and a store file
ok 56 - the committed control set is exactly the pinned size, and every fixture carries a project file and a store file
  ---
  duration_ms: 1.953026
  type: 'test'
  ...
# Subtest: control FP1 (fp1-indexed-copy-loop): produces a non-clean result
ok 57 - control FP1 (fp1-indexed-copy-loop): produces a non-clean result
  ---
  duration_ms: 1.013219
  type: 'test'
  ...
# Subtest: control FP1b (fp1b-immediate-copy-loop): produces a non-clean result
ok 58 - control FP1b (fp1b-immediate-copy-loop): produces a non-clean result
  ---
  duration_ms: 0.773373
  type: 'test'
  ...
# Subtest: control FP2 (fp2-zeropage-data-pointer): produces a non-clean result
ok 59 - control FP2 (fp2-zeropage-data-pointer): produces a non-clean result
  ---
  duration_ms: 0.615311
  type: 'test'
  ...
# Subtest: control FP2b (fp2b-immediate-data-pointer): produces a non-clean result
ok 60 - control FP2b (fp2b-immediate-data-pointer): produces a non-clean result
  ---
  duration_ms: 0.577412
  type: 'test'
  ...
# Subtest: control FP3 (fp3-unlinked-push-idiom): produces a non-clean result
ok 61 - control FP3 (fp3-unlinked-push-idiom): produces a non-clean result
  ---
  duration_ms: 0.505377
  type: 'test'
  ...
# Subtest: control FP3b (fp3b-immediate-push-idiom): produces a non-clean result
ok 62 - control FP3b (fp3b-immediate-push-idiom): produces a non-clean result
  ---
  duration_ms: 0.486673
  type: 'test'
  ...
# Subtest: control NC1 (nc1-all-auto): produces a non-clean result naming labels
ok 63 - control NC1 (nc1-all-auto): produces a non-clean result naming labels
  ---
  duration_ms: 1.129555
  type: 'test'
  ...
# Subtest: control NC1b (nc1b-auto-renamed-in-place): produces a non-clean result naming labels
ok 64 - control NC1b (nc1b-auto-renamed-in-place): produces a non-clean result naming labels
  ---
  duration_ms: 1.057384
  type: 'test'
  ...
# Subtest: control NC2 (nc2-generic-comments): produces a non-clean result naming commentVacuity
ok 65 - control NC2 (nc2-generic-comments): produces a non-clean result naming commentVacuity
  ---
  duration_ms: 1.03911
  type: 'test'
  ...
# Subtest: control NC3 (nc3-all-data-blocks): produces a non-clean result naming divergence
ok 66 - control NC3 (nc3-all-data-blocks): produces a non-clean result naming divergence
  ---
  duration_ms: 0.956519
  type: 'test'
  ...
# Subtest: control NC4 (nc4-multi-caller-unnamed): produces a non-clean result naming reproducibility
ok 67 - control NC4 (nc4-multi-caller-unnamed): produces a non-clean result naming reproducibility
  ---
  duration_ms: 0.7572
  type: 'test'
  ...
# Subtest: control NC5 (nc5-well-documented): produces a CLEAN result
ok 68 - control NC5 (nc5-well-documented): produces a CLEAN result
  ---
  duration_ms: 0.552499
  type: 'test'
  ...
# Subtest: NON-VACUITY: the well-documented control passes, so the instrument is not merely a machine that fails everything
ok 69 - NON-VACUITY: the well-documented control passes, so the instrument is not merely a machine that fails everything
  ---
  duration_ms: 0.611688
  type: 'test'
  ...
# Subtest: NC1b earns its place: the kind figure alone would pass the auto-renamed-in-place control, the name figure catches it
ok 70 - NC1b earns its place: the kind figure alone would pass the auto-renamed-in-place control, the name figure catches it
  ---
  duration_ms: 0.563898
  type: 'test'
  ...
# Subtest: NC3 earns its place: the census does not move by one byte under a mass block-type set, only the divergence does
ok 71 - NC3 earns its place: the census does not move by one byte under a mass block-type set, only the divergence does
  ---
  duration_ms: 0.906976
  type: 'test'
  ...
# Subtest: a false-positive control fixture is committed for the census, and the census declines to inflate on it
ok 72 - a false-positive control fixture is committed for the census, and the census declines to inflate on it
  ---
  duration_ms: 1.137752
  type: 'test'
  ...
# Subtest: FP1b earns its place: without a committed twin, FP1's census could only be compared against a remembered number
ok 73 - FP1b earns its place: without a committed twin, FP1's census could only be compared against a remembered number
  ---
  duration_ms: 1.260505
  type: 'test'
  ...
# Subtest: a zero-page vector that is BUILT and then read through as data is not dispatch context, and the census does not inflate on it
ok 74 - a zero-page vector that is BUILT and then read through as data is not dispatch context, and the census does not inflate on it
  ---
  duration_ms: 1.590478
  type: 'test'
  ...
# Subtest: FP2b earns its place: without a committed twin, the interior control's census could only be compared against a remembered number
ok 75 - FP2b earns its place: without a committed twin, the interior control's census could only be compared against a remembered number
  ---
  duration_ms: 1.292343
  type: 'test'
  ...
# Subtest: a push idiom that pushes bytes the two paired loads never supplied is not dispatch context, and the census does not inflate on it
ok 76 - a push idiom that pushes bytes the two paired loads never supplied is not dispatch context, and the census does not inflate on it
  ---
  duration_ms: 1.181905
  type: 'test'
  ...
# Subtest: the tightened class-3 push-idiom branch is LIVE: a payload whose two paired loads each push what they loaded is still PROVEN
ok 77 - the tightened class-3 push-idiom branch is LIVE: a payload whose two paired loads each push what they loaded is still PROVEN
  ---
  duration_ms: 0.717434
  type: 'test'
  ...
# Subtest: a jump through a vector the pairing's own two loads never wrote to is not dispatch context, and the census does not inflate on it
ok 78 - a jump through a vector the pairing's own two loads never wrote to is not dispatch context, and the census does not inflate on it
  ---
  duration_ms: 1.098994
  type: 'test'
  ...
# Subtest: the tightened zero-page-vector branch is LIVE: the one-byte-different twin whose jump names the pairing's OWN vector is still PROVEN
ok 79 - the tightened zero-page-vector branch is LIVE: the one-byte-different twin whose jump names the pairing's OWN vector is still PROVEN
  ---
  duration_ms: 0.901913
  type: 'test'
  ...
# Subtest: the reachability matrix is exactly the cross product of the declared shapes and the declared routes
ok 80 - the reachability matrix is exactly the cross product of the declared shapes and the declared routes
  ---
  duration_ms: 0.33234
  type: 'test'
  ...
# Subtest: reachability on a route that CONSULTS the shared gate is DERIVED, not declared
ok 81 - reachability on a route that CONSULTS the shared gate is DERIVED, not declared
  ---
  duration_ms: 0.272868
  type: 'test'
  ...
# Subtest: every gate-interior declaration is mechanically TRUE, not a claim in a table
ok 82 - every gate-interior declaration is mechanically TRUE, not a claim in a table
  ---
  duration_ms: 3.453203
  type: 'test'
  ...
# Subtest: a control DECLARED as positive is actually ACCEPTED by the instrument
ok 83 - a control DECLARED as positive is actually ACCEPTED by the instrument
  ---
  duration_ms: 0.827415
  type: 'test'
  ...
# Subtest: every REACHABLE (shape, route) pair is claimed by a negative interior declaration
ok 84 - every REACHABLE (shape, route) pair is claimed by a negative interior declaration
  ---
  duration_ms: 0.544695
  type: 'test'
  ...
# Subtest: every REACHABLE pair's negative controls are confirmed INSIDE it by the witness
ok 85 - every REACHABLE pair's negative controls are confirmed INSIDE it by the witness
  ---
  duration_ms: 0.949103
  type: 'test'
  ...
# Subtest: every REACHABLE pair's verdicts are measured in THAT ROUTE'S own collection, never through the aggregate seam
ok 86 - every REACHABLE pair's verdicts are measured in THAT ROUTE'S own collection, never through the aggregate seam
  ---
  duration_ms: 1.933436
  type: 'test'
  ...
# Subtest: every UNREACHABLE (shape, route) pair makes the witness THROW, naming the pair
ok 87 - every UNREACHABLE (shape, route) pair makes the witness THROW, naming the pair
  ---
  duration_ms: 0.34445
  type: 'test'
  ...
# Subtest: NON-VACUITY per route: each reachable pair has a payload inside it AND a payload outside it
ok 88 - NON-VACUITY per route: each reachable pair has a payload inside it AND a payload outside it
  ---
  duration_ms: 1.309006
  type: 'test'
  ...
# Subtest: NON-VACUITY: the witness DECLINES an outside-bracketing payload offered as the zero-page vector shape's interior control
ok 89 - NON-VACUITY: the witness DECLINES an outside-bracketing payload offered as the zero-page vector shape's interior control
  ---
  duration_ms: 0.62214
  type: 'test'
  ...
# Subtest: the window-edge twin is OUTSIDE the class-3 push-idiom route while FP3 is INSIDE it, so the interior predicate is not satisfied by everything
ok 90 - the window-edge twin is OUTSIDE the class-3 push-idiom route while FP3 is INSIDE it, so the interior predicate is not satisfied by everything
  ---
  duration_ms: 0.899873
  type: 'test'
  ...
# Subtest: minting a dispatch shape id without an interior predicate THROWS, naming the id
ok 91 - minting a dispatch shape id without an interior predicate THROWS, naming the id
  ---
  duration_ms: 0.250577
  type: 'test'
  ...
# Subtest: the class-4-only control does NOT claim the class-3 route: the disjunction is gone
ok 92 - the class-4-only control does NOT claim the class-3 route: the disjunction is gone
  ---
  duration_ms: 0.144199
  type: 'test'
  ...
# Subtest: FP3 is interior to the class-3 route and OUTSIDE the class-4 one, so the two routes are genuinely distinguished
ok 93 - FP3 is interior to the class-3 route and OUTSIDE the class-4 one, so the two routes are genuinely distinguished
  ---
  duration_ms: 0.377146
  type: 'test'
  ...
# Subtest: asking the witness about an UNREACHABLE (shape, route) pair THROWS, naming both
ok 94 - asking the witness about an UNREACHABLE (shape, route) pair THROWS, naming both
  ---
  duration_ms: 0.219041
  type: 'test'
  ...
# Subtest: minting a ROUTE nobody declared THROWS, naming the route
ok 95 - minting a ROUTE nobody declared THROWS, naming the route
  ---
  duration_ms: 0.180211
  type: 'test'
  ...
# Subtest: every declaration row's route is a declared one, and only an OUTSIDE row may carry a null route
ok 96 - every declaration row's route is a declared one, and only an OUTSIDE row may carry a null route
  ---
  duration_ms: 0.363276
  type: 'test'
  ...
# Subtest: the witness is PURE over its four arguments: two calls on one payload return the same answer
ok 97 - the witness is PURE over its four arguments: two calls on one payload return the same answer
  ---
  duration_ms: 0.382845
  type: 'test'
  ...
# Subtest: the declared shape count equals the number of true-returning sites in hasDispatchContext()'s own source
ok 98 - the declared shape count equals the number of true-returning sites in hasDispatchContext()'s own source
  ---
  duration_ms: 2.384677
  type: 'test'
  ...
# Subtest: functionBodyFromSource() THROWS naming the signature when the function it is asked for does not exist
ok 99 - functionBodyFromSource() THROWS naming the signature when the function it is asked for does not exist
  ---
  duration_ms: 0.665457
  type: 'test'
  ...
# Subtest: EVERY true-returning site of hasDispatchContext() consults the PAIRING under test, not merely the window
ok 100 - EVERY true-returning site of hasDispatchContext() consults the PAIRING under test, not merely the window
  ---
  duration_ms: 1.413483
  type: 'test'
  ...
# Subtest: PIN 1: the number of hasDispatchContext() CALL SITES equals the number of routes that consult the shared gate
ok 101 - PIN 1: the number of hasDispatchContext() CALL SITES equals the number of routes that consult the shared gate
  ---
  duration_ms: 9.31207
  type: 'test'
  ...
# Subtest: PIN 2: each route publishes from exactly ONE site inside scanIndirectDispatch(), and the sites total the route count
ok 102 - PIN 2: each route publishes from exactly ONE site inside scanIndirectDispatch(), and the sites total the route count
  ---
  duration_ms: 2.189814
  type: 'test'
  ...
# Subtest: PIN 3: the seam's own sources are exactly PROVEN_TARGET_SOURCES, and every route publishes into one of them
ok 103 - PIN 3: the seam's own sources are exactly PROVEN_TARGET_SOURCES, and every route publishes into one of them
  ---
  duration_ms: 1.143637
  type: 'test'
  ...
# Subtest: PIN 4: the class-4 publication site PRECEDES the shared gate's only call site, and no call precedes it
ok 104 - PIN 4: the class-4 publication site PRECEDES the shared gate's only call site, and no call precedes it
  ---
  duration_ms: 2.944749
  type: 'test'
  ...
# Subtest: PIN 5: the decodability predicate is DECLARED exactly once and CALLED from exactly three sites
ok 105 - PIN 5: the decodability predicate is DECLARED exactly once and CALLED from exactly three sites
  ---
  duration_ms: 2.372036
  type: 'test'
  ...
# Subtest: PIN 6: the three call sites are the descent, the linear sweep and the entry-point gate -- and nothing else
ok 106 - PIN 6: the three call sites are the descent, the linear sweep and the entry-point gate -- and nothing else
  ---
  duration_ms: 1.881852
  type: 'test'
  ...
# Subtest: PIN 7: the decoder's illegal flag is READ at exactly one site in the module, inside the predicate
ok 107 - PIN 7: the decoder's illegal flag is READ at exactly one site in the module, inside the predicate
  ---
  duration_ms: 2.065715
  type: 'test'
  ...
# Subtest: PIN 8: the descent consults the predicate BEFORE the loop that marks class zero
ok 108 - PIN 8: the descent consults the predicate BEFORE the loop that marks class zero
  ---
  duration_ms: 0.664283
  type: 'test'
  ...
# Subtest: the previously-unseen Phase 11 fixture -- authored for a different phase, never used to write these rules -- produces a well-formed report
ok 109 - the previously-unseen Phase 11 fixture -- authored for a different phase, never used to write these rules -- produces a well-formed report
  ---
  duration_ms: 0.842914
  type: 'test'
  ...
# Subtest: the coverage module contains no file-write call, no project-save call and no live-session import
ok 110 - the coverage module contains no file-write call, no project-save call and no live-session import
  ---
  duration_ms: 1.249096
  type: 'test'
  ...
# Subtest: ANSWER.sha256 is exactly 64 lowercase hex characters
ok 111 - ANSWER.sha256 is exactly 64 lowercase hex characters
  ---
  duration_ms: 0.455283
  type: 'test'
  ...
# Subtest: ANSWER.sha256 matches the sha256 recomputed from ANSWER.md's own canonical line (T-19-SEAL-DRIFT)
ok 112 - ANSWER.sha256 matches the sha256 recomputed from ANSWER.md's own canonical line (T-19-SEAL-DRIFT)
  ---
  duration_ms: 0.913781
  type: 'test'
  ...
# Subtest: both canonical lines match QUESTION.md's own grammar
ok 113 - both canonical lines match QUESTION.md's own grammar
  ---
  duration_ms: 0.729133
  type: 'test'
  ...
# Subtest: QUESTION.md does not contain either canonical answer line, nor any of its compound field assignments (T-19-LEAK)
ok 114 - QUESTION.md does not contain either canonical answer line, nor any of its compound field assignments (T-19-LEAK)
  ---
  duration_ms: 0.296568
  type: 'test'
  ...
# Subtest: RE-DERIVED-ANSWER.md's canonical line hashes to the sealed ANSWER.sha256, and a missing or empty fence FAILS rather than skips (T-19-RETROFIT / T-19-VACUOUS-CHECK)
ok 115 - RE-DERIVED-ANSWER.md's canonical line hashes to the sealed ANSWER.sha256, and a missing or empty fence FAILS rather than skips (T-19-RETROFIT / T-19-VACUOUS-CHECK)
  ---
  duration_ms: 0.258447
  type: 'test'
  ...
# Subtest: LIVE non-vacuity: both routes are recomputed from the committed fixture and both reproduce the sealed line
ok 116 - LIVE non-vacuity: both routes are recomputed from the committed fixture and both reproduce the sealed line
  ---
  duration_ms: 1.530892
  type: 'test'
  ...
# Subtest: CR-05 (A): a real .prg is censused -- payload decoded, origin from its own load address, non-zero byte count
ok 117 - CR-05 (A): a real .prg is censused -- payload decoded, origin from its own load address, non-zero byte count
  ---
  duration_ms: 1.632364
  type: 'test'
  ...
# Subtest: CR-05 (B): an exactly-65536-byte flat capture with a .raw extension decodes at origin 0
ok 118 - CR-05 (B): an exactly-65536-byte flat capture with a .raw extension decodes at origin 0
  ---
  duration_ms: 283.91378
  type: 'test'
  ...
# Subtest: CR-05 (C, WR-07): a SHORT flat .raw is refused BY NAME, never parsed as a load address plus payload
ok 119 - CR-05 (C, WR-07): a SHORT flat .raw is refused BY NAME, never parsed as a load address plus payload
  ---
  duration_ms: 1.923352
  type: 'test'
  ...
# Subtest: CR-05 (D): the retired JSON project form still loads, so an existing project file is not broken
ok 120 - CR-05 (D): the retired JSON project form still loads, so an existing project file is not broken
  ---
  duration_ms: 1.988882
  type: 'test'
  ...
# Subtest: CR-05 (E, agreement): loadProjectImage and anno-tools' loadImage answer identically for one .prg and one flat capture
ok 121 - CR-05 (E, agreement): loadProjectImage and anno-tools' loadImage answer identically for one .prg and one flat capture
  ---
  duration_ms: 15.973634
  type: 'test'
  ...
# Subtest: CR-05 (F, one decode two callers): anno-cli.ts's cross-reference byte source delegates to this loader rather than re-parsing
ok 122 - CR-05 (F, one decode two callers): anno-cli.ts's cross-reference byte source delegates to this loader rather than re-parsing
  ---
  duration_ms: 0.696757
  type: 'test'
  ...
# Subtest: CR-05 (F, behavioural): a file the loader refuses yields BOTH no usable image and payloadDecoded:false in one run
ok 123 - CR-05 (F, behavioural): a file the loader refuses yields BOTH no usable image and payloadDecoded:false in one run
  ---
  duration_ms: 1.384902
  type: 'test'
  ...
# Subtest: CR-05 (G, read-only and re-runnable): two runs over one store and image give the same figures and leave the store byte-identical
ok 124 - CR-05 (G, read-only and re-runnable): two runs over one store and image give the same figures and leave the store byte-identical
  ---
  duration_ms: 4.517265
  type: 'test'
  ...
# Subtest: CR-05 (H, the T-29-14-01 symmetry): a non-JSON file's reason names the path and the failure but discloses NONE of its bytes
ok 125 - CR-05 (H, the T-29-14-01 symmetry): a non-JSON file's reason names the path and the failure but discloses NONE of its bytes
  ---
  duration_ms: 1.823493
  type: 'test'
  ...
# Subtest: CR-05 (H, control): where the runtime names a parse POSITION the reason carries the offset -- a position is not content
ok 126 - CR-05 (H, control): where the runtime names a parse POSITION the reason carries the offset -- a position is not content
  ---
  duration_ms: 1.511271
  type: 'test'
  ...
1..126
# tests 126
# suites 0
# pass 126
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1305.802519
```

### Planted run

- **Plant:** `src/mcp/vice/anno-coverage.ts`: `export const COVERAGE_SCHEMA_VERSION = 2;` → `export const COVERAGE_SCHEMA_VERSION = 3;`
- **Planted command:** `node --test anno-coverage.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# (node:256409) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: the report's top-level key set is exactly the pinned set, in order, and carries the schema version
not ok 1 - the report's top-level key set is exactly the pinned set, in order, and carries the schema version
  ---
  duration_ms: 27.385793
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-coverage.test.ts:577:1'
  failureType: 'testCodeFailure'
  error: |-
    the schema version is pinned to a LITERAL here so a bump is always deliberate. It moved 1 -> 2 in 19-08: the top-level key set above is UNCHANGED, but the `dispatch` sub-object's target vocabulary changed -- `discoveredTargets` narrowed to evidence-backed targets only, and the ungated split lo/hi pairings it used to include moved to the advisory sibling `splitTableCandidates`. A consumer reading `discoveredTargets` gets a smaller, honest set than at version 1, and this number is the only signal it gets. Accepted by a human at 19-08's decision checkpoint (option `narrow-and-add-sibling`).
    
    3 !== 2
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 2
  actual: 3
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-coverage.test.ts:586:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
# Subtest: COV-01: no key anywhere in the report matches a combined-figure vocabulary
ok 2 - COV-01: no key anywhere in the report matches a combined-figure vocabulary
  ---
  duration_ms: 4.085319
  type: 'test'
  ...
# Subtest: independence: rewriting every block entry to one type leaves every census byte count unchanged and moves only the divergence sub-report
ok 3 - independence: rewriting every block entry to one type leaves every census byte count unchanged and moves only the divergence sub-report
  ---
  duration_ms: 3.953282
  type: 'test'
  ...
# Subtest: the production block-spelling list is the DERIVED union of BOTH accepted vocabularies, with no duplicates
ok 4 - the production block-spelling list is the DERIVED union of BOTH accepted vocabularies, with no duplicates
  ---
  duration_ms: 0.73984
  type: 'test'
  ...
# Subtest: substitutability: the substituted vocabulary shares no string with EITHER accepted production vocabulary, which is what makes a left-behind comparison site observable
ok 5 - substitutability: the substituted vocabulary shares no string with EITHER accepted production vocabulary, which is what makes a left-behind comparison site observable
  ---
  duration_ms: 0.452439
  type: 'test'
  ...
# Subtest: substitutability: feeding the census a second, zero-overlap block vocabulary through the adapter leaves every census byte count exact and moves only the divergence sub-report
ok 6 - substitutability: feeding the census a second, zero-overlap block vocabulary through the adapter leaves every census byte count exact and moves only the divergence sub-report
  ---
  duration_ms: 3.298177
  type: 'test'
  ...
# Subtest: substitutability: on an UNGRADED comment set every fromStore value moves while every fromBytes value holds -- the sharpest form of the bytes-versus-store claim
ok 7 - substitutability: on an UNGRADED comment set every fromStore value moves while every fromBytes value holds -- the sharpest form of the bytes-versus-store claim
  ---
  duration_ms: 3.626136
  type: 'test'
  ...
# Subtest: idempotency: building the coverage report twice over the same fixture through the adapter yields deep-equal reports
ok 8 - idempotency: building the coverage report twice over the same fixture through the adapter yields deep-equal reports
  ---
  duration_ms: 2.854439
  type: 'test'
  ...
# Subtest: a lowercase label kind collapses the user tally to zero with no error -- the silent zero, made loud
ok 9 - a lowercase label kind collapses the user tally to zero with no error -- the silent zero, made loud
  ---
  duration_ms: 2.827137
  type: 'test'
  ...
# Subtest: derived agreement: every member of the store's label-kind vocabulary appears as a literal in the census's source
ok 10 - derived agreement: every member of the store's label-kind vocabulary appears as a literal in the census's source
  ---
  duration_ms: 43.444177
  type: 'test'
  ...
# Subtest: SUPPLEMENT (not the proof): the census module's source carries no production block-type literal
ok 11 - SUPPLEMENT (not the proof): the census module's source carries no production block-type literal
  ---
  duration_ms: 33.678535
  type: 'test'
  ...
# Subtest: SUPPLEMENT (WR-12): no shipped module passes CoverageOptions.blockClassifier
ok 12 - SUPPLEMENT (WR-12): no shipped module passes CoverageOptions.blockClassifier
  ---
  duration_ms: 315.96842
  type: 'test'
  ...
# Subtest: decodability: removing the seed set collapses the reached count, so a census that barely responds to its seeds would fail here
ok 13 - decodability: removing the seed set collapses the reached count, so a census that barely responds to its seeds would fail here
  ---
  duration_ms: 1.225054
  type: 'test'
  ...
# Subtest: WR-03: the descent stops at an illegal opcode instead of claiming it -- four code bytes are four, not sixty-four
ok 14 - WR-03: the descent stops at an illegal opcode instead of claiming it -- four code bytes are four, not sixty-four
  ---
  duration_ms: 0.875575
  type: 'test'
  ...
# Subtest: WR-03 both directions: the same payload filled with `nop` still reports every one of its sixty-four bytes reached
ok 15 - WR-03 both directions: the same payload filled with `nop` still reports every one of its sixty-four bytes reached
  ---
  duration_ms: 0.863392
  type: 'test'
  ...
# Subtest: WR-03: the two members of the pair are the same length and differ at exactly the sixty filler offsets
ok 16 - WR-03: the two members of the pair are the same length and differ at exactly the sixty filler offsets
  ---
  duration_ms: 0.599537
  type: 'test'
  ...
# Subtest: WR-03: the four byte classes still sum to rangeBytes for both members -- the byte the descent stopped claiming became unreached
ok 17 - WR-03: the four byte classes still sum to rangeBytes for both members -- the byte the descent stopped claiming became unreached
  ---
  duration_ms: 1.206352
  type: 'test'
  ...
# Subtest: WR-03: reachedAsInstruction never exceeds linearSweepDecodable -- the report cannot contradict itself about its own bytes
ok 18 - WR-03: reachedAsInstruction never exceeds linearSweepDecodable -- the report cannot contradict itself about its own bytes
  ---
  duration_ms: 2.486825
  type: 'test'
  ...
# Subtest: WR-03 regression: every committed coverage fixture reports the SAME reached count it did before the tightening
ok 19 - WR-03 regression: every committed coverage fixture reports the SAME reached count it did before the tightening
  ---
  duration_ms: 8.226981
  type: 'test'
  ...
# Subtest: WR-03 regression: the previously-unseen Phase 11 fixture's census is unchanged at 68 of 100
ok 20 - WR-03 regression: the previously-unseen Phase 11 fixture's census is unchanged at 68 of 100
  ---
  duration_ms: 1.326658
  type: 'test'
  ...
# Subtest: emptiness: a zero-byte, a one-byte and a seedless payload each report zero reached and unreached == range, with no thrown error
ok 21 - emptiness: a zero-byte, a one-byte and a seedless payload each report zero reached and unreached == range, with no thrown error
  ---
  duration_ms: 0.557495
  type: 'test'
  ...
# Subtest: emptiness: an undecodable payload reports an explicit reason rather than throwing or reading as clean (COV-02)
ok 22 - emptiness: an undecodable payload reports an explicit reason rather than throwing or reading as clean (COV-02)
  ---
  duration_ms: 1.130942
  type: 'test'
  ...
# Subtest: a missing or empty project path is the ONE caller-contract violation this module throws for
ok 23 - a missing or empty project path is the ONE caller-contract violation this module throws for
  ---
  duration_ms: 1.490021
  type: 'test'
  ...
# Subtest: idempotency: two consecutive reports over the same fixture are deeply equal once the timestamp is removed
ok 24 - idempotency: two consecutive reports over the same fixture are deeply equal once the timestamp is removed
  ---
  duration_ms: 32.415245
  type: 'test'
  ...
# Subtest: ordering: every offending-address list in every fixture's report is in ascending numeric order
ok 25 - ordering: every offending-address list in every fixture's report is in ascending numeric order
  ---
  duration_ms: 8.180794
  type: 'test'
  ...
# Subtest: normalisation pins the exact rules: ASCII lowercase, backticks and emphasis stripped, whitespace runs collapsed, trimmed
ok 26 - normalisation pins the exact rules: ASCII lowercase, backticks and emphasis stripped, whitespace runs collapsed, trimmed
  ---
  duration_ms: 0.478045
  type: 'test'
  ...
# Subtest: two identical normalised comments at different addresses count as ONE distinct comment
ok 27 - two identical normalised comments at different addresses count as ONE distinct comment
  ---
  duration_ms: 0.490923
  type: 'test'
  ...
# Subtest: a zero-comment project reports a NULL distinct-comment ratio with a zero commented-address count, never a division
ok 28 - a zero-comment project reports a NULL distinct-comment ratio with a zero commented-address count, never a division
  ---
  duration_ms: 0.481497
  type: 'test'
  ...
# Subtest: a comment equal to a banned-generic entry after normalisation never counts as documentation
ok 29 - a comment equal to a banned-generic entry after normalisation never counts as documentation
  ---
  duration_ms: 0.424786
  type: 'test'
  ...
# Subtest: a near-miss confidence token is reported as a measured defect, never thrown and never degraded to ungraded
ok 30 - a near-miss confidence token is reported as a measured defect, never thrown and never degraded to ungraded
  ---
  duration_ms: 0.55015
  type: 'test'
  ...
# Subtest: BANNED_GENERIC_COMMENTS is a named, non-empty set with at least five entries
ok 31 - BANNED_GENERIC_COMMENTS is a named, non-empty set with at least five entries
  ---
  duration_ms: 0.413067
  type: 'test'
  ...
# Subtest: AUTO_NAME_PREFIX_RE deliberately excludes the prefix upstream shares between predefined and user-defined label types
ok 32 - AUTO_NAME_PREFIX_RE deliberately excludes the prefix upstream shares between predefined and user-defined label types
  ---
  duration_ms: 0.397835
  type: 'test'
  ...
# Subtest: the cross-reference rule engages at strictly MORE THAN ONE caller, and not at one
ok 33 - the cross-reference rule engages at strictly MORE THAN ONE caller, and not at one
  ---
  duration_ms: 0.85255
  type: 'test'
  ...
# Subtest: ANCHORING: a colliding longer hex never satisfies the multi-caller rule -- NC4 plus $8106 is still undocumented, and the well-documented control is still clean
ok 34 - ANCHORING: a colliding longer hex never satisfies the multi-caller rule -- NC4 plus $8106 is still undocumented, and the well-documented control is still clean
  ---
  duration_ms: 2.92122
  type: 'test'
  ...
# Subtest: ANCHORING: a caller's label name satisfies the rule only on an identifier boundary
ok 35 - ANCHORING: a caller's label name satisfies the rule only on an identifier boundary
  ---
  duration_ms: 0.978589
  type: 'test'
  ...
# Subtest: WR-13: a caller's label name counts only when the comment USES it as a reference -- an ordinary English word in ordinary prose names no caller
ok 36 - WR-13: a caller's label name counts only when the comment USES it as a reference -- an ordinary English word in ordinary prose names no caller
  ---
  duration_ms: 2.86048
  type: 'test'
  ...
# Subtest: WR-13: the fixture-level both-directions statement -- NC5 stays CLEAN and NC4 is still caught by `reproducibility`
ok 37 - WR-13: the fixture-level both-directions statement -- NC5 stays CLEAN and NC4 is still caught by `reproducibility`
  ---
  duration_ms: 2.082947
  type: 'test'
  ...
# Subtest: every reported count is a count of the deduped list printed beside it
ok 38 - every reported count is a count of the deduped list printed beside it
  ---
  duration_ms: 7.192577
  type: 'test'
  ...
# Subtest: two symbols at one address produce a count of one, not two
ok 39 - two symbols at one address produce a count of one, not two
  ---
  duration_ms: 0.748625
  type: 'test'
  ...
# Subtest: the kind figure is over non-System labels only, and reports a null fraction rather than a divide when there are none
ok 40 - the kind figure is over non-System labels only, and reports a null fraction rather than a divide when there are none
  ---
  duration_ms: 0.384645
  type: 'test'
  ...
# Subtest: dispatch class 1: an indirect jump through a ZERO-PAGE vector is found and reported, with a null target
ok 41 - dispatch class 1: an indirect jump through a ZERO-PAGE vector is found and reported, with a null target
  ---
  duration_ms: 0.627413
  type: 'test'
  ...
# Subtest: dispatch class 2: a multi-entry table yields every entry, not the single entry upstream reads
ok 42 - dispatch class 2: a multi-entry table yields every entry, not the single entry upstream reads
  ---
  duration_ms: 0.530753
  type: 'test'
  ...
# Subtest: dispatch class 3: a PROVEN split lo/hi table pair is reconstructed from its two bases
ok 43 - dispatch class 3: a PROVEN split lo/hi table pair is reconstructed from its two bases
  ---
  duration_ms: 0.600372
  type: 'test'
  ...
# Subtest: a PROVEN split table survives an unrelated indexed load between its two halves (WR-15)
ok 44 - a PROVEN split table survives an unrelated indexed load between its two halves (WR-15)
  ---
  duration_ms: 1.093329
  type: 'test'
  ...
# Subtest: only a PROVEN pairing consumes its leading load, and at most one advisory candidate is emitted per leading load
ok 45 - only a PROVEN pairing consumes its leading load, and at most one advisory candidate is emitted per leading load
  ---
  duration_ms: 1.268027
  type: 'test'
  ...
# Subtest: dispatch class 4: the stack-return dispatch idiom is found even though it contains no indirect-jump opcode
ok 46 - dispatch class 4: the stack-return dispatch idiom is found even though it contains no indirect-jump opcode
  ---
  duration_ms: 0.948018
  type: 'test'
  ...
# Subtest: dispatch class 4 DECLINES a pha/pha/rts window whose two loads use different index registers
ok 47 - dispatch class 4 DECLINES a pha/pha/rts window whose two loads use different index registers
  ---
  duration_ms: 3.157541
  type: 'test'
  ...
# Subtest: dispatch class 4 DECLINES a window whose reconstructed entry point does not decode as a legal instruction
ok 48 - dispatch class 4 DECLINES a window whose reconstructed entry point does not decode as a legal instruction
  ---
  duration_ms: 0.87709
  type: 'test'
  ...
# Subtest: dispatch class 3 DECLINES an ordinary two-table indexed read loop
ok 49 - dispatch class 3 DECLINES an ordinary two-table indexed read loop
  ---
  duration_ms: 0.631747
  type: 'test'
  ...
# Subtest: an ordinary indexed copy loop does not inflate the census over its immediate twin
ok 50 - an ordinary indexed copy loop does not inflate the census over its immediate twin
  ---
  duration_ms: 1.066204
  type: 'test'
  ...
# Subtest: the class-4 stack-return idiom is not also reported as a class-3 split table
ok 51 - the class-4 stack-return idiom is not also reported as a class-3 split table
  ---
  duration_ms: 1.186586
  type: 'test'
  ...
# Subtest: an advisory split-table candidate never reaches the census
ok 52 - an advisory split-table candidate never reaches the census
  ---
  duration_ms: 0.835278
  type: 'test'
  ...
# Subtest: a census whose origin plus size would leave the 16-bit space is bounded, AND SO IS ITS OWN DISPATCH SUB-REPORT
ok 53 - a census whose origin plus size would leave the 16-bit space is bounded, AND SO IS ITS OWN DISPATCH SUB-REPORT
  ---
  duration_ms: 2.312821
  type: 'test'
  ...
# Subtest: bounded walk: a table whose entries would chain indefinitely reports truncation and terminates (T-19-12)
ok 54 - bounded walk: a table whose entries would chain indefinitely reports truncation and terminates (T-19-12)
  ---
  duration_ms: 1.139678
  type: 'test'
  ...
# Subtest: bounded walk: the descent walker honours an explicit step bound and reports truncation rather than looping
ok 55 - bounded walk: the descent walker honours an explicit step bound and reports truncation rather than looping
  ---
  duration_ms: 2.50842
  type: 'test'
  ...
# Subtest: the committed control set is exactly the pinned size, and every fixture carries a project file and a store file
ok 56 - the committed control set is exactly the pinned size, and every fixture carries a project file and a store file
  ---
  duration_ms: 2.237665
  type: 'test'
  ...
# Subtest: control FP1 (fp1-indexed-copy-loop): produces a non-clean result
ok 57 - control FP1 (fp1-indexed-copy-loop): produces a non-clean result
  ---
  duration_ms: 1.243642
  type: 'test'
  ...
# Subtest: control FP1b (fp1b-immediate-copy-loop): produces a non-clean result
ok 58 - control FP1b (fp1b-immediate-copy-loop): produces a non-clean result
  ---
  duration_ms: 0.975233
  type: 'test'
  ...
# Subtest: control FP2 (fp2-zeropage-data-pointer): produces a non-clean result
ok 59 - control FP2 (fp2-zeropage-data-pointer): produces a non-clean result
  ---
  duration_ms: 0.974854
  type: 'test'
  ...
# Subtest: control FP2b (fp2b-immediate-data-pointer): produces a non-clean result
ok 60 - control FP2b (fp2b-immediate-data-pointer): produces a non-clean result
  ---
  duration_ms: 1.150736
  type: 'test'
  ...
# Subtest: control FP3 (fp3-unlinked-push-idiom): produces a non-clean result
ok 61 - control FP3 (fp3-unlinked-push-idiom): produces a non-clean result
  ---
  duration_ms: 1.037891
  type: 'test'
  ...
# Subtest: control FP3b (fp3b-immediate-push-idiom): produces a non-clean result
ok 62 - control FP3b (fp3b-immediate-push-idiom): produces a non-clean result
  ---
  duration_ms: 1.000327
  type: 'test'
  ...
# Subtest: control NC1 (nc1-all-auto): produces a non-clean result naming labels
ok 63 - control NC1 (nc1-all-auto): produces a non-clean result naming labels
  ---
  duration_ms: 1.447279
  type: 'test'
  ...
# Subtest: control NC1b (nc1b-auto-renamed-in-place): produces a non-clean result naming labels
ok 64 - control NC1b (nc1b-auto-renamed-in-place): produces a non-clean result naming labels
  ---
  duration_ms: 1.215127
  type: 'test'
  ...
# Subtest: control NC2 (nc2-generic-comments): produces a non-clean result naming commentVacuity
ok 65 - control NC2 (nc2-generic-comments): produces a non-clean result naming commentVacuity
  ---
  duration_ms: 1.175324
  type: 'test'
  ...
# Subtest: control NC3 (nc3-all-data-blocks): produces a non-clean result naming divergence
ok 66 - control NC3 (nc3-all-data-blocks): produces a non-clean result naming divergence
  ---
  duration_ms: 1.150732
  type: 'test'
  ...
# Subtest: control NC4 (nc4-multi-caller-unnamed): produces a non-clean result naming reproducibility
ok 67 - control NC4 (nc4-multi-caller-unnamed): produces a non-clean result naming reproducibility
  ---
  duration_ms: 1.137449
  type: 'test'
  ...
# Subtest: control NC5 (nc5-well-documented): produces a CLEAN result
ok 68 - control NC5 (nc5-well-documented): produces a CLEAN result
  ---
  duration_ms: 1.101503
  type: 'test'
  ...
# Subtest: NON-VACUITY: the well-documented control passes, so the instrument is not merely a machine that fails everything
ok 69 - NON-VACUITY: the well-documented control passes, so the instrument is not merely a machine that fails everything
  ---
  duration_ms: 1.295153
  type: 'test'
  ...
# Subtest: NC1b earns its place: the kind figure alone would pass the auto-renamed-in-place control, the name figure catches it
ok 70 - NC1b earns its place: the kind figure alone would pass the auto-renamed-in-place control, the name figure catches it
  ---
  duration_ms: 1.292946
  type: 'test'
  ...
# Subtest: NC3 earns its place: the census does not move by one byte under a mass block-type set, only the divergence does
ok 71 - NC3 earns its place: the census does not move by one byte under a mass block-type set, only the divergence does
  ---
  duration_ms: 2.002184
  type: 'test'
  ...
# Subtest: a false-positive control fixture is committed for the census, and the census declines to inflate on it
ok 72 - a false-positive control fixture is committed for the census, and the census declines to inflate on it
  ---
  duration_ms: 2.027659
  type: 'test'
  ...
# Subtest: FP1b earns its place: without a committed twin, FP1's census could only be compared against a remembered number
ok 73 - FP1b earns its place: without a committed twin, FP1's census could only be compared against a remembered number
  ---
  duration_ms: 1.77634
  type: 'test'
  ...
# Subtest: a zero-page vector that is BUILT and then read through as data is not dispatch context, and the census does not inflate on it
ok 74 - a zero-page vector that is BUILT and then read through as data is not dispatch context, and the census does not inflate on it
  ---
  duration_ms: 2.18016
  type: 'test'
  ...
# Subtest: FP2b earns its place: without a committed twin, the interior control's census could only be compared against a remembered number
ok 75 - FP2b earns its place: without a committed twin, the interior control's census could only be compared against a remembered number
  ---
  duration_ms: 2.721859
  type: 'test'
  ...
# Subtest: a push idiom that pushes bytes the two paired loads never supplied is not dispatch context, and the census does not inflate on it
ok 76 - a push idiom that pushes bytes the two paired loads never supplied is not dispatch context, and the census does not inflate on it
  ---
  duration_ms: 2.365491
  type: 'test'
  ...
# Subtest: the tightened class-3 push-idiom branch is LIVE: a payload whose two paired loads each push what they loaded is still PROVEN
ok 77 - the tightened class-3 push-idiom branch is LIVE: a payload whose two paired loads each push what they loaded is still PROVEN
  ---
  duration_ms: 1.247632
  type: 'test'
  ...
# Subtest: a jump through a vector the pairing's own two loads never wrote to is not dispatch context, and the census does not inflate on it
ok 78 - a jump through a vector the pairing's own two loads never wrote to is not dispatch context, and the census does not inflate on it
  ---
  duration_ms: 2.025254
  type: 'test'
  ...
# Subtest: the tightened zero-page-vector branch is LIVE: the one-byte-different twin whose jump names the pairing's OWN vector is still PROVEN
ok 79 - the tightened zero-page-vector branch is LIVE: the one-byte-different twin whose jump names the pairing's OWN vector is still PROVEN
  ---
  duration_ms: 1.706325
  type: 'test'
  ...
# Subtest: the reachability matrix is exactly the cross product of the declared shapes and the declared routes
ok 80 - the reachability matrix is exactly the cross product of the declared shapes and the declared routes
  ---
  duration_ms: 0.713772
  type: 'test'
  ...
# Subtest: reachability on a route that CONSULTS the shared gate is DERIVED, not declared
ok 81 - reachability on a route that CONSULTS the shared gate is DERIVED, not declared
  ---
  duration_ms: 0.550029
  type: 'test'
  ...
# Subtest: every gate-interior declaration is mechanically TRUE, not a claim in a table
ok 82 - every gate-interior declaration is mechanically TRUE, not a claim in a table
  ---
  duration_ms: 7.299821
  type: 'test'
  ...
# Subtest: a control DECLARED as positive is actually ACCEPTED by the instrument
ok 83 - a control DECLARED as positive is actually ACCEPTED by the instrument
  ---
  duration_ms: 1.603285
  type: 'test'
  ...
# Subtest: every REACHABLE (shape, route) pair is claimed by a negative interior declaration
ok 84 - every REACHABLE (shape, route) pair is claimed by a negative interior declaration
  ---
  duration_ms: 0.84933
  type: 'test'
  ...
# Subtest: every REACHABLE pair's negative controls are confirmed INSIDE it by the witness
ok 85 - every REACHABLE pair's negative controls are confirmed INSIDE it by the witness
  ---
  duration_ms: 1.93257
  type: 'test'
  ...
# Subtest: every REACHABLE pair's verdicts are measured in THAT ROUTE'S own collection, never through the aggregate seam
ok 86 - every REACHABLE pair's verdicts are measured in THAT ROUTE'S own collection, never through the aggregate seam
  ---
  duration_ms: 4.811055
  type: 'test'
  ...
# Subtest: every UNREACHABLE (shape, route) pair makes the witness THROW, naming the pair
ok 87 - every UNREACHABLE (shape, route) pair makes the witness THROW, naming the pair
  ---
  duration_ms: 0.636617
  type: 'test'
  ...
# Subtest: NON-VACUITY per route: each reachable pair has a payload inside it AND a payload outside it
ok 88 - NON-VACUITY per route: each reachable pair has a payload inside it AND a payload outside it
  ---
  duration_ms: 2.235649
  type: 'test'
  ...
# Subtest: NON-VACUITY: the witness DECLINES an outside-bracketing payload offered as the zero-page vector shape's interior control
ok 89 - NON-VACUITY: the witness DECLINES an outside-bracketing payload offered as the zero-page vector shape's interior control
  ---
  duration_ms: 1.161426
  type: 'test'
  ...
# Subtest: the window-edge twin is OUTSIDE the class-3 push-idiom route while FP3 is INSIDE it, so the interior predicate is not satisfied by everything
ok 90 - the window-edge twin is OUTSIDE the class-3 push-idiom route while FP3 is INSIDE it, so the interior predicate is not satisfied by everything
  ---
  duration_ms: 1.226265
  type: 'test'
  ...
# Subtest: minting a dispatch shape id without an interior predicate THROWS, naming the id
ok 91 - minting a dispatch shape id without an interior predicate THROWS, naming the id
  ---
  duration_ms: 0.413896
  type: 'test'
  ...
# Subtest: the class-4-only control does NOT claim the class-3 route: the disjunction is gone
ok 92 - the class-4-only control does NOT claim the class-3 route: the disjunction is gone
  ---
  duration_ms: 0.342133
  type: 'test'
  ...
# Subtest: FP3 is interior to the class-3 route and OUTSIDE the class-4 one, so the two routes are genuinely distinguished
ok 93 - FP3 is interior to the class-3 route and OUTSIDE the class-4 one, so the two routes are genuinely distinguished
  ---
  duration_ms: 0.718078
  type: 'test'
  ...
# Subtest: asking the witness about an UNREACHABLE (shape, route) pair THROWS, naming both
ok 94 - asking the witness about an UNREACHABLE (shape, route) pair THROWS, naming both
  ---
  duration_ms: 0.379777
  type: 'test'
  ...
# Subtest: minting a ROUTE nobody declared THROWS, naming the route
ok 95 - minting a ROUTE nobody declared THROWS, naming the route
  ---
  duration_ms: 0.960088
  type: 'test'
  ...
# Subtest: every declaration row's route is a declared one, and only an OUTSIDE row may carry a null route
ok 96 - every declaration row's route is a declared one, and only an OUTSIDE row may carry a null route
  ---
  duration_ms: 0.752426
  type: 'test'
  ...
# Subtest: the witness is PURE over its four arguments: two calls on one payload return the same answer
ok 97 - the witness is PURE over its four arguments: two calls on one payload return the same answer
  ---
  duration_ms: 1.033712
  type: 'test'
  ...
# Subtest: the declared shape count equals the number of true-returning sites in hasDispatchContext()'s own source
ok 98 - the declared shape count equals the number of true-returning sites in hasDispatchContext()'s own source
  ---
  duration_ms: 4.560598
  type: 'test'
  ...
# Subtest: functionBodyFromSource() THROWS naming the signature when the function it is asked for does not exist
ok 99 - functionBodyFromSource() THROWS naming the signature when the function it is asked for does not exist
  ---
  duration_ms: 1.65268
  type: 'test'
  ...
# Subtest: EVERY true-returning site of hasDispatchContext() consults the PAIRING under test, not merely the window
ok 100 - EVERY true-returning site of hasDispatchContext() consults the PAIRING under test, not merely the window
  ---
  duration_ms: 2.345701
  type: 'test'
  ...
# Subtest: PIN 1: the number of hasDispatchContext() CALL SITES equals the number of routes that consult the shared gate
ok 101 - PIN 1: the number of hasDispatchContext() CALL SITES equals the number of routes that consult the shared gate
  ---
  duration_ms: 13.529854
  type: 'test'
  ...
# Subtest: PIN 2: each route publishes from exactly ONE site inside scanIndirectDispatch(), and the sites total the route count
ok 102 - PIN 2: each route publishes from exactly ONE site inside scanIndirectDispatch(), and the sites total the route count
  ---
  duration_ms: 2.058806
  type: 'test'
  ...
# Subtest: PIN 3: the seam's own sources are exactly PROVEN_TARGET_SOURCES, and every route publishes into one of them
ok 103 - PIN 3: the seam's own sources are exactly PROVEN_TARGET_SOURCES, and every route publishes into one of them
  ---
  duration_ms: 0.983182
  type: 'test'
  ...
# Subtest: PIN 4: the class-4 publication site PRECEDES the shared gate's only call site, and no call precedes it
ok 104 - PIN 4: the class-4 publication site PRECEDES the shared gate's only call site, and no call precedes it
  ---
  duration_ms: 1.94276
  type: 'test'
  ...
# Subtest: PIN 5: the decodability predicate is DECLARED exactly once and CALLED from exactly three sites
ok 105 - PIN 5: the decodability predicate is DECLARED exactly once and CALLED from exactly three sites
  ---
  duration_ms: 3.289774
  type: 'test'
  ...
# Subtest: PIN 6: the three call sites are the descent, the linear sweep and the entry-point gate -- and nothing else
ok 106 - PIN 6: the three call sites are the descent, the linear sweep and the entry-point gate -- and nothing else
  ---
  duration_ms: 1.531985
  type: 'test'
  ...
# Subtest: PIN 7: the decoder's illegal flag is READ at exactly one site in the module, inside the predicate
ok 107 - PIN 7: the decoder's illegal flag is READ at exactly one site in the module, inside the predicate
  ---
  duration_ms: 1.775596
  type: 'test'
  ...
# Subtest: PIN 8: the descent consults the predicate BEFORE the loop that marks class zero
ok 108 - PIN 8: the descent consults the predicate BEFORE the loop that marks class zero
  ---
  duration_ms: 0.648405
  type: 'test'
  ...
# Subtest: the previously-unseen Phase 11 fixture -- authored for a different phase, never used to write these rules -- produces a well-formed report
ok 109 - the previously-unseen Phase 11 fixture -- authored for a different phase, never used to write these rules -- produces a well-formed report
  ---
  duration_ms: 0.718808
  type: 'test'
  ...
# Subtest: the coverage module contains no file-write call, no project-save call and no live-session import
ok 110 - the coverage module contains no file-write call, no project-save call and no live-session import
  ---
  duration_ms: 1.209888
  type: 'test'
  ...
# Subtest: ANSWER.sha256 is exactly 64 lowercase hex characters
ok 111 - ANSWER.sha256 is exactly 64 lowercase hex characters
  ---
  duration_ms: 0.448131
  type: 'test'
  ...
# Subtest: ANSWER.sha256 matches the sha256 recomputed from ANSWER.md's own canonical line (T-19-SEAL-DRIFT)
ok 112 - ANSWER.sha256 matches the sha256 recomputed from ANSWER.md's own canonical line (T-19-SEAL-DRIFT)
  ---
  duration_ms: 0.987143
  type: 'test'
  ...
# Subtest: both canonical lines match QUESTION.md's own grammar
ok 113 - both canonical lines match QUESTION.md's own grammar
  ---
  duration_ms: 0.612034
  type: 'test'
  ...
# Subtest: QUESTION.md does not contain either canonical answer line, nor any of its compound field assignments (T-19-LEAK)
ok 114 - QUESTION.md does not contain either canonical answer line, nor any of its compound field assignments (T-19-LEAK)
  ---
  duration_ms: 0.267019
  type: 'test'
  ...
# Subtest: RE-DERIVED-ANSWER.md's canonical line hashes to the sealed ANSWER.sha256, and a missing or empty fence FAILS rather than skips (T-19-RETROFIT / T-19-VACUOUS-CHECK)
ok 115 - RE-DERIVED-ANSWER.md's canonical line hashes to the sealed ANSWER.sha256, and a missing or empty fence FAILS rather than skips (T-19-RETROFIT / T-19-VACUOUS-CHECK)
  ---
  duration_ms: 0.204226
  type: 'test'
  ...
# Subtest: LIVE non-vacuity: both routes are recomputed from the committed fixture and both reproduce the sealed line
ok 116 - LIVE non-vacuity: both routes are recomputed from the committed fixture and both reproduce the sealed line
  ---
  duration_ms: 1.381881
  type: 'test'
  ...
# Subtest: CR-05 (A): a real .prg is censused -- payload decoded, origin from its own load address, non-zero byte count
ok 117 - CR-05 (A): a real .prg is censused -- payload decoded, origin from its own load address, non-zero byte count
  ---
  duration_ms: 1.516707
  type: 'test'
  ...
# Subtest: CR-05 (B): an exactly-65536-byte flat capture with a .raw extension decodes at origin 0
ok 118 - CR-05 (B): an exactly-65536-byte flat capture with a .raw extension decodes at origin 0
  ---
  duration_ms: 226.979004
  type: 'test'
  ...
# Subtest: CR-05 (C, WR-07): a SHORT flat .raw is refused BY NAME, never parsed as a load address plus payload
ok 119 - CR-05 (C, WR-07): a SHORT flat .raw is refused BY NAME, never parsed as a load address plus payload
  ---
  duration_ms: 1.251325
  type: 'test'
  ...
# Subtest: CR-05 (D): the retired JSON project form still loads, so an existing project file is not broken
ok 120 - CR-05 (D): the retired JSON project form still loads, so an existing project file is not broken
  ---
  duration_ms: 1.352039
  type: 'test'
  ...
# Subtest: CR-05 (E, agreement): loadProjectImage and anno-tools' loadImage answer identically for one .prg and one flat capture
ok 121 - CR-05 (E, agreement): loadProjectImage and anno-tools' loadImage answer identically for one .prg and one flat capture
  ---
  duration_ms: 11.319747
  type: 'test'
  ...
# Subtest: CR-05 (F, one decode two callers): anno-cli.ts's cross-reference byte source delegates to this loader rather than re-parsing
ok 122 - CR-05 (F, one decode two callers): anno-cli.ts's cross-reference byte source delegates to this loader rather than re-parsing
  ---
  duration_ms: 0.702627
  type: 'test'
  ...
# Subtest: CR-05 (F, behavioural): a file the loader refuses yields BOTH no usable image and payloadDecoded:false in one run
ok 123 - CR-05 (F, behavioural): a file the loader refuses yields BOTH no usable image and payloadDecoded:false in one run
  ---
  duration_ms: 1.45169
  type: 'test'
  ...
# Subtest: CR-05 (G, read-only and re-runnable): two runs over one store and image give the same figures and leave the store byte-identical
ok 124 - CR-05 (G, read-only and re-runnable): two runs over one store and image give the same figures and leave the store byte-identical
  ---
  duration_ms: 4.812214
  type: 'test'
  ...
# Subtest: CR-05 (H, the T-29-14-01 symmetry): a non-JSON file's reason names the path and the failure but discloses NONE of its bytes
ok 125 - CR-05 (H, the T-29-14-01 symmetry): a non-JSON file's reason names the path and the failure but discloses NONE of its bytes
  ---
  duration_ms: 1.833808
  type: 'test'
  ...
# Subtest: CR-05 (H, control): where the runtime names a parse POSITION the reason carries the offset -- a position is not content
ok 126 - CR-05 (H, control): where the runtime names a parse POSITION the reason carries the offset -- a position is not content
  ---
  duration_ms: 1.530487
  type: 'test'
  ...
1..126
# tests 126
# suites 0
# pass 125
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1485.46538
```

## `src/mcp/vice/anno-d64.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test anno-d64.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# Subtest: listEntries: returns both entry names, types, and starting track/sector
ok 1 - listEntries: returns both entry names, types, and starting track/sector
  ---
  duration_ms: 6.685153
  type: 'test'
  ...
# Subtest: extractEntry: returns exactly the written payload bytes, including the load address, honouring the final sector's used-byte count
ok 2 - extractEntry: returns exactly the written payload bytes, including the load address, honouring the final sector's used-byte count
  ---
  duration_ms: 3.138132
  type: 'test'
  ...
# Subtest: extractEntry: case-insensitive name match returns the same bytes
ok 3 - extractEntry: case-insensitive name match returns the same bytes
  ---
  duration_ms: 1.231091
  type: 'test'
  ...
# Subtest: extractEntry: unknown name throws, naming both the requested name and the available entries
ok 4 - extractEntry: unknown name throws, naming both the requested name and the available entries
  ---
  duration_ms: 1.75822
  type: 'test'
  ...
# Subtest: extractEntry: an ambiguous name (two entries sharing it) throws naming the ambiguity and returns nothing
ok 5 - extractEntry: an ambiguous name (two entries sharing it) throws naming the ambiguity and returns nothing
  ---
  duration_ms: 0.991654
  type: 'test'
  ...
# Subtest: extractEntry: a self-referential (corrupt) chain throws naming the revisited track/sector rather than looping
ok 6 - extractEntry: a self-referential (corrupt) chain throws naming the revisited track/sector rather than looping
  ---
  duration_ms: 0.634504
  type: 'test'
  ...
# Subtest: extractEntry: an out-of-image pointer throws naming the offending pointer rather than reading past the buffer
ok 7 - extractEntry: an out-of-image pointer throws naming the offending pointer rather than reading past the buffer
  ---
  duration_ms: 0.702181
  type: 'test'
  ...
# Subtest: assertPlainImage: throws for the error-info-byte variant length (175531 bytes), with the actual length named
ok 8 - assertPlainImage: throws for the error-info-byte variant length (175531 bytes), with the actual length named
  ---
  duration_ms: 0.4948
  type: 'test'
  ...
# Subtest: assertPlainImage: passes for exactly 174848 bytes
ok 9 - assertPlainImage: passes for exactly 174848 bytes
  ---
  duration_ms: 1.013788
  type: 'test'
  ...
# Subtest: extractEntry: a valid image truncated into the file's own sector throws naming the sector and the actual image length (WR-05)
ok 10 - extractEntry: a valid image truncated into the file's own sector throws naming the sector and the actual image length (WR-05)
  ---
  duration_ms: 1.477183
  type: 'test'
  ...
# Subtest: listEntries/extractEntry: a $00-padded directory name round-trips through --entry (WR-06)
ok 11 - listEntries/extractEntry: a $00-padded directory name round-trips through --entry (WR-06)
  ---
  duration_ms: 0.812278
  type: 'test'
  ...
# Subtest: extractEntry: a final sector reporting usedByte 0 throws naming the sector rather than yielding a zero-length payload (WR-05)
ok 12 - extractEntry: a final sector reporting usedByte 0 throws naming the sector rather than yielding a zero-length payload (WR-05)
  ---
  duration_ms: 0.639774
  type: 'test'
  ...
# Subtest: extractEntry: a hand-written final sector (usedByte 0x04, no fixture helper) returns exactly the three literal payload bytes it names (WR-12)
ok 13 - extractEntry: a hand-written final sector (usedByte 0x04, no fixture helper) returns exactly the three literal payload bytes it names (WR-12)
  ---
  duration_ms: 0.479836
  type: 'test'
  ...
# Subtest: extractEntry: a hand-written final sector at the one-payload-byte boundary (usedByte 0x02, no fixture helper) returns exactly that one byte (WR-12)
ok 14 - extractEntry: a hand-written final sector at the one-payload-byte boundary (usedByte 0x02, no fixture helper) returns exactly that one byte (WR-12)
  ---
  duration_ms: 0.62052
  type: 'test'
  ...
# Subtest: composition: extracted bytes feed parsePrg(), and the recovered origin matches the fixture's load address
ok 15 - composition: extracted bytes feed parsePrg(), and the recovered origin matches the fixture's load address
  ---
  duration_ms: 0.89009
  type: 'test'
  ...
# Subtest: sectorsPerTrack covers all four standard 1541 zones
ok 16 - sectorsPerTrack covers all four standard 1541 zones
  ---
  duration_ms: 0.252213
  type: 'test'
  ...
1..16
# tests 16
# suites 0
# pass 16
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 254.525288
```

### Planted run

- **Plant:** `src/mcp/vice/anno-d64.ts`: `if (image.length !== 174848) {` → `if (image.length !== 174847) {`
- **Planted command:** `node --test anno-d64.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# Subtest: listEntries: returns both entry names, types, and starting track/sector
ok 1 - listEntries: returns both entry names, types, and starting track/sector
  ---
  duration_ms: 7.335349
  type: 'test'
  ...
# Subtest: extractEntry: returns exactly the written payload bytes, including the load address, honouring the final sector's used-byte count
ok 2 - extractEntry: returns exactly the written payload bytes, including the load address, honouring the final sector's used-byte count
  ---
  duration_ms: 3.239166
  type: 'test'
  ...
# Subtest: extractEntry: case-insensitive name match returns the same bytes
ok 3 - extractEntry: case-insensitive name match returns the same bytes
  ---
  duration_ms: 1.183745
  type: 'test'
  ...
# Subtest: extractEntry: unknown name throws, naming both the requested name and the available entries
ok 4 - extractEntry: unknown name throws, naming both the requested name and the available entries
  ---
  duration_ms: 2.101146
  type: 'test'
  ...
# Subtest: extractEntry: an ambiguous name (two entries sharing it) throws naming the ambiguity and returns nothing
ok 5 - extractEntry: an ambiguous name (two entries sharing it) throws naming the ambiguity and returns nothing
  ---
  duration_ms: 1.101237
  type: 'test'
  ...
# Subtest: extractEntry: a self-referential (corrupt) chain throws naming the revisited track/sector rather than looping
ok 6 - extractEntry: a self-referential (corrupt) chain throws naming the revisited track/sector rather than looping
  ---
  duration_ms: 0.635461
  type: 'test'
  ...
# Subtest: extractEntry: an out-of-image pointer throws naming the offending pointer rather than reading past the buffer
ok 7 - extractEntry: an out-of-image pointer throws naming the offending pointer rather than reading past the buffer
  ---
  duration_ms: 0.781951
  type: 'test'
  ...
# Subtest: assertPlainImage: throws for the error-info-byte variant length (175531 bytes), with the actual length named
ok 8 - assertPlainImage: throws for the error-info-byte variant length (175531 bytes), with the actual length named
  ---
  duration_ms: 0.561434
  type: 'test'
  ...
# Subtest: assertPlainImage: passes for exactly 174848 bytes
not ok 9 - assertPlainImage: passes for exactly 174848 bytes
  ---
  duration_ms: 2.203051
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-d64.test.ts:191:1'
  failureType: 'testCodeFailure'
  error: |-
    Got unwanted exception.
    Actual message: "assertPlainImage: expected a plain 174848-byte, 35-track .d64 image with no error-info bytes, got 174848 bytes"
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  actual:
  error: 'assertPlainImage: expected a plain 174848-byte, 35-track .d64 image with no error-info bytes, got 174848 bytes'
  stack: |-
    assertPlainImage (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-d64.ts:306:11)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-d64.test.ts:192:29
    getActual (node:assert:609:5)
    Function.doesNotThrow (node:assert:777:32)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-d64.test.ts:192:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
  operator: 'doesNotThrow'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-d64.test.ts:192:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: extractEntry: a valid image truncated into the file's own sector throws naming the sector and the actual image length (WR-05)
ok 10 - extractEntry: a valid image truncated into the file's own sector throws naming the sector and the actual image length (WR-05)
  ---
  duration_ms: 1.693027
  type: 'test'
  ...
# Subtest: listEntries/extractEntry: a $00-padded directory name round-trips through --entry (WR-06)
ok 11 - listEntries/extractEntry: a $00-padded directory name round-trips through --entry (WR-06)
  ---
  duration_ms: 0.9282
  type: 'test'
  ...
# Subtest: extractEntry: a final sector reporting usedByte 0 throws naming the sector rather than yielding a zero-length payload (WR-05)
ok 12 - extractEntry: a final sector reporting usedByte 0 throws naming the sector rather than yielding a zero-length payload (WR-05)
  ---
  duration_ms: 0.597678
  type: 'test'
  ...
# Subtest: extractEntry: a hand-written final sector (usedByte 0x04, no fixture helper) returns exactly the three literal payload bytes it names (WR-12)
ok 13 - extractEntry: a hand-written final sector (usedByte 0x04, no fixture helper) returns exactly the three literal payload bytes it names (WR-12)
  ---
  duration_ms: 0.487713
  type: 'test'
  ...
# Subtest: extractEntry: a hand-written final sector at the one-payload-byte boundary (usedByte 0x02, no fixture helper) returns exactly that one byte (WR-12)
ok 14 - extractEntry: a hand-written final sector at the one-payload-byte boundary (usedByte 0x02, no fixture helper) returns exactly that one byte (WR-12)
  ---
  duration_ms: 0.623995
  type: 'test'
  ...
# Subtest: composition: extracted bytes feed parsePrg(), and the recovered origin matches the fixture's load address
ok 15 - composition: extracted bytes feed parsePrg(), and the recovered origin matches the fixture's load address
  ---
  duration_ms: 0.680701
  type: 'test'
  ...
# Subtest: sectorsPerTrack covers all four standard 1541 zones
ok 16 - sectorsPerTrack covers all four standard 1541 zones
  ---
  duration_ms: 0.224477
  type: 'test'
  ...
1..16
# tests 16
# suites 0
# pass 15
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 226.138758
```

## `src/mcp/vice/anno-enum-gen.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test anno-enum-gen.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# Subtest: variantNameFor(0xd011, 0x1b) === 'YSCROLL3_ROW25_SCREENON_TEXT' (the pinned criterion-3 target)
ok 1 - variantNameFor(0xd011, 0x1b) === 'YSCROLL3_ROW25_SCREENON_TEXT' (the pinned criterion-3 target)
  ---
  duration_ms: 6.188277
  type: 'test'
  ...
# Subtest: registerKeyFor formats addresses as $XXXX (uppercase, 4-hex-digit)
ok 2 - registerKeyFor formats addresses as $XXXX (uppercase, 4-hex-digit)
  ---
  duration_ms: 0.350962
  type: 'test'
  ...
# Subtest: variantNameFor is injective across all 256 values for $D011
ok 3 - variantNameFor is injective across all 256 values for $D011
  ---
  duration_ms: 2.193512
  type: 'test'
  ...
# Subtest: variantNameFor is injective across all 256 values for $D016
ok 4 - variantNameFor is injective across all 256 values for $D016
  ---
  duration_ms: 2.696318
  type: 'test'
  ...
# Subtest: variantNameFor is injective across all 256 values for $D018
ok 5 - variantNameFor is injective across all 256 values for $D018
  ---
  duration_ms: 1.390069
  type: 'test'
  ...
# Subtest: variantNameFor is injective across all 256 values for $D015
ok 6 - variantNameFor is injective across all 256 values for $D015
  ---
  duration_ms: 1.513822
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier rejects '1BAD', 'has space', 'has-dash', '' and accepts a legal identifier
ok 7 - assertLegalAcmeIdentifier rejects '1BAD', 'has space', 'has-dash', '' and accepts a legal identifier
  ---
  duration_ms: 1.475467
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier rejects a newline-bearing token and a token containing '='
ok 8 - assertLegalAcmeIdentifier rejects a newline-bearing token and a token containing '='
  ---
  duration_ms: 0.421301
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier rejects a reserved 6502 mnemonic, measured against real ACME (LDA)
ok 9 - assertLegalAcmeIdentifier rejects a reserved 6502 mnemonic, measured against real ACME (LDA)
  ---
  duration_ms: 1.4979
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier accepts a bare register letter (A/X/Y), measured NOT reserved against real ACME
ok 10 - assertLegalAcmeIdentifier accepts a bare register letter (A/X/Y), measured NOT reserved against real ACME
  ---
  duration_ms: 0.955931
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier rejects an identifier longer than the length ceiling
ok 11 - assertLegalAcmeIdentifier rejects an identifier longer than the length ceiling
  ---
  duration_ms: 0.529195
  type: 'test'
  ...
# Subtest: sanitizeVariantMap builds the {$hex: name} shape and sanitizes every value
ok 12 - sanitizeVariantMap builds the {$hex: name} shape and sanitizes every value
  ---
  duration_ms: 1.903356
  type: 'test'
  ...
# Subtest: sanitizeVariantMap refuses a bad token before returning anything
ok 13 - sanitizeVariantMap refuses a bad token before returning anything
  ---
  duration_ms: 0.431803
  type: 'test'
  ...
# Subtest: T-11-NAME-INJECT: sanitizeVariantMap refuses the injection shape (newline + '= $00') and returns NOTHING, so a rebuilt installer that calls it first cannot pass the name on
ok 14 - T-11-NAME-INJECT: sanitizeVariantMap refuses the injection shape (newline + '= $00') and returns NOTHING, so a rebuilt installer that calls it first cannot pass the name on
  ---
  duration_ms: 0.500831
  type: 'test'
  ...
# Subtest: pairSearchRows: a store at A+2 pairs with its immediate load; a store at A+3 does not
ok 15 - pairSearchRows: a store at A+2 pairs with its immediate load; a store at A+3 does not
  ---
  duration_ms: 1.234299
  type: 'test'
  ...
# Subtest: pairSearchRows: a store to a register the bit-name table does not know is not counted at all
ok 16 - pairSearchRows: a store to a register the bit-name table does not know is not counted at all
  ---
  duration_ms: 0.399677
  type: 'test'
  ...
# Subtest: pairSearchRows: register matching is case-insensitive on the operand's hex ($d011 and $D011 both pair)
ok 17 - pairSearchRows: register matching is case-insensitive on the operand's hex ($d011 and $D011 both pair)
  ---
  duration_ms: 0.677307
  type: 'test'
  ...
# Subtest: pairSearchRows: an unparsable immediate operand is skipped rather than fatal (D-23's 'a miss costs nothing')
ok 18 - pairSearchRows: an unparsable immediate operand is skipped rather than fatal (D-23's 'a miss costs nothing')
  ---
  duration_ms: 0.480462
  type: 'test'
  ...
# Subtest: pairSearchRows: a pass whose row count EQUALS the requested ceiling is reported as possibly truncated (D-23, no silent caps)
ok 19 - pairSearchRows: a pass whose row count EQUALS the requested ceiling is reported as possibly truncated (D-23, no silent caps)
  ---
  duration_ms: 0.716256
  type: 'test'
  ...
# Subtest: parseImmediateOperand parses hex, decimal and binary immediates, and refuses a non-immediate operand
ok 20 - parseImmediateOperand parses hex, decimal and binary immediates, and refuses a non-immediate operand
  ---
  duration_ms: 0.506146
  type: 'test'
  ...
# Subtest: planEnumsForPairing: two stores of the SAME value to one register produce ONE variant and TWO usages (D-20)
ok 21 - planEnumsForPairing: two stores of the SAME value to one register produce ONE variant and TWO usages (D-20)
  ---
  duration_ms: 0.787791
  type: 'test'
  ...
# Subtest: planEnumsForPairing: two DISTINCT values to one register produce two variants, and never a 256-value table
ok 22 - planEnumsForPairing: two DISTINCT values to one register produce two variants, and never a 256-value table
  ---
  duration_ms: 0.497488
  type: 'test'
  ...
# Subtest: planEnumsForPairing: a usage binds to the lda address, NEVER the store address (measured binding rule)
ok 23 - planEnumsForPairing: a usage binds to the lda address, NEVER the store address (measured binding rule)
  ---
  duration_ms: 0.461867
  type: 'test'
  ...
# Subtest: planEnumsForPairing: two different registers produce two separate enums
ok 24 - planEnumsForPairing: two different registers produce two separate enums
  ---
  duration_ms: 0.601711
  type: 'test'
  ...
# Subtest: buildEnumGenerationReport: the summary lines contain 'truncat' when a pass hit its ceiling, and always carry total/paired/unpaired
ok 25 - buildEnumGenerationReport: the summary lines contain 'truncat' when a pass hit its ceiling, and always carry total/paired/unpaired
  ---
  duration_ms: 0.915309
  type: 'test'
  ...
# Subtest: buildEnumGenerationReport: a run below its ceiling says NOTHING about truncation -- the signal must not be always-on
ok 26 - buildEnumGenerationReport: a run below its ceiling says NOTHING about truncation -- the signal must not be always-on
  ---
  duration_ms: 0.506378
  type: 'test'
  ...
# Subtest: buildEnumGenerationReport: an 'updated' action is reportable, so ANNO-13's re-runnability stays expressible
ok 27 - buildEnumGenerationReport: an 'updated' action is reportable, so ANNO-13's re-runnability stays expressible
  ---
  duration_ms: 0.372422
  type: 'test'
  ...
# Subtest: anno-enum-gen.ts never references the machine-global save_global_enum() route (D-21, zero-count grep)
ok 28 - anno-enum-gen.ts never references the machine-global save_global_enum() route (D-21, zero-count grep)
  ---
  duration_ms: 0.612577
  type: 'test'
  ...
1..28
# tests 28
# suites 0
# pass 28
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 328.038533
```

### Planted run

- **Plant:** `src/mcp/vice/anno-enum-gen.ts`: `return `$${address.toString(16).toUpperCase().padStart(4, "0")}`;` → `return `$${address.toString(16).toUpperCase().padStart(5, "0")}`;`
- **Planted command:** `node --test anno-enum-gen.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# Subtest: variantNameFor(0xd011, 0x1b) === 'YSCROLL3_ROW25_SCREENON_TEXT' (the pinned criterion-3 target)
not ok 1 - variantNameFor(0xd011, 0x1b) === 'YSCROLL3_ROW25_SCREENON_TEXT' (the pinned criterion-3 target)
  ---
  duration_ms: 5.966576
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.test.ts:79:1'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register 0D011 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.ts:190:11)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.test.ts:80:16)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
# Subtest: registerKeyFor formats addresses as $XXXX (uppercase, 4-hex-digit)
not ok 2 - registerKeyFor formats addresses as $XXXX (uppercase, 4-hex-digit)
  ---
  duration_ms: 2.388233
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.test.ts:83:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    
    '0D011' !== '$D011'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: '$D011'
  actual: '0D011'
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.test.ts:84:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
  ...
# Subtest: variantNameFor is injective across all 256 values for $D011
not ok 3 - variantNameFor is injective across all 256 values for $D011
  ---
  duration_ms: 0.412379
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.test.ts:94:3'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register 0D011 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.ts:190:11)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.test.ts:97:20)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: variantNameFor is injective across all 256 values for $D016
not ok 4 - variantNameFor is injective across all 256 values for $D016
  ---
  duration_ms: 0.279833
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.test.ts:94:3'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register 0D016 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.ts:190:11)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.test.ts:97:20)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: variantNameFor is injective across all 256 values for $D018
not ok 5 - variantNameFor is injective across all 256 values for $D018
  ---
  duration_ms: 0.274894
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.test.ts:94:3'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register 0D018 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.ts:190:11)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.test.ts:97:20)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: variantNameFor is injective across all 256 values for $D015
not ok 6 - variantNameFor is injective across all 256 values for $D015
  ---
  duration_ms: 0.261992
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.test.ts:94:3'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register 0D015 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.ts:190:11)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.test.ts:97:20)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: assertLegalAcmeIdentifier rejects '1BAD', 'has space', 'has-dash', '' and accepts a legal identifier
ok 7 - assertLegalAcmeIdentifier rejects '1BAD', 'has space', 'has-dash', '' and accepts a legal identifier
  ---
  duration_ms: 1.647784
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier rejects a newline-bearing token and a token containing '='
ok 8 - assertLegalAcmeIdentifier rejects a newline-bearing token and a token containing '='
  ---
  duration_ms: 0.440793
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier rejects a reserved 6502 mnemonic, measured against real ACME (LDA)
ok 9 - assertLegalAcmeIdentifier rejects a reserved 6502 mnemonic, measured against real ACME (LDA)
  ---
  duration_ms: 1.557191
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier accepts a bare register letter (A/X/Y), measured NOT reserved against real ACME
ok 10 - assertLegalAcmeIdentifier accepts a bare register letter (A/X/Y), measured NOT reserved against real ACME
  ---
  duration_ms: 1.08118
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier rejects an identifier longer than the length ceiling
ok 11 - assertLegalAcmeIdentifier rejects an identifier longer than the length ceiling
  ---
  duration_ms: 0.64034
  type: 'test'
  ...
# Subtest: sanitizeVariantMap builds the {$hex: name} shape and sanitizes every value
ok 12 - sanitizeVariantMap builds the {$hex: name} shape and sanitizes every value
  ---
  duration_ms: 2.05026
  type: 'test'
  ...
# Subtest: sanitizeVariantMap refuses a bad token before returning anything
ok 13 - sanitizeVariantMap refuses a bad token before returning anything
  ---
  duration_ms: 0.532648
  type: 'test'
  ...
# Subtest: T-11-NAME-INJECT: sanitizeVariantMap refuses the injection shape (newline + '= $00') and returns NOTHING, so a rebuilt installer that calls it first cannot pass the name on
ok 14 - T-11-NAME-INJECT: sanitizeVariantMap refuses the injection shape (newline + '= $00') and returns NOTHING, so a rebuilt installer that calls it first cannot pass the name on
  ---
  duration_ms: 0.467248
  type: 'test'
  ...
# Subtest: pairSearchRows: a store at A+2 pairs with its immediate load; a store at A+3 does not
ok 15 - pairSearchRows: a store at A+2 pairs with its immediate load; a store at A+3 does not
  ---
  duration_ms: 1.142263
  type: 'test'
  ...
# Subtest: pairSearchRows: a store to a register the bit-name table does not know is not counted at all
ok 16 - pairSearchRows: a store to a register the bit-name table does not know is not counted at all
  ---
  duration_ms: 0.369295
  type: 'test'
  ...
# Subtest: pairSearchRows: register matching is case-insensitive on the operand's hex ($d011 and $D011 both pair)
ok 17 - pairSearchRows: register matching is case-insensitive on the operand's hex ($d011 and $D011 both pair)
  ---
  duration_ms: 0.435499
  type: 'test'
  ...
# Subtest: pairSearchRows: an unparsable immediate operand is skipped rather than fatal (D-23's 'a miss costs nothing')
ok 18 - pairSearchRows: an unparsable immediate operand is skipped rather than fatal (D-23's 'a miss costs nothing')
  ---
  duration_ms: 0.599224
  type: 'test'
  ...
# Subtest: pairSearchRows: a pass whose row count EQUALS the requested ceiling is reported as possibly truncated (D-23, no silent caps)
ok 19 - pairSearchRows: a pass whose row count EQUALS the requested ceiling is reported as possibly truncated (D-23, no silent caps)
  ---
  duration_ms: 0.447641
  type: 'test'
  ...
# Subtest: parseImmediateOperand parses hex, decimal and binary immediates, and refuses a non-immediate operand
ok 20 - parseImmediateOperand parses hex, decimal and binary immediates, and refuses a non-immediate operand
  ---
  duration_ms: 0.327452
  type: 'test'
  ...
# Subtest: planEnumsForPairing: two stores of the SAME value to one register produce ONE variant and TWO usages (D-20)
not ok 21 - planEnumsForPairing: two stores of the SAME value to one register produce ONE variant and TWO usages (D-20)
  ---
  duration_ms: 0.621385
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.test.ts:242:1'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register 0D011 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.ts:190:11)
    planEnumsForPairing (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.ts:459:27)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.test.ts:247:19)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: planEnumsForPairing: two DISTINCT values to one register produce two variants, and never a 256-value table
not ok 22 - planEnumsForPairing: two DISTINCT values to one register produce two variants, and never a 256-value table
  ---
  duration_ms: 0.382077
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.test.ts:259:1'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register 0D011 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.ts:190:11)
    planEnumsForPairing (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.ts:459:27)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.test.ts:264:19)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: planEnumsForPairing: a usage binds to the lda address, NEVER the store address (measured binding rule)
not ok 23 - planEnumsForPairing: a usage binds to the lda address, NEVER the store address (measured binding rule)
  ---
  duration_ms: 0.489945
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.test.ts:270:1'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register 0D011 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.ts:190:11)
    planEnumsForPairing (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.ts:459:27)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.test.ts:272:19)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: planEnumsForPairing: two different registers produce two separate enums
not ok 24 - planEnumsForPairing: two different registers produce two separate enums
  ---
  duration_ms: 0.369085
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.test.ts:277:1'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register 0D011 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.ts:190:11)
    planEnumsForPairing (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.ts:459:27)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-enum-gen.test.ts:282:19)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: buildEnumGenerationReport: the summary lines contain 'truncat' when a pass hit its ceiling, and always carry total/paired/unpaired
ok 25 - buildEnumGenerationReport: the summary lines contain 'truncat' when a pass hit its ceiling, and always carry total/paired/unpaired
  ---
  duration_ms: 0.895724
  type: 'test'
  ...
# Subtest: buildEnumGenerationReport: a run below its ceiling says NOTHING about truncation -- the signal must not be always-on
ok 26 - buildEnumGenerationReport: a run below its ceiling says NOTHING about truncation -- the signal must not be always-on
  ---
  duration_ms: 0.459623
  type: 'test'
  ...
# Subtest: buildEnumGenerationReport: an 'updated' action is reportable, so ANNO-13's re-runnability stays expressible
ok 27 - buildEnumGenerationReport: an 'updated' action is reportable, so ANNO-13's re-runnability stays expressible
  ---
  duration_ms: 0.3689
  type: 'test'
  ...
# Subtest: anno-enum-gen.ts never references the machine-global save_global_enum() route (D-21, zero-count grep)
ok 28 - anno-enum-gen.ts never references the machine-global save_global_enum() route (D-21, zero-count grep)
  ---
  duration_ms: 1.831636
  type: 'test'
  ...
1..28
# tests 28
# suites 0
# pass 18
# fail 10
# cancelled 0
# skipped 0
# todo 0
# duration_ms 358.71424
```

## CORRECTION — 2026-09-01, gap-closure round 1 (plan 32-14)

**1. Date and provenance.** Written 2026-09-01 during gap-closure round 1 for phase 32,
plan 32-14, closing Gap 3 of `32-VERIFICATION.md`. It concerns the
`src/mcp/vice/anno-enum-gen.test.ts` section immediately above and no other section in
this file.

**2. What was wrong (`CR-02`).** The recorded replacement was not the replacement applied.
`plant()` in `scripts/audit-mutation-harness.mjs` counted occurrences of `find` with
`String.prototype.split`, which is literal, but performed the substitution with
`text.replace(find, replace)` — a replacement **string**, in which `$$`, `$&`, `` $` ``,
`$'`, `$n` and `$<name>` are interpreted. This row's `replace` value carries a doubled
dollar sign, so the pair collapsed to one and the `$` hex sigil was deleted on the way to
disk. The harness therefore mutated
`` return `${address.toString(16).toUpperCase().padStart(5, "0")}`; ``
while recording
`` return `$${address.toString(16).toUpperCase().padStart(5, "0")}`; ``.
Verifier reference: `32-VERIFICATION.md` `gaps[2]`, artifact issue
"`:3889` carries the same non-applied replacement string".

**3. What the raw output BELOW the Plant line is, and why it is left byte-identical.** It is
the output of the **pre-fix** harness, produced under the mutation that was **actually
applied** — the one with the sigil deleted. That is why its failing comparison reads
`'0D011' !== '$D011'`: five characters, no sigil. It is preserved byte-for-byte on purpose.
A dated record is not edited to make an inconsistency disappear; the inconsistency is
disclosed here instead. A reader who notices that the Plant line above does not describe the
mutation that produced the output below is reading the record correctly, and this block is
the explanation.

**4. MEASURED FINDING — no in-place correction was needed, and none was made.** Plan 32-14
authorised exactly one in-place edit: the `replace:` value on this row's Plant line, and
only if the corrected value were the **re-measured** one rather than a retyped one. The row
was re-run with the fixed harness on 2026-09-01 and the value the fixed harness applies is
**byte-identical** to the value already on the Plant line above — because the fix's whole
effect is that the recorded replacement now reaches disk intact. The authorised edit is
therefore a no-op and was not performed: `git diff --numstat` for this file shows **0
deletions**, not the 1 the plan anticipated. Writing the *interpreted* string onto that line
instead would have been a retyped value, which the plan's own prohibition forbids, and would
have been the fact-laundering the `T-32-09` mitigation exists to prevent. The Plant line is
correct as a description of the descriptor and of what the fixed harness does; it was only
ever wrong as a description of what the pre-fix harness did, and item 3 above is the
disclosure of that.

**5. The conclusion is UNCHANGED, cited rather than re-measured.** `32-VERIFICATION.md`
`gaps[2].reason` records, under "IMPORTANT SCOPE LIMIT, MEASURED BY ME RATHER THAN
INFERRED", that the verifier applied the literally-recorded mutation with a replacer
function and ran the guard: exit 1, 10 failures, including the same named assertion
`registerKeyFor formats addresses as $XXXX`. The verifier also re-ran the pre-fix harness on
this row in the main checkout and it reproduced the recorded red exactly — same two failing
subtests, same `'0D011' !== '$D011'`, same green control. The guard is non-vacuous under
either mutation. This is a correction to a record, **not** a reversal of a verdict, and it is
cited here rather than re-measured.

**6. Where the re-measured post-fix run lives.** `evidence/32-gap3-harness-correction.md`,
in this same directory. Planted run exit status `1`; unplanted control exit status `0`;
guard `node --test anno-enum-gen.test.ts` in `src/mcp/vice`. Its excerpt differs from the one
above exactly as predicted: with the recorded replacement reaching disk intact, the guard now
fails on the padding width **with** the sigil present — `'$0D011' !== '$D011'`, six
characters — rather than on a missing sigil.

**7. Scope: 1 of 61 rows was affected; the other 60 were deliberately not re-run.** The
verifier audited the whole registry and found this the only row whose recorded mutation
diverged from the applied one; the two other `$`-carrying rows (`${verb}`, `$/`) are
unaffected. Re-running the other 60 would rewrite 60 machine-captured records for no finding
— and every one of them is already covered by `node scripts/check-guard-fates.mjs`, which is
green at 61 rows both before and after this correction, with the same measured line. No
`*-SUMMARY.md` and no `32-VERIFICATION.md` was touched, and no other row in this file was
reordered, renumbered, retitled or edited.


## `src/mcp/vice/anno-memmap-render.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test anno-memmap-render.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# (node:256549) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: parseProvenanceHeader accepts a fully-filled valid header
ok 1 - parseProvenanceHeader accepts a fully-filled valid header
  ---
  duration_ms: 3.970977
  type: 'test'
  ...
# Subtest: parseProvenanceHeader accepts an optional rasterPositions array
ok 2 - parseProvenanceHeader accepts an optional rasterPositions array
  ---
  duration_ms: 2.036283
  type: 'test'
  ...
# Subtest: parseProvenanceHeader({}) throws listing ALL missing required keys in one message
ok 3 - parseProvenanceHeader({}) throws listing ALL missing required keys in one message
  ---
  duration_ms: 2.120833
  type: 'test'
  ...
# Subtest: parseProvenanceHeader refuses a template-placeholder captureSha256 and videoStandard, naming both
ok 4 - parseProvenanceHeader refuses a template-placeholder captureSha256 and videoStandard, naming both
  ---
  duration_ms: 0.861236
  type: 'test'
  ...
# Subtest: parseProvenanceHeader refuses a bad hash length
ok 5 - parseProvenanceHeader refuses a bad hash length
  ---
  duration_ms: 0.90262
  type: 'test'
  ...
# Subtest: parseProvenanceHeader refuses a videoStandard value that is neither a placeholder nor PAL/NTSC
ok 6 - parseProvenanceHeader refuses a videoStandard value that is neither a placeholder nor PAL/NTSC
  ---
  duration_ms: 0.727342
  type: 'test'
  ...
# Subtest: parseProvenanceHeader refuses a malformed rasterPositions
ok 7 - parseProvenanceHeader refuses a malformed rasterPositions
  ---
  duration_ms: 0.798466
  type: 'test'
  ...
# Subtest: parseProvenanceHeader refuses a non-object payload
ok 8 - parseProvenanceHeader refuses a non-object payload
  ---
  duration_ms: 0.675747
  type: 'test'
  ...
# Subtest: the renderer's layout is embedded in TypeScript, never read from the recon skill's template at runtime
ok 9 - the renderer's layout is embedded in TypeScript, never read from the recon skill's template at runtime
  ---
  duration_ms: 1.354565
  type: 'test'
  ...
# Subtest: escapeMarkdownCell escapes a pipe character
ok 10 - escapeMarkdownCell escapes a pipe character
  ---
  duration_ms: 1.205486
  type: 'test'
  ...
# Subtest: escapeMarkdownCell collapses \\n, \\r\\n and a bare \\r into <br>
ok 11 - escapeMarkdownCell collapses \\n, \\r\\n and a bare \\r into <br>
  ---
  duration_ms: 0.606171
  type: 'test'
  ...
# Subtest: escapeMarkdownCell returns a plain string unchanged
ok 12 - escapeMarkdownCell returns a plain string unchanged
  ---
  duration_ms: 0.336979
  type: 'test'
  ...
# Subtest: escapeMarkdownCell returns an empty string unchanged
ok 13 - escapeMarkdownCell returns an empty string unchanged
  ---
  duration_ms: 0.270309
  type: 'test'
  ...
# Subtest: RENDERER_VERSION is bumped to "3" for the store re-point -- the digest's canonical input is store rows, not the three wire shapes
ok 14 - RENDERER_VERSION is bumped to "3" for the store re-point -- the digest's canonical input is store rows, not the three wire shapes
  ---
  duration_ms: 0.237855
  type: 'test'
  ...
# Subtest: the render digest is identical across two renders of the same store and the same sidecar
ok 15 - the render digest is identical across two renders of the same store and the same sidecar
  ---
  duration_ms: 81.454979
  type: 'test'
  ...
# Subtest: changing a LABEL in the store changes the render digest -- the digest covers the store, not just the sidecar
ok 16 - changing a LABEL in the store changes the render digest -- the digest covers the store, not just the sidecar
  ---
  duration_ms: 88.532827
  type: 'test'
  ...
# Subtest: changing a COMMENT in the store changes the render digest
ok 17 - changing a COMMENT in the store changes the render digest
  ---
  duration_ms: 83.306565
  type: 'test'
  ...
# Subtest: changing a RANGE in the store changes the render digest
ok 18 - changing a RANGE in the store changes the render digest
  ---
  duration_ms: 81.529468
  type: 'test'
  ...
# Subtest: changing the SIDECAR BYTES alone changes the render digest, even when the parsed object is equivalent
ok 19 - changing the SIDECAR BYTES alone changes the render digest, even when the parsed object is equivalent
  ---
  duration_ms: 73.089766
  type: 'test'
  ...
# Subtest: the surviving measurement-provenance paragraph STATES the version-2 wire shapes inline, rather than pointing at declarations that no longer exist
ok 20 - the surviving measurement-provenance paragraph STATES the version-2 wire shapes inline, rather than pointing at declarations that no longer exist
  ---
  duration_ms: 0.960571
  type: 'test'
  ...
# Subtest: renders a golden memory map from a hand-built store plus a fixture sidecar, exact bytes except the digest line
ok 21 - renders a golden memory map from a hand-built store plus a fixture sidecar, exact bytes except the digest line
  ---
  duration_ms: 124.554351
  type: 'test'
  ...
# Subtest: the render digest and the --check verdict AGREE: the identical tree at a different absolute path is in-sync, not drifted
ok 22 - the render digest and the --check verdict AGREE: the identical tree at a different absolute path is in-sync, not drifted
  ---
  duration_ms: 78.415783
  type: 'test'
  ...
# Subtest: a store with ZERO ranges, labels and comments renders a banner and a digest, and that file cross-root checks in-sync -- a zero-row render is a RESULT, never a refusal
ok 23 - a store with ZERO ranges, labels and comments renders a banner and a digest, and that file cross-root checks in-sync -- a zero-row render is a RESULT, never a refusal
  ---
  duration_ms: 17.457224
  type: 'test'
  ...
# Subtest: --check names the LOWEST differing line when the file differs on several, and two runs over the same inputs name the same line
ok 24 - --check names the LOWEST differing line when the file differs on several, and two runs over the same inputs name the same line
  ---
  duration_ms: 68.209055
  type: 'test'
  ...
# Subtest: an address whose store comment carries [unknown] appears under Open questions, and a malformed confidence prefix throws rather than rendering silently
ok 25 - an address whose store comment carries [unknown] appears under Open questions, and a malformed confidence prefix throws rather than rendering silently
  ---
  duration_ms: 67.244154
  type: 'test'
  ...
# Subtest: comment evidence containing BOTH a pipe and an embedded newline renders as ONE well-formed table row, table structure intact, escaped content preserved
ok 26 - comment evidence containing BOTH a pipe and an embedded newline renders as ONE well-formed table row, table structure intact, escaped content preserved
  ---
  duration_ms: 95.47193
  type: 'test'
  ...
1..26
# tests 26
# suites 0
# pass 26
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1296.662283
```

### Planted run

- **Plant:** `src/mcp/vice/anno-memmap-render.ts`: `if (!/^[0-9a-fA-F]{64}$/.test(sha.trim())) {` → `if (!/^[0-9a-fA-F]{63}$/.test(sha.trim())) {`
- **Planted command:** `node --test anno-memmap-render.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# (node:256584) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: parseProvenanceHeader accepts a fully-filled valid header
not ok 1 - parseProvenanceHeader accepts a fully-filled valid header
  ---
  duration_ms: 3.690996
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:65:1'
  failureType: 'testCodeFailure'
  error: |-
    provenance sidecar has 1 problem(s):
      - captureSha256: must be exactly 64 hex characters, got "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (length 64)
  code: 'ERR_TEST_FAILURE'
  name: 'AnnoProvenanceHeaderError'
  stack: |-
    parseProvenanceHeader (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.ts:244:11)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:66:18)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
# Subtest: parseProvenanceHeader accepts an optional rasterPositions array
not ok 2 - parseProvenanceHeader accepts an optional rasterPositions array
  ---
  duration_ms: 0.575642
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:73:1'
  failureType: 'testCodeFailure'
  error: |-
    provenance sidecar has 1 problem(s):
      - captureSha256: must be exactly 64 hex characters, got "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (length 64)
  code: 'ERR_TEST_FAILURE'
  name: 'AnnoProvenanceHeaderError'
  stack: |-
    parseProvenanceHeader (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.ts:244:11)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:74:18)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
  ...
# Subtest: parseProvenanceHeader({}) throws listing ALL missing required keys in one message
ok 3 - parseProvenanceHeader({}) throws listing ALL missing required keys in one message
  ---
  duration_ms: 2.013667
  type: 'test'
  ...
# Subtest: parseProvenanceHeader refuses a template-placeholder captureSha256 and videoStandard, naming both
ok 4 - parseProvenanceHeader refuses a template-placeholder captureSha256 and videoStandard, naming both
  ---
  duration_ms: 1.150667
  type: 'test'
  ...
# Subtest: parseProvenanceHeader refuses a bad hash length
ok 5 - parseProvenanceHeader refuses a bad hash length
  ---
  duration_ms: 0.796921
  type: 'test'
  ...
# Subtest: parseProvenanceHeader refuses a videoStandard value that is neither a placeholder nor PAL/NTSC
ok 6 - parseProvenanceHeader refuses a videoStandard value that is neither a placeholder nor PAL/NTSC
  ---
  duration_ms: 0.697308
  type: 'test'
  ...
# Subtest: parseProvenanceHeader refuses a malformed rasterPositions
ok 7 - parseProvenanceHeader refuses a malformed rasterPositions
  ---
  duration_ms: 0.742386
  type: 'test'
  ...
# Subtest: parseProvenanceHeader refuses a non-object payload
ok 8 - parseProvenanceHeader refuses a non-object payload
  ---
  duration_ms: 0.622966
  type: 'test'
  ...
# Subtest: the renderer's layout is embedded in TypeScript, never read from the recon skill's template at runtime
ok 9 - the renderer's layout is embedded in TypeScript, never read from the recon skill's template at runtime
  ---
  duration_ms: 1.303615
  type: 'test'
  ...
# Subtest: escapeMarkdownCell escapes a pipe character
ok 10 - escapeMarkdownCell escapes a pipe character
  ---
  duration_ms: 1.092179
  type: 'test'
  ...
# Subtest: escapeMarkdownCell collapses \\n, \\r\\n and a bare \\r into <br>
ok 11 - escapeMarkdownCell collapses \\n, \\r\\n and a bare \\r into <br>
  ---
  duration_ms: 0.577004
  type: 'test'
  ...
# Subtest: escapeMarkdownCell returns a plain string unchanged
ok 12 - escapeMarkdownCell returns a plain string unchanged
  ---
  duration_ms: 0.310151
  type: 'test'
  ...
# Subtest: escapeMarkdownCell returns an empty string unchanged
ok 13 - escapeMarkdownCell returns an empty string unchanged
  ---
  duration_ms: 0.247983
  type: 'test'
  ...
# Subtest: RENDERER_VERSION is bumped to "3" for the store re-point -- the digest's canonical input is store rows, not the three wire shapes
ok 14 - RENDERER_VERSION is bumped to "3" for the store re-point -- the digest's canonical input is store rows, not the three wire shapes
  ---
  duration_ms: 0.230018
  type: 'test'
  ...
# Subtest: the render digest is identical across two renders of the same store and the same sidecar
not ok 15 - the render digest is identical across two renders of the same store and the same sidecar
  ---
  duration_ms: 67.971268
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:251:1'
  failureType: 'testCodeFailure'
  error: |-
    provenance sidecar has 1 problem(s):
      - captureSha256: must be exactly 64 hex characters, got "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (length 64)
  code: 'ERR_TEST_FAILURE'
  name: 'AnnoProvenanceHeaderError'
  stack: |-
    parseProvenanceHeader (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.ts:244:11)
    renderMemoryMap (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.ts:416:22)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:253:25
    withRenderFixture (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:210:26)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:252:9)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
  ...
# Subtest: changing a LABEL in the store changes the render digest -- the digest covers the store, not just the sidecar
not ok 16 - changing a LABEL in the store changes the render digest -- the digest covers the store, not just the sidecar
  ---
  duration_ms: 64.537402
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:261:1'
  failureType: 'testCodeFailure'
  error: |-
    provenance sidecar has 1 problem(s):
      - captureSha256: must be exactly 64 hex characters, got "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (length 64)
  code: 'ERR_TEST_FAILURE'
  name: 'AnnoProvenanceHeaderError'
  stack: |-
    parseProvenanceHeader (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.ts:244:11)
    renderMemoryMap (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.ts:416:22)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:263:26
    withRenderFixture (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:210:26)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:262:9)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
  ...
# Subtest: changing a COMMENT in the store changes the render digest
not ok 17 - changing a COMMENT in the store changes the render digest
  ---
  duration_ms: 73.921534
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:277:1'
  failureType: 'testCodeFailure'
  error: |-
    provenance sidecar has 1 problem(s):
      - captureSha256: must be exactly 64 hex characters, got "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (length 64)
  code: 'ERR_TEST_FAILURE'
  name: 'AnnoProvenanceHeaderError'
  stack: |-
    parseProvenanceHeader (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.ts:244:11)
    renderMemoryMap (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.ts:416:22)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:279:26
    withRenderFixture (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:210:26)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:278:9)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
  ...
# Subtest: changing a RANGE in the store changes the render digest
not ok 18 - changing a RANGE in the store changes the render digest
  ---
  duration_ms: 60.5872
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:293:1'
  failureType: 'testCodeFailure'
  error: |-
    provenance sidecar has 1 problem(s):
      - captureSha256: must be exactly 64 hex characters, got "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (length 64)
  code: 'ERR_TEST_FAILURE'
  name: 'AnnoProvenanceHeaderError'
  stack: |-
    parseProvenanceHeader (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.ts:244:11)
    renderMemoryMap (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.ts:416:22)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:295:26
    withRenderFixture (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:210:26)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:294:9)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
  ...
# Subtest: changing the SIDECAR BYTES alone changes the render digest, even when the parsed object is equivalent
not ok 19 - changing the SIDECAR BYTES alone changes the render digest, even when the parsed object is equivalent
  ---
  duration_ms: 63.713453
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:309:1'
  failureType: 'testCodeFailure'
  error: |-
    provenance sidecar has 1 problem(s):
      - captureSha256: must be exactly 64 hex characters, got "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (length 64)
  code: 'ERR_TEST_FAILURE'
  name: 'AnnoProvenanceHeaderError'
  stack: |-
    parseProvenanceHeader (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.ts:244:11)
    renderMemoryMap (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.ts:416:22)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:311:26
    withRenderFixture (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:210:26)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:310:9)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
  ...
# Subtest: the surviving measurement-provenance paragraph STATES the version-2 wire shapes inline, rather than pointing at declarations that no longer exist
ok 20 - the surviving measurement-provenance paragraph STATES the version-2 wire shapes inline, rather than pointing at declarations that no longer exist
  ---
  duration_ms: 1.034446
  type: 'test'
  ...
# Subtest: renders a golden memory map from a hand-built store plus a fixture sidecar, exact bytes except the digest line
not ok 21 - renders a golden memory map from a hand-built store plus a fixture sidecar, exact bytes except the digest line
  ---
  duration_ms: 77.808008
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:364:1'
  failureType: 'testCodeFailure'
  error: |-
    provenance sidecar has 1 problem(s):
      - captureSha256: must be exactly 64 hex characters, got "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (length 64)
  code: 'ERR_TEST_FAILURE'
  name: 'AnnoProvenanceHeaderError'
  stack: |-
    parseProvenanceHeader (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.ts:244:11)
    renderMemoryMap (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.ts:416:22)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:396:28
    withRenderFixture (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:210:26)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:365:9)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
  ...
# Subtest: the render digest and the --check verdict AGREE: the identical tree at a different absolute path is in-sync, not drifted
not ok 22 - the render digest and the --check verdict AGREE: the identical tree at a different absolute path is in-sync, not drifted
  ---
  duration_ms: 69.272609
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:560:1'
  failureType: 'testCodeFailure'
  error: |-
    provenance sidecar has 1 problem(s):
      - captureSha256: must be exactly 64 hex characters, got "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (length 64)
  code: 'ERR_TEST_FAILURE'
  name: 'AnnoProvenanceHeaderError'
  stack: |-
    parseProvenanceHeader (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.ts:244:11)
    renderMemoryMap (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.ts:416:22)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:585:27)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: a store with ZERO ranges, labels and comments renders a banner and a digest, and that file cross-root checks in-sync -- a zero-row render is a RESULT, never a refusal
not ok 23 - a store with ZERO ranges, labels and comments renders a banner and a digest, and that file cross-root checks in-sync -- a zero-row render is a RESULT, never a refusal
  ---
  duration_ms: 17.170539
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:640:1'
  failureType: 'testCodeFailure'
  error: |-
    provenance sidecar has 1 problem(s):
      - captureSha256: must be exactly 64 hex characters, got "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (length 64)
  code: 'ERR_TEST_FAILURE'
  name: 'AnnoProvenanceHeaderError'
  stack: |-
    parseProvenanceHeader (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.ts:244:11)
    renderMemoryMap (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.ts:416:22)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:655:26)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: --check names the LOWEST differing line when the file differs on several, and two runs over the same inputs name the same line
not ok 24 - --check names the LOWEST differing line when the file differs on several, and two runs over the same inputs name the same line
  ---
  duration_ms: 66.941849
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:687:1'
  failureType: 'testCodeFailure'
  error: |-
    provenance sidecar has 1 problem(s):
      - captureSha256: must be exactly 64 hex characters, got "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (length 64)
  code: 'ERR_TEST_FAILURE'
  name: 'AnnoProvenanceHeaderError'
  stack: |-
    parseProvenanceHeader (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.ts:244:11)
    renderMemoryMap (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.ts:416:22)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:691:28
    withRenderFixture (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:210:26)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:688:9)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
  ...
# Subtest: an address whose store comment carries [unknown] appears under Open questions, and a malformed confidence prefix throws rather than rendering silently
not ok 25 - an address whose store comment carries [unknown] appears under Open questions, and a malformed confidence prefix throws rather than rendering silently
  ---
  duration_ms: 25.956946
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:720:1'
  failureType: 'testCodeFailure'
  error: |-
    provenance sidecar has 1 problem(s):
      - captureSha256: must be exactly 64 hex characters, got "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (length 64)
  code: 'ERR_TEST_FAILURE'
  name: 'AnnoProvenanceHeaderError'
  stack: |-
    parseProvenanceHeader (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.ts:244:11)
    renderMemoryMap (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.ts:416:22)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:730:32
    withRenderFixture (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:210:26)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:721:9)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
  ...
# Subtest: comment evidence containing BOTH a pipe and an embedded newline renders as ONE well-formed table row, table structure intact, escaped content preserved
not ok 26 - comment evidence containing BOTH a pipe and an embedded newline renders as ONE well-formed table row, table structure intact, escaped content preserved
  ---
  duration_ms: 44.514124
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:809:1'
  failureType: 'testCodeFailure'
  error: |-
    provenance sidecar has 1 problem(s):
      - captureSha256: must be exactly 64 hex characters, got "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (length 64)
  code: 'ERR_TEST_FAILURE'
  name: 'AnnoProvenanceHeaderError'
  stack: |-
    parseProvenanceHeader (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.ts:244:11)
    renderMemoryMap (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.ts:416:22)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:805:53
    withRenderFixture (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:210:26)
    renderSingleCommentedBlock (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:797:10)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-memmap-render.test.ts:813:31)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
  ...
1..26
# tests 26
# suites 0
# pass 13
# fail 13
# cancelled 0
# skipped 0
# todo 0
# duration_ms 978.441582
```

## `src/mcp/vice/anno-regbits.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test anno-regbits.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# anno-regbits-gen.ts OVERRIDES: 13 WHY comments, 6 field-level entries, 8 register-level (label/synthetic) entries needing their own WHY
# Subtest: parseBitRange: single index, descending range and ascending range all normalise correctly
ok 1 - parseBitRange: single index, descending range and ascending range all normalise correctly
  ---
  duration_ms: 3.88874
  type: 'test'
  ...
# Subtest: deriveIdentifier: drops parenthetical asides, uppercases, and collapses punctuation to underscores
ok 2 - deriveIdentifier: drops parenthetical asides, uppercases, and collapses punctuation to underscores
  ---
  duration_ms: 0.721416
  type: 'test'
  ...
# Subtest: drift guard: buildRegBits() re-run in memory deep-equals the committed anno-regbits.json (banner stripped)
ok 3 - drift guard: buildRegBits() re-run in memory deep-equals the committed anno-regbits.json (banner stripped)
  ---
  duration_ms: 4.486434
  type: 'test'
  ...
# Subtest: drift guard: the committed banner's memmapSha256 equals memmap.json's current digest
ok 4 - drift guard: the committed banner's memmapSha256 equals memmap.json's current digest
  ---
  duration_ms: 1.748251
  type: 'test'
  ...
# Subtest: drift guard: buildRegBitsDocument() emits the SAME banner shape twice in a row (no timestamp, so the comparison stays total)
ok 5 - drift guard: buildRegBitsDocument() emits the SAME banner shape twice in a row (no timestamp, so the comparison stays total)
  ---
  duration_ms: 5.709019
  type: 'test'
  ...
# Subtest: non-vacuous drift guard: appending a byte to a SCRATCH COPY of memmap.json makes the drift assertion FAIL (planted violation, ENGINEERING_RULES.md Sec 6)
ok 6 - non-vacuous drift guard: appending a byte to a SCRATCH COPY of memmap.json makes the drift assertion FAIL (planted violation, ENGINEERING_RULES.md Sec 6)
  ---
  duration_ms: 10.365614
  type: 'test'
  ...
# committed memmap.json digest: 60a517c1833a44e6dc1a99a949554fa39834b558371d9f1e98531499fe3642fe
# mutated (planted-violation) memmap.json digest: 9d1cd787afc983a7309269cfd3b730c8052fb3cdc2845ef2e1e45af78f9faaa1
# Subtest: every field name in anno-regbits.json matches ^[A-Za-z_][A-Za-z0-9_]*$
ok 7 - every field name in anno-regbits.json matches ^[A-Za-z_][A-Za-z0-9_]*$
  ---
  duration_ms: 1.12391
  type: 'test'
  ...
# Subtest: no field name or token contains the OCR-damage artifacts NMls or a bare letter-O-for-zero pattern
ok 8 - no field name or token contains the OCR-damage artifacts NMls or a bare letter-O-for-zero pattern
  ---
  duration_ms: 0.751632
  type: 'test'
  ...
# Subtest: $D011's six fields match the plan's pinned criterion-3 shape exactly
ok 9 - $D011's six fields match the plan's pinned criterion-3 shape exactly
  ---
  duration_ms: 0.980608
  type: 'test'
  ...
# Subtest: the six override-supplied (memmap-absent) registers are present: $D015, $D017, $D01A, $D01B, $D01C, $D01D
ok 10 - the six override-supplied (memmap-absent) registers are present: $D015, $D017, $D01A, $D01B, $D01C, $D01D
  ---
  duration_ms: 1.678113
  type: 'test'
  ...
# Subtest: the table also contains $D011 and $01 (address 1)
ok 11 - the table also contains $D011 and $01 (address 1)
  ---
  duration_ms: 0.485392
  type: 'test'
  ...
# Subtest: OVERRIDES: every field/register override entry carries a WHY comment (grep-counted, not eyeballed)
ok 12 - OVERRIDES: every field/register override entry carries a WHY comment (grep-counted, not eyeballed)
  ---
  duration_ms: 1.383624
  type: 'test'
  ...
# Subtest: non-vacuity: a synthetic memmap entry whose desc is unmappable and absent from OVERRIDES THROWS naming the address
ok 13 - non-vacuity: a synthetic memmap entry whose desc is unmappable and absent from OVERRIDES THROWS naming the address
  ---
  duration_ms: 8.695508
  type: 'test'
  ...
1..13
# tests 13
# suites 0
# pass 13
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 259.890496
```

### Planted run

- **Plant:** `src/mcp/vice/anno-regbits.json`: `"memmapSha256": "60a517c1` → `"memmapSha256": "60a517c2`
- **Planted command:** `node --test anno-regbits.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# anno-regbits-gen.ts OVERRIDES: 13 WHY comments, 6 field-level entries, 8 register-level (label/synthetic) entries needing their own WHY
# Subtest: parseBitRange: single index, descending range and ascending range all normalise correctly
ok 1 - parseBitRange: single index, descending range and ascending range all normalise correctly
  ---
  duration_ms: 7.662695
  type: 'test'
  ...
# Subtest: deriveIdentifier: drops parenthetical asides, uppercases, and collapses punctuation to underscores
ok 2 - deriveIdentifier: drops parenthetical asides, uppercases, and collapses punctuation to underscores
  ---
  duration_ms: 1.026291
  type: 'test'
  ...
# Subtest: drift guard: buildRegBits() re-run in memory deep-equals the committed anno-regbits.json (banner stripped)
ok 3 - drift guard: buildRegBits() re-run in memory deep-equals the committed anno-regbits.json (banner stripped)
  ---
  duration_ms: 8.055576
  type: 'test'
  ...
# Subtest: drift guard: the committed banner's memmapSha256 equals memmap.json's current digest
not ok 4 - drift guard: the committed banner's memmapSha256 equals memmap.json's current digest
  ---
  duration_ms: 6.286789
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-regbits.test.ts:58:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    + actual - expected
    
    + '60a517c2833a44e6dc1a99a949554fa39834b558371d9f1e98531499fe3642fe'
    - '60a517c1833a44e6dc1a99a949554fa39834b558371d9f1e98531499fe3642fe'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: '60a517c1833a44e6dc1a99a949554fa39834b558371d9f1e98531499fe3642fe'
  actual: '60a517c2833a44e6dc1a99a949554fa39834b558371d9f1e98531499fe3642fe'
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-regbits.test.ts:61:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: drift guard: buildRegBitsDocument() emits the SAME banner shape twice in a row (no timestamp, so the comparison stays total)
ok 5 - drift guard: buildRegBitsDocument() emits the SAME banner shape twice in a row (no timestamp, so the comparison stays total)
  ---
  duration_ms: 9.481192
  type: 'test'
  ...
# Subtest: non-vacuous drift guard: appending a byte to a SCRATCH COPY of memmap.json makes the drift assertion FAIL (planted violation, ENGINEERING_RULES.md Sec 6)
ok 6 - non-vacuous drift guard: appending a byte to a SCRATCH COPY of memmap.json makes the drift assertion FAIL (planted violation, ENGINEERING_RULES.md Sec 6)
  ---
  duration_ms: 19.493455
  type: 'test'
  ...
# committed memmap.json digest: 60a517c2833a44e6dc1a99a949554fa39834b558371d9f1e98531499fe3642fe
# mutated (planted-violation) memmap.json digest: 9d1cd787afc983a7309269cfd3b730c8052fb3cdc2845ef2e1e45af78f9faaa1
# Subtest: every field name in anno-regbits.json matches ^[A-Za-z_][A-Za-z0-9_]*$
ok 7 - every field name in anno-regbits.json matches ^[A-Za-z_][A-Za-z0-9_]*$
  ---
  duration_ms: 7.287922
  type: 'test'
  ...
# Subtest: no field name or token contains the OCR-damage artifacts NMls or a bare letter-O-for-zero pattern
ok 8 - no field name or token contains the OCR-damage artifacts NMls or a bare letter-O-for-zero pattern
  ---
  duration_ms: 2.746296
  type: 'test'
  ...
# Subtest: $D011's six fields match the plan's pinned criterion-3 shape exactly
ok 9 - $D011's six fields match the plan's pinned criterion-3 shape exactly
  ---
  duration_ms: 1.888158
  type: 'test'
  ...
# Subtest: the six override-supplied (memmap-absent) registers are present: $D015, $D017, $D01A, $D01B, $D01C, $D01D
ok 10 - the six override-supplied (memmap-absent) registers are present: $D015, $D017, $D01A, $D01B, $D01C, $D01D
  ---
  duration_ms: 2.825336
  type: 'test'
  ...
# Subtest: the table also contains $D011 and $01 (address 1)
ok 11 - the table also contains $D011 and $01 (address 1)
  ---
  duration_ms: 0.981784
  type: 'test'
  ...
# Subtest: OVERRIDES: every field/register override entry carries a WHY comment (grep-counted, not eyeballed)
ok 12 - OVERRIDES: every field/register override entry carries a WHY comment (grep-counted, not eyeballed)
  ---
  duration_ms: 2.576588
  type: 'test'
  ...
# Subtest: non-vacuity: a synthetic memmap entry whose desc is unmappable and absent from OVERRIDES THROWS naming the address
ok 13 - non-vacuity: a synthetic memmap entry whose desc is unmappable and absent from OVERRIDES THROWS naming the address
  ---
  duration_ms: 21.242485
  type: 'test'
  ...
1..13
# tests 13
# suites 0
# pass 12
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 394.669348
```

## `src/mcp/vice/anno-tools.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test anno-tools.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# (node:256671) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: tracer (MCP-05): anno_get_symbols answers a real query against a real store, end to end
ok 1 - tracer (MCP-05): anno_get_symbols answers a real query against a real store, end to end
  ---
  duration_ms: 12.332045
  type: 'test'
  ...
# Subtest: anno_get_symbols narrows by address range, and reports truncation as a fact rather than leaving it to be inferred
ok 2 - anno_get_symbols narrows by address range, and reports truncation as a fact rather than leaving it to be inferred
  ---
  duration_ms: 11.450299
  type: 'test'
  ...
# Subtest: WR-02 closed: an uncurated name RESOLVES {isError:true} naming both resolution routes -- it does not reject the promise
ok 3 - WR-02 closed: an uncurated name RESOLVES {isError:true} naming both resolution routes -- it does not reject the promise
  ---
  duration_ms: 0.675388
  type: 'test'
  ...
# Subtest: a store path outside the workspace root RESOLVES {isError:true} naming AnnoStorePathError (T-29-01)
ok 4 - a store path outside the workspace root RESOLVES {isError:true} naming AnnoStorePathError (T-29-01)
  ---
  duration_ms: 2.268089
  type: 'test'
  ...
# Subtest: an absent store is refused, never created -- mustExist is what keeps 'gone' and 'empty' distinguishable
ok 5 - an absent store is refused, never created -- mustExist is what keeps 'gone' and 'empty' distinguishable
  ---
  duration_ms: 1.971918
  type: 'test'
  ...
# Subtest: the transport validates nothing, so a missing required argument is refused HERE and named
ok 6 - the transport validates nothing, so a missing required argument is refused HERE and named
  ---
  duration_ms: 0.780712
  type: 'test'
  ...
# Subtest: an unprefixed numeric address string is refused by the ONE address parser, not accepted by a second rule here
ok 7 - an unprefixed numeric address string is refused by the ONE address parser, not accepted by a second rule here
  ---
  duration_ms: 2.155571
  type: 'test'
  ...
# Subtest: assertAnnoTool's FIRST check is set membership: an uncurated name is refused before any argument is looked at
ok 8 - assertAnnoTool's FIRST check is set membership: an uncurated name is refused before any argument is looked at
  ---
  duration_ms: 0.759957
  type: 'test'
  ...
# Subtest: CURATED_ANNO_TOOLS is DERIVED from ANNO_TOOL_DEFINITIONS, never a second hand-typed list (T-29-02)
ok 9 - CURATED_ANNO_TOOLS is DERIVED from ANNO_TOOL_DEFINITIONS, never a second hand-typed list (T-29-02)
  ---
  duration_ms: 1.024379
  type: 'test'
  ...
# Subtest: anno-tools.ts holds no module-level mutable store handle (D-06)
ok 10 - anno-tools.ts holds no module-level mutable store handle (D-06)
  ---
  duration_ms: 1.988215
  type: 'test'
  ...
# Subtest: every openStore( in anno-tools.ts is closed by a closeStore( inside a finally (T-29-03)
ok 11 - every openStore( in anno-tools.ts is closed by a closeStore( inside a finally (T-29-03)
  ---
  duration_ms: 2.526264
  type: 'test'
  ...
# Subtest: MCP-02 by construction: anno-tools.ts reaches no VICE transport and no host-path seam
ok 12 - MCP-02 by construction: anno-tools.ts reaches no VICE transport and no host-path seam
  ---
  duration_ms: 1.30419
  type: 'test'
  ...
# Subtest: anno-tools.ts never throws a bare Error -- every refusal is an AnnoStoreError and therefore a ViceError
ok 13 - anno-tools.ts never throws a bare Error -- every refusal is an AnnoStoreError and therefore a ViceError
  ---
  duration_ms: 0.225991
  type: 'test'
  ...
# Subtest: the twelve write and stored-read verbs are advertised, each requiring an explicit store (D-06)
ok 14 - the twelve write and stored-read verbs are advertised, each requiring an explicit store (D-06)
  ---
  duration_ms: 0.277369
  type: 'test'
  ...
# Subtest: a repeated identical anno_set_label_name SUCCEEDS reporting changed:false -- an annotation pass re-run is not an error
ok 15 - a repeated identical anno_set_label_name SUCCEEDS reporting changed:false -- an annotation pass re-run is not an error
  ---
  duration_ms: 9.359179
  type: 'test'
  ...
# Subtest: an illegal label name is REJECTED by name with the offending name in the message, and nothing is written or sanitized (T-29-23)
ok 16 - an illegal label name is REJECTED by name with the offending name in the message, and nothing is written or sanitized (T-29-23)
  ---
  duration_ms: 2.948611
  type: 'test'
  ...
# Subtest: comment length is bounded in BYTES by the store's own assertion -- this layer adds no second check and no truncation
ok 17 - comment length is bounded in BYTES by the store's own assertion -- this layer adds no second check and no truncation
  ---
  duration_ms: 6.446006
  type: 'test'
  ...
# Subtest: F-4: anno_set_data_type's SUCCESSFUL body carries BOTH contradictedComments and reinterpretedSplitTables
ok 18 - F-4: anno_set_data_type's SUCCESSFUL body carries BOTH contradictedComments and reinterpretedSplitTables
  ---
  duration_ms: 15.059488
  type: 'test'
  ...
# Subtest: F-5: a transposed scope span is refused by the store's overlap rule, and anno_remove_scope makes it recoverable without a revert
ok 19 - F-5: a transposed scope span is refused by the store's overlap rule, and anno_remove_scope makes it recoverable without a revert
  ---
  duration_ms: 15.592779
  type: 'test'
  ...
# Subtest: anno_apply_enum_usage with an omitted or empty name CLEARS the association, matching the schema's own contract
ok 20 - anno_apply_enum_usage with an omitted or empty name CLEARS the association, matching the schema's own contract
  ---
  duration_ms: 15.378633
  type: 'test'
  ...
# Subtest: anno_save_project reports the revision and PERFORMS NO WRITE -- the revision and the store file's mtime are identical before and after
ok 21 - anno_save_project reports the revision and PERFORMS NO WRITE -- the revision and the store file's mtime are identical before and after
  ---
  duration_ms: 5.876533
  type: 'test'
  ...
# Subtest: WR-10: anno_save_project's revision FIELD and the revision named in its own prose are the same value
ok 22 - WR-10: anno_save_project's revision FIELD and the revision named in its own prose are the same value
  ---
  duration_ms: 11.197328
  type: 'test'
  ...
# Subtest: WR-10: dispatchSaveProject() reads the store revision EXACTLY ONCE
ok 23 - WR-10: dispatchSaveProject() reads the store revision EXACTLY ONCE
  ---
  duration_ms: 0.299207
  type: 'test'
  ...
# Subtest: every verb closes the store: no handle is left open and no journal sidecar survives a repeated call
ok 24 - every verb closes the store: no handle is left open and no journal sidecar survives a repeated call
  ---
  duration_ms: 15.294481
  type: 'test'
  ...
# Subtest: anno-tools.ts re-implements no address parsing, no range validation and no data-type membership -- every such check calls an anno-types.ts export
ok 25 - anno-tools.ts re-implements no address parsing, no range validation and no data-type membership -- every such check calls an anno-types.ts export
  ---
  duration_ms: 0.977735
  type: 'test'
  ...
# Subtest: the six derived and composed verbs are advertised, and every one requires an explicit image (D-07)
ok 26 - the six derived and composed verbs are advertised, and every one requires an explicit image (D-07)
  ---
  duration_ms: 0.216698
  type: 'test'
  ...
# Subtest: anno_disassemble decodes at an EXPLICIT address, and the surface names no cursor anywhere (D-09)
ok 27 - anno_disassemble decodes at an EXPLICIT address, and the surface names no cursor anywhere (D-09)
  ---
  duration_ms: 6.256536
  type: 'test'
  ...
# Subtest: D-09: no identifier, schema property or dispatch branch on this surface names a cursor or a current address
ok 28 - D-09: no identifier, schema property or dispatch branch on this surface names a cursor or a current address
  ---
  duration_ms: 0.675325
  type: 'test'
  ...
# Subtest: ONE cap governs BOTH views, is read at call time, and refuses by name with the cap and the requested width
ok 29 - ONE cap governs BOTH views, is read at call time, and refuses by name with the cap and the requested width
  ---
  duration_ms: 2.993242
  type: 'test'
  ...
# Subtest: anno_read_region serves both views, and a span outside the image is reported unanswerable rather than served short
ok 30 - anno_read_region serves both views, and a span outside the image is reported unanswerable rather than served short
  ---
  duration_ms: 4.352617
  type: 'test'
  ...
# Subtest: CR-01 / MCP-04: both read verbs return the SAME {available:false} verdict for an out-of-image address
ok 31 - CR-01 / MCP-04: both read verbs return the SAME {available:false} verdict for an out-of-image address
  ---
  duration_ms: 3.612317
  type: 'test'
  ...
# Subtest: CR-01: the incoherent range is STRUCTURALLY absent -- an out-of-image disassemble carries no end_address and no instructions
ok 32 - CR-01: the incoherent range is STRUCTURALLY absent -- an out-of-image disassemble carries no end_address and no instructions
  ---
  duration_ms: 2.993325
  type: 'test'
  ...
# Subtest: CR-01: an inverted span is refused IDENTICALLY by both verbs, and the one no validator can catch is caught by sliceSpan()
ok 33 - CR-01: an inverted span is refused IDENTICALLY by both verbs, and the one no validator can catch is caught by sliceSpan()
  ---
  duration_ms: 3.658065
  type: 'test'
  ...
# Subtest: CR-01: sliceSpan()'s guard names all THREE cases, so the inverted-span condition cannot be dropped as redundant
ok 34 - CR-01: sliceSpan()'s guard names all THREE cases, so the inverted-span condition cannot be dropped as redundant
  ---
  duration_ms: 0.491574
  type: 'test'
  ...
# Subtest: CR-01 over-refusal control: a span WHOLLY INSIDE the image still succeeds on both verbs, with a non-zero instruction count
ok 35 - CR-01 over-refusal control: a span WHOLLY INSIDE the image still succeeds on both verbs, with a non-zero instruction count
  ---
  duration_ms: 5.348326
  type: 'test'
  ...
# Subtest: CR-01: an OMITTED end_address still defaults to the image's own bound -- removing the clamp must not remove the ergonomics
ok 36 - CR-01: an OMITTED end_address still defaults to the image's own bound -- removing the clamp must not remove the ergonomics
  ---
  duration_ms: 2.946436
  type: 'test'
  ...
# Subtest: anno_get_binary_info reports the load address, origin and lengths for a real PRG, and refuses a non-PRG by name
ok 37 - anno_get_binary_info reports the load address, origin and lengths for a real PRG, and refuses a non-PRG by name
  ---
  duration_ms: 13.739828
  type: 'test'
  ...
# Subtest: anno_get_cross_references returns the derivation module's union, and the store is byte-identical afterwards
ok 38 - anno_get_cross_references returns the derivation module's union, and the store is byte-identical afterwards
  ---
  duration_ms: 9.139454
  type: 'test'
  ...
# Subtest: anno_search: max_results is REQUIRED with no default, and a capped answer reports the true total
ok 39 - anno_search: max_results is REQUIRED with no default, and a capped answer reports the true total
  ---
  duration_ms: 18.485719
  type: 'test'
  ...
# Subtest: anno_search naming a corpus this surface does not have answers {available:false, reason} in a SUCCESSFUL body, never an empty result set
ok 40 - anno_search naming a corpus this surface does not have answers {available:false, reason} in a SUCCESSFUL body, never an empty result set
  ---
  duration_ms: 8.762979
  type: 'test'
  ...
# Subtest: anno_get_address_details returns the composition with its composed_from disclosure intact
ok 41 - anno_get_address_details returns the composition with its composed_from disclosure intact
  ---
  duration_ms: 15.675101
  type: 'test'
  ...
# Subtest: an image outside the workspace root, or absent, is refused by name -- the same containment the store path gets
ok 42 - an image outside the workspace root, or absent, is refused by name -- the same containment the store path gets
  ---
  duration_ms: 6.646287
  type: 'test'
  ...
# Subtest: anno_batch_execute is advertised as the ONE sanctioned nested-argument verb, and the header says no second may join it
ok 43 - anno_batch_execute is advertised as the ONE sanctioned nested-argument verb, and the header says no second may join it
  ---
  duration_ms: 0.464641
  type: 'test'
  ...
# Subtest: the six whole-batch refusal shapes, each naming what it refused on
ok 44 - the six whole-batch refusal shapes, each naming what it refused on
  ---
  duration_ms: 2.150825
  type: 'test'
  ...
# Subtest: the batch validator recurses: an uncurated name one level down still refuses the WHOLE batch
ok 45 - the batch validator recurses: an uncurated name one level down still refuses the WHOLE batch
  ---
  duration_ms: 0.444577
  type: 'test'
  ...
# Subtest: nesting deeper than the declared cap is refused BY NAME rather than walked (T-29-24)
ok 46 - nesting deeper than the declared cap is refused BY NAME rather than walked (T-29-24)
  ---
  duration_ms: 0.816969
  type: 'test'
  ...
# Subtest: NOTHING executes when pre-validation refuses: the revision is unchanged and no partial write is visible
ok 47 - NOTHING executes when pre-validation refuses: the revision is unchanged and no partial write is visible
  ---
  duration_ms: 10.987549
  type: 'test'
  ...
# Subtest: execution runs to COMPLETION: a three-call batch whose middle call fails returns three per-item entries, in order
ok 48 - execution runs to COMPLETION: a three-call batch whose middle call fails returns three per-item entries, in order
  ---
  duration_ms: 22.22258
  type: 'test'
  ...
# Subtest: a batch names its store ONCE and every inner call inherits it -- an inner store is overridden, never honoured
ok 49 - a batch names its store ONCE and every inner call inherits it -- an inner store is overridden, never honoured
  ---
  duration_ms: 9.248114
  type: 'test'
  ...
# Subtest: CR-06 / MCP-04 positive control: a depth-1 nested batch relying on the DOCUMENTED store inheritance validates AND executes
ok 50 - CR-06 / MCP-04 positive control: a depth-1 nested batch relying on the DOCUMENTED store inheritance validates AND executes
  ---
  duration_ms: 8.937677
  type: 'test'
  ...
# Subtest: CR-06 negative control: a chain past the cap is still refused BY NAME, and nothing executes
ok 51 - CR-06 negative control: a chain past the cap is still refused BY NAME, and nothing executes
  ---
  duration_ms: 4.197545
  type: 'test'
  ...
# Subtest: CR-06: an inner store is overridden by the batch's own in BOTH phases, at depth
ok 52 - CR-06: an inner store is overridden by the batch's own in BOTH phases, at depth
  ---
  duration_ms: 8.850966
  type: 'test'
  ...
# Subtest: CR-06: the recursive allow-list still bites -- an uncurated name TWO levels down refuses the WHOLE batch by index
ok 53 - CR-06: the recursive allow-list still bites -- an uncurated name TWO levels down refuses the WHOLE batch by index
  ---
  duration_ms: 4.297082
  type: 'test'
  ...
# Subtest: a batch of derived reads inherits the image too, and the whole batch shares ONE open/close pair
ok 54 - a batch of derived reads inherits the image too, and the whole batch shares ONE open/close pair
  ---
  duration_ms: 9.179756
  type: 'test'
  ...
1..54
# tests 54
# suites 0
# pass 54
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 769.684058
```

### Planted run

- **Plant:** `src/mcp/vice/anno-tools.ts`: `name: "anno_get_symbols",` → `name: "anno_get_symbolz",`
- **Planted command:** `node --test anno-tools.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# (node:256692) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: tracer (MCP-05): anno_get_symbols answers a real query against a real store, end to end
not ok 1 - tracer (MCP-05): anno_get_symbols answers a real query against a real store, end to end
  ---
  duration_ms: 19.664432
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:75:1'
  failureType: 'testCodeFailure'
  error: |-
    expected a successful result, got: anno_get_symbols failed: [AnnoUncuratedToolError] "anno_get_symbols" is not part of the curated anno_* tool surface. Resolution routes: implement it and add it to ANNO_TOOL_DEFINITIONS with a named criterion, or remove the caller reference.
    
    true !== false
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: false
  actual: true
  operator: 'strictEqual'
  stack: |-
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:82:14
    async withStore (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:63:5)
    async TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:76:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
  ...
# Subtest: anno_get_symbols narrows by address range, and reports truncation as a fact rather than leaving it to be inferred
not ok 2 - anno_get_symbols narrows by address range, and reports truncation as a fact rather than leaving it to be inferred
  ---
  duration_ms: 14.25911
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:100:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    
    true !== false
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: false
  actual: true
  operator: 'strictEqual'
  stack: |-
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:114:14
    async withStore (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:63:5)
    async TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:101:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: WR-02 closed: an uncurated name RESOLVES {isError:true} naming both resolution routes -- it does not reject the promise
ok 3 - WR-02 closed: an uncurated name RESOLVES {isError:true} naming both resolution routes -- it does not reject the promise
  ---
  duration_ms: 0.928079
  type: 'test'
  ...
# Subtest: a store path outside the workspace root RESOLVES {isError:true} naming AnnoStorePathError (T-29-01)
not ok 4 - a store path outside the workspace root RESOLVES {isError:true} naming AnnoStorePathError (T-29-01)
  ---
  duration_ms: 3.794289
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:144:1'
  failureType: 'testCodeFailure'
  error: |-
    The input did not match the regular expression /\[AnnoStorePathError\]/. Input:
    
    'anno_get_symbols failed: [AnnoUncuratedToolError] "anno_get_symbols" is not part of the curated anno_* tool surface. Resolution routes: implement it and add it to ANNO_TOOL_DEFINITIONS with a named criterion, or remove the caller reference.'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual: 'anno_get_symbols failed: [AnnoUncuratedToolError] "anno_get_symbols" is not part of the curated anno_* tool surface. Resolution routes: implement it and add it to ANNO_TOOL_DEFINITIONS with a named criterion, or remove the caller reference.'
  operator: 'match'
  stack: |-
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:151:14
    async withStore (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:63:5)
    async TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:145:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: an absent store is refused, never created -- mustExist is what keeps 'gone' and 'empty' distinguishable
ok 5 - an absent store is refused, never created -- mustExist is what keeps 'gone' and 'empty' distinguishable
  ---
  duration_ms: 3.093404
  type: 'test'
  ...
# Subtest: the transport validates nothing, so a missing required argument is refused HERE and named
not ok 6 - the transport validates nothing, so a missing required argument is refused HERE and named
  ---
  duration_ms: 0.886434
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:169:1'
  failureType: 'testCodeFailure'
  error: |-
    The input did not match the regular expression /\[AnnoToolArgumentError\]/. Input:
    
    'anno_get_symbols failed: [AnnoUncuratedToolError] "anno_get_symbols" is not part of the curated anno_* tool surface. Resolution routes: implement it and add it to ANNO_TOOL_DEFINITIONS with a named criterion, or remove the caller reference.'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual: 'anno_get_symbols failed: [AnnoUncuratedToolError] "anno_get_symbols" is not part of the curated anno_* tool surface. Resolution routes: implement it and add it to ANNO_TOOL_DEFINITIONS with a named criterion, or remove the caller reference.'
  operator: 'match'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:172:10)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: an unprefixed numeric address string is refused by the ONE address parser, not accepted by a second rule here
not ok 7 - an unprefixed numeric address string is refused by the ONE address parser, not accepted by a second rule here
  ---
  duration_ms: 3.663672
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:185:1'
  failureType: 'testCodeFailure'
  error: |-
    The input did not match the regular expression /\[AnnoAddressError\]/. Input:
    
    'anno_get_symbols failed: [AnnoUncuratedToolError] "anno_get_symbols" is not part of the curated anno_* tool surface. Resolution routes: implement it and add it to ANNO_TOOL_DEFINITIONS with a named criterion, or remove the caller reference.'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual: 'anno_get_symbols failed: [AnnoUncuratedToolError] "anno_get_symbols" is not part of the curated anno_* tool surface. Resolution routes: implement it and add it to ANNO_TOOL_DEFINITIONS with a named criterion, or remove the caller reference.'
  operator: 'match'
  stack: |-
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:191:14
    async withStore (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:63:5)
    async TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:186:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: assertAnnoTool's FIRST check is set membership: an uncurated name is refused before any argument is looked at
not ok 8 - assertAnnoTool's FIRST check is set membership: an uncurated name is refused before any argument is looked at
  ---
  duration_ms: 1.544945
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:200:1'
  failureType: 'testCodeFailure'
  error: |-
    The error is expected to be an instance of "AnnoToolArgumentError". Received "AnnoUncuratedToolError"
    
    Error message:
    
    "anno_get_symbols" is not part of the curated anno_* tool surface. Resolution routes: implement it and add it to ANNO_TOOL_DEFINITIONS with a named criterion, or remove the caller reference.
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:204:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: CURATED_ANNO_TOOLS is DERIVED from ANNO_TOOL_DEFINITIONS, never a second hand-typed list (T-29-02)
ok 9 - CURATED_ANNO_TOOLS is DERIVED from ANNO_TOOL_DEFINITIONS, never a second hand-typed list (T-29-02)
  ---
  duration_ms: 3.196461
  type: 'test'
  ...
# Subtest: anno-tools.ts holds no module-level mutable store handle (D-06)
ok 10 - anno-tools.ts holds no module-level mutable store handle (D-06)
  ---
  duration_ms: 4.647135
  type: 'test'
  ...
# Subtest: every openStore( in anno-tools.ts is closed by a closeStore( inside a finally (T-29-03)
ok 11 - every openStore( in anno-tools.ts is closed by a closeStore( inside a finally (T-29-03)
  ---
  duration_ms: 1.344729
  type: 'test'
  ...
# Subtest: MCP-02 by construction: anno-tools.ts reaches no VICE transport and no host-path seam
ok 12 - MCP-02 by construction: anno-tools.ts reaches no VICE transport and no host-path seam
  ---
  duration_ms: 1.865636
  type: 'test'
  ...
# Subtest: anno-tools.ts never throws a bare Error -- every refusal is an AnnoStoreError and therefore a ViceError
ok 13 - anno-tools.ts never throws a bare Error -- every refusal is an AnnoStoreError and therefore a ViceError
  ---
  duration_ms: 0.38609
  type: 'test'
  ...
# Subtest: the twelve write and stored-read verbs are advertised, each requiring an explicit store (D-06)
not ok 14 - the twelve write and stored-read verbs are advertised, each requiring an explicit store (D-06)
  ---
  duration_ms: 0.686142
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:344:1'
  failureType: 'testCodeFailure'
  error: 'anno_get_symbols must be in ANNO_TOOL_DEFINITIONS'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:361:12)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: a repeated identical anno_set_label_name SUCCEEDS reporting changed:false -- an annotation pass re-run is not an error
ok 15 - a repeated identical anno_set_label_name SUCCEEDS reporting changed:false -- an annotation pass re-run is not an error
  ---
  duration_ms: 11.443912
  type: 'test'
  ...
# Subtest: an illegal label name is REJECTED by name with the offending name in the message, and nothing is written or sanitized (T-29-23)
ok 16 - an illegal label name is REJECTED by name with the offending name in the message, and nothing is written or sanitized (T-29-23)
  ---
  duration_ms: 3.054636
  type: 'test'
  ...
# Subtest: comment length is bounded in BYTES by the store's own assertion -- this layer adds no second check and no truncation
ok 17 - comment length is bounded in BYTES by the store's own assertion -- this layer adds no second check and no truncation
  ---
  duration_ms: 6.333077
  type: 'test'
  ...
# Subtest: F-4: anno_set_data_type's SUCCESSFUL body carries BOTH contradictedComments and reinterpretedSplitTables
ok 18 - F-4: anno_set_data_type's SUCCESSFUL body carries BOTH contradictedComments and reinterpretedSplitTables
  ---
  duration_ms: 15.815617
  type: 'test'
  ...
# Subtest: F-5: a transposed scope span is refused by the store's overlap rule, and anno_remove_scope makes it recoverable without a revert
ok 19 - F-5: a transposed scope span is refused by the store's overlap rule, and anno_remove_scope makes it recoverable without a revert
  ---
  duration_ms: 19.102074
  type: 'test'
  ...
# Subtest: anno_apply_enum_usage with an omitted or empty name CLEARS the association, matching the schema's own contract
ok 20 - anno_apply_enum_usage with an omitted or empty name CLEARS the association, matching the schema's own contract
  ---
  duration_ms: 17.572858
  type: 'test'
  ...
# Subtest: anno_save_project reports the revision and PERFORMS NO WRITE -- the revision and the store file's mtime are identical before and after
ok 21 - anno_save_project reports the revision and PERFORMS NO WRITE -- the revision and the store file's mtime are identical before and after
  ---
  duration_ms: 8.762814
  type: 'test'
  ...
# Subtest: WR-10: anno_save_project's revision FIELD and the revision named in its own prose are the same value
ok 22 - WR-10: anno_save_project's revision FIELD and the revision named in its own prose are the same value
  ---
  duration_ms: 12.769241
  type: 'test'
  ...
# Subtest: WR-10: dispatchSaveProject() reads the store revision EXACTLY ONCE
ok 23 - WR-10: dispatchSaveProject() reads the store revision EXACTLY ONCE
  ---
  duration_ms: 0.501433
  type: 'test'
  ...
# Subtest: every verb closes the store: no handle is left open and no journal sidecar survives a repeated call
ok 24 - every verb closes the store: no handle is left open and no journal sidecar survives a repeated call
  ---
  duration_ms: 30.51103
  type: 'test'
  ...
# Subtest: anno-tools.ts re-implements no address parsing, no range validation and no data-type membership -- every such check calls an anno-types.ts export
ok 25 - anno-tools.ts re-implements no address parsing, no range validation and no data-type membership -- every such check calls an anno-types.ts export
  ---
  duration_ms: 1.414487
  type: 'test'
  ...
# Subtest: the six derived and composed verbs are advertised, and every one requires an explicit image (D-07)
ok 26 - the six derived and composed verbs are advertised, and every one requires an explicit image (D-07)
  ---
  duration_ms: 0.421602
  type: 'test'
  ...
# Subtest: anno_disassemble decodes at an EXPLICIT address, and the surface names no cursor anywhere (D-09)
ok 27 - anno_disassemble decodes at an EXPLICIT address, and the surface names no cursor anywhere (D-09)
  ---
  duration_ms: 7.525099
  type: 'test'
  ...
# Subtest: D-09: no identifier, schema property or dispatch branch on this surface names a cursor or a current address
ok 28 - D-09: no identifier, schema property or dispatch branch on this surface names a cursor or a current address
  ---
  duration_ms: 0.621487
  type: 'test'
  ...
# Subtest: ONE cap governs BOTH views, is read at call time, and refuses by name with the cap and the requested width
ok 29 - ONE cap governs BOTH views, is read at call time, and refuses by name with the cap and the requested width
  ---
  duration_ms: 4.366077
  type: 'test'
  ...
# Subtest: anno_read_region serves both views, and a span outside the image is reported unanswerable rather than served short
ok 30 - anno_read_region serves both views, and a span outside the image is reported unanswerable rather than served short
  ---
  duration_ms: 7.373818
  type: 'test'
  ...
# Subtest: CR-01 / MCP-04: both read verbs return the SAME {available:false} verdict for an out-of-image address
ok 31 - CR-01 / MCP-04: both read verbs return the SAME {available:false} verdict for an out-of-image address
  ---
  duration_ms: 5.675987
  type: 'test'
  ...
# Subtest: CR-01: the incoherent range is STRUCTURALLY absent -- an out-of-image disassemble carries no end_address and no instructions
ok 32 - CR-01: the incoherent range is STRUCTURALLY absent -- an out-of-image disassemble carries no end_address and no instructions
  ---
  duration_ms: 4.447626
  type: 'test'
  ...
# Subtest: CR-01: an inverted span is refused IDENTICALLY by both verbs, and the one no validator can catch is caught by sliceSpan()
ok 33 - CR-01: an inverted span is refused IDENTICALLY by both verbs, and the one no validator can catch is caught by sliceSpan()
  ---
  duration_ms: 4.628203
  type: 'test'
  ...
# Subtest: CR-01: sliceSpan()'s guard names all THREE cases, so the inverted-span condition cannot be dropped as redundant
ok 34 - CR-01: sliceSpan()'s guard names all THREE cases, so the inverted-span condition cannot be dropped as redundant
  ---
  duration_ms: 0.616058
  type: 'test'
  ...
# Subtest: CR-01 over-refusal control: a span WHOLLY INSIDE the image still succeeds on both verbs, with a non-zero instruction count
ok 35 - CR-01 over-refusal control: a span WHOLLY INSIDE the image still succeeds on both verbs, with a non-zero instruction count
  ---
  duration_ms: 6.391396
  type: 'test'
  ...
# Subtest: CR-01: an OMITTED end_address still defaults to the image's own bound -- removing the clamp must not remove the ergonomics
ok 36 - CR-01: an OMITTED end_address still defaults to the image's own bound -- removing the clamp must not remove the ergonomics
  ---
  duration_ms: 4.245667
  type: 'test'
  ...
# Subtest: anno_get_binary_info reports the load address, origin and lengths for a real PRG, and refuses a non-PRG by name
ok 37 - anno_get_binary_info reports the load address, origin and lengths for a real PRG, and refuses a non-PRG by name
  ---
  duration_ms: 18.872221
  type: 'test'
  ...
# Subtest: anno_get_cross_references returns the derivation module's union, and the store is byte-identical afterwards
ok 38 - anno_get_cross_references returns the derivation module's union, and the store is byte-identical afterwards
  ---
  duration_ms: 13.444252
  type: 'test'
  ...
# Subtest: anno_search: max_results is REQUIRED with no default, and a capped answer reports the true total
ok 39 - anno_search: max_results is REQUIRED with no default, and a capped answer reports the true total
  ---
  duration_ms: 17.865761
  type: 'test'
  ...
# Subtest: anno_search naming a corpus this surface does not have answers {available:false, reason} in a SUCCESSFUL body, never an empty result set
ok 40 - anno_search naming a corpus this surface does not have answers {available:false, reason} in a SUCCESSFUL body, never an empty result set
  ---
  duration_ms: 7.936712
  type: 'test'
  ...
# Subtest: anno_get_address_details returns the composition with its composed_from disclosure intact
ok 41 - anno_get_address_details returns the composition with its composed_from disclosure intact
  ---
  duration_ms: 16.522453
  type: 'test'
  ...
# Subtest: an image outside the workspace root, or absent, is refused by name -- the same containment the store path gets
ok 42 - an image outside the workspace root, or absent, is refused by name -- the same containment the store path gets
  ---
  duration_ms: 10.538861
  type: 'test'
  ...
# Subtest: anno_batch_execute is advertised as the ONE sanctioned nested-argument verb, and the header says no second may join it
ok 43 - anno_batch_execute is advertised as the ONE sanctioned nested-argument verb, and the header says no second may join it
  ---
  duration_ms: 0.606483
  type: 'test'
  ...
# Subtest: the six whole-batch refusal shapes, each naming what it refused on
ok 44 - the six whole-batch refusal shapes, each naming what it refused on
  ---
  duration_ms: 6.162568
  type: 'test'
  ...
# Subtest: the batch validator recurses: an uncurated name one level down still refuses the WHOLE batch
ok 45 - the batch validator recurses: an uncurated name one level down still refuses the WHOLE batch
  ---
  duration_ms: 0.516048
  type: 'test'
  ...
# Subtest: nesting deeper than the declared cap is refused BY NAME rather than walked (T-29-24)
ok 46 - nesting deeper than the declared cap is refused BY NAME rather than walked (T-29-24)
  ---
  duration_ms: 1.148832
  type: 'test'
  ...
# Subtest: NOTHING executes when pre-validation refuses: the revision is unchanged and no partial write is visible
not ok 47 - NOTHING executes when pre-validation refuses: the revision is unchanged and no partial write is visible
  ---
  duration_ms: 10.293435
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:1241:1'
  failureType: 'testCodeFailure'
  error: `Unexpected token 'a', "anno_get_s"... is not valid JSON`
  code: 'ERR_TEST_FAILURE'
  name: 'SyntaxError'
  stack: |-
    JSON.parse (<anonymous>)
    body (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:341:15)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:1265:34
    async withStore (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:63:5)
    async TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:1242:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: execution runs to COMPLETION: a three-call batch whose middle call fails returns three per-item entries, in order
not ok 48 - execution runs to COMPLETION: a three-call batch whose middle call fails returns three per-item entries, in order
  ---
  duration_ms: 21.37333
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:1271:1'
  failureType: 'testCodeFailure'
  error: `Unexpected token 'a', "anno_get_s"... is not valid JSON`
  code: 'ERR_TEST_FAILURE'
  name: 'SyntaxError'
  stack: |-
    JSON.parse (<anonymous>)
    body (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:341:15)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:1308:29
    async withStore (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:63:5)
    async TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:1272:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: a batch names its store ONCE and every inner call inherits it -- an inner store is overridden, never honoured
not ok 49 - a batch names its store ONCE and every inner call inherits it -- an inner store is overridden, never honoured
  ---
  duration_ms: 8.659203
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:1314:1'
  failureType: 'testCodeFailure'
  error: `Unexpected token 'a', "anno_get_s"... is not valid JSON`
  code: 'ERR_TEST_FAILURE'
  name: 'SyntaxError'
  stack: |-
    JSON.parse (<anonymous>)
    body (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:341:15)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:1328:29
    async withStore (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:63:5)
    async TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:1315:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: CR-06 / MCP-04 positive control: a depth-1 nested batch relying on the DOCUMENTED store inheritance validates AND executes
not ok 50 - CR-06 / MCP-04 positive control: a depth-1 nested batch relying on the DOCUMENTED store inheritance validates AND executes
  ---
  duration_ms: 8.101789
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:1352:1'
  failureType: 'testCodeFailure'
  error: `Unexpected token 'a', "anno_get_s"... is not valid JSON`
  code: 'ERR_TEST_FAILURE'
  name: 'SyntaxError'
  stack: |-
    JSON.parse (<anonymous>)
    body (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:341:15)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:1375:29
    async withStore (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:63:5)
    async TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:1353:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: CR-06 negative control: a chain past the cap is still refused BY NAME, and nothing executes
not ok 51 - CR-06 negative control: a chain past the cap is still refused BY NAME, and nothing executes
  ---
  duration_ms: 3.439015
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:1381:1'
  failureType: 'testCodeFailure'
  error: `Unexpected token 'a', "anno_get_s"... is not valid JSON`
  code: 'ERR_TEST_FAILURE'
  name: 'SyntaxError'
  stack: |-
    JSON.parse (<anonymous>)
    body (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:341:15)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:1403:29
    async withStore (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:63:5)
    async TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:1382:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: CR-06: an inner store is overridden by the batch's own in BOTH phases, at depth
not ok 52 - CR-06: an inner store is overridden by the batch's own in BOTH phases, at depth
  ---
  duration_ms: 8.120182
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:1409:1'
  failureType: 'testCodeFailure'
  error: `Unexpected token 'a', "anno_get_s"... is not valid JSON`
  code: 'ERR_TEST_FAILURE'
  name: 'SyntaxError'
  stack: |-
    JSON.parse (<anonymous>)
    body (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:341:15)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:1436:29
    async withStore (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:63:5)
    async TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:1410:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: CR-06: the recursive allow-list still bites -- an uncurated name TWO levels down refuses the WHOLE batch by index
not ok 53 - CR-06: the recursive allow-list still bites -- an uncurated name TWO levels down refuses the WHOLE batch by index
  ---
  duration_ms: 3.382213
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:1443:1'
  failureType: 'testCodeFailure'
  error: `Unexpected token 'a', "anno_get_s"... is not valid JSON`
  code: 'ERR_TEST_FAILURE'
  name: 'SyntaxError'
  stack: |-
    JSON.parse (<anonymous>)
    body (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:341:15)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:1466:29
    async withStore (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:63:5)
    async TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a2cdc88cd26fc28b0/src/mcp/vice/anno-tools.test.ts:1444:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: a batch of derived reads inherits the image too, and the whole batch shares ONE open/close pair
ok 54 - a batch of derived reads inherits the image too, and the whole batch shares ONE open/close pair
  ---
  duration_ms: 9.860311
  type: 'test'
  ...
1..54
# tests 54
# suites 0
# pass 40
# fail 14
# cancelled 0
# skipped 0
# todo 0
# duration_ms 905.962732
```

