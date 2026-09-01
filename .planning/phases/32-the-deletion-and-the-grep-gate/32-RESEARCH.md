# Phase 32: The Deletion and the Grep Gate - Research

**Researched:** 2026-08-31
**Domain:** Retrospective guard-vacuity auditing, derive-from-disk registries, document sweeps — no product build work
**Confidence:** HIGH for everything measured on the tree this session (every figure below carries its command); MEDIUM only where explicitly marked

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Copied from `.planning/phases/32-the-deletion-and-the-grep-gate/32-CONTEXT.md`. **Do not re-open D-01..D-17.**

**The fate ledger**

- **D-01 — The recorded fate lives in a committed registry with a derive-from-disk guard, not in a one-time evidence document.** The guard derives the audited set from disk and fails if any member lacks a fate row. This follows `scripts/audit-gate.mjs`'s `D-12-07` — *"Do not hand-type a second list of guard file names anywhere else in this repo. The guard set below is derived from disk; duplicating it by hand is exactly how a guard can silently drop out of the set this gate protects."* A prose-only record for an audit whose entire subject is "a guard can silently drop out of a set" would reproduce the `4f048bb` failure mode this project keeps legislating against. *(User answered "You decide"; recorded as Claude's discretion below.)* — **Reversibility:** costly.
- **D-02 — The audited set is re-derived on the settled tree and then reconciled against the requirement's historical list, with every addition and removal given a reason.** — **Reversibility:** reversible.
- **D-03 — A fate row records four fields: verdict, new subject, observed-red evidence, and new removal trigger.** Verdict is one of `re-pointed`, `deleted`, `superseded`, `kept-unchanged`. `D-36`'s explicit "superseded-by" fate is expressed as verdict `superseded` plus a new-subject field naming the replacement — no fifth field.

**The vacuity proof**

- **D-04 — A committed, re-runnable mutation harness produces the observed-red evidence, rather than a hand-worked transcript.** Per registry row it plants that guard's violation, runs only that guard, asserts a non-zero exit, and reverts. — **Reversibility:** costly — a crashed run leaving the tree dirty would corrupt this phase's own close-gate run.
- **D-05 — Rows are typed, and the verdict decides what evidence the row owes.** `re-pointed` owes an observed red. `deleted` owes proof of absence plus the commit that removed it. `superseded` owes the replacement's own observed red. `kept-unchanged` owes proof its subject still exists untouched.
- **D-06 — Planted violations live in committed fixtures and the guard is pointed at a synthetic tree; the real working tree is not mutated where that is avoidable.**
- **D-07 — Guards with no root override get one where the change is cheap and self-contained; the rest fall back to guarded working-tree mutation with a restore-on-exit handler.** **Ordering constraint:** any such `--root` addition must land in a commit **before** the sweep measures that guard. — **Reversibility:** reversible.

**The living-document sweep (`CUT-06`)**

- **D-08 — Only text that tells a reader to use, install or invoke a deleted route is corrected. Everything historical stays byte-identical.** Three classes: dated findings documents, licence/attribution notices, live pointers. — **Reversibility:** reversible.
- **D-09 — Every file in the swept set gets a row, including "left unchanged".**
- **D-10 — `PROJECT.md`'s stale `vice-proxy.ts` line citations are repaired AND brought under `docs-linerefs.test.ts`.** Subject to `D-07`'s ordering constraint. — **Reversibility:** costly.
- **D-11 — `CLAUDE.md` is already clean and needs no work.** A planner must not re-derive this as outstanding. Likewise there is **no `ARCHITECTURE.md` outside `.planning/`**.

**The close-gate re-run**

- **D-12 — The whole-glob claim is honoured by `test:automated` to a real zero plus `test:manual` worked file-by-file, and the union is the whole glob.**
- **D-13 — Broker-down is an asserted, recorded precondition of the gate run, not a prose instruction and not a scripted kill.**
- **D-14 — The evidence cites CI's whole-glob green AND the local legs, and states the SKIP nuance plainly.**
- **D-15 — The evidence artifact carries raw commands, raw output, broker state and the commit measured** — under the phase's `evidence/` directory.

**Wiring the new artifacts**

- **D-16 — The fate-registry guard gets its own named CI step and its own file name, and stays OUT of `src/mcp/vice/package.json`'s `scripts` block.**
- **D-17 — The mutation harness is a committed phase instrument, not a CI job.**

### Claude's Discretion

- **`D-01`'s ledger form** — the planner may choose the registry's concrete file format and location; the derive-from-disk property and the no-hand-typed-second-list rule are **not** discretionary.
- **Todo folding** — fold BACK-05 only, as a recorded precondition rather than as adopted fix work.
- The harness's concrete invocation surface, the registry's serialization format, and the plan/wave decomposition are all open to the planner.

### Deferred Ideas (OUT OF SCOPE)

- **Re-spelling the twelve committed `project.regen2000proj` coverage fixtures**, and with them removing `block-class.ts`'s transitional capitalised block-type arm and re-pointing `make-coverage-fixtures.mjs`'s frozen writer onto the Phase 28 store. This phase **records the fate** against the new trigger and does not perform the re-point.
- **Fixing the BACK-05 D-G ordering test's live-broker sensitivity** — folded here only as a recorded precondition (`D-13`).
- **Diagnosing `vice-proxy.test.ts`'s local hang.**
- **Running the mutation harness on a schedule or in CI** (`D-17` keeps it a phase instrument).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CUT-04 | Every guard and CI script pinned to the deleted subject has a recorded fate and none passes vacuously — 32 test files + 11 `scripts/` files at the v0.7.0 open | §1 reproduces **both** historical figures exactly and gives the derive-from-disk predicate; §2 sizes plantability per member; §3 gives the harness shape; §4 gives the registry + guard shape and its side effects; §8 gives the two deferred fates |
| CUT-06 | Every living document naming the external analyser as a required prerequisite is corrected | §5 gives the measured census with per-file verdict candidates; §6 gives the `PROJECT.md` citation repair and the `docs-linerefs.test.ts` widening; §7 gives the close-gate recipe |
</phase_requirements>

## Summary

Every discussion-time number in CONTEXT.md was re-measured this session. **Three reconcile exactly, one is a counting-definition difference, and one is off by three.** Most importantly, `CUT-04`'s two historical figures — "32 test files" and "11 files under `scripts/`" — **both reproduce exactly**, at the v0.7.0 open commit `0394cbc`, under a single stated predicate. That removes the largest planning risk in the phase: the audited set is not a hand-typed list to be reconstructed by judgement, it is a two-line command.

The audited set is 43 files at the v0.7.0 open (19 `anno-`named test files + 13 non-`anno-`named referencing test files + 11 `scripts/` files). On the settled tree, **21 still exist under their original path, 16 survive under a new name, and 6 are gone outright** (21+16+6 = 43). Five of those renames — including `scripts/lib/anno-cli-verbs.d.mts` — are invisible to git's own `-M` rename heuristic and are only recoverable through the `anno-` → `anno-` name-descendant predicate `CUT-01` already established. Every one of those dispositions maps onto exactly one of `D-03`'s four verdicts.

The plantability picture is stark and drives `D-07`: **exactly one** of the six repo-level CI scripts has a `--root` override (`scripts/audit-gate.mjs`); the other five, including `scripts/check-no-analyser.mjs` itself, derive their root from `import.meta.url` at module scope with no CLI surface at all. There is a second, larger hazard the planner must design around before writing a single plan: `check-no-analyser.mjs` asserts **exact hit counts with `===`** for every exemption path, so *any* new file this phase adds that carries the contiguous literal `the external analyser` — including the fate registry's own prose, and including a new CI step name in `.github/workflows/ci.yml` (currently pinned at exactly 1) — turns the removal gate red the moment it lands.

