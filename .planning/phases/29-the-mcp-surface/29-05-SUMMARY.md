---
phase: 29-the-mcp-surface
plan: 05
subsystem: infra
tags: [rename, guards, module-classification, removal-gate, packaging, ci]

requires:
  - phase: 29-01
    provides: the curated `anno_*` surface and the seven registration-time guards the renamed modules now sit beside
  - phase: 29-04
    provides: anno-derive.ts / anno-details.ts / anno-derive.test.ts, three additional consumers the rename census had to see
  - phase: 29-02
    provides: scripts/check-no-regenerator2000.mjs with a dated allow-list keyed to 29-05 / 29-09 / 29-10, and 29-BASELINE.md's failing-file SET
provides:
  - Nine capability modules and the CLI on the `anno-` prefix, with every importer, path read, comment citation and `files[]` entry moved in the same commit
  - A `ModuleFate` type and a third `discharged` scope in module-classification.ts, with a fate recorded for each of the ten discharged entries
  - A discharge-closure relation replacing DIRECTION 6's `disk.length > 0`, so the registry's non-vacuity survives its own enumeration emptying
  - `ANNO_MODULE_FLOOR = 15`, measured, over `/^anno-.*\.ts$/`, with a four-name positive control that all exist
  - A line-scoped (`atLines`) exemption shape in the removal gate, which is what makes a SPLIT file expressible without widening anything
  - A removal gate with zero entries citing 29-05 and no entry naming a path this plan moved
affects: [29-07, 29-08, 29-09, 29-10, 29-11, 29-12]

actuals:
  tokens: 55839
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Line-scoped removal-gate exemption (`atLines`): a bucket is a property of a MENTION, not of a file"
    - "Discharge-closure: a registry entry that leaves an enumeration carries a fate that is checked against disk"

key-files:
  created:
    - src/mcp/vice/anno-acme-ident.ts
    - src/mcp/vice/anno-confidence.ts
    - src/mcp/vice/anno-coverage.ts
    - src/mcp/vice/anno-d64.ts
    - src/mcp/vice/anno-enum-gen.ts
    - src/mcp/vice/anno-memmap-render.ts
    - src/mcp/vice/anno-regbits-gen.ts
    - src/mcp/vice/anno-regbits.json
    - src/mcp/vice/anno-symbols.ts
    - src/mcp/vice/anno-cli.ts
    - src/mcp/vice/spawn-seam.test.ts
    - src/mcp/vice/absorbed-answer-key.test.ts
    - src/mcp/vice/anno-derivation.test.ts
    - src/mcp/vice/docs-absorbed-decisions.test.ts
    - scripts/lib/anno-cli-verbs.mjs
    - scripts/lib/anno-cli-verbs.d.mts
  modified:
    - src/mcp/vice/module-classification.ts
    - src/mcp/vice/module-classification.test.ts
    - src/mcp/vice/hostpath-consumers.test.ts
    - src/mcp/vice/anno-seam.test.ts
    - src/mcp/vice/vice-proxy.ts
    - src/mcp/vice/package.json
    - scripts/check-no-regenerator2000.mjs
    - scripts/audit-gate.mjs
    - scripts/check-skill-tool-coverage.mjs
    - scripts/check-npm-packages.mjs
    - .planning/ARCHITECTURE.md

key-decisions:
  - "The rename set is nine, derived entry by entry from module-classification.ts's eleven `capability` verdicts minus the two whose own `note` fields contest survival (D-03, D-16) -- confirmed as nine before anything moved"
  - "A discharged registry entry keys on the NEW filename and its fate records both `from` and `to`; the scope means the module no longer answers to the ENUMERATION, not that it no longer exists"
  - "`inEnumerationOnDisk()` deliberately KEEPS the retired prefix -- its subject is what remains in scope, and widening it to follow the survivors would re-import them into a scope whose whole purpose is to empty"
  - "Measured correction: ONE file splits across both gate buckets, not two. anno-coverage.ts is 2 permanent + 2 temporary; anno-coverage.test.ts's single mention is wholly permanent"
  - "The gate gained a line-scoped `atLines` exemption shape rather than a widened path exemption, because the pre-existing gate structure refuses a file that is in both blocks"
  - "docs-uat-abstention.test.ts was registered in EXPECTED_DOCS_GUARD_NAMES (Rule 2): it was the cause of both pre-existing audit-integrity.test.ts failures, and it clears with NO floor change"

