# Phase 32 — Gap 3 harness correction: the one re-measured row

**Written 2026-09-01, gap-closure round 1, plan 32-14.** Everything below the
`## Provenance` heading in the "machine-captured" section is written by
`scripts/audit-mutation-harness.mjs` itself and is a captured `spawnSync` result, not a
transcription. This preamble is the only hand-written part of the file, and it records the
conditions the machine section cannot record about itself.

## Provenance

| Field | Value |
|-------|-------|
| **Commit measured** | `7638c6f1f7019e33b12845c93b7ad882904bbc42` |
| **Harness commit that produced the run** | `7638c6f` — plan 32-14 Task 1, `fix(32-14): the harness writes what it records, and a kill is not a failure` |
| **Branch / worktree** | `worktree-agent-a4c097c848a03c6d7` (stock GSD worktree isolation, wave 1) |
| **Exact command** | `node scripts/audit-mutation-harness.mjs --row src/mcp/vice/r2000-enum-gen.test.ts --out .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap3-harness-correction.md` |
| **Harness exit status** | `0` |
| **Node** | `v22.22.0` |
| **Measured at** | 2026-08-31T22:19:38.458Z (harness clock, UTC) |

## Broker state, read READ-ONLY, before the run

Nothing in this run stops, kills, restarts or otherwise touches the developer's
`vice-broker` systemd user unit (D-13). Both readings are read-only:

```
$ systemctl --user is-active vice-broker
inactive
exit=4
```

```
$ ps -eo pid,args | grep -i vice-broker | grep -v grep
747280 /home/henrik/.nvm/versions/node/v22.22.0/bin/node --test absorbed-answer-key.test.ts … vice-broker-acquire.test.ts vice-broker-client.test.ts vice-broker-supervision.test.ts …
exit=0
```

> **That `exit=0` is the documented process-name false positive, not a live broker.** It is a
> second instance of the trap `evidence/32-close-gate.md` §"Why `ps | grep -v grep` and not
> `pgrep -af vice-broker`" records: there, the shell wrapper's own command line matched; here,
> an unrelated `node --test` run matched because its argv lists the file names
> `vice-broker-acquire.test.ts`, `vice-broker-client.test.ts` and
> `vice-broker-supervision.test.ts`. Recording `exit=0` from it would assert a live broker on
> a host that has none. The method is the one that document established, not a second one
> invented here: read the matched line and check what it actually is. Narrowing the same
> read-only command settles it:

```
$ ps -eo pid,args | grep -i vice-broker | grep -v grep | grep -v -- "--test"
exit=1
```

```
$ ps -eo pid,args | grep -i x64sc | grep -v grep
exit=1
```

```
$ ls -la .vice-supervisor
ls: cannot access '.vice-supervisor': No such file or directory
```

**Broker state: DOWN.** Unit `inactive`, no broker process, no emulator process, no
`.vice-supervisor/` state directory. This matters because a live broker deterministically
reds the `BACK-05` test and the `stock-broker-live` family — a recorded fact, not a flake —
so any suite figure recorded without the broker's state beside it is uninterpretable. The
guard re-run below is `node --test anno-enum-gen.test.ts`, which touches no emulator, but the
reading is recorded anyway so the run is interpretable on its own terms.

## What this run establishes, and what it does not

**It establishes** that `src/mcp/vice/r2000-enum-gen.test.ts`'s successor guard,
`src/mcp/vice/anno-enum-gen.test.ts`, is red under the mutation its registry row **literally
records** — that is, with the fixed `plant()` writing
`` return `$${address.toString(16).toUpperCase().padStart(5, "0")}`; `` to disk byte for
byte, dollar-patterns intact — with a green unplanted control taken immediately before the
plant on the same tree, and with the tree restored byte-identical afterwards. Planted exit
status `1`; control exit status `0`. The failing comparison is now
`'$0D011' !== '$D011'` — six characters, sigil present — where the pre-fix record shows
`'0D011' !== '$D011'` — five characters, sigil deleted by the interpreted `$$`.

