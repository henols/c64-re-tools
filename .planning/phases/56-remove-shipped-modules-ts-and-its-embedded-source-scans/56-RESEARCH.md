# Phase 56: Remove `shipped-modules.ts` and Its Embedded Source Scans - Research

**Researched:** 2026-09-14
**Domain:** In-repo test-suite surgery (no external library, no web research applicable)
**Confidence:** HIGH — every claim below is MEASURED against this working tree this session, with the command shown. Nothing here comes from a web search. The task instructions explicitly forbid one. There is no external domain to search.

## Summary

This phase is pure measurement-driven surgery on 17 already-identified test files (16
"regular" files plus `shipped-modules.test.ts` itself). Every open question the planner needs
answered is answerable only by reading this tree, not by consulting documentation, so this
research re-ran and corrected the CONTEXT.md/ROADMAP.md census, built and PROVED (per D-14) a
throwaway comment/string-aware scanner as the narrowing mechanism, applied D-02's exemption
test to the ten specific candidate cases CONTEXT.md named, captured the current
`test:automated` baseline as a set, and recommends a concrete wave ordering.

**The single most important finding:** a naive text-only comment/string stripper (the kind an
orchestrator might reach for first) is not just imprecise. It is **silently, catastrophically
wrong** on this codebase. MEASURED: it undercounts one file's real case count by more than half
(14 found vs. 36 actual), because a single `assert.match(err.message, /pattern/)` regex literal
containing no quote characters at all still triggered a phantom string-comment collision
several lines downstream. This is the *exact* failure class `codeOnly()`'s own header in
`shipped-modules.ts` documents as previously measured on two OTHER files
(`anno-coverage.ts:1495`, `incident-record.ts:107`). It was independently re-triggered here on a
THIRD file, live, in this session. Any scoping tool the plan builds must carry the same
regex-vs-division disambiguation `codeOnly()` carries, re-derived (not imported — D-14
constraint 1). Without it, the tool will silently miscount, and the plan will trust the wrong
number.

**The second most important finding:** CONTEXT.md's own "Specific Ideas" worked-example list
of ten "behavioural proofs known to sit inside mixed cases" is, on a case-boundary-aware
re-read, **wrong for eight of the ten**. Those eight are not mixed cases at all. They are
fully clean, wholly-behavioural cases sitting textually *adjacent* to a real scanning case in
the same file. The discussion-time heuristic that produced that list was almost certainly
proximity-based (a grep near a case, not a case-boundary parse), and it over-attributed. Only one
of the ten (`anno-store.test.ts:3848`, CR-08) is a genuine two-part mixed case. It is EXEMPT.
One more (`anno-store.test.ts:5321`, D-15) is itself wholly structural. Its true behavioural
sibling is a *different*, earlier, unaffected case (`anno-store.test.ts:5284`). This matters,
because CONTEXT.md's "true exemption set is nearer 8-10" estimate was built on the same kind of
heuristic that just measurably over-counted here. The planner should not carry that number
forward without re-running a case-boundary-aware check (Q3, below) on the full candidate set.

**Primary recommendation:** re-measure everything with a proven, case-boundary-aware,
regex-literal-aware scanner (built and proved in this research, ported below) before cutting
anything. Treat its hits as a narrowing candidate list only, never as ground truth (D-14). Order
the work smallest-file-first, with the three giants (`anno-store.test.ts`,
`anno-export-asm.test.ts`, `anno-coverage.test.ts`) each in their own plan, scoped to the exact
line ranges this research already found, not a full-file read.

## Architectural Responsibility Map

Not applicable in the usual sense — this phase touches no browser/server/API/CDN/database
tier. Everything in scope is `src/mcp/vice/*.test.ts` (Node test files) plus one production
module (`shipped-modules.ts`) being deleted. There is one relevant "tier" distinction worth
recording for the planner:

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Source-text scanning (`codeOnly`, `shippedTsModules`, etc.) | Test-only helper module (`shipped-modules.ts`) | — | Never shipped (`package.json` `files[]` has no entry for it — MEASURED: `grep -n "shipped-modules" package.json` returns nothing) |
| The structural guards that CONSUME those helpers (e.g. `anno-store.test.ts`'s STRUCTURAL cases) | Test files, not production code | — | Deletion of the helper module has zero runtime/shipped-server impact. The entire blast radius is `*.test.ts` files plus the one deleted module |

## User Constraints (from CONTEXT.md)

<user_constraints>

### Locked Decisions

- **D-01:** Whole-case deletion is the default. If a case scans source text, the case goes —
  not just the scanning lines. Reversibility: costly.
- **D-02:** The one exemption: a case is exempt from whole-case deletion only when removing
  every source-text assertion still leaves at least one assertion that exercises production
  behaviour. A case whose remainder is setup-only, or whose remaining assertions all derive
  from scanned text, goes whole.
- **D-03:** Exempt cases are stripped in place, never retyped. Remove the scanning assertions;
  keep every surviving assertion line byte-for-byte; rename the case to what it now proves.
- **D-04:** Rejected: "delete then re-add as a new case" — retyping, strictly more work/risk.
- **D-05:** Success criterion 2 stands as written; Phase 54's matching wording is unchanged.
- **D-06:** Keep `anno-seam.test.ts`; delete 21 of its 23 cases.
- **D-07:** The two survivors: line 238 (`package.json files[]` completeness — does not scan
  source text, does not touch the doomed module) and line 743 (WR-25, the only behavioural
  case in the file).
- **D-08:** Accepted cost: `anno-seam.test.ts`'s filename still says "seam" (referred to the
  doomed sqlite source scan). Not renamed.
- **D-09:** `shipped-modules.test.ts` is deleted wholesale with its module (449 lines / 16
  tests, all testing the doomed module, in the automated set). Reported SEPARATELY from
  embedded-case removals.