patterns-established:
  - "Fate-carrying registry entries: `discharged` scope + `ModuleFate`, checked by a closure relation with its own non-emptiness assertion and a four-case planted violation"
  - "Line-scoped gate exemptions: an occurrence at a pinned line is exempt, every other occurrence in the same file falls through to the allow-list or to the reintroduction error"

requirements-completed: [MCP-05]

coverage:
  - id: D1
    description: "Nine capability modules renamed out from under the retired prefix, driven entry by entry from the classification registry"
    requirement: "MCP-05"
    verification:
      - kind: unit
        ref: "src/mcp/vice/module-classification.test.ts#DIRECTION 2 (no orphans)"
        status: pass
      - kind: other
        ref: "ls of all nine anno-* paths; git log --follow resolves each to its predecessor (3-18 commits each)"
        status: pass
      - kind: integration
        ref: "node scripts/check-npm-packages.mjs"
        status: pass
    human_judgment: false
  - id: D2
    description: "The registry records each discharged module's fate, and the record is checked against disk rather than asserted"
    requirement: "MCP-05"
    verification:
      - kind: unit
        ref: "src/mcp/vice/module-classification.test.ts#DISCHARGE CLOSURE (plan 29-05)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/module-classification.test.ts#planted violation (discharge closure)"
        status: pass
      - kind: other
        ref: "plant-and-revert probe: fate.to set to anno-coverage-GHOST.ts -> exactly the closure test reddens; reverted -> 20/20 green"
        status: pass
    human_judgment: false
  - id: D3
    description: "The CLI and its verb-parsing seam are renamed, with the invocation literal and the subcommand token deliberately left for 29-09"
    requirement: "MCP-05"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-verb-coverage.test.ts (real-source parse + planted violation)"
        status: pass
      - kind: integration
        ref: "node scripts/check-skill-tool-coverage.mjs -- 8 verbs parsed from anno-cli.ts, 8/8 resolved"
        status: pass
      - kind: other
        ref: "git diff --numstat HEAD -- src/mcp/vice/vice-proxy.ts => 2 added / 2 deleted (line-neutral)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The module floor is re-expressed over the anno- prefix as a measured raise, with a positive control naming four real current files"
    requirement: "MCP-05"
    verification:
      - kind: unit
        ref: "src/mcp/vice/hostpath-consumers.test.ts#the annotation module family ... non-vacuity floor"
        status: pass
      - kind: other
        ref: "plant-and-revert probe: regex changed to /^annoZZZ-.*\\.ts$/ -> floor, positive control and absence loop all redden; reverted -> 12/12 green"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every guard that breaks on the rename moved with it, including D-12's paired audit-gate registry entry in one commit"
    requirement: "MCP-05"
    verification:
      - kind: unit
        ref: "src/mcp/vice/audit-integrity.test.ts (49/49 green, including CR-02's registry-drift detector)"
        status: pass
      - kind: integration
        ref: "node scripts/audit-gate.mjs"
        status: pass
    human_judgment: false
  - id: D6
    description: "The removal gate is green at every commit this plan made, with no entry naming a moved path and every surviving mention in a recorded bucket"
    requirement: "MCP-05"
    verification:
      - kind: integration
        ref: "node scripts/check-no-regenerator2000.mjs -- exit 0 at 63c1fe3, 388e66a, c59fcef and 9c4b58d"
        status: pass
      - kind: other
        ref: "plant-and-revert probes: an extra mention in absorbed-answer-key.test.ts fails the permanent pin; an extra mention in anno-coverage.ts OUTSIDE the pinned lines falls through to the allow-list and fails its pin"
        status: pass
    human_judgment: false

duration: 29 min
completed: 2026-08-29
status: complete
---

# Phase 29 Plan 05: Rename the Surviving Capabilities Summary

**Nine capability modules and the CLI moved out from under the retired prefix — driven entry by entry from the classification registry rather than by a glob — with the registry gaining a checked `ModuleFate`, the module floor re-expressed as a measured raise to 15, and every gate entry that named a moved path re-pointed and re-bucketed in the same commit as its `git mv`.**

## Performance

