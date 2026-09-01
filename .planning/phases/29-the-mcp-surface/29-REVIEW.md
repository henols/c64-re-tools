---
phase: 29-the-mcp-surface
reviewed: 2026-08-30T18:40:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - scripts/check-skill-cli-invocations.mjs
  - scripts/lib/anno-cli-invocations.d.mts
  - scripts/lib/anno-cli-invocations.mjs
  - src/mcp/vice/anno-cli-invocations.test.ts
  - src/mcp/vice/anno-cli-path-consumers.test.ts
  - src/mcp/vice/anno-cli.test.ts
  - src/mcp/vice/anno-cli.ts
  - src/mcp/vice/anno-confinement.test.ts
  - src/mcp/vice/anno-memmap-render.test.ts
  - src/mcp/vice/anno-memmap-render.ts
  - src/mcp/vice/anno-types.ts
  - src/mcp/vice/module-classification.ts
  - src/skills/c64-program-recon/SKILL.md
  - src/skills/c64-program-recon/templates/memory-map.template.md
findings:
  critical: 1
  warning: 21
  info: 0
  total: 22
status: issues_found
---

# Phase 29: Code Review Report — gap-closure round 2 (14 files)

**Reviewed:** 2026-08-30T18:40:00Z
**Depth:** standard
**Files Reviewed (this pass):** 14
**Diff base:** `6715a75`
**Status:** issues_found

## Scope of this pass — read this before the counts

**This pass reviewed 14 files, not 96.** It covers exactly the source files changed by gap-closure
round 2 (plans 29-18, 29-19, 29-20; 29-21 touched only `.planning/REQUIREMENTS.md` and is out of
scope). The 17 findings `CR-01` and `WR-01`..`WR-16` below this section come from the earlier
**2026-08-30T14:05Z pass over 96 files** and are **preserved verbatim**. They were *not* re-derived
here. Where this round's work bears on one of them, the re-check is recorded in the table below
against its existing id — the finding text itself is untouched.

The frontmatter counts are the *cumulative* ledger for phase 29 (1 critical + 21 warnings = 22),
not a count of what this pass found. This pass found **five new warnings and no new blockers**.

## Summary of this pass

Round 2's two headline deliverables are **genuinely closed, and closed on the axis they claimed**,
not by comment repair. Both were verified by execution against this working tree, not by reading
the fix:

* **`CR-01` is closed.** `workspaceRelativePath()` (`anno-types.ts:1245-1260`) is a real seam with
  four committed control tests (`anno-confinement.test.ts` 16-19) covering the equal case, deep
  nesting, POSIX separator normalisation, the escape refusal *and* its discrimination control (a
  `..` that normalises back inside is accepted), and the symlinked-root pairing the CLI actually
  produces. `renderMemoryMap()` records the two relative spellings and
  `anno-memmap-render.test.ts`'s new cross-root test builds a store under root A, `cpSync`s the
  whole tree to root B, asserts the inputs are byte-identical, and asserts `checkRenderedMemoryMap()`
  returns `in-sync` — with a hand-edit control at root B so the gate is not merely blunted. The
  golden test now asserts the **absence** of the absolute paths, which is the assertion whose
  absence let the defect ship green. Ran green here: 139/139 across the five changed test files,
  `tsc --noEmit` exit 0.
* **`WR-01` is closed on both halves.** `checkInvocation()` now takes a fourth, **non-optional**
  `requiredFlags` table (`anno-cli-invocations.d.mts:62-67` makes forgetting it a compile error),
  and `POSITIONAL_KINDS`/`REQUIRED_FLAGS` moved into the import-safe lib so the committed test
  asserts against the map CI runs — with a structural test that reddens if the gate re-declares
  either locally. The verifier's exact plant (`anno coverage game.prg`) is now reported by name.

What did not survive scrutiny — **five new warnings, all reproduced against this tree**:

* **The renderer changed its output shape and `RENDERER_VERSION` was not bumped** (`WR-17`), which
  the constant's own doc comment says is exactly when it must be. Measured: `computeRenderDigest`
  is byte-identical across the round and the version is `"3"` on both sides, so every consuming
  project's existing `memory-map.md` will report `drifted` at line 3 with an **identical
  `render_digest`** beside the verdict. That is CR-01's own contradiction — digest says identical,
  gate says drifted — replayed one last time, using none of the mechanism built to distinguish it.
* **The invocation gate still passes two documented-command-exits-1 shapes** (`WR-18`), one of
  which is `CR-04`'s shape moved from the positional slot into the flag slot. Reproduced:
  `anno coverage game.prg --store game.prg` and `anno coverage game.prg --store` both return `[]`.
  `WR-01`'s own proposed fix named `FLAG_KINDS` alongside `REQUIRED_FLAGS`; only the latter shipped.
* **The gate crashes with an unhandled `TypeError` on an `Object.prototype` key in the verb slot**
  (`WR-19`), instead of the "no such verb" refusal its own doc comment promises. Reproduced for
  `constructor`, `toString` and `__proto__`; the `toString` crash site is the required-flag loop
  **added this round**.
* **The new `--help` capture spawns bare `"node"`** (`WR-20`), against ~25 sibling call sites in
  this tree that use `process.execPath`.
* **The corrected USAGE contradicts itself within three lines** (`WR-21`): `<image>` is "dispatched
  BY EXTENSION FIRST and never by byte length", followed immediately by a form that is dispatched
  by byte length. 29-20's stated charter was that no comment asserts a guarantee the code does not
  provide.

Every probe artifact was removed; `git status` is unchanged from session start apart from the
pre-existing untracked files.

## Re-check of the prior 17 findings (against their existing ids, not re-derived)

