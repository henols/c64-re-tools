# Phase 32 — observed-red evidence (machine-captured)

Written by `scripts/audit-mutation-harness.mjs`. Every field below is a captured `spawnSync` result, not a transcription. Re-run the command in each row's **planted command** line after applying that row's plant to reproduce it.

- **Commit measured:** `f84b421cef669d2d160e876b79832adb8e12ffc7`
- **Measured at:** 2026-08-31T18:37:52.244Z
- **Root:** `/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a694495a31d3884f8`
- **Rows measured:** 2

## Tree state

`git status --porcelain` BEFORE the run (the baseline every row is compared to):

```
 M .planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json
?? .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-setb-repointed-rows.md
?? add-task1-rows.mjs
?? fix-mc-plant.mjs
?? fixture-census.mjs
?? gone-derive.mjs
?? gone-headers.mjs
?? setb-classify.mjs
?? setb-inspect.mjs
?? store-census.mjs
?? timerun.mjs
```

`git status --porcelain` AFTER the run:

```
 M .planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json
?? .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-setb-repointed-rows.md
?? add-task1-rows.mjs
?? fix-mc-plant.mjs
?? fixture-census.mjs
?? gone-derive.mjs
?? gone-headers.mjs
?? setb-classify.mjs
?? setb-inspect.mjs
?? store-census.mjs
?? timerun.mjs
```

**Byte-identical.** Every plant was reverted.

## `src/mcp/vice/anno-derivation.test.ts` — verdict `re-pointed`

### Green false-positive control (run BEFORE any plant)

- **Command:** `node --test anno-derivation.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `0` (must be 0)

Raw output:

```
TAP version 13
# (node:398873) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: Phase 19 pins and classifies all five upstream analysis procedures
ok 1 - Phase 19 pins and classifies all five upstream analysis procedures
  ---
  duration_ms: 3.492423
  type: 'test'
  ...
# Subtest: every non-curated upstream call carries a justification and a citation
ok 2 - every non-curated upstream call carries a justification and a citation
  ---
  duration_ms: 1.948032
  type: 'test'
  ...
# Subtest: ABS-04's re-sync triggers are named and each carries a mechanism
ok 3 - ABS-04's re-sync triggers are named and each carries a mechanism
  ---
  duration_ms: 0.47984
  type: 'test'
  ...
# Subtest: the elected licence is one of the two the upstream dual licence offers
ok 4 - the elected licence is one of the two the upstream dual licence offers
  ---
  duration_ms: 0.388419
  type: 'test'
  ...
# Subtest: live: the five source digests re-hash to the manifest's values
ok 5 - live: the five source digests re-hash to the manifest's values # SKIP the upstream re-hash check is skipped -- no clone of https://github.com/ricardoquesada/regenerator2000 at 493f840418f1450a342bb220c2fe3d2585dd0525 was found. Set R2000_UPSTREAM_CLONE to the checkout root to run it. Set VICE_REQUIRE_R2000_UPSTREAM=1 to make its absence a FAILURE instead of a SKIP.
  ---
  duration_ms: 0.289065
  type: 'test'
  ...
# Subtest: MCP-01 (forward): every curated or adapt-to-address-input verb has a route, every omit verb is absent under any spelling, and an unknown disposition fails outright
ok 6 - MCP-01 (forward): every curated or adapt-to-address-input verb has a route, every omit verb is absent under any spelling, and an unknown disposition fails outright
  ---
  duration_ms: 2.298149
  type: 'test'
  ...
# Subtest: MCP-01: the one verb with zero callers anywhere is not carried
ok 7 - MCP-01: the one verb with zero callers anywhere is not carried
  ---
  duration_ms: 0.431636
  type: 'test'
  ...
# Subtest: MCP-01 (ordering): the verdict is identical over reversed copies of BOTH the definition table and the procedure list
ok 8 - MCP-01 (ordering): the verdict is identical over reversed copies of BOTH the definition table and the procedure list
  ---
  duration_ms: 1.039478
  type: 'test'
  ...