- **Duration:** 29 min (start 2026-08-29 18:10 CEST, end 18:39 CEST)
- **Tasks:** 3 planned, 3 completed
- **Commits:** 4 (three task commits plus one Rule 1 auto-fix)
- **Files changed:** 68 (+957 / −457)

## Accomplishments

1. **The rename set was DERIVED, and the derivation was confirmed before anything moved.** `module-classification.ts` carries eleven `capability` verdicts. Two — `r2000-test-gate.ts` and `r2000-verify.ts` — carry `note` fields saying in terms that the verdict must not be read as a claim the module survives a prefix deletion. Eleven minus two is nine, which is what the plan predicted, so nothing was stopped or reported. The nine are acme-ident, confidence, coverage, d64, enum-gen, memmap-render, regbits-gen, symbols and the generated `regbits.json` data file. Seven co-located tests moved with them; `r2000-symbol-roundtrip.test.ts` was deliberately NOT swept up, because it is the live symbol round trip whose deletion 29-10 owns as an explicit recorded choice.

2. **The registry now records fates, and the record is checked against disk.** `ModuleFate` (a rename with `from`/`to`, or a deletion with an optional `supersededBy`) sits beside `ModuleVerdict`; `discharged` is a third `ModuleScope` value documented in the same voice as the other two. Ten entries carry it — the nine capabilities plus the CLI. DIRECTION 6's `disk.length > 0` assertion, which this phase would legitimately have taken to zero, is replaced by a **discharge-closure relation** with its own non-emptiness assertion and a four-case planted violation driving the same predicate the real scan calls.

3. **The CLI and its verb-parsing seam moved, and exactly two things did not.** `verbsMissingFromSkills`'s `` `r2000 ${verb}` `` invocation literal and `vice-proxy.ts:277`'s subcommand token are unchanged, because changing either half while the skill files still spell it the old way reds FLOW-01 from the wrong side; both move in 29-09. `stripComments()` and its rationale comment are carried verbatim. `vice-proxy.ts` is line-neutral: `git diff --numstat` reports 2 added / 2 deleted.

4. **The module floor is a raise on its literal reading.** `ANNO_MODULE_FLOOR = 15`, measured on disk with `ls | grep -E '^anno-.*\.ts$' | grep -v '\.test\.'`, strictly greater than the `R2000_MODULE_FLOOR = 14` it replaces. The positive control names `anno-acme-ident.ts`, `anno-regbits-gen.ts`, `anno-symbols.ts` and `anno-store.ts`; the fourth INT-01 name (the availability-gate module) is substituted because 29-10 deletes it, and the substitution's reason is in the test's own comment.

5. **The removal gate was re-pointed AND re-bucketed in the same commits as the moves, and it is green at every one of them.**

## Removal-gate evidence (Task 3 acceptance criterion)

Final run, at `9c4b58d`, as the last command of this plan:

```
check-no-<subject>: OK -- scanned 399 files (369 tracked outside ".planning/"
  + 30 shipped-but-untracked installer paths, floor 350);
  165 occurrence(s) permanently exempt, 263 temporarily allow-listed across 42 entries.
  permanent exemptions (exact pins):
    gate-self                            5
    findings-docs                        47
    attribution-guard-test               12
    upstream-audit-manifest-provenance   3
    memmap-measurement-provenance        1
    enum-name-threat-history             1
    census-design-and-incident-records   3
    renamed-guard-disciplines            43
    surviving-provenance                 21
    planted-fixtures                     2
    notices-attribution-blocks           27
  temporary allow-list by discharging plan (opened 2026-08-29, must be EMPTY at phase close):
    29-07                                27
    29-09                                65
    29-10                                167
    29-12                                4
```

**Exit status 0. Scanned-file count 399, unchanged from before the plan.** Before
the plan it read `118 permanently exempt, 312 temporarily allow-listed across 49
entries`, with `29-05 97 / 29-09 65 / 29-10 150`. The arithmetic reconciles
exactly: `165 + 263 = 428`, against `118 + 312 = 430` before, and the difference
of **2** is the two mentions this plan discharged by scrubbing (below). Entry
count `49 − 14 + 7 = 42`. **No entry cites 29-05.**

### The counting convention, measured from the gate's own output

