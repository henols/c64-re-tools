---
phase: 30-acme-export-and-the-real-acme-oracle
plan: 05
subsystem: api
tags: [cli, acme, export, path-confinement, annotation-store, packaging, guards]

requires:
  - phase: 30-acme-export-and-the-real-acme-oracle
    provides: "plan 30-01's exportAsm()/ExportAsmResult surface and its files[] entry; plan 30-03's per-block brackets and typed data emitter; plan 30-04's mid-instruction labels, enum substitution and the auto-name marker, all of which the verb's summary line counts"
  - phase: 29-the-mcp-surface
    provides: "the corrected cmdRenderMemmap() confinement chain (CR-02/CR-03), refuseOverwrite(), VERB_OPTIONS + checkAcceptedOptions(), and anno-cli-path-consumers.test.ts's both-directions inventory"
  - phase: 28-the-annotation-store
    provides: "storePathWithinWorkspace() -- the ONE confinement seam -- and openStore()'s mustExist refusal"
provides:
  - "`anno export-asm <image> --store FILE [--out FILE] [--force]` -- the third CLI verb, ACME source from an annotation store"
  - "cmdExportAsm()/parseExportAsmArgs()/defaultExportAsmOut() in anno-cli.ts"
  - "ANNO_CLI_VERB_FLOOR raised 2 -> 3 with its false 'returns in Phase 30' forecast replaced by what happened"
  - "CLI_PATH_ARGUMENT_FLOOR raised 6 -> 9 with three new inventory rows"
  - "export-asm entries in POSITIONAL_KINDS, REQUIRED_FLAGS and FLAG_KINDS, so the invocation gate sees the verb"
  - "a mechanical assertion that acme-verify.ts is ABSENT from files[] while anno-export-asm.ts is PRESENT"
affects: [30-06]

actuals:
  tokens: 15511
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "a derived default output path is computed FIRST and confined AFTER, so a path the verb itself produced is confined by the same rule as one a caller supplied"
    - "a CLI verb that produces an unverified artefact prints an explicit not-assembled line as its second output line, and its --help block is asserted to contain no verification-shaped wording"
    - "when a deleted verb returns, every control that used it as the canonical unknown verb is re-pointed onto a verb that did NOT return, in the same commit"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-cli.ts
    - src/mcp/vice/anno-cli.test.ts
    - src/mcp/vice/anno-cli-path-consumers.test.ts
    - src/mcp/vice/anno-verb-coverage.test.ts
    - src/mcp/vice/anno-cli-invocations.test.ts
    - src/mcp/vice/acme-verify.test.ts
    - src/mcp/vice/module-classification.ts
    - scripts/lib/anno-cli-verbs.mjs
    - scripts/lib/anno-cli-invocations.mjs

key-decisions:
  - "The plan's must-have `anno-export-asm.ts is listed in files[] in the same commit that makes it reachable` was satisfied UPSTREAM by plan 30-01, not by this plan. The module could not have existed unlisted: anno-seam.test.ts derives its expectation from disk and requires every anno-* production module on disk to be in files[] the moment it exists. Verified rather than re-done -- package.json is untouched by this plan."
  - "`export-asm --out` accepts `.a` AND `.asm` in FLAG_KINDS. `.a` is the exporter's own derived default, but acme-build/SKILL.md's own description names `.a/.asm` as the sources it assembles, so a documented `--out foo.asm` is a live command and blessing only `.a` would red a correct playbook."
  - "The unknown-verb controls in anno-cli-invocations.test.ts were re-pointed onto `bootstrap`, not onto an invented token. `bootstrap` was deleted in the same D-14 commit as export-asm and did NOT come back (it created the retired analyser's own project file), so the control keeps its original SHAPE -- a plausible verb a reader might type."
  - "The default --out lives in the STORE's directory rather than the image's, mirroring render-memmap's memory-map.md default: the export is a generated view of the ANNOTATIONS, and the image is an input this verb only reads."
  - "anno-cli.ts does not import acme-verify.ts and says so in a comment at the import site. A shipped module importing the test-only verifier would drag it into check-npm-packages.mjs's published closure, which is exactly what D30-01/USER-D-02 keep out."
  - "scripts/lib/anno-cli-verbs.mjs:16 was inspected as the plan directed and NOT edited: it carries FLOW-01 history (the three verbs reached main documented in zero skill files), not a forecast. The only forecast in that file was in the floor's own doc paragraph, and that is what moved."