- **D-10:** No new prose is written anywhere. No note, seed, successor doc, replacement guard,
  lint rule, or weaker assertion.
- **D-11:** Repair only this named set — drop now-false "asserted by X" clauses from exactly:
  `src/mcp/vice/anno-store.ts`, `src/mcp/vice/dxa-blocks.ts`, `src/mcp/vice/evid-ingest.ts`,
  `src/mcp/vice/memmap-lookup.ts`, `src/mcp/vice/capture-predicate.ts` (~line 40, found by
  reading, not grep — names neither `codeOnly` nor `shipped-modules`). The underlying
  constraint sentence stays; only the enforcement clause goes.
- **D-12:** Accepted gap: a stale enforcement claim neither grep nor D-11's list catches may
  survive. Preferred over an unbounded sweep.
- **D-13:** Left stale deliberately: `vice-proxy.test.ts:3488` and
  `hostpath-consumers.test.ts:624` (comment-only mentions, no import — RE-CONFIRMED this
  session, see Q1 below); the six `.planning/codebase/*.md` maps; `CLAUDE.md` (verified,
  cites none).
- **D-14:** A throwaway scratch script narrows the read; it is never the authority. Lives in
  the session scratchpad, never committed, never under `scripts/`. Must not depend on
  `codeOnly()` (being deleted); must distinguish comments from code; must be proved against a
  planted case before its output is trusted. Every hit is still hand-read before removal.
- **D-15:** The gate is a per-file test-name SET diff via
  `node --test --test-reporter=tap <file>`'s flat `ok N - <name>` list, captured before and
  after. Sidesteps the whole-suite hang and the live-broker failure (both in
  `MANUAL_ONLY_TESTS`).
- **D-16:** The SUMMARY carries every removed name, verbatim, grouped by file, each with a
  one-line reason. Roughly 57 embedded cases plus the 16 in `shipped-modules.test.ts` (per
  CONTEXT.md's discussion-time estimate — RE-MEASURED and corrected below, Q1).
- **D-17:** Compare SETS, never counts; never pin a count in an assertion. Baseline
  re-measured at planning time (this research, Q4).

### Claude's Discretion

The cut-rule resolution (D-01 through D-05) was delegated with "You decide" after the
18-mixed-case measurement was presented. Whole-case deletion is preserved as the default;
D-02's exemption is Claude's addition. D-13's stale-comment list was also at Claude's
discretion, flagged to the owner without objection.

### Deferred Ideas (OUT OF SCOPE)

None raised in the discussion — it stayed inside the phase boundary. Three reviewed backlog
todos matched on keyword overlap only and were NOT folded in (see CONTEXT.md § Deferred for
detail): a `research/questions.md` correction, a broker-lifecycle scratch-dir item, and the
`vice-proxy.test.ts` BACK-05 live-broker execution hazard (recorded as a hazard, not scope,
since `test:automated` never runs that file).

</user_constraints>

<phase_requirements>
## Phase Requirements

No requirement IDs exist for this phase yet — ROADMAP.md and CONTEXT.md both state
`**Requirements**: TBD -- declare at planning time`. This is a maintenance/deletion phase with
no `REQUIREMENTS.md` traceability row. The planner should declare local success-criteria IDs
(matching the five ROADMAP.md success criteria) rather than expect an upstream requirement ID
to map against.

| ID | Description | Research Support |
|----|-------------|------------------|
| (none declared) | ROADMAP's five numbered Success Criteria stand in for requirement IDs | Q1-Q5 below map 1:1 onto criteria 1 (deletion + no imports), 2 (no collateral coverage loss), 3 (green suite, reconciled count), 4 (no empty/setup-only files), 5 (WR-25 survives) |

</phase_requirements>

## Q1 — Re-measured census (SET, not count)

### File count: 17, confirmed (not 16)

```
grep -rl "shipped-modules" --include="*.ts" --include="*.mts" --include="*.mjs" src/mcp/vice
```
`[VERIFIED: src/mcp/vice/*.test.ts, run 2026-09-14]` returns 20 files mentioning the string
"shipped-modules": `shipped-modules.ts` itself (the module), 17 files with a genuine
`import ... from "./shipped-modules.ts"` line, and exactly 2 comment-only mentions with NO
import (`vice-proxy.test.ts:3488`, `hostpath-consumers.test.ts:624` — RE-CONFIRMED, matching
D-13's list exactly, no third comment-only file exists).

```
grep -n "from [\"'].*shipped-modules" --include="*.ts" -r src/mcp/vice
```
`[VERIFIED]` gives the 17-file import list, including `shipped-modules.test.ts:35` (its own
closing `} from "./shipped-modules.ts";` of a multi-line import). **CONTEXT.md's 17 is right.
ROADMAP.md's 16 is stale** (it missed `shipped-modules.test.ts`, exactly as CONTEXT.md's own
note already flagged).

### Line counts: unchanged from CONTEXT.md's table

`wc -l` on all 17 files reproduces CONTEXT.md's table exactly (5,595 / 6,274 / 5,016 / 3,278 /
etc.) — `[VERIFIED, run 2026-09-14]`. No file has been touched since CONTEXT.md was written
(same session, same day).

### Case counts: CONTEXT.md's table is WRONG for 5 of 17 files — corrected here