**The gate's exact counts are OCCURRENCES, not lines** — `subjectHits()` returns
one entry per occurrence, and its own doc comment says `hits.length` is directly
comparable with `grep -aoi … | wc -l`. The one file where the two differ is
**`spawn-seam.test.ts`: 39 occurrences on 38 lines**, because line 231 carries
the needle twice in a single test name (`test("every discovered … spawn site
calls assertNoViceFlag(argv) before every … spawn in that file"`). Measured:
`grep -aoi | wc -l` → 39, `grep -aci` → 38, and the gate reports **39**. Plan
29-11's emptiness assertion must therefore compare occurrence counts, not line
counts.

## The 25-row reconciliation, measured at execution time

Re-measured at `598b22a` with `grep -aoi 'regenerator2000' <file> | wc -l`
(occurrences, `-a` throughout for the NUL-byte reason). **Every figure in the
plan's table reproduced exactly; the grand total is 99, permanent 51 +
temporary 48.** One row per rename source, including the thirteen zeroes, with
a bucket in every cell.

| # | Task | Rename source → target | Hits | Bucket | Gate class / citing plan |
|---|---|---|---|---|---|
| 1 | 1 | `r2000-acme-ident.ts` → `anno-acme-ident.ts` | 1 | permanent | `enum-name-threat-history` |
| 2 | 1 | `r2000-confidence.ts` → `anno-confidence.ts` | 0 | none needed | — |
| 3 | 1 | `r2000-confidence.test.ts` → `anno-confidence.test.ts` | 0 | none needed | — |
| 4 | 1 | `r2000-coverage.ts` → `anno-coverage.ts` | 4 | **split: 2 permanent + 2 temporary** | `census-design-and-incident-records` / 29-10 |
| 5 | 1 | `r2000-coverage.test.ts` → `anno-coverage.test.ts` | 1 | permanent | `census-design-and-incident-records` |
| 6 | 1 | `r2000-coverage-grammar.test.ts` → `anno-coverage-grammar.test.ts` | 0 | none needed | — |
| 7 | 1 | `r2000-d64.ts` → `anno-d64.ts` | 0 | none needed | — |
| 8 | 1 | `r2000-d64.test.ts` → `anno-d64.test.ts` | 0 | none needed | — |
| 9 | 1 | `r2000-enum-gen.ts` → `anno-enum-gen.ts` | 4 | temporary | 29-10 |
| 10 | 1 | `r2000-enum-gen.test.ts` → `anno-enum-gen.test.ts` | 4 | temporary | 29-10 |
| 11 | 1 | `r2000-memmap-render.ts` → `anno-memmap-render.ts` | 1 | permanent | `memmap-measurement-provenance` (line-pinned at 79) |
| 12 | 1 | `r2000-memmap-render.test.ts` → `anno-memmap-render.test.ts` | 4 | temporary | **29-12** (D-17) |
| 13 | 1 | `r2000-regbits-gen.ts` → `anno-regbits-gen.ts` | 0 | none needed | — |
| 14 | 1 | `r2000-regbits.json` → `anno-regbits.json` | 0 | none needed | — |
| 15 | 1 | `r2000-regbits.test.ts` → `anno-regbits.test.ts` | 0 | none needed | — |
| 16 | 1 | `r2000-symbols.ts` → `anno-symbols.ts` | 7 | temporary | 29-10 |
| 17 | 2 | `r2000-cli.ts` → `anno-cli.ts` | 13 | temporary | 29-07 |
| 18 | 2 | `r2000-cli.test.ts` → `anno-cli.test.ts` | 14 | temporary | 29-07 |
| 19 | 2 | `r2000-verb-coverage.test.ts` → `anno-verb-coverage.test.ts` | 0 | none needed | — |
| 20 | 2 | `scripts/lib/r2000-cli-verbs.mjs` → `anno-cli-verbs.mjs` | 0 | none needed | — |
| 21 | 2 | `scripts/lib/r2000-cli-verbs.d.mts` → `anno-cli-verbs.d.mts` | 0 | none needed | — |
| 22 | 3 | `r2000-spawn-seam.test.ts` → `spawn-seam.test.ts` | 39 | permanent | `renamed-guard-disciplines` |
| 23 | 3 | `r2000-upstream-audit.test.ts` → `anno-derivation.test.ts` | 3 | permanent | `upstream-audit-manifest-provenance` |
| 24 | 3 | `r2000-answer-key.test.ts` → `absorbed-answer-key.test.ts` | 2 | permanent | `renamed-guard-disciplines` |
| 25 | 3 | `docs-r2000-decisions.test.ts` → `docs-absorbed-decisions.test.ts` | 2 | permanent | `renamed-guard-disciplines` |
| | | **permanent 51 + temporary 48** | **99** | | |