| id | status after round 2 | evidence |
|---|---|---|
| `CR-01` | **CLOSED** by 29-18 (`88a95a5` feat, `97f8c02` RED test, `99333b8` absence assertions) | cross-root `in-sync` test + hand-edit control, both green; golden test asserts the absolute paths are absent |
| `WR-01` | **CLOSED** by 29-19 (`0b84ff5` feat, `f23bd6e` RED test) | required-flag presence checked from a shared table; gate re-declaration is structurally forbidden. Residual holes are a **new** finding (`WR-18`), not this one reopening |
| `WR-02` | **PARTIALLY CLOSED** by 29-20 (`23cae55`, `c8503f9`, `2da457d`) | the positional half of the inventory is now derived from `--help` in both directions, and the three over-claiming headers are corrected to state the narrower property. The aggregate-count limit itself is **unchanged and now named in four places** — an honest deferral, not a fix |
| `WR-03` | OPEN, untouched | `check-npm-packages.mjs` not in this round's diff |
| `WR-04` | OPEN, untouched — and its measurement has moved | the raw NUL is still at `anno-memmap-render.ts:315`, but the import edit on line 72 shifted its byte offsets to **15097 and 15118** (the ledger text above records 15074, measured pre-round). `check-no-analyser.mjs`'s two "offset 12862 (line 291)" citations remain stale. Nothing mechanical catches either drift |
| `WR-05` | **CLOSED**, with one named residual **confirmed** | 29-20 re-spelled the synopsis to `coverage <image>`, named the three image forms, corrected "beside the project" → "beside the STORE", and added the payload-decode exit path. All four re-verified against the code. **Residual confirmed, exactly as `29-20-SUMMARY.md` predicts it:** `anno-cli.ts:921` still reads `will not derive its path from <project>`, and `scripts/lib/anno-cli-invocations.mjs:158` quotes that sentence *verbatim* as `REQUIRED_FLAGS`' provenance. The coupling is real — the two must move in one commit or the quote stops being a quote. Not re-raised as a new id; already on record |
| `WR-06`..`WR-13` | OPEN, untouched (dispositioned OPEN-AS-WARNING) | none of `anno-derive.ts`, `anno-store.ts`, `anno-tools.ts`, `prg-image.ts`, `anno-coverage.ts` is in this round's diff |
| `WR-14`, `WR-15`, `WR-16` | DEFERRED ON RECORD, unchanged | no disagreement with the deferrals; `runAnnoCli` is still the exported entry point (`anno-cli.test.ts` still calls it), which is what the `WR-16` deferral says |

Two prior citations were re-verified rather than assumed and are **correct**:
`module-classification.ts`'s three updated line references (`anno-cli.ts:106`, `:111`, `:234`) all
contain their cited symbols, and `module-classification.test.ts` Direction 9/9b checks that
mechanically — so those edits carry their own guard.

## Narrative Findings (AI reviewer) — new in this pass

### WR-17 (NEW): the renderer's output shape changed and `RENDERER_VERSION` was not bumped, so every existing memory map drifts with an identical digest beside the verdict

**File:** `src/mcp/vice/anno-memmap-render.ts:278-290` (the constant and its contract), `:472-499`
(the changed output); `src/skills/c64-program-recon/SKILL.md:276-280` and
`src/skills/c64-program-recon/templates/memory-map.template.md:30-34` (the consequence, documented
in prose instead)

**Issue:** `RENDERER_VERSION`'s own doc comment states the rule this change had to follow:

```ts
/** Bumped whenever this renderer's OUTPUT SHAPE **or its digest's canonical
 * INPUT** changes, so a re-render under a new renderer version is
 * distinguishable from drift under the same one. */
export const RENDERER_VERSION = "3";
```

29-18 changed the output shape substantially — the `store:` and `sidecar:` lines moved from
absolute to relative spellings, and the trailing banner prose went from three lines to eight — and
left the constant at `"3"`. Measured on this tree, not inferred:

```
$ git show 6715a75:src/mcp/vice/anno-memmap-render.ts | grep 'RENDERER_VERSION = '
export const RENDERER_VERSION = "3";
$ grep -a 'RENDERER_VERSION = ' src/mcp/vice/anno-memmap-render.ts
export const RENDERER_VERSION = "3";
$ diff <(git show 6715a75:...|sed -n '/function computeRenderDigest/,/^}/p') <(sed -n '/function computeRenderDigest/,/^}/p' ...)
computeRenderDigest IDENTICAL across the round
```

`computeRenderDigest()` covers the store rows, the sidecar bytes and `RENDERER_VERSION` — none of
which moved. So for any already-rendered `memory-map.md`, the fresh render produces the **same
64-hex `render_digest`** and **different surrounding bytes**. `--check` therefore reports
`drifted at line 3`, and a reader comparing the two banners sees an identical digest beside a
"drifted" verdict.

