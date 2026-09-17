---
phase: 53-operator-owned-docs
plan: 03
subsystem: maintainer-facing docs/citations
tags: [documentation, citations, engineering-rules-21.2, testing, node-test]
status: complete
dependency-graph:
  requires:
    - phase: 53-operator-owned-docs (plan 53-02)
      provides: "Zero docs/phase* citations remaining outside the test-file set"
  provides:
    - "Zero docs/phase* citations remaining in the thirteen test files that carried the phase's final 21 sites"
  affects:
    - src/mcp/vice/phase50-findings-contract.test.ts
    - src/mcp/vice/phase50-transcript-freshness.test.ts
    - src/mcp/vice/anno-tools.test.ts
    - src/mcp/vice/anno-enum-gen.test.ts
    - src/mcp/vice/anno-store-export.test.ts
    - src/mcp/vice/anno-decomp-closure.test.ts
    - src/mcp/vice/broker-launch.test.ts
    - src/mcp/vice/stock-connect.test.ts
    - src/mcp/vice/stock-protocol.test.ts
    - src/mcp/vice/reassembly-gate-modified-run.test.ts
    - src/mcp/vice/reassembly-gate-exported-edit-run.test.ts
    - src/mcp/vice/ghidra-opcode-live.test.ts
    - src/mcp/vice/text-monitor-live.test.ts
tech-stack:
  added: []
  patterns:
    - "Reason-not-reference citation rewrite (ENGINEERING_RULES section 21.2), applied to comments, a test title, and four runtime message strings (a REFRESH_REMEDY constant, two assertion-failure messages, one t.skip() reason)"
key-files:
  created: []
  modified:
    - src/mcp/vice/phase50-findings-contract.test.ts
    - src/mcp/vice/phase50-transcript-freshness.test.ts
    - src/mcp/vice/anno-tools.test.ts
    - src/mcp/vice/anno-enum-gen.test.ts
    - src/mcp/vice/anno-store-export.test.ts
    - src/mcp/vice/anno-decomp-closure.test.ts
    - src/mcp/vice/broker-launch.test.ts
    - src/mcp/vice/stock-connect.test.ts
    - src/mcp/vice/stock-protocol.test.ts
    - src/mcp/vice/reassembly-gate-modified-run.test.ts
    - src/mcp/vice/reassembly-gate-exported-edit-run.test.ts
    - src/mcp/vice/ghidra-opcode-live.test.ts
    - src/mcp/vice/text-monitor-live.test.ts
decisions:
  - "Left DOCS_DIR = join(REPO_ROOT, \"docs\") and every readdirSync/docsDir/filename-pattern dependency in both phase-50 guard tests exactly as they were -- only their comment prose was rewritten. 53-04 owns repointing the constant in the same commit as the git mv."
  - "Grepped for exact-text assertions before rewriting each of the five non-comment sites (a test title, a REFRESH_REMEDY constant, and three assertion/skip messages); none of the five is asserted on by exact string anywhere in its file, so each was rewritten freely as long as it kept stating what the check/failure actually means."
  - "anno-tools.test.ts:1160's citation (the 'disclosed gap class') turned out to sit inside a /** */ comment, not a runtime string as the plan's own site description suggested -- treated it as a comment rewrite; this does not change the outcome, since both comment and string sites follow the same three-property rule (state the reason, name zero paths, come out longer)."
metrics:
  duration: "~50 minutes"
  completed: 2026-09-17
actuals:
  tokens: 5201
  tasks: 3
  commits: 3
  plan_head_before: d3a27c95c446c88c9b47d84993eb9d80cdfd5b71
---

# Phase 53 Plan 03: Rewrite the 21 test-file citations and close the phase's citation sweep Summary

Rewrote all 21 remaining `docs/phase*` citation sites across the thirteen test files that
carried them -- comments, one test title, and four runtime message strings a failing or
skipped test actually prints -- so each states the reason it stood for rather than naming a
path, per `ENGINEERING_RULES.md` section 21.2. Both `phase50-*.test.ts` guard tests kept their
`DOCS_DIR` path constant, `docsDir` parameters, `readdirSync` calls and filename patterns
completely unchanged; only their prose was rewritten. This closes the phase's citation sweep:
the whole-repo `grep -rn 'docs/phase' src/ scripts/` count is now 0.

## Per-file citation counts (before -> after)