**It does not** re-establish any other row: 60 of the 61 rows were deliberately not re-run,
because none of them diverged and re-running them would rewrite 60 machine-captured records
for no finding. **It does not change any verdict**: the row was `re-pointed` and red before,
and is `re-pointed` and red now. `32-VERIFICATION.md` `gaps[2].reason` records the verifier's
own independent measurement that the guard is non-vacuous under either mutation; that
conclusion is cited, not re-measured here. **It does not** speak to `CR-04`: the
signal-termination fix is proven separately, against a throwaway scratch root, in plan
32-14's Task 1 and its SUMMARY.

`node scripts/check-guard-fates.mjs` was green at 61 rows both before and after this
re-measurement, printing the same measured line each time:

```
check-guard-fates: OK -- setA=43 setB=16 setC=2 total=61 rows=61 (floors setA=43 setB=16 setC=2 total=61)
  derived from 273 path(s) at 0394cbc; forward map 21 same-path / 15 renamed / 7 gone; set B 22 raw candidate(s) minus 6 already-claimed successor(s); set C parsed from .planning/ROADMAP.md line 830.
gate=0
```

---

# Phase 32 — observed-red evidence (machine-captured)

Written by `scripts/audit-mutation-harness.mjs`. Every field below is a captured `spawnSync` result, not a transcription. Re-run the command in each row's **planted command** line after applying that row's plant to reproduce it.

- **Commit measured:** `7638c6f1f7019e33b12845c93b7ad882904bbc42`
- **Measured at:** 2026-08-31T22:19:38.458Z
- **Root:** `/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7`
- **Rows measured:** 1

## Tree state

`git status --porcelain` BEFORE the run (the baseline every row is compared to):

```

```

`git status --porcelain` AFTER the run:

```

```

**Byte-identical.** Every plant was reverted.

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
  duration_ms: 7.545172
  type: 'test'
  ...
# Subtest: registerKeyFor formats addresses as $XXXX (uppercase, 4-hex-digit)
ok 2 - registerKeyFor formats addresses as $XXXX (uppercase, 4-hex-digit)
  ---
  duration_ms: 0.514664
  type: 'test'
  ...
# Subtest: variantNameFor is injective across all 256 values for $D011
ok 3 - variantNameFor is injective across all 256 values for $D011
  ---
  duration_ms: 2.872884
  type: 'test'
  ...
# Subtest: variantNameFor is injective across all 256 values for $D016
ok 4 - variantNameFor is injective across all 256 values for $D016
  ---
  duration_ms: 3.92335
  type: 'test'
  ...
# Subtest: variantNameFor is injective across all 256 values for $D018
ok 5 - variantNameFor is injective across all 256 values for $D018
  ---
  duration_ms: 1.794804
  type: 'test'
  ...
# Subtest: variantNameFor is injective across all 256 values for $D015
ok 6 - variantNameFor is injective across all 256 values for $D015
  ---
  duration_ms: 13.948142
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier rejects '1BAD', 'has space', 'has-dash', '' and accepts a legal identifier
ok 7 - assertLegalAcmeIdentifier rejects '1BAD', 'has space', 'has-dash', '' and accepts a legal identifier
  ---
  duration_ms: 20.317033
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier rejects a newline-bearing token and a token containing '='
ok 8 - assertLegalAcmeIdentifier rejects a newline-bearing token and a token containing '='
  ---
  duration_ms: 0.907999
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier rejects a reserved 6502 mnemonic, measured against real ACME (LDA)
ok 9 - assertLegalAcmeIdentifier rejects a reserved 6502 mnemonic, measured against real ACME (LDA)
  ---
  duration_ms: 4.483311
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier accepts a bare register letter (A/X/Y), measured NOT reserved against real ACME
ok 10 - assertLegalAcmeIdentifier accepts a bare register letter (A/X/Y), measured NOT reserved against real ACME
  ---
  duration_ms: 3.093752
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier rejects an identifier longer than the length ceiling
ok 11 - assertLegalAcmeIdentifier rejects an identifier longer than the length ceiling
  ---
  duration_ms: 1.2537
  type: 'test'
  ...
