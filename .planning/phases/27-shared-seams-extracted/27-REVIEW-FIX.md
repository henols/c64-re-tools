---
phase: 27-shared-seams-extracted
fixed_at: 2026-08-27T00:00:00Z
review_path: .planning/phases/27-shared-seams-extracted/27-REVIEW.md
iteration: 1
findings_in_scope: 20
fixed: 20
skipped: 0
status: all_fixed
---

# Phase 27: Code Review Fix Report

**Fixed at:** 2026-08-27
**Source review:** `.planning/phases/27-shared-seams-extracted/27-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 20 (1 critical + 12 warnings + 7 info; `fix_scope: all`)
- Fixed: 20
- Skipped: 0

**Where verification ran:** the **main checkout**, not an isolated worktree.
`.planning/config.json` sets `workflow.use_worktrees: false`, so every edit,
commit and test run below happened in `/home/henrik/dev/henrik/git/c64-re-tools`
against its real `node_modules`. The numbers are therefore reproducible from the
tree a reader is looking at.

**Verification method per fix:** `npx tsc --noEmit` (clean after every commit)
plus a scoped `node --test` of the affected file. For the fixes that change what
a guard can SEE (CR-01, WR-01, WR-03, WR-04, WR-06, WR-07, WR-09, WR-12), the
fix was additionally proven by **planting the violation the guard is supposed to
catch** and confirming it reddens by that guard's own assertion message — a
passing guard is not evidence when the defect under repair was precisely a guard
that passed while blind.

Closing scoped run across all 14 touched files plus the four docs guards:
**379 tests, 376 pass, 0 fail, 3 skipped.**

## Fixed Issues

### CR-01: `codeOnly()` has no regex-literal handling; a regex containing a backtick or quote silently truncates the scanned source

**Files modified:** `src/mcp/vice/shipped-modules.ts`
**Commit:** `0802894`

**Reproduced first, before changing anything.** Against the shipped module the
review's minimal case returned exactly what it predicted:

```
codeOnly('const a = "SHOULD_BE_BLANKED";\nconst r = /[`*_]/g;\nfunction spawnHere() { spawnSync(R2000_BIN, []); }\n')
  => 'const a = ;\nconst r = /['
