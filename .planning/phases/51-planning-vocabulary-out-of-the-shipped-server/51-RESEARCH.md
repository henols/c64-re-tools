# Phase 51: Planning Vocabulary Out of the Shipped Server - Research

**Researched:** 2026-09-14
**Domain:** Structural test-guard engineering (Node's native `node:test`, TypeScript
type-stripped source) applied to a self-hosted convention (ENGINEERING_RULES.md §21)
that this repo already enforces on `src/skills/**` and now extends to `src/mcp/vice/**`
and `installer/**`.
**Confidence:** HIGH for the ratchet inventory and guard anatomy (both measured live in
this checkout with the guard's own predicate); MEDIUM for the D-09 byte-budget mechanism
(reasoned from the scan's actual return shape, no prior art in this codebase); MEDIUM for
recovery-ladder cost (sampled, not exhaustive).

## Summary

This phase has no new library, no new architecture and no new runtime capability — it
widens one already-existing test guard (`skills-planning-vocabulary.test.ts`) from
`src/skills/**` to `src/mcp/vice/package.json`'s `files[]`, eight `.mts` sources that
compile into that surface, and `installer/package.json`'s `files[]`, then sweeps the
citations the wider scan finds. CONTEXT.md already locked the scan surface (D-01..D-03),
the ratchet mechanism (D-04/D-05), the family partition (D-06), the recovery ladder
(D-07/D-08), the byte-budget check (D-09) and the `UTF-16` collision (D-10). This document
supplies what CONTEXT.md could not: the actual per-file ledger a sweep plan needs to open
with, the guard's exact internals, a hard classification of the five lockstep guards, a
concrete mechanism for D-09, and a cost measurement for the recovery ladder — plus two
corrections to CONTEXT.md's own measurements that change how the planner should read its
cost model.

**Primary recommendation:** Freeze the ratchet ledger from the table in `## Ratchet
Inventory` below, re-measured with the guard's own `scanForPlanningVocabulary()` at the
moment the first sweep plan is written (not copied from this document or from CONTEXT.md
— the count moved by 4 occurrences in the few hours between CONTEXT.md's own measurement
and this research pass, purely from unrelated same-day commits). Partition sweep plans by
the six families in the order: `annotation store / CLI` → `protocol / transport` →
`broker` → `host tools` → `other` → `proxy / tool surface` (largest-to-smallest is not
required by any decision; ordering is Claude's Discretion per CONTEXT.md). Treat
`comment-phase-pointers.test.ts` as requiring an argument-and-assertion rewrite (not a
literal patch); treat `docs-dangling-refs.test.ts`, `hop-chain-comments.test.ts`,
`docs-absorbed-decisions.test.ts` and `audit-integrity.test.ts` as needing **zero**
changes — none of the last four actually pin content this phase's sweep touches (see
`## The Five Lockstep Guards`, which also corrects CONTEXT.md's framing of two of them).

## Architectural Responsibility Map

This phase has no browser/API/database tiers in the usual sense — it operates entirely
within one repository's own source-hygiene tooling. The table below maps the phase's
capabilities onto this project's own component boundaries instead.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Detect a planning-vocabulary citation in shipped source | Test-guard tier (`*.test.ts`, `node:test`) | — | `scanForPlanningVocabulary()` is pure and already lives in the guard file; no runtime component is touched |
| Enumerate the shipped scan surface | Test-guard tier, consuming `shipped-modules.ts` / `build.ts` | Package manifest (`package.json` `files[]`) | D-02 requires deriving from `HOST_BOUND_ARTIFACTS`/`files[]`, never hand-listing |
| Rewrite a citation into a stated reason | Product source (`src/mcp/vice/*.ts`, `*.mts`) | — | The edit itself lands in the shipped module, per ENGINEERING_RULES §21.2's worked pair |
| Recover what a citation meant | `.planning/` (read-only, via `git blame` / `find` / `grep`) | — | Purely an authoring-time lookup; nothing in `.planning/` is read at runtime or shipped |
| Ratchet/track sweep progress | A frozen ledger (new file or guard-adjacent data) | Test-guard tier (shrink-only + reach-empty assertions) | D-04/D-05: temporary scaffolding, not a runtime concern |
| Gate CI on the widened result | `npm run test:automated` (`test-gate.mjs`) | — | Already the guard's home; D-04 requires the guard be green from its first commit |

## Standard Stack

No new library, runtime, or tool is introduced by this phase. It is a pure edit-and-guard
exercise inside the existing TypeScript/`node:test` toolchain already documented in
`CLAUDE.md`. **Do not add a dependency to satisfy any part of this phase** — the scan,
the extractor, the ratchet and the byte-budget check are all achievable with `node:fs`,
`node:test`, `node:assert/strict` and plain string/regex logic, exactly like every
existing guard in this directory.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled `grep`/regex sweep across the shipped tree | The guard's own `scanForPlanningVocabulary()`, imported | A hand-rolled grep already produced a wrong figure once in this project's history (per the research brief); the guard's predicate is the one the CI gate itself runs, so measuring with anything else risks a ledger that doesn't match what `npm test` actually asserts |
| A new npm package for AST-aware comment stripping (e.g. a TS parser) to make the D-09 byte-budget check more precise | The character-state-machine extractor already duplicated three times in this directory (`comment-phase-pointers.test.ts`, `hop-chain-comments.test.ts`, `shipped-modules.ts`'s `codeOnly()`) | Out of scope per this milestone's own Out-of-Scope table ("New npm runtime dependencies... A new dependency here would be the first in two milestones and needs its own decision") — reuse the existing extractor family instead |

## Package Legitimacy Audit

**Not applicable.** This phase installs no external package in any ecosystem. Nothing to
audit.

## Ratchet Inventory (D-04 input — measure again before freezing)

Measured 2026-09-14 with `scanForPlanningVocabulary()` **imported directly** from
`src/mcp/vice/skills-planning-vocabulary.test.ts` (not hand-rolled), driven over:

1. Every `src/mcp/vice/package.json` `files[]` entry, directories expanded, filtered to
   the guard's own `TEXT_EXTENSIONS` (`.md .mjs .js .ts .mts .json .a .asm .txt`) —
   **98 scannable files** (89 `files[]` entries, one of which — `resources` — expands to
   10 generated `.mjs` files; `resources/vice-launcher.sh` is present on disk but excluded
   by extension, which is why the true count is 98, not the 99 CONTEXT.md's
   `<canonical_refs>` states — see `## Corrections` below).
2. The eight `.mts` sources D-01 adds (`host-tool.mts`, `broker-launch.mts`,
   `vice-broker.mts`, `ghidra-project.mts`, `broker-control.mts`, `broker-epoch.mts`,
   `broker-kill.mts`, `broker-state.mts`) — read from `build.ts`'s exported
   `HOST_BOUND_ARTIFACTS` (10 entries total; `container-guard.mts` and
   `backend-detect.mts` are excluded from this list because they are already counted in
   (1), being present in `files[]` directly).
3. `installer/package.json` `files[]`, directories expanded — 40 scannable files.

**Grand total: 3184 hand-edit sites across 93 dirty files**, of which 3180/92 are in
`src/mcp/vice` (files[] non-generated + the 8 extra `.mts`) and 4/1 are
`installer/bin/cli.mjs`. CONTEXT.md's own count (3188) was measured a few hours earlier
the same day; four sites were cleared by unrelated commits (`fix(quick-260914-9n4)` at
07:21–07:39) in the interval. **This confirms the count is not stable even within one
day — re-run the measurement immediately before writing the ledger, do not copy this
table's numbers into a committed ledger without re-measuring.**

Generated `resources/*.mjs` files (651 occurrences across the same 10 artifacts) are
**excluded from hand-edit work by design** — `build.ts` overwrites them from the `.mts`
sources on every build, and `resources-sync.test.ts` already asserts they are
byte-identical to a fresh build, so editing them directly is caught and pointless.

### Per-family, per-file table

The six families below reproduce D-06's stated totals **exactly** (935/22, 807/32,
585/7, 397/3, 315/26, 141/2) — confirmed by summing this measurement's own per-file
counts against each stated family total and file count. D-06 did not publish per-file
membership; the classification below is the one arrangement of files that reconciles
every one of the six totals simultaneously, which is strong (though not certificated)
evidence it is the intended partition.

#### annotation store / CLI — 935 occurrences across 22 files

| Count | File | Surface |
|---|---|---|
| 163 | `src/mcp/vice/anno-cli.ts` | files[] |
| 146 | `src/mcp/vice/anno-export-asm.ts` | files[] |
| 124 | `src/mcp/vice/anno-store.ts` | files[] |
| 85 | `src/mcp/vice/anno-tools.ts` | files[] |
| 65 | `src/mcp/vice/anno-enum-gen.ts` | files[] |
| 63 | `src/mcp/vice/anno-register.ts` | files[] |
| 51 | `src/mcp/vice/anno-coverage.ts` | files[] |
| 50 | `src/mcp/vice/anno-join.ts` | files[] |
| 49 | `src/mcp/vice/anno-types.ts` | files[] |
| 25 | `src/mcp/vice/anno-memmap-render.ts` | files[] |
| 21 | `src/mcp/vice/anno-import.ts` | files[] |
| 18 | `src/mcp/vice/anno-graphics.ts` | files[] |
| 16 | `src/mcp/vice/anno-bank.ts` | files[] |
| 13 | `src/mcp/vice/anno-regbits-gen.ts` | files[] |
| 12 | `src/mcp/vice/anno-store-export.ts` | files[] |
| 11 | `src/mcp/vice/anno-symbols.ts` | files[] |
| 6 | `src/mcp/vice/anno-index.ts` | files[] |
| 6 | `src/mcp/vice/anno-derive.ts` | files[] |
| 4 | `src/mcp/vice/anno-provenance-ledger.ts` | files[] |
| 3 | `src/mcp/vice/anno-details.ts` | files[] |
| 2 | `src/mcp/vice/anno-confidence.ts` | files[] |
| 2 | `src/mcp/vice/anno-hazard-report.ts` | files[] |

(`anno-regbits.json` and `anno-acme-ident.ts` are in `files[]`, classify into this
family by name, and scan **clean** — 0 hits, not part of the 22 dirty files above.)

#### protocol / transport — 807 occurrences across 32 files

| Count | File | Surface |
|---|---|---|
| 101 | `src/mcp/vice/stock-dispatch.ts` | files[] |
| 84 | `src/mcp/vice/stock-protocol.ts` | files[] |
| 59 | `src/mcp/vice/stock-derived.ts` | files[] |
| 49 | `src/mcp/vice/stock-diagnose.ts` | files[] |
| 43 | `src/mcp/vice/text-protocol.ts` | files[] |
| 39 | `src/mcp/vice/stock-connect.ts` | files[] |
| 31 | `src/mcp/vice/text-tools.ts` | files[] |
| 27 | `src/mcp/vice/stock-checkpoints.ts` | files[] |
| 26 | `src/mcp/vice/stock-cia.ts` | files[] |
| 23 | `src/mcp/vice/stock-execution.ts` | files[] |
| 23 | `src/mcp/vice/text-capability-probe.ts` | files[] |
| 23 | `src/mcp/vice/stock-memory-search.ts` | files[] |
| 23 | `src/mcp/vice/stock-timing.ts` | files[] |
| 23 | `src/mcp/vice/stock-run-until.ts` | files[] |
| 21 | `src/mcp/vice/stock-disassemble.ts` | files[] |
| 20 | `src/mcp/vice/stock-address.ts` | files[] |
| 20 | `src/mcp/vice/stock-memory.ts` | files[] |
| 20 | `src/mcp/vice/stock-sprites.ts` | files[] |
| 19 | `src/mcp/vice/stock-machine.ts` | files[] |
| 16 | `src/mcp/vice/stock-symbols.ts` | files[] |
| 15 | `src/mcp/vice/stock-recycle.ts` | files[] |
| 13 | `src/mcp/vice/text-connect.ts` | files[] |
| 13 | `src/mcp/vice/stock-runstate.ts` | files[] |
| 13 | `src/mcp/vice/stock-condition.ts` | files[] |
| 12 | `src/mcp/vice/stock-handler.ts` | files[] |
| 12 | `src/mcp/vice/stock-paths.ts` | files[] |
| 10 | `src/mcp/vice/stock-registers.ts` | files[] |
| 9 | `src/mcp/vice/stock-reproducible-run.ts` | files[] |
| 8 | `src/mcp/vice/stock-input.ts` | files[] |
| 7 | `src/mcp/vice/stock-vicii.ts` | files[] |
| 3 | `src/mcp/vice/container-guard.mts` | files[] |
| 2 | `src/mcp/vice/stock-petscii.ts` | files[] |

#### broker — 585 occurrences across 7 files

| Count | File | Surface |
|---|---|---|
| 183 | `src/mcp/vice/broker-launch.mts` | extra `.mts` (D-01, not in files[]) |
| 147 | `src/mcp/vice/vice-broker.mts` | extra `.mts` (D-01, not in files[]) |
| 99 | `src/mcp/vice/vice-broker-client.ts` | files[] |
| 80 | `src/mcp/vice/broker-control.mts` | extra `.mts` (D-01, not in files[]) |
| 43 | `src/mcp/vice/broker-state.mts` | extra `.mts` (D-01, not in files[]) |
| 31 | `src/mcp/vice/broker-kill.mts` | extra `.mts` (D-01, not in files[]) |
| 2 | `src/mcp/vice/broker-epoch.mts` | extra `.mts` (D-01, not in files[]) |

#### host tools — 397 occurrences across 3 files

| Count | File | Surface |
|---|---|---|
| 322 | `src/mcp/vice/host-tool.mts` | extra `.mts` (D-01, not in files[]) |
| 64 | `src/mcp/vice/ghidra-project.mts` | extra `.mts` (D-01, not in files[]) |
| 11 | `src/mcp/vice/host-tool-client.ts` | files[] |

This is the single densest file in the whole phase (`host-tool.mts`, 322 occurrences,
27% of the whole `host tools` + `broker` combined population in one file) — size the
first plan in this family generously, or split it across two plans.

#### other — 315 occurrences across 26 files

| Count | File | Surface |
|---|---|---|
| 28 | `src/mcp/vice/backend-detect.mts` | files[] |
| 26 | `src/mcp/vice/textmon-registers.ts` | files[] |
| 22 | `src/mcp/vice/install-resources.ts` | files[] |
| 22 | `src/mcp/vice/disasm-renderer.ts` | files[] |
| 21 | `src/mcp/vice/disasm-decoder.ts` | files[] |
| 21 | `src/mcp/vice/memmap-lookup.ts` | files[] |
| 20 | `src/mcp/vice/disasm-opcodes.ts` | files[] |
| 14 | `src/mcp/vice/evid-reconcile.ts` | files[] |
| 14 | `src/mcp/vice/capture-predicate.ts` | files[] |
| 13 | `src/mcp/vice/textmon-profile.ts` | files[] |
| 12 | `src/mcp/vice/repo-root.ts` | files[] |
| 12 | `src/mcp/vice/incident-record.ts` | files[] |
| 10 | `src/mcp/vice/version.ts` | files[] |
| 10 | `src/mcp/vice/textmon-cpuhistory.ts` | files[] |
| 10 | `src/mcp/vice/textmon-backtrace.ts` | files[] |
| 10 | `src/mcp/vice/THIRD-PARTY-NOTICES.md` | files[] |
| 9 | `src/mcp/vice/textmon-memmap.ts` | files[] |
| 8 | `src/mcp/vice/evid-ingest.ts` | files[] |
| 7 | `src/mcp/vice/containerpath.ts` | files[] |
| 7 | `src/mcp/vice/prg-image.ts` | files[] |
| 5 | `src/mcp/vice/stop-oracle.ts` | files[] |
| 4 | `src/mcp/vice/vsf-slice.ts` | files[] |
| 3 | `src/mcp/vice/channel-lock.ts` | files[] |
| 3 | `src/mcp/vice/block-class.ts` | files[] |
| 2 | `src/mcp/vice/hostpath.ts` | files[] |
| 2 | `src/mcp/vice/build.ts` | files[] |

(`vice-errors.ts` and `README.md` are also in `files[]`, classify into "other" by
elimination, and scan clean — 0 hits.)

#### proxy / tool surface — 141 occurrences across 2 files

| Count | File | Surface |
|---|---|---|
| 107 | `src/mcp/vice/vice-proxy.ts` | files[] |
| 34 | `src/mcp/vice/tools-manifest.stock.json` | files[] |

#### installer (D-03) — 4 occurrences across 1 file

| Count | File |
|---|---|
| 4 | `installer/bin/cli.mjs` |

### Category breakdown (vice surface only, for cross-checking the guard's own output)

| Category | Occurrences |
|---|---|
| requirement id | 1087 |
| decision or gap id | 913 |
| plan citation | 451 |
| phase citation | 288 |
| planning artifact filename | 156 |
| `.planning` path | 38 |
| planning document cross-reference | 21 |
| gsd command or product name | 5 |

## Guard Anatomy (Task 2)

Read `skills-planning-vocabulary.test.ts` end to end (368 lines). What widening actually
touches:

- **`scanForPlanningVocabulary(content: string): PlanningVocabularyHit[]`** — pure,
  synchronous, no filesystem access. Splits `content` on `\n`, runs all 8 `CATEGORIES`
  regexes per physical line (never per-span or per-file), applies each category's
  `exempt?()` callback (only the "phase citation" category has one — see
  `ownWorkflowSteps()` below), and returns `{ line, category, match, text }` for every
  non-exempt hit. **This is the function D-04's ledger must be measured with** — it is
  already imported cleanly in a standalone script (proven this session; importing it
  from a plain `node` script also re-runs its own 5 embedded `test()` calls as a side
  effect of module load, all green, harmlessly).
- **`ownWorkflowSteps(content: string): ReadonlySet<string>`** — parses `^#{2,}\s+Phase\s+(\d+...)` heading lines and returns the set of step numbers a file declares as its
  own. Consumed only by the "phase citation" category's `exempt` callback. **This
  exemption is skill-specific in practice** — none of `src/mcp/vice/**`'s production
  modules declare `## Phase N` markdown headings (they are `.ts`/`.mts`, not `SKILL.md`),
  so widening the scan does not usefully extend this exemption; every "Phase N" comment
  in the vice tree will need an actual rewrite, not an exemption.
- **The 8 `CATEGORIES`** — frozen array of `{ name, pattern, exempt? }`. Matched via a
  **fresh `RegExp` per line per category** (`new RegExp(category.pattern.source,
  category.pattern.flags)`), which is why a single category's global-flag state never
  leaks across lines. No category is scoped to comments only — the whole physical line
  is scanned, which is why the guard's own header states it deliberately does NOT reuse
  `docs-dangling-refs.test.ts`'s FLOW-02 (string/template-literal-only) scope: a skill is
  addressed to its reader in prose, and there's no maintainer-only region of it. **This
  same whole-line, categories-not-comment-scoped behaviour is what D-01 inherits when the
  scan widens to `.ts`/`.mts` source** — a citation inside a string literal (already
  covered separately by `docs-dangling-refs.test.ts`'s FLOW-02 for `Phase N` specifically)
  or inside a JSDoc block is caught by the same predicate, with no special-casing needed.
- **The one exemption, content-derived**: a skill's own `## Phase N` headings (see
  above). **There is deliberately no by-path exemption** (§21.1, reaffirmed 2026-09-11
  after the withdrawn `c1541.test.mjs` case) — do not propose one for any file this sweep
  finds hard.
- **`OPERATOR_SUPPLIED_RESOURCE_READERS`** — a frozen array of `{ file, envVar, why }`
  triples, currently one entry (`c64-disk-access/scripts/c1541.test.mjs`). A separate test
  (not `scanForPlanningVocabulary`) asserts each entry's file still reads its named env
  var, never mentions `.planning`, and still degrades to a skip when the var is unset.
  **This mechanism is orthogonal to D-01's widening** — it is a `src/skills/**`-specific
  registry for one already-solved case (an operator-supplied `.d64` corpus image) and has
  no counterpart need in `src/mcp/vice/**` today; nothing in the ratchet inventory above
  reads an operator-supplied `.planning/`-adjacent resource by path.
- **`shippedSkillFiles()`** — the function D-01 replaces. Recursively walks
  `src/skills/`, filters to `TEXT_EXTENSIONS`, skips `zz-scratch*`/`node_modules`
  directories, throws nothing on a missing tree (walk would just throw ENOENT from
  `readdirSync`, which is acceptable — the caller's own non-vacuity test asserts
  `files.length >= 40`). **Its replacement per D-01/D-02 must derive from
  `src/mcp/vice/package.json`'s `files[]` (directories expanded) plus the eight
  `HOST_BOUND_ARTIFACTS`-named `.mts` sources, plus `installer/package.json`'s `files[]`
  (D-03)** — i.e., three source lists merged, not one directory walk. `shippedTsModules()`
  in `shipped-modules.ts` already derives (1) for the `.ts`/`.mts` subset and already
  throws `ShippedFilesEntryMissingError` on a stale `files[]` entry — **it does NOT
  handle non-`.ts`/`.mts` entries** (`.md`, `.json` files in `files[]`, or the `resources`
  directory entry), so the widened guard's file-enumerator **cannot reuse
  `shippedTsModules()` directly** and needs its own resolver that expands `files[]`
  fully (any scannable extension, directories included) the way this research's own
  inventory script did. `codeOnly()` (the other export of `shipped-modules.ts`) is
  irrelevant here — it strips comments/literals for a *code-only* structural check;
  this guard wants the opposite (whole-file, no stripping), matching its existing
  behaviour on skills.

### A third planted control (success criterion 5)

The existing two planted controls (`PLANTED CONTROL 1`/`2`) exercise
`scanForPlanningVocabulary()` over **synthetic string content**, never over a real file on
disk — they prove the predicate, not the file-enumeration. Success criterion 5 requires a
planted citation in a **real shipped module's scan path** to red the widened guard. The
existing style does **not** directly extend to this: it would mean literally committing a
citation into a production `.ts`/`.mts` file, which is the exact defect the guard exists
to forbid — self-contradictory as a permanent fixture. The two established patterns
elsewhere in this codebase for "prove the guard sees a real file, not just a string" are:

1. **A committed non-shipped fixture file** (the pattern `comment-phase-pointers.test.ts`
   and `hop-chain-comments.test.ts` both use: `fixtures/planted-phase-pointer-fixture.ts.txt`
   / `fixtures/planted-hop-chain-fixture.ts.txt`, `.ts.txt` extension so it is neither
   picked up by `files[]`-derived enumeration nor by a raw `.ts`/`.mts` directory walk).
   For the widened guard, drive the SAME enumerator the real assertion uses over a
   synthetic `package.json`-shaped input (mirroring `shipped-modules.test.ts`'s own
   precedent of driving `shippedTsModules(dir)` against a temp directory with a planted
   stale entry) — this proves both the predicate AND the file-set derivation logic
   without ever putting a real citation in a real shipped file.
2. Alternatively, since `shippedTsModules()`-and-friends already accept a `dir` parameter
   for exactly this reason (`shippedTsModules(dir: string = HERE)`), the new enumerator
   should be built the same way from day one — accept an optional root, default to the
   real one, and have its own test drive a `mkdtempSync` tree with a planted `package.json`
   and a planted dirty file, asserting the derived set includes it and the scan flags it.

Recommend **option 2** — it matches this file's own established idiom
(`buildSyntheticTree()` in `audit-integrity.test.ts`, `shippedTsModules(dir)` in
`shipped-modules.ts`) rather than introducing a new fixture-file convention just for this
guard.

## The Five Lockstep Guards (Task 3)

All five were read end to end. Classification, with the concrete pin each carries:

| Guard | Scans | Pins that name shipped-source text | Classification |
|---|---|---|---|
| `comment-phase-pointers.test.ts` (607 lines) | `shippedTsModules()` — the SAME `.ts`/`.mts` `files[]`-derived set (excludes the eight extra `.mts` and non-code `files[]` entries) | Its own **header argument**: *"A blanket 'no comment mentions Phase N' rule is not viable here... this guard detects the ASSIGNMENT SHAPE specifically -- narration stays legal"* — plus a **non-vacuity floor test** asserting `phaseLineCount >= 80` (currently ~124 legitimate historical `Phase N` narration comments) | **(c) argument AND assertion must be rewritten.** §21 directly overrides this file's central premise: after the sweep, the widened guard forbids **every** `Phase N` comment mention, narration included, so this file's own `phaseLineCount >= 80` floor **will fail** once the sweep reaches its scanned set (the count trends toward 0, not >=80). The two structural assertions (assignment-shape==0, cut-phase==0) stay trivially true (a blanket-zero superset implies both narrower zeros) but the floor test contradicts the sweep's own goal and must be dropped or repointed at the fixture-only corpus rather than the real tree. Confirmed by re-reading the file, not merely CONTEXT.md's flag. |
| `docs-dangling-refs.test.ts`'s FLOW-02 (458 lines total; FLOW-02 is its second half) | `shippedTsModules()`, but the extractor (`extractStringLiterals()`) **only walks string/template literal bodies**, never comments | Asserts zero `Phase N` mentions **inside string/template literals only** — deliberately, permanently, stated in its own header as the reason it exists separately from a comment-scanning guard | **(a) survives untouched.** Its scope (literals only) is a strict subset of the widened guard's scope (whole file). After the sweep, FLOW-02's own assertion (already asserting zero today) stays true automatically — no code change needed in this file. CONTEXT.md's flag that "the two must not be merged" is correct and requires no action beyond leaving it alone. |
| `hop-chain-comments.test.ts` (454 lines) | `readdirSync(HERE)` over `.ts`/`.mts` directly in `src/mcp/vice/` (**not** `files[]`-derived — includes test files) plus every `src/skills/*/scripts/*.mjs` | Pins a half-swept `.claude` → `src/mcp/vice` directory-rename artifact via a two-part per-line predicate (chain arrow `->` + "repo root" phrase + the literal string `.claude`) | **(a) survives untouched — and is not actually implicated at all.** Grepped the real tree: the only two files anywhere containing both a chain arrow and the "repo root" phrase are `absorbed-answer-key.test.ts:34` and `anno-coverage.test.ts:96` — **both are test files**, outside this phase's scope (test files are explicitly out of scope per the phase boundary). No shipped production `.ts`/`.mts` file matches this guard's pattern today, so the sweep cannot possibly touch anything this guard checks. |
| `docs-absorbed-decisions.test.ts` (231 lines) | **`.planning/ARCHITECTURE.md` and `.planning/PROJECT.md` only** — never any file under `src/mcp/vice/**` or `src/skills/**` | Pins specific decision-id strings (`D-17`, `D-18`, `D-36` supersedes `D-32`, `handler.rs:1894`, an upstream issue URL) **inside those two `.planning/` documents** | **(a) survives untouched — and is not in this phase's scan surface at all.** `.planning/` is explicitly out of scope for this phase (phase boundary: "Out of scope: ... `.planning/` itself"). This guard has zero overlap with anything D-01/D-02/D-03 scan. Listing it among "guards that must move in lockstep" overstates its relevance — it requires no plan-time attention beyond confirming (once) that it stays green, which it will, unconditionally. |
| `audit-integrity.test.ts` (1146 lines) | `scripts/audit-gate.mjs`'s derived `docs-*.test.ts` glob, asserted against a **hardcoded name list** (`EXPECTED_GUARD_NAMES_FOR_ASSERTION`, 11 entries) | Pins the **filenames** of `docs-*.test.ts` guards (for a completely different purpose: blocking a milestone audit's `status: passed` while any of them is red) — **never** any shipped-source comment content, and never `skills-planning-vocabulary.test.ts`, `comment-phase-pointers.test.ts`, or `hop-chain-comments.test.ts` by name (none of the three start with the `docs-` prefix its glob matches) | **(a) survives untouched — and is not implicated at all.** Grepped the whole file for every guard name this phase touches: zero hits. This file's only overlap with the phase-51 guard set is that it happens to be in the same directory; its actual subject (milestone-audit-status gating) is orthogonal. |

**Net effect on success criterion 3** ("all six comment-pinning guards are green, having
been MOVED rather than relaxed wherever a pin named text this phase rewrote"): only
**one** of the five actually needs a move — `comment-phase-pointers.test.ts`. The other
four require **no edit**. Size the plan accordingly: this is a one-file guard-maintenance
task, not a five-file one.

## D-09's Byte-Budget Assertion (Task 4)

**The assertion as specified cannot be a standing, always-green `node:test` case** the
way the other five guards are — it is inherently a **before/after delta** ("comment bytes
lost... must be <= the summed character length of the citation tokens removed"), and
`scanForPlanningVocabulary()` only observes ONE point in time. A single scan of the
post-sweep file has no way to know what a pre-sweep version of that same file looked
like, so the inequality cannot be checked from current file content alone.

**What the scan already retains, precisely:** each `PlanningVocabularyHit` carries `line`,
`category`, `match` (the exact matched substring — e.g. `"D-05"`, `"Phase 40"`, `"Plan
41-05"`) and `text` (the trimmed physical line, truncated to 160 chars). `match.length`
is directly usable as "that token's character length" with **zero new scanning logic** —
this is the cheap half of D-09 and already solved.

**What is missing, and the nearest workable form:** the "comment bytes lost" half needs a
BEFORE snapshot. Recommend extending the same D-04 ratchet ledger (which must already
record a per-file occurrence count) with two more frozen-at-ledger-creation-time fields,
computed once, before any sweep plan runs:

1. `charsInCitations` — `scanForPlanningVocabulary(content).reduce((s,h) => s +
   h.match.length, 0)` for that file, at freeze time. Already directly computable, no new
   extractor needed.
2. `commentBytes` — the file's total comment-span length at freeze time, using the
   **existing** comment-span extractor already duplicated in `comment-phase-pointers.test.ts`
   and `hop-chain-comments.test.ts` (`extractCommentSpans()` — a character-state-machine
   walk, NOT the categories regex). Reuse rather than re-derive a fourth copy; if it needs
   to move to become importable, `shipped-modules.ts`'s header explicitly discusses this
   comment-extractor family and states which of its six existing homes do genuinely
   different jobs — a byte-total measurer is a plausible seventh distinct job (it needs
   the RAW span text, not blanked and not collected-for-search), so a new function is
   defensible, but it should be a thin wrapper around the existing character-state-machine
   loop, not a new one.

Then, **per sweep plan** (not as a permanent repo-wide `npm test` assertion — the ledger
itself is temporary scaffolding per D-05, and this check only needs to hold at the moment
each file leaves the ledger): assert `baselineCommentBytes -
currentCommentBytes(fileNow) <= charsInCitations(fileAtFreeze) + slack`. This is naturally
a **verification step inside each sweep plan** (compute today's comment-byte count,
compare against the frozen baseline recorded when the ledger was written), not a
standing test file — matching the ratchet's own temporary, per-plan nature.

**Failure modes to name to the planner:**

- **One-directional by construction, which is correct.** A file whose comments legitimately
  *grow* (a bare `(D-16)` expanded into a real paragraph) produces a negative "bytes
  lost" and trivially satisfies the inequality — exactly D-09's stated intent ("gutting a
  400-byte WHY header down to a one-liner reds immediately" is the only failure shape,
  never growth).
- **Units:** use JS string `.length` (UTF-16 code units) uniformly for both sides of the
  inequality, matching how `match.length` and `scanForPlanningVocabulary` already operate,
  and matching D-10's own reasoning about `String.length` counting code units — do not
  introduce a UTF-8 byte count on one side and a JS-string length on the other.
- **Reformatting noise:** re-wrapping a comment block (adding/removing line breaks with no
  informational change) shifts raw length without losing or gaining any reason. This is
  exactly what the unconstrained "slack" term exists to absorb — Claude's Discretion
  already defers picking its value until the first family's real diffs are available;
  recommend calibrating it against the **`host tools`** family's first plan (largest
  single file, `host-tool.mts` at 322 sites), since it will produce the most real diffs to
  measure against before the value is locked for the remaining five families.
- **The check is strongest for the 42.7% bare-parenthetical class** (D-07 tier 1: delete
  the tag, prose already states the reason) — here `charsInCitations` for the line is the
  whole edit, so the inequality is nearly definitional. It is **weakest for the 6.4%
  sparse-line class** (D-08's bottom tier), where a whole comment block may be
  restructured and the per-token character count is a poor proxy for how much
  information was legitimately replaced. Flag to the planner that criterion 2 compliance
  for that tier may need a human read of the diff (named in the plan's summary, as D-08
  already requires for that tier) rather than pure mechanical enforcement — the
  byte-budget check catches the *worst* violations (wholesale deletion) reliably; it does
  not certify every rewrite in that tier is a *good* one.

## Recovery Ladder Real Cost (Task 5)

### Tier 2 — a major correction to D-07's premise

D-07 tier 2 assumes `D-NN` decision ids are "globally-unique" alongside real requirement
ids, resolvable by a single `.planning/` grep. **This is contradicted by measurement.**
`D-NN` ids are **phase-scoped** (and quick-task-scoped), exactly like `CR-NN`/`WR-NN` —
not global at all:

- `D-13` alone appears in **188 files** across `.planning/`, independently DEFINED
  (not merely cited) inside at least six unrelated contexts: phase 02's own
  `02-CONTEXT.md`, phase 16's `16-07-SUMMARY.md`, phase 27's `27-CONTEXT.md`, phase 29's
  own `D-13` (`29-01-PLAN.md`, `29-RESEARCH.md`), quick-task `260819-rop`, and quick-task
  `260913-p6b` — each declaring its own, unrelated "D-13" as the 13th locally-numbered
  decision in that context's own list (this repository's own `/gsd-discuss-phase` output,
  including this very 51-CONTEXT.md, numbers its decisions D-01..D-10 fresh **per
  phase**). A bare `.planning/` grep for `D-13` therefore returns 188 candidate files,
  not one authoritative paragraph — the SAME ambiguity D-07 attributes only to
  `CR-NN`/`WR-NN`.
- `G-NN-N` gap ids are **not** ambiguous this way — the id's own literal form embeds the
  originating phase number (`G-40-1` names phase 40 directly), so no disambiguation step
  is needed; this half of tier 2 is genuinely cheap as D-07 describes.
- Real requirement ids (`SEAM-02`, `PREP-01`, etc.) remain genuinely global — each is
  declared exactly once in `.planning/REQUIREMENTS.md` (or its milestone archive), so
  this half of tier 2 is also genuinely cheap.

**Practical guidance for the planner:** split tier 2 into two sub-costs rather than one.
"Requirement id" and "`G-NN-N`" sites (the majority of the 570-site population, per the
category breakdown: 1087 requirement-id-shaped hits in the vice surface, only 25 of which
are `G-NN-N` and the rest genuinely-unique requirement ids) are a single grep each. `D-NN`
sites (913 vice-surface hits) need the SAME per-site `git blame` → originating phase →
that phase's `CONTEXT.md`/`PLAN.md`/`REVIEW.md` walk that D-07 reserves for tier 3 — they
are not cheaper than `CR-NN`/`WR-NN` just because the id has no "review finding" flavor.

### Tier 3 — confirmed to work, walked end to end

Sampled two real sites in `anno-store.ts`:

- `anno-store.ts:494` (`CR-03, CR-04`) → `git blame` → commit `df619ad8c`
  (`feat(28-21): workspace confinement becomes openStore's default...`) → phase 28 →
  `.planning/phases/28-the-store-core/28-10-SUMMARY.md:233`: `"### CR-03 — one `mv` plus
  one write destroyed the whole revert history"` — a clear, directly quotable one-line
  reason.
- `anno-store.ts:610` (`WR-04`) → `git blame` → commit `03e12669d`
  (`fix(28-11): guard the three unguarded regions -- WR-01, WR-02, WR-04`) → phase 28 →
  same `28-*` directory.

**The chain works exactly as D-07 describes, with one added nuance:** the fullest
explanation of a `CR-NN`/`WR-NN` finding sometimes lives in the **fixing plan's
`SUMMARY.md`** (which explains what was actually done and why) rather than strictly in
`REVIEW.md` (which states the finding tersely). Tell the planner to check both, not just
`REVIEW.md` as D-07's phrasing implies.

### Dangling citations — a major correction to CONTEXT.md's own count

CONTEXT.md names 33 distinct dangling tokens (~135 occurrences), listing "Plan 41-05" (35
occurrences) and "plan 40-03" (20 occurrences) as the two largest, both allegedly
resolving nowhere in `.planning/`. **Both are demonstrably wrong — both resolve cleanly:**

- `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content/41-05-PLAN.md`
  and its `41-05-SUMMARY.md` both exist, and their content (`warm floor` retirement,
  `InstanceRecord`, `promoteLaunchingInstances()`, `D-16`) matches **exactly** what the
  73 real "Plan 41-05" mentions in shipped source cite it for (verified by grepping both
  the plan file and the citing comments in `broker-launch.mts` and `vice-broker.mts` —
  every citing comment even self-labels `"(folded todo)"`, matching the plan's own
  description of itself as folding a todo item).
- `.planning/phases/40-the-three-preprocessing-host-tools/40-03-PLAN.md` and
  `40-03-SUMMARY.md` likewise both exist.

That is **55 of the ~135 claimed-dangling occurrences (roughly 41%) misclassified** —
these two are the largest items in CONTEXT.md's own dangling list. A spot check of the
remaining, smaller claimed-dangling tokens (`01.6.2.1-REVIEW.md`, `Phase 01.6.2.1`,
`PD-03`) found no matching file or definition anywhere in `.planning/` — those three
**are** genuinely dangling, matching CONTEXT.md.

**Practical guidance:** "`Plan NN-MM`"-shaped citations are the **cheapest** class in the
whole ladder, cheaper than a `.planning/` grep — `find .planning/phases -iname
"*NN-MM*"` resolves them directly to a real plan/summary file whose prose can usually be
quoted or paraphrased verbatim, with no `git blame` step needed at all. Re-verify
CONTEXT.md's full 33-token dangling list against the real tree (a `find` per token, same
as done here) before committing any comment to D-08's "rewrite to a weaker but true
statement" bucket — some fraction of that list is not actually in that bucket; it is in
the cheap tier-2/plan-citation bucket instead, one hop away.

## Common Pitfalls

### Pitfall 1: Trusting a stale occurrence count

**What goes wrong:** A ledger frozen from CONTEXT.md's or this document's own numbers is
wrong by the time a plan executes.
**Why it happens:** The population grew ~580 in 3 days before this phase was even
planned (roadmap 2384 → CONTEXT.md 2963), and shrank by 4 in the few hours between
CONTEXT.md's gathering and this research pass, from unrelated same-day commits. This is
an actively-worked codebase; every file this phase touches is also being edited by other
in-flight phases (55, in this case).
**How to avoid:** Re-run `scanForPlanningVocabulary()` over the live tree at the moment
the ledger is frozen (the first sweep plan's first task), never earlier.
**Warning signs:** A sweep plan's own verification step reports a count that doesn't
match its ledger entry on the very first file it touches.

### Pitfall 2: Assuming `shippedTsModules()` covers the whole scan surface

**What goes wrong:** Reusing `shippedTsModules()` unmodified for the widened guard silently
drops `.md`/`.json` `files[]` entries (`README.md`, `THIRD-PARTY-NOTICES.md`,
`tools-manifest.stock.json`, `anno-regbits.json`) and the `resources` directory entry.
**Why it happens:** `shippedTsModules()` filters to `/\.(ts|mts)$/` by design — it was
built for guards that only care about TypeScript structure (spawn-seam, comment-phase-
pointers, stock-dispatch), not for a whole-file prose/comment scan.
**How to avoid:** Build a new enumerator (or extend `shipped-modules.ts` with a second
exported function) that expands `files[]` fully — any scannable extension, directories
included — mirroring this research's own inventory script rather than narrowing to
`.ts`/`.mts`.
**Warning signs:** The widened guard reports fewer than 98 files scanned in
`src/mcp/vice`, or `tools-manifest.stock.json`'s 34 occurrences never show up.

### Pitfall 3: Treating all five "lockstep" guards as needing edits

**What goes wrong:** A plan budgets guard-maintenance work for all five guards named in
CONTEXT.md's canonical references, when four of the five need zero changes (see `## The
Five Lockstep Guards` above).
**Why it happens:** CONTEXT.md lists them together under one heading ("Guards that must
move in lockstep") without stating which ones are actually implicated.
**How to avoid:** Read each guard's own scan surface before assuming it needs a code
change. Only `comment-phase-pointers.test.ts` does.
**Warning signs:** A plan proposes edits to `docs-absorbed-decisions.test.ts` or
`audit-integrity.test.ts` — neither scans anything this phase's sweep touches.

### Pitfall 4: A fifth hand copy of the comment-span extractor

**What goes wrong:** D-09's byte-budget mechanism gets its own, fourth or fifth
from-scratch character-state-machine comment extractor.
**Why it happens:** Three near-identical copies already exist
(`comment-phase-pointers.test.ts`, `hop-chain-comments.test.ts`, and `codeOnly()`'s
inverse logic in `shipped-modules.ts`), and it is easy to not notice the third when
writing what looks like a small helper.
**How to avoid:** Reuse the existing extractor (or its byte-total wrapper) rather than
re-deriving one; `shipped-modules.ts`'s own header explicitly discusses this
comment-extractor family and states which jobs are genuinely distinct.
**Warning signs:** A new `extractCommentSpans`-shaped function appears in a diff that
isn't importing from an existing module.

### Pitfall 5: Believing CONTEXT.md's dangling-citation list without re-checking it

**What goes wrong:** A plan spends D-08's "rewrite to a weaker but true statement" effort
on `Plan 41-05` or `plan 40-03` sites, when both resolve instantly to a real, on-topic
plan file.
**Why it happens:** CONTEXT.md states the dangling classification as measured fact; it is
wrong for at least these two, the two largest items in its own list.
**How to avoid:** Re-run `find .planning/phases -iname "*<token>*"` (or equivalent) per
claimed-dangling token before writing the "no reason recoverable" bucket into any plan.
**Warning signs:** A "dangling" token's own name looks exactly like a real `NN-MM` plan
number — those are the cheapest class in the whole ladder, not the hardest.

## Code Examples

### The worked rewrite pair (§21.2, the standard for every rewrite this phase makes)

```typescript
// Bad:
// Phase 40, plan 40-02 (PREP-01, D-13): reached ONLY through the host-tool seam

// Good:
// Reached ONLY through the host-tool seam: this script runs container-side and the
// binary lives on the host, so a direct spawn finds nothing.
```

### Measuring the live ledger (reusable per sweep plan)

```javascript
// Import the guard's own predicate -- never hand-roll a grep.
import { scanForPlanningVocabulary } from "./skills-planning-vocabulary.test.ts";
import { readFileSync } from "node:fs";

const content = readFileSync("src/mcp/vice/host-tool.mts", "utf8");
const hits = scanForPlanningVocabulary(content);
console.log(hits.length); // must match the ledger's pinned count for this file, exactly
```

### D-04's ratchet ledger shape (Claude's Discretion on file/format; suggested shape)

```typescript
// A frozen, shrink-only record. Every entry removed when a sweep plan clears
// that file's citations to zero; the last entry's removal is the phase's final plan.
export const RATCHET: ReadonlyArray<{
  file: string;
  family: "annotation store / CLI" | "protocol / transport" | "broker" | "host tools" | "other" | "proxy / tool surface" | "installer";
  count: number;          // scanForPlanningVocabulary(...).length at freeze time
  charsInCitations: number; // sum of hit.match.length at freeze time (D-09 input)
  commentBytes: number;     // total comment-span length at freeze time (D-09 input)
}> = Object.freeze([
  { file: "src/mcp/vice/host-tool.mts", family: "host tools", count: 322, charsInCitations: /* measured */ 0, commentBytes: /* measured */ 0 },
  // ...
]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `src/skills/**` at zero, `src/mcp/vice/**` an accepted 1659-occurrence backlog | Both surfaces enforced by one widened guard | This phase | The "known, recorded backlog" comment at the top of `skills-planning-vocabulary.test.ts` (lines 22-29) becomes stale the moment this phase lands and must be rewritten in the same commit that widens the scan |
| Document-qualified decision/requirement id citations allowed (`` `docs/x.md` D-03 ``) | Banned in every form | 2026-09-11, ENGINEERING_RULES §21.2 | Already fully reflected in the current guard; this phase inherits it, does not re-litigate it |

**Deprecated/outdated:** The roadmap's 2026-09-11 population figures (2384 occurrences,
88/92 files) are two measurements out of date; use this document's 2026-09-14 figures
only as a **starting point to re-measure from**, never as the frozen ledger itself.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The per-file family classification (which file belongs to which of D-06's six families) is inferred by finding the one partition that reconciles all six stated totals exactly, since D-06 did not publish per-file membership. | Ratchet Inventory | If the intended partition differs (e.g. `disasm-*.ts`/`textmon-*.ts` were meant to sit in `protocol / transport` and some other file was meant to move into `other` instead), a sweep plan sized against this document's family boundaries could pick the wrong file set for a given plan. Mathematically only one arrangement reconciles all six totals with this codebase's actual file-name patterns, so this risk is low, but it was not independently confirmed against a document that states membership explicitly. |
| A2 | A third planted control (success criterion 5) should follow the `dir`-parameter pattern (`shippedTsModules(dir)`, `buildSyntheticTree()`) rather than a committed fixture file. | Guard Anatomy | If the planner instead wants fixture-file parity with the other two comment-scanning guards, a different (still valid) implementation shape is needed; this is a recommendation, not a locked decision. |
| A3 | `commentBytes` (D-09's byte-budget denominator) should be measured via the same character-state-machine extractor already in this directory, extended into a new byte-total helper. | D-09 mechanism | If a git-diff-based before/after comparison is preferred instead of a frozen-baseline comparison, the mechanism's storage shape changes (no need to freeze `commentBytes` per file at ledger time — read it from `git show <base-commit>:<path>` instead). Both are workable; this document recommends the ledger-baseline form because it matches D-04's own mechanism, but it is not a locked decision in CONTEXT.md. |

## Open Questions

1. **Does `docs/phase*.md` citation cleanup (Phase 53, DOCS-03/DOCS-04) overlap this
   phase's scan surface?**
   - What we know: `.planning/REQUIREMENTS.md` states DOCS-03 measured "15 citing files
     inside Phase 51's `files[]` scope" as of 2026-09-13.
   - What's unclear: Whether those 15 files' `docs/phase*.md` citations are already
     counted inside this phase's 3184-site ledger (they would match the `.planning path`
     or a related category only if literally spelled `.planning/...`; a bare
     `docs/phase0-binmon-findings.md`-style citation does not match any of the 8
     `CATEGORIES` regexes today, since none of them match a bare `docs/` path).
   - Recommendation: Confirm with the planner whether `docs/phase*.md` citations are
     in scope for THIS phase's guard widening or deliberately deferred to Phase 53 (the
     phase boundary's silence on `docs/` citations specifically, versus its explicit
     `.planning/` exclusion, suggests they are currently **unguarded by either phase** —
     worth a explicit locked decision rather than an assumption).
2. **Exact slack value for D-09.**
   - What we know: Claude's Discretion defers this to the first family's real diffs.
   - What's unclear: Whether "the first family" means whichever family's plan executes
     first (ordering is also Claude's Discretion) or specifically the largest/densest
     family (`host tools`, `host-tool.mts` at 322 sites) recommended above for
     calibration purposes.
   - Recommendation: Calibrate against `host-tool.mts` specifically, regardless of which
     family's plan runs first, since it has by far the most real diffs to measure against.

## Sources

### Primary (HIGH confidence — measured live in this checkout this session)
- `src/mcp/vice/skills-planning-vocabulary.test.ts` — imported directly and driven over
  the real tree via a scratch script; its own 5 embedded tests re-ran green as an import
  side effect.
- `src/mcp/vice/shipped-modules.ts`, `src/mcp/vice/build.ts` — read in full.
- `src/mcp/vice/comment-phase-pointers.test.ts`, `hop-chain-comments.test.ts`,
  `docs-dangling-refs.test.ts`, `docs-absorbed-decisions.test.ts` — read in full.
- `src/mcp/vice/audit-integrity.test.ts` — read in full for its header/scope, grepped for
  every relevant guard name.
- `git blame`/`git log` on `src/mcp/vice/anno-store.ts:494,610` and the resulting phase-28
  artifacts — walked end to end.
- `find .planning/phases -iname "*41-05*"` / `"*40-03*"` / `"*01.6.2.1*"`, `grep -rn
  "PD-03"` — walked end to end for the dangling-citation correction.
- `.planning/ENGINEERING_RULES.md` §21 (full text read) — the rule this phase enforces.

### Secondary (MEDIUM confidence)
- The per-file family classification (Assumption A1) — reconciled mathematically against
  D-06's stated totals, not confirmed against an explicit membership list.

## Metadata

**Confidence breakdown:**
- Ratchet inventory: HIGH — measured live with the guard's own predicate, cross-checked
  against D-06's totals to the occurrence.
- Guard anatomy: HIGH — full file reads, one item (the third planted control's exact
  shape) is a recommendation rather than a measured fact (MEDIUM).
- Five lockstep guards classification: HIGH — full file reads plus live greps confirming
  zero real-tree overlap for four of the five.
- D-09 mechanism: MEDIUM — reasoned from the scan's actual return shape; no prior art in
  this codebase for a byte-budget check, so the recommended mechanism is a proposal, not
  a confirmed pattern.
- Recovery ladder cost: MEDIUM — sampled (2 tier-3 sites, 1 tier-2 D-NN cross-reference
  count, 4 dangling tokens), not exhaustive across all 913 D-NN sites or all 33 claimed-
  dangling tokens.

**Research date:** 2026-09-14
**Valid until:** Re-measure the ratchet inventory before writing the first sweep plan,
regardless of how soon that is — this document's own numbers already drifted from
CONTEXT.md's by 4 within the same day.
