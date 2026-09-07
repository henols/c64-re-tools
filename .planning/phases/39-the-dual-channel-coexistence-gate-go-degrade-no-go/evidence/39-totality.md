# Phase 39 — Totality walk transcript and recorded output

Owner: `39-01`. This file records the real, re-runnable output of
`totality-walk.mjs` (D-04): the executable proof that `DECISION-RULE.md`'s
fifteen rules are total over all 3,888 tuples of the seven `CHAN-01` gate
inputs, pairwise disjoint over `R1`..`R14`, and independent of
`TEXT_SINGLE_CLIENT` (`D-08`, proved mechanically rather than promised).

**No emulator was involved in producing this file.** The walk is pure
enumeration over the seven declared value domains; it makes no network
connection and spawns no `x64sc` process. The `BROKER_STATE:` and
`TEST_AUTOMATED_BASELINE:` lines below are included anyway so this file
matches every other evidence file's shape (`README.md` § *Evidence
conventions* 3, 4).

## Preflight

```
$ systemctl --user is-active vice-broker
inactive

$ pgrep -af x64sc | grep -v 'pgrep -af x64sc' || echo "no genuine x64sc process"
no genuine x64sc process
```

`BROKER_STATE: inactive`

```
$ cd src/mcp/vice && npm run test:automated
...
ℹ tests 3552
ℹ suites 24
ℹ pass 3537
ℹ fail 4
ℹ cancelled 0
ℹ skipped 6
ℹ todo 5
ℹ duration_ms 51736.984076

✖ failing tests:

test at anno-import.test.ts:352:1
✖ annoRegisterEntryFor(): both new tools have a register entry citing a real consumer path and a declared requirement id (2.480649ms)
  AssertionError: anno_import_ghidra_export cites requirement IMP-01, not found in REQUIREMENTS.md

test at anno-register.test.ts:385:1
✖ DIRECTION 5 (basis integrity): every entry cites at least one consumer AND at least one requirement id, every path exists, and every id is declared in .planning/REQUIREMENTS.md (8.477296ms)
  AssertionError: basis problems: 9 requirement ids well-shaped but not declared in REQUIREMENTS.md (STORE-01, STORE-06, IMP-01, IMP-02, AUTO-01, STORE-04, MCP-04)

test at anno-register.test.ts:479:1
✖ planted violation (the negative control): a CLEAN synthetic entry is reported by NONE of the predicates (1.670708ms)
  AssertionError: same basis-integrity predicate reporting the same undeclared-id problem on the synthetic control

test at host-scripts.test.ts:120:1
✖ `.gitignore` and install-resources.ts's deployed set (resourceEntries() + the deploy manifest) are in two-way parity (19.743984ms)
  AssertionError: .gitignore is missing /tools/vendor/dxa/dxa
```

`TEST_AUTOMATED_BASELINE: tests 3552 / pass 3537 / fail 4`
`TEST_AUTOMATED_BASELINE_FILES: anno-import.test.ts, anno-register.test.ts, host-scripts.test.ts`

This is a **higher** count than the phase-level baseline this dispatch was briefed with (2
failing tests in `anno-register.test.ts` alone). Per `README.md` § *Evidence conventions* 4,
this transcript records **what was observed at the time of this run**, not the previously
briefed number — the discrepancy is carried into `39-01-SUMMARY.md`'s deviations section
rather than silently reconciled here. None of the four failures touches this plan's files
(`evidence/`), and none is caused by this plan's changes (D-01: this plan touches nothing
outside `evidence/`); this file states the count observed and moves on, per the scope
boundary that pre-existing failures unrelated to the current task are not this plan's to fix.

## The walk itself

```
$ node .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/totality-walk.mjs
TOTAL_TUPLES: 3888
RULE_HIT_R1: 1296
RULE_HIT_R2: 1296
RULE_HIT_R3: 324
RULE_HIT_R4: 324
RULE_HIT_R5: 324
RULE_HIT_R6: 81
RULE_HIT_R7: 81
RULE_HIT_R8: 81
RULE_HIT_R9: 27
RULE_HIT_R10: 27
RULE_HIT_R11: 9
RULE_HIT_R12: 9
RULE_HIT_R13: 3
RULE_HIT_R14: 3
RULE_HIT_R15: 3
TOTALITY: holds
TSC_INDEPENDENCE: holds
COULD_NOT_RUN_EMITTABLE: no
TSC_GROUP_COUNT: 1296

$ echo "EXIT: $?"
EXIT: 0
```

## Recorded values (bare, column 0, outside the fence above)

Per `SCHEMA.md` § 1: "never inside a fenced block a reader would take for sample output" — the
fenced transcript above is the transcript; the lines below are the recorded values.

TOTAL_TUPLES: 3888
RULE_HIT_R1: 1296
RULE_HIT_R2: 1296
RULE_HIT_R3: 324
RULE_HIT_R4: 324
RULE_HIT_R5: 324
RULE_HIT_R6: 81
RULE_HIT_R7: 81
RULE_HIT_R8: 81
RULE_HIT_R9: 27
RULE_HIT_R10: 27
RULE_HIT_R11: 9
RULE_HIT_R12: 9
RULE_HIT_R13: 3
RULE_HIT_R14: 3
RULE_HIT_R15: 3
TOTALITY: holds
TSC_INDEPENDENCE: holds
COULD_NOT_RUN_EMITTABLE: no
BROKER_STATE: inactive
TEST_AUTOMATED_BASELINE: tests 3552 / pass 3537 / fail 4
TEST_AUTOMATED_BASELINE_FILES: anno-import.test.ts, anno-register.test.ts, host-scripts.test.ts

## What this proves

- **Totality (D-04).** Every one of the 3,888 tuples resolved to exactly one rule; the sum of
  the fifteen `RULE_HIT_*` lines above is `3888`, matching `TOTAL_TUPLES`.
- **Disjointness.** The walk's `main()` throws, naming the offending tuple and every rule id
  it matched, on any tuple matching more than one of `R1`..`R14`. It did not throw.
- **`could-not-run` is structurally unemittable (D-03).** `COULD_NOT_RUN_EMITTABLE: no` is
  computed from the rule set (every declared verdict is a member of `{go, degrade, no-go}`,
  and `R15`'s `test` function declares zero formal parameters, mechanically proving it
  consults no input) — not asserted in prose.
- **`TEXT_SINGLE_CLIENT` gates nothing (D-08).** `TSC_INDEPENDENCE: holds` over all 1,296
  tuple groups that differ only in that input (`TSC_GROUP_COUNT: 1296`, matching the arithmetic
  `3888 / 3 = 1296`).
- **`RULE_HIT_R15: 3`.** The `go` branch is reached at all three values of
  `TEXT_SINGLE_CLIENT` — the concrete instance of `D-08` that `DECISION-RULE.md` § *Totality*
  names as load-bearing.
