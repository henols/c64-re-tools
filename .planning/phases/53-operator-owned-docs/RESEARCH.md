# Phase 53: Operator-Owned `docs/` - Research

**Researched:** 2026-09-17
**Domain:** Documentation/repo-structure migration (no runtime code, no new dependencies)
**Confidence:** MEDIUM — the relocation mechanics are HIGH confidence; criterion 6 (the guard)
sits on a genuine, unresolved conflict between two locked project decisions (see Summary).

## Summary

This phase moves 27 `docs/phase*.md` files into their phase directories' `evidence/`
convention and rewrites the ~83 citations that point at them from `src/**`. The relocation
work (criteria 1-5) is mechanical and well-understood. **Criterion 6 is not** — it asks for
a permanent `node:test` guard that "reds on a `docs/phase*` path appearing in `src/**`,"
which is structurally identical to `skills-planning-vocabulary.test.ts`, the guard
ENGINEERING_RULES §21.1 still cites as live enforcement. That file, and 43 siblings like it,
were deleted on 2026-09-14 (`276c15c9`, quick task `260914-poo`) under three **locked,
standing decisions** recorded in `.planning/STATE.md`:

- **D-1: No test may assert on text at all.**
- **D-2: Only data-driven tests of production code are kept.**
- **D-6: The planning-vocabulary convention is retired outright... Create NO note, seed, or
  successor document.**

That quick task's own `decisions_locked` block reads: *"Do not re-litigate, do not propose a
replacement guard, lint rule, doc note, seed, weaker assertion, or any successor document."*
Criterion 6 as literally worded is exactly the forbidden successor. `REQUIREMENTS.md`'s
`DOCS-04` text is worse than merely in-tension — it names the deleted file directly
("`skills-planning-vocabulary.test.ts`'s category patterns are widened"), so it is
unexecutable as written independent of D-1. **This conflict predates this research pass and
must be resolved by the user before planning criterion 6** — it is not something a planner
can quietly route around. See Q2 and Open Questions.

**Primary recommendation:** Execute criteria 1-5 as scoped (relocate, rewrite, verify zero).
Before touching criterion 6, put the D-1/D-2/D-6-vs-criterion-6 conflict in front of the user
explicitly — likely via `/gsd-discuss-phase` — with two named options: (a) treat DOCS-04 as
superseded, verify zero once during execution with a throwaway grep and stop there, updating
ROADMAP/REQUIREMENTS to drop the permanent-guard language; or (b) treat `docs/` folder
ownership as important enough to carve a narrow, explicit exception into D-1/D-6. Do not
default silently to either.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Evidence-doc storage location | Planning tree (`.planning/phases/**/evidence/`) | — | Matches the convention 19 of 45 phase dirs already use; no runtime tier involved |
| Citation text in shipped/maintainer source | Product source (`src/mcp/vice/*.ts`, tests, fixtures) | — | Comments only — no code path reads `docs/` at runtime except one test (see Q6/pitfalls) |
| Regression enforcement (criterion 6) | Test suite (`npm run test:automated`) | CI (`.github/workflows/ci.yml`) | Contested — see Summary |

## Re-Measured Baseline (2026-09-17)

All commands run from repo root unless noted.

```
$ ls docs/phase*.md | wc -l                                    → 27  (roadmap said 21)
$ grep -rn "docs/phase" src scripts 2>/dev/null | wc -l        → 83  (roadmap said 89; orchestrator said 84 — re-run gave 83, within noise of comment edits since)
$ grep -rl "docs/phase" src scripts 2>/dev/null | wc -l        → 34  (roadmap said 37)
$ grep -rl "docs/phase" src/mcp/vice 2>/dev/null | wc -l       → 34
$ grep -rl "docs/phase" src/mcp/vice/fixtures 2>/dev/null | wc -l → 9 files / 12 occurrences (10 in *.md, 2 in non-.md fixture data)
$ grep -rl "docs/phase" src/skills 2>/dev/null | wc -l         → 0  (roadmap said 7 — CONFIRMED already cleaned)
$ ls tools 2>&1                                                 → No such file or directory (roadmap's "delete tools/" note is OBSOLETE — already gone)
$ grep -rl "docs/phase" src/mcp/vice/resources 2>/dev/null | wc -l → 0 (roadmap's "Generated, 4 files/9 occurrences" class is OBSOLETE — measures 0 today)
$ find .planning/phases -maxdepth 2 -type d -name evidence | wc -l → 19 (roadmap said 17)
```