patterns-established:
  - "A returning verb moves five things in lockstep or a guard reds by name: VERB_OPTIONS, the two-space-indented --help synopsis, the path-argument inventory + its hand-pinned floor, the verb floor on BOTH sides of an exact equality, and all three per-verb tables of the invocation gate."
  - "A test that builds a per-verb sample invocation derives its positional from POSITIONAL_KINDS rather than a `verb === 'coverage'` ternary, so a verb added later cannot red the test for a reason unrelated to the property under test."

requirements-completed: [EXPORT-01]

coverage:
  - id: D1
    description: "`anno export-asm <image> --store FILE` writes ACME source from an existing store and image to the derived default path beside the store, exits 0, and prints a summary line naming the confined path"
    requirement: "EXPORT-01"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-cli.test.ts#export-asm: writes ACME source to the derived default path beside the STORE and exits 0"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-cli.test.ts#export-asm: --out overrides the destination, and both runs produce byte-identical source"
        status: pass
    human_judgment: false
  - id: D2
    description: "All three of the verb's paths (<image>, --store and the derived-or-supplied --out) are confined through storePathWithinWorkspace() before any filesystem probe, and a path outside the workspace root is refused with one line and exit 1 without creating, replacing or reading anything there"
    requirement: "EXPORT-01"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-cli.test.ts#export-asm: a --store outside the workspace root is refused by the ONE seam, and nothing is created there"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-cli.test.ts#export-asm: an --out outside the workspace root is refused even when both INPUTS are legal"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-cli-path-consumers.test.ts#anno-cli.ts contains at least one storePathWithinWorkspace() call site per declared path argument"
        status: pass
      - kind: other
        ref: "grep -v '^\\s*//' src/mcp/vice/anno-cli.ts | grep -v '^\\s*\\*' | grep -c 'storePathWithinWorkspace(' == 9"
        status: pass
    human_judgment: false
  - id: D3
    description: "The verb refuses to overwrite an existing --out unless --force is passed, checked against the CONFINED path, and the refused file is left byte-identical"
    requirement: "EXPORT-01"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-cli.test.ts#export-asm: an existing destination is refused without --force, and the file is left untouched"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every caller-error shape is refused by its own named message: a missing --store, a --store with no value or a flag-shaped value, an unknown --flag (before the verb runs), a missing store, a missing image, and more than one positional"
    requirement: "EXPORT-01"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-cli.test.ts#export-asm: a missing --store, and a --store with no value, are each refused by their OWN message"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-cli.test.ts#export-asm: an unknown option is refused by checkAcceptedOptions() BEFORE the verb runs"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-cli.test.ts#export-asm: a missing annotation store is refused rather than CREATED"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-cli.test.ts#export-asm: a nonexistent image is refused by name"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-cli.test.ts#export-asm: more than one positional is refused rather than silently ignored"
        status: pass
    human_judgment: false
  - id: D5
    description: "Nothing the verb prints reads as a verification result: the second printed line states the file was not assembled, and the --help block contains no verification-shaped wording"
    requirement: "EXPORT-01"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-cli.test.ts#export-asm: --help lists the verb and states, in as many words, that it does NOT assemble"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-cli.test.ts#export-asm: writes ACME source to the derived default path beside the STORE and exits 0 (asserts both printed lines)"
        status: pass
      - kind: other
        ref: "grep -v '^\\s*//' src/mcp/vice/anno-cli.ts | grep -v '^\\s*\\*' | grep -c 'acme-verify' == 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "The CLI no longer describes itself as having exactly two verbs: the header block, the --help synopsis and the unknown-verb message all name three, and every floor pinned to the two-verb surface moved in the same commit"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-verb-coverage.test.ts#non-vacuity floor: ANNO_CLI_VERB_FLOOR matches the measured true count and the real parse meets it"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-cli.test.ts#VERB_OPTIONS carries exactly the surviving verbs"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-cli.test.ts#the verb-options map agrees with USAGE's own per-verb option lists, for every verb (IN-06)"
        status: pass
      - kind: other
        ref: "grep -c 'this CLI has exactly two' src/mcp/vice/anno-cli.ts == 0"
        status: pass
      - kind: other
        ref: "node scripts/check-skill-tool-coverage.mjs (anno CLI verbs: 3 parsed, 3/3 resolved)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The exporter ships and the verify module provably does not: the closure walk from vice-proxy.ts reaches anno-export-asm.ts through anno-cli.ts and finds it listed, while a test asserts acme-verify.ts is absent from files[]"
    verification:
      - kind: unit
        ref: "src/mcp/vice/acme-verify.test.ts#acme-verify.ts is absent from package.json's files[] array (test-only, mechanically enforced)"
        status: pass
      - kind: other
        ref: "node scripts/check-npm-packages.mjs (transitive closure from vice-proxy.ts -- 57 modules, clean)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/comment-phase-pointers.test.ts + docs-dangling-refs.test.ts (green with anno-export-asm.ts in their scanned set)"
        status: pass
    human_judgment: false
  - id: D8
    description: "A new path argument cannot bypass the inventory, and the invocation gate sees the new verb: three CLI_PATH_ARGUMENTS rows, the floor raised to 9 as a hand-pinned literal, and export-asm entries in all three per-verb declaration tables"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-cli-path-consumers.test.ts#every VERB_OPTIONS entry that is not an explicitly-declared non-path option is named in CLI_PATH_ARGUMENTS"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-cli-path-consumers.test.ts#every positional a verb's USAGE synopsis declares is named in CLI_PATH_ARGUMENTS"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-cli-invocations.test.ts#non-vacuity, the other direction: every VERB_OPTIONS verb has a REQUIRED_FLAGS entry, even an empty one"
        status: pass
      - kind: other
        ref: "node scripts/check-skill-cli-invocations.mjs"
        status: pass
    human_judgment: false