Cross-check against the gate's own class totals: permanent from the rename set
is `39 + 2 + 2` (`renamed-guard-disciplines` = 43) `+ 3` (upstream-audit) `+ 1`
(memmap) `+ 1` (enum-name-threat) `+ 3` (census-design) **= 51**. Temporary from
the rename set is `13 + 14` (29-07) `+ 7 + 4 + 4 + 2` (29-10) `+ 4` (29-12)
**= 48**.

### The split file, itemised per mention

**Measured correction to the plan: ONE file splits across both buckets, not
two.** The plan's prose says "the two files whose mentions split" and then
itemises five mentions across `anno-coverage.ts` (4) and `anno-coverage.test.ts`
(1). Measured, `anno-coverage.test.ts`'s single mention is **wholly permanent**,
so it is not split and carries no temporary entry — writing a zero-count
temporary entry citing a plan with nothing to discharge would have been an
unreachable orphan, which is exactly the defect the reachability rule exists
against. `anno-coverage.ts` alone carries an entry in **both** blocks, `2 + 2`,
summing to its measured total of 4.

| Line | Text in one phrase | Bucket | Where it lands |
|---|---|---|---|
| `anno-coverage.ts:9` | asking the analyser what it classified as `Code` is CIRCULAR, provably so at `analyzer.rs:445-540` | permanent | `census-design-and-incident-records`, `atLines: [9, 1752]` |
| `anno-coverage.ts:1703` | label names arrive "from a … project file the operator did not necessarily author" | temporary | allow-list, cites **29-10** |
| `anno-coverage.ts:1752` | WR-13's recorded reproduction: label names are routinely ordinary English words | permanent | `census-design-and-incident-records`, `atLines: [9, 1752]` |
| `anno-coverage.ts:1979` | `DIVERGENCE_NOTE`, the store-side auto-merge bias — the one runtime user-facing string | temporary | allow-list, cites **29-10** |
| `anno-coverage.test.ts:1549` | the same WR-13 reproduction on the test side | permanent | `census-design-and-incident-records`, `atLines: [1549]` |

**The gate as built at wave 1 could not express this**, and that is a finding
rather than a workaround: `exemptionFor()` matched whole paths, and a file that
was both permanently exempt and allow-listed failed with *"one file cannot be
both"*. A **line-scoped `atLines` exemption shape** was added — an occurrence at
a pinned line is exempt, and **every other occurrence in the same file falls
through** to the allow-list, or to the reintroduction error if there is no
entry. It NARROWS rather than widens: the both-blocks conflict assertion still
fires for any file not carrying a recorded line-scoped split, and the pin
asserts BOTH how many and which. Probed live (below).

### Two allow-listed mentions this plan discharged by scrubbing

The wave-1 allow-list gave 29-05 **fourteen** entries, two of which were not
rename sources and therefore have no row in the 25-row table above. Both are
files this plan edits **in place**, so scrubbing them costs no pure-move
reviewability, and neither statement stays true after the deletion:

| File | Line | Was | Now |
|---|---|---|---|
| `src/mcp/vice/module-classification.ts` | 8 | `// regenerator2000 integration -- CUT-01 sizes it at a net ~12.4k lines out` | `// rented static-analysis integration -- CUT-01 sizes it at …` |
| `src/mcp/vice/hostpath-consumers.test.ts` | 234 | test name: `… regenerator2000 runs container-side (D-R4) …` | `… the rented analyser ran container-side (D-R4) …` |

These two are the entire `430 → 428` delta.

## The reachability walk, entry by entry, against the real plan manifests

Half 1 of the derived constraint: a temporary entry may cite only a plan
carrying **both** `scripts/check-no-regenerator2000.mjs` **and the file the
entry names** in that plan's own `files_modified`. Walked against the actual
frontmatter of `29-07-PLAN.md`, `29-10-PLAN.md` and `29-12-PLAN.md` on disk, not
against the planning prose:

