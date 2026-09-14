# Phase 56: Remove `shipped-modules.ts` and Its Embedded Source Scans - Pattern Map

**Mapped:** 2026-09-14
**Files analyzed:** 0 new files (this phase creates none)
**Edit kinds analyzed:** 5, each with a real in-tree precedent

## Why this PATTERNS.md has no File Classification table

This phase is pure surgery on already-existing files: one production module and its
test are deleted outright, sixteen surviving test files lose embedded cases, and five
production modules lose a stale comment clause. No file is created. The usual
new-file-to-analog mapping therefore does not apply. What the planner needs instead is
a **precedent per edit kind** — the closest prior instance in this repository of the
same kind of cut, read in full, with the exact boundary shown. That is what follows.

## Edit Kind 1 — Whole-case deletion from a surviving test file (D-01)

**Analog:** `.planning/quick/260914-poo-.../260914-poo-SUMMARY.md` and
`.planning/quick/260914-uhm-.../260914-uhm-SUMMARY.md` — the two immediately preceding
rounds that did exactly this kind of cut against the same codebase, same day.

**Operative conventions extracted (apply verbatim to every plan in this phase):**

1. **Compare SETS, never counts.** `260914-poo`'s SUMMARY reports before/after as
   `tests 4432 | pass 4421 | fail 2 | ...` → `tests 3765 | ... | fail 0 | EXIT=0`, and
   explicitly frames this as "compared as SETS, per the plan's own rule — never as
   counts." Phase 56's D-17 and D-15 (the per-file TAP name-set diff) are the same
   rule re-applied. A plan that reconciles a raw count instead of a name set repeats a
   mistake this repo has already paid for once.

2. **All deletions use `git rm`; never truncate.** `260914-poo`'s SUMMARY states this
   as a closing constraint and it held across 60 deletions. Applies directly to
   `shipped-modules.ts` + `shipped-modules.test.ts` (D-09) in this phase.

3. **Stage by explicit path, every commit.** "No `git add -A`, `git add .`, or
   `git commit -a` was used anywhere" (`260914-poo`). Binding here too, and doubly
   important given this phase's own untouchable-file list (`anno-bank.ts`,
   `anno-coverage.ts`, `anno-enum-gen.ts`, `anno-tools.ts`, `.claude/settings.json`).

4. **Stop-and-report rather than adjust a tripped assertion.** `260914-poo`'s
   deviation log shows the exact shape: a deletion tripped `textmon-seam.test.ts`'s own
   pinned-consumer assertion. The plan's own instruction — "the new names are the
   finding. Report them and stop rather than adjust an assertion" — was honored: the
   executor paused, reported the measured evidence, and only the orchestrator
   authorized widening scope (deleting the tripped file itself, since it
   independently qualified). **This is the direct precedent for what to do if cutting
   a case in Phase 56 trips some OTHER surviving file's own pinned assertion** (e.g. a
   file with a hand-written owner/consumer list that names one of the 17 files being
   edited). Do not silently patch the assertion; stop, report, let the orchestrator
   decide.

5. **A completed cut leaves prose about what stayed deliberately untested.**
   `260914-poo`'s "Kept but now deliberately untested" section lists modules
   (including `shipped-modules.ts` itself, pre-Phase-56) that lost their dedicated
   test file and says so plainly rather than treating it as a gap. Phase 56's own
   SUMMARY (D-16) should carry an equivalent section if any surviving module ends up
   less covered as a side effect.

6. **Stale comments are named and left alone on purpose**, never swept opportunistically.
   `260914-poo`'s "Stale comments left in place, deliberately" section is the direct
   precedent for Phase 56's D-13 list (`vice-proxy.test.ts:3488`,
   `hostpath-consumers.test.ts:624`).

**`260914-uhm`'s SUMMARY adds one more precedent specific to a pure scanner file:**
when a whole file's *only* purpose is scanning source text and it calls none of the
modules it discusses, the deletion rationale is: quote the invariant it guarded, state
that the invariant's *reasoning* survives elsewhere (a header comment), and name that
only the *enforcement* is gone. `shipped-modules.test.ts` (D-09, whole-file, 16 cases,
449 lines) is this exact shape — model its SUMMARY entry on `260914-uhm`'s "What and
why" paragraph.