# Subtest: MCP-01 (backward, D-08): every surface verb is either manifest-classified or carries a register entry citing at least one requirement id
ok 9 - MCP-01 (backward, D-08): every surface verb is either manifest-classified or carries a register entry citing at least one requirement id
  ---
  duration_ms: 1.284897
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
# duration_ms 429.265597
```

### Planted run

- **Plant:** `src/mcp/vice/anno-tools.ts`: `name: "anno_search",` → `name: "anno_searchZZ",`
- **Planted command:** `node --test anno-derivation.test.ts`
- **cwd:** `src/mcp/vice`
- **Exit status:** `1` (must be non-zero)

Raw output:

```
TAP version 13
# (node:398893) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: Phase 19 pins and classifies all five upstream analysis procedures
ok 1 - Phase 19 pins and classifies all five upstream analysis procedures
  ---
  duration_ms: 3.360205
  type: 'test'
  ...
# Subtest: every non-curated upstream call carries a justification and a citation
ok 2 - every non-curated upstream call carries a justification and a citation
  ---
  duration_ms: 1.150107
  type: 'test'
  ...
# Subtest: ABS-04's re-sync triggers are named and each carries a mechanism
ok 3 - ABS-04's re-sync triggers are named and each carries a mechanism
  ---
  duration_ms: 0.283975
  type: 'test'
  ...
# Subtest: the elected licence is one of the two the upstream dual licence offers
ok 4 - the elected licence is one of the two the upstream dual licence offers
  ---
  duration_ms: 0.197286
  type: 'test'
  ...
# Subtest: live: the five source digests re-hash to the manifest's values
ok 5 - live: the five source digests re-hash to the manifest's values # SKIP the upstream re-hash check is skipped -- no clone of https://github.com/ricardoquesada/regenerator2000 at 493f840418f1450a342bb220c2fe3d2585dd0525 was found. Set R2000_UPSTREAM_CLONE to the checkout root to run it. Set VICE_REQUIRE_R2000_UPSTREAM=1 to make its absence a FAILURE instead of a SKIP.
  ---
  duration_ms: 0.123121
  type: 'test'
  ...
# Subtest: MCP-01 (forward): every curated or adapt-to-address-input verb has a route, every omit verb is absent under any spelling, and an unknown disposition fails outright
ok 6 - MCP-01 (forward): every curated or adapt-to-address-input verb has a route, every omit verb is absent under any spelling, and an unknown disposition fails outright
  ---
  duration_ms: 1.425532
  type: 'test'
  ...
# Subtest: MCP-01: the one verb with zero callers anywhere is not carried
ok 7 - MCP-01: the one verb with zero callers anywhere is not carried
  ---
  duration_ms: 0.215572
  type: 'test'
  ...
# Subtest: MCP-01 (ordering): the verdict is identical over reversed copies of BOTH the definition table and the procedure list
ok 8 - MCP-01 (ordering): the verdict is identical over reversed copies of BOTH the definition table and the procedure list
  ---
  duration_ms: 0.586902
  type: 'test'
  ...