# Subtest: sanitizeVariantMap builds the {$hex: name} shape and sanitizes every value
ok 12 - sanitizeVariantMap builds the {$hex: name} shape and sanitizes every value
  ---
  duration_ms: 4.804755
  type: 'test'
  ...
# Subtest: sanitizeVariantMap refuses a bad token before returning anything
ok 13 - sanitizeVariantMap refuses a bad token before returning anything
  ---
  duration_ms: 0.472757
  type: 'test'
  ...
# Subtest: T-11-NAME-INJECT: sanitizeVariantMap refuses the injection shape (newline + '= $00') and returns NOTHING, so a rebuilt installer that calls it first cannot pass the name on
ok 14 - T-11-NAME-INJECT: sanitizeVariantMap refuses the injection shape (newline + '= $00') and returns NOTHING, so a rebuilt installer that calls it first cannot pass the name on
  ---
  duration_ms: 0.554149
  type: 'test'
  ...
# Subtest: pairSearchRows: a store at A+2 pairs with its immediate load; a store at A+3 does not
ok 15 - pairSearchRows: a store at A+2 pairs with its immediate load; a store at A+3 does not
  ---
  duration_ms: 4.926283
  type: 'test'
  ...
# Subtest: pairSearchRows: a store to a register the bit-name table does not know is not counted at all
ok 16 - pairSearchRows: a store to a register the bit-name table does not know is not counted at all
  ---
  duration_ms: 0.598708
  type: 'test'
  ...
# Subtest: pairSearchRows: register matching is case-insensitive on the operand's hex ($d011 and $D011 both pair)
ok 17 - pairSearchRows: register matching is case-insensitive on the operand's hex ($d011 and $D011 both pair)
  ---
  duration_ms: 0.739539
  type: 'test'
  ...