## Edit Kind 2 — Strip-in-place of a genuinely mixed case (D-02/D-03)

**Analog:** `src/mcp/vice/anno-store.test.ts:3848-3974`, case `CR-08` — the ONE case
Research Q3 confirmed as genuinely mixed among CONTEXT.md's ten candidates.

**The exact boundary, read in full:**

- **Lines 3848–3935 — KEEP byte-for-byte.** Real behavioural coverage: opens a real
  store at revision 3, truncates a retained snapshot to zero bytes, asserts
  `revertTo` throws `AnnoStoreError` (inside the `ViewError` family) naming both the
  store path and the snapshot path and saying "NOTHING has been replaced", asserts the
  live store is untouched (`assertRefusedRevertLeftEverythingIntact`), and asserts a
  **fresh** `openStore()` call still succeeds afterward. Every assertion here exercises
  production behavior against a real store. Nothing here reads `anno-store.ts` as text.

- **Line 3937 — the tail's own boundary comment, verbatim:**
  ```typescript
  // AND THE SOURCE ORDER, ASSERTED HERE RATHER THAN AS ITS OWN TEST, because
  // it is the SAME CLAIM as everything above seen from the other side: ...
  ```
  This comment is itself the exact seam a strip-in-place edit should cut at — remove
  from here to the end of the case.

- **Lines 3937–3974+ — REMOVE.** This tail calls `codeOnly(readFileSync(join(HERE,
  "anno-store.ts"), "utf8"), true)`, extracts `revertTo`'s function body by source-text
  slicing (`stripped.indexOf("export function revertTo")` → matching `\n}`), and
  asserts on the ORDER of three string landmarks found inside that extracted text
  (`validate < closeCaller`, etc.). This is a pure source-text assertion and must go
  under D-01/D-02.

- **Rename:** D-03 makes renaming mandatory whenever the case name promises both
  halves. This CR-08 case's current name — `"CR-08: a retained snapshot TRUNCATED to
  zero bytes is REFUSED by name -- the live store stays byte-identical, the caller's
  handle still answers, and a later openStore succeeds"` — **already describes only the
  behavioural half**, so (per Research Q3's own note) no rename is textually required
  here; D-03's blanket mandate is satisfied by leaving the existing name as-is. Verify
  this holds at execution time — if the surviving name still promises anything the
  stripped tail proved, rename it.

**Contrast (what NOT to do):** Research Q3 found the other nine CONTEXT.md-cited
candidates (`anno-store.test.ts:5321`, `anno-index.test.ts:439`, `prg-image.test.ts:86`,
`capture-predicate.test.ts:185`, `anno-join.test.ts:284`, `anno-graphics.test.ts:210`,
`anno-derive.test.ts:407`, `stock-dispatch.test.ts:3182`, `vsf-slice.test.ts:187`) are
**not mixed at all** — each is a wholly clean, 100%-behavioural case sitting textually
*adjacent* to a real scanning case in the same file. Do not apply D-02/D-03 to any of
these; they need zero edits and must simply survive the surrounding file's surgery
untouched. Applying a strip-in-place edit to a case that is already 100% behavioural
would be a no-op edit that adds risk for nothing — resolve each case's own `test(...)`
paren-matched boundary before judging it, never judge by line-number proximity.

## Edit Kind 3 — Dropping a "asserted by X" enforcement clause, keeping the constraint (D-11)

**Analog:** `260914-poo-SUMMARY.md` § "Planning-vocabulary convention: retired
outright (D-6)" — the direct precedent for this exact edit shape:

> "Also dropped: the `CLAUDE.md` Constraints-section citations crediting enforcement to
> `scripts/check-skill-capability-honesty.mjs` and `spawn-seam.test.ts` (both now
> deleted). **The underlying project constraints those bullets describe... stay
> untouched. Only the now-false enforcement claims went.**"

That is precisely D-11's rule, already proven working once in this repo: keep the
constraint sentence, drop only the clause that credits a specific (now-gone) test file
or scanner with enforcing it.

**Concrete before/after material for each of D-11's five named files** (all five
clauses found; `capture-predicate.ts`'s was found by reading, not grep, exactly as
CONTEXT.md predicted):

