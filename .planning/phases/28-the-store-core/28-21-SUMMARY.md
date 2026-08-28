---
phase: 28-the-store-core
plan: 21
subsystem: database
tags: [sqlite, annotation-store, node-sqlite, idempotence, workspace-confinement, scopes, structural-pin]

requires:
  - phase: 28-the-store-core
    provides: "`applyWrite`'s `{revision, result}` contract and the `setLabel`/`setComment` idempotence shape, `AnnoRangeShapeError`, `storePathWithinWorkspace` + `AnnoStorePathError`, `anno-confinement.test.ts`'s 15 cases, `anno-seam.test.ts`'s `SEAM_PRIVATE_EXPORTS` pin idiom, and 28-20's `revertTo` step-6 close-and-reopen"
provides:
  - "`addScope` idempotence — a byte-identical repeat is an ACCEPTED no-op reporting `changed: false`, with the revision still advancing, so `AnnoWriteResult.changed` finally carries the signal its own doc comment says it carries"
  - "`addScope` overlap refusal — a nested, containing or partially overlapping scope is REFUSED with an `AnnoRangeShapeError` naming BOTH scopes; adjacency is explicitly not overlap"
  - "two doc comments that are TRUE — `addScope`'s contradicting `ADDITIVE` paragraph DELETED in the same commit as the code, and `ScopeRow`'s no-nesting claim given a pointer to the refusal that enforces it"
  - "`openStore` confinement by DEFAULT — a `workspaceRoot` is required unless the caller explicitly asks for `unconfinedModuleDerivedPath: true`, refused before the path is resolved and long before `new DatabaseSync`, so a refused open creates nothing"
  - "`unconfinedModuleDerivedPath` — an escape hatch that is one greppable word, carried by exactly the seam's four module-derived opens, each with a site comment naming the module-derived value that produced its path"
  - "`anno-seam.test.ts`'s escape-hatch pin — a POSITIVE count of 4 call sites plus an absence scan over the `files[]`-derived shipped module set, with a non-vacuity companion and a BEHAVIOURAL guard-exists control"
  - "PLANTING A, B and C — three structural/behavioural controls observed red on the real tree, one hand edit at a time, each restored to an empty diff"
affects: [29-the-mcp-surface, 30-acme-export]

actuals:
  tokens: 6510
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A guarantee asserted in a doc comment is enforced in the SAME commit that states it, or the comment is deleted (28-07 P3 / 28-21 P1)"
    - "The mitigation for an input the module's own threat model calls unvalidated is the DEFAULT; the escape is explicit, greppable and pinned by a positive count over the shipped module set (28-21 P2)"
    - "An idempotence check reads the existing row INSIDE the transaction and returns `false` — one shape, shared with `setLabel`, `setComment`, `putXref` and `retype`"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-store.ts
    - src/mcp/vice/anno-types.ts
    - src/mcp/vice/anno-store.test.ts
    - src/mcp/vice/anno-seam.test.ts
    - src/mcp/vice/anno-durability-mutator.mjs

key-decisions:
  - "`addScope`'s ADDITIVE reading is REVERSED and the paragraph DELETED rather than amended — `AnnoWriteResult`'s own sentence and Phase 29 criterion 5 are the two grounds it could not see"
  - "A byte-identical repeat is an accepted NO-OP, never a refusal — the revision still advances, so `changed` stays the only no-op signal"
  - "Adjacency is NOT overlap: two scopes touching at a boundary are two scopes, pinned with the exact addresses $2000/$2001"
  - "WR-25 was DECIDED, not accepted-with-reason: the fix's shape was fully enumerable (8 call sites) and the pin idiom already existed"
  - "The escape hatch is reserved for paths THIS MODULE derived; `anno-durability-mutator.mjs` is CONFINED (dirname of its argv store path) rather than escaped"
  - "The guard-exists control is BEHAVIOURAL, not a source-text match on the refusal — 28-18 P1 forbids a structural invariant constraining a user-facing message's wording"

patterns-established:
  - "Positive-count structural pin: assert the number of marked call sites first, then the absence across other shipped modules — a rename that makes every scan find nothing cannot pass"
  - "A call-site literal (`unconfinedModuleDerivedPath: true`) is counted under STRICT `codeOnly()`, so the option's own declaration, the guard's read of it, and its appearance in the refusal message are all excluded by construction"

requirements-completed: [STORE-01]