duration: 46 min
completed: 2026-08-30
status: complete
---

# Phase 30 Plan 05: `anno export-asm` lands as the third CLI verb Summary

**A confined, non-overwriting `anno export-asm <image> --store FILE [--out FILE] [--force]` that emits ACME source from an annotation store and states in its own second output line that it assembled nothing — with all nine of the CLI's path arguments now inventoried, the verb floor raised on both sides of its exact equality, the invocation gate's three per-verb tables extended, and the false "returns in Phase 30" forecast in the floor's own doc replaced by what actually happened.**

## Performance

- **Duration:** 46 min
- **Started:** 2026-08-30T22:34Z
- **Completed:** 2026-08-30T23:20Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- `anno export-asm` exists, works end to end, and confines all three of its paths through the one seam **before** any `existsSync` probe — with the `--out` default applied first and the *result* confined, so a path the verb computed is confined by the same rule as one a caller supplied (CR-02 / T-30-02).
- The CLI stopped misdescribing itself. The header's `TWO VERBS` block was rewritten rather than deleted, the `--help` synopsis gained a two-space-indented `export-asm` line, and the unknown-verb message names three verbs.
- Every floor pinned to the two-verb surface moved: `ANNO_CLI_VERB_FLOOR` 2→3 (with `assert.equal(..., 3)` moving in the same commit), `CLI_PATH_ARGUMENT_FLOOR` 6→9 as a hand-pinned literal, and three new `CLI_PATH_ARGUMENTS` rows.
- The invocation gate can see the verb: `POSITIONAL_KINDS`, `REQUIRED_FLAGS` and `FLAG_KINDS` all gained an `export-asm` entry — each grounded in a quoted refusal branch or a named loader, never guessed.
- `acme-verify.ts`'s absence from `files[]` is now a committed assertion with a paired positive direction, so the exporter joining the published closure cannot quietly pull the verifier in behind it.