| File | Sites | Before | After |
|---|---|---|---|
| `src/mcp/vice/phase50-findings-contract.test.ts` | 4 | 4 | 0 |
| `src/mcp/vice/phase50-transcript-freshness.test.ts` | 2 | 2 | 0 |
| `src/mcp/vice/anno-tools.test.ts` | 3 | 3 | 0 |
| `src/mcp/vice/anno-enum-gen.test.ts` | 1 | 1 | 0 |
| `src/mcp/vice/anno-store-export.test.ts` | 1 | 1 | 0 |
| `src/mcp/vice/anno-decomp-closure.test.ts` | 1 | 1 | 0 |
| `src/mcp/vice/reassembly-gate-modified-run.test.ts` | 1 | 1 | 0 |
| `src/mcp/vice/reassembly-gate-exported-edit-run.test.ts` | 1 | 1 | 0 |
| `src/mcp/vice/stock-connect.test.ts` | 2 | 2 | 0 |
| `src/mcp/vice/stock-protocol.test.ts` | 1 | 1 | 0 |
| `src/mcp/vice/broker-launch.test.ts` | 2 | 2 | 0 |
| `src/mcp/vice/ghidra-opcode-live.test.ts` | 1 | 1 | 0 |
| `src/mcp/vice/text-monitor-live.test.ts` | 1 | 1 | 0 |
| **Total** | **21** | **21** | **0** |