Authoritative source: `node --test --test-reporter=tap <file>`'s own `# tests N` summary line
(D-15's mechanism), run per file, exit 0 on every file `[VERIFIED, run 2026-09-14]`:

| File | Lines | CONTEXT.md said | TAP-measured actual | Static `test(` declarations | Cause of gap |
|---|---|---|---|---|---|
| `anno-export-asm.test.ts` | 6,274 | 196 | **206** | 195 | 1 loop site (L820, `\`data type round trip: a \`${dataType}\`...\`` — template-literal name) |
| `anno-store.test.ts` | 5,595 | 118 | **121** | 117 | 1 loop site (L1289, `for (const spelling of AFFINITY_SPELLINGS)`) |
| `anno-coverage.test.ts` | 5,016 | 115 | **126** | 114 | 1 loop site (L2347, `` `control ${store.control} (${dir})...` ``) |
| `stock-dispatch.test.ts` | 3,278 | 92 | **137** | 91 | 1 loop site (L1883, `` `conformance (D-02): dispatchStock("${toolName}", ...)...` `` — iterates ~47 tool names) |
| `anno-overlap.test.ts` | 2,136 | 23 | **36** | 21 | 2 loop sites (L306 `for (const kase of CASES)`, L1190 `for (const kase of SPLIT_CASES)`) |
| `anno-seam.test.ts` | 770 | 23 | 23 | 23 | — (matches) |
| `anno-derive.test.ts` | 670 | 29 | 29 | 29 | — (matches) |
| `capture-predicate.test.ts` | 683 | 30 | 30 | 30 | — (matches) |
| `anno-join.test.ts` | 665 | 26 | 26 | 26 | — (matches) |
| `vsf-slice.test.ts` | 644 | 36 | 36 | 36 | — (matches) |
| `anno-index.test.ts` | 535 | 13 | 13 | 13 | — (matches) |
| `shipped-modules.test.ts` | 449 | 16 | 16 | 16 | — (matches) |
| `block-class.test.ts` | 422 | 16 | 16 | 16 | — (matches) |
| `evid-report-keys.test.ts` | 406 | 9 | 9 | 9 | — (matches) |
| `anno-graphics.test.ts` | 286 | 12 | 12 | 12 | — (matches) |
| `anno-types.test.ts` | 851 | 23 | 23 | 23 | — (matches) |
| `prg-image.test.ts` | 120 | 8 | 8 | 8 | — (matches) |

**Finding:** every one of the 5 mismatched files contains exactly one source-level `test(`
declaration using a **template-literal name with `${...}` interpolation inside a loop**,
generating multiple named runtime cases from one declaration. `stock-dispatch.test.ts`'s gap
(137 vs. 91 static declarations, a 46-case swing) is the largest — its one loop iterates over
roughly every registered tool name for a conformance check.

**MEASURED, and important for the planner:** none of these five loop bodies references a
doomed `shipped-modules` symbol (confirmed by the scanner below against each file — see the
per-file hit lists in Q3/Q5). **No loop-generated case family needs cutting or renaming.**
D-15's SET-diff gate is unaffected by this either way, since it operates on TAP's own resolved
names regardless of whether they came from a static or a looped declaration — but D-01/D-02/
D-03's "case" concept, and D-16's SUMMARY, should be understood as operating at the
**source-declaration level** (one judgment per `test(` call site, not per generated runtime
name), consistent with CONTEXT.md's "~57" figure being a declaration count, not a TAP count.

### Case NAMES that import-consume a doomed symbol — corrected list

A naive `grep "codeOnly\|shippedTsModules"` per case is provably wrong on this codebase (see
Q2). The list below was produced by a scratch scanner (`scope-scan-v3.mjs`, built and PROVED in
this research per D-14 — algorithm in Q2) that (a) correctly excludes comment/string mentions,
(b) correctly disambiguates regex literals from division so it never phantom-opens a
string/comment span, and (c) additionally detects ONE level of indirection through a
module-scope helper function (e.g. a case that calls `moduleSpecifiers()`, which itself calls
`codeOnly()`, without mentioning `codeOnly` itself).

| File | Direct/helper hits (this scan) | Notes |
|---|---|---|
| `anno-coverage.test.ts` | 3 (L957, L1040, L1069) | No helper indirection |
| `anno-derive.test.ts` | 5 (L477, L486, L497, L592, L604) | Via helpers `strippedSource`, `sqlWriteSites` |
| `anno-export-asm.test.ts` | 7 (L4335, L4346, L4377, L4384, L4391, L4398, L4597) | 5 of 7 via helper `blockConstructionSlice` — **CONTEXT.md's "3" for this file is wrong. It missed the helper-indirect majority** |
| `anno-graphics.test.ts` | 1 (L266) | — |
| `anno-index.test.ts` | 3 (L281, L457, L483) | Via helper `indexSource` |
| `anno-join.test.ts` | 1 (L334) | Via helper `importSpecifiers` |
| `anno-overlap.test.ts` | 1 (L1489) | — |
| `anno-seam.test.ts` | 15 direct/helper hits found. **21 are actually cut per D-06/D-07 (locked)** | 6 more cases scan text via a raw `readFileSync` + regex route. This route is NOT tied to `codeOnly`/`shippedTsModules` at all (see Q2's two-level-indirection finding). This scanner is necessary but not sufficient here. D-06/D-07's already-locked 21/23 is authoritative, not this count |
| `anno-store.test.ts` | 14 (L865, L1456, L2058, L2250, L2514, L2583, L3060, L3221, L3653, L3713, L3848, L4438, L4490, L5321) | No helper indirection found at this scan's depth |
| `anno-types.test.ts` | 1 (L664) | — |
| `block-class.test.ts` | 2 (L330, L389) | — |
| `capture-predicate.test.ts` | 2 (L217, L228) | Via helper `moduleSpecifiers` |
| `evid-report-keys.test.ts` | 2 (L372, L388) | Via helpers `evidenceFamilyModules`, `assertRuntimeUnionHasExactlyTwoMembers`, `assertNoRuntimeLiteralOutsideUnion` |
| `prg-image.test.ts` | 2 (L103, L109) | — |
| `stock-dispatch.test.ts` | 7 (L1378, L1391, L1581, L1597, L1620, L1635, L3261) | All via `shippedTsModules` directly |
| `vsf-slice.test.ts` | 4 (L229, L249, L270, L345) | — |
| `shipped-modules.test.ts` | 16 (all — deleted wholesale, D-09) | Not applicable — whole file goes |

**Sum: 70 candidate cases across the 16 "regular" files + 16 in `shipped-modules.test.ts` = 86**,
not CONTEXT.md's "~57 + 16 = ~73". The gap is explained by two measured, distinct mechanisms
(Q2): (1) helper-function indirection this scanner catches that a symbol-name grep misses
(`anno-export-asm.test.ts` alone accounts for +5 of the swing), and (2) at least one
TWO-level indirection this scanner still misses in `anno-seam.test.ts` (a case → helper A →
helper B → `codeOnly`), meaning **86 is itself a floor, not a ceiling** — consistent with
D-14's own mandate that every hit is hand-read and the scan only narrows.

**Full verbatim case-name lists per file** are reproducible on demand by re-running the proven
scanner (Q2). They are not transcribed in full here, to keep this document navigable. The
line numbers above are stable anchors into the current tree (re-measured 2026-09-14, before any
cut has been made).

## Q2 — The comment-vs-code scoping mechanism, without an AST and without `codeOnly()`

### `typescript`'s own compiler API is not a safe option — MEASURED, do not use it

The devDependency `typescript` `7.0.2` is the new native/Go-backed rewrite ("tsgo"). Its
default export (`require("typescript")`) exposes only `version`. It has no `createSourceFile`
`[VERIFIED: node -e 'console.log(Object.keys(require("typescript")))' → []]`. Its
`typescript/unstable/ast` subpath exposes a low-level `createScanner` (a lexer, not a parser).
**MEASURED this session:** driving that scanner in a naive loop on a 3-line input caused an
immediate runaway allocation. It crashed the Node process with `FATAL ERROR: Ineffective
mark-compacts near heap limit — JavaScript heap out of memory` within ~26 seconds. This is
concrete evidence: a throwaway scratch script (which by D-14 must be quick, disposable, and
provable) should NOT reach for the `typescript` package's compiler surface. That surface is
unstable by its own subpath name, undocumented for this use, and was observed to fail
catastrophically on trivial input. There is also no `acorn`, `babel`, or `espree` anywhere in
`node_modules`
`[VERIFIED: ls node_modules | grep -iE "acorn|babel|espree"` → no output]`. This confirms the
roadmap's "No AST exists to scope this mechanically" note, and extends it. The one AST-capable
package present is not safely usable either.

### A naive char-based comment/string stripper is NOT safe — MEASURED to corrupt scope

Built and ran a straightforward stripper (blank `//` and `/* */` comments, blank
`"`/`'`/`` ` ``-delimited string bodies) against `vsf-slice.test.ts`. Result: it found only 14
of the file's real 36 top-level cases. A naive scanner would have silently believed the file
had less than half its real content. Every case after the corruption point (`test(` calls
declared past line ~249) would either be MISSED (never flagged for review) or, worse, have its
line attribution shifted. Root cause, traced character-by-character: `assert.match(err.message,
/offset 88/);` (a genuine regex literal, with no comment or string trickery involved) was
mistaken for the start of a division-operator context by a stripper with no regex-vs-division
disambiguation. The `"` inside a LATER, unrelated JSDoc block comment then closed a phantom
string frame the corrupted parser had accidentally opened, and everything between drifted.
**This is not a hypothetical edge case. Every one of these 17 files uses `assert.match(...,
/regex/)` extensively**, so this failure mode would trigger somewhere in nearly every file a
naive scanner touched.

This independently reproduces, on a THIRD file, the exact failure class `codeOnly()`'s own
header in `shipped-modules.ts` documents as previously measured:

> "a regex was measured to miss a real violation sitting inside… `anno-coverage.ts:1495`
> (`.replace(/[\`*_]/g, "")`) truncated a 2329-line module to 1107 lines of visible code, and
> `incident-record.ts:107` (`/'/g`) truncated 443 lines to 89, hiding seven real exported
> functions from `spawn-seam.test.ts`'s ANNO-01 scan."
> `[VERIFIED: src/mcp/vice/shipped-modules.ts:312-322]`

### The safe approach: re-derive `codeOnly()`'s regex-vs-division algorithm, don't import it

`codeOnly()` tracks "expression position" via the preceding significant token: `/` opens a
regex literal only when the previous non-whitespace token is one of a fixed keyword set
(`return`, `typeof`, `instanceof`, `in`, `of`, `new`, `delete`, `void`, `throw`, `case`, `do`,
`else`, `yield`, `await`) or a punctuator other than `)`, `]`, `}` — otherwise `/` is division.
`[VERIFIED: src/mcp/vice/shipped-modules.ts:176-261]`, the exact `REGEX_PRECEDING_KEYWORDS` set
and `noteCodeChar`/`noteLiteralConsumed`/`noteExpressionStart` logic quoted verbatim in the
module. **D-14 forbids depending on `codeOnly()`** (importing the live function, since the
module is being deleted) — it does not forbid re-deriving the same lexical rule independently,
the same way D-03 keeps assertion lines byte-for-byte without retyping the case that reads
them. This research built exactly that (`scope-scan-v2.mjs`/`v3.mjs`, algorithm reproduced
inline, not imported) and validated it:

- Against the planted-violation fixture (below): correctly flags ONLY a case that genuinely
  calls the doomed function in real code. It correctly ignores the same function name mentioned
  in a `//` comment, inside a test-name string, inside a multi-line `/* */` block comment, and
  (a second round) transitively through one level of helper-function indirection.
- Against `vsf-slice.test.ts`: after adding the regex-vs-division fix, found all 36 real cases
  (matching TAP exactly), where the naive version found 14.

### The planted-violation proof (D-14 constraint 3), reproducible

```typescript
// PLANTED FIXTURE — not a real test file, lives only in the session scratchpad.
test("a case whose comment mentions codeOnly and shippedTsModules but never calls them", ...);
test("a case whose NAME contains the word codeOnly but body never calls it", ...); // + a block
  // comment burying shippedTsModules() and codeOnly() across multiple lines
test("a case that genuinely calls codeOnly in real code", () => {
  function codeOnly(s: string) { return s; }
  const stripped = codeOnly("some source text");
  ...
});
function helperThatCallsCodeOnly(s: string) { return codeOnly(s); }
test("a case that consumes codeOnly only transitively, via a helper function", ...);
```

RED baseline (what a naive substring grep does): `grep -c "codeOnly\|shippedTsModules"`
matches text in **all four** non-helper cases (12 raw hits) — would flag 3 of 4 wrongly.
GREEN (the proven scanner): flags exactly the 2 cases that genuinely consume the symbol
(one direct, one via helper), and only those. `[VERIFIED — run live in this research session]`

### A residual, measured limitation the planner must accept, not paper over

Even the corrected scanner only follows **one level** of helper indirection. MEASURED live on
`anno-seam.test.ts`: case `"node:sqlite is named by exactly one module of the shipped module
set (STORE-07)"` (L146) calls `sqliteImporters()`, which itself calls
`stripForSpecifierScan()` (a doomed helper the scanner DOES detect at one level) — but because
the case calls `sqliteImporters`, not `stripForSpecifierScan` directly, the scanner's one-level
check does not flag L146. `[VERIFIED: src/mcp/vice/anno-seam.test.ts:136-147]`. This is exactly
why D-06/D-07's already-locked case-by-case judgment for `anno-seam.test.ts` (21 of 23 cut) must
be trusted over any fresh scan of that file, and why D-14's "every hit is still hand-read"
requirement is not a formality — a scanner at any bounded depth WILL have blind spots on a
codebase with this much helper reuse. **Recommendation: use the scanner to narrow, but for
every file, also do one full manual read of the surviving un-flagged cases near a scanning
case's helper functions specifically** — that is where indirection blind spots concentrate.

## Q3 — D-02 exemption verdicts on CONTEXT.md's ten named candidates

Read each cited location directly. **Finding: CONTEXT.md's framing ("behavioural proofs known
to sit inside mixed cases") is wrong for 8 of the 10** — those eight are separate, wholly clean
`test()` cases that merely sit textually adjacent to a real scanning case in the same file, not
inside one. This is a measured correction, not a quibble: CONTEXT.md's own "true exemption set
nearer 8-10" estimate rests on the same kind of proximity-based heuristic just shown to
over-attribute — the planner should re-verify rather than inherit that number.

| Candidate | Read at | Verdict | Why |
|---|---|---|---|
| `anno-store.test.ts:3848` (CR-08) | `[VERIFIED: anno-store.test.ts:3848-3970]` | **EXEMPT (genuine mixed case)** | ~110 lines of real behavioural assertions (a real store, a real `revertTo` refusal, byte-identical file checks, a fresh re-open). An appended "AND THE SOURCE ORDER…" tail reads `anno-store.ts` via `codeOnly(src, true)` and checks function-body ordering. Strip the tail per D-03. The current name never mentions "source order", so no rename is textually required. D-03's blanket mandate still applies. It is satisfied by keeping the existing name |
| `anno-store.test.ts:5321` (D-15) | `[VERIFIED: anno-store.test.ts:5321-5370]` | **WHOLE (not mixed at all)** | Every assertion in THIS case reads `anno-store.ts`'s own stripped source (`codeOnly(src, true)`) — comparison-site count, schema-write-statement grep, migration-entry-point absence. Zero calls to `openStore`/`revertTo`/any real store. The genuine behavioural "D-15" proof CONTEXT.md meant is a SEPARATE, earlier, unaffected case: `anno-store.test.ts:5284`, `"D-15: a genuine SCHEMA_VERSION 2 store file is REFUSED..."`, which does not import any shipped-modules symbol and needs no cut |
| `anno-index.test.ts:439` | `[VERIFIED: anno-index.test.ts:438-445]` | **NOT MIXED — clean, untouched** | `"a single-row index resolves that row inside its span and NO_ROW one step either side"` — 100% behavioural (`buildPaintIndex`, `resolveAt`), zero shipped-modules reference. Sits 18 lines above `indexSource()`'s two doomed consumer cases. Do not sweep it up |
| `prg-image.test.ts:86` | `[VERIFIED: prg-image.test.ts:86-91]` | **NOT MIXED — clean, untouched** | `"decodeRawData: round-trips an all-zero page..."` — 100% behavioural, zero reference. Sits directly above the file's two doomed cases (L103, L109) |
| `capture-predicate.test.ts:185` | `[VERIFIED: capture-predicate.test.ts:184-198]` | **NOT MIXED — clean, untouched** | `"argvDigest is order-sensitive and refuses an empty array by name"` — 100% behavioural, zero reference |
| `anno-join.test.ts:284` | `[VERIFIED: anno-join.test.ts:283-291]` | **NOT MIXED — clean, untouched** | A `setComment()` MAX_COMMENT_BYTES refusal case — 100% behavioural, zero reference |
| `anno-graphics.test.ts:210` | `[VERIFIED: anno-graphics.test.ts:209-224]` | **NOT MIXED — clean, untouched** | `"derived ranges are unchanged whether the store carries cross-reference rows or none at all"` — 100% behavioural |
| `anno-derive.test.ts:407` | `[VERIFIED: anno-derive.test.ts:406-425]` (case starts at 407) | **NOT MIXED — clean, untouched** | `"STORE-06 never-cached control: repeated derived queries leave the store byte-identical"` — 100% behavioural |
| `stock-dispatch.test.ts:3182` (CHAN-04) | `[VERIFIED: stock-dispatch.test.ts:3182-3200+]` | **NOT MIXED — clean, untouched** | A real concurrent-dispatch channel-lock-refusal test — 100% behavioural, not in this file's 7-case doomed-symbol hit list |
| `vsf-slice.test.ts:187` | `[VERIFIED: vsf-slice.test.ts:187-193]` | **NOT MIXED — clean, untouched** | `"sliceC64Mem: the returned image is a COPY..."` — 100% behavioural |

**Net effect on the plan:** only ONE case among these ten needs D-02 exemption handling
(CR-08). The other nine need **zero edits** — they are not scanning cases and must simply
survive the surrounding file's surgery untouched. The planner should treat "genuinely mixed
case, needs D-02 judgment" as the RARE outcome for the 70-case candidate set overall, not the
common one. Most cases in the candidate list (Q1) are, based on the ones read directly in this
research (`anno-store.test.ts`'s STRUCTURAL cases, `stock-dispatch.test.ts`'s `shippedTsModules`
cases, every file's "imports nothing" / "no filesystem I/O" / "no module-level mutable binding"
cases), wholly structural. They go WHOLE under D-01 with no exemption question at all.

## Q4 — Current `test:automated` baseline (SET, exit code on the same line)

```
cd src/mcp/vice && npm run test:automated > /tmp/.../test-automated-baseline.log 2>&1; echo "EXIT=$?"
```
`[VERIFIED, run 2026-09-14]`:

```
EXIT=0
ℹ tests 3753
ℹ suites 21
ℹ pass 3744
ℹ fail 0
ℹ cancelled 0
ℹ skipped 9
ℹ todo 0
```

This confirms D-17's carried-forward claim (`260914-poo` measured `fail 0 / EXIT=0` on
2026-09-14) is STILL true right now, same day, unchanged. `npm run typecheck` also exits 0
`[VERIFIED, run 2026-09-14: tsc --noEmit -p tsconfig.json, EXIT=0]`. Both are green BEFORE any
Phase 56 edit — this is the floor the phase must return to at every commit checkpoint, not
merely at the end.

`MANUAL_ONLY_TESTS` — read directly from `test-gate.mjs:141-154` `[VERIFIED]`, the single
source of truth, 12 entries, quoted verbatim:
```
"vice-broker-launch.test.ts", "vice-proxy.test.ts", "broker-e2e.test.ts",
"stock-live.test.ts", "stock-live-triage.test.ts", "stock-live-broker-monitor.test.ts",
"stock-broker-live.test.ts", "stock-a4-checkpoint-flood.test.ts", "dxa-live.test.ts",
"ghidra-live.test.ts", "ghidra-opcode-live.test.ts", "text-monitor-live.test.ts"
```
None of the 17 shipped-modules-importing files are in this list — `test:automated` exercises
all 17 directly, so D-15's per-file SET diffs and the full `test:automated` run should always
agree on which cases exist. Do not write a second copy of this list anywhere (its own header
warns a drift guard, `test-gate.test.ts`, fails the build if a file escapes both lists).

## Q5 — Ordering and commit-checkpoint safety

**Dependency shape:** the 16 "regular" files do not depend on each other — each independently
imports `shipped-modules.ts`. The only real ordering constraint is: ALL 16 regular files must
have their import removed (because their last doomed-symbol reference is gone) BEFORE
`shipped-modules.ts` + `shipped-modules.test.ts` are deleted together (D-09), or `typecheck`
breaks immediately. Within that constraint, ordering is a **context/risk management** choice,
not a hard dependency chain.

**Recommended wave grouping**, smallest/most-mechanical first, giants isolated last:

| Wave | Files | Candidate cases | Rationale |
|---|---|---|---|
| 0 | (no code change) | — | Confirm this research's re-measured census against the tree at plan time (files may have moved between research and execution). Re-run the proven scanner. Capture each file's PRE-edit TAP name set (D-15) before touching anything |
| 1 (mechanical, 1-2 cases each) | `anno-graphics`, `anno-types`, `anno-overlap`, `anno-join`, `prg-image`, `block-class`, `capture-predicate`, `evid-report-keys` | 1+1+1+1+2+2+2+2 = 12 | Zero or one helper-indirection each, all WHOLE-deletion (no D-02 judgment observed in this research's read of any of these) — low risk, establishes the cut pattern |
| 2 (medium, some helper indirection) | `anno-derive`, `anno-index`, `vsf-slice`, `stock-dispatch` | 5+3+4+7 = 19 | `stock-dispatch.test.ts` is a large FILE (3,278 lines) but its 7 hits cluster in two small regions (L1378-1391, L1581-1635, L3261) — scope the read to those spans, not the whole file |
| 3 (locked, single file, own plan) | `anno-seam.test.ts` | 21 of 23 cut, 2 survive (D-06/D-07, fully decided) | No judgment calls remain — but the two-level-indirection finding (Q2) means the executor must hand-verify each of the 21 against the file's own reasoning, not just this research's 15-hit scanner output |
| 4 (giants, ONE PLAN PER FILE) | `anno-store.test.ts` (14 cases, 5,595 lines) | `anno-export-asm.test.ts` (7 cases, 6,274 lines) | `anno-coverage.test.ts` (3 cases, 5,016 lines) — each its own plan. CONTEXT.md and this research both flag a single plan spanning all three as a context hazard. Scope each executor's read to the exact line spans in Q1's table (±50 lines of context per case), not a full-file read |
| 5 (final) | Delete `shipped-modules.ts` + `shipped-modules.test.ts` together (D-09) | 16 (whole file) | Only after grepping all 16 regular files for zero remaining `from "./shipped-modules.ts"` imports. Then run full `npm run typecheck` (must exit 0) and `npm run test:automated` (compare the SET against Q4's baseline, not a count), and write the D-16 SUMMARY |

**At every wave boundary** (not just the end): `npm run typecheck` must exit 0, and the
touched file's own `node --test --test-reporter=tap <file>` name-set diff must be reviewed
against what the plan intended to remove/rename — this is D-15's mechanism, and it is cheap
enough (each file ran in under 14 seconds in this research, even the largest at 13.5s) to run
after every file, not batched to the end of a wave.

**D-11's five-file repair set** (drop now-false "asserted by X" enforcement clauses, keep the
constraint sentence) is independent of the wave ordering above — it touches production modules
(`anno-store.ts`, `dxa-blocks.ts`, `evid-ingest.ts`, `memmap-lookup.ts`,
`capture-predicate.ts`), not test files, and can be done in its own small pass at any point,
most naturally after the corresponding test file's cases are already gone (so the repair
reflects the final state).

## Package Legitimacy Audit

Not applicable — this phase installs no packages, adds no dependency, and touches no
`package.json` `dependencies`/`devDependencies` entries.

## Standard Stack / Don't Hand-Roll / Code Examples / State of the Art

Not applicable in the usual sense (no external library choice exists for this phase). The one
piece of "don't hand-roll" guidance that DOES apply, MEASURED in this research:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Comment/string-aware source scanning for scoping the cut | A naive `//`/`/* */`/quote stripper with no regex-vs-division handling | The `codeOnly()`-equivalent state machine, RE-DERIVED (not imported) with the same `REGEX_PRECEDING_KEYWORDS` expression-position tracking | MEASURED in this session: the naive version silently undercounted one file's cases by more than half. The project already paid for this exact mistake twice before (`anno-coverage.ts:1495`, `incident-record.ts:107`, both cited in `codeOnly()`'s own header) |