Highest-density files: `stock-protocol.ts` (18), `probe-binmon.mjs` (10), `binmon-fixtures.ts`
(6), `phase50-findings-contract.test.ts` (4), `stock-connect.ts` (3), `anno-tools.test.ts` (3).

**Three roadmap notes confirmed obsolete, do not carry into the plan:**
1. "Delete the stale layout tree" (`tools/`, `.vice-snapshots/`, `.vice-supervisor/`) — all
   three are gone from disk; `tools` is unresolvable (`ls tools` → No such file or directory).
2. "THE GUARD HOLE... `skills-planning-vocabulary.test.ts`" — the file no longer exists
   (deleted `276c15c9`, 2026-09-14). There is no pattern to widen; see Summary.
3. "Generated, 4 files / 9 occurrences" (`resources/*.mjs`) — measures 0 today; `build.ts`'s
   `.mts` sources that fed those `.mjs` files no longer carry `docs/phase` citations.

## Package Legitimacy Audit

N/A — this phase installs no packages and adds no dependencies.

## Q1: Where do the three orphans go?

`phase0-binmon-findings.md`, `phase1-probe-results.md`, `phase2-backend-probe-evidence.md`
predate `.planning/phases/` numbering (committed 2026-08-11, one day before `ROADMAP.md`
existed — `git log --diff-filter=A --format='%ad %H' -- docs/phase0-binmon-findings.md` →
`2026-08-11 68b0a799`; `.planning/ROADMAP.md`'s own first commit → `2026-08-12 61998996`).
They do **not** need a new bucket — each already self-declares its home:

- **`docs/phase0-binmon-findings.md`** and **`docs/phase1-probe-results.md`**: both appear
  verbatim in `.planning/phases/01-corrected-ground-truth/01-04-PLAN.md`'s own
  `files_modified:` frontmatter list (`[VERIFIED: .planning/phases/01-corrected-ground-truth/01-04-PLAN.md:7-9]`
  — `files_modified:\n  - docs/phase1-probe-results.md\n  - docs/phase0-binmon-findings.md`).
  That plan authored both documents. Destination: `.planning/phases/01-corrected-ground-truth/evidence/`.
- **`docs/phase2-backend-probe-evidence.md`**: its own body names its origin —
  `[VERIFIED: docs/phase2-backend-probe-evidence.md:1-12]` — *"This document records two
  pieces of evidence-gathering plan 02-02 was supposed to perform..."* and *"Decision
  overridden: D-19... `.planning/phases/02-stock-backend-connection/02-CONTEXT.md`"*.
  Destination: `.planning/phases/02-stock-backend-connection/evidence/`.

This is not a new rule — it is the same "cite the plan that produced it" evidence already
used to map the other 24 files; the filename numbering ("phase0/1/2") is a pre-ROADMAP
artifact and is not the mapping key.

**Record the decision in:** `.planning/ROADMAP.md`'s Phase 53 Notes (replace the note that
currently only names `phase0` and treats the destination as still-open) **and** in
`53-CONTEXT.md` once `/gsd-discuss-phase` runs, since criterion 3 requires the decision be
"decided and RECORDED," and the roadmap is the durable cross-phase record while CONTEXT.md is
this phase's own decision log.

## Q2: What shape should the new guard take?

**This cannot be answered without resolving the Summary's conflict first.** Two structurally
different guards exist as precedent in the current (post-2026-09-14) tree:

- **Banned shape** (this is what criterion 6 as worded asks for): a test that reads file
  **prose/comments** with `readFileSync` and pattern-matches a documentation string
  (`docs/phase*`). This is exactly `skills-planning-vocabulary.test.ts`'s shape — deleted
  under D-1 ("no test may assert on text").