# Subtest: pairSearchRows: an unparsable immediate operand is skipped rather than fatal (D-23's 'a miss costs nothing')
ok 18 - pairSearchRows: an unparsable immediate operand is skipped rather than fatal (D-23's 'a miss costs nothing')
  ---
  duration_ms: 0.533553
  type: 'test'
  ...
# Subtest: pairSearchRows: a pass whose row count EQUALS the requested ceiling is reported as possibly truncated (D-23, no silent caps)
ok 19 - pairSearchRows: a pass whose row count EQUALS the requested ceiling is reported as possibly truncated (D-23, no silent caps)
  ---
  duration_ms: 0.753008
  type: 'test'
  ...
# Subtest: parseImmediateOperand parses hex, decimal and binary immediates, and refuses a non-immediate operand
ok 20 - parseImmediateOperand parses hex, decimal and binary immediates, and refuses a non-immediate operand
  ---
  duration_ms: 0.588204
  type: 'test'
  ...
# Subtest: planEnumsForPairing: two stores of the SAME value to one register produce ONE variant and TWO usages (D-20)
ok 21 - planEnumsForPairing: two stores of the SAME value to one register produce ONE variant and TWO usages (D-20)
  ---
  duration_ms: 0.912017
  type: 'test'
  ...
# Subtest: planEnumsForPairing: two DISTINCT values to one register produce two variants, and never a 256-value table
ok 22 - planEnumsForPairing: two DISTINCT values to one register produce two variants, and never a 256-value table
  ---
  duration_ms: 0.588171
  type: 'test'
  ...
# Subtest: planEnumsForPairing: a usage binds to the lda address, NEVER the store address (measured binding rule)
ok 23 - planEnumsForPairing: a usage binds to the lda address, NEVER the store address (measured binding rule)
  ---
  duration_ms: 0.944031
  type: 'test'
  ...
# Subtest: planEnumsForPairing: two different registers produce two separate enums
ok 24 - planEnumsForPairing: two different registers produce two separate enums
  ---
  duration_ms: 0.770678
  type: 'test'
  ...
# Subtest: buildEnumGenerationReport: the summary lines contain 'truncat' when a pass hit its ceiling, and always carry total/paired/unpaired
ok 25 - buildEnumGenerationReport: the summary lines contain 'truncat' when a pass hit its ceiling, and always carry total/paired/unpaired
  ---
  duration_ms: 1.144087
  type: 'test'
  ...
# Subtest: buildEnumGenerationReport: a run below its ceiling says NOTHING about truncation -- the signal must not be always-on
ok 26 - buildEnumGenerationReport: a run below its ceiling says NOTHING about truncation -- the signal must not be always-on
  ---
  duration_ms: 0.650349
  type: 'test'
  ...
# Subtest: buildEnumGenerationReport: an 'updated' action is reportable, so R2000-13's re-runnability stays expressible
ok 27 - buildEnumGenerationReport: an 'updated' action is reportable, so R2000-13's re-runnability stays expressible
  ---
  duration_ms: 0.664518
  type: 'test'
  ...
# Subtest: anno-enum-gen.ts never references the machine-global save_global_enum() route (D-21, zero-count grep)
ok 28 - anno-enum-gen.ts never references the machine-global save_global_enum() route (D-21, zero-count grep)
  ---
  duration_ms: 0.755427
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
# duration_ms 571.274961
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
  duration_ms: 13.164936
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.test.ts:79:1'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register $0D011 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.ts:190:11)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.test.ts:80:16)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
# Subtest: registerKeyFor formats addresses as $XXXX (uppercase, 4-hex-digit)
not ok 2 - registerKeyFor formats addresses as $XXXX (uppercase, 4-hex-digit)
  ---
  duration_ms: 2.65159
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.test.ts:83:1'
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
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.test.ts:84:10)
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
  duration_ms: 0.471326
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.test.ts:94:3'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register $0D011 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.ts:190:11)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.test.ts:97:20)
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
  duration_ms: 0.303524
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.test.ts:94:3'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register $0D016 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.ts:190:11)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.test.ts:97:20)
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
  duration_ms: 0.293938
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.test.ts:94:3'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register $0D018 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.ts:190:11)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.test.ts:97:20)
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
  duration_ms: 0.259716
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.test.ts:94:3'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register $0D015 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.ts:190:11)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.test.ts:97:20)
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
  duration_ms: 1.871346
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier rejects a newline-bearing token and a token containing '='
ok 8 - assertLegalAcmeIdentifier rejects a newline-bearing token and a token containing '='
  ---
  duration_ms: 0.546072
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier rejects a reserved 6502 mnemonic, measured against real ACME (LDA)
ok 9 - assertLegalAcmeIdentifier rejects a reserved 6502 mnemonic, measured against real ACME (LDA)
  ---
  duration_ms: 1.838327
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier accepts a bare register letter (A/X/Y), measured NOT reserved against real ACME
ok 10 - assertLegalAcmeIdentifier accepts a bare register letter (A/X/Y), measured NOT reserved against real ACME
  ---
  duration_ms: 1.217807
  type: 'test'
  ...
# Subtest: assertLegalAcmeIdentifier rejects an identifier longer than the length ceiling
ok 11 - assertLegalAcmeIdentifier rejects an identifier longer than the length ceiling
  ---
  duration_ms: 0.648254
  type: 'test'
  ...
# Subtest: sanitizeVariantMap builds the {$hex: name} shape and sanitizes every value
ok 12 - sanitizeVariantMap builds the {$hex: name} shape and sanitizes every value
  ---
  duration_ms: 2.018743
  type: 'test'
  ...
# Subtest: sanitizeVariantMap refuses a bad token before returning anything
ok 13 - sanitizeVariantMap refuses a bad token before returning anything
  ---
  duration_ms: 0.624044
  type: 'test'
  ...
# Subtest: T-11-NAME-INJECT: sanitizeVariantMap refuses the injection shape (newline + '= $00') and returns NOTHING, so a rebuilt installer that calls it first cannot pass the name on
ok 14 - T-11-NAME-INJECT: sanitizeVariantMap refuses the injection shape (newline + '= $00') and returns NOTHING, so a rebuilt installer that calls it first cannot pass the name on
  ---
  duration_ms: 0.524122
  type: 'test'
  ...
