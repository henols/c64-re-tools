---
phase: 27-shared-seams-extracted
plan: 04
subsystem: mcp-vice-test-seams
tags: [seam-extraction, structural-guards, test-only-helper, convention-record]

requires:
  - "src/mcp/vice/docs-dangling-refs.test.ts (the canonical enumerator body's original home)"
  - "src/mcp/vice/r2000-spawn-seam.test.ts (the full stripper's original home)"
  - "src/mcp/vice/acme-gate.ts (SEAM-01's output — the second unshipped-gate example the moved rationale names)"
provides:
  - "src/mcp/vice/shipped-modules.ts — the ONE files[]-derived shipped-module enumerator and the ONE full comment-and-string-literal stripper, both test-only"
  - "shippedTsModules(dir = HERE) / codeOnly(src, keepLiteralBodies = false) / ShippedFilesEntryMissingError"
  - "src/mcp/vice/shipped-modules.test.ts — the synthetic-files[] proof, the planted stale entry with its non-vacuity control, and the template-literal stripper cases"
  - "One narrowed statement of the guard-test sharing convention, recorded identically in both places it lives"
affects:
  - "src/mcp/vice/docs-dangling-refs.test.ts"
  - "src/mcp/vice/r2000-spawn-seam.test.ts"
  - "src/mcp/vice/stock-dispatch.test.ts"
  - "src/mcp/vice/comment-phase-pointers.test.ts"
  - "src/mcp/vice/prg-image.test.ts"
  - "src/mcp/vice/hop-chain-comments.test.ts"

tech-stack:
  added: []
  patterns:
    - "Single-seam test-only module: a plain `.ts` (never a `.test.ts`, never matching the runner's glob, never in files[]) imported BY test files"
    - "Injectable-directory helper: the real code path driven against a synthetic package.json in a temp dir, so the proof never pins the live files[] array"
    - "Named error instead of an injected assertion library, so no call site can opt out of an invariant by forgetting an argument"
    - "Two-direction planted violation: one known-bad case plus a non-vacuity control, so an always-throwing helper cannot fake the proof"

key-files:
  created:
    - src/mcp/vice/shipped-modules.ts
    - src/mcp/vice/shipped-modules.test.ts
  modified:
    - src/mcp/vice/docs-dangling-refs.test.ts
    - src/mcp/vice/r2000-spawn-seam.test.ts
    - src/mcp/vice/stock-dispatch.test.ts
    - src/mcp/vice/comment-phase-pointers.test.ts
    - src/mcp/vice/prg-image.test.ts
    - src/mcp/vice/hop-chain-comments.test.ts

key-decisions:
  - "OQ-1 resolved as stated: `codeOnly()` is extracted on a SURVIVAL rationale, not a divergence one, and the helper's header says so explicitly so a later reader does not hunt for a divergence that was never the motive."
  - "The comment-extractor family stays split, by decision. All six sites are named by filename and line inside the helper's WHAT NOT TO DO block, with a pointer at `r2000-tools.test.ts:193-201`, which states in code why comment-only stripping is right when the literal being searched for is itself a string."
  - "`shippedTsModules()` THROWS its own named `ShippedFilesEntryMissingError` rather than taking a caller's assertion library. Chosen so no call site can opt out of the existence check by forgetting an argument, and so all 11 call sites needed no signature change at all."
  - "The helper takes an optional `dir` parameter (defaulting to its own directory) purely so the REAL code path can be driven against a synthetic `package.json`. Real callers pass nothing; no test pins the live `files[]` array."
  - "`codeOnly()` was merged as a SUPERSET, not a choice between the two copies: the spawn-seam character state machine plus `prg-image.test.ts`'s `keepLiteralBodies` flag. The default (`false`) path is byte-identical to the moved original, so the spawn-seam guard's semantics are unchanged."
  - "`nonCommentLines()` was left in place. The single line whose prose attributed the full stripper to its old home was repointed at `shipped-modules.ts`; that line does not name `nonCommentLines`, so the function, its doc comment's reasoning and its callers are all untouched."

