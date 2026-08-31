---
phase: 31-procedure-re-pointing
reviewed: 2026-08-31T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - scripts/check-no-regenerator2000.mjs
  - src/mcp/vice/skill-attribution.test.ts
findings:
  critical: 2
  warning: 6
  info: 3
  total: 11
status: issues_found
---

# Phase 31: Code Review Report

**Reviewed:** 2026-08-31
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Two source files were in scope. `scripts/check-no-regenerator2000.mjs` changed 17 lines
of prose only; I confirmed the re-point is factually correct (`.planning/ROADMAP.md:723-726`
has exactly two Phase 31 criteria, narrowed by `D-01`, and criterion 1 is the ABS-02
two-naming-lines sentence), that no predicate, pin, scope or count moved, that the gate
runs green (`157` exempt occurrences, floor 350, 400 files scanned), and that no other
Phase-31 `criterion 4` citation survives outside `.planning/`.

`src/mcp/vice/skill-attribution.test.ts` is a pure +384-line addition (two hunks, zero
deletions). Typecheck is clean and all 14 tests pass. The `ABS02_ADAPTED_LINE` derivation
strategy works as designed: the subject-occurrence count in this path is **12 before and 12
after**, so the removal gate's `attribution-guard-test` pin of 12 was not disturbed, and the
derivation is genuinely guarded (empty-string, single-segment and `endsWith` assertions all
fire loudly on a bad derivation — I traced `undefined`, trailing-slash and object-valued
`manifest.repository` and each one reddens before the corpus scan).

The rot-resistance question is where this falls down. I found **two ways the new guard passes
while the claim it scores is false**, both reproduced:

1. On a fresh checkout — which is exactly CI's state at the `Test` step — the shipped-tree half
   never runs. 14/14 green, no diagnostic. The "TWO TREES, NOT ONE" departure that is the
   guard's entire reason for existing is unscored where the gate actually gates.
2. The byte-exactness comparison runs against the regex *capture group*, not the file's
   physical lines, so the first and last line of every block are truncated before comparison.
   `ATTRIBUTION (ABS-02)Adapted from regenerator2000.` and
   `  Source repository: <url>-->` both score as byte-identical, where the guard's own stated
   `grep -rx` semantics would report zero matches.

Counts are correctly expressed as relations and a floor with one exception (a hardcoded `5`
that duplicates `manifest.procedures.length`), and no assertion pins the measured total `10`.
The pinned-literal rot the phase context asked about is largely avoided.

## Critical Issues

### CR-01: The two-tree half of the new guard is silently skipped in CI — the shipped tree is never scored where the gate runs

**File:** `src/mcp/vice/skill-attribution.test.ts:375-377`, `:840-845`, `:912-922`
(and `.github/workflows/ci.yml` step ordering: `Test` at `:141`, the two steps that
materialise the tree at `:170` and `:180`)

**Issue:**
`installer/skills/` is gitignored (`.gitignore:43`) and is generated only as a *side effect*
of `packFiles()` → `npm pack --dry-run` → `prepack` → `sync-skills.mjs`. In CI, nothing before
the `Test` step runs that: the steps are checkout → setup-node → `npm ci` (cwd
`src/mcp/vice`) → typecheck → apt acme → scaffold assemble → **`npm test`**. Both consumers
that generate the tree (`check-npm-packages.mjs` at `:170`, the removal gate at `:180`) run
*after* the test.

So in CI `walkSkills(installer/skills)` returns `[]`, `skippableEmptyRoot()` returns `true`,
the `continue` at `:844` fires, `totals` never gets a shipped entry, and the
`assert.deepEqual(source, shipped)` at `:914` is skipped by the `if (shipped)` guard. Nothing
is reported — `node --test` emits no diagnostic for the skip.

Reproduced in a throwaway `git worktree` at the reviewed HEAD (identical to CI's checkout
state, `installer/skills` absent): **14/14 ok, 0 fail**, with the shipped tree never opened.

This defeats the guard's stated purpose verbatim: *"the shipped tree is precisely the one no
tracked-file gate can see. Scanning only `src/skills/` would leave the shipped tree unguarded
for exactly as long as it takes someone to forget the sync"* (`:318-328`). It is also why
criterion 1 says **"10 instances across two trees"** — in CI only 5 are ever counted. The
`31-02-SUMMARY.md:43` note observed the absent-tree state and resolved it by materialising the
tree *locally*; it did not check CI's ordering, so the local green run (two trees) is not the
run CI performs (one tree).

**Fix:** Generate the shipped tree before the test step, and make the skip refuse to fire in
CI so the vacuity cannot return silently.