## Exact printed lines (recorded as `<output>` requires)

Observed from a real run against a store and a `.prg` inside the repo:

```
export-asm: wrote /…/game.a (1 block(s), 1 symbol(s), 0 auto-named, 0 unexpressible instruction(s), 0 mid-instruction label(s), 0 enum substitution(s))
export-asm: this file has NOT been assembled -- this command writes source text and runs no assembler.
```

Checked by eye against the prohibition: neither line contains *verified*, *verification*, *passed*, *assembled successfully*, or any word that reads as an assembler verdict. The only occurrence of "assembled" is in the negation. `anno-cli.test.ts` additionally asserts the `--help` `export-asm` block matches neither `/\bverified\b/i` nor `/\bverification passed\b/i`.

## The observed non-vacuity red (verb floor)

Required by Task 2's acceptance criteria, observed once and then fixed. With `REAL_VERBS` already carrying `export-asm` and the exact-equality assertion raised to 3 while `ANNO_CLI_VERB_FLOOR` was still `2`:

```
not ok 5 - non-vacuity floor: ANNO_CLI_VERB_FLOOR matches the measured true count and the real parse meets it
  error: |-
    Expected values to be strictly equal:

    2 !== 3

  expected: 3
  actual: 2
```

This is the point of the exact equality rather than a `>=`: with **both** sides left at 2 the test passed even though the CLI really had three verbs, because `verbs.length >= 2` holds for three verbs. Only the equality catches a one-sided raise, and only a raise on both sides clears it.

## The hand-pinned floor line, pasted as required

```ts
const CLI_PATH_ARGUMENT_FLOOR = 9;
```

A bare integer literal. Not `CLI_PATH_ARGUMENTS.length`, not a `readdir`, not an expression over the inventory it guards — the file's own rule at its header forbids exactly that, because a floor derived from its subject can never fail.

## The rewritten floor paragraph, pasted as required

From `scripts/lib/anno-cli-verbs.mjs`, replacing the sentence that forecast three verbs returning in a numbered phase:

> THE RAISE-NEVER-LOWER DISCIPLINE RAN FORWARD FROM 2 AND HAS ALREADY MOVED ONCE, unchanged in force. On 2026-08-31 `export-asm` RETURNED — rebuilt over the annotation store behind a real-ACME byte-diff oracle, not restored code — and that is what raises this floor from 2 to 3, in the same commit that added the verb.
>
> WHAT DID NOT COME BACK WITH IT, stated so nobody reads the raise as broader than it is: `gen-enums`, `export-lbl` and `import-lbl` did NOT return. No requirement and no success criterion of the work that rebuilt `export-asm` covers any of them, and NO PHASE CURRENTLY OWNS THEM. An earlier version of this paragraph forecast that all three would come back alongside the ACME export oracle; that forecast was wrong and is replaced here by what happened, rather than deleted. The symbol round trip therefore still has no route at all, which is recorded as a withdrawal in `.planning/PROJECT.md`'s shipped-capability list.

The paragraph's original argument (a replacement over a new verb set, not a lowering) and its per-verb-raise obligation are intact; only the false forecast moved. `grep -c 'Phase 30'` over the comment-stripped file returns `0`, and the unfiltered file contains no `Phase N` reference at all.

## Comments reworded to satisfy `comment-phase-pointers.test.ts`

**None.** Both guards that newly scan `anno-export-asm.ts` — `comment-phase-pointers.test.ts` and `docs-dangling-refs.test.ts` — were green on the first run with the exporter inside `shippedTsModules()`, with no comment from plans 30-01/30-03/30-04 needing a rewrite. Nothing was loosened to achieve that.