requirements-completed: [SEAM-02]

coverage:
  - deliverable: "shippedTsModules() exists once in the tree, in shipped-modules.ts, with all four hand copies deleted rather than shimmed"
    human_judgment: false
    verification:
      - kind: command
        ref: "grep -rcE '^function (shippedTsModules|codeOnly)' src/mcp/vice/*.test.ts | grep -vc ':0$' == 0"
        status: pass
      - kind: command
        ref: "grep -c 'from \"./shipped-modules.ts\"' over the four guard files == 1 each"
        status: pass
      - kind: command
        ref: "cd src/mcp/vice && npm run typecheck (exit 0) — the detector for a missed call site"
        status: pass
  - deliverable: "The enumerator cannot silently return a short list: a files[] entry missing from disk throws a named error"
    human_judgment: false
    verification:
      - kind: test
        ref: "src/mcp/vice/shipped-modules.test.ts#planted violation: a files[] entry missing from disk THROWS a named error, and never returns a short list"
        status: pass
      - kind: test
        ref: "src/mcp/vice/shipped-modules.test.ts#non-vacuity control inside the same test: the identical shape with every entry present returns the full list"
        status: pass
      - kind: command
        ref: "break-and-restore probe: removing the existence check turns test 2 RED (8 pass / 1 fail); restoring returns 9 pass / 0 fail"
        status: pass
  - deliverable: "codeOnly() exists once and still strips comment text AND string/template-literal bodies"
    human_judgment: false
    verification:
      - kind: test
        ref: "src/mcp/vice/shipped-modules.test.ts#codeOnly(): blanks single-quoted, double-quoted and TEMPLATE-literal bodies"
        status: pass
      - kind: test
        ref: "src/mcp/vice/shipped-modules.test.ts#codeOnly(): blanks // line comments, same-line /* */ blocks, and a block comment spanning lines"
        status: pass
      - kind: test
        ref: "src/mcp/vice/r2000-spawn-seam.test.ts (13 pass / 1 skip, unchanged) — the guard whose planted-violation tests depend on full stripping"
        status: pass
  - deliverable: "The helper is test-only: absent from files[], not collected by the runner's glob, registers no test at import"
    human_judgment: false
    verification:
      - kind: test
        ref: "src/mcp/vice/shipped-modules.test.ts#shipped-modules.ts is absent from package.json's files[] array"
        status: pass
      - kind: test
        ref: "src/mcp/vice/shipped-modules.test.ts#shipped-modules.ts is not collected as a test file and registers no test at import time"
        status: pass
      - kind: command
        ref: "node scripts/check-npm-packages.mjs — closure from vice-proxy.ts still 60 modules, clean; @henols/vice-mcp still 77 files"
        status: pass
  - deliverable: "Both recorded statements of the sharing convention state the same narrowed scope, and the instruction to keep duplicating is gone"
    human_judgment: false
    verification:
      - kind: command
        ref: "grep -c 'Kept as a second, independent copy' both files == 0; grep -c 'Keep the copy verbatim so a future reader can diff the two' == 0"
        status: pass
      - kind: command
        ref: "grep -c 'another guard test' both files >= 1; cpp cites r2000-spawn-seam.test.ts; hcc cites r2000-tools.test.ts"
        status: pass
      - kind: command
        ref: "git diff -U0 -- hop-chain-comments.test.ts | grep -cE '^[-+]\\s*(assert|const|let|function|test\\()' == 0 — comment text only"
        status: pass
  - deliverable: "Every guard behaves identically after the repoint — same pass counts, same scanned set"
    human_judgment: false
    verification:
      - kind: command
        ref: "pass counts before/after identical: docs-dangling-refs 8/8, r2000-spawn-seam 13+1skip, stock-dispatch 130/130, comment-phase-pointers 16/16, prg-image 8/8"
        status: pass
      - kind: command
        ref: "scanned-set equivalence: 62 entries, element-for-element identical to the pre-change array (JSON compare)"
        status: pass
      - kind: command
        ref: "plan gate: node --test over ten suites — 208 tests, 207 pass, 0 fail, 1 skipped, exit 0"
        status: pass
  - deliverable: "No r2000 module deleted or renamed; package.json untouched by this plan"
    human_judgment: false
    verification:
      - kind: command
        ref: "test \"$(git diff --diff-filter=D --name-only 6c1f569..HEAD -- src/mcp/vice scripts | grep -c r2000)\" = \"0\" (exit 0)"
        status: pass
      - kind: command
        ref: "git show --stat --format= <each of c7f4bdd, cf6d624, 93c0e2e> -- src/mcp/vice/package.json (empty); git diff --stat -- src/mcp/vice/package.json (empty)"
        status: pass