### `src/mcp/vice/anno-store.ts` (4 occurrences — the largest repair in the set)

1. **Line 70** (inside the "NEVER load a SQLite extension" trap):
   ```
   `anno-seam.test.ts` asserts all three names are absent from this
   module's code.
   ```
   → Drop the sentence naming `anno-seam.test.ts`; the trap instruction itself ("NEVER
   load a SQLite extension...") is the constraint and stays.

2. **Line 1192** (inside the single-commit-site comment):
   ```
   ... never a second
   `handle.db.exec` of the bare word: `anno-seam.test.ts` asserts this module
   contains exactly ONE such statement, because the durability proof's planted
   violation must have a single site...
   ```
   → Keep "It must be `commitTransaction` and never a second `handle.db.exec` of the
   bare word" (the constraint). Drop the `anno-seam.test.ts asserts...` clause.

3. **Line 1376** (inside `applyWriteWithoutCommit`'s doc comment):
   ```
   `anno-seam.test.ts` asserts that no shipped module other than this one so
   much as names it -- the same bound `applyWriteWithoutCommit` carries, by the
   same mechanism rather than a second one.
   ```
   → Keep the surrounding "EXPORTED FOR EXACTLY ONE REASON" rationale. Drop this
   enforcement sentence.

4. **Line 1896** (same function's doc comment, second mention):
   ```
   Its only caller is a spawned, test-only helper that is deliberately absent
   from `package.json`'s `files[]`, and `anno-seam.test.ts` asserts that no
   shipped module other than this one so much as names it.
   ```
   → Keep the first clause (`files[]` absence is a separate, still-true fact). Drop
   only `, and anno-seam.test.ts asserts that no shipped module other than this one so
   much as names it.`

   Also note **line 57** (`"the shipped-module assertion scans shippedTsModules()..."`)
   describes *why* this module must be in `package.json`'s `files[]` — that clause
   names the mechanism, not a test file, and is about `files[]` completeness (D-07's
   surviving `anno-seam.test.ts:238` case), which is NOT being deleted. Leave line 57
   alone; it is not in D-11's false-enforcement set.

### `src/mcp/vice/dxa-blocks.ts` (1 occurrence)

Lines 19-20:
```
never opens the store's `.db` file,
never imports `anno-store.ts`, and asserts nothing about how the caller got
its rows.
```
and the naming clause a few lines up:
```
`anno-store.ts` is the one module
`anno-seam.test.ts` allows to name that dependency, and this module reads
only the ALREADY-FETCHED rows a caller passes in...
```
→ Keep "It also NEVER NAMES `node:sqlite` and NEVER OPENS THE STORE FILE ITSELF" (the
constraint). Drop the `anno-seam.test.ts allows to name that dependency` clause —
reword minimally to state the constraint without crediting a specific test file, e.g.
"`anno-store.ts` is the one module permitted to name that dependency" (no test-file
citation). **D-10 forbids new prose** — the fix is deletion/trimming of the false
credit, not composing a new justification.

### `src/mcp/vice/evid-ingest.ts` (1 occurrence)

Lines 53-56 (trap 4, "NEVER open a store here"):
```
This module imports nothing from
`anno-store.ts` and touches no filesystem, transport or
child-process -- the write happens in `anno-tools.ts`'s dispatch
arm, which is what keeps this module out of `anno-seam.test.ts`'s
single-consumer set (`anno-store.ts` remains the one module naming
`node:sqlite`).
```
→ Keep "This module imports nothing from `anno-store.ts` and touches no filesystem,
transport or child-process -- the write happens in `anno-tools.ts`'s dispatch arm."
Drop "which is what keeps this module out of `anno-seam.test.ts`'s single-consumer
set" — that clause credits the now-gone enforcement, not the constraint itself.

### `src/mcp/vice/memmap-lookup.ts` (1 occurrence)

Lines 11-13:
```
It also NEVER NAMES `node:sqlite` and NEVER OPENS THE ANNOTATION STORE:
`anno-store.ts` is the one module `anno-seam.test.ts` allows to name that
dependency, and this module answers a pure question about a static JSON
file that has nothing to do with the store's own persistence.
```
→ Same shape as `dxa-blocks.ts`. Keep "It also NEVER NAMES `node:sqlite` and NEVER
OPENS THE ANNOTATION STORE" and "this module answers a pure question about a static
JSON file that has nothing to do with the store's own persistence." Drop the
`anno-seam.test.ts allows to name that dependency` credit.

### `src/mcp/vice/capture-predicate.ts` (~line 40 — found by reading, matches D-11 exactly)

Lines 38-41:
```
This module performs NO filesystem and NO network I/O: every function takes
bytes, an already-parsed JSON value, or a string array, and returns values.
Callers obtain and persist the bytes themselves. That is the same claim
`prg-image.ts` and `vsf-slice.ts`'s library region make about themselves, and
`capture-predicate.test.ts` asserts it from this module's own source rather
than trusting this paragraph.
```
→ Keep "This module performs NO filesystem and NO network I/O... Callers obtain and
persist the bytes themselves." Keep the cross-reference to `prg-image.ts`/
`vsf-slice.ts`'s equivalent claim about themselves (that is a design-parity statement,
not an enforcement credit). Drop only "and `capture-predicate.test.ts` asserts it from
this module's own source rather than trusting this paragraph" — this is exactly the
false enforcement clause D-11 names, confirmed to name neither `codeOnly` nor
`shipped-modules` directly (it references `capture-predicate.test.ts`'s own scanning
case, which is being deleted per Research Q1's `capture-predicate.test.ts` hit list,
L217/L228).

**General shape to copy for all five:** find the clause of the form `"<test-file>
asserts/allows <fact>"` (or `"which is what keeps this module out of <test-file>'s
... set"`), delete only that clause (and any dangling connective like a leading `, and`
or trailing `-- because ...` that exists solely to attach it), and leave every
surrounding sentence — the actual constraint — untouched, matching CLAUDE.md's own
Comments convention: "state WHY the file exists... never as a bare pointer" — the
constraint is the WHY; the deleted clause was only ever a pointer to enforcement.

## Edit Kind 4 — A module-scope helper only deleted cases used

**Analog:** `src/mcp/vice/evid-report-keys.test.ts:334-388` — the exact case Research
Q1/Q5 flagged.

**Shape, read in full:**

- `evidenceFamilyModules(dir)` (line 334) — module-scope helper, calls
  `shippedTsModules(dir)` directly. Used only by the two "Direction 4" cases below it
  (`evid-report-keys.test.ts:372`, the scanning case; the doomed direct hit Research Q1
  lists at L372/L388).
- `assertRuntimeUnionHasExactlyTwoMembers(source)` (line 341) and
  `assertNoRuntimeLiteralOutsideUnion(source, allowedMembers, label)` (line 356) —
  both call `codeOnly(source, true)` directly. Both are used ONLY by the two Direction-4
  cases at line 372 ("clean control") and its "planted control" sibling immediately
  below (line ~388).

**The rule to state in the plan** (matches Research Q1's own framing): a module-scope
helper goes with its cases **only when every caller of that helper is itself being
deleted**. Before deleting `evidenceFamilyModules`, `assertRuntimeUnionHasExactlyTwoMembers`,
or `assertNoRuntimeLiteralOutsideUnion`, grep the WHOLE file for other call sites — if
any surviving case calls the same helper, the helper stays and only the doomed
call sites inside the two Direction-4 cases go. In this specific file, all three
helpers' only callers are the two Direction-4 cases being cut, so all three helpers are
safe to delete alongside them. This is a per-file judgment, not a blanket rule — Q1's
own finding is that other files (e.g. `capture-predicate.test.ts`'s
`moduleSpecifiers` helper, `anno-export-asm.test.ts`'s `blockConstructionSlice`) need
the same "grep every caller first" check applied independently before assuming the
helper is safe to remove.

## Edit Kind 5 — The per-file TAP name-set diff gate (D-15)

**Analog:** Research Q1/Q5, "verified working against `prg-image.test.ts` during this
discussion" — already run live in this session, output reproduced below so a plan can
cite the exact command and shape verbatim.

**Command:**
```
node --test --test-reporter=tap <file>
```

**Verified output shape** (re-run live for this pattern map, `prg-image.test.ts`):
```
TAP version 13
# Subtest: parsePrg: extracts a little-endian load address and the remaining body
ok 1 - parsePrg: extracts a little-endian load address and the remaining body
  ---
  duration_ms: 9.673817
  type: 'test'
  ...
# Subtest: parsePrg: a 2-byte or shorter input throws
ok 2 - parsePrg: a 2-byte or shorter input throws
  ---
  duration_ms: 1.57361
  type: 'test'
  ...
```
followed by a trailing `# tests N / # pass N / # fail 0` summary block.

**The gate, as a plan should state it:**
1. Before touching a file, run the command above and capture every `ok N - <name>`
   line into a SET (strip the `ok N - ` prefix and the trailing `---` block; keep only
   the name string).
2. Make the edit (whole-case deletions and/or the one strip-in-place case).
3. Re-run the same command against the same file.
4. Diff the two SETS. The only names that may disappear are the ones the plan
   explicitly intended to remove (by name, listed in the plan). No other name may
   disappear. Any survivor whose name changed (e.g. a D-03 rename) must appear in the
   AFTER set under its new name and be reconciled by name, not merely by count.
5. `npm run typecheck` must also exit 0 at this same checkpoint (D-11's production-file
   edits and any import removal both risk a typecheck break).

This sidesteps the two known traps named in Research Q4: the whole-suite hang on
`vice-proxy.test.ts` and the live-broker `BACK-05` failure — neither file is in this
phase's 17-file scope, and neither is exercised by a per-file invocation.

## Shared Patterns

### Never trust a symbol-name grep as ground truth for "does this case scan source"
**Source:** Research Q2 (the `scope-scan-v2/v3.mjs` planted-violation proof) and the
`codeOnly()` header itself (`shipped-modules.ts:312-322`, quoting two prior measured
failures on `anno-coverage.ts:1495` and `incident-record.ts:107`).
**Apply to:** every wave that narrows a file's candidate case list before hand-reading
it. A throwaway scratch scanner (D-14) must (a) never import `codeOnly()` — the module
is being deleted, (b) distinguish comment/string text from real code using the same
regex-vs-division disambiguation `codeOnly()` uses (`REGEX_PRECEDING_KEYWORDS`,
`shipped-modules.ts:176-261`, re-derived not imported), and (c) be proved against a
planted fixture before its output is trusted (Research Q2's four-case fixture is
directly reusable as a template).

### Every hit is still hand-read; a scanner only narrows, D-14's helper-indirection blind spot
**Source:** Research Q2's `anno-seam.test.ts` finding — a case calling `sqliteImporters()`,
which itself calls `stripForSpecifierScan()`, is invisible to a one-level scanner
because the case's own body never mentions the doomed symbol.
**Apply to:** every file in this phase's scope, but especially files with heavy
internal helper reuse (`anno-store.test.ts`, `anno-export-asm.test.ts`,
`anno-seam.test.ts`). For `anno-seam.test.ts` specifically, D-06/D-07's already-locked
21/23-cut judgment is authoritative over any fresh scanner run — trust the locked list,
not a new scan.

### D-15's SET-diff gate is the uniform per-file verify step across all five edit kinds
Already detailed above as Edit Kind 5 — restated here because it is the ONE mechanism
every plan in this phase should cite, regardless of which edit kind(s) that plan
performs.

## No Analog Found

None — every edit kind this phase performs has a direct, already-measured in-tree
precedent (listed above). There is no "new file with no close match" case here, because
this phase creates no new files.

## Metadata

**Analog search scope:** `.planning/quick/260914-poo-.../260914-poo-SUMMARY.md`,
`.planning/quick/260914-uhm-.../260914-uhm-SUMMARY.md`,
`src/mcp/vice/anno-store.test.ts`, `src/mcp/vice/anno-store.ts`,
`src/mcp/vice/dxa-blocks.ts`, `src/mcp/vice/evid-ingest.ts`,
`src/mcp/vice/memmap-lookup.ts`, `src/mcp/vice/capture-predicate.ts`,
`src/mcp/vice/evid-report-keys.test.ts`, `src/mcp/vice/prg-image.test.ts` (live TAP run).
**Files scanned:** 10 read in full or targeted range, 2 SUMMARY.md precedents read in
full, 1 live command re-run for verification.
**Pattern extraction date:** 2026-09-14