# Subtest: MCP-01 (backward, D-08): every surface verb is either manifest-classified or carries a register entry citing at least one requirement id
not ok 9 - MCP-01 (backward, D-08): every surface verb is either manifest-classified or carries a register entry citing at least one requirement id
  ---
  duration_ms: 2.159274
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a694495a31d3884f8/src/mcp/vice/anno-derivation.test.ts:451:1'
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
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a694495a31d3884f8/src/mcp/vice/anno-derivation.test.ts:470:10)
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
# duration_ms 413.05619
```

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
  duration_ms: 3.196431
  type: 'test'
  ...
# Subtest: DISCHARGE CLOSURE (plan 29-05): every discharged entry's fate resolves against disk -- a rename to a file that is there, or a deletion of a file that is not
ok 2 - DISCHARGE CLOSURE (plan 29-05): every discharged entry's fate resolves against disk -- a rename to a file that is there, or a deletion of a file that is not
  ---
  duration_ms: 1.26225
  type: 'test'
  ...
# Subtest: planted violation (discharge closure): a fate naming a nonexistent file, a self-rename, a missing fate and a survived deletion are all reported by the same predicate the real scan calls
ok 3 - planted violation (discharge closure): a fate naming a nonexistent file, a self-rename, a missing fate and a survived deletion are all reported by the same predicate the real scan calls
  ---
  duration_ms: 0.54848
  type: 'test'
  ...
# Subtest: DIRECTION 1 (completeness): every in-scope module and data file on disk has a registry entry, and the failure names it
ok 4 - DIRECTION 1 (completeness): every in-scope module and data file on disk has a registry entry, and the failure names it
  ---
  duration_ms: 0.562385
  type: 'test'
  ...
# Subtest: DIRECTION 2 (no orphans): every in-enumeration entry names a module that exists on disk
ok 5 - DIRECTION 2 (no orphans): every in-enumeration entry names a module that exists on disk
  ---
  duration_ms: 0.497145
  type: 'test'
  ...
# Subtest: DIRECTION 2 (encoding): the generated data file is matched by its FULL filename including the extension, never by a stem
ok 6 - DIRECTION 2 (encoding): the generated data file is matched by its FULL filename including the extension, never by a stem
  ---
  duration_ms: 0.299719
  type: 'test'
  ...
# Subtest: DIRECTION 3 (basis integrity): every entry's basis is non-empty, every cited consumer path exists on disk, and every requirement id is well-shaped
ok 7 - DIRECTION 3 (basis integrity): every entry's basis is non-empty, every cited consumer path exists on disk, and every requirement id is well-shaped
  ---
  duration_ms: 0.795055
  type: 'test'
  ...
# Subtest: DIRECTION 4 (the name prohibition): no entry's basis justifies its verdict by the module's name
ok 8 - DIRECTION 4 (the name prohibition): no entry's basis justifies its verdict by the module's name
  ---
  duration_ms: 1.40756
  type: 'test'
  ...
# Subtest: DIRECTION 5 (verdict coherence): extractables is non-empty if and only if the verdict is glue-with-extractable
ok 9 - DIRECTION 5 (verdict coherence): extractables is non-empty if and only if the verdict is glue-with-extractable
  ---
  duration_ms: 0.610411
  type: 'test'
  ...
# Subtest: DIRECTION 7 (adjacency): no two entries name the same module
ok 10 - DIRECTION 7 (adjacency): no two entries name the same module
  ---
  duration_ms: 0.690692
  type: 'test'
  ...
# Subtest: DIRECTION 7 (adjacency): out-of-enumeration AND discharged entries are excluded from the completeness loop rather than colliding with it
ok 11 - DIRECTION 7 (adjacency): out-of-enumeration AND discharged entries are excluded from the completeness loop rather than colliding with it
  ---
  duration_ms: 0.701828
  type: 'test'
  ...
# Subtest: DIRECTION 9 (precision): every advisory line citation is verified by containment -- the cited line contains the cited symbol
ok 12 - DIRECTION 9 (precision): every advisory line citation is verified by containment -- the cited line contains the cited symbol
  ---
  duration_ms: 3.608795
  type: 'test'
  ...
# Subtest: DIRECTION 9 (non-vacuity): the record actually carries advisory line citations for this direction to check
ok 13 - DIRECTION 9 (non-vacuity): the record actually carries advisory line citations for this direction to check
  ---
  duration_ms: 0.280436
  type: 'test'
  ...
# Subtest: DIRECTION 9b (prose citations): every `path:NN` cited in this module's OWN source resolves to a real file and a real, non-blank line
ok 14 - DIRECTION 9b (prose citations): every `path:NN` cited in this module's OWN source resolves to a real file and a real, non-blank line
  ---
  duration_ms: 4.955624
  type: 'test'
  ...
# Subtest: DIRECTION 9b (non-vacuity): the extractor actually finds prose citations, and some of them carry a symbol to contain
ok 15 - DIRECTION 9b (non-vacuity): the extractor actually finds prose citations, and some of them carry a symbol to contain
  ---
  duration_ms: 1.989633
  type: 'test'
  ...
# Subtest: DIRECTION 8 (ordering): re-running Directions 1-5, 7 and 9 over a REVERSED copy of the registry yields identical results
ok 16 - DIRECTION 8 (ordering): re-running Directions 1-5, 7 and 9 over a REVERSED copy of the registry yields identical results
  ---
  duration_ms: 7.175008
  type: 'test'
  ...
# Subtest: planted violation: the same predicates the real scan uses report all five synthetic bad entries, and do not report the clean one
ok 17 - planted violation: the same predicates the real scan uses report all five synthetic bad entries, and do not report the clean one
  ---
  duration_ms: 0.694588
  type: 'test'
  ...
# Subtest: planted violation: an in-scope file with no entry is reported by the same completeness predicate the real scan calls
ok 18 - planted violation: an in-scope file with no entry is reported by the same completeness predicate the real scan calls
  ---
  duration_ms: 0.774383
  type: 'test'
  ...
# Subtest: planted violation: a drifted advisory line citation is reported by lineCitationProblems(), and a correct one is not
ok 19 - planted violation: a drifted advisory line citation is reported by lineCitationProblems(), and a correct one is not
  ---
  duration_ms: 0.689937
  type: 'test'
  ...
# Subtest: module-classification.ts is absent from package.json's files[] array (bookkeeping, not shipped runtime behaviour)
ok 20 - module-classification.ts is absent from package.json's files[] array (bookkeeping, not shipped runtime behaviour)
  ---
  duration_ms: 0.980875
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
# duration_ms 257.569443
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
  duration_ms: 4.04524
  type: 'test'
  ...
# Subtest: DISCHARGE CLOSURE (plan 29-05): every discharged entry's fate resolves against disk -- a rename to a file that is there, or a deletion of a file that is not
ok 2 - DISCHARGE CLOSURE (plan 29-05): every discharged entry's fate resolves against disk -- a rename to a file that is there, or a deletion of a file that is not
  ---
  duration_ms: 2.594061
  type: 'test'
  ...
# Subtest: planted violation (discharge closure): a fate naming a nonexistent file, a self-rename, a missing fate and a survived deletion are all reported by the same predicate the real scan calls
ok 3 - planted violation (discharge closure): a fate naming a nonexistent file, a self-rename, a missing fate and a survived deletion are all reported by the same predicate the real scan calls
  ---
  duration_ms: 0.941657
  type: 'test'
  ...
# Subtest: DIRECTION 1 (completeness): every in-scope module and data file on disk has a registry entry, and the failure names it
ok 4 - DIRECTION 1 (completeness): every in-scope module and data file on disk has a registry entry, and the failure names it
  ---
  duration_ms: 0.958774
  type: 'test'
  ...
# Subtest: DIRECTION 2 (no orphans): every in-enumeration entry names a module that exists on disk
ok 5 - DIRECTION 2 (no orphans): every in-enumeration entry names a module that exists on disk
  ---
  duration_ms: 0.929262
  type: 'test'
  ...
# Subtest: DIRECTION 2 (encoding): the generated data file is matched by its FULL filename including the extension, never by a stem
not ok 6 - DIRECTION 2 (encoding): the generated data file is matched by its FULL filename including the extension, never by a stem
  ---
  duration_ms: 5.200354
  type: 'test'
  location: '/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a694495a31d3884f8/src/mcp/vice/module-classification.test.ts:483:1'
  failureType: 'testCodeFailure'
  error: 'the data file must have its own entry, keyed by its full filename'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a694495a31d3884f8/src/mcp/vice/module-classification.test.ts:495:10)
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
  duration_ms: 1.757559
  type: 'test'
  ...
# Subtest: DIRECTION 4 (the name prohibition): no entry's basis justifies its verdict by the module's name
ok 8 - DIRECTION 4 (the name prohibition): no entry's basis justifies its verdict by the module's name
  ---
  duration_ms: 2.444781
  type: 'test'
  ...
# Subtest: DIRECTION 5 (verdict coherence): extractables is non-empty if and only if the verdict is glue-with-extractable
ok 9 - DIRECTION 5 (verdict coherence): extractables is non-empty if and only if the verdict is glue-with-extractable
  ---
  duration_ms: 1.177444
  type: 'test'
  ...
# Subtest: DIRECTION 7 (adjacency): no two entries name the same module
ok 10 - DIRECTION 7 (adjacency): no two entries name the same module
  ---
  duration_ms: 1.329094
  type: 'test'
  ...
# Subtest: DIRECTION 7 (adjacency): out-of-enumeration AND discharged entries are excluded from the completeness loop rather than colliding with it
ok 11 - DIRECTION 7 (adjacency): out-of-enumeration AND discharged entries are excluded from the completeness loop rather than colliding with it
  ---
  duration_ms: 1.642698
  type: 'test'
  ...
# Subtest: DIRECTION 9 (precision): every advisory line citation is verified by containment -- the cited line contains the cited symbol
ok 12 - DIRECTION 9 (precision): every advisory line citation is verified by containment -- the cited line contains the cited symbol
  ---
  duration_ms: 7.452689
  type: 'test'
  ...
# Subtest: DIRECTION 9 (non-vacuity): the record actually carries advisory line citations for this direction to check
ok 13 - DIRECTION 9 (non-vacuity): the record actually carries advisory line citations for this direction to check
  ---
  duration_ms: 0.53448
  type: 'test'
  ...
# Subtest: DIRECTION 9b (prose citations): every `path:NN` cited in this module's OWN source resolves to a real file and a real, non-blank line
ok 14 - DIRECTION 9b (prose citations): every `path:NN` cited in this module's OWN source resolves to a real file and a real, non-blank line
  ---
  duration_ms: 6.56559
  type: 'test'
  ...
# Subtest: DIRECTION 9b (non-vacuity): the extractor actually finds prose citations, and some of them carry a symbol to contain
ok 15 - DIRECTION 9b (non-vacuity): the extractor actually finds prose citations, and some of them carry a symbol to contain
  ---
  duration_ms: 3.210487
  type: 'test'
  ...
# Subtest: DIRECTION 8 (ordering): re-running Directions 1-5, 7 and 9 over a REVERSED copy of the registry yields identical results
ok 16 - DIRECTION 8 (ordering): re-running Directions 1-5, 7 and 9 over a REVERSED copy of the registry yields identical results
  ---
  duration_ms: 14.170659
  type: 'test'
  ...
# Subtest: planted violation: the same predicates the real scan uses report all five synthetic bad entries, and do not report the clean one
ok 17 - planted violation: the same predicates the real scan uses report all five synthetic bad entries, and do not report the clean one
  ---
  duration_ms: 1.216782
  type: 'test'
  ...
# Subtest: planted violation: an in-scope file with no entry is reported by the same completeness predicate the real scan calls
ok 18 - planted violation: an in-scope file with no entry is reported by the same completeness predicate the real scan calls
  ---
  duration_ms: 1.921105
  type: 'test'
  ...
# Subtest: planted violation: a drifted advisory line citation is reported by lineCitationProblems(), and a correct one is not
ok 19 - planted violation: a drifted advisory line citation is reported by lineCitationProblems(), and a correct one is not
  ---
  duration_ms: 1.349389
  type: 'test'
  ...
# Subtest: module-classification.ts is absent from package.json's files[] array (bookkeeping, not shipped runtime behaviour)
ok 20 - module-classification.ts is absent from package.json's files[] array (bookkeeping, not shipped runtime behaviour)
  ---
  duration_ms: 1.93146
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
# duration_ms 364.572238
```

