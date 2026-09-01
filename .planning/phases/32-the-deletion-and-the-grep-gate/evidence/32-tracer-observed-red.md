# Phase 32 — observed-red evidence (machine-captured)

Written by `scripts/audit-mutation-harness.mjs`. Every field below is a captured `spawnSync` result, not a transcription. Re-run the command in each row's **planted command** line after applying that row's plant to reproduce it.

- **Commit measured:** `d6bebb188282369fe7afe7ca2b6ffd293a90a840`
- **Measured at:** 2026-08-31T15:49:28.948Z
- **Root:** `/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-adc0e44067665a83e`
- **Rows measured:** 1

## Tree state

`git status --porcelain` BEFORE the run (the baseline every row is compared to):

```
?? .planning/phases/32-the-deletion-and-the-grep-gate/evidence/
?? .planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json
?? scripts/audit-mutation-harness.mjs
?? scripts/check-guard-fates.mjs
?? scripts/lib/audit-root.mjs
```

`git status --porcelain` AFTER the run:

```
?? .planning/phases/32-the-deletion-and-the-grep-gate/evidence/
?? .planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json
?? scripts/audit-mutation-harness.mjs
?? scripts/check-guard-fates.mjs
?? scripts/lib/audit-root.mjs
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
  duration_ms: 10.088603
  type: 'test'
  ...
# Subtest: positive control: every real verb is named by at least one real skill file (the Task 1 property, restated mechanically)
ok 2 - positive control: every real verb is named by at least one real skill file (the Task 1 property, restated mechanically)
  ---
  duration_ms: 11.260547
  type: 'test'
  ...
# Subtest: planted violation: an extra, genuinely new case is parsed and reported missing, while a real, documented verb is not
ok 3 - planted violation: an extra, genuinely new case is parsed and reported missing, while a real, documented verb is not
  ---
  duration_ms: 3.731793
  type: 'test'
  ...
# Subtest: comment hygiene: a case hidden in a block comment or a line comment is never parsed as a verb
ok 4 - comment hygiene: a case hidden in a block comment or a line comment is never parsed as a verb
  ---
  duration_ms: 0.310203
  type: 'test'
  ...
# Subtest: non-vacuity floor: ANNO_CLI_VERB_FLOOR matches the measured true count and the real parse meets it
ok 5 - non-vacuity floor: ANNO_CLI_VERB_FLOOR matches the measured true count and the real parse meets it
  ---
  duration_ms: 1.891102
  type: 'test'
  ...
# Subtest: the CI script's live execution path: `node scripts/check-skill-tool-coverage.mjs` exits 0 with 'OK' in stdout
ok 6 - the CI script's live execution path: `node scripts/check-skill-tool-coverage.mjs` exits 0 with 'OK' in stdout
  ---
  duration_ms: 295.039196
  type: 'test'
  ...
# Subtest: a verb the CLI actually dispatches is never documented as withdrawn, in either skill tree
ok 7 - a verb the CLI actually dispatches is never documented as withdrawn, in either skill tree
  ---
  duration_ms: 11.726891
  type: 'test'
  ...
# Subtest: the shipped skill tree's markdown is byte-identical to the source tree's -- asserted, never regenerated (30-REVIEW WR-11)
ok 8 - the shipped skill tree's markdown is byte-identical to the source tree's -- asserted, never regenerated (30-REVIEW WR-11)
  ---
  duration_ms: 0.799912
  type: 'test'
  ...
# Subtest: planted violation: the same predicate reports a dispatched verb documented as withdrawn, and stays silent for one the CLI does not dispatch
ok 9 - planted violation: the same predicate reports a dispatched verb documented as withdrawn, and stays silent for one the CLI does not dispatch
  ---
  duration_ms: 4.787598
  type: 'test'
  ...
# Subtest: planted control: an UNRELATED `returned` does not discharge a stale withdrawal claim (30-REVIEW WR-11)
ok 10 - planted control: an UNRELATED `returned` does not discharge a stale withdrawal claim (30-REVIEW WR-11)
  ---
  duration_ms: 6.245963
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
# duration_ms 577.992501
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
  duration_ms: 17.71857
  type: 'test'
  ...
# Subtest: positive control: every real verb is named by at least one real skill file (the Task 1 property, restated mechanically)
ok 2 - positive control: every real verb is named by at least one real skill file (the Task 1 property, restated mechanically)
  ---
  duration_ms: 16.157801
  type: 'test'
  ...
# Subtest: planted violation: an extra, genuinely new case is parsed and reported missing, while a real, documented verb is not
ok 3 - planted violation: an extra, genuinely new case is parsed and reported missing, while a real, documented verb is not
  ---
  duration_ms: 4.996694
  type: 'test'
  ...
# Subtest: comment hygiene: a case hidden in a block comment or a line comment is never parsed as a verb
ok 4 - comment hygiene: a case hidden in a block comment or a line comment is never parsed as a verb
  ---
  duration_ms: 0.475544
  type: 'test'
  ...
# Subtest: non-vacuity floor: ANNO_CLI_VERB_FLOOR matches the measured true count and the real parse meets it
not ok 5 - non-vacuity floor: ANNO_CLI_VERB_FLOOR matches the measured true count and the real parse meets it
  ---
  duration_ms: 2.145079
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-adc0e44067665a83e/src/mcp/vice/anno-verb-coverage.test.ts:184:1'
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
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-adc0e44067665a83e/src/mcp/vice/anno-verb-coverage.test.ts:185:10)
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
  duration_ms: 394.730146
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-adc0e44067665a83e/src/mcp/vice/anno-verb-coverage.test.ts:191:1'
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
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-adc0e44067665a83e/src/mcp/vice/anno-verb-coverage.test.ts:194:10)
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
  duration_ms: 4.042493
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-adc0e44067665a83e/src/mcp/vice/anno-verb-coverage.test.ts:376:1'
  failureType: 'testCodeFailure'
  error: 'the verb parse itself is broken; this scan would be vacuous'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-adc0e44067665a83e/src/mcp/vice/anno-verb-coverage.test.ts:391:10)
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
  duration_ms: 0.928877
  type: 'test'
  ...
# Subtest: planted violation: the same predicate reports a dispatched verb documented as withdrawn, and stays silent for one the CLI does not dispatch
ok 9 - planted violation: the same predicate reports a dispatched verb documented as withdrawn, and stays silent for one the CLI does not dispatch
  ---
  duration_ms: 6.803796
  type: 'test'
  ...
# Subtest: planted control: an UNRELATED `returned` does not discharge a stale withdrawal claim (30-REVIEW WR-11)
ok 10 - planted control: an UNRELATED `returned` does not discharge a stale withdrawal claim (30-REVIEW WR-11)
  ---
  duration_ms: 4.615568
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
# duration_ms 719.808611
```