The new prose written in this plan was written to stay clear of the seven assignment-shape families deliberately: `anno-cli.ts`'s header names plan `30-06` for the tree-wide re-pointing sweep without using the `Phase N` spelling those families match, and no shipped string literal names a phase number (FLOW-02).

## Task Commits

1. **Task 1: the `export-asm` verb, all five coordinated parts of anno-cli.ts** — `d77b309` (feat)
2. **Task 2: raise every floor the third verb moves** — `9cf47d7` (test)
3. **Task 3: ship the exporter — files[] absence mirror and the end-to-end CLI tests** — `51e3ec0` (test)

## Files Created/Modified

- `src/mcp/vice/anno-cli.ts` — `VERB_OPTIONS` entry, `--help` synopsis block, `parseExportAsmArgs()`, `defaultExportAsmOut()`, `cmdExportAsm()`, dispatch case, rewritten header, three-verb unknown-verb message
- `src/mcp/vice/anno-cli.test.ts` — `REMOVED_VERBS` narrowed 6→5, `SURVIVING_VERBS` grown 2→3, IN-06 verb count 2→3, and eleven new `export-asm` end-to-end tests
- `src/mcp/vice/anno-cli-path-consumers.test.ts` — three inventory rows, floor 6→9
- `src/mcp/vice/anno-verb-coverage.test.ts` — `REAL_VERBS` gains `export-asm`, exact equality 2→3
- `src/mcp/vice/anno-cli-invocations.test.ts` — four unknown-verb controls re-pointed onto `bootstrap`; the sample-invocation positional now derived from `POSITIONAL_KINDS`
- `src/mcp/vice/acme-verify.test.ts` — the `files[]` absence assertion plus its paired positive direction
- `src/mcp/vice/module-classification.ts` — three `anno-cli.ts` line citations re-pointed (`:111`→`:132`, `:106`→`:119`, `:238`→`:292`)
- `scripts/lib/anno-cli-verbs.mjs` — `ANNO_CLI_VERB_FLOOR` 2→3, doc paragraph corrected
- `scripts/lib/anno-cli-invocations.mjs` — `export-asm` in `POSITIONAL_KINDS`, `REQUIRED_FLAGS` and `FLAG_KINDS`, each with its grounding recorded

`src/mcp/vice/package.json` is **untouched** — see the first key decision.

## Decisions Made

See `key-decisions` in the frontmatter. The two that most change what a later reader should expect:

1. **`package.json` needed no edit.** The plan listed it under `files_modified` and made `anno-export-asm.ts ∈ files[]` a must-have; that was already true from plan 30-01, and necessarily so — `anno-seam.test.ts` requires every `anno-*` production module on disk to be listed the moment it exists, so the module could not have been created unlisted. The must-have is satisfied, upstream. `acme-verify.ts` is correctly absent, and is now absent *provably* rather than merely in fact.

2. **`export-asm` stopped being a safe stand-in for "a verb the CLI does not have."** Four controls in `anno-cli-invocations.test.ts` used it as the canonical unknown verb, which was correct while it was deleted and became a false assertion the moment it returned. They are re-pointed onto `bootstrap` through a single `GONE_VERB` constant, so the next return moves one line.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The invocation gate's three per-verb tables had no `export-asm` entry**