## Common Pitfalls

### Pitfall 1: Trusting a symbol-name grep/scan as ground truth for "which cases are scanning cases"
**What goes wrong:** A case that consumes a doomed symbol only through a module-scope helper
function (or, worse, through two levels of helper) is invisible to any scan that only looks for
the symbol's own name inside a case body.
**Why it happens:** This codebase makes heavy use of small named helper functions
(`blockConstructionSlice`, `moduleSpecifiers`, `indexSource`, `stripForSpecifierScan`,
`sqliteImporters`, …) shared across several cases in the same file.
**How to avoid:** Detect module-scope helpers whose OWN body references a doomed symbol, then
treat any case calling that helper as a hit too (one level, proven in this research); for files
where D-14's hand-read finds a helper calling ANOTHER helper (measured once, in
`anno-seam.test.ts`), extend the check one more level for that specific file rather than
assuming one level is universally sufficient.
**Warning signs:** A file's cut-case count from a symbol scan looks suspiciously low relative
to how many "STRUCTURAL"/"non-vacuity"/"imports nothing" cases a human skim of the file's test
names suggests should exist.

### Pitfall 2: Treating a case cited nearby a scanning case as itself mixed
**What goes wrong:** Assuming a case is "mixed" (needs D-02 judgment) because a prior
discussion-time note associated it with a scanning region of the file, when the case is
actually a fully separate, clean `test()` block.
**Why it happens:** A proximity-based heuristic (grep near a line number) does not respect
`test()` call boundaries.
**How to avoid:** Always resolve the case's own `test(` ... `)` boundary (paren-matched) before
judging it; MEASURED in this research to overturn 8 of 10 discussion-time "mixed case"
attributions.
**Warning signs:** A "mixed case" verdict where reading the FULL case body shows zero mention
of any doomed symbol.