```yaml
# .github/workflows/ci.yml -- insert immediately before "- name: Test"
- name: Generate the shipped skills tree (scored by skill-attribution.test.ts)
  working-directory: installer
  run: node scripts/sync-skills.mjs
```

```ts
// src/mcp/vice/skill-attribution.test.ts:375
function skippableEmptyRoot(root: string, fileCount: number): boolean {
  // Never skippable under CI: there, the shipped tree is generated by an
  // explicit step, and an absent tree means that step did not run. Letting
  // the skip fire in CI is what made the two-tree half of this guard vacuous
  // exactly where it gates.
  if (process.env.CI) return false;
  return fileCount === 0 && root === SKILL_ATTRIBUTION_SHIPPED_ROOT;
}
```

Add the matching third branch assertion beside the existing three at `:816-830`, so the new
CI branch is itself proven rather than assumed.

### CR-02: The byte-exactness claim is false at every block's first and last line — the comparison runs against the regex capture, not the file's lines

**File:** `src/mcp/vice/skill-attribution.test.ts:356-365` (predicate), `:857-859`
(call site), `:192-194` (extractor)

**Issue:**
`namingLineCountsIn()` documents `grep -rx` semantics — *"EXACT whole-line equality"*,
*"Byte-identity is the claim being scored"* (`:348-355`, and `EQUALITY IS BYTES` at
`:276-284`). But it is handed `attributionBlocks(...)` output, which is the regex capture
group `m[1]` from `/ATTRIBUTION \(ABS-02\)([\s\S]*?)-->/g`. That capture starts *mid-line*
(right after the marker) and ends *mid-line* (right before `-->`), so the first and last
elements of its `split("\n")` are **fragments of physical lines**, not lines. Comparing a
fragment with `===` against a whole-line constant makes those two positions behave like a
suffix/prefix match — precisely the loosening the comment says it refuses.

Two drift classes therefore pass. Both reproduced:

```
A) on-disk line: "ATTRIBUTION (ABS-02)Adapted from regenerator2000."
   scored:       { adapted: 1, repository: 1 }      <-- passes

B) on-disk line: "  Source repository: https://github.com/ricardoquesada/regenerator2000-->"
   scored:       { adapted: 1, repository: 1 }      <-- passes
```

`grep -rx 'Adapted from regenerator2000.'` reports zero matches on (A) and
`grep -rx '  Source repository: …'` reports zero on (B). Case (A) also makes the guard
disagree with the criterion it scores: a tree where one of the five instances is jammed onto
the marker line is *not* "byte-identical across two trees", yet the guard is green. The
cross-tree `deepEqual` does not help — it compares counts, and (A)/(B) produce the same counts
in both trees once the sync copies the defect across.

The one-character-mutation proof at `:925` cannot catch this, because both plants mutate the
*interior* lines, which are whole lines in the capture.

**Fix:** Score the file's physical lines inside the block's line range, so the comparison is
against real lines. Return line spans from the extractor and slice the file:

```ts
/** Every ABS-02 block as a 1-based inclusive line span. The marker must be the
 *  last thing on its own line and `-->` must not share a line with a naming
 *  line -- otherwise the "whole line" being compared is a fragment. */
function attributionBlockLineSpans(text: string): { first: number; last: number }[] {
  const lines = text.split("\n");
  const spans: { first: number; last: number }[] = [];
  let open: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    if (open === null) {
      if (lines[i].includes("ATTRIBUTION (ABS-02)")) open = i;
      continue;
    }
    if (lines[i].includes("-->")) { spans.push({ first: open + 1, last: i + 1 }); open = null; }
  }
  return spans;
}

// call site (replaces the fileBlocks loop at :857)
const lines = readFileSync(file, "utf8").split("\n");
for (const [index, span] of attributionBlockLineSpans(lines.join("\n")).entries()) {
  const counts = namingLineCountsIn(lines.slice(span.first - 1, span.last).join("\n"));
  /* ... unchanged ... */
}
```

Then add a third plant to the mutation test that jams the marker onto the adapted line and
asserts `{ adapted: 0, repository: 1 }`, so the boundary case is proven rather than assumed.
Note this shape is also the gate's `skillAttributionBlocks()` shape, which resolves WR-02 in
the same edit.

## Warnings

### WR-01: A shipped tree that exists but holds no `SKILL.md` is silently skipped; `walkSkills` also swallows `EACCES`

**File:** `src/mcp/vice/skill-attribution.test.ts:375-377`
(with `scripts/lib/skill-corpus.mjs:46-50`)