- **Found during:** Task 2 (after adding `export-asm` to `VERB_OPTIONS`)
- **Issue:** The plan's task list did not name `scripts/lib/anno-cli-invocations.mjs` or `src/mcp/vice/anno-cli-invocations.test.ts`. But `anno-cli-invocations.test.ts` asserts that **every key of the CLI's own `VERB_OPTIONS`** has an entry in `REQUIRED_FLAGS` and in `FLAG_KINDS` — deliberately, so "a verb added later cannot join the gate with its required flags merely undeclared." Adding the verb therefore red six tests in that file, and `checkInvocation()` would have reported `export-asm: takes no positional argument` for any documented invocation.
- **Fix:** `export-asm` added to all three tables — `POSITIONAL_KINDS` (`.prg`/`.raw`/`.bin`, read off `loadImage()`'s own dispatch in `anno-export-asm.ts`), `REQUIRED_FLAGS` (`--store`, quoted from the CLI's own refusal branch), `FLAG_KINDS` (`--store` → `.annostore`/`.store`; `--out` → `.a`/`.asm`). Each entry's grounding is recorded in the file's existing comment style.
- **Files modified:** `scripts/lib/anno-cli-invocations.mjs`
- **Verification:** `node --test anno-cli-invocations.test.ts` 41/41; `node scripts/check-skill-cli-invocations.mjs` exit 0
- **Committed in:** `9cf47d7`

**2. [Rule 1 - Bug] Four unknown-verb controls asserted something false about a verb the CLI now dispatches**

- **Found during:** Task 2
- **Issue:** `anno-cli-invocations.test.ts` used `export-asm` in four places as the canonical unknown verb (`planted violation 3`, the short-circuit test, `PROBLEM_ORDER` non-vacuity, and the WR-19 discrimination control). Once the verb existed, those tests stopped testing the unknown-verb path.
- **Fix:** A single `GONE_VERB = "bootstrap"` constant, with a comment recording why `bootstrap` is the right replacement (deleted in the same commit, did not come back, same *shape* of control). All four sites use it.
- **Files modified:** `src/mcp/vice/anno-cli-invocations.test.ts`
- **Verification:** the four tests pass and still assert `/no such verb/i`
- **Committed in:** `9cf47d7`

**3. [Rule 1 - Bug] A per-verb sample invocation was built from a `verb === "coverage"` ternary**

- **Found during:** Task 2
- **Issue:** `the checker reads the CLI's OWN option set…` built its positional as `verb === "coverage" ? "game.prg" : "game.annostore"`, so `export-asm` — an image-positional verb — was handed an annotation store and the test failed for a **correct** reason that had nothing to do with the property under test.
- **Fix:** the positional is now derived from the verb's own `POSITIONAL_KINDS` entry, with a precondition assertion that the entry is non-empty. A verb added later cannot red this test for the wrong cause.
- **Files modified:** `src/mcp/vice/anno-cli-invocations.test.ts`
- **Committed in:** `9cf47d7`

**4. [Rule 3 - Blocking] Three `anno-cli.ts` line citations drifted when the verb shifted the file**

- **Found during:** Task 2 (`npm run test:automated`)
- **Issue:** `module-classification.test.ts`'s DIRECTION 9 and 9b verify every `path:NN` citation by *containment* — the cited line must contain the cited symbol. Adding ~330 lines to `anno-cli.ts` moved `buildCoverageReport` (`:111`), `renderMemoryMap` (`:106`) and `checkAcceptedOptions` (`:238`).
- **Fix:** re-pointed to `:132`, `:119` and `:292` respectively, verified by re-running the guard rather than by arithmetic.
- **Files modified:** `src/mcp/vice/module-classification.ts`
- **Verification:** `node --test module-classification.test.ts` 20/20
- **Committed in:** `9cf47d7`

**5. [Rule 3 - Blocking] Task 1's declared `<files>` could not satisfy Task 1's declared `<verify>`**

- **Found during:** Task 1
- **Issue:** Task 1 listed only `src/mcp/vice/anno-cli.ts` but its `<verify>` demanded `npm run test:automated` with 0 failures. `anno-cli.test.ts` hard-codes `REMOVED_VERBS` (containing `export-asm`), `SURVIVING_VERBS` and `assert.equal(verbs.length, 2)`, so the verb cannot exist for one commit without those three reds — and the remaining floors are Task 2's own subject by the plan's design.
- **Fix:** Task 1's commit also carries the `anno-cli.test.ts` verb-list edits (the minimum that makes the verb's own test file true), and Task 1's suite-wide 0-failure gate was satisfied at the end of Task 2, where the plan puts the floors. No gate was skipped; one was deferred by one commit, exactly as far as the plan's own task split requires.
- **Files modified:** `src/mcp/vice/anno-cli.test.ts`
- **Committed in:** `d77b309`