# Subtest: pairSearchRows: a store at A+2 pairs with its immediate load; a store at A+3 does not
ok 15 - pairSearchRows: a store at A+2 pairs with its immediate load; a store at A+3 does not
  ---
  duration_ms: 1.368267
  type: 'test'
  ...
# Subtest: pairSearchRows: a store to a register the bit-name table does not know is not counted at all
ok 16 - pairSearchRows: a store to a register the bit-name table does not know is not counted at all
  ---
  duration_ms: 0.429698
  type: 'test'
  ...
# Subtest: pairSearchRows: register matching is case-insensitive on the operand's hex ($d011 and $D011 both pair)
ok 17 - pairSearchRows: register matching is case-insensitive on the operand's hex ($d011 and $D011 both pair)
  ---
  duration_ms: 0.503883
  type: 'test'
  ...
# Subtest: pairSearchRows: an unparsable immediate operand is skipped rather than fatal (D-23's 'a miss costs nothing')
ok 18 - pairSearchRows: an unparsable immediate operand is skipped rather than fatal (D-23's 'a miss costs nothing')
  ---
  duration_ms: 0.707545
  type: 'test'
  ...
# Subtest: pairSearchRows: a pass whose row count EQUALS the requested ceiling is reported as possibly truncated (D-23, no silent caps)
ok 19 - pairSearchRows: a pass whose row count EQUALS the requested ceiling is reported as possibly truncated (D-23, no silent caps)
  ---
  duration_ms: 0.492831
  type: 'test'
  ...
# Subtest: parseImmediateOperand parses hex, decimal and binary immediates, and refuses a non-immediate operand
ok 20 - parseImmediateOperand parses hex, decimal and binary immediates, and refuses a non-immediate operand
  ---
  duration_ms: 0.388384
  type: 'test'
  ...
# Subtest: planEnumsForPairing: two stores of the SAME value to one register produce ONE variant and TWO usages (D-20)
not ok 21 - planEnumsForPairing: two stores of the SAME value to one register produce ONE variant and TWO usages (D-20)
  ---
  duration_ms: 1.09316
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.test.ts:242:1'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register $0D011 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.ts:190:11)
    planEnumsForPairing (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.ts:459:27)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.test.ts:247:19)
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
  duration_ms: 0.483547
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.test.ts:259:1'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register $0D011 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.ts:190:11)
    planEnumsForPairing (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.ts:459:27)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.test.ts:264:19)
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
  duration_ms: 0.609018
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.test.ts:270:1'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register $0D011 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.ts:190:11)
    planEnumsForPairing (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.ts:459:27)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.test.ts:272:19)
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
  duration_ms: 0.502724
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.test.ts:277:1'
  failureType: 'testCodeFailure'
  error: 'variantNameFor: no bit-name table entry for register $0D011 -- anno-regbits.json has no fields for this address (add an OVERRIDES entry in anno-regbits-gen.ts, or exclude it from generation).'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    variantNameFor (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.ts:190:11)
    planEnumsForPairing (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.ts:459:27)
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/anno-enum-gen.test.ts:282:19)
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
  duration_ms: 1.111644
  type: 'test'
  ...
# Subtest: buildEnumGenerationReport: a run below its ceiling says NOTHING about truncation -- the signal must not be always-on
ok 26 - buildEnumGenerationReport: a run below its ceiling says NOTHING about truncation -- the signal must not be always-on
  ---
  duration_ms: 0.606076
  type: 'test'
  ...
# Subtest: buildEnumGenerationReport: an 'updated' action is reportable, so R2000-13's re-runnability stays expressible
ok 27 - buildEnumGenerationReport: an 'updated' action is reportable, so R2000-13's re-runnability stays expressible
  ---
  duration_ms: 0.475756
  type: 'test'
  ...
# Subtest: anno-enum-gen.ts never references the machine-global save_global_enum() route (D-21, zero-count grep)
ok 28 - anno-enum-gen.ts never references the machine-global save_global_enum() route (D-21, zero-count grep)
  ---
  duration_ms: 3.056057
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
# duration_ms 641.121634
```