| Entry | Hits | Cites | Gate in cited plan? | File in cited plan? | Verdict |
|---|---|---|---|---|---|
| `anno-cli.ts` | 13 | 29-07 | yes | yes | reachable |
| `anno-cli.test.ts` | 14 | 29-07 | yes | yes | reachable |
| `anno-symbols.ts` | 7 | 29-10 | yes | yes | reachable |
| `anno-enum-gen.ts` | 4 | 29-10 | yes | yes | reachable |
| `anno-enum-gen.test.ts` | 4 | 29-10 | yes | yes | reachable |
| `anno-coverage.ts` (temporary half) | 2 | 29-10 | yes | yes | reachable |
| `anno-memmap-render.test.ts` | 4 | 29-12 | yes | yes | reachable |

All seven reachable; nothing halted.

Half 2 (count-neutrality, permanent entries included), walked the same way:
`anno-memmap-render.ts` (1) has 29-10 and 29-12 as its only later editors and
both carry the gate; `spawn-seam.test.ts` (39) is edited by 29-10, which carries
the gate; `anno-derivation.test.ts` (3) is edited by 29-08, which does **not**
carry the gate and takes the stated-count-neutral arm (it also runs the gate in
`<verify>`), and is additionally listed by 29-10, which does carry it.
`anno-acme-ident.ts`, `anno-coverage.test.ts`, `absorbed-answer-key.test.ts` and
`docs-absorbed-decisions.test.ts` have no later editor in this phase.

## Guards proved non-vacuous by plant-and-revert

The plan's one `unverified` prohibition is that no guard may be re-pointed at a
subject that cannot fail. Four probes, each planted, observed red, and reverted:

| Probe | Planted | Observed |
|---|---|---|
| Discharge closure | `fate.to` for the census set to `anno-coverage-GHOST.ts` | exactly `DISCHARGE CLOSURE (plan 29-05)` reddens; reverted → 20/20 green |
| Module floor | derivation regex changed to `/^annoZZZ-.*\.ts$/` | the floor, the INT-01 positive control and the absence loop all redden; reverted → 12/12 green |
| Permanent exemption | one extra mention appended to `absorbed-answer-key.test.ts` | `exemption "renamed-guard-disciplines" … expected exactly 2 … got 3` |
| Line-scoped split | one extra mention appended to `anno-coverage.ts` **outside** the pinned lines | it is **not** exempted — it falls through to the allow-list, `pinned at 2 … got 3`. This is the property that makes `atLines` a narrowing |
| `files[]` teeth (post-fix) | `anno-durability-mutator.mjs` added to `files[]` | the anno-seam `files[]` assertion reddens; reverted → 23/23 green |

## Verification

| Check | Result |
|---|---|
| `cd src/mcp/vice && npm run typecheck` | exit 0 |
| bounded suite (`node --test` over the glob minus `vice-proxy.test.ts`) | 2856 tests, 2781 pass, **6 fail**, 64 skipped, 5 todo |
| `node scripts/check-no-regenerator2000.mjs` | exit 0 — at **each** of `63c1fe3`, `388e66a`, `c59fcef`, `9c4b58d` |
| `node scripts/audit-gate.mjs` | exit 0 |
| `node scripts/check-npm-packages.mjs` | exit 0 (`@henols/vice-mcp` 83 files) |
| `node scripts/check-skill-tool-coverage.mjs` | exit 0 (8 verbs parsed from `anno-cli.ts`, 8/8 resolved) |
| `node scripts/check-skill-fork-honesty.mjs` | exit 0 |
| `git log --follow` on each renamed path | resolves to its predecessor (3–18 commits each) |

### Failing-file SET compared against 29-BASELINE.md

The bounded procedure was used, per `29-BASELINE.md`: the full glob does not
terminate, blocking forever in `vice-proxy.test.ts`. `vice-proxy.test.ts` was
excluded from the run rather than started and killed. **No VICE broker was
running** (`systemctl --user status vice-broker` → unit not found; no `x64sc`
process), so BACK-05 is not phantom-red.

| File | Baseline | Now | Verdict |
|---|---|---|---|
| `vice-proxy.test.ts` | 41 (lower bound), MANUAL_ONLY | excluded from the bounded run | unchanged — it carries **zero** references to any path this plan renamed (`grep -c` → 0) |
| `r2000-session.test.ts` | 5 | 6 under full-suite load, **5 in isolation** | in the set, unchanged. The 6th (`stub: a child that answers nothing within the call timeout`) is load-induced and disappears when the file is run alone; its error is `spawn regenerator2000 ENOENT`, environmental |
| `audit-integrity.test.ts` | 2 | **0 — LEFT the set** | explained below |

