# Phase 32 — observed-red evidence (machine-captured)

Written by `scripts/audit-mutation-harness.mjs`. Every field below is a captured `spawnSync` result, not a transcription. Re-run the command in each row's **planted command** line after applying that row's plant to reproduce it.

- **Commit measured:** `e1abf160d6f985f04dd5c8efedbb9bc6fff3f25a`
- **Measured at:** 2026-09-01T07:11:19.588Z
- **Root:** `/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef`
- **Rows selected:** 61 (35 measured, 26 skipped)

## Tree state

`git status --porcelain` BEFORE the run (the baseline every row is compared to):

```
?? .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap4-sweep-rerun.md
```

`git status --porcelain` AFTER the run:

```
?? .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap4-sweep-rerun.md
```

**Byte-identical.** Every plant was reverted.

## `src/mcp/vice/r2000-verb-coverage.test.ts` — verdict `re-pointed`

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
  duration_ms: 7.306362
  type: 'test'
  ...
# Subtest: positive control: every real verb is named by at least one real skill file (the Task 1 property, restated mechanically)
ok 2 - positive control: every real verb is named by at least one real skill file (the Task 1 property, restated mechanically)
  ---
  duration_ms: 15.035826
  type: 'test'
  ...
# Subtest: planted violation: an extra, genuinely new case is parsed and reported missing, while a real, documented verb is not
ok 3 - planted violation: an extra, genuinely new case is parsed and reported missing, while a real, documented verb is not
  ---
  duration_ms: 3.514019
  type: 'test'
  ...
# Subtest: comment hygiene: a case hidden in a block comment or a line comment is never parsed as a verb
ok 4 - comment hygiene: a case hidden in a block comment or a line comment is never parsed as a verb
  ---
  duration_ms: 0.369226
  type: 'test'
  ...
# Subtest: non-vacuity floor: ANNO_CLI_VERB_FLOOR matches the measured true count and the real parse meets it
ok 5 - non-vacuity floor: ANNO_CLI_VERB_FLOOR matches the measured true count and the real parse meets it
  ---
  duration_ms: 2.295982
  type: 'test'
  ...
# Subtest: the CI script's live execution path: `node scripts/check-skill-tool-coverage.mjs` exits 0 with 'OK' in stdout
ok 6 - the CI script's live execution path: `node scripts/check-skill-tool-coverage.mjs` exits 0 with 'OK' in stdout
  ---
  duration_ms: 250.380716
  type: 'test'
  ...
# Subtest: a verb the CLI actually dispatches is never documented as withdrawn, in either skill tree
ok 7 - a verb the CLI actually dispatches is never documented as withdrawn, in either skill tree
  ---
  duration_ms: 10.672242
  type: 'test'
  ...
# Subtest: the shipped skill tree's markdown is byte-identical to the source tree's -- asserted, never regenerated (30-REVIEW WR-11)
ok 8 - the shipped skill tree's markdown is byte-identical to the source tree's -- asserted, never regenerated (30-REVIEW WR-11)
  ---
  duration_ms: 4.123723
  type: 'test'
  ...
# Subtest: planted violation: the same predicate reports a dispatched verb documented as withdrawn, and stays silent for one the CLI does not dispatch
ok 9 - planted violation: the same predicate reports a dispatched verb documented as withdrawn, and stays silent for one the CLI does not dispatch
  ---
  duration_ms: 3.131946
  type: 'test'
  ...
# Subtest: planted control: an UNRELATED `returned` does not discharge a stale withdrawal claim (30-REVIEW WR-11)
ok 10 - planted control: an UNRELATED `returned` does not discharge a stale withdrawal claim (30-REVIEW WR-11)
  ---
  duration_ms: 2.267073
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
# duration_ms 427.768063
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
  duration_ms: 8.251761
  type: 'test'
  ...
# Subtest: positive control: every real verb is named by at least one real skill file (the Task 1 property, restated mechanically)
ok 2 - positive control: every real verb is named by at least one real skill file (the Task 1 property, restated mechanically)
  ---
  duration_ms: 11.280102
  type: 'test'
  ...
# Subtest: planted violation: an extra, genuinely new case is parsed and reported missing, while a real, documented verb is not
ok 3 - planted violation: an extra, genuinely new case is parsed and reported missing, while a real, documented verb is not
  ---
  duration_ms: 3.664242
  type: 'test'
  ...
# Subtest: comment hygiene: a case hidden in a block comment or a line comment is never parsed as a verb
ok 4 - comment hygiene: a case hidden in a block comment or a line comment is never parsed as a verb
  ---
  duration_ms: 0.395867
  type: 'test'
  ...
# Subtest: non-vacuity floor: ANNO_CLI_VERB_FLOOR matches the measured true count and the real parse meets it
not ok 5 - non-vacuity floor: ANNO_CLI_VERB_FLOOR matches the measured true count and the real parse meets it
  ---
  duration_ms: 1.705411
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-verb-coverage.test.ts:184:1'
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
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-verb-coverage.test.ts:185:10)
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
  duration_ms: 215.227402
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-verb-coverage.test.ts:191:1'
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
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-verb-coverage.test.ts:194:10)
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
  duration_ms: 2.731653
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-verb-coverage.test.ts:376:1'
  failureType: 'testCodeFailure'
  error: 'the verb parse itself is broken; this scan would be vacuous'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-verb-coverage.test.ts:391:10)
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
  duration_ms: 4.881271
  type: 'test'
  ...
# Subtest: planted violation: the same predicate reports a dispatched verb documented as withdrawn, and stays silent for one the CLI does not dispatch
ok 9 - planted violation: the same predicate reports a dispatched verb documented as withdrawn, and stays silent for one the CLI does not dispatch
  ---
  duration_ms: 2.617372
  type: 'test'
  ...
# Subtest: planted control: an UNRELATED `returned` does not discharge a stale withdrawal claim (30-REVIEW WR-11)
ok 10 - planted control: an UNRELATED `returned` does not discharge a stale withdrawal claim (30-REVIEW WR-11)
  ---
  duration_ms: 1.947089
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
# duration_ms 410.679476
```

## `scripts/lib/r2000-cli-verbs.mjs` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node scripts/check-skill-tool-coverage.mjs`
- **cwd:** `.`
- **Exit status:** `0` (must be 0)

Raw output:

```
check-skill-tool-coverage: OK -- 37 distinct vice_* names extracted from 33 files across 7 skill directories; 31 resolved as advertised on the stock manifest (38 tools total). Classified: 0 proxy-local (neither manifest), 2 proxy-local-with-stock-manifest-entry, 1 deny-listed, 2 not-a-tool-name, 6 fork-only-unrecoverable, 0 pending-later-phase. anno_*: 18 distinct names extracted, all curated (CURATED_ANNO_TOOLS has 19 entries). anno CLI verbs: 3 parsed from anno-cli.ts, 3/3 resolved (named by at least one skill file).

(node:61517) ExperimentalWarning: SQLite is an experimental feature and might change at any time
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

## `scripts/lib/r2000-cli-verbs.d.mts` — verdict `re-pointed`

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

## `src/mcp/vice/docs-r2000-decisions.test.ts` — verdict `re-pointed`

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
  duration_ms: 1.918342
  type: 'test'
  ...
# Subtest: 2. ARCHITECTURE.md's Architecture Change Record names D-17/D-18, carries a date, has six numbered steps, and names both guard filenames in step 5
ok 2 - 2. ARCHITECTURE.md's Architecture Change Record names D-17/D-18, carries a date, has six numbered steps, and names both guard filenames in step 5
  ---
  duration_ms: 0.552083
  type: 'test'
  ...
# Subtest: 3. ARCHITECTURE.md carries Rule A21 naming resolveStorePath, ChildProcess, and r2000-mcp-client.ts
ok 3 - 3. ARCHITECTURE.md carries Rule A21 naming resolveStorePath, ChildProcess, and r2000-mcp-client.ts
  ---
  duration_ms: 0.303336
  type: 'test'
  ...
# Subtest: 4. PROJECT.md's Key Decisions D-36 row states supersession of D-32, names handler.rs:1894, the upstream issue url, and a named reversal-trigger phrase
ok 4 - 4. PROJECT.md's Key Decisions D-36 row states supersession of D-32, names handler.rs:1894, the upstream issue url, and a named reversal-trigger phrase
  ---
  duration_ms: 0.861182
  type: 'test'
  ...
# Subtest: 5. cross-document consistency: every PROJECT.md line naming D-32 also names D-36 or the word 'supersede'
ok 5 - 5. cross-document consistency: every PROJECT.md line naming D-32 also names D-36 or the word 'supersede'
  ---
  duration_ms: 0.781275
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
# duration_ms 122.335244
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
  duration_ms: 1.954417
  type: 'test'
  ...
# Subtest: 2. ARCHITECTURE.md's Architecture Change Record names D-17/D-18, carries a date, has six numbered steps, and names both guard filenames in step 5
ok 2 - 2. ARCHITECTURE.md's Architecture Change Record names D-17/D-18, carries a date, has six numbered steps, and names both guard filenames in step 5
  ---
  duration_ms: 0.540759
  type: 'test'
  ...
# Subtest: 3. ARCHITECTURE.md carries Rule A21 naming resolveStorePath, ChildProcess, and r2000-mcp-client.ts
ok 3 - 3. ARCHITECTURE.md carries Rule A21 naming resolveStorePath, ChildProcess, and r2000-mcp-client.ts
  ---
  duration_ms: 0.304731
  type: 'test'
  ...
# Subtest: 4. PROJECT.md's Key Decisions D-36 row states supersession of D-32, names handler.rs:1894, the upstream issue url, and a named reversal-trigger phrase
not ok 4 - 4. PROJECT.md's Key Decisions D-36 row states supersession of D-32, names handler.rs:1894, the upstream issue url, and a named reversal-trigger phrase
  ---
  duration_ms: 1.380872
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/docs-absorbed-decisions.test.ts:198:1'
  failureType: 'testCodeFailure'
  error: 'the D-36 row does not name handler.rs:1894'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/docs-absorbed-decisions.test.ts:205:10)
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
  duration_ms: 0.869301
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
# duration_ms 122.742168
```

## `src/mcp/vice/r2000-answer-key.test.ts` — verdict `re-pointed`

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
  duration_ms: 1.923199
  type: 'test'
  ...
# Subtest: ANSWER.sha256 matches the sha256 recomputed from ANSWER.md's own canonical line (T-11-SEAL-DRIFT)
ok 2 - ANSWER.sha256 matches the sha256 recomputed from ANSWER.md's own canonical line (T-11-SEAL-DRIFT)
  ---
  duration_ms: 1.211886
  type: 'test'
  ...
# Subtest: the canonical answer line matches QUESTION.md's own grammar (four lowercase key=value fields, single spaces)
ok 3 - the canonical answer line matches QUESTION.md's own grammar (four lowercase key=value fields, single spaces)
  ---
  duration_ms: 0.412907
  type: 'test'
  ...
# Subtest: QUESTION.md does not contain the canonical answer line (T-11-LEAK)
ok 4 - QUESTION.md does not contain the canonical answer line (T-11-LEAK)
  ---
  duration_ms: 0.334652
  type: 'test'
  ...
# Subtest: QUESTION.md does not contain the sealed answer's distinctive field values (T-11-LEAK)
ok 5 - QUESTION.md does not contain the sealed answer's distinctive field values (T-11-LEAK)
  ---
  duration_ms: 0.561717
  type: 'test'
  ...
# Subtest: SESSION-B-ANSWER.md's canonical line hashes to the sealed ANSWER.sha256 (criterion 1, D-26 two-session comparison)
ok 6 - SESSION-B-ANSWER.md's canonical line hashes to the sealed ANSWER.sha256 (criterion 1, D-26 two-session comparison)
  ---
  duration_ms: 0.363427
  type: 'test'
  ...
# Subtest: SESSION-B-ANSWER.md's canonical line matches QUESTION.md's own grammar
ok 7 - SESSION-B-ANSWER.md's canonical line matches QUESTION.md's own grammar
  ---
  duration_ms: 0.337464
  type: 'test'
  ...
# Subtest: ACME availability gate (D-08), reused for criterion 1's fixture reproducibility
ok 8 - ACME availability gate (D-08), reused for criterion 1's fixture reproducibility
  ---
  duration_ms: 0.228506
  type: 'test'
  ...
# Subtest: criterion 1's committed fixture source and .prg both exist (non-vacuity for the byte-compare below)
ok 9 - criterion 1's committed fixture source and .prg both exist (non-vacuity for the byte-compare below)
  ---
  duration_ms: 0.782634
  type: 'test'
  ...
# Subtest: gated: assembling criterion 1's fixture source under real ACME reproduces the committed .prg byte-for-byte (11-07-T1)
ok 10 - gated: assembling criterion 1's fixture source under real ACME reproduces the committed .prg byte-for-byte (11-07-T1)
  ---
  duration_ms: 4.080919
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
# duration_ms 133.592729
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
  duration_ms: 1.121373
  type: 'test'
  ...
# Subtest: ANSWER.sha256 matches the sha256 recomputed from ANSWER.md's own canonical line (T-11-SEAL-DRIFT)
not ok 2 - ANSWER.sha256 matches the sha256 recomputed from ANSWER.md's own canonical line (T-11-SEAL-DRIFT)
  ---
  duration_ms: 1.584196
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/absorbed-answer-key.test.ts:84:1'
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
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/absorbed-answer-key.test.ts:89:10)
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
  duration_ms: 0.275384
  type: 'test'
  ...
# Subtest: QUESTION.md does not contain the canonical answer line (T-11-LEAK)
ok 4 - QUESTION.md does not contain the canonical answer line (T-11-LEAK)
  ---
  duration_ms: 0.212698
  type: 'test'
  ...
# Subtest: QUESTION.md does not contain the sealed answer's distinctive field values (T-11-LEAK)
ok 5 - QUESTION.md does not contain the sealed answer's distinctive field values (T-11-LEAK)
  ---
  duration_ms: 0.366803
  type: 'test'
  ...
# Subtest: SESSION-B-ANSWER.md's canonical line hashes to the sealed ANSWER.sha256 (criterion 1, D-26 two-session comparison)
not ok 6 - SESSION-B-ANSWER.md's canonical line hashes to the sealed ANSWER.sha256 (criterion 1, D-26 two-session comparison)
  ---
  duration_ms: 0.416971
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/absorbed-answer-key.test.ts:179:1'
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
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/absorbed-answer-key.test.ts:184:10)
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
  duration_ms: 0.226887
  type: 'test'
  ...
# Subtest: ACME availability gate (D-08), reused for criterion 1's fixture reproducibility
ok 8 - ACME availability gate (D-08), reused for criterion 1's fixture reproducibility
  ---
  duration_ms: 0.121912
  type: 'test'
  ...
# Subtest: criterion 1's committed fixture source and .prg both exist (non-vacuity for the byte-compare below)
ok 9 - criterion 1's committed fixture source and .prg both exist (non-vacuity for the byte-compare below)
  ---
  duration_ms: 0.471537
  type: 'test'
  ...
# Subtest: gated: assembling criterion 1's fixture source under real ACME reproduces the committed .prg byte-for-byte (11-07-T1)
ok 10 - gated: assembling criterion 1's fixture source under real ACME reproduces the committed .prg byte-for-byte (11-07-T1)
  ---
  duration_ms: 4.093423
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
# duration_ms 172.76507
```

## `src/mcp/vice/r2000-spawn-seam.test.ts` — verdict `re-pointed`

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
  duration_ms: 183.661629
  type: 'test'
  ...
# Subtest: every discovered emulator spawn site uses the argv-array form and builds no shell command string
ok 2 - every discovered emulator spawn site uses the argv-array form and builds no shell command string
  ---
  duration_ms: 145.217381
  type: 'test'
  ...
# Subtest: non-vacuity: the scanned module set is real, and at least one emulator spawn call site was discovered
ok 3 - non-vacuity: the scanned module set is real, and at least one emulator spawn call site was discovered
  ---
  duration_ms: 120.21067
  type: 'test'
  ...
# Subtest: planted violation: a module that spawns the emulator through a shell command string is reported unsafe
ok 4 - planted violation: a module that spawns the emulator through a shell command string is reported unsafe
  ---
  duration_ms: 0.525425
  type: 'test'
  ...
# Subtest: planted violation: a module whose emulator spawn passes an argv array reports safe
ok 5 - planted violation: a module whose emulator spawn passes an argv array reports safe
  ---
  duration_ms: 0.384814
  type: 'test'
  ...
# Subtest: planted violation: an argv-form emulator spawn whose second argument is a bare string, not an array, is reported unsafe
ok 6 - planted violation: an argv-form emulator spawn whose second argument is a bare string, not an array, is reported unsafe
  ---
  duration_ms: 0.359556
  type: 'test'
  ...
# Subtest: planted violation control: an emulator spawn mention that exists ONLY inside a block comment and a string literal is NOT reported
ok 7 - planted violation control: an emulator spawn mention that exists ONLY inside a block comment and a string literal is NOT reported
  ---
  duration_ms: 0.333115
  type: 'test'
  ...
# Subtest: planted violation control: a RegExp.prototype.exec() call is never mistaken for a shell spawn
ok 8 - planted violation control: a RegExp.prototype.exec() call is never mistaken for a shell spawn
  ---
  duration_ms: 0.272339
  type: 'test'
  ...
# Subtest: backend-detect.mts's own probeBackend() spawnSync(binPath, [flag] call is discovered and reports safe
ok 9 - backend-detect.mts's own probeBackend() spawnSync(binPath, [flag] call is discovered and reports safe
  ---
  duration_ms: 2.892212
  type: 'test'
  ...
# Subtest: the one-spawn-site invariant: backend-detect.mts contains exactly ONE emulator spawn call -- a second path means a probe was added without re-running the decision
ok 10 - the one-spawn-site invariant: backend-detect.mts contains exactly ONE emulator spawn call -- a second path means a probe was added without re-running the decision
  ---
  duration_ms: 2.873564
  type: 'test'
  ...
# Subtest: planted violation: duplicating backend-detect.mts's spawn statement into a second function makes the one-spawn-site invariant fail
ok 11 - planted violation: duplicating backend-detect.mts's spawn statement into a second function makes the one-spawn-site invariant fail
  ---
  duration_ms: 5.413344
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
# duration_ms 591.445353
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
  duration_ms: 197.086436
  type: 'test'
  ...
# Subtest: every discovered emulator spawn site uses the argv-array form and builds no shell command string
not ok 2 - every discovered emulator spawn site uses the argv-array form and builds no shell command string
  ---
  duration_ms: 141.559873
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/spawn-seam.test.ts:301:1'
  failureType: 'testCodeFailure'
  error: 'backend-detect.mts: not every emulator spawn call passes an argv ARRAY as its second argument (the command-injection invariant this seam exists to hold)'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/spawn-seam.test.ts:311:12)
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
  duration_ms: 141.405362
  type: 'test'
  ...
# Subtest: planted violation: a module that spawns the emulator through a shell command string is reported unsafe
ok 4 - planted violation: a module that spawns the emulator through a shell command string is reported unsafe
  ---
  duration_ms: 0.526392
  type: 'test'
  ...
# Subtest: planted violation: a module whose emulator spawn passes an argv array reports safe
ok 5 - planted violation: a module whose emulator spawn passes an argv array reports safe
  ---
  duration_ms: 0.353895
  type: 'test'
  ...
# Subtest: planted violation: an argv-form emulator spawn whose second argument is a bare string, not an array, is reported unsafe
ok 6 - planted violation: an argv-form emulator spawn whose second argument is a bare string, not an array, is reported unsafe
  ---
  duration_ms: 0.423627
  type: 'test'
  ...
# Subtest: planted violation control: an emulator spawn mention that exists ONLY inside a block comment and a string literal is NOT reported
ok 7 - planted violation control: an emulator spawn mention that exists ONLY inside a block comment and a string literal is NOT reported
  ---
  duration_ms: 0.297806
  type: 'test'
  ...
# Subtest: planted violation control: a RegExp.prototype.exec() call is never mistaken for a shell spawn
ok 8 - planted violation control: a RegExp.prototype.exec() call is never mistaken for a shell spawn
  ---
  duration_ms: 0.254631
  type: 'test'
  ...
# Subtest: backend-detect.mts's own probeBackend() spawnSync(binPath, [flag] call is discovered and reports safe
not ok 9 - backend-detect.mts's own probeBackend() spawnSync(binPath, [flag] call is discovered and reports safe
  ---
  duration_ms: 3.498116
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/spawn-seam.test.ts:429:1'
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
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/spawn-seam.test.ts:434:10)
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
  duration_ms: 2.909883
  type: 'test'
  ...
# Subtest: planted violation: duplicating backend-detect.mts's spawn statement into a second function makes the one-spawn-site invariant fail
ok 11 - planted violation: duplicating backend-detect.mts's spawn statement into a second function makes the one-spawn-site invariant fail
  ---
  duration_ms: 5.170996
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
# duration_ms 623.859324
```

## `src/mcp/vice/r2000-cli.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test --test-name-pattern VERB_OPTIONS carries exactly the surviving verbs anno-cli.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# (node:61847) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: VERB_OPTIONS carries exactly the surviving verbs
ok 1 - VERB_OPTIONS carries exactly the surviving verbs
  ---
  duration_ms: 1.953963
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
# duration_ms 1464.417779
```

### Planted run

- **Plant:** `src/mcp/vice/anno-cli.ts`: `"export-asm": ["--store", "--out", "--force"],` → `"export-asmX": ["--store", "--out", "--force"],`
- **Planted command:** `node --test --test-name-pattern VERB_OPTIONS carries exactly the surviving verbs anno-cli.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# (node:61976) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: VERB_OPTIONS carries exactly the surviving verbs
not ok 1 - VERB_OPTIONS carries exactly the surviving verbs
  ---
  duration_ms: 3.0594
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-cli.test.ts:331:1'
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
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-cli.test.ts:332:10)
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
# duration_ms 1563.929506
```

## `src/mcp/vice/r2000-confidence.test.ts` — verdict `re-pointed`

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
  duration_ms: 2.78755
  type: 'test'
  ...
# Subtest: CONFIDENCE_GRADES tokens and brackets are the five canonical bracket tokens
ok 2 - CONFIDENCE_GRADES tokens and brackets are the five canonical bracket tokens
  ---
  duration_ms: 0.435349
  type: 'test'
  ...
# Subtest: every grade round-trips through formatConfidenceComment -> parseConfidencePrefix
ok 3 - every grade round-trips through formatConfidenceComment -> parseConfidencePrefix
  ---
  duration_ms: 0.557158
  type: 'test'
  ...
# Subtest: parseConfidencePrefix returns grade: null for a plain comment, without throwing
ok 4 - parseConfidencePrefix returns grade: null for a plain comment, without throwing
  ---
  duration_ms: 0.234543
  type: 'test'
  ...
# Subtest: parseConfidencePrefix returns grade: null for an empty comment
ok 5 - parseConfidencePrefix returns grade: null for an empty comment
  ---
  duration_ms: 0.350983
  type: 'test'
  ...
# Subtest: parseConfidencePrefix returns grade: null for a comment with an unclosed bracket
ok 6 - parseConfidencePrefix returns grade: null for a comment with an unclosed bracket
  ---
  duration_ms: 0.215059
  type: 'test'
  ...
# Subtest: parseConfidencePrefix throws on a plain typo, naming the offending token and all five valid ones
ok 7 - parseConfidencePrefix throws on a plain typo, naming the offending token and all five valid ones
  ---
  duration_ms: 1.07427
  type: 'test'
  ...
# Subtest: parseConfidencePrefix throws on wrong case
ok 8 - parseConfidencePrefix throws on wrong case
  ---
  duration_ms: 0.247297
  type: 'test'
  ...
# Subtest: parseConfidencePrefix throws on an underscore instead of a hyphen
ok 9 - parseConfidencePrefix throws on an underscore instead of a hyphen
  ---
  duration_ms: 0.566112
  type: 'test'
  ...
# Subtest: parseConfidencePrefix throws on a plural
ok 10 - parseConfidencePrefix throws on a plural
  ---
  duration_ms: 0.633663
  type: 'test'
  ...
# Subtest: parseConfidencePrefix throws on extra whitespace inside the brackets
ok 11 - parseConfidencePrefix throws on extra whitespace inside the brackets
  ---
  duration_ms: 0.363623
  type: 'test'
  ...
# Subtest: parseConfidencePrefix throws on a near-miss single-word grade
ok 12 - parseConfidencePrefix throws on a near-miss single-word grade
  ---
  duration_ms: 0.212983
  type: 'test'
  ...
# Subtest: formatConfidenceComment throws on an invalid grade token
ok 13 - formatConfidenceComment throws on an invalid grade token
  ---
  duration_ms: 0.185193
  type: 'test'
  ...
# Subtest: searchQueryForGrade throws on an invalid grade token
ok 14 - searchQueryForGrade throws on an invalid grade token
  ---
  duration_ms: 1.327966
  type: 'test'
  ...
# Subtest: searchQueryForGrade returns a string that appears verbatim in a graded comment
ok 15 - searchQueryForGrade returns a string that appears verbatim in a graded comment
  ---
  duration_ms: 0.291793
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
# duration_ms 145.956197
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
  duration_ms: 2.728085
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-confidence.test.ts:20:1'
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
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-confidence.test.ts:23:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
# Subtest: CONFIDENCE_GRADES tokens and brackets are the five canonical bracket tokens
ok 2 - CONFIDENCE_GRADES tokens and brackets are the five canonical bracket tokens
  ---
  duration_ms: 0.222954
  type: 'test'
  ...
# Subtest: every grade round-trips through formatConfidenceComment -> parseConfidencePrefix
ok 3 - every grade round-trips through formatConfidenceComment -> parseConfidencePrefix
  ---
  duration_ms: 0.33434
  type: 'test'
  ...
# Subtest: parseConfidencePrefix returns grade: null for a plain comment, without throwing
ok 4 - parseConfidencePrefix returns grade: null for a plain comment, without throwing
  ---
  duration_ms: 0.132816
  type: 'test'
  ...
# Subtest: parseConfidencePrefix returns grade: null for an empty comment
ok 5 - parseConfidencePrefix returns grade: null for an empty comment
  ---
  duration_ms: 0.12067
  type: 'test'
  ...
# Subtest: parseConfidencePrefix returns grade: null for a comment with an unclosed bracket
ok 6 - parseConfidencePrefix returns grade: null for a comment with an unclosed bracket
  ---
  duration_ms: 0.101012
  type: 'test'
  ...
# Subtest: parseConfidencePrefix throws on a plain typo, naming the offending token and all five valid ones
ok 7 - parseConfidencePrefix throws on a plain typo, naming the offending token and all five valid ones
  ---
  duration_ms: 0.699838
  type: 'test'
  ...
# Subtest: parseConfidencePrefix throws on wrong case
ok 8 - parseConfidencePrefix throws on wrong case
  ---
  duration_ms: 0.151189
  type: 'test'
  ...
# Subtest: parseConfidencePrefix throws on an underscore instead of a hyphen
ok 9 - parseConfidencePrefix throws on an underscore instead of a hyphen
  ---
  duration_ms: 0.354407
  type: 'test'
  ...
# Subtest: parseConfidencePrefix throws on a plural
ok 10 - parseConfidencePrefix throws on a plural
  ---
  duration_ms: 0.416274
  type: 'test'
  ...
# Subtest: parseConfidencePrefix throws on extra whitespace inside the brackets
ok 11 - parseConfidencePrefix throws on extra whitespace inside the brackets
  ---
  duration_ms: 0.211431
  type: 'test'
  ...
# Subtest: parseConfidencePrefix throws on a near-miss single-word grade
ok 12 - parseConfidencePrefix throws on a near-miss single-word grade
  ---
  duration_ms: 0.101333
  type: 'test'
  ...
# Subtest: formatConfidenceComment throws on an invalid grade token
ok 13 - formatConfidenceComment throws on an invalid grade token
  ---
  duration_ms: 0.148026
  type: 'test'
  ...
# Subtest: searchQueryForGrade throws on an invalid grade token
ok 14 - searchQueryForGrade throws on an invalid grade token
  ---
  duration_ms: 0.130524
  type: 'test'
  ...
# Subtest: searchQueryForGrade returns a string that appears verbatim in a graded comment
ok 15 - searchQueryForGrade returns a string that appears verbatim in a graded comment
  ---
  duration_ms: 0.156015
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
# duration_ms 122.291285
```

## `src/mcp/vice/r2000-coverage-grammar.test.ts` — verdict `re-pointed`

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
  duration_ms: 1.8178
  type: 'test'
  ...
# Subtest: every family contributed at least MIN_PER_FAMILY members, so the corpus cap is not a prefix of one family
ok 2 - every family contributed at least MIN_PER_FAMILY members, so the corpus cap is not a prefix of one family
  ---
  duration_ms: 0.700819
  type: 'test'
  ...
# Subtest: building the corpus twice yields byte-identical payloads in identical order
ok 3 - building the corpus twice yields byte-identical payloads in identical order
  ---
  duration_ms: 72.776217
  type: 'test'
  ...
# Subtest: every payload is exactly 64 bytes with an intact data tail, and no two indexed arrangements are byte-identical
ok 4 - every payload is exactly 64 bytes with an intact data tail, and no two indexed arrangements are byte-identical
  ---
  duration_ms: 18.279849
  type: 'test'
  ...
# Subtest: a twin differs from its own indexed member, and two members share a twin only when they differ solely in index register
ok 5 - a twin differs from its own indexed member, and two members share a twin only when they differ solely in index register
  ---
  duration_ms: 14.365099
  type: 'test'
  ...
# Subtest: no generated payload contains the JAM opcode at any offset
ok 6 - no generated payload contains the JAM opcode at any offset
  ---
  duration_ms: 18.198765
  type: 'test'
  ...
# Subtest: every arrangement carries exactly one terminator and it is the last fragment
ok 7 - every arrangement carries exactly one terminator and it is the last fragment
  ---
  duration_ms: 1.686811
  type: 'test'
  ...
# Subtest: every y-indexed load the alphabet emits renders to the absolute_y opcode and never the zeropage_y one
ok 8 - every y-indexed load the alphabet emits renders to the absolute_y opcode and never the zeropage_y one
  ---
  duration_ms: 24.587721
  type: 'test'
  ...
# Subtest: all nine pinned regression members are present in the corpus by byte identity
ok 9 - all nine pinned regression members are present in the corpus by byte identity
  ---
  duration_ms: 0.712122
  type: 'test'
  ...
# Subtest: the corpus reaches every generative dimension: order, interleaving, gap placement and length
ok 10 - the corpus reaches every generative dimension: order, interleaving, gap placement and length
  ---
  duration_ms: 3.066708
  type: 'test'
  ...
# Subtest: the module under test is READ-ONLY by construction, and this suite writes no file
ok 11 - the module under test is READ-ONLY by construction, and this suite writes no file
  ---
  duration_ms: 0.692666
  type: 'test'
  ...
# Subtest: the oracle never reaches the instrument: no decode, no scan, no census inside the oracle section
ok 12 - the oracle never reaches the instrument: no decode, no scan, no census inside the oracle section
  ---
  duration_ms: 0.405052
  type: 'test'
  ...
# Subtest: the oracle's SCOPE is honest: no corpus payload reaches classes 1 or 2, so the oracle may be silent about them
ok 13 - the oracle's SCOPE is honest: no corpus payload reaches classes 1 or 2, so the oracle may be silent about them
  ---
  duration_ms: 144.569028
  type: 'test'
  ...
# Subtest: the computed oracle AGREES with all nine hand-declared pinned verdicts
ok 14 - the computed oracle AGREES with all nine hand-declared pinned verdicts
  ---
  duration_ms: 2.09897
  type: 'test'
  ...
# Subtest: the set of arrangements the instrument PROVES equals exactly the set the oracle says carries a proven link
ok 15 - the set of arrangements the instrument PROVES equals exactly the set the oracle says carries a proven link
  ---
  duration_ms: 6.531293
  type: 'test'
  ...
# Subtest: an arrangement the oracle says is unlinked moves not one byte into the seed set or the table-entry class
ok 16 - an arrangement the oracle says is unlinked moves not one byte into the seed set or the table-entry class
  ---
  duration_ms: 13.315551
  type: 'test'
  ...
# Subtest: an unlinked arrangement's census reaches exactly its own prologue and classifies no table byte as code
ok 17 - an unlinked arrangement's census reaches exactly its own prologue and classifies no table byte as code
  ---
  duration_ms: 6.767852
  type: 'test'
  ...
# Subtest: twins: an unlinked pair reports the same census, and a LINKED indexed member reaches strictly more than its twin
ok 18 - twins: an unlinked pair reports the same census, and a LINKED indexed member reaches strictly more than its twin
  ---
  duration_ms: 2.689268
  type: 'test'
  ...
# Subtest: the instrument is NOT quietly measuring nothing: the corpus carries a population of genuinely linked arrangements
ok 19 - the instrument is NOT quietly measuring nothing: the corpus carries a population of genuinely linked arrangements
  ---
  duration_ms: 2.613361
  type: 'test'
  ...
# Subtest: degenerate inputs produce empty dispatch collections and no throw
ok 20 - degenerate inputs produce empty dispatch collections and no throw
  ---
  duration_ms: 0.515976
  type: 'test'
  ...
# Subtest: every address list the scan publishes is strictly ascending and free of duplicates, and scanning twice is stable
ok 21 - every address list the scan publishes is strictly ascending and free of duplicates, and scanning twice is stable
  ---
  duration_ms: 11.565471
  type: 'test'
  ...
# Subtest: the suite stays inside its 30-second budget, so a runaway enumeration is caught rather than tolerated
ok 22 - the suite stays inside its 30-second budget, so a runaway enumeration is caught rather than tolerated
  ---
  duration_ms: 0.246532
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
# duration_ms 691.078773
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
  duration_ms: 2.380065
  type: 'test'
  ...
# Subtest: every family contributed at least MIN_PER_FAMILY members, so the corpus cap is not a prefix of one family
ok 2 - every family contributed at least MIN_PER_FAMILY members, so the corpus cap is not a prefix of one family
  ---
  duration_ms: 0.650539
  type: 'test'
  ...
# Subtest: building the corpus twice yields byte-identical payloads in identical order
ok 3 - building the corpus twice yields byte-identical payloads in identical order
  ---
  duration_ms: 84.563856
  type: 'test'
  ...
# Subtest: every payload is exactly 64 bytes with an intact data tail, and no two indexed arrangements are byte-identical
ok 4 - every payload is exactly 64 bytes with an intact data tail, and no two indexed arrangements are byte-identical
  ---
  duration_ms: 17.398609
  type: 'test'
  ...
# Subtest: a twin differs from its own indexed member, and two members share a twin only when they differ solely in index register
ok 5 - a twin differs from its own indexed member, and two members share a twin only when they differ solely in index register
  ---
  duration_ms: 15.107287
  type: 'test'
  ...
# Subtest: no generated payload contains the JAM opcode at any offset
ok 6 - no generated payload contains the JAM opcode at any offset
  ---
  duration_ms: 17.847183
  type: 'test'
  ...
# Subtest: every arrangement carries exactly one terminator and it is the last fragment
ok 7 - every arrangement carries exactly one terminator and it is the last fragment
  ---
  duration_ms: 1.881557
  type: 'test'
  ...
# Subtest: every y-indexed load the alphabet emits renders to the absolute_y opcode and never the zeropage_y one
ok 8 - every y-indexed load the alphabet emits renders to the absolute_y opcode and never the zeropage_y one
  ---
  duration_ms: 24.298482
  type: 'test'
  ...
# Subtest: all nine pinned regression members are present in the corpus by byte identity
ok 9 - all nine pinned regression members are present in the corpus by byte identity
  ---
  duration_ms: 0.689258
  type: 'test'
  ...
# Subtest: the corpus reaches every generative dimension: order, interleaving, gap placement and length
ok 10 - the corpus reaches every generative dimension: order, interleaving, gap placement and length
  ---
  duration_ms: 3.04593
  type: 'test'
  ...
# Subtest: the module under test is READ-ONLY by construction, and this suite writes no file
ok 11 - the module under test is READ-ONLY by construction, and this suite writes no file
  ---
  duration_ms: 0.720807
  type: 'test'
  ...
# Subtest: the oracle never reaches the instrument: no decode, no scan, no census inside the oracle section
ok 12 - the oracle never reaches the instrument: no decode, no scan, no census inside the oracle section
  ---
  duration_ms: 0.424923
  type: 'test'
  ...
# Subtest: the oracle's SCOPE is honest: no corpus payload reaches classes 1 or 2, so the oracle may be silent about them
ok 13 - the oracle's SCOPE is honest: no corpus payload reaches classes 1 or 2, so the oracle may be silent about them
  ---
  duration_ms: 123.537374
  type: 'test'
  ...
# Subtest: the computed oracle AGREES with all nine hand-declared pinned verdicts
ok 14 - the computed oracle AGREES with all nine hand-declared pinned verdicts
  ---
  duration_ms: 1.222679
  type: 'test'
  ...
# Subtest: the set of arrangements the instrument PROVES equals exactly the set the oracle says carries a proven link
not ok 15 - the set of arrangements the instrument PROVES equals exactly the set the oracle says carries a proven link
  ---
  duration_ms: 8.148921
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-coverage-grammar.test.ts:1964:1'
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
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-coverage-grammar.test.ts:1985:10)
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
  duration_ms: 12.366918
  type: 'test'
  ...
# Subtest: an unlinked arrangement's census reaches exactly its own prologue and classifies no table byte as code
ok 17 - an unlinked arrangement's census reaches exactly its own prologue and classifies no table byte as code
  ---
  duration_ms: 6.388811
  type: 'test'
  ...
# Subtest: twins: an unlinked pair reports the same census, and a LINKED indexed member reaches strictly more than its twin
not ok 18 - twins: an unlinked pair reports the same census, and a LINKED indexed member reaches strictly more than its twin
  ---
  duration_ms: 0.609676
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-coverage-grammar.test.ts:2048:1'
  failureType: 'testCodeFailure'
  error: "xx-lo-first/pushes-and-adjacent-stores#pin0 (`lda $0830,x : pha : sta $fb : lda $0838,x : pha : sta $fc : rts`) [oracle: LINKED by R1..R6 class-3 stack-return-push-idiom]: a linked arrangement seeds a descent its twin cannot, so it must reach strictly more than the twin's 13 bytes -- observed 13"
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-coverage-grammar.test.ts:2064:14)
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
  duration_ms: 2.823156
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-coverage-grammar.test.ts:2083:1'
  failureType: 'testCodeFailure'
  error: 'xx-lo-first/pushes-and-adjacent-stores#pin0 (`lda $0830,x : pha : sta $fb : lda $0838,x : pha : sta $fc : rts`): a linked arrangement must publish a non-empty seed set'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-coverage-grammar.test.ts:2094:12)
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
  duration_ms: 0.526481
  type: 'test'
  ...
# Subtest: every address list the scan publishes is strictly ascending and free of duplicates, and scanning twice is stable
ok 21 - every address list the scan publishes is strictly ascending and free of duplicates, and scanning twice is stable
  ---
  duration_ms: 11.053672
  type: 'test'
  ...
# Subtest: the suite stays inside its 30-second budget, so a runaway enumeration is caught rather than tolerated
ok 22 - the suite stays inside its 30-second budget, so a runaway enumeration is caught rather than tolerated
  ---
  duration_ms: 0.276216
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
# duration_ms 637.868997
```

## `src/mcp/vice/r2000-coverage.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test anno-coverage.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# (node:62198) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: the report's top-level key set is exactly the pinned set, in order, and carries the schema version
ok 1 - the report's top-level key set is exactly the pinned set, in order, and carries the schema version
  ---
  duration_ms: 8.202408
  type: 'test'
  ...
# Subtest: COV-01: no key anywhere in the report matches a combined-figure vocabulary
ok 2 - COV-01: no key anywhere in the report matches a combined-figure vocabulary
  ---
  duration_ms: 1.666371
  type: 'test'
  ...
# Subtest: independence: rewriting every block entry to one type leaves every census byte count unchanged and moves only the divergence sub-report
ok 3 - independence: rewriting every block entry to one type leaves every census byte count unchanged and moves only the divergence sub-report
  ---
  duration_ms: 4.345112
  type: 'test'
  ...
# Subtest: the production block-spelling list is the DERIVED union of BOTH accepted vocabularies, with no duplicates
ok 4 - the production block-spelling list is the DERIVED union of BOTH accepted vocabularies, with no duplicates
  ---
  duration_ms: 0.29372
  type: 'test'
  ...
# Subtest: substitutability: the substituted vocabulary shares no string with EITHER accepted production vocabulary, which is what makes a left-behind comparison site observable
ok 5 - substitutability: the substituted vocabulary shares no string with EITHER accepted production vocabulary, which is what makes a left-behind comparison site observable
  ---
  duration_ms: 0.154778
  type: 'test'
  ...
# Subtest: substitutability: feeding the census a second, zero-overlap block vocabulary through the adapter leaves every census byte count exact and moves only the divergence sub-report
ok 6 - substitutability: feeding the census a second, zero-overlap block vocabulary through the adapter leaves every census byte count exact and moves only the divergence sub-report
  ---
  duration_ms: 1.407937
  type: 'test'
  ...
# Subtest: substitutability: on an UNGRADED comment set every fromStore value moves while every fromBytes value holds -- the sharpest form of the bytes-versus-store claim
ok 7 - substitutability: on an UNGRADED comment set every fromStore value moves while every fromBytes value holds -- the sharpest form of the bytes-versus-store claim
  ---
  duration_ms: 1.716195
  type: 'test'
  ...
# Subtest: idempotency: building the coverage report twice over the same fixture through the adapter yields deep-equal reports
ok 8 - idempotency: building the coverage report twice over the same fixture through the adapter yields deep-equal reports
  ---
  duration_ms: 1.161205
  type: 'test'
  ...
# Subtest: a lowercase label kind collapses the user tally to zero with no error -- the silent zero, made loud
ok 9 - a lowercase label kind collapses the user tally to zero with no error -- the silent zero, made loud
  ---
  duration_ms: 1.298096
  type: 'test'
  ...
# Subtest: derived agreement: every member of the store's label-kind vocabulary appears as a literal in the census's source
ok 10 - derived agreement: every member of the store's label-kind vocabulary appears as a literal in the census's source
  ---
  duration_ms: 17.754786
  type: 'test'
  ...
# Subtest: SUPPLEMENT (not the proof): the census module's source carries no production block-type literal
ok 11 - SUPPLEMENT (not the proof): the census module's source carries no production block-type literal
  ---
  duration_ms: 14.913223
  type: 'test'
  ...
# Subtest: SUPPLEMENT (WR-12): no shipped module passes CoverageOptions.blockClassifier
ok 12 - SUPPLEMENT (WR-12): no shipped module passes CoverageOptions.blockClassifier
  ---
  duration_ms: 187.554484
  type: 'test'
  ...
# Subtest: decodability: removing the seed set collapses the reached count, so a census that barely responds to its seeds would fail here
ok 13 - decodability: removing the seed set collapses the reached count, so a census that barely responds to its seeds would fail here
  ---
  duration_ms: 0.550265
  type: 'test'
  ...
# Subtest: WR-03: the descent stops at an illegal opcode instead of claiming it -- four code bytes are four, not sixty-four
ok 14 - WR-03: the descent stops at an illegal opcode instead of claiming it -- four code bytes are four, not sixty-four
  ---
  duration_ms: 0.340129
  type: 'test'
  ...
# Subtest: WR-03 both directions: the same payload filled with `nop` still reports every one of its sixty-four bytes reached
ok 15 - WR-03 both directions: the same payload filled with `nop` still reports every one of its sixty-four bytes reached
  ---
  duration_ms: 0.299097
  type: 'test'
  ...
# Subtest: WR-03: the two members of the pair are the same length and differ at exactly the sixty filler offsets
ok 16 - WR-03: the two members of the pair are the same length and differ at exactly the sixty filler offsets
  ---
  duration_ms: 0.206662
  type: 'test'
  ...
# Subtest: WR-03: the four byte classes still sum to rangeBytes for both members -- the byte the descent stopped claiming became unreached
ok 17 - WR-03: the four byte classes still sum to rangeBytes for both members -- the byte the descent stopped claiming became unreached
  ---
  duration_ms: 0.44755
  type: 'test'
  ...
# Subtest: WR-03: reachedAsInstruction never exceeds linearSweepDecodable -- the report cannot contradict itself about its own bytes
ok 18 - WR-03: reachedAsInstruction never exceeds linearSweepDecodable -- the report cannot contradict itself about its own bytes
  ---
  duration_ms: 0.889229
  type: 'test'
  ...
# Subtest: WR-03 regression: every committed coverage fixture reports the SAME reached count it did before the tightening
ok 19 - WR-03 regression: every committed coverage fixture reports the SAME reached count it did before the tightening
  ---
  duration_ms: 4.410276
  type: 'test'
  ...
# Subtest: WR-03 regression: the previously-unseen Phase 11 fixture's census is unchanged at 68 of 100
ok 20 - WR-03 regression: the previously-unseen Phase 11 fixture's census is unchanged at 68 of 100
  ---
  duration_ms: 0.864989
  type: 'test'
  ...
# Subtest: emptiness: a zero-byte, a one-byte and a seedless payload each report zero reached and unreached == range, with no thrown error
ok 21 - emptiness: a zero-byte, a one-byte and a seedless payload each report zero reached and unreached == range, with no thrown error
  ---
  duration_ms: 0.426908
  type: 'test'
  ...
# Subtest: emptiness: an undecodable payload reports an explicit reason rather than throwing or reading as clean (COV-02)
ok 22 - emptiness: an undecodable payload reports an explicit reason rather than throwing or reading as clean (COV-02)
  ---
  duration_ms: 0.458761
  type: 'test'
  ...
# Subtest: a missing or empty project path is the ONE caller-contract violation this module throws for
ok 23 - a missing or empty project path is the ONE caller-contract violation this module throws for
  ---
  duration_ms: 0.550309
  type: 'test'
  ...
# Subtest: idempotency: two consecutive reports over the same fixture are deeply equal once the timestamp is removed
ok 24 - idempotency: two consecutive reports over the same fixture are deeply equal once the timestamp is removed
  ---
  duration_ms: 8.921246
  type: 'test'
  ...
# Subtest: ordering: every offending-address list in every fixture's report is in ascending numeric order
ok 25 - ordering: every offending-address list in every fixture's report is in ascending numeric order
  ---
  duration_ms: 2.593876
  type: 'test'
  ...
# Subtest: normalisation pins the exact rules: ASCII lowercase, backticks and emphasis stripped, whitespace runs collapsed, trimmed
ok 26 - normalisation pins the exact rules: ASCII lowercase, backticks and emphasis stripped, whitespace runs collapsed, trimmed
  ---
  duration_ms: 0.141619
  type: 'test'
  ...
# Subtest: two identical normalised comments at different addresses count as ONE distinct comment
ok 27 - two identical normalised comments at different addresses count as ONE distinct comment
  ---
  duration_ms: 0.111968
  type: 'test'
  ...
# Subtest: a zero-comment project reports a NULL distinct-comment ratio with a zero commented-address count, never a division
ok 28 - a zero-comment project reports a NULL distinct-comment ratio with a zero commented-address count, never a division
  ---
  duration_ms: 0.07853
  type: 'test'
  ...
# Subtest: a comment equal to a banned-generic entry after normalisation never counts as documentation
ok 29 - a comment equal to a banned-generic entry after normalisation never counts as documentation
  ---
  duration_ms: 0.109583
  type: 'test'
  ...
# Subtest: a near-miss confidence token is reported as a measured defect, never thrown and never degraded to ungraded
ok 30 - a near-miss confidence token is reported as a measured defect, never thrown and never degraded to ungraded
  ---
  duration_ms: 0.167875
  type: 'test'
  ...
# Subtest: BANNED_GENERIC_COMMENTS is a named, non-empty set with at least five entries
ok 31 - BANNED_GENERIC_COMMENTS is a named, non-empty set with at least five entries
  ---
  duration_ms: 0.110939
  type: 'test'
  ...
# Subtest: AUTO_NAME_PREFIX_RE deliberately excludes the prefix upstream shares between predefined and user-defined label types
ok 32 - AUTO_NAME_PREFIX_RE deliberately excludes the prefix upstream shares between predefined and user-defined label types
  ---
  duration_ms: 0.095246
  type: 'test'
  ...
# Subtest: the cross-reference rule engages at strictly MORE THAN ONE caller, and not at one
ok 33 - the cross-reference rule engages at strictly MORE THAN ONE caller, and not at one
  ---
  duration_ms: 0.293604
  type: 'test'
  ...
# Subtest: ANCHORING: a colliding longer hex never satisfies the multi-caller rule -- NC4 plus $8106 is still undocumented, and the well-documented control is still clean
ok 34 - ANCHORING: a colliding longer hex never satisfies the multi-caller rule -- NC4 plus $8106 is still undocumented, and the well-documented control is still clean
  ---
  duration_ms: 0.901498
  type: 'test'
  ...
# Subtest: ANCHORING: a caller's label name satisfies the rule only on an identifier boundary
ok 35 - ANCHORING: a caller's label name satisfies the rule only on an identifier boundary
  ---
  duration_ms: 0.342068
  type: 'test'
  ...
# Subtest: WR-13: a caller's label name counts only when the comment USES it as a reference -- an ordinary English word in ordinary prose names no caller
ok 36 - WR-13: a caller's label name counts only when the comment USES it as a reference -- an ordinary English word in ordinary prose names no caller
  ---
  duration_ms: 0.848758
  type: 'test'
  ...
# Subtest: WR-13: the fixture-level both-directions statement -- NC5 stays CLEAN and NC4 is still caught by `reproducibility`
ok 37 - WR-13: the fixture-level both-directions statement -- NC5 stays CLEAN and NC4 is still caught by `reproducibility`
  ---
  duration_ms: 0.724822
  type: 'test'
  ...
# Subtest: every reported count is a count of the deduped list printed beside it
ok 38 - every reported count is a count of the deduped list printed beside it
  ---
  duration_ms: 2.044865
  type: 'test'
  ...
# Subtest: two symbols at one address produce a count of one, not two
ok 39 - two symbols at one address produce a count of one, not two
  ---
  duration_ms: 0.205132
  type: 'test'
  ...
# Subtest: the kind figure is over non-System labels only, and reports a null fraction rather than a divide when there are none
ok 40 - the kind figure is over non-System labels only, and reports a null fraction rather than a divide when there are none
  ---
  duration_ms: 0.106284
  type: 'test'
  ...
# Subtest: dispatch class 1: an indirect jump through a ZERO-PAGE vector is found and reported, with a null target
ok 41 - dispatch class 1: an indirect jump through a ZERO-PAGE vector is found and reported, with a null target
  ---
  duration_ms: 0.191309
  type: 'test'
  ...
# Subtest: dispatch class 2: a multi-entry table yields every entry, not the single entry upstream reads
ok 42 - dispatch class 2: a multi-entry table yields every entry, not the single entry upstream reads
  ---
  duration_ms: 0.135677
  type: 'test'
  ...
# Subtest: dispatch class 3: a PROVEN split lo/hi table pair is reconstructed from its two bases
ok 43 - dispatch class 3: a PROVEN split lo/hi table pair is reconstructed from its two bases
  ---
  duration_ms: 0.198624
  type: 'test'
  ...
# Subtest: a PROVEN split table survives an unrelated indexed load between its two halves (WR-15)
ok 44 - a PROVEN split table survives an unrelated indexed load between its two halves (WR-15)
  ---
  duration_ms: 0.370223
  type: 'test'
  ...
# Subtest: only a PROVEN pairing consumes its leading load, and at most one advisory candidate is emitted per leading load
ok 45 - only a PROVEN pairing consumes its leading load, and at most one advisory candidate is emitted per leading load
  ---
  duration_ms: 0.502077
  type: 'test'
  ...
# Subtest: dispatch class 4: the stack-return dispatch idiom is found even though it contains no indirect-jump opcode
ok 46 - dispatch class 4: the stack-return dispatch idiom is found even though it contains no indirect-jump opcode
  ---
  duration_ms: 0.312187
  type: 'test'
  ...
# Subtest: dispatch class 4 DECLINES a pha/pha/rts window whose two loads use different index registers
ok 47 - dispatch class 4 DECLINES a pha/pha/rts window whose two loads use different index registers
  ---
  duration_ms: 0.235532
  type: 'test'
  ...
# Subtest: dispatch class 4 DECLINES a window whose reconstructed entry point does not decode as a legal instruction
ok 48 - dispatch class 4 DECLINES a window whose reconstructed entry point does not decode as a legal instruction
  ---
  duration_ms: 0.211229
  type: 'test'
  ...
# Subtest: dispatch class 3 DECLINES an ordinary two-table indexed read loop
ok 49 - dispatch class 3 DECLINES an ordinary two-table indexed read loop
  ---
  duration_ms: 0.188449
  type: 'test'
  ...
# Subtest: an ordinary indexed copy loop does not inflate the census over its immediate twin
ok 50 - an ordinary indexed copy loop does not inflate the census over its immediate twin
  ---
  duration_ms: 0.344492
  type: 'test'
  ...
# Subtest: the class-4 stack-return idiom is not also reported as a class-3 split table
ok 51 - the class-4 stack-return idiom is not also reported as a class-3 split table
  ---
  duration_ms: 0.336114
  type: 'test'
  ...
# Subtest: an advisory split-table candidate never reaches the census
ok 52 - an advisory split-table candidate never reaches the census
  ---
  duration_ms: 0.276415
  type: 'test'
  ...
# Subtest: a census whose origin plus size would leave the 16-bit space is bounded, AND SO IS ITS OWN DISPATCH SUB-REPORT
ok 53 - a census whose origin plus size would leave the 16-bit space is bounded, AND SO IS ITS OWN DISPATCH SUB-REPORT
  ---
  duration_ms: 0.787955
  type: 'test'
  ...
# Subtest: bounded walk: a table whose entries would chain indefinitely reports truncation and terminates (T-19-12)
ok 54 - bounded walk: a table whose entries would chain indefinitely reports truncation and terminates (T-19-12)
  ---
  duration_ms: 0.351536
  type: 'test'
  ...
# Subtest: bounded walk: the descent walker honours an explicit step bound and reports truncation rather than looping
ok 55 - bounded walk: the descent walker honours an explicit step bound and reports truncation rather than looping
  ---
  duration_ms: 0.33344
  type: 'test'
  ...
# Subtest: the committed control set is exactly the pinned size, and every fixture carries a project file and a store file
ok 56 - the committed control set is exactly the pinned size, and every fixture carries a project file and a store file
  ---
  duration_ms: 0.585852
  type: 'test'
  ...
# Subtest: control FP1 (fp1-indexed-copy-loop): produces a non-clean result
ok 57 - control FP1 (fp1-indexed-copy-loop): produces a non-clean result
  ---
  duration_ms: 0.425192
  type: 'test'
  ...
# Subtest: control FP1b (fp1b-immediate-copy-loop): produces a non-clean result
ok 58 - control FP1b (fp1b-immediate-copy-loop): produces a non-clean result
  ---
  duration_ms: 0.289645
  type: 'test'
  ...
# Subtest: control FP2 (fp2-zeropage-data-pointer): produces a non-clean result
ok 59 - control FP2 (fp2-zeropage-data-pointer): produces a non-clean result
  ---
  duration_ms: 0.287926
  type: 'test'
  ...
# Subtest: control FP2b (fp2b-immediate-data-pointer): produces a non-clean result
ok 60 - control FP2b (fp2b-immediate-data-pointer): produces a non-clean result
  ---
  duration_ms: 0.320991
  type: 'test'
  ...
# Subtest: control FP3 (fp3-unlinked-push-idiom): produces a non-clean result
ok 61 - control FP3 (fp3-unlinked-push-idiom): produces a non-clean result
  ---
  duration_ms: 0.310714
  type: 'test'
  ...
# Subtest: control FP3b (fp3b-immediate-push-idiom): produces a non-clean result
ok 62 - control FP3b (fp3b-immediate-push-idiom): produces a non-clean result
  ---
  duration_ms: 0.391293
  type: 'test'
  ...
# Subtest: control NC1 (nc1-all-auto): produces a non-clean result naming labels
ok 63 - control NC1 (nc1-all-auto): produces a non-clean result naming labels
  ---
  duration_ms: 0.482477
  type: 'test'
  ...
# Subtest: control NC1b (nc1b-auto-renamed-in-place): produces a non-clean result naming labels
ok 64 - control NC1b (nc1b-auto-renamed-in-place): produces a non-clean result naming labels
  ---
  duration_ms: 0.383355
  type: 'test'
  ...
# Subtest: control NC2 (nc2-generic-comments): produces a non-clean result naming commentVacuity
ok 65 - control NC2 (nc2-generic-comments): produces a non-clean result naming commentVacuity
  ---
  duration_ms: 0.37162
  type: 'test'
  ...
# Subtest: control NC3 (nc3-all-data-blocks): produces a non-clean result naming divergence
ok 66 - control NC3 (nc3-all-data-blocks): produces a non-clean result naming divergence
  ---
  duration_ms: 0.396304
  type: 'test'
  ...
# Subtest: control NC4 (nc4-multi-caller-unnamed): produces a non-clean result naming reproducibility
ok 67 - control NC4 (nc4-multi-caller-unnamed): produces a non-clean result naming reproducibility
  ---
  duration_ms: 0.364673
  type: 'test'
  ...
# Subtest: control NC5 (nc5-well-documented): produces a CLEAN result
ok 68 - control NC5 (nc5-well-documented): produces a CLEAN result
  ---
  duration_ms: 0.327749
  type: 'test'
  ...
# Subtest: NON-VACUITY: the well-documented control passes, so the instrument is not merely a machine that fails everything
ok 69 - NON-VACUITY: the well-documented control passes, so the instrument is not merely a machine that fails everything
  ---
  duration_ms: 0.402278
  type: 'test'
  ...
# Subtest: NC1b earns its place: the kind figure alone would pass the auto-renamed-in-place control, the name figure catches it
ok 70 - NC1b earns its place: the kind figure alone would pass the auto-renamed-in-place control, the name figure catches it
  ---
  duration_ms: 0.42866
  type: 'test'
  ...
# Subtest: NC3 earns its place: the census does not move by one byte under a mass block-type set, only the divergence does
ok 71 - NC3 earns its place: the census does not move by one byte under a mass block-type set, only the divergence does
  ---
  duration_ms: 0.716468
  type: 'test'
  ...
# Subtest: a false-positive control fixture is committed for the census, and the census declines to inflate on it
ok 72 - a false-positive control fixture is committed for the census, and the census declines to inflate on it
  ---
  duration_ms: 0.66527
  type: 'test'
  ...
# Subtest: FP1b earns its place: without a committed twin, FP1's census could only be compared against a remembered number
ok 73 - FP1b earns its place: without a committed twin, FP1's census could only be compared against a remembered number
  ---
  duration_ms: 0.534802
  type: 'test'
  ...
# Subtest: a zero-page vector that is BUILT and then read through as data is not dispatch context, and the census does not inflate on it
ok 74 - a zero-page vector that is BUILT and then read through as data is not dispatch context, and the census does not inflate on it
  ---
  duration_ms: 0.686252
  type: 'test'
  ...
# Subtest: FP2b earns its place: without a committed twin, the interior control's census could only be compared against a remembered number
ok 75 - FP2b earns its place: without a committed twin, the interior control's census could only be compared against a remembered number
  ---
  duration_ms: 0.647545
  type: 'test'
  ...
# Subtest: a push idiom that pushes bytes the two paired loads never supplied is not dispatch context, and the census does not inflate on it
ok 76 - a push idiom that pushes bytes the two paired loads never supplied is not dispatch context, and the census does not inflate on it
  ---
  duration_ms: 0.769228
  type: 'test'
  ...
# Subtest: the tightened class-3 push-idiom branch is LIVE: a payload whose two paired loads each push what they loaded is still PROVEN
ok 77 - the tightened class-3 push-idiom branch is LIVE: a payload whose two paired loads each push what they loaded is still PROVEN
  ---
  duration_ms: 0.39634
  type: 'test'
  ...
# Subtest: a jump through a vector the pairing's own two loads never wrote to is not dispatch context, and the census does not inflate on it
ok 78 - a jump through a vector the pairing's own two loads never wrote to is not dispatch context, and the census does not inflate on it
  ---
  duration_ms: 0.697724
  type: 'test'
  ...
# Subtest: the tightened zero-page-vector branch is LIVE: the one-byte-different twin whose jump names the pairing's OWN vector is still PROVEN
ok 79 - the tightened zero-page-vector branch is LIVE: the one-byte-different twin whose jump names the pairing's OWN vector is still PROVEN
  ---
  duration_ms: 0.536651
  type: 'test'
  ...
# Subtest: the reachability matrix is exactly the cross product of the declared shapes and the declared routes
ok 80 - the reachability matrix is exactly the cross product of the declared shapes and the declared routes
  ---
  duration_ms: 0.25052
  type: 'test'
  ...
# Subtest: reachability on a route that CONSULTS the shared gate is DERIVED, not declared
ok 81 - reachability on a route that CONSULTS the shared gate is DERIVED, not declared
  ---
  duration_ms: 0.200689
  type: 'test'
  ...
# Subtest: every gate-interior declaration is mechanically TRUE, not a claim in a table
ok 82 - every gate-interior declaration is mechanically TRUE, not a claim in a table
  ---
  duration_ms: 2.170162
  type: 'test'
  ...
# Subtest: a control DECLARED as positive is actually ACCEPTED by the instrument
ok 83 - a control DECLARED as positive is actually ACCEPTED by the instrument
  ---
  duration_ms: 0.568196
  type: 'test'
  ...
# Subtest: every REACHABLE (shape, route) pair is claimed by a negative interior declaration
ok 84 - every REACHABLE (shape, route) pair is claimed by a negative interior declaration
  ---
  duration_ms: 0.318373
  type: 'test'
  ...
# Subtest: every REACHABLE pair's negative controls are confirmed INSIDE it by the witness
ok 85 - every REACHABLE pair's negative controls are confirmed INSIDE it by the witness
  ---
  duration_ms: 0.557182
  type: 'test'
  ...
# Subtest: every REACHABLE pair's verdicts are measured in THAT ROUTE'S own collection, never through the aggregate seam
ok 86 - every REACHABLE pair's verdicts are measured in THAT ROUTE'S own collection, never through the aggregate seam
  ---
  duration_ms: 1.10175
  type: 'test'
  ...
# Subtest: every UNREACHABLE (shape, route) pair makes the witness THROW, naming the pair
ok 87 - every UNREACHABLE (shape, route) pair makes the witness THROW, naming the pair
  ---
  duration_ms: 0.221786
  type: 'test'
  ...
# Subtest: NON-VACUITY per route: each reachable pair has a payload inside it AND a payload outside it
ok 88 - NON-VACUITY per route: each reachable pair has a payload inside it AND a payload outside it
  ---
  duration_ms: 0.792137
  type: 'test'
  ...
# Subtest: NON-VACUITY: the witness DECLINES an outside-bracketing payload offered as the zero-page vector shape's interior control
ok 89 - NON-VACUITY: the witness DECLINES an outside-bracketing payload offered as the zero-page vector shape's interior control
  ---
  duration_ms: 0.437461
  type: 'test'
  ...
# Subtest: the window-edge twin is OUTSIDE the class-3 push-idiom route while FP3 is INSIDE it, so the interior predicate is not satisfied by everything
ok 90 - the window-edge twin is OUTSIDE the class-3 push-idiom route while FP3 is INSIDE it, so the interior predicate is not satisfied by everything
  ---
  duration_ms: 0.453202
  type: 'test'
  ...
# Subtest: minting a dispatch shape id without an interior predicate THROWS, naming the id
ok 91 - minting a dispatch shape id without an interior predicate THROWS, naming the id
  ---
  duration_ms: 0.154902
  type: 'test'
  ...
# Subtest: the class-4-only control does NOT claim the class-3 route: the disjunction is gone
ok 92 - the class-4-only control does NOT claim the class-3 route: the disjunction is gone
  ---
  duration_ms: 0.09204
  type: 'test'
  ...
# Subtest: FP3 is interior to the class-3 route and OUTSIDE the class-4 one, so the two routes are genuinely distinguished
ok 93 - FP3 is interior to the class-3 route and OUTSIDE the class-4 one, so the two routes are genuinely distinguished
  ---
  duration_ms: 0.223609
  type: 'test'
  ...
# Subtest: asking the witness about an UNREACHABLE (shape, route) pair THROWS, naming both
ok 94 - asking the witness about an UNREACHABLE (shape, route) pair THROWS, naming both
  ---
  duration_ms: 0.115024
  type: 'test'
  ...
# Subtest: minting a ROUTE nobody declared THROWS, naming the route
ok 95 - minting a ROUTE nobody declared THROWS, naming the route
  ---
  duration_ms: 0.105067
  type: 'test'
  ...
# Subtest: every declaration row's route is a declared one, and only an OUTSIDE row may carry a null route
ok 96 - every declaration row's route is a declared one, and only an OUTSIDE row may carry a null route
  ---
  duration_ms: 0.233909
  type: 'test'
  ...
# Subtest: the witness is PURE over its four arguments: two calls on one payload return the same answer
ok 97 - the witness is PURE over its four arguments: two calls on one payload return the same answer
  ---
  duration_ms: 0.384481
  type: 'test'
  ...
# Subtest: the declared shape count equals the number of true-returning sites in hasDispatchContext()'s own source
ok 98 - the declared shape count equals the number of true-returning sites in hasDispatchContext()'s own source
  ---
  duration_ms: 0.685055
  type: 'test'
  ...
# Subtest: functionBodyFromSource() THROWS naming the signature when the function it is asked for does not exist
ok 99 - functionBodyFromSource() THROWS naming the signature when the function it is asked for does not exist
  ---
  duration_ms: 0.390524
  type: 'test'
  ...
# Subtest: EVERY true-returning site of hasDispatchContext() consults the PAIRING under test, not merely the window
ok 100 - EVERY true-returning site of hasDispatchContext() consults the PAIRING under test, not merely the window
  ---
  duration_ms: 0.875291
  type: 'test'
  ...
# Subtest: PIN 1: the number of hasDispatchContext() CALL SITES equals the number of routes that consult the shared gate
ok 101 - PIN 1: the number of hasDispatchContext() CALL SITES equals the number of routes that consult the shared gate
  ---
  duration_ms: 6.744828
  type: 'test'
  ...
# Subtest: PIN 2: each route publishes from exactly ONE site inside scanIndirectDispatch(), and the sites total the route count
ok 102 - PIN 2: each route publishes from exactly ONE site inside scanIndirectDispatch(), and the sites total the route count
  ---
  duration_ms: 1.478673
  type: 'test'
  ...
# Subtest: PIN 3: the seam's own sources are exactly PROVEN_TARGET_SOURCES, and every route publishes into one of them
ok 103 - PIN 3: the seam's own sources are exactly PROVEN_TARGET_SOURCES, and every route publishes into one of them
  ---
  duration_ms: 0.623397
  type: 'test'
  ...
# Subtest: PIN 4: the class-4 publication site PRECEDES the shared gate's only call site, and no call precedes it
ok 104 - PIN 4: the class-4 publication site PRECEDES the shared gate's only call site, and no call precedes it
  ---
  duration_ms: 1.211083
  type: 'test'
  ...
# Subtest: PIN 5: the decodability predicate is DECLARED exactly once and CALLED from exactly three sites
ok 105 - PIN 5: the decodability predicate is DECLARED exactly once and CALLED from exactly three sites
  ---
  duration_ms: 1.217212
  type: 'test'
  ...
# Subtest: PIN 6: the three call sites are the descent, the linear sweep and the entry-point gate -- and nothing else
ok 106 - PIN 6: the three call sites are the descent, the linear sweep and the entry-point gate -- and nothing else
  ---
  duration_ms: 1.02691
  type: 'test'
  ...
# Subtest: PIN 7: the decoder's illegal flag is READ at exactly one site in the module, inside the predicate
ok 107 - PIN 7: the decoder's illegal flag is READ at exactly one site in the module, inside the predicate
  ---
  duration_ms: 1.316161
  type: 'test'
  ...
# Subtest: PIN 8: the descent consults the predicate BEFORE the loop that marks class zero
ok 108 - PIN 8: the descent consults the predicate BEFORE the loop that marks class zero
  ---
  duration_ms: 0.414954
  type: 'test'
  ...
# Subtest: the previously-unseen Phase 11 fixture -- authored for a different phase, never used to write these rules -- produces a well-formed report
ok 109 - the previously-unseen Phase 11 fixture -- authored for a different phase, never used to write these rules -- produces a well-formed report
  ---
  duration_ms: 0.489335
  type: 'test'
  ...
# Subtest: the coverage module contains no file-write call, no project-save call and no live-session import
ok 110 - the coverage module contains no file-write call, no project-save call and no live-session import
  ---
  duration_ms: 0.795656
  type: 'test'
  ...
# Subtest: ANSWER.sha256 is exactly 64 lowercase hex characters
ok 111 - ANSWER.sha256 is exactly 64 lowercase hex characters
  ---
  duration_ms: 0.243546
  type: 'test'
  ...
# Subtest: ANSWER.sha256 matches the sha256 recomputed from ANSWER.md's own canonical line (T-19-SEAL-DRIFT)
ok 112 - ANSWER.sha256 matches the sha256 recomputed from ANSWER.md's own canonical line (T-19-SEAL-DRIFT)
  ---
  duration_ms: 0.596834
  type: 'test'
  ...
# Subtest: both canonical lines match QUESTION.md's own grammar
ok 113 - both canonical lines match QUESTION.md's own grammar
  ---
  duration_ms: 0.428686
  type: 'test'
  ...
# Subtest: QUESTION.md does not contain either canonical answer line, nor any of its compound field assignments (T-19-LEAK)
ok 114 - QUESTION.md does not contain either canonical answer line, nor any of its compound field assignments (T-19-LEAK)
  ---
  duration_ms: 0.179604
  type: 'test'
  ...
# Subtest: RE-DERIVED-ANSWER.md's canonical line hashes to the sealed ANSWER.sha256, and a missing or empty fence FAILS rather than skips (T-19-RETROFIT / T-19-VACUOUS-CHECK)
ok 115 - RE-DERIVED-ANSWER.md's canonical line hashes to the sealed ANSWER.sha256, and a missing or empty fence FAILS rather than skips (T-19-RETROFIT / T-19-VACUOUS-CHECK)
  ---
  duration_ms: 0.142903
  type: 'test'
  ...
# Subtest: LIVE non-vacuity: both routes are recomputed from the committed fixture and both reproduce the sealed line
ok 116 - LIVE non-vacuity: both routes are recomputed from the committed fixture and both reproduce the sealed line
  ---
  duration_ms: 0.943225
  type: 'test'
  ...
# Subtest: CR-05 (A): a real .prg is censused -- payload decoded, origin from its own load address, non-zero byte count
ok 117 - CR-05 (A): a real .prg is censused -- payload decoded, origin from its own load address, non-zero byte count
  ---
  duration_ms: 0.996286
  type: 'test'
  ...
# Subtest: CR-05 (B): an exactly-65536-byte flat capture with a .raw extension decodes at origin 0
ok 118 - CR-05 (B): an exactly-65536-byte flat capture with a .raw extension decodes at origin 0
  ---
  duration_ms: 159.455143
  type: 'test'
  ...
# Subtest: CR-05 (C, WR-07): a SHORT flat .raw is refused BY NAME, never parsed as a load address plus payload
ok 119 - CR-05 (C, WR-07): a SHORT flat .raw is refused BY NAME, never parsed as a load address plus payload
  ---
  duration_ms: 1.331291
  type: 'test'
  ...
# Subtest: CR-05 (D): the retired JSON project form still loads, so an existing project file is not broken
ok 120 - CR-05 (D): the retired JSON project form still loads, so an existing project file is not broken
  ---
  duration_ms: 1.515419
  type: 'test'
  ...
# Subtest: CR-05 (E, agreement): loadProjectImage and anno-tools' loadImage answer identically for one .prg and one flat capture
ok 121 - CR-05 (E, agreement): loadProjectImage and anno-tools' loadImage answer identically for one .prg and one flat capture
  ---
  duration_ms: 11.77892
  type: 'test'
  ...
# Subtest: CR-05 (F, one decode two callers): anno-cli.ts's cross-reference byte source delegates to this loader rather than re-parsing
ok 122 - CR-05 (F, one decode two callers): anno-cli.ts's cross-reference byte source delegates to this loader rather than re-parsing
  ---
  duration_ms: 0.49981
  type: 'test'
  ...
# Subtest: CR-05 (F, behavioural): a file the loader refuses yields BOTH no usable image and payloadDecoded:false in one run
ok 123 - CR-05 (F, behavioural): a file the loader refuses yields BOTH no usable image and payloadDecoded:false in one run
  ---
  duration_ms: 1.019771
  type: 'test'
  ...
# Subtest: CR-05 (G, read-only and re-runnable): two runs over one store and image give the same figures and leave the store byte-identical
ok 124 - CR-05 (G, read-only and re-runnable): two runs over one store and image give the same figures and leave the store byte-identical
  ---
  duration_ms: 3.259849
  type: 'test'
  ...
# Subtest: CR-05 (H, the T-29-14-01 symmetry): a non-JSON file's reason names the path and the failure but discloses NONE of its bytes
ok 125 - CR-05 (H, the T-29-14-01 symmetry): a non-JSON file's reason names the path and the failure but discloses NONE of its bytes
  ---
  duration_ms: 1.235149
  type: 'test'
  ...
# Subtest: CR-05 (H, control): where the runtime names a parse POSITION the reason carries the offset -- a position is not content
ok 126 - CR-05 (H, control): where the runtime names a parse POSITION the reason carries the offset -- a position is not content
  ---
  duration_ms: 1.023697
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
# duration_ms 800.379905
```

### Planted run

- **Plant:** `src/mcp/vice/anno-coverage.ts`: `export const COVERAGE_SCHEMA_VERSION = 2;` → `export const COVERAGE_SCHEMA_VERSION = 3;`
- **Planted command:** `node --test anno-coverage.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# (node:62277) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: the report's top-level key set is exactly the pinned set, in order, and carries the schema version
not ok 1 - the report's top-level key set is exactly the pinned set, in order, and carries the schema version
  ---
  duration_ms: 9.40295
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-coverage.test.ts:577:1'
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
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-coverage.test.ts:586:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
# Subtest: COV-01: no key anywhere in the report matches a combined-figure vocabulary
ok 2 - COV-01: no key anywhere in the report matches a combined-figure vocabulary
  ---
  duration_ms: 1.763777
  type: 'test'
  ...
# Subtest: independence: rewriting every block entry to one type leaves every census byte count unchanged and moves only the divergence sub-report
ok 3 - independence: rewriting every block entry to one type leaves every census byte count unchanged and moves only the divergence sub-report
  ---
  duration_ms: 4.234229
  type: 'test'
  ...
# Subtest: the production block-spelling list is the DERIVED union of BOTH accepted vocabularies, with no duplicates
ok 4 - the production block-spelling list is the DERIVED union of BOTH accepted vocabularies, with no duplicates
  ---
  duration_ms: 0.295796
  type: 'test'
  ...
# Subtest: substitutability: the substituted vocabulary shares no string with EITHER accepted production vocabulary, which is what makes a left-behind comparison site observable
ok 5 - substitutability: the substituted vocabulary shares no string with EITHER accepted production vocabulary, which is what makes a left-behind comparison site observable
  ---
  duration_ms: 0.152723
  type: 'test'
  ...
# Subtest: substitutability: feeding the census a second, zero-overlap block vocabulary through the adapter leaves every census byte count exact and moves only the divergence sub-report
ok 6 - substitutability: feeding the census a second, zero-overlap block vocabulary through the adapter leaves every census byte count exact and moves only the divergence sub-report
  ---
  duration_ms: 1.438936
  type: 'test'
  ...
# Subtest: substitutability: on an UNGRADED comment set every fromStore value moves while every fromBytes value holds -- the sharpest form of the bytes-versus-store claim
ok 7 - substitutability: on an UNGRADED comment set every fromStore value moves while every fromBytes value holds -- the sharpest form of the bytes-versus-store claim
  ---
  duration_ms: 1.620867
  type: 'test'
  ...
# Subtest: idempotency: building the coverage report twice over the same fixture through the adapter yields deep-equal reports
ok 8 - idempotency: building the coverage report twice over the same fixture through the adapter yields deep-equal reports
  ---
  duration_ms: 1.354762
  type: 'test'
  ...
# Subtest: a lowercase label kind collapses the user tally to zero with no error -- the silent zero, made loud
ok 9 - a lowercase label kind collapses the user tally to zero with no error -- the silent zero, made loud
  ---
  duration_ms: 1.316237
  type: 'test'
  ...
# Subtest: derived agreement: every member of the store's label-kind vocabulary appears as a literal in the census's source
ok 10 - derived agreement: every member of the store's label-kind vocabulary appears as a literal in the census's source
  ---
  duration_ms: 19.254541
  type: 'test'
  ...
# Subtest: SUPPLEMENT (not the proof): the census module's source carries no production block-type literal
ok 11 - SUPPLEMENT (not the proof): the census module's source carries no production block-type literal
  ---
  duration_ms: 15.230662
  type: 'test'
  ...
# Subtest: SUPPLEMENT (WR-12): no shipped module passes CoverageOptions.blockClassifier
ok 12 - SUPPLEMENT (WR-12): no shipped module passes CoverageOptions.blockClassifier
  ---
  duration_ms: 140.449907
  type: 'test'
  ...
# Subtest: decodability: removing the seed set collapses the reached count, so a census that barely responds to its seeds would fail here
ok 13 - decodability: removing the seed set collapses the reached count, so a census that barely responds to its seeds would fail here
  ---
  duration_ms: 0.546869
  type: 'test'
  ...
# Subtest: WR-03: the descent stops at an illegal opcode instead of claiming it -- four code bytes are four, not sixty-four
ok 14 - WR-03: the descent stops at an illegal opcode instead of claiming it -- four code bytes are four, not sixty-four
  ---
  duration_ms: 0.354151
  type: 'test'
  ...
# Subtest: WR-03 both directions: the same payload filled with `nop` still reports every one of its sixty-four bytes reached
ok 15 - WR-03 both directions: the same payload filled with `nop` still reports every one of its sixty-four bytes reached
  ---
  duration_ms: 0.31286
  type: 'test'
  ...
# Subtest: WR-03: the two members of the pair are the same length and differ at exactly the sixty filler offsets
ok 16 - WR-03: the two members of the pair are the same length and differ at exactly the sixty filler offsets
  ---
  duration_ms: 0.222613
  type: 'test'
  ...
# Subtest: WR-03: the four byte classes still sum to rangeBytes for both members -- the byte the descent stopped claiming became unreached
ok 17 - WR-03: the four byte classes still sum to rangeBytes for both members -- the byte the descent stopped claiming became unreached
  ---
  duration_ms: 0.476616
  type: 'test'
  ...
# Subtest: WR-03: reachedAsInstruction never exceeds linearSweepDecodable -- the report cannot contradict itself about its own bytes
ok 18 - WR-03: reachedAsInstruction never exceeds linearSweepDecodable -- the report cannot contradict itself about its own bytes
  ---
  duration_ms: 0.949622
  type: 'test'
  ...
# Subtest: WR-03 regression: every committed coverage fixture reports the SAME reached count it did before the tightening
ok 19 - WR-03 regression: every committed coverage fixture reports the SAME reached count it did before the tightening
  ---
  duration_ms: 2.841755
  type: 'test'
  ...
# Subtest: WR-03 regression: the previously-unseen Phase 11 fixture's census is unchanged at 68 of 100
ok 20 - WR-03 regression: the previously-unseen Phase 11 fixture's census is unchanged at 68 of 100
  ---
  duration_ms: 0.638428
  type: 'test'
  ...
# Subtest: emptiness: a zero-byte, a one-byte and a seedless payload each report zero reached and unreached == range, with no thrown error
ok 21 - emptiness: a zero-byte, a one-byte and a seedless payload each report zero reached and unreached == range, with no thrown error
  ---
  duration_ms: 0.233932
  type: 'test'
  ...
# Subtest: emptiness: an undecodable payload reports an explicit reason rather than throwing or reading as clean (COV-02)
ok 22 - emptiness: an undecodable payload reports an explicit reason rather than throwing or reading as clean (COV-02)
  ---
  duration_ms: 0.84625
  type: 'test'
  ...
# Subtest: a missing or empty project path is the ONE caller-contract violation this module throws for
ok 23 - a missing or empty project path is the ONE caller-contract violation this module throws for
  ---
  duration_ms: 0.902583
  type: 'test'
  ...
# Subtest: idempotency: two consecutive reports over the same fixture are deeply equal once the timestamp is removed
ok 24 - idempotency: two consecutive reports over the same fixture are deeply equal once the timestamp is removed
  ---
  duration_ms: 14.87284
  type: 'test'
  ...
# Subtest: ordering: every offending-address list in every fixture's report is in ascending numeric order
ok 25 - ordering: every offending-address list in every fixture's report is in ascending numeric order
  ---
  duration_ms: 5.150607
  type: 'test'
  ...
# Subtest: normalisation pins the exact rules: ASCII lowercase, backticks and emphasis stripped, whitespace runs collapsed, trimmed
ok 26 - normalisation pins the exact rules: ASCII lowercase, backticks and emphasis stripped, whitespace runs collapsed, trimmed
  ---
  duration_ms: 0.307976
  type: 'test'
  ...
# Subtest: two identical normalised comments at different addresses count as ONE distinct comment
ok 27 - two identical normalised comments at different addresses count as ONE distinct comment
  ---
  duration_ms: 0.249807
  type: 'test'
  ...
# Subtest: a zero-comment project reports a NULL distinct-comment ratio with a zero commented-address count, never a division
ok 28 - a zero-comment project reports a NULL distinct-comment ratio with a zero commented-address count, never a division
  ---
  duration_ms: 0.249247
  type: 'test'
  ...
# Subtest: a comment equal to a banned-generic entry after normalisation never counts as documentation
ok 29 - a comment equal to a banned-generic entry after normalisation never counts as documentation
  ---
  duration_ms: 0.261501
  type: 'test'
  ...
# Subtest: a near-miss confidence token is reported as a measured defect, never thrown and never degraded to ungraded
ok 30 - a near-miss confidence token is reported as a measured defect, never thrown and never degraded to ungraded
  ---
  duration_ms: 0.344648
  type: 'test'
  ...
# Subtest: BANNED_GENERIC_COMMENTS is a named, non-empty set with at least five entries
ok 31 - BANNED_GENERIC_COMMENTS is a named, non-empty set with at least five entries
  ---
  duration_ms: 0.249694
  type: 'test'
  ...
# Subtest: AUTO_NAME_PREFIX_RE deliberately excludes the prefix upstream shares between predefined and user-defined label types
ok 32 - AUTO_NAME_PREFIX_RE deliberately excludes the prefix upstream shares between predefined and user-defined label types
  ---
  duration_ms: 0.253138
  type: 'test'
  ...
# Subtest: the cross-reference rule engages at strictly MORE THAN ONE caller, and not at one
ok 33 - the cross-reference rule engages at strictly MORE THAN ONE caller, and not at one
  ---
  duration_ms: 0.487681
  type: 'test'
  ...
# Subtest: ANCHORING: a colliding longer hex never satisfies the multi-caller rule -- NC4 plus $8106 is still undocumented, and the well-documented control is still clean
ok 34 - ANCHORING: a colliding longer hex never satisfies the multi-caller rule -- NC4 plus $8106 is still undocumented, and the well-documented control is still clean
  ---
  duration_ms: 1.446451
  type: 'test'
  ...
# Subtest: ANCHORING: a caller's label name satisfies the rule only on an identifier boundary
ok 35 - ANCHORING: a caller's label name satisfies the rule only on an identifier boundary
  ---
  duration_ms: 0.59551
  type: 'test'
  ...
# Subtest: WR-13: a caller's label name counts only when the comment USES it as a reference -- an ordinary English word in ordinary prose names no caller
ok 36 - WR-13: a caller's label name counts only when the comment USES it as a reference -- an ordinary English word in ordinary prose names no caller
  ---
  duration_ms: 1.540327
  type: 'test'
  ...
# Subtest: WR-13: the fixture-level both-directions statement -- NC5 stays CLEAN and NC4 is still caught by `reproducibility`
ok 37 - WR-13: the fixture-level both-directions statement -- NC5 stays CLEAN and NC4 is still caught by `reproducibility`
  ---
  duration_ms: 0.848528
  type: 'test'
  ...
# Subtest: every reported count is a count of the deduped list printed beside it
ok 38 - every reported count is a count of the deduped list printed beside it
  ---
  duration_ms: 2.1326
  type: 'test'
  ...
# Subtest: two symbols at one address produce a count of one, not two
ok 39 - two symbols at one address produce a count of one, not two
  ---
  duration_ms: 0.219399
  type: 'test'
  ...
# Subtest: the kind figure is over non-System labels only, and reports a null fraction rather than a divide when there are none
ok 40 - the kind figure is over non-System labels only, and reports a null fraction rather than a divide when there are none
  ---
  duration_ms: 0.113321
  type: 'test'
  ...
# Subtest: dispatch class 1: an indirect jump through a ZERO-PAGE vector is found and reported, with a null target
ok 41 - dispatch class 1: an indirect jump through a ZERO-PAGE vector is found and reported, with a null target
  ---
  duration_ms: 0.230315
  type: 'test'
  ...
# Subtest: dispatch class 2: a multi-entry table yields every entry, not the single entry upstream reads
ok 42 - dispatch class 2: a multi-entry table yields every entry, not the single entry upstream reads
  ---
  duration_ms: 0.171458
  type: 'test'
  ...
# Subtest: dispatch class 3: a PROVEN split lo/hi table pair is reconstructed from its two bases
ok 43 - dispatch class 3: a PROVEN split lo/hi table pair is reconstructed from its two bases
  ---
  duration_ms: 0.185923
  type: 'test'
  ...
# Subtest: a PROVEN split table survives an unrelated indexed load between its two halves (WR-15)
ok 44 - a PROVEN split table survives an unrelated indexed load between its two halves (WR-15)
  ---
  duration_ms: 0.389378
  type: 'test'
  ...
# Subtest: only a PROVEN pairing consumes its leading load, and at most one advisory candidate is emitted per leading load
ok 45 - only a PROVEN pairing consumes its leading load, and at most one advisory candidate is emitted per leading load
  ---
  duration_ms: 0.49913
  type: 'test'
  ...
# Subtest: dispatch class 4: the stack-return dispatch idiom is found even though it contains no indirect-jump opcode
ok 46 - dispatch class 4: the stack-return dispatch idiom is found even though it contains no indirect-jump opcode
  ---
  duration_ms: 0.324457
  type: 'test'
  ...
# Subtest: dispatch class 4 DECLINES a pha/pha/rts window whose two loads use different index registers
ok 47 - dispatch class 4 DECLINES a pha/pha/rts window whose two loads use different index registers
  ---
  duration_ms: 0.257956
  type: 'test'
  ...
# Subtest: dispatch class 4 DECLINES a window whose reconstructed entry point does not decode as a legal instruction
ok 48 - dispatch class 4 DECLINES a window whose reconstructed entry point does not decode as a legal instruction
  ---
  duration_ms: 0.220194
  type: 'test'
  ...
# Subtest: dispatch class 3 DECLINES an ordinary two-table indexed read loop
ok 49 - dispatch class 3 DECLINES an ordinary two-table indexed read loop
  ---
  duration_ms: 0.203174
  type: 'test'
  ...
# Subtest: an ordinary indexed copy loop does not inflate the census over its immediate twin
ok 50 - an ordinary indexed copy loop does not inflate the census over its immediate twin
  ---
  duration_ms: 0.352835
  type: 'test'
  ...
# Subtest: the class-4 stack-return idiom is not also reported as a class-3 split table
ok 51 - the class-4 stack-return idiom is not also reported as a class-3 split table
  ---
  duration_ms: 0.322513
  type: 'test'
  ...
# Subtest: an advisory split-table candidate never reaches the census
ok 52 - an advisory split-table candidate never reaches the census
  ---
  duration_ms: 0.306536
  type: 'test'
  ...
# Subtest: a census whose origin plus size would leave the 16-bit space is bounded, AND SO IS ITS OWN DISPATCH SUB-REPORT
ok 53 - a census whose origin plus size would leave the 16-bit space is bounded, AND SO IS ITS OWN DISPATCH SUB-REPORT
  ---
  duration_ms: 0.902768
  type: 'test'
  ...
# Subtest: bounded walk: a table whose entries would chain indefinitely reports truncation and terminates (T-19-12)
ok 54 - bounded walk: a table whose entries would chain indefinitely reports truncation and terminates (T-19-12)
  ---
  duration_ms: 0.353014
  type: 'test'
  ...
# Subtest: bounded walk: the descent walker honours an explicit step bound and reports truncation rather than looping
ok 55 - bounded walk: the descent walker honours an explicit step bound and reports truncation rather than looping
  ---
  duration_ms: 0.378055
  type: 'test'
  ...
# Subtest: the committed control set is exactly the pinned size, and every fixture carries a project file and a store file
ok 56 - the committed control set is exactly the pinned size, and every fixture carries a project file and a store file
  ---
  duration_ms: 0.633148
  type: 'test'
  ...
# Subtest: control FP1 (fp1-indexed-copy-loop): produces a non-clean result
ok 57 - control FP1 (fp1-indexed-copy-loop): produces a non-clean result
  ---
  duration_ms: 0.415516
  type: 'test'
  ...
# Subtest: control FP1b (fp1b-immediate-copy-loop): produces a non-clean result
ok 58 - control FP1b (fp1b-immediate-copy-loop): produces a non-clean result
  ---
  duration_ms: 0.29052
  type: 'test'
  ...
# Subtest: control FP2 (fp2-zeropage-data-pointer): produces a non-clean result
ok 59 - control FP2 (fp2-zeropage-data-pointer): produces a non-clean result
  ---
  duration_ms: 0.299385
  type: 'test'
  ...
# Subtest: control FP2b (fp2b-immediate-data-pointer): produces a non-clean result
ok 60 - control FP2b (fp2b-immediate-data-pointer): produces a non-clean result
  ---
  duration_ms: 0.386644
  type: 'test'
  ...
# Subtest: control FP3 (fp3-unlinked-push-idiom): produces a non-clean result
ok 61 - control FP3 (fp3-unlinked-push-idiom): produces a non-clean result
  ---
  duration_ms: 0.334944
  type: 'test'
  ...
# Subtest: control FP3b (fp3b-immediate-push-idiom): produces a non-clean result
ok 62 - control FP3b (fp3b-immediate-push-idiom): produces a non-clean result
  ---
  duration_ms: 0.90017
  type: 'test'
  ...
# Subtest: control NC1 (nc1-all-auto): produces a non-clean result naming labels
ok 63 - control NC1 (nc1-all-auto): produces a non-clean result naming labels
  ---
  duration_ms: 0.531432
  type: 'test'
  ...
# Subtest: control NC1b (nc1b-auto-renamed-in-place): produces a non-clean result naming labels
ok 64 - control NC1b (nc1b-auto-renamed-in-place): produces a non-clean result naming labels
  ---
  duration_ms: 0.395085
  type: 'test'
  ...
# Subtest: control NC2 (nc2-generic-comments): produces a non-clean result naming commentVacuity
ok 65 - control NC2 (nc2-generic-comments): produces a non-clean result naming commentVacuity
  ---
  duration_ms: 0.371864
  type: 'test'
  ...
# Subtest: control NC3 (nc3-all-data-blocks): produces a non-clean result naming divergence
ok 66 - control NC3 (nc3-all-data-blocks): produces a non-clean result naming divergence
  ---
  duration_ms: 0.373501
  type: 'test'
  ...
# Subtest: control NC4 (nc4-multi-caller-unnamed): produces a non-clean result naming reproducibility
ok 67 - control NC4 (nc4-multi-caller-unnamed): produces a non-clean result naming reproducibility
  ---
  duration_ms: 0.360517
  type: 'test'
  ...
# Subtest: control NC5 (nc5-well-documented): produces a CLEAN result
ok 68 - control NC5 (nc5-well-documented): produces a CLEAN result
  ---
  duration_ms: 0.346515
  type: 'test'
  ...
# Subtest: NON-VACUITY: the well-documented control passes, so the instrument is not merely a machine that fails everything
ok 69 - NON-VACUITY: the well-documented control passes, so the instrument is not merely a machine that fails everything
  ---
  duration_ms: 0.404718
  type: 'test'
  ...
# Subtest: NC1b earns its place: the kind figure alone would pass the auto-renamed-in-place control, the name figure catches it
ok 70 - NC1b earns its place: the kind figure alone would pass the auto-renamed-in-place control, the name figure catches it
  ---
  duration_ms: 0.391253
  type: 'test'
  ...
# Subtest: NC3 earns its place: the census does not move by one byte under a mass block-type set, only the divergence does
ok 71 - NC3 earns its place: the census does not move by one byte under a mass block-type set, only the divergence does
  ---
  duration_ms: 0.710603
  type: 'test'
  ...
# Subtest: a false-positive control fixture is committed for the census, and the census declines to inflate on it
ok 72 - a false-positive control fixture is committed for the census, and the census declines to inflate on it
  ---
  duration_ms: 0.684905
  type: 'test'
  ...
# Subtest: FP1b earns its place: without a committed twin, FP1's census could only be compared against a remembered number
ok 73 - FP1b earns its place: without a committed twin, FP1's census could only be compared against a remembered number
  ---
  duration_ms: 0.759891
  type: 'test'
  ...
# Subtest: a zero-page vector that is BUILT and then read through as data is not dispatch context, and the census does not inflate on it
ok 74 - a zero-page vector that is BUILT and then read through as data is not dispatch context, and the census does not inflate on it
  ---
  duration_ms: 0.743255
  type: 'test'
  ...
# Subtest: FP2b earns its place: without a committed twin, the interior control's census could only be compared against a remembered number
ok 75 - FP2b earns its place: without a committed twin, the interior control's census could only be compared against a remembered number
  ---
  duration_ms: 0.697897
  type: 'test'
  ...
# Subtest: a push idiom that pushes bytes the two paired loads never supplied is not dispatch context, and the census does not inflate on it
ok 76 - a push idiom that pushes bytes the two paired loads never supplied is not dispatch context, and the census does not inflate on it
  ---
  duration_ms: 0.769259
  type: 'test'
  ...
# Subtest: the tightened class-3 push-idiom branch is LIVE: a payload whose two paired loads each push what they loaded is still PROVEN
ok 77 - the tightened class-3 push-idiom branch is LIVE: a payload whose two paired loads each push what they loaded is still PROVEN
  ---
  duration_ms: 0.432978
  type: 'test'
  ...
# Subtest: a jump through a vector the pairing's own two loads never wrote to is not dispatch context, and the census does not inflate on it
ok 78 - a jump through a vector the pairing's own two loads never wrote to is not dispatch context, and the census does not inflate on it
  ---
  duration_ms: 0.754093
  type: 'test'
  ...
# Subtest: the tightened zero-page-vector branch is LIVE: the one-byte-different twin whose jump names the pairing's OWN vector is still PROVEN
ok 79 - the tightened zero-page-vector branch is LIVE: the one-byte-different twin whose jump names the pairing's OWN vector is still PROVEN
  ---
  duration_ms: 0.718082
  type: 'test'
  ...
# Subtest: the reachability matrix is exactly the cross product of the declared shapes and the declared routes
ok 80 - the reachability matrix is exactly the cross product of the declared shapes and the declared routes
  ---
  duration_ms: 0.233392
  type: 'test'
  ...
# Subtest: reachability on a route that CONSULTS the shared gate is DERIVED, not declared
ok 81 - reachability on a route that CONSULTS the shared gate is DERIVED, not declared
  ---
  duration_ms: 0.190687
  type: 'test'
  ...
# Subtest: every gate-interior declaration is mechanically TRUE, not a claim in a table
ok 82 - every gate-interior declaration is mechanically TRUE, not a claim in a table
  ---
  duration_ms: 2.292811
  type: 'test'
  ...
# Subtest: a control DECLARED as positive is actually ACCEPTED by the instrument
ok 83 - a control DECLARED as positive is actually ACCEPTED by the instrument
  ---
  duration_ms: 0.577862
  type: 'test'
  ...
# Subtest: every REACHABLE (shape, route) pair is claimed by a negative interior declaration
ok 84 - every REACHABLE (shape, route) pair is claimed by a negative interior declaration
  ---
  duration_ms: 0.304815
  type: 'test'
  ...
# Subtest: every REACHABLE pair's negative controls are confirmed INSIDE it by the witness
ok 85 - every REACHABLE pair's negative controls are confirmed INSIDE it by the witness
  ---
  duration_ms: 0.607855
  type: 'test'
  ...
# Subtest: every REACHABLE pair's verdicts are measured in THAT ROUTE'S own collection, never through the aggregate seam
ok 86 - every REACHABLE pair's verdicts are measured in THAT ROUTE'S own collection, never through the aggregate seam
  ---
  duration_ms: 1.187287
  type: 'test'
  ...
# Subtest: every UNREACHABLE (shape, route) pair makes the witness THROW, naming the pair
ok 87 - every UNREACHABLE (shape, route) pair makes the witness THROW, naming the pair
  ---
  duration_ms: 0.248306
  type: 'test'
  ...
# Subtest: NON-VACUITY per route: each reachable pair has a payload inside it AND a payload outside it
ok 88 - NON-VACUITY per route: each reachable pair has a payload inside it AND a payload outside it
  ---
  duration_ms: 0.838275
  type: 'test'
  ...
# Subtest: NON-VACUITY: the witness DECLINES an outside-bracketing payload offered as the zero-page vector shape's interior control
ok 89 - NON-VACUITY: the witness DECLINES an outside-bracketing payload offered as the zero-page vector shape's interior control
  ---
  duration_ms: 0.521696
  type: 'test'
  ...
# Subtest: the window-edge twin is OUTSIDE the class-3 push-idiom route while FP3 is INSIDE it, so the interior predicate is not satisfied by everything
ok 90 - the window-edge twin is OUTSIDE the class-3 push-idiom route while FP3 is INSIDE it, so the interior predicate is not satisfied by everything
  ---
  duration_ms: 0.479655
  type: 'test'
  ...
# Subtest: minting a dispatch shape id without an interior predicate THROWS, naming the id
ok 91 - minting a dispatch shape id without an interior predicate THROWS, naming the id
  ---
  duration_ms: 0.155323
  type: 'test'
  ...
# Subtest: the class-4-only control does NOT claim the class-3 route: the disjunction is gone
ok 92 - the class-4-only control does NOT claim the class-3 route: the disjunction is gone
  ---
  duration_ms: 0.094839
  type: 'test'
  ...
# Subtest: FP3 is interior to the class-3 route and OUTSIDE the class-4 one, so the two routes are genuinely distinguished
ok 93 - FP3 is interior to the class-3 route and OUTSIDE the class-4 one, so the two routes are genuinely distinguished
  ---
  duration_ms: 0.245714
  type: 'test'
  ...
# Subtest: asking the witness about an UNREACHABLE (shape, route) pair THROWS, naming both
ok 94 - asking the witness about an UNREACHABLE (shape, route) pair THROWS, naming both
  ---
  duration_ms: 0.122886
  type: 'test'
  ...
# Subtest: minting a ROUTE nobody declared THROWS, naming the route
ok 95 - minting a ROUTE nobody declared THROWS, naming the route
  ---
  duration_ms: 0.109452
  type: 'test'
  ...
# Subtest: every declaration row's route is a declared one, and only an OUTSIDE row may carry a null route
ok 96 - every declaration row's route is a declared one, and only an OUTSIDE row may carry a null route
  ---
  duration_ms: 0.342165
  type: 'test'
  ...
# Subtest: the witness is PURE over its four arguments: two calls on one payload return the same answer
ok 97 - the witness is PURE over its four arguments: two calls on one payload return the same answer
  ---
  duration_ms: 0.272697
  type: 'test'
  ...
# Subtest: the declared shape count equals the number of true-returning sites in hasDispatchContext()'s own source
ok 98 - the declared shape count equals the number of true-returning sites in hasDispatchContext()'s own source
  ---
  duration_ms: 0.688449
  type: 'test'
  ...
# Subtest: functionBodyFromSource() THROWS naming the signature when the function it is asked for does not exist
ok 99 - functionBodyFromSource() THROWS naming the signature when the function it is asked for does not exist
  ---
  duration_ms: 0.395976
  type: 'test'
  ...
# Subtest: EVERY true-returning site of hasDispatchContext() consults the PAIRING under test, not merely the window
ok 100 - EVERY true-returning site of hasDispatchContext() consults the PAIRING under test, not merely the window
  ---
  duration_ms: 0.91065
  type: 'test'
  ...
# Subtest: PIN 1: the number of hasDispatchContext() CALL SITES equals the number of routes that consult the shared gate
ok 101 - PIN 1: the number of hasDispatchContext() CALL SITES equals the number of routes that consult the shared gate
  ---
  duration_ms: 6.950005
  type: 'test'
  ...
# Subtest: PIN 2: each route publishes from exactly ONE site inside scanIndirectDispatch(), and the sites total the route count
ok 102 - PIN 2: each route publishes from exactly ONE site inside scanIndirectDispatch(), and the sites total the route count
  ---
  duration_ms: 1.468906
  type: 'test'
  ...
# Subtest: PIN 3: the seam's own sources are exactly PROVEN_TARGET_SOURCES, and every route publishes into one of them
ok 103 - PIN 3: the seam's own sources are exactly PROVEN_TARGET_SOURCES, and every route publishes into one of them
  ---
  duration_ms: 0.662742
  type: 'test'
  ...
# Subtest: PIN 4: the class-4 publication site PRECEDES the shared gate's only call site, and no call precedes it
ok 104 - PIN 4: the class-4 publication site PRECEDES the shared gate's only call site, and no call precedes it
  ---
  duration_ms: 1.296328
  type: 'test'
  ...
# Subtest: PIN 5: the decodability predicate is DECLARED exactly once and CALLED from exactly three sites
ok 105 - PIN 5: the decodability predicate is DECLARED exactly once and CALLED from exactly three sites
  ---
  duration_ms: 1.269411
  type: 'test'
  ...
# Subtest: PIN 6: the three call sites are the descent, the linear sweep and the entry-point gate -- and nothing else
ok 106 - PIN 6: the three call sites are the descent, the linear sweep and the entry-point gate -- and nothing else
  ---
  duration_ms: 1.048274
  type: 'test'
  ...
# Subtest: PIN 7: the decoder's illegal flag is READ at exactly one site in the module, inside the predicate
ok 107 - PIN 7: the decoder's illegal flag is READ at exactly one site in the module, inside the predicate
  ---
  duration_ms: 1.372522
  type: 'test'
  ...
# Subtest: PIN 8: the descent consults the predicate BEFORE the loop that marks class zero
ok 108 - PIN 8: the descent consults the predicate BEFORE the loop that marks class zero
  ---
  duration_ms: 0.451826
  type: 'test'
  ...
# Subtest: the previously-unseen Phase 11 fixture -- authored for a different phase, never used to write these rules -- produces a well-formed report
ok 109 - the previously-unseen Phase 11 fixture -- authored for a different phase, never used to write these rules -- produces a well-formed report
  ---
  duration_ms: 0.52071
  type: 'test'
  ...
# Subtest: the coverage module contains no file-write call, no project-save call and no live-session import
ok 110 - the coverage module contains no file-write call, no project-save call and no live-session import
  ---
  duration_ms: 0.887309
  type: 'test'
  ...
# Subtest: ANSWER.sha256 is exactly 64 lowercase hex characters
ok 111 - ANSWER.sha256 is exactly 64 lowercase hex characters
  ---
  duration_ms: 0.319397
  type: 'test'
  ...
# Subtest: ANSWER.sha256 matches the sha256 recomputed from ANSWER.md's own canonical line (T-19-SEAL-DRIFT)
ok 112 - ANSWER.sha256 matches the sha256 recomputed from ANSWER.md's own canonical line (T-19-SEAL-DRIFT)
  ---
  duration_ms: 0.628127
  type: 'test'
  ...
# Subtest: both canonical lines match QUESTION.md's own grammar
ok 113 - both canonical lines match QUESTION.md's own grammar
  ---
  duration_ms: 0.439238
  type: 'test'
  ...
# Subtest: QUESTION.md does not contain either canonical answer line, nor any of its compound field assignments (T-19-LEAK)
ok 114 - QUESTION.md does not contain either canonical answer line, nor any of its compound field assignments (T-19-LEAK)
  ---
  duration_ms: 0.193864
  type: 'test'
  ...
# Subtest: RE-DERIVED-ANSWER.md's canonical line hashes to the sealed ANSWER.sha256, and a missing or empty fence FAILS rather than skips (T-19-RETROFIT / T-19-VACUOUS-CHECK)
ok 115 - RE-DERIVED-ANSWER.md's canonical line hashes to the sealed ANSWER.sha256, and a missing or empty fence FAILS rather than skips (T-19-RETROFIT / T-19-VACUOUS-CHECK)
  ---
  duration_ms: 0.146091
  type: 'test'
  ...
# Subtest: LIVE non-vacuity: both routes are recomputed from the committed fixture and both reproduce the sealed line
ok 116 - LIVE non-vacuity: both routes are recomputed from the committed fixture and both reproduce the sealed line
  ---
  duration_ms: 1.080211
  type: 'test'
  ...
# Subtest: CR-05 (A): a real .prg is censused -- payload decoded, origin from its own load address, non-zero byte count
ok 117 - CR-05 (A): a real .prg is censused -- payload decoded, origin from its own load address, non-zero byte count
  ---
  duration_ms: 1.083694
  type: 'test'
  ...
# Subtest: CR-05 (B): an exactly-65536-byte flat capture with a .raw extension decodes at origin 0
ok 118 - CR-05 (B): an exactly-65536-byte flat capture with a .raw extension decodes at origin 0
  ---
  duration_ms: 128.161216
  type: 'test'
  ...
# Subtest: CR-05 (C, WR-07): a SHORT flat .raw is refused BY NAME, never parsed as a load address plus payload
ok 119 - CR-05 (C, WR-07): a SHORT flat .raw is refused BY NAME, never parsed as a load address plus payload
  ---
  duration_ms: 0.817257
  type: 'test'
  ...
# Subtest: CR-05 (D): the retired JSON project form still loads, so an existing project file is not broken
ok 120 - CR-05 (D): the retired JSON project form still loads, so an existing project file is not broken
  ---
  duration_ms: 0.941671
  type: 'test'
  ...
# Subtest: CR-05 (E, agreement): loadProjectImage and anno-tools' loadImage answer identically for one .prg and one flat capture
ok 121 - CR-05 (E, agreement): loadProjectImage and anno-tools' loadImage answer identically for one .prg and one flat capture
  ---
  duration_ms: 7.645237
  type: 'test'
  ...
# Subtest: CR-05 (F, one decode two callers): anno-cli.ts's cross-reference byte source delegates to this loader rather than re-parsing
ok 122 - CR-05 (F, one decode two callers): anno-cli.ts's cross-reference byte source delegates to this loader rather than re-parsing
  ---
  duration_ms: 0.406828
  type: 'test'
  ...
# Subtest: CR-05 (F, behavioural): a file the loader refuses yields BOTH no usable image and payloadDecoded:false in one run
ok 123 - CR-05 (F, behavioural): a file the loader refuses yields BOTH no usable image and payloadDecoded:false in one run
  ---
  duration_ms: 0.645621
  type: 'test'
  ...
# Subtest: CR-05 (G, read-only and re-runnable): two runs over one store and image give the same figures and leave the store byte-identical
ok 124 - CR-05 (G, read-only and re-runnable): two runs over one store and image give the same figures and leave the store byte-identical
  ---
  duration_ms: 1.938087
  type: 'test'
  ...
# Subtest: CR-05 (H, the T-29-14-01 symmetry): a non-JSON file's reason names the path and the failure but discloses NONE of its bytes
ok 125 - CR-05 (H, the T-29-14-01 symmetry): a non-JSON file's reason names the path and the failure but discloses NONE of its bytes
  ---
  duration_ms: 0.757713
  type: 'test'
  ...
# Subtest: CR-05 (H, control): where the runtime names a parse POSITION the reason carries the offset -- a position is not content
ok 126 - CR-05 (H, control): where the runtime names a parse POSITION the reason carries the offset -- a position is not content
  ---
  duration_ms: 0.635443
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
# duration_ms 761.562273
```

## `src/mcp/vice/r2000-d64.test.ts` — verdict `re-pointed`

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
  duration_ms: 3.104899
  type: 'test'
  ...
# Subtest: extractEntry: returns exactly the written payload bytes, including the load address, honouring the final sector's used-byte count
ok 2 - extractEntry: returns exactly the written payload bytes, including the load address, honouring the final sector's used-byte count
  ---
  duration_ms: 1.326064
  type: 'test'
  ...
# Subtest: extractEntry: case-insensitive name match returns the same bytes
ok 3 - extractEntry: case-insensitive name match returns the same bytes
  ---
  duration_ms: 0.474487
  type: 'test'
  ...
# Subtest: extractEntry: unknown name throws, naming both the requested name and the available entries
ok 4 - extractEntry: unknown name throws, naming both the requested name and the available entries
  ---
  duration_ms: 0.73528
  type: 'test'
  ...
# Subtest: extractEntry: an ambiguous name (two entries sharing it) throws naming the ambiguity and returns nothing
ok 5 - extractEntry: an ambiguous name (two entries sharing it) throws naming the ambiguity and returns nothing
  ---
  duration_ms: 0.386479
  type: 'test'
  ...
# Subtest: extractEntry: a self-referential (corrupt) chain throws naming the revisited track/sector rather than looping
ok 6 - extractEntry: a self-referential (corrupt) chain throws naming the revisited track/sector rather than looping
  ---
  duration_ms: 0.227868
  type: 'test'
  ...
# Subtest: extractEntry: an out-of-image pointer throws naming the offending pointer rather than reading past the buffer
ok 7 - extractEntry: an out-of-image pointer throws naming the offending pointer rather than reading past the buffer
  ---
  duration_ms: 0.25828
  type: 'test'
  ...
# Subtest: assertPlainImage: throws for the error-info-byte variant length (175531 bytes), with the actual length named
ok 8 - assertPlainImage: throws for the error-info-byte variant length (175531 bytes), with the actual length named
  ---
  duration_ms: 0.176295
  type: 'test'
  ...
# Subtest: assertPlainImage: passes for exactly 174848 bytes
ok 9 - assertPlainImage: passes for exactly 174848 bytes
  ---
  duration_ms: 0.390047
  type: 'test'
  ...
# Subtest: extractEntry: a valid image truncated into the file's own sector throws naming the sector and the actual image length (WR-05)
ok 10 - extractEntry: a valid image truncated into the file's own sector throws naming the sector and the actual image length (WR-05)
  ---
  duration_ms: 0.636512
  type: 'test'
  ...
# Subtest: listEntries/extractEntry: a $00-padded directory name round-trips through --entry (WR-06)
ok 11 - listEntries/extractEntry: a $00-padded directory name round-trips through --entry (WR-06)
  ---
  duration_ms: 0.344685
  type: 'test'
  ...
# Subtest: extractEntry: a final sector reporting usedByte 0 throws naming the sector rather than yielding a zero-length payload (WR-05)
ok 12 - extractEntry: a final sector reporting usedByte 0 throws naming the sector rather than yielding a zero-length payload (WR-05)
  ---
  duration_ms: 0.237763
  type: 'test'
  ...
# Subtest: extractEntry: a hand-written final sector (usedByte 0x04, no fixture helper) returns exactly the three literal payload bytes it names (WR-12)
ok 13 - extractEntry: a hand-written final sector (usedByte 0x04, no fixture helper) returns exactly the three literal payload bytes it names (WR-12)
  ---
  duration_ms: 0.171904
  type: 'test'
  ...
# Subtest: extractEntry: a hand-written final sector at the one-payload-byte boundary (usedByte 0x02, no fixture helper) returns exactly that one byte (WR-12)
ok 14 - extractEntry: a hand-written final sector at the one-payload-byte boundary (usedByte 0x02, no fixture helper) returns exactly that one byte (WR-12)
  ---
  duration_ms: 0.226208
  type: 'test'
  ...
# Subtest: composition: extracted bytes feed parsePrg(), and the recovered origin matches the fixture's load address
ok 15 - composition: extracted bytes feed parsePrg(), and the recovered origin matches the fixture's load address
  ---
  duration_ms: 0.265411
  type: 'test'
  ...
# Subtest: sectorsPerTrack covers all four standard 1541 zones
ok 16 - sectorsPerTrack covers all four standard 1541 zones
  ---
  duration_ms: 0.076018
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
# duration_ms 126.024882
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
  duration_ms: 3.122252
  type: 'test'
  ...
# Subtest: extractEntry: returns exactly the written payload bytes, including the load address, honouring the final sector's used-byte count
ok 2 - extractEntry: returns exactly the written payload bytes, including the load address, honouring the final sector's used-byte count
  ---
  duration_ms: 1.329759
  type: 'test'
  ...
# Subtest: extractEntry: case-insensitive name match returns the same bytes
ok 3 - extractEntry: case-insensitive name match returns the same bytes
  ---
  duration_ms: 0.51167
  type: 'test'
  ...
# Subtest: extractEntry: unknown name throws, naming both the requested name and the available entries
ok 4 - extractEntry: unknown name throws, naming both the requested name and the available entries
  ---
  duration_ms: 0.749584
  type: 'test'
  ...
# Subtest: extractEntry: an ambiguous name (two entries sharing it) throws naming the ambiguity and returns nothing
ok 5 - extractEntry: an ambiguous name (two entries sharing it) throws naming the ambiguity and returns nothing
  ---
  duration_ms: 0.398448
  type: 'test'
  ...
# Subtest: extractEntry: a self-referential (corrupt) chain throws naming the revisited track/sector rather than looping
ok 6 - extractEntry: a self-referential (corrupt) chain throws naming the revisited track/sector rather than looping
  ---
  duration_ms: 0.237971
  type: 'test'
  ...
# Subtest: extractEntry: an out-of-image pointer throws naming the offending pointer rather than reading past the buffer
ok 7 - extractEntry: an out-of-image pointer throws naming the offending pointer rather than reading past the buffer
  ---
  duration_ms: 0.259526
  type: 'test'
  ...
# Subtest: assertPlainImage: throws for the error-info-byte variant length (175531 bytes), with the actual length named
ok 8 - assertPlainImage: throws for the error-info-byte variant length (175531 bytes), with the actual length named
  ---
  duration_ms: 0.164709
  type: 'test'
  ...
# Subtest: assertPlainImage: passes for exactly 174848 bytes
not ok 9 - assertPlainImage: passes for exactly 174848 bytes
  ---
  duration_ms: 0.841326
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-d64.test.ts:191:1'
  failureType: 'testCodeFailure'
  error: |-
    Got unwanted exception.
    Actual message: "assertPlainImage: expected a plain 174848-byte, 35-track .d64 image with no error-info bytes, got 174848 bytes"
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  actual:
  error: 'assertPlainImage: expected a plain 174848-byte, 35-track .d64 image with no error-info bytes, got 174848 bytes'
  stack: |-
    assertPlainImage (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-d64.ts:306:11)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-d64.test.ts:192:29
    getActual (node:assert:609:5)
    Function.doesNotThrow (node:assert:777:32)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-d64.test.ts:192:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
  operator: 'doesNotThrow'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-d64.test.ts:192:10)
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
  duration_ms: 0.728766
  type: 'test'
  ...
# Subtest: listEntries/extractEntry: a $00-padded directory name round-trips through --entry (WR-06)
ok 11 - listEntries/extractEntry: a $00-padded directory name round-trips through --entry (WR-06)
  ---
  duration_ms: 0.369066
  type: 'test'
  ...
# Subtest: extractEntry: a final sector reporting usedByte 0 throws naming the sector rather than yielding a zero-length payload (WR-05)
ok 12 - extractEntry: a final sector reporting usedByte 0 throws naming the sector rather than yielding a zero-length payload (WR-05)
  ---
  duration_ms: 0.248093
  type: 'test'
  ...
# Subtest: extractEntry: a hand-written final sector (usedByte 0x04, no fixture helper) returns exactly the three literal payload bytes it names (WR-12)
ok 13 - extractEntry: a hand-written final sector (usedByte 0x04, no fixture helper) returns exactly the three literal payload bytes it names (WR-12)
  ---
  duration_ms: 0.185828
  type: 'test'
  ...
# Subtest: extractEntry: a hand-written final sector at the one-payload-byte boundary (usedByte 0x02, no fixture helper) returns exactly that one byte (WR-12)
ok 14 - extractEntry: a hand-written final sector at the one-payload-byte boundary (usedByte 0x02, no fixture helper) returns exactly that one byte (WR-12)
  ---
  duration_ms: 0.221626
  type: 'test'
  ...
# Subtest: composition: extracted bytes feed parsePrg(), and the recovered origin matches the fixture's load address
ok 15 - composition: extracted bytes feed parsePrg(), and the recovered origin matches the fixture's load address
  ---
  duration_ms: 0.263208
  type: 'test'
  ...
# Subtest: sectorsPerTrack covers all four standard 1541 zones
ok 16 - sectorsPerTrack covers all four standard 1541 zones
  ---
  duration_ms: 0.069035
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
# duration_ms 140.125152
```

## `src/mcp/vice/r2000-enum-gen.test.ts` — verdict `re-pointed`

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
  duration_ms: 2.388271
  type: 'test'
  ...
# Subtest: registerKeyFor formats addresses as $XXXX (uppercase, 4-hex-digit)
ok 2 - registerKeyFor formats addresses as $XXXX (uppercase, 4-hex-digit)
  ---
  duration_ms: 0.141081
  type: 'test'
  ...
# Subtest: variantNameFor is injective across all 256 values for $D011
ok 3 - variantNameFor is injective across all 256 values for $D011
  ---
  duration_ms: 0.768226
  type: 'test'
  ...
# Subtest: variantNameFor is injective across all 256 values for $D016
ok 4 - variantNameFor is injective across all 256 values for $D016
  ---
  duration_ms: 1.191916
  type: 'test'
  ...
# Subtest: variantNameFor is injective across all 256 values for $D018
ok 5 - variantNameFor is injective across all 256 values for $D018
  ---
  duration_ms: 0.52703
  type: 'test'
  ...
# Subtest: variantNameFor is injective across all 256 values for $D015
ok 6 - variantNameFor is injective across all 256 values for $D015
  ---
  duration_ms: 0.594231
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier rejects '1BAD', 'has space', 'has-dash', '' and accepts a legal identifier
ok 7 - assertLegalAcmeIdentifier rejects '1BAD', 'has space', 'has-dash', '' and accepts a legal identifier
  ---
  duration_ms: 0.593205
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier rejects a newline-bearing token and a token containing '='
ok 8 - assertLegalAcmeIdentifier rejects a newline-bearing token and a token containing '='
  ---
  duration_ms: 0.134343
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier rejects a reserved 6502 mnemonic, measured against real ACME (LDA)
ok 9 - assertLegalAcmeIdentifier rejects a reserved 6502 mnemonic, measured against real ACME (LDA)
  ---
  duration_ms: 0.627111
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier accepts a bare register letter (A/X/Y), measured NOT reserved against real ACME
ok 10 - assertLegalAcmeIdentifier accepts a bare register letter (A/X/Y), measured NOT reserved against real ACME
  ---
  duration_ms: 0.379031
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier rejects an identifier longer than the length ceiling
ok 11 - assertLegalAcmeIdentifier rejects an identifier longer than the length ceiling
  ---
  duration_ms: 0.180596
  type: 'test'
  ...
# Subtest: sanitizeVariantMap builds the {$hex: name} shape and sanitizes every value
ok 12 - sanitizeVariantMap builds the {$hex: name} shape and sanitizes every value
  ---
  duration_ms: 0.735349
  type: 'test'
  ...
# Subtest: sanitizeVariantMap refuses a bad token before returning anything
ok 13 - sanitizeVariantMap refuses a bad token before returning anything
  ---
  duration_ms: 0.130086
  type: 'test'
  ...
# Subtest: T-11-NAME-INJECT: sanitizeVariantMap refuses the injection shape (newline + '= $00') and returns NOTHING, so a rebuilt installer that calls it first cannot pass the name on
ok 14 - T-11-NAME-INJECT: sanitizeVariantMap refuses the injection shape (newline + '= $00') and returns NOTHING, so a rebuilt installer that calls it first cannot pass the name on
  ---
  duration_ms: 0.134418
  type: 'test'
  ...
# Subtest: pairSearchRows: a store at A+2 pairs with its immediate load; a store at A+3 does not
ok 15 - pairSearchRows: a store at A+2 pairs with its immediate load; a store at A+3 does not
  ---
  duration_ms: 0.424216
  type: 'test'
  ...
# Subtest: pairSearchRows: a store to a register the bit-name table does not know is not counted at all
ok 16 - pairSearchRows: a store to a register the bit-name table does not know is not counted at all
  ---
  duration_ms: 0.106111
  type: 'test'
  ...
# Subtest: pairSearchRows: register matching is case-insensitive on the operand's hex ($d011 and $D011 both pair)
ok 17 - pairSearchRows: register matching is case-insensitive on the operand's hex ($d011 and $D011 both pair)
  ---
  duration_ms: 0.185029
  type: 'test'
  ...
# Subtest: pairSearchRows: an unparsable immediate operand is skipped rather than fatal (D-23's 'a miss costs nothing')
ok 18 - pairSearchRows: an unparsable immediate operand is skipped rather than fatal (D-23's 'a miss costs nothing')
  ---
  duration_ms: 0.126932
  type: 'test'
  ...
# Subtest: pairSearchRows: a pass whose row count EQUALS the requested ceiling is reported as possibly truncated (D-23, no silent caps)
ok 19 - pairSearchRows: a pass whose row count EQUALS the requested ceiling is reported as possibly truncated (D-23, no silent caps)
  ---
  duration_ms: 0.196936
  type: 'test'
  ...
# Subtest: parseImmediateOperand parses hex, decimal and binary immediates, and refuses a non-immediate operand
ok 20 - parseImmediateOperand parses hex, decimal and binary immediates, and refuses a non-immediate operand
  ---
  duration_ms: 0.17137
  type: 'test'
  ...
# Subtest: planEnumsForPairing: two stores of the SAME value to one register produce ONE variant and TWO usages (D-20)
ok 21 - planEnumsForPairing: two stores of the SAME value to one register produce ONE variant and TWO usages (D-20)
  ---
  duration_ms: 0.252086
  type: 'test'
  ...
# Subtest: planEnumsForPairing: two DISTINCT values to one register produce two variants, and never a 256-value table
ok 22 - planEnumsForPairing: two DISTINCT values to one register produce two variants, and never a 256-value table
  ---
  duration_ms: 0.137007
  type: 'test'
  ...
# Subtest: planEnumsForPairing: a usage binds to the lda address, NEVER the store address (measured binding rule)
ok 23 - planEnumsForPairing: a usage binds to the lda address, NEVER the store address (measured binding rule)
  ---
  duration_ms: 0.118906
  type: 'test'
  ...
# Subtest: planEnumsForPairing: two different registers produce two separate enums
ok 24 - planEnumsForPairing: two different registers produce two separate enums
  ---
  duration_ms: 0.183698
  type: 'test'
  ...
# Subtest: buildEnumGenerationReport: the summary lines contain 'truncat' when a pass hit its ceiling, and always carry total/paired/unpaired
ok 25 - buildEnumGenerationReport: the summary lines contain 'truncat' when a pass hit its ceiling, and always carry total/paired/unpaired
  ---
  duration_ms: 0.343305
  type: 'test'
  ...
# Subtest: buildEnumGenerationReport: a run below its ceiling says NOTHING about truncation -- the signal must not be always-on
ok 26 - buildEnumGenerationReport: a run below its ceiling says NOTHING about truncation -- the signal must not be always-on
  ---
  duration_ms: 0.168336
  type: 'test'
  ...
# Subtest: buildEnumGenerationReport: an 'updated' action is reportable, so R2000-13's re-runnability stays expressible
ok 27 - buildEnumGenerationReport: an 'updated' action is reportable, so R2000-13's re-runnability stays expressible
  ---
  duration_ms: 0.109272
  type: 'test'
  ...
# Subtest: anno-enum-gen.ts never references the machine-global save_global_enum() route (D-21, zero-count grep)
ok 28 - anno-enum-gen.ts never references the machine-global save_global_enum() route (D-21, zero-count grep)
  ---
  duration_ms: 0.248095
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
# duration_ms 137.137617
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
  duration_ms: 3.601458
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.test.ts:79:1'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register $0D011 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.ts:190:11)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.test.ts:80:16)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
# Subtest: registerKeyFor formats addresses as $XXXX (uppercase, 4-hex-digit)
not ok 2 - registerKeyFor formats addresses as $XXXX (uppercase, 4-hex-digit)
  ---
  duration_ms: 1.319107
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.test.ts:83:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    
    '$0D011' !== '$D011'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: '$D011'
  actual: '$0D011'
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.test.ts:84:10)
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
  duration_ms: 0.231519
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.test.ts:94:3'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register $0D011 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.ts:190:11)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.test.ts:97:20)
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
  duration_ms: 0.16172
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.test.ts:94:3'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register $0D016 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.ts:190:11)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.test.ts:97:20)
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
  duration_ms: 0.159176
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.test.ts:94:3'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register $0D018 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.ts:190:11)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.test.ts:97:20)
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
  duration_ms: 0.145081
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.test.ts:94:3'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register $0D015 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.ts:190:11)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.test.ts:97:20)
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
  duration_ms: 0.920299
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier rejects a newline-bearing token and a token containing '='
ok 8 - assertLegalAcmeIdentifier rejects a newline-bearing token and a token containing '='
  ---
  duration_ms: 0.267215
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier rejects a reserved 6502 mnemonic, measured against real ACME (LDA)
ok 9 - assertLegalAcmeIdentifier rejects a reserved 6502 mnemonic, measured against real ACME (LDA)
  ---
  duration_ms: 0.957379
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier accepts a bare register letter (A/X/Y), measured NOT reserved against real ACME
ok 10 - assertLegalAcmeIdentifier accepts a bare register letter (A/X/Y), measured NOT reserved against real ACME
  ---
  duration_ms: 0.606891
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier rejects an identifier longer than the length ceiling
ok 11 - assertLegalAcmeIdentifier rejects an identifier longer than the length ceiling
  ---
  duration_ms: 0.321639
  type: 'test'
  ...
# Subtest: sanitizeVariantMap builds the {$hex: name} shape and sanitizes every value
ok 12 - sanitizeVariantMap builds the {$hex: name} shape and sanitizes every value
  ---
  duration_ms: 1.084732
  type: 'test'
  ...
# Subtest: sanitizeVariantMap refuses a bad token before returning anything
ok 13 - sanitizeVariantMap refuses a bad token before returning anything
  ---
  duration_ms: 0.313773
  type: 'test'
  ...
# Subtest: T-11-NAME-INJECT: sanitizeVariantMap refuses the injection shape (newline + '= $00') and returns NOTHING, so a rebuilt installer that calls it first cannot pass the name on
ok 14 - T-11-NAME-INJECT: sanitizeVariantMap refuses the injection shape (newline + '= $00') and returns NOTHING, so a rebuilt installer that calls it first cannot pass the name on
  ---
  duration_ms: 0.267535
  type: 'test'
  ...
# Subtest: pairSearchRows: a store at A+2 pairs with its immediate load; a store at A+3 does not
ok 15 - pairSearchRows: a store at A+2 pairs with its immediate load; a store at A+3 does not
  ---
  duration_ms: 0.683489
  type: 'test'
  ...
# Subtest: pairSearchRows: a store to a register the bit-name table does not know is not counted at all
ok 16 - pairSearchRows: a store to a register the bit-name table does not know is not counted at all
  ---
  duration_ms: 0.209173
  type: 'test'
  ...
# Subtest: pairSearchRows: register matching is case-insensitive on the operand's hex ($d011 and $D011 both pair)
ok 17 - pairSearchRows: register matching is case-insensitive on the operand's hex ($d011 and $D011 both pair)
  ---
  duration_ms: 0.25582
  type: 'test'
  ...
# Subtest: pairSearchRows: an unparsable immediate operand is skipped rather than fatal (D-23's 'a miss costs nothing')
ok 18 - pairSearchRows: an unparsable immediate operand is skipped rather than fatal (D-23's 'a miss costs nothing')
  ---
  duration_ms: 0.377795
  type: 'test'
  ...
# Subtest: pairSearchRows: a pass whose row count EQUALS the requested ceiling is reported as possibly truncated (D-23, no silent caps)
ok 19 - pairSearchRows: a pass whose row count EQUALS the requested ceiling is reported as possibly truncated (D-23, no silent caps)
  ---
  duration_ms: 0.286902
  type: 'test'
  ...
# Subtest: parseImmediateOperand parses hex, decimal and binary immediates, and refuses a non-immediate operand
ok 20 - parseImmediateOperand parses hex, decimal and binary immediates, and refuses a non-immediate operand
  ---
  duration_ms: 0.228883
  type: 'test'
  ...
# Subtest: planEnumsForPairing: two stores of the SAME value to one register produce ONE variant and TWO usages (D-20)
not ok 21 - planEnumsForPairing: two stores of the SAME value to one register produce ONE variant and TWO usages (D-20)
  ---
  duration_ms: 0.390548
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.test.ts:242:1'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register $0D011 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.ts:190:11)
    planEnumsForPairing (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.ts:459:27)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.test.ts:247:19)
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
  duration_ms: 0.226181
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.test.ts:259:1'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register $0D011 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.ts:190:11)
    planEnumsForPairing (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.ts:459:27)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.test.ts:264:19)
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
  duration_ms: 0.294756
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.test.ts:270:1'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register $0D011 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.ts:190:11)
    planEnumsForPairing (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.ts:459:27)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.test.ts:272:19)
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
  duration_ms: 0.226426
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.test.ts:277:1'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register $0D011 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.ts:190:11)
    planEnumsForPairing (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.ts:459:27)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-enum-gen.test.ts:282:19)
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
  duration_ms: 0.513579
  type: 'test'
  ...
# Subtest: buildEnumGenerationReport: a run below its ceiling says NOTHING about truncation -- the signal must not be always-on
ok 26 - buildEnumGenerationReport: a run below its ceiling says NOTHING about truncation -- the signal must not be always-on
  ---
  duration_ms: 0.279986
  type: 'test'
  ...
# Subtest: buildEnumGenerationReport: an 'updated' action is reportable, so R2000-13's re-runnability stays expressible
ok 27 - buildEnumGenerationReport: an 'updated' action is reportable, so R2000-13's re-runnability stays expressible
  ---
  duration_ms: 0.219874
  type: 'test'
  ...
# Subtest: anno-enum-gen.ts never references the machine-global save_global_enum() route (D-21, zero-count grep)
ok 28 - anno-enum-gen.ts never references the machine-global save_global_enum() route (D-21, zero-count grep)
  ---
  duration_ms: 0.359935
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
# duration_ms 151.531373
```

## `src/mcp/vice/r2000-memmap-render.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test anno-memmap-render.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# (node:62380) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: parseProvenanceHeader accepts a fully-filled valid header
ok 1 - parseProvenanceHeader accepts a fully-filled valid header
  ---
  duration_ms: 1.389126
  type: 'test'
  ...
# Subtest: parseProvenanceHeader accepts an optional rasterPositions array
ok 2 - parseProvenanceHeader accepts an optional rasterPositions array
  ---
  duration_ms: 0.789303
  type: 'test'
  ...
# Subtest: parseProvenanceHeader({}) throws listing ALL missing required keys in one message
ok 3 - parseProvenanceHeader({}) throws listing ALL missing required keys in one message
  ---
  duration_ms: 1.211783
  type: 'test'
  ...
# Subtest: parseProvenanceHeader refuses a template-placeholder captureSha256 and videoStandard, naming both
ok 4 - parseProvenanceHeader refuses a template-placeholder captureSha256 and videoStandard, naming both
  ---
  duration_ms: 0.307309
  type: 'test'
  ...
# Subtest: parseProvenanceHeader refuses a bad hash length
ok 5 - parseProvenanceHeader refuses a bad hash length
  ---
  duration_ms: 0.325196
  type: 'test'
  ...
# Subtest: parseProvenanceHeader refuses a videoStandard value that is neither a placeholder nor PAL/NTSC
ok 6 - parseProvenanceHeader refuses a videoStandard value that is neither a placeholder nor PAL/NTSC
  ---
  duration_ms: 0.206155
  type: 'test'
  ...
# Subtest: parseProvenanceHeader refuses a malformed rasterPositions
ok 7 - parseProvenanceHeader refuses a malformed rasterPositions
  ---
  duration_ms: 0.238753
  type: 'test'
  ...
# Subtest: parseProvenanceHeader refuses a non-object payload
ok 8 - parseProvenanceHeader refuses a non-object payload
  ---
  duration_ms: 0.20048
  type: 'test'
  ...
# Subtest: the renderer's layout is embedded in TypeScript, never read from the recon skill's template at runtime
ok 9 - the renderer's layout is embedded in TypeScript, never read from the recon skill's template at runtime
  ---
  duration_ms: 0.57947
  type: 'test'
  ...
# Subtest: escapeMarkdownCell escapes a pipe character
ok 10 - escapeMarkdownCell escapes a pipe character
  ---
  duration_ms: 0.536154
  type: 'test'
  ...
# Subtest: escapeMarkdownCell collapses \\n, \\r\\n and a bare \\r into <br>
ok 11 - escapeMarkdownCell collapses \\n, \\r\\n and a bare \\r into <br>
  ---
  duration_ms: 0.258079
  type: 'test'
  ...
# Subtest: escapeMarkdownCell returns a plain string unchanged
ok 12 - escapeMarkdownCell returns a plain string unchanged
  ---
  duration_ms: 0.147267
  type: 'test'
  ...
# Subtest: escapeMarkdownCell returns an empty string unchanged
ok 13 - escapeMarkdownCell returns an empty string unchanged
  ---
  duration_ms: 0.094364
  type: 'test'
  ...
# Subtest: RENDERER_VERSION is bumped to "3" for the store re-point -- the digest's canonical input is store rows, not the three wire shapes
ok 14 - RENDERER_VERSION is bumped to "3" for the store re-point -- the digest's canonical input is store rows, not the three wire shapes
  ---
  duration_ms: 0.065976
  type: 'test'
  ...
# Subtest: the render digest is identical across two renders of the same store and the same sidecar
ok 15 - the render digest is identical across two renders of the same store and the same sidecar
  ---
  duration_ms: 59.859713
  type: 'test'
  ...
# Subtest: changing a LABEL in the store changes the render digest -- the digest covers the store, not just the sidecar
ok 16 - changing a LABEL in the store changes the render digest -- the digest covers the store, not just the sidecar
  ---
  duration_ms: 63.712463
  type: 'test'
  ...
# Subtest: changing a COMMENT in the store changes the render digest
ok 17 - changing a COMMENT in the store changes the render digest
  ---
  duration_ms: 70.772809
  type: 'test'
  ...
# Subtest: changing a RANGE in the store changes the render digest
ok 18 - changing a RANGE in the store changes the render digest
  ---
  duration_ms: 82.169728
  type: 'test'
  ...
# Subtest: changing the SIDECAR BYTES alone changes the render digest, even when the parsed object is equivalent
ok 19 - changing the SIDECAR BYTES alone changes the render digest, even when the parsed object is equivalent
  ---
  duration_ms: 56.893738
  type: 'test'
  ...
# Subtest: the surviving measurement-provenance paragraph STATES the version-2 wire shapes inline, rather than pointing at declarations that no longer exist
ok 20 - the surviving measurement-provenance paragraph STATES the version-2 wire shapes inline, rather than pointing at declarations that no longer exist
  ---
  duration_ms: 0.690506
  type: 'test'
  ...
# Subtest: renders a golden memory map from a hand-built store plus a fixture sidecar, exact bytes except the digest line
ok 21 - renders a golden memory map from a hand-built store plus a fixture sidecar, exact bytes except the digest line
  ---
  duration_ms: 89.914426
  type: 'test'
  ...
# Subtest: the render digest and the --check verdict AGREE: the identical tree at a different absolute path is in-sync, not drifted
ok 22 - the render digest and the --check verdict AGREE: the identical tree at a different absolute path is in-sync, not drifted
  ---
  duration_ms: 62.82848
  type: 'test'
  ...
# Subtest: a store with ZERO ranges, labels and comments renders a banner and a digest, and that file cross-root checks in-sync -- a zero-row render is a RESULT, never a refusal
ok 23 - a store with ZERO ranges, labels and comments renders a banner and a digest, and that file cross-root checks in-sync -- a zero-row render is a RESULT, never a refusal
  ---
  duration_ms: 12.451091
  type: 'test'
  ...
# Subtest: --check names the LOWEST differing line when the file differs on several, and two runs over the same inputs name the same line
ok 24 - --check names the LOWEST differing line when the file differs on several, and two runs over the same inputs name the same line
  ---
  duration_ms: 61.797204
  type: 'test'
  ...
# Subtest: an address whose store comment carries [unknown] appears under Open questions, and a malformed confidence prefix throws rather than rendering silently
ok 25 - an address whose store comment carries [unknown] appears under Open questions, and a malformed confidence prefix throws rather than rendering silently
  ---
  duration_ms: 57.321838
  type: 'test'
  ...
# Subtest: comment evidence containing BOTH a pipe and an embedded newline renders as ONE well-formed table row, table structure intact, escaped content preserved
ok 26 - comment evidence containing BOTH a pipe and an embedded newline renders as ONE well-formed table row, table structure intact, escaped content preserved
  ---
  duration_ms: 83.158647
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
# duration_ms 898.017168
```

### Planted run

- **Plant:** `src/mcp/vice/anno-memmap-render.ts`: `if (!/^[0-9a-fA-F]{64}$/.test(sha.trim())) {` → `if (!/^[0-9a-fA-F]{63}$/.test(sha.trim())) {`
- **Planted command:** `node --test anno-memmap-render.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# (node:62404) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: parseProvenanceHeader accepts a fully-filled valid header
not ok 1 - parseProvenanceHeader accepts a fully-filled valid header
  ---
  duration_ms: 2.937391
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:65:1'
  failureType: 'testCodeFailure'
  error: |-
    provenance sidecar has 1 problem(s):
      - captureSha256: must be exactly 64 hex characters, got "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (length 64)
  code: 'ERR_TEST_FAILURE'
  name: 'R2000ProvenanceHeaderError'
  stack: |-
    parseProvenanceHeader (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.ts:244:11)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:66:18)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
# Subtest: parseProvenanceHeader accepts an optional rasterPositions array
not ok 2 - parseProvenanceHeader accepts an optional rasterPositions array
  ---
  duration_ms: 0.439648
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:73:1'
  failureType: 'testCodeFailure'
  error: |-
    provenance sidecar has 1 problem(s):
      - captureSha256: must be exactly 64 hex characters, got "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (length 64)
  code: 'ERR_TEST_FAILURE'
  name: 'R2000ProvenanceHeaderError'
  stack: |-
    parseProvenanceHeader (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.ts:244:11)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:74:18)
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
  duration_ms: 1.362064
  type: 'test'
  ...
# Subtest: parseProvenanceHeader refuses a template-placeholder captureSha256 and videoStandard, naming both
ok 4 - parseProvenanceHeader refuses a template-placeholder captureSha256 and videoStandard, naming both
  ---
  duration_ms: 0.720602
  type: 'test'
  ...
# Subtest: parseProvenanceHeader refuses a bad hash length
ok 5 - parseProvenanceHeader refuses a bad hash length
  ---
  duration_ms: 0.50707
  type: 'test'
  ...
# Subtest: parseProvenanceHeader refuses a videoStandard value that is neither a placeholder nor PAL/NTSC
ok 6 - parseProvenanceHeader refuses a videoStandard value that is neither a placeholder nor PAL/NTSC
  ---
  duration_ms: 0.492122
  type: 'test'
  ...
# Subtest: parseProvenanceHeader refuses a malformed rasterPositions
ok 7 - parseProvenanceHeader refuses a malformed rasterPositions
  ---
  duration_ms: 0.552793
  type: 'test'
  ...
# Subtest: parseProvenanceHeader refuses a non-object payload
ok 8 - parseProvenanceHeader refuses a non-object payload
  ---
  duration_ms: 0.446815
  type: 'test'
  ...
# Subtest: the renderer's layout is embedded in TypeScript, never read from the recon skill's template at runtime
ok 9 - the renderer's layout is embedded in TypeScript, never read from the recon skill's template at runtime
  ---
  duration_ms: 0.93818
  type: 'test'
  ...
# Subtest: escapeMarkdownCell escapes a pipe character
ok 10 - escapeMarkdownCell escapes a pipe character
  ---
  duration_ms: 0.80424
  type: 'test'
  ...
# Subtest: escapeMarkdownCell collapses \\n, \\r\\n and a bare \\r into <br>
ok 11 - escapeMarkdownCell collapses \\n, \\r\\n and a bare \\r into <br>
  ---
  duration_ms: 0.424438
  type: 'test'
  ...
# Subtest: escapeMarkdownCell returns a plain string unchanged
ok 12 - escapeMarkdownCell returns a plain string unchanged
  ---
  duration_ms: 0.232739
  type: 'test'
  ...
# Subtest: escapeMarkdownCell returns an empty string unchanged
ok 13 - escapeMarkdownCell returns an empty string unchanged
  ---
  duration_ms: 0.195667
  type: 'test'
  ...
# Subtest: RENDERER_VERSION is bumped to "3" for the store re-point -- the digest's canonical input is store rows, not the three wire shapes
ok 14 - RENDERER_VERSION is bumped to "3" for the store re-point -- the digest's canonical input is store rows, not the three wire shapes
  ---
  duration_ms: 0.174813
  type: 'test'
  ...
# Subtest: the render digest is identical across two renders of the same store and the same sidecar
not ok 15 - the render digest is identical across two renders of the same store and the same sidecar
  ---
  duration_ms: 57.108018
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:251:1'
  failureType: 'testCodeFailure'
  error: |-
    provenance sidecar has 1 problem(s):
      - captureSha256: must be exactly 64 hex characters, got "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (length 64)
  code: 'ERR_TEST_FAILURE'
  name: 'R2000ProvenanceHeaderError'
  stack: |-
    parseProvenanceHeader (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.ts:244:11)
    renderMemoryMap (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.ts:416:22)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:253:25
    withRenderFixture (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:210:26)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:252:9)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
  ...
# Subtest: changing a LABEL in the store changes the render digest -- the digest covers the store, not just the sidecar
not ok 16 - changing a LABEL in the store changes the render digest -- the digest covers the store, not just the sidecar
  ---
  duration_ms: 52.432649
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:261:1'
  failureType: 'testCodeFailure'
  error: |-
    provenance sidecar has 1 problem(s):
      - captureSha256: must be exactly 64 hex characters, got "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (length 64)
  code: 'ERR_TEST_FAILURE'
  name: 'R2000ProvenanceHeaderError'
  stack: |-
    parseProvenanceHeader (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.ts:244:11)
    renderMemoryMap (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.ts:416:22)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:263:26
    withRenderFixture (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:210:26)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:262:9)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
  ...
# Subtest: changing a COMMENT in the store changes the render digest
not ok 17 - changing a COMMENT in the store changes the render digest
  ---
  duration_ms: 54.997607
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:277:1'
  failureType: 'testCodeFailure'
  error: |-
    provenance sidecar has 1 problem(s):
      - captureSha256: must be exactly 64 hex characters, got "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (length 64)
  code: 'ERR_TEST_FAILURE'
  name: 'R2000ProvenanceHeaderError'
  stack: |-
    parseProvenanceHeader (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.ts:244:11)
    renderMemoryMap (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.ts:416:22)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:279:26
    withRenderFixture (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:210:26)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:278:9)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
  ...
# Subtest: changing a RANGE in the store changes the render digest
not ok 18 - changing a RANGE in the store changes the render digest
  ---
  duration_ms: 57.278574
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:293:1'
  failureType: 'testCodeFailure'
  error: |-
    provenance sidecar has 1 problem(s):
      - captureSha256: must be exactly 64 hex characters, got "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (length 64)
  code: 'ERR_TEST_FAILURE'
  name: 'R2000ProvenanceHeaderError'
  stack: |-
    parseProvenanceHeader (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.ts:244:11)
    renderMemoryMap (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.ts:416:22)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:295:26
    withRenderFixture (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:210:26)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:294:9)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
  ...
# Subtest: changing the SIDECAR BYTES alone changes the render digest, even when the parsed object is equivalent
not ok 19 - changing the SIDECAR BYTES alone changes the render digest, even when the parsed object is equivalent
  ---
  duration_ms: 57.336699
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:309:1'
  failureType: 'testCodeFailure'
  error: |-
    provenance sidecar has 1 problem(s):
      - captureSha256: must be exactly 64 hex characters, got "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (length 64)
  code: 'ERR_TEST_FAILURE'
  name: 'R2000ProvenanceHeaderError'
  stack: |-
    parseProvenanceHeader (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.ts:244:11)
    renderMemoryMap (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.ts:416:22)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:311:26
    withRenderFixture (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:210:26)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:310:9)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
  ...
# Subtest: the surviving measurement-provenance paragraph STATES the version-2 wire shapes inline, rather than pointing at declarations that no longer exist
ok 20 - the surviving measurement-provenance paragraph STATES the version-2 wire shapes inline, rather than pointing at declarations that no longer exist
  ---
  duration_ms: 0.726206
  type: 'test'
  ...
# Subtest: renders a golden memory map from a hand-built store plus a fixture sidecar, exact bytes except the digest line
not ok 21 - renders a golden memory map from a hand-built store plus a fixture sidecar, exact bytes except the digest line
  ---
  duration_ms: 75.279297
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:364:1'
  failureType: 'testCodeFailure'
  error: |-
    provenance sidecar has 1 problem(s):
      - captureSha256: must be exactly 64 hex characters, got "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (length 64)
  code: 'ERR_TEST_FAILURE'
  name: 'R2000ProvenanceHeaderError'
  stack: |-
    parseProvenanceHeader (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.ts:244:11)
    renderMemoryMap (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.ts:416:22)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:396:28
    withRenderFixture (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:210:26)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:365:9)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
  ...
# Subtest: the render digest and the --check verdict AGREE: the identical tree at a different absolute path is in-sync, not drifted
not ok 22 - the render digest and the --check verdict AGREE: the identical tree at a different absolute path is in-sync, not drifted
  ---
  duration_ms: 60.970843
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:560:1'
  failureType: 'testCodeFailure'
  error: |-
    provenance sidecar has 1 problem(s):
      - captureSha256: must be exactly 64 hex characters, got "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (length 64)
  code: 'ERR_TEST_FAILURE'
  name: 'R2000ProvenanceHeaderError'
  stack: |-
    parseProvenanceHeader (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.ts:244:11)
    renderMemoryMap (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.ts:416:22)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:585:27)
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
  duration_ms: 9.636361
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:640:1'
  failureType: 'testCodeFailure'
  error: |-
    provenance sidecar has 1 problem(s):
      - captureSha256: must be exactly 64 hex characters, got "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (length 64)
  code: 'ERR_TEST_FAILURE'
  name: 'R2000ProvenanceHeaderError'
  stack: |-
    parseProvenanceHeader (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.ts:244:11)
    renderMemoryMap (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.ts:416:22)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:655:26)
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
  duration_ms: 54.72054
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:687:1'
  failureType: 'testCodeFailure'
  error: |-
    provenance sidecar has 1 problem(s):
      - captureSha256: must be exactly 64 hex characters, got "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (length 64)
  code: 'ERR_TEST_FAILURE'
  name: 'R2000ProvenanceHeaderError'
  stack: |-
    parseProvenanceHeader (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.ts:244:11)
    renderMemoryMap (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.ts:416:22)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:691:28
    withRenderFixture (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:210:26)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:688:9)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
  ...
# Subtest: an address whose store comment carries [unknown] appears under Open questions, and a malformed confidence prefix throws rather than rendering silently
not ok 25 - an address whose store comment carries [unknown] appears under Open questions, and a malformed confidence prefix throws rather than rendering silently
  ---
  duration_ms: 24.186629
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:720:1'
  failureType: 'testCodeFailure'
  error: |-
    provenance sidecar has 1 problem(s):
      - captureSha256: must be exactly 64 hex characters, got "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (length 64)
  code: 'ERR_TEST_FAILURE'
  name: 'R2000ProvenanceHeaderError'
  stack: |-
    parseProvenanceHeader (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.ts:244:11)
    renderMemoryMap (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.ts:416:22)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:730:32
    withRenderFixture (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:210:26)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:721:9)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
  ...
# Subtest: comment evidence containing BOTH a pipe and an embedded newline renders as ONE well-formed table row, table structure intact, escaped content preserved
not ok 26 - comment evidence containing BOTH a pipe and an embedded newline renders as ONE well-formed table row, table structure intact, escaped content preserved
  ---
  duration_ms: 39.049056
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:809:1'
  failureType: 'testCodeFailure'
  error: |-
    provenance sidecar has 1 problem(s):
      - captureSha256: must be exactly 64 hex characters, got "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (length 64)
  code: 'ERR_TEST_FAILURE'
  name: 'R2000ProvenanceHeaderError'
  stack: |-
    parseProvenanceHeader (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.ts:244:11)
    renderMemoryMap (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.ts:416:22)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:805:53
    withRenderFixture (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:210:26)
    renderSingleCommentedBlock (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:797:10)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-memmap-render.test.ts:813:31)
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
# duration_ms 809.640926
```

## `src/mcp/vice/r2000-regbits.test.ts` — verdict `re-pointed`

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
  duration_ms: 4.980526
  type: 'test'
  ...
# Subtest: deriveIdentifier: drops parenthetical asides, uppercases, and collapses punctuation to underscores
ok 2 - deriveIdentifier: drops parenthetical asides, uppercases, and collapses punctuation to underscores
  ---
  duration_ms: 0.76506
  type: 'test'
  ...
# Subtest: drift guard: buildRegBits() re-run in memory deep-equals the committed anno-regbits.json (banner stripped)
ok 3 - drift guard: buildRegBits() re-run in memory deep-equals the committed anno-regbits.json (banner stripped)
  ---
  duration_ms: 5.64037
  type: 'test'
  ...
# Subtest: drift guard: the committed banner's memmapSha256 equals memmap.json's current digest
ok 4 - drift guard: the committed banner's memmapSha256 equals memmap.json's current digest
  ---
  duration_ms: 3.110032
  type: 'test'
  ...
# Subtest: drift guard: buildRegBitsDocument() emits the SAME banner shape twice in a row (no timestamp, so the comparison stays total)
ok 5 - drift guard: buildRegBitsDocument() emits the SAME banner shape twice in a row (no timestamp, so the comparison stays total)
  ---
  duration_ms: 6.797478
  type: 'test'
  ...
# Subtest: non-vacuous drift guard: appending a byte to a SCRATCH COPY of memmap.json makes the drift assertion FAIL (planted violation, ENGINEERING_RULES.md Sec 6)
ok 6 - non-vacuous drift guard: appending a byte to a SCRATCH COPY of memmap.json makes the drift assertion FAIL (planted violation, ENGINEERING_RULES.md Sec 6)
  ---
  duration_ms: 11.987768
  type: 'test'
  ...
# committed memmap.json digest: 60a517c1833a44e6dc1a99a949554fa39834b558371d9f1e98531499fe3642fe
# mutated (planted-violation) memmap.json digest: 9d1cd787afc983a7309269cfd3b730c8052fb3cdc2845ef2e1e45af78f9faaa1
# Subtest: every field name in anno-regbits.json matches ^[A-Za-z_][A-Za-z0-9_]*$
ok 7 - every field name in anno-regbits.json matches ^[A-Za-z_][A-Za-z0-9_]*$
  ---
  duration_ms: 1.285587
  type: 'test'
  ...
# Subtest: no field name or token contains the OCR-damage artifacts NMls or a bare letter-O-for-zero pattern
ok 8 - no field name or token contains the OCR-damage artifacts NMls or a bare letter-O-for-zero pattern
  ---
  duration_ms: 0.883777
  type: 'test'
  ...
# Subtest: $D011's six fields match the plan's pinned criterion-3 shape exactly
ok 9 - $D011's six fields match the plan's pinned criterion-3 shape exactly
  ---
  duration_ms: 1.257562
  type: 'test'
  ...
# Subtest: the six override-supplied (memmap-absent) registers are present: $D015, $D017, $D01A, $D01B, $D01C, $D01D
ok 10 - the six override-supplied (memmap-absent) registers are present: $D015, $D017, $D01A, $D01B, $D01C, $D01D
  ---
  duration_ms: 2.108902
  type: 'test'
  ...
# Subtest: the table also contains $D011 and $01 (address 1)
ok 11 - the table also contains $D011 and $01 (address 1)
  ---
  duration_ms: 0.596928
  type: 'test'
  ...
# Subtest: OVERRIDES: every field/register override entry carries a WHY comment (grep-counted, not eyeballed)
ok 12 - OVERRIDES: every field/register override entry carries a WHY comment (grep-counted, not eyeballed)
  ---
  duration_ms: 1.531838
  type: 'test'
  ...
# Subtest: non-vacuity: a synthetic memmap entry whose desc is unmappable and absent from OVERRIDES THROWS naming the address
ok 13 - non-vacuity: a synthetic memmap entry whose desc is unmappable and absent from OVERRIDES THROWS naming the address
  ---
  duration_ms: 9.239947
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
# duration_ms 243.149683
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
  duration_ms: 4.568697
  type: 'test'
  ...
# Subtest: deriveIdentifier: drops parenthetical asides, uppercases, and collapses punctuation to underscores
ok 2 - deriveIdentifier: drops parenthetical asides, uppercases, and collapses punctuation to underscores
  ---
  duration_ms: 0.773843
  type: 'test'
  ...
# Subtest: drift guard: buildRegBits() re-run in memory deep-equals the committed anno-regbits.json (banner stripped)
ok 3 - drift guard: buildRegBits() re-run in memory deep-equals the committed anno-regbits.json (banner stripped)
  ---
  duration_ms: 5.438405
  type: 'test'
  ...
# Subtest: drift guard: the committed banner's memmapSha256 equals memmap.json's current digest
not ok 4 - drift guard: the committed banner's memmapSha256 equals memmap.json's current digest
  ---
  duration_ms: 4.060684
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-regbits.test.ts:58:1'
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
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-regbits.test.ts:61:10)
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
  duration_ms: 6.22199
  type: 'test'
  ...
# Subtest: non-vacuous drift guard: appending a byte to a SCRATCH COPY of memmap.json makes the drift assertion FAIL (planted violation, ENGINEERING_RULES.md Sec 6)
ok 6 - non-vacuous drift guard: appending a byte to a SCRATCH COPY of memmap.json makes the drift assertion FAIL (planted violation, ENGINEERING_RULES.md Sec 6)
  ---
  duration_ms: 11.680066
  type: 'test'
  ...
# committed memmap.json digest: 60a517c2833a44e6dc1a99a949554fa39834b558371d9f1e98531499fe3642fe
# mutated (planted-violation) memmap.json digest: 9d1cd787afc983a7309269cfd3b730c8052fb3cdc2845ef2e1e45af78f9faaa1
# Subtest: every field name in anno-regbits.json matches ^[A-Za-z_][A-Za-z0-9_]*$
ok 7 - every field name in anno-regbits.json matches ^[A-Za-z_][A-Za-z0-9_]*$
  ---
  duration_ms: 1.346169
  type: 'test'
  ...
# Subtest: no field name or token contains the OCR-damage artifacts NMls or a bare letter-O-for-zero pattern
ok 8 - no field name or token contains the OCR-damage artifacts NMls or a bare letter-O-for-zero pattern
  ---
  duration_ms: 0.83711
  type: 'test'
  ...
# Subtest: $D011's six fields match the plan's pinned criterion-3 shape exactly
ok 9 - $D011's six fields match the plan's pinned criterion-3 shape exactly
  ---
  duration_ms: 1.140616
  type: 'test'
  ...
# Subtest: the six override-supplied (memmap-absent) registers are present: $D015, $D017, $D01A, $D01B, $D01C, $D01D
ok 10 - the six override-supplied (memmap-absent) registers are present: $D015, $D017, $D01A, $D01B, $D01C, $D01D
  ---
  duration_ms: 1.904738
  type: 'test'
  ...
# Subtest: the table also contains $D011 and $01 (address 1)
ok 11 - the table also contains $D011 and $01 (address 1)
  ---
  duration_ms: 0.554766
  type: 'test'
  ...
# Subtest: OVERRIDES: every field/register override entry carries a WHY comment (grep-counted, not eyeballed)
ok 12 - OVERRIDES: every field/register override entry carries a WHY comment (grep-counted, not eyeballed)
  ---
  duration_ms: 1.446593
  type: 'test'
  ...
# Subtest: non-vacuity: a synthetic memmap entry whose desc is unmappable and absent from OVERRIDES THROWS naming the address
ok 13 - non-vacuity: a synthetic memmap entry whose desc is unmappable and absent from OVERRIDES THROWS naming the address
  ---
  duration_ms: 9.109001
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
# duration_ms 231.041248
```

## `src/mcp/vice/r2000-tools.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test anno-tools.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# (node:62584) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: tracer (MCP-05): anno_get_symbols answers a real query against a real store, end to end
ok 1 - tracer (MCP-05): anno_get_symbols answers a real query against a real store, end to end
  ---
  duration_ms: 13.162454
  type: 'test'
  ...
# Subtest: anno_get_symbols narrows by address range, and reports truncation as a fact rather than leaving it to be inferred
ok 2 - anno_get_symbols narrows by address range, and reports truncation as a fact rather than leaving it to be inferred
  ---
  duration_ms: 11.930506
  type: 'test'
  ...
# Subtest: WR-02 closed: an uncurated name RESOLVES {isError:true} naming both resolution routes -- it does not reject the promise
ok 3 - WR-02 closed: an uncurated name RESOLVES {isError:true} naming both resolution routes -- it does not reject the promise
  ---
  duration_ms: 0.780851
  type: 'test'
  ...
# Subtest: a store path outside the workspace root RESOLVES {isError:true} naming AnnoStorePathError (T-29-01)
ok 4 - a store path outside the workspace root RESOLVES {isError:true} naming AnnoStorePathError (T-29-01)
  ---
  duration_ms: 2.34114
  type: 'test'
  ...
# Subtest: an absent store is refused, never created -- mustExist is what keeps 'gone' and 'empty' distinguishable
ok 5 - an absent store is refused, never created -- mustExist is what keeps 'gone' and 'empty' distinguishable
  ---
  duration_ms: 2.232553
  type: 'test'
  ...
# Subtest: the transport validates nothing, so a missing required argument is refused HERE and named
ok 6 - the transport validates nothing, so a missing required argument is refused HERE and named
  ---
  duration_ms: 0.813694
  type: 'test'
  ...
# Subtest: an unprefixed numeric address string is refused by the ONE address parser, not accepted by a second rule here
ok 7 - an unprefixed numeric address string is refused by the ONE address parser, not accepted by a second rule here
  ---
  duration_ms: 2.233684
  type: 'test'
  ...
# Subtest: assertAnnoTool's FIRST check is set membership: an uncurated name is refused before any argument is looked at
ok 8 - assertAnnoTool's FIRST check is set membership: an uncurated name is refused before any argument is looked at
  ---
  duration_ms: 0.784142
  type: 'test'
  ...
# Subtest: CURATED_ANNO_TOOLS is DERIVED from ANNO_TOOL_DEFINITIONS, never a second hand-typed list (T-29-02)
ok 9 - CURATED_ANNO_TOOLS is DERIVED from ANNO_TOOL_DEFINITIONS, never a second hand-typed list (T-29-02)
  ---
  duration_ms: 1.047647
  type: 'test'
  ...
# Subtest: anno-tools.ts holds no module-level mutable store handle (D-06)
ok 10 - anno-tools.ts holds no module-level mutable store handle (D-06)
  ---
  duration_ms: 3.163191
  type: 'test'
  ...
# Subtest: every openStore( in anno-tools.ts is closed by a closeStore( inside a finally (T-29-03)
ok 11 - every openStore( in anno-tools.ts is closed by a closeStore( inside a finally (T-29-03)
  ---
  duration_ms: 0.929495
  type: 'test'
  ...
# Subtest: MCP-02 by construction: anno-tools.ts reaches no VICE transport and no host-path seam
ok 12 - MCP-02 by construction: anno-tools.ts reaches no VICE transport and no host-path seam
  ---
  duration_ms: 1.274711
  type: 'test'
  ...
# Subtest: anno-tools.ts never throws a bare Error -- every refusal is an AnnoStoreError and therefore a ViceError
ok 13 - anno-tools.ts never throws a bare Error -- every refusal is an AnnoStoreError and therefore a ViceError
  ---
  duration_ms: 0.224714
  type: 'test'
  ...
# Subtest: the twelve write and stored-read verbs are advertised, each requiring an explicit store (D-06)
ok 14 - the twelve write and stored-read verbs are advertised, each requiring an explicit store (D-06)
  ---
  duration_ms: 0.301415
  type: 'test'
  ...
# Subtest: a repeated identical anno_set_label_name SUCCEEDS reporting changed:false -- an annotation pass re-run is not an error
ok 15 - a repeated identical anno_set_label_name SUCCEEDS reporting changed:false -- an annotation pass re-run is not an error
  ---
  duration_ms: 9.088421
  type: 'test'
  ...
# Subtest: an illegal label name is REJECTED by name with the offending name in the message, and nothing is written or sanitized (T-29-23)
ok 16 - an illegal label name is REJECTED by name with the offending name in the message, and nothing is written or sanitized (T-29-23)
  ---
  duration_ms: 3.094893
  type: 'test'
  ...
# Subtest: comment length is bounded in BYTES by the store's own assertion -- this layer adds no second check and no truncation
ok 17 - comment length is bounded in BYTES by the store's own assertion -- this layer adds no second check and no truncation
  ---
  duration_ms: 6.992868
  type: 'test'
  ...
# Subtest: F-4: anno_set_data_type's SUCCESSFUL body carries BOTH contradictedComments and reinterpretedSplitTables
ok 18 - F-4: anno_set_data_type's SUCCESSFUL body carries BOTH contradictedComments and reinterpretedSplitTables
  ---
  duration_ms: 16.644851
  type: 'test'
  ...
# Subtest: F-5: a transposed scope span is refused by the store's overlap rule, and anno_remove_scope makes it recoverable without a revert
ok 19 - F-5: a transposed scope span is refused by the store's overlap rule, and anno_remove_scope makes it recoverable without a revert
  ---
  duration_ms: 16.893642
  type: 'test'
  ...
# Subtest: anno_apply_enum_usage with an omitted or empty name CLEARS the association, matching the schema's own contract
ok 20 - anno_apply_enum_usage with an omitted or empty name CLEARS the association, matching the schema's own contract
  ---
  duration_ms: 19.465106
  type: 'test'
  ...
# Subtest: anno_save_project reports the revision and PERFORMS NO WRITE -- the revision and the store file's mtime are identical before and after
ok 21 - anno_save_project reports the revision and PERFORMS NO WRITE -- the revision and the store file's mtime are identical before and after
  ---
  duration_ms: 6.610045
  type: 'test'
  ...
# Subtest: WR-10: anno_save_project's revision FIELD and the revision named in its own prose are the same value
ok 22 - WR-10: anno_save_project's revision FIELD and the revision named in its own prose are the same value
  ---
  duration_ms: 11.279759
  type: 'test'
  ...
# Subtest: WR-10: dispatchSaveProject() reads the store revision EXACTLY ONCE
ok 23 - WR-10: dispatchSaveProject() reads the store revision EXACTLY ONCE
  ---
  duration_ms: 0.362971
  type: 'test'
  ...
# Subtest: every verb closes the store: no handle is left open and no journal sidecar survives a repeated call
ok 24 - every verb closes the store: no handle is left open and no journal sidecar survives a repeated call
  ---
  duration_ms: 15.888043
  type: 'test'
  ...
# Subtest: anno-tools.ts re-implements no address parsing, no range validation and no data-type membership -- every such check calls an anno-types.ts export
ok 25 - anno-tools.ts re-implements no address parsing, no range validation and no data-type membership -- every such check calls an anno-types.ts export
  ---
  duration_ms: 0.809448
  type: 'test'
  ...
# Subtest: the six derived and composed verbs are advertised, and every one requires an explicit image (D-07)
ok 26 - the six derived and composed verbs are advertised, and every one requires an explicit image (D-07)
  ---
  duration_ms: 0.230323
  type: 'test'
  ...
# Subtest: anno_disassemble decodes at an EXPLICIT address, and the surface names no cursor anywhere (D-09)
ok 27 - anno_disassemble decodes at an EXPLICIT address, and the surface names no cursor anywhere (D-09)
  ---
  duration_ms: 4.482296
  type: 'test'
  ...
# Subtest: D-09: no identifier, schema property or dispatch branch on this surface names a cursor or a current address
ok 28 - D-09: no identifier, schema property or dispatch branch on this surface names a cursor or a current address
  ---
  duration_ms: 0.432757
  type: 'test'
  ...
# Subtest: ONE cap governs BOTH views, is read at call time, and refuses by name with the cap and the requested width
ok 29 - ONE cap governs BOTH views, is read at call time, and refuses by name with the cap and the requested width
  ---
  duration_ms: 2.6522
  type: 'test'
  ...
# Subtest: anno_read_region serves both views, and a span outside the image is reported unanswerable rather than served short
ok 30 - anno_read_region serves both views, and a span outside the image is reported unanswerable rather than served short
  ---
  duration_ms: 3.999242
  type: 'test'
  ...
# Subtest: CR-01 / MCP-04: both read verbs return the SAME {available:false} verdict for an out-of-image address
ok 31 - CR-01 / MCP-04: both read verbs return the SAME {available:false} verdict for an out-of-image address
  ---
  duration_ms: 3.451369
  type: 'test'
  ...
# Subtest: CR-01: the incoherent range is STRUCTURALLY absent -- an out-of-image disassemble carries no end_address and no instructions
ok 32 - CR-01: the incoherent range is STRUCTURALLY absent -- an out-of-image disassemble carries no end_address and no instructions
  ---
  duration_ms: 2.771019
  type: 'test'
  ...
# Subtest: CR-01: an inverted span is refused IDENTICALLY by both verbs, and the one no validator can catch is caught by sliceSpan()
ok 33 - CR-01: an inverted span is refused IDENTICALLY by both verbs, and the one no validator can catch is caught by sliceSpan()
  ---
  duration_ms: 3.126757
  type: 'test'
  ...
# Subtest: CR-01: sliceSpan()'s guard names all THREE cases, so the inverted-span condition cannot be dropped as redundant
ok 34 - CR-01: sliceSpan()'s guard names all THREE cases, so the inverted-span condition cannot be dropped as redundant
  ---
  duration_ms: 0.415729
  type: 'test'
  ...
# Subtest: CR-01 over-refusal control: a span WHOLLY INSIDE the image still succeeds on both verbs, with a non-zero instruction count
ok 35 - CR-01 over-refusal control: a span WHOLLY INSIDE the image still succeeds on both verbs, with a non-zero instruction count
  ---
  duration_ms: 4.081754
  type: 'test'
  ...
# Subtest: CR-01: an OMITTED end_address still defaults to the image's own bound -- removing the clamp must not remove the ergonomics
ok 36 - CR-01: an OMITTED end_address still defaults to the image's own bound -- removing the clamp must not remove the ergonomics
  ---
  duration_ms: 2.724455
  type: 'test'
  ...
# Subtest: anno_get_binary_info reports the load address, origin and lengths for a real PRG, and refuses a non-PRG by name
ok 37 - anno_get_binary_info reports the load address, origin and lengths for a real PRG, and refuses a non-PRG by name
  ---
  duration_ms: 11.792973
  type: 'test'
  ...
# Subtest: anno_get_cross_references returns the derivation module's union, and the store is byte-identical afterwards
ok 38 - anno_get_cross_references returns the derivation module's union, and the store is byte-identical afterwards
  ---
  duration_ms: 8.327482
  type: 'test'
  ...
# Subtest: anno_search: max_results is REQUIRED with no default, and a capped answer reports the true total
ok 39 - anno_search: max_results is REQUIRED with no default, and a capped answer reports the true total
  ---
  duration_ms: 10.137532
  type: 'test'
  ...
# Subtest: anno_search naming a corpus this surface does not have answers {available:false, reason} in a SUCCESSFUL body, never an empty result set
ok 40 - anno_search naming a corpus this surface does not have answers {available:false, reason} in a SUCCESSFUL body, never an empty result set
  ---
  duration_ms: 4.83641
  type: 'test'
  ...
# Subtest: anno_get_address_details returns the composition with its composed_from disclosure intact
ok 41 - anno_get_address_details returns the composition with its composed_from disclosure intact
  ---
  duration_ms: 8.353966
  type: 'test'
  ...
# Subtest: an image outside the workspace root, or absent, is refused by name -- the same containment the store path gets
ok 42 - an image outside the workspace root, or absent, is refused by name -- the same containment the store path gets
  ---
  duration_ms: 3.295245
  type: 'test'
  ...
# Subtest: anno_batch_execute is advertised as the ONE sanctioned nested-argument verb, and the header says no second may join it
ok 43 - anno_batch_execute is advertised as the ONE sanctioned nested-argument verb, and the header says no second may join it
  ---
  duration_ms: 0.235725
  type: 'test'
  ...
# Subtest: the six whole-batch refusal shapes, each naming what it refused on
ok 44 - the six whole-batch refusal shapes, each naming what it refused on
  ---
  duration_ms: 1.209083
  type: 'test'
  ...
# Subtest: the batch validator recurses: an uncurated name one level down still refuses the WHOLE batch
ok 45 - the batch validator recurses: an uncurated name one level down still refuses the WHOLE batch
  ---
  duration_ms: 0.256107
  type: 'test'
  ...
# Subtest: nesting deeper than the declared cap is refused BY NAME rather than walked (T-29-24)
ok 46 - nesting deeper than the declared cap is refused BY NAME rather than walked (T-29-24)
  ---
  duration_ms: 0.48894
  type: 'test'
  ...
# Subtest: NOTHING executes when pre-validation refuses: the revision is unchanged and no partial write is visible
ok 47 - NOTHING executes when pre-validation refuses: the revision is unchanged and no partial write is visible
  ---
  duration_ms: 6.569019
  type: 'test'
  ...
# Subtest: execution runs to COMPLETION: a three-call batch whose middle call fails returns three per-item entries, in order
ok 48 - execution runs to COMPLETION: a three-call batch whose middle call fails returns three per-item entries, in order
  ---
  duration_ms: 12.982608
  type: 'test'
  ...
# Subtest: a batch names its store ONCE and every inner call inherits it -- an inner store is overridden, never honoured
ok 49 - a batch names its store ONCE and every inner call inherits it -- an inner store is overridden, never honoured
  ---
  duration_ms: 6.59839
  type: 'test'
  ...
# Subtest: CR-06 / MCP-04 positive control: a depth-1 nested batch relying on the DOCUMENTED store inheritance validates AND executes
ok 50 - CR-06 / MCP-04 positive control: a depth-1 nested batch relying on the DOCUMENTED store inheritance validates AND executes
  ---
  duration_ms: 6.494559
  type: 'test'
  ...
# Subtest: CR-06 negative control: a chain past the cap is still refused BY NAME, and nothing executes
ok 51 - CR-06 negative control: a chain past the cap is still refused BY NAME, and nothing executes
  ---
  duration_ms: 3.226452
  type: 'test'
  ...
# Subtest: CR-06: an inner store is overridden by the batch's own in BOTH phases, at depth
ok 52 - CR-06: an inner store is overridden by the batch's own in BOTH phases, at depth
  ---
  duration_ms: 6.805475
  type: 'test'
  ...
# Subtest: CR-06: the recursive allow-list still bites -- an uncurated name TWO levels down refuses the WHOLE batch by index
ok 53 - CR-06: the recursive allow-list still bites -- an uncurated name TWO levels down refuses the WHOLE batch by index
  ---
  duration_ms: 3.555469
  type: 'test'
  ...
# Subtest: a batch of derived reads inherits the image too, and the whole batch shares ONE open/close pair
ok 54 - a batch of derived reads inherits the image too, and the whole batch shares ONE open/close pair
  ---
  duration_ms: 6.607194
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
# duration_ms 615.595287
```

### Planted run

- **Plant:** `src/mcp/vice/anno-tools.ts`: `name: "anno_get_symbols",` → `name: "anno_get_symbolz",`
- **Planted command:** `node --test anno-tools.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# (node:62640) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: tracer (MCP-05): anno_get_symbols answers a real query against a real store, end to end
not ok 1 - tracer (MCP-05): anno_get_symbols answers a real query against a real store, end to end
  ---
  duration_ms: 14.587118
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:75:1'
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
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:82:14
    async withStore (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:63:5)
    async TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:76:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
  ...
# Subtest: anno_get_symbols narrows by address range, and reports truncation as a fact rather than leaving it to be inferred
not ok 2 - anno_get_symbols narrows by address range, and reports truncation as a fact rather than leaving it to be inferred
  ---
  duration_ms: 10.135624
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:100:1'
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
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:114:14
    async withStore (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:63:5)
    async TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:101:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: WR-02 closed: an uncurated name RESOLVES {isError:true} naming both resolution routes -- it does not reject the promise
ok 3 - WR-02 closed: an uncurated name RESOLVES {isError:true} naming both resolution routes -- it does not reject the promise
  ---
  duration_ms: 0.596059
  type: 'test'
  ...
# Subtest: a store path outside the workspace root RESOLVES {isError:true} naming AnnoStorePathError (T-29-01)
not ok 4 - a store path outside the workspace root RESOLVES {isError:true} naming AnnoStorePathError (T-29-01)
  ---
  duration_ms: 2.593058
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:144:1'
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
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:151:14
    async withStore (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:63:5)
    async TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:145:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: an absent store is refused, never created -- mustExist is what keeps 'gone' and 'empty' distinguishable
ok 5 - an absent store is refused, never created -- mustExist is what keeps 'gone' and 'empty' distinguishable
  ---
  duration_ms: 2.414387
  type: 'test'
  ...
# Subtest: the transport validates nothing, so a missing required argument is refused HERE and named
not ok 6 - the transport validates nothing, so a missing required argument is refused HERE and named
  ---
  duration_ms: 0.686176
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:169:1'
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
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:172:10)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: an unprefixed numeric address string is refused by the ONE address parser, not accepted by a second rule here
not ok 7 - an unprefixed numeric address string is refused by the ONE address parser, not accepted by a second rule here
  ---
  duration_ms: 2.544453
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:185:1'
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
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:191:14
    async withStore (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:63:5)
    async TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:186:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: assertAnnoTool's FIRST check is set membership: an uncurated name is refused before any argument is looked at
not ok 8 - assertAnnoTool's FIRST check is set membership: an uncurated name is refused before any argument is looked at
  ---
  duration_ms: 1.01489
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:200:1'
  failureType: 'testCodeFailure'
  error: |-
    The error is expected to be an instance of "AnnoToolArgumentError". Received "AnnoUncuratedToolError"
    
    Error message:
    
    "anno_get_symbols" is not part of the curated anno_* tool surface. Resolution routes: implement it and add it to ANNO_TOOL_DEFINITIONS with a named criterion, or remove the caller reference.
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:204:10)
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
  duration_ms: 1.999953
  type: 'test'
  ...
# Subtest: anno-tools.ts holds no module-level mutable store handle (D-06)
ok 10 - anno-tools.ts holds no module-level mutable store handle (D-06)
  ---
  duration_ms: 3.352794
  type: 'test'
  ...
# Subtest: every openStore( in anno-tools.ts is closed by a closeStore( inside a finally (T-29-03)
ok 11 - every openStore( in anno-tools.ts is closed by a closeStore( inside a finally (T-29-03)
  ---
  duration_ms: 0.934243
  type: 'test'
  ...
# Subtest: MCP-02 by construction: anno-tools.ts reaches no VICE transport and no host-path seam
ok 12 - MCP-02 by construction: anno-tools.ts reaches no VICE transport and no host-path seam
  ---
  duration_ms: 1.265063
  type: 'test'
  ...
# Subtest: anno-tools.ts never throws a bare Error -- every refusal is an AnnoStoreError and therefore a ViceError
ok 13 - anno-tools.ts never throws a bare Error -- every refusal is an AnnoStoreError and therefore a ViceError
  ---
  duration_ms: 0.232082
  type: 'test'
  ...
# Subtest: the twelve write and stored-read verbs are advertised, each requiring an explicit store (D-06)
not ok 14 - the twelve write and stored-read verbs are advertised, each requiring an explicit store (D-06)
  ---
  duration_ms: 0.423344
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:344:1'
  failureType: 'testCodeFailure'
  error: 'anno_get_symbols must be in ANNO_TOOL_DEFINITIONS'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:361:12)
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
  duration_ms: 9.952781
  type: 'test'
  ...
# Subtest: an illegal label name is REJECTED by name with the offending name in the message, and nothing is written or sanitized (T-29-23)
ok 16 - an illegal label name is REJECTED by name with the offending name in the message, and nothing is written or sanitized (T-29-23)
  ---
  duration_ms: 3.32653
  type: 'test'
  ...
# Subtest: comment length is bounded in BYTES by the store's own assertion -- this layer adds no second check and no truncation
ok 17 - comment length is bounded in BYTES by the store's own assertion -- this layer adds no second check and no truncation
  ---
  duration_ms: 7.457819
  type: 'test'
  ...
# Subtest: F-4: anno_set_data_type's SUCCESSFUL body carries BOTH contradictedComments and reinterpretedSplitTables
ok 18 - F-4: anno_set_data_type's SUCCESSFUL body carries BOTH contradictedComments and reinterpretedSplitTables
  ---
  duration_ms: 17.239128
  type: 'test'
  ...
# Subtest: F-5: a transposed scope span is refused by the store's overlap rule, and anno_remove_scope makes it recoverable without a revert
ok 19 - F-5: a transposed scope span is refused by the store's overlap rule, and anno_remove_scope makes it recoverable without a revert
  ---
  duration_ms: 18.422501
  type: 'test'
  ...
# Subtest: anno_apply_enum_usage with an omitted or empty name CLEARS the association, matching the schema's own contract
ok 20 - anno_apply_enum_usage with an omitted or empty name CLEARS the association, matching the schema's own contract
  ---
  duration_ms: 18.616676
  type: 'test'
  ...
# Subtest: anno_save_project reports the revision and PERFORMS NO WRITE -- the revision and the store file's mtime are identical before and after
ok 21 - anno_save_project reports the revision and PERFORMS NO WRITE -- the revision and the store file's mtime are identical before and after
  ---
  duration_ms: 6.68704
  type: 'test'
  ...
# Subtest: WR-10: anno_save_project's revision FIELD and the revision named in its own prose are the same value
ok 22 - WR-10: anno_save_project's revision FIELD and the revision named in its own prose are the same value
  ---
  duration_ms: 11.312255
  type: 'test'
  ...
# Subtest: WR-10: dispatchSaveProject() reads the store revision EXACTLY ONCE
ok 23 - WR-10: dispatchSaveProject() reads the store revision EXACTLY ONCE
  ---
  duration_ms: 0.268224
  type: 'test'
  ...
# Subtest: every verb closes the store: no handle is left open and no journal sidecar survives a repeated call
ok 24 - every verb closes the store: no handle is left open and no journal sidecar survives a repeated call
  ---
  duration_ms: 17.049057
  type: 'test'
  ...
# Subtest: anno-tools.ts re-implements no address parsing, no range validation and no data-type membership -- every such check calls an anno-types.ts export
ok 25 - anno-tools.ts re-implements no address parsing, no range validation and no data-type membership -- every such check calls an anno-types.ts export
  ---
  duration_ms: 0.894591
  type: 'test'
  ...
# Subtest: the six derived and composed verbs are advertised, and every one requires an explicit image (D-07)
ok 26 - the six derived and composed verbs are advertised, and every one requires an explicit image (D-07)
  ---
  duration_ms: 0.283655
  type: 'test'
  ...
# Subtest: anno_disassemble decodes at an EXPLICIT address, and the surface names no cursor anywhere (D-09)
ok 27 - anno_disassemble decodes at an EXPLICIT address, and the surface names no cursor anywhere (D-09)
  ---
  duration_ms: 4.805262
  type: 'test'
  ...
# Subtest: D-09: no identifier, schema property or dispatch branch on this surface names a cursor or a current address
ok 28 - D-09: no identifier, schema property or dispatch branch on this surface names a cursor or a current address
  ---
  duration_ms: 0.403904
  type: 'test'
  ...
# Subtest: ONE cap governs BOTH views, is read at call time, and refuses by name with the cap and the requested width
ok 29 - ONE cap governs BOTH views, is read at call time, and refuses by name with the cap and the requested width
  ---
  duration_ms: 2.774784
  type: 'test'
  ...
# Subtest: anno_read_region serves both views, and a span outside the image is reported unanswerable rather than served short
ok 30 - anno_read_region serves both views, and a span outside the image is reported unanswerable rather than served short
  ---
  duration_ms: 4.717561
  type: 'test'
  ...
# Subtest: CR-01 / MCP-04: both read verbs return the SAME {available:false} verdict for an out-of-image address
ok 31 - CR-01 / MCP-04: both read verbs return the SAME {available:false} verdict for an out-of-image address
  ---
  duration_ms: 3.741254
  type: 'test'
  ...
# Subtest: CR-01: the incoherent range is STRUCTURALLY absent -- an out-of-image disassemble carries no end_address and no instructions
ok 32 - CR-01: the incoherent range is STRUCTURALLY absent -- an out-of-image disassemble carries no end_address and no instructions
  ---
  duration_ms: 2.984523
  type: 'test'
  ...
# Subtest: CR-01: an inverted span is refused IDENTICALLY by both verbs, and the one no validator can catch is caught by sliceSpan()
ok 33 - CR-01: an inverted span is refused IDENTICALLY by both verbs, and the one no validator can catch is caught by sliceSpan()
  ---
  duration_ms: 3.583332
  type: 'test'
  ...
# Subtest: CR-01: sliceSpan()'s guard names all THREE cases, so the inverted-span condition cannot be dropped as redundant
ok 34 - CR-01: sliceSpan()'s guard names all THREE cases, so the inverted-span condition cannot be dropped as redundant
  ---
  duration_ms: 0.521375
  type: 'test'
  ...
# Subtest: CR-01 over-refusal control: a span WHOLLY INSIDE the image still succeeds on both verbs, with a non-zero instruction count
ok 35 - CR-01 over-refusal control: a span WHOLLY INSIDE the image still succeeds on both verbs, with a non-zero instruction count
  ---
  duration_ms: 4.839279
  type: 'test'
  ...
# Subtest: CR-01: an OMITTED end_address still defaults to the image's own bound -- removing the clamp must not remove the ergonomics
ok 36 - CR-01: an OMITTED end_address still defaults to the image's own bound -- removing the clamp must not remove the ergonomics
  ---
  duration_ms: 2.883975
  type: 'test'
  ...
# Subtest: anno_get_binary_info reports the load address, origin and lengths for a real PRG, and refuses a non-PRG by name
ok 37 - anno_get_binary_info reports the load address, origin and lengths for a real PRG, and refuses a non-PRG by name
  ---
  duration_ms: 12.749868
  type: 'test'
  ...
# Subtest: anno_get_cross_references returns the derivation module's union, and the store is byte-identical afterwards
ok 38 - anno_get_cross_references returns the derivation module's union, and the store is byte-identical afterwards
  ---
  duration_ms: 8.601621
  type: 'test'
  ...
# Subtest: anno_search: max_results is REQUIRED with no default, and a capped answer reports the true total
ok 39 - anno_search: max_results is REQUIRED with no default, and a capped answer reports the true total
  ---
  duration_ms: 10.85687
  type: 'test'
  ...
# Subtest: anno_search naming a corpus this surface does not have answers {available:false, reason} in a SUCCESSFUL body, never an empty result set
ok 40 - anno_search naming a corpus this surface does not have answers {available:false, reason} in a SUCCESSFUL body, never an empty result set
  ---
  duration_ms: 5.176995
  type: 'test'
  ...
# Subtest: anno_get_address_details returns the composition with its composed_from disclosure intact
ok 41 - anno_get_address_details returns the composition with its composed_from disclosure intact
  ---
  duration_ms: 8.281913
  type: 'test'
  ...
# Subtest: an image outside the workspace root, or absent, is refused by name -- the same containment the store path gets
ok 42 - an image outside the workspace root, or absent, is refused by name -- the same containment the store path gets
  ---
  duration_ms: 3.321132
  type: 'test'
  ...
# Subtest: anno_batch_execute is advertised as the ONE sanctioned nested-argument verb, and the header says no second may join it
ok 43 - anno_batch_execute is advertised as the ONE sanctioned nested-argument verb, and the header says no second may join it
  ---
  duration_ms: 0.226644
  type: 'test'
  ...
# Subtest: the six whole-batch refusal shapes, each naming what it refused on
ok 44 - the six whole-batch refusal shapes, each naming what it refused on
  ---
  duration_ms: 1.113941
  type: 'test'
  ...
# Subtest: the batch validator recurses: an uncurated name one level down still refuses the WHOLE batch
ok 45 - the batch validator recurses: an uncurated name one level down still refuses the WHOLE batch
  ---
  duration_ms: 0.22155
  type: 'test'
  ...
# Subtest: nesting deeper than the declared cap is refused BY NAME rather than walked (T-29-24)
ok 46 - nesting deeper than the declared cap is refused BY NAME rather than walked (T-29-24)
  ---
  duration_ms: 0.561361
  type: 'test'
  ...
# Subtest: NOTHING executes when pre-validation refuses: the revision is unchanged and no partial write is visible
not ok 47 - NOTHING executes when pre-validation refuses: the revision is unchanged and no partial write is visible
  ---
  duration_ms: 5.239304
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:1241:1'
  failureType: 'testCodeFailure'
  error: `Unexpected token 'a', "anno_get_s"... is not valid JSON`
  code: 'ERR_TEST_FAILURE'
  name: 'SyntaxError'
  stack: |-
    JSON.parse (<anonymous>)
    body (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:341:15)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:1265:34
    async withStore (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:63:5)
    async TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:1242:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: execution runs to COMPLETION: a three-call batch whose middle call fails returns three per-item entries, in order
not ok 48 - execution runs to COMPLETION: a three-call batch whose middle call fails returns three per-item entries, in order
  ---
  duration_ms: 11.825601
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:1271:1'
  failureType: 'testCodeFailure'
  error: `Unexpected token 'a', "anno_get_s"... is not valid JSON`
  code: 'ERR_TEST_FAILURE'
  name: 'SyntaxError'
  stack: |-
    JSON.parse (<anonymous>)
    body (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:341:15)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:1308:29
    async withStore (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:63:5)
    async TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:1272:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: a batch names its store ONCE and every inner call inherits it -- an inner store is overridden, never honoured
not ok 49 - a batch names its store ONCE and every inner call inherits it -- an inner store is overridden, never honoured
  ---
  duration_ms: 4.585052
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:1314:1'
  failureType: 'testCodeFailure'
  error: `Unexpected token 'a', "anno_get_s"... is not valid JSON`
  code: 'ERR_TEST_FAILURE'
  name: 'SyntaxError'
  stack: |-
    JSON.parse (<anonymous>)
    body (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:341:15)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:1328:29
    async withStore (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:63:5)
    async TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:1315:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: CR-06 / MCP-04 positive control: a depth-1 nested batch relying on the DOCUMENTED store inheritance validates AND executes
not ok 50 - CR-06 / MCP-04 positive control: a depth-1 nested batch relying on the DOCUMENTED store inheritance validates AND executes
  ---
  duration_ms: 4.642842
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:1352:1'
  failureType: 'testCodeFailure'
  error: `Unexpected token 'a', "anno_get_s"... is not valid JSON`
  code: 'ERR_TEST_FAILURE'
  name: 'SyntaxError'
  stack: |-
    JSON.parse (<anonymous>)
    body (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:341:15)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:1375:29
    async withStore (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:63:5)
    async TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:1353:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: CR-06 negative control: a chain past the cap is still refused BY NAME, and nothing executes
not ok 51 - CR-06 negative control: a chain past the cap is still refused BY NAME, and nothing executes
  ---
  duration_ms: 2.138492
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:1381:1'
  failureType: 'testCodeFailure'
  error: `Unexpected token 'a', "anno_get_s"... is not valid JSON`
  code: 'ERR_TEST_FAILURE'
  name: 'SyntaxError'
  stack: |-
    JSON.parse (<anonymous>)
    body (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:341:15)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:1403:29
    async withStore (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:63:5)
    async TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:1382:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: CR-06: an inner store is overridden by the batch's own in BOTH phases, at depth
not ok 52 - CR-06: an inner store is overridden by the batch's own in BOTH phases, at depth
  ---
  duration_ms: 4.560455
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:1409:1'
  failureType: 'testCodeFailure'
  error: `Unexpected token 'a', "anno_get_s"... is not valid JSON`
  code: 'ERR_TEST_FAILURE'
  name: 'SyntaxError'
  stack: |-
    JSON.parse (<anonymous>)
    body (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:341:15)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:1436:29
    async withStore (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:63:5)
    async TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:1410:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: CR-06: the recursive allow-list still bites -- an uncurated name TWO levels down refuses the WHOLE batch by index
not ok 53 - CR-06: the recursive allow-list still bites -- an uncurated name TWO levels down refuses the WHOLE batch by index
  ---
  duration_ms: 1.845187
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:1443:1'
  failureType: 'testCodeFailure'
  error: `Unexpected token 'a', "anno_get_s"... is not valid JSON`
  code: 'ERR_TEST_FAILURE'
  name: 'SyntaxError'
  stack: |-
    JSON.parse (<anonymous>)
    body (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:341:15)
    file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:1466:29
    async withStore (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:63:5)
    async TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-tools.test.ts:1444:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: a batch of derived reads inherits the image too, and the whole batch shares ONE open/close pair
ok 54 - a batch of derived reads inherits the image too, and the whole batch shares ONE open/close pair
  ---
  duration_ms: 5.215499
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
# duration_ms 602.917122
```

## `scripts/audit-gate.mjs` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node scripts/audit-gate.mjs`
- **cwd:** `.`
- **Exit status:** `0` (must be 0)

Raw output:

```
audit-gate: OK -- 9 docs guards green, 7 milestone audits scanned, 5 declaring a gated status
```

### Planted run

- **Plant:** `scripts/audit-gate.mjs`: `export const DOCS_GUARD_FLOOR = 7;` → `export const DOCS_GUARD_FLOOR = 10;`
- **Planted command:** `node scripts/audit-gate.mjs`
- **cwd:** `.`
- **Exit status:** `1` (must be non-zero)

Raw output:

```

audit-gate: FAIL
  - only 9 docs-*.test.ts guard(s) found in /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice (>= 10 required) -- an empty or broken glob must fail loudly here rather than let this gate report green forever
```

## `scripts/check-npm-packages.mjs` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node scripts/check-npm-packages.mjs`
- **cwd:** `.`
- **Exit status:** `0` (must be 0)

Raw output:

```
check-npm-packages: transitive closure from vice-proxy.ts -- 57 modules, clean
check-npm-packages: OK
  @henols/vice-mcp@0.0.0-dev -- 79 files
  @henols/c64-re-tools@0.0.0-dev -- 34 files, 7 skills


> @henols/c64-re-tools@0.0.0-dev prepack
> node scripts/sync-skills.mjs

sync-skills: copied 7 skill(s) into /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/installer/skills: acme-build, c64-memory-mapping, c64-program-recon, c64-provenance-diff, c64-ram-capture, routine-queue-walker, vice-wedge-triage
sync-skills: excluded 6 non-shipping entries (test files, fixtures/, test-corpus.mjs)
```

### Planted run

- **Plant:** `src/mcp/vice/package.json`: `    "anno-cli.ts",` → `    "anno-cliX.ts",`
- **Planted command:** `node scripts/check-npm-packages.mjs`
- **cwd:** `.`
- **Exit status:** `1` (must be non-zero)

Raw output:

```


> @henols/c64-re-tools@0.0.0-dev prepack
> node scripts/sync-skills.mjs

sync-skills: copied 7 skill(s) into /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/installer/skills: acme-build, c64-memory-mapping, c64-program-recon, c64-provenance-diff, c64-ram-capture, routine-queue-walker, vice-wedge-triage
sync-skills: excluded 6 non-shipping entries (test files, fixtures/, test-corpus.mjs)
check-npm-packages: FAIL
  - vice-mcp: missing anno-cli.ts -- R2000-09 would ship a package that throws ERR_MODULE_NOT_FOUND
  - vice-mcp: anno-cli.ts is imported by vice-proxy.ts but is not in the published tarball -- Rule 2 (see 6801cf5, 897faf6)
```

## `scripts/check-skill-fork-honesty.mjs` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node scripts/check-skill-fork-honesty.mjs`
- **cwd:** `.`
- **Exit status:** `0` (must be 0)

Raw output:

```
check-skill-fork-honesty: OK -- 11 fork-only mentions across 33 files in 7 skill directories, all section-scoped-compliant; 24 fork-only names policed from CAPABILITY_REGISTRY; no stale phase-deferral prose found; README.md carries all 6 required strings and none of the 2 forbidden ones; docs/stock-vice-parity.md carries all 1 required strings and none of the 5 forbidden ones (08-06's regression guard).
```

### Planted run

- **Plant:** `scripts/check-skill-fork-honesty.mjs`: `acmeBuildSkillSource.includes("anno export-asm")` → `acmeBuildSkillSource.includes("anno export-asmZZ")`
- **Planted command:** `node scripts/check-skill-fork-honesty.mjs`
- **cwd:** `.`
- **Exit status:** `1` (must be non-zero)

Raw output:

```

check-skill-fork-honesty: FAIL
  - src/skills/acme-build/SKILL.md is missing the replacement pointer string "anno export-asm" -- the deletion must not be "fixed" by deleting the pointer to the route too. While the route was withdrawn that pointer was the dated withdrawal notice naming it; since the route returned on 2026-08-31 the same string is the live invocation, which is why this assertion never had to move.
```

## `scripts/check-skill-tool-coverage.mjs` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node scripts/check-skill-tool-coverage.mjs`
- **cwd:** `.`
- **Exit status:** `0` (must be 0)

Raw output:

```
check-skill-tool-coverage: OK -- 37 distinct vice_* names extracted from 33 files across 7 skill directories; 31 resolved as advertised on the stock manifest (38 tools total). Classified: 0 proxy-local (neither manifest), 2 proxy-local-with-stock-manifest-entry, 1 deny-listed, 2 not-a-tool-name, 6 fork-only-unrecoverable, 0 pending-later-phase. anno_*: 18 distinct names extracted, all curated (CURATED_ANNO_TOOLS has 19 entries). anno CLI verbs: 3 parsed from anno-cli.ts, 3/3 resolved (named by at least one skill file).

(node:62954) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
```

### Planted run

- **Plant:** `src/skills/routine-queue-walker/SKILL.md`: `anno_set_comment` → `anno_set_commentary`
- **Planted command:** `node scripts/check-skill-tool-coverage.mjs`
- **cwd:** `.`
- **Exit status:** `1` (must be non-zero)

Raw output:

```

check-skill-tool-coverage: FAIL
  - anno_set_commentary: referenced by src/skills/routine-queue-walker/SKILL.md but NOT in CURATED_ANNO_TOOLS (anno-tools.ts). Resolve by: (1) implementing it and adding it to ANNO_TOOL_DEFINITIONS with a named criterion, (2) removing the skill reference, or (3) recording it as a scope decision.
```

## `scripts/generate-tool-support-table.mjs` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test --test-name-pattern byte-identical to committed tool-support-table.test.mjs`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# Subtest: generateToolSupportTable() output is byte-identical to committed docs/tool-support.md
ok 1 - generateToolSupportTable() output is byte-identical to committed docs/tool-support.md
  ---
  duration_ms: 4.627481
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
# duration_ms 140.905893
```

### Planted run

- **Plant:** `scripts/generate-tool-support-table.mjs`: `ANNO_LOOP_VAR_RE = /for\s*\(\s*const\s+(\w+)\s+of\s+ANNO_TOOL_DEFINITIONS\s*\)/` → `ANNO_LOOP_VAR_RE = /for\s*\(\s*const\s+(\w+)\s+of\s+ANNO_TOOL_DEFINITIONZ\s*\)/`
- **Planted command:** `node --test --test-name-pattern byte-identical to committed tool-support-table.test.mjs`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# Subtest: generateToolSupportTable() output is byte-identical to committed docs/tool-support.md
not ok 1 - generateToolSupportTable() output is byte-identical to committed docs/tool-support.md
  ---
  duration_ms: 4.318382
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/tool-support-table.test.mjs:148:1'
  failureType: 'testCodeFailure'
  error: 'generate-tool-support-table: could not resolve synthetic tool registration identifier "annoDef" (from `tools[annoDef.name] = ...`) to a declaration -- expected a `const annoDef: ToolDefinition = { ... }` declaration in vice-proxy.ts. Add the declaration, or if this is not a synthetic proxy-local tool registration, fix the discovery regex explicitly rather than silently dropping the identifier.'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    discoverSyntheticToolNames (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/scripts/generate-tool-support-table.mjs:190:13)
    generateToolSupportTable (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/scripts/generate-tool-support-table.mjs:246:26)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/tool-support-table.test.mjs:149:21)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 150.875684
```

## `scripts/lib/skill-corpus.d.mts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```

```

### Planted run

- **Plant:** `scripts/lib/skill-corpus.d.mts`: `export declare function walkSkills(dir: string): string[];` → `export declare function walkSkillsX(dir: string): string[];`
- **Planted command:** `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
skill-attribution.test.ts(95,10): error TS2724: '"../../../scripts/lib/skill-corpus.mjs"' has no exported member named 'walkSkills'. Did you mean 'walkSkillsX'?
skill-attribution.test.ts(850,51): error TS7006: Parameter 'f' implicitly has an 'any' type.
skill-attribution.test.ts(1035,44): error TS7006: Parameter 'f' implicitly has an 'any' type.
```

## `scripts/lib/skill-descriptions.d.mts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```

```

### Planted run

- **Plant:** `scripts/lib/skill-descriptions.d.mts`: `export declare function expectedPairCount(n: number): number;` → `export declare function expectedPairCountX(n: number): number;`
- **Planted command:** `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
skill-description-overlap.test.ts(41,3): error TS2724: '"../../../scripts/lib/skill-descriptions.mjs"' has no exported member named 'expectedPairCount'. Did you mean 'expectedPairCountX'?
```

## `scripts/lib/skill-descriptions.mjs` — verdict `kept-unchanged`

**SKIPPED.** verdict `kept-unchanged` owes no observed-red evidence (D-05); its evidence is the recorded removal trigger and classification, not a planted guard run. Not measured, and not silently omitted.

## `scripts/lib/skill-honesty-checks.mjs` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node scripts/check-skill-fork-honesty.mjs`
- **cwd:** `.`
- **Exit status:** `0` (must be 0)

Raw output:

```
check-skill-fork-honesty: OK -- 11 fork-only mentions across 33 files in 7 skill directories, all section-scoped-compliant; 24 fork-only names policed from CAPABILITY_REGISTRY; no stale phase-deferral prose found; README.md carries all 6 required strings and none of the 2 forbidden ones; docs/stock-vice-parity.md carries all 1 required strings and none of the 5 forbidden ones (08-06's regression guard).
```

### Planted run

- **Plant:** `scripts/lib/skill-honesty-checks.mjs`: `if (!content.includes(needle)) {` → `if (content.includes(needle)) {`
- **Planted command:** `node scripts/check-skill-fork-honesty.mjs`
- **cwd:** `.`
- **Exit status:** `1` (must be non-zero)

Raw output:

```

check-skill-fork-honesty: FAIL
  - src/skills/acme-build/scripts/acme.mjs: required claim "no libraries needed" is absent -- WR-11: acme.mjs's own --help claimed the `new` scaffold needs libraries, but plan 10-07 deliberately made the scaffold library-free (local !address/= constants, no !source <cbm/c64/...>) -- the first surface a reader sees about the scaffold must match what it is.
```

## `src/mcp/vice/audit-integrity.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test --test-name-pattern registry-drift detector audit-integrity.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# Subtest: the runtime registry (EXPECTED_DOCS_GUARD_NAMES) names every guard the disk-derived set carries -- registry-drift detector (CR-02, 17-REVIEW.md)
ok 1 - the runtime registry (EXPECTED_DOCS_GUARD_NAMES) names every guard the disk-derived set carries -- registry-drift detector (CR-02, 17-REVIEW.md)
  ---
  duration_ms: 640.846767
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
# duration_ms 793.698846
```

### Planted run

- **Plant:** `scripts/audit-gate.mjs`: `  "docs-absorbed-decisions.test.ts",` → `  "docs-absorbed-decisionz.test.ts",`
- **Planted command:** `node --test --test-name-pattern registry-drift detector audit-integrity.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# Subtest: the runtime registry (EXPECTED_DOCS_GUARD_NAMES) names every guard the disk-derived set carries -- registry-drift detector (CR-02, 17-REVIEW.md)
not ok 1 - the runtime registry (EXPECTED_DOCS_GUARD_NAMES) names every guard the disk-derived set carries -- registry-drift detector (CR-02, 17-REVIEW.md)
  ---
  duration_ms: 70.032145
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/audit-integrity.test.ts:260:1'
  failureType: 'testCodeFailure'
  error: |-
    scripts/audit-gate.mjs's own EXPECTED_DOCS_GUARD_NAMES registry has drifted from the disk-derived docs-*.test.ts set -- extend EXPECTED_DOCS_GUARD_NAMES (and DOCS_GUARD_FLOOR) in the same commit that adds or removes a docs-*.test.ts guard file (see that array's own comment); registry=["docs-linerefs.test.ts","docs-dangling-refs.test.ts","docs-deferred-ledger.test.ts","docs-review-disposition.test.ts","docs-fork-decision.test.ts","docs-core-value-decision.test.ts","docs-absorbed-decisionz.test.ts","docs-uat-abstention.test.ts","docs-worktree-isolation.test.ts"] disk=["docs-absorbed-decisions.test.ts","docs-core-value-decision.test.ts","docs-dangling-refs.test.ts","docs-deferred-ledger.test.ts","docs-fork-decision.test.ts","docs-linerefs.test.ts","docs-review-disposition.test.ts","docs-uat-abstention.test.ts","docs-worktree-isolation.test.ts"]
    + actual - expected
    
      [
    +   'docs-absorbed-decisionz.test.ts',
    -   'docs-absorbed-decisions.test.ts',
        'docs-core-value-decision.test.ts',
        'docs-dangling-refs.test.ts',
        'docs-deferred-ledger.test.ts',
        'docs-fork-decision.test.ts',
        'docs-linerefs.test.ts',
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
    0: 'docs-absorbed-decisions.test.ts'
    1: 'docs-core-value-decision.test.ts'
    2: 'docs-dangling-refs.test.ts'
    3: 'docs-deferred-ledger.test.ts'
    4: 'docs-fork-decision.test.ts'
    5: 'docs-linerefs.test.ts'
    6: 'docs-review-disposition.test.ts'
    7: 'docs-uat-abstention.test.ts'
    8: 'docs-worktree-isolation.test.ts'
  actual:
    0: 'docs-absorbed-decisionz.test.ts'
    1: 'docs-core-value-decision.test.ts'
    2: 'docs-dangling-refs.test.ts'
    3: 'docs-deferred-ledger.test.ts'
    4: 'docs-fork-decision.test.ts'
    5: 'docs-linerefs.test.ts'
    6: 'docs-review-disposition.test.ts'
    7: 'docs-uat-abstention.test.ts'
    8: 'docs-worktree-isolation.test.ts'
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/audit-integrity.test.ts:262:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 229.219358
```

## `src/mcp/vice/capability-registry.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test capability-registry.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# Subtest: fork-only hardware tool on stock names the tool, unrecoverable, the fork route, and the hardware reason
ok 1 - fork-only hardware tool on stock names the tool, unrecoverable, the fork route, and the hardware reason
  ---
  duration_ms: 1.251477
  type: 'test'
  ...
# Subtest: fork-only hardware tool on stock (vice_keyboard_matrix) names the tool, unrecoverable, the fork route, and the shared alternative (14-02/FORK-02: pinned true on the retain branch, no source edit)
ok 2 - fork-only hardware tool on stock (vice_keyboard_matrix) names the tool, unrecoverable, the fork route, and the shared alternative (14-02/FORK-02: pinned true on the retain branch, no source edit)
  ---
  duration_ms: 0.170814
  type: 'test'
  ...
# Subtest: fork-only hardware tool on stock (vice_keyboard_restore) names the tool, unrecoverable, the fork route, and the shared alternative (14-02/FORK-02: pinned true on the retain branch, no source edit)
ok 3 - fork-only hardware tool on stock (vice_keyboard_restore) names the tool, unrecoverable, the fork route, and the shared alternative (14-02/FORK-02: pinned true on the retain branch, no source edit)
  ---
  duration_ms: 0.18999
  type: 'test'
  ...
# Subtest: fork-only descoped tool on stock names the tool, not implemented, the fork route, and never says unrecoverable
ok 4 - fork-only descoped tool on stock names the tool, not implemented, the fork route, and never says unrecoverable
  ---
  duration_ms: 0.142135
  type: 'test'
  ...
# Subtest: stock-only tool on fork names the stock route
ok 5 - stock-only tool on fork names the stock route
  ---
  duration_ms: 0.183175
  type: 'test'
  ...
# Subtest: regression guard: a genuinely unknown tool name yields no refusal at all
ok 6 - regression guard: a genuinely unknown tool name yields no refusal at all
  ---
  duration_ms: 0.130244
  type: 'test'
  ...
# Subtest: synthetic-tool guard: vice_diagnose and vice_recycle are absent from the registry and produce no refusal on either backend
ok 7 - synthetic-tool guard: vice_diagnose and vice_recycle are absent from the registry and produce no refusal on either backend
  ---
  duration_ms: 0.284963
  type: 'test'
  ...
# Subtest: DENY_LIST boundary: no DENY_LIST entry is duplicated into the capability registry
ok 8 - DENY_LIST boundary: no DENY_LIST entry is duplicated into the capability registry
  ---
  duration_ms: 0.142996
  type: 'test'
  ...
# Subtest: same-backend miss: every entry's own providedBy backend yields no refusal for that entry
ok 9 - same-backend miss: every entry's own providedBy backend yields no refusal for that entry
  ---
  duration_ms: 0.37241
  type: 'test'
  ...
# Subtest: mechanical completeness: the registry's name set equals the manifest-derived divergence set
ok 10 - mechanical completeness: the registry's name set equals the manifest-derived divergence set
  ---
  duration_ms: 4.684528
  type: 'test'
  ...
# Subtest: vice_sid_get_state's reason and vice_sid_set_state's reason are not equal (Pitfall 3: read vs write are different losses)
ok 11 - vice_sid_get_state's reason and vice_sid_set_state's reason are not equal (Pitfall 3: read vs write are different losses)
  ---
  duration_ms: 0.255932
  type: 'test'
  ...
# Subtest: every entry carrying an `alternative` renders it in capabilityRefusalMessage (CR-01 regression)
ok 12 - every entry carrying an `alternative` renders it in capabilityRefusalMessage (CR-01 regression)
  ---
  duration_ms: 0.188133
  type: 'test'
  ...
# Subtest: a hardware entry WITHOUT an alternative does not gain stray text (CR-01 fix is conditional)
ok 13 - a hardware entry WITHOUT an alternative does not gain stray text (CR-01 fix is conditional)
  ---
  duration_ms: 0.122272
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
# duration_ms 151.749218
```

### Planted run

- **Plant:** `src/mcp/vice/vice-proxy.ts`: `for (const annoDef of ANNO_TOOL_DEFINITIONS)` → `for (const annoDefX of ANNO_TOOL_DEFINITIONS)`
- **Planted command:** `node --test capability-registry.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# Subtest: fork-only hardware tool on stock names the tool, unrecoverable, the fork route, and the hardware reason
ok 1 - fork-only hardware tool on stock names the tool, unrecoverable, the fork route, and the hardware reason
  ---
  duration_ms: 1.990015
  type: 'test'
  ...
# Subtest: fork-only hardware tool on stock (vice_keyboard_matrix) names the tool, unrecoverable, the fork route, and the shared alternative (14-02/FORK-02: pinned true on the retain branch, no source edit)
ok 2 - fork-only hardware tool on stock (vice_keyboard_matrix) names the tool, unrecoverable, the fork route, and the shared alternative (14-02/FORK-02: pinned true on the retain branch, no source edit)
  ---
  duration_ms: 0.176303
  type: 'test'
  ...
# Subtest: fork-only hardware tool on stock (vice_keyboard_restore) names the tool, unrecoverable, the fork route, and the shared alternative (14-02/FORK-02: pinned true on the retain branch, no source edit)
ok 3 - fork-only hardware tool on stock (vice_keyboard_restore) names the tool, unrecoverable, the fork route, and the shared alternative (14-02/FORK-02: pinned true on the retain branch, no source edit)
  ---
  duration_ms: 0.202811
  type: 'test'
  ...
# Subtest: fork-only descoped tool on stock names the tool, not implemented, the fork route, and never says unrecoverable
ok 4 - fork-only descoped tool on stock names the tool, not implemented, the fork route, and never says unrecoverable
  ---
  duration_ms: 0.152976
  type: 'test'
  ...
# Subtest: stock-only tool on fork names the stock route
ok 5 - stock-only tool on fork names the stock route
  ---
  duration_ms: 0.298099
  type: 'test'
  ...
# Subtest: regression guard: a genuinely unknown tool name yields no refusal at all
ok 6 - regression guard: a genuinely unknown tool name yields no refusal at all
  ---
  duration_ms: 0.153532
  type: 'test'
  ...
# Subtest: synthetic-tool guard: vice_diagnose and vice_recycle are absent from the registry and produce no refusal on either backend
ok 7 - synthetic-tool guard: vice_diagnose and vice_recycle are absent from the registry and produce no refusal on either backend
  ---
  duration_ms: 0.185791
  type: 'test'
  ...
# Subtest: DENY_LIST boundary: no DENY_LIST entry is duplicated into the capability registry
ok 8 - DENY_LIST boundary: no DENY_LIST entry is duplicated into the capability registry
  ---
  duration_ms: 0.11773
  type: 'test'
  ...
# Subtest: same-backend miss: every entry's own providedBy backend yields no refusal for that entry
ok 9 - same-backend miss: every entry's own providedBy backend yields no refusal for that entry
  ---
  duration_ms: 0.333685
  type: 'test'
  ...
# Subtest: mechanical completeness: the registry's name set equals the manifest-derived divergence set
not ok 10 - mechanical completeness: the registry's name set equals the manifest-derived divergence set
  ---
  duration_ms: 4.012856
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/capability-registry.test.ts:119:1'
  failureType: 'testCodeFailure'
  error: 'could not resolve synthetic tool registration identifier "annoDef" in vice-proxy.ts to a declaration -- silently dropping it would widen the exclusion set and mask a real capability divergence. Fix the pattern rather than skipping the identifier.'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/capability-registry.test.ts:180:13)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: vice_sid_get_state's reason and vice_sid_set_state's reason are not equal (Pitfall 3: read vs write are different losses)
ok 11 - vice_sid_get_state's reason and vice_sid_set_state's reason are not equal (Pitfall 3: read vs write are different losses)
  ---
  duration_ms: 0.273762
  type: 'test'
  ...
# Subtest: every entry carrying an `alternative` renders it in capabilityRefusalMessage (CR-01 regression)
ok 12 - every entry carrying an `alternative` renders it in capabilityRefusalMessage (CR-01 regression)
  ---
  duration_ms: 0.219936
  type: 'test'
  ...
# Subtest: a hardware entry WITHOUT an alternative does not gain stray text (CR-01 fix is conditional)
ok 13 - a hardware entry WITHOUT an alternative does not gain stray text (CR-01 fix is conditional)
  ---
  duration_ms: 0.110397
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
# duration_ms 157.612734
```

## `src/mcp/vice/disasm-roundtrip.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test disasm-roundtrip.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# DISASM-03 !byte substitution set (acmeExpressible=false, verified against installed ACME): $12, $1A, $22, $2B, $32, $34, $3A, $3C, $42, $44, $52, $54, $5A, $5C, $62, $64, $72, $74, $7A, $7C, $82, $89, $92, $B2, $C2, $D2, $D4, $DA, $DC, $E2, $EB, $F2, $F4, $FA, $FC
# Subtest: ACME availability gate (D-08)
ok 1 - ACME availability gate (D-08)
  ---
  duration_ms: 0.827038
  type: 'test'
  ...
# Subtest: Suite A: full 256-opcode round-trip through vice_disassemble's own listing (D-13, D-09)
ok 2 - Suite A: full 256-opcode round-trip through vice_disassemble's own listing (D-13, D-09)
  ---
  duration_ms: 10.472266
  type: 'test'
  ...
# Subtest: Suite B: a realistic fragment round-trips byte-exact (branches, D-11 shrink hazard, D-10 page-wrap, jsr, illegal-but-expressible opcodes)
ok 3 - Suite B: a realistic fragment round-trips byte-exact (branches, D-11 shrink hazard, D-10 page-wrap, jsr, illegal-but-expressible opcodes)
  ---
  duration_ms: 4.279768
  type: 'test'
  ...
# Subtest: Suite C: the acmeExpressible substitution table is byte-faithful in BOTH directions, driven from OPCODES (D-09)
ok 4 - Suite C: the acmeExpressible substitution table is byte-faithful in BOTH directions, driven from OPCODES (D-09)
  ---
  duration_ms: 833.584063
  type: 'test'
  ...
# Subtest: Suite D: the +2 size-force spelling is understood by ACME and produces the correct wide encoding (D-11)
ok 5 - Suite D: the +2 size-force spelling is understood by ACME and produces the correct wide encoding (D-11)
  ---
  duration_ms: 11.983234
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
# duration_ms 1094.26142
```

### Planted run

- **Plant:** `src/mcp/vice/disasm-renderer.ts`: `(value & 0xffff).toString(16).padStart(4, "0")` → `(value & 0xffff).toString(16).padStart(5, "0")`
- **Planted command:** `node --test disasm-roundtrip.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# DISASM-03 !byte substitution set (acmeExpressible=false, verified against installed ACME): $12, $1A, $22, $2B, $32, $34, $3A, $3C, $42, $44, $52, $54, $5A, $5C, $62, $64, $72, $74, $7A, $7C, $82, $89, $92, $B2, $C2, $D2, $D4, $DA, $DC, $E2, $EB, $F2, $F4, $FA, $FC
# Subtest: ACME availability gate (D-08)
ok 1 - ACME availability gate (D-08)
  ---
  duration_ms: 1.504843
  type: 'test'
  ...
# Subtest: Suite A: full 256-opcode round-trip through vice_disassemble's own listing (D-13, D-09)
not ok 2 - Suite A: full 256-opcode round-trip through vice_disassemble's own listing (D-13, D-09)
  ---
  duration_ms: 13.20851
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/disasm-roundtrip.test.ts:206:1'
  failureType: 'testCodeFailure'
  error: |-
    Suite A: the tool's own concatenated listing did not assemble through real ACME:
    Error - File /tmp/disasm-roundtrip-GLecEk/t0.a, line 15 (Zone <untitled>): Number out of range.
    Error - File /tmp/disasm-roundtrip-GLecEk/t0.a, line 16 (Zone <untitled>): Number out of range.
    Error - File /tmp/disasm-roundtrip-GLecEk/t0.a, line 17 (Zone <untitled>): Number out of range.
    Error - File /tmp/disasm-roundtrip-GLecEk/t0.a, line 18 (Zone <untitled>): Number out of range.
    Error - File /tmp/disasm-roundtrip-GLecEk/t0.a, line 28 (Zone <untitled>): Number out of range.
    Error - File /tmp/disasm-roundtrip-GLecEk/t0.a, line 30 (Zone <untitled>): Number out of range.
    Error - File /tmp/disasm-roundtrip-GLecEk/t0.a, line 31 (Zone <untitled>): Number out of range.
    Error - File /tmp/disasm-roundtrip-GLecEk/t0.a, line 32 (Zone <untitled>): Number out of range.
    Error - File /tmp/disasm-roundtrip-GLecEk/t0.a, line 33 (Zone <untitled>): Number out of range.
    Error - File /tmp/disasm-roundtrip-GLecEk/t0.a, line 34 (Zone <untitled>): Number out of range.
    
    ---
    !cpu 6510
    * = $01000
            brk
            ora ($40,x)
            jam  ; illegal opcode
            slo ($40,x)  ; illegal opcode
            nop $40  ; illegal opcode
            ora $40
            asl $40
            slo $40  ; illegal opcode
            php
            ora #$40
            asl
            anc #$40  ; illegal opcode
            nop $02000  ; illegal opcode
            ora $02000
            asl $02000
            slo $02000  ; illegal opcode
            bpl $01027
            ora ($40),y
            !byte $12  ; jam  [illegal opcode | not expressible in ACME !cpu 6510]
            slo ($40),y  ; illegal opcode
            nop $40,x  ; illegal opcode
            ora $40,x
            asl $40,x
            slo $40,x  ; illegal opcode
            clc
            ora $02000,y
            !byte $1a  ; nop  [illegal opcode | not expressible in ACME !cpu 6510]
            slo $02000,y  ; illegal opcode
            nop $02000,x  ; illegal opcode
            ora $02000,x
            asl $02000,x
            slo $02000,x  ; illegal opcode
            jsr $02000
            and ($40,x)
            !byte $22  ; jam  [illegal opcode | not expressible in ACME !cpu 6510]
            rla ($40,x)  ; illegal opcode
            bit $40
            and $40
            rol $40
            rla $40  ; illegal opcode
            plp
            and #$40
            rol
            !byte $2b, $40  ; anc #$40  [illegal opcode | not expressible in ACME !cpu 6510]
            bit $02000
            and $02000
            rol $02000
            rla $02000  ; illegal opcode
            bmi $0106c
            and ($40),y
            !byte $32  ; jam  [illegal opcode | not expressible in ACME !cpu 6510]
            rla ($40),y  ; illegal opcode
            !byte $34, $40  ; nop $40,x  [illegal opcode | not expressible in ACME !cpu 6510]
            and $40,x
            rol $40,x
            rla $40,x  ; illegal opcode
            sec
            and $02000,y
            !byte $3a  ; nop  [illegal opcode | not expressible in ACME !cpu 6510]
            rla $02000,y  ; illegal opcode
            !byte $3c, $00, $20  ; nop $02000,x  [illegal opcode | not expressible in ACME !cpu 6510]
            and $02000,x
            rol $02000,x
            rla $02000,x  ; illegal opcode
            rti
            eor ($40,x)
            !byte $42  ; jam  [illegal opcode | not expressible in ACME !cpu 6510]
            sre ($40,x)  ; illegal opcode
            !byte $44, $40  ; nop $40  [illegal opcode | not expressible in ACME !cpu 6510]
            eor $40
            lsr $40
            sre $40  ; illegal opcode
            pha
            eor #$40
            lsr
            alr #$40  ; illegal opcode
            jmp $02000
            eor $02000
            lsr $02000
            sre $02000  ; illegal opcode
            bvc $010af
            eor ($40),y
            !byte $52  ; jam  [illegal opcode | not expressible in ACME !cpu 6510]
            sre ($40),y  ; illegal opcode
            !byte $54, $40  ; nop $40,x  [illegal opcode | not expressible in ACME !cpu 6510]
            eor $40,x
            lsr $40,x
            sre $40,x  ; illegal opcode
            cli
            eor $02000,y
            !byte $5a  ; nop  [illegal opcode | not expressible in ACME !cpu 6510]
            sre $02000,y  ; illegal opcode
            !byte $5c, $00, $20  ; nop $02000,x  [illegal opcode | not expressible in ACME !cpu 6510]
            eor $02000,x
            lsr $02000,x
            sre $02000,x  ; illegal opcode
            rts
            adc ($40,x)
            !byte $62  ; jam  [illegal opcode | not expressible in ACME !cpu 6510]
            rra ($40,x)  ; illegal opcode
    !cpu 6510
    * = $010d1
            !byte $64, $40  ; nop $40  [illegal opcode | not expressible in ACME !cpu 6510]
            adc $40
            ror $40
            rra $40  ; illegal opcode
            pla
            adc #$40
            ror
            arr #$40  ; illegal opcode
            jmp ($010ff)  ; NMOS page-wrap: the high byte is fetched from $xx00, not the next page
            adc $02000
            ror $02000
            rra $02000  ; illegal opcode
            bvs $010f2
            adc ($40),y
            !byte $72  ; jam  [illegal opcode | not expressible in ACME !cpu 6510]
            rra ($40),y  ; illegal opcode
            !byte $74, $40  ; nop $40,x  [illegal opcode | not expressible in ACME !cpu 6510]
            adc $40,x
            ror $40,x
            rra $40,x  ; illegal opcode
            sei
            adc $02000,y
            !byte $7a  ; nop  [illegal opcode | not expressible in ACME !cpu 6510]
            rra $02000,y  ; illegal opcode
            !byte $7c, $00, $20  ; nop $02000,x  [illegal opcode | not expressible in ACME !cpu 6510]
            adc $02000,x
            ror $02000,x
            rra $02000,x  ; illegal opcode
            nop #$40  ; illegal opcode
            sta ($40,x)
            !byte $82, $40  ; nop #$40  [illegal opcode | not expressible in ACME !cpu 6510]
            sax ($40,x)  ; illegal opcode
            sty $40
            sta $40
            stx $40
            sax $40  ; illegal opcode
            dey
            !byte $89, $40  ; nop #$40  [illegal opcode | not expressible in ACME !cpu 6510]
            txa
            ane #$40  ; illegal opcode
            sty $02000
            sta $02000
            stx $02000
            sax $02000  ; illegal opcode
            bcc $01137
            sta ($40),y
            !byte $92  ; jam  [illegal opcode | not expressible in ACME !cpu 6510]
            sha ($40),y  ; illegal opcode
            sty $40,x
            sta $40,x
            stx $40,y
            sax $40,y  ; illegal opcode
            tya
            sta $02000,y
            txs
            tas $02000,y  ; illegal opcode
            shy $02000,x  ; illegal opcode
            sta $02000,x
            shx $02000,y  ; illegal opcode
            sha $02000,y  ; illegal opcode
            ldy #$40
            lda ($40,x)
            ldx #$40
            lax ($40,x)  ; illegal opcode
            ldy $40
            lda $40
            ldx $40
            lax $40  ; illegal opcode
            tay
            lda #$40
            tax
            lxa #$40  ; illegal opcode
            ldy $02000
            lda+2 $00080
            ldx $02000
            lax $02000  ; illegal opcode
            bcs $0117c
            lda ($40),y
            !byte $b2  ; jam  [illegal opcode | not expressible in ACME !cpu 6510]
            lax ($40),y  ; illegal opcode
            ldy $40,x
            lda $40,x
            ldx $40,y
            lax $40,y  ; illegal opcode
            clv
            lda $02000,y
            tsx
            las $02000,y  ; illegal opcode
            ldy $02000,x
            lda $02000,x
            ldx $02000,y
            lax $02000,y  ; illegal opcode
            cpy #$40
            cmp ($40,x)
            !byte $c2, $40  ; nop #$40  [illegal opcode | not expressible in ACME !cpu 6510]
            dcp ($40,x)  ; illegal opcode
            cpy $40
            cmp $40
            dec $40
            dcp $40  ; illegal opcode
    !cpu 6510
    * = $011a8
            iny
            cmp #$40
            dex
            sbx #$40  ; illegal opcode
            cpy $02000
            cmp $02000
            dec $02000
            dcp $02000  ; illegal opcode
            bne $011c1
            cmp ($40),y
            !byte $d2  ; jam  [illegal opcode | not expressible in ACME !cpu 6510]
            dcp ($40),y  ; illegal opcode
            !byte $d4, $40  ; nop $40,x  [illegal opcode | not expressible in ACME !cpu 6510]
            cmp $40,x
            dec $40,x
            dcp $40,x  ; illegal opcode
            cld
            cmp $02000,y
            !byte $da  ; nop  [illegal opcode | not expressible in ACME !cpu 6510]
            dcp $02000,y  ; illegal opcode
            !byte $dc, $00, $20  ; nop $02000,x  [illegal opcode | not expressible in ACME !cpu 6510]
            cmp $02000,x
            dec $02000,x
            dcp $02000,x  ; illegal opcode
            cpx #$40
            sbc ($40,x)
            !byte $e2, $40  ; nop #$40  [illegal opcode | not expressible in ACME !cpu 6510]
            isc ($40,x)  ; illegal opcode
            cpx $40
            sbc $40
            inc $40
            isc $40  ; illegal opcode
            inx
            sbc #$40
            nop
            !byte $eb, $40  ; sbc #$40  [illegal opcode | not expressible in ACME !cpu 6510]
            cpx $02000
            sbc $02000
            inc $02000
            isc $02000  ; illegal opcode
            beq $01206
            sbc ($40),y
            !byte $f2  ; jam  [illegal opcode | not expressible in ACME !cpu 6510]
            isc ($40),y  ; illegal opcode
            !byte $f4, $40  ; nop $40,x  [illegal opcode | not expressible in ACME !cpu 6510]
            sbc $40,x
            inc $40,x
            isc $40,x  ; illegal opcode
            sed
            sbc $02000,y
            !byte $fa  ; nop  [illegal opcode | not expressible in ACME !cpu 6510]
            isc $02000,y  ; illegal opcode
            !byte $fc, $00, $20  ; nop $02000,x  [illegal opcode | not expressible in ACME !cpu 6510]
            sbc $02000,x
            inc $02000,x
            isc $02000,x  ; illegal opcode
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/disasm-roundtrip.test.ts:249:10)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: Suite B: a realistic fragment round-trips byte-exact (branches, D-11 shrink hazard, D-10 page-wrap, jsr, illegal-but-expressible opcodes)
not ok 3 - Suite B: a realistic fragment round-trips byte-exact (branches, D-11 shrink hazard, D-10 page-wrap, jsr, illegal-but-expressible opcodes)
  ---
  duration_ms: 0.737301
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/disasm-roundtrip.test.ts:261:1'
  failureType: 'testCodeFailure'
  error: 'Suite B: the D-11 width force must appear on the lda $0080 line'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual: |-
    !cpu 6510
    * = $020f0
            bcc $020f4
            nop
            nop
            bcs $020f0
            bne $02102
            lda+2 $00080
            jmp ($010ff)  ; NMOS page-wrap: the high byte is fetched from $xx00, not the next page
            jsr $0ffd2
            lax $40  ; illegal opcode
            dcp $40  ; illegal opcode
            anc #$40  ; illegal opcode
  operator: 'match'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/disasm-roundtrip.test.ts:286:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: Suite C: the acmeExpressible substitution table is byte-faithful in BOTH directions, driven from OPCODES (D-09)
ok 4 - Suite C: the acmeExpressible substitution table is byte-faithful in BOTH directions, driven from OPCODES (D-09)
  ---
  duration_ms: 777.374515
  type: 'test'
  ...
# Subtest: Suite D: the +2 size-force spelling is understood by ACME and produces the correct wide encoding (D-11)
not ok 5 - Suite D: the +2 size-force spelling is understood by ACME and produces the correct wide encoding (D-11)
  ---
  duration_ms: 3.840175
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/disasm-roundtrip.test.ts:402:1'
  failureType: 'testCodeFailure'
  error: 'Suite D: render() must emit the +2 force for an absolute operand below $0100'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual: |-
    !cpu 6510
    * = $01000
            lda+2 $00080
  operator: 'match'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/disasm-roundtrip.test.ts:412:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
1..5
# tests 5
# suites 0
# pass 2
# fail 3
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1117.809159
```

## `src/mcp/vice/docs-dangling-refs.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test docs-dangling-refs.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# Subtest: no normative document points at a numbered phase as `.vsf`'s home (T-11-DOC-DANGLE)
ok 1 - no normative document points at a numbered phase as `.vsf`'s home (T-11-DOC-DANGLE)
  ---
  duration_ms: 9.188792
  type: 'test'
  ...
# Subtest: the `.vsf` backlog item still exists and still records why it is deferred
ok 2 - the `.vsf` backlog item still exists and still records why it is deferred
  ---
  duration_ms: 0.360902
  type: 'test'
  ...
# Subtest: non-vacuity: the scanned document set is non-empty and `.vsf` is actually discussed in it
ok 3 - non-vacuity: the scanned document set is non-empty and `.vsf` is actually discussed in it
  ---
  duration_ms: 1.255906
  type: 'test'
  ...
# Subtest: planted-violation: the exact wording that survived plan 11-03 is detected by this guard's own logic
ok 4 - planted-violation: the exact wording that survived plan 11-03 is detected by this guard's own logic
  ---
  duration_ms: 0.494698
  type: 'test'
  ...
# Subtest: no shipped src/mcp/vice/ string literal names a phase number (FLOW-02)
ok 5 - no shipped src/mcp/vice/ string literal names a phase number (FLOW-02)
  ---
  duration_ms: 54.799103
  type: 'test'
  ...
# Subtest: positive control: the scanner captures the literals this guard exists to police
ok 6 - positive control: the scanner captures the literals this guard exists to police
  ---
  duration_ms: 0.924115
  type: 'test'
  ...
# Subtest: non-vacuity: the scanned set and the extracted literal volume are real
ok 7 - non-vacuity: the scanned set and the extracted literal volume are real
  ---
  duration_ms: 12.700706
  type: 'test'
  ...
# Subtest: planted-violation: the verbatim pre-fix wording is flagged, and the corrected wording is not
ok 8 - planted-violation: the verbatim pre-fix wording is flagged, and the corrected wording is not
  ---
  duration_ms: 1.129229
  type: 'test'
  ...
1..8
# tests 8
# suites 0
# pass 8
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 211.060422
```

### Planted run

- **Plant:** `src/mcp/vice/anno-cli.ts`: `refusing to overwrite the existing file` → `refusing to overwrite the existing FILE`
- **Planted command:** `node --test docs-dangling-refs.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# Subtest: no normative document points at a numbered phase as `.vsf`'s home (T-11-DOC-DANGLE)
ok 1 - no normative document points at a numbered phase as `.vsf`'s home (T-11-DOC-DANGLE)
  ---
  duration_ms: 10.002737
  type: 'test'
  ...
# Subtest: the `.vsf` backlog item still exists and still records why it is deferred
ok 2 - the `.vsf` backlog item still exists and still records why it is deferred
  ---
  duration_ms: 0.401837
  type: 'test'
  ...
# Subtest: non-vacuity: the scanned document set is non-empty and `.vsf` is actually discussed in it
ok 3 - non-vacuity: the scanned document set is non-empty and `.vsf` is actually discussed in it
  ---
  duration_ms: 1.291581
  type: 'test'
  ...
# Subtest: planted-violation: the exact wording that survived plan 11-03 is detected by this guard's own logic
ok 4 - planted-violation: the exact wording that survived plan 11-03 is detected by this guard's own logic
  ---
  duration_ms: 0.52947
  type: 'test'
  ...
# Subtest: no shipped src/mcp/vice/ string literal names a phase number (FLOW-02)
ok 5 - no shipped src/mcp/vice/ string literal names a phase number (FLOW-02)
  ---
  duration_ms: 55.263591
  type: 'test'
  ...
# Subtest: positive control: the scanner captures the literals this guard exists to police
not ok 6 - positive control: the scanner captures the literals this guard exists to police
  ---
  duration_ms: 2.390657
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/docs-dangling-refs.test.ts:382:1'
  failureType: 'testCodeFailure'
  error: "the scanner did not capture anno-cli.ts's concatenated overwrite-refusal literal -- the control for multi-part string concatenation"
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/docs-dangling-refs.test.ts:399:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: non-vacuity: the scanned set and the extracted literal volume are real
ok 7 - non-vacuity: the scanned set and the extracted literal volume are real
  ---
  duration_ms: 22.025043
  type: 'test'
  ...
# Subtest: planted-violation: the verbatim pre-fix wording is flagged, and the corrected wording is not
ok 8 - planted-violation: the verbatim pre-fix wording is flagged, and the corrected wording is not
  ---
  duration_ms: 2.103282
  type: 'test'
  ...
1..8
# tests 8
# suites 0
# pass 7
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 228.226512
```

## `src/mcp/vice/hop-chain-comments.test.ts` — verdict `re-pointed`

**HARNESS FAILURE.** the plant descriptor was REFUSED before any byte was written, so no guard run was attempted for this row and no evidence can be recorded from it: row src/mcp/vice/hop-chain-comments.test.ts: plant post-condition FAILED for src/mcp/vice/absorbed-answer-key.test.ts -- the recorded `replace` string occurs 1 time(s) in that file BEFORE the mutation and 1 time(s) after it, so the mutation would INTRODUCE it 0 time(s); exactly 1 is required. A mismatch means the bytes this harness would write are not the bytes this row records, so the row would promise a reader a hand-reproducible find/replace that does not reproduce. Nothing was written. The three counts are reported separately so the divergence can be located: whether the replacement reaches the mutated text at all, whether the write lands it more than once, and how many times it was already present independently of this mutation (CR-02, CR-06).

Control command: `node --test hop-chain-comments.test.ts` (cwd `src/mcp/vice`)
Control exit status: `0` (must be 0)

Raw control output:

```
TAP version 13
# Subtest: non-vacuity: the scan enumerated at least fifty files
ok 1 - non-vacuity: the scan enumerated at least fifty files
  ---
  duration_ms: 1.266078
  type: 'test'
  ...
# Subtest: non-vacuity: the extractor found at least three chain-shaped comment lines across the corpus
ok 2 - non-vacuity: the extractor found at least three chain-shaped comment lines across the corpus
  ---
  duration_ms: 119.566737
  type: 'test'
  ...
# Subtest: in-tree negative control: absorbed-answer-key.test.ts's legitimate chain line is seen but never flagged
ok 3 - in-tree negative control: absorbed-answer-key.test.ts's legitimate chain line is seen but never flagged
  ---
  duration_ms: 132.920762
  type: 'test'
  ...
# Subtest: fixture: the committed fixture exists and its extension is neither .ts nor .mts
ok 4 - fixture: the committed fixture exists and its extension is neither .ts nor .mts
  ---
  duration_ms: 0.236625
  type: 'test'
  ...
# Subtest: fixture-driven positive control: the fixture's planted half-swept chain line is flagged
ok 5 - fixture-driven positive control: the fixture's planted half-swept chain line is flagged
  ---
  duration_ms: 0.310238
  type: 'test'
  ...
# Subtest: fixture-driven negative control: the fixture's legitimate-narration line reports zero violations
ok 6 - fixture-driven negative control: the fixture's legitimate-narration line reports zero violations
  ---
  duration_ms: 0.177679
  type: 'test'
  ...
# Subtest: no shipped src/mcp/vice source comment describes a half-swept repo-root chain (PKG-03)
ok 7 - no shipped src/mcp/vice source comment describes a half-swept repo-root chain (PKG-03)
  ---
  duration_ms: 112.279111
  type: 'test'
  ...
1..7
# tests 7
# suites 0
# pass 7
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 485.028034
```

**No planted run was made.** The plant was refused, so there is nothing to report.

## `src/mcp/vice/hostpath-consumers.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test hostpath-consumers.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# Subtest: hostpath.ts's production consumer set is exactly the five declared modules
ok 1 - hostpath.ts's production consumer set is exactly the five declared modules
  ---
  duration_ms: 31.902843
  type: 'test'
  ...
# Subtest: stock-derived.ts is absent from the hostpath.ts consumer set
ok 2 - stock-derived.ts is absent from the hostpath.ts consumer set
  ---
  duration_ms: 20.996251
  type: 'test'
  ...
# Subtest: the disassembler modules (not yet reachable from stock-dispatch.ts in this wave) are absent from the consumer set
ok 3 - the disassembler modules (not yet reachable from stock-dispatch.ts in this wave) are absent from the consumer set
  ---
  duration_ms: 20.120196
  type: 'test'
  ...
# Subtest: every module this phase adds is absent from the hostpath.ts consumer set (MCP-02), named before it exists
ok 4 - every module this phase adds is absent from the hostpath.ts consumer set (MCP-02), named before it exists
  ---
  duration_ms: 21.785206
  type: 'test'
  ...
# Subtest: the annotation module family (D-08/R2000-02) is derived from disk with a non-vacuity floor, not a hard-coded list (INT-01/D-11.1-03)
ok 5 - the annotation module family (D-08/R2000-02) is derived from disk with a non-vacuity floor, not a hard-coded list (INT-01/D-11.1-03)
  ---
  duration_ms: 1.23783
  type: 'test'
  ...
# Subtest: MCP-05: the hand-pinned annotation module floor equals the measured count -- a same-wave change to the module set fails HERE with the right diagnosis
ok 6 - MCP-05: the hand-pinned annotation module floor equals the measured count -- a same-wave change to the module set fails HERE with the right diagnosis
  ---
  duration_ms: 0.685198
  type: 'test'
  ...
# Subtest: INT-01's positive control: the modules the audit found uncovered are present in the derived annotation set
ok 7 - INT-01's positive control: the modules the audit found uncovered are present in the derived annotation set
  ---
  duration_ms: 0.836827
  type: 'test'
  ...
# Subtest: the annotation module family (D-08/R2000-02) is absent from the consumer set -- the rented analyser ran container-side (D-R4), the mirror image of DERIV-07's wrongly-translated screenshot path
ok 8 - the annotation module family (D-08/R2000-02) is absent from the consumer set -- the rented analyser ran container-side (D-R4), the mirror image of DERIV-07's wrongly-translated screenshot path
  ---
  duration_ms: 20.848957
  type: 'test'
  ...
# Subtest: planted violation (INT-01 proof): a synthetic r2000-shaped source that DOES import hostpath.ts is reported by the same predicate the real scan uses
ok 9 - planted violation (INT-01 proof): a synthetic r2000-shaped source that DOES import hostpath.ts is reported by the same predicate the real scan uses
  ---
  duration_ms: 0.754919
  type: 'test'
  ...
# Subtest: planted violation, three import shapes (Phase 10 IN-02 proof): multi-line static and dynamic imports are caught; a comment/string-literal-only mention is not
ok 10 - planted violation, three import shapes (Phase 10 IN-02 proof): multi-line static and dynamic imports are caught; a comment/string-literal-only mention is not
  ---
  duration_ms: 0.725136
  type: 'test'
  ...
# Subtest: D-05-12: DERIVED_TOOL_MODULES' key set equals STOCK_DERIVED_TOOLS exactly
ok 11 - D-05-12: DERIVED_TOOL_MODULES' key set equals STOCK_DERIVED_TOOLS exactly
  ---
  duration_ms: 0.320087
  type: 'test'
  ...
# Subtest: D-05-12: every DERIVED_TOOL_MODULES filename exists on disk
ok 12 - D-05-12: every DERIVED_TOOL_MODULES filename exists on disk
  ---
  duration_ms: 0.410693
  type: 'test'
  ...
# Subtest: D-02 mechanism 2: no module implementing a STOCK_DERIVED_TOOLS entry may ever join the hostpath.ts consumer set
ok 13 - D-02 mechanism 2: no module implementing a STOCK_DERIVED_TOOLS entry may ever join the hostpath.ts consumer set
  ---
  duration_ms: 19.726282
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
# duration_ms 332.343105
```

### Planted run

- **Plant:** `src/mcp/vice/anno-store.ts`: `import { randomUUID } from "node:crypto";` → `import { randomUUID } from "node:crypto";
import { hostPath } from "./hostpath.ts";`
- **Planted command:** `node --test hostpath-consumers.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# Subtest: hostpath.ts's production consumer set is exactly the five declared modules
not ok 1 - hostpath.ts's production consumer set is exactly the five declared modules
  ---
  duration_ms: 23.712724
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/hostpath-consumers.test.ts:146:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
    
      [
    +   'anno-store.ts',
        'containerpath.ts',
        'install-resources.ts',
        'stock-paths.ts',
        'vice-proxy.ts',
        'vice-sync.ts'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
    0: 'containerpath.ts'
    1: 'install-resources.ts'
    2: 'stock-paths.ts'
    3: 'vice-proxy.ts'
    4: 'vice-sync.ts'
  actual:
    0: 'anno-store.ts'
    1: 'containerpath.ts'
    2: 'install-resources.ts'
    3: 'stock-paths.ts'
    4: 'vice-proxy.ts'
    5: 'vice-sync.ts'
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/hostpath-consumers.test.ts:148:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
# Subtest: stock-derived.ts is absent from the hostpath.ts consumer set
ok 2 - stock-derived.ts is absent from the hostpath.ts consumer set
  ---
  duration_ms: 14.105919
  type: 'test'
  ...
# Subtest: the disassembler modules (not yet reachable from stock-dispatch.ts in this wave) are absent from the consumer set
ok 3 - the disassembler modules (not yet reachable from stock-dispatch.ts in this wave) are absent from the consumer set
  ---
  duration_ms: 13.674191
  type: 'test'
  ...
# Subtest: every module this phase adds is absent from the hostpath.ts consumer set (MCP-02), named before it exists
ok 4 - every module this phase adds is absent from the hostpath.ts consumer set (MCP-02), named before it exists
  ---
  duration_ms: 15.193439
  type: 'test'
  ...
# Subtest: the annotation module family (D-08/R2000-02) is derived from disk with a non-vacuity floor, not a hard-coded list (INT-01/D-11.1-03)
ok 5 - the annotation module family (D-08/R2000-02) is derived from disk with a non-vacuity floor, not a hard-coded list (INT-01/D-11.1-03)
  ---
  duration_ms: 0.81813
  type: 'test'
  ...
# Subtest: MCP-05: the hand-pinned annotation module floor equals the measured count -- a same-wave change to the module set fails HERE with the right diagnosis
ok 6 - MCP-05: the hand-pinned annotation module floor equals the measured count -- a same-wave change to the module set fails HERE with the right diagnosis
  ---
  duration_ms: 0.522368
  type: 'test'
  ...
# Subtest: INT-01's positive control: the modules the audit found uncovered are present in the derived annotation set
ok 7 - INT-01's positive control: the modules the audit found uncovered are present in the derived annotation set
  ---
  duration_ms: 0.415901
  type: 'test'
  ...
# Subtest: the annotation module family (D-08/R2000-02) is absent from the consumer set -- the rented analyser ran container-side (D-R4), the mirror image of DERIV-07's wrongly-translated screenshot path
not ok 8 - the annotation module family (D-08/R2000-02) is absent from the consumer set -- the rented analyser ran container-side (D-R4), the mirror image of DERIV-07's wrongly-translated screenshot path
  ---
  duration_ms: 14.327561
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/hostpath-consumers.test.ts:319:1'
  failureType: 'testCodeFailure'
  error: |-
    anno-store.ts must not import hostpath.ts, whether or not it exists yet
    
    true !== false
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: false
  actual: true
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/hostpath-consumers.test.ts:326:12)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: planted violation (INT-01 proof): a synthetic r2000-shaped source that DOES import hostpath.ts is reported by the same predicate the real scan uses
ok 9 - planted violation (INT-01 proof): a synthetic r2000-shaped source that DOES import hostpath.ts is reported by the same predicate the real scan uses
  ---
  duration_ms: 0.439005
  type: 'test'
  ...
# Subtest: planted violation, three import shapes (Phase 10 IN-02 proof): multi-line static and dynamic imports are caught; a comment/string-literal-only mention is not
ok 10 - planted violation, three import shapes (Phase 10 IN-02 proof): multi-line static and dynamic imports are caught; a comment/string-literal-only mention is not
  ---
  duration_ms: 0.463825
  type: 'test'
  ...
# Subtest: D-05-12: DERIVED_TOOL_MODULES' key set equals STOCK_DERIVED_TOOLS exactly
ok 11 - D-05-12: DERIVED_TOOL_MODULES' key set equals STOCK_DERIVED_TOOLS exactly
  ---
  duration_ms: 0.433312
  type: 'test'
  ...
# Subtest: D-05-12: every DERIVED_TOOL_MODULES filename exists on disk
ok 12 - D-05-12: every DERIVED_TOOL_MODULES filename exists on disk
  ---
  duration_ms: 0.23522
  type: 'test'
  ...
# Subtest: D-02 mechanism 2: no module implementing a STOCK_DERIVED_TOOLS entry may ever join the hostpath.ts consumer set
ok 13 - D-02 mechanism 2: no module implementing a STOCK_DERIVED_TOOLS entry may ever join the hostpath.ts consumer set
  ---
  duration_ms: 12.80558
  type: 'test'
  ...
1..13
# tests 13
# suites 0
# pass 11
# fail 2
# cancelled 0
# skipped 0
# todo 0
# duration_ms 254.28418
```

## `src/mcp/vice/skill-acme-build-cli.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test skill-acme-build-cli.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# Subtest: ACME availability gate (mirrors disasm-roundtrip.test.ts's D-08 gate) -- always runs, never skips
ok 1 - ACME availability gate (mirrors disasm-roundtrip.test.ts's D-08 gate) -- always runs, never skips
  ---
  duration_ms: 1.824327
  type: 'test'
  ...
# Subtest: acme.mjs is resolved at the expected relative path
ok 2 - acme.mjs is resolved at the expected relative path
  ---
  duration_ms: 0.429055
  type: 'test'
  ...
# Subtest: no arguments: prints usage and exits 0
ok 3 - no arguments: prints usage and exits 0
  ---
  duration_ms: 38.106387
  type: 'test'
  ...
# Subtest: an unknown verb: prints usage and exits 1
ok 4 - an unknown verb: prints usage and exits 1
  ---
  duration_ms: 32.792661
  type: 'test'
  ...
# Subtest: the build verb with a missing source path: exits 1 with the documented message
ok 5 - the build verb with a missing source path: exits 1 with the documented message
  ---
  duration_ms: 38.75597
  type: 'test'
  ...
# Subtest: the build verb with a path that does not exist: exits 1 with the documented message
ok 6 - the build verb with a path that does not exist: exits 1 with the documented message
  ---
  duration_ms: 33.930954
  type: 'test'
  ...
# Subtest: the scaffold verb writes a source file at the requested path; run twice against the same path, the documented (refusal) behaviour is pinned
ok 7 - the scaffold verb writes a source file at the requested path; run twice against the same path, the documented (refusal) behaviour is pinned
  ---
  duration_ms: 75.344016
  type: 'test'
  ...
# Subtest: the scaffold verb writes a `; Build:` line naming the consumer's installed location, never this repository's source-tree location (16-REVIEW.md CR-01 class)
ok 8 - the scaffold verb writes a `; Build:` line naming the consumer's installed location, never this repository's source-tree location (16-REVIEW.md CR-01 class)
  ---
  duration_ms: 32.038094
  type: 'test'
  ...
# Subtest: the scaffold verb with a missing path argument: exits 1 with the documented usage message
ok 9 - the scaffold verb with a missing path argument: exits 1 with the documented usage message
  ---
  duration_ms: 31.618777
  type: 'test'
  ...
# Subtest: the scaffold verb needs no assembler library at all: with the library-path variable explicitly cleared, scaffolding still succeeds -- the same condition CI's own scaffold check uses
ok 10 - the scaffold verb needs no assembler library at all: with the library-path variable explicitly cleared, scaffolding still succeeds -- the same condition CI's own scaffold check uses
  ---
  duration_ms: 34.900995
  type: 'test'
  ...
# Subtest: assembling the scaffolded source with the library path cleared produces a program file whose first two bytes are the documented load address (mirrors CI's library-free scaffold-and-assemble check)
ok 11 - assembling the scaffolded source with the library path cleared produces a program file whose first two bytes are the documented load address (mirrors CI's library-free scaffold-and-assemble check)
  ---
  duration_ms: 72.704605
  type: 'test'
  ...
# Subtest: the symbol verb against the scaffolded source exits 0 and lists at least one symbol, with address-typed symbols marked the way the script documents
ok 12 - the symbol verb against the scaffolded source exits 0 and lists at least one symbol, with address-typed symbols marked the way the script documents
  ---
  duration_ms: 73.913851
  type: 'test'
  ...
# Subtest: a source file with a deliberate syntax error: exits non-zero, and the diagnostic carries a file, a line and a severity
ok 13 - a source file with a deliberate syntax error: exits non-zero, and the diagnostic carries a file, a line and a severity
  ---
  duration_ms: 53.792645
  type: 'test'
  ...
# Subtest: the output-path (-o) and output-directory (--out-dir) options place the artefact where they say; the report-suppression (--no-report) option omits the report the default run writes
ok 14 - the output-path (-o) and output-directory (--out-dir) options place the artefact where they say; the report-suppression (--no-report) option omits the report the default run writes
  ---
  duration_ms: 195.412495
  type: 'test'
  ...
# Subtest: ACME_BIN is the shared seam's binary name, not a second hand-rolled default
ok 15 - ACME_BIN is the shared seam's binary name, not a second hand-rolled default
  ---
  duration_ms: 0.23802
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
# duration_ms 857.409027
```

### Planted run

- **Plant:** `src/mcp/vice/acme-gate.ts`: `export const ACME_BIN: string = process.env.ACME_BIN ?? "acme";` → `export const ACME_BIN: string = process.env.ACME_BIN ?? "acmeZZ";`
- **Planted command:** `node --test skill-acme-build-cli.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# Subtest: ACME availability gate (mirrors disasm-roundtrip.test.ts's D-08 gate) -- always runs, never skips
ok 1 - ACME availability gate (mirrors disasm-roundtrip.test.ts's D-08 gate) -- always runs, never skips
  ---
  duration_ms: 1.873785
  type: 'test'
  ...
# Subtest: acme.mjs is resolved at the expected relative path
ok 2 - acme.mjs is resolved at the expected relative path
  ---
  duration_ms: 0.367984
  type: 'test'
  ...
# Subtest: no arguments: prints usage and exits 0
ok 3 - no arguments: prints usage and exits 0
  ---
  duration_ms: 34.263816
  type: 'test'
  ...
# Subtest: an unknown verb: prints usage and exits 1
ok 4 - an unknown verb: prints usage and exits 1
  ---
  duration_ms: 38.869831
  type: 'test'
  ...
# Subtest: the build verb with a missing source path: exits 1 with the documented message
ok 5 - the build verb with a missing source path: exits 1 with the documented message
  ---
  duration_ms: 33.389421
  type: 'test'
  ...
# Subtest: the build verb with a path that does not exist: exits 1 with the documented message
ok 6 - the build verb with a path that does not exist: exits 1 with the documented message
  ---
  duration_ms: 37.026353
  type: 'test'
  ...
# Subtest: the scaffold verb writes a source file at the requested path; run twice against the same path, the documented (refusal) behaviour is pinned
ok 7 - the scaffold verb writes a source file at the requested path; run twice against the same path, the documented (refusal) behaviour is pinned
  ---
  duration_ms: 81.486999
  type: 'test'
  ...
# Subtest: the scaffold verb writes a `; Build:` line naming the consumer's installed location, never this repository's source-tree location (16-REVIEW.md CR-01 class)
ok 8 - the scaffold verb writes a `; Build:` line naming the consumer's installed location, never this repository's source-tree location (16-REVIEW.md CR-01 class)
  ---
  duration_ms: 36.40586
  type: 'test'
  ...
# Subtest: the scaffold verb with a missing path argument: exits 1 with the documented usage message
ok 9 - the scaffold verb with a missing path argument: exits 1 with the documented usage message
  ---
  duration_ms: 44.19698
  type: 'test'
  ...
# Subtest: the scaffold verb needs no assembler library at all: with the library-path variable explicitly cleared, scaffolding still succeeds -- the same condition CI's own scaffold check uses
ok 10 - the scaffold verb needs no assembler library at all: with the library-path variable explicitly cleared, scaffolding still succeeds -- the same condition CI's own scaffold check uses # SKIP skill-acme-build-cli.test.ts's ACME-dependent tests are skipped -- no real ACME was found at ACME_BIN="acmeZZ". Install ACME (verified against release 0.97 "Zem") or set ACME_BIN to an absolute path. CI installs ACME and sets VICE_REQUIRE_ACME=1, so this SKIP is a local-only state.
  ---
  duration_ms: 0.599122
  type: 'test'
  ...
# Subtest: assembling the scaffolded source with the library path cleared produces a program file whose first two bytes are the documented load address (mirrors CI's library-free scaffold-and-assemble check)
ok 11 - assembling the scaffolded source with the library path cleared produces a program file whose first two bytes are the documented load address (mirrors CI's library-free scaffold-and-assemble check) # SKIP skill-acme-build-cli.test.ts's ACME-dependent tests are skipped -- no real ACME was found at ACME_BIN="acmeZZ". Install ACME (verified against release 0.97 "Zem") or set ACME_BIN to an absolute path. CI installs ACME and sets VICE_REQUIRE_ACME=1, so this SKIP is a local-only state.
  ---
  duration_ms: 0.251205
  type: 'test'
  ...
# Subtest: the symbol verb against the scaffolded source exits 0 and lists at least one symbol, with address-typed symbols marked the way the script documents
ok 12 - the symbol verb against the scaffolded source exits 0 and lists at least one symbol, with address-typed symbols marked the way the script documents # SKIP skill-acme-build-cli.test.ts's ACME-dependent tests are skipped -- no real ACME was found at ACME_BIN="acmeZZ". Install ACME (verified against release 0.97 "Zem") or set ACME_BIN to an absolute path. CI installs ACME and sets VICE_REQUIRE_ACME=1, so this SKIP is a local-only state.
  ---
  duration_ms: 0.814621
  type: 'test'
  ...
# Subtest: a source file with a deliberate syntax error: exits non-zero, and the diagnostic carries a file, a line and a severity
ok 13 - a source file with a deliberate syntax error: exits non-zero, and the diagnostic carries a file, a line and a severity # SKIP skill-acme-build-cli.test.ts's ACME-dependent tests are skipped -- no real ACME was found at ACME_BIN="acmeZZ". Install ACME (verified against release 0.97 "Zem") or set ACME_BIN to an absolute path. CI installs ACME and sets VICE_REQUIRE_ACME=1, so this SKIP is a local-only state.
  ---
  duration_ms: 0.123164
  type: 'test'
  ...
# Subtest: the output-path (-o) and output-directory (--out-dir) options place the artefact where they say; the report-suppression (--no-report) option omits the report the default run writes
ok 14 - the output-path (-o) and output-directory (--out-dir) options place the artefact where they say; the report-suppression (--no-report) option omits the report the default run writes # SKIP skill-acme-build-cli.test.ts's ACME-dependent tests are skipped -- no real ACME was found at ACME_BIN="acmeZZ". Install ACME (verified against release 0.97 "Zem") or set ACME_BIN to an absolute path. CI installs ACME and sets VICE_REQUIRE_ACME=1, so this SKIP is a local-only state.
  ---
  duration_ms: 0.091894
  type: 'test'
  ...
# Subtest: ACME_BIN is the shared seam's binary name, not a second hand-rolled default
not ok 15 - ACME_BIN is the shared seam's binary name, not a second hand-rolled default
  ---
  duration_ms: 1.228158
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/skill-acme-build-cli.test.ts:288:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    
    'acmeZZ' !== 'acme'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 'acme'
  actual: 'acmeZZ'
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/skill-acme-build-cli.test.ts:289:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
1..15
# tests 15
# suites 0
# pass 9
# fail 1
# cancelled 0
# skipped 5
# todo 0
# duration_ms 463.787457
```

## `src/mcp/vice/skill-attribution.test.ts` — verdict `kept-unchanged`

**SKIPPED.** verdict `kept-unchanged` owes no observed-red evidence (D-05); its evidence is the recorded removal trigger and classification, not a planted guard run. Not measured, and not silently omitted.

## `src/mcp/vice/stock-connect.test.ts` — verdict `kept-unchanged`

**SKIPPED.** verdict `kept-unchanged` owes no observed-red evidence (D-05); its evidence is the recorded removal trigger and classification, not a planted guard run. Not measured, and not silently omitted.

## `src/mcp/vice/stock-dispatch.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test stock-dispatch.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# (node:64535) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: manifest/backend: fork with no override resolves to <hereDir>/tools-manifest.json
ok 1 - manifest/backend: fork with no override resolves to <hereDir>/tools-manifest.json
  ---
  duration_ms: 2.267473
  type: 'test'
  ...
# Subtest: manifest/backend: stock with no override resolves to <hereDir>/tools-manifest.stock.json
ok 2 - manifest/backend: stock with no override resolves to <hereDir>/tools-manifest.stock.json
  ---
  duration_ms: 0.285506
  type: 'test'
  ...
# Subtest: manifest/backend: VICE_TOOLS_MANIFEST override wins for the fork backend, resolved
ok 3 - manifest/backend: VICE_TOOLS_MANIFEST override wins for the fork backend, resolved
  ---
  duration_ms: 0.300248
  type: 'test'
  ...
# Subtest: manifest/backend: VICE_TOOLS_MANIFEST override wins for the stock backend too -- same override, same resolved path
ok 4 - manifest/backend: VICE_TOOLS_MANIFEST override wins for the stock backend too -- same override, same resolved path
  ---
  duration_ms: 0.187716
  type: 'test'
  ...
# Subtest: manifest/backend: tools-manifest.stock.json parses and carries the same three top-level keys as the fork manifest
ok 5 - manifest/backend: tools-manifest.stock.json parses and carries the same three top-level keys as the fork manifest
  ---
  duration_ms: 2.165647
  type: 'test'
  ...
# Subtest: manifest/backend: tools-manifest.stock.json's tools array contains a vice_ping entry
ok 6 - manifest/backend: tools-manifest.stock.json's tools array contains a vice_ping entry
  ---
  duration_ms: 1.030651
  type: 'test'
  ...
# Subtest: manifest/backend (D-03 name coverage): every non-stock-only, non-proxy-local stock tool has a fork counterpart; every STOCK_ONLY_TOOLS name is stock-only
ok 7 - manifest/backend (D-03 name coverage): every non-stock-only, non-proxy-local stock tool has a fork counterpart; every STOCK_ONLY_TOOLS name is stock-only
  ---
  duration_ms: 1.399017
  type: 'test'
  ...
# Subtest: WR-07/resolveAdvertisedToolDefinition (stock, real manifest): vice_diagnose's resolved description drops stale_read_path and names monitor_held_elsewhere
ok 8 - WR-07/resolveAdvertisedToolDefinition (stock, real manifest): vice_diagnose's resolved description drops stale_read_path and names monitor_held_elsewhere
  ---
  duration_ms: 0.946971
  type: 'test'
  ...
# Subtest: WR-07/resolveAdvertisedToolDefinition (stock, real manifest): vice_diagnose's resolved outputSchema.verdict.enum is exactly D-03's five values, in order
ok 9 - WR-07/resolveAdvertisedToolDefinition (stock, real manifest): vice_diagnose's resolved outputSchema.verdict.enum is exactly D-03's five values, in order
  ---
  duration_ms: 2.860275
  type: 'test'
  ...
# Subtest: WR-07/resolveAdvertisedToolDefinition (stock, real manifest): vice_recycle's resolved description states the stock incident record carries no screenshot (D-01)
ok 10 - WR-07/resolveAdvertisedToolDefinition (stock, real manifest): vice_recycle's resolved description states the stock incident record carries no screenshot (D-01)
  ---
  duration_ms: 1.09599
  type: 'test'
  ...
# Subtest: WR-07/resolveAdvertisedToolDefinition (fork): both names resolve to the synthetic stand-in, byte-identical -- the fork's advertised surface is untouched
ok 11 - WR-07/resolveAdvertisedToolDefinition (fork): both names resolve to the synthetic stand-in, byte-identical -- the fork's advertised surface is untouched
  ---
  duration_ms: 0.770058
  type: 'test'
  ...
# Subtest: WR-07/resolveAdvertisedToolDefinition (stock, empty/malformed manifest): both names fall back to the synthetic stand-in rather than advertising nothing
ok 12 - WR-07/resolveAdvertisedToolDefinition (stock, empty/malformed manifest): both names fall back to the synthetic stand-in rather than advertising nothing
  ---
  duration_ms: 0.167037
  type: 'test'
  ...
# Subtest: WR-07/resolveAdvertisedToolDefinition (guard): every PROXY_LOCAL_TOOLS name resolves to its OWN stock manifest entry, tying the source and manifest levels together
ok 13 - WR-07/resolveAdvertisedToolDefinition (guard): every PROXY_LOCAL_TOOLS name resolves to its OWN stock manifest entry, tying the source and manifest levels together
  ---
  duration_ms: 0.771488
  type: 'test'
  ...
# Subtest: manifest/backend (D-03 input compatibility): every stock/fork pair has equal required-argument SETS, and stock's extra properties are all optional on the fork side
ok 14 - manifest/backend (D-03 input compatibility): every stock/fork pair has equal required-argument SETS, and stock's extra properties are all optional on the fork side
  ---
  duration_ms: 1.781036
  type: 'test'
  ...
# Subtest: manifest/backend (bidirectional table/manifest agreement): every stock manifest entry has a dispatch handler, and every dispatch entry has a manifest entry
ok 15 - manifest/backend (bidirectional table/manifest agreement): every stock manifest entry has a dispatch handler, and every dispatch entry has a manifest entry
  ---
  duration_ms: 0.902915
  type: 'test'
  ...
# Subtest: manifest/backend (D-02 outputSchema presence): every stock manifest entry declares an outputSchema whose type is "object"
ok 16 - manifest/backend (D-02 outputSchema presence): every stock manifest entry declares an outputSchema whose type is "object"
  ---
  duration_ms: 0.778127
  type: 'test'
  ...
# Subtest: manifest/backend (D-06 runState enum): every stock entry's outputSchema declares a required runState enum of ["running","stopped","unknown"]
ok 17 - manifest/backend (D-06 runState enum): every stock entry's outputSchema declares a required runState enum of ["running","stopped","unknown"]
  ---
  duration_ms: 0.835081
  type: 'test'
  ...
# Subtest: manifest/backend: every outputSchema itself uses only checkAgainstSchema's supported keyword subset
ok 18 - manifest/backend: every outputSchema itself uses only checkAgainstSchema's supported keyword subset
  ---
  duration_ms: 2.721927
  type: 'test'
  ...
# Subtest: manifest/backend (trimmed tools absent): none of the twelve decision-trimmed tools appears in tools-manifest.stock.json
ok 19 - manifest/backend (trimmed tools absent): none of the twelve decision-trimmed tools appears in tools-manifest.stock.json
  ---
  duration_ms: 1.001351
  type: 'test'
  ...
# Subtest: manifest/backend: no DENY_LIST name appears in tools-manifest.stock.json
ok 20 - manifest/backend: no DENY_LIST name appears in tools-manifest.stock.json
  ---
  duration_ms: 1.862041
  type: 'test'
  ...
# Subtest: lease: ensureLease is awaited strictly before stockConnect is ever called (lease-before-connect ordering)
ok 21 - lease: ensureLease is awaited strictly before stockConnect is ever called (lease-before-connect ordering)
  ---
  duration_ms: 0.662647
  type: 'test'
  ...
# Subtest: lease: stockConnect receives the exact host/port/targetId/brokerControl the lease provider returned
ok 22 - lease: stockConnect receives the exact host/port/targetId/brokerControl the lease provider returned
  ---
  duration_ms: 0.259259
  type: 'test'
  ...
# Subtest: lease: a provider failure never calls stockConnect and its message passes through verbatim
ok 23 - lease: a provider failure never calls stockConnect and its message passes through verbatim
  ---
  duration_ms: 0.157732
  type: 'test'
  ...
# Subtest: lease: a lease of null (the VICE_MCP_URL override) never calls stockConnect and names VICE_MCP_URL in the refusal
ok 24 - lease: a lease of null (the VICE_MCP_URL override) never calls stockConnect and names VICE_MCP_URL in the refusal
  ---
  duration_ms: 0.243237
  type: 'test'
  ...
# Subtest: lease: two successive calls with the same targetId call stockConnect exactly once -- the held session is reused
ok 25 - lease: two successive calls with the same targetId call stockConnect exactly once -- the held session is reused
  ---
  duration_ms: 0.240223
  type: 'test'
  ...
# Subtest: lease: a replacement acquisition naming a different targetId calls stockConnect a second time
ok 26 - lease: a replacement acquisition naming a different targetId calls stockConnect a second time
  ---
  duration_ms: 0.30075
  type: 'test'
  ...
# Subtest: CR-06: the lease's epochFile/supervisorDir and the settled binary path all reach stockConnect as deps
ok 27 - CR-06: the lease's epochFile/supervisorDir and the settled binary path all reach stockConnect as deps
  ---
  duration_ms: 0.269251
  type: 'test'
  ...
# Subtest: CR-06: the epoch path is the per-instance epoch.json, NOT the top-level supervisor dir -- the two are threaded independently
ok 28 - CR-06: the epoch path is the per-instance epoch.json, NOT the top-level supervisor dir -- the two are threaded independently
  ---
  duration_ms: 0.373757
  type: 'test'
  ...
# Subtest: CR-06: an empty lease field is threaded as ABSENT, never as an empty-string path
ok 29 - CR-06: an empty lease field is threaded as ABSENT, never as an empty-string path
  ---
  duration_ms: 0.347916
  type: 'test'
  ...
# ensureStockSession: tearing down the replaced stock session for target grant-1 did not complete: Error: test: broker refused the release
# Subtest: CR-06: the real stockConnect, driven against a loopback binmon stub through ensureStockSession, records a non-null baselineEpoch
ok 30 - CR-06: the real stockConnect, driven against a loopback binmon stub through ensureStockSession, records a non-null baselineEpoch
  ---
  duration_ms: 50.159869
  type: 'test'
  ...
# Subtest: CR-05: a replacement acquisition disconnects the replaced session and releases ITS monitor claim, naming the old targetId
ok 31 - CR-05: a replacement acquisition disconnects the replaced session and releases ITS monitor claim, naming the old targetId
  ---
  duration_ms: 0.725151
  type: 'test'
  ...
# Subtest: CR-05: a teardown failure on the replaced session does not stop the replacement handshake, and never leaves the dead session held
ok 32 - CR-05: a teardown failure on the replaced session does not stop the replacement handshake, and never leaves the dead session held
  ---
  duration_ms: 0.686934
  type: 'test'
  ...
# Subtest: WR-03: a fresh handshake for a NEW targetId evicts the abandoned target's condition-registry entry
ok 33 - WR-03: a fresh handshake for a NEW targetId evicts the abandoned target's condition-registry entry
  ---
  duration_ms: 2.388504
  type: 'test'
  ...
# Subtest: WR-03: reusing the held session for the SAME targetId never evicts its conditions
ok 34 - WR-03: reusing the held session for the SAME targetId never evicts its conditions
  ---
  duration_ms: 0.730492
  type: 'test'
  ...
# Subtest: CR-05: a FIRST acquisition with nothing held releases nothing -- no spurious releaseMonitor
ok 35 - CR-05: a FIRST acquisition with nothing held releases nothing -- no spurious releaseMonitor
  ---
  duration_ms: 0.442528
  type: 'test'
  ...
# Subtest: lease: a held session whose socket has closed is re-established via stockReconnect, not silently reused
ok 36 - lease: a held session whose socket has closed is re-established via stockReconnect, not silently reused
  ---
  duration_ms: 0.499283
  type: 'test'
  ...
# Subtest: lease: MachineRestartedError out of a held session's reconnect clears the holder so the next call re-handshakes
ok 37 - lease: MachineRestartedError out of a held session's reconnect clears the holder so the next call re-handshakes
  ---
  duration_ms: 1.101119
  type: 'test'
  ...
# Subtest: runState/Pitfall4: a fresh connect attaches exactly one 'event' listener to the new client
ok 38 - runState/Pitfall4: a fresh connect attaches exactly one 'event' listener to the new client
  ---
  duration_ms: 0.308829
  type: 'test'
  ...
# Subtest: runState/Pitfall4: a session-reuse call (same targetId, still connected) does NOT add a second listener
ok 39 - runState/Pitfall4: a session-reuse call (same targetId, still connected) does NOT add a second listener
  ---
  duration_ms: 0.324462
  type: 'test'
  ...
# Subtest: runState/Pitfall4: a reconnect (socket dead) attaches exactly one listener to the NEW client from stockReconnect
ok 40 - runState/Pitfall4: a reconnect (socket dead) attaches exactly one listener to the NEW client from stockReconnect
  ---
  duration_ms: 0.364255
  type: 'test'
  ...
# Subtest: withStockSession: returns convertHandshakeError's text when ensureStockSession throws MonitorOwnershipError
ok 41 - withStockSession: returns convertHandshakeError's text when ensureStockSession throws MonitorOwnershipError
  ---
  duration_ms: 0.675
  type: 'test'
  ...
# Subtest: withStockSession: returns outcome.message verbatim on an { ok: false } refusal, without touching the handler
ok 42 - withStockSession: returns outcome.message verbatim on an { ok: false } refusal, without touching the handler
  ---
  duration_ms: 0.297086
  type: 'test'
  ...
# Subtest: withStockSession: a family handler that throws yields isError:true rather than propagating
ok 43 - withStockSession: a family handler that throws yields isError:true rather than propagating
  ---
  duration_ms: 0.510743
  type: 'test'
  ...
# Subtest: dispatch: stockHandlerFor("vice_ping") returns a handler; stockHandlerFor("vice_mem_read") returns undefined
ok 44 - dispatch: stockHandlerFor("vice_ping") returns a handler; stockHandlerFor("vice_mem_read") returns undefined
  ---
  duration_ms: 0.17136
  type: 'test'
  ...
# Subtest: dispatch: stockHandlerFor returns a function for every one of the 38 registered tool names
ok 45 - dispatch: stockHandlerFor returns a function for every one of the 38 registered tool names
  ---
  duration_ms: 0.209371
  type: 'test'
  ...
# Subtest: dispatch: the table's key count is exactly 38
ok 46 - dispatch: the table's key count is exactly 38
  ---
  duration_ms: 0.205523
  type: 'test'
  ...
# Subtest: dispatch: every registered tool name matches /^vice_[a-z0-9_]+$/
ok 47 - dispatch: every registered tool name matches /^vice_[a-z0-9_]+$/
  ---
  duration_ms: 0.414023
  type: 'test'
  ...
# Subtest: dispatch: stockHandlerFor returns undefined for every deliberately-absent tool name
ok 48 - dispatch: stockHandlerFor returns undefined for every deliberately-absent tool name
  ---
  duration_ms: 0.210653
  type: 'test'
  ...
# Subtest: dispatch: dispatchStock refuses every deliberately-absent tool with the exact message capabilityRefusalMessage() renders (WR-13), without reading deps
ok 49 - dispatch: dispatchStock refuses every deliberately-absent tool with the exact message capabilityRefusalMessage() renders (WR-13), without reading deps
  ---
  duration_ms: 0.949092
  type: 'test'
  ...
# Subtest: refus: dispatchStock on a fork-only hardware tool (vice_sid_get_state) refuses with capabilityRefusalMessage()'s exact text, never calls forwardToVice, and never touches deps (WR-13)
ok 50 - refus: dispatchStock on a fork-only hardware tool (vice_sid_get_state) refuses with capabilityRefusalMessage()'s exact text, never calls forwardToVice, and never touches deps (WR-13)
  ---
  duration_ms: 0.385734
  type: 'test'
  ...
# Subtest: refus: dispatchStock on a name absent from BOTH manifests (no registry entry) falls back to the internal-inconsistency message, never a false backend claim (WR-13)
ok 51 - refus: dispatchStock on a name absent from BOTH manifests (no registry entry) falls back to the internal-inconsistency message, never a false backend claim (WR-13)
  ---
  duration_ms: 0.35211
  type: 'test'
  ...
# Subtest: refus: dispatchStock never returns a success shape for an unknown tool name
ok 52 - refus: dispatchStock never returns a success shape for an unknown tool name
  ---
  duration_ms: 0.268603
  type: 'test'
  ...
# Subtest: ping: dispatchStock("vice_ping", ...) calls deps.ensureLease exactly once and deps.connect receives the exact lease fields
ok 53 - ping: dispatchStock("vice_ping", ...) calls deps.ensureLease exactly once and deps.connect receives the exact lease fields
  ---
  duration_ms: 0.68092
  type: 'test'
  ...
# Subtest: ping: a failing ensureLease yields isError:true carrying the provider's message and never calls connect
ok 54 - ping: a failing ensureLease yields isError:true carrying the provider's message and never calls connect
  ---
  duration_ms: 0.311677
  type: 'test'
  ...
# Subtest: ping: the success payload carries backend, viceVersion, resolvedBinaryPath, and runState (D-06)
ok 55 - ping: the success payload carries backend, viceVersion, resolvedBinaryPath, and runState (D-06)
  ---
  duration_ms: 0.426536
  type: 'test'
  ...
# Subtest: WR-05 ping: an UNRESOLVED binary path is reported as such, so a bare name is never presented as a resolved path
ok 56 - WR-05 ping: an UNRESOLVED binary path is reported as such, so a bare name is never presented as a resolved path
  ---
  duration_ms: 0.34274
  type: 'test'
  ...
# Subtest: WR-05 ping: the resolution flag defaults to false when nothing said otherwise
ok 57 - WR-05 ping: the resolution flag defaults to false when nothing said otherwise
  ---
  duration_ms: 0.341724
  type: 'test'
  ...
# Subtest: WR-06: a connect REFUSAL on the stock path names VICE_BROKER_BINMON_HOST and the loopback default
ok 58 - WR-06: a connect REFUSAL on the stock path names VICE_BROKER_BINMON_HOST and the loopback default
  ---
  duration_ms: 0.54585
  type: 'test'
  ...
# Subtest: WR-06: a non-connect handshake failure keeps the plain wording -- the binmon-host advice is not sprayed over unrelated causes
ok 59 - WR-06: a non-connect handshake failure keeps the plain wording -- the binmon-host advice is not sprayed over unrelated causes
  ---
  duration_ms: 0.448411
  type: 'test'
  ...
# Subtest: WR-06: vice-proxy.ts strips the WHATWG bracket form when deriving the dial host, so an IPv6 URL is usable by net.connect()
ok 60 - WR-06: vice-proxy.ts strips the WHATWG bracket form when deriving the dial host, so an IPv6 URL is usable by net.connect()
  ---
  duration_ms: 0.428257
  type: 'test'
  ...
# Subtest: ping: a MonitorOwnershipError from the handshake becomes isError:true naming the holder, without wedge/hung/unresponsive language
ok 61 - ping: a MonitorOwnershipError from the handshake becomes isError:true naming the holder, without wedge/hung/unresponsive language
  ---
  duration_ms: 0.480954
  type: 'test'
  ...
# Subtest: ping: a MachineRestartedError from the handshake becomes isError:true distinguishable from a provider-timeout message
ok 62 - ping: a MachineRestartedError from the handshake becomes isError:true distinguishable from a provider-timeout message
  ---
  duration_ms: 0.571283
  type: 'test'
  ...
# Subtest: dispatch: no handler in the table ever throws -- dispatchStock always resolves to a well-formed {content,isError} result
ok 63 - dispatch: no handler in the table ever throws -- dispatchStock always resolves to a well-formed {content,isError} result
  ---
  duration_ms: 0.291841
  type: 'test'
  ...
# Subtest: structure/proxy: vice-proxy.ts has exactly one dispatchStock CALL SITE
ok 64 - structure/proxy: vice-proxy.ts has exactly one dispatchStock CALL SITE
  ---
  duration_ms: 0.41726
  type: 'test'
  ...
# Subtest: structure/proxy: vice-proxy.ts's dispatchStock call site passes ensureBrokerLease as its LeaseProvider
ok 65 - structure/proxy: vice-proxy.ts's dispatchStock call site passes ensureBrokerLease as its LeaseProvider
  ---
  duration_ms: 0.415716
  type: 'test'
  ...
# Subtest: structure/proxy: vice-proxy.ts references manifestPathForBackend exactly once
ok 66 - structure/proxy: vice-proxy.ts references manifestPathForBackend exactly once
  ---
  duration_ms: 0.830691
  type: 'test'
  ...
# Subtest: structure/proxy: vice-proxy.ts's ensureBrokerLease has at least two lease-bearing success returns
ok 67 - structure/proxy: vice-proxy.ts's ensureBrokerLease has at least two lease-bearing success returns
  ---
  duration_ms: 0.374514
  type: 'test'
  ...
# Subtest: structure/proxy: no code line in vice-proxy.ts pairs "stock" with "forwardToVice"
ok 68 - structure/proxy: no code line in vice-proxy.ts pairs "stock" with "forwardToVice"
  ---
  duration_ms: 0.621091
  type: 'test'
  ...
# Subtest: structure/proxy (CR-07): every registered tool whose runner can touch a transport goes through buildBackendAwareTool
ok 69 - structure/proxy (CR-07): every registered tool whose runner can touch a transport goes through buildBackendAwareTool
  ---
  duration_ms: 0.833881
  type: 'test'
  ...
# Subtest: structure/proxy (CR-07): the synthetic tools are all registered, and the only registrations bypassing the backend-aware seam are vice_result_continue and the anno_* family
ok 70 - structure/proxy (CR-07): the synthetic tools are all registered, and the only registrations bypassing the backend-aware seam are vice_result_continue and the anno_* family
  ---
  duration_ms: 0.572794
  type: 'test'
  ...
# Subtest: structure/proxy (CR-07): vice_result_continue's runner is handleResultContinue, whose body touches no transport at all
ok 71 - structure/proxy (CR-07): vice_result_continue's runner is handleResultContinue, whose body touches no transport at all
  ---
  duration_ms: 0.553817
  type: 'test'
  ...
# Subtest: structure/proxy (plan 29-01): the anno_* loop registration's runner is runAnnoTool, whose body touches no VICE transport at all
ok 72 - structure/proxy (plan 29-01): the anno_* loop registration's runner is runAnnoTool, whose body touches no VICE transport at all
  ---
  duration_ms: 0.608282
  type: 'test'
  ...
# Subtest: structure/proxy (plan 29-01): every curated anno_* name is absent from BOTH tools-manifest.json and tools-manifest.stock.json
ok 73 - structure/proxy (plan 29-01): every curated anno_* name is absent from BOTH tools-manifest.json and tools-manifest.stock.json
  ---
  duration_ms: 1.483708
  type: 'test'
  ...
# Subtest: structure/proxy (CR-07): buildBackendAwareTool routes the non-fork backend to dispatchStock, and that is the only dispatch site
ok 74 - structure/proxy (CR-07): buildBackendAwareTool routes the non-fork backend to dispatchStock, and that is the only dispatch site
  ---
  duration_ms: 0.283575
  type: 'test'
  ...
# Subtest: structure/proxy (CR-07): handleDiagnose and handleRecycle are each referenced by exactly one registration, and it is backend-aware
ok 75 - structure/proxy (CR-07): handleDiagnose and handleRecycle are each referenced by exactly one registration, and it is backend-aware
  ---
  duration_ms: 0.585388
  type: 'test'
  ...
# Subtest: structure/proxy: vice-proxy.ts CALLS resolvedBackend() exactly once
ok 76 - structure/proxy: vice-proxy.ts CALLS resolvedBackend() exactly once
  ---
  duration_ms: 0.477752
  type: 'test'
  ...
# Subtest: structure/proxy (WR-04): ensureBrokerLease() compares the broker's own backend verdict against ACTIVE_BACKEND and refuses a definite mismatch
ok 77 - structure/proxy (WR-04): ensureBrokerLease() compares the broker's own backend verdict against ACTIVE_BACKEND and refuses a definite mismatch
  ---
  duration_ms: 0.300926
  type: 'test'
  ...
# Subtest: structure/proxy (CR-06): buildHeldLease() threads epochFile and supervisorDir, from activeInstance() and brokerRootDir() respectively
ok 78 - structure/proxy (CR-06): buildHeldLease() threads epochFile and supervisorDir, from activeInstance() and brokerRootDir() respectively
  ---
  duration_ms: 0.332865
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_memory_read", ...) answers, validating against its own declared outputSchema
ok 79 - conformance (D-02): dispatchStock("vice_memory_read", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.733146
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_memory_write", ...) answers, validating against its own declared outputSchema
ok 80 - conformance (D-02): dispatchStock("vice_memory_write", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.88743
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_memory_banks", ...) answers, validating against its own declared outputSchema
ok 81 - conformance (D-02): dispatchStock("vice_memory_banks", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 3.094744
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_memory_search", ...) answers, validating against its own declared outputSchema
ok 82 - conformance (D-02): dispatchStock("vice_memory_search", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.097829
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_memory_compare", ...) answers, validating against its own declared outputSchema
ok 83 - conformance (D-02): dispatchStock("vice_memory_compare", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.665342
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_registers_get", ...) answers, validating against its own declared outputSchema
ok 84 - conformance (D-02): dispatchStock("vice_registers_get", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.525236
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_registers_set", ...) answers, validating against its own declared outputSchema
ok 85 - conformance (D-02): dispatchStock("vice_registers_set", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.657881
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_registers_available", ...) answers, validating against its own declared outputSchema
ok 86 - conformance (D-02): dispatchStock("vice_registers_available", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.416306
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_checkpoint_add", ...) answers, validating against its own declared outputSchema
ok 87 - conformance (D-02): dispatchStock("vice_checkpoint_add", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.73704
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_checkpoint_delete", ...) answers, validating against its own declared outputSchema
ok 88 - conformance (D-02): dispatchStock("vice_checkpoint_delete", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.349833
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_checkpoint_list", ...) answers, validating against its own declared outputSchema
ok 89 - conformance (D-02): dispatchStock("vice_checkpoint_list", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.530073
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_checkpoint_toggle", ...) answers, validating against its own declared outputSchema
ok 90 - conformance (D-02): dispatchStock("vice_checkpoint_toggle", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.263232
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_checkpoint_set_condition", ...) answers, validating against its own declared outputSchema
ok 91 - conformance (D-02): dispatchStock("vice_checkpoint_set_condition", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.174249
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_watch_add", ...) answers, validating against its own declared outputSchema
ok 92 - conformance (D-02): dispatchStock("vice_watch_add", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.401108
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_execution_pause", ...) answers, validating against its own declared outputSchema
ok 93 - conformance (D-02): dispatchStock("vice_execution_pause", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 26.295931
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_execution_run", ...) answers, validating against its own declared outputSchema
ok 94 - conformance (D-02): dispatchStock("vice_execution_run", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.029327
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_execution_step", ...) answers, validating against its own declared outputSchema
ok 95 - conformance (D-02): dispatchStock("vice_execution_step", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.375536
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_execution_until_return", ...) answers, validating against its own declared outputSchema
ok 96 - conformance (D-02): dispatchStock("vice_execution_until_return", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.028998
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_machine_reset", ...) answers, validating against its own declared outputSchema
ok 97 - conformance (D-02): dispatchStock("vice_machine_reset", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 0.903337
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_autostart", ...) answers, validating against its own declared outputSchema
ok 98 - conformance (D-02): dispatchStock("vice_autostart", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.211604
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_disk_attach", ...) answers, validating against its own declared outputSchema
ok 99 - conformance (D-02): dispatchStock("vice_disk_attach", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 0.87948
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_snapshot_save", ...) answers, validating against its own declared outputSchema
ok 100 - conformance (D-02): dispatchStock("vice_snapshot_save", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.617784
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_snapshot_load", ...) answers, validating against its own declared outputSchema
ok 101 - conformance (D-02): dispatchStock("vice_snapshot_load", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.6435
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_keyboard_type", ...) answers, validating against its own declared outputSchema
ok 102 - conformance (D-02): dispatchStock("vice_keyboard_type", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.180727
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_keyboard_petscii", ...) answers, validating against its own declared outputSchema
ok 103 - conformance (D-02): dispatchStock("vice_keyboard_petscii", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 0.859097
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_joystick_set", ...) answers, validating against its own declared outputSchema
ok 104 - conformance (D-02): dispatchStock("vice_joystick_set", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 0.944905
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_disassemble", ...) answers, validating against its own declared outputSchema
ok 105 - conformance (D-02): dispatchStock("vice_disassemble", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.049445
  type: 'test'
  ...
# Subtest: end-to-end (criterion 1, D-02): vice_disassemble succeeds through the REAL dispatchStock() path under a translating environment -- the derived path never reaches host-path translation
ok 106 - end-to-end (criterion 1, D-02): vice_disassemble succeeds through the REAL dispatchStock() path under a translating environment -- the derived path never reaches host-path translation
  ---
  duration_ms: 0.420639
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_symbols_load", ...) answers, validating against its own declared outputSchema
ok 107 - conformance (D-02): dispatchStock("vice_symbols_load", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.82926
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_symbols_lookup", ...) answers, validating against its own declared outputSchema
ok 108 - conformance (D-02): dispatchStock("vice_symbols_lookup", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.338823
  type: 'test'
  ...
# Subtest: end-to-end (criterion 1, D-02): vice_symbols_load succeeds through the REAL dispatchStock() path under a translating environment -- resolvedPath stays container-side
ok 109 - end-to-end (criterion 1, D-02): vice_symbols_load succeeds through the REAL dispatchStock() path under a translating environment -- resolvedPath stays container-side
  ---
  duration_ms: 0.562198
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_vicii_get_state", ...) answers, validating against its own declared outputSchema
ok 110 - conformance (D-02): dispatchStock("vice_vicii_get_state", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.810497
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_cia_get_state", ...) answers, validating against its own declared outputSchema
ok 111 - conformance (D-02): dispatchStock("vice_cia_get_state", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.334809
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_sprite_get", ...) answers, validating against its own declared outputSchema
ok 112 - conformance (D-02): dispatchStock("vice_sprite_get", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.73925
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_sprite_inspect", ...) answers, validating against its own declared outputSchema
ok 113 - conformance (D-02): dispatchStock("vice_sprite_inspect", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.702717
  type: 'test'
  ...
# Subtest: structure: stock-dispatch.ts contains zero CODE references to the fork-forwarding function's name, pairing the vice-proxy.ts structural assertion above with this module's own
ok 114 - structure: stock-dispatch.ts contains zero CODE references to the fork-forwarding function's name, pairing the vice-proxy.ts structural assertion above with this module's own
  ---
  duration_ms: 0.513399
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_ping", ...) answers, validating against its own declared outputSchema
ok 115 - conformance (D-02): dispatchStock("vice_ping", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 0.797711
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_cycles_stopwatch", ...) answers, validating against its own declared outputSchema
ok 116 - conformance (D-02): dispatchStock("vice_cycles_stopwatch", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.552212
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_run_until", ...) answers, validating against its own declared outputSchema
ok 117 - conformance (D-02): dispatchStock("vice_run_until", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 26.906485
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_diagnose", ...) answers, validating against its own declared outputSchema
ok 118 - conformance (D-02): dispatchStock("vice_diagnose", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 3.755509
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_recycle", ...) answers, validating against its own declared outputSchema
ok 119 - conformance (D-02): dispatchStock("vice_recycle", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 11.59847
  type: 'test'
  ...
# Subtest: regression (Phase 7, TIME-04): stockHandlerFor resolves both proxy-local tools -- a stock call no longer reaches dispatchStock()'s refuse-by-name branch
ok 120 - regression (Phase 7, TIME-04): stockHandlerFor resolves both proxy-local tools -- a stock call no longer reaches dispatchStock()'s refuse-by-name branch
  ---
  duration_ms: 0.599156
  type: 'test'
  ...
# Subtest: conformance (D-02) completeness guard: CONFORMANCE_TOOL_NAMES covers exactly the stock manifest's tool names
ok 121 - conformance (D-02) completeness guard: CONFORMANCE_TOOL_NAMES covers exactly the stock manifest's tool names
  ---
  duration_ms: 0.878255
  type: 'test'
  ...
# Subtest: conformance (D-02) negative control: checkAgainstSchema rejects a deliberately wrong answer, proving the checker is not vacuous
ok 122 - conformance (D-02) negative control: checkAgainstSchema rejects a deliberately wrong answer, proving the checker is not vacuous
  ---
  duration_ms: 0.844341
  type: 'test'
  ...
# Subtest: withDerivedTool: an undeclared tool name is refused by name, without ever reaching ensureLease
ok 123 - withDerivedTool: an undeclared tool name is refused by name, without ever reaching ensureLease
  ---
  duration_ms: 0.246037
  type: 'test'
  ...
# Subtest: withDerivedTool: needsSession:false invokes the handler with (args, deps) and never calls ensureLease
ok 124 - withDerivedTool: needsSession:false invokes the handler with (args, deps) and never calls ensureLease
  ---
  duration_ms: 0.243487
  type: 'test'
  ...
# Subtest: withDerivedTool: needsSession:true delegates to ensureStockSession and hands the handler the resolved session
ok 125 - withDerivedTool: needsSession:true delegates to ensureStockSession and hands the handler the resolved session
  ---
  duration_ms: 0.333643
  type: 'test'
  ...
# Subtest: withDerivedTool: a handler that throws is converted via convertWireError, not propagated
ok 126 - withDerivedTool: a handler that throws is converted via convertWireError, not propagated
  ---
  duration_ms: 0.289571
  type: 'test'
  ...
# Subtest: withDerivedTool: needsSession:true converts a handshake failure via convertHandshakeError, naming the tool
ok 127 - withDerivedTool: needsSession:true converts a handshake failure via convertHandshakeError, naming the tool
  ---
  duration_ms: 0.358102
  type: 'test'
  ...
# Subtest: withDerivedTool: needsSession:true returns an { ok: false } lease refusal verbatim, without touching the handler
ok 128 - withDerivedTool: needsSession:true returns an { ok: false } lease refusal verbatim, without touching the handler
  ---
  duration_ms: 0.256087
  type: 'test'
  ...
# Subtest: invariant (WR-13): no shipped module outside capability-registry.ts hardcodes a fork-provides refusal claim
ok 129 - invariant (WR-13): no shipped module outside capability-registry.ts hardcodes a fork-provides refusal claim
  ---
  duration_ms: 18.356403
  type: 'test'
  ...
# Subtest: invariant (WR-13): no shipped module outside capability-registry.ts pairs future-phase framing with a VICE_BACKEND selection instruction
ok 130 - invariant (WR-13): no shipped module outside capability-registry.ts pairs future-phase framing with a VICE_BACKEND selection instruction
  ---
  duration_ms: 14.647628
  type: 'test'
  ...
1..130
# tests 130
# suites 0
# pass 130
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 599.37836
```

### Planted run

- **Plant:** `src/mcp/vice/anno-tools.ts`: `    assertAnnoTool(name, args);` → `    assertAnnoTool(name, args); // forwardToVice`
- **Planted command:** `node --test stock-dispatch.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# (node:64551) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: manifest/backend: fork with no override resolves to <hereDir>/tools-manifest.json
ok 1 - manifest/backend: fork with no override resolves to <hereDir>/tools-manifest.json
  ---
  duration_ms: 4.326826
  type: 'test'
  ...
# Subtest: manifest/backend: stock with no override resolves to <hereDir>/tools-manifest.stock.json
ok 2 - manifest/backend: stock with no override resolves to <hereDir>/tools-manifest.stock.json
  ---
  duration_ms: 0.441719
  type: 'test'
  ...
# Subtest: manifest/backend: VICE_TOOLS_MANIFEST override wins for the fork backend, resolved
ok 3 - manifest/backend: VICE_TOOLS_MANIFEST override wins for the fork backend, resolved
  ---
  duration_ms: 0.558057
  type: 'test'
  ...
# Subtest: manifest/backend: VICE_TOOLS_MANIFEST override wins for the stock backend too -- same override, same resolved path
ok 4 - manifest/backend: VICE_TOOLS_MANIFEST override wins for the stock backend too -- same override, same resolved path
  ---
  duration_ms: 0.385341
  type: 'test'
  ...
# Subtest: manifest/backend: tools-manifest.stock.json parses and carries the same three top-level keys as the fork manifest
ok 5 - manifest/backend: tools-manifest.stock.json parses and carries the same three top-level keys as the fork manifest
  ---
  duration_ms: 2.979196
  type: 'test'
  ...
# Subtest: manifest/backend: tools-manifest.stock.json's tools array contains a vice_ping entry
ok 6 - manifest/backend: tools-manifest.stock.json's tools array contains a vice_ping entry
  ---
  duration_ms: 1.441421
  type: 'test'
  ...
# Subtest: manifest/backend (D-03 name coverage): every non-stock-only, non-proxy-local stock tool has a fork counterpart; every STOCK_ONLY_TOOLS name is stock-only
ok 7 - manifest/backend (D-03 name coverage): every non-stock-only, non-proxy-local stock tool has a fork counterpart; every STOCK_ONLY_TOOLS name is stock-only
  ---
  duration_ms: 2.837722
  type: 'test'
  ...
# Subtest: WR-07/resolveAdvertisedToolDefinition (stock, real manifest): vice_diagnose's resolved description drops stale_read_path and names monitor_held_elsewhere
ok 8 - WR-07/resolveAdvertisedToolDefinition (stock, real manifest): vice_diagnose's resolved description drops stale_read_path and names monitor_held_elsewhere
  ---
  duration_ms: 1.37391
  type: 'test'
  ...
# Subtest: WR-07/resolveAdvertisedToolDefinition (stock, real manifest): vice_diagnose's resolved outputSchema.verdict.enum is exactly D-03's five values, in order
ok 9 - WR-07/resolveAdvertisedToolDefinition (stock, real manifest): vice_diagnose's resolved outputSchema.verdict.enum is exactly D-03's five values, in order
  ---
  duration_ms: 2.409261
  type: 'test'
  ...
# Subtest: WR-07/resolveAdvertisedToolDefinition (stock, real manifest): vice_recycle's resolved description states the stock incident record carries no screenshot (D-01)
ok 10 - WR-07/resolveAdvertisedToolDefinition (stock, real manifest): vice_recycle's resolved description states the stock incident record carries no screenshot (D-01)
  ---
  duration_ms: 1.507747
  type: 'test'
  ...
# Subtest: WR-07/resolveAdvertisedToolDefinition (fork): both names resolve to the synthetic stand-in, byte-identical -- the fork's advertised surface is untouched
ok 11 - WR-07/resolveAdvertisedToolDefinition (fork): both names resolve to the synthetic stand-in, byte-identical -- the fork's advertised surface is untouched
  ---
  duration_ms: 1.246787
  type: 'test'
  ...
# Subtest: WR-07/resolveAdvertisedToolDefinition (stock, empty/malformed manifest): both names fall back to the synthetic stand-in rather than advertising nothing
ok 12 - WR-07/resolveAdvertisedToolDefinition (stock, empty/malformed manifest): both names fall back to the synthetic stand-in rather than advertising nothing
  ---
  duration_ms: 0.320933
  type: 'test'
  ...
# Subtest: WR-07/resolveAdvertisedToolDefinition (guard): every PROXY_LOCAL_TOOLS name resolves to its OWN stock manifest entry, tying the source and manifest levels together
ok 13 - WR-07/resolveAdvertisedToolDefinition (guard): every PROXY_LOCAL_TOOLS name resolves to its OWN stock manifest entry, tying the source and manifest levels together
  ---
  duration_ms: 1.220107
  type: 'test'
  ...
# Subtest: manifest/backend (D-03 input compatibility): every stock/fork pair has equal required-argument SETS, and stock's extra properties are all optional on the fork side
ok 14 - manifest/backend (D-03 input compatibility): every stock/fork pair has equal required-argument SETS, and stock's extra properties are all optional on the fork side
  ---
  duration_ms: 2.765043
  type: 'test'
  ...
# Subtest: manifest/backend (bidirectional table/manifest agreement): every stock manifest entry has a dispatch handler, and every dispatch entry has a manifest entry
ok 15 - manifest/backend (bidirectional table/manifest agreement): every stock manifest entry has a dispatch handler, and every dispatch entry has a manifest entry
  ---
  duration_ms: 1.346444
  type: 'test'
  ...
# Subtest: manifest/backend (D-02 outputSchema presence): every stock manifest entry declares an outputSchema whose type is "object"
ok 16 - manifest/backend (D-02 outputSchema presence): every stock manifest entry declares an outputSchema whose type is "object"
  ---
  duration_ms: 1.181366
  type: 'test'
  ...
# Subtest: manifest/backend (D-06 runState enum): every stock entry's outputSchema declares a required runState enum of ["running","stopped","unknown"]
ok 17 - manifest/backend (D-06 runState enum): every stock entry's outputSchema declares a required runState enum of ["running","stopped","unknown"]
  ---
  duration_ms: 1.307084
  type: 'test'
  ...
# Subtest: manifest/backend: every outputSchema itself uses only checkAgainstSchema's supported keyword subset
ok 18 - manifest/backend: every outputSchema itself uses only checkAgainstSchema's supported keyword subset
  ---
  duration_ms: 5.386751
  type: 'test'
  ...
# Subtest: manifest/backend (trimmed tools absent): none of the twelve decision-trimmed tools appears in tools-manifest.stock.json
ok 19 - manifest/backend (trimmed tools absent): none of the twelve decision-trimmed tools appears in tools-manifest.stock.json
  ---
  duration_ms: 1.30372
  type: 'test'
  ...
# Subtest: manifest/backend: no DENY_LIST name appears in tools-manifest.stock.json
ok 20 - manifest/backend: no DENY_LIST name appears in tools-manifest.stock.json
  ---
  duration_ms: 1.000053
  type: 'test'
  ...
# Subtest: lease: ensureLease is awaited strictly before stockConnect is ever called (lease-before-connect ordering)
ok 21 - lease: ensureLease is awaited strictly before stockConnect is ever called (lease-before-connect ordering)
  ---
  duration_ms: 1.056146
  type: 'test'
  ...
# Subtest: lease: stockConnect receives the exact host/port/targetId/brokerControl the lease provider returned
ok 22 - lease: stockConnect receives the exact host/port/targetId/brokerControl the lease provider returned
  ---
  duration_ms: 0.475004
  type: 'test'
  ...
# Subtest: lease: a provider failure never calls stockConnect and its message passes through verbatim
ok 23 - lease: a provider failure never calls stockConnect and its message passes through verbatim
  ---
  duration_ms: 0.342665
  type: 'test'
  ...
# Subtest: lease: a lease of null (the VICE_MCP_URL override) never calls stockConnect and names VICE_MCP_URL in the refusal
ok 24 - lease: a lease of null (the VICE_MCP_URL override) never calls stockConnect and names VICE_MCP_URL in the refusal
  ---
  duration_ms: 0.488246
  type: 'test'
  ...
# Subtest: lease: two successive calls with the same targetId call stockConnect exactly once -- the held session is reused
ok 25 - lease: two successive calls with the same targetId call stockConnect exactly once -- the held session is reused
  ---
  duration_ms: 0.493935
  type: 'test'
  ...
# Subtest: lease: a replacement acquisition naming a different targetId calls stockConnect a second time
ok 26 - lease: a replacement acquisition naming a different targetId calls stockConnect a second time
  ---
  duration_ms: 0.696705
  type: 'test'
  ...
# Subtest: CR-06: the lease's epochFile/supervisorDir and the settled binary path all reach stockConnect as deps
ok 27 - CR-06: the lease's epochFile/supervisorDir and the settled binary path all reach stockConnect as deps
  ---
  duration_ms: 0.533137
  type: 'test'
  ...
# Subtest: CR-06: the epoch path is the per-instance epoch.json, NOT the top-level supervisor dir -- the two are threaded independently
ok 28 - CR-06: the epoch path is the per-instance epoch.json, NOT the top-level supervisor dir -- the two are threaded independently
  ---
  duration_ms: 0.693506
  type: 'test'
  ...
# Subtest: CR-06: an empty lease field is threaded as ABSENT, never as an empty-string path
ok 29 - CR-06: an empty lease field is threaded as ABSENT, never as an empty-string path
  ---
  duration_ms: 0.562054
  type: 'test'
  ...
# ensureStockSession: tearing down the replaced stock session for target grant-1 did not complete: Error: test: broker refused the release
# Subtest: CR-06: the real stockConnect, driven against a loopback binmon stub through ensureStockSession, records a non-null baselineEpoch
ok 30 - CR-06: the real stockConnect, driven against a loopback binmon stub through ensureStockSession, records a non-null baselineEpoch
  ---
  duration_ms: 35.284087
  type: 'test'
  ...
# Subtest: CR-05: a replacement acquisition disconnects the replaced session and releases ITS monitor claim, naming the old targetId
ok 31 - CR-05: a replacement acquisition disconnects the replaced session and releases ITS monitor claim, naming the old targetId
  ---
  duration_ms: 0.425641
  type: 'test'
  ...
# Subtest: CR-05: a teardown failure on the replaced session does not stop the replacement handshake, and never leaves the dead session held
ok 32 - CR-05: a teardown failure on the replaced session does not stop the replacement handshake, and never leaves the dead session held
  ---
  duration_ms: 0.409348
  type: 'test'
  ...
# Subtest: WR-03: a fresh handshake for a NEW targetId evicts the abandoned target's condition-registry entry
ok 33 - WR-03: a fresh handshake for a NEW targetId evicts the abandoned target's condition-registry entry
  ---
  duration_ms: 1.796175
  type: 'test'
  ...
# Subtest: WR-03: reusing the held session for the SAME targetId never evicts its conditions
ok 34 - WR-03: reusing the held session for the SAME targetId never evicts its conditions
  ---
  duration_ms: 0.508553
  type: 'test'
  ...
# Subtest: CR-05: a FIRST acquisition with nothing held releases nothing -- no spurious releaseMonitor
ok 35 - CR-05: a FIRST acquisition with nothing held releases nothing -- no spurious releaseMonitor
  ---
  duration_ms: 0.287755
  type: 'test'
  ...
# Subtest: lease: a held session whose socket has closed is re-established via stockReconnect, not silently reused
ok 36 - lease: a held session whose socket has closed is re-established via stockReconnect, not silently reused
  ---
  duration_ms: 0.250304
  type: 'test'
  ...
# Subtest: lease: MachineRestartedError out of a held session's reconnect clears the holder so the next call re-handshakes
ok 37 - lease: MachineRestartedError out of a held session's reconnect clears the holder so the next call re-handshakes
  ---
  duration_ms: 0.647184
  type: 'test'
  ...
# Subtest: runState/Pitfall4: a fresh connect attaches exactly one 'event' listener to the new client
ok 38 - runState/Pitfall4: a fresh connect attaches exactly one 'event' listener to the new client
  ---
  duration_ms: 0.160244
  type: 'test'
  ...
# Subtest: runState/Pitfall4: a session-reuse call (same targetId, still connected) does NOT add a second listener
ok 39 - runState/Pitfall4: a session-reuse call (same targetId, still connected) does NOT add a second listener
  ---
  duration_ms: 0.138735
  type: 'test'
  ...
# Subtest: runState/Pitfall4: a reconnect (socket dead) attaches exactly one listener to the NEW client from stockReconnect
ok 40 - runState/Pitfall4: a reconnect (socket dead) attaches exactly one listener to the NEW client from stockReconnect
  ---
  duration_ms: 0.161638
  type: 'test'
  ...
# Subtest: withStockSession: returns convertHandshakeError's text when ensureStockSession throws MonitorOwnershipError
ok 41 - withStockSession: returns convertHandshakeError's text when ensureStockSession throws MonitorOwnershipError
  ---
  duration_ms: 0.382962
  type: 'test'
  ...
# Subtest: withStockSession: returns outcome.message verbatim on an { ok: false } refusal, without touching the handler
ok 42 - withStockSession: returns outcome.message verbatim on an { ok: false } refusal, without touching the handler
  ---
  duration_ms: 0.156538
  type: 'test'
  ...
# Subtest: withStockSession: a family handler that throws yields isError:true rather than propagating
ok 43 - withStockSession: a family handler that throws yields isError:true rather than propagating
  ---
  duration_ms: 0.253776
  type: 'test'
  ...
# Subtest: dispatch: stockHandlerFor("vice_ping") returns a handler; stockHandlerFor("vice_mem_read") returns undefined
ok 44 - dispatch: stockHandlerFor("vice_ping") returns a handler; stockHandlerFor("vice_mem_read") returns undefined
  ---
  duration_ms: 0.080904
  type: 'test'
  ...
# Subtest: dispatch: stockHandlerFor returns a function for every one of the 38 registered tool names
ok 45 - dispatch: stockHandlerFor returns a function for every one of the 38 registered tool names
  ---
  duration_ms: 0.091137
  type: 'test'
  ...
# Subtest: dispatch: the table's key count is exactly 38
ok 46 - dispatch: the table's key count is exactly 38
  ---
  duration_ms: 0.086546
  type: 'test'
  ...
# Subtest: dispatch: every registered tool name matches /^vice_[a-z0-9_]+$/
ok 47 - dispatch: every registered tool name matches /^vice_[a-z0-9_]+$/
  ---
  duration_ms: 0.226977
  type: 'test'
  ...
# Subtest: dispatch: stockHandlerFor returns undefined for every deliberately-absent tool name
ok 48 - dispatch: stockHandlerFor returns undefined for every deliberately-absent tool name
  ---
  duration_ms: 0.109719
  type: 'test'
  ...
# Subtest: dispatch: dispatchStock refuses every deliberately-absent tool with the exact message capabilityRefusalMessage() renders (WR-13), without reading deps
ok 49 - dispatch: dispatchStock refuses every deliberately-absent tool with the exact message capabilityRefusalMessage() renders (WR-13), without reading deps
  ---
  duration_ms: 0.384093
  type: 'test'
  ...
# Subtest: refus: dispatchStock on a fork-only hardware tool (vice_sid_get_state) refuses with capabilityRefusalMessage()'s exact text, never calls forwardToVice, and never touches deps (WR-13)
ok 50 - refus: dispatchStock on a fork-only hardware tool (vice_sid_get_state) refuses with capabilityRefusalMessage()'s exact text, never calls forwardToVice, and never touches deps (WR-13)
  ---
  duration_ms: 0.161739
  type: 'test'
  ...
# Subtest: refus: dispatchStock on a name absent from BOTH manifests (no registry entry) falls back to the internal-inconsistency message, never a false backend claim (WR-13)
ok 51 - refus: dispatchStock on a name absent from BOTH manifests (no registry entry) falls back to the internal-inconsistency message, never a false backend claim (WR-13)
  ---
  duration_ms: 0.130669
  type: 'test'
  ...
# Subtest: refus: dispatchStock never returns a success shape for an unknown tool name
ok 52 - refus: dispatchStock never returns a success shape for an unknown tool name
  ---
  duration_ms: 0.08572
  type: 'test'
  ...
# Subtest: ping: dispatchStock("vice_ping", ...) calls deps.ensureLease exactly once and deps.connect receives the exact lease fields
ok 53 - ping: dispatchStock("vice_ping", ...) calls deps.ensureLease exactly once and deps.connect receives the exact lease fields
  ---
  duration_ms: 0.32017
  type: 'test'
  ...
# Subtest: ping: a failing ensureLease yields isError:true carrying the provider's message and never calls connect
ok 54 - ping: a failing ensureLease yields isError:true carrying the provider's message and never calls connect
  ---
  duration_ms: 0.159312
  type: 'test'
  ...
# Subtest: ping: the success payload carries backend, viceVersion, resolvedBinaryPath, and runState (D-06)
ok 55 - ping: the success payload carries backend, viceVersion, resolvedBinaryPath, and runState (D-06)
  ---
  duration_ms: 0.221209
  type: 'test'
  ...
# Subtest: WR-05 ping: an UNRESOLVED binary path is reported as such, so a bare name is never presented as a resolved path
ok 56 - WR-05 ping: an UNRESOLVED binary path is reported as such, so a bare name is never presented as a resolved path
  ---
  duration_ms: 0.161663
  type: 'test'
  ...
# Subtest: WR-05 ping: the resolution flag defaults to false when nothing said otherwise
ok 57 - WR-05 ping: the resolution flag defaults to false when nothing said otherwise
  ---
  duration_ms: 0.132288
  type: 'test'
  ...
# Subtest: WR-06: a connect REFUSAL on the stock path names VICE_BROKER_BINMON_HOST and the loopback default
ok 58 - WR-06: a connect REFUSAL on the stock path names VICE_BROKER_BINMON_HOST and the loopback default
  ---
  duration_ms: 0.29334
  type: 'test'
  ...
# Subtest: WR-06: a non-connect handshake failure keeps the plain wording -- the binmon-host advice is not sprayed over unrelated causes
ok 59 - WR-06: a non-connect handshake failure keeps the plain wording -- the binmon-host advice is not sprayed over unrelated causes
  ---
  duration_ms: 0.225432
  type: 'test'
  ...
# Subtest: WR-06: vice-proxy.ts strips the WHATWG bracket form when deriving the dial host, so an IPv6 URL is usable by net.connect()
ok 60 - WR-06: vice-proxy.ts strips the WHATWG bracket form when deriving the dial host, so an IPv6 URL is usable by net.connect()
  ---
  duration_ms: 0.262637
  type: 'test'
  ...
# Subtest: ping: a MonitorOwnershipError from the handshake becomes isError:true naming the holder, without wedge/hung/unresponsive language
ok 61 - ping: a MonitorOwnershipError from the handshake becomes isError:true naming the holder, without wedge/hung/unresponsive language
  ---
  duration_ms: 0.277005
  type: 'test'
  ...
# Subtest: ping: a MachineRestartedError from the handshake becomes isError:true distinguishable from a provider-timeout message
ok 62 - ping: a MachineRestartedError from the handshake becomes isError:true distinguishable from a provider-timeout message
  ---
  duration_ms: 0.328409
  type: 'test'
  ...
# Subtest: dispatch: no handler in the table ever throws -- dispatchStock always resolves to a well-formed {content,isError} result
ok 63 - dispatch: no handler in the table ever throws -- dispatchStock always resolves to a well-formed {content,isError} result
  ---
  duration_ms: 0.16756
  type: 'test'
  ...
# Subtest: structure/proxy: vice-proxy.ts has exactly one dispatchStock CALL SITE
ok 64 - structure/proxy: vice-proxy.ts has exactly one dispatchStock CALL SITE
  ---
  duration_ms: 0.259715
  type: 'test'
  ...
# Subtest: structure/proxy: vice-proxy.ts's dispatchStock call site passes ensureBrokerLease as its LeaseProvider
ok 65 - structure/proxy: vice-proxy.ts's dispatchStock call site passes ensureBrokerLease as its LeaseProvider
  ---
  duration_ms: 0.277149
  type: 'test'
  ...
# Subtest: structure/proxy: vice-proxy.ts references manifestPathForBackend exactly once
ok 66 - structure/proxy: vice-proxy.ts references manifestPathForBackend exactly once
  ---
  duration_ms: 0.528367
  type: 'test'
  ...
# Subtest: structure/proxy: vice-proxy.ts's ensureBrokerLease has at least two lease-bearing success returns
ok 67 - structure/proxy: vice-proxy.ts's ensureBrokerLease has at least two lease-bearing success returns
  ---
  duration_ms: 0.247184
  type: 'test'
  ...
# Subtest: structure/proxy: no code line in vice-proxy.ts pairs "stock" with "forwardToVice"
ok 68 - structure/proxy: no code line in vice-proxy.ts pairs "stock" with "forwardToVice"
  ---
  duration_ms: 0.412162
  type: 'test'
  ...
# Subtest: structure/proxy (CR-07): every registered tool whose runner can touch a transport goes through buildBackendAwareTool
ok 69 - structure/proxy (CR-07): every registered tool whose runner can touch a transport goes through buildBackendAwareTool
  ---
  duration_ms: 0.512402
  type: 'test'
  ...
# Subtest: structure/proxy (CR-07): the synthetic tools are all registered, and the only registrations bypassing the backend-aware seam are vice_result_continue and the anno_* family
ok 70 - structure/proxy (CR-07): the synthetic tools are all registered, and the only registrations bypassing the backend-aware seam are vice_result_continue and the anno_* family
  ---
  duration_ms: 0.358513
  type: 'test'
  ...
# Subtest: structure/proxy (CR-07): vice_result_continue's runner is handleResultContinue, whose body touches no transport at all
ok 71 - structure/proxy (CR-07): vice_result_continue's runner is handleResultContinue, whose body touches no transport at all
  ---
  duration_ms: 0.335614
  type: 'test'
  ...
# Subtest: structure/proxy (plan 29-01): the anno_* loop registration's runner is runAnnoTool, whose body touches no VICE transport at all
not ok 72 - structure/proxy (plan 29-01): the anno_* loop registration's runner is runAnnoTool, whose body touches no VICE transport at all
  ---
  duration_ms: 0.862799
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/stock-dispatch.test.ts:1555:1'
  failureType: 'testCodeFailure'
  error: "runAnnoTool() must not reach forwardToVice -- that is what makes the anno_* family's backend-independence sound: the runner reaches a proxy-local SQLite store and never the host-path seam"
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/stock-dispatch.test.ts:1565:12)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: structure/proxy (plan 29-01): every curated anno_* name is absent from BOTH tools-manifest.json and tools-manifest.stock.json
ok 73 - structure/proxy (plan 29-01): every curated anno_* name is absent from BOTH tools-manifest.json and tools-manifest.stock.json
  ---
  duration_ms: 1.014155
  type: 'test'
  ...
# Subtest: structure/proxy (CR-07): buildBackendAwareTool routes the non-fork backend to dispatchStock, and that is the only dispatch site
ok 74 - structure/proxy (CR-07): buildBackendAwareTool routes the non-fork backend to dispatchStock, and that is the only dispatch site
  ---
  duration_ms: 0.178779
  type: 'test'
  ...
# Subtest: structure/proxy (CR-07): handleDiagnose and handleRecycle are each referenced by exactly one registration, and it is backend-aware
ok 75 - structure/proxy (CR-07): handleDiagnose and handleRecycle are each referenced by exactly one registration, and it is backend-aware
  ---
  duration_ms: 0.336714
  type: 'test'
  ...
# Subtest: structure/proxy: vice-proxy.ts CALLS resolvedBackend() exactly once
ok 76 - structure/proxy: vice-proxy.ts CALLS resolvedBackend() exactly once
  ---
  duration_ms: 0.272869
  type: 'test'
  ...
# Subtest: structure/proxy (WR-04): ensureBrokerLease() compares the broker's own backend verdict against ACTIVE_BACKEND and refuses a definite mismatch
ok 77 - structure/proxy (WR-04): ensureBrokerLease() compares the broker's own backend verdict against ACTIVE_BACKEND and refuses a definite mismatch
  ---
  duration_ms: 0.193533
  type: 'test'
  ...
# Subtest: structure/proxy (CR-06): buildHeldLease() threads epochFile and supervisorDir, from activeInstance() and brokerRootDir() respectively
ok 78 - structure/proxy (CR-06): buildHeldLease() threads epochFile and supervisorDir, from activeInstance() and brokerRootDir() respectively
  ---
  duration_ms: 0.191418
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_memory_read", ...) answers, validating against its own declared outputSchema
ok 79 - conformance (D-02): dispatchStock("vice_memory_read", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.96215
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_memory_write", ...) answers, validating against its own declared outputSchema
ok 80 - conformance (D-02): dispatchStock("vice_memory_write", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.356275
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_memory_banks", ...) answers, validating against its own declared outputSchema
ok 81 - conformance (D-02): dispatchStock("vice_memory_banks", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.04491
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_memory_search", ...) answers, validating against its own declared outputSchema
ok 82 - conformance (D-02): dispatchStock("vice_memory_search", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.449756
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_memory_compare", ...) answers, validating against its own declared outputSchema
ok 83 - conformance (D-02): dispatchStock("vice_memory_compare", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.33518
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_registers_get", ...) answers, validating against its own declared outputSchema
ok 84 - conformance (D-02): dispatchStock("vice_registers_get", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.021311
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_registers_set", ...) answers, validating against its own declared outputSchema
ok 85 - conformance (D-02): dispatchStock("vice_registers_set", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.109794
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_registers_available", ...) answers, validating against its own declared outputSchema
ok 86 - conformance (D-02): dispatchStock("vice_registers_available", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.125032
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_checkpoint_add", ...) answers, validating against its own declared outputSchema
ok 87 - conformance (D-02): dispatchStock("vice_checkpoint_add", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.189616
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_checkpoint_delete", ...) answers, validating against its own declared outputSchema
ok 88 - conformance (D-02): dispatchStock("vice_checkpoint_delete", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 0.987304
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_checkpoint_list", ...) answers, validating against its own declared outputSchema
ok 89 - conformance (D-02): dispatchStock("vice_checkpoint_list", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.072683
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_checkpoint_toggle", ...) answers, validating against its own declared outputSchema
ok 90 - conformance (D-02): dispatchStock("vice_checkpoint_toggle", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 0.851408
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_checkpoint_set_condition", ...) answers, validating against its own declared outputSchema
ok 91 - conformance (D-02): dispatchStock("vice_checkpoint_set_condition", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 0.809574
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_watch_add", ...) answers, validating against its own declared outputSchema
ok 92 - conformance (D-02): dispatchStock("vice_watch_add", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.076021
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_execution_pause", ...) answers, validating against its own declared outputSchema
ok 93 - conformance (D-02): dispatchStock("vice_execution_pause", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 17.999946
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_execution_run", ...) answers, validating against its own declared outputSchema
ok 94 - conformance (D-02): dispatchStock("vice_execution_run", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.183727
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_execution_step", ...) answers, validating against its own declared outputSchema
ok 95 - conformance (D-02): dispatchStock("vice_execution_step", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.460003
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_execution_until_return", ...) answers, validating against its own declared outputSchema
ok 96 - conformance (D-02): dispatchStock("vice_execution_until_return", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.766538
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_machine_reset", ...) answers, validating against its own declared outputSchema
ok 97 - conformance (D-02): dispatchStock("vice_machine_reset", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.366952
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_autostart", ...) answers, validating against its own declared outputSchema
ok 98 - conformance (D-02): dispatchStock("vice_autostart", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.505926
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_disk_attach", ...) answers, validating against its own declared outputSchema
ok 99 - conformance (D-02): dispatchStock("vice_disk_attach", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.246235
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_snapshot_save", ...) answers, validating against its own declared outputSchema
ok 100 - conformance (D-02): dispatchStock("vice_snapshot_save", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.915505
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_snapshot_load", ...) answers, validating against its own declared outputSchema
ok 101 - conformance (D-02): dispatchStock("vice_snapshot_load", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.267056
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_keyboard_type", ...) answers, validating against its own declared outputSchema
ok 102 - conformance (D-02): dispatchStock("vice_keyboard_type", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.024038
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_keyboard_petscii", ...) answers, validating against its own declared outputSchema
ok 103 - conformance (D-02): dispatchStock("vice_keyboard_petscii", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 0.866273
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_joystick_set", ...) answers, validating against its own declared outputSchema
ok 104 - conformance (D-02): dispatchStock("vice_joystick_set", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.094965
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_disassemble", ...) answers, validating against its own declared outputSchema
ok 105 - conformance (D-02): dispatchStock("vice_disassemble", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.933267
  type: 'test'
  ...
# Subtest: end-to-end (criterion 1, D-02): vice_disassemble succeeds through the REAL dispatchStock() path under a translating environment -- the derived path never reaches host-path translation
ok 106 - end-to-end (criterion 1, D-02): vice_disassemble succeeds through the REAL dispatchStock() path under a translating environment -- the derived path never reaches host-path translation
  ---
  duration_ms: 0.375771
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_symbols_load", ...) answers, validating against its own declared outputSchema
ok 107 - conformance (D-02): dispatchStock("vice_symbols_load", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.868099
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_symbols_lookup", ...) answers, validating against its own declared outputSchema
ok 108 - conformance (D-02): dispatchStock("vice_symbols_lookup", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.403658
  type: 'test'
  ...
# Subtest: end-to-end (criterion 1, D-02): vice_symbols_load succeeds through the REAL dispatchStock() path under a translating environment -- resolvedPath stays container-side
ok 109 - end-to-end (criterion 1, D-02): vice_symbols_load succeeds through the REAL dispatchStock() path under a translating environment -- resolvedPath stays container-side
  ---
  duration_ms: 0.57701
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_vicii_get_state", ...) answers, validating against its own declared outputSchema
ok 110 - conformance (D-02): dispatchStock("vice_vicii_get_state", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.657412
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_cia_get_state", ...) answers, validating against its own declared outputSchema
ok 111 - conformance (D-02): dispatchStock("vice_cia_get_state", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.25808
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_sprite_get", ...) answers, validating against its own declared outputSchema
ok 112 - conformance (D-02): dispatchStock("vice_sprite_get", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.947512
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_sprite_inspect", ...) answers, validating against its own declared outputSchema
ok 113 - conformance (D-02): dispatchStock("vice_sprite_inspect", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.912658
  type: 'test'
  ...
# Subtest: structure: stock-dispatch.ts contains zero CODE references to the fork-forwarding function's name, pairing the vice-proxy.ts structural assertion above with this module's own
ok 114 - structure: stock-dispatch.ts contains zero CODE references to the fork-forwarding function's name, pairing the vice-proxy.ts structural assertion above with this module's own
  ---
  duration_ms: 0.534148
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_ping", ...) answers, validating against its own declared outputSchema
ok 115 - conformance (D-02): dispatchStock("vice_ping", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 0.873198
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_cycles_stopwatch", ...) answers, validating against its own declared outputSchema
ok 116 - conformance (D-02): dispatchStock("vice_cycles_stopwatch", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 1.860039
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_run_until", ...) answers, validating against its own declared outputSchema
ok 117 - conformance (D-02): dispatchStock("vice_run_until", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 27.021061
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_diagnose", ...) answers, validating against its own declared outputSchema
ok 118 - conformance (D-02): dispatchStock("vice_diagnose", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 2.555436
  type: 'test'
  ...
# Subtest: conformance (D-02): dispatchStock("vice_recycle", ...) answers, validating against its own declared outputSchema
ok 119 - conformance (D-02): dispatchStock("vice_recycle", ...) answers, validating against its own declared outputSchema
  ---
  duration_ms: 10.007055
  type: 'test'
  ...
# Subtest: regression (Phase 7, TIME-04): stockHandlerFor resolves both proxy-local tools -- a stock call no longer reaches dispatchStock()'s refuse-by-name branch
ok 120 - regression (Phase 7, TIME-04): stockHandlerFor resolves both proxy-local tools -- a stock call no longer reaches dispatchStock()'s refuse-by-name branch
  ---
  duration_ms: 0.423285
  type: 'test'
  ...
# Subtest: conformance (D-02) completeness guard: CONFORMANCE_TOOL_NAMES covers exactly the stock manifest's tool names
ok 121 - conformance (D-02) completeness guard: CONFORMANCE_TOOL_NAMES covers exactly the stock manifest's tool names
  ---
  duration_ms: 0.73292
  type: 'test'
  ...
# Subtest: conformance (D-02) negative control: checkAgainstSchema rejects a deliberately wrong answer, proving the checker is not vacuous
ok 122 - conformance (D-02) negative control: checkAgainstSchema rejects a deliberately wrong answer, proving the checker is not vacuous
  ---
  duration_ms: 0.680205
  type: 'test'
  ...
# Subtest: withDerivedTool: an undeclared tool name is refused by name, without ever reaching ensureLease
ok 123 - withDerivedTool: an undeclared tool name is refused by name, without ever reaching ensureLease
  ---
  duration_ms: 0.160768
  type: 'test'
  ...
# Subtest: withDerivedTool: needsSession:false invokes the handler with (args, deps) and never calls ensureLease
ok 124 - withDerivedTool: needsSession:false invokes the handler with (args, deps) and never calls ensureLease
  ---
  duration_ms: 0.13736
  type: 'test'
  ...
# Subtest: withDerivedTool: needsSession:true delegates to ensureStockSession and hands the handler the resolved session
ok 125 - withDerivedTool: needsSession:true delegates to ensureStockSession and hands the handler the resolved session
  ---
  duration_ms: 0.174893
  type: 'test'
  ...
# Subtest: withDerivedTool: a handler that throws is converted via convertWireError, not propagated
ok 126 - withDerivedTool: a handler that throws is converted via convertWireError, not propagated
  ---
  duration_ms: 0.156132
  type: 'test'
  ...
# Subtest: withDerivedTool: needsSession:true converts a handshake failure via convertHandshakeError, naming the tool
ok 127 - withDerivedTool: needsSession:true converts a handshake failure via convertHandshakeError, naming the tool
  ---
  duration_ms: 0.211256
  type: 'test'
  ...
# Subtest: withDerivedTool: needsSession:true returns an { ok: false } lease refusal verbatim, without touching the handler
ok 128 - withDerivedTool: needsSession:true returns an { ok: false } lease refusal verbatim, without touching the handler
  ---
  duration_ms: 0.125559
  type: 'test'
  ...
# Subtest: invariant (WR-13): no shipped module outside capability-registry.ts hardcodes a fork-provides refusal claim
ok 129 - invariant (WR-13): no shipped module outside capability-registry.ts hardcodes a fork-provides refusal claim
  ---
  duration_ms: 12.3579
  type: 'test'
  ...
# Subtest: invariant (WR-13): no shipped module outside capability-registry.ts pairs future-phase framing with a VICE_BACKEND selection instruction
ok 130 - invariant (WR-13): no shipped module outside capability-registry.ts pairs future-phase framing with a VICE_BACKEND selection instruction
  ---
  duration_ms: 13.237186
  type: 'test'
  ...
1..130
# tests 130
# suites 0
# pass 129
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 521.975933
```

## `src/mcp/vice/tool-support-table.test.mjs` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test --test-name-pattern derived-union equality tool-support-table.test.mjs`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# Subtest: derived-union equality: the generated document's row set equals an independently-computed union of the three inputs
ok 1 - derived-union equality: the generated document's row set equals an independently-computed union of the three inputs
  ---
  duration_ms: 9.859223
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
# duration_ms 154.460104
```

### Planted run

- **Plant:** `src/mcp/vice/tool-support-table.test.mjs`: `const ANNO_LOOP_VAR_RE = /for\s*\(\s*const\s+(\w+)\s+of\s+ANNO_TOOL_DEFINITIONS\s*\)/;` → `const ANNO_LOOP_VAR_RE = /for\s*\(\s*const\s+(\w+)\s+of\s+ANNO_TOOL_DEFINITIONZ\s*\)/;`
- **Planted command:** `node --test --test-name-pattern derived-union equality tool-support-table.test.mjs`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# Subtest: derived-union equality: the generated document's row set equals an independently-computed union of the three inputs
not ok 1 - derived-union equality: the generated document's row set equals an independently-computed union of the three inputs
  ---
  duration_ms: 6.094626
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/tool-support-table.test.mjs:270:1'
  failureType: 'testCodeFailure'
  error: 'independentlyDiscoverSyntheticNames: could not resolve "annoDef" to a declaration'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: ~
  operator: '=='
  stack: |-
    independentlyDiscoverSyntheticNames (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/tool-support-table.test.mjs:106:12)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/tool-support-table.test.mjs:281:26)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 140.060432
```

## `src/mcp/vice/vice-proxy.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test --test-name-pattern tools/list survives a missing or corrupt snapshot vice-proxy.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# (node:64661) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# vice-proxy.test: after() force-closed 0 leaked server(s) and killed 1 leaked child(ren) -- a test threw before its own teardown ran; this is the net, not the fix -- find and repair that test's try/finally shape.
# Subtest: tools/list survives a missing or corrupt snapshot
ok 1 - tools/list survives a missing or corrupt snapshot
  ---
  duration_ms: 2849.969144
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
# duration_ms 3153.892544
```

### Planted run

- **Plant:** `src/mcp/vice/anno-tools.ts`: `ANNO_TOOL_DEFINITIONS.map((def) => def.name)` → `ANNO_TOOL_DEFINITIONS.map((def) => def.name + "X")`
- **Planted command:** `node --test --test-name-pattern tools/list survives a missing or corrupt snapshot vice-proxy.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# (node:64817) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# vice-proxy.test: after() force-closed 0 leaked server(s) and killed 1 leaked child(ren) -- a test threw before its own teardown ran; this is the net, not the fix -- find and repair that test's try/finally shape.
# Subtest: tools/list survives a missing or corrupt snapshot
not ok 1 - tools/list survives a missing or corrupt snapshot
  ---
  duration_ms: 814.524308
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/vice-proxy.test.ts:570:1'
  failureType: 'testCodeFailure'
  error: |-
    expected only the synthetic and r2000_* tools for /tmp/vice-proxy-manifest-bad-kItHzQ/does-not-exist.json
    + actual - expected
    
      [
        'vice_result_continue',
        'vice_recycle',
        'vice_diagnose',
    +   'anno_set_label_name',
    +   'anno_set_comment',
    +   'anno_set_data_type',
    +   'anno_add_scope',
    +   'anno_remove_scope',
    +   'anno_get_symbols',
    +   'anno_get_comments',
    +   'anno_get_blocks',
    +   'anno_create_project_enum',
    +   'anno_update_project_enum',
    +   'anno_apply_enum_usage',
    +   'anno_save_project',
    +   'anno_disassemble',
    +   'anno_read_region',
    +   'anno_get_binary_info',
    +   'anno_get_cross_references',
    +   'anno_search',
    +   'anno_get_address_details',
    +   'anno_batch_execute'
    -   'anno_set_label_nameX',
    -   'anno_set_commentX',
    -   'anno_set_data_typeX',
    -   'anno_add_scopeX',
    -   'anno_remove_scopeX',
    -   'anno_get_symbolsX',
    -   'anno_get_commentsX',
    -   'anno_get_blocksX',
    -   'anno_create_project_enumX',
    -   'anno_update_project_enumX',
    -   'anno_apply_enum_usageX',
    -   'anno_save_projectX',
    -   'anno_disassembleX',
    -   'anno_read_regionX',
    -   'anno_get_binary_infoX',
    -   'anno_get_cross_referencesX',
    -   'anno_searchX',
    -   'anno_get_address_detailsX',
    -   'anno_batch_executeX'
      ]
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
    0: 'vice_result_continue'
    1: 'vice_recycle'
    2: 'vice_diagnose'
    3: 'anno_set_label_nameX'
    4: 'anno_set_commentX'
    5: 'anno_set_data_typeX'
    6: 'anno_add_scopeX'
    7: 'anno_remove_scopeX'
    8: 'anno_get_symbolsX'
    9: 'anno_get_commentsX'
    10: 'anno_get_blocksX'
    11: 'anno_create_project_enumX'
    12: 'anno_update_project_enumX'
    13: 'anno_apply_enum_usageX'
    14: 'anno_save_projectX'
    15: 'anno_disassembleX'
    16: 'anno_read_regionX'
    17: 'anno_get_binary_infoX'
    18: 'anno_get_cross_referencesX'
    19: 'anno_searchX'
    20: 'anno_get_address_detailsX'
    21: 'anno_batch_executeX'
  actual:
    0: 'vice_result_continue'
    1: 'vice_recycle'
    2: 'vice_diagnose'
    3: 'anno_set_label_name'
    4: 'anno_set_comment'
    5: 'anno_set_data_type'
    6: 'anno_add_scope'
    7: 'anno_remove_scope'
    8: 'anno_get_symbols'
    9: 'anno_get_comments'
    10: 'anno_get_blocks'
    11: 'anno_create_project_enum'
    12: 'anno_update_project_enum'
    13: 'anno_apply_enum_usage'
    14: 'anno_save_project'
    15: 'anno_disassemble'
    16: 'anno_read_region'
    17: 'anno_get_binary_info'
    18: 'anno_get_cross_references'
    19: 'anno_search'
    20: 'anno_get_address_details'
    21: 'anno_batch_execute'
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/vice-proxy.test.ts:601:16)
    async Test.run (node:internal/test_runner/test:1054:7)
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
# duration_ms 1058.266022
```

## `src/mcp/vice/r2000-launch.test.ts` — verdict `deleted`

**SKIPPED.** verdict `deleted` owes no observed-red evidence (D-05); its evidence is the recorded removal trigger and classification, not a planted guard run. Not measured, and not silently omitted.

## `src/mcp/vice/r2000-mcp-client.test.ts` — verdict `deleted`

**SKIPPED.** verdict `deleted` owes no observed-red evidence (D-05); its evidence is the recorded removal trigger and classification, not a planted guard run. Not measured, and not silently omitted.

## `src/mcp/vice/r2000-project.test.ts` — verdict `deleted`

**SKIPPED.** verdict `deleted` owes no observed-red evidence (D-05); its evidence is the recorded removal trigger and classification, not a planted guard run. Not measured, and not silently omitted.

## `src/mcp/vice/r2000-session.test.ts` — verdict `deleted`

**SKIPPED.** verdict `deleted` owes no observed-red evidence (D-05); its evidence is the recorded removal trigger and classification, not a planted guard run. Not measured, and not silently omitted.

## `src/mcp/vice/r2000-symbol-roundtrip.test.ts` — verdict `deleted`

**SKIPPED.** verdict `deleted` owes no observed-red evidence (D-05); its evidence is the recorded removal trigger and classification, not a planted guard run. Not measured, and not silently omitted.

## `src/mcp/vice/r2000-upstream-audit.test.ts` — verdict `deleted`

**SKIPPED.** verdict `deleted` owes no observed-red evidence (D-05); its evidence is the recorded removal trigger and classification, not a planted guard run. Not measured, and not silently omitted.

## `src/mcp/vice/r2000-verify.test.ts` — verdict `deleted`

**SKIPPED.** verdict `deleted` owes no observed-red evidence (D-05); its evidence is the recorded removal trigger and classification, not a planted guard run. Not measured, and not silently omitted.

## `scripts/check-no-regenerator2000.d.mts` — verdict `kept-unchanged`

**SKIPPED.** verdict `kept-unchanged` owes no observed-red evidence (D-05); its evidence is the recorded removal trigger and classification, not a planted guard run. Not measured, and not silently omitted.

## `scripts/check-no-regenerator2000.mjs` — verdict `kept-unchanged`

**SKIPPED.** verdict `kept-unchanged` owes no observed-red evidence (D-05); its evidence is the recorded removal trigger and classification, not a planted guard run. Not measured, and not silently omitted.

## `scripts/lib/anno-cli-invocations.mjs` — verdict `kept-unchanged`

**SKIPPED.** verdict `kept-unchanged` owes no observed-red evidence (D-05); its evidence is the recorded removal trigger and classification, not a planted guard run. Not measured, and not silently omitted.

## `src/mcp/vice/acme-gate.test.ts` — verdict `kept-unchanged`

**SKIPPED.** verdict `kept-unchanged` owes no observed-red evidence (D-05); its evidence is the recorded removal trigger and classification, not a planted guard run. Not measured, and not silently omitted.

## `src/mcp/vice/anno-derivation.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test anno-derivation.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# (node:64895) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: Phase 19 pins and classifies all five upstream analysis procedures
ok 1 - Phase 19 pins and classifies all five upstream analysis procedures
  ---
  duration_ms: 1.280761
  type: 'test'
  ...
# Subtest: every non-curated upstream call carries a justification and a citation
ok 2 - every non-curated upstream call carries a justification and a citation
  ---
  duration_ms: 0.790938
  type: 'test'
  ...
# Subtest: ABS-04's re-sync triggers are named and each carries a mechanism
ok 3 - ABS-04's re-sync triggers are named and each carries a mechanism
  ---
  duration_ms: 0.200042
  type: 'test'
  ...
# Subtest: the elected licence is one of the two the upstream dual licence offers
ok 4 - the elected licence is one of the two the upstream dual licence offers
  ---
  duration_ms: 0.130101
  type: 'test'
  ...
# Subtest: live: the five source digests re-hash to the manifest's values
ok 5 - live: the five source digests re-hash to the manifest's values # SKIP the upstream re-hash check is skipped -- no clone of https://github.com/ricardoquesada/regenerator2000 at 493f840418f1450a342bb220c2fe3d2585dd0525 was found. Set R2000_UPSTREAM_CLONE to the checkout root to run it. Set VICE_REQUIRE_R2000_UPSTREAM=1 to make its absence a FAILURE instead of a SKIP.
  ---
  duration_ms: 0.085391
  type: 'test'
  ...
# Subtest: MCP-01 (forward): every curated or adapt-to-address-input verb has a route, every omit verb is absent under any spelling, and an unknown disposition fails outright
ok 6 - MCP-01 (forward): every curated or adapt-to-address-input verb has a route, every omit verb is absent under any spelling, and an unknown disposition fails outright
  ---
  duration_ms: 0.935199
  type: 'test'
  ...
# Subtest: MCP-01: the one verb with zero callers anywhere is not carried
ok 7 - MCP-01: the one verb with zero callers anywhere is not carried
  ---
  duration_ms: 0.15355
  type: 'test'
  ...
# Subtest: MCP-01 (ordering): the verdict is identical over reversed copies of BOTH the definition table and the procedure list
ok 8 - MCP-01 (ordering): the verdict is identical over reversed copies of BOTH the definition table and the procedure list
  ---
  duration_ms: 0.413759
  type: 'test'
  ...
# Subtest: MCP-01 (backward, D-08): every surface verb is either manifest-classified or carries a register entry citing at least one requirement id
ok 9 - MCP-01 (backward, D-08): every surface verb is either manifest-classified or carries a register entry citing at least one requirement id
  ---
  duration_ms: 0.488994
  type: 'test'
  ...
1..9
# tests 9
# suites 0
# pass 8
# fail 0
# cancelled 0
# skipped 1
# todo 0
# duration_ms 237.18626
```

### Planted run

- **Plant:** `src/mcp/vice/anno-tools.ts`: `name: "anno_search",` → `name: "anno_searchZZ",`
- **Planted command:** `node --test anno-derivation.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# (node:64916) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: Phase 19 pins and classifies all five upstream analysis procedures
ok 1 - Phase 19 pins and classifies all five upstream analysis procedures
  ---
  duration_ms: 1.82245
  type: 'test'
  ...
# Subtest: every non-curated upstream call carries a justification and a citation
ok 2 - every non-curated upstream call carries a justification and a citation
  ---
  duration_ms: 0.893092
  type: 'test'
  ...
# Subtest: ABS-04's re-sync triggers are named and each carries a mechanism
ok 3 - ABS-04's re-sync triggers are named and each carries a mechanism
  ---
  duration_ms: 0.203913
  type: 'test'
  ...
# Subtest: the elected licence is one of the two the upstream dual licence offers
ok 4 - the elected licence is one of the two the upstream dual licence offers
  ---
  duration_ms: 0.148816
  type: 'test'
  ...
# Subtest: live: the five source digests re-hash to the manifest's values
ok 5 - live: the five source digests re-hash to the manifest's values # SKIP the upstream re-hash check is skipped -- no clone of https://github.com/ricardoquesada/regenerator2000 at 493f840418f1450a342bb220c2fe3d2585dd0525 was found. Set R2000_UPSTREAM_CLONE to the checkout root to run it. Set VICE_REQUIRE_R2000_UPSTREAM=1 to make its absence a FAILURE instead of a SKIP.
  ---
  duration_ms: 0.096344
  type: 'test'
  ...
# Subtest: MCP-01 (forward): every curated or adapt-to-address-input verb has a route, every omit verb is absent under any spelling, and an unknown disposition fails outright
ok 6 - MCP-01 (forward): every curated or adapt-to-address-input verb has a route, every omit verb is absent under any spelling, and an unknown disposition fails outright
  ---
  duration_ms: 1.014949
  type: 'test'
  ...
# Subtest: MCP-01: the one verb with zero callers anywhere is not carried
ok 7 - MCP-01: the one verb with zero callers anywhere is not carried
  ---
  duration_ms: 0.179883
  type: 'test'
  ...
# Subtest: MCP-01 (ordering): the verdict is identical over reversed copies of BOTH the definition table and the procedure list
ok 8 - MCP-01 (ordering): the verdict is identical over reversed copies of BOTH the definition table and the procedure list
  ---
  duration_ms: 0.442306
  type: 'test'
  ...
# Subtest: MCP-01 (backward, D-08): every surface verb is either manifest-classified or carries a register entry citing at least one requirement id
not ok 9 - MCP-01 (backward, D-08): every surface verb is either manifest-classified or carries a register entry citing at least one requirement id
  ---
  duration_ms: 1.613304
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-derivation.test.ts:451:1'
  failureType: 'testCodeFailure'
  error: |-
    anno_searchZZ: classified by NEITHER the manifest NOR the register
    
    D-08 is literal about what happens next: a verb added with no named consumer FAILS rather than being reviewed. Either derive it from the manifest, or give it a committed register entry citing a requirement id and a consumer.
    + actual - expected
    
    + [
    +   'anno_searchZZ: classified by NEITHER the manifest NOR the register'
    + ]
    - []
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual:
    0: 'anno_searchZZ: classified by NEITHER the manifest NOR the register'
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/anno-derivation.test.ts:470:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
1..9
# tests 9
# suites 0
# pass 7
# fail 1
# cancelled 0
# skipped 1
# todo 0
# duration_ms 201.030518
```

## `src/mcp/vice/anno-index.test.ts` — verdict `kept-unchanged`

**SKIPPED.** verdict `kept-unchanged` owes no observed-red evidence (D-05); its evidence is the recorded removal trigger and classification, not a planted guard run. Not measured, and not silently omitted.

## `src/mcp/vice/anno-seam.test.ts` — verdict `kept-unchanged`

**SKIPPED.** verdict `kept-unchanged` owes no observed-red evidence (D-05); its evidence is the recorded removal trigger and classification, not a planted guard run. Not measured, and not silently omitted.

## `src/mcp/vice/anno-store.test.ts` — verdict `kept-unchanged`

**SKIPPED.** verdict `kept-unchanged` owes no observed-red evidence (D-05); its evidence is the recorded removal trigger and classification, not a planted guard run. Not measured, and not silently omitted.

## `src/mcp/vice/anno-types.test.ts` — verdict `kept-unchanged`

**SKIPPED.** verdict `kept-unchanged` owes no observed-red evidence (D-05); its evidence is the recorded removal trigger and classification, not a planted guard run. Not measured, and not silently omitted.

## `src/mcp/vice/block-class.test.ts` — verdict `kept-unchanged`

**SKIPPED.** verdict `kept-unchanged` owes no observed-red evidence (D-05); its evidence is the recorded removal trigger and classification, not a planted guard run. Not measured, and not silently omitted.

## `src/mcp/vice/fixtures/planted-removal-fixture.md.txt` — verdict `kept-unchanged`

**SKIPPED.** verdict `kept-unchanged` owes no observed-red evidence (D-05); its evidence is the recorded removal trigger and classification, not a planted guard run. Not measured, and not silently omitted.

## `src/mcp/vice/fixtures/planted-removal-fixture.ts.txt` — verdict `kept-unchanged`

**SKIPPED.** verdict `kept-unchanged` owes no observed-red evidence (D-05); its evidence is the recorded removal trigger and classification, not a planted guard run. Not measured, and not silently omitted.

## `src/mcp/vice/module-classification.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test module-classification.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# Subtest: DIRECTION 6 (non-vacuity): the on-disk in-scope count is at least the number of in-enumeration entries, DERIVED from the registry rather than pinned
ok 1 - DIRECTION 6 (non-vacuity): the on-disk in-scope count is at least the number of in-enumeration entries, DERIVED from the registry rather than pinned
  ---
  duration_ms: 2.325634
  type: 'test'
  ...
# Subtest: DISCHARGE CLOSURE (plan 29-05): every discharged entry's fate resolves against disk -- a rename to a file that is there, or a deletion of a file that is not
ok 2 - DISCHARGE CLOSURE (plan 29-05): every discharged entry's fate resolves against disk -- a rename to a file that is there, or a deletion of a file that is not
  ---
  duration_ms: 0.845444
  type: 'test'
  ...
# Subtest: planted violation (discharge closure): a fate naming a nonexistent file, a self-rename, a missing fate and a survived deletion are all reported by the same predicate the real scan calls
ok 3 - planted violation (discharge closure): a fate naming a nonexistent file, a self-rename, a missing fate and a survived deletion are all reported by the same predicate the real scan calls
  ---
  duration_ms: 0.315569
  type: 'test'
  ...
# Subtest: DIRECTION 1 (completeness): every in-scope module and data file on disk has a registry entry, and the failure names it
ok 4 - DIRECTION 1 (completeness): every in-scope module and data file on disk has a registry entry, and the failure names it
  ---
  duration_ms: 0.361831
  type: 'test'
  ...
# Subtest: DIRECTION 2 (no orphans): every in-enumeration entry names a module that exists on disk
ok 5 - DIRECTION 2 (no orphans): every in-enumeration entry names a module that exists on disk
  ---
  duration_ms: 0.353534
  type: 'test'
  ...
# Subtest: DIRECTION 2 (encoding): the generated data file is matched by its FULL filename including the extension, never by a stem
ok 6 - DIRECTION 2 (encoding): the generated data file is matched by its FULL filename including the extension, never by a stem
  ---
  duration_ms: 0.244645
  type: 'test'
  ...
# Subtest: DIRECTION 3 (basis integrity): every entry's basis is non-empty, every cited consumer path exists on disk, and every requirement id is well-shaped
ok 7 - DIRECTION 3 (basis integrity): every entry's basis is non-empty, every cited consumer path exists on disk, and every requirement id is well-shaped
  ---
  duration_ms: 0.552916
  type: 'test'
  ...
# Subtest: DIRECTION 4 (the name prohibition): no entry's basis justifies its verdict by the module's name
ok 8 - DIRECTION 4 (the name prohibition): no entry's basis justifies its verdict by the module's name
  ---
  duration_ms: 0.961091
  type: 'test'
  ...
# Subtest: DIRECTION 5 (verdict coherence): extractables is non-empty if and only if the verdict is glue-with-extractable
ok 9 - DIRECTION 5 (verdict coherence): extractables is non-empty if and only if the verdict is glue-with-extractable
  ---
  duration_ms: 0.425196
  type: 'test'
  ...
# Subtest: DIRECTION 7 (adjacency): no two entries name the same module
ok 10 - DIRECTION 7 (adjacency): no two entries name the same module
  ---
  duration_ms: 0.465271
  type: 'test'
  ...
# Subtest: DIRECTION 7 (adjacency): out-of-enumeration AND discharged entries are excluded from the completeness loop rather than colliding with it
ok 11 - DIRECTION 7 (adjacency): out-of-enumeration AND discharged entries are excluded from the completeness loop rather than colliding with it
  ---
  duration_ms: 0.492079
  type: 'test'
  ...
# Subtest: DIRECTION 9 (precision): every advisory line citation is verified by containment -- the cited line contains the cited symbol
ok 12 - DIRECTION 9 (precision): every advisory line citation is verified by containment -- the cited line contains the cited symbol
  ---
  duration_ms: 2.335163
  type: 'test'
  ...
# Subtest: DIRECTION 9 (non-vacuity): the record actually carries advisory line citations for this direction to check
ok 13 - DIRECTION 9 (non-vacuity): the record actually carries advisory line citations for this direction to check
  ---
  duration_ms: 0.15543
  type: 'test'
  ...
# Subtest: DIRECTION 9b (prose citations): every `path:NN` cited in this module's OWN source resolves to a real file and a real, non-blank line
ok 14 - DIRECTION 9b (prose citations): every `path:NN` cited in this module's OWN source resolves to a real file and a real, non-blank line
  ---
  duration_ms: 3.268464
  type: 'test'
  ...
# Subtest: DIRECTION 9b (non-vacuity): the extractor actually finds prose citations, and some of them carry a symbol to contain
ok 15 - DIRECTION 9b (non-vacuity): the extractor actually finds prose citations, and some of them carry a symbol to contain
  ---
  duration_ms: 1.31831
  type: 'test'
  ...
# Subtest: DIRECTION 8 (ordering): re-running Directions 1-5, 7 and 9 over a REVERSED copy of the registry yields identical results
ok 16 - DIRECTION 8 (ordering): re-running Directions 1-5, 7 and 9 over a REVERSED copy of the registry yields identical results
  ---
  duration_ms: 4.879548
  type: 'test'
  ...
# Subtest: planted violation: the same predicates the real scan uses report all five synthetic bad entries, and do not report the clean one
ok 17 - planted violation: the same predicates the real scan uses report all five synthetic bad entries, and do not report the clean one
  ---
  duration_ms: 0.441489
  type: 'test'
  ...
# Subtest: planted violation: an in-scope file with no entry is reported by the same completeness predicate the real scan calls
ok 18 - planted violation: an in-scope file with no entry is reported by the same completeness predicate the real scan calls
  ---
  duration_ms: 0.710434
  type: 'test'
  ...
# Subtest: planted violation: a drifted advisory line citation is reported by lineCitationProblems(), and a correct one is not
ok 19 - planted violation: a drifted advisory line citation is reported by lineCitationProblems(), and a correct one is not
  ---
  duration_ms: 0.456591
  type: 'test'
  ...
# Subtest: module-classification.ts is absent from package.json's files[] array (bookkeeping, not shipped runtime behaviour)
ok 20 - module-classification.ts is absent from package.json's files[] array (bookkeeping, not shipped runtime behaviour)
  ---
  duration_ms: 0.659787
  type: 'test'
  ...
1..20
# tests 20
# suites 0
# pass 20
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 178.273231
```

### Planted run

- **Plant:** `src/mcp/vice/module-classification.ts`: `module: "anno-regbits.json",` → `module: "r2000-regbits.json",`
- **Planted command:** `node --test module-classification.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# Subtest: DIRECTION 6 (non-vacuity): the on-disk in-scope count is at least the number of in-enumeration entries, DERIVED from the registry rather than pinned
ok 1 - DIRECTION 6 (non-vacuity): the on-disk in-scope count is at least the number of in-enumeration entries, DERIVED from the registry rather than pinned
  ---
  duration_ms: 1.559081
  type: 'test'
  ...
# Subtest: DISCHARGE CLOSURE (plan 29-05): every discharged entry's fate resolves against disk -- a rename to a file that is there, or a deletion of a file that is not
ok 2 - DISCHARGE CLOSURE (plan 29-05): every discharged entry's fate resolves against disk -- a rename to a file that is there, or a deletion of a file that is not
  ---
  duration_ms: 0.924969
  type: 'test'
  ...
# Subtest: planted violation (discharge closure): a fate naming a nonexistent file, a self-rename, a missing fate and a survived deletion are all reported by the same predicate the real scan calls
ok 3 - planted violation (discharge closure): a fate naming a nonexistent file, a self-rename, a missing fate and a survived deletion are all reported by the same predicate the real scan calls
  ---
  duration_ms: 0.972054
  type: 'test'
  ...
# Subtest: DIRECTION 1 (completeness): every in-scope module and data file on disk has a registry entry, and the failure names it
ok 4 - DIRECTION 1 (completeness): every in-scope module and data file on disk has a registry entry, and the failure names it
  ---
  duration_ms: 0.422865
  type: 'test'
  ...
# Subtest: DIRECTION 2 (no orphans): every in-enumeration entry names a module that exists on disk
ok 5 - DIRECTION 2 (no orphans): every in-enumeration entry names a module that exists on disk
  ---
  duration_ms: 0.380941
  type: 'test'
  ...
# Subtest: DIRECTION 2 (encoding): the generated data file is matched by its FULL filename including the extension, never by a stem
not ok 6 - DIRECTION 2 (encoding): the generated data file is matched by its FULL filename including the extension, never by a stem
  ---
  duration_ms: 0.630589
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/module-classification.test.ts:483:1'
  failureType: 'testCodeFailure'
  error: 'the data file must have its own entry, keyed by its full filename'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/src/mcp/vice/module-classification.test.ts:495:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: DIRECTION 3 (basis integrity): every entry's basis is non-empty, every cited consumer path exists on disk, and every requirement id is well-shaped
ok 7 - DIRECTION 3 (basis integrity): every entry's basis is non-empty, every cited consumer path exists on disk, and every requirement id is well-shaped
  ---
  duration_ms: 0.560932
  type: 'test'
  ...
# Subtest: DIRECTION 4 (the name prohibition): no entry's basis justifies its verdict by the module's name
ok 8 - DIRECTION 4 (the name prohibition): no entry's basis justifies its verdict by the module's name
  ---
  duration_ms: 0.945136
  type: 'test'
  ...
# Subtest: DIRECTION 5 (verdict coherence): extractables is non-empty if and only if the verdict is glue-with-extractable
ok 9 - DIRECTION 5 (verdict coherence): extractables is non-empty if and only if the verdict is glue-with-extractable
  ---
  duration_ms: 0.427933
  type: 'test'
  ...
# Subtest: DIRECTION 7 (adjacency): no two entries name the same module
ok 10 - DIRECTION 7 (adjacency): no two entries name the same module
  ---
  duration_ms: 0.456128
  type: 'test'
  ...
# Subtest: DIRECTION 7 (adjacency): out-of-enumeration AND discharged entries are excluded from the completeness loop rather than colliding with it
ok 11 - DIRECTION 7 (adjacency): out-of-enumeration AND discharged entries are excluded from the completeness loop rather than colliding with it
  ---
  duration_ms: 0.493273
  type: 'test'
  ...
# Subtest: DIRECTION 9 (precision): every advisory line citation is verified by containment -- the cited line contains the cited symbol
ok 12 - DIRECTION 9 (precision): every advisory line citation is verified by containment -- the cited line contains the cited symbol
  ---
  duration_ms: 2.329179
  type: 'test'
  ...
# Subtest: DIRECTION 9 (non-vacuity): the record actually carries advisory line citations for this direction to check
ok 13 - DIRECTION 9 (non-vacuity): the record actually carries advisory line citations for this direction to check
  ---
  duration_ms: 0.147439
  type: 'test'
  ...
# Subtest: DIRECTION 9b (prose citations): every `path:NN` cited in this module's OWN source resolves to a real file and a real, non-blank line
ok 14 - DIRECTION 9b (prose citations): every `path:NN` cited in this module's OWN source resolves to a real file and a real, non-blank line
  ---
  duration_ms: 3.811145
  type: 'test'
  ...
# Subtest: DIRECTION 9b (non-vacuity): the extractor actually finds prose citations, and some of them carry a symbol to contain
ok 15 - DIRECTION 9b (non-vacuity): the extractor actually finds prose citations, and some of them carry a symbol to contain
  ---
  duration_ms: 1.350358
  type: 'test'
  ...
# Subtest: DIRECTION 8 (ordering): re-running Directions 1-5, 7 and 9 over a REVERSED copy of the registry yields identical results
ok 16 - DIRECTION 8 (ordering): re-running Directions 1-5, 7 and 9 over a REVERSED copy of the registry yields identical results
  ---
  duration_ms: 4.898239
  type: 'test'
  ...
# Subtest: planted violation: the same predicates the real scan uses report all five synthetic bad entries, and do not report the clean one
ok 17 - planted violation: the same predicates the real scan uses report all five synthetic bad entries, and do not report the clean one
  ---
  duration_ms: 0.428711
  type: 'test'
  ...
# Subtest: planted violation: an in-scope file with no entry is reported by the same completeness predicate the real scan calls
ok 18 - planted violation: an in-scope file with no entry is reported by the same completeness predicate the real scan calls
  ---
  duration_ms: 0.676672
  type: 'test'
  ...
# Subtest: planted violation: a drifted advisory line citation is reported by lineCitationProblems(), and a correct one is not
ok 19 - planted violation: a drifted advisory line citation is reported by lineCitationProblems(), and a correct one is not
  ---
  duration_ms: 0.488957
  type: 'test'
  ...
# Subtest: module-classification.ts is absent from package.json's files[] array (bookkeeping, not shipped runtime behaviour)
ok 20 - module-classification.ts is absent from package.json's files[] array (bookkeeping, not shipped runtime behaviour)
  ---
  duration_ms: 0.646068
  type: 'test'
  ...
1..20
# tests 20
# suites 0
# pass 19
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 155.7006
```

## `src/mcp/vice/prg-image.test.ts` — verdict `kept-unchanged`

**SKIPPED.** verdict `kept-unchanged` owes no observed-red evidence (D-05); its evidence is the recorded removal trigger and classification, not a planted guard run. Not measured, and not silently omitted.

## `src/mcp/vice/removal-gate.test.ts` — verdict `kept-unchanged`

**SKIPPED.** verdict `kept-unchanged` owes no observed-red evidence (D-05); its evidence is the recorded removal trigger and classification, not a planted guard run. Not measured, and not silently omitted.

## `src/mcp/vice/shipped-modules.test.ts` — verdict `kept-unchanged`

**SKIPPED.** verdict `kept-unchanged` owes no observed-red evidence (D-05); its evidence is the recorded removal trigger and classification, not a planted guard run. Not measured, and not silently omitted.

## `src/mcp/vice/block-class.ts` — verdict `kept-unchanged`

**SKIPPED.** verdict `kept-unchanged` owes no observed-red evidence (D-05); its evidence is the recorded removal trigger and classification, not a planted guard run. Not measured, and not silently omitted.

## `src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs` — verdict `kept-unchanged`

**SKIPPED.** verdict `kept-unchanged` owes no observed-red evidence (D-05); its evidence is the recorded removal trigger and classification, not a planted guard run. Not measured, and not silently omitted.



---

# Appended 2026-09-01 — plan 32-15 Task 2: how this file was produced, and what the run measured

Everything ABOVE this line was written by `scripts/audit-mutation-harness.mjs` as the
`--out` target of the run recorded below. Nothing above it was hand-authored or hand-edited.
Its sha256 as the harness left it, before this section was appended:

```
67e5e3252b77d59515ee6920193ac96d7d946229b53b5cc0a1eb2a757aa87cf5  .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap4-sweep-rerun.md
```

## Machine state, read BEFORE anything ran

Read READ-ONLY, by the method `evidence/32-close-gate.md` records for broker state (the
`ps ... | grep -v grep` form, NOT `pgrep -af`, because the bare `pgrep` form self-matches its
own wrapping command line and reports a live broker on an idle host). Nothing in this plan
stops, starts, kills or restarts the `vice-broker` systemd user unit (D-13).

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

**Broker state for every figure in this document: unit `inactive` (exit 4), no broker
process, no emulator process.** Re-read unchanged before the suite run in Task 3.

## Three runs, not one — and why each happened

The plan called for one `--all` sweep. Three were run. None of them was a re-run of a red
until it went green; each of the first two ended in a NEW measured fact that had to be
removed before the next could be taken, and all three are recorded here in full.

| # | Commit | Start (UTC) | End (UTC) | Wall clock | Exit | Outcome |
|---|---|---|---|---|---|---|
| A | `5032275` | 2026-09-01T07:03:09Z | 2026-09-01T07:03:32Z | 23 s | 1 | **ABORTED** at `src/mcp/vice/hop-chain-comments.test.ts` — a THIRD blocker |
| B | `e1abf16` | 2026-09-01T07:08:25Z | 2026-09-01T07:09:07Z | 42 s | 1 | **COMPLETED** — 30 observed red, 4 UNMEASURABLE, 1 plant refused, 26 skipped |
| C | `e1abf16` | 2026-09-01T07:11:19Z | 2026-09-01T07:11:58Z | 39 s | 1 | **COMPLETED** — 34 observed red, 1 plant refused, 26 skipped. **This is the run above.** |

### Run A — the third blocker, measured

```
$ node scripts/audit-mutation-harness.mjs --all \
    --out .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap4-sweep-rerun.md
audit-mutation-harness: FAIL -- row src/mcp/vice/hop-chain-comments.test.ts: plant post-condition FAILED for src/mcp/vice/absorbed-answer-key.test.ts -- the recorded `replace` string occurs 1 time(s) in that file BEFORE the mutation and 1 time(s) after it, so the mutation would INTRODUCE it 0 time(s); exactly 1 is required. A mismatch means the bytes this harness would write are not the bytes this row records, so the row would promise a reader a hand-reproducible find/replace that does not reproduce. Nothing was written. The three counts are reported separately so the divergence can be located: whether the replacement reaches the mutated text at all, whether the write lands it more than once, and how many times it was already present independently of this mutation (CR-02, CR-06).
exit=1
```

The post-condition arithmetic was already corrected at this commit, and the row that the
verifier named (`scripts/lib/skill-honesty-checks.mjs`) was already passing. This is a
different row with the same defect class reached by a different mechanism: its `replace` is
its own `find` with a newline prepended, so the introduced occurrence textually OVERLAPS the
pre-existing one and the difference the verifier prescribed comes out **0**, not 1.

Measured over the whole registry rather than inferred — 34 of the 35 `re-pointed` rows
satisfy the corrected arithmetic and exactly one does not:

```
BAD  src/mcp/vice/hop-chain-comments.test.ts  file=src/mcp/vice/absorbed-answer-key.test.ts \
     findCount=1 pre=1 post=1 intro=0 changed=true

re-pointed rows OK=34 BAD=1
```

The descriptor itself is honest — `changed=true`, the mutation does reach disk and a reader
applying it by hand gets the same bytes. **The assertion was not weakened to let it through.**
What changed is its blast radius: a refused plant is now reported against its own row as
`PLANT REFUSED`, with the refusal message carried verbatim, instead of being thrown out of
the row loop. It still writes nothing, still suppresses the registry write-back and still
exits the run 1. This is the amplifier the verifier recorded as `IN-10`.

### Run B — completed, and the four UNMEASURABLE rows it exposed

```
$ node scripts/audit-mutation-harness.mjs --all \
    --out .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap4-sweep-rerun.md
audit-mutation-harness: selected 61 row(s)
  OBSERVED RED  src/mcp/vice/r2000-verb-coverage.test.ts: guard exit status 1 (control exit status 0)
                command: node --test anno-verb-coverage.test.ts
  OBSERVED RED  scripts/lib/r2000-cli-verbs.mjs: guard exit status 1 (control exit status 0)
                command: node scripts/check-skill-tool-coverage.mjs
  UNMEASURABLE  scripts/lib/r2000-cli-verbs.d.mts: the UNPLANTED control did not exit 0, so a subsequent red would prove nothing about the plant. Recorded as UNMEASURABLE rather than as an observed red.
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
  UNMEASURABLE  scripts/lib/skill-corpus.d.mts: the UNPLANTED control did not exit 0, so a subsequent red would prove nothing about the plant. Recorded as UNMEASURABLE rather than as an observed red.
  UNMEASURABLE  scripts/lib/skill-descriptions.d.mts: the UNPLANTED control did not exit 0, so a subsequent red would prove nothing about the plant. Recorded as UNMEASURABLE rather than as an observed red.
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
  PLANT REFUSED src/mcp/vice/hop-chain-comments.test.ts: the plant descriptor was REFUSED before any byte was written, so no guard run was attempted for this row and no evidence can be recorded from it: row src/mcp/vice/hop-chain-comments.test.ts: plant post-condition FAILED for src/mcp/vice/absorbed-answer-key.test.ts -- the recorded `replace` string occurs 1 time(s) in that file BEFORE the mutation and 1 time(s) after it, so the mutation would INTRODUCE it 0 time(s); exactly 1 is required. A mismatch means the bytes this harness would write are not the bytes this row records, so the row would promise a reader a hand-reproducible find/replace that does not reproduce. Nothing was written. The three counts are reported separately so the divergence can be located: whether the replacement reaches the mutated text at all, whether the write lands it more than once, and how many times it was already present independently of this mutation (CR-02, CR-06).
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
  UNMEASURABLE  src/mcp/vice/vice-proxy.test.ts: the UNPLANTED control did not exit 0, so a subsequent red would prove nothing about the plant. Recorded as UNMEASURABLE rather than as an observed red.
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
  evidence: /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap4-sweep-rerun.md
  registry: NOT written (a row's plant was refused; a row was unmeasurable)
  tree: restored byte-identical to the baseline
exit=1
```

Four rows came back UNMEASURABLE — their UNPLANTED green control did not exit 0, so the
harness refused to record a red from them. That refusal is correct, and the cause is named
rather than guessed. From the captured control output in that run's evidence file:

```
Error: Cannot find module '.../src/mcp/vice/node_modules/typescript/bin/tsc'
```

`src/mcp/vice/node_modules/` is gitignored and is provisioned on demand by
`scripts/ensure-mcp-deps.sh`; **a freshly forked git worktree has none**. Three of the four
rows share the guard `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` and one
(`src/mcp/vice/vice-proxy.test.ts`) failed with `ERR_MODULE_NOT_FOUND` from the same absence.
This is a property of the measuring environment, not of the registry and not of the
instrument. It was removed by running the repository's own committed provisioning step —
`npm ci --no-audit --no-fund` in `src/mcp/vice`, from the committed lockfile, adding no
package name that is not already in it:

```
$ cd src/mcp/vice && npm ci --no-audit --no-fund
added 237 packages in 3s
exit=0
```

`node_modules/` is gitignored, so `git status --porcelain` is unchanged by it.

### Run C — the recorded run, whose output is the body of this file

```
$ node scripts/audit-mutation-harness.mjs --all \
    --out .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap4-sweep-rerun.md
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
  PLANT REFUSED src/mcp/vice/hop-chain-comments.test.ts: the plant descriptor was REFUSED before any byte was written, so no guard run was attempted for this row and no evidence can be recorded from it: row src/mcp/vice/hop-chain-comments.test.ts: plant post-condition FAILED for src/mcp/vice/absorbed-answer-key.test.ts -- the recorded `replace` string occurs 1 time(s) in that file BEFORE the mutation and 1 time(s) after it, so the mutation would INTRODUCE it 0 time(s); exactly 1 is required. A mismatch means the bytes this harness would write are not the bytes this row records, so the row would promise a reader a hand-reproducible find/replace that does not reproduce. Nothing was written. The three counts are reported separately so the divergence can be located: whether the replacement reaches the mutated text at all, whether the write lands it more than once, and how many times it was already present independently of this mutation (CR-02, CR-06).
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
  evidence: /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap4-sweep-rerun.md
  registry: NOT written (a row's plant was refused)
  tree: restored byte-identical to the baseline
exit=1
```

All four rows that were UNMEASURABLE in run B are `OBSERVED RED` in run C, which confirms
the diagnosis: the absence of `node_modules` was the whole of it, and nothing about those
four rows' recorded evidence was in question.

## Did the sweep complete?

**Yes. The whole-set `--all` sweep completed.** In those words, and backed by the run rather
than by the claim: the harness printed its final summary block — the counts line, the
evidence path line, the registry line and the tree line — and those are only reachable after
the row loop has ended and the registry write-back decision has been taken.

Quoted verbatim from run C's captured stdout:

```
  counts: measured=35 skipped=26 total=61
  evidence: /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap4-sweep-rerun.md
  registry: NOT written (a row's plant was refused)
  tree: restored byte-identical to the baseline
```

35 measured + 26 skipped = 61, the registry's own row count. The body of this file carries
one `##` section per registry row, 61 of them.

`scripts/lib/skill-descriptions.mjs` — the `kept-unchanged` row that aborted the sweep at
registry index 22 before this plan — is reported as `SKIPPED` naming its verdict, and it
keeps its registry position immediately before `scripts/lib/skill-honesty-checks.mjs` at
index 23, which is itself reported as `OBSERVED RED`. It was not filtered out.

## The registry write-back: which of the two states was observed

**The write-back was NOT performed, deliberately, and the harness said so.** One row's plant
was refused, which is a hard failure, and `main()` does not write the registry on a hard
failure. Recorded as the harness's own line rather than as an invented diff:

```
  registry: NOT written (a row's plant was refused)
```

```
$ git diff --numstat -- .planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json
(no output — the file is byte-identical to HEAD)
```

There was therefore **no churn to discard** and no `git checkout --` was needed or run. No
dated `observedRed` block was rewritten by any of the three runs, and the round-1 evidence
file `evidence/32-tracer-observed-red.md` was never the output target — every run passed
`--out` explicitly.

```
$ node scripts/check-guard-fates.mjs
check-guard-fates: OK -- setA=43 setB=16 setC=2 total=61 rows=61 (floors setA=43 setB=16 setC=2 total=61)
  derived from 273 path(s) at 0394cbc; forward map 21 same-path / 15 renamed / 7 gone; set B 22 raw candidate(s) minus 6 already-claimed successor(s); set C parsed from .planning/ROADMAP.md line 846.
exit=0
```

Byte-identical to the reading taken before any change in this plan.

## Tree state around run C

```
$ git status --porcelain          # BEFORE
?? .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap4-sweep-rerun.md
```

```
$ git status --porcelain          # AFTER
?? .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap4-sweep-rerun.md
```

Byte-identical (`cmp` reports no difference). The single untracked entry is this file, which
is run C's own `--out` target. The harness's own tree line, captured from its baseline taken
at process start, agrees: `tree: restored byte-identical to the baseline`.

## The one row that is not green, left as a finding

`src/mcp/vice/hop-chain-comments.test.ts` is `PLANT REFUSED` and stays that way. It was not
re-run until it agreed, its descriptor was not edited, the assertion was not relaxed for it
and no opt-out was added to the registry. Its recorded `observedRed` from an earlier phase is
untouched. What this run establishes about it is exactly one thing: the committed instrument,
at this commit, cannot re-measure that one row, and it says so by name.