That is precisely the contradiction `CR-01` was raised for ("the file's own digest disagrees with
the gate"), reproduced once more — for every consuming project that upgrades — by the one change
that closed it. Both shipped playbooks acknowledge the symptom in prose ("One-time drift after
upgrading, 2026-08-30 … This is a one-time, self-clearing banner correction — not a bug"), which
means the consequence was known and the mechanism that exists to signal it was left unused. A prose
note in a playbook is not on screen when a CI `--check` job goes red; the digest line is.

This is a WARNING rather than a BLOCKER because it is transient and self-clearing, and because this
repository has no committed rendered `memory-map.md` (verified — a `grep -ra` for the banner across
every `.md` finds only the template). The cost lands entirely on consumers.

**Fix:** bump the constant in the same commit as any output-shape change, and record the reason
where the two earlier bumps are recorded:

```ts
/* Version 4 (CR-01, 29-18) is an OUTPUT-SHAPE change: the banner's `store:` and
 * `sidecar:` lines record workspace-relative locations instead of absolute
 * realpaths, and the explanatory block grew. Leaving it at "3" makes an
 * upgrade indistinguishable from a hand edit, which is the one distinction
 * this constant exists to draw. */
export const RENDERER_VERSION = "4";
```

Then re-point the two playbook notes at the version bump ("the banner's `render_digest` changes
too, which is how you tell an upgrade from a hand edit"), and add a test that fails when the banner
lines change without the constant moving — e.g. hash the banner block's line count and prose in the
golden test, so the two can only move together.

### WR-18 (NEW): the invocation gate still reports OK for two documented commands that exit 1 — one of them is CR-04's shape moved from the positional slot into the flag slot

**File:** `scripts/lib/anno-cli-invocations.mjs:331-377` (`checkInvocation`), `:285-303` (the
"two things it still does not check" list)

**Issue:** `WR-01`'s fix added flag **presence**. Its stated fix also named a `FLAG_KINDS` map
("give flag values their own kinds map"); that half did not ship. Reproduced against the shipped
tables on this tree:

```
"vice-mcp anno coverage game.prg --store game.prg"                       -> []
"vice-mcp anno coverage game.prg --store"                                -> []
"vice-mcp anno render-memmap game.annostore --provenance game.annostore" -> []
"vice-mcp anno render-memmap game.annostore --provenance"                -> []
```

All four are green, and all four exit 1 at runtime:

* `--store game.prg` — `openStore()` refuses it ("not an annotation store"). That is **`CR-04`
  verbatim**, with the wrong-kind file moved from the positional slot to a flag value. The gate
  checks kinds for positionals and for nothing else, so the same mistake one token to the right is
  invisible.
* `--store` with no value — `parseCoverageArgs()` sets `storeMissingValue` and `cmdCoverage()`
  prints `coverage: --store requires a value` and returns 1 (`anno-cli.ts:558`, `:897-900`). The
  presence check is deliberately token-only ("presence is a property of the flag TOKEN"), and that
  reasoning is right for a synopsis placeholder (`--store FILE`) but wrong for a flag at end of
  line, which is not a placeholder — it is a dead command.

The module does name "a flag's VALUE" as unchecked, but illustrates it only with the harmless
scalar case (`--sample abc`). A reader of that list will not conclude that a documented
`--store game.prg` is unchecked, because the example chosen is the one where being unchecked does
not matter. The whole point of that list is that a limit named honestly can be closed on purpose;
naming it with the benign example undercuts that.

**Fix:** add the kinds map and tighten presence to require a value where the CLI does:

```js
export const FLAG_KINDS = Object.freeze({
  coverage: Object.freeze({ "--store": [".annostore", ".store"], "--out": [".json"] }),
  "render-memmap": Object.freeze({ "--provenance": [".json"], "--out": [".md"] }),
});
// in checkInvocation(), after the presence loop:
for (const { flag, value } of flags) {
  if (!requiredFlags?.[verb]?.includes(flag)) continue;
  if (value === null) problems.push(`anno ${verb}: ${flag} is required but was documented with no value -- the command exits non-zero at runtime${where}`);
}
for (const { flag, value } of flags) {
  const kinds = flagKinds?.[verb]?.[flag];
  if (!kinds || value === null || isPlaceholder(value)) continue;
  if (!kinds.includes(extensionOf(value))) {
    problems.push(`anno ${verb}: ${flag} value ${value} has extension ${extensionOf(value) || "(none)"}, which is not one this flag reads (${kinds.join(", ")})${where}`);
  }
}
```

Extend `PROBLEM_ORDER` with the two new kinds, add both to `anno-cli-invocations.d.mts`, and plant
both shapes in `anno-cli-invocations.test.ts` beside the existing controls — the file's existing
plants cover a wrong positional extension and an omitted flag, and neither of these.

### WR-19 (NEW): an `Object.prototype` key in the verb slot crashes the CI gate with an unhandled `TypeError` instead of the documented "no such verb" refusal

**File:** `scripts/lib/anno-cli-invocations.mjs:336`, `:350`, `:368`;
`scripts/check-skill-cli-invocations.mjs:107-111` (no try/catch around the call)

**Issue:** All three verb-keyed tables are read with bare bracket access on plain object literals,
which inherit from `Object.prototype`. `verbOptions?.["constructor"]` is the `Object` constructor —
truthy — so the unknown-verb short-circuit does not fire, and the next line calls `.includes()` on
a function. Reproduced against the shipped tables:

```
"vice-mcp anno constructor game.prg" -> THREW TypeError: kinds.includes is not a function
"vice-mcp anno toString game.prg"    -> THREW TypeError: function is not iterable (cannot read property Symbol(Symbol.iterator))
"vice-mcp anno __proto__ x"          -> THREW TypeError: kinds.includes is not a function
```

The `toString` case throws from `for (const flag of requiredFlags?.[verb] ?? [])` — the loop
**added this round**, so this change introduced a second crash site in a function that already had
one. `check-skill-cli-invocations.mjs` calls `checkInvocation()` bare inside its loop, so the gate
dies with a stack trace and a non-zero exit rather than the named problem message its whole
reporting path is built around.

Two things make this worth fixing rather than shrugging at. First, the module's own doc comment
promises the opposite behaviour by name: *"A verb the CLI does not have is itself a problem:
`verbOptions` IS the verb set, so an unknown key is reported by name rather than skipped."* That is
false for every inherited key. Second, this module frames skill text as untrusted input three times
in its own header ("skill content is untrusted input that is MATCHED, never executed"); a module
that says that should not have an input-derived key reaching a prototype lookup.

**Fix:** gate every table read on own-property, in one predicate so the three sites cannot drift:

```js
const own = (table, key) => (table !== null && typeof table === "object" && Object.hasOwn(table, key) ? table[key] : undefined);
...
const accepted = own(verbOptions, verb);
if (!Array.isArray(accepted)) { problems.push(`anno ${verb}: no such verb -- ...`); return problems; }
const kinds = own(positionalKinds, verb) ?? [];
for (const flag of own(requiredFlags, verb) ?? []) { ... }
```

Add a planted control for `anno constructor game.prg` asserting the "no such verb" message rather
than a throw — the existing unknown-verb test uses `export-asm`, an ordinary name that never
touches this path.

### WR-20 (NEW): the new `--help` capture spawns bare `"node"`, not `process.execPath`, against ~25 sibling call sites that do

**File:** `src/mcp/vice/anno-cli-path-consumers.test.ts:340`

**Issue:**

```ts
const result = spawnSync("node", [VICE_PROXY_PATH, "anno", "--help"], { ... });
```

A census of every `spawnSync`/`execFileSync` of a Node child in this tree finds 25 sites using
`process.execPath` and exactly two using bare `"node"` — `anno-cli.test.ts:134` (pre-existing) and
this one, added this round. `scripts/check-skill-cli-invocations.mjs:66` — a file this same round
edited — uses `process.execPath`.

The consequence is specific rather than theoretical. This `before()` hook's own comment calls
`--help` "the declaration of record" for the two new positional-direction assertions, and its
assertion message says those directions "have no declaration of record without it". The shipped
server has no build step and runs `.ts` through Node's native type-stripping, so it requires Node
>= 22.18 (`package.json:81-83`). Whenever the Node that `npm test` runs under is not the first `node`
on `PATH` — an `nvm`/`fnm`/`volta` shell, a CI matrix job, a `sudo`-elevated run, a Debian box
where `/usr/bin/node` is 20 — the child either fails to parse the TypeScript or is a different
runtime entirely, and both new tests fail for a reason that has nothing to do with the property
under test. `PATH` resolution also makes the child's identity attacker-influenceable in a way
`process.execPath` is not.

**Fix:** one token, matching every other site in the tree:

```ts
const result = spawnSync(process.execPath, [VICE_PROXY_PATH, "anno", "--help"], { ... });
```

`anno-cli.test.ts:134` should move in the same commit — it is the only other site, and leaving one
behind is what made this one look like a precedent.

### WR-21 (NEW): the corrected `coverage` USAGE contradicts itself within three lines about how `<image>` is dispatched

**File:** `src/mcp/vice/anno-cli.ts:165-172`; the code it describes is
`src/mcp/vice/anno-coverage.ts:2217-2232`

**Issue:** 29-20's charter was that no comment asserts a guarantee the code does not provide. The
replacement text asserts one:

```
      <image> is dispatched BY EXTENSION FIRST and never by byte length.
      Three forms are read: a .prg (its first two bytes are the load
      address); a .raw or .bin flat capture; and a file of any other
      extension that is exactly 65536 bytes, read as a flat capture.
```

The third form **is** a byte-length dispatch — `if (ext !== ".prg" && bytes.length === 65536)` at
`anno-coverage.ts:2222` — so the sentence is refuted by the sentence after it. The true rule, which
`loadProjectImage()`'s own header states correctly, is narrower: *for `.raw` and `.bin` the
extension check runs before any length check*, which is what keeps `flatImageOrigin()`'s named
refusal reachable for a truncated capture (the `WR-07` incident that branch order encodes). A reader
who takes the absolute at face value will conclude that a 65536-byte `.dat` is rejected, when it is
read as a flat capture.

Second, smaller inaccuracy in the same paragraph: the three forms are listed `.prg` first, while
the dispatch order is `.raw`/`.bin`, then the 65536-byte fallback, then `.prg`. Order is
load-bearing here — it is the whole subject of the header paragraph being paraphrased — so listing
it wrongly in the one text a `--help` caller reads is not merely cosmetic.

**Fix:** state the rule the code has, in the code's own order:

```
      <image> is dispatched IN THIS ORDER, and the order is load-bearing:
      a .raw or .bin is read as a flat capture BY EXTENSION, before any
      length check, so a truncated capture is refused by name instead of
      falling through to the .prg parser; then any non-.prg file that is
      exactly 65536 bytes is read as a flat capture; then a .prg (its first
      two bytes are the load address). The retired JSON project form is the
      trailing legacy branch, reached only when none of those matched.
```

Consider asserting the synopsis against `POSITIONAL_KINDS` and against `loadProjectImage()`'s
branch order so the two cannot drift again — `anno-cli-path-consumers.test.ts` already proves that
parsing `--help` output mechanically is cheap here.

---

_Reviewed: 2026-08-30T18:40:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Scope: the 14 files changed by gap-closure round 2, diff base `6715a75`_

---

<!--
  EVERYTHING BELOW THIS LINE IS THE 2026-08-30T14:05Z PASS OVER 96 FILES,
  PRESERVED VERBATIM. Its 17 findings (CR-01, WR-01..WR-16) are referenced by
  name across this phase's PLAN.md and SUMMARY.md files, by 29-VERIFICATION.md
  and by .planning/REQUIREMENTS.md, and are derived mechanically by
  src/mcp/vice/docs-review-disposition.test.ts. Do not renumber, delete or
  reword them. This pass's re-check of each one is the table above, recorded
  against the existing ids.
-->


# Phase 29: Code Review Report (re-review after gap closure 29-13..29-17)

**Reviewed:** 2026-08-30T14:05:00Z
**Depth:** standard
**Files Reviewed:** 96
**Status:** issues_found

## Summary

This overwrites the 2026-08-30T08:40Z review (90 files, 6 BLOCKER / 14 WARNING). Every prior
finding was re-checked against the code as it now stands, by reading the fix and — for the six
blockers and four of the behavioural warnings — by executing the shipped code.

**All six prior BLOCKERs are genuinely closed.** Not one of them is a comment-only repair:

* CR-01 — `sliceSpan()` now has the third case (`from > to`, `anno-tools.ts:1836`) and
  `dispatchDisassemble()` slices the span the caller named instead of one pre-clamped to `last`
  (`:1885-1889`). Both read verbs now reach the same `outsideImage()` from the same verdict.
* CR-02 — all six caller-supplied paths on the two verbs pass `storePathWithinWorkspace()`
  (`anno-cli.ts:383`, `:410`, `:425`, `:895-897`); `--force` is in `render-memmap`'s
  `VERB_OPTIONS`; `refuseOverwrite()` runs on the *confined* path on the non-`--check` branch.
* CR-03 — the sidecar parse failure is a digit-only offset extractor
  (`anno-memmap-render.ts:117-120`, `:412`), and 29-16 applied the same treatment to
  `anno-coverage.ts:2234-2265`'s sibling branch.
* CR-04 — all four `render-memmap` invocations name `game.annostore`; the falsified dated note is
  replaced by a correct one at `c64-program-recon/SKILL.md:271`.
* CR-05 — `loadProjectImage()` dispatches `.raw`/`.bin`/`.prg` by extension first
  (`anno-coverage.ts:2200-2235`), so the playbook's `coverage game.prg --store ...` runs.
* CR-06 — phase one recurses on `batchArgumentsFor(args, call)` (`anno-tools.ts:1371`), the same
  function phase two asks.

Prior WR-07, WR-08 and WR-10 are closed. WR-14 is closed in the two user-facing places and in both
stale cross-references; the two internal identifier renames are **deferred on a recorded decision**
and are re-raised below only as a pointer, not as a new demand. WR-13 is likewise
**deferred on record**.

`npm run test:automated` is green on this tree (2734 tests, 0 failures, 45.7 s), the new
`check-skill-cli-invocations` gate is wired into CI at `.github/workflows/ci.yml:215` and passes,
and `check-npm-packages.mjs` passes.

What did not survive scrutiny:

* **One new BLOCKER, reproduced.** `render-memmap --check` — the phase's own drift detector, and
  the only thing standing between a generated view and a hand edit — reports `drifted` for a store
  and sidecar that are byte-for-byte identical, purely because the checkout sits at a different
  absolute path. The banner it compares carries realpaths; the content digest inside that same
  banner is identical across the two runs. The gate contradicts the file's own digest.
* **Eight prior WARNINGs are untouched**, two of them re-reproduced here against the current tree
  rather than carried on the old report's word.
* **The two new CI gates each have a hole in the class they were built to close.** The invocation
  gate passes `anno coverage game.prg` with the REQUIRED `--store` omitted — a documented command
  that exits 1, which is exactly CR-05's shape. And `anno-cli-path-consumers.test.ts`, cited in
  three separate headers as the mechanism that "fails when one of them reaches a filesystem call
  without passing through the seam", is a *count* of call sites that cannot associate a call with
  an argument and does not cover positionals at all.
* **A literal NUL byte was introduced into a shipped source file this phase**, and the gate that
  documents that hazard cites its offset twice — both stale.

Every BLOCKER and every reproduced WARNING below was executed against this working tree. All probe
artifacts were removed; `git status` is unchanged from the session start.

## Critical Issues

### CR-01: `render-memmap --check` reports drift on an unmodified store whenever the absolute path differs — while the file's own digest says the content is identical

**File:** `src/mcp/vice/anno-memmap-render.ts:462-463` (banner), `:601-603` (byte comparison);
`src/mcp/vice/anno-cli.ts:383`, `:410`, `:425` (what is passed in)

**Issue:** Since plan 29-14, `cmdRenderMemmap()` passes the **realpath** returned by
`storePathWithinWorkspace()` into `renderMemoryMap()` for all three paths. The renderer writes two
of them verbatim into the generated file's banner:

```ts
lines.push(`  store: ${storePath}`);
lines.push(`  sidecar: ${provenancePath}`);
```

`checkRenderedMemoryMap()` then compares the on-disk file against a fresh render **byte for byte**
(`:601-603`). So the generated view is bound to the absolute path of the checkout that produced it,
and `--check` fails anywhere else — a different developer's clone, CI, or (directly relevant here,
per CLAUDE.md's GSD Execution Isolation section) any GSD worktree, which by construction sits at a
different absolute path from `main`.

Reproduced on this tree with an identical store and sidecar copied from `a/` to `b/`:

```
$ anno render-memmap .tmp-review/a/game.annostore --provenance .tmp-review/a/sidecar.json
render-memmap: wrote .../a/memory-map.md (1 row(s), 0 [unknown], digest 50e6c1b4...c8abe2)

$ cp -r .tmp-review/a .tmp-review/b
$ anno render-memmap .tmp-review/b/game.annostore --provenance .tmp-review/b/sidecar.json --check
render-memmap: drifted at line 3
  expected:   store: /home/.../.tmp-review/b/game.annostore
  actual:     store: /home/.../.tmp-review/a/game.annostore
```

Three things make this a blocker rather than cosmetic.

1. **The verdict is wrong, and the message names two causes neither of which happened.** USAGE
   (`anno-cli.ts:129-131`) and the shipped template (`memory-map.template.md:15-17`) both tell the
   reader drift means "either a hand edit to the rendered file **or** a store change since it was
   last rendered". Here it means neither, and nothing in the output says so.
2. **The file's own digest disagrees with the gate.** `computeRenderDigest()` covers the sorted
   store rows, the sidecar bytes and `RENDERER_VERSION` — not the paths — so both runs above
   printed `50e6c1b4...c8abe2`. A reader comparing the two banners sees the same digest beside a
   "drifted" verdict.
3. **The documented remedy makes it worse.** `memory-map.template.md:17-19` says "There is no way
   to 'fix' drift by editing the rendered file directly: the fix is always to re-run the
   generator." Doing that rewrites the committed artifact with the current machine's paths, so the
   file churns on every checkout and the *next* machine reds again. `--check` in CI is unusable for
   a committed memory map, which is the artifact it was built for.

**Fix:** make the banner path-independent — record the paths relative to the workspace root, which
is a fact about the project rather than about the machine:

```ts
// anno-memmap-render.ts, inside renderMemoryMap()
import { relative } from "node:path";
...
lines.push(`  store: ${relative(workspaceRoot, storePath)}`);
lines.push(`  sidecar: ${relative(workspaceRoot, provenancePath)}`);
```

`workspaceRoot` is already a required option on both `RenderMemoryMapOptions` and
`CheckRenderedMemoryMapOptions`, so no signature changes. Add a test that renders under root A,
re-`--check`s the same bytes under root B, and asserts `in-sync` — that property is what the
current suite does not pin, which is why this shipped. If the absolute paths are wanted for
diagnostics, print them to stderr on the write path instead of into the compared artifact.

## Warnings

### WR-01 (NEW): the new invocation gate cannot see a documented command that omits a REQUIRED flag — the same class as CR-05

**File:** `scripts/lib/anno-cli-invocations.mjs:216-251`; `scripts/check-skill-cli-invocations.mjs:75-78`

**Issue:** `checkInvocation()` checks exactly two things: every flag is in `VERB_OPTIONS`, and
every *positional*'s extension is a declared kind. It never checks that a verb's **required** flags
are present, and it never checks a **flag value**'s kind. Both verbs have a required flag
(`coverage --store` at `anno-cli.ts:872-878`, `render-memmap --provenance` at `:399-403`) and both
exit 1 without it. Reproduced: I edited `routine-queue-walker/SKILL.md:241` to read
`anno coverage game.prg` and re-ran the gate —

```
check-skill-cli-invocations: OK -- 10 documented anno CLI invocation(s) ...
```

— green, for a documented command that cannot run. That is precisely the failure the gate's own
header says it exists to catch ("a name-only floor cannot see a dead command"), reproduced one
level up. A documented `--store game.prg` would pass for the same reason: only positionals get a
kind check, never flag values.

**Fix:** declare the required set beside `POSITIONAL_KINDS` and check it, and give flag values their
own kinds map:

```js
const REQUIRED_FLAGS = Object.freeze({ coverage: ["--store"], "render-memmap": ["--provenance"] });
const FLAG_KINDS = Object.freeze({
  coverage: { "--store": [".annostore", ".store"] },
  "render-memmap": { "--provenance": [".json"], "--out": [".md"] },
});
// in checkInvocation():
for (const flag of requiredFlags?.[verb] ?? []) {
  if (!flags.some((f) => f.flag === flag)) problems.push(`anno ${verb}: ${flag} is required but was not supplied${where}`);
}
for (const { flag, value } of flags) {
  const kinds = flagKinds?.[verb]?.[flag];
  if (kinds && value && !isPlaceholder(value) && !kinds.includes(extensionOf(value))) {
    problems.push(`anno ${verb}: ${flag} value ${value} is not one of ${kinds.join(", ")}${where}`);
  }
}
```

Add a planted-violation case to `anno-cli-invocations.test.ts` for the omitted-required-flag shape;
the file's existing controls only plant a wrong extension.

### WR-02 (NEW): `anno-cli-path-consumers.test.ts`'s central assertion is a call-site COUNT, not an argument-to-seam association, and it is blind to positionals

**File:** `src/mcp/vice/anno-cli-path-consumers.test.ts:131-141`, `:229-243`, `:260-269`

**Issue:** Three separate headers (`anno-cli.ts:63-70`, `:337-343`, and this file's own `:32-42`)
name this test as the mechanism that "fails when one of [the path arguments] reaches a filesystem
call without passing through the seam". It does not do that. It does:

```ts
function seamCallCount(strippedSrc) { return strippedSrc.split("storePathWithinWorkspace(").length - 1; }
confinesAtLeast(stripped, CLI_PATH_ARGUMENTS.length)   // 6 >= 6
```

That is a count with no association. It cannot distinguish "six arguments, each confined once" (the
real state — verified, `anno-cli.ts` has exactly six call sites at `:383`, `:410`, `:425`,
`:895`, `:896`, `:897`) from "five arguments confined, one of them twice, one raw": the count is 6
in both. There is no slack today, which is what keeps it useful at all, but the property it is
credited with is not the property it checks.

Second, narrower hole: assertion 2 (`:229-243`) — the direction its own comment calls "the one that
catches the ACTUAL failure" — iterates `Object.entries(VERB_OPTIONS)`, which contains only
**flags**. A new *positional* path argument (`coverage <project>` and `render-memmap <store>` are
both positionals) is forced into `CLI_PATH_ARGUMENTS` by nothing at all: an author who adds one and
forgets the inventory entry gets a green suite and a count that still matches.

**Fix:** make the check per-argument rather than aggregate. Slice each `cmd*` function's body out of
the stripped source and require one `\w+\s*=\s*storePathWithinWorkspace\(` assignment inside that
body per inventory entry for that verb. Then extend assertion 2 to derive positionals too: the
per-verb `USAGE` synopsis already names them (`render-memmap <store>`, `coverage <project>`), so
parse the `<...>` tokens out of `USAGE` and require each to be in the inventory, exactly as flags
are derived from `VERB_OPTIONS`.

### WR-03 (NEW): `check-npm-packages.mjs`'s entire driver is behind an unasserted entry-point heuristic that fails silently

**File:** `scripts/check-npm-packages.mjs:161-171`, `:394`

**Issue:** 29-02 wrapped every assertion in the file in:

```js
const IS_ENTRY_POINT = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_ENTRY_POINT) {
  ... the whole gate ...
}
```

If that comparison is ever false when the script *is* meant to run — invoked through a symlinked
path, through an `npm`/`npx` shim that rewrites `argv[1]`, or on a platform where the realpath and
the resolved argv path differ — the process prints **nothing at all** and exits **0**. CI reads
that as a pass. A gate whose failure mode is silence is exactly the shape this repository's own
removal gate carries a non-vacuity floor against; this one has none.

It is correct today: `node scripts/check-npm-packages.mjs` passes (verified — 78 vice-mcp files, 34
installer files, 7 skills, clean). The objection is the failure mode, not the current value.

**Fix:** hoist the body into an exported `main()` and make the branch loud rather than silent:

```js
export function main() { /* the whole gate */ }
if (IS_ENTRY_POINT) main();
else if (process.argv[1] !== undefined && basename(process.argv[1]) === basename(fileURLToPath(import.meta.url))) {
  console.error("check-npm-packages: invoked as an entry point but the entry-point test failed -- refusing to exit 0 silently");
  process.exit(1);
}
```

`check-no-analyser.mjs` keeps importing `packFiles` and is unaffected.

### WR-04 (NEW): a literal NUL byte was introduced into a shipped source file, and the gate that documents the hazard cites a stale offset twice

**File:** `src/mcp/vice/anno-memmap-render.ts:315`; citations at
`scripts/check-no-analyser.mjs:65-67` and `:815`

**Issue:** `computeRenderDigest()`'s canonicalisation embeds a raw `0x00` byte in its separator
string literal rather than a `\u0000` escape sequence:

```
const canonical = JSON.stringify({ blocks, symbols, comments }) + "<a raw NUL byte>" + sidecarBytes + "<a raw NUL byte>" + RENDERER_VERSION;
```

The file did not exist at the diff base (`git show <base>:...anno-memmap-render.ts` -> does not
exist), so this is new in this phase. The consequence is documented in this repo's own memory and
in the removal gate's own header: GNU `grep` classifies the whole file as binary and silently skips
it under `grep -c`/`grep -o` unless `-a` is passed, and that has already produced one wrong
decision here. A `\u0000` escape produces a byte-identical digest input with none of that.

The two citations of the byte are both **stale**: they say "offset 12862 (line 291)". Measured now:
byte 15074, line 315. `removal-gate.test.ts:234-243` asserts only that *some* NUL is present, so
nothing catches the drift — a reader following either citation lands in unrelated code.

**Fix:** replace the raw byte with the escape and name why, in a constant so there is one spelling:

```ts
// A field separator written as an ESCAPE, never a raw byte: a raw NUL makes this whole file
// binary to grep, and a grep-backed census then silently skips it.
const DIGEST_FIELD_SEPARATOR = "\u0000";
const canonical = JSON.stringify({ blocks, symbols, comments }) + DIGEST_FIELD_SEPARATOR + sidecarBytes + DIGEST_FIELD_SEPARATOR + RENDERER_VERSION;
```

The digest input is byte-identical, so no fixture or pin moves. Then delete both stale offsets from
`check-no-analyser.mjs` — with the raw byte gone the caveat is historical, and rule 4
("never shell out to grep, never skip a file that looks binary") stands on its own without a
line-number citation that has to be maintained.

### WR-05 (NEW): USAGE drifted away from the code that 29-12 and 29-16 changed

**File:** `src/mcp/vice/anno-cli.ts:125`, `:136-153`

**Issue:** `--help` is the only route by which a CLI caller learns what to pass, and three of its
statements are now wrong or incomplete:

* `:125` — "writes --out (default: **memory-map.md beside the project**)". The code computes
  `join(dirname(storePath), "memory-map.md")` (`:425`) — beside the **store**. "The project" is the
  pre-29-12 vocabulary; the verb no longer takes a project.
* `:136-138` — `coverage <project> ... <project> supplies the PAYLOAD BYTES and the load origin`.
  After 29-16 the positional is an **image**: `.prg`, or an exactly-65536-byte `.raw`/`.bin`
  (`anno-coverage.ts:2218-2231`). USAGE names none of those forms, so a user reading `--help`
  cannot discover the input the shipped playbook now uses — while
  `check-skill-cli-invocations.mjs:75-78` pins exactly those three extensions as the only ones a
  playbook may document. Plan 29-16's own stated deliverable was to change "the playbook **and
  USAGE**"; only the playbook moved.
* `:150-152` — "Exits non-zero ONLY for a caller error or a store it could not read". It also exits
  1 on an undecodable payload (`:961-966`), which `cmdCoverage()`'s own doc comment names and USAGE
  does not.

**Fix:** re-spell the synopsis as `coverage <image> --store FILE ...`, name the three accepted image
forms in the body, change "beside the project" to "beside the store", and add the payload-decode
failure to the exit-code sentence. Consider asserting the synopsis against `POSITIONAL_KINDS` so
the two cannot drift again.

### WR-06 (STILL OPEN — was WR-03): `search_*` flags accept any non-`false` value, so the string `"false"` silently enables a corpus

**File:** `src/mcp/vice/anno-derive.ts:459-462`; `src/mcp/vice/anno-tools.ts:1254-1259`

**Issue:** Unchanged. `corpusEnabled()` is still `flag !== false`, and `assertSearchArgs()` still
validates only `store`, `image`, `query` and `max_results`. Every other argument family on this
surface has a validator (`assertMaxResults`, `assertBaseRevisionArg`, `assertGetBlocksArgs`'s
`include` membership check) and these three do not. `vice-proxy.ts`'s `validate: (value) => ({
value })` enforces nothing, so a JSON string where a boolean was meant — one of the most common LLM
argument errors — reverses the caller's intent with no refusal.

**Fix:** as previously stated, add to `assertSearchArgs()`:

```ts
for (const key of ["search_labels", "search_comments", "search_instructions"] as const) {
  const raw = argBag(args)[key];
  if (raw !== undefined && typeof raw !== "boolean") {
    refuseArg("anno_search", key, `"${key}" must be a boolean, got ${JSON.stringify(raw)} -- a string "false" would ENABLE the corpus.`, batchIndex);
  }
}
```

### WR-07 (STILL OPEN — was WR-06): `corpora.<name>.entries` means two different things depending on which corpus was disabled

**File:** `src/mcp/vice/anno-derive.ts:543-570`

**Issue:** Unchanged. `labelHits`/`commentHits` are built unconditionally (`:543`, `:548`), so a
disabled labels or comments corpus still reports its true size; `instructionHits` is `[]` when
disabled (`:565`), so a disabled instruction corpus reports `entries: 0`. The verb's description
promises every corpus is named with the number of entries it held, which is false for exactly one
of the three.

**Fix:** report `entries: null` for any corpus with `searched: false`, matching the
`{available:false, reason}` discipline the rest of this surface uses, so an unmeasured size is
distinguishable from a measured zero.

### WR-08 (STILL OPEN — was WR-01): `unique(address, bank)` enforces nothing for the rows this code writes

**File:** `src/mcp/vice/anno-store.ts:290-295`, `:3327-3341`

**Issue:** Unchanged. SQLite treats NULLs as distinct in a UNIQUE index, and every row
`applyEnumUsage()` writes has `bank = null` (`:3340`), so `unique(address, bank)` never fires. The
comment at `:3332-3334` cites that constraint by name as the reason "ONE ADDRESS CARRIES AT MOST
ONE ENUM". The invariant actually rests entirely on the select-then-update at `:3327-3338`, which
holds single-process inside `applyWrite`'s transaction but has no database-level backstop.

**Fix:** either make the invariant real —
`create unique index anno_enum_usage_addr on anno_enum_usage(address, ifnull(bank, -1));` — or
correct the comment to say the invariant is upheld by the guarded write path alone and that the
declared constraint is inert while `bank` is null.

### WR-09 (STILL OPEN — was WR-02): `references anno_enum(id)` is inert and `listEnumUsage()`'s inner join hides the consequence

**File:** `src/mcp/vice/anno-store.ts:293`, `:3389-3403`

**Issue:** Unchanged. SQLite enforces no foreign key without `pragma foreign_keys = ON`, which this
module deliberately never sets. `listEnumUsage()` uses `join anno_enum e on e.id = u.enum_id`, so a
usage row whose enum is missing vanishes from the listing rather than being reported — a shorter
list than the store holds, with nothing saying so.

**Fix:** `left join` plus `{ enumName: null, unresolved: true }`, or an explicit
`AnnoStoreCorruptError` for an unresolved row. Note the FK's inertness in the DDL comment either
way.

### WR-10 (STILL OPEN — was WR-04): four structural collections are returned whole, ungoverned by `max_results`, in a family that is not chunked

**File:** `src/mcp/vice/anno-tools.ts:1626`, `:1665-1667`, `:1679`, `:1690`, `:1706`

**Issue:** Unchanged. `dispatchScope` returns `scopes: listScopes(handle)`;
`dispatchCreateProjectEnum`/`dispatchUpdateProjectEnum` return `enums: listProjectEnums(handle)`;
`dispatchApplyEnumUsage` returns `enum_usage: listEnumUsage(handle)`; and `anno_get_blocks`'s
`include` returns all three whole. `anno_enum_usage` is address-keyed and can hold 65,536 rows. The
file's own cap comment (`:1100-1120`) states that nothing in this family is chunked and "the cap is
the only bound there is". A batch applying enum usage across a table returns a linearly growing
list on every entry.

**Fix:** bound the echo-backs (return a count plus the affected row, not the whole table) and give
`include`'s collections an explicit ceiling with a `truncated` flag, matching the
`returned`/`matched`/`truncated` shape the list verbs already use.

### WR-11 (STILL OPEN — was WR-05): `store` and `image` are documented as "workspace-relative" but resolve against `process.cwd()`

**File:** `src/mcp/vice/anno-tools.ts:407-426`; `src/mcp/vice/anno-types.ts:1080-1081`, `:1192-1202`

**Issue:** Unchanged. `realpathOfNearestExisting()` opens with `resolve(p)`, which is relative to
the **process working directory**, and only then is the result confined against `repoRoot()`. The
MCP server's CWD is whatever Claude Code launched it in; `repo-root.ts` has a four-step fallback
ladder that does not start at CWD. It fails safe — a mis-resolved path is refused rather than
silently accepted — but the refusal names a path the caller never typed, which is hard to diagnose.

**Fix:** resolve a relative argument against the workspace root explicitly, or correct both schema
descriptions to "absolute, or relative to the server's working directory".

### WR-12 (STILL OPEN — was WR-11): the inode guard compares `ino` without `dev`

**File:** `src/mcp/vice/anno-tools.ts:1513-1533`

**Issue:** Unchanged. `assertStorePresent()` returns `statSync(storePath).ino` and
`assertSameFile()` compares that single number. Inode numbers are unique only per filesystem, so a
swap to a same-numbered inode on a different device — a bind mount or tmpfs overlay, the exact
shape this repo's architecture is built around — passes the guard the comment calls "closes the
window between the existence check and the open".

**Fix:** capture and compare `{ dev, ino }`. One extra field; the two call sites are adjacent.

### WR-13 (STILL OPEN — was WR-12, reproduced): `parsePrg()` accepts a load address whose payload runs past `$FFFF`, and the overflow now reaches two surfaces

**File:** `src/mcp/vice/prg-image.ts:87-97`; `src/mcp/vice/anno-tools.ts:1852-1861`, `:1877`;
`src/mcp/vice/anno-coverage.ts:2226-2231`

**Issue:** Unchanged, and reproduced against this tree with a `.prg` carrying load address `$FF00`
and a 1024-byte payload:

```
anno_get_binary_info -> {"kind":"prg","origin":65280,"body_bytes":1024,"last_address":66303,...}
anno_read_region     -> "...loads at $ff00 and ends at $102ff..."
anno_disassemble { address: "0x10000" } -> [AnnoAddressError] 65536 is out of range -- expected 0..65535
```

`last_address: 66303` and the five-hex-digit `$102ff` are outside the 6510's address space and are
returned as successful answers, while `parseStoreAddress()` refuses any such value everywhere else
on the same surface — so a caller who reads `last_address` and feeds it back is refused by the tool
that just produced it. 29-16 gave `parsePrg()` a **second** consumer
(`anno-coverage.ts`'s `loadProjectImage()`), so the same unvalidated origin now also seeds the byte
census's address arithmetic on the CLI route.

**Fix:** refuse in `parsePrg()`, in the same shape as its existing length refusal, so both loaders
inherit it:

```ts
if (origin + (bytes.length - 2) - 1 > 0xffff) {
  throw new Error(
    `parsePrg: load address $${origin.toString(16)} plus ${bytes.length - 2} payload byte(s) runs past $ffff -- ` +
      "a .prg that does not fit the 6510's address space is refused by name rather than reported with a five-digit address",
  );
}
```

Both `loadImage()` and `loadProjectImage()` already wrap `parsePrg()`'s throw into their own named
refusal, so no call site changes.

### WR-14 (STILL OPEN — was WR-09): five shipped modules have no production consumer, and one has no consumer at all

**File:** `src/mcp/vice/package.json:51-73`

**Issue:** Unchanged, and re-measured on this tree by scanning every `.ts`/`.mts` importer:

| module | importers |
|---|---|
| `anno-symbols.ts` | **none — not even a test** |
| `anno-d64.ts` | `anno-d64.test.ts` only |
| `anno-enum-gen.ts` | `anno-enum-gen.test.ts` only |
| `anno-regbits-gen.ts` | `anno-enum-gen.ts` (itself orphaned) + `anno-regbits.test.ts` |
| `anno-register.ts` | `anno-derivation.test.ts`, `anno-register.test.ts` |
| `anno-acme-ident.ts` | reached only through the two orphans above |

All six are in `files[]` and ship in `@henols/vice-mcp`. `check-npm-packages.mjs` asserts only that
every *reachable* module is listed, never the converse, so nothing catches this.
`anno-seam.test.ts` and `shipped-modules.ts` derive their scan sets from `files[]`, so unreachable
modules dilute those guards.

**Fix:** decide per module and record it. If Phase 30 rebuilds `gen-enums`/`export-lbl`/`import-lbl`
over the store (as `.planning/REQUIREMENTS.md:73` and `scripts/lib/anno-cli-verbs.mjs` both say it
will), add a dated retention note naming Phase 30 and the requirement ids — the same shape
`prg-image.ts:30-50` now uses for its own reachability claim. Otherwise remove them from `files[]`
and from the tree. `anno-symbols.ts`, with zero importers including tests, needs an answer either
way.

### WR-15 (DEFERRED ON RECORD — was WR-13): the removal gate's `exemptionFor()` short-circuits

**File:** `scripts/check-no-analyser.mjs:773-797`

**Issue:** Still present and **deliberately deferred on a recorded decision** — raised here as a
pointer only, not as a new demand. For a path in a `blockScoped` or `skillBlocks` class, an
occurrence outside a block `return null`s immediately (`:789`, `:793`), aborting the loop over the
remaining `EXEMPTION_CLASSES`; the `atLines` branch immediately above correctly `continue`s
(`:784`). Correct today only because those two classes are last in the array.

**Fix (when the deferral is lifted):** `continue` instead of `return null`, letting the final
`return null` after the loop be the only "no class covers this" answer.

### WR-16 (PARTIALLY CLOSED, REMAINDER DEFERRED ON RECORD — was WR-14): the retired vocabulary survives in two internal identifiers

**File:** `src/mcp/vice/anno-cli.ts:866`; `src/mcp/vice/vice-proxy.ts:300`, `:307`

**Issue:** Plan 29-16 closed the user-facing half — both `anno:` message prefixes are now `anno:`
(`anno-cli.ts:1017`, `:1026`), `anno-cli-verbs.mjs`'s stale `extractedAnno`/floor cross-reference
is repaired, and `check-npm-packages.mjs:235-251` is marked explicitly past-tense with the
pre-deletion names. What remains is **deferred on a recorded decision**
(`<wr14_scope_decision>`): the exported entry point is still `runAnnoCli` and the test hatch is
still `VICE_TEST_ANNO_CLI_STDOUT_FILL_BYTES`. Noted so the deferral stays visible rather than
becoming invisible, not re-litigated.

**Fix (when the deferral is lifted):** rename both together with their two consumers
(`vice-proxy.ts:307`, `vice-proxy.test.ts`), in one commit.

---

_Reviewed: 2026-08-30T14:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