**No file entered the set. One file left it, and the cause is a real fix, not a
guard that stopped asserting.** `audit-integrity.test.ts`'s two failures were
its disk-derived docs-guard `deepEqual` and CR-02's own registry-drift detector,
both reporting the same thing: `docs-uat-abstention.test.ts` landed on disk in
commit `19b5bd5` and was never added to `audit-gate.mjs`'s
`EXPECTED_DOCS_GUARD_NAMES`. That is precisely the drift CR-02's detector exists
to surface, and registering the name is the response its own comment prescribes.
It clears both assertions with **no floor change** — `DOCS_GUARD_FLOOR` is `>= 7`
and there are now 8 guards on disk, so D-12's "the floor stays 7" holds
literally. Both assertions still bite: the guard set is still disk-derived and
still compared by exact membership.

## Deviations from Plan

### 1. [Rule 2 — Missing critical] Registered `docs-uat-abstention.test.ts` in the docs-guard registry

- **Found during:** Task 3, running `audit-integrity.test.ts` as declared verification.
- **Issue:** Task 3's acceptance criterion requires `audit-integrity.test.ts` to exit 0, but `29-BASELINE.md` records it failing 2 tests on a correct tree. Diagnosed: a legitimate `docs-*.test.ts` guard was on disk and unregistered, so the audit gate could not have noticed its deletion — the exact CR-02 defect class the detector was built for.
- **Fix:** Added `"docs-uat-abstention.test.ts"` to `EXPECTED_DOCS_GUARD_NAMES` in `scripts/audit-gate.mjs` and to the assertion mirror in `audit-integrity.test.ts`, both in the same commit as D-12's paired move, with comments recording the cause. `DOCS_GUARD_FLOOR` unchanged at 7.
- **Files modified:** `scripts/audit-gate.mjs`, `src/mcp/vice/audit-integrity.test.ts`
- **Verification:** `node --test audit-integrity.test.ts` → 49 pass / 0 fail; `node scripts/audit-gate.mjs` → exit 0.
- **Commit:** `c59fcef`

### 2. [Rule 1 — Bug] The `anno-*` `files[]` derivation could not see the shipped generated data file

- **Found during:** the plan-level bounded suite, after Task 3.
- **Issue:** `anno-seam.test.ts:232` compares every `files[]` entry starting with `anno-` against a disk derivation matching `/^anno-.*\.(ts|mts)$/`. Renaming `r2000-regbits.json` to `anno-regbits.json` put the shipped generated data file into the actual set where it could never enter the expected one — a guard red on a correctly-shipped file, whose cheapest fix under pressure is to drop the entry from `files[]` and silently unship the table a skill playbook cites by filename. Directly caused by this plan's own rename.
- **Fix:** `.json` added to the derivation, not to the exclusion, with the reasoning recorded inline.
- **Verification:** both of the assertion's teeth re-proved by planting `anno-durability-mutator.mjs` into `files[]` and watching it redden; `node --test anno-seam.test.ts` → 23 pass / 0 fail.
- **Commit:** `9c4b58d`

### 3. [Rule 3 — Blocking] Files edited that the plan's task `<files>` lists did not name

All were forced by a guard that would otherwise have been red, and all are inside the plan-level `files_modified` or are its direct consequence:

