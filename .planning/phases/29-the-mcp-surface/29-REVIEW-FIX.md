---
phase: 29-the-mcp-surface
fixed_at: 2026-08-30T20:10:00Z
review_path: .planning/phases/29-the-mcp-surface/29-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 4
skipped: 1
status: partial
---

# Phase 29: Code Review Fix Report — the five findings new in the 18:40Z pass

**Fixed at:** 2026-08-30
**Source review:** `.planning/phases/29-the-mcp-surface/29-REVIEW.md`
**Base commit:** `9cb8217`
**Iteration:** 1

## Scope of this report — read this before the counts

`29-REVIEW.md`'s frontmatter carries the **cumulative** ledger for phase 29 (1 critical + 21
warnings = 22). This report covers only the **five findings the 2026-08-30T18:40Z pass newly
raised** — `WR-17` through `WR-21`. The other seventeen (`CR-01`, `WR-01`..`WR-16`) come from the
14:05Z pass, are dispositioned already in the phase's own SUMMARY and VERIFICATION documents, and
are untouched here; `18:40Z`'s re-check table records their status against their existing ids and
is the disposition for that half.

**Summary:**
- Findings in scope: 5 (`WR-17`..`WR-21`; all warnings, no new blockers)
- Fixed: 4 — `WR-18`, `WR-19`, `WR-20`, `WR-21`
- Considered and deferred, not fixed: 1 — `WR-17`

`WR-17` is recorded below as **deferred with reasoning**, not as fixed. Nothing in this round
touched `RENDERER_VERSION`, `computeRenderDigest()` or either playbook text.

## Gate results

Every command below was run from `src/mcp/vice` on the final tree, in the **main checkout** (not a
worktree — this run was explicitly directed to work on `main` in the primary checkout, so the
numbers are reproducible from the tree you are reading).

| gate | result |
|---|---|
| `npm run typecheck` | exit 0, no diagnostics |
| `npm run test:automated` | **2771 tests / 2765 pass / 0 fail** / 1 skipped / 5 todo |
| `node --test docs-review-disposition.test.ts` | 7/7 pass |
| `node scripts/check-skill-cli-invocations.mjs` | OK — 10 invocations, 2 verbs |
| `node scripts/check-npm-packages.mjs` | OK — 78 vice-mcp files, 34 installer files, 7 skills |
| `git diff --diff-filter=D --name-only 9cb8217..HEAD` | empty — no tracked file deleted |

**Reconciling the test-count delta, rather than asserting it.** The baseline on `9cb8217` measured
here was **2752 tests / 2744 pass / 2 fail** — not the 2752/2746/0 the task brief quoted. The two
pre-existing failures were `docs-review-disposition.test.ts`'s AUDIT-01 assertion, naming exactly
`WR-17, WR-18, WR-19, WR-20, WR-21` as undispositioned, and `audit-integrity.test.ts`'s D-12-02
assertion, which fails **because** a docs guard is red while five milestone audits declare a gated
status. The second is therefore downstream of the first, not an independent defect: this file
clears both.

The count moved `2752 -> 2771`, **+19 tests, all added by this round**:

| file | delta | what was added |
|---|---|---|
| `anno-cli-invocations.test.ts` | 25 -> 41 (+16) | 6 `WR-19` controls, 7 `WR-18` controls, and 3 structural/ordering tests (`FLAG_KINDS` non-vacuity, the two new problem kinds' order, `PROBLEM_ORDER` reachability) |
| `anno-cli.test.ts` | 58 -> 60 (+2) | the two `WR-21` drift guards |
| `anno-cli-path-consumers.test.ts` | +1 | the `WR-20` bare-`"node"` census guard |

`2744 pass + 19 new + 2 previously-failing now green = 2765`. No pre-existing test was deleted,
disabled or weakened; four were **adjusted**, each named in its own section below.

## Fixed Issues

### WR-19: an `Object.prototype` key in the verb slot crashed the CI gate with an unhandled `TypeError`

**Files modified:** `scripts/lib/anno-cli-invocations.mjs`, `scripts/check-skill-cli-invocations.mjs`,
`src/mcp/vice/anno-cli-invocations.test.ts`
**Commit:** `061a669`

**Reproduced at `9cb8217` before fixing**, against the shipped tables:

```
"anno constructor game.prg"            -> THREW TypeError: kinds.includes is not a function
"anno toString game.prg"               -> THREW TypeError: function is not iterable
"anno __proto__ x"                     -> THREW TypeError: kinds.includes is not a function
"anno hasOwnProperty game.prg --force" -> THREW TypeError: accepted.includes is not a function
"anno nosuchverb game.prg"             -> ["anno nosuchverb: no such verb -- ..."]   # correct
```

The last line is the discrimination that pins the diagnosis: a genuine unknown verb refused
correctly throughout, so the defect is specifically **prototype inheritance**, not unhandled unknown
verbs.

**Applied fix.** One `own(table, key)` predicate — `table !== null && typeof table === "object" &&
Object.hasOwn(table, key) ? table[key] : undefined` — at **all three** verb-keyed reads in
`checkInvocation()`: `verbOptions` (the flag-membership read), `positionalKinds` (the
positional-kind read) and `requiredFlags` (the required-flag read, which is the loop 29-19 added
this round — a second crash site in a function that already had one). The verb read additionally
tightened from `if (!accepted)` to `if (!Array.isArray(accepted))`.

Hardening only the verb lookup would have left the finding armed one table over, which the brief
called out and which the last control below proves is not the case: it hands the predicate a verb
that the OPTION table declares, so the other two reads are the ones actually under test rather than
short-circuited at the first table.

`check-skill-cli-invocations.mjs` additionally wraps the call in a try/catch as **defence in depth,
not as the fix** — the finding's own complaint is that the gate died with a stack trace instead of
the named problem message its whole reporting path is built around, so a future unhardened read now
fails as a reported problem naming the file and the invocation.

**Controls, observed RED before green:** six added; the run before the fix was **26 pass / 5 fail**,
after it **31 pass / 0 fail**. One control per crash site (positional-kind, required-flag,
flag-membership), one over every inherited key asserting the unknown-verb short-circuit, one
discrimination control asserting an ordinary unknown verb and a real verb are both unaffected
(green throughout — it is the control, not the plant), and the two-other-tables control described
above.

### WR-18: the gate reported OK for four documented commands that exit 1

**Files modified:** `scripts/lib/anno-cli-invocations.mjs`, `scripts/lib/anno-cli-invocations.d.mts`,
`scripts/check-skill-cli-invocations.mjs`, `src/mcp/vice/anno-cli-invocations.test.ts`
**Commit:** `f431733`

**Reproduced at `9cb8217`** — all four returned `[]`:

```
"anno coverage game.prg --store game.prg"                       -> []
"anno coverage game.prg --store"                                -> []
"anno render-memmap game.annostore --provenance game.annostore" -> []
"anno render-memmap game.annostore --provenance"                -> []
```

**Applied fix.** `FLAG_KINDS` now lives in the same **import-safe lib** as `POSITIONAL_KINDS` and
`REQUIRED_FLAGS`, so the committed test and CI share one definition. It is deliberately **not** a
private fixture copy in the test — that is the exact asymmetry plan 29-19 removed, and the
structural test that forbids the gate re-declaring a table locally was extended to cover
`FLAG_KINDS` too.

Every entry is grounded in the code it mirrors rather than guessed, in the discipline
`REQUIRED_FLAGS` already sets:

| entry | grounded in |
|---|---|
| `coverage --store` -> `.annostore`, `.store` | `openStore()`; the same artefact as `POSITIONAL_KINDS["render-memmap"]`, reached through a different slot. Like that entry it pins the shipped CONVENTION — `openStore()` enforces no extension — and its job is to catch a different ARTEFACT KIND in the store slot |
| `coverage --out` -> `.json` | `writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n")` in `anno-cli.ts` |
| `render-memmap --provenance` -> `.json` | the sidecar is JSON-parsed; a non-JSON file exits 1 |
| `render-memmap --out` -> `.md` | the verb's own derived default, `join(dirname(storePath), "memory-map.md")` |

The two absences are deliberate and named in the table's own comment: `--force`/`--check` are
boolean, and `--sample N` takes an integer, not a path.

`checkInvocation()` gained a fifth, **non-optional** `flagKinds` parameter. The `.d.mts` claim that
this is a gate rather than a hope was **verified, not asserted**: declaring the parameter there and
nowhere else emitted `TS2554: Expected 5 arguments, but got 4` at all five call sites. Two checks
were added:

* **check 4 — a value-taking flag documented with no value.** The value-taking set is *derived*
  (a flag with declared kinds, or a required flag) rather than a fourth table. It deliberately
  covers non-required `--out`, which also exits 1 without a value (`coverage: --out requires a
  value`) — being optional to *supply* is not being optional to give a value to once supplied. This
  is slightly wider than the review's proposed fix, which scoped the check to required flags only.
* **check 5 — a flag value whose extension is not one that flag reads.** This is the positional
  check bound to the *argument* instead of to the *slot*, which is what made CR-04's mistake
  invisible one token to the right.

`PROBLEM_ORDER` gained `flag-value-missing` and `flag-value-kind`, **appended** so an existing
failure's reported order is unchanged by their arrival. The module's "two things it still does not
check" list was re-scoped: it previously illustrated the flag-value gap with the harmless
`--sample abc` while a fatal `--store game.prg` was equally unchecked, which is what let the gap
read as deliberate. It now names each residual with the case where being unchecked actually matters
(`--sample abc` is a dead command this gate still cannot see; so is
`coverage a.prg b.prg --store s.annostore`, the arity case).

**Controls, observed RED before green:** the four defect shapes were added first and failed
(**34 pass / 4 fail**), then went green. Three further controls — the correctly-spelled positive
siblings, the synopsis-placeholder case (`--store FILE` must still pass) and the boolean-flag case
(`--force`/`--check` with no value must not be reported) — were **green throughout**, which is what
shows the new checks do not accuse a correct playbook. Added alongside: a `FLAG_KINDS` non-vacuity
test mirroring `REQUIRED_FLAGS`' (every `VERB_OPTIONS` verb has an entry; every flag named is one
the verb accepts; every required flag has a kinds entry), an ordering test for the two new kinds,
and a `PROBLEM_ORDER` **reachability** test so a kind cannot be declared with no check behind it.