coverage:
  - id: D1
    description: "A byte-identical `addScope` repeat is an accepted no-op reporting `changed: false`, with exactly one row stored and the revision advanced"
    requirement: STORE-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#WR-21: a byte-identical addScope repeat is an accepted NO-OP reporting changed:false, and the scope table still holds exactly one row"
        status: pass
      - kind: unit
        ref: "PLANTING B — idempotence check deleted by hand, control observed red (`not ok 86`), restored to an empty diff"
        status: pass
    human_judgment: false
  - id: D2
    description: "A nested, containing or partially overlapping scope is refused with `AnnoRangeShapeError` naming both scopes' ends and the existing row's id, with nothing written"
    requirement: STORE-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#WR-21: a NESTED scope is refused BY NAME with both scopes' ends and the existing scope's id, and the table is unchanged"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#WR-21: a PARTIALLY overlapping scope is refused by the same rule and the same class"
        status: pass
      - kind: unit
        ref: "PLANTING C — overlap refusal deleted by hand, both controls observed red (`not ok 87`, `not ok 88`), restored to an empty diff"
        status: pass
    human_judgment: false
  - id: D3
    description: "The refusal was not bought by broadening: two disjoint scopes and two adjacent scopes are all accepted, with the adjacency boundary pinned at the exact addresses"
    requirement: STORE-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#WR-21 discrimination: two DISJOINT scopes are both accepted -- the refusal was not bought by refusing everything"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#WR-21 discrimination: two ADJACENT scopes are both accepted -- touching at a boundary is not overlapping, pinned with the exact addresses"
        status: pass
    human_judgment: false
  - id: D4
    description: "Neither `addScope`'s nor `ScopeRow`'s doc comment claims a guarantee the code does not provide; the contradicting `ADDITIVE` paragraph was deleted, not amended"
    requirement: STORE-01
    verification:
      - kind: other
        ref: "grep of `src/mcp/vice/anno-store.ts` for the deleted paragraph's text returns 0 outside the recorded-reversal quotation; the replacement is quoted verbatim in this SUMMARY"
        status: pass
    human_judgment: true
    rationale: "Whether a rewritten doc comment and the code it describes now AGREE is a reading judgment a grep cannot make; the mechanical half (paragraph absent, pointer present) is checkable, the agreement is not."
  - id: D5
    description: "`openStore` refuses by name when neither a `workspaceRoot` nor the escape is supplied, and the refused open creates no file"
    requirement: STORE-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#WR-25: openStore with NO options refuses by name -- and, the part that matters, creates NO file at the path it refused"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-seam.test.ts#WR-25: the guard itself exists -- openStore refuses BEHAVIOURALLY when neither a workspaceRoot nor the escape is supplied"
        status: pass
    human_judgment: false
  - id: D6
    description: "The new default was not bought by broadening: a confined open of a legitimate path succeeds, the escape opens the same path, and all 15 confinement cases still decide exactly as before — including the inside-pointing symlink, still FOLLOWED"
    requirement: STORE-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-confinement.test.ts — `# tests 15 / # pass 15 / # fail 0`, exit 0, run individually twice"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#WR-25 companion: a CONFINED open of a legitimate in-workspace path still succeeds -- the default was not bought by refusing everything"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#WR-25 companion: the escape option opens the same path successfully, so the hatch is real and the seam pin is pinning something that works"
        status: pass
    human_judgment: false
  - id: D7
    description: "The escape hatch is enumerated at 4 module-derived opens and used by no other shipped module, pinned with a positive count and a non-vacuity companion"
    requirement: STORE-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-seam.test.ts#WR-25 pin: the unconfined escape is used by NO shipped module but the seam, and exactly at its enumerated module-derived opens"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-seam.test.ts#WR-25 pin, NON-VACUITY: the scanned shipped module set is real and the seam's stripped source still contains openStore"
        status: pass
      - kind: unit
        ref: "PLANTING A — a fifth escape use added by hand, pin observed red (`found 5`), restored to an empty diff"
        status: pass
    human_judgment: false
  - id: D8
    description: "The whole anno surface is green at a real exit code with its growth accounted for: 198 -> 209"
    verification:
      - kind: integration
        ref: "cd src/mcp/vice && node --test anno-*.test.ts block-class.test.ts -- `# tests 209 / # pass 209 / # fail 0 / # skipped 0`, exit 0"
        status: pass
      - kind: other
        ref: "src/mcp/vice/node_modules/.bin/tsc --noEmit -p src/mcp/vice/tsconfig.json -- no output, exit 0"
        status: pass
    human_judgment: false

duration: 15 min
completed: 2026-08-28
status: complete
---

# Phase 28 Plan 21: WR-21 and WR-25 Summary

**`addScope` gained an idempotence check and a no-nesting refusal so both of its doc comments became true, and workspace confinement became `openStore`'s default with a one-word greppable escape pinned to its four module-derived opens.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-28T20:59Z
- **Completed:** 2026-08-28T21:14:49Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- **WR-21 closed.** `addScope` is no longer the only write entry point without an idempotence check, and the tree no longer carries two contradictory readings of the no-nesting rule.
- **WR-25 decided and closed, not accepted-with-reason.** The one input `anno-types.ts`'s own header names as unvalidated upstream and a caller could forget now has its mitigation as the DEFAULT.
- **All three new rules observed red** on the real tree, one hand edit at a time, each restored to an empty `git diff --stat -- src/mcp/vice`.
- **Suite 198 -> 209** at a real exit code of 0, `# fail 0`, `# skipped 0`, `tsc --noEmit` clean.

