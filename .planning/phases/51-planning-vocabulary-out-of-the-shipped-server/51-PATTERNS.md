# Phase 51: Planning Vocabulary Out of the Shipped Server - Pattern Map

**Mapped:** 2026-09-14
**Files analyzed (new/structurally-changed artifacts only):** 5
**Analogs found:** 5 / 5

**Scope note:** RESEARCH.md already covers the guard's anatomy and the
`shipped-modules.ts` precedent in depth — this file does not re-derive that,
it cites it and shows the concrete code a planner copies from. The ~93 file
comment-rewrites need no analog (they are prose rewrites against the §21.2
worked pair already in RESEARCH.md). This file covers only the handful of
genuinely new/changed artifacts: the ratchet ledger, the file-set enumerator,
the third planted control, and the D-09 byte-budget helper.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| Ratchet ledger (new file or new export, shape TBD — Claude's Discretion) | config/fixture data (frozen, shrink-only) | batch (assert-in-both-directions over a static list) | `src/mcp/vice/build.ts` `HOST_BOUND_ARTIFACTS` + its both-directions assertion (`build.ts:42-51`, `:192-199`); `src/mcp/vice/test-gate.mjs` `MANUAL_ONLY_TESTS` (`:20-33`) | role-match (frozen array), **no shrink-only precedent exists** — see below |
| New shipped-file-set enumerator (extends or sits beside `shipped-modules.ts`) | utility (file-set resolver) | transform (package.json → file list) | `src/mcp/vice/shipped-modules.ts` `shippedTsModules()` (`:151-162`) | role-match, needs extension (does not expand directories or non-`.ts` extensions) |
| Third planted control (widened guard, success criterion 5) | test (structural guard, planted-violation control) | event-driven (assert-throws / assert-catches over synthetic tree) | `src/mcp/vice/shipped-modules.test.ts` `withSyntheticPackage()` + its "planted violation" test (`:35-72`) | exact — this is the established idiom for "prove the guard sees a real file, not just a string" |
| D-09 byte-budget helper (`commentBytes` measurer) | utility (comment-span byte-total extractor) | transform (source text → integer) | `src/mcp/vice/comment-phase-pointers.test.ts` `extractCommentSpans()` (`:94`+, used at `:221`, `:445-452`) | role-match, needs a thin byte-summing wrapper, not a new extractor |
| Widened guard file itself (`skills-planning-vocabulary.test.ts`, D-01/D-02/D-03 changes) | test (structural guard) | batch (whole-file scan against `CATEGORIES`) | itself — the file already has everything except the file-set enumerator | exact (in-place widening, not a new file) |

## Pattern Assignments

### Ratchet ledger (D-04/D-05)

**Analog:** `src/mcp/vice/build.ts` `HOST_BOUND_ARTIFACTS`, and its
both-directions assertion.

**The frozen-list shape** (`build.ts:42-51`):
```typescript
export const HOST_BOUND_ARTIFACTS: string[] = [
  "vice-broker.mjs",
  "container-guard.mjs",
  "broker-state.mjs",
  "broker-launch.mjs",
  "broker-kill.mjs",
  "broker-epoch.mjs",
  "broker-control.mjs",
  "backend-detect.mjs",
  "host-tool.mjs",
  "ghidra-project.mjs",
];
```

**The both-directions assertion pattern** (`build.ts:192-199`, adapt for
"ledger vs. live scan" rather than "emitted vs. expected"):
```typescript
const emitted = emittedMjsFilesUnder(stagingDir);
const expected = [...HOST_BOUND_ARTIFACTS].sort();
const missing = expected.filter((f) => !emitted.includes(f));
const unexpected = emitted.filter((f) => !expected.includes(f));
if (missing.length > 0 || unexpected.length > 0) {
  throw new Error(
    "build: emitted file set does not match HOST_BOUND_ARTIFACTS.\n" +
      `  emitted:    ${JSON.stringify(emitted)}\n` /* ... */
  );
}
```

**Sibling frozen-list-with-a-standing-rule precedent** —
`test-gate.mjs:20-33`'s `MANUAL_ONLY_TESTS`, notable for its comment style
(a dated standing rule stated as a WHY, plus "extend this array, never add a
parallel list"):
```javascript
export const MANUAL_ONLY_TESTS = Object.freeze([
  "vice-broker-launch.test.ts",
  "vice-proxy.test.ts",
  // ...
]);
```

**Gap this phase's ratchet introduces, with no precedent in this tree:** every
existing frozen-list assertion in this codebase is a **static invariant**
(the emitted set always equals `HOST_BOUND_ARTIFACTS`; the automated set is
always `all tests minus MANUAL_ONLY_TESTS`). None of them is **shrink-only
across commits** — nothing here asserts "this list today is a subset of what
it was yesterday." D-04's ratchet needs a genuinely new assertion shape:
1. A frozen `RATCHET` array (file, family, count, and — per RESEARCH.md's
   recommended D-09 extension — `charsInCitations`, `commentBytes`), per the
   shape already sketched in RESEARCH.md's `## Code Examples` section.
2. A test that re-runs `scanForPlanningVocabulary()` (imported from the
   widened guard, never hand-rolled — same principle `shippedTsModules()`'s
   own header states about not hand-rolling a second enumerator) over each
   ledger entry's file and asserts `hits.length <= entry.count` (shrink-only,
   not equality) — modeled structurally on the both-directions style above,
   but one-directional by design (see RESEARCH.md's D-09 section for why
   one-directional is correct here).
3. A separate "the ledger is empty" test for D-05's final-plan exit
   condition, styled like `shipped-modules.test.ts`'s non-vacuity checks
   (assert something concrete, not merely "no error thrown").
**Answer to the scoping question:** no, there is no existing shrink-only
assertion in this tree to copy verbatim — the closest analogs give the
*array shape* and the *both-directions assertion style*, but the shrink-only
comparison operator (`<=` instead of `===`) is new. Store the ledger as an
**in-module frozen constant** (matching `HOST_BOUND_ARTIFACTS` and
`MANUAL_ONLY_TESTS`, both in-module rather than a sibling JSON/data file) —
that is the exclusive existing precedent for "committed frozen set consumed
by its own assertion," and there is no sibling-data-file precedent anywhere
in `src/mcp/vice/**` to imitate instead.

---

### Shipped-file-set enumerator (D-01/D-02/D-03, replaces `shippedSkillFiles()`)

**Analog:** `src/mcp/vice/shipped-modules.ts` `shippedTsModules()`
(`:151-162`), which already derives set (1) but only for `.ts`/`.mts`:
```typescript
export function shippedTsModules(dir: string = HERE): string[] {
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { files?: string[] };
  const entries = (pkg.files ?? []).filter((f) => /\.(ts|mts)$/.test(f));
  for (const entry of entries) {
    if (!existsSync(join(dir, entry))) {
      throw new ShippedFilesEntryMissingError(
        `package.json files[] names ${entry} but it does not exist on disk -- update files[] rather than letting the scanned set shrink silently`,
      );
    }
  }
  return entries;
}
```
Confirmed by direct inspection: this function does **not** expand directory
`files[]` entries (e.g. `"resources/"` in a synthetic test input at
`shipped-modules.test.ts:46` is passed through as a literal string, never
walked) and filters to `.ts`/`.mts` only — so it silently drops `.md`,
`.json` entries and the real `resources/` directory. RESEARCH.md's Pitfall 2
already names this precisely; do not reuse `shippedTsModules()` unmodified.

**Existing directory-walk-with-exclusions precedent to combine with it** —
`shippedSkillFiles()` in the guard file itself (`skills-planning-vocabulary.test.ts:234-251`):
```typescript
function shippedSkillFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry.startsWith("zz-scratch") || entry === "node_modules") continue;
        walk(full);
        continue;
      }
      if (TEXT_EXTENSIONS.some((e) => entry.endsWith(e))) out.push(relative(ROOT, full).split(sep).join("/"));
    }
  };
  walk(SKILLS_DIR);
  return out.sort();
}
```
This is the function D-01 replaces (per RESEARCH.md), and it is a plain
directory walk — not `files[]`-derived, which is exactly wrong for the
widened surface (it would also pick up test files never published to npm).
**Recommended shape:** a new function (either a third export in
`shipped-modules.ts`, or local to the guard file) that (a) reads
`package.json.files`, (b) for each entry that `statSync` resolves to a
directory, walks it with `shippedSkillFiles()`'s exclusion + extension-filter
logic, (c) for each entry that is a file, includes it directly if its
extension is in `TEXT_EXTENSIONS`, (d) throws `shippedTsModules()`'s
existence-check error shape for any entry missing from disk, and (e) unions
in the eight `HOST_BOUND_ARTIFACTS`-named `.mts` sources (imported from
`build.ts`, per D-02 — never hand-listed) plus `installer/package.json`'s
expanded `files[]` (D-03). Every `dir`-parameter idiom below (for testing)
applies here too.

**`dir`-parameter-for-testability idiom to copy** (`shipped-modules.ts:151`,
docstring at `:148-150`):
```typescript
/** `dir` exists so this exact code path can be driven against a synthetic
 * `package.json`, which is how `shipped-modules.test.ts` plants a stale
 * entry without touching the real array. Real callers pass nothing. */
export function shippedTsModules(dir: string = HERE): string[] { /* ... */ }
```

---

### Third planted control (success criterion 5)

**Analog:** `src/mcp/vice/shipped-modules.test.ts`, `withSyntheticPackage()`
plus its consuming test (`:35-72`) — this is the established idiom in this
codebase for "prove the guard sees a real file, not just a string," and
RESEARCH.md independently recommends this same option (option 2 in its
Guard Anatomy section).
```typescript
function withSyntheticPackage<T>(files: string[], onDisk: string[], fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "shipped-modules-"));
  try {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ files }), "utf8");
    for (const name of onDisk) writeFileSync(join(dir, name), "// synthetic\n", "utf8");
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("planted violation: a files[] entry missing from disk THROWS a named error, and never returns a short list", () => {
  withSyntheticPackage(["alpha.ts", "vanished.ts"], ["alpha.ts"], (dir) => {
    assert.throws(
      () => shippedTsModules(dir),
      (err: unknown) => {
        assert.ok(err instanceof ShippedFilesEntryMissingError, /* ... */);
        assert.match((err as Error).message, /vanished\.ts/);
        return true;
      },
      "if a stale files[] entry does NOT throw here, the enumerator can silently narrow all four consuming guards at once and every one of them still passes -- the exact failure this assertion exists to catch",
    );
  });
  // Non-vacuity control: identical shape, every entry present, must NOT throw.
  const clean = withSyntheticPackage(["alpha.ts", "beta.ts"], ["alpha.ts", "beta.ts"], (dir) =>
    shippedTsModules(dir),
  );
  assert.deepEqual(clean, ["alpha.ts", "beta.ts"]);
});
```
The `finally { rmSync(dir, { recursive: true, force: true }) }` block is
load-bearing for MEMORY's "test suite races on repo-tree scratch files"
lesson (a leaked scratch dir from a similar pattern elsewhere in this repo
already caused a deterministic false failure) — copy the `mkdtempSync` +
`try/finally` shape exactly, never write into a fixed path under the repo
tree. **Adapt for the widened guard:** plant a dirty file at a synthetic
root (via the new enumerator's `dir` parameter above), run the real
`scanForPlanningVocabulary()` over it, assert the hit is reported; then a
clean-tree control asserting zero hits — mirroring `withSyntheticPackage`'s
own paired dirty/clean structure rather than only the dirty half.

**Do not** use the sibling fixture-file idiom
(`fixtures/planted-phase-pointer-fixture.ts.txt`, referenced in RESEARCH.md)
— that is a second, older idiom in this tree, and the synthetic-directory
idiom above is the better match per RESEARCH.md's own recommendation and
per this project's stated preference for testing through the same
parameterized entry point production code already exposes (`dir: string =
HERE`).

---

### D-09 byte-budget helper (`commentBytes` measurer)

**Analog:** `src/mcp/vice/comment-phase-pointers.test.ts`'s
`extractCommentSpans()` (defined at line 94, consumed at `:221` and in the
non-vacuity floor test at `:445-452`):
```typescript
let phaseLineCount = 0;
for (const src of /* every shipped file's content */) {
  spanCount += extractCommentSpans(src).length;
  phaseLineCount += commentPhaseLines(src).length;
}
assert.ok(phaseLineCount >= 80, `expected at least 80 comment lines naming a phase across the shipped set, got ${phaseLineCount}`);
```
This confirms RESEARCH.md's claim: the extractor already exists, returns
per-span objects (not a blanked string), and is already summed/counted by a
consuming test in exactly the shape D-09 needs (`.length` over spans →
substitute `.reduce((s, span) => s + span.text.length, 0)` for a byte
total). **Do not write a fourth character-state-machine extractor.** Per
`shipped-modules.ts`'s own header (`:87-101`), six comment/string extractor
sites already exist in this tree and are each documented as doing a
deliberately distinct job; a byte-total measurer is a defensible seventh,
provided it is a thin wrapper reusing `extractCommentSpans()`'s span list
rather than re-walking the source itself. If `extractCommentSpans()` needs
to become importable outside `comment-phase-pointers.test.ts`, follow the
exact `shipped-modules.ts` precedent for promoting a duplicated helper to a
single seam (that file's own header, `:1-101`, is the worked example of
"how we describe promoting a duplicated helper in this codebase" — cite it
in the new helper's own header rather than writing a fresh justification
style).

**Byte-count input already computed for free** — `match.length` per hit,
already returned by `scanForPlanningVocabulary()` (`skills-planning-vocabulary.test.ts:214-229`, `PlanningVocabularyHit.match`) — no new
scanning logic needed for the `charsInCitations` half of D-09; only
`commentBytes` needs the wrapper above.

## Shared Patterns

### "Derive, don't hand-list" (applies to ratchet ledger's family field, the
new enumerator, and D-02's `.mts` list)
**Source:** `shipped-modules.ts:120-139` (header prose) and `build.ts:42-51`
(`HOST_BOUND_ARTIFACTS`, read via export, never re-declared).
**Apply to:** the new enumerator must import `HOST_BOUND_ARTIFACTS` from
`build.ts` rather than re-listing the eight `.mts` names; the ratchet ledger
should record each file's already-established family (per D-06) as a frozen
field rather than re-deriving it at test time.

### Named thrown error over soft `assert.ok(existsSync(...))`
**Source:** `shipped-modules.ts:110-118`, `ShippedFilesEntryMissingError`.
**Apply to:** the new enumerator's existence check (any `files[]` entry —
file or expanded directory member — missing from disk) should throw this
same error class (import it) rather than defining a second one, since the
failure shape ("a `files[]` entry is stale, and the guard silently scans
less") is identical.

### `mkdtempSync` + `try/finally` for any synthetic-tree test
**Source:** `shipped-modules.test.ts:35-42` (`withSyntheticPackage`), and the
MEMORY-recorded lesson that this repo has a live defect class of tests
leaking scratch state into the repo tree.
**Apply to:** the third planted control, and any test written for the new
enumerator.

## No Analog Found

None. All five new/changed artifacts have a directly reusable or
directly-adaptable analog already in `src/mcp/vice/**`; no artifact in this
phase requires an out-of-tree pattern.

## Metadata

**Analog search scope:** `src/mcp/vice/shipped-modules.ts`,
`src/mcp/vice/shipped-modules.test.ts`, `src/mcp/vice/build.ts`,
`src/mcp/vice/test-gate.mjs`, `src/mcp/vice/skills-planning-vocabulary.test.ts`,
`src/mcp/vice/comment-phase-pointers.test.ts`.
**Files scanned:** 6 (all read directly, no re-reads of the same range).
**Pattern extraction date:** 2026-09-14