Scoped verification (`grep -rn 'docs/phase'` over these thirteen files) returns 0. The
whole-repo count dropped from 21 (53-02's end state) to 0.

## The five non-comment sites, quoted in full

**`anno-enum-gen.test.ts`, test title (line ~164):**

Before: `"hasRegBitsEntry: false for $D020/$D021 -- CONFIRMED ABSENT from anno-regbits.json (docs/phase45-closure-dxa-family.md, Task 3), the exact CR-01 regression case"`

After: `"hasRegBitsEntry: false for $D020/$D021 -- these registers are name-shaped but CONFIRMED ABSENT from the committed anno-regbits.json table, the exact CR-01 regression case where a name-shaped register with no table entry must not be mistaken for one that has one"`

**`anno-store-export.test.ts`, `LIVE_SKIP_REASON` (line ~474):**

Before: `` `...(a store dxa+Ghidra actually derived, e.g. dxa/tracer.prg per docs/phase45-wave0-measurements.md) to run it. A synthetic ...` ``

After: `` `...(a store dxa+Ghidra actually derived by disassembling and executing a real binary end to end, e.g. dxa/tracer.prg run through that pipeline) to run it. A synthetic ...` ``

**`stock-connect.test.ts`, assertion-failure message (line ~285):**

Before: `"the resume opcode is EXIT 0xaa per docs/phase0-binmon-findings.md §4"`

After: `"EXIT (0xaa) is the one command that resumes a machine any inbound byte just halted, confirmed against stock VICE's own binary monitor -- pinning the wire value here catches a future edit that would silently change which opcode performs the resume"`

**`phase50-transcript-freshness.test.ts`, `REFRESH_REMEDY` (line ~97):**

Before: `"REMEDY: a transcript cannot be regenerated by a build -- re-run the live capture session against genuine stock VICE (docs/phase50-ci-boundary.md, section \"How to run each half\") and commit a fresh transcript. Do NOT hand-edit the recorded digest to match: that reinstates the stale record this check exists to catch."`

After: `"REMEDY: a transcript cannot be regenerated by a build -- re-run the live capture session against genuine stock VICE, driving the same subjects this transcript already names, until a fresh comparison completes end to end, then commit the regenerated transcript in place of the stale one. Do NOT hand-edit the recorded digest to match: that reinstates the stale record this check exists to catch."`

**`text-monitor-live.test.ts`, `skipReason` (line ~1158):**

Before: `` `...not reproducible here, and this is a named gap (recorded in docs/phase41-text-channel-live-evidence.md and the SUMMARY), not a silent pass. The remedy (device c:) is still confirmed reachable...` ``

After: `` `...not reproducible here: a drive checkpoint hit is what sets default_memspace and freezes main-CPU stepping, and this host's drive activity within the 15s poll window did not trigger that hit, so this is a named, disclosed gap, not a silent pass. The remedy (device c:) is still confirmed reachable...` ``

Each of these five sites was grepped for exact-text assertions before rewriting (`grep -n` for
the constant/title name across its file). None is checked byte-for-byte anywhere -- `stock-connect.test.ts`
only reaches the message via `assert.equal`'s optional third argument (never re-asserted),
`phase50-transcript-freshness.test.ts` only asserts `message.includes("REMEDY")`, and the other
three are titles/skip reasons with no downstream string match at all -- so each was free to be
rewritten in full as long as it kept stating what the check or failure actually means.

## DOCS_DIR left unchanged (both phase-50 guards)

Both `grep -q 'const DOCS_DIR = join(REPO_ROOT, "docs")'` checks pass against
`phase50-findings-contract.test.ts` and `phase50-transcript-freshness.test.ts` after every task
in this plan, including the final gate. Neither file's `docsDir` parameter, `readdirSync` call,
or transcript filename pattern (`/^phase50-.+-transcript\.md$/`) was touched. **53-04's executor
can rely on this: the constant and every functional read path around it are exactly as they
were before this plan ran**, so 53-04 is free to repoint `DOCS_DIR` at the phase-50 evidence
directory in the same commit as the `git mv`, with no prior drift to reconcile.

## Task Commits

1. **Task 1: Rewrite the 6 comment citations in the two phase-50 guard tests, leaving their
   path constant untouched** - `90177f12` (docs)
2. **Task 2: Rewrite the 9 citations in the annotation and reassembly test files** - `8dd76a06`
   (docs)
3. **Task 3: Rewrite the 6 citations in the transport, broker and live-emulator tests, then
   gate the whole plan** - `a3e52221` (docs)

## Files Created/Modified

- `src/mcp/vice/phase50-findings-contract.test.ts` - rewrote 4 WHY-header/contract comments; `DOCS_DIR` untouched
- `src/mcp/vice/phase50-transcript-freshness.test.ts` - rewrote 1 comment and the `REFRESH_REMEDY` message; `DOCS_DIR` untouched
- `src/mcp/vice/anno-tools.test.ts` - rewrote 3 fixture-header comments (CR-01 absent case, partial-coverage case, A/B promote-branch note)
- `src/mcp/vice/anno-enum-gen.test.ts` - rewrote 1 test title
- `src/mcp/vice/anno-store-export.test.ts` - rewrote 1 live-tier skip-reason parenthetical
- `src/mcp/vice/anno-decomp-closure.test.ts` - rewrote 1 WHY-header comment
- `src/mcp/vice/reassembly-gate-modified-run.test.ts` - rewrote 1 WHY-header comment
- `src/mcp/vice/reassembly-gate-exported-edit-run.test.ts` - rewrote 1 WHY-header comment
- `src/mcp/vice/stock-connect.test.ts` - rewrote 1 comment and 1 assertion-failure message
- `src/mcp/vice/stock-protocol.test.ts` - rewrote 1 deviation comment
- `src/mcp/vice/broker-launch.test.ts` - rewrote 2 comments (header-layout intro, EXIT rationale)
- `src/mcp/vice/ghidra-opcode-live.test.ts` - rewrote 1 corpus-canonicality comment
- `src/mcp/vice/text-monitor-live.test.ts` - rewrote 1 skip-reason message

## Decisions Made

- Left `DOCS_DIR` and every functional read path in both phase-50 guards exactly as they were, per the plan's hard boundary and locked decision that 53-04 owns the repoint atomically with the `git mv`.
- Verified each of the five non-comment sites against a `grep -n` for exact-text assertions in its own file before rewriting, since a rewritten failure message that states a weaker or different claim than the assertion actually makes would mislead every future reader of a red run (threat T-53-03-02).
- Kept every rewrite longer than what it replaced and named zero paths of any kind (no `docs/` path, no `.planning/` path) in any of the 21 sites, per locked decisions L4 and L5.

## Deviations from Plan

None affecting scope or correctness. One observation: the plan's own task-2 description
classified `anno-tools.test.ts:1160` (the "disclosed gap class" citation) as one of the file's
non-comment sites. Re-measuring found it sits inside a `/** ... */` JSDoc-style comment, not a
runtime string. This did not change the outcome -- comment and string sites are held to the
same three-property rule -- so it is recorded here only as a factual correction to the plan's
site inventory, not as a deviation requiring rework.

## Issues Encountered

None. All three tasks' `<automated>` verify blocks passed on the first attempt after the
content edits; no fix-attempt cycles were needed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The whole-repo `grep -rn 'docs/phase' src/ scripts/` count is now 0. Both `docs/`-relocation
  guard tests (`phase50-findings-contract.test.ts`, `phase50-transcript-freshness.test.ts`)
  still read their documents from the unmoved `docs/` directory via an untouched `DOCS_DIR`
  constant, so they remain green until 53-04 moves the documents and repoints the constant in
  the same commit.
- `npm --prefix src/mcp/vice run test:automated`: 3701 tests, 3692 pass, 0 fail, 9 skip, 0
  cancelled -- unchanged skip/fail counts from before this plan, confirming no regression.
- 53-04 (the `git mv` of the 27 documents into their phase `evidence/` directories) is next;
  it depends on this plan's citation sweep being complete, which it now is.

---
*Phase: 53-operator-owned-docs*
*Completed: 2026-09-17*