```

and on the live set: `r2000-coverage.ts` 2329 raw lines -> **1107** lines of
visible code, `incident-record.ts` 443 -> **89**. All seven exported functions
the review named (`computeCommentVacuity`, `computeReproducibility`,
`COVERAGE_REPORT_KEYS`, `coverageFindings`, `renderIncidentRecord`,
`writeIncidentRecord`, `finaliseIncidentRecord`) were absent from the output.

**Applied fix:** a regular-expression-literal branch in the top-level /
interpolation arm, placed after both comment branches and before the quote and
backtick branches. It consumes `\…` escapes and `[...]` character classes
without interpreting quotes inside them, emits the regex verbatim (a regex IS
real code, in both modes), and consumes trailing flags.

Departure from the review's sketched patch, and why: the sketch classified `/`
with a previous-**character** test alone, which cannot tell `return /re/.test(x)`
(a regex) from `total / count` (a division) — both are preceded by an identifier
character. A false negative there puts the scanner straight back into the
truncation bug, because the regex body is then scanned as ordinary code. The
implemented version tracks **expression position** as a small state variable
(`regexAllowed`) updated per emitted code character, with a
`REGEX_PRECEDING_KEYWORDS` set for the keyword case and a `.`-prefix check so
`obj.in` is not mistaken for the `in` keyword. It also refuses to treat an
unterminated `/ … EOL` run as a regex at all, which bounds the damage of any
residual misclassification.

**Tree-wide measurement, taken both ways.** Sweeping all 190 `.ts`/`.mts`
files in the directory and asking "is every `export`ed symbol declared in the
raw source still present in `codeOnly()`'s output?":

| | files with hidden exports | exported symbols invisible to every consuming guard |
|---|---|---|
| pre-fix (`0802894~1`) | 2 | **19** |
| post-fix | 0 | **0** |

So the blast radius was larger than the seven functions the review named by
hand: nineteen exported symbols across the two modules were invisible.

**Verified:** truncation gone (`r2000-coverage.ts` 2329 -> 1765, i.e. comment
stripping only; `incident-record.ts` 443 -> 389), all seven named symbols
visible, `tsc --noEmit` clean, keep-mode idempotent across all 190 `.ts`/`.mts` files in
the directory, and — the assertion that matters most — **all eight consuming
guards still pass (207/207)**, including `r2000-spawn-seam.test.ts`'s
`EXPECTED_R2000_SPAWN_SITES` set equality in both directions now that the two
previously-truncated modules are fully visible. No third spawn site was hiding
in the newly-visible ~1000 lines.

### WR-01: `shipped-modules.test.ts` certifies `codeOnly()` with no regex-literal case at all

**Files modified:** `src/mcp/vice/shipped-modules.test.ts`
**Commit:** `e8cad3d`

**Applied fix:** four new tests — the CR-01 regex shapes (backtick, single
quote, double quote inside a character class); a **regression test against the
two real modules by name**, asserting the seven previously-hidden symbols are
present in `codeOnly()`'s output (symbols, not line counts, so ordinary growth
in either module does not redden it); a division-versus-regex test covering both
directions including `return /x/.test(...)`; and a keep-mode losslessness test
across the literal shapes the flag threads through (nested template, escaped
quotes both styles, regex).

**Verified non-vacuous:** run against the pre-fix implementation
(`git show 0802894~1:...`), the regex case yields `'const r = /['` and the
assertion fails. The new tests genuinely fail on the old code.

### WR-02: `shipped-modules.ts`'s header states a correctness property the function does not have

**Files modified:** `src/mcp/vice/shipped-modules.ts`
**Commit:** `c13ca11`

**Applied fix:** since CR-01 is fixed, kept the claim and added a
"WHAT `codeOnly()` HANDLES, STATED AS A MEASUREMENT RATHER THAN A CLAIM" block
listing every shape including the regex branch, recording that the branch was
absent from every prior copy and that its absence was **measured** as the
2329->1107 and 443->89 truncations rather than reasoned about, and pointing at
the test file that pins it. Also added an explicit NOT-handled paragraph (JSX,
and `/` after a control-flow-head `)`/`}`) so the next reader does not have to
rediscover the boundary.

### WR-03: `block-class.test.ts`'s import-purity guard cannot see three real import shapes

**Files modified:** `src/mcp/vice/block-class.test.ts`
**Commit:** `e5a07e9`

**Applied fix:** replaced the hand-rolled comment-line filter and the
`/\bfrom\s+"/` line scan with `codeOnly(source, true)` from `shipped-modules.ts`
plus a `matchAll` alternation covering `from "…"`, `from '…'`, bare
`import "…"` and `import("…")`; added a separate prohibition on the dynamic
`import(` **shape** (scanned on strict-mode output) because
`import(someVariable)` has no specifier to collect. The emptiness assertion
stays last, preserving the file's documented type-narrowing ordering.

**Verified by planted violation, both eras.** Each of the four shapes appended
to `block-class.ts` now reddens the guard by its own message
(`block-class.ts imports from the ./r2000- family -- see trap 1 in its header`).
Against the pre-fix guard, the bare side-effect import and the `const` Map
produced **zero** failures — measured, confirming the blindness.

### WR-04: `block-class.test.ts`'s mutable-state guard only greps `let`/`var`

**Files modified:** `src/mcp/vice/block-class.test.ts`
**Commit:** `e5a07e9` (same file and commit as WR-03)

**Applied fix:** the offender scan now also rejects a module-level `const`
initialised to a mutable container (`new Map|Set|WeakMap|WeakSet`, an array
literal or an object literal), runs on strict-mode `codeOnly()` output so the
header's own prose about trap 3 cannot redden it, and the test title was
widened to match what it now asserts.

**Verified:** `const seen = new Map<number, string>();` appended to
`block-class.ts` now fails with `there is nothing to hold`; under the old guard
it passed.

### WR-05: `existsSync` is now an unused import in `stock-dispatch.test.ts`

**Files modified:** `src/mcp/vice/stock-dispatch.test.ts`
**Commit:** `7ea6aa3`

**Applied fix:** dropped `existsSync` from the `node:fs` import list (confirmed
zero remaining uses in the file). `tsc --noEmit` clean, 130/130 pass.

### WR-06: `module-classification.ts` verifies its structured line citations but not the eleven it carries in prose

**Files modified:** `src/mcp/vice/module-classification.test.ts`
**Commit:** `37e4fb6`