### Pitfall 3: Undercounting a file's real case total from static source declarations alone
**What goes wrong:** Five files (`anno-coverage`, `anno-export-asm`, `anno-overlap`,
`anno-store`, `stock-dispatch`) each contain exactly one loop-driven, template-literal-named
`test(` declaration that generates many runtime cases from one source line; counting `test(`
occurrences in source undercounts the true TAP case count by as much as 46 (`stock-dispatch`).
**Why it happens:** `grep -c "^test("` (or any static-source case counter) cannot see runtime
loop expansion.
**How to avoid:** Always cross-check a file's declared case count against
`node --test --test-reporter=tap <file>`'s own `# tests N` line (D-15's mechanism) before
reporting or reconciling a count in the SUMMARY (D-16, success criterion 3).
**Warning signs:** A file's `# tests N` (TAP) disagrees with a `grep -c "^test("` count.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | One level of helper-function indirection is "usually" sufficient for the scanner to narrow correctly, except where hand-reading finds a deeper chain (measured once, `anno-seam.test.ts`) | Q2 | If a second multi-level chain exists undetected in one of the other 15 files, a case could be wrongly left as "clean" and either kept with dead scanning code inside it, or (worse) not flagged for the D-02 judgment it needs. Mitigated by D-14's own mandate: every candidate list is hand-read before any cut, in every wave |
| A2 | The 70+16=86 candidate count (Q1) is closer to the true scanning-case count than CONTEXT.md's ~73, but is still a floor, not a ceiling, given A1 | Q1 | The D-16 SUMMARY's reconciliation could show a number outside either estimate; success criterion 3 already requires case-by-case reconciliation regardless, so this is a planning estimate, not a blocking assumption |