**Primary recommendation:** Derive the audited set mechanically from the object store at the pinned commit `0394cbc` using the predicate in §1.3, serialize the registry as JSON under `.planning/phases/32-the-deletion-and-the-grep-gate/` (outside the removal gate's `.planning/`-prefix-excluded scope, which sidesteps the exact-count hazard entirely), and give it a `scripts/check-guard-fates.mjs` guard whose name and CI step name carry no form of the subject literal.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Derive the audited set | Git object store at a pinned commit | — | The set's members are files that no longer exist; a working-tree walk is structurally blind to them. Precedent: `CUT-01`'s own pinned-commit predicate |
| Hold the fate line continuously | `scripts/check-*.mjs` + a named CI step | — | `D-16`; matches the six existing named steps at `ci.yml:189-235` |
| Produce observed-red evidence | Committed phase instrument, run by hand | — | `D-17`; it mutates files and drives the whole guard set |
| Store the registry data | `.planning/phases/32-*/` (recommended) | `scripts/` | `.planning/` is excluded from the removal gate's scope by prefix (`check-no-analyser.mjs:180`), so registry prose naming the subject cannot fire it |
| Record close-gate evidence | `.planning/phases/32-*/evidence/` | — | `D-15`, matching `29-21-SUMMARY.md` |

---

## 1. Re-deriving the audited set (D-02)

### 1.1 Current-tree counts

| Measure | Command | Result | CONTEXT.md said | Verdict |
|---|---|---|---|---|
| `*.test.*` files in `src/mcp/vice/` | `git ls-files 'src/mcp/vice/*.test.*' \| wc -l` | **126** | 126 | ✅ exact |
| Files under `scripts/` (incl. `scripts/lib/`) | `git ls-files scripts/ \| wc -l` | **23** | "`scripts/lib/` fully renamed to `anno-*`, `scripts/` gained `check-no-analyser.mjs`" | ✅ consistent |

`[VERIFIED: git ls-files, this session]`

Full `scripts/` listing on the settled tree (23 files): `audit-gate.mjs`, `check-no-analyser.d.mts`, `check-no-analyser.mjs`, `check-npm-packages.mjs`, `check-skill-cli-invocations.mjs`, `check-skill-description-overlap.mjs`, `check-skill-fork-honesty.mjs`, `check-skill-tool-coverage.mjs`, `ensure-mcp-deps.sh`, `generate-tool-support-table.mjs`, `lib/anno-cli-invocations.{mjs,d.mts}`, `lib/anno-cli-verbs.{mjs,d.mts}`, `lib/skill-corpus.{mjs,d.mts}`, `lib/skill-descriptions.{mjs,d.mts}`, `lib/skill-honesty-checks.{mjs,d.mts}`, `package.sh`, `release-assets.sh`, `version.mjs`.

Note: `scripts/lib/` is **not** "fully renamed to `anno-*`" — only the `anno-cli-verbs` pair moved to `anno-cli-verbs`; `anno-cli-invocations` is new, and the four `skill-*` files kept their names. CONTEXT.md's phrasing overstates it slightly. `[VERIFIED: git ls-files scripts/]`

### 1.2 `CUT-04`'s historical figures — BOTH REPRODUCE EXACTLY

This is the single most valuable finding for the planner. Measured at the **v0.7.0 open**, which reproduces identically at `0394cbc` (*"docs: define milestone v0.7.0 requirements"*), `764d32b` (*"docs: start milestone v0.7.0"*) and `70ae2d2` (*"docs: create milestone v0.7.0 roadmap"*):

| `CUT-04` claim | Measured at `0394cbc` | Verdict |
|---|---|---|
| 19 `anno-`named test files | **19** | ✅ exact |
| 13 non-`anno-`named test files that reference it | **13** | ✅ exact |
| → "**32 test files**" | **32** | ✅ exact |
| "**11 files under `scripts/`**" | **11** | ✅ exact |

`[VERIFIED: git ls-tree -r --name-only 0394cbc, this session]`

**The 19 `anno-`named test files** (all under `src/mcp/vice/`): `anno-answer-key`, `anno-cli`, `anno-confidence`, `anno-coverage-grammar`, `anno-coverage`, `anno-d64`, `anno-enum-gen`, `anno-launch`, `anno-mcp-client`, `anno-memmap-render`, `anno-project`, `anno-regbits`, `anno-session`, `anno-spawn-seam`, `anno-symbol-roundtrip`, `anno-tools`, `anno-upstream-audit`, `anno-verb-coverage`, `anno-verify` — all `.test.ts`.

**The 13 non-`anno-`named referencing test files**, with their occurrence counts at `0394cbc` (`git show 0394cbc:<path> | grep -aoiF 'anno' | wc -l`):

| File | hits |
|---|---|
| `audit-integrity.test.ts` | 1 |
| `capability-registry.test.ts` | 8 |
| `disasm-roundtrip.test.ts` | 3 |
| `docs-dangling-refs.test.ts` | 19 |
| `docs-absorbed-decisions.test.ts` | 10 |
| `hop-chain-comments.test.ts` | 8 |
| `hostpath-consumers.test.ts` | 31 |
| `skill-acme-build-cli.test.ts` | 2 |
| `skill-attribution.test.ts` | 20 |
| `stock-connect.test.ts` | 1 |
| `stock-dispatch.test.ts` | 32 |
| `tool-support-table.test.mjs` | 9 |
| `vice-proxy.test.ts` | 30 |

This is **the same 13 names** `.planning/research/PITFALLS.md:36` lists. PITFALLS' per-file counts differ from mine (it records `docs-anno-decisions` 8, `hostpath-consumers` 22, `capability-registry` 5, `tool-support-table` 5, `docs-dangling-refs` 18) — a different counting definition (almost certainly lines-with-a-hit vs occurrences, and/or measured a few commits apart). **The membership is identical; only the hit counts differ.** Flag for the planner: cite occurrences, and say which definition you used.

**The 11 `scripts/` files at `0394cbc`:** `audit-gate.mjs`, `check-npm-packages.mjs`, `check-skill-fork-honesty.mjs`, `check-skill-tool-coverage.mjs`, `generate-tool-support-table.mjs`, `lib/anno-cli-verbs.d.mts`, `lib/anno-cli-verbs.mjs`, `lib/skill-corpus.d.mts`, `lib/skill-descriptions.d.mts`, `lib/skill-descriptions.mjs`, `lib/skill-honesty-checks.mjs`.

`CUT-04` names the extras as *"`scripts/lib/anno-cli-verbs.mjs` and two `.d.mts` declarations, `audit-gate.mjs`, `check-npm-packages.mjs`, `check-skill-fork-honesty.mjs` and `skill-honesty-checks.mjs`"*. The derived set contains **three** `.d.mts` files (`anno-cli-verbs.d.mts`, `skill-corpus.d.mts`, `skill-descriptions.d.mts`), not two — unless `anno-cli-verbs.d.mts` is being counted under the "`anno-cli-verbs`" clause, in which case "two `.d.mts` declarations" means the other two and the arithmetic closes. Note the ambiguity; the **count of 11 is exact either way**.

### 1.3 The derive-from-disk predicate (what `D-01`'s guard should use)

`D-01` forbids a hand-typed second list. The audited set cannot be derived from a working-tree walk, because 22 of its 43 members do not exist on the working tree at all. The defensible predicate is a **pinned-commit** derivation — the exact shape `CUT-01` already uses and `.planning/REQUIREMENTS.md` already defends (*"a HEAD-relative figure is not re-derivable by a later reader by construction"*):

```
AUDIT_COMMIT = 0394cbc      # the v0.7.0 open; both CUT-04 figures reproduce here

set = { p ∈ git ls-tree -r --name-only $AUDIT_COMMIT -- src/mcp/vice scripts :
          ( p matches ^src/mcp/vice/.*\.test\.[a-z]+$
            AND ( basename(p) starts with "anno-"
                  OR git show $AUDIT_COMMIT:p matches /anno/i ) )
          OR
          ( p matches ^scripts/
            AND ( p contains "anno"
                  OR git show $AUDIT_COMMIT:p matches /anno/i ) ) }

|set| = 43   (19 + 13 + 11)
```

`[VERIFIED: reproduced twice this session, once per subset and once as a union]`

**Two properties this buys the guard, both of which `D-01` wants:**
1. It is a *derivation*, so a member can never silently drop out; the guard fails on a row-count mismatch.
2. It is *stable* — pinned to a commit in the object store, so it does not float with HEAD and does not go red when a later phase renames something.

**Caveat for the planner (`[ASSUMED]` — a design judgement, not a measurement):** the guard must run `git ls-tree`/`git show` against a repository that has `0394cbc`. In a shallow CI clone that object may be absent. `.github/workflows/ci.yml`'s checkout config was **NOT MEASURED — planner must verify** whether `fetch-depth: 0` is set; if it is not, either set it for this job or have the guard read a committed manifest of the 43 paths that it *regenerates and diffs* rather than trusts. (A regenerate-and-diff manifest is still a derivation, not a hand-typed list — the hand-typed-list prohibition is about *authoring*, not about caching.)

### 1.4 Forward map — every historical member's fate on the settled tree

Measured with (a) file existence at HEAD, (b) the `anno-` → `anno-` **name-descendant** predicate `CUT-01` uses, and (c) `git diff -M -C --name-status 0394cbc HEAD`. Note that git's own rename heuristic **disagrees** with the name-descendant map for five files whose content changed more than 50% (`anno-cli`, `anno-enum-gen`, `anno-memmap-render`, `anno-tools`, `anno-verb-coverage` are all scored `D`+`A` by git but do have `anno-*` descendants on disk). **Use the name-descendant predicate, not git's `-M` output** — it is the one `CUT-01` and `29-VERIFICATION.md` already established. `[VERIFIED: both runs this session]`

**Survives under the same path — 21 members** (candidate verdict `re-pointed` or `kept-unchanged`, per `D-03`/`D-05`):

`scripts/audit-gate.mjs`, `scripts/check-npm-packages.mjs`, `scripts/check-skill-fork-honesty.mjs`, `scripts/check-skill-tool-coverage.mjs`, `scripts/generate-tool-support-table.mjs`, `scripts/lib/skill-corpus.d.mts`, `scripts/lib/skill-descriptions.d.mts`, `scripts/lib/skill-descriptions.mjs`, `scripts/lib/skill-honesty-checks.mjs`, `src/mcp/vice/audit-integrity.test.ts`, `capability-registry.test.ts`, `disasm-roundtrip.test.ts`, `docs-dangling-refs.test.ts`, `hop-chain-comments.test.ts`, `hostpath-consumers.test.ts`, `skill-acme-build-cli.test.ts`, `skill-attribution.test.ts`, `stock-connect.test.ts`, `stock-dispatch.test.ts`, `tool-support-table.test.mjs`, `vice-proxy.test.ts`.

**Survives under a new name — 16 members** (candidate verdict `re-pointed`):

| Historical path | Settled-tree path | How established |
|---|---|---|
| `scripts/lib/anno-cli-verbs.mjs` | `scripts/lib/anno-cli-verbs.mjs` | name-descendant + git `R` |
| `scripts/lib/anno-cli-verbs.d.mts` | `scripts/lib/anno-cli-verbs.d.mts` | name-descendant (git scores `D`; `.d.mts` files are small, so `-M` misses) |
| `src/mcp/vice/docs-absorbed-decisions.test.ts` | `docs-absorbed-decisions.test.ts` | git `R`; plan 29-05, same commit as `audit-gate.mjs`'s registry entry (`D-12`) |
| `absorbed-answer-key.test.ts` | `absorbed-answer-key.test.ts` | git `R`; ROADMAP note "kept, not deleted" |
| `spawn-seam.test.ts` | `spawn-seam.test.ts` | `renamed-guard-disciplines` exemption, `check-no-analyser.mjs:~470` |
| `anno-derivation.test.ts` | `anno-derivation.test.ts` | `upstream-audit-manifest-provenance` exemption, `check-no-analyser.mjs:~409` |
| `anno-cli.test.ts` | `anno-cli.test.ts` | name-descendant |
| `anno-confidence.test.ts` | `anno-confidence.test.ts` | name-descendant + git `R` |
| `anno-coverage-grammar.test.ts` | `anno-coverage-grammar.test.ts` | name-descendant + git `R` |
| `anno-coverage.test.ts` | `anno-coverage.test.ts` | name-descendant + git `R` |
| `anno-d64.test.ts` | `anno-d64.test.ts` | name-descendant + git `R` |
| `anno-enum-gen.test.ts` | `anno-enum-gen.test.ts` | name-descendant |
| `anno-memmap-render.test.ts` | `anno-memmap-render.test.ts` | name-descendant |
| `anno-regbits.test.ts` | `anno-regbits.test.ts` | name-descendant + git `R` |
| `anno-tools.test.ts` | `anno-tools.test.ts` | name-descendant |
| `anno-verb-coverage.test.ts` | `anno-verb-coverage.test.ts` | name-descendant |

(**Corrected total: 21 same-path + 16 renamed = 37 survivors, 6 gone = 43.** An earlier draft of this section said "13 renamed"; the measured figure is 16, because `anno-cli-verbs.d.mts` and the four renames git's `-M` heuristic misses are each a distinct member.)

**Gone outright — 6 members** (candidate verdict `deleted`; each owes proof of absence plus the removing commit per `D-05`):

`src/mcp/vice/anno-launch.test.ts`, `anno-mcp-client.test.ts`, `anno-project.test.ts`, `anno-session.test.ts`, `anno-symbol-roundtrip.test.ts`, `anno-verify.test.ts`.

Verified absent: none of `anno-launch.test.ts`, `anno-mcp-client.test.ts`, `anno-project.test.ts`, `anno-session.test.ts`, `anno-symbol-roundtrip.test.ts`, `anno-verify.test.ts` exists on disk. `[VERIFIED: test -f loop, this session]` `29-21-SUMMARY.md:176-259` enumerates the removals and is the commit-level record `D-05` asks for.

**Arithmetic check: 21 + 16 + 6 = 43.** ✅

### 1.5 NEW guards since the v0.7.0 open that the set must also cover

Not in the historical 43, but created *by Phase 29* and therefore squarely inside `CUT-04`'s "guards pinned to the deleted subject" — the requirement itself says *"Phase 29 is the source of most of the guards it will audit"*:

- `scripts/check-no-analyser.mjs` + `.d.mts` (plan 29-02) — the gate itself
- `src/mcp/vice/removal-gate.test.ts` — its colocated planted-violation test
- `src/mcp/vice/fixtures/planted-removal-fixture.ts.txt`, `.md.txt` — its committed plants
- `scripts/check-skill-cli-invocations.mjs` + `scripts/lib/anno-cli-invocations.{mjs,d.mts}` (REPOINT-01/02)
- `src/mcp/vice/anno-cli-invocations.test.ts`

`[VERIFIED: git ls-files vs git ls-tree 0394cbc]`

**Recommendation to the planner:** make the derivation a **union of two pinned sets** — the 43 at `0394cbc`, plus every path introduced between `0394cbc` and a second pinned commit (the Phase 29 close) that matches `scripts/check-no-*|removal-gate|planted-removal-*|anno-cli-invocations`. Or, simpler and equally derivable: derive the 43 at `0394cbc` and separately require that every `scripts/check-*.mjs` and every `src/mcp/vice/docs-*.test.ts` on the **current** tree has a row too (both of those *are* derivable from HEAD by `readdirSync`, exactly as `audit-gate.mjs:172-176` already does). The second option reuses machinery that already exists and needs no second pinned commit.

---

## 2. Per-member plantability (sizing `D-07`)

### 2.1 Root-override support across the repo-level scripts

Measured by grepping each `scripts/*.mjs` for `--root` and for any `process.argv` use beyond the standard direct-invocation guard:

| Script | Root override? | How it resolves its root |
|---|---|---|
| `scripts/audit-gate.mjs` | **YES — `--root <dir>`** | `parseArgs()` at `:1119-1132`; `resolve(rootArg ?? join(HERE, ".."))` at `:1143` |
| `scripts/check-no-analyser.mjs` | **NO** | `const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))` at `:120`. Its only `process.argv` use is the direct-invocation guard at `:767` |
| `scripts/check-npm-packages.mjs` | **NO** | same shape; argv used only for the direct-invocation guard |
| `scripts/check-skill-tool-coverage.mjs` | **NO** | fixed paths, no `process.argv` at all |
| `scripts/check-skill-fork-honesty.mjs` | **NO** | fixed paths, no `process.argv` at all |
| `scripts/check-skill-description-overlap.mjs` | **NO** | fixed paths, no `process.argv` at all |
| `scripts/check-skill-cli-invocations.mjs` | **NO** | fixed paths, no `process.argv` at all |
| `scripts/generate-tool-support-table.mjs` | **NO** | argv used only for the direct-invocation guard |

`[VERIFIED: grep over scripts/*.mjs, this session]`

**So `D-07`'s split is 1 / 7 at the script level.** The `--root` pattern `D-06` and `D-07` build on exists in exactly one file, and it is the one file `CUT-04` does *not* name among its eleven.

**Cheapness assessment for adding `--root` (`[ASSUMED]` — reasoning from the code shape, not from an attempted edit):**
- `check-no-analyser.mjs` — **cheap in principle, expensive in practice.** `ROOT` is a module-scope `const` consumed by `trackedFiles()` (which shells `git ls-files` with `cwd: ROOT`) and by `shippedInstallerFiles()` (which calls `packFiles("installer")`, which runs `npm pack --dry-run` and therefore the installer's `prepack` hook). Pointing that at a synthetic tree means the synthetic tree must be a git repo with an `installer/` package. **Recommend working-tree mutation for this one**, not `--root`.
- `check-skill-tool-coverage.mjs`, `check-skill-fork-honesty.mjs`, `check-skill-description-overlap.mjs`, `check-skill-cli-invocations.mjs` — these read `src/skills/**` and manifest files. A `--root` addition is mechanically small (thread a parameter through the path constants). Whether it is *self-contained* per `D-07` is **NOT MEASURED — planner must verify** by reading each script's path-constant block.
- `generate-tool-support-table.mjs` — it *writes* `docs/tool-support.md`. Planting against it means asserting the generated table diverges. A `--root` here is the difference between a safe measurement and clobbering a file `CUT-06`'s close-gate requires to be byte-identical. **Strongly recommend `--root` for this one.**

### 2.2 Committed planted-violation fixtures already in the repo

`git ls-files 'src/mcp/vice/fixtures/planted-*'` → 6 files `[VERIFIED]`:

| Fixture | Belongs to |
|---|---|
| `planted-removal-fixture.md.txt` | `removal-gate.test.ts` (the shape `D-06` names) |
| `planted-removal-fixture.ts.txt` | `removal-gate.test.ts` |
| `planted-disposition-fixture.md` | `docs-review-disposition.test.ts` |
| `planted-review-fixture.md` | `docs-review-disposition.test.ts` |
| `planted-hop-chain-fixture.ts.txt` | `hop-chain-comments.test.ts` |
| `planted-phase-pointer-fixture.ts.txt` | `comment-phase-pointers.test.ts` |

The `.txt` suffix is deliberate — `check-no-analyser.mjs`'s `planted-fixtures` exemption records *"committed with a `.txt` suffix so no runner and no typechecker loads them"*, with `prefixes: ["src/mcp/vice/fixtures/planted-"]` and `prefixHits: 2`. **A new planted fixture under that prefix carrying the literal twice is already covered; one carrying it a different number of times is not** — `prefixHits` is an exact pin.

### 2.3 Guards that already carry an in-test non-vacuity assertion

53 of the 126 `*.test.*` files match `/planted|non-vacuity|nonVacuity/`. `[VERIFIED: grep -rln, this session]` Of the audited set's survivors, these already know how to fail: `absorbed-answer-key`, `acme-gate`, `anno-cli`, `anno-cli-invocations`, `anno-confidence`(via `anno-derive`), `anno-coverage`, `anno-coverage-grammar`, `anno-derivation`, `anno-regbits`, `anno-tools`(via `anno-register`), `anno-verb-coverage`, `audit-integrity`, `capability-registry`, `comment-phase-pointers`, `disasm-roundtrip`, `docs-absorbed-decisions`, `docs-dangling-refs`, `docs-linerefs`, `hop-chain-comments`, `hostpath-consumers`, `removal-gate`, `skill-attribution`, `spawn-seam`, `tool-support-table`, `vice-proxy`.

**`D-04` explicitly does not accept these as the proof** — they assert "the guard *can* fail", not "the guard *was observed* failing against its **new** subject". Use them as a **map of where the plant already exists in reusable form**, which is what CONTEXT.md's Reusable Assets section says. Where a test already has a planted-violation subtest, the harness's job is far easier: it can often plant the same thing against the real subject rather than inventing one.

**Not in that list, and therefore needing a plant designed from scratch:** `stock-connect.test.ts`, `stock-dispatch.test.ts`, `skill-acme-build-cli.test.ts`, `anno-d64.test.ts`, `anno-enum-gen.test.ts`, `anno-memmap-render.test.ts`, and all five non-`audit-gate` `scripts/check-*.mjs`.

---

## 3. The mutation harness's shape (D-04, D-06, D-17)

### 3.1 Running "only that guard"

Two distinct invocation surfaces, and the harness needs both:

**For a `*.test.ts` / `*.test.mjs` under `src/mcp/vice/`:**
```
node --test <basename>            # cwd = src/mcp/vice
```
This is exactly what both existing runners do: `test-gate.mjs:118` (`spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" })`) and `audit-gate.mjs`'s `runGuardsLive()` (`spawnSync(process.execPath, ["--test", ...files], { cwd: viceDir, encoding: "utf8", env, timeout: 15000, killSignal: "SIGKILL" })`). `[VERIFIED: src/mcp/vice/test-gate.mjs:117-120; scripts/audit-gate.mjs runGuardsLive]`

**⚠️ The `NODE_TEST_*` trap — reuse `audit-gate.mjs`'s fix verbatim.** `runGuardsLive()` strips every `NODE_TEST_*` key from the child's env before spawning, with this recorded reason (`scripts/audit-gate.mjs`, comment above `runGuardsLive`):

> *"When this gate itself runs from inside a `node --test` process … Node sets `NODE_TEST_CONTEXT` in the parent's own process.env; inherited unmodified, the NESTED `node --test` below silently switches its reporter to the parent-child IPC/v8-serialization protocol instead of TAP on stdout, so a genuinely failing guard is reported here as if it had produced no output at all — exit code 0, empty parsed output — which is precisely the 'green when it should be red' failure GATE-01 exists to make impossible."*

**A harness that omits this strip will record every planted violation as green and produce a fully vacuous audit.** This is the single highest-severity implementation pitfall in the phase.

**For a `scripts/check-*.mjs`:**
```
node scripts/<name>.mjs [--root <synthetic>]        # cwd = repo root
```
Direct file invocation, per `D-12-11`. Exit status is the verdict.

### 3.2 Restore-on-exit that cannot leave the tree dirty

`D-04` calls a dirty tree "corrupting this phase's own close-gate run". The strongest available shape, in order of preference:

1. **Prefer `--root <synthetic>` (D-06).** No mutation, nothing to restore. Available today only for `audit-gate.mjs`; `D-07` allows adding it where cheap (see §2.1's per-script assessment).
2. **Where mutation is unavoidable:** capture the file's original bytes with `readFileSync` **before** any write, register the restore in a `try/finally` **and** in handlers for `process.on("exit")`, `SIGINT`, `SIGTERM` and `uncaughtException`. Restore must be idempotent (a `restored` flag) since `finally` and `exit` both fire.
3. **Assert cleanliness as a precondition and as a postcondition.** Run `git status --porcelain` before the sweep and after every row. Refuse to start if dirty (or if dirty only with known-untracked files — see the landmine in §7.4). Fail loudly if a row leaves the tree changed.
4. **Never write into `docs/tool-support.md`** without a root override — `CUT-06`'s close gate requires it byte-identical.

**Suggested per-row loop (`[ASSUMED]` — a design proposal, not measured):**
```
for row in registry.rows where verdict == "re-pointed" | "superseded":
    assertTreeClean()
    original = plant(row)            # --root fixture, or capture+write
    result   = runGuard(row)         # node --test <file>  |  node scripts/<x>.mjs
    assert(result.status !== 0)      # the observed red
    record(row, command, stdout, stderr, status)
    revert(original)
    assertTreeClean()
```

### 3.3 Where the harness lives

`D-17`: a committed phase instrument, not a CI job, invoked by hand. `scripts/` + a committed `.d.mts` sibling is the established convention (`scripts/lib/anno-cli-verbs.{mjs,d.mts}`, `scripts/lib/skill-honesty-checks.{mjs,d.mts}`, `scripts/check-no-analyser.{mjs,d.mts}`). `[VERIFIED: git ls-files scripts/lib/]` The `.d.mts` sibling is only needed if a `*.test.ts` under strict TypeScript imports it — `check-no-analyser.d.mts`'s own header states exactly that: *"so its colocated test (src/mcp/vice/removal-gate.test.ts) typechecks under strict mode. This is a CI-only helper with no runtime role, so it stays out of src/mcp/vice/package.json's files[] like its .mjs sibling."*

---

## 4. The fate registry's format, its guard, and the new-file side effects (D-01, D-03, D-05, D-16)

### 4.1 Recommended serialization and location

**Recommendation:** JSON, at `.planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json`, with `scripts/check-guard-fates.mjs` as the derive-from-disk guard and `scripts/check-guard-fates.d.mts` as its ambient declaration if a colocated test imports it.

Rationale, in priority order:

1. **`.planning/` is excluded from the removal gate's scope by *prefix*.** `check-no-analyser.mjs:180`: `const PLANNING_PREFIX = ".planning/";` and `trackedFiles()` filters `.filter((p) => !p.startsWith(PLANNING_PREFIX))`. A registry whose rows name `src/mcp/vice/anno-session.test.ts` and whose prose says "pinned to the deleted analyser subject" would otherwise fire the gate on landing. **This is the decisive argument.** (The bare token `anno` does *not* fire it — `SUBJECT_NEEDLE = the subject needle at `:140` is the full contiguous literal only — but the registry's *prose* almost certainly will.)
2. JSON is machine-readable, so the guard reads it with `JSON.parse` rather than parsing Markdown, and `D-05`'s per-verdict evidence rules become a schema check rather than prose judgement.
3. `29-21-SUMMARY.md` is the model `D-15` names for the *evidence*; the registry is a different artifact (continuous, machine-checked) and should not be Markdown prose.

**Row schema, from `D-03` + `D-05`:**
```jsonc
{
  "auditCommit": "0394cbc",
  "rows": [
    {
      "historicalPath": "src/mcp/vice/anno-derivation.test.ts",
      "verdict": "re-pointed",              // re-pointed | deleted | superseded | kept-unchanged
      "newSubject": "src/mcp/vice/anno-derivation.test.ts",
      "observedRed": {                       // required for re-pointed / superseded
        "command": "node --test anno-derivation.test.ts",
        "cwd": "src/mcp/vice",
        "plant": "…what was planted, and where…",
        "exitStatus": 1,
        "excerpt": "…the failing assertion text…"
      },
      "removalTrigger": "…required wherever the guard survives its original trigger…"
    }
  ]
}
```

**Per-verdict evidence rules the guard enforces (`D-05`):**

| verdict | required fields |
|---|---|
| `re-pointed` | `newSubject` exists on disk; `observedRed` present with non-zero `exitStatus` |
| `deleted` | `newSubject` is `null`; path absent from the working tree; `removingCommit` present |
| `superseded` | `newSubject` names the replacement, which exists; the replacement's own `observedRed` |
| `kept-unchanged` | `newSubject === historicalPath`; the path exists; no `observedRed` owed |

### 4.2 What the guard checks

1. Derives the set (§1.3) and asserts **every member has exactly one row** — the `D-01` property.
2. Asserts **no row names a path outside the derived set** — the inverse, which is what stops the registry becoming a hand-typed second list that has drifted.
3. Applies the §4.1 per-verdict evidence rules.
4. Carries a **non-vacuity floor** in `audit-gate.mjs`'s own idiom (`DOCS_GUARD_FLOOR = 7` at `scripts/audit-gate.mjs:~108`, with its comment *"A glob that silently matches almost nothing must become a structural failure, never a vacuous green"*). Set the floor at 43 and state that raising or lowering it requires the same-commit justification `DOCS_GUARD_FLOOR`'s comment demands.
5. Carries its **own** planted-violation test (delete a row → red), because a guard with no non-vacuity assertion is exactly what `CUT-03` was written against.

### 4.3 Every guard that newly bites on the files this phase adds — enumerated

This is the "check whether adding a new `scripts/check-*.mjs` has side effects" question. Measured:

| Guard | Bites on a new `scripts/check-*.mjs`? | Detail |
|---|---|---|
| `scripts/audit-gate.mjs` | **NO** | `docsGuardFiles(viceDir)` is a *non-recursive* `readdirSync` of `src/mcp/vice/` filtered by `/^docs-.*\.test\.ts$/`. A `scripts/` file is invisible to it |
| `scripts/audit-gate.mjs` — if the new guard were a `docs-*.test.ts` | **YES, hard** | It would join the derived set and **must** be added to `EXPECTED_DOCS_GUARD_NAMES` **in the same commit**, or `audit-integrity.test.ts`'s two docs-guard assertions go red. This is the recorded reason `D-16` rejects "make it a plain `*.test.ts`". Two real incidents are in the file's own comments: `docs-uat-abstention.test.ts` (commit `19b5bd5`) and `docs-worktree-isolation.test.ts` (commit `a02863d`, CI run 33275610121) both landed unregistered and reddened CI |
| `src/mcp/vice/audit-integrity.test.ts` | **YES if `docs-*.test.ts`, NO otherwise** | Carries the disk-derived `deepEqual` and CR-02's registry-drift detector |
| `scripts/check-no-analyser.mjs` | **YES if the new file carries the literal** | Every exemption pins an **exact** hit count with `===`. `.github/workflows/ci.yml` is pinned at **1** under the `gate-self` class. **A new CI step whose `name:` or `run:` line contains `the external analyser` moves that to 2 and reds the gate.** Name the new guard `check-guard-fates.mjs` (or similar) with no form of the subject in it |
| `src/mcp/vice/ci-suite-coverage.test.ts` | **Probably, for a new *test* file** | It walks the tree for directories containing `*.test.(ts\|mts\|mjs\|js)` and cross-references `.github/workflows/ci.yml` steps (`CI_YAML_PATH` at `:268`; `SKIP_DIR_NAMES` includes `.planning` at `:~62`). It skips `.planning` entirely, so a registry there is invisible. **NOT MEASURED — planner must verify** whether a new `scripts/*.test.mjs` would require a new CI step to satisfy it |
| `scripts/check-skill-cli-invocations.mjs` | **NO** | Reads `src/skills/**` and the anno CLI verb tables, not `scripts/` |
| `scripts/check-npm-packages.mjs` | **Possibly** | It validates via `npm pack --dry-run --json` that both tarballs contain exactly the right files. `scripts/` is not in either package's `files[]` (both `check-no-analyser.mjs` and its `.d.mts` are documented as staying out), so a new `scripts/` file should be inert. **NOT MEASURED — planner must verify** by running it after the file lands |
| `src/mcp/vice/shipped-modules.test.ts` / `module-classification.test.ts` | **NO for `scripts/`** | They classify modules under `src/mcp/vice/` |

**Also `D-16`-specific:** the new step goes alongside the six existing ones at `.github/workflows/ci.yml:189-235` — `check-npm-packages.mjs` (`:189-190`), `check-no-analyser.mjs` (`:199-200`), `check-skill-tool-coverage.mjs` (`:206-207`), `check-skill-fork-honesty.mjs` (`:214-215`), `check-skill-description-overlap.mjs` (`:224-225`), `check-skill-cli-invocations.mjs` (`:234-235`). `[VERIFIED: grep -n over .github/workflows/ci.yml]` Nothing is added to `src/mcp/vice/package.json`'s `scripts` block, which currently holds exactly `test`, `test:automated`, `test:manual`, `typecheck`, `build`, `smoke`. `[VERIFIED: src/mcp/vice/package.json]`

---

## 5. The CUT-06 sweep census — re-measured with `grep -a`

### 5.1 Headline reconciliation against CONTEXT.md

| Measure | CONTEXT.md (discussion time) | Measured this session | Verdict |
|---|---|---|---|
| Tracked non-`.planning` files containing `the external analyser` | 35 | **35** | ✅ exact — **but only with `-a`** |
| Same, with a plain `grep` (no `-a`) | — | **34** | ⚠️ the NUL-byte trap, live |
| `.planning/PROJECT.md` `the external analyser` mentions | 46 | **46 lines / 51 occurrences** | ✅ "46" = lines; note both |
| `.planning/PROJECT.md` `anno_` occurrences | 26 | **17 lines / 23 occurrences** | ❌ **disagrees** — neither definition yields 26 |
| `CLAUDE.md` | 0 and 0 | **0 and 0** | ✅ exact (`D-11` confirmed) |
| `ARCHITECTURE.md` outside `.planning/` | none | **none** | ✅ exact |
| Total tracked files containing the literal (incl. `.planning/`) | — | **373** | new figure |

`[VERIFIED: git ls-files piped through a per-file grep -a loop, this session]`

**The NUL-byte trap is live and reproduced.** The file that vanishes from a plain grep is **`src/mcp/vice/anno-memmap-render.ts`**. Measured: 2 NUL bytes, first at **byte offset 15097, line 315**, file size 31604. `[VERIFIED: python3 byte scan, this session]`

⚠️ **Documentation drift, flag to the planner:** `check-no-analyser.mjs`'s header states *"carries a literal NUL byte at offset 12862 (line 291 …)"* and *"The tree-wide occurrence total is 399 with `-a` and 398 without"*. Both figures are now stale — the NUL has moved to offset 15097 / line 315 as the file grew. The gate's own `memmap-measurement-provenance` exemption pins the mention at **line 79** (`lines: { "src/mcp/vice/anno-memmap-render.ts": [79] }`), and the gate passes today, so the *pin* is still correct; only the header's descriptive offsets drifted. This is `CUT-06`-adjacent: a dated header stating a currently-false offset. **Recommended verdict: correct the offsets (drift repair on a live technical claim), or restate them as "measured at plan 29-02".** Either is defensible; do not leave a live-tense false number.

### 5.2 Per-file census with candidate `D-08` class and verdict

All 35, with occurrence counts from `grep -ao 'the external analyser' <f> | wc -l`. `[VERIFIED, this session]` Class per `D-08`: **(1)** dated findings, **(2)** licence/attribution, **(3)** live pointer.

| # | File | hits | Class | Candidate verdict | Note |
|---|---|---|---|---|---|
| 1 | `.github/workflows/ci.yml` | 1 | infra | **unchanged** | The step name; pinned at exactly 1 by `gate-self`. **Do not touch** |
| 2 | `README.md` | 2 | 2 | **unchanged** | `surviving-provenance` pins 2 — the attribution paragraph's link URL + link text, one line. All install prose already corrected by 29-09 |
| 3 | `THIRD-PARTY-NOTICES.md` | 3 | 2 | **unchanged** | ROADMAP: dual-licence notice *remains true* for retained prose |
| 4 | `docs/phase23-real-release-gate-findings.md` | 3 | 1 | **unchanged** | `findings-docs` pins 3 |
| 5 | `docs/phase9-external-analyser-probe-findings.md` | 43 | 1 | **unchanged** | `findings-docs` pins **44** (43 content + 1 in the filename). Dated record |
| 6 | `docs/stock-vice-parity.md` | 1 | 2 | **unchanged** | `surviving-provenance` pins 1 |
| 7 | `installer/THIRD-PARTY-NOTICES.md` | 7 | 2 | **unchanged** | Block-scoped `notices-attribution-blocks` |
| 8 | `scripts/check-npm-packages.mjs` | 1 | 2 | **unchanged** | `surviving-provenance` pins 1 |
| 9 | `scripts/check-skill-fork-honesty.mjs` | 2 | 2 | **unchanged** | `attribution-guard-test` pins 2 — required-string entry + header note (`CUT-05`, already resolved) |
| 10 | `scripts/lib/skill-descriptions.mjs` | 1 | 2 | **unchanged** | `surviving-provenance` pins 1 |
| 11 | `src/mcp/vice/THIRD-PARTY-NOTICES.md` | 17 | 2 | **unchanged** | Block-scoped |
| 12 | `src/mcp/vice/absorbed-answer-key.test.ts` | 2 | 1 | **unchanged** | `renamed-guard-disciplines` pins 2 — founding incident |
| 13 | `src/mcp/vice/acme-gate.ts` | 4 | 2 | **unchanged** | `surviving-provenance` pins 4 |
| 14 | `src/mcp/vice/anno-acme-ident.ts` | 1 | 1 | **unchanged** | `enum-name-threat-history`, line-scoped at `:68` |
| 15 | `src/mcp/vice/anno-coverage.test.ts` | 1 | 1 | **unchanged** | Line-scoped at `:1557` |
| 16 | `src/mcp/vice/anno-coverage.ts` | 2 | 1 | **unchanged** | Line-scoped at `:9` and `:1753` |
| 17 | `src/mcp/vice/anno-derivation.test.ts` | 3 | 2 | **unchanged** | `upstream-audit-manifest-provenance` pins 3 |
| 18 | **`src/mcp/vice/anno-memmap-render.ts`** | 1 | 1 | **unchanged (mention)** | The NUL-byte file. Mention pinned at `:79`. But see §5.1 — the *gate's header* describing this file is stale |
| 19 | `src/mcp/vice/disasm-roundtrip.test.ts` | 2 | 2 | **unchanged** | Pinned 2 |
| 20 | `src/mcp/vice/docs-absorbed-decisions.test.ts` | 2 | 1 | **unchanged** | Pinned 2 — the upstream issue #42 citation, `D-36`'s reversal trigger |
| 21 | `src/mcp/vice/docs-dangling-refs.test.ts` | 3 | 2 | **unchanged** | Pinned 3 |
| 22 | `src/mcp/vice/fixtures/README.md` | 1 | infra | **unchanged** | `gate-self` pins 1 |
| 23 | `src/mcp/vice/fixtures/planted-removal-fixture.md.txt` | 1 | infra | **unchanged** | `planted-fixtures` prefix, `prefixHits: 2` across the pair |
| 24 | `src/mcp/vice/fixtures/planted-removal-fixture.ts.txt` | 1 | infra | **unchanged** | ditto |
| 25 | `src/mcp/vice/prg-image.ts` | 1 | 2 | **unchanged** | Pinned 1 |
| 26 | `src/mcp/vice/removal-gate.test.ts` | 1 | infra | **unchanged** | `gate-self` pins 1 |
| 27 | `src/mcp/vice/shipped-modules.ts` | 1 | 2 | **unchanged** | Pinned 1 |
| 28 | `src/mcp/vice/skill-acme-build-cli.test.ts` | 1 | 2 | **unchanged** | Pinned 1 |
| 29 | `src/mcp/vice/skill-attribution.test.ts` | 12 | 2 | **unchanged** | `attribution-guard-test` pins 12 |
| 30 | `src/mcp/vice/spawn-seam.test.ts` | 1 | 1 | **unchanged** | Pinned 1 — the founding incident |
| 31 | `src/mcp/vice/stock-symbols.ts` | 6 | 2 | **unchanged** | Pinned 6 |
| 32 | `src/skills/c64-memory-mapping/SKILL.md` | 5 | 2 | **unchanged** | `skill-attribution-headers`, BLOCK-scoped on the `ATTRIBUTION (ABS-02)` marker |
| 33 | `src/skills/c64-program-recon/SKILL.md` | 4 | 2 | **unchanged** | ditto |
| 34 | `src/skills/c64-program-recon/scripts/packer-finding.mjs` | 1 | 2 | **unchanged** | `surviving-provenance` pins 1 — dated past-tense provenance |
| 35 | `src/skills/routine-queue-walker/SKILL.md` | 3 | 2 | **unchanged** | ditto |

**Conclusion for the tracked non-`.planning` tree: every one of the 35 is already either class 1 or class 2 under `D-08`, and every one is already pinned by an exact-count exemption in `check-no-analyser.mjs`, which exits 0 today.** There are **no live pointers left outside `.planning/`**. `D-09` still requires a row for each of the 35 ("we looked and it is fine"), but the sweep's *corrective* work is confined to `.planning/`.

**⚠️ Corollary the planner must not miss:** because every count is pinned with `===`, **any** edit to one of these 35 files that changes its `the external analyser` count reds the gate. The `D-09` sweep must therefore be verdict-recording, not editing, for all 35 — and the moment a plan *does* change one, it must re-pin in the same commit. This is the gate's own stated rule: *"a mention that moved moves its pin in the same commit, a mention that multiplied does not."*

Also note the **shipped-twin duplication**: `installer/skills/**` is gitignored but scanned via `packFiles()`. `check-no-analyser.mjs` pins `installer/skills/c64-program-recon/scripts/packer-finding.mjs: 1` and `SKILL_ATTRIBUTION_PINS` covers the shipped twins. **Every edit to a `src/skills/*/SKILL.md` must be followed by `node installer/scripts/sync-skills.mjs` before the gate is re-run** — `.github/workflows/ci.yml:126-128` does exactly this ("Generate the shipped skills tree").

### 5.3 `.planning/PROJECT.md` — where the live pointers actually are

| Measure | Value |
|---|---|
| Lines containing `the external analyser` | **46** |
| Occurrences of `the external analyser` | **51** |
| Lines containing `anno_` | **17** |
| Occurrences of `anno_` | **23** |
| Occurrences of `anno` (any form) | **112** |

`[VERIFIED: grep -a on .planning/PROJECT.md]`

**CONTEXT.md said "46 mentions and 26 `anno_` occurrences". The 46 reconciles (as *lines*). The 26 does not** — I measure 23 occurrences and 17 lines. Neither definition produces 26. Possible causes: the discussion-time figure counted `anno_` case-insensitively plus `ANNO_`, or counted a superset pattern, or was measured before a commit landed. **Give both numbers in the plan and state the command.** The delta of 3 is small but `D-09`'s whole point is that a silent omission bites exactly here.

**The live-pointer class inside `PROJECT.md`, confirmed by reading:**
- `.planning/PROJECT.md:311` — the Architecture constraint bullet. Names *"The `anno_*` family (v0.3.0 Phase 11) is registered through `buildViceTool()`"*. `CLAUDE.md:26`'s corrected twin says *"The `anno_*` family"*. **Live pointer at a deleted tool family → correct.**
- The same line carries the stale line citations — see §6.
- `PROJECT.md:745` — *"three first named here, and 13 non-`anno-`named test files reference it"* — a dated measurement statement; **class 1, keep**.
- `.planning/ARCHITECTURE.md:229` — **`### Rule A21 — One long-lived the external analyser child per project path, per proxy process`**, whose body cites `D18-04`, `D18-03`, `D18-21`, `D18-02` and `anno-mcp-client.ts` (a file that no longer exists). `[VERIFIED: sed -n '225,245p' .planning/ARCHITECTURE.md]` This is ROADMAP's "Rule A21" and it is a **live pointer stated in the present tense at a deleted module**. Candidate verdict: **correct, or convert to dated history with an explicit "superseded by the deletion" note.** `D-08` says only text telling a reader to *use/install/invoke* is corrected; A21 is an *architectural invariant* about code that no longer exists, which reads as live. Recommend converting to dated past tense rather than deleting (the `CORE-01`/`D-36` keep-dated precedent).
- **NOTE:** there are **four** `ARCHITECTURE.md` files, all inside `.planning/`: `.planning/ARCHITECTURE.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/archive-v0.6.0/ARCHITECTURE.md`. `A21` appears in **two** of them (`.planning/ARCHITECTURE.md` and `.planning/research/ARCHITECTURE.md`). `[VERIFIED: git ls-files | grep -i ARCHITECTURE.md; grep -aln 'A21']` CONTEXT.md's `D-11` says "ROADMAP's Rule A21 reference resolves to `.planning/ARCHITECTURE.md`" — true, but the planner should decide explicitly whether the research copy gets a row (recommend: yes, verdict `unchanged — research archive, dated by construction`).

**`.planning/` files with `the external analyser`, total: 338** (373 tracked − 35 non-`.planning`). `D-09` says every file in *the swept set* gets a row — the planner must define the swept set explicitly. **Recommendation:** the swept set is (a) the 35 tracked non-`.planning` files, plus (b) the named living documents `.planning/PROJECT.md`, `.planning/ARCHITECTURE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `CLAUDE.md`, plus (c) `README.md` and installer docs already in (a). Phase artifacts under `.planning/phases/` are dated records by construction and are out of scope — but **say so in a row**, because that is exactly the "we looked and it is fine" distinction `D-09` exists to draw.

---

## 6. `PROJECT.md`'s stale `vice-proxy.ts` citations and the `docs-linerefs.test.ts` widening (D-10)

### 6.1 The four MCP-02 numbers, re-verified on the settled tree

CLAUDE.md's MCP-02 bullet claims `rewriteArguments()` at `:3050`, `forwardToVice()` starting at `:2985`, `gatherWedgeEvidence()`'s call at `:1529`, function start `:1505`. Measured against `src/mcp/vice/vice-proxy.ts` (3489 lines):

| Claim | Measured | Verdict |
|---|---|---|
| `rewriteArguments()` call inside `forwardToVice()` at `:3050` | `3050:    const rewritten = rewriteArguments(args, name);` | ✅ **correct** |
| `forwardToVice()` starts at `:2985` | `2985:async function forwardToVice(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {` | ✅ **correct** |
| `gatherWedgeEvidence()`'s own call at `:1529` | `1529:    const { args: translated } = rewriteArguments({ path: screenshotContainerPath }, "vice_display_screenshot");` | ✅ **correct** |
| `gatherWedgeEvidence()` starts at `:1505` | `1505:async function gatherWedgeEvidence({ at, port, epoch }: IncidentAssetStemOptions): Promise<IncidentEvidence> {` | ✅ **correct** |

`[VERIFIED: grep -n 'rewriteArguments(' and function-start grep on src/mcp/vice/vice-proxy.ts, this session]`

**All four CLAUDE.md numbers are correct today. No drift.** (`rewriteArguments` itself is *defined* at `:2007`; the other two `rewriteArguments` mentions at `:1522` and `:1915` are comments, not call sites.)

### 6.2 `PROJECT.md`'s citations are stale by exactly +2

`.planning/PROJECT.md:311` cites `vice-proxy.ts:3052`, `:2987`, `vice-proxy.ts:1531`, `:1507`. `[VERIFIED: grep -aon 'vice-proxy\.ts:[0-9]*' .planning/PROJECT.md]`

Every one is **+2** off — precisely the −2 shift CLAUDE.md records: *"All four moved by −2 in phase 29 plan 29-10, which removed the retired analyser's session-close import and the comment block above its call site: 3052→3050, 2987→2985, 1531→1529, 1507→1505."*

**The repair is mechanical: 3052→3050, 2987→2985, 1531→1529, 1507→1505.**

`PROJECT.md:311` also already *records its own defect*, which is the strongest possible support for `D-10`:

> *"`docs-linerefs.test.ts` mechanically checks the two `rewriteArguments()` citations — the figures above were stale at `:2889`/`:1368` until the v0.3.0 close, and stale again at `:3029`/`:2964`/`:1508`/`:1484` until the v0.7.0 open, when `docs-linerefs.test.ts` was found to read only CLAUDE.md and not this copy."*

The same line additionally carries the `anno_*` live pointer (§5.3) — **both `D-10` and `D-08` corrections land on the same line 311**, which the planner should sequence as one edit.

⚠️ `.planning/ROADMAP.md:541` also carries a citation: `vice-proxy.ts:3216`. `[VERIFIED]` It is **not** in a `rewriteArguments()` context, so the current guard would not scan it — but if the widening changes the bullet-isolation predicate, it could be swept in. **Check this before widening.**

### 6.3 What widening `docs-linerefs.test.ts` requires — exactly

The file is 100 lines. Its scanned-document set is **not a set**: it is a single hard-coded path, read twice.

```
src/mcp/vice/docs-linerefs.test.ts:57   readFileSync(join(repoRoot({ from: HERE }), "CLAUDE.md"), "utf8")
src/mcp/vice/docs-linerefs.test.ts:68   readFileSync(join(repoRoot({ from: HERE }), "CLAUDE.md"), "utf8")
```

Structure:
- `CITATION_RE = /vice-proxy\.ts:(\d+)/g` (`:34`) — matches only the **full** `vice-proxy.ts:N` shape, **not** the bare `:2985` / `:1505` shorthand. **So only 2 of CLAUDE.md's 4 numbers are mechanically checked today**, which is exactly what the bullet says ("mechanically checks the two `rewriteArguments()` citations").
- `findRewriteArgumentsBullet(claudeMd)` (`:41-47`) — `lines.find((line) => line.includes("rewriteArguments()"))`. **`.find()`, so the FIRST matching line only.** CLAUDE.md has exactly one such line (`:26`) `[VERIFIED: grep -acn]`, so this is safe there.
- Three tests: a non-vacuity test asserting `citations.length >= 2` (`:56-64`), the real assertion that each cited line contains `rewriteArguments(` or matches `/^\s*(async\s+)?function\s+\w+/` (`:67-86`), and a planted-violation test using line 1 (`:88-100`).

**What the widening needs:**
1. Replace the two hard-coded reads with a **document set** — e.g. `const SCANNED_DOCS = ["CLAUDE.md", ".planning/PROJECT.md"]` — and loop the three tests over it. (A hand-typed two-item list is fine here: it is not a *guard set* being derived from disk, it is the guard's own subject declaration, the same shape `docs-dangling-refs.test.ts` uses.)
2. `findRewriteArgumentsBullet` must handle **multiple** matching lines per document, or at minimum assert exactly one. **NOT MEASURED — planner must verify** how many `PROJECT.md` lines contain the literal `rewriteArguments()`; `:311` is one, and `PROJECT.md` may carry another in a decisions row.
3. The non-vacuity floor must become per-document (`>= 2` per doc), or the sum, but *not* a single global count — a global count stays green if PROJECT.md's bullet is reworded to zero citations while CLAUDE.md still has two. That is precisely the vacuity `CUT-04` is auditing for.
4. `repoRoot({ from: HERE })` already resolves the repo root, so `.planning/PROJECT.md` is reachable with no new path machinery. `[VERIFIED: import at :28, usage at :57]`
5. **`D-07`'s ordering constraint applies:** the widening must land in a commit **before** the sweep measures `docs-linerefs`. And the citations must be **repaired first** — widening onto a `PROJECT.md` with `:3052` in it makes the guard red on landing, and ordering constraint 5 forbids recording anything green over a red guard. **Order: (a) repair PROJECT.md's four numbers → (b) widen the guard → (c) measure it.**
6. `docs-linerefs.test.ts` is a `docs-*.test.ts`, so it is already in `audit-gate.mjs`'s derived set and `EXPECTED_DOCS_GUARD_NAMES`. Widening it does not change membership; **no floor change and no registry edit needed.**

---

## 7. The close-gate re-run recipe (D-12, D-13, D-14, D-15)

### 7.1 The nine manual-only files

`src/mcp/vice/test-gate.mjs:95-105` — `MANUAL_ONLY_TESTS`, verbatim:

```
"vice-broker-launch.test.ts",
"vice-proxy.test.ts",
"broker-e2e.test.ts",
"stock-live.test.ts",
"stock-live-triage.test.ts",
"stock-live-broker-monitor.test.ts",
"stock-broker-live.test.ts",
"fork-live.test.ts",
"stock-a4-checkpoint-flood.test.ts",
```

`[VERIFIED: src/mcp/vice/test-gate.mjs:95-105]`

`automatedTestFiles(dir)` at `:110-113`:
```js
export function automatedTestFiles(dir) {
  const all = readdirSync(dir).filter((f) => /\.test\.[a-zA-Z0-9]+$/.test(f));
  return all.filter((f) => !MANUAL_ONLY_TESTS.includes(f)).sort();
}
```
`[VERIFIED: src/mcp/vice/test-gate.mjs:110-113]`

⚠️ CONTEXT.md cites "`src/mcp/vice/test-gate.mjs:95-104`" for `MANUAL_ONLY_TESTS` and "95-131" for both. The array spans **`:95-105`** (the closing `]);` is at `:105`) and `automatedTestFiles()` spans **`:107-114`** (JSDoc at `:107`). The file is 135 lines. Minor citation drift; give the corrected ranges.

**`test-gate.test.ts` is the drift guard and the single source of truth** (55 lines, `src/mcp/vice/test-gate.test.ts`). Its three tests: `MANUAL_ONLY_TESTS` contains exactly the nine (`:16`), the automated set + manual set equals the on-disk `*.test.*` set with no overlap (`:33`), and every manual-only entry exists on disk (`:51`). `[VERIFIED]` **Do not write a second list anywhere.**

**What each of the nine needs (`[ASSUMED]` for the per-file needs — inferred from names and the ci.yml comment, not measured by running them):**

| File | Needs |
|---|---|
| `vice-proxy.test.ts` | **Hangs locally** — the known landmine; reaches a default-SKIP branch on CI |
| `vice-broker-launch.test.ts` | Broker/launch machinery; hangs locally outside a devcontainer |
| `broker-e2e.test.ts` | Live broker end-to-end; provides the stdio proxy's only end-to-end wire proof (BACK-05) |
| `stock-live.test.ts` | Live stock VICE emulator |
| `stock-live-triage.test.ts` | Live stock VICE emulator |
| `stock-live-broker-monitor.test.ts` | Live stock VICE + broker |
| `stock-broker-live.test.ts` | Live stock VICE + broker |
| `fork-live.test.ts` | Live fork VICE |
| `stock-a4-checkpoint-flood.test.ts` | Live emulator, **opt-in behind its own env var CI never sets** |

`/usr/bin/x64sc` is genuine unpatched stock VICE on this host (the fork shadows it on `PATH`), so the six live-emulator files **can** be run for real locally rather than left as SKIPs. That is a meaningful upgrade over CI's evidence and worth stating in the `D-14` honesty clause.

### 7.2 `test:automated`'s baseline TODAY — measured

```
cd src/mcp/vice && npm run test:automated
```
```
# tests 2920
# suites 24
# pass 2914
# fail 0
# cancelled 0
# skipped 1
# todo 5
# duration_ms 50360.447751
exit status 0
```
`[VERIFIED: run this session, 2026-08-31, broker systemd unit inactive]`

**`test:automated` exits 0 on a clean tree today. There is no failure baseline.** This supersedes every historical baseline figure (44, 7, 5) recorded in earlier phases. The planner should treat **0 failures** as the floor and any non-zero as a real regression.

### 7.3 The six CI check scripts — all green today

```
node scripts/check-no-analyser.mjs        exit=0
node scripts/check-npm-packages.mjs              exit=0   (34 files, 7 skills)
node scripts/check-skill-tool-coverage.mjs       exit=0
node scripts/check-skill-fork-honesty.mjs        exit=0   (11 fork-only mentions, 33 files, 7 skill dirs)
node scripts/check-skill-description-overlap.mjs exit=0   (7 skills scanned)
node scripts/check-skill-cli-invocations.mjs     exit=0
node scripts/audit-gate.mjs --json               allowed:true, redGuards:[], structuralErrors:[]
```
`[VERIFIED: run this session]`

`audit-gate.mjs --json` reports **9 derived docs guards**, matching `EXPECTED_DOCS_GUARD_NAMES` exactly: `docs-absorbed-decisions`, `docs-core-value-decision`, `docs-dangling-refs`, `docs-deferred-ledger`, `docs-fork-decision`, `docs-linerefs`, `docs-review-disposition`, `docs-uat-abstention`, `docs-worktree-isolation`. **`DOCS_GUARD_FLOOR` is 7 and there are 9 on disk.** `[VERIFIED]`

**CONTEXT.md says "both `check-*.mjs` CI scripts"; there are six.** ROADMAP's criterion 2 language ("both `check-*.mjs` CI scripts") is from the Phase 29 close, where two were the phase's own. Run all six.

### 7.4 The concrete recipe

```bash
# --- 0. Precondition (D-13): assert and RECORD, do not kill -----------------
systemctl --user is-active vice-broker          # measured today: "inactive"
pgrep -af 'vice-broker'                         # must show no broker process
git rev-parse HEAD                              # the commit measured (D-15)
git status --porcelain                          # must be clean (see landmine below)

# --- 1. The automated leg (D-12) -------------------------------------------
cd src/mcp/vice && npm run test:automated        # today: 2920 tests, 0 fail, exit 0

# --- 2. The manual leg, file-by-file (D-12) --------------------------------
cd src/mcp/vice
for f in vice-broker-launch.test.ts broker-e2e.test.ts stock-live.test.ts \
         stock-live-triage.test.ts stock-live-broker-monitor.test.ts \
         stock-broker-live.test.ts fork-live.test.ts \
         stock-a4-checkpoint-flood.test.ts; do
  timeout 300 node --test "$f"; echo "$f exit=$?"
done
# vice-proxy.test.ts LAST and under an explicit timeout — it hangs locally.
timeout 300 node --test vice-proxy.test.ts; echo "vice-proxy exit=$?"

# --- 3. The six CI check scripts -------------------------------------------
node scripts/check-npm-packages.mjs
node scripts/check-no-analyser.mjs
node scripts/check-skill-tool-coverage.mjs
node scripts/check-skill-fork-honesty.mjs
node scripts/check-skill-description-overlap.mjs
node scripts/check-skill-cli-invocations.mjs

# --- 4. docs/tool-support.md byte-identical --------------------------------
node scripts/generate-tool-support-table.mjs     # then:
git diff --exit-code -- docs/tool-support.md     # must be exit 0

# --- 5. Every docs-*.test.ts green -----------------------------------------
node scripts/audit-gate.mjs --json               # allowed:true, redGuards:[]

# --- 6. Typecheck (cheap, catches .d.mts drift) ----------------------------
cd src/mcp/vice && npm run typecheck
```

**⚠️ Step 4 caveat:** whether `generate-tool-support-table.mjs` writes or only checks is **NOT MEASURED — planner must verify**. It reads `process.argv[1]` only for its direct-invocation guard, which suggests it writes on direct invocation. If so, run it and diff; if it has a `--check` mode, prefer that.

### 7.5 Landmines, stated plainly

1. **A live broker makes the BACK-05 D-G ordering test red deterministically.** Not a flake. `D-13`'s entire reason. **Measured today: `systemctl --user is-active vice-broker` → `inactive`**, so the gate run can proceed — but assert it programmatically and record the state beside the results, per `D-13`. Do **not** script a stop: the broker is a systemd unit and tearing down the developer's environment is the wrong shape.
2. **`npm test` over the full glob hangs locally on `vice-proxy.test.ts`.** Do not run bare `npm test` locally as the gate. `D-12`'s split exists for this. If you must run it, bound it with `timeout`.
3. **`test:automated`'s baseline is 0 failures today** — the historical 44/7/5 baselines are superseded. Any failure is real.
4. **The working tree is currently NOT clean** — four untracked files: `docs/dissambler-workflow.md`, `docs/undocumented-opcodes-ghidra.md`, `docs/vice-mcp-ideas.md`, `skills-lock.json`. `[VERIFIED: git status --porcelain]` None is tracked, so `check-no-analyser.mjs`'s `git ls-files` predicate does not see them (its header records this window as accepted: *"an untracked, not-yet `git add`ed file is invisible to a `--cached` predicate. CI runs post-commit, so the window is local-only. This is accepted."*). But the harness's `assertTreeClean()` must distinguish "untracked, pre-existing" from "modified by the plant", or every row will fail its precondition.
5. **`/tmp` is a 16GB RAM tmpfs with aging disabled**, and the suite leaks. Twelve `vice-proxy-evidence-test-*` directories are already sitting in `.planning/`. `[VERIFIED: ls .planning/]` Budget for it; clean up after the manual leg.
6. **The `NODE_TEST_*` strip** (§3.1) — a harness that runs `node --test` from inside `node --test` without stripping records reds as greens.
7. **`installer/skills/` must be re-synced** before re-running the removal gate after any `src/skills/` edit (§5.2).
8. **`D-14`'s honesty clause is not optional:** CI's whole-glob green at `.github/workflows/ci.yml:130-161` (`run: npm test`, `env: VICE_REQUIRE_ACME: "1"`, decided from run 32517575905, 2026-08-21) proves the nine manual-only files **did not fail**, not that they exercised anything — every one reaches its default-SKIP branch on the runner. The evidence must say this in words.

---

## 8. The two deferred guard fates

### 8.1 `block-class.ts`'s transitional capitalised block-type arm

**On disk, confirmed:** `src/mcp/vice/block-class.ts:171` carries the comment *"TRANSITIONAL -- the capitalised vocabulary, whose PRODUCER (the …"*, `:180` reads *"vocabulary ("Code", "Byte", "Undefined"). Deleting the two arms …"*, and `:195` is the live arm: `if (block.type === "Code") return "code";`. `[VERIFIED: grep -n on src/mcp/vice/block-class.ts]`

**The twelve fixtures are still spelled in that vocabulary and still on disk.** `git ls-files 'src/mcp/vice/fixtures/coverage/*/project.regen2000proj'` → **exactly 12**: `fp1-indexed-copy-loop`, `fp1b-immediate-copy-loop`, `fp2-zeropage-data-pointer`, `fp2b-immediate-data-pointer`, `fp3-unlinked-push-idiom`, `fp3b-immediate-push-idiom`, `nc1-all-auto`, `nc1b-auto-renamed-in-place`, `nc2-generic-comments`, `nc3-all-data-blocks`, `nc4-multi-caller-unnamed`, `nc5-well-documented`. `[VERIFIED: git ls-files, count 12]`

Note the fixture filename is `project.regen2000proj` — **`regen2000`, not `the external analyser`** — so it does **not** trip the removal gate's `SUBJECT_NEEDLE`. That is why 12 committed files carrying a retired producer's extension survive a gate that scans paths as well as content.

**Registry row (candidate):**

| field | value |
|---|---|
| historicalPath | `src/mcp/vice/block-class.ts` |
| verdict | `kept-unchanged` |
| newSubject | `src/mcp/vice/block-class.ts:195` — the `block.type === "Code"` arm, unmoved |
| observedRed | not owed (`D-05`: `kept-unchanged` owes proof its subject still exists untouched) |
| **removalTrigger (NEW)** | **"The twelve `src/mcp/vice/fixtures/coverage/*/project.regen2000proj` fixtures being re-spelled in the lowercase (`code`/`data`) vocabulary. Until then, deleting the capitalised arms silently reclassifies every fixture block as `data`. The original trigger — the producer's absence — is already satisfied and is NOT sufficient."** |

The proof-of-untouched for `D-05` is the 12-file count plus the fact that the fixtures are spelled in the capitalised vocabulary; **verify that spelling by reading one fixture** — **NOT MEASURED — planner must verify** that `project.regen2000proj` block types actually read `"Code"`/`"Byte"`/`"Undefined"` (I confirmed the arm and the fixture count, not the fixture contents).

### 8.2 `make-coverage-fixtures.mjs`'s frozen writer

**On disk, confirmed:** `src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs` carries a header block *"THE FROZEN PROJECT-FILE WRITER (plan 29-10, 2026-08-30)"* at `:67`, with the freeze instruction at `:97` — *"While no such file exists this writer is FROZEN: do not 'improve' …"*. `synthesizeProject()` is the module-private writer at `:121-…`, and it is called at `:943`: `writeFileSync(join(dir, "project.regen2000proj"), synthesizeProject(program, { origin: ORIGIN }));`. Header line `:43` records *"`synthesizeProject()` -- never hand-assembled JSON -- so the payload format …"*. `[VERIFIED: grep -n on src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs]`

**Registry row (candidate):**

| field | value |
|---|---|
| historicalPath | `src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs` |
| verdict | `kept-unchanged` |
| newSubject | `synthesizeProject()` at `:121`, called at `:943`, emitting byte-identical JSON to what the retired producer wrote |
| observedRed | not owed |
| **removalTrigger (NEW)** | **"The writer is re-pointed onto the Phase 28 annotation store. Doing so re-derives all twelve fixtures and changes what the census controls measure, so it is Phase 30's work on Phase 30's evidence. Until then the twelve committed `project.regen2000proj` files are the only remaining record of the format, as the file's own header at `:67-97` states."** |

**Both rows share one subject** — the twelve fixtures — which is why ROADMAP calls them *"one decision taken twice, not two"*. The registry should say so, so a later reader re-spelling the fixtures knows both rows discharge together.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Deriving a guard set | A hand-typed array of file names | `readdirSync` + a fixed pattern, or `git ls-tree` at a pinned commit | `D-12-07`; the `4f048bb` failure mode |
| Running one guard | A bespoke test runner | `spawnSync(process.execPath, ["--test", file], { cwd, env: stripped })` | `test-gate.mjs:117-120`, `audit-gate.mjs runGuardsLive` |
| Stripping `NODE_TEST_*` | Ignoring it | Copy `runGuardsLive()`'s strip loop verbatim | Nested `--test` silently reports reds as greens |
| Pointing a guard at a synthetic tree | An env-var override or a skip flag | `--root <dir>` | `D-12-14`: no waiver file, no env override, no relaxation hatch |
| Deriving the automated test set | A second glob | `automatedTestFiles()` from `test-gate.mjs` | Already drift-guarded by `test-gate.test.ts` |
| A per-file timeout runner for the manual leg | A new runner | `timeout 300 node --test <file>` in a shell loop | `D-12` explicitly rejected a new runner |
| Counting `the external analyser` occurrences | `grep` without `-a` | `grep -a`, or read bytes in-process | `anno-memmap-render.ts` is NUL-tainted; 34 vs 35 |
| Scoping the removal gate | A whole-tree grep | The existing gate | 236 legitimate permanent mentions; `CUT-02` |

## Common Pitfalls

### Pitfall 1: Nested `node --test` reports reds as greens
**What goes wrong:** the harness plants a violation, runs the guard, and records exit 0.
**Why:** `NODE_TEST_CONTEXT` inherited into a nested `--test` switches the reporter to IPC.
**How to avoid:** strip every `NODE_TEST_*` key from the child env (`audit-gate.mjs runGuardsLive`).
**Warning signs:** empty output + exit 0 from a guard you know you broke.

### Pitfall 2: A new file trips the exact-count exemptions
**What goes wrong:** the fate registry, its guard, or the new CI step names the subject, and `check-no-analyser.mjs` reds on the commit that lands it.
**Why:** every exemption count is asserted with `===`; `.github/workflows/ci.yml` is pinned at exactly 1.
**How to avoid:** put the registry under `.planning/` (prefix-excluded at `:180`) and name the guard/step with no form of the subject.

### Pitfall 3: Widening `docs-linerefs` before repairing `PROJECT.md`
**What goes wrong:** the widened guard is red on landing; ordering constraint 5 then forbids recording anything green.
**How to avoid:** repair `:311`'s four numbers first, then widen, then measure.

### Pitfall 4: A dirty tree corrupting the phase's own close-gate run
**What goes wrong:** a crashed harness leaves a plant in place; the close gate then measures a mutated tree.
**How to avoid:** capture-before-write, `try/finally` + exit/signal handlers, idempotent restore, `git status --porcelain` before and after every row, and a documented allowance for the four pre-existing untracked files.

### Pitfall 5: Editing one of the 35 census files without re-pinning
**What goes wrong:** a `CUT-06` correction changes a file's hit count and the gate reds.
**How to avoid:** the sweep is verdict-recording for all 35; where an edit is genuinely needed, move the pin in the same commit.

## Runtime State Inventory

*(This phase edits documents and adds two scripts; it is not a rename/migration, but the categories are answered explicitly.)*

| Category | Items Found | Action Required |
|---|---|---|
| Stored data | None — the registry is a new committed file; no datastore holds guard names | none |
| Live service config | The VICE broker (systemd user unit `vice-broker`, currently `inactive`) is a **precondition**, not a subject | assert + record (`D-13`); do not modify |
| OS-registered state | None — verified: `systemctl --user is-active vice-broker` → `inactive`; no other unit involved | none |
| Secrets/env vars | None. `VICE_REQUIRE_ACME=1` is set only inside `ci.yml:130-161`'s Test step | none |
| Build artifacts | `installer/skills/` (gitignored, regenerated by `installer/scripts/sync-skills.mjs`) is scanned by the removal gate via `packFiles()`. Twelve leaked `.planning/vice-proxy-evidence-test-*` dirs from prior runs | re-sync before any gate re-run after a skills edit; clean the leaked dirs |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node | everything | ✓ | ≥22.18 per `engines` | — |
| git | the pinned-commit derivation | ✓ | — | committed regenerate-and-diff manifest |
| `0394cbc` in the object store | the derivation | ✓ locally | — | `fetch-depth: 0` in CI, or the manifest fallback |
| systemd user unit `vice-broker` | `D-13` precondition | ✓ (inactive) | — | `pgrep -af vice-broker` |
| stock `x64sc` at `/usr/bin/x64sc` | the six live manual-only tests | ✓ (genuine unpatched stock) | — | default-SKIP branches |
| ACME | `disasm-roundtrip.test.ts` | assumed ✓ (`test:automated` green) | — | named SKIP unless `VICE_REQUIRE_ACME=1` |

**Missing dependencies with no fallback:** none identified.

## Validation Architecture

`.planning/config.json` — **NOT MEASURED — planner must verify** whether `workflow.nyquist_validation` is `false`. Assuming enabled:

### Test Framework
| Property | Value |
|---|---|
| Framework | Node's built-in test runner (`node --test`), no third-party framework |
| Config file | none; `src/mcp/vice/package.json` `scripts` block + `test-gate.mjs` |
| Quick run command | `cd src/mcp/vice && npm run test:automated` (~50 s, 2920 tests, 0 fail today) |
| Full suite command | `test:automated` + `test:manual` worked file-by-file (`D-12`) |

### Phase Requirements → Test Map
| Req | Behavior | Type | Automated command | Exists? |
|---|---|---|---|---|
| CUT-04 | Every audited-set member has a fate row | unit | `node scripts/check-guard-fates.mjs` | ❌ Wave 0 |
| CUT-04 | The fate guard is itself non-vacuous | unit | `node --test guard-fates.test.ts` (delete a row → red) | ❌ Wave 0 |
| CUT-04 | Each re-pointed guard observed red against its new subject | instrument | the mutation harness, by hand (`D-17`) | ❌ Wave 0 |
| CUT-06 | `PROJECT.md`'s citations are correct | unit | `cd src/mcp/vice && node --test docs-linerefs.test.ts` | ✅ exists, needs widening |
| CUT-06 | No living document points at a deleted route | unit | `node scripts/check-no-analyser.mjs` | ✅ exists, green |
| CUT-06 | Close gate | suite | §7.4's recipe | ✅ exists |

### Sampling Rate
- Per task commit: `npm run test:automated` + the six `check-*.mjs`
- Per wave merge: add `node scripts/audit-gate.mjs --json` and `npm run typecheck`
- Phase gate: §7.4 in full, recorded per `D-15`

### Wave 0 Gaps
- [ ] `scripts/check-guard-fates.mjs` (+ `.d.mts` if a test imports it) — covers CUT-04
- [ ] `src/mcp/vice/guard-fates.test.ts` — the guard's own non-vacuity assertion
- [ ] the mutation harness (`scripts/` per `D-17`)
- [ ] `.planning/phases/32-*/guard-fates.json` — the registry
- [ ] `.github/workflows/ci.yml` — one new named step at `:235`+
- [ ] `.planning/phases/32-*/evidence/` — `D-15`'s close-gate record

## Security Domain

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | **yes** | The harness and the fate guard must **never** evaluate, dynamically load, or shell-execute any text they scan (`audit-gate.mjs`'s stated threat T-12-03). Every subprocess argv is an **array** built from a directory listing or a pinned path list — never a shell string, never anything derived from scanned content, CLI argv or stdin |
| V6 Cryptography | no | — |

| Pattern | STRIDE | Mitigation |
|---|---|---|
| Command injection via a scanned file name | Tampering / Elevation | `spawnSync` with an argv **array**; no `shell: true`; no `execSync` on interpolated strings |
| Path traversal via a `--root` argument | Tampering | `resolve()` the root and refuse anything outside the repo, as `audit-gate.mjs:1147-1151` already does (WR-03: a mistyped `--root` used to throw uncaught) |
| A crashed harness leaving a plant in the tree | Tampering | Restore-on-exit (`D-04`), `git status --porcelain` pre/post |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | The registry should live under `.planning/` to dodge the removal gate's exact-count exemptions | §4.1 | If the planner puts it in `scripts/`, the gate reds on the landing commit — recoverable by adding an exemption, but that is a widening the gate's header forbids |
| A2 | `0394cbc` is the right pin for the audited set | §1.3 | Any of `0394cbc`/`764d32b`/`70ae2d2` reproduce both figures; picking a different one changes nothing measured |
| A3 | The per-file "needs" of the nine manual-only tests | §7.1 | Inferred from names + `ci.yml`'s comment, not from running them; a file may need something unlisted |
| A4 | Adding `--root` to the four skill-facing `check-*.mjs` is "cheap and self-contained" | §2.1 | If not, `D-07` falls back to working-tree mutation for those too — more restore surface |
| A5 | `generate-tool-support-table.mjs` writes on direct invocation | §7.4 | A wrong assumption means step 4's diff is vacuous |
| A6 | `check-npm-packages.mjs` is inert to a new `scripts/` file | §4.3 | If wrong, the new guard reds it; caught immediately by running it |
| A7 | The twelve `project.regen2000proj` fixtures are spelled in the capitalised vocabulary | §8.1 | If they are already lowercase, `block-class.ts`'s arm's new trigger is already satisfied and the row's verdict changes |

## Open Questions (RESOLVED)

All five were resolved during planning; each carries the plan that resolves it. None is open at
execution time.

1. **Does CI's checkout have full history?** — **RESOLVED by plan 32-09** (the CI step sets
   `fetch-depth: 0` on the job that runs the fate guard, so the two pinned commits are in the
   runner's object store; the regenerate-and-diff fallback is not needed).
   - Known: the derivation needs `0394cbc` in the object store.
   - Unclear: whether `.github/workflows/ci.yml`'s `actions/checkout` sets `fetch-depth: 0`.
   - Recommendation: read it in Wave 0; if shallow, either set `fetch-depth: 0` for the build job or use the regenerate-and-diff manifest fallback (§1.3).

2. **How many `PROJECT.md` lines contain `rewriteArguments()`?** — **RESOLVED by plan 32-04**
   (measured: six lines carry it, not one; the widening is written against the measured six).
   - Known: `:311` is one.
   - Unclear: whether there is a second (a Key Decisions row).
   - Recommendation: measure before widening; `findRewriteArgumentsBullet` uses `.find()` and would silently check only the first.

3. **Does `ci-suite-coverage.test.ts` demand a CI step for a new `scripts/*.test.mjs`?** —
   **RESOLVED by plan 32-01** (the question is made moot by colocating the fate guard's test as
   `src/mcp/vice/guard-fates.test.ts`, already covered by the existing `npm test` step; no new test
   directory under `scripts/` is created).
   - Known: it walks for test-containing directories and cross-references `ci.yml`; it skips `.planning`.
   - Recommendation: prefer colocating the fate guard's test as `src/mcp/vice/guard-fates.test.ts` (already covered by the existing `npm test` step) rather than creating a new test directory under `scripts/`.

4. **What exactly is the `D-09` "swept set"?** — **RESOLVED by plan 32-05** (the swept set is
   defined there, with the single recorded row explaining why `.planning/phases/**` artifacts are
   dated-by-construction and out of scope).
   - Known: 35 tracked non-`.planning` files + 338 `.planning` files carry the literal.
   - Recommendation: define it as the 35 plus the named living documents, and record a single row explaining why `.planning/phases/**` artifacts are dated-by-construction and out of scope.

5. **Where did CONTEXT.md's "26 `anno_` occurrences" come from?** — **RESOLVED by plan 32-05,
   Section A** (recorded as DISAGREEING with CONTEXT.md's 26: 17 lines / 23 occurrences, each with
   the command that produced it, 23 named as the working figure and the hypotheses for the 26 marked
   unconfirmed rather than asserted).
   - Measured: 23 occurrences / 17 lines in `.planning/PROJECT.md`.
   - Recommendation: state both, cite the command, and treat 23 as the working figure.

## Sources

### Primary (HIGH confidence) — read this session
- `.planning/phases/32-the-deletion-and-the-grep-gate/32-CONTEXT.md` — D-01..D-17, verbatim
- `.planning/ROADMAP.md` § Phase 32 — goal, two criteria, all six Notes
- `.planning/REQUIREMENTS.md` — `CUT-01`..`CUT-06`
- `scripts/audit-gate.mjs` — full header, `DOCS_GUARD_FLOOR`, `EXPECTED_DOCS_GUARD_NAMES`, `docsGuardFiles()`, `runGuardsLive()`, `parseArgs()`/`--root`
- `scripts/check-no-analyser.mjs` — header, `SUBJECT_NEEDLE:140`, `PLANNING_PREFIX:180`, `subjectHits():165`, `EXEMPTION_CLASSES`, `TEMPORARY_ALLOW_LIST` (closed/empty)
- `scripts/check-no-analyser.d.mts` — the `.d.mts` sibling convention
- `src/mcp/vice/test-gate.mjs:95-114` — `MANUAL_ONLY_TESTS`, `automatedTestFiles()`
- `src/mcp/vice/test-gate.test.ts` — the drift guard
- `src/mcp/vice/docs-linerefs.test.ts` — all 100 lines
- `src/mcp/vice/ci-suite-coverage.test.ts:40-110` — the tree walk and skips
- `src/mcp/vice/vice-proxy.ts` — the four MCP-02 line numbers
- `src/mcp/vice/block-class.ts:171,180,195`
- `src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs:43,67,97,121,943`
- `.github/workflows/ci.yml:120-240`
- `.planning/PROJECT.md:305-320,745`; `.planning/ARCHITECTURE.md:225-245`; `CLAUDE.md:26`
- `.planning/research/PITFALLS.md:36`
- `.planning/phases/29-the-mcp-surface/29-21-SUMMARY.md:176-301`

### Measurements executed this session
`git ls-files`, `git ls-tree -r --name-only <commit>`, `git show <commit>:<path>`, `git diff -M -C --name-status`, `git status --porcelain`, `grep -a`/`grep -ao`/`grep -an`, a python3 byte scan for NULs, `node scripts/*.mjs` × 7, `npm run test:automated`, `systemctl --user is-active vice-broker`.

## Metadata

**Confidence breakdown:**
- Audited-set derivation & reconciliation: **HIGH** — both `CUT-04` figures reproduce exactly at a pinned commit, twice, by two decompositions
- Plantability / `--root` inventory: **HIGH** for the yes/no table (grepped); **MEDIUM** for the "cheap to add" judgements (reasoned, not attempted)
- Harness shape: **HIGH** — both invocation surfaces and the `NODE_TEST_*` trap are read out of existing, working code
- Registry format & side effects: **HIGH** for the enumerated guards; **MEDIUM** for `ci-suite-coverage`/`check-npm-packages` (marked NOT MEASURED)
- `CUT-06` census: **HIGH** — 35/35 with `-a`, 34 without, per-file counts measured
- Line citations: **HIGH** — all four verified against source
- Close gate: **HIGH** — every command run this session with recorded exit status
- Deferred fates: **HIGH** for existence and the 12-fixture count; **MEDIUM** for fixture *contents* (A7)

**Research date:** 2026-08-31
**Valid until:** 7 days — line numbers, hit counts and the test baseline drift with every commit. Re-verify §6.1 and §7.2 at plan time.