---

**Total deviations:** 5 auto-fixed (2 bugs, 3 blocking)
**Impact on plan:** All five are consequences of the same fact the plan is built around — a returning verb moves more guards than one file's worth. Nothing was widened, lowered or exempted to make a guard pass: `NON_PATH_OPTIONS` is untouched, no floor was lowered, and no assertion was loosened. No scope creep.

## Issues Encountered

**One pre-existing test failure, environmental, not caused by this plan.**

`repo-root.test.ts`'s `path agreement (D-3, D-6 …)` asserts that the resolved supervisor directory "must not sit under `.claude`". This executor runs inside `.claude/worktrees/agent-…`, so the assertion fails on the worktree path itself. It was **measured failing at baseline**, on the unmodified tree at `231430c`, before any edit in this plan:

```
# tests 2863   # pass 2856   # fail 1
```

and the tree ends at the same single failure with 12 more tests:

```
# tests 2875   # pass 2868   # fail 1
```

So `npm run test:automated` reports **0 failures attributable to this plan**, and 1 attributable to worktree isolation. It is out of scope by the executor's scope boundary (not caused by this task's changes) and needs no fix in the main checkout, where the path is not under `.claude`.

## Requirements

`EXPORT-01` is ready to mark complete. **It was not marked here:** `requirements.mark-complete` is unreachable from a worktree — `gsd-core/` is a gitignored vendored install absent from fresh checkouts — and `.planning/REQUIREMENTS.md` was deliberately not hand-edited. The orchestrator should sync `EXPORT-01` post-merge. (Plans 30-03 and 30-04 hit the same thing.)

## Known Stubs

None. No hardcoded empty value, placeholder string, TODO or FIXME was introduced. The verb has a real implementation, real refusals and eleven end-to-end tests; nothing is wired to mock data.

## Threat Flags

None. Every path this plan added is a caller-supplied or verb-derived filesystem path routed through the existing `storePathWithinWorkspace()` seam and inventoried in `anno-cli-path-consumers.test.ts` — no new network endpoint, no new auth path, no schema change, no new trust boundary. `T-30-SC` holds: this plan installed no packages.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Plan **30-06** can now discharge the withdrawal notices. What it inherits, concretely:

- `anno export-asm` exists and dispatches, so every "withdrawn 2026-08-29; returns in Phase 30" notice across the six shipped files in **both** skill trees is now false and can be re-pointed to a live invocation.
- The literal `anno export-asm` that `scripts/check-skill-fork-honesty.mjs:533` asserts on **must survive** the rewrite; it is already present in `src/skills/acme-build/SKILL.md` at lines 138 and 194, and the gate is green today.
- `anno-cli.ts`'s header states in one line that 30-06 owns the tree-wide re-pointing and deliberately does **not** restate the notices' text, so the two edits cannot contradict each other.
- `scripts/lib/anno-cli-verbs.mjs`'s floor paragraph and `anno-verb-coverage.test.ts`'s `REAL_VERBS` doc both already record that `gen-enums`, `export-lbl` and `import-lbl` did not return and that no phase owns them — 30-06's Half B should read as agreeing with those, not as a second independent claim.
- The invocation gate now argument-checks `export-asm`, so any invocation 30-06 documents in a fenced block will be checked for flag membership, positional kind, required-flag presence and flag-value kind. A documented `anno export-asm game.prg --store game.annostore` passes; `--out foo.md` would not.

---
*Phase: 30-acme-export-and-the-real-acme-oracle*
*Completed: 2026-08-30*
