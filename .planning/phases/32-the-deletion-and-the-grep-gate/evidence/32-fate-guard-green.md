# Phase 32 — the fate guard's pre-declared red, discharged

`scripts/check-guard-fates.mjs` has been **deliberately red since its landing commit**
(`371750e`, plan 32-01). Its own header says so:

> **PRE-DECLARED RED:** from its landing commit until the registry is complete, this
> script is EXPECTED to exit non-zero, naming the members that have no row. It is
> deliberately not wired into CI until the registry is complete and green. Nothing in this
> phase is recorded green over it while it is red.

This file is the audit trail that ordering constraint 5 exists for: **when** the red was
discharged, **by what**, and — the part that matters — **that it was discharged by
satisfying every rule rather than by loosening one**.

---

## 1. The green

Run in this plan's worktree, after the commit that completed the registry:

```
$ node scripts/check-guard-fates.mjs
check-guard-fates: OK -- setA=43 setB=16 setC=2 total=61 rows=61 (floors setA=43 setB=16 setC=2 total=61)
  derived from 273 path(s) at 0394cbc; forward map 21 same-path / 15 renamed / 7 gone; set B 22 raw candidate(s) minus 6 already-claimed successor(s); set C parsed from .planning/ROADMAP.md line 814.
$ echo $?
0
```

Every number in that line is **measured**, not asserted:

| quantity | measured | floor | agrees |
|---|---|---|---|
| set A | 43 | `SET_A_FLOOR` 43 | yes |
| set B | 16 | `SET_B_FLOOR` 16 | yes |
| set C | 2 | `SET_C_FLOOR` 2 | yes |
| union | 61 | `TOTAL_FLOOR` 61 | yes |
| registry rows | 61 | — (bijection) | yes |

The floors are asserted with `!==`, not `>=`, for each set. A derivation that silently
shrank *or* grew would red this check.

---

## 2. It was discharged by satisfaction, not by relaxation

This is the claim the whole phase turns on, so it is asserted mechanically rather than
promised.

**No instrument was modified.**

```
$ git diff --exit-code -- scripts/check-guard-fates.mjs scripts/lib/audit-root.mjs scripts/audit-mutation-harness.mjs
$ echo $?
0
```

**No floor moved.** `scripts/check-guard-fates.mjs` has exactly **one** commit in its
entire history:

```
$ git log --oneline --format="%h %s" -- scripts/check-guard-fates.mjs
371750e feat(32-01): prove one audited-set member end to end — derive, plant, observe red, revert
```

So the file that reported green is byte-for-byte the file plan 32-01 committed while it
was red. The only thing that changed between the red and the green is the **registry**.

**No relaxation hatch was added.**

```
$ grep -Eac 'WAIVER|process\.env\.[A-Z_]*(SKIP|ALLOW|FORCE)|--skip|--force' scripts/check-guard-fates.mjs
0
```

There is deliberately no such thing in this design: testability comes from `--root` only,
contained by `scripts/lib/audit-root.mjs` (D-12-14). The one parameter that looks like a
seam — `deriveAuditedSet({ roadmapText })` — is a test seam and not a hatch: it is never
supplied by the CLI, and every value it can take either leaves the derivation unchanged or
makes `resolveSetC()` **throw**. It cannot turn a red run green.

**Nothing was reclassified to fit.** Where a fact and a verdict did not line up, the fact
was written down rather than the verdict adjusted — see
`evidence/32-deferred-fates.md` section 5, and windows-ledger entries 29–31.

---

## 3. What the registry holds

61 rows, one per derived member, no duplicate `historicalPath` and no duplicate non-null
`newSubject` (the guard checks both directions; a row nobody derived is a "stranger row"
and fails).

| verdict | rows | evidence that verdict owes |
|---|---:|---|
| `re-pointed` | 35 | `newSubject` present on the working tree, plus a machine-captured non-zero `observedRed` behind a green exit-0 unplanted control |
| `kept-unchanged` | 19 | `newSubject === historicalPath`, path present, a non-empty `removalTrigger`, and **no** `observedRed` (the predicate rejects one) |
| `deleted` | 7 | `newSubject: null`, historical path absent, a resolvable `removingCommit` |
| **total** | **61** | |

Contributed by plan: 32-01 → 1, 32-06 → 14, 32-07 → 21, **32-08 → 25** (7 `deleted` +
16 set B + 2 set C).

---

## 4. The guard is still provably able to go red