- **Surviving shape**, e.g. `hostpath-consumers.test.ts` (`[VERIFIED:
  src/mcp/vice/hostpath-consumers.test.ts:1-40]`, comment: *"GROUND TRUTH ESTABLISHED BY THIS
  PLAN (04-02)... This file is the first COMMITTED test of that set"*): it also uses
  `readFileSync`/`readdirSync`, but asserts on **import statements** — a closed, enumerated
  consumer set for `hostpath.ts` — which the project treats as a structural/data-driven
  assertion about production code, not a prose scan. This survived the 2026-09-14 purge.

A `docs/phase*` citation is **always inside a comment** in this tree — confirmed by grepping
for the pattern inside quotes/backticks outside `.md` files: every hit is `//` or `/** */`
prose (`[VERIFIED: grep -rn '"docs/phase\|`docs/phase' src scripts | grep -v '\.md:'` — 18
hits, all comment lines]`). There is no runtime code path that builds a `"docs/phase..."`
string and reads it (the one file that reads `docs/*.md` at runtime,
`phase50-findings-contract.test.ts`, builds the path via `join(DOCS_DIR, "phase50-ci-boundary.md")`
— never the literal substring `"docs/phase"`). So a criterion-6 guard is unavoidably a
prose/comment scanner — the banned shape, not the `hostpath-consumers.test.ts` shape. There
is no narrower design that dodges D-1 while still literally satisfying "reds on a `docs/phase*`
path appearing in `src/**`."

- `tools/**` no longer exists (`ls tools` → No such file or directory); drop it from any
  guard's scope — a path glob over a nonexistent directory is dead weight, not caution.
- `test-gate.mjs`'s `MANUAL_ONLY_TESTS` (`[VERIFIED: src/mcp/vice/test-gate.mjs:141-154]`,
  12 entries, all live-emulator/broker-spawning tests) contains nothing doc-related — a new
  guard, if built, would land in the automated set by default, satisfying that part of
  criterion 6 mechanically. This does not resolve the D-1 conflict.

**Recommendation:** surface the conflict in discuss-phase before scoping any plan task for
criterion 6. If the user re-affirms criterion 6, the only viable implementation is a narrow,
explicitly-named exception to D-1/D-6 (a new decision, not a reinterpretation) — do not let a
plan quietly build the guard as if D-1 didn't apply.

## Q3: Are the 9 `fixtures/*/README.md` citations in scope?

**Yes — in scope for criterion 4**, though not npm-shipped. Re-measured:
`src/mcp/vice/fixtures/` contains 9 files with `docs/phase` citations (10 occurrences across
5 `README.md` files: `ghidra`(3), `binmon`(3), `dxa`(2), `petcat`(1), `export-asm`(1); plus 2
occurrences in non-`.md` fixture data — `hazard-subject-align-nosprite.a`,
`charset-phantom.annostore.json`, `bank-path-dependent.annostore.json`,
`make-exported-edit.mjs`).

`[VERIFIED: src/mcp/vice/package.json:10-100]` — `"files"` lists 90 explicit entries plus
`"resources"`; there is no `"fixtures"` entry anywhere in the array. `fixtures/` is therefore
**not published to the npm tarball**. It IS packed into the plugin zip (`scripts/package.sh`
runs `git archive --format=zip ... HEAD`, which packs the whole tracked tree —
`[VERIFIED: scripts/package.sh:139]`).

Criterion 4's text is "A grep for `docs/phase` across `src/**` and `tools/**` returns zero" —
no npm-publication qualifier. `src/mcp/vice/fixtures/` is physically under `src/**`. The
literal criterion covers it regardless of shipping status.

## Q4: The ordering constraint

**Confirmed correct, unchanged.** Rewriting must happen before `git mv`. If files move first,
every one of the 83 citation sites still says `docs/phase...`, which is now a **stale,
broken path** — the file no longer exists at that location — and if any rewrite pass at that
point repoints citations at the new `.planning/phases/**/evidence/` location, that is the
exact "same defect one hop along" criterion 4 forbids (a `.planning/` path cited from product
source, banned outright by ENGINEERING_RULES §21.3, `[VERIFIED:
.planning/ENGINEERING_RULES.md:439-451]`).

**Task order:**
1. Rewrite all ~83 citations in `src/**` to state the REASON (§21.2 form), zero path
   references of any kind — not `docs/`, not `.planning/`.
2. Verify: `grep -rn "docs/phase" src scripts` returns 0 AND `grep -rn "\.planning/phases.*evidence" src scripts` (or similar) returns 0 for the rewritten sites.
3. Fix the one **functional** (non-comment) dependency separately (see Q6 pitfall below).
4. `git mv` all 27 files into their phase `evidence/` dirs (Q1 mapping for the 3 orphans, existing convention for the other 24).
5. Re-verify `ls docs/` shows no `phase*` file and no new subfolder.

## Q5: The two phase-named test files

`phase50-findings-contract.test.ts` and `phase50-transcript-freshness.test.ts` carry a phase
number in their **own filename** — the same disease Phase 53 targets, in a different place.

**None of the 6 success criteria cover this.** Criterion 1 scopes `docs/`. Criteria 2-4 scope
relocated *documents* and *citations of docs/phase paths*. Criterion 6 scopes citation
*paths*, not filenames. A filename is not a "path appearing in `src/**`" in the sense any
criterion tests, and these two files are not shipped (`*.test.ts` is absent from
`package.json`'s `files[]`), so ENGINEERING_RULES §21.2's "ships verbatim to npm" trigger does
not reach them either.

**Recommendation: leave them out of Phase 53's scope.** Recommend to the user as a follow-up
(a `/gsd-quick` rename, or fold into a future phase) rather than silently widening this phase.
If renamed, note the *functional* coupling first (see Q6 pitfall) — these two files are not
pure-comment citers like the rest of the 83.

## Q6: What does a rewritten citation look like?

Three real examples from `stock-protocol.ts` (18 occurrences total,
`[VERIFIED: src/mcp/vice/stock-protocol.ts — line numbers below]`):

**Example 1 — line 77 (section banner, cites §5 "Wire format for the Phase-1 client" per
`docs/phase0-binmon-findings.md:125`, `[VERIFIED: docs/phase0-binmon-findings.md:125]`
`## 5. Wire format (for the Phase-1 client)`):**
```
// BEFORE
// Command / response / error "enums" -- one-for-one with
// docs/phase0-binmon-findings.md §5's normative set, which is a superset of
// the vendor's own CommandType (missing RESOURCE_GET/SET, CPUHISTORY_GET,
// and USERPORT_SET).

// AFTER
// Command / response / error "enums" -- one-for-one with the wire format
// empirically confirmed against genuine stock VICE's binary monitor (every
// opcode probed live, request and response bytes captured and matched
// against monitor_binary.c's own encoder). This set is a superset of the
// vendor fork's own CommandType: it is missing RESOURCE_GET/SET,
// CPUHISTORY_GET, and USERPORT_SET, which stock supports and the fork's
// enum simply never grew to cover.
```

**Example 2 — line 458 (single-field body shape):**
```
// BEFORE
/** The one-byte body shared by REGISTERS_GET (0x31) and REGISTERS_AVAILABLE
 * (0x83). [CITED docs/phase0-binmon-findings.md §5] */

// AFTER
/** The one-byte body shared by REGISTERS_GET (0x31) and REGISTERS_AVAILABLE
 * (0x83): a single memspace byte, confirmed against monitor_binary.c's own
 * request decoder and by a live probe against genuine stock VICE that sent
 * each memspace value and matched the returned register set to the
 * expected bank. */
```

**Example 3 — line 741 (ADVANCE_INSTRUCTIONS body shape, tied to a probe file too):**
```
// BEFORE
/**
 * ADVANCE_INSTRUCTIONS (0x71) request body -- 3 bytes, `stepOver(1)
 * count(u16LE)`. [CITED docs/phase0-binmon-findings.md §5; body SHAPE also
 * exercised, with stepOver=0 only, in probe-binmon.mjs's async-events check]
 */

// AFTER
/**
 * ADVANCE_INSTRUCTIONS (0x71) request body -- 3 bytes, `stepOver(1)
 * count(u16LE)`, confirmed byte-for-byte against monitor_binary.c's own
 * decoder and, for the stepOver=0 case, exercised live against genuine
 * stock VICE by probe-binmon.mjs's async-events check (the check that
 * proved STOPPED/RESUMED events arrive interleaved with the command
 * response rather than only after it).
 */
```

**Pattern for the executor:** every rewrite (a) states what was empirically confirmed and
against what (source file, live probe, or both), (b) names zero paths of any kind, (c) is
longer than the original — criterion 5 fails a diff that nets shorter. Where a comment cites
`probe-binmon.mjs` (a real sibling file, not a `docs/` path), that citation is fine to keep —
criterion 4 targets `docs/phase` paths specifically, not all citations.

**One functional (non-comment) dependency, separate from the 83 citations:**
`phase50-findings-contract.test.ts` sets `DOCS_DIR = join(REPO_ROOT, "docs")`
(`[VERIFIED: src/mcp/vice/phase50-findings-contract.test.ts:43]`) and reads
`phase50-modifiability-findings.md`, `phase50-exported-edit-findings.md`,
`phase50-ci-boundary.md` from it at runtime (`[VERIFIED:
src/mcp/vice/phase50-findings-contract.test.ts:105-106,167]` —
`const path = join(options.docsDir, name);` / `const ciBoundaryPath = join(options.docsDir, "phase50-ci-boundary.md");`).
This is not a citation rewrite — it is a real path constant that must be updated to point at
`.planning/phases/50-equivalence-and-modifiability/evidence/` once those three files move, or
the test breaks. Handle it as its own task, not folded into the 83-comment sweep.

## Common Pitfalls

### Pitfall 1: Treating criterion 6 as a mechanical widening task
**What goes wrong:** A plan task says "widen `skills-planning-vocabulary.test.ts`'s patterns"
per the roadmap's literal text, without checking the file exists.
**Why it happens:** The roadmap note is 4 days stale relative to the file's deletion.
**How to avoid:** Confirm file existence before any plan task references it; route through
discuss-phase given the D-1/D-6 conflict (see Summary).

### Pitfall 2: Moving files before rewriting citations
**What goes wrong:** `git mv` first leaves 83 dangling `docs/phase...` paths, which either
fail criterion 4's zero-grep or get "fixed" by repointing at `.planning/`, which is the exact
failure criterion 4 names.
**How to avoid:** Rewrite-then-verify-then-move, per Q4.

### Pitfall 3: Missing the one functional path dependency
**What goes wrong:** Sweeping all 83 sites as "comment rewrites" and shipping without
updating `phase50-findings-contract.test.ts`'s `DOCS_DIR`-relative reads breaks that test the
moment the phase50 docs move.
**How to avoid:** Treat it as a distinct task per Q6.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in `node:test`, `>=24` |
| Config file | none — `test-gate.mjs` derives the automated set from `readdirSync` minus `MANUAL_ONLY_TESTS` |
| Quick run command | `npm run test:automated` (from `src/mcp/vice`) |
| Full suite command | `npm test` (`node --test '*.test.*'`) |

### Phase Requirements → Verification Map
| Req ID | Behavior | Verification | Command | Automatable as a committed test? |
|--------|----------|--------------|---------|------------------------------------|
| DOCS-01 | `docs/` holds no `phase*` file, no new subfolder | one-off check | `ls docs/ \| grep -c '^phase'` → must be 0; `ls docs/` shows no new dir | Yes, safely — a directory-listing assertion is data-driven, not a text/prose scan; does not trip D-1 |
| DOCS-02 | Orphan destination decided+recorded | manual review | grep `.planning/ROADMAP.md` Notes for the 3 filenames | N/A (documentation, not code) |
| DOCS-03 | Zero `docs/phase` in `src/**`/`tools/**` | one-off check | `grep -rn "docs/phase" src scripts` → 0 | Contested — see Summary (this IS the criterion-6 question) |
| DOCS-04 (roadmap criterion 6) | Guard prevents recurrence | **BLOCKED pending user decision** | — | See Summary/Q2 |

### Sampling Rate
- Per task: re-run `grep -rn "docs/phase" src scripts \| wc -l` and watch it monotonically
  decrease to 0.
- Phase gate: `npm run test:automated` green (must include the `phase50-findings-contract.test.ts`
  path-dependency fix, or it will fail once the phase50 docs move).

### Wave 0 Gaps
None — no test infrastructure is missing; the open question is whether a NEW test may be
added at all (Summary).

## Security Domain

N/A for this phase's actual changes (no auth, no input handling, no crypto — pure file
relocation and comment text). ASVS categories not applicable; `security_enforcement: true` is
satisfied by explicit statement rather than a populated table.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | D-1/D-2/D-6 (quick task `260914-poo`) are standing, durable project decisions and not scoped narrowly to that one quick task's execution | Summary, Q2 | If narrowly scoped, criterion 6 could proceed as originally worded and this research over-blocks it. Confidence: MEDIUM — `STATE.md`'s permanent history entry and ENGINEERING_RULES' unreconciled §21.1 both point toward durability, but no document explicitly states "this binds all future phases." |
| A2 | The rewritten-citation examples in Q6 are illustrative prose, not the executor's only acceptable wording | Q6 | Low — criteria 5's bar (longer, reasoning-bearing, no path) is satisfied by many phrasings; these are a pattern, not a script. |

## Open Questions

1. **Does criterion 6 survive, and in what form?**
   - What we know: the literal wording requires exactly the test shape D-1/D-6 forbid, and
     names a file that no longer exists.
   - What's unclear: whether the user considers `docs/` folder ownership important enough to
     carve an explicit, narrow exception into D-1/D-6, or intends DOCS-04 to lapse to a
     one-time verification with no permanent guard.
   - Recommendation: raise explicitly in `/gsd-discuss-phase` before planning any criterion-6
     task; do not let a plan silently pick a side.

2. **Should the two `phase50-*.test.ts` filenames be renamed?**
   - What we know: same defect class, zero criteria coverage, not currently shipped.
   - Recommendation: out of scope for Phase 53; flag to the user as a possible follow-up.

## Sources

### Primary (HIGH confidence — read directly this session)
- `.planning/ROADMAP.md` (Phase 53 section, full)
- `.planning/ENGINEERING_RULES.md` §21-21.4
- `.planning/REQUIREMENTS.md` (DOCS-01..04 cross-reference) and `.planning/milestones/v1.0.0-REQUIREMENTS.md` (DOCS-01..04 full text)
- `.planning/STATE.md` (260914-poo entry)
- `.planning/quick/260914-poo-delete-all-text-asserting-tests-disarm-t/260914-poo-PLAN.md` (full)
- `src/mcp/vice/package.json`, `scripts/package.sh`, `src/mcp/vice/test-gate.mjs`
- `src/mcp/vice/stock-protocol.ts`, `hostpath-consumers.test.ts`, `phase50-findings-contract.test.ts`, `phase50-transcript-freshness.test.ts`
- `docs/phase0-binmon-findings.md`, `docs/phase1-probe-results.md`, `docs/phase2-backend-probe-evidence.md`
- `.planning/phases/01-corrected-ground-truth/01-04-PLAN.md`
- live `grep`/`ls`/`git log` output, this session, 2026-09-17

## Metadata

**Confidence breakdown:**
- Relocation mechanics (criteria 1-5): HIGH — every number re-measured live this session
- Criterion 6 / guard shape: LOW-MEDIUM — technically clear, but blocked on an unresolved
  policy conflict only the user can settle
- Orphan destination (Q1): HIGH — grounded in frontmatter and in-document self-citation, read directly

**Research date:** 2026-09-17
**Valid until:** re-measure before planning if more than ~7 days pass — this tree's citation
count and test-file set have both moved multiple times per week recently