metrics:
  duration: "17 min"
  completed: "2026-08-27"

actuals:
  tokens: 10474
  tasks: 3
  commits: 3

status: complete
---

# Phase 27 Plan 04: shippedTsModules and codeOnly Extracted to shipped-modules.ts Summary

Four byte-identical hand copies of the `package.json`-`files[]`-derived module
enumerator and two divergent copies of the full comment-and-string-literal
stripper now live as one test-only module, `src/mcp/vice/shipped-modules.ts`,
whose enumerator throws a named error rather than ever returning the short list
that would silently narrow four structural guards at once — and both places the
codebase had written down "keep duplicating this" now state the same narrowed
convention instead of contradicting each other.

- **Start:** 2026-08-27T06:50:00Z
- **End:** 2026-08-27T07:07:00Z
- **Duration:** 17 min
- **Tasks:** 3 of 3
- **Files:** 2 created, 6 modified
- **Commits:** 3 (`c7f4bdd`, `cf6d624`, `93c0e2e`)

## Accomplishments

1. **`src/mcp/vice/shipped-modules.ts` (244 lines) is the single home of both
   helpers.** `shippedTsModules(dir = HERE)` carries the canonical body from
   `docs-dangling-refs.test.ts` with its extension filter and its failure
   wording byte-identical, but throws `ShippedFilesEntryMissingError` instead of
   borrowing a caller's `assert`. `codeOnly(src, keepLiteralBodies = false)`
   carries the character state machine verbatim on its default path. The
   three-part header records the enumerator's *divergence* rationale and the
   stripper's *survival* rationale as explicitly different reasons, states the
   TEST-ONLY and non-`*.test.*`-name rules with the import-side-effect
   mechanism, and names all six deliberately-excluded comment extractors.
2. **`src/mcp/vice/shipped-modules.test.ts` (162 lines, 9 tests)** drives the
   enumerator against synthetic `package.json` files in temp directories — never
   the live array — and pairs its planted stale entry with a non-vacuity control
   inside the same test, so a helper that simply always threw could not pass.
3. **Six local definitions deleted with no shim and no wrapper**: four
   enumerators (`docs-dangling-refs`, `r2000-spawn-seam`, `stock-dispatch`,
   `comment-phase-pointers`) and two strippers (`r2000-spawn-seam`, and
   `prg-image` — see Deviation 1). Every executable call site resolved: 2, 3, 2
   and 4 respectively, identical before and after.
4. **The convention is recorded once, in both places.** `comment-phase-pointers`
   and `hop-chain-comments` now carry the same narrowed statement — a guard test
   must not import *another guard test*, because the runner re-runs that file's
   top-level tests as an import side effect; importing a neutral non-test helper
   is a different thing and is permitted, with the in-tree precedent cited by
   file and line rather than asserted. The sentence instructing a reader to keep
   the copy verbatim is gone, and the one duplication `hop-chain-comments`
   deliberately keeps (its comment extractor) is named with its in-code reason.
5. **Nothing shipped and nothing was deleted from the `r2000` family.** The
   tarball is unchanged at 77 files, the closure walk from `vice-proxy.ts` still
   reports 60 modules clean, and `package.json` is untouched by all three
   commits.