- **`src/mcp/vice/module-classification.test.ts`** (Task 1 and 2). DIRECTION 2's encoding test read the data file out of the r2000 enumeration, which the rename emptied of it; the planted-violation test's synthetic disk list named entries that had become `discharged`. The encoding test was **re-expressed, not deleted** — its checked property (the registry keys on the exact filename INCLUDING the extension, never a stem) is unchanged and gained a negative control that the PRE-rename filename does not resolve either.
- **`src/mcp/vice/module-classification.ts`** in Task 2 (not in Task 2's `<files>`): the CLI's entry had to become `discharged` or DIRECTION 2 would report it as an orphan.
- **`src/mcp/vice/hostpath-consumers.test.ts`** in Task 1 (the plan assigns it to Task 3): the rename broke its derivation immediately. The helper, regex and positive control were re-pointed in Task 1 with the floor held at **14** — the same integer it replaced, so that commit is provably not a lowering — and Task 3 performed the measured raise to 15. This avoided leaving a knowingly-red guard across two commits inside the plan.
- **`.planning/ARCHITECTURE.md`** (Task 3). `GUARD_FILENAMES` is checked **by containment** against ARCHITECTURE.md's Architecture Change Record step 5, so re-pointing it without editing that section would have reddened the guard. The Phase 18 sentences are left byte-identical; a dated 2026-08-29 addendum records the rename and names the substitute.
- **`scripts/lib/*.d.mts` siblings, `scripts/check-npm-packages.mjs`, `src/mcp/vice/acme-gate.ts`, `prg-image.ts`, `block-class.ts`, `anno-types.ts`, `anno-store.ts`, `shipped-modules.ts`, `stock-symbols.ts`, `docs-uat-abstention.test.ts`, `hop-chain-comments.test.ts`, `comment-phase-pointers.test.ts`, `fixtures/coverage/README.md`, three `src/skills/` files** — all carry comment citations or path reads of the renamed files. The plan's action says to find references by scanning the tracked tree rather than from a list; this is that scan's result.

### 4. [Recorded reading, not a fix] "Basis and note unchanged" vs. the citation guards

Task 1's acceptance criterion asks that each discharged entry's `verdict`, `basis` and `note` be unchanged. DIRECTION 3 requires every `basis.consumers[].path` to exist on disk, DIRECTION 9 requires each advisory line to contain its symbol, and DIRECTION 9b requires every `path:NN` in the registry's own prose to resolve. Those three make a literal reading impossible. What was held byte-identical is **every verdict, every rationale, every requirement id and every sentence of every note except the file paths inside them**; consumer paths, cited symbols naming a filename, and prose citations moved with the rename and nothing else did. The diff is readable as a pure move on that basis.

### 5. [Measured correction] "Two split files" is one

Recorded in full under *The split file, itemised per mention* above. Only
`anno-coverage.ts` carries entries in both gate blocks.

**Total deviations:** 5 — 1 Rule 2, 1 Rule 1, 1 Rule 3 (multi-file), 2 recorded readings/corrections.
**Impact:** No scope growth. Two guards that were red or would have gone red are green with their teeth intact and re-proved by planting.

## Known Stubs

None.

## Threat Flags

None. This plan added no network endpoint, no auth path, no file-access pattern and no schema at a trust boundary. `T-29-SC` holds: no package was installed.

## Issues Encountered

`r2000-session.test.ts` fails 6 under full-suite load and 5 in isolation, and
the 6th needs a live `regenerator2000` on `$PATH`. This is the load-sensitivity
`29-BASELINE.md` warns about and is why that document insists on comparing the
failing-file **SET** rather than a count. Plan 29-10 deletes the file, which
takes those failures out of the set by construction.

## Next Phase Readiness

Ready for **29-06**. Waves 4 and 5 inherit a green `check-no-regenerator2000.mjs`
with no entry naming a moved path, which is the specific failure ordering
constraint 4 exists to prevent: plan 29-09 invokes the gate directly in its own
`<automated>`, and a lagging entry from this plan would have surfaced there, two
waves late, attributed to the wrong plan.

Three things later plans must carry:

1. **29-11's emptiness assertion must compare OCCURRENCE counts.** The gate
   reports occurrences; `spawn-seam.test.ts` is 39 occurrences on 38 lines.
2. **29-12 owns `anno-memmap-render.test.ts`'s allow-list entry** (D-17), and
   must re-pin its count in the same commit that converts the gated render
   tests; 29-10 discharges the remainder.
3. **`anno-memmap-render.ts`'s `:79` comment is pinned at exactly 1 with a LINE
   pin.** Any edit that moves that line must move the pin in the same commit.

## Self-Check: PASSED

All 16 declared created files exist on disk (`[ -f ]` on each). All four commits
resolve in `git log`: `63c1fe3`, `388e66a`, `c59fcef`, `9c4b58d`. Every task's
`<verify>` block was re-run at the end of the plan and passed. The plan-level
`<verification>` list was re-run in full: typecheck clean, all five single-command
gates exit 0, `git log --follow` resolves every renamed path, and the removal
gate is green at every commit this plan made.