A guard that has just gone green is exactly the guard most worth re-proving. Its own
non-vacuity test, run against the now-complete registry:

```
$ cd src/mcp/vice && node --test guard-fates.test.ts
# tests 21
# pass 21
# fail 0
exit 0   (1749 ms)
```

---

## 5. Every other gate, at the same commit

| gate | exit | first line |
|---|---:|---|
| `scripts/check-no-regenerator2000.mjs` | 0 | `OK -- scanned 406 files ... floor 350` |
| `scripts/check-npm-packages.mjs` | 0 | `transitive closure from vice-proxy.ts -- 57 modules, clean` |
| `scripts/check-skill-cli-invocations.mjs` | 0 | `OK -- 18 documented anno CLI invocation(s)` |
| `scripts/check-skill-description-overlap.mjs` | 0 | `OK -- 7 skills scanned` |
| `scripts/check-skill-fork-honesty.mjs` | 0 | `OK -- 11 fork-only mentions across 33 files` |
| `scripts/check-skill-tool-coverage.mjs` | 0 | `OK -- 37 distinct vice_* names` |
| `scripts/check-guard-fates.mjs` | 0 | `OK -- setA=43 setB=16 setC=2 total=61 rows=61` |
| `scripts/audit-gate.mjs` (**text**) | 0 | `OK -- 9 docs guards green, 7 milestone audits scanned` |
| `scripts/audit-gate.mjs --json` | 0 | `allowed=true redGuards=[] structuralErrors=[]` |
| `npm run typecheck` | 0 | — |
| `npm run test:automated` | **1** | 2950 tests, 2943 pass, **1 fail**, 1 skipped |

**`audit-gate.mjs` was run in TEXT mode as well as `--json` deliberately.** Windows-ledger
entry 28 (filed by plan 32-07) records that the `--json` branch ends
`process.exit(result.allowed ? 0 : 1)` at `:1210` and `allowed` tracks gated audits only,
so a structural error sits in the payload while the process exits 0. A `--json`-only check
here would have been a false green by construction. Both modes agree, so the green is
real.

**The one failure is the known worktree-only artifact**, `deferred-items.md` section 1:

```
not ok 1477 - path agreement (D-3, D-6, THE regression this task exists to catch): ...
              and the agreed path is not under .claude
```

`src/mcp/vice/repo-root.test.ts` asserts the agreed supervisor directory does not contain
`.claude`, which is false in **every** GSD worktree by construction — a worktree root is
`<repo>/.claude/worktrees/agent-*`. It is 0-fail in the main checkout, was not caused here,
and was not fixed or loosened. It is the identical count plan 32-07 measured
(2950 / 2943 / 1 / 1).

**It cannot have contaminated any red recorded by this plan.** Both of this plan's
observed reds run a single named test file (`anno-derivation.test.ts`,
`module-classification.test.ts`), neither of which is `repo-root.test.ts`, and each red is
bracketed by its own green exit-0 control on the identical command.

---

## 6. No red recorded here can be a timeout

`GUARD_RUN_TIMEOUT_MS` is 15000 ms and the harness maps a timeout to **status 1**, which is
indistinguishable from a failing assertion by exit status alone. Both of this plan's
candidate guards were therefore **timed unplanted before any plant was designed**:

| guard | unplanted runtime | bound | terminated on its own | control exit |
|---|---:|---:|---|---:|
| `anno-derivation.test.ts` | 449 ms | 15000 ms | yes | 0 |
| `module-classification.test.ts` | 457 ms | 15000 ms | yes | 0 |

Both are two orders of magnitude inside the bound. Structurally, too: **a control that
timed out cannot exit 0**, and both controls exited 0 on the identical command that later
produced the red. Neither captured excerpt contains timeout language; both name a failing
assertion by number and source line.

---

## 7. Re-derive this document

```bash
WT_ROOT=$(git rev-parse --show-toplevel) && cd "$WT_ROOT"

node scripts/check-guard-fates.mjs                      # section 1
git diff --exit-code -- scripts/check-guard-fates.mjs scripts/lib/audit-root.mjs scripts/audit-mutation-harness.mjs
git log --oneline --format="%h %s" -- scripts/check-guard-fates.mjs
grep -Eac 'WAIVER|process\.env\.[A-Z_]*(SKIP|ALLOW|FORCE)|--skip|--force' scripts/check-guard-fates.mjs
cd src/mcp/vice && node --test guard-fates.test.ts      # section 4
```