## OQ-1 decision: extract the stripper, on a survival rationale

Resolved exactly as the plan directed, and the rationale is now written into the
helper rather than only into planning documents. `codeOnly()` had **no**
divergence hazard worth the name — it had one full-strength consuming file — so
the argument that motivated its sibling does not apply to it. It is extracted
because its only home was an `r2000-*.test.ts` file a later prefix deletion
removes, and it is the only implementation in the tree that correctly blanks
template-literal bodies, logic that was measured into existence after a regex
extractor was observed to miss a real violation inside one. The header states
this plainly so a later reader does not go looking for a second copy that never
existed.

**The deliberate limit is recorded in code, not by omission.** The helper's
`WHAT NOT TO DO` block names all six comment-extractor sites
(`disasm-decoder.test.ts:308`, `disasm-renderer.test.ts:346`,
`disasm-opcodes.test.ts:394`, `r2000-tools.test.ts:201`, `stock-dispatch`'s
`nonCommentLines()`, and `hop-chain-comments`'s comment-span extractor), says
each does a different job, and points at `r2000-tools.test.ts:193-201` for the
in-code statement of why blanking string bodies would make the literals five of
them search for unobservable.

## Existence-assertion break-and-restore (both states observed)

```
$ python3 ... # replace the throw block with: void entry; // BROKEN ON PURPOSE
$ node --test shipped-modules.test.ts
ok 1 - shippedTsModules(): returns every files[] entry ending .ts or .mts, and nothing else
not ok 2 - planted violation: a files[] entry missing from disk THROWS a named error, and never returns a short list
ok 3 - shippedTsModules(): a files[] with no .ts/.mts entries returns an empty array without throwing
ok 4..9 (all pass)
# pass 8
# fail 1
```

Restored from a pristine copy taken before the edit; `diff` against that copy is
empty, and the suite returns to **9 pass / 0 fail**. The probe fires on exactly
the planted-violation test and on nothing else, so the existence check is
demonstrably load-bearing rather than decorative.

## Guard pass counts, before and after the repoint

Baselines were captured by running each suite **before** any edit (no `git
stash` — that command is prohibited for executors in this repo; where a
pre-change file was needed it was read with `git show <rev>:<path>`).

| Guard suite | Before | After |
|---|---|---|
| `docs-dangling-refs.test.ts` | 8 tests, 8 pass, 0 fail | 8 tests, 8 pass, 0 fail |
| `r2000-spawn-seam.test.ts` | 14 tests, 13 pass, 0 fail, 1 skipped | 14 tests, 13 pass, 0 fail, 1 skipped |
| `stock-dispatch.test.ts` | 130 tests, 130 pass, 0 fail | 130 tests, 130 pass, 0 fail |
| `comment-phase-pointers.test.ts` | 16 tests, 16 pass, 0 fail | 16 tests, 16 pass, 0 fail |
| `prg-image.test.ts` | 8 tests, 8 pass, 0 fail | 8 tests, 8 pass, 0 fail |

The one pre-existing skip in `r2000-spawn-seam.test.ts` is its regenerator2000
availability gate (`R2000_BIN` unset on this host), unchanged by this plan.

## Scanned-set equivalence check (recorded)

The enumerator's returned array was serialised before any edit and compared
against the shared helper's return after all three commits:

```
length after : 62
length before: 62
element-for-element identical: true
```

**62** `.ts`/`.mts` entries — which already includes `block-class.ts` (27-02) and
`prg-image.ts` (27-03), the two sibling `files[]` additions
`<sibling_package_json_coupling>` predicted. Neither perturbed this plan, because
every test here drives synthetic inputs.

## Commands run, with results

| Command | Result |
|---|---|
| `cd src/mcp/vice && npm run typecheck` | exit 0, run after each of the three tasks and again at the plan gate |
| `node --test shipped-modules.test.ts` | 9 tests, **9 pass, 0 fail** |
| `node --test shipped-modules.test.ts test-gate.test.ts` | 12 tests, 12 pass, 0 fail — the new `*.test.ts` is auto-discovered, no `MANUAL_ONLY_TESTS` edit |
| `node --test <the five repointed suites>` (individually) | pass counts identical to baseline, table above |
| `node --test comment-phase-pointers hop-chain-comments r2000-spawn-seam docs-dangling-refs stock-dispatch shipped-modules` | 184 tests, 183 pass, **0 fail**, 1 skipped |
| **Plan gate:** `node --test shipped-modules docs-dangling-refs r2000-spawn-seam stock-dispatch comment-phase-pointers hop-chain-comments test-gate assumption-label-discipline hostpath-consumers docs-linerefs` | **208 tests, 207 pass, 0 fail, 1 skipped, exit 0** |
| `node scripts/check-npm-packages.mjs` | `transitive closure from vice-proxy.ts -- 60 modules, clean`; `@henols/vice-mcp -- 77 files` (unchanged) |
| `git show --stat --format= <each commit> -- src/mcp/vice/package.json` | empty for all three; `git diff --stat` on the same path also empty |
| `test "$(git diff --diff-filter=D --name-only 6c1f569..HEAD -- src/mcp/vice scripts \| grep -c r2000)" = "0"` | exit 0 — zero deletions in that range |

`npm run test:automated` was **not** used as evidence anywhere, per the plan's
explicit prohibition; the whole-glob `npm test` belongs to `27-05-PLAN.md`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A SECOND `codeOnly()` copy existed by the time this plan ran, and the plan's own criteria forbade leaving it**

- **Found during:** Task 1 (survey), acted on in Task 2.
- **Issue:** RESEARCH.md's Correction C-3 measured "exactly ONE `codeOnly()`, at
  `r2000-spawn-seam.test.ts:65`" — true when this plan was written. Plan 27-03
  then landed a second copy at `prg-image.test.ts:100` (its own Deviation 2),
  and that copy is **behaviourally different**: it keeps the quote characters,
  does not preserve `${ ... }` interpolation as code, and adds a
  `keepLiteralBodies` parameter its import-specifier assertion needs. So the
  divergence hazard the plan says the stripper does not have had, in fact,
  materialised in the four days between planning and execution. Task 2's own
  acceptance criterion (`grep -rcE '^function (shippedTsModules|codeOnly)'
  src/mcp/vice/*.test.ts` must report no surviving local definition **anywhere
  in the tree**) is unsatisfiable while that copy stands, and the plan's
  `must_haves` truth says `codeOnly()` exists once.
- **Fix:** Extracted the **superset**, not a winner: the spawn-seam character
  state machine (which correctly handles template interpolation) plus the
  `keepLiteralBodies` flag threaded through every literal branch. The default
  `false` path is byte-identical in behaviour to the moved original, so the
  spawn-seam guard's semantics are provably unchanged; `keepLiteralBodies = true`
  emits literals verbatim including their quotes, which is what the
  import-specifier caller reads. `prg-image.test.ts` — not in this plan's
  `files_modified` — was repointed too and its doc comment reduced to a pointer
  explaining why its two callers differ.
- **Files modified:** `src/mcp/vice/shipped-modules.ts`,
  `src/mcp/vice/prg-image.test.ts` (added to the plan's file set)
- **Verification:** `prg-image.test.ts` 8 pass / 0 fail (identical to its
  baseline, including the import-specifier test that reads
  `["node:zlib"]`); `r2000-spawn-seam.test.ts` 13 pass / 1 skip, unchanged;
  `shipped-modules.test.ts` covers both flag values directly.
- **Commits:** `c7f4bdd` (the superset helper), `cf6d624` (both repoints)

### Measured Corrections to the Plan

**2. Task 2's four `grep -c 'shippedTsModules('` counts (3 / 7 / 4 / 7) are
unsatisfiable by construction after the deletion the same task mandates.**

Those numbers were measured **before** the copies were deleted, and each
included the definition line — `function shippedTsModules(): string[] {`
contains the token `shippedTsModules(`. Deleting the definition therefore drops
each file's count by exactly one, so the criterion as literally written can only
pass if the definition survives, which is the opposite of the task's own
`<done>`. Verified rather than assumed, against `c7f4bdd`:

| File | Mentions before (incl. definition) | Definition lines | Mentions after | Executable call sites before → after |
|---|---|---|---|---|
| `docs-dangling-refs.test.ts` | 3 | 1 | 3 | **2 → 2** |
| `r2000-spawn-seam.test.ts` | 7 | 1 | 6 | **3 → 3** |
| `stock-dispatch.test.ts` | 4 | 1 | 3 | **2 → 2** |
| `comment-phase-pointers.test.ts` | 7 | 1 | 6 | **4 → 4** |

The criterion's *intent* — "every measured call site resolved, none dropped and
none added" — is met exactly, and is what the table's last column proves
(comment lines, doc-comment prose and test titles excluded programmatically).
The literal counts were deliberately **not** engineered back to 3/7/4/7 by
adding prose mentions: padding a comment to satisfy a grep would make the
criterion measure nothing. `docs-dangling-refs.test.ts` reads 3 both times only
because its replacement pointer comment happens to name the function.

**3. One line of `nonCommentLines()`'s doc comment was repointed, and it is not
a violation of "leave it completely alone".**

That doc comment attributed the fuller stripper to `r2000-spawn-seam.test.ts`,
which stopped being true in `cf6d624`. The single edited line now names
`shipped-modules.ts`. It does not contain the token `nonCommentLines`, so Task
2's `git diff -U0 | grep -c 'nonCommentLines'` criterion still reports **0**, and
the function body, its callers and its stated reasoning for being line-oriented
are all byte-identical. Leaving the line would have created exactly the stale
cross-reference this phase exists to remove.

**Total deviations:** 1 auto-fixed (Rule 1 bug), plus 2 measured corrections to
the plan's expectations. **Impact:** no deliverable, refusal message or guard
behaviour changed. The Rule 1 fix strengthens the plan's own `must_haves` truth
(`codeOnly()` now genuinely exists once) at the cost of one extra file in the
plan's set; both corrections are arithmetic/prose scope clarifications with no
effect on what shipped.

## Issues Encountered

None. No pre-existing failure listed in `deferred-items.md` was touched: the 39
`vice-proxy.test.ts` failures (needs a live host; on `test-gate.mjs`'s frozen
`MANUAL_ONLY_TESTS` list) and the 5 `r2000-session.test.ts` failures
(`regenerator2000` absent, `R2000_BIN` unset) are both outside this plan's file
set and outside its gate.

Note for `27-05`: `D-27-02-A` records the five ungated `r2000-session.test.ts`
queue tests as "it touches the r2000 session/spawn family that plan 27-04 owns".
This plan owns `r2000-spawn-seam.test.ts` only — a guard *about* spawn sites, not
the session module — and `r2000-session.test.ts` is not in its `files_modified`
and was not modified. That item remains open and unclaimed.

## Known Stubs

None. Every helper moved is fully implemented, every test asserts a real
property, and every `<verify>` block in the plan was run.

## Next Steps

Ready for `27-05` (the classification record, its enforcing test, and the
phase-level whole-glob evidence run). `shipped-modules.ts` is available to it as
the single import for both helpers, and the six SEAM-02 probe rows it authors now
have a concrete referent.

## Self-Check: PASSED

- `src/mcp/vice/shipped-modules.ts` — FOUND (244 lines)
- `src/mcp/vice/shipped-modules.test.ts` — FOUND (162 lines)
- commit `c7f4bdd` — FOUND
- commit `cf6d624` — FOUND
- commit `93c0e2e` — FOUND
- plan `<verification>` gate re-run at `93c0e2e`: typecheck exit 0; ten-suite run
  208 tests / 207 pass / 0 fail / 1 skipped, exit 0; `package.json` empty in all
  three commits and uncommitted; zero `r2000` deletions since `6c1f569`.