**Issue:** `skippableEmptyRoot()` keys the skip on `fileCount === 0`, and its own doc claims
it is *"True ONLY for a zero-file SHIPPED root: a fresh clone has never run the installer's
`prepack`, so the generated tree legitimately does not exist yet"*. It conflates **absent**
with **present but containing no `SKILL.md`**. An interrupted or half-run `sync-skills.mjs`, or
a tree left holding only `references/` and `scripts/`, reads as "does not exist yet".

Reproduced: creating `installer/skills/c64-memory-mapping/references/leftover.md` in an
otherwise-fresh worktree leaves 14/14 green with the shipped tree unscored. `walkSkills()`
additionally has `catch { return; }` around `readdirSync`, so an `EACCES` or a broken symlink
on the shipped root is indistinguishable from absence. This survives the CR-01 fix if the fix
is only "generate the tree in CI" — a generator that half-fails still takes the skip branch.

**Fix:** Key the skip on absence, not on emptiness, and fail whenever the root exists:

```ts
function skippableEmptyRoot(root: string, fileCount: number): boolean {
  if (process.env.CI) return false;
  return fileCount === 0 && root === SKILL_ATTRIBUTION_SHIPPED_ROOT && !existsSync(root);
}
```

and add the fourth branch assertion beside `:816-830`:
`assert.equal(skippableEmptyRoot(SKILL_ATTRIBUTION_SHIPPED_ROOT_THAT_EXISTS, 0), false, …)`.

### WR-02: Two divergent ABS-02 block extractors; the gate's "agree by construction" claim is false, and the divergence is an over-exemption route

**File:** `scripts/check-no-regenerator2000.mjs:301-325` vs
`src/mcp/vice/skill-attribution.test.ts:192-194`

**Issue:** The gate's header asserts the two implementations *"agree on where a block begins
and ends by construction"* (`:301-306`, restated in the reviewed `why` at `:529-531`, and
echoed by the test at `:854-856`). They do not. The gate is line-based and, after setting
`open = i`, `continue`s — so it never checks the opener line for `-->`. The test's regex allows
`-->` on the opener line. On a single-line block they disagree:

```
input line 2: "<!-- ATTRIBUTION (ABS-02) Adapted from regenerator2000. -->"
input line 3: "LIVE REINTRODUCTION: regenerator2000 is invoked here"
input line 4: "more regenerator2000 prose"
input line 5: "<!-- an unrelated comment -->"

gate skillAttributionBlocks() -> [{ firstLine: 2, lastLine: 5 }]   <-- swallows :3 and :4
test regex                    -> 1 block, terminating on line 2
```

Inside the gate, `isInsideSkillAttributionBlock()` would then report the two live mentions at
`:3`/`:4` as exempt. The damage is bounded — `skillBlocks` only applies to the six pinned
paths and the `===` hit-count assertion at `:939-949` would trip on the extra exempted
occurrences — so the defence is the count pin, not the anchor agreement the header claims.
This is untouched by Phase 31 but sits in a reviewed file whose prose the phase edited.

The duplication is *forced*: importing `skillAttributionBlocks` into the test would add the
subject to the import path, raising this file's pinned occurrence count from 12 to 13 and
reddening the gate — a pin no plan in this phase may move.

**Fix:** Move the extractor to a subject-free shared home so both sides can import it, and
close the gate's single-line hole:

```js
// scripts/lib/skill-corpus.mjs -- the module both sides already import
export function skillAttributionBlockSpans(text) {
  const lines = String(text ?? "").split("\n");
  const spans = [];
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    if (open === null) {
      if (!lines[i].includes("ATTRIBUTION (ABS-02)")) continue;
      open = i;
      // Close on the SAME line when the comment terminates there -- the gate
      // previously left such a block open and exempted everything up to the
      // next `-->` anywhere in the file.
      const markerEnd = lines[i].indexOf("ATTRIBUTION (ABS-02)") + "ATTRIBUTION (ABS-02)".length;
      if (lines[i].indexOf("-->", markerEnd) !== -1) { spans.push({ firstLine: i + 1, lastLine: i + 1 }); open = null; }
      continue;
    }
    if (lines[i].includes("-->")) { spans.push({ firstLine: open + 1, lastLine: i + 1 }); open = null; }
  }
  return spans;
}
```

Have `check-no-regenerator2000.mjs:310` and the test both delegate to it. Note the gate's
`re-measure` obligation: consolidating changes no counts on the current tree (verified: 5
blocks per tree, pins `2/2/1` per file, gate green), so no pin moves.

### WR-03: `ABS02_BLOCKS_PER_TREE_FLOOR = 5` is a magic literal duplicating `manifest.procedures.length` — the floor cannot ratchet