## Task Commits

1. **Task 1 RED: failing controls for addScope idempotence and the no-nesting rule** — `f67917a` (test)
2. **Task 1 GREEN: addScope gets an idempotence check and a nesting rule, and both doc comments become true** — `9d292bb` (feat)
3. **Task 2: workspace confinement becomes openStore's default** — `df619ad` (feat)
4. **Task 3: pin the unconfined escape hatch to its enumerated module-derived opens** — `0a44886` (test)

No REFACTOR commit: neither change had an obvious cleanup that did not also change behaviour.

## Files Created/Modified

- `src/mcp/vice/anno-store.ts` — `addScope`'s idempotence arm and overlap refusal, its rewritten doc comment; `openStore`'s new option, its guard and its rewritten doc paragraph; four marked module-derived opens
- `src/mcp/vice/anno-types.ts` — one sentence added to `ScopeRow`'s doc comment. `storePathWithinWorkspace` and every other function UNCHANGED
- `src/mcp/vice/anno-store.test.ts` — 8 new controls; two existing structural assertions and two deliberate unconfined opens updated
- `src/mcp/vice/anno-seam.test.ts` — 3 new controls (the pin, its non-vacuity companion, the behavioural guard control)
- `src/mcp/vice/anno-durability-mutator.mjs` — its two opens CONFINED via `dirname(storePath)`

---

## Task 1 — WR-21, the recorded numbers

### The duplicate control, driven through production entry points only

```
first  : {"revision":1,"changed":true}
repeat : {"revision":2,"changed":false}
rows   : [{"id":1,"start":4096,"endInclusive":8192}]
```

`listScopes().length` is **1** after both calls. At plan time the same drive on the pre-task tree produced `changed: true` **twice** and **two** byte-identical rows. The repeat SUCCEEDS — it is not rejected — and the revision still advances by exactly one, which is the store-side half of Phase 29's success criterion 5.

### The nested refusal — class, full message, row count

Thrown class: **`AnnoRangeShapeError`**. Full message, verbatim:

```
scope 5120..5376 ($1400..$1500) overlaps the existing scope id=1 4096..8192 ($1000..$2000) -- nested and overlapping scopes are UNSUPPORTED by the schema this store mirrors, so the write is REFUSED rather than stored as a shape nothing downstream can express. The incoming scope is NOT trimmed and NOT split: supply a range disjoint from every existing scope. Two scopes that merely TOUCH at a boundary are disjoint and both accepted.
```

Both scopes' ends are present (`5120`, `5376`, `4096`, `8192`) and the existing scope's id (`id=1`) — 28-08 P2's requirement that a conflict be reported with both of the numbers that conflicted. `listScopes().length` after the refusal: **1**.

### The partial-overlap refusal, asserted separately with its own fixture

`addScope($1fff..$3000)` against an existing `$1000..$2000`:

```
scope 8191..12288 ($1fff..$3000) overlaps the existing scope id=1 4096..8192 ($1000..$2000) -- nested and overlapping scopes are UNSUPPORTED [...]
```

`listScopes().length` after both refusals: **1**.

### The two discrimination controls

| control | result |
|---|---|
| two DISJOINT scopes (`$1000..$2000`, `$3000..$4000`) | `listScopes().length` = **2** |
| two ADJACENT scopes (`$1000..$2000`, then `$2001..$3000`) | `listScopes().length` = **2** |

The adjacency boundary is asserted with the exact addresses: the second scope starts at **`0x2001`**, exactly one past the first's inclusive end **`0x2000`**, and both rows are compared by value (`[{id:1,start:0x1000,endInclusive:0x2000},{id:2,start:0x2001,endInclusive:0x3000}]`). An off-by-one in the overlap predicate would silently refuse legitimate work, and a control that used a gap of two would never see it.

Live drive of the adjacent case: `{"revision":3,"changed":true}`, final rows `[{"id":1,"start":4096,"endInclusive":8192},{"id":2,"start":8193,"endInclusive":12288}]`.

### The doc comments

`addScope`'s **`ADDITIVE` paragraph was DELETED, not amended**. The deleted text was:

> ADDITIVE, matching the verb's own name in the schema (`add_scope`): two identical calls produce two rows. There is no unique constraint on `anno_scope` to make it otherwise, and collapsing duplicates here would be this module inventing a policy the surface does not have.

Its replacement, quoted:

> A BYTE-IDENTICAL REPEAT IS AN ACCEPTED NO-OP reporting `changed: false`, and this REVERSES a decision recorded here in as many words. [...] That reading is rejected on two grounds it could not see. First, `AnnoWriteResult`'s own doc comment states that `changed` is the ONLY signal distinguishing a no-op from a real edit -- and for scopes it could never say no-op, so the module already had the policy and simply could not express it here. Second, Phase 29's success criterion 5 requires a repeated edit to SUCCEED reporting no change, so the surface this store mirrors does have the policy after all.

The `NO NESTING` paragraph was KEPT and given the sentence that makes it findable from the claim:

> ENFORCED, as of 28-21, by the overlap refusal below: a scope that is nested inside, contains, or partially overlaps an existing scope is REFUSED with an `AnnoRangeShapeError` naming BOTH scopes [...] Adjacency is NOT overlap.

`ScopeRow`'s doc comment (`anno-types.ts`) gained exactly one sentence, quoted:

> That last claim is ENFORCED rather than merely asserted -- `addScope()` in `anno-store.ts` refuses a nested or overlapping range with an `AnnoRangeShapeError` naming both scopes; see its doc comment for the rule.

The rule itself is not restated there — one definition, one home.

### Task 1 acceptance numbers

| check | result |
|---|---|
| `node --test anno-store.test.ts` before task 1 | `# tests 85 / # pass 85 / # fail 0`, exit 0 |
| after task 1 | `# tests 90 / # pass 90 / # fail 0 / # skipped 0`, exit **0** |
| `tsc --noEmit -p src/mcp/vice/tsconfig.json` | no output, exit **0** |
| `grep -c 'SCHEMA_VERSION = 2' src/mcp/vice/anno-types.ts` | **1** |
| DDL statements changed | **none** — the diff of `anno-store.ts` contains no `create table` line and no change inside `DDL` |

This task changes what a table ACCEPTS, never what a column MEANS, which is the distinction 28-10 P4 draws.

---

## Task 2 — WR-25, the recorded numbers

### The default refusal, full message and the post-refusal filesystem check

Thrown class: **`AnnoStorePathError`**. Full message, verbatim (temp path from the live drive):

```
/tmp/anno-drive-Ow53c8/proj.annostore: refusing to open an annotation store without a workspace root. The MCP transport validates NOTHING -- `vice-proxy.ts`'s raw-schema validator is `validate: (value) => ({ value })` -- so an unconfined store path is a store file created wherever the caller's argument pointed. Pass { workspaceRoot } to confine the path, or { unconfinedModuleDerivedPath: true } if and only if THIS MODULE derived the path itself.
```

`existsSync(path)` afterwards: **`false`**. That assertion is the one that matters — `openStore`'s default behaviour is to CREATE the file, so a guard placed after `new DatabaseSync` would throw the right class over a file it had already made. The guard is placed before the `resolve()` / `storePathWithinWorkspace` decision and before the constructor, for exactly the reason `mustExist` records at its own site.

### Both surviving paths

| path | result |
|---|---|
| `openStore(path, { workspaceRoot })` | handle returned, `currentRevision()` = **0** on a fresh store |
| `openStore(path, { unconfinedModuleDerivedPath: true })` | handle returned, `currentRevision()` = **0** on a fresh store |

### Every call site changed, against the plan-time inventory of 8