## Open Questions

1. **Does any file besides `anno-seam.test.ts` contain a text-scanning case that does NOT
   reference a `shipped-modules` symbol at all (raw `readFileSync` + ad hoc regex, with no
   `codeOnly`/`shippedTsModules` call anywhere in the chain)?**
   - What we know: `anno-seam.test.ts` has 6 such cases (21 locked cuts − 15 scanner hits),
     confirmed by D-06/D-07's already-locked count exceeding this research's scanner output.
   - What's unclear: whether any of the other 15 regular files has the same pattern — this
     research's scanner is symbol-anchored by construction and cannot find a case with zero
     symbol reference.
   - Recommendation: for each file, after applying the scanner's hit list, do one skim of the
     file's own case NAMES for prose that suggests source-reading behaviour ("STRUCTURAL",
     "non-vacuity", "imports nothing", "declares no module-level…") that the scanner did NOT
     flag, and hand-verify those specifically.

## Environment Availability

Not applicable — no external tool/service dependency. Everything in scope is Node's built-in
test runner (`node --test`, already verified working throughout this research) and `tsc`
(already verified working, `npm run typecheck` exits 0).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in test runner (`node --test`), no separate framework `[VERIFIED: package.json, TESTING.md]` |
| Config file | none — plain `node --test '*.test.*'` glob, narrowed by `test-gate.mjs` |
| Quick run command | `node --test --test-reporter=tap <single-file>.test.ts` (D-15's own mechanism) |
| Full suite command | `npm run test:automated` (`node test-gate.mjs`) — NOT the bare `npm test` glob, which hangs on `vice-proxy.test.ts` |

### Phase Requirements → Test Map

This phase has no new REQUIREMENT IDs (Q: Phase Requirements, above). Its "requirements" ARE
the five ROADMAP.md success criteria, each already mechanically checkable:

| Criterion | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| 1: `shipped-modules.ts` gone, nothing imports it | Zero import sites remain | structural/grep | `grep -rl "shipped-modules" src/mcp/vice --include="*.ts"` returns nothing but any leftover comment (D-13) | N/A — a grep gate, not a test file |
| 2: no collateral coverage loss | Every non-scanning case in a touched file survives | per-file SET diff | `node --test --test-reporter=tap <file>` before/after, diffed | D-15's mechanism, already proven working this session |
| 3: green suite, reconciled count | `test:automated` green, typecheck 0, count reconciled | full suite | `npm run test:automated` + `npm run typecheck` | ✅ both already green at baseline (Q4) |
| 4: no empty/setup-only file | Every touched file still has ≥1 real assertion | manual + D-02's own test | Read each touched file's final case count | ✅ — D-02's exemption test is literally this criterion applied at case level (already noted by CONTEXT.md D-02) |
| 5: WR-25 survives | `anno-seam.test.ts:743` case unchanged | per-file SET diff | Named case present in the post-cut TAP set, byte-identical body | Locked, D-07 |

### Sampling Rate
- **Per file edit:** `node --test --test-reporter=tap <file>` (D-15) + `npm run typecheck`
- **Per wave:** `npm run test:automated` (full automated set)
- **Phase gate:** `npm run test:automated` + `npm run typecheck`, both green, before
  `/gsd-verify-work`

### Wave 0 Gaps
None — existing test infrastructure (`node --test`, `test-gate.mjs`, the TAP reporter) covers
every verification this phase needs. No new test file or fixture is required; this phase only
removes test code.

## Security Domain

Not applicable — no auth, session, access-control, input-validation, or cryptography surface is
touched by this phase. It is pure test-suite deletion/restructuring inside an already-private
dev-tool test tree.

## Sources

### Primary (HIGH confidence — measured this session, this tree)
- `src/mcp/vice/shipped-modules.ts` (679 lines, read in full) — `codeOnly()`, `extractCommentSpans()`, `shippedTsModules()`, and their documented incident history
- `src/mcp/vice/test-gate.mjs` (`MANUAL_ONLY_TESTS`, `automatedTestFiles()`) — read directly
- All 17 files' import lines, line counts, and TAP `# tests N` outputs — run live this session
- `npm run test:automated` and `npm run typecheck` — run live this session, exit codes captured directly (not through a pipe)
- `.planning/phases/56-.../56-CONTEXT.md`, `.planning/ROADMAP.md` § Phase 56, `.planning/REQUIREMENTS.md`, `.planning/codebase/TESTING.md` § Planted-violation convention — read in full

### Secondary (MEDIUM confidence)
- None — no web source was consulted (none applicable to this phase; the task instructions explicitly direct against using WebSearch/WebFetch here)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Census (Q1): HIGH — every number is a directly-run command's output, cross-checked two ways (TAP `# tests` vs. static `test(` count) with the gap's cause traced to source in every mismatched file
- Scoping mechanism (Q2): HIGH — the recommended algorithm is proven against a planted violation this session, and its failure-mode alternative (naive stripping) is proven wrong on a real file this session
- D-02 verdicts (Q3): HIGH for the 10 cases read directly; the remaining ~69 candidate cases in Q1's table are NOT individually verdicted here (that is execution-time work) but the scanner and method to do so are proven
- Baseline (Q4): HIGH — direct run, exit code captured on the same line, MANUAL_ONLY_TESTS quoted verbatim from source
- Ordering (Q5): MEDIUM — the wave grouping is a reasoned recommendation informed by measured case counts and file sizes, not itself independently falsifiable the way Q1/Q2/Q4 are

**Research date:** 2026-09-14
**Valid until:** Until the working tree changes — this is a same-day, same-tree measurement, not a durable external fact. Re-run Wave 0's re-measurement at plan/execute time if any session gap exists between this research and execution.