**Applied fix:** took the review's first option — extend the enforcing test —
adding **Direction 9b**: `prosePathCitations()` extracts every `path:NN`
citation from `module-classification.ts`'s own source (header prose and
`rationale`/`note` strings), including the bare `:NN` continuation shape
(`at r2000-cli.ts:91 and :631`) which inherits the last path seen, exactly as it
reads to a human and exactly how it drifts. Each citation is checked for: file
exists, line exists, line is non-blank, and — where the prose names an adjacent
symbol — the same containment check Direction 9 applies to structured
citations. A non-vacuity test asserts the extractor still sees citations and
that some carry a symbol.

It finds **15** citations (more than the eleven the review counted, because it
also picks up the header's three `vice-proxy.ts` citations and the bare
continuations). All 15 pass today, confirming the review's hand-check.

**Deliberate scope limit, recorded rather than smuggled:** the symbol window is
**same-source-line only**. A wider window was measured to reach back into the
previous bullet and attribute that bullet's symbol to the
`r2000-session.ts:294` citation — whose prose names no symbol at all ("the
single-flight session queue … onward") — reddening a *correct* record. Five of
fifteen citations therefore get full containment; all fifteen get
existence/line/non-blank. Under-reaching costs coverage; over-reaching costs
trust in the guard.

**Verified by planted violation, five drift classes:** symbol containment onto a
non-blank wrong line (`cites r2000-verify.ts:120 for acmeVerdict, but that line
does not contain it`), a blank cited line, a renamed file, a line past
end-of-file, and the bare `:NN` continuation. All five caught with the citation
named.

### WR-07: the `.d64` composition test degrades a broken checkout into a green SKIP, and its dynamic import removes `tsc` from the boundary the phase most needed verified

**Files modified:** `src/mcp/vice/r2000-d64.test.ts`
**Commit:** `3565de8`

**Applied fix:** both halves. Deleted the `existsSync` probe and the
`{ skip: SKIP_REASON }` gate (a skip reports green, so the gate turned a broken
checkout into a pass — and the availability-gate convention it cited exists for
*external* dependencies, never for a sibling module in the same tarball), and
replaced the dynamic `import(pathToFileURL(...).href)` plus hand-written `as`
cast with a static `import { parsePrg } from "./prg-image.ts"`. Also removed
`existsSync`, `pathToFileURL`, `dirname`, `join`, `fileURLToPath` and `HERE`,
which existed only to build the deleted probe's path — leaving them would have
recreated WR-05/IN-07's defect in the same commit.

**Verified that the fix does what it claims:** renaming `parsePrg` away in
`prg-image.ts` now produces
`r2000-d64.test.ts(11,10): error TS2305: Module './prg-image.ts' has no exported
member 'parsePrg'.` The moved-symbol boundary — the phase's central risk — is
back under the typechecker. 16 pass, **0 skipped** (was a skip candidate).

### WR-08: two new assertions pin a fixture-derived absolute count, with no message

**Files modified:** `src/mcp/vice/r2000-coverage.test.ts`
**Commit:** `f8d43e6`

**Applied fix:** replaced both `assert.equal(before.divergence.censusCodeStoreNotCode, 0)`
baselines with the relation they were half of —
`after.… > before.…` — each carrying a message that interpolates both observed
values, so a legitimate fixture or census change no longer reddens the tests
with no diagnostic. Left the two bare assertions at `:2103-2104` alone: they are
in a different test and were not in scope.

### WR-09: the block-literal SUPPLEMENT scans raw source, so a comment quoting the store's spelling reddens it

**Files modified:** `src/mcp/vice/r2000-coverage.test.ts`
**Commit:** `a371cad`

**Applied fix:** `codeOnly(readFileSync(...), true)` — keep-mode, since the
thing being searched for *is* a string literal.

**Verified both directions:** a comment discussing the store's `"Code"` spelling
appended to `r2000-coverage.ts` no longer reddens the supplement (112 pass, 0
fail), while a real `export const SNEAKY = "Code";` still does
(`not ok 8 - SUPPLEMENT (not the proof) …`). The gate got narrower in exactly
the intended dimension and no wider.

### WR-10: `r2000-test-gate.ts`'s "capability" verdict is internally tense and is not marked contested

**Files modified:** `src/mcp/vice/module-classification.ts`
**Commit:** `d16f923`

**Applied fix:** added a `CONTESTED` paragraph in the shape the `r2000-verify.ts`
entry already uses — naming both measurements in tension (every one of the ten
importers is an `r2000-*.test.ts`, so every consumer dies with the substrate;
and the substrate-independent half already left for `acme-gate.ts` this same
phase), stating that what a later reader carries forward is the **discipline**
(now embodied twice, which is what proves it generalises), and stating
explicitly what the verdict must NOT be read as.

**Re-verified the review's measurement before writing it down:** exactly ten
importers of `r2000-test-gate.ts`, every one `r2000-*`.

This commit also repairs a **line citation my own WR-07 fix drifted**: removing
`r2000-d64.test.ts`'s import block shifted `sectorsPerTrack` from line 13 to
line 10, and Direction 9 caught it (`cites src/mcp/vice/r2000-d64.test.ts:13
for sectorsPerTrack, but that line does not contain it`). The structured-citation
guard doing its job on a real edit, which is incidentally the best available
argument for WR-06.

### WR-11: `acme-gate.test.ts` spawns four child processes while its header states three

**Files modified:** `src/mcp/vice/acme-gate.test.ts`
**Commit:** `e5922a5`

**Applied fix:** memoised the FAIL probe behind `failRun()`, so the two tests
that assert two properties of "that same failing child run" now genuinely share
one run. Chose a lazily-memoised accessor over the review's top-level
`const failRun = runGateProbe(true)` so that running a filtered subset of the
file does not spawn a child it never asserts on. Corrected the header's cost
statement and recorded why the count is three rather than four.

Static call sites: `runGateProbe(true)` went from two test bodies to one
memoised call; plus one control run and one `-e` one-liner = the three children
the header now truthfully states. 6/6 pass.

### WR-12: "PRODUCTION MUST NOT PASS THIS" is the one invariant in this phase with no mechanical gate

**Files modified:** `src/mcp/vice/r2000-coverage.test.ts`
**Commit:** `ab4cd01`

**Applied fix:** added a supplement built from the enumerator and stripper this
phase extracted — for every `shippedTsModules()` entry except the declaration
site, `/\bblockClassifier\s*:/` must not appear in `codeOnly()` output.

**Verified by planted violation:** `export const PLANTED = { blockClassifier: null };`
appended to `r2000-project.ts` fails with
`shipped module(s) inject a block classifier: r2000-project.ts`.

### IN-01: `codeOnly()` declares two loop-local flags at function scope

**Files modified:** `src/mcp/vice/shipped-modules.ts`
**Commit:** `1596f22`

**Applied fix:** `inTemplateText` and `inInterp` moved into the `while` body as
`const`, with a one-line note that both are derived fresh from `templateStack`
each iteration.

### IN-02: `SPAWN_CALL_RE`'s doc comment describes behaviour `codeOnly()` does not have and names a function that does not exist

**Files modified:** `src/mcp/vice/r2000-spawn-seam.test.ts`
**Commit:** `32800d0`

**Applied fix:** the comment now says a string-literal first argument
"contributes nothing at all" and surfaces as `spawnSync(, …)` so the identifier
group cannot match, and names the real predicate `isR2000SpawnCall()`. The
phantom `isR2000BinaryExpression()` no longer appears anywhere in the file.

### IN-03: a relocated assertion's regex matcher is satisfied by the wrong number

**Files modified:** `src/mcp/vice/prg-image.test.ts`
**Commit:** `147e73c`

**Applied fix:** `/is 65535 byte\(s\)/` and `/is 0 byte\(s\)/`, anchored on the
message's own shape, with a comment recording that the bare `/0/` was satisfied
by the constant `65536` in the message regardless of the observed length.

### IN-04: `blockClassAt` throws on a non-array `blocks`, which its own doc-comment premise argues against

**Files modified:** `src/mcp/vice/block-class.ts`, `src/mcp/vice/block-class.test.ts`
**Commit:** `d81757c`

**Applied fix:** took both halves of the review's suggestion —
`if (!Array.isArray(blocks)) return null;` at the top, **and** extended the doc
comment to record that the premise applies to the container as much as to its
holes, that both production callers already pre-guard, and that the point is the
defence now living in the module that documents the premise. Added a test
covering `null`, `undefined`, a number, a string and a bare object.

### IN-05: `shipped-modules.ts` calls the four prior enumerator copies "byte-identical"; they were not

**Files modified:** `src/mcp/vice/shipped-modules.ts`
**Commit:** `7f93f35`

**Applied fix:** now reads "FOUR hand copies with identical FILTER logic", with
the difference named as the point: all four used a soft
`assert.ok(existsSync(...), …)` borrowed from the caller's assertion library,
and the extraction's own `ShippedFilesEntryMissingError` is a deliberate
assert-to-throw upgrade the header already justifies further down.

### IN-06: formatting artefacts left by the deletions

**Files modified:** `src/mcp/vice/r2000-spawn-seam.test.ts`, `src/mcp/vice/comment-phase-pointers.test.ts`
**Commits:** `32800d0` (the re-flowed header clause), `78c6f7a` (the duplicate blank line)

**Applied fix:** re-flowed the sentence broken mid-clause ("Within that derived
set, / this file / finds every call…") so it reads as one paragraph, and removed
the double blank line left where `comment-phase-pointers.test.ts`'s local
enumerator was deleted.

Split across two commits because the finding spans two files and the
`r2000-spawn-seam.test.ts` half sits in the same header block as IN-02's fix;
both ids are named in their commit messages.

### IN-07: pre-existing unused import moved by this phase

**Files modified:** `src/mcp/vice/r2000-verify.test.ts`
**Commit:** `8830385`

**Applied fix:** dropped `R2000_BIN` from the import list. As the review
required, re-checked `module-classification.ts:463`'s citation in the same
change: line 40 still holds the `skipReasonFor` import (the line shortened, it
did not move), so the citation stays valid — and Direction 9 confirms it,
16/16 pass.

## Notes on commit granularity

Two commits carry two finding ids each, both times because the two findings are
edits to the same region of the same file and separating them would have meant
committing a half-edited file:

- `e5a07e9` — WR-03 and WR-04, both in `block-class.test.ts`'s guard block.
- `32800d0` — IN-02 and IN-06, both in `r2000-spawn-seam.test.ts`'s header/doc
  region.

Every other finding is one commit. Every id appears in at least one commit
message.

## Verification

- `npx tsc --noEmit`: clean, re-run after every commit.
- Scoped run over all 14 touched files plus `docs-dangling-refs.test.ts`,
  `hop-chain-comments.test.ts`, `docs-linerefs.test.ts` and
  `test-gate.test.ts`: **379 tests, 376 pass, 0 fail, 3 skipped.**
- The eight `shipped-modules.ts` consumers were run together specifically to
  check CR-01's blast radius: 207/207 pass.
- Planted-violation proofs recorded per finding above for CR-01, WR-01, WR-03,
  WR-04, WR-06, WR-07, WR-09 and WR-12.

### Full-glob run

`npm test` (`node --test '*.test.*'`) was also run. It **blocks indefinitely
inside `vice-proxy.test.ts`** on this host — 14 minutes elapsed for 3 seconds of
CPU, i.e. waiting on a live VICE host that is not present — so it was stopped
rather than allowed to hang. By that point **2418 tests had completed**, which
covers every test file except the remainder of `vice-proxy.test.ts` itself (the
last entries emitted are its `vice_recycle` tests).

Failures in that run, attributed by stack trace, were confined to exactly two
files:

| file | failures | cause |
|---|---|---|
| `vice-proxy.test.ts` | 39 | needs a live host; on `test-gate.mjs`'s frozen `MANUAL_ONLY_TESTS` list |
| `r2000-session.test.ts` | 6 | `regenerator2000` not on `PATH` (confirmed absent) |

**Zero failures anywhere else across 2418 tests.** Nothing this run touched
regressed.

The `r2000-session.test.ts` count needs one note, since the phase's environment
brief says 5 rather than 6. Run **in isolation** that file fails exactly **5**
(25 tests: 14 pass, 5 fail, 6 skipped) — the documented number. The sixth
failure only appears under the full glob's parallel load and is
`stub: a child that answers nothing within the call timeout rejects with
R2000TimeoutError…`, a timeout-sensitive test. It is a load-induced flake, not a
regression: `r2000-session.test.ts` imports only `r2000-tools.ts`,
`r2000-project.ts` and `r2000-test-gate.ts`, none of which this run modified,
and the single production behaviour change anywhere in this run
(`block-class.ts`'s `Array.isArray` early return, IN-04) sits on a path both
production callers make unreachable by pre-guarding with
`Array.isArray(blocks) ? blocks : []`.

Neither file was touched by this run and neither is in this phase's scope.

---

_Fixed: 2026-08-27_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