**File:** `src/mcp/vice/skill-attribution.test.ts:340`

**Issue:** The guard's own doctrine block says *"Nothing here compares a count against `10`,
or against `5`-as-an-equality"* and cites two prior incidents of pinned skill counts going red
(`:259-267`). It then hardcodes `5` as a floor. `5` is not an independent fact: it is
`manifest.procedures.length` (verified — the manifest lists exactly five procedures, one
attribution block each). Because the literal never rises, absorbing a sixth procedure and
forgetting its attribution block leaves this guard green at `blocks = 5 >= 5`. That case is
caught elsewhere (`:597-601`'s per-row `blocks.length === 1`), so this is a weakening of
defence-in-depth rather than a hole — but it is the exact magic-number shape the comment
disclaims, in the same file.

**Fix:**

```ts
/** The per-tree non-vacuity FLOOR on attribution blocks -- DERIVED from the
 * pinned manifest, not written, so absorbing a sixth procedure raises the
 * floor with it instead of leaving a stale literal behind. */
const ABS02_BLOCKS_PER_TREE_FLOOR: number = manifest.procedures.length;
```

The existing `assert.ok(ABS02_BLOCKS_PER_TREE_FLOOR > 0, …)` at `:810` already guards a bad
derivation.

### WR-04: The re-pointed prose cites a mutable ROADMAP ordinal that nothing mechanically checks — the rot this phase repaired will recur

**File:** `scripts/check-no-regenerator2000.mjs:293-296` and `:526-528`

**Issue:** Both edited sites now read `ROADMAP Phase 31 criterion 1`. That is correct today
(verified against `.planning/ROADMAP.md:725`), and the parenthetical recording the `criterion
4` → `criterion 1` move is good practice. But the citation is still an **ordinal into a mutable
planning document**, and this is already the second renumbering of the same sentence in three
days. Nothing enforces it: `docs-dangling-refs.test.ts` scans `.planning/ROADMAP.md` for
dangling refs but not for criterion ordinals; `comment-phase-pointers.test.ts` scans only
`package.json` `files[]` filtered to `.ts`/`.mts`, so a `scripts/*.mjs` file is out of its
module set, and it detects hand-off shapes and CUT phases, not stale ordinals. The next
`D-NN` renumbering silently falsifies both strings again, and the parenthetical will then be
wrong twice over.

**Fix:** Anchor on the stable requirement id, which does not renumber. `REPOINT-03` appears
twice in `skill-attribution.test.ts` and **zero** times in the gate:

```js
 * ROADMAP Phase 31 `REPOINT-03` (currently stated as criterion 1; cited as
 * criterion 4 until 2026-08-30, when `D-01` narrowed the phase to two
 * criteria -- the ordinal moves, the requirement id does not) requires it to
 * survive the re-pointing with its two naming lines byte-identical.
```

### WR-05: The file's normative header was not updated — it under-counts its own rot guards and omits the two-tree scope departure

**File:** `src/mcp/vice/skill-attribution.test.ts:48-64` (and `:30-46`, `:768`)

**Issue:** The diff is a pure addition; the header was left untouched. It still declares
`NON-VACUITY, five ways, because each covers a different way this file could rot into a
no-op`, then enumerates 1–5. The new guard is a sixth, acknowledged only 700 lines down at
`:768` (*"ROT GUARD 6 for this file (the header enumerates five; this is the sixth)"*). The
header also frames the whole file as `src/skills/`-scoped (*"ABSENCE, over the WHOLE
`src/skills/` corpus"*, `:34-39`) and never mentions the `installer/skills/` departure; that
is documented only at `:254-257`. In a codebase whose CLAUDE.md makes structured file headers
normative ("documentation-as-code", "WHAT NOT TO DO, with the specific past mistake named"),
a header that mis-states its own guard count and hides its widest scope departure is the
defect this project's conventions exist to prevent — and pointing at the discrepancy from the
body rather than fixing it institutionalises it.

**Fix:** Change `NON-VACUITY, five ways` to `six ways` and add item 6:

```
//   6. The two ABS-02 naming lines are scored per BLOCK across BOTH skill
//      trees, and that scoring is proven to bite on two one-byte plants held
//      only in memory. This is the ONE guard in this file that reads
//      `installer/skills/` as well as `src/skills/` -- see the block comment
//      beside `ABS02_ADAPTED_LINE` for why, and CR-01 for the CI step that
//      must materialise the shipped tree before this file runs.
```

and delete the now-redundant "the header enumerates five" aside at `:768`.

### WR-06: PLANT A's mutation depends on the upstream name's first character having a distinct uppercase form — it goes red on a correct tree otherwise

**File:** `src/mcp/vice/skill-attribution.test.ts:946-953`

**Issue:** The plant is built as
`ABS02_ADAPTED_LINE.charAt(nameAt).toUpperCase()`, where `nameAt` is the index of the derived
upstream name. If `manifest.repository`'s last segment ever begins with a character that has
no distinct uppercase form (a digit, a hyphen, an underscore — all legal in a GitHub repo
name), `mutatedAdapted === ABS02_ADAPTED_LINE` and the `assert.notEqual` at `:953` fires. The
result is a red test on a *correct* tree from a legitimate manifest change — the exact failure
mode the guard's own doctrine block was written to avoid (`:259-267`, and the
`check-skill-description-overlap.mjs` incident it cites). It fails loudly rather than
silently, which is why this is a warning and not a blocker.

**Fix:** Mutate the fixed, guaranteed-cased prefix instead of the derived name, and keep the
"exactly one differing position" assertion which already proves the strength of the plant:

```ts
// PLANT A -- lower-case exactly ONE character of the line's fixed prefix.
// "A" of "Adapted" is part of this constant's own literal text, so the plant
// does not depend on how the derived upstream name happens to be spelled, and
// it adds no new spelling of the subject to a file whose subject occurrences
// the removal gate pins at an exact count.
const mutatedAdapted = ABS02_ADAPTED_LINE[0].toLowerCase() + ABS02_ADAPTED_LINE.slice(1);
```

Both the `length` and `differingPositions === 1` assertions at `:952-960` still hold, and the
`nameAt` lookup at `:946-947` can go.

## Info

### IN-01: Inconsistent coercion and separator handling around the derived constants

**File:** `src/mcp/vice/skill-attribution.test.ts:303`, `:316`, `:784`

**Issue:** `:303` wraps with `String(manifest.repository)` but `:316` interpolates
`manifest.repository` bare into a template literal; `manifest` is `any` from `JSON.parse`, so
the two lines disagree about whether the value is trusted to be a string. The single-segment
assertion `!/[/\s]/.test(ABS02_UPSTREAM_NAME)` rejects `/` but accepts `\`, while
`upstreamFileRef()` at `:204` treats `[/\\]` as separators. Neither is exploitable — a
non-string or backslash-bearing value reddens the `endsWith` assertion at `:788` — but the
inconsistency invites a future reader to trust the wrong one.

**Fix:** Coerce once at `:303` into a `const REPOSITORY_URL: string = String(manifest.repository)`
and use it at `:303`, `:316`, `:788`, `:806`; widen the separator class to `[/\\\s]`.

### IN-02: `NOTICES_FILES` is duplicated across both reviewed files, in different order

**File:** `scripts/check-no-regenerator2000.mjs:224-228` and
`src/mcp/vice/skill-attribution.test.ts:448-452`

**Issue:** Two independent copies of the same three-path list, ordered differently
(gate: root, `src/mcp/vice`, `installer`; test: `src/mcp/vice`, `installer`, root). The test's
`NOTICES_FILES[0]` is used as the plant source at `:1060`, so the order is load-bearing on one
side and arbitrary on the other. Pre-existing; the same "re-deriving a cross-cutting seam
locally" anti-pattern CLAUDE.md names, and the same shape as WR-02.

**Fix:** Export the list once (`scripts/lib/skill-corpus.mjs` or a new
`scripts/lib/notices-files.mjs`) and import it in both.

### IN-03: The new constants deepen module-load coupling to an archivable `.planning/` phase-19 path

**File:** `src/mcp/vice/skill-attribution.test.ts:89-93`, `:303`, `:316`, `:340` (if WR-03 is applied)

**Issue:** `ABS02_UPSTREAM_NAME`, `ABS02_ADAPTED_LINE` and `ABS02_SOURCE_REPOSITORY_LINE` are
computed at module scope from
`.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json`.
The same file flags this fragility class explicitly for the notices list at `:441-442`
(*"deliberately NOT a `.planning/` path (WR-11 is deferred, and this plan must not add a new
instance of the archival fragility it names)"*). Phase-directory archiving is a live hazard in
this project. The failure is loud (a module-scope `readFileSync` throw takes all 14 tests
with it), so this is informational — but the new code makes the byte-exactness of *shipped*
prose depend on an archivable planning artifact, which is a step in the direction `:441`
declines to take.

**Fix:** No change required now. If WR-11 is ever taken up, this file has four call sites
rather than one; record that in WR-11's own note so the resolution covers them together.

---

_Reviewed: 2026-08-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
