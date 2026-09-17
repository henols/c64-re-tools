---
phase: 53-operator-owned-docs
plan: 02
subsystem: maintainer-facing docs/citations
tags: [documentation, citations, engineering-rules-21.2, fixtures]
status: complete
dependency-graph:
  requires: []
  provides:
    - "Zero docs/phase* citations remaining in probe-binmon.mjs, binmon-fixtures.ts and the whole fixtures/ tree"
  affects:
    - src/mcp/vice/probe-binmon.mjs
    - src/mcp/vice/binmon-fixtures.ts
    - src/mcp/vice/fixtures/**
tech-stack:
  added: []
  patterns:
    - "Reason-not-reference citation rewrite (ENGINEERING_RULES section 21.2), applied to comments, one printed operator-facing string, and one generated-record note field"
key-files:
  created: []
  modified:
    - src/mcp/vice/probe-binmon.mjs
    - src/mcp/vice/binmon-fixtures.ts
    - src/mcp/vice/fixtures/binmon/README.md
    - src/mcp/vice/fixtures/ghidra/README.md
    - src/mcp/vice/fixtures/dxa/README.md
    - src/mcp/vice/fixtures/petcat/README.md
    - src/mcp/vice/fixtures/export-asm/README.md
    - src/mcp/vice/fixtures/hazard-subject/hazard-subject-align-nosprite.a
    - src/mcp/vice/fixtures/hazard-subject/make-exported-edit.mjs
    - src/mcp/vice/fixtures/ghidra/charset-phantom.annostore.json
    - src/mcp/vice/fixtures/ghidra/bank-path-dependent.annostore.json
decisions:
  - "Rewrote the printed CPUHISTORY_GET hint string in probe-binmon.mjs to state the operative fact (version floor binds the opcode, not a compile flag; chis is the text-monitor fallback on older builds) rather than pointing at a document the terminal reader does not have"
  - "Rewrote make-exported-edit.mjs's note_on_optional_extra field value only -- field name and every other field left untouched -- to state what the byte-identity comparison actually demonstrates instead of citing a document"
  - "Left the bank-path-dependent.annostore.json quoted production decline reason byte-for-byte untouched; edited only the citation clause that followed it, per anno-bank.test.ts's regex dependency"
metrics:
  duration: "~55 minutes"
  completed: 2026-09-17
actuals:
  tokens: 8150
  tasks: 3
  commits: 3
  plan_head_before: 7a2d6e79d337be3873c6c3d139ba56718076c609
---

# Phase 53 Plan 02: Rewrite the 32 maintainer-facing citations across the probe script, the binary-monitor fixture module and the fixture tree Summary

Rewrote all 32 `docs/phase*` citation sites across `probe-binmon.mjs`, `binmon-fixtures.ts` and
nine fixture-tree files (five READMEs, two ACME source-comment sites, one generator's note
field, two annotation-store `text` values) so each states the reason it stood for rather than
naming a path, per `ENGINEERING_RULES.md` section 21.2. Two of the 32 sites were runtime
strings rather than comments -- a printed operator hint and a generated-record note field --
both rewritten to read as standalone messages, not code comments.

## Per-file citation counts (before -> after)

| File | Sites | Before | After |
|---|---|---|---|
| `src/mcp/vice/probe-binmon.mjs` | 10 | 10 | 0 |
| `src/mcp/vice/binmon-fixtures.ts` | 6 | 6 | 0 |
| `src/mcp/vice/fixtures/binmon/README.md` | 3 | 3 | 0 |
| `src/mcp/vice/fixtures/ghidra/README.md` | 3 | 3 | 0 |
| `src/mcp/vice/fixtures/dxa/README.md` | 2 | 2 | 0 |
| `src/mcp/vice/fixtures/petcat/README.md` | 1 | 1 | 0 |
| `src/mcp/vice/fixtures/export-asm/README.md` | 1 | 1 | 0 |
| `src/mcp/vice/fixtures/hazard-subject/hazard-subject-align-nosprite.a` | 2 | 2 | 0 |
| `src/mcp/vice/fixtures/hazard-subject/make-exported-edit.mjs` | 1 | 1 | 0 |
| `src/mcp/vice/fixtures/ghidra/bank-path-dependent.annostore.json` | 1 | 1 | 0 |
| `src/mcp/vice/fixtures/ghidra/charset-phantom.annostore.json` | 2 | 2 | 0 |
| **Total** | **32** | **32** | **0** |

Scoped verification (`grep -rn 'docs/phase' src/mcp/vice/probe-binmon.mjs src/mcp/vice/binmon-fixtures.ts src/mcp/vice/fixtures`)
returns 0. The whole-repo count dropped from 53 (53-01's end state) to 21, exactly 32 fewer --
consistent with this plan's own scope.

## The two non-comment sites, quoted in full

**Rewritten probe-script hint string** (`probe-binmon.mjs`, printed by `--probe-assumptions`
when a build predates the CPUHISTORY_GET opcode):

> `"\nVICE >= 3.10 is required for the CPUHISTORY_GET (0x86) binary-monitor opcode itself, not a compile-time flag -- on an older build the same CPU-history capability is still reachable over the text monitor's `chis` command."`

Before: `"\nVICE >= 3.10 is the gate for CPUHISTORY_GET, not a compile flag -- see docs/phase1-probe-results.md for the recorded run."` -- sent a terminal reader after a file they do not have. Confirmed no test asserts on this string's exact text before or after the change.

**Rewritten generator note field** (`make-exported-edit.mjs`'s `note_on_optional_extra`, written
into every generated exported-edit provenance record):

> `"Byte-identity to hazard-subject-modified.prg was never this plan's acceptance criterion and is not aimed for. What this comparison demonstrates instead is that the same two behaviour changes, made this time through exportAsmTree()'s own round trip rather than by hand, still pass the identical reassembly gate hazard-subject-modified.prg passed."`

Field name unchanged; no other field touched. Confirmed no test references `note_on_optional_extra` or its prior text.

## Deviations from Plan

None -- plan executed exactly as written. Task 3's fixture-data edits followed the plan's
per-site handling instructions exactly: the two hazard-subject assembler comments kept their
anchor addresses verbatim, the generator note field's field name was untouched, and the
`bank-path-dependent.annostore.json` quoted production decline reason
(`"no recovered processor-port value reaches $d000 -- declining rather than defaulting to the
power-on state"`) survived byte-for-byte -- confirmed both by direct inspection and by the
verify gate's `grep -c` check returning `1`.

## Verification (actual output)

**Task 1 verify** (`probe-binmon.mjs` + `binmon-fixtures.ts`):
```
0 docs/phase citations
git diff --numstat: binmon-fixtures.ts +23/-15, probe-binmon.mjs +46/-27 (neither shrank)
> @henols/vice-mcp@0.0.0-dev typecheck
> tsc --noEmit -p tsconfig.json
(clean, exit 0)
node --check src/mcp/vice/probe-binmon.mjs -> exit 0
TASK1_VERIFY_PASS
```

**Task 2 verify** (five fixture READMEs):
```
0 docs/phase citations
git diff --numstat:
  binmon/README.md    +16/-9
  dxa/README.md       +7/-4
  export-asm/README.md +5/-5  (equal, not a shrink)
  ghidra/README.md    +17/-6
  petcat/README.md    +3/-2
TASK2_VERIFY_PASS
```

**Task 3 verify** (fixture data files + whole-plan gate):
```
0 docs/phase citations across probe-binmon.mjs, binmon-fixtures.ts, fixtures/
json ok  (both annotation stores parse)
1        (grep -c 'no recovered processor-port value reaches' bank-path-dependent.annostore.json)
git diff --numstat (Task 3 files only, at time of check):
  bank-path-dependent.annostore.json      +1/-1
  charset-phantom.annostore.json          +2/-2
  hazard-subject-align-nosprite.a         +15/-11
  make-exported-edit.mjs                  +1/-1
OK net: +19 -15
> tsc --noEmit -p tsconfig.json  (clean, exit 0)
npm run test:automated:
  ℹ tests 3701
  ℹ suites 21
  ℹ pass 3692
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 9
  ℹ todo 0
  ℹ duration_ms 46754.295696
EXIT=0
```

**Plan-wide aggregate** (all 11 files, commits `06481313`/`d5f6058c`/`314a77bf` combined against
plan-start `7a2d6e79`): `+136 / -83` lines -- adds strictly more than it removes, satisfying
locked decision L5. No file's diff removed more lines than it added.

## Known Stubs

None.

## Threat Flags

None -- this plan touched only comments, one printed operator string, one generated-record note
field, and citation clauses inside fixture data; no new network endpoint, auth path, file-access
pattern or schema change was introduced.

## Self-Check: PASSED

All 11 files this plan owns exist on disk at their declared paths. All three commit hashes
(`06481313`, `d5f6058c`, `314a77bf`) are present in `git log --oneline --all`.