**Two pre-existing tests were adjusted, and why.** `the checker reads the CLI's OWN option set`
built its line by giving every flag the value token `x`; with check 5 in place `--store x` is now
refused for a different and *correct* reason, which would have made the test pass or fail for the
wrong cause. It now derives each flag's value from `FLAG_KINDS` itself. `multiple problems are
reported in the declared order` compared its three observed kinds against
`PROBLEM_ORDER.filter(...)` as a whole; since no single invocation can carry all five kinds at once
(a required flag cannot be simultaneously missing and valueless), that assertion was split into an
exact expected list plus a **subsequence-of-the-declared-order** check, which keeps the original
property — a control-flow reorder that does not move `PROBLEM_ORDER` still fails — and is joined by
a second ordering test covering the two new kinds.

### WR-21: the `coverage` USAGE contradicted itself about how `<image>` is dispatched

**Files modified:** `src/mcp/vice/anno-cli.ts`, `src/mcp/vice/anno-cli.test.ts`,
`src/mcp/vice/module-classification.ts`
**Commit:** `b280da3`

**The dispatch order was read off the code, not guessed** — `loadProjectImage()` in
`src/mcp/vice/anno-coverage.ts`:

```
1. ext === ".raw" || ext === ".bin"          -> flat capture, BY EXTENSION
2. ext !== ".prg" && bytes.length === 65536  -> flat capture, BY LENGTH
3. ext === ".prg"                            -> load address + payload
4. the retired JSON project form             (fallthrough, reached only when none matched)
```

**Applied fix.** USAGE now states that order, in that order; says which single branch *does*
dispatch on byte length instead of denying that any does; and keeps on screen the reason the order
is load-bearing — running the extension check before any length check is what keeps
`flatImageOrigin()`'s named refusal reachable for a truncated capture, the WR-07 incident. **No
specificity was deleted** to resolve the contradiction: the 65536-byte branch and the legacy JSON
branch are both still named.

**Two guards added** so the two cannot drift apart again silently. The first extracts the order the
shipped `--help` text names the forms in and the order `loadProjectImage()`'s own source branches on,
and asserts they match — comparing **order, not wording**, so it does not fight a future edit, and
failing by name if either pattern stops matching rather than silently comparing two shorter lists.
The second asserts the false absolute (`never by byte length`) is absent **while** asserting `65536`
and the load-bearing-order sentence are still present, so deleting the specificity cannot satisfy
it. Both were verified non-vacuous against the pre-fix text: all three usage patterns absent
(`search()` returned `-1` for each), and `never by byte length` present at offset 10614.

**One collateral repair.** The USAGE edit added four lines, drifting
`module-classification.ts`'s citation of `checkAcceptedOptions` from `anno-cli.ts:234` to `:238`.
That module's own Direction 9b guard caught it; the citation was corrected in the same commit.

### WR-20: the new `--help` capture spawned a bare `"node"`

**Files modified:** `src/mcp/vice/anno-cli-path-consumers.test.ts`, `src/mcp/vice/anno-cli.test.ts`
**Commit:** `276a86b`

**Applied fix.** `spawnSync("node", ...)` -> `spawnSync(process.execPath, ...)` at
`anno-cli-path-consumers.test.ts:340`.

**`anno-cli.test.ts:134` is genuinely the same defect and was fixed in the same commit.** Asked to
judge rather than assume: it is the same call shape (`spawnSync` with a bare `"node"` as the first
argument), starting the same child (the shipped `vice-proxy.ts` TypeScript entry point), with the
same consequence — the server has no build step and runs `.ts` through Node's native type-stripping,
so it requires Node >= 22.18, and a PATH-resolved `node` need not be a runtime that can start it at
all. The only difference is age: this one is pre-existing rather than added this round, which is
precisely what made the new one look like it had a precedent. A census confirmed the review's
figure: **27** sites in this tree pass `process.execPath` and exactly **two** passed `"node"` — both
now fixed, none left.

**One guard added** so the tree stays uniform: a source scan of every `.ts`/`.mts`/`.mjs` under
`src/mcp/vice/` and `scripts/` for a spawn whose **first argument** is the literal `"node"`. Scoped
to the first argument on purpose — the playbooks' documented `node <plugin-root>/...` invocation
*string* is not a spawn and must keep passing, which was verified along with both offending shapes
matching. The guard carries a non-vacuity floor on the number of files scanned, so a scan that found
nothing to read cannot report a clean tree.

## Considered and Deferred — NOT fixed

### WR-17: the renderer's output shape changed and `RENDERER_VERSION` was not bumped

**Files that would change:** `src/mcp/vice/anno-memmap-render.ts` (the constant and its doc block),
`src/skills/c64-program-recon/SKILL.md:276-280`,
`src/skills/c64-program-recon/templates/memory-map.template.md:30-34`
**Commit:** none — **nothing was touched**. `RENDERER_VERSION` is still `"3"`,
`computeRenderDigest()` is unchanged, and both playbook texts are unchanged.

**Status: considered and deferred. The decision belongs to the phase verifier or the project owner,
not to this fix pass.**

**The reviewer's argument.** `RENDERER_VERSION`'s own doc comment states the rule: it is "bumped
whenever this renderer's OUTPUT SHAPE **or its digest's canonical INPUT** changes, so a re-render
under a new renderer version is distinguishable from drift under the same one." Plan 29-18 changed
the output shape substantially — `store:`/`sidecar:` moved from absolute to workspace-relative
spellings and the trailing banner prose grew — and left the constant at `"3"`. Because
`computeRenderDigest()` covers only the store rows, the sidecar bytes and `RENDERER_VERSION`, none
of which moved, every already-rendered `memory-map.md` re-renders to the **same 64-hex
`render_digest` with different surrounding bytes**. `--check` then reports `drifted at line 3`, and
a reader comparing the two banners sees an identical digest beside a "drifted" verdict — which is
`CR-01`'s own contradiction ("the file's own digest disagrees with the gate") replayed by the change
that closed it, for every consuming project that upgrades, using none of the mechanism built to
distinguish the two cases.

**29-18's stated reasoning, quoted from its SUMMARY** (`29-18-SUMMARY.md:38`, restated at `:265`):

> "`RENDERER_VERSION` stays at \"3\": no digest input moved, and bumping would bury a one-line banner
> correction inside a digest change in every previously rendered file"

This is a *deliberate, recorded* decision, not an oversight. It reads the constant's doc rule as
governing the **digest's canonical input** (which genuinely did not move) and weighs a wider blast
radius — a changed digest in every consuming project's file — against a narrower one. The plan also
carries a `<renderer_version_decision>` element and handed the consequence forward explicitly, which
is how the prose in the two playbooks came to exist.

**The two prose sites that would have to change with it.** Plan 29-20 task 2 wrote the consequence
into both copy-forward texts, in both skill trees, and 29-20 was reviewed and verified:

* `src/skills/c64-program-recon/SKILL.md:276-280` — "**One-time drift after upgrading,
  2026-08-30.** … because the banner's recorded locations changed from absolute to
  workspace-relative spellings. Re-run the generator and commit the new banner."
* `src/skills/c64-program-recon/templates/memory-map.template.md:30-34` — the same note, ending
  "This is a one-time, self-clearing banner correction — not a bug, and not a migration."

Bumping the constant now would falsify prose that was written **and verified** days ago, and would
change the upgrade behaviour every consuming project sees (a differing `render_digest` on the first
`--check` after upgrade, rather than a matching one). Both would then need rewriting in the same
commit — the review itself says so ("re-point the two playbook notes at the version bump"), which
makes this a coupled three-file change to shipped behaviour and shipped documentation, not a
one-constant edit.

**Why this fix pass did not decide it.** It is a contested design decision with two defensible
readings of the same doc comment, taken deliberately once already, with a consequence documented in
shipped user-facing text and a blast radius outside this repository. Resolving it means overruling a
recorded plan decision, and that is a judgement for the phase verifier or the owner. Recording it
here as deferred keeps it visible — which is the whole point of `docs-review-disposition.test.ts` —
rather than laundering it as fixed.

**If the deferral is lifted**, the change is: bump to `"4"` with a `Version 4 (CR-01, 29-18)` entry
in the doc block beside the two existing bump records; re-point both playbook notes at the version
bump ("the banner's `render_digest` changes too, which is how you tell an upgrade from a hand
edit"); and add a test that fails when the banner lines change without the constant moving, so the
two can only move together. Note that `anno-memmap-render.test.ts` currently pins
`RENDERER_VERSION === "3"` in two places (including a source assertion matching
`/RENDERER_VERSION.{0,400}"2" -> "3"/s`), so both pins move with it.

**Reminder for whoever picks this up:** `src/mcp/vice/anno-memmap-render.ts` contains a raw NUL
byte, so a plain `grep` silently skips the file. Use `grep -a`.

---

_Fixed: 2026-08-30_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