The census was re-derived on the current tree (28-20 had moved `anno-store.ts`'s line numbers). It found the same **8** sites, at new line numbers:

| # | file | site (pre-change line) | remedy |
|---|---|---|---|
| 1 | `src/mcp/vice/anno-store.ts` | `:654` — `snapshotOpenFailure`'s judging open of `snapshotPathFor(handle, revision)` | escape option, `mustExist: true` KEPT |
| 2 | `src/mcp/vice/anno-store.ts` | `:2345` — `revertTo` step 3b's open of the staged copy | escape option, `mustExist: true` KEPT |
| 3 | `src/mcp/vice/anno-store.ts` | `:2475` — `revertTo` step 6's reopen after the rename | escape option |
| 4 | `src/mcp/vice/anno-store.ts` | `:2513` — `revertTo` step 6's second reopen on the failed-sweep recovery path | escape option |
| 5 | `src/mcp/vice/anno-store.test.ts` | `:3370` — the symlink-alias reproduction | escape option; existing comment EXTENDED, not replaced |
| 6 | `src/mcp/vice/anno-store.test.ts` | `:3429` — the renamed-directory reproduction | escape option; new comment added beside the existing one |
| 7 | `src/mcp/vice/anno-durability-mutator.mjs` | `:135` — `mutateStore` | **`workspaceRoot: dirname(storePath)`** — confined, not escaped |
| 8 | `src/mcp/vice/anno-durability-mutator.mjs` | `:176` — the hold-read mode | **`workspaceRoot: dirname(storePath)`** — confined, not escaped |

**Total: 8, matching the plan-time inventory exactly.** The escape is reserved for the four sites where the path is genuinely module-derived plus the two tests whose whole purpose is to mimic `revertTo`'s module-derived call shape; the spawned mutator receives its path on argv and therefore has a real root to give.

Per-file `openStore(` counts on the current tree, for the record: `anno-confinement.test.ts` 10, `anno-overlap.test.ts` 3, `anno-store.ts` 5 (four calls plus the definition), `anno-store.test.ts` 95 (88 at plan time; 28-20 and this plan added the rest), `anno-durability-mutator.mjs` 2, `anno-durability.test.ts` 5.

### `anno-confinement.test.ts`, quoted verbatim (first of two runs, on task 2's tree)

```
1..15
# tests 15
# suites 0
# pass 15
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

exit **0**. `# skipped 0` is correct and is NOT a weakened skip: case 14's `{ skip: ... }` is a real conditional that fires only under root, and this run was `id -u` = **1000**. Its declaration is unchanged and reads, verbatim:

```
skip:
  process.getuid?.() === 0
    ? "running as root: root ignores directory mode bits, so a 0o000 ancestor still stats successfully and the EACCES class cannot be planted -- this case would pass vacuously"
    : false,
```

28-17 P4 is honoured: nothing was made conditional to survive the changed default.

### The discrimination case, named individually

**Case 2, `a symlink pointing INSIDE the workspace is FOLLOWED, and the store lands at the link's real path`, is `ok`.** So is case 8 (`9. a dangling link pointing INSIDE the workspace is still FOLLOWED -- the over-refusal control, restated for the dangling case`). Both are the evidence for 28-09 P1 / 28-12 P2: an inside-pointing symlink alias is still FOLLOWED, not refused, so this plan's new default was not bought by broadening a refusal.

### `storePathWithinWorkspace` unchanged

`git diff --stat -- src/mcp/vice/anno-types.ts` for task 2 produced **no output** — `anno-types.ts` was not touched at all by this task (its only change in the whole plan is task 1's one-sentence `ScopeRow` doc addition, `4 insertions(+) 1 deletion(-)`, entirely inside a comment block above the interface). This plan changes **when** confinement runs and never **what** it decides.

### Task 2 acceptance numbers

| check | result |
|---|---|
| `node --test anno-store.test.ts anno-confinement.test.ts anno-durability.test.ts anno-overlap.test.ts` | `# tests 144 / # pass 144 / # fail 0 / # skipped 0`, exit **0** |
| `node --test anno-*.test.ts block-class.test.ts` (whole surface, because this task changes the entry point every one of those files uses) | `# tests 206 / # pass 206 / # fail 0 / # skipped 0`, exit **0** |
| `tsc --noEmit -p src/mcp/vice/tsconfig.json` | no output, exit **0** |

---

## Task 3 — the pin, the plantings and the regression

### The seam pin's expected count

`ENUMERATED_DERIVED_OPENS = 4`, read off the code rather than guessed, and enumerated by name in the constant's doc comment: `snapshotOpenFailure`'s judging open, `revertTo` step 3b's staged-copy open, and `revertTo` step 6's two reopens. The count is asserted as the PRIMARY assertion (`assert.equal(uses, ENUMERATED_DERIVED_OPENS, ...)`), so a rename that made every scan find nothing cannot pass.

The counted literal is `unconfinedModuleDerivedPath: true` under **strict** `codeOnly()` (literal bodies blanked). That excludes three non-uses by construction: the option's declaration (`unconfinedModuleDerivedPath?: boolean`), the guard's own read (`opts.unconfinedModuleDerivedPath !== true`), and its appearance inside the refusal message string.

### The non-vacuity companion's two assertions, quoted

```
assert.ok(scanned.length > 10, `the shipped module set must be substantial, got ${scanned.length}`);
assert.ok(scanned.includes(THE_ONE_SEAM), `the scanned set must contain ${THE_ONE_SEAM}, or the count above scanned nothing`);
```

plus the stripped-source half:

```
assert.ok(seamCode.includes("openStore"), "openStore must exist in the seam's stripped source, or the pin above is decoration");
```

### The behavioural guard control — 28-18 P1 honoured, explicitly

The guard-exists control asserts **through the entry point**, not against source text: it calls `openStore(path)` inside a real temp dir, asserts `caught instanceof AnnoStorePathError`, asserts `existsSync(path) === false`, and then asserts the escape still opens the same path. Nothing in it matches the refusal's wording. This is stated here so a later reader can check the claim: **a structural invariant must not constrain the wording of a user-facing message, and a source-text match on the refusal is one edit away from doing exactly that.** The structural pin above is structural because it counts CALL SITES; this control is behavioural because it is about what the function DOES.

### Three plantings, observed red and reverted

**PLANTING A — a FIFTH use of the escape option**, added by hand in `anno-store.ts` beside `revertTo` step 6's reopen. `node --test anno-seam.test.ts` reported `# tests 22 / # pass 21 / # fail 1` and this `not ok` line, verbatim:

```
not ok 20 - WR-25 pin: the unconfined escape is used by NO shipped module but the seam, and exactly at its enumerated module-derived opens
    the seam must ask for the unconfined path at exactly its 4 enumerated module-derived opens, found 5 -- a fifth use is either a new derived-path open that belongs in the enumeration above, or the old unsafe default returning by another name
```

After `git checkout -- src/mcp/vice/anno-store.ts`: `git diff --stat -- src/mcp/vice` produced **no output** (EMPTY), and `node --test anno-seam.test.ts` reported `# tests 22 / # pass 22 / # fail 0`, exit 0.

**PLANTING B — the idempotence check DELETED** from `addScope`'s mutate callback. `node --test anno-store.test.ts` reported `# tests 93 / # pass 92 / # fail 1` and this `not ok` line, verbatim:

```
not ok 86 - WR-21: a byte-identical addScope repeat is an accepted NO-OP reporting changed:false, and the scope table still holds exactly one row
```

After restore: `git diff --stat -- src/mcp/vice` produced **no output** (EMPTY).

**PLANTING C — the overlap refusal DELETED** from `addScope`'s mutate callback. `node --test anno-store.test.ts` reported `# tests 93 / # pass 91 / # fail 2` and these `not ok` lines, verbatim:

```
not ok 87 - WR-21: a NESTED scope is refused BY NAME with both scopes' ends and the existing scope's id, and the table is unchanged
not ok 88 - WR-21: a PARTIALLY overlapping scope is refused by the same rule and the same class
```

After restore: `git diff --stat -- src/mcp/vice` produced **no output** (EMPTY).

### Suite counts, before and after

| suite | before (28-20's tree) | after |
|---|---|---|
| `node --test anno-store.test.ts` | `# tests 85 / # pass 85 / # fail 0 / # skipped 0`, exit 0 | `# tests 93 / # pass 93 / # fail 0`, exit 0 |
| `node --test anno-seam.test.ts` | `# tests 19` | `# tests 22 / # pass 22 / # fail 0`, exit 0 |
| `node --test anno-store.test.ts anno-confinement.test.ts anno-durability.test.ts anno-overlap.test.ts` | — | `# tests 144 / # pass 144 / # fail 0 / # skipped 0`, exit 0 |
| `node --test anno-*.test.ts block-class.test.ts` | `# tests 198 / # pass 198 / # fail 0 / # skipped 0`, exit **0** | `# tests 209 / # pass 209 / # fail 0 / # skipped 0`, exit **0** |

**Derived expectation: 198 + 11 = 209. Observed: 209.** The growth is accounted for rather than rounded — the 11 tests this plan added, by name:

`anno-store.test.ts` (8):
1. `WR-21: a byte-identical addScope repeat is an accepted NO-OP reporting changed:false, and the scope table still holds exactly one row`
2. `WR-21: a NESTED scope is refused BY NAME with both scopes' ends and the existing scope's id, and the table is unchanged`
3. `WR-21: a PARTIALLY overlapping scope is refused by the same rule and the same class`
4. `WR-21 discrimination: two DISJOINT scopes are both accepted -- the refusal was not bought by refusing everything`
5. `WR-21 discrimination: two ADJACENT scopes are both accepted -- touching at a boundary is not overlapping, pinned with the exact addresses`
6. `WR-25: openStore with NO options refuses by name -- and, the part that matters, creates NO file at the path it refused`
7. `WR-25 companion: a CONFINED open of a legitimate in-workspace path still succeeds -- the default was not bought by refusing everything`
8. `WR-25 companion: the escape option opens the same path successfully, so the hatch is real and the seam pin is pinning something that works`

`anno-seam.test.ts` (3):
9. `WR-25 pin: the unconfined escape is used by NO shipped module but the seam, and exactly at its enumerated module-derived opens`
10. `WR-25 pin, NON-VACUITY: the scanned shipped module set is real and the seam's stripped source still contains openStore`
11. `WR-25: the guard itself exists -- openStore refuses BEHAVIOURALLY when neither a workspaceRoot nor the escape is supplied`

### `anno-confinement.test.ts` on the FINAL tree of this plan, quoted the second time

```
1..15
# tests 15
# suites 0
# pass 15
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 352.909639
```

exit **0**, with case 14's declared skip unchanged and case 2's inside-pointing symlink still FOLLOWED.

### Task 3 acceptance numbers

| check | result |
|---|---|
| `tsc --noEmit -p src/mcp/vice/tsconfig.json` | no output, exit **0** |
| `git status --porcelain .planning/STATE.md .planning/ROADMAP.md` | **empty** — this plan's tasks touched neither |
| `git status --porcelain src/mcp/vice` after the three restores | **empty** |

---

## Prohibition ledger

| prohibition | verdict |
|---|---|
| 28-21 P1 — no two contradictory readings of the same rule left in the tree | **Honoured.** `addScope`'s `ADDITIVE` paragraph was DELETED in commit `9d292bb`, the same commit that added the refusal making the `NO NESTING` paragraph true, and `ScopeRow`'s claim gained its pointer in the same commit. Neither was left for a later reader to reconcile. |
| 28-21 P2 — the safety-critical option must not be the one a caller has to remember | **Honoured.** `workspaceRoot` is required unless `unconfinedModuleDerivedPath: true` is named explicitly; the escape is one greppable word, used at 4 enumerated sites, pinned by a positive count over the `files[]`-derived shipped module set with a non-vacuity companion, and observed red. |
| 28-09 P1 / 28-12 P1 / 28-12 P2 — no silent redirect, no refusal bought by broadening | **Honoured.** `storePathWithinWorkspace` is byte-unchanged; `anno-confinement.test.ts` is 15/15 on both this plan's trees; case 2's inside-pointing symlink is still FOLLOWED; a legitimate confined open still succeeds. |
| 28-07 P3 — no comment or message asserting a guarantee the code does not provide | **Honoured at both sites this round found.** `addScope`'s and `ScopeRow`'s doc comments now describe code that exists. |
| 28-08 P2 — a conflict is reported with BOTH numbers that conflicted | **Honoured.** The overlap refusal names the incoming scope's two ends, the existing scope's two ends, and the existing scope's id. |
| 28-11 P5 — a committed write must not become a caller-visible failure | **Honoured.** Both new refusals are raised at the entry, before any write: the overlap check runs inside the mutate callback before the `insert` and rolls back cleanly, and `openStore`'s guard runs before the path is even resolved. The duplicate case is not a refusal at all — it is an accepted no-op that still advances the revision. |
| 28-16 P3 — judging a snapshot image must not create, initialise or modify it | **Honoured.** Both judging call sites (`snapshotOpenFailure`, `revertTo` step 3b) keep `mustExist: true` alongside the new escape marker; the escape only waives confinement, never the existence gate or the read-only open. |
| 28-17 P4 — no test may report a PASS for a precondition it could not construct | **Honoured.** `anno-confinement.test.ts` case 14's real `{ skip: ... }` is byte-unchanged and no new control was made conditional. |
| 28-20 P1 — must not return a handle whose transaction state the function cannot vouch for | **Honoured.** `openStore`'s handle construction, including `transactionStateUnknown: false`, is untouched; `revertTo` step 6's close-and-reopen logic is unchanged apart from the escape marker on its two `openStore` calls. |
| 28-19 P1 — the store must not persist, by ANY writer, a range row it would refuse at its own entry point | **Honoured, regression only.** This plan touches no range writer; `anno-overlap.test.ts`'s round-trip invariant is green in the 209-test run. |
| 28-18 P1 — a structural invariant must not constrain a user-facing message's wording | **Honoured, and stated explicitly.** The guard-exists control is behavioural; the only structural assertion counts call-site literals. |

## Decisions Made

- **WR-25 was decided rather than accepted-with-reason.** The planning brief allowed recording an accept. It was not taken: the fix's shape was fully enumerable (8 call sites, all found), the mechanism already existed, and an accept for a mitigation this cheap would have been recording a decision not to decide.
- **`addScope`'s `ADDITIVE` reading is reversed and its paragraph deleted.** Not amended, not left beside the code — the tree stops arguing with itself.
- **A duplicate is an accepted no-op, not a refusal.** Phase 29's criterion 5 requires the repeat to SUCCEED reporting no change; a refusal would have satisfied "does not store two rows" and broken the criterion.
- **Adjacency is not overlap.** Consistent with STORE-02's treatment of ranges, and pinned with the exact addresses rather than left implicit.
- **The mutator is confined, not escaped.** It receives its store path on argv, so `dirname(storePath)` is a real workspace root; escaping it would have made the spawned proof helper the one caller that forgets.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `assert.throws` returns `undefined`, so the two refusal controls crashed instead of asserting**

- **Found during:** Task 1 (GREEN phase)
- **Issue:** The two new refusal controls were written as `const thrown = assert.throws(...) as AnnoRangeShapeError`, but `node:assert`'s `throws` returns `undefined` — the controls failed with `TypeError: Cannot read properties of undefined (reading 'message')` even though the production code was correct.
- **Fix:** Rewrote both to the file's own established idiom (`let caught: unknown; try { ... } catch (e) { caught = e; } assert.ok(caught instanceof ...)`), which `anno-store.test.ts:1025` already uses.
- **Files modified:** `src/mcp/vice/anno-store.test.ts`
- **Verification:** `node --test anno-store.test.ts` — `# tests 90 / # pass 90 / # fail 0`, exit 0
- **Committed in:** `9d292bb`

**2. [Rule 3 - Blocking] Three existing structural assertions matched `openStore` call text verbatim and went red on the option's addition**

- **Found during:** Task 2
- **Issue:** Adding `unconfinedModuleDerivedPath: true` to the module's four derived-path opens broke three assertions in `anno-store.test.ts` that pin `revertTo`'s structure by matching source text: `body.indexOf('openStore(staging, { mustExist: true })')`, and two `assert.match(..., /return openStore\(storePath\)/)` in different tests. A fourth failure was a 400-character source window that the added site comments pushed the match out of.
- **Fix:** Updated all three literals/regexes to the new call shape and widened the three source windows from 400 to 700 characters. The assertions still pin exactly what they pinned before (step 3b's open precedes the close and the rename; step 6 hands back a freshly opened handle) — none was weakened or deleted.
- **Files modified:** `src/mcp/vice/anno-store.test.ts`
- **Verification:** `node --test anno-store.test.ts anno-confinement.test.ts anno-durability.test.ts anno-overlap.test.ts` — `# tests 144 / # pass 144 / # fail 0`, exit 0
- **Committed in:** `df619ad`

---

**Total deviations:** 2 auto-fixed (1 bug in this plan's own new test code, 1 blocking update to existing structural assertions).
**Impact on plan:** None on scope. Both were mechanical consequences of the planned change, and neither weakened an existing control — the source-text pins were updated to the new call shape, not removed.

## Known Stubs

None. No stub, placeholder, TODO or skipped test was introduced. `anno-confinement.test.ts` case 14's `{ skip: ... }` is pre-existing, conditional on root, and unchanged; every run in this plan was `id -u` = 1000 and reported `# skipped 0`.

## Threat Flags

None. This plan added no network endpoint, no auth path, no new file-access pattern and no schema change. `SCHEMA_VERSION` stays 2, no DDL statement changed, and the one new option narrows rather than widens where a file can be created.

## Issues Encountered

- The plan's line-number inventory for `anno-store.ts` (`:626`, `:2045`, `:2175`, `:2194`) was stale after 28-20, exactly as the plan's own `<environment_preconditions>` warned. The census was re-derived on the current tree and found the same **8** sites at `:654`, `:2345`, `:2475`, `:2513` plus the two tests and two mutator calls.
- `anno-store.test.ts`'s per-file `openStore(` count is 95 on the current tree, not the 88 the plan recorded at plan time — 28-19 and 28-20 added the difference. Recorded rather than rounded.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Round 5's two verifier-confirmed WARNINGs, WR-21 and WR-25, are closed. WR-20, WR-23, IN-07 and IN-08 remain ACCEPT-ONLY for this round on the verifier's routing, and **no code was written for any of them** — in particular `contradictedCommentsFor`'s false rationale (WR-23) was not touched, because no task in this plan genuinely reached that function.
- 28-22 is next and owns the round's disposition table and record corrections. This plan modified neither `.planning/STATE.md` nor `.planning/ROADMAP.md` in any task commit.
- Phase 29's success criterion 5 (`a repeated edit succeeds reporting no change rather than being rejected`) is now TRUE for scopes on the store side, so it lands as a surface-level assertion in Phase 29 rather than as a store-level defect.

## Self-Check: PASSED

- Every file listed under `key-files.modified` exists on disk (`[ -f ]` for all five).
- All four task commits are present in `git log`: `f67917a`, `9d292bb`, `df619ad`, `0a44886`.
- Plan `<verification>` re-run at close: `node --test anno-*.test.ts block-class.test.ts` → `# tests 209 / # pass 209 / # fail 0 / # skipped 0`, exit **0**; `node --test anno-confinement.test.ts` → 15/15, exit 0; `tsc --noEmit -p src/mcp/vice/tsconfig.json` → no output, exit 0; `git status --porcelain src/mcp/vice` → empty.

## TDD Gate Compliance

Task 1 carried `tdd="true"` and ran the full cycle:

- **RED:** `f67917a` — `test(28-21): add failing controls for addScope idempotence and the no-nesting rule`. Observed `# tests 90 / # pass 87 / # fail 3`, exit 1 — the three new rule controls red, the two discrimination companions green (they assert behaviour that already held, which is what makes them discrimination controls).
- **GREEN:** `9d292bb` — `feat(28-21): addScope gets an idempotence check and a nesting rule, and both doc comments become true`. `# tests 90 / # pass 90 / # fail 0`, exit 0.
- **REFACTOR:** none. No cleanup existed that did not also change behaviour, so no `refactor(...)` commit was made — the gate treats REFACTOR as optional.

Both required gate commits are present and in order.

---
*Phase: 28-the-store-core*
*Completed: 2026-08-28*
